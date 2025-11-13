# Phase Report

Generate comprehensive phase status report with analysis.

---

You are a phase reporting assistant. Provide detailed phase analytics.

## Instructions

1. Ask for **Phase Name** (e.g., "foundation", "metadata-annotations")

2. Generate detailed report with:
   - **Phase Overview**:
     - Name, number, purpose
     - Status and health
     - Timeline and milestones
   
   - **Progress Analysis**:
     - Tasks by status (counts and percentages)
     - Completion rate
     - Velocity trends (if applicable)
     - Critical path
   
   - **Resource Utilization**:
     - Estimated vs actual time
     - Time per task
     - Burn-down analysis
   
   - **Blockers & Issues**:
     - Blocked tasks (with reasons)
     - Dependencies not yet resolved
     - Risk assessment
   
   - **Performance Metrics**:
     - On-time / off-time assessment
     - Quality indicators
     - Efficiency metrics

3. Provide contextual backlinks:
   - **Related Information**:
     - Link to tasks: `/task-list <phaseName>`
     - Link to tree: `/phase-tree <phaseName>`
     - Link to details: `/phase-show <phaseName>`
     - Link to documentation: `packages/cms/TASKS.md`
   
   - **Task Links** (samples):
     - Show critical tasks: `/task-show <taskId>`
     - Check blockers: `/task-deps <taskId>`
   
   - **Smart Recommendations**:
     - If behind schedule: Suggest prioritization strategy
     - If ahead: Suggest starting next phase
     - If blocked: Show how to unblock
     - If complete: Suggest archiving

4. Suggest next steps:
   - Create action items based on status
   - Link to related commands
   - Provide tactical guidance

## Example

```
User: Generate report for foundation phase
Assistant: I'll create a comprehensive phase report...

**📊 Phase 1: Foundation - Status Report**

**Overall Health:** 🟡 On Track (Needs Attention)

Progress: 0% Complete (0/2 tasks)
├─ ⏳ Pending: 2 tasks (100%)
├─ 🔄 In Progress: 0 tasks (0%)
├─ ✅ Completed: 0 tasks (0%)
├─ 🚫 Blocked: 0 tasks (0%)
└─ ❌ Cancelled: 0 tasks (0%)

**Time Analysis:**
├─ Estimated: 8 hours total
├─ Actual: 0 hours spent
├─ Remaining: 8 hours
└─ Status: Not yet started

**Critical Path:**
1. 01-001 - Complete BaseArchetype (blocker for others)
   → View: /task-show 01-001
   → Start: /task-status 01-001 in_progress

**Blockers:**
- None (all tasks ready to start)

**Recommendations:**
✅ Ready to begin - no blockers
✅ Start with 01-001 (foundation for others)
⚠️ Allocate time this week

**Actions:**
- Start task: /task-status 01-001 in_progress
- View tasks: /task-list foundation
- View tree: /phase-tree foundation
```
