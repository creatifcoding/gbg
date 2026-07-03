# WF-C — Commissioning Gate Runner

> Walk commissioning checkpoints through pass/fail/rework for a zone. This is JCK's daily reality.

---

## Audience & Purpose

**Primary:** Both Liam and Jose — commissioning is what JCK does. They install conveyor systems, then they commission them. Every gate in this workflow maps to a real test they perform on airport baggage handling systems.

**What it proves:** SIOS doesn't just track "percent complete." It tracks the specific commissioning tests that determine whether a zone can be handed over to the client. Failed tests trigger rework cycles. Zone handover is gated — not by a PM checking a box, but by every checkpoint passing.

---

## Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Zone A — Ticketing Hall                                        │
│  Status: COMMISSIONING · 3/5 gates passed · Handover: BLOCKED  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─── Checkpoint List ────────────────────────────────────┐    │
│  │  ✓ I/O Checkout — Panel CB-01              PASSED      │    │
│  │  ✓ Conveyor Run Test — Belt A1-A10         PASSED      │    │
│  │  ✗ Divert Accuracy — Shoe Sorter Lane 7    FAILED      │    │
│  │     Failure: "3 misreads in 100 diverts (97% vs 99.5%  │    │
│  │     required)" · [Rework ▶] [Waive]                     │    │
│  │  ✓ Safety Interlock — E-Stop Chain         PASSED      │    │
│  │  ○ SCADA Integration — HMI Screens         PENDING     │    │
│  │                                  [Mark Ready ▶]         │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─── Zone Progress ─────────────────────────────────────┐     │
│  │  ████████████░░░░░░░░  60%  (3 passed, 1 failed,      │     │
│  │                              1 pending)                │     │
│  │  [ Handover Zone — LOCKED 🔒 ]                         │     │
│  └────────────────────────────────────────────────────────┘     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interaction Script

### Beat 1 — Survey the Gates (10 seconds)
Zone A loaded with 5 checkpoints. 2 already passed (I/O Checkout, Conveyor Run). 1 failed (Divert Accuracy). 1 passed (Safety Interlock). 1 pending (SCADA Integration).

**Narration:** "Zone A — the ticketing hall. Five commissioning gates. We've passed I/O checkout and the conveyor run test. But the divert accuracy test failed."

### Beat 2 — Inspect the Failure (15 seconds)
Click the failed "Divert Accuracy" row to expand it. Shows:
- **Category:** divert_accuracy
- **Failure reason:** "3 misreads in 100 diverts (97% accuracy vs 99.5% required)"
- **Failed on:** March 28, 2026
- **Inspector:** R. Nguyen
- **Required evidence:** Video of divert operation, scanner calibration log

**Narration:** "The shoe sorter isn't hitting 99.5% accuracy. Three misreads in a hundred diverts. That's a rework — we need to recalibrate the scanners and retest."

### Beat 3 — Trigger Rework (15 seconds)
Click "Rework" button on the failed checkpoint. State changes: `failed → pending`.
- Row changes from red to gray (pending again)
- Progress bar updates: 3/5 → 3/5 (still 3 passed, 1 now re-pending, 1 original pending)

**Narration:** "Rework triggered. The checkpoint goes back to pending — the field team recalibrates, and we'll test again."

### Beat 4 — Re-test and Pass (20 seconds)
Click "Mark Ready" on the divert accuracy checkpoint → state: `pending → ready`.
Click "Run Inspection" → modal with pass/fail choice.
Select "Pass" → enter evidence: "100/100 diverts successful after scanner recalibration."
Submit.

- Row turns green: ✓ PASSED
- Progress: 4/5 passed
- Progress bar animates to 80%

**Narration:** "Scanners recalibrated. Re-test: 100 out of 100. Passed. Four out of five gates now clear."

### Beat 5 — Complete Final Gate (15 seconds)
Click "Mark Ready" on SCADA Integration → "Run Inspection" → "Pass" with evidence.
- All 5 checkpoints green
- Progress bar: 100%
- **"Handover Zone" button unlocks** (green, pulsing)

**Narration:** "Last gate — SCADA integration confirmed. All five passed. The zone is ready for handover."

### Beat 6 — Demonstrate Waiver (optional, 10 seconds)
Reset a gate to show the waive path: "Sometimes you waive a gate — maybe the client accepts a minor deficiency. The system tracks the waiver reason and who approved it."

---

## State Flow (Checkpoint)

```
Checkpoint 3 (Divert Accuracy):
  Initial: failed
  Beat 3:  failed → pending  (rework)
  Beat 4a: pending → ready   (mark_ready)
  Beat 4b: ready → passed    (pass, with evidence)

Checkpoint 5 (SCADA Integration):
  Initial: pending
  Beat 5a: pending → ready   (mark_ready)
  Beat 5b: ready → passed    (pass, with evidence)

Zone handover check:
  All checkpoints status IN ('passed', 'waived') → zone can transition to 'handed_over'
```

---

## Seed Data

```typescript
const checkpointSeeds = [
  { name: 'I/O Checkout — Panel CB-01', category: 'io_checkout', status: 'passed' },
  { name: 'Conveyor Run Test — Belt A1-A10', category: 'conveyor_run', status: 'passed' },
  { name: 'Divert Accuracy — Shoe Sorter Lane 7', category: 'divert_accuracy', status: 'failed',
    failureReason: '3 misreads in 100 diverts (97% vs 99.5% required)' },
  { name: 'Safety Interlock — E-Stop Chain', category: 'safety_interlock', status: 'passed' },
  { name: 'SCADA Integration — HMI Screens', category: 'scada_integration', status: 'pending' },
]
```

---

## UI Components Needed

1. **Checkpoint List** — Expandable rows. Color-coded by status. Failed rows show failure reason and rework/waive actions.
2. **Inspection Modal** — Pass/fail radio, evidence text field, inspector name.
3. **Zone Progress Bar** — Fraction of passed/waived checkpoints.
4. **Handover Button** — Locked until all gates clear. Animated unlock.
5. **Rework Badge** — Visual indicator showing how many times a checkpoint has been reworked.
6. **Waiver Modal** — Reason text, approver name (required).

---

## Technical Notes

- Boot `makeCheckpointMachine` and `makeZoneMachine` in-memory
- Pre-seed checkpoints with mixed states (2 passed, 1 failed, 1 passed, 1 pending)
- Zone handover logic: query `findPendingByZone` (status NOT IN passed/waived) — if empty, zone can transition
- Rework cycle: `failed → pending → ready → passed` (or failed again for multiple reworks)
- Checkpoint categories use JCK-specific AMH terms: io_checkout, conveyor_run, divert_accuracy, safety_interlock, scada_integration
