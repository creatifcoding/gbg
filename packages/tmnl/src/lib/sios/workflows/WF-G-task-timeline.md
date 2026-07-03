# WF-G — Live Task Timeline

> Kanban board with 7 columns. Drag tasks through states. Block with reasons. Gate completion on evidence.

---

## Audience & Purpose

**Primary:** Field supervisors — this is the foreman's daily interface. Seven states sounds complex but the kanban makes it intuitive.

**What it proves:** SIOS task management isn't a to-do list. It's a 7-state lifecycle with typed transitions, blocking reasons, evidence requirements, and automatic progress tracking. Every task action feeds the EVM calculations upstream.

---

## Screen Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  WP-042 Belt Conveyor Installation — Zone A                             │
│  8 tasks · 3 active · 1 blocked · 2 done                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  Pending    Active      Blocked     Suspended  Evidence   Done   Cancel │
│  ┌─────┐  ┌─────┐    ┌─────┐     ┌─────┐    ┌─────┐   ┌─────┐       │
│  │Motor│  │Belt │    │VFD  │     │     │    │Torque│   │Frame│       │
│  │align│  │splice│   │wiring│    │     │    │spec  │   │inst │       │
│  │ #3  │  │Sec.4│    │Pnl 2│    │     │    │A1-A5 │   │A1-5 │       │
│  │     │  │     │    │     │     │     │    │     │   │     │       │
│  │4h   │  │●    │    │⚠    │     │     │    │📷   │   │✓ 8h │       │
│  └─────┘  │     │    │Steel│     │     │    │     │   ├─────┤       │
│           │     │    │wait │     │     │    │     │   │Cable│       │
│  ┌─────┐  └─────┘    └─────┘     │     │    └─────┘   │tray │       │
│  │Roll │  ┌─────┐                │     │              │run B│       │
│  │inst │  │Roller│               │     │              │✓ 6h │       │
│  │A11  │  │inst  │               │     │              └─────┘       │
│  │     │  │A11   │               │     │                            │
│  │6h   │  │●     │               │     │                            │
│  └─────┘  └─────┘               └─────┘                            │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Interaction Script

### Beat 1 — Survey the Board (10 seconds)
8 tasks across columns. 2 pending, 2 active, 1 blocked (with visible reason), 1 in evidence review, 2 done.

**Narration:** "Eight tasks for the belt conveyor work package. Two in progress, one blocked waiting for structural steel, one needs evidence review before it can close."

### Beat 2 — Start a Pending Task (10 seconds)
Click "Start" on "Motor alignment #3" → it moves from Pending to Active column.
- Card slides to Active column with animation
- Status dot appears (blue pulse)

**Narration:** "Start motor alignment. It moves to active."

### Beat 3 — Block a Task (15 seconds)
Click "Block" on "Roller install A11" → modal appears:
- **Blocking reason:** "Waiting for structural steel delivery — ETA April 3"
Submit.

- Task moves to Blocked column
- Red warning icon with reason visible on card
- Blocked since timestamp appears

**Narration:** "Roller install can't proceed — structural steel isn't here yet. Block it with a reason. The timestamp tells you exactly how long it's been stuck."

### Beat 4 — Unblock and Resume (10 seconds)
Click "Unblock" on the VFD wiring task (already blocked). 
- Task slides from Blocked back to Active
- Blocked reason clears

**Narration:** "Steel arrived for VFD wiring. Unblock it — back to active."

### Beat 5 — Complete with Evidence Gate (20 seconds)
Click "Complete" on the "Torque spec A1-A5" task (in Evidence column).
System shows: "This task requires evidence before completion."
- **Evidence type:** Photo of torque wrench reading
- **Evidence text:** "All 24 bolts torqued to 45 ft-lb per spec MEQ-2025-004"
- Upload placeholder (camera icon)

Submit evidence → task moves from Evidence to Done column.

**Narration:** "Torque verification — this one requires evidence. Photo of the torque wrench reading, spec reference number. Can't close it without. The integrator client can audit this later."

### Beat 6 — Try to Complete Without Evidence (10 seconds)
Click "Complete" on another task with `requiresEvidence: true` but don't fill in evidence.
Error toast: "✗ Evidence required. Attach photo or documentation before completing."

**Narration:** "Without evidence? Blocked. Quality gates are enforced, not optional."

---

## State Flow

```
Start:    pending → active
Block:    active → blocked (reason required)
Unblock:  blocked → active
Suspend:  active → suspended
Resume:   suspended → active

Complete path (no evidence):
  active → done (actualQty, actualHours required)

Complete path (evidence required):
  active → needs_evidence (system gate)
  needs_evidence → done (evidence attached)

Cancel:   pending → cancelled (terminal)
```

---

## Seed Data

```typescript
const taskSeeds = [
  { title: 'Motor alignment #3', status: 'pending', plannedHours: 4, sortOrder: 1, requiresEvidence: false },
  { title: 'Roll install A11', status: 'pending', plannedHours: 6, sortOrder: 2, requiresEvidence: false },
  { title: 'Belt splice Sec. 4', status: 'active', plannedHours: 3, sortOrder: 3, requiresEvidence: false },
  { title: 'Roller install A11', status: 'active', plannedHours: 5, sortOrder: 4, requiresEvidence: false },
  { title: 'VFD wiring Panel 2', status: 'blocked', plannedHours: 8, sortOrder: 5, requiresEvidence: true,
    blockedReason: 'Waiting for structural steel delivery' },
  { title: 'Torque spec A1-A5', status: 'needs_evidence', plannedHours: 2, sortOrder: 6, requiresEvidence: true },
  { title: 'Frame install A1-A5', status: 'done', plannedHours: 8, actualHours: 8, sortOrder: 7 },
  { title: 'Cable tray run B', status: 'done', plannedHours: 5, actualHours: 6, sortOrder: 8 },
]
```

---

## UI Components Needed

1. **Kanban Board** — 7 columns (pending, active, blocked, suspended, evidence, done, cancelled). Drag-and-drop between valid transitions only.
2. **Task Card** — Title, planned hours, status icon, blocking reason (if blocked), evidence indicator
3. **Block Modal** — Reason text (required), auto-timestamps blockedSince
4. **Complete Modal** — actualQty, actualHours, evidence fields (if requiresEvidence)
5. **Evidence Upload Area** — Photo placeholder, text description, reference number
6. **Invalid Drag Toast** — "Can't move from pending to done — must go through active first"
7. **Column Counters** — Task count per column in header

---

## Technical Notes

- Boot `makeTaskMachine` in-memory. Pre-seed 8 tasks in mixed states.
- Drag-and-drop validates transitions via graph: `isValidTransition(from, to)`. Invalid drops snap back with error.
- Kanban columns map directly to TaskStateNode values
- `requiresEvidence` gate: if true, `InternalCompleteTask` transitions to `needs_evidence` instead of `done`
- Evidence is stored as `Evidence[]` JSONB array — for demo, text descriptions only
- Column order matches the natural flow: pending → active → blocked/suspended (side tracks) → evidence → done → cancelled
