# NX Workspace — Skill Graph

> up: SKILL.md
> prereqs: none
> provides: full-topology, traversal-planning
> children: none
> meta: true — this file maps all nodes and edges in the skill

## How to Read

- **Indentation** = containment (directory nesting)
- **Edge labels** in brackets: `[routes]`, `[contains]`, `[prereqs]`, `[cross]`
- **→** = directed edge. `[prereqs]` means "read that first."
- **↔** = bidirectional cross-reference
- **REF.md** = deep conceptual reference + re-acquisition protocol

## Topology

```
SKILL.md                                          # Router + commands + tags
├──[routes]─→ TEMPLATE.md                         # Entity shapes, frontmatter, integration protocols
├──[routes]─→ GRAPH.md                            # This file (topology map)
├──[routes]─→ CHANGELOG.md                        # Skill version history
│
└──[routes]─→ references/INDEX.md                 # Directory router
    │
    ├──[contains]─→ plugins/INDEX.md              # Plugin inventory (8 registered)
    │   ├──[contains]─→ REF.md                    # ★ Deep: graph construction, createNodesV2, caching
    │   ├──[contains]─→ js-typescript.md
    │   ├──[contains]─→ vite.md
    │   ├──[contains]─→ eslint.md
    │   │   [cross]────↔ boundaries/INDEX.md
    │   ├──[contains]─→ next.md
    │   ├──[contains]─→ playwright.md
    │   ├──[contains]─→ jest.md
    │   ├──[contains]─→ rollup.md
    │   ├──[contains]─→ nx-effect.md
    │   │   [prereqs]─→ generators/INDEX.md
    │   │   [prereqs]─→ boundaries/INDEX.md
    │   ├──[contains]─→ createNodesV2.md
    │   │   [prereqs]─→ boundaries/INDEX.md
    │   └──[contains]─→ local-plugin.md
    │       [prereqs]─→ generators/registration.md
    │
    ├──[contains]─→ generators/INDEX.md
    │   │   [prereqs]─→ plugins/local-plugin.md
    │   ├──[contains]─→ REF.md                    # ★ Deep: Tree API, generateFiles, devkit utils
    │   │   [prereqs]─→ plugins/REF.md
    │   ├──[contains]─→ registration.md
    │   ├──[contains]─→ schema.md
    │   └──[contains]─→ tree-api.md
    │       [prereqs]─→ registration.md, schema.md
    │
    ├──[contains]─→ boundaries/INDEX.md
    │   │   [cross]────↔ effect-v4/INDEX.md
    │   ├──[contains]─→ REF.md                    # ★ Deep: AST analysis, tag system, enforcement
    │   │   [prereqs]─→ plugins/REF.md
    │   │   [cross]────↔ effect-v4/REF.md
    │   ├──[contains]─→ dep-constraints.md
    │   └──[contains]─→ migration-pattern.md
    │       [prereqs]─→ effect-v4/INDEX.md
    │       [prereqs]─→ effect-v4/version-bumping.md
    │
    └──[contains]─→ effect-v4/INDEX.md
        │   [cross]────↔ boundaries/INDEX.md
        ├──[contains]─→ REF.md                    # ★ Deep: Bun hoisting, alias mechanics, enforcement
        │   [prereqs]─→ boundaries/REF.md
        ├──[contains]─→ why-not-alternatives.md
        │   [prereqs]─→ REF.md
        ├──[contains]─→ ga-migration.md
        │   [prereqs]─→ REF.md, boundaries/migration-pattern.md
        └──[contains]─→ version-bumping.md
            [prereqs]─→ REF.md, plugins/nx-effect.md
```

## Node Count

| Level | Count |
|---|---|
| Root files (SKILL, TEMPLATE, GRAPH, CHANGELOG) | 4 |
| references/INDEX.md | 1 |
| Directory INDEX files | 4 |
| REF.md deep references | 4 |
| Plugin briefs | 8 |
| Plugin deep-dives | 2 |
| Generator docs | 3 |
| Boundary docs | 2 |
| Effect v4 docs | 3 |
| **Total** | **31** |

## Edge Summary

| Type | Count | Purpose |
|---|---|---|
| `routes` | 5 | SKILL.md decision tree |
| `contains` | 26 | Directory nesting |
| `prereqs` | 12 | "Read this first" |
| `cross` | 4 | Bidirectional sibling reference |
| **Total** | **47** |

## REF.md Pattern

Every directory has:
- **INDEX.md** — pure router. Lists contents + cross-references. Agent lands here to choose a file.
- **REF.md** — deep conceptual reference. Compiled research. Includes:
  - Mental model (how the thing works end-to-end)
  - Re-Acquisition Protocol (commands to re-research if stale)
  - Update Triggers (when to refresh)
  - Suggestions (improvements to consider)

An agent reads INDEX for routing, REF for understanding.
