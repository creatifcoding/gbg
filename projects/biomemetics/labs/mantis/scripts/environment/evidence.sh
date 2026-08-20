#!/usr/bin/env bash
# Inspect a doctor/evidence run id under the worktree state dir (issue #21).
# shellcheck shell=bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
mantis_env_init

RUN="${1:?run id required}"

resolve() {
  local cand
  for cand in \
    "$MANTIS_DOCTOR_DIR/$RUN" \
    "$MANTIS_DOCTOR_DIR/doctor-$RUN.json" \
    "$MANTIS_DOCTOR_DIR/run-$RUN" \
    "$MANTIS_RESULT_DIR/$RUN" \
    "$RUN"; do
    if [ -e "$cand" ]; then
      printf '%s\n' "$cand"
      return 0
    fi
  done
  return 1
}

if ! path="$(resolve)"; then
  echo "FAIL workstream=mantis-00a-runtime" >&2
  echo "BLOCKED: evidence/doctor run not found: $RUN" >&2
  echo "looked under $MANTIS_DOCTOR_DIR and $MANTIS_RESULT_DIR" >&2
  exit 1
fi

echo "evidence.run=$path"
if [ -f "$path" ] && [[ "$path" == *.json ]]; then
  if command -v jq >/dev/null 2>&1; then
    jq '{schema,timestamp,gitSha,digest,summary}' "$path"
  else
    cat "$path"
  fi
  if [ -f "$path.sha256" ]; then
    echo -n "digest.file: "
    cat "$path.sha256"
    actual="$(sha256sum "$path" | awk '{print $1}')"
    expected="$(awk '{print $1}' "$path.sha256")"
    if [ "$actual" != "$expected" ]; then
      echo "FAIL workstream=mantis-00a-runtime: report digest mismatch (non-mutating)" >&2
      exit 1
    fi
    echo "digest.verify=ok"
  fi
elif [ -d "$path" ]; then
  find "$path" -maxdepth 2 -type f | sort
fi
