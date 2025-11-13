#!/bin/bash
# Task Management Slash Commands
# Source this file in your shell profile to get access to /task:* commands
# Add to ~/.zshrc or ~/.bashrc: source /path/to/this/file

# Get the .cursor directory
__TASK_CURSOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
__TASK_SCRIPTS_DIR="$__TASK_CURSOR_DIR/scripts"

# Helper function to run task scripts
__task_run() {
  local script=$1
  shift
  node "$__TASK_SCRIPTS_DIR/$script.js" "$@"
}

# /task:create - Create a new task
# Usage: /task:create <phaseNumber> <taskId> <title> <phaseName> [parentId]
/task:create() {
  __task_run "create-task" "$@"
}

# /task:list - List all tasks
# Usage: /task:list [phaseName]
/task:list() {
  __task_run "list-tasks" "$@"
}

# /task:show - Show task details
# Usage: /task:show <taskId>
/task:show() {
  __task_run "show-task" "$@"
}

# /task:status - Update task status
# Usage: /task:status <taskId> <status>
/task:status() {
  __task_run "update-status" "$@"
}

# /task:validate - Validate all tasks
# Usage: /task:validate
/task:validate() {
  __task_run "validate-tasks" "$@"
}

# /task:report - Generate task report
# Usage: /task:report [phaseName]
/task:report() {
  __task_run "task-report" "$@"
}

# /task:tree - Show task hierarchy
# Usage: /task:tree [taskId]
/task:tree() {
  __task_run "task-tree" "$@"
}

# /task:deps - Show task dependencies
# Usage: /task:deps <taskId>
/task:deps() {
  __task_run "task-dependencies" "$@"
}

# Note: Functions with special characters (colons) don't need explicit export

