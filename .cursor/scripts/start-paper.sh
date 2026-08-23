#!/usr/bin/env bash
# Cursor Cloud: start paper-mcp (headless MCP). No board window. No open file.
# MCP is http://127.0.0.1:29979/mcp. It has no cookie session and 401s without a bearer.
# Agents need a Paper bearer (env/secret), not Desktop Google cookies. This does not invent a token.
# If Paper exits, the failure is logged and the agent continues.
set -u

LOG="${PAPER_LOG:-/tmp/paper-mcp.log}"
MCP_URL="http://127.0.0.1:29979/mcp"
export PATH="/usr/local/bin:${HOME}/.local/bin:${PATH}"

mcp_listening() {
  # GET may be 401 (no bearer) or 404. Any HTTP status means the port is bound.
  local code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "${MCP_URL}" 2>/dev/null || true)"
  [[ "${code}" =~ ^[1-5][0-9][0-9]$ ]]
}

if mcp_listening; then
  echo "start-paper: headless MCP already listening at ${MCP_URL}"
  exit 0
fi

if ! command -v paper-mcp >/dev/null 2>&1; then
  echo "start-paper: paper-mcp is not on PATH; skip" | tee -a "${LOG}"
  exit 0
fi

if pgrep -x Paper.AppImage >/dev/null 2>&1; then
  echo "start-paper: Paper.AppImage already running"
  exit 0
fi

nohup paper-mcp >>"${LOG}" 2>&1 &
paper_pid=$!
disown "${paper_pid}" 2>/dev/null || true
echo "start-paper: launched paper-mcp pid ${paper_pid} log ${LOG}"

i=0
while [[ "${i}" -lt 60 ]]; do
  if mcp_listening; then
    echo "start-paper: headless MCP listening at ${MCP_URL} (401 without a Paper bearer is expected; not Desktop cookies)"
    exit 0
  fi
  if ! kill -0 "${paper_pid}" 2>/dev/null; then
    echo "start-paper: paper-mcp exited before MCP listened; see ${LOG}" | tee -a "${LOG}"
    exit 0
  fi
  i=$((i + 1))
  sleep 1
done

echo "start-paper: paper-mcp is up but MCP is not listening yet at ${MCP_URL}; see ${LOG}"
exit 0
