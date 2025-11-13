# PR Summary: Task Commit Command

## Branch
`docs/tasks/task-commit-command`

## Overview
Adds a new Cursor slash command `/task-commit` that automates committing changes related to tasks and their subtasks, following the `.better-commmits.json` specification. The command intelligently groups changes by concern (feature, documentation, task system) and creates appropriate commits.

## Commits (5 total)

### 1. Task Commit Command
**Commit**: `docs(tasks): add task-commit command for committing task changes`
- Created `.cursor/commands/tasks/task-commit.md` command documentation
- Command supports recursive subtask traversal (unlimited nesting)
- Groups commits by concern: feature, documentation, task system
- Follows `.better-commmits.json` specification for commit messages
- Includes dry-run and grouping options

### 2. PR Summary and Command Enhancements
**Commit**: `docs(tasks): add PR summary and enhance task commands`
- Added PR_SUMMARY.md documenting the branch
- Updated task-commit command with PR_SUMMARY generation instructions
- Added new task-update command for intelligently updating task documentation

### 3. PR_SUMMARY Generation Instructions
**Commit**: `docs(tasks): add PR_SUMMARY generation instructions to task-commit`
- Added step 6 to task-commit command for PR_SUMMARY generation
- Instructions for creating PR_SUMMARY.md after commits
- Follows existing PR summary format

### 4. Front Matter for Task Commands
**Commit**: `docs(tasks): add front matter with usage to all task commands`
- Added YAML front matter to all 10 task command files
- Includes: id, title, description, command, usage
- Usage patterns extracted from documented examples in each file
- Makes command metadata easily accessible

### 5. Front Matter for Phase Commands
**Commit**: `docs(phases): add front matter with usage to all phase commands`
- Added YAML front matter to all 6 phase command files
- Includes: id, title, description, command, usage
- Usage patterns extracted from documented examples
- Consistent with task command front matter format

## Files Changed

### Created
- `.cursor/commands/tasks/task-commit.md` - Complete command documentation with:
  - Usage patterns and examples
  - Implementation steps
  - Commit structure examples
  - Nested subtask handling
  - Concern-based grouping logic
  - PR_SUMMARY generation instructions
- `.cursor/commands/tasks/task-update.md` - New command for updating task documentation:
  - Auto-detection of changes
  - Progress log updates
  - Status management
  - Related docs tracking

### Modified
- All 10 task command files (`.cursor/commands/tasks/*.md`) - Added front matter with usage
- All 6 phase command files (`.cursor/commands/phases/*.md`) - Added front matter with usage

## Key Features
- ✅ Recursive subtask traversal (unlimited nesting depth)
- ✅ Concern-based commit grouping (feature/docs/tasks)
- ✅ `.better-commmits.json` compliance
- ✅ Dry-run mode for preview
- ✅ Automatic file collection from task metadata
- ✅ Support for relatedDocs and implementation files
- ✅ PR_SUMMARY generation instructions
- ✅ Intelligent task documentation updates
- ✅ Consistent front matter across all commands (16 total)
- ✅ Usage patterns extracted from documented examples

## Command Usage

### task-commit
```bash
/task-commit <task-id> [--dry-run] [--group-by-concern]
```

**Examples:**
- `/task-commit 01-001` - Commit all changes for task 01-001 and all subtasks
- `/task-commit 01-001-003` - Commit changes for specific subtask
- `/task-commit 01-001 --dry-run` - Show what would be committed
- `/task-commit 01-001 --group-by-concern` - Group commits by feature/docs/tasks

### task-update
```bash
/task-update <task-id> [--operation "<description>"] [--files "<file1,file2>"] [--status <status>] [--auto]
```

**Examples:**
- `/task-update 01-001` - Update task 01-001 with current git changes
- `/task-update 01-001 --operation "Added urql dependency" --files "package.json"` - Add specific operation
- `/task-update 01-001-003 --status completed` - Mark subtask as completed
- `/task-update 01-001 --auto` - Automatically detect and document all changes

## Implementation Details

### File Collection
- Task markdown files (recursively from all subtasks)
- Files listed in `relatedDocs` front matter
- Implementation files detected from git status
- Related files from task notes

### Commit Grouping
- **Feature**: `.ts`, `.tsx`, `.js`, `.jsx` files, `package.json` changes
- **Documentation**: `.md`, `.mdx` files, doc comments
- **Task System**: Task markdown files in `packages/cms/tasks/`

### Commit Structure
Follows `.better-commmits.json`:
- Commit type (feat, fix, docs, refactor, etc.)
- Scope (cms, tasks, etc.)
- Title (max 120 chars)
- Body (optional)
- Trailers (Changelog: feature, etc.)

## Next Steps
1. Review PR
2. Merge to main
3. Use commands for future task commits and updates
4. Extend with additional task management features

## PR Link
https://github.com/creatifcoding/gbg/pull/new/docs/tasks/task-commit-command


