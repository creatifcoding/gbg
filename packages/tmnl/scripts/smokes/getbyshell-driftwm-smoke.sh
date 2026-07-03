#!/usr/bin/env bash
# GetByShell × DriftWM post-switch smoke.
#
# Non-mutating: does not restart DriftWM or TMNL services. Intended to run after
# a NixOS switch/relogin when the patched DriftWM binary should be live.
#
# Optional env:
#   TMNL_DRIFTWM_BIN=/nix/store/.../bin/driftwm           DriftWM binary used for config validation.
#   TMNL_DRIFTWM_CONFIG=/nix/store/.../config.toml        Config under test; defaults to active ~/.config/driftwm/config.toml.
#   TMNL_DRIFTWM_OFFLINE=1                                Pre-activation mode: validate config/contracts, skip live session checks.
#   TMNL_DRIFTWM_EXPECTED_BIN=/nix/store/.../bin/driftwm  Require exact running binary in live mode.
#   TMNL_DRIFTWM_JOURNAL_SINCE='30 minutes ago'           Bar DOM journal window.
#   TMNL_DRIFTWM_PANEL_JOURNAL_SINCE='30 minutes ago'     Panel panic journal window.
#   TMNL_DRIFTWM_REQUIRE_DOM_REPORT=1                     Fail if no recent bar DOM_REPORT.
#   TMNL_DRIFTWM_REQUIRE_SERVICE_ENV=1                    Fail if active TMNL units' runtime env lacks TMNL_COMPOSITOR=driftwm.
#   TMNL_DRIFTWM_SKIP_OUTPUT_CHECK=1                      Skip live eDP scale/position check.
#   TMNL_DRIFTWM_SCREENSHOT=1                             Capture left rail with grim.
#   TMNL_DRIFTWM_SCREENSHOT_OUT=/tmp/foo.png              Screenshot output path.

set -euo pipefail

JOURNAL_SINCE="${TMNL_DRIFTWM_JOURNAL_SINCE:-4 hours ago}"
EXPECTED_BIN="${TMNL_DRIFTWM_EXPECTED_BIN:-}"
DRIFTWM_BIN="${TMNL_DRIFTWM_BIN:-driftwm}"
CONFIG="${TMNL_DRIFTWM_CONFIG:-${XDG_CONFIG_HOME:-$HOME/.config}/driftwm/config.toml}"
OFFLINE="${TMNL_DRIFTWM_OFFLINE:-0}"
PANEL_DISABLED="${TMNL_DRIFTWM_PANEL_DISABLED:-1}"
FAILURES=0

log() {
  printf '[getbyshell-driftwm-smoke] %s\n' "$*"
}

pass() {
  log "PASS: $*"
}

fail() {
  log "FAIL: $*"
  FAILURES=$((FAILURES + 1))
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "missing required command: $1"
    return 1
  fi
}

require_cmd systemctl || true
require_cmd journalctl || true
if [[ "$DRIFTWM_BIN" == "driftwm" ]]; then
  require_cmd driftwm || true
elif [[ ! -x "$DRIFTWM_BIN" ]]; then
  fail "TMNL_DRIFTWM_BIN is not executable: $DRIFTWM_BIN"
fi
require_cmd python3 || true

check_signal_target() {
  local label="$1"
  local regex="$2"
  mapfile -t matches < <(pgrep -af -- "$regex" || true)
  case "${#matches[@]}" in
    0)
      fail "$label signal target has no process match for regex: $regex"
      ;;
    1)
      pass "$label signal target matches one process: ${matches[0]}"
      ;;
    *)
      fail "$label signal target is ambiguous for regex '$regex': ${matches[*]}"
      ;;
  esac
}

log "checking DriftWM config under test"
if [[ -r "$CONFIG" ]] && DRIFTWM_CONFIG="$CONFIG" "$DRIFTWM_BIN" --check-config >/tmp/tmnl-driftwm-check-config.log 2>&1; then
  pass "driftwm --check-config: $CONFIG"
else
  fail "driftwm --check-config failed for $CONFIG; see /tmp/tmnl-driftwm-check-config.log"
fi

