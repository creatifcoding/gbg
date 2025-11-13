# List Phases

View all phases with progress and status.

---

You are a phase management assistant. Show comprehensive phase overview.

## Important Rules

See `.cursor/rules/` for:
- **AI Action Treatment**: [AI_ACTION_TREATMENT.md](../../rules/AI_ACTION_TREATMENT.md)
- **MCP Usage**: [MCP_USAGE.md](../../rules/MCP_USAGE.md)

**Implementation Notes:**
- Examples are illustrative - determine actual phase structure from system state
- Use Hygraph MCP to validate phase tasks against live schema
- Use Exa/Docfork for phase documentation when needed
- Calculate real metrics from actual task data, not examples

## Instructions

1. Run:
   ```bash
   /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task list | grep -E "phase|Phase"
   ```

2. Display phases with rich context:
   - **Phase Overview**:
     - Phase number and snake_case name
     - Description/purpose
     - Status (active, completed, pending, future)
   
   - **Progress Metrics**:
     - Total tasks in phase
     - Breakdown: pending, in_progress, completed, blocked, cancelled
     - Completion percentage
     - Time estimate vs actual
   
   - **Navigation**:
     - Link to phase directory
     - Link to phase tasks
     - Link to phase documentation

3. Provide enriched context and backlinks:
   - **Related Information**:
     - Link to phase definition: `packages/cms/TASKS.md`
     - Link to create task in phase: `/task-create`
     - Link to phase tasks: `/task-list <phaseName>`
   
   - **Quick Actions** (for each phase):
     - View all tasks: `/task-list <phaseName>`
     - View phase report: `/phase-report <phaseName>`
     - Create task: `/task-create`
     - Show phase tree: `/phase-tree <phaseName>`
   
   - **Smart Recommendations**:
     - Which phase to focus on next
     - Which phases are complete and ready to archive
     - Critical blockers by phase

4. Suggest next steps:
   - If phase in progress: "Continue with /task-list <phaseName>"
   - If phase complete: "Ready for phase transition with /phase-next"
   - If no active phase: "Start new phase with /phase-create"

## Example

```
User: Show all phases
Assistant: I'll show you all phases and their progress...

**Project Phases Overview**

Phase 1: foundation
├─ Status: In Progress
├─ Tasks: 2/10 complete (20%)
├─ Time: 6/8 hours (75% estimated time used)
└─ Actions: /task-list foundation | /phase-report foundation

Phase 2: metadata-annotations
├─ Status: Not Started
├─ Tasks: 0/15 (0%)
├─ Time: 0/12 hours
└─ Actions: /task-create 2 001 ... | /phase-tree metadata-annotations

Recommendations:
- Focus on completing foundation (20% done)
- Next phase (metadata-annotations) is ready to begin
- Create task in foundation: /task-create 1 002 "Next Task" foundation
```
