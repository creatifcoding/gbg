# metaskill — Changelog

> up: SKILL.md
> meta: true

## [0.2.0] — 2026-03-02

Utils directory. Monolithic UTILS.md decomposed into co-located utils/ with INDEX, REF, and per-util leaves.

| Action | File | What changed |
|---|---|---|
| `-` | `UTILS.md` | Deleted. Replaced by `utils/` directory with progressive disclosure. |
| `+` | `utils/INDEX.md` | Created. Inventory table of 8 utils. Composition note (full-health is composite). |
| `+` | `utils/REF.md` | Created. Utils pattern: what utils are (templates not literals, agent adapts). Co-location principle. Util shape. How docs reference utils. How to write new utils. |
| `+` | `utils/full-health.md` | Created. Composite diagnostic: governance, changelog, frontmatter, orphans, dead links. |
| `+` | `utils/audit-all.md` | Created. Bulk workspace audit — one line per skill, GOV/FILES/CL/FM_MISS columns. |
| `+` | `utils/frontmatter-check.md` | Created. Per-file field count for a single skill. |
| `+` | `utils/orphan-check.md` | Created. Find files unreferenced by any INDEX or SKILL.md. |
| `+` | `utils/dead-link-check.md` | Created. Find frontmatter prereqs/children pointing to missing files. |
| `+` | `utils/changelog-coverage.md` | Created. Verify CHANGELOG accounts for every file. |
| `+` | `utils/graph-sync.md` | Created. Verify GRAPH.md accounts for every file. |
| `+` | `utils/governance-adopt.md` | Created. Inject governed-by line into ungoverned SKILL.md. |
| `~` | `SKILL.md` | Updated children (UTILS.md → utils/INDEX.md). Router now routes to utils/. Protocols reference utils by name not inline scripts. |
| `~` | `GRAPH.md` | Added utils/ subtree (10 nodes). Total: 18 nodes, 17 edges. |
| `~` | `references/frontmatter.md` | Removed inline enforcement script. Now references `util:frontmatter-check` from `utils/INDEX.md`. |
| `~` | `references/governance.md` | Removed inline bulk audit script. Now references `util:audit-all` and `util:governance-adopt` from `utils/INDEX.md`. Adoption protocol updated. |

## [0.1.0] — 2026-03-02

Bootstrap from nx-workspace skill patterns. Generalized into a governing meta-skill.

| Action | File | What changed |
|---|---|---|
| `+` | `SKILL.md` | Created. Router covering: create, modify, overhaul, audit. Three full protocols (Create, Overhaul, Audit) with verification steps. Governance contract definition. |
| `+` | `GRAPH.md` | Created. 9-node topology with 14 edges. |
| `+` | `CHANGELOG.md` | Created. This file. |
| `+` | `references/INDEX.md` | Created. Routes to 5 reference docs. |
| `+` | `references/anatomy.md` | Created. Minimum viable skill through full structure. File shapes. When-to-add. Router rules. When-to-split (cognitive load, not line count). |
| `+` | `references/frontmatter.md` | Created. Field definitions. Path resolution. Edge types. Common mistakes. |
| `+` | `references/ref-pattern.md` | Created. INDEX vs REF vs leaf roles. When-to-create. REF.md shape. Re-Acquisition Protocol rules. Update Trigger rules. Suggestions rules. |
| `+` | `references/changelog.md` | Created. Granular per-file format. Action symbols. Version semantics. Append-only. |
| `+` | `references/governance.md` | Created. Governance contract. Five agent scenarios. Ungoverned vs governed. |
