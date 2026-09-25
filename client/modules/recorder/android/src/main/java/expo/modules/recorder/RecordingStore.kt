package expo.modules.recorder

import android.util.AtomicFile
import android.system.Os
import android.system.OsConstants
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.UUID

internal data class RecordingBookmark(val id: String, val offsetMs: Long, val label: String) {
  fun json() = JSONObject().put("id", id).put("offsetMs", offsetMs).put("label", label)
}

internal data class RecordingGap(val offsetMs: Long, var durationMs: Long, val reason: String) {
  fun json() = JSONObject().put("offsetMs", offsetMs).put("durationMs", durationMs).put("reason", reason)
}

internal data class RecordingSession(
  val id: String,
  val title: String,
  val startedAt: Long,
  var durationMs: Long = 0,
  var state: String = "recording",
  var uri: String? = null,
  var recovered: Boolean = false,
  val bookmarks: MutableList<RecordingBookmark> = mutableListOf(),
  val gaps: MutableList<RecordingGap> = mutableListOf(),
  var error: String? = null,
) {
  fun json(): JSONObject = JSONObject()
    .put("id", id).put("title", title).put("startedAt", startedAt)
    .put("durationMs", durationMs).put("state", state)
    .put("uri", uri ?: JSONObject.NULL).put("recovered", recovered)
    .put("bookmarks", JSONArray(bookmarks.map { it.json() }))
    .put("gaps", JSONArray(gaps.map { it.json() }))
    .put("error", error ?: JSONObject.NULL)
}

