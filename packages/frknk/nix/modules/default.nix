{ inputs, lib, ... }:

{
  perSystem = { config, pkgs, system, ... }:
    {
      devShells = {
        frknk = pkgs.mkShell {
          name = "frknk";

          inputsFrom = [
            config.devShells.frknk-core
            config.devShells.frknk-python
            config.devShells.frknk-sdr
          ];

          shellHook = ''
            echo "[frknk] Full FRKNK development environment"
            echo "  → TypeScript contracts + Python SDR lab + native SDR/DSP tools"
            echo ""
            frknk info || true
          '';
        };

        default = config.devShells.frknk;
      };
    };
}
