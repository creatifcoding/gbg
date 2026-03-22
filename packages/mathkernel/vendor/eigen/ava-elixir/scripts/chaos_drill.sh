#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AVA_DIR="${ROOT_DIR}/ava-elixir"

pass() { echo "[PASS] $1"; }
fail() { echo "[FAIL] $1"; exit 1; }

cd "${AVA_DIR}"

echo "[chaos] starting deterministic failure drills"

if mix test test/ava_elixir/bridge/nats_ingress_test.exs >/tmp/ava-chaos-ingress.log 2>&1; then
  pass "ingress malformed payload rejection"
else
  cat /tmp/ava-chaos-ingress.log
  fail "ingress malformed payload rejection"
fi

if mix test test/ava_elixir/workers/ava_outbox_worker_test.exs >/tmp/ava-chaos-outbox.log 2>&1; then
  pass "outbox egress-disabled failure path"
else
  cat /tmp/ava-chaos-outbox.log
  fail "outbox egress-disabled failure path"
fi

if AVA_RUNTIME_MODE=phoenix_fallback mix test test/sidecar_mode_test.exs >/tmp/ava-chaos-rollback.log 2>&1; then
  pass "rollback alias smoke (phoenix_fallback)"
else
  cat /tmp/ava-chaos-rollback.log
  fail "rollback alias smoke (phoenix_fallback)"
fi

echo "[chaos] all drills passed ✅"
