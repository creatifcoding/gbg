/**
 * @module api
 *
 * API facade for RLM Store v2.
 * Resolves the full Effect v4 service graph ONCE at init,
 * then exports plain functions for the eval sandbox.
 *
 * The agent never sees Effect. It calls ms.put(), ms.get(), etc.
 *
 * DI Architecture:
 *   createStoreApi(sqlLayer) → builds Layer graph → ManagedRuntime
 *   The SqlClient backend is injected — node:sqlite, bun:sqlite, or test :memory:
 *   Each ms.* method → runtime.runPromise(serviceCall)
 */
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"
import { SqlClient } from "effect/unstable/sql/SqlClient"
import { FileSystem } from "effect/FileSystem"
import { RlmStore, RlmStoreLive, type CatalogEntry, type StoredObject, type QueryFilter } from "./service.js"
import { SearchIndex, SearchIndexLive, type SearchHit } from "./search.js"
import { DomainRegistry, DomainRegistryLive } from "./domains.js"
import { ExportService, ExportServiceLive } from "./export.js"
import { MigrationLayer } from "./migrations.js"
import type { ExportOptions, ExportManifest, ImportOptions, ImportResult, ProfileSummary } from "./export.js"
import { QueryBuilder } from "./builders.js"
import { PutBuilder } from "./builders.js"
import { validateDomainConfig, type DomainConfig } from "./schemas.js"

// ── Types re-exported ────────────────────────────────────────────

export type { CatalogEntry, StoredObject, QueryFilter, DomainConfig }

// ── Store API Shape ──────────────────────────────────────────────

export interface StoreApi {
  /** Store an object. Data should include _meta: { summary }. */
  put(collection: string, key: string, data: Record<string, unknown>, tags?: string[]): Promise<void>
  /** Store with auto-timestamped key. */
  putNow(collection: string, prefix: string, data: Record<string, unknown>, tags?: string[]): Promise<{ ns: string; key: string }>
  /** Get data WITHOUT _meta. */
  get(collection: string, key: string): Promise<unknown | null>
  /** Get data WITH _meta envelope. */
  getRaw(collection: string, key: string): Promise<unknown | null>
  /** Get only the _meta of a stored object. */
  describe(collection: string, key: string): Promise<Record<string, unknown> | null>
  /** Delete an object. */
  delete(collection: string, key: string): Promise<boolean>
  /** Query with tag/JSON filters. */
  query(collection: string, filter?: QueryFilter): Promise<readonly StoredObject[]>
  /** List keys in a collection. */
  keys(collection: string): Promise<readonly string[]>
  /** Catalog: all entries with summaries, filterable by namespace glob. */
  catalog(nsGlob?: string): Promise<readonly CatalogEntry[]>
  /** Full inventory. */
  vars(): Promise<readonly CatalogEntry[]>
  /** Full-text search via FTS5. */
  search(text: string, nsGlob?: string): Promise<readonly CatalogEntry[]>
  /** List collections with counts, optional glob filter. */
  collections(glob?: string): Promise<readonly { name: string; count: number }[]>
  /** Clear all objects in a collection. */
  clear(collection: string): Promise<number>
  /** Register a domain config. */
  domain(name: string, config: DomainConfig): Promise<void>
  /** List registered domains. */
  domains(): Promise<readonly { name: string; config: DomainConfig }[]>
  /** Start a fluent query: ms.from("ns").tagged(...).entries() */
  from(ns: string): FluentQuery
  /** Start a fluent put: ms.into("ns").key(...).data({}).meta({}).put() */
  into(ns: string): FluentPut
  /** Backward-compat alias for put(). */
  store(collection: string, key: string, data: Record<string, unknown>, tags?: string[]): Promise<void>
  /** Export store to file. Formats: 'json' (default), 'sqlite', 'procedures'. */
  exportStore(opts: ExportOptions): Promise<ExportManifest>
  /** Import from a previously exported file. Modes: 'merge' (default), 'replace'. */
  importStore(opts: ImportOptions): Promise<ImportResult>
  /** List applied profiles. */
  profiles(): Promise<ProfileSummary[]>
  /** Unapply a named profile — delete its imported objects. */
  removeProfile(name: string): Promise<{ removed: number; collections: string[] }>
  /** Dispose the ManagedRuntime. Call in afterAll/cleanup. */
  dispose(): Promise<void>
}

