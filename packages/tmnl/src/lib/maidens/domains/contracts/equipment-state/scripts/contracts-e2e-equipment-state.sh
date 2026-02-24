#!/usr/bin/env bash
set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../../../../.." && pwd)"
ELIXIR_DIR="$PROJECT_ROOT/src/lib/maidens/domains/contracts/equipment-state/elixir"
SCHEMA_DIR="$PROJECT_ROOT/src/lib/maidens/domains/contracts/equipment-state/schemas"
REPORT_DIR="$PROJECT_ROOT/src/lib/maidens/domains/contracts/equipment-state/reports"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_PATH="${EQUIPMENT_STATE_E2E_REPORT_PATH:-$REPORT_DIR/equipment-state-e2e-${RUN_ID}.json}"
LATEST_REPORT_PATH="$REPORT_DIR/latest.json"
LOG_DIR="$REPORT_DIR/logs/$RUN_ID"
STEPS_JSONL="$REPORT_DIR/equipment-state-e2e-${RUN_ID}.steps.jsonl"

mkdir -p "$REPORT_DIR" "$LOG_DIR"
: > "$STEPS_JSONL"

now_ms() {
  python - <<'PY'
import time
print(int(time.time() * 1000))
PY
}

START_MS="$(now_ms)"
START_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

append_step() {
  local id="$1"
  local name="$2"
  local status="$3"
  local exit_code="$4"
  local duration_ms="$5"
  local command="$6"
  local cwd="$7"
  local log_path="$8"
  local error_signature="$9"
  local fingerprint_before="${10}"
  local fingerprint_after="${11}"

  python - "$STEPS_JSONL" "$id" "$name" "$status" "$exit_code" "$duration_ms" "$command" "$cwd" "$log_path" "$error_signature" "$fingerprint_before" "$fingerprint_after" <<'PY'
import json
import sys

(
  out_path,
  id,
  name,
  status,
  exit_code,
  duration_ms,
  command,
  cwd,
  log_path,
  error_signature,
  fingerprint_before,
  fingerprint_after,
) = sys.argv[1:]

obj = {
    "id": id,
    "name": name,
    "status": status,
    "exitCode": None if exit_code == "" else int(exit_code),
    "durationMs": int(duration_ms),
    "command": command,
    "cwd": cwd,
    "logPath": log_path,
    "errorSignature": error_signature or None,
    "artifacts": {
        "fingerprintBefore": fingerprint_before or None,
        "fingerprintAfter": fingerprint_after or None,
        "fingerprintStable": None
        if not (fingerprint_before or fingerprint_after)
        else fingerprint_before == fingerprint_after,
    },
}

with open(out_path, "a", encoding="utf-8") as f:
    f.write(json.dumps(obj) + "\n")
PY
}

append_skipped_step() {
  local id="$1"
  local name="$2"
  local command="$3"
  local cwd="$4"

  append_step "$id" "$name" "skipped" "" "0" "$command" "$cwd" "" "skipped_due_to_previous_failure" "" ""
}

extract_error_signature() {
  local log_path="$1"
  grep -m1 -E "ERROR|Error|error|FAIL|failed|CompileError|Assertion|Exception" "$log_path" || true
}

run_step() {
  local id="$1"
  local name="$2"
  local gate_label="$3"
  local cwd="$4"
  local command="$5"

  local log_path="$LOG_DIR/${id}.log"
  local step_start step_end duration exit_code status signature

  printf '\n[equipment-state-e2e] gate %s: %s\n' "$gate_label" "$name"

  step_start="$(now_ms)"
  (cd "$cwd" && bash -lc "$command") 2>&1 | tee "$log_path"
  exit_code=$?
  step_end="$(now_ms)"
  duration=$((step_end - step_start))

  if [[ "$exit_code" -eq 0 ]]; then
    status="passed"
    signature=""
  else
    status="failed"
    signature="$(extract_error_signature "$log_path")"
  fi

  append_step "$id" "$name" "$status" "$exit_code" "$duration" "$command" "$cwd" "$log_path" "$signature" "" ""

  return "$exit_code"
}

schema_fingerprint() {
  find "$SCHEMA_DIR" -maxdepth 1 -type f -name 'equipment_state*' -print0 \
    | sort -z \
    | xargs -0 sha256sum \
    | sha256sum \
    | awk '{print $1}'
}

