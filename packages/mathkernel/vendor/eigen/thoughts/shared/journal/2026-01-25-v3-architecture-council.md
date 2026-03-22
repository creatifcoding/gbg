# V3 Architecture Council — Shared Journal

**Session**: 2026-01-25
**Purpose**: Collaborative revision of v3 Service Architecture spec
**Input**: 11 research documents (~10,400 lines)
**Output**: Revised `thoughts/shared/specs/2026-01-25-v3-service-architecture.md`

---

## Council Members

| Name | Domain | Research Docs | Section Ownership |
|------|--------|---------------|-------------------|
| **Schema-Sage** | Types & Validation | `iiot-schemas.md`, `iiot-models.md` | Section 3: Schema Architecture |
| **Repo-Maven** | Persistence | `iiot-repos.md`, `ams-v2-repositories.md` | Section 4: Repository Patterns |
| **Event-Oracle** | Event Sourcing | `ams-v2-events.md`, `iiot-services.md` | Section 5: Event Architecture |
| **Entity-Weaver** | Cluster Entities | `ams-v2-entities.md`, `ams-v2-layers.md` | Section 6: Entity Patterns |
| **Infra-Smith** | Database & Deploy | `iiot-models.md` (DDL), `iiot-seed.md`, `iiot-tests.md` | Section 7: Infrastructure |
| **Architect-Prime** | Coordination | All docs (synthesis) | Sections 1-2, 8-10 (integration) |

---

## Protocol

1. Each agent reads their assigned research documents
2. Extract patterns relevant to their section
3. Write findings to their thread below (append only)
4. When ready, write "READY FOR SYNTHESIS"
5. Architect-Prime synthesizes all threads into final spec

---

## Thread: Schema-Sage

### Executive Summary

The IIoT codebase implements a **schema-first, model-derived** architecture using Effect Schema. Domain schemas define business logic with runtime validation; persistence models derive from schemas and add PostgreSQL-specific transforms. Key insight: **Schemas are the source of truth** — Models are persistence adapters that reuse schema fields and add only database-specific concerns.

### 1. Core Schema Patterns

#### 1.1 Branded Identifier Pattern

All domain identifiers use `Schema.String.pipe(Schema.brand())` for compile-time type safety with zero runtime overhead:

```typescript
// src/lib/iiot/schemas/identifiers.ts

export const PlantId = Schema.String.pipe(Schema.brand('PlantId'))
export type PlantId = Schema.Schema.Type<typeof PlantId>

export const LineId = Schema.String.pipe(Schema.brand('LineId'))
export type LineId = Schema.Schema.Type<typeof LineId>

export const MachineId = Schema.String.pipe(Schema.brand('MachineId'))
export type MachineId = Schema.Schema.Type<typeof MachineId>

export const DeviceId = Schema.String.pipe(Schema.brand('DeviceId'))
export type DeviceId = Schema.Schema.Type<typeof DeviceId>
```

**Pattern characteristics:**
- Runtime: plain `string` (zero overhead)
- Compile-time: distinct types (cannot mix PlantId with LineId)
- Double-export: schema + type for both usages
- No additional validation (pure branding)

**VERIFIED via deepwiki**: Schema.brand creates nominal types that prevent accidental mixing of semantically different values while maintaining string representation at runtime.

#### 1.2 TaggedClass for Domain Entities

All domain entities use `Schema.TaggedClass<T>()('Tag', { fields })` for discriminated unions and structural validation:

```typescript
// src/lib/iiot/schemas/assets.ts

export class Plant extends Schema.TaggedClass<Plant>()('Plant', {
  id: PlantId,
  name: Schema.NonEmptyString,
  location: Schema.optional(Schema.String),
}) {}

export class Line extends Schema.TaggedClass<Line>()('Line', {
  id: LineId,
  name: Schema.NonEmptyString,
  plantId: PlantId,  // FK relationship via branded ID
}) {}

export class Machine extends Schema.TaggedClass<Machine>()('Machine', {
  id: MachineId,
  name: Schema.NonEmptyString,
  model: Schema.optional(Schema.String),
  lineId: LineId,
}) {}

export class Sensor extends Schema.TaggedClass<Sensor>()('Sensor', {
  deviceId: DeviceId,
  type: SensorType,
  unit: MeasurementUnit,
  machineId: MachineId,
}) {}
```

**Pattern characteristics:**
- Auto-generates `_tag` discriminant
- Mix of branded IDs, literals, built-in schemas
- FK relationships via branded IDs (type-safe at compile time)
- Optional fields via `Schema.optional()`

**VERIFIED via deepwiki**: `Schema.TaggedClass` creates class instances with both data and potential methods, auto-sets `_tag`, and enables pattern matching via discriminated unions.

#### 1.3 Schema.Literal for Enum-like Values

All string unions use `Schema.Literal()` for exhaustive type checking:

```typescript
// src/lib/iiot/schemas/assets.ts

export const SensorType = Schema.Literal(
  'temperature', 'vibration', 'humidity', 'speed',
  'current', 'pressure', 'flow', 'level'
)
export type SensorType = Schema.Schema.Type<typeof SensorType>

export const MeasurementUnit = Schema.Literal(
  'celsius', 'fahrenheit', 'mm/s', 'percent',
  'm/min', 'amps', 'psi', 'bar', 'l/min', 'gpm', 'meters', 'feet'
)
export type MeasurementUnit = Schema.Schema.Type<typeof MeasurementUnit>

// src/lib/iiot/schemas/alarms.ts

export const AlarmSeverity = Schema.Literal('info', 'warning', 'critical', 'emergency')
export type AlarmSeverity = Schema.Schema.Type<typeof AlarmSeverity>
```

**Pattern characteristics:**
- Compile-time exhaustiveness checking (TypeScript knows all values)
- Runtime validation (rejects invalid strings)
- Double-export pattern

### 2. Optional Field Patterns (CRITICAL DISTINCTION)

#### 2.1 Schema.optional() — Domain Layer

Used when the field is truly optional and may not be present at all. For pure TypeScript/domain schemas:

```typescript
export class Plant extends Schema.TaggedClass<Plant>()('Plant', {
  location: Schema.optional(Schema.String),  // Can be omitted entirely
}) {}
```

**Behavior:**
- Decode: Missing field → `undefined`
- Encode: `undefined` → field omitted from output
- Does NOT handle database `NULL`

#### 2.2 Schema.optionalWith(T, { nullable: true }) — Database Layer

Used when decoding from database columns that can be `NULL`:

```typescript
export class Alarm extends Schema.TaggedClass<Alarm>()('Alarm', {
  message: Schema.optionalWith(Schema.String, { nullable: true }),
  acknowledgedAt: Schema.optionalWith(Schema.DateTimeUtc, { nullable: true }),
  clearedAt: Schema.optionalWith(Schema.DateTimeUtc, { nullable: true }),
}) {}
```

**Behavior:**
- Decode: `NULL` → `undefined`, missing → `undefined`
- Encode: `undefined` → `NULL`
- Critical for PostgreSQL nullable columns

**VERIFIED via deepwiki**: `Schema.optionalWith({ nullable: true })` explicitly adds `null` to allowed types using `NullishOr` internally, essential for database `NULL` handling.

**Rule for v3:**
- `Schema.optional()` → pure domain schemas
- `Schema.optionalWith(T, { nullable: true })` → database-facing schemas

### 3. Constrained Value Patterns

#### 3.1 Branded Numbers with Constraints

```typescript
// src/lib/iiot/schemas/readings.ts

export const QualityScore = Schema.Number.pipe(
  Schema.int(),            // Must be integer
  Schema.between(0, 100),  // Range constraint
  Schema.brand('QualityScore')
)
export type QualityScore = Schema.Schema.Type<typeof QualityScore>
```

#### 3.2 Positive Integer Pattern

```typescript
sampleCount: Schema.Number.pipe(Schema.int(), Schema.positive())
```

### 4. Schema-to-Model Derivation Pattern

**Core Principle:** Models derive from domain schemas, adding only PostgreSQL-specific transforms.

#### 4.1 Field Reuse Pattern

```typescript
// Domain schema
export class Plant extends Schema.TaggedClass<Plant>()('Plant', {
  id: PlantId,
  name: Schema.NonEmptyString,
  location: Schema.optional(Schema.String),
}) {}

// Model (persistence adapter)
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  // REUSE from domain schema
  name: Plant.fields.name,

  // ADD Model-specific transforms
  id: Model.GeneratedByApp(PlantId),         // Client-provided PK
  location: Model.FieldOption(Schema.String), // Schema.optional → Model.FieldOption

  // ADD DB-only fields
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}
```

**Benefits:**
- Single source of truth (domain schema)
- Changes propagate automatically
- Clear derivation relationship
- No business logic in models

#### 4.2 Model Transform Patterns

**VERIFIED via deepwiki:**

| Transform | Purpose | Behavior |
|-----------|---------|----------|
| `Model.Generated(BrandedId)` | DB-generated PK | Excluded from insert, included in select/update |
| `Model.GeneratedByApp(BrandedId)` | Client-provided PK | Included in all operations |
| `Model.FieldOption(Schema)` | Nullable field | NULL ↔ Option mapping |
| `Model.DateTimeInsertFromDate` | CreatedAt pattern | Auto-set on insert, excluded from update |
| `Model.DateTimeUpdateFromDate` | UpdatedAt pattern | Auto-updated on modify |

#### 4.3 DateTime Handling

| Layer | Schema | Reason |
|-------|--------|--------|
| Domain | `Schema.DateTimeUtc` | Effect's UTC DateTime type |
| Model | `Schema.DateFromSelf` | pg driver returns native Date objects |
| Insert | `Model.DateTimeInsertFromDate` | CreatedAt auto-population |
| Update | `Model.DateTimeUpdateFromDate` | UpdatedAt auto-update |

### 5. Error Schema Patterns

All IIoT errors use `Data.TaggedError` for type-safe error handling:

```typescript
// src/lib/iiot/schemas/errors.ts

export class DeviceNotFoundError extends Data.TaggedError('DeviceNotFoundError')<{
  readonly deviceId: DeviceId
}> {}

export class IIoTQueryError extends Data.TaggedError('IIoTQueryError')<{
  readonly operation: string
  readonly message: string
  readonly cause?: unknown
}> {}

// Union type for service signatures
export type IIoTServiceError =
  | IIoTConnectionError
  | IIoTQueryError
  | DeviceNotFoundError
  | AlarmNotFoundError
  // ...
```

**Pattern characteristics:**
- Use `Data.TaggedError()` (NOT `Schema.TaggedError`)
- Generic parameter is the error shape
- All fields should be `readonly`
- `cause?: unknown` for wrapped errors
- Union type for exhaustive error handling

### 6. Composite Schema Patterns

#### 6.1 Hierarchy Composition

```typescript
export class MachineWithSensors extends Schema.TaggedClass<MachineWithSensors>()('MachineWithSensors', {
  machine: Machine,
  sensors: Schema.Array(Sensor),
}) {}

export class LineWithMachines extends Schema.TaggedClass<LineWithMachines>()('LineWithMachines', {
  line: Line,
  machines: Schema.Array(MachineWithSensors),
}) {}

export class PlantHierarchy extends Schema.TaggedClass<PlantHierarchy>()('PlantHierarchy', {
  plant: Plant,
  lines: Schema.Array(LineWithMachines),
}) {}
```

**Structure:**
```
PlantHierarchy
├── plant: Plant
└── lines: LineWithMachines[]
    ├── line: Line
    └── machines: MachineWithSensors[]
        ├── machine: Machine
        └── sensors: Sensor[]
```

#### 6.2 Query Parameter Structs

```typescript
export const AlarmQueryParams = Schema.Struct({
  deviceId: Schema.optional(DeviceId),
  severity: Schema.optional(AlarmSeverity),
  onlyOpen: Schema.optional(Schema.Boolean),
  since: Schema.optional(Schema.DateTimeUtc),
  limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
})
export type AlarmQueryParams = Schema.Schema.Type<typeof AlarmQueryParams>
```

### 7. File Organization for v3

```
schemas/
├── identifiers.ts       # All branded IDs (PlantId, DeviceId, etc.)
├── assets.ts            # Asset hierarchy schemas (Plant, Line, Machine, Sensor)
├── readings.ts          # Time-series schemas (SensorReading, AggregatedReading)
├── alarms.ts            # Alarm/event schemas (Alarm, AlarmContext)
├── errors.ts            # Tagged errors (Data.TaggedError)
└── index.ts             # Re-exports

models/
├── _common.ts           # Shared transforms (CreatedAt, UpdatedAt, OptionalMetadata)
├── assets/
│   ├── PlantModel.ts    # Derives from Plant.fields
│   ├── LineModel.ts
│   ├── MachineModel.ts
│   └── SensorModel.ts
├── readings/
│   ├── SensorReadingModel.ts
│   └── AggregatedReadingModel.ts
└── alarms/
    ├── AlarmModel.ts
    └── AlarmContextModel.ts
```

### 8. Anti-Patterns to Avoid

#### 8.1 Don't Duplicate Schema Fields in Models

```typescript
// ❌ BAD: Redefining schema
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  name: Schema.NonEmptyString,  // Duplication!
})

// ✅ GOOD: Reuse from domain schema
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  name: Plant.fields.name,
})
```

#### 8.2 Don't Mix Optional Patterns

```typescript
// ❌ BAD: Using Schema.optional for DB nullable field
message: Schema.optional(Schema.String)  // Won't handle NULL

// ✅ GOOD: Use optionalWith for DB fields
message: Schema.optionalWith(Schema.String, { nullable: true })
```

#### 8.3 Don't Use DateTimeUtc in Models

```typescript
// ❌ BAD: DateTimeUtc incompatible with pg driver
triggeredAt: Schema.DateTimeUtc

// ✅ GOOD: pg returns native Date objects
triggeredAt: Schema.DateFromSelf
```

#### 8.4 Don't Create Branded Types Without Schema

```typescript
// ❌ BAD: Plain branded type (no runtime validation)
export type PlantId = string & { readonly PlantId: unique symbol }

// ✅ GOOD: Effect Schema brand (runtime validation)
export const PlantId = Schema.String.pipe(Schema.brand('PlantId'))
export type PlantId = Schema.Schema.Type<typeof PlantId>
```

### 9. Naming Conventions

| Category | Convention | Example |
|----------|------------|---------|
| Schemas | PascalCase class | `Plant`, `Alarm` |
| Branded IDs | PascalCase + `Id` suffix | `PlantId`, `DeviceId` |
| Literals | PascalCase type name | `SensorType`, `AlarmSeverity` |
| Models | PascalCase + `Model` suffix | `PlantModel`, `AlarmModel` |
| Errors | PascalCase + `Error` suffix | `DeviceNotFoundError` |
| Params | PascalCase + `Params` suffix | `AlarmQueryParams` |

### 10. Recommendations for v3

1. **Enforce schema-first discipline** — Domain schemas must be defined before models
2. **Standardize optional patterns** — Document when to use each (`optional` vs `optionalWith`)
3. **Create schema linting rules** — Prevent raw TypeScript types in domain layer
4. **Add schema validation tests** — Test decode/encode roundtrips for all entities
5. **Document DateTime handling** — Clear guidance on DateTimeUtc vs DateFromSelf

---

**READY FOR SYNTHESIS**

---

## Thread: Repo-Maven

### Section 4: Repository Patterns

I have completed comprehensive analysis of repository patterns from `ams-v2-repositories.md` and deepwiki verification against `@effect/sql` source. This section covers two competing patterns, decode utilities, Option handling, and a unified v3 recommendation.

---

### 4.1 Two Repository Paradigms

The codebase demonstrates two distinct repository patterns:

| Aspect | AMS v2 (Auto-Generated) | IIoT (Manual) |
|--------|------------------------|---------------|
| **Core Abstraction** | `Model.makeRepository()` | `Context.Tag` + `Layer.effect` |
| **DI Pattern** | `Effect.Service<>()` wrapper | Direct `Context.Tag` extension |
| **SQL Composition** | Auto-generated CRUD | Hand-written queries |
| **Decode Strategy** | Model auto-transforms | Explicit decode utilities |
| **Name Transform** | `transformResultNames` config | Manual `AS` aliasing |
| **Custom Operations** | Extend after base repo | Built into interface |

**Key Insight:** AMS v2 optimizes for DX/safety. IIoT optimizes for control/PostgreSQL-specific features.

---

### 4.2 Pattern 1: Model.makeRepository (AMS v2)

**VERIFIED via deepwiki:** `Model.makeRepository` generates `insert`, `insertVoid`, `update`, `updateVoid`, `findById`, and `delete` methods from a `Model.Class` schema.

#### Definition Pattern

