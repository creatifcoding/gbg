#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

WITH_INGEST="${RUN_GEOINT_INGEST_SMOKE:-0}"
if [[ "${1:-}" == "--with-ingest" ]]; then
  WITH_INGEST="1"
fi

echo "[geoint:rapid] 1/5 migrate registry (initial pass)"
bun run geoint:migrate

echo "[geoint:rapid] 2/5 migrate registry again (idempotency pass)"
bun run geoint:migrate

echo "[geoint:rapid] 3/5 diff seeded registry vs DB"
bun run geoint:registry:diff --strict

echo "[geoint:rapid] 4/5 run registry + planner + parity tests"
bunx vitest run \
  src/lib/geoint/registry/__tests__/schemas.test.ts \
  src/lib/geoint/registry/__tests__/sourceRegistry.test.ts \
  src/lib/geoint/registry/__tests__/sourceResolver.test.ts \
  src/lib/geoint/registry/__tests__/runtimeSourceRegistry.test.ts \
  src/lib/geoint/registry/__tests__/planner.test.ts \
  src/lib/geoint/persistence/postgis/__tests__/RegistrySourceRepository.test.ts \
  src/lib/geoint/harness/__tests__/tools.test.ts \
  src/lib/geoint/harness/__tests__/code-mode-geoint-sdk.test.ts

if [[ "$WITH_INGEST" == "1" ]]; then
  echo "[geoint:rapid] 5/5 run live ingest smoke (RUN_INTEGRATION_TESTS=1)"
  RUN_INTEGRATION_TESTS=1 bunx vitest run src/lib/geoint/ingestion/__tests__/IngestionPipeline.e2e.test.ts
else
  echo "[geoint:rapid] 5/5 ingest smoke skipped (set RUN_GEOINT_INGEST_SMOKE=1 or pass --with-ingest)"
fi

echo "[geoint:rapid] complete"
