# Effect SQL + SQLite Patterns

> **Source**: `.edin/EFFECT_SQL_SQLITE_PATTERNS.md`
> **Last consolidated**: 2026-02-09

## Overview

Critical patterns discovered when using `@effect/sql` Model with SQLite (via `@effect/sql-sqlite-bun`). These gotchas also apply to PostgreSQL in different ways -- the decision matrix below highlights where they diverge.

---

## TL;DR Decision Matrix

| Field Type | PostgreSQL | SQLite |
|------------|------------|--------|
| Nullable JSON | `Model.FieldOption(Model.JsonFromString)` | Custom `NullableJsonFromString` |
| DateTime Insert | `Model.DateTimeInsertFromDate` | `Model.DateTimeInsert` |
| DateTime Update | `Model.DateTimeUpdateFromDate` | `Model.DateTimeUpdate` |
| Client-provided ID | `Model.GeneratedByApp(Id)` | `Model.GeneratedByApp(Id)` |
| Auto-increment ID | `Model.Generated(Schema.Int)` | `Model.Generated(Schema.Int)` |
| Boolean | `Schema.Boolean` | Custom `SqliteBoolean` |

---

## Issue 1: Nullable JSON Fields

### Problem

`Model.FieldOption(Model.JsonFromString(Schema.Unknown))` encodes `Option.none()` as `"null"` (string), not `null` (SQL NULL).

Additionally, using `Schema.Option(A)` has encoded form `{ _tag: "None" | "Some" }`, which causes "_tag is missing" errors when decoding SELECT results.

### Solution

Create a custom transform using `Schema.OptionFromSelf`:

```typescript
const NullableJsonFromString = Schema.transform(
  Schema.NullOr(Schema.String), // DB: null | string
  Schema.OptionFromSelf(Schema.Unknown), // TS: Option<unknown>
  {
    strict: true,
    decode: (encoded) =>
      encoded === null ? Option.none() : Option.some(JSON.parse(encoded)),
    encode: (decoded) =>
      Option.isNone(decoded) ? null : JSON.stringify(decoded.value),
  }
)
```

### Key Insight

- `Schema.Option(A)`: Encoded = `{ _tag: "None" | "Some", value?: A }` (extra layer)
- `Schema.OptionFromSelf(A)`: Encoded = `Option<A>` directly (no extra layer)

---

## Issue 2: DateTime Fields

### Problem

`Model.DateTimeInsertFromDate` and `Model.DateTimeUpdateFromDate` encode to `Date` objects, but SQLite only accepts: `string`, `number`/`bigint`, `boolean`, `null`, `TypedArray`.

Error: `Binding expected string, TypedArray, boolean, number, bigint or null`

### Solution

Use the ISO string variants:

```typescript
// WRONG for SQLite
createdAt: Model.DateTimeInsertFromDate,
updatedAt: Model.DateTimeUpdateFromDate,

// CORRECT for SQLite
createdAt: Model.DateTimeInsert, // ISO string: "2025-12-10T18:00:00.000Z"
updatedAt: Model.DateTimeUpdate,
```

### Canonical Reference

- `Model.DateTimeInsert` / `Model.DateTimeUpdate` -- ISO string
- `Model.DateTimeInsertFromNumber` / `Model.DateTimeUpdateFromNumber` -- epoch ms
- `Model.DateTimeInsertFromDate` / `Model.DateTimeUpdateFromDate` -- `Date` object (PostgreSQL)

---

## Issue 3: Client-Provided IDs

### Problem

`Model.Generated(Id)` strips the `id` field from the insert schema (assumes database generates it). For SQLite TEXT PRIMARY KEY (not auto-increment), the application provides the ID.

Error: `Expected string, actual null` (id not in INSERT)

### Solution

Use `Model.GeneratedByApp` for client-provided IDs:

```typescript
// WRONG - strips id from insert schema
id: Model.Generated(SiteId),

// CORRECT - includes id in insert schema
id: Model.GeneratedByApp(SiteId),
```

### Canonical Reference

- `Model.Generated(Schema)` -- Database generates (omit from INSERT)
- `Model.GeneratedByApp(Schema)` -- Application generates (include in INSERT)

---

## Issue 4: Boolean Fields

### Problem

SQLite stores booleans as `0/1` integers, but `Schema.Boolean` expects `true/false`.

Error: `Expected boolean, actual 0`

### Solution

Create a transform schema:

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

// Usage
isMobile: SqliteBoolean, // not Schema.Boolean
```

---

## Issue 5: repo.findById() Returns Option

### Problem

`Model.makeRepository(...).findById(id)` returns `Effect<Option<T>>`, not `Effect<T>`.

Tests that do `const found = yield* repo.findById(id)` get an `Option`, not the model.

### Solution

```typescript
// WRONG - found is Option<T>
const found = yield* repo.findById(id)
expect(found.name).toBe("...") // undefined!

// CORRECT - unwrap Option
const found = Option.getOrThrow(yield* repo.findById(id))
expect(found.name).toBe("...") // works