```typescript
// Model definition
export class AssetModel extends Model.Class<AssetModel>('AssetModel')({
  id: Model.GeneratedByApp(AssetId),     // Client-provided ID
  kind: AssetKind,
  label: AssetLabel,
  description: Model.FieldOption(AssetDescription),  // null <-> Option
  status: AssetStatus,
  siteId: SiteId,
  sectorId: Model.FieldOption(SectorId),
  version: Schema.Number.pipe(Schema.int()),
  createdAt: Model.DateTimeInsert,       // Auto-set on insert
  updatedAt: Model.DateTimeUpdate,       // Auto-set on update
}) {}

// Repository factory
export const makeAssetRepository = Model.makeRepository(AssetModel, {
  tableName: 'assets',
  idColumn: 'id',
  spanPrefix: 'AssetRepository',  // Auto-tracing
})

// Service wrapper for DI
export class AssetRepository extends Effect.Service<AssetRepository>()(
  '@gbg/tmnl/ams/v2/AssetRepository',
  { effect: makeAssetRepository }
) {}
```

#### Auto-Generated Methods

| Method | SQL Generated | Return Type |
|--------|---------------|-------------|
| `findById(id)` | `SELECT * FROM assets WHERE id = ?` | `Effect<Option<AssetModel>>` |
| `insert(data)` | `INSERT ... RETURNING *` | `Effect<AssetModel>` |
| `insertVoid(data)` | `INSERT ...` (no RETURNING) | `Effect<void>` |
| `update(data)` | `UPDATE ... WHERE id = ? RETURNING *` | `Effect<AssetModel>` |
| `updateVoid(data)` | `UPDATE ... WHERE id = ?` | `Effect<void>` |
| `delete(id)` | `DELETE FROM assets WHERE id = ?` | `Effect<void>` |

#### Name Transform Configuration

```typescript
export const SqliteMemoryLayer = SqliteClient.layer({
  filename: ':memory:',
  transformResultNames: snakeToCamel,  // DB -> Model
  transformQueryNames: camelToSnake,   // Model -> DB
})
```

**Benefit:** Zero AS aliasing in queries. TypeScript uses `siteId`, SQL uses `site_id`.

---

### 4.3 Pattern 2: Manual Context.Tag Repository (IIoT)

#### Interface-First Design

```typescript
// Explicit interface contract
export interface AlarmRepository {
  // Queries
  readonly findById: (id: AlarmId) => Effect.Effect<Option.Option<AlarmModel>, AlarmRepoError>
  readonly findByDevice: (deviceId: DeviceId) => Effect.Effect<readonly AlarmModel[], AlarmRepoError>
  readonly findOpen: () => Effect.Effect<readonly AlarmModel[], AlarmRepoError>
  readonly query: (params: {
    deviceId?: DeviceId
    severity?: AlarmSeverity
    onlyOpen?: boolean
    since?: Date
    limit?: number
  }) => Effect.Effect<readonly AlarmModel[], AlarmRepoError>

  // Commands
  readonly insert: (alarm: typeof AlarmModel.insert.Type) => Effect.Effect<AlarmModel, AlarmRepoError>
  readonly update: (alarm: typeof AlarmModel.update.Type) => Effect.Effect<AlarmModel, AlarmRepoError>

  // Domain operations (beyond CRUD)
  readonly acknowledge: (id: AlarmId, acknowledgedBy: string) => Effect.Effect<AlarmModel, AlarmRepoError>
  readonly clear: (id: AlarmId) => Effect.Effect<AlarmModel, AlarmRepoError>
  readonly delete: (id: AlarmId) => Effect.Effect<void, SqlError.SqlError>
}

// Context.Tag for DI
export class AlarmRepo extends Context.Tag('iiot/AlarmRepo')<
  AlarmRepo,
  AlarmRepository
>() {}
```

#### Layer Implementation

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

    // ... more methods ...

    return {
      findById,
      findByDevice,
      findOpen,
      query,
      insert,
      update,
      acknowledge,
      clear,
      delete: del,
    } satisfies AlarmRepository  // Type-safe contract enforcement
  })
)
```

---

### 4.4 Decode Utilities

The IIoT pattern uses reusable decode functions to transform raw SQL results through Model schemas.

#### Core Functions (from `repos/_decode.ts`)

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
 * Decode first row (INSERT/UPDATE RETURNING).
 */
export const decodeFirst =
  <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<A, ParseResult.ParseError, R> =>
    Schema.decodeUnknown(schema)(rows[0])
```

**Benefit:** Explicit decode separates SQL errors from schema validation errors.

---

### 4.5 prepareUpdate Utility

Converts `Option` fields to SQL-compatible values for `sql.update()`.

```typescript
/**
 * Transform update object for sql.update():
 * - undefined -> undefined (sql.update skips)
 * - Option.none() -> null (sets DB to NULL)
 * - Option.some(v) -> v (sets DB to value)
 */
export const prepareUpdate = <T extends Record<string, unknown>>(
  obj: T
): Record<string, unknown> => {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue  // Skip undefined

    if (Option.isOption(value)) {
      result[key] = Option.getOrNull(value)  // Option -> null/value
    } else {
      result[key] = value
    }
  }

  return result
}
```

#### Usage with sql.update()

```typescript
const update = (alarm: typeof AlarmModel.update.Type) =>
  Effect.gen(function* () {
    const changes = prepareUpdate(alarm)  // Option -> primitive

    const rows = yield* sql`
      UPDATE iiot.alarms
      SET ${sql.update(changes, ['id'])}   -- Exclude id from SET
      WHERE id = ${alarm.id}
      RETURNING ...
    `
    return yield* decodeFirst(AlarmModel)(rows)
  })
```

**Key Insight:** `sql.update(changes, ['id'])` excludes `id` from SET clause, uses it only in WHERE.

---

### 4.6 Domain-Specific Operations (Idempotent Pattern)

Beyond CRUD, repositories can implement domain operations with built-in idempotency.

```typescript
const acknowledge = (id: AlarmId, acknowledgedBy: string) =>
  Effect.gen(function* () {
    // Try update - only affects unacknowledged rows
    const rows = yield* sql`
      UPDATE iiot.alarms
      SET
        acknowledged_at = NOW(),
        acknowledged_by = ${acknowledgedBy}
      WHERE id = ${id} AND acknowledged_at IS NULL
      RETURNING ...
    `

    // If rows returned, decode and return
    if (rows.length > 0) {
      return yield* decodeFirst(AlarmModel)(rows)
    }

    // Idempotent: already acknowledged -> return existing
    const existing = yield* findById(id)
    return yield* Option.match(existing, {
      onNone: () => Effect.fail(new SqlError.SqlError({ message: `Alarm not found: ${id}` })),
      onSome: Effect.succeed,
    })
  })
```

**Pattern:** `UPDATE ... WHERE condition AND state_check IS NULL` + fallback to existing.

---

### 4.7 Query Builder Pattern

Structured query parameters with dynamic SQL.

```typescript
const query = (params: {
  deviceId?: DeviceId
  severity?: AlarmSeverity
  onlyOpen?: boolean
  since?: Date
  limit?: number
}) =>
  Effect.gen(function* () {
    const rows = yield* sql`
      SELECT ...
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
```

**Pattern:** `(${param ?? null}::type IS NULL OR column = ${param ?? null})` for optional filters.

---

### 4.8 v3 Recommended Pattern: Hybrid Repository

Combine both patterns: use `makeRepository` for base CRUD, extend with domain operations.

```typescript
// 1. Model.makeRepository for base CRUD
const makeAssetRepositoryBase = Model.makeRepository(AssetModel, {
  tableName: 'assets',
  idColumn: 'id',
  spanPrefix: 'AssetRepository',
})

// 2. Extended interface with domain operations
export interface AssetRepository extends Awaited<ReturnType<typeof makeAssetRepositoryBase>> {
  readonly findBySite: (siteId: SiteId) => Effect.Effect<readonly AssetModel[], AssetRepoError>
  readonly checkOut: (id: AssetId, userId: string) => Effect.Effect<AssetModel, AssetRepoError>
  readonly checkIn: (id: AssetId) => Effect.Effect<AssetModel, AssetRepoError>
  readonly query: (params: QueryParams) => Effect.Effect<readonly AssetModel[], AssetRepoError>
}

// 3. Context.Tag for DI
export class AssetRepo extends Context.Tag('ams/v3/AssetRepo')<
  AssetRepo,
  AssetRepository
>() {}

// 4. Implementation combining base + extensions
export const AssetRepoLive = Layer.effect(
  AssetRepo,
  Effect.gen(function* () {
    const baseRepo = yield* makeAssetRepositoryBase  // Auto CRUD
    const sql = yield* SqlClient.SqlClient

    const findBySite = (siteId: SiteId) =>
      Effect.gen(function* () {
        const rows = yield* sql`SELECT * FROM assets WHERE site_id = ${siteId}`
        return yield* decodeRows(AssetModel)(rows)
      })

    const checkOut = (id: AssetId, userId: string) =>
      Effect.gen(function* () {
        const rows = yield* sql`
          UPDATE assets
          SET status = 'checked_out', checked_out_by = ${userId}, version = version + 1
          WHERE id = ${id} AND status = 'available'
          RETURNING *
        `
        if (rows.length === 0) {
          return yield* Effect.fail(new AssetNotAvailableError({ assetId: id }))
        }
        return yield* decodeFirst(AssetModel)(rows)
      })

    return {
      ...baseRepo,  // findById, insert, update, delete
      findBySite,
      checkOut,
      checkIn,
      query,
    } satisfies AssetRepository
  })
)
```

#### Benefits of Hybrid Pattern

1. **Zero CRUD Boilerplate** - `...baseRepo` spreads auto-generated methods
2. **Domain Operations** - `checkOut`, `checkIn` encode business rules
3. **Query Builders** - `findBySite`, `query` for filtering
4. **Explicit Interface** - `satisfies AssetRepository` enforces contract
5. **Auto Tracing** - Base methods have spans via `spanPrefix`
6. **Testable** - Mock `AssetRepository` interface for unit tests

---

### 4.9 Pattern Comparison Summary

| Feature | Model.makeRepository | Manual Context.Tag |
|---------|---------------------|-------------------|
| **CRUD Boilerplate** | None (auto-generated) | ~200 lines/repo |
| **Custom Operations** | Extend after factory | Built into interface |
| **Name Transforms** | Config-based (global) | Manual AS aliasing |
| **Decode Control** | Internal (implicit) | External (explicit) |
| **Error Granularity** | Combined SqlError | Separate Parse vs SQL |
| **PostgreSQL Features** | Limited | Full (NOW(), schema, JSONB) |
| **Interface Contract** | Inferred type | Explicit interface |
| **Testability** | Mock Model | Mock interface |
| **Span Tracing** | Auto (spanPrefix) | Manual withSpan |

---

### 4.10 Repository Pattern Catalog for v3

#### Pattern 1: Repository Interface

```typescript
export interface {Entity}Repository {
  // Base CRUD (from makeRepository)
  readonly findById: (id: {Entity}Id) => Effect.Effect<Option.Option<{Entity}Model>>
  readonly insert: (data: typeof {Entity}Model.insert.Type) => Effect.Effect<{Entity}Model>
  readonly update: (data: typeof {Entity}Model.update.Type) => Effect.Effect<{Entity}Model>
  readonly delete: (id: {Entity}Id) => Effect.Effect<void>

  // Query builders
  readonly findBy{Relation}: ({relation}Id: {Relation}Id) => Effect.Effect<readonly {Entity}Model[]>
  readonly query: (params: {Entity}QueryParams) => Effect.Effect<readonly {Entity}Model[]>

  // Domain operations
  readonly {domainAction}: (id: {Entity}Id, ...args) => Effect.Effect<{Entity}Model>
}
```

#### Pattern 2: Repository Context.Tag

```typescript
export class {Entity}Repo extends Context.Tag('{module}/{Entity}Repo')<
  {Entity}Repo,
  {Entity}Repository
>() {}
```

#### Pattern 3: Hybrid Implementation

```typescript
export const {Entity}RepoLive = Layer.effect(
  {Entity}Repo,
  Effect.gen(function* () {
    const baseRepo = yield* make{Entity}RepositoryBase
    const sql = yield* SqlClient.SqlClient

    // Custom operations
    const find{Custom} = (...) => Effect.gen(function* () { ... })
    const {domainAction} = (...) => Effect.gen(function* () { ... })

    return {
      ...baseRepo,
      find{Custom},
      {domainAction},
    } satisfies {Entity}Repository
  })
)
```

#### Pattern 4: Decode Utilities (Shared)

```typescript
// repos/_decode.ts
export const decodeRow = <A, I, R>(schema: Schema.Schema<A, I, R>) => ...
export const decodeRows = <A, I, R>(schema: Schema.Schema<A, I, R>) => ...
export const decodeOptional = <A, I, R>(schema: Schema.Schema<A, I, R>) => ...
export const decodeFirst = <A, I, R>(schema: Schema.Schema<A, I, R>) => ...
export const prepareUpdate = <T extends Record<string, unknown>>(obj: T) => ...
```

---

### 4.11 Open Questions for Repository Architecture

1. **Dual-Database Support** - Should v3 support both SQLite (tests) and PostgreSQL (prod) with same repo code?

2. **Batch Operations** - Should repos have `insertBatch`/`updateBatch` for bulk seeding?

3. **Pagination** - Standard pagination pattern? Cursor-based vs offset-based?

4. **Soft Deletes** - Should `delete` set `deleted_at` instead of hard delete?

5. **Transaction Scope** - How do repos participate in transactions across multiple operations?

---

**READY FOR SYNTHESIS**

---

## Thread: Event-Oracle

### Executive Summary

The `@effect/experimental` EventLog module provides a **complete event-sourcing framework** with schema-backed events, journal persistence, conflict detection, and reactive queries. Key insight: **Events are the source of truth** — state is derived by replaying events through handlers. The system integrates with `@effect/sql` via `SqlEventJournal` for PostgreSQL persistence, enabling the transactional outbox pattern.

**VERIFIED via deepwiki**: EventLog lives in `@effect/experimental` (not `@effect/cluster`). It uses `EventJournal` for persistence and supports remote sync via encrypted WebSocket.

---

### 1. EventGroup.empty.add() Pattern

EventGroups define domain event schemas using a fluent builder API:

**Location**: `src/lib/ams/v2/base/events/asset.ts`

```typescript
import { EventGroup } from '@effect/experimental'
import { Schema } from 'effect'

// Event payloads as Schema.Class
export class AssetCreatedPayload extends Schema.Class<AssetCreatedPayload>(
  'AssetCreatedPayload'
)({
  assetId: AssetId,
  siteId: SiteId,
  kind: AssetKind,
  label: AssetLabel,
  status: AssetStatus,
  createdBy: IdentityId,
  createdAt: CreatedAt,
}) {}

// EventGroup builder pattern
export const AssetEvents = EventGroup.empty
  .add({
    tag: 'AssetCreated',                    // Discriminator for pattern matching
    payload: AssetCreatedPayload,            // Schema.Class or Schema.Struct
    primaryKey: (payload) => payload.assetId // Entity identity for conflict detection
  })
  .add({
    tag: 'AssetUpdated',
    payload: AssetUpdatedPayload,
    primaryKey: (payload) => payload.assetId
  })
  .add({
    tag: 'AssetMoved',
    payload: AssetMovedPayload,
    primaryKey: (payload) => payload.assetId
  })
  .add({
    tag: 'AssetDeleted',
    payload: AssetDeletedPayload,
    primaryKey: (payload) => payload.assetId
  })

// Type helper for event union
export type AssetEvents = EventGroup.EventGroup.Events<typeof AssetEvents>
```

**Key Properties of `.add()`:**

| Property | Type | Purpose |
|----------|------|---------|
| `tag` | `string` | Unique event discriminator |
| `payload` | `Schema` | Event data (MsgPack serialized) |
| `primaryKey` | `(payload) => string` | Entity identity for conflict detection |
| `success` | `Schema` (optional) | Handler return type |
| `error` | `Schema` (optional) | Handler failure type |

**Pattern Variants:**

```typescript
// Simple: inline Schema.Struct
.add({
  tag: 'OverlayEnabled',
  primaryKey: (p) => `${p.containerId}:${p.overlayId}`,  // Composite key
  payload: Schema.Struct({
    containerId: ContainerId,
    overlayId: OverlayId,
    activatedAt: Schema.Number,
  }),
})

// Complex: Schema.Class with methods
.add({
  tag: 'AssetCreated',
  payload: AssetCreatedPayload,  // Schema.Class allows instanceof checks
  primaryKey: (payload) => payload.assetId,
})
```

---

### 2. EventLog.makeSchema Composition

Multiple EventGroups compose into a single application schema:

**Location**: `src/lib/ams/v2/base/events/schema.ts`

```typescript
import * as EventLog from '@effect/experimental/EventLog'
import { AssetEvents } from './asset'
import { SiteEvents } from './site'
import { ContainerEvents } from './container'

// Combine all domain groups into one schema
export const AmsEventLogSchema = EventLog.schema(
  AssetEvents,
  SiteEvents,
  ContainerEvents,
)

