# Phase Template

Template for creating new phase directories and documentation.

## Directory Structure

Create a new phase directory:

```
phase-{number}-{snake-case-name}/
├── README.md
├── phase.json
├── {number}-{taskid}-taskname.md
├── {number}-{taskid}-taskname/
│   ├── {number}-{taskid}-{subtaskid}-subtaskname.md
│   └── ...
└── ...
```

## phase.json Template

Metadata file for phase configuration:

```json
{
  "id": 1,
  "name": "foundation",
  "displayName": "Phase 1: Foundation",
  "description": "Foundation layer (L1) for archetype system",
  "status": "active",
  "order": 1,
  "createdAt": "2024-11-13",
  "startDate": null,
  "targetCompletionDate": null,
  "completedDate": null,
  "estimatedHours": 8,
  "actualHours": 0,
  "version": "1.0.0",
  "dependencies": [],
  "tags": ["foundation", "schema"],
  "notes": "Foundation work for all archetypes"
}
```

## README.md Template

Phase documentation and overview:

```markdown
# Phase {number}: {Display Name}

## Overview

{Description of what this phase accomplishes}

## Purpose

{Why this phase exists}

## Objectives

- [ ] Objective 1
- [ ] Objective 2
- [ ] Objective 3

## Scope

{What is included in this phase}

## Key Deliverables

- Deliverable 1
- Deliverable 2
- Deliverable 3

## Tasks

See task list below or run: `/task-list {phaseName}`

## Metrics

| Metric | Value |
|--------|-------|
| Total Tasks | X |
| Estimated Time | X hours |
| Actual Time | X hours |
| Completion | X% |

## Status

- 📊 **Overall Status**: [Active/Pending/Complete/Blocked]
- ⏳ **Phase Progress**: X% complete
- 🚧 **Blockers**: [None/Listed]
- 📅 **Timeline**: [Details]

## Dependencies

### From Previous Phases

- [Phase N-1 Task](../phase-0N-1-xxx/)

### Within This Phase

- Task XX-XXX depends on Task XX-YYY
- [Other dependencies]

## Related Documentation

- [Task System Guide](../../TASKS.md)
- [Naming Conventions](../../NAMING.md)
- [Short Titles Guide](../../SHORT_TITLES.md)

## Progress Log

- **2024-11-13**: Phase created
- **YYYY-MM-DD**: Milestone achieved

## Notes

{Additional notes about the phase}

## Next Phase

See: [Phase {number+1}: {Next Phase Name}](../phase-{number+1:02d}-{next-phase-name}/)

---

**Commands:**
- View phase details: `/phase-show {phaseName}`
- View tasks: `/task-list {phaseName}`
- View task tree: `/phase-tree {phaseName}`
- Generate report: `/phase-report {phaseName}`
```

## phase.json Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | Phase number (1, 2, 3...) |
| `name` | string | snake_case name |
| `displayName` | string | User-friendly name |
| `description` | string | Phase purpose |
| `status` | string | pending/active/complete/blocked |
| `order` | number | Execution order |
| `createdAt` | string | Creation date (YYYY-MM-DD) |
| `startDate` | string/null | When phase started |
| `targetCompletionDate` | string/null | Target completion |
| `completedDate` | string/null | Actual completion |
| `estimatedHours` | number | Total estimated hours |
| `actualHours` | number | Total actual hours |
| `version` | string | Phase version |
| `dependencies` | array | IDs of dependent phases |
| `tags` | array | Phase tags/categories |
| `notes` | string | Additional notes |

## Example: Phase 1 (foundation)

### phase.json
```json
{
  "id": 1,
  "name": "foundation",
  "displayName": "Phase 1: Foundation",
  "description": "Foundation layer (L1) for archetype system",
  "status": "active",
  "order": 1,
  "createdAt": "2024-11-13",
  "startDate": null,
  "targetCompletionDate": "2024-11-30",
  "completedDate": null,
  "estimatedHours": 8,
  "actualHours": 0,
  "version": "1.0.0",
  "dependencies": [],
  "tags": ["foundation", "schema", "l1"],
  "notes": "Base layer for all archetypes"
}
```

### README.md Structure
```
# Phase 1: Foundation

## Overview
Foundation layer (L1) for archetype system

## Objectives
- [ ] Implement BaseArchetype class
- [ ] Add TypeScript types
- [ ] Create schema mapping

## Tasks
- 01-001 - Complete BaseArchetype
- 01-001-001 - Implement class structure
- 01-002 - Add types

## Metrics
Total Tasks: 3
Estimated: 8 hours
Completion: 33%
```

## Creating a New Phase

1. **Create directory**:
   ```bash
   mkdir -p phase-02-metadata-annotations
   ```

2. **Create phase.json**:
   - Copy template above
   - Update fields with phase info
   - Set correct id, name, number

3. **Create README.md**:
   - Copy template above
   - Fill in objectives, deliverables
   - Add task list

4. **Create initial tasks**:
   ```
   /task-create 2 001 "First Task" metadata-annotations
   ```

5. **Link to system**:
   - Ensure phase appears in `/phase-list`
   - Update previous phase's "Next Phase" link
   - Update main documentation

## Phase Lifecycle

1. **Creation** (pending)
   - Create directory and files
   - Set status: "pending"
   - Define objectives

2. **Active** (in progress)
   - Create tasks
   - Start working
   - Update progress
   - Status: "active"

3. **Complete** (done)
   - All tasks finished
   - Status: "complete"
   - Set completedDate

4. **Archive** (optional)
   - Move old phases
   - Update links
   - Keep for reference

## Tips

✅ **Do:**
- Keep phase names descriptive
- Use snake_case for directory names
- Document objectives clearly
- Track time and progress
- Link to related phases

❌ **Don't:**
- Use camelCase for directory names
- Leave objectives empty
- Create tasks without phase context
- Forget to update README

---

See: [PHASE_DOCUMENTATION_GUIDE.md](PHASE_DOCUMENTATION_GUIDE.md) for detailed guidelines.

