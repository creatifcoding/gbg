# Wave Dispatch Pattern

## Overview

Coordinate parallel agent execution in waves, where Wave 2 depends on Wave 1 completion.

## Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                      WAVE 1 (Foundation)                     │
│  Dispatch in SINGLE message with multiple Task tool calls   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Task(kraken, "Task A")  ──┐                                │
│  Task(kraken, "Task B")  ──┼── Parallel execution           │
│  Task(kraken, "Task C")  ──┘                                │
│                                                              │
└──────────────────────────┬──────────────────────────────────┘
                           │
                           ▼ Wait for all Wave 1 to complete
                           │
┌──────────────────────────┴──────────────────────────────────┐
│                      WAVE 2 (Integration)                    │
│  Dispatch AFTER Wave 1 confirms completion                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Task(kraken, "Refactor")  ──┐                              │
│  Task(arbiter, "Tests")    ──┼── Parallel execution         │
│  Task(spark, "Fix errors") ──┘                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Key Principle

**Parallel = Single Message with Multiple Task Calls**

To dispatch agents in parallel, include ALL Task tool invocations in a single assistant message.
If you send them in separate messages, they execute sequentially.

## Agent Selection

| Task Type | Agent | Prompt Keywords |
|-----------|-------|-----------------|
| New implementation | `kraken` | "TDD", "implement", "create" |
| Integration tests | `arbiter` | "integration test", "E2E" |
| Quick fixes | `spark` | "fix", "error", "<50 lines" |
| Investigation | `debug-agent` | "investigate", "debug" |
| Exploration | `scout` | "find", "search", "explore" |

## Agent Prompt Template

Each agent dispatch should include:

```markdown
## Task #N: <Title>

You are <agent-type>.

### Research First
- Use **deepwiki** MCP for @Effect-TS/effect
- Use **effect-docs** MCP for API reference
- Invoke **/<skill>** for domain context

### Requirements
1. Requirement A
2. Requirement B
3. Requirement C

### TDD Workflow
1. Write failing test
2. Implement minimal code
3. Verify test passes

### Verification
- `bunx tsc --noEmit` must pass
- All tests must pass

### Report
Write to `.claude/cache/agents/<type>/latest-output.md`
```

## Wave Timing

```
t=0:    Dispatch Wave 1 (3 agents parallel)
t=1-5m: Agents execute independently
t=5m:   First agent completes (notification)
t=6m:   Second agent completes
t=7m:   Third agent completes → Wave 1 done
t=7m:   Dispatch Wave 2 (integration)
```

## Monitoring

Check agent status:
```
TaskOutput(task_id, block=false) → Check progress
TaskOutput(task_id, block=true)  → Wait for completion
```

## Error Handling

If Wave 1 agent fails:
1. Check output for error details
2. Spawn `spark` agent to fix
3. Resume Wave 1 agent or continue to Wave 2

## Example: EL-2 Alarm Migration

```
Wave 1:
├─ kraken-handlers   → Fix AlarmEventHandlers (#48)
├─ kraken-reactive   → Create AlarmReactivity (#51)
└─ kraken-temporal   → Temporal queries (#50)

Wave 2:
├─ kraken   → Refactor AlarmService (#46)
├─ arbiter  → Integration tests (#49)
└─ spark    → Fix TypeScript errors
```
