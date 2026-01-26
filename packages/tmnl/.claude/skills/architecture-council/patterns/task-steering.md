# Task Dependency Patterns for Architecture Council

## Overview

This document describes how to use task dependencies to orchestrate the Architecture Council's phased execution.

## Core Concepts

### Task Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    COUNCIL TASK GRAPH                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PHASE 1: RESEARCH (Parallel)                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │
│  │ Schema-Sage │ │ Repo-Maven  │ │ Event-Oracle│ ...            │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘                │
│         │               │               │                        │
│         └───────────────┼───────────────┘                        │
│                         │                                        │
│  PHASE 2: SYNTHESIS (Blocked by all Phase 1)                     │
│                         ▼                                        │
│                ┌─────────────────┐                               │
│                │ Architect-Prime │                               │
│                └────────┬────────┘                               │
│                         │                                        │
│  PHASE 3: EXTERNAL (Blocked by Phase 2)                          │
│                         ▼                                        │
│                ┌─────────────────┐                               │
│                │ Industry Oracle │                               │
│                └────────┬────────┘                               │
│                         │                                        │
│  PHASE 4: DELIVERABLES (Blocked by Phase 3)                      │
│         ┌───────────────┼───────────────┐                        │
│         ▼               ▼               ▼                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                   │
│  │ Write ADR  │ │ Update Spec│ │ Create WBS │                   │
│  └────────────┘ └────────────┘ └────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Task Creation Pattern

### Phase 1: Research Tasks (Parallel)

```typescript
// All research tasks have no dependencies (run in parallel)
const schemaSageTask = {
  id: "council-schema-sage",
  name: "Schema-Sage Research",
  description: "Analyze schema patterns from research docs",
  agent: "schema-sage",
  input: {
    documents: ["iiot-schemas.md", "iiot-models.md"],
    journalPath: "thoughts/shared/journal/2026-01-25-v3-council.md",
    thread: "Thread: Schema-Sage"
  },
  blockedBy: [],  // No dependencies
  blocks: ["council-synthesis"]  // Synthesis depends on this
}

const repoMavenTask = {
  id: "council-repo-maven",
  name: "Repo-Maven Research",
  description: "Analyze repository patterns",
  agent: "repo-maven",
  input: {
    documents: ["iiot-repos.md", "ams-v2-repositories.md"],
    journalPath: "thoughts/shared/journal/2026-01-25-v3-council.md",
    thread: "Thread: Repo-Maven"
  },
  blockedBy: [],
  blocks: ["council-synthesis"]
}

const eventOracleTask = {
  id: "council-event-oracle",
  name: "Event-Oracle Research",
  description: "Analyze event sourcing patterns",
  agent: "event-oracle",
  input: {
    documents: ["ams-v2-events.md", "iiot-services.md"],
    journalPath: "thoughts/shared/journal/2026-01-25-v3-council.md",
    thread: "Thread: Event-Oracle"
  },
  blockedBy: [],
  blocks: ["council-synthesis"]
}
```

### Phase 2: Synthesis Task (Blocked)

```typescript
const synthesisTask = {
  id: "council-synthesis",
  name: "Architect-Prime Synthesis",
  description: "Synthesize all agent findings into specification",
  agent: "architect-prime",
  input: {
    journalPath: "thoughts/shared/journal/2026-01-25-v3-council.md",
    outputSpec: "thoughts/shared/specs/2026-01-25-v3-spec.md",
    threads: ["Schema-Sage", "Repo-Maven", "Event-Oracle"]
  },
  blockedBy: ["council-schema-sage", "council-repo-maven", "council-event-oracle"],
  blocks: ["council-external-research", "council-adr"]
}
```

### Phase 3: External Research (Blocked by Synthesis)

```typescript
const externalResearchTask = {
  id: "council-external-research",
  name: "Industry Standards Research",
  description: "Enrich spec with external standards (ISA-95, FDA, etc.)",
  agent: "industry-oracle",
  input: {
    specPath: "thoughts/shared/specs/2026-01-25-v3-spec.md",
    standards: ["ISA-95", "ISA-18.2", "FDA 21 CFR Part 11"]
  },
  blockedBy: ["council-synthesis"],
  blocks: ["council-adr"]
}
```

### Phase 4: Deliverables (Blocked by External)

```typescript
const adrTask = {
  id: "council-adr",
  name: "Write ADR",
  description: "Create architectural decision record",
  input: {
    specPath: "thoughts/shared/specs/2026-01-25-v3-spec.md",
    outputAdr: "assets/documents/iiot/ADR-XXXX.md"
  },
  blockedBy: ["council-external-research"],
  blocks: ["council-wbs"]
}

const wbsTask = {
  id: "council-wbs",
  name: "Create WBS",
  description: "Break down implementation into work items",
  input: {
    adrPath: "assets/documents/iiot/ADR-XXXX.md",
    outputWbs: "thoughts/shared/plans/wbs.md"
  },
  blockedBy: ["council-adr"],
  blocks: []
}
```

## Dependency Resolution

### Execution Order

Given the task graph above, execution proceeds:

```
1. [PARALLEL] schema-sage, repo-maven, event-oracle, entity-weaver, infra-smith
2. [WAIT] All Phase 1 complete
3. [SEQUENTIAL] architect-prime synthesis
4. [WAIT] Synthesis complete
5. [SEQUENTIAL] external research
6. [WAIT] External complete
7. [PARALLEL] ADR, spec update, WBS
```

### Completion Signaling

Each task signals completion by:

