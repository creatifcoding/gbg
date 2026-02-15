# NuCmdk Query Middleware Spec

**Status:** Active (canonical middleware reference)
**Date:** 2026-02-14
**Related decisions:** D07, D15, D16, D17, D18
**Primary audience:** platform/commands engineers implementing provider/adapter lanes

---

## 1) Purpose

This document is the single source of truth for NuCmdk middleware behavior.

It defines:

- middleware scopes,
- composition and ordering,
- execution lifecycle,
- failure semantics,
- observability requirements,
- implementation contracts for `QueryAdapterRouter` and broker integration.

This spec is intentionally modeled after Effect `HttpLayerRouter` patterns (global + local middleware composition, deterministic ordering, typed requirements), adapted to search/provider dispatch.

Reference research: `../research/effect-http-layer-router-internal-notes.md`.

---

## 2) Why middleware exists here

NuCmdk dispatches one query across N+1 adapters with heterogeneous cost and shape.

Without middleware discipline we get:

- duplicated parsing,
- inconsistent marshalling/validation,
- hard-to-debug lane behavior,
- hidden policy drift,
- nonlinear latency growth.

Middleware gives us a controlled control-plane for all cross-cutting concerns.

---

## 3) Scope model

NuCmdk middleware has two scopes:

1. **Global query middleware**
   - Applies to every adapter dispatch in the query.
   - Used for parse-once, tracing, budget gating, global validation.

2. **Adapter-local middleware**
   - Applies only to one adapter.
   - Used for adapter-specific marshalling, retries/timeouts, per-provider transforms.

This mirrors `HttpLayerRouter`:

- `addGlobalMiddleware` analog -> query-wide behavior,
- route-local middleware analog -> adapter-local behavior.

---

## 4) Core contracts

## 4.1 Middleware shape

`QueryAdapterMiddleware` is defined as a function wrapper around adapter effect execution:

- input: `Effect<ReadonlyArray<QueryRow>>` + adapter dispatch context
- output: transformed/guarded `Effect<ReadonlyArray<QueryRow>>`
- supports composition via `.combine(...)`

### Semantics

- middleware must be pure w.r.t. external state unless explicitly documented,
- middleware may observe and transform rows,
- middleware must not mutate adapter identity metadata,
- middleware must not bypass typed-emits enforcement (enforced downstream in broker).

## 4.2 Dispatch context

Middleware receives context containing:

- adapter descriptor (`adapterId`, `laneId`, `emits`, `costClass`),
- query dispatch input (`queryId`, `scenarioId`, `query`, `scope`, `dispatchPlan`).

---

## 5) Ordering and composition rules

## 5.1 Deterministic order

Execution order for each adapter dispatch is:

1. global middleware (in registration order)
2. adapter-local middleware (in registration order)
3. adapter search effect

If middleware is composed via `.combine(a, b)`, combined behavior is stable and deterministic.

## 5.2 Combine rule

`m1.combine(m2)` means: apply `m1`, then `m2` to the resulting effect chain.

No implicit reordering is allowed.

## 5.3 Dedupe policy

For v1 runtime:

- middleware is not auto-deduped by ID,
- repeated registration means repeated execution.

Recommended hygiene:

- use unique IDs and explicit registration points,
- keep middleware registration centralized in broker/router construction.

---

## 6) Execution lifecycle phases

Middleware may operate across these logical phases:

1. `query.parse`
2. `query.normalize`
3. `adapter.prepare`
4. `adapter.dispatch`
5. `row.validate`
6. `row.enrich`
7. `post.merge`

### Required v1 behavior

- parse-once artifact (`dispatchPlan`) must be built once per query dispatch and reused by adapters,
- adapters should consume `dispatchPlan` when possible rather than reparsing raw query,
- heavy adapter middleware should rely on `dispatchPlan.terms/normalizedQuery` before expensive operations.

---

## 7) Scheduling + concurrency policy

Middleware does not own scheduling, but must honor scheduling constraints.

`QueryAdapterRouter` policy:

