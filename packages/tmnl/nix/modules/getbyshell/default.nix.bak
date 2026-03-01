{ inputs, lib, ... }:

{
  imports = [
    ./bar.nix
    ./panel.nix
  ];

  perSystem =
    {
      config,
      pkgs,
      system,
      lib,
      ...
    }:
    {
      mission-control.scripts = {

        # ── GetByShell — Unified Surface Management ──────────────────

        getbyshell-install = {
          description = "Verify getbyshell services are deployed (via nixos-rebuild) and reload systemd";
          category = "GetByShell";
          exec = ''
            set -euo pipefail

            echo "GetByShell services are managed by home-manager."
            echo "To deploy/update: sudo nixos-rebuild switch --flake ~/.config/nix#getbyzenbook"
            echo ""

            # Reload in case units were updated
            systemctl --user daemon-reload

            # Verify services exist
            echo "═══ Checking deployed units ═══"
            for svc in tmnl-bar-vite tmnl-bar tmnl-panel-vite tmnl-panel; do
              if systemctl --user cat "$svc.service" > /dev/null 2>&1; then
                echo "  ✓ $svc.service"
              else
                echo "  ✗ $svc.service — NOT FOUND (run nixos-rebuild)"
              fi
            done

            if systemctl --user cat getbyshell.target > /dev/null 2>&1; then
              echo "  ✓ getbyshell.target"
            else
              echo "  ✗ getbyshell.target — NOT FOUND (run nixos-rebuild)"
            fi
          '';
        };

        getbyshell-start = {
          description = "Start all getbyshell surfaces (bar + panel) via systemd target";
          category = "GetByShell";
          exec = ''
            set -euo pipefail
            systemctl --user start getbyshell.target
            echo "✓ getbyshell started (bar + panel) → getbyshell-logs to tail"
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
            journalctl --user \
              -u tmnl-bar -u tmnl-bar-vite \
              -u tmnl-panel -u tmnl-panel-vite \
              -f --no-hostname
          '';
        };

        getbyshell-status = {
          description = "Show status of all getbyshell services";
          category = "GetByShell";
          exec = ''
            echo "═══ Target ═══"
            systemctl --user status getbyshell.target --no-pager 2>/dev/null || echo "(not active)"
            echo ""
            echo "═══ Bar Vite (:1421) ═══"
            systemctl --user status tmnl-bar-vite.service --no-pager 2>/dev/null || echo "(not running)"
            echo ""
            echo "═══ Bar (layer-shell) ═══"
            systemctl --user status tmnl-bar.service --no-pager 2>/dev/null || echo "(not running)"
            echo ""
            echo "═══ Panel Vite (:1422) ═══"
            systemctl --user status tmnl-panel-vite.service --no-pager 2>/dev/null || echo "(not running)"
            echo ""
            echo "═══ Panel (layer-shell) ═══"
            systemctl --user status tmnl-panel.service --no-pager 2>/dev/null || echo "(not running)"
          '';
        };
      };
    };
}
