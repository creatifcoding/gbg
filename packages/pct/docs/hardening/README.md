# PCT/LNK/MSH Hardening Portfolio

Status: active portfolio index  
Owner: PCT hardening lane (`#F1121`)  
Last updated: 2026-05-26

## Purpose

This index is the single doorway into the PCT/LNK/MSH production hardening
portfolio. It maps the planning artifacts, implementation features, closeout
expectations, and operator commands for each lane.

The layer boundaries stay crisp. The detailed boundary matrix, anti-bloat
rubric, and staging runbook live here:

- [boundary-contracts.md](./boundary-contracts.md)
- [staging-hygiene.md](./staging-hygiene.md)

Quick version:

| Layer | Owns | Must not absorb |
| --- | --- | --- |
| MSH | NATS connection/auth, JetStream/KV, subject rules, generic micro hosts, substrate diagnostics | PCT registry policy, LNK offset/framing semantics |
| LNK | Durable stream semantics, producer fencing, offsets, framing, CAS append, close/retention behavior | PCT schema registry/federation policy, MSH client internals |
| PCT | Contracts, schema registry, federation, control plane, frame projection specs, hardening governance | Raw NATS substrate lifecycle, LNK durable stream internals |
| STX | Local/client reactive state substrate | Server-side stream authority |
| SQL/Timescale | Source fact storage, ledgers, read models, analytics | Hidden semantic assembly outside PCT projection contracts |

Prime, this page is the map. The RFC pile is now a library, not a rummage bin.

## Operator quick start

Recommended execution order:

1. Finish diagnostics closeout (`#F1138` / `#F1145`).
2. Build docs and workspace rails (`#F1167`, `#F1166`).
3. Start contract foundations:
   - `#4199` soak schemas,
   - `#4217` chaos schemas,
   - `#4208` permission schemas.
4. Only then move into live auth, restart, soak, and Kubernetes drills.

Primary sequencing reference:

- [RFC-HARDENING-PORTFOLIO-EXECUTION-ORDER.md](../../RFC-HARDENING-PORTFOLIO-EXECUTION-ORDER.md)

Latest planning handoff:

- [PCT-LNK-MSH-HARDENING-PORTFOLIO-HANDOFF.md](../../PCT-LNK-MSH-HARDENING-PORTFOLIO-HANDOFF.md)

## Portfolio map

