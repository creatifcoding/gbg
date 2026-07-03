# WF-B — Project Lifecycle Stepper

> Walk a project through 8 states. Show the guard rails. Invalid transitions are blocked — not by convention, but by code.

---

## Audience & Purpose

**Primary:** Liam Clarke (President) — He cares about governance, process discipline, and velocity. Seeing a state machine enforce the project lifecycle tells him "this system won't let anyone skip steps."

**What it proves:** SIOS has typed, graph-validated state transitions. You can't jump from bidding to active. You can't commission before mobilising. The system is opinionated about process — and that opinion matches JCK's real workflow.

---

## Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Project: DFW Terminal B BHS Modernization                      │
│  Client: Dallas Fort Worth International Airport                │
│  Type: Airport BHS · Delivery: Design-Build · Brownfield        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─── State Pipeline ─────────────────────────────────────┐    │
│  │ ●──── ○──── ○──── ○──── ○──── ○──── ○──── ○           │    │
│  │ BID   AWD   MOB   ACT   COM   CMP   HOLD  CXL         │    │
│  │ ▲ current                                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─── Available Transitions ──────────────────────────────┐    │
│  │  [  ✓ Award Project  ]   [  ⚡ Cancel Project  ]       │    │
│  │                                                         │    │
│  │  [  ✗ Activate — must mobilise first  ]   (disabled)    │    │
│  │  [  ✗ Commission — not yet active  ]      (disabled)    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─── Transition Log ─────────────────────────────────────┐    │
│  │  10:42:03  Created in BIDDING state                     │    │
│  │  10:42:07  Awarded ✓  (bidding → awarded)               │    │
│  │  10:42:12  ✗ Activate BLOCKED (awarded → active: no     │    │
│  │            direct path, must mobilise first)             │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interaction Script

### Beat 1 — Create Project (10 seconds)
Project pre-loaded in `bidding` state. Pipeline shows first dot filled, rest empty.

**Narration:** "New project for DFW airport. It starts in bidding — the system won't let it go anywhere until it's awarded."

### Beat 2 — Try Invalid Transition (15 seconds)
Click the disabled "Activate" button. Error toast appears:

> ✗ Invalid transition: bidding → active. Must go through awarded → mobilising first.

**Narration:** "Watch — I'll try to skip ahead to active. The system blocks it. You can't skip mobilisation. That's not a policy memo — it's enforced in the code."

### Beat 3 — Walk the Happy Path (30 seconds)
Click through in sequence:
1. **Award** → dot 2 fills, pipeline animates
2. **Mobilise** → dot 3 fills
3. **Activate** → dot 4 fills, pipeline turns full cyan

Each transition adds a timestamped log entry.

**Narration:** "Award. Mobilise — that's when you're getting boots on the ground. Activate — now the project is live and field work begins."

### Beat 4 — Demonstrate Hold/Resume (20 seconds)
Click "Hold Project" → modal asks for reason → type "GC coordination delay" → submit.
- Pipeline dot 4 turns amber, "ON HOLD" label appears
- Available transitions: only "Resume"

Click "Resume" → select target state "active" → project returns to active.

**Narration:** "Project goes on hold — maybe the GC isn't ready, maybe there's a permitting issue. The system tracks the hold reason. Resume puts you right back where you were."

### Beat 5 — Complete the Lifecycle (15 seconds)
Click "Commission" → "Complete" → pipeline fully filled, all green.

**Narration:** "Commission. Complete. Full lifecycle in 8 states. Every transition is logged, every skip is blocked."

---

## State Flow

```
Create:   bidding
Award:    bidding → awarded     (canAward: true)
Mobilise: awarded → mobilising  (canMobilise: true)
Activate: mobilising → active   (canActivate: true)
Hold:     active → on_hold      (canHold: true, reason required)
Resume:   on_hold → active      (canResume: true, targetState: 'active')
Commission: active → commissioning (canCommission: true)
Complete: commissioning → complete (canComplete: true, terminal)
```

**Blocked transitions shown:**
- bidding → active: No graph edge exists
- bidding → commissioning: No graph edge exists
- complete → anything: Terminal state, no outgoing edges

---

## Seed Data

```typescript
const projectSeed = {
  name: 'DFW Terminal B BHS Modernization',
  code: 'DFW-BHS-2025',
  client: 'Dallas Fort Worth International Airport',
  projectType: 'airport_bhs',
  deliveryMethod: 'design_build',
  siteCondition: 'brownfield_full',
  budgetedCost: 12_500_000,
}
```

---

## UI Components Needed

1. **State Pipeline** — Horizontal dot-and-line tracker. Current state highlighted. Terminal states styled differently.
2. **Transition Buttons** — Green for valid, red/disabled for invalid. Invalid shows tooltip explaining why.
3. **Hold Modal** — Reason text input, required field.
4. **Resume Modal** — Target state selector (only valid resume targets).
5. **Transition Log** — Timestamped entries, success (green) and blocked (red) entries.
6. **Error Toast** — Typed error message from graph validation.

---

## Technical Notes

- Boot `makeProjectMachine` in-memory
- Graph validators (`canAward`, `canMobilise`, etc.) drive button enabled/disabled state
- `isTerminalState()` disables all buttons when project is complete or cancelled
- Transition log is a local array, not persisted — just for demo visibility
- Use `getValidNextStates(currentStatus)` to populate available transition buttons dynamically
