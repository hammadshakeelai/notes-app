package expo.modules.recorder

internal interface CaptureEngine {
  val isRunning: Boolean
  fun stop(): CaptureResult
}

/** A timed-out stop does not release ownership of files that a worker can still write. */
internal class CaptureSlot {
  private var engine: CaptureEngine? = null
  val occupied: Boolean get() = engine != null

  fun attach(value: CaptureEngine) {
    check(!occupied) { "The previous audio encoder is still stopping. Try again shortly." }
    engine = value
  }

  fun stop(): CaptureResult? {
    val current = engine ?: return null
    return try { current.stop() } finally { releaseTerminated() }
  }

  fun releaseTerminated(): Boolean {
    val current = engine ?: return false
    if (current.isRunning) return false
    engine = null
    return true
  }
}
