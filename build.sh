#!/usr/bin/env bash
# Offline APK build on the shared cards framework (see framework/build.sh, settings in game.conf).
#   ./build.sh            -> build/<game>.apk
#   ./build.sh desktop    -> run the server on this computer for testing (port 8080)
#   ./build.sh test       -> run rule tests + bot simulations
#   ./build.sh relaytest  -> test the Bluetooth relay over TCP ("relaytest serve" keeps it running)
set -euo pipefail
cd "$(dirname "$0")"
[ -f framework/build.sh ] || { echo "framework/ is missing: run  git submodule update --init"; exit 1; }
exec framework/build.sh "$@"
