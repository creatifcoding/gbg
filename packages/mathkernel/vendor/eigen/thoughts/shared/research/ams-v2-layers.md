# AMS v2 Layer Composition Research

**Generated:** 2026-01-25  
**Author:** Val (Scout)  
**Purpose:** Exhaustive analysis of AMS v2 layer architecture to inform v3 design

---

## Executive Summary

AMS v2 implements a **profile-scoped CQRS architecture** with **deployment-configurable layers**. The system provides three deployment targets (Test, Tauri, Cluster) via pre-composed layers that wire together:

- **Core primitives** (BFO ontology, identifiers, provenance)
- **Entity handlers** (CQRS command/query endpoints)
- **State services** (in-memory or SQL-backed)
- **Repositories** (@effect/sql persistence)
- **Event sourcing** (EventLog + SqlEventJournal)

Key architectural decisions:
1. **Dependency injection via Effect Layers** - swap implementations without code changes
2. **CQRS separation** - commands emit events, queries read state
3. **BFO-based ontology** - all entities classified via Basic Formal Ontology
4. **Profile extensibility** - base AMS extended by WMS/TMS profiles
5. **Runtime configuration** - `AMS_MODE` env var selects deployment target

---

## 1. Architecture Overview

### 1.1 Module Structure

```
src/lib/ams/v2/
├── core/                    # Shared primitives (identifiers, BFO, provenance)
│   └── schemas/
│       ├── bfo.ts          # Basic Formal Ontology class literals
│       ├── identifiers.ts  # Branded IDs (AssetId, SiteId, etc.)
│       ├── provenance.ts   # Audit trail schema
│       └── timestamps.ts   # CreatedAt, UpdatedAt
│
├── base/                    # Generic AMS CQRS stack
│   ├── schemas/            # Domain models (Asset, Location, Property, etc.)
│   ├── commands/           # Command schemas (CreateAsset, MoveAsset, etc.)
│   ├── queries/            # Query schemas (GetAsset, SearchAssets, etc.)
│   ├── events/             # Domain events (AssetCreated, AssetMoved, etc.)
│   ├── entities/           # Effect Cluster entity definitions
│   ├── handlers/           # Command/query handlers + event emission
│   ├── repositories/       # @effect/sql Model definitions
│   ├── services/           # AssetState abstraction + SQL implementation
│   └── layers/             # Pre-composed deployment layers ⭐
│       ├── deployments.ts  # TestLayer, SqlTestLayer, makeTauriLayer, makeClusterLayer
│       ├── runtime.ts      # AmsMode config, AmsRuntimeLayer
│       └── index.ts        # Re-exports
│
├── wms/                     # Warehouse Management profile (extends base)
└── tms/                     # Transport Management profile (extends base)
```

### 1.2 Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                      AssetEntityHandlers                        │
│         (Command/Query endpoints + Event emission)              │
└───────────────────────┬─────────────────────────────────────────┘
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌───────────────┐               ┌──────────────────┐
│  AssetState   │               │  EventLog Stack  │
│  (Interface)  │               │  (Event sourcing)│
└───────┬───────┘               └────────┬─────────┘
        │                                │
  ┌─────┴─────┐                    ┌────┴────┐
  │           │                    │         │
  ▼           ▼                    ▼         ▼
In-Mem   SQL-Backed          EventLog  SqlEventJournal
(Ref)     (Repos)            (API)     (Persistence)
          │                            │
          ├─ AllRepositoriesLive      ├─ Identity
          │  - AssetRepository        └─ EventJournal
          │  - SiteRepository
          │  - SectorRepository
          │  - ContainerRepository
          │  - AssetPropertyRepository
          │  - AssetTraitRepository
          │  - EventJournalRepository
          │
          └─ SqlClient.SqlClient
             (via SqliteTestLayer or PostgresLayer)
```

---

## 2. Layer Composition Pattern

### 2.1 Deployment Layers

AMS v2 provides **three pre-composed layers** for different deployment targets:

#### **TestLayer** (In-Memory, No Persistence)
```typescript
// Location: src/lib/ams/v2/base/layers/deployments.ts:46-48

export const TestLayer = AssetEntityHandlers.pipe(
  Layer.provide(AssetState.Default)
)
```

**What it provides:**
- `AssetEntityHandlers` (command/query handlers)
- `AssetState.Default` (in-memory state via `Ref<HashMap>`)

**What it does NOT provide:**
- EventLog (no event sourcing)
- SQL persistence

**Use case:** Fast unit tests that don't need persistence.

**Example:**
```typescript
const result = yield* Effect.runPromise(
  handler.pipe(Effect.provide(TestLayer))
)
```

---

#### **SqlTestLayer** (In-Memory SQLite + EventLog)
```typescript
// Location: src/lib/ams/v2/base/layers/deployments.ts:96-104

export const SqlTestLayer = Layer.mergeAll(
  AssetEntityHandlers.pipe(
    Layer.provide(AssetStateWithRepos),
    Layer.provide(EventLogWithSqlite)
  ),
  EventHandlersWithDeps,
  RepositoriesWithSqlite,
  EventLogWithSqlite
)
```

**Component breakdown:**
```typescript
// Repositories backed by in-memory SQLite
const RepositoriesWithSqlite = AllRepositoriesLive.pipe(
  Layer.provide(SqliteTestLayer)
)

// AssetState backed by repositories
const AssetStateWithRepos = AssetStateSQLLayer.pipe(
  Layer.provide(RepositoriesWithSqlite),
  Layer.provide(SqliteTestLayer)
)

// EventLog stack (EventLog + SqlEventJournal + Identity)
const EventLogWithSqlite = Layer.mergeAll(
  EventLogStackLayer,
  SqlEventJournalLayer
).pipe(Layer.provide(SqliteTestLayer))

