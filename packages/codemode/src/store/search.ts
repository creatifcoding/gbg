/**
 * @module search
 *
 * Hybrid full-text search for RLM Store v2.
 *
 * Two engines, one interface:
 *   SQLite FTS5  — persistent, survives restart, indexes metadata columns
 *   FlexSearch   — in-memory, deep JSON indexing, prefix/fuzzy support
 *
 * Architecture:
 *   On startup: loads all objects from SQLite → builds FlexSearch index
 *   On put/delete: FTS5 triggers keep SQLite index current,
 *                  FlexSearch index updated via notify()
 *   On search: queries FlexSearch (deep), falls back to FTS5 (metadata-only)
 *
 * FlexSearch indexes THREE fields per document:
 *   1. summary — _meta.summary (high weight)
 *   2. tags    — space-joined tags (medium weight)
 *   3. content — recursively flattened JSON data blob (all nested values)
 *
 * This means ms.search("Union") finds objects where "Union" appears
 * ANYWHERE in the stored data — keys, values, nested arrays, etc.
 */
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Ref from "effect/Ref"
import * as Context from "effect/Context"
import { SqlClient } from "effect/unstable/sql/SqlClient"
import { Document } from "flexsearch"
import { namespaceMatchesGlob } from "./schemas.js"
import { RlmStore, type CatalogEntry } from "./service.js"

// ── JSON Flattener ───────────────────────────────────────────────

/**
 * Recursively flatten any value into searchable text.
 * Keys AND values are included so you can search for field names too.
 * Depth-limited to prevent infinite recursion on circular refs.
 */
function flattenToText(value: unknown, depth: number = 0): string {
  if (depth > 12) return ""
  if (value === null || value === undefined) return ""
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (Array.isArray(value)) {
    return value.map((v) => flattenToText(v, depth + 1)).join(" ")
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => k + " " + flattenToText(v, depth + 1))
      .join(" ")
  }
  return ""
}

// ── FlexSearch Document Shape ────────────────────────────────────

interface SearchDoc {
  [key: string]: string  // FlexSearch DocumentData constraint
  id: string        // "ns::key" composite
  summary: string   // _meta.summary
  tags: string      // space-joined tags
  content: string   // flattened data blob
}

// ── Search Result ────────────────────────────────────────────────

export interface SearchHit extends CatalogEntry {
  /** Relevance score (higher = better match) */
  readonly score: number
  /** Which fields matched */
  readonly matchedFields: readonly string[]
}

// ── Service Shape ────────────────────────────────────────────────

export interface SearchIndexShape {
  /**
   * Full-text search across stored objects.
   * Queries FlexSearch (deep JSON) with FTS5 fallback.
   * Optional namespace glob filter.
   */
  readonly search: (text: string, nsGlob?: string) => Effect.Effect<readonly SearchHit[], any>

  /**
   * Notify the index that an object was added/updated.
   * Called by the store on put operations.
   */
  readonly notify: (ns: string, key: string, data: Record<string, unknown>, tags: readonly string[]) => Effect.Effect<void, any>

  /**
   * Notify the index that an object was removed.
   */
  readonly notifyRemove: (ns: string, key: string) => Effect.Effect<void, any>

  /**
   * Rebuild the entire FlexSearch index from SQLite.
   */
  readonly rebuild: () => Effect.Effect<{ indexed: number }, any>

  /**
   * Get index stats.
   */
  readonly stats: () => Effect.Effect<{ flexCount: number; ready: boolean }, any>
}

// ── Service Tag ──────────────────────────────────────────────────

export class SearchIndex extends Context.Service<SearchIndex, SearchIndexShape>()(
  "@tmnl/rlm/SearchIndex"
) {}

// ── Layer ────────────────────────────────────────────────────────

