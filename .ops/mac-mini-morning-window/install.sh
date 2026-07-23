#!/bin/bash
# install.sh — the SINGLE privileged touchpoint.  sudo ./install.sh
# Schedules the 07:00 wake, installs scripts + LaunchDaemons, generates a private
# ntfy topic. Reversible via uninstall.sh. Only touches gbg-morning namespaced files.
set -euo pipefail

[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo ./install.sh" >&2; exit 1; }
SRC="$(cd "$(dirname "$0")" && pwd)"
LIB=/usr/local/lib/gbg-morning
ETC=/etc/gbg-morning
DAEMONS=/Library/LaunchDaemons
LOG=/var/log/gbg-morning.log

echo "==> Daily wake at 07:00 (from sleep OR full shutdown)"
pmset repeat wakeorpoweron MTWRFSU 07:00:00
pmset -a autorestart 1          # auto-boot after a power blip too

echo "==> Installing scripts to $LIB"
install -d -m 755 "$LIB"
install -m 755 "$SRC/notify.sh" "$SRC/boot-notify.sh" "$SRC/window-manager.sh" "$LIB/"

echo "==> Config at $ETC/notify.env"
install -d -m 700 "$ETC"
if [ ! -f "$ETC/notify.env" ]; then
  TOPIC="gbg-$(openssl rand -hex 12)"
  sed "s|CHANGEME-long-random-topic|${TOPIC}|" "$SRC/notify.env.template" > "$ETC/notify.env"
  chmod 600 "$ETC/notify.env"
  echo "    Generated ntfy topic: ${TOPIC}"
else
  echo "    Keeping existing $ETC/notify.env"
fi

touch "$LOG"; chmod 644 "$LOG"

echo "==> Installing + loading LaunchDaemons"
for p in com.gbg.morning.boot-notify com.gbg.morning.window; do
  install -m 644 -o root -g wheel "$SRC/launchd/$p.plist" "$DAEMONS/$p.plist"
  launchctl bootout system "$DAEMONS/$p.plist" 2>/dev/null || true
  launchctl bootstrap system "$DAEMONS/$p.plist"
  echo "    loaded $p"
done

echo
echo "DONE. -----------------------------------------------------"
grep '^NTFY_TOPIC' "$ETC/notify.env"
echo "iPhone: install the 'ntfy' app, tap +, subscribe to that exact topic."
echo "(A test 'Mac mini booted' push just fired via boot-notify RunAtLoad.)"
echo
echo "Schedule:"; pmset -g sched
echo "Cancel any day's auto-sleep with:  touch /tmp/gbg-no-sleep"
