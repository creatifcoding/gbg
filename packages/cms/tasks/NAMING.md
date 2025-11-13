# Naming Schema Reference

Quick reference for phase and task naming conventions.

## Phase Directory Naming

**Format**: `phase-{number}-{snake-case-name}/`

### Conversion Rules
1. Convert phase description to lowercase
2. Replace spaces and special characters with hyphens `-`
3. Remove leading/trailing hyphens
4. Collapse multiple consecutive hyphens

### Examples

| Phase Description | Directory Name |
|-------------------|----------------|
| Foundation | `phase-01-foundation/` |
| Metadata & Annotations | `phase-02-metadata-annotations/` |
| Advanced Simple Fields | `phase-03-advanced-simple-fields/` |
| Complex Types | `phase-04-complex-types/` |

## Task File Naming

**Format**: `{phase-number}-{task-id}-{snake-case-title}.md`

### Components
- `{phase-number}`: Zero-padded 2-digit number (01, 02, 03, ...)
- `{task-id}`: Zero-padded 3-digit number (001, 002, 003, ...)
- `{snake-case-title}`: Task title converted to snake_case

### Title Conversion Rules
1. Convert to lowercase
2. Replace spaces with hyphens `-`
3. Replace special characters (except hyphens) with hyphens
4. Remove leading/trailing hyphens
5. Collapse multiple consecutive hyphens

### Examples

| Task Title | Filename |
|------------|----------|
| Complete BaseArchetype | `01-001-complete-base-archetype.md` |
| Install @hygraph/management-sdk | `01-002-install-hygraph-management-sdk.md` |
| Support hygraph() helper | `01-003-support-hygraph-helper.md` |
| Create & Update Models | `01-004-create-update-models.md` |
| Implement BaseArchetype class structure | `01-001-001-implement-base-archetype-class.md` |

## Subtask Naming

Subtasks follow the same pattern, appending `-{subtask-id}-{snake-case-title}`:

**Format**: `{phase}-{task-id}-{subtask-id}-{snake-case-title}.md`

### Examples

| Task Title | Parent ID | Subtask Filename |
|------------|-----------|------------------|
| Implement BaseArchetype class structure | 01-001 | `01-001-001-implement-base-archetype-class.md` |
| Create BaseArchetype extending Schema.TaggedClass | 01-001-001 | `01-001-001-001-create-base-archetype-extending-tagged-class.md` |

## Front Matter Requirements

All tasks must include `phaseName` field matching the phase directory:

```yaml
---
id: "01-001"
title: "Complete BaseArchetype"
phase: 1
phaseName: "foundation"  # Must match phase directory (without "phase-01-" prefix)
---
```

## Validation

- **Phase Name**: Must match pattern `^[a-z0-9]+(?:[_-][a-z0-9]+)*$`
- **Task Filename**: Must match pattern `^\d{2}-\d{3}(-\d{3})*-[a-z0-9]+(?:-[a-z0-9]+)*\.md$`
- **Phase Consistency**: `phaseName` must match phase directory name

## Helper Functions

Use TypeScript helpers from `tasks/types.ts`:

```typescript
import { 
  toPhaseName, 
  titleToFilename, 
  generateTaskFilename,
  generatePhaseDirectoryName 
} from './tasks/types';

// Convert phase name
const phaseName = toPhaseName("Foundation"); // "foundation"

// Convert title to filename
const filename = titleToFilename("Complete BaseArchetype"); // "complete-base-archetype"

// Generate complete filenames
const taskFile = generateTaskFilename("01-001", "Complete BaseArchetype");
// "01-001-complete-base-archetype.md"

const phaseDir = generatePhaseDirectoryName(1, "foundation");
// "phase-01-foundation"
```

## See Also

- [TASKS.md](../TASKS.md) - Full task management documentation
- [types.ts](./types.ts) - TypeScript type definitions and helpers

