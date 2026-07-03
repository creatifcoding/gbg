# PCT/LNK/MSH Hardening Portfolio Handoff

Date: 2026-05-25
Agent: YoungEagle
Branch/worktree: `tmnl` on `master`
Task: `#4108 Create portfolio planning handoff`
Parent: `#F1130 Synthesize hardening portfolio execution order`

## Current state

`pi_messenger({ action: "status" })` reports:

- agent: `YoungEagle`
- location: `tmnl (master)`
- peers: `0`

`pi_messenger({ action: "work" })` reports no crew plan exists. Work therefore
continued through Tasker, with `pi_messenger` used for file reservations.

`#F1121 Plan the PCT/LNK/MSH hardening portfolio` is still open because its two
gates are pending, but all planning subfeatures except `#F1130` are now closed.
The implementation follow-on features are open and parented under `#F1121`.

## Completed in this planning pass

### Closed planning lanes

- `#F1123 Feature-plan long-running multi-node soak`
  - Artifact: `packages/pct/RFC-LONG-RUNNING-MULTI-NODE-SOAK.md`
  - Follow-on: `#F1159 PCT/LNK/MSH Long-Running Multi-Node Soak Harness`
- `#F1124 Feature-plan permission and ACL matrix`
  - Artifact: `packages/pct/RFC-PERMISSION-ACL-MATRIX.md`
  - Follow-on: `#F1160 PCT/LNK/MSH Permission and ACL Hardening`
- `#F1125 Feature-plan hostile network and failure chaos`
  - Artifact: `packages/pct/RFC-HOSTILE-NETWORK-FAILURE-CHAOS.md`
  - Follow-on: `#F1161 PCT/LNK/MSH Hostile Network and Failure Chaos Harness`
- `#F1128 Feature-plan workspace and root lockfile hygiene`
  - Artifact: `packages/pct/RFC-WORKSPACE-LOCKFILE-HYGIENE.md`
  - Follow-on: `#F1166 Workspace Hygiene and Lockfile Guardrails`
- `#F1129 Feature-plan closeout and documentation system after recon`
  - Artifact: `packages/pct/RFC-HARDENING-CLOSEOUT-DOCS.md`
  - Follow-on: `#F1167 PCT/LNK/MSH Hardening Documentation and Closeout System`

### Sequencing lane

- `#4107 Create dependency and sequencing matrix` is done.
  - Artifact: `packages/pct/RFC-HARDENING-PORTFOLIO-EXECUTION-ORDER.md`
- `#4108 Create portfolio planning handoff` is this document.

### Topology correction

- `#F1138 PCT/LNK/MSH Production Observability and Diagnostics Surface` was
  parented under `#F1121`, because it is the implementation follow-on for the
  production observability/doctor planning lane.
- An accidental parent assignment of unrelated `#F1162 TMNL Quisk Cockpit Clone
  Recon` under `#F1121` was corrected back to root.

## Current portfolio implementation features

| Feature | Status | Why it exists |
| --- | --- | --- |
| `#F1138` Production Observability and Diagnostics Surface | open, 6/7 complete | Diagnostics spine required before soak/ACL/chaos. |
| `#F1159` Long-Running Multi-Node Soak Harness | open, 0/7 | Reusable local/external/Kubernetes soak runner and integrity verifier. |
| `#F1160` Permission and ACL Hardening | open, 0/8 | Auth config threading, private inboxes, ACL profiles, HTTP/EventLog policy. |
| `#F1161` Hostile Network and Failure Chaos Harness | open, 0/9 | Deterministic faults, NATS bounce, restart drills, chaos hooks. |
| `#F1166` Workspace Hygiene and Lockfile Guardrails | open, 0/6 | Dirty classifier, staged-file gate, root lockfile ownership policy. |
| `#F1167` Hardening Documentation and Closeout System | open, 0/6 | Portfolio docs index, closeout template, validation ledger, docs gate. |

`#F1137 ProjectionWorker Durable Runtime Hardening — Slice A-F` is already
closed and validated. Treat follow-up projection runtime items as new work only
when they explicitly address heartbeat/stale lease reclaim, fence-token
propagation, or Timescale fault injection.

## Execution order

Authoritative sequencing artifact:

- `packages/pct/RFC-HARDENING-PORTFOLIO-EXECUTION-ORDER.md`

Summary:

1. **Wave 0 — Portfolio control plane**
   - Finish `#F1138`/`#F1145` diagnostics closeout.
   - Start `#F1167` docs index/template/ledger.
   - Start `#F1166` dirty classifier and staged-file gate.
2. **Wave 1 — Contract foundations**
   - `#4199` soak schemas/artifact model.
   - `#4217` chaos scenario/fault schemas.
   - `#4208` permission contract schemas.
3. **Wave 2 — Substrate/auth plumbing**
   - Auth config threading, private inboxes, MSH status telemetry,
     deterministic mock fault DSL, local/external NATS adapter.
4. **Wave 3 — Controlled runtime failure correctness**
   - ACL renderer/policies, LNK crash windows, federation restart drills,
     projection worker/outbox failure drills.
5. **Wave 4 — Local/compose-grade soak**
   - Workload nodes, integrity verifier, CLI smoke preset, live ACL proof,
     local NATS bounce.
6. **Wave 5 — Kubernetes overlays**
   - Helm/kind overlay, chaos hook seam, pod-delete/rollout hooks.
