# V3 Service Architecture Specification

**Author**: Architect-Prime (Val)  
**Date**: 2026-01-25  
**Status**: Complete  
**Based On**: AMS v2 + IIoT research synthesis (11 documents, ~10,400 lines)

---

## Executive Summary

This specification defines the v3 service architecture for TMNL, synthesizing the best practices from AMS v2 (Entity/Event patterns, CQRS, Effect Cluster) and IIoT (Model/Repo patterns, DDL co-location, PostgreSQL extensions) into a unified, event-sourced, CQRS architecture.

### Core Principles

1. **Hybrid ES Boundaries: Decisions get ES, data gets CRUD** — Event sourcing for domains where replay teaches us about business decisions (alarms, work orders, equipment state); CRUD + audit for reference data and telemetry. The litmus test: "Would replaying events teach us something about business decisions?" (See ADR-0012)
2. **Entities are actors** — Effect Cluster entities for all domain aggregates
3. **Schema-first, Model-derived** — Domain schemas define truth, persistence models adapt via field reuse
4. **Manual repos with decode utilities** — Granular SQL control, explicit validation (`decodeFirst`, `decodeOptional`, `prepareUpdate`)
5. **Multiple transports** — Entity.toRpcProxy, Entity.toHttp for type-safe clients
6. **PostgreSQL-first** — Single database with extensions (TimescaleDB, AGE, pg_lake) rather than multiple databases
7. **Swappable implementations** — In-memory for tests, SQL for production (State service pattern)
8. **DDL co-location** — Effect-wrapped DDL adjacent to Model definitions
9. **Status-based soft deletes** — Use `status: 'retired'` not `deleted_at` timestamps
10. **Cursor-based pagination** — Primary approach; offset pagination as fallback only

### Key Innovation

V3 merges two complementary patterns:

| Pattern Source | Strength | V3 Adoption |
|----------------|----------|-------------|
| **AMS v2** | Entity + RPC definitions, Layer composition, EventLog | Entity system, deployment profiles |
| **IIoT** | Schema-Model separation, DDL co-location, Migrator.fromRecord | 3-layer schema architecture, infrastructure patterns |

---

## 1. Layered Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              L3: Consumer Facades                            │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  HttpApi (REST) │  │   RPC Handlers  │  │   WebSocket Handlers        │  │
│  │  + OpenAPI      │  │   (Effect RPC)  │  │   (real-time subscriptions) │  │
│  └────────┬────────┘  └────────┬────────┘  └──────────────┬──────────────┘  │
│           │                    │                          │                  │
│           └────────────────────┼──────────────────────────┘                  │
│                                │                                             │
│                      Entity.toHttp / Entity.toRpcProxy                       │
└────────────────────────────────┼─────────────────────────────────────────────┘
                                 │
┌────────────────────────────────┼─────────────────────────────────────────────┐
│                         L2: Domain Services                                   │
│  ┌─────────────────────────────┴─────────────────────────────────────────┐   │
│  │                      Effect Cluster Entity                             │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │   Commands  │  │   Queries   │  │   Events    │  │    State    │   │   │
│  │  │  (writes)   │  │  (reads)    │  │  (EventLog) │  │  (Ref/SQL)  │   │   │
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │   │
│  │         │                │                │                │          │   │
│  │         └────────────────┴────────────────┴────────────────┘          │   │
│  │                                   │                                    │   │
│  │                          Entity Handlers                               │   │
│  │                    (implements RPC protocol)                           │   │
│  └───────────────────────────────────┬───────────────────────────────────┘   │
│                                      │                                        │
│  Observability: Logging │ Metrics │ Tracing │ Audit                          │
└──────────────────────────────────────┼────────────────────────────────────────┘
                                       │
┌──────────────────────────────────────┼────────────────────────────────────────┐
│                          L1: Infrastructure                                    │
│  ┌───────────────────┐  ┌────────────────────┐  ┌─────────────────────────┐   │
│  │    Repositories   │  │    EventLog +      │  │    External Services    │   │
│  │   (manual SQL)    │  │    PG Journal      │  │   (notifications, etc)  │   │
│  └─────────┬─────────┘  └──────────┬─────────┘  └────────────┬────────────┘   │
│            │                       │                         │                │
│            └───────────────────────┼─────────────────────────┘                │
│                                    │                                          │
│                            PostgreSQL Cluster                                 │
│                     (TimescaleDB │ AGE │ pg_lake │ PostGIS)                   │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Layer Responsibilities

### L3: Consumer Facades

**Purpose**: Expose domain capabilities to external consumers via multiple transports.

**Responsibilities:**
- Transport adaptation (HTTP, RPC, WebSocket)
- Request/response transformation
- Authentication/Authorization enforcement
- Rate limiting, caching headers
- OpenAPI documentation generation

**Pattern:**
```typescript
// Entity automatically provides transport adapters
const AssetEntityLive = AssetEntity.toLayer(handlers)

// HTTP API (OpenAPI generated)
const AssetHttpApi = AssetEntity.toHttp(handlers)

// RPC Proxy (type-safe client generation)
const AssetRpcProxy = AssetEntity.toRpcProxy()
```

**What L3 does NOT do:**
- Business logic
- Direct database access
- Event emission

---

### L2: Domain Services (Effect Cluster Entities)

**Purpose**: Encapsulate domain aggregates as distributed actors with event-sourced state.

**Responsibilities:**
- Command handling (write operations)
- Query handling (read operations)
- Event emission (via EventLog)
- State management (via State service)
- Domain invariant enforcement
- Observability (logging, metrics, tracing)

**Key Pattern: Entity Definition**
```typescript
export const AssetEntity = Entity.make('Asset', [
  // Commands (8)
  CreateAssetRpc,
  UpdateAssetRpc,
  MoveAssetRpc,
  SetAssetPropertyRpc,
  RemoveAssetPropertyRpc,
  AddAssetTraitRpc,
  RemoveAssetTraitRpc,
  DeleteAssetRpc,
  
  // Queries (13)
  GetAssetRpc,
  GetAssetSummaryRpc,
  AssetExistsRpc,
  ListAssetsBySiteRpc,
  ListAssetsBySectorRpc,
  ListAssetsByContainerRpc,
  SearchAssetsRpc,
  GetAssetPropertyRpc,
  GetAssetPropertiesRpc,
  CountAssetsBySiteRpc,
  CountAssetsByStatusRpc,
  CountAssetsByKindRpc,
])
```

---

### L1: Infrastructure

**Purpose**: Provide foundational services for persistence, messaging, and external integrations.

**Components:**
- **Repositories** — Manual SQL with decode utilities
- **EventLog + PG Journal** — Event persistence and replay
- **External Services** — Notifications, integrations

---

## 3. Schema Architecture (Schema-Sage Synthesis)

### 3.1 Three-Layer Schema Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                          SCHEMA LAYERS                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  DOMAIN SCHEMAS (schemas/)                                          │
│  ├── identifiers.ts      # Branded IDs (AssetId, SiteId, etc.)     │
│  ├── assets.ts           # Asset, Line, Machine, Sensor            │
│  ├── readings.ts         # SensorReading, AggregatedReading        │
│  ├── alarms.ts           # Alarm, AlarmContext, AlarmType          │
│  └── errors.ts           # Data.TaggedError definitions            │
│                                                                     │
│                          ↓ derives from                             │
│                                                                     │
│  PERSISTENCE MODELS (models/)                                       │
│  ├── _common.ts          # CreatedAt, UpdatedAt, OptionalMetadata  │
│  ├── assets/             # AssetModel.ts + AssetModel.ddl.ts       │
│  ├── readings/           # SensorReadingModel.ts + DDL             │
│  └── alarms/             # AlarmModel.ts + DDL                     │
│                                                                     │
│                          ↓ used by                                  │
│                                                                     │
│  REPOSITORIES (repos/)                                              │
│  ├── _decode.ts          # decodeOptional, decodeRows, decodeFirst │
│  ├── AssetRepo.ts        # Context.Tag + Layer.effect              │
│  └── AlarmRepo.ts        # Domain-specific operations              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Branded Identifier Pattern

All domain identifiers use branded strings for compile-time type safety:

```typescript
// Pattern: Schema.String.pipe(Schema.brand('TypeName'))
export const AssetId = Schema.String.pipe(Schema.brand('AssetId'))
export type AssetId = Schema.Schema.Type<typeof AssetId>

export const SiteId = Schema.String.pipe(Schema.brand('SiteId'))
export type SiteId = Schema.Schema.Type<typeof SiteId>

export const DeviceId = Schema.String.pipe(Schema.brand('DeviceId'))
export type DeviceId = Schema.Schema.Type<typeof DeviceId>
```

**Characteristics:**
- Runtime: plain string
- Compile-time: distinct types (cannot mix AssetId with SiteId)
- Double-export pattern: schema + type

### 3.3 Schema.TaggedClass for Domain Entities

```typescript
export class Asset extends Schema.TaggedClass<Asset>()('Asset', {
  id: AssetId,
  bfoClass: BfoMaterialEntity,  // BFO ontology classification
  kind: AssetKind,
  label: AssetLabel,
  description: Schema.optional(AssetDescription),
  status: AssetStatus,
  location: AssetLocation,
  baseProperties: BaseAssetProperties,
  properties: AssetProperties,
  traits: AssetTraits,
  tags: Tags,
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {
  // Domain methods
  isOperational(): boolean { return this.status !== 'retired' }
  get siteId(): SiteId { return this.location.siteId }
}
```

### 3.4 Schema.Literal for Enums

```typescript
export const AssetStatus = Schema.Literal(
  'available', 'in_use', 'maintenance', 'retired'
)
export type AssetStatus = Schema.Schema.Type<typeof AssetStatus>

export const AlarmSeverity = Schema.Literal('info', 'warning', 'critical', 'emergency')
export type AlarmSeverity = Schema.Schema.Type<typeof AlarmSeverity>
```

### 3.5 Optional Field Patterns

**Domain (may be absent):**
```typescript
description: Schema.optional(Schema.String)
```

**Database (NULL handling):**
```typescript
message: Schema.optionalWith(Schema.String, { nullable: true })
```

### 3.6 Model Derivation from Schema

Models derive from domain schemas, adding persistence-specific transforms:

```typescript
export class AssetModel extends Model.Class<AssetModel>('AssetModel')({
  // Direct field reuse from domain schema
  kind: Asset.fields.kind,
  label: Asset.fields.label,
  status: Asset.fields.status,

  // Model-specific transforms
  id: Model.GeneratedByApp(AssetId),              // Client-provided PK
  description: Model.FieldOption(AssetDescription), // NULL ↔ Option
  siteId: SiteId,
  sectorId: Model.FieldOption(SectorId),
  containerId: Model.FieldOption(ContainerId),
  
  // JSON columns
  basePropertiesJson: Model.FieldOption(MetadataRecord),
  tagsJson: Model.FieldOption(Schema.Array(Schema.String)),
  
  // DB-only fields
  version: Schema.Number.pipe(Schema.int()),
  createdAt: Model.DateTimeInsertFromDate,
  updatedAt: Model.DateTimeUpdateFromDate,
}) {}
```

**Key Transforms:**

| Domain | Model | Purpose |
|--------|-------|---------|
| `Schema.optional()` | `Model.FieldOption()` | NULL ↔ Option mapping |
| `BrandedId` | `Model.GeneratedByApp(Id)` | Client-provided PK |
| `BrandedId` | `Model.Generated(Id)` | DB-generated PK |
| `Schema.DateTimeUtc` | `Schema.DateFromSelf` | PG Date object |

### 3.7 Error Schema Patterns

```typescript
export class AssetNotFoundError extends Data.TaggedError('AssetNotFoundError')<{
  readonly assetId: AssetId
  readonly message?: string
}> {}

export class AssetConflictError extends Data.TaggedError('AssetConflictError')<{
  readonly assetId: AssetId
  readonly reason: string
  readonly expectedVersion: number
  readonly actualVersion: number
}> {}

// Union for service error signatures
export const AssetCommandError = Schema.Union(
  AssetNotFoundError,
  AssetValidationError,
  AssetConflictError,
  AssetPermissionError
)
```

---

## 4. Repository Patterns (Repo-Maven Synthesis)

### 4.1 Repository Interface Pattern

```typescript
export interface AssetRepository {
  readonly findById: (id: AssetId) => Effect.Effect<Option.Option<AssetModel>, AssetRepoError>
  readonly findBySite: (siteId: SiteId) => Effect.Effect<readonly AssetModel[], AssetRepoError>
  readonly insert: (asset: typeof AssetModel.insert.Type) => Effect.Effect<AssetModel, AssetRepoError>
  readonly update: (asset: typeof AssetModel.update.Type) => Effect.Effect<AssetModel, AssetRepoError>
  
  // Domain-specific operations
  readonly checkOut: (id: AssetId, userId: string) => Effect.Effect<AssetModel, AssetRepoError>
  readonly checkIn: (id: AssetId) => Effect.Effect<AssetModel, AssetRepoError>
  
  // Query builder
  readonly query: (params: {
    siteId?: SiteId
    status?: AssetStatus
    kind?: AssetKind
    limit?: number
  }) => Effect.Effect<readonly AssetModel[], AssetRepoError>
}
```

