#!/bin/bash
# uninstall.sh — full rollback.  sudo ./uninstall.sh
set -uo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo ./uninstall.sh" >&2; exit 1; }
D=/Library/LaunchDaemons

for p in com.gbg.morning.boot-notify com.gbg.morning.window; do
  launchctl bootout system "$D/$p.plist" 2>/dev/null || true
  rm -f "$D/$p.plist"
  echo "removed $p"
done

pmset repeat cancel
pmset schedule cancelall 2>/dev/null || true
echo "cleared pmset wake schedule"
rm -rf /usr/local/lib/gbg-morning
echo "removed /usr/local/lib/gbg-morning"
echo
echo "Left in place (remove manually if desired):"
echo "  /etc/gbg-morning/notify.env   (ntfy topic / SMTP creds)"
echo "  /var/log/gbg-morning.log"
echo "  pmset autorestart (harmless; clear with: sudo pmset -a autorestart 0)"
