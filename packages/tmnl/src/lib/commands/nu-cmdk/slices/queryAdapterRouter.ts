import { Effect } from "effect"
import type { QueryRow, ResultKind, Scope as QueryScope } from "./types"
import {
  makeQueryDispatchPlan,
  type LaneAdapter,
  type LaneAdapterInput,
  type QueryDispatchPlan,
} from "./laneAdapters"

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
  readonly addGlobalMiddleware: (middleware: QueryAdapterMiddleware) => Effect.Effect<void>
  readonly addAdapterMiddleware: (
    adapterId: string,
    middleware: QueryAdapterMiddleware,
  ) => Effect.Effect<void>
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

const applyMiddleware = (
  effect: Effect.Effect<ReadonlyArray<QueryRow>, unknown, never>,
  context: AdapterDispatchContext,
  global: ReadonlyArray<QueryAdapterMiddleware>,
  local: ReadonlyArray<QueryAdapterMiddleware>,
): Effect.Effect<ReadonlyArray<QueryRow>, unknown, never> => {
  let current = effect
  for (const middleware of global) {
    current = middleware.run(current, context)
  }
  for (const middleware of local) {
    current = middleware.run(current, context)
  }
  return current
}

export const makeQueryAdapterRouter = (options?: {
  readonly adapters?: ReadonlyArray<LaneAdapter>
  readonly maxConcurrency?: number | "unbounded"
  readonly globalMiddleware?: ReadonlyArray<QueryAdapterMiddleware>
  readonly adapterMiddlewareByAdapterId?: Readonly<Record<string, ReadonlyArray<QueryAdapterMiddleware>>>
}): Effect.Effect<QueryAdapterRouter> =>
  Effect.sync(() => {
    const adapters = new Map<string, LaneAdapter>()
    const globalMiddleware = [...(options?.globalMiddleware ?? [])]
    const adapterMiddlewareByAdapterId = new Map<string, Array<QueryAdapterMiddleware>>()

    for (const [adapterId, middleware] of Object.entries(options?.adapterMiddlewareByAdapterId ?? {})) {
      adapterMiddlewareByAdapterId.set(adapterId, [...middleware])
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

    const addGlobalMiddleware: QueryAdapterRouter["addGlobalMiddleware"] = (middleware) =>
      Effect.sync(() => {
        globalMiddleware.push(middleware)
      })

    const addAdapterMiddleware: QueryAdapterRouter["addAdapterMiddleware"] = (adapterId, middleware) =>
      Effect.sync(() => {
        const current = adapterMiddlewareByAdapterId.get(adapterId)
        if (current) {
          current.push(middleware)
        } else {
          adapterMiddlewareByAdapterId.set(adapterId, [middleware])
        }
      })

    const listAdapters = Effect.sync(() => sortAdapters(Array.from(adapters.values())))

    const dispatch: QueryAdapterRouter["dispatch"] = (input) =>
      Effect.gen(function* () {
        const plan = makeQueryDispatchPlan(input.query)
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

            const scopedMiddleware = adapterMiddlewareByAdapterId.get(adapter.adapterId) ?? []
            const baseEffect = adapter.search(toLaneAdapterInput(dispatchInput))
            const withMiddleware = applyMiddleware(baseEffect, context, globalMiddleware, scopedMiddleware)

            return withMiddleware.pipe(
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
      addGlobalMiddleware,
      addAdapterMiddleware,
      listAdapters,
      dispatch,
    }
  })
