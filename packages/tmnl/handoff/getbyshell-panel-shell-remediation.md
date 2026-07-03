# GetByShell `tmnl-panel` shell remediation

Date: 2026-06-26
Task: #4836 Align standalone panel shell with canonical TMNL panel presentation
Feature: #F1347 GetByShell panel parity recovery

## Files changed

- `src-panel/panel-entry.tsx`
- `src/lib/floating/overlay/index.tsx`
- `src/lib/floating/overlay/PanelWorkspace.tsx`
- `vite.config.panel.ts`

## Changes

1. `src-panel/panel-entry.tsx`
   - Imports canonical `@/index.css` so standalone `tmnl-panel` receives TMNL base CSS, fonts, variables, resets, and token definitions.
   - Restores standalone panel readability by overriding typography tokens on the panel root:
     - `--tmnl-text-xs: 12px`
     - `--tmnl-text-sm: 14px`
     - `--tmnl-text-base: 16px`
   - Adds `requestClose()` bridge that closes the React overlay atom and invokes Tauri `close_panel`.
   - Syncs `tmnl:panel-state=false` to `closePanelOverlay()` so Rust/runtime visibility and React overlay visibility cannot silently diverge.
   - Mounts `<PanelWorkspaceOverlay host="standalone">` and passes `onRequestClose` into `<PanelWorkspace />`.

2. `src/lib/floating/overlay/index.tsx`
   - Adds `host?: 'app-shell' | 'standalone'` to `PanelWorkspaceOverlayProps`.
   - Preserves AppShell grid placement by default.
   - In standalone host mode, removes AppShell-specific `gridRow` / `gridColumn` assumptions.
   - Fixes `window.__PANEL_TEST__.snapshot().overlayOpen` to read `panelOverlayRegistry.get(panelOverlayOpenAtom)` instead of checking always-mounted DOM presence.

3. `src/lib/floating/overlay/PanelWorkspace.tsx`
   - Adds `PanelWorkspaceProps.onRequestClose`.
   - Routes the action-bar close button through `onRequestClose`, defaulting to `closePanelOverlay()` for main app parity.
   - Fixes the separator typography from hard-coded `10` to `var(--tmnl-text-xs, 12px)`.

4. `vite.config.panel.ts`
   - Adds standalone panel dev proxy:

   ```ts
   proxy: {
     '/api/harness': {
       target: 'http://localhost:8787',
       changeOrigin: true,
       ws: true,
     },
   }
   ```

   This mirrors the main app’s harness route and fixes same-origin `morphchat:harness` failures on panel Vite port `1422`.

## Validation performed

Passed:

```bash
bun build src-panel/panel-entry.tsx src/lib/floating/overlay/index.tsx src/lib/floating/overlay/PanelWorkspace.tsx \
  --target browser --outdir /tmp/tmnl-panel-check-browser \
  --external '@/*' --external '@tauri-apps/*' --external '@effect-atom/*' \
  --external '@legendapp/*' --external '@dnd-kit/*' --external effect \
  --external react --external react-dom --external react-dom/client
```

Passed:

```bash
bun build vite.config.panel.ts --target bun --outdir /tmp/tmnl-panel-check-config \
  --external vite --external '@vitejs/*' --external path
```

Passed:

```bash
bunx vitest run \
  src/lib/floating/layout/__tests__/split-tree.test.ts \
  src/lib/floating/dock/__tests__/layout.test.ts \
  --reporter=default
```

Result: 2 files passed, 82 tests passed.

Inconclusive due timeout/no diagnostics:

```bash
bun run --silent tsc --noEmit --pretty false
bunx vite build --config vite.config.panel.ts
```

Both timed out after long dependency-graph/bundle work without emitting diagnostics. They were not retried blindly.

## Remaining caveats

- This does not seed first-open content; it fixes shell parity, CSS, close/runtime sync, snapshot truth, and harness dev proxy.
- This does not implement full persistence reconstruction for panel tree/strip/content.
- This does not add a standalone live smoke, because live service orchestration is outside the approved no-restart/no-signal scope.