### 4.2 Context.Tag Repository Definition

```typescript
export class AssetRepo extends Context.Tag('v3/AssetRepo')<
  AssetRepo,
  AssetRepository
>() {}
```

### 4.3 Repository Implementation with Decode Utilities

```typescript
export const AssetRepoLive = Layer.effect(
  AssetRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findById = (id: AssetId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            kind,
            label,
            description,
            status,
            site_id AS "siteId",
            sector_id AS "sectorId",
            container_id AS "containerId",
            base_properties_json AS "basePropertiesJson",
            tags_json AS "tagsJson",
            version,
            created_at AS "createdAt",
            updated_at AS "updatedAt"
          FROM assets
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(AssetModel)(rows)
      })

    const insert = (asset: typeof AssetModel.insert.Type) =>
      Effect.gen(function* () {
        // Convert Option → null for SQL
        const description = Option.getOrNull(asset.description)
        const sectorId = Option.getOrNull(asset.sectorId)
        const containerId = Option.getOrNull(asset.containerId)
        
        const rows = yield* sql`
          INSERT INTO assets (id, kind, label, description, status, site_id, sector_id, container_id, version)
          VALUES (${asset.id}, ${asset.kind}, ${asset.label}, ${description}, ${asset.status}, ${asset.siteId}, ${sectorId}, ${containerId}, 1)
          RETURNING *
        `
        return yield* decodeFirst(AssetModel)(rows)
      })

    return {
      findById,
      insert,
      // ... other operations
    } satisfies AssetRepository
  })
)
```

### 4.4 Decode Utilities

```typescript
// _decode.ts

export const decodeRow =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (row: unknown): Effect.Effect<A, ParseResult.ParseError, R> =>
    Schema.decodeUnknown(schema)(row)

export const decodeRows =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<readonly A[], ParseResult.ParseError, R> =>
    Schema.decodeUnknown(Schema.Array(schema))(rows)

export const decodeOptional =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<Option.Option<A>, ParseResult.ParseError, R> =>
    rows.length === 0
      ? Effect.succeed(Option.none())
      : Schema.decodeUnknown(schema)(rows[0]).pipe(Effect.map(Option.some))

export const decodeFirst =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<A, ParseResult.ParseError, R> =>
    Schema.decodeUnknown(schema)(rows[0])

export const prepareUpdate = <T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue
    if (Option.isOption(value)) {
      result[key] = Option.getOrNull(value)
    } else {
      result[key] = value
    }
  }
  return result
}
```


### 4.5 Repository ES Boundary Alignment

Repositories follow the ES boundary decisions from ADR-0012:

| Repository | Persistence Pattern | Rationale |
|------------|---------------------|-----------|
| **AssetRepo** | CRUD + audit events | Assets are reference data; current state matters |
| **SiteRepo** | CRUD | Master data; rarely changes |
| **SectorRepo** | CRUD | Reference data |
| **DeviceConfigRepo** | CRUD + audit log | Configuration is not a decision |
| **AlarmRepo** | CRUD (projection) | **Read model only** — write via EventLog |
| **WorkOrderRepo** | CRUD (projection) | **Read model only** — write via EventLog |
| **SensorReadingRepo** | TimescaleDB INSERT | Time-series, not events |

**Key Insight**: For ES domains (alarms, work orders), the repository is a **read projection** maintained by event handlers. Writes go through `EventLog.group`, which triggers handlers that update the projection.

```typescript
// ES Domain: Alarm write flow
// 1. Command triggers EventLog write
yield* alarmEventLog.write('AlarmTriggered', { alarmId, deviceId, severity })

// 2. Event handler updates projection (in same transaction)
EventLog.group(AlarmEvents, (handlers) =>
  handlers.handle('AlarmTriggered', ({ payload }) =>
    alarmRepo.insert(payload) // Projection update
  )
)

// Non-ES Domain: Asset write flow
// Direct repository write + audit event
yield* assetRepo.insert(assetData)
yield* maybeEmit('AssetCreated', { assetId, ... }) // Audit only
```
---

## 5. Event Architecture (Event-Oracle Synthesis)

### 5.1 EventGroup Definition

```typescript
export const AssetEvents = EventGroup.empty
  .add({
    tag: 'AssetCreated',
    primaryKey: (payload) => payload.assetId,
    payload: Schema.Struct({
      assetId: AssetId,
      siteId: SiteId,
      kind: AssetKind,
      label: AssetLabel,
      createdBy: IdentityId,
    }),
  })
  .add({
    tag: 'AssetUpdated',
    primaryKey: (payload) => payload.assetId,
    payload: Schema.Struct({
      assetId: AssetId,
      label: Schema.optional(AssetLabel),
      status: Schema.optional(AssetStatus),
      updatedBy: IdentityId,
    }),
  })
  .add({
    tag: 'AssetMoved',
    primaryKey: (payload) => payload.assetId,
    payload: Schema.Struct({
      assetId: AssetId,
      fromSiteId: SiteId,
      toSiteId: SiteId,
      toSectorId: Schema.optional(SectorId),
      toContainerId: Schema.optional(ContainerId),
      movedBy: IdentityId,
    }),
  })
  .add({
    tag: 'AssetDeleted',
    primaryKey: (payload) => payload.assetId,
    payload: Schema.Struct({
      assetId: AssetId,
      deletedBy: IdentityId,
    }),
  })
```

### 5.2 Event Handler Registration

```typescript
export const AssetEventHandlers = EventLog.group(AssetEvents, (handlers) =>
  handlers
    .handle('AssetCreated', ({ payload, entry }) =>
      Effect.gen(function* () {
        const repo = yield* AssetRepo
        yield* repo.insert({
          id: payload.assetId,
          siteId: payload.siteId,
          kind: payload.kind,
          label: payload.label,
          status: 'available',
          version: 1,
          // ... other fields
        })
      })
    )
    .handle('AssetUpdated', ({ payload, entry }) =>
      Effect.gen(function* () {
        const repo = yield* AssetRepo
        yield* repo.update({
          id: payload.assetId,
          label: payload.label,
          status: payload.status,
        })
      })
    )
    .handle('AssetDeleted', ({ payload }) =>
      Effect.gen(function* () {
        const repo = yield* AssetRepo
        yield* repo.delete(payload.assetId)
      })
    )
)
```

### 5.3 Reactivity Bindings

```typescript
export const AssetReactivity = EventLog.groupReactivity(AssetEvents, {
  AssetCreated: ['assets', 'asset-count', 'site-assets'],
  AssetUpdated: ['assets', 'asset-detail'],
  AssetMoved: ['assets', 'site-assets'],
  AssetDeleted: ['assets', 'asset-count', 'site-assets'],
})
```

### 5.4 Event Sourcing Flow

```
Client Request
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Entity Handler (L2)                           │
│  1. Validate domain rules                                        │
│  2. Write event to EventLog                                      │
└──────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EventLog + PG Journal                         │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ BEGIN TRANSACTION                                          │  │
│  │   INSERT INTO events (id, tag, payload, ...) VALUES (...)  │  │
│  │   -- Event handler executes within same transaction --     │  │
│  │   INSERT INTO assets (...) VALUES (...)                    │  │
│  │ COMMIT                                                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  3. On commit: notify Reactivity (invalidate queries)            │
│  4. On commit: publish to external bus (if configured)           │
└──────────────────────────────────────────────────────────────────┘
```

### 5.5 Type-Safe Event Tags

```typescript
export const AssetEventTag = Schema.Literal(
  'AssetCreated',
  'AssetUpdated',
  'AssetMoved',
  'AssetPropertySet',
  'AssetPropertyRemoved',
  'AssetTraitAdded',
  'AssetTraitRemoved',
  'AssetDeleted'
)
type AssetEventTag = typeof AssetEventTag.Type
```


### 5.6 Event Sourcing Boundaries (ADR-0012)

Not all domains benefit from event sourcing. The v3 architecture adopts **explicit ES boundaries** based on a simple litmus test:

> **"Would replaying the events teach us something about business decisions?"**
> - **YES** → Event source it
> - **NO** → CRUD it (or use purpose-built storage)

#### ES Boundary Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IIoT PERSISTENCE BOUNDARIES                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐    ┌─────────────────────────────────────┐│
│  │     EVENT SOURCED (ES)      │    │         NOT EVENT SOURCED           ││
│  │   "Decisions & Audit"       │    │       "Data & Reference"            ││
│  ├─────────────────────────────┤    ├─────────────────────────────────────┤│
│  │                             │    │                                     ││
│  │  • Alarm Lifecycle          │    │  • Sensor Telemetry                 ││
│  │    - Triggered              │    │    → TimescaleDB hypertables        ││
│  │    - Acknowledged           │    │                                     ││
│  │    - Cleared                │    │  • Equipment Hierarchy              ││
│  │    - Escalated              │    │    → Apache AGE graph + CRUD        ││
│  │                             │    │                                     ││
│  │  • Work Orders              │    │  • Device Configuration             ││
│  │    - Created                │    │    → CRUD + audit log table         ││
│  │    - Submitted              │    │                                     ││
│  │    - Approved/Rejected      │    │  • Real-time Dashboard State        ││
│  │    - Started                │    │    → Materialized views             ││
│  │    - Completed              │    │                                     ││
│  │    - Closed                 │    │  • Continuous Aggregates            ││
│  │                             │    │    → TimescaleDB rollups            ││
│  │  • Equipment State Changes  │    │                                     ││
│  │    - Operational→Degraded   │    │  • Master Data (Sites, Plants)      ││
│  │    - Degraded→Faulted       │    │    → CRUD tables                    ││
│  │    - Maintenance Mode       │    │                                     ││
│  │                             │    │                                     ││
│  │  • Batch Records            │    │                                     ││
│  │  • Quality Events           │    │                                     ││
│  │  • Operator Actions         │    │                                     ││
│  │                             │    │                                     ││
│  └─────────────────────────────┘    └─────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### ISA-95 Activity Model Alignment

The boundary aligns with ISA-95's activity model:

```
Definition → Capability → Schedule → Request → Response → Performance
└──────────────────────────────────┘ └────────────────────────────────┘
        REFERENCE DATA (CRUD)              DECISIONS (Event Sourced)
```

- **Definitions & Capabilities**: What CAN happen (static, CRUD)
- **Requests & Responses**: What DID happen (decisions, ES)

#### ES Implementation Pattern: Alarm Aggregate

For domains that ARE event-sourced, use `EventLog.group` with aggregate projection:

```typescript
import { EventLog, Schema } from 'effect'

// Alarm events
const AlarmTriggered = Schema.TaggedStruct('AlarmTriggered', {
  alarmId: AlarmId,
  deviceId: DeviceId,
  severity: AlarmSeverity,
  triggeredAt: Schema.DateTimeUtc,
})

const AlarmAcknowledged = Schema.TaggedStruct('AlarmAcknowledged', {
  alarmId: AlarmId,
  acknowledgedBy: Schema.String,
  acknowledgedAt: Schema.DateTimeUtc,
})

const AlarmCleared = Schema.TaggedStruct('AlarmCleared', {
  alarmId: AlarmId,
  clearedAt: Schema.DateTimeUtc,
})

const AlarmEvent = Schema.Union(AlarmTriggered, AlarmAcknowledged, AlarmCleared)

// Event log with aggregate projection
const AlarmEventLog = EventLog.group(AlarmEvent, {
  aggregate: (events) => events.reduce((alarm, event) => {
    switch (event._tag) {
      case 'AlarmTriggered':
        return { ...event, status: 'active' as const }
      case 'AlarmAcknowledged':
        return { ...alarm, ...event, status: 'acknowledged' as const }
      case 'AlarmCleared':
        return { ...alarm, ...event, status: 'cleared' as const }
    }
  }, null as Alarm | null)
})
```

#### Non-ES Implementation Pattern: Device Config

For domains that are NOT event-sourced, use CRUD with an audit log:

```typescript
// Device configuration - CRUD with audit
const updateDeviceConfig = (deviceId: DeviceId, config: DeviceConfig) =>
  Effect.gen(function* () {
    const previous = yield* getDeviceConfig(deviceId)

    // Update current state (CRUD)
    yield* sql\`
      UPDATE iiot.device_config
      SET sampling_rate = \${config.samplingRate},
          alarm_threshold = \${config.alarmThreshold},
          updated_at = NOW()
      WHERE device_id = \${deviceId}
    \`

    // Audit log (NOT event sourcing - just history)
    yield* sql\`
      INSERT INTO iiot.config_audit_log (device_id, field, old_value, new_value, changed_by, changed_at)
      SELECT \${deviceId}, key, old.value, new.value, \${userId}, NOW()
      FROM jsonb_each_text(\${previous}::jsonb) old
      FULL OUTER JOIN jsonb_each_text(\${config}::jsonb) new USING (key)
      WHERE old.value IS DISTINCT FROM new.value
    \`
  })
```

#### Decision Criteria Summary