if [[ -r "$CONFIG" ]]; then
  pass "config readable: $CONFIG -> $(readlink -f "$CONFIG" 2>/dev/null || printf '%s' "$CONFIG")"
  declare -A REQUIRED_CONFIG_PATTERNS=(
    ['"trackpad-scroll" = "none"']='bare trackpad scroll disabled'
    ['"wheel-scroll" = "none"']='bare wheel scroll disabled'
    ['"mod+trackpad-scroll" = "zoom"']='Mod+trackpad zoom enabled'
    ['"mod+wheel-scroll" = "zoom"']='Mod+wheel zoom enabled'
    ['"mod+return" = "center-window"']='Mod+Return remains center-window'
    ['inactive_opacity = 0.0']='inactive-output mirror cursor hidden'
    ['min = 0.5']='zoom lower bound set'
    ['max = 1.0']='zoom upper bound set'
    ['border_width = 2']='focused-window border enabled'
    ['border_color_focused = "#7ec8b0"']='focused-window cyan highlight configured'
    ['"mod+1" = "spawn driftwm-workspace focus 1"']='spatial workspace focus helper bound'
    ['"mod+shift+1" = "spawn driftwm-workspace move 1"']='spatial workspace move helper bound'
    ['"mod+space" = "spawn pkill -USR1 -f tmnl-shell$"']='command palette signal targets tmnl-shell executable name'
    ['"ctrl+semicolon" = "spawn pkill -USR1 -f tmnl-shell$"']='alternate palette signal targets tmnl-shell executable name'
  )
  for pattern in "${!REQUIRED_CONFIG_PATTERNS[@]}"; do
    if grep -Fq "$pattern" "$CONFIG"; then
      pass "${REQUIRED_CONFIG_PATTERNS[$pattern]}"
    else
      fail "missing config contract: $pattern (${REQUIRED_CONFIG_PATTERNS[$pattern]})"
    fi
  done

  if [[ "$PANEL_DISABLED" == "1" ]]; then
    if grep -Eq '^[[:space:]]*"mod\+p"[[:space:]]=' "$CONFIG"; then
      fail "panel is disabled but Mod+P still has an active binding in $CONFIG"
    else
      pass "panel disabled: Mod+P has no active tmnl-panel binding"
    fi
  elif grep -Fq '"mod+p" = "spawn pkill -USR1 -f tmnl-panel$"' "$CONFIG"; then
    pass "panel toggle signal targets tmnl-panel executable name"
  else
    fail "missing config contract: Mod+P panel toggle signal target"
  fi

  LAYOUT_HELPER="$(CONFIG="$CONFIG" python3 - <<'PY'
import os
import sys
try:
    import tomllib
except ModuleNotFoundError:
    print('')
    sys.exit(0)

try:
    with open(os.environ['CONFIG'], 'rb') as handle:
        data = tomllib.load(handle)
except Exception:
    print('')
    sys.exit(0)

for entry in data.get('autostart', []):
    if isinstance(entry, str) and entry.endswith('zenbook-wlrandr-layout.sh'):
        print(entry)
        break
PY
  )"
  if [[ -n "$LAYOUT_HELPER" && -x "$LAYOUT_HELPER" ]]; then
    pass "Zenbook output-layout autostart helper executable: $LAYOUT_HELPER"
  else
    fail "Zenbook output-layout autostart helper missing or not executable: ${LAYOUT_HELPER:-<not found in autostart>}"
  fi
else
  fail "config not readable: $CONFIG"
fi

if [[ "$OFFLINE" == "1" ]]; then
  if (( FAILURES > 0 )); then
    log "RESULT: offline preflight failed with ${FAILURES} issue(s)"
    exit 1
  fi
  log "RESULT: offline preflight ok"
  exit 0
fi

