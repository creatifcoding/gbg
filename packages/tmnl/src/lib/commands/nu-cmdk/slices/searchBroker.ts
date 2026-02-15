import { Registry } from "@effect-atom/atom"
import { Effect, Exit, Option, Scope, Schema } from "effect"
import { makeInMemoryCacheGuard } from "./cacheGuard"
import {
  createQuerySession,
  type QuerySessionHandle,
} from "./querySession"
import { makeDefaultPolicyBundle, type PolicyBundle } from "./policyBundle"
import {
  defaultRendererRegistry,
  makeDefaultRendererCompatibilityMap,
  type RendererCompatibilityMap,
} from "./rendererCompatibility"
import type { LaneAdapter } from "./laneAdapters"
import {
  makeQueryAdapterRouter,
  type QueryAdapterMiddleware,
  type QueryAdapterRouter,
} from "./queryAdapterRouter"
import {
  type EventRecord,
  type QuerySessionMessage,
  type QuerySessionState,
  type Scope as QueryScope,
  type Theta,
} from "./types"

class QuerySessionNotFound extends Schema.TaggedError<QuerySessionNotFound>()(
  "QuerySessionNotFound",
  {
    queryId: Schema.String,
  },
) {}

class QuerySessionAlreadyExists extends Schema.TaggedError<QuerySessionAlreadyExists>()(
  "QuerySessionAlreadyExists",
  {
    queryId: Schema.String,
  },
) {}

interface SessionEntry {
  readonly queryId: string
  readonly scope: Scope.CloseableScope
  readonly queryScope: QueryScope
  readonly queryText: string
  readonly handle: QuerySessionHandle
  readonly scenarioId: string
  readonly laneSeq: Map<string, number>
}

export interface NuCmdkSearchBroker {
  readonly startQuery: (params: {
    queryId: string
    queryText: string
    scope: QueryScope
    scenarioId: string
  }) => Effect.Effect<void, QuerySessionAlreadyExists>

  readonly tell: (
    queryId: string,
    msg: QuerySessionMessage,
  ) => Effect.Effect<void, QuerySessionNotFound>

  readonly runAdapters: (
    queryId: string,
    queryOverride?: string,
  ) => Effect.Effect<void, QuerySessionNotFound>

  readonly snapshot: (
    queryId: string,
  ) => Effect.Effect<QuerySessionState, QuerySessionNotFound>

  readonly stopQuery: (
    queryId: string,
  ) => Effect.Effect<void, QuerySessionNotFound>

  readonly stopAll: Effect.Effect<void>

  readonly listQueryIds: Effect.Effect<ReadonlyArray<string>>
}

export interface NuCmdkSearchBrokerDeps {
  readonly theta: Theta
  readonly runId: string
  readonly registry: Registry.Registry
  readonly onEvent: (event: EventRecord) => void
  readonly policyBundle?: PolicyBundle
  readonly rendererCompatibility?: RendererCompatibilityMap
  readonly rendererRegistry?: ReadonlySet<string>
  readonly adapters?: ReadonlyArray<LaneAdapter>
  readonly adapterRouter?: QueryAdapterRouter
  readonly maxAdapterConcurrency?: number | "unbounded"
  readonly middlewareRegistry?: ReadonlyArray<QueryAdapterMiddleware>
  readonly globalAdapterMiddleware?: ReadonlyArray<QueryAdapterMiddleware>
  readonly globalAdapterMiddlewareIds?: ReadonlyArray<string>
  readonly adapterMiddlewareByAdapterId?: Readonly<Record<string, ReadonlyArray<QueryAdapterMiddleware>>>
  readonly adapterMiddlewareIdsByAdapterId?: Readonly<Record<string, ReadonlyArray<string>>>
}

