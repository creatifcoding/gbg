# Animation Techniques Index

> Catalog of documented animation techniques for TMNL

---

## Available Techniques

| Technique | File | Use Case | Library |
|-----------|------|----------|---------|
| **Text Morph** | [text-morph-animation.md](./text-morph-animation.md) | Transitioning between different text content | anime.js v4 |

---

## Technique Summaries

### Text Morph Animation

**File**: `text-morph-animation.md`

**When to use**:
- Text content changes (e.g., "Off" → "Low" → "Medium" → "High")
- Desire for character-level animation effects
- Need smooth morphing between strings of different lengths

**Algorithm**:
1. Map characters between source and target strings
2. Fade out unmapped characters
3. Compress remaining characters
4. Scramble to target positions
5. Fade in new characters

**Beads**: `tmnl-ypwpb` (parent), `tmnl-qaako` through `tmnl-k7w7l` (implementation)

**Entry point**: `SKILL.md` → Q2 → Q2D (Content change A→B)

---

## Planned Techniques

| Technique | Status | Description |
|-----------|--------|-------------|
| Stagger Grid | Planned | Wave effects on grid items |
| Layout Shared | Planned | Elements moving between containers |
| SVG Path Morph | Planned | Shape-to-shape morphing |
| Typewriter | Planned | Character reveal with irregular timing |

---

## Quick Lookup

### By Animation Type

| Type | Technique | File |
|------|-----------|------|
| Text → Text | Text Morph | `text-morph-animation.md` |

### By Library

| Library | Techniques |
|---------|------------|
| anime.js v4 | Text Morph |
| motion.dev | (none documented yet) |
| CSS | (none documented yet) |

---

## Adding a Technique

1. Create `techniques/<name>.md` following the contract in `agents.md`
2. Add entry to this index
3. Update `SKILL.md` decision trees
4. Create tracking beads via `bd create`

---

## Bug Briefs

Documented bugs and root cause analyses related to animation techniques.

| ID | File | Topic |
|----|------|-------|
| BUG-001 | [`../briefs/BUG-001-scope-lazy-init.md`](../briefs/BUG-001-scope-lazy-init.md) | anime.js v4 scope not created for conditional elements |

---

## Related

- **Skill**: `../SKILL.md` — Decision trees and questionnaires
- **Navigation**: `../AGENTS.md` — Agent instructions (includes brief templates)
- **Briefs**: `../briefs/` — Bug briefs and knowledge artifacts
- **anime.js source**: `../../../../submodules/anime/`
- **Beads**: `bd show tmnl-ypwpb` — Text morph parent bead
