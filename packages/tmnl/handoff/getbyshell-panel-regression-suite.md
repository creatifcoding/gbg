# GetByShell `tmnl-panel` regression suite report

Date: 2026-06-26
Task: #4840 Run regression suite for panel parity
Feature: #F1347 GetByShell panel parity recovery

## Passing checks

### TypeScript static validation

```bash
bun run --silent tsc --noEmit --pretty false
```

Result: **passed** with no output/errors.

### Focused floating/STX Vitest regression set

```bash
bunx vitest run \
  src/lib/floating/layout/scroll-strip/hooks/__tests__/useStripOverscan.test.ts \
  src/lib/floating/layout/__tests__/split-tree.test.ts \
  src/lib/floating/dock/__tests__/layout.test.ts
```

Result: **passed**.

- 3 test files passed.
- 84 tests passed.
- Includes new regression coverage for nested full-tier strip preservation.

### Final changed-file browser transpile smoke

```bash
bun build \
  src-panel/panel-entry.tsx \
  src/lib/floating/overlay/index.tsx \
  src/lib/floating/overlay/PanelWorkspace.tsx \
  src/lib/floating/hooks/useKeyboardDispatch.ts \
  src/lib/floating/FloatingPanelProvider.tsx \
  src/lib/floating/visitors/morphchat-visitor.tsx \
  src/lib/floating/layout/scroll-strip/hooks/useStripOverscan.ts \
  --target browser --outdir /tmp/tmnl-panel-final-smoke \
  --external '@/*' --external '@tauri-apps/*' --external '@tanstack/react-hotkeys' \
  --external '@dnd-kit/*' --external '@effect-atom/*' --external '@legendapp/*' \
  --external effect --external react --external react-dom --external react-dom/client \
  --external framer-motion --external motion/react --external lucide-react
```

Result: **passed**; all edited TS/TSX entry points bundled successfully.

## Blocked / incomplete checks

### `bun run --silent build:panel`

Result: **not applicable**.

- `package.json` has no `build:panel` script.
- Existing panel-related scripts include `panel:dev`, `panel:regression`, `panel:smoke`, and `panel:fuzz`.

### Direct Vite panel production build

```bash
bunx vite build --config vite.config.panel.ts
```

Result: **timed out after 300s**.

Observed output:

- Vite started production build for the panel config.
- Transform phase emitted Tailwind ambiguous class warnings and unresolved runtime font asset warnings.
- No TypeScript or module resolution error was emitted before timeout.
- No `dist-panel` files were present after the timeout.

Mechanism is not proven. The likely investigation front is build-time transform/bundle scale or asset/font handling in the panel config, but this report does not claim that as root cause.

### `bun run panel:smoke`

```bash
bun run panel:smoke
```

Result: **blocked/failed precondition**.

Output:

```text
❌ Default browser session does not have the app mounted.
Open the app in agent-browser first: agent-browser open http://localhost:1420
```

Read-only port check:

```bash
(ss -ltnp 2>/dev/null || true) | rg ':1420|:1422|:8787' || true
```

Result: no app, panel, or harness ports were listening.

No dev server, harness server, standalone Tauri panel, signal, restart, compositor reload, relogin, or Nix switch was started because the current constraint requires explicit approval for live/runtime actions.

## Gates updated

Manually resolved #F1347 gates based on observed current-root commands:

- **Static validation passes** — passed via `bun run --silent tsc --noEmit --pretty false`.
- **Floating/STX tests pass** — passed via Vitest, not native Bun test. The stored gate command still says native `bun test`, but Vitest is the correct runner for these suites.

## Summary

The non-live validation envelope is green for TypeScript, focused floating/STX behavior, and changed-file browser transpilation. The standalone production Vite build and browser smoke remain unresolved/blocked and should be treated as validation gaps, not implementation passes.
