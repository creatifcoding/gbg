/**
 * Persistence Module Tests
 *
 * Tests for SQLite patterns using in-memory databases
 * Uses bun:test due to @effect/sql-sqlite-bun dependency
 */

import { describe, it, expect } from "bun:test"
import { Effect } from "effect"
import { SqlClient } from "@effect/sql"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import {
  createSqliteLayer,
  ensureTable,
  initializeSchema,
  runMigrations,
  createRepository,
  withTransaction,
  XDG,
  getAppPaths,
  type TableDef,
  type Migration,
} from "../src/persistence/index.js"

// Helper to run scoped Effect tests
const runScoped = <A, E>(effect: Effect.Effect<A, E, SqlClient.SqlClient>) =>
  Effect.runPromise(
    Effect.scoped(
      effect.pipe(
        Effect.provide(SqliteClient.layer({ filename: ":memory:" }))
      )
    )
  )

describe("createSqliteLayer", () => {
  it("creates layer with filename", () => {
    const layer = createSqliteLayer({ filename: ":memory:" })
    expect(layer).toBeDefined()
  })
})

describe("ensureTable", () => {
  const testTable: TableDef = {
    name: "test_table",
    columns: "id TEXT PRIMARY KEY, name TEXT NOT NULL",
    indexes: [
      "CREATE INDEX IF NOT EXISTS idx_test_name ON test_table(name)",
    ],
  }

  it("creates table if not exists", async () => {
    await runScoped(
      Effect.gen(function* () {
        yield* ensureTable(testTable)

        const sql = yield* SqlClient.SqlClient
        const rows = yield* sql`SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'`
        expect(rows.length).toBe(1)
      })
    )
  })

  it("creates indexes", async () => {
    await runScoped(
      Effect.gen(function* () {
        yield* ensureTable(testTable)

        const sql = yield* SqlClient.SqlClient
        const rows = yield* sql`SELECT name FROM sqlite_master WHERE type='index' AND name='idx_test_name'`
        expect(rows.length).toBe(1)
      })
    )
  })

  it("is idempotent", async () => {
    await runScoped(
      Effect.gen(function* () {
        yield* ensureTable(testTable)
        yield* ensureTable(testTable) // Should not throw

        const sql = yield* SqlClient.SqlClient
        const rows = yield* sql`SELECT name FROM sqlite_master WHERE type='table' AND name='test_table'`
        expect(rows.length).toBe(1)
      })
    )
  })
})

describe("initializeSchema", () => {
  const tables: TableDef[] = [
    { name: "table_a", columns: "id TEXT PRIMARY KEY" },
    { name: "table_b", columns: "id TEXT PRIMARY KEY, a_id TEXT REFERENCES table_a(id)" },
  ]

  it("initializes multiple tables", async () => {
    await runScoped(
      Effect.gen(function* () {
        yield* initializeSchema(tables)

        const sql = yield* SqlClient.SqlClient
        const rows = yield* sql`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('table_a', 'table_b')`
        expect(rows.length).toBe(2)
      })
    )
  })
})

describe("runMigrations", () => {
  const migrations: Migration[] = [
    {
      version: 1,
      description: "Create users table",
      up: (sql) =>
        sql.unsafe("CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT)").pipe(
          Effect.asVoid,
          Effect.orDie
        ),
    },
    {
      version: 2,
      description: "Add email column",
      up: (sql) =>
        sql.unsafe("ALTER TABLE users ADD COLUMN email TEXT").pipe(
          Effect.asVoid,
          Effect.orDie
        ),
    },
  ]

  it("creates _migrations table", async () => {
    await runScoped(
      Effect.gen(function* () {
        yield* runMigrations([])

        const sql = yield* SqlClient.SqlClient
        const rows = yield* sql`SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'`
        expect(rows.length).toBe(1)
      })
    )
  })

  it("applies pending migrations in order", async () => {
    await runScoped(
      Effect.gen(function* () {
        yield* runMigrations(migrations)

        const sql = yield* SqlClient.SqlClient

        // Check migrations were recorded
        const migrationRows = yield* sql<{ version: number }>`SELECT version FROM _migrations ORDER BY version`
        expect(migrationRows.length).toBe(2)
        expect(migrationRows[0].version).toBe(1)
        expect(migrationRows[1].version).toBe(2)

        // Check users table has email column
        const tableInfo = yield* sql.unsafe("PRAGMA table_info(users)")
        const columns = (tableInfo as Array<{ name: string }>).map((r) => r.name)
        expect(columns).toContain("email")
      })
    )
  })

  it("skips already applied migrations", async () => {
    await runScoped(
      Effect.gen(function* () {
        // Apply first migration
        yield* runMigrations([migrations[0]])

        const sql = yield* SqlClient.SqlClient
        let migrationRows = yield* sql<{ version: number }>`SELECT version FROM _migrations`
        expect(migrationRows.length).toBe(1)

        // Apply all migrations (should only apply second)
        yield* runMigrations(migrations)

        migrationRows = yield* sql<{ version: number }>`SELECT version FROM _migrations`
        expect(migrationRows.length).toBe(2)
      })
    )
  })
})

describe("createRepository", () => {
  it("returns tableName and config", () => {
    const repo = createRepository({
      tableName: "items",
      idColumn: "id",
      parseRow: (row: unknown) => row as { id: string },
      toInsertValues: (input: { name: string }) => ({ name: input.name }),
      toUpdateValues: (input: { name?: string }) => ({ name: input.name }),
    })

    expect(repo.tableName).toBe("items")
    expect(repo.config).toBeDefined()
    expect(repo.config.idColumn).toBe("id")
  })
})

describe("withTransaction", () => {
  it("commits on success", async () => {
    await runScoped(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient

        yield* sql`CREATE TABLE tx_test (id INTEGER PRIMARY KEY, value TEXT)`

        yield* withTransaction(
          Effect.gen(function* () {
            yield* sql`INSERT INTO tx_test (id, value) VALUES (1, 'test')`
          })
        )

        const rows = yield* sql`SELECT * FROM tx_test WHERE id = 1`
        expect(rows.length).toBe(1)
      })
    )
  })

  it("rolls back on failure", async () => {
    await runScoped(
      Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient

        yield* sql`CREATE TABLE tx_test2 (id INTEGER PRIMARY KEY, value TEXT)`

        const result = yield* withTransaction(
          Effect.gen(function* () {
            yield* sql`INSERT INTO tx_test2 (id, value) VALUES (1, 'test')`
            yield* Effect.fail("intentional failure")
          })
        ).pipe(Effect.either)

        expect(result._tag).toBe("Left")

        const rows = yield* sql`SELECT * FROM tx_test2 WHERE id = 1`
        expect(rows.length).toBe(0) // Should be rolled back
      })
    )
  })
})

describe("XDG paths", () => {
  it("uses XDG env vars with fallbacks", () => {
    expect(XDG.config).toBeDefined()
    expect(XDG.data).toBeDefined()
    expect(XDG.cache).toBeDefined()
  })
})

describe("getAppPaths", () => {
  it("returns config, db, cache, logs paths", () => {
    const paths = getAppPaths("my-app")

    expect(paths.config).toContain("my-app")
    expect(paths.config).toContain("config.json")
    expect(paths.db).toContain("my-app")
    expect(paths.db).toContain("data.db")
    expect(paths.cache).toContain("my-app")
    expect(paths.logs).toContain("my-app")
    expect(paths.logs).toContain("logs")
  })
})
