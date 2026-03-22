# Conductor Chat Message Shell Responsibility Contract v1

Date: 2026-02-11  
Owner: Val  
Source alignment: `src/lib/conductor/integrate/react-app.js` + questionnaire locks

## Why this exists

Current state has first-order message lanes extracted as sibling concerns, but not yet owned by an explicit second-order message shell namespace. This contract closes that gap.

---

## Locked model

- Message uses a **second-order owner**: `RvnChatMessageShell`
- First-order lanes are owned under this shell namespace:
  - `RvnChatMessageShell.HeaderCluster`
  - `RvnChatMessageShell.BodyContent`
  - `RvnChatMessageShell.AttachmentLane`
  - `RvnChatMessageShell.FooterActions`
  - `RvnChatMessageShell.SeverityRails`
- Lanes remain independently testable, but composition and responsibility are shell-owned.

---

## Responsibility split

## RvnChatMessageShell.Root owns
- lane composition order
- lane-level context handoff
- message role/streaming envelope context
- attachment binding entry policy (`messageAnchorId`)

## First-order lanes own
- their local slot contract + rendering semantics
- leaf micro-interactions only
- isolated styling contracts

---

## Non-goals

- No big-bang ConductorAgentChat adoption in this contract slice.
- No runtime orchestration refactor.

---

## Acceptance criteria

- A concrete `RvnChatMessageShell` namespace exists.
- Existing first-order lanes are exported under the shell namespace.
- Responsibility boundary is documented and reflected in code-level context ownership.
