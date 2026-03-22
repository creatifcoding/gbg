# Conductor Chat `react-app.js` Component Accounting v1

Date: 2026-02-11  
Owner: Val  
Purpose: verify whether all latent `src/lib/conductor/integrate/react-app.js` components are accounted for in RVN/conductor implementation work.

## Verdict

**No — not all components are accounted for yet.**

Current extraction covers core scaffolding primitives, but several reference-design components remain unextracted or only locally implemented inside `ConductorAgentChat.tsx`.

---

## Source latent components (`react-app.js`)

Named components in file:
1. `StatusIndicator`
2. `CommandButton`
3. `MessageBubble`
4. `AnalysisCard`
5. `HomePage` (composed surface)

Additional latent sub-surfaces inside `HomePage`:
- header title block (title + subtitle)
- header control rail
- agent selector trigger/menu
- command rail right telemetry badge
- connection interruption banner
- empty thread hint row
- corner ornament caps
- composer toolbar groups (mode/insert/transport)

---

## Accounting matrix

| `react-app.js` latent surface | Current status | Where represented now | Gap |
|---|---|---|---|
| Frame shell | **Partial** | `RvnChatFrame.Root` + `.rvn-chat` css | Missing dedicated corner ornament component + shell motif variants |
| Header title block | **Partial** | Local `ConductorAgentChat.Header` markup/classes | Not extracted into RVN chat primitive |
| StatusIndicator | **Partial** | `RvnStatusChip` | Ping-dot visual parity + variant semantics still incomplete |
| Header control rail | **Partial** | Local header buttons in `ConductorAgentChat` | Missing dedicated RVN compound controls API |
| Agent selector trigger/menu | **Partial** | Local class-based implementation | Missing extracted `RvnChatAgentSelector` compound |
| CommandButton | **Partial** | `.rvn-chat__command-chip` class on `<button>` | Missing extracted component primitive |
| Command rail telemetry badge | **Missing** | N/A | Need `RvnTelemetryPill` / right-rail status component |
| MessageBubble | **Partial** | `RvnChatMessage` (root/meta/body/footer) | Missing left-gutter role icon rail and role ornament variants |
| AnalysisCard | **Missing** | N/A | Need `RvnChatArtifactCard` |
| Connection interruption banner | **Missing** | N/A (generic status row only) | Need dedicated interruption/banner component |
| Empty thread hint row | **Missing** | N/A (inline text only) | Need `RvnChatEmptyState` |
| Composer contenteditable | **Accounted** | `RvnComposerContentEditable` | Needs integration into conductor root during big-bang swap |
| Composer toolbar groups | **Partial** | Local class-based groups | Missing extracted compounds (`ModeGroup`, `InsertGroup`, `TransportGroup`) |
| Send/Reconnect button variants | **Partial** | CSS class variants only | Missing reusable RVN variant components |
| Corner ornament caps | **Missing** | N/A | Need `RvnChatFrame.Corners` |
| Pattern grid backdrop | **Partial** | thread background styling | Missing dedicated backdrop utility/slot |

---

## Current extracted RVN chat primitives (as of now)

- `RvnChatFrame`
- `RvnStatusChip`
- `RvnChatMessage`
- `RvnComposerContentEditable`

These are foundational but **not full parity** with the design basis.

---

## Mandatory follow-on extraction set (to reach parity)

1. `RvnChatArtifactCard`
2. `RvnChatInterruptionBanner`
3. `RvnChatEmptyState`
4. `RvnChatAgentSelector` (compound)
5. `RvnChatCommandButton`
6. `RvnChatTelemetryPill`
7. `RvnChatFrame.Corners` (ornament)
8. `RvnChatMessage.RoleRail` (left visual rail/icons)
9. `RvnChatTransportButton` variants (`send`, `reconnect`, `pause`)

---

## Alignment note

User-stated non-negotiable for this lane:
- **Port `react-app.js` style/components, enhance, and make actually usable.**

This accounting confirms we need one more extraction wave before claiming full basis-port parity.