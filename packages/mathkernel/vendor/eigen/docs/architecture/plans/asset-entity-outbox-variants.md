# AssetEntity + Transactional Outbox — Architectural Variants

**Date:** 2026-02-06
**Status:** EXPLORATION — no implementation decision yet
**Context:** AssetEntity is definition-only (4 RPCs, no handler). AssetRpcs (8 stateless graph queries) are dead weight in IIoTRpcs. Both can be repurposed.

---

## Current System State

### What Exists

| Layer | File | Status |
|-------|------|--------|
| Entity definition | `entity/AssetEntity.ts` | 4 RPCs: Get, GetChildren, GetHierarchy, Update |
| Entity RPC group | `rpc/AssetEntityRpcs.ts` | `EntityProxy.toRpcGroup(AssetEntity)` — in IIoTRpcs |
| Stateless query RPCs | `rpc/AssetRpcs.ts` | 8 graph queries (ListPlants, GetPlantHierarchy, etc.) |
| Polymorphic schema | `schemas/asset-polymorphic.ts` | `Asset` TaggedClass with `kind: EquipmentLevel` |
| L2 service | `services/l2/AssetService.ts` | Hierarchy traversal via `GraphClient` |
| Domain errors | `errors/asset.ts` | AssetNotFoundError, AssetValidationError, AssetConflictError |
| HTTP routes | `http/api.ts` + `proxy-handlers.ts` | Routes registered, proxy wired |
| RPC handlers | `http/rpc-server.ts` | `EntityProxyServer.layerRpcHandlers(AssetEntity)` |

### What's Missing

| Layer | Gap |
|-------|-----|
| Machine | No `machines/AssetMachine.ts` |
| Entity handler | No `AssetEntity.toLayer()` |
| EntityStack | Not in `EntityHandlersLayer` merge |
| State service | No `AssetState` |

### Key Schema: asset-polymorphic.ts

```typescript
export class Asset extends Schema.TaggedClass<Asset>()('Asset', {
  id: AssetId,
  name: Schema.NonEmptyString,
  kind: EquipmentLevel,        // enterprise|site|area|plant|line|workcell|machine|sensor|device
  status: AssetStatus,          // active|inactive|maintenance|decommissioned
  parentId: Schema.optional(AssetId),
  properties: Schema.optional(AssetProperties),
  location: Schema.optional(AssetLocation),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.optional(Schema.DateTimeUtc),
})
```

### ID Prefix → Entity Resolution

| Prefix | Entity | EquipmentLevel |
|--------|--------|----------------|
| `ENT-` | EnterpriseEntity | enterprise |
| `SIT-` | SiteEntity | site |
| `ARA-` | AreaEntity | area |
| `PLT-` | PlantEntity | plant |
| `LIN-` | LineEntity | line |
| `WCL-` | WorkCellEntity | workcell |
| `MCH-` | MachineAssetEntity | machine |
| `DEV-` | DeviceEntity | device |
| `SNS-` | SensorAssetEntity | sensor |

---

## Variant 1: Outbox-Backed Materialized Projection — P(0.35)

### Concept

AssetEntity is the **read-side projection** of all 13 concrete entities, backed by a transactional outbox. Concrete entity handlers atomically write state mutation + outbox event. AssetEntity tails the outbox, materializes events into polymorphic `AssetRecord`, and serves read queries over the projection.

### Data Flow

```
Plant.Create → PlantMachine → state write + outbox event (atomic)
                                          ↓
                              AssetEntity tails outbox
                                          ↓
                              Materializes AssetRecord { kind: 'plant', ... }
                                          ↓
                              Asset.Get / Asset.GetChildren → reads projection
```

### Architecture

