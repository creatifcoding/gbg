# RFC: Workspace and Root Lockfile Hygiene

Date: 2026-05-25
Status: feature plan
Parent: `#F1128 Feature-plan workspace and root lockfile hygiene`
Research task: `#4103`
Design task: `#4104`

## Intent

Define guardrails for working in a very dirty monorepo without accidentally
staging unrelated application work, root dependency changes, generated runtime
state, deleted packages, or submodule drift.

This lane exists because the current workspace is not merely “dirty.” It is a
crime scene with multiple overlapping investigations. Prime, the correct move is
not `git add .`; the correct move is tweezers, labels, and a chain-of-custody bag.

## Observed workspace state

Command baseline:

```bash
git status --short --branch
git diff --name-status
git status --porcelain=v1
```

Observed summary at planning time:

| Category | Count | Notes |
| --- | ---: | --- |
| Modified tracked files | 108 | Broad edits across `tmnl`, `datagrid`, `stx`, `mathkernel`, `pct`, root files, and submodules. |
| Deleted tracked files | 62 | Large package deletes in `packages/db`, `packages/entity`, tmnl extension dirs, and autoresearch files. |
| Untracked paths/files | 44 | Includes PCT RFCs/runtime files, new packages, tmnl docs/skills/extensions, submodules, and scratch notes. |
| Root files touched | 3 | `.gitmodules`, `package.json`, `bun.lock`. |
| PCT touched/untracked files | 18 | Mix of validated projection runtime implementation and new planning RFCs. |

Top-level dirty buckets:

| Bucket | Count | Interpretation |
| --- | ---: | --- |
| `packages/tmnl` | 93 | Mostly unrelated UI/harness/extensions/runtime state. High collision risk. |
| `packages/entity` | 27 | Entire package deletion; unrelated to PCT/LNK/MSH planning. |
| `packages/datagrid` | 26 | Active Effect-v4/datagrid/mathkernel work; unrelated. |
| `packages/db` | 18 | Entire package deletion; unrelated. |
| `packages/pct` | 18 | Current planning lane plus validated projection runtime work. Safe only with explicit path staging. |
| `packages/stx` | 10 | Effect v4/STX work; unrelated but dependency-adjacent. |
| `packages/mathkernel` | 6 | WASM/mathkernel edits; unrelated. |
| `submodules/*` | 4 | Submodule drift/untracked submodules; never include casually. |

## Root lockfile / dependency observations

### Root `package.json`

Observed diff:

```diff
+    "marked": "^18.0.3",
```

This is unrelated to the PCT/LNK/MSH planning lane unless the lane explicitly
owns markdown rendering or documentation generation at root scope. It should not
be included in any PCT hardening commit without a named dependency rationale.

### `bun.lock`

The root lockfile is modified. Because this repo uses Bun workspaces, root
lockfile drift can be caused by package-local dependency edits, root dependency
edits, or accidental root installs. It must be treated as a high-risk shared
artifact.

### Package-local dependency edits

Observed examples:

- `packages/datagrid/package.json`
  - adds `@tmnl/mathkernel`;
  - upgrades `effect-v4` alias from beta.23 to beta.59.
- `packages/stx/package.json`
  - upgrades `effect-v4`, `effect-atom-react-v4`, and `effect-vitest-v4` from
    beta.23 to beta.59.
- `packages/mathkernel/package.json` is modified.

These are likely coherent with other active workspace work, but they are not
part of this PCT/LNK/MSH planning lane.

## PCT lane-specific dirty set

### Planning artifacts currently in scope

These are planning artifacts produced by the hardening portfolio lane and are
safe to carry together when the lane closes:

- `packages/pct/RFC-LONG-RUNNING-MULTI-NODE-SOAK.md`
- `packages/pct/RFC-PERMISSION-ACL-MATRIX.md`
- `packages/pct/RFC-HOSTILE-NETWORK-FAILURE-CHAOS.md`
- `packages/pct/RFC-WORKSPACE-LOCKFILE-HYGIENE.md`
- future closeout/sequencing RFCs from `#F1129` / `#F1130`

Other older PCT RFCs already exist in the tree; some may be untracked in this
checkout. They must be checked against the intended planning commit before any
staging.

### PCT implementation work in scope only if explicitly chosen

The following files belong to completed projection runtime work, not the current
planning-only feature:

- `packages/pct/src/frames/FrameProjectionSpec.ts`
- `packages/pct/src/frames/ProjectionScheduler.ts`
- `packages/pct/src/frames/TimescaleProjectionCompiler.ts`
- `packages/pct/src/frames/index.ts`
- `packages/pct/src/frames/ProjectionDurableRuntime.ts`
- `packages/pct/src/frames/ProjectionLnkAdapters.ts`
- `packages/pct/src/frames/ProjectionOutboxPublisher.ts`
- related `packages/pct/test/projection-*` files

