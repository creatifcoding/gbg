# GetByShell Library — Mission-Control Script Generator
#
# Auto-generates devshell scripts from surface declarations.
# Per-surface: start, stop, restart, logs, status (5 scripts each)
# Global: start, stop, restart, logs, status, install (6 scripts)
#
# Usage (in flake-parts perSystem):
#   mission-control.scripts = mkAllScripts { surfaces = cfg.surfaces; };
{ lib, pkgs }:

let
  inherit (lib) concatStringsSep mapAttrsToList concatMapStrings attrNames;

  # ── Per-Surface Scripts ──────────────────────────────────────────
  mkSurfaceScripts = name: surf: {
    "getbyshell-${name}-start" = {
      description = "Start ${name} surface (Vite + Tauri)";
      category = "GetByShell · ${name}";
      exec = ''
        set -euo pipefail
        systemctl --user start tmnl-${name}-vite.service
        echo "⏳ Waiting for Vite on :${toString surf.port}..."
        for _i in $(seq 1 ${toString (surf.healthCheckTimeout * 2)}); do
          curl -s http://localhost:${toString surf.port} > /dev/null 2>&1 && break
          sleep 0.5
        done
        systemctl --user start tmnl-${name}.service
        echo "✓ ${name} started → getbyshell-${name}-logs to tail"
      '';
    };

    "getbyshell-${name}-stop" = {
      description = "Stop ${name} surface";
      category = "GetByShell · ${name}";
      exec = ''
        systemctl --user stop tmnl-${name}.service 2>/dev/null || true
        systemctl --user stop tmnl-${name}-vite.service 2>/dev/null || true
        echo "✓ ${name} stopped"
      '';
    };

    "getbyshell-${name}-restart" = {
      description = "Restart ${name} surface";
      category = "GetByShell · ${name}";
      exec = ''
        set -euo pipefail
        systemctl --user stop tmnl-${name}.service 2>/dev/null || true
        systemctl --user stop tmnl-${name}-vite.service 2>/dev/null || true
        sleep 1
        systemctl --user start tmnl-${name}-vite.service
        echo "⏳ Waiting for Vite on :${toString surf.port}..."
        for _i in $(seq 1 ${toString (surf.healthCheckTimeout * 2)}); do
          curl -s http://localhost:${toString surf.port} > /dev/null 2>&1 && break
          sleep 0.5
        done
        systemctl --user start tmnl-${name}.service
        echo "✓ ${name} restarted"
      '';
    };

    "getbyshell-${name}-logs" = {
      description = "Tail ${name} journald logs";
      category = "GetByShell · ${name}";
      exec = ''
        journalctl --user -u tmnl-${name} -u tmnl-${name}-vite -f --no-hostname
      '';
    };

    "getbyshell-${name}-status" = {
      description = "Show ${name} service status";
      category = "GetByShell · ${name}";
      exec = ''
        echo "═══ ${name} Vite (:${toString surf.port}) ═══"
        systemctl --user status tmnl-${name}-vite.service --no-pager 2>/dev/null || echo "(not running)"
        echo ""
        echo "═══ ${name} (layer-shell) ═══"
        systemctl --user status tmnl-${name}.service --no-pager 2>/dev/null || echo "(not running)"
      '';
    };
  };

  # ── Global Scripts (aggregate all surfaces) ────────────────────
  mkGlobalScripts = surfaces:
  let
    names = attrNames surfaces;
    allUnits = concatMapStrings (n: "-u tmnl-${n} -u tmnl-${n}-vite ") names;
    allServices = concatMapStrings (n: "\"tmnl-${n}.service\" ") names;
    allViteServices = concatMapStrings (n: "\"tmnl-${n}-vite.service\" ") names;
  in
  {
    getbyshell-start = {
      description = "Start all getbyshell surfaces via systemd target";
      category = "GetByShell";
      exec = ''
        set -euo pipefail
        systemctl --user start getbyshell.target
        echo "✓ getbyshell started → getbyshell-logs to tail"
      '';
    };

    getbyshell-stop = {
      description = "Stop all getbyshell surfaces";
      category = "GetByShell";
      exec = ''
        systemctl --user stop getbyshell.target 2>/dev/null || true
        echo "✓ getbyshell stopped"
      '';
    };

    getbyshell-restart = {
      description = "Restart all getbyshell surfaces";
      category = "GetByShell";
      exec = ''
        set -euo pipefail
        systemctl --user stop getbyshell.target 2>/dev/null || true
        sleep 1
        systemctl --user start getbyshell.target
        echo "✓ getbyshell restarted → getbyshell-logs to tail"
      '';
    };

    getbyshell-logs = {
      description = "Tail all getbyshell journald logs";
      category = "GetByShell";
      exec = ''
        journalctl --user ${allUnits} -f --no-hostname
      '';
    };

    getbyshell-status = {
      description = "Show status of all getbyshell services";
      category = "GetByShell";
      exec = ''
        echo "═══ Target ═══"
        systemctl --user status getbyshell.target --no-pager 2>/dev/null || echo "(not active)"
      '' + concatStringsSep "" (mapAttrsToList (name: surf: ''
        echo ""
        echo "═══ ${name} Vite (:${toString surf.port}) ═══"
        systemctl --user status tmnl-${name}-vite.service --no-pager 2>/dev/null || echo "(not running)"
        echo ""
        echo "═══ ${name} (layer-shell) ═══"
        systemctl --user status tmnl-${name}.service --no-pager 2>/dev/null || echo "(not running)"
      '') surfaces);
    };

    getbyshell-install = {
      description = "Verify getbyshell services are deployed";
      category = "GetByShell";
      exec = ''
        set -euo pipefail
        echo "GetByShell services are managed by home-manager."
        echo "To deploy/update: sudo nixos-rebuild switch --flake ~/.config/nix#getbyzenbook"
        echo ""
        systemctl --user daemon-reload
        echo "═══ Checking deployed units ═══"
      '' + concatStringsSep "" (mapAttrsToList (name: _surf: ''
        for svc in tmnl-${name}-vite tmnl-${name}; do
          if systemctl --user cat "$svc.service" > /dev/null 2>&1; then
            echo "  ✓ $svc.service"
          else
            echo "  ✗ $svc.service — NOT FOUND (run nixos-rebuild)"
          fi
        done
      '') surfaces) + ''
        if systemctl --user cat getbyshell.target > /dev/null 2>&1; then
          echo "  ✓ getbyshell.target"
        else
          echo "  ✗ getbyshell.target — NOT FOUND (run nixos-rebuild)"
        fi
      '';
    };
  };

in
{
  # Generate all scripts for a set of surfaces.
  # Returns an attrset suitable for `mission-control.scripts = ...`
  mkAllScripts = { surfaces }:
    let
      perSurface = lib.foldlAttrs (acc: name: surf:
        acc // mkSurfaceScripts name surf
      ) {} surfaces;
      global = mkGlobalScripts surfaces;
    in
    perSurface // global;
}
