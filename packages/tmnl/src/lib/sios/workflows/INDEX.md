# SIOS Interactive Workflows — Index

Eight interactive workflows for live stakeholder demos. Each is a self-contained, clickable experience backed by the SIOS entity architecture. Not dashboards — **sequences** where the viewer watches state change in real time.

**Target audience:** Liam Clarke (President), Jose Corbino PMP (Operations Director)
**Demo format:** Screen share on a 15-minute call. Narrator walks through each workflow, clicking buttons, showing cause-and-effect.

---

## Workflow Map

```
┌─────────────────────────────────────────────────────────────────┐
│                        PROJECT LEVEL                            │
│  B — Project Lifecycle Stepper                                  │
│      bidding → awarded → mobilising → active → complete         │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                         ZONE LEVEL                              │
│  F — Zone Handover Sequencer                                    │
│      Phase-by-phase brownfield delivery across zones            │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WORK PACKAGE LEVEL                            │
│  A — EVM War Room          H — Multi-Discipline Comparison      │
│      CPI/SPI live update       Mech vs Elec vs Controls health  │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                        TASK LEVEL                               │
│  G — Live Task Timeline (Kanban)                                │
│      7-state drag, evidence gates, blocked reasons              │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CROSS-CUTTING                                │
│  C — Commissioning Gate Runner    (Checkpoint + Zone)           │
│  D — Issue Triage Board           (Issue + SLA)                 │
│  E — Crew Deployment & Certs      (Worker + Crew)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Summaries

### A — EVM War Room
**File:** `WF-A-evm-war-room.md`
**Entities:** WorkPackage, Task, TimeEntry
**Audience:** Jose (PMP — this is his language)
**Core interaction:** Complete tasks one by one → watch CPI/SPI gauges and earned value update live
**Demo duration:** ~3 minutes
**Key moment:** CPI drops from 1.11 to 0.94 — "Over Budget" badge appears

### B — Project Lifecycle Stepper
**File:** `WF-B-project-lifecycle.md`
**Entities:** Project
**Audience:** Liam (President — governance and process)
**Core interaction:** Step a project through 8 states, try invalid transitions (blocked), use hold/resume
**Demo duration:** ~2 minutes
**Key moment:** Try to skip bidding→active — system rejects with typed error

### C — Commissioning Gate Runner
**File:** `WF-C-commissioning-gates.md`
**Entities:** Checkpoint, Zone
**Audience:** Both (commissioning is JCK's daily reality)
**Core interaction:** Inspect/pass/fail checkpoints → failed triggers rework cycle → zone handover unlocks
**Demo duration:** ~3 minutes
**Key moment:** Divert accuracy test fails → rework → re-test → pass → zone progress bar climbs

### D — Issue Triage Board
**File:** `WF-D-issue-triage.md`
**Entities:** Issue
**Audience:** Jose (field operations)
**Core interaction:** Create critical safety issue → SLA countdown starts → assign → resolve → verify → close
**Demo duration:** ~2 minutes
**Key moment:** SLA timer turns red as deadline approaches

### E — Crew Deployment & Cert Compliance
**File:** `WF-E-crew-certs.md`
**Entities:** Worker, Crew
**Audience:** Both (airport badge is JCK's #1 workforce constraint)
**Core interaction:** Filter deployable workers → flag expiring badges → block assignment of expired worker → renew → unblock
**Demo duration:** ~2 minutes
**Key moment:** Badge-expired worker literally can't be assigned — system enforces what airport security requires

### F — Zone Handover Sequencer
**File:** `WF-F-zone-sequencer.md`
**Entities:** Zone, Checkpoint
**Audience:** Both (brownfield phased delivery is JCK's specialty)
**Core interaction:** Step zones through phases — complete Zone A commissioning → Zone B unlocks → show hold/resume on Zone D
**Demo duration:** ~3 minutes
**Key moment:** Zone A reaches "handed_over" → Zone B's "Begin Commissioning" button activates

### G — Live Task Timeline
**File:** `WF-G-task-timeline.md`
**Entities:** Task
**Audience:** Field supervisors (the foreman's daily view)
**Core interaction:** Kanban board — drag tasks through 7 states, block/unblock with reasons, evidence gate on completion
**Demo duration:** ~3 minutes
**Key moment:** Task requires evidence → system blocks completion until photo attached

### H — Multi-Discipline WP Comparison
**File:** `WF-H-discipline-comparison.md`
**Entities:** WorkPackage (grouped by discipline)
**Audience:** PM daily standup
**Core interaction:** Side-by-side WP health per discipline (mechanical/electrical/controls) → drill into bottleneck → record progress → CPI updates
**Demo duration:** ~2 minutes
**Key moment:** Electrical CPI at 0.82 — click into it, see which task is bleeding budget

---

## Entity Coverage

| Entity | Workflows |
|--------|-----------|
| Project | B |
| Zone | C, F |
| WorkPackage | A, H |
| Task | A, G |
| TimeEntry | A |
| Crew | E |
| Worker | E |
| Issue | D |
| Checkpoint | C, F |

Every entity appears in at least one workflow. The EVM triad (WP + Task + TimeEntry) gets the deepest coverage.

---

## Demo Sequencing (Recommended Call Order)

For a 15-minute call, pick 3-4. Recommended sequence:

1. **B — Project Lifecycle** (2 min) — Establishes the system. "Here's a project. Here's how it moves through your process."
2. **A — EVM War Room** (3 min) — The money shot. "Here's earned value updating in real time as field work completes."
3. **C — Commissioning Gates** (3 min) — Domain credibility. "Here's how commissioning checkpoints gate zone handover."
4. **D — Issue Triage** (2 min) — Operational pain point. "Here's how safety issues flow with SLA enforcement."

Reserve E, F, G, H for follow-up call or "want to see more?" moment.

---

## Technical Stack (Per Workflow)

Each workflow is a React route backed by:
- **State:** In-memory state services (no database needed for demo)
- **Logic:** Machine.boot() → actor.send(Internal*) for stateful workflows
- **UI:** React components with effect-atom for reactive state
- **Seed data:** Pre-loaded realistic AMH project data

No cluster, no HTTP, no SQL needed. Machines boot in-memory. This is a demo — it's fast, self-contained, and deploys to a static host.
