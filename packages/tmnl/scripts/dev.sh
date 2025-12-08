#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# TMNL Vite Dev Server with FIFO Error Output
# ═══════════════════════════════════════════════════════════════════════════════
# Creates a named pipe for error streaming, enabling Claude to monitor build errors
# in real-time via: cat /tmp/tmnl/vite-dev.fifo
# ═══════════════════════════════════════════════════════════════════════════════

FIFO_DIR="/tmp/tmnl"
FIFO_PATH="${FIFO_DIR}/vite-dev.fifo"
LOG_PATH="${FIFO_DIR}/vite-dev.log"

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
  # Kill react-grab server if running
  pkill -f "react-grab.*server" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Detect WSLg and apply WebKitGTK compositing workaround
if [ -n "$WSL_DISTRO_NAME" ]; then
  echo "[WSLg detected] Setting WEBKIT_DISABLE_COMPOSITING_MODE=1"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1
fi

# Start react-grab Claude Code server (detached, port 4567)
echo "[tmnl] Starting react-grab server on port 4567..."
bunx @react-grab/claude-code &

# Start a background process to keep FIFO open and write to log
cat > "$LOG_PATH" < "$FIFO_PATH" &

# Run Vite dev server
# Stderr is tee'd to both terminal and FIFO
vite 2> >(tee "$FIFO_PATH" >&2)
