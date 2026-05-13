/**
 * @module service
 *
 * RLM Store v2 — Effect v4 ServiceMap.Service for knowledge persistence.
 * Uses unstable/sql SqlClient for database operations.
 * Validates namespaces, keys, and _meta via Schema.
 *
 * Architecture:
 *   SqliteClient (node:sqlite adapter)
 *     └─→ SqlClient (v4 abstract)
 *           └─→ RlmStore (this service)
 *                 ├─→ SearchIndex (FTS5)
 *                 └─→ DomainRegistry (_system.domains)
 */
import * as Effect from "effect-v4/Effect"
import * as Layer from "effect-v4/Layer"
import * as ServiceMap from "effect-v4/ServiceMap"
import { SqlClient } from "effect-v4/unstable/sql/SqlClient"
import {
  validateNamespace,
  validateKey,
  validateMeta,
  temporalSuffix,
  namespaceMatchesGlob,
  isSystemNamespace,
  type Namespace,
  type StoreKey,
} from "./schemas.js"

// ── Types ────────────────────────────────────────────────────────

export interface StoredObject {
  readonly collection: string
  readonly key: string
  readonly data: unknown
  readonly tags: readonly string[]
  readonly created_at: string
  readonly updated_at: string
}

export interface CatalogEntry {
  readonly collection: string
  readonly key: string
  readonly summary: string
  readonly source?: string
  readonly intent?: string
  readonly tags: readonly string[]
  readonly created_at: string
  readonly updated_at: string
}

export interface QueryFilter {
  readonly tags?: readonly string[]
  readonly jsonPath?: string
  readonly jsonValue?: unknown
}

export interface PutOptions {
  readonly tags?: readonly string[]
}

// ── Store Service Shape ──────────────────────────────────────────

export interface RlmStoreShape {
  /** Store an object with _meta envelope validation */
  readonly put: (ns: string, key: string, data: Record<string, unknown>, opts?: PutOptions) => Effect.Effect<{ ns: string; key: string }>
  /** Store with auto-timestamped key */
  readonly putNow: (ns: string, prefix: string, data: Record<string, unknown>, opts?: PutOptions) => Effect.Effect<{ ns: string; key: string }>
  /** Get data WITHOUT _meta */
  readonly get: (ns: string, key: string) => Effect.Effect<unknown | null>
  /** Get data WITH _meta envelope */
  readonly getRaw: (ns: string, key: string) => Effect.Effect<unknown | null>
  /** Get only the _meta of a stored object */
  readonly describe: (ns: string, key: string) => Effect.Effect<Record<string, unknown> | null>
  /** Delete an object */
  readonly del: (ns: string, key: string) => Effect.Effect<boolean>
  /** Clear all objects in a namespace */
  readonly clear: (ns: string) => Effect.Effect<number>
  /** List keys in a namespace */
  readonly keys: (ns: string) => Effect.Effect<readonly string[]>
  /** Query with tag/JSON path filters */
  readonly query: (ns: string, filter?: QueryFilter) => Effect.Effect<readonly StoredObject[]>
  /** Catalog: all entries with summaries, filterable by glob */
  readonly catalog: (nsGlob?: string) => Effect.Effect<readonly CatalogEntry[]>
  /** List collections, optional glob filter */
  readonly collections: (glob?: string) => Effect.Effect<readonly { name: string; count: number }[]>
  /** Full inventory */
  readonly vars: () => Effect.Effect<readonly CatalogEntry[]>
  /** Run raw SQL (for migrations) */
  readonly exec: (sql: string) => Effect.Effect<void>
}

// ── Service Tag ──────────────────────────────────────────────────

export class RlmStore extends ServiceMap.Service<RlmStore, RlmStoreShape>()(
  "@tmnl/rlm/Store"
) {}

// ── DDL ──────────────────────────────────────────────────────────

