# Holonet Audit Overview

## Agent Frontmatter

- **Audience**: Agents + maintainers
- **Reading Order**: Meta → Clarifications → Beads → Pass 1–3
- **High‑Signal**: Pass 2 (Durable‑Streams), Pass 3 (NATS/Subject)
- **Related**: `docs/HOLONET_DUPLEX_SPEC.md`, `docs/HOLONET_EDGE_CASES.md`, `docs/HOLONET_RESEARCH_ROUNDS.md`, `docs/GLOSSARY.md`

## Meta

- **Date**: 2026-01-13
- **Scope**: `src/lib/holonet`
- **Mode**: Audit + Protocol Proposals (no code changes)
- **Objective**: Enumerate current system, surface gaps, propose duplex protocol directions
- **Owner**: Val (audit), Prime (decisions)
- **Status**: Active

## Clarifications (Ground Truth)

- Duplex target: **true data-plane bidirectionality**.
- Durable-Streams is **long-term API**, not “edge” by constraint.
- “Robust” = durable, likely multi-transport; research will extend beyond existing code.
- Output must include **audit + protocol proposals**.

## Index Seeds

**Primary tags**: `holonet`, `durable-streams`, `jetstream`, `duplex`, `nats.ws`, `schema-registry`
**Secondary tags**: `control-plane`, `data-plane`, `ack`, `nack`, `flow-control`, `replay`, `subject-registry`, `control-cursor`
**Aliases**: `edge-api` → `durable-streams-api`, `duplex` → `bidirectional`

## Beads (Progress Tracking)

| Bead    | Phase   | Goal                         | Status   |
| ------- | ------- | ---------------------------- | -------- |
| **B01** | Phase 1 | Architecture & module map    | **done** |
| **B02** | Phase 2 | Durable-Streams surface      | **done** |
| **B03** | Phase 3 | NATS + Subject + Integration | **done** |

---

## Pass 1 — Architecture & Module Map [IDX:holonet.arch]

**Intent**: Establish macro architecture + declared design goals.

**Surface**

- Holonet is a **NATS/JetStream enhancement** to Effect patterns. `src/lib/holonet/ARCHITECTURE.md`
- Planned service stack: `NatsPubSub`, `NatsStream`, `NatsConsumer`, `NatsObject`, `NatsRpc`, `NatsMonitoring`. `src/lib/holonet/ARCHITECTURE.md`
- Integration layer planned: `HolonetEventLog`, `HolonetStreamProcessor`. `src/lib/holonet/ARCHITECTURE.md`

**Signals**

- Analysis flags **70% code duplication** + **non-Effectual stream patterns**. `src/lib/holonet/ANALYSIS.md`
- Refactoring plan describes shared utilities + base service hierarchy. `src/lib/holonet/REFACTORING_PLAN.md`

**Gaps**

- Architecture doc lists **planned services**; not all are surfaced in implementation.

---

## Pass 2 — Durable-Streams Surface [IDX:holonet.durable]

**Intent**: Enumerate durable-streams API, services, tests.

**Surface**

- Durable-streams = **HTTP protocol → NATS JetStream bridge**. `src/lib/holonet/durable-streams/README.md`
- `StreamBridgeService`: `create`, `append`, `read`, `metadata`, `delete`. `src/lib/holonet/durable-streams/services/StreamBridgeService.ts`
- `LiveStreamService`: `longPoll`, `sse`, `subscribe`. `src/lib/holonet/durable-streams/services/LiveStreamService.ts`
- `ConsumerStateService`: offset tracking. `src/lib/holonet/durable-streams/services/__tests__/ConsumerStateService.test.ts`
- `StreamCodecService`: schema-aware encode/decode. `src/lib/holonet/durable-streams/services/__tests__/StreamCodecService.test.ts`

**Behavior**

- `LiveStreamService` uses `Stream.unfoldChunkEffect` polling (offset+limit). `src/lib/holonet/durable-streams/services/LiveStreamService.ts`
- Integration tests validate real NATS/JetStream + schema headers. `src/lib/holonet/durable-streams/__tests__/integration.test.ts`

**Gaps**

- SSE/subscribe appear **poll-derived**, not true push/duplex.

---

## Pass 3 — NATS + Subject + Integration Inventory [IDX:holonet.nats]

**Intent**: Enumerate NATS primitives, subject registry, and integration utilities.

**NATS Primitives**

- `NatsConnectionService`: `nc`, `js`, `jsm`, `config`. `src/lib/holonet/nats/connection.ts`
- `NatsPubSubService`: `publish`, `subscribe`, `request`, `flush`. `src/lib/holonet/nats/pubsub.ts`
- `NatsStreamService`: `ensureStream`, `publish`, `subscribe`, `fetch`, `next`, `getConsumer`, `getStreamInfo`, `deleteStream`. `src/lib/holonet/nats/stream.ts`
- `NatsCodecService` + `NatsCodec` for encode/decode (batch + stream). `src/lib/holonet/nats/codec.ts`

**Subject System**

- `SubjectRegistry`: `register`, `update`, `get`, `query`, `resolveStreamName`, `specsByStream`, `catalog`. `src/lib/holonet/subject/registry.ts`
- `DomainConventionRegistry`: GEOINT/SCADA/MES/EVENTS conventions. `src/lib/holonet/subject/conventions.ts`
- `SubjectSpec`: `resolve`, `matches`, `placeholders`, `extractParams`. `src/lib/holonet/subject/schemas.ts`

**Integration Layer**

- `HolonetStreamProcessor`: `publish`, `publishBatch`, `read`, `subscribe`, `subscribeFrom`, `getInfo`, `getCurrentSequence`, `delete`. `src/lib/holonet/integration/stream-processor.ts`
- `StreamProcessorConfig`: `streamName`, `subject(s)`, `consumerName`, `retention`, `maxAge`, `maxBytes`, `maxMsgs`, `replicas`. `src/lib/holonet/integration/stream-processor.ts`

**Gaps**

- Duplex coordination (ack/nack, backpressure, control-plane mutations) isn’t exposed as a unified data-plane API.
- Subject registry supports mapping but no explicit **session binding** (client ↔ stream ↔ consumer).
