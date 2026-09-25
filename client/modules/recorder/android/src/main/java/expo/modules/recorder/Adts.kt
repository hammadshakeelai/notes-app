package expo.modules.recorder

import java.io.File
import java.io.IOException
import java.io.RandomAccessFile

/** Small, strict ADTS reader. It never searches past corruption for another sync word. */
internal object Adts {
  const val SAMPLES_PER_FRAME = 1024
  const val MAX_FRAME_LENGTH = 8191
  private val sampleRates = intArrayOf(96000, 88200, 64000, 48000, 44100, 32000,
    24000, 22050, 16000, 12000, 11025, 8000, 7350)

  data class Header(
    val objectType: Int,
    val sampleRate: Int,
    val channelCount: Int,
    val frameLength: Int,
    val headerLength: Int,
  ) {
    val payloadLength: Int get() = frameLength - headerLength
    fun sameFormat(other: Header) = objectType == other.objectType &&
      sampleRate == other.sampleRate && channelCount == other.channelCount
  }

  data class ScanResult(
    val frameCount: Long,
    val samples: Long,
    val validBytes: Long,
    val incompleteBytes: Long,
    val format: Header?,
  )

  fun header(payloadLength: Int, sampleRate: Int = 32000, channelCount: Int = 1): ByteArray {
    require(payloadLength > 0 && payloadLength <= MAX_FRAME_LENGTH - 7)
    val frequencyIndex = sampleRates.indexOf(sampleRate)
    require(frequencyIndex >= 0) { "Unsupported ADTS sample rate: $sampleRate" }
    require(channelCount in 1..6 || channelCount == 8) { "Unsupported ADTS channel count" }
    val channelConfig = if (channelCount == 8) 7 else channelCount
    val length = payloadLength + 7
    return byteArrayOf(
      0xff.toByte(), 0xf1.toByte(), // MPEG-4, no CRC, AAC-LC (object type 2).
      ((1 shl 6) or (frequencyIndex shl 2) or (channelConfig shr 2)).toByte(),
      (((channelConfig and 3) shl 6) or (length shr 11)).toByte(),
      ((length shr 3) and 0xff).toByte(),
      (((length and 7) shl 5) or 0x1f).toByte(),
      0xfc.toByte(), // Variable bitrate fullness, one raw AAC block.
    )
  }

  fun parse(bytes: ByteArray): Header {
    if (bytes.size < 7) throw IOException("Incomplete ADTS header")
    validatePrefix(bytes, 7)
    val profile = ((bytes[2].toInt() and 0xff) shr 6) + 1
    val frequencyIndex = (bytes[2].toInt() shr 2) and 15
    val channelConfig = ((bytes[2].toInt() and 1) shl 2) or
      ((bytes[3].toInt() and 0xff) shr 6)
    if (channelConfig == 0) throw IOException("ADTS program-config channels are unsupported")
    val headerLength = if ((bytes[1].toInt() and 1) == 1) 7 else 9
    val length = ((bytes[3].toInt() and 3) shl 11) or
      ((bytes[4].toInt() and 0xff) shl 3) or ((bytes[5].toInt() and 0xff) shr 5)
    if (length <= headerLength) throw IOException("ADTS frame has no payload")
    if ((bytes[6].toInt() and 3) != 0) throw IOException("Multiple ADTS raw blocks are unsupported")
    return Header(profile, sampleRates[frequencyIndex],
      if (channelConfig == 7) 8 else channelConfig, length, headerLength)
  }

  /** Validate even a short EOF prefix before deciding that it is a torn write. */
  private fun validatePrefix(bytes: ByteArray, count: Int) {
    if (count >= 1 && (bytes[0].toInt() and 0xff) != 0xff) throw IOException("Invalid ADTS sync word")
    if (count >= 2 && (bytes[1].toInt() and 0xf6) != 0xf0) throw IOException("Invalid ADTS sync/layer")
    if (count >= 3 && ((bytes[2].toInt() shr 2) and 15) >= sampleRates.size) {
      throw IOException("Reserved ADTS sample rate")
    }
    if (count >= 4 && ((bytes[2].toInt() and 1) shl 2 or
        ((bytes[3].toInt() and 0xff) shr 6)) == 0) {
      throw IOException("ADTS program-config channels are unsupported")
    }
  }

  /**
   * Truncation happens only after every complete frame has validated. A malformed
   * header throws without changing the file; only an incomplete EOF frame is repairable.
   * Frame callbacks receive the offset of the full header, not the payload.
   */
  fun scan(
    file: File,
    truncateIncompleteTail: Boolean = false,
    onFrame: ((Long, Header) -> Unit)? = null,
  ): ScanResult {
    RandomAccessFile(file, if (truncateIncompleteTail) "rw" else "r").use { input ->
      val size = input.length()
      var offset = 0L
      var count = 0L
      var format: Header? = null
      val bytes = ByteArray(7)
      while (offset < size) {
        val available = minOf(7L, size - offset).toInt()
        input.seek(offset)
        input.readFully(bytes, 0, available)
        validatePrefix(bytes, available)
        if (available < 7) break
        val parsed = parse(bytes)
        if (format != null && !format.sameFormat(parsed)) throw IOException("ADTS format changes inside ${file.name}")
        if (parsed.frameLength > size - offset) break
        if (format == null) format = parsed
        onFrame?.invoke(offset, parsed)
        offset += parsed.frameLength
        count++
      }
      if (truncateIncompleteTail && offset != size) {
        input.setLength(offset)
        input.fd.sync()
      }
      return ScanResult(count, count * SAMPLES_PER_FRAME, offset, size - offset, format)
    }
  }

  fun audioSpecificConfig(header: Header): ByteArray {
    val frequencyIndex = sampleRates.indexOf(header.sampleRate)
    require(frequencyIndex >= 0)
    val channelConfig = if (header.channelCount == 8) 7 else header.channelCount
    return byteArrayOf(
      ((header.objectType shl 3) or (frequencyIndex shr 1)).toByte(),
      (((frequencyIndex and 1) shl 7) or (channelConfig shl 3)).toByte(),
    )
  }

  fun chunkFiles(directory: File): List<File> {
    val files = directory.listFiles() ?: throw IOException("Cannot read recording directory")
    val chunks = files.filter { it.isFile && Regex("chunk[0-9]{6}\\.aac").matches(it.name) }.sortedBy { it.name }
    chunks.forEachIndexed { index, file ->
      if (file.name.substring(5, 11).toInt() != index) throw IOException("Missing audio chunk before ${file.name}")
    }
    return chunks
  }
}
