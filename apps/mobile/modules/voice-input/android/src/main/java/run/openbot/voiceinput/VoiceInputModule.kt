package run.openbot.voiceinput

import android.app.Activity
import android.content.Intent
import android.speech.RecognizerIntent
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The system voice input dialog (RecognizerIntent), for devices whose speech service can run as
 * an activity but not as a live recognizer the app binds to. It returns the final text only.
 */
class VoiceInputModule : Module() {
  private var pending: Promise? = null

  private fun intent(language: String?, prompt: String?) =
    Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
      putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
      putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
      language?.let { putExtra(RecognizerIntent.EXTRA_LANGUAGE, it) }
      prompt?.let { putExtra(RecognizerIntent.EXTRA_PROMPT, it) }
    }

  override fun definition() = ModuleDefinition {
    Name("VoiceInput")

    Function("isAvailable") {
      val context = appContext.reactContext ?: return@Function false
      context.packageManager.queryIntentActivities(intent(null, null), 0).isNotEmpty()
    }

    // Resolves with the recognized text, or null when the user closes the dialog.
    AsyncFunction("recognize") { language: String?, prompt: String?, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject(CodedException("NO_ACTIVITY", "OpenBot is not in the foreground.", null))
        return@AsyncFunction
      }
      if (pending != null) {
        promise.reject(CodedException("BUSY", "Voice input is already open.", null))
        return@AsyncFunction
      }
      pending = promise
      try {
        activity.startActivityForResult(intent(language, prompt), REQUEST_CODE)
      } catch (error: Exception) {
        pending = null
        promise.reject(CodedException("UNAVAILABLE", error.message ?: "No voice input app.", error))
      }
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQUEST_CODE) return@OnActivityResult
      val promise = pending ?: return@OnActivityResult
      pending = null
      val text =
        if (payload.resultCode == Activity.RESULT_OK) {
          payload.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        } else {
          null
        }
      promise.resolve(text)
    }
  }

  private companion object {
    const val REQUEST_CODE = 7301
  }
}
