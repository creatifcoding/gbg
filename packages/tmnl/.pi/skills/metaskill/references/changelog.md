# Changelog Format

> up: INDEX.md
> prereqs: none
> provides: changelog-format, granular-logging, version-semantics
> children: none

## What the Changelog Tracks

Every structural change to a skill — file creates, modifications, deletions, renames. Not content typo fixes. Not formatting. **Structural** changes that affect what an agent sees when it traverses the skill.

## Format

```markdown
# <Skill Name> — Changelog

> up: SKILL.md
> meta: true

## [X.Y.Z] — YYYY-MM-DD

<One-line summary of what this version does.>

| Action | File | What changed |
|---|---|---|
| `+` | `path/to/file.md` | Created. <What it contains and why.> |
| `~` | `path/to/file.md` | <What specifically changed. Not "updated."> |
| `-` | `path/to/file.md` | Deleted. <Why.> |
| `→` | `old.md → new.md` | Renamed. <Why.> |
```

## Action Symbols

| Symbol | Meaning |
|---|---|
| `+` | File created |
| `~` | File modified |
| `-` | File deleted |
| `→` | File renamed or moved |

## Version Semantics

| Bump | When |
|---|---|
| `0.1.0` | Initial creation |
| `0.X.0` | Structural additions (new files, new directories, new patterns) |
| `0.X.Y` | Content updates to existing files (refreshed REF.md, corrected frontmatter) |
| `1.0.0` | Skill is stable — structure isn't expected to change often |

## What Goes in "What changed"

**Good:** "Added frontmatter protocol. Added prereqs: REF.md, boundaries/migration-pattern.md."
**Bad:** "Updated."

**Good:** "Created. Compiled research: Bun hoisting model, alias mechanics, enforcement stack. Re-acquisition protocol via deepwiki + bun cli."
**Bad:** "Created. Added docs."

The description should let an agent understand what happened **without opening the file**. If the agent needs to open the file to understand the changelog entry, the entry is too vague.

## Append-Only

Never edit past entries. If you made a mistake in v0.2.0 and fix it in v0.3.0, log the fix in v0.3.0. The changelog is a ledger, not a living document.