// Event handlers (subscribe to events)
const EventHandlersWithDeps = AssetEventHandlers.pipe(
  Layer.provide(AssetStateWithRepos),
  Layer.provide(EventLogWithSqlite)
)
```

**What it provides:**
- All entity handlers
- SQL-backed state (in-memory SQLite)
- Full EventLog support
- Event handlers (subscribers)
- All repositories

**Use case:** Integration tests that need full CQRS/event sourcing.

**Example:**
```typescript
await Effect.runPromise(
  Effect.gen(function* () {
    const client = yield* makeClient('test')
    yield* client.CreateAsset({ ... })
  }).pipe(Effect.provide(SqlTestLayer))
)
```

---

#### **makeTauriLayer** (SQLite File Persistence)
```typescript
// Location: src/lib/ams/v2/base/layers/deployments.ts:128-154

export const makeTauriLayer = <E, R>(
  sqliteFileLayer: Layer.Layer<SqlClient.SqlClient, E, R>
) => {
  const repos = AllRepositoriesLive.pipe(Layer.provide(sqliteFileLayer))
  const assetState = AssetStateSQLLayer.pipe(
    Layer.provide(repos),
    Layer.provide(sqliteFileLayer)
  )
  const eventLog = Layer.mergeAll(
    EventLogStackLayer,
    SqlEventJournalLayer
  ).pipe(Layer.provide(sqliteFileLayer))
  const eventHandlers = AssetEventHandlers.pipe(
    Layer.provide(assetState),
    Layer.provide(eventLog)
  )

  return Layer.mergeAll(
    AssetEntityHandlers.pipe(
      Layer.provide(assetState),
      Layer.provide(eventLog)
    ),
    eventHandlers,
    repos,
    eventLog
  )
}
```

**What it provides:**
- All entity handlers
- SQL-backed state (SQLite file)
- Full EventLog support
- Event handlers

**Requires:** User provides `SqlClient.SqlClient` layer for file-based SQLite.

**Use case:** Desktop app (Tauri) with persistent database.

**Example:**
```typescript
const SqliteFileLayer = makeSqliteFileLayer('./data/ams.db')
const TauriLayer = makeTauriLayer(SqliteFileLayer)

await Effect.runPromise(
  handler.pipe(Effect.provide(TauriLayer))
)
```

---

#### **makeClusterLayer** (PostgreSQL)
```typescript
// Location: src/lib/ams/v2/base/layers/deployments.ts:182-208

export const makeClusterLayer = <E, R>(
  postgresLayer: Layer.Layer<SqlClient.SqlClient, E, R>
) => {
  const repos = AllRepositoriesLive.pipe(Layer.provide(postgresLayer))
  const assetState = AssetStateSQLLayer.pipe(
    Layer.provide(repos),
    Layer.provide(postgresLayer)
  )
  const eventLog = Layer.mergeAll(
    EventLogStackLayer,
    SqlEventJournalLayer
  ).pipe(Layer.provide(postgresLayer))
  const eventHandlers = AssetEventHandlers.pipe(
    Layer.provide(assetState),
    Layer.provide(eventLog)
  )

  return Layer.mergeAll(
    AssetEntityHandlers.pipe(
      Layer.provide(assetState),
      Layer.provide(eventLog)
    ),
    eventHandlers,
    repos,
    eventLog
  )
}
```

**Identical structure to `makeTauriLayer`** but expects PostgreSQL client.

**Use case:** K8s cluster production deployment.

**Example:**
```typescript
const PostgresLayer = makePostgresLayer({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
})
const ClusterLayer = makeClusterLayer(PostgresLayer)
```

---

### 2.2 Runtime Configuration

```typescript
// Location: src/lib/ams/v2/base/layers/runtime.ts

export type AmsMode = 'test' | 'sql-test' | 'tauri' | 'cluster'

export const AmsMode = Config.string('AMS_MODE').pipe(
  Config.withDefault('test'),
  Config.map((mode): AmsMode => {
    const valid: AmsMode[] = ['test', 'sql-test', 'tauri', 'cluster']
    if (valid.includes(mode as AmsMode)) return mode as AmsMode
    console.warn(`[AMS] Invalid AMS_MODE "${mode}", defaulting to "test"`)
    return 'test'
  })
)

export const selectLayerByMode = (mode: AmsMode) => {
  switch (mode) {
    case 'test': return TestLayer
    case 'sql-test': return SqlTestLayer
    case 'tauri':
      console.warn('[AMS] Tauri mode requires makeTauriLayer(SqliteFileLayer)')
      return SqlTestLayer // Fallback
    case 'cluster':
      console.warn('[AMS] Cluster mode requires makeClusterLayer(PostgresLayer)')
      return SqlTestLayer // Fallback
    default: return TestLayer
  }
}

export const AmsRuntimeLayer = Layer.unwrapEffect(
  pipe(
    Effect.config(AmsMode),
    Effect.map(selectLayerByMode),
    Effect.tap(() => Effect.logInfo(`[AMS] Runtime layer selected`))
  )
)
```

**Usage:**
```bash
AMS_MODE=sql-test bun run test
```

```typescript
const result = yield* handler.pipe(
  Effect.provide(AmsRuntimeLayer)
)
```

**Note:** `tauri` and `cluster` modes require manual layer construction since they need external SQL configuration.

---

## 3. Core Ontology: BFO (Basic Formal Ontology)

### 3.1 BFO Class Hierarchy

```typescript
// Location: src/lib/ams/v2/core/schemas/bfo.ts

