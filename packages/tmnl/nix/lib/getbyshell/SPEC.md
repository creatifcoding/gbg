# GetByShell Nix Library — Implementation Specification

> **Status**: Approved (Design Deck selections: A/A/A)
> **Author**: Val (architecture) · Prime (vision)

---

## 1. Overview

A structured, composable Nix library for declaring, managing, and deploying GetByShell Wayland layer-shell surfaces as systemd user services. Replaces the current ad-hoc, copy-paste approach with typed declarations that generate everything: systemd services, health checks, targets, and mission-control scripts.

### Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Location** | Monorepo module (flake-parts) | Single source of truth, exports HM module |
| **Abstraction** | Typed submodule (NixOS-style) | Max validation, auto-docs, IDE support |
| **Scripts** | Auto-generated from surfaces | Add surface → get scripts for free |

---

## 2. File Structure

```
packages/tmnl/nix/lib/getbyshell/
├── SPEC.md                    # This document
├── default.nix                # Flake-parts module (mission-control + exports)
├── hm-module.nix              # Home-manager module (systemd services)
├── types.nix                  # Surface submodule type definition
├── surface.nix                # mkSurface: generates service pair from config
├── shared-env.nix             # mkSharedEnv: computes runtime PATH/PKG_CONFIG/LD_LIBRARY
├── health-check.nix           # mkHealthCheck: generates health check scripts
├── mission-control.nix        # mkSurfaceScripts + mkGlobalScripts
└── target.nix                 # mkTarget: generates systemd target + legacy aliases
```

---

## 3. Consumer API

### 3.1 Home-Manager (systemd services)

In `~/.config/nix/modules/home/getbyshell.nix`:

```nix
{ config, pkgs, lib, inputs, ... }:
{
  imports = [ inputs.gbg.homeManagerModules.getbyshell ];

  gbg.getbyshell = {
    enable = true;
    projectDir = "/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl";

    surfaces = {
      bar = {
        port = 1421;
        layer = "overlay";
        viteConfig = "vite.config.shell.ts";
        tauriDir = "src-shell-tauri";
        rustLog = "tmnl_shell=debug,tmnl_shared=debug";
        description = "Bar — left-anchored panel";
      };

      panel = {
        port = 1422;
        layer = "overlay";
        viteConfig = "vite.config.panel.ts";
        tauriDir = "src-panel-tauri";
        rustLog = "tmnl_panel=debug,tmnl_shared=debug";
        description = "Panel — persistent workspace overlay";
      };

      # Future surfaces — just add an attrset:
      # palette = {
      #   port = 1423;
      #   layer = "overlay";
      #   viteConfig = "vite.config.palette.ts";
      #   tauriDir = "src-palette-tauri";
      # };
    };
  };
}
```

### 3.2 Monorepo (mission-control scripts)

In `packages/tmnl/nix/modules/getbyshell/default.nix`:

```nix
{ inputs, lib, ... }:
{
  imports = [ ../../lib/getbyshell ];
  # The flake-parts module auto-generates mission-control scripts
  # from the same surface definitions used by home-manager.
}
```

### 3.3 Flake Exports

In `flake.nix` outputs:

```nix
flake.homeManagerModules.getbyshell =
  import ./packages/tmnl/nix/lib/getbyshell/hm-module.nix;
```

---

## 4. Type Definitions

### 4.1 Surface Submodule (`types.nix`)

```nix
{ lib }:
let
  inherit (lib) mkOption mkEnableOption types;
in
{
  surfaceModule = { name, config, ... }: {
    options = {
      enable = mkEnableOption "surface ${name}" // { default = true; };

      port = mkOption {
        type = types.port;
        description = "Vite dev server port.";
        example = 1421;
      };

      layer = mkOption {
        type = types.enum [ "background" "bottom" "top" "overlay" ];
        default = "top";
        description = "Wayland layer-shell layer.";
      };

      viteConfig = mkOption {
        type = types.str;
        description = "Vite config filename (relative to projectDir).";
        example = "vite.config.shell.ts";
      };

      tauriDir = mkOption {
        type = types.str;
        description = "Tauri project directory (relative to projectDir).";
        example = "src-shell-tauri";
      };

      rustLog = mkOption {
        type = types.str;
        default = "tmnl_${name}=debug,tmnl_shared=debug";
        description = "RUST_LOG filter for the Tauri binary.";
      };

      memoryMax = mkOption {
        type = types.str;
        default = "4G";
        description = "systemd MemoryMax for the Tauri service.";
      };

      healthCheckTimeout = mkOption {
        type = types.int;
        default = 30;
        description = "Seconds to wait for Vite health check.";
      };

      restartSec = mkOption {
        type = types.int;
        default = 5;
        description = "RestartSec for the Tauri service.";
      };

      viteRestartSec = mkOption {
        type = types.int;
        default = 3;
        description = "RestartSec for the Vite service.";
      };

      extraEnv = mkOption {
        type = types.listOf types.str;
        default = [];
        description = "Extra environment variables for both services.";
        example = [ "DEBUG=true" ];
      };

      description = mkOption {
        type = types.str;
        default = "GetByShell · ${name}";
        description = "Human-readable surface description.";
      };
    };
  };
}
```

### 4.2 Top-Level Options

