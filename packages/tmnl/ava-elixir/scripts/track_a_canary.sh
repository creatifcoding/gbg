#!/usr/bin/env bash
set -euo pipefail

# AVA Track A canary validation (NATS-first contract lane)
# - T1 Subject parity
# - T2 Payload casing
# - T5 Malformed envelope rejection
# - T7 Rollback drill smoke (phoenix_fallback alias -> sidecar path)
# - TS schema/service parity

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AVA_DIR="${ROOT_DIR}/ava-elixir"

export AVA_RUNTIME_MODE="${AVA_RUNTIME_MODE:-nats_primary}"
export AVA_NATS_PREFIX="${AVA_NATS_PREFIX:-tmnl.ava}"
export AVA_OBAN_MAX_ATTEMPTS="${AVA_OBAN_MAX_ATTEMPTS:-10}"
export CANARY_RUN_ROLLBACK_DRILL="${CANARY_RUN_ROLLBACK_DRILL:-1}"

echo "[canary] root=${ROOT_DIR}"
echo "[canary] runtime_mode=${AVA_RUNTIME_MODE} prefix=${AVA_NATS_PREFIX}"

cd "${ROOT_DIR}"

echo "[canary] 1/6 TypeScript typecheck"
bunx tsc --noEmit

echo "[canary] 2/6 AVA TS schema/service tests"
bunx vitest run src/lib/ava/__tests__/ava-v2-services.test.ts

cd "${AVA_DIR}"

echo "[canary] 3/6 NATS ingress parity tests (T1/T2/T5)"
mix test test/ava_elixir/bridge/nats_ingress_test.exs

echo "[canary] 4/6 Worker behavior tests"
mix test test/ava_elixir/workers/ava_command_worker_test.exs test/ava_elixir/workers/ava_outbox_worker_test.exs

echo "[canary] 5/6 Full ava-elixir suite"
mix test

if [[ "${CANARY_RUN_ROLLBACK_DRILL}" == "1" ]]; then
  echo "[canary] 6/6 Rollback drill smoke (AVA_RUNTIME_MODE=phoenix_fallback)"
  AVA_RUNTIME_MODE=phoenix_fallback mix test test/sidecar_mode_test.exs
else
  echo "[canary] 6/6 Rollback drill smoke skipped (CANARY_RUN_ROLLBACK_DRILL=0)"
fi

echo "[canary] complete ✅"
