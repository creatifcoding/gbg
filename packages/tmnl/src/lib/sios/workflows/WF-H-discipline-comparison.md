# WF-H — Multi-Discipline WP Comparison

> Side-by-side health per discipline. Spot the bottleneck. Drill into the bleed. The PM's daily standup in one view.

---

## Audience & Purpose

**Primary:** Project managers — this replaces the weekly Excel rollup. Instead of waiting for someone to compile numbers from three different foremen, the PM sees all disciplines in one view, updated every time a task completes.

**What it proves:** SIOS aggregates EVM data across disciplines (mechanical, electrical, controls) for a single zone. The PM can spot which discipline is the bottleneck and drill into why — without calling a meeting.

---

## Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Zone A — Ticketing Hall · Discipline Health                    │
│  [Zone A ▼]  selector                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──── ⚙ Mechanical ─────┐  ┌──── ⚡ Electrical ────┐  ┌──── 🔧 Controls ─────┐
│  │                        │  │                       │  │                       │
│  │     72%                │  │     41%               │  │      0%              │
│  │   [████████░░]         │  │   [████░░░░░]         │  │   [░░░░░░░░░]        │
│  │                        │  │                       │  │                       │
│  │  CPI: 1.05 ✓           │  │  CPI: 0.82 ⚠         │  │  CPI: —              │
│  │  EV: $180K / $250K     │  │  EV: $41K / $100K    │  │  EV: $0 / $75K       │
│  │  Hours: 360/500        │  │  Hours: 180/200 ⚠    │  │  Hours: 0/150        │
│  │                        │  │                       │  │                       │
│  │  5 tasks done          │  │  3 tasks active       │  │  0 tasks started     │
│  │  2 tasks active        │  │  1 task blocked       │  │  4 tasks pending     │
│  │  0 blocked             │  │  ⚠ Over budget        │  │                       │
│  │                        │  │                       │  │                       │
│  │  [Drill Down ▶]        │  │  [Drill Down ▶]      │  │  [Drill Down ▶]      │
│  └────────────────────────┘  └───────────────────────┘  └───────────────────────┘
│                                                                 │
│  ┌─── Electrical Drill-Down (expanded) ───────────────────┐    │
│  │  WP: Power Distribution — $100K budget                  │    │
│  │                                                          │    │
│  │  Tasks:                                                  │    │
│  │  ✓ Cable tray run Zone A east      12h / 10h planned    │    │
│  │  ✓ Panel CB-01 wiring              16h / 14h planned    │    │
│  │  ● Panel CB-02 wiring              8h / 10h planned     │    │
│  │  ● Motor termination run 1         14h / 8h planned ⚠   │    │
│  │  ⚠ VFD installation (BLOCKED)      0h / 12h planned     │    │
│  │    "VFDs on backorder — ETA April 5"                     │    │
│  │                                                          │    │
│  │  ← This blocked task + motor run overrun explain the CPI │    │
│  │     The motor termination is running 75% over hours      │    │
│  │  [Record Progress ▶]                                     │    │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interaction Script

### Beat 1 — Three Disciplines at a Glance (15 seconds)
Zone A loaded with 3 WPs — one per discipline. Cards show at-a-glance health: mechanical is healthy (green CPI), electrical is bleeding (red CPI), controls hasn't started.

**Narration:** "Zone A, three disciplines. Mechanical — 72% done, on budget. Controls — hasn't started yet, that's expected, steelwork comes first. But electrical — 41% done and CPI is 0.82. That's your problem child."

### Beat 2 — Drill into Electrical (15 seconds)
Click "Drill Down" on the Electrical card. Task list expands below:
- 2 tasks done (cable tray, Panel CB-01 wiring)
- 2 tasks active (Panel CB-02, motor termination)
- 1 task blocked (VFD installation — backorder)

Motor termination row highlighted amber: 14 actual hours against 8 planned.

**Narration:** "Drill into electrical. Two tasks done, two in progress, one blocked — VFDs on backorder. But look at motor termination — 14 hours against 8 planned. That task alone is dragging the CPI down."

### Beat 3 — Record Progress → Watch CPI Update (20 seconds)
Click "Record Progress" on the electrical WP. Modal:
- Additional qty completed: 5 units
- Additional hours: 10h
- Additional cost: $5,000

