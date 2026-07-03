# GetByShell Library — Systemd Target + Legacy Alias Generator
#
# Generates:
#   getbyshell.target — groups all surfaces
#   tmnl-shell / tmnl-shell-vite — legacy aliases (optional, point to bar)
#
# Usage:
#   mkTarget { inherit pkgs lib; surfaces = cfg.surfaces; legacyAliases = true; }
#   → attrset merged into systemd.user.{targets,services}
{ pkgs, lib, surfaces, legacyAliases ? true }:

let
  surfaceNames = lib.attrNames surfaces;
  enabledNames = lib.filter (n: surfaces.${n}.enable) surfaceNames;

  tauriUnits = map (n: "tmnl-${n}.service") enabledNames;
in
{
  # ── systemd target ───────────────────────────────────────────
  targets = {
    getbyshell = {
      Unit = {
        Description = "GetByShell — All Wayland layer-shell surfaces";
        Requires = tauriUnits;
        After = tauriUnits;
      };

      Install = {
        # Avoid ordering cycle: graphical-session.target → getbyshell.target →
        # tmnl-*.service → graphical-session.target. Individual Tauri surface
        # services still bind to graphical-session.target; this grouping target is
        # user/default activated and may also be started manually.
        WantedBy = [ "default.target" ];
      };
    };
  };

  # ── Legacy aliases (tmnl-shell → tmnl-bar) ──────────────────
  services = lib.mkIf legacyAliases {
    tmnl-shell = {
      Unit = {
        Description = "TMNL Shell (legacy alias → tmnl-bar)";
        Requires = [ "tmnl-bar.service" ];
        After = [ "tmnl-bar.service" ];
        BindsTo = [ "tmnl-bar.service" ];
      };
      Service = {
        Type = "oneshot";
        ExecStart = "${pkgs.coreutils}/bin/true";
        RemainAfterExit = true;
      };
    };

    tmnl-shell-vite = {
      Unit = {
        Description = "TMNL Shell Vite (legacy alias → tmnl-bar-vite)";
        Requires = [ "tmnl-bar-vite.service" ];
        After = [ "tmnl-bar-vite.service" ];
        BindsTo = [ "tmnl-bar-vite.service" ];
      };
      Service = {
        Type = "oneshot";
        ExecStart = "${pkgs.coreutils}/bin/true";
        RemainAfterExit = true;
      };
    };
  };
}
