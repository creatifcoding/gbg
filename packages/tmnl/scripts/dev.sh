#!/bin/bash
set -e

# Detect WSLg and apply WebKitGTK compositing workaround
if [ -n "$WSL_DISTRO_NAME" ]; then
  echo "[WSLg detected] Setting WEBKIT_DISABLE_COMPOSITING_MODE=1"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1
fi

# Run Vite dev server
vite
