# Utils — Verification & Diagnostic Tools

> up: ../SKILL.md
> prereqs: none
> provides: util-routing, tool-inventory
> children: REF.md, full-health.md, audit-all.md, frontmatter-check.md, orphan-check.md, dead-link-check.md, children-sync.md, cross-symmetry.md, router-coverage.md, changelog-coverage.md, graph-sync.md, governance-adopt.md

All utils assume cwd is `packages/tmnl`. Agent adapts paths and composition to context.

## Inventory

| Util | What it checks | When to use |
|---|---|---|
| `full-health` | Composite: governance + frontmatter + orphans + dead links + children sync + cross symmetry | After any structural change. Default. |
| `audit-all` | Bulk one-liner per skill across workspace | Periodic sweep. Before releases. |
| `frontmatter-check` | Field count per file | Debugging specific frontmatter gaps. |
| `orphan-check` | Files unreachable from INDEX/SKILL | After adding/removing files. |
| `dead-link-check` | Frontmatter refs to missing files | After renames or moves. |
| `children-sync` | INDEX children vs actual dir contents | After adding files to a directory. |
| `cross-symmetry` | Bidirectional cross-reference validation | After adding/modifying cross: edges. |
| `router-coverage` | Leaf docs mentioned in SKILL.md router | After adding leaf docs. |
| `changelog-coverage` | CHANGELOG accounts for all files | After version bumps. |
| `graph-sync` | GRAPH.md accounts for all files | After adding files (skills with GRAPH). |
| `governance-adopt` | Inject governance line | Onboarding a skill. |

## Composition

`full-health` is the composite — runs governance, frontmatter, orphans, dead links, children sync, and cross symmetry. Use individual utils for targeted debugging.

For a full audit, run `full-health` first. If it passes, you're done. If not, run the specific util that failed to get detailed output.

## Cross-References
- `REF.md` — how the utils system works, how to write new utils, co-location strategy
