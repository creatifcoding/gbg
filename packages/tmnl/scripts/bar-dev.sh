#!/usr/bin/env bash
set -euo pipefail

# TMNL Bar — Development mode
# Starts the bar Vite dev server and Tauri binary
# Independent from the main TMNL app

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Detect WSLg and apply WebKitGTK compositing workaround
if [ -n "${WSL_DISTRO_NAME:-}" ]; then
  echo "[WSLg detected] Setting WEBKIT_DISABLE_COMPOSITING_MODE=1"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1
fi

# Enable Rust debug logging
export RUST_LOG="${RUST_LOG:-tmnl_bar=debug,tmnl_shared=debug}"
echo "[tmnl-bar] RUST_LOG=$RUST_LOG"

cd "$PROJECT_DIR"

# Start Vite dev server for bar in background
echo "[tmnl-bar] Starting bar Vite dev server on :1421..."
bunx vite --config vite.config.bar.ts &
VITE_PID=$!

# Wait for Vite to be ready
echo "[tmnl-bar] Waiting for Vite..."
for i in $(seq 1 30); do
  if curl -s http://localhost:1421 > /dev/null 2>&1; then
    echo "[tmnl-bar] Vite ready on :1421"
    break
  fi
  sleep 0.5
done

# Start Tauri bar app
echo "[tmnl-bar] Starting Tauri bar binary..."
cd "$PROJECT_DIR/src-bar-tauri"
cargo tauri dev --config tauri.conf.json

# Cleanup
kill $VITE_PID 2>/dev/null || true
