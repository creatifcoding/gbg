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
    {
      mission-control.scripts = {

        # ── Bar — individual surface commands ────────────────────────

        getbyshell-bar-start = {
          description = "Start bar surface only (Vite + Tauri)";
          category = "GetByShell · Bar";
          exec = ''
            set -euo pipefail
            systemctl --user start tmnl-bar-vite.service
            echo "⏳ Waiting for Vite on :1421..."
            for _i in $(seq 1 30); do
              curl -s http://localhost:1421 > /dev/null 2>&1 && break
              sleep 0.5
            done
            systemctl --user start tmnl-bar.service
            echo "✓ bar started → getbyshell-bar-logs to tail"
          '';
        };

        getbyshell-bar-stop = {
          description = "Stop bar surface only";
          category = "GetByShell · Bar";
          exec = ''
            systemctl --user stop tmnl-bar.service 2>/dev/null || true
            systemctl --user stop tmnl-bar-vite.service 2>/dev/null || true
            echo "✓ bar stopped"
          '';
        };

        getbyshell-bar-restart = {
          description = "Restart bar surface";
          category = "GetByShell · Bar";
          exec = ''
            set -euo pipefail
            systemctl --user stop tmnl-bar.service 2>/dev/null || true
            systemctl --user stop tmnl-bar-vite.service 2>/dev/null || true
            sleep 1
            systemctl --user start tmnl-bar-vite.service
            echo "⏳ Waiting for Vite on :1421..."
            for _i in $(seq 1 30); do
              curl -s http://localhost:1421 > /dev/null 2>&1 && break
              sleep 0.5
            done
            systemctl --user start tmnl-bar.service
            echo "✓ bar restarted"
          '';
        };

        getbyshell-bar-logs = {
          description = "Tail bar journald logs";
          category = "GetByShell · Bar";
          exec = ''
            journalctl --user -u tmnl-bar -u tmnl-bar-vite -f --no-hostname
          '';
        };

        getbyshell-bar-status = {
          description = "Show bar service status";
          category = "GetByShell · Bar";
          exec = ''
            echo "═══ Bar Vite (:1421) ═══"
            systemctl --user status tmnl-bar-vite.service --no-pager 2>/dev/null || echo "(not running)"
            echo ""
            echo "═══ Bar (layer-shell) ═══"
            systemctl --user status tmnl-bar.service --no-pager 2>/dev/null || echo "(not running)"
          '';
        };
      };
    };
}
