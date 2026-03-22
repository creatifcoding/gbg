# V3 Service Architecture Specification

> **Status**: Complete | **Author**: Architect-Prime (Val) | **Date**: 2026-01-25 | **Revised**: 2026-02-09
>
> Synthesized from AMS v2 (Entity/Event patterns, CQRS, Effect Cluster) and IIoT (Model/Repo patterns, DDL co-location, PostgreSQL extensions).

**Source**: `thoughts/shared/specs/2026-01-25-v3-service-architecture.md` (2,975 lines)

---

## Executive Summary

V3 merges two complementary architectures into a unified, event-sourced CQRS system:

| Pattern Source | Strength | V3 Adoption |
|----------------|----------|-------------|
| **AMS v2** | Entity + RPC definitions, Layer composition, EventLog | Entity system, deployment profiles |
| **IIoT** | Schema-Model separation, DDL co-location, Migrator.fromRecord | 3-layer schema architecture, infrastructure patterns |

### Core Principles

1. **Hybrid ES Boundaries** -- Event sourcing for decisions (alarms, work orders, equipment state); CRUD for data and reference (ADR-0012)
2. **Entities are actors** -- Effect Cluster entities for all domain aggregates
3. **Schema-first, Model-derived** -- Domain schemas define truth; persistence models adapt via field reuse
4. **Manual repos with decode utilities** -- Granular SQL control with `decodeFirst`, `decodeOptional`, `prepareUpdate`
5. **Multiple transports** -- `Entity.toRpcProxy`, `Entity.toHttp` for type-safe clients
6. **PostgreSQL-first** -- Single database with extensions (TimescaleDB, AGE, pg_lake)
7. **Swappable implementations** -- In-memory for tests, SQL for production (State service pattern)
8. **DDL co-location** -- Effect-wrapped DDL adjacent to Model definitions
9. **Status-based soft deletes** -- `status: 'retired'` not `deleted_at` timestamps
10. **Cursor-based pagination** -- Primary approach; offset pagination as fallback

---

## Layered Architecture

```
L3: Consumer Facades
  HTTP API (REST + OpenAPI) | RPC Handlers (Effect RPC) | WebSocket Handlers (real-time)
  Entity.toHttp / Entity.toRpcProxy

L2: Domain Services (Effect Cluster Entity)
  Commands (writes) | Queries (reads) | Events (EventLog) | State (Ref/SQL)
  Entity Handlers (implements RPC protocol)
  Observability: Logging | Metrics | Tracing | Audit

L1: Infrastructure
  Repositories (manual SQL) | EventLog + PG Journal | External Services
  PostgreSQL Cluster (TimescaleDB | AGE | pg_lake | PostGIS)
```

### Layer Responsibilities

| Layer | Purpose | Does NOT |
|-------|---------|----------|
| **L3** | Transport adaptation, auth, rate limiting, OpenAPI | Business logic, DB access, event emission |
| **L2** | Command/query handling, event emission, state management, domain invariants | SQL queries, transport details |
| **L1** | Persistence, event storage, external integrations | Business rules, transport logic |

---

## Three-Layer Schema Design

```
DOMAIN SCHEMAS (schemas/)
  identifiers.ts -- Branded IDs (AssetId, SiteId, DeviceId)
  assets.ts      -- Asset, Line, Machine, Sensor
  readings.ts    -- SensorReading, AggregatedReading
  alarms.ts      -- Alarm, AlarmContext, AlarmType
  errors.ts      -- Data.TaggedError definitions
            derives from
PERSISTENCE MODELS (models/)
  _common.ts     -- CreatedAt, UpdatedAt, OptionalMetadata
  assets/        -- AssetModel.ts + AssetModel.ddl.ts
  readings/      -- SensorReadingModel.ts + DDL
            used by
REPOSITORIES (repos/)
  _decode.ts     -- decodeOptional, decodeRows, decodeFirst
  AssetRepo.ts   -- Context.Tag + Layer.effect
```

### Key Patterns

