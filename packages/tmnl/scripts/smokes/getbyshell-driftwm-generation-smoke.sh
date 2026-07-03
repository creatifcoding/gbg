#!/usr/bin/env bash
# Validate a built NixOS generation for DriftWM/GetByShell cutover wiring.
#
# Non-mutating: inspects store artifacts only.
#
# Usage:
#   TMNL_DRIFTWM_GENERATION=/nix/store/...-nixos-system-getbyzenbook-... \
#     bash scripts/smokes/getbyshell-driftwm-generation-smoke.sh
#
# Or pass the generation as argv[1]. Defaults to /run/current-system for live
# post-switch inspection.

set -euo pipefail

GENERATION="${1:-${TMNL_DRIFTWM_GENERATION:-/run/current-system}}"
EXPECTED_CONFIG="${TMNL_DRIFTWM_EXPECTED_CONFIG:-/home/getbygenius/.config/nix/configs/driftwm/config.toml}"
EXPECTED_TMNL_PROJECT_DIR="${TMNL_DRIFTWM_EXPECTED_TMNL_PROJECT_DIR:-/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl}"
PANEL_DISABLED="${TMNL_DRIFTWM_PANEL_DISABLED:-1}"
FAILURES=0

log() {
  printf '[getbyshell-driftwm-generation-smoke] %s\n' "$*"
}

pass() {
  log "PASS: $*"
}

fail() {
  log "FAIL: $*"
  FAILURES=$((FAILURES + 1))
}

first_ref() {
  local pattern="$1"
  printf '%s\n' "$REFS" | rg "$pattern" | head -1 || true
}

last_ref() {
  local pattern="$1"
  printf '%s\n' "$REFS" | rg "$pattern" | tail -1 || true
}

require_file() {
  local path="$1"
  local label="$2"
  if [[ -e "$path" ]]; then
    pass "$label: $path -> $(readlink -f "$path" 2>/dev/null || printf '%s' "$path")"
  else
    fail "$label missing: $path"
  fi
}

require_pattern() {
  local path="$1"
  local pattern="$2"
  local label="$3"
  if [[ -r "$path" ]] && grep -Fq -- "$pattern" "$path"; then
    pass "$label"
  else
    fail "$label missing pattern '$pattern' in $path"
  fi
}

reject_pattern() {
  local path="$1"
  local pattern="$2"
  local label="$3"
  if [[ -r "$path" ]] && grep -Fq -- "$pattern" "$path"; then
    fail "$label unexpectedly found pattern '$pattern' in $path"
  else
    pass "$label"
  fi
}

if [[ ! -e "$GENERATION" ]]; then
  fail "generation does not exist: $GENERATION"
  log "RESULT: failed with ${FAILURES} issue(s)"
  exit 1
fi

GENERATION_RESOLVED="$(readlink -f "$GENERATION" 2>/dev/null || printf '%s' "$GENERATION")"
log "generation under test: $GENERATION_RESOLVED"

if ! REFS="$(nix-store -qR "$GENERATION_RESOLVED" 2>/tmp/tmnl-driftwm-generation-refs.err)"; then
  fail "nix-store -qR failed for $GENERATION_RESOLVED; see /tmp/tmnl-driftwm-generation-refs.err"
  log "RESULT: failed with ${FAILURES} issue(s)"
  exit 1
fi

DRIFT_CLOSURE="$(last_ref 'driftwm-[0-9][^/]*$')"
GREETD_TOML="$(last_ref 'greetd\.toml$')"
HM_PATH="$(last_ref 'home-manager-path$')"
HM_FILES="$(last_ref 'home-manager-files$')"
HM_SESSION="$(last_ref 'hm-session-vars\.sh$')"
BAR_UNIT_DIR="$(last_ref 'tmnl-bar\.service$')"
PANEL_UNIT_DIR="$(last_ref 'tmnl-panel\.service$')"

if [[ -n "$DRIFT_CLOSURE" && -x "$DRIFT_CLOSURE/bin/driftwm" ]]; then
  pass "patched DriftWM closure present: $DRIFT_CLOSURE"
else
  fail "patched DriftWM closure missing from generation refs"
fi

require_file "$GENERATION_RESOLVED/sw/bin/driftwm" "system profile driftwm"
require_file "$GENERATION_RESOLVED/sw/bin/driftwm-session" "system profile driftwm-session"
require_pattern "$GENERATION_RESOLVED/sw/bin/driftwm-session" 'exec "$SHELL" -l -c "$0 $@"' 'driftwm-session re-execs a login shell for profile environment'
require_file "$GENERATION_RESOLVED/sw/share/wayland-sessions/driftwm.desktop" "system profile driftwm.desktop"
require_pattern "$GENERATION_RESOLVED/sw/share/wayland-sessions/driftwm.desktop" 'driftwm-session' 'driftwm.desktop launches driftwm-session'
require_pattern "$GENERATION_RESOLVED/etc/set-environment" '$HOME/.nix-profile/bin' 'login environment includes home profile bin for DriftWM spawned helpers'
require_pattern "$GENERATION_RESOLVED/etc/set-environment" '/etc/profiles/per-user/$USER/bin' 'login environment includes per-user profile bin'
require_pattern "$GENERATION_RESOLVED/etc/set-environment" '/run/current-system/sw/bin' 'login environment includes system profile bin'
if [[ -r "$GENERATION_RESOLVED/etc/zshenv" ]]; then
  require_pattern "$GENERATION_RESOLVED/etc/zshenv" 'set-environment' 'zsh login shell sources NixOS environment'
