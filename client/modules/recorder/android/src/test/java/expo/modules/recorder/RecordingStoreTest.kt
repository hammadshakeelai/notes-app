package expo.modules.recorder

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.io.IOException

class RecordingStoreTest {
  @get:Rule val temporary = TemporaryFolder()
  private val firstId = "38aa2644-1ced-41dc-8b93-0c781096db01"
  private val secondId = "38aa2644-1ced-41dc-8b93-0c781096db02"

  private class DiskJournal : RecordingJournal {
    var rejectReady = false
    var silentlyDropReady = false
    override fun read(file: File): ByteArray = file.readBytes()
    override fun write(file: File, bytes: ByteArray) {
      if (silentlyDropReady && JSONObject(bytes.toString(Charsets.UTF_8)).getString("state") == "ready") return
      if (rejectReady && JSONObject(bytes.toString(Charsets.UTF_8)).getString("state") == "ready") {
        throw IOException("Simulated disk-full journal write")
      }
      file.writeBytes(bytes)
    }
  }

  private fun verifiedJoin(directory: File): JoinResult {
    val final = File(directory, RecordingStore.FINAL_AUDIO).apply { writeText("synthetic verified AAC container") }
    return JoinResult(final, 32, 1)
  }

  @Test fun `a silently failed ready commit never permits source chunk deletion`() {
    val journal = DiskJournal()
    val store = RecordingStore(temporary.newFolder(), journal, ::verifiedJoin)
    val session = store.create(firstId, "Journal rename failure", 1000)
    val source = File(store.directory(firstId), "chunk000000.aac").apply { writeText("retained audio") }
    journal.silentlyDropReady = true
    org.junit.Assert.assertThrows(IOException::class.java) { store.finalize(session, recovered = false) }
    assertTrue(source.exists())
    assertEquals("finalizing", store.read(firstId).state)
    journal.silentlyDropReady = false
    assertEquals("ready", store.recover(null).single().state)
    assertFalse(source.exists())
  }

  @Test fun `failed start with no audio leaves no empty recording entry`() {
    val store = RecordingStore(temporary.newFolder(), DiskJournal(), ::verifiedJoin)
    val session = store.create(firstId, "Microphone unavailable", 1000)
    File(store.directory(firstId), "chunk000000.aac").createNewFile()
    assertTrue(store.discardEmptyAttempt(session))
    assertTrue(store.list().isEmpty())
  }

  @Test fun `failed start cleanup preserves even a partial audio frame`() {
    val store = RecordingStore(temporary.newFolder(), DiskJournal(), ::verifiedJoin)
    val session = store.create(firstId, "Interrupted startup", 1000)
    val audio = File(store.directory(firstId), "chunk000000.aac").apply { writeBytes(byteArrayOf(0xff.toByte())) }
    assertFalse(store.discardEmptyAttempt(session))
    assertEquals(1L, audio.length())
    assertEquals(1, store.list().size)
  }

  @Test fun `failed start cleanup preserves unknown files`() {
    val store = RecordingStore(temporary.newFolder(), DiskJournal(), ::verifiedJoin)
    val session = store.create(firstId, "Unknown retained data", 1000)
    val unknown = File(store.directory(firstId), "recording.pending.m4a").apply { writeText("partial container") }
    assertFalse(store.discardEmptyAttempt(session))
    assertTrue(unknown.exists())
  }

  @Test fun `bookmarks gaps and recording identity survive restart`() {
    val root = temporary.newFolder()
    val store = RecordingStore(root, DiskJournal(), ::verifiedJoin)
    val session = store.create(firstId, "Synthetic lecture", 1000)
    session.durationMs = 3210
    session.bookmarks.add(RecordingBookmark(secondId, 1000, "Review this"))
    session.gaps.add(RecordingGap(2000, 4500, "microphone-interruption"))
    session.state = "paused"
    store.save(session)

    val restored = RecordingStore(root, DiskJournal(), ::verifiedJoin).list().single()
    assertEquals(firstId, restored.id)
    assertEquals("Synthetic lecture", restored.title)
    assertEquals(3210L, restored.durationMs)
    assertEquals("paused", restored.state)
    assertEquals(1000L, restored.bookmarks.single().offsetMs)
    assertEquals(4500L, restored.gaps.single().durationMs)
  }

  @Test fun `recovery skips the live recorder and joins abandoned chunks`() {
    val root = temporary.newFolder()
    val joined = mutableListOf<String>()
    val store = RecordingStore(root, DiskJournal()) { joined.add(it.name); verifiedJoin(it) }
    store.create(firstId, "Still recording", 1000)
    store.create(secondId, "Interrupted lecture", 2000)
    val liveChunk = File(store.directory(firstId), "chunk000000.aac").apply { writeText("live audio") }
    val deadChunk = File(store.directory(secondId), "chunk000000.aac").apply { writeText("retained audio") }

    val recovered = store.recover(firstId).single()

    assertEquals(listOf(secondId), joined)
    assertEquals("ready", recovered.state)
    assertTrue(recovered.recovered)
    assertNotNull(recovered.uri)
    assertTrue(liveChunk.exists())
    assertFalse(deadChunk.exists())
    assertEquals("recording", store.read(firstId).state)
  }