**Branded Identifiers**:
```typescript
export const AssetId = Schema.String.pipe(Schema.brand('AssetId'))
export type AssetId = Schema.Schema.Type<typeof AssetId>
```

**TaggedClass for Domain Entities**:
```typescript
export class Asset extends Schema.TaggedClass<Asset>()('Asset', {
  id: AssetId,
  kind: AssetKind,
  status: AssetStatus,
  // ...
}) {
  isOperational(): boolean { return this.status !== 'retired' }
}
```

**Model Derivation** -- Models reuse schema fields with persistence transforms:

| Domain | Model | Purpose |
|--------|-------|---------|
| `Schema.optional()` | `Model.FieldOption()` | NULL <-> Option mapping |
| `BrandedId` | `Model.GeneratedByApp(Id)` | Client-provided PK |
| `Schema.DateTimeUtc` | `Schema.DateFromSelf` | PG Date object |

---

## Repository Patterns

Repositories use manual SQL with decode utilities for granular control:

```typescript
export class AssetRepo extends Context.Tag('v3/AssetRepo')<AssetRepo, AssetRepository>() {}

// Implementation with Layer.effect
export const AssetRepoLive = Layer.effect(AssetRepo, Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  const findById = (id: AssetId) =>
    Effect.gen(function* () {
      const rows = yield* sql`SELECT ... FROM assets WHERE id = ${id} LIMIT 1`
      return yield* decodeOptional(AssetModel)(rows)
    })

  return { findById, insert, update, query } satisfies AssetRepository
}))
```

### Decode Utilities

| Utility | Purpose |
|---------|---------|
| `decodeRow(schema)(row)` | Decode single row |
| `decodeRows(schema)(rows)` | Decode array of rows |
| `decodeOptional(schema)(rows)` | Decode 0-or-1 row to `Option` |
| `decodeFirst(schema)(rows)` | Decode first row (throws if empty) |
| `prepareUpdate(obj)` | Convert `Option` fields to null for SQL |

### ES Boundary Alignment

| Repository | Pattern | Rationale |
|------------|---------|-----------|
| **AssetRepo** | CRUD + audit events | Reference data |
| **AlarmRepo** | CRUD (read projection) | Write via EventLog |
| **WorkOrderRepo** | CRUD (read projection) | Write via EventLog |
| **SensorReadingRepo** | TimescaleDB INSERT | Time-series |

---

## Event Architecture

### EventGroup Definition

```typescript
export const AssetEvents = EventGroup.empty
  .add({ tag: 'AssetCreated', primaryKey: (p) => p.assetId, payload: Schema.Struct({...}) })
  .add({ tag: 'AssetUpdated', primaryKey: (p) => p.assetId, payload: Schema.Struct({...}) })
  .add({ tag: 'AssetDeleted', primaryKey: (p) => p.assetId, payload: Schema.Struct({...}) })
```

### Event Sourcing Flow

```
Client Request
  -> Entity Handler (L2): Validate + write event to EventLog
  -> EventLog + PG Journal:
      BEGIN TRANSACTION
        INSERT INTO events (tag, payload) VALUES (...)
        INSERT INTO assets (...) VALUES (...)  -- handler projection
      COMMIT
  -> On commit: Reactivity invalidation + external bus publish
```

### ES Boundaries (ADR-0012)

The litmus test: **"Would replaying events teach us about business decisions?"**

| ES Domain | Non-ES Domain |
|-----------|---------------|
| Alarm Lifecycle (ISA-18.2) | Sensor Telemetry (TimescaleDB) |
| Work Orders (CMMS) | Equipment Hierarchy (AGE graph) |
| Equipment State (OEE) | Device Configuration (CRUD) |
| Batch Records (FDA 21 CFR 11) | Master Data (CRUD) |

See [ADR-002: Hybrid Event Sourcing](../decisions/adr-002-hybrid-event-sourcing.md) for full rationale.

---

## Entity Patterns

### RPC Definition

```typescript
export class CreateAssetRpc extends Rpc.make('CreateAsset', {
  payload: { siteId: SiteId, kind: AssetKind, label: AssetLabel },
  success: Asset,
  error: AssetCommandError,
}) {}
```