| Lane | Planning artifact | Implementation feature | Current status | Closeout expectation | Operator command/status |
| --- | --- | --- | --- | --- | --- |
| Recon | [PCT-LNK-MSH-HARDENING-RECON.md](../../PCT-LNK-MSH-HARDENING-RECON.md) | `#F1122` | closed | Baseline inventory only | n/a |
| System capability audit | [RFC-SYSTEM-CAPABILITY-AUDIT.md](../../RFC-SYSTEM-CAPABILITY-AUDIT.md) | n/a | planning reference | Anti-bloat rubric and boundary thesis | n/a |
| Diagnostics / doctor | [observability-diagnostics-feature-plan.md](../../../msh/docs/observability-diagnostics-feature-plan.md), [diagnostics-check-taxonomy.md](../../../msh/docs/diagnostics-check-taxonomy.md), [diagnostics-closeout.md](./diagnostics-closeout.md) | `#F1138` | closed first slice | Diagnostics taxonomy version, redaction evidence, safe check IDs, validation gates | `bun run diagnostics:rollup` from `packages/pct` |
| Projection runtime hardening | [RFC-PROJECTION-RUNTIME-HARDENING.md](../../RFC-PROJECTION-RUNTIME-HARDENING.md) | `#F1137` | closed first slice | Lease/fence/checkpoint/outbox invariants; stale-lease status explicitly claimed or deferred | targeted projection vitest suite |
| Long-running soak | [RFC-LONG-RUNNING-MULTI-NODE-SOAK.md](../../RFC-LONG-RUNNING-MULTI-NODE-SOAK.md) | `#F1159` | open, not started | Artifact schema, workload description, integrity verifier, tier support matrix | TBD soak CLI/script |
| Permission / ACL | [RFC-PERMISSION-ACL-MATRIX.md](../../RFC-PERMISSION-ACL-MATRIX.md) | `#F1160` | open, not started | Persona matrix, rendered NATS configs, negative permission tests, private inbox decision | TBD ACL renderer / live proof |
| Hostile network / failure chaos | [RFC-HOSTILE-NETWORK-FAILURE-CHAOS.md](../../RFC-HOSTILE-NETWORK-FAILURE-CHAOS.md) | `#F1161` | open, not started | Fault schemas, deterministic mock faults, NATS bounce evidence, recovery/non-recovery proof | TBD chaos runner/hooks |
| Workspace hygiene | [RFC-WORKSPACE-LOCKFILE-HYGIENE.md](../../RFC-WORKSPACE-LOCKFILE-HYGIENE.md), [staging-hygiene.md](./staging-hygiene.md), [workspace-dirty-report.md](./workspace-dirty-report.md), [staged-file-gate.md](./staged-file-gate.md) | `#F1166` | open, gates landed | Live dirty classifier, staged-file gate, root lockfile ownership proof | `bun run workspace:dirty-report`; `bun run workspace:staged-gate` |
| Docs / closeout system | [RFC-HARDENING-CLOSEOUT-DOCS.md](../../RFC-HARDENING-CLOSEOUT-DOCS.md), [docs-closeout-gate.md](./docs-closeout-gate.md) | `#F1167` | closed first docs spine | Portfolio index, closeout template, validation ledger, boundary matrix, staging runbook, docs closeout gate | `bun run hardening:docs:check` from `packages/pct` |
| Sequencing | [RFC-HARDENING-PORTFOLIO-EXECUTION-ORDER.md](../../RFC-HARDENING-PORTFOLIO-EXECUTION-ORDER.md) | `#F1130` | closed | Execution waves and critical path | n/a |

## Execution waves

### Wave 0 — Eyes, broom, index

Goal: finish diagnostics and install portfolio rails before new implementation
dirt blooms.

- `#F1138` / `#F1145`: diagnostics audit, validation gates, closeout docs.
- `#F1167`: docs index, closeout template, validation ledger, boundary matrix,
  staging hygiene runbook.
- `#F1166`: dirty classifier, staging checklist, root dependency checklist,
  staged-file gate.

Exit criteria:

- diagnostics closeout has evidence or named gaps;
- this portfolio index exists;
- closeout template exists;
- planning commits can prove root `package.json`, `bun.lock`, and `.gitmodules`
  are excluded unless explicitly owned.

### Wave 1 — Contract foundations

Goal: define shared vocabulary before runtime work.

- `#4199`: soak schemas and artifact model.
- `#4217`: chaos/fault vocabulary and scenario schemas.
- `#4208`: permission contract schemas and stranded-auth cleanup decision.

Exit criteria:

- schema-backed artifact/event contracts exist;
- lane closeout checklist can name required evidence before implementation.

### Wave 2 — Substrate and auth plumbing

Goal: make transport/auth observable and controllable.

- `#4209`: thread MSH auth through LNK/PCT config.
- `#4210`: private inbox support and request/reply isolation.
- `#4218`: MSH connection status telemetry.
- `#4219`: deterministic mock fault DSL.
- `#4200`: local/external NATS substrate adapter.

Exit criteria:

- auth config reaches actual MSH connection options;
- status events are redacted and observable;
- mock fault tests script core request, JetStream publish, KV, and consumer faults.

### Wave 3 — Controlled runtime failure correctness

Goal: prove stack semantics before long-duration workloads.

- `#4211`–`#4214`: ACL renderer, HTTP/EventLog policy, permission-aware diagnostics.
- `#4220`–`#4223`: LNK crash windows, federation restart drills, projection worker
  failure drills, outbox chaos/retry policy.

Exit criteria:

- controlled fault tests pass in mock/in-process form;
- ACL policies render and deny correctly in bounded live tests;
- projection/outbox failure semantics are typed, bounded, and documented.

### Wave 4 — Local and compose-grade soak

