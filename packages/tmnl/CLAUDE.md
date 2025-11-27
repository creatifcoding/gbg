# Claude Development Notes - TMNL

## Overview

TMNL (Terminal & Multi-Modal Navigation Layer) is a modular development environment built with Nix flakes, providing specialized shells for different development contexts (Rust, Python, Embedded, UI, and Tauri).

## NX Project Configuration

When adding new scripts to `package.json`, always add corresponding nx executors to `project.json`:

```json
"script-name": {
  "executor": "nx:run-commands",
  "options": {
    "command": "bun run script-name",
    "cwd": "packages/tmnl"
  }
}
```

This ensures scripts can be run via both `bun run` and `nx run tmnl:script-name`.

### Current Tauri Targets

The following NX targets are configured for Tauri development:

- `nx run tmnl:tauri:dev` - Run Tauri app in development mode
- `nx run tmnl:tauri:dev:windows` - Run Tauri dev for Windows cross-compilation
- `nx run tmnl:tauri:dev:both` - Run Tauri dev for multiple platforms
- `nx run tmnl:tauri:build` - Build Tauri app for production

## Nix Module Structure

The project uses a modular Nix configuration located in `nix/modules/`:

### Module Files

- `core.nix` - Base development tools and utilities
- `rust.nix` - Rust toolchain and Cargo workspace tools
- `python.nix` - Python development environment
- `embedded.nix` - Embedded systems tools
- `ui.nix` - UI development (Node.js, pnpm)
- `tauri.nix` - Tauri development with GTK/WebKit dependencies
- `tests.nix` - Testing infrastructure
- `default.nix` - Unified shell combining all modules

### Tauri Module (`nix/modules/tauri.nix`)

The Tauri module provides:

**DevShell**: `tmnl-tauri`
- Layers over `tmnl-core` for base functionality
- Includes GTK3, WebKitGTK, and system dependencies (Linux)
- Configures environment variables for Tauri build:
  - `RUST_SRC_PATH`
  - `PKG_CONFIG_PATH` (with GTK/WebKit paths)
  - `LD_LIBRARY_PATH` (Linux only)
  - `LIBRARY_PATH` (Linux only)
  - `CARGO_TARGET_X86_64_PC_WINDOWS_GNU_RUSTFLAGS` (for cross-compilation)

**Mission Control Scripts**:
- `tauri-dev` - Development mode
- `tauri-dev-windows` - Windows cross-compilation dev
- `tauri-dev-both` - Multi-platform dev
- `tauri-build` - Production build

All scripts use `bun run` and execute from `$FLAKE_ROOT/packages/tmnl`.

### Adding New Modules

1. Create a new `.nix` file in `nix/modules/`
2. Follow the structure:
   ```nix
   { inputs, lib, ... }:
   {
     perSystem = { config, pkgs, system, lib, ... }: {
       devShells.tmnl-<name> = pkgs.mkShell {
         name = "tmnl-<name>";
         inputsFrom = [ config.devShells.tmnl-core ];
         nativeBuildInputs = [ /* packages */ ];
         shellHook = ''
           echo "[tmnl-<name>] Description"
         '';
       };
       mission-control.scripts = { /* scripts */ };
     };
   }
   ```
3. Import the module in `nix/default.nix`
4. Add to unified shell in `nix/modules/default.nix`

## Development Workflow

### Using Nix Shells

```bash
# Enter the unified development environment
nix develop

# Or use direnv for automatic shell activation
direnv allow

# Access specific shells
nix develop .#tmnl-tauri
nix develop .#tmnl-rust
nix develop .#tmnl-python
```

### Using Mission Control Scripts

Inside the nix shell, mission control scripts are available:

```bash
# Run Tauri in development mode
tauri-dev

# Build for production
tauri-build

# Cross-compile for Windows (Linux only)
tauri-dev-windows
```

### Using NX Commands

