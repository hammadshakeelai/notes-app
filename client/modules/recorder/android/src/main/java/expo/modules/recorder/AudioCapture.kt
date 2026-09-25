package expo.modules.recorder

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaRecorder
import android.os.Build
import android.os.Process
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.nio.ByteOrder
import java.util.Locale
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.abs

data class CaptureProgress(val samples: Long, val peak: Double, val silenced: Boolean)
data class CaptureResult(val samples: Long)

/** One continuous microphone/encoder session. Chunk rotation never restarts either. */
internal class AudioCapture(
  private val directory: File,
  private val firstChunkIndex: Int,
  private val onProgress: (CaptureProgress) -> Unit,
  private val onFailure: (Throwable) -> Unit,
) : CaptureEngine {
  companion object {
    const val SAMPLE_RATE = 32000
    const val BIT_RATE = 32000
    private const val CODEC_TIMEOUT_US = 10_000L
    private const val STALL_TIMEOUT_NS = 5_000_000_000L
  }

  private val stopRequested = AtomicBoolean(false)
  private val lifecycle = Any()
  @Volatile private var worker: Thread? = null
  @Volatile private var encodedSamples = 0L
  @Volatile private var failure: Throwable? = null
  private var started = false
  private var recorder: AudioRecord? = null
  private var encoder: MediaCodec? = null
  private var chunks: AudioChunkWriter? = null
  private var inputSamples = 0L
  private var lastProgressNs = 0L
  private var lastSilenced: Boolean? = null
  private var peak = 0.0
  private val partialFrame = ByteArrayOutputStream()
  private val outputInfo = MediaCodec.BufferInfo()
  override val isRunning: Boolean get() = worker?.isAlive == true

  /** Permission and foreground-service setup must complete before calling this. */
  fun start() = synchronized(lifecycle) {
    check(!started) { "An AudioCapture instance can only be started once" }
    started = true
    try {
      require(firstChunkIndex >= 0)
      chunks = AudioChunkWriter(directory, firstChunkIndex)
      val minBuffer = AudioRecord.getMinBufferSize(SAMPLE_RATE,
        AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
      if (minBuffer <= 0) throw IOException("This device does not support the recording format")
      recorder = AudioRecord.Builder()
        .setAudioSource(MediaRecorder.AudioSource.VOICE_RECOGNITION)
        .setAudioFormat(AudioFormat.Builder().setSampleRate(SAMPLE_RATE)
          .setChannelMask(AudioFormat.CHANNEL_IN_MONO)
          .setEncoding(AudioFormat.ENCODING_PCM_16BIT).build())
        .setBufferSizeInBytes(maxOf(minBuffer * 2, SAMPLE_RATE * 2))
        .build()
      if (recorder!!.state != AudioRecord.STATE_INITIALIZED) throw IOException("Cannot initialize microphone")
      encoder = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
      val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, SAMPLE_RATE, 1).apply {
        setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
        setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE)
        setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 4096)
      }
      encoder!!.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      encoder!!.start()
      recorder!!.startRecording()
      if (recorder!!.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
        throw IOException("The microphone is unavailable")
      }
      val thread = Thread({ capture() }, "lecture-audio-capture")
      worker = thread
      thread.start()
    } catch (error: Throwable) {
      failure = error
      cleanup()
      throw error
    }
  }

  /** Stops capture, drains AAC to EOS, syncs chunks and waits for resource release. */
  override fun stop(): CaptureResult {
    val thread = synchronized(lifecycle) {
      stopRequested.set(true)
      worker
    }
    // Failure callbacks run after cleanup on the worker and may synchronously call stop.
    if (thread != null && thread !== Thread.currentThread()) {
      thread.join(15_000)
      if (thread.isAlive) throw IOException("Audio encoder did not stop; recorded chunks are preserved")
    }
    failure?.let { throw IOException("Audio capture failed; recorded chunks are preserved", it) }
    return CaptureResult(encodedSamples)
  }

  private fun capture() {
    try {
      Process.setThreadPriority(Process.THREAD_PRIORITY_AUDIO)
      val microphone = checkNotNull(recorder)
      val pcm = ShortArray(Adts.SAMPLES_PER_FRAME)
      while (!stopRequested.get()) {
        val silencedBefore = isSilenced(microphone)
        val count = microphone.read(pcm, 0, pcm.size, AudioRecord.READ_NON_BLOCKING)
        if (count < 0) {
          val message = if (count == AudioRecord.ERROR_DEAD_OBJECT) "Microphone connection was lost" else "Microphone read failed ($count)"
          throw IOException(message)
        }
        val silenced = isSilenced(microphone)
        // Read/discard while silenced so queued zeroes never enter the next live segment.
        if (count > 0 && !silencedBefore && !silenced) {
          var currentPeak = 0
          for (index in 0 until count) currentPeak = maxOf(currentPeak, abs(pcm[index].toInt()))
          peak = maxOf(peak, currentPeak / 32768.0)
          queuePcm(pcm, count)
        }
        drainOutput(waitForEos = false)
        progress(silenced)
        if (count == 0) Thread.sleep(5)
      }
      microphone.stop()
      queueEndOfStream()
      drainOutput(waitForEos = true)
      if (partialFrame.size() != 0) throw IOException("AAC encoder ended inside an audio frame")
      chunks!!.sync()
    } catch (error: Throwable) {
      failure = error
    } finally {
      cleanup()
      progress(lastSilenced ?: false, force = true)
      failure?.let { error -> runCatching { onFailure(error) } }
    }
  }

  private fun isSilenced(microphone: AudioRecord): Boolean =
    Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
      microphone.activeRecordingConfiguration?.isClientSilenced == true

  private fun queuePcm(pcm: ShortArray, count: Int) {
    val codec = checkNotNull(encoder)
    var offset = 0
    var deadline = System.nanoTime() + STALL_TIMEOUT_NS
    while (offset < count) {
      val index = codec.dequeueInputBuffer(CODEC_TIMEOUT_US)
      if (index >= 0) {
        val buffer = codec.getInputBuffer(index) ?: throw IOException("AAC encoder has no input buffer")
        buffer.clear()
        val size = minOf(count - offset, buffer.remaining() / 2)
        if (size <= 0) throw IOException("AAC encoder input buffer is too small")
        buffer.order(ByteOrder.nativeOrder()).asShortBuffer().put(pcm, offset, size)
        codec.queueInputBuffer(index, 0, size * 2, inputSamples * 1_000_000L / SAMPLE_RATE, 0)
        inputSamples += size
        offset += size
        deadline = System.nanoTime() + STALL_TIMEOUT_NS
      } else if (System.nanoTime() > deadline) {
        throw IOException("AAC encoder input stalled")
      }
      drainOutput(waitForEos = false)
    }
  }

  private fun queueEndOfStream() {
    val codec = checkNotNull(encoder)
    val deadline = System.nanoTime() + STALL_TIMEOUT_NS
    while (true) {
      val index = codec.dequeueInputBuffer(CODEC_TIMEOUT_US)
      if (index >= 0) {
        codec.queueInputBuffer(index, 0, 0, inputSamples * 1_000_000L / SAMPLE_RATE,
          MediaCodec.BUFFER_FLAG_END_OF_STREAM)
        return
      }
      drainOutput(waitForEos = false)
      if (System.nanoTime() > deadline) throw IOException("AAC encoder could not accept end of stream")
    }
  }

  private fun drainOutput(waitForEos: Boolean) {
    val codec = checkNotNull(encoder)
    var deadline = System.nanoTime() + STALL_TIMEOUT_NS
    while (true) {
      when (val index = codec.dequeueOutputBuffer(outputInfo, if (waitForEos) CODEC_TIMEOUT_US else 0L)) {
        MediaCodec.INFO_TRY_AGAIN_LATER -> {
          if (!waitForEos) return
          if (System.nanoTime() > deadline) throw IOException("AAC encoder failed to finish")
        }
        MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
          val format = codec.outputFormat
          if (format.getInteger(MediaFormat.KEY_SAMPLE_RATE) != SAMPLE_RATE ||
            format.getInteger(MediaFormat.KEY_CHANNEL_COUNT) != 1) throw IOException("AAC encoder changed format")
        }
        MediaCodec.INFO_OUTPUT_BUFFERS_CHANGED -> Unit
        else -> {
          if (index < 0) throw IOException("Unexpected AAC encoder output status")
          val eos = outputInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0
          try {
            if (outputInfo.size > 0 && outputInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0) {
              val buffer = codec.getOutputBuffer(index) ?: throw IOException("AAC encoder has no output buffer")
              buffer.position(outputInfo.offset)
              buffer.limit(outputInfo.offset + outputInfo.size)
              if (partialFrame.size() + outputInfo.size > Adts.MAX_FRAME_LENGTH - 7) {
                throw IOException("AAC encoder produced an oversized frame")
              }
              val data = ByteArray(outputInfo.size)
              buffer.get(data)
              partialFrame.write(data)
              if (outputInfo.flags and MediaCodec.BUFFER_FLAG_PARTIAL_FRAME == 0) {
                chunks!!.write(partialFrame.toByteArray())
                partialFrame.reset()
                encodedSamples += Adts.SAMPLES_PER_FRAME
              }
            }
          } finally {
            codec.releaseOutputBuffer(index, false)
          }
          if (eos) return
          deadline = System.nanoTime() + STALL_TIMEOUT_NS
        }
      }
    }
  }

  private fun progress(silenced: Boolean, force: Boolean = false) {
    val now = System.nanoTime()
    if (force || lastSilenced != silenced || now - lastProgressNs >= 250_000_000L) {
      val update = CaptureProgress(encodedSamples, if (silenced) 0.0 else peak, silenced)
      lastProgressNs = now
      lastSilenced = silenced
      peak = 0.0
      runCatching { onProgress(update) }
    }
  }

  private fun cleanup() {
    runCatching { recorder?.stop() }
    runCatching { recorder?.release() }
    recorder = null
    runCatching { encoder?.stop() }
    runCatching { encoder?.release() }
    encoder = null
    try {
      chunks?.close()
    } catch (error: Throwable) {
      if (failure == null) failure = error else failure!!.addSuppressed(error)
    }
    chunks = null
  }
}

