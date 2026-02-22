#!/usr/bin/env bash
# Questionnaire extension debug session
# Usage:
#   ./questionnaire-debug.sh start   — launch pi in tmux, open kitty watcher
#   ./questionnaire-debug.sh logs    — tail the log
#   ./questionnaire-debug.sh stop    — kill tmux session
#   ./questionnaire-debug.sh cycle   — stop → start

set -euo pipefail

SESSION="pi-questionnaire"
PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
LOG="/tmp/pi-questionnaire-debug.log"

start() {
  # Kill existing session
  tmux kill-session -t "$SESSION" 2>/dev/null || true
  > "$LOG"  # truncate log

  # Start pi in tmux
  tmux new-session -d -s "$SESSION" -c "$PROJECT_DIR" \
    -x 120 -y 40

  tmux send-keys -t "$SESSION" \
    "pi --provider anthropic --model claude-sonnet-4-20250514 2>&1 | tee $LOG" Enter

  echo "✓ tmux session '$SESSION' started"
  echo "  Log: $LOG"
  echo ""
  echo "  Attach:  tmux attach -t $SESSION"
  echo "  Logs:    tail -f $LOG"
  echo ""

  # Open kitty watcher window (niri-compatible)
  if command -v kitty &>/dev/null; then
    kitty --title "pi-questionnaire-logs" -e bash -c "
      echo '═══ Questionnaire Debug Watcher ═══'
      echo 'Watching: $LOG'
      echo ''
      tail -f $LOG | grep --line-buffered -E '\\[questionnaire\\]|questionnaire|survey|Error|error'
    " &
    echo "✓ kitty watcher window opened"
  else
    echo "⚠ kitty not found — use: tail -f $LOG"
  fi
}

logs() {
  tail -f "$LOG" | grep --line-buffered -E '\[questionnaire\]|questionnaire|survey|Error|error'
}

stop() {
  tmux kill-session -t "$SESSION" 2>/dev/null && echo "✓ session stopped" || echo "no session running"
}

cycle() {
  stop
  sleep 0.5
  start
}

case "${1:-start}" in
  start) start ;;
  logs)  logs ;;
  stop)  stop ;;
  cycle) cycle ;;
  *)     echo "Usage: $0 {start|logs|stop|cycle}" ;;
esac
