#!/usr/bin/env bash
# Builds a standalone release APK (JavaScript bundled, no Metro) for sideloading.
#
#   bun run android:apk            # arm64-v8a, the ABI of current phones and e-ink readers
#   ABIS=arm64-v8a,armeabi-v7a bun run android:apk
#   MINIFY=0 bun run android:apk   # skip R8 code and resource shrinking (faster build, ~14 MB larger)
#
# Needs JDK 17 and the Android SDK with platform 36, build-tools 36.0.0, NDK 27.1.12297006
# and CMake 3.22.1. The APK is signed with the debug keystore that prebuild generates, which
# is fine for sideloading; replace it before distributing through a store.
set -euo pipefail

cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$PATH"
export NODE_ENV=production
export EXPO_PUBLIC_APP_ENV="${EXPO_PUBLIC_APP_ENV:-preview}"
ABIS="${ABIS:-arm64-v8a}"
MINIFY="${MINIFY:-1}"

if [ ! -d android ] || [ "${CLEAN:-0}" = "1" ]; then
  bunx expo prebuild --platform android --no-install ${CLEAN:+--clean}
fi

# The generated defaults (2 GB heap, 512 MB metaspace) run out during KSP and the C++ builds.
sed -i.bak 's/^org.gradle.jvmargs=.*/org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=2g -Dfile.encoding=UTF-8/' android/gradle.properties
grep -q '^kotlin.daemon.jvmargs=' android/gradle.properties ||
  printf '\nkotlin.daemon.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=1g\n' >> android/gradle.properties
rm -f android/gradle.properties.bak

# R8 removes the code no module reaches and the resources nothing references, which takes the
# APK from about 79 MB to 65 MB.
if [ "$MINIFY" = "1" ]; then SHRINK=true; else SHRINK=false; fi
(cd android && ./gradlew assembleRelease -PreactNativeArchitectures="$ABIS" \
  -Pandroid.enableMinifyInReleaseBuilds="$SHRINK" -Pandroid.enableShrinkResourcesInReleaseBuilds="$SHRINK")

mkdir -p dist
cp android/app/build/outputs/apk/release/app-release.apk dist/openbot-android.apk
echo "APK: $(pwd)/dist/openbot-android.apk"
