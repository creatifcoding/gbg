# NuCmdk Validation Gap Analysis

**Status:** Active
**Date:** 2026-02-15
**Purpose:** Evaluate whether current NuCmdk architecture + implementation are fully validated, identify remaining risk, and define closure order.

---

## Executive summary

Current state is **architecturally strong, slice-validated, but not fully integration-validated**.

- **Green:** core slice contracts, middleware parity mechanics, typed emits enforcement, broker/session isolation, test coverage on slices.
- **Amber:** telemetry closure quality, phase-budget gating, N+1 realism quality, hillclimb interpretation under evolving instrumentation.
- **Red:** production-path integration (minibuffer/overlay cutover), real transport lanes at scale, SQLite/WAL persistence execution, end-user parity closure.

**Conclusion:** not fully validated yet.

### Delta update (2026-02-15 PM)

- Command overlay provider context now runs through broker/session slices (no longer direct `useCommandSearch` in overlay surface).
- QueryRow contract now carries render-critical fields needed for shell item rendering.
- This reduces G1 (Production surface gap) for the command lane from red to amber, but does not close G2/G3/G5.

---

## Validation model used

We evaluate across 4 evidence tiers:

1. **T1 Unit/contract tests** (local deterministic behavior)
2. **T2 Slice integration tests** (multi-component interaction in-process)
3. **T3 Harness/spike evidence** (scenario batches + objective scoring)
4. **T4 Production-path validation** (real UI surface + real transports + persistence)

A capability is "fully validated" only when T1–T4 have passing evidence.

---

## Decision lock coverage matrix (D01–D18)

| Decision | Summary | Current evidence | Tier status | Gap |
|---|---|---|---|---|
| D01 | cmdk baseline, not clone | docs + delta specs | T1 docs | needs T4 UX parity proof |
| D02 | Variant C manifest+stream | architecture specs | T1 docs | limited runtime proof in slices |
| D03 | pluggable schema + versioning | schema/type slices + docs | T1/T2 partial | plugin registry runtime not exhaustive |
| D04 | renderer safety | renderer compatibility slice + tests | T1/T2 | major-version compatibility policy execution |
| D05 | row decode + drop invalid + telemetry | query session + broker behavior | T1/T2 | full malformed corpus on real lanes |
| D06 | typed resolver model | policy bundle + resolver checks | T1/T2 | provider-specific manifest completeness |
| D07 | dedicated broker boundary | `searchBroker` implemented | T1/T2 | production host adoption |
| D08 | atoms + service cache, tiered strategy | actor + cache guard slice | T1/T2 partial | SQLite L2 runtime replacement pending |
| D09 | mixed transport model | simulated lanes + docs | T1/T3 | real RPC/HTTP/FS/vector/db lanes pending |
| D10 | incremental ranking/categorization | query session ranking loop | T1/T2 | production scoring drift analysis |
| D11 | fallback chain | docs + behavior hooks | T1 partial | cross-lane fallback quality policy execution |
| D12 | renderer token namespace | locked + enforced in slices | T1/T2 | broad provider conformance audit |
| D13 | resolver allow-list matrix | denied/allowed tested | T1/T2 | per-provider policy manifests pending |
| D14 | SQLite migration/WAL policy | documented | T1 docs | T2–T4 runtime execution missing |
| D15 | QuerySession actor | implemented + tests | T1/T2 | full lifecycle under UI host load |
| D16 | TTR-first objective | metrics + spike scoring | T3 | phase-budget closure + production telemetry |
| D17 | constrained hillclimb | spike comparisons + winners | T3 | automated rejection gates + replay rigor |
| D18 | LayerRouter middleware parity | queryAdapterRouter + middleware tests | T1/T2/T3 partial | typed request channels + production middleware ops |

---

## Evidence inventory

## Available evidence (strong)

- Slice runtime modules in `src/lib/commands/nu-cmdk/slices/*`
- Tests:
  - `querySession.slice.test.ts`
  - `searchBroker.slice.test.ts`
  - `laneAdapters.slice.test.ts`
  - `queryAdapterRouter.slice.test.ts`
- Spike logs through:
  - `spike-0011` iteration-2 comparison and jsonl artifacts
- Middleware canonical spec and D18 decision lock docs

## Missing evidence (critical)

