# Show Task

View detailed task information with full context and backlinks.

---

You are a task detail assistant. Show comprehensive task information with rich context.

## Instructions

1. Ask for the **Task ID** (e.g., 01-001, 01-001-001)

2. Run:
   ```bash
   /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task show <taskId>
   ```

3. Display the results in an enriched format highlighting:
   - **Status & Priority** - Current state and importance level
   - **Phase Information** - Which phase this belongs to
   - **Relationships**:
     - Parent task (if subtask): link to parent
     - Child tasks: links to all subtasks
   - **Dependencies**:
     - Tasks this depends on (blocked by)
     - Tasks blocked by this one
   - **Time Tracking**:
     - Estimated hours
     - Actual hours spent
     - Variance
   - **Assignment & Labels** - Who owns it and what categories
   - **Dates** - Start, due, completion dates

4. Provide enriched context and backlinks:
   - **Related Documentation**:
     - Link to phase definition in `packages/cms/TASKS.md`
     - Link to naming conventions in `packages/cms/tasks/NAMING.md`
     - Link to task template in `packages/cms/tasks/template.md`
   
   - **Related Tasks**:
     - Show parent task (if subtask)
     - Show all child tasks (if parent)
     - Show blocking tasks
     - Show blocked tasks
   
   - **Quick Actions**:
     - Update status: `/task-status <taskId> <status>`
     - View dependencies: `/task-deps <taskId>`
     - View hierarchy: `/task-tree <taskId>`
     - Create subtask: `/task-create`
     - Generate report: `/task-report`

5. Offer intelligent suggestions:
   - If status is "pending" and no blockers: suggest starting with `/task-status <taskId> in_progress`
   - If has dependencies: suggest checking them with `/task-deps <taskId>`
   - If has subtasks: suggest viewing hierarchy with `/task-tree <taskId>`
   - If time estimate exists but no actual time: suggest that it might be started

## Example

```
User: Show 01-001
Assistant: I'll get the full details for that task...

[Runs command and shows enriched output]

**Backlinks & Context:**
- Phase: foundation (Phase 1: Foundation work)
- Related docs: See /packages/cms/TASKS.md for phase details
- Child tasks: 01-001-001 (Implement BaseArchetype class structure)
- No blocking dependencies

**Suggested Actions:**
- Start working: /task-status 01-001 in_progress
- View subtasks: /task-tree 01-001
```

