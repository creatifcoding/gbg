# CTL TUI Architecture Plan - Iterative Execution

## One-Liner

```bash
claude --print "$(cat .claude/ralph-prompts/CTL_PLAN_ITERATION.md)"
```

Or with explicit plan path:

```bash
PLAN_FILE=~/.claude/plans/ctl-tui-architecture.md claude --print "$(cat .claude/ralph-prompts/CTL_PLAN_ITERATION.md)"
```

---

## Ralph Prompt (Copy Below This Line)

```
Execute iterative CTL TUI Architecture plan implementation.

## Pre-Iteration Protocol (MANDATORY)

Before ANY implementation work, invoke:

/plan-iteration-checkpoint

This skill will:
1. ASSESS current progress against the plan phases
2. DETERMINE next steps forward
3. DOCUMENT current intention to .agents/val/journal/

## Plan Reference

PLAN: packages/ctl (CTL TUI Architecture Enhancement Plan)

Phases:
1. Foundation (Hexagonal Restructure)
2. Ink Inline Rendering
3. Agent Output Mode
4. Project Discovery & CTL.md
5. Claude Agent SDK Integration
6. Agentic Scaffolding
7. OpenTUI Full Application
8. Component Catalog & Documentation

## Iteration Cycle

Each iteration:

1. **CHECKPOINT** - Invoke /plan-iteration-checkpoint
2. **IMPLEMENT** - Work on ONE phase or sub-task
3. **VERIFY** - Run tests, type-check
4. **COMMIT** - Atomic commit with clear message
5. **BEADS** - Update beads if applicable

## Authority

You have authority to:
- Research via MCPs (deepwiki, effect-docs)
- Implement code within packages/ctl
- Create/run tests
- Create beads for tracking
- Commit atomically

You do NOT have authority to:
- Modify code outside packages/ctl without asking
- Skip the checkpoint protocol
- Push to remote
- Delete existing functionality

## Termination Conditions

STOP the loop when:
- Current phase is complete
- Blocked on external dependency
- User intervention required
- 3+ consecutive failures on same task

## Context Files

- Dynamic context: .claude/ralph-loop-context.md
- Iteration journals: .agents/val/journal/
- Plan details: Read the full plan in the session transcript

## Go

Start by invoking /plan-iteration-checkpoint to assess current state.
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| Start loop | `claude --print "$(cat .claude/ralph-prompts/CTL_PLAN_ITERATION.md)"` |
| Check progress | `ls .agents/val/journal/` |
| View last checkpoint | `cat .agents/val/journal/$(ls -t .agents/val/journal/ \| head -1)` |
| Cancel | Ctrl+C or `/stop` |

## Integration with Hook

The `iteration_summary` hook (Stop event) will automatically write a summary
when the iteration concludes, capturing:
- Phase completion status
- Recent file changes
- Next iteration recommendations
