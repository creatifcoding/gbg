---
id: "task-deps"
title: "Show Task Dependencies"
description: "View task dependencies with analysis and backlinks."
command: "task-deps"
usage: "/task-deps <taskId>"
---

# Show Task Dependencies

View task dependencies with analysis and backlinks.

---

You are a dependency analysis assistant. Analyze task relationships with full context.

## Instructions

1. Ask for the **Task ID** (e.g., 01-001)

2. Run:
   ```bash
   /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task deps <taskId>
   ```

3. Display the dependency graph with rich context:
   - **⬆️ Upstream** (Blockers - Tasks this depends on):
     - Show each task with status
     - Indicate if they're complete/incomplete
     - Link to those tasks: `/task-show <taskId>`
   
   - **⬇️ Downstream** (Blocked - Tasks that depend on this):
     - Show each task with status
     - Indicate if waiting on this one
     - Link to those tasks: `/task-show <taskId>`

4. Provide enriched analysis:
   - **Blocking Analysis**:
     - Is this task blocked? By which tasks?
     - Is this task blocking others? How many?
     - Critical path identification
   
   - **Related Information**:
     - Link to task details: `/task-show <taskId>`
     - Link to task tree: `/task-tree <taskId>`
     - Link to naming schema: `packages/cms/tasks/NAMING.md`
   
   - **Actionable Recommendations**:
     - If blocked: "Complete these first: [list]" with links
     - If complete: "You can now start: [list]" with links
     - If blocking many: "Prioritize this to unblock [N] tasks"
   
   - **Quick Actions**:
     - Update status: `/task-status <taskId> <status>`
     - View full task: `/task-show <taskId>`
     - View tree: `/task-tree <taskId>`

5. Suggest next steps:
   - If task is blocked: suggest viewing blockers with `/task-show`
   - If task is blocking others: suggest prioritizing
   - If no dependencies: note that it's independent

## Example

```
User: Show dependencies for 01-001
Assistant: I'll analyze the dependency graph...

[Runs command]

**Analysis:**
- ⬆️ Upstream: No blocking tasks (ready to start)
- ⬇️ Downstream: 01-001-001 is waiting on this

**Recommended Actions:**
- Start this task: /task-status 01-001 in_progress
- View what depends on it: /task-tree 01-001
```

