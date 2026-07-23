#!/bin/bash
# install.sh — remote reachability for the gbg Mac mini over Tailscale.
#   sudo ./install.sh   (then run the printed `tailscale up` line once to authenticate)
#
# Installs: Tailscale system daemon (reconnects before login / on every wake),
# Tailscale SSH, macOS Screen Sharing (VNC :5900), and the herdr server LaunchAgent.
#
# NOTE: Aligned with the sleep-window model — it does NOT force the mini to stay awake.
# The mini is reachable while awake (during a window, or whenever a guard keeps it up)
# and asleep between windows by design. Tailscale reconnects automatically on each wake.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo ./install.sh" >&2; exit 1; }
SRC="$(cd "$(dirname "$0")" && pwd)"

REAL_USER="${SUDO_USER:-$(stat -f%Su /dev/console)}"
USER_HOME="$(dscl . -read "/Users/${REAL_USER}" NFSHomeDirectory | awk '{print $2}')"
USER_UID="$(id -u "${REAL_USER}")"
run_user(){ sudo -u "${REAL_USER}" bash -lc "$*"; }

echo "==> Tailscale CLI (open-source tailscaled variant)"
if ! run_user 'command -v tailscale >/dev/null'; then
  run_user 'brew install tailscale'
fi

echo "==> tailscaled as a system daemon"
tailscaled install-system-daemon 2>/dev/null || echo "   (already installed)"

echo "==> Network stays answering while awake + reconnects on wake"
pmset -a womp 1 powernap 1 tcpkeepalive 1

echo "==> Screen Sharing (VNC :5900, auths against your macOS login)"
launchctl enable system/com.apple.screensharing || true
launchctl bootstrap system /System/Library/LaunchDaemons/com.apple.screensharing.plist 2>/dev/null || true

echo "==> herdr server LaunchAgent (per-user)"
if run_user 'command -v herdr >/dev/null'; then
  HERDR_BIN="$(run_user 'command -v herdr')"
  AGENT="${USER_HOME}/Library/LaunchAgents/dev.herdr.server.plist"
  run_user "mkdir -p '${USER_HOME}/Library/LaunchAgents' '${USER_HOME}/.config/herdr'"
  sed -e "s|__HERDR_BIN__|${HERDR_BIN}|" -e "s|__HOME__|${USER_HOME}|g" \
      "${SRC}/launchd/dev.herdr.server.plist" > "${AGENT}"
  chown "${REAL_USER}" "${AGENT}"
  run_user "launchctl bootout gui/${USER_UID} '${AGENT}' 2>/dev/null || true"
  run_user "launchctl bootstrap gui/${USER_UID} '${AGENT}'"
  echo "   herdr server agent loaded"
else
  echo "   herdr not found for ${REAL_USER} — skipping (install: brew install herdr)"
fi

echo
echo "DONE. -----------------------------------------------------"
echo "ONE manual step — authenticate Tailscale (opens a browser once):"
echo "    sudo tailscale up --ssh --accept-routes"
echo "Then grab the address:  tailscale ip -4"
echo
echo "Reach the mini while it is awake (in a window):"
echo "    ssh ${REAL_USER}@<tailscale-ip>        # terminal / herdr"
echo "    herdr --remote ${REAL_USER}@<tailscale-ip>"
echo "    Screen Sharing.app -> vnc://<tailscale-ip>   # GUI"
