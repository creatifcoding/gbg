#!/bin/bash
# Slash command setup for task management
# Add to ~/.zshrc or ~/.bashrc: source /path/to/this/file

# Get the .cursor directory (works in both bash and zsh)
if [[ -n "${BASH_SOURCE[0]:-}" ]]; then
  __TASK_CURSOR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
else
  __TASK_CURSOR_DIR="$(cd "$(dirname "${(%):-%x}")" && pwd)"
fi
__TASK_CLI="$__TASK_CURSOR_DIR/task"

# For Zsh compatibility, create functions instead of aliases
if [[ -n "${ZSH_VERSION:-}" ]]; then
  # Zsh functions with slash commands
  /list() { "$__TASK_CLI" list "$@"; }
  /create() { "$__TASK_CLI" create "$@"; }
  /show() { "$__TASK_CLI" show "$@"; }
  /status() { "$__TASK_CLI" status "$@"; }
  /validate() { "$__TASK_CLI" validate "$@"; }
  /report() { "$__TASK_CLI" report "$@"; }
  /tree() { "$__TASK_CLI" tree "$@"; }
  /deps() { "$__TASK_CLI" deps "$@"; }
  /task() { "$__TASK_CLI" "$@"; }
else
  # Bash aliases (for .bashrc)
  alias /list="$__TASK_CLI list"
  alias /create="$__TASK_CLI create"
  alias /show="$__TASK_CLI show"
  alias /status="$__TASK_CLI status"
  alias /validate="$__TASK_CLI validate"
  alias /report="$__TASK_CLI report"
  alias /tree="$__TASK_CLI tree"
  alias /deps="$__TASK_CLI deps"
  alias /task="$__TASK_CLI"
fi

# Also make available via PATH (for manual invocation)
export PATH="$__TASK_CURSOR_DIR:$PATH"

