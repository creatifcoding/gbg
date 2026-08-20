# Isolated worktree/run directories for the Mantis lab environment.
# Sourced by narrow Nix shells. The Python CLI applies the same layout to
# subprocesses and does not treat a user home profile as authority.

if [[ -z "${MANTIS_LAB_ROOT:-}" ]]; then
  return 0 2>/dev/null || exit 0
fi

_mantis_lab="$(cd "$MANTIS_LAB_ROOT" && pwd -P)"
_mantis_ident="$(printf '%s' "$_mantis_lab" | sha256sum | awk '{print substr($1,1,16)}')"
_mantis_run="${MANTIS_RUN_ID:-interactive}"

if [[ -z "${MANTIS_ISOLATION_ROOT:-}" ]]; then
  export MANTIS_ISOLATION_ROOT="/tmp/mantis-lab/${_mantis_ident}/${_mantis_run}"
fi

mkdir -p \
  "$MANTIS_ISOLATION_ROOT/build" \
  "$MANTIS_ISOLATION_ROOT/cargo-target" \
  "$MANTIS_ISOLATION_ROOT/result" \
  "$MANTIS_ISOLATION_ROOT/browser" \
  "$MANTIS_ISOLATION_ROOT/cache" \
  "$MANTIS_ISOLATION_ROOT/solver-temp"

export MANTIS_BUILD_DIR="$MANTIS_ISOLATION_ROOT/build"
export MANTIS_RESULT_DIR="$MANTIS_ISOLATION_ROOT/result"
export MANTIS_BROWSER_DIR="$MANTIS_ISOLATION_ROOT/browser"
export MANTIS_CACHE_DIR="$MANTIS_ISOLATION_ROOT/cache"
export MANTIS_SOLVER_TEMP="$MANTIS_ISOLATION_ROOT/solver-temp"
export CARGO_TARGET_DIR="$MANTIS_ISOLATION_ROOT/cargo-target"
export CARGO_HOME="$MANTIS_ISOLATION_ROOT/cache/cargo"
export npm_config_cache="$MANTIS_ISOLATION_ROOT/cache/npm"
export npm_config_offline="${npm_config_offline:-true}"
export BUN_INSTALL_CACHE_DIR="$MANTIS_ISOLATION_ROOT/cache/bun"
export XDG_CACHE_HOME="$MANTIS_ISOLATION_ROOT/cache/xdg"
export TMPDIR="$MANTIS_ISOLATION_ROOT/solver-temp"
export PLAYWRIGHT_BROWSERS_PATH="$MANTIS_ISOLATION_ROOT/browser"
export PYTHONPYCACHEPREFIX="$MANTIS_ISOLATION_ROOT/cache/pycache"
export PYTHONNOUSERSITE=1
export PIP_NO_INDEX=1
export CARGO_NET_OFFLINE="${CARGO_NET_OFFLINE:-true}"
export FREECAD_USER_HOME="$MANTIS_ISOLATION_ROOT/cache/freecad"
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"

unset _mantis_lab _mantis_ident _mantis_run
