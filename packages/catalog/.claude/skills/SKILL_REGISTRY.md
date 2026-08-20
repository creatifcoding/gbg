# Catalog skill registry

Mined from `packages/tmnl/.claude/skills/SKILL_REGISTRY.md` and rewritten for `@gbg/catalog`.

Catalog is a TanStack Start app with VANTA Black visuals. Skills below stay inside this package. They do not document tauri, elixir, renode, iiot, or tmnl shells.

Canonical Vanta Black: `packages/tmnl/src/components/portal/tokens.ts`  
Tmnl skill map: `packages/tmnl/.claude/skills/SKILL_REGISTRY.md`

## Skill template

```markdown
---
name: skill-name
description: One or two sentences. Invoke when [triggers].
model_invoked: true
triggers:
  - "trigger"
---

# Title

## Canonical sources
## Patterns
## Anti-patterns
## Related
```

## Catalog skills

| Skill | Purpose | Triggers |
| --- | --- | --- |
| `catalog-color-system` | VANTA surfaces and accents. No second palette. | color, glow, VANTA_COLORS |
| `catalog-design-tokens` | Token copy, CSS variables, variants | VANTA_TYPOGRAPHY, tokens |
| `catalog-component-tiers` | portal / primitives / ui / routes | where to put, primitives |
| `catalog-typography-discipline` | 12px floor, Geo / Grotesk / Mono | font size, 12px floor |
| `catalog-file-organization` | lib vs components vs ui vs skills | where is, file structure |
| `catalog-testbed-patterns` | `/testbed/*` Start file routes | testbed |
| `catalog-registry-patterns` | STATUS_VISUAL, CARD_KINDS | registry, status |
| `react-compound-components` | VantaCard Object.assign slots | VantaCard, compound |
| `grounded-research` | Verify tmnl tokens and catalog schema first | research, verify |
| `catalog-intake` | 10-second dump then file | intake, fileCard, dump |

## Subsystem map

| Subsystem | Path | Testbed | Skill |
| --- | --- | --- | --- |
| portal / VantaCard | `src/components/portal/` | `/testbed/vanta` | color, tokens, compound |
| catalog domain | `src/lib/catalog/` | unit tests | intake, registry |
| screens | `src/ui/` | product routes | component-tiers |
| testbed harness | `src/components/testbed/` | `/testbed/vanta` | testbed-patterns |

## Dependency graph

```
catalog-file-organization
catalog-component-tiers
        |
        v
catalog-design-tokens --> catalog-color-system
                      --> catalog-typography-discipline
        |
        v
react-compound-components --> catalog-testbed-patterns
catalog-registry-patterns
catalog-intake
grounded-research (before non-trivial changes)
```

## Not cloned

Tmnl skills for slider, data-manager, overlays, commands, AG-Grid, animation drivers, renode, iiot, and CLI services stay in tmnl. Catalog does not need them until those subsystems exist here.

## Maintenance

1. New testbed: add or update `catalog-testbed-patterns`
2. New visual token: update color + design-token skills, copy from tmnl portal tokens
3. Intake rule change: update `catalog-intake` and `fileCard` tests together
