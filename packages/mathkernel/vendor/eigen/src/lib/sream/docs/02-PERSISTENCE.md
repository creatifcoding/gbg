# SREAM Persistence Architecture

Extracted from `src/lib/iiot/` — the canonical persistence stack that SREAM must follow.

## Layer Cake Overview

```
React / Atoms                    (consumer)
    ↓
State Service (Context.Tag)      (hexagonal port — create/get/set/list/delete)
    ↓
Repository (Context.Tag)         (SQL queries + decode)
    ↓
Model (Model.Class)              (persistence schema — DB column types)
    ↓
DDL (.ddl.ts)                    (CREATE TABLE, indexes, constraints, triggers)
    ↓
Migrations (_migrations.ts)      (Migrator.fromRecord — versioned evolution)
    ↓
SqlClient (PgClient.layer)       (connection pool, column name transform)
```

Each layer has a single responsibility. No layer reaches past its neighbor.

---

## 1. Model (Model.Class)

**Source:** `src/lib/iiot/models/work-orders/WorkOrderModel.ts`

Models define the **persistence schema** — how domain types map to PostgreSQL column types. They live in `models/` and use `@effect/sql Model.Class`.

### Key Concepts

| Concept | IIoT Usage | Purpose |
|---------|-----------|---------|
| `Model.Generated(T)` | PK fields, timestamps | Excluded from insert type (DB generates) |
| `Model.FieldOption(T)` | Nullable columns | `NULL ↔ Option<T>` bidirectional |
| `Model.DateTimeInsertFromDate` | `created_at` | pg Date → DateTime on read, set on insert |
| `Model.DateTimeUpdateFromDate` | `updated_at` | pg Date → DateTime on read, set on update |
| `Schema.DateFromSelf` | Optional dates | pg native Date objects |
| `Schema.optionalWith(..., { default })` | Boolean defaults | Defaults on construct |

### Example (WorkOrderModel)

```typescript
import { Schema } from 'effect'
import { Model } from '@effect/sql'
import { WorkOrderId } from '../../schemas/identifiers'
import { WorkOrderStatus } from '../../schemas/work-orders'
import { CreatedAt, OptionalMetadata } from '../_common'

export class WorkOrderModel extends Model.Class<WorkOrderModel>('WorkOrderModel')({
  // PK — auto-generated, excluded from insert type
  id: Model.Generated(WorkOrderId),

  // Required fields — directly reuse Schema types
  title: Schema.NonEmptyString,
  status: WorkOrderStatus,
  createdBy: Schema.String,

  // Timestamps
  createdAt: CreatedAt,   // Model.DateTimeInsertFromDate

  // Nullable → Option
  scheduledStart: Model.FieldOption(Schema.DateFromSelf),
  assignedTo: Model.FieldOption(Schema.String),
  outcome: Model.FieldOption(WorkOrderOutcome),

  // JSONB as parsed objects (pg driver returns parsed)
  metadata: OptionalMetadata,

  // Boolean with default
  compensationRequired: Schema.Boolean.pipe(
    Schema.propertySignature,
    Schema.withConstructorDefault(() => false)
  ),
}) {}
```

### Common Helpers (`_common.ts`)

```typescript
// NUMERIC columns return strings in pg — normalize to number
export const NumericFromPg = Schema.Union(Schema.Number, Schema.NumberFromString)
export const OptionalNumeric = Model.FieldOption(NumericFromPg)

// JSONB metadata record
export const MetadataRecord = Schema.Record({ key: Schema.String, value: Schema.Unknown })
export const OptionalMetadata = Model.FieldOption(MetadataRecord)

// Timestamps
export const CreatedAt = Model.DateTimeInsertFromDate
export const UpdatedAtNullable = Model.FieldOption(Schema.DateFromSelf)
```

### SREAM Model Types Needed

| Model | Table | PK | Notes |
|-------|-------|-----|-------|
| `RequirementModel` | `sream.requirements` | `id: RequirementId` | Core requirement record |
| `RequirementTransitionModel` | `sream.requirement_transitions` | `id: UUID` | Audit trail (append-only) |

---

## 2. DDL (Co-located .ddl.ts)

**Source:** `src/lib/iiot/models/work-orders/WorkOrderModel.ddl.ts`

DDL files live **next to their Model** and define the SQL schema:

### Pattern

