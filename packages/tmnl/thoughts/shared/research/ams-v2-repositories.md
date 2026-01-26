# AMS v2 Repository Pattern Research

**Date:** 2026-01-25  
**Author:** Val (Scout Agent)  
**Purpose:** Exhaustive comparison of AMS v2 and IIoT repository patterns to inform v3 architecture

---

## Executive Summary

Two distinct repository patterns exist in the codebase:

| Aspect | AMS v2 | IIoT |
|--------|--------|------|
| **Core Abstraction** | `Model.makeRepository()` | Manual `Context.Tag` + `Layer.effect` |
| **Database** | SQLite (in-memory tests) | PostgreSQL (production) |
| **DI Pattern** | `Effect.Service<>()` wrapper | Direct `Context.Tag` extension |
| **SQL Composition** | Auto-generated CRUD | Hand-written queries |
| **Decode Strategy** | Model auto-transforms | Explicit decode utilities |
| **Naming Convention** | camelCase ↔ snake_case transform | Manual AS aliasing in SQL |
| **Domain/Persistence Split** | Model.Class only | Schema → Model → Repo (3-layer) |

**Key Insight:** AMS v2 optimizes for DX/safety via `@effect/sql Model` abstractions. IIoT optimizes for control/PostgreSQL-specific features via manual query composition.

---

## 1. AMS v2 Repository Pattern

### 1.1 Architecture Overview

```
Domain Schema          Model.Class                  Effect.Service
(identifiers.ts)  →   (asset.ts)              →    (repositories.ts)
                       ↓
                  makeRepository()
                       ↓
                  CRUD operations
```

### 1.2 Core Components

#### Model Definition (`src/lib/ams/v2/base/repositories/asset.ts`)

```typescript
export class AssetModel extends Model.Class<AssetModel>('AssetModel')({
  /** Primary key - database generated */
  id: Model.GeneratedByApp(AssetId),

  /** Asset classification */
  kind: AssetKind,
  label: AssetLabel,

  /** Optional description */
  description: Model.FieldOption(AssetDescription),

  /** Current status */
  status: AssetStatus,

  /** Foreign keys */
  siteId: SiteId,
  sectorId: Model.FieldOption(SectorId),
  containerId: Model.FieldOption(ContainerId),

  /** JSON storage */
  basePropertiesJson: NullableJsonFromString,
  tagsJson: NullableJsonFromString,

  /** Optimistic concurrency */
  version: Schema.Number.pipe(Schema.int()),

  /** Timestamps - auto-managed */
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}
```

**Key Features:**
1. **Model.Class** - Single source of truth for schema
2. **Model.GeneratedByApp** - ID provided by client (vs DB auto-increment)
3. **Model.FieldOption** - Automatic NULL ↔ Option.none() transforms
4. **Model.DateTimeInsert/Update** - Timestamp auto-management
5. **Variants auto-generated:**
   - `AssetModel` - Full select schema
   - `AssetModel.insert` - Without generated fields
   - `AssetModel.update` - With id for WHERE clause
   - `AssetModel.json` - JSON API schema

#### Repository Factory

```typescript
export const makeAssetRepository = Model.makeRepository(AssetModel, {
  tableName: 'assets',
  idColumn: 'id',
  spanPrefix: 'AssetRepository',
});
```

**Auto-generated operations:**
- `findById(id)` - SELECT with WHERE id = ?
- `insert(data)` - INSERT RETURNING *
- `update(data)` - UPDATE with optimistic lock check
- `delete(id)` - DELETE CASCADE

**Span tracing:** Automatic OpenTelemetry spans for observability.

#### Service Wrapper (`src/lib/ams/v2/base/services/repositories.ts`)

```typescript
export class AssetRepository extends Effect.Service<AssetRepository>()(
  '@gbg/tmnl/ams/v2/AssetRepository',
  {
    effect: makeAssetRepository,
  }
) {}

// Consumer usage:
const repo = yield* AssetRepository
const asset = yield* repo.findById(assetId)
```

**DI Benefits:**
- `.Default` layer auto-requires `SqlClient.SqlClient`
- Type-safe service injection
- Layer composition via `Layer.mergeAll()`

### 1.3 SQLite Layer Composition (`sqlite-layer.ts`)

```typescript
// Name transformers (camelCase ↔ snake_case)
const snakeToCamel = (str: string): string =>
  str.replace(/_([a-z])/g, (_, char) => char.toUpperCase())

const camelToSnake = (str: string): string =>
  str.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`)

// In-memory layer with transforms
export const SqliteMemoryLayer = SqliteClient.layer({
  filename: ':memory:',
  transformResultNames: snakeToCamel,  // DB → Model
  transformQueryNames: camelToSnake,   // Model → DB
})

// Test layer with migrations
export const SqliteTestLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* createTables(sql)
  })
).pipe(Layer.provideMerge(SqliteMemoryLayer))
```

**Key Features:**
1. **Automatic name transforms** - TS uses camelCase, SQL uses snake_case
2. **In-memory testing** - Fast, isolated tests
3. **Migration as Effect** - Schema versioning built-in
4. **File-based variant** - For debugging (`SqliteFileLayer`)

#### Table Migrations

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
```

**Indices:**
- Foreign keys: `site_id`, `sector_id`, `container_id`
- Query optimization: `status`, `kind`
- EAV lookups: `asset_properties(asset_id)`, `asset_traits(asset_id)`

### 1.4 Schema Helpers

#### NullableJsonFromString

```typescript
const NullableJsonFromString = Schema.transform(
  Schema.NullOr(Schema.String),           // DB: null | string
  Schema.OptionFromSelf(Schema.Unknown),  // TS: Option<unknown>
  {
    strict: true,
    decode: (encoded) =>
      encoded === null ? Option.none() : Option.some(JSON.parse(encoded)),
    encode: (decoded) =>
      Option.isNone(decoded) ? null : JSON.stringify(decoded.value),
  }
)
```

**Why not Model.JsonFromString?**
- `JsonFromString` uses `Schema.parseJson` which stringifies `null → "null"` (string)
- SQLite expects actual `null`, not the string `"null"`
- `OptionFromSelf` avoids extra `OptionEncoded` layer (`{ _tag, value }`)

#### SqliteBoolean

```typescript
const SqliteBoolean = Schema.transform(
  Schema.Union(Schema.Literal(0), Schema.Literal(1), Schema.Boolean),
  Schema.Boolean,
  {
    strict: true,
    decode: (encoded) => encoded === 1 || encoded === true,
    encode: (decoded) => (decoded ? 1 : 0),
  }
)
```