1. Writing "READY FOR SYNTHESIS" to journal thread
2. Returning success from task execution
3. Unblocking dependent tasks

### Failure Handling

If a research task fails:
- Synthesis task remains blocked
- Other research tasks continue
- Error is reported with context

```typescript
// Example failure handling
const handleTaskFailure = (taskId: string, error: Error) => {
  // 1. Mark task as failed
  // 2. Identify blocked tasks
  // 3. Determine if council can proceed without this agent
  // 4. If critical (Schema-Sage, Architect-Prime), abort council
  // 5. If optional, proceed with available findings
}
```

## Agent Output Coordination

### Journal Write Protocol

Each agent writes to a specific thread in the shared journal:

```markdown
## Thread: Schema-Sage

### Executive Summary
[Agent writes here]

### Findings
[Agent writes here]

---

**READY FOR SYNTHESIS**

---
```

### Synthesis Read Protocol

Architect-Prime reads all threads:

```typescript
const synthesize = async (journalPath: string, threads: string[]) => {
  const journal = await readFile(journalPath)
  
  for (const thread of threads) {
    // Extract thread content
    const threadContent = extractThread(journal, thread)
    
    // Verify "READY FOR SYNTHESIS" signal
    if (!threadContent.includes("READY FOR SYNTHESIS")) {
      throw new Error(`Thread ${thread} not ready`)
    }
    
    // Process findings
    findings.push(parseFindings(threadContent))
  }
  
  return synthesizeFindings(findings)
}
```

## Parallelization Strategies

### Maximum Parallelism (Default)

All independent tasks run simultaneously:

```
Time →
Agent 1: ████████████
Agent 2: ████████████
Agent 3: ████████████
Agent 4: ████████████
Prime:               ████████
External:                    ████
ADR:                             ████
```

### Staged Parallelism (Resource-Constrained)

Limit concurrent tasks:

```
Time →
Agent 1: ████████
Agent 2: ████████
          Agent 3: ████████
          Agent 4: ████████
                   Prime: ████████
```

### Sequential Fallback (Debugging)

For debugging, run sequentially:

```
Time →
Agent 1: ████████
         Agent 2: ████████
                  Agent 3: ████████
                           Prime: ████████
```

## Integration with Task Tools

### Using TodoWrite for Progress

```typescript
const councilTodos = [
  { task: "Schema-Sage research", status: "in_progress" },
  { task: "Repo-Maven research", status: "in_progress" },
  { task: "Event-Oracle research", status: "pending" },
  { task: "Architect-Prime synthesis", status: "blocked" },
  { task: "Write ADR", status: "blocked" },
]

// Update as agents complete
councilTodos[0].status = "completed"  // Schema-Sage done
```

### Using Task Tool for Agent Spawn

```typescript
// Spawn agent via Task tool
Task({
  subagent_type: "schema-sage",
  description: "Analyze schema patterns for v3 architecture",
  prompt: `
    You are Schema-Sage, the council's type system specialist.
    
    Research documents: ${documents.join(', ')}
    Journal path: ${journalPath}
    Your thread: "Thread: Schema-Sage"
    
    Protocol:
    1. Read assigned documents
    2. Query deepwiki for verification
    3. Write findings to journal
    4. Signal "READY FOR SYNTHESIS"
  `
})
```

## Monitoring and Observability

### Progress Tracking

```
Council Progress: v3-iiot-architecture
├── Phase 1: Research [3/5 complete]
│   ├── ✅ Schema-Sage (completed 2m ago)
│   ├── ✅ Repo-Maven (completed 1m ago)
│   ├── ✅ Event-Oracle (completed 30s ago)
│   ├── ⏳ Entity-Weaver (in progress)
│   └── ⏳ Infra-Smith (in progress)
├── Phase 2: Synthesis [blocked]
│   └── ⏸️ Architect-Prime (waiting for Phase 1)
├── Phase 3: External [blocked]
│   └── ⏸️ Industry Oracle (waiting for Phase 2)
└── Phase 4: Deliverables [blocked]
    ├── ⏸️ Write ADR
    ├── ⏸️ Update Spec
    └── ⏸️ Create WBS
```

### Journal Activity Log

```
[14:23:15] Schema-Sage started research
[14:25:32] Schema-Sage wrote 45 lines to journal
[14:27:18] Schema-Sage signaled READY FOR SYNTHESIS
[14:23:45] Repo-Maven started research
[14:26:12] Repo-Maven queried deepwiki (Effect-TS/effect)
[14:28:03] Repo-Maven wrote 67 lines to journal
[14:29:45] Repo-Maven signaled READY FOR SYNTHESIS
...
[14:35:00] All Phase 1 tasks complete
[14:35:01] Architect-Prime synthesis started
```

## Error Recovery

### Partial Council Completion

If some agents fail but synthesis can proceed:

```typescript
const canProceedWithPartial = (completedAgents: string[], requiredAgents: string[]) => {
  // Schema-Sage and Architect-Prime are always required
  const criticalAgents = ["schema-sage", "architect-prime"]
  
  for (const critical of criticalAgents) {
    if (!completedAgents.includes(critical)) {
      return false
    }
  }
  
  // Need at least 3 of 5 research agents for quorum
  return completedAgents.length >= 3
}
```

### Retry Strategy

```typescript
const retryConfig = {
  maxRetries: 2,
  backoffMs: 5000,
  retryableErrors: ["MCP_TIMEOUT", "JOURNAL_WRITE_CONFLICT"]
}
```
