#!/usr/bin/env bash
# Build WASM mathkernel outside of nix devshell
# Usage: bash scripts/build-wasm.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"

# Resolve nix store paths
EMSCRIPTEN_PATH=$(ls -d /nix/store/*emscripten-*/bin/emcmake 2>/dev/null | head -1 | xargs dirname | xargs dirname)
EIGEN_PATH=$(ls -d /nix/store/*eigen*/include/eigen3 2>/dev/null | head -1)

if [[ -z "$EMSCRIPTEN_PATH" ]]; then
  echo "ERROR: Emscripten not found in nix store. Run: nix develop .#tmnl-wasm"
  exit 1
fi
if [[ -z "$EIGEN_PATH" ]]; then
  echo "ERROR: Eigen not found in nix store."
  exit 1
fi

echo "Emscripten: $EMSCRIPTEN_PATH"
echo "Eigen:      $EIGEN_PATH"

export PATH="$EMSCRIPTEN_PATH/bin:$PATH"
export EM_CACHE="$HOME/.cache/emsdk"

# CRITICAL: Unset Nix header pollution
unset C_INCLUDE_PATH CPLUS_INCLUDE_PATH CPATH NIX_CFLAGS_COMPILE NIX_LDFLAGS 2>/dev/null || true

cd "$PKG_DIR"
rm -rf build && mkdir build && cd build

echo "--- CMake configure ---"
EIGEN3_INCLUDE_DIR="$EIGEN_PATH" emcmake cmake .. 2>&1

echo "--- Build ---"
emmake make -j$(nproc) 2>&1

echo "--- Output ---"
ls -la "$PKG_DIR/dist/"
echo ""
echo "Functions exported: $(grep '  [a-z]' "$PKG_DIR/dist/mathkernel.d.ts" | wc -l)"
echo "WASM size: $(wc -c < "$PKG_DIR/dist/mathkernel.wasm") bytes"
echo "JS glue:   $(wc -c < "$PKG_DIR/dist/mathkernel.js") bytes"
echo ""
echo "BUILD OK ✓"
