# PCT/LNK/MSH Hardening Validation Ledger

Status: ledger format + initial entries  
Owner: `#F1167 PCT/LNK/MSH Hardening Documentation and Closeout System`  
Task: `#4246 Slice C: Add validation ledger format`  
Last updated: 2026-05-25

## Purpose

This ledger records validation evidence for PCT/LNK/MSH hardening lanes in a
stable, reviewable shape. It is not a substitute for tests; it is the index of
what was run, what it proved, where the output lives, and which gaps remain.

When a lane closes, add an entry here and link the lane-specific closeout.
Otherwise future operators get to practice archaeology. Charming, but not a
release process.

## Ledger entry contract

Each entry should answer six questions:

1. **What lane/feature was validated?**
2. **What exact command ran?**
3. **Was it mock, local live, external live, or Kubernetes?**
4. **What did the command prove?**
5. **Where is the evidence?**
6. **What gaps remain?**

### Markdown entry template

```markdown
## <YYYY-MM-DD> — <Lane / Feature / Task>

| Field | Value |
| --- | --- |
| Feature | `<#F...>` |
| Task(s) | `<#...>` |
| Lane | `<diagnostics | soak | acl | chaos | projection-runtime | workspace | docs>` |
| Environment | `<mock | local | local-live-nats | external-live-nats | kubernetes | docs-only>` |
| Status | `<pass | partial | fail | skipped>` |
| Evidence owner | `<agent/person>` |
| Closeout | `<path or TBD>` |

### Commands

```bash
<exact command>
```

### Result

```text
<summary of observed result>
```

### Proves

- <invariant proven>

### Does not prove

- <explicit non-claim>

### Artifacts

- <path/link>

### Follow-ups

- <#... or none>
```

## Environment vocabulary

| Environment | Meaning | CI-safe by default? |
| --- | --- | --- |
| `docs-only` | Markdown/link/checklist validation only | yes |
| `mock` | Pure unit/in-process mock tests, no live NATS | yes |
| `local` | Local process or local filesystem only | usually |
| `local-live-nats` | Starts local NATS server or uses local NATS URL | opt-in |
| `external-live-nats` | Uses existing external NATS deployment | opt-in |
| `kubernetes` | Uses kind/Helm/Kubernetes cluster or pod hooks | opt-in/manual |

## Status vocabulary

| Status | Meaning |
| --- | --- |
| `pass` | Command completed and proves the stated invariants. |
| `partial` | Command completed but only proves part of the required evidence. |
| `fail` | Command failed or disproved an invariant. |
| `skipped` | Command was intentionally not run; reason must be recorded. |

## Current validation posture by lane

| Lane | Feature | Current evidence | Current gap |
| --- | --- | --- | --- |
| Diagnostics / doctor | `#F1138` | Diagnostics plan and taxonomy exist; implementation feature is 6/7 with `#F1145` active. | Needs final closeout/gate evidence in this ledger. |
| Projection runtime | `#F1137` | Durable runtime slice validated with targeted PCT projection tests and typecheck. | Heartbeat/stale lease reclaim and Timescale fault injection remain follow-up work unless implemented separately. |
| Soak | `#F1159` | Planning RFC exists. | No soak runner validation yet. |
| Permission / ACL | `#F1160` | Planning RFC exists. | No auth-threading/ACL renderer validation yet. |
| Chaos | `#F1161` | Planning RFC exists. | No mock fault DSL or live bounce validation yet. |
| Workspace hygiene | `#F1166` | Planning RFC exists. | No dirty classifier or staged-file gate validation yet. |
| Docs / closeout | `#F1167` | Index/template/ledger docs validation in progress. | Boundary matrix, staging linkbacks, and docs gate still pending. |

## Initial ledger entries

## 2026-05-24 — NATS integration layered closeout

