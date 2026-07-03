# GetByShell `tmnl-panel` MorphChat/harness behavior parity

Date: 2026-06-26
Task: #4838 Bring MorphChat/harness panel behavior to parity
Feature: #F1347 GetByShell panel parity recovery

## Files changed

- `src/lib/floating/visitors/morphchat-visitor.tsx`
- `src/lib/floating/layout/scroll-strip/hooks/useStripOverscan.ts`
- `src/lib/floating/layout/scroll-strip/hooks/__tests__/useStripOverscan.test.ts`

## Mechanisms observed

- `morphchat:harness` is registered with `stateTier: 'full'`, so virtualization should preserve mounted WebSocket/session state.
- `useStripOverscan()` was the mechanism that translated `stateTier: 'full'` into wide strip overscan.
- Before this task, `useStripOverscan()` only checked `getColumnPanelId(column)`, i.e. the first leaf in each strip column.
- If a full-tier panel was nested/split behind another panel in the same column, the full-tier visitor could be missed and default overscan (`400`) used instead of full preservation overscan (`99999`).

## Changes

1. Full-tier strip detection now scans every leaf panel in each strip column.

   `useStripOverscan.ts` now uses `getColumnPanelIds(column)` instead of `getColumnPanelId(column)` and exposes `stripHasFullTierPanels()` for focused regression coverage.

2. Added regression coverage for nested full-tier visitors.

   `useStripOverscan.test.ts` registers a stateless primary panel and a full-tier nested panel inside the same split column, then asserts full-tier detection returns true. This guards the MorphChat/harness case when it is split/tabbed behind another panel.

3. Kept the session drawer reachable when the harness is idle/erroring.

   `MorphChatHarnessPanelInner` now always shows the `SESSIONS` drawer button. The drawer itself has error/loading diagnostics and retry affordances; hiding it until `connected` removed the very diagnostic surface needed when the standalone harness route fails. `NEW` remains connected-only.

4. Broadened reconnect affordance.

   `RECONNECT` is now visible for any non-connecting state (`idle`, `error`, `connected`), allowing manual recovery from idle/error states without requiring a full panel reload.

## Validation performed

Focused regression:

```bash
bunx vitest run src/lib/floating/layout/scroll-strip/hooks/__tests__/useStripOverscan.test.ts
```

Result: 2/2 tests passed.

Browser transpile smoke:

```bash
bun build src/lib/floating/visitors/morphchat-visitor.tsx \
  src/lib/floating/layout/scroll-strip/hooks/useStripOverscan.ts \
  --target browser --outdir /tmp/tmnl-panel-check-harness \
  --external '@/*' --external '@effect-atom/*' --external effect \
  --external react --external react-dom --external motion/react --external lucide-react
```

Result: bundled successfully.

Typography/hygiene grep:

```bash
rg -n "fontSize:\\s*(?:'|\\\")?(?:[0-9](?:px)?|10(?:px)?|11(?:px)?)(?:'|\\\")?|text-\\[(?:[0-9]|10|11)px\\]|status === 'connected' && \\(\\s*<button[\\s\\S]*SESSIONS|spawnPanel\\('empty'" \
  src/lib/floating/visitors/morphchat-visitor.tsx \
  src/lib/floating/layout/scroll-strip/hooks/useStripOverscan.ts \
  src/lib/floating/overlay/PanelWorkspace.tsx -S || true
```

Result: no output.

## Not performed

- No live harness WebSocket smoke was run.
- No panel signal/restart/reload was performed.

Those remain gated by the user's no-live-restart/no-signal constraint.
