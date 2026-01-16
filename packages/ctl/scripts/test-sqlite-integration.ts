#!/usr/bin/env bun
/**
 * SQLite Integration Test
 *
 * Creates a real database file and verifies it can be queried externally.
 */

import { Effect } from "effect"
import { SqlClient } from "@effect/sql"
import { SqliteClient } from "@effect/sql-sqlite-bun"
import {
  ensureTable,
  runMigrations,
  type TableDef,
  type Migration,
} from "../src/persistence/index.js"
import { existsSync, unlinkSync } from "fs"

const DB_PATH = "/tmp/ctl-integration-test.db"

// Clean up any existing test database
if (existsSync(DB_PATH)) {
  unlinkSync(DB_PATH)
  console.log("🧹 Cleaned up existing test database")
}

const TestLayer = SqliteClient.layer({ filename: DB_PATH })

// Define a test table
const notesTable: TableDef = {
  name: "notes",
  columns: `
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  `,
  indexes: [
    "CREATE INDEX IF NOT EXISTS idx_notes_title ON notes(title)",
  ],
}

// Define migrations
const migrations: Migration[] = [
  {
    version: 1,
    description: "Add tags column",
    up: (sql) =>
      sql.unsafe("ALTER TABLE notes ADD COLUMN tags TEXT").pipe(
        Effect.asVoid,
        Effect.orDie
      ),
  },
]

const program = Effect.gen(function* () {
  console.log("📦 Creating SQLite database at:", DB_PATH)

  // Create the notes table
  yield* ensureTable(notesTable)
  console.log("✓ Created 'notes' table")

  // Run migrations
  yield* runMigrations(migrations)
  console.log("✓ Applied migrations")

  // Insert some test data
  const sql = yield* SqlClient.SqlClient

  yield* sql`INSERT INTO notes (title, content, tags) VALUES ('First Note', 'Hello from ctl!', 'test,integration')`
  yield* sql`INSERT INTO notes (title, content, tags) VALUES ('Second Note', 'SQLite persistence works!', 'sqlite,persistence')`
  yield* sql`INSERT INTO notes (title, content, tags) VALUES ('Third Note', 'Effect-TS is awesome', 'effect,typescript')`
  console.log("✓ Inserted 3 test notes")

  // Query and display
  const notes = yield* sql<{
    id: number
    title: string
    content: string
    tags: string
    created_at: string
  }>`SELECT * FROM notes ORDER BY id`

  console.log("\n📋 Notes in database:")
  for (const note of notes) {
    console.log(`  [${note.id}] ${note.title} - ${note.content} (tags: ${note.tags})`)
  }

  // Show table structure
  const tableInfo = yield* sql.unsafe("PRAGMA table_info(notes)")
  console.log("\n🔧 Table structure:")
  for (const col of tableInfo as Array<{ name: string; type: string; notnull: number }>) {
    console.log(`  - ${col.name}: ${col.type}${col.notnull ? " NOT NULL" : ""}`)
  }

  // Show migrations
  const appliedMigrations = yield* sql<{ version: number; description: string }>`
    SELECT version, description FROM _migrations ORDER BY version
  `
  console.log("\n📜 Applied migrations:")
  for (const m of appliedMigrations) {
    console.log(`  v${m.version}: ${m.description}`)
  }

  console.log("\n✅ Database created successfully!")
  console.log(`\n🔍 You can query it with: sqlite3 ${DB_PATH} "SELECT * FROM notes;"`)
})

Effect.runPromise(
  Effect.scoped(program.pipe(Effect.provide(TestLayer)))
).catch((err) => {
  console.error("❌ Error:", err)
  process.exit(1)
})
