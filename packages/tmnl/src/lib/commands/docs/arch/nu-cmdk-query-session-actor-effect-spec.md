# NuCmdk QuerySession Actor (Effect Definition)

**Status:** Implemented in slices; runtime hardening in progress  
**Date:** 2026-02-13 (updated 2026-02-15)  
**Scope:** Define a per-query actor model in Effect for sequencing, fairness, cancellation, lane health isolation.

---

## Implementation reality snapshot (2026-02-15)

- Implemented actor: `src/lib/commands/nu-cmdk/slices/querySession.ts`
- Implemented tests: `src/lib/commands/nu-cmdk/slices/__tests__/querySession.slice.test.ts`
- Current runtime path: broker-backed command overlay provider context consumes session snapshots.
- Remaining: lane streaming ergonomics in live UI path, persistence-backed cache integration, host-level e2e parity.

## 1) Definition (what an actor is in this system)

For NuCmdk, an actor is modeled as:

1. **Schema-typed message protocol** (`Schema.TaggedStruct` union)
2. **Single-consumer mailbox loop** (`Mailbox.make` + `takeAll`)
3. **Isolated per-query state** (STX atom as primary state)
4. **Scoped lifecycle** (`Effect.forkScoped` + deterministic teardown)
5. **Observable event stream** (`PubSub` for state snapshots / diagnostics)

This gives command-query isolation by construction.

---

## 2) Why this model is preferred

- Prevents cross-query state contamination.
- Makes out-of-order chunk handling local and deterministic.
- Makes cancellation cheap and reliable.
- Aligns with Atom-as-State policy (React consumes atoms directly).
- Keeps lane failures contained to their own query session.

---

## 3) Message protocol (Schema-first)

```ts
import { Schema } from "effect"

const QueryId = Schema.String.pipe(Schema.brand("QueryId"))
const LaneId = Schema.String.pipe(Schema.brand("LaneId"))
const RowId = Schema.String.pipe(Schema.brand("RowId"))

const QueryRow = Schema.Struct({
  rowId: RowId,
  laneId: LaneId,
  score: Schema.Number,
  category: Schema.String,
  rendererToken: Schema.String,
  resolverSpec: Schema.Unknown, // decoded downstream by resolver registry
})

const IngestChunk = Schema.TaggedStruct("IngestChunk", {
  queryId: QueryId,
  laneId: LaneId,
  seq: Schema.Int,
  rows: Schema.Array(QueryRow),
})

const PlannerTick = Schema.TaggedStruct("PlannerTick", {
  nowMs: Schema.Int,
})

const CancelQuery = Schema.TaggedStruct("CancelQuery", {
  queryId: QueryId,
  reason: Schema.String,
})

const LaneFault = Schema.TaggedStruct("LaneFault", {
  queryId: QueryId,
  laneId: LaneId,
  code: Schema.String,
  detail: Schema.String,
})

export const QuerySessionMessage = Schema.Union(
  IngestChunk,
  PlannerTick,
  CancelQuery,
  LaneFault,
)

export type QuerySessionMessage = typeof QuerySessionMessage.Type
```

---

## 4) Session state (Atom-as-State primary)

```ts
import { Schema } from "effect"

const LaneHealth = Schema.Literal("healthy", "degraded", "open_circuit", "closed")

const LaneState = Schema.Struct({
  laneId: LaneId,
  lastSeq: Schema.Int,
  health: LaneHealth,
  publishBudget: Schema.Int,
  fallbackRows: Schema.Int,
  decodeDrops: Schema.Int,
  resolverDenies: Schema.Int,
  lastUpdateMs: Schema.Int,
})

const QuerySessionState = Schema.Struct({
  queryId: QueryId,
  queryText: Schema.String,
  status: Schema.Literal("active", "cancelling", "complete", "failed"),
  lanes: Schema.Record({ key: Schema.String, value: LaneState }),
  rowsById: Schema.Record({ key: Schema.String, value: QueryRow }),
  rankedRowIds: Schema.Array(RowId),
  selectedRowId: Schema.NullOr(RowId),
  fallbackRatio: Schema.Number,
  degradationReason: Schema.NullOr(Schema.String),
  createdAtMs: Schema.Int,
  updatedAtMs: Schema.Int,
})

export type QuerySessionState = typeof QuerySessionState.Type
```