**Rationale:** SQLite stores booleans as `INTEGER 0/1`, not SQL `BOOLEAN`.

### 1.5 Testing Pattern

```typescript
import { it } from '@effect/vitest';
import { SqliteTestLayer } from '../sqlite-layer';

it.effect('creates asset', () =>
  Effect.gen(function* () {
    const repo = yield* makeAssetRepository

    const asset = yield* repo.insert(AssetModel.insert.make({
      id: 'asset-001' as AssetId,
      kind: 'EQUIPMENT',
      label: 'Forklift #1',
      status: 'available',
      siteId: 'site-01',
      bfoClass: 'material_entity',
      version: 1,
      // Optional fields
      description: Option.none(),
      sectorId: Option.none(),
      containerId: Option.none(),
      basePropertiesJson: Option.none(),
      tagsJson: Option.none(),
    }))

    expect(asset.id).toBe('asset-001')
    expect(asset.createdAt).toBeDefined() // Auto-set
  }).pipe(Effect.provide(SqliteTestLayer))
)
```

**Key Points:**
- `it.effect` - Vitest integration for Effect tests
- `SqliteTestLayer` - Provides in-memory DB + migrations
- `AssetModel.insert.make()` - Type-safe insert builder
- Auto-generated `createdAt/updatedAt` fields

---

## 2. IIoT Repository Pattern

### 2.1 Architecture Overview

```
Domain Schema       Model.Class           Repository Tag      Repository Impl
(schemas/alarms)  → (models/AlarmModel) → (AlarmRepo tag)  → (AlarmRepoLive)
                    ↓
               Model transforms
               (PG-specific)
                    ↓
               Manual SQL queries
                    ↓
               Decode utilities
```

**3-Layer Separation:**
1. **Domain Schema** - Pure business types (`schemas/alarms.ts`)
2. **Persistence Model** - DB transforms (`models/alarms/AlarmModel.ts`)
3. **Repository** - Query implementation (`repos/AlarmRepo.ts`)

### 2.2 Core Components

#### Domain Schema (`src/lib/iiot/schemas/alarms.ts`)

```typescript
/** Alarm severity levels */
export const AlarmSeverity = Schema.Literal('info', 'warning', 'critical')

/** Alarm type classifier */
export const AlarmType = Schema.Literal(
  'temperature_high',
  'temperature_low',
  'vibration_excessive',
  'speed_deviation',
  'sensor_offline'
)

/** Alarm domain entity */
export class Alarm extends Schema.TaggedClass<Alarm>()('Alarm', {
  id: AlarmId,
  deviceId: DeviceId,
  alarmType: AlarmType,
  severity: AlarmSeverity,
  message: Schema.optional(Schema.String),
  triggeredAt: DateTimeUtc,
  acknowledgedAt: Schema.optional(DateTimeUtc),
  clearedAt: Schema.optional(DateTimeUtc),
  acknowledgedBy: Schema.optional(Schema.String),
  metadata: Schema.optional(MetadataRecord),
}) {}
```

**Design Philosophy:**
- **TaggedClass** - Discriminated unions for events/ADTs
- **Domain-centric** - Business logic types, not DB types
- **Explicit optional** - `Schema.optional()` for nullable fields

#### Persistence Model (`src/lib/iiot/models/alarms/AlarmModel.ts`)

```typescript
export class AlarmModel extends Model.Class<AlarmModel>('AlarmModel')({
  // Derived from Alarm.fields - direct reuse
  deviceId: Alarm.fields.deviceId,
  alarmType: Alarm.fields.alarmType,
  severity: Alarm.fields.severity,

  // Derived with Model-specific transforms
  id: Model.Generated(AlarmId),                         // DB auto-generates
  message: Model.FieldOption(Schema.String),            // optional → FieldOption
  triggeredAt: CreatedAt,                               // DateTimeUtc → pg Date
  acknowledgedAt: Model.FieldOption(Schema.DateFromSelf), // pg native Date
  clearedAt: Model.FieldOption(Schema.DateFromSelf),
  acknowledgedBy: Model.FieldOption(Schema.String),
  metadata: OptionalMetadata,                           // optional Record → FieldOption JsonFromString
}) {}
```

**Key Transforms:**
1. **Model.Generated** - DB auto-increment (vs `GeneratedByApp`)
2. **Model.FieldOption** - `null` ↔ `Option.none()` bridge
3. **CreatedAt** - `Model.DateTimeInsertFromDate` (PostgreSQL `Date` objects)
4. **OptionalMetadata** - JSONB as parsed objects (not strings!)

#### Repository Interface

```typescript
export interface AlarmRepository {
  readonly findById: (id: AlarmId) => Effect.Effect<Option.Option<AlarmModel>, AlarmRepoError>
  readonly findByDevice: (deviceId: DeviceId) => Effect.Effect<readonly AlarmModel[], AlarmRepoError>
  readonly findOpen: () => Effect.Effect<readonly AlarmModel[], AlarmRepoError>
  readonly findAll: () => Effect.Effect<readonly AlarmModel[], AlarmRepoError>
  readonly query: (params: {
    deviceId?: DeviceId
    severity?: Schema.Schema.Type<typeof AlarmSeverity>
    onlyOpen?: boolean
    since?: Date
    limit?: number
  }) => Effect.Effect<readonly AlarmModel[], AlarmRepoError>
  readonly insert: (alarm: typeof AlarmModel.insert.Type) => Effect.Effect<AlarmModel, AlarmRepoError>
  readonly update: (alarm: typeof AlarmModel.update.Type) => Effect.Effect<AlarmModel, AlarmRepoError>
  readonly acknowledge: (id: AlarmId, acknowledgedBy: string) => Effect.Effect<AlarmModel, AlarmRepoError>
  readonly clear: (id: AlarmId) => Effect.Effect<AlarmModel, AlarmRepoError>
  readonly delete: (id: AlarmId) => Effect.Effect<void, SqlError.SqlError>
}
```

**Design Patterns:**
1. **Explicit interface** - All operations declared upfront
2. **Domain operations** - `acknowledge()`, `clear()` not generic CRUD
3. **Query builder pattern** - `query()` with structured params
4. **Option returns** - `findById` returns `Option<T>` for no-results case

#### Repository Tag