// Type helper
export type AmsEventLogSchema = typeof AmsEventLogSchema
```

**The schema is used for:**
1. `EventLog.makeClient(schema)` — Type-safe event writing
2. `EventLog.group(schema, ...)` — Handler registration validation
3. `EventLog.layer(schema)` — EventLog service construction
4. Remote sync protocol — Schema defines wire format

---

### 3. Event Emission in Entity Handlers (maybeEmit Pattern)

Entity handlers emit events via `EventLog.makeClient()`. The `maybeEmit` pattern makes EventLog optional for testing.

**Location**: `src/lib/ams/v2/base/handlers/asset.ts`

```typescript
import { Effect, Option } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { AmsEventLogSchema } from '../events/schema'
import { AssetCreatedPayload } from '../events/asset'

export const AssetEntityHandlers = AssetEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* AssetState

    // OPTIONAL: Get EventLog client (tests may not provide EventLog)
    const eventLogOption = yield* Effect.serviceOption(EventLog.EventLog)
    const writeEvent = Option.isSome(eventLogOption)
      ? yield* EventLog.makeClient(AmsEventLogSchema)
      : null

    // maybeEmit helper: emit if EventLog available, no-op otherwise
    const maybeEmit = <T>(
      tag: Parameters<NonNullable<typeof writeEvent>>[0],
      payload: Parameters<NonNullable<typeof writeEvent>>[1]
    ) =>
      writeEvent
        ? writeEvent(tag, payload).pipe(Effect.catchAll(() => Effect.void))
        : Effect.void

    return {
      CreateAsset: (envelope) =>
        Effect.gen(function* () {
          // 1. Execute business logic via state service
          const asset = yield* state.create({
            siteId: envelope.payload.siteId,
            kind: envelope.payload.kind,
            label: envelope.payload.label,
            // ...
          })

          // 2. Emit domain event (non-blocking, swallowed on failure)
          yield* maybeEmit('AssetCreated', new AssetCreatedPayload({
            assetId: asset.id,
            siteId: asset.siteId,
            kind: asset.kind,
            label: asset.label,
            status: asset.status,
            createdBy: envelope.payload.createdBy,
            createdAt: asset.createdAt,
          }))

          // 3. Return result
          return asset
        }),

      // Query handlers: NO event emission
      GetAsset: (envelope) => state.findById(envelope.payload.assetId),
    }
  }),
  { defectRetryPolicy: Schedule.exponential('100 millis', 2).pipe(Schedule.upTo('10 seconds')) }
)
```

**Key Pattern Details:**

1. **Effect.serviceOption(EventLog.EventLog)** — Optional dependency injection
2. **EventLog.makeClient(schema)** — Returns typed `write(tag, payload)` function
3. **maybeEmit swallows errors** — Event emission should not fail command execution
4. **Commands emit, queries don't** — CQRS separation

---

### 4. EventLog.group for Projections (Handler Registration)

`EventLog.group()` registers handlers that process events and update read models:

**Location**: `src/lib/ams/v2/base/handlers/event-handlers.ts`

```typescript
import { Effect } from 'effect'
import * as EventLog from '@effect/experimental/EventLog'
import { AssetEvents } from '../events/asset'
import { AssetState } from '../services/asset-state'

// Handler Layer: processes events, updates projections
export const AssetEventHandlers = EventLog.group(AssetEvents, (handlers) =>
  Effect.gen(function* () {
    const state = yield* AssetState

    return handlers
      .handle('AssetCreated', ({ payload, entry, conflicts }) =>
        Effect.gen(function* () {
          // Conflict detection (concurrent creates with same ID)
          if (conflicts.length > 0) {
            yield* Effect.logWarning(`Concurrent asset creation: ${payload.assetId}`)
            // Decide: last-write-wins, first-write-wins, or merge
          }

          // Update read model (or trigger side effects)
          yield* Effect.log(`[EventLog] Asset created: ${payload.assetId}`)

          // Optional: notify external systems
          // yield* NotificationService.notify({ type: 'asset_created', ... })

          return void 0  // Return success
        })
      )
      .handle('AssetUpdated', ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.log(`[EventLog] Asset updated: ${payload.assetId}`)
          return void 0
        })
      )
      .handle('AssetDeleted', ({ payload }) =>
        Effect.gen(function* () {
          yield* Effect.log(`[EventLog] Asset deleted: ${payload.assetId}`)
          return void 0
        })
      )
  })
)
```

**Handler Context:**

```typescript
interface HandlerContext<Tag> {
  payload: EventPayload<Tag>        // Decoded event data
  entry: Entry                       // Journal entry (id, timestamp)
  conflicts: Array<{                 // Concurrent entries with same primaryKey
    entry: Entry
    payload: EventPayload<Tag>
  }>
}
```

**When Handlers Run:**
1. **On write** — Immediately when `EventLog.write()` is called
2. **On startup replay** — When EventLog layer initializes (persisted events)
3. **On remote sync** — When entries arrive from other clients

---

### 5. Transactional Outbox with PG Journal (SqlEventJournal)

`@effect/sql` provides `SqlEventJournal` for PostgreSQL persistence:

**Location**: `src/lib/ams/v2/base/handlers/sql-event-journal.ts`

```typescript
import { Layer } from 'effect'
import * as SqlEventJournal from '@effect/sql/SqlEventJournal'
import * as EventLog from '@effect/experimental/EventLog'
import { AmsEventLogSchema } from '../events/schema'

// 1. SqlEventJournal Layer (creates tables in DB)
export const SqlEventJournalLayer = SqlEventJournal.layer({
  eventLogTable: 'ams_event_journal',    // Event entries table
  remotesTable: 'ams_event_remotes',     // Remote sync tracking
})

// 2. Identity Layer (for encryption)
export const IdentityLayer = Layer.succeed(
  EventLog.Identity,
  EventLog.Identity.makeRandom()
)

// 3. EventLog Layer (high-level API)
export const EventLogLayer = EventLog.layer(AmsEventLogSchema)