- End-to-end UI integration evidence (minibuffer/overlay production path)
- Real transport lane adversarial runs with same guardrails
- SQLite/WAL runtime migration and recovery evidence
- Middleware phase budget rejection pipeline in run artifacts
- Replayable registration snapshot for middleware determinism

---

## Gap clusters

## G1 — Production surface gap

**Problem:** slices are not yet the active runtime path for user-facing command interactions.

**Risk:** architecture can pass harness but fail UX lifecycle, keyboard behavior, or host seams.

**Closure work:** feature-flagged host integration + parity runbook.

---

## G2 — Real transport fidelity gap

**Problem:** most current lane behavior is synthetic or test providers.

**Risk:** serialization, retries, timeout semantics, and backpressure behavior differ under true transports.

**Closure work:** at least two real lanes + one heavy lane + cancellation stress.

---

## G3 — Persistence execution gap

**Problem:** SQLite L2 policy exists in docs but runtime path is not primary.

**Risk:** migration/WAL contention failures appear only in real persisted operation.

**Closure work:** enable real L2 path; execute migration crash + contention scenarios.

---

## G4 — Telemetry/gating gap

**Problem:** middleware phase events exist, but budget gates and rejection criteria are not fully enforced in spike decision loops.

**Risk:** performance regressions pass because objective doesn't include phase SLO breaches.

**Closure work:** add phase budgets + candidate rejection + budget breach reporting.

---

## G5 — Type-channel parity gap

**Problem:** D18 parity is behaviorally close, but typed request-channel contracts (`QueryRequest`) are not implemented.

**Risk:** middleware requirement/provision safety remains convention-heavy.

**Closure work:** introduce request-channel typing and compile-time middleware contract checks.

---

## Suggested closure sequence (recommended)

## Wave A — Telemetry closure (fast, low-risk)

1. Persist middleware phase telemetry in spike outputs.
2. Add phase budget thresholds and fail/reject rules.
3. Add middleware registry snapshot to every run artifact.

**Exit:** objective + budget both enforced in hillclimb decisions.

## Wave B — Transport realism

1. Replace two synthetic lanes with real provider-backed lanes.
2. Add one heavy lane with admission policy active.
3. Validate cancellation, starvation, and lane isolation under load.

**Exit:** adversarial N+1 evidence on real lanes.

## Wave C — Host integration

1. Feature-flag NuCmdk runtime in minibuffer host path.
2. Execute parity checklist (open/search/select/cancel, hotkeys, command execution).
3. Validate no cycle seam violations and no UI regressions.

**Exit:** production-surface parity signoff.

## Wave D — Persistence hardening

1. Activate SQLite L2 path and migration lifecycle.
2. Run RTM cache scenarios (`RTM-014..018`) with real persistence.
3. Tune compaction and WAL checkpoints with telemetry.

**Exit:** persistence-backed warm/cold performance and failure recovery proof.

## Wave E — Type-channel hardening

1. Implement `QueryRequest` type channels for middleware contracts.
2. Refactor middleware APIs to enforce requires/provides/handles at compile-time.
3. Add type-level regression tests.

**Exit:** parity with `HttpLayerRouter` request-channel safety model.

---

## Definition of fully validated implementation

NuCmdk can be declared fully validated when all are true:

- [ ] D01–D18 each have T1–T4 evidence (docs, tests, spike, production path)
- [ ] Middleware phase budgets are enforced and visible in decision artifacts
- [ ] Real transport lanes pass adversarial N+1 scenarios with zero guardrail violations
- [ ] Production host path uses NuCmdk broker/router path behind accepted rollout gate
- [ ] SQLite L2 runtime and migration/WAL scenarios pass with deterministic recovery
- [ ] Typed middleware request-channel contracts prevent invalid composition at compile-time

---

## Immediate recommendation

Proceed with **Wave A** next, then Wave B.

Reason:

- Wave A makes all future evidence materially higher quality.
- Wave B then tests real transport behavior with improved instrumentation and rejection criteria.

---

## References

- `../arch/nu-cmdk-decision-lock.md`
- `../arch/nu-cmdk-query-middleware-spec.md`
- `../arch/nu-cmdk-provider-adapter-layer-router-decision.md`
- `../arch/nu-cmdk-redteam-simulation-matrix.md`
- `./nu-cmdk-phased-plan.md`
- `./spike/nu-cmdk-spike-testing-runbook.md`
- `../research/nu-cmdk-design-log.md`
