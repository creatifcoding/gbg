# Cursor Commands Organization

Complete guide to the reorganized command structure.

## Overview

Commands are now organized into logical folders:
- **tasks/** - Task management (8 commands)
- **phases/** - Phase management (6 commands)  
- **templates/** - Documentation templates (4 templates)
- Root level - Help commands and guides

## Directory Structure

```
.cursor/commands/
├── INDEX.md                    # Command index (START HERE)
├── task.md                     # Task management help
├── phase.md                    # Phase management help
├── tasks/                      # Task commands (8)
│   ├── task-create.md
│   ├── task-list.md
│   ├── task-show.md
│   ├── task-status.md
│   ├── task-validate.md
│   ├── task-report.md
│   ├── task-tree.md
│   └── task-deps.md
├── phases/                     # Phase commands (6)
│   ├── phase-list.md
│   ├── phase-show.md
│   ├── phase-report.md
│   ├── phase-tree.md
│   ├── phase-create.md
│   └── phase-next.md
└── templates/                  # Templates (4)
    ├── README.md
    ├── TASK_TEMPLATE.md
    ├── PHASE_TEMPLATE.md
    └── PHASE_DOCUMENTATION_GUIDE.md
```

## Accessing Commands

All commands still work in Cursor Agent:

```
/task              # Help
/task-create       # Create task
/task-list         # List tasks
...

/phase             # Help
/phase-create      # Create phase
/phase-list        # List phases
...
```

Location on disk doesn't affect command availability - Cursor finds them by name!

## Documentation Files

Root-level documentation (in `.cursor/`):

```
.cursor/
├── README.md                   # Quick start
├── COMMAND_SUMMARY.md          # All commands reference
├── TASK_COMMANDS.md            # Task commands guide
├── PHASE_COMMANDS.md           # Phase commands guide
├── ENRICHED_COMMANDS.md        # Backlinks & context
├── CURSOR_COMMANDS.md          # Cursor slash commands
├── ORGANIZATION.md             # This file
└── commands/
    ├── INDEX.md                # Command index
    └── [organized commands]
```

## Navigation Guide

### For Users (Quick Start)

1. **First time?** Read `.cursor/README.md`
2. **Want overview?** Read `commands/INDEX.md`
3. **Running a command?** Type `/` in Cursor Agent
4. **Need details?** Check `commands/{type}/{command}.md`

### For Developers

1. **Understand structure?** Read `ORGANIZATION.md` (this file)
2. **Check templates?** See `commands/templates/`
3. **See implementation?** Check `scripts/`
4. **Full reference?** Read `COMMAND_SUMMARY.md`

### By Use Case

**"I'm new, where do I start?"**
→ `.cursor/README.md` → `commands/INDEX.md`

**"How do I manage tasks?"**
→ `TASK_COMMANDS.md` → `/task-list`

**"How do I manage phases?"**
→ `PHASE_COMMANDS.md` → `/phase-list`

**"All commands in one place?"**
→ `COMMAND_SUMMARY.md`

**"I need documentation templates"**
→ `commands/templates/`

## File Organization Benefits

### ✅ Better Organization
- Task commands grouped together
- Phase commands grouped together
- Templates in dedicated folder
- Help and guides at root

### ✅ Easier Discovery
- Related commands together
- Clear naming convention
- Logical hierarchy
- INDEX.md for overview

### ✅ Scalability
- Easy to add new command types
- Room for more templates
- Organized for growth
- Clear patterns to follow

### ✅ Maintenance
- Easier to find specific commands
- Templates centralized
- Consistent structure
- Better documentation organization

## How Cursor Finds Commands

Cursor doesn't care about directory structure - it finds commands by name:

```
/task-create        → commands/tasks/task-create.md
/phase-list         → commands/phases/phase-list.md
/task               → commands/task.md
/phase              → commands/phase.md
```

**The organization is for human readability and navigation!**

## Adding New Commands

To add a new task command:

1. Create `commands/tasks/{name}.md`
2. Follow `TASK_TEMPLATE.md` format
3. Add to `commands/INDEX.md`
4. Update `.cursor/README.md` if needed

To add a new phase command:

1. Create `commands/phases/{name}.md`
2. Follow `PHASE_TEMPLATE.md` format
3. Add to `commands/INDEX.md`
4. Update `.cursor/README.md` if needed

## Quick Reference

### Command Count

- **Task commands**: 8
  - Create, List, Show, Status, Report, Validate, Tree, Deps
- **Phase commands**: 6
  - List, Show, Report, Tree, Create, Next
- **Help commands**: 2
  - `/task`, `/phase`
- **Total**: 16 commands

### Template Count

- **Task Template**: 1
- **Phase Templates**: 2 (template + guide)
- **Total**: 4 templates

## Documentation Map

```
Getting Started:
  .cursor/README.md → .cursor/SETUP_GUIDE.md

Command References:
  .cursor/COMMAND_SUMMARY.md
  .cursor/TASK_COMMANDS.md
  .cursor/PHASE_COMMANDS.md
  .cursor/commands/INDEX.md

Detailed Guides:
  .cursor/ENRICHED_COMMANDS.md
  .cursor/CURSOR_COMMANDS.md

Templates:
  .cursor/commands/templates/TASK_TEMPLATE.md
  .cursor/commands/templates/PHASE_TEMPLATE.md
  .cursor/commands/templates/PHASE_DOCUMENTATION_GUIDE.md
```

## Maintenance

### Update Schedule

- **Daily**: Use commands
- **Weekly**: Update command content
- **Monthly**: Review organization
- **As needed**: Add new commands

### Consistency

All commands should:
- Follow template structure
- Include backlinks
- Provide examples
- Suggest next steps
- Use consistent formatting

## Related Systems

### Task System
- `packages/cms/tasks/TASKS.md` - Full guide
- `packages/cms/tasks/template.md` - Task file template
- `packages/cms/tasks/types.ts` - TypeScript definitions

### Phase System
- `packages/cms/tasks/phase-0X-*/` - Phase directories
- `packages/cms/tasks/phase-0X-*/phase.json` - Phase metadata
- `packages/cms/tasks/phase-0X-*/README.md` - Phase docs

## Troubleshooting

**Command not found in Cursor?**
- Type `/` to see available commands
- Check `commands/INDEX.md`
- Ensure file exists in correct folder
- Restart Cursor if needed

**Can't find a command?**
- Check `commands/INDEX.md`
- Search `COMMAND_SUMMARY.md`
- Use `/` in Cursor to browse

**Want to reorganize further?**
- Update folder structure
- Update `INDEX.md`
- Update `.cursor/README.md`
- Cursor will find them automatically

## Future Enhancements

Potential additions:
- Workflow-based command grouping
- Project-level commands
- Configuration commands
- Team collaboration commands
- Analytics commands
- Integration commands

---

**Version**: 1.0
**Last Updated**: 2024-11-13
**Status**: Production Ready

See: [commands/INDEX.md](commands/INDEX.md) for complete command index.