Goal: run deterministic workloads long enough to catch leaks and integrity drift.

- `#4201`: workload nodes over PCT/LNK/MSH seams.
- `#4202`: integrity verifier and pass/fail gates.
- `#4203`: PCT CLI/script and smoke preset.
- `#4215`: live auth/ACL proof tests and ops examples.
- `#4224`: local live NATS bounce adapter.

Exit criteria:

- Tier 0 local soak passes with summary artifact;
- Tier 1 local/external NATS soak passes or records a named gap;
- NATS restart/bounce recovery is demonstrated locally before Kubernetes.

### Wave 5 — Kubernetes and hostile overlays

Goal: graduate from deterministic local faults to orchestration-level faults.

- `#4204`: Kubernetes Helm/kind overlay.
- `#4205`: chaos hook seam.
- `#4225`: Kubernetes chaos hook overlay.

Exit criteria:

- pod-delete / rollout-restart hooks are documented and bounded;
- Kubernetes run artifacts use the same summary schema as local soak;
- no claim of true multi-NATS cluster correctness until cluster/quorum tests exist.

### Wave 6 — Portfolio closeout

Goal: turn evidence into stable handoff.

- fill validation ledger;
- run staged-file gate;
- verify `#F1121` gates;
- write final portfolio handoff/update.

Exit criteria:

- every implemented lane has closeout with validation commands;
- follow-up gaps have task/feature IDs;
- root/shared dirty state is excluded unless explicitly owned.

## Feature detail index

### `#F1138` — Production Observability and Diagnostics Surface

Status: closed first slice.

Key docs:

- [observability-diagnostics-feature-plan.md](../../../msh/docs/observability-diagnostics-feature-plan.md)
- [diagnostics-check-taxonomy.md](../../../msh/docs/diagnostics-check-taxonomy.md)
- [diagnostics-audit.md](./diagnostics-audit.md)
- [diagnostics-closeout.md](./diagnostics-closeout.md)

Closeout proved:

- safe diagnostic schema shape;
- redaction tests/snapshots;
- check ID taxonomy stability;
- mock/live validation boundaries;
- no MSH dependency on PCT/LNK semantics.

Named follow-ups:

- permission-specific classification: `#F1160/#4214`;
- NATS status telemetry: `#F1161/#4218`.

### `#F1159` — Long-Running Multi-Node Soak Harness

Status: open, 0/7.

Tasks:

- `#4199` Define soak schemas and artifact model.
- `#4200` Implement local/external NATS substrate adapter.
- `#4201` Implement workload nodes over PCT/LNK/MSH seams.
- `#4202` Implement integrity verifier and pass/fail gates.
- `#4203` Add PCT CLI/script and smoke preset.
- `#4204` Add Kubernetes Helm/kind overlay.
- `#4205` Add chaos hook seam for later hostile-network lane.

Closeout must prove:

- deterministic vitals workload semantics;
- JSONL/summary artifact shape;
- local/external NATS tier behavior;
- verifier catches loss/duplication/drift;
- Kubernetes remains Tier 2, not first implementation.

### `#F1160` — Permission and ACL Hardening

Status: open, 0/8.

Tasks:

- `#4208` Permission contract schemas and stranded-auth cleanup decision.
- `#4209` Thread MSH auth through LNK/PCT config.
- `#4210` Private inbox support and request/reply isolation.
- `#4211` NATS ACL profile renderer.
- `#4212` PCT HTTP auth policy.
- `#4213` EventLogRemote peer policy binding.
- `#4214` Permission-aware diagnostics and doctor probes.
- `#4215` Live auth/ACL proof tests and ops examples.

Closeout must prove:

- persona-to-operation matrix;
- rendered NATS permission examples;
- negative permission tests;
- HTTP route policy;
- EventLogRemote peer trust policy;
- private inbox isolation.

### `#F1161` — Hostile Network and Failure Chaos Harness

Status: open, 0/9.

Tasks:

