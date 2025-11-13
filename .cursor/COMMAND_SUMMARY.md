# Cursor Commands Summary

Complete reference for all available slash commands in Cursor Agent.

## Task Commands

Manage individual tasks within phases.

| Command | Purpose | Example |
|---------|---------|---------|
| `/task` | Task help & overview | `/task` |
| `/task-create` | Create new task | `/task-create 1 002 "Title" foundation` |
| `/task-list` | List tasks | `/task-list foundation` |
| `/task-show` | Show task details | `/task-show 01-001` |
| `/task-status` | Update task status | `/task-status 01-001 in_progress` |
| `/task-validate` | Validate all tasks | `/task-validate` |
| `/task-report` | Generate task report | `/task-report foundation` |
| `/task-tree` | Show task hierarchy | `/task-tree` or `/task-tree 01-001` |
| `/task-deps` | Show dependencies | `/task-deps 01-001` |

## Phase Commands

Manage project phases and their progression.

| Command | Purpose | Example |
|---------|---------|---------|
| `/phase` | Phase management overview | `/phase` |
| `/phase-list` | List all phases | `/phase-list` |
| `/phase-show` | Show phase details | `/phase-show foundation` |
| `/phase-report` | Generate phase report | `/phase-report foundation` |
| `/phase-tree` | Show phase task hierarchy | `/phase-tree foundation` |
| `/phase-create` | Create new phase | `/phase-create` |
| `/phase-next` | Transition to next phase | `/phase-next foundation` |

## Common Workflows

### Start New Project
```
1. /phase-list                                # See phases
2. /phase-show foundation                     # View foundation phase
3. /task-create 1 001 "First Task" foundation # Create first task
4. /task-status 01-001 in_progress            # Start working
5. /task-list foundation                      # Check progress
```

### Complete a Phase
```
1. /phase-report foundation          # Check completion status
2. [Work on remaining tasks...]
3. /task-status <taskId> completed   # Mark tasks done
4. /phase-report foundation          # Verify 100% complete
5. /phase-next foundation            # Transition to next phase
```

### Manage Blockers
```
1. /phase-tree foundation            # Show hierarchy
2. /task-deps 01-001                 # Check blockers
3. /task-status <blockerId> completed # Unblock
4. /phase-report foundation          # Verify progress
```

### Quick Reference
```
/phase-list                   # All phases at a glance
/task-list foundation         # Foundation tasks
/task-show 01-001            # Task details with backlinks
/task-status 01-001 in_progress # Start working
/phase-report foundation     # Phase metrics and health
```

## Command Features

### All Commands Include

✅ **Enriched Backlinks**
- Links to related tasks
- Links to documentation
- Links to other commands

✅ **Contextual Navigation**
- Quick action suggestions
- Related command recommendations
- Smart workflow guidance

✅ **Progress Tracking**
- Status indicators
- Completion percentages
- Time metrics

✅ **Smart Recommendations**
- What to do next
- Blockers to resolve
- Priorities to focus on

## Documentation Structure

```
.cursor/
├── commands/
│   ├── task*.md           # Task commands
│   ├── phase*.md          # Phase commands
│   ├── task.md            # Task help
│   └── phase.md           # Phase help
├── COMMAND_SUMMARY.md     # This file
├── TASK_COMMANDS.md       # Detailed task guide
├── PHASE_COMMANDS.md      # Detailed phase guide
├── ENRICHED_COMMANDS.md   # Backlinks & context
├── README.md              # Main overview
└── scripts/               # Implementation scripts

packages/cms/tasks/
├── TASKS.md               # Task system guide
├── NAMING.md              # Naming conventions
├── SHORT_TITLES.md        # Short title guide
├── SHORT_TITLES_QUICK_REF.md
├── template.md            # Task template
├── types.ts               # TypeScript definitions
├── schema.json            # JSON Schema
└── phase-01-foundation/   # Tasks directory
    └── 01-001-*.md
```

## Tips

1. **Always start with list commands** - Get overview before details
   - `/phase-list` → `/phase-show <phase>` → `/task-list <phase>`

2. **Use short titles** - Reference tasks easily
   - "Check `/complete-base-archetype`" (easier than "01-001")

3. **Follow backlinks** - Navigate the system
   - Each command output has links to related items

4. **Check progress regularly**
   - `/phase-report foundation` - Phase status
   - `/task-list foundation` - Task list
   - `/task-tree` - Hierarchy view

5. **Validate consistency**
   - `/task-validate` before major changes
   - Ensures all parent-child relationships intact

## Quick Commands Cheat Sheet

```bash
# Overview
/phase-list              # All phases
/task-list              # All tasks

# Details
/phase-show foundation
/task-show 01-001

# Work
/task-status 01-001 in_progress  # Start
/task-status 01-001 completed    # Finish

# Analysis
/phase-report foundation
/task-deps 01-001
/task-tree

# Create
/task-create 1 002 "Title" foundation
/phase-create

# Manage
/phase-next foundation
/task-validate
```

---

**Master these commands and you'll manage your project efficiently!** 🚀

