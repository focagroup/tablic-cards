#!/usr/bin/env bash
# Offline APK build: no Gradle, no downloads. Needs JDK 17+ and the Android SDK
# (platform android-35, build-tools 35.0.0).
#   ./build.sh            -> build/tablic.apk
#   ./build.sh desktop    -> run the server on this computer for testing (port 8080)
#   ./build.sh test       -> run rule tests + bot simulations
#   ./build.sh relaytest  -> test the Bluetooth relay over TCP ("relaytest serve" keeps it running)
set -euo pipefail
cd "$(dirname "$0")"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}}"
BT="$SDK/build-tools/35.0.0"
PLATFORM="$SDK/platforms/android-35/android.jar"

# Pick a JDK >= 17 (Arch: /usr/lib/jvm/java-17-openjdk).
if [ -z "${JAVA_HOME:-}" ]; then
  for j in /usr/lib/jvm/java-21-openjdk /usr/lib/jvm/java-17-openjdk /usr/lib/jvm/java-2*-openjdk; do
    [ -x "$j/bin/javac" ] && JAVA_HOME="$j" && break
  done
fi
[ -n "${JAVA_HOME:-}" ] && [ -x "$JAVA_HOME/bin/javac" ] || { echo "JDK 17+ not found (install jdk17-openjdk)"; exit 1; }
export JAVA_HOME PATH="$JAVA_HOME/bin:$PATH"

OUT=build
CORE=app/core

desktop_classes() {
  rm -rf "$OUT/desktop" && mkdir -p "$OUT/desktop"
  javac -encoding UTF-8 --release 8 -nowarn -d "$OUT/desktop" $(find "$CORE" desktop -name '*.java')
}

case "${1:-apk}" in
  desktop)
    desktop_classes
    exec java -cp "$OUT/desktop" app.tablic.desktop.DesktopMain app/assets/web "${2:-8080}" skins
    ;;
  test)
    desktop_classes
    exec java -cp "$OUT/desktop" app.tablic.desktop.SimTest
    ;;
  relaytest)
    desktop_classes
    exec java -Djava.net.preferIPv6Addresses=true -cp "$OUT/desktop" app.tablic.desktop.RelayTest "${2:-}"
    ;;
  apk) ;;
  *) echo "usage: $0 [apk|desktop|test|relaytest]"; exit 1 ;;
esac

rm -rf "$OUT/apk" && mkdir -p "$OUT/apk/res" "$OUT/apk/gen" "$OUT/apk/classes" "$OUT/apk/dex"

echo "== assets (web client + card skins)"
cp -r app/assets "$OUT/apk/assets"
for skin in skins/*/; do
  name=$(basename "$skin")
  mkdir -p "$OUT/apk/assets/web/skins/$name"
  cp "$skin"*.png "$skin"*.svg "$OUT/apk/assets/web/skins/$name/" 2>/dev/null || true
done

echo "== aapt2 compile/link"
"$BT/aapt2" compile --dir app/res -o "$OUT/apk/res/res.zip"
"$BT/aapt2" link -o "$OUT/apk/unsigned.apk" \
  -I "$PLATFORM" \
  --manifest app/AndroidManifest.xml \
  --min-sdk-version 24 --target-sdk-version 35 \
  --java "$OUT/apk/gen" \
  -A "$OUT/apk/assets" \
  "$OUT/apk/res/res.zip"

echo "== javac"
javac -encoding UTF-8 -source 8 -target 8 -nowarn -Xlint:-options \
  -bootclasspath "$PLATFORM" -classpath "$PLATFORM" \
  -d "$OUT/apk/classes" \
  $(find app/src "$CORE" "$OUT/apk/gen" -name '*.java')

echo "== d8"
"$BT/d8" --release --min-api 24 --lib "$PLATFORM" --output "$OUT/apk/dex" \
  $(find "$OUT/apk/classes" -name '*.class')

echo "== package"
cp "$OUT/apk/unsigned.apk" "$OUT/apk/with-dex.apk"
(cd "$OUT/apk/dex" && zip -q -j ../with-dex.apk classes.dex)
"$BT/zipalign" -f -p 4 "$OUT/apk/with-dex.apk" "$OUT/apk/aligned.apk"

KEYS="${CARDS_KEYS:-$HOME/claude/.keys/cards}"
KS="$KEYS/tablic.jks"
[ -f "$KS" ] || { echo "no signing key $KS (password in $KEYS/tablic.pass)"; exit 1; }
"$BT/apksigner" sign --ks "$KS" --ks-key-alias tablic --ks-pass "file:$KEYS/tablic.pass" \
  --out "$OUT/tablic.apk" "$OUT/apk/aligned.apk"
"$BT/apksigner" verify "$OUT/tablic.apk"
echo "== done: $OUT/tablic.apk ($(du -h "$OUT/tablic.apk" | cut -f1))"
