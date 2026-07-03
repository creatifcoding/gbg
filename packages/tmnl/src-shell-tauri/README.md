# TMNL Bar — Wayland Layer Shell Sidecar Panel

A true `wlr-layer-shell` vertical panel that runs alongside the main TMNL application as a separate Tauri binary.

## Architecture

```
packages/tmnl/
├── Cargo.toml              ← Workspace root
├── src-tauri/              ← Main TMNL app (existing)
├── src-shell-tauri/        ← GetByShell Tauri Rust backend (THIS)
├── src-shell/              ← GetByShell React frontend
├── src-shared/             ← Shared Rust lib (IPC types, niri client)
├── vite.config.bar.ts      ← Bar Vite config (:1421)
└── vite.config.ts          ← Main app Vite config (:1420)
```

## Key Technical Decisions

### Layer Shell Integration

The bar uses a patched `tauri-runtime-wry` GTK creation hook to configure the Tauri GTK toplevel as a Wayland layer-shell surface **before** Wry builds WebKitGTK into `default_vbox()`:

1. `WebviewWindowBuilder` creates the GTK/Tao window with `visible(false)`.
2. The runtime hook sees `TMNL_TAURI_LAYER_SHELL_LABELS=bar`.
3. `gtk_layer_shell::init_for_window()` runs before `WebViewBuilderExtUnix::build_gtk(default_vbox)`.
4. Anchoring, exclusive zone, Overlay layer, keyboard mode, and namespace `tmnl-shell` are configured.
5. Wry builds WebKitGTK directly inside that layer-shell toplevel.
6. The app shows the window — now it is a proper layer-shell surface with Tauri IPC intact.

Do **not** reparent an already-realized Tauri/WebKit `default_vbox` into a separate layer-shell window; under DriftWM that produced live DOM/IPC but black pixels.

### Niri Integration

- **niri-ipc** crate (pinned to `=25.11.0`) for typed niri compositor IPC
- `NiriClient` in `tmnl-shared` handles niri connection, queries, and EventStream
- DriftWM support is handled in `tmnl-shared::driftwm` plus `niri_bridge.rs` compositor selection/polling
- `niri_bridge.rs` runs in a background thread, forwarding compositor events to the React frontend via Tauri's event system

### State Sharing

- Unix domain socket at `$XDG_RUNTIME_DIR/tmnl-bar.sock`
- JSON lines protocol defined in `tmnl-shared::ipc`
- Bidirectional: bar queries main app state, main app pushes updates

## Development

```bash
# Start bar dev server (Vite :1421 + Tauri binary)
bun run bar:dev

# Start main app separately
bun run tauri:dev
```

## Prerequisites

- **gtk-layer-shell** system library (provided by Nix `tmnl-tauri` devShell)
- Wayland session (DriftWM or niri)
- DriftWM: live socket under `$XDG_RUNTIME_DIR/driftwm/ipc-*.sock` or explicit `DRIFTWM_SOCKET`
- niri: `$NIRI_SOCKET` set
- Optional compositor override for mixed/stale user-service environments: `TMNL_COMPOSITOR=driftwm` or `TMNL_COMPOSITOR=niri`

## Configuration

Default bar config (from `tmnl-shared::state::BarConfig`):

| Property | Default | Description |
|----------|---------|-------------|
| `edge` | `Left` | Screen edge to dock to |
| `size` | `48px` | Bar width |
| `layer` | `Overlay` | Layer shell layer — required for DriftWM fullscreen precedence |
| `exclusive` | `true` | Reserve exclusive zone |
| `keyboard` | `OnDemand` | Keyboard interactivity |