// For checking non-existence
const result = yield* repo.findById(id)
expect(Option.isNone(result)).toBe(true)
```

---

## Complete Model Example

```typescript
import { Option, Schema } from 'effect'
import { Model } from '@effect/sql'

// SQLite-compatible helpers
const NullableJsonFromString = Schema.transform(
  Schema.NullOr(Schema.String),
  Schema.OptionFromSelf(Schema.Unknown),
  {
    strict: true,
    decode: (e) => e === null ? Option.none() : Option.some(JSON.parse(e)),
    encode: (d) => Option.isNone(d) ? null : JSON.stringify(d.value),
  }
)

const SqliteBoolean = Schema.transform(
  Schema.Union(Schema.Literal(0), Schema.Literal(1), Schema.Boolean),
  Schema.Boolean,
  {
    strict: true,
    decode: (e) => e === 1 || e === true,
    encode: (d) => d ? 1 : 0,
  }
)

// Model definition
export class AssetModel extends Model.Class<AssetModel>('AssetModel')({
  id: Model.GeneratedByApp(AssetId),           // Client-provided TEXT PK
  name: Schema.NonEmptyTrimmedString,
  isActive: SqliteBoolean,                      // 0/1 -> boolean
  metadataJson: NullableJsonFromString,         // null | JSON string -> Option
  createdAt: Model.DateTimeInsert,              // ISO string
  updatedAt: Model.DateTimeUpdate,              // ISO string
}) {}

// Repository
export const makeAssetRepository = Model.makeRepository(AssetModel, {
  tableName: 'assets',
  idColumn: 'id',
  spanPrefix: 'AssetRepository',
})
```

---

## Testing Pattern

```typescript
import { describe, test, expect } from 'bun:test'
import { Effect, Option } from 'effect'

const runTest = <A, E>(effect: Effect.Effect<A, E, any>) =>
  Effect.runPromise(effect.pipe(Effect.provide(SqliteTestLayer)))

describe('Repository', () => {
  test('CRUD operations', async () => {
    await runTest(
      Effect.gen(function* () {
        const repo = yield* makeAssetRepository

        // Insert
        const asset = yield* repo.insert(
          AssetModel.insert.make({
            id: 'asset-001' as AssetId,
            name: 'Test Asset',
            isActive: true,
            metadataJson: Option.some({ key: 'value' }),
          })
        )
        expect(asset.id).toBe('asset-001')

        // Find (returns Option!)
        const found = Option.getOrThrow(yield* repo.findById(asset.id))
        expect(found.name).toBe('Test Asset')

        // Delete + verify gone
        yield* repo.delete(asset.id)
        const result = yield* repo.findById(asset.id)
        expect(Option.isNone(result)).toBe(true)
      })
    )
  })
})
```

---

## Test Execution Strategy

**Critical**: `@effect/vitest` requires vitest context, and `@effect/sql-sqlite-bun` requires bun runtime.

### Dual Test Runner Setup

| Runner | Command | File Pattern | Notes |
|--------|---------|--------------|-------|
| **Vitest** | `bunx vitest run src/lib/ams/v2/` | `*.test.ts` (excluding `*.bun.test.ts`) | Effect tests with `it.effect()` |
| **Bun test** | `bun test *.bun.test.ts` | `*.bun.test.ts` | SQLite tests using `bun:sqlite` |

### Configuration

**vitest.config.ts** must exclude bun-specific tests:
```typescript
test: {
  exclude: [
    "**/node_modules/**",
    "**/*.bun.test.ts", // Run with `bun test` instead
  ],
}
```

---

## Agent Quick Reference

### Key Imports

```typescript
import { Model } from '@effect/sql'
import { Schema, Option } from 'effect'
```

### Minimal Example

```typescript
class MyModel extends Model.Class<MyModel>('MyModel')({
  id: Model.GeneratedByApp(Schema.String),
  name: Schema.String,
  createdAt: Model.DateTimeInsert,
}) {}

const repo = Model.makeRepository(MyModel, {
  tableName: 'my_table',
  idColumn: 'id',
  spanPrefix: 'MyRepo',
})
```

### Common Pitfalls

- Using `Model.Generated(Id)` when the app provides the ID -- use `Model.GeneratedByApp(Id)` instead
- Using `Model.DateTimeInsertFromDate` with SQLite -- use `Model.DateTimeInsert` (ISO string)
- Expecting `repo.findById()` to return `T` -- it returns `Option<T>`, unwrap with `Option.getOrThrow()`
- Using `Schema.Boolean` with SQLite -- create a `SqliteBoolean` transform for `0/1`
- Using `Schema.Option(A)` for nullable JSON -- use `Schema.OptionFromSelf(A)` with custom transform

### Cross-References

- [repositories.md](./repositories.md) -- repository patterns and column alias pattern
- [effect-testing.md](./effect-testing.md) -- dual test runner setup
- [effect-core.md](./effect-core.md) -- foundational Effect patterns
