package expo.modules.recorder

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import android.os.PowerManager
import android.os.RemoteException
import android.os.StatFs
import android.os.SystemClock
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.RejectedExecutionException
import java.util.concurrent.TimeUnit

/** A started service owns capture; UI connections only send commands and may disappear. */
class RecorderService : Service() {
  private val main = Handler(Looper.getMainLooper())
  private val worker = Executors.newSingleThreadScheduledExecutor { task -> Thread(task, "RecorderCommands") }
  private lateinit var store: RecordingStore
  private lateinit var notifications: NotificationManager
  private var session: RecordingSession? = null
  private val capture = CaptureSlot()
  private var captureStopPending = false
  private var captureEpoch = 0L
  private var captureBaseMs = 0L
  private var manualPause = false
  private var openGap: RecordingGap? = null
  private var gapStartedElapsed = 0L
  private var lastSavedElapsed = 0L
  private var lastStorageElapsed = 0L
  private var lastChunkOrdinal = 0L
  private var level = 0.0
  private var wakeLock: PowerManager.WakeLock? = null
  @Volatile private var foreground = false
  @Volatile private var preparationError: String? = null
  @Volatile private var notificationView = NotificationView()
  private var prepareGeneration = 0

  // Messenger must have a main-looper Handler; all disk/audio/state work is serialized below.
  private val messenger = Messenger(object : Handler(Looper.getMainLooper()) {
    override fun handleMessage(message: Message) {
      if (message.what != REQUEST) return
      val requestId = message.data.getString("requestId").orEmpty()
      val command = message.data.getString("command").orEmpty()
      val rawArgs = message.data.getString("args") ?: "{}"
      val reply = message.replyTo ?: return
      enqueue {
        try {
          dispatch(command, JSONObject(rawArgs))
          respond(reply, requestId, result = snapshot().toString())
        } catch (error: Exception) {
          if (command == "start" && !isLive()) leaveForeground()
          respond(reply, requestId, error = error.message ?: "Recorder command failed")
        }
      }
    }
  })