```bash
# Run via NX (from anywhere in the monorepo)
nx run tmnl:tauri:dev
nx run tmnl:tauri:build

# Or use bun directly
cd packages/tmnl
bun run tauri:dev
```

## Integration Points

The TMNL environment integrates three task execution systems:

1. **Bun Scripts** (`package.json`) - JavaScript/TypeScript task runner
2. **NX Executors** (`project.json`) - Monorepo orchestration
3. **Nix Mission Control** (`nix/modules/*.nix`) - Environment-aware development commands

When adding new tasks:
- Add script to `package.json`
- Add NX executor to `project.json`
- Add mission-control script to relevant `nix/modules/*.nix` if needed

## Tauri Window Configuration

### Transparent Frameless Window

TMNL uses a transparent, decoration-free window to display only the web app content:

**Configuration** (`src-tauri/tauri.conf.json`):
- `decorations: false` - Removes native window chrome
- `transparent: true` - Makes native window transparent
- `macOSPrivateApi: true` - Enables transparency on macOS (App Store incompatible)

**Permissions** (`src-tauri/capabilities/default.json`):
- `core:window:default` - Base window permissions
- `core:window:allow-start-dragging` - Enable custom drag regions
- `core:window:allow-minimize/maximize/close` - Window controls
- `core:window:allow-set-decorations` - Toggle decorations
- `core:window:allow-set-always-on-top` - Pin window

### Implementing Custom Window Controls

**Drag Region** (HTML):
```html
<div data-tauri-drag-region class="titlebar">
  <!-- Your custom titlebar content -->
</div>
```

**Window Controls** (TypeScript):
```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

const appWindow = getCurrentWindow();

// Window operations
await appWindow.minimize();
await appWindow.toggleMaximize();
await appWindow.close();
await appWindow.startDragging();
```

**CSS** - Position titlebar at top with proper styling for transparency.

### Platform Notes

- **Windows**: Transparency works out of the box
- **Linux**: Requires compositor (GNOME/KDE/Xfwm4) for transparency
- **macOS**: Private API required (not App Store compatible)
- **WSL/WSLg**: See WSLg-specific notes below

## WSLg Rendering Workarounds

### Issue
WSLg (Windows Subsystem for Linux GUI) can render Tauri app windows with extremely small, blank, or invisible HTML content due to WebKitGTK compositing bugs on the Weston compositor. Symptoms include:
- HTML loads but appears tiny or invisible
- Invalid viewport dimensions in dev tools
- CSS opacity or scaling failures

### Solution
TMNL automatically detects WSLg and applies the `WEBKIT_DISABLE_COMPOSITING_MODE=1` environment variable workaround.

**Detection Method**: Checks for `WSL_DISTRO_NAME` environment variable

**Applied in**:
- `scripts/dev.sh` - Vite dev server
- `scripts/tauri-dev.sh` - Tauri development mode
- `scripts/dev-both.sh` - Dual platform development (via tauri-dev.sh)
- Nix mission-control scripts: `tauri-dev`, `tauri-dev-both`

**Manual Override** (if needed):
```bash
export WEBKIT_DISABLE_COMPOSITING_MODE=1
bun run tauri:dev
```

### Cross-Platform Compatibility
The workaround only activates on WSLg, not regular Linux, ensuring:
- Native Linux: Full WebKitGTK compositing (better performance)
- WSLg: Compositing disabled (fixes rendering bugs)
- Windows/macOS: Unaffected (no environment variable set)

## Dependencies

### Tauri Dependencies

The Tauri module includes:

**Linux**:
- GTK3, WebKitGTK 4.1
- Cairo, Pango, HarfBuzz
- GLib, ATK, librsvg, libsoup3
- MinGW-w64 for Windows cross-compilation

**macOS**:
- iconv

**All Platforms**:
- Rust toolchain (via rustup)
- LLDB 18 for debugging
- pkg-config, OpenSSL
- Frida tools for instrumentation