export type { ExportOptions, ExportManifest, ImportOptions, ImportResult, ProfileSummary }

/** Fluent query chain — chains sync, resolves async at terminal */
export interface FluentQuery {
  tagged(...tags: string[]): FluentQuery
  search(text: string): FluentQuery
  limit(n: number): FluentQuery
  where(path: string, value: unknown): FluentQuery
  keys(): Promise<readonly string[]>
  entries(): Promise<readonly StoredObject[]>
  summaries(): Promise<readonly CatalogEntry[]>
  count(): Promise<number>
}

/** Fluent put chain — chains sync, resolves async at .put() */
export interface FluentPut {
  key(k: string): FluentPut
  timestamped(): FluentPut
  data(d: Record<string, unknown>): FluentPut
  meta(m: Record<string, unknown>): FluentPut
  tags(...t: string[]): FluentPut
  put(): Promise<{ ns: string; key: string }>
}

// ── Factory ──────────────────────────────────────────────────────

/**
 * Create the full Store v2 API.
 *
 * @param sqlLayer - Effect Layer providing SqlClient (node:sqlite, bun:sqlite, etc.)
 *
 * Builds the service graph once via ManagedRuntime.
 * Returns plain async functions for the eval sandbox.
 *
 * Usage (extension):
 *   import { sqliteNodeLayer } from "./store/sqlite-node.js"
 *   const api = createStoreApi(sqliteNodeLayer({ filename: dbPath }))
 *
 * Usage (tests):
 *   const api = createStoreApi(sqliteNodeLayer({ filename: ":memory:" }))
 *
 * Usage (bun, future):
 *   import { sqliteBunLayer } from "./store/sqlite-bun.js"
 *   const api = createStoreApi(sqliteBunLayer({ filename: dbPath }))
 */
