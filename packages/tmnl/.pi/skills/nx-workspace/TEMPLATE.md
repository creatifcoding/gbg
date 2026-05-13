# Skill Doc Templates — Canonical Shapes

> up: SKILL.md
> prereqs: none
> provides: doc-authoring-guide, entity-shapes
> children: none
> meta: true — this file governs how all other files in this skill are written

## Purpose

Every doc in this skill follows a **shape** — a prescribed structure per entity type. New agents copy the shape. Consistency emerges from templates, not memory.

## Frontmatter Protocol

**Every** `.md` file in this skill starts with a header block:

```markdown
# Title

> up: relative/path/to/parent.md
> prereqs: path/to/dep1.md, path/to/dep2.md
> provides: keyword1, keyword2
> children: child1.md, child2.md
```

| Field | Required | Purpose |
|---|---|---|
| `up` | ✓ | Parent node (for breadcrumb navigation) |
| `prereqs` | ✓ | Files the reader should understand first. `none` if leaf. |
| `provides` | ✓ | Keywords describing what knowledge this doc gives |
| `children` | ✓ | Files this doc links to for deeper detail. `none` if leaf. |
| `meta` | optional | `true` if the file governs skill structure itself |

Paths are relative to `references/`. SKILL.md and root-level files use paths relative to skill root.

## Edge Types (for GRAPH.md)

| Edge | Meaning | Example |
|---|---|---|
| `routes` | SKILL.md decision tree routes here | SKILL → references/INDEX |
| `contains` | Directory INDEX contains these children | plugins/INDEX → createNodesV2.md |
| `prereqs` | Must read this first | createNodesV2.md requires boundaries/INDEX |
| `cross` | Sibling topic reference (bidirectional) | boundaries ↔ effect-v4 |

---

## Entity Shapes

### Shape: Plugin Brief

For each registered NX plugin. Lives under `references/plugins/<name>.md`.

```markdown
# <Plugin Name>

> up: INDEX.md
> prereqs: <list or none>
> provides: <target names this plugin infers>
> children: none

## Source
<npm package or local path>

## Infers From
<file patterns that trigger this plugin>

## Targets

| Target | What It Does | Cached |
|---|---|---|
| build | ... | ✓ |

## Options (nx.json)

| Option | Default | Purpose |
|---|---|---|
| buildTargetName | "build" | ... |

## When To Care
<1-2 sentences: when does an agent need to know about this plugin?>

## Cross-References
<links to related docs if any>
```

### Shape: Generator Doc

For NX generators. Lives under `references/generators/<name>.md`.

```markdown
# <Generator Name>

> up: INDEX.md
> prereqs: <e.g., plugins/local-plugin.md>
> provides: <what it scaffolds>
> children: none

## Usage
\`\`\`bash
bunx nx g <plugin>:<generator> <args> [--options]
\`\`\`

## Creates

| File | Purpose |
|---|---|
| package.json | ... |

## Updates
<files modified, e.g., tsconfig.base.json>

## Options

| Option | Type | Default | Purpose |
|---|---|---|---|
| name | string | required | ... |

## Example
\`\`\`bash
bunx nx g ./tools/nx-effect:effect-v4-lib layers --domain=ui --withReact
\`\`\`
```

### Shape: Boundary Rule

For module boundary constraint docs. Lives under `references/boundaries/<rule>.md`.

```markdown
# <Rule Name>

> up: INDEX.md
> prereqs: <e.g., effect-v4/INDEX.md>
> provides: <what constraint it enforces>
> children: none

## Rule
\`\`\`js
{ sourceTag: '...', onlyDependOnLibsWithTags: [...] }
\`\`\`

## Rationale
<why this rule exists>

## Violation Message
<what ESLint says when this fires>

## Affected Projects
<which tags/projects are constrained>
```

### Shape: Strategy Doc

For architectural decisions and migration strategies. Lives under `references/<topic>/<name>.md`.

```markdown
# <Strategy Name>

> up: INDEX.md
> prereqs: <dependencies>
> provides: <what knowledge>
> children: <deeper docs if any>

## Problem
<what problem this solves, 2-3 sentences>

## Solution
<the approach, with code examples>

## Why Not Alternatives
<table or list of rejected approaches>

## Migration Path
<steps to execute or transition>
```

### Shape: INDEX.md (Directory Router)

Every directory has one. Routes to children.

```markdown
# <Topic> — <Subtitle>

> up: ../INDEX.md (or ../../SKILL.md for top-level)
> prereqs: <if the whole topic has prereqs>
> provides: <topic-level keywords>
> children: <list all files in this directory>

## Overview
<1-2 sentences: what this directory covers>

## Contents

| File | When to read |
|---|---|
| foo.md | <trigger condition> |

## Cross-References
<links to related directories/topics>
```

---

## Updating This Skill

When adding a new doc:
1. Pick the entity shape from above
2. Copy the template
3. Fill in frontmatter (up, prereqs, provides, children)
4. Add the node to `GRAPH.md`
5. Add the file to its parent INDEX.md's Contents table
6. Log the change in `CHANGELOG.md`

When modifying structure:
1. Update `GRAPH.md` edges
2. Update affected frontmatter (prereqs/children may change)
3. Log in `CHANGELOG.md`