- `#4217` Fault vocabulary and scenario schemas.
- `#4218` MSH connection status telemetry.
- `#4219` Deterministic mock fault DSL.
- `#4220` LNK bridge crash-window tests.
- `#4221` PCT federation and EventLogRemote restart drills.
- `#4222` Projection worker failure drills.
- `#4223` Outbox chaos and retry policy.
- `#4224` Local live NATS bounce adapter.
- `#4225` Kubernetes chaos hook overlay.

Closeout must prove:

- fault schema version;
- deterministic mock coverage before live chaos;
- NATS status event evidence;
- local bounce/restart recovery;
- typed error mapping;
- Kubernetes limitations explicitly stated.

### `#F1166` — Workspace Hygiene and Lockfile Guardrails

Status: open, 0/6.

Tasks:

- `#4237` Dirty-baseline classifier/report. ✅
- `#4238` PCT lane-scoped staging checklist.
- `#4239` Runtime-state ignore policy.
- `#4240` Root dependency ownership checklist.
- `#4241` Closeout staged-file gate. ✅
- `#4242` Planning-vs-implementation commit docs. ✅

Closeout must prove:

- live dirty workspace classifier/report command;
- no broad staging;
- root files require ownership;
- runtime state is ignored or documented;
- planning docs and implementation commits stay separate.