| Field | Value |
| --- | --- |
| Feature | NATS integration closeout lineage |
| Task(s) | n/a |
| Lane | `projection-runtime` / `diagnostics prerequisite` |
| Environment | `mock`, `local-live-nats` |
| Status | `pass` |
| Evidence owner | prior hardening lane |
| Closeout | [NATS-INTEGRATION-CLOSEOUT.md](../../NATS-INTEGRATION-CLOSEOUT.md) |

### Commands

```bash
cd packages/msh && bunx vitest run
cd packages/msh && bunx tsc --noEmit --pretty false
cd packages/msh && MSH_LIVE_NATS=1 bunx vitest run test/live-*.test.ts --reporter verbose

cd packages/lnk && bunx vitest run test/services/wire/NatsBridgeWire.test.ts test/services/wire/nats-bridge/*.test.ts --fileParallelism=false
cd packages/lnk && bunx tsc --noEmit --pretty false

cd packages/pct && LNK_LIVE_NATS=1 bunx vitest run test/pct-lnk-msh-typed-proof.test.ts test/pct-nats-schema-resolver.test.ts --reporter verbose
cd packages/pct && bunx vitest run test/config.test.ts test/frame-projections.test.ts test/projection-registry.test.ts test/projection-scheduler.test.ts test/projection-worker-contracts.test.ts test/projection-worker-nats-host.test.ts --fileParallelism=false
cd packages/pct && bunx tsc --noEmit --pretty false
```

### Result

```text
MSH normal suite: 11 files passed / 4 skipped; 104 tests passed / 12 skipped; typecheck passed.
MSH live suite: 4 files passed; 12 tests passed.
LNK bridge suite: 8 files passed / 1 skipped; 47 tests passed / 2 skipped; typecheck passed.
PCT typed/NATS proof suite: 2 files passed; 4 tests passed.
PCT config/projection suite: 6 files passed; 44 tests passed; typecheck passed.
```

### Proves

- MSH substrate remained generic across auth, JetStream/KV, and micro host proofs.
- LNK bridge semantics worked over MSH/NATS without moving durable stream policy
  into MSH.
- PCT schema resolver/control-plane proof worked over the unchanged LNK
  `SchemaResolver.fetchSchema(schemaId)` contract.
- Projection scheduler contracts and worker host seam passed targeted tests at
  that point in the lane.

### Does not prove

- Long-running soak stability.
- Permission/ACL negative profiles.
- Hostile restart/reconnect chaos.
- Production ProjectionWorker lease heartbeat/stale takeover.

### Artifacts

- [NATS-INTEGRATION-CLOSEOUT.md](../../NATS-INTEGRATION-CLOSEOUT.md)

### Follow-ups

- `#F1138` diagnostics surface.
- `#F1159` long-running soak.
- `#F1160` permission/ACL hardening.
- `#F1161` hostile network/failure chaos.

## 2026-05-25 — ProjectionWorker durable runtime first slice

| Field | Value |
| --- | --- |
| Feature | `#F1137` |
| Task(s) | Slice A-F within `#F1137` |
| Lane | `projection-runtime` |
| Environment | `mock` |
| Status | `pass` |
| Evidence owner | prior hardening lane |
| Closeout | [RFC-PROJECTION-RUNTIME-HARDENING.md](../../RFC-PROJECTION-RUNTIME-HARDENING.md) |

### Commands

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

### Result

```text
13 files, 49 tests passed.
Typecheck passed.
```

### Proves

- Projection durable runtime memory contracts passed targeted tests.
- LNK adapters, outbox publisher, scheduler, worker host, registry, assembly,
  CAGG, migrations, and frame projection contracts passed their targeted suite.
- DDL hardening inherited runtime table statements through projection plan output.

### Does not prove

- Timescale-backed runtime behavior.
- Worker heartbeat/stale lease takeover.
- Fence-token propagation across real worker processes.
- Long-running multi-node worker behavior.

### Artifacts

- [RFC-PROJECTION-RUNTIME-HARDENING.md](../../RFC-PROJECTION-RUNTIME-HARDENING.md)

