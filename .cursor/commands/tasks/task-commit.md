# Commit Task Changes

Commit all changes related to a task and its subtasks (recursively).

---

You are a git commit assistant for task-related changes. Help users commit task work following the `.better-commmits.json` specification.

## Important Rules

See `.cursor/rules/` for:
- **AI Action Treatment**: [AI_ACTION_TREATMENT.md](../../rules/AI_ACTION_TREATMENT.md) - Treat AI actions as if user triggered command
- **MCP Usage**: [MCP_USAGE.md](../../rules/MCP_USAGE.md) - Use MCPs for validation

**Key Points:**
- Commits should follow `.better-commmits.json` specification
- Tasks can have unlimited nesting (subtasks can have subtasks)
- Collect all files related to a task and its descendants
- Group commits by concern (feature vs. documentation vs. task system)

## Instructions

1. **Identify task and collect files:**
   - Parse task ID (e.g., "01-001", "01-001-003")
   - Find task file: `packages/cms/tasks/phase-XX-{name}/{task-id}-*.md`
   - Recursively find all subtask files (unlimited nesting)
   - Collect related files from `relatedDocs` in front matter
   - Collect implementation files changed for this task

2. **Group changes by concern:**
   - **Feature/Implementation**: Code changes, new modules, utilities
   - **Documentation**: README updates, doc files, comments
   - **Task System**: Task markdown files, task metadata updates

3. **Create commits following `.better-commmits.json`:**
   - Use appropriate commit type (feat, fix, docs, refactor, etc.)
   - Use scope if applicable (e.g., "cms", "tasks")
   - Follow commit title max size (120 chars)
   - Include commit body if needed
   - Use trailers (Changelog: feature, etc.)

4. **Commit structure:**
   ```bash
   # Example: Feature commit
   feat(cms): add urql existence checking utilities
   
   Add urql client and existence check utilities for Hygraph Content API.
   Includes modelExists and fieldExists functions using GraphQL introspection.
   
   Changelog: feature
   
   # Example: Documentation commit
   docs(tasks): add hygraph existence checking utilities documentation
   
   Document urql-based existence checking pattern and ensure utilities.
   
   Changelog: documentation
   
   # Example: Task system commit
   docs(tasks): add subtasks for hygraph existence checking utilities
   
   Add tasks 01-001-003 through 01-001-006 documenting implementation.
   
   Changelog: documentation
   ```

5. **Handle nested subtasks:**
   - Recursively traverse task tree
   - Collect all descendant task files
   - Group related changes together
   - Create logical commit groups

## Usage Pattern

```bash
/task-commit <task-id> [--dry-run] [--group-by-concern]
```

**Examples:**
- `/task-commit 01-001` - Commit all changes for task 01-001 and all subtasks
- `/task-commit 01-001-003` - Commit changes for specific subtask
- `/task-commit 01-001 --dry-run` - Show what would be committed without committing
- `/task-commit 01-001 --group-by-concern` - Group commits by feature/docs/tasks

## Implementation Steps

1. **Parse task ID and find task file**
   - Validate task ID format (XX-XXX[-XXX]*)
   - Locate task file in `packages/cms/tasks/`
   - Read task front matter

2. **Collect all related files**
   - Task markdown file(s)
   - Files listed in `relatedDocs`
   - Implementation files (detect from git status or task notes)
   - Recursively collect from all subtasks

3. **Group by concern**
   - Feature: `.ts`, `.tsx`, `.js`, `.jsx` files, package.json changes
   - Documentation: `.md`, `.mdx` files, doc comments
   - Task System: Task markdown files in `packages/cms/tasks/`

4. **Create commits**
   - Check git status for staged/unstaged files
   - Stage relevant files
   - Create commit with proper message following `.better-commmits.json`
   - Repeat for each concern group

5. **Confirm and execute**
   - Show commit messages to user
   - Get confirmation
   - Execute commits

6. **Generate PR_SUMMARY (if creating new branch)**
   - After commits are created, generate a `PR_SUMMARY.md` file
   - Include branch name, overview, commit list, files changed, key features
   - Follow the format from existing PR summaries (see `.cursor/PR_SUMMARY.md` for reference)
   - Place `PR_SUMMARY.md` in the repository root
   - Commit the PR_SUMMARY as a separate commit: `docs(infra): add PR summary for <branch-name>`

## Notes

- Subtasks can have unlimited nesting depth
- Always follow `.better-commmits.json` specification
- Group commits logically by concern
- Include all related files from task and subtasks
- Use appropriate commit types and scopes

## Example Workflow

```
User: /task-commit 01-001

Assistant:
1. Finds task 01-001 and subtasks 01-001-001 through 01-001-006
2. Collects files:
   - packages/cms/src/experiments/hygraph-urql-client.ts
   - packages/cms/src/experiments/hygraph-existence-utils.ts
   - packages/cms/src/experiments/hygraph-hello-world.ts
   - packages/cms/package.json
   - packages/cms/tasks/phase-01-foundation/01-001-003.md
   - packages/cms/tasks/phase-01-foundation/01-001-004.md
   - packages/cms/tasks/phase-01-foundation/01-001-005.md
   - packages/cms/tasks/phase-01-foundation/01-001-006.md
   - packages/cms/tasks/phase-01-foundation/01-001.md
3. Groups:
   - Feature: urql client, existence utils, hello-world.ts, package.json
   - Task System: All task markdown files
4. Creates commits:
   - feat(cms): add urql existence checking utilities
   - docs(tasks): add hygraph existence checking subtasks
```


