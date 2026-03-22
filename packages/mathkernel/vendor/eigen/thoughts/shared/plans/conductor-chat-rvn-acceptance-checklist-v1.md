# ConductorAgentChat RVN Acceptance Checklist v1

Date: 2026-02-11  
Owner: Val

Use this checklist during implementation and review.

## A. Visual parity checkpoints (against `integrate/react-app.js`)

- [ ] Header silhouette matches (title block + status chips + control rail).
- [ ] Command rail chips visually match density and hierarchy.
- [ ] Thread rows preserve role asymmetry (system/user/assistant).
- [ ] Assistant artifact card resembles reference card block treatment.
- [ ] Interruption warning row reads as a distinct band.
- [ ] Composer has tall authoring surface + segmented toolbar.
- [ ] Corner/ornament treatment present but subtle.

## B. RVN system compliance

- [ ] Uses RVN/TMNL CSS variables; no ad-hoc hardcoded palette blobs.
- [ ] No border-radius on chat surface controls/cards.
- [ ] 12px floor respected (`var(--tmnl-text-xs, 12px)` minimum).
- [ ] Chat classes follow `.rvn-chat*` contract.
- [ ] No style-tag injection.

## C. Functional continuity

- [ ] Send, pause, reconnect, reset still work.
- [ ] Streaming message render/cursor unchanged in behavior.
- [ ] Slash suggestions + mention suggestions keyboard behavior preserved.
- [ ] Agent selector behavior preserved.
- [ ] Node-scoped session continuity preserved.

## D. Accessibility continuity

- [ ] composer keeps `role="textbox"` and multiline semantics.
- [ ] suggestion list keeps listbox/option semantics.
- [ ] status/error rows keep proper live region semantics.
- [ ] focus return behavior remains stable for insert actions.

## E. MorphCard responsiveness

- [ ] L3 chat content is not clipped at common viewport heights.
- [ ] Thread + composer scroll behavior is stable and separate.
- [ ] No fixed-height regressions reintroduced in chat internals.

## F. Focused verification commands

- [ ] `bunx tsc --noEmit -p tsconfig.json`
- [ ] `bunx vitest src/components/testbed/conductor/__tests__/ConductorAgentChat.regression.test.tsx`
- [ ] `bunx vitest src/components/testbed/conductor/__tests__/chat-v2-hardcut.test.ts`

## G. Release-readiness criteria

- [ ] `ConductorAgentChat` visual architecture no longer depends on inline style sprawl.
- [ ] RVN chat primitives are exported from `@/lib/rvn`.
- [ ] Visual parity review signed off.
- [ ] No runtime transport regressions introduced.
