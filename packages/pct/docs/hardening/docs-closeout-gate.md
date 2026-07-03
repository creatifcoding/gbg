# PCT/LNK/MSH Docs Closeout Gate

Status: hardening gate  
Owner: `#F1167 PCT/LNK/MSH Hardening Documentation and Closeout System`  
Task: `#4249 Slice F: Add docs closeout gate/checklist`  
Last updated: 2026-05-26

## Purpose

This gate makes the hardening closeout system executable enough to catch missing
sections, broken links, and staging-hygiene omissions before a lane is marked
closed.

It does not prove runtime correctness. It proves the docs spine has enough
structure that the runtime evidence can be found, reviewed, and not accidentally
committed with a root lockfile side quest. Small distinction. Expensive when
missed.

## Command

From `packages/pct`:

```bash
bun run hardening:docs:check
```

Equivalent direct command:

```bash
bun scripts/check-hardening-closeout.ts
```

Check one closeout file:

```bash
bun scripts/check-hardening-closeout.ts --file docs/hardening/diagnostics-closeout.md
```

Machine-readable output:

```bash
bun scripts/check-hardening-closeout.ts --json
```

## What the gate checks

The script `packages/pct/scripts/check-hardening-closeout.ts` validates:

1. Required hardening docs exist:
   - `docs/hardening/README.md`
   - `docs/hardening/closeout-template.md`
   - `docs/hardening/validation-ledger.md`
   - `docs/hardening/boundary-contracts.md`
   - `docs/hardening/staging-hygiene.md`
   - `docs/hardening/docs-closeout-gate.md`
2. Relative markdown links in hardening docs resolve.
3. Every `docs/hardening/*-closeout.md` file, except the template itself,
   includes required sections 1–11 from the closeout template.
4. The portfolio index and closeout template link the staging hygiene runbook.
5. The template includes `## 10. Workspace hygiene proof`.
6. The staging runbook explicitly forbids broad staging and includes required
   staged-file/root-file inspection commands.
7. The validation ledger links the staging hygiene artifact.

## Required closeout sections

Lane closeout docs must include these exact headings:

```text
## 1. Verdict
## 2. Scope and non-goals
## 3. Boundary review
## 4. Implementation map
## 5. Public API and compatibility notes
## 6. Validation commands
## 7. Operational evidence
## 8. Failure modes and recovery
## 9. Known gaps and follow-ups
## 10. Workspace hygiene proof
## 11. Final operator notes
```

## Manual checklist after the script passes

The script is a gate, not judgment. Before closing a hardening lane, the operator
must still verify:

- [ ] Recorded validation commands were actually run or explicitly marked stale.
- [ ] Live/opt-in tests are either run or skipped with a reason.
- [ ] Boundary claims match [boundary-contracts.md](./boundary-contracts.md).
- [ ] Staged-file proof follows [staging-hygiene.md](./staging-hygiene.md).
- [ ] Root `package.json`, `bun.lock`, and `.gitmodules` are absent or explicitly owned.
- [ ] Known gaps have follow-up task/feature IDs.
- [ ] The validation ledger has an entry for the lane.

## Failure interpretation

| Failure | Meaning | Fix |
| --- | --- | --- |
| Required doc missing | The hardening docs spine is incomplete. | Restore/create the missing doc and link it from the portfolio index. |
| Broken relative link | Operator navigation will fail later. | Fix the path relative to the file that contains the link. |
| Missing closeout section | Lane evidence is not reviewable enough to close. | Add the missing section, even if the content says `n/a` with rationale. |
| Staging runbook not linked | Workspace hygiene is easy to bypass. | Link `staging-hygiene.md` from the index/template/ledger. |
| Broad staging text missing | The docs forgot the hazard everyone actually trips on. | Add explicit `git add -A` / `git add .` prohibition. |

## Relationship to workspace gates

This docs gate complements, but does not replace, the future staged-file gate in
`#F1166/#4241`.

- This gate verifies docs structure and runbook linkbacks.
- The staged-file gate should inspect the actual staged set and fail on root or
  unrelated paths without ownership.

The docs gate tells the operator where the scalpel is. The staged-file gate makes
sure she did not pick up a chainsaw.
