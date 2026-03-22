# AMS v2 Services Layer Architecture

Research date: 2026-01-25  
Status: Exhaustive analysis for v3 design reference  
Location: `src/lib/ams/v2/base/services/`

---

## Executive Summary

AMS v2 implements a **dual-service architecture** with Effect-native patterns:

1. **AssetState** - In-memory state service (testing/development)
2. **AssetStateSQLLayer** - SQL-backed production implementation  
3. **Repository Services** - Generic CRUD via `Model.makeRepository`

Both implementations satisfy **AssetStateShape** interface, enabling swappable backends via Layer composition.

**Key Pattern**: Service → Shape → Implementation variants (in-memory vs SQL)

---

## 1. Service Definition Patterns (Effect.Service)

### 1.1 Service Class Pattern

```typescript
// Pattern: Effect.Service<T>() with effect factory
export class AssetState extends Effect.Service<AssetState>()(
  '@gbg/tmnl/ams/v2/AssetState',
  {
    effect: Effect.gen(function* () {
      // Initialize state (Refs, atoms, etc.)
      const assets = yield* Ref.make(HashMap.empty<AssetId, AssetRecord>())
      
      // Define operations
      const create = (params: CreateParams) => Effect.gen(...)
      const findById = (id: AssetId) => Effect.gen(...)
      
      // Return service interface
      return {
        create,
        findById,
        // ... all operations
      } as const
    }),
  }
) {}
```

**Key characteristics**:
- Service tag: `@gbg/tmnl/ams/v2/AssetState` (unique identifier)
- Factory in `effect` field returns service interface
- `.Default` layer auto-generated for DI
- Consumed via `yield* AssetState` in Effect.gen

### 1.2 Repository Service Pattern

```typescript
// Pattern: Wrap Model.makeRepository in Effect.Service
export class AssetRepository extends Effect.Service<AssetRepository>()(
  '@gbg/tmnl/ams/v2/AssetRepository',
  {
    effect: makeAssetRepository, // Direct factory reference
  }
) {}

// Repository factory from @effect/sql Model
export const makeAssetRepository = Model.makeRepository(AssetModel, {
  tableName: 'assets',
  idColumn: 'id',
  spanPrefix: 'AssetRepository',
})
```

**Key characteristics**:
- Wraps `Model.makeRepository` for generic CRUD
- Requires `SqlClient.SqlClient` in environment (auto-injected by `.Default`)
- No manual implementation needed (declarative via Model schema)
- Provides: `insert`, `update`, `delete`, `findById`, `findAll`

---

## 2. How Services Relate to Entities

### 2.1 Service Operations → Domain Entities

```typescript
// Service method returns domain entity (Asset, not AssetModel)
const create: AssetStateShape['create'] = (params) =>
  Effect.gen(function* () {
    const id = generateAssetId()
    const timestamp = now()

    // Construct domain entity
    const asset = new Asset({
      id,
      bfoClass: 'material_entity' as BfoMaterialEntity,
      kind: params.kind,
      label: params.label,
      status: params.status ?? 'available',
      location: new AssetLocation({ ... }),
      baseProperties: params.baseProperties ?? new BaseAssetProperties({ quantity: 1 }),
      properties: [] as unknown as AssetProperties,
      traits: [] as unknown as AssetTraits,
      tags: params.tags ?? [],
      createdAt: timestamp as CreatedAt,
      updatedAt: timestamp as UpdatedAt,
    })

    // Store in state (in-memory)
    yield* Ref.update(assets, HashMap.set(id, { asset, version: 1 }))

    return asset // Return domain entity
  })
```

**Domain entity structure** (Schema.TaggedClass):
```typescript
export class Asset extends Schema.TaggedClass<Asset>()('Asset', {
  id: AssetId,
  bfoClass: BfoMaterialEntity,
  kind: AssetKind,
  label: AssetLabel,
  description: Schema.optional(AssetDescription),
  status: AssetStatus,
  location: AssetLocation,           // Nested TaggedClass
  baseProperties: BaseAssetProperties, // Nested TaggedClass
  properties: AssetProperties,        // Array of AssetProperty
  traits: AssetTraits,                // Array of TraitInstance
  tags: Tags,
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {
  // Domain methods
  isOperational(): boolean { ... }
  isAvailable(): boolean { ... }
  get siteId(): SiteId { return this.location.siteId }
}
```

**Key relationships**:
- Services operate on **domain entities** (Asset, Site, Sector)
- Domain entities are **Schema.TaggedClass** (runtime validation)
- Services **construct** entities from parameters
- Services **store/retrieve** via state (in-memory) or repositories (SQL)

### 2.2 SQL Implementation: Model ↔ Domain Transformation

```typescript
// Model → Domain (SQL to application layer)
const modelToAsset = (model: AssetModel): Asset =>
  new Asset({
    id: model.id,
    bfoClass: model.bfoClass as BfoMaterialEntity,
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
    // ... rest of fields
  })

// Service uses transformation
const findById: AssetStateShape['findById'] = (assetId) =>
  Effect.gen(function* () {
    const result = yield* assetRepo.findById(assetId)
    if (Option.isNone(result)) {
      return yield* Effect.fail(new AssetNotFoundError({ assetId, message: ... }))
    }
    return modelToAsset(result.value) // Transform to domain entity
  })
```

**Separation of concerns**:
- **AssetModel** - SQL schema (persistence layer, snake_case columns)
- **Asset** - Domain entity (application layer, camelCase, methods)
- **Service** - Orchestration (coordinates Model → Domain, validation, errors)

---

## 3. State Management Approach

### 3.1 In-Memory State (AssetState)

```typescript
export class AssetState extends Effect.Service<AssetState>()(
  '@gbg/tmnl/ams/v2/AssetState',
  {
    effect: Effect.gen(function* () {
      // State: Ref<HashMap<K, V>>
      const assets = yield* Ref.make(HashMap.empty<AssetId, AssetRecord>())
      const properties = yield* Ref.make(HashMap.empty<string, AssetProperty>())
      const traits = yield* Ref.make(HashMap.empty<string, TraitInstance>())

      // Operations mutate Refs
      const create = (params: CreateAssetParams) =>
        Effect.gen(function* () {
          const asset = new Asset({ ... })
          yield* Ref.update(assets, HashMap.set(id, { asset, version: 1 }))
          return asset
        })

      const findById = (assetId: AssetId) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(assets)
          const record = HashMap.get(current, assetId)
          if (Option.isNone(record)) {
            return yield* Effect.fail(new AssetNotFoundError({ ... }))
          }
          return record.value.asset
        })

      return { create, findById, ... }
    }),
  }
) {}
```

**Key patterns**:
- **Ref<HashMap<K, V>>** - Concurrent-safe in-memory state
- **Composite keys** - `${assetId}:${propertyKey}` for nested entities
- **Version tracking** - `{ asset: Asset, version: number }` for optimistic concurrency
- **ID generation** - Module-level counter (`asset-000001`)
- **Timestamp generation** - `DateTime.unsafeNow()` wrapper

**State structure**:
```typescript
interface AssetRecord {
  asset: Asset       // Domain entity
  version: number    // Optimistic concurrency control
}

// Three Refs for different entity types
assets:     Ref<HashMap<AssetId, AssetRecord>>
properties: Ref<HashMap<string, AssetProperty>>  // key = `${assetId}:${propertyKey}`
traits:     Ref<HashMap<string, TraitInstance>>   // key = `${assetId}:${traitId}`
```

### 3.2 SQL-Backed State (AssetStateSQLLayer)

```typescript
export const AssetStateSQLLayer = Layer.effect(
  AssetState,
  Effect.gen(function* () {
    // Dependencies: Repository services + SqlClient
    const assetRepo = yield* AssetRepository
    const propertyRepo = yield* AssetPropertyRepository
    const traitRepo = yield* AssetTraitRepository
    const sql = yield* SqlClient.SqlClient

    // Operations delegate to repositories
    const create: AssetStateShape['create'] = (params) =>
      Effect.gen(function* () {
        const id = generateAssetId()
        
        // Insert via repository
        const model = yield* assetRepo.insert(
          AssetModel.insert.make({
            id,
            kind: params.kind,
            label: params.label,
            status: params.status ?? 'available',
            siteId: params.siteId,
            // ... nullable fields as Option
            description: params.description 
              ? Option.some(params.description) 
              : Option.none(),
            version: 1,
          })
        )
        
        // Transform Model → Domain entity
        return modelToAsset(model)
      })

    const findById: AssetStateShape['findById'] = (assetId) =>
      Effect.gen(function* () {
        const result = yield* assetRepo.findById(assetId)
        if (Option.isNone(result)) {
          return yield* Effect.fail(new AssetNotFoundError({ ... }))
        }
        return modelToAsset(result.value)
      })

    return { create, findById, ... } satisfies AssetStateShape
  })
)
```

**Key patterns**:
- **Layer.effect(Service, factory)** - Provides AssetState via SQL implementation
- **Repository delegation** - All persistence through AssetRepository, etc.
- **Raw SQL for complex queries** - `sql<T>\`SELECT ...\`` for search/aggregation
- **Model → Domain transformation** - `modelToAsset()`, `modelToSummary()`
- **Option handling** - Nullable DB columns as `Option.some()` / `Option.none()`

**SQL operations**:
```typescript
// Simple queries: use repository
const existing = yield* assetRepo.findById(params.assetId)

// Complex queries: raw SQL
const rows = yield* sql<AssetModel>`
  SELECT * FROM assets
  WHERE site_id = ${params.siteId}
  ORDER BY created_at DESC
  LIMIT ${limit} OFFSET ${offset}
`

// Dynamic queries: unsafe (for WHERE clause construction)
const rows = yield* sql.unsafe<AssetModel>(
  `SELECT * FROM assets WHERE ${whereClause} LIMIT ${limit}`
)

// Upsert pattern: check + insert/update
const existingProps = yield* sql<{ id: number }>`
  SELECT id FROM asset_properties
  WHERE asset_id = ${assetId} AND key = ${key}
`
if (existingProps.length > 0) {
  yield* sql`UPDATE asset_properties SET value = ${value} WHERE ...`
} else {
  yield* propertyRepo.insert(...)
}
```

---

## 4. SQL Integration

### 4.1 Model Definition (@effect/sql)

```typescript
export class AssetModel extends Model.Class<AssetModel>('AssetModel')({
  // Generated fields
  id: Model.GeneratedByApp(AssetId),        // App-generated ID
  createdAt: Model.DateTimeInsert,          // Set on INSERT
  updatedAt: Model.DateTimeUpdate,          // Set on UPDATE

  // Required fields
  bfoClass: Schema.String,
  kind: AssetKind,
  label: AssetLabel,
  status: AssetStatus,
  siteId: SiteId,
  version: Schema.Number.pipe(Schema.int()),

  // Optional fields (Model.FieldOption)
  description: Model.FieldOption(AssetDescription),
  sectorId: Model.FieldOption(SectorId),
  containerId: Model.FieldOption(ContainerId),

  // JSON columns (custom schema for SQLite null handling)
  basePropertiesJson: NullableJsonFromString,
  tagsJson: NullableJsonFromString,
}) {}
```

**Model field types**:
| Type | Purpose | Example |
|------|---------|---------|
| `Model.Generated(S)` | DB-generated (auto-increment) | `id: Model.Generated(Schema.Number)` |
| `Model.GeneratedByApp(S)` | App-generated before insert | `id: Model.GeneratedByApp(AssetId)` |
| `Model.FieldOption(S)` | Nullable column (Option<T>) | `description: Model.FieldOption(AssetDescription)` |
| `Model.DateTimeInsert` | Set on INSERT | `createdAt: Model.DateTimeInsert` |
| `Model.DateTimeUpdate` | Set on UPDATE | `updatedAt: Model.DateTimeUpdate` |
| `Model.JsonFromString(S)` | JSON column (parsed) | `payloadJson: Model.JsonFromString(Schema.Unknown)` |

