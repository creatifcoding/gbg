{ inputs, lib, ... }:

{
  imports = [
    inputs.mission-control.flakeModule
    inputs.flake-root.flakeModule
  ];

  perSystem = { config, pkgs, system, lib, ... }:
    {
      mission-control = {
        wrapperName = "frknk";

        scripts = {
          info = {
            description = "Display FRKNK core environment and flake root.";
            category = "Core";
            exec = ''
              set -euo pipefail
              echo "[frknk] Core environment"
              echo "  System: ${system}"
              echo "  FLAKE_ROOT: $FLAKE_ROOT"
              echo "  Repo root: $(git -C "$FLAKE_ROOT" rev-parse --show-toplevel 2>/dev/null || echo unavailable)"
              echo "  SDR lab: $FLAKE_ROOT/experiments/sdr-lab"
            '';
          };
        };
      };

      devShells.frknk-core = pkgs.mkShell {
        name = "frknk-core";

        LD_LIBRARY_PATH = lib.makeLibraryPath [
          pkgs.stdenv.cc.cc.lib
          pkgs.zlib
        ];

        nativeBuildInputs = with pkgs; [
          bun
          nodejs_24
          git
          gnupg
          ripgrep
          fd
          jq
          curl
          wget
          coreutils
          findutils
          pkg-config
          zlib
        ];

        inputsFrom = [
          config.mission-control.devShell
          config.flake-root.devShell
        ];

        shellHook = ''
          export FRKNK_ROOT="$FLAKE_ROOT"
          export FRKNK_SDR_LAB="$FRKNK_ROOT/experiments/sdr-lab"
          echo "[frknk-core] base environment on ${system}"
          frknk info || true
        '';
      };
    };
}
