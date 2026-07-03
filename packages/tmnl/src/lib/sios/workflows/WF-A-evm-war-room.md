# WF-A — EVM War Room

> Complete tasks one by one. Watch CPI/SPI gauges react in real time. The PM's nerve center.

---

## Audience & Purpose

**Primary:** Jose Corbino PMP — this is his native language. Earned value, CPI, SPI, cost variance. He's tracked these on spreadsheets for 20 years. Seeing them update live from field input is the "this is real" moment.

**What it proves:** SIOS isn't a dashboard that displays stale data — it's a reactive system where field actions (task completion, progress recording) cascade through the EVM calculations instantly.

---

## Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  WP: Belt Conveyor Installation — Zone A Ticketing Hall         │
│  Discipline: Mechanical · Budget: $250,000 · Planned: 1,000 LM │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─── EVM Gauges ──────────────────────────────────────────┐   │
│  │  % Complete   │  Earned Value  │   CPI    │  Budget     │   │
│  │   [  40%   ]  │  [ $100,000 ]  │ [ 1.11 ] │ [ ✓ OK  ]  │   │
│  │   radial       │   counter      │  gauge    │  badge     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── Cost Variance Bar ───────────────────────────────────┐   │
│  │  ████████████████░░░░░░░░░  AC: $90K  EV: $100K  ✓+$10K│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── Task List ───────────────────────────────────────────┐   │
│  │  ✓ Install belt sections A1-A10   400 LM  180h  $90K   │   │
│  │  ○ Install belt sections A11-A25  600 LM  ---   ---     │   │
│  │                              [ Complete Task ▶ ]         │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interaction Script

### Beat 1 — Set the Scene (10 seconds)
Screen loads with a pre-seeded WorkPackage: "Belt Conveyor Installation" in Zone A. Budget $250K, planned 1,000 linear meters. Two tasks visible. All gauges at zero.

**Narration:** "This is a work package for belt conveyor installation in the ticketing hall. $250K budget, 1,000 linear meters planned."

### Beat 2 — Complete First Task (20 seconds)
Click "Complete Task" on Task 1. Modal appears with fields:
- Actual Qty: 400 LM
- Actual Hours: 180h
- Cost: $90,000

Click "Submit."

**What happens on screen:**
- Task 1 row turns green, shows ✓
- % Complete gauge animates: 0% → 40%
- Earned Value counter rolls up: $0 → $100,000
- CPI gauge shows: 1.11 (green)
- Cost Variance bar: +$10K (green, under budget)
- Budget badge: "✓ Under Budget"

**Narration:** "First task done — 400 meters installed. CPI is 1.11 — we're under budget. Earned value is $100K against $90K actual spend."

### Beat 3 — Complete Second Task (20 seconds)
Click "Complete Task" on Task 2. Modal:
- Actual Qty: 600 LM
- Actual Hours: 350h
- Cost: $175,000

Click "Submit."

**What happens on screen:**
- Task 2 row turns green
- % Complete: 40% → 100% (animates)
- Earned Value: $100K → $250K
- CPI: 1.11 → 0.94 (gauge needle sweeps from green to amber)
- Cost Variance: +$10K → -$15K (bar flips to red side)
- Budget badge: "✓ Under Budget" → "⚠ Over Budget" (red, with animation)

**Narration:** "Second task done — but it ran heavy. CPI dropped to 0.94. We're now $15K over budget on this work package. The system caught it immediately — not at the end of the week when someone runs a spreadsheet."

### Beat 4 — The Punchline (10 seconds)
**Narration:** "Every field completion feeds this in real time. Your PMs don't chase spreadsheets — they watch the gauges."

---

## State Flow

```
Initial:
  WP { plannedQty: 1000, actualQty: 0, budgetedCost: 250000, actualCost: 0 }
  Task1 { status: 'pending', plannedQty: 400, plannedHours: 200 }
  Task2 { status: 'pending', plannedQty: 600, plannedHours: 300 }

After Beat 2:
  actor.send(InternalStartTask({ taskId: t1.id }))
  actor.send(InternalCompleteTask({ taskId: t1.id, actualQty: 400, actualHours: 180 }))
  actor.send(InternalRecordProgress({ wpId, qtyCompleted: 400, hoursExpended: 180, costExpended: 90000 }))
  
  WP { actualQty: 400, actualCost: 90000 }
  WP.percentComplete() = 40
  WP.earnedValue() = 100000
  WP.cpi() = 1.11
  WP.costVariance() = +10000

After Beat 3:
  actor.send(InternalStartTask({ taskId: t2.id }))
  actor.send(InternalCompleteTask({ taskId: t2.id, actualQty: 600, actualHours: 350 }))
  actor.send(InternalRecordProgress({ wpId, qtyCompleted: 600, hoursExpended: 350, costExpended: 175000 }))
  
  WP { actualQty: 1000, actualCost: 265000 }
  WP.percentComplete() = 100
  WP.earnedValue() = 250000
  WP.cpi() = 0.943
  WP.costVariance() = -15000
  WP.isOverBudget() = true
```

---

## Seed Data

```typescript
const wpSeed = {
  zoneId: zone1.id,
  projectId: project.id,
  discipline: 'mechanical',
  name: 'Belt Conveyor Installation',
  progressUnit: 'linear_meters',
  plannedQty: 1000,
  budgetedHours: 500,
  budgetedCost: 250_000,
}

const taskSeeds = [
  { title: 'Install belt sections A1-A10', plannedQty: 400, plannedHours: 200, sortOrder: 1 },
  { title: 'Install belt sections A11-A25', plannedQty: 600, plannedHours: 300, sortOrder: 2 },
]
```

---

## UI Components Needed

1. **EVM Gauge Panel** — 4 gauges (% complete radial, EV counter, CPI dial, budget badge)
2. **Cost Variance Bar** — Horizontal bar centered at zero, green left / red right
3. **Task Completion Modal** — actualQty, actualHours, cost inputs
4. **Task List** — Rows with status icon, title, planned/actual values
5. **Animation** — Number counters (anime.js), gauge needle sweep (GSAP), badge color transition

---

## Technical Notes

- Boot `makeWorkPackageMachine` and `makeTaskMachine` in-memory
- Use effect-atom for reactive state: `wpAtom`, `tasksAtom`, `evmSnapshotAtom` (derived)
- EVM calculations come from `WorkPackage.percentComplete()`, `.earnedValue()`, `.cpi()` etc. — schema methods, not separate service
- No HTTP needed — direct `actor.send()` from React event handlers