export function createStoreApi(
  sqlLayer: Layer.Layer<SqlClient>,
  fsLayer?: Layer.Layer<FileSystem>,
): StoreApi {
  // Service layers — DomainRegistry depends on RlmStore, ExportService depends on RlmStore + FileSystem
  // MigrationLayer runs DDL before any service touches the DB.
  const ServiceLayers = fsLayer
    ? Layer.mergeAll(RlmStoreLive, SearchIndexLive, DomainRegistryLive, ExportServiceLive)
    : Layer.mergeAll(RlmStoreLive, SearchIndexLive, DomainRegistryLive)
  const baseLayers = ServiceLayers.pipe(
    Layer.provide(RlmStoreLive),
    Layer.provide(MigrationLayer),
    Layer.provide(sqlLayer),
  )
  const AppLayer = (fsLayer
    ? baseLayers.pipe(Layer.provide(fsLayer))
    : baseLayers) as any

  // ManagedRuntime — resolved once, reused for all calls
  const runtime = ManagedRuntime.make(AppLayer)

  // Helper: run an Effect program through the runtime
  const run = <A>(effect: Effect.Effect<A, any, any>): Promise<A> =>
    runtime.runPromise(effect)

  // Service accessors
  const withStore = <A>(f: (store: any) => Effect.Effect<A, any, any>) =>
    run(Effect.gen(function*() {
      const store = yield* RlmStore
      return yield* f(store)
    }))

  const withSearch = <A>(f: (search: any) => Effect.Effect<A, any, any>) =>
    run(Effect.gen(function*() {
      const search = yield* SearchIndex
      return yield* f(search)
    }))

  const withDomains = <A>(f: (domains: any) => Effect.Effect<A, any, any>) =>
    run(Effect.gen(function*() {
      const domains = yield* DomainRegistry
      return yield* f(domains)
    }))

  // Lazy service refs for fluent builders
  let _storeRef: any = null
  let _searchRef: any = null
  const getServiceRefs = async () => {
    if (!_storeRef) {
      const refs = await run(Effect.gen(function*() {
        const store = yield* RlmStore
        const search = yield* SearchIndex
        return { store, search }
      }))
      _storeRef = refs.store
      _searchRef = refs.search
    }
    return { store: _storeRef, search: _searchRef }
  }

  // Run function for builders — goes through ManagedRuntime
  const builderRun: <A>(effect: any) => Promise<A> = (effect) => runtime.runPromise(effect)

  return {
    // ── Core CRUD ──────────────────────────────────────────────

    put: (collection, key, data, tags) =>
      run(Effect.gen(function*() {
        const store = yield* RlmStore
        const search = yield* SearchIndex
        yield* store.put(collection, key, data, tags ? { tags } : undefined)
        yield* search.notify(collection, key, data, tags ?? [])
      })).then(() => undefined),

    putNow: (collection, prefix, data, tags) =>
      run(Effect.gen(function*() {
        const store = yield* RlmStore
        const search = yield* SearchIndex
        const result = yield* store.putNow(collection, prefix, data, tags ? { tags } : undefined)
        yield* search.notify(collection, result.key, data, tags ?? [])
        return result
      })),

    get: (collection, key) =>
      withStore((s) => s.get(collection, key)),

    getRaw: (collection, key) =>
      withStore((s) => s.getRaw(collection, key)),

    describe: (collection, key) =>
      withStore((s) => s.describe(collection, key)),

    delete: (collection, key) =>
      run(Effect.gen(function*() {
        const store = yield* RlmStore
        const search = yield* SearchIndex
        const result = yield* store.del(collection, key)
        yield* search.notifyRemove(collection, key)
        return result
      })),

    // ── Query ──────────────────────────────────────────────────

    query: (collection, filter) =>
      withStore((s) => s.query(collection, filter)),

    keys: (collection) =>
      withStore((s) => s.keys(collection)),

    catalog: (nsGlob) =>
      withStore((s) => s.catalog(nsGlob)),

    vars: () =>
      withStore((s) => s.vars()),

    search: (text, nsGlob) =>
      withSearch((s) => s.search(text, nsGlob)),

    // ── Collections ────────────────────────────────────────────

    collections: (glob) =>
      withStore((s) => s.collections(glob)),

    clear: (collection) =>
      withStore((s) => s.clear(collection)),

    // ── Domains ────────────────────────────────────────────────

    domain: (name, config) => {
      const validated = validateDomainConfig(config)
      return withDomains((d) => d.register(name, validated)).then(() => undefined)
    },

    domains: () =>
      withDomains((d) => d.list()),

    // ── Fluent Query ───────────────────────────────────────────

    from: (ns): FluentQuery => {
      const state = {
        tagFilters: [] as string[],
        searchText: undefined as string | undefined,
        maxResults: undefined as number | undefined,
        jsonPath: undefined as string | undefined,
        jsonValue: undefined as unknown,
      }

      const chain: FluentQuery = {
        tagged(...tags) { state.tagFilters.push(...tags); return chain },
        search(text) { state.searchText = text; return chain },
        limit(n) { state.maxResults = n; return chain },
        where(path, value) { state.jsonPath = path; state.jsonValue = value; return chain },

        async keys() {
          const { store, search } = await getServiceRefs()
          const b = new QueryBuilder(store, search, builderRun, ns)
          state.tagFilters.forEach((t) => b.tagged(t))
          if (state.searchText) b.search(state.searchText)
          if (state.maxResults) b.limit(state.maxResults)
          if (state.jsonPath) b.where(state.jsonPath, state.jsonValue)
          return b.keys()
        },
        async entries() {
          const { store, search } = await getServiceRefs()
          const b = new QueryBuilder(store, search, builderRun, ns)
          state.tagFilters.forEach((t) => b.tagged(t))
          if (state.searchText) b.search(state.searchText)
          if (state.maxResults) b.limit(state.maxResults)
          if (state.jsonPath) b.where(state.jsonPath, state.jsonValue)
          return b.entries()
        },
        async summaries() {
          const { store, search } = await getServiceRefs()
          const b = new QueryBuilder(store, search, builderRun, ns)
          state.tagFilters.forEach((t) => b.tagged(t))
          if (state.searchText) b.search(state.searchText)
          if (state.maxResults) b.limit(state.maxResults)
          if (state.jsonPath) b.where(state.jsonPath, state.jsonValue)
          return b.summaries()
        },
        async count() {
          const { store, search } = await getServiceRefs()
          const b = new QueryBuilder(store, search, builderRun, ns)
          state.tagFilters.forEach((t) => b.tagged(t))
          if (state.searchText) b.search(state.searchText)
          if (state.maxResults) b.limit(state.maxResults)
          if (state.jsonPath) b.where(state.jsonPath, state.jsonValue)
          return b.count()
        },
      }
      return chain
    },

    // ── Fluent Put ─────────────────────────────────────────────

    into: (ns): FluentPut => {
      const state = {
        key: undefined as string | undefined,
        timestamped: false,
        data: undefined as Record<string, unknown> | undefined,
        meta: undefined as Record<string, unknown> | undefined,
        tags: [] as string[],
      }

      const chain: FluentPut = {
        key(k) { state.key = k; return chain },
        timestamped() { state.timestamped = true; return chain },
        data(d) { state.data = d; return chain },
        meta(m) { state.meta = m; return chain },
        tags(...t) { state.tags.push(...t); return chain },

        async put() {
          const { store } = await getServiceRefs()
          const b = new PutBuilder(store, builderRun, ns)
          if (state.key) b.key(state.key)
          if (state.timestamped) b.timestamped()
          if (state.data) b.data(state.data)
          if (state.meta) b.meta(state.meta)
          if (state.tags.length > 0) b.tags(...state.tags)
          return b.put()
        },
      }
      return chain
    },

    // ── Backward Compat ────────────────────────────────────────

    store: (collection, key, data, tags) =>
      withStore((s) => s.put(collection, key, data, tags ? { tags } : undefined))
        .then(() => undefined),

    // ── Export / Import ────────────────────────────────────────

    exportStore: (opts) => {
      if (!fsLayer) return Promise.reject(new Error('Export requires a FileSystem layer. Pass fsLayer to createStoreApi().'))
      return run(Effect.gen(function*() {
        const exp = yield* ExportService
        return yield* exp.exportStore(opts)
      }))
    },

    importStore: (opts) => {
      if (!fsLayer) return Promise.reject(new Error('Import requires a FileSystem layer. Pass fsLayer to createStoreApi().'))
      return run(Effect.gen(function*() {
        const exp = yield* ExportService
        return yield* exp.importStore(opts)
      }))
    },

    profiles: () => {
      if (!fsLayer) return Promise.reject(new Error('Profiles require a FileSystem layer. Pass fsLayer to createStoreApi().'))
      return run(Effect.gen(function*() {
        const exp = yield* ExportService
        return yield* exp.listProfiles()
      }))
    },

    removeProfile: (name) => {
      if (!fsLayer) return Promise.reject(new Error('removeProfile requires a FileSystem layer. Pass fsLayer to createStoreApi().'))
      return run(Effect.gen(function*() {
        const exp = yield* ExportService
        return yield* exp.removeProfile(name)
      }))
    },

    // ── Lifecycle ──────────────────────────────────────────────

    dispose: () => runtime.dispose(),
  }
}