- **Write path**: Unchanged. Concrete entities own their state machines.
- **Outbox**: Each entity handler writes an `AssetChanged` event to the outbox table alongside its state mutation. Single transaction.
- **Projection**: AssetEntity polls/tails the outbox, maps typed events → polymorphic `AssetRecord`, stores in a denormalized asset table.
- **Read path**: `Asset.Get` reads from the asset table. `Asset.GetChildren` queries by `parentId`. `Asset.GetHierarchy` walks the `parentId` chain.

### What Changes

| Component | Change |
|-----------|--------|
| Each entity handler | Add outbox event write (atomic with state) |
| New: `AssetOutbox` table | `(event_id, asset_id, kind, payload, created_at, relayed_at)` |
| New: `AssetProjection` table | Materialized `AssetRecord` rows |
| `AssetEntity.toLayer()` | Reads from projection table |
| New: `AssetProjector` service | Tails outbox, materializes records |

### Strengths

- Clean CQRS separation — entities don't know about the projection
- Outbox guarantees eventual consistency without dual-writes
- `AssetRecord` schema already matches the projection shape
- Graph queries (`ListPlants`, `GetHierarchy`) become reads over denormalized data

### Weaknesses

- Eventual consistency — read-after-write may see stale data
- Requires a projection service (daemon or effect fiber)
- Two storage surfaces (entity state + asset projection)

### Fit Score: 7/10

Fits existing architecture well. Entities stay independent. Asset layer is purely additive.

---

## Variant 2: Cross-Entity Event Gateway — P(0.25)

### Concept

Every concrete entity mutation flows *through* the AssetEntity layer. AssetEntity wraps dispatch in outbox semantics: write event to outbox first (durable), then forward to concrete entity. The outbox guarantees delivery to downstream consumers even on crash.

### Data Flow

```
Client → Asset.Dispatch({ assetId: 'PLT-x', action: 'Create', payload })
           ↓
         AssetEntity writes outbox event (durable)
           ↓
         Resolves prefix → forwards to PlantEntity.Create
           ↓
         Concrete entity executes, returns result
           ↓
         Outbox relay publishes event to subscribers
```

### Architecture

- **Write path**: All mutations enter via AssetEntity. It's the command gateway.
- **Outbox**: Written BEFORE forwarding. If the forward fails, the outbox still has the intent.
- **Concrete entities**: Execute normally, unaware they were invoked via Asset.
- **Read path**: Same as Variant 1 (projection over outbox events).

### What Changes

| Component | Change |
|-----------|--------|
| New: `Asset.Dispatch` RPC | Polymorphic command envelope |
| `AssetEntity.toLayer()` | Prefix routing + outbox write + forward |
| New: `AssetOutbox` table | Durable intent store |
| HTTP proxy | `/api/assets/dispatch/:entityId` routes all mutations |
| Existing entity proxies | Still work independently (backward compat) |

### Strengths

- Single ingestion point for all hierarchy mutations
- Outbox-first guarantees — event is durable before execution
- Natural place for cross-cutting concerns (audit, rate limiting, authz)
- Backward compatible — existing entity endpoints still work directly

### Weaknesses

- Adds latency (extra hop through Asset layer)
- Coupling — Asset must understand all entity payloads
- If Asset goes down, all mutations blocked (single point of failure)
- `Dispatch` RPC needs a polymorphic payload schema (complex)

### Fit Score: 6/10

Powerful but invasive. Changes the write path for all entities. Better suited for a v2 API.

---

## Variant 3: Saga Coordinator with Outbox Journal — P(0.20)

### Concept

For operations spanning multiple entities (decommission plant → cascade to lines → workcells → machines), AssetEntity acts as a **process manager**. Each step is journaled in the outbox. Failures trigger compensation via journal replay.

### Data Flow

```
Asset.DecommissionHierarchy({ assetId: 'PLT-x' })
  ↓
  Journal: [step-1: PLT-x decommission, status: PENDING]
  ↓ forward to Plant.Decommission → success
  Journal: [step-1: COMPLETED, step-2: LIN-a deactivate, status: PENDING]
  ↓ forward to Line.Deactivate → success
  Journal: [step-2: COMPLETED, step-3: WCL-b deactivate, status: PENDING]
  ↓ forward to WorkCell.Deactivate → timeout!
  Journal: [step-3: RETRY_PENDING] ← compensate later
```

### Architecture

- **Saga definition**: AssetEntity knows the hierarchy tree shape (via `GetHierarchy`).
- **Journal**: Each saga step is written to outbox before execution.
- **Execution**: Steps are executed sequentially or in controlled parallelism.
- **Compensation**: On failure, journal provides replay points.
- **Queries**: `Asset.GetSagaStatus` reads journal for in-progress sagas.

### What Changes

| Component | Change |
|-----------|--------|
| New: `AssetSaga` definitions | Per-operation step sequences |
| New: `SagaJournal` table | `(saga_id, step, asset_id, action, status, payload)` |
| `AssetEntity.toLayer()` | Saga orchestrator logic |
| New: `SagaResumeService` | Polls journal for incomplete sagas |

### Strengths

- Solves the real problem of multi-entity cascading operations
- Journal provides full audit trail of cross-entity operations
- Compensatable — partial failures don't leave orphaned state
- Natural fit for ISA-95 hierarchy (parent → child cascades are endemic)

### Weaknesses

- Saga complexity is high (compensation logic per operation type)
- Requires idempotent entity handlers (for retry safety)
- Long-running sagas need timeout/deadletter handling
- Testing sagas is significantly harder than testing individual entities

### Fit Score: 5/10

High value for the decommission/cascade use case, but heavy machinery. Better as a phase 2 addition after the basic projection (Variant 1) is stable.

---

## Variant 4: CDC Hub with Enriched Events — P(0.12)

### Concept

AssetEntity passively observes all entity cluster events. Each state change is captured in the outbox, enriched with hierarchy context (parent chain, equipment level, materialized path), and published for downstream consumers. No routing — purely observational.

### Data Flow

```
PlantEntity → state change → cluster event
                               ↓
              AssetEntity observes (passive subscription)
                               ↓
              Enriches with hierarchy context:
              { assetId: 'PLT-x', level: 'plant',
                path: '/ENT-acme/SIT-chicago/PLT-x',
                event: 'StatusChanged', from: 'commissioning', to: 'operational' }
                               ↓
              Outbox write → relay to Kafka/NATS/webhook
```

### Architecture

- **Write path**: Unchanged. Entities mutate independently.
- **Observation**: AssetEntity subscribes to cluster entity events (if Effect Cluster supports it) or entities explicitly publish to a shared event bus.
- **Enrichment**: Resolves parentId chain, adds materialized path, equipment level.
- **Outbox**: Enriched events written durably. Relay picks them up.

### What Changes

| Component | Change |
|-----------|--------|
| New: cluster event subscription | AssetEntity subscribes to all entity events |
| New: `EnrichedAssetEvent` schema | Event + hierarchy context |
| New: `AssetOutbox` table | Enriched events for relay |
| `AssetEntity.toLayer()` | Subscription + enrichment logic |
| New: `OutboxRelay` service | Publishes to external systems |

### Strengths

- Zero impact on write path — purely additive
- Rich events for downstream consumers (dashboards, audit, external)
- `AssetHierarchy` schema already has `path` and `depth`
- Outbox guarantees at-least-once delivery

### Weaknesses

- Requires cluster-level event subscription (may not exist in Effect Cluster)
- If subscription isn't available, entities must explicitly publish (coupling)
- Enrichment requires hierarchy lookups (latency per event)
- Passive observation means no command-side guarantees

### Fit Score: 4/10

Elegant for the monitoring/audit use case, but requires cluster infrastructure that may not exist yet. Falls back to explicit publish from entities, which negates the "passive" benefit.

---

## Variant 5: Dual-Write Prevention Layer — P(0.08)

### Concept