> State for React surfaces should be atom-backed. Service methods mutate atoms directly.

---

## 5) Actor runtime shape

```ts
import { Effect, Mailbox, PubSub, Deferred, Queue } from "effect"
import { Atom } from "@effect-atom/atom-react"

type SessionEnvelope =
  | { readonly _tag: "Tell"; readonly msg: QuerySessionMessage }
  | { readonly _tag: "AskSnapshot"; readonly reply: Deferred.Deferred<never, QuerySessionState> }

export interface QuerySessionHandle {
  readonly queryId: QuerySessionState["queryId"]
  readonly stateAtom: Atom.Atom<QuerySessionState>
  readonly tell: (msg: QuerySessionMessage) => Effect.Effect<void>
  readonly snapshot: Effect.Effect<QuerySessionState>
  readonly subscribe: Effect.Effect<Queue.Dequeue<QuerySessionState>>
  readonly shutdown: Effect.Effect<void>
}

export interface QuerySessionDeps {
  readonly policyBundle: PolicyBundle
  readonly compatibilityMap: RendererCompatibilityMap
  readonly cacheGuard: CacheGuard
  readonly qualityBudget: QualityBudget
}
```

---

## 6) Core loop with sequencing + fairness + cancellation

```ts
const runLoop = (
  mailbox: Mailbox.Mailbox<SessionEnvelope, never>,
  stateAtom: Atom.Atom<QuerySessionState>,
  updates: PubSub.PubSub<QuerySessionState>,
  deps: QuerySessionDeps,
) =>
  Effect.gen(function* () {
    while (true) {
      const [batch, done] = yield* mailbox.takeAll
      if (done) break

      for (const env of batch) {
        if (env._tag === "AskSnapshot") {
          const snap = yield* Atom.get(stateAtom)
          yield* Deferred.succeed(env.reply, snap)
          continue
        }

        const current = yield* Atom.get(stateAtom)
        const next = yield* reduceMessage(current, env.msg, deps)

        // fairness budget refill each loop tick
        const fair = refillAndClampPublishBudgets(next)

        yield* Atom.set(stateAtom, fair)
        yield* PubSub.publish(updates, fair)

        if (fair.status === "cancelling") {
          // actor cooperatively exits after broadcast
          yield* mailbox.end
          break
        }
      }
    }
  }).pipe(Effect.withSpan("NuCmdk.QuerySession.loop"))
```

### Sequencing rule (non-negotiable)

```ts
const acceptSeq = (lane: LaneState, incomingSeq: number) => incomingSeq > lane.lastSeq
```

Out-of-order chunks are dropped and audited.

---

## 7) Reducer with explicit security and quality gates

```ts
const reduceMessage = (
  state: QuerySessionState,
  msg: QuerySessionMessage,
  deps: QuerySessionDeps,
): Effect.Effect<QuerySessionState> =>
  Effect.gen(function* () {
    switch (msg._tag) {
      case "CancelQuery":
        return { ...state, status: "cancelling", degradationReason: msg.reason }

      case "LaneFault": {
        const lane = state.lanes[msg.laneId]
        if (!lane) return state
        return {
          ...state,
          lanes: {
            ...state.lanes,
            [msg.laneId]: { ...lane, health: "degraded", resolverDenies: lane.resolverDenies + 1 },
          },
        }
      }

      case "IngestChunk": {
        if (msg.queryId !== state.queryId) return state

        const lane = state.lanes[msg.laneId] ?? mkInitialLane(msg.laneId)
        if (!acceptSeq(lane, msg.seq)) return state

        // 1) resolver capability checks (PolicyBundle)
        const authorizedRows = yield* authorizeRows(msg.rows, deps.policyBundle, lane)

        // 2) renderer resolution (CompatibilityMap)
        const resolvedRows = resolveRendererRows(authorizedRows, deps.compatibilityMap)

        // 3) cache integrity assist (CacheGuard read/repair hooks)
        const reconciledRows = yield* deps.cacheGuard.reconcileRows(state.queryId, resolvedRows)

        // 4) rank/category recompute
        const mergedRows = mergeRows(state.rowsById, reconciledRows)
        const rankedRowIds = rankRows(mergedRows)

        const next: QuerySessionState = {
          ...state,
          lanes: {
            ...state.lanes,
            [msg.laneId]: { ...lane, lastSeq: msg.seq, lastUpdateMs: Date.now() },
          },
          rowsById: mergedRows,
          rankedRowIds,
          selectedRowId: preserveSelection(state.selectedRowId, rankedRowIds),
          updatedAtMs: Date.now(),
        }

        // 5) quality budget evaluation -> lane degradation/escalation
        return applyQualityBudget(next, msg.laneId, deps.qualityBudget)
      }

      case "PlannerTick":
        return runPlannerTick(state, msg.nowMs)
    }
  })
```

