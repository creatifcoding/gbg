# Shell Slash Commands Setup

This guide helps you set up slash commands (`/task:*`) in your shell for quick access to task management utilities.

## Quick Setup

### For Zsh (macOS/Linux)

Add this line to your `~/.zshrc`:

```bash
source /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/shell-functions.sh
```

Then reload your shell:
```bash
source ~/.zshrc
```

### For Bash (Linux)

Add this line to your `~/.bashrc`:

```bash
source /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/shell-functions.sh
```

Then reload your shell:
```bash
source ~/.bashrc
```

## Available Commands

Once sourced, you'll have these commands available:

### `/task:create <phaseNumber> <taskId> <title> <phaseName> [parentId]`
Create a new task.

```bash
/task:create 1 001 "Complete BaseArchetype" foundation
/task:create 1 001 "Implement BaseArchetype class" foundation 01-001
```

### `/task:list [phaseName]`
List all tasks, optionally filtered by phase.

```bash
/task:list                 # All tasks
/task:list foundation      # Tasks in foundation phase
```

### `/task:show <taskId>`
Show detailed information about a task.

```bash
/task:show 01-001
```

### `/task:status <taskId> <status>`
Update a task's status.

```bash
/task:status 01-001 in_progress
/task:status 01-001 completed
```

Valid statuses: `pending`, `in_progress`, `completed`, `blocked`, `cancelled`

### `/task:validate`
Validate all task files for consistency.

```bash
/task:validate
```

### `/task:report [phaseName]`
Generate a status report.

```bash
/task:report                # All phases
/task:report foundation     # Foundation phase only
```

### `/task:tree [taskId]`
Show task hierarchy tree.

```bash
/task:tree                  # Show all root tasks
/task:tree 01-001          # Show tree for task 01-001
```

### `/task:deps <taskId>`
Show dependency graph for a task.

```bash
/task:deps 01-001
```

## Examples

### Workflow Example

```bash
# 1. Create a new phase 1 task
/task:create 1 002 "Install Management SDK" foundation

# 2. List all foundation tasks
/task:list foundation

# 3. Start working on it
/task:status 01-002 in_progress

# 4. Check the task details
/task:show 01-002

# 5. Create a subtask
/task:create 1 002 "Install @hygraph/management-sdk" foundation 01-002

# 6. Mark as completed when done
/task:status 01-002 completed

# 7. Get a report
/task:report foundation
```

## Troubleshooting

### Commands not found after sourcing
- Make sure you reloaded your shell: `source ~/.zshrc` or `source ~/.bashrc`
- Verify the path to `shell-functions.sh` is correct
- Check that Node.js is installed: `node --version`

### Permission denied
- Make sure the scripts are executable: `chmod +x .cursor/scripts/*.js`
- Verify you have permission to read the scripts

### Path issues
- If you moved the repository, update the source line in your shell profile
- The script auto-detects the workspace root from its location

