# Task Management Commands

This directory contains tools for interacting with the task management system.

## Quick Start: Slash Commands

Add this to your shell profile (`~/.zshrc` or `~/.bashrc`):

```bash
source /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/shell-init.sh
```

Then use slash commands:

```bash
/list                                        # List all tasks
/list foundation                             # List foundation phase tasks
/show 01-001                                 # Show task details
/create 1 002 "New Task" foundation          # Create task
/status 01-001 in_progress                   # Update status
/validate                                    # Validate all tasks
/report foundation                           # Generate report
/tree                                        # Show task tree
/deps 01-001                                 # Show dependencies
```

## Commands

### Option 1: Slash Commands (Recommended)
Use slash commands in your terminal after sourcing `shell-init.sh` (see Quick Start above).

### Option 2: Direct CLI
Use the `task` wrapper script directly:

```bash
/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task list
/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task create 1 001 "Task" foundation
```

Or add to PATH:
```bash
export PATH="/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor:$PATH"
task list
```

### Option 3: Cursor Commands (Legacy)
Available via Cursor's command palette (Cmd/Ctrl+Shift+P).

### `task:create`
Create a new task file with proper naming and front matter.

**Inputs:**
- `phaseNumber`: Phase number (e.g., `1`)
- `taskId`: Task ID within phase (e.g., `001`)
- `title`: Task title (e.g., `"Complete BaseArchetype"`)
- `phaseName`: Phase name in snake_case (e.g., `foundation`)
- `parentId` (optional): Parent task ID if creating a subtask

**Example:**
```
task:create 1 001 "Complete BaseArchetype" foundation
```

### `task:list`
List all tasks in a phase or across all phases.

**Inputs:**
- `phaseName` (optional): Filter by phase name (e.g., `foundation`)

**Example:**
```
task:list foundation
```

### `task:show`
Show detailed information about a specific task.

**Inputs:**
- `taskId`: Task ID (e.g., `01-001`)

**Example:**
```
task:show 01-001
```

### `task:status`
Update a task's status.

**Inputs:**
- `taskId`: Task ID (e.g., `01-001`)
- `status`: New status (`pending`, `in_progress`, `completed`, `blocked`, `cancelled`)

**Example:**
```
task:status 01-001 in_progress
```

### `task:validate`
Validate all task files for consistency and correctness.

**No inputs required.**

**Example:**
```
task:validate
```

### `task:report`
Generate a status report for tasks.

**Inputs:**
- `phaseName` (optional): Filter by phase name

**Example:**
```
task:report foundation
```

### `task:tree`
Show the task hierarchy tree.

**Inputs:**
- `taskId` (optional): Show tree for specific task, or all root tasks if omitted

**Example:**
```
task:tree 01-001
```

### `task:dependencies`
Show the dependency graph for a task.

**Inputs:**
- `taskId`: Task ID

**Example:**
```
task:dependencies 01-001
```

## Scripts

Scripts are located in `.cursor/scripts/` and can also be run directly from the command line:

```bash
node .cursor/scripts/list-tasks.js foundation
node .cursor/scripts/show-task.js 01-001
node .cursor/scripts/update-status.js 01-001 in_progress
```

## Directory Structure

```
.cursor/
├── commands/
│   ├── tasks/              # Task management commands
│   │   ├── task-create.md
│   │   ├── task-list.md
│   │   ├── task-show.md
│   │   ├── task-status.md
│   │   ├── task-validate.md
│   │   ├── task-report.md
│   │   ├── task-tree.md
│   │   └── task-deps.md
│   ├── phases/             # Phase management commands
│   │   ├── phase-list.md
│   │   ├── phase-show.md
│   │   ├── phase-report.md
│   │   ├── phase-tree.md
│   │   ├── phase-create.md
│   │   └── phase-next.md
│   ├── templates/          # Documentation templates
│   │   ├── TASK_TEMPLATE.md
│   │   ├── PHASE_TEMPLATE.md
│   │   ├── PHASE_DOCUMENTATION_GUIDE.md
│   │   └── README.md
│   ├── task.md             # Task overview
│   ├── phase.md            # Phase overview
│   ├── commands.json       # Cursor command definitions (legacy)
│   └── README.md           # Commands directory guide
├── scripts/                # CLI implementation scripts
│   ├── create-task.js
│   ├── list-tasks.js
│   ├── show-task.js
│   ├── update-status.js
│   ├── validate-tasks.js
│   ├── task-report.js
│   ├── task-tree.js
│   └── task-dependencies.js
├── task                    # Main CLI wrapper
├── shell-init.sh          # Shell command initialization
├── README.md              # This file
├── CURSOR_COMMANDS.md     # Cursor slash commands guide
├── PHASE_COMMANDS.md      # Phase commands guide
├── COMMAND_SUMMARY.md     # Complete command reference
├── ENRICHED_COMMANDS.md   # Backlinks & context guide
├── SLASH_COMMANDS.md      # Legacy slash commands
├── SETUP_GUIDE.md         # Setup instructions
└── SHELL_SETUP.md         # Shell setup guide
```

## Files

- `shell-init.sh` — Initialize shell commands (source in ~/.zshrc or ~/.bashrc)
- `task` — Main CLI wrapper script
- `commands/` — Cursor slash commands (organized by category)
- `scripts/` — Individual CLI implementation scripts
- `README.md` — This file
- `COMMAND_SUMMARY.md` — Complete command reference
- `PHASE_COMMANDS.md` — Phase management guide

## Dependencies

- `js-yaml`: For parsing and generating YAML front matter
- `Node.js`: For running the scripts

## See Also

- [Task Management Documentation](../../packages/cms/TASKS.md)
- [Naming Schema](../../packages/cms/tasks/NAMING.md)
- [Detailed Slash Commands Guide](./SLASH_COMMANDS.md)
- [Shell Setup Guide](./SHELL_SETUP.md)

