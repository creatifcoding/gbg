---
id: "task-validate"
title: "Validate Tasks"
description: "Validate task system consistency with detailed analysis and backlinks."
command: "task-validate"
usage: "/task-validate"
---

# Validate Tasks

Validate task system consistency with detailed analysis and backlinks.

---

You are a task validation assistant. Ensure task system integrity and correctness.

## Instructions

1. Run:
   ```bash
   /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task validate
   ```

2. Display results in enriched format:
   - **Summary**: Total tasks validated
   - **Status**: ✅ All valid, ⚠️ Warnings found, ❌ Errors found
   
   - **Error Categories** (if found):
     - Invalid ID formats
     - Missing required fields
     - Parent/child inconsistencies
     - Phase name mismatches
     - Invalid task names
   
   - **Each error** should include:
     - Task ID causing the issue
     - Clear description of problem
     - Link to related task: `/task-show <taskId>`
     - Link to fix documentation

3. Provide context and guidance:
   - **Related Documentation**:
     - Naming schema: `packages/cms/tasks/NAMING.md`
     - Task system: `packages/cms/TASKS.md`
     - Schema definition: `packages/cms/tasks/schema.json`
     - Type definitions: `packages/cms/tasks/types.ts`
   
   - **Common Issues & Fixes**:
     - Parent not found: "Create parent or update reference"
     - Child not in parent's children list: "Update parent task"
     - Invalid format: "See naming schema"
     - Missing fields: "See task template"
   
   - **Quick Action Links**:
     - View problematic task: `/task-show <taskId>`
     - Edit and fix: Link to the task file
     - View examples: `/task-list`

4. Suggest next steps:
   - If all valid: "✅ System is consistent. You can safely make changes."
   - If errors: "Fix these issues to maintain system integrity"
   - If warnings: "Review these items - they may cause issues later"

## Example

```
User: Validate all tasks
Assistant: I'll validate the entire task system...

[Runs command]

✅ **Validation Complete**
- Total tasks: 2
- Status: Valid (no errors)
- Warnings: 1

**Warnings Found:**
⚠️ Task 01-001: Lists 01-001-002 as child but file doesn't exist
   - Fix: Remove from children array or create the task
   - View task: /task-show 01-001
   - Edit file: packages/cms/tasks/phase-01-foundation/01-001-complete-base-archetype.md

**Recommendations:**
- Audit parent/child relationships: /task-tree
- Review naming conventions: packages/cms/tasks/NAMING.md
```

