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

        # ── Panel — individual surface commands ──────────────────────

        getbyshell-panel-start = {
          description = "Start panel surface only (Vite + Tauri)";
          category = "GetByShell · Panel";
          exec = ''
            set -euo pipefail
            systemctl --user start tmnl-panel-vite.service
            echo "⏳ Waiting for Vite on :1422..."
            for _i in $(seq 1 30); do
              curl -s http://localhost:1422 > /dev/null 2>&1 && break
              sleep 0.5
            done
            systemctl --user start tmnl-panel.service
            echo "✓ panel started → getbyshell-panel-logs to tail"
          '';
        };

        getbyshell-panel-stop = {
          description = "Stop panel surface only";
          category = "GetByShell · Panel";
          exec = ''
            systemctl --user stop tmnl-panel.service 2>/dev/null || true
            systemctl --user stop tmnl-panel-vite.service 2>/dev/null || true
            echo "✓ panel stopped"
          '';
        };

        getbyshell-panel-restart = {
          description = "Restart panel surface";
          category = "GetByShell · Panel";
          exec = ''
            set -euo pipefail
            systemctl --user stop tmnl-panel.service 2>/dev/null || true
            systemctl --user stop tmnl-panel-vite.service 2>/dev/null || true
            sleep 1
            systemctl --user start tmnl-panel-vite.service
            echo "⏳ Waiting for Vite on :1422..."
            for _i in $(seq 1 30); do
              curl -s http://localhost:1422 > /dev/null 2>&1 && break
              sleep 0.5
            done
            systemctl --user start tmnl-panel.service
            echo "✓ panel restarted"
          '';
        };

        getbyshell-panel-logs = {
          description = "Tail panel journald logs";
          category = "GetByShell · Panel";
          exec = ''
            journalctl --user -u tmnl-panel -u tmnl-panel-vite -f --no-hostname
          '';
        };

        getbyshell-panel-status = {
          description = "Show panel service status";
          category = "GetByShell · Panel";
          exec = ''
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
