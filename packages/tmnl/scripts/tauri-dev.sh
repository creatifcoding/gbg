#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# TMNL Tauri Dev Server with FIFO Error Output + Audit Logging
# ═══════════════════════════════════════════════════════════════════════════════
# Creates a named pipe as an internal diagnostics stream and mirrors it to
# /tmp/tmnl/tauri-dev.log for replayable agent-readable diagnostics.
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
: > "$LOG_PATH"
: > "$AUDIT_LOG"

tmnl_log() {
  printf '%s\n' "$*" | tee -a "$LOG_PATH" "$AUDIT_LOG"
}

# Clean up any stale FIFO
[ -p "$FIFO_PATH" ] && rm -f "$FIFO_PATH"

# Create named pipe
mkfifo "$FIFO_PATH"
tmnl_log "[tmnl] Created FIFO: $FIFO_PATH"
tmnl_log "[tmnl] Diagnostics log: $LOG_PATH"
tmnl_log "[tmnl] Claude can read diagnostics via: tail -f $LOG_PATH"

HARNESS_WS_PID=""
FIFO_READER_PID=""
CLEANED_UP=0

# Cleanup function
cleanup() {
  if [ "${CLEANED_UP:-0}" = "1" ]; then
    return
  fi
  CLEANED_UP=1

  tmnl_log "[tmnl] Cleaning up FIFO..."
  rm -f "$FIFO_PATH"

  if [ -n "${HARNESS_WS_PID:-}" ]; then
    kill "$HARNESS_WS_PID" 2>/dev/null || true
  fi

  if [ -n "${FIFO_READER_PID:-}" ]; then
    kill "$FIFO_READER_PID" 2>/dev/null || true
  fi

  # Kill any background tee processes
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Detect WSLg and apply WebKitGTK compositing workaround
if [ -n "${WSL_DISTRO_NAME:-}" ]; then
  tmnl_log "[WSLg detected] Setting WEBKIT_DISABLE_COMPOSITING_MODE=1"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1
fi

# Enable Rust debug logging for window pooling and other tmnl modules
export RUST_LOG="${RUST_LOG:-tmnl=debug}"
tmnl_log "[tmnl] RUST_LOG=$RUST_LOG"

HARNESS_WS_HEALTH_URL="http://127.0.0.1:8787/health"

harness_ws_health_ok() {
  local payload
  payload=$(curl -fsS --max-time 2 "$HARNESS_WS_HEALTH_URL" 2>/dev/null || true)
  echo "$payload" | grep -q '"service":"harness-remote-ws"'
}

# Ensure harness remote WS server is available
if harness_ws_health_ok; then
  tmnl_log "[tmnl] harness remote WS already running on :8787"
else
  tmnl_log "[tmnl] starting harness remote WS on :8787..."
  bash scripts/harness-remote-ws.sh >/tmp/tmnl/harness-remote-ws.log 2>&1 &
  HARNESS_WS_PID=$!

  # Cold starts can take a while because the harness scans pi extensions before
  # binding :8787. Give it a real startup budget; failing early here prevents
  # Tauri from even reaching Vite.
  for _ in $(seq 1 480); do
    if harness_ws_health_ok; then
      tmnl_log "[tmnl] harness remote WS ready"
      break
    fi

    if ! kill -0 "$HARNESS_WS_PID" 2>/dev/null; then
      tmnl_log "[tmnl] harness remote WS process exited early"
      break
    fi

    sleep 0.25
  done

  if ! harness_ws_health_ok; then
    tmnl_log "[tmnl] failed to start harness remote WS (see /tmp/tmnl/harness-remote-ws.log)"
    tail -n 80 /tmp/tmnl/harness-remote-ws.log 2>/dev/null | tee -a "$LOG_PATH" "$AUDIT_LOG" || true
    exit 1
  fi
fi

# Start a background process to keep FIFO open and mirror diagnostics to a normal file.
# Named pipes are not replayable and multiple readers split data, so agents should read LOG_PATH.
cat < "$FIFO_PATH" >> "$LOG_PATH" &
FIFO_READER_PID=$!

# Create symlink to latest audit log
ln -sf "$(basename "$AUDIT_LOG")" "$AUDIT_LATEST"

tmnl_log "[tmnl] Audit log: $AUDIT_LOG"
tmnl_log "[tmnl] Latest symlink: $AUDIT_LATEST"
tmnl_log "[tmnl] Claude can read audit log: tail -f $AUDIT_LATEST"
tmnl_log "[tmnl] Claude can read diagnostics log: tail -f $LOG_PATH"
tmnl_log "---"

# Run Tauri in development mode.
# Mirror both stdout and stderr to the diagnostics FIFO/log and the audit log while preserving terminal output.
bunx tauri dev \
  > >(tee -a "$AUDIT_LOG" "$FIFO_PATH") \
  2> >(tee -a "$AUDIT_LOG" "$FIFO_PATH" >&2)
