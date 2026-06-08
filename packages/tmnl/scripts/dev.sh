#!/bin/bash
set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# TMNL Vite Dev Server with FIFO Error Output
# ═══════════════════════════════════════════════════════════════════════════════
# Creates a named pipe as an internal diagnostics stream and mirrors it to
# /tmp/tmnl/vite-dev.log for replayable agent-readable diagnostics.
# ═══════════════════════════════════════════════════════════════════════════════

FIFO_DIR="/tmp/tmnl"
FIFO_PATH="${FIFO_DIR}/vite-dev.fifo"
LOG_PATH="${FIFO_DIR}/vite-dev.log"

# Ensure FIFO directory exists
mkdir -p "$FIFO_DIR"
: > "$LOG_PATH"

tmnl_log() {
  printf '%s\n' "$*" | tee -a "$LOG_PATH"
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

  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Detect WSLg and apply WebKitGTK compositing workaround
if [ -n "${WSL_DISTRO_NAME:-}" ]; then
  tmnl_log "[WSLg detected] Setting WEBKIT_DISABLE_COMPOSITING_MODE=1"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1
fi

HARNESS_WS_HEALTH_URL="http://127.0.0.1:8787/health"

harness_ws_health_ok() {
  local payload
  payload=$(curl -fsS --max-time 2 "$HARNESS_WS_HEALTH_URL" 2>/dev/null || true)
  echo "$payload" | grep -q '"service":"harness-remote-ws"'
}

diagnose_harness_ws_failure() {
  tmnl_log "[tmnl] harness remote WS diagnostic bundle"
  tmnl_log "[tmnl] bun: $(bun --version 2>/dev/null || echo unavailable)"
  tmnl_log "[tmnl] bun runtime: $(bun -e \"console.log(process.version + ' modules=' + (process.versions.modules ?? 'n/a'))\" 2>/dev/null || echo unavailable)"

  if [ -n "${HARNESS_WS_PID:-}" ]; then
    tmnl_log "[tmnl] harness remote WS pid: ${HARNESS_WS_PID}"
    ps -fp "$HARNESS_WS_PID" 2>&1 | tee -a "$LOG_PATH" || true
  fi

  tmnl_log "[tmnl] harness remote WS log tail:"
  tail -n 120 /tmp/tmnl/harness-remote-ws.log 2>/dev/null | tee -a "$LOG_PATH" || true

  tmnl_log "[tmnl] import probe: HarnessRemoteWsServer"
  timeout 30 bun -e "const t=performance.now(); await import('./src/lib/harness/server/HarnessRemoteWsServer.ts'); console.log('[tmnl] import probe ok '+Math.round(performance.now()-t)+'ms'); process.exit(0)" \
    2>&1 | tee -a "$LOG_PATH" || tmnl_log "[tmnl] import probe failed or timed out"
}

start_harness_ws() {
  tmnl_log "[tmnl] starting harness remote WS on :8787..."
  bash scripts/harness-remote-ws.sh >/tmp/tmnl/harness-remote-ws.log 2>&1 &
  HARNESS_WS_PID=$!
}

wait_for_harness_ws() {
  # Cold starts can take a while because the harness scans pi extensions before
  # binding :8787. Give it a real startup budget; failing early here makes
  # Vite/Tauri report a misleading beforeDevCommand failure.
  for _ in $(seq 1 480); do
    if harness_ws_health_ok; then
      tmnl_log "[tmnl] harness remote WS ready"
      return 0
    fi

    if ! kill -0 "$HARNESS_WS_PID" 2>/dev/null; then
      tmnl_log "[tmnl] harness remote WS process exited early"
      return 1
    fi

    sleep 0.25
  done

  return 1
}

# Ensure harness remote WS server is available
if harness_ws_health_ok; then
  tmnl_log "[tmnl] harness remote WS already running on :8787"
else
  start_harness_ws

  if ! wait_for_harness_ws; then
    tmnl_log "[tmnl] harness remote WS failed first startup attempt (see /tmp/tmnl/harness-remote-ws.log)"
    diagnose_harness_ws_failure

    if [ -n "${HARNESS_WS_PID:-}" ]; then
      kill "$HARNESS_WS_PID" 2>/dev/null || true
      wait "$HARNESS_WS_PID" 2>/dev/null || true
      HARNESS_WS_PID=""
    fi

    tmnl_log "[tmnl] retrying harness remote WS once after diagnostic probe..."
    start_harness_ws

    if ! wait_for_harness_ws; then
      tmnl_log "[tmnl] failed to start harness remote WS after retry (see /tmp/tmnl/harness-remote-ws.log)"
      diagnose_harness_ws_failure
      exit 1
    fi
  fi
fi

# Start a background process to keep FIFO open and mirror diagnostics to a normal file.
# Named pipes are not replayable and multiple readers split data, so agents should read LOG_PATH.
cat < "$FIFO_PATH" >> "$LOG_PATH" &
FIFO_READER_PID=$!

VITE_ARGS=()
if [ "${TMNL_VITE_FORCE:-0}" = "1" ]; then
  tmnl_log "[tmnl] TMNL_VITE_FORCE=1; starting Vite with --force"
  VITE_ARGS+=(--force)
fi

# Run Vite dev server. Mirror both stdout and stderr to the diagnostics FIFO/log
# while preserving terminal output.
bunx vite "${VITE_ARGS[@]}" > >(tee "$FIFO_PATH") 2> >(tee "$FIFO_PATH" >&2)
