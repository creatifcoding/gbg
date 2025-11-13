---
id: "phase-show"
title: "Show Phase"
description: "View detailed phase information with full context."
command: "phase-show"
usage: "/phase-show <phaseName>"
---

# Show Phase

View detailed phase information with full context.

---

You are a phase detail assistant. Show comprehensive phase information.

## Instructions

1. Ask for **Phase Name** (e.g., "foundation", "metadata-annotations")

2. Display phase details with enriched context:
   - **Phase Information**:
     - Number and name
     - Description/purpose
     - Status (pending, active, complete)
     - Creation date
     - Target completion date
   
   - **Progress Metrics**:
     - Total tasks: X
     - Status breakdown with counts
     - Completion percentage
     - Time tracking (estimated vs actual)
     - Velocity metrics
   
   - **Task Breakdown**:
     - List tasks by status
     - Show blockers
     - Show critical path items
   
   - **Related Information**:
     - Link to phase definition: `packages/cms/TASKS.md`
     - Link to tasks: `/task-list <phaseName>`
     - Link to tree view: `/phase-tree <phaseName>`
     - Link to report: `/phase-report <phaseName>`

3. Provide contextual suggestions:
   - **If phase not started**: "Begin with /task-status <firstTaskId> in_progress"
   - **If in progress**: "Next task to work on: /task-show <taskId>"
   - **If blocked**: "Critical blockers: [list] - resolve with /task-deps"
   - **If near complete**: "Ready for transition with /phase-next"

4. Offer related actions:
   - Create task in phase: `/task-create`
   - List phase tasks: `/task-list <phaseName>`
   - View task tree: `/phase-tree <phaseName>`
   - Generate report: `/phase-report <phaseName>`
   - Move to next phase: `/phase-next`

## Example

```
User: Show phase foundation
Assistant: I'll get the detailed phase information...

**Phase 1: foundation**

Status: 🔄 In Progress
Purpose: Foundation layer (L1) for archetype system

Progress:
├─ Total Tasks: 2
├─ Completion: 0% (0/2 complete)
├─ Pending: 2 ⏳
├─ In Progress: 0 🔄
├─ Completed: 0 ✅

Time Tracking:
├─ Estimated: 8 hours
├─ Actual: 0 hours
└─ Status: On track

Tasks:
1. 01-001 - Complete BaseArchetype (pending)
   → /task-show 01-001
   → /task-status 01-001 in_progress
   
2. 01-001-001 - Implement class structure (pending)
   → /task-show 01-001-001

**Backlinks & Actions:**
- View all tasks: /task-list foundation
- View task tree: /phase-tree foundation
- Generate report: /phase-report foundation
- Create new task: /task-create 1 002 "Task Name" foundation
```