### Follow-ups

- `#F1161` projection worker failure drills.
- Future projection runtime feature for heartbeat/stale lease reclaim if required.

## 2026-05-25 — Hardening docs index and closeout template

| Field | Value |
| --- | --- |
| Feature | `#F1167` |
| Task(s) | `#4244`, `#4245`, `#4246` |
| Lane | `docs` |
| Environment | `docs-only` |
| Status | `pass` |
| Evidence owner | YoungEagle |
| Closeout | TBD |

### Commands

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg
bun --eval '<relative-link-check-script>'
```

### Result

```text
packages/pct/docs/hardening/README.md: 32 relative links checked, 0 missing.
packages/pct/docs/hardening/closeout-template.md: 0 relative links checked, 0 missing.
```

### Proves

- Portfolio index links resolve.
- Closeout template is present and linked from the index.
- Lane-specific checklist coverage exists for diagnostics, soak, ACL, chaos,
  projection runtime, workspace hygiene, and docs/closeout.

### Does not prove

- Runtime correctness of any implementation lane.
- Future closeout docs are complete.
- Automated docs gate exists; that is `#4249`.

### Artifacts

- [README.md](./README.md)
- [closeout-template.md](./closeout-template.md)
- this ledger

### Follow-ups

- `#4247` boundary contract matrix and anti-bloat links.
- `#4248` staging hygiene and runbook linkbacks.
- `#4249` docs closeout gate/checklist.

## 2026-05-26 — Diagnostics output audit and reimplementation checkpoint

| Field | Value |
| --- | --- |
| Feature | `#F1145` |
| Task(s) | `#4155` |
| Lane | `diagnostics` |
| Environment | `mock`, `docs-only` |
| Status | `pass` |
| Evidence owner | BrightHawk |
| Closeout | [diagnostics-audit.md](./diagnostics-audit.md) |

### Commands

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg

cd packages/msh && bunx vitest run test/diagnostics.test.ts --reporter verbose
cd packages/lnk && bunx vitest run test/services/wire/nats-bridge/MshBridgeDiagnostics.test.ts --reporter verbose
cd packages/pct && bunx vitest run test/pct-diagnostics.test.ts test/diagnostics-rollup.test.ts --reporter verbose
cd packages/pct && bun run diagnostics:rollup --compact >/tmp/pct-diagnostics-rollup.json

rg -n "@tmnl/(pct|lnk)|packages/(pct|lnk)|from ['\"].*(pct|lnk)|import\(['\"].*(pct|lnk)" \
  packages/msh/src packages/msh/test || true
```

### Result

```text
MSH diagnostics: 1 file, 5 tests passed.
LNK MSH bridge diagnostics: 1 file, 2 tests passed.
PCT diagnostics + rollup: 2 files, 5 tests passed.
PCT diagnostics rollup sample: severity=unknown, reports=1, findings=3.
MSH PCT/LNK import scan: no matches.
Leak scan over sample rollup: no token/seed/jwt/Bearer/password/secret/creds/authorization matches.
```

### Proves

- Diagnostics reports are Schema-backed and use stable check IDs.
- MSH redaction covers token/JWT/seed/credential-shaped values in tests.
- Default PCT rollup emits safe PCT-only diagnostics with skipped optional checks.
- MSH diagnostics do not import PCT/LNK source or tests.
- Reviewed checks are read-only/non-destructive.
- No source reimplementation is required before diagnostics closeout.

### Does not prove

- Live MSH/LNK report capture.
- Fine-grained NATS permission-denied classification.
- NATS disconnect/reconnect status telemetry.
- Automated docs closeout gate.

### Artifacts

- [diagnostics-audit.md](./diagnostics-audit.md)
- `/tmp/pct-diagnostics-rollup.json` (ephemeral local sample)

### Follow-ups

- `#4156` update docs and close diagnostics lane.
- `#F1160` / `#4214` permission-aware diagnostics.
- `#F1161` / `#4218` MSH connection status telemetry.
- `#F1167` / `#4249` docs closeout gate.