### Handler Implementation

Handlers delegate to State services with optional EventLog:

```typescript
export const AssetEntityHandlers = AssetEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* AssetState
    const eventLogOption = yield* Effect.serviceOption(EventLog.EventLog)
    // ...
    return {
      CreateAsset: (envelope) => Effect.gen(function* () {
        const asset = yield* state.create({ /* params */ })
        yield* maybeEmit('AssetCreated', { assetId: asset.id, /* ... */ })
        return asset
      }),
    }
  })
)
```

### State Service Pattern (Swappable)

```typescript
// In-memory (tests)
export class AssetState extends Effect.Service<AssetState>()(
  '@gbg/tmnl/v3/AssetState', {
    effect: Effect.gen(function* () {
      const assets = yield* Ref.make(HashMap.empty<AssetId, AssetRecord>())
      return { create, findById, update, delete } satisfies AssetStateShape
    })
  }
) {}

// SQL-backed (production)
export const AssetStateSQLLayer = Layer.effect(AssetState, Effect.gen(function* () {
  const assetRepo = yield* AssetRepo
  return { create, findById, update, delete } satisfies AssetStateShape
}))
```

---

## Infrastructure Patterns

### DDL Co-location

Each Model has an adjacent `.ddl.ts` file:

```
models/assets/
  AssetModel.ts       -- Model.Class definition
  AssetModel.ddl.ts   -- CREATE TABLE DDL
```

### PostgreSQL Extensions

| Extension | Purpose | V3 Role |
|-----------|---------|---------|
| **TimescaleDB** | Time-series | Sensor readings, continuous aggregates |
| **Apache AGE** | Graph | Equipment hierarchy, RCA traversal |
| **pg_lake** | Iceberg | Cold storage archival (optional) |
| **pg_stat_statements** | Monitoring | Query performance analysis |
| **btree_gist** | Indexing | Exclusion constraints |

### Migration System

Uses `Migrator.fromRecord` with numbered migrations in FK dependency order:

```
0001_extensions -> 0002_schema -> 0003_graph
0010-0015: Core tables (sites, sectors, containers, assets)
0020-0022: Time-series (hypertables, continuous aggregates, compression)
0030-0031: Alarms + graph trigger
0040-0041: Event journal + outbox
0050: Permissions
0060: Seed data
```

### Deployment Profiles

| Profile | State | Cluster | SQL | Use |
|---------|-------|---------|-----|-----|
| **Test** | In-memory (`State.Default`) | None | None | Unit tests |
| **Dev** | In-memory | TestRunner | None | Integration tests |
| **Tauri** | SQLite (`AssetStateSQLLayer`) | TestRunner | SQLite | Desktop app |
| **Production** | PostgreSQL (`AssetStateSQLLayer`) | ShardManager | PostgreSQL | Distributed |

---

## Sequence Diagrams

### Command Write Flow (Asset Creation)

```
Client         Entity Handler    State Service    Repo          EventLog
  |                 |                 |              |              |
  | CreateAsset     |                 |              |              |
  |---------------->|                 |              |              |
  |                 | state.create()  |              |              |
  |                 |---------------->|              |              |
  |                 |                 | repo.insert()|              |
  |                 |                 |------------->|              |
  |                 |                 |              | SQL INSERT   |
  |                 |                 | decodeFirst()|              |
  |                 |                 |<-------------|              |
  |                 | asset           |              |              |
  |                 |<----------------|              |              |
  |                 | maybeEmit('AssetCreated', ...) |              |
  |                 |---------------------------------------------->|
  |                 |                 |              | SqlJournal   |
  | asset           |                 |              | INSERT       |
  |<----------------|                 |              |              |
```

### Query Read Flow (Asset Lookup)

```
Client         Entity Handler    State Service    Repo
  |                 |                 |              |
  | GetAsset(id)    |                 |              |
  |---------------->|                 |              |
  |                 | state.findById()|              |
  |                 |---------------->|              |
  |                 |                 | repo.findById()
  |                 |                 |------------->|
  |                 |                 | decodeOptional()
  |                 |                 |<-------------|
  |                 | Option<Asset>   |              |
  |                 |<----------------|              |
  | asset           |                 | (NO events)  |
  |<----------------|                 |              |
```

