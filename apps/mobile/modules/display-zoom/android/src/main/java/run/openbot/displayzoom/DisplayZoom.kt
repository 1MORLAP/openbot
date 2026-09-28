package run.openbot.displayzoom

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.content.res.Resources
import android.os.Build
import android.util.DisplayMetrics
import android.view.ViewTreeObserver
import com.facebook.react.ReactApplication
import com.facebook.react.uimanager.DisplayMetricsHolder
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * App-wide display zoom, like Android's Display size setting but for this app only, and a text
 * scale that enlarges text alone, like Android's Font size setting.
 *
 * Native views get it from an override configuration with a larger densityDpi. React Native
 * lays out with DisplayMetricsHolder, which it refills from the physical display on rotation and
 * configuration changes, so the scaled metrics are written back after each refill.
 */
object DisplayZoom {
  private const val PREFS = "openbot.display"
  private const val KEY = "zoom"
  private const val TEXT_KEY = "text"
  /**
   * E-ink readers draw text 20% larger than the icons around it; their "100%" font size is that.
   * The font size setting scales on top of it.
   */
  private const val EINK_BASE_TEXT_SCALE = 1.2f
  val ZOOMS = floatArrayOf(1f, 1.25f, 1.5f, 1.75f, 2f, 2.5f, 3f)
  private val EINK_MANUFACTURERS = listOf("onyx", "boox", "bigme", "boyue", "likebook", "meebook", "hisense", "pocketbook", "mooink")

  private val einkDevice: Boolean by lazy {
    val names = listOf(Build.MANUFACTURER, Build.BRAND, Build.MODEL).map { it.orEmpty().lowercase() }
    names.any { name -> EINK_MANUFACTURERS.any { name.contains(it) } }
  }
  const val defaultZoom = 1f
  private val baseTextScale: Float get() = if (einkDevice) EINK_BASE_TEXT_SCALE else 1f

  private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun zoom(context: Context): Float = prefs(context).getFloat(KEY, defaultZoom)

  /** The font size setting, where 1 is the device's standard size. */
  fun textScale(context: Context): Float = prefs(context).getFloat(TEXT_KEY, 1f)

  private fun effectiveTextScale(context: Context): Float = baseTextScale * textScale(context)

  fun save(context: Context, zoom: Float) {
    prefs(context).edit().putFloat(KEY, zoom).commit()
  }

  fun saveTextScale(context: Context, scale: Float) {
    prefs(context).edit().putFloat(TEXT_KEY, scale).commit()
  }

  private fun systemMetrics(): DisplayMetrics = Resources.getSystem().displayMetrics

  /** The configuration an activity applies over the system one. */
  private fun systemFontScale(): Float {
    val system = systemMetrics()
    return if (system.density > 0f) system.scaledDensity / system.density else 1f
  }

  fun overrideConfiguration(context: Context): Configuration? {
    val zoom = zoom(context)
    val text = effectiveTextScale(context)
    if (zoom == 1f && text == 1f) return null
    return Configuration().apply {
      if (zoom != 1f) densityDpi = (systemMetrics().densityDpi * zoom).roundToInt()
      if (text != 1f) fontScale = Resources.getSystem().configuration.fontScale * text
    }
  }

  private fun scaled(source: DisplayMetrics, zoom: Float, text: Float): DisplayMetrics {
    val system = systemMetrics()
    return DisplayMetrics().apply {
      setTo(source)
      density = system.density * zoom
      densityDpi = (system.densityDpi * zoom).roundToInt()
      scaledDensity = density * systemFontScale() * text
    }
  }

  /** Writes the zoomed density and text scale into React Native's metrics. True when they changed. */
  fun applyToReactNative(context: Context): Boolean {
    val zoom = zoom(context)
    val text = effectiveTextScale(context)
    DisplayMetricsHolder.initDisplayMetricsIfNotInitialized(context.applicationContext)
    val screen = DisplayMetricsHolder.getScreenDisplayMetrics()
    val density = systemMetrics().density * zoom
    val scaledDensity = density * systemFontScale() * text
    if (abs(screen.density - density) < 0.001f && abs(screen.scaledDensity - scaledDensity) < 0.001f) return false
    DisplayMetricsHolder.setScreenDisplayMetrics(scaled(screen, zoom, text))
    DisplayMetricsHolder.setWindowDisplayMetrics(scaled(DisplayMetricsHolder.getWindowDisplayMetrics(), zoom, text))
    return true
  }

  // The density JavaScript last received. React Native reads its dimension constants before the
  // zoom is applied, so JavaScript keeps the physical size until an update event says otherwise.
  private var emittedDensity = 0f

  private fun emitDimensions(activity: Activity): Boolean {
    val context = (activity.application as? ReactApplication)?.reactHost?.currentReactContext ?: return false
    val module = context.getNativeModule("DeviceInfo") ?: return false
    return runCatching { module.javaClass.getMethod("emitUpdateDimensionsEvent").invoke(module) }.isSuccess
  }

  /** Call after the activity's super.onCreate and super.onConfigurationChanged. */
  fun reapply(activity: Activity) {
    val changed = applyToReactNative(activity)
    val density = DisplayMetricsHolder.getScreenDisplayMetrics().density
    if ((changed || density != emittedDensity) && emitDimensions(activity)) {
      emittedDensity = density
      activity.window?.decorView?.requestLayout()
    }
  }

  /** React Native refills its metrics in its own layout listener on rotation; restore them after it. */
  fun install(activity: Activity) {
    applyToReactNative(activity)
    val decor = activity.window?.decorView ?: return
    decor.viewTreeObserver.addOnGlobalLayoutListener(
      ViewTreeObserver.OnGlobalLayoutListener { decor.post { reapply(activity) } },
    )
  }

  fun restart(activity: Activity) {
    val intent = activity.packageManager.getLaunchIntentForPackage(activity.packageName) ?: return
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    activity.startActivity(intent)
    Runtime.getRuntime().exit(0)
  }
}
