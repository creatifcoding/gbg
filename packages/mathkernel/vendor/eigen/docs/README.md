# TMNL Documentation

> **IIoT v3 Service Architecture** | Effect-TS | ISA-95 | @effect/cluster
>
> Last updated: 2026-02-09

Unified documentation hub for the TMNL IIoT platform.
Organized for both human browsing and agent traversal.

---

## Start Here

| Goal | Document |
|------|----------|
| Understand the system | [Architecture Overview](architecture/overview.md) |
| Build something | [Quickstart: First Entity](quickstart.md) |
| Migrate from v2 | [Migration Guide](migration.md) |
| Look up an API | [API Reference](api/README.md) |
| Find a pattern | [Pattern Catalog](#patterns) |
| Understand a decision | [Decision Records](#decisions) |

---

## Architecture

System design — how the IIoT platform is structured, how data flows, how services compose.

| Document | Description |
|----------|-------------|
| [Overview](architecture/overview.md) | V3 architecture overview, phase progression, layer composition |
| [HTTP Transport](architecture/http-transport.md) | Dual HTTP interface — REST (HttpApi) + RPC (RpcServer) |
| [WebSocket Realtime](architecture/websocket-realtime.md) | WebSocket streaming RPCs, handler bridge, subscription management |
| [Stream Processing](architecture/stream-processing.md) | Ingestion pipeline — adapters, TopicRouter, BatchProcessor, AlarmDetector |
| [RPC Inventory](architecture/rpc-inventory.md) | Full RPC inventory — ~136 operations across 13 entity types + 5 realtime |
| [Concurrency Model](architecture/concurrency-model.md) | Actor model — mailbox serialization, 6 scenarios, key guarantees |
| [Holonet Transport](architecture/holonet-transport.md) | NATS transport — service inventory, duplex protocol, edge cases, durable-streams |
| [Streams Library](architecture/streams-library.md) | Streams library — BFO ontology, Channel topology, pattern catalog, API reference |

---

## Patterns

Canonical patterns used across the codebase. Each includes imports, examples, and pitfalls.

### IIoT Domain Patterns

| Document | Description |
|----------|-------------|
| [Schemas](patterns/schemas.md) | Branded IDs, TaggedClass, Literal enums, BaseAssetFields, TaggedError |
| [Entities](patterns/entities.md) | Machine+Entity architecture, handler delegation, EntityStack, error mapping |
| [Repositories](patterns/repositories.md) | Repository lifecycle, decode utilities, column alias, Model-Schema bridge |
| [Event Sourcing](patterns/event-sourcing.md) | Feature flags, guard patterns, non-blocking emission, domain boundaries |
| [RPC Handler Bridge](patterns/rpc-handler-bridge.md) | Stream.unwrap pattern for bridging Effect\<Stream\> to Stream |
| [Effect RPC Gotchas](patterns/effect-rpc-gotchas.md) | HttpLayerRouter, Layer.mergeAll wiring, NDJSON streaming, dotted tag names |
| [Property Testing](patterns/property-testing.md) | Property-based testing with Schema.Arbitrary and fast-check |

### Effect-TS Core Patterns

| Document | Source |
|----------|--------|
| [Effect Atom Doctrine](patterns/effect-atom-doctrine.md) | `.edin/EFFECT_PATTERNS.md` |
| [Effect Core](patterns/effect-core.md) | `.edin/EFFECT_PATTERNS.md` |
| [Effect Services](patterns/effect-services.md) | `.edin/EFFECT_SERVICE_PATTERNS.md` |
| [Effect SQL](patterns/effect-sql.md) | `.edin/EFFECT_SQL_SQLITE_PATTERNS.md` |
| [Effect Testing](patterns/effect-testing.md) | `.edin/EFFECT_TESTING_PATTERNS.md` |
| [RPC Entity Workflow](patterns/rpc-entity-workflow.md) | `.edin/EFFECT_RPC_ENTITY_WORKFLOW.md` |
| [Effect Errors](patterns/effect-errors.md) | `.edin/EFFECT_ERROR_HANDLING.md` |
| [Effect Match](patterns/effect-match.md) | `.edin/EFFECT_MATCH_PATTERN.md` |
| [Effect Atom Result](patterns/effect-atom-result.md) | `.edin/EFFECT_ATOM_RESULT_PATTERN.md` |
| [Differ Reactivity](patterns/differ-reactivity.md) | `.edin/DIFFER_REACTIVITY_RESEARCH.md` |

---

## Decisions

Architecture Decision Records — why we chose what we chose.

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](decisions/adr-001-nats-only-broker.md) | NATS-Only Broker Architecture | Accepted |
| [ADR-002](decisions/adr-002-hybrid-event-sourcing.md) | Hybrid Event Sourcing Boundaries | Accepted |
| [ADR-003](decisions/adr-003-sparkplug-client-fork.md) | Sparkplug Client Fork (@selfcharters) | Accepted |
| [ADR-004](decisions/adr-004-entity-system-architecture.md) | Entity System Architecture (Machine + Cluster) | Pending |

---

## Specifications

Formal specs and system contracts.

| Document | Description |
|----------|-------------|
| [Entity System](specifications/entity-system.md) | Unified entity spec — naming, hierarchy, events, storage, catalog |
| [Invariants Analysis](specifications/iiot-invariants-analysis.md) | TLC model checking — expected violations, implications |
| [TLA+ Spec](specifications/iiot-invariants.tla) | TLA+ specification — entity actor system with 6 invariants |
| [TLC Config](specifications/iiot-invariants.cfg) | TLC model configuration — 6 entities, mailbox depth 2 |
| [V3 Architecture](specifications/v3-architecture.md) | V3 service architecture high-level specification |

---

## References

External standards, protocols, and infrastructure.

| Document | Description |
|----------|-------------|
| [Sparkplug B Protocol](references/sparkplug-b.md) | Topic namespace, protobuf payloads, alias registry, quality encoding |
| [ISA-95 Hierarchy](references/isa95-hierarchy.md) | Equipment hierarchy standard, status definitions per level |
| [NATS MQTT Bridge](references/nats-mqtt-bridge.md) | Feature support, JetStream KV workarounds, topic translation |
| [EMQX (Banked)](references/emqx-banked.md) | Configuration reference — banked, activation triggers |
| [NATS Infrastructure](references/nats-infrastructure.md) | NATS deployment, JetStream KV, PubSub subject conventions |

---

## Implementation

Session-level knowledge distilled from 41 kraken implementation sessions.

| Document | Description |
|----------|-------------|
| [Handoff Digest](implementation/handoff-digest.md) | All kraken session summaries — what was built, decisions, test counts |
| [Alignment Sessions](implementation/alignment-sessions.md) | Conceptual alignment sessions between Prime and agents |
| [Work Order Workflow](implementation/work-order-workflow.md) | Work order lifecycle decomposition and state machine |

---

## API Reference

| Document | Description |
|----------|-------------|
| [Module Reference](api/README.md) | Module-by-module IIoT public API surface |

Covers: Schemas, Entities, State Services, RPC Groups, HTTP Layer, Realtime, Infrastructure.

---

## Tooling

| Document | Description |
|----------|-------------|
| [CLI Reference](tooling/cli-reference.md) | Generator CLIs — entity, model, migration, validate |
| [Spike Methodology](tooling/spike-methodology.md) | H1-H4 progressive hypothesis testing workflow |
| [Pi Hypothesis Lab](tooling/pi-hypothesis-lab.md) | Pi's multi-agent hypothesis lab (6 specialized agents) |

---

## Skills Catalog

| Document | Description |
|----------|-------------|
| [Skills Catalog](skills/README.md) | 79 skills across 16 categories — Effect, React, IIoT, debugging |

---

## Libraries

Internal library architecture and design documents.

| Document | Description |
|----------|-------------|
| [Holonet Architecture](libraries/holonet.md) | NATS-backed distributed ECS — services, config, migration |
| [Streams Ontology](libraries/streams-ontology.md) | BFO ontological foundations for streams constructs |
| [Streams Channels](libraries/streams-channels.md) | Channel topology — inlets, outlets, junctions, protocol |

---

## Features

| Document | Description |
|----------|-------------|
| [COP Chat Panel](features/cop-chat-panel/README.md) | Chat panel design — storyboards, data flow, implementation |

---

## Agent Quick Navigation

```
docs/
├── README.md                              ← YOU ARE HERE
├── quickstart.md                          ← First entity tutorial
├── migration.md                           ← v2 → v3 migration
│
├── architecture/
│   ├── overview.md                        ← START HERE for system understanding
│   ├── http-transport.md                  ← HTTP/RPC layer
│   ├── websocket-realtime.md              ← WebSocket streaming
│   ├── stream-processing.md               ← Ingestion pipeline
│   ├── rpc-inventory.md                   ← All RPCs (~136 operations)
│   ├── concurrency-model.md               ← Actor model + locking
│   ├── holonet-transport.md               ← NATS transport + duplex protocol
│   └── streams-library.md                 ← Streams ontology + Channel topology
│
├── patterns/
│   ├── schemas.md                         ← Effect Schema patterns
│   ├── entities.md                        ← Entity + Machine patterns
│   ├── repositories.md                    ← Model + SQL patterns
│   ├── event-sourcing.md                  ← EventLog + feature flags
│   ├── rpc-handler-bridge.md              ← Stream.unwrap bridge
│   ├── effect-rpc-gotchas.md              ← RPC wiring pitfalls
│   ├── property-testing.md                ← Schema.Arbitrary + fast-check
│   ├── effect-atom-doctrine.md            ← Atom.make() as primary state
│   ├── effect-core.md                     ← Effect fundamentals
│   ├── effect-services.md                 ← Service authoring
│   ├── effect-sql.md                      ← SQL patterns
│   ├── effect-testing.md                  ← Test patterns
│   ├── rpc-entity-workflow.md             ← Rpc → Entity workflow
│   ├── effect-errors.md                   ← Error handling
│   ├── effect-match.md                    ← Match patterns
│   ├── effect-atom-result.md              ← Atom + Result
│   └── differ-reactivity.md               ← Differ research
│
├── decisions/
│   ├── adr-001-nats-only-broker.md        ← NATS-only architecture
│   ├── adr-002-hybrid-event-sourcing.md   ← ES boundary decisions
│   ├── adr-003-sparkplug-client-fork.md   ← Client fork rationale
│   └── adr-004-entity-system-architecture.md ← Machine+Entity pattern
│
├── specifications/
│   ├── entity-system.md                   ← Unified entity spec
│   ├── iiot-invariants-analysis.md        ← TLC analysis
│   ├── iiot-invariants.tla                ← TLA+ spec
│   ├── iiot-invariants.cfg                ← TLC config
│   └── v3-architecture.md                 ← V3 high-level spec
│
├── references/
│   ├── sparkplug-b.md                     ← Protocol reference
│   ├── isa95-hierarchy.md                 ← ISA-95 standard
│   ├── nats-mqtt-bridge.md                ← NATS ↔ MQTT bridge
│   ├── emqx-banked.md                     ← EMQX config (banked)
│   └── nats-infrastructure.md             ← NATS deployment
│
├── implementation/
│   ├── handoff-digest.md                  ← 41 session summaries
│   ├── alignment-sessions.md              ← Alignment records
│   └── work-order-workflow.md             ← WO lifecycle
│
├── api/
│   └── README.md                          ← Module API reference
│
├── skills/
│   └── README.md                          ← 79 skills catalog
│
├── tooling/
│   ├── cli-reference.md                   ← Generator CLIs
│   ├── spike-methodology.md               ← Debugging workflow
│   └── pi-hypothesis-lab.md               ← Pi multi-agent lab
│
├── libraries/
│   ├── README.md                          ← Library docs index
│   ├── holonet.md                         ← Holonet architecture overview
│   ├── streams-ontology.md                ← BFO ontological foundations
│   └── streams-channels.md                ← Channel topology protocol
│
└── features/
    └── cop-chat-panel/
        └── README.md                      ← Chat panel design
```

---

## Source Materials

This documentation consolidates knowledge from these scattered locations:

| Source | Items | Status |
|--------|-------|--------|
| `thoughts/shared/plans/` | 30 plans | Consolidated into architecture/ + decisions/ |
| `thoughts/shared/handoffs/` | 41 kraken sessions | Digested into implementation/ |
| `thoughts/shared/specs/` | 8 specs (entity system, V3) | Consolidated into specifications/ |
| `thoughts/shared/research/` | 15 research docs | Consolidated into references/ |
| `thoughts/shared/alignments/` | 6 alignment sessions | Digested into implementation/ |
| `thoughts/cop-chat-panel/` | 13 COP design docs | Indexed in features/ |
| `.edin/` | 14 canonical Effect-TS docs | Consolidated into patterns/ |
| `src/lib/*/ARCHITECTURE.md` | ~15 inline docs | Referenced in patterns/ + libraries/ |
| `src/lib/holonet/docs/` | 12 holonet docs | Consolidated into architecture/holonet-transport.md |
| `src/lib/streams/docs/` | 5 stream docs | Consolidated into architecture/streams-library.md |
| `thoughts/shared/indexes/` | 3 resource indexes | Consolidated into references/ |
| `.claude/skills/` | 79 agent skills | Cataloged in skills/ |
| `assets/documents/pipeline-adr/` | 26 pipeline ADR docs | Referenced in architecture/ |

---

*Phase 7 (Documentation & DX), Epics 23-24 | 16 SP | 160 files | 61,721 lines*
