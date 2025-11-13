# Task Template - Command Guide

Reference template for task creation in Cursor commands.

## Task File Template

Location: `packages/cms/tasks/phase-0X-{name}/{XX}-{XXX}-{title}.md`

```yaml
---
id: "XX-XXX"
title: "Task Title"
shortTitle: "task-title"
status: pending
phase: X
phaseName: "snake-case-phase-name"
priority: medium
parent: null
children: []
dependsOn: []
blocks: []
assignee: null
labels: []
estimatedHours: 0
actualHours: 0
startDate: null
dueDate: null
completedDate: null
relatedTasks: []
relatedDocs: []
relatedIssues: []
notes: ""
---

# Task Title

## Overview

Brief description of what this task accomplishes.

## Objectives

- [ ] Objective 1
- [ ] Objective 2
- [ ] Objective 3

## Requirements

- Requirement 1
- Requirement 2

## Implementation Details

### Step 1: Description
What needs to be done...

### Step 2: Description
What needs to be done...

## Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Dependencies

- Depends on: [Task XX-XXX](./XX-XXX.md)
- Blocks: [Task XX-XXX](./XX-XXX.md)

## Related Tasks

- [Subtask XX-XXX-XXX](./XX-XXX-XXX.md)

## Notes

Additional notes, decisions, or context.

## Progress Log

- **YYYY-MM-DD**: Task created
- **YYYY-MM-DD**: Started implementation
- **YYYY-MM-DD**: Completed step 1

## References

- [Documentation Link](https://example.com/docs)
- [Related Issue #123](https://github.com/org/repo/issues/123)
```

## Using the Task Template

In Cursor commands, reference this template:

```bash
/task-create <phase> <id> "<title>" <phaseName>
```

The template automatically:
1. Fills in ID and title
2. Sets phase information
3. Initializes metadata
4. Prepares structure

## Examples

### Example 1: Root Task

```yaml
---
id: "01-001"
title: "Complete BaseArchetype"
shortTitle: "complete-base-archetype"
status: pending
phase: 1
phaseName: "foundation"
priority: high
parent: null
children: ["01-001-001"]
---
```

### Example 2: Subtask

```yaml
---
id: "01-001-001"
title: "Implement BaseArchetype class"
shortTitle: "implement-archetype-class"
status: pending
phase: 1
phaseName: "foundation"
priority: high
parent: "01-001"
children: []
---
```

### Example 3: Task with Dependencies

```yaml
---
id: "01-002"
title: "Add TypeScript types"
shortTitle: "add-typescript-types"
status: pending
phase: 1
phaseName: "foundation"
priority: medium
dependsOn: ["01-001"]
blocks: ["01-003"]
---
```

## Fields Reference

| Field | Required | Format | Example |
|-------|----------|--------|---------|
| `id` | Yes | XX-XXX[-XXX] | 01-001 |
| `title` | Yes | String | Complete BaseArchetype |
| `shortTitle` | Yes | kebab-case, 3 words | complete-base-archetype |
| `status` | Yes | pending/in_progress/completed/blocked/cancelled | pending |
| `phase` | Yes | Number | 1 |
| `phaseName` | Yes | snake-case | foundation |
| `priority` | Yes | low/medium/high/critical | high |
| `parent` | No | XX-XXX or null | 01-001 |
| `children` | No | Array of XX-XXX | ["01-001-001"] |
| `dependsOn` | No | Array of XX-XXX | ["01-001"] |
| `blocks` | No | Array of XX-XXX | ["01-002"] |
| `estimatedHours` | No | Number | 8 |
| `actualHours` | No | Number | 0 |
| `startDate` | No | YYYY-MM-DD or null | 2024-11-13 |
| `dueDate` | No | YYYY-MM-DD or null | 2024-11-20 |
| `completedDate` | No | YYYY-MM-DD or null | null |

## Creating Tasks with Commands

```
/task-create 1 001 "Complete BaseArchetype" foundation
```

Automatically:
- Sets id: 01-001
- Sets title: Complete BaseArchetype
- Sets shortTitle: complete-base-archetype
- Sets phase: 1
- Sets phaseName: foundation
- Initializes other fields

## Helper Functions

```typescript
import { toShortTitle, titleToFilename } from './types';

// Auto-generate short title
const short = toShortTitle("Complete BaseArchetype");
// → "complete-base-archetype"

// Generate filename
const filename = titleToFilename("Complete BaseArchetype");
// → "complete-base-archetype"
```

## Best Practices

✅ **Do:**
- Use clear, action-oriented titles
- Write detailed objectives
- Link related tasks
- Track time estimates
- Update progress log

❌ **Don't:**
- Use vague titles
- Leave objectives empty
- Create orphaned tasks
- Ignore dependencies
- Forget to set shortTitle

---

See: [../../packages/cms/tasks/template.md](../../packages/cms/tasks/template.md) for the actual template file.

