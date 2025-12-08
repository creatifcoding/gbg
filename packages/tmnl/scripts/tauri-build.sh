#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# TMNL Tauri Build with FIFO Error Output
# ═══════════════════════════════════════════════════════════════════════════════
# Creates a named pipe for error streaming, enabling Claude to monitor build errors
# in real-time via: cat /tmp/tmnl/tauri-build.fifo
# ═══════════════════════════════════════════════════════════════════════════════

FIFO_DIR="/tmp/tmnl"
FIFO_PATH="${FIFO_DIR}/tauri-build.fifo"
LOG_PATH="${FIFO_DIR}/tauri-build.log"

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

# Build Tauri app for production
# Stderr is tee'd to both terminal and FIFO
bunx tauri build 2> >(tee "$FIFO_PATH" >&2)
