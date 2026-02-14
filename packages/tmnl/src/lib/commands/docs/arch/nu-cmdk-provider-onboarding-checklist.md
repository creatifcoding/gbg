# Provider Onboarding Checklist — `NuCmdk`

**Status:** Active
**Date:** 2026-02-14
**Purpose:** Deterministic checklist for adding or upgrading minibuffer-backed providers into the nu-cmdk broker path.

---

## Design Efficacy Preamble (Session Appendix)

The provider architecture is a 3-layer bridge:

1. **Minibuffer provider layer (source of completions)**
   - Registry: `providerRegistry` in `src/lib/minibuffer/v2/providers.ts`
   - Contract: `complete(query) => Effect<Completion[]>`
   - Responsibility: retrieval only (candidate generation)

2. **Nu-cmdk adapter layer (typed contract boundary)**
   - Adapter contract in `src/lib/commands/nu-cmdk/slices/laneAdapters.ts`
   - Contract: lane binding + normalization + `emits: ResultKind[]`
   - Responsibility: explicit output capability (typed kinds)

3. **Broker + QuerySession layer (orchestration/control plane)**
   - Broker: `src/lib/commands/nu-cmdk/slices/searchBroker.ts`
   - Actor/session: `src/lib/commands/nu-cmdk/slices/querySession.ts`
   - Responsibility: parallel fan-in, `emits` enforcement, lane isolation, ranking/publish lifecycle

### Useful analogy: airport operations

- **Providers** are airlines (each sources passengers from its own network).
- **Adapters** are customs form translators (normalize to shared contract).
- **Broker** is air-traffic control (coordinate arrivals, isolate airline failures).
- **QuerySession actor** is ground operations (publish budget, gate/ordering state, safety checks).

One airline can be delayed; the airport keeps operating.

### Data plane vs control plane

- **Data plane:** provider results flowing into typed `QueryRow`s
- **Control plane:** policy allowlist, renderer compatibility, lane health, publish budgets, telemetry

This separation is non-negotiable for maintainability and observability.

### First-principles architecture claim

A provider abstraction is healthy if it is:

- **Substitutable** (swap source without UI rewrite)
- **Typed** (explicit output capability)
- **Observable** (contract/failure events)
- **Isolated** (lane failures do not blank query)
- **Composable** (parallel fan-in)
- **Policy-safe** (resolver/renderer gates hold)

---

## Provider Onboarding Checklist

## 0) Framing

- [ ] Provider scope declared: command/docs/file/agent/workflow/etc.
- [ ] User-facing intent documented (what questions this provider answers best).
- [ ] Explicit lane ownership documented (`laneId`, source boundaries, trust level).

---

## 1) Minibuffer Provider Contract

- [ ] Provider registered with unique `ProviderId` in `providerRegistry`.
- [ ] `complete(query)` returns `Effect` (no ad hoc async side channels).
- [ ] `complete` failure path is explicit and non-throwing at call site (capturable by adapter/broker telemetry).
- [ ] Completion metadata includes resolver hints when applicable (`resolverIdentity` in metadata).

---

## 2) Adapter Contract (Typed Emits)

- [ ] Adapter implemented as `LaneAdapter`.
- [ ] `emits` explicitly lists allowed `ResultKind[]`.
- [ ] Completion → `QueryRow` mapping normalizes kind/category to canonical `ResultKind`.
- [ ] `rendererToken` follows namespace lock (`<provider>/<kind>/list@v<major>` equivalent contract).
- [ ] `resolverIdentity` is deterministic and policy-compatible.

**Hard gate:** adapter must not rely on implicit kind inference downstream.

---

## 3) Broker Integration

- [ ] Adapter included via `adaptersFromProviderRegistry(...)` or explicit injection.
- [ ] `emitsByProviderId` override set when provider contract is narrower than default.
- [ ] Kind mismatch behavior verified:
  - [ ] row dropped
  - [ ] `lane.adapter.kind_mismatch` event emitted
- [ ] Lane failure behavior verified:
  - [ ] lane marked failed
  - [ ] sibling lanes continue
  - [ ] query remains operational

---

## 4) Policy & Renderer Safety

- [ ] Resolver identity allowed for expected scopes (`global/editor/grid/tldraw/modal`).
- [ ] Renderer token resolves to exact/compatible/fallback behavior as designed.
- [ ] Invalid rows are dropped with telemetry (no query crash).
- [ ] No raw function execution crossing boundaries (data resolver contract only).

---

## 5) State & Lifecycle Discipline

- [ ] Session state remains atom-backed in query actor (no Ref→Atom bridge churn for UI state).
- [ ] Per-query lifecycle scoped and shutdown-safe (`stopQuery`/`stopAll`).
- [ ] Stale sequence chunks are dropped deterministically.
- [ ] Cancellation path closes lanes and emits lifecycle events.

---

## 6) Observability Requirements

- [ ] Emit `lane.adapter.started` for each adapter invocation.
- [ ] Emit `lane.adapter.succeeded` with accepted row count.
- [ ] Emit `lane.adapter.failed` with error payload.
- [ ] Emit `lane.adapter.kind_mismatch` with category + declared emits.
- [ ] Ensure query-level metrics remain extractable by `extractQueryMetric(...)`.

---

## 7) Test Matrix (Minimum)

- [ ] Unit: completion→row normalization (`ResultKind`, resolver, renderer token).
- [ ] Unit: registry adapter selection with emits override.
- [ ] Integration: mixed-kind ingestion accepted when declared.
- [ ] Integration: mismatched kinds dropped and logged.
- [ ] Integration: lane failure isolation under concurrent adapters.
- [ ] Integration: stale seq rejection + cancellation safety.

---

## 8) Spike/Runtime Validation

- [ ] Include provider in spike harness lane mix.
- [ ] Re-run constrained hillclimb batch with provider active.
- [ ] Compare objective score + guardrails against previous anchor run.
- [ ] Confirm guardrails remain zero (policy/lane/selection violations).

---

## 9) Rollout Criteria

Promote provider from harness-only to production surface when:

- [ ] typed emits contract stable in tests
- [ ] broker mismatch/failure telemetry clean and actionable
- [ ] no resolver policy regressions
- [ ] no renderer token unresolved regressions
- [ ] spike objective non-regressive (or regression explained and accepted)
- [ ] direct UX pass confirms no palette blanking on lane failure

---

## 10) Anti-patterns (Reject Immediately)

- [ ] Provider emits unconstrained free-form categories
- [ ] Adapter omits `emits`
- [ ] Broker accepts all kinds blindly
- [ ] Resolver identity inferred only from UI text labels
- [ ] Row execution done via unserialized closures
- [ ] Lane errors collapsing full query session