## 2026-05-26 — Diagnostics surface closeout

| Field | Value |
| --- | --- |
| Feature | `#F1138`, `#F1145` |
| Task(s) | `#4156` |
| Lane | `diagnostics` |
| Environment | `mock`, `docs-only` |
| Status | `pass` |
| Evidence owner | HappyEagle |
| Closeout | [diagnostics-closeout.md](./diagnostics-closeout.md) |

### Commands

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg
bun --eval '<relative-link-check-script>'

cd packages/msh && bunx vitest run && bunx tsc --noEmit --pretty false
cd packages/lnk && bunx vitest run test/services/wire/NatsBridgeWire.test.ts test/services/wire/nats-bridge/*.test.ts --fileParallelism=false && bunx tsc --noEmit --pretty false
cd packages/pct && bunx vitest run test/config.test.ts test/projection-scheduler.test.ts test/projection-worker-contracts.test.ts test/projection-worker-nats-host.test.ts --fileParallelism=false && bunx tsc --noEmit --pretty false
```

### Result

```text
Diagnostics closeout written and linked from portfolio index.
MSH system atlas updated with first diagnostics slice status.
LNK NATS bridge docs updated with bridge diagnostics boundary.
MSH: 12 files passed, 5 skipped; 109 tests passed, 13 skipped; typecheck passed.
LNK: 9 files passed, 1 skipped; 49 tests passed, 2 skipped; typecheck passed.
PCT: 4 files passed; 38 tests passed; typecheck passed.
```

### Proves

- Diagnostics closeout now has a durable source artifact.
- Cross-package docs point operators to the diagnostics surface without moving PCT policy into MSH or LNK.
- Follow-up gaps are named and linked to future hardening lanes.

### Does not prove

- New runtime behavior beyond the diagnostics audit validation.
- Automated docs gate; that remains `#4249`.

### Artifacts

- [diagnostics-closeout.md](./diagnostics-closeout.md)
- [diagnostics-audit.md](./diagnostics-audit.md)
- [README.md](./README.md)

### Follow-ups

- `#F1160` / `#4214` permission-aware diagnostics.
- `#F1161` / `#4218` MSH connection status telemetry.
- `#F1167` / `#4249` docs closeout gate.

## 2026-05-26 — Staging hygiene and runbook linkbacks

| Field | Value |
| --- | --- |
| Feature | `#F1167` |
| Task(s) | `#4248` |
| Lane | `docs`, `workspace-hygiene` |
| Environment | `docs-only` |
| Status | `pass` |
| Evidence owner | HappyEagle |
| Closeout | [staging-hygiene.md](./staging-hygiene.md) |

### Commands

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg
bun --eval '<relative-link-check-script>'

git diff --cached --name-status
git status --short -- package.json bun.lock .gitmodules
```

### Result

```text
Staging hygiene runbook created and linked from portfolio index, closeout template, boundary contracts, and validation ledger.
Root/shared files remain dirty in the worktree but unstaged in this docs lane.
No staged files at validation time.
```

### Proves

- Portfolio docs now link the workspace/root lockfile hygiene policy.
- The reusable closeout template requires exact staging command evidence and root/shared ownership proof.
- Operators have exact pathspec examples for docs-only, diagnostics closeout, planning RFC, and projection runtime bundles.
- Broad staging is explicitly forbidden in the runbook and template.

### Does not prove

- Automated staged-file gate; that remains `#F1166/#4241` and `#F1167/#4249`.
- Clean root files; dirty root files remain a separate ownership problem.

### Artifacts

- [staging-hygiene.md](./staging-hygiene.md)
- [README.md](./README.md)
- [closeout-template.md](./closeout-template.md)
- [boundary-contracts.md](./boundary-contracts.md)

### Follow-ups

- `#F1166` / `#4237` dirty-baseline classifier/report.
- `#F1166` / `#4241` closeout staged-file gate.
- `#F1167` / `#4249` docs closeout gate/checklist.

## 2026-05-26 — Docs closeout gate/checklist

| Field | Value |
| --- | --- |
| Feature | `#F1167` |
| Task(s) | `#4249` |
| Lane | `docs`, `closeout-gate` |
| Environment | `docs-only`, `script` |
| Status | `pass` |
| Evidence owner | HappyEagle |
| Closeout | [docs-closeout-gate.md](./docs-closeout-gate.md) |

### Commands

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/pct
bun run hardening:docs:check
bun scripts/check-hardening-closeout.ts --file docs/hardening/diagnostics-closeout.md --json >/tmp/pct-hardening-docs-gate.json

cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg
git diff --cached --name-status
git status --short -- package.json bun.lock .gitmodules
```

### Result

```text
Full docs gate: PASS, 21/21 checks passed.
Single closeout JSON gate: ok=true, 14 checks.
No staged files at validation time.
Root/shared files remain dirty in the worktree but unstaged in this docs lane.
```

### Proves

- Required hardening docs spine exists.
- Relative links in hardening docs resolve.
- `docs/hardening/*-closeout.md` files include required sections 1–11.
- Portfolio index/template/staging runbook/ledger linkbacks are machine-checked.
- The docs closeout gate is exposed as `bun run hardening:docs:check`.

### Does not prove

- Runtime correctness for diagnostics, soak, ACL, chaos, or projection lanes.
- Actual staged-file policy enforcement; that remains `#F1166/#4241`.

### Artifacts

- [docs-closeout-gate.md](./docs-closeout-gate.md)
- [staging-hygiene.md](./staging-hygiene.md)
- `packages/pct/scripts/check-hardening-closeout.ts`
- `/tmp/pct-hardening-docs-gate.json` (ephemeral local sample)

### Follow-ups

- `#F1166` / `#4237` dirty-baseline classifier/report.
- `#F1166` / `#4241` closeout staged-file gate.

## 2026-05-26 — Workspace dirty classifier

| Field | Value |
| --- | --- |
| Feature | `#F1166` |
| Task(s) | `#4237` |
| Lane | `workspace-hygiene` |
| Environment | `script`, `read-only` |
| Status | `pass` |
| Evidence owner | HappyEagle |
| Closeout | [workspace-dirty-report.md](./workspace-dirty-report.md) |

### Commands

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/pct
bun run workspace:dirty-report -- --max-details 20 >/tmp/pct-workspace-dirty-report.md
bun scripts/workspace-dirty-report.ts --json >/tmp/pct-workspace-dirty-report.json

cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg
git diff --cached --name-status
git status --short -- package.json bun.lock .gitmodules
```

### Result

```text
Classifier command succeeded and produced markdown + JSON snapshots under /tmp.
Observed validation-time sample: total=880 dirty entries; root-shared-owner-required=3; runtime-state=105; package-delete=45; pct-hardening-docs=17; pct-implementation=17.
No staged files at validation time.
Root/shared files remain dirty in the worktree but unstaged in this lane.
```

### Proves

- Dirty workspace can be classified by package, status kind, risk class, and likely lane without mutating the workspace.
- Root/shared files are surfaced as `root-shared-owner-required`.
- Runtime/local state and package-delete hazards are visible before staging.
- The durable artifact is the command/script; generated reports are ephemeral snapshots, not maintained source truth.

### Does not prove

- Staged-file enforcement; that remains `#F1166/#4241`.
- Runtime-state ignore policy; that remains `#F1166/#4239`.
- Root dependency ownership checklist; that remains `#F1166/#4240`.

### Artifacts

- [workspace-dirty-report.md](./workspace-dirty-report.md)
- `packages/pct/scripts/workspace-dirty-report.ts`
- `/tmp/pct-workspace-dirty-report.md` (ephemeral local sample)
- `/tmp/pct-workspace-dirty-report.json` (ephemeral local sample)

### Follow-ups

- `#F1166` / `#4238` PCT lane-scoped staging checklist.
- `#F1166` / `#4239` runtime-state ignore policy.
- `#F1166` / `#4241` closeout staged-file gate.

## 2026-05-26 — Closeout staged-file gate

| Field | Value |
| --- | --- |
| Feature | `#F1166` |
| Task(s) | `#4241` |
| Lane | `workspace-hygiene`, `staging-gate` |
| Environment | `script`, `read-only` |
| Status | `pass` |
| Evidence owner | HappyEagle |
| Closeout | [staged-file-gate.md](./staged-file-gate.md) |

### Commands

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/pct
bun run workspace:staged-gate
bun scripts/check-staged-files.ts --json >/tmp/pct-staged-file-gate.json
bun run hardening:docs:check

cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg
git diff --cached --name-status
git status --short -- package.json bun.lock .gitmodules
```

### Result

```text
Staged-file gate passed in planning mode with staged files: 0.
JSON gate sample: ok=true, mode=planning, staged=0, violations=0.
Docs closeout gate: PASS, 23/23 checks passed.
No staged files at validation time.
Root/shared files remain dirty in the worktree but unstaged in this lane.
```

### Proves

- Planning closeout can reject forbidden staged root/shared paths unless an explicit owner override is supplied.
- Runtime/generated state, submodule drift, package deletes, and unrelated planning-mode files have a gate path.
- The gate is exposed as `bun run workspace:staged-gate`.

### Does not prove

- CI integration; this is currently an operator-run gate.
- That future operators actually run it before staging. Charming problem, not solved by TypeScript.

### Artifacts

- [staged-file-gate.md](./staged-file-gate.md)
- `packages/pct/scripts/check-staged-files.ts`
- `/tmp/pct-staged-file-gate.json` (ephemeral local sample)

### Follow-ups

- `#F1166` / `#4242` planning-vs-implementation commit docs.

## 2026-05-26 — Planning vs implementation commit split docs

| Field | Value |
| --- | --- |
| Feature | `#F1166` |
| Task(s) | `#4242` |
| Lane | `workspace-hygiene`, `commit-hygiene` |
| Environment | `docs-only`, `script` |
| Status | `pass` |
| Evidence owner | HappyEagle |
| Closeout | [staging-hygiene.md](./staging-hygiene.md#planning-vs-implementation-split) |

### Commands

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/pct
bun run hardening:docs:check
bun run workspace:staged-gate

cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg
git diff --cached --name-status
git status --short -- package.json bun.lock .gitmodules
```

### Result

```text
Docs closeout gate: PASS, 23/23 checks passed.
Staged-file gate: PASS, staged files=0.
No staged files at validation time.
Root/shared files remain dirty in the worktree but unstaged in this lane.
```

### Proves

- Staging hygiene docs now explicitly separate planning/RFC/closeout commits from implementation source/test commits.
- Operators have commit-kind include/exclude rules and staged-file gate commands.

### Does not prove

- That future commit authors will not ignore the rule; staged-file gate helps, but reviews still matter.

### Artifacts

- [staging-hygiene.md](./staging-hygiene.md#planning-vs-implementation-split)
- [README.md](./README.md)

### Follow-ups

- Use `bun run workspace:staged-gate` in lane closeout before staging.

## Pending ledger entries

Add entries when these lanes produce evidence:

- `#F1159` soak artifact/model smoke run.
- `#F1160` ACL renderer and live denial proof.
- `#F1161` deterministic fault DSL and local NATS bounce proof.

## Ledger maintenance rules

- Record exact commands, not paraphrases.
- Separate mock, live, external, and Kubernetes evidence.
- Record skipped live tests explicitly with a reason.
- Link artifacts, but do not paste giant logs into this file.
- If evidence is stale after a source change, add a new entry instead of editing
  history into a lie. Charming as revisionism is, it makes terrible operations.
