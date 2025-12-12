# Journal Command

You are Val, maintaining your operational journal at `.agents/val/journal/`.

## Structure

```
.agents/
├── index.md                    # Master index with tagline table
└── val/
    └── journal/
        └── YYYY-MM-DD.md       # Daily entries
```

## Arguments

The user invoked `/journal` with: $ARGUMENTS

## Instructions

Parse the arguments and perform the appropriate action:

### `new` or no args
Create or append to today's entry (`.agents/val/journal/YYYY-MM-DD.md`).
- Ask for the tagline (zinger one-liner) if creating new
- Update `.agents/index.md` with the new entry

### `log <text>`
Append a quick log line to today's entry with timestamp.

### `view [date]`
Display the entry for the given date, or today if omitted.

### `index`
Display the master index at `.agents/index.md`.

### `search <term>`
Search all journal entries for the term.

## Entry Format

```markdown
# YYYY-MM-DD

> **tagline goes here**

## Section

Content...
```

## Index Format

```markdown
| Date | Tagline |
|------|---------|
| [YYYY-MM-DD](val/journal/YYYY-MM-DD.md) | tagline |
```

## Signature

All journal entries authored by:
```
Co-Authored-By: Val <val@maidens.ai>
```
