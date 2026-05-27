# Reactor v2 Closeout Report

Status: F8 closeout for the guarded opt-in candidate-lane promotion program

Date: 2026-05-27

## Executive result

The Reactor v2 promotion train is complete through guarded opt-in activation and worker/replay hardening.

What is now true:

1. Reactor has a SQL-first source-entry authority before planning or dispatch.
2. Relationship topology is projection-owned and audit-backed where event ordering requires as-of expansion.
3. Target entities own eligibility, idempotency, transition, audit, and emitted events.
4. Four candidate lanes are promoted to explicit opt-in runtime layers.
5. The topology atlas is deterministic and CI-checkable.
6. Worker/replay failure recovery has source-claim phase heartbeats, checkpoint repair, fingerprint fences, and zombie recovery coverage.

What is deliberately **not** true:

- Candidate lanes are not baseline-live.
- Projection handlers do not dispatch Reactor target mutations.
- Reactor does not synthesize workflow orchestration.
- Graph state is not treated as authority.
- Effect v4 APIs were not introduced.

## Completed feature train

| Feature | Result | Commit |
| --- | --- | --- |
| F1 — Promotion Governance and Registry Packaging | closed | `31ebcec9` |
| F2 — SQL Constraint Addressing and Release Substrate | closed | pre-existing v2 substrate commits |
| F3 — WorkOrder depends_on Guarded Live Lane | closed | `cf2f3871` |
| F4 — Alarm Safety-Hold Lane | closed | `934417bb` |
| F5 — Structural Decommission Cascade Lane | closed | `38d1e862` |
| F6-pre — Graph Boundary Refactor Before External/Device Lane | closed | `be455833` |
| F6 — External and Device Availability Lane | closed | `67ac92fd` |
| F7 — Worker, Replay, and Failure Recovery Hardening | closed | `ca60b554` |
| F8 — Atlas, Documentation, CI, and Closeout | closed by this report | pending closeout commit |

## Lane closeout

### Baseline-live

| Lane | Evidence |
| --- | --- |
| Equipment availability over `targets`/`requires` | Existing `ReactorGenericLive`/`ReactorBaselineLive`; generic Reactor E2E and graph expansion coverage |

### Guarded opt-in-live

| Lane | Runtime layer | Key proof |
| --- | --- | --- |
| WorkOrder `depends_on` | `ReactorDependsOnLive` | Upstream suspend/fail/cancel blocks downstream WorkOrders; upstream resume completes exact SQL release path |
| Alarm safety-hold | `ReactorAlarmSafetyLive` | Critical/emergency alarms assert alarmId-addressed holds; clearing one alarm retracts only its own hold |
| Structural decommission cascade | `ReactorStructuralDecommissionLive` | Direct contains cascade remains bounded; WorkOrders targeting/requiring decommissioned equipment block |
| External/device availability | `ReactorExternalDeviceAvailabilityLive` | External unlink uses event-time relationship audit expansion after projection closes edge; relink exact-releases; device decommission blocks required WorkOrders |

## Worker/replay hardening closeout

F7 hardened the durable processing boundary:

- `Reactor.reactToJournalEntry` now heartbeats claim phases through `planning`, `dispatching`, and `completing`.
- Claim and checkpoint metadata now include subject, signal axes/values, policy IDs, target IDs, decision counts, dispatched counts, failed counts, policy epoch, and registry fingerprint.
- Completed claims remain terminal across later registry fingerprint changes.
- Sweeper recovery is lane/fingerprint scoped, so baseline and candidate bundles do not steal each other's expired rows.
- `ReactorWorkerEntity` wraps Reactor failures with owner-key, source-entry, source-event, and primary-key context.

## Validation performed

The focused Reactor v2 validation pack passed. The checked-in CI wrapper is:

```bash
./scripts/reactor-v2-validation.sh
```

Expanded command used by the wrapper:

```bash
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
```

Observed test summary:

```text
Test Files  15 passed (15)
Tests       84 passed (84)
```

`bun run reactor:atlas:check` passed against `src/lib/iiot/docs/REACTOR-TOPOLOGY-ATLAS.md`.

## Remaining non-blocking decisions

These are intentionally deferred beyond the guarded opt-in promotion train:

1. Baseline-live promotion decision for any opt-in lane.
2. Production sweeper scheduling and ownership model.
3. Alerting/runbooks for blocked claims, registry drift, and epoch conflict.
4. Operator command surface for manual claim/constraint remediation.
5. Multi-hop graph expansion beyond the current direct-edge contracts.
6. Whether structural inherited lifecycle should become mutating rather than projection-only/no-op.

## Closeout stance

Reactor v2 is now a disciplined structural consistency substrate, not a workflow Rube Goldberg machine. The lanes are proven, caged behind explicit activation, and backed by SQL authority where it matters.

The next architectural move should be operationalization: sweeper ownership, alerting, and explicit baseline-live decision gates.