```nix
options.gbg.getbyshell = {
  enable = mkEnableOption "GetByShell — Wayland layer-shell surface ecosystem";

  projectDir = mkOption {
    type = types.str;
    description = "Absolute path to the tmnl package root.";
  };

  surfaces = mkOption {
    type = types.attrsOf (types.submodule surfaceModule);
    default = {};
    description = "Layer-shell surface declarations.";
  };

  # Shared environment overrides
  extraRuntimePkgs = mkOption {
    type = types.listOf types.package;
    default = [];
    description = "Extra packages added to all surfaces' PATH.";
  };

  extraPkgConfigPaths = mkOption {
    type = types.listOf types.str;
    default = [];
    description = "Extra pkg-config paths for all surfaces.";
  };

  legacyAliases = mkOption {
    type = types.bool;
    default = true;
    description = "Generate tmnl-shell/tmnl-shell-vite legacy aliases.";
  };
};
```

---

## 5. Generators

### 5.1 mkSharedEnv (`shared-env.nix`)

Computes runtime environment once, shared by all surfaces:

- `PATH` — all runtime packages + ~/.bun/bin + ~/.cargo/bin
- `PKG_CONFIG_PATH` — GTK/WebKit/layer-shell dev packages
- `LD_LIBRARY_PATH` — runtime .so paths
- `LIBRARY_PATH` — link-time .so paths
- `RUST_SRC_PATH` — for rust-analyzer
- `GDK_BACKEND=wayland`

### 5.2 mkHealthCheck (`health-check.nix`)

Generates a `writeShellScript` per surface:

```bash
# tmnl-${name}-vite-health
for _i in $(seq 1 ${toString (timeout * 2)}); do
  curl -s http://localhost:${toString port} > /dev/null 2>&1 && exit 0
  sleep 0.5
done
echo "Vite did not start on :${toString port} within ${toString timeout}s" >&2
exit 1
```

### 5.3 mkSurface (`surface.nix`)

For each surface `name`, generates two systemd user services:

**`tmnl-${name}-vite`** (Vite dev server):
- Type = simple
- WorkingDirectory = projectDir
- ExecStart = `bunx vite --config ${viteConfig}`
- Environment = sharedEnv ++ extraEnv
- Restart = on-failure, RestartSec = viteRestartSec
- SyslogIdentifier = `tmnl-${name}-vite`

**`tmnl-${name}`** (Tauri binary):
- Type = simple
- WorkingDirectory = `${projectDir}/${tauriDir}`
- Requires/After = `tmnl-${name}-vite.service`, `graphical-session.target`
- ConditionEnvironment = `WAYLAND_DISPLAY`
- ExecStartPre = health check script
- ExecStart = `cargo-tauri dev --config tauri.conf.json`
- Environment = sharedEnv ++ extraEnv ++ [`RUST_LOG=${rustLog}`]
- Restart = on-failure, RestartSec = restartSec
- MemoryMax = memoryMax
- SyslogIdentifier = `tmnl-${name}`

### 5.4 mkTarget (`target.nix`)

Generates `getbyshell.target`:
- Requires/After = all `tmnl-${name}.service` entries
- WantedBy = `graphical-session.target`

If `legacyAliases = true`, also generates `tmnl-shell` and `tmnl-shell-vite` aliases.

### 5.5 mkSurfaceScripts + mkGlobalScripts (`mission-control.nix`)

**Per surface** (5 scripts each):
- `getbyshell-${name}-start` — starts vite, health checks, starts tauri
- `getbyshell-${name}-stop` — stops both
- `getbyshell-${name}-restart` — stop + start
- `getbyshell-${name}-logs` — `journalctl --user -u tmnl-${name} -u tmnl-${name}-vite -f`
- `getbyshell-${name}-status` — status of both services

**Global** (6 scripts):
- `getbyshell-start` — `systemctl --user start getbyshell.target`
- `getbyshell-stop` — `systemctl --user stop getbyshell.target`
- `getbyshell-restart` — stop + start
- `getbyshell-logs` — journalctl with all surface units
- `getbyshell-status` — status of target + all surfaces
- `getbyshell-install` — verify all units are deployed

---

## 6. Migration Plan

### Phase 1: Build the library

Create all files in `packages/tmnl/nix/lib/getbyshell/`.

### Phase 2: Wire into monorepo flake

- Replace `nix/modules/getbyshell/{default,bar,panel}.nix` with import of new library
- Verify mission-control scripts generate correctly

### Phase 3: Wire into home-manager

- Replace `~/.config/nix/modules/home/getbyshell/{default,bar,panel}.nix` with single module import
- Add surface declarations
- `sudo nixos-rebuild switch` to deploy

### Phase 4: Verify

- `getbyshell-status` shows all services
- `getbyshell-start` brings up all surfaces
- `getbyshell-bar-logs` tails bar logs
- Adding a third surface (palette) generates all services + scripts automatically

### Phase 5: Cleanup

- Remove old `~/.config/nix/modules/home/getbyshell/{bar,panel}.nix`
- Remove old `nix/modules/getbyshell/{bar,panel}.nix`
- Update AGENTS.md references

---

## 7. Validation Criteria

- [ ] `nix flake check` passes
- [ ] `getbyshell-status` shows correct service topology
- [ ] Adding a new surface to `surfaces = {}` generates all expected services + scripts
- [ ] Port conflicts between surfaces are caught (assertion)
- [ ] Shared environment is computed once, not per-surface
- [ ] Health check timeout is configurable per surface
- [ ] Legacy aliases work (`tmnl-shell` → `tmnl-bar`)
- [ ] Mission-control scripts appear in `nix develop` shell
- [ ] `nixos-rebuild switch` deploys services correctly