Concrete entities only write state. They never touch event streams directly. AssetEntity owns the outbox and is the **sole writer** to the event bus. It polls/tails entity state changes, writes to outbox atomically, and relays. Eliminates the dual-write problem.

### Data Flow

```
Concrete entities: write state ONLY (no events)
                     ↓
AssetEntity: tails state changes (polling or WAL)
                     ↓
            Outbox write (atomic, enriched)
                     ↓
            Event relay (guaranteed delivery)
```

### Architecture

- **Write path**: Entities write state only. No event publishing.
- **Tailing**: AssetEntity reads from entity state stores (CDC via polling, WAL, or triggers).
- **Outbox**: State diffs written as events. Relay publishes.
- **Feature flags**: The `IIoTFeatureFlags` toggle becomes: relay active (events enabled) vs relay paused (CRUD mode).

### What Changes

| Component | Change |
|-----------|--------|
| Each entity handler | REMOVE event publishing (if any) |
| New: state change tailing | CDC mechanism per state store |
| New: `AssetOutbox` table | Captured state diffs |
| `AssetEntity.toLayer()` | Tailing + diff → event mapping |
| `IIoTFeatureFlags` | Controls relay, not entity behavior |

### Strengths

- Eliminates dual-write problem entirely
- Single source of truth for events (AssetEntity)
- Clean mapping to the existing feature flag toggle
- Entities become simpler (no event publishing concerns)

### Weaknesses

- CDC tailing is infrastructure-heavy (requires DB-level support)
- State diffs are lossy compared to intent-based events
- Polling adds latency; WAL tailing adds operational complexity
- Tight coupling to storage layer

### Fit Score: 3/10

Architecturally clean but requires deep infrastructure. Better suited for a production-grade deployment with PostgreSQL logical replication, not the in-memory TestRunner development path.

---

## Higher-Scoring Hybrid Variants

---

## Variant 6: Projection + Gateway Hybrid (V1 + V2) — P(0.55)

### Concept

AssetEntity serves **dual roles**:

1. **Read projection** (V1) — materializes a polymorphic view of all entities
2. **Optional command gateway** (V2) — accepts mutations via `Asset.Dispatch`, wraps in outbox, forwards

The key insight: the **read path is always via projection**, but the **write path has two modes**:
- **Direct mode**: Clients call `Plant.Create` directly. Entity handler writes state + outbox event. AssetProjector tails outbox, materializes AssetRecord.
- **Gateway mode**: Clients call `Asset.Dispatch`. AssetEntity writes outbox, forwards to concrete entity, projector materializes.

Both modes feed the same outbox → same projection. Gateway mode is opt-in for clients who want polymorphic dispatch.

### Data Flow

```
Mode A (Direct):
  Plant.Create → PlantMachine → state + outbox → AssetProjector → AssetRecord

Mode B (Gateway):
  Asset.Dispatch → outbox write → Plant.Create → PlantMachine → state → (outbox already written)
```

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AssetEntity                           │
│                                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐ │
│  │  Asset.Get    │  │ Asset.       │  │ Asset.        │ │
│  │  GetChildren  │  │ GetHierarchy │  │ Dispatch      │ │
│  │  (reads       │  │ (reads       │  │ (write gate,  │ │
│  │   projection) │  │  projection) │  │  optional)    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘ │
│         │                  │                  │          │
│         ▼                  ▼                  ▼          │
│  ┌─────────────────────────────────────────────────────┐│
│  │              AssetProjection (read)                  ││
│  │  Materialized AssetRecord table                     ││
│  │  parentId index → GetChildren                       ││
│  │  path column → GetHierarchy                         ││
│  └─────────────────────────▲───────────────────────────┘│
│                            │                             │
│  ┌─────────────────────────┴───────────────────────────┐│
│  │              AssetOutbox (write)                     ││
│  │  Fed by: entity handlers (direct) OR gateway        ││
│  │  Tailed by: AssetProjector fiber                    ││
│  │  Relayed to: external consumers                     ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### What the Machine Looks Like