```typescript
export class AlarmRepo extends Context.Tag('iiot/AlarmRepo')<
  AlarmRepo,
  AlarmRepository
>() {}
```

**Usage:**
```typescript
const repo = yield* AlarmRepo
const alarm = yield* repo.findById(alarmId)
```

### 2.3 Repository Implementation

#### Manual SQL Queries

```typescript
export const AlarmRepoLive = Layer.effect(
  AlarmRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findById = (id: AlarmId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT
            id,
            device_id AS "deviceId",
            alarm_type AS "alarmType",
            severity,
            message,
            triggered_at AS "triggeredAt",
            acknowledged_at AS "acknowledgedAt",
            cleared_at AS "clearedAt",
            acknowledged_by AS "acknowledgedBy",
            metadata
          FROM iiot.alarms
          WHERE id = ${id}
          LIMIT 1
        `
        return yield* decodeOptional(AlarmModel)(rows)
      })

    // ... other operations ...

    return {
      findById,
      findByDevice,
      findOpen,
      findAll,
      query,
      insert,
      update,
      acknowledge,
      clear,
      delete: del,
    } satisfies AlarmRepository
  })
)
```

**Key Features:**
1. **Manual AS aliasing** - `device_id AS "deviceId"` (no auto-transform)
2. **PostgreSQL-specific** - `iiot.` schema prefix, `NOW()`, native JSONB
3. **Explicit decode** - Call `decodeOptional()/decodeRows()` on results
4. **Domain operations** - Custom logic beyond CRUD

#### Insert with Option Handling

```typescript
const insert = (alarm: typeof AlarmModel.insert.Type) =>
  Effect.gen(function* () {
    // Convert Option → null/value for SQL
    const messageValue = Option.getOrNull(alarm.message)
    const metadataValue = Option.getOrNull(alarm.metadata)

    const rows = yield* sql`
      INSERT INTO iiot.alarms (device_id, alarm_type, severity, message, metadata)
      VALUES (
        ${alarm.deviceId},
        ${alarm.alarmType},
        ${alarm.severity},
        ${messageValue},
        ${metadataValue}
      )
      RETURNING
        id,
        device_id AS "deviceId",
        alarm_type AS "alarmType",
        severity,
        message,
        triggered_at AS "triggeredAt",
        acknowledged_at AS "acknowledgedAt",
        cleared_at AS "clearedAt",
        acknowledged_by AS "acknowledgedBy",
        metadata
    `
    return yield* decodeFirst(AlarmModel)(rows)
  })
```

**NOTE:** PostgreSQL's `pg` driver returns JSONB as **parsed objects**, not strings. No `JSON.stringify()` needed.

#### Update with Partial Fields

```typescript
const update = (alarm: typeof AlarmModel.update.Type) =>
  Effect.gen(function* () {
    // sql.update() handles partial updates:
    // - undefined fields → skipped (not in SET)
    // - Option.none() → NULL, Option.some(v) → v
    const changes = prepareUpdate(alarm)

    const rows = yield* sql`
      UPDATE iiot.alarms
      SET ${sql.update(changes, ['id'])}
      WHERE id = ${alarm.id}
      RETURNING
        id,
        device_id AS "deviceId",
        -- ... full column list ...
    `
    return yield* decodeFirst(AlarmModel)(rows)
  })
```

#### Domain Operation: Acknowledge

```typescript
const acknowledge = (id: AlarmId, acknowledgedBy: string) =>
  Effect.gen(function* () {
    // Try to update - only affects rows not yet acknowledged
    const rows = yield* sql`
      UPDATE iiot.alarms
      SET
        acknowledged_at = NOW(),
        acknowledged_by = ${acknowledgedBy}
      WHERE id = ${id} AND acknowledged_at IS NULL
      RETURNING
        id,
        device_id AS "deviceId",
        -- ... full column list ...
    `

    // Idempotent: if already acknowledged, return existing
    if (rows.length > 0) {
      return yield* decodeFirst(AlarmModel)(rows)
    }

    const existing = yield* findById(id)
    return yield* Option.match(existing, {
      onNone: () => Effect.fail(new SqlError.SqlError({ message: `Alarm not found: ${id}` })),
      onSome: Effect.succeed,
    })
  })
```

**Design Pattern:** Idempotent operations with fallback to existing state.

### 2.4 Decode Utilities (`src/lib/iiot/repos/_decode.ts`)

#### Generic Decode Functions

```typescript
/**
 * Decode a single row through a Model schema.
 */
export const decodeRow =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (row: unknown): Effect.Effect<A, ParseResult.ParseError, R> =>
    Schema.decodeUnknown(schema)(row)

/**
 * Decode multiple rows through a Model schema.
 */
export const decodeRows =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<readonly A[], ParseResult.ParseError, R> =>
    Schema.decodeUnknown(Schema.Array(schema))(rows)

/**
 * Decode a single row, returning Option.none() if no rows.
 */
export const decodeOptional =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<Option.Option<A>, ParseResult.ParseError, R> =>
    rows.length === 0
      ? Effect.succeed(Option.none())
      : Schema.decodeUnknown(schema)(rows[0]).pipe(Effect.map(Option.some))

/**
 * Decode first row or fail with custom error.
 */
export const decodeFirst =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<A, ParseResult.ParseError, R> =>
    Schema.decodeUnknown(schema)(rows[0])
```

**Why manual decode?**
- PostgreSQL doesn't auto-transform column names (no `transformResultNames`)
- Manual AS aliasing gives explicit control
- Decode utilities enforce Model schema validation on all results

#### Update Helper

```typescript
/**
 * Transform an update object for use with sql.update().
 *
 * Converts Option fields to their primitive form:
 * - undefined → undefined (sql.update skips these)
 * - Option.none() → null (sets DB field to NULL)
 * - Option.some(v) → v (sets DB field to value)
 */
export const prepareUpdate = <T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue  // Skip undefined - sql.update omits field
    }

    if (Option.isOption(value)) {
      result[key] = Option.getOrNull(value)  // none → null, some → value
    } else {
      result[key] = value
    }
  }

  return result
}
```

**Usage with `sql.update()`:**
```typescript
const changes = prepareUpdate({
  id: 'foo',
  name: 'New Name',           // string → string
  model: Option.none(),       // Option.none() → null
  description: Option.some('x'), // Option.some('x') → 'x'
  // location: undefined      // omitted → sql.update skips
})

