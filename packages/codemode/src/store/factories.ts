/**
 * @module factories
 *
 * RLM Factory Meta-Patterns — Effect v4 services with dual API facades.
 *
 * Three patterns, one composition hierarchy:
 *   collection() — atom: namespace-scoped handle
 *   domain()     — group: multiple collections under one root
 *   pipeline()   — sequence: ordered stages with lineage tracking
 *
 * Architecture:
 *   Effect v4 services internally (Context.Service, Ref, Schema.TaggedStruct)
 *   Plain async functions externally (eval sandbox / ms.*)
 *   DI seam: Layer<SqlClient> injected at construction
 *
 * All three resolve to RlmStore + SearchIndex underneath.
 */
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Context from "effect/Context"
import * as Schema from "effect/Schema"
import * as Ref from "effect/Ref"
import * as ManagedRuntime from "effect/ManagedRuntime"
import { SqlClient } from "effect/unstable/sql/SqlClient"
import { RlmStore, RlmStoreLive } from "./service.js"
import { SearchIndex, SearchIndexLive } from "./search.js"
import { MigrationLayer } from "./migrations.js"

// ═══════════════════════════════════════════════════════════
// §1  EVENT SCHEMAS
// ═══════════════════════════════════════════════════════════

const CollectionPut = Schema.TaggedStruct("CollectionPut", {
  ns:        Schema.NonEmptyString,
  key:       Schema.NonEmptyString,
  tags:      Schema.Array(Schema.String),
  timestamp: Schema.String,
})

const CollectionCapture = Schema.TaggedStruct("CollectionCapture", {
  ns:        Schema.NonEmptyString,
  key:       Schema.NonEmptyString,
  prefix:    Schema.NonEmptyString,
  tags:      Schema.Array(Schema.String),
  timestamp: Schema.String,
})

const StageEmit = Schema.TaggedStruct("StageEmit", {
  pipeline:  Schema.NonEmptyString,
  runId:     Schema.NonEmptyString,
  stage:     Schema.NonEmptyString,
  key:       Schema.NonEmptyString,
  timestamp: Schema.String,
})

// v4-beta.23: Schema.Union takes an array, not variadic
const FactoryEvent = Schema.Union([CollectionPut, CollectionCapture, StageEmit])
type FactoryEvent = typeof FactoryEvent.Type

// ═══════════════════════════════════════════════════════════
// §2  COLLECTION FACTORY (Effect Service)
// ═══════════════════════════════════════════════════════════

interface CollectionConfig {
  ns: string
  defaultTags?: string[]
  temporal?: boolean
  required?: string[]
}

interface CollectionHandle {
  put:     (key: string, data: Record<string, unknown>, tags?: string[]) => Effect.Effect<{ ns: string; key: string }, any>
  capture: (prefix: string, data: Record<string, unknown>, tags?: string[]) => Effect.Effect<{ ns: string; key: string }, any>
  get:     (key: string) => Effect.Effect<unknown | null, any>
  raw:     (key: string) => Effect.Effect<unknown | null, any>
  meta:    (key: string) => Effect.Effect<Record<string, unknown> | null, any>
  keys:    () => Effect.Effect<readonly string[], any>
  search:  (text: string) => Effect.Effect<readonly any[], any>
  count:   () => Effect.Effect<number, any>
  clear:   () => Effect.Effect<number, any>
}

interface CollectionFactoryShape {
  make: (config: CollectionConfig) => CollectionHandle
}

class CollectionFactory extends Context.Service<CollectionFactory, CollectionFactoryShape>()(
  "@tmnl/rlm/CollectionFactory"
) {}