These should not be mixed with planning RFC commits unless the user explicitly
asks to commit both the validated implementation and the planning docs together.
Even then, stage by explicit paths only.

## Hygiene invariants

1. **No broad staging.**
   Never use `git add -A`, `git add .`, or wildcard staging in this repo.

2. **Root files require a named owner.**
   `.gitmodules`, root `package.json`, and root `bun.lock` may only be staged by a
   lane that explicitly owns dependency/submodule changes.

3. **Package-local installs only.**
   If a dependency is needed for `packages/pct`, run install/add from the owning
   package context or make the package manifest change intentionally. Do not
   mutate root dependencies as a side effect.

4. **Runtime state is not source.**
   Files under `.pi` runtime stores, messenger feed, `store.db-shm`,
   `store.db-wal`, extension logs, and cache files should be ignored or excluded
   unless the lane is explicitly developing pi extension persistence.

5. **Deletes are toxic until attributed.**
   Large deletes like `packages/db` and `packages/entity` must not be swept into
   any unrelated commit. Treat package deletion as its own RFC/PR.

6. **Submodule drift is quarantined.**
   Dirty submodules and `.gitmodules` changes require a submodule-specific owner,
   exact commit IDs, and a separate review.

7. **Planning commits are pathspec commits.**
   Planning artifacts should stage only the relevant RFC files and task metadata
   if task metadata is intentionally versioned.

8. **Generated artifacts need a declared ledger.**
   Diagrams under `/home/getbygenius/.agent/diagrams` and temporary files under
   `/tmp` are not repo commits. If a visual artifact belongs in source, copy it
   into a deliberate docs path and index it.

## Recommended operational protocol

Before any commit or closeout:

```bash
# 1. Show only the lane-owned paths
git status --short -- packages/pct/RFC-*.md

# 2. Show PCT implementation dirt separately
git status --short -- packages/pct/src packages/pct/test

# 3. Confirm root files are not staged unless owned
git status --short -- package.json bun.lock .gitmodules

# 4. Stage explicitly, never broadly
git add packages/pct/RFC-LONG-RUNNING-MULTI-NODE-SOAK.md \
        packages/pct/RFC-PERMISSION-ACL-MATRIX.md \
        packages/pct/RFC-HOSTILE-NETWORK-FAILURE-CHAOS.md \
        packages/pct/RFC-WORKSPACE-LOCKFILE-HYGIENE.md

# 5. Review exact staged set
git diff --cached --name-status
git diff --cached --stat
```

If root dependency files are truly required:

```bash
git diff -- package.json bun.lock
git add package.json bun.lock # only with explicit approval and rationale
```

## Proposed `.gitignore` / local-ignore policy

Consider follow-up ignore hygiene for generated local state. Candidate paths need
care because some extension source may be intentionally versioned.

Likely ignore candidates:

- `packages/tmnl/.pi/extensions.log`
- `packages/tmnl/.pi/messenger/feed.jsonl`
- `packages/tmnl/.pi/mcp-tools-cache.json`
- `packages/tmnl/.pi/rlm/*.db-shm`
- `packages/tmnl/.pi/rlm/*.db-wal`
- `packages/*/autoresearch.jsonl`
- `packages/*/autoresearch.md`
- `packages/*/autoresearch.ideas.md`
- `packages/pct/.soak-runs/`

Do not blanket-ignore `packages/tmnl/.pi/extensions/**` without deciding whether
extension code is source or local runtime state. That tree currently contains
both source-like files and generated lockfiles; adorable. Also terrible.

## Proposed follow-on implementation feature

Create under `#F1121`:

- Feature: `Workspace Hygiene and Lockfile Guardrails`
  - Slice A: Generate dirty-baseline classifier/report script.
  - Slice B: Add lane-scoped staging checklist for PCT planning commits.
  - Slice C: Add/adjust ignore rules for runtime state and soak artifacts.
  - Slice D: Add dependency-change ownership checklist for root `bun.lock`.
  - Slice E: Add closeout command/gate that fails if root files are staged by an
    unowned planning lane.
  - Slice F: Add docs for separating planning RFC commits from implementation
    commits.

## Recommendation

For the current PCT/LNK/MSH hardening portfolio, keep planning artifacts separate
from validated implementation dirt:

1. Commit planning RFCs only with exact PCT RFC pathspecs when asked.
2. Commit projection runtime implementation separately with its validated test
   list and exact source/test pathspecs.
3. Leave root `package.json`, `bun.lock`, `.gitmodules`, tmnl runtime state,
   package deletions, and datagrid/stx/mathkernel work untouched by this lane.

That is the difference between architecture and a landfill with a changelog.
