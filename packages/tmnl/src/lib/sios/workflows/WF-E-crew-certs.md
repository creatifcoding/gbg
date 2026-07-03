# WF-E — Crew Deployment & Cert Compliance

> Filter deployable workers. Flag expiring badges. Block assignment of non-compliant workers. Airport security enforced by code.

---

## Audience & Purpose

**Primary:** Both stakeholders — airport security badges are JCK's #1 workforce constraint. A worker with an expired SIDA badge literally cannot enter the airfield. If JCK sends someone without proper credentials, that's a site shutdown.

**What it proves:** SIOS tracks certifications, badge expiry, and deployability automatically. The system prevents non-compliant assignment — not through a policy document, but through a data-driven guard rail.

---

## Screen Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Crew Alpha — Mechanical                   6/8 deployable      │
│  Shift: Day · Foreman: Mike Torres · Project: DFW Terminal B   │
├─────────────────────────────────────────────────────────────────┤
│  [Show All] [Deployable Only] [Expiring Badges (30d)]          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─── Worker Roster ──────────────────────────────────────┐    │
│  │  Name           Badge       Certs           Status     │    │
│  │  ─────────────────────────────────────────────────────  │    │
│  │  Mike Torres    ✓ SIDA      OSHA-30, AWS    ● ACTIVE   │    │
│  │  Ana Reyes      ✓ SIDA      OSHA-10, FA     ● ACTIVE   │    │
│  │  Carlos Diaz    ⚠ 12 days   OSHA-30         ⚠ EXPIRING │    │
│  │  James Wu       ✗ Expired   NCCCO, OSHA     ✗ BLOCKED  │    │
│  │  Sofia Chen     ✓ SIDA      OSHA-30, NCCCO  ● ACTIVE   │    │
│  │  Ray Patel      — On Leave  OSHA-10         ◐ ON LEAVE │    │
│  │  Tom Nguyen     ✓ SIDA      OSHA-30, AWS    ● ACTIVE   │    │
│  │  Luis Herrera   ✓ SIDA      OSHA-10         ● ACTIVE   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                 │
│  ┌─── Worker Detail (expanded) ───────────────────────────┐    │
│  │  James Wu — Ironworker                                  │    │
│  │  Status: BADGE_EXPIRED · Rate: $42/hr                   │    │
│  │                                                          │    │
│  │  Certifications:                                         │    │
│  │    ✓ NCCCO Rigging — Exp. 2027-06-15                    │    │
│  │    ✓ OSHA 30-Hour — No expiry                           │    │
│  │    ✗ SIDA Badge — Expired 2026-03-20                    │    │
│  │                                                          │    │
│  │  Lifecycle: active → badge_expired                       │    │
│  │  [Renew Badge ▶]  [Go On Leave]  [Offboard]            │    │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Interaction Script

### Beat 1 — Survey the Roster (10 seconds)
Crew Alpha loaded with 8 workers. Quick scan: 5 active (green), 1 expiring badge (amber), 1 badge expired (red), 1 on leave (gray).

**Narration:** "Crew Alpha — eight-person mechanical crew. Six deployable, one with a badge expiring in 12 days, one blocked — expired SIDA badge."

### Beat 2 — Filter to Deployable Only (10 seconds)
Click "Deployable Only" filter. James Wu (blocked) and Ray Patel (on leave) disappear from the list. Carlos Diaz stays but highlighted amber.

**Narration:** "Filter to deployable. James is blocked — can't send him onto the airfield. Ray is on leave. Carlos is deployable but his badge expires in 12 days — that's your warning window."

### Beat 3 — Inspect Blocked Worker (15 seconds)
Click back to "Show All." Click James Wu to expand his detail panel.
- Shows his certifications: NCCCO valid, OSHA-30 valid, but SIDA badge expired March 20.
- Worker lifecycle indicator: `active → badge_expired`
- Status clearly shows WHY he's blocked: the badge, not the certs.

**Narration:** "James is an ironworker — NCCCO rigging, OSHA 30. Fully certified. But his SIDA airport badge expired 11 days ago. Until that's renewed, he's grounded. The system knows the difference between a cert issue and a badge issue."

### Beat 4 — Try to Assign Blocked Worker (10 seconds)
Drag James Wu toward a work package assignment (or click "Assign to WP"). System shows error:

> ✗ Cannot assign: Worker badge expired. Renew SIDA badge before deployment.

**Narration:** "If I try to assign him to a work package — blocked. The system enforces what airport security requires. No spreadsheet honor system."