fi

if [[ -n "$GREETD_TOML" ]]; then
  require_pattern "$GREETD_TOML" '--cmd driftwm-session' 'greetd defaults to driftwm-session'
  reject_pattern "$GREETD_TOML" '--remember-user-session' 'greetd does not preserve previous per-user compositor session'
else
  fail "greetd.toml missing from generation refs"
fi

if [[ -n "$HM_PATH" ]]; then
  if [[ -x "$HM_PATH/bin/driftwm-config" ]]; then
    pass "Home Manager path contains driftwm-config"
    helper_path="$(PATH="$HM_PATH/bin:$PATH" driftwm-config path 2>/tmp/tmnl-driftwm-config-path.err || true)"
    if [[ "$helper_path" == "$EXPECTED_CONFIG" ]]; then
      pass "driftwm-config path points at hotfixable config"
    else
      fail "driftwm-config path expected $EXPECTED_CONFIG, got ${helper_path:-<empty>}"
    fi
    if PATH="$HM_PATH/bin:$PATH" driftwm-config check >/tmp/tmnl-driftwm-config-generation-check.log 2>&1; then
      pass "driftwm-config check succeeds from generated HM path"
    else
      fail "driftwm-config check failed; see /tmp/tmnl-driftwm-config-generation-check.log"
    fi
  else
    fail "Home Manager path missing driftwm-config helper: $HM_PATH/bin/driftwm-config"
  fi

  if [[ -x "$HM_PATH/bin/driftwm-workspace" ]]; then
    pass "Home Manager path contains driftwm-workspace"
  else
    fail "Home Manager path missing driftwm-workspace helper: $HM_PATH/bin/driftwm-workspace"
  fi

  if [[ -x "$HM_PATH/bin/vicinae" ]]; then
    pass "Home Manager path contains vicinae launcher"
  else
    fail "Home Manager path missing vicinae launcher: $HM_PATH/bin/vicinae"
  fi
else
  fail "home-manager-path missing from generation refs"
fi

if [[ -n "$HM_FILES" ]]; then
  CONFIG_LINK="$HM_FILES/.config/driftwm/config.toml"
  require_file "$CONFIG_LINK" "Home Manager DriftWM config link"
  CONFIG_RESOLVED="$(readlink -f "$CONFIG_LINK" 2>/dev/null || true)"
  if [[ "$CONFIG_RESOLVED" == "$EXPECTED_CONFIG" ]]; then
    pass "Home Manager DriftWM config resolves to hotfixable TOML"
  else
    fail "Home Manager DriftWM config expected $EXPECTED_CONFIG, got ${CONFIG_RESOLVED:-<empty>}"
  fi
else
  fail "home-manager-files missing from generation refs"
fi

if [[ -n "$HM_SESSION" ]]; then
  SESSION_FILE="$HM_SESSION/etc/profile.d/hm-session-vars.sh"
  require_pattern "$SESSION_FILE" 'export XDG_CURRENT_DESKTOP="driftwm"' 'HM session vars set XDG_CURRENT_DESKTOP=driftwm'
  require_pattern "$SESSION_FILE" 'export XDG_SESSION_DESKTOP="driftwm"' 'HM session vars set XDG_SESSION_DESKTOP=driftwm'
  require_pattern "$SESSION_FILE" 'export XDG_SESSION_TYPE="wayland"' 'HM session vars set Wayland session type'
  require_pattern "$SESSION_FILE" 'export XCURSOR_SIZE="36"' 'HM session vars set cursor size 36'
else
  fail "hm-session-vars missing from generation refs"
fi

# Commands spawned by DriftWM autostart/keybindings that must resolve from the
# login-shell PATH inherited by driftwm-session. Vicinae and driftwm-workspace
# live in Home Manager; the rest are expected in the system profile.
for cmd in wlr-randr mako kitty emacsclient firefox pkill swaylock grim slurp wl-copy; do
  require_file "$GENERATION_RESOLVED/sw/bin/$cmd" "system profile spawned command $cmd"
done

UNIT_NAMES=(tmnl-bar)
if [[ "$PANEL_DISABLED" != "1" ]]; then
  UNIT_NAMES+=(tmnl-panel)
