# Slash Commands Setup

Quick setup for `/task` slash commands in your shell.

## Quick Setup

### Add to your shell profile

Add this line to `~/.zshrc` or `~/.bashrc`:

```bash
source /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/shell-init.sh
```

Then reload your shell:
```bash
source ~/.zshrc  # or ~/.bashrc
```

## Available Slash Commands

Once sourced, you'll have these commands:

### `/create <phase> <id> <title> <phaseName> [parentId]`
Create a new task.

```bash
/create 1 001 "Complete BaseArchetype" foundation
/create 1 001 "Implement class structure" foundation 01-001
```

### `/list [phaseName]`
List tasks.

```bash
/list                  # All tasks
/list foundation       # Tasks in foundation phase
```

### `/show <taskId>`
Show task details.

```bash
/show 01-001
```

### `/status <taskId> <status>`
Update task status.

```bash
/status 01-001 in_progress
/status 01-001 completed
```

Valid statuses: `pending`, `in_progress`, `completed`, `blocked`, `cancelled`

### `/validate`
Validate all tasks.

```bash
/validate
```

### `/report [phaseName]`
Generate report.

```bash
/report               # All phases
/report foundation    # Foundation phase
```

### `/tree [taskId]`
Show task hierarchy.

```bash
/tree                # All root tasks
/tree 01-001         # Specific task tree
```

### `/deps <taskId>`
Show dependencies.

```bash
/deps 01-001
```

### `/task <command> ...`
Direct access to task CLI (same as above commands).

```bash
/task list
/task create 1 002 "New Task" foundation
```

## Examples

### Quick workflow

```bash
# Create task
/create 1 002 "Install SDK" foundation

# Check it
/show 01-002

# Start working
/status 01-002 in_progress

# List phase
/list foundation

# Complete
/status 01-002 completed

# Report
/report foundation
```

## Alternative: Direct CLI

If you don't want to add to your shell profile, use directly:

```bash
/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task list
/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task create 1 001 "Task" foundation
```

Or add to PATH in your shell:

```bash
export PATH="$PATH:/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor"
task list
task create 1 001 "Task" foundation
```

## Troubleshooting

### Aliases not working
- Reload your shell: `source ~/.zshrc` or `source ~/.bashrc`
- Make sure sourced path is correct
- Check: `alias | grep task`

### Command not found
- Verify the wrapper script exists: `ls -la /path/to/.cursor/task`
- Make it executable: `chmod +x /path/to/.cursor/task`
- Check Node.js: `node --version`

### ModuleNotFound error
- Make sure all scripts exist in `.cursor/scripts/`
- Check path in error message matches real location

