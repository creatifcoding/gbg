# GetByShell `tmnl-panel` Runtime Surface Debug

> Tasker: #F1347 / #4833
> Date: 2026-06-26
> Scope: non-live source/runtime validation plus prior approved SIGUSR1 observation.

## Result

Runtime trigger/show path is healthy. Runtime/UI close-state coupling is not.

## Verified Healthy Contracts

| Contract | Evidence | Status |
|---|---|---|
| Programmatic webview label safety | `src-panel-tauri/tauri.conf.json` has `app.windows = []`; Rust creates label `panel`. | OK |
| Layer-shell setup | `src-panel-tauri/src/lib.rs` creates GTK `ApplicationWindow`, transplants `default_vbox`, calls `init_layer_shell`, `Layer::Overlay`, namespace `tmnl-panel`, all four anchors, exclusive zone `-1`, keyboard `OnDemand`. | OK |
| Starts hidden | Rust setup does not call show; journal says starts hidden. | OK |
| SIGUSR1 trigger | Prior approved live test: exactly one `tmnl-panel`, `pkill -USR1 -f 'tmnl-panel$'`, journal logged hidden→visible and surface shown. | OK |
| Debounce | `LAST_TOGGLE_MS` ignores toggles within 250ms. | OK |
| Rust compile | `CARGO_TARGET_DIR=/tmp/tmnl-cutover-cargo-target cargo check -p tmnl-panel` passed in 2m04s after initial 120s timeout. | OK |
| Event capability | `src-panel-tauri/capabilities/default.json` grants `core:event:allow-emit` and `core:event:allow-listen` for `panel`. | OK |

## Runtime/UI Coupling Bugs

### R1 — Action-bar close only closes React overlay, not layer-shell surface

Evidence:

- `src/lib/floating/overlay/PanelWorkspace.tsx` `WorkspaceActionBar.handleClose` calls `closePanelOverlay()`.
- `closePanelOverlay()` only sets `panelOverlayOpenAtom = false` in `src/lib/floating/overlay/index.tsx`.
- It does **not** invoke Tauri `close_panel`.
- In standalone `tmnl-panel`, the GTK layer-shell surface can therefore remain visible while the React overlay is closed/invisible.

Likely symptoms:

- A fullscreen transparent layer-shell window remains alive after clicking the panel X.
- Pointer behavior may feel haunted because the root/webview is still present even if the child overlay has `pointer-events: none`.
- The Rust `PANEL_VISIBLE` flag remains true; the next SIGUSR1 toggles visible→hidden, which can look like “panel trigger did nothing” if the user expected it to show.

Remediation:

- In standalone context, close button must call Rust `close_panel` (or a close callback injected by host), not only close the overlay atom.
- Preserve in-app overlay behavior by making close behavior host-specific.

### R2 — Rust false event does not close React overlay atom

Evidence:

`src-panel/panel-entry.tsx` listener:

```ts
listen<boolean>('tmnl:panel-state', (ev) => {
  setVisible(ev.payload)
  if (ev.payload) {
    openPanelOverlay()
  }
})
```

When Rust emits `false`, React only updates local `visible`; it does not call `closePanelOverlay()`.

Likely symptoms:

- ESC hides the GTK surface, but the overlay atom can remain true.
- Next show reopens idempotently, so it may not break visibly, but state is incoherent.
- Dev `__PANEL_TEST__` snapshot may misreport state.

Remediation:

```ts
if (ev.payload) openPanelOverlay()
else closePanelOverlay()
```

Again, do this in a host-aware way if the overlay component is reused in-app.

### R3 — `__PANEL_TEST__.snapshot().overlayOpen` reports DOM presence, not open state

Evidence:

`src/lib/floating/overlay/index.tsx` snapshot currently returns:

```ts
overlayOpen: !!document.querySelector('[data-panel-workspace-overlay]')
```

Because the overlay is always mounted, this reports true whenever DOM exists, not when the overlay atom is open.

Remediation:

- Return `panelOverlayRegistry.get(panelOverlayOpenAtom)`.
- Optionally include both `overlayMounted` and `overlayOpen`.

## Runtime Debug Conclusion

The lower Rust layer is sound enough for the next remediation slice. The runtime parity failures are at the host boundary:

1. standalone close must hide the layer-shell surface,
2. Rust panel-state events must be mirrored both directions into the overlay atom,
3. dev/test snapshot must report real open state.

These fixes are small and should be paired with CSS boot remediation, because both explain “it triggers, but it doesn’t behave like real TMNL panels.”

## Commands Run

```bash
CARGO_TARGET_DIR=/tmp/tmnl-cutover-cargo-target cargo check -p tmnl-panel
```

Result: passed; warnings only in patched tao/wry dependencies.
