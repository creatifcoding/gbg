# Templates Directory

Templates for creating tasks, phases, and related documentation.

## Available Templates

### Task Templates

- **[TASK_TEMPLATE.md](TASK_TEMPLATE.md)** - Task file structure and usage
  - Front matter fields
  - Content structure
  - Examples (root, subtask, dependent)
  - Best practices

### Phase Templates

- **[PHASE_TEMPLATE.md](PHASE_TEMPLATE.md)** - Phase directory and documentation
  - Directory structure
  - phase.json metadata format
  - README.md template
  - Field reference
  - Phase lifecycle

### Documentation Guidelines

- **[PHASE_DOCUMENTATION_GUIDE.md](PHASE_DOCUMENTATION_GUIDE.md)** - Detailed documentation standards
  - Documentation structure
  - Writing guidelines
  - Examples
  - Best practices

## Quick Reference

### Create a New Task

```
/task-create <phase> <id> "<title>" <phaseName>
```

Uses: [TASK_TEMPLATE.md](TASK_TEMPLATE.md)

### Create a New Phase

```
/phase-create
```

Uses: [PHASE_TEMPLATE.md](PHASE_TEMPLATE.md)

## Directory Structure

```
templates/
├── README.md (this file)
├── TASK_TEMPLATE.md
├── PHASE_TEMPLATE.md
└── PHASE_DOCUMENTATION_GUIDE.md
```

## Usage in Commands

All Cursor commands reference these templates:

**Task Commands:**
- `/task-create` — Uses TASK_TEMPLATE.md
- `/task-show` — References template fields
- `/task-list` — Validates against template

**Phase Commands:**
- `/phase-create` — Uses PHASE_TEMPLATE.md
- `/phase-show` — Displays template structure
- `/phase-report` — Analyzes template content

## Template Fields

### Task Template Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `id` | Unique identifier | 01-001 |
| `title` | Full title | Complete BaseArchetype |
| `shortTitle` | Kebab-case reference | complete-base-archetype |
| `status` | Current state | pending |
| `phase` | Phase number | 1 |
| `phaseName` | Phase name | foundation |
| `priority` | Task priority | high |

### Phase Template Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `id` | Phase number | 1 |
| `name` | snake_case name | foundation |
| `displayName` | User-friendly name | Phase 1: Foundation |
| `status` | Phase state | active |
| `estimatedHours` | Time estimate | 8 |

## Customization

Templates can be customized for your needs:

1. **Copy template** to your workspace
2. **Modify fields** as needed
3. **Add custom sections** for your workflow
4. **Update commands** to reference custom templates

## Related Documentation

- Main guide: [../../packages/cms/TASKS.md](../../packages/cms/TASKS.md)
- Task naming: [../../packages/cms/tasks/NAMING.md](../../packages/cms/tasks/NAMING.md)
- Short titles: [../../packages/cms/tasks/SHORT_TITLES.md](../../packages/cms/tasks/SHORT_TITLES.md)
- Command reference: [../COMMAND_SUMMARY.md](../COMMAND_SUMMARY.md)

---

**Tips:**
- Keep templates up-to-date
- Reference in documentation
- Validate against templates
- Use in commands

