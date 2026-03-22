{ inputs, ... }:

{
  imports = [
    inputs.devshell.flakeModule
    inputs.flake-root.flakeModule
  ];

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

      # Eigen 3.4.x — header-only linear algebra
      eigen = pkgs.eigen;

      # Emscripten 4.x — C++ → WASM compiler
      emscripten = pkgs.emscripten;
    in
    {
      devshells.default = {
        name = "mathkernel";

        env = [
          {
            name = "EIGEN_INCLUDE_DIR";
            value = "${eigen}/include/eigen3";
          }
          {
            name = "MATHKERNEL_ROOT";
            eval = "$PWD";
          }
        ];

        packages = with pkgs;
          lib.mkMerge [
            [
              # ── C++ Toolchain ──
              emscripten        # emcc, emcmake, emmake (4.x)
              cmake             # build system
              ninja             # fast parallel builds
              pkg-config

              # ── Headers ──
              eigen             # 3.4.x linear algebra (header-only)

              # ── TypeScript / Node (for tests + bindings) ──
              bun
              nodejs_24
              typescript

              # ── Dev tools ──
              clang-tools       # clang-format, clang-tidy
              bear              # compile_commands.json for LSP
              gdb
              valgrind

              # ── Utilities ──
              jq
              ripgrep
              fd
              git
            ]
            (lib.mkIf isDarwin [ pkgs.iconv ])
          ];

        commands = [
          {
            name = "mk-build";
            category = "build";
            help = "Configure + build WASM output (Release)";
            command = ''
              set -euo pipefail
              echo "[mathkernel] Configuring with emcmake..."
              emcmake cmake -B build -S . \
                -G Ninja \
                -DCMAKE_BUILD_TYPE=Release \
                -DEIGEN_INCLUDE_DIR="$EIGEN_INCLUDE_DIR"
              echo "[mathkernel] Building with emmake..."
              emmake cmake --build build --parallel
              echo "[mathkernel] Copying artifacts to wasm/..."
              mkdir -p wasm
              cp build/mathkernel.js build/mathkernel.wasm wasm/
              [ -f build/mathkernel.d.ts ] && cp build/mathkernel.d.ts wasm/
              echo "[mathkernel] ✓ Build complete → wasm/"
            '';
          }
          {
            name = "mk-build-debug";
            category = "build";
            help = "Configure + build WASM output (Debug, with source maps)";
            command = ''
              set -euo pipefail
              emcmake cmake -B build-debug -S . \
                -G Ninja \
                -DCMAKE_BUILD_TYPE=Debug \
                -DEIGEN_INCLUDE_DIR="$EIGEN_INCLUDE_DIR"
              emmake cmake --build build-debug --parallel
              mkdir -p wasm
              cp build-debug/mathkernel.js build-debug/mathkernel.wasm wasm/
              [ -f build-debug/mathkernel.d.ts ] && cp build-debug/mathkernel.d.ts wasm/
              echo "[mathkernel] ✓ Debug build complete → wasm/"
            '';
          }
          {
            name = "mk-test";
            category = "test";
            help = "Run vitest against WASM output";
            command = ''
              set -euo pipefail
              echo "[mathkernel] Running tests..."
              bun run test:run
            '';
          }
          {
            name = "mk-clean";
            category = "build";
            help = "Remove build artifacts";
            command = ''
              rm -rf build build-debug wasm/*.js wasm/*.wasm wasm/*.d.ts
              echo "[mathkernel] ✓ Cleaned"
            '';
          }
          {
            name = "mk-format";
            category = "dev";
            help = "Format C++ sources with clang-format";
            command = ''
              find src/ -name '*.cpp' -o -name '*.h' | xargs clang-format -i
              echo "[mathkernel] ✓ Formatted"
            '';
          }
          {
            name = "mk-check";
            category = "dev";
            help = "Run clang-tidy on sources";
            command = ''
              if [ -f build/compile_commands.json ]; then
                clang-tidy src/**/*.cpp -p build/
              else
                echo "Run mk-build first to generate compile_commands.json"
              fi
            '';
          }
        ];
      };
    };
}
