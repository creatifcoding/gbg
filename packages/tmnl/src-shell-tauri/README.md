# TMNL Bar — Wayland Layer Shell Sidecar Panel

A true `wlr-layer-shell` vertical panel that runs alongside the main TMNL application as a separate Tauri binary.

## Architecture

```
packages/tmnl/
├── Cargo.toml              ← Workspace root
├── src-tauri/              ← Main TMNL app (existing)
├── src-bar-tauri/          ← Bar Tauri Rust backend (THIS)
├── src-bar/                ← Bar React frontend
├── src-shared/             ← Shared Rust lib (IPC types, niri client)
├── vite.config.bar.ts      ← Bar Vite config (:1421)
└── vite.config.ts          ← Main app Vite config (:1420)
```

## Key Technical Decisions

### Layer Shell Integration

The bar uses `gtk-layer-shell` via Tauri v2's `WebviewWindow::gtk_window()` to configure the window as a Wayland layer shell surface:

1. Window is created with `visible(false)` — exists but unrealized
2. `gtk_layer_shell::init_for_window()` is called on the GTK window
3. Anchoring, exclusive zone, layer, and namespace are configured
4. Window is shown — now it's a proper layer shell surface

### Niri Integration

- **niri-ipc** crate (pinned to `=25.11.0`) for typed compositor IPC
- `NiriClient` in `tmnl-shared` handles connection, queries, and EventStream
- `niri_bridge.rs` runs in a background thread, forwarding events to the React frontend via Tauri's event system

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
- **niri** compositor running with `$NIRI_SOCKET` set
- Wayland session (not X11)

## Configuration

Default bar config (from `tmnl-shared::state::BarConfig`):

| Property | Default | Description |
|----------|---------|-------------|
| `edge` | `Left` | Screen edge to dock to |
| `size` | `48px` | Bar width |
| `layer` | `Top` | Layer shell layer |
| `exclusive` | `true` | Reserve exclusive zone |
| `keyboard` | `OnDemand` | Keyboard interactivity |