sql`UPDATE t SET ${sql.update(changes, ['id'])} WHERE id = ${id}`
```

### 2.5 Common Transforms (`src/lib/iiot/models/_common.ts`)

```typescript
/**
 * Optional nullable metadata field for JSONB columns.
 * NOTE: pg driver returns JSONB as parsed objects, not strings.
 * So we use the schema directly, not JsonFromString.
 */
export const OptionalMetadata = Model.FieldOption(MetadataRecord)

/**
 * DateTime that's set on insert (created_at pattern).
 * Uses Model.DateTimeInsertFromDate for pg driver Date objects.
 */
export const CreatedAt = Model.DateTimeInsertFromDate

/**
 * DateTime that's updated on each modification (updated_at pattern).
 * Uses Model.DateTimeUpdateFromDate for pg driver Date objects.
 */
export const UpdatedAt = Model.DateTimeUpdateFromDate
```

**Key Insight:** PostgreSQL's `pg` driver returns:
- JSONB columns as **parsed JS objects** (not JSON strings)
- TIMESTAMP columns as **native Date objects** (not ISO strings)

Hence:
- Use `Model.FieldOption(MetadataRecord)` directly (no `JsonFromString`)
- Use `Model.DateTimeInsertFromDate` (not `Model.DateTimeInsert` which expects strings)

---

## 3. Gap Analysis: What AMS v2 is Missing

### 3.1 Domain/Persistence Separation

**IIoT has:** 3-layer architecture
```
schemas/alarms.ts       → Domain types (business logic)
models/alarms/          → Persistence models (DB transforms)
repos/AlarmRepo.ts      → Repository (query implementation)
```

**AMS v2 has:** Single-layer Model.Class
```
repositories/asset.ts   → Model.Class (domain + persistence merged)
```

**Impact:** AMS v2 can't cleanly separate domain events from persistence schema.

**Example:** IIoT can define `Alarm` (domain) separately from `AlarmModel` (persistence), enabling:
- Domain events using `Alarm` type
- EventLog serialization of domain types
- Persistence-agnostic business logic

### 3.2 Domain-Specific Operations

**IIoT has:** Custom repository methods
```typescript
interface AlarmRepository {
  readonly acknowledge: (id, acknowledgedBy) => Effect<AlarmModel>
  readonly clear: (id) => Effect<AlarmModel>
  readonly findOpen: () => Effect<readonly AlarmModel[]>
  readonly query: (params: {
    deviceId?: DeviceId
    severity?: AlarmSeverity
    onlyOpen?: boolean
    since?: Date
    limit?: number
  }) => Effect<readonly AlarmModel[]>
}
```

**AMS v2 has:** Generic CRUD only
```typescript
// makeRepository auto-generates:
findById, insert, update, delete
```

**Impact:** AMS v2 must layer domain operations on top of generic CRUD, leading to:
- Business logic in services (not repositories)
- Repeated query patterns
- Less semantic API

**Example:** Asset check-out/check-in operations would live in `AssetService`, not `AssetRepository`.

### 3.3 Query Builder Pattern

**IIoT has:** Structured query parameters
```typescript
const alarms = yield* alarmRepo.query({
  deviceId: 'DEV-001',
  severity: 'critical',
  onlyOpen: true,
  since: new Date('2026-01-01'),
  limit: 100,
})
```

**AMS v2 has:** Raw SQL or custom extensions
```typescript
// Must write custom queries or extend makeRepository return value
const assets = yield* sql`
  SELECT * FROM assets
  WHERE site_id = ${siteId}
    AND status = ${status}
    AND created_at >= ${since}
`
```

**Impact:** No standardized query API for filtering/pagination.

### 3.4 Explicit Decode Validation

**IIoT has:** Explicit decode after every query
```typescript
const rows = yield* sql`SELECT ...`
return yield* decodeRows(AlarmModel)(rows)
```

**AMS v2 has:** Auto-decode in `makeRepository`
```typescript
// makeRepository handles decode internally
const asset = yield* repo.findById(id)
```

**Impact:** AMS v2 has less control over decode failures. IIoT can:
- Add custom error context
- Fallback to partial decode
- Log decode failures separately from SQL errors

### 3.5 PostgreSQL-Specific Features

**IIoT uses:**
- Schema prefixes (`iiot.alarms`)
- Native JSONB (parsed objects, not strings)
- `NOW()` function
- `Date` objects (not ISO strings)
- Composite types (future)
- Full-text search (future)

**AMS v2 uses:**
- SQLite compatibility layer
- JSON as TEXT with stringify/parse
- ISO datetime strings
- Limited to SQLite feature set

**Impact:** AMS v2 can't leverage PostgreSQL power without forking the pattern.

### 3.6 Idempotent Operations

**IIoT has:** Built-in idempotency patterns
```typescript
const acknowledge = (id, acknowledgedBy) =>
  Effect.gen(function* () {
    // Try to update (WHERE acknowledged_at IS NULL)
    const rows = yield* sql`UPDATE ... WHERE id = ${id} AND acknowledged_at IS NULL`

    // Fallback to existing if already acknowledged
    if (rows.length === 0) {
      const existing = yield* findById(id)
      return yield* Option.match(existing, {
        onNone: () => Effect.fail(...),
        onSome: Effect.succeed,
      })
    }

    return yield* decodeFirst(AlarmModel)(rows)
  })
```

**AMS v2 has:** No standard idempotency pattern
```typescript
// Must implement in application layer
```

**Impact:** Duplicate detection and retry logic scattered across codebase.

### 3.7 Repository Interface as Contract

**IIoT has:** Explicit interface
```typescript
export interface AlarmRepository {
  readonly findById: (id: AlarmId) => Effect.Effect<Option.Option<AlarmModel>, AlarmRepoError>
  readonly insert: (alarm: typeof AlarmModel.insert.Type) => Effect.Effect<AlarmModel, AlarmRepoError>
  // ...
}

