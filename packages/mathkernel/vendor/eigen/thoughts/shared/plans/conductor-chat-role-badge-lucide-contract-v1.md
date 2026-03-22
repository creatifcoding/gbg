# Conductor Chat Role Badge + Lucide Contract v1

Date: 2026-02-11  
Owner: Val  
Decision source: questionnaire `conductor-message-badge-icon-contract-v1`, `conductor-role-icon-animation-v1`

## Scope

Define operator/agent/system/tool role badges and exact Lucide iconography usage for message surfaces.

---

## Required badge surfaces (locked)

1. Role badge (operator/agent/system/tool)
2. Streaming badge/state marker
3. Per-message status badge
4. Severity badge
5. Telemetry badge in attachment lane

Badge density policy: **full** (show all available badges).

Primary role badge location: **both**
- compact badge in HeaderCluster
- icon rail treatment in SeverityRails

---

## Lucide role mapping (locked)

- `operator` -> `CircleUser`
- `agent` -> `Bot`
- `system` -> `Terminal`
- `tool` -> `Hammer`

Streaming animation policy:
- animate **agent icon only** while streaming.

---

## Precision defaults (derived from react-app.js)

Reference cues from `MessageBubble` and command/analysis icon sizing:
- role glyph scale in message bubble uses `w-4 h-4` (~16px)
- utility/status glyphs commonly use `w-3 h-3` (~12px)
- SVG paths are rendered with `strokeWidth={2}` in source

TMNL contract:
- role badges/rails: `size={16}`, `strokeWidth={2}`
- compact badge utility icons: `size={12}`, `strokeWidth={2}`
- preserve 12px typography floor for label text

---

## Component contract additions

- `RvnChatMessageShell.HeaderCluster.RoleBadge`
- `RvnChatMessageShell.SeverityRails.RoleIconRail`
- `RvnChatMessageShell.AttachmentLane.TelemetryBadge`
- `RvnChatMessageShell.HeaderCluster.StreamingBadge`

All badge/icon components must be leaf-owned for micro-motion.

---

## Acceptance criteria

- Role badge/icon components exist with locked Lucide mapping.
- HeaderCluster + SeverityRails both render operator/agent role affordance.
- Agent icon animation only activates for streaming agent messages.
- Icon sizing/stroke contracts match this doc exactly.
