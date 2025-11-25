# tmnl Nix + mission-control interface

This document summarizes how to use the tmnl Nix module system and mission-control integration.

## Overview

The `gbg` repo exposes a tmnl “platform” via Nix and flake-parts:

- Location: `packages/tmnl/nix`
- Modules:
  - `core.nix`      → `tmnl-core` devshell + mission-control base
  - `rust.nix`      → `tmnl-rust` devshell + Rust scripts
  - `python.nix`    → `tmnl-python` devshell + Python scripts
  - `embedded.nix`  → `tmnl-embedded` devshell + embedded scripts
  - `ui.nix`        → `tmnl-ui` devshell + UI scripts

All non-core modules inherit from `tmnl-core` and share a common `tmnl` mission-control wrapper.

## Prerequisites

- Nix with flakes enabled.
- Optional but recommended: `direnv` + `nix-direnv`.

## Available devshells

All shells are exposed via the top-level flake:

```sh
# Base environment
nix develop .#tmnl-core

# Rust systems
nix develop .#tmnl-rust

# Python analytics / EE / ML
nix develop .#tmnl-python

# Embedded / firmware (placeholders for now)
nix develop .#tmnl-embedded

# UI / Tauri / FE
nix develop .#tmnl-ui
```

If you use `direnv` with `use flake` at repo root, you can still explicitly select shells via `nix develop .#…` when needed.

## Mission-control wrapper: `tmnl`

Inside any tmnl shell, the `tmnl` wrapper is available via mission-control.

### List all commands

```sh
tmnl
```

Mission-control will print all available `tmnl` subcommands, grouped by category.

### Core command

```sh
tmnl info
```

Prints:

- active system
- `$FLAKE_ROOT`
- indicates you’re in a tmnl-enabled environment.

## Rust module

Shell:

```sh
nix develop .#tmnl-rust
```

Capabilities:

- Inherits `tmnl-core` tools and `tmnl` wrapper.
- Provides Rust tooling:
  - `rustup`, `lldb_18`, `natscli`, `nats-top`, `nats-server`, `pkg-config`, `openssl`
  - `RUST_SRC_PATH` and `PKG_CONFIG_PATH` set appropriately.

Mission-control commands:

```sh
tmnl rust-build   # cargo build --workspace (from $FLAKE_ROOT)
tmnl rust-test    # cargo test --workspace  (from $FLAKE_ROOT)
```

Use when building or testing Rust-based tmnl components.

## Python module

Shell:

```sh
nix develop .#tmnl-python
```

Capabilities:

- Inherits `tmnl-core`.
- Provides Python tooling:
  - `uv`, `ruff`, `mypy`, `jupyter`
  - `LD_LIBRARY_PATH` set to the toolchain’s lib dir.

Mission-control commands:

```sh
tmnl py-lint       # ruff check .
tmnl py-typecheck  # mypy .
tmnl py-notebook   # jupyter lab
```

Use for RF/EE/ML analysis, linting, type-checking, and exploratory notebooks.

## Embedded module

Shell:

```sh
nix develop .#tmnl-embedded
```

Capabilities:

- Inherits `tmnl-core`.
- Placeholder for cross-compilers, probe-rs, qemu, Renode, etc. (to be pinned).

Mission-control commands (currently stubs):

```sh
tmnl fw-build   # TODO: implement firmware build pipeline
tmnl fw-flash   # TODO: implement flashing via probe-rs/openocd
tmnl sim-run    # TODO: hook Renode or other simulator
```

Use this shell for embedded / firmware work once the toolchain is defined.

## UI module

Shell:

```sh
nix develop .#tmnl-ui
```

Capabilities:

- Inherits `tmnl-core`.
- Provides UI/tooling:
  - `nodejs_22`, `pnpm`
  - (future) `tauri-cli`, `rustc`, `cargo`.

Mission-control commands (paths are placeholders until bound to a concrete UI project):

```sh
tmnl ui-dev    # pnpm dev   (adjust to actual UI path)
tmnl ui-build  # pnpm build (adjust to actual UI path)
```

Use for building and running tmnl’s UI layer.

## Extension points

To extend the system:

1. Add or modify a tmnl module:

   - File location: `packages/tmnl/nix/modules/<module>.nix`
   - Add new devShells under `perSystem.devshells`.
   - Add new mission-control scripts under `perSystem.mission-control.scripts`.

2. Rebuild / re-enter the shell:

   ```sh
   nix develop .#tmnl-core   # or another tmnl-* shell
   tmnl                      # verify new commands are visible
   ```

All changes are flake-based and reproducible; CI can rely on invoking the same `tmnl-*` shells and `tmnl` commands for deterministic builds and checks.
