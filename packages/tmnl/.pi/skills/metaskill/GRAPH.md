# metaskill — Skill Graph

> up: SKILL.md
> prereqs: none
> provides: full-topology
> children: none
> meta: true

## Topology

```
SKILL.md                                    # Router + 17 protocols + interfaces table + codemod API docs
├──[routes]─→ GRAPH.md                      # This file
├──[routes]─→ CHANGELOG.md                  # Version history
│
├──[routes]─→ references/INDEX.md           # Reference router
│   ├──[contains]─→ anatomy.md              # Skill file structure, shapes, split triggers
│   ├──[contains]─→ frontmatter.md          # Frontmatter fields, path resolution, edge types
│   ├──[contains]─→ ref-pattern.md          # REF.md pattern, re-acquisition, triggers, suggestions
│   ├──[contains]─→ changelog.md            # Changelog format, granularity, version semantics
│   └──[contains]─→ governance.md           # Contract, agent behavior, adoption, bulk audit
│
├──[routes]─→ utils/INDEX.md                # Util router + inventory
│   ├──[contains]─→ REF.md                  # Utils pattern, co-location, util authoring
│   ├──[contains]─→ full-health.md          # Composite: gov + fm + orphans + dead + children + cross
│   ├──[contains]─→ audit-all.md            # Bulk workspace audit
│   ├──[contains]─→ frontmatter-check.md    # Per-file field count
│   ├──[contains]─→ orphan-check.md         # Unreachable file detection
│   ├──[contains]─→ dead-link-check.md      # Broken frontmatter refs
│   ├──[contains]─→ children-sync.md        # INDEX children vs actual files
│   ├──[contains]─→ cross-symmetry.md       # Bidirectional cross-ref validation
│   ├──[contains]─→ router-coverage.md      # Leaf docs in SKILL.md router (2-hop)
│   ├──[contains]─→ changelog-coverage.md   # CHANGELOG completeness
│   ├──[contains]─→ graph-sync.md           # GRAPH.md completeness
│   └──[contains]─→ governance-adopt.md     # Inject governance line
│
├──[routes]─→ .pi/extensions/metaskill/     # Extension (colocated with skill)
│   ├── api.ts                              # Codemod API engine (pure functions, no pi deps)
│   │   ├──[reads]─→ .pi/skills/*/          # Discovers, inspects, mutates skill files
│   │   ├──[reads]─→ SKILL.md               # Extracts § protocols
│   │   └──[exports]─→ createApi()           # Factory: discover, info, inspect, audit, conformance,
│   │                                        #   conformanceAudit, frontmatter, setFrontmatter,
│   │                                        #   protocol, protocols, utils, runUtil, adopt, scaffold,
│   │                                        #   read, write, sh
│   ├── index.ts                             # TUI overlay + ms tool (JS REPL) + /ms command + Ctrl+Shift+M
│   │   └──[uses]─→ api.ts                  # All interfaces share the same API engine
│   └──[companion]─→ .pi/prompts/ms.md      # Slash command fallback template
│
└──[tested-by]─→ src/lib/metaskill/__tests__/  # Tests (in src/ for vitest)
    ├── api.unit.test.ts                     # 26 unit tests: discover, inspect, audit, conformance,
    │                                        #   frontmatter, adopt, scaffold
    ├── api.property.test.ts                 # 15 property tests: structural invariants, idempotency,
    │                                        #   conformance monotonicity, composition
    └── api.e2e.test.ts                      # 13 e2e tests: real skill tree, scaffold→build→inspect
                                             #   workflows, lifecycle orchestration
```

## Conformance Profile

Levels define the minimum bar for a skill at each tier:

| Level | Label | Requirements |
|---|---|---|
| -1 | missing | No SKILL.md |
| 0 | exists | Has SKILL.md only |
| 1 | governed | + `governed-by: metaskill` + CHANGELOG.md + frontmatter on all files |
| 2 | clean | + Passes full inspect (all 9 checks: governance, changelog, frontmatter, orphans, dead-links, children-sync, cross-symmetry, graph-sync, changelog-coverage) |
| 3 | instrumented | + Has utils/ directory AND GRAPH.md |

## Counts

| Metric | Value |
|---|---|
| Skill doc nodes | 22 |
| Extension files | 2 (api.ts, index.ts) + 1 prompt template |
| Test files | 3 (54 tests total: 26 unit + 15 property + 13 e2e) |
| API functions | 17 |
| Total graph edges | 28 |
