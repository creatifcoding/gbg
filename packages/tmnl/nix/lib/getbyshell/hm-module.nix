# GetByShell Library — Home-Manager Module
#
# Declares the `gbg.getbyshell` option tree and generates systemd
# user services, targets, and legacy aliases from surface declarations.
#
# Import this in your home-manager configuration:
#   imports = [ inputs.gbg.homeManagerModules.getbyshell ];
#
#   gbg.getbyshell = {
#     enable = true;
#     projectDir = "/home/.../tmnl";
#     surfaces = {
#       bar   = { port = 1421; layer = "overlay"; viteConfig = "vite.config.shell.ts"; tauriDir = "src-shell-tauri"; };
#       panel = { port = 1422; layer = "overlay"; viteConfig = "vite.config.panel.ts"; tauriDir = "src-panel-tauri"; };
#     };
#   };
{ config, pkgs, lib, ... }:

let
  typesLib = import ./types.nix { inherit lib; };
  cfg = config.gbg.getbyshell;

  sharedEnvResult = import ./shared-env.nix {
    inherit pkgs lib;
    extraPkgs = cfg.extraRuntimePkgs;
    extraPkgConfigPaths = cfg.extraPkgConfigPaths;
  };

  sharedEnv = sharedEnvResult.env;

  # Generate service pairs for all enabled surfaces
  allServices = lib.foldlAttrs (acc: name: surf:
    if surf.enable then
      acc // (import ./surface.nix {
        inherit pkgs lib name sharedEnv;
        projectDir = cfg.projectDir;
        inherit surf;
      })
    else
      acc
  ) {} cfg.surfaces;

  # Generate target + legacy aliases
  targetResult = import ./target.nix {
    inherit pkgs lib;
    surfaces = cfg.surfaces;
    legacyAliases = cfg.legacyAliases;
  };

  # Port uniqueness assertion
  enabledSurfaces = lib.filterAttrs (_: s: s.enable) cfg.surfaces;
  ports = lib.mapAttrsToList (_: s: s.port) enabledSurfaces;
  uniquePorts = lib.unique ports;

in
{
  options.gbg.getbyshell = typesLib.topLevelOptions;

  config = lib.mkIf cfg.enable {
    # ── Assertion: no duplicate ports ──────────────────────────────
    assertions = [
      {
        assertion = builtins.length ports == builtins.length uniquePorts;
        message = "GetByShell: Duplicate ports detected across surfaces. Each surface must use a unique Vite port.";
      }
    ];

    # ── systemd services (vite + tauri per surface) ───────────────
    # Use mkMerge — not // — because targetResult.services wraps in mkIf.
    systemd.user.services = lib.mkMerge [
      allServices
      targetResult.services
    ];

    # ── systemd target ────────────────────────────────────────────
    systemd.user.targets = targetResult.targets;
  };
}