// Continuant Classes (things that persist through time)
BfoContinuant                        // Root
├── BfoIndependentContinuant        // Exists independently
│   ├── BfoMaterialEntity           // Physical objects ⭐
│   │   ├── BfoObject               // Individual objects
│   │   ├── BfoObjectAggregate      // Collections
│   │   └── BfoFiatObjectPart       // Arbitrary parts
│   ├── BfoImmaterialEntity         // Non-physical
│   │   ├── BfoSpatialRegion        // Regions of space
│   │   ├── BfoSite                 // Locations ⭐
│   │   └── BfoContinuantFiatBoundary
│   └── ...
├── BfoSpecificallyDependentContinuant
│   ├── BfoRealizableEntity
│   │   ├── BfoRole                 // Roles entities play
│   │   ├── BfoFunction             // Capabilities
│   │   └── BfoDisposition          
│   ├── BfoQuality                  // Properties
│   └── BfoRelationalQuality
└── BfoGenericallyDependentContinuant

// Occurrent Classes (events/processes)
BfoOccurrent                         // Root
├── BfoProcess                       // Extended events ⭐
├── BfoProcessBoundary              // Event boundaries
├── BfoTemporalRegion               // Time periods
├── BfoSpatioTemporalRegion         // 4D regions
├── BfoHistory                       // Life cycles
└── BfoProcessProfile                // Event patterns
```

### 3.2 BFO Implementation Pattern

All class literals are **branded Schema.Literal** with versioned paths:

```typescript
export const BfoMaterialEntity = Schema.Literal('material_entity').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/MaterialEntity'),
  Schema.annotations({ description: 'BFO class: material entity' })
)
export type BfoMaterialEntity = typeof BfoMaterialEntity.Type
```

**Usage in entities:**
```typescript
export class Asset extends Schema.TaggedClass<Asset>()('Asset', {
  id: AssetId,
  bfoClass: BfoMaterialEntity, // Always 'material_entity' for assets
  kind: AssetKind,
  label: AssetLabel,
  // ...
}) {}
```

**Why BFO?**
- Provides **formal ontological grounding** for entity classification
- Enables **semantic interoperability** across profiles
- Supports **reasoners** and **query engines** that understand BFO
- Documents **ontological commitments** (e.g., "assets are material entities")

---

## 4. Identifier Patterns

### 4.1 Branded Identifiers

All identifiers are **branded Schema.String** with versioned paths:

```typescript
// Location: src/lib/ams/v2/core/schemas/identifiers.ts

export const AssetId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Asset/fields/AssetId'),
  Schema.annotations({
    identifier: '@gbg/tmnl/ams/v2/AssetId',
    description: 'Unique identifier for an Asset (DID or UUID)',
  })
)
export type AssetId = typeof AssetId.Type
```

**Pattern:** `@gbg/tmnl/ams/v2/{Entity}/fields/{Field}`

**Benefits:**
- **Type safety:** `AssetId` ≠ `SiteId` at compile time
- **Runtime validation:** Invalid IDs rejected during decoding
- **Versioning:** Schema path includes `v2`, enabling migration tracking
- **Documentation:** `annotations.identifier` for tooling

### 4.2 Identifier Catalog

| Identifier | Description | Path |
|------------|-------------|------|
| `EntityId` | Base entity ID (UUID/string/number) | `@gbg/tmnl/ams/v2/Entity/fields/EntityId` |
| `AssetId` | Asset identifier | `@gbg/tmnl/ams/v2/Asset/fields/AssetId` |
| `AssetKind` | Asset classification code | `@gbg/tmnl/ams/v2/Asset/fields/AssetKind` |
| `AssetLabel` | Human-readable label | `@gbg/tmnl/ams/v2/Asset/fields/AssetLabel` |
| `SiteId` | Site identifier | `@gbg/tmnl/ams/v2/Site/fields/SiteId` |
| `SectorId` | Sector within site | `@gbg/tmnl/ams/v2/Sector/fields/SectorId` |
| `ContainerId` | Container identifier | `@gbg/tmnl/ams/v2/Container/fields/ContainerId` |
| `CarrierId` | Mobile container | `@gbg/tmnl/ams/v2/Carrier/fields/CarrierId` |
| `PolicyId` | Policy identifier | `@gbg/tmnl/ams/v2/Policy/fields/PolicyId` |
| `PropertyKey` | Asset property key | `@gbg/tmnl/ams/v2/Property/fields/PropertyKey` |
| `TraitId` | Trait identifier | `@gbg/tmnl/ams/v2/Trait/fields/TraitId` |
| `IdentityId` | User/system/agent ID | `@gbg/tmnl/ams/v2/Identity/fields/IdentityId` |
| `Tag` | Faceted search tag | `@gbg/tmnl/ams/v2/Tag/fields/Tag` |

### 4.3 TODO Notes from Code

```typescript
// TODO: Need services in general, in particular, need an Id service, if it doesn't 
// exist that creates system id, which would follow some UUID schema, and persisted 
// mapping via Key/Value store to human readable labels.

// TODO: These strings need to be backed by robust Schema.Literals, wrapped in 
// various sets Unions, or other Schema/type levels, for kind, label, and whatever 
// other fields you see fit. Also support dynamics. Find a suitable approach.

// TODO: Per id service, need to support a mapping between that an array of valid 
// labels for a particular Id's. need to think of conflict modalities.

// TODO: Same idea, all ID's need to be handled by some IdManagementService, that's 
// concurrent and can handle creating insane amounts of ID's transactionally.
```

**Implications for v3:**
- Centralized **IdManagementService** for UUID generation
- **Human-readable labels** mapped to system IDs via KV store
- **Dynamic ID schemas** via Schema.Literal unions
- **Concurrent ID generation** for bulk operations

---

## 5. Provenance Tracking

### 5.1 Provenance Schema

```typescript
// Location: src/lib/ams/v2/core/schemas/provenance.ts

export const SourceType = Schema.Literal(
  'manual',
  'sensor',
  'ingestion_agent',
  'external_system'
).pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Provenance/fields/SourceType')
)