### Event Propagation Flow (Alarm Triggered)

```
Sensor Reading  Ingestion Adapter  AlarmService   EventLog      Handler (React)
     |                 |                |              |              |
     | value > thresh  |                |              |              |
     |---------------->|                |              |              |
     |                 | raiseAlarm()   |              |              |
     |                 |--------------->|              |              |
     |                 |                | INSERT alarm |              |
     |                 |                | emit('AlarmRaised', ...)    |
     |                 |                |------------->|              |
     |                 |                |              | persist entry|
     |                 |                |              | invoke handlers
     |                 |                |              |------------->|
     |                 |                |              |              | notify()
```

### Telemetry Ingestion to Rollup

```
OPC-UA Server  Adapter (MQTT)  TimescaleDB Hypertable  Cont.Agg (1min)  Query (Read)
     |              |                  |                      |               |
     | tag values   |                  |                      |               |
     |------------->|                  |                      |               |
     |              | INSERT INTO      |                      |               |
     |              | sensor_readings  |                      |               |
     |              |----------------->|                      |               |
     |              |                  | chunked by time+hash |               |
     |              |                  | background refresh   |               |
     |              |                  |--------------------->|               |
     |              |                  |                      | mat. view     |
     |              |                  |                      | update        |
     |              |                  |                      |               |
     |              |                  |                      |    SELECT     |
     |              |                  |                      |<--------------|
```

---

## Storage Architecture

```
+-------------------------------------------------------------------+
|                      STORAGE ARCHITECTURE                          |
+-------------------------------------------------------------------+
|                                                                    |
|  +--------------------------------------------------------------+ |
|  |                    PostgreSQL Cluster                          | |
|  |                                                                | |
|  |  +--------------+  +--------------+  +----------------------+ | |
|  |  |  ams Schema  |  |  iiot Schema |  |  ag_catalog Schema   | | |
|  |  |              |  |              |  |                      | | |
|  |  |  - assets    |  |  - plants    |  |  - iiot_graph        | | |
|  |  |  - sites     |  |  - lines     |  |    (vertices+edges)  | | |
|  |  |  - containers|  |  - machines  |  |  Apache AGE          | | |
|  |  |  - events    |  |  - sensors   |  |  (Cypher queries)    | | |
|  |  |              |  |              |  +----------------------+ | |
|  |  | Standard SQL |  | +----------+ |                           | |
|  |  | (Entity CRUD)|  | |TimescaleDB| |                          | |
|  |  |              |  | |Hypertables| |                          | |
|  |  +--------------+  | | -readings | |                          | |
|  |                     | | -alarms   | |                          | |
|  |                     | |Cont. Aggs | |                          | |
|  |                     | | -1min     | |                          | |
|  |                     | | -1hour    | |                          | |
|  |                     | | -1day     | |                          | |
|  |                     | +----------+ |                           | |
|  |                     +--------------+                           | |
|  |                                                                | |
|  |  +----------------------------------------------------------+ | |
|  |  |                  Event Journal                             | | |
|  |  |  ams_event_journal       iiot_event_journal                | | |
|  |  |  - id (UUID v7)          - id (UUID v7)                   | | |
|  |  |  - event (tag)           - event (tag)                    | | |
|  |  |  - primary_key           - primary_key                    | | |
|  |  |  - payload (MsgPack)     - payload (MsgPack)              | | |
|  |  |  - created_at            - created_at                     | | |
|  |  +----------------------------------------------------------+ | |
|  +--------------------------------------------------------------+ |
|                                                                    |
|  +-----------------------------+  +------------------------------+ |
|  |     Data Lifecycle          |  |    Retention Tiers            | |
|  |  HOT:  Raw (0-7 days)      |  |  sensor_readings: 30 days    | |
|  |  WARM: Compressed (7-30d)  |  |  readings_1min: 90 days      | |
|  |  COLD: Aggregated (30d+)   |  |  readings_1hour: 1 year      | |
|  +-----------------------------+  |  readings_1day: indefinite   | |
|                                    +------------------------------+ |
+-------------------------------------------------------------------+
```