No state graph. The "machine" is a **projection engine**:

```typescript
// AssetMachine procedures:
// 1. Get → read from projection (no state machine needed)
// 2. GetChildren → query projection by parentId
// 3. GetHierarchy → walk parentId chain in projection
// 4. Update → forward to concrete entity via prefix routing
// 5. (Optional) Dispatch → outbox write + forward
```

### RPC Surface

| RPC | Source | Purpose |
|-----|--------|---------|
| `Asset.Get` | Existing | Read from projection |
| `Asset.GetChildren` | Existing | Query by parentId |
| `Asset.GetHierarchy` | Existing | Walk parent chain |
| `Asset.Update` | Existing | Forward to concrete entity |
| `Asset.Dispatch` | **New** | Polymorphic command gateway (optional) |

The old `AssetRpcs` graph queries (`ListPlants`, etc.) become **projection queries** — they read from the same materialized table instead of traversing a graph client.

### Strengths

- Both write modes feed the same outbox/projection (consistency)
- Backward compatible — direct entity endpoints still work
- Gateway mode is opt-in (no disruption)
- Projection solves the read performance problem for hierarchy queries
- Single outbox table simplifies event delivery infrastructure

### Fit Score: 9/10

---

## Variant 7: Projection + Saga Hybrid (V1 + V3) — P(0.45)

### Concept

AssetEntity is both:

1. **Materialized projection** (V1) — polymorphic read view
2. **Saga coordinator** (V3) — for multi-entity cascading operations

The projection gives AssetEntity **hierarchy awareness** — it knows the tree. The saga coordinator uses that awareness to orchestrate cascading operations with outbox-journaled steps.

### Data Flow

```
Single entity ops:
  Plant.Create → outbox event → AssetProjector → AssetRecord

Multi-entity ops:
  Asset.DecommissionTree({ assetId: 'PLT-x' })
    ↓
  AssetEntity reads projection → resolves children tree
    ↓
  Saga journal: [PLT-x, LIN-a, LIN-b, WCL-c, MCH-d, ...]
    ↓
  Execute steps with outbox-per-step
    ↓
  Each step's completion → projection updated automatically
```

### Key Insight

The projection IS the saga's navigation map. `GetChildren` and `GetHierarchy` aren't just read queries — they're the **planning phase** of the saga. The saga walks the projection to discover what needs to cascade, then executes step-by-step with journal durability.

### New RPCs

| RPC | Purpose |
|-----|---------|
| `Asset.DecommissionTree` | Cascade decommission down hierarchy |
| `Asset.ActivateTree` | Cascade activation up to parent |
| `Asset.TransferSubtree` | Move subtree to new parent |
| `Asset.AuditTree` | Return full tree state snapshot |

### Strengths

- Projection provides the map; saga provides the execution
- Cascading operations are the #1 missing capability in the current system
- Journal provides audit trail for compliance (ISA-95 traceability)
- Each saga step is independently recoverable

### Weaknesses

- Saga complexity (compensation logic, idempotency requirements)
- Projection must be up-to-date before saga can plan (consistency window)
- Testing saga failure modes is hard

### Fit Score: 8/10

---

## Variant 8: Full Stack — Projection + Gateway + Saga (V1 + V2 + V3) — P(0.40)

### Concept

AssetEntity is the **unified asset management surface**:

1. **Projection** — polymorphic read view (always on)
2. **Gateway** — optional write ingestion point with outbox
3. **Saga** — multi-entity orchestration with journal

### Architecture Tiers

```
Tier 1 (Foundation): AssetProjection
  - Outbox-fed materialized view
  - Get, GetChildren, GetHierarchy
  - Fed by entity handler outbox writes
  - Deployable immediately

Tier 2 (Enhancement): AssetGateway
  - Asset.Dispatch polymorphic command ingestion
  - Outbox-first write semantics
  - Prefix routing to concrete entities
  - Deployable when needed

Tier 3 (Advanced): AssetSaga
  - Multi-entity cascading operations
  - Journal-backed step execution
  - Compensation on failure
  - Deployable for compliance use cases
```

