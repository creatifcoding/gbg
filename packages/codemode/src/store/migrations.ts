/**
 * @module store/migrations
 *
 * RLM Store database migrations — versioned, tracked, transactional.
 *
 * Uses Effect v4's Migrator.fromRecord() for:
 * - Migration tracking (only new migrations run)
 * - Transaction wrapping (atomic application)
 * - Observability (Effect.withSpan per migration)
 * - Version safety (add 0005_xxx later, only that runs)
 *
 * Existing databases: IF NOT EXISTS makes all DDL idempotent.
 * First tracked run on an existing DB records all migrations without
 * changing data — backward compatible.
 *
 * @example
 * ```ts
 * import { MigrationLayer } from "./migrations.js"
 *
 * // Compose: SqlClient → Migrations → RlmStore
 * const AppLayer = RlmStoreLive.pipe(Layer.provide(MigrationLayer))
 * ```
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import { SqlClient } from "effect/unstable/sql/SqlClient"
import * as Migrator from "effect/unstable/sql/Migrator"

// ── Sentinel Tag ─────────────────────────────────────────────────
// RlmStoreLive depends on this tag → guarantees DDL ran before queries.

export interface MigrationsCompleteShape {
  readonly _tag: "MigrationsComplete"
}

export class MigrationsComplete extends Context.Service<MigrationsComplete, MigrationsCompleteShape>()(
  "@tmnl/rlm/MigrationsComplete"
) {}

// ── Migration Records ────────────────────────────────────────────
//
// Keys: "NNNN_name" — lexicographic ordering determines execution order.
// Values: Effect programs that yield* SqlClient for DDL operations.
// IF NOT EXISTS everywhere — idempotent for existing databases.

const migrations: Record<string, Effect.Effect<void, unknown, SqlClient>> = {

  "0001_objects_table": Effect.gen(function*() {
    const sql = yield* SqlClient
    yield* sql.unsafe(`
      CREATE TABLE IF NOT EXISTS objects (
        collection TEXT NOT NULL,
        key TEXT NOT NULL,
        data TEXT NOT NULL,
        tags TEXT DEFAULT '[]',
        summary TEXT,
        intent TEXT,
        source TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (collection, key)
      )
    `)
  }),

  "0002_objects_indexes": Effect.gen(function*() {
    const sql = yield* SqlClient
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_objects_collection ON objects(collection)`
    )
    yield* sql.unsafe(
      `CREATE INDEX IF NOT EXISTS idx_objects_summary ON objects(summary)`
    )
  }),

  "0003_fts5_virtual_table": Effect.gen(function*() {
    const sql = yield* SqlClient
    yield* sql.unsafe(`
      CREATE VIRTUAL TABLE IF NOT EXISTS objects_fts USING fts5(
        summary, intent, source,
        content=objects,
        content_rowid=rowid
      )
    `)
  }),

  "0004_fts5_triggers": Effect.gen(function*() {
    const sql = yield* SqlClient
    yield* sql.unsafe(`
      CREATE TRIGGER IF NOT EXISTS objects_fts_ai AFTER INSERT ON objects BEGIN
        INSERT INTO objects_fts(rowid, summary, intent, source)
        VALUES (new.rowid, new.summary, new.intent, new.source);
      END
    `)
    yield* sql.unsafe(`
      CREATE TRIGGER IF NOT EXISTS objects_fts_ad AFTER DELETE ON objects BEGIN
        INSERT INTO objects_fts(objects_fts, rowid, summary, intent, source)
        VALUES ('delete', old.rowid, old.summary, old.intent, old.source);
      END
    `)
    yield* sql.unsafe(`
      CREATE TRIGGER IF NOT EXISTS objects_fts_au AFTER UPDATE ON objects BEGIN
        INSERT INTO objects_fts(objects_fts, rowid, summary, intent, source)
        VALUES ('delete', old.rowid, old.summary, old.intent, old.source);
        INSERT INTO objects_fts(rowid, summary, intent, source)
        VALUES (new.rowid, new.summary, new.intent, new.source);
      END
    `)
  }),
}

// ── Migrator Factory ─────────────────────────────────────────────

const runMigrations = Migrator.make({})<never>({
  loader: Migrator.fromRecord(migrations),
  table: "rlm_migrations",
})

// ── Migration Layer ──────────────────────────────────────────────
//
// Layer.effectDiscard — runs migrations for their side effects,
// discards the return value (list of applied migration IDs).
// Depends on SqlClient being in the layer tree.

// ── Migration Layer ──────────────────────────────────────────────
//
// Runs all pending migrations, then provides MigrationsComplete sentinel.
// RlmStoreLive depends on MigrationsComplete → guaranteed ordering.

export const MigrationLayer = Layer.effect(
  MigrationsComplete,
  runMigrations.pipe(
    Effect.map(() => MigrationsComplete.of({ _tag: "MigrationsComplete" as const }))
  ),
)

// Re-export for test access
export { migrations, Migrator }
