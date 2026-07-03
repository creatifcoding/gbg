# WF-F — Zone Handover Sequencer

> Orchestrate brownfield phased delivery across multiple zones. Zone A completes → Zone B unlocks.

---

## Audience & Purpose

**Primary:** Both — brownfield airport projects are JCK's bread and butter. You can't shut down an entire baggage system at once. You upgrade zone by zone, typically overnight, in phases. Showing that SIOS manages this sequencing is direct operational relevance.

**What it proves:** SIOS understands phased delivery. Zones have a lifecycle (defined → active → commissioning → handed_over). The system enforces phase ordering — Zone B can't enter commissioning until Zone A is handed over. Hold/resume handles the inevitable GC coordination delays.

---

## Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  DFW Terminal B — Zone Phasing                                  │
│  4 zones · 2 phases · Brownfield overlay                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Phase 1                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ● Zone A — Ticketing Hall          COMMISSIONING        │   │
│  │   3/5 gates passed · [View Gates]                        │   │
│  │                                                          │   │
│  │ ● Zone B — Sortation Level 1       ACTIVE               │   │
│  │   Work in progress · 4 WPs active                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Phase 2                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ ○ Zone C — Sortation Level 2       DEFINED              │   │
│  │   Waiting for Phase 1 completion                         │   │
│  │                                                          │   │
│  │ ⏸ Zone D — Outbound Shipping       ON HOLD              │   │
│  │   "GC coordination pending" · [Resume ▶]                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── Phase Progress ────────────────────────────────────┐     │
│  │  Phase 1: ████████████░░░  75%  (A commissioning,      │     │
│  │                                   B active)             │     │
│  │  Phase 2: ░░░░░░░░░░░░░░   0%  (C defined, D on hold) │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interaction Script

### Beat 1 — Survey the Zones (10 seconds)
Four zones loaded across 2 phases. Zone A is commissioning (nearly done), Zone B is active, Zone C is waiting, Zone D is on hold.

**Narration:** "Four zones, two phases. Zone A — the ticketing hall — is in commissioning. Zone B has active work. Phase 2 is waiting."

### Beat 2 — Complete Zone A Commissioning (30 seconds)
Click "View Gates" on Zone A → shows checkpoint list (same as WF-C, but abbreviated). Two remaining gates: pass them both.

Zone A transitions: `commissioning → handed_over`.
- Zone A card turns green: "✓ HANDED OVER"
- Phase 1 progress: 75% → stays (B still active)

**Narration:** "Zone A's last two commissioning gates — passed. Zone A is now handed over to the client. That section of the terminal is back in operation."

### Beat 3 — Show Zone B Progression (15 seconds)
Zone B is `active`. Click "Begin Commissioning" on Zone B → modal confirms: "Zone A handover complete. Zone B eligible for commissioning."

Zone B transitions: `active → commissioning`.

**Narration:** "Zone B can now enter commissioning — the system validated that Zone A was handed over first. You're not commissioning two zones at once on a live airport."

### Beat 4 — Demonstrate Hold/Resume on Zone D (15 seconds)
Zone D shows "ON HOLD" with reason "GC coordination pending."
Click "Resume" → select target state: "defined" → submit.
Zone D transitions: `on_hold → defined`.
- Zone D card changes from amber to gray (defined)

**Narration:** "Zone D was on hold — the general contractor wasn't ready. Now they are. Resume. It goes back to defined, ready for activation when Phase 2 kicks off."

### Beat 5 — The Phase Cascade (10 seconds)
**Narration:** "This is brownfield phased delivery. You can't shut down an airport. You do it zone by zone, phase by phase, with the system tracking what's handed over and what's still live construction. No spreadsheet can enforce this sequencing."

---

## State Flow

```
Zone A: commissioning → handed_over (after all checkpoints pass/waive)
Zone B: active → commissioning (gated by Zone A handover)
Zone C: defined (waiting for Phase 2 — manual activation)
Zone D: on_hold → defined (resume)
```

---

## Seed Data

```typescript
const zoneSeeds = [
  { name: 'Ticketing Hall', code: 'Z-TH', phaseNumber: 1, status: 'commissioning' },
  { name: 'Sortation Level 1', code: 'Z-SL1', phaseNumber: 1, status: 'active' },
  { name: 'Sortation Level 2', code: 'Z-SL2', phaseNumber: 2, status: 'defined' },
  { name: 'Outbound Shipping', code: 'Z-OUT', phaseNumber: 2, status: 'on_hold',
    holdReason: 'GC coordination pending' },
]
```

---

## UI Components Needed

1. **Zone Card** — Name, code, status badge, phase number, gate progress or WP count
2. **Phase Grouping** — Visual separation of Phase 1 / Phase 2 zones
3. **Phase Progress Bar** — Aggregate progress across zones in a phase
4. **Gate Preview** — Abbreviated checkpoint list (pass/fail counts) within zone card
5. **Handover Cascade Notification** — "Zone A handed over → Zone B commissioning unlocked"
6. **Hold/Resume Controls** — Reason display, resume modal with target state

---

## Technical Notes

- Boot `makeZoneMachine` and `makeCheckpointMachine` in-memory
- Pre-seed 4 zones with mixed states and 2 phase numbers
- Zone ordering: `findByProject` returns zones sorted by `phase_number ASC`
- Commissioning gate: zone can transition to `handed_over` only when `findPendingByZone` returns empty
- Phase cascade is presentation logic, not a system constraint — the system validates per-zone, the UI shows the dependency chain
- Hold reason stored on zone entity, displayed in UI
