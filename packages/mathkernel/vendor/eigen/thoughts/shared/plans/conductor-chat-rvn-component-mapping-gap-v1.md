# Conductor Chat RVN Component Mapping + Functional Gap Matrix v1

Date: 2026-02-11  
Owner: Val  
Inputs:
- `src/lib/conductor/integrate/react-app.js`
- `src/lib/rvn/*`
- `src/components/testbed/conductor/ConductorAgentChat.tsx`

## Mapping Matrix

| Design-basis latent component | Best RVN match (existing) | Fit | Required extension/new component |
|---|---:|---:|---|
| ChatWorkbenchFrame | `RvnPanel.Root` or `RvnCard` | 80% | Add `RvnChatFrame` wrapper for corner caps + backdrop hooks |
| SessionTitleBlock | `RvnPanel.Title` + `RvnPanel.Subtitle` | 75% | Add conductor-specific title/meta row contract |
| ConnectionChipsCluster | `RvnIndicator` / `RvnStatusDot` + `RvnBadge` | 70% | Add `RvnStatusChip` with pulse variant (`connecting`) |
| HeaderControlRail buttons | `RvnButton`, `RvnIconButton` | 90% | Add consistent compact control sizing tokens |
| Agent select trigger/menu | `RvnDropdown` | 85% | Add richer option template (role/model/status sublines) |
| QuickCommandChip | `RvnButton` size sm/ghost | 85% | Add chip variant (`command`) for command rail |
| SystemModeTelemetryBadge | `RvnBadge` + `RvnStatusDot` | 80% | Add `RvnTelemetryPill` for icon + label pairing |
| Message row shell (system/user/agent) | `RvnLogEntry` (partial), `RvnAvatar` | 55% | **New:** `RvnChatMessage` compound (meta, rail, body, footer) |
| AnalysisCardPayload | `RvnCard`, `RvnBadge`, `RvnTable` | 70% | **New:** `RvnChatArtifactCard` for assistant payload cards |
| Connection interruption banner | `RvnAlert` | 90% | Add conductor warning copy contract + persistence policy |
| Empty thread hint row | `RvnIndicator` + helper text | 75% | **New:** `RvnChatEmptyState` |
| Composer writing field | (none exact; `RvnTextarea` not target) | 30% | **New:** `RvnComposerContentEditable` (required, no `<textarea>`) |
| Mode toggle strip | `RvnTabBar` + `RvnTabButton` | 88% | Minor compact variant for footer embedding |
| Insert action controls | `RvnToolbar` + `RvnToolbar.Button` | 90% | Add command/mention/voice semantic slots |
| Reconnect / Send transport | `RvnButton` | 95% | Add transport variants (`danger-outline`, `send-primary`) |
| Corner ornaments | `RvnCrosshairCorners` | 78% | Add frame-corner-only styling variant |

---

## Functionalization Gaps (design -> working chat)

## 1) Message model + role rendering
Need deterministic mapping from runtime message schema into visual rows:
- `system | user | assistant | tool` role styles
- stream state (`assistant_streaming`) with cursor mark
- optional artifact payload card rendering

**Action:** introduce presenter layer:
- `ConductorChatMessageViewModel` (pure mapping)
- `ConductorChatRenderPolicy` (role/style decisions)

## 2) Streaming-first thread behavior
Design basis is static; production chat needs:
- append/patch streaming assistant messages
- preserved scroll intent (sticky-bottom vs manual scroll)
- resumable thread hydration per node/session

**Action:** keep current `agent-chat-stx` stream pipeline; add virtualization threshold if volume climbs.

## 3) Slash + mention intelligence
Design shows chips only; real chat needs:
- live search
- keyboard navigation
- insertion semantics
- suppression/reset rules

**Action:** preserve current suggestion state machine; port visuals to RVN class contract.

## 4) Connectivity and transport truth
Design has static labels; runtime needs:
- offline/connecting/reconnecting/resyncing truth from atoms
- explicit reconnect CTA gating
- pause/send dual-action behavior

**Action:** keep connection/message lifecycle atoms as source of truth; no optimistic badges.

## 5) Node-scoped continuity
Design is single session façade; runtime must remain node-scoped:
- active node/session identity in header
- node-local draft preservation
- per-node message timeline

**Action:** keep `chatExpansionByNodeId` + per-node atomized session state.

## 6) Accessibility gaps
Need explicit a11y contracts for:
- listbox/option semantics (agent + suggestions)
- contenteditable textbox semantics
- status/alert live regions
- focus restore rules on insert controls

**Action:** preserve current regression-tested semantics; reskin layout only.

---

## Recommended new RVN chat components (minimal set)

1. `RvnChatFrame`
2. `RvnStatusChip`
3. `RvnChatMessage` (compound)
4. `RvnChatArtifactCard`
5. `RvnComposerContentEditable`
6. `RvnChatEmptyState`

These six components close most of the visual/function gap while maximizing reuse of existing RVN primitives.