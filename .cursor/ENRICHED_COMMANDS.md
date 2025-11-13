# Enriched Cursor Slash Commands

Your Cursor slash commands have been enhanced with **backlinks, cross-references, and contextual navigation**.

## What's Enriched

Each command now provides:

### 1. **Backlinks & Cross-References**
- Links to related tasks
- Links to parent/child relationships
- Links to documentation
- Related command suggestions

### 2. **Contextual Information**
- Phase definitions
- Task naming conventions
- Status interpretations
- Time tracking insights

### 3. **Smart Navigation**
- Quick action links (e.g., `/task-show <taskId>`)
- Related command suggestions
- Status transition guidance
- Dependency analysis

### 4. **Documentation Links**
- `packages/cms/TASKS.md` - Phase definitions
- `packages/cms/tasks/NAMING.md` - Naming conventions
- `packages/cms/tasks/template.md` - Task templates
- `packages/cms/tasks/schema.json` - Schema definition
- `packages/cms/tasks/types.ts` - Type definitions

## Command Enhancements

### `/task-list`
- Shows status breakdown (pending, in_progress, completed, etc.)
- Calculates progress percentages
- Suggests next steps based on current state
- Links to individual tasks and their actions

**Example with backlinks:**
```
⏳ 01-001 - Complete BaseArchetype [pending]
  → View: /task-show 01-001
  → Update: /task-status 01-001 in_progress
  → Check: /task-deps 01-001
```

### `/task-show`
- Shows all relationships (parent, children, blockers, blocked-by)
- Links to related documentation
- Provides quick action commands
- Suggests next steps based on task state

**Example:**
```
Parent Task: (if subtask) 01-001 → /task-show 01-001
Child Tasks: 01-001-001 → /task-show 01-001-001
Dependencies: None
Blocked by: None

Quick Actions:
- Start: /task-status 01-001 in_progress
- View hierarchy: /task-tree 01-001
- Check deps: /task-deps 01-001
```

### `/task-create`
- Shows existing phases and tasks
- Provides naming guidance
- Links to documentation
- Suggests parent-child relationships
- Links to created task after creation

**Example:**
```
Creating: 01-002 - Install Management SDK

Backlinks:
- Naming schema: packages/cms/tasks/NAMING.md
- Phase definition: packages/cms/TASKS.md
- Parent phase: /task-list foundation

After creation:
- View: /task-show 01-002
- Edit: /task-status 01-002 in_progress
```

### `/task-status`
- Shows current state and context
- Links to parent/sibling tasks
- Provides status transition guidance
- Suggests related actions based on new status

**Example:**
```
Updating: 01-001 - Complete BaseArchetype
Change: pending → in_progress

Related:
- Child task: 01-001-001 (still pending)
- Phase: foundation
- No blockers

Next steps:
- Check subtask progress: /task-tree 01-001
- View full details: /task-show 01-001
```

### `/task-tree`
- Shows task hierarchy with status
- Provides tree statistics
- Links to each task
- Suggests actions based on structure

**Example:**
```
Task Tree:
└── ⏳ 01-001 - Complete BaseArchetype
    ├── /task-show 01-001
    ├── /task-status 01-001 in_progress
    └── 01-001-001 - Implement class structure
        └── /task-show 01-001-001

Statistics:
- Total tasks: 2
- Pending: 2
- In progress: 0
```

### `/task-deps`
- Shows upstream (blockers) and downstream (blocked) tasks
- Links to each dependency
- Provides blocking analysis
- Suggests unblocking actions

**Example:**
```
Task: 01-001 - Complete BaseArchetype

Upstream (Blockers):
- None (ready to start!)

Downstream (Waiting on this):
- 01-001-001 - Implement class structure → /task-show 01-001-001

Analysis:
- This task is NOT blocked
- This task IS blocking 1 other task
- Recommendation: Prioritize to unblock downstream work

Actions:
- Start: /task-status 01-001 in_progress
- View dependent: /task-show 01-001-001
```

### `/task-report`
- Provides comprehensive metrics
- Links to problematic tasks
- Offers specific recommendations
- References documentation

**Example:**
```
Foundation Phase Status:
- 0% complete (0/2 tasks)
- 2 pending, 0 in progress, 0 completed

Blockers: None

Recommendations:
- Start with: 01-001 (no dependencies)
  → /task-status 01-001 in_progress
- Time to completion: ~6 hours
- Phase docs: packages/cms/TASKS.md

Actions:
- View tasks: /task-list foundation
- Check tree: /task-tree
- Start first: /task-status 01-001 in_progress
```

### `/task-validate`
- Shows validation results with categories
- Links to problematic tasks
- Provides fix guidance
- Links to documentation

**Example:**
```
Validation Results:
✅ Total: 2 tasks
✅ Status: Valid (no errors)
⚠️ Warnings: 1

Issue Found:
⚠️ 01-001: References child 01-001-002 that doesn't exist
  - View: /task-show 01-001
  - Fix: Remove or create child
  - Guide: packages/cms/tasks/NAMING.md
```

## Usage Pattern

All commands follow this enriched pattern:

1. **Execute** the command
2. **Display** formatted results with status indicators
3. **Provide** contextual backlinks to:
   - Related tasks (`/task-show`, `/task-tree`, `/task-deps`)
   - Documentation files (`packages/cms/...`)
   - Related commands (`/task-list`, `/task-report`, etc.)
4. **Suggest** intelligent next steps based on state

## Example Workflow

```bash
# 1. View all tasks
/task-list
→ Shows: 2 pending tasks, 0 in progress
→ Suggests: Start with /task-status 01-001 in_progress

# 2. Start a task (click suggested link or type directly)
/task-status 01-001 in_progress
→ Shows: Changed status
→ Links to: Parent (none), Children (01-001-001), Dependencies (none)
→ Suggests: /task-tree to see hierarchy

# 3. View task tree
/task-tree
→ Shows: Hierarchy with all statuses
→ Provides: Links to each task
→ Statistics: 2 tasks, 1 pending, 1 in progress

# 4. Check specific task
/task-show 01-001-001
→ Shows: Full details with backlinks
→ Links to: Parent (01-001), Documentation, Dependencies
→ Suggests: /task-deps to check blockers
```

## Benefits

✅ **No More Lost Context** - Always know related tasks and docs  
✅ **Smart Navigation** - Click through related items easily  
✅ **Self-Documenting** - Every command shows what's related  
✅ **Intelligent Suggestions** - Next steps based on actual state  
✅ **Comprehensive View** - See parent, children, blockers, blocked-by all at once  

## Files Updated

- `task-list.md` - List tasks with rich context
- `task-show.md` - Show task with backlinks
- `task-create.md` - Create with naming guidance
- `task-status.md` - Update with related actions
- `task-validate.md` - Validate with fix guidance
- `task-report.md` - Report with recommendations
- `task-tree.md` - Tree with statistics
- `task-deps.md` - Dependencies with analysis
- `task.md` - Help with command overview

All commands now provide backlinks, cross-references, and contextual navigation to make your task system feel interconnected and easy to navigate!

