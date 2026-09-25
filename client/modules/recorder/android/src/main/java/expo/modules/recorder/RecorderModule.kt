package expo.modules.recorder

import android.Manifest
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.Message
import android.os.Messenger
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.util.UUID

/** UI-process bridge. Only the service process owns audio, journals and recording state. */
class RecorderModule : Module() {
  private data class Request(val command: String, val args: String, val promise: Promise, val timeout: Runnable)
  private val main = Handler(Looper.getMainLooper())
  private val pending = linkedMapOf<String, Request>()
  private var remote: Messenger? = null
  private var boundContext: Context? = null
  private var binding = false
  private val replies = Messenger(Handler(Looper.getMainLooper()) { message ->
    if (message.what == 2) {
      val id = message.data.getString("requestId")
      val request = pending.remove(id)
      if (request != null) {
        main.removeCallbacks(request.timeout)
        val error = message.data.getString("error")
        val result = message.data.getString("result")
        if (error != null) request.promise.reject("RECORDER_COMMAND", error, null)
        else if (result != null) request.promise.resolve(result)
        else request.promise.reject("RECORDER_RESPONSE", "The recorder returned no status.", null)
      }
    }
    true
  })

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName, binder: IBinder) {
      remote = Messenger(binder)
      pending.toMap().forEach { (id, request) ->
        if (pending.containsKey(id)) send(id, request)
      }
    }
    override fun onServiceDisconnected(name: ComponentName) {
      remote = null
      rejectAll("The recorder process disconnected. Reopen the recorder to recover saved audio.")
    }
    override fun onBindingDied(name: ComponentName) {
      disconnect()
      rejectAll("The recorder connection ended. Try again.")
    }
    override fun onNullBinding(name: ComponentName) {
      disconnect()
      rejectAll("The recorder service is unavailable.")
    }
  }

  override fun definition() = ModuleDefinition {
    Name("NotesRecorder")
    AsyncFunction("commandAsync") { command: String, args: String, promise: Promise ->
      try {
        require(command in setOf("snapshot", "list", "start", "pause", "resume", "stop", "bookmark", "recover")) {
          "Unknown recorder command."
        }
        require(args.length <= 8192) { "Recorder arguments are too large." }
        val context = appContext.reactContext?.applicationContext ?: error("The app is not ready.")
        val arguments = JSONObject(args)
        if (command == "start") {
          val activity = appContext.currentActivity ?: error("Open the recorder screen before starting.")
          require((activity as? LifecycleOwner)?.lifecycle?.currentState?.isAtLeast(Lifecycle.State.RESUMED) == true) {
            "Keep the recorder screen open while starting."
          }
          require(context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
            "Microphone permission is required."
          }
          val title = arguments.optString("title").trim()
          require(title.isNotEmpty() && title.length <= 200) { "Enter a recording title of 1–200 characters." }
          if (!arguments.has("id")) arguments.put("id", UUID.randomUUID().toString())
          UUID.fromString(arguments.getString("id"))
          val intent = Intent(context, RecorderService::class.java).setAction(RecorderService.ACTION_PREPARE)
          if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
          else context.startService(intent)
        }
        enqueue(context, command, arguments.toString(), promise)
      } catch (error: Exception) {
        promise.reject("RECORDER_START", error.message ?: "The recorder could not start.", error)
      }
    }.runOnQueue(Queues.MAIN)

    OnDestroy {
      main.post {
        rejectAll("The recorder screen disconnected. Recording continues in its own process.")
        disconnect()
      }
    }
  }

  private fun enqueue(context: Context, command: String, args: String, promise: Promise) {
    val id = UUID.randomUUID().toString()
    val timeout = Runnable {
      pending.remove(id)?.promise?.reject("RECORDER_TIMEOUT", "The recorder is taking longer than expected. Refresh its status before trying again.", null)
    }
    val request = Request(command, args, promise, timeout)
    pending[id] = request
    main.postDelayed(timeout, if (command == "stop" || command == "recover") 120_000L else 15_000L)
    if (remote != null) {
      send(id, request)
    } else if (!binding) {
      try {
        boundContext = context
        binding = context.bindService(Intent(context, RecorderService::class.java), connection, Context.BIND_AUTO_CREATE)
        if (!binding) {
          boundContext = null
          rejectAll("Could not connect to the recorder service.")
        }
      } catch (error: Exception) {
        boundContext = null
        binding = false
        rejectAll(error.message ?: "Could not connect to the recorder service.")
      }
    }
  }

  private fun send(id: String, request: Request) {
    try {
      val message = Message.obtain(null, 1)
      message.replyTo = replies
      message.data = Bundle().apply {
        putString("requestId", id)
        putString("command", request.command)
        putString("args", request.args)
      }
      remote?.send(message) ?: error("The recorder is disconnected.")
    } catch (error: Exception) {
      pending.remove(id)
      main.removeCallbacks(request.timeout)
      request.promise.reject("RECORDER_DISCONNECTED", "The recorder disconnected. Refresh to check saved audio.", error)
      disconnect()
      rejectAll("The recorder disconnected. Refresh to check saved audio.")
    }
  }

  private fun rejectAll(message: String) {
    val requests = pending.values.toList()
    pending.clear()
    requests.forEach {
      main.removeCallbacks(it.timeout)
      it.promise.reject("RECORDER_DISCONNECTED", message, null)
    }
  }

  private fun disconnect() {
    if (binding) {
      try { boundContext?.unbindService(connection) } catch (_: IllegalArgumentException) { }
    }
    binding = false
    boundContext = null
    remote = null
  }
}
