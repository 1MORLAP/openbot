package run.openbot.displayzoom

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DisplayZoomModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DisplayZoom")

    Constants(
      "zooms" to DisplayZoom.ZOOMS.toList(),
      "defaultZoom" to DisplayZoom.defaultZoom,
    )

    Function("getTextScale") {
      val context = appContext.reactContext ?: return@Function 1f
      DisplayZoom.textScale(context)
    }

    // Saves the text scale and restarts the app, like the zoom.
    Function("setTextScale") { scale: Float ->
      val activity = appContext.currentActivity ?: return@Function
      DisplayZoom.saveTextScale(activity, scale)
      activity.runOnUiThread { DisplayZoom.restart(activity) }
    }

    Function("getZoom") {
      val context = appContext.reactContext ?: return@Function DisplayZoom.defaultZoom
      DisplayZoom.zoom(context)
    }

    // Saves the zoom and restarts the app, so every native and React view is laid out again.
    Function("setZoom") { zoom: Float ->
      val activity = appContext.currentActivity ?: return@Function
      DisplayZoom.save(activity, zoom)
      activity.runOnUiThread { DisplayZoom.restart(activity) }
    }
  }
}
