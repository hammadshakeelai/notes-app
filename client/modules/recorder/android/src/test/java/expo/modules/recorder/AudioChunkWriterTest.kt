package expo.modules.recorder

import java.io.File
import java.io.IOException
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class AudioChunkWriterTest {
  @get:Rule val temporary = TemporaryFolder()

  @Test fun `rotation preserves every AAC frame with at most one frame of chunk rounding`() {
    val directory = temporary.newFolder()
    val frames = 2000
    AudioChunkWriter(directory, 0).use { writer ->
      repeat(frames) { index -> writer.write(ByteArray(37) { index.toByte() }) }
    }
    val chunks = Adts.chunkFiles(directory)
    assertEquals(3, chunks.size)
    val scans = chunks.map { Adts.scan(it) }
    assertEquals(listOf(938L, 938L, 124L), scans.map { it.frameCount })
    assertEquals(frames * 1024L, scans.sumOf { it.samples })
    assertTrue(scans.all { it.incompleteBytes == 0L })
    var frameIndex = 0
    chunks.forEach { chunk ->
      val bytes = chunk.readBytes()
      Adts.scan(chunk) { offset, header ->
        val payload = bytes.copyOfRange(offset.toInt() + header.headerLength, offset.toInt() + header.frameLength)
        assertArrayEquals(ByteArray(37) { frameIndex.toByte() }, payload)
        frameIndex++
      }
    }
    assertEquals(frames, frameIndex)
  }

  @Test fun `resumed capture never overwrites existing chunks`() {
    val directory = temporary.newFolder()
    AudioChunkWriter(directory, 0).use { it.write(byteArrayOf(10, 20)) }
    val original = File(directory, "chunk000000.aac").readBytes()
    assertThrows(IOException::class.java) { AudioChunkWriter(directory, 0) }
    assertArrayEquals(original, File(directory, "chunk000000.aac").readBytes())
    AudioChunkWriter(directory, 1).use { it.write(byteArrayOf(30, 40)) }
    assertEquals(2, Adts.chunkFiles(directory).size)
  }

  @Test fun `stop at exact chunk boundary creates no spurious trailing chunk`() {
    val directory = temporary.newFolder()
    AudioChunkWriter(directory, 0).use { writer -> repeat(938) { writer.write(byteArrayOf(1)) } }
    assertEquals(1, Adts.chunkFiles(directory).size)
    assertEquals(938L, Adts.scan(Adts.chunkFiles(directory).single()).frameCount)
  }
}
