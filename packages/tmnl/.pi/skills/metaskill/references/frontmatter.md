# Frontmatter Protocol

> up: INDEX.md
> prereqs: none
> provides: frontmatter-format, field-definitions, edge-types
> children: none

## What Frontmatter Is

Every `.md` file in a governed skill starts with a blockquote header declaring its position in the skill's DAG. This is not decoration — agents read it to plan traversal, identify prereqs, and understand what a doc provides before opening it.

## Format

```markdown
# Title

> up: relative/path/to/parent.md
> prereqs: path/to/dep1.md, path/to/dep2.md
> provides: keyword1, keyword2
> children: child1.md, child2.md
```

## Fields

| Field | Required | Purpose |
|---|---|---|
| `up` | ✓ | Parent node. Breadcrumb navigation. SKILL.md uses `none`. |
| `prereqs` | ✓ | Docs the reader should understand first. `none` if standalone. |
| `provides` | ✓ | Keywords describing what knowledge this doc gives. Used for search and routing. |
| `children` | ✓ | Docs this file links to for deeper detail. `none` if leaf. |
| `governed-by` | on SKILL.md only | Points to `metaskill`. Signals governance contract. |
| `meta` | optional | `true` if the file governs skill structure itself (e.g., TEMPLATE.md, GRAPH.md). |
| `cross` | optional | Bidirectional reference to a sibling topic. Both files should declare it. |

## Path Resolution

- Paths are **relative to the file's directory**.
- `up: INDEX.md` means "the INDEX.md in my directory."
- `up: ../INDEX.md` means "the INDEX.md one level up."
- `prereqs: ../boundaries/REF.md` means "the REF.md in the sibling boundaries/ directory."
- SKILL.md and root-level files use paths relative to skill root.

## Edge Types

These are semantic labels for relationships between docs. Used in GRAPH.md topology.

| Edge | Meaning | Declared in |
|---|---|---|
| `routes` | SKILL.md decision tree routes to this file | SKILL.md router |
| `contains` | Directory INDEX lists this as a child | INDEX.md `children` field |
| `prereqs` | Must read this first for context | Any file's `prereqs` field |
| `cross` | Bidirectional sibling reference | Both files' `cross` field |

## Common Mistakes

**Missing prereqs:** A doc references concepts from another doc but doesn't declare the prereq. Agent reads it without context.

**Orphaned nodes:** A file exists but isn't listed in any INDEX's `children` or SKILL.md's router. Agent can't find it.

**One-directional cross:** File A declares `cross: B` but file B doesn't declare `cross: A`. Agent traversing from B doesn't know about A.

**Stale children:** INDEX lists a file that was deleted or renamed. Agent follows a dead link.

## Enforcement

After any structural change, run:

```bash
SKILL_DIR=.pi/skills/<name>
for f in $(find $SKILL_DIR -name '*.md' | sort); do
  head -6 "$f" | grep -qP '> (up|prereqs|provides|governed-by|meta):' || echo "NO FRONTMATTER: $f"
done
```

Zero output = compliant.
