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

HARNESS_WS_PID=""

# Cleanup function
cleanup() {
  echo "[tmnl] Cleaning up FIFO..."
  rm -f "$FIFO_PATH"

  if [ -n "$HARNESS_WS_PID" ]; then
    kill "$HARNESS_WS_PID" 2>/dev/null || true
  fi

  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# Detect WSLg and apply WebKitGTK compositing workaround
if [ -n "$WSL_DISTRO_NAME" ]; then
  echo "[WSLg detected] Setting WEBKIT_DISABLE_COMPOSITING_MODE=1"
  export WEBKIT_DISABLE_COMPOSITING_MODE=1
fi

HARNESS_WS_HEALTH_URL="http://127.0.0.1:8787/health"

harness_ws_health_ok() {
  local payload
  payload=$(curl -fsS --max-time 2 "$HARNESS_WS_HEALTH_URL" 2>/dev/null || true)
  echo "$payload" | grep -q '"service":"harness-remote-ws"'
}

# Ensure harness remote WS server is available
if harness_ws_health_ok; then
  echo "[tmnl] harness remote WS already running on :8787"
else
  echo "[tmnl] starting harness remote WS on :8787..."
  bun run harness:remote-ws >/tmp/tmnl/harness-remote-ws.log 2>&1 &
  HARNESS_WS_PID=$!

  for _ in $(seq 1 80); do
    if harness_ws_health_ok; then
      echo "[tmnl] harness remote WS ready"
      break
    fi

    if ! kill -0 "$HARNESS_WS_PID" 2>/dev/null; then
      echo "[tmnl] harness remote WS process exited early"
      break
    fi

    sleep 0.25
  done

  if ! harness_ws_health_ok; then
    echo "[tmnl] failed to start harness remote WS (see /tmp/tmnl/harness-remote-ws.log)"
    tail -n 80 /tmp/tmnl/harness-remote-ws.log 2>/dev/null || true
    exit 1
  fi
fi

# Start a background process to keep FIFO open and write to log
cat > "$LOG_PATH" < "$FIFO_PATH" &

# Run Vite dev server
# --force avoids stale optimized-deps cache issues in long-lived Tauri/WebView sessions
# Stderr is tee'd to both terminal and FIFO
bunx vite --force 2> >(tee "$FIFO_PATH" >&2)
