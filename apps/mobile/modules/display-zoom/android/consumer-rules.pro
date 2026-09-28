# DisplayZoom asks React Native's DeviceInfo module to re-emit its dimensions by name.
-keepclassmembers class com.facebook.react.modules.deviceinfo.DeviceInfoModule {
  void emitUpdateDimensionsEvent();
}
