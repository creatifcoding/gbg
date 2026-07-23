#!/bin/bash
# notify.sh — push via ntfy (primary) + optional email over ANY SMTP relay
# (Gmail app-password, openship, etc). Usage: notify.sh "Title" "Body" [priority]
# Config: /etc/gbg-morning/notify.env  (override with GBG_NOTIFY_ENV)
set -uo pipefail

CONF="${GBG_NOTIFY_ENV:-/etc/gbg-morning/notify.env}"
# shellcheck disable=SC1090
[ -f "$CONF" ] && . "$CONF"

TITLE="${1:-Mac mini}"
BODY="${2:-notification}"
PRIORITY="${3:-default}"
LOG="${LOG_FILE:-/var/log/gbg-morning.log}"
log(){ echo "$(date '+%Y-%m-%dT%H:%M:%S') notify: $*" >> "$LOG" 2>/dev/null || true; }

# --- ntfy push (primary) ---
if [ -n "${NTFY_TOPIC:-}" ]; then
  if curl -sS --max-time 15 -H "Title: ${TITLE}" -H "Priority: ${PRIORITY}" \
        -d "${BODY}" "${NTFY_SERVER:-https://ntfy.sh}/${NTFY_TOPIC}" >/dev/null; then
    log "ntfy ok: ${TITLE}"
  else
    log "ntfy FAILED: ${TITLE}"
  fi
fi

# --- email over any SMTP (optional) ---
if [ -n "${SMTP_URL:-}" ] && [ -n "${MAIL_TO:-}" ] && [ -n "${MAIL_FROM:-}" ]; then
  MSG="$(mktemp)"
  {
    echo "From: ${MAIL_FROM}"; echo "To: ${MAIL_TO}"; echo "Subject: ${TITLE}"
    echo; echo "${BODY}"; echo; echo "-- $(hostname) $(date)"
  } > "$MSG"
  if curl -sS --max-time 30 --url "${SMTP_URL}" --ssl-reqd \
        ${SMTP_USER:+--user "${SMTP_USER}:${SMTP_PASS:-}"} \
        --mail-from "${MAIL_FROM}" --mail-rcpt "${MAIL_TO}" -T "$MSG" >/dev/null 2>&1; then
    log "email ok: ${MAIL_TO}"
  else
    log "email FAILED: ${MAIL_TO}"
  fi
  rm -f "$MSG"
fi