run_schema_determinism_step() {
  local id="schema_generation_determinism"
  local name="JSON Schema generation + determinism"
  local gate_label="2/6"
  local command="bun run contracts:gen:equipment-state"
  local cwd="$PROJECT_ROOT"
  local log_path="$LOG_DIR/${id}.log"
  local step_start step_end duration exit_code status signature
  local fingerprint_before=""
  local fingerprint_after=""

  printf '\n[equipment-state-e2e] gate %s: %s\n' "$gate_label" "$name"

  step_start="$(now_ms)"
  : > "$log_path"

  echo "[equipment-state-e2e] first generation run" | tee -a "$log_path"
  (cd "$cwd" && bash -lc "$command") 2>&1 | tee -a "$log_path"
  exit_code=$?

  if [[ "$exit_code" -eq 0 ]]; then
    fingerprint_before="$(schema_fingerprint)"
    echo "[equipment-state-e2e] fingerprint before rerun: $fingerprint_before" | tee -a "$log_path"

    echo "[equipment-state-e2e] second generation run" | tee -a "$log_path"
    (cd "$cwd" && bash -lc "$command") 2>&1 | tee -a "$log_path"
    exit_code=$?

    if [[ "$exit_code" -eq 0 ]]; then
      fingerprint_after="$(schema_fingerprint)"
      echo "[equipment-state-e2e] fingerprint after rerun:  $fingerprint_after" | tee -a "$log_path"

      if [[ "$fingerprint_before" != "$fingerprint_after" ]]; then
        echo "[equipment-state-e2e] ERROR: schema generation is non-deterministic" | tee -a "$log_path"
        echo "before: $fingerprint_before" | tee -a "$log_path"
        echo "after : $fingerprint_after" | tee -a "$log_path"
        exit_code=42
      else
        echo "[equipment-state-e2e] schema fingerprint stable: $fingerprint_after" | tee -a "$log_path"
      fi
    fi
  fi
  step_end="$(now_ms)"
  duration=$((step_end - step_start))

  if [[ "$exit_code" -eq 0 ]]; then
    status="passed"
    signature=""
  else
    status="failed"
    signature="$(extract_error_signature "$log_path")"
  fi

  append_step "$id" "$name" "$status" "$exit_code" "$duration" "$command" "$cwd" "$log_path" "$signature" "$fingerprint_before" "$fingerprint_after"

  return "$exit_code"
}