**Custom schemas for SQLite quirks**:
```typescript
// NullableJsonFromString - handles null ↔ Option.none() for JSON columns
const NullableJsonFromString = Schema.transform(
  Schema.NullOr(Schema.String),          // DB: null | string
  Schema.OptionFromSelf(Schema.Unknown), // TS: Option<unknown>
  {
    decode: (encoded) => encoded === null ? Option.none() : Option.some(JSON.parse(encoded)),
    encode: (decoded) => Option.isNone(decoded) ? null : JSON.stringify(decoded.value),
  }
)

// SqliteBoolean - SQLite stores booleans as 0/1
const SqliteBoolean = Schema.transform(
  Schema.Union(Schema.Literal(0), Schema.Literal(1), Schema.Boolean),
  Schema.Boolean,
  {
    decode: (encoded) => encoded === 1 || encoded === true,
    encode: (decoded) => decoded ? 1 : 0,
  }
)
```

**Model variants** (auto-generated):
```typescript
// Full model (SELECT results)
AssetModel.Type

// Insert schema (excludes generated fields)
AssetModel.insert.Type
AssetModel.insert.make({ ... })

// Update schema (includes id for WHERE, excludes createdAt)
AssetModel.update.Type
AssetModel.update.make({ ... })

// JSON schema (for API serialization)
AssetModel.json.Type
```

### 4.2 Repository Generation

```typescript
// Pattern: Model.makeRepository(Model, config)
export const makeAssetRepository = Model.makeRepository(AssetModel, {
  tableName: 'assets',      // SQL table name
  idColumn: 'id',           // Primary key column
  spanPrefix: 'AssetRepository', // Observability spans
})

// Generated repository interface:
interface Repository {
  insert(entity: AssetModel.insert.Type): Effect<AssetModel, SqlError, SqlClient>
  update(entity: AssetModel.update.Type): Effect<AssetModel, SqlError, SqlClient>
  delete(id: AssetId): Effect<void, SqlError, SqlClient>
  findById(id: AssetId): Effect<Option<AssetModel>, SqlError, SqlClient>
  findAll(): Effect<AssetModel[], SqlError, SqlClient>
}
```

**Usage in service**:
```typescript
// Wrap repository factory in Effect.Service
export class AssetRepository extends Effect.Service<AssetRepository>()(
  '@gbg/tmnl/ams/v2/AssetRepository',
  { effect: makeAssetRepository }
) {}

// Consume in service layer
const assetRepo = yield* AssetRepository
const model = yield* assetRepo.insert(AssetModel.insert.make({ ... }))
const found = yield* assetRepo.findById(assetId)
```

### 4.3 SQL Client Usage

```typescript
// Obtain SqlClient from environment
const sql = yield* SqlClient.SqlClient

// Parameterized queries (safe from SQL injection)
const rows = yield* sql<AssetModel>`
  SELECT * FROM assets
  WHERE site_id = ${siteId}
  ORDER BY created_at DESC
  LIMIT ${limit}
`

// Unsafe queries (for dynamic WHERE clauses)
const whereClause = buildWhereClause(params) // string concatenation
const rows = yield* sql.unsafe<AssetModel>(
  `SELECT * FROM assets WHERE ${whereClause} LIMIT ${limit}`
)

// Single-row queries
const count = yield* sql<{ count: number }>`
  SELECT COUNT(*) as count FROM assets WHERE status = ${status}
`
const total = count[0]?.count ?? 0
```

---

## 5. Repository Service Pattern

### 5.1 Service Definition (DI Wrapper)

```typescript
// Pattern: Effect.Service wrapping Model.makeRepository
export class AssetRepository extends Effect.Service<AssetRepository>()(
  '@gbg/tmnl/ams/v2/AssetRepository',
  {
    effect: makeAssetRepository, // Factory from Model.makeRepository
  }
) {}
```

**Auto-generated features**:
- `.Default` layer - Provides AssetRepository, requires SqlClient
- Service tag - `@gbg/tmnl/ams/v2/AssetRepository`
- DI integration - `yield* AssetRepository` in Effect.gen

### 5.2 Combined Repository Layer

```typescript
// Merge all repository .Default layers
export const AllRepositoriesLive = Layer.mergeAll(
  AssetRepository.Default,
  SiteRepository.Default,
  SectorRepository.Default,
  ContainerRepository.Default,
  AssetPropertyRepository.Default,
  AssetTraitRepository.Default,
  EventJournalRepository.Default
)

// Usage: Provide all repos at once
const ProductionLayer = AssetStateSQLLayer.pipe(
  Layer.provide(AllRepositoriesLive),
  Layer.provide(SqliteLayer), // or PostgresLayer
)
```

### 5.3 Repository Operations (CRUD)

```typescript
// Repository methods (generated by Model.makeRepository)
interface AssetRepositoryInterface {
  // Create
  insert(entity: AssetModel.insert.Type): Effect<AssetModel, SqlError>

  // Read
  findById(id: AssetId): Effect<Option<AssetModel>, SqlError>
  findAll(): Effect<AssetModel[], SqlError>

  // Update
  update(entity: AssetModel.update.Type): Effect<AssetModel, SqlError>

  // Delete
  delete(id: AssetId): Effect<void, SqlError>
}

// Usage in service
const repo = yield* AssetRepository

// Insert
const inserted = yield* repo.insert(
  AssetModel.insert.make({
    id: generateAssetId(),
    kind: 'EQUIPMENT',
    label: 'Forklift #1',
    status: 'available',
    siteId: 'site-01',
    bfoClass: 'material_entity',
    version: 1,
  })
)

// Find
const found = yield* repo.findById(assetId)
if (Option.isNone(found)) {
  return yield* Effect.fail(new AssetNotFoundError({ ... }))
}

// Update
const updated = yield* repo.update(
  AssetModel.update.make({
    ...found.value,
    label: 'Updated Label',
    version: found.value.version + 1,
  })
)

// Delete
yield* repo.delete(assetId)
```

