#!/usr/bin/env bash
# Rasterizes tools/icon/*.svg (written by tools/gen_cards.js) into icon.png and the Android launcher icons.
# Needs rsvg-convert (librsvg). Run from the project root.
set -euo pipefail
cd "$(dirname "$0")/.."
rsvg-convert -w 1024 -h 1024 tools/icon/icon.svg -o icon.png
for d in mdpi:48:108 hdpi:72:162 xhdpi:96:216 xxhdpi:144:324 xxxhdpi:192:432; do
  IFS=: read -r dpi legacy adaptive <<<"$d"
  mkdir -p "app/res/mipmap-$dpi"
  rsvg-convert -w "$legacy" -h "$legacy" tools/icon/icon.svg -o "app/res/mipmap-$dpi/ic_launcher.png"
  rsvg-convert -w "$adaptive" -h "$adaptive" tools/icon/icon_fg.svg -o "app/res/mipmap-$dpi/ic_launcher_foreground.png"
  rsvg-convert -w "$adaptive" -h "$adaptive" tools/icon/icon_bg.svg -o "app/res/mipmap-$dpi/ic_launcher_background.png"
done
echo "icons written"
