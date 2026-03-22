# Conductor Chat Shell/Header/Composer Implementation Plan v1

Date: 2026-02-11  
Owner: Val

## Goal

Execute semantic shell/header/composer compound completion, including interactive `RvnChatConnectionBadge` and deep composer compounding.

Current execution policy update:
- big-bang adoption in `ConductorAgentChat.tsx` is deferred pending explicit user unlock.

---

## Phase 1 — Header semantic compounds

### Build
- Add header semantic layer files under `src/lib/rvn/chat/shell/header-band/`:
  - `controls-root.tsx`
  - `agent-selector-root.tsx`
  - `session-cluster-root.tsx`
- Export through `header-band/index.ts`.

### Wire
- Replace ad-hoc header control clusters in `ConductorAgentChatHeader` with:
  - `RvnChatHeaderBand.Left/Center/Right`
  - `RvnChatHeaderBand.Controls`
  - `RvnChatHeaderBand.AgentSelector`
  - `RvnChatHeaderBand.SessionCluster`

### Done when
- Header structure is slot + semantic compounds only.

---

## Phase 2 — Interactive connection badge

### Build
- Extend `status/connection-badge.tsx` contract to support:
  - icon-first compact state
  - hover expansion state
  - probe action callback
  - optional lazy detail resolver while visible

Suggested props:
- `state`
- `latencyMs?`
- `onProbe?`
- `probeLabel?`
- `expandedDetails?` (optional resolver data)

### Wire
- Replace connection chip in `ConductorAgentChatHeader` with `RvnChatConnectionBadge`.

### Done when
- No ad-hoc connection chips remain in header.

---

## Phase 3 — Composer deep second-order compounds

### Build
- Add missing deep composer primitives:
  - `composer-input/counter.tsx`
  - `composer-toolbar/voice-group.tsx`
  - `transport/primary.tsx`
  - `transport/reconnect.tsx`
  - `transport/index.ts`
- Extend composer exports accordingly.

### Wire
- Recompose `ConductorAgentChatComposer` using:
  - `RvnChatComposer.Input.*`
  - `RvnChatComposer.Suggestions.*`
  - `RvnChatComposer.Toolbar.*`
  - `RvnChatComposer.Transport.*`
  - `RvnChatComposer.RecordingBanner`

### Done when
- Toolbar and transport ownership boundaries are explicit in code and markup.
- Deep compound surfaces are exported and documented, even when runtime adoption is deferred.

---

## Phase 4 — Big-bang shell adoption

### Wire
- Replace top-level section structure in `ConductorAgentChatRoot` with `RvnChatShell` bands:
  - `HeaderBand`
  - `CommandBand`
  - `ThreadBand`
  - `ComposerBand`

### Keep stable
- Existing behavior contracts (streaming, pause/send toggles, reconnect semantics, node-scoped draft/scroll preservation).

### Done when
- `ConductorAgentChat` is entirely composed through RVN compounds.

---

## Validation (focused)

Run after each phase:
1. `bunx tsc --noEmit -p tsconfig.json`
2. `bunx vitest src/components/testbed/conductor/__tests__/ConductorAgentChat.regression.test.tsx`
3. `bunx vitest src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts`

Manual check focus:
- header controls and selector still function
- connection badge hover expansion and probe action
- composer focus/keyboard precedence unchanged
- L2/L3 expansion behavior unchanged

---

## Risks + Mitigations

1. **Risk**: behavior drift during big-bang replace.
   - **Mitigation**: keep handler signatures unchanged; recompose UI only.
2. **Risk**: hover-badge introduces jitter.
   - **Mitigation**: animate width/opacity only; no layout thrash across full header row.
3. **Risk**: composer deep split breaks keyboard precedence.
   - **Mitigation**: keep key handling centralized in root composer logic; compounds remain presentational + event-forwarding.

---

## Deferred item

Breakpoint constants are intentionally deferred and will be frozen after adoption validation pass (per user direction).
