# Tasks Directory

This directory contains all tasks organized by phase.

## Structure

```
tasks/
├── phase-01-foundation/          # Phase 1: Foundation
├── phase-02-metadata-annotations/ # Phase 2: Metadata & Annotations
├── template.md                    # Task template
└── README.md                      # This file
```

## Quick Start

1. Determine phase name and create/verify phase directory: `phase-{number}-{snake-case-name}/`
2. Copy `template.md` to create a new task
3. Follow the naming convention: `{phase}-{task-id}-{snake-case-title}.md`
4. Fill in front matter including `phaseName` field
5. Update parent task's `children` array
6. Link dependencies

## Naming Convention

### Phase Directories
- **Format**: `phase-{number}-{snake-case-name}/`
- **Examples**: `phase-01-foundation/`, `phase-02-metadata-annotations/`

### Task Files
- **Format**: `{phase-number}-{task-id}-{snake-case-title}.md`
- **Phase**: Zero-padded 2-digit number (01, 02, 03, ...)
- **Task ID**: Zero-padded 3-digit number (001, 002, 003, ...)
- **Title**: Task title converted to snake_case (lowercase, hyphens)
- **Subtasks**: Append `-{subtask-id}-{snake-case-title}` (001-001-implement-class, 001-001-001-create-class, ...)

**Examples**:
- `01-001-complete-base-archetype.md` - Phase 1, Task 1: "Complete BaseArchetype"
- `01-001-001-implement-base-archetype-class.md` - Phase 1, Task 1, Subtask 1: "Implement BaseArchetype class structure"
- `01-001-001-001-create-base-archetype-extending-tagged-class.md` - Phase 1, Task 1, Subtask 1, Sub-subtask 1

## Status Values

- `pending` - Not started
- `in_progress` - Currently being worked on
- `completed` - Finished
- `blocked` - Blocked by dependency or issue
- `cancelled` - Cancelled/abandoned

## Priority Values

- `low` - Nice to have
- `medium` - Normal priority
- `high` - Important
- `critical` - Blocking or urgent

## Schema & Types

- **JSON Schema**: [schema.json](./schema.json) - JSON Schema for front matter validation
- **TypeScript Types**: [types.ts](./types.ts) - TypeScript type definitions
- **Lint Config**: [.tasklintrc.json](./.tasklintrc.json) - Task linting configuration

## Examples

- [Example Task](./phase-01-foundation/01-001-complete-base-archetype.md) - Complete BaseArchetype (top-level task)
- [Example Subtask](./phase-01-foundation/01-001-001-implement-base-archetype-class.md) - Implement BaseArchetype class structure

## See Also

- [TASKS.md](../TASKS.md) - Full task management system documentation
- [NAMING.md](./NAMING.md) - Naming schema quick reference
- [template.md](./template.md) - Task template file

