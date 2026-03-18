/**
 * @module builders
 *
 * Fluent query and put builders for RLM Store v2.
 * These builders accumulate filter state synchronously,
 * then delegate to the API facade's run() at terminal methods.
 *
 * Usage (from api.ts facade):
 *   ms.from("osint.scans").tagged("live", "mil").entries()
 *   ms.into("osint.scans").key("scan").timestamped().data({...}).meta({summary:"..."}).put()
 *
 * NOTE: These builders do NOT call Effect.runPromise directly.
 * The api.ts facade provides a `run` function that handles Effect execution
 * through the ManagedRuntime.
 */
import type { RlmStoreShape, CatalogEntry, StoredObject } from "./service.js"
import type { SearchIndexShape } from "./search.js"
import { temporalSuffix, validateNamespace, validateKey, validateMeta } from "./schemas.js"

// ── Types ────────────────────────────────────────────────────────

/** Function that runs an Effect through the ManagedRuntime */
type RunFn = <A>(effect: any) => Promise<A>

// ── QueryBuilder ─────────────────────────────────────────────────

interface QueryState {
  ns: string
  tagFilters: string[]
  searchText?: string
  jsonPath?: string
  jsonValue?: unknown
  maxResults?: number
}

export class QueryBuilder {
  store: RlmStoreShape
  searchIndex: SearchIndexShape
  run: RunFn
  state: QueryState

  constructor(
    store: RlmStoreShape,
    searchIndex: SearchIndexShape,
    run: RunFn,
    ns: string
  ) {
    this.store = store
    this.searchIndex = searchIndex
    this.run = run
    this.state = { ns, tagFilters: [] }
  }

  /** Filter by tags (AND logic) */
  tagged(...tags: string[]): this {
    this.state.tagFilters.push(...tags)
    return this
  }

  /** Filter by JSON path value */
  where(path: string, value: unknown): this {
    this.state.jsonPath = path
    this.state.jsonValue = value
    return this
  }

  /** Full-text search filter */
  search(text: string): this {
    this.state.searchText = text
    return this
  }

  /** Limit results */
  limit(n: number): this {
    this.state.maxResults = n
    return this
  }

  // ── Terminals ────────────────────────────────────────────────

  /** Get just the keys */
  async keys(): Promise<readonly string[]> {
    const entries = await this._resolve()
    return entries.map((e) => e.key)
  }

  /** Get full objects (data only, no _meta) */
  async entries(): Promise<readonly StoredObject[]> {
    return this._resolveObjects()
  }

  /** Get catalog summaries */
  async summaries(): Promise<readonly CatalogEntry[]> {
    return this._resolve()
  }

  /** Count matching entries */
  async count(): Promise<number> {
    const entries = await this._resolve()
    return entries.length
  }

  // ── Internal ─────────────────────────────────────────────────

  private async _resolve(): Promise<readonly CatalogEntry[]> {
    const { ns, searchText, tagFilters } = this.state

    if (searchText) {
      let results = await this.run<readonly CatalogEntry[]>(
        this.searchIndex.search(searchText, ns)
      )
      if (tagFilters.length > 0) {
        results = results.filter((r) =>
          tagFilters.every((t) => r.tags.includes(t))
        )
      }
      if (this.state.maxResults) {
        results = results.slice(0, this.state.maxResults)
      }
      return results
    }

    // Use catalog for non-FTS queries
    let results = await this.run<readonly CatalogEntry[]>(
      this.store.catalog(ns + "*")
    )
    results = results.filter(
      (r) => r.collection === ns || r.collection.startsWith(ns + ".")
    )
    if (tagFilters.length > 0) {
      results = results.filter((r) =>
        tagFilters.every((t) => r.tags.includes(t))
      )
    }
    if (this.state.maxResults) {
      results = results.slice(0, this.state.maxResults)
    }
    return results
  }

  private async _resolveObjects(): Promise<readonly StoredObject[]> {
    const filter =
      this.state.tagFilters.length > 0
        ? { tags: this.state.tagFilters }
        : this.state.jsonPath
          ? { jsonPath: this.state.jsonPath, jsonValue: this.state.jsonValue }
          : undefined
    let results = await this.run<readonly StoredObject[]>(
      this.store.query(this.state.ns, filter)
    )
    if (this.state.maxResults) {
      results = results.slice(0, this.state.maxResults)
    }
    return results
  }
}

// ── PutBuilder ───────────────────────────────────────────────────

interface PutState {
  ns: string
  key?: string
  timestamped: boolean
  data?: Record<string, unknown>
  meta?: Record<string, unknown>
  tags: string[]
}

export class PutBuilder {
  store: RlmStoreShape
  run: RunFn
  state: PutState

  constructor(store: RlmStoreShape, run: RunFn, ns: string) {
    this.store = store
    this.run = run
    this.state = { ns, timestamped: false, tags: [] }
  }

  /** Set the key */
  key(k: string): this {
    this.state.key = k
    return this
  }

  /** Auto-append --YYYYMMDDTHHMMSS to key */
  timestamped(): this {
    this.state.timestamped = true
    return this
  }

  /** Set the data payload */
  data(d: Record<string, unknown>): this {
    this.state.data = d
    return this
  }

  /** Set _meta fields */
  meta(m: Record<string, unknown>): this {
    this.state.meta = m
    return this
  }

  /** Add tags */
  tags(...t: string[]): this {
    this.state.tags.push(...t)
    return this
  }

  // ── Terminal ─────────────────────────────────────────────────

  /** Validate and store. Returns { ns, key }. */
  async put(): Promise<{ ns: string; key: string }> {
    const { ns, key, timestamped, data, meta, tags } = this.state

    if (!key) throw new Error("PutBuilder: key is required. Call .key('name') first.")
    if (!data) throw new Error("PutBuilder: data is required. Call .data({...}) first.")

    const finalKey = timestamped ? key + temporalSuffix() : key

    // Validate via Schemas
    validateNamespace(ns)
    validateKey(finalKey)
    if (meta) validateMeta(meta)

    // Build envelope
    const envelope: Record<string, unknown> = { ...data }
    if (meta) {
      envelope._meta = meta
    }

    return this.run<{ ns: string; key: string }>(
      this.store.put(ns, finalKey, envelope, tags.length > 0 ? { tags } : undefined)
    ).then(() => ({ ns, key: finalKey }))
  }
}
