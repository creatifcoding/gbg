# NuCmdk WBS (Work Breakdown Structure)

**Status:** Active
**Date:** 2026-02-15
**Owner:** commands / nu-cmdk

---

## Epic 0 — Documentation & Decision Lock (Completed)

- Research corpus
- Architecture specs
- Decision lock (D01–D18)
- Middleware canonical spec

## Epic 1 — Slice Runtime Foundation (Completed)

- QuerySession actor
- SearchBroker orchestration
- Typed rows/result kinds
- Lane adapters + typed emits enforcement
- QueryAdapterRouter baseline

## Epic 2 — Middleware Parity Slice (Completed)

- Middleware registry by ID
- Global + adapter-local middleware wiring
- Phase telemetry events in router
- Heavy-adapter admission middleware
- Unit/integration tests for middleware behavior

## Epic 3 — Telemetry Closure & Budget Gates (Sprint 1)

1. Persist router phase telemetry into spike artifacts
2. Add phase budget thresholds:
   - query.parse
   - middleware.global
   - middleware.adapter
   - adapter.dispatch
3. Add candidate rejection rule for phase budget breaches
4. Add middleware registration snapshot to spike logs

**Deliverable:** phase-aware spike comparison with pass/fail budget gates

## Epic 4 — Real Adapter Validation (Sprint 2)

1. Replace synthetic lanes with real provider-backed lanes (at least 2)
2. Add one truly heavy lane and validate admission behavior
3. Validate cancellation/interrupt behavior under in-flight work
4. Validate lane isolation on real transport errors

**Deliverable:** adversarial N+1 evidence on non-synthetic paths

## Epic 5 — Integration Path (Sprint 3)

1. Wire broker/router path behind feature flag into minibuffer host path
2. Validate keyboard interaction parity and selection semantics
3. Validate no visual churn + no cycle seam violations

**Deliverable:** interactive parity runbook + acceptance signoff

**Progress note (2026-02-15 PM):**
- command overlay provider context now broker/session-backed (partial completion of step 1),
- minibuffer host cutover + full parity runbook still pending.

## Epic 6 — Persistence Hardening (Sprint 4)

1. Replace simulated cache behavior with SQLite/WAL path
2. Migration and compaction policy wiring
3. Warm/cold benchmark pass

**Deliverable:** persistence-backed TTR deltas + migration proof

---

## Tracking Notes

- Canonical plan source: `src/lib/commands/docs/impl/nu-cmdk-phased-plan.md`
- Middleware behavior source: `src/lib/commands/docs/arch/nu-cmdk-query-middleware-spec.md`
- Decision source: `src/lib/commands/docs/arch/nu-cmdk-decision-lock.md`
- Iteration history: `src/lib/commands/docs/research/nu-cmdk-design-log.md`
