#!/usr/bin/env bash
set -euo pipefail

# TMNL Shell — systemd user service manager
#
# Usage:
#   ./scripts/shell-systemd.sh install   # symlink + reload + enable
#   ./scripts/shell-systemd.sh start     # start vite + shell
#   ./scripts/shell-systemd.sh stop      # stop both
#   ./scripts/shell-systemd.sh restart   # restart both
#   ./scripts/shell-systemd.sh logs      # journalctl -f for both
#   ./scripts/shell-systemd.sh status    # systemctl status for both
#   ./scripts/shell-systemd.sh uninstall # disable + remove symlinks

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SYSTEMD_DIR="${HOME}/.config/systemd/user"
UNIT_DIR="${PROJECT_DIR}/systemd"

ACTION="${1:-help}"

case "$ACTION" in
  install)
    mkdir -p "$SYSTEMD_DIR"
    ln -sf "${UNIT_DIR}/tmnl-shell-vite.service" "${SYSTEMD_DIR}/tmnl-shell-vite.service"
    ln -sf "${UNIT_DIR}/tmnl-shell.service" "${SYSTEMD_DIR}/tmnl-shell.service"
    systemctl --user daemon-reload
    systemctl --user enable tmnl-shell-vite.service tmnl-shell.service
    echo "✓ Installed. Run: $0 start"
    ;;

  start)
    systemctl --user start tmnl-shell-vite.service
    echo "Waiting for Vite on :1421..."
    for i in $(seq 1 30); do
      curl -s http://localhost:1421 > /dev/null 2>&1 && break
      sleep 0.5
    done
    systemctl --user start tmnl-shell.service
    echo "✓ Started. Logs: $0 logs"
    ;;

  stop)
    systemctl --user stop tmnl-shell.service 2>/dev/null || true
    systemctl --user stop tmnl-shell-vite.service 2>/dev/null || true
    echo "✓ Stopped"
    ;;

  restart)
    "$0" stop
    sleep 1
    "$0" start
    ;;

  logs)
    journalctl --user -u tmnl-shell -u tmnl-shell-vite -f --no-hostname
    ;;

  status)
    echo "═══ Vite ═══"
    systemctl --user status tmnl-shell-vite.service --no-pager 2>/dev/null || echo "(not running)"
    echo ""
    echo "═══ Shell ═══"
    systemctl --user status tmnl-shell.service --no-pager 2>/dev/null || echo "(not running)"
    ;;

  uninstall)
    systemctl --user disable tmnl-shell.service tmnl-shell-vite.service 2>/dev/null || true
    systemctl --user stop tmnl-shell.service tmnl-shell-vite.service 2>/dev/null || true
    rm -f "${SYSTEMD_DIR}/tmnl-shell-vite.service" "${SYSTEMD_DIR}/tmnl-shell.service"
    systemctl --user daemon-reload
    echo "✓ Uninstalled"
    ;;

  help|*)
    echo "Usage: $0 {install|start|stop|restart|logs|status|uninstall}"
    ;;
esac
