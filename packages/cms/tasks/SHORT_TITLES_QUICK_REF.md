# Short Titles - Quick Reference

**Quick addressing system for tasks using kebab-case short titles.**

## Format

```
kebab-case, 3 words max, 30 chars max
```

Examples:
- ✅ `complete-base-archetype`
- ✅ `implement-archetype-class`
- ✅ `add-types`
- ❌ `CompleteBaseArchetype` (camelCase)
- ❌ `complete-base-archetype-implementation` (too many words)

## Your Current Tasks

| ID | Short Title | Full Title |
|----|-------------|-----------|
| 01-001 | `complete-base-archetype` | Complete BaseArchetype |
| 01-001-001 | `implement-archetype-class` | Implement BaseArchetype class structure |

## Usage

In front matter:
```yaml
---
id: "01-001"
title: "Complete BaseArchetype"
shortTitle: "complete-base-archetype"
---
```

Generate from title in code:
```typescript
import { toShortTitle } from './types';
const short = toShortTitle("Complete BaseArchetype");
// → "complete-base-archetype"
```

## Rules

1. **Lowercase** - no capitals
2. **Hyphens only** - no underscores or spaces
3. **Alphanumeric + hyphens** - no special chars
4. **Max 3 words** - keep concise
5. **Max 30 chars** - length limit

## See Also

- `SHORT_TITLES.md` - Full guide with examples and strategy
- `types.ts` - Helper functions (`toShortTitle`, `isValidShortTitle`, `createShortTitle`)
- `schema.json` - Validation rules

