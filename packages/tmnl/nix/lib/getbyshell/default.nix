# GetByShell Library — Flake-Parts Module Entry Point
#
# When imported in the monorepo's flake-parts configuration, this module:
# 1. Generates mission-control scripts from surface declarations
# 2. Exports the home-manager module for consumer flakes
#
# The surface declarations used here should mirror what's in the HM config.
# In practice, you declare surfaces in one place and import from both.
#
# Usage (in packages/tmnl/nix/modules/getbyshell/default.nix):
#   imports = [ ../../lib/getbyshell ];
{ inputs, lib, ... }:

{
  perSystem =
    {
      config,
      pkgs,
      system,
      lib,
      ...
    }:
    let
      mc = import ./mission-control.nix { inherit lib pkgs; };

      # Surface declarations — single source of truth.
      # These mirror the home-manager config declarations.
      surfaces = {
        bar = {
          enable = true;
          port = 1421;
          layer = "overlay";
          viteConfig = "vite.config.shell.ts";
          tauriDir = "src-shell-tauri";
          rustLog = "tmnl_shell=debug,tmnl_shared=debug";
          memoryMax = "4G";
          healthCheckTimeout = 30;
          restartSec = 5;
          viteRestartSec = 3;
          extraEnv = [];
          description = "GetByShell · Bar — left-anchored panel";
        };

        panel = {
          enable = true;
          port = 1422;
          layer = "overlay";
          viteConfig = "vite.config.panel.ts";
          tauriDir = "src-panel-tauri";
          rustLog = "tmnl_panel=debug,tmnl_shared=debug";
          memoryMax = "4G";
          healthCheckTimeout = 30;
          restartSec = 5;
          viteRestartSec = 3;
          extraEnv = [];
          description = "GetByShell · Panel — persistent workspace overlay";
        };
      };

    in
    {
      mission-control.scripts = mc.mkAllScripts { inherit surfaces; };
    };
}