### Implementation Sequence

```
Phase 1: Projection (Variant 1)
  ├─ AssetProjector service (tails outbox)
  ├─ AssetEntity.toLayer() with read handlers
  ├─ Entity handlers add outbox writes
  └─ Tests: projection consistency, hierarchy queries

Phase 2: Gateway (Variant 2)
  ├─ Asset.Dispatch RPC + polymorphic payload schema
  ├─ Prefix resolver + entity forwarding
  ├─ Outbox integration (write before forward)
  └─ Tests: dispatch routing, outbox durability

Phase 3: Saga (Variant 3)
  ├─ Saga definitions (DecommissionTree, TransferSubtree)
  ├─ SagaJournal table + step execution
  ├─ Compensation handlers
  └─ Tests: partial failure, replay, compensation
```

### Strengths

- Incrementally deployable — each tier adds value independently
- Phase 1 alone solves the immediate problem (Asset handler + read queries)
- Full stack covers read, write, and multi-entity orchestration
- Single outbox feeds all three tiers

### Weaknesses

- Full stack is significant scope
- Phase 3 may never be needed (YAGNI risk)
- Complexity budget — is the value worth the machinery?

### Fit Score: 7/10

High potential but YAGNI risk on Phase 3. Score would be 9/10 if scoped to Phase 1 + Phase 2 only.

---

## Variant Ranking

| # | Variant | P(intent) | Fit | Complexity | Recommendation |
|---|---------|-----------|-----|------------|----------------|
| 6 | Projection + Gateway | 0.55 | 9/10 | Medium | **Best balance** |
| 7 | Projection + Saga | 0.45 | 8/10 | High | Best for compliance |
| 1 | Pure Projection | 0.35 | 7/10 | Low | **Start here** |
| 8 | Full Stack | 0.40 | 7/10 | Very High | Only if all 3 tiers needed |
| 2 | Pure Gateway | 0.25 | 6/10 | Medium | Needs projection anyway |
| 3 | Pure Saga | 0.20 | 5/10 | High | Needs projection anyway |
| 4 | CDC Hub | 0.12 | 4/10 | Medium | Requires cluster infra |
| 5 | Dual-Write Prevention | 0.08 | 3/10 | High | Requires DB-level CDC |

### Recommended Path

**Start with Variant 1 (Pure Projection)** as the foundation. It's low complexity, immediately useful, and every higher variant builds on it. Then evaluate Variant 6 (+ Gateway) when polymorphic command dispatch becomes a real need.

---

---

## YAGNI Research Findings (2026-02-06)

### Critical Discovery: The Outbox Solves a Problem This Architecture Does Not Have

Effect Cluster entity actors are **single-writer**. Each entity is a stateful actor with unique identity and exactly-once request processing. There is NO dual-write problem:

- **ES entities** (Alarm, WorkOrder, EquipmentState) write events as their source of truth. The event IS the write. No "state write + event publish" pair.
- **Non-ES entities** (asset hierarchy) write state directly. As actors, there's no concurrent writer to create inconsistency.
- **Adding an outbox CREATES a dual-write** — you'd be writing to the actor AND the outbox table, which is the exact problem the outbox pattern claims to solve.

> "With actor model and event sourcing combined, you only need to read from the database when instantiating an actor. Since the actor is in-memory and contains an up-to-date state, it can process new commands close to the user." — Dominik Badel

### Case Studies: When Outbox Was Essential

All documented production incidents are from **web-scale distributed microservices**, NOT IIoT:

