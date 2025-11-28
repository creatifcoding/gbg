{ inputs, lib, ... }:

{
  perSystem =
    {
      config,
      pkgs,
      system,
      ...
    }:
    {
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
          category = "UI";
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
          category = "UI";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            # TODO: set correct path, e.g. cd packages/tmnl/ui
            echo "[tmnl ui-build] pnpm build (adjust path in script)."
            pnpm build
          '';
        };

        test = {
          description = "Run tmnl tests in watch mode";
          category = "Testing";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl test] Running vitest in watch mode"
            bun run test
          '';
        };

        test-run = {
          description = "Run tmnl tests once";
          category = "Testing";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl test-run] Running vitest once"
            bun run test:run
          '';
        };

        test-ui = {
          description = "Run tmnl tests with UI";
          category = "Testing";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl test-ui] Running vitest UI"
            bun run test:ui
          '';
        };

        test-coverage = {
          description = "Run tmnl tests with coverage report";
          category = "Testing";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl test-coverage] Running vitest with coverage"
            bun run test:coverage
          '';
        };
      };
    };
}