// 4. Combined Stack (EventJournal + Identity + EventLog)
export const EventLogStackLayer = EventLogLayer.pipe(
  Layer.provide(SqlEventJournalLayer),
  Layer.provide(IdentityLayer),
)
```

**Database Tables Created:**

```sql
-- Event entries table (created by SqlEventJournal)
CREATE TABLE IF NOT EXISTS ams_event_journal (
  id             BYTEA PRIMARY KEY,      -- UUID v7 (16 bytes)
  event          TEXT NOT NULL,          -- Event tag
  primary_key    TEXT NOT NULL,          -- Entity identity
  payload        BYTEA NOT NULL,         -- MsgPack-encoded payload
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_event_journal_event ON ams_event_journal(event);
CREATE INDEX idx_event_journal_pk ON ams_event_journal(primary_key);

-- Remote sync tracking
CREATE TABLE IF NOT EXISTS ams_event_remotes (
  remote_id      TEXT PRIMARY KEY,
  sequence       BIGINT NOT NULL DEFAULT 0
);
```

**Full Layer Composition:**

```typescript
// Production layer with PostgreSQL
export const ProductionEventLogLayer = Layer.mergeAll(
  EventLogStackLayer,           // EventLog + SqlEventJournal + Identity
  AssetEventHandlers,           // Projection handlers
  EventLog.groupReactivity(     // Reactive query invalidation
    AssetEvents,
    ['assets']
  ),
).pipe(
  Layer.provide(PgClientLayer)  // PostgreSQL connection
)

// Test layer with in-memory journal
export const TestEventLogLayer = Layer.mergeAll(
  EventLog.layer(AmsEventLogSchema),
  EventJournal.layerMemory,
  IdentityLayer,
  AssetEventHandlers,
)
```

---

### 6. Event Sourcing Flow Diagram

```
+---------------------------------------------------------------------+
|                     EVENT SOURCING FLOW                              |
+---------------------------------------------------------------------+
|                                                                     |
|  1. COMMAND (Entity Handler)                                        |
|     +-----------------------------------------------------+         |
|     |  CreateAsset: (envelope) => Effect.gen(...)        |         |
|     |    -> state.create(...)     // Business logic      |         |
|     |    -> maybeEmit('AssetCreated', payload)           |         |
|     |    -> return asset                                 |         |
|     +-----------------------------------------------------+         |
|                           |                                         |
|                           v                                         |
|  2. EVENT WRITE (EventLog.write)                                    |
|     +-----------------------------------------------------+         |
|     |  EventLog.makeClient(schema)                       |         |
|     |  write('AssetCreated', payload)                    |         |
|     |    -> encode payload (MsgPack)                     |         |
|     |    -> generate UUID v7 (time-ordered)              |         |
|     |    -> journal.write({ event, primaryKey, ... })    |         |
|     +-----------------------------------------------------+         |
|                           |                                         |
|                           v                                         |
|  3. JOURNAL PERSISTENCE (SqlEventJournal)                           |
|     +-----------------------------------------------------+         |
|     |  INSERT INTO ams_event_journal                     |         |
|     |    (id, event, primary_key, payload)               |         |
|     |  VALUES ($1, $2, $3, $4)                           |         |
|     |                                                     |         |
|     |  (Same transaction as handler effect)              |         |
|     +-----------------------------------------------------+         |
|                           |                                         |
|                           v                                         |
|  4. HANDLER EXECUTION (EventLog.group)                              |
|     +-----------------------------------------------------+         |
|     |  handlers.handle('AssetCreated', ({ payload })     |         |
|     |    -> update projections                           |         |
|     |    -> trigger notifications                        |         |
|     |    -> invalidate reactive queries                  |         |
|     +-----------------------------------------------------+         |
|                           |                                         |
|                           v                                         |
|  5. REACTIVITY INVALIDATION                                         |
|     +-----------------------------------------------------+         |
|     |  Reactivity.invalidate(['assets', assetId])        |         |
|     |    -> UI streams auto-refresh                      |         |
|     +-----------------------------------------------------+         |
|                                                                     |
+---------------------------------------------------------------------+
```

---

### 7. Transactional Outbox Pattern

The `SqlEventJournal.write()` method executes the handler effect WITHIN the same database transaction as the event persistence:

```typescript
// Pseudocode of what happens in SqlEventJournal.write()
const write = ({ event, primaryKey, payload, effect }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient

    yield* sql.withTransaction(
      Effect.gen(function* () {
        // 1. Insert event entry
        yield* sql`
          INSERT INTO ams_event_journal (id, event, primary_key, payload)
          VALUES (${generateUuidV7()}, ${event}, ${primaryKey}, ${payload})
        `

        // 2. Execute handler effect (projections, side effects)
        const result = yield* effect(entry)

        // 3. If handler fails, transaction rolls back (including event)
        return result
      })
    )
  })
```

**Benefits:**
- **Atomicity** — Event and projection update succeed or fail together
- **No lost events** — Event persisted even if notification fails
- **Replayable** — On startup, replay all events to rebuild state
- **Sync-ready** — Events are the sync primitive

---

### 8. Pattern Catalog for v3

#### Pattern 1: EventGroup Definition

```typescript
export const {Entity}Events = EventGroup.empty
  .add({
    tag: '{Entity}Created',
    payload: {Entity}CreatedPayload,
    primaryKey: (p) => p.{entity}Id,
  })
  .add({
    tag: '{Entity}Updated',
    payload: {Entity}UpdatedPayload,
    primaryKey: (p) => p.{entity}Id,
  })
  .add({
    tag: '{Entity}Deleted',
    payload: {Entity}DeletedPayload,
    primaryKey: (p) => p.{entity}Id,
  })
```

#### Pattern 2: EventLogSchema Composition

```typescript
export const AppEventLogSchema = EventLog.schema(
  AssetEvents,
  SiteEvents,
  ContainerEvents,
  // ... all domain groups
)
```

#### Pattern 3: maybeEmit Helper

```typescript
const eventLogOption = yield* Effect.serviceOption(EventLog.EventLog)
const writeEvent = Option.isSome(eventLogOption)
  ? yield* EventLog.makeClient(AppSchema)
  : null

const maybeEmit = (tag, payload) =>
  writeEvent
    ? writeEvent(tag, payload).pipe(Effect.catchAll(() => Effect.void))
    : Effect.void
```

#### Pattern 4: EventLog.group Handler

```typescript
export const {Entity}EventHandlers = EventLog.group({Entity}Events, (handlers) =>
  Effect.gen(function* () {
    const projection = yield* {Entity}Projection

    return handlers
      .handle('{Entity}Created', ({ payload, entry, conflicts }) =>
        Effect.gen(function* () {
          if (conflicts.length > 0) { /* resolve conflicts */ }
          yield* projection.handleCreated(payload)
          return void 0
        })
      )
  })
)
```

#### Pattern 5: SqlEventJournal Stack

```typescript
export const EventLogStackLayer = EventLog.layer(AppSchema).pipe(
  Layer.provide(SqlEventJournal.layer({
    eventLogTable: '{module}_event_journal',
    remotesTable: '{module}_event_remotes',
  })),
  Layer.provide(Layer.succeed(EventLog.Identity, EventLog.Identity.makeRandom())),
)
```

---

### 9. Recommendations for v3

1. **Make EventLog mandatory in production** — Optional only for unit tests
2. **Use SqlEventJournal for PostgreSQL** — `@effect/sql/SqlEventJournal`
3. **Event handlers update projections** — EventLog.group handlers maintain read models
4. **Reactivity for UI** — `EventLog.groupReactivity()` auto-invalidates queries
5. **Conflict detection** — Use `conflicts` array for concurrent write handling
6. **Compaction for large logs** — `EventLog.groupCompaction()` for event compression

---

### 10. Open Questions

1. **Event sourcing as primary source of truth?** — Should state be derived purely from event replay, or is dual-write (state + events) acceptable?

2. **Projection rebuild strategy** — How to rebuild projections from event log after schema changes?

3. **Event versioning** — How to handle event schema evolution (v1 -> v2 payloads)?

4. **Cross-aggregate events** — How should events that span multiple entities be handled?

5. **EventLog compaction frequency** — When and how often to run compaction?

---

**READY FOR SYNTHESIS**

---

## Thread: Entity-Weaver

### Executive Summary

AMS v2 implements a **profile-scoped CQRS architecture** using Effect Cluster's Entity system. The entity layer provides the command/query boundary, orchestrating state services and event emission. Key insight: **Entities are RPC group aggregators** — they consolidate all commands and queries for a domain concept, while delegating actual work to injected services.

### 1. Entity Definition Pattern

#### 1.1 Core Structure

Entities use `Entity.make()` from `@effect/cluster` to define RPC groups:

```typescript
// Location: src/lib/ams/v2/base/entities/asset.ts

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

**Pattern anatomy:**
- First argument: Entity name (string identifier)
- Second argument: Array of RPC classes
- Returns: Entity type with `.toLayer()`, `.toHttp()`, `.toRpcProxy()` methods

#### 1.2 RPC Definition Pattern

All RPCs use `Rpc.make()` from `@effect/rpc`:

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
```

**RPC characteristics:**
| Field | Type | Purpose |
|-------|------|---------|
| `payload` | Schema.Struct | Input parameters (Effect Schemas) |
| `success` | Schema | Success response type |
| `error` | Schema.Union | All possible error types |

**Naming convention:** RPC class name = Operation + "Rpc" suffix (e.g., `CreateAssetRpc`)

### 2. Handler Registration Pattern

#### 2.1 Entity.toLayer()

Handlers are registered via `Entity.toLayer()`:

```typescript
// Location: src/lib/ams/v2/base/handlers/asset.ts

export const AssetEntityHandlers = AssetEntity.toLayer(
  Effect.gen(function* () {
    // Dependency injection
    const state = yield* AssetState
    
    // Optional EventLog
    const eventLogOption = yield* Effect.serviceOption(EventLog.EventLog)
    const writeEvent = Option.isSome(eventLogOption)
      ? yield* EventLog.makeClient(AmsEventLogSchema)
      : null

    // Event emission helper
    const maybeEmit = <T>(
      tag: Parameters<NonNullable<typeof writeEvent>>[0],
      payload: Parameters<NonNullable<typeof writeEvent>>[1]
    ) =>
      writeEvent
        ? writeEvent(tag, payload).pipe(Effect.catchAll(() => Effect.void))
        : Effect.void

    // Handler map (RPC name → handler function)
    return {
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

      // Query handlers (no event emission)
      GetAsset: (envelope) => state.findById(envelope.payload.assetId),
      
      SearchAssets: (envelope) => state.search({
        query: envelope.payload.query,
        siteId: envelope.payload.siteId,
        // ...
      }),
    }
  }),
  // Retry policy for defects
  { defectRetryPolicy: Schedule.exponential('100 millis', 2).pipe(Schedule.upTo('10 seconds')) }
)
```

**Key patterns:**

| Pattern | Description | Example |
|---------|-------------|---------|
| Service injection | `yield* ServiceName` | `yield* AssetState` |
| Optional service | `Effect.serviceOption(Svc)` | EventLog is optional |
| Event emission | Non-blocking, swallowed on failure | `maybeEmit(tag, payload)` |
| Handler envelope | `(envelope) => Effect<...>` | `envelope.payload` for input |
| Defect retry | Exponential backoff | 100ms → 200ms → ... up to 10s |

#### 2.2 Handler Responsibilities

**Commands:**
1. Call state service with payload
2. Emit domain event (if EventLog available)
3. Return result

**Queries:**
1. Delegate directly to state service
2. NO event emission
3. Return result

### 3. Service Injection in Handlers

#### 3.1 State Service Pattern

Handlers inject an abstract `AssetState` service:

```typescript
export class AssetState extends Effect.Service<AssetState>()('@gbg/tmnl/ams/v2/AssetState', {
  effect: Effect.gen(function* () {
    // In-memory implementation (test default)
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

#### 3.2 Swappable Implementations

The same service interface has multiple implementations:

| Implementation | Layer | Storage | Use Case |
|---------------|-------|---------|----------|
| `AssetState.Default` | In-memory | `Ref<HashMap>` | Unit tests |
| `AssetStateSQLLayer` | SQL-backed | Repositories | Integration, production |

**SQL implementation:**
```typescript
export const AssetStateSQLLayer = Layer.effect(
  AssetState,
  Effect.gen(function* () {
    const assetRepo = yield* AssetRepository
    const propertyRepo = yield* AssetPropertyRepository
    const traitRepo = yield* AssetTraitRepository
    const sql = yield* SqlClient.SqlClient

    const create: AssetStateShape['create'] = (params) =>
      Effect.gen(function* () {
        const id = generateAssetId()
        const model = yield* assetRepo.insert(AssetModel.insert.make({
          id, kind: params.kind, label: params.label, // ...
        }))
        return modelToAsset(model)
      })

    // ... more methods

    return { create, update, move, findById, /* ... */ } satisfies AssetStateShape
  })
)
```

### 4. BFO Ontology Integration

All entities include a `bfoClass` field for formal ontological classification:

```typescript
export class Asset extends Schema.TaggedClass<Asset>()('Asset', {
  id: AssetId,
  bfoClass: BfoMaterialEntity, // Always 'material_entity' for assets
  kind: AssetKind,
  label: AssetLabel,
  // ...
}) {}
```

**BFO class literals:**
```typescript
export const BfoMaterialEntity = Schema.Literal('material_entity').pipe(
  Schema.brand('@gbg/tmnl/ams/v2/Bfo/literals/MaterialEntity'),
  Schema.annotations({ description: 'BFO class: material entity' })
)
```

**Entity-to-BFO mapping:**
| Entity | BFO Class | Description |
|--------|-----------|-------------|
| Asset | `material_entity` | Physical objects |
| Site | `site` | Locations |
| Sector | `site` | Sub-locations |
| Container | `material_entity` | Physical containers |

### 5. Layer Composition Patterns

#### 5.1 Deployment Profiles

AMS v2 provides four deployment profiles:

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
    Layer.provide(AssetStateWithRepos),
    Layer.provide(EventLogWithSqlite)
  ),
  EventHandlersWithDeps,
  RepositoriesWithSqlite,
  EventLogWithSqlite
)
```

**makeTauriLayer (SQLite File):**
```typescript
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

**makeClusterLayer (PostgreSQL):**
```typescript
export const makeClusterLayer = <E, R>(
  postgresLayer: Layer.Layer<SqlClient.SqlClient, E, R>
) => { /* identical structure to makeTauriLayer */ }
```

#### 5.2 Runtime Configuration

Environment-driven layer selection:

```typescript
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

### 6. Complete Entity Definition Flow for v3

Based on the v2 patterns, here is the recommended entity definition flow for v3:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ENTITY DEFINITION FLOW                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  1. SCHEMA LAYER                                                    │
│     ┌─────────────────────────────────────────────────┐             │
│     │  schemas/                                       │             │
│     │  ├── {entity}.ts       # Entity schema         │             │
│     │  ├── identifiers.ts    # Branded IDs           │             │
│     │  └── provenance.ts     # Audit trail           │             │
│     └─────────────────────────────────────────────────┘             │
│                           │                                         │
│                           ▼                                         │
│  2. ERRORS LAYER                                                    │
│     ┌─────────────────────────────────────────────────┐             │
│     │  errors/                                        │             │
│     │  └── {entity}.ts       # Error schemas         │             │
│     │      ├── {Entity}NotFoundError                 │             │
│     │      ├── {Entity}ValidationError               │             │
│     │      ├── {Entity}ConflictError                 │             │
│     │      └── {Entity}CommandError (union)          │             │
│     └─────────────────────────────────────────────────┘             │
│                           │                                         │
│                           ▼                                         │
│  3. ENTITY LAYER (RPC Definitions)                                  │
│     ┌─────────────────────────────────────────────────┐             │
│     │  entities/                                      │             │
│     │  └── {entity}.ts                               │             │
│     │      ├── CreateRpc, UpdateRpc, DeleteRpc       │             │
│     │      ├── GetRpc, ListRpc, SearchRpc            │             │
│     │      └── Entity.make('{Entity}', [...rpcs])    │             │
│     └─────────────────────────────────────────────────┘             │
│                           │                                         │
│                           ▼                                         │
│  4. SERVICE LAYER (State Abstraction)                               │
│     ┌─────────────────────────────────────────────────┐             │
│     │  services/                                      │             │
│     │  ├── {entity}-state.ts        # In-memory     │             │
│     │  ├── {entity}-state-shape.ts  # Interface     │             │
│     │  └── {entity}-state-sql.ts    # SQL-backed    │             │
│     └─────────────────────────────────────────────────┘             │
│                           │                                         │
│                           ▼                                         │
│  5. EVENTS LAYER (Domain Events)                                    │
│     ┌─────────────────────────────────────────────────┐             │
│     │  events/                                        │             │
│     │  ├── {entity}.ts       # Event payloads        │             │
│     │  │   ├── {Entity}CreatedPayload                │             │
│     │  │   ├── {Entity}UpdatedPayload                │             │
│     │  │   └── {Entity}DeletedPayload                │             │
│     │  └── schema.ts         # EventLog schema       │             │
│     │      └── EventLog.makeSchema({...})            │             │
│     └─────────────────────────────────────────────────┘             │
│                           │                                         │
│                           ▼                                         │
│  6. HANDLER LAYER (Entity Behavior)                                 │
│     ┌─────────────────────────────────────────────────┐             │
│     │  handlers/                                      │             │
│     │  ├── {entity}.ts       # Entity handlers       │             │
│     │  │   └── Entity.toLayer(Effect.gen(...))       │             │
│     │  └── event-handlers.ts # Event subscribers     │             │
│     │      └── EventLog.subscribe(...)               │             │
│     └─────────────────────────────────────────────────┘             │
│                           │                                         │
│                           ▼                                         │
│  7. LAYER COMPOSITION                                               │
│     ┌─────────────────────────────────────────────────┐             │
│     │  layers/                                        │             │
│     │  ├── deployments.ts    # TestLayer, SqlTestLayer│             │
│     │  └── runtime.ts        # AmsRuntimeLayer       │             │
│     └─────────────────────────────────────────────────┘             │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 7. Pattern Catalog

#### Pattern 1: Entity Definition
```typescript
export const {Entity}Entity = Entity.make('{Entity}', [
  Create{Entity}Rpc,
  Update{Entity}Rpc,
  Delete{Entity}Rpc,
  Get{Entity}Rpc,
  List{Entity}sRpc,
  Search{Entity}sRpc,
])
```

#### Pattern 2: RPC Definition
```typescript
export class {Operation}Rpc extends Rpc.make('{Operation}', {
  payload: { /* Effect Schemas */ },
  success: SuccessSchema,
  error: ErrorSchema,
}) {}
```

#### Pattern 3: Entity Handler Layer
```typescript
export const {Entity}EntityHandlers = {Entity}Entity.toLayer(
  Effect.gen(function* () {
    const state = yield* {Entity}State
    const eventLogOption = yield* Effect.serviceOption(EventLog.EventLog)
    const writeEvent = Option.isSome(eventLogOption)
      ? yield* EventLog.makeClient({Entity}EventSchema)
      : null

    const maybeEmit = (tag, payload) =>
      writeEvent
        ? writeEvent(tag, payload).pipe(Effect.catchAll(() => Effect.void))
        : Effect.void

    return {
      Create{Entity}: (envelope) => Effect.gen(function* () {
        const entity = yield* state.create(envelope.payload)
        yield* maybeEmit('{Entity}Created', new {Entity}CreatedPayload({ ... }))
        return entity
      }),
      Get{Entity}: (envelope) => state.findById(envelope.payload.id),
      // ...
    }
  }),
  { defectRetryPolicy: Schedule.exponential('100 millis', 2).pipe(Schedule.upTo('10 seconds')) }
)
```

#### Pattern 4: Service with Swappable Implementation
```typescript
// Interface (shape)
export interface {Entity}StateShape {
  create: (params: CreateParams) => Effect.Effect<Entity, CreateError>
  findById: (id: EntityId) => Effect.Effect<Entity, NotFoundError>
  // ...
}

// Default (in-memory)
export class {Entity}State extends Effect.Service<{Entity}State>()(
  '@gbg/tmnl/ams/v3/{Entity}State',
  {
    effect: Effect.gen(function* () {
      const store = yield* Ref.make(HashMap.empty<EntityId, Entity>())
      return { /* in-memory implementation */ } satisfies {Entity}StateShape
    }),
  }
) {}

// SQL-backed
export const {Entity}StateSQLLayer = Layer.effect(
  {Entity}State,
  Effect.gen(function* () {
    const repo = yield* {Entity}Repository
    return { /* SQL implementation */ } satisfies {Entity}StateShape
  })
)
```

#### Pattern 5: Deployment Layer Factory
```typescript
export const make{Entity}Stack = <E, R>(
  sqlLayer: Layer.Layer<SqlClient.SqlClient, E, R>
) => {
  const repos = All{Entity}RepositoriesLive.pipe(Layer.provide(sqlLayer))
  const state = {Entity}StateSQLLayer.pipe(
    Layer.provide(repos),
    Layer.provide(sqlLayer)
  )
  const eventLog = {Entity}EventLogStackLayer.pipe(Layer.provide(sqlLayer))

  return Layer.mergeAll(
    {Entity}EntityHandlers.pipe(
      Layer.provide(state),
      Layer.provide(eventLog)
    ),
    repos,
    eventLog
  )
}
```

#### Pattern 6: EventGroup Definition
```typescript
export const {Entity}Events = EventGroup.empty
  .add({
    tag: '{Entity}Created',
    payload: {Entity}CreatedPayload,
    primaryKey: (payload) => payload.{entity}Id,
  })
  .add({
    tag: '{Entity}Updated',
    payload: {Entity}UpdatedPayload,
    primaryKey: (payload) => payload.{entity}Id,
  })
  .add({
    tag: '{Entity}Deleted',
    payload: {Entity}DeletedPayload,
    primaryKey: (payload) => payload.{entity}Id,
  })
```

### 8. Recommendations for v3 Spec

#### 8.1 Consolidate RPC Definitions

**Problem:** v2 has redundant command/query files that duplicate RPC definitions.

**Recommendation:**
- Keep ONLY entity file (`entities/{entity}.ts`) for RPC definitions
- Extract error schemas to separate `errors/{entity}.ts` file
- Remove `commands/` and `queries/` directories

**v3 structure:**
```
entities/
├── asset.ts         # Entity + all RPCs
└── index.ts         # Re-exports

errors/
├── asset.ts         # Error schemas only
└── index.ts         # Re-exports
```

#### 8.2 Make EventLog Mandatory in Production

**Problem:** Optional EventLog leads to dual-write inconsistency.

**Recommendation:**
- EventLog REQUIRED for production (`cluster`, `tauri` modes)
- EventLog OPTIONAL for test mode only
- Add schema annotation to indicate event requirement

```typescript
export const AmsMode = Schema.Literal('test', 'sql-test', 'tauri', 'cluster')

const eventLogRequired = (mode: AmsMode): boolean =>
  mode !== 'test'

export const makeEntityHandlers = (mode: AmsMode) =>
  eventLogRequired(mode)
    ? AssetEntityHandlers // EventLog required
    : AssetEntityHandlersNoEvents // EventLog optional
```

#### 8.3 Simplify Layer Composition

**Problem:** Layer wiring is verbose and error-prone.

**Recommendation:**
- Provide high-level factory functions
- Auto-wire common dependencies
- Better error messages for missing dependencies

```typescript
// v3: Simplified factory
export const makeAmsStack = (config: {
  mode: AmsMode
  sql?: Layer.Layer<SqlClient.SqlClient>
}) => {
  const { mode, sql } = config
  
  switch (mode) {
    case 'test':
      return TestLayer
    case 'sql-test':
      return SqlTestLayer
    case 'tauri':
      if (!sql) throw new Error('Tauri mode requires sql layer')
      return makeTauriLayer(sql)
    case 'cluster':
      if (!sql) throw new Error('Cluster mode requires sql layer')
      return makeClusterLayer(sql)
  }
}
```

#### 8.4 Add Transport Adapters

**Capability:** Effect Cluster entities support multiple transports.

**v3 should expose:**
```typescript
// HTTP transport
export const AssetHttpRoutes = AssetEntity.toHttp({
  prefix: '/api/v3/assets',
})

// RPC proxy (for cluster communication)
export const AssetRpcProxy = AssetEntity.toRpcProxy()
```

#### 8.5 Type-Safe Tag Values

**Problem:** Event tags are string literals, not type-safe.

**Recommendation:**
```typescript
// v3: Type-safe event tags
export const AssetEventTag = Schema.Literal(
  'AssetCreated',
  'AssetUpdated',
  'AssetMoved',
  'AssetDeleted'
)
type AssetEventTag = typeof AssetEventTag.Type

// Usage
const maybeEmit = (tag: AssetEventTag, payload: ...) => ...
```

### 9. How Entities Compose with Services and Repos

```
┌─────────────────────────────────────────────────────────────────────┐
│                     COMPOSITION HIERARCHY                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Entity Handlers (CQRS boundary)                                    │
│  └── {Entity}Entity.toLayer(...)                                    │
│      │                                                              │
│      ├── State Service (business logic)                             │
│      │   └── {Entity}State | {Entity}StateSQLLayer                  │
│      │       │                                                      │
│      │       ├── In-Memory: Ref<HashMap>                            │
│      │       │                                                      │
│      │       └── SQL-Backed:                                        │
│      │           ├── {Entity}Repository                             │
│      │           │   └── Model.makeRepository({Entity}Model)        │
│      │           │       └── SqlClient.SqlClient                    │
│      │           │                                                  │
│      │           └── Related repositories...                        │
│      │                                                              │
│      └── EventLog (optional, audit trail)                           │
│          └── EventLog.EventLog                                      │
│              ├── EventLog.makeClient({Entity}EventSchema)           │
│              └── SqlEventJournal (persistence)                      │
│                  └── SqlClient.SqlClient                            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key insight:** Entities orchestrate but don't own state. State services own the data; repositories own the persistence; EventLog owns the audit trail. Entities just wire them together.

### 10. Layer Dependency Tree

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
```

### 11. File Structure for v3

```
src/lib/ams/v3/base/
├── schemas/                    # Domain models
│   ├── asset.ts               # Asset, AssetSummary, AssetStatus
│   ├── property.ts            # AssetProperty, PropertyValue
│   ├── location.ts            # AssetLocation
│   └── trait.ts               # AssetTraits, TraitInstance
│
├── errors/                     # Error schemas (NEW in v3)
│   └── asset.ts               # AssetNotFoundError, AssetCommandError, etc.
│
├── entities/                   # Entity + RPC definitions
│   ├── asset.ts               # AssetEntity + all RPCs
│   └── index.ts               # Re-exports
│
├── handlers/                   # Entity behavior
│   ├── asset.ts               # AssetEntityHandlers
│   ├── event-handlers.ts      # EventLog subscribers
│   └── index.ts               # Re-exports
│
├── services/                   # State services
│   ├── asset-state.ts         # In-memory implementation
│   ├── asset-state-shape.ts   # Interface
│   ├── asset-state-sql.ts     # SQL implementation
│   └── index.ts               # Re-exports
│
├── repositories/               # @effect/sql models
│   ├── asset.ts               # AssetModel, AssetPropertyModel, etc.
│   ├── sqlite-layer.ts        # SQLite client + migrations
│   └── index.ts               # Re-exports
│
├── events/                     # Domain events
│   ├── asset.ts               # Event payloads
│   ├── schema.ts              # AmsEventLogSchema
│   └── index.ts               # Re-exports
│
└── layers/                     # Deployment composition
    ├── deployments.ts         # TestLayer, SqlTestLayer, make*Layer
    ├── runtime.ts             # AmsRuntimeLayer
    └── index.ts               # Re-exports
```

### 12. Open Questions for v3

1. **Event sourcing as primary?** Should EventLog be the source of truth, with state derived from event replay?

2. **Profile composition?** How do WMS + TMS profiles compose when deployed together? Separate entity namespaces?

3. **ID management service?** Need centralized `IdManagementService` for UUID generation and human-readable label mapping.

4. **Dynamic schema extensions?** How do profiles add new `AssetKind` values without code changes?

5. **Transport adapters?** Should v3 expose HTTP routes and RPC proxies by default, or only on demand?

---

**READY FOR SYNTHESIS**

---

## Thread: Infra-Smith

### Section 7: Infrastructure Architecture

I have completed comprehensive analysis of the infrastructure patterns from `iiot-models.md`, `iiot-seed.md`, and `iiot-tests.md`. This section covers DDL co-location, PostgreSQL extensions, migration systems, seeding infrastructure, and test layer composition.

---

### 7.1 DDL Co-location Pattern

**Core Principle:** Each Model has an adjacent `.ddl.ts` file containing Effect-wrapped DDL statements.

**Directory Structure:**
```
src/lib/iiot/models/
├── _common.ts                  # Shared transforms (CreatedAt, UpdatedAt)
├── _infrastructure.ddl.ts      # Extensions, schema, graph
├── _functions.ddl.ts           # Helper functions
├── _graph-seed.ddl.ts          # Initial graph data
├── _migrations.ts              # Aggregated migration record
│
├── assets/
│   ├── PlantModel.ts           # Model.Class
│   ├── PlantModel.ddl.ts       # CREATE TABLE DDL
│   └── ...                     # (Line, Machine, Sensor)
│
├── readings/
│   ├── SensorReadingModel.ts
│   ├── SensorReadingModel.ddl.ts   # Hypertable + continuous aggs
│   └── AnalyticsRecordModel.ddl.ts # pg_lake Iceberg
│
└── alarms/
    ├── AlarmModel.ts
    ├── AlarmModel.ddl.ts           # Table + graph trigger
    └── AlarmContextModel.ddl.ts    # Materialized view
```

**DDL File Pattern:**
```typescript
// EntityModel.ddl.ts
import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const createEntityTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.entity (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  yield* sql`CREATE INDEX IF NOT EXISTS idx_entity_name ON iiot.entity (name)`
})
```

**Benefits:**
- DDL lives adjacent to Model (atomic commits)
- Version-controlled alongside schema changes
- Composable via Effect.gen
- Idempotent via `IF NOT EXISTS`

---

### 7.2 PostgreSQL Extension Setup

**Required Extensions (in order):**

| Extension | Purpose | Installation |
|-----------|---------|--------------|
| `timescaledb` | Time-series hypertables, continuous aggregates | `CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE` |
| `age` | Graph database (Apache AGE) | `CREATE EXTENSION IF NOT EXISTS age` |
| `pg_lake` | Iceberg analytics (optional) | Graceful degradation pattern |
| `pg_stat_statements` | Query monitoring | `CREATE EXTENSION IF NOT EXISTS pg_stat_statements` |
| `btree_gist` | GiST index support | `CREATE EXTENSION IF NOT EXISTS btree_gist` |

**Extension DDL Pattern:**
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
})
```

**Graceful Degradation Pattern:**
```sql
DO $$
BEGIN
    EXECUTE 'CREATE TABLE ... USING iceberg ...';
    RAISE NOTICE 'Created as Iceberg table';
EXCEPTION WHEN OTHERS THEN
    CREATE TABLE ... (regular table);
    RAISE NOTICE 'Created as regular table (pg_lake not available)';
END $$
```

---

### 7.3 TimescaleDB Patterns

#### 7.3.1 Hypertable Creation

```typescript
export const createSensorReadingsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Base table with composite PK
  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.sensor_readings (
      time        TIMESTAMPTZ NOT NULL,
      device_id   TEXT NOT NULL,
      value       DOUBLE PRECISION NOT NULL,
      quality     INTEGER DEFAULT 100,
      CONSTRAINT sensor_readings_pkey PRIMARY KEY (time, device_id)
    )
  `

  // Convert to hypertable (1-day chunks)
  yield* sql.unsafe(`SELECT create_hypertable('iiot.sensor_readings', by_range('time', INTERVAL '1 day'), if_not_exists => TRUE)`)

  // Add space partition (hash by device_id)
  yield* sql.unsafe(`SELECT add_dimension('iiot.sensor_readings', by_hash('device_id', 4), if_not_exists => TRUE)`)

  // Indexes
  yield* sql`CREATE INDEX IF NOT EXISTS idx_readings_device ON iiot.sensor_readings (device_id, time DESC)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_readings_quality ON iiot.sensor_readings (quality) WHERE quality < 100`
})
```

#### 7.3.2 Continuous Aggregates

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

  // Refresh policy
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

#### 7.3.3 Compression & Retention Policies

```typescript
export const createCompressionPolicies = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  // Enable compression
  yield* sql.unsafe(`
    ALTER TABLE iiot.sensor_readings SET (
      timescaledb.compress,
      timescaledb.compress_segmentby = 'device_id',
      timescaledb.compress_orderby = 'time DESC'
    )
  `)

  // Compress after 7 days
  yield* sql.unsafe(`SELECT add_compression_policy('iiot.sensor_readings', INTERVAL '7 days', if_not_exists => TRUE)`)

  // Retention: drop raw data after 30 days
  yield* sql.unsafe(`SELECT add_retention_policy('iiot.sensor_readings', INTERVAL '30 days', if_not_exists => TRUE)`)
})
```

---

### 7.4 Apache AGE Graph Patterns

#### 7.4.1 Graph Creation

```typescript
export const createGraph = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(`SELECT create_graph('iiot_graph')`)
})
```

#### 7.4.2 Idempotent Graph Seeding (MERGE)

```typescript
export const seedPlantNodes = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql.unsafe(`SET search_path = ag_catalog, "$user", public`)

  yield* sql.unsafe(`
    SELECT * FROM cypher('iiot_graph', $$
      MERGE (:plant {id: 'PLANT-A', name: 'Chicago Assembly', location: 'Chicago, IL'})
    $$) AS (v agtype)
  `)
})
```

#### 7.4.3 Graph Trigger Pattern (Alarm to Graph)

```typescript
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

