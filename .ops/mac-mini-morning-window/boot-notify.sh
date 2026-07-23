#!/bin/bash
# boot-notify.sh — fires only on an actual cold boot (RunAtLoad). Normal sleep/wake
# days are announced by the window job, not this. Covers power-failure recovery.
set -uo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/notify.sh" \
  "Mac mini booted" \
  "Cold boot at $(date '+%a %b %-d, %H:%M'). Reachable over Tailscale." \
  "high"