export const makeNuCmdkSearchBroker = (
  deps: NuCmdkSearchBrokerDeps,
): Effect.Effect<NuCmdkSearchBroker> =>
  Effect.gen(function* () {
    const sessions = new Map<string, SessionEntry>()

    const getEntry = (queryId: string): Option.Option<SessionEntry> =>
      Option.fromNullable(sessions.get(queryId))

    const emitBrokerEvent = (
      params: {
        queryId: string
        scenarioId: string
        event: string
        laneId?: string
        attrs?: Record<string, unknown>
      },
    ) => {
      deps.onEvent({
        event: params.event,
        run_id: deps.runId,
        query_id: params.queryId,
        scenario_id: params.scenarioId,
        lane_id: params.laneId,
        t_ms: Date.now(),
        attrs: params.attrs ?? {},
      })
    }

    const adapterRouter = deps.adapterRouter ?? (yield* makeQueryAdapterRouter({
      adapters: deps.adapters,
      maxConcurrency: deps.maxAdapterConcurrency,
      middlewareRegistry: deps.middlewareRegistry,
      globalMiddleware: deps.globalAdapterMiddleware,
      globalMiddlewareIds: deps.globalAdapterMiddlewareIds,
      adapterMiddlewareByAdapterId: deps.adapterMiddlewareByAdapterId,
      adapterMiddlewareIdsByAdapterId: deps.adapterMiddlewareIdsByAdapterId,
      onEvent: (event) => {
        emitBrokerEvent({
          queryId: event.queryId,
          scenarioId: event.scenarioId,
          event: event.event,
          laneId: event.laneId,
          attrs: {
            ...(event.attrs ?? {}),
            phase: event.phase,
            middlewareId: event.middlewareId,
            adapterId: event.adapterId,
            durationMs: event.durationMs,
          },
        })
      },
    }))

    const startQuery: NuCmdkSearchBroker["startQuery"] = ({ queryId, queryText, scope, scenarioId }) =>
      Effect.gen(function* () {
        if (sessions.has(queryId)) {
          return yield* Effect.fail(new QuerySessionAlreadyExists({ queryId }))
        }

        const childScope = yield* Scope.make()

        const handle = yield* createQuerySession({
          queryId,
          queryText,
          scope,
          deps: {
            theta: deps.theta,
            policyBundle: deps.policyBundle ?? makeDefaultPolicyBundle(),
            rendererCompatibility: deps.rendererCompatibility ?? makeDefaultRendererCompatibilityMap(),
            rendererRegistry: deps.rendererRegistry ?? defaultRendererRegistry(),
            cacheGuard: makeInMemoryCacheGuard(deps.registry),
            registry: deps.registry,
            runId: deps.runId,
            scenarioId,
            onEvent: deps.onEvent,
          },
        }).pipe(Effect.provideService(Scope.Scope, childScope))

        sessions.set(queryId, {
          queryId,
          queryText,
          queryScope: scope,
          handle,
          scope: childScope,
          scenarioId,
          laneSeq: new Map(),
        })
      })

    const tell: NuCmdkSearchBroker["tell"] = (queryId, msg) =>
      Effect.gen(function* () {
        const entry = getEntry(queryId)
        if (Option.isNone(entry)) {
          return yield* Effect.fail(new QuerySessionNotFound({ queryId }))
        }

        yield* entry.value.handle.tell(msg)
      })

    const runAdapters: NuCmdkSearchBroker["runAdapters"] = (queryId, queryOverride) =>
      Effect.gen(function* () {
        const entryOpt = getEntry(queryId)
        if (Option.isNone(entryOpt)) {
          return yield* Effect.fail(new QuerySessionNotFound({ queryId }))
        }

        const entry = entryOpt.value
        const queryText = queryOverride ?? entry.queryText

        const adapters = yield* adapterRouter.listAdapters
        for (const adapter of adapters) {
          emitBrokerEvent({
            queryId: entry.queryId,
            scenarioId: entry.scenarioId,
            event: "lane.adapter.started",
            laneId: adapter.laneId,
            attrs: {
              adapterId: adapter.adapterId,
              costClass: adapter.costClass,
            },
          })
        }

        const dispatches = yield* adapterRouter.dispatch({
          queryId: entry.queryId,
          scenarioId: entry.scenarioId,
          query: queryText,
          scope: entry.queryScope,
        })

        for (const dispatch of dispatches) {
          if (dispatch._tag === "DispatchFailed") {
            emitBrokerEvent({
              queryId: entry.queryId,
              scenarioId: entry.scenarioId,
              event: "lane.adapter.failed",
              laneId: dispatch.laneId,
              attrs: {
                adapterId: dispatch.adapterId,
                error: String(dispatch.error),
              },
            })
            continue
          }

          const allowedKinds = new Set(dispatch.emits)
          const acceptedRows = dispatch.rows.filter((row) => allowedKinds.has(row.category))
          const rejectedRows = dispatch.rows.filter((row) => !allowedKinds.has(row.category))

          for (const rejected of rejectedRows) {
            emitBrokerEvent({
              queryId: entry.queryId,
              scenarioId: entry.scenarioId,
              event: "lane.adapter.kind_mismatch",
              laneId: dispatch.laneId,
              attrs: {
                adapterId: dispatch.adapterId,
                rowId: rejected.rowId,
                category: rejected.category,
                emits: dispatch.emits,
              },
            })
          }

          const nextSeq = (entry.laneSeq.get(dispatch.laneId) ?? 0) + 1
          entry.laneSeq.set(dispatch.laneId, nextSeq)

          yield* entry.handle.tell({
            _tag: "IngestChunk",
            laneId: dispatch.laneId,
            seq: nextSeq,
            rows: acceptedRows,
            scenarioId: entry.scenarioId,
          })

          emitBrokerEvent({
            queryId: entry.queryId,
            scenarioId: entry.scenarioId,
            event: "lane.adapter.succeeded",
            laneId: dispatch.laneId,
            attrs: {
              adapterId: dispatch.adapterId,
              count: acceptedRows.length,
              droppedKindMismatch: rejectedRows.length,
            },
          })
        }

        yield* entry.handle.tell({
          _tag: "PlannerTick",
          scenarioId: entry.scenarioId,
        })
      })

    const snapshot: NuCmdkSearchBroker["snapshot"] = (queryId) =>
      Effect.gen(function* () {
        const entry = getEntry(queryId)
        if (Option.isNone(entry)) {
          return yield* Effect.fail(new QuerySessionNotFound({ queryId }))
        }

        return yield* entry.value.handle.snapshot
      })

    const stopQuery: NuCmdkSearchBroker["stopQuery"] = (queryId) =>
      Effect.gen(function* () {
        const entry = getEntry(queryId)
        if (Option.isNone(entry)) {
          return yield* Effect.fail(new QuerySessionNotFound({ queryId }))
        }

        yield* entry.value.handle.shutdown
        yield* Scope.close(entry.value.scope, Exit.succeed(undefined))
        sessions.delete(queryId)
      })

    const stopAll = Effect.gen(function* () {
      for (const entry of sessions.values()) {
        yield* entry.handle.shutdown
        yield* Scope.close(entry.scope, Exit.succeed(undefined))
      }
      sessions.clear()
    })

    const listQueryIds = Effect.sync(() => Array.from(sessions.keys()))

    return {
      startQuery,
      tell,
      runAdapters,
      snapshot,
      stopQuery,
      stopAll,
      listQueryIds,
    }
  })

export {
  QuerySessionNotFound,
  QuerySessionAlreadyExists,
}
