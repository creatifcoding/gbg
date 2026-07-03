# GetByShell panel parity recovery recap

Date: 2026-06-26
Feature: #F1347 GetByShell panel parity recovery

## Completed child tasks

- #4831 Inventory canonical panel sources and current standalone `tmnl-panel`.
- #4832 Classify mismatch fronts.
- #4833 Debug standalone runtime surface contract.
- #4834 Debug STX workspace initialization and persistence.
- #4835 Debug MorphChat/harness visitor path inside `tmnl-panel`.
- #4836 Align standalone panel shell with canonical TMNL panel presentation.
- #4837 Fix first-run/default panel experience.
- #4838 Bring MorphChat/harness panel behavior to parity.
- #4839 Restore panel interaction parity.
- #4840 Run regression suite for panel parity.
- #4841 Update GetByShell skill/docs with learned panel mechanisms.
- #4842 Author grounded panel parity recovery goal.

Child features #F1348–#F1351 are closed. Root #F1347 remains open because standalone live/runtime and production-build validation are intentionally not laundered.

## Implemented remediation

- `src-panel/panel-entry.tsx`
  - Imports canonical `@/index.css`.
  - Enforces standalone typography token floor (`12/14/16px`).
  - Bridges standalone close through Tauri `close_panel`.
  - Closes overlay atom on `tmnl:panel-state=false`.

- `src/lib/floating/overlay/index.tsx`
  - Adds `host="standalone"` overlay mode.
  - Fixes dev snapshot `overlayOpen` to read the overlay atom.

- `src/lib/floating/overlay/PanelWorkspace.tsx`
  - Adds host close prop usage.
  - Replaces bare empty state with canonical launch palette:
    - Live Conductor → `morphchat:harness`
    - Demo Conductor → `morphchat`
    - Muse Log → `muse:log`
  - Removes broken `spawnPanel('empty')` affordance.
  - Tokenizes sub-12px separator.
  - Passes standalone close bridge into keyboard dispatch through `FloatingPanelProvider`.

- `vite.config.panel.ts`
  - Adds `/api/harness` dev proxy with `ws: true` to route standalone same-origin harness WS to port `8787`.

- `src/lib/floating/visitors/morphchat-visitor.tsx`
  - Keeps session drawer reachable in idle/error states.
  - Keeps `NEW` connected-only.
  - Exposes `RECONNECT` in all non-connecting states.

- `src/lib/floating/layout/scroll-strip/hooks/useStripOverscan.ts`
  - Scans all panel IDs in a split column for `stateTier: 'full'` instead of only the primary leaf.

- `src/lib/floating/layout/scroll-strip/hooks/__tests__/useStripOverscan.test.ts`
  - Adds regression for nested full-tier visitor preservation.

- `src/lib/floating/hooks/useKeyboardDispatch.ts`
  - Adds host-specific `onRequestOverlayToggle` callback.
  - `Alt+P` uses standalone runtime-aware close path when provided; main app fallback remains `togglePanelOverlay()`.

- `src/lib/floating/FloatingPanelProvider.tsx`
  - Threads host overlay toggle callback into keyboard dispatch.

- GetByShell skill docs
  - Updated panel/state/runtime references and changelog with observed mechanisms and caveats.

## Validation passed

- TypeScript:

  ```bash
  bun run --silent tsc --noEmit --pretty false
  ```

- Focused Vitest regression set:

  ```bash
  bunx vitest run \
    src/lib/floating/layout/scroll-strip/hooks/__tests__/useStripOverscan.test.ts \
    src/lib/floating/layout/__tests__/split-tree.test.ts \
    src/lib/floating/dock/__tests__/layout.test.ts
  ```

  Result: 84/84 tests passed.

- Changed-file browser transpile smoke:

  Edited panel/floating/MorphChat entry points bundled successfully with `bun build --target browser` and externalized framework deps.

- Rust static validation performed earlier:

  ```bash
  CARGO_TARGET_DIR=/tmp/tmnl-cutover-cargo-target cargo check -p tmnl-panel
  ```

  Result: passed on second 300s run with dependency warnings.

## Validation gaps / open root acceptance

Root #F1347 remains open because these are not fully proven:

1. Direct standalone production panel build:

   ```bash
   bunx vite build --config vite.config.panel.ts
   ```

   Timed out after 300s during/after transform/font warnings, without TypeScript/module diagnostics and without `dist-panel` files.

2. Browser smoke:

   ```bash
   bun run panel:smoke
   ```

   Failed precondition: default `agent-browser` session did not have the app mounted. Ports `1420`, `1422`, and `8787` were not listening.

3. Live standalone runtime validation:

   No new SIGUSR1, service restart, compositor reload, relogin, Nix switch, or live Alt+P/close smoke was performed under the current no-live-action constraint.

## Recommended next approval-gated validation

Ask explicitly before doing any of these:

1. Start or attach app/panel dev servers and run `panel:smoke`.
2. Start/confirm harness server on `8787` and live-test `morphchat:harness` from standalone panel.
3. Send approved `pkill -USR1 -f 'tmnl-panel$'` and capture `__PANEL_TEST__.snapshot()` plus screenshot.
4. Test standalone Alt+P/action-bar close against the actual layer-shell surface.
5. Investigate the 300s Vite panel production build timeout with build debug instrumentation.
