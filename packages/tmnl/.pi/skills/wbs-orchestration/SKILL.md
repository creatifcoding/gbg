---
name: wbs-orchestration
description: |
  WBS-driven work sessions and parallel agent orchestration.
  Modes: STATUS (show progress), NEXT (dispatch agents), FINISH (close epic), BLAST (max parallel).
triggers:
  - "wbs"
  - "epic"
  - "next.*task"
  - "parallel.*agent"
  - "blast"
  - "finish.*epic"
  - "wave.*dispatch"
  - "work session"
  - "v3 architecture"
---

# WBS Orchestration Skill

## Purpose

Unified WBS (Work Breakdown Structure) management:
1. **Session tracking** — Progress display, task claiming, session logging
2. **Agent orchestration** — Parallel agent dispatch in coordinated waves

---

## Mode Detection

| User Says | Mode | Action |
|-----------|------|--------|
| "/wbs", "status", "progress" | `STATUS` | Display progress, suggest next tasks |
| "continue", "go", "next" | `NEXT` | Dispatch agents for next pending tasks |
| "finish", "complete", "wrap up" | `FINISH` | Fix errors, run tests, close all tasks |
| "blast", "parallel", "all" | `BLAST` | Maximum parallel agents across epics |
| "claim <task>" | `CLAIM` | Mark task 🔄 in tracker |
| "complete <task>" | `COMPLETE` | Mark task ✅ in tracker |
| "log" | `LOG` | Show recent session logs |

---

## Session Start Protocol (MODE: STATUS)

### Step 1: Read Progress Tracker

```bash
cat .claude/plans/enumerated-crafting-otter.md
```

### Step 2: Parse Current State

- Find epic with 🎯 marker (current focus)
- Count ✅ vs ⏳ tasks
- Calculate progress percentage

### Step 3: Display Status

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 WBS STATUS — V3 Service Architecture
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Progress: XX% (XX/267 SP)
Current Epic: N — [Epic Name]

🎯 NEXT TASKS:
  • [Task ID] — [Description]
  • [Task ID] — [Description]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 4: Create Session Tasks

Use TaskCreate for each 🎯/⏳ task in current epic.

---

## Agent Dispatch Protocol (MODE: NEXT/BLAST)

### Step 1: Context Load

```
1. TaskList → Get current task status
2. Read WBS tracker → epic requirements
3. Identify: completed, in_progress, pending, blocked
```

### Step 2: Wave Dispatch

```
WAVE 1 (Foundation) — Parallel
├─ kraken-<feature-a>  → Task #X
├─ kraken-<feature-b>  → Task #Y
└─ kraken-<feature-c>  → Task #Z

↓ Wait for Wave 1 completion

WAVE 2 (Integration) — Parallel
├─ kraken   → Service refactoring
├─ arbiter  → Integration tests
└─ spark    → TypeScript error fixes
```

**Key**: Dispatch ALL agents in a SINGLE message for parallel execution.

### Agent Selection Matrix

| Task Type | Agent | Required Research |
|-----------|-------|-------------------|
| New implementation (TDD) | `kraken` | deepwiki, effect-docs, domain skill |
| Bug investigation | `debug-agent` | /spike-testing |
| Integration tests | `arbiter` | /effect-patterns |
| Quick fixes (<50 lines) | `spark` | tsc verification |
| Codebase exploration | `scout` | grep, glob |
| Architecture planning | `architect` | /effect-service-authoring |

---

## Finish Protocol (MODE: FINISH)

```
1. Run `bunx tsc --noEmit` — fix any errors
2. Run tests for current epic
3. Update all in_progress → completed
4. Update tracker: 🔄 → ✅
5. Generate deliverables table
6. Append to session log
```

---

## Session End Protocol

### Step 1: Update Tracker

Edit `.claude/plans/enumerated-crafting-otter.md`:
- Change ⏳ → ✅ for completed tasks
- Change 🔄 → ✅ for finished in-progress

### Step 2: Log Session

Append to `.claude/plans/wbs-session-log.md`:

```markdown
## YYYY-MM-DD — Session [short-id]
**Agent:** [name]
**Epic:** [N] ([Name])
**Completed:** [task IDs]
**Next:** [next task ID + description]
**Blockers:** [any blockers or "None"]
```

### Step 3: Identify Next

Find next 🎯 task for future sessions.

---

## Files

| File | Purpose |
|------|---------|
| `.claude/plans/enumerated-crafting-otter.md` | Progress tracker (source of truth) |
| `.claude/plans/wbs-session-log.md` | Session completion log |
| `thoughts/shared/plans/2026-01-26-v3-service-architecture-wbs.md` | Full WBS spec |

---

## Progress Symbols

