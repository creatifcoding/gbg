#!/usr/bin/env bash
# GetByShell GTK skin smoke.
#
# Non-mutating. Validates either active XDG GTK files or generated store files.
#
# Optional env:
#   TMNL_GTK_GENERATION=/nix/store/...       Inspect GTK files from built generation refs.
#   TMNL_DRIFTWM_GENERATION=/nix/store/...   Alias used by DriftWM cutover smokes.
#   TMNL_GTK3_SETTINGS=/path/settings.ini    Defaults to generated ref or $XDG_CONFIG_HOME/gtk-3.0/settings.ini
#   TMNL_GTK3_CSS=/path/gtk.css              Defaults to generated ref or $XDG_CONFIG_HOME/gtk-3.0/gtk.css
#   TMNL_GTK4_SETTINGS=/path/settings.ini    Defaults to generated ref or $XDG_CONFIG_HOME/gtk-4.0/settings.ini
#   TMNL_GTK4_CSS=/path/gtk.css              Defaults to generated ref or $XDG_CONFIG_HOME/gtk-4.0/gtk.css

set -euo pipefail

FAILURES=0
XDG_CONFIG_HOME_EFFECTIVE="${XDG_CONFIG_HOME:-$HOME/.config}"
GENERATION="${TMNL_GTK_GENERATION:-${TMNL_DRIFTWM_GENERATION:-}}"

first_ref() {
  local pattern="$1"
  printf '%s\n' "$REFS" | rg "$pattern" | head -1 || true
}

if [[ -n "$GENERATION" ]]; then
  GENERATION_RESOLVED="$(readlink -f "$GENERATION" 2>/dev/null || printf '%s' "$GENERATION")"
  if [[ -e "$GENERATION_RESOLVED" ]]; then
    REFS="$(nix-store -qR "$GENERATION_RESOLVED" 2>/tmp/tmnl-gtk-skin-generation-refs.err || true)"
  else
    REFS=""
  fi
else
  REFS=""
fi

GTK3_SETTINGS="${TMNL_GTK3_SETTINGS:-${REFS:+$(first_ref 'hm_gtk3\.0settings\.ini$')}}"
GTK3_CSS="${TMNL_GTK3_CSS:-${REFS:+$(first_ref 'hm_gtk3\.0gtk\.css$')}}"
GTK4_SETTINGS="${TMNL_GTK4_SETTINGS:-${REFS:+$(first_ref 'hm_gtk4\.0settings\.ini$')}}"
GTK4_CSS="${TMNL_GTK4_CSS:-${REFS:+$(first_ref 'hm_gtk4\.0gtk\.css$')}}"
GTK3_SETTINGS="${GTK3_SETTINGS:-$XDG_CONFIG_HOME_EFFECTIVE/gtk-3.0/settings.ini}"
GTK3_CSS="${GTK3_CSS:-$XDG_CONFIG_HOME_EFFECTIVE/gtk-3.0/gtk.css}"
GTK4_SETTINGS="${GTK4_SETTINGS:-$XDG_CONFIG_HOME_EFFECTIVE/gtk-4.0/settings.ini}"
GTK4_CSS="${GTK4_CSS:-$XDG_CONFIG_HOME_EFFECTIVE/gtk-4.0/gtk.css}"

log() {
  printf '[getbyshell-gtk-skin-smoke] %s\n' "$*"
}

pass() {
  log "PASS: $*"
}

fail() {
  log "FAIL: $*"
  FAILURES=$((FAILURES + 1))
}

require_file() {
  local path="$1"
  local label="$2"
  if [[ -r "$path" ]]; then
    pass "$label readable: $path -> $(readlink -f "$path" 2>/dev/null || printf '%s' "$path")"
  else
    fail "$label not readable: $path"
  fi
}

require_pattern() {
  local path="$1"
  local pattern="$2"
  local label="$3"
  if [[ -r "$path" ]] && grep -Fq "$pattern" "$path"; then
    pass "$label"
  else
    fail "missing pattern in $path: $pattern ($label)"
  fi
}

require_file "$GTK3_SETTINGS" "GTK3 settings"
require_file "$GTK3_CSS" "GTK3 CSS"
require_file "$GTK4_SETTINGS" "GTK4 settings"
require_file "$GTK4_CSS" "GTK4 CSS"

# Settings contracts generated from modules/home/gtk-skin.nix via Home Manager.
for settings in "$GTK3_SETTINGS" "$GTK4_SETTINGS"; do
  require_pattern "$settings" 'gtk-font-name=JetBrainsMono Nerd Font 12' "$(basename "$(dirname "$settings")") uses JetBrainsMono 12"
  require_pattern "$settings" 'gtk-cursor-theme-name=poe-theme' "$(basename "$(dirname "$settings")") uses poe cursor theme"
  require_pattern "$settings" 'gtk-cursor-theme-size=36' "$(basename "$(dirname "$settings")") uses cursor size 36"
  require_pattern "$settings" 'gtk-application-prefer-dark-theme=true' "$(basename "$(dirname "$settings")") prefers dark theme"
done
require_pattern "$GTK4_SETTINGS" 'gtk-interface-color-scheme=2' 'GTK4 advertises dark color scheme'

# Visual token contracts: these are the GetByShell brand colors, not arbitrary
# theme values. Keep the smoke focused on presence rather than complete CSS parse.
for css in "$GTK3_CSS" "$GTK4_CSS"; do
  require_pattern "$css" '#7ec8b0' "$(basename "$(dirname "$css")") includes phosphor focus color"
  require_pattern "$css" '#000000' "$(basename "$(dirname "$css")") includes void black background"
  require_pattern "$css" 'JetBrainsMono Nerd Font' "$(basename "$(dirname "$css")") includes brand monospace font"
  require_pattern "$css" 'outline: 2px solid #7ec8b0' "$(basename "$(dirname "$css")") includes focus outline"
done

if (( FAILURES > 0 )); then
  log "RESULT: failed with ${FAILURES} issue(s)"
  exit 1
fi

log "RESULT: ok"
