import { Atom, Registry } from "@effect-atom/atom"
import {
  Deferred,
  Effect,
  Mailbox,
  Scope,
} from "effect"
import type { CacheGuard } from "./cacheGuard"
import type { PolicyBundle } from "./policyBundle"
import { isResolverAllowed } from "./policyBundle"
import type { RendererCompatibilityMap } from "./rendererCompatibility"
import { resolveRendererToken } from "./rendererCompatibility"
import {
  type EventRecord,
  type LaneState,
  type QuerySessionMessage,
  type QuerySessionState,
  type QueryRow,
  type Theta,
  makeInitialSessionState,
  nowMs,
} from "./types"

type Envelope =
  | { readonly _tag: "Tell"; readonly msg: QuerySessionMessage }
  | { readonly _tag: "AskSnapshot"; readonly reply: Deferred.Deferred<never, QuerySessionState> }

export interface QuerySessionDeps {
  readonly theta: Theta
  readonly policyBundle: PolicyBundle
  readonly rendererCompatibility: RendererCompatibilityMap
  readonly rendererRegistry: ReadonlySet<string>
  readonly cacheGuard: CacheGuard
  readonly registry: Registry.Registry
  readonly runId: string
  readonly scenarioId: string
  readonly onEvent: (event: EventRecord) => void
}

export interface QuerySessionHandle {
  readonly tell: (msg: QuerySessionMessage) => Effect.Effect<void>
  readonly snapshot: Effect.Effect<QuerySessionState>
  readonly shutdown: Effect.Effect<void>
}

const mkLane = (laneId: string, theta: Theta): LaneState => ({
  laneId: laneId as LaneState["laneId"],
  lastSeq: -1,
  health: "healthy",
  publishBudget: theta.publish_budget_base,
  pending: [],
  publishedCount: 0,
  fallbackRows: 0,
  decodeDrops: 0,
  resolverDenies: 0,
  lastUpdateMs: nowMs(),
})

const rankRows = (rowsById: Record<string, QueryRow>, theta: Theta): ReadonlyArray<QueryRow["rowId"]> => {
  const scored = Object.values(rowsById).map((row) => ({
    rowId: row.rowId,
    score: row.score * theta.rank_weight.provider + row.score * theta.rank_weight.lexical,
  }))

  return scored
    .sort((a, b) => b.score - a.score)
    .map((x) => x.rowId)
}

const refillBudgets = (state: QuerySessionState, theta: Theta): QuerySessionState => {
  const lanes = Object.fromEntries(
    Object.entries(state.lanes).map(([laneId, lane]) => {
      const add = lane.health === "degraded" ? theta.publish_budget_degraded : theta.publish_budget_base
      return [laneId, { ...lane, publishBudget: Math.min(12, lane.publishBudget + add) }]
    }),
  )
  return { ...state, lanes }
}

const applyQualityBudget = (state: QuerySessionState, theta: Theta): QuerySessionState => {
  const totalRows = Math.max(1, Object.keys(state.rowsById).length)

  const lanes = Object.fromEntries(
    Object.entries(state.lanes).map(([laneId, lane]) => {
      const fallbackRatio = lane.fallbackRows / totalRows
      const decodeDropRatio = lane.decodeDrops / totalRows
      const denyRatio = lane.resolverDenies / totalRows

      let health = lane.health
      if (denyRatio > theta.quality_budget.max_resolver_deny_ratio) health = "open_circuit"
      else if (
        fallbackRatio > theta.quality_budget.max_fallback_ratio ||
        decodeDropRatio > theta.quality_budget.max_decode_drop_ratio
      ) {
        health = "degraded"
      }

      return [laneId, { ...lane, health }]
    }),
  )

  return { ...state, lanes }
}

const preserveSelection = (
  selected: QuerySessionState["selectedRowId"],
  ranked: QuerySessionState["rankedRowIds"],
  rowsById: QuerySessionState["rowsById"],
): QuerySessionState["selectedRowId"] => {
  if (selected && rowsById[selected]) return selected
  return ranked[0] ?? null
}

