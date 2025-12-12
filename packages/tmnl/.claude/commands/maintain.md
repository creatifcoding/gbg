# /maintain - CLAUDE.md Maintenance

Manage the CLAUDE.md file: archive snapshots, update current task, or perform deep culls.

## Usage

Parse the argument after `/maintain`:

- **`/maintain help`** → Show this documentation
- **`/maintain archive`** → Snapshot current CLAUDE.md to `.claude/archives/`
- **`/maintain task`** → Update the "Current Task" section (interactive)
- **`/maintain cull`** → Deep cull of static sections (rare, interactive)
- **`/maintain status`** → Show current structure and line counts

## Instructions

### For `help`:
Display this file's contents.

### For `archive`:
```bash
cp CLAUDE.md .claude/archives/CLAUDE-$(date +%Y-%m-%d-%H%M).md
```
Confirm the archive was created.

### For `task`:
1. Read the current "Current Task" section from CLAUDE.md
2. Use **AskUserQuestion** to ask:
   - "What is the new task name/branch?"
   - "Brief description of what exists so far?"
   - "What are the remaining tasks?"
3. Replace the "Current Task" section with the new content

### For `cull`:
**WARNING: This touches static/foundational sections. Use sparingly.**

1. First, run `archive` automatically
2. Read CLAUDE.md and identify all `## ` level sections
3. Use **AskUserQuestion** with multi-select to present sections:
   - Each section as an option with line count
   - Options: KEEP / CONDENSE / CULL
4. Apply the culling based on responses
5. For CONDENSE: trim code examples, keep only essential info

**Static sections** (Persona, Submodules, Environment, EDIN, AG-Grid) should rarely be culled.
**Dynamic section** (Current Task) rotates with each task.

### For `status`:
Read CLAUDE.md and output:
```
CLAUDE.md Status
================
Total lines: XXX

Sections:
- Persona & Mission (lines X-Y, ~Z lines)
- Submodule Reference (lines X-Y, ~Z lines)
- Environment (lines X-Y, ~Z lines)
- EDIN (lines X-Y, ~Z lines)
- AG-Grid Integration (lines X-Y, ~Z lines)
- Session Journal (lines X-Y, ~Z lines)
- Current Task (lines X-Y, ~Z lines)

Archives: N snapshots in .claude/archives/
```

## Notes

- Always use `cp` for archiving, not fancy rewrites
- The AskUserQuestion tool is **required** for `task` and `cull` subcommands
- Keep static sections stable; rotate dynamic sections freely
