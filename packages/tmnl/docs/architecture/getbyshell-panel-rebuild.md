# GetByShell Panel Rebuild — First-Principles Architecture

**Status:** Draft / panel disabled  
**Owner:** VAL  
**Date:** 2026-06-27  
**Scope:** Replace the current fullscreen transparent `tmnl-panel` overlay with a bounded, visible, testable panel surface.

> Prime, the panel is not allowed to be a haunted pane of glass. If it captures input, it paints. If it does not paint, it does not capture input. That is the law.

---

## 1. Immediate decision

The current `tmnl-panel` surface is disabled pending redesign.

Disabled surfaces/config:

- Home Manager surface declaration: `gbg.getbyshell.surfaces.panel.enable = false`
- Mission-control surface declaration: `nix/lib/getbyshell/default.nix` panel `enable = false`
- DriftWM hotfix config: active `Mod+P` panel binding removed/commented
- Live user services stopped: `tmnl-panel.service`, `tmnl-panel-vite.service`

The bar / command palette path remains in scope and should continue to work.

---

## 2. Failure autopsy

Observed user symptom:

```text
Press Mod+P
  → no visible panel
  → clicks no longer pass through
  → surface is transparent and input-active
```

Proven journal chain:

```text
DriftWM keybind fires
  → spawns pkill -USR1 -f tmnl-panel$
  → tmnl-panel receives SIGUSR1
  → Rust toggle_panel() runs
  → GTK layer-shell surface shown/hidden
```

So the failure was not keybinding, signal delivery, or process targeting. The failure was the contract between native surface visibility and React paint.

Current design allowed this illegal state:

```text
native GTK layer-shell surface = visible + input-active
React overlay atom            = closed / opacity 0
Result                        = invisible fullscreen click shield
```

That state must be made unrepresentable.

---

## 3. New invariant

```text
PANEL_INPUT_ACTIVE ⇔ PANEL_VISIBLY_PAINTED
```

Expanded:

1. A panel surface that captures pointer/keyboard input must have visible chrome.
2. A transparent diagnostic surface must be input-pass-through or absent.
3. React may enrich content, but native geometry owns input bounds.
4. Native show/hide is authoritative for standalone shell surfaces.
5. React state may observe native visibility, but must not be the only thing that makes the panel paint.

---

## 4. Anti-goals

- No fullscreen transparent input surface as the default architecture.
- No event-mirror dependency where a missed Tauri event yields invisible input capture.
- No panel readiness claim based only on config text and `pgrep`.
- No panel rebuild that starts by reusing the full `PanelWorkspace` stack.
- No text below 12px. The typography floor survives the purge, yes, even here.

---

## 5. Target shape

Bounded drawer, not fullscreen veil.

```text
screen
┌────────────────────────────────────────────────────────────┐
│ desktop / current app                                      │
│                                                            │
│                                    ┌─────────────────────┐ │
│                                    │ TMNL PANEL          │ │
│                                    │ visible border      │ │
│                                    │ opaque body         │ │
│                                    │ first sentinel      │ │
│                                    │ then workspace      │ │
│                                    └─────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

Initial geometry recommendation:

```text
anchor: right + top + bottom
width:  min(960px, 42vw) or explicit native layer-shell margin math
height: full output height
layer:  overlay or top, decided by interaction requirements
input:  exactly panel rectangle, never full screen
```

If layer-shell cannot express width cleanly with right/top/bottom anchors, create a GTK window of explicit width and use layer-shell margins instead of all-edge fullscreen anchoring.

---

## 6. Component architecture

```text
┌──────────────────────────────────────────────────────────────┐
│ DriftWM                                                       │
│  keybind: Mod+P                                               │
│    → spawn pkill -USR1 -f tmnl-panel$                         │
└───────────────────────────────┬──────────────────────────────┘
                                │ SIGUSR1
                                ▼
┌──────────────────────────────────────────────────────────────┐
│ tmnl-panel native runtime                                     │
│                                                              │
│  PanelController                                              │
│    state: Hidden | Showing | Visible | Hiding                 │
│    owns: native GTK/window visibility                         │
│    owns: layer-shell geometry + input bounds                  │
│                                                              │
│  BoundedPanelSurface                                          │
│    right drawer geometry                                      │
│    opaque diagnostic background                               │
│    visible border                                             │
│                                                              │
│  WebViewHost                                                  │
│    always paints sentinel while surface is visible            │
│    mounts React after sentinel proves paint                   │
└───────────────────────────────┬──────────────────────────────┘
                                │ Tauri event / command bridge
                                ▼
┌──────────────────────────────────────────────────────────────┐
│ React panel app                                               │
│                                                              │
│  Stage 0: Sentinel                                           │
│    <div data-panel-sentinel>TMNL PANEL ONLINE</div>           │
│                                                              │
│  Stage 1: Panel chrome                                        │
│    titlebar, close affordance, visible border                 │
│                                                              │
│  Stage 2: Workspace shell                                     │
│    action bar + status bar                                    │
│                                                              │
│  Stage 3: STX PanelWorkspace                                  │
│    visitors, tiling, floating panels                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. State machine