---

## 6. Code Examples from Implementation

### 6.1 AssetState Service (In-Memory)

**Full service initialization**:
```typescript
export class AssetState extends Effect.Service<AssetState>()(
  '@gbg/tmnl/ams/v2/AssetState',
  {
    effect: Effect.gen(function* () {
      // State initialization
      const assets = yield* Ref.make(HashMap.empty<AssetId, AssetRecord>())
      const properties = yield* Ref.make(HashMap.empty<string, AssetProperty>())
      const traits = yield* Ref.make(HashMap.empty<string, TraitInstance>())

      let idCounter = 0
      const generateId = (): AssetId => {
        idCounter++
        return `asset-${idCounter.toString().padStart(6, '0')}` as AssetId
      }

      const now = (): DateTime.Utc => DateTime.unsafeNow()

      // Commands
      const create = (params: CreateAssetParams) => 
        Effect.gen(function* () {
          const id = generateId()
          const timestamp = now()
          
          const asset = new Asset({
            id,
            bfoClass: 'material_entity' as BfoMaterialEntity,
            kind: params.kind,
            label: params.label,
            description: params.description,
            status: params.status ?? 'available',
            location: new AssetLocation({
              siteId: params.siteId,
              sectorId: params.sectorId,
              containerId: params.containerId,
            }),
            baseProperties: params.baseProperties ?? new BaseAssetProperties({ quantity: 1 }),
            properties: [] as unknown as AssetProperties,
            traits: [] as unknown as AssetTraits,
            tags: params.tags ?? [],
            createdAt: timestamp as CreatedAt,
            updatedAt: timestamp as UpdatedAt,
          })

          yield* Ref.update(assets, HashMap.set(id, { asset, version: 1 }))
          return asset
        })

      const update = (params: UpdateAssetParams) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(assets)
          const record = HashMap.get(current, params.assetId)

          if (Option.isNone(record)) {
            return yield* Effect.fail(new AssetNotFoundError({ ... }))
          }

          const { asset, version } = record.value

          // Optimistic concurrency check
          if (params.expectedVersion !== undefined && version !== params.expectedVersion) {
            return yield* Effect.fail(new AssetConflictError({
              assetId: params.assetId,
              reason: `Version mismatch: expected ${params.expectedVersion}, got ${version}`,
              expectedVersion: params.expectedVersion,
              actualVersion: version,
            }))
          }

          const updated = new Asset({
            ...asset,
            label: params.label ?? asset.label,
            description: params.description ?? asset.description,
            status: params.status ?? asset.status,
            tags: params.tags ?? asset.tags,
            updatedAt: now() as UpdatedAt,
          })

          yield* Ref.update(assets, HashMap.set(params.assetId, { 
            asset: updated, 
            version: version + 1 
          }))

          return updated
        })

      // Queries
      const findById = (assetId: AssetId) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(assets)
          const record = HashMap.get(current, assetId)

          if (Option.isNone(record)) {
            return yield* Effect.fail(new AssetNotFoundError({ assetId, ... }))
          }

          return record.value.asset
        })

      const listBySite = (params: ListBySiteParams) =>
        Effect.gen(function* () {
          const current = yield* Ref.get(assets)
          const all = HashMap.values(current)
          const filtered = Array.from(all)
            .filter((r) => r.asset.siteId === params.siteId)
            .map((r) => r.asset)

          // Pagination
          const limit = params.limit ?? 50
          const offset = params.cursor ? parseInt(params.cursor, 10) : 0
          const sliced = filtered.slice(offset, offset + limit + 1)
          const hasNextPage = sliced.length > limit
          const items = hasNextPage ? sliced.slice(0, limit) : sliced

          // Map to summaries
          const summaries = items.map(a => new AssetSummary({
            id: a.id,
            kind: a.kind,
            label: a.label,
            status: a.status,
            siteId: a.siteId,
            sectorId: a.sectorId,
          }))

          return {
            _tag: 'PaginatedAssets' as const,
            items: summaries,
            pageInfo: {
              _tag: 'PageInfo' as const,
              nextCursor: hasNextPage ? String(offset + limit) : null,
              hasNextPage,
              totalCount: filtered.length,
            },
          }
        })

      return {
        // Commands (8)
        create,
        update,
        move,
        setProperty,
        removeProperty,
        addTrait,
        removeTrait,
        delete: deleteAsset,

        // Queries (11)
        findById,
        findSummaryById,
        exists,
        listBySite,
        listBySector,
        listByContainer,
        search,
        getProperty,
        getProperties,
        countBySite,
        countByStatus,
        countByKind,
      } as const
    }),
  }
) {}
```

### 6.2 AssetStateSQLLayer (SQL-Backed)

