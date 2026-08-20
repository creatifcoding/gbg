#!/usr/bin/env bash
# Shared helpers for mantis environment commands (issue #21).
# shellcheck shell=bash

set -euo pipefail

mantis_env_init() {
  local script_dir root lab key
  script_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  # scripts/environment -> lab root
  lab="$(cd "$script_dir/../.." && pwd)"
  if root="$(git -C "$lab" rev-parse --show-toplevel 2>/dev/null)"; then
    :
  else
    root="$(cd "$lab/../../../.." && pwd)"
  fi
  export MANTIS_GBG_ROOT="$root"
  export MANTIS_LAB_ROOT="$lab"
  export MANTIS_ENV_SCRIPTS="$lab/scripts/environment"
  export MANTIS_ENV_FIXTURES="$MANTIS_ENV_SCRIPTS/fixtures"
  key="$(printf '%s' "$root" | sha256sum | cut -c1-16)"
  export MANTIS_WORKTREE_ID="$key"
  export MANTIS_STATE_DIR="$root/.worktree-state/mantis-$key"
  export MANTIS_BUILD_DIR="${MANTIS_BUILD_DIR:-$MANTIS_STATE_DIR/build}"
  export CARGO_TARGET_DIR="${CARGO_TARGET_DIR:-$MANTIS_STATE_DIR/cargo-target}"
  export MANTIS_SOLVER_TEMP="${MANTIS_SOLVER_TEMP:-$MANTIS_STATE_DIR/solver-temp}"
  export MANTIS_RESULT_DIR="${MANTIS_RESULT_DIR:-$MANTIS_STATE_DIR/results}"
  export MANTIS_DOCTOR_DIR="$MANTIS_STATE_DIR/doctor"
  mkdir -p "$MANTIS_BUILD_DIR" "$CARGO_TARGET_DIR" "$MANTIS_SOLVER_TEMP" "$MANTIS_RESULT_DIR" "$MANTIS_DOCTOR_DIR"
  export PYTHONPATH="$MANTIS_LAB_ROOT/tooling/python/mantis-lab/src${PYTHONPATH:+:$PYTHONPATH}"
}

mantis_fail() {
  # Non-mutating failure: message names owning workstream; never repairs sources.
  local workstream="$1"
  shift
  printf 'FAIL workstream=%s issue_hint=%s\n' "$workstream" "$*" >&2
  printf '%s\n' "$@" >&2
  return 1
}

mantis_require_cmd() {
  local cmd="$1"
  local workstream="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    mantis_fail "$workstream" "BLOCKED: missing executable '$cmd' (enter the matching mantis-* Nix shell)"
  fi
}

mantis_git_sha() {
  git -C "${MANTIS_GBG_ROOT:-.}" rev-parse HEAD 2>/dev/null || echo "unknown"
}

mantis_sha256_file() {
  sha256sum "$1" | awk '{print $1}'
}
