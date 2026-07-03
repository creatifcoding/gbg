#!/usr/bin/env bash
# GetByShell × DriftWM pre-activation validation bundle.
#
# Non-mutating: does not run nixos-rebuild switch, restart/reload DriftWM,
# signal TMNL services, or modify live compositor state.
#
# Optional env:
#   TMNL_DRIFTWM_GENERATION=/nix/store/...     Built generation to inspect. If omitted, derive via nix build --no-link.
#   TMNL_DRIFTWM_NIX_FLAKE=/path#attr          Flake attr to build when generation is omitted.
#   TMNL_DRIFTWM_NIX_CONFIG_REPO=/path         Nix config git repo to check for indexed flake inputs.
#   TMNL_DRIFTWM_SKIP_NIX_INDEX_CHECK=1        Skip git-index visibility guard.
#   TMNL_DRIFTWM_BIN=/nix/store/.../driftwm    DriftWM binary for --check-config.
#   TMNL_DRIFTWM_CONFIG=/path/config.toml      Runtime config under test.
#   CARGO_TARGET_DIR=/tmp/...                  Isolated cargo target dir.

set -euo pipefail

log() {
  printf '[getbyshell-driftwm-preactivation] %s\n' "$*"
}

run() {
  log "RUN: $*"
  "$@"
}

run_env() {
  log "RUN: $*"
  env "$@"
}

check_nix_indexed_sources() {
  if [[ "${TMNL_DRIFTWM_SKIP_NIX_INDEX_CHECK:-0}" == "1" ]]; then
    log "WARN: skipping Nix git-index visibility guard"
    return 0
  fi

  local repo="${TMNL_DRIFTWM_NIX_CONFIG_REPO:-/home/getbygenius/.config/nix}"
  if ! git -C "$repo" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    log "FAIL: Nix config path is not a git worktree: $repo"
    return 1
  fi

  local missing=0
  local required_paths=(
    flake.nix
    hosts/getbyzenbook.nix
    modules/home/driftwm.nix
    modules/home/getbygenius.nix
    modules/home/getbyshell/default.nix
    modules/home/getbyshell/lib/shared-env.nix
    modules/home/gtk-skin.nix
    modules/nixos/greetd.nix
    modules/nixos/desktop.nix
    modules/nixos/packages.nix
    patches/driftwm-pinned-window-cull.patch
    patches/driftwm-zoom-bounds.patch
    configs/driftwm/config.toml
    configs/driftwm/zenbook-wlrandr-layout.sh
    configs/driftwm/README.md
  )

  log "checking Nix flake source visibility in git index: $repo"
  for path in "${required_paths[@]}"; do
    if git -C "$repo" ls-files --error-unmatch "$path" >/dev/null 2>&1; then
      log "PASS: indexed Nix source $path"
    else
      log "FAIL: Nix source not tracked/indexed for flake snapshot: $repo/$path"
      missing=$((missing + 1))
    fi
  done

  if (( missing > 0 )); then
    return 1
  fi
}

check_nix_indexed_sources

if [[ -n "${TMNL_DRIFTWM_GENERATION:-}" ]]; then
  GENERATION="$TMNL_DRIFTWM_GENERATION"
else
  NIX_FLAKE_ATTR="${TMNL_DRIFTWM_NIX_FLAKE:-/home/getbygenius/.config/nix#nixosConfigurations.getbyzenbook.config.system.build.toplevel}"
  log "deriving inactive generation with nix build --no-link: $NIX_FLAKE_ATTR"
  GENERATION="$(nix build "$NIX_FLAKE_ATTR" --no-link --print-out-paths | tail -n 1)"
fi

CONFIG="${TMNL_DRIFTWM_CONFIG:-/home/getbygenius/.config/nix/configs/driftwm/config.toml}"
CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-/tmp/tmnl-cutover-cargo-target}"
DRIFTWM_BIN="${TMNL_DRIFTWM_BIN:-$GENERATION/sw/bin/driftwm}"

if [[ ! -e "$GENERATION" ]]; then
  log "FAIL: generation does not exist: $GENERATION"
  exit 1
fi

if [[ ! -x "$DRIFTWM_BIN" ]]; then
  log "FAIL: DriftWM binary not executable: $DRIFTWM_BIN"
  exit 1
fi

if [[ ! -r "$CONFIG" ]]; then
  log "FAIL: DriftWM config not readable: $CONFIG"
  exit 1
fi

log "generation: $(readlink -f "$GENERATION" 2>/dev/null || printf '%s' "$GENERATION")"
log "driftwm bin: $(readlink -f "$DRIFTWM_BIN" 2>/dev/null || printf '%s' "$DRIFTWM_BIN")"
log "config: $(readlink -f "$CONFIG" 2>/dev/null || printf '%s' "$CONFIG")"
log "cargo target dir: $CARGO_TARGET_DIR"

run_env TMNL_DRIFTWM_GENERATION="$GENERATION" \
  bash scripts/smokes/getbyshell-driftwm-generation-smoke.sh

run_env TMNL_DRIFTWM_OFFLINE=1 \
  TMNL_DRIFTWM_BIN="$DRIFTWM_BIN" \
  TMNL_DRIFTWM_CONFIG="$CONFIG" \
  bash scripts/smokes/getbyshell-driftwm-smoke.sh

run_env TMNL_DRIFTWM_GENERATION="$GENERATION" \
  bash scripts/smokes/getbyshell-gtk-skin-smoke.sh

run bun run --silent tsc --noEmit --pretty false
run_env CARGO_TARGET_DIR="$CARGO_TARGET_DIR" cargo test -p tmnl-shared -- --nocapture
run_env CARGO_TARGET_DIR="$CARGO_TARGET_DIR" cargo check -p tmnl-shell -p tmnl-panel

run bash -n \
  scripts/smokes/getbyshell-driftwm-smoke.sh \
  scripts/smokes/getbyshell-driftwm-generation-smoke.sh \
  scripts/smokes/getbyshell-gtk-skin-smoke.sh \
  scripts/smokes/getbyshell-driftwm-preactivation-smoke.sh \
  /home/getbygenius/.config/nix/configs/driftwm/zenbook-wlrandr-layout.sh

run python3 -m json.tool package.json >/tmp/tmnl-package-json-check.json
run python3 -m json.tool project.json >/tmp/tmnl-project-json-check.json

run git diff --check -- \
  src-shared/src/driftwm.rs \
  scripts/smokes/getbyshell-driftwm-smoke.sh \
  scripts/smokes/getbyshell-driftwm-generation-smoke.sh \
  scripts/smokes/getbyshell-gtk-skin-smoke.sh \
  scripts/smokes/getbyshell-driftwm-preactivation-smoke.sh \
  handoff/driftwm-cutover-review.md \
  handoff/driftwm-cutover-runbook.md \
  .pi/agents/driftwm-cutover-reviewer-glm52.md \
  package.json \
  project.json

run git diff --quiet -- \
  src-shared/src/niri.rs \
  src/lib/getbyshell/niri.ts \
  src/lib/getbyshell/types.ts

log "RESULT: ok"
