#!/usr/bin/env bash
set -euo pipefail

FILE="native/ava_bridge/src/lib.rs"

if [[ ! -f "$FILE" ]]; then
  echo "missing $FILE" >&2
  exit 1
fi

assert_pattern() {
  local pattern="$1"
  local message="$2"

  if ! perl -0777 -ne "exit((/$pattern/s) ? 0 : 1)" "$FILE"; then
    echo "[nif-schedule] $message" >&2
    exit 1
  fi
}

# DirtyCpu-required functions (JSON parse / registry mutation)
assert_pattern '#\[rustler::nif\(schedule = "DirtyCpu"\)\]\s*fn\s+register_spec_json\b' \
  'register_spec_json must be DirtyCpu'
assert_pattern '#\[rustler::nif\(schedule = "DirtyCpu"\)\]\s*fn\s+invalidate_view\b' \
  'invalidate_view must be DirtyCpu'

# Normal scheduler fast-path functions
assert_pattern '#\[rustler::nif\]\s*fn\s+runtime_ping\b' \
  'runtime_ping must remain normal scheduler'
assert_pattern '#\[rustler::nif\]\s*fn\s+get_spec_json\b' \
  'get_spec_json must remain normal scheduler'
assert_pattern '#\[rustler::nif\]\s*fn\s+list_specs\b' \
  'list_specs must remain normal scheduler'
assert_pattern '#\[rustler::nif\]\s*fn\s+subscribe_view\b' \
  'subscribe_view must remain normal scheduler'
assert_pattern '#\[rustler::nif\]\s*fn\s+unsubscribe\b' \
  'unsubscribe must remain normal scheduler'
assert_pattern '#\[rustler::nif\]\s*fn\s+list_subscriptions\b' \
  'list_subscriptions must remain normal scheduler'

echo "[nif-schedule] policy checks passed"