const CollectionFactoryLive = Layer.effect(CollectionFactory)(
  Effect.gen(function*() {
    const store  = yield* RlmStore
    const search = yield* SearchIndex

    return CollectionFactory.of({
      make(config) {
        const { ns, defaultTags = [], temporal = false, required = ["summary"] } = config
        const mergeTags = (extra?: string[]) => [...defaultTags, ...(extra ?? [])]

        const validate = (data: Record<string, unknown>) =>
          Effect.gen(function*() {
            const m = data._meta as Record<string, unknown> | undefined
            for (const req of required) {
              if (!m?.[req]) {
                yield* Effect.fail(new Error(`collection(${ns}): _meta.${req} required`))
              }
            }
          })

        const doPut = (key: string, data: Record<string, unknown>, tags?: string[]) =>
          Effect.gen(function*() {
            yield* validate(data)
            const t = mergeTags(tags)
            yield* store.put(ns, key, data, { tags: t })
            return { ns, key }
          })

        const doCapture = (prefix: string, data: Record<string, unknown>, tags?: string[]) =>
          Effect.gen(function*() {
            yield* validate(data)
            const t = mergeTags(tags)
            return yield* store.putNow(ns, prefix, data, { tags: t })
          })

        return {
          put:     temporal ? (key, data, tags) => doCapture(key, data, tags) : doPut,
          capture: doCapture,
          get:     (key) => store.get(ns, key),
          raw:     (key) => store.getRaw(ns, key),
          meta:    (key) => store.describe(ns, key),
          keys:    ()    => store.keys(ns),
          search:  (text) => search.search(text, ns),
          count:   ()    => Effect.map(store.keys(ns), (ks) => ks.length),
          clear:   ()    => store.clear(ns),
        }
      },
    })
  })
)

// ═══════════════════════════════════════════════════════════
// §3  DOMAIN FACTORY (Effect Service)
// ═══════════════════════════════════════════════════════════

interface SubCollectionDef {
  tags?: string[]
  temporal?: boolean
}

interface DomainHandle {
  sub:    (name: string) => CollectionHandle
  search: (text: string) => Effect.Effect<readonly any[], any>
  events: () => Effect.Effect<readonly FactoryEvent[], any>
  subs:   () => string[]
}

interface DomainFactoryShape {
  create: (
    root: string,
    subs: Record<string, SubCollectionDef>,
    domainTags?: string[],
  ) => Effect.Effect<DomainHandle, any>
}

class DomainFactory extends Context.Service<DomainFactory, DomainFactoryShape>()(
  "@tmnl/rlm/DomainFactory"
) {}

const DomainFactoryLive = Layer.effect(DomainFactory)(
  Effect.gen(function*() {
    const collFactory = yield* CollectionFactory
    const search      = yield* SearchIndex

    return DomainFactory.of({
      create: (root, subs, domainTags = []) =>
        Effect.gen(function*() {
          const eventLog = yield* Ref.make<readonly FactoryEvent[]>([])
          const subNames = Object.keys(subs)
          const handles = new Map<string, CollectionHandle>()

          for (const [name, def] of Object.entries(subs)) {
            const ns = `${root}.${name}`
            const base = collFactory.make({
              ns,
              defaultTags: [...domainTags, ...(def.tags ?? [])],
              temporal: def.temporal ?? false,
            })

            // Wrap put/capture to emit events
            const now = () => new Date().toISOString()
            const wrapped: CollectionHandle = {
              ...base,
              put: (key, data, tags) => Effect.gen(function*() {
                const result = yield* base.put(key, data, tags)
                yield* Ref.update(eventLog, (evts) => [...evts, {
                  _tag: "CollectionPut" as const,
                  ns, key: result.key,
                  tags: [...domainTags, ...(def.tags ?? []), ...(tags ?? [])],
                  timestamp: now(),
                }])
                return result
              }),
              capture: (prefix, data, tags) => Effect.gen(function*() {
                const result = yield* base.capture(prefix, data, tags)
                yield* Ref.update(eventLog, (evts) => [...evts, {
                  _tag: "CollectionCapture" as const,
                  ns, key: result.key, prefix,
                  tags: [...domainTags, ...(def.tags ?? []), ...(tags ?? [])],
                  timestamp: now(),
                }])
                return result
              }),
            }
            handles.set(name, wrapped)
          }

          return {
            sub:    (name) => handles.get(name)!,
            search: (text) => search.search(text, `${root}.*`),
            events: () => Ref.get(eventLog),
            subs:   () => subNames,
          } satisfies DomainHandle
        }),
    })
  })
)