export const AlarmRepoLive = Layer.effect(AlarmRepo, Effect.gen(function* () {
  return {
    findById,
    insert,
    // ...
  } satisfies AlarmRepository
}))
```

**AMS v2 has:** Inferred interface from `makeRepository`
```typescript
// No explicit interface - type inferred from return value
export const makeAssetRepository = Model.makeRepository(AssetModel, { ... })
```

**Impact:**
- AMS v2 harder to mock/test (no interface to implement)
- IIoT can provide alternate implementations (in-memory, mock, etc.)
- IIoT interface documents repository contract

---

## 4. Gap Analysis: What IIoT is Missing

### 4.1 Automatic CRUD Operations

**AMS v2 has:** `makeRepository()` auto-generates
- `findById(id)`
- `insert(data)`
- `update(data)`
- `delete(id)`
- Optimistic locking
- Span tracing

**IIoT has:** Manual implementation for every entity
```typescript
// Must write findById, insert, update, delete for EVERY repo
// 200+ lines of boilerplate per repository
```

**Impact:** Maintenance burden, inconsistent patterns across repos.

**Example:** 9 IIoT repos × 200 lines = ~1800 lines of CRUD boilerplate.

### 4.2 Automatic Name Transforms

**AMS v2 has:** `transformResultNames` / `transformQueryNames`
```typescript
export const SqliteMemoryLayer = SqliteClient.layer({
  filename: ':memory:',
  transformResultNames: snakeToCamel,  // DB → Model
  transformQueryNames: camelToSnake,   // Model → DB
})

// TypeScript code uses camelCase
const asset = yield* repo.insert({
  siteId: 'site-01',         // Auto-converted to site_id
  containerId: 'c-01',       // Auto-converted to container_id
})
```

**IIoT has:** Manual AS aliasing in every query
```typescript
const rows = yield* sql`
  SELECT
    device_id AS "deviceId",
    alarm_type AS "alarmType",
    triggered_at AS "triggeredAt",
    acknowledged_at AS "acknowledgedAt",
    cleared_at AS "clearedAt",
    acknowledged_by AS "acknowledgedBy"
  FROM iiot.alarms
`
```

**Impact:**
- ~10 AS aliases per query
- Easy to miss a column → runtime decode error
- No compile-time validation of column names

### 4.3 Model Variants

**AMS v2 has:** Auto-generated variants
```typescript
export class AssetModel extends Model.Class<AssetModel>('AssetModel')({ ... }) {}

// Auto-available:
AssetModel              // Full select schema
AssetModel.insert       // Without generated fields (id, createdAt, updatedAt)
AssetModel.update       // With id for WHERE clause
AssetModel.json         // JSON API schema
AssetModel.fields       // Field accessor
```

**IIoT has:** Manual type extraction
```typescript
typeof AlarmModel.insert.Type
typeof AlarmModel.update.Type
```

**Impact:**
- Less discoverable (need to know the `.insert.Type` pattern)
- No `.json` variant for API serialization

### 4.4 Integrated Testing Layer

**AMS v2 has:** `SqliteTestLayer` with auto-migrations
```typescript
it.effect('creates asset', () =>
  Effect.gen(function* () {
    const repo = yield* makeAssetRepository
    // Test logic...
  }).pipe(Effect.provide(SqliteTestLayer))
)
```

**IIoT has:** Manual test setup for PostgreSQL
```typescript
// Must:
// 1. Run PostgreSQL locally or in Docker
// 2. Run migrations manually
// 3. Clean up test data after each test
// 4. Handle connection pooling
```

**Impact:** Slower test feedback, environment dependency, CI complexity.

### 4.5 Optimistic Concurrency

**AMS v2 has:** Built-in version field
```typescript
export class AssetModel extends Model.Class<AssetModel>('AssetModel')({
  version: Schema.Number.pipe(Schema.int()),
  // makeRepository auto-checks version on update
})
```

**IIoT has:** Manual version checks
```typescript
// Must implement optimistic locking manually if needed
```

**Impact:** Race conditions in concurrent updates.

### 4.6 Span Tracing

**AMS v2 has:** Auto-instrumented spans
```typescript
export const makeAssetRepository = Model.makeRepository(AssetModel, {
  tableName: 'assets',
  idColumn: 'id',
  spanPrefix: 'AssetRepository',  // Auto-creates spans: AssetRepository.findById, etc.
})
```

**IIoT has:** Manual instrumentation required
```typescript
// Must wrap operations in Effect.withSpan() manually
```

**Impact:** Less observability out of the box.

### 4.7 Type-Safe Field Access

**AMS v2 has:** `Model.fields` accessor
```typescript
const kindField = AssetModel.fields.kind
const labelField = AssetModel.fields.label

