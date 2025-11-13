# Task Management System

## Overview

Tasks are organized hierarchically: **Phases → Tasks → Subtasks → Sub-subtasks** (unlimited depth).

Each task is a markdown file with YAML front matter and a consistent structure.

## Naming Schema

### Phase Directory Naming

```
phase-{number}-{snake-case-name}
```

**Format**: 
- `{number}`: Zero-padded 2-digit number (01, 02, 03, ...)
- `{snake-case-name}`: Descriptive name in snake_case (lowercase, underscores)

**Examples**:
- `phase-01-foundation` - Phase 1: Foundation
- `phase-02-metadata-annotations` - Phase 2: Metadata & Annotations
- `phase-03-advanced-simple-fields` - Phase 3: Advanced Simple Fields

### Task File Naming Convention

```
{phase-number}-{task-id}-{snake-case-title}.md
```

**Format**: 
- `{phase-number}`: Zero-padded 2-digit number (01, 02, 03, ...)
- `{task-id}`: Zero-padded 3-digit number (001, 002, 003, ...)
- `{snake-case-title}`: Task title converted to snake_case (lowercase, underscores, hyphens for readability)

**Title Conversion Rules**:
- Convert to lowercase
- Replace spaces with hyphens `-`
- Replace special characters with hyphens
- Remove leading/trailing hyphens
- Collapse multiple consecutive hyphens

**Examples**:
- `01-001-complete-base-archetype.md` - Phase 1, Task 1: "Complete BaseArchetype"
- `01-002-install-management-sdk.md` - Phase 1, Task 2: "Install Management SDK"
- `01-001-001-implement-base-archetype-class.md` - Phase 1, Task 1, Subtask 1: "Implement BaseArchetype class structure"
- `01-001-001-001-create-base-archetype-extending-tagged-class.md` - Phase 1, Task 1, Subtask 1, Sub-subtask 1

## Short Titles

Each task includes a `shortTitle` field - a concise kebab-case reference (3 words or less):

**Format:** `kebab-case`, max 30 characters, 3 words or less

**Examples:**
- `complete-base-archetype`
- `implement-archetype-class`
- `add-typescript-types`

Use short titles to reference tasks in conversation and documentation.

See [tasks/SHORT_TITLES.md](tasks/SHORT_TITLES.md) for detailed guide.

### Directory Structure

```
tasks/
├── phase-01-foundation/
│   ├── 01-001-complete-base-archetype.md
│   ├── 01-002-install-management-sdk.md
│   └── 01-001-complete-base-archetype/
│       ├── 01-001-001-implement-base-archetype-class.md
│       └── 01-001-001-implement-base-archetype-class/
│           └── 01-001-001-001-create-base-archetype-extending-tagged-class.md
├── phase-02-metadata-annotations/
│   └── 02-001-support-hygraph-helper.md
└── README.md
```

**Note**: Subtasks can be organized in subdirectories matching the parent task's filename (without extension) for better organization, or kept flat in the phase directory.

## Front Matter Schema

### Required Fields

```yaml
---
id: string              # Unique identifier (e.g., "01-001")
title: string           # Task title (human-readable)
status: enum            # pending | in_progress | completed | blocked | cancelled
phase: number           # Phase number (1, 2, 3, ...)
phaseName: string       # Phase name in snake_case (e.g., "foundation")
priority: enum          # low | medium | high | critical
---
```

**Note**: The `phaseName` field should match the phase directory name (without the `phase-{number}-` prefix).

### Optional Fields

```yaml
---
# Hierarchy
parent: string          # ID of parent task (null for top-level)
children: string[]      # Array of child task IDs
siblings: string[]      # Array of sibling task IDs (same parent)

# Dependencies
dependsOn: string[]     # Array of task IDs this depends on
blocks: string[]        # Array of task IDs blocked by this task

# Metadata
assignee: string        # Person/team responsible
labels: string[]        # Tags for categorization
estimatedHours: number  # Time estimate
actualHours: number     # Actual time spent
startDate: date         # ISO 8601 date
dueDate: date          # ISO 8601 date
completedDate: date    # ISO 8601 date

# References
relatedTasks: string[]  # Related task IDs
relatedDocs: string[]  # Related documentation paths
relatedIssues: string[] # Related issue/PR numbers

# Notes
notes: string           # Internal notes (not in body)
---
```

### Status Values

- `pending` - Not started
- `in_progress` - Currently being worked on
- `completed` - Finished
- `blocked` - Blocked by dependency or issue
- `cancelled` - Cancelled/abandoned

### Priority Values

- `low` - Nice to have
- `medium` - Normal priority
- `high` - Important
- `critical` - Blocking or urgent

## Task Layout Template

```markdown
---
id: "01-001"
title: "Task Title"
status: pending
phase: 1
priority: medium
parent: null
children: ["01-001-001", "01-001-002"]
dependsOn: []
blocks: []
assignee: null
labels: []
estimatedHours: 4
startDate: null
dueDate: null
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

- Depends on: [Task 01-000](../01-000.md)
- Blocks: [Task 01-002](../01-002.md)

## Related Tasks

- [Subtask 01-001-001](./01-001-001.md)
- [Subtask 01-001-002](./01-001-002.md)

## Notes

Additional notes, decisions, or context.

## Progress Log

- **2024-01-15**: Task created
- **2024-01-16**: Started implementation
- **2024-01-17**: Completed step 1

## References

- [Documentation Link](https://example.com/docs)
- [Related Issue #123](https://github.com/org/repo/issues/123)
```

## Task Creation Workflow

