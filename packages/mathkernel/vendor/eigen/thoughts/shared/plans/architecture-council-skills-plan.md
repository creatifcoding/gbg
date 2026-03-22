# Feature Plan: Architecture Council Skill Suite

Created: 2026-01-26
Author: architect-agent (Val)

## Overview

Comprehensive skill suite that formalizes the Architecture Council process used to develop ADR-0012 and the v3 service architecture spec. Includes main orchestrator skill, agent definitions, patterns documentation, and lightweight research variant.

## Requirements

- [x] Main `/architecture-council` skill for orchestrating multi-agent architectural decisions
- [x] Agent definitions for each council perspective (Schema-Sage, Repo-Maven, etc.)
- [x] `/research-council` lighter variant for parallel research without full debate
- [x] Task dependency steering patterns documentation
- [x] Integration with existing grounded-research skill

## Design

### Architecture

```
Skills
├── architecture-council/
│   ├── SKILL.md              # Main orchestrator skill
│   └── patterns/
│       └── task-steering.md  # Task dependency patterns
│
├── research-council/
│   └── SKILL.md              # Lightweight research variant
│
Agents
└── council/
    ├── schema-sage.md        # Types & validation
    ├── repo-maven.md         # Repository patterns
    ├── event-oracle.md       # Event sourcing
    ├── entity-weaver.md      # Cluster entities
    ├── infra-smith.md        # Infrastructure
    ├── architect-prime.md    # Synthesis coordinator
    └── industry-oracle.md    # External standards
```

### Council Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARCHITECTURE COUNCIL FLOW                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Phase 1: RESEARCH (Parallel)                                    │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐  │
│  │ Schema-Sage │ │ Repo-Maven  │ │ Event-Oracle│ │ ...       │  │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └─────┬─────┘  │
│         │               │               │               │        │
│         └───────────────┼───────────────┼───────────────┘        │
│                         │               │                        │
│  Phase 2: SYNTHESIS                     │                        │
│                         ▼               │                        │
│                ┌─────────────────┐      │                        │
│                │ Architect-Prime │◄─────┘                        │
│                └────────┬────────┘                               │
│                         │                                        │
│  Phase 3: DELIVERABLES  │                                        │
│         ┌───────────────┼───────────────┐                        │
│         ▼               ▼               ▼                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                   │
│  │   Journal  │ │    Spec    │ │    ADR     │                   │
│  └────────────┘ └────────────┘ └────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Files Created

| File | Lines | Purpose |
|------|-------|---------|
| `.claude/skills/architecture-council/SKILL.md` | 320 | Main orchestrator skill |
| `.claude/skills/architecture-council/patterns/task-steering.md` | 395 | Task dependency patterns |
| `.claude/skills/research-council/SKILL.md` | 311 | Lightweight research variant |
| `.claude/agents/council/schema-sage.md` | 146 | Type system specialist |
| `.claude/agents/council/repo-maven.md` | 157 | Repository specialist |
| `.claude/agents/council/event-oracle.md` | 190 | Event sourcing specialist |
| `.claude/agents/council/entity-weaver.md` | 177 | Entity/aggregate specialist |
| `.claude/agents/council/infra-smith.md` | 233 | Infrastructure specialist |
| `.claude/agents/council/architect-prime.md` | 285 | Synthesis coordinator |
| `.claude/agents/council/industry-oracle.md` | 225 | External standards |
| **Total** | **2439** | |

## Implementation Phases

### Phase 1: Foundation (COMPLETE)
- [x] Create directory structure
- [x] Write main architecture-council skill
- [x] Document task steering patterns

### Phase 2: Agent Definitions (COMPLETE)
- [x] Schema-Sage agent
- [x] Repo-Maven agent
- [x] Event-Oracle agent
- [x] Entity-Weaver agent
- [x] Infra-Smith agent
- [x] Architect-Prime agent
- [x] Industry-Oracle agent

### Phase 3: Research Council (COMPLETE)
- [x] Create research-council skill
- [x] Document lightweight research protocol

### Phase 4: Integration (COMPLETE)
- [x] Update SKILL_REGISTRY.md
- [x] Document MCP usage patterns
- [x] Cross-reference with grounded-research skill

## Usage Examples

### Invoke Architecture Council

```
User: "We need to design the v3 service architecture for IIoT. Should we use event sourcing?"

Claude: I'll convene the Architecture Council...

[Spawns Schema-Sage, Repo-Maven, Event-Oracle, Entity-Weaver, Infra-Smith]
[Agents write to shared journal]
[Architect-Prime synthesizes]

Deliverables:
- Journal: thoughts/shared/journal/2026-01-25-v3-council.md
- Spec: thoughts/shared/specs/2026-01-25-v3-spec.md
- ADR: assets/documents/iiot/ADR-0012.md
```

### Invoke Research Council

```
User: "Research how event sourcing is used in IIoT manufacturing"

Claude: I'll convene a Research Council...

[Spawns Internal Oracle, Docs Oracle, Standards Oracle]
[Parallel research queries]
[Synthesize report]

Deliverables:
- Report: thoughts/shared/reports/2026-01-26-es-iiot.md
```

## Success Criteria

1. [x] Skills trigger on relevant keywords
2. [x] Agent definitions provide clear protocols
3. [x] Task steering enables parallel execution
4. [x] MCP integration documented
5. [x] Reference materials linked

## Reference Materials

- Council Session: `thoughts/shared/journal/2026-01-25-v3-architecture-council.md`
- Final Spec: `thoughts/shared/specs/2026-01-25-v3-service-architecture.md`
- ADR: `assets/documents/iiot/ADR-0012-event-sourcing-boundaries-iiot.md`
- WBS: `thoughts/shared/plans/2026-01-26-es-boundaries-wbs.md`