---

## Industry Alignment

### ISA-95 Equipment Hierarchy Mapping

```
ISA-95 Level         TMNL Entity         PostgreSQL Table
-----------------------------------------------------------------
Enterprise           Site                 ams.sites
    |                  |
    +-- Site         Plant               iiot.plants
         |             |
         +-- Area    Sector              ams.sectors (planned)
              |        |
              +-- Line  Line             iiot.lines
                   |      |
                   +-- Cell  Machine     iiot.machines
                        |      |
                        +-- Unit  Sensor  iiot.sensors

Cross-cutting: Asset (ams.assets) can represent any level
```

**ISA-95 Equipment Element Levels (IEC 62264)** -- complete 15-level enum:

| Level | ISA-95 Name | TMNL Mapping |
|-------|-------------|--------------|
| 0 | ENTERPRISE | Site (top-level org) |
| 1 | SITE | Plant (physical location) |
| 2 | AREA | Sector (functional subdivision) |
| 3 | PROCESSCELL | IEC 61512-1 batch manufacturing |
| 4 | UNIT | IEC 61512-1 processing unit |
| 5 | PRODUCTIONLINE | Line (discrete manufacturing) |
| 6 | WORKCELL | Machine (coordinated set) |
| 7 | PRODUCTIONUNIT | Single production asset |
| 8-9 | STORAGEZONE/UNIT | Material storage |
| 10 | WORKCENTER | Grouped work units |
| 11 | WORKUNIT | Individual work station |
| 12-13 | EQUIPMENTMODULE/CONTROLMODULE | IEC 61512-1 modules |
| 14 | OTHER | Vendor-specific extensions |

### OPC-UA Information Model Mapping

| OPC-UA Concept | Effect-TS Pattern | Example |
|----------------|-------------------|---------|
| NodeId | Branded String | `DeviceId` |
| DataType | Schema.Literal | `Schema.Literal('Double', 'Int32', 'Boolean')` |
| VariableType | Schema.TaggedClass | `SensorReading` with value, quality, timestamp |
| ObjectType | Schema.TaggedClass | `Machine` with properties and methods |
| ReferenceType | EventGroup | `AlarmRaised`, `AssetMoved` relationships |
| AddressSpace | Repository | Query by hierarchical path |

### Unified Namespace (UNS) Topic Structure

```
Topic Pattern:
spBv1.0/{enterprise}/{site}/{area}/{line}/{cell}/{device}/{metric}

Examples:
spBv1.0/acme/chicago/assembly/line-01/cnc-001/spindle/rpm
spBv1.0/acme/chicago/assembly/line-01/cnc-001/spindle/temperature
spBv1.0/acme/chicago/assembly/line-01/cnc-001/STATE
```

Two implementation methods:

| Method | Approach | Trade-off |
|--------|----------|-----------|
| **Parris** (recommended for single-broker) | ISA-95 hierarchy in group_id with delimiters | Simple, requires parsing |
| **Schultz** (multi-site enterprise) | Multiple brokers at hierarchy levels, republish | Clean topics, operational complexity |

**Critical**: Sparkplug B payloads use **Protocol Buffers (Protobufs)**, NOT JSON. Adapter implementations must decode binary payloads.

### ISA-18.2 Alarm Management

Complete alarm state machine with audible bit:

| State | Audible | Description |
|-------|---------|-------------|
| NORMAL | 0 | No alarm condition |
| UNACKNOWLEDGED | 1 | Active, needs attention |
| ACKNOWLEDGED | 0 | Operator aware, still active |
| RTN_UNACKNOWLEDGED | 0 | Returned to normal, not ack'd |
| LATCH_UNACKNOWLEDGED | 1 | Latched alarm, needs ack |
| LATCH_ACKNOWLEDGED | 0 | Latched and acknowledged |
| SHELVED | 0 | Temporarily suppressed by operator |
| SUPPRESSED | 0 | Suppressed by system logic |
| OUT_OF_SERVICE | 0 | Disabled for maintenance |

