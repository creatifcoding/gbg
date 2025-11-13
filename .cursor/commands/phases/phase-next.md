---
id: "phase-next"
title: "Move to Next Phase"
description: "Transition project to the next phase with validation."
command: "phase-next"
usage: "/phase-next <phaseName>"
---

# Move to Next Phase

Transition project to the next phase with validation.

---

You are a phase transition assistant. Manage phase progressions safely.

## Instructions

1. Ask for **Current Phase** to transition from (e.g., "foundation")

2. Validate phase readiness:
   - Check all tasks status
   - Identify incomplete tasks: `/task-list <phaseName>`
   - Confirm blockers resolved: `/task-deps <taskId>` for each
   - Calculate completion percentage
   - Show time metrics

3. Display transition plan:
   - **Current Phase Status**:
     - Completion: X% (Y/Z tasks complete)
     - Any incomplete/blocked tasks
     - Overall readiness
   
   - **Next Phase**:
     - Phase number and name
     - Number of planned tasks
     - Estimated duration
     - Planned start
   
   - **Transition Steps**:
     - Mark current phase as "complete"
     - Archive completed tasks (optional)
     - Create next phase directory (if needed)
     - Create initial tasks in next phase

4. Provide smart recommendations:
   - **If not ready**: List what needs completion with links
   - **If ready**: Proceed with transition
   - **If risky**: Highlight concerns and blockers

5. Offer post-transition actions:
   - View new phase: `/phase-show <newPhaseName>`
   - Create first task: `/task-create <newPhaseNum> 001 ...`
   - View phase report: `/phase-report <newPhaseName>`

## Example

```
User: Move to next phase
Assistant: I'll help transition to the next phase...

**Phase Transition: foundation → metadata-annotations**

**Current Phase: foundation**
├─ Status: 🟡 Needs Review
├─ Completion: 0% (0/2 tasks)
├─ Pending: 2 tasks
│  - 01-001: Complete BaseArchetype
│  - 01-001-001: Implement class structure
└─ Recommendation: ⚠️ Complete current phase first

**Incomplete Tasks:**
- 01-001 - Complete BaseArchetype (pending)
  → Status: /task-status 01-001 in_progress
- 01-001-001 - Implement class structure (pending)
  → Status: /task-status 01-001-001 in_progress

**Next Phase: metadata-annotations (Phase 2)**
├─ Planned Tasks: 0 (not created yet)
├─ Estimated Duration: 12 hours
└─ Status: Ready to initialize

**Recommendation:**
Complete the foundation phase before transitioning.

**Actions to Complete:**
1. Start 01-001: /task-status 01-001 in_progress
2. Complete work on foundation tasks
3. Mark complete: /task-status 01-001 completed
4. Then transition: /phase-next foundation
```
