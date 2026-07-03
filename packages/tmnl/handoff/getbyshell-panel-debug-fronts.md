# GetByShell Panel Parity — Debug Fronts

> Derived from `handoff/getbyshell-panel-parity-mismatch.md`
> Tasker: #F1347 / #4832
> Date: 2026-06-26

## Debug Ordering

### P0 — CSS / Design-System Boot

**Hypothesis:** The standalone `tmnl-panel` looks alien primarily because its Vite entry never imports the canonical TMNL CSS/Tailwind bundle.

Evidence:

- `src-panel/panel-entry.tsx` imports no CSS.
- `src-panel/panel.html` only defines inline reset/font CSS.
- `src/main.tsx` imports `./index.css` for the main TMNL app.
- MorphChat skin/components use Tailwind utilities and CSS variables (`h-full`, `flex`, `bg-black`, `text-neutral-*`, `var(--tmnl-text-xs)`).

Validation:

- Inspect panel DOM for loaded stylesheet / CSS variables.
- Add CSS boot path in a small branch and compare panel/MorphChat rendering.

Caution:

- `src/index.css` currently declares `--tmnl-text-xs: 10px`; GetByShell discipline requires 12px floor. Importing CSS unmodified may revive tiny text.

### P0 — Standalone Host Context

**Hypothesis:** `PanelWorkspaceOverlay` is being used outside its original AppShell grid context, leaking layout assumptions into the separate Tauri panel.

Evidence:

- Overlay docs/styles assume AppShell grid row/column and z-index relative to header/sidebar.
- `src-panel/panel-entry.tsx` mounts it inside a fullscreen fixed div without AppShell.

Validation:

- Add/inspect a `StandalonePanelHost` wrapper or variant.
- Confirm panel root dimensions, overlay dimensions, opacity, z-index, pointer events.

### P1 — First-Open Experience

**Hypothesis:** The panel is technically open but product-empty: sentinel-only STX state renders a generic empty state instead of a TMNL cockpit or MorphChat/harness panel.

Evidence:

- `useInitializeWorkspace()` sets only `panelTree = leaf(WORKSPACE_SENTINEL)`.
- Empty state says `No Panels Open`; click spawns `morphchat:harness` after animation.

Validation:

- Decide policy: auto-spawn harness, show visitor palette, or build canonical cockpit empty state.
- Implement through STX/spawn actions; do not add shared-state useState soup.

### P1 — Visitor Registry Parity

**Hypothesis:** Standalone panel lacks some canonical visitor registrations available in main app.

Evidence:

- Standalone `PanelWorkspace` calls `registerAllVisitors()` → MorphChat/GEOINT/Muse.
- Main `src/main.tsx` additionally imports side effects for egui and code-editor panels.

Validation:

- Compare `panelRegistry.list()` in main app vs standalone panel.
- Create a shared registration module for both contexts.

### P1 — MorphChat / Harness Runtime

**Hypothesis:** Once CSS boots, MorphChat may still need harness validation: WebSocket availability, session isolation, session drawer behavior, and state preservation.

Evidence:

- `morphchat:harness` uses `useHarnessAdapter({ instanceId: panelId, nodeId: conductor:${panelId}, stateTier: 'full' })`.
- Dev scripts start harness WS; standalone systemd panel path may not guarantee it.

Validation:

- Spawn `morphchat:harness` in standalone panel.
- Observe `status`, `sessionId`, drawer, new/resume/reconnect.
- No live restart without approval.

### P2 — Regression Harness Coverage

**Hypothesis:** Existing panel regression validates the in-app overlay more than the standalone Tauri panel.

Evidence:

- `scripts/panel-regression/runner.ts` uses default agent-browser session because named sessions cannot init full app.
- It expects `window.__PANEL_TEST__` from overlay module.
- `snapshot().overlayOpen` currently returns DOM presence, not actual open atom state.

Validation:

- Fix `snapshot().overlayOpen` to read `panelOverlayOpenAtom`.
- Add a standalone panel lane or document why equivalent coverage is sufficient.

### P2 — Cross-Process Bar State

**Hypothesis:** The bar PanelToggle indicator can lie even though signal delivery works.

Evidence:

- Panel emits `tmnl:panel-state` in `tmnl-panel` process.
- Bar listens in `tmnl-shell` process.

Validation:

- Build explicit bridge or local optimistic/reconciled state later.
- Not the first parity blocker unless user’s complaint includes bar glow.

## Recommended First Remediation Slice

1. Add canonical panel CSS boot path with 12px floor preserved.
2. Introduce standalone panel host semantics instead of AppShell-grid leakage.
3. Fix `__PANEL_TEST__.snapshot().overlayOpen` to actual atom state.
4. Validate with TypeScript + focused floating/STX tests.
5. Then decide first-open policy and MorphChat/harness default behavior.

## Non-Goals for First Slice

- Do not restart services automatically.
- Do not change DriftWM/niri keybinds.
- Do not replace STX with local React state.
- Do not broad-redesign MorphChat before the CSS/host baseline is correct.
