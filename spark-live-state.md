# Live-state probe (read-only)

Hypothesis: the checkout is a single worktree on `master` (no worktree split after any `/tree` operation), with local `pct`/`lnk` and package-manifest history to report.

Method:
- Ran read-only git probes only (`status`, `branch`, `worktree`, `log`, `rev-list`, `show-ref`).
- Collected short path-scoped histories for:
  - `packages/pct`
  - `packages/lnk`
  - `package*.json`
- Did only cheap sanity checks; no long test suites.

## 1) Branch / worktree state (post `/tree`-style check)
- `git status --short --branch`: `## master...origin/master [ahead 1135]`
- `git rev-parse --abbrev-ref HEAD`: `master`
- `git worktree list`:
  - `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg  1b5f411d [master]`
  - no additional worktree rows
- `git branch -a`:
  - local: `master`, `rescue/7b92`, `rescue/d292`
  - remote: `origin/master` and feature branches
- `git branch --list '*tree*'`: no output
- `git log --graph --all --all` (trimmed) shows `master` as a linear line from origin tip with `rescue/*` as separate local branches.

**Conclusion:** branch/worktree state is **single-checkout, branch-tracked on `master`**. No active worktree split.

## 2) Working tree probe
- Current working tree is dirty; `git status --short` listed 163 entries.
- `git status --short -- packages/pct` -> **clean** (no pending edits in `packages/pct`).
- `git status --short -- packages/lnk` -> edits in:
  - `packages/lnk/CONFORMANCE.md`
  - `packages/lnk/PCT.md`
  - `packages/lnk/package.json`

## 3) Recent commits touching `packages/pct`
Newest touching `packages/pct` (local history):
1. `314b204a feat(pct): Phase 3.7 — Federation Flow B (pull-based peer sync)`
2. `6cc91971 feat(examples/tracer): typed device + dashboard, verified end-to-end against pact serve`
3. `fe1bf425 feat(lnk+pct): Phase 2.5b — Lnks.connectTypedById schema auto-fetch`
4. `0624ac82 fix(pct/procedures): Procedure + ProcedureGroup are schema-carrying values, not plain objects`
5. `26007e40 feat(lnk+pct): Phase 1.4 — LnkRoutes Layer + dual-protocol composition`
6. `88eed341 feat(pct/cli): in-package CLI runtime + 'pact serve' subcommand`
7. `901ebd32 feat(pct/cli): consume PactConfig via stacked sources`
8. `35b024e6 feat(pct): Phase 3.6.5 — PactConfig service with stacked sources`
9. `d5195fcd feat(pct): Phase 3.6 — PactClient typed proxy`
10. `eefc7027 feat(pct): Phase 3.5 — PactServer routes Layer`

`git rev-list --count origin/master..HEAD -- packages/pct` returned **13** entries in local history window.

## 4) Recent commits touching `packages/lnk`
Newest touching `packages/lnk`:
1. `fe1bf425 feat(lnk+pct): Phase 2.5b — Lnks.connectTypedById schema auto-fetch`
2. `e5e678b3 feat(lnk): Phase 2.5 — TypedLnk + Lnks.connectTyped (schema auto-bind)`
3. `df84bd2c docs(lnk): align phase numbering with ARCHITECTURE.md`
4. `26007e40 feat(lnk+pct): Phase 1.4 — LnkRoutes Layer + dual-protocol composition`
5. `ca2d7741 spec(lnk/pct): version header 0.2 -> 0.3`
6. `a35bdbbc spec(lnk/pct): Draft 0.3 — server composition via HttpLayerRouter pattern`
7. `c69d772b spec(lnk/pct): Pact Protocol — Draft 0.2`
8. `7631bdf8 spec(lnk/pct): Pact Protocol — Phase 3 draft 0.1`
9. `24edb5ed exploratory(lnk/proto): EventLog x SchemaRepresentation as registry substrate`
10. `31114f47 docs(lnk): Phase 2 wrap-up — top-level index + status table`

`git log --oneline -- packages/lnk` shows much longer history as well (older phase commits continue).

## 5) Package scripts / manifests touched
Path-scoped `package.json` history (latest entries):
- `1b5f411d feat(@tmnl/msh): extract holonet → @tmnl/msh on Effect v4`
- `6bd60238 fix(metaskill): resolve Effect v4 dual-package deadlock`
- `36bcc467 feat(codemode): upgrade Effect v4 beta.23 → beta.66`
- `88eed341 feat(pct/cli): in-package CLI runtime + 'pact serve' subcommand`
- `35b024e6 feat(pct): Phase 3.6.5 — PactConfig service with stacked sources`
- `44d4d686 feat(pct): Phase 3.0 — service hierarchy scaffold`
- `352f2c57 test(lnk): integrate @durable-streams/server-conformance-tests`
- `2aa52d35 chore(workspace): exclude packages/codemode-pi via negation pattern`
- `7520d418 feat(tmnl): wire @tmnl/lnk via latest/ re-export shim`
- `a3ecdc85 feat(lnk): scaffold @tmnl/lnk workspace package + Phase 0 contracts`

Current unstaged manifest edits (from `git diff --stat -- package.json packages/*/package.json`):
- `package.json`
- `packages/datagrid/package.json`
- `packages/lnk/package.json`
- `packages/mathkernel/package.json`
- `packages/msh/package.json`
- `packages/stx/package.json`

## 6) Quick safety checks
- `git rev-list --left-right --count origin/master...HEAD` -> `0\t1135`.
- `git rev-list --count origin/master..HEAD` -> `1135`.
- `git submodule status` is failing due missing `.gitmodules` mapping for `packages/mathkernel/vendor/eigen/agent-browser` (environmental/metadata issue in current tree).

Verdict: **works** (read-only probe complete, evidence captured).