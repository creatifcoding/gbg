#!/bin/bash
set -e

# ═══════════════════════════════════════════════════════════════════════════════
# TMNL Tauri Dev Server with FIFO Error Output + Audit Logging
# ═══════════════════════════════════════════════════════════════════════════════
# Creates a named pipe for error streaming, enabling Claude to monitor build errors
# in real-time via: cat /tmp/tmnl/tauri-dev.fifo
#
# AUDIT LOGGING:
# - All output also written to .audit/tauri-dev-latest.log
# - Timestamped logs in .audit/tauri-dev-YYYYMMDD-HHMMSS.log
#
# FRIDA INSTRUMENTATION (when available):
# - Attach via: frida -p $(pgrep -f "tmnl") --load scripts/frida-hooks.js
# ═══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
AUDIT_DIR="${PROJECT_DIR}/.audit"

# Ensure audit directory exists
mkdir -p "$AUDIT_DIR"

FIFO_DIR="/tmp/tmnl"
FIFO_PATH="${FIFO_DIR}/tauri-dev.fifo"
LOG_PATH="${FIFO_DIR}/tauri-dev.log"
AUDIT_LOG="${AUDIT_DIR}/tauri-dev-$(date +%Y%m%d-%H%M%S).log"
AUDIT_LATEST="${AUDIT_DIR}/tauri-dev-latest.log"

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
  # Kill any background tee processes
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

# Enable Rust debug logging for window pooling and other tmnl modules
export RUST_LOG="${RUST_LOG:-tmnl=debug}"
echo "[tmnl] RUST_LOG=$RUST_LOG"

# Start react-grab Claude Code server (detached, port 4567)
echo "[tmnl] Starting react-grab server on port 4567..."
bunx @react-grab/claude-code &

# Start a background process to keep FIFO open and write to log
# This prevents blocking if no reader is connected
cat > "$LOG_PATH" < "$FIFO_PATH" &
FIFO_READER_PID=$!

# Create symlink to latest audit log
ln -sf "$(basename "$AUDIT_LOG")" "$AUDIT_LATEST"

echo "[tmnl] Audit log: $AUDIT_LOG"
echo "[tmnl] Latest symlink: $AUDIT_LATEST"
echo "[tmnl] Claude can read: cat $AUDIT_LATEST"
echo "---"

# Run Tauri in development mode
# Output goes to: terminal, FIFO, and audit log
bunx tauri dev 2>&1 | tee -a "$AUDIT_LOG" 2> >(tee "$FIFO_PATH" >&2)