Submit. WP card updates:
- Percent: 41% → 51%
- EV: $41K → $51K
- CPI: 0.82 → 0.84 (slight improvement, still amber)

**Narration:** "Record today's progress — 5 more terminations done, 10 hours. CPI ticks up to 0.84 — improving, but still over budget. The PM sees this immediately, not at Friday's report."

### Beat 4 — Switch Zones (10 seconds)
Click zone selector → switch to "Zone B — Sortation Level 1."
Different discipline breakdown appears — maybe mechanical is behind here, controls is ahead.

**Narration:** "Switch to Zone B. Different story — mechanical is behind, controls is actually ahead. Every zone tells its own story."

---

## State Flow

```
Zone A has 3 WorkPackages:
  WP-mech: discipline='mechanical', plannedQty=1000, actualQty=720, budgetedCost=250000, actualCost=238000
  WP-elec: discipline='electrical', plannedQty=50,   actualQty=20.5, budgetedCost=100000, actualCost=61000
  WP-ctrl: discipline='controls',   plannedQty=200,  actualQty=0,    budgetedCost=75000,  actualCost=0

After Beat 3 (record 5 more electrical units):
  WP-elec: actualQty=25.5, actualCost=66000
  WP-elec.percentComplete() = 51
  WP-elec.earnedValue() = 51000
  WP-elec.cpi() = 0.773  (51000/66000)
```

---

## Seed Data

```typescript
const wpSeeds = [
  {
    discipline: 'mechanical', name: 'Belt Conveyor Installation',
    progressUnit: 'linear_meters', plannedQty: 1000, budgetedHours: 500, budgetedCost: 250_000,
    actualQty: 720, actualCost: 238_000, actualHours: 360, status: 'active',
  },
  {
    discipline: 'electrical', name: 'Power Distribution',
    progressUnit: 'units', plannedQty: 50, budgetedHours: 200, budgetedCost: 100_000,
    actualQty: 20.5, actualCost: 61_000, actualHours: 180, status: 'active',
  },
  {
    discipline: 'controls', name: 'PLC & I/O System',
    progressUnit: 'io_points', plannedQty: 200, budgetedHours: 150, budgetedCost: 75_000,
    actualQty: 0, actualCost: 0, actualHours: 0, status: 'planned',
  },
]

// Electrical tasks for drill-down
const electricalTasks = [
  { title: 'Cable tray run Zone A east', status: 'done', plannedHours: 10, actualHours: 12 },
  { title: 'Panel CB-01 wiring', status: 'done', plannedHours: 14, actualHours: 16 },
  { title: 'Panel CB-02 wiring', status: 'active', plannedHours: 10, actualHours: 8 },
  { title: 'Motor termination run 1', status: 'active', plannedHours: 8, actualHours: 14 }, // over!
  { title: 'VFD installation', status: 'blocked', plannedHours: 12, actualHours: 0,
    blockedReason: 'VFDs on backorder — ETA April 5' },
]
```

---

## UI Components Needed

1. **Discipline Cards** — 3 side-by-side cards. Progress ring, CPI gauge, budget burn, task counts.
2. **Zone Selector** — Dropdown to switch between zones
3. **Drill-Down Panel** — Expandable task list under a discipline card
4. **Task Row** — Title, actual vs planned hours (with amber highlighting when over), status icon
5. **Record Progress Modal** — qty, hours, cost inputs. Triggers WP recalculation.
6. **CPI Indicator** — Color-coded: green > 1.0, amber 0.85-1.0, red < 0.85
7. **Overrun Highlighting** — Tasks where actualHours > plannedHours get amber background

---

## Technical Notes

- Boot `makeWorkPackageMachine` and `makeTaskMachine` in-memory
- Pre-seed 3 WPs with existing progress (not starting from zero — more realistic)
- WP EVM methods drive all displayed values: `percentComplete()`, `earnedValue()`, `cpi()`, `isOverBudget()`
- Discipline grouping is a presentation concern — filter WPs by `discipline` field
- Task overrun detection: simple `actualHours > plannedHours` comparison
- Zone selector re-filters the WP list by `zoneId`
- This is the most "dashboard-like" workflow but the interactivity (drill-down, record progress, live CPI update) keeps it from being a static report