// ═══════════════════════════════════════════════════════════
// §4  PIPELINE FACTORY (Effect Service)
// ═══════════════════════════════════════════════════════════

interface RunState {
  id: string
  pipeline: string
  stages: readonly string[]
  current: number
  startedAt: string
  events: readonly typeof StageEmit.Type[]
}

interface PipelineStageHandle {
  emit:   (data: Record<string, unknown>) => Effect.Effect<{ ns: string; key: string }, any>
  input:  () => Effect.Effect<unknown | null, any>
  latest: (n?: number) => Effect.Effect<readonly any[], any>
}

interface PipelineRunHandle {
  id:     string
  stage:  (name: string) => PipelineStageHandle
  events: () => Effect.Effect<readonly typeof StageEmit.Type[], any>
  state:  () => Effect.Effect<RunState, any>
}

interface PipelineDefHandle {
  start:  (runId?: string) => Effect.Effect<PipelineRunHandle, any>
  runs:   () => Effect.Effect<readonly any[], any>
  search: (text: string) => Effect.Effect<readonly any[], any>
}

interface PipelineFactoryShape {
  define: (name: string, stageNames: readonly string[]) => Effect.Effect<PipelineDefHandle, any>
}

class PipelineFactory extends Context.Service<PipelineFactory, PipelineFactoryShape>()(
  "@tmnl/rlm/PipelineFactory"
) {}

const PipelineFactoryLive = Layer.effect(PipelineFactory)(
  Effect.gen(function*() {
    const store  = yield* RlmStore
    const search = yield* SearchIndex

    return PipelineFactory.of({
      define: (name, stageNames) => Effect.gen(function*() {
        return {
          start: (runId) => Effect.gen(function*() {
            const id = runId ?? `run--${Date.now()}`
            const runRef = yield* Ref.make<RunState>({
              id, pipeline: name,
              stages: stageNames,
              current: 0,
              startedAt: new Date().toISOString(),
              events: [],
            })

            // Persist run metadata
            yield* store.put(`${name}.runs`, id, {
              stages: [...stageNames], startedAt: new Date().toISOString(),
            }, { tags: ["pipeline", name, id] })

            const stageHandle = (stageName: string): PipelineStageHandle => {
              const stageIdx = stageNames.indexOf(stageName)
              const ns = `${name}.${stageName}`

              return {
                emit: (data) => Effect.gen(function*() {
                  const meta = (data._meta as Record<string, unknown>) ?? {}
                  if (!meta.summary) meta.summary = `${stageName} output`
                  const envelope = {
                    ...data,
                    _meta: { ...meta, pipeline: name, runId: id, stage: stageName },
                  }

                  const result = yield* store.putNow(ns, id, envelope, {
                    tags: ["pipeline", name, id, stageName],
                  })

                  yield* Ref.update(runRef, (s) => ({
                    ...s,
                    current: Math.max(s.current, stageIdx + 1),
                    events: [...s.events, {
                      _tag: "StageEmit" as const,
                      pipeline: name, runId: id, stage: stageName,
                      key: result.key, timestamp: new Date().toISOString(),
                    }],
                  }))

                  return result
                }),

                input: () => Effect.gen(function*() {
                  if (stageIdx === 0) return null
                  const prevStage = stageNames[stageIdx - 1]
                  const prevNs = `${name}.${prevStage}`
                  const entries = yield* store.query(prevNs, { tags: [id] })
                  return entries.length > 0 ? entries[entries.length - 1] : null
                }),

                latest: (n = 5) => store.catalog(`${ns}*`),
              }
            }

            return {
              id,
              stage: stageHandle,
              events: () => Effect.map(Ref.get(runRef), (s) => s.events),
              state: () => Ref.get(runRef),
            } satisfies PipelineRunHandle
          }),

          runs: () => store.catalog(`${name}.runs*`),
          search: (text) => search.search(text, `${name}.*`),
        } satisfies PipelineDefHandle
      }),
    })
  })
)

