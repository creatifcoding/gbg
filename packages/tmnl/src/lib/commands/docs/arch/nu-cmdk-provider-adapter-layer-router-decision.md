# NuCmdk Decision — Provider/Adapter `LayerRouter` + Middleware Parity

**Status:** Locked for implementation
**Date:** 2026-02-14
**Decision ID:** D18
**Related:** D07 (broker), D15 (QuerySession actor), D16 (TTR-first), D17 (hillclimb)

---

## Decision statement

NuCmdk will adopt a **LayerRouter-style architecture** for providers/adapters with explicit middleware parity to Effect's `HttpLayerRouter` model.

This means:

1. Provider/adapter dispatch is modeled as a **router service** (not ad-hoc loops).
2. Middleware has two scopes:
   - **global middleware** (query-wide, cross-cutting)
   - **adapter middleware** (adapter-local, composable)
3. Adapters remain capability-declared via typed `emits: ResultKind[]`.
4. Query parse/marshalling is centralized and reusable (parse-once, fan-out many).
5. Dispatch scheduling becomes budget-aware and bounded for N+1 adapter scenarios.

---

## Rationale

### Problem we are solving

With N+1 adapters, naive fan-out duplicates parse/marshalling work and can spike latency/cost. Some adapters are expensive (semantic, RPC, schema-heavy), while others are cheap (local keyword/file paths).

Current architecture already has typed emits and lane isolation, but lacks a formal middleware router for:

- deterministic pre/post processing,
- capability-aware scheduling,
- reusable parse artifacts,
- middleware dependency composition.

### Why `HttpLayerRouter` parity

Effect's implementation demonstrates production-grade solutions to exactly these concerns:

- service-based route registration/composition,
- global + local middleware split,
- deterministic middleware stack assembly,
- typed requirement channels,
- explicit runtime entrypoint separation.

Source research: `research/effect-http-layer-router-internal-notes.md`.

---

## Parity mapping (HttpLayerRouter -> NuCmdk)

| HttpLayerRouter concept | NuCmdk equivalent |
|---|---|
| `HttpRouter` service | `QueryAdapterRouter` service |
| `add` / `addAll` route registration | `addAdapter` / `addAdapters` |
| `prefixed` route grouping | `scoped(scopeId)` / `kindScoped(resultKind)` |
| `addGlobalMiddleware` | `addGlobalMiddleware` |
| `middleware(...).layer` | `queryMiddleware(...).layer` |
| `middleware.combine(...)` | `queryMiddleware.combine(...)` |
| `asHttpEffect` execution entry | `asQueryEffect` dispatch entry |
| `Request<Kind, T>` requirement channels | `QueryRequest<Kind, T>` requirement channels |

---

## Proposed API shape (draft)

```ts
export interface QueryAdapterRouter {
  readonly addAdapter: <E, R>(adapter: AdapterRoute<E, R>) => Effect.Effect<void, never, QueryRequest.From<"Requires", R> | QueryRequest.From<"Error", E>>
  readonly addAdapters: <const Routes extends ReadonlyArray<AdapterRoute<any, any>>>(routes: Routes) => Effect.Effect<void, never, QueryRequest.From<"Requires", AdapterRoute.Context<Routes[number]>> | QueryRequest.From<"Error", AdapterRoute.Error<Routes[number]>>>
  readonly addGlobalMiddleware: <E, R>(mw: QueryMiddleware.Fn<E, R>) => Effect.Effect<void, never, QueryRequest.From<"GlobalRequires", R> | QueryRequest.From<"GlobalError", E>>
  readonly asQueryEffect: () => Effect.Effect<QueryDispatchResult, unknown, QueryInput | Scope.Scope>
}

export interface AdapterRoute<E = never, R = never> {
  readonly adapterId: string
  readonly emits: ReadonlyArray<ResultKind>
  readonly costClass: "fast" | "medium" | "heavy"
  readonly handler: Effect.Effect<AdapterChunk, E, R>
}

export interface QueryMiddleware<Config> {
  readonly layer: Layer.Layer<...>
  readonly combine: <Config2>(other: QueryMiddleware<Config2>) => QueryMiddleware<Combined<Config, Config2>>
}
```

> Note: exact type channels will mirror `Request.From/Only/Without` style used in `HttpLayerRouter`.

---

## Middleware model

## A) Global middleware (query-wide)

Examples:
- query parse + normalize (once)
- tracing/span correlation
- global cache lookup / write-through policy
- budget/admission gating

## B) Adapter middleware (local)

Examples:
- adapter-specific marshalling
- adapter schema decode/transform
- per-adapter timeout/retry/circuit behavior
- provider payload normalization

## C) Composition

- Middleware can be composed via `.combine(...)`.
- Router computes deterministic middleware order once per query context.
- Middleware stack is cached for context identity to avoid recompute churn.

---

## N+1 efficiency policy

1. **Parse once, reuse everywhere**
   - Global parse middleware produces `QueryAst` and `QueryPlan` in context.

2. **Bounded concurrency**
   - Dispatch queue is bounded and cost-aware.
   - fast adapters run first for TTFA.

3. **Admission control**
   - Heavy adapters may be deferred until first actionable rows or if confidence is low.

4. **Deterministic phase telemetry**
   - Track parse/marshal/dispatch/decode/publish timings separately.

5. **Typed emits enforcement remains hard gate**
   - broker/router drops mismatched result kinds and emits mismatch telemetry.

---

## Scheduling model (initial)

- `maxConcurrentAdapters`: default 4
- Priority order:
  1. fast + high historical precision
  2. medium
  3. heavy
- Preemption/cancel:
  - on query cancel, pending and active adapter work interrupted

---

## Integration with existing broker/session

- `NuCmdkSearchBroker` remains orchestration boundary (D07).
- `QuerySession` remains actor state boundary (D15).
- New `QueryAdapterRouter` is introduced as broker-internal dispatch engine.
- Existing lane event model (`started/succeeded/failed/kind_mismatch`) remains; phase-level events are added.

---

## Risks and mitigations

1. **Type complexity**
   - Mitigate with phased type aliases and initial narrow channel kinds.

2. **Middleware misuse / ordering drift**
   - Mitigate with deterministic merge rules + snapshot tests.

3. **Performance regressions from extra layers**
   - Mitigate with cache + precompiled middleware stacks + bounded scheduling.

---

## Acceptance criteria

- [ ] Query parse happens once per query dispatch (verified by telemetry counts).
- [ ] Adapter-local marshalling no longer duplicates global parse work.
- [ ] Bounded concurrency is enforced in broker dispatch.
- [ ] Middleware ordering is deterministic and test-covered.
- [ ] Guardrails remain zero under adversarial N+1 runs.
- [ ] TTR objective improves or remains non-regressive with explainable trade-offs.

---

## Implementation note

This decision intentionally mirrors architecture patterns from Effect's `HttpLayerRouter` and `internal/httpRouter`, adapted for provider/adapter dispatch semantics rather than HTTP path routing.
