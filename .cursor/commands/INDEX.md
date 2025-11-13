# Cursor Commands Index

Complete guide to all available Cursor slash commands, organized by category.

## Quick Navigation

- **[Task Commands](#task-commands)** - Manage individual tasks
- **[Phase Commands](#phase-commands)** - Manage project phases
- **[Templates](#templates)** - Documentation templates
- **[Documentation](#documentation)** - Guides and references

## Task Commands

Located in: `commands/tasks/`

### Create & Organize

- **`/task-create`** - Create new task
  - Location: `tasks/task-create.md`
  - Usage: `/task-create <phase> <id> "<title>" <phaseName>`
  - Creates task file with all metadata
  - Generates short titles automatically
  - Links to parent phase

- **`/task-list`** - List all tasks
  - Location: `tasks/task-list.md`
  - Usage: `/task-list [phaseName]`
  - Shows status breakdown
  - Progress metrics
  - Quick action links

### View & Analyze

- **`/task-show`** - Show task details
  - Location: `tasks/task-show.md`
  - Usage: `/task-show <taskId>`
  - Full task information
  - Relationships (parent, children, blockers)
  - Backlinks to documentation

- **`/task-tree`** - Show task hierarchy
  - Location: `tasks/task-tree.md`
  - Usage: `/task-tree [taskId]`
  - Visual hierarchy tree
  - Status indicators
  - Task relationships

- **`/task-deps`** - Show dependencies
  - Location: `tasks/task-deps.md`
  - Usage: `/task-deps <taskId>`
  - Upstream/downstream dependencies
  - Blocking analysis
  - Unblocking strategies

### Manage & Track

- **`/task-status`** - Update task status
  - Location: `tasks/task-status.md`
  - Usage: `/task-status <taskId> <status>`
  - Valid: pending, in_progress, completed, blocked, cancelled
  - Auto-completes tasks
  - Updates progress metrics

- **`/task-report`** - Generate task report
  - Location: `tasks/task-report.md`
  - Usage: `/task-report [phaseName]`
  - Comprehensive metrics
  - Status breakdown
  - Time tracking analysis

- **`/task-validate`** - Validate tasks
  - Location: `tasks/task-validate.md`
  - Usage: `/task-validate`
  - Checks consistency
  - Validates relationships
  - Reports errors/warnings

### Help

- **`/task`** - Task command overview
  - Location: `task.md` (root)
  - Help and navigation
  - Quick workflow guide
  - Available commands

## Phase Commands

Located in: `commands/phases/`

### Create & Manage

- **`/phase-create`** - Create new phase
  - Location: `phases/phase-create.md`
  - Guided phase creation
  - Directory structure
  - Documentation setup

- **`/phase-list`** - List all phases
  - Location: `phases/phase-list.md`
  - All phases with progress
  - Status breakdown
  - Quick actions

### View & Analyze

- **`/phase-show`** - Show phase details
  - Location: `phases/phase-show.md`
  - Usage: `/phase-show <phaseName>`
  - Full phase information
  - Progress metrics
  - Critical path

- **`/phase-tree`** - Show phase hierarchy
  - Location: `phases/phase-tree.md`
  - Usage: `/phase-tree <phaseName>`
  - All tasks in phase
  - Status indicators
  - Statistics

- **`/phase-report`** - Generate phase report
  - Location: `phases/phase-report.md`
  - Usage: `/phase-report [phaseName]`
  - Comprehensive analysis
  - Health status
  - Recommendations

### Manage & Progress

- **`/phase-next`** - Transition to next phase
  - Location: `phases/phase-next.md`
  - Usage: `/phase-next <phaseName>`
  - Validates readiness
  - Checks for blockers
  - Guides transition

### Help

- **`/phase`** - Phase command overview
  - Location: `phase.md` (root)
  - Phase management guide
  - Available commands
  - Quick workflow

## Templates

Located in: `commands/templates/`

### Documentation Templates

- **[TASK_TEMPLATE.md](templates/TASK_TEMPLATE.md)** - Task file structure
  - Front matter fields
  - Content sections
  - Examples (root, subtask, dependent)
  - Best practices

- **[PHASE_TEMPLATE.md](templates/PHASE_TEMPLATE.md)** - Phase structure
  - Directory layout
  - `phase.json` format
  - `README.md` template
  - Field reference
  - Phase lifecycle

- **[PHASE_DOCUMENTATION_GUIDE.md](templates/PHASE_DOCUMENTATION_GUIDE.md)** - Documentation standards
  - README structure
  - Writing guidelines
  - Examples
  - Maintenance schedule
  - Optional files (PROGRESS, DECISIONS, RISKS)

### Usage

Templates are referenced by commands:
- `/task-create` uses TASK_TEMPLATE
- `/phase-create` uses PHASE_TEMPLATE
- Phase creation uses PHASE_DOCUMENTATION_GUIDE

## Documentation

Located in: root `.cursor/` directory

### Getting Started

- **[README.md](../README.md)** - Overview and quick start
- **[SETUP_GUIDE.md](../SETUP_GUIDE.md)** - Installation and configuration
- **[SHELL_SETUP.md](../SHELL_SETUP.md)** - Shell command setup

### Command Guides

- **[COMMAND_SUMMARY.md](../COMMAND_SUMMARY.md)** - Complete command reference
- **[TASK_COMMANDS.md](../TASK_COMMANDS.md)** - Detailed task commands guide
- **[PHASE_COMMANDS.md](../PHASE_COMMANDS.md)** - Detailed phase commands guide

### Features

- **[ENRICHED_COMMANDS.md](../ENRICHED_COMMANDS.md)** - Backlinks and context
- **[CURSOR_COMMANDS.md](../CURSOR_COMMANDS.md)** - Cursor slash commands
- **[SLASH_COMMANDS.md](../SLASH_COMMANDS.md)** - Legacy shell commands

## Command Features

### All Commands Include

✅ **Enriched Context**
- Links to related items
- Documentation references
- Command suggestions

✅ **Smart Navigation**
- Quick action links
- Related commands
- Workflow guidance

✅ **Progress Tracking**
- Status indicators
- Metrics and percentages
- Time tracking

✅ **Intelligent Recommendations**
- What to do next
- Blockers to resolve
- Priorities to focus on

## Directory Structure

```
.cursor/
├── commands/
│   ├── tasks/              # 8 task commands
│   ├── phases/             # 6 phase commands
│   ├── templates/          # 4 templates
│   ├── task.md
│   ├── phase.md
│   ├── commands.json
│   ├── README.md
│   └── INDEX.md (this file)
├── scripts/                # 8 implementation scripts
├── README.md
├── COMMAND_SUMMARY.md
├── TASK_COMMANDS.md
├── PHASE_COMMANDS.md
└── [other guides...]
```

## Quick Command Reference

### Most Used

```
/task-list              # See all tasks
/task-show 01-001       # View task details
/task-status 01-001 in_progress  # Start working
/phase-list             # See all phases
/phase-report foundation # Check progress
```

### For Project Overview

```
/phase-list
/phase-show foundation
/task-tree
/task-report foundation
```

### For Daily Work

```
/task-list foundation
/task-status 01-001 in_progress
/task-show 01-001-001
/task-deps 01-001
```

### For Management

```
/phase-report foundation
/task-validate
/phase-next foundation
```

## Related Project Documentation

### Task System

- `packages/cms/tasks/TASKS.md` - Task system guide
- `packages/cms/tasks/NAMING.md` - Naming conventions
- `packages/cms/tasks/SHORT_TITLES.md` - Short title guide

### Project Structure

- `packages/cms/` - CMS package root
- `packages/cms/tasks/` - Task storage
- `packages/cms/tasks/phase-0X-*/` - Phase directories

## Getting Help

1. **Quick overview**: See `.cursor/README.md`
2. **Specific command**: Check `commands/{type}/{command}.md`
3. **Best practices**: See `commands/templates/`
4. **All commands**: See `COMMAND_SUMMARY.md`

## Tips & Tricks

✅ **Start with list commands** for overview
✅ **Use short titles** for quick referencing
✅ **Follow backlinks** to navigate system
✅ **Check progress regularly** with reports
✅ **Validate** before major changes

---

**Version**: 1.0
**Last Updated**: 2024-11-13
**Commands**: 16 total (8 task + 6 phase + 1 meta)

