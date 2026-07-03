#!/usr/bin/env bash
set -euo pipefail

# TMNL Shell — Development mode
# Starts the shell Vite dev server and the Tauri/WebKit layer-shell sidecar.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

if [ -n "${WSL_DISTRO_NAME:-}" ]; then
  echo "[WSLg detected] Setting WEBKIT_DISABLE_COMPOSITING_MODE=1"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1
fi

export GDK_BACKEND="${GDK_BACKEND:-wayland}"
export TMNL_WEBKIT_DISABLE_HARDWARE_ACCELERATION="${TMNL_WEBKIT_DISABLE_HARDWARE_ACCELERATION:-1}"
export RUST_LOG="${RUST_LOG:-tmnl_shell=debug,tmnl_shell_lib=debug,tmnl_shared=debug}"

echo "[tmnl-shell] GDK_BACKEND=$GDK_BACKEND"
echo "[tmnl-shell] TMNL_WEBKIT_DISABLE_HARDWARE_ACCELERATION=$TMNL_WEBKIT_DISABLE_HARDWARE_ACCELERATION"
echo "[tmnl-shell] RUST_LOG=$RUST_LOG"

cd "$PROJECT_DIR"

echo "[tmnl-shell] Starting shell Vite dev server on :1421..."
bunx vite --config vite.config.shell.ts &
VITE_PID=$!

cleanup() {
  kill "$VITE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "[tmnl-shell] Waiting for Vite..."
for _ in $(seq 1 60); do
  if curl -fsS http://localhost:1421 >/dev/null 2>&1; then
    echo "[tmnl-shell] Vite ready on :1421"
    break
  fi
  if ! kill -0 "$VITE_PID" 2>/dev/null; then
    echo "[tmnl-shell] Vite exited before becoming ready" >&2
    wait "$VITE_PID"
    exit 1
  fi
  sleep 0.5
done

if ! curl -fsS http://localhost:1421 >/dev/null 2>&1; then
  echo "[tmnl-shell] Vite readiness timed out" >&2
  exit 1
fi

echo "[tmnl-shell] Starting Tauri shell binary..."
cd "$PROJECT_DIR/src-shell-tauri"
cargo tauri dev --config tauri.conf.json
