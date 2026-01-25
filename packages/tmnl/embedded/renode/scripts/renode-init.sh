#!/usr/bin/env bash
set -euo pipefail

SESSION=${TMNL_RENODE_SESSION:-tmnl-renode}
RENODE_BIN=${TMNL_RENODE_BIN:-renode}
RENODE_SCRIPT=${TMNL_RENODE_SCRIPT:-embedded/renode/nrf52840/nrf52840-telemetry.resc}
UART_PORT=${TMNL_RENODE_UART_PORT:-5501}
MONITOR_ADDR=${TMNL_RENODE_MONITOR_ADDR:-127.0.0.1:1234}
MONITOR_HOST=${MONITOR_ADDR%:*}
MONITOR_PORT=${MONITOR_ADDR##*:}

if tmux has-session -t "$SESSION" 2>/dev/null; then
  tmux kill-session -t "$SESSION"
fi

tmux new-session -d -s "$SESSION" "$RENODE_BIN" --disable-gui -e "\$uartPort=$UART_PORT; i @$RENODE_SCRIPT"
tmux new-window -t "$SESSION" -n uart "nc 127.0.0.1 $UART_PORT"
tmux new-window -t "$SESSION" -n console "nc $MONITOR_HOST $MONITOR_PORT"
tmux select-window -t "$SESSION":uart

echo "[renode-init] session: $SESSION"
echo "[renode-init] script: $RENODE_SCRIPT"
echo "[renode-init] uart: 127.0.0.1:$UART_PORT"
echo "[renode-init] monitor: $MONITOR_HOST:$MONITOR_PORT"