### Beat 5 — Renew Badge → Worker Becomes Deployable (15 seconds)
Click "Renew Badge" on James Wu. Modal:
- New badge number: SIDA-2026-4481
- New expiry: 2027-03-31

Submit. Worker transitions: `badge_expired → active`.
- Row turns green
- Deployable count: 6/8 → 7/8
- Can now be assigned

**Narration:** "Badge renewed. James is back. Seven of eight now deployable."

### Beat 6 — Show Expiring Badges Filter (10 seconds)
Click "Expiring Badges (30d)" filter. Only Carlos Diaz appears — badge expires in 12 days.

**Narration:** "This is your early warning. Carlos needs a badge renewal appointment before the 12th. The system flags it automatically — your ops coordinator doesn't need to check a spreadsheet."

---

## State Flow (Worker)

```
James Wu:
  Current: badge_expired
  Beat 5:  badge_expired → active  (renew_badge, new badge data)

Carlos Diaz:
  Current: active (but badgeExpiresWithin(30) = true)
  → amber warning, still deployable

Ray Patel:
  Current: on_leave
  → not deployable, but can return_from_leave → active
```

---

## Seed Data

```typescript
const workerSeeds = [
  { name: 'Mike Torres', tradeRole: 'foreman', status: 'active', hourlyRate: 55, badgeNumber: 'SIDA-2025-3301', badgeExpiry: DateTime.make({ year: 2027, month: 1 }), certifications: [{ type: 'osha_30' }, { type: 'aws_welding' }] },
  { name: 'Ana Reyes', tradeRole: 'electrician', status: 'active', hourlyRate: 48, badgeNumber: 'SIDA-2025-3302', badgeExpiry: DateTime.make({ year: 2027, month: 6 }), certifications: [{ type: 'osha_10' }, { type: 'first_aid' }] },
  { name: 'Carlos Diaz', tradeRole: 'mechanic', status: 'active', hourlyRate: 45, badgeNumber: 'SIDA-2025-3303', badgeExpiry: DateTime.make({ year: 2026, month: 4, day: 12 }), certifications: [{ type: 'osha_30' }] },
  { name: 'James Wu', tradeRole: 'ironworker', status: 'badge_expired', hourlyRate: 42, badgeNumber: 'SIDA-2024-2901', badgeExpiry: DateTime.make({ year: 2026, month: 3, day: 20 }), certifications: [{ type: 'nccco_rigging' }, { type: 'osha_30' }] },
  { name: 'Sofia Chen', tradeRole: 'mechanic', status: 'active', hourlyRate: 44, badgeNumber: 'SIDA-2025-3304', badgeExpiry: DateTime.make({ year: 2027, month: 9 }), certifications: [{ type: 'osha_30' }, { type: 'nccco_rigging' }] },
  { name: 'Ray Patel', tradeRole: 'helper', status: 'on_leave', hourlyRate: 28, certifications: [{ type: 'osha_10' }] },
  { name: 'Tom Nguyen', tradeRole: 'pipe_fitter', status: 'active', hourlyRate: 50, badgeNumber: 'SIDA-2025-3305', badgeExpiry: DateTime.make({ year: 2027, month: 3 }), certifications: [{ type: 'osha_30' }, { type: 'aws_welding' }] },
  { name: 'Luis Herrera', tradeRole: 'helper', status: 'active', hourlyRate: 26, badgeNumber: 'SIDA-2025-3306', badgeExpiry: DateTime.make({ year: 2027, month: 5 }), certifications: [{ type: 'osha_10' }] },
]
```

---

## UI Components Needed

1. **Worker Roster Table** — Name, badge status (icon + text), certs (badges), lifecycle status
2. **Filter Bar** — Show All / Deployable Only / Expiring Badges (30d) toggle buttons
3. **Worker Detail Panel** — Expandable. Shows full cert list with expiry dates, lifecycle state, action buttons.
4. **Renew Badge Modal** — New badge number, new expiry date
5. **Assignment Block Toast** — Error when trying to assign non-deployable worker
6. **Deployable Counter** — "6/8 deployable" in the crew header, updates live
7. **Badge Expiry Warning** — Amber highlight with days-until-expiry counter

---

## Technical Notes

- Boot `makeWorkerMachine` in-memory. Pre-seed 8 workers in mixed states.
- `isDeployable()` schema method: status === 'active' && hasValidBadge()
- `badgeExpiresWithin(days)` drives the amber warning filter
- `hasValidBadge()`: badgeExpiry is defined and > now
- Worker lifecycle transitions: `expire_badge`, `renew_badge`, `go_on_leave`, `return_from_leave`, `offboard`
- Cert display is read-only for demo — show what they have, not a full cert management UI
