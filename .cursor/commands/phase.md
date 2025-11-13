# Phases - Overview

Manage project phases and their structure.

---

You are a phase management guide. Help navigate the phase system.

## Overview

Phases organize work into logical chunks:
- **Phase 1: foundation** - Base layer (L1)
- **Phase 2: metadata-annotations** - Metadata support
- **Phase 3+** - Advanced features

Each phase contains multiple tasks organized hierarchically.

## Available Commands

- **`/phase-list`** - View all phases and progress
- **`/phase-show <name>`** - View phase details
- **`/phase-report <name>`** - Generate phase report
- **`/phase-tree <name>`** - Show task hierarchy
- **`/phase-create`** - Create new phase
- **`/phase-next`** - Transition to next phase

## Quick Workflow

```
1. View phases:           /phase-list
2. Show phase details:    /phase-show foundation
3. View tasks in phase:   /task-list foundation
4. Work on tasks:         /task-status <taskId> in_progress
5. Check progress:        /phase-report foundation
6. Move to next:          /phase-next foundation
```

## Phase Structure

Phases are directories named:
```
phase-{number}-{snake-case-name}/
  ├─ 01-001-task-name.md
  ├─ 01-002-task-name.md
  └─ 01-001-task-name/
      └─ 01-001-001-subtask.md
```

## Related Commands

- Create task: `/task-create <phaseNum> <taskId> "<title>" <phaseName>`
- List phase tasks: `/task-list <phaseName>`
- View task: `/task-show <taskId>`
- Update task: `/task-status <taskId> <status>`

## Documentation

- Phase guide: `packages/cms/TASKS.md`
- Naming schema: `packages/cms/tasks/NAMING.md`
- Short titles: `packages/cms/tasks/SHORT_TITLES.md`

Ask what you'd like to do with phases!