| Case | Domain | Problem | Outcome |
|------|--------|---------|---------|
| **Fintech 2B-row incident** (Jovanovic) | Banking | Outbox table grew to 2B rows; 30+ replicas each polling → lock contention storm | Required dedicated relay service refactoring |
| **Varo Bank** (Shokrian) | Banking | DB writes succeeded but broker publishes failed → balance inconsistencies | Outbox resolved dual-write but added infrastructure |
| **Amazon Aurora** (NP Blog) | E-commerce | DB spent CPU managing outbox locks instead of executing queries | Outbox itself became the bottleneck |

**Scale triggers**: Multiple services writing to BOTH a database AND a message broker. Horizontal scaling > 5 replicas. Regulatory requirements (fintech, pharma).

### Counter-Studies: When Outbox Was Premature

| Source | Key Finding |
|--------|-------------|
| **"Stop Overusing the Outbox"** (squer.io) | Outbox turns DB into the bottleneck — the thing event-driven architectures avoid. Alternatives: Event Sourcing (events ARE truth) or "Listen to Yourself" (write to Kafka first, consume own events). |
| **Actor Model + ES** (Badel) | Actor IS the single writer. Dual-write doesn't exist. Adding outbox introduces the problem. |
| **Debezium team** | "CDC and Outbox is usually a better alternative to Event Sourcing." But this presupposes you're NOT already event sourcing. If you ARE, the outbox solves nothing. |
| **Akka's single-writer principle** | Only one active EventSourcedBehavior per persistenceId. Projections read from the event journal directly, not from an outbox. |
| **Martin Fowler (CQRS)** | "For most systems CQRS adds risky complexity." Only use on specific bounded contexts, not system-wide. |

### Cost of Premature Outbox Infrastructure

