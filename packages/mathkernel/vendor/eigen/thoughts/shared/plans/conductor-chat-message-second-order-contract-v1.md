# Conductor Chat Message Second-Order Contract v1

Date: 2026-02-11  
Owner: Val  
Decision source: questionnaires `conductor-rvn-message-frame-contract-v1` + `conductor-shell-vs-frame-boundary-v1`

## ALIGNED MODEL (locked)

- Message is a **second-order compound**.
- Message sub-components may themselves be **first-order compounds**.
- Inline task binding mode: **`messageAnchorId` only**.
- Motion ownership: **leaf-owned micro-motion + root-level geometry transitions only**.
- Implementation order preference: **message contracts first**.

---

## Message second-order contract

`RvnChatMessage`
- `Root`
- `HeaderCluster` (first-order compound)
- `BodyContent` (first-order compound)
- `AttachmentLane` (first-order compound)
- `FooterActions` (first-order compound)
- `SeverityRails` (first-order compound)

### HeaderCluster
Required slots:
- Role label
- Timestamp
- Streaming marker

Required badge/icon compounds (per iconography contract):
- `HeaderCluster.RoleBadge`
- `HeaderCluster.StreamingBadge`

### BodyContent
Required slots:
- Text/markdown body surface
- Stream cursor surface

### AttachmentLane
Required mounts:
- InlineTaskThread mount slot
- ArtifactCard mount slot
- Per-message status badges
- Per-attachment collapse controls
- Telemetry badge slot

### FooterActions
Required surfaces:
- Breakout actions
- Contextual message actions

### SeverityRails
Required behavior:
- role/status driven left-rail treatment.
- role icon rail compound surface (`SeverityRails.RoleIconRail`).

---

## Inline task linkage contract

- Message attachment lookup uses `messageAnchorId`.
- `AttachmentLane.Root` requires non-empty `messageAnchorId` (normalized/validated).
- No direct `message.id` contract in canonical version.
- Thread/session correlation is outside attachment keying contract.

---

## Acceptance criteria

- Message second-order compound API is documented with first-order nested lane ownership.
- AttachmentLane contract explicitly includes inline task + artifact + badges + collapse controls.
- Root/leaf motion ownership policy is reflected in implementation plans.
