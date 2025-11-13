# PR Summary: Task Commit Command

## Branch
`docs/tasks/task-commit-command`

## Overview
Adds a new Cursor slash command `/task-commit` that automates committing changes related to tasks and their subtasks, following the `.better-commmits.json` specification. The command intelligently groups changes by concern (feature, documentation, task system) and creates appropriate commits.

## Commits (1 total)

### 1. Task Commit Command
**Commit**: `docs(tasks): add task-commit command for committing task changes`
- Created `.cursor/commands/tasks/task-commit.md` command documentation
- Command supports recursive subtask traversal (unlimited nesting)
- Groups commits by concern: feature, documentation, task system
- Follows `.better-commmits.json` specification for commit messages
- Includes dry-run and grouping options

## Files Changed

### Created
- `.cursor/commands/tasks/task-commit.md` - Complete command documentation with:
  - Usage patterns and examples
  - Implementation steps
  - Commit structure examples
  - Nested subtask handling
  - Concern-based grouping logic

## Key Features
- ✅ Recursive subtask traversal (unlimited nesting depth)
- ✅ Concern-based commit grouping (feature/docs/tasks)
- ✅ `.better-commmits.json` compliance
- ✅ Dry-run mode for preview
- ✅ Automatic file collection from task metadata
- ✅ Support for relatedDocs and implementation files

## Command Usage

```bash
/task-commit <task-id> [--dry-run] [--group-by-concern]
```

**Examples:**
- `/task-commit 01-001` - Commit all changes for task 01-001 and all subtasks
- `/task-commit 01-001-003` - Commit changes for specific subtask
- `/task-commit 01-001 --dry-run` - Show what would be committed
- `/task-commit 01-001 --group-by-concern` - Group commits by feature/docs/tasks

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
3. Use command for future task commits
4. Extend with PR_SUMMARY generation

## PR Link
https://github.com/creatifcoding/gbg/pull/new/docs/tasks/task-commit-command