const MIGRATION_SQL = `
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
  );

  CREATE INDEX IF NOT EXISTS idx_objects_collection ON objects(collection);
  CREATE INDEX IF NOT EXISTS idx_objects_summary ON objects(summary);

  -- FTS5 virtual table for full-text search
  CREATE VIRTUAL TABLE IF NOT EXISTS objects_fts USING fts5(
    summary, intent, source,
    content=objects,
    content_rowid=rowid
  );

  -- Triggers to keep FTS in sync
  CREATE TRIGGER IF NOT EXISTS objects_fts_ai AFTER INSERT ON objects BEGIN
    INSERT INTO objects_fts(rowid, summary, intent, source)
    VALUES (new.rowid, new.summary, new.intent, new.source);
  END;

  CREATE TRIGGER IF NOT EXISTS objects_fts_ad AFTER DELETE ON objects BEGIN
    INSERT INTO objects_fts(objects_fts, rowid, summary, intent, source)
    VALUES ('delete', old.rowid, old.summary, old.intent, old.source);
  END;

  CREATE TRIGGER IF NOT EXISTS objects_fts_au AFTER UPDATE ON objects BEGIN
    INSERT INTO objects_fts(objects_fts, rowid, summary, intent, source)
    VALUES ('delete', old.rowid, old.summary, old.intent, old.source);
    INSERT INTO objects_fts(rowid, summary, intent, source)
    VALUES (new.rowid, new.summary, new.intent, new.source);
  END;
`

// ── Layer ────────────────────────────────────────────────────────