1. **Determine Phase**: Identify which phase this task belongs to
2. **Get Phase Name**: Convert phase description to snake_case (e.g., "Foundation" → "foundation")
3. **Create/Verify Phase Directory**: Ensure `phase-{number}-{snake-case-name}/` exists
4. **Convert Title to Filename**: Convert task title to snake_case for filename
5. **Create Task File**: Use naming convention `{phase}-{task-id}-{snake-case-title}.md`
6. **Add Front Matter**: Fill in required fields including `phaseName`, add optional fields as needed
7. **Write Content**: Use the layout template
8. **Link Hierarchy**: Update parent task's `children` array and this task's `parent`
9. **Link Dependencies**: Update `dependsOn` and `blocks` arrays
10. **Update Status**: Change status as work progresses

### Title to Filename Conversion

**Rules**:
- Convert to lowercase
- Replace spaces with hyphens `-`
- Replace special characters (except hyphens) with hyphens
- Remove leading/trailing hyphens
- Collapse multiple consecutive hyphens

**Examples**:
- "Complete BaseArchetype" → `complete-base-archetype`
- "Install @hygraph/management-sdk" → `install-hygraph-management-sdk`
- "Support hygraph() helper" → `support-hygraph-helper`
- "Create & Update Models" → `create-update-models`

## Task Status Workflow

```
pending → in_progress → completed
   ↓
blocked → in_progress → completed
   ↓
cancelled
```

## Validation Rules

1. **ID Uniqueness**: Each task ID must be unique across all phases
2. **Filename Consistency**: Task filename must match pattern `{phase}-{task-id}-{snake-case-title}.md` where `{snake-case-title}` matches the title converted to snake_case
3. **Phase Name Consistency**: `phaseName` must match the phase directory name (without `phase-{number}-` prefix)
4. **Parent-Child Consistency**: If task A lists task B in `children`, task B must list task A in `parent`
5. **Dependency Consistency**: If task A depends on task B, task B should list task A in `blocks` (optional but recommended)
6. **Status Consistency**: Completed tasks should have `completedDate` set
7. **Phase Consistency**: All subtasks must have same `phase` and `phaseName` as parent

## Examples

### Top-Level Task

```markdown
---
id: "01-001"
title: "Complete BaseArchetype"
status: pending
phase: 1
phaseName: "foundation"
priority: high
parent: null
children: ["01-001-001", "01-001-002"]
---
```

**File**: `tasks/phase-01-foundation/01-001-complete-base-archetype.md`

### Subtask

```markdown
---
id: "01-001-001"
title: "Implement BaseArchetype class structure"
status: pending
phase: 1
phaseName: "foundation"
priority: high
parent: "01-001"
children: []
dependsOn: []
---
```

**File**: `tasks/phase-01-foundation/01-001-001-implement-base-archetype-class.md`

### Sub-subtask

```markdown
---
id: "01-001-001-001"
title: "Create BaseArchetype extending Schema.TaggedClass"
status: pending
phase: 1
phaseName: "foundation"
priority: high
parent: "01-001-001"
children: []
dependsOn: []
---
```

**File**: `tasks/phase-01-foundation/01-001-001-001-create-base-archetype-extending-tagged-class.md`

## Helper Functions

The TypeScript types file (`tasks/types.ts`) provides utility functions:

### Phase Name Conversion

```typescript
import { toPhaseName } from './tasks/types';

// Convert human-readable phase name to snake_case
const phaseName = toPhaseName("Foundation"); // "foundation"
const phaseName2 = toPhaseName("Metadata & Annotations"); // "metadata-annotations"
```

### Title to Filename Conversion

```typescript
import { titleToFilename } from './tasks/types';

// Convert task title to filename-safe format
const filename = titleToFilename("Complete BaseArchetype"); // "complete-base-archetype"
const filename2 = titleToFilename("Install @hygraph/management-sdk"); // "install-hygraph-management-sdk"
```

### Generate Filenames

```typescript
import { generateTaskFilename, generatePhaseDirectoryName } from './tasks/types';

// Generate task filename
const taskFile = generateTaskFilename("01-001", "Complete BaseArchetype");
// "01-001-complete-base-archetype.md"

// Generate phase directory name
const phaseDir = generatePhaseDirectoryName(1, "foundation");
// "phase-01-foundation"
```

## Tools & Automation

### Task Generator Script

```bash
# Generate new task
./scripts/create-task.sh phase-01-foundation 001 "Complete BaseArchetype"
```

### Task Validator Script

```bash
# Validate all tasks
./scripts/validate-tasks.sh
```

### Task Status Report

```bash
# Generate status report
./scripts/task-report.sh phase-01-foundation
```

## Best Practices

1. **Keep Tasks Focused**: Each task should accomplish one clear objective
2. **Update Status Regularly**: Keep status current as work progresses
3. **Document Decisions**: Use Notes section for important decisions
4. **Link Related Work**: Use `relatedTasks`, `relatedDocs`, `relatedIssues`
5. **Estimate Realistically**: Use `estimatedHours` for planning
6. **Track Actual Time**: Update `actualHours` for retrospectives
7. **Break Down Large Tasks**: Create subtasks for tasks > 8 hours
8. **Document Blockers**: Use `blocked` status and notes to explain why

## Migration from Current Plan

To migrate existing plan items to this system:

1. Create `tasks/` directory
2. Identify phase names and create phase directories (`phase-01-foundation/`, `phase-02-metadata-annotations/`, etc.)
3. Convert each plan item to a task file with descriptive filename
4. Add `phaseName` field to front matter
5. Establish parent-child relationships
6. Add dependencies
7. Set initial statuses

### Phase Name Examples

- Phase 1: "Foundation" → `phase-01-foundation`
- Phase 2: "Metadata & Annotations" → `phase-02-metadata-annotations`
- Phase 3: "Advanced Simple Fields" → `phase-03-advanced-simple-fields`

---

**Last Updated**: 2024-11-12
**Status**: Draft - Ready for Implementation

