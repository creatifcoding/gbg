# Conductor Chat Message+Shell Implementation Plan v2

Date: 2026-02-11  
Owner: Val

## Planning intent

Convert locked contracts into execution order with explicit dependencies while preserving the user lock:
- **No big-bang ConductorAgentChat adoption** until explicit user instruction.

## Status snapshot (v2.3)

- PR-MSG-01 complete (`#850-#854`).
- PR-MSG-02 complete (`#855-#859`).
- PR-MSG-03 complete (`#860-#861`).
- PR-SHELL-01 complete (`#862-#866`).
- PR-SHELL-02 complete (`#867-#870`).
- PR-SHELL-03 complete (`#871-#873`).

---

## Phase ordering (locked)

1. **Message second-order compounds first**
2. **Shell second-order responsibilities second**
3. **Validation and contract evidence**
4. **Adoption remains deferred (explicit unlock required)**

---

## Phase M1 — Message second-order contract build

Deliverables:
- `RvnChatMessage.HeaderCluster`
- `RvnChatMessage.BodyContent`
- `RvnChatMessage.AttachmentLane`
- `RvnChatMessage.FooterActions`
- `RvnChatMessage.SeverityRails`

Dependencies:
- AttachmentLane depends on inline-task-thread contract components and artifact card components.

Exit criteria:
- Message second-order API exported and type-safe.

---

## Phase M2 — Attachment lane payload contracts

Deliverables:
- `messageAnchorId` keyed attachment contract docs + implementation alignment.
- Attachment status badges + collapse controls.

Dependencies:
- M2 depends on M1 lane boundaries.

Exit criteria:
- Attachment lane supports required surfaces without ad-hoc message markup.

---

## Phase S1 — Shell second-order responsibility build

Deliverables:
- OverlayLayer
- OrnamentLayer
- GeometryContract
- ScrollContract
- SlotGuards

Dependencies:
- S1 starts after M1 (message-first directive).

Exit criteria:
- Shell contract explicitly absorbs frame responsibilities in code/docs.

---

## Phase S2 — Header alignment in shell

Deliverables:
- Header extended compounds aligned to shell second-order contract:
  - Controls
  - AgentSelector
  - SessionCluster
  - interactive ConnectionBadge path

Dependencies:
- S2 depends on S1.

Exit criteria:
- Header contract consistent with shell ownership model and no boundary conflict remains.

---

## Phase V1 — Validation + evidence

Deliverables:
- focused typecheck/tests
- updated plan verification doc
- updated artifact index links

Dependencies:
- V1 depends on M2 + S2.

Exit criteria:
- compile and targeted conductor suites pass.
- docs reflect final contract boundaries and deferred adoption lock.

---

## Deferred phase (unlock required)

## A1 — Big-bang adoption in `ConductorAgentChat`

Blocked until explicit user authorization.

---

## Focused commands (when implementing)

1. `bunx tsc --noEmit -p tsconfig.json`
2. `bunx vitest src/components/testbed/conductor/__tests__/ConductorAgentChat.regression.test.tsx`
3. `bunx vitest src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts`
