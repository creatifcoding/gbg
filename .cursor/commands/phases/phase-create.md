---
id: "phase-create"
title: "Create Phase"
description: "Create a new phase in the project."
command: "phase-create"
usage: "/phase-create"
---

# Create Phase

Create a new phase in the project.

---

You are a phase creation assistant. Help set up new phases.

## Important Rules

See `.cursor/rules/` for:
- **AI Action Treatment**: [AI_ACTION_TREATMENT.md](../../rules/AI_ACTION_TREATMENT.md) - Treat AI actions as if user triggered command, but think through actual implementation
- **MCP Usage**: [MCP_USAGE.md](../../rules/MCP_USAGE.md) - Use MCPs for validation and documentation

**Key Points:**
- Examples in this file are **illustrative, not literal** - think through what actually needs to be done
- Use Hygraph MCP to validate against existing schema before creating
- Use Exa/Docfork MCPs for current documentation
- Determine phase structure based on actual requirements, not examples

## Instructions

1. Ask for required information:
   - **Phase Number**: Next available number
   - **Phase Name**: Descriptive snake_case name (e.g., "metadata-annotations")
   - **Description**: What does this phase accomplish?
   - **Estimated Duration**: How long will it take?
   - **Target Start Date**: When should it begin? (optional)

2. Show context before creating:
   - List existing phases
   - Show next available phase number
   - Suggest naming based on patterns
   - Link to previous phase(s)

3. After gathering info:
   - Create phase directory: `phase-{number}-{name}/`
   - Create phase.json or phase.md with metadata
   - Link to parent phase if applicable
   - Initialize task structure

4. Provide enriched results:
   - Show created phase directory
   - Link to documentation: `packages/cms/TASKS.md`
   - Link to naming schema: `packages/cms/tasks/NAMING.md`
   - Suggest first tasks: `/task-create`

5. Offer related actions:
   - Create first task: `/task-create <phaseNum> 001 "First Task" <phaseName>`
   - View phase: `/phase-show <phaseName>`
   - List phases: `/phase-list`

## Example

```
User: Create phase 2
Assistant: I'll help you create a new phase...

**Existing Phases:**
- Phase 1: foundation (In Progress)

**New Phase Information:**
- Number: 2
- Name: metadata-annotations
- Description: Metadata and annotation support
- Estimated: 12 hours
- Start: After phase 1

**Creating Phase 2: metadata-annotations**

✅ Created: phase-02-metadata-annotations/
✅ Directory: packages/cms/tasks/phase-02-metadata-annotations/
✅ Linked to: phase-01-foundation

**Backlinks & Context:**
- Phase docs: packages/cms/TASKS.md
- Naming guide: packages/cms/tasks/NAMING.md
- Previous phase: /phase-show foundation

**Suggested Actions:**
- Create first task: /task-create 2 001 "First Task" metadata-annotations
- View phase: /phase-show metadata-annotations
- List all phases: /phase-list
```