export const Confidence = Schema.Number.pipe(
  Schema.greaterThanOrEqualTo(0),
  Schema.lessThanOrEqualTo(1),
  Schema.brand('@gbg/tmnl/ams/v2/Provenance/fields/Confidence')
)

export const AttestationRef = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand('@gbg/tmnl/ams/v2/Provenance/fields/AttestationRef'),
  Schema.annotations({
    description: 'Reference to on-chain attestation (e.g., Sui object ID)',
  })
)

export class Provenance extends Schema.TaggedClass<Provenance>()('Provenance', {
  sourceType: SourceType,
  sourceId: Schema.optional(IdentityId),
  timestamp: CreatedAt,
  confidence: Schema.optional(Confidence),
  attestationRef: Schema.optional(AttestationRef),
}) {
  isHighConfidence(): boolean {
    return this.confidence !== undefined && this.confidence >= 0.8
  }

  isAttested(): boolean {
    return this.attestationRef !== undefined
  }
}
```

### 5.2 Usage Pattern

Provenance is attached to **property values**, not entities:

```typescript
export class AssetProperty extends Schema.TaggedClass<AssetProperty>()('AssetProperty', {
  key: PropertyKey,
  value: PropertyValue,
  provenance: Provenance, // ⭐ Audit trail
  mutable: PropertyMutable,
}) {}
```

**Command:**
```typescript
yield* client.SetAssetProperty({
  assetId: 'asset-000001',
  key: 'weight',
  value: '150kg',
  provenance: new Provenance({
    sourceType: 'sensor',
    sourceId: 'scale-01',
    timestamp: DateTime.unsafeNow(),
    confidence: 0.95,
    attestationRef: '0x1234...', // Sui object ID
  }),
  changedBy: 'user-01',
})
```

### 5.3 TODO Notes

```typescript
// TODO: SourceTypes need to be made flexible in the core, need concretes, but allow 
// for abstract extension. Profiles will define SourceTypes. This Schema.Literal will 
// be attached to, or just have a corresponding Schema.TaggedClass that is the 
// acquisition workflow itself. The sourcetype would be derived.

// TODO: Need a robust way of programmatically sharing descriptions, rules and policy 
// for particular SourceTypes, and more specific SourceTypes, like e.g. a particular agent.

// TODO: Confidence is computed during Sourcing workflows.

// TODO: Attestation ref is computed during Sourcing workflows.

// TODO: Provenance record is computed during Sourcing workflows.
```

**Implications for v3:**
- **Profile-specific SourceTypes** (WMS adds `'rfid_scanner'`, TMS adds `'gps_tracker'`)
- **Acquisition workflows** derive provenance automatically
- **Confidence scoring** via ML or rule-based systems
- **On-chain attestation** via Sui/other blockchains

---

## 6. Repository Layer (@effect/sql)

### 6.1 Model Definition Pattern

All models use `@effect/sql/Model` with field annotations:

```typescript
// Location: src/lib/ams/v2/base/repositories/asset.ts

export class AssetModel extends Model.Class<AssetModel>('AssetModel')({
  id: Model.GeneratedByApp(AssetId),          // App-generated ID
  bfoClass: Schema.String,
  kind: AssetKind,
  label: AssetLabel,
  description: Model.FieldOption(AssetDescription), // Optional field
  status: AssetStatus,
  siteId: SiteId,
  sectorId: Model.FieldOption(SectorId),
  containerId: Model.FieldOption(ContainerId),
  basePropertiesJson: NullableJsonFromString,      // Custom transform
  tagsJson: NullableJsonFromString,
  version: Schema.Number.pipe(Schema.int()),
  createdAt: Model.DateTimeInsert,            // Auto-set on insert
  updatedAt: Model.DateTimeUpdate,            // Auto-set on update
}) {}
```

**Field annotations:**
- `Model.GeneratedByApp(S)`: ID is app-generated (not DB auto-increment)
- `Model.Generated(S)`: DB generates value (e.g., auto-increment)
- `Model.FieldOption(S)`: Nullable field → `Option<S>`
- `Model.DateTimeInsert`: Auto-set on insert
- `Model.DateTimeUpdate`: Auto-set on update
- `Model.JsonFromString(S)`: JSON column (stringify/parse)

### 6.2 Repository Factory

```typescript
export const makeAssetRepository = Model.makeRepository(AssetModel, {
  tableName: 'assets',
  idColumn: 'id',
  spanPrefix: 'AssetRepository',
})
```

**Generated methods:**
- `insert(model: AssetModel.insert): Effect<AssetModel, E>`
- `update(model: AssetModel.update): Effect<AssetModel, E>`
- `delete(id: AssetId): Effect<void, E>`
- `findById(id: AssetId): Effect<Option<AssetModel>, E>`

### 6.3 Repository Services

Repositories are wrapped in `Effect.Service` for DI:

```typescript
// Location: src/lib/ams/v2/base/services/repositories.ts

export class AssetRepository extends Effect.Service<AssetRepository>()(
  '@gbg/tmnl/ams/v2/AssetRepository',
  {
    effect: makeAssetRepository,
  }
) {}
```

**Usage:**
```typescript
const repo = yield* AssetRepository
const asset = yield* repo.findById('asset-000001')
```

**Combined layer:**
```typescript
export const AllRepositoriesLive = Layer.mergeAll(
  AssetRepository.Default,
  SiteRepository.Default,
  SectorRepository.Default,
  ContainerRepository.Default,
  AssetPropertyRepository.Default,
  AssetTraitRepository.Default,
  EventJournalRepository.Default
)
```

### 6.4 SQLite Layer

```typescript
// Location: src/lib/ams/v2/base/repositories/sqlite-layer.ts

