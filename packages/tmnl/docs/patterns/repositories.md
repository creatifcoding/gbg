# Repository Patterns

## Overview

Repositories provide the SQL persistence layer, bridging between `@effect/sql` Model types and the domain schema types consumed by state services and entity handlers.

Each repository follows a consistent pattern:
1. **Context.Tag** for dependency injection
2. **Interface** defining the contract
3. **Layer.effect** implementation using `SqlClient`
4. **Decode utilities** for null-to-Option transforms on raw SQL results

## Repository Structure

```typescript
// src/lib/iiot/repos/SiteRepo.ts

import { Context, Layer, Effect, Option, ParseResult } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { SiteId, EnterpriseId } from '../schemas/identifiers'
import { SiteModel } from '../models/assets/SiteModel'
import { decodeOptional, decodeRows, decodeFirst, prepareUpdate } from './_decode'

// Error type alias
export type SiteRepoError = SqlError.SqlError | ParseResult.ParseError

// Repository interface (the contract)
export interface SiteRepository {
  readonly findById: (id: SiteId) => Effect.Effect<Option.Option<SiteModel>, SiteRepoError>
  readonly findByEnterprise: (enterpriseId: EnterpriseId) => Effect.Effect<readonly SiteModel[], SiteRepoError>
  readonly findAll: () => Effect.Effect<readonly SiteModel[], SiteRepoError>
  readonly insert: (site: typeof SiteModel.insert.Type) => Effect.Effect<SiteModel, SiteRepoError>
  readonly update: (site: typeof SiteModel.update.Type) => Effect.Effect<SiteModel, SiteRepoError>
  readonly delete: (id: SiteId) => Effect.Effect<void, SqlError.SqlError>
}

// Context tag
export class SiteRepo extends Context.Tag('iiot/SiteRepo')<
  SiteRepo,
  SiteRepository
>() {}

// Implementation
export const SiteRepoLive = Layer.effect(
  SiteRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    // ... implementation
  })
)
```

## Decode Utilities

The `_decode.ts` module provides helpers that transform raw SQL rows into properly typed Model instances, handling null-to-Option conversions:

| Utility | Purpose | Returns |
|---------|---------|---------|
| `decodeOptional(Model)` | Decode 0-or-1 rows | `Option<Model>` |
| `decodeFirst(Model)` | Decode exactly 1 row (fails if empty) | `Model` |
| `decodeRows(Model)` | Decode array of rows | `readonly Model[]` |
| `prepareUpdate(model)` | Extract non-null fields for SQL UPDATE | `Record<string, unknown>` |

Usage in a repository:

```typescript
const findById = (id: SiteId) =>
  Effect.gen(function* () {
    const rows = yield* sql`
      SELECT ${selectColumns}
      FROM iiot.sites
      WHERE id = ${id}
      LIMIT 1
    `
    return yield* decodeOptional(SiteModel)(rows)
  })

const findAll = () =>
  Effect.gen(function* () {
    const rows = yield* sql`
      SELECT ${selectColumns}
      FROM iiot.sites
      ORDER BY name ASC
    `
    return yield* decodeRows(SiteModel)(rows)
  })

const insert = (site: typeof SiteModel.insert.Type) =>
  Effect.gen(function* () {
    const rows = yield* sql`
      INSERT INTO iiot.sites (id, name, status, ...)
      VALUES (${site.id}, ${site.name}, ${site.status}, ...)
      RETURNING ${selectColumns}
    `
    return yield* decodeFirst(SiteModel)(rows)
  })
```

## Column Alias Pattern

SQL column names use `snake_case`, but TypeScript models use `camelCase`. The repository defines a shared column alias fragment:

```typescript
const selectColumns = sql`
  id,
  name,
  status,
  hierarchy_path AS "hierarchyPath",
  enterprise_id AS "enterpriseId",
  timezone,
  description,
  address,
  city,
  country,
  location,
  metadata,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`
```

This fragment is reused in all SELECT queries to avoid duplicating alias mappings.

## Update Pattern

Updates use `sql.update()` with `prepareUpdate()` to build dynamic SET clauses:

```typescript
const update = (site: typeof SiteModel.update.Type) =>
  Effect.gen(function* () {
    const changes = prepareUpdate(site)  // Extract non-null fields
    const rows = yield* sql`
      UPDATE iiot.sites
      SET ${sql.update(changes, ['id'])}, updated_at = NOW()
      WHERE id = ${site.id}
      RETURNING ${selectColumns}
    `
    return yield* decodeFirst(SiteModel)(rows)
  })
```

