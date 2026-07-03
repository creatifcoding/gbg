# GetByShell Library — Surface Type Definitions
#
# NixOS-style typed submodule for declaring layer-shell surfaces.
# Each surface becomes a Vite dev server + Tauri binary service pair.
#
# Exports:
#   surfaceModule  — submodule type (used in `types.attrsOf (types.submodule surfaceModule)`)
#   topLevelOptions — the full option tree for `gbg.getbyshell.*`
{ lib }:

let
  inherit (lib) mkOption mkEnableOption types literalExpression;

  # ── Surface Submodule ──────────────────────────────────────────
  # Each attribute in `surfaces.<name>` gets this option set.
  surfaceModule = { name, config, ... }: {
    options = {

      enable = mkEnableOption "surface '${name}'" // { default = true; };

      port = mkOption {
        type = types.port;
        description = "Vite dev server port. Must be unique across all surfaces.";
        example = 1421;
      };

      layer = mkOption {
        type = types.enum [ "background" "bottom" "top" "overlay" ];
        default = "top";
        description = ''
          Wayland layer-shell layer.
          - background: behind all windows
          - bottom: above background, below windows
          - top: above windows (e.g. bar, dock)
          - overlay: above everything (e.g. lock screen, notifications)
        '';
      };

      viteConfig = mkOption {
        type = types.str;
        description = "Vite config filename, relative to projectDir.";
        example = "vite.config.shell.ts";
      };

      tauriDir = mkOption {
        type = types.str;
        description = "Tauri project directory, relative to projectDir.";
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
        description = "Seconds to wait for Vite health check before giving up.";
      };

      restartSec = mkOption {
        type = types.int;
        default = 5;
        description = "RestartSec for the Tauri service on failure.";
      };

      viteRestartSec = mkOption {
        type = types.int;
        default = 3;
        description = "RestartSec for the Vite service on failure.";
      };

      extraEnv = mkOption {
        type = types.listOf types.str;
        default = [];
        description = "Extra KEY=VALUE environment variables for both services.";
        example = literalExpression ''[ "DEBUG=true" "SOME_FLAG=1" ]'';
      };

      description = mkOption {
        type = types.str;
        default = "GetByShell · ${name}";
        description = "Human-readable description for systemd unit files.";
      };
    };
  };

in
{
  inherit surfaceModule;

  # ── Top-Level Options ──────────────────────────────────────────
  # These are the options under `gbg.getbyshell.*`
  # Uses surfaceModule directly — no circular self-import.
  topLevelOptions = {

    enable = mkEnableOption "GetByShell — Wayland layer-shell surface ecosystem";

    projectDir = mkOption {
      type = types.str;
      description = "Absolute path to the tmnl package root.";
      example = "/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl";
    };

    surfaces = mkOption {
      type = types.attrsOf (types.submodule surfaceModule);
      default = {};
      description = ''
        Layer-shell surface declarations. Each attribute generates:
        - tmnl-{name}-vite.service (Vite dev server)
        - tmnl-{name}.service (Tauri layer-shell binary)
        - Health check script
        - Mission-control convenience scripts
      '';
      example = literalExpression ''
        {
          bar = {
            port = 1421;
            layer = "overlay";
            viteConfig = "vite.config.shell.ts";
            tauriDir = "src-shell-tauri";
          };
          panel = {
            port = 1422;
            layer = "overlay";
            viteConfig = "vite.config.panel.ts";
            tauriDir = "src-panel-tauri";
          };
        }
      '';
    };

    extraRuntimePkgs = mkOption {
      type = types.listOf types.package;
      default = [];
      description = "Extra packages added to all surfaces' PATH.";
    };

    extraPkgConfigPaths = mkOption {
      type = types.listOf types.str;
      default = [];
      description = "Extra pkg-config search paths appended for all surfaces.";
    };

    legacyAliases = mkOption {
      type = types.bool;
      default = true;
      description = "Generate tmnl-shell / tmnl-shell-vite legacy service aliases pointing to the bar surface.";
    };
  };
}
