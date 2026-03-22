#!/usr/bin/env bash
set -euo pipefail

SESSION=${TMNL_RENODE_SESSION:-tmnl-renode}
WINDOW=${TMNL_RENODE_TARGET_WINDOW:-console}

if [[ $# -eq 0 ]]; then
  echo "Usage: renode-send-keys.sh [--window name] <command> [command...]" >&2
  exit 1
fi

if [[ "${1:-}" == "--window" ]]; then
  if [[ $# -lt 3 ]]; then
    echo "Usage: renode-send-keys.sh [--window name] <command> [command...]" >&2
    exit 1
  fi
  WINDOW="$2"
  shift 2
fi

if ! tmux has-session -t "$SESSION" 2>/dev/null; then
  echo "[renode-send-keys] tmux session not found: $SESSION" >&2
  exit 1
fi

for command in "$@"; do
  tmux send-keys -t "$SESSION:$WINDOW" "$command" C-m
done