// In-memory SQLite
export const SqliteMemoryLayer = SqliteClient.layer({
  filename: ':memory:',
  transformResultNames: snakeToCamel, // DB → TS
  transformQueryNames: camelToSnake,  // TS → DB
})

// With migrations
export const SqliteTestLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* createTables(sql)
  })
).pipe(Layer.provideMerge(SqliteMemoryLayer))

// File-based
export const SqliteFileLayer = (filename: string) =>
  SqliteClient.layer({
    filename,
    transformResultNames: snakeToCamel,
    transformQueryNames: camelToSnake,
  })
```

**Migrations** (from `createTables`):
```sql
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  bfo_class TEXT NOT NULL,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  site_id TEXT NOT NULL REFERENCES sites(id),
  sector_id TEXT REFERENCES sectors(id),
  container_id TEXT REFERENCES containers(id),
  base_properties_json TEXT,
  tags_json TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
)

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_assets_site_id ON assets(site_id)
CREATE INDEX IF NOT EXISTS idx_assets_sector_id ON assets(sector_id)
CREATE INDEX IF NOT EXISTS idx_assets_container_id ON assets(container_id)
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status)
CREATE INDEX IF NOT EXISTS idx_assets_kind ON assets(kind)
```

**Note:** SQLite layer is NOT exported from `repositories/index.ts` because it imports `@effect/sql-sqlite-bun` (Bun-only). Import directly when needed.

---

## 7. State Services

### 7.1 AssetState Interface

`AssetState` is an **abstract service** with two implementations:

```typescript
// Location: src/lib/ams/v2/base/services/asset-state.ts

export class AssetState extends Effect.Service<AssetState>()('@gbg/tmnl/ams/v2/AssetState', {
  effect: Effect.gen(function* () {
    // In-memory implementation
    const assets = yield* Ref.make(HashMap.empty<AssetId, AssetRecord>())
    const properties = yield* Ref.make(HashMap.empty<string, AssetProperty>())
    const traits = yield* Ref.make(HashMap.empty<string, TraitInstance>())

    return {
      // Commands
      create: (params) => Effect.gen(...),
      update: (params) => Effect.gen(...),
      move: (params) => Effect.gen(...),
      setProperty: (params) => Effect.gen(...),
      removeProperty: (params) => Effect.gen(...),
      addTrait: (params) => Effect.gen(...),
      removeTrait: (params) => Effect.gen(...),
      delete: (params) => Effect.gen(...),

      // Queries
      findById: (id) => Effect.gen(...),
      findSummaryById: (id) => Effect.gen(...),
      exists: (id) => Effect.gen(...),
      listBySite: (params) => Effect.gen(...),
      listBySector: (params) => Effect.gen(...),
      listByContainer: (params) => Effect.gen(...),
      search: (params) => Effect.gen(...),
      getProperty: (params) => Effect.gen(...),
      getProperties: (params) => Effect.gen(...),
      countBySite: (siteId) => Effect.gen(...),
      countByStatus: (status) => Effect.gen(...),
      countByKind: (kind) => Effect.gen(...),
    } as const
  }),
}) {}
```

### 7.2 SQL-Backed Implementation

```typescript
// Location: src/lib/ams/v2/base/services/asset-state-sql.ts

export const AssetStateSQLLayer = Layer.effect(
  AssetState,
  Effect.gen(function* () {
    const assetRepo = yield* AssetRepository
    const propertyRepo = yield* AssetPropertyRepository
    const traitRepo = yield* AssetTraitRepository
    const sql = yield* SqlClient.SqlClient

    // Delegate all operations to repositories
    const create: AssetStateShape['create'] = (params) =>
      Effect.gen(function* () {
        const id = generateAssetId()
        const model = yield* assetRepo.insert(AssetModel.insert.make({
          id, kind: params.kind, label: params.label, // ...
        }))
        return modelToAsset(model)
      })

    const findById: AssetStateShape['findById'] = (assetId) =>
      Effect.gen(function* () {
        const result = yield* assetRepo.findById(assetId)
        if (Option.isNone(result)) {
          return yield* Effect.fail(new AssetNotFoundError({ assetId }))
        }
        return modelToAsset(result.value)
      })

    // ... more methods

    return { create, update, move, findById, /* ... */ } satisfies AssetStateShape
  })
)
```

**Key differences:**
- In-memory: Uses `Ref<HashMap>` for fast state access
- SQL-backed: Delegates to repositories, uses SQL for queries

**Swapping implementations:**
```typescript
// Test (in-memory)
const layer = AssetEntityHandlers.pipe(
  Layer.provide(AssetState.Default)
)

// Production (SQL)
const layer = AssetEntityHandlers.pipe(
  Layer.provide(AssetStateSQLLayer),
  Layer.provide(AllRepositoriesLive),
  Layer.provide(SqliteTestLayer)
)
```

---

## 8. Entity Handlers

### 8.1 Handler Implementation

```typescript
// Location: src/lib/ams/v2/base/handlers/asset.ts