// Can be used for dynamic queries, form generation, etc.
```

**IIoT has:** No field accessor
```typescript
// Must reference field names as strings
```

**Impact:** Harder to build dynamic UIs or query builders.

---

## 5. Code Examples: Side-by-Side Comparison

### 5.1 Model Definition

#### AMS v2: Single-Layer Model

```typescript
// src/lib/ams/v2/base/repositories/asset.ts
export class AssetModel extends Model.Class<AssetModel>('AssetModel')({
  id: Model.GeneratedByApp(AssetId),
  kind: AssetKind,
  label: AssetLabel,
  description: Model.FieldOption(AssetDescription),
  status: AssetStatus,
  siteId: SiteId,
  sectorId: Model.FieldOption(SectorId),
  containerId: Model.FieldOption(ContainerId),
  basePropertiesJson: NullableJsonFromString,
  tagsJson: NullableJsonFromString,
  version: Schema.Number.pipe(Schema.int()),
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}
```

#### IIoT: 3-Layer (Domain → Model → Repo)

```typescript
// src/lib/iiot/schemas/alarms.ts (Domain)
export class Alarm extends Schema.TaggedClass<Alarm>()('Alarm', {
  id: AlarmId,
  deviceId: DeviceId,
  alarmType: AlarmType,
  severity: AlarmSeverity,
  message: Schema.optional(Schema.String),
  triggeredAt: DateTimeUtc,
  acknowledgedAt: Schema.optional(DateTimeUtc),
  clearedAt: Schema.optional(DateTimeUtc),
  acknowledgedBy: Schema.optional(Schema.String),
  metadata: Schema.optional(MetadataRecord),
}) {}

// src/lib/iiot/models/alarms/AlarmModel.ts (Persistence)
export class AlarmModel extends Model.Class<AlarmModel>('AlarmModel')({
  deviceId: Alarm.fields.deviceId,
  alarmType: Alarm.fields.alarmType,
  severity: Alarm.fields.severity,
  id: Model.Generated(AlarmId),
  message: Model.FieldOption(Schema.String),
  triggeredAt: CreatedAt,
  acknowledgedAt: Model.FieldOption(Schema.DateFromSelf),
  clearedAt: Model.FieldOption(Schema.DateFromSelf),
  acknowledgedBy: Model.FieldOption(Schema.String),
  metadata: OptionalMetadata,
}) {}
```

**Key Difference:** IIoT separates domain (`Alarm`) from persistence (`AlarmModel`), enabling domain events and business logic to use `Alarm` type without DB concerns.

### 5.2 Repository Creation

#### AMS v2: Factory Function

```typescript
// src/lib/ams/v2/base/repositories/asset.ts
export const makeAssetRepository = Model.makeRepository(AssetModel, {
  tableName: 'assets',
  idColumn: 'id',
  spanPrefix: 'AssetRepository',
});

// src/lib/ams/v2/base/services/repositories.ts
export class AssetRepository extends Effect.Service<AssetRepository>()(
  '@gbg/tmnl/ams/v2/AssetRepository',
  {
    effect: makeAssetRepository,
  }
) {}
```

#### IIoT: Manual Context Tag + Layer

```typescript
// src/lib/iiot/repos/AlarmRepo.ts
export interface AlarmRepository {
  readonly findById: (id: AlarmId) => Effect.Effect<Option.Option<AlarmModel>, AlarmRepoError>
  readonly insert: (alarm: typeof AlarmModel.insert.Type) => Effect.Effect<AlarmModel, AlarmRepoError>
  // ... more operations
}

export class AlarmRepo extends Context.Tag('iiot/AlarmRepo')<
  AlarmRepo,
  AlarmRepository
>() {}

export const AlarmRepoLive = Layer.effect(
  AlarmRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    const findById = (id: AlarmId) =>
      Effect.gen(function* () {
        const rows = yield* sql`SELECT ... WHERE id = ${id}`
        return yield* decodeOptional(AlarmModel)(rows)
      })

    const insert = (alarm: typeof AlarmModel.insert.Type) =>
      Effect.gen(function* () {
        const rows = yield* sql`INSERT ... RETURNING ...`
        return yield* decodeFirst(AlarmModel)(rows)
      })

    return {
      findById,
      insert,
      // ...
    } satisfies AlarmRepository
  })
)
```

**Key Difference:** AMS v2 auto-generates CRUD, IIoT writes manual SQL for control.

### 5.3 Insert Operation

#### AMS v2: Auto-Generated

```typescript
// Consumer code
const asset = yield* repo.insert(AssetModel.insert.make({
  id: 'asset-001' as AssetId,
  kind: 'EQUIPMENT',
  label: 'Forklift #1',
  status: 'available',
  siteId: 'site-01',
  bfoClass: 'material_entity',
  version: 1,
  description: Option.none(),
  sectorId: Option.none(),
  containerId: Option.none(),
  basePropertiesJson: Option.none(),
  tagsJson: Option.none(),
}))

// makeRepository auto-generates:
// - INSERT query with all fields
// - RETURNING * to get generated createdAt/updatedAt
// - Decode via Model schema
```

#### IIoT: Manual Query

```typescript
const insert = (alarm: typeof AlarmModel.insert.Type) =>
  Effect.gen(function* () {
    const messageValue = Option.getOrNull(alarm.message)
    const metadataValue = Option.getOrNull(alarm.metadata)

    const rows = yield* sql`
      INSERT INTO iiot.alarms (device_id, alarm_type, severity, message, metadata)
      VALUES (
        ${alarm.deviceId},
        ${alarm.alarmType},
        ${alarm.severity},
        ${messageValue},
        ${metadataValue}
      )
      RETURNING
        id,
        device_id AS "deviceId",
        alarm_type AS "alarmType",
        severity,
        message,
        triggered_at AS "triggeredAt",
        acknowledged_at AS "acknowledgedAt",
        cleared_at AS "clearedAt",
        acknowledged_by AS "acknowledgedBy",
        metadata
    `
    return yield* decodeFirst(AlarmModel)(rows)
  })
```

**Key Difference:** IIoT requires manual `Option.getOrNull()` and AS aliasing.

### 5.4 Update Operation

#### AMS v2: Auto-Generated with Optimistic Lock

```typescript
// makeRepository auto-checks version field
const updated = yield* repo.update(AssetModel.update.make({
  ...asset,
  label: 'Updated Label',
  version: asset.version + 1,  // Increment version
}))

// SQL: UPDATE assets SET ... WHERE id = ? AND version = ?
// If version mismatch → SqlError
```

#### IIoT: Manual Partial Update

```typescript
const update = (alarm: typeof AlarmModel.update.Type) =>
  Effect.gen(function* () {
    const changes = prepareUpdate(alarm)  // Option → null/value

    const rows = yield* sql`
      UPDATE iiot.alarms
      SET ${sql.update(changes, ['id'])}
      WHERE id = ${alarm.id}
      RETURNING
        id,
        device_id AS "deviceId",
        -- ... full column list ...
    `
    return yield* decodeFirst(AlarmModel)(rows)
  })

// No built-in optimistic locking
```

**Key Difference:** AMS v2 handles optimistic concurrency automatically.

### 5.5 Custom Query

#### AMS v2: Extend Repository or Write Custom Query

```typescript
// Option 1: Extend makeRepository return
const makeExtendedAssetRepository = Effect.gen(function* () {
  const baseRepo = yield* makeAssetRepository
  const sql = yield* SqlClient.SqlClient

  const findBySite = (siteId: SiteId) =>
    Effect.gen(function* () {
      const rows = yield* sql`
        SELECT * FROM assets WHERE site_id = ${siteId}
      `
      // Manual decode (no auto-transforms in custom queries)
      return yield* Schema.decodeUnknown(Schema.Array(AssetModel))(rows)
    })

  return {
    ...baseRepo,
    findBySite,
  }
})

// Option 2: Write in service layer
const assetService = Effect.gen(function* () {
  const repo = yield* AssetRepository
  const sql = yield* SqlClient.SqlClient

  const findAvailableInSite = (siteId: SiteId) =>
    sql`SELECT * FROM assets WHERE site_id = ${siteId} AND status = 'available'`
})
```

#### IIoT: Built-In Query Builder

```typescript
export interface AlarmRepository {
  readonly query: (params: {
    deviceId?: DeviceId
    severity?: AlarmSeverity
    onlyOpen?: boolean
    since?: Date
    limit?: number
  }) => Effect.Effect<readonly AlarmModel[], AlarmRepoError>
}