7. **Wave 6 — Portfolio closeout**
   - Validation ledger, closeout docs, staged-file gate, `#F1121` gates.

## Immediate next work

Recommended next Tasker work units:

1. `#F1138` active `#F1145`: diagnostics closeout docs and validation gates.
2. `#F1167` Slice A/B:
   - `#4244` Create hardening docs index and portfolio map.
   - `#4245` Add closeout template and lane-specific checklists.
3. `#F1166` Slice A/E:
   - `#4237` Dirty-baseline classifier/report.
   - `#4241` Closeout staged-file gate.
4. Then Wave 1 contracts:
   - `#4199` Soak schemas.
   - `#4217` Chaos schemas.
   - `#4208` Permission schemas.

## Key decisions to preserve

- MSH remains substrate-only: NATS/auth/JetStream/KV/micro host/tracing. No PCT
  or LNK semantics.
- LNK owns durable stream semantics: offsets, framing, producer fencing,
  idempotency, close/retention, metadata transitions.
- PCT owns contracts, schema registry, federation, control-plane semantics, frame
  projection specs, and portfolio governance.
- STX is local/client state substrate only; it does not become server stream
  truth.
- SQL/Timescale stores source facts, ledgers, read models, analytics; it is not a
  hidden semantic assembler.
- Diagnostics precede soak/chaos/ACL live denial.
- Local deterministic faults precede Kubernetes chaos.
- Root `package.json`, `bun.lock`, and `.gitmodules` must not be staged by
  planning lanes.

## Dirty workspace warning

The workspace is heavily dirty. At latest hygiene research:

- 108 modified tracked files,
- 62 deleted tracked files,
- 44 untracked paths/files,
- root `.gitmodules`, `package.json`, and `bun.lock` touched,
- major unrelated churn in `packages/tmnl`, `packages/datagrid`, `packages/stx`,
  `packages/mathkernel`, package deletions for `packages/db` and
  `packages/entity`, and submodule drift.

For this planning lane, stage only exact PCT RFC/handoff paths when asked. Do not
use broad staging. Ever. Not even with jazz hands.

Planning artifacts from this pass:

```text
packages/pct/RFC-LONG-RUNNING-MULTI-NODE-SOAK.md
packages/pct/RFC-PERMISSION-ACL-MATRIX.md
packages/pct/RFC-HOSTILE-NETWORK-FAILURE-CHAOS.md
packages/pct/RFC-WORKSPACE-LOCKFILE-HYGIENE.md
packages/pct/RFC-HARDENING-CLOSEOUT-DOCS.md
packages/pct/RFC-HARDENING-PORTFOLIO-EXECUTION-ORDER.md
packages/pct/PCT-LNK-MSH-HARDENING-PORTFOLIO-HANDOFF.md
```

Validated implementation artifacts from prior work are separate and should not
be casually mixed with planning docs:

```text
packages/pct/RFC-PROJECTION-RUNTIME-HARDENING.md
packages/pct/src/frames/ProjectionDurableRuntime.ts
packages/pct/src/frames/ProjectionLnkAdapters.ts
packages/pct/src/frames/ProjectionOutboxPublisher.ts
packages/pct/src/frames/FrameProjectionSpec.ts
packages/pct/src/frames/ProjectionScheduler.ts
packages/pct/src/frames/TimescaleProjectionCompiler.ts
packages/pct/src/frames/index.ts
packages/pct/test/projection-*.test.ts
packages/pct/test/frame-projections.test.ts
```

## Suggested closeout commands for this planning lane

Before any commit:

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg

git status --short -- \
  packages/pct/RFC-LONG-RUNNING-MULTI-NODE-SOAK.md \
  packages/pct/RFC-PERMISSION-ACL-MATRIX.md \
  packages/pct/RFC-HOSTILE-NETWORK-FAILURE-CHAOS.md \
  packages/pct/RFC-WORKSPACE-LOCKFILE-HYGIENE.md \
  packages/pct/RFC-HARDENING-CLOSEOUT-DOCS.md \
  packages/pct/RFC-HARDENING-PORTFOLIO-EXECUTION-ORDER.md \
  packages/pct/PCT-LNK-MSH-HARDENING-PORTFOLIO-HANDOFF.md

git status --short -- package.json bun.lock .gitmodules
```

If committing planning docs, stage explicit paths only:

```bash
git add \
  packages/pct/RFC-LONG-RUNNING-MULTI-NODE-SOAK.md \
  packages/pct/RFC-PERMISSION-ACL-MATRIX.md \
  packages/pct/RFC-HOSTILE-NETWORK-FAILURE-CHAOS.md \
  packages/pct/RFC-WORKSPACE-LOCKFILE-HYGIENE.md \
  packages/pct/RFC-HARDENING-CLOSEOUT-DOCS.md \
  packages/pct/RFC-HARDENING-PORTFOLIO-EXECUTION-ORDER.md \
  packages/pct/PCT-LNK-MSH-HARDENING-PORTFOLIO-HANDOFF.md

git diff --cached --name-status
```

Do not stage root lockfile or unrelated source changes as part of this planning
closeout.

## Final note

The portfolio is now structurally mapped: what to build, why, in what order, and
what evidence closes each lane. The next useful move is not another RFC; it is
finishing diagnostics closeout, then installing the docs/hygiene rails so the
implementation lanes can move without leaving glitter in the turbine.
