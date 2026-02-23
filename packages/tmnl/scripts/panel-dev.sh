#!/usr/bin/env bash
set -euo pipefail

# TMNL Panel — Development mode
# Starts the panel Vite dev server and Tauri binary
# Independent from both the main TMNL app and the bar

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Detect WSLg and apply WebKitGTK compositing workaround
if [ -n "${WSL_DISTRO_NAME:-}" ]; then
  echo "[WSLg detected] Setting WEBKIT_DISABLE_COMPOSITING_MODE=1"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1
fi

# gtk-layer-shell pkg-config + library paths (Nix)
GTK_LS_DEV="/nix/store/f6aldwgq5wkzkrw6iycr6bfaki3p2x43-gtk-layer-shell-0.10.0-dev/lib/pkgconfig"
GTK_LS_LIB="/nix/store/vl6dycidnqfy52gmd64nz1idxcillklk-gtk-layer-shell-0.10.0/lib"
if [ -d "$GTK_LS_DEV" ]; then
  export PKG_CONFIG_PATH="$GTK_LS_DEV:${PKG_CONFIG_PATH:-}"
  export LD_LIBRARY_PATH="$GTK_LS_LIB:${LD_LIBRARY_PATH:-}"
  echo "[tmnl-panel] gtk-layer-shell paths injected"
fi

# Enable Rust debug logging
export RUST_LOG="${RUST_LOG:-tmnl_panel=debug,tmnl_shared=debug}"
echo "[tmnl-panel] RUST_LOG=$RUST_LOG"

cd "$PROJECT_DIR"

# Start Vite dev server for panel in background
echo "[tmnl-panel] Starting panel Vite dev server on :1422..."
bunx vite --config vite.config.panel.ts &
VITE_PID=$!

# Wait for Vite to be ready
echo "[tmnl-panel] Waiting for Vite..."
for i in $(seq 1 30); do
  if curl -s http://localhost:1422 > /dev/null 2>&1; then
    echo "[tmnl-panel] Vite ready on :1422"
    break
  fi
  sleep 0.5
done

# Start Tauri panel app
echo "[tmnl-panel] Starting Tauri panel binary..."
cd "$PROJECT_DIR/src-panel-tauri"
cargo tauri dev --config tauri.conf.json

# Cleanup
kill $VITE_PID 2>/dev/null || true
