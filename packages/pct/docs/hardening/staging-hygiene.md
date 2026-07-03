# PCT/LNK/MSH Staging Hygiene Runbook

Status: hardening runbook  
Owner: `#F1167 PCT/LNK/MSH Hardening Documentation and Closeout System`  
Task: `#4248 Slice E: Add staging hygiene and runbook linkbacks`  
Last updated: 2026-05-26

## Purpose

This runbook turns the workspace hygiene RFC into operator muscle memory. It is
for hardening lanes that need to stage PCT/LNK/MSH planning docs, closeouts,
source, or tests inside a very dirty monorepo without dragging root dependency
changes, package deletes, submodule drift, runtime caches, or someone else's
experiments into the commit.

Primary policy reference:

- [RFC-WORKSPACE-LOCKFILE-HYGIENE.md](../../RFC-WORKSPACE-LOCKFILE-HYGIENE.md)

Related closeout docs:

- [README.md](./README.md)
- [closeout-template.md](./closeout-template.md)
- [validation-ledger.md](./validation-ledger.md)
- [boundary-contracts.md](./boundary-contracts.md)

Prime, this is not ceremony. This is how we avoid shipping a lockfile crime scene
with a diagnostics closeout sticker on it.

## Non-negotiable invariants

1. **Never broad-stage.** No `git add -A`, no `git add .`, no wildcard staging.
2. **Stage exact pathspecs only.** Every staged file must be named deliberately.
3. **Root/shared files require ownership.** Root `package.json`, `bun.lock`, and
   `.gitmodules` require an explicit owner, rationale, and validation command.
4. **Planning docs and implementation changes are separate by default.** Mixing
   them requires a named decision in the closeout.
5. **Runtime state is not source.** `.pi` feed/cache/db-shm/db-wal, soak runs,
   autoresearch output, and temporary files stay out unless the lane explicitly
   owns that persistence surface.
6. **Deletes are toxic until attributed.** Package deletions are their own lane,
   not incidental cleanup.
7. **Submodule drift is quarantined.** `.gitmodules` or submodule pointer changes
   require a submodule-specific owner and review.

## Pre-stage inspection

Run these from the repo root before staging or closing any hardening lane:

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg

git diff --cached --name-status

git status --short -- package.json bun.lock .gitmodules

git status --short -- \
  packages/pct/RFC-*.md \
  packages/pct/PCT-LNK-MSH-HARDENING-*.md \
  packages/pct/docs/hardening

