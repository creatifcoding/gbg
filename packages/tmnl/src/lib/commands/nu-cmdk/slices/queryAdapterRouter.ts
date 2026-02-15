import { Effect, Schema } from "effect"
import type { QueryRow, ResultKind, Scope as QueryScope } from "./types"
import {
  makeQueryDispatchPlan,
  type LaneAdapter,
  type LaneAdapterInput,
  type QueryDispatchPlan,
} from "./laneAdapters"

class QueryMiddlewareNotFound extends Schema.TaggedError<QueryMiddlewareNotFound>()(
  "QueryMiddlewareNotFound",
  {
    middlewareId: Schema.String,
  },
) {}

export interface AdapterDispatchInput {
  readonly queryId: string
  readonly scenarioId: string
  readonly query: string
  readonly scope: QueryScope
  readonly dispatchPlan: QueryDispatchPlan
}

export interface AdapterDispatchContext {
  readonly adapter: LaneAdapter
  readonly input: AdapterDispatchInput
}

export interface QueryAdapterMiddleware {
  readonly id: string
  readonly run: (
    effect: Effect.Effect<ReadonlyArray<QueryRow>, unknown, never>,
    context: AdapterDispatchContext,
  ) => Effect.Effect<ReadonlyArray<QueryRow>, unknown, never>
  readonly combine: (other: QueryAdapterMiddleware) => QueryAdapterMiddleware
}

export const queryAdapterMiddleware = (params: {
  id: string
  run: QueryAdapterMiddleware["run"]
}): QueryAdapterMiddleware => ({
  id: params.id,
  run: params.run,
  combine: (other) =>
    queryAdapterMiddleware({
      id: `${params.id}+${other.id}`,
      run: (effect, context) => other.run(params.run(effect, context), context),
    }),
})

export const makeHeavyAdapterAdmissionMiddleware = (options?: {
  readonly id?: string
  readonly minNormalizedQueryLength?: number
  readonly minTerms?: number
  readonly allowedScopes?: ReadonlyArray<QueryScope>
  readonly blockedScopes?: ReadonlyArray<QueryScope>
}): QueryAdapterMiddleware =>
  queryAdapterMiddleware({
    id: options?.id ?? "admission.heavy",
    run: (effect, context) => {
      if (context.adapter.costClass !== "heavy") {
        return effect
      }

      const minLen = options?.minNormalizedQueryLength ?? 3
      const minTerms = options?.minTerms ?? 1
      const plan = context.input.dispatchPlan
      const scope = context.input.scope

      const allowedByScope = options?.allowedScopes
        ? options.allowedScopes.includes(scope)
        : true
      const blockedByScope = options?.blockedScopes
        ? options.blockedScopes.includes(scope)
        : false

      const admitted =
        allowedByScope &&
        !blockedByScope &&
        plan.normalizedQuery.length >= minLen &&
        plan.terms.length >= minTerms

      return admitted ? effect : Effect.succeed([] as const)
    },
  })

export interface QueryAdapterRouterEvent {
  readonly event:
    | "query.middleware.phase.started"
    | "query.middleware.phase.completed"
    | "query.middleware.phase.failed"
    | "query.adapter.dispatch.started"
    | "query.adapter.dispatch.completed"
    | "query.adapter.dispatch.failed"
  readonly queryId: string
  readonly scenarioId: string
  readonly adapterId?: string
  readonly laneId?: string
  readonly middlewareId?: string
  readonly phase: "query.parse" | "middleware.global" | "middleware.adapter" | "adapter.dispatch"
  readonly durationMs?: number
  readonly attrs?: Record<string, unknown>
}

export type AdapterDispatchResult =
  | {
      readonly _tag: "DispatchSucceeded"
      readonly adapterId: string
      readonly laneId: string
      readonly emits: ReadonlyArray<ResultKind>
      readonly rows: ReadonlyArray<QueryRow>
    }
  | {
      readonly _tag: "DispatchFailed"
      readonly adapterId: string
      readonly laneId: string
      readonly emits: ReadonlyArray<ResultKind>
      readonly error: unknown
    }

export interface QueryAdapterRouter {
  readonly addAdapter: (adapter: LaneAdapter) => Effect.Effect<void>
  readonly addAdapters: (adapters: ReadonlyArray<LaneAdapter>) => Effect.Effect<void>

  readonly registerMiddleware: (middleware: QueryAdapterMiddleware) => Effect.Effect<void>
  readonly listRegisteredMiddlewareIds: Effect.Effect<ReadonlyArray<string>>

