# Conductor Chat RVN Extraction Execution Plan v1

Date: 2026-02-11  
Owner: Val  
Status: Ready to execute (document complete)

## Mission

Perform the **actual extraction** of `react-app.js` design-basis components into `src/lib/rvn/chat` using:

- strict slot-per-file decomposition,
- namespace-only compound APIs,
- leaf-owned motion,
- hybrid styling (shared base + component overlays),
- controllable composer contract.

This plan is extraction-first. Adoption/swap inside `ConductorAgentChat` is a follow-up pass.

---

## Scope

## In scope

1. Decompose existing foundational files into directory compounds.
2. Extract missing design-basis components identified in accounting.
3. Normalize exports from `src/lib/rvn/chat/index.ts` and `src/lib/rvn/index.ts`.
4. Keep TypeScript and targeted conductor tests green.

## Out of scope

1. Full big-bang replacement of all `ConductorAgentChat` internals in this step.
2. Transport/runtime behavior refactors (`agent-chat-stx`, chat-v2 wiring).
3. Broader design token rework outside chat scope.

---

## Source parity checklist (`react-app.js`)

The extraction is complete only when these surfaces exist as RVN components:

1. `StatusIndicator` → `RvnStatusChip`
2. `CommandButton` → `RvnChatCommandButton`
3. `MessageBubble` → `RvnChatMessage` + `RoleRail`
4. `AnalysisCard` → `RvnChatArtifactCard`
5. Header control rail + selector → `RvnChatAgentSelector` + transport/control buttons
6. Interruption banner → `RvnChatInterruptionBanner`
7. Empty thread hint → `RvnChatEmptyState`
8. Telemetry badge → `RvnChatTelemetryPill`
9. Corner caps → `RvnChatFrame.Corners`
10. Contenteditable composer primitive → `RvnComposerContentEditable`

---

## Target architecture (strict directories)

```text
src/lib/rvn/chat/
  RvnChatFrame/
    Root.tsx
    Header.tsx
    CommandRail.tsx
    Thread.tsx
    Composer.tsx
    Corners.tsx
    context.ts
    types.ts
    index.ts

  RvnStatusChip/
    Root.tsx
    types.ts
    index.ts

  RvnChatCommandButton/
    Root.tsx
    types.ts
    index.ts

  RvnChatTelemetryPill/
    Root.tsx
    types.ts
    index.ts

  RvnChatMessage/
    Root.tsx
    Meta.tsx
    Body.tsx
    Footer.tsx
    RoleRail.tsx
    User.tsx
    Assistant.tsx
    System.tsx
    context.ts
    types.ts
    index.ts

  RvnChatArtifactCard/
    Root.tsx
    Header.tsx
    Body.tsx
    Metric.tsx
    Actions.tsx
    types.ts
    index.ts

  RvnChatInterruptionBanner/
    Root.tsx
    types.ts
    index.ts

  RvnChatEmptyState/
    Root.tsx
    types.ts
    index.ts

  RvnComposerContentEditable/
    Root.tsx
    hooks.ts
    types.ts
    index.ts

  RvnChatAgentSelector/
    Root.tsx
    Trigger.tsx
    Menu.tsx
    Option.tsx
    context.ts
    types.ts
    index.ts

  RvnChatTransportButton/
    Root.tsx
    Pause.tsx
    Reconnect.tsx
    Send.tsx
    types.ts
    index.ts

  index.ts
```

---

## Component contracts (must hold)

## A) Namespace-only compounds

- `RvnChatFrame.Root/Header/CommandRail/Thread/Composer/Corners`
- `RvnChatMessage.Root/Meta/Body/Footer/RoleRail/User/Assistant/System`
- `RvnChatAgentSelector.Root/Trigger/Menu/Option`
- `RvnChatArtifactCard.Root/Header/Body/Metric/Actions`

No direct flat API as primary interface.

## B) Types

- Every compound has `types.ts`.
- Every slot extends native element props.
- Export all public prop types from each local `index.ts` and package root.

## C) Accessibility

- Selector uses `listbox/option` semantics.
- Contenteditable keeps `role="textbox"`, multiline semantics.
- Interruption banner supports `role="status"|"alert"` mode.
- Buttons preserve disabled/aria labels.

## D) Motion ownership

- Micro-interactions live in leaf slots (buttons, chips, options).
- Layout transitions remain at owning root surfaces.

---

## Execution sequence

## Step 1 — Scaffold + foundational migration

1. Create all directories/files listed above.
2. Move logic from:
   - `RvnChatFrame.tsx`
   - `RvnStatusChip.tsx`
   - `RvnChatMessage.tsx`
   - `RvnComposerContentEditable.tsx`
   into strict directory compounds.
3. Keep behavior 1:1 while moving code.

## Step 2 — Missing component extraction

Build net-new components:

1. `RvnChatCommandButton`
2. `RvnChatTelemetryPill`
3. `RvnChatArtifactCard`
4. `RvnChatInterruptionBanner`
5. `RvnChatEmptyState`
6. `RvnChatAgentSelector`
7. `RvnChatTransportButton`
8. `RvnChatFrame.Corners`
9. `RvnChatMessage.RoleRail`

## Step 3 — Exports + package wiring

1. Replace old file exports with directory exports in `src/lib/rvn/chat/index.ts`.
2. Ensure `src/lib/rvn/index.ts` still re-exports `./chat` cleanly.

## Step 4 — Validation

1. `bunx tsc --noEmit -p tsconfig.json`
2. `bunx vitest src/components/testbed/conductor/__tests__/ConductorAgentChat.regression.test.tsx`
3. `bunx vitest src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts`

---

## Acceptance criteria

Extraction phase is done when:

1. `src/lib/rvn/chat` follows strict directory-per-component, slot-per-file structure.
2. All `react-app.js` latent surfaces are represented in RVN chat components.
3. Namespace-only compounds are exported and type-safe.
4. Targeted compile/tests pass.
5. No style-tag injection or radius regressions introduced.

---

## Risks + mitigation

1. **Risk:** Over-fragmented imports and circular refs.  
   **Mitigation:** keep `context.ts` and `types.ts` leaf-local; import upward only through local indexes.

2. **Risk:** API drift between extracted primitives and existing conductor usage.  
   **Mitigation:** keep prop contracts backward-compatible during extraction; adoption comes after extraction lock.

3. **Risk:** Motion regressions from decomposition.  
   **Mitigation:** isolate motion props to slot-level wrappers and keep transitions deterministic.

---

## Execution update (current)

Setup pass completed with improved hierarchy conventions:

- Concern-based folders created: `frame/`, `msg/`, `composer/`, `status/`, `btn/`, `selector/`, `banner/`, `card/`, `empty/`.
- Button convention applied (`btn/*-btn.tsx`).
- Banner and artifact-card systems split into their own concern folders.
- `chat/index.ts` now exports by concern first.
- Foundational legacy flat implementations remain temporarily for compatibility and are re-exported through concern indexes where applicable.

Validation after setup pass:
- `bunx tsc --noEmit -p tsconfig.json` ✅
- `ConductorAgentChat` regression tests ✅

## Next execution slice

Flesh each scaffolded concern into full basis-parity implementations, then perform big-bang consumption swap in `ConductorAgentChat.tsx`.

## Follow-up after extraction

After this plan is complete, run adoption plan:

- Big-bang swap in `ConductorAgentChat.tsx` to consume extracted RVN compounds.
- Remove duplicated local presentation logic.
- Keep runtime behavior unchanged.