/** Only the recorder process's serial executor may access this store. */
internal class RecordingStore(
  private val root: File,
  private val journal: RecordingJournal = AtomicRecordingJournal(),
  private val join: (File) -> JoinResult = { AudioJoiner.join(it) },
) {
  init {
    if (!root.isDirectory && !root.mkdirs()) throw IOException("Cannot create recording storage")
  }

  fun directory(id: String): File {
    require(UUID.fromString(id).toString() == id) { "Invalid recording ID" }
    val directory = File(root, id)
    require(directory.canonicalFile.parentFile == root.canonicalFile) { "Invalid recording directory" }
    return directory
  }

  fun create(id: String, title: String, now: Long): RecordingSession {
    require(title.isNotBlank() && title.length <= 200) { "Recording title must contain 1–200 characters" }
    val directory = directory(id)
    check(!directory.exists()) { "This recording already exists" }
    if (!directory.mkdir()) throw IOException("Cannot create recording directory")
    val session = RecordingSession(id = id, title = title.trim(), startedAt = now)
    try { save(session) } catch (error: Exception) {
      runCatching { discardEmptyAttempt(session) }
      throw error
    }
    return session
  }

  /** Only call after a failed start and after the capture worker has terminated. */
  fun discardEmptyAttempt(session: RecordingSession): Boolean {
    if (session.durationMs != 0L || session.bookmarks.isNotEmpty() || session.gaps.isNotEmpty()) return false
    val directory = directory(session.id)
    val entries = directory.listFiles() ?: return false
    val metadata = setOf(MANIFEST, "$MANIFEST.bak", "$MANIFEST.new")
    // Unknown files or even a partial audio frame may contain recoverable data.
    if (entries.any { !it.isFile || it.canonicalFile.parentFile != directory.canonicalFile ||
        (it.name !in metadata && (!CHUNK.matches(it.name) || it.length() != 0L)) }) return false
    for (entry in entries) if (!entry.delete()) return false
    return directory.delete()
  }

  fun save(session: RecordingSession) {
    val data = session.json().put("version", 1)
    val file = File(directory(session.id), MANIFEST)
    val bytes = data.toString().toByteArray(Charsets.UTF_8)
    journal.write(file, bytes)
    // AtomicFile can log a failed rename instead of throwing. Verify the commit itself.
    if (!journal.read(file).contentEquals(bytes)) throw IOException("Recording metadata was not saved; audio chunks are retained")
  }

  fun list(): List<RecordingSession> = root.listFiles().orEmpty()
    .filter { it.isDirectory && runCatching { directory(it.name) }.isSuccess }
    .map { read(it.name) }
    .sortedByDescending { it.startedAt }

  fun read(id: String): RecordingSession {
    val directory = directory(id)
    return try {
      val data = JSONObject(journal.read(File(directory, MANIFEST)).toString(Charsets.UTF_8))
      require(data.getInt("version") == 1 && data.getString("id") == id) { "Invalid recording manifest" }
      val state = data.getString("state")
      require(state in setOf("recording", "paused", "finalizing", "ready", "error"))
      val session = RecordingSession(
        id, data.getString("title"), data.getLong("startedAt"),
        data.getLong("durationMs").coerceAtLeast(0), state,
        recovered = data.optBoolean("recovered", false),
        error = if (data.isNull("error")) null else data.optString("error"),
      )
      val bookmarks = data.getJSONArray("bookmarks")
      for (index in 0 until bookmarks.length()) {
        val item = bookmarks.getJSONObject(index)
        session.bookmarks.add(RecordingBookmark(item.getString("id"), item.getLong("offsetMs").coerceAtLeast(0), item.getString("label")))
      }
      val gaps = data.getJSONArray("gaps")
      for (index in 0 until gaps.length()) {
        val item = gaps.getJSONObject(index)
        session.gaps.add(RecordingGap(item.getLong("offsetMs").coerceAtLeast(0), item.getLong("durationMs").coerceAtLeast(0), item.getString("reason")))
      }
      // Never trust a stored URI as a path: only publish the expected private output.
      if (state == "ready") {
        val audio = File(directory, FINAL_AUDIO)
        if (audio.isFile && audio.length() > 0 && audio.canonicalFile.parentFile == directory.canonicalFile) {
          session.uri = fileUri(audio)
        } else {
          session.state = "error"
          session.error = "The saved audio is missing. Original chunks, if present, can be recovered."
        }
      }
      session
    } catch (_: Exception) {
      // An unreadable journal must not hide retained audio or cause it to be deleted.
      RecordingSession(id, "Recovered recording", directory.lastModified(), state = "error",
        error = "Recording metadata could not be read. Recover the retained audio.")
    }
  }

  fun nextChunkIndex(id: String): Int = chunkFiles(directory(id))
    .maxOfOrNull { it.name.substring(5, 11).toInt() + 1 } ?: 0

  fun finalize(session: RecordingSession, recovered: Boolean): RecordingSession {
    session.state = "finalizing"
    session.uri = null
    session.error = null
    save(session)
    val directory = directory(session.id)
    val result = join(directory)
    require(result.file.canonicalFile == File(directory, FINAL_AUDIO).canonicalFile) { "Unexpected recording output" }
    require(result.file.isFile && result.file.length() > 0 && result.frameCount > 0) { "The joined recording is empty" }
    session.durationMs = result.durationMs
    session.state = "ready"
    session.uri = fileUri(result.file)
    session.recovered = session.recovered || recovered
    // Durable ready metadata is the commit point. Keep every chunk if this write fails.
    save(session)
    // Cleanup is best-effort after commit. A failed delete cannot invalidate saved audio.
    runCatching { chunkFiles(directory).forEach { it.delete() } }
    return session
  }

  fun recover(activeId: String?): List<RecordingSession> {
    val recovered = mutableListOf<RecordingSession>()
    for (session in list()) {
      if (session.id == activeId || session.state == "ready") continue
      try {
        recovered.add(finalize(session, recovered = true))
      } catch (error: Exception) {
        session.state = "error"
        session.uri = null
        session.error = "Audio recovery failed; original files are retained. ${error.message ?: "Try recovery again."}"
        runCatching { save(session) }
        recovered.add(session)
      }
    }
    return recovered
  }

  private fun chunkFiles(directory: File): List<File> = directory.listFiles().orEmpty().filter {
    it.isFile && CHUNK.matches(it.name) && it.canonicalFile.parentFile == directory.canonicalFile
  }

  private fun fileUri(file: File): String = "file://${file.absolutePath}"

  companion object {
    const val MANIFEST = "manifest.json"
    const val FINAL_AUDIO = "recording.m4a"
    private val CHUNK = Regex("^chunk[0-9]{6}\\.aac$")
  }
}

internal interface RecordingJournal {
  fun read(file: File): ByteArray
  fun write(file: File, bytes: ByteArray)
}

private class AtomicRecordingJournal : RecordingJournal {
  override fun read(file: File): ByteArray = AtomicFile(file).openRead().use { it.readBytes() }

  override fun write(file: File, bytes: ByteArray) {
    val atomic = AtomicFile(file)
    val output = atomic.startWrite()
    var finished = false
    try {
      output.write(bytes)
      // AtomicFile.finishWrite logs sync errors; this explicit sync must propagate them.
      output.fd.sync()
      atomic.finishWrite(output)
      finished = true
      // Persist the journal/output entries and the recording directory's own entry.
      syncDirectory(requireNotNull(file.parentFile))
      file.parentFile?.parentFile?.let(::syncDirectory)
    } catch (error: Exception) {
      if (!finished) atomic.failWrite(output)
      throw error
    }
  }

  private fun syncDirectory(directory: File) {
        val descriptor = Os.open(directory.absolutePath, OsConstants.O_RDONLY, 0)
    try { Os.fsync(descriptor) } finally { Os.close(descriptor) }
  }
}