  readonly addGlobalMiddleware: (middleware: QueryAdapterMiddleware) => Effect.Effect<void>
  readonly addGlobalMiddlewareId: (middlewareId: string) => Effect.Effect<void, QueryMiddlewareNotFound>

  readonly addAdapterMiddleware: (
    adapterId: string,
    middleware: QueryAdapterMiddleware,
  ) => Effect.Effect<void>
  readonly addAdapterMiddlewareId: (
    adapterId: string,
    middlewareId: string,
  ) => Effect.Effect<void, QueryMiddlewareNotFound>

  readonly listAdapters: Effect.Effect<ReadonlyArray<LaneAdapter>>
  readonly dispatch: (input: {
    queryId: string
    scenarioId: string
    query: string
    scope: QueryScope
  }) => Effect.Effect<ReadonlyArray<AdapterDispatchResult>>
}

const costRank: Record<LaneAdapter["costClass"], number> = {
  fast: 0,
  medium: 1,
  heavy: 2,
}

const toLaneAdapterInput = (input: AdapterDispatchInput): LaneAdapterInput => ({
  query: input.query,
  scope: input.scope,
  dispatchPlan: input.dispatchPlan,
})

const sortAdapters = (adapters: ReadonlyArray<LaneAdapter>): ReadonlyArray<LaneAdapter> =>
  [...adapters].sort((a, b) => {
    const byCost = costRank[a.costClass] - costRank[b.costClass]
    if (byCost !== 0) return byCost
    return a.adapterId.localeCompare(b.adapterId)
  })

const uniqueStable = (ids: ReadonlyArray<string>): ReadonlyArray<string> => {
  const seen = new Set<string>()
  const out: Array<string> = []
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  return out
}