The `prepareUpdate()` function:
- Takes a partial model object
- Filters out `undefined` and `null` fields
- Returns only the fields that should be SET
- Excludes the `id` field from SET (it's in the WHERE clause)

## Option Handling in Inserts

Optional fields (stored as `Option<T>` in schemas) are unwrapped for SQL:

```typescript
const insert = (site: typeof SiteModel.insert.Type) =>
  Effect.gen(function* () {
    const rows = yield* sql`
      INSERT INTO iiot.sites (
        id, name, status, hierarchy_path, enterprise_id,
        timezone, description, address, city, country,
        location, metadata
      )
      VALUES (
        ${site.id},
        ${site.name},
        ${site.status},
        ${site.hierarchyPath},
        ${site.enterpriseId},
        ${site.timezone},
        ${Option.getOrNull(site.description)},        // Option -> null
        ${Option.getOrNull(site.address)},
        ${Option.getOrNull(site.city)},
        ${Option.getOrNull(site.country)},
        ${Option.match(site.location, {               // Option -> JSON | null
          onNone: () => null,
          onSome: (v) => JSON.stringify(v)
        })},
        ${Option.match(site.metadata, {
          onNone: () => '{}',
          onSome: (v) => JSON.stringify(v)
        })}
      )
      RETURNING ${selectColumns}
    `
    return yield* decodeFirst(SiteModel)(rows)
  })
```

## Repository Inventory

All repositories follow the same pattern:

| Repository | Entity | Special Methods |
|------------|--------|-----------------|
| `SiteRepo` | Site | `findByEnterprise()` |
| `AreaRepo` | Area | `findBySite()` |
| `PlantRepo` | Plant | `findByArea()` |
| `LineRepo` | Line | `findByPlant()` |
| `WorkCellRepo` | WorkCell | `findByLine()` |
| `MachineRepo` | Machine | `findByWorkCell()` |
| `SensorRepo` | Sensor | `findByDeviceId()` |
| `DeviceRepo` | Device | `findByMachine()` |
| `EnterpriseRepo` | Enterprise | (standard CRUD) |
| `AlarmRepo` | Alarm | `query({deviceId, severity, onlyOpen, since})` |
| `WorkOrderRepo` | WorkOrder | `findByStatus()` |
| `EquipmentStateRepo` | EquipmentState | `findByMachine()`, `findActive()`, `endState()` |
| `SensorReadingRepo` | SensorReading | Time-series queries |
| `AggregatedReadingRepo` | AggregatedReading | Rollup queries |
| `AlarmContextRepo` | AlarmContext | Materialized view queries |
| `DeviceConfigRepo` | DeviceConfig | `findByDevice()` |
| `AnalyticsRecordRepo` | AnalyticsRecord | Analytics queries |

## Model-Schema Bridge

Repositories return **Model** types (from `@effect/sql`), but entity handlers consume **Schema** types (from `effect`). The bridge lives in the **Layer composition**:

```typescript
// src/lib/iiot/layers/index.ts

const SiteStateSqlLayer: Layer.Layer<SiteState, never, SiteRepo> =
  Layer.effect(
    SiteState,
    Effect.gen(function* () {
      const repo = yield* SiteRepo
      return makeSiteStateSql({
        findById: (id) => repo.findById(id) as any,
        findAll: (_filter) => repo.findAll() as any,
        insert: (site) => repo.insert(site as any) as any,
        update: (site) => repo.update(site as any) as any,
        delete: (id) => repo.delete(id).pipe(Effect.map(() => true)),
      })
    })
  )
```

This adapter pattern means:
- **Repos** deal with Model types (SQL-optimized)
- **State services** deal with Schema types (domain-optimized)
- **Layers** bridge the gap with structural compatibility assertions

---

## Agent Quick Reference

### Key Imports

```typescript
import { Context, Layer, Effect, Option } from 'effect'
import { SqlClient, SqlError } from '@effect/sql'
import { Model } from '@effect/sql'
```

### Minimal Example

```typescript
// 1. Define interface
interface SiteRepository {
  readonly findById: (id: SiteId) => Effect.Effect<Option.Option<SiteModel>, SiteRepoError>
  readonly insert: (site: typeof SiteModel.insert.Type) => Effect.Effect<SiteModel, SiteRepoError>
}

// 2. Context tag
class SiteRepo extends Context.Tag('iiot/SiteRepo')<SiteRepo, SiteRepository>() {}

// 3. Implementation
const SiteRepoLive = Layer.effect(
  SiteRepo,
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    return {
      findById: (id) => Effect.gen(function* () {
        const rows = yield* sql`SELECT ${selectColumns} FROM iiot.sites WHERE id = ${id}`
        return yield* decodeOptional(SiteModel)(rows)
      }),
      insert: (site) => Effect.gen(function* () {
        const rows = yield* sql`INSERT INTO iiot.sites (...) VALUES (...) RETURNING ${selectColumns}`
        return yield* decodeFirst(SiteModel)(rows)
      }),
    }
  })
)
```

### Common Pitfalls

- Returning raw SQL rows without `decodeOptional`/`decodeRows`/`decodeFirst` -- loses null-to-Option transforms and type safety
- Forgetting column aliases (`hierarchy_path AS "hierarchyPath"`) -- camelCase model fields won't match snake_case columns
- Using `Option.getOrUndefined` instead of `Option.getOrNull` in INSERT values -- SQL expects null, not undefined
- Skipping `prepareUpdate()` in UPDATE queries -- manually building SET clauses leads to updating null fields
- Putting Model-to-Schema conversion in the repository -- the bridge belongs in Layer composition, not the repo
- Not defining a `selectColumns` fragment -- duplicating alias mappings across queries causes drift

### Cross-References

- [effect-sql.md](./effect-sql.md) -- Model.Class, NullableJsonFromString, SqliteBoolean transforms
- [schemas.md](./schemas.md) -- Domain Schema types that repos bridge to via Layers
- [entities.md](./entities.md) -- Entity handlers consume State services backed by repos
- [effect-services.md](./effect-services.md) -- Context.Tag, Layer.effect patterns
