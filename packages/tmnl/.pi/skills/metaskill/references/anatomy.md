# Skill Anatomy — What Files a Skill Has

> up: INDEX.md
> prereqs: none
> provides: skill-file-structure, file-shapes, growth-triggers
> children: none

## Minimum Viable Skill

Every skill starts with one file:

```
.pi/skills/<name>/
└── SKILL.md
```

SKILL.md is the **entry point**. An agent loads it first, always. If the skill has nothing else, SKILL.md must be self-contained.

## Full Skill Structure

A mature skill grows to:

```
.pi/skills/<name>/
├── SKILL.md              # Router + commands + "when to load"
├── CHANGELOG.md          # Granular per-file change history
├── TEMPLATE.md           # Entity shapes (if skill has typed docs)
├── GRAPH.md              # Topology map (if >6 nodes)
└── references/
    ├── INDEX.md           # Router to reference contents
    ├── <topic>/
    │   ├── INDEX.md       # Topic router
    │   ├── REF.md         # Deep conceptual reference + re-acquisition
    │   └── <leaf>.md      # Specific doc following an entity shape
    └── <topic>/
        ├── INDEX.md
        ├── REF.md
        └── <leaf>.md
```

## When to Add Each File

| File | Add when | Don't add if |
|---|---|---|
| `SKILL.md` | Always. Day zero. | — |
| `CHANGELOG.md` | First structural change after v0.1.0 | Skill is a single SKILL.md and won't grow |
| `references/INDEX.md` | Skill has 3+ reference docs | Everything fits in SKILL.md |
| `references/<topic>/INDEX.md` | Topic has 3+ leaf docs | Topic has 1-2 files (just list in parent INDEX) |
| `references/<topic>/REF.md` | Topic needs compiled research, or knowledge may go stale | Topic is config/procedures only (no conceptual depth) |
| `TEMPLATE.md` | Skill has entity types (e.g., "plugin brief", "boundary rule") that need consistent shapes | All docs are freeform |
| `GRAPH.md` | Skill has >6 nodes or cross-directory prereqs/edges | Skill is a flat list of docs |

## SKILL.md Shape

```markdown
# <Skill Name>

> prereqs: <other skills or "none">
> provides: <capability keywords>
> children: <root-level files>
> governed-by: metaskill

<One-line description.>

## When to Load
<Bullet list of specific triggers — not vague.>

## Router
<ASCII decision tree routing to every file.>
\```
What are you doing?
│
├─ Intent A ──── path/to/doc.md
├─ Intent B ──── path/to/other.md
└─ Intent C ──── § Section (below)
\```

## <Inline sections for quick-reference content>
<Commands, tags, diagnostics — things that don't need their own file.>
```

### Router Rules

1. **Every file in the skill must be reachable** from the router. If it's not routed, it's invisible.
2. **Routes go to files, not concepts.** `── path/to/file.md` not `── "read about plugins"`.
3. **Inline sections use `§`** for content that lives in SKILL.md itself. `── § Commands (below)`.
4. **Prereqs are shown inline** when a route has dependencies: `prereqs → path/to/dep.md`.
5. **The router is updated on every structural change.** This is non-negotiable.

### When to Load Rules

Bad:
```markdown
- Working with the project
- When you need help
```

Good:
```markdown
- Running builds/tests/lint across the monorepo
- Creating or scaffolding workspace packages
- Effect v3 → v4 migration questions
```

Triggers must be **specific enough** that an agent can pattern-match against them. If the trigger is "when you need help," it matches everything and nothing.

## INDEX.md Shape

Pure router. No conceptual content. Routes to children.

```markdown
# <Topic> — <Subtitle>

> up: ../INDEX.md
> prereqs: <topic-level prereqs or "none">
> provides: <topic-level keywords>
> children: <list all files>

## Contents

| File | When to read |
|---|---|
| `foo.md` | <specific trigger> |

## Cross-References
<Links to related directories/topics>
```

## Leaf Doc Shape

Content docs follow entity-specific shapes defined in TEMPLATE.md (if one exists). Otherwise, freeform with frontmatter.

```markdown
# <Title>

> up: INDEX.md
> prereqs: <deps or "none">
> provides: <keywords>
> children: none

<Content.>
```

## Size Discipline

| Concern | Rule |
|---|---|
| Max lines per file | ~90 lines. Split if larger. |
| Max depth | 4 levels: SKILL → INDEX → topic INDEX → leaf |
| Max children per INDEX | ~8 entries. If more, split into subdirectories. |
| REF.md exception | Can be longer (~150 lines). Deep context is worth the weight. |
