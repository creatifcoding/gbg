{ inputs, lib, ... }:

{
  perSystem = { config, pkgs, system, ... }: {
    devShells.tmnl-ui = pkgs.mkShell {
      name = "tmnl-ui";

      inputsFrom = [
        config.devShells.tmnl-core
      ];

      nativeBuildInputs = with pkgs; [
        nodejs_22
        pnpm
        # tauri-cli
        # rustc
        # cargo
      ];

      shellHook = ''
        echo "[tmnl-ui] UI/Tauri environment layered over tmnl-core."
        echo "Set PNPM/TAURI project path in tmnl ui-dev/ui-build scripts before relying on them."
      '';
    };

    mission-control.scripts = {
      ui-dev = {
        description = "Run tmnl UI in dev mode (adjust path).";
        category    = "UI";
        exec = ''
          set -euo pipefail
          cd "$FLAKE_ROOT"
          # TODO: set correct path, e.g. cd packages/tmnl/ui
          echo "[tmnl ui-dev] pnpm dev (adjust path in script)."
          pnpm dev
        '';
      };

      ui-build = {
        description = "Build tmnl UI bundle (adjust path).";
        category    = "UI";
        exec = ''
          set -euo pipefail
          cd "$FLAKE_ROOT"
          # TODO: set correct path, e.g. cd packages/tmnl/ui
          echo "[tmnl ui-build] pnpm build (adjust path in script)."
          pnpm build
        '';
      };
    };
  };
}
