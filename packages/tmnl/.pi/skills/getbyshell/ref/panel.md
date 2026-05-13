# Panel — Widget Reference

> up: ../SKILL.md
> prereqs: none
> update-strategy: re-derive from src-panel-tauri/
> update-trigger: panel Tauri config changes, lib.rs changes

## Overview

Persistent workspace overlay panel. Summonable at any time via Super+P (niri → SIGUSR1). Separate Tauri layer-shell surface on `Layer::Overlay` with `KeyboardMode::OnDemand`.

## Source Layout

| Location | Purpose |
|----------|---------|
| `src-panel-tauri/src/lib.rs` | Rust: layer-shell setup, SIGUSR1 handler, toggle, GTK transplant |
| `src-panel-tauri/tauri.conf.json` | Tauri config — **windows must be `[]`** (Rust creates them) |
| `src-panel-tauri/Cargo.toml` | Dependencies: tauri, gtk, gtk-layer-shell, libc, log |

## Architecture

The panel uses the **GTK transplant pattern**:
1. Tauri creates a webview window programmatically in the setup hook
2. The GTK vbox is extracted from the Tauri window
3. A new `gtk::ApplicationWindow` is created with layer-shell properties
4. The vbox is transplanted into the layer-shell window
5. The original Tauri window is hidden

**Critical:** `tauri.conf.json` must have `"windows": []` because Rust creates the window. If the config also declares a window with the same label, you get: `a webview with label 'panel' already exists`.

## Toggle Mechanism

```
niri keybind (Super+P)
  → pkill -USR1 tmnl-panel
  → SIGUSR1 handler sets atomic flag
  → Polling thread (100ms) detects flag
  → Calls toggle_panel() (250ms debounce)
  → Sends show/hide via mpsc channel
  → GTK idle handler shows/hides layer-shell surface
  → Emits tmnl:panel-state event to frontend
```

## Layer-Shell Properties

- **Layer:** Overlay (above everything)
- **Anchors:** All 4 edges (fullscreen surface, CSS positions content)
- **Keyboard:** OnDemand (grabs when focused, coexists with bar)
- **Exclusive zone:** -1 (no exclusive area)
- **Starts:** Hidden

## Systemd

- `tmnl-panel-vite.service` — Vite on :1422 (`vite.config.panel.ts`)
- `tmnl-panel.service` — Tauri binary, Layer::Overlay, `src-panel-tauri/`

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `PluginInitialization("log", ...)` | `plugins.log` in tauri.conf.json has a map | Set `"plugins": {}` |
| `webview with label 'panel' already exists` | Config declares window + Rust creates one | Set `"windows": []` |
| Panel doesn't appear on toggle | Service not running | `systemctl --user status tmnl-panel` |
| 255 restart counter | Crash loop from above issues | Fix config, then `systemctl --user reset-failed tmnl-panel` |
