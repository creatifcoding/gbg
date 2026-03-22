#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# TMNL Dual-Platform Dev with FIFO Error Output
# ═══════════════════════════════════════════════════════════════════════════════
# Runs both Windows cross-compile (background) and WSLg Tauri (foreground)
# FIFOs available at:
#   /tmp/tmnl/tauri-dev.fifo      - Main Tauri dev errors
#   /tmp/tmnl/build-windows.fifo  - Windows cross-compile errors
#   /tmp/tmnl/dev-both.fifo       - Combined stream (this script)
# ═══════════════════════════════════════════════════════════════════════════════

FIFO_DIR="/tmp/tmnl"
FIFO_PATH="${FIFO_DIR}/dev-both.fifo"
LOG_PATH="${FIFO_DIR}/dev-both.log"

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

# Run Windows build in background (uses its own FIFO)
bash scripts/build-windows.sh &
WINDOWS_PID=$!

# Run WSLg version in foreground via tauri-dev.sh (creates its own FIFO)
# Capture this script's combined output to our FIFO
bash scripts/tauri-dev.sh 2> >(tee "$FIFO_PATH" >&2)
