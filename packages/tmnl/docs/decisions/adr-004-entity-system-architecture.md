---
title: "ADR-004: Entity System Architecture"
date: 2026-01-30
status: Accepted
deciders: Val (Architect), Prime
source: thoughts/shared/specs/entity-system/00-unified-entity-system-spec.md
---

# ADR-004: Entity System Architecture

**Status:** Accepted | **Date:** 2026-01-30 | **Deciders:** Val, Prime

## Context

The IIoT v3 system requires a unified entity model for 10 ISA-95 equipment types (Enterprise through Device) plus 3 decision-critical domain types (Alarm, WorkOrder, EquipmentState). The entity system must support:

1. Type-safe schemas with runtime validation
2. Event sourcing for audit-critical domains
3. Hierarchy traversal for cascade operations
4. Actor-based concurrency via Effect Cluster `Entity.make()`
5. Multiple transports (RPC, HTTP, WebSocket)
6. State graph enforcement per entity type

## Decision

### Entity Pattern: Machine + Entity

Each IIoT entity type follows the **Machine + Entity** pattern:

| Layer | Artifact | Purpose |
|-------|----------|---------|
| Schema | `Schema.TaggedClass` | Runtime-validated domain type with branded IDs |
| State Graph | XState-compatible transition map | Valid state transitions per entity |
| Entity | `Entity.make(name, rpcs)` | Effect Cluster actor with RPC handlers |
| State Service | `Context.Tag` + in-memory/SQL Layer | Swappable persistence |
| RPC Group | `EntityProxy.toRpcGroup()` | Type-safe client generation |

### Why Effect Cluster Entity.make()

- **Actor isolation**: Each entity instance has its own mailbox, eliminating shared-state races
- **Location transparency**: Entities can be local or distributed without code changes
- **Type-safe RPCs**: `Rpc.make()` generates request/response schemas automatically
- **Layer composition**: Handlers compose via Effect's Layer system for testability

### Schema Architecture: Three Layers

```
Domain Schemas (schemas/assets/{entity}/)
  -> Persistence Models (models/)
  -> Repositories (repos/)
```

- **Domain schemas** define truth using `Schema.TaggedClass`
- **Models** adapt for persistence via field reuse
- **Repos** provide manual SQL with `decodeFirst`, `decodeOptional` utilities

### State Graph Delegation

Each entity type owns a state graph that defines valid transitions:

- **ISA-95 assets** (9 types): `planned -> active -> inactive -> decommissioned` (linear, commutative)
- **Alarm** (ISA-18.2): `unacknowledged -> acknowledged -> cleared | shelved | suppressed` (non-commutative)
- **EquipmentState** (OEE): `running | idle | stopped | changeover | ...` (permissive mesh, non-commutative)
- **WorkOrder** (FDA Part 11): `created -> submitted -> approved -> started -> completed | failed` (non-commutative at decision points)

Handlers enforce transitions; invalid transitions are rejected.

### Hierarchy Path

`HierarchyPath` is a typed data structure (not a raw string) representing ISA-95 ancestry:

- Immutable after construction
- O(1) depth comparison, O(d) traversal
- Runtime-validated parent-child relationships
- Used for cascade operations and cross-entity coordination

## Consequences

### Positive

- **Type safety**: Branded IDs prevent mixing `SiteId` with `PlantId` at compile time
- **Testability**: In-memory state service layers for unit tests, SQL for production
- **Code generation**: `tools/generate-entity.ts` scaffolds all 5 files from a name
- **Uniformity**: All 13 entity types follow identical patterns; learning one teaches all
- **Audit compliance**: Event-sourced domains (alarm, work order, equipment state) have full replay

### Negative

- **Boilerplate per entity**: 5 files per entity type (schema, barrel, entity, state, rpcs) -- mitigated by generator CLI
- **Non-commutative operations**: Alarm and equipment state transitions are order-dependent (see [IIoT Invariants](../specifications/iiot-invariants.md) for TLA+ analysis)
- **Cross-entity coordination**: Actor isolation means hierarchy invariants require saga patterns or synchronous guards (future work)

## Entity Catalog

| Entity | ISA-95 Level | ID Prefix | Parent | Event Sourced |
|--------|:---:|:---:|--------|:---:|
| Enterprise | L4 | ENT- | (root) | No |
| Site | L3 | SIT- | Enterprise | No |
| Area | L2 | ARA- | Site | No |
| Plant | L3 | PLT- | Area or Site | No |
| Line | L1 | LIN- | Plant | No |
| WorkCell | L1 | WCL- | Line | No |
| Machine | L1 | MCH- | Line or WorkCell | No |
| Sensor | L0 | SNS- | Machine | No |
| Device | L0 | DEV- | Machine | No |
| Alarm | -- | ALM- | Equipment | **Yes** (ISA-18.2) |
| WorkOrder | -- | WO- | Equipment | **Yes** (FDA Part 11) |
| EquipmentState | -- | EQS- | Equipment | **Yes** (OEE) |

## References

- [Entity System Specification](../specifications/entity-system.md)
- [IIoT Invariants Analysis](../specifications/iiot-invariants.md)
- [ADR-002: Event Sourcing Boundaries](adr-002-hybrid-event-sourcing.md)
- [V3 Architecture Specification](../specifications/v3-architecture.md)
- Source: `thoughts/shared/specs/entity-system/00-unified-entity-system-spec.md`