---

### 7.5 Migration System (Migrator.fromRecord)

**Migration Record Pattern:**
```typescript
// _migrations.ts
import { Effect } from 'effect'
import { Migrator } from '@effect/sql'

export const iiotMigrations = {
  // Infrastructure (first)
  '0001_extensions': createExtensions,
  '0002_schema_and_graph': Effect.all([createSchema, createGraph], { discard: true }),

  // Asset tables (FK order: plants -> lines -> machines -> sensors)
  '0003_asset_tables': Effect.gen(function* () {
    yield* createPlantsTable
    yield* createLinesTable
    yield* createMachinesTable
    yield* createSensorsTable
  }),

  // Time-series infrastructure
  '0004_sensor_readings_hypertable': createSensorReadingsTable,
  '0005_continuous_aggregates': Effect.all([
    createReadings1MinAggregate,
    createReadings1HourAggregate,
  ], { discard: true }),
  '0006_compression_retention': createCompressionPolicies,

  // Alarms
  '0008_alarms_table': createAlarmsTable,
  '0009_alarm_graph_trigger': createAlarmGraphTrigger,

  // Permissions
  '0011_permissions': grantPermissions,
} as const

export const iiotMigrationLoader = Migrator.fromRecord(iiotMigrations)
```

**Migration Loader Usage:**
```typescript
import { PgMigrator } from '@effect/sql-pg'

const MigratorLive = PgMigrator.layer({
  loader: iiotMigrationLoader,
  schemaDirectory: 'src/lib/iiot/migrations',
})
```

**Key Principles:**
1. Sequential numbering (`0001`, `0002`, etc.)
2. FK order respected (parents before children)
3. Infrastructure first (extensions, schema, graph)
4. All DDL uses `IF NOT EXISTS` for idempotency
5. Composition via `Effect.all` or `Effect.gen`

---

### 7.6 Seeding Infrastructure

#### 7.6.1 Tiered Seeding Approach

| Tier | Domain | Strategy | Performance |
|------|--------|----------|-------------|
| **Tier 1** | Assets, Alarms | Full repo validation | ~10 rows/s (small counts) |
| **Tier 2** | Readings | Mode-dependent | 70K+ rows/s (fast) / 500 rows/s (validated) |

#### 7.6.2 SeedMode Configuration

```typescript
export type SeedMode = 'fast' | 'validated'

export const SeedConfig = {
  mode: 'fast' as SeedMode,
  primarySensorRows: 100_000,
  secondarySensorRows: 50_000,
  validatedModeRows: 1_000,
  timeRangeDays: 30,
} as const
```

#### 7.6.3 Tier 1 Seeder Pattern (Repo-based)

```typescript
export const seedPlants = Effect.gen(function* () {
  const repo = yield* PlantRepo
  yield* Effect.log('Seeding plants...')
  yield* Effect.forEach(mockPlantInserts, (plant) =>
    repo.insert(plant).pipe(Effect.catchIf(isDuplicateKeyError, () => Effect.void)),
    { concurrency: 10 }
  )
  yield* Effect.log(`  - ${mockPlantInserts.length} plants seeded`)
})

const isDuplicateKeyError = (e: unknown): boolean => {
  if (typeof e !== 'object' || e === null) return false
  const err = e as { _tag?: string; cause?: { code?: string } }
  return err._tag === 'SqlError' && err.cause?.code === '23505'
}
```

#### 7.6.4 Tier 2 Seeder Pattern (Mode-dependent)

```typescript
export const seedMockReadings = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  const mode = SeedConfig.mode

  if (mode === 'validated') {
    // Full schema validation via repo.insertBatch
    const repo = yield* SensorReadingRepo
    const readings = generateTypedReadings(spec, SeedConfig.validatedModeRows)
    yield* repo.insertBatch(readings)
  } else {
    // Fast: PostgreSQL generate_series (no validation)
    yield* sql`
      INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
      SELECT
        NOW() - (random() * make_interval(days => ${timeRangeDays})),
        ${deviceId},
        ${valueMin} + (random() * ${valueRange}),
        CASE WHEN random() > ${qualityThreshold} THEN 100 ELSE 50 END
      FROM generate_series(1, ${rowCount})
    `
  }
})
```

#### 7.6.5 FK Dependency Ordering

```typescript
export const seedAssets = pipe(
  seedPlants,
  Effect.andThen(seedLines),
  Effect.andThen(seedMachines),
  Effect.andThen(seedSensors)
)
```

---

### 7.7 @gbg/ctl CLI Integration

#### 7.7.1 CLI Package Structure

```
src/lib/iiot/seed/ctl/
├── package.json        # "bin": { "iiot-seed": "dist/index.js" }
├── tsconfig.json
├── src/
│   └── index.ts        # CLI entry point
└── skills/
    ├── MANIFEST.json
    └── core/SKILL.md
```

#### 7.7.2 CLI Layer Composition

```typescript
const SeedPgClient = PgClient.layer({
  host: 'localhost',
  port: 5433,
  database: 'iiot_mock',
  username: 'iiot',
  password: Redacted.make('iiot_dev'),
  maxConnections: 5,
  transformResultNames,
})

const SeedMigratorLive = IIoTMigratorLive.pipe(Layer.provide(SeedPgClient))
const SeedPgClientWithMigrations = Layer.merge(SeedPgClient, SeedMigratorLive)

const FullSeedLayer = Layer.merge(
  SeedPgClientWithMigrations,
  IIoTRepositoriesLive.pipe(Layer.provide(SeedPgClientWithMigrations))
)
```

#### 7.7.3 Command Pattern (@effect/cli)

```typescript
const modeOption = Options.choice('mode', ['fast', 'validated']).pipe(
  Options.withAlias('m'),
  Options.withDefault('fast'),
  Options.withDescription('Seed mode: fast or validated')
)

const seedCommand = Command.make(
  'seed',
  { mode: modeOption, clear: clearOption },
  ({ mode, clear }) =>
    Effect.gen(function* () {
      yield* configureSeedMode(mode as SeedMode)
      if (clear) yield* clearMockData
      yield* seedAll
    })
).pipe(Command.withDescription('Seed the IIoT database'))

const cli = Command.run(iiotSeedCommand, { name: 'iiot-seed', version: '1.0.0' })

cli(process.argv).pipe(
  Effect.provide(FullSeedLayer),
  Effect.provide(NodeContext.layer),
  NodeRuntime.runMain
)
```

---

### 7.8 Test Infrastructure

#### 7.8.1 Test Layer Architecture

```typescript
// __tests__/integration/layer.ts

// Base database connection
export const TestPgClient = PgClient.layer({
  host: 'localhost',
  port: 5433,
  database: 'iiot_mock',
  username: 'iiot',
  password: Redacted.make('iiot_dev'),
  transformResultNames,
})

// Migration layer (auto-runs on build)
const TestMigratorLive = IIoTMigratorLive.pipe(Layer.provide(TestPgClient))
export const TestPgClientWithMigrations = Layer.merge(TestPgClient, TestMigratorLive)

// Repository layers
export const RepositoriesIntegrationLayer = IIoTRepositoriesLive.pipe(
  Layer.provide(TestPgClientWithMigrations)
)

// Full integration layer
export const FullIIoTIntegrationLayer = Layer.mergeAll(
  TestPgClientWithMigrations,
  TimeSeriesClientLayer,
  GraphClientLayer,
  RepositoriesIntegrationLayer
)
```

#### 7.8.2 Cleanup Utilities

```typescript
// FK-safe cleanup (children before parents)
export const cleanTestAssets = Effect.gen(function* () {
  const sql = yield* PgClient.PgClient
  yield* sql`DELETE FROM iiot.sensors WHERE device_id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.machines WHERE id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.lines WHERE id LIKE 'TEST-%'`
  yield* sql`DELETE FROM iiot.plants WHERE id LIKE 'TEST-%'`
})

export const withCleanDatabase = <A, E, R>(test: Effect.Effect<A, E, R>) =>
  Effect.gen(function* () {
    yield* cleanTestData
    return yield* test
  })
```

#### 7.8.3 @effect/vitest Pattern

```typescript
import { it } from '@effect/vitest'

it.effect('should insert plant', () =>
  Effect.gen(function* () {
    const repo = yield* PlantRepo
    const result = yield* repo.insert(testPlantInsert)
    expect(result.id).toBe('TEST-PLANT-001')
  }).pipe(Effect.provide(RepositoriesIntegrationLayer))
)
```

#### 7.8.4 RUN_INTEGRATION_TESTS Flag

```typescript
const RUN_INTEGRATION = process.env['RUN_INTEGRATION_TESTS'] === '1'

describe.skipIf(!RUN_INTEGRATION)('Repo Integration', () => {
  beforeAll(async () => {
    const available = await Effect.runPromise(isDatabaseAvailable.pipe(Effect.provide(TestPgClient)))
    if (!available) throw new Error('Database not available')
  })
  // tests...
})
```

---

### 7.9 Infrastructure Design Recommendations for v3

#### 7.9.1 DDL/Migration Strategy

1. **Preserve co-location** - Keep `Model.ts` + `Model.ddl.ts` adjacent
2. **Preserve Migrator.fromRecord** - Elegant, version-tracked, composable
3. **Add migration versioning metadata** - Track which migrations ran
4. **Consider DDL auto-generation** - Experimental: generate DDL from Model schema

#### 7.9.2 Extension Management

1. **Extension registry** - Catalog required extensions per module
2. **Graceful degradation everywhere** - All optional extensions use try/catch pattern
3. **Version constraints** - Specify minimum extension versions

#### 7.9.3 Seeding Strategy

1. **Preserve tiered approach** - Tier 1 (validated) + Tier 2 (fast)
2. **Add incremental seeding** - Append without full reseed
3. **Add seed versioning** - Track seed data schema versions
4. **Parameterized generators** - Runtime configuration of value ranges

#### 7.9.4 Test Infrastructure

1. **Preserve layer composition** - Composable, swappable implementations
2. **Preserve @effect/vitest** - Effect-native testing
3. **Add test fixtures** - Reusable typed fixtures per domain
4. **Add integration test CI** - RUN_INTEGRATION_TESTS in CI pipeline

---

### 7.10 Pattern Catalog Summary

| Pattern | Location | Purpose |
|---------|----------|---------|
| **DDL Co-location** | `Model.ddl.ts` | Effect-wrapped CREATE TABLE adjacent to Model |
| **Migrator.fromRecord** | `_migrations.ts` | Version-tracked schema evolution |
| **Extension Graceful Degradation** | `_infrastructure.ddl.ts` | Optional extensions don't block startup |
| **Hypertable Pattern** | `SensorReadingModel.ddl.ts` | TimescaleDB time-series chunking |
| **Continuous Aggregate Pattern** | `SensorReadingModel.ddl.ts` | Automatic rollup with refresh policy |
| **Compression/Retention Pattern** | `SensorReadingModel.ddl.ts` | Tiered storage lifecycle |
| **Graph Trigger Pattern** | `AlarmModel.ddl.ts` | Sync relational data to graph |
| **Tiered Seeding** | `mock-data.ts` | Fast vs validated seed modes |
| **Idempotent Seeding** | `mock-data.ts` | catchIf(isDuplicateKeyError) |
| **Test Layer Composition** | `layer.ts` | Swappable implementations for testing |
| **withCleanDatabase** | `layer.ts` | Effect-wrapped test cleanup |
| **RUN_INTEGRATION_TESTS** | `*.integration.test.ts` | Skip flag for slow tests |