const query = (params: { ... }) =>
  Effect.gen(function* () {
    const rows = yield* sql`
      SELECT
        id,
        device_id AS "deviceId",
        alarm_type AS "alarmType",
        severity,
        message,
        triggered_at AS "triggeredAt",
        acknowledged_at AS "acknowledgedAt",
        cleared_at AS "clearedAt",
        acknowledged_by AS "acknowledgedBy",
        metadata
      FROM iiot.alarms
      WHERE 1=1
        AND (${params.deviceId ?? null}::text IS NULL OR device_id = ${params.deviceId ?? null})
        AND (${params.severity ?? null}::text IS NULL OR severity = ${params.severity ?? null})
        AND (${params.onlyOpen ?? false} = false OR cleared_at IS NULL)
        AND (${params.since ?? null}::timestamp IS NULL OR triggered_at >= ${params.since ?? null})
      ORDER BY triggered_at DESC
      LIMIT ${params.limit ?? 1000}
    `
    return yield* decodeRows(AlarmModel)(rows)
  })

// Consumer
const alarms = yield* alarmRepo.query({
  deviceId: 'DEV-001',
  severity: 'critical',
  onlyOpen: true,
  since: new Date('2026-01-01'),
  limit: 100,
})
```

**Key Difference:** IIoT embeds query builders in repository interface, AMS v2 requires custom extensions.

### 5.6 Testing

#### AMS v2: In-Memory SQLite

```typescript
import { it } from '@effect/vitest';
import { SqliteTestLayer } from '../sqlite-layer';

it.effect('creates and finds asset', () =>
  Effect.gen(function* () {
    const repo = yield* makeAssetRepository

    const created = yield* repo.insert(AssetModel.insert.make({
      id: 'asset-001' as AssetId,
      kind: 'EQUIPMENT',
      label: 'Test',
      status: 'available',
      siteId: 'site-01',
      bfoClass: 'material_entity',
      version: 1,
      description: Option.none(),
      sectorId: Option.none(),
      containerId: Option.none(),
      basePropertiesJson: Option.none(),
      tagsJson: Option.none(),
    }))

    const found = yield* repo.findById(created.id)
    expect(found).toBeDefined()
    expect(found.id).toBe('asset-001')
  }).pipe(Effect.provide(SqliteTestLayer))
)
```

**Features:**
- In-memory (`:memory:`)
- Auto-migrations via `createTables()`
- Fast (no I/O)
- Isolated per test

#### IIoT: PostgreSQL Required

```typescript
import { it } from '@effect/vitest';
import { AlarmRepoLive } from '../AlarmRepo';
import { PostgresLive } from '../../db';

it.effect('creates and finds alarm', () =>
  Effect.gen(function* () {
    const repo = yield* AlarmRepo

    const created = yield* repo.insert(AlarmModel.insert.make({
      deviceId: 'DEV-001' as DeviceId,
      alarmType: 'temperature_high',
      severity: 'critical',
      message: Option.none(),
      metadata: Option.none(),
    }))

    const found = yield* repo.findById(created.id)
    expect(Option.isSome(found)).toBe(true)
  }).pipe(
    Effect.provide(AlarmRepoLive),
    Effect.provide(PostgresLive),  // Requires running PostgreSQL
  )
)
```

**Challenges:**
- Requires PostgreSQL running (Docker, local, CI)
- Must run migrations separately
- Test isolation (cleanup after tests)
- Slower (network I/O)

---

## 6. Recommendations for v3 Architecture

### 6.1 Merge Strengths

**Goal:** Combine AMS v2's DX with IIoT's control and domain separation.

| Feature | Source | v3 Approach |
|---------|--------|-------------|
| **CRUD auto-generation** | AMS v2 | Keep `makeRepository()` for common operations |
| **Domain operations** | IIoT | Extend repository interface with domain methods |
| **3-layer separation** | IIoT | Domain Schema → Model → Repo |
| **Auto name transforms** | AMS v2 | Use `transformResultNames/transformQueryNames` |
| **Explicit decode** | IIoT | Optional: auto-decode by default, explicit for custom queries |
| **Query builders** | IIoT | Add `query()` method pattern to repositories |
| **SQLite testing** | AMS v2 | Keep `SqliteTestLayer` for fast tests |
| **PostgreSQL support** | IIoT | Dual-mode: SQLite for tests, PostgreSQL for prod |
| **Optimistic locking** | AMS v2 | Keep built-in version checks |
| **Span tracing** | AMS v2 | Keep auto-instrumentation |

### 6.2 Proposed v3 Pattern

#### Domain Schema (schemas/)

```typescript
// src/lib/domain/schemas/asset.ts
export class Asset extends Schema.TaggedClass<Asset>()('Asset', {
  id: AssetId,
  kind: AssetKind,
  label: AssetLabel,
  description: Schema.optional(AssetDescription),
  status: AssetStatus,
  // Domain-focused fields
}) {}
```

#### Persistence Model (models/)

```typescript
// src/lib/persistence/models/AssetModel.ts
export class AssetModel extends Model.Class<AssetModel>('AssetModel')({
  // Derive from domain schema
  kind: Asset.fields.kind,
  label: Asset.fields.label,

  // Add persistence concerns
  id: Model.GeneratedByApp(AssetId),
  description: Model.FieldOption(AssetDescription),
  status: AssetStatus,
  siteId: SiteId,
  sectorId: Model.FieldOption(SectorId),
  containerId: Model.FieldOption(ContainerId),
  version: Schema.Number.pipe(Schema.int()),
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}
```

#### Repository (repos/)

```typescript
// src/lib/persistence/repos/AssetRepo.ts

// Base CRUD from makeRepository
const makeAssetRepositoryBase = Model.makeRepository(AssetModel, {
  tableName: 'assets',
  idColumn: 'id',
  spanPrefix: 'AssetRepository',
})

// Extended interface with domain operations
export interface AssetRepository extends ReturnType<typeof makeAssetRepositoryBase> {
  readonly findBySite: (siteId: SiteId) => Effect.Effect<readonly AssetModel[], AssetRepoError>
  readonly findByStatus: (status: AssetStatus) => Effect.Effect<readonly AssetModel[], AssetRepoError>
  readonly checkOut: (id: AssetId, userId: string) => Effect.Effect<AssetModel, AssetRepoError>
  readonly checkIn: (id: AssetId) => Effect.Effect<AssetModel, AssetRepoError>
  readonly query: (params: {
    siteId?: SiteId
    status?: AssetStatus
    kind?: AssetKind
    since?: Date
    limit?: number
  }) => Effect.Effect<readonly AssetModel[], AssetRepoError>
}

export class AssetRepo extends Context.Tag('AssetRepo')<
  AssetRepo,
  AssetRepository
>() {}

export const AssetRepoLive = Layer.effect(
  AssetRepo,
  Effect.gen(function* () {
    const baseRepo = yield* makeAssetRepositoryBase
    const sql = yield* SqlClient.SqlClient

    const findBySite = (siteId: SiteId) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          SELECT * FROM assets WHERE site_id = ${siteId}
        `
        return yield* decodeRows(AssetModel)(rows)
      })

    const checkOut = (id: AssetId, userId: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          UPDATE assets
          SET
            status = 'checked_out',
            checked_out_by = ${userId},
            checked_out_at = NOW(),
            version = version + 1
          WHERE id = ${id} AND status = 'available'
          RETURNING *
        `
        if (rows.length === 0) {
          return yield* Effect.fail(new SqlError.SqlError({ message: 'Asset not available' }))
        }
        return yield* decodeFirst(AssetModel)(rows)
      })

    return {
      ...baseRepo,  // findById, insert, update, delete
      findBySite,
      findByStatus,
      checkOut,
      checkIn,
      query,
    } satisfies AssetRepository
  })
)
```

**Benefits:**
1. **CRUD auto-generated** - `...baseRepo` spreads `findById`, `insert`, `update`, `delete`
2. **Domain operations** - `checkOut`, `checkIn` add business logic
3. **Query builders** - `findBySite`, `query` for filtering
4. **Explicit interface** - `satisfies AssetRepository` ensures contract
5. **Dual-mode SQL** - Use `transformResultNames` for auto-aliasing, manual AS for custom queries

### 6.3 Dual-Database Support

```typescript
// src/lib/persistence/layers/sql.ts