  @Test fun `join failure retains chunks and exposes retryable error`() {
    val store = RecordingStore(temporary.newFolder(), DiskJournal()) { throw IOException("incomplete audio") }
    store.create(firstId, "Interrupted lecture", 1000)
    val chunk = File(store.directory(firstId), "chunk000000.aac").apply { writeText("audio to retain") }

    val result = store.recover(null).single()

    assertEquals("error", result.state)
    assertNull(result.uri)
    assertTrue(result.error!!.contains("retained"))
    assertEquals("audio to retain", chunk.readText())
  }

  @Test fun `ready metadata failure retains original chunks even when join succeeded`() {
    val journal = DiskJournal()
    val store = RecordingStore(temporary.newFolder(), journal, ::verifiedJoin)
    store.create(firstId, "Interrupted lecture", 1000)
    val chunk = File(store.directory(firstId), "chunk000000.aac").apply { writeText("audio to retain") }
    journal.rejectReady = true

    val failed = store.recover(null).single()

    assertEquals("error", failed.state)
    assertTrue(chunk.exists())
    assertTrue(File(store.directory(firstId), RecordingStore.FINAL_AUDIO).exists())

    journal.rejectReady = false
    val retry = store.recover(null).single()
    assertEquals("ready", retry.state)
    assertFalse(chunk.exists())
  }

  @Test fun `ready sessions are idempotent and never rejoined`() {
    var joins = 0
    val store = RecordingStore(temporary.newFolder(), DiskJournal()) { joins++; verifiedJoin(it) }
    val session = store.create(firstId, "Saved lecture", 1000)
    File(store.directory(firstId), "chunk000000.aac").writeText("source audio")
    store.finalize(session, false)

    assertTrue(store.recover(null).isEmpty())
    assertEquals(1, joins)
    assertEquals("ready", store.read(firstId).state)
  }

  @Test fun `corrupt manifest does not hide retained chunks from recovery`() {
    val store = RecordingStore(temporary.newFolder(), DiskJournal(), ::verifiedJoin)
    store.create(firstId, "Lecture", 1000)
    val directory = store.directory(firstId)
    File(directory, RecordingStore.MANIFEST).writeText("partial manifest")
    File(directory, "chunk000000.aac").writeText("source audio")

    assertEquals("error", store.list().single().state)
    val recovered = store.recover(null).single()
    assertEquals("ready", recovered.state)
    assertEquals("Recovered recording", recovered.title)
    assertTrue(recovered.recovered)
  }

  @Test fun `stored URI cannot expose an arbitrary file`() {
    val store = RecordingStore(temporary.newFolder(), DiskJournal(), ::verifiedJoin)
    val session = store.create(firstId, "Lecture", 1000)
    store.finalize(session, false)
    val manifest = File(store.directory(firstId), RecordingStore.MANIFEST)
    val data = JSONObject(manifest.readText()).put("uri", "file:///private/secret")
    manifest.writeText(data.toString())

    assertEquals("file://${File(store.directory(firstId), RecordingStore.FINAL_AUDIO).absolutePath}", store.read(firstId).uri)
  }

  @Test fun `missing final file is an error and is not advertised as playable`() {
    val store = RecordingStore(temporary.newFolder(), DiskJournal(), ::verifiedJoin)
    val session = store.create(firstId, "Lecture", 1000)
    store.finalize(session, false)
    File(store.directory(firstId), RecordingStore.FINAL_AUDIO).delete()

    val result = store.read(firstId)
    assertEquals("error", result.state)
    assertNull(result.uri)
  }

  @Test fun `untrusted recording IDs cannot escape private storage`() {
    val store = RecordingStore(temporary.newFolder(), DiskJournal(), ::verifiedJoin)
    for (id in listOf("../secret", "../../$firstId", "/tmp/$firstId", "1-1-1-1-1")) {
      var rejected = false
      try { store.directory(id) } catch (_: IllegalArgumentException) { rejected = true }
      assertTrue("Expected invalid ID to be rejected", rejected)
    }
  }

  @Test fun `joining cannot publish a file outside the recording directory`() {
    val escaped = temporary.newFile("outside.m4a").apply { writeText("outside file") }
    val store = RecordingStore(temporary.newFolder(), DiskJournal()) { JoinResult(escaped, 32, 1) }
    store.create(firstId, "Lecture", 1000)
    val chunk = File(store.directory(firstId), "chunk000000.aac").apply { writeText("source") }

    assertEquals("error", store.recover(null).single().state)
    assertTrue(chunk.exists())
    assertEquals("outside file", escaped.readText())
  }

  @Test fun `new chunks continue sequence after manual pause`() {
    val store = RecordingStore(temporary.newFolder(), DiskJournal(), ::verifiedJoin)
    store.create(firstId, "Lecture", 1000)
    val directory = store.directory(firstId)
    assertEquals(0, store.nextChunkIndex(firstId))
    File(directory, "chunk000000.aac").writeText("first")
    File(directory, "chunk000001.aac").writeText("second")
    File(directory, "other.aac").writeText("unrelated")
    assertEquals(2, store.nextChunkIndex(firstId))
  }
}