```text
             SIGUSR1 / open request
      ┌─────────────────────────────────┐
      ▼                                 │
┌──────────┐      native show       ┌──────────┐
│ HIDDEN   │ ─────────────────────▶ │ SHOWING  │
│ no input │                        │ paint    │
│ no surf  │                        │ sentinel │
└──────────┘                        └────┬─────┘
      ▲                                  │ sentinel painted
      │                                  ▼
      │                            ┌──────────┐
      │                            │ VISIBLE  │
      │                            │ input    │
      │                            │ bounded  │
      │                            └────┬─────┘
      │                                  │ SIGUSR1 / close / Escape
      │                                  ▼
      │                            ┌──────────┐
      └─────────────────────────── │ HIDING   │
             native hide complete  │ no input │
                                   └──────────┘
```

Illegal states:

```text
VISIBLE + opacity:0                  forbidden
VISIBLE + transparent fullscreen     forbidden
HIDDEN + pointer-events:auto         forbidden
React closed + native input-active   forbidden
```

---

## 8. Render ladder

Rebuild in this exact order. No skipping. The ladder exists so failures localize.

### Stage A — native bounded opaque panel

Goal: see a rectangle before React complexity exists.

```tsx
<div
  data-panel-sentinel
  style={{
    height: '100%',
    minWidth: 360,
    background: '#050807',
    borderLeft: '2px solid #7ec8b0',
    color: '#7ec8b0',
    fontSize: 'var(--tmnl-text-sm, 14px)',
  }}
>
  TMNL PANEL ONLINE
</div>
```

Acceptance:

- Mod+P shows visible rectangle.
- Mod+P hides visible rectangle.
- Clicks outside rectangle pass through.
- Clicks inside rectangle do not pass through.
- Escape hides rectangle.

### Stage B — native ↔ React visibility contract

Goal: no missed-event split-brain.

Rules:

- Rust/native owns `Hidden | Visible`.
- React receives `panel:visible` as telemetry.
- React never makes the standalone panel transparent while native says visible.

### Stage C — panel chrome

Add:

- titlebar
- close button
- diagnostic status strip
- surface dimensions label
- active output label

Acceptance:

- chrome visible without STX/floating workspace mounted.
- close button invokes native hide.

### Stage D — workspace shell

Add action bar + empty state only.

Acceptance:

- empty state visible.
- launch cards visible.
- no floating/tiled visitor dependency required for basic paint.

### Stage E — STX PanelWorkspace

Only now reintroduce:

- `FloatingPanelProvider`
- `PanelWorkspace`
- visitor registry
- tiled/floating layouts

Acceptance:

- failed visitor cannot blank the shell.
- failed visitor shows error boundary inside panel body.

---

## 9. Validation ladder

```text
T0 static
  ├─ panel disabled? then no generated service and no Mod+P binding
  └─ panel enabled? then bounded native geometry contract exists

T1 passive live
  ├─ panel journal: controller initialized
  ├─ panel journal: sentinel mounted
  └─ driftwm journal: layer surface created/destroyed

T2 active HITL
  ├─ user presses Mod+P
  ├─ journal delta: DriftWM spawned pkill
  ├─ journal delta: panel entered Visible
  ├─ frontend log: PANEL_SENTINEL_PAINTED
  └─ visual: visible bounded rectangle, outside clicks pass through

T3 regression
  ├─ automated browser check against panel dev server
  ├─ native smoke for surface bounds if introspection available
  └─ screenshot only as supporting evidence, never sole proof
```

---

## 10. Future smoke requirements

A panel smoke must prove paint, not vibes.

Required markers:

```text
[panel-native] controller initialized
[panel-native] visible bounds x=... y=... w=... h=...
[panel-fe] PANEL_APP_MOUNTED
[panel-fe] PANEL_SENTINEL_PAINTED rect={...}
[panel-fe] PANEL_WORKSPACE_READY
```

Failure if:

```text
native visible && no PANEL_SENTINEL_PAINTED
native visible && bounds cover whole screen without explicit fullscreen mode
native visible && frontend overlay opacity == 0
native hidden && input active
```

---

## 11. Design decision record

Decision: **bounded native surface first**.

Rejected: fullscreen transparent surface with CSS-positioned content.

Why:

- fullscreen transparent surfaces fail dangerously;
- CSS/React failure should not alter compositor input behavior;
- layer-shell geometry must be observable and bounded;
- first paint must be independent of STX, visitors, and event mirrors.

Consequences:

- panel becomes less magical and more reliable;
- some old full-workspace overlay assumptions must be rewritten;
- input behavior becomes debuggable;
- the system can finally distinguish “panel hidden” from “panel invisible.”

---

## 12. Open questions

1. Right drawer vs centered modal vs bottom sheet?
2. `Layer::Overlay` or `Layer::Top`?
3. Exact width policy on dual-screen Zenbook layout?
4. Should the panel reserve exclusive zone or float above content?
5. Should `Mod+P` remain the final binding, or should it be renamed after the redesign?
6. Should the panel ship as a separate Tauri binary, or become a controlled webview surface from the shell process?

Answer these before Stage C, not before Stage A. First we prove visible bounded paint.