**Key operations**:
```typescript
export const AssetStateSQLLayer = Layer.effect(
  AssetState,
  Effect.gen(function* () {
    // Dependencies
    const assetRepo = yield* AssetRepository
    const propertyRepo = yield* AssetPropertyRepository
    const traitRepo = yield* AssetTraitRepository
    const sql = yield* SqlClient.SqlClient

    // Create command (delegates to repository)
    const create: AssetStateShape['create'] = (params) =>
      Effect.gen(function* () {
        const id = generateAssetId()

        const model = yield* assetRepo.insert(
          AssetModel.insert.make({
            id,
            bfoClass: 'material_entity',
            kind: params.kind as never,
            label: params.label as never,
            description: params.description 
              ? Option.some(params.description as never) 
              : Option.none(),
            status: params.status ?? 'available',
            siteId: params.siteId,
            sectorId: params.sectorId ? Option.some(params.sectorId) : Option.none(),
            containerId: params.containerId ? Option.some(params.containerId) : Option.none(),
            basePropertiesJson: params.baseProperties
              ? Option.some(params.baseProperties as unknown)
              : Option.none(),
            tagsJson: params.tags ? Option.some(params.tags as unknown) : Option.none(),
            version: 1,
          })
        )

        return modelToAsset(model)
      })

    // Update command (with optimistic concurrency)
    const update: AssetStateShape['update'] = (params) =>
      Effect.gen(function* () {
        const existing = yield* assetRepo.findById(params.assetId)

        if (Option.isNone(existing)) {
          return yield* Effect.fail(new AssetNotFoundError({ ... }))
        }

        const current = existing.value

        if (params.expectedVersion !== undefined && current.version !== params.expectedVersion) {
          return yield* Effect.fail(new AssetConflictError({ ... }))
        }

        const updated = yield* assetRepo.update(
          AssetModel.update.make({
            ...current,
            label: params.label ?? current.label,
            description: params.description
              ? Option.some(params.description as never)
              : current.description,
            status: params.status ?? current.status,
            tagsJson: params.tags ? Option.some(params.tags as unknown) : current.tagsJson,
            version: current.version + 1,
          })
        )

        return modelToAsset(updated)
      })

    // Property upsert (raw SQL for check + insert/update)
    const setProperty: AssetStateShape['setProperty'] = (params) =>
      Effect.gen(function* () {
        // Verify asset exists
        const existing = yield* assetRepo.findById(params.assetId)
        if (Option.isNone(existing)) {
          return yield* Effect.fail(new AssetNotFoundError({ ... }))
        }

        // Check if property exists
        const existingProps = yield* sql<{ id: number }>`
          SELECT id FROM asset_properties
          WHERE asset_id = ${params.assetId} AND key = ${params.key}
        `

        if (existingProps.length > 0) {
          // Update existing
          yield* sql`
            UPDATE asset_properties
            SET value = ${String(params.value)},
                provenance_json = ${JSON.stringify(params.provenance)},
                updated_at = CURRENT_TIMESTAMP
            WHERE asset_id = ${params.assetId} AND key = ${params.key}
          `
        } else {
          // Insert new
          yield* propertyRepo.insert(
            AssetPropertyModel.insert.make({
              assetId: params.assetId,
              key: params.key,
              value: String(params.value),
              provenanceJson: params.provenance,
            })
          )
        }
      })

    // Pagination query (raw SQL)
    const listBySite: AssetStateShape['listBySite'] = (params) =>
      Effect.gen(function* () {
        const limit = params.limit ?? 50
        const offset = params.cursor ? parseInt(params.cursor, 10) : 0

        const rows = yield* sql<AssetModel>`
          SELECT * FROM assets
          WHERE site_id = ${params.siteId}
          ORDER BY created_at DESC
          LIMIT ${limit + 1} OFFSET ${offset}
        `

        const hasNextPage = rows.length > limit
        const items = hasNextPage ? rows.slice(0, limit) : rows

        const countResult = yield* sql<{ count: number }>`
          SELECT COUNT(*) as count FROM assets WHERE site_id = ${params.siteId}
        `
        const totalCount = countResult[0]?.count ?? 0

        return {
          _tag: 'PaginatedAssets' as const,
          items: items.map(modelToSummary),
          pageInfo: {
            _tag: 'PageInfo' as const,
            nextCursor: hasNextPage ? String(offset + limit) : null,
            hasNextPage,
            totalCount,
          },
        }
      })

    // Search with dynamic WHERE clause (unsafe SQL)
    const search: AssetStateShape['search'] = (params) =>
      Effect.gen(function* () {
        const limit = params.limit ?? 50
        const offset = params.cursor ? parseInt(params.cursor, 10) : 0

        // Build WHERE clause dynamically
        const conditions: string[] = ['1=1']
        if (params.siteId) conditions.push(`site_id = '${params.siteId}'`)
        if (params.sectorId) conditions.push(`sector_id = '${params.sectorId}'`)
        if (params.kind) conditions.push(`kind = '${params.kind}'`)
        if (params.status) conditions.push(`status = '${params.status}'`)
        if (params.query) {
          const q = params.query.toLowerCase()
          conditions.push(`(LOWER(label) LIKE '%${q}%' OR LOWER(description) LIKE '%${q}%')`)
        }

        const whereClause = conditions.join(' AND ')

        const rows = yield* sql.unsafe<AssetModel>(
          `SELECT * FROM assets WHERE ${whereClause} ORDER BY created_at DESC LIMIT ${limit + 1} OFFSET ${offset}`
        )

        const hasNextPage = rows.length > limit
        const items = hasNextPage ? rows.slice(0, limit) : rows

        const countResult = yield* sql.unsafe<{ count: number }>(
          `SELECT COUNT(*) as count FROM assets WHERE ${whereClause}`
        )
        const totalCount = countResult[0]?.count ?? 0

        return {
          _tag: 'PaginatedAssets' as const,
          items: items.map(modelToSummary),
          pageInfo: {
            _tag: 'PageInfo' as const,
            nextCursor: hasNextPage ? String(offset + limit) : null,
            hasNextPage,
            totalCount,
          },
        }
      })

    return {
      create,
      update,
      move,
      setProperty,
      removeProperty,
      addTrait,
      removeTrait,
      delete: deleteAsset,
      findById,
      findSummaryById,
      exists,
      listBySite,
      listBySector,
      listByContainer,
      search,
      getProperty,
      getProperties,
      countBySite,
      countByStatus,
      countByKind,
    } satisfies AssetStateShape
  })
)
```

### 6.3 AssetStateShape Interface (Contract)

