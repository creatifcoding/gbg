#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AVA_DIR="${ROOT_DIR}/ava-elixir"
REPORT_DIR="${AVA_DIR}/reports/phase_c"

TARGET_VIEW_ID="${TARGET_VIEW_ID:-f762-rollout-target}"
TARGET_VIEW_COUNT="${TARGET_VIEW_COUNT:-6}"
NON_TARGET_VIEW_COUNT="${NON_TARGET_VIEW_COUNT:-4}"

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; exit 1; }

run_logged() {
  local label="$1"
  local logfile="$2"
  shift 2

  echo "[run] ${label}"
  if "$@" >"${logfile}" 2>&1; then
    pass "${label}"
  else
    cat "${logfile}"
    fail "${label}"
  fi
}

mkdir -p "${REPORT_DIR}"
cd "${AVA_DIR}"

echo "[phase-c] starting rollback + signoff drill"
echo "[phase-c] target_view_id=${TARGET_VIEW_ID}"

run_logged \
  "c1) controlled switch to phoenix_fallback continuity check" \
  "${REPORT_DIR}/01_rollback_sidecar_continuity.log" \
  env AVA_RUNTIME_MODE=phoenix_fallback mix test test/sidecar_mode_test.exs

run_logged \
  "c2) targeted redrive for affected view_id cohort" \
  "${REPORT_DIR}/02_targeted_redrive_cohort.log" \
  env TARGET_VIEW_ID="${TARGET_VIEW_ID}" TARGET_VIEW_COUNT="${TARGET_VIEW_COUNT}" NON_TARGET_VIEW_COUNT="${NON_TARGET_VIEW_COUNT}" mix run scripts/targeted_redrive_cohort.exs

echo "[phase-c] completed ✅"
echo "[phase-c] logs:"
printf '  - %s\n' \
  "${REPORT_DIR}/01_rollback_sidecar_continuity.log" \
  "${REPORT_DIR}/02_targeted_redrive_cohort.log"