// ═══════════════════════════════════════════════════════════
// §5  COMBINED LAYER
// ═══════════════════════════════════════════════════════════

/** All factory services, properly layered */
export const FactoryLive = Layer.mergeAll(
  CollectionFactoryLive,
  DomainFactoryLive,
  PipelineFactoryLive,
)

// ═══════════════════════════════════════════════════════════
// §6  DUAL API FACADE (Effect → ms.*)
// ═══════════════════════════════════════════════════════════

/** Async collection handle for eval sandbox */
export interface CollectionApi {
  put:     (key: string, data: Record<string, unknown>, tags?: string[]) => Promise<{ ns: string; key: string }>
  capture: (prefix: string, data: Record<string, unknown>, tags?: string[]) => Promise<{ ns: string; key: string }>
  get:     (key: string) => Promise<unknown | null>
  raw:     (key: string) => Promise<unknown | null>
  meta:    (key: string) => Promise<Record<string, unknown> | null>
  keys:    () => Promise<readonly string[]>
  search:  (text: string) => Promise<readonly any[]>
  count:   () => Promise<number>
  clear:   () => Promise<number>
}

/** Async domain handle for eval sandbox */
export interface DomainApi {
  sub:    (name: string) => CollectionApi
  search: (text: string) => Promise<readonly any[]>
  events: () => Promise<readonly FactoryEvent[]>
  subs:   () => string[]
}

/** Async pipeline run handle for eval sandbox */
export interface PipelineRunApi {
  id: string
  stage: (name: string) => {
    emit:   (data: Record<string, unknown>) => Promise<{ ns: string; key: string }>
    input:  () => Promise<unknown | null>
    latest: (n?: number) => Promise<readonly any[]>
  }
  events: () => Promise<readonly any[]>
}

/** Async pipeline definition handle for eval sandbox */
export interface PipelineDefApi {
  start:  (runId?: string) => Promise<PipelineRunApi>
  runs:   () => Promise<readonly any[]>
  search: (text: string) => Promise<readonly any[]>
}

/** Full factory API surface for eval sandbox */
export interface FactoryApi {
  collection: (ns: string, opts?: {
    defaultTags?: string[]
    temporal?: boolean
    required?: string[]
  }) => CollectionApi

  domain: (root: string, subs: Record<string, SubCollectionDef>, domainTags?: string[]) => Promise<DomainApi>

  pipeline: {
    define: (name: string, stages: string[]) => Promise<PipelineDefApi>
  }

  /** Dispose the ManagedRuntime. Call in afterAll/cleanup. */
  dispose: () => Promise<void>
}

// ── Adapters: Effect handle → async handle ───────────────

function wrapCollection(handle: CollectionHandle, run: <A>(e: Effect.Effect<A, any, any>) => Promise<A>): CollectionApi {
  return {
    put:     (key, data, tags) => run(handle.put(key, data, tags)),
    capture: (prefix, data, tags) => run(handle.capture(prefix, data, tags)),
    get:     (key) => run(handle.get(key)),
    raw:     (key) => run(handle.raw(key)),
    meta:    (key) => run(handle.meta(key)),
    keys:    () => run(handle.keys()),
    search:  (text) => run(handle.search(text)),
    count:   () => run(handle.count()),
    clear:   () => run(handle.clear()),
  }
}

function wrapDomain(handle: DomainHandle, run: <A>(e: Effect.Effect<A, any, any>) => Promise<A>): DomainApi {
  return {
    sub:    (name) => wrapCollection(handle.sub(name), run),
    search: (text) => run(handle.search(text)),
    events: () => run(handle.events()),
    subs:   () => handle.subs(),
  }
}

function wrapPipelineRun(handle: PipelineRunHandle, run: <A>(e: Effect.Effect<A, any, any>) => Promise<A>): PipelineRunApi {
  return {
    id: handle.id,
    stage: (name) => {
      const s = handle.stage(name)
      return {
        emit:   (data) => run(s.emit(data)),
        input:  () => run(s.input()),
        latest: (n) => run(s.latest(n)),
      }
    },
    events: () => run(handle.events()),
  }
}

