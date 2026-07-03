# RFC: PCT/LNK/MSH Hardening Portfolio Execution Order

Date: 2026-05-25
Status: sequencing handoff
Parent: `#F1130 Synthesize hardening portfolio execution order`
Task: `#4107 Create dependency and sequencing matrix`

## Intent

Convert the hardening recon and feature-plan RFCs into an execution order that
keeps diagnostics ahead of violence, contracts ahead of tests, and workspace
hygiene ahead of accidental landfill commits.

This is the portfolio-level dependency map. It does not implement the features;
it tells future operators which blade to pick up first.

## Portfolio scope

| Lane | Feature | Status | Planning artifact |
| --- | --- | --- | --- |
| Diagnostics / doctor | `#F1138` | open, 6/7 complete | `packages/msh/docs/observability-diagnostics-feature-plan.md`, `packages/msh/docs/diagnostics-check-taxonomy.md` |
| Long-running soak | `#F1159` | open, 0/7 | `packages/pct/RFC-LONG-RUNNING-MULTI-NODE-SOAK.md` |
| Permission / ACL | `#F1160` | open, 0/8 | `packages/pct/RFC-PERMISSION-ACL-MATRIX.md` |
| Hostile network / failure chaos | `#F1161` | open, 0/9 | `packages/pct/RFC-HOSTILE-NETWORK-FAILURE-CHAOS.md` |
| Workspace hygiene | `#F1166` | open, 0/6 | `packages/pct/RFC-WORKSPACE-LOCKFILE-HYGIENE.md` |
| Docs / closeout system | `#F1167` | open, 0/6 | `packages/pct/RFC-HARDENING-CLOSEOUT-DOCS.md` |
| Projection runtime hardening | `#F1137` | closed | `packages/pct/RFC-PROJECTION-RUNTIME-HARDENING.md` |

`#F1138` is now parented under `#F1121` because it is the diagnostics
implementation follow-on from the portfolio planning lane. Good. It belonged
there. Tiny topology goblin dispatched.

## Dependency principles

1. **Diagnostics before soak/chaos/ACL live denial.**
   Soak and chaos need safe, stable evidence surfaces. Permission tests need
   permission-aware diagnostics so failures are actionable instead of spooky.

2. **Auth/config before ACL proof.**
   You cannot prove NATS permission profiles if PCT/LNK config cannot actually
   thread MSH auth through runtime construction.

3. **Local deterministic faults before Kubernetes chaos.**
   Mock fault DSL and local live NATS bounce must precede cluster pod deletion.
   Kubernetes is a stage, not a debugging strategy.

4. **Soak artifact schemas before workload implementation.**
   If the artifact shape is not stable, every workload node invents its own
   telemetry swamp.

5. **Workspace guardrails are parallel but mandatory before commit closeout.**
   They do not block source implementation, but they block clean commit/merge
   closeout in this dirty workspace.

6. **Docs system can start early, but closeouts happen after evidence.**
   Build index/template first; fill validation ledger as lanes finish.

7. **Projection runtime follow-ups depend on diagnostics and chaos seams.**
   `#F1137` closed the first durable runtime slice. Heartbeat/stale takeover,
   lost-lease drills, and Timescale fault injection should not claim production
   semantics until diagnostics and chaos can prove them.

## Execution waves

### Wave 0 — Portfolio control plane: eyes, broom, and index

Purpose: finish the active diagnostics lane, create docs index/template, and add
workspace staging guardrails before new implementation dirt blooms.

Recommended tasks:

1. `#F1138` / active `#F1145`: diagnostics audit, validation gates, closeout docs.
2. `#F1167` Slice A/B/C/D: hardening docs index, closeout template, validation
   ledger format, boundary matrix links.
3. `#F1166` Slice A/B/D/E: dirty classifier, lane-scoped staging checklist,
   root dependency checklist, staged-file gate.

Blocking relationship:

- `#F1138` closeout should feed the first entries in `#F1167` validation ledger.
- `#F1166` staged-file gate should be available before committing large docs or
  implementation lanes.

Minimum exit criteria:

- Diagnostics lane has run/validation evidence or named remaining gaps.
- Portfolio docs index exists.
- Closeout template exists.
- A command/checklist exists to prove root `package.json`, `bun.lock`, and
  `.gitmodules` are excluded from planning-only commits.

### Wave 1 — Contract foundations

Purpose: define the shared vocabulary before runtime work.

Recommended tasks:

1. `#F1159` Slice A: soak schemas and artifact model.
2. `#F1161` Slice A: chaos/fault vocabulary and scenario schemas.
3. `#F1160` Slice A: permission contract schemas and stranded-auth cleanup
   decision.
4. `#F1167` Slice E/F: staging linkbacks and closeout gate/checklist once
   template/ledger are in place.

Blocking relationship:

- Soak and chaos artifacts should share compatible run IDs, phases, event JSONL,
  and summary shapes.
- ACL permission profiles should feed diagnostics expected-failure language.

Minimum exit criteria:

- Schema-backed artifact/event contracts exist.
- Lane closeout checklist can name required evidence before work starts.

### Wave 2 — Substrate and authentication plumbing

Purpose: make the transport/auth substrate observable and controllable.

Recommended tasks:

1. `#F1160` Slice B: thread MSH auth through LNK/PCT config.
2. `#F1160` Slice C: private inbox support and request/reply isolation.
3. `#F1161` Slice B: MSH connection status telemetry.
4. `#F1161` Slice C: deterministic mock fault DSL.
5. `#F1159` Slice B: local/external NATS substrate adapter.
6. `#F1166` Slice C: runtime-state ignore policy.

Blocking relationship:

- Private inbox support is prerequisite for production-grade request/reply ACLs.
- MSH status telemetry and local/external NATS adapter are prerequisites for live
  reconnect/chaos evidence.
- Mock fault DSL is prerequisite for non-flaky failure tests.

Minimum exit criteria:

- Auth config can reach actual MSH connection options from PCT/LNK/Pact serve.
- Status events are redacted and observable.
- Mock fault tests can script core request, JS publish, KV, and consumer faults.

### Wave 3 — Runtime correctness under controlled failures

Purpose: prove stack semantics at the seams before long-duration workloads.

Recommended tasks:

1. `#F1160` Slice D/E/F/G: ACL renderer, PCT HTTP auth policy,
   EventLogRemote peer policy, permission-aware diagnostics.
2. `#F1161` Slice D/E/F/G: LNK crash-window tests, PCT federation restart drills,
   projection worker failure drills, outbox chaos/retry policy.
3. Projection follow-ups from `#F1137`, but only if they explicitly address:
   heartbeat/stale lease reclaim, fence-token propagation, or Timescale fault
   injection with tests.

Blocking relationship:

- Permission-aware diagnostics should precede final live ACL tests.
- Outbox chaos should reuse LNK idempotency/fencing facts, not reinvent stream
  semantics inside PCT.
- Stale lease takeover must either be implemented and tested or documented as
  not supported. No fake confidence. It clashes with the décor.

Minimum exit criteria:

- Controlled fault tests pass in mock/in-process form.
- ACL policies render and deny correctly in bounded live tests.
- Projection/outbox failure semantics are typed, bounded, and documented.

### Wave 4 — Local and compose-grade soak

Purpose: run deterministic workloads long enough to catch leaks, regressions, and
integrity drift.

Recommended tasks:

1. `#F1159` Slice C: workload nodes over PCT/LNK/MSH seams.
2. `#F1159` Slice D: integrity verifier and pass/fail gates.
3. `#F1159` Slice E: PCT CLI/script and smoke preset.
4. `#F1160` Slice H: live auth/ACL proof tests and ops examples.
5. `#F1161` Slice H: local live NATS bounce adapter.

Blocking relationship:

- Workload nodes depend on soak artifact model and substrate adapter.
- Integrity verifier depends on typed workload contracts.
- Local bounce adapter depends on connection status telemetry and live substrate
  harness control.

Minimum exit criteria:

- Tier 0 local process soak passes with artifact summary.
- Tier 1 local/external NATS soak passes or produces named gap.
- NATS restart/bounce recovery is demonstrated locally before Kubernetes.

### Wave 5 — Kubernetes and hostile environment overlays

Purpose: graduate from deterministic local faults to orchestration-level faults.

Recommended tasks:

1. `#F1159` Slice F: Kubernetes Helm/kind overlay.
2. `#F1159` Slice G: chaos hook seam.
3. `#F1161` Slice I: Kubernetes chaos hook overlay.

Blocking relationship:

- Kubernetes overlay depends on local soak CLI and artifact schema.
- Chaos hook overlay depends on local live NATS bounce and deterministic fault
  vocabulary.
- Network partition should remain future/manual unless a chaos controller
  dependency is explicitly chosen.

Minimum exit criteria:

- Pod-delete / rollout-restart hooks are documented and bounded.
- Kubernetes run artifacts use the same summary schema as local soak.
- No claim of true multi-NATS cluster correctness until cluster/quorum tests exist.

### Wave 6 — Portfolio closeout and release hygiene

Purpose: turn evidence into a stable handoff, not a memory leak in everyone’s
head.

Recommended tasks:

1. Fill `#F1167` validation ledger and closeout docs for completed lanes.
2. Run `#F1166` staged-file gate.
3. Verify `#F1121` gates:
   - scoped status remains read-only except planning artifacts;
   - no root lockfile staged by planning lane.
4. Write or update final portfolio handoff.

Minimum exit criteria:

- Every implemented lane has a closeout with validation commands.
- All follow-up gaps have feature/task IDs.
- Root/shared dirty state is not included unless explicitly owned.

## Critical path

```text
#F1138 diagnostics closeout
  ├─> #F1167 docs index/template/ledger
  ├─> #F1160 permission-aware diagnostics
  ├─> #F1159 soak evidence schema consumption
  └─> #F1161 chaos evidence schema consumption

#F1166 workspace hygiene
  └─> all clean commits / portfolio closeout gates

#F1160 auth threading + private inbox
  ├─> live ACL proof
  ├─> secure NATS resolver/control plane
  └─> permission-aware chaos tests

#F1159 soak schema + substrate adapter
  ├─> workload + integrity verifier
  └─> Kubernetes overlay + chaos hook seam

#F1161 mock faults + status telemetry
  ├─> LNK/PCT/projection failure drills
  └─> local NATS bounce + Kubernetes chaos
```

## Recommended immediate next actions

1. Finish `#F1138` active `#F1145` diagnostics closeout and gates.
2. Start `#F1167` Slice A/B to create portfolio index and closeout template.
3. Start `#F1166` Slice A/E to add dirty classifier and staged-file gate.
4. Then begin Wave 1 contract slices:
   - `#4199` soak schemas;
   - `#4217` chaos schemas;
   - `#4208` permission schemas.

## Explicit non-orderings

- Do **not** start Kubernetes chaos before local deterministic faults and local
  NATS bounce are green.
- Do **not** start live ACL proof before auth config threading and private inbox
  isolation exist.
- Do **not** publish a production ProjectionWorker stale-lease claim before
  heartbeat/reclaim/fence semantics exist and pass chaos drills.
- Do **not** mix planning RFC commits with projection runtime source/test commits.
- Do **not** include root `bun.lock` in any planning closeout without explicit
  ownership.

## Validation posture

This sequencing document is itself planning-only. It should be committed only
with explicit PCT RFC/docs paths. The validation for this lane is Tasker topology
coherence plus staged-file hygiene, not runtime test execution.

Prime, this is the war plan: first we install eyes, then locks, then controlled
stress, then actual chaos. In that order. We are not throwing Kubernetes into a
volcano and calling the smoke a metric.