write_report() {
  local end_ms end_at duration_ms overall_status
  end_ms="$(now_ms)"
  end_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  duration_ms=$((end_ms - START_MS))

  python - "$STEPS_JSONL" "$REPORT_PATH" "$LATEST_REPORT_PATH" "$RUN_ID" "$START_AT" "$end_at" "$duration_ms" "$PROJECT_ROOT" <<'PY'
import json
import pathlib
import sys

(
  steps_jsonl,
  report_path,
  latest_path,
  run_id,
  start_at,
  end_at,
  duration_ms,
  project_root,
) = sys.argv[1:]

steps = []
with open(steps_jsonl, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line:
            steps.append(json.loads(line))

passed = sum(1 for s in steps if s["status"] == "passed")
failed = sum(1 for s in steps if s["status"] == "failed")
skipped = sum(1 for s in steps if s["status"] == "skipped")
status = "failed" if failed > 0 else "passed"

report = {
    "runId": run_id,
    "status": status,
    "startAt": start_at,
    "endAt": end_at,
    "durationMs": int(duration_ms),
    "projectRoot": project_root,
    "summary": {
        "gatesTotal": len(steps),
        "gatesPassed": passed,
        "gatesFailed": failed,
        "gatesSkipped": skipped,
    },
    "steps": steps,
}

report_path_obj = pathlib.Path(report_path)
report_path_obj.parent.mkdir(parents=True, exist_ok=True)
report_path_obj.write_text(json.dumps(report, indent=2), encoding="utf-8")

latest_path_obj = pathlib.Path(latest_path)
latest_path_obj.write_text(json.dumps(report, indent=2), encoding="utf-8")

print(report_path_obj)
PY
}

printf '\n[equipment-state-e2e] project root: %s\n' "$PROJECT_ROOT"

overall_status=0

if run_step "ts_contract_tests" "TypeScript contract tests" "1/6" "$PROJECT_ROOT" "bun run contracts:test:equipment-state"; then
  if run_schema_determinism_step; then
    if run_step "elixir_runtime_tests" "Elixir runtime tests (validator + signal/sensor + persistence)" "3/6" "$ELIXIR_DIR" "mix deps.get >/dev/null && mix test"; then
      if run_step "strategy_boundary_tests" "strategy boundary tests (SignalFsm + boundary directives)" "4/6" "$ELIXIR_DIR" "mix test test/equipment_state_strategy_boundary_test.exs"; then
        if run_step "elixir_persistence_tests" "explicit persistence test file" "5/6" "$ELIXIR_DIR" "mix test test/equipment_state_persistence_test.exs"; then
          if ! run_step "negative_gate_assertions" "negative-gate assertions (schema-valid/FSM-illegal rejection)" "6/6" "$ELIXIR_DIR" "mix test test/equipment_state_validator_test.exs --only negative_gate"; then
            overall_status=1
          fi
        else
          overall_status=1
          append_skipped_step "negative_gate_assertions" "negative-gate assertions (schema-valid/FSM-illegal rejection)" "mix test test/equipment_state_validator_test.exs --only negative_gate" "$ELIXIR_DIR"
        fi
      else
        overall_status=1
        append_skipped_step "elixir_persistence_tests" "explicit persistence test file" "mix test test/equipment_state_persistence_test.exs" "$ELIXIR_DIR"
        append_skipped_step "negative_gate_assertions" "negative-gate assertions (schema-valid/FSM-illegal rejection)" "mix test test/equipment_state_validator_test.exs --only negative_gate" "$ELIXIR_DIR"
      fi
    else
      overall_status=1
      append_skipped_step "strategy_boundary_tests" "strategy boundary tests (SignalFsm + boundary directives)" "mix test test/equipment_state_strategy_boundary_test.exs" "$ELIXIR_DIR"
      append_skipped_step "elixir_persistence_tests" "explicit persistence test file" "mix test test/equipment_state_persistence_test.exs" "$ELIXIR_DIR"
      append_skipped_step "negative_gate_assertions" "negative-gate assertions (schema-valid/FSM-illegal rejection)" "mix test test/equipment_state_validator_test.exs --only negative_gate" "$ELIXIR_DIR"
    fi
  else
    overall_status=1
    append_skipped_step "elixir_runtime_tests" "Elixir runtime tests (validator + signal/sensor + persistence)" "mix deps.get >/dev/null && mix test" "$ELIXIR_DIR"
    append_skipped_step "strategy_boundary_tests" "strategy boundary tests (SignalFsm + boundary directives)" "mix test test/equipment_state_strategy_boundary_test.exs" "$ELIXIR_DIR"
    append_skipped_step "elixir_persistence_tests" "explicit persistence test file" "mix test test/equipment_state_persistence_test.exs" "$ELIXIR_DIR"
    append_skipped_step "negative_gate_assertions" "negative-gate assertions (schema-valid/FSM-illegal rejection)" "mix test test/equipment_state_validator_test.exs --only negative_gate" "$ELIXIR_DIR"
  fi
else
  overall_status=1
  append_skipped_step "schema_generation_determinism" "JSON Schema generation + determinism" "bun run contracts:gen:equipment-state" "$PROJECT_ROOT"
  append_skipped_step "elixir_runtime_tests" "Elixir runtime tests (validator + signal/sensor + persistence)" "mix deps.get >/dev/null && mix test" "$ELIXIR_DIR"
  append_skipped_step "strategy_boundary_tests" "strategy boundary tests (SignalFsm + boundary directives)" "mix test test/equipment_state_strategy_boundary_test.exs" "$ELIXIR_DIR"
  append_skipped_step "elixir_persistence_tests" "explicit persistence test file" "mix test test/equipment_state_persistence_test.exs" "$ELIXIR_DIR"
  append_skipped_step "negative_gate_assertions" "negative-gate assertions (schema-valid/FSM-illegal rejection)" "mix test test/equipment_state_validator_test.exs --only negative_gate" "$ELIXIR_DIR"
fi

report_output_path="$(write_report)"

ci_status="failed"
if [[ "$overall_status" -eq 0 ]]; then
  ci_status="passed"
  printf '\n[equipment-state-e2e] ✅ all gates passed\n'
  printf '[equipment-state-e2e] report: %s\n' "$report_output_path"
else
  printf '\n[equipment-state-e2e] ❌ one or more gates failed\n'
  printf '[equipment-state-e2e] report: %s\n' "$report_output_path"
fi

summary_line="status=${ci_status} report=${report_output_path}"
printf '[equipment-state-e2e][ci-summary] %s\n' "$summary_line"
printf '::notice title=equipment-state-e2e::%s\n' "$summary_line"

exit "$overall_status"