// ═══════════════════════════════════════════════════════════
// §7  FACTORY: createFactoryApi(sqlLayer)
// ═══════════════════════════════════════════════════════════

/**
 * Create the full factory API.
 * Same DI pattern as createStoreApi():
 *   inject Layer<SqlClient> → get plain async functions.
 */
export function createFactoryApi(sqlLayer: Layer.Layer<SqlClient>): FactoryApi {
  // Build the full layer graph — dependencies flow bottom-up:
  //   SqlClient → RlmStore + SearchIndex → CollectionFactory → DomainFactory
  //   SqlClient → RlmStore + SearchIndex → PipelineFactory
  const StoreLayers = Layer.mergeAll(RlmStoreLive, SearchIndexLive).pipe(
    Layer.provide(MigrationLayer),
    Layer.provide(sqlLayer),
  )
  const CollLayer = CollectionFactoryLive.pipe(Layer.provide(StoreLayers))
  const DomLayer = DomainFactoryLive.pipe(
    Layer.provide(CollLayer),
    Layer.provide(StoreLayers),
  )
  const PipeLayer = PipelineFactoryLive.pipe(Layer.provide(StoreLayers))

  const AppLayer = Layer.mergeAll(StoreLayers, CollLayer, DomLayer, PipeLayer)

  const runtime = ManagedRuntime.make(AppLayer)
  const run = <A>(effect: Effect.Effect<A, any, any>): Promise<A> => runtime.runPromise(effect)

  return {
    collection: (ns, opts) => {
      // Create the Effect handle eagerly (it's sync in the service)
      let _handle: CollectionHandle | null = null
      const getHandle = async () => {
        if (!_handle) {
          _handle = await run(Effect.gen(function*() {
            const factory = yield* CollectionFactory
            return factory.make({ ns, ...opts })
          }))
        }
        return _handle
      }

      // Return async wrapper that lazy-inits the handle
      return {
        put:     async (key, data, tags) => { const h = await getHandle(); return run(h.put(key, data, tags)) },
        capture: async (prefix, data, tags) => { const h = await getHandle(); return run(h.capture(prefix, data, tags)) },
        get:     async (key) => { const h = await getHandle(); return run(h.get(key)) },
        raw:     async (key) => { const h = await getHandle(); return run(h.raw(key)) },
        meta:    async (key) => { const h = await getHandle(); return run(h.meta(key)) },
        keys:    async () => { const h = await getHandle(); return run(h.keys()) },
        search:  async (text) => { const h = await getHandle(); return run(h.search(text)) },
        count:   async () => { const h = await getHandle(); return run(h.count()) },
        clear:   async () => { const h = await getHandle(); return run(h.clear()) },
      }
    },

    domain: async (root, subs, domainTags) => {
      const handle = await run(Effect.gen(function*() {
        const factory = yield* DomainFactory
        return yield* factory.create(root, subs, domainTags)
      }))
      return wrapDomain(handle, run)
    },

    dispose: () => runtime.dispose(),

    pipeline: {
      define: async (name, stages) => {
        const defHandle = await run(Effect.gen(function*() {
          const factory = yield* PipelineFactory
          return yield* factory.define(name, stages)
        }))
        return {
          start: async (runId) => {
            const runHandle = await run(defHandle.start(runId))
            return wrapPipelineRun(runHandle, run)
          },
          runs:   () => run(defHandle.runs()),
          search: (text) => run(defHandle.search(text)),
        }
      },
    },
  }
}

// ═══════════════════════════════════════════════════════════
// §8  EXPORTS
// ═══════════════════════════════════════════════════════════

// Effect services (for Effect consumers)
export { CollectionFactory, CollectionFactoryLive }
export { DomainFactory, DomainFactoryLive }
export { PipelineFactory, PipelineFactoryLive }

// Types
export type { CollectionConfig, CollectionHandle, SubCollectionDef }
export type { DomainHandle, DomainFactoryShape }
export type { PipelineRunHandle, PipelineDefHandle, PipelineStageHandle, PipelineFactoryShape }
export type { RunState, FactoryEvent }