  override fun onCreate() {
    super.onCreate()
    notifications = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      notifications.createNotificationChannel(NotificationChannel(CHANNEL, "Lecture recording", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Recording status, audio level, pause, stop and bookmarks"
        setSound(null, null)
        enableVibration(false)
      })
    }
    enqueue { store = RecordingStore(File(filesDir, "recordings")) }
    worker.scheduleAtFixedRate({
      try {
        if (session?.state == "error" && capture.releaseTerminated()) {
          captureStopPending = false
          releaseWakeLock()
          leaveForeground()
        }
        if (isLive()) {
          updateGap()
          if (!capture.occupied && SystemClock.elapsedRealtime() - lastSavedElapsed >= SAVE_INTERVAL) persist()
          publishNotification()
        }
      } catch (error: Exception) { failCurrent(error) }
    }, 1, 1, TimeUnit.SECONDS)
  }

  override fun onBind(intent: Intent?): IBinder = messenger.binder

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_PREPARE) {
      preparationError = null
      try {
        val notification = buildNotification(notificationView)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE)
        } else {
          startForeground(NOTIFICATION_ID, notification)
        }
        foreground = true
      } catch (error: Exception) {
        preparationError = error.message ?: "Android did not allow microphone recording"
        stopSelf(startId)
      }
      enqueue {
        val generation = ++prepareGeneration
        worker.schedule({
          if (prepareGeneration == generation && !isLive()) leaveForeground()
        }, 10, TimeUnit.SECONDS)
      }
    } else {
      val command = when (intent?.action) {
        ACTION_BOOKMARK -> "bookmark"
        ACTION_PAUSE -> "pause"
        ACTION_RESUME -> "resume"
        ACTION_STOP -> "stop"
        else -> null
      }
      if (command != null) enqueue {
        try { dispatch(command, JSONObject()) } catch (error: Exception) {
          if (isLive()) failCurrent(error) else leaveForeground()
        }
      }
    }
    // OS death must never restart microphone access without another user action.
    return START_NOT_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Swiping the activity away does not own or stop this separate-process service.
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    enqueue {
      if (isLive()) {
        runCatching { stopCapture() }
        endGap()
        session?.let {
          it.state = "error"
          it.error = "Recording was interrupted. Recover the retained audio on next launch."
          runCatching { store.save(it) }
        }
      }
      releaseWakeLock()
    }
    worker.shutdown()
    super.onDestroy()
  }

  private fun dispatch(command: String, args: JSONObject) {
    check(::store.isInitialized) { "Recording storage is unavailable" }
    when (command) {
      "snapshot", "list" -> Unit
      "start" -> start(args)
      "pause" -> pause()
      "resume" -> resume()
      "stop" -> stop()
      "bookmark" -> bookmark(args.optString("label", ""))
      "recover" -> {
        val protectedSession = isLive() || capture.occupied
        val recovered = store.recover(if (protectedSession) session?.id else null)
        if (!protectedSession && recovered.isNotEmpty()) session = recovered.first()
      }
      else -> throw IllegalArgumentException("Unknown recorder command")
    }
  }

  private fun start(args: JSONObject) {
    check(!isLive()) { "A recording is already active" }
    check(!capture.occupied) { "The previous audio encoder is still stopping. Try again shortly." }
    check(preparationError == null) { preparationError ?: "Microphone service unavailable" }
    check(foreground) { "Start recording from the visible app first" }
    val device = deviceStatus()
    if (!args.optBoolean("warningsAcknowledged", false) &&
      ((device.batteryPercent != null && device.batteryPercent < 20) || device.availableBytes < ONE_GIB)) {
      throw IllegalStateException("Low battery or storage. Review the warning and confirm before recording.")
    }
    check(device.availableBytes >= MIN_FREE_BYTES) { "There is not enough free storage to record safely" }
    session = store.create(args.getString("id"), args.getString("title"), System.currentTimeMillis())
    manualPause = false
    openGap = null
    try {
      startCapture()
      ++prepareGeneration
    } catch (error: Exception) {
      failCurrent(error)
      if (!capture.occupied) session?.let {
        if (runCatching { store.discardEmptyAttempt(it) }.getOrDefault(false)) session = null
      }
      throw error
    }
  }

  private fun startCapture() {
    val current = requireNotNull(session)
    val epoch = ++captureEpoch
    captureBaseMs = current.durationMs
    lastChunkOrdinal = 0
    val engine = AudioCapture(store.directory(current.id), store.nextChunkIndex(current.id),
      onProgress = { progress -> enqueue { if (captureEpoch == epoch) onProgress(progress) } },
      onFailure = { error -> enqueue { if (captureEpoch == epoch) failCurrent(error) } },
    )
    capture.attach(engine)
    acquireWakeLock()
    engine.start()
    current.state = "recording"
    current.error = null
    persist()
    publishNotification()
  }

  private fun onProgress(progress: CaptureProgress) {
    val current = session ?: return
    try {
      current.durationMs = captureBaseMs + progress.samples * 1000 / SAMPLE_RATE
      level = if (progress.silenced) 0.0 else progress.peak.coerceIn(0.0, 1.0)
      if (progress.silenced && current.state == "recording") {
        current.state = "paused"
        beginGap("microphone-interruption")
        persist()
        publishNotification()
      } else if (!progress.silenced && current.state == "paused" && !manualPause) {
        endGap()
        current.state = "recording"
        persist()
        publishNotification()
      }
      updateGap()
      val now = SystemClock.elapsedRealtime()
      val chunkOrdinal = progress.samples / (SAMPLE_RATE * 30)
      if (now - lastSavedElapsed >= SAVE_INTERVAL || chunkOrdinal != lastChunkOrdinal) {
        persist()
        lastChunkOrdinal = chunkOrdinal
      }
      if (now - lastStorageElapsed >= SAVE_INTERVAL) {
        lastStorageElapsed = now
        val directory = store.directory(current.id)
        val recordedBytes = directory.listFiles().orEmpty().sumOf { if (it.isFile) it.length() else 0L }
        // Joining needs a second copy. Stop while enough space remains to finish it.
        if (availableBytes() < maxOf(MIN_FREE_BYTES, recordedBytes + JOIN_MARGIN)) {
          current.error = "Recording stopped because storage is running low."
          stop()
        }
      }
    } catch (error: Exception) { failCurrent(error) }
  }

  private fun pause() {
    val current = requireLive()
    if (manualPause) return
    try {
      stopCapture()
      endGap()
      manualPause = true
      current.state = "paused"
      beginGap("manual-pause")
      persist()
      publishNotification()
    } catch (error: Exception) {
      failCurrent(error)
      throw error
    }
  }

  private fun resume() {
    val current = requireLive()
    if (current.state == "recording") return
    check(manualPause) { "The microphone is in use. Recording resumes automatically when it is available." }
    check(availableBytes() >= MIN_FREE_BYTES) { "Free storage before resuming recording" }
    try {
      endGap()
      manualPause = false
      startCapture()
    } catch (error: Exception) {
      failCurrent(error)
      throw error
    }
  }

  private fun stop() {
    val current = requireLive()
    val stopReason = current.error
    try {
      stopCapture()
      endGap()
      current.state = "finalizing"
      persist()
      publishNotification()
      store.finalize(current, recovered = false)
      if (stopReason != null) {
        current.error = stopReason
        store.save(current)
      }
      level = 0.0
      leaveForeground()
    } catch (error: Exception) {
      failCurrent(error)
      throw error
    }
  }

  private fun stopCapture() {
    if (!capture.occupied) return
    check(!captureStopPending) { "The audio encoder is still stopping. Retained audio is protected." }
    captureStopPending = true
    ++captureEpoch // Queued progress/failure callbacks belong to the old capture.
    try {
      val result = capture.stop()
      if (result != null) session?.durationMs = captureBaseMs + result.samples * 1000 / SAMPLE_RATE
    } finally {
      level = 0.0
      if (!capture.occupied) {
        captureStopPending = false
        releaseWakeLock()
      }
    }
  }

  private fun bookmark(label: String) {
    require(label.length <= 200) { "Bookmark label must be at most 200 characters" }
    val current = requireLive()
    current.bookmarks.add(RecordingBookmark(UUID.randomUUID().toString(), current.durationMs, label.trim()))
    try { persist() } catch (error: Exception) {
      failCurrent(error)
      throw error
    }
  }

  private fun beginGap(reason: String) {
    val current = requireNotNull(session)
    gapStartedElapsed = SystemClock.elapsedRealtime()
    openGap = RecordingGap(current.durationMs, 0, reason).also { current.gaps.add(it) }
  }

  private fun updateGap() {
    openGap?.durationMs = (SystemClock.elapsedRealtime() - gapStartedElapsed).coerceAtLeast(0)
  }

  private fun endGap() {
    updateGap()
    openGap = null
  }

  private fun persist() {
    session?.let { store.save(it) }
    lastSavedElapsed = SystemClock.elapsedRealtime()
  }

  private fun failCurrent(error: Throwable) {
    if (!captureStopPending) runCatching { stopCapture() }
    endGap()
    session?.let {
      it.state = "error"
      it.uri = null
      it.error = "Recording stopped; retained audio can be recovered. ${error.message ?: "Recorder failure."}"
      runCatching { store.save(it) }
    }
    if (!capture.occupied) {
      releaseWakeLock()
      leaveForeground()
    } else {
      publishNotification()
    }
  }

  private fun requireLive(): RecordingSession {
    check(isLive()) { "There is no active recording" }
    return requireNotNull(session)
  }

  private fun isLive() = session?.state in setOf("recording", "paused", "finalizing")

  private fun snapshot(): JSONObject {
    val device = deviceStatus()
    return JSONObject().put("state", session?.state ?: "idle")
      .put("session", session?.json() ?: JSONObject.NULL)
      .put("recordings", JSONArray(store.list().map { if (it.id == session?.id) session!!.json() else it.json() }))
      .put("level", level)
      .put("device", JSONObject().put("batteryPercent", device.batteryPercent ?: JSONObject.NULL)
        .put("availableBytes", device.availableBytes).put("estimatedMinutes", device.estimatedMinutes))
  }

  private data class DeviceStatus(val batteryPercent: Int?, val availableBytes: Long, val estimatedMinutes: Long)

  private fun availableBytes() = StatFs(filesDir.absolutePath).availableBytes

  private fun deviceStatus(): DeviceStatus {
    val battery = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val charge = battery?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
    val scale = battery?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
    val percent = if (charge >= 0 && scale > 0) (charge * 100 / scale).coerceIn(0, 100) else null
    val bytes = availableBytes()
    // AAC at 32 kbps plus temporary final output and a margin for the Android filesystem.
    return DeviceStatus(percent, bytes, ((bytes - MIN_FREE_BYTES).coerceAtLeast(0) / 8_500 / 60))
  }

  private fun acquireWakeLock() {
    val lock = getSystemService(PowerManager::class.java).newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "$packageName:lecture-capture")
    lock.setReferenceCounted(false)
    lock.acquire()
    wakeLock = lock
  }

  private fun releaseWakeLock() {
    wakeLock?.let { if (it.isHeld) it.release() }
    wakeLock = null
  }

  private data class NotificationView(
    val title: String = "Preparing recording",
    val text: String = "Opening the microphone…",
    val paused: Boolean = false,
    val live: Boolean = false,
    val finalizing: Boolean = false,
  )

  private fun publishNotification() {
    val current = session ?: return
    val seconds = current.durationMs / 1000
    val elapsed = if (seconds >= 3600) "%d:%02d:%02d".format(seconds / 3600, seconds / 60 % 60, seconds % 60)
      else "%d:%02d".format(seconds / 60, seconds % 60)
    val status = when {
      captureStopPending -> "Stopping the audio encoder · saved chunks are protected"
      current.state == "finalizing" -> "Saving your recording…"
      manualPause -> "Paused"
      current.state == "paused" -> "Microphone interrupted · resumes automatically"
      level < 0.015 && current.durationMs >= 5_000 -> "Very quiet · move closer or face the phone towards the teacher"
      else -> "Sound level ${(level * 100).toInt()}%"
    }
    val view = NotificationView(current.title, "$elapsed · $status", manualPause, isLive(), current.state == "finalizing")
    notificationView = view
    main.post { if (foreground) notifications.notify(NOTIFICATION_ID, buildNotification(view)) }
  }

  private fun buildNotification(view: NotificationView): Notification {
    val builder = (if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL)
      else Notification.Builder(this))
      .setSmallIcon(android.R.drawable.ic_btn_speak_now)
      .setContentTitle(view.title).setContentText(view.text)
      .setStyle(Notification.BigTextStyle().bigText(view.text))
      .setOngoing(true).setOnlyAlertOnce(true).setShowWhen(false)
      .setCategory(Notification.CATEGORY_SERVICE)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
    packageManager.getLaunchIntentForPackage(packageName)?.let { launch ->
      builder.setContentIntent(PendingIntent.getActivity(this, 0, launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
    }
    if (view.live && !view.finalizing) {
      builder.addAction(Notification.Action.Builder(null, "Bookmark", action(ACTION_BOOKMARK, 1)).build())
      builder.addAction(Notification.Action.Builder(null, if (view.paused) "Resume" else "Pause",
        action(if (view.paused) ACTION_RESUME else ACTION_PAUSE, 2)).build())
      builder.addAction(Notification.Action.Builder(null, "Stop", action(ACTION_STOP, 3)).build())
    }
    return builder.build()
  }

  private fun action(action: String, requestCode: Int): PendingIntent = PendingIntent.getService(this, requestCode,
    Intent(this, RecorderService::class.java).setAction(action), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)

  private fun leaveForeground() {
    // A timed-out worker still owns the microphone and chunk files until termination.
    if (capture.occupied) return
    notificationView = NotificationView()
    main.post {
      foreground = false
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
    }
  }

  private fun respond(reply: Messenger, requestId: String, result: String? = null, error: String? = null) {
    main.post {
      try {
        reply.send(Message.obtain(null, RESPONSE).apply {
          data = Bundle().apply {
            putString("requestId", requestId)
            if (error == null) putString("result", result) else putString("error", error)
          }
        })
      } catch (_: RemoteException) { /* UI process went away; capture continues. */ }
    }
  }

  private fun enqueue(block: () -> Unit) {
    try { worker.execute(block) } catch (_: RejectedExecutionException) { /* Service is shutting down. */ }
  }

  companion object {
    const val ACTION_PREPARE = "expo.modules.recorder.PREPARE"
    const val ACTION_BOOKMARK = "expo.modules.recorder.BOOKMARK"
    const val ACTION_PAUSE = "expo.modules.recorder.PAUSE"
    const val ACTION_RESUME = "expo.modules.recorder.RESUME"
    const val ACTION_STOP = "expo.modules.recorder.STOP"
    private const val REQUEST = 1
    private const val RESPONSE = 2
    private const val CHANNEL = "lecture-recorder"
    private const val NOTIFICATION_ID = 7821
    private const val SAMPLE_RATE = 32_000L
    private const val SAVE_INTERVAL = 5_000L
    private const val ONE_GIB = 1_073_741_824L
    private const val MIN_FREE_BYTES = 67_108_864L
    private const val JOIN_MARGIN = 16_777_216L
  }
}