elif [[ -n "$PANEL_UNIT_DIR" ]]; then
  fail "panel is disabled but generated tmnl-panel.service is still present: $PANEL_UNIT_DIR"
else
  pass "panel disabled: no generated tmnl-panel.service in generation refs"
fi

for unit_name in "${UNIT_NAMES[@]}"; do
  case "$unit_name" in
    tmnl-bar) unit_dir="$BAR_UNIT_DIR" ;;
    tmnl-panel) unit_dir="$PANEL_UNIT_DIR" ;;
  esac
  unit_file="$unit_dir/${unit_name}.service"
  if [[ -n "$unit_dir" && -r "$unit_file" ]]; then
    require_pattern "$unit_file" 'Environment=TMNL_COMPOSITOR=driftwm' "$unit_name has TMNL_COMPOSITOR=driftwm"
    require_pattern "$unit_file" 'ConditionEnvironment=WAYLAND_DISPLAY' "$unit_name waits for Wayland session"
    require_pattern "$unit_file" 'Layer::Overlay' "$unit_name advertises Overlay layer"
    require_pattern "$unit_file" "WorkingDirectory=$EXPECTED_TMNL_PROJECT_DIR/" "$unit_name runs Tauri from live TMNL checkout"
    require_pattern "$unit_file" 'ExecStart=/nix/store/' "$unit_name ExecStart uses store-provided cargo-tauri"
    require_pattern "$unit_file" '/bin/cargo-tauri dev --config tauri.conf.json' "$unit_name launches cargo-tauri dev"
    reject_pattern "$unit_file" 'target/debug/tmnl-' "$unit_name does not pin a stale target/debug binary"
    reject_pattern "$unit_file" 'src-tauri/target' "$unit_name does not pin a stale Cargo target path"
    vite_unit_dir="$(last_ref "${unit_name}-vite\.service$")"
    vite_unit_file="$vite_unit_dir/${unit_name}-vite.service"
    if [[ -n "$vite_unit_dir" && -r "$vite_unit_file" ]]; then
      require_pattern "$vite_unit_file" "WorkingDirectory=$EXPECTED_TMNL_PROJECT_DIR" "$unit_name Vite runs from live TMNL checkout"
      require_pattern "$vite_unit_file" '/bin/bunx vite --config ' "$unit_name Vite launches bunx vite"
    else
      fail "$unit_name Vite generated unit missing from generation refs"
    fi
    if [[ -n "$DRIFT_CLOSURE" ]]; then
      require_pattern "$unit_file" "$DRIFT_CLOSURE/bin" "$unit_name PATH includes generated DriftWM CLI for IPC actions"
    else
      fail "$unit_name cannot verify DriftWM CLI PATH because DriftWM closure was not discovered"
    fi
  else
    fail "$unit_name generated unit missing from generation refs"
  fi
done

if [[ -r "$EXPECTED_CONFIG" ]]; then
  require_pattern "$EXPECTED_CONFIG" 'inactive_opacity = 0.0' 'runtime TOML hides inactive-output mirror cursor'
  require_pattern "$EXPECTED_CONFIG" 'min = 0.5' 'runtime TOML sets zoom min bound'
  require_pattern "$EXPECTED_CONFIG" 'max = 1.0' 'runtime TOML sets zoom max bound'
  require_pattern "$EXPECTED_CONFIG" 'border_color_focused = "#7ec8b0"' 'runtime TOML sets focused cyan border'
  require_pattern "$EXPECTED_CONFIG" 'autostart = ["/home/getbygenius/.config/nix/configs/driftwm/zenbook-wlrandr-layout.sh", "mako"]' 'runtime TOML autostarts hotfixable output helper'
  if [[ "$PANEL_DISABLED" == "1" ]]; then
    if grep -Eq '^[[:space:]]*"mod\+p"[[:space:]]=' "$EXPECTED_CONFIG"; then
      fail "runtime TOML has active Mod+P panel binding while panel is disabled"
    else
      pass "runtime TOML leaves Mod+P unbound while panel is disabled"
    fi
  else
    require_pattern "$EXPECTED_CONFIG" '"mod+p" = "spawn pkill -USR1 -f tmnl-panel$"' 'runtime TOML binds Mod+P to panel toggle'
  fi
else
  fail "expected runtime TOML not readable: $EXPECTED_CONFIG"
fi

LAYOUT_HELPER="/home/getbygenius/.config/nix/configs/driftwm/zenbook-wlrandr-layout.sh"
if [[ -x "$LAYOUT_HELPER" ]]; then
  pass "Zenbook output helper executable: $LAYOUT_HELPER"
else
  fail "Zenbook output helper missing or not executable: $LAYOUT_HELPER"
fi

if (( FAILURES > 0 )); then
  log "RESULT: failed with ${FAILURES} issue(s)"
  exit 1
fi

log "RESULT: ok"