**Interface definition**:
```typescript
export interface AssetStateShape {
  // ─────────────────────────────────────────────────────────────────────────
  // Commands (8)
  // ─────────────────────────────────────────────────────────────────────────

  readonly create: (params: CreateAssetParams) => Effect.Effect<Asset, AssetValidationError>
  
  readonly update: (
    params: UpdateAssetParams
  ) => Effect.Effect<Asset, AssetNotFoundError | AssetConflictError>
  
  readonly move: (params: MoveAssetParams) => Effect.Effect<Asset, AssetNotFoundError>
  
  readonly setProperty: (params: SetPropertyParams) => Effect.Effect<void, AssetNotFoundError>
  
  readonly removeProperty: (params: RemovePropertyParams) => Effect.Effect<void, AssetNotFoundError>
  
  readonly addTrait: (params: AddTraitParams) => Effect.Effect<void, AssetNotFoundError>
  
  readonly removeTrait: (params: RemoveTraitParams) => Effect.Effect<void, AssetNotFoundError>
  
  readonly delete: (params: DeleteAssetParams) => Effect.Effect<void, AssetNotFoundError>

  // ─────────────────────────────────────────────────────────────────────────
  // Queries (11)
  // ─────────────────────────────────────────────────────────────────────────

  readonly findById: (assetId: AssetId) => Effect.Effect<Asset, AssetNotFoundError>
  
  readonly findSummaryById: (assetId: AssetId) => Effect.Effect<AssetSummary, AssetNotFoundError>
  
  readonly exists: (assetId: AssetId) => Effect.Effect<boolean>
  
  readonly listBySite: (params: ListBySiteParams) => Effect.Effect<typeof PaginatedAssets.Type>
  
  readonly listBySector: (params: ListBySectorParams) => Effect.Effect<typeof PaginatedAssets.Type>
  
  readonly listByContainer: (
    params: ListByContainerParams
  ) => Effect.Effect<typeof PaginatedAssets.Type>
  
  readonly search: (params: SearchParams) => Effect.Effect<typeof PaginatedAssets.Type>
  
  readonly getProperty: (
    params: GetPropertyParams
  ) => Effect.Effect<AssetProperty, AssetNotFoundError>
  
  readonly getProperties: (
    params: GetPropertiesParams
  ) => Effect.Effect<readonly AssetProperty[], AssetNotFoundError>
  
  readonly countBySite: (siteId: SiteId) => Effect.Effect<number>
  
  readonly countByStatus: (status: AssetStatus) => Effect.Effect<number>
  
  readonly countByKind: (kind: AssetKind) => Effect.Effect<number>
}

// Parameter type definitions (extracted for reusability)
export interface CreateAssetParams {
  readonly siteId: SiteId
  readonly kind: AssetKind
  readonly label: AssetLabel
  readonly description?: AssetDescription
  readonly status?: AssetStatus
  readonly sectorId?: SectorId
  readonly containerId?: ContainerId
  readonly baseProperties?: BaseAssetProperties
  readonly tags?: Tags
  readonly createdBy: IdentityId
}

export interface UpdateAssetParams {
  readonly assetId: AssetId
  readonly label?: AssetLabel
  readonly description?: AssetDescription
  readonly status?: AssetStatus
  readonly tags?: Tags
  readonly expectedVersion?: number
  readonly updatedBy: IdentityId
}

// ... (other param interfaces)
```

**Usage for swappable implementations**:
```typescript
// Both implementations satisfy the same shape
const inMemory: AssetStateShape = yield* AssetState // in-memory variant
const sqlBacked: AssetStateShape = yield* AssetState // SQL-backed variant (via layer)

// Consumer code doesn't know which implementation
const asset = yield* state.findById(assetId)
```

### 6.4 Repository Service Definitions

**Service wrapper pattern**:
```typescript
// AssetRepository
export class AssetRepository extends Effect.Service<AssetRepository>()(
  '@gbg/tmnl/ams/v2/AssetRepository',
  {
    effect: makeAssetRepository, // From Model.makeRepository
  }
) {}

// SiteRepository
export class SiteRepository extends Effect.Service<SiteRepository>()(
  '@gbg/tmnl/ams/v2/SiteRepository',
  {
    effect: makeSiteRepository,
  }
) {}

// AssetPropertyRepository (EAV pattern)
export class AssetPropertyRepository extends Effect.Service<AssetPropertyRepository>()(
  '@gbg/tmnl/ams/v2/AssetPropertyRepository',
  {
    effect: makeAssetPropertyRepository,
  }
) {}

// ... (other repositories)

// Merge all repositories into single layer
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

**Consumption in service**:
```typescript
export const AssetStateSQLLayer = Layer.effect(
  AssetState,
  Effect.gen(function* () {
    // DI: Yield repositories from environment
    const assetRepo = yield* AssetRepository
    const propertyRepo = yield* AssetPropertyRepository
    const traitRepo = yield* AssetTraitRepository
    const sql = yield* SqlClient.SqlClient

    // Use repositories in operations
    const create = (params: CreateAssetParams) =>
      Effect.gen(function* () {
        const model = yield* assetRepo.insert(AssetModel.insert.make({ ... }))
        return modelToAsset(model)
      })

    return { create, ... }
  })
)
```

---

## 7. Patterns & Insights for v3

### 7.1 Strengths of v2 Architecture

1. **Interface-based swappability** - `AssetStateShape` enables testing (in-memory) vs production (SQL)
2. **Effect-native DI** - Service tags + Layer composition, no manual wiring
3. **Generated repositories** - `Model.makeRepository` eliminates boilerplate CRUD
4. **Type-safe SQL** - `@effect/sql` with Schema validation
5. **Optimistic concurrency** - Version tracking in both in-memory and SQL
6. **Composite key pattern** - `${assetId}:${propertyKey}` for EAV relationships
7. **Domain entity separation** - Model (SQL) vs Asset (domain) with explicit transformations

### 7.2 Patterns to Preserve in v3

```typescript
// Pattern 1: Service → Shape → Implementation variants
interface ServiceShape { /* operations */ }
class Service extends Effect.Service<Service>()('tag', { effect: implFactory }) {}

// Pattern 2: Model.makeRepository for generic CRUD
export const makeRepo = Model.makeRepository(Model, { tableName, idColumn })
class Repo extends Effect.Service<Repo>()('tag', { effect: makeRepo }) {}

// Pattern 3: Layer composition for swappable backends
const TestLayer = ServiceLayer.pipe(Layer.provide(InMemoryDeps))
const ProdLayer = ServiceLayer.pipe(Layer.provide(SQLDeps))

// Pattern 4: Model → Domain transformation functions
const modelToDomain = (model: Model): Domain => new Domain({ ... })