```typescript
import { Effect } from 'effect'
import { SqlClient } from '@effect/sql'

export const createRequirementsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS sream.requirements (
      id                  TEXT PRIMARY KEY,
      team                TEXT NOT NULL,
      category            TEXT NOT NULL,
      ordinal             INTEGER NOT NULL,
      order_index         INTEGER NOT NULL DEFAULT 1,
      -- ... domain columns
      status              TEXT NOT NULL CHECK (status IN ('draft','active','deprecated','archived')),
      modality            TEXT NOT NULL CHECK (modality IN ('must','shall','may','must_not')),
      -- ... 
      metadata            JSONB DEFAULT '{}',
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `

  // Indexes for common query patterns
  yield* sql`CREATE INDEX IF NOT EXISTS idx_requirements_team 
    ON sream.requirements (team, category, ordinal)`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_requirements_status 
    ON sream.requirements (status) WHERE status != 'archived'`
  yield* sql`CREATE INDEX IF NOT EXISTS idx_requirements_modality 
    ON sream.requirements (modality, status)`
})
```

### IIoT DDL Conventions

- `CHECK` constraints for Schema.Literal enum values
- Partial indexes with `WHERE` clauses for active rows
- `CASCADE` on FK references for related tables
- `DEFAULT NOW()` for server-generated timestamps
- Separate sequences for auto-incrementing IDs
- Immutability triggers on audit tables (INSERT-only)
- GIN indexes on JSONB columns for path queries

### Transition Table (Audit Trail)

```typescript
export const createRequirementTransitionsTable = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient

  yield* sql`
    CREATE TABLE IF NOT EXISTS sream.requirement_transitions (
      id                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      requirement_id    TEXT NOT NULL REFERENCES sream.requirements(id) ON DELETE CASCADE,
      from_status       TEXT NOT NULL,
      to_status         TEXT NOT NULL,
      transitioned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      transitioned_by   TEXT,
      reason            TEXT,
      CONSTRAINT check_status_change CHECK (from_status != to_status)
    )
  `
})

// Immutability trigger — append-only
export const createTransitionsImmutabilityTrigger = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient
  yield* sql`
    CREATE OR REPLACE FUNCTION sream.reject_transition_update()
    RETURNS TRIGGER AS $$
    BEGIN
      RAISE EXCEPTION 'UPDATE not allowed on requirement_transitions (audit compliance)';
    END;
    $$ LANGUAGE plpgsql
  `
  yield* sql`
    CREATE TRIGGER prevent_transition_update
    BEFORE UPDATE ON sream.requirement_transitions
    FOR EACH ROW
    EXECUTE FUNCTION sream.reject_transition_update()
  `
})
```

---

## 3. Repository (Context.Tag + Layer.effect)

**Source:** `src/lib/iiot/repos/WorkOrderRepo.ts`

Repos handle SQL execution and decode results through Model schemas.

### Pattern

```typescript
import { Context, Layer, Effect, Option } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// 1. Interface
export interface RequirementRepository {
  readonly findById: (id: RequirementId) => Effect.Effect<Option.Option<RequirementModel>, RepoError>
  readonly findByTeam: (team: TeamId) => Effect.Effect<readonly RequirementModel[], RepoError>
  readonly insert: (req: typeof RequirementModel.insert.Type) => Effect.Effect<RequirementModel, RepoError>
  readonly update: (req: Partial<...> & { id: RequirementId }) => Effect.Effect<RequirementModel, RepoError>
  readonly delete: (id: RequirementId) => Effect.Effect<void, SqlError.SqlError>
}

// 2. Service Tag
export class RequirementRepo extends Context.Tag('sream/RequirementRepo')<
  RequirementRepo, RequirementRepository
>() {}

// 3. Implementation
export const RequirementRepoLive = Layer.effect(
  RequirementRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    
    const findById = (id: RequirementId) =>
      Effect.gen(function* () {
        const rows = yield* sql`SELECT ... FROM sream.requirements WHERE id = ${id} LIMIT 1`
        return yield* decodeOptional(RequirementModel)(rows)
      })

    // ... other methods

    return { findById, ... } satisfies RequirementRepository
  })
)
```

### Decode Utilities (`_decode.ts`)

