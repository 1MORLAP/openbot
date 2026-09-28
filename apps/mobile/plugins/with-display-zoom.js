const { withMainActivity } = require("expo/config-plugins");
const { mergeContents } = require("@expo/config-plugins/build/utils/generateCode");

// Applies the app's display zoom (modules/display-zoom) to MainActivity: an override
// configuration for native views, and scaled React Native metrics after creation and after
// every configuration change.
const IMPORTS = `import android.content.Context
import android.content.res.Configuration
import run.openbot.displayzoom.DisplayZoom`;

const MEMBERS = `  override fun attachBaseContext(newBase: Context) {
    super.attachBaseContext(newBase)
    DisplayZoom.overrideConfiguration(newBase)?.let { applyOverrideConfiguration(it) }
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    DisplayZoom.reapply(this)
  }
`;

/** @type {import('expo/config-plugins').ConfigPlugin} */
module.exports = function withDisplayZoom(config) {
  return withMainActivity(config, (mod) => {
    if (mod.modResults.language !== "kt") throw new Error("with-display-zoom expects a Kotlin MainActivity.");
    let contents = mod.modResults.contents;
    contents = mergeContents({
      src: contents,
      newSrc: IMPORTS,
      tag: "openbot-display-zoom-imports",
      anchor: /^import android\.os\.Bundle$/m,
      offset: 1,
      comment: "//",
    }).contents;
    contents = mergeContents({
      src: contents,
      newSrc: MEMBERS,
      tag: "openbot-display-zoom-members",
      anchor: /^class MainActivity : ReactActivity\(\) \{$/m,
      offset: 1,
      comment: "//",
    }).contents;
    contents = mergeContents({
      src: contents,
      newSrc: "    DisplayZoom.install(this)",
      tag: "openbot-display-zoom-install",
      anchor: /^\s*super\.onCreate\(null\)$/m,
      offset: 1,
      comment: "//",
    }).contents;
    mod.modResults.contents = contents;
    return mod;
  });
};
