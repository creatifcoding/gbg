# Task Management Slash Commands - Setup Guide

## Overview

You now have **slash commands** for managing your task system. These provide quick, intuitive access to all task operations.

## Installation (One-time Setup)

Add this single line to your shell profile:

### For Zsh (macOS/Linux)
Edit `~/.zshrc` and add:
```bash
source /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/shell-init.sh
```

### For Bash (Linux)
Edit `~/.bashrc` and add:
```bash
source /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/shell-init.sh
```

Then reload your shell:
```bash
source ~/.zshrc  # or ~/.bashrc
```

## Usage Examples

### Basic Operations

```bash
# Create a new task
/create 1 002 "Install Management SDK" foundation

# List all tasks
/list

# List foundation phase tasks only
/list foundation

# See task details
/show 01-001

# Update task status
/status 01-001 in_progress
/status 01-001 completed

# Mark multiple as done
/status 01-002 completed
/status 01-002-001 completed
```

### Reporting & Validation

```bash
# Validate all tasks
/validate

# Generate report for all phases
/report

# Report for specific phase
/report foundation

# See task tree
/tree

# See task tree for specific task
/tree 01-001

# Show task dependencies
/deps 01-001
```

### Workflow Example

```bash
# 1. Create a task for phase 1
/create 1 002 "Install @hygraph/management-sdk" foundation

# 2. Verify it was created
/show 01-002

# 3. Start working on it
/status 01-002 in_progress

# 4. Create a subtask
/create 1 002 "Authenticate with Hygraph" foundation 01-002

# 5. When done
/status 01-002 completed

# 6. View phase summary
/list foundation
```

## Available Commands

| Command | Purpose | Example |
|---------|---------|---------|
| `/create` | Create new task | `/create 1 001 "Title" foundation` |
| `/list` | List tasks | `/list foundation` |
| `/show` | Show task details | `/show 01-001` |
| `/status` | Update status | `/status 01-001 completed` |
| `/validate` | Validate all tasks | `/validate` |
| `/report` | Generate report | `/report foundation` |
| `/tree` | Show hierarchy | `/tree 01-001` |
| `/deps` | Show dependencies | `/deps 01-001` |
| `/task` | Direct CLI access | `/task list` |

## Status Values

When using `/status`, use one of:
- `pending` - Not started
- `in_progress` - Currently working on it
- `completed` - Done
- `blocked` - Can't proceed
- `cancelled` - No longer needed

## Common Workflows

### Start a new task
```bash
/status 01-001 in_progress
```

### Complete a task
```bash
/status 01-001 completed
```

### Create subtask
```bash
/create 1 001 "Subtask title" foundation 01-001
```

### Check progress
```bash
/report foundation
```

### Verify consistency
```bash
/validate
```

## Troubleshooting

### Commands not found?
- Make sure you sourced the shell-init script
- Reload your shell: `source ~/.zshrc` or `source ~/.bashrc`
- Verify: `which /list` should show the script directory

### Command fails with "file not found"?
- Make sure Node.js is installed: `node --version`
- Verify scripts exist: `ls -la ~/.cursor/scripts/`
- Check paths are correct in error message

### Weird characters in output?
- This is just ANSI color codes from Node.js
- They render correctly in most modern terminals

## Direct Usage (Without Setup)

If you don't want to modify your shell profile, you can run directly:

```bash
/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task list
/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task create 1 001 "Title" foundation
```

Or add to PATH temporarily:
```bash
export PATH="/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor:$PATH"
task list
task create 1 001 "Title" foundation
```

## Files

- `.cursor/shell-init.sh` — Initialization script (source this)
- `.cursor/task` — Main CLI wrapper
- `.cursor/scripts/` — Individual command implementations
- `.cursor/commands.json` — Legacy Cursor commands
- This guide — `.cursor/SETUP_GUIDE.md`

## See Also

- [Task Management System](../../packages/cms/TASKS.md)
- [Naming Conventions](../../packages/cms/tasks/NAMING.md)
- [Task Templates](../../packages/cms/tasks/template.md)

