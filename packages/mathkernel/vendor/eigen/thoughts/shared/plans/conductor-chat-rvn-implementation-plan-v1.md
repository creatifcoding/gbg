# ConductorAgentChat RVN Implementation Plan v1

Date: 2026-02-11  
Owner: Val  
References:
- `src/lib/conductor/integrate/react-app.js` (design basis)
- `thoughts/shared/plans/conductor-chat-rvn-design-decomposition-v1.md`
- `thoughts/shared/plans/conductor-chat-rvn-component-mapping-gap-v1.md`
- `thoughts/shared/plans/conductor-chat-rvn-css-class-contract-v1.md`

## Mission

Build a new `ConductorAgentChat` visual system that matches the reference aesthetic nearly verbatim while preserving current stream-first behavior and node-scoped runtime contracts.

## Guardrails (non-negotiable)

1. **No style-tag injection**.
2. **No `<textarea>` composer** (contenteditable primitive only).
3. **No font below 12px**.
4. **No border radius**.
5. Keep runtime state/control paths intact (`agent-chat-stx`, chat-v2 flow).
6. Prefer RVN/TMNL tokens and class-based CSS over inline style literals.

---

## Delivery Strategy (PR slices)

## PR-01 — Styling substrate + class contract

### Files
- **Create:** `src/components/testbed/conductor/styles/conductor-agent-chat.rvn.css`
- **Create:** `src/components/testbed/conductor/styles/conductor-agent-chat.thread.css`
- **Create:** `src/components/testbed/conductor/styles/conductor-agent-chat.composer.css`
- **Edit:** `src/components/testbed/conductor/ConductorAgentChat.tsx` (add class names + import css)

### Work
- Add `.rvn-chat*` class set from CSS contract doc.
- Move static visual styles from inline objects into CSS classes.
- Keep only dynamic geometry/state style in TSX where strictly needed.

### Acceptance
- Visual parity pass: header/rail/thread/composer silhouette matches reference.
- No injected `<style>` elements.
- Existing behavior tests still pass.

---

## PR-02 — RVN chat primitives (library extraction)

### Files
- **Create:** `src/lib/rvn/chat/RvnChatFrame.tsx`
- **Create:** `src/lib/rvn/chat/RvnStatusChip.tsx`
- **Create:** `src/lib/rvn/chat/RvnChatMessage.tsx`
- **Create:** `src/lib/rvn/chat/RvnChatArtifactCard.tsx`
- **Create:** `src/lib/rvn/chat/RvnComposerContentEditable.tsx`
- **Create:** `src/lib/rvn/chat/RvnChatEmptyState.tsx`
- **Create:** `src/lib/rvn/chat/index.ts`
- **Edit:** `src/lib/rvn/index.ts` (export chat components)

### Work
- Implement compound-component APIs with `data-slot` and a11y attributes.
- Keep components stateless where possible; pass runtime state from caller.
- Enforce tokenized styling (RVN/TMNL vars).

### Acceptance
- Type-safe exports available from `@/lib/rvn`.
- Components render in isolation without conductor runtime dependencies.

---

## PR-03 — ConductorAgentChat recompose with RVN chat primitives

### Files
- **Edit:** `src/components/testbed/conductor/ConductorAgentChat.tsx`
- **Optional edit:** `src/components/testbed/conductor/RvnConductorChat.tsx` (align/retire overlap)

### Work
- Recompose root/header/thread/composer using new RVN chat primitives.
- Preserve current behavioral contracts:
  - agent switching
  - slash/mention suggestion flow
  - voice state banner
  - reconnect/pause/send semantics
  - stream cursor rendering

### Acceptance
- No regression in stream handling or controls.
- Message role visuals map correctly (system/user/assistant).

---

## PR-04 — Artifact payload + interruption row parity

### Files
- **Edit:** `src/components/testbed/conductor/ConductorAgentChat.tsx`
- **Edit/Create:** chat artifact renderer near message body mapping

### Work
- Add assistant artifact card style parity (`AnalysisCard` analog).
- Add interruption banner style parity (`S2` warning row analog).
- Add empty-state row parity.

### Acceptance
- Rich assistant message payload appears as bordered tactical card.
- Interruption row style and tone match design basis.

---

## PR-05 — Font equivalence + tokenization hardening

### Files
- **Edit:** chat css files (class contract)
- **Optional edit:** conductor wrapper/provider boundary

### Work
- Apply local conductor chat font mapping:
  - `--rvn-font-sans: var(--font-heading)`
  - `--rvn-font-mono: var(--font-data)`
- Remove remaining hardcoded font-family literals in chat surface.

### Acceptance
- Final font look approximates Space Mono + JetBrains mono reference using TMNL-local fonts.
- 12px floor verified across chips/meta rows.

---

## PR-06 — Responsive MorphCard fit + overflow control

### Files
- **Edit:** `src/components/testbed/conductor/ConductorAgentChat.tsx`
- **Edit:** `src/components/testbed/ConductorTestbed.tsx` (chat morph sizing contract only)
- **Edit:** chat css files for layout minmax/clamp

### Work
- Ensure chat surface uses minmax/clamp layout rows.
- Remove brittle fixed-height assumptions in L3 panel internals.
- Keep MorphCard transitions stable (no jitter, no clipped composer/thread).

### Acceptance
- No clipping in L3 across common viewport sizes.
- Thread + composer scroll independently and predictably.

---

## Runtime boundaries to preserve

Do **not** refactor these during visual rebuild:
- `src/components/testbed/conductor/agent-chat-stx.ts`
- chat-v2 transport logic and reconnection flows
- node/session state ownership in `ConductorTestbed.tsx`

This lane is UI architecture + visual integration, not transport rewiring.

---

## Suggested API shape for new RVN chat primitives

- `RvnChatFrame.Root/Header/CommandRail/Thread/Composer/Corners`
- `RvnStatusChip` (`connecting|online|offline|reconnecting|resyncing`)
- `RvnChatMessage.System/User/Assistant`
- `RvnChatMessage.Meta`, `RvnChatMessage.Body`, `RvnChatMessage.Footer`
- `RvnComposerContentEditable`
- `RvnChatArtifactCard`
- `RvnChatEmptyState`

---

## Verification plan (lightweight, user-aligned)

Run only focused validation after each PR slice:

1. `bunx tsc --noEmit -p tsconfig.json`
2. `bunx vitest src/components/testbed/conductor/__tests__/ConductorAgentChat.regression.test.tsx`
3. `bunx vitest src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts`

No full-suite marathon for style-only deltas.

---

## Done criteria

1. Visual parity with `react-app.js` shell is obvious at first glance.
2. `ConductorAgentChat` no longer relies on dense inline style objects.
3. RVN chat primitives are reusable and exported.
4. Existing chat functionality and regression behavior remains intact.
5. L3 is responsive and unclipped under MorphCard constraints.