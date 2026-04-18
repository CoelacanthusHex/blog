#!/bin/bash
# build-ssimulacra2.sh — build ssimulacra2 from libjxl source.
# Installs the binary to DESTDIR (default: directory of this script).
# Usage: bash build-ssimulacra2.sh [destdir]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTDIR="${1:-$SCRIPT_DIR}"
LIBJXL_TAG="v0.11.2"
BUILD_DIR="/tmp/libjxl-ssimulacra2-build"
SRC_DIR="/tmp/libjxl-ssimulacra2-src"

if [ ! -d "$SRC_DIR/.git" ]; then
  git clone \
    --depth=1 \
    --branch "$LIBJXL_TAG" \
    --recursive \
    --shallow-submodules \
    https://github.com/libjxl/libjxl.git \
    "$SRC_DIR"
fi

cmake -B "$BUILD_DIR" -S "$SRC_DIR" \
  -GNinja \
  -DCMAKE_BUILD_TYPE=Release \
  -DCMAKE_POLICY_VERSION_MINIMUM=3.5.0 \
  -DBUILD_TESTING=OFF \
  -DJPEGXL_ENABLE_DEVTOOLS=ON \
  -DJPEGXL_ENABLE_TOOLS=ON \
  -DJPEGXL_ENABLE_BENCHMARK=OFF \
  -DJPEGXL_ENABLE_EXAMPLES=OFF \
  -DJPEGXL_ENABLE_MANPAGES=OFF \
  -DJPEGXL_ENABLE_JNI=OFF \
  -DJPEGXL_ENABLE_OPENEXR=OFF \
  -DJPEGXL_ENABLE_VIEWERS=OFF \
  -DJPEGXL_ENABLE_PLUGINS=OFF \
  -DJPEGXL_ENABLE_FUZZERS=OFF \
  -DJPEGXL_BUNDLE_LIBPNG=OFF \
  -DJPEGXL_FORCE_SYSTEM_BROTLI=ON \
  -DJPEGXL_FORCE_SYSTEM_HWY=ON \
  -DJPEGXL_FORCE_SYSTEM_GTEST=ON \
  -Wno-dev

ninja -C "$BUILD_DIR" ssimulacra2

install -Dm755 "$BUILD_DIR/tools/ssimulacra2" "$DESTDIR/ssimulacra2"
