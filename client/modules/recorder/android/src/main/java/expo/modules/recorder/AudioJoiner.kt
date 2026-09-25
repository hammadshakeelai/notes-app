package expo.modules.recorder

import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.system.Os
import java.io.File
import java.io.IOException
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.security.MessageDigest
import kotlin.math.abs

data class JoinResult(val file: File, val durationMs: Long, val frameCount: Long)

/** Losslessly remuxes AAC. The service may remove chunks only after saving this result. */
object AudioJoiner {
  private data class Expected(
    val format: Adts.Header,
    val frames: Long,
    val digest: ByteArray,
  ) {
    val durationUs: Long get() = frames * Adts.SAMPLES_PER_FRAME * 1_000_000L / format.sampleRate
  }

  fun join(directory: File): JoinResult {
    val chunks = Adts.chunkFiles(directory)
    if (chunks.isEmpty()) throw IOException("No audio chunks to recover")
    val expected = inspect(chunks)
    val result = File(directory, "recording.m4a")
    // Handles a process death after publication but before the manifest was saved.
    if (result.isFile && runCatching { verify(result, expected) }.isSuccess) {
      return JoinResult(result, expected.durationUs / 1000, expected.frames)
    }
    val pending = File(directory, "recording.pending.m4a")
    // All source validation completes before repairing a torn tail or writing output.
    Adts.scan(chunks.last(), truncateIncompleteTail = true)
    var muxer: MediaMuxer? = null
    try {
      muxer = MediaMuxer(pending.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC,
        expected.format.sampleRate, expected.format.channelCount).apply {
        setInteger(MediaFormat.KEY_AAC_PROFILE, expected.format.objectType)
        setByteBuffer("csd-0", ByteBuffer.wrap(Adts.audioSpecificConfig(expected.format)))
      }
      val track = muxer.addTrack(format)
      muxer.start()
      var samples = 0L
      val info = MediaCodec.BufferInfo()
      val output = muxer
      eachFrame(chunks) { _, payload ->
        info.set(0, payload.size, samples * 1_000_000L / expected.format.sampleRate,
          MediaCodec.BUFFER_FLAG_KEY_FRAME)
        output.writeSampleData(track, ByteBuffer.wrap(payload), info)
        samples += Adts.SAMPLES_PER_FRAME
      }
      // Set the duration of the last sample explicitly, including one-frame clips.
      info.set(0, 0, expected.durationUs, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
      output.writeSampleData(track, ByteBuffer.allocate(0), info)
      muxer.stop()
      muxer.release()
      muxer = null
      RandomAccessFile(pending, "rw").use { it.fd.sync() }
      verify(pending, expected)
      // Same-directory POSIX rename is atomic and can replace a previously invalid result.
      Os.rename(pending.absolutePath, result.absolutePath)
      return JoinResult(result, expected.durationUs / 1000, expected.frames)
    } finally {
      runCatching { muxer?.release() }
      // Keep chunks, the old result and even the pending output on failure for recovery.
    }
  }

  private fun inspect(chunks: List<File>): Expected {
    var common: Adts.Header? = null
    var frames = 0L
    val digest = MessageDigest.getInstance("SHA-256")
    chunks.forEachIndexed { index, file ->
      RandomAccessFile(file, "r").use { input ->
        val scan = Adts.scan(file) { offset, header ->
          if (header.objectType != 2 || header.sampleRate != 32000 || header.channelCount != 1) {
            throw IOException("Unsupported recorder AAC format in ${file.name}")
          }
          if (common != null && !common!!.sameFormat(header)) throw IOException("Audio chunk format mismatch")
          common = header
          val payload = ByteArray(header.payloadLength)
          input.seek(offset + header.headerLength)
          input.readFully(payload)
          digest.update(payload)
        }
        if (scan.incompleteBytes > 0 && index != chunks.lastIndex) {
          throw IOException("An earlier audio chunk is incomplete: ${file.name}")
        }
        frames += scan.frameCount
      }
    }
    if (frames == 0L || common == null) throw IOException("No complete audio frames to recover")
    return Expected(common!!, frames, digest.digest())
  }

  private fun eachFrame(chunks: List<File>, action: (Adts.Header, ByteArray) -> Unit) {
    chunks.forEach { file ->
      RandomAccessFile(file, "r").use { input ->
        Adts.scan(file) { offset, header ->
          val payload = ByteArray(header.payloadLength)
          input.seek(offset + header.headerLength)
          input.readFully(payload)
          action(header, payload)
        }
      }
    }
  }

  /** Re-read published media, comparing every payload and every presentation time. */
  private fun verify(file: File, expected: Expected) {
    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(file.absolutePath)
      if (extractor.trackCount != 1) throw IOException("Joined recording must contain exactly one audio track")
      val format = extractor.getTrackFormat(0)
      if (format.getString(MediaFormat.KEY_MIME) != MediaFormat.MIMETYPE_AUDIO_AAC ||
        format.getInteger(MediaFormat.KEY_SAMPLE_RATE) != expected.format.sampleRate ||
        format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) != expected.format.channelCount) {
        throw IOException("Joined recording audio format does not match chunks")
      }
      val frameUs = Adts.SAMPLES_PER_FRAME * 1_000_000L / expected.format.sampleRate
      if (!format.containsKey(MediaFormat.KEY_DURATION) ||
        abs(format.getLong(MediaFormat.KEY_DURATION) - expected.durationUs) > frameUs) {
        throw IOException("Joined recording duration does not match chunks")
      }
      extractor.selectTrack(0)
      val buffer = ByteBuffer.allocate(Adts.MAX_FRAME_LENGTH)
      val digest = MessageDigest.getInstance("SHA-256")
      var frames = 0L
      while (true) {
        buffer.clear()
        val size = extractor.readSampleData(buffer, 0)
        if (size < 0) break
        if (size == 0 || size > buffer.capacity() || frames >= expected.frames) {
          throw IOException("Joined recording contains an unexpected sample")
        }
        val expectedTime = frames * Adts.SAMPLES_PER_FRAME * 1_000_000L / expected.format.sampleRate
        if (abs(extractor.sampleTime - expectedTime) > 1L) {
          throw IOException("Joined recording has a discontinuous audio timeline")
        }
        val payload = ByteArray(size)
        buffer.position(0)
        buffer.get(payload)
        digest.update(payload)
        frames++
        if (!extractor.advance()) break
      }
      if (frames != expected.frames || !MessageDigest.isEqual(expected.digest, digest.digest())) {
        throw IOException("Joined recording did not preserve every AAC frame")
      }
    } finally {
      extractor.release()
    }
  }
}