---

## 8) PolicyBundle integration (strict resolver identity)

```ts
type ResolverIdentity = `${string}:${string}@v${number}`

type PolicyBundle = {
  readonly version: number
  readonly hash: string
  readonly signature: string
  readonly grants: ReadonlyArray<{
    resolverIdentity: ResolverIdentity
    scopes: ReadonlyArray<"global" | "editor" | "grid" | "tldraw" | "modal">
    allowDomains?: ReadonlyArray<string>
    allowRoutes?: ReadonlyArray<string>
    allowRpcMethods?: ReadonlyArray<string>
  }>
}

const authorizeRows = (
  rows: ReadonlyArray<QueryRow>,
  policy: PolicyBundle,
  lane: LaneState,
) =>
  Effect.forEach(rows, (row) =>
    Effect.gen(function* () {
      const identity = extractResolverIdentity(row.resolverSpec)
      const allowed = policy.grants.some((g) => g.resolverIdentity === identity)
      if (!allowed) return null
      return row
    }),
    { concurrency: "unbounded" },
  ).pipe(Effect.map((xs) => xs.filter((x): x is QueryRow => x !== null)))
```

No wildcard prefixes. Identity match is exact.

---

## 9) RendererCompatibilityMap integration

```ts
type RendererCompatibilityMap = {
  readonly entries: ReadonlyArray<{
    tokenFamily: string               // <provider>/<variant>/<view>
    supportedMajors: ReadonlyArray<number>
  }>
}

const resolveRendererRows = (
  rows: ReadonlyArray<QueryRow>,
  compat: RendererCompatibilityMap,
): ReadonlyArray<QueryRow> =>
  rows.map((row) => ({
    ...row,
    rendererToken: resolveToken(row.rendererToken, compat) ?? "global/fallback/list@v1",
  }))
```

Compatibility behavior must be explicit (never implicit downgrade).

---

## 10) CacheGuard integration

```ts
interface CacheGuard {
  readonly reconcileRows: (
    queryId: QuerySessionState["queryId"],
    rows: ReadonlyArray<QueryRow>,
  ) => Effect.Effect<ReadonlyArray<QueryRow>>

  readonly runCheckpointIfNeeded: Effect.Effect<void>
  readonly pruneExpired: Effect.Effect<number>
}
```

Responsibilities:

- single-flight dedupe by cache key,
- manifest/schema epoch validation,
- adaptive WAL/checkpoint policy,
- safe degrade to in-memory mode on persistence failure.

---

## 11) QualityBudget transitions (explicit)