export const AssetEntityHandlers = AssetEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* AssetState

    // Try to get EventLog client - optional dependency
    const eventLogOption = yield* Effect.serviceOption(EventLog.EventLog)
    const writeEvent = Option.isSome(eventLogOption)
      ? yield* EventLog.makeClient(AmsEventLogSchema)
      : null

    // Helper to emit event if EventLog is available
    const maybeEmit = <T>(tag, payload) =>
      writeEvent
        ? writeEvent(tag, payload).pipe(Effect.catchAll(() => Effect.void))
        : Effect.void

    return {
      // Command handlers (with event emission)
      CreateAsset: (envelope) =>
        Effect.gen(function* () {
          const asset = yield* state.create({
            siteId: envelope.payload.siteId,
            kind: envelope.payload.kind,
            label: envelope.payload.label,
            // ...
          })

          yield* maybeEmit('AssetCreated', new AssetCreatedPayload({
            assetId: asset.id,
            siteId: asset.siteId,
            kind: asset.kind,
            // ...
          }))

          return asset
        }),

      UpdateAsset: (envelope) => Effect.gen(...),
      MoveAsset: (envelope) => Effect.gen(...),
      SetAssetProperty: (envelope) => Effect.gen(...),
      // ... more commands

      // Query handlers (no event emission)
      GetAsset: (envelope) => state.findById(envelope.payload.assetId),
      GetAssetSummary: (envelope) => state.findSummaryById(envelope.payload.assetId),
      SearchAssets: (envelope) => state.search({ ... }),
      // ... more queries
    }
  })
)
```

**Key patterns:**
1. **Yield AssetState** - DI provides correct implementation
2. **Optional EventLog** - handlers work without event sourcing
3. **maybeEmit** - emit events if EventLog is available
4. **Command/Query separation** - commands emit events, queries don't

### 8.2 Defect Retry Policy

```typescript
AssetEntity.toLayer(
  Effect.gen(...),
  { defectRetryPolicy: Schedule.exponential('100 millis', 2).pipe(Schedule.upTo('10 seconds')) }
)
```

Retries defects (unexpected errors) with exponential backoff:
- Start: 100ms
- Multiplier: 2x
- Max total time: 10 seconds

---

## 9. Event Sourcing

### 9.1 EventLog Stack

```typescript
// Location: src/lib/ams/v2/base/handlers/sql-event-journal.ts

export const SqlEventJournalLayer = SqlEventJournal.layer({
  eventLogTable: 'ams_event_journal',
  remotesTable: 'ams_event_remotes',
})

export const IdentityLayer = Layer.succeed(
  EventLog.Identity, 
  EventLog.Identity.makeRandom()
)

export const EventLogLayer = EventLog.layer(AmsEventLogSchema)

export const EventLogStackLayer = EventLogLayer.pipe(
  Layer.provide(SqlEventJournalLayer),
  Layer.provide(IdentityLayer)
)
```

**Component breakdown:**
- **SqlEventJournalLayer**: Persists events to SQL tables
- **IdentityLayer**: Provides cryptographic identity for EventLog
- **EventLogLayer**: High-level API for handlers
- **EventLogStackLayer**: Combined stack

### 9.2 Event Schema

```typescript
// Location: src/lib/ams/v2/base/events/schema.ts

export const AmsEventLogSchema = EventLog.makeSchema({
  AssetCreated: AssetCreatedPayload,
  AssetUpdated: AssetUpdatedPayload,
  AssetMoved: AssetMovedPayload,
  PropertyChanged: PropertyChangedPayload,
  PropertyRemoved: PropertyRemovedPayload,
  TraitAdded: TraitAddedPayload,
  TraitRemoved: TraitRemovedPayload,
  AssetDeleted: AssetDeletedPayload,
})
```

### 9.3 Event Payloads

Example:
```typescript
// Location: src/lib/ams/v2/base/events/asset.ts

export class AssetCreatedPayload extends Schema.TaggedClass<AssetCreatedPayload>()(
  'AssetCreatedPayload',
  {
    assetId: AssetId,
    siteId: SiteId,
    sectorId: Schema.optional(SectorId),
    containerId: Schema.optional(ContainerId),
    kind: AssetKind,
    label: AssetLabel,
    description: Schema.optional(AssetDescription),
    status: AssetStatus,
    tags: Schema.optional(Tags),
    createdBy: IdentityId,
    createdAt: CreatedAt,
  }
) {}
```

### 9.4 Event Handlers (Subscribers)

```typescript
// Location: src/lib/ams/v2/base/handlers/event-handlers.ts

export const AssetEventHandlers = EventLog.subscribe(
  AmsEventLogSchema,
  Effect.gen(function* () {
    const state = yield* AssetState

    return {
      AssetCreated: (event) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`Asset created: ${event.payload.assetId}`)
          // Side effects (e.g., send notification, update cache)
        }),

      AssetMoved: (event) =>
        Effect.gen(function* () {
          yield* Effect.logInfo(`Asset moved: ${event.payload.assetId}`)
          // Side effects
        }),

      // ... more event handlers
    }
  })
)
```

**Pattern:**
- Handlers subscribe to events via `EventLog.subscribe`
- Each event gets a handler function
- Handlers perform **side effects** (logging, notifications, cache updates)
- Handlers do NOT mutate state (state is updated by commands)

---

## 10. Code Examples

### 10.1 Full Test Example

```typescript
import { Effect } from 'effect'
import { SqlTestLayer } from '@gbg/tmnl/ams/v2/base/layers'
import { makeClient } from '@effect/cluster/EntityRpc'

it.effect('creates and updates asset', () =>
  Effect.gen(function* () {
    const client = yield* makeClient('test')

    // Create asset
    const asset = yield* client.CreateAsset({
      siteId: 'site-01',
      kind: 'EQUIPMENT',
      label: 'Forklift #1',
      description: 'Toyota 8FGU25',
      status: 'available',
      createdBy: 'user-01',
    })

    expect(asset.id).toBeDefined()
    expect(asset.label).toBe('Forklift #1')

    // Update asset
    const updated = yield* client.UpdateAsset({
      assetId: asset.id,
      label: 'Forklift #1 - Warehouse A',
      updatedBy: 'user-01',
    })

    expect(updated.label).toBe('Forklift #1 - Warehouse A')

    // Search assets
    const results = yield* client.SearchAssets({
      siteId: 'site-01',
      query: 'forklift',
      limit: 10,
    })

    expect(results.items.length).toBeGreaterThan(0)
  }).pipe(Effect.provide(SqlTestLayer))
)
```

### 10.2 Tauri Integration

```typescript
import { makeTauriLayer } from '@gbg/tmnl/ams/v2/base/layers'
import { SqliteFileLayer } from '@gbg/tmnl/ams/v2/base/repositories/sqlite-layer'

