/**
 * Spike: Nullable JSON encoding investigation
 *
 * Tests different approaches to nullable JSON fields in @effect/sql Model
 */

import { Effect, Option, Schema, Console } from 'effect'
import { Model } from '@effect/sql'

// ─────────────────────────────────────────────────────────────────────────────
// Test 1: Schema.OptionFromNullOr directly
// ─────────────────────────────────────────────────────────────────────────────

const TestSchema1 = Schema.OptionFromNullOr(Schema.parseJson(Schema.Unknown))

const test1 = Effect.gen(function* () {
  yield* Console.log('\n=== Test 1: Schema.OptionFromNullOr(parseJson) ===')

  // Encode Option.none() -> should be null
  const encoded1 = yield* Schema.encode(TestSchema1)(Option.none())
  yield* Console.log(`Option.none() encodes to: ${JSON.stringify(encoded1)} (type: ${typeof encoded1})`)

  // Encode Option.some({foo: "bar"}) -> should be '{"foo":"bar"}'
  const encoded2 = yield* Schema.encode(TestSchema1)(Option.some({ foo: 'bar' }))
  yield* Console.log(`Option.some({foo:"bar"}) encodes to: ${JSON.stringify(encoded2)} (type: ${typeof encoded2})`)
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 2: Model.FieldOption + Model.JsonFromString composition
// ─────────────────────────────────────────────────────────────────────────────

class TestModel extends Model.Class<TestModel>('TestModel')({
  id: Schema.String,
  jsonField: Model.FieldOption(Model.JsonFromString(Schema.Unknown)),
}) {}

const test2 = Effect.gen(function* () {
  yield* Console.log('\n=== Test 2: Model.FieldOption(JsonFromString) ===')

  // Check what the insert schema looks like
  yield* Console.log(`Insert schema type: ${TestModel.insert.ast._tag}`)

  // Create an insert payload with Option.none()
  const payload = TestModel.insert.make({
    id: 'test-1',
    jsonField: Option.none(),
  })
  yield* Console.log(`Payload: ${JSON.stringify(payload)}`)
  yield* Console.log(`jsonField type: ${Object.prototype.toString.call(payload.jsonField)}`)
  yield* Console.log(`jsonField._tag: ${(payload.jsonField as any)?._tag}`)

  // Try to encode the payload using the insert schema
  const encoded = yield* Schema.encode(TestModel.insert)(payload)
  yield* Console.log(`Encoded payload: ${JSON.stringify(encoded)}`)
  yield* Console.log(`Encoded jsonField: ${JSON.stringify(encoded.jsonField)} (type: ${typeof encoded.jsonField})`)
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 3: Custom NullableJsonFromString (FIXED)
// ─────────────────────────────────────────────────────────────────────────────

// WRONG: Schema.Option has its own encoded form { _tag: "None" | "Some" }
// This creates: null | string ↔ { _tag: ... } ↔ Option<unknown>
const NullableJsonFromString_WRONG = Schema.transform(
  Schema.NullOr(Schema.String),
  Schema.Option(Schema.Unknown), // <-- Problem: this has OptionEncoded
  {
    strict: true,
    decode: (encoded) =>
      encoded === null ? Option.none() : Option.some(JSON.parse(encoded)),
    encode: (decoded) =>
      Option.isNone(decoded) ? null : JSON.stringify(decoded.value),
  }
)

// CORRECT: Schema.OptionFromSelf treats Option as the encoded form itself
// This creates: null | string ↔ Option<unknown>
const NullableJsonFromString = Schema.transform(
  Schema.NullOr(Schema.String),
  Schema.OptionFromSelf(Schema.Unknown), // <-- Option IS the encoded form
  {
    strict: true,
    decode: (encoded) =>
      encoded === null ? Option.none() : Option.some(JSON.parse(encoded)),
    encode: (decoded) =>
      Option.isNone(decoded) ? null : JSON.stringify(decoded.value),
  }
)

const test3 = Effect.gen(function* () {
  yield* Console.log('\n=== Test 3: Custom NullableJsonFromString ===')

  const encoded1 = yield* Schema.encode(NullableJsonFromString)(Option.none())
  yield* Console.log(`Option.none() encodes to: ${JSON.stringify(encoded1)} (type: ${typeof encoded1})`)

  const encoded2 = yield* Schema.encode(NullableJsonFromString)(Option.some({ foo: 'bar' }))
  yield* Console.log(`Option.some({foo:"bar"}) encodes to: ${JSON.stringify(encoded2)} (type: ${typeof encoded2})`)
})

// ─────────────────────────────────────────────────────────────────────────────
// Run all tests
// ─────────────────────────────────────────────────────────────────────────────

const main = Effect.gen(function* () {
  yield* Console.log('Nullable JSON Encoding Spike')
  yield* Console.log('============================')

  yield* test1.pipe(Effect.catchAll((e) => Console.error(`Test 1 failed: ${e}`)))
  yield* test2.pipe(Effect.catchAll((e) => Console.error(`Test 2 failed: ${e}`)))
  yield* test3.pipe(Effect.catchAll((e) => Console.error(`Test 3 failed: ${e}`)))

  yield* Console.log('\n=== Done ===')
})

// ─────────────────────────────────────────────────────────────────────────────
// Test 4: Full SQLite integration with custom NullableJsonFromString
// ─────────────────────────────────────────────────────────────────────────────

import { SqliteClient } from '@effect/sql-sqlite-bun'
import { SqlClient } from '@effect/sql'
import { Layer } from 'effect'

class TestModel4 extends Model.Class<TestModel4>('TestModel4')({
  id: Schema.String,
  jsonField: NullableJsonFromString,
}) {}

// Test with DateTime fields like the actual models
// WRONG for SQLite: DateTimeInsertFromDate encodes to Date object
class TestModel5_WRONG extends Model.Class<TestModel5_WRONG>('TestModel5_WRONG')({
  id: Schema.String,
  jsonField: NullableJsonFromString,
  createdAt: Model.DateTimeInsertFromDate,
  updatedAt: Model.DateTimeUpdateFromDate,
}) {}

// CORRECT for SQLite: DateTimeInsert encodes to ISO string
class TestModel5 extends Model.Class<TestModel5>('TestModel5')({
  id: Schema.String,
  jsonField: NullableJsonFromString,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}

const test4 = Effect.gen(function* () {
  yield* Console.log('\n=== Test 4: Full SQLite Integration ===')

  const sql = yield* SqlClient.SqlClient

  // Create table
  yield* sql`CREATE TABLE IF NOT EXISTS test_nullable (id TEXT PRIMARY KEY, json_field TEXT)`
  yield* Console.log('Table created')

  // Create repository
  const repo = yield* Model.makeRepository(TestModel4, {
    tableName: 'test_nullable',
    idColumn: 'id',
    spanPrefix: 'TestRepository',
  })
  yield* Console.log('Repository created')

  // Insert with Option.none()
  yield* Console.log('Attempting insert with Option.none()...')
  const payload = TestModel4.insert.make({
    id: 'test-1',
    jsonField: Option.none(),
  })
  yield* Console.log(`Payload: ${JSON.stringify(payload)}`)

  const encoded = yield* Schema.encode(TestModel4.insert)(payload)
  yield* Console.log(`Encoded: ${JSON.stringify(encoded)}`)
  yield* Console.log(`Encoded jsonField type: ${typeof encoded.jsonField}`)
  yield* Console.log(`Encoded jsonField value: ${encoded.jsonField}`)

  const result = yield* repo.insert(payload)
  yield* Console.log(`Insert successful! Result: ${JSON.stringify(result)}`)
})

const test5 = Effect.gen(function* () {
  yield* Console.log('\n=== Test 5: SQLite with DateTime fields ===')

  const sql = yield* SqlClient.SqlClient

  // Create table with datetime columns
  yield* sql`CREATE TABLE IF NOT EXISTS test_datetime (
    id TEXT PRIMARY KEY,
    json_field TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`
  yield* Console.log('Table created')

  // First, let's see what DateTimeInsertFromDate encodes to
  const payload = TestModel5.insert.make({
    id: 'test-dt-1',
    jsonField: Option.none(),
  })
  yield* Console.log(`Payload: ${JSON.stringify(payload, (_, v) => v instanceof Date ? `[Date: ${v.toISOString()}]` : v)}`)
  yield* Console.log(`createdAt type: ${Object.prototype.toString.call(payload.createdAt)}`)

  const encoded = yield* Schema.encode(TestModel5.insert)(payload)
  yield* Console.log(`Encoded: ${JSON.stringify(encoded, (_, v) => v instanceof Date ? `[Date: ${v.toISOString()}]` : v)}`)
  yield* Console.log(`Encoded createdAt type: ${Object.prototype.toString.call(encoded.createdAt)}`)
  yield* Console.log(`Encoded createdAt value: ${encoded.createdAt}`)

  // Create repository
  const repo = yield* Model.makeRepository(TestModel5, {
    tableName: 'test_datetime',
    idColumn: 'id',
    spanPrefix: 'TestRepository5',
  })
  yield* Console.log('Repository created')

  // Try to insert
  yield* Console.log('Attempting insert...')
  const result = yield* repo.insert(payload)
  yield* Console.log(`Insert successful! Result: ${JSON.stringify(result)}`)
})

const SqliteTestLayer = Layer.effectDiscard(
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    yield* sql`CREATE TABLE IF NOT EXISTS test_nullable (id TEXT PRIMARY KEY, json_field TEXT)`
  })
).pipe(
  Layer.provideMerge(
    SqliteClient.layer({
      filename: ':memory:',
      transformResultNames: (s: string) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      transformQueryNames: (s: string) => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`),
    })
  )
)

Effect.runPromise(main).catch(console.error)

// Run test 4 separately with SQLite layer
Effect.runPromise(
  test4.pipe(
    Effect.catchAll((e) => Console.error(`Test 4 failed: ${String(e)}`)),
    Effect.provide(SqliteTestLayer)
  )
).catch(console.error)

// Run test 5 with DateTime fields
Effect.runPromise(
  test5.pipe(
    Effect.catchAll((e) => Console.error(`Test 5 failed: ${String(e)}`)),
    Effect.provide(SqliteTestLayer)
  )
).catch(console.error)

// ─────────────────────────────────────────────────────────────────────────────
// Test 6: findById debugging - check what SELECT returns
// ─────────────────────────────────────────────────────────────────────────────

// Model with name field for debugging
class TestModel6 extends Model.Class<TestModel6>('TestModel6')({
  id: Schema.String,
  name: Schema.NonEmptyTrimmedString,
  jsonField: NullableJsonFromString,
  createdAt: Model.DateTimeInsert,
  updatedAt: Model.DateTimeUpdate,
}) {}

const test6 = Effect.gen(function* () {
  yield* Console.log('\n=== Test 6: findById debugging ===')

  const sql = yield* SqlClient.SqlClient

  yield* sql`CREATE TABLE IF NOT EXISTS test_find (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    json_field TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`

  // Direct SQL insert
  yield* sql`INSERT INTO test_find (id, name, json_field, created_at, updated_at)
             VALUES ('test-6', 'Test Name', NULL, '2025-01-01T00:00:00Z', '2025-01-01T00:00:00Z')`
  yield* Console.log('Direct SQL insert done')

  // Raw SELECT to see what columns return
  const rawRows = yield* sql`SELECT * FROM test_find WHERE id = 'test-6'`
  yield* Console.log(`Raw SELECT: ${JSON.stringify(rawRows)}`)

  // Now try with repo
  const repo = yield* Model.makeRepository(TestModel6, {
    tableName: 'test_find',
    idColumn: 'id',
    spanPrefix: 'Test6Repo',
  })

  // Insert via repo
  const inserted = yield* repo.insert(TestModel6.insert.make({
    id: 'test-6-repo',
    name: 'Test Name',
    jsonField: Option.some({ key: 'value' }),
  }))
  yield* Console.log(`Repo insert result: ${JSON.stringify(inserted)}`)

  // Raw SELECT on repo-inserted row
  const rawRows2 = yield* sql`SELECT * FROM test_find WHERE id = 'test-6-repo'`
  yield* Console.log(`Raw SELECT on repo row: ${JSON.stringify(rawRows2)}`)

  // findById
  const found = yield* repo.findById('test-6-repo')
  yield* Console.log(`findById result: ${JSON.stringify(found)}`)
})

Effect.runPromise(
  test6.pipe(
    Effect.catchAll((e) => Console.error(`Test 6 failed: ${String(e)}`)),
    Effect.provide(SqliteTestLayer)
  )
).catch(console.error)