export const RlmStoreLive = Layer.effect(
  RlmStore,
  Effect.gen(function*() {
    const sql = yield* SqlClient

    // Run migrations
    yield* sql.unsafe(MIGRATION_SQL)

    return RlmStore.of({
      put: (ns, key, data, opts) =>
        Effect.gen(function*() {
          // Validate inputs via Schema
          const validNs = validateNamespace(ns)
          const validKey = validateKey(key)

          // Validate _meta
          const meta = data._meta as Record<string, unknown> | undefined
          if (meta) {
            validateMeta(meta)
          }

          const summary = meta?.summary as string | undefined
          const intent = meta?.intent as string | undefined
          const source = meta?.source as string | undefined
          const tags = JSON.stringify(opts?.tags ?? [])
          const jsonData = JSON.stringify(data)

          yield* sql`
            INSERT INTO objects (collection, key, data, tags, summary, intent, source, updated_at)
            VALUES (${validNs}, ${validKey}, ${jsonData}, ${tags}, ${summary ?? null}, ${intent ?? null}, ${source ?? null}, datetime('now'))
            ON CONFLICT(collection, key) DO UPDATE SET
              data = excluded.data,
              tags = excluded.tags,
              summary = excluded.summary,
              intent = excluded.intent,
              source = excluded.source,
              updated_at = datetime('now')
          `

          return { ns: validNs, key: validKey }
        }).pipe(Effect.withSpan("RlmStore.put", { attributes: { ns, key } })),

      putNow: (ns, prefix, data, opts) =>
        Effect.gen(function*() {
          const key = prefix + temporalSuffix()
          const store = yield* RlmStore
          return yield* store.put(ns, key, data, opts)
        }).pipe(Effect.withSpan("RlmStore.putNow", { attributes: { ns, prefix } })),

      get: (ns, key) =>
        Effect.gen(function*() {
          const rows = yield* sql`
            SELECT data FROM objects WHERE collection = ${ns} AND key = ${key}
          `
          if (rows.length === 0) return null
          const parsed = JSON.parse(rows[0].data as string)
          // Strip _meta for clean get()
          if (parsed && typeof parsed === "object" && "_meta" in parsed) {
            const { _meta, ...rest } = parsed
            return rest
          }
          return parsed
        }).pipe(Effect.withSpan("RlmStore.get", { attributes: { ns, key } })),

      getRaw: (ns, key) =>
        Effect.gen(function*() {
          const rows = yield* sql`
            SELECT data FROM objects WHERE collection = ${ns} AND key = ${key}
          `
          if (rows.length === 0) return null
          return JSON.parse(rows[0].data as string)
        }).pipe(Effect.withSpan("RlmStore.getRaw", { attributes: { ns, key } })),

      describe: (ns, key) =>
        Effect.gen(function*() {
          const rows = yield* sql`
            SELECT data FROM objects WHERE collection = ${ns} AND key = ${key}
          `
          if (rows.length === 0) return null
          const parsed = JSON.parse(rows[0].data as string)
          return (parsed?._meta as Record<string, unknown>) ?? null
        }).pipe(Effect.withSpan("RlmStore.describe", { attributes: { ns, key } })),

      del: (ns, key) =>
        Effect.gen(function*() {
          yield* sql`DELETE FROM objects WHERE collection = ${ns} AND key = ${key}`
          return true // SQLite doesn't return affected rows via tagged template easily
        }).pipe(Effect.withSpan("RlmStore.del", { attributes: { ns, key } })),

      clear: (ns) =>
        Effect.gen(function*() {
          // Get count first
          const rows = yield* sql`SELECT COUNT(*) as cnt FROM objects WHERE collection = ${ns}`
          const count = (rows[0]?.cnt as number) ?? 0
          yield* sql`DELETE FROM objects WHERE collection = ${ns}`
          return count
        }).pipe(Effect.withSpan("RlmStore.clear", { attributes: { ns } })),

      keys: (ns) =>
        Effect.gen(function*() {
          const rows = yield* sql`SELECT key FROM objects WHERE collection = ${ns} ORDER BY key`
          return rows.map((r: any) => r.key as string)
        }).pipe(Effect.withSpan("RlmStore.keys", { attributes: { ns } })),

      query: (ns, filter) =>
        Effect.gen(function*() {
          let rows: readonly any[]
          if (filter?.tags && filter.tags.length > 0) {
            // Tag filter via JSON
            const tagPlaceholders = filter.tags.map(() => "?").join(", ")
            rows = yield* sql.unsafe(
              `SELECT * FROM objects WHERE collection = ?
               AND (${filter.tags.map(() =>
                `EXISTS (SELECT 1 FROM json_each(tags) WHERE json_each.value = ?)`
              ).join(" AND ")})
               ORDER BY updated_at DESC`,
              [ns, ...filter.tags]
            )
          } else if (filter?.jsonPath && filter?.jsonValue !== undefined) {
            rows = yield* sql.unsafe(
              `SELECT * FROM objects WHERE collection = ?
               AND json_extract(data, ?) = ?
               ORDER BY updated_at DESC`,
              [ns, filter.jsonPath, filter.jsonValue]
            )
          } else {
            rows = yield* sql`
              SELECT * FROM objects WHERE collection = ${ns}
              ORDER BY updated_at DESC
            `
          }
          return rows.map((r: any) => ({
            collection: r.collection,
            key: r.key,
            data: JSON.parse(r.data),
            tags: JSON.parse(r.tags ?? "[]"),
            created_at: r.created_at,
            updated_at: r.updated_at,
          }))
        }).pipe(Effect.withSpan("RlmStore.query", { attributes: { ns } })),

      catalog: (nsGlob) =>
        Effect.gen(function*() {
          const rows = nsGlob
            ? yield* sql.unsafe(
                `SELECT collection, key, summary, source, intent, tags, created_at, updated_at
                 FROM objects WHERE collection GLOB ?
                 ORDER BY collection, key`,
                [nsGlob.replace(/\*/g, "*")]
              )
            : yield* sql`
                SELECT collection, key, summary, source, intent, tags, created_at, updated_at
                FROM objects ORDER BY collection, key
              `
          return rows.map((r: any) => ({
            collection: r.collection,
            key: r.key,
            summary: r.summary ?? "",
            source: r.source,
            intent: r.intent,
            tags: JSON.parse(r.tags ?? "[]"),
            created_at: r.created_at,
            updated_at: r.updated_at,
          }))
        }).pipe(Effect.withSpan("RlmStore.catalog")),

      collections: (glob) =>
        Effect.gen(function*() {
          const rows = yield* sql`
            SELECT collection as name, COUNT(*) as count
            FROM objects GROUP BY collection ORDER BY collection
          `
          const all = rows.map((r: any) => ({
            name: r.name as string,
            count: r.count as number,
          }))
          if (glob) {
            return all.filter((c) => namespaceMatchesGlob(c.name, glob))
          }
          return all
        }).pipe(Effect.withSpan("RlmStore.collections")),

      vars: () =>
        Effect.gen(function*() {
          const rows = yield* sql`
            SELECT collection, key, summary, source, intent, tags, created_at, updated_at
            FROM objects ORDER BY collection, key
          `
          return rows.map((r: any) => ({
            collection: r.collection,
            key: r.key,
            summary: r.summary ?? "",
            source: r.source,
            intent: r.intent,
            tags: JSON.parse(r.tags ?? "[]"),
            created_at: r.created_at,
            updated_at: r.updated_at,
          }))
        }).pipe(Effect.withSpan("RlmStore.vars")),

      exec: (sqlStr) =>
        Effect.gen(function*() {
          yield* sql.unsafe(sqlStr)
        }).pipe(Effect.withSpan("RlmStore.exec")),
    })
  })
)