- Added DB table + polling/tailing infrastructure
- Relay process management (separate daemon or fiber)
- Monitoring for outbox backlogs (a new failure mode you didn't have)
- Complexity in testing (must now test projection consistency)
- Developer cognitive load on a small team

### YAGNI Classification Per Variant

| Component | Verdict | Rationale |
|-----------|---------|-----------|
| **Projection (read model)** | CONDITIONALLY NEEDED | Cross-entity hierarchy queries are real. But at 13 entities, direct queries may suffice. |
| **Outbox table** | **PREMATURE** | No dual-write problem exists. No external integration (Kafka/NATS) yet. |
| **Gateway (Dispatch RPC)** | PREMATURE | Direct entity RPCs work fine. Polymorphic dispatch is convenience, not necessity. |
| **Saga coordinator** | PREMATURE | No cascading operations exist yet. Build when `DecommissionTree` is a real requirement. |
| **CDC/WAL tailing** | PREMATURE | Requires production DB infrastructure not yet in place. |
| **External relay** | PREMATURE | No external consumers exist. |

### Decision Matrix

| Criterion | This Codebase | Assessment |
|-----------|---------------|------------|
| Architecture | Effect Cluster entity actors (single-writer) | **No dual-write problem** |
| Team size | Single team | **Outbox infra has high per-developer cost** |
| Entity count | 13 entities | **Below threshold where projection pays off** |
| Event sourcing | 3 ES entities already avoid dual-write | **No outbox needed for ES entities** |
| Query pattern | Hierarchy traversal (GetChildren, GetHierarchy) | **Read-heavy — projection has conditional value** |
| Compliance | FDA 21 CFR (WorkOrder), ISA-18.2 (Alarm) | **Already handled by ES entities, not assets** |
| External consumers | None (no Kafka, no NATS, no webhooks) | **Outbox relay has zero consumers** |

### Revised Recommendation

**Strip the outbox from all variants.** The right path:

1. **Now**: Direct entity queries with client-side composition
2. **When hierarchy traversals are provably slow** (>100ms): Synchronous projection — entity handlers write to a projection table in the **same database transaction**. No outbox. No relay daemon. No eventual consistency.
3. **When external consumers exist** (Kafka/NATS): THEN introduce outbox for that specific integration point.

The **synchronous projection** approach (same-transaction write to both entity state and asset_projection table) gives the read-model benefit without any outbox machinery. The `AssetRecord` schema already matches the projection row shape. Feature flags can gate the projection write.

### Updated Variant Scores (Post-Research)

| # | Variant | Original Fit | Revised Fit | YAGNI Risk | Note |
|---|---------|-------------|-------------|------------|------|
| 1 | Pure Projection (stripped of outbox) | 7/10 | **8/10** | Low | Synchronous, same-transaction |
| 6 | Projection + Gateway | 9/10 | **6/10** | Medium | Gateway adds latency + coupling without proven need |
| 7 | Projection + Saga | 8/10 | **4/10** | High | Saga has zero consumers today |
| 8 | Full Stack | 7/10 | **3/10** | Very High | Three layers of premature abstraction |
| 2 | Pure Gateway | 6/10 | **3/10** | High | Outbox-first design is backwards for actors |
| 3 | Pure Saga | 5/10 | **3/10** | High | No cascading operations exist |
| 4 | CDC Hub | 4/10 | **2/10** | Very High | Requires infra that doesn't exist |
| 5 | Dual-Write Prevention | 3/10 | **1/10** | Extreme | Solves a problem actors already solve |

### Sources (16)

1. [Scaling the Outbox Pattern](https://www.milanjovanovic.tech/blog/scaling-the-outbox-pattern) — Milan Jovanovic (2B-row fintech incident)
2. [Stop Overusing the Outbox Pattern](https://www.squer.io/blog/stop-overusing-the-outbox-pattern) — squer.io
3. [Actor Model and Event-Sourcing](https://medium.com/@dominikbb/actor-model-and-event-sourcing-a-perfect-combination-for-distributed-applications-7f27c944e0f3) — Dominik Badel
4. [CQRS](https://www.martinfowler.com/bliki/CQRS.html) — Martin Fowler
5. [Tackling Complexity in CQRS](https://vladikk.com/2017/03/20/tackling-complexity-in-cqrs/) — Vladik Khononov
6. [Dual-Write Problem](https://www.confluent.io/blog/dual-write-problem/) — Confluent
7. [Event Sourcing vs CDC](https://debezium.io/blog/2020/02/10/event-sourcing-vs-cdc/) — Debezium
8. [Cluster and Sharding](https://deepwiki.com/Effect-TS/effect/5.2-cluster-management) — Effect-TS DeepWiki
9. [Projections Guide](https://event-driven.io/en/projections_and_read_models_in_event_driven_architecture/) — Event-Driven.io
10. [Listen to Yourself Pattern](https://codeopinion.com/listen-to-yourself-pattern-is-it-an-alternative-to-the-outbox-pattern/) — CodeOpinion
11. [Akka Event Sourcing](https://doc.akka.io/docs/akka/current/typed/persistence.html) — akka.io
12. [ISA-95 Equipment Model](https://reference.opcfoundation.org/ISA-95/v100/docs/8.2) — OPC Foundation
13. [ISA-95 Explained](https://www.mesengineer.com/2023/08/20/isa-95-explained/) — MES Engineer
14. [Outbox Pattern: Theory to Production](https://www.npiontko.pro/2025/05/19/outbox-pattern) — NP Blog
15. [Transactional Outbox](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) — AWS
16. [Live Projections for Read Models](https://www.kurrent.io/blog/live-projections-for-read-models-with-event-sourcing-and-cqrs) — Kurrent

---

## Remaining Open Questions

1. **Projection storage**: In-memory (for dev) vs SQL (for prod)? Follow the existing `StateService` pattern?
2. **AssetRpcs disposition**: Archive to `rpc/v1/` now, or keep until projection replaces graph queries?
3. **When to introduce outbox**: What external consumer (Kafka, NATS, dashboard service) would trigger the need?
4. **Read/write ratio**: What is the actual production ratio for ISA-95 hierarchy queries? If both < 10/min, direct queries are fine.