Severity levels: `diagnostic` (L1), `advisory` (L2), `warning` (L3), `critical` (L4)

---

## Extended Pattern Catalog

### Pattern: Unified Namespace Routing

**Problem**: Multiple data sources (OPC-UA, MQTT/Sparkplug, Modbus) use different addressing schemes.

**Solution**: Ingestion adapter normalizes external addresses to internal `DeviceId`. Each protocol adapter implements `normalize: (source: TSource) => Effect.Effect<{ deviceId, timestamp, value, quality }>`.

### Pattern: Historian Rollup Tiers

**Problem**: Raw sensor data grows unboundedly.

**Solution**: TimescaleDB continuous aggregates at multiple time scales with automatic tier selection:

| Tier | Table | Bucket | Retention |
|------|-------|--------|-----------|
| Raw | `sensor_readings` | N/A | 30 days |
| 1-min | `readings_1min` | 1 minute | 90 days |
| 1-hour | `readings_1hour` | 1 hour | 1 year |
| 1-day | `readings_1day` | 1 day | Indefinite |

Query router selects tier based on time range: <1 day = raw, <30 days = 1min, <1 year = 1hour, else = 1day.

### Pattern: Alarm Lifecycle State Machine

**Problem**: Alarm state transitions need ISA-18.2 compliance.

**Solution**: Complete state machine with valid transitions enforced at the domain level:

```
NORMAL -> UNACKNOWLEDGED -> ACKNOWLEDGED -> RTN_UNACKNOWLEDGED -> NORMAL
                         -> SHELVED (timeout -> UNACKNOWLEDGED)
                         -> SUPPRESSED (unsuppress -> UNACKNOWLEDGED)
```

### Pattern: Command & Control with Saga

**Problem**: Operator commands affect multiple systems (PLC, database, audit log) and need rollback.

**Solution**: Saga pattern with compensation events. Steps: authorize -> send to PLC -> record in DB (compensate: reverse PLC on failure) -> emit audit event. Aligned with ISA-88 Batch Control.

### Pattern: Enterprise Integration Boundary

**Problem**: MES/ERP systems need read access to operational data without bypassing domain logic.

**Solution**: Outbound integration via event projection (EventLog handlers push to MES). Inbound integration via command boundary (ERP order sync transforms to domain commands). Aligned with ISA-95 B2MML.

---

## Pitfalls & Guardrails

### Schema Pitfalls

| Pitfall | Guardrail |
|---------|-----------|
| Using `Schema.optional()` for DB nullable | Use `Schema.optionalWith(T, { nullable: true })` for DB fields |
| Using `DateTimeUtc` in Models | Use `Schema.DateFromSelf` in Model fields |
| Duplicating schema fields in Model | Use `Entity.fields.fieldName` for reuse |
| Raw TypeScript types in domain | Use Effect Schema for all domain types |

### Repository Pitfalls

| Pitfall | Guardrail |
|---------|-----------|
| Forgetting to decode SQL results | Always use `decodeFirst`/`decodeRows`/`decodeOptional` |
| Option not converted for SQL | Use `prepareUpdate()` to convert Option -> null |
| Missing AS aliases in SELECT | Use `transformResultNames` in client config |

### Event Pitfalls

| Pitfall | Guardrail |
|---------|-----------|
| Emitting before state write | Emit AFTER successful state operation |
| Blocking operations in handlers | Keep handlers fast; async for projections |
| Missing primaryKey function | Always define `primaryKey: (p) => p.entityId` |

### Layer Composition Pitfalls

| Pitfall | Guardrail |
|---------|-----------|
| Missing Layer.provide | Use explicit layer composition tests |
| Circular dependencies | Use Layer.effect for late binding |
| Forgetting EventLog in production | Make EventLog required for non-test modes |

### Transaction Pitfalls