See [staging-hygiene.md](./staging-hygiene.md#planning-vs-implementation-split) for the commit split policy.

### `#F1167` — Hardening Documentation and Closeout System

Status: closed first docs spine.

Tasks:

- `#4244` Create hardening docs index and portfolio map. ✅
- `#4245` Add closeout template and lane-specific checklists. ✅
- `#4246` Add validation ledger format. ✅
- `#4247` Add boundary contract matrix and anti-bloat links. ✅
- `#4248` Add staging hygiene and runbook linkbacks. ✅
- `#4249` Add docs closeout gate/checklist. ✅

Closeout must prove:

- every lane has an index row;
- every lane has a closeout target;
- validation ledger has format and initial entries;
- staging hygiene/runbook docs link back to workspace lockfile policy and forbid broad staging;
- docs checks exist or are explicitly manual.

## Validation command ledger

Use the ledger format for lane closeout evidence:

- [validation-ledger.md](./validation-ledger.md)

Existing closeout precedent:

- [NATS-INTEGRATION-CLOSEOUT.md](../../NATS-INTEGRATION-CLOSEOUT.md)

Diagnostics command currently exposed by `packages/pct/package.json`:

```bash
cd packages/pct
bun run diagnostics:rollup
```

Hardening docs closeout gate:

```bash
cd packages/pct
bun run hardening:docs:check
```

Workspace dirty classifier and staged-file gate:

```bash
cd packages/pct
bun run workspace:dirty-report
bun run workspace:staged-gate
```

PCT projection/runtime command families used in recent validation:

```bash
cd packages/pct
bunx vitest run \
  test/projection-outbox-publisher.test.ts \
  test/projection-lnk-adapters.test.ts \
  test/projection-durable-runtime-memory.test.ts \
  test/projection-durable-runtime-contracts.test.ts \
  test/projection-runtime.test.ts \
  test/projection-assembly.test.ts \
  test/projection-cagg.test.ts \
  test/projection-migrations.test.ts \
  test/projection-scheduler.test.ts \
  test/projection-worker-nats-host.test.ts \
  test/projection-worker-contracts.test.ts \
  test/projection-registry.test.ts \
  test/frame-projections.test.ts \
  --reporter verbose

bunx tsc --noEmit --pretty false
```

Live tests must remain opt-in and bounded. Use documented env vars such as
`LNK_LIVE_NATS=1`, `MSH_LIVE_NATS=1`, or explicit external NATS URL only when the
lane requires it.

## Staging and workspace hygiene

Full runbooks:

- [staging-hygiene.md](./staging-hygiene.md)
- [workspace-dirty-report.md](./workspace-dirty-report.md)
- [staged-file-gate.md](./staged-file-gate.md)

Policy source:

- [RFC-WORKSPACE-LOCKFILE-HYGIENE.md](../../RFC-WORKSPACE-LOCKFILE-HYGIENE.md)

This portfolio exists in a dirty worktree. Planning docs must not drag unrelated
state behind them.

Before staging any hardening docs:

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg

git status --short -- package.json bun.lock .gitmodules

git status --short -- \
  packages/pct/RFC-LONG-RUNNING-MULTI-NODE-SOAK.md \
  packages/pct/RFC-PERMISSION-ACL-MATRIX.md \
  packages/pct/RFC-HOSTILE-NETWORK-FAILURE-CHAOS.md \
  packages/pct/RFC-WORKSPACE-LOCKFILE-HYGIENE.md \
  packages/pct/RFC-HARDENING-CLOSEOUT-DOCS.md \
  packages/pct/RFC-HARDENING-PORTFOLIO-EXECUTION-ORDER.md \
  packages/pct/PCT-LNK-MSH-HARDENING-PORTFOLIO-HANDOFF.md \
  packages/pct/docs/hardening/README.md \
  packages/pct/docs/hardening/closeout-template.md \
  packages/pct/docs/hardening/validation-ledger.md \
  packages/pct/docs/hardening/boundary-contracts.md \
  packages/pct/docs/hardening/staging-hygiene.md
```

Stage explicit paths only. Do not use `git add -A`, `git add .`, or wildcard
staging. The root `package.json`, `bun.lock`, and `.gitmodules` require explicit
ownership and rationale.

Example docs-only staging pathspec:

```bash
git add \
  packages/pct/docs/hardening/README.md \
  packages/pct/docs/hardening/closeout-template.md \
  packages/pct/docs/hardening/validation-ledger.md \
  packages/pct/docs/hardening/boundary-contracts.md \
  packages/pct/docs/hardening/staging-hygiene.md

git diff --cached --name-status
```

## Related docs by package

### PCT

- [NATS-INTEGRATION-CLOSEOUT.md](../../NATS-INTEGRATION-CLOSEOUT.md)
- [PCT-LNK-MSH-HARDENING-RECON.md](../../PCT-LNK-MSH-HARDENING-RECON.md)
- [RFC-NATS-CONTROL-PLANE.md](../../RFC-NATS-CONTROL-PLANE.md)
- [RFC-FRAME-PROJECTIONS.md](../../RFC-FRAME-PROJECTIONS.md)
- [RFC-PROJECTION-SCHEDULER-SEDA.md](../../RFC-PROJECTION-SCHEDULER-SEDA.md)

### MSH

- [MSH README](../../../msh/README.md)
- [system-atlas.md](../../../msh/docs/system-atlas.md)
- [pct-lnk-composition-rfc.md](../../../msh/docs/pct-lnk-composition-rfc.md)
- [observability-diagnostics-feature-plan.md](../../../msh/docs/observability-diagnostics-feature-plan.md)
- [diagnostics-check-taxonomy.md](../../../msh/docs/diagnostics-check-taxonomy.md)

### LNK

- [LNK README](../../../lnk/README.md)
- [ARCHITECTURE.md](../../../lnk/ARCHITECTURE.md)
- [CONFORMANCE.md](../../../lnk/CONFORMANCE.md)
- [NATS-BRIDGE.md](../../../lnk/NATS-BRIDGE.md)
- [PCT.md](../../../lnk/PCT.md)

## Closeout template and docs gate

Use the reusable closeout template before marking any implementation lane closed:

- [closeout-template.md](./closeout-template.md)

Then run the docs closeout gate:

- [docs-closeout-gate.md](./docs-closeout-gate.md)

```bash
cd packages/pct
bun run hardening:docs:check
```

The template includes the universal closeout contract plus lane-specific
checklists for diagnostics, soak, ACL, chaos, projection runtime, workspace
hygiene, and this documentation lane.

## Next docs slices

No remaining `#F1167` docs slices after `#4249`. Continue to the task frontier:
workspace guardrails `#F1166`, especially `#4237` dirty-baseline classifier and
`#4241` staged-file gate.

Documentation is only valuable if it makes the next move cheaper; this page
should now do that.