export const SearchIndexLive = Layer.effect(
  SearchIndex,
  Effect.gen(function*() {
    const sql = yield* SqlClient

    // ── FlexSearch Instance ────────────────────────────────────────

    const flexIndex = new Document<SearchDoc>({
      document: {
        id: "id",
        index: [
          { field: "summary", tokenize: "forward" },
          { field: "tags",    tokenize: "forward" },
          { field: "content", tokenize: "forward" },
        ],
      },
    })

    const countRef = yield* Ref.make(0)
    const readyRef = yield* Ref.make(false)

    // ── Helpers ────────────────────────────────────────────────────

    const compositeId = (ns: string, key: string) => `${ns}::${key}`

    const toSearchDoc = (
      ns: string,
      key: string,
      data: Record<string, unknown>,
      tags: readonly string[],
    ): SearchDoc => {
      const meta = data._meta as Record<string, unknown> | undefined
      return {
        id: compositeId(ns, key),
        summary: (meta?.summary as string) ?? "",
        tags: tags.join(" "),
        content: flattenToText(data),
      }
    }

    // ── Initial Load ──────────────────────────────────────────────

    const loadAll = Effect.gen(function*() {
      const rows = yield* sql`
        SELECT collection, key, data, tags FROM objects ORDER BY collection, key
      `
      let count = 0
      for (const row of rows) {
        const data = JSON.parse(row.data as string)
        const tags = JSON.parse((row.tags as string) ?? "[]")
        const doc = toSearchDoc(row.collection as string, row.key as string, data, tags)
        flexIndex.add(doc)
        count++
      }
      yield* Ref.set(countRef, count)
      yield* Ref.set(readyRef, true)
      return count
    })

    // Load on construction — non-blocking (won't fail layer construction)
    const indexed = yield* loadAll.pipe(
      Effect.catch(() => Effect.succeed(0)),
    )

    // ── Search Implementation ─────────────────────────────────────

    const searchFlex = (text: string, nsGlob?: string): Effect.Effect<readonly SearchHit[]> =>
    // @ts-expect-error SqlError in error channel — fixed in Effect rewrite
      Effect.gen(function*() {
        const isReady = yield* Ref.get(readyRef)
        if (!isReady) return []

        // Query FlexSearch
        const results = flexIndex.search(text, { limit: 100, enrich: true })

        // Merge results across fields, compute scores
        const hitMap = new Map<string, { score: number; fields: string[] }>()

        for (const fieldResult of results as any[]) {
          const field = fieldResult.field as string
          const items = fieldResult.result as any[]

          for (let i = 0; i < items.length; i++) {
            const id = typeof items[i] === "object" ? items[i].id : items[i]
            const positionScore = 1 - (i / Math.max(items.length, 1))

            // Weight by field: summary > tags > content
            const fieldWeight = field === "summary" ? 3.0
              : field === "tags" ? 2.0
              : 1.0

            const score = positionScore * fieldWeight

            const existing = hitMap.get(id)
            if (existing) {
              existing.score = Math.max(existing.score, score)
              if (!existing.fields.includes(field)) existing.fields.push(field)
            } else {
              hitMap.set(id, { score, fields: [field] })
            }
          }
        }

        if (hitMap.size === 0) return []

        // Fetch metadata from SQLite for matched IDs
        const ids = Array.from(hitMap.keys())
        const hits: SearchHit[] = []

        for (const id of ids) {
          const [ns, key] = id.split("::")
          if (!ns || !key) continue

          // Apply namespace filter
          if (nsGlob && !namespaceMatchesGlob(ns, nsGlob)) continue

          const rows = yield* sql`
            SELECT collection, key, summary, source, intent, tags, created_at, updated_at
            FROM objects WHERE collection = ${ns} AND key = ${key}
          `
          if (rows.length === 0) continue

          const r = rows[0] as any
          const match = hitMap.get(id)!

          hits.push({
            collection: r.collection,
            key: r.key,
            summary: r.summary ?? "",
            source: r.source,
            intent: r.intent,
            tags: JSON.parse(r.tags ?? "[]"),
            created_at: r.created_at,
            updated_at: r.updated_at,
            score: match.score,
            matchedFields: match.fields,
          })
        }

        // Sort by score descending
        hits.sort((a, b) => b.score - a.score)
        return hits
      }).pipe(Effect.withSpan("SearchIndex.searchFlex", { attributes: { text, nsGlob } }))

    // FTS5 fallback (metadata-only, for when FlexSearch isn't ready)
    const searchFts5 = (text: string, nsGlob?: string): Effect.Effect<readonly SearchHit[]> =>
    // @ts-expect-error SqlError in error channel — fixed in Effect rewrite
      Effect.gen(function*() {
        const rows = yield* sql.unsafe(
          `SELECT o.collection, o.key, o.summary, o.source, o.intent,
                  o.tags, o.created_at, o.updated_at, rank
           FROM objects_fts fts
           JOIN objects o ON o.rowid = fts.rowid
           WHERE objects_fts MATCH ?
           ORDER BY rank
           LIMIT 50`,
          [text]
        )

        const entries = rows.map((r: any) => ({
          collection: r.collection as string,
          key: r.key as string,
          summary: (r.summary ?? "") as string,
          source: r.source as string | undefined,
          intent: r.intent as string | undefined,
          tags: JSON.parse(r.tags ?? "[]") as readonly string[],
          created_at: r.created_at as string,
          updated_at: r.updated_at as string,
          score: Math.abs(r.rank as number),  // FTS5 rank is negative
          matchedFields: ["fts5"] as readonly string[],
        }))

        if (nsGlob) {
          return entries.filter((e) => namespaceMatchesGlob(e.collection, nsGlob))
        }
        return entries
      }).pipe(Effect.withSpan("SearchIndex.searchFts5", { attributes: { text, nsGlob } }))

    // ── Public Interface ──────────────────────────────────────────

    return SearchIndex.of({
      search: (text, nsGlob) =>
        Effect.gen(function*() {
          const isReady = yield* Ref.get(readyRef)

          if (isReady) {
            // Primary: FlexSearch (deep JSON indexing)
            const results = yield* searchFlex(text, nsGlob)
            if (results.length > 0) return results

            // Fallback: FTS5 (maybe FlexSearch missed due to tokenization)
            return yield* searchFts5(text, nsGlob).pipe(
              Effect.catch(() => Effect.succeed([] as readonly SearchHit[])),
            )
          }

          // Not ready: FTS5 only
          return yield* searchFts5(text, nsGlob).pipe(
            Effect.catch(() => Effect.succeed([] as readonly SearchHit[])),
          )
        }).pipe(Effect.withSpan("SearchIndex.search", { attributes: { text, nsGlob } })),

      notify: (ns, key, data, tags) =>
        Effect.sync(() => {
          const doc = toSearchDoc(ns, key, data, tags)
          // FlexSearch .update() handles add-or-replace
          try { flexIndex.remove(doc.id) } catch { /* not found — fine */ }
          flexIndex.add(doc)
        }).pipe(
          Effect.tap(() => Ref.update(countRef, (n) => n + 1)),
        ),

      notifyRemove: (ns, key) =>
        Effect.sync(() => {
          try { flexIndex.remove(compositeId(ns, key)) } catch { /* not found */ }
        }).pipe(
          Effect.tap(() => Ref.update(countRef, (n) => Math.max(0, n - 1))),
        ),

      rebuild: () =>
        Effect.gen(function*() {
          // Clear FlexSearch — no built-in clear, create new instance would
          // lose the reference. Remove all known IDs instead.
          const rows = yield* sql`SELECT collection, key FROM objects`
          for (const row of rows) {
            try {
              flexIndex.remove(compositeId(row.collection as string, row.key as string))
            } catch { /* ignore */ }
          }

          // Reload everything
          const count = yield* loadAll

          // Also rebuild FTS5
          yield* sql.unsafe(`INSERT INTO objects_fts(objects_fts) VALUES('rebuild')`)

          return { indexed: count }
        }).pipe(Effect.withSpan("SearchIndex.rebuild")),

      stats: () =>
        Effect.gen(function*() {
          const count = yield* Ref.get(countRef)
          const ready = yield* Ref.get(readyRef)
          return { flexCount: count, ready }
        }),
    })
  })
)
