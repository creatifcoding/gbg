#!/bin/bash
# window-manager.sh — runs at each scheduled window (default 07:00 and 11:00).
# Announces the window, guarantees a minimum window (GRACE), then STAYS AWAKE while the
# machine is in use and sleeps ~IDLE_GUARD_SECONDS after your last activity. Uses forced
# `pmset sleepnow` (overrides the UA Cloud Helper keep-awake assertion); scheduled RTC wake
# is reliable, on-demand Wi-Fi WoL is not, so we lean on scheduled windows.
#
# Sleep is cancelled/deferred while: veto file present, console recently used, or an ssh
# session is active. A single-instance lock stops the 07:00 and 11:00 runs from overlapping.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
CONF="${GBG_NOTIFY_ENV:-/etc/gbg-morning/notify.env}"
# shellcheck disable=SC1090
[ -f "$CONF" ] && . "$CONF"

LOG="${LOG_FILE:-/var/log/gbg-morning.log}"
WINDOWS="${WINDOWS:-07:00 11:00}"
GRACE="${GRACE_SECONDS:-900}"            # guaranteed minimum window (15 min)
IDLE_MIN="${IDLE_GUARD_SECONDS:-180}"    # sleep once idle >= this (after the window)
POLL="${POLL_SECONDS:-60}"              # idle re-check cadence
MAX_HOLD="${MAX_AWAKE_SECONDS:-21600}"  # 6h safety cap for a forgotten session
VETO_FILE="${VETO_FILE:-/tmp/gbg-no-sleep}"
LOCKDIR="${LOCK_DIR:-/tmp/gbg-window.lock.d}"
log(){ echo "$(date '+%Y-%m-%dT%H:%M:%S') window: $*" >> "$LOG" 2>/dev/null || true; }

# --- single-instance lock (macOS has no flock; atomic mkdir) ---
if ! mkdir "$LOCKDIR" 2>/dev/null; then
  age=$(( $(date +%s) - $(stat -f %m "$LOCKDIR" 2>/dev/null || echo "$(date +%s)") ))
  if [ "$age" -gt $((MAX_HOLD + 3600)) ]; then
    log "stale lock (${age}s) — reclaiming"; rmdir "$LOCKDIR" 2>/dev/null
    mkdir "$LOCKDIR" 2>/dev/null || { log "lock reclaim failed — exiting"; exit 0; }
  else
    log "another window instance active — exiting"; exit 0
  fi
fi
trap 'rmdir "$LOCKDIR" 2>/dev/null' EXIT

idle_s(){ local ns; ns="$(ioreg -c IOHIDSystem 2>/dev/null | awk '/HIDIdleTime/{print $NF; exit}')"; echo $(( ${ns:-0} / 1000000000 )); }
ssh_active(){ who | grep -q ttys; }

log "window opened"
"$DIR/notify.sh" "Mac mini window open" \
  "Awake at $(date '+%H:%M'). Stays up while you're on it; sleeps ~$((IDLE_MIN/60)) min after you stop." "high"

sleep "$GRACE"    # guaranteed minimum window

start=$(date +%s)
while true; do
  if [ -f "$VETO_FILE" ]; then
    log "veto present — staying awake today"
    "$DIR/notify.sh" "Mac mini staying awake" "Veto file ${VETO_FILE} present." "default"
    exit 0
  fi
  i="$(idle_s)"
  if ! ssh_active && [ "$i" -ge "$IDLE_MIN" ]; then
    log "idle ${i}s >= ${IDLE_MIN}s — sleeping"; break
  fi
  if [ $(( $(date +%s) - start )) -ge "$MAX_HOLD" ]; then
    log "MAX_HOLD ${MAX_HOLD}s reached — sleeping despite activity"
    "$DIR/notify.sh" "Mac mini sleeping (cap)" "Awake ${MAX_HOLD}s; sleeping to save power. Wake it in the next window." "default"
    break
  fi
  sleep "$POLL"
done

# arm next window today (if any), then sleep
now=$((10#$(date +%H%M))); next=""
for w in $WINDOWS; do wm=$((10#${w//:/})); [ "$wm" -gt "$now" ] && { next="$w"; break; }; done
if [ -n "$next" ]; then
  /usr/bin/pmset schedule wake "$(date '+%m/%d/%Y') ${next}:00" >> "$LOG" 2>&1
  log "armed next wake today ${next}"; msg="Sleeping. Next window ${next}."
else
  log "no later window today; daily 07:00 wake covers tomorrow"; msg="Sleeping. Next window ~07:00 tomorrow."
fi
"$DIR/notify.sh" "Mac mini sleeping" "$msg" "default"
/usr/bin/pmset sleepnow >> "$LOG" 2>&1