// SQLite for tests (in-memory)
export const SqliteTestLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* createTables(sql)
  })
).pipe(
  Layer.provideMerge(
    SqliteClient.layer({
      filename: ':memory:',
      transformResultNames: snakeToCamel,
      transformQueryNames: camelToSnake,
    })
  )
)

// PostgreSQL for production
export const PostgresLive = PgClient.layer({
  database: 'gbg',
  host: 'localhost',
  port: 5432,
  transformResultNames: snakeToCamel,
  transformQueryNames: camelToSnake,
})
```

**Result:** Write once, test in SQLite, deploy to PostgreSQL.

### 6.4 Migration Strategy

**Phase 1:** Backfill missing features in AMS v2
- Add 3-layer separation (Domain → Model → Repo)
- Add explicit repository interfaces
- Add domain operations (`checkOut`, `checkIn`, etc.)
- Add query builder pattern

**Phase 2:** Backfill missing features in IIoT
- Adopt `makeRepository()` for base CRUD
- Add `transformResultNames/transformQueryNames`
- Migrate to `SqliteTestLayer` for fast tests

**Phase 3:** Converge on v3 pattern
- Extract v3 pattern as shared library
- Migrate existing repos incrementally
- Document migration guide

---

## 7. Conclusion

### 7.1 Pattern Scorecard

| Criterion | AMS v2 | IIoT | v3 (Proposed) |
|-----------|--------|------|---------------|
| **CRUD Boilerplate** | ✅ Auto | ❌ Manual | ✅ Auto |
| **Domain Operations** | ❌ None | ✅ Built-in | ✅ Built-in |
| **Name Transforms** | ✅ Auto | ❌ Manual AS | ✅ Auto |
| **Query Builders** | ❌ None | ✅ Built-in | ✅ Built-in |
| **Test Speed** | ✅ In-memory | ❌ PostgreSQL | ✅ In-memory |
| **PostgreSQL Features** | ❌ SQLite-only | ✅ Full support | ✅ Dual-mode |
| **Domain/Persistence Split** | ❌ Merged | ✅ 3-layer | ✅ 3-layer |
| **Optimistic Locking** | ✅ Built-in | ❌ Manual | ✅ Built-in |
| **Span Tracing** | ✅ Auto | ❌ Manual | ✅ Auto |
| **Explicit Interface** | ❌ Inferred | ✅ Declared | ✅ Declared |

**Winner:** v3 (proposed) merges the best of both worlds.

### 7.2 Key Takeaways

1. **AMS v2 optimizes for developer experience** - Less code, faster tests, auto-safety
2. **IIoT optimizes for domain richness** - Business operations, PostgreSQL power, explicit control
3. **v3 should merge both** - Auto CRUD + domain operations + dual-database support

### 7.3 Next Steps

1. **Validate v3 pattern** - Spike implementation on one entity (Asset or Alarm)
2. **Write migration guide** - Document IIoT → v3 and AMS v2 → v3 paths
3. **Extract shared library** - `@gbg/repo-patterns` or `@gbg/persistence`
4. **Incrementally migrate** - Start with new features, backfill existing repos

---

## Appendix A: File Reference

### AMS v2 Files

| File | Purpose |
|------|---------|
| `src/lib/ams/v2/base/repositories/asset.ts` | Model definitions, repository factories |
| `src/lib/ams/v2/base/repositories/sqlite-layer.ts` | SQLite client layer, migrations, name transforms |
| `src/lib/ams/v2/base/repositories/index.ts` | Public exports |
| `src/lib/ams/v2/base/services/repositories.ts` | Effect.Service wrappers |
| `src/lib/ams/v2/base/repositories/__tests__/asset.test.ts` | Model unit tests |

### IIoT Files

| File | Purpose |
|------|---------|
| `src/lib/iiot/schemas/alarms.ts` | Domain schemas (Alarm, AlarmSeverity, etc.) |
| `src/lib/iiot/models/alarms/AlarmModel.ts` | Persistence model |
| `src/lib/iiot/repos/AlarmRepo.ts` | Repository tag + implementation |
| `src/lib/iiot/repos/_decode.ts` | Decode utilities |
| `src/lib/iiot/models/_common.ts` | Shared transforms (CreatedAt, UpdatedAt, OptionalMetadata) |

### Key Dependencies

| Package | Usage |
|---------|-------|
| `@effect/sql` | Model.Class, Model.makeRepository |
| `@effect/sql-sqlite-bun` | SQLite client for Bun |
| `@effect/sql-pg` | PostgreSQL client |
| `@effect/vitest` | Effect-aware test runner |
| `effect` | Schema, Effect, Layer, Context |

---

**End of Report**