| Symbol | Meaning |
|--------|---------|
| ✅ | Complete |
| 🔄 | In Progress |
| ⏸️ | Blocked |
| ⏳ | Not Started |
| 🎯 | Next Up |

---

## Task Status Protocol

```typescript
// On agent dispatch
TaskUpdate({ taskId, status: 'in_progress' })

// On agent completion
TaskUpdate({ taskId, status: 'completed' })

// On blocker
TaskUpdate({ taskId, status: 'pending', description: 'BLOCKED: <reason>' })
```

---

## Quality Gates

Before reporting epic complete:

- [ ] `bunx tsc --noEmit` passes (0 errors)
- [ ] All tests pass for affected files
- [ ] All task statuses updated to `completed`
- [ ] Tracker markdown updated (🔄 → ✅)
- [ ] Session log appended
- [ ] Deliverables table generated

---

## Agent Dispatch Template

Each agent MUST receive:

```markdown
## Task #N: <Task Title>

You are <agent-type>, a <role-description>.

### Research First
- Use **deepwiki** MCP for @Effect-TS/effect patterns
- Use **effect-docs** MCP for API reference
- Invoke **/<domain-skill>** for context

### Requirements
[Specific task requirements from WBS]

### TDD Workflow
1. Write failing test
2. Implement minimal code
3. Verify test passes
4. Refactor if needed

### Verification
- Run `bunx tsc --noEmit` before completion
- All tests must pass

### Report
Write to `.claude/cache/agents/<type>/latest-output.md`
```

---

## Decision Tree

```
User invokes /wbs or /wbs-orchestration
│
├─ Parse mode from user message
│   ├─ "status/progress"     → MODE: STATUS
│   ├─ "finish/complete"     → MODE: FINISH
│   ├─ "blast/parallel"      → MODE: BLAST
│   ├─ "claim <task>"        → MODE: CLAIM
│   ├─ "complete <task>"     → MODE: COMPLETE
│   ├─ "log"                 → MODE: LOG
│   └─ "next/go/continue"    → MODE: NEXT
│
├─ Load context
│   ├─ Read tracker → enumerated-crafting-otter.md
│   └─ TaskList → current task status
│
├─ Execute mode
│   ├─ STATUS   → Display progress, suggest tasks
│   ├─ NEXT     → Wave 1 → Wave 2 agent dispatch
│   ├─ FINISH   → Fix errors, tests, close tasks
│   ├─ BLAST    → Max parallel agents
│   ├─ CLAIM    → Mark task 🔄 in tracker
│   ├─ COMPLETE → Mark task ✅ in tracker
│   └─ LOG      → Show session log
│
└─ Report
    ├─ Progress percentage
    ├─ Test counts
    ├─ Deliverables table
    └─ Next epic preview
```

---

## Multi-Agent Coordination Rules

| Rule | Implementation |
|------|----------------|
| One epic per session | Check 🔄 markers before claiming |
| Verify before complete | Tests + TypeScript = ✅ |
| Log everything | Session log is mandatory |
| Git-based locking | Commit immediately after claiming |

---

## Recovery Protocol

If context compacts:

```
1. TaskList → identify last known state
2. Read `.claude/cache/agents/*/latest-output.md`
3. Read tracker → find 🔄 tasks
4. Resume from next pending task
```

---

## Sub-Skills to Invoke

| Context | Skill |
|---------|-------|
| Effect-TS patterns | `/effect-patterns` |
| Schema definitions | `/effect-schema-mastery` |
| Service authoring | `/effect-service-authoring` |
| IIoT domain | `/iiot-isa95-hierarchy` |
| Debugging | `/spike-testing` |
| Atom state | `/effect-atom-integration` |

---

## Example Invocations

### Show Status
```
User: "/wbs"
Claude: [Reads tracker, displays progress, suggests next tasks]
```

### Continue WBS
```
User: "next"
Claude: [Loads TaskList, identifies pending, dispatches Wave 1]
```

### Finish Epic
```
User: "/wbs finish"
Claude: [Runs tsc, fixes errors, runs tests, closes tasks, logs session]
```

### Maximum Parallel
```
User: "blast all pending tasks"
Claude: [Dispatches 5 parallel agents across epics]
```

### Claim Task
```
User: "/wbs claim EL-2.3"
Claude: [Marks EL-2.3 as 🔄 in tracker, creates TaskCreate entry]
```

---

## Related Skills

| Skill | Purpose |
|-------|---------|
| `/iterative-plan-execution` | Phase-by-phase plan execution |
| `/spike-testing` | Hypothesis-driven debugging |
| `/effect-patterns` | Effect-TS patterns |
| `/grounded-research` | Research before implementation |