log "checking running DriftWM binary"
mapfile -t DRIFT_PIDS < <(pgrep -x driftwm || true)
if (( ${#DRIFT_PIDS[@]} == 0 )); then
  fail "no running driftwm process found"
elif (( ${#DRIFT_PIDS[@]} > 1 )); then
  fail "multiple driftwm processes found: ${DRIFT_PIDS[*]}"
else
  PID="${DRIFT_PIDS[0]}"
  RUNNING_BIN="$(readlink -f "/proc/${PID}/exe" 2>/dev/null || true)"
  pass "running driftwm pid=${PID} bin=${RUNNING_BIN}"

  if [[ -n "$EXPECTED_BIN" ]]; then
    EXPECTED_RESOLVED="$(readlink -f "$EXPECTED_BIN" 2>/dev/null || printf '%s' "$EXPECTED_BIN")"
    if [[ "$RUNNING_BIN" == "$EXPECTED_RESOLVED" ]]; then
      pass "running DriftWM matches TMNL_DRIFTWM_EXPECTED_BIN"
    else
      fail "running DriftWM mismatch: expected ${EXPECTED_RESOLVED}, got ${RUNNING_BIN}"
    fi
  elif [[ -e /run/current-system/sw/bin/driftwm ]]; then
    CURRENT_BIN="$(readlink -f /run/current-system/sw/bin/driftwm)"
    if [[ "$RUNNING_BIN" == "$CURRENT_BIN" ]]; then
      pass "running DriftWM matches /run/current-system/sw/bin/driftwm"
    else
      fail "running DriftWM mismatch: current-system=${CURRENT_BIN}, running=${RUNNING_BIN}"
    fi
  else
    log "WARN: no expected binary provided and /run/current-system/sw/bin/driftwm missing"
  fi
fi

log "checking live DriftWM output scale/layout"
if [[ "${TMNL_DRIFTWM_SKIP_OUTPUT_CHECK:-0}" == "1" ]]; then
  log "WARN: live output scale/layout check skipped by TMNL_DRIFTWM_SKIP_OUTPUT_CHECK=1"
elif command -v wlr-randr >/dev/null 2>&1; then
  WLR_RANDR_OUTPUT="$(wlr-randr)" python3 - <<'PY' || FAILURES=$((FAILURES + 1))
import os
import re
import sys

raw = os.environ.get('WLR_RANDR_OUTPUT', '')
expected = {
    'eDP-1': {'pos': '0,0', 'scale': 1.0},
    'eDP-2': {'pos': '0,1800', 'scale': 1.0},
}
outputs: dict[str, dict[str, str | float]] = {}
current: str | None = None
for line in raw.splitlines():
    if line and not line.startswith(' '):
        current = line.split()[0]
        outputs[current] = {}
        continue
    if current is None:
        continue
    stripped = line.strip()
    if stripped.startswith('Position:'):
        outputs[current]['pos'] = stripped.split(':', 1)[1].strip()
    elif stripped.startswith('Scale:'):
        try:
            outputs[current]['scale'] = float(stripped.split(':', 1)[1].strip())
        except ValueError:
            outputs[current]['scale'] = stripped.split(':', 1)[1].strip()
    elif 'current' in stripped and '2880x1800' in stripped:
        outputs[current]['mode'] = '2880x1800'

problems = []
for name, want in expected.items():
    got = outputs.get(name)
    if not got:
        problems.append(f'{name} missing')
        continue
    if got.get('pos') != want['pos']:
        problems.append(f"{name} position expected {want['pos']}, got {got.get('pos')}")
    if abs(float(got.get('scale', 0)) - float(want['scale'])) > 0.001:
        problems.append(f"{name} scale expected {want['scale']}, got {got.get('scale')}")
    if got.get('mode') != '2880x1800':
        problems.append(f"{name} current mode expected 2880x1800, got {got.get('mode')}")

if problems:
    print('[getbyshell-driftwm-smoke] FAIL: live output scale/layout mismatch: ' + '; '.join(problems))
    sys.exit(1)
print('[getbyshell-driftwm-smoke] PASS: live output scale/layout sane')
PY
else
  log "WARN: wlr-randr unavailable; cannot verify live output scale/layout"
fi

log "checking TMNL user services"
UNITS=(tmnl-bar.service)
if [[ "$PANEL_DISABLED" != "1" ]]; then
  UNITS+=(tmnl-panel.service)
fi
for unit in "${UNITS[@]}"; do
  if systemctl --user -q is-active "$unit"; then
    pass "$unit active"
  else
    fail "$unit not active"
  fi

  UNIT_ENV="$(systemctl --user show "$unit" -p Environment --value 2>/dev/null || true)"
  if grep -Fq 'TMNL_COMPOSITOR=driftwm' <<<"$UNIT_ENV"; then
    pass "$unit active runtime env has TMNL_COMPOSITOR=driftwm"
  elif [[ "${TMNL_DRIFTWM_REQUIRE_SERVICE_ENV:-0}" == "1" ]]; then
    fail "$unit active runtime env missing TMNL_COMPOSITOR=driftwm"
  else
    log "WARN: $unit active runtime env missing TMNL_COMPOSITOR=driftwm; set TMNL_DRIFTWM_REQUIRE_SERVICE_ENV=1 to make this fatal after switch/restart"
  fi
done

if [[ "$PANEL_DISABLED" == "1" ]]; then
  if systemctl --user -q is-active tmnl-panel.service; then
    fail "panel is disabled but tmnl-panel.service is still active"
  else
    pass "panel disabled: tmnl-panel.service inactive"
  fi
fi

log "checking GetByShell signal process targets"
check_signal_target "command palette" 'tmnl-shell$'
if [[ "$PANEL_DISABLED" != "1" ]]; then
  check_signal_target "panel toggle" 'tmnl-panel$'
fi

log "checking DriftWM IPC and state-file coherence"
STATE_JSON="$(driftwm msg --json state 2>/tmp/tmnl-driftwm-msg-state.err || true)"
CAMERA_JSON="$(driftwm msg --json camera 2>/tmp/tmnl-driftwm-msg-camera.err || true)"
STATE_FILE="${XDG_RUNTIME_DIR:-/run/user/$(id -u)}/driftwm/state"
STATE_JSON="$STATE_JSON" CAMERA_JSON="$CAMERA_JSON" STATE_FILE="$STATE_FILE" python3 - <<'PY' || FAILURES=$((FAILURES + 1))
import json
import os
import sys
from pathlib import Path

state_raw = os.environ.get('STATE_JSON', '')
camera_raw = os.environ.get('CAMERA_JSON', '')
state_file = Path(os.environ.get('STATE_FILE', ''))

def fail(message: str) -> None:
    print(f"[getbyshell-driftwm-smoke] FAIL: {message}")
    sys.exit(1)

try:
    state_payload = json.loads(state_raw)
    camera_payload = json.loads(camera_raw)
except Exception as exc:
    fail(f"could not parse driftwm msg JSON: {exc}")

try:
    state = state_payload['Ok']['State']
    msg_camera = camera_payload['Ok']['Camera']
    state_camera = state['camera']
except Exception as exc:
    fail(f"unexpected driftwm msg shape: {exc}")

if len(state_camera) != 2:
    fail(f"state camera should have two coordinates: {state_camera!r}")

sx, sy = float(state_camera[0]), float(state_camera[1])
cx, cy = float(msg_camera['x']), float(msg_camera['y'])
if abs(sx - cx) > 0.01 or abs(sy - cy) > 0.01:
    fail(f"driftwm msg state camera {state_camera!r} disagrees with msg camera {(cx, cy)!r}")

if not state_file.is_file():
    fail(f"state file missing: {state_file}")

kv: dict[str, str] = {}
for line in state_file.read_text().splitlines():
    if '=' in line:
        key, value = line.split('=', 1)
        kv[key] = value

try:
    fx = float(kv['x'])
    fy = float(kv['y'])
    fz = float(kv['zoom'])
except Exception as exc:
    fail(f"state file missing x/y/zoom: {exc}")

if abs(fx - sx) > 1.0 or abs(fy - sy) > 1.0:
    fail(f"state file camera {(fx, fy)!r} disagrees with IPC state camera {(sx, sy)!r}")
if abs(fz - float(state.get('zoom', 0))) > 0.005:
    fail(f"state file zoom {fz!r} disagrees with IPC zoom {state.get('zoom')!r}")

layers = [part.strip() for part in kv.get('layers', '').split(',') if part.strip()]
if 'tmnl-shell' not in layers:
    fail(f"state file layers do not include tmnl-shell: {layers!r}")

print('[getbyshell-driftwm-smoke] PASS: DriftWM IPC/state-file coherence sane')
PY

if [[ "$PANEL_DISABLED" == "1" ]]; then
  pass "panel disabled: skipping tmnl-panel journal checks"
else
  PANEL_JOURNAL_SINCE="${TMNL_DRIFTWM_PANEL_JOURNAL_SINCE:-}"
  if [[ -z "$PANEL_JOURNAL_SINCE" ]]; then
    PANEL_JOURNAL_SINCE="$(systemctl --user show tmnl-panel.service -p ActiveEnterTimestamp --value 2>/dev/null || true)"
  fi
  if [[ -z "$PANEL_JOURNAL_SINCE" || "$PANEL_JOURNAL_SINCE" == "n/a" ]]; then
    PANEL_JOURNAL_SINCE="$JOURNAL_SINCE"
  fi

  log "checking tmnl-panel journal for duplicate webview panic since ${PANEL_JOURNAL_SINCE}"
  if journalctl --user -u tmnl-panel.service --since "$PANEL_JOURNAL_SINCE" --no-hostname --no-pager \
    | grep -E 'a webview with label panel already exists|panicked' >/tmp/tmnl-panel-driftwm-smoke-errors.log; then
    fail "tmnl-panel recent panic/duplicate-label evidence; see /tmp/tmnl-panel-driftwm-smoke-errors.log"
  else
    pass "tmnl-panel has no current-run duplicate-label panic"
  fi
fi

log "checking last tmnl-bar DOM_REPORT marker geometry"
DOM_LINE="$(journalctl --user -u tmnl-bar.service --since "$JOURNAL_SINCE" --no-hostname --no-pager \
  | grep 'DOM_REPORT ' \
  | tail -n 1 || true)"

if [[ -z "$DOM_LINE" ]]; then
  if [[ "${TMNL_DRIFTWM_REQUIRE_DOM_REPORT:-0}" == "1" ]]; then
    fail "no recent tmnl-bar DOM_REPORT found"
  else
    log "WARN: no recent tmnl-bar DOM_REPORT found; set TMNL_DRIFTWM_REQUIRE_DOM_REPORT=1 to make this fatal"
  fi
else
  DOM_LINE="$DOM_LINE" python3 - <<'PY' || FAILURES=$((FAILURES + 1))
import json
import os
import sys

line = os.environ.get('DOM_LINE', '')
try:
    payload = line.split('DOM_REPORT ', 1)[1]
    report = json.loads(payload)
except Exception as exc:
    print(f"[getbyshell-driftwm-smoke] FAIL: could not parse DOM_REPORT: {exc}")
    sys.exit(1)

markers = {m.get('label'): m for m in report.get('markers', [])}
missing = [label for label in ('T', 'C', 'B') if label not in markers]
if missing:
    print(f"[getbyshell-driftwm-smoke] FAIL: missing markers: {missing}")
    sys.exit(1)

problems = []
for label in ('T', 'C', 'B'):
    rect = markers[label].get('rect') or {}
    width = float(rect.get('width') or 0)
    height = float(rect.get('height') or 0)
    x = float(rect.get('x') or 0)
    if not (12 <= width <= 64 and 12 <= height <= 64 and 0 <= x <= 48):
        problems.append((label, rect))

viewport = report.get('viewport') or {}
outer_width = abs(float(viewport.get('outerWidth') or 0))
if outer_width and not (40 <= outer_width <= 96):
    problems.append(('outerWidth', viewport))

if problems:
    print(f"[getbyshell-driftwm-smoke] FAIL: suspicious marker/viewport geometry: {problems}")
    sys.exit(1)

print('[getbyshell-driftwm-smoke] PASS: DOM_REPORT marker geometry sane')
PY
fi

if [[ "${TMNL_DRIFTWM_SCREENSHOT:-0}" == "1" ]]; then
  OUT="${TMNL_DRIFTWM_SCREENSHOT_OUT:-/tmp/tmnl-driftwm-bar-smoke-$(date +%s).png}"
  if command -v grim >/dev/null 2>&1; then
    if grim -g '0,0 96x1080' "$OUT"; then
      pass "captured left rail screenshot: $OUT"
    else
      fail "grim screenshot failed"
    fi
  else
    fail "TMNL_DRIFTWM_SCREENSHOT=1 but grim is unavailable"
  fi
fi

if (( FAILURES > 0 )); then
  log "RESULT: failed with ${FAILURES} issue(s)"
  exit 1
fi

log "RESULT: ok"
