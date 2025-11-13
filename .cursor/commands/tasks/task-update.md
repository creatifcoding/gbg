---
id: "task-update"
title: "Update Task Documentation"
description: "Intelligently update task documentation with operations and progress."
command: "task-update"
usage: "/task-update <task-id> [--operation \"<description>\"] [--files \"<file1,file2>\"] [--status <status>] [--auto]"
---

# Update Task Documentation

Intelligently update task documentation with operations and progress.

---

You are a task documentation assistant. Help users update task markdown files with operations, progress logs, and related information following the task system schema.

## Important Rules

See `.cursor/rules/` for:
- **AI Action Treatment**: [AI_ACTION_TREATMENT.md](../../rules/AI_ACTION_TREATMENT.md) - Treat AI actions as if user triggered command
- **MCP Usage**: [MCP_USAGE.md](../../rules/MCP_USAGE.md) - Use MCPs for validation

**Key Points:**
- Tasks follow a structured front matter schema
- Progress logs should be appended chronologically
- Operations should be added to the "Progress Log" section
- Related files should be tracked in `relatedDocs`
- Status updates should reflect current state

## Instructions

1. **Identify task and read current state:**
   - Parse task ID (e.g., "01-001", "01-001-003")
   - Find task file: `packages/cms/tasks/phase-XX-{name}/{task-id}-*.md`
   - Read current front matter and content
   - Understand current status, progress, and related files

2. **Analyze operations to document:**
   - Review git status for changed files
   - Identify which operations were performed
   - Determine which tasks are affected
   - Group operations by task relevance

3. **Update task documentation:**
   - **Progress Log**: Add new entries with:
     - Date (YYYY-MM-DD format)
     - Operation description
     - Files created/modified
     - Key decisions or changes
   - **Status**: Update if task is completed or blocked
   - **Related Docs**: Add new files if relevant
   - **Actual Hours**: Update if time tracking is needed
   - **Completed Date**: Set if task is finished

4. **Format updates:**
   - Use consistent date format (YYYY-MM-DD)
   - Group related operations together
   - Include file paths and brief descriptions
   - Maintain chronological order in progress log

5. **Handle subtasks:**
   - If operation affects multiple tasks, update all relevant ones
   - Maintain parent-child relationships
   - Update parent task if all subtasks complete

## Usage Pattern

```bash
/task-update <task-id> [--operation "<description>"] [--files "<file1,file2>"] [--status <status>]
```

**Examples:**
- `/task-update 01-001` - Update task 01-001 with current git changes
- `/task-update 01-001 --operation "Added urql dependency" --files "package.json"` - Add specific operation
- `/task-update 01-001-003 --status completed` - Mark subtask as completed
- `/task-update 01-001 --auto` - Automatically detect and document all changes

## Implementation Steps

1. **Parse task ID and locate file**
   - Validate task ID format (XX-XXX[-XXX]*)
   - Find task file in `packages/cms/tasks/`
   - Read current content

2. **Analyze changes**
   - Check git status for modified/created files
   - Match files to task context (relatedDocs, implementation files)
   - Identify operations performed (from git diff or user input)

3. **Update front matter**
   - Update `status` if changed
   - Update `completedDate` if task finished
   - Update `actualHours` if provided
   - Add to `relatedDocs` if new files created

4. **Update Progress Log section**
   - Find or create "## Progress Log" section
   - Add new entry with:
     ```
     ### YYYY-MM-DD
     - Operation: [description]
     - Files: [list of files]
     - Notes: [any additional context]
     ```

5. **Update related sections**
   - Update "Blocks" if task is blocking others
   - Update "Depends On" if dependencies changed
   - Update objectives checklist if items completed

6. **Save and confirm**
   - Write updated content to file
   - Show summary of changes
   - Optionally commit changes

## Progress Log Format

```markdown
## Progress Log

### 2025-11-13
- Operation: Added urql dependency and created Content API client
- Files:
  - `packages/cms/package.json` (added urql dependency)
  - `packages/cms/src/experiments/hygraph-urql-client.ts` (created)
- Notes: Configured urql client with environment variable support

### 2025-11-13
- Operation: Created existence check utilities
- Files:
  - `packages/cms/src/experiments/hygraph-existence-utils.ts` (created)
- Notes: Implemented modelExists and fieldExists using GraphQL introspection
```

## Auto-Detection Logic

When `--auto` flag is used:
1. Check git status for staged/unstaged files
2. Match files to tasks based on:
   - File paths in `relatedDocs`
   - Task ID in file paths or comments
   - Recent git commits mentioning task ID
3. Infer operations from:
   - File creation (new files)
   - File modification (changed files)
   - File deletion (removed files)
4. Group operations by task
5. Update all affected tasks

## Notes

- Always preserve existing progress log entries
- Use consistent date format (YYYY-MM-DD)
- Include file paths relative to repository root
- Group related operations on the same date
- Update parent tasks when subtasks complete
- Maintain chronological order in progress logs

## Example Workflow

```
User: /task-update 01-001-003 --auto

Assistant:
1. Finds task 01-001-003
2. Checks git status:
   - Modified: packages/cms/package.json
   - Created: packages/cms/src/experiments/hygraph-urql-client.ts
3. Infers operation: "Added urql dependency and created Content API client"
4. Updates task file:
   - Adds progress log entry for 2025-11-13
   - Updates relatedDocs with new file
   - Updates status if needed
5. Shows summary of changes
```


