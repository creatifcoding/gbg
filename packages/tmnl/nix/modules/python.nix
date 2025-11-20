{ inputs, lib, ... }:

{
  perSystem = { config, pkgs, system, lib, ... }:
    let
      inherit (pkgs.stdenv) isLinux isDarwin;
    in
    {
      devShells.tmnl-python = pkgs.mkShell {
        name = "tmnl-python";

        inputsFrom = [
          config.devShells.tmnl-core
        ];

        LD_LIBRARY_PATH = "${pkgs.stdenv.cc.cc.lib}/lib";

        nativeBuildInputs =
          with pkgs;
          lib.mkMerge [
            [
              uv
              ruff
              mypy
              jupyter
            ]
            (lib.mkIf isDarwin [ iconv ])
          ];

        shellHook = ''
          echo "[tmnl-python] Python analytics environment layered over tmnl-core."
        '';
      };

      mission-control.scripts = {
        py-lint = {
          description = "Run ruff over tmnl Python code.";
          category    = "Python";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl py-lint] ruff check ."
            ruff check .
          '';
        };

        py-typecheck = {
          description = "Run mypy over tmnl Python code.";
          category    = "Python";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl py-typecheck] mypy ."
            mypy .
          '';
        };

        py-notebook = {
          description = "Start Jupyter Lab for tmnl analysis.";
          category    = "Python";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl py-notebook] jupyter lab"
            jupyter lab
          '';
        };
      };
    };
}