| Characteristic | ES Fit | CRUD Fit |
|----------------|--------|----------|
| Irreversible decisions by accountable humans | Yes | - |
| Regulatory requirements for immutable history | Yes | - |
| Need for temporal queries ("state at time T?") | Yes | - |
| Causality chains matter ("what caused this?") | Yes | - |
| High-volume raw data without semantic meaning | - | Yes |
| No business decision attached to each write | - | Yes |
| "Current state" query is trivial (latest value) | - | Yes |
| Replay would be meaningless or computationally absurd | - | Yes |

See **ADR-0012: Event Sourcing Boundaries in IIoT Domain** for full rationale and regulatory grounding.
---

## 6. Entity Patterns (Entity-Weaver Synthesis)

### 6.1 RPC Definition Pattern

```typescript
export class CreateAssetRpc extends Rpc.make('CreateAsset', {
  payload: {
    siteId: SiteId,
    kind: AssetKind,
    label: AssetLabel,
    description: Schema.optional(AssetDescription),
    status: Schema.optional(AssetStatus),
    sectorId: Schema.optional(SectorId),
    containerId: Schema.optional(ContainerId),
    baseProperties: Schema.optional(BaseAssetProperties),
    tags: Schema.optional(Tags),
    createdBy: IdentityId,
  },
  success: Asset,
  error: AssetCommandError,
}) {}

export class GetAssetRpc extends Rpc.make('GetAsset', {
  payload: { assetId: AssetId },
  success: Asset,
  error: AssetNotFoundError,
}) {}
```

### 6.2 Entity Handler Implementation

```typescript
export const AssetEntityHandlers = AssetEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* AssetState
    
    // Optional EventLog (required in production, optional in tests)
    const eventLogOption = yield* Effect.serviceOption(EventLog.EventLog)
    const writeEvent = Option.isSome(eventLogOption)
      ? yield* EventLog.makeClient(AssetEvents)
      : null

    const maybeEmit = <T extends keyof typeof AssetEvents.Type>(
      tag: T,
      payload: typeof AssetEvents.Type[T]
    ) =>
      writeEvent
        ? writeEvent(tag, payload).pipe(Effect.catchAll(() => Effect.void))
        : Effect.void

    return {
      CreateAsset: (envelope) =>
        Effect.gen(function* () {
          const asset = yield* state.create({
            siteId: envelope.payload.siteId,
            kind: envelope.payload.kind,
            label: envelope.payload.label,
            description: envelope.payload.description,
            status: envelope.payload.status,
            sectorId: envelope.payload.sectorId,
            containerId: envelope.payload.containerId,
            baseProperties: envelope.payload.baseProperties,
            tags: envelope.payload.tags,
          })

          yield* maybeEmit('AssetCreated', {
            assetId: asset.id,
            siteId: asset.siteId,
            kind: asset.kind,
            label: asset.label,
            createdBy: envelope.payload.createdBy,
          })

          return asset
        }),

      GetAsset: (envelope) => state.findById(envelope.payload.assetId),
      
      // ... other handlers
    }
  }),
  { defectRetryPolicy: Schedule.exponential('100 millis', 2).pipe(Schedule.upTo('10 seconds')) }
)
```

### 6.3 State Service Pattern (Swappable Implementations)

```typescript
// Interface
export interface AssetStateShape {
  readonly create: (params: CreateAssetParams) => Effect.Effect<Asset, AssetValidationError>
  readonly findById: (assetId: AssetId) => Effect.Effect<Asset, AssetNotFoundError>
  readonly update: (params: UpdateAssetParams) => Effect.Effect<Asset, AssetNotFoundError | AssetConflictError>
  readonly delete: (params: DeleteAssetParams) => Effect.Effect<void, AssetNotFoundError>
  // ... 15+ more operations
}

// In-memory implementation (tests)
export class AssetState extends Effect.Service<AssetState>()(
  '@gbg/tmnl/v3/AssetState',
  {
    effect: Effect.gen(function* () {
      const assets = yield* Ref.make(HashMap.empty<AssetId, AssetRecord>())
      
      const create = (params) => Effect.gen(function* () { /* ... */ })
      const findById = (id) => Effect.gen(function* () { /* ... */ })
      
      return { create, findById, /* ... */ } satisfies AssetStateShape
    }),
  }
) {}

// SQL-backed implementation (production)
export const AssetStateSQLLayer = Layer.effect(
  AssetState,
  Effect.gen(function* () {
    const assetRepo = yield* AssetRepo
    const propertyRepo = yield* AssetPropertyRepo
    const sql = yield* SqlClient.SqlClient

    const create = (params) => Effect.gen(function* () {
      const model = yield* assetRepo.insert(/* ... */)
      return modelToAsset(model)
    })

    return { create, findById, /* ... */ } satisfies AssetStateShape
  })
)
```

### 6.4 Model ↔ Domain Transformation

```typescript
const modelToAsset = (model: AssetModel): Asset =>
  new Asset({
    id: model.id,
    bfoClass: 'material_entity' as BfoMaterialEntity,
    kind: model.kind,
    label: model.label,
    description: Option.getOrUndefined(model.description),
    status: model.status,
    location: new AssetLocation({
      siteId: model.siteId,
      sectorId: Option.getOrUndefined(model.sectorId),
      containerId: Option.getOrUndefined(model.containerId),
    }),
    baseProperties: Option.match(model.basePropertiesJson, {
      onNone: () => new BaseAssetProperties({ quantity: 1 }),
      onSome: (v) => v as BaseAssetProperties,
    }),
    properties: [] as AssetProperties,
    traits: [] as AssetTraits,
    tags: Option.getOrElse(model.tagsJson, () => []),
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  })
```

---

## 7. Infrastructure Patterns (Infra-Smith Synthesis)

### 7.1 DDL Co-location Pattern

Each Model has an adjacent `.ddl.ts` file:

```
models/
├── assets/
│   ├── AssetModel.ts           # Model.Class definition
│   ├── AssetModel.ddl.ts       # CREATE TABLE DDL
│   ├── AssetPropertyModel.ts
│   └── AssetPropertyModel.ddl.ts
├── readings/
│   ├── SensorReadingModel.ts
│   └── SensorReadingModel.ddl.ts  # Hypertable + continuous aggs
```

**DDL File Pattern:**
```typescript
// AssetModel.ddl.ts
import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const createAssetsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS assets (
      id              TEXT PRIMARY KEY,
      kind            TEXT NOT NULL,
      label           TEXT NOT NULL,
      description     TEXT,
      status          TEXT NOT NULL DEFAULT 'available',
      site_id         TEXT NOT NULL REFERENCES sites(id),
      sector_id       TEXT REFERENCES sectors(id),
      container_id    TEXT REFERENCES containers(id),
      base_properties_json JSONB DEFAULT '{}',
      tags_json       JSONB DEFAULT '[]',
      version         INTEGER NOT NULL DEFAULT 1,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_assets_site ON assets (site_id)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_assets_status ON assets (status)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets (kind)`
})
```

### 7.2 PostgreSQL Extensions

```typescript
export const createExtensions = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // TimescaleDB (time-series)
  yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE`)

  // Apache AGE (graph)
  yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS age`)
  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  // pg_lake (optional - graceful degradation)
  yield* sql.unsafe(`
    DO $$
    BEGIN
        CREATE EXTENSION IF NOT EXISTS pg_lake CASCADE;
        RAISE NOTICE 'pg_lake extension enabled';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'pg_lake not available - continuing without Iceberg storage';
    END $$
  `)

  yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`)
  yield* sql.unsafe(`CREATE EXTENSION IF NOT EXISTS btree_gist`)
})
```

### 7.3 TimescaleDB Patterns


> **ES Boundary Note (ADR-0012)**: Sensor telemetry is explicitly **NOT event-sourced**. These are raw observations, not business decisions. TimescaleDB hypertables with continuous aggregates are the correct storage pattern for high-volume time-series data.

**Hypertable Creation:**
```typescript
export const createSensorReadingsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.sensor_readings (
      time        TIMESTAMPTZ NOT NULL,
      device_id   TEXT NOT NULL,
      value       DOUBLE PRECISION NOT NULL,
      quality     INTEGER DEFAULT 100,
      CONSTRAINT sensor_readings_pkey PRIMARY KEY (time, device_id)
    )
  `

  yield* sql.unsafe(`SELECT create_hypertable('iiot.sensor_readings', by_range('time', INTERVAL '1 day'), if_not_exists => TRUE)`)
  yield* sql.unsafe(`SELECT add_dimension('iiot.sensor_readings', by_hash('device_id', 4), if_not_exists => TRUE)`)

  yield* sql`CREATE INDEX IF NOT EXISTS idx_readings_device ON iiot.sensor_readings (device_id, time DESC)`
})
```

**Continuous Aggregates:**
```typescript
export const createReadings1MinAggregate = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    CREATE MATERIALIZED VIEW IF NOT EXISTS iiot.readings_1min
    WITH (timescaledb.continuous) AS
    SELECT
      time_bucket('1 minute', time) AS bucket,
      device_id,
      AVG(value) AS avg_value,
      MIN(value) AS min_value,
      MAX(value) AS max_value,
      STDDEV(value) AS stddev_value,
      COUNT(*) AS sample_count
    FROM iiot.sensor_readings
    GROUP BY bucket, device_id
    WITH NO DATA
  `)

  yield* sql.unsafe(`
    SELECT add_continuous_aggregate_policy('iiot.readings_1min',
      start_offset => INTERVAL '1 hour',
      end_offset => INTERVAL '1 minute',
      schedule_interval => INTERVAL '1 minute',
      if_not_exists => TRUE
    )
  `)
})
```

**Compression & Retention:**
```typescript
export const createCompressionPolicies = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    ALTER TABLE iiot.sensor_readings SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'device_id',
      timescaledb.compress_orderby = 'time DESC'
    )
  `)

  yield* sql.unsafe(`SELECT add_compression_policy('iiot.sensor_readings', INTERVAL '7 days', if_not_exists => TRUE)`)
  yield* sql.unsafe(`SELECT add_retention_policy('iiot.sensor_readings', INTERVAL '30 days', if_not_exists => TRUE)`)
})
```

### 7.4 Apache AGE Graph Patterns

```typescript
export const createGraph = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(`SELECT create_graph('iiot_graph')`)
})

