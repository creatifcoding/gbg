#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# TMNL Windows Cross-Compile
# ═══════════════════════════════════════════════════════════════════════════════
# Logs to /tmp/tmnl/build-windows.log
# ═══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="/tmp/tmnl"
LOG_PATH="${LOG_DIR}/build-windows.log"

mkdir -p "$LOG_DIR"

echo "[tmnl-windows] Starting Windows cross-compile..."
echo "[tmnl-windows] Log: $LOG_PATH"

# Add Windows target if not already added
rustup target add x86_64-pc-windows-gnu 2>&1 | tee -a "$LOG_PATH"

# Build for Windows
cd "$PROJECT_DIR/src-tauri"
echo "[tmnl-windows] Building..."
cargo build --target x86_64-pc-windows-gnu 2>&1 | tee -a "$LOG_PATH"

# Get the exe path
EXE_PATH="$(pwd)/target/x86_64-pc-windows-gnu/debug/tmnl.exe"

if [ ! -f "$EXE_PATH" ]; then
  echo "[tmnl-windows] Build failed - no exe at $EXE_PATH"
  exit 1
fi

# Launch on Windows only when WSL helpers are available.
if command -v wslpath >/dev/null 2>&1 && command -v powershell.exe >/dev/null 2>&1; then
  WIN_PATH=$(wslpath -w "$EXE_PATH")
  echo "[tmnl-windows] Launching: $WIN_PATH"
  powershell.exe -Command "Start-Process -WindowStyle Hidden '$WIN_PATH'" || true
else
  echo "[tmnl-windows] wslpath/powershell.exe unavailable; skipping Windows launch"
  echo "[tmnl-windows] Built artifact: $EXE_PATH"
fi

echo "[tmnl-windows] Done."
