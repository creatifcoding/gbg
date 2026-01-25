# Animation Techniques - Agent Navigation

> Instructions for agents navigating the animation-techniques skill suite

---

## Directory Structure

```
.claude/skills/animation-techniques/
├── SKILL.md              # Decision trees and questionnaires
├── AGENTS.md             # This file - navigation guide
└── techniques/
    ├── INDEX.md          # Technique catalog
    └── text-morph-animation.md
```

---

## Navigation Protocol

### When to Access This Skill

Trigger conditions from `SKILL.md`:
- User mentions "animation", "transition", "morph", "effect"
- Implementing UI state changes with visual feedback
- Choosing between animation libraries
- Designing multi-phase or orchestrated animations
- Text-based animations or character effects

### How to Navigate

1. **Start with `SKILL.md`** — Run through the questionnaire to identify animation type
2. **Consult `techniques/INDEX.md`** — Find the specific technique reference
3. **Read the technique file** — Get implementation details, code examples, beads

### Decision Flow

```
User Request
    │
    ▼
SKILL.md Questionnaire
    │
    ├─► Identifies: Text content change
    │       │
    │       ▼
    │   techniques/INDEX.md
    │       │
    │       ▼
    │   text-morph-animation.md
    │
    ├─► Identifies: Layout animation
    │       │
    │       ▼
    │   motion.dev (external)
    │
    └─► Identifies: SVG morphing
            │
            ▼
        anime.js docs (external)
```

---

## Technique File Contract

Each technique file in `techniques/` MUST include:

| Section | Purpose |
|---------|---------|
| **Overview** | What the technique does, when to use |
| **Algorithm** | Step-by-step breakdown |
| **Implementation** | Full working code |
| **Integration** | How to plug into existing components |
| **Beads** | Related tracking beads |
| **Related** | Links to other techniques/skills |

---

## Adding New Techniques

When creating a new technique:

1. **Create file** in `techniques/` with kebab-case name
2. **Update `techniques/INDEX.md`** with entry
3. **Update `SKILL.md`** decision trees to route to new technique
4. **Create beads** for implementation tracking
5. **Follow the file contract** above

---

## Cross-References

| Need | Go To |
|------|-------|
| Library selection | `SKILL.md` → Decision Tree: Library Selection |
| Text animations | `SKILL.md` → Decision Tree: Text Animation |
| Specific technique | `techniques/INDEX.md` → technique file |
| anime.js API | `../../submodules/anime/` or deepwiki |
| motion.dev patterns | deepwiki `motion/motion` |

---

## Agent Invocation Examples

```
# User asks about text animations
→ Read SKILL.md, run Q2-Q3
→ Route to text-morph-animation.md if content change

# User asks about library choice
→ Read SKILL.md, run Decision Tree: Library Selection
→ Recommend based on complexity

# User needs specific technique
→ Read techniques/INDEX.md
→ Find matching technique
→ Provide implementation from technique file
```

---

## Anti-Patterns

| Don't | Do |
|-------|-----|
| Jump straight to implementation | Run through questionnaire first |
| Recommend library without context | Use decision tree |
| Skip technique files | Always check if documented |
| Hardcode animation values | Use parameterized presets |
| Ignore reduced motion | Check `prefers-reduced-motion` |

---

## Brief Templates

Briefs are structured documents that capture knowledge artifacts. Store them in `briefs/` directory.

### Brief Types

| Type | Purpose | Prefix |
|------|---------|--------|
| **Bug** | Document root cause analysis, fix, prevention | `BUG-NNN` |
| **Technique** | Document animation pattern implementation | `TECH-NNN` |
| **Decision** | Record architectural choice and rationale | `DEC-NNN` |
| **Spike** | Document experimental findings | `SPIKE-NNN` |

### Bug Brief Template

```markdown
# BUG-NNN: <Short title describing the bug>

> <One-line insight or lesson learned>

---

## Summary

| Field | Value |
|-------|-------|
| **ID** | BUG-NNN |
| **Type** | Bug Brief |
| **Severity** | Critical/High/Medium/Low |
| **Library** | <affected library> |
| **Pattern** | <pattern or system affected> |
| **Status** | Resolved/Open/Workaround |

---

## Symptom

<What the user/developer observes. No errors? Partial behavior? Crash?>

---

## Root Cause

<Technical explanation of WHY this happens. Include incorrect assumptions.>

---

## Incorrect Mental Model

<What we thought was happening vs what actually happened. Use pseudocode or diagrams.>

---

## Solution

<Code showing the fix. Explain why it works.>

---

## Detection Pattern

<How to recognize this bug pattern in other code. Red flags to watch for.>

---

## Prevention

| Do | Don't |
|----|-------|
| <correct approach> | <incorrect approach> |

---

## Related

- **Links to relevant files, docs, and beads**

---

## Timeline

| Date | Event |
|------|-------|
| YYYY-MM-DD | Bug discovered |
| YYYY-MM-DD | Fix applied |
```

### General Brief Template

```markdown
# <TYPE>-NNN: <Title>

> <One-line summary or insight>

---

## Summary

| Field | Value |
|-------|-------|
| **ID** | <TYPE>-NNN |
| **Type** | <Brief type> |
| **Status** | <status> |

---

## Context

<Background and motivation>

---

## Details

<Main content - varies by type>

---

## Related

- <Links to files, docs, beads>

---

## Timeline

| Date | Event |
|------|-------|
```

### Filing a Brief

1. Choose type based on content
2. Assign sequential ID within type (e.g., `BUG-001`, `BUG-002`)
3. Create file: `briefs/<TYPE>-NNN-<slug>.md`
4. Update `techniques/INDEX.md` to reference brief if relevant
5. Create bead for tracking: `bd create --type=knowledge --title="Brief: ..."`

### Existing Briefs

| ID | File | Topic |
|----|------|-------|
| BUG-001 | `briefs/BUG-001-scope-lazy-init.md` | anime.js v4 scope not created for conditional elements |
