# Conductor Chat Alignment Check v1

Date: 2026-02-11  
Owner: Val

Purpose: verify implementation against locked design contracts + implementation specs, and identify drift.

## Sources audited

- `conductor-chat-shell-boundary-contract-v1.md`
- `conductor-chat-message-second-order-contract-v1.md`
- `conductor-chat-message-shell-implementation-plan-v2.md`
- `conductor-chat-message-shell-dependency-graph-pr-slices-v1.md`
- feature/task state: `#F222 #F227 #F234 #F238`, tasks `#850-#873` and `#820-#832`
- code surface: `src/lib/rvn/chat/*`, `src/components/testbed/conductor/ConductorAgentChat.tsx`

---

## Alignment matrix

| Promise | Status | Evidence | Gap / Note |
|---|---|---|---|
| Shell absorbs Frame boundary model is canonical | **Partial** | `shell/` concern exists + contract docs locked | `frame/` remains as transitional/back-compat; acceptable if explicitly transitional |
| Shell second-order responsibilities (Overlay/Ornament/Geometry/Scroll/SlotGuards) | **Not started** | Tasks `#862-#866` todo | Implementation pending (PR-SHELL-01) |
| Header extended semantic compounds (Controls/AgentSelector/SessionCluster) | **Implemented (library)** | `shell/header-band/{controls-root,agent-selector-root,session-cluster-root}.tsx` | Not adopted in `ConductorAgentChat` yet by user lock |
| Interactive ConnectionBadge (icon + hover expansion + latency + probe) | **Implemented (library)** | `status/connection-badge.tsx`, chat css contract | Tracker drift: tasks `#823/#824` still todo |
| Composer deep second-order contract (Counter/VoiceGroup/Transport Primary+Reconnect) | **Not complete** | `composer/` concern exists | Missing tasks `#826-#828` |
| Message second-order lanes (HeaderCluster/BodyContent/FooterActions/SeverityRails/AttachmentLane) | **Implemented** | tasks `#850-#854` done; components in `msg/*` | Need doc sync + validation closure (`#860/#861`) |
| AttachmentLane required mounts (InlineTaskThread/ArtifactCard/StatusBadges/CollapseControls) | **Implemented** | tasks `#855-#858` done; slots in `attachment-lane/*` | Slots present; concrete attachment consumers still follow-on |
| messageAnchorId-only attachment binding | **Implemented** | `attachment-lane-root.tsx` requires + normalizes `messageAnchorId`; task `#859` done | Good |
| Message docs + validation closure (PR-MSG-03) | **Pending** | tasks `#860/#861` todo | Next immediate slice |
| Inline task thread system (schema/atoms/components/virtualization/integration) | **Not started** | `#F227` open, rollup 0% | Big missing lane |
| Big-bang ConductorAgentChat adoption remains deferred | **Aligned** | `ConductorAgentChat.tsx` has no `RvnChatShell/RvnChatHeaderBand/RvnChatConnectionBadge` imports | Guardrail holds |

---

## Critical drift found

1. **Tracker drift (stale todo tasks)**
   - Implementation appears present for header semantic compounds + connection badge, but tasks remain todo:
     - `#820 #821 #822 #823 #824`
2. **Contract/API drift (message namespace)**
   - Message second-order lanes exist in `msg/*`, but canonical contract states these as `RvnChatMessage.*` lanes.
   - Current exports are concern-level (`RvnChatMessageHeaderCluster`, etc.) rather than attached to `RvnChatMessage` namespace.

---

## Recommended next sequence (no big-bang)

1. **PR-MSG-03** (`#860 #861`) — close message docs + validation.
2. **Reconcile tracker drift** for `#820-#824` to reflect actual code state or split remaining deltas.
3. **PR-SHELL-01** (`#862-#866`) — implement shell second-order responsibilities.
4. **PR-SHELL-02** (`#867-#870`) — align header semantics + connection badge under shell contract.
5. **Inline task thread lane kickoff** (`#F227`) after shell/message contract closure.

---

## Guardrail reaffirmed

No big-bang adoption in `ConductorAgentChat` until explicit user unlock.

---

## Addendum v1.1 — Iconography lane update

Post-audit progress applied:

- Icon foundation completed (`role-icon-map`, precision constants).
- Header icon badge surfaces completed:
  - `HeaderCluster.RoleBadge`
  - `HeaderCluster.StreamingBadge`
- Message icon surfaces completed:
  - `SeverityRails.RoleIconRail`
  - `AttachmentLane.TelemetryBadge`

Validation rerun:
- `bunx tsc --noEmit -p tsconfig.json` ✅
- `ConductorAgentChat.regression` ✅ (10/10)

Guard check rerun:
- `ConductorAgentChat.tsx` still has no big-bang RVN shell/header/composer adoption imports.

---

## Addendum v1.2 — Shell absorption lane update

Post-audit progress applied:

- Shell second-order responsibility contracts completed:
  - `OverlayLayer`
  - `OrnamentLayer`
  - `GeometryContract`
  - `ScrollContract`
  - `SlotGuards`
- Header semantic ownership alignment completed under shell:
  - `Header.Controls`
  - `Header.AgentSelector`
  - `Header.SessionCluster`
  - `Header.ConnectionBadge` semantic compound

Validation rerun:
- `bunx tsc --noEmit -p tsconfig.json` ✅
- `ConductorAgentChat.regression` ✅
- `chat-v2-hardcut` ✅

Guard check rerun:
- `ConductorAgentChat.tsx` still has no `RvnChatShell`/`RvnChatHeaderBand`/`RvnChatConnectionBadge` imports.
