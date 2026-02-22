#!/usr/bin/env bash
set -euo pipefail

# TMNL Shell — Development mode
# Starts the shell Vite dev server and Tauri binary
# Independent from the main TMNL app

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
  echo "[tmnl-shell] gtk-layer-shell paths injected"
fi

# Enable Rust debug logging
export RUST_LOG="${RUST_LOG:-tmnl_shell=debug,tmnl_shared=debug}"
echo "[tmnl-shell] RUST_LOG=$RUST_LOG"

cd "$PROJECT_DIR"

# Start Vite dev server for bar in background
echo "[tmnl-shell] Starting shell Vite dev server on :1421..."
bunx vite --config vite.config.shell.ts &
VITE_PID=$!

# Wait for Vite to be ready
echo "[tmnl-shell] Waiting for Vite..."
for i in $(seq 1 30); do
  if curl -s http://localhost:1421 > /dev/null 2>&1; then
    echo "[tmnl-shell] Vite ready on :1421"
    break
  fi
  sleep 0.5
done

# Start Tauri shell app
echo "[tmnl-shell] Starting Tauri shell binary..."
cd "$PROJECT_DIR/src-shell-tauri"
cargo tauri dev --config tauri.conf.json

# Cleanup
kill $VITE_PID 2>/dev/null || true
