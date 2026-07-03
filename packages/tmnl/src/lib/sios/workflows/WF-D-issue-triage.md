# WF-D — Issue Triage Board

> Report a safety issue. Watch the SLA countdown. Assign, resolve, verify, close. Seven states, one relentless timer.

---

## Audience & Purpose

**Primary:** Jose Corbino — field operations. He's the one who gets the call at 2 AM when a guard rail detaches on a live airport site. He needs issue tracking with SLA enforcement, not a WhatsApp thread.

**What it proves:** SIOS captures field issues with typed severity, SLA deadlines, evidence, and a 7-state lifecycle. The SLA timer is the hook — it creates urgency and accountability.

---

## Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Issue Board — DFW Terminal B                     [+ New Issue] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─── ISS-0042 ───────────────────────────────────────────┐    │
│  │  CRITICAL · SAFETY                   SLA: 02:47:33 ⏱️   │    │
│  │  "Conveyor guard rail detached — Zone B crossbelt       │    │
│  │   sorter near Panel CB-04"                              │    │
│  │  Reported by: J. Martinez · Zone B Sortation            │    │
│  │                                                          │    │
│  │  ○ Open → ● Assigned → ○ In Progress → ○ Resolved      │    │
│  │           → ○ Verified → ○ Closed                       │    │
│  │                                                          │    │
│  │  Assigned to: Mike Torres (Crew Alpha)                   │    │
│  │  [Start Work ▶]  [Mark Won't Fix]                       │    │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─── ISS-0041 ───────────────────────────────────────────┐    │
│  │  MEDIUM · QUALITY                    SLA: 18:22:05      │    │
│  │  "Belt tension out of spec on Section A8"               │    │
│  │  Status: IN PROGRESS                                     │    │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interaction Script

### Beat 1 — Create a Critical Issue (20 seconds)
Click "+ New Issue" button. Modal appears:
- **Title:** "Conveyor guard rail detached — Zone B crossbelt sorter near Panel CB-04"
- **Severity:** Critical (red selector)
- **Category:** Safety
- **Zone:** Zone B — Sortation Level 1
- **SLA Deadline:** 4 hours from now (auto-calculated from severity)

Submit. Issue appears at top of list with:
- Red CRITICAL badge
- SLA countdown timer: `03:59:58` and ticking
- Status: OPEN

**Narration:** "Field report comes in — guard rail detached near a live sorter. That's a critical safety issue. The system gives it a 4-hour SLA window."

### Beat 2 — Assign the Issue (10 seconds)
Click "Assign" → select "Mike Torres (Crew Alpha)" from worker dropdown.
- Status changes: Open → Assigned
- State pipeline dot 2 fills
- Log entry: "Assigned to Mike Torres"

**Narration:** "Assign it to the nearest crew lead. Mike Torres, Crew Alpha — he's already in Zone B."

### Beat 3 — Start Work (10 seconds)
Click "Start Work."
- Status: Assigned → In Progress
- SLA timer continues ticking (now in amber range)

**Narration:** "Mike's on it. Clock is still running."

### Beat 4 — Resolve with Evidence (15 seconds)
Click "Resolve." Modal:
- **Resolution:** "Guard rail re-attached with grade 8 bolts. Torque verified to 45 ft-lb. Area cleared for operation."
- **Evidence:** [Attach photo placeholder]

Submit.
- Status: In Progress → Resolved
- SLA timer pauses (shows time remaining: 01:23:44 — within SLA ✓)
- Resolution text visible in expanded view

**Narration:** "Guard rail re-attached, torque verified. Resolution logged with evidence. We hit the SLA with an hour twenty to spare."

### Beat 5 — Verify and Close (10 seconds)
Click "Verify" (supervisor review) → Click "Close."
- Status: Resolved → Verified → Closed
- Full pipeline green
- SLA badge: "✓ Resolved within SLA"

**Narration:** "Supervisor verifies. Closed. Full audit trail — who reported it, who fixed it, when, and the evidence."

### Beat 6 — Show Won't Fix Path (optional, 10 seconds)
Show a low-severity issue → click "Mark Won't Fix" → system records it as terminal.

**Narration:** "Not every issue needs a fix. Cosmetic damage, duplicate reports — mark it won't fix and move on."

---

## State Flow

```
Create:       → open (SLA timer starts)
Assign:       open → assigned (assignedTo set)
Start Work:   assigned → in_progress
Resolve:      in_progress → resolved (resolution + evidence required)
Verify:       resolved → verified (supervisor sign-off)
Close:        verified → closed (terminal)

Alt path:     in_progress → wont_fix (terminal)
Alt path:     open → closed (close_invalid — duplicate/spam)
Rework:       resolved → in_progress (reopen — verification failed)
```

---

## Seed Data

```typescript
const issueSeed = {
  projectId: project.id,
  zoneId: zone2.id,
  title: 'Conveyor guard rail detached — Zone B crossbelt sorter near Panel CB-04',
  description: 'Guard rail on crossbelt sorter section 4 has come loose. Two bolts sheared. Area cordoned off pending repair.',
  severity: 'critical',
  category: 'safety',
  reportedBy: 'J. Martinez',
  slaDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
}
```

---

## SLA Logic

| Severity | SLA Window | Timer Color |
|----------|-----------|-------------|
| Critical | 4 hours | Red when < 1 hour, amber when < 2 hours |
| High | 8 hours | Red when < 2 hours |
| Medium | 24 hours | Red when < 4 hours |
| Low | 72 hours | Red when < 12 hours |

Timer calculation: `slaDeadline - now()`. Updates every second. Turns red when approaching. Shows "OVERDUE" if past deadline.

---

## UI Components Needed

1. **Issue Card** — Severity badge, category tag, SLA timer, status pipeline, action buttons
2. **Create Issue Modal** — Title, description, severity selector, category dropdown, zone picker
3. **SLA Timer** — Live countdown, color-coded by urgency
4. **Resolve Modal** — Resolution text (required), evidence attachment area
5. **Status Pipeline** — 7-dot horizontal tracker
6. **Issue List** — Sorted by severity then SLA deadline (most urgent first)

---

## Technical Notes

- Boot `makeIssueMachine` in-memory
- SLA timer is a `setInterval` in the React component, not a backend clock
- `isPastSLA()` and `hoursUntilSLA()` come from the Issue schema methods
- Evidence array stored as JSONB — for demo, just text descriptions
- The severity→SLA window mapping should be configurable (feature flag territory)