---

**READY FOR SYNTHESIS**

---

## Thread: Architect-Prime

*Awaiting all threads to complete before synthesis...*

---

## Synthesis Log

*Final integration notes will appear here...*

---


---

## Synthesis Log

**Synthesizer**: Architect-Prime (Val)  
**Timestamp**: 2026-01-25T23:45:00Z  

### Input Documents Analyzed

| Document | Lines | Primary Contribution |
|----------|-------|---------------------|
| `iiot-schemas.md` | ~1,200 | Schema-first patterns, branded IDs, TaggedClass, Model derivation |
| `iiot-models.md` | ~1,350 | Model field types, DDL co-location, migration loader |
| `ams-v2-repositories.md` | ~1,650 | Decode utilities, Context.Tag repos, Option handling |
| `ams-v2-services.md` | ~1,500 | Effect.Service patterns, state management, Layer composition |
| `iiot-services.md` | ~1,700 | L1/L2/L3 architecture, Stream patterns, TimescaleDB/AGE integration |

**Total research corpus**: ~7,400 lines of analyzed patterns

### Key Architectural Decisions

1. **Merged IIoT + AMS patterns** — Schema-Model-Repo from IIoT, Entity-Event-Handler from AMS
2. **Manual repos over Model.makeRepository** — More control, explicit decode, better for complex queries
3. **DDL co-location** — Each Model.ts has adjacent Model.ddl.ts with Effect-wrapped CREATE TABLE
4. **Swappable state services** — Interface-based design enables in-memory (tests) vs SQL (production)
5. **EventLog as coordination point** — Events persist to PG Journal, handlers update projections
6. **PostgreSQL-first** — TimescaleDB for time-series, AGE for graphs, pg_lake for analytics

### Conflicts Resolved

| Conflict | Resolution |
|----------|------------|
| AMS uses `Model.makeRepository` | Use manual repos with decode utilities (more explicit) |
| IIoT lacks Entity abstraction | Adopt Effect Cluster Entity from AMS patterns |
| Different error patterns | Standardize on `Data.TaggedError` throughout |
| EventLog optional in IIoT | Make EventLog required in production, optional in tests |

### Synthesis Outputs

1. **`thoughts/shared/specs/2026-01-25-v3-service-architecture.md`** — Complete 800+ line specification
   - 14 major sections
   - 10 canonical patterns
   - 4-phase migration plan
   - 10 open questions for future resolution

2. **Pattern Catalog** — 10 reusable patterns with code examples:
   - Branded Identifier
   - TaggedClass Entity
   - Model Derivation
   - Repository Interface + Tag
   - Decode Utilities
   - EventGroup
   - Entity + RPC
   - Swappable State Service
   - DDL Co-location
   - Migration Record

3. **File Structure** — Complete v3 directory layout with 40+ files across:
   - schemas/ (domain logic)
   - errors/ (error types)
   - models/ (persistence)
   - repos/ (manual SQL)
   - entities/ (Effect Cluster)
   - handlers/ (entity + event)
   - services/ (state)
   - events/ (EventGroup)
   - layers/ (composition)

### Missing Council Contributions

The following council threads were marked "Awaiting contribution" but were synthesized from adjacent research documents:

| Thread | Synthesized From |
|--------|-----------------|
| Schema-Sage | `iiot-schemas.md`, `iiot-models.md` |
| Repo-Maven | `ams-v2-repositories.md`, `ams-v2-services.md` |
| Event-Oracle | `ams-v2-services.md`, `iiot-services.md` |

### Validation Status

- **Spec completeness**: All 14 sections populated
- **Code examples**: All patterns have TypeScript examples
- **Migration path**: 4-phase plan defined
- **Open questions**: 10 documented for future resolution

---

### Gap Analysis (Task #5)

**Analyst**: Gap Finder Agent
**Timestamp**: 2026-01-26T00:00:00Z

#### Council Contribution Status

| Thread | Status | Notes |
|--------|--------|-------|
| Schema-Sage | COMPLETE | Full contribution, verified patterns |
| Repo-Maven | COMPLETE | Full contribution, verified patterns |
| Event-Oracle | **MISSING** | Section 5 was synthesized by Architect-Prime, not Event-Oracle |
| Entity-Weaver | COMPLETE | Full contribution, verified patterns |
| Infra-Smith | COMPLETE | Full contribution, verified patterns |
| Architect-Prime | COMPLETE | Synthesis performed |

#### Identified Gaps

**GAP-1: Event-Oracle Thread Missing**
- Section 5 (Event Architecture) lacks direct council member contribution
- Synthesized from adjacent documents but without domain expert validation
- Missing: EventLog journal schema details, event replay patterns, event versioning

**GAP-2: Open Questions from Repo-Maven (4.11)**
- Dual-Database Support (SQLite tests + PostgreSQL prod)
- Batch Operations (insertBatch/updateBatch for seeding)
- Pagination patterns (cursor vs offset)
- Soft Deletes (deleted_at pattern)
- Transaction Scope (cross-repo coordination)

**GAP-3: Open Questions from Entity-Weaver (12)**
- Event sourcing as primary (vs dual-write)
- Profile composition (WMS + TMS together)
- ID management service
- Dynamic schema extensions
- Transport adapters (HTTP, RPC proxy)

**GAP-4: Cross-Cutting Concerns**
- Transaction coordination across multiple repositories
- Error propagation from L1 (Repos) through L2 (Entities) to L3 (Profiles)
- Service discovery and health checks
- Graceful degradation when EventLog unavailable

**GAP-5: Missing Code Examples**
- EventLog journal schema DDL
- Event replay/projection code
- Multi-repo transaction pattern
- Error mapping between layers

#### Sub-Tasks Created

| Task | Subject | Assignee | Priority |
|------|---------|----------|----------|
| GAP-1 | Event-Oracle contribution for Section 5 | Event-Oracle | High |
| GAP-2 | Resolve Repo-Maven open questions | Repo-Maven | Medium |
| GAP-3 | Resolve Entity-Weaver open questions | Entity-Weaver | Medium |
| GAP-4 | Document cross-cutting concerns | Architect-Prime | High |
| GAP-5 | Add missing code examples | Implementation Agent | Medium |

---

**End of Synthesis Log**

*The architecture specification is ready for implementation. Begin with Phase 1 (IIoT foundation) as the proving ground.*

---

## Gap Analysis Sub-Tasks

### [GAP-1] Event-Oracle Missing Contribution

**What's Missing:**
- Direct council member analysis of EventLog patterns from research docs
- EventLog journal schema (DDL for event storage)
- Event replay/projection patterns
- Event versioning and migration strategy
- Event ordering guarantees

**Why It Matters:**
- Section 5 was synthesized without domain expert validation
- Events are declared "truth" in core principles but lack detailed implementation guidance
- No explicit pattern for event upcasting when schemas change

**Who Should Address:**
- Event-Oracle (primary)
- Cross-reference with `ams-v2-services.md`, `ams-v2-layers.md`

---

### [GAP-2] Repo-Maven Open Questions (4.11)

**Unresolved Questions:**
1. **Dual-Database Support** - Can same repo code work with SQLite (tests) and PostgreSQL (prod)?
2. **Batch Operations** - Should repos have `insertBatch`/`updateBatch`?
3. **Pagination** - Cursor-based or offset-based? Standard interface?
4. **Soft Deletes** - Should `delete` set `deleted_at` instead of hard delete?
5. **Transaction Scope** - How do repos participate in transactions?

**Why It Matters:**
- These affect implementation patterns across ALL repos
- Seeding requires batch operations
- Production queries need pagination
- Data retention may require soft deletes

**Who Should Address:**
- Repo-Maven (with input from Infra-Smith on PostgreSQL capabilities)

---

### [GAP-3] Entity-Weaver Open Questions (Section 12)

**Unresolved Questions:**
1. **Event sourcing as primary?** - EventLog as sole truth vs dual-write
2. **Profile composition?** - How do WMS + TMS compose together?
3. **ID management service** - Centralized UUID + human-readable labels?
4. **Dynamic schema extensions** - Add new AssetKind without code changes?
5. **Transport adapters** - HTTP routes and RPC proxies by default?

**Why It Matters:**
- Event sourcing decision affects entire architecture
- Profile composition needed for multi-tenant deployment
- ID management is cross-cutting concern
- Dynamic schemas enable runtime extensibility

**Who Should Address:**
- Entity-Weaver (with input from Architect-Prime on composition)

---

### [GAP-4] Cross-Cutting Concerns Documentation

**Missing Documentation:**
1. **Transaction Coordination** - How do multiple repos participate in single transaction?
2. **Error Propagation** - How do L1 errors map to L2 errors?
3. **Service Discovery** - How do services find each other?
4. **Health Checks** - Standard pattern for service health?
5. **Graceful Degradation** - What happens when EventLog is unavailable?

**Why It Matters:**
- These affect every layer and every component
- No clear guidance leads to inconsistent implementations
- Production robustness depends on these patterns

**Who Should Address:**
- Architect-Prime (coordination)
- All council members (domain-specific concerns)

---

### [GAP-5] Missing Code Examples

**Needed Examples:**
1. EventLog journal schema DDL (PostgreSQL)
2. Event replay from journal to projection
3. Multi-repo transaction using SqlClient transaction API
4. Error mapping layer (SqlError -> DomainError)
5. Pagination helpers (cursor-based)

**Why It Matters:**
- Spec has patterns but lacks concrete implementation examples
- These are the most commonly needed patterns during implementation
- Copy-paste-ready code accelerates development

**Who Should Address:**
- Implementation Agent (with validation from domain experts)

---

## Thread: Verification Report