- adapters sorted by `costClass`: `fast -> medium -> heavy`,
- bounded concurrency (`maxConcurrency`, default 4),
- dispatch cancellation must interrupt pending/active adapter effects.

Middleware must not disable/override bounded concurrency behavior.

---

## 8) Failure semantics

## 8.1 Middleware failures

If middleware causes adapter dispatch failure:

- adapter returns `DispatchFailed`,
- broker emits `lane.adapter.failed`,
- sibling lanes continue,
- query remains alive.

## 8.2 Typed emits boundary remains hard gate

After middleware + adapter output, broker enforces `emits` contract:

- mismatched row kind -> dropped,
- event emitted: `lane.adapter.kind_mismatch`.

Middleware cannot opt-out of this safety gate.

---

## 9) Observability requirements

At minimum, middleware-enabled dispatches must preserve these events:

- `lane.adapter.started`
- `lane.adapter.succeeded`
- `lane.adapter.failed`
- `lane.adapter.kind_mismatch`

Recommended additions for middleware-heavy deployments:

- `query.middleware.phase.started`
- `query.middleware.phase.completed`
- `query.middleware.phase.failed`

with attrs:

- `middlewareId`
- `adapterId`
- `phase`
- `duration_ms`

---

## 10) Type discipline and future parity

D18 parity target includes typed request-channel style similar to `HttpLayerRouter` (`Request<Kind, T>` family).

Current runtime enforces behavior structurally. Future hardening should introduce:

- `QueryRequest<"Requires", T>`
- `QueryRequest<"GlobalRequires", T>`
- `QueryRequest<"Error", E>`
- `QueryRequest<"GlobalError", E>`

so middleware requirements/provisions are compile-time compositional, not convention-only.

---

## 11) Reference implementation anchors

Current implementation surfaces:

- Router + middleware core:
  - `src/lib/commands/nu-cmdk/slices/queryAdapterRouter.ts`
- Adapter contract + parse plan:
  - `src/lib/commands/nu-cmdk/slices/laneAdapters.ts`
- Broker orchestration + emits enforcement:
  - `src/lib/commands/nu-cmdk/slices/searchBroker.ts`

Tests:

- `src/lib/commands/nu-cmdk/slices/__tests__/queryAdapterRouter.slice.test.ts`
- `src/lib/commands/nu-cmdk/slices/__tests__/searchBroker.slice.test.ts`

---

## 12) Acceptance criteria

Middleware architecture is considered correct when:

- [ ] global and adapter-local middleware scopes are both supported,
- [ ] middleware order is deterministic and test-covered,
- [ ] parse-once dispatch plan reuse is observable,
- [ ] bounded concurrency remains enforced under middleware stacks,
- [ ] lane isolation preserved on middleware/adapter failures,
- [ ] typed-emits enforcement still drops mismatches,
- [ ] TTR metrics remain non-regressive or regressions are explicitly explained.

---

## 13) Anti-patterns

Reject immediately:

- hidden adapter-local reparsing when parse plan exists,
- middleware mutating lane identity/adapter metadata,
- middleware swallowing adapter failures without telemetry,
- middleware bypassing emits enforcement,
- implicit global middleware registration in scattered call sites,
- unbounded dispatch reintroduced by middleware wrappers.

---

## 14) Next implementation slices (post-spec)

Status update (2026-02-15):

- ✅ middleware registry by ID implemented
- ✅ phase-level telemetry events implemented
- ✅ heavy-adapter admission middleware implemented

Remaining slices:

1. Add telemetry budget thresholds and alert-level mapping per phase.
2. Introduce typed request-channel helpers (`QueryRequest`) for compile-time middleware contracts.
3. Add middleware registration snapshots to spike output for deterministic replay audits.

---

## 15) Relation to other docs

- Decision lock: `nu-cmdk-decision-lock.md` (D18)
- Router parity decision: `nu-cmdk-provider-adapter-layer-router-decision.md`
- Provider onboarding checks: `nu-cmdk-provider-onboarding-checklist.md`
- Broker architecture: `nu-cmdk-search-broker-service-spec.md`
- Design log timeline: `../research/nu-cmdk-design-log.md`
