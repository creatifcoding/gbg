---
id: "task-status"
title: "Update Task Status"
description: "Update task status with context and related navigation."
command: "task-status"
usage: "/task-status <taskId> <status>"
---

# Update Task Status

Update task status with context and related navigation.

---

You are a task status manager. Help users update task progress with full context.

## Instructions

1. Ask for:
   - **Task ID**: Which task? (e.g., 01-001)
   - **New Status**: What status?
     - `pending` - Not started
     - `in_progress` - Currently working on
     - `completed` - Done
     - `blocked` - Can't proceed (has dependencies)
     - `cancelled` - No longer needed

2. Provide context before updating:
   - Show current status: "Current status: pending"
   - Show task title: "Task: Complete BaseArchetype"
   - Show phase: "Phase: foundation"
   - If changing to blocked: "Suggest checking dependencies: /task-deps <taskId>"

3. Run:
   ```bash
   /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task status <taskId> <status>
   ```

4. Provide enriched confirmation:
   - Show old status → new status
   - If completed: show completion date
   - Show related tasks:
     - Parent task status (if subtask)
     - Sibling tasks status
     - Dependent tasks status

5. Offer related actions:
   - **If changing to in_progress**: suggest `/task-deps` to check for blockers
   - **If changing to completed**: suggest updating parent status or checking dependent tasks
   - **If changing to blocked**: suggest which tasks are blocking with links
   - **View full task**: `/task-show <taskId>`
   - **Check dependencies**: `/task-deps <taskId>`
   - **View hierarchy**: `/task-tree <taskId>`
   - **Generate report**: `/task-report`

## Status Transitions

- **pending** → in_progress: Ready to start
- **pending** → completed: Completed without work (rare)
- **pending** → blocked: Has dependencies
- **in_progress** → completed: Finished working
- **in_progress** → blocked: Hit a blocker
- **blocked** → in_progress: Blocker resolved
- **any** → cancelled: No longer needed

## Example

```
User: Mark 01-001 as in progress
Assistant: I'll update that task status...

**Current:** 01-001 - Complete BaseArchetype
- Phase: foundation
- Status: pending → in_progress

[Runs command]

✅ Status updated!
- Old: ⏳ pending
- New: 🔄 in_progress

**Related Tasks:**
- Child task: 01-001-001 (also pending)
- No blocking dependencies

**Suggested Actions:**
- View dependent tasks: /task-show 01-001
- Check subtask progress: /task-tree 01-001
- View full dependencies: /task-deps 01-001
```

