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
    let
      inherit (pkgs.stdenv) isLinux isDarwin;
    in
    {
      devShells.tmnl-wasm = pkgs.mkShell {
        name = "tmnl-wasm";

        inputsFrom = [
          config.devShells.tmnl-core
        ];

        nativeBuildInputs = with pkgs; [
          emscripten
          cmake
          pkg-config
          eigen
        ];

        # Emscripten cache needs a writable directory
        EMSDK_CACHE = "$HOME/.cache/emsdk";

        shellHook = ''
          echo "[tmnl-wasm] WASM development environment (Emscripten + Eigen)"
          echo "  emcc $(emcc --version 2>&1 | head -1)"
          echo "  cmake $(cmake --version | head -1 | awk '{print $3}')"
          echo "  eigen: ${pkgs.eigen.version}"
        '';
      };

      mission-control.scripts = {
        wasm-build = {
          description = "Build @tmnl/mathkernel WASM module.";
          category = "WASM";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/packages/mathkernel"
            echo "[wasm-build] Building mathkernel with Emscripten..."
            mkdir -p build
            cd build
            emcmake cmake .. -DCMAKE_BUILD_TYPE=Release
            cmake --build . --parallel
            echo "[wasm-build] Done → dist/"
          '';
        };

        wasm-clean = {
          description = "Clean @tmnl/mathkernel build artifacts.";
          category = "WASM";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/packages/mathkernel"
            rm -rf build dist
            echo "[wasm-clean] Cleaned."
          '';
        };
      };
    };
}
