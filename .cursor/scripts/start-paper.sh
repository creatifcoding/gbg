#!/usr/bin/env bash
# Cursor Cloud: start Xvfb if DISPLAY is unset, then start Paper so MCP can listen.
# Paper MCP is http://127.0.0.1:29979/mcp. A missing session is logged; this does not fail the agent.
# Sign-in is a one-time environment/snapshot step; this script does not fake a session.
set -u

LOG="${PAPER_LOG:-/tmp/paper-desktop.log}"
MCP_URL="http://127.0.0.1:29979/mcp"
export PATH="/usr/local/bin:${HOME}/.local/bin:${PATH}"

mcp_up() {
  curl -sf --max-time 2 "${MCP_URL}" >/dev/null 2>&1
}

if mcp_up; then
  echo "start-paper: MCP already listening at ${MCP_URL}"
  exit 0
fi

if [[ -z "${DISPLAY:-}" ]]; then
  export DISPLAY=:99
  if ! pgrep -x Xvfb >/dev/null 2>&1; then
    if ! command -v Xvfb >/dev/null 2>&1; then
      echo "start-paper: Xvfb is not installed; Paper not started" | tee -a "${LOG}"
      exit 0
    fi
    Xvfb :99 -screen 0 1920x1080x24 >/tmp/xvfb-paper.log 2>&1 &
    sleep 0.5
  fi
fi

if ! command -v paper >/dev/null 2>&1; then
  echo "start-paper: paper is not on PATH; skip" | tee -a "${LOG}"
  exit 0
fi

if pgrep -f 'Paper.AppImage' >/dev/null 2>&1; then
  echo "start-paper: Paper.AppImage already running"
  exit 0
fi

nohup paper >>"${LOG}" 2>&1 &
paper_pid=$!
disown "${paper_pid}" 2>/dev/null || true
echo "start-paper: launched paper pid ${paper_pid} (DISPLAY=${DISPLAY}) log ${LOG}"

i=0
while [[ "${i}" -lt 5 ]]; do
  if mcp_up; then
    echo "start-paper: MCP listening at ${MCP_URL}"
    exit 0
  fi
  if ! kill -0 "${paper_pid}" 2>/dev/null; then
    echo "start-paper: Paper exited before MCP listened; see ${LOG}" | tee -a "${LOG}"
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done

echo "start-paper: Paper is up but MCP is not answering yet at ${MCP_URL} (needs a signed-in Desktop with a file open)"
exit 0
