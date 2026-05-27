# Reactor v2 Promotion Index

Status: closeout index for the guarded opt-in Reactor v2 promotion train

## Mission frame

Reactor v2 promotes structural consistency lanes without changing the system's authority boundaries:

- **Events are primitive.** Reactor observes durable EventJournal entries.
- **Graph is projection.** Topology is read from AGE plus SQL relationship audit where event-time expansion is required.
- **SQL is authority.** Source claims, checkpoints, constraints, relationship audit, and transition causality are durable SQL records.
- **Targets own mutation.** Reactor requests pressure; target entities classify, transition, audit, and emit follow-up events.
- **Default runtime remains conservative.** Candidate lanes are guarded opt-in layers, not silently added to `ReactorGenericLive`.

## Runtime activation matrix

| Lane | Status | Opt-in layer | Flag | Baseline? | Primary proof |
| --- | --- | --- | --- | --- | --- |
| Equipment availability over `targets`/`requires` | baseline-live | `ReactorBaselineLive` / `ReactorGenericLive` | n/a | yes | Generic Reactor + WorkOrder dependency block E2E |
| WorkOrder `depends_on` | guarded opt-in-live | `ReactorDependsOnLive` | `REACTOR_LANE_DEPENDS_ON_ENABLED` | no | `reactor-work-order-depends-on-e2e.test.ts` |
| Alarm safety-hold | guarded opt-in-live | `ReactorAlarmSafetyLive` | `REACTOR_LANE_ALARM_SAFETY_ENABLED` | no | `reactor-alarm-safety-e2e.test.ts` |
| Structural decommission cascade | guarded opt-in-live | `ReactorStructuralDecommissionLive` | `REACTOR_LANE_STRUCTURAL_DECOMMISSION_ENABLED` | no | `reactor-structural-decommission-e2e.test.ts` |
| External/device availability | guarded opt-in-live | `ReactorExternalDeviceAvailabilityLive` | `REACTOR_LANE_EXTERNAL_DEVICE_AVAILABILITY_ENABLED` | no | `reactor-external-device-availability-e2e.test.ts` |
| All declared policies | test/atlas only | `ReactorAllDeclaredLive` | n/a | no | Registry/topology declaration checks |

## Promotion commits

| Area | Commit | Artifact highlights |
| --- | --- | --- |
| Promotion substrate | `31ebcec9` | Activation tiers, feature flags, lane packaging, constraint address enrichment |
| WorkOrder `depends_on` lane | `cf2f3871` | Guarded opt-in depends_on block/release with exact SQL natural-address release |
| Alarm safety lane | `934417bb` | AlarmId-addressed safety holds with target-owned WorkOrder release semantics |
| Structural decommission lane | `38d1e862` | Direct-child structural lifecycle pressure plus WorkOrder dependency block over `targets`/`requires` |
| Graph boundary refactor | `be455833` | Generic L1 `GraphClient`; domain graph queries moved to L2 services |
| External/device availability lane | `67ac92fd` | Event-time audit-backed expansion for external unlink and device availability pressure |
| Worker/replay hardening | `ca60b554` | Phase heartbeats, source-claim metadata, multi-lane sweeper fences, worker failure context |

## Canonical documents

| Document | Purpose |
| --- | --- |
| `REACTOR-LANE-PROMOTION-CONTRACT.md` | Gate definition for declared-only, opt-in-live, baseline-live, and parked lanes |
| `REACTOR-TOPOLOGY-ATLAS.md` | Deterministic CI-checkable topology/readiness atlas |
| `WORKORDER-DEPENDS-ON-ROUTING-CONTRACT.md` | WorkOrder dependency routing and exact release semantics |
| `ALARM-SAFETY-HOLD-ROUTING-CONTRACT.md` | Alarm safety-hold assertion/release contract |
| `STRUCTURAL-DECOMMISSION-CASCADE-ROUTING-CONTRACT.md` | Structural cascade routing contract and direct-child guardrails |
| `EXTERNAL-DEVICE-REQUIRES-AVAILABILITY-ROUTING-CONTRACT.md` | External/device availability routing and event-time expansion guardrails |
| `REACTOR-CONSTRAINT-AUTHORITY.md` | SQL natural-key constraint assertion/retraction authority |
| `REACTOR-SOURCE-CLAIM-DESIGN.md` | Source-entry claim, checkpoint, replay, and zombie recovery model |
| `REACTOR-TARGET-OWNED-RELEASE-SEMANTICS.md` | Why release is target-owned reconciliation, not inverse dispatch |

## CI-facing validation pack

Use this focused pack before changing activation tier or promotion docs. CI may call the checked-in wrapper:

```bash
./scripts/reactor-v2-validation.sh
```

Equivalent expanded command:

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

`reactor:atlas:live` is intentionally not a deterministic CI target; it overlays current DB graph state for operator inspection.

## Baseline promotion hold

The promoted lanes are proven as guarded opt-in lanes. They are **not** baseline-live until the next operational decision explicitly accepts:

1. replay behavior under production worker topology;
2. source-claim sweeper scheduling/ownership;
3. alerting for epoch/fingerprint drift and blocked claims;
4. operator runbooks for manual remediation;
5. production confidence in target-owned release behavior across mixed lane bundles.

Prime, no accidental empire-building: the lanes are sharp, tested, and caged until someone deliberately opens the gate.