export const makeQueryAdapterRouter = (options?: {
  readonly adapters?: ReadonlyArray<LaneAdapter>
  readonly maxConcurrency?: number | "unbounded"
  readonly middlewareRegistry?: ReadonlyArray<QueryAdapterMiddleware>
  readonly globalMiddleware?: ReadonlyArray<QueryAdapterMiddleware>
  readonly globalMiddlewareIds?: ReadonlyArray<string>
  readonly adapterMiddlewareByAdapterId?: Readonly<Record<string, ReadonlyArray<QueryAdapterMiddleware>>>
  readonly adapterMiddlewareIdsByAdapterId?: Readonly<Record<string, ReadonlyArray<string>>>
  readonly onEvent?: (event: QueryAdapterRouterEvent) => void
}): Effect.Effect<QueryAdapterRouter> =>
  Effect.sync(() => {
    const adapters = new Map<string, LaneAdapter>()
    const middlewareRegistry = new Map<string, QueryAdapterMiddleware>()
    const globalMiddlewareIds: Array<string> = []
    const adapterMiddlewareIdsByAdapterId = new Map<string, Array<string>>()

    const emit = (event: QueryAdapterRouterEvent) => {
      options?.onEvent?.(event)
    }

    const registerMiddlewareInternal = (middleware: QueryAdapterMiddleware) => {
      middlewareRegistry.set(middleware.id, middleware)
    }

    for (const middleware of options?.middlewareRegistry ?? []) {
      registerMiddlewareInternal(middleware)
    }

    for (const middleware of options?.globalMiddleware ?? []) {
      registerMiddlewareInternal(middleware)
      globalMiddlewareIds.push(middleware.id)
    }

    for (const middlewareId of options?.globalMiddlewareIds ?? []) {
      if (middlewareRegistry.has(middlewareId)) {
        globalMiddlewareIds.push(middlewareId)
      }
    }

    for (const [adapterId, middleware] of Object.entries(options?.adapterMiddlewareByAdapterId ?? {})) {
      for (const m of middleware) {
        registerMiddlewareInternal(m)
      }
      adapterMiddlewareIdsByAdapterId.set(adapterId, middleware.map((m) => m.id))
    }

    for (const [adapterId, middlewareIds] of Object.entries(options?.adapterMiddlewareIdsByAdapterId ?? {})) {
      const existing = adapterMiddlewareIdsByAdapterId.get(adapterId) ?? []
      adapterMiddlewareIdsByAdapterId.set(adapterId, [...existing, ...middlewareIds])
    }

    for (const adapter of options?.adapters ?? []) {
      adapters.set(adapter.adapterId, adapter)
    }

    const maxConcurrency = options?.maxConcurrency ?? 4

    const addAdapter: QueryAdapterRouter["addAdapter"] = (adapter) =>
      Effect.sync(() => {
        adapters.set(adapter.adapterId, adapter)
      })

    const addAdapters: QueryAdapterRouter["addAdapters"] = (nextAdapters) =>
      Effect.sync(() => {
        for (const adapter of nextAdapters) {
          adapters.set(adapter.adapterId, adapter)
        }
      })

    const registerMiddleware: QueryAdapterRouter["registerMiddleware"] = (middleware) =>
      Effect.sync(() => {
        registerMiddlewareInternal(middleware)
      })

    const listRegisteredMiddlewareIds = Effect.sync(() =>
      Array.from(middlewareRegistry.keys()).sort((a, b) => a.localeCompare(b)),
    )

    const addGlobalMiddleware: QueryAdapterRouter["addGlobalMiddleware"] = (middleware) =>
      Effect.sync(() => {
        registerMiddlewareInternal(middleware)
        globalMiddlewareIds.push(middleware.id)
      })

    const addGlobalMiddlewareId: QueryAdapterRouter["addGlobalMiddlewareId"] = (middlewareId) =>
      Effect.gen(function* () {
        if (!middlewareRegistry.has(middlewareId)) {
          return yield* Effect.fail(new QueryMiddlewareNotFound({ middlewareId }))
        }
        globalMiddlewareIds.push(middlewareId)
      })

    const addAdapterMiddleware: QueryAdapterRouter["addAdapterMiddleware"] = (adapterId, middleware) =>
      Effect.sync(() => {
        registerMiddlewareInternal(middleware)
        const current = adapterMiddlewareIdsByAdapterId.get(adapterId)
        if (current) {
          current.push(middleware.id)
        } else {
          adapterMiddlewareIdsByAdapterId.set(adapterId, [middleware.id])
        }
      })

    const addAdapterMiddlewareId: QueryAdapterRouter["addAdapterMiddlewareId"] = (adapterId, middlewareId) =>
      Effect.gen(function* () {
        if (!middlewareRegistry.has(middlewareId)) {
          return yield* Effect.fail(new QueryMiddlewareNotFound({ middlewareId }))
        }

        const current = adapterMiddlewareIdsByAdapterId.get(adapterId)
        if (current) {
          current.push(middlewareId)
        } else {
          adapterMiddlewareIdsByAdapterId.set(adapterId, [middlewareId])
        }
      })

    const listAdapters = Effect.sync(() => sortAdapters(Array.from(adapters.values())))

    const resolveMiddlewareByIds = (ids: ReadonlyArray<string>): ReadonlyArray<QueryAdapterMiddleware> =>
      uniqueStable(ids)
        .map((id) => middlewareRegistry.get(id))
        .filter((middleware): middleware is QueryAdapterMiddleware => Boolean(middleware))

    const withPhaseTelemetry = <A, E>(params: {
      readonly eventStart: QueryAdapterRouterEvent["event"]
      readonly eventComplete: QueryAdapterRouterEvent["event"]
      readonly eventFail: QueryAdapterRouterEvent["event"]
      readonly queryId: string
      readonly scenarioId: string
      readonly phase: QueryAdapterRouterEvent["phase"]
      readonly adapterId?: string
      readonly laneId?: string
      readonly middlewareId?: string
      readonly attrs?: Record<string, unknown>
      readonly effect: Effect.Effect<A, E, never>
    }): Effect.Effect<A, E, never> => {
      const startedAt = Date.now()

      emit({
        event: params.eventStart,
        queryId: params.queryId,
        scenarioId: params.scenarioId,
        phase: params.phase,
        adapterId: params.adapterId,
        laneId: params.laneId,
        middlewareId: params.middlewareId,
        attrs: params.attrs,
      })

      return params.effect.pipe(
        Effect.onExit((exit) =>
          Effect.sync(() => {
            const durationMs = Date.now() - startedAt

            if (exit._tag === "Success") {
              emit({
                event: params.eventComplete,
                queryId: params.queryId,
                scenarioId: params.scenarioId,
                phase: params.phase,
                adapterId: params.adapterId,
                laneId: params.laneId,
                middlewareId: params.middlewareId,
                durationMs,
                attrs: params.attrs,
              })
            } else {
              emit({
                event: params.eventFail,
                queryId: params.queryId,
                scenarioId: params.scenarioId,
                phase: params.phase,
                adapterId: params.adapterId,
                laneId: params.laneId,
                middlewareId: params.middlewareId,
                durationMs,
                attrs: {
                  ...(params.attrs ?? {}),
                  error: String(exit.cause),
                },
              })
            }
          }),
        ),
      )
    }

    const dispatch: QueryAdapterRouter["dispatch"] = (input) =>
      Effect.gen(function* () {
        const plan = yield* withPhaseTelemetry({
          eventStart: "query.middleware.phase.started",
          eventComplete: "query.middleware.phase.completed",
          eventFail: "query.middleware.phase.failed",
          queryId: input.queryId,
          scenarioId: input.scenarioId,
          phase: "query.parse",
          middlewareId: "query.parse",
          attrs: { queryLength: input.query.length },
          effect: Effect.sync(() => makeQueryDispatchPlan(input.query)),
        })

        const dispatchInput: AdapterDispatchInput = {
          queryId: input.queryId,
          scenarioId: input.scenarioId,
          query: input.query,
          scope: input.scope,
          dispatchPlan: plan,
        }

        const orderedAdapters = sortAdapters(Array.from(adapters.values()))

        return yield* Effect.forEach(
          orderedAdapters,
          (adapter) => {
            const context: AdapterDispatchContext = {
              adapter,
              input: dispatchInput,
            }

            const globalMiddleware = resolveMiddlewareByIds(globalMiddlewareIds)
            const localMiddlewareIds = adapterMiddlewareIdsByAdapterId.get(adapter.adapterId) ?? []
            const localMiddleware = resolveMiddlewareByIds(localMiddlewareIds)

            const baseEffect = adapter.search(toLaneAdapterInput(dispatchInput))
            let withMiddleware: Effect.Effect<ReadonlyArray<QueryRow>, unknown, never> = baseEffect

            for (const middleware of globalMiddleware) {
              withMiddleware = withPhaseTelemetry({
                eventStart: "query.middleware.phase.started",
                eventComplete: "query.middleware.phase.completed",
                eventFail: "query.middleware.phase.failed",
                queryId: dispatchInput.queryId,
                scenarioId: dispatchInput.scenarioId,
                phase: "middleware.global",
                adapterId: adapter.adapterId,
                laneId: adapter.laneId,
                middlewareId: middleware.id,
                effect: middleware.run(withMiddleware, context),
              })
            }

            for (const middleware of localMiddleware) {
              withMiddleware = withPhaseTelemetry({
                eventStart: "query.middleware.phase.started",
                eventComplete: "query.middleware.phase.completed",
                eventFail: "query.middleware.phase.failed",
                queryId: dispatchInput.queryId,
                scenarioId: dispatchInput.scenarioId,
                phase: "middleware.adapter",
                adapterId: adapter.adapterId,
                laneId: adapter.laneId,
                middlewareId: middleware.id,
                effect: middleware.run(withMiddleware, context),
              })
            }

            return withPhaseTelemetry({
              eventStart: "query.adapter.dispatch.started",
              eventComplete: "query.adapter.dispatch.completed",
              eventFail: "query.adapter.dispatch.failed",
              queryId: dispatchInput.queryId,
              scenarioId: dispatchInput.scenarioId,
              phase: "adapter.dispatch",
              adapterId: adapter.adapterId,
              laneId: adapter.laneId,
              attrs: {
                costClass: adapter.costClass,
                emits: adapter.emits,
              },
              effect: withMiddleware,
            }).pipe(
              Effect.map((rows) =>
                ({
                  _tag: "DispatchSucceeded",
                  adapterId: adapter.adapterId,
                  laneId: adapter.laneId,
                  emits: adapter.emits,
                  rows,
                }) as const,
              ),
              Effect.catchAll((error) =>
                Effect.succeed({
                  _tag: "DispatchFailed",
                  adapterId: adapter.adapterId,
                  laneId: adapter.laneId,
                  emits: adapter.emits,
                  error,
                } as const),
              ),
            )
          },
          { concurrency: maxConcurrency },
        )
      })

    return {
      addAdapter,
      addAdapters,
      registerMiddleware,
      listRegisteredMiddlewareIds,
      addGlobalMiddleware,
      addGlobalMiddlewareId,
      addAdapterMiddleware,
      addAdapterMiddlewareId,
      listAdapters,
      dispatch,
    }
  })

export {
  QueryMiddlewareNotFound,
}
