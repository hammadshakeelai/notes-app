package expo.modules.recorder

import java.io.IOException
import org.junit.Assert.*
import org.junit.Test

class CaptureSlotTest {
  private class Engine(var running: Boolean, var stopFailure: Boolean = false) : CaptureEngine {
    override val isRunning: Boolean get() = running
    override fun stop(): CaptureResult {
      if (stopFailure) throw IOException("Simulated encoder shutdown failure")
      running = false
      return CaptureResult(32000)
    }
  }

  @Test fun `timed out worker keeps ownership until it actually terminates`() {
    val slot = CaptureSlot()
    val hung = Engine(true, stopFailure = true)
    slot.attach(hung)
    assertThrows(IOException::class.java) { slot.stop() }
    assertTrue(slot.occupied)
    assertFalse(slot.releaseTerminated())
    assertThrows(IllegalStateException::class.java) { slot.attach(Engine(true)) }
    hung.running = false
    assertTrue(slot.releaseTerminated())
    assertFalse(slot.occupied)
    slot.attach(Engine(true))
    assertTrue(slot.occupied)
  }

  @Test fun `failed but terminated worker releases files for recovery`() {
    val slot = CaptureSlot()
    slot.attach(Engine(false, stopFailure = true))
    assertThrows(IOException::class.java) { slot.stop() }
    assertFalse(slot.occupied)
  }

  @Test fun `successful stop returns captured duration and releases ownership`() {
    val slot = CaptureSlot()
    slot.attach(Engine(true))
    assertEquals(32000L, slot.stop()!!.samples)
    assertFalse(slot.occupied)
    assertNull(slot.stop())
  }
}