```typescript
// Decode multiple rows through Model schema
export const decodeRows = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<readonly A[], ParseResult.ParseError, R> =>
    Schema.decodeUnknown(Schema.Array(schema))(rows)

// Decode single row → Option
export const decodeOptional = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<Option.Option<A>, ParseResult.ParseError, R> =>
    rows.length === 0
      ? Effect.succeed(Option.none())
      : Schema.decodeUnknown(schema)(rows[0]).pipe(Effect.map(Option.some))

// Decode first row (for INSERT...RETURNING)
export const decodeFirst = <A, I, R>(schema: Schema.Schema<A, I, R>) =>
  (rows: readonly unknown[]): Effect.Effect<A, ParseResult.ParseError, R> =>
    Schema.decodeUnknown(schema)(rows[0])

// camelCase → snake_case for UPDATE SET clauses
export const prepareUpdate = <T extends Record<string, unknown>>(obj: T): Record<string, unknown> => {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue
    const snakeKey = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)
    result[snakeKey] = Option.isOption(value) ? Option.getOrNull(value) : value
  }
  return result
}
```

### Column Mapping

Repos use `SELECT ... AS "camelCase"` aliases to map snake_case DB columns to Model field names:

```typescript
const SELECT_COLUMNS = `
  id,
  team_id AS "teamId",
  category_id AS "categoryId",
  modality,
  created_at AS "createdAt"
`
```

OR use a `transformResultNames` function on the PgClient:

```typescript
const transformResultNames = (col: string): string =>
  col.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

export const PgClientLayer = PgClient.layer({
  // ...
  transformResultNames,
})
```

---

## 4. State Service (Hexagonal Port)

**Source:** `src/lib/iiot/state/StateShape.ts`, `src/lib/iiot/state/WorkOrderState.ts`

State services are the **hexagonal port** between Entity handlers and persistence:

### Shape Interface

```typescript
export interface RequirementStateShape {
  readonly create: (input: CreateRequirementInput) => Effect.Effect<Requirement>
  readonly get: (id: RequirementId) => Effect.Effect<Requirement, NotFoundError>
  readonly set: (req: Requirement) => Effect.Effect<void>
  readonly list: (filter: RequirementFilter) => Effect.Effect<readonly Requirement[]>
  readonly delete: (id: RequirementId) => Effect.Effect<boolean>
  readonly exists: (id: RequirementId) => Effect.Effect<boolean>
  readonly count: (filter: RequirementFilter) => Effect.Effect<number>
}
```

### Service Tag

```typescript
export class RequirementState extends Context.Tag('sream/RequirementState')<
  RequirementState, RequirementStateShape
>() {}
```

### In-Memory Implementation (Testing)

```typescript
export const RequirementStateInMemory: Layer.Layer<RequirementState> = Layer.effect(
  RequirementState,
  Ref.make(new Map<RequirementId, Requirement>()).pipe(
    Effect.map((store) => ({
      create: (input) => Effect.gen(function* () {
        const id = generateRequirementId(input)
        const req = new Requirement({ id, ...input, status: 'draft' })
        yield* Ref.update(store, m => { const n = new Map(m); n.set(id, req); return n })
        return req
      }),
      get: (id) => Ref.get(store).pipe(
        Effect.flatMap(m => m.has(id) 
          ? Effect.succeed(m.get(id)!)
          : Effect.fail(new RequirementNotFoundError(id))
        )
      ),
      // ...
    }))
  )
)
```

### SQL Factory (Production)

```typescript
export const makeRequirementStateSql = (repo: {
  findById: (id: RequirementId) => Effect.Effect<Option.Option<RequirementModel>, unknown>
  findAll: (filter: RequirementFilter) => Effect.Effect<readonly RequirementModel[], unknown>
  insert: (req: RequirementModel) => Effect.Effect<RequirementModel, unknown>
  update: (req: Partial<RequirementModel> & { id: RequirementId }) => Effect.Effect<RequirementModel, unknown>
  delete: (id: RequirementId) => Effect.Effect<boolean, unknown>
}): RequirementStateShape => ({
  // Bridge repo methods to state interface
  // Handle Option → fail mapping, type coercion, etc.
})
```

---

## 5. Migrations (Migrator.fromRecord)

**Source:** `src/lib/iiot/models/_migrations.ts`

All DDL is aggregated into a single migration record for versioned schema evolution:

```typescript
import { Migrator } from '@effect/sql'

export const sreamMigrations = {
  '0001_schema': createSreamSchema,
  '0002_requirements_table': createRequirementsTable,
  '0003_requirement_transitions': Effect.gen(function* () {
    yield* createRequirementTransitionsTable
    yield* createTransitionsImmutabilityTrigger
  }),
  '0004_event_journal': createSreamEventJournalSchema,
  '0005_indexes': createSreamIndexes,
} as const

export const sreamMigrationLoader = Migrator.fromRecord(sreamMigrations)
```

