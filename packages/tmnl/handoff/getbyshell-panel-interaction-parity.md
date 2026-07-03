# GetByShell `tmnl-panel` interaction parity remediation

Date: 2026-06-26
Task: #4839 Restore panel interaction parity
Feature: #F1347 GetByShell panel parity recovery

## Files changed

- `src/lib/floating/hooks/useKeyboardDispatch.ts`
- `src/lib/floating/FloatingPanelProvider.tsx`
- `src/lib/floating/overlay/PanelWorkspace.tsx`

## Mechanism observed

The standalone panel already had an injected `onRequestClose` path for the action-bar close button, which calls the Tauri `close_panel` command from `src-panel/panel-entry.tsx` and then closes the overlay atom.

However, keyboard dispatch remained host-agnostic:

- `useKeyboardDispatch()` handled `Alt+P` by calling `togglePanelOverlay()` directly.
- In the main app, that is correct: Alt+P toggles the persistent React overlay.
- In standalone `tmnl-panel`, that is incomplete: closing only the React overlay can leave the GTK/layer-shell panel surface visible but blank/non-interactive, reintroducing runtime/UI close-state divergence.

## Changes

1. Added a host-specific keyboard overlay request hook.

   `UseKeyboardDispatchOptions` now accepts:

   ```ts
   onRequestOverlayToggle?: () => void | Promise<void>
   ```

2. `Alt+P` now routes through the host callback when provided.

   - Main app: no callback supplied → existing `togglePanelOverlay()` behavior preserved.
   - Standalone panel: callback supplied from `PanelWorkspace.onRequestClose` → Alt+P uses the same runtime-aware close path as the action bar.

3. Threaded the callback through `FloatingPanelProvider`.

   `FloatingPanelProvider` accepts `onRequestOverlayToggle` and passes it into `useKeyboardDispatch()`.

4. Passed `PanelWorkspace.onRequestClose` into `FloatingPanelProvider`.

   This keeps STX/layout state authority unchanged while making the keyboard close affordance host-aware.

## Validation performed

Browser transpile smoke:

```bash
bun build src/lib/floating/hooks/useKeyboardDispatch.ts \
  src/lib/floating/FloatingPanelProvider.tsx \
  src/lib/floating/overlay/PanelWorkspace.tsx \
  --target browser --outdir /tmp/tmnl-panel-check-interactions \
  --external '@/*' --external '@tanstack/react-hotkeys' --external '@dnd-kit/*' \
  --external '@effect-atom/*' --external '@legendapp/*' --external effect \
  --external react --external react-dom --external react-dom/client \
  --external framer-motion --external motion/react --external lucide-react
```

Result: bundled successfully.

Focused floating/STX regression set:

```bash
bunx vitest run \
  src/lib/floating/layout/scroll-strip/hooks/__tests__/useStripOverscan.test.ts \
  src/lib/floating/layout/__tests__/split-tree.test.ts \
  src/lib/floating/dock/__tests__/layout.test.ts
```

Result: 84/84 tests passed across 3 files.

## Not performed

- No live Alt+P test inside the standalone Tauri panel was performed.
- No SIGUSR1, process signal, service restart, compositor reload, relogin, or Nix switch was performed.

Live interaction validation remains gated by explicit user approval.
