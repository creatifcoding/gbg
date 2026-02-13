# IIoT Architecture Plans

> **Canonical Source**: `thoughts/shared/plans/`
> **Consolidated**: 2026-02-09
> **Count**: 25 documents

Architecture plans, WBS documents, and technical proposals for the IIoT service architecture.

---

## Phase Architecture

| File | Phase | Description |
|------|-------|-------------|
| [phase4-http-architecture.md](phase4-http-architecture.md) | 4 | HTTP transport layer design |
| [phase4-http-research.md](phase4-http-research.md) | 4 | HTTP architecture research findings |
| [phase4-rpc-inventory.md](phase4-rpc-inventory.md) | 4 | Full RPC inventory including realtime RPCs |
| [phase5-websocket-architecture.md](phase5-websocket-architecture.md) | 5 | WebSocket server layer, subscription management |
| [phase5-stream-architecture.md](phase5-stream-architecture.md) | 5 | Stream composition, backpressure, fan-out |

## Sparkplug / NATS / Broker

| File | Description |
|------|-------------|
| [sparkplug-b-plan.md](sparkplug-b-plan.md) | Sparkplug-B integration plan |
| [sparkplug-b-reference-index.md](sparkplug-b-reference-index.md) | Sparkplug protocol reference index |
| [nats-only-sparkplug-proposal.md](nats-only-sparkplug-proposal.md) | NATS-only architecture proposal |
| [nats-decision-gate-result.md](nats-decision-gate-result.md) | NATS-only vs EMQX decision outcome |
| [broker-infra-decomposition.md](broker-infra-decomposition.md) | Broker infrastructure decomposition |
| [emqx-broker-infrastructure-plan.md](emqx-broker-infrastructure-plan.md) | EMQX broker infrastructure plan |

## Entity / Concurrency

| File | Description |
|------|-------------|
| [asset-entity-outbox-variants.md](asset-entity-outbox-variants.md) | Entity outbox pattern variants |
| [asset-123-concurrency-scenarios.md](asset-123-concurrency-scenarios.md) | Asset concurrency scenarios analysis |

## Formal Verification

| File | Description |
|------|-------------|
| [iiot-invariants-analysis.md](iiot-invariants-analysis.md) | IIoT invariants analysis |
| [iiot-invariants.tla](iiot-invariants.tla) | TLA+ formal specification |
| [iiot-invariants.cfg](iiot-invariants.cfg) | TLA+ model checker configuration |

## WBS / Work Breakdown

| File | Description |
|------|-------------|
| [2026-01-26-v3-service-architecture-wbs.md](2026-01-26-v3-service-architecture-wbs.md) | Full V3 service architecture WBS |
| [2026-01-26-es-boundaries-wbs.md](2026-01-26-es-boundaries-wbs.md) | Event sourcing boundaries WBS |
| [2026-01-29-eventlog-integration-wbs-final.md](2026-01-29-eventlog-integration-wbs-final.md) | EventLog integration WBS (final) |
| [2026-01-29-work-order-workflow-decomposition.md](2026-01-29-work-order-workflow-decomposition.md) | Work order workflow decomposition |
| [2026-01-30-entity-system-wbs-addendum.md](2026-01-30-entity-system-wbs-addendum.md) | Entity system WBS addendum |

## Implementation Plans

| File | Description |
|------|-------------|
| [iiot-models-repos-tdd-plan.md](iiot-models-repos-tdd-plan.md) | Models + repos TDD plan |
| [iiot-seed-runner-cli.md](iiot-seed-runner-cli.md) | Seed runner CLI plan |
| [tdd-seed-assets-2026-01-25.md](tdd-seed-assets-2026-01-25.md) | TDD seed assets plan |
| [init-sql-to-ddl-migration.md](init-sql-to-ddl-migration.md) | SQL-to-DDL migration plan |
