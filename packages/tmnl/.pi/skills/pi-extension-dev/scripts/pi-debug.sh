#!/usr/bin/env bash
#
# Pi Extension Debug Helper
# 
# Usage:
#   ./pi-debug.sh start [provider] [model]   Start debug session
#   ./pi-debug.sh stop                        Stop debug session
#   ./pi-debug.sh logs [pattern]              View/filter logs
#   ./pi-debug.sh watch [pattern]             Tail logs with filter
#   ./pi-debug.sh cycle [wait_secs]           Full restart cycle
#   ./pi-debug.sh status                      Check session status
#

set -euo pipefail

SESSION_NAME="pi-debug"
LOG_FILE="/tmp/pi-debug.log"
DEFAULT_PROVIDER="anthropic"
DEFAULT_MODEL="claude-sonnet-4-20250514"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info() { echo -e "${CYAN}[pi-debug]${NC} $1"; }
log_ok() { echo -e "${GREEN}[pi-debug]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[pi-debug]${NC} $1"; }
log_error() { echo -e "${RED}[pi-debug]${NC} $1"; }

cmd_start() {
  local provider="${1:-$DEFAULT_PROVIDER}"
  local model="${2:-$DEFAULT_MODEL}"
  
  # Kill existing session if any
  tmux kill-session -t "$SESSION_NAME" 2>/dev/null || true
  rm -f "$LOG_FILE"
  
  log_info "Starting pi debug session..."
  log_info "Provider: $provider"
  log_info "Model: $model"
  log_info "Log file: $LOG_FILE"
  
  tmux new-session -d -s "$SESSION_NAME" -c "$(pwd)"
  tmux send-keys -t "$SESSION_NAME" \
    "pi --provider $provider --model $model 2>&1 | tee $LOG_FILE" Enter
  
  log_ok "Session started. Use 'logs' or 'watch' to monitor."
}

cmd_stop() {
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    tmux kill-session -t "$SESSION_NAME"
    log_ok "Session stopped."
  else
    log_warn "No session running."
  fi
}

cmd_status() {
  if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    log_ok "Session is running."
    echo ""
    echo "Recent activity:"
    tail -5 "$LOG_FILE" 2>/dev/null | head -10 || echo "(no logs yet)"
  else
    log_warn "No session running."
  fi
}

cmd_logs() {
  local pattern="${1:-}"
  
  if [[ ! -f "$LOG_FILE" ]]; then
    log_error "No log file found at $LOG_FILE"
    exit 1
  fi
  
  if [[ -n "$pattern" ]]; then
    grep -E "$pattern" "$LOG_FILE" || log_warn "No matches for: $pattern"
  else
    cat "$LOG_FILE"
  fi
}

cmd_watch() {
  local pattern="${1:-}"
  
  log_info "Watching logs... (Ctrl+C to stop)"
  
  if [[ -n "$pattern" ]]; then
    tail -f "$LOG_FILE" 2>/dev/null | grep --line-buffered -E "$pattern"
  else
    tail -f "$LOG_FILE" 2>/dev/null
  fi
}

cmd_cycle() {
  local wait_secs="${1:-20}"
  
  log_info "Running full debug cycle (wait: ${wait_secs}s)..."
  
  cmd_stop
  sleep 1
  cmd_start
  
  log_info "Waiting ${wait_secs}s for startup..."
  sleep "$wait_secs"
  
  echo ""
  log_info "=== Extension Logs ==="
  grep -E "\[.*\]" "$LOG_FILE" 2>/dev/null | grep -v "^\[" || log_warn "No extension logs found"
  
  echo ""
  log_info "=== Errors ==="
  grep -iE "error|failed|timeout" "$LOG_FILE" 2>/dev/null || log_ok "No errors found"
}

cmd_help() {
  echo "Pi Extension Debug Helper"
  echo ""
  echo "Usage: $0 <command> [args]"
  echo ""
  echo "Commands:"
  echo "  start [provider] [model]   Start debug session"
  echo "  stop                       Stop debug session"
  echo "  status                     Check session status"
  echo "  logs [pattern]             View logs (optional grep pattern)"
  echo "  watch [pattern]            Tail logs (optional grep pattern)"
  echo "  cycle [wait_secs]          Full restart cycle (default: 20s)"
  echo ""
  echo "Examples:"
  echo "  $0 start                              # Start with defaults"
  echo "  $0 start anthropic claude-opus-4     # Start with specific model"
  echo "  $0 logs '\[mcp-bridge\]'              # Filter to mcp-bridge"
  echo "  $0 watch 'Connected|Failed'           # Watch connections"
  echo "  $0 cycle 30                           # Cycle with 30s wait"
}

# Main dispatch
case "${1:-help}" in
  start)  cmd_start "${2:-}" "${3:-}" ;;
  stop)   cmd_stop ;;
  status) cmd_status ;;
  logs)   cmd_logs "${2:-}" ;;
  watch)  cmd_watch "${2:-}" ;;
  cycle)  cmd_cycle "${2:-20}" ;;
  help|--help|-h) cmd_help ;;
  *)
    log_error "Unknown command: $1"
    cmd_help
    exit 1
    ;;
esac