### Migration Key Convention

`'NNNN_description'` — zero-padded 4-digit number + snake_case description.

---

## 6. Event Journal DDL

**Source:** `src/lib/iiot/models/_event-journal.ddl.ts`

For event-sourced state, a separate partitioned event journal:

```sql
CREATE TABLE IF NOT EXISTS sream.event_journal (
  id              BYTEA NOT NULL,
  sequence_num    BIGSERIAL,
  entity_type     VARCHAR(64) NOT NULL,   -- 'requirement'
  primary_key     VARCHAR(255) NOT NULL,  -- RequirementId
  event_tag       VARCHAR(128) NOT NULL,  -- 'RequirementCreated', etc.
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  identity_id     BYTEA NOT NULL,
  PRIMARY KEY (entity_type, sequence_num),
  UNIQUE (entity_type, id)
) PARTITION BY LIST (entity_type)
```

Plus:
- **event_remotes** — CRDT sync tracking
- **event_journal_identity** — persistent node identity
- **GIN index** on `payload` for JSONB path queries
- **Temporal index** on `(primary_key, created_at DESC)` for entity history
- **Tag index** on `(event_tag, created_at DESC)` for event type queries

SREAM may share the IIoT event journal (add a `'requirement'` partition) or maintain its own — this is an open architectural decision.

---

## 7. Layer Composition (Three Tiers)

**Source:** `src/lib/iiot/layers/index.ts`

```typescript
// Testing: all in-memory, self-contained
export const SreamTestLayer = SreamEntityHandlers.pipe(
  Layer.provide(RequirementStateInMemory),
  Layer.provide(SreamFeatureFlagsDisabledLayer),
)

// Production: SQL-backed
export const SreamClusterLayer = pipe(
  SreamEntityHandlers,
  Layer.provide(RequirementStateSqlLayer),
  Layer.provide(SreamRepositoriesLive),
)

// Config-driven
export const SreamRuntimeLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const { mode } = yield* DeploymentModeConfig
    switch (mode) {
      case 'test': return SreamTestLayer
      case 'cluster': return SreamClusterLayer
    }
  })
)
```

---

## 8. Test Layer Pattern

**Source:** `src/lib/iiot/__tests__/integration/layer.ts`

Integration tests use a dedicated PgClient with:
- Hardcoded connection matching docker-compose
- `transformResultNames` for snake→camel
- Migration auto-run during layer construction
- Clean-up utilities for test isolation

```typescript
export const TestPgClient = PgClient.layer({
  host: 'localhost',
  port: 5433,
  database: 'iiot_mock',
  username: 'iiot',
  password: Redacted.make('iiot_dev'),
  maxConnections: 5,
  transformResultNames,
})

// Fresh memory journal per test
const makeTestEventJournalLayer = () => Layer.fresh(EventJournal.layerMemory)
```

---

## File Structure for SREAM Persistence

```
src/lib/sream/
├── models/
│   ├── _common.ts                        # Shared transforms (CreatedAt, OptionalMetadata, etc.)
│   ├── _migrations.ts                    # Migrator.fromRecord aggregation
│   ├── RequirementModel.ts               # Model.Class for requirements table
│   ├── RequirementModel.ddl.ts           # CREATE TABLE, indexes, constraints
│   ├── RequirementTransitionModel.ts     # Model.Class for audit trail
│   └── RequirementTransitionModel.ddl.ts # Append-only table + immutability trigger
│
├── repos/
│   ├── _decode.ts                        # Can import from iiot or create own
│   ├── index.ts                          # Barrel + composed layer
│   ├── RequirementRepo.ts               # CRUD + query methods
│   └── RequirementTransitionRepo.ts      # Append-only audit queries
│
├── state/
│   ├── StateShape.ts                     # RequirementStateShape interface
│   ├── RequirementState.ts              # Context.Tag + InMemory + SQL factory
│   └── index.ts                          # AllStateServicesInMemory
│
├── infrastructure/
│   ├── eventlog-layer.ts                # SreamEventLogSchema + Stack layers
│   └── feature-flags.ts                 # sreamEventSourcingEnabled
│
├── layers/
│   └── index.ts                          # SreamTestLayer, SreamClusterLayer, SreamRuntimeLayer
```