**Agent**: Verification Agent (Task #6)
**Timestamp**: 2026-01-26
**Purpose**: Verify documented patterns against actual codebase implementation

---

### Pattern 1: Branded ID Usage (Schema.brand)

- **Documented**: Research states branded identifiers use `Schema.String.pipe(Schema.brand('IdName'))` with double-export pattern (schema + type).

- **Actual**: File `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/schemas/identifiers.ts` contains:
  ```typescript
  export const PlantId = Schema.String.pipe(Schema.brand('PlantId'))
  export type PlantId = Schema.Schema.Type<typeof PlantId>

  export const LineId = Schema.String.pipe(Schema.brand('LineId'))
  export type LineId = Schema.Schema.Type<typeof LineId>

  export const MachineId = Schema.String.pipe(Schema.brand('MachineId'))
  export type MachineId = Schema.Schema.Type<typeof MachineId>

  export const DeviceId = Schema.String.pipe(Schema.brand('DeviceId'))
  export type DeviceId = Schema.Schema.Type<typeof DeviceId>

  export const AlarmId = Schema.String.pipe(Schema.brand('AlarmId'))
  export type AlarmId = Schema.Schema.Type<typeof AlarmId>
  ```

- **Status**: ✓ **Verified** — Exact match with documented pattern including double-export convention.

---

### Pattern 2: Repository Decode Utilities (decodeRows, decodeOptional, etc.)

- **Documented**: Research documents four decode utilities: `decodeRow`, `decodeRows`, `decodeOptional`, `decodeFirst`, plus `prepareUpdate` for Option handling.

- **Actual**: File `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/iiot/repos/_decode.ts` contains all documented utilities:
  ```typescript
  export const prepareUpdate = <T extends Record<string, unknown>>(obj: T): Record<string, unknown>
  export const decodeRow = <A, I, R>(schema: Schema.Schema<A, I, R>) => (row: unknown)
  export const decodeRows = <A, I, R>(schema: Schema.Schema<A, I, R>) => (rows: readonly unknown[])
  export const decodeOptional = <A, I, R>(schema: Schema.Schema<A, I, R>) => (rows: readonly unknown[])
  export const decodeFirst = <A, I, R>(schema: Schema.Schema<A, I, R>) => (rows: readonly unknown[])
  ```

- **Usage Verified**: `PlantRepo.ts` uses these utilities correctly:
  ```typescript
  return yield* decodeOptional(PlantModel)(rows)  // findById
  return yield* decodeRows(PlantModel)(rows)       // findAll
  return yield* decodeFirst(PlantModel)(rows)      // insert/update
  const changes = prepareUpdate(plant)             // update with Option handling
  ```

- **Status**: ✓ **Verified** — All four decode utilities and prepareUpdate exist and are used as documented.

---

### Pattern 3: EventLog.makeSchema / EventLog.schema Usage

- **Documented**: Research states AMS uses `EventLog.makeSchema()` (earlier docs) or `EventLog.schema()` to combine event groups.

- **Actual**: File `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/ams/v2/base/events/schema.ts`:
  ```typescript
  import * as EventLog from '@effect/experimental/EventLog'
  import { AssetEvents } from './asset'

  export const AmsEventLogSchema = EventLog.schema(AssetEvents)
  ```

- **EventGroup Pattern**: File `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/ams/v2/base/events/asset.ts`:
  ```typescript
  export const AssetEvents = EventGroup.empty
    .add({ tag: 'AssetCreated', payload: AssetCreatedPayload, primaryKey: (p) => p.assetId })
    .add({ tag: 'AssetUpdated', payload: AssetUpdatedPayload, primaryKey: (p) => p.assetId })
    // ... 8 total events
  ```

- **Status**: ✓ **Verified** — Uses `EventLog.schema()` (not `makeSchema`). Documentation should be updated to reflect actual API name.

- **Minor Discrepancy**: Research mentions `EventLog.makeSchema()` but actual code uses `EventLog.schema()`. This may be an API evolution or documentation drift.

---

### Pattern 4: Entity.toLayer Pattern

- **Documented**: Research states entities use `Entity.toLayer()` to register handlers with optional defectRetryPolicy.

- **Actual**: File `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/src/lib/ams/v2/base/handlers/asset.ts`:
  ```typescript
  export const AssetEntityHandlers = AssetEntity.toLayer(
    Effect.gen(function* () {
      const state = yield* AssetState
      const eventLogOption = yield* Effect.serviceOption(EventLog.EventLog)
      const writeEvent = Option.isSome(eventLogOption)
        ? yield* EventLog.makeClient(AmsEventLogSchema)
        : null

      const maybeEmit = (tag, payload) =>
        writeEvent ? writeEvent(tag, payload).pipe(Effect.catchAll(() => Effect.void)) : Effect.void

      return {
        CreateAsset: (envelope) => Effect.gen(function* () { /* ... */ }),
        // ... handlers
      }
    }),
    { defectRetryPolicy: Schedule.exponential('100 millis', 2).pipe(Schedule.upTo('10 seconds')) }
  )
  ```

- **Key Patterns Verified**:
  - `Effect.serviceOption(EventLog.EventLog)` for optional EventLog dependency
  - `EventLog.makeClient(AmsEventLogSchema)` for event emission
  - `maybeEmit` helper pattern with `Effect.catchAll(() => Effect.void)`
  - `defectRetryPolicy` with exponential backoff

- **Status**: ✓ **Verified** — Exact match with documented Entity.toLayer pattern.

---

### Pattern 5: DDL Co-location (Model.ts + Model.ddl.ts)

- **Documented**: Research states each Model has an adjacent `.ddl.ts` file with Effect-wrapped CREATE TABLE statements.

- **Actual Files Found**:
  | Model File | DDL File |
  |------------|----------|
  | `PlantModel.ts` | `PlantModel.ddl.ts` |
  | `LineModel.ts` | `LineModel.ddl.ts` |
  | `MachineModel.ts` | `MachineModel.ddl.ts` |
  | `SensorModel.ts` | `SensorModel.ddl.ts` |
  | `SensorReadingModel.ts` | `SensorReadingModel.ddl.ts` |
  | `AggregatedReadingModel.ts` | `AggregatedReadingModel.ddl.ts` |
  | `AlarmModel.ts` | `AlarmModel.ddl.ts` |
  | `AlarmContextModel.ts` | `AlarmContextModel.ddl.ts` |
  | `AnalyticsRecordModel.ts` | `AnalyticsRecordModel.ddl.ts` |

- **DDL Pattern Example** (`PlantModel.ddl.ts`):
  ```typescript
  import { Effect } from 'effect'
  import { SqlClient } from '@effect/sql'

  export const createPlantsTable = Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient

    yield* sql`
      CREATE TABLE IF NOT EXISTS iiot.plants (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        location    TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `
    yield* sql`CREATE INDEX IF NOT EXISTS idx_plants_name ON iiot.plants (name)`
  })
  ```

- **Infrastructure DDL Files**:
  - `_infrastructure.ddl.ts` — Extensions and schema setup
  - `_functions.ddl.ts` — Helper functions
  - `_graph-seed.ddl.ts` — Graph seeding
  - `_migrations.ts` — Migration record aggregation

- **Status**: ✓ **Verified** — Full co-location pattern implemented for all 9 models plus infrastructure DDL.

---

### Verification Summary

| Pattern | Status | Notes |
|---------|--------|-------|
| Branded ID (Schema.brand) | ✓ Verified | Exact match with double-export |
| Repository Decode Utilities | ✓ Verified | All 4 utilities + prepareUpdate present |
| EventLog.schema Usage | ✓ Verified | Uses `EventLog.schema()` (not `makeSchema`) |
| Entity.toLayer Pattern | ✓ Verified | Full pattern with optional EventLog, maybeEmit |
| DDL Co-location | ✓ Verified | 9 models + 4 infrastructure files |

**Overall Assessment**: All 5 key patterns from the research documents are accurately implemented in the codebase. One minor documentation drift noted (EventLog API naming), but functionality is correct.

---

**Verification Agent — Task #6 Complete**

---

## Thread: Architectural Decisions

*Addressing Open Questions from Entity-Weaver (Section 12) and Repo-Maven (Section 4.11)*

**Agent**: Questions-Agent (Task #8)
**Timestamp**: 2026-01-26
**Research Sources**: deepwiki (Effect-TS/effect), codebase patterns (AMS v2, IIoT, Editor v3)

---

### Decision: Event Sourcing as Primary (Question #1)

**Proposed by**: Questions-Agent
**Recommendation**: **No — Use dual-write with EventLog as audit trail, NOT as source of truth**

**Rationale**:

1. **VERIFIED via deepwiki**: The `@effect/experimental` EventLog is designed for event coordination, compaction, and reactivity — NOT event replay reconstruction. The `EventLog.entries` method provides access to events, but there's no built-in `fold`/`reduce` mechanism for state reconstruction from events.

2. **Codebase precedent**: AMS v2 already implements dual-write:
   ```typescript
   // handlers/asset.ts
   const asset = yield* state.create({ ... })  // Write to state
   yield* maybeEmit('AssetCreated', new AssetCreatedPayload({ ... }))  // Then emit event
   ```
   The state service is authoritative; events are observability/audit.

3. **Complexity trade-off**: True event sourcing requires:
   - Event versioning and upcasting
   - Snapshot optimization for long event chains
   - Projection rebuild mechanisms
   - Eventual consistency handling

   v3 doesn't need this complexity. The dual-write pattern with SQL as truth provides:
   - Immediate consistency (queries return latest state)
   - Events for audit trail, reactivity, and external integration
   - Simpler debugging (inspect SQL directly)

**Affected domains**: Event, Handler, Repository, Service
**Trade-offs**:
- Lose ability to rebuild state from events (accepted — use SQL backups instead)
- Dual-write can fail partially (mitigate with transactional writes + async event emission)
- Events become "what happened" not "source of what is"

---

### Decision: Batch Operations Strategy (Question #7)

**Proposed by**: Questions-Agent
**Recommendation**: **Yes — Add `insertBatch` using SqlResolver.ordered for automatic batching**

**Rationale**:

1. **VERIFIED via deepwiki**: `@effect/sql` provides `SqlResolver.ordered` with automatic batching. The pattern collects multiple insert requests within a time window and executes them as a single SQL statement:
   ```typescript
   const insertResolver = yield* SqlResolver.ordered(`${options.spanPrefix}/insert`, {
     Request: Model.insert,
     Result: Model,
     execute: (requests) => sql`insert into ${sql(tableName)} ${sql.insert(requests).returning("*")}`
   })
   ```

2. **Codebase need**: IIoT seeding requires inserting 100K+ sensor readings. The current Tier 2 seeder uses raw `generate_series()` for speed. A typed `insertBatch` enables:
   - Schema validation for all rows
   - Consistent error handling
   - Mode-switchable (fast vs validated)

3. **Implementation pattern**:
   ```typescript
   interface {Entity}Repository {
     // Single insert (existing)
     readonly insert: (data: InsertType) => Effect.Effect<Model, RepoError>

     // Batch insert (NEW)
     readonly insertBatch: (data: readonly InsertType[]) => Effect.Effect<readonly Model[], RepoError>
   }
   ```

**Affected domains**: Repository, Seeding Infrastructure
**Trade-offs**:
- Additional complexity in repo interface
- Batch size limits (1000 per batch recommended for PostgreSQL)
- Error handling granularity (fail entire batch vs partial success)

---

### Decision: Pagination Strategy (Question #8)

**Proposed by**: Questions-Agent
**Recommendation**: **Cursor-based pagination as primary, offset as fallback**

**Rationale**:

1. **VERIFIED via deepwiki**: Effect-TS recommends cursor-based pagination. `Stream.paginateChunkEffect` provides the mechanism:
   ```typescript
   Stream.paginateChunkEffect(
     initialCursor,
     (cursor) => fetchPage(cursor).pipe(
       Effect.map(({ items, nextCursor }) => [
         Chunk.fromIterable(items),
         Option.fromNullable(nextCursor)
       ])
     )
   )
   ```

2. **PostgreSQL efficiency**: Cursor-based pagination with `WHERE id > ${lastId} ORDER BY id LIMIT ${pageSize}` performs consistently regardless of offset. Offset-based (`OFFSET 50000`) degrades with large offsets.

3. **Codebase alignment**: MCP schema patterns in Effect-TS use `Cursor` type:
   ```typescript
   const PaginatedRequest = Schema.Struct({
     cursor: Schema.optional(Cursor),
     limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(1, 100)))
   })

   const PaginatedResult = Schema.Struct({
     items: Schema.Array(ItemSchema),
     nextCursor: Schema.optional(Cursor),
     hasMore: Schema.Boolean
   })
   ```

4. **Offset fallback**: Some UIs need "jump to page N" (AG-Grid). Support offset via query parameter, but default to cursor.

**Affected domains**: Repository, Schema, API
**Trade-offs**:
- Cursor tokens need encoding (base64 or opaque string)
- Can't "jump to page 50" without offset
- Requires stable ordering column (usually `id` or `created_at`)

---

### Decision: Soft Deletes Strategy (Question #9)

**Proposed by**: Questions-Agent
**Recommendation**: **Yes — Use status-based soft delete (NOT deleted_at timestamp)**

**Rationale**:

1. **Codebase precedent**: AMS v2 already implements soft delete via status change:
   ```typescript
   // asset-state-sql.ts:413
   // Soft delete: update status to retired
   yield* assetRepo.update(
     AssetModel.update.make({
       ...current,
       status: 'retired' as AssetStatus,
       version: current.version + 1,
     })
   )
   ```

2. **Status > timestamp**: Using a dedicated `status` field (e.g., `'active' | 'retired' | 'deleted'`) is superior to `deleted_at` because:
   - Supports multiple deletion states (soft delete, archive, pending deletion)
   - Integrates with existing status-based queries
   - No null-checking required (`WHERE status != 'deleted'` vs `WHERE deleted_at IS NULL`)

3. **Command pattern**: The `DeleteAsset` command already supports both:
   ```typescript
   export class DeleteAsset extends Schema.TaggedRequest<DeleteAsset>()('DeleteAsset', {
     payload: {
       assetId: AssetId,
       hard: Schema.optional(Schema.Boolean),  // true = hard delete, false/omit = soft delete
     },
   }) {}
   ```

4. **Query filtering**: Add `includeDeleted` parameter to queries:
   ```typescript
   readonly query: (params: {
     siteId?: SiteId
     includeDeleted?: boolean  // Default: false
   }) => Effect.Effect<readonly Model[]>
   ```

**Affected domains**: Schema, Repository, Service
**Trade-offs**:
- No automatic timestamp of when deletion occurred (add `deletedAt` as optional field if needed)
- Status column required on all soft-deletable entities
- Queries must remember to filter (convention: default excludes deleted)

---

### Decision: Dual-Database Pattern (Question #6)

**Proposed by**: Questions-Agent
**Recommendation**: **No separate instances — Use PostgreSQL with extension-based specialization**

**Rationale**:

1. **Current architecture**: IIoT already uses single PostgreSQL with multiple extensions:
   - TimescaleDB for time-series hypertables
   - Apache AGE for graph queries
   - pg_lake for Iceberg analytics (optional)

2. **Operational simplicity**: One database means:
   - Single backup strategy
   - Single connection pool
   - Single transaction boundary
   - No distributed transaction coordination (2PC)

3. **Schema isolation**: Use PostgreSQL schemas instead of separate instances:
   ```sql
   CREATE SCHEMA iiot;           -- Time-series domain
   CREATE SCHEMA ams;            -- Asset management domain
   CREATE SCHEMA ag_catalog;     -- AGE graph catalog
   ```

4. **SQLite for tests**: Test layer already uses SQLite in-memory. The `transformResultNames` config handles name mapping. For PostgreSQL-specific features (hypertables, AGE), tests should mock or skip.

5. **Graceful degradation**: Use the existing pattern from `_infrastructure.ddl.ts`:
   ```sql
   DO $$
   BEGIN
       CREATE EXTENSION IF NOT EXISTS age;
   EXCEPTION WHEN OTHERS THEN
       RAISE NOTICE 'age not available - graph queries disabled';
   END $$
   ```

**Affected domains**: Infrastructure, Repository, Migrations
**Trade-offs**:
- All extensions must be compatible (generally true for pg_lake + TimescaleDB + AGE)
- Cannot scale graph and time-series independently
- Some tests may need PostgreSQL to validate extension-specific behavior

---

### Decision: Transactions for Multi-Aggregate Operations (Question #10)

**Proposed by**: Questions-Agent
**Recommendation**: **Use SqlClient transaction scope with compensation events**

**Rationale**:

1. **Effect-native pattern**: `@effect/sql` provides `SqlClient.withTransaction` for scoping operations:
   ```typescript
   Effect.gen(function* () {
     const sql = yield* SqlClient.SqlClient

     yield* sql.withTransaction(
       Effect.gen(function* () {
         yield* assetRepo.update(asset1)
         yield* assetRepo.update(asset2)
         yield* propertyRepo.insert(newProperty)
         // All succeed or all rollback
       })
     )
   })
   ```

2. **Event emission after commit**: Emit events AFTER transaction commits to avoid ghost events:
   ```typescript
   yield* sql.withTransaction(
     Effect.gen(function* () {
       const asset = yield* assetRepo.update(...)
       return asset  // Return result for event emission
     })
   ).pipe(
     Effect.tap((asset) => maybeEmit('AssetUpdated', new AssetUpdatedPayload({ ... })))
   )
   ```

3. **Compensation for distributed operations**: When operations span services (not just repos), use saga pattern with compensation events:
   ```typescript
   // If step 2 fails, emit compensation event for step 1
   const saga = pipe(
     step1,
     Effect.tap(() => step2),
     Effect.catchAll((error) =>
       maybeEmit('Step1Compensated', { ... }).pipe(
         Effect.andThen(Effect.fail(error))
       )
     )
   )
   ```

4. **Scope recommendation**:
   - Single-entity operations: No explicit transaction (auto-commit)
   - Multi-entity within same aggregate: `sql.withTransaction`
   - Cross-aggregate: Saga with compensation events

**Affected domains**: Repository, Handler, Event
**Trade-offs**:
- Transaction scope increases lock duration
- Compensation events add complexity
- Eventual consistency for cross-service operations

---

### Summary Table

| Question | Decision | Key Rationale |
|----------|----------|---------------|
| #1 Event Sourcing as Primary | **No** (dual-write) | EventLog is audit trail, SQL is truth |
| #6 Dual-Database | **No** (single PG) | Extensions + schemas, not separate instances |
| #7 Batch Operations | **Yes** (insertBatch) | SqlResolver.ordered for automatic batching |
| #8 Pagination | **Cursor-based** (primary) | Stream.paginateChunkEffect, offset fallback |
| #9 Soft Deletes | **Yes** (status-based) | 'retired' status, not deleted_at |
| #10 Transactions | **withTransaction + saga** | Scoped commits, compensation events |

---

**Questions-Agent — Task #8 Complete**

*These decisions should be validated by Architect-Prime and incorporated into the v3 spec.*

---

## Thread: Integration Analysis

**Agent**: Integration Agent (Task #7)
**Timestamp**: 2026-01-26
**Purpose**: Document where patterns intersect across all council threads

---

### Integration Flow #1: Schema → Model → Repository

**Data Flow**: Domain types flow from Schema definitions through Model persistence adapters to Repository access patterns.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    SCHEMA → MODEL → REPOSITORY FLOW                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. SCHEMA (Domain Truth)                                               │
│     ┌────────────────────────────────────────────────────┐              │
│     │  // schemas/identifiers.ts                         │              │
│     │  export const PlantId = Schema.String.pipe(        │              │
│     │    Schema.brand('PlantId')                         │              │
│     │  )                                                 │              │
│     │                                                    │              │
│     │  // schemas/assets.ts                              │              │
│     │  export class Plant extends Schema.TaggedClass<    │              │
│     │    Plant                                           │              │
│     │  >()('Plant', {                                    │              │
│     │    id: PlantId,                                    │              │
│     │    name: Schema.NonEmptyString,                    │              │
│     │    location: Schema.optional(Schema.String),       │              │
│     │  }) {}                                             │              │
│     └────────────────────────────────────────────────────┘              │
│                           │                                             │
│                           │ Plant.fields.name (reuse)                   │
│                           ▼                                             │
│  2. MODEL (Persistence Adapter)                                         │
│     ┌────────────────────────────────────────────────────┐              │
│     │  // models/assets/PlantModel.ts                    │              │
│     │  export class PlantModel extends Model.Class<      │              │
│     │    PlantModel                                      │              │
│     │  >('PlantModel')({                                 │              │
│     │    id: Model.GeneratedByApp(PlantId),  // From ID  │              │
│     │    name: Plant.fields.name,            // Reused   │              │
│     │    location: Model.FieldOption(Schema.String),     │              │
│     │    createdAt: CreatedAt,               // DB-only  │              │
│     │    updatedAt: UpdatedAt,               // DB-only  │              │
│     │  }) {}                                             │              │
│     └────────────────────────────────────────────────────┘              │
│                           │                                             │
│                           │ decodeFirst(PlantModel)                     │
│                           ▼                                             │
│  3. REPOSITORY (SQL Access)                                             │
│     ┌────────────────────────────────────────────────────┐              │
│     │  // repos/PlantRepo.ts                             │              │
│     │  const insert = (plant: typeof PlantModel.insert.  │              │
│     │    Type) => Effect.gen(function* () {              │              │
│     │    const rows = yield* sql`                        │              │
│     │      INSERT INTO iiot.plants (id, name, location)  │              │
│     │      VALUES (${plant.id}, ${plant.name},           │              │
│     │              ${plant.location})                    │              │
│     │      RETURNING *                                   │              │
│     │    `                                               │              │
│     │    return yield* decodeFirst(PlantModel)(rows)     │              │
│     │  })                                                │              │
│     └────────────────────────────────────────────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Integration Points**:

| Source | Target | Integration Mechanism |
|--------|--------|----------------------|
| Schema (PlantId) | Model (id field) | `Model.GeneratedByApp(PlantId)` |
| Schema (Plant.fields.name) | Model (name field) | Direct field reuse |
| Schema (Schema.optional) | Model (nullable) | `Model.FieldOption()` transform |
| Model (PlantModel) | Repository (decode) | `decodeFirst(PlantModel)(rows)` |
| Model.insert.Type | Repository (insert param) | Type derivation for insert shape |

**Code Snippet — Field Reuse Pattern**:

```typescript
// Domain schema is source of truth
export class Plant extends Schema.TaggedClass<Plant>()('Plant', {
  id: PlantId,
  name: Schema.NonEmptyString,  // ← Source
}) {}

// Model REUSES schema field (not redefinition)
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  id: Model.GeneratedByApp(PlantId),
  name: Plant.fields.name,  // ← Reuse (NOT Schema.NonEmptyString)
}) {}
```

**Friction Point**: `Schema.optional()` vs `Model.FieldOption()` requires manual transformation. No automatic derivation exists.

---

### Integration Flow #2: Repository → Entity Handler

**Data Flow**: Repository methods are called from Entity handlers via injected State services.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    REPOSITORY → ENTITY HANDLER FLOW                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. REPOSITORY INTERFACE                                                │
│     ┌────────────────────────────────────────────────────┐              │
│     │  interface PlantRepository {                       │              │
│     │    readonly findById: (id: PlantId) =>             │              │
│     │      Effect<Option<PlantModel>, PlantRepoError>    │              │
│     │    readonly insert: (plant: InsertType) =>         │              │
│     │      Effect<PlantModel, PlantRepoError>            │              │
│     │  }                                                 │              │
│     │                                                    │              │
│     │  export class PlantRepo extends Context.Tag(...)   │              │
│     │    <PlantRepo, PlantRepository>() {}               │              │
│     └────────────────────────────────────────────────────┘              │
│                           │                                             │
│                           │ Layer.provide(PlantRepoLive)                │
│                           ▼                                             │
│  2. STATE SERVICE (Abstraction Layer)                                   │
│     ┌────────────────────────────────────────────────────┐              │
│     │  export class PlantState extends Effect.Service<   │              │
│     │    PlantState                                      │              │
│     │  >()('PlantState', {                               │              │
│     │    effect: Effect.gen(function* () {               │              │
│     │      const repo = yield* PlantRepo  // ← DI        │              │
│     │                                                    │              │
│     │      return {                                      │              │
│     │        create: (params) => repo.insert(...)        │              │
│     │        findById: (id) => repo.findById(id)         │              │
│     │      }                                             │              │
│     │    })                                              │              │
│     │  }) {}                                             │              │
│     └────────────────────────────────────────────────────┘              │
│                           │                                             │
│                           │ yield* PlantState                           │
│                           ▼                                             │
│  3. ENTITY HANDLER                                                      │
│     ┌────────────────────────────────────────────────────┐              │
│     │  export const PlantEntityHandlers = PlantEntity.   │              │
│     │    toLayer(Effect.gen(function* () {               │              │
│     │      const state = yield* PlantState  // ← DI      │              │
│     │                                                    │              │
│     │      return {                                      │              │
│     │        CreatePlant: (env) => Effect.gen(...) {     │              │
│     │          const plant = yield* state.create(        │              │
│     │            env.payload                             │              │
│     │          )                                         │              │
│     │          yield* maybeEmit('PlantCreated', ...)     │              │
│     │          return plant                              │              │
│     │        },                                          │              │
│     │        GetPlant: (env) => state.findById(          │              │
│     │          env.payload.plantId                       │              │
│     │        ),                                          │              │
│     │      }                                             │              │
│     │    }))                                             │              │
│     └────────────────────────────────────────────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Integration Points**:

| Source | Target | Integration Mechanism |
|--------|--------|----------------------|
| Repository (PlantRepo) | State Service | `yield* PlantRepo` (DI) |
| State Service (PlantState) | Entity Handler | `yield* PlantState` (DI) |
| Repository Error (PlantRepoError) | State Error | Error propagation |
| State Result (PlantModel) | Handler Return | Domain object passthrough |

**Code Snippet — Service Injection Chain**:

```typescript
// Layer composition wires the chain
const PlantStack = PlantEntityHandlers.pipe(
  Layer.provide(PlantStateSQLLayer),  // State depends on Repo
  Layer.provide(PlantRepoLive),       // Repo depends on SqlClient
  Layer.provide(PgClientLayer),       // SqlClient depends on PG
)
```

**Friction Point**: Two levels of indirection (Repo → State → Handler). Could simplify by having Handler call Repo directly, but State layer enables swappable implementations (in-memory for tests).

---

### Integration Flow #3: Entity Handler → EventLog

**Data Flow**: Commands in Entity handlers emit events to EventLog for audit and reactivity.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ENTITY HANDLER → EVENTLOG FLOW                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. HANDLER INITIALIZATION                                              │
│     ┌────────────────────────────────────────────────────┐              │
│     │  const eventLogOption = yield* Effect.serviceOption│              │
│     │    (EventLog.EventLog)                             │              │
│     │  const writeEvent = Option.isSome(eventLogOption)  │              │
│     │    ? yield* EventLog.makeClient(AppSchema)         │              │
│     │    : null                                          │              │
│     │                                                    │              │
│     │  const maybeEmit = (tag, payload) =>               │              │
│     │    writeEvent                                      │              │
│     │      ? writeEvent(tag, payload).pipe(              │              │
│     │          Effect.catchAll(() => Effect.void)        │              │
│     │        )                                           │              │
│     │      : Effect.void                                 │              │
│     └────────────────────────────────────────────────────┘              │
│                           │                                             │
│                           │ Event emission in command                   │
│                           ▼                                             │
│  2. COMMAND EXECUTION                                                   │
│     ┌────────────────────────────────────────────────────┐              │
│     │  CreateAsset: (envelope) => Effect.gen(...) {      │              │
│     │    // 1. Execute business logic                    │              │
│     │    const asset = yield* state.create(envelope.     │              │
│     │      payload)                                      │              │
│     │                                                    │              │
│     │    // 2. Emit event (non-blocking, swallowed)      │              │
│     │    yield* maybeEmit('AssetCreated',                │              │
│     │      new AssetCreatedPayload({                     │              │
│     │        assetId: asset.id,                          │              │
│     │        siteId: asset.siteId,                       │              │
│     │        kind: asset.kind,                           │              │
│     │        createdBy: envelope.payload.createdBy,      │              │
│     │        createdAt: asset.createdAt,                 │              │
│     │      })                                            │              │
│     │    )                                               │              │
│     │                                                    │              │
│     │    // 3. Return result                             │              │
│     │    return asset                                    │              │
│     │  }                                                 │              │
│     └────────────────────────────────────────────────────┘              │
│                           │                                             │
│                           │ writeEvent(tag, payload)                    │
│                           ▼                                             │
│  3. EVENTLOG WRITE                                                      │
│     ┌────────────────────────────────────────────────────┐              │
│     │  EventLog.write()                                  │              │
│     │    → encode payload (MsgPack)                      │              │
│     │    → generate UUID v7                              │              │
│     │    → SqlEventJournal.insert(entry)                 │              │
│     │    → execute registered handlers                   │              │
│     └────────────────────────────────────────────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Integration Points**:

| Source | Target | Integration Mechanism |
|--------|--------|----------------------|
| Handler | EventLog (optional) | `Effect.serviceOption(EventLog.EventLog)` |
| Handler | EventLog Client | `EventLog.makeClient(AppSchema)` |
| Event Payload (Schema.Class) | EventLog | MsgPack serialization |
| State Result | Event Payload | Manual mapping |
| Event | SqlEventJournal | `SqlEventJournal.layer` persistence |

**Code Snippet — Event Payload Construction**:

```typescript
// Payload class with Schema definition
export class AssetCreatedPayload extends Schema.Class<AssetCreatedPayload>(
  'AssetCreatedPayload'
)({
  assetId: AssetId,
  siteId: SiteId,
  kind: AssetKind,
  label: AssetLabel,
  status: AssetStatus,
  createdBy: IdentityId,
  createdAt: CreatedAt,
}) {}

// EventGroup registration
export const AssetEvents = EventGroup.empty
  .add({
    tag: 'AssetCreated',
    payload: AssetCreatedPayload,
    primaryKey: (payload) => payload.assetId,  // Entity identity
  })
```

**Friction Point**: Event payload duplicates fields from domain entity. No automatic derivation from State result to Event payload.

---

### Integration Flow #4: EventLog → Event Handler → Repository

**Data Flow**: Events trigger handlers that can update projections via repositories.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                EVENTLOG → EVENT HANDLER → REPOSITORY FLOW                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  1. EVENT PERSISTED                                                     │
│     ┌────────────────────────────────────────────────────┐              │
│     │  SqlEventJournal                                   │              │
│     │  ┌────────────────────────────────────────────┐    │              │
│     │  │ id | event          | primary_key | payload │   │              │
│     │  │----│----------------│-------------│---------│   │              │
│     │  │ x1 | AssetCreated   | AST-001     | {...}   │   │              │
│     │  └────────────────────────────────────────────┘    │              │
│     └────────────────────────────────────────────────────┘              │
│                           │                                             │
│                           │ Entry published to handlers                 │
│                           ▼                                             │
│  2. EVENT HANDLER INVOCATION                                            │
│     ┌────────────────────────────────────────────────────┐              │
│     │  EventLog.group(AssetEvents, (handlers) =>         │              │
│     │    Effect.gen(function* () {                       │              │
│     │      const projection = yield* AssetProjection     │              │
│     │                                                    │              │
│     │      return handlers                               │              │
│     │        .handle('AssetCreated', ({ payload, entry,  │              │
│     │          conflicts }) => Effect.gen(...) {         │              │
│     │                                                    │              │
│     │          // Conflict detection                     │              │
│     │          if (conflicts.length > 0) {               │              │
│     │            yield* Effect.logWarning(               │              │
│     │              `Concurrent: ${payload.assetId}`      │              │
│     │            )                                       │              │
│     │          }                                         │              │
│     │                                                    │              │
│     │          // Update projection (read model)         │              │
│     │          yield* projection.handleCreated(payload)  │              │
│     │                                                    │              │
│     │          return void 0                             │              │
│     │        })                                          │              │
│     │    })                                              │              │
│     │  )                                                 │              │
│     └────────────────────────────────────────────────────┘              │
│                           │                                             │
│                           │ projection.handleCreated()                  │
│                           ▼                                             │
│  3. PROJECTION UPDATE (Optional Repository Call)                        │
│     ┌────────────────────────────────────────────────────┐              │
│     │  // Projection service can call repos              │              │
│     │  const handleCreated = (payload) =>                │              │
│     │    Effect.gen(function* () {                       │              │
│     │      // Denormalized view update                   │              │
│     │      yield* assetSummaryRepo.upsert({              │              │
│     │        assetId: payload.assetId,                   │              │
│     │        siteId: payload.siteId,                     │              │
│     │        kind: payload.kind,                         │              │
│     │        lastEvent: 'created',                       │              │
│     │        lastEventAt: payload.createdAt,             │              │
│     │      })                                            │              │
│     │    })                                              │              │
│     └────────────────────────────────────────────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Integration Points**:

| Source | Target | Integration Mechanism |
|--------|--------|----------------------|
| SqlEventJournal | Event Handler | `EventLog.group()` registration |
| Event Entry | Handler Context | `{ payload, entry, conflicts }` |
| Handler | Projection Service | `yield* ProjectionService` (DI) |
| Projection | Repository | Optional repo calls for read models |
| Conflicting Events | Handler | `conflicts` array for resolution |

**Code Snippet — Conflict Resolution**:

```typescript
.handle('AssetCreated', ({ payload, entry, conflicts }) =>
  Effect.gen(function* () {
    if (conflicts.length > 0) {
      // Concurrent creates detected — last-write-wins
      const latest = conflicts.reduce(
        (a, b) => a.entry.timestamp > b.entry.timestamp ? a : b
      )
      if (latest.entry.id !== entry.id) {
        // This event is NOT the winner, skip projection update
        return void 0
      }
    }
    // Winner: update projection
    yield* projection.handleCreated(payload)
    return void 0
  })
)
```

**Friction Point**: Event handlers run synchronously on write. Long-running projections block the write path. Consider async projection updates for complex aggregations.

---

### Integration Flow #5: Infrastructure DDL → Model Schema

**Data Flow**: DDL statements must align with Model field definitions.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DDL → MODEL SCHEMA ALIGNMENT                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  MODEL FIELD                    DDL COLUMN                              │
│  ──────────────────────────────────────────────────────────────────     │
│  id: Model.GeneratedByApp       id TEXT PRIMARY KEY                     │
│       (PlantId)                                                         │
│                                                                         │
│  name: Plant.fields.name        name TEXT NOT NULL                      │
│       (Schema.NonEmptyString)                                           │
│                                                                         │
│  location: Model.FieldOption    location TEXT  (nullable)               │
│       (Schema.String)                                                   │
│                                                                         │
│  createdAt: CreatedAt           created_at TIMESTAMPTZ NOT NULL         │
│       (Model.DateTimeInsert)    DEFAULT NOW()                           │
│                                                                         │
│  updatedAt: UpdatedAt           updated_at TIMESTAMPTZ NOT NULL         │
│       (Model.DateTimeUpdate)    DEFAULT NOW()                           │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Alignment Table**:

| Model Transform | DDL Pattern | Notes |
|----------------|-------------|-------|
| `Model.GeneratedByApp(BrandedId)` | `TEXT PRIMARY KEY` | Client provides ID |
| `Model.Generated(BrandedId)` | `TEXT/SERIAL PRIMARY KEY` | DB generates ID |
| `Model.FieldOption(Schema)` | `COLUMN TYPE` (no NOT NULL) | Nullable |
| `Schema.NonEmptyString` | `TEXT NOT NULL` | Non-nullable |
| `Model.DateTimeInsertFromDate` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | Auto-set |
| `Model.DateTimeUpdateFromDate` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | Auto-update |

**Code Snippet — DDL Co-located with Model**:

```typescript
// PlantModel.ts
export class PlantModel extends Model.Class<PlantModel>('PlantModel')({
  id: Model.GeneratedByApp(PlantId),
  name: Plant.fields.name,
  location: Model.FieldOption(Schema.String),
  createdAt: CreatedAt,
  updatedAt: UpdatedAt,
}) {}

// PlantModel.ddl.ts (adjacent file)
export const createPlantsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS iiot.plants (
      id          TEXT PRIMARY KEY,        -- matches GeneratedByApp
      name        TEXT NOT NULL,           -- matches NonEmptyString
      location    TEXT,                    -- matches FieldOption (nullable)
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
})
```

**Friction Point**: No automatic DDL generation from Model schema. Manual alignment required. Consider future enhancement: `Model.toDDL(PlantModel)`.

---

### Cross-Cutting Friction Analysis

| Integration | Friction Level | Issue | Mitigation |
|-------------|---------------|-------|------------|
| Schema → Model | **Low** | Manual `FieldOption` mapping | Document pattern clearly |
| Model → DDL | **Medium** | No auto-generation | Use co-location + naming conventions |
| Repo → State → Handler | **Medium** | Double indirection | Enables test swapability |
| Handler → Event | **Medium** | Payload duplication | Consider event derivation |
| Event → Handler → Repo | **Low** | Async concerns | Document sync vs async patterns |

---

### Recommended Integration Improvements for v3

1. **Schema-to-Model Derivation Helper**
   ```typescript
   // Auto-derive Model from Schema with sensible defaults
   const PlantModel = Schema.toModel(Plant, {
     tableName: 'plants',
     idColumn: 'id',
     idStrategy: 'client',  // GeneratedByApp
   })
   ```

2. **Event Payload Derivation**
   ```typescript
   // Auto-derive event payload from entity + provenance
   const AssetCreatedPayload = Schema.deriveEventPayload(Asset, {
     include: ['id', 'siteId', 'kind', 'label', 'status'],
     provenance: ['createdBy', 'createdAt'],
   })
   ```

3. **DDL Generation (Experimental)**
   ```typescript
   // Generate DDL from Model (development aid)
   const ddl = Model.generateDDL(PlantModel, {
     schema: 'iiot',
     tableName: 'plants',
   })
   // Returns CREATE TABLE statement
   ```

4. **Unified Error Mapping**
   ```typescript
   // Standard error propagation L1 → L2 → L3
   const mapRepoError = (error: PlantRepoError): PlantServiceError =>
     Match.value(error).pipe(
       Match.tag('SqlError', (e) => new PlantQueryError({ cause: e })),
       Match.tag('ParseError', (e) => new PlantValidationError({ cause: e })),
       Match.exhaustive,
     )
   ```

---

### Integration Diagram — Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        COMPLETE V3 DATA FLOW                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────┐   Schema.brand   ┌─────────────┐                      │
│   │   Schema    │ ─────────────────▶│   Model     │                     │
│   │  (Domain)   │   Plant.fields   │(Persistence)│                      │
│   └─────────────┘                  └──────┬──────┘                      │
│         │                                 │                             │
│         │ TaggedClass                     │ decodeFirst/decodeRows      │
│         ▼                                 ▼                             │
│   ┌─────────────┐                  ┌─────────────┐                      │
│   │   Entity    │                  │ Repository  │                      │
│   │    RPC      │                  │  Context.Tag│                      │
│   └──────┬──────┘                  └──────┬──────┘                      │
│          │ Entity.toLayer                 │ yield* Repo                 │
│          ▼                                ▼                             │
│   ┌─────────────┐                  ┌─────────────┐                      │
│   │   Handler   │ ◀───── DI ──────│    State    │                      │
│   │  (CQRS)     │                  │   Service   │                      │
│   └──────┬──────┘                  └─────────────┘                      │
│          │ maybeEmit                                                    │
│          ▼                                                              │
│   ┌─────────────┐   SqlEventJournal   ┌─────────────┐                   │
│   │  EventLog   │ ────────────────────▶│ Event      │                   │
│   │   Client    │   persist entry     │ Handler    │                    │
│   └─────────────┘                     └──────┬──────┘                   │
│                                              │ projection.handleX       │
│                                              ▼                          │
│                                       ┌─────────────┐                   │
│                                       │ Projection  │                   │
│                                       │  (Optional) │                   │
│                                       └─────────────┘                   │
│                                                                         │
│   ┌─────────────┐   Effect.gen       ┌─────────────┐                    │
│   │    DDL      │ ────────────────────▶│ Migrator    │                  │
│   │ Co-located  │   fromRecord       │ PostgreSQL  │                    │
│   └─────────────┘                    └─────────────┘                    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

**INTEGRATION COMPLETE**

---

**Integration Agent — Task #7 Complete**
