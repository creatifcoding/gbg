# Cursor Slash Commands

You now have **Cursor slash commands** for task management. These integrate directly with Cursor's Agent interface and can be invoked by typing `/` in the chat.

## Based on [Cursor 1.6 Release](https://cursor.com/changelog/1-6)

Cursor slash commands are now natively supported and stored in `.cursor/commands/[command].md` files. Type `/` in the Agent chat to see all available commands!

## Available Commands

Type `/` in the Cursor Agent chat and you'll see:

- **`/task`** - Get help with task management
- **`/task-create`** - Create a new task
- **`/task-list`** - List tasks by phase
- **`/task-show`** - Show task details
- **`/task-status`** - Update task status
- **`/task-validate`** - Validate all tasks
- **`/task-report`** - Generate status report
- **`/task-tree`** - Show task hierarchy
- **`/task-deps`** - Show dependencies

## How to Use

### In Cursor Agent Chat

1. Open Cursor Agent (Cmd+K or your shortcut)
2. Type `/` to see available commands
3. Select a task command (e.g., `/task-list`)
4. The command's prompt will guide you through the steps
5. The command will execute the underlying CLI and display results

### Example Workflow

```
You: /task-create
Agent: I'll help you create a new task. What phase is this for? (1, 2, 3...)
You: 1
Agent: What task ID? (001, 002, etc.)
You: 002
...
Agent: Creating task... ✅ Task created!
```

## Command Details

### `/task`
Quick help and navigation for the task system. Shows available commands and what they do.

### `/task-create`
Create a new task with proper naming. Asks for:
- Phase number
- Task ID
- Title
- Phase name (snake_case)
- Optional parent task ID

### `/task-list`
View tasks. Filter by phase or see all tasks.

### `/task-show`
View detailed information about a specific task, including:
- Status and priority
- Parent/child relationships
- Dependencies
- Time estimates
- Full content

### `/task-status`
Update a task's status:
- `pending` - Not started
- `in_progress` - Currently working
- `completed` - Done  
- `blocked` - Can't proceed
- `cancelled` - No longer needed

### `/task-validate`
Check all tasks for consistency and correctness. Reports:
- Errors (if any)
- Warnings
- Overall validation status

### `/task-report`
Generate status reports. Shows:
- Task counts by status
- Task counts by priority
- Time estimates vs actual
- Completion percentage

### `/task-tree`
Display task hierarchy with:
- Status indicators
- Parent-child relationships
- Visual tree structure

### `/task-deps`
Show dependency graph:
- Upstream dependencies (tasks this depends on)
- Downstream dependencies (tasks that depend on this)
- Critical path analysis

## How Commands Work

Each command:
1. Guides you through collecting required information
2. Runs the corresponding CLI script in `.cursor/scripts/`
3. Displays formatted results
4. Offers follow-up actions

## Behind the Scenes

The commands are stored as markdown files in `.cursor/commands/` and include:
- Interactive prompts (handled by Cursor Agent)
- CLI command execution
- Result formatting and explanation
- Helpful context for each operation

## File Structure

```
.cursor/
├── commands/
│   ├── task.md              # Help command
│   ├── task-create.md       # Create task
│   ├── task-list.md         # List tasks
│   ├── task-show.md         # Show details
│   ├── task-status.md       # Update status
│   ├── task-validate.md     # Validate
│   ├── task-report.md       # Generate report
│   ├── task-tree.md         # Show hierarchy
│   └── task-deps.md         # Show dependencies
├── scripts/                 # Implementation scripts
├── task                     # CLI wrapper
└── shell-init.sh           # Shell aliases
```

## Integration with Task System

These commands integrate with your full task management system:
- **Naming**: Follows snake_case conventions
- **Storage**: Tasks stored in `packages/cms/tasks/`
- **Validation**: Enforces schema consistency
- **Hierarchy**: Supports parent-child relationships
- **Tracking**: Full status and time tracking

## Tips

1. **Start with `/task`** - Get oriented with what's available
2. **Use `/task-list foundation`** - See what you're working on
3. **Use `/task-status`** - Keep status updated
4. **Use `/task-report`** - Check overall progress
5. **Use `/task-validate`** - Catch inconsistencies early

## Documentation References

- Main docs: `.cursor/README.md`
- Setup guide: `.cursor/SETUP_GUIDE.md`
- Shell commands: `.cursor/SLASH_COMMANDS.md`
- Task system: `packages/cms/TASKS.md`
- Naming conventions: `packages/cms/tasks/NAMING.md`

---

**Now you have three ways to manage tasks:**

1. **Cursor Slash Commands** (Recommended in Cursor Agent) - Type `/task-*` in chat
2. **Shell Commands** - Use `task list`, `task create`, etc. in terminal
3. **Direct CLI** - Run `.cursor/task list`, `.cursor/task create`, etc.

Pick whichever is most convenient for your workflow!