/** Direct writes plus frequent fsync bound crash loss independently of chunk rotation. */
internal class AudioChunkWriter(private val directory: File, firstChunkIndex: Int) : AutoCloseable {
  private var chunkIndex = firstChunkIndex
  private var chunkSamples = 0L
  private var samplesSinceSync = 0L
  private var output: FileOutputStream? = null

  init {
    if (!directory.isDirectory && !directory.mkdirs()) throw IOException("Cannot create recording directory")
    openChunk()
  }

  fun write(payload: ByteArray) {
    val header = Adts.header(payload.size)
    if (chunkSamples >= 30L * AudioCapture.SAMPLE_RATE) {
      close()
      chunkIndex++
      openChunk()
    }
    // A torn write is recognizable as an incomplete final ADTS frame on recovery.
    output!!.write(header + payload)
    chunkSamples += Adts.SAMPLES_PER_FRAME
    samplesSinceSync += Adts.SAMPLES_PER_FRAME
    if (samplesSinceSync >= AudioCapture.SAMPLE_RATE) sync()
  }

  fun sync() {
    output?.fd?.sync()
    samplesSinceSync = 0
  }

  private fun openChunk() {
    if (chunkIndex !in 0..999999) throw IOException("Recording has too many audio chunks")
    val file = File(directory, String.format(Locale.ROOT, "chunk%06d.aac", chunkIndex))
    if (!file.createNewFile()) throw IOException("Refusing to overwrite audio chunk ${file.name}")
    output = FileOutputStream(file, true)
    chunkSamples = 0L
    samplesSinceSync = 0L
  }

  override fun close() {
    val stream = output ?: return
    output = null
    try {
      stream.fd.sync()
    } finally {
      stream.close()
    }
  }
}
