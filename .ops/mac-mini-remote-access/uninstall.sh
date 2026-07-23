#!/bin/bash
# uninstall.sh — remove remote-access setup.  sudo ./uninstall.sh
set -uo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Run with sudo: sudo ./uninstall.sh" >&2; exit 1; }
REAL_USER="${SUDO_USER:-$(stat -f%Su /dev/console)}"
USER_HOME="$(dscl . -read "/Users/${REAL_USER}" NFSHomeDirectory | awk '{print $2}')"
USER_UID="$(id -u "${REAL_USER}")"

AGENT="${USER_HOME}/Library/LaunchAgents/dev.herdr.server.plist"
sudo -u "${REAL_USER}" launchctl bootout "gui/${USER_UID}" "${AGENT}" 2>/dev/null || true
rm -f "${AGENT}"; echo "removed herdr LaunchAgent"

launchctl bootout system /System/Library/LaunchDaemons/com.apple.screensharing.plist 2>/dev/null || true
launchctl disable system/com.apple.screensharing 2>/dev/null || true
echo "disabled Screen Sharing"

echo "Tailscale left installed. To fully remove:"
echo "    sudo tailscale down && sudo tailscaled uninstall-system-daemon && brew uninstall tailscale"