```ts
type QualityBudget = {
  readonly maxFallbackRatio: number
  readonly maxDecodeDropRatio: number
  readonly maxResolverDenyRatio: number
}

const applyQualityBudget = (
  state: QuerySessionState,
  laneId: QuerySessionState["lanes"][string]["laneId"],
  budget: QualityBudget,
): QuerySessionState => {
  const lane = state.lanes[laneId]
  if (!lane) return state

  const total = Math.max(1, Object.keys(state.rowsById).length)
  const fallbackRatio = lane.fallbackRows / total
  const decodeDropRatio = lane.decodeDrops / total
  const denyRatio = lane.resolverDenies / total

  let health = lane.health
  let degradationReason: string | null = state.degradationReason

  if (denyRatio > budget.maxResolverDenyRatio) {
    health = "open_circuit"
    degradationReason = "resolver-deny-ratio-exceeded"
  } else if (
    fallbackRatio > budget.maxFallbackRatio ||
    decodeDropRatio > budget.maxDecodeDropRatio
  ) {
    health = "degraded"
    degradationReason = "quality-budget-exceeded"
  }

  return {
    ...state,
    lanes: { ...state.lanes, [laneId]: { ...lane, health } },
    degradationReason,
  }
}
```

---

## 12) Spawn / shutdown contract

```ts
const spawnQuerySession = (
  initial: QuerySessionState,
  deps: QuerySessionDeps,
): Effect.Effect<QuerySessionHandle, never, Scope.Scope> =>
  Effect.gen(function* () {
    const mailbox = yield* Mailbox.make<SessionEnvelope, never>({
      capacity: 256,
      strategy: "suspend",
    })

    const stateAtom = Atom.make(initial)
    const updates = yield* PubSub.sliding<QuerySessionState>(256)

    yield* Effect.forkScoped(runLoop(mailbox, stateAtom, updates, deps))

    const tell = (msg: QuerySessionMessage) =>
      mailbox.offer({ _tag: "Tell", msg }).pipe(Effect.asVoid)

    const snapshot = Effect.gen(function* () {
      const reply = yield* Deferred.make<never, QuerySessionState>()
      yield* mailbox.offer({ _tag: "AskSnapshot", reply })
      return yield* Deferred.await(reply)
    })

    const subscribe = PubSub.subscribe(updates)
    const shutdown = mailbox.end.pipe(Effect.asVoid)

    return {
      queryId: initial.queryId,
      stateAtom,
      tell,
      snapshot,
      subscribe,
      shutdown,
    }
  })
```

---

## 13) Service boundary (manager of sessions)

```ts
class QuerySessionManager extends Effect.Service<QuerySessionManager>()(
  "NuCmdk/QuerySessionManager",
  {
    scoped: Effect.gen(function* () {
      const sessionsAtom = Atom.make(new Map<string, QuerySessionHandle>())

      return {
        spawn: (initial: QuerySessionState, deps: QuerySessionDeps) =>
          Effect.gen(function* () {
            const handle = yield* spawnQuerySession(initial, deps)
            yield* Atom.update(sessionsAtom, (m) => new Map(m).set(initial.queryId, handle))
            return handle
          }),

        get: (queryId: string) =>
          Effect.map(Atom.get(sessionsAtom), (m) => m.get(queryId)),

        stop: (queryId: string) =>
          Effect.gen(function* () {
            const handle = yield* Effect.map(Atom.get(sessionsAtom), (m) => m.get(queryId))
            if (handle) {
              yield* handle.shutdown
              yield* Atom.update(sessionsAtom, (m) => {
                const next = new Map(m)
                next.delete(queryId)
                return next
              })
            }
          }),
      }
    }),
  },
) {}
```

---

## 14) Minimal invariants checklist

1. A query actor only processes messages for its own `queryId`.
2. Lane sequence is monotonic (`incoming.seq > lastSeq`).
3. Resolver execution requires successful policy gate.
4. Renderer resolution uses explicit compatibility map only.
5. Quality budget breaches degrade/open-circuit lanes visibly.
6. Actor loop lifetime is scope-bound and cancellation-safe.

---

## 15) Suggested lock extensions

- **D15** QuerySession actor per query required. *(now locked)*
- **D18** PolicyBundle required before resolver dispatch.
- **D19** RendererCompatibilityMap required for non-exact renderer token handling.
- **D20** CacheGuard required for all persisted cache interactions.
- **D21** QualityBudget required for lane health transitions.

---

## Traceability pointer

- Decision lock: `./nu-cmdk-decision-lock.md`
- Adversarial matrix: `./nu-cmdk-redteam-simulation-matrix.md`
- Trace index: `./ascii/traceability-index.md`
