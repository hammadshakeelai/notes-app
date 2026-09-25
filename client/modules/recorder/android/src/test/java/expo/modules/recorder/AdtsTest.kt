package expo.modules.recorder

import java.io.File
import java.io.IOException
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class AdtsTest {
  @get:Rule val temporary = TemporaryFolder()

  private fun frame(size: Int = 83): ByteArray = Adts.header(size) + ByteArray(size) { (it * 13).toByte() }
  private fun file(bytes: ByteArray): File = temporary.newFile().apply { writeBytes(bytes) }

  @Test fun `AAC LC mono 32k header and decoder config match the bitstream`() {
    val header = Adts.header(83)
    assertArrayEquals(byteArrayOf(0xff.toByte(), 0xf1.toByte(), 0x54, 0x40, 0x0b, 0x5f, 0xfc.toByte()), header)
    val parsed = Adts.parse(header)
    assertEquals(2, parsed.objectType)
    assertEquals(32000, parsed.sampleRate)
    assertEquals(1, parsed.channelCount)
    assertEquals(90, parsed.frameLength)
    assertEquals(7, parsed.headerLength)
    assertEquals(83, parsed.payloadLength)
    assertArrayEquals(byteArrayOf(0x12, 0x88.toByte()), Adts.audioSpecificConfig(parsed))
  }

  @Test fun `every legal frame length round trips`() {
    for (payload in 1..8184) assertEquals(payload, Adts.parse(Adts.header(payload)).payloadLength)
  }

  @Test fun `scanner counts samples and provides exact frame offsets`() {
    val first = frame(70)
    val second = frame(300)
    val recording = file(first + second)
    val offsets = mutableListOf<Long>()
    val scan = Adts.scan(recording) { offset, _ -> offsets.add(offset) }
    assertEquals(listOf(0L, first.size.toLong()), offsets)
    assertEquals(2L, scan.frameCount)
    assertEquals(2048L, scan.samples)
    assertEquals(recording.length(), scan.validBytes)
    assertEquals(0L, scan.incompleteBytes)
  }

  @Test fun `every possible torn final frame preserves complete preceding frames`() {
    val intact = frame()
    val last = frame(37)
    for (cut in 1 until last.size) {
      val recording = file(intact + last.copyOf(cut))
      val before = recording.readBytes()
      val preview = Adts.scan(recording)
      assertEquals(1L, preview.frameCount)
      assertEquals(cut.toLong(), preview.incompleteBytes)
      assertArrayEquals(before, recording.readBytes())
      val recovery = Adts.scan(recording, truncateIncompleteTail = true)
      assertEquals(1L, recovery.frameCount)
      assertArrayEquals(intact, recording.readBytes())
    }
  }

  @Test fun `incomplete first frame recovers to empty file`() {
    val recording = file(frame().copyOf(10))
    val scan = Adts.scan(recording, truncateIncompleteTail = true)
    assertEquals(0L, scan.frameCount)
    assertNull(scan.format)
    assertEquals(0L, recording.length())
  }

  @Test fun `malformed tail is never mistaken for an incomplete write`() {
    for (garbage in listOf(byteArrayOf(0), byteArrayOf(0xff.toByte(), 0x00))) {
      val original = frame() + garbage
      val recording = file(original)
      assertThrows(IOException::class.java) { Adts.scan(recording, true) }
      assertArrayEquals(original, recording.readBytes())
    }
  }

  @Test fun `interior corruption never resynchronizes or truncates good audio`() {
    val original = frame() + ByteArray(20) + frame()
    val recording = file(original)
    assertThrows(IOException::class.java) { Adts.scan(recording, true) }
    assertArrayEquals(original, recording.readBytes())
  }

  @Test fun `reserved rate and multi-block frames are rejected`() {
    val badRate = Adts.header(30).also { it[2] = 0x7c }
    val multiBlock = Adts.header(30).also { it[6] = 0xfd.toByte() }
    assertThrows(IOException::class.java) { Adts.parse(badRate) }
    assertThrows(IOException::class.java) { Adts.parse(multiBlock) }
  }

  @Test fun `empty frame and program-config channels are rejected`() {
    val noPayload = byteArrayOf(0xff.toByte(), 0xf1.toByte(), 0x54, 0x40, 0x00, 0xff.toByte(), 0xfc.toByte())
    val noChannels = Adts.header(30).also { it[3] = 0 }
    assertThrows(IOException::class.java) { Adts.parse(noPayload) }
    assertThrows(IOException::class.java) { Adts.parse(noChannels) }
  }

  @Test fun `format change in valid frames preserves file on rejection`() {
    val changed = Adts.header(20, sampleRate = 44100) + ByteArray(20)
    val original = frame() + changed
    val recording = file(original)
    assertThrows(IOException::class.java) { Adts.scan(recording, true) }
    assertArrayEquals(original, recording.readBytes())
  }

  @Test fun `CRC protected frame offsets include two CRC bytes`() {
    val header = Adts.header(32).also { it[1] = 0xf0.toByte() }
    val recording = file(header + ByteArray(32))
    val parsed = Adts.scan(recording).format!!
    assertEquals(9, parsed.headerLength)
    assertEquals(30, parsed.payloadLength)
  }

  @Test fun `chunk discovery sorts names excludes other files and detects missing chunks`() {
    val directory = temporary.newFolder()
    File(directory, "chunk000001.aac").writeBytes(frame())
    File(directory, "chunk000000.aac").writeBytes(frame())
    File(directory, "recording.m4a").writeText("unrelated")
    assertEquals(listOf("chunk000000.aac", "chunk000001.aac"), Adts.chunkFiles(directory).map { it.name })
    File(directory, "chunk000003.aac").writeBytes(frame())
    assertThrows(IOException::class.java) { Adts.chunkFiles(directory) }
  }
}