git status --short -- packages/pct/src packages/pct/test
```

Interpretation:

| Command | Pass condition |
| --- | --- |
| `git diff --cached --name-status` | Empty before staging, or contains only lane-owned paths. |
| `git status --short -- package.json bun.lock .gitmodules` | Root/shared files are not staged unless explicitly owned. Dirty-but-unstaged is a warning, not permission to sweep them in. |
| PCT docs/RFC status | Only the current lane's planning/closeout docs are selected for staging. |
| PCT src/test status | Implementation changes are considered separately from planning docs. |

## Planning vs implementation split

Default rule: **planning/RFC/closeout docs and implementation source/tests are
separate commits**.

Mix them only when the closeout explicitly says why the implementation cannot be
reviewed without the planning artifact in the same staged set. Otherwise:

| Commit kind | Include | Exclude |
| --- | --- | --- |
| Planning / RFC / closeout | `packages/pct/RFC-*`, `packages/pct/docs/hardening/*`, approved MSH/LNK docs linkbacks | `packages/pct/src/**`, `packages/pct/test/**`, root lockfiles, unrelated package dirt |
| Implementation | Exact source/test files for the validated slice, plus the RFC only if it is the implementation's design artifact | unrelated planning docs, unrelated package dirt, generated runtime state |
| Root dependency/submodule | Only the owned root/shared files and directly related package manifest files | all planning and implementation changes unless the dependency lane owns them |

When in doubt, run:

```bash
cd packages/pct
bun run workspace:dirty-report
bun run workspace:staged-gate
```

## Exact staging examples

### Documentation lane only

Use this shape for docs-only closeout work such as `#F1167`:

```bash
git add \
  packages/pct/docs/hardening/README.md \
  packages/pct/docs/hardening/closeout-template.md \
  packages/pct/docs/hardening/validation-ledger.md \
  packages/pct/docs/hardening/boundary-contracts.md \
  packages/pct/docs/hardening/staging-hygiene.md

git diff --cached --name-status
```

### Diagnostics closeout docs

Use this shape when carrying the diagnostics closeout docs without broad MSH/LNK
source changes:

```bash
git add \
  packages/pct/docs/hardening/diagnostics-audit.md \
  packages/pct/docs/hardening/diagnostics-closeout.md \
  packages/pct/docs/hardening/README.md \
  packages/pct/docs/hardening/validation-ledger.md \
  packages/msh/docs/system-atlas.md \
  packages/lnk/NATS-BRIDGE.md

git diff --cached --name-status
```

### Planning RFC bundle

Use this shape for a planning-docs-only handoff bundle:

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

### Projection runtime implementation bundle

Implementation bundles must be exact and validated separately. Example shape:

```bash
git add \
  packages/pct/RFC-PROJECTION-RUNTIME-HARDENING.md \
  packages/pct/src/frames/FrameProjectionSpec.ts \
  packages/pct/src/frames/ProjectionDurableRuntime.ts \
  packages/pct/src/frames/ProjectionLnkAdapters.ts \
  packages/pct/src/frames/ProjectionOutboxPublisher.ts \
  packages/pct/src/frames/ProjectionScheduler.ts \
  packages/pct/src/frames/index.ts \
  packages/pct/test/projection-durable-runtime-contracts.test.ts \
  packages/pct/test/projection-durable-runtime-memory.test.ts \
  packages/pct/test/projection-lnk-adapters.test.ts \
  packages/pct/test/projection-outbox-publisher.test.ts \
  packages/pct/test/projection-scheduler.test.ts

git diff --cached --name-status
```

Do not treat that list as universal. It is an example of the *shape*: exact paths,
then review.

## Root/shared file ownership rule

Root/shared files are high-risk because they affect the whole workspace.

| File | Default | Required if included |
| --- | --- | --- |
| `package.json` | excluded | Dependency owner, reason, package needing it, install command used, typecheck/test impact. |
| `bun.lock` | excluded | Matching manifest diff, Bun command used, lockfile review, owner. |
| `.gitmodules` | excluded | Submodule owner, old/new URL or commit pointer rationale, review path. |

If a root/shared file is required, add a closeout note like:

```text
Root/shared ownership:
- file: bun.lock
- owner: <agent/person>
- rationale: <why this lane owns dependency resolution>
- command: <bun command that produced it>
- validation: <tests/typecheck proving impact>
```

If that note feels annoying, excellent. It is doing its job.

## Closeout staging proof

Every lane closeout must paste or summarize these outputs:

```bash
git diff --cached --name-status
git status --short -- package.json bun.lock .gitmodules
```

Pass condition:

- staged set contains only lane-owned files;
- root/shared files are absent or explicitly owned;
- no unrelated deletes;
- no generated runtime state;
- no submodule drift unless the lane owns it.

## Recovery if staging is wrong

If unrelated files are staged:

```bash
git restore --staged <exact-path>
```

If many unrelated files are staged, do **not** reach for a dramatic reset unless
you know every staged file belongs to you. First inspect:

```bash
git diff --cached --name-status
git diff --cached --stat
```

Then unstage exact paths. The scalpel, Prime. Not a leaf blower.

## Linkback requirements

Docs/closeout work must link this runbook from:

- portfolio index staging section;
- reusable closeout template workspace proof section;
- validation ledger entries for workspace hygiene or docs closeout;
- any lane-specific runbook that instructs an operator to stage files.

Future automated gate `#4249` should verify at minimum:

- closeout section `## 10. Workspace hygiene proof` exists;
- staged-file command examples are present;
- this runbook is linked from the portfolio index and template.
