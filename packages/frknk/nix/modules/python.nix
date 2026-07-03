{ inputs, lib, ... }:

{
  perSystem = { config, pkgs, system, lib, ... }:
    let
      inherit (pkgs.stdenv) isDarwin;
    in
    {
      devShells.frknk-python = pkgs.mkShell {
        name = "frknk-python";

        inputsFrom = [
          config.devShells.frknk-core
        ];

        # Python C extensions (NumPy/SciPy/PyTorch later) need these on NixOS.
        LD_LIBRARY_PATH = lib.makeLibraryPath [
          pkgs.stdenv.cc.cc.lib
          pkgs.zlib
        ];

        nativeBuildInputs = with pkgs; [
          uv
          ruff
          mypy
          jupyter
          zlib
        ] ++ lib.optionals isDarwin [ iconv ];

        shellHook = ''
          export FRKNK_ROOT="$FLAKE_ROOT"
          export FRKNK_SDR_LAB="$FRKNK_ROOT/experiments/sdr-lab"
          echo "[frknk-python] Python SDR/ML environment layered over frknk-core."
          echo "  → cd $FRKNK_SDR_LAB && uv sync"
        '';
      };

      mission-control.scripts = {
        py-lock = {
          description = "Lock Python dependencies for the SDR lab.";
          category = "Python";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/experiments/sdr-lab"
            echo "[frknk py-lock] uv lock"
            uv lock
          '';
        };

        py-sync = {
          description = "Synchronize the SDR lab Python virtual environment.";
          category = "Python";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/experiments/sdr-lab"
            echo "[frknk py-sync] uv sync"
            uv sync
          '';
        };

        py-lint = {
          description = "Run ruff over the SDR lab.";
          category = "Python";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/experiments/sdr-lab"
            echo "[frknk py-lint] uv run --extra dev ruff check ."
            uv run --extra dev ruff check .
          '';
        };

        py-typecheck = {
          description = "Run mypy over the SDR lab.";
          category = "Python";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/experiments/sdr-lab"
            echo "[frknk py-typecheck] uv run --extra dev mypy src tests"
            uv run --extra dev mypy src tests
          '';
        };

        py-test = {
          description = "Run pytest for the SDR lab.";
          category = "Python";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/experiments/sdr-lab"
            echo "[frknk py-test] uv run --extra dev pytest"
            uv run --extra dev pytest
          '';
        };

        py-notebook = {
          description = "Start Jupyter Lab from the SDR lab workspace.";
          category = "Python";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/experiments/sdr-lab"
            echo "[frknk py-notebook] uv run jupyter lab"
            uv run jupyter lab
          '';
        };
      };
    };
}
