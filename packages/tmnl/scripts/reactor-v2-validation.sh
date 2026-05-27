#!/usr/bin/env bash
set -euo pipefail

bunx tsc --noEmit --pretty false --skipLibCheck
bun run reactor:atlas:check
bun run test:run \
  src/lib/iiot/services/reactor/__tests__/ReactorRegistry.test.ts \
  src/lib/iiot/services/reactor/__tests__/ReactorPlanner.test.ts \
  src/lib/iiot/services/reactor/__tests__/ReactorAdmissionControl.test.ts \
  src/lib/iiot/services/reactor/__tests__/constraints.test.ts \
  src/lib/iiot/services/reactor/__tests__/observations.test.ts \
  src/lib/iiot/services/reactor/__tests__/topology-atlas.test.ts \
  src/lib/iiot/services/reactor/__tests__/ReactorWorkerEntity.test.ts \
  src/lib/iiot/__tests__/integration/reactor-graph-expansion.test.ts \
  src/lib/iiot/__tests__/integration/reactor-checkpoint.test.ts \
  src/lib/iiot/__tests__/integration/reactor-source-claim.test.ts \
  src/lib/iiot/__tests__/integration/reactor-source-claim-e2e.test.ts \
  src/lib/iiot/__tests__/integration/reactor-work-order-depends-on-e2e.test.ts \
  src/lib/iiot/__tests__/integration/reactor-alarm-safety-e2e.test.ts \
  src/lib/iiot/__tests__/integration/reactor-structural-decommission-e2e.test.ts \
  src/lib/iiot/__tests__/integration/reactor-external-device-availability-e2e.test.ts
