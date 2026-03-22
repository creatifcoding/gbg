# GetByShell Library — Service Pair Generator
#
# For a given surface config, generates two systemd user services:
#   tmnl-{name}-vite  — Vite dev server
#   tmnl-{name}       — Tauri layer-shell binary
#
# Usage:
#   mkSurface { inherit pkgs lib name projectDir sharedEnv; surf = cfg.surfaces.bar; }
#   → attrset merged into systemd.user.services
{ pkgs, lib, name, projectDir, sharedEnv, surf }:

let
  healthCheck = import ./health-check.nix {
    inherit pkgs name;
    port = surf.port;
    timeout = surf.healthCheckTimeout;
  };
in
{
  # ── Vite Dev Server ──────────────────────────────────────────
  "tmnl-${name}-vite" = {
    Unit = {
      Description = "${surf.description} — Vite Dev Server (:${toString surf.port})";
    };

    Service = {
      Type = "simple";
      WorkingDirectory = projectDir;
      ExecStart = "${pkgs.bun}/bin/bunx vite --config ${surf.viteConfig}";
      Environment = sharedEnv ++ surf.extraEnv;
      Restart = "on-failure";
      RestartSec = surf.viteRestartSec;
      StandardOutput = "journal";
      StandardError = "journal";
      SyslogIdentifier = "tmnl-${name}-vite";
    };

    Install = {
      WantedBy = [ "default.target" ];
    };
  };

  # ── Tauri Binary (Layer-Shell) ───────────────────────────────
  "tmnl-${name}" = {
    Unit = {
      Description = "${surf.description} — Wayland Layer-Shell (Layer::${lib.toUpper (builtins.substring 0 1 surf.layer) + builtins.substring 1 (-1) surf.layer})";
      Requires = [ "tmnl-${name}-vite.service" ];
      After = [
        "tmnl-${name}-vite.service"
        "graphical-session.target"
      ];
      ConditionEnvironment = "WAYLAND_DISPLAY";
    };

    Service = {
      Type = "simple";
      WorkingDirectory = "${projectDir}/${surf.tauriDir}";
      ExecStartPre = "${healthCheck}";
      ExecStart = "${pkgs.cargo-tauri}/bin/cargo-tauri dev --config tauri.conf.json";
      Environment = sharedEnv ++ surf.extraEnv ++ [
        "RUST_LOG=${surf.rustLog}"
      ];
      Restart = "on-failure";
      RestartSec = surf.restartSec;
      StandardOutput = "journal";
      StandardError = "journal";
      SyslogIdentifier = "tmnl-${name}";
      MemoryMax = surf.memoryMax;
    };

    Install = {
      WantedBy = [ "graphical-session.target" ];
    };
  };
}