// Pattern 5: Composite keys for relationships
const key = `${parentId}:${childId}` // EAV, many-to-many, etc.
```

### 7.3 Potential Improvements for v3

1. **Event sourcing integration** - v2 has EventJournalModel but not wired into services
2. **Command/Query separation** - v2 has schemas (commands/asset.ts) but not used in service layer
3. **Streaming queries** - v2 uses arrays, could use Effect.Stream for large result sets
4. **Caching layer** - No caching abstraction between in-memory and SQL
5. **Multi-tenant support** - No tenant scoping in current design
6. **Audit trail** - createdBy/updatedBy tracked in params but not persisted
7. **Soft delete tracking** - Uses status='retired' but no deletedAt timestamp
8. **Batch operations** - No bulkInsert, bulkUpdate patterns

### 7.4 Key Architectural Decisions

| Decision | Rationale | Impact on v3 |
|----------|-----------|--------------|
| Effect.Service<T>() | DI-first, testable, composable | Preserve pattern |
| Shape interface | Swappable implementations | Keep for testability |
| Model.makeRepository | Reduces boilerplate | Extend for custom queries |
| Ref<HashMap> state | Concurrent-safe in-memory | Works for testing/dev |
| Option for nullable | Type-safe null handling | Keep, aligns with Effect ecosystem |
| TaggedClass entities | Runtime validation, _tag discrimination | Keep for domain layer |
| Composite keys | EAV pattern, flexible relationships | Preserve for dynamic properties |
| Version tracking | Optimistic concurrency | Essential for distributed systems |

### 7.5 Layer Dependency Graph

```
AssetStateSQLLayer (provides AssetState)
  ↓ requires
AllRepositoriesLive (provides 7 repository services)
  ↓ requires
SqlClient.SqlClient (from @effect/sql)
  ↓ requires
SqliteLayer | PostgresLayer (DB driver layer)
```

**Test layer composition**:
```typescript
const TestLayer = AssetState.Default // In-memory, no deps

const ProdLayer = AssetStateSQLLayer.pipe(
  Layer.provide(AllRepositoriesLive),
  Layer.provide(SqliteLayer),
)
```

### 7.6 Error Handling Patterns

```typescript
// Tagged error schemas (Schema.TaggedClass)
export class AssetNotFoundError extends Schema.TaggedClass<AssetNotFoundError>()(
  'AssetNotFoundError',
  { assetId: AssetId, message: Schema.optional(Schema.String) }
) {}

// Union of errors for domain
export const AssetCommandError = Schema.Union(
  AssetNotFoundError,
  AssetValidationError,
  AssetConflictError,
  AssetPermissionError
)

// Usage in service methods
const update = (params: UpdateAssetParams): Effect<Asset, AssetNotFoundError | AssetConflictError> =>
  Effect.gen(function* () {
    const existing = yield* findById(params.assetId)
    // Explicit error construction
    if (Option.isNone(existing)) {
      return yield* Effect.fail(new AssetNotFoundError({ assetId: params.assetId }))
    }
    // ...
  })
```

**Key insights**:
- TaggedClass errors enable pattern matching (Effect.match)
- Error unions in return type (explicit in signature)
- No throwing - all errors via Effect.fail()

### 7.7 Pagination Pattern

```typescript
// Cursor-based pagination
export interface ListBySiteParams {
  readonly siteId: SiteId
  readonly limit?: number       // Default: 50
  readonly cursor?: string      // Offset as string
}

// Paginated result schema
export class PaginatedAssets extends Schema.TaggedStruct('PaginatedAssets', {
  items: Schema.Array(AssetSummary),
  pageInfo: PageInfo,
}) {}

export class PageInfo extends Schema.TaggedStruct('PageInfo', {
  nextCursor: Schema.NullOr(Schema.String),
  hasNextPage: Schema.Boolean,
  totalCount: Schema.Number,
}) {}

// Implementation (in-memory)
const limit = params.limit ?? 50
const offset = params.cursor ? parseInt(params.cursor, 10) : 0
const sliced = filtered.slice(offset, offset + limit + 1)
const hasNextPage = sliced.length > limit
const items = hasNextPage ? sliced.slice(0, limit) : sliced

return {
  _tag: 'PaginatedAssets' as const,
  items: items.map(toSummary),
  pageInfo: {
    _tag: 'PageInfo' as const,
    nextCursor: hasNextPage ? String(offset + limit) : null,
    hasNextPage,
    totalCount: filtered.length,
  },
}
```

**Pattern characteristics**:
- Cursor = stringified offset (could be timestamp, ID, etc.)
- Limit + 1 query to detect hasNextPage
- totalCount separate query (expensive for large datasets)

---

## 8. File Structure & Exports

```
src/lib/ams/v2/base/services/
├── index.ts                     # Re-exports all services
├── asset-state.ts               # AssetState (in-memory)
├── asset-state-sql.ts           # AssetStateSQLLayer (SQL-backed)
├── asset-state-shape.ts         # AssetStateShape interface + param types
└── repositories.ts              # Repository service wrappers

src/lib/ams/v2/base/repositories/
└── asset.ts                     # Model definitions + makeRepository factories

src/lib/ams/v2/base/schemas/
├── asset.ts                     # Asset, AssetSummary, AssetStatus
├── property.ts                  # AssetProperty, AssetProperties
├── trait.ts                     # TraitInstance, AssetTraits
└── location.ts                  # AssetLocation

src/lib/ams/v2/base/commands/
└── asset.ts                     # Command schemas (not used in service layer yet)

src/lib/ams/v2/base/queries/
└── asset.ts                     # Query schemas (not used in service layer yet)
```

**Export pattern**:
```typescript
// index.ts - barrel export
export * from './asset-state'
export * from './asset-state-shape'
export * from './asset-state-sql'
export * from './repositories'
```

---

## 9. Testing Approach

### 9.1 In-Memory Testing (Fast Unit Tests)

```typescript
import { Effect, Layer } from 'effect'
import { AssetState } from './asset-state'

