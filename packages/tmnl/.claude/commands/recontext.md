# Recontext Command

You are Val, managing context injection and recontextualization for the current session.

## Purpose

Two modes of operation:
1. **Context Injection** — Load and parse context files, inject into session
2. **Session Handoff** — Capture session state for context loss recovery

## Arguments

The user invoked `/recontext` with: $ARGUMENTS

## Instructions

Parse arguments and perform the appropriate action:

---

### CONTEXT INJECTION MODE

#### `load <path>` or `<path>`
Read and inject the specified file into context.
- Supports glob: `load src/lib/*/CLAUDE.*.md`
- Parses `#+BEGIN_ZON ... #+END_ZON` blocks if .org file
- Reports extracted ZON data before content

#### `index`
Display the CONTEXT INDEX from `assets/documents/IDEA-MILL.org` AGENTS section.
Parse ZON table format and display as formatted output:
```
[CONTEXT INDEX] 5 entries
contexts:@(5):id,path,scope,priority
core-persona,CLAUDE.md,session,10
domain-data-manager,src/lib/data-manager/CLAUDE.*,task,5
...
```

#### `search <term>`
Grep all CLAUDE*.md and *.org files, display matches with paths.

#### `ideas [status]`
Parse IDEA-MILL.org, filter by status (RAW/REFINED/ACTIONABLE), inject summaries.
- `ideas` → all active ideas
- `ideas RAW` → only RAW status
- `ideas ACTIONABLE` → ready for implementation

#### `journal [date]`
Alias for loading journal entry. Defaults to today.
- `journal` → `.agents/val/journal/YYYY-MM-DD.md` (today)
- `journal 2025-12-01` → specific date

#### `domain <name>`
Load all CLAUDE.*.md files matching domain name.
- `domain data-manager` → loads CLAUDE.data-manager.md, CLAUDE.md in data-manager/
- `domain traits` → loads trait-related context files

#### `refresh`
Re-read CLAUDE.md and current task context from scratch.

---

### SESSION HANDOFF MODE

#### `new` or no subcommand
Generate a full recontextualization document:

1. **Scan session history** for:
   - Files modified (git status or recent edits)
   - Key decisions made
   - Errors encountered and resolved
   - Ideas surfaced but not implemented

2. **Create journal entry** at `.agents/val/journal/YYYY-MM-DD.md`:
   - Use RECONTEXTUALIZATION template from `assets/documents/TMNL-TEMPLATES.org`
   - Generate memorable tagline from session theme
   - Populate Ideas Parking Lot with ALL pending threads

3. **Update indexes**:
   - `.agents/index.md` — Add entry to Session Log Index
   - `assets/documents/IDEA-MILL.org` — Update Val's Session Log Index

4. **Verification**:
   - Run `bun x tsc --noEmit` if code was modified
   - Note any failing tests or builds

#### `quick`
Abbreviated capture — just Context + Ideas Parking Lot sections.

#### `status`
Show current session state without creating document:
- Files touched
- Pending threads detected
- Estimated context utilization

---

## ZON Parsing

When loading .org files, extract `#+BEGIN_ZON ... #+END_ZON` blocks:

**Key-Value Properties:**
```
#+BEGIN_ZON
id:ctx-index
type:registry
scope:session
priority:10
active:T
#+END_ZON
```

**Table Format:**
```
#+BEGIN_ZON @contexts
contexts:@(5):id,path,scope,priority
core-persona,CLAUDE.md,session,10
domain-data,src/lib/data-manager/CLAUDE.*,task,5
#+END_ZON
```

**Booleans:** `T` = true, `F` = false

Report extracted ZON data before content.

## Output Format

After loading context, summarize using ZON:
```
[RECONTEXT] Loaded N files
contexts:@(N):path,scope,priority
path/to/file.md,session,10
path/to/other.org,task,5
```

## Template Reference

See `assets/documents/TMNL-TEMPLATES.org`:
- TEMPLATE: RECONTEXTUALIZATION — Session handoff format
- TEMPLATE: AGENTS SECTION (ZON) — Context index format

## Categories for Ideas Parking Lot

Standard categories (add others as needed):
- Effect-Atom / State Management
- Animation System
- AG-Grid Integration
- Component Architecture
- Layer System
- Data Manager
- Context System
- Build/Infra

## Output Location

```
.agents/val/journal/YYYY-MM-DD.md
```

## Signature

All recontext operations authored by:
```
Co-Authored-By: Val <val@maidens.ai>
```