// Setup
const dbPath = await path.join(await path.appDataDir(), 'ams.db')
const SqliteLayer = SqliteFileLayer(dbPath)
const TauriLayer = makeTauriLayer(SqliteLayer)

// Runtime
const runtime = await Effect.runPromise(
  Effect.gen(function* () {
    const client = yield* makeClient('tauri')
    return Layer.toRuntime(TauriLayer)
  })
)

// Use in Tauri commands
const asset = await Effect.runPromise(
  client.CreateAsset({ ... }),
  { runtime }
)
```

### 10.3 Cluster Deployment

```typescript
import { makeClusterLayer } from '@gbg/tmnl/ams/v2/base/layers'
import { PgClient } from '@effect/sql-pg'

const PostgresLayer = PgClient.layer({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT),
  database: process.env.PG_DATABASE,
  username: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
})

const ClusterLayer = makeClusterLayer(PostgresLayer)

const server = yield* createServer({
  cluster: ClusterLayer,
  port: 8080,
})
```

---

## 11. Layer Wiring Summary

### 11.1 Dependency Tree

```
TestLayer
└── AssetEntityHandlers
    └── AssetState.Default (in-memory)

SqlTestLayer
└── Layer.mergeAll
    ├── AssetEntityHandlers
    │   ├── AssetStateSQLLayer
    │   │   ├── AssetRepository
    │   │   ├── AssetPropertyRepository
    │   │   ├── AssetTraitRepository
    │   │   └── SqlClient (from SqliteTestLayer)
    │   └── EventLogStackLayer
    │       ├── EventLogLayer (API)
    │       ├── SqlEventJournalLayer (persistence)
    │       │   └── SqlClient (from SqliteTestLayer)
    │       └── IdentityLayer
    ├── AssetEventHandlers
    │   ├── AssetStateSQLLayer
    │   └── EventLogStackLayer
    ├── AllRepositoriesLive
    │   ├── AssetRepository.Default
    │   ├── SiteRepository.Default
    │   ├── SectorRepository.Default
    │   ├── ContainerRepository.Default
    │   ├── AssetPropertyRepository.Default
    │   ├── AssetTraitRepository.Default
    │   └── EventJournalRepository.Default
    └── EventLogStackLayer

SqliteTestLayer
└── Layer.effectDiscard
    └── createTables(sql)
        └── SqliteMemoryLayer
            └── SqliteClient.layer({ filename: ':memory:' })
```

### 11.2 Layer Composition Table

| Layer | Provides | Requires | Use Case |
|-------|----------|----------|----------|
| `TestLayer` | AssetEntityHandlers, AssetState (in-memory) | None | Fast unit tests |
| `SqlTestLayer` | Full CQRS stack + EventLog | None | Integration tests |
| `makeTauriLayer(sql)` | Full CQRS stack + EventLog | SqlClient (file) | Desktop app |
| `makeClusterLayer(pg)` | Full CQRS stack + EventLog | SqlClient (PostgreSQL) | K8s production |
| `AssetState.Default` | In-memory state | None | Testing |
| `AssetStateSQLLayer` | SQL-backed state | AssetRepository, SqlClient | Production |
| `AllRepositoriesLive` | All repositories | SqlClient | SQL-backed systems |
| `EventLogStackLayer` | EventLog + SqlEventJournal | SqlClient | Event sourcing |
| `SqliteTestLayer` | SqlClient (in-memory) | None | Testing |
| `SqliteFileLayer(path)` | SqlClient (file) | None | Desktop app |

---

## 12. Patterns & Conventions

### 12.1 Naming Conventions

**Files:**
- `deployments.ts` - Pre-composed layers
- `runtime.ts` - Config-driven layer selection
- `asset-state.ts` - In-memory service implementation
- `asset-state-sql.ts` - SQL-backed service implementation
- `repositories.ts` - Repository service definitions
- `sqlite-layer.ts` - SQLite client + migrations

**Services:**
- `AssetState` - Abstract service interface
- `AssetRepository` - Repository service
- `AssetEntityHandlers` - Entity handler layer

**Layers:**
- `TestLayer` - In-memory
- `SqlTestLayer` - In-memory SQL
- `makeTauriLayer` - File-based SQL
- `makeClusterLayer` - PostgreSQL
- `AllRepositoriesLive` - Combined repositories

### 12.2 Schema Branding Pattern

All core schemas use versioned branding:
```typescript
Schema.String.pipe(
  Schema.brand('@gbg/tmnl/ams/v2/{Entity}/fields/{Field}')
)
```

**Benefits:**
- Compile-time type safety
- Runtime validation
- Versioning support
- Documentation

### 12.3 Layer Composition Pattern

```typescript
const DependencyLayer = BaseDependency.pipe(
  Layer.provide(Requirement1),
  Layer.provide(Requirement2)
)

const CombinedLayer = Layer.mergeAll(
  Service1,
  Service2,
  Service3
)

const StackLayer = TopLayer.pipe(
  Layer.provide(MiddleLayer),
  Layer.provide(BottomLayer)
)
```

### 12.4 Effect.Service Pattern

```typescript
export class MyService extends Effect.Service<MyService>()(
  '@gbg/tmnl/ams/v2/MyService',
  {
    effect: Effect.gen(function* () {
      const dep = yield* Dependency
      return { method1: () => Effect.gen(...) }
    }),
  }
) {}