// Test with in-memory implementation (no SQL dependency)
it.effect('creates and retrieves asset', () =>
  Effect.gen(function* () {
    const state = yield* AssetState

    const created = yield* state.create({
      siteId: 'site-01' as SiteId,
      kind: 'EQUIPMENT' as AssetKind,
      label: 'Test Asset' as AssetLabel,
      createdBy: 'user-01' as IdentityId,
    })

    const found = yield* state.findById(created.id)
    expect(found.label).toBe('Test Asset')
  }).pipe(Effect.provide(AssetState.Default))
)
```

### 9.2 SQL Testing (Integration Tests)

```typescript
import { SqliteClient } from '@effect/sql-sqlite-bun'
import { AssetStateSQLLayer } from './asset-state-sql'
import { AllRepositoriesLive } from './repositories'

const SqliteTestLayer = SqliteClient.layer({
  filename: ':memory:',
  transformQueryNames: SqlClient.defaultTransforms,
})

const TestLayer = AssetStateSQLLayer.pipe(
  Layer.provide(AllRepositoriesLive),
  Layer.provide(SqliteTestLayer),
)

it.effect('SQL-backed create and retrieve', () =>
  Effect.gen(function* () {
    const state = yield* AssetState // Same interface, SQL-backed

    // Migrate schema
    const sql = yield* SqlClient.SqlClient
    yield* sql`CREATE TABLE assets (...)`

    const created = yield* state.create({ ... })
    const found = yield* state.findById(created.id)
    expect(found.label).toBe('Test Asset')
  }).pipe(Effect.provide(TestLayer))
)
```

**Key insight**: Same test code works for both implementations (interface-based)

---

## 10. Migration Path from v2 to v3

### 10.1 What to Keep

- ✅ Effect.Service<T>() pattern for DI
- ✅ Shape interfaces for swappable implementations
- ✅ Model.makeRepository for CRUD generation
- ✅ Layer composition for dependency injection
- ✅ TaggedClass for domain entities
- ✅ Option for nullable fields
- ✅ Composite key pattern for relationships
- ✅ Version tracking for optimistic concurrency

### 10.2 What to Enhance

- 🔄 Wire command/query schemas into service layer (CQRS)
- 🔄 Add event sourcing (EventJournalRepository exists but unused)
- 🔄 Replace arrays with Effect.Stream for large queries
- 🔄 Add caching layer abstraction
- 🔄 Persist audit fields (createdBy, updatedBy, deletedAt)
- 🔄 Add batch operation support
- 🔄 Multi-tenant scoping

### 10.3 Refactoring Strategy

**Phase 1**: Extract service shape to separate package
```typescript
// @gbg/ams-core
export interface AssetServiceShape { ... }
export interface SiteServiceShape { ... }
```

**Phase 2**: Implement variants as plugins
```typescript
// @gbg/ams-memory
export const AssetStateMemory: Layer<AssetServiceShape>

// @gbg/ams-sql
export const AssetStateSQL: Layer<AssetServiceShape, SqlClient>

// @gbg/ams-event-sourced
export const AssetStateEventSourced: Layer<AssetServiceShape, EventStore>
```

**Phase 3**: Add caching middleware
```typescript
export const AssetStateCached = (baseLayer: Layer<AssetServiceShape>) =>
  Layer.effect(AssetServiceShape, Effect.gen(function* () {
    const base = yield* AssetServiceShape
    const cache = yield* CacheService
    
    return {
      findById: (id) => cache.getOrElse(id, () => base.findById(id)),
      // ...
    }
  }))
```

---

## Summary Table

| Aspect | Pattern | Location |
|--------|---------|----------|
| Service definition | `Effect.Service<T>()` | `asset-state.ts:53` |
| Service shape | Interface with ops | `asset-state-shape.ts:162` |
| In-memory state | `Ref<HashMap<K, V>>` | `asset-state.ts:56-58` |
| SQL state | Layer with repo deps | `asset-state-sql.ts:171` |
| Repository service | Wrap `makeRepository` | `repositories.ts:42` |
| Model definition | `Model.Class<T>()` | `repositories/asset.ts:99` |
| Domain entity | `Schema.TaggedClass` | `schemas/asset.ts:75` |
| Error handling | TaggedClass errors | `commands/asset.ts:35` |
| Pagination | Cursor + limit + 1 | `asset-state.ts:400` |
| Optimistic concurrency | Version field + check | `asset-state.ts:138` |
| Composite keys | String template | `asset-state.ts:228` |
| Model → Domain | Transform function | `asset-state-sql.ts:72` |

**Lines of code**:
- AssetState (in-memory): ~659 lines
- AssetStateSQLLayer: ~698 lines
- AssetStateShape: ~279 lines
- Repositories: ~155 lines
- Total services layer: ~1,791 lines

**Operations count**:
- Commands: 8 (create, update, move, setProperty, removeProperty, addTrait, removeTrait, delete)
- Queries: 11 (findById, findSummaryById, exists, listBySite, listBySector, listByContainer, search, getProperty, getProperties, countBySite, countByStatus, countByKind)
- Total: 19 operations per service

---

## References

- **Source files**:
  - `src/lib/ams/v2/base/services/asset-state.ts` (in-memory)
  - `src/lib/ams/v2/base/services/asset-state-sql.ts` (SQL-backed)
  - `src/lib/ams/v2/base/services/asset-state-shape.ts` (interface)
  - `src/lib/ams/v2/base/services/repositories.ts` (DI wrappers)
  - `src/lib/ams/v2/base/repositories/asset.ts` (Model definitions)

- **Effect documentation**:
  - Effect.Service: https://effect.website/docs/context-management/services
  - Model (SQL): https://effect.website/docs/sql/model
  - Layer: https://effect.website/docs/context-management/layers

- **Related v2 modules**:
  - Commands: `src/lib/ams/v2/base/commands/asset.ts`
  - Queries: `src/lib/ams/v2/base/queries/asset.ts`
  - Schemas: `src/lib/ams/v2/base/schemas/`

---

*End of research document. This exhaustive analysis captures all patterns, code examples, and architectural decisions from AMS v2 services layer for v3 design reference.*
