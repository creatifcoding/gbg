# Conductor Chat Message Shell Isolation + Role Badge Implementation Plan v1

Date: 2026-02-11  
Owner: Val

## Intent

Implement missing responsibility isolation for message second-order ownership and complete role badge/icon contract from `react-app.js` reference.

Guardrail:
- No big-bang `ConductorAgentChat` adoption in this plan.

---

## Phase MSI-01 — Introduce second-order message shell owner

Deliverables:
- `msg/message-shell-root.tsx`
- `msg/message-shell-context.ts`
- `msg/message-shell-index.ts`
- `RvnChatMessageShell` namespace exports for first-order lanes

Dependencies:
- builds on completed lane extraction (`#850-#859`)

Exit criteria:
- first-order lanes are composed through shell namespace contract.

---

## Phase MSI-02 — Role badge compounds + icon rail

Deliverables:
- `msg/header-cluster/role-badge.tsx`
- `msg/header-cluster/streaming-badge.tsx`
- `msg/severity-rails/role-icon-rail.tsx`
- `msg/attachment-lane/telemetry-badge-slot.tsx`

Locked mapping:
- operator=CircleUser, agent=Bot, system=Terminal, tool=Hammer

Exit criteria:
- both HeaderCluster and SeverityRails expose role affordance surfaces.

---

## Phase MSI-03 — Lucide precision and motion policy

Deliverables:
- enforce icon size/stroke contracts:
  - role icons 16/2
  - utility icons 12/2
- agent-only streaming icon animation path

Exit criteria:
- iconography matches contract and visual parity cues from `react-app.js`.

---

## Phase MSI-04 — Validation + docs sync

Deliverables:
- focused typecheck + targeted conductor tests
- alignment doc refresh
- feature/task tracker sync

Exit criteria:
- lane is contract-complete without adoption drift.
