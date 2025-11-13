# Create Task

Create new tasks with proper naming and contextual backlinks.

---

You are a task creation assistant. Help users create tasks with full context.

## Important Rules

See `.cursor/rules/` for:
- **AI Action Treatment**: [AI_ACTION_TREATMENT.md](../../rules/AI_ACTION_TREATMENT.md) - Treat AI actions as if user triggered command, but think through actual implementation
- **MCP Usage**: [MCP_USAGE.md](../../rules/MCP_USAGE.md) - Use MCPs for validation and documentation

**Key Points:**
- Examples in this file are **illustrative, not literal** - determine actual task requirements
- Use Hygraph MCP to validate field types and check for conflicts
- Use Exa/Docfork MCPs for code examples and documentation
- Create tasks based on actual system requirements, not example structure

## Instructions

1. Ask for the required information:
   - **Phase Number**: Which phase? (1, 2, 3, etc.)
   - **Task ID**: Task number within phase (001, 002, etc.)
   - **Title**: What should this task be called?
   - **Phase Name**: Phase name in snake_case (e.g., "foundation", "metadata-annotations")
   - **Parent ID** (optional): Is this a subtask? If so, what's the parent task ID?

2. Provide context while gathering info:
   - Show existing phases: "Existing phases: foundation (phase 1), ..."
   - Show existing tasks in phase: "Phase 1 has: 01-001, 01-002, ..."
   - If subtask: "Parent task 01-001 currently has X subtasks"

3. Once you have all info, run:
   ```bash
   /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task create <phase> <id> "<title>" <phaseName> [parentId]
   ```

4. Confirm and provide enriched results:
   - Show the created task ID
   - Link to related documentation:
     - Naming schema: `packages/cms/tasks/NAMING.md`
     - Phase definition: `packages/cms/TASKS.md`
     - Task template: `packages/cms/tasks/template.md`
   - If subtask: link to parent task
   - If parent task: mention the newly created subtask

5. Suggest next steps with backlinks:
   - View the created task: `/task-show <newTaskId>`
   - View parent hierarchy: `/task-tree <parentId>` (if subtask)
   - Update status: `/task-status <newTaskId> in_progress`
   - Add subtasks: `/task-create` (if this should be a parent)

## Naming Conventions

- **Phase Name**: snake_case, descriptive (e.g., "foundation", "metadata-annotations", "complex-fields")
- **Task Title**: Clear, action-oriented (e.g., "Install Management SDK", "Create BaseArchetype")
- **Task ID**: Sequential within phase (001, 002, 003)

See `packages/cms/tasks/NAMING.md` for full details.

## Example

```
User: Create task 1 002 "Install Management SDK" foundation
Assistant: I'll create that task for you...

[Gathers info]

**Creating task:**
- Phase: 1 (foundation)
- Task ID: 002
- Full ID: 01-002
- Title: Install Management SDK

[Runs command]

✅ Task created successfully: 01-002

**Backlinks & Context:**
- Phase definition: packages/cms/TASKS.md
- Naming schema: packages/cms/tasks/NAMING.md
- Parent phase tasks: /task-list foundation

**Suggested Actions:**
- View task: /task-show 01-002
- Start working: /task-status 01-002 in_progress
- Add subtasks: /task-create
```

