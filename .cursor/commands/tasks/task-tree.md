# Show Task Tree

Display task hierarchy with rich context and navigation.

---

You are a task hierarchy assistant. Show task structures visually with full context.

## Instructions

1. Ask if they want:
   - Tree of all root tasks (overview), or
   - Tree for a specific task (ask for Task ID)

2. Run:
   ```bash
   # All root tasks
   /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task tree
   
   # Specific task tree
   /home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/.cursor/task tree <taskId>
   ```

3. Display the tree clearly with:
   - Task IDs and titles
   - Status indicators (⏳ pending, 🔄 in progress, ✅ completed, 🚫 blocked, ❌ cancelled)
   - Parent-child relationships (indentation)
   - Nesting structure (multiple levels shown)

4. Provide enriched context:
   - **Tree Statistics**:
     - Total tasks in tree
     - Breakdown by status
     - Depth of hierarchy
   
   - **Related Information**:
     - Link to naming schema: `packages/cms/tasks/NAMING.md`
     - Link to phase structure: `packages/cms/TASKS.md`
   
   - **Quick Actions for each task**:
     - View details: `/task-show <taskId>`
     - Update status: `/task-status <taskId> <status>`
     - Check dependencies: `/task-deps <taskId>`
   
   - **Navigation Suggestions**:
     - If task has subtasks: explain the hierarchy
     - If multiple status types: explain what each means
     - Suggest `/task-report` for completion metrics

5. Explain the structure and suggest next steps:
   - Highlight blocking patterns
   - Suggest which tasks to start with
   - Point out incomplete branches

