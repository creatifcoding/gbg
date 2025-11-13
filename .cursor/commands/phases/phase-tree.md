---
id: "phase-tree"
title: "Show Phase Tree"
description: "Display all tasks in a phase as a hierarchical tree."
command: "phase-tree"
usage: "/phase-tree <phaseName>"
---

# Show Phase Tree

Display all tasks in a phase as a hierarchical tree.

---

You are a phase tree assistant. Show phase structure visually.

## Instructions

1. Ask for **Phase Name** (e.g., "foundation", "metadata-annotations")

2. Run:
   ```bash
   /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task tree
   ```

3. Filter and display phase-specific tree:
   - Show all root tasks in phase
   - Show hierarchy with indentation
   - Include status indicators
   - Show all subtasks

4. Display with enriched context:
   - **Tree Statistics**:
     - Total tasks in phase
     - By status breakdown
     - Depth of hierarchy
     - Critical paths
   
   - **Visual Elements**:
     - Status emoji (⏳ 🔄 ✅ 🚫 ❌)
     - Task IDs and titles
     - Nesting structure
     - Priority indicators (if relevant)
   
   - **Task Links**:
     - Each task links to `/task-show <taskId>`
     - Blocking relationships shown
     - Dependencies highlighted

5. Provide contextual backlinks:
   - **Related Information**:
     - Link to phase details: `/phase-show <phaseName>`
     - Link to phase report: `/phase-report <phaseName>`
     - Link to all tasks: `/task-list <phaseName>`
   
   - **Quick Actions**:
     - For each task: View, Update, Check dependencies
     - Create new task in phase: `/task-create`

6. Offer suggestions:
   - Identify critical path
   - Show blocking patterns
   - Suggest priorities

## Example

```
User: Show phase tree for foundation
Assistant: I'll display the phase tree...

**Phase 1: foundation - Task Hierarchy**

Foundation Phase Tasks (2 total)

⏳ 01-001 - Complete BaseArchetype [pending]
│  Status: Pending | Priority: High
│  Actions: /task-show 01-001 | /task-status 01-001 in_progress | /task-deps 01-001
│
└── ⏳ 01-001-001 - Implement BaseArchetype class structure [pending]
    Status: Pending | Priority: High
    Parent: 01-001
    Actions: /task-show 01-001-001 | /task-status 01-001-001 in_progress

**Statistics:**
├─ Total Tasks: 2
├─ Root Tasks: 1
├─ Max Depth: 2
├─ Pending: 2 ⏳
├─ In Progress: 0 🔄
└─ Completed: 0 ✅

**Critical Path:**
01-001 → 01-001-001 (sequential)

**Recommendations:**
- Start with 01-001 (root task, no blockers)
- 01-001-001 depends on 01-001 completion
```
