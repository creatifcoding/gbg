#!/usr/bin/env bash
# debug-dev.sh — Val's feedback-rich dev server
#
# Captures all output to a log file that Claude can read,
# while still showing realtime output.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/.audit"
LOG_FILE="$LOG_DIR/dev-$(date +%Y%m%d-%H%M%S).log"
LATEST_LOG="$LOG_DIR/dev-latest.log"

# Ensure log directory exists
mkdir -p "$LOG_DIR"

# Kill any existing dev processes on our ports
echo "[debug-dev] Cleaning up existing processes..."
pkill -f "vite.*1420" 2>/dev/null || true
pkill -f "cargo.*tauri" 2>/dev/null || true
sleep 1

# WSLg detection
if [ -n "${WSL_DISTRO_NAME:-}" ]; then
  echo "[debug-dev] WSLg detected: $WSL_DISTRO_NAME"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1
fi

echo "[debug-dev] Starting dev server..."
echo "[debug-dev] Log file: $LOG_FILE"
echo "[debug-dev] Latest symlink: $LATEST_LOG"
echo "---"

# Start vite dev server, tee to log
cd "$PROJECT_DIR"

# Run vite directly (not tauri, just the web app for faster iteration)
exec bun vite --port 1420 --host 2>&1 | tee "$LOG_FILE" &
VITE_PID=$!

# Update latest symlink
ln -sf "$(basename "$LOG_FILE")" "$LATEST_LOG"

echo "[debug-dev] Vite PID: $VITE_PID"
echo "[debug-dev] To read logs: cat $LATEST_LOG"
echo "[debug-dev] To tail logs: tail -f $LATEST_LOG"
echo "---"

# Wait for vite or until interrupted
wait $VITE_PID
