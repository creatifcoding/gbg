#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# TMNL Windows Cross-Compile with FIFO Error Output
# ═══════════════════════════════════════════════════════════════════════════════
# Creates a named pipe for error streaming, enabling Claude to monitor build errors
# in real-time via: cat /tmp/tmnl/build-windows.fifo
# ═══════════════════════════════════════════════════════════════════════════════

FIFO_DIR="/tmp/tmnl"
FIFO_PATH="${FIFO_DIR}/build-windows.fifo"
LOG_PATH="${FIFO_DIR}/build-windows.log"

# Ensure FIFO directory exists
mkdir -p "$FIFO_DIR"

# Clean up any stale FIFO
[ -p "$FIFO_PATH" ] && rm -f "$FIFO_PATH"

# Create named pipe
mkfifo "$FIFO_PATH"
echo "[tmnl] Created FIFO: $FIFO_PATH"
echo "[tmnl] Claude can read errors via: cat $FIFO_PATH"

# Cleanup function
cleanup() {
  echo "[tmnl] Cleaning up FIFO..."
  rm -f "$FIFO_PATH"
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Start a background process to keep FIFO open and write to log
cat > "$LOG_PATH" < "$FIFO_PATH" &

# Add Windows target if not already added
rustup target add x86_64-pc-windows-gnu 2> >(tee "$FIFO_PATH" >&2)

# Build for Windows
cd src-tauri
cargo build --target x86_64-pc-windows-gnu 2> >(tee "$FIFO_PATH" >&2)

# Get the exe path
EXE_PATH="$(pwd)/target/x86_64-pc-windows-gnu/debug/tmnl.exe"

# Convert WSL path to Windows path
WIN_PATH=$(wslpath -w "$EXE_PATH")

# Launch on Windows in hidden window
powershell.exe -Command "Start-Process -WindowStyle Hidden '$WIN_PATH'"
