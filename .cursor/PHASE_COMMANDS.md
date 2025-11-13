# Phase Management Commands

Cursor slash commands for managing project phases.

## Available Commands

Type `/` in Cursor Agent chat to see:

- **`/phase`** — Phase management overview
- **`/phase-list`** — View all phases and progress
- **`/phase-show`** — Show phase details
- **`/phase-report`** — Generate phase report
- **`/phase-tree`** — Show phase task hierarchy
- **`/phase-create`** — Create new phase
- **`/phase-next`** — Transition to next phase

## Quick Reference

### List Phases
```
/phase-list
```
Shows all phases with:
- Phase number and name
- Task counts by status
- Completion percentage
- Time tracking
- Quick action links

### Show Phase Details
```
/phase-show foundation
```
Displays:
- Phase information and purpose
- Progress metrics
- Task breakdown
- Time analysis
- Actionable recommendations

### Phase Report
```
/phase-report foundation
```
Comprehensive report:
- Overall health status
- Progress analysis
- Resource utilization
- Blockers and issues
- Performance metrics

### Phase Task Tree
```
/phase-tree foundation
```
Visual hierarchy:
- All tasks in phase
- Status indicators
- Nesting structure
- Critical paths
- Task links

### Create New Phase
```
/phase-create
```
Guided phase creation:
- Prompts for phase info
- Creates directory structure
- Links to previous phases
- Suggests first tasks

### Transition Phases
```
/phase-next foundation
```
Safe phase transition:
- Validates readiness
- Checks for incomplete tasks
- Shows transition plan
- Identifies blockers

## Examples

### Workflow 1: Check Project Status
```
/phase-list
→ Shows: All phases, foundation 0% complete
→ Suggests: Start foundation phase

/phase-show foundation
→ Shows: 2 tasks, both pending
→ Suggests: Begin with 01-001

/task-create 1 001 "Setup" foundation
→ Creates first task

/task-status 01-001 in_progress
→ Marks as started
```

### Workflow 2: Complete Phase and Move On
```
/phase-report foundation
→ Shows: 0% complete, needs work

[Work on tasks...]

/phase-report foundation
→ Shows: 100% complete

/phase-next foundation
→ Validates completion
→ Transitions to metadata-annotations
→ Suggests creating first task in new phase
```

### Workflow 3: Monitor Progress
```
/phase-list
→ Foundation: 50% (1/2 tasks)

/phase-tree foundation
→ Shows which tasks are blocked

/task-deps 01-001
→ Identifies blocker

/task-status <blockerId> completed
→ Unblocks dependent tasks

/phase-report foundation
→ Shows updated progress
```

## Integration with Task Commands

Phase commands work with task commands:

| Task Command | Phase Integration |
|--------------|------------------|
| `/task-create` | Create task in specific phase |
| `/task-list <phase>` | List tasks in phase |
| `/task-show` | Show task with phase context |
| `/task-status` | Update task, affects phase progress |
| `/task-report` | Affects phase metrics |
| `/task-tree` | Tree view of phase tasks |

## Status Indicators

| Indicator | Meaning | Actions |
|-----------|---------|---------|
| 🟢 Complete | Phase finished | Archive or transition |
| 🟡 In Progress | Phase active | Continue work |
| 🔴 Blocked | Phase stuck | Resolve blockers |
| ⚪ Not Started | Phase pending | Begin with `/task-create` |

## Key Concepts

### Phase Structure
Phases organize work into logical blocks:
- Each phase has a number (1, 2, 3...)
- Each phase has a descriptive name (foundation, metadata-annotations)
- Phases contain tasks (01-001, 01-002, etc.)
- Tasks can have subtasks

### Phase Progression
Phases should be completed sequentially:
1. Foundation (L1) - Base layer
2. Metadata-Annotations (L2) - Metadata support
3. Advanced Features (L3+) - Complex functionality

### Phase Readiness
A phase is ready to complete when:
- All tasks are completed or cancelled
- No critical blockers remain
- Time estimates reviewed and tracked

## Documentation

- Full guide: `packages/cms/TASKS.md`
- Task system: `packages/cms/tasks/README.md`
- Naming conventions: `packages/cms/tasks/NAMING.md`
- Short titles: `packages/cms/tasks/SHORT_TITLES.md`
- Task commands: `.cursor/README.md`

---

**Now you can manage phases directly from Cursor!** 🎯