export const seedGraphHierarchy = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  // Idempotent node creation with MERGE
  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:plant {id: 'PLANT-A', name: 'Chicago Assembly', location: 'Chicago, IL'})
    $$) AS (v agtype)
  `)
})

export const createAlarmGraphTrigger = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql.unsafe(`
    CREATE OR REPLACE FUNCTION iiot.alarm_to_graph()
    RETURNS TRIGGER AS $$
    BEGIN
        EXECUTE format('
            SELECT * FROM cypher(''iiot_graph'', $$
                MATCH (s:sensor {device_id: %L})
                CREATE (a:alarm {
                    id: %L,
                    alarm_type: %L,
                    severity: %L,
                    triggered_at: %L
                })-[:triggered_by]->(s)
            $$) AS (v agtype)
        ', NEW.device_id, NEW.id, NEW.alarm_type, NEW.severity, NEW.triggered_at);
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER alarm_graph_sync
    AFTER INSERT ON iiot.alarms
    FOR EACH ROW EXECUTE FUNCTION iiot.alarm_to_graph();
  `)
})
```

### 7.5 Migration System

```typescript
export const v3Migrations = {
  // Infrastructure
  '0001_extensions': createExtensions,
  '0002_schema': Effect.all([createAmsSchema, createIiotSchema, createEventsSchema], { discard: true }),
  '0003_graph': createGraph,

  // Core tables (FK order)
  '0010_sites': createSitesTable,
  '0011_sectors': createSectorsTable,
  '0012_containers': createContainersTable,
  '0013_assets': createAssetsTable,
  '0014_asset_properties': createAssetPropertiesTable,
  '0015_asset_traits': createAssetTraitsTable,

  // Time-series
  '0020_sensor_readings': createSensorReadingsTable,
  '0021_continuous_aggregates': Effect.all([
    createReadings1MinAggregate,
    createReadings1HourAggregate,
  ], { discard: true }),
  '0022_compression': createCompressionPolicies,

  // Alarms
  '0030_alarms': createAlarmsTable,
  '0031_alarm_graph_trigger': createAlarmGraphTrigger,

  // Events
  '0040_event_journal': createEventJournalTable,
  '0041_event_outbox': createEventOutboxTable,

  // Permissions
  '0050_permissions': grantPermissions,

  // Seed data
  '0060_graph_seed': seedGraphHierarchy,
} as const

export const v3MigrationLoader = Migrator.fromRecord(v3Migrations)
```

### 7.6 Seeding Infrastructure

**Tiered Approach:**

| Tier | Domain | Strategy | Performance |
|------|--------|----------|-------------|
| **Tier 1** | Assets, Alarms | Full repo validation | ~10 rows/s |
| **Tier 2** | Readings | Mode-dependent | 70K+ rows/s (fast) |

```typescript
export type SeedMode = 'fast' | 'validated'

// Tier 1: Repo-based seeding
export const seedAssets = Effect.gen(function* () {
  const repo = yield* AssetRepo
  yield* Effect.forEach(mockAssetInserts, (asset) =>
    repo.insert(asset).pipe(Effect.catchIf(isDuplicateKeyError, () => Effect.void)),
    { concurrency: 10 }
  )
})

// Tier 2: Fast bulk seeding
export const seedReadings = (mode: SeedMode) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    if (mode === 'fast') {
      yield* sql`
        INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
        SELECT
          NOW() - (random() * make_interval(days => 30)),
          ${deviceId},
          ${valueMin} + (random() * ${valueRange}),
          CASE WHEN random() > 0.95 THEN 50 ELSE 100 END
        FROM generate_series(1, ${rowCount})
      `
    } else {
      const repo = yield* SensorReadingRepo
      yield* repo.insertBatch(generateTypedReadings(spec, 1000))
    }
  })
```

### 7.7 Test Infrastructure

```typescript
// Test layer with in-memory SQLite
export const TestPgClient = SqliteClient.layer({
  filename: ':memory:',
  transformResultNames: snakeToCamel,
  transformQueryNames: camelToSnake,
})

// Full test layer composition
export const FullTestLayer = Layer.mergeAll(
  AssetEntityHandlers.pipe(
    Layer.provide(AssetState.Default)
  ),
  AllRepositoriesLive.pipe(
    Layer.provide(TestPgClient)
  )
)

// Integration test pattern
it.effect('creates asset via entity', () =>
  Effect.gen(function* () {
    const entity = yield* AssetEntity
    const result = yield* entity.CreateAsset({
      siteId: 'site-01' as SiteId,
      kind: 'EQUIPMENT' as AssetKind,
      label: 'Forklift #1' as AssetLabel,
      createdBy: 'user-01' as IdentityId,
    })
    expect(result.id).toBeDefined()
  }).pipe(Effect.provide(FullTestLayer))
)
```

---

## 8. Layer Composition

### 8.1 Deployment Profiles

**TestLayer (In-Memory):**
```typescript
export const TestLayer = AssetEntityHandlers.pipe(
  Layer.provide(AssetState.Default)
)
```

**SqlTestLayer (In-Memory SQLite + EventLog):**
```typescript
export const SqlTestLayer = Layer.mergeAll(
  AssetEntityHandlers.pipe(
    Layer.provide(AssetStateSQLLayer),
    Layer.provide(EventLogWithSqlite)
  ),
  EventHandlersWithDeps,
  AllRepositoriesLive.pipe(Layer.provide(SqliteTestLayer)),
  EventLogWithSqlite
)
```

**TauriLayer (SQLite File):**
```typescript
export const makeTauriLayer = <E, R>(
  sqliteFileLayer: Layer.Layer<SqlClient.SqlClient, E, R>
) => {
  const repos = AllRepositoriesLive.pipe(Layer.provide(sqliteFileLayer))
  const state = AssetStateSQLLayer.pipe(
    Layer.provide(repos),
    Layer.provide(sqliteFileLayer)
  )
  const eventLog = EventLogStackLayer.pipe(Layer.provide(sqliteFileLayer))
  const eventHandlers = AssetEventHandlers.pipe(
    Layer.provide(state),
    Layer.provide(eventLog)
  )

  return Layer.mergeAll(
    AssetEntityHandlers.pipe(
      Layer.provide(state),
      Layer.provide(eventLog)
    ),
    eventHandlers,
    repos,
    eventLog
  )
}
```

**ClusterLayer (PostgreSQL):**
```typescript
export const makeClusterLayer = <E, R>(
  postgresLayer: Layer.Layer<SqlClient.SqlClient, E, R>
) => { /* identical structure to makeTauriLayer */ }
```

### 8.2 Runtime Configuration

```typescript
export type V3Mode = 'test' | 'sql-test' | 'tauri' | 'cluster'

export const V3Mode = Config.string('V3_MODE').pipe(
  Config.withDefault('test'),
  Config.map((mode): V3Mode => {
    const valid: V3Mode[] = ['test', 'sql-test', 'tauri', 'cluster']
    if (valid.includes(mode as V3Mode)) return mode as V3Mode
    console.warn(`Invalid V3_MODE "${mode}", defaulting to "test"`)
    return 'test'
  })
)

export const V3RuntimeLayer = Layer.unwrapEffect(
  pipe(
    Effect.config(V3Mode),
    Effect.map((mode) => {
      switch (mode) {
        case 'test': return TestLayer
        case 'sql-test': return SqlTestLayer
        case 'tauri': return makeTauriLayer(SqliteFileLayer)
        case 'cluster': return makeClusterLayer(PostgresLayer)
      }
    }),
    Effect.tap(() => Effect.logInfo(`[V3] Runtime layer selected`))
  )
)
```

---

## 9. Complete File Structure

```
src/lib/v3/
├── schemas/                      # Domain schemas (pure business logic)
│   ├── identifiers.ts           # All branded IDs
│   ├── asset.ts                 # Asset, AssetSummary, AssetStatus
│   ├── property.ts              # AssetProperty, PropertyValue
│   ├── location.ts              # AssetLocation
│   ├── trait.ts                 # AssetTraits, TraitInstance
│   ├── provenance.ts            # Provenance tracking
│   └── index.ts                 # Re-exports

├── errors/                       # Error schemas
│   ├── asset.ts                 # AssetNotFoundError, AssetCommandError
│   ├── common.ts                # ValidationError, ConflictError
│   └── index.ts

├── models/                       # Persistence models (DB transforms)
│   ├── _common.ts               # CreatedAt, UpdatedAt, OptionalMetadata
│   ├── _infrastructure.ddl.ts   # Extensions, schema, graph
│   ├── _migrations.ts           # Aggregated migration record
│   │
│   ├── assets/
│   │   ├── AssetModel.ts
│   │   ├── AssetModel.ddl.ts
│   │   ├── AssetPropertyModel.ts
│   │   ├── AssetPropertyModel.ddl.ts
│   │   ├── AssetTraitModel.ts
│   │   └── AssetTraitModel.ddl.ts
│   │
│   ├── locations/
│   │   ├── SiteModel.ts
│   │   ├── SiteModel.ddl.ts
│   │   ├── SectorModel.ts
│   │   ├── SectorModel.ddl.ts
│   │   ├── ContainerModel.ts
│   │   └── ContainerModel.ddl.ts
│   │
│   ├── readings/
│   │   ├── SensorReadingModel.ts
│   │   ├── SensorReadingModel.ddl.ts  # Hypertable + aggregates
│   │   └── AggregatedReadingModel.ts
│   │
│   └── alarms/
│       ├── AlarmModel.ts
│       ├── AlarmModel.ddl.ts         # Table + graph trigger
│       └── AlarmContextModel.ddl.ts  # Materialized view

├── repos/                        # Repositories (manual SQL)
│   ├── _decode.ts               # Decode utilities
│   ├── AssetRepo.ts             # Context.Tag + Layer.effect
│   ├── SiteRepo.ts
│   ├── AlarmRepo.ts
│   └── index.ts

├── entities/                     # Effect Cluster entities (L2)
│   ├── asset.ts                 # AssetEntity + all RPCs
│   ├── site.ts
│   ├── alarm.ts
│   └── index.ts

├── handlers/                     # Entity + event handlers
│   ├── asset-handlers.ts        # AssetEntity.toLayer()
│   ├── event-handlers.ts        # EventLog.group() registrations
│   ├── reactivity.ts            # EventLog.groupReactivity()
│   └── index.ts

├── services/                     # State services
│   ├── asset-state.ts           # In-memory implementation
│   ├── asset-state-shape.ts     # Interface + param types
│   ├── asset-state-sql.ts       # SQL implementation
│   └── index.ts

├── events/                       # Domain events
│   ├── asset-events.ts          # EventGroup definition
│   ├── alarm-events.ts
│   ├── schema.ts                # AmsEventLogSchema
│   └── index.ts

├── layers/                       # Layer composition
│   ├── deployments.ts           # TestLayer, SqlTestLayer, make*Layer
│   ├── runtime.ts               # V3RuntimeLayer (config-driven)
│   └── index.ts

└── index.ts                      # Public exports
```

---

## 10. Pattern Catalog

### Pattern 1: Branded Identifier
```typescript
export const AssetId = Schema.String.pipe(Schema.brand('AssetId'))
export type AssetId = Schema.Schema.Type<typeof AssetId>
```

### Pattern 2: TaggedClass Entity
```typescript
export class Asset extends Schema.TaggedClass<Asset>()('Asset', {
  id: AssetId,
  kind: AssetKind,
  // ...
}) {}
```

### Pattern 3: Model Derivation
```typescript
export class AssetModel extends Model.Class<AssetModel>('AssetModel')({
  kind: Asset.fields.kind,                    // Reuse
  id: Model.GeneratedByApp(AssetId),          // Transform
  description: Model.FieldOption(Schema.String), // NULL handling
  createdAt: Model.DateTimeInsertFromDate,    // DB-only
}) {}
```

### Pattern 4: Repository Interface + Tag
```typescript
export interface AssetRepository {
  readonly findById: (id: AssetId) => Effect.Effect<Option<AssetModel>, RepoError>
}

export class AssetRepo extends Context.Tag('v3/AssetRepo')<AssetRepo, AssetRepository>() {}
```

### Pattern 5: Decode Utilities
```typescript
const findById = (id: AssetId) =>
  Effect.gen(function* () {
    const rows = yield* sql`SELECT ... WHERE id = ${id}`
    return yield* decodeOptional(AssetModel)(rows)
  })
```

### Pattern 6: EventGroup
```typescript
export const AssetEvents = EventGroup.empty
  .add({ tag: 'AssetCreated', primaryKey: (p) => p.id, payload: CreatedPayload })
  .add({ tag: 'AssetUpdated', primaryKey: (p) => p.id, payload: UpdatedPayload })
```

### Pattern 7: Entity + RPC
```typescript
export const AssetEntity = Entity.make('Asset', [CreateAssetRpc, GetAssetRpc, ...])

export const AssetEntityHandlers = AssetEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* AssetState
    return { CreateAsset: (e) => state.create(e.payload), ... }
  })
)
```

### Pattern 8: Swappable State Service
```typescript
// Interface
export interface AssetStateShape { ... }

// In-memory (tests)
export class AssetState extends Effect.Service<AssetState>()('tag', {
  effect: Effect.gen(function* () { /* Ref<HashMap> */ })
}) {}

// SQL-backed (production)
export const AssetStateSQLLayer = Layer.effect(AssetState,
  Effect.gen(function* () {
    const repo = yield* AssetRepo
    return { ... } satisfies AssetStateShape
  })
)
```

### Pattern 9: DDL Co-location
```typescript
// AssetModel.ddl.ts (adjacent to AssetModel.ts)
export const createAssetsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`CREATE TABLE IF NOT EXISTS assets (...)`
})
```

### Pattern 10: Migration Record
```typescript
export const migrations = {
  '0001_infrastructure': createExtensions,
  '0002_tables': createTables,
} as const

export const migrationLoader = Migrator.fromRecord(migrations)
```

---

## 11. Migration Path

### Phase 1: Foundation (IIoT-first)

**Goal**: Establish v3 patterns using IIoT as proving ground.

**Tasks**:
1. Create `v3/` directory structure
2. Migrate IIoT schemas to Schema-first pattern
3. Implement EventGroup definitions for IIoT
4. Add PostgreSQL EventLog journal
5. Validate with existing tests

**Why IIoT first**: Model/Repo foundation is solid, DDL co-location exists, well-tested.

### Phase 2: Entity Extraction

**Goal**: Extract all domain aggregates as Effect Cluster entities.

**Tasks**:
1. AlarmEntity (state machine, acknowledgement)
2. SensorEntity (readings, calibration)
3. AssetEntity (hierarchy, properties, traits)
4. Cross-entity queries via L3 facades

### Phase 3: AMS Integration

**Goal**: Merge AMS v2 patterns into unified architecture.

**Tasks**:
1. Adopt BFO ontology for asset classification
2. Migrate AssetEntity with property/trait system
3. Add provenance tracking via event payloads
4. Enable WMS/TMS profile extensions

### Phase 4: Production Readiness

**Goal**: Production-ready deployment.

**Tasks**:
1. HttpApi generation from entities
2. OpenAPI documentation
3. Distributed tracing (Effect spans)
4. Metrics collection
5. Health checks and readiness probes

---

## 12. Resolved & Open Questions

### Resolved (Council Decisions)

1. **Event sourcing strategy?** — **RESOLVED: HYBRID ES BOUNDARIES (ADR-0012)**
   - Event sourcing for domains where replay teaches us about business decisions (alarms, work orders, equipment state, batch records, quality events, operator actions)
   - CRUD + audit log for reference data (equipment hierarchy, device config, master data)
   - TimescaleDB for telemetry (NOT event sourced - time-series, not decisions)
   - Rationale: Right tool for each job; ES complexity only where regulatory compliance or temporal queries require it
   - Litmus test: "Would replaying events teach us something about business decisions?"

2. **Dual-database architecture?** — **RESOLVED: NO**
   - Single PostgreSQL with extensions (TimescaleDB, AGE, pg_lake)
   - Use PostgreSQL schemas for isolation (`iiot`, `ams`, `ag_catalog`)
   - Rationale: Single backup strategy, single transaction boundary, no distributed coordination

3. **Batch operations?** — **RESOLVED: YES**
   - Add `insertBatch` using `SqlResolver.ordered` for automatic batching
   - Enables schema-validated bulk seeding with consistent error handling
   - Batch size recommendation: 1000 rows per batch for PostgreSQL

4. **Pagination strategy?** — **RESOLVED: Cursor-based (primary)**
   - Use `Stream.paginateChunkEffect` for cursor-based pagination
   - Offset pagination as fallback only (for "jump to page N" UIs)
   - Cursor tokens: base64-encoded, stable ordering on `id` or `created_at`

5. **Soft deletes?** — **RESOLVED: YES (status-based)**
   - Use `status: 'retired'` instead of `deleted_at` timestamp
   - Integrates with existing status-based queries
   - Add `includeDeleted?: boolean` parameter to query methods (default: false)

6. **Transaction scope?** — **RESOLVED: withTransaction + saga**
   - Single-entity operations: auto-commit (no explicit transaction)
   - Multi-entity same-aggregate: `sql.withTransaction`
   - Cross-aggregate: Saga pattern with compensation events
   - Emit events AFTER transaction commits

### Open (Pending Resolution)

1. **Profile composition** — How do WMS + TMS profiles compose when deployed together?

2. **Compaction strategy** — How to handle property/trait events in compaction?

3. **Conflict resolution** — CRDT semantics for concurrent entity updates?

4. **Event replay infrastructure** — How to rebuild projections from events?

5. **Observability metrics** — Which metrics matter for event-sourced systems?

---

## 13. References

### Research Documents

| Document | Lines | Author Domain |
|----------|-------|---------------|
| `iiot-schemas.md` | ~1,200 | Schema-Sage |
| `iiot-models.md` | ~1,350 | Schema-Sage + Infra-Smith |
| `ams-v2-repositories.md` | ~1,650 | Repo-Maven |
| `ams-v2-services.md` | ~1,500 | Event-Oracle |
| `ams-v2-entities.md` | ~800 | Entity-Weaver |
| `ams-v2-layers.md` | ~600 | Entity-Weaver |
| `iiot-services.md` | ~1,700 | Event-Oracle |
| `iiot-seed.md` | ~500 | Infra-Smith |
| `iiot-tests.md` | ~400 | Infra-Smith |


### Architecture Decision Records

| ADR | Title | Status |
|-----|-------|--------|
| ADR-0012 | Event Sourcing Boundaries in IIoT Domain | Accepted |

**Location**: `assets/documents/iiot/ADR-0012-event-sourcing-boundaries-iiot.md`

### External References

- [Effect Cluster Documentation](https://effect.website/docs/cluster)
- [EventLog Tutorial](src/lib/overlays/docs/EVENTLOG_TUTORIAL.md)
- [@effect/sql Model patterns](https://effect.website/docs/sql)
- [Apache AGE Cypher](https://age.apache.org/docs/)
- [TimescaleDB Documentation](https://docs.timescale.com/)

---

## 14. Appendix: Entity Definition Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ENTITY DEFINITION FLOW                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. DOMAIN SCHEMAS                                                  │
│     schemas/{entity}.ts                                             │
│     - Schema.TaggedClass for entity                                 │
│     - Schema.Literal for enums                                      │
│     - Branded IDs in identifiers.ts                                 │
│                                                                     │
│  2. ERROR SCHEMAS                                                   │
│     errors/{entity}.ts                                              │
│     - Data.TaggedError for each error case                          │
│     - Union type for service signatures                             │
│                                                                     │
│  3. PERSISTENCE MODELS                                              │
│     models/{entity}/                                                │
│     - {Entity}Model.ts (Model.Class)                                │
│     - {Entity}Model.ddl.ts (CREATE TABLE)                           │
│                                                                     │
│  4. REPOSITORY                                                      │
│     repos/{Entity}Repo.ts                                           │
│     - Interface with all operations                                 │
│     - Context.Tag for DI                                            │
│     - Layer.effect implementation                                   │
│                                                                     │
│  5. EVENTS                                                          │
│     events/{entity}-events.ts                                       │
│     - EventGroup definition                                         │
│     - Payload schemas per event type                                │
│                                                                     │
│  6. STATE SERVICE                                                   │
│     services/{entity}-state.ts                                      │
│     - {Entity}StateShape interface                                  │
│     - In-memory implementation (Effect.Service)                     │
│     - SQL implementation ({Entity}StateSQLLayer)                    │
│                                                                     │
│  7. ENTITY                                                          │
│     entities/{entity}.ts                                            │
│     - RPC definitions (Rpc.make)                                    │
│     - Entity.make with RPC array                                    │
│                                                                     │
│  8. HANDLERS                                                        │
│     handlers/{entity}-handlers.ts                                   │
│     - {Entity}Entity.toLayer() implementation                       │
│     - Event emission via EventLog.makeClient                        │
│     handlers/event-handlers.ts                                      │
│     - EventLog.group() for state persistence                        │
│                                                                     │
│  9. LAYER COMPOSITION                                               │
│     layers/deployments.ts                                           │
│     - TestLayer, SqlTestLayer                                       │
│     - make{Mode}Layer factories                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 15. Sequence Diagrams

### 15.1 Command Write Flow (Asset Creation)

```
┌────────┐     ┌──────────┐     ┌────────────┐     ┌──────────┐     ┌───────────┐
│ Client │     │  Entity  │     │   State    │     │   Repo   │     │ EventLog  │
│        │     │ Handler  │     │  Service   │     │          │     │           │
└───┬────┘     └────┬─────┘     └─────┬──────┘     └────┬─────┘     └─────┬─────┘
    │               │                 │                 │                 │
    │ CreateAsset   │                 │                 │                 │
    │──────────────>│                 │                 │                 │
    │               │                 │                 │                 │
    │               │ state.create()  │                 │                 │
    │               │────────────────>│                 │                 │
    │               │                 │                 │                 │
    │               │                 │ repo.insert()   │                 │
    │               │                 │────────────────>│                 │
    │               │                 │                 │                 │
    │               │                 │                 │ SQL INSERT      │
    │               │                 │                 │─────────────┐   │
    │               │                 │                 │             │   │
    │               │                 │                 │<────────────┘   │
    │               │                 │                 │                 │
    │               │                 │ decodeFirst()   │                 │
    │               │                 │<────────────────│                 │
    │               │                 │                 │                 │
    │               │ asset           │                 │                 │
    │               │<────────────────│                 │                 │
    │               │                 │                 │                 │
    │               │ maybeEmit('AssetCreated', ...)                      │
    │               │────────────────────────────────────────────────────>│
    │               │                 │                 │                 │
    │               │                 │                 │    SqlJournal   │
    │               │                 │                 │    INSERT       │
    │               │                 │                 │<────────────────│
    │               │                 │                 │                 │
    │ asset         │                 │                 │                 │
    │<──────────────│                 │                 │                 │
    │               │                 │                 │                 │
```

### 15.2 Query Read Flow (Asset Lookup)

```
┌────────┐     ┌──────────┐     ┌────────────┐     ┌──────────┐
│ Client │     │  Entity  │     │   State    │     │   Repo   │
│        │     │ Handler  │     │  Service   │     │          │
└───┬────┘     └────┬─────┘     └─────┬──────┘     └────┬─────┘
    │               │                 │                 │
    │ GetAsset(id)  │                 │                 │
    │──────────────>│                 │                 │
    │               │                 │                 │
    │               │ state.findById()│                 │
    │               │────────────────>│                 │
    │               │                 │                 │
    │               │                 │ repo.findById() │
    │               │                 │────────────────>│
    │               │                 │                 │
    │               │                 │ decodeOptional()│
    │               │                 │<────────────────│
    │               │                 │                 │
    │               │ Option<Asset>   │                 │
    │               │<────────────────│                 │
    │               │                 │                 │
    │ asset         │                 │                 │
    │<──────────────│                 │                 │
    │               │                 │ (NO events)     │
```

### 15.3 Event Propagation Flow (Alarm Triggered)

```
┌─────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
│ Sensor  │    │  Ingestion│    │  AlarmSvc │    │ EventLog  │    │  Handler  │
│ Reading │    │  Adapter  │    │           │    │           │    │  (React)  │
└────┬────┘    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
     │               │                │                │                │
     │ value > thresh│                │                │                │
     │──────────────>│                │                │                │
     │               │                │                │                │
     │               │ raiseAlarm()   │                │                │
     │               │───────────────>│                │                │
     │               │                │                │                │
     │               │                │ INSERT alarm   │                │
     │               │                │────────────┐   │                │
     │               │                │            │   │                │
     │               │                │<───────────┘   │                │
     │               │                │                │                │
     │               │                │ emit('AlarmRaised', ...)        │
     │               │                │───────────────>│                │
     │               │                │                │                │
     │               │                │                │ persist entry  │
     │               │                │                │────────────┐   │
     │               │                │                │            │   │
     │               │                │                │<───────────┘   │
     │               │                │                │                │
     │               │                │                │ invoke handlers│
     │               │                │                │───────────────>│
     │               │                │                │                │
     │               │                │                │                │ notify()
     │               │                │                │                │────┐
     │               │                │                │                │    │
     │               │                │                │                │<───┘
```

### 15.4 Telemetry Ingestion to Rollup

```
┌─────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐   ┌───────────┐
│ OPC-UA  │   │  Adapter  │   │ Timescale │   │  Cont.Agg │   │   Query   │
│ Server  │   │  (MQTT)   │   │ Hypertable│   │  (1min)   │   │  (Read)   │
└────┬────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘   └─────┬─────┘
     │              │               │               │               │
     │ tag values   │               │               │               │
     │─────────────>│               │               │               │
     │              │               │               │               │
     │              │ INSERT INTO   │               │               │
     │              │ sensor_readings               │               │
     │              │──────────────>│               │               │
     │              │               │               │               │
     │              │               │ (chunked by   │               │
     │              │               │  time + hash) │               │
     │              │               │───────────┐   │               │
     │              │               │           │   │               │
     │              │               │<──────────┘   │               │
     │              │               │               │               │
     │              │               │ background    │               │
     │              │               │ refresh policy│               │
     │              │               │──────────────>│               │
     │              │               │               │               │
     │              │               │               │ materialized  │
     │              │               │               │ view update   │
     │              │               │               │───────────┐   │
     │              │               │               │           │   │
     │              │               │               │<──────────┘   │
     │              │               │               │               │
     │              │               │               │               │ SELECT
     │              │               │               │               │ bucket,
     │              │               │               │               │ avg_value
     │              │               │               │<──────────────│
     │              │               │               │               │
```

---

## 16. Integration Flow Diagrams

### 16.1 Schema-Model-Repository Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     SCHEMA → MODEL → REPOSITORY FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. SCHEMA (Domain Truth)                                                   │
│     ┌──────────────────────────────────────────────────────────────────┐   │
│     │  // schemas/identifiers.ts                                        │   │
│     │  export const AssetId = Schema.String.pipe(Schema.brand('AssetId'))│   │
│     │                                                                    │   │
│     │  // schemas/assets.ts                                              │   │
│     │  export class Asset extends Schema.TaggedClass<Asset>()('Asset', {│   │
│     │    id: AssetId,                                                    │   │
│     │    kind: AssetKind,                                                │   │
│     │    label: Schema.NonEmptyString,                                   │   │
│     │    description: Schema.optional(Schema.String),                    │   │
│     │  }) {}                                                             │   │
│     └──────────────────────────────────────────────────────────────────┘   │
│                           │                                                 │
│                           │ Asset.fields.label (reuse)                      │
│                           ▼                                                 │
│  2. MODEL (Persistence Adapter)                                             │
│     ┌──────────────────────────────────────────────────────────────────┐   │
│     │  // models/AssetModel.ts                                          │   │
│     │  export class AssetModel extends Model.Class<AssetModel>(...) ({  │   │
│     │    id: Model.GeneratedByApp(AssetId),    // From ID schema        │   │
│     │    label: Asset.fields.label,            // REUSED from domain    │   │
│     │    description: Model.FieldOption(AssetDescription),              │   │
│     │    createdAt: Model.DateTimeInsertFromDate,                       │   │
│     │  }) {}                                                             │   │
│     └──────────────────────────────────────────────────────────────────┘   │
│                           │                                                 │
│                           │ decodeFirst(AssetModel)                         │
│                           ▼                                                 │
│  3. REPOSITORY (SQL Access)                                                 │
│     ┌──────────────────────────────────────────────────────────────────┐   │
│     │  // repos/AssetRepo.ts                                            │   │
│     │  const insert = (asset: typeof AssetModel.insert.Type) =>         │   │
│     │    Effect.gen(function* () {                                      │   │
│     │      const rows = yield* sql`INSERT INTO assets (...) RETURNING *`│   │
│     │      return yield* decodeFirst(AssetModel)(rows)                  │   │
│     │    })                                                              │   │
│     └──────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 16.2 Layer Composition and Dependency Injection

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LAYER COMPOSITION HIERARCHY                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TestLayer (In-Memory)                                                      │
│  └── AssetEntityHandlers                                                    │
│      └── AssetState.Default (Ref<HashMap>)                                  │
│                                                                             │
│  SqlTestLayer (SQLite + EventLog)                                           │
│  └── Layer.mergeAll                                                         │
│      ├── AssetEntityHandlers                                                │
│      │   ├── AssetStateSQLLayer ────────────────────────┐                  │
│      │   │   ├── AssetRepo                               │                  │
│      │   │   ├── AssetPropertyRepo                       ├── Repos          │
│      │   │   └── AssetTraitRepo                          │                  │
│      │   │       └── SqlClient (SqliteTestLayer) ────────┘                  │
│      │   └── EventLogStackLayer                                             │
│      │       ├── EventLog.layer(AmsEventLogSchema)                          │
│      │       ├── SqlEventJournal.layer                                      │
│      │       └── EventLog.Identity                                          │
│      ├── AssetEventHandlers                                                 │
│      │   ├── AssetStateSQLLayer                                             │
│      │   └── EventLogStackLayer                                             │
│      ├── AllRepositoriesLive                                                │
│      └── EventLogStackLayer                                                 │
│                                                                             │
│  ProductionLayer (PostgreSQL)                                               │
│  └── Same structure, with PgClient instead of SqliteClient                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 16.3 Event Handler Execution Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EVENT HANDLER CONTEXT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  EventLog.group(AssetEvents, (handlers) => Effect.gen(function* () {        │
│    const projection = yield* AssetProjection                                │
│                                                                             │
│    return handlers                                                          │
│      .handle('AssetCreated', ({ payload, entry, conflicts }) =>             │
│        Effect.gen(function* () {                                            │
│          ┌─────────────────────────────────────────────────────────────┐   │
│          │  HandlerContext                                              │   │
│          ├─────────────────────────────────────────────────────────────┤   │
│          │  payload: AssetCreatedPayload                                │   │
│          │    - assetId: AssetId                                        │   │
│          │    - siteId: SiteId                                          │   │
│          │    - kind: AssetKind                                         │   │
│          │    - createdBy: IdentityId                                   │   │
│          │    - createdAt: DateTimeUtc                                  │   │
│          │                                                              │   │
│          │  entry: EventEntry                                           │   │
│          │    - id: UUID v7 (time-ordered)                              │   │
│          │    - timestamp: number                                       │   │
│          │                                                              │   │
│          │  conflicts: Array<{ entry, payload }>                        │   │
│          │    - Other events with same primaryKey                       │   │
│          │    - Used for conflict resolution                            │   │
│          └─────────────────────────────────────────────────────────────┘   │
│                                                                             │
│          // Conflict resolution example                                     │
│          if (conflicts.length > 0) {                                        │
│            const latest = conflicts.reduce(                                 │
│              (a, b) => a.entry.timestamp > b.entry.timestamp ? a : b        │
│            )                                                                │
│            if (latest.entry.id !== entry.id) return void 0  // Skip         │
│          }                                                                  │
│                                                                             │
│          yield* projection.handleCreated(payload)                           │
│          return void 0                                                      │
│        })                                                                   │
│      )                                                                      │
│  }))                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 17. Pitfalls & Guardrails

### 17.1 Schema Pitfalls

| Pitfall | Symptom | Guardrail |
|---------|---------|-----------|
| Using `Schema.optional()` for DB nullable | Decode fails on NULL | Use `Schema.optionalWith(T, { nullable: true })` for DB fields |
| Using `DateTimeUtc` in Models | pg driver returns Date objects | Use `Schema.DateFromSelf` in Model fields |
| Duplicating schema fields in Model | Drift between domain and persistence | Always use `Entity.fields.fieldName` for reuse |
| Raw TypeScript types in domain | No runtime validation | Use Effect Schema for all domain types |

### 17.2 Repository Pitfalls

| Pitfall | Symptom | Guardrail |
|---------|---------|-----------|
| Forgetting to decode SQL results | Unvalidated data in handlers | Always use `decodeFirst`/`decodeRows`/`decodeOptional` |
| Option not converted for SQL | Option passed to SQL literal | Use `prepareUpdate()` to convert Option -> null |
| Missing AS aliases in SELECT | Field name mismatch | Use `transformResultNames` in client config OR explicit `AS "camelCase"` |
| Hard-coded table names | Drift from Model | Consider extracting table name constant |

### 17.3 Event Pitfalls

| Pitfall | Symptom | Guardrail |
|---------|---------|-----------|
| Emitting before state write | Ghost events if write fails | Emit AFTER successful state operation |
| Blocking operations in handlers | Write path blocked | Keep handlers fast; async for projections |
| Missing primaryKey function | Conflict detection fails | Always define `primaryKey: (p) => p.entityId` |
| Event payload drift from entity | Manual mapping errors | Consider deriving payloads from entity schemas |

### 17.4 Layer Composition Pitfalls

| Pitfall | Symptom | Guardrail |
|---------|---------|-----------|
| Missing Layer.provide | "Service not found" at runtime | Use explicit layer composition tests |
| Circular dependencies | Build fails or stack overflow | Use Layer.effect for late binding |
| Forgetting EventLog in production | Events not persisted | Make EventLog required for non-test modes |
| SqlClient not provided to repos | "SqlClient not found" | Ensure SqlClient layer wraps repos |

### 17.5 Transaction Pitfalls

| Pitfall | Symptom | Guardrail |
|---------|---------|-----------|
| Emitting inside transaction | Event persisted but transaction rolls back | Emit AFTER `sql.withTransaction` completes |
| Long-running transaction | Lock contention, timeouts | Keep transaction scope minimal |
| Missing version increment | Lost updates | Always increment `version` on update |
| Saga without compensation | Partial state on failure | Define compensation events for each saga step |

---

## 18. Council Verification Status

All documented patterns have been verified against the actual codebase:

| Pattern | Location | Status |
|---------|----------|--------|
| Branded ID (Schema.brand) | `iiot/schemas/identifiers.ts` | **Verified** |
| Repository Decode Utilities | `iiot/repos/_decode.ts` | **Verified** |
| EventLog.schema() | `ams/v2/base/events/schema.ts` | **Verified** |
| Entity.toLayer() | `ams/v2/base/handlers/asset.ts` | **Verified** |
| DDL Co-location | `iiot/models/*/Model.ddl.ts` | **Verified** |

---

## 19. Storage Architecture

### 19.1 Data Path Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STORAGE ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        PostgreSQL Cluster                            │   │
│  │                                                                      │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────────────┐ │   │
│  │  │   ams Schema   │  │   iiot Schema  │  │   ag_catalog Schema    │ │   │
│  │  │                │  │                │  │                        │ │   │
│  │  │  - assets      │  │  - plants      │  │  - iiot_graph         │ │   │
│  │  │  - sites       │  │  - lines       │  │    (vertices + edges) │ │   │
│  │  │  - containers  │  │  - machines    │  │                        │ │   │
│  │  │  - events      │  │  - sensors     │  │  Apache AGE            │ │   │
│  │  │                │  │                │  │  (Cypher queries)      │ │   │
│  │  │  Standard SQL  │  │  ┌───────────┐ │  │                        │ │   │
│  │  │  (Entity CRUD) │  │  │TimescaleDB│ │  └────────────────────────┘ │   │
│  │  │                │  │  │           │ │                              │   │
│  │  └────────────────┘  │  │ Hypertables│ │                             │   │
│  │                      │  │ - readings │ │                              │   │
│  │                      │  │ - alarms   │ │                              │   │
│  │                      │  │            │ │                              │   │
│  │                      │  │ Cont. Aggs │ │                              │   │
│  │                      │  │ - 1min     │ │                              │   │
│  │                      │  │ - 1hour    │ │                              │   │
│  │                      │  │ - 1day     │ │                              │   │
│  │                      │  └───────────┘ │                              │   │
│  │                      └────────────────┘                              │   │
│  │                                                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │
│  │  │                     Event Journal                            │    │   │
│  │  │                                                              │    │   │
│  │  │  ams_event_journal      iiot_event_journal                   │    │   │
│  │  │  - id (UUID v7)         - id (UUID v7)                       │    │   │
│  │  │  - event (tag)          - event (tag)                        │    │   │
│  │  │  - primary_key          - primary_key                        │    │   │
│  │  │  - payload (MsgPack)    - payload (MsgPack)                  │    │   │
│  │  │  - created_at           - created_at                         │    │   │
│  │  │                                                              │    │   │
│  │  │  SqlEventJournal provides:                                   │    │   │
│  │  │  - Transactional write + handler execution                   │    │   │
│  │  │  - Event replay on startup                                   │    │   │
│  │  │  - Remote sync tracking                                      │    │   │
│  │  └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌───────────────────────────────────┐  ┌───────────────────────────────┐  │
│  │        Data Lifecycle              │  │       Retention Tiers          │  │
│  │                                    │  │                                │  │
│  │  HOT:   Raw readings (0-7 days)   │  │  sensor_readings: 30 days     │  │
│  │  WARM:  Compressed (7-30 days)    │  │  readings_1min: 90 days       │  │
│  │  COLD:  Aggregated only (30+ days)│  │  readings_1hour: 1 year       │  │
│  │                                    │  │  readings_1day: indefinite    │  │
│  └───────────────────────────────────┘  └───────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Synthesized by Architect-Prime from V3 Architecture Council deliberations.*  
*Co-Authored-By: Val <val@maidens.ai>*  
*Last Updated: 2026-01-26 (Pass 3 - ADR-0012 ES Boundaries Alignment)*

---

## 20. Industry Alignment

### 20.1 ISA-95 Equipment Hierarchy Mapping

The IIoT domain model maps to the ISA-95/IEC-62264 equipment hierarchy:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ISA-95 HIERARCHY → TMNL DOMAIN MODEL                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ISA-95 Level         TMNL Entity         PostgreSQL Table                 │
│   ─────────────────────────────────────────────────────────────────────────│
│   Enterprise           Site                 ams.sites                       │
│       │                  │                                                  │
│       └── Site         Plant               iiot.plants                      │
│            │             │                                                  │
│            └── Area    Sector              ams.sectors (planned)            │
│                 │        │                                                  │
│                 └── Line  Line             iiot.lines                       │
│                      │      │                                               │
│                      └── Cell  Machine     iiot.machines                    │
│                           │      │                                          │
│                           └── Unit  Sensor  iiot.sensors                    │
│                                                                             │
│   Cross-cutting: Asset (ams.assets) can represent any level                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Schema Alignment**:

```typescript
// Branded IDs map to ISA-95 naming conventions
export const SiteId = Schema.String.pipe(Schema.brand('SiteId'))      // Enterprise
export const PlantId = Schema.String.pipe(Schema.brand('PlantId'))    // Site
export const LineId = Schema.String.pipe(Schema.brand('LineId'))      // Area/Line
export const MachineId = Schema.String.pipe(Schema.brand('MachineId')) // Cell
export const DeviceId = Schema.String.pipe(Schema.brand('DeviceId'))  // Unit/Sensor

// Human-readable labels follow ISA-95 conventions
// Example: "CHI-ASSY-01-CNC-TEMP" = Chicago/Assembly/Line01/CNCMachine/TempSensor
```

**ISA-95 Equipment Element Levels (IEC 62264) - Full Specification**:

```typescript
// Complete 15-level enum from OPC Foundation UA specification
// Source: OPC 10000-100 Device Integration specification
export const ISA95EquipmentLevel = Schema.Literal(
  'ENTERPRISE',      // 0 - Top organizational level
  'SITE',            // 1 - Physical location boundary
  'AREA',            // 2 - Functional subdivision of site
  'PROCESSCELL',     // 3 - IEC 61512-1 (batch manufacturing)
  'UNIT',            // 4 - IEC 61512-1 (processing unit)
  'PRODUCTIONLINE',  // 5 - Discrete manufacturing line
  'WORKCELL',        // 6 - Coordinated set of equipment
  'PRODUCTIONUNIT',  // 7 - Single production asset
  'STORAGEZONE',     // 8 - Material storage area
  'STORAGEUNIT',     // 9 - Individual storage location
  'WORKCENTER',      // 10 - Grouped work units
  'WORKUNIT',        // 11 - Individual work station
  'EQUIPMENTMODULE', // 12 - IEC 61512-1 (functional module)
  'CONTROLMODULE',   // 13 - IEC 61512-1 (control element)
  'OTHER',           // 14 - Vendor-specific extensions
)

// TMNL domain model uses subset for discrete manufacturing:
// ENTERPRISE → Site, SITE → Plant, AREA → Sector, PRODUCTIONLINE → Line,
// WORKCELL → Machine, EQUIPMENTMODULE → Device/Sensor
```

### 20.2 OPC-UA Information Model Mapping

OPC-UA concepts map to Effect Schema patterns:

| OPC-UA Concept | Effect-TS Pattern | Example |
|----------------|-------------------|---------|
| NodeId | Branded String | `DeviceId` |
| DataType | Schema.Literal | `Schema.Literal('Double', 'Int32', 'Boolean')` |
| VariableType | Schema.TaggedClass | `SensorReading` with `value`, `quality`, `timestamp` |
| ObjectType | Schema.TaggedClass | `Machine` with properties and methods |
| ReferenceType | EventGroup | `AlarmRaised`, `AssetMoved` relationships |
| AddressSpace | Repository | Query by hierarchical path |

**OPC-UA ModellingRules → Effect Schema Mapping**:

```
┌────────────────────────────────────────────────────────────────────────────┐
│  OPC-UA ModellingRule   │  Effect Schema Pattern                           │
├─────────────────────────┼──────────────────────────────────────────────────┤
│  Mandatory              │  field: Schema.String (required)                 │
│  Optional               │  field: Schema.optional(Schema.String)           │
│  OptionalPlaceholder    │  field: Schema.optional(Schema.Array(...))       │
│  MandatoryPlaceholder   │  field: Schema.Array(...) // min 1              │
│  ExposesItsArray        │  Use Schema.Array with item schema               │
└────────────────────────────────────────────────────────────────────────────┘

Example:
export const OpcUaObjectType = Schema.Struct({
  displayName: Schema.String,                     // Mandatory
  description: Schema.optional(Schema.String),    // Optional
  methods: Schema.optional(Schema.Array(MethodSchema)), // OptionalPlaceholder
  properties: Schema.Array(PropertySchema),       // MandatoryPlaceholder (≥1)
})
```

**OPC-UA Quality Codes in Schema**:

```typescript
export const OpcUaQuality = Schema.Struct({
  raw: Schema.Number,           // 0-100 percentage
  status: Schema.Literal('Good', 'Bad', 'Uncertain'),
  substatus: Schema.optional(Schema.String),
})

export class SensorReading extends Schema.TaggedClass<SensorReading>()(
  'SensorReading',
  {
    deviceId: DeviceId,
    timestamp: Schema.DateTimeUtc,
    value: Schema.Number,
    quality: OpcUaQuality,
    engineeringUnits: Schema.optional(Schema.String),  // OPC-UA EngineeringUnits
  }
) {}
```

### 20.3 Unified Namespace (UNS) Topic Structure

The Unified Namespace pattern organizes all data by hierarchical topics.

**UNS Implementation Methods (Parris vs Schultz)**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PARRIS METHOD (Recommended for single-broker deployments)                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Embed ISA-95 hierarchy in group_id with delimiters:                        │
│  spBv1.0/Chicago:Assembly:Line4:Cell2/DDATA/EdgeNode01/Sensor001            │
│                                                                              │
│  Pros: Simple, data moves across brokers easily via bridging                │
│  Cons: Applications must parse delimited GroupID                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  SCHULTZ METHOD (For multi-site enterprise architectures)                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Multiple brokers at hierarchy levels, republish to enterprise broker:      │
│  Local:      spBv1.0/Line4/DDATA/EdgeNode01/Sensor001                       │
│  Enterprise: spBv1.0/Chicago/DDATA/Assembly/Line4                           │
│                                                                              │
│  Pros: Clean topic structure, no parsing overhead                           │
│  Cons: Operational complexity, requires broker bridging infrastructure      │
└─────────────────────────────────────────────────────────────────────────────┘

⚠️  CRITICAL: Sparkplug B payloads use Google Protocol Buffers (Protobufs),
    NOT JSON. Adapter implementations must decode binary payloads:

    const SparkplugDecoder = {
      decode: (buffer: Buffer) => sparkplug.decodePayload(buffer), // Protobuf
      encode: (payload: SparkplugPayload) => sparkplug.encodePayload(payload),
    }
```

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        UNIFIED NAMESPACE TOPIC STRUCTURE                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Topic Pattern:                                                             │
│  spBv1.0/{enterprise}/{site}/{area}/{line}/{cell}/{device}/{metric}        │
│                                                                             │
│  Examples:                                                                  │
│  spBv1.0/acme/chicago/assembly/line-01/cnc-001/spindle/rpm                 │
│  spBv1.0/acme/chicago/assembly/line-01/cnc-001/spindle/temperature         │
│  spBv1.0/acme/chicago/assembly/line-01/cnc-001/STATE                       │
│                                                                             │
│  Mapping to TMNL:                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                     │   │
│  │   MQTT Topic          →    Internal Routing                         │   │
│  │   ───────────────────────────────────────────────────────────────   │   │
│  │   spBv1.0/acme/chi... →    DeviceId: "acme-chicago-line01-cnc001"  │   │
│  │                                                                     │   │
│  │   Ingestion Adapter normalizes topic to:                            │   │
│  │   - Extract hierarchy components                                    │   │
│  │   - Map to DeviceId (idempotent)                                   │   │
│  │   - Route to correct hypertable                                    │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Ingestion Adapter Pattern**:

```typescript
// Effect Stream from MQTT subscription
const mqttStream = Stream.asyncScoped<MqttMessage, never, MqttClient>((emit) =>
  Effect.gen(function* () {
    const client = yield* MqttClient
    yield* client.subscribe('spBv1.0/+/+/+/+/+/#')

    client.on('message', (topic, payload) => {
      emit(Effect.succeed(Chunk.of({ topic, payload })))
    })

    return Effect.sync(() => client.unsubscribe())
  })
)

// Transform to domain model
const normalizedStream = mqttStream.pipe(
  Stream.map(parseSparkplugB),
  Stream.map((msg) => ({
    deviceId: deriveDeviceId(msg.topic),
    timestamp: msg.timestamp,
    value: msg.metrics[0]?.value,
    quality: mapSparkplugQuality(msg.metrics[0]?.quality),
  })),
  Stream.mapEffect((reading) => sensorReadingRepo.insert(reading)),
)
```

### 20.4 Alarm Management (ISA-18.2)

The alarm lifecycle follows ISA-18.2 patterns.

**Complete ISA-18.2 Alarm State Set (with Audible Bit)**:

```
ISA-18.2 Alarm State Machine (Full Specification):
                                    ┌──────────────────┐
                                    │     NORMAL       │
                                    │   (Audible: 0)   │
                                    └────────┬─────────┘
                                             │ condition triggers
                                             ▼
                    ┌────────────────────────────────────────────┐
        shelve      │            UNACKNOWLEDGED                  │    suppress
      ┌─────────────│              (Audible: 1)                  │─────────────┐
      │             └───────────────────┬────────────────────────┘             │
      ▼                                 │ operator acknowledges                ▼
┌─────────────┐                         ▼                              ┌────────────┐
│   SHELVED   │                ┌─────────────────┐                     │ SUPPRESSED │
│ (Audible:0) │                │  ACKNOWLEDGED   │                     │(Audible:0) │
└─────────────┘                │   (Audible: 0)  │                     └────────────┘
      │                        └────────┬────────┘
      │ timeout                         │ condition clears
      └──────────────┐                  ▼
                     │         ┌─────────────────────┐
                     └────────►│  RTN_UNACKNOWLEDGED │──────► NORMAL
                               │    (Audible: 0)     │
                               └─────────────────────┘

Additional States (not shown above):
  LATCH_UNACKNOWLEDGED (Audible: 1)  - Latched alarm, requires acknowledgment
  LATCH_ACKNOWLEDGED   (Audible: 0)  - Latched and acknowledged
  OUT_OF_SERVICE       (Audible: 0)  - Disabled for maintenance

Audible Bit: Determines if alarm should trigger audible notification (horn/buzzer)
```

**Effect-TS Alarm Schema**:

```typescript
// ISA-18.2 Alarm States (complete set with audible bit)
export const AlarmState = Schema.Literal(
  'NORMAL',                    // Audible: 0 - No alarm condition
  'UNACKNOWLEDGED',            // Audible: 1 - Active, needs attention
  'ACKNOWLEDGED',              // Audible: 0 - Operator aware, still active
  'RTN_UNACKNOWLEDGED',        // Audible: 0 - Returned to normal, not ack'd
  'LATCH_UNACKNOWLEDGED',      // Audible: 1 - Latched alarm, needs ack
  'LATCH_ACKNOWLEDGED',        // Audible: 0 - Latched and acknowledged
  'SHELVED',                   // Audible: 0 - Temporarily suppressed by operator
  'SUPPRESSED',                // Audible: 0 - Suppressed by system logic
  'OUT_OF_SERVICE',            // Audible: 0 - Disabled for maintenance
)

// Audible bit helper
const isAudible = (state: typeof AlarmState.Type): boolean =>
  state === 'UNACKNOWLEDGED' || state === 'LATCH_UNACKNOWLEDGED'

// Valid state transitions (ISA-18.2 compliant)
const AlarmTransitions = {
  NORMAL: ['UNACKNOWLEDGED'],
  UNACKNOWLEDGED: ['ACKNOWLEDGED', 'SHELVED', 'SUPPRESSED'],
  ACKNOWLEDGED: ['NORMAL', 'RTN_UNACKNOWLEDGED'],
  RTN_UNACKNOWLEDGED: ['NORMAL'],
  LATCH_UNACKNOWLEDGED: ['LATCH_ACKNOWLEDGED'],
  LATCH_ACKNOWLEDGED: ['NORMAL'],
  SHELVED: ['UNACKNOWLEDGED', 'NORMAL'], // Auto-unshelve after timeout
  SUPPRESSED: ['UNACKNOWLEDGED', 'NORMAL'],
  OUT_OF_SERVICE: ['NORMAL'],
} as const

export const AlarmSeverity = Schema.Literal(
  'diagnostic',  // ISA-18.2 Level 1
  'advisory',    // ISA-18.2 Level 2
  'warning',     // ISA-18.2 Level 3
  'critical'     // ISA-18.2 Level 4
)

export const AlarmEvents = EventGroup.empty
  .add({
    tag: 'AlarmRaised',
    payload: Schema.Struct({
      alarmId: AlarmId,
      deviceId: DeviceId,
      severity: AlarmSeverity,
      message: Schema.String,
      value: Schema.Number,
      threshold: Schema.Number,
      raisedAt: Schema.DateTimeUtc,
    }),
    primaryKey: (p) => p.alarmId,
  })
  .add({
    tag: 'AlarmAcknowledged',
    payload: Schema.Struct({
      alarmId: AlarmId,
      acknowledgedBy: IdentityId,
      acknowledgedAt: Schema.DateTimeUtc,
      comment: Schema.optional(Schema.String),
    }),
    primaryKey: (p) => p.alarmId,
  })
  .add({
    tag: 'AlarmShelved',
    payload: Schema.Struct({
      alarmId: AlarmId,
      shelvedBy: IdentityId,
      shelvedUntil: Schema.DateTimeUtc,
      reason: Schema.String,
    }),
    primaryKey: (p) => p.alarmId,
  })
  .add({
    tag: 'AlarmCleared',
    payload: Schema.Struct({
      alarmId: AlarmId,
      clearedAt: Schema.DateTimeUtc,
      clearedBy: Schema.optional(IdentityId),  // null = auto-clear
    }),
    primaryKey: (p) => p.alarmId,
  })
```

---

## 21. Extended Pattern Catalog

### 21.1 Pattern: Unified Namespace Routing

**Problem**: Multiple data sources (OPC-UA, MQTT/Sparkplug, Modbus) use different addressing schemes. Need unified internal routing.

**Solution**:

```typescript
// Adapter normalizes external addresses to internal DeviceId
interface IngestionAdapter<TSource> {
  readonly normalize: (source: TSource) => Effect.Effect<{
    deviceId: DeviceId
    timestamp: Date
    value: number
    quality: number
  }, ParseError>
}

// OPC-UA Adapter
const OpcUaAdapter: IngestionAdapter<OpcUaDataValue> = {
  normalize: (dv) => Effect.gen(function* () {
    const nodeId = dv.sourceNode.toString()
    const deviceId = yield* Schema.decode(DeviceId)(
      nodeId.replace(/[^a-zA-Z0-9-]/g, '-')
    )
    return {
      deviceId,
      timestamp: dv.sourceTimestamp ?? new Date(),
      value: dv.value as number,
      quality: dv.statusCode.value === 0 ? 100 : 50,
    }
  }),
}

// Sparkplug Adapter
const SparkplugAdapter: IngestionAdapter<SparkplugMessage> = {
  normalize: (msg) => Effect.gen(function* () {
    const parts = msg.topic.split('/')
    const deviceId = yield* Schema.decode(DeviceId)(
      `${parts[1]}-${parts[2]}-${parts[4]}-${parts[5]}`
    )
    return {
      deviceId,
      timestamp: new Date(msg.timestamp),
      value: msg.metrics[0]?.value ?? 0,
      quality: msg.metrics[0]?.quality ?? 100,
    }
  }),
}
```

**Alignment**: MQTT/Sparkplug B, OPC-UA, ISA-95 hierarchy

**Trade-offs**:
- Normalization adds latency (minimal with streaming)
- Device ID derivation must be deterministic and reversible
- Loss of source-specific metadata (mitigate with metadata fields)

**When NOT to use**: Direct OPC-UA integrations where address space matters

---

### 21.2 Pattern: Historian Rollup Tiers

**Problem**: Raw sensor data grows unboundedly. Need aggregation at multiple time scales with automatic retention.

**Solution**:

```typescript
// TimescaleDB continuous aggregates configured via DDL
const ROLLUP_TIERS = [
  { name: 'readings_1min', bucket: '1 minute', retention: '90 days' },
  { name: 'readings_1hour', bucket: '1 hour', retention: '1 year' },
  { name: 'readings_1day', bucket: '1 day', retention: null }, // indefinite
] as const

// Query routing based on time range
const selectRollupTier = (range: Duration) =>
  Match.value(Duration.toMillis(range)).pipe(
    Match.when((ms) => ms < 24 * 60 * 60 * 1000, () => 'sensor_readings'),     // <1 day
    Match.when((ms) => ms < 30 * 24 * 60 * 60 * 1000, () => 'readings_1min'),  // <30 days
    Match.when((ms) => ms < 365 * 24 * 60 * 60 * 1000, () => 'readings_1hour'),// <1 year
    Match.orElse(() => 'readings_1day'),
  )

// Query with automatic tier selection
const queryTimeRange = (deviceId: DeviceId, from: Date, to: Date) =>
  Effect.gen(function* () {
    const range = Duration.millis(to.getTime() - from.getTime())
    const table = selectRollupTier(range)

    const sql = yield* SqlClient.SqlClient
    const rows = yield* sql`
      SELECT bucket, avg_value, min_value, max_value, sample_count
      FROM ${sql.literal(table)}
      WHERE device_id = ${deviceId}
        AND bucket BETWEEN ${from} AND ${to}
      ORDER BY bucket
    `
    return yield* decodeRows(AggregatedReading)(rows)
  })
```

**Alignment**: Historian patterns (OSIsoft PI, Wonderware), TimescaleDB best practices

**Trade-offs**:
- Multiple tables to query (mitigate with query router)
- Aggregation lag (continuous aggregate refresh policy)
- Storage vs. precision trade-off at each tier

**When NOT to use**: Low-volume data where raw retention is affordable

---

### 21.3 Pattern: Alarm Lifecycle State Machine

**Problem**: Alarm states (raised, acked, shelved, cleared) need consistent transitions and audit trail compliant with ISA-18.2.

**Solution**: Use complete ISA-18.2 state machine (see Section 20.4 for full diagram).

```typescript
// ISA-18.2 compliant state machine (simplified subset for discrete manufacturing)
const AlarmStateMachine = {
  initial: 'NORMAL',
  states: {
    NORMAL: {
      on: { RAISE: 'UNACKNOWLEDGED' },
    },
    UNACKNOWLEDGED: {
      on: {
        ACK: 'ACKNOWLEDGED',
        SHELVE: 'SHELVED',
        SUPPRESS: 'SUPPRESSED',
        CLEAR: 'NORMAL',
      },
    },
    ACKNOWLEDGED: {
      on: {
        CLEAR: 'RTN_UNACKNOWLEDGED',
        SHELVE: 'SHELVED',
      },
    },
    RTN_UNACKNOWLEDGED: {
      on: { ACK: 'NORMAL' },
    },
    SHELVED: {
      on: {
        UNSHELVE: 'UNACKNOWLEDGED',
        CLEAR: 'NORMAL',
        EXPIRE: 'UNACKNOWLEDGED',  // shelf duration expires
      },
    },
    SUPPRESSED: {
      on: {
        UNSUPPRESS: 'UNACKNOWLEDGED',
        CLEAR: 'NORMAL',
      },
    },
  },
} as const

// Effect-native transition handler
const transitionAlarm = (alarm: Alarm, event: AlarmEvent) =>
  Effect.gen(function* () {
    const currentState = alarm.state
    const nextState = AlarmStateMachine.states[currentState]?.on?.[event.type]

    if (!nextState) {
      return yield* Effect.fail(new InvalidTransitionError({
        from: currentState,
        event: event.type,
      }))
    }

    const updated = { ...alarm, state: nextState, updatedAt: new Date() }
    yield* alarmRepo.update(updated)
    yield* maybeEmit(eventTagFor(event.type), { alarmId: alarm.id, ...event })

    return updated
  })
```

**Alignment**: ISA-18.2 Alarm Management, IEC 62682

**Trade-offs**:
- State machine adds complexity (mitigate with clear documentation)
- Shelving requires timer/scheduler for expiration
- Suppression logic may interact with alarm grouping

**When NOT to use**: Simple threshold alerts without operator workflow

---

### 21.4 Pattern: Command & Control with Saga

**Problem**: Operator commands affect multiple systems (PLC, database, audit log) and need rollback capability.

**Solution**:

```typescript
// Saga pattern for multi-step command execution
const executeOperatorCommand = (cmd: OperatorCommand) =>
  Effect.gen(function* () {
    // Step 1: Validate authorization
    const auth = yield* AuthService.checkPermission(cmd.operatorId, cmd.type)
    if (!auth.allowed) {
      return yield* Effect.fail(new UnauthorizedError({ reason: auth.reason }))
    }

    // Step 2: Send to PLC (external system)
    const plcResult = yield* PlcGateway.sendCommand(cmd.deviceId, cmd.payload).pipe(
      Effect.timeout('5 seconds'),
      Effect.catchTag('TimeoutException', () =>
        Effect.fail(new PlcTimeoutError({ deviceId: cmd.deviceId }))
      ),
    )

    // Step 3: Record in database (compensation: delete on failure)
    const record = yield* commandRepo.insert({
      id: cmd.id,
      deviceId: cmd.deviceId,
      type: cmd.type,
      payload: cmd.payload,
      executedBy: cmd.operatorId,
      executedAt: new Date(),
      plcResponse: plcResult,
    }).pipe(
      Effect.catchAll((dbError) =>
        // Compensation: attempt to reverse PLC command
        PlcGateway.sendCommand(cmd.deviceId, reversePayload(cmd.payload)).pipe(
          Effect.ignore,
          Effect.andThen(Effect.fail(new DatabaseError({ cause: dbError }))),
        )
      ),
    )

    // Step 4: Emit audit event
    yield* maybeEmit('CommandExecuted', {
      commandId: cmd.id,
      deviceId: cmd.deviceId,
      operatorId: cmd.operatorId,
      executedAt: new Date(),
    })

    return record
  })
```

**Alignment**: ISA-88 Batch Control, IEC 61512 procedural control

**Trade-offs**:
- Saga complexity increases with step count
- Compensation may not be possible for all operations
- Network partitions can leave system in inconsistent state

**When NOT to use**: Single-step operations, read-only queries

---

### 21.5 Pattern: Enterprise Integration Boundary

**Problem**: MES/ERP systems need read access to operational data but should not bypass domain logic.

**Solution**:

```typescript
// Outbound integration via Event projection
const MesIntegrationProjection = EventLog.group(
  MesIntegrationEvents,
  (handlers) => Effect.gen(function* () {
    const mesClient = yield* MesClient

    return handlers
      .handle('ProductionOrderCompleted', ({ payload }) =>
        mesClient.reportCompletion({
          orderId: payload.orderId,
          quantity: payload.producedQuantity,
          completedAt: payload.completedAt,
        }).pipe(Effect.retry(Schedule.exponential('1 second', 2)))
      )
      .handle('QualityCheckFailed', ({ payload }) =>
        mesClient.reportDefect({
          orderId: payload.orderId,
          defectType: payload.defectType,
          quantity: payload.defectQuantity,
        }).pipe(Effect.retry(Schedule.exponential('1 second', 2)))
      )
  })
)

// Inbound integration via command boundary
const ErpOrderSync = Effect.gen(function* () {
  const erpClient = yield* ErpClient
  const orders = yield* erpClient.getPendingOrders()

  yield* Effect.forEach(orders, (erpOrder) =>
    Effect.gen(function* () {
      // Transform ERP model to domain command
      const cmd = new CreateProductionOrder({
        externalId: erpOrder.id,
        productId: ProductId.make(erpOrder.itemNumber),
        quantity: erpOrder.quantity,
        dueDate: erpOrder.requestedDate,
      })

      // Execute through domain boundary
      yield* ProductionOrderEntity.execute(cmd)
    }),
    { concurrency: 5 }
  )
})
```

**Alignment**: ISA-95 B2MML, OAGIS, EDI patterns

**Trade-offs**:
- Event-based outbound is eventually consistent
- Inbound sync requires idempotency (external ID check)
- Schema mapping between systems is manual

**When NOT to use**: Real-time bidirectional sync (consider CDC)

---

## 22. External Systems Integration Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SYSTEMS INTEGRATION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                        EDGE / PLANT FLOOR                          │    │
│   │                                                                    │    │
│   │   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐      │    │
│   │   │ OPC-UA   │   │ Sparkplug│   │  Modbus  │   │  MQTT    │      │    │
│   │   │ Server   │   │    B     │   │ Gateway  │   │  Broker  │      │    │
│   │   └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘      │    │
│   │        │              │              │              │             │    │
│   │        └──────────────┴──────────────┴──────────────┘             │    │
│   │                           │                                        │    │
│   └───────────────────────────┼────────────────────────────────────────┘    │
│                               │                                             │
│                               ▼                                             │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                     INGESTION ADAPTERS                             │    │
│   │                                                                    │    │
│   │   ┌─────────────────────────────────────────────────────────┐     │    │
│   │   │  Normalize → DeviceId → Validate → Route → Persist      │     │    │
│   │   │                                                          │     │    │
│   │   │  Protocol-specific parsing   Internal domain model       │     │    │
│   │   │  (Sparkplug, OPC-UA)   →    (Schema.TaggedClass)        │     │    │
│   │   └─────────────────────────────────────────────────────────┘     │    │
│   │                                                                    │    │
│   └───────────────────────────┬────────────────────────────────────────┘    │
│                               │                                             │
│                               ▼                                             │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                      TMNL CORE (Effect-TS)                         │    │
│   │                                                                    │    │
│   │   ┌─────────────┐   ┌─────────────┐   ┌─────────────────────┐    │    │
│   │   │  Entities   │   │  EventLog   │   │   PostgreSQL        │    │    │
│   │   │  (CQRS)     │   │  (Audit)    │   │  + TimescaleDB      │    │    │
│   │   └──────┬──────┘   └──────┬──────┘   │  + Apache AGE       │    │    │
│   │          │                 │          └─────────────────────┘    │    │
│   │          └─────────────────┘                                      │    │
│   │                   │                                                │    │
│   └───────────────────┼────────────────────────────────────────────────┘    │
│                       │                                                     │
│                       ▼                                                     │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                    INTEGRATION ADAPTERS                            │    │
│   │                                                                    │    │
│   │   ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐     │    │
│   │   │ MES Adapter  │   │ ERP Adapter  │   │ Notification     │     │    │
│   │   │ (Outbound)   │   │ (Inbound)    │   │ Service          │     │    │
│   │   │              │   │              │   │                   │     │    │
│   │   │ - B2MML      │   │ - Order sync │   │ - Email/SMS      │     │    │
│   │   │ - Production │   │ - Master data│   │ - Push           │     │    │
│   │   │   reports    │   │   sync       │   │ - Webhook        │     │    │
│   │   └──────┬───────┘   └──────┬───────┘   └────────┬─────────┘     │    │
│   │          │                  │                    │                │    │
│   └──────────┼──────────────────┼────────────────────┼────────────────┘    │
│              │                  │                    │                     │
│              ▼                  ▼                    ▼                     │
│   ┌───────────────────────────────────────────────────────────────────┐    │
│   │                       ENTERPRISE SYSTEMS                           │    │
│   │                                                                    │    │
│   │   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐      │    │
│   │   │   MES    │   │   ERP    │   │   WMS    │   │   TMS    │      │    │
│   │   │          │   │          │   │          │   │          │      │    │
│   │   │ Prod     │   │ SAP/     │   │ Inventory│   │ Shipment │      │    │
│   │   │ Tracking │   │ Oracle   │   │ Mgmt     │   │ Tracking │      │    │
│   │   └──────────┘   └──────────┘   └──────────┘   └──────────┘      │    │
│   │                                                                    │    │
│   └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 23. Pass 2 Completion Summary

### Industry Patterns Incorporated

| Pattern | Standard | Section |
|---------|----------|---------|
| Equipment Hierarchy | ISA-95/IEC-62264 | 20.1 |
| Information Model | OPC-UA | 20.2 |
| Topic Structure | MQTT/Sparkplug B, UNS | 20.3 |
| Alarm Lifecycle | ISA-18.2/IEC-62682 | 20.4 |
| Batch Control | ISA-88/IEC-61512 | 21.4 |
| Enterprise Integration | ISA-95 B2MML | 21.5 |

### Extended Pattern Catalog

| Pattern | Alignment | Trade-offs |
|---------|-----------|------------|
| UNS Routing | MQTT/Sparkplug, OPC-UA | Normalization latency, metadata loss |
| Historian Rollups | TimescaleDB, OSIsoft PI | Multiple tables, aggregation lag |
| Alarm State Machine | ISA-18.2 | Complexity, timer management |
| Command Saga | ISA-88 | Compensation limits, partition handling |
| Enterprise Boundary | ISA-95 B2MML | Eventual consistency, schema mapping |

### Diagrams Added

- ISA-95 Hierarchy Mapping
- Alarm State Machine
- UNS Topic Structure
- External Systems Integration

---

*Pass 2 Complete - External Enrichment*
*Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>*