export const createQuerySession = (params: {
  queryId: string
  queryText: string
  scope: QuerySessionState["scope"]
  deps: QuerySessionDeps
}): Effect.Effect<QuerySessionHandle, never, Scope.Scope> =>
  Effect.gen(function* () {
    const { deps } = params
    const stateAtom = Atom.make<QuerySessionState>(
      makeInitialSessionState({
        queryId: params.queryId,
        queryText: params.queryText,
        scope: params.scope,
      }),
    )

    const unmount = deps.registry.mount(stateAtom)

    const getState = () => deps.registry.get(stateAtom as any) as QuerySessionState
    const setState = (next: QuerySessionState) => deps.registry.set(stateAtom as any, next)

    const emit = (
      event: string,
      extra: Partial<Omit<EventRecord, "event" | "run_id" | "query_id" | "t_ms" | "attrs">> = {},
      attrs: Record<string, unknown> = {},
    ) => {
      deps.onEvent({
        event,
        run_id: deps.runId,
        query_id: params.queryId,
        scenario_id: deps.scenarioId,
        t_ms: nowMs(),
        attrs,
        ...extra,
      })
    }

    const mailbox = yield* Mailbox.make<Envelope, never>({ capacity: 256, strategy: "suspend" })

    const processMessage = (msg: QuerySessionMessage): Effect.Effect<void> =>
      Effect.gen(function* () {
        let state = getState()

        switch (msg._tag) {
          case "SimulateMigrationCrash": {
            yield* deps.cacheGuard.simulateMigrationCrash
            emit("cache.integrity.invalidate", {}, { reason: "simulated-migration-crash" })
            return
          }

          case "CancelQuery": {
            emit("query.cancelled", {}, { reason: msg.reason })
            const lanes = Object.fromEntries(
              Object.entries(state.lanes).map(([laneId, lane]) => {
                emit("lane.state.changed", { lane_id: laneId }, { from: lane.health, to: "closed" })
                return [laneId, { ...lane, health: "closed" as const }]
              }),
            )
            setState({ ...state, status: "cancelling", lanes })
            emit("lane.closed_all")
            return
          }

          case "IngestChunk": {
            emit("lane.chunk.received", { lane_id: msg.laneId }, { seq: msg.seq, count: msg.rows.length })

            const lane = state.lanes[msg.laneId] ?? mkLane(msg.laneId, deps.theta)
            if (msg.seq <= lane.lastSeq) {
              emit("lane.chunk.dropped.stale_seq", { lane_id: msg.laneId }, { incomingSeq: msg.seq, lastSeq: lane.lastSeq })
              return
            }

            const accepted: Array<QueryRow> = []
            let resolverDenies = lane.resolverDenies
            let fallbackRows = lane.fallbackRows
            let decodeDrops = lane.decodeDrops

            for (const row of msg.rows) {
              const allowed = isResolverAllowed(deps.policyBundle, state.scope, row.resolverIdentity)
              if (!allowed) {
                resolverDenies++
                emit("resolver.dispatch.denied", { lane_id: msg.laneId, row_id: row.rowId }, { resolver_identity: row.resolverIdentity })
                continue
              }

              emit("resolver.dispatch.allowed", { lane_id: msg.laneId, row_id: row.rowId }, { resolver_identity: row.resolverIdentity })

              const resolved = resolveRendererToken(
                row.rendererToken,
                deps.rendererRegistry,
                deps.rendererCompatibility,
              )

              if (!resolved.token || resolved.outcome === "drop") {
                decodeDrops++
                emit("renderer.resolve.drop", { lane_id: msg.laneId, row_id: row.rowId }, { renderer_token: row.rendererToken })
                continue
              }

              if (resolved.outcome === "fallback") fallbackRows++
              emit(`renderer.resolve.${resolved.outcome}`, { lane_id: msg.laneId, row_id: row.rowId }, {
                renderer_token: row.rendererToken,
                resolved_token: resolved.token,
              })

              accepted.push({ ...row, rendererToken: resolved.token })
            }

            const reconciled = yield* deps.cacheGuard.reconcileRows(params.queryId, accepted)
            const nextLane: LaneState = {
              ...lane,
              lastSeq: msg.seq,
              pending: [...lane.pending, ...reconciled],
              resolverDenies,
              fallbackRows,
              decodeDrops,
              lastUpdateMs: nowMs(),
            }

            state = {
              ...state,
              lanes: { ...state.lanes, [msg.laneId]: nextLane },
            }

            setState(applyQualityBudget(state, deps.theta))
            return
          }

          case "PlannerTick": {
            state = refillBudgets(state, deps.theta)

            const lanes = { ...state.lanes }
            const rowsById = { ...state.rowsById }
            const laneIds = Object.keys(lanes)
            const maxPublishes = 24
            let publishes = 0
            let cursor = 0

            const hadRowsBefore = Object.keys(rowsById).length > 0

            while (publishes < maxPublishes && laneIds.length > 0) {
              const laneId = laneIds[cursor % laneIds.length]!
              cursor++
              const lane = lanes[laneId]
              if (!lane) continue
              if (lane.publishBudget <= 0 || lane.pending.length === 0) {
                if (cursor > laneIds.length * 3) break
                continue
              }

              const [nextRow, ...rest] = lane.pending
              if (!nextRow) continue

              rowsById[nextRow.rowId] = nextRow
              lanes[laneId] = {
                ...lane,
                pending: rest,
                publishBudget: lane.publishBudget - 1,
                publishedCount: lane.publishedCount + 1,
              }
              publishes++

              if (!hadRowsBefore && Object.keys(rowsById).length === 1) {
                emit("rows.first_visible", { lane_id: laneId, row_id: nextRow.rowId })
                emit("rows.first_actionable", { lane_id: laneId, row_id: nextRow.rowId })
              }
            }

            const ranked = rankRows(rowsById, deps.theta)
            const top = ranked[0] ?? null

            let oscillationCount = state.oscillationCount
            let lastTopRowId = state.lastTopRowId
            let lastTopChangedMs = state.lastTopChangedMs
            let topStableEmitted = state.topStableEmitted

            if (top !== lastTopRowId) {
              if (lastTopRowId !== null) {
                oscillationCount++
                emit("ranking.top.changed", { row_id: top ?? undefined }, { prev_top: lastTopRowId })
              }
              lastTopRowId = top
              lastTopChangedMs = nowMs()
              topStableEmitted = false
            }

            if (!topStableEmitted && top && nowMs() - lastTopChangedMs >= deps.theta.stability_window_ms) {
              emit("rows.top1_stable", { row_id: top }, { stability_window_ms: deps.theta.stability_window_ms })
              topStableEmitted = true
            }

            state = {
              ...state,
              lanes,
              rowsById,
              rankedRowIds: ranked,
              selectedRowId: preserveSelection(state.selectedRowId, ranked, rowsById),
              lastTopRowId,
              lastTopChangedMs,
              topStableEmitted,
              oscillationCount,
            }

            setState(applyQualityBudget(state, deps.theta))
            return
          }
        }
      })

    const loop = Effect.gen(function* () {
      while (true) {
        const [batch, done] = yield* mailbox.takeAll
        if (done) break

        for (const env of batch) {
          if (env._tag === "AskSnapshot") {
            yield* Deferred.succeed(env.reply, getState())
            continue
          }
          yield* processMessage(env.msg)
        }
      }
    }).pipe(Effect.withSpan("NuCmdk.QuerySession.loop"))

    yield* Effect.forkScoped(loop)

    const tell = (msg: QuerySessionMessage) => mailbox.offer({ _tag: "Tell", msg }).pipe(Effect.asVoid)

    const snapshot = Effect.gen(function* () {
      const reply = yield* Deferred.make<never, QuerySessionState>()
      yield* mailbox.offer({ _tag: "AskSnapshot", reply })
      return yield* Deferred.await(reply)
    })

    const shutdown = Effect.gen(function* () {
      yield* mailbox.end
      unmount()
    })

    return { tell, snapshot, shutdown }
  })