| Pitfall | Guardrail |
|---------|-----------|
| Emitting inside transaction | Emit AFTER `sql.withTransaction` completes |
| Long-running transaction | Keep transaction scope minimal |
| Missing version increment | Always increment `version` on update |
| Saga without compensation | Define compensation events for each saga step |

---

## Migration Path

### Phase 1: Foundation (IIoT-first)

Establish v3 patterns using IIoT as proving ground. Migrate IIoT schemas to Schema-first pattern, implement EventGroup definitions, add PostgreSQL EventLog journal.

### Phase 2: Entity Extraction

Extract all domain aggregates as Effect Cluster entities: AlarmEntity, SensorEntity, AssetEntity. Cross-entity queries via L3 facades.

### Phase 3: AMS Integration

Merge AMS v2 patterns into unified architecture. Adopt BFO ontology for asset classification, migrate AssetEntity with property/trait system, add provenance tracking.

### Phase 4: Production Readiness

HttpApi generation from entities, OpenAPI documentation, distributed tracing (Effect spans), metrics collection, health checks and readiness probes.

---

## Resolved & Open Questions

### Resolved (Council Decisions)

| Question | Decision |
|----------|----------|
| Event sourcing strategy? | **Hybrid ES boundaries** (ADR-0012) |
| Dual-database architecture? | **No** -- single PostgreSQL with extensions |
| Batch operations? | **Yes** -- `insertBatch` using `SqlResolver.ordered` |
| Pagination strategy? | **Cursor-based** primary, offset fallback |
| Soft deletes? | **Status-based** (`status: 'retired'`) |
| Transaction scope? | **Auto-commit** for single-entity; `sql.withTransaction` for multi-entity same-aggregate; **Saga** for cross-aggregate |

### Open (Pending Resolution)

1. **Profile composition** -- How do WMS + TMS profiles compose when deployed together?
2. **Compaction strategy** -- How to handle property/trait events in compaction?
3. **Conflict resolution** -- CRDT semantics for concurrent entity updates?
4. **Event replay infrastructure** -- How to rebuild projections from events?
5. **Observability metrics** -- Which metrics matter for event-sourced systems?

---

## Entity Definition Flow

```
1. DOMAIN SCHEMAS     schemas/{entity}.ts
   Schema.TaggedClass, Schema.Literal, branded IDs

2. ERROR SCHEMAS      errors/{entity}.ts
   Data.TaggedError per error case

3. PERSISTENCE MODELS models/{entity}/
   {Entity}Model.ts + {Entity}Model.ddl.ts

4. REPOSITORY         repos/{Entity}Repo.ts
   Interface + Context.Tag + Layer.effect

5. EVENTS             events/{entity}-events.ts
   EventGroup definition + payload schemas

6. STATE SERVICE      services/{entity}-state.ts
   In-memory (Effect.Service) + SQL (Layer.effect)

7. ENTITY             entities/{entity}.ts
   RPC definitions (Rpc.make) + Entity.make

8. HANDLERS           handlers/{entity}-handlers.ts
   Entity.toLayer() + EventLog.makeClient

9. LAYER COMPOSITION  layers/deployments.ts
   TestLayer, SqlTestLayer, make{Mode}Layer factories
```

---

## Cross-References

| Topic | Document |
|-------|----------|
| Entity System spec | [Entity System](entity-system.md) |
| ES Boundaries | [ADR-002](../decisions/adr-002-hybrid-event-sourcing.md) |
| NATS-Only Broker | [ADR-001](../decisions/adr-001-nats-only-broker.md) |
| HTTP Transport | [HTTP Transport](../architecture/http-transport.md) |
| WebSocket Streaming | [WebSocket Realtime](../architecture/websocket-realtime.md) |
| RPC Inventory | [RPC Inventory](../architecture/rpc-inventory.md) |
| Concurrency Model | [Concurrency Model](../architecture/concurrency-model.md) |
| IIoT API Reference | [API Reference](../api/README.md) |
| Skills Catalog | [Skills](../skills/README.md) |
| Quickstart Guide | [Quickstart](../quickstart.md) |

---

*Consolidated from `thoughts/shared/specs/2026-01-25-v3-service-architecture.md` (2,975 lines)*