// Usage
const svc = yield* MyService
const result = yield* svc.method1()
```

---

## 13. Open Questions & TODOs

### 13.1 ID Management

**Current state:** Simple counter-based ID generation  
**TODO:**
- Centralized `IdManagementService` for UUID generation
- Human-readable labels mapped to system IDs
- Concurrent ID generation for bulk operations
- DID integration for decentralized identifiers

### 13.2 Dynamic Schemas

**Current state:** `AssetKind` is `Schema.String` (no validation)  
**TODO:**
- `AssetKind` backed by `Schema.Literal` unions
- Profile-specific extensions (WMS adds `'PALLET'`, TMS adds `'TRAILER'`)
- Dynamic schema resolution (load from ontology service)

### 13.3 Provenance Workflows

**Current state:** Manual provenance construction  
**TODO:**
- Acquisition workflows derive provenance automatically
- Confidence scoring via ML or rule-based systems
- On-chain attestation via Sui/other blockchains
- Profile-specific SourceTypes

### 13.4 Profile Extensibility

**Current state:** WMS/TMS profiles exist but incomplete  
**TODO:**
- Profile-specific event schemas
- Profile-specific repositories
- Profile-specific layers
- Profile composition (WMS + TMS in same deployment)

### 13.5 Event Replay

**Current state:** Events are persisted but not replayed  
**TODO:**
- Event replay for audit trails
- Event sourcing for read models
- Snapshot management for large aggregates

---

## 14. Architectural Insights for v3

### 14.1 What Works Well

**Layer Composition:**
- Pre-composed layers (`TestLayer`, `SqlTestLayer`) eliminate boilerplate
- Config-driven layer selection (`AmsRuntimeLayer`) simplifies deployment
- Layer.mergeAll pattern is elegant for combining services

**Effect.Service Pattern:**
- Clean DI via `yield* Service`
- Swappable implementations (in-memory vs SQL)
- Type-safe service dependencies

**BFO Ontology:**
- Provides formal grounding for entity classification
- Enables semantic interoperability
- Documents ontological commitments

**Branded Identifiers:**
- Compile-time type safety prevents ID misuse
- Runtime validation catches invalid IDs
- Versioned paths enable migration tracking

**CQRS + Event Sourcing:**
- Clear separation of commands (write) and queries (read)
- Event log provides audit trail
- Event handlers enable side effects (notifications, cache updates)

### 14.2 Pain Points

**Layer Complexity:**
- Wiring dependencies is verbose (see `SqlTestLayer` example)
- Deep nesting makes errors hard to debug
- Layer.provide order matters (non-commutative)

**SQL Model Transforms:**
- `NullableJsonFromString` schema is complex
- Option vs null impedance mismatch
- Manual model-to-domain transformations are error-prone

**ID Generation:**
- Simple counter is not production-ready
- No UUID generation
- No human-readable label mapping

**Dynamic Schemas:**
- `AssetKind` is unvalidated string (should be Schema.Literal union)
- No profile-specific schema extensions
- Hard to add new asset kinds without code changes

**Event Replay:**
- Events are persisted but not replayed
- No snapshot management
- No read model projections

### 14.3 Recommendations for v3

**1. Simplify Layer Composition**
- Provide higher-level factory functions (e.g., `makeAmsStack({ mode, sql })`)
- Auto-wire common dependencies (e.g., repositories always need SqlClient)
- Better error messages for missing dependencies

**2. Improve SQL Transforms**
- Use @effect/sql's built-in transforms where possible
- Provide helper schemas for common patterns (e.g., `OptionalJson`, `SqliteBoolean`)
- Consider code generation for model-to-domain conversions

**3. Centralized ID Management**
- `IdManagementService` for UUID generation
- Human-readable label mapping via KV store
- DID integration for decentralized identifiers

**4. Dynamic Schema System**
- Schema registry for profile-specific types
- Runtime schema loading from ontology service
- Schema composition (merge WMS + TMS schemas)

**5. Event Replay Infrastructure**
- Event replay for audit trails
- Snapshot management for large aggregates
- Read model projections (CQRS query side)

**6. Profile Composition**
- Multi-profile deployments (WMS + TMS in same cluster)
- Profile-specific layers
- Profile-specific event schemas

**7. Better Observability**
- Tracing spans for layer wiring
- Metrics for repository operations
- Event log analytics

---

## 15. References

### 15.1 Key Files

| File | Description |
|------|-------------|
| `src/lib/ams/v2/base/layers/deployments.ts` | Pre-composed deployment layers |
| `src/lib/ams/v2/base/layers/runtime.ts` | Config-driven layer selection |
| `src/lib/ams/v2/base/services/asset-state.ts` | In-memory state service |
| `src/lib/ams/v2/base/services/asset-state-sql.ts` | SQL-backed state service |
| `src/lib/ams/v2/base/services/repositories.ts` | Repository service definitions |
| `src/lib/ams/v2/base/repositories/asset.ts` | SQL models (@effect/sql) |
| `src/lib/ams/v2/base/repositories/sqlite-layer.ts` | SQLite client + migrations |
| `src/lib/ams/v2/base/handlers/asset.ts` | Entity handlers (CQRS) |
| `src/lib/ams/v2/base/handlers/sql-event-journal.ts` | EventLog stack |
| `src/lib/ams/v2/core/schemas/bfo.ts` | BFO ontology literals |
| `src/lib/ams/v2/core/schemas/identifiers.ts` | Branded identifiers |
| `src/lib/ams/v2/core/schemas/provenance.ts` | Provenance schema |

### 15.2 External Dependencies

| Package | Usage |
|---------|-------|
| `effect` | Core Effect system |
| `@effect/sql` | SQL abstraction |
| `@effect/sql-sqlite-bun` | SQLite client (Bun) |
| `@effect/sql-pg` | PostgreSQL client |
| `@effect/experimental/EventLog` | Event sourcing |
| `@effect/cluster` | Entity system |

---

**END OF RESEARCH DOCUMENT**
