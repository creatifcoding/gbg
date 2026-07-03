/**
 * @module service
 *
 * RLM Store v2 — Effect v4 Context.Service for knowledge persistence.
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
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import { SqlClient } from "effect/unstable/sql/SqlClient"
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
import { MigrationsComplete } from "./migrations.js"

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
  readonly put: (ns: string, key: string, data: Record<string, unknown>, opts?: PutOptions) => Effect.Effect<{ ns: string; key: string }, any>
  /** Store with auto-timestamped key */
  readonly putNow: (ns: string, prefix: string, data: Record<string, unknown>, opts?: PutOptions) => Effect.Effect<{ ns: string; key: string }, any>
  /** Get data WITHOUT _meta */
  readonly get: (ns: string, key: string) => Effect.Effect<unknown | null, any>
  /** Get data WITH _meta envelope */
  readonly getRaw: (ns: string, key: string) => Effect.Effect<unknown | null, any>
  /** Get only the _meta of a stored object */
  readonly describe: (ns: string, key: string) => Effect.Effect<Record<string, unknown> | null, any>
  /** Delete an object */
  readonly del: (ns: string, key: string) => Effect.Effect<boolean, any>
  /** Clear all objects in a namespace */
  readonly clear: (ns: string) => Effect.Effect<number, any>
  /** List keys in a namespace */
  readonly keys: (ns: string) => Effect.Effect<readonly string[], any>
  /** Query with tag/JSON path filters */
  readonly query: (ns: string, filter?: QueryFilter) => Effect.Effect<readonly StoredObject[], any>
  /** Catalog: all entries with summaries, filterable by glob */
  readonly catalog: (nsGlob?: string) => Effect.Effect<readonly CatalogEntry[], any>
  /** List collections, optional glob filter */
  readonly collections: (glob?: string) => Effect.Effect<readonly { name: string; count: number }[], any>
  /** Full inventory */
  readonly vars: () => Effect.Effect<readonly CatalogEntry[], any>
  /** Run raw SQL (for migrations) */
  readonly exec: (sql: string) => Effect.Effect<void, any>
}

// ── Service Tag ──────────────────────────────────────────────────

export class RlmStore extends Context.Service<RlmStore, RlmStoreShape>()(
  "@tmnl/rlm/Store"
) {}

// ── DDL ──────────────────────────────────────────────────────────
// Migrations are defined in ./migrations.ts and run via Migrator.fromRecord.
// See MigrationLayer for the tracked, transactional migration system.

// ── Layer ────────────────────────────────────────────────────────

export const RlmStoreLive = Layer.effect(
  RlmStore,
  Effect.gen(function*() {
    const sql = yield* SqlClient

    // Depend on MigrationsComplete sentinel — guarantees DDL ran before we query.
    yield* MigrationsComplete

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

      putNow: (ns, prefix, data, opts) => {
        const key = prefix + temporalSuffix()
        // Inline put logic (can't yield* self from within own service)
        return Effect.gen(function*() {
          const validNs = validateNamespace(ns)
          const validKey = validateKey(key)

          const meta = data._meta as Record<string, unknown> | undefined
          if (meta) validateMeta(meta)

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
        }).pipe(Effect.withSpan("RlmStore.putNow", { attributes: { ns, prefix } }))
      },

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
