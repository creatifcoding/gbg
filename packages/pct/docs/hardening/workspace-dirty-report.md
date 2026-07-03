# Workspace Dirty Baseline Classifier

Status: hardening report/runbook  
Owner: `#F1166 Workspace Hygiene and Lockfile Guardrails`  
Task: `#4237 Slice A: Dirty-baseline classifier/report`  
Last updated: 2026-05-26

## Purpose

This report documents the read-only dirty-workspace classifier used by the
PCT/LNK/MSH hardening portfolio. The classifier makes the current worktree dirt
visible by package, porcelain status, risk class, and likely lane ownership.

It does not mutate the workspace. It does not stage files. It is a flashlight,
not a broom. Prime, I am writing that down because someone will eventually try
to make the flashlight sweep.

Policy reference:

- [RFC-WORKSPACE-LOCKFILE-HYGIENE.md](../../RFC-WORKSPACE-LOCKFILE-HYGIENE.md)
- [staging-hygiene.md](./staging-hygiene.md)

## Command

From `packages/pct`:

```bash
bun run workspace:dirty-report
```

Direct command:

```bash
bun scripts/workspace-dirty-report.ts
```

JSON output:

```bash
bun scripts/workspace-dirty-report.ts --json
```

Limit rendered detail rows:

```bash
bun scripts/workspace-dirty-report.ts --max-details 40
```

## Classifier dimensions

| Dimension | Meaning |
| --- | --- |
| Package/root bucket | `packages/<name>`, `submodules/<name>`, or `<root>`. |
| Status kind | Derived from `git status --porcelain=v1`: modified, deleted, untracked, added, renamed, copied, conflict, other. |
| Risk class | Operational hazard bucket used for closeout/staging review. |
| Likely lane | Probable owner lane or explicit ownership requirement. |

## Risk classes

| Risk class | Meaning | Default action |
| --- | --- | --- |
| `root-shared-owner-required` | Root `package.json`, `bun.lock`, or `.gitmodules`. | Do not stage without explicit owner/rationale. |
| `runtime-state` | `.pi`, db-shm/db-wal, autoresearch, soak runs, or temp-like state. | Exclude or handle via ignore/local-ignore lane. |
| `package-delete` | Package deletion, currently `packages/db` or `packages/entity`. | Dedicated deletion owner required. |
| `submodule-drift` | Files under `submodules/*`. | Dedicated submodule owner required. |
| `pct-hardening-docs` | PCT RFCs, hardening docs, hardening handoffs/closeouts. | Safe only for docs/planning pathspec commits. |
| `pct-implementation` | PCT source/test/scripts/package edits. | Validate and stage separately from planning docs unless explicitly mixed. |
| `msh-substrate` | MSH package edits. | MSH substrate lane owner required. |
| `lnk-bridge` | LNK package edits. | LNK bridge lane owner required. |
| `other-package` | Non-PCT/LNK/MSH package dirt. | Treat as unrelated unless explicitly owned. |
| `other` | Root or miscellaneous paths not otherwise classified. | Inspect manually. |

## Report freshness policy

Do **not** treat a generated dirty report as source truth. It is a live snapshot
for the current operator turn only.

Durable docs should record:

- the command to regenerate the report;
- the policy used to interpret the report;
- the validation-ledger entry proving the command worked at closeout time.

Ephemeral outputs belong in `/tmp` or in a lane-specific evidence directory only
when the closeout explicitly needs an artifact. They should not be hand-maintained
as “current state” markdown. That would be a beautifully formatted lie within a
week.

Validation command shape:

```bash
cd /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/pct
bun run workspace:dirty-report -- --max-details 40 >/tmp/pct-workspace-dirty-report.md
bun scripts/workspace-dirty-report.ts --json >/tmp/pct-workspace-dirty-report.json
```

## Closeout use

Before closing or staging a PCT/LNK/MSH hardening lane:

1. Run `bun run workspace:dirty-report`.
2. Inspect the risk/lane buckets.
3. Run the staging checks from [staging-hygiene.md](./staging-hygiene.md).
4. Stage only exact lane-owned pathspecs.
5. Paste the classifier summary or JSON artifact path into the lane closeout.

## Follow-up boundary

This slice gives operators visibility. It does not enforce staging policy.
Enforcement belongs to:

- `#4241` Closeout staged-file gate.

