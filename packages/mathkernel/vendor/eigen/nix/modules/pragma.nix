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
      devShells.tmnl-pragma = pkgs.mkShell {
        name = "tmnl-pragma";

        # Layer over tmnl-rust (NOT tmnl-tauri) to avoid mingw cross-compile
        # header contamination that breaks C++ deps like esaxx-rs in tokenizers.
        inputsFrom = [
          config.devShells.tmnl-rust
        ];

        nativeBuildInputs = with pkgs; [
          # C/C++ toolchain for tokenizers (esaxx-rs) native compilation
          gcc
          cmake

          # ONNX Runtime for BLEURT scoring (pragma-core --features inference)
          onnxruntime
        ];

        # Ensure native C++ includes are found, NOT mingw's
        shellHook = ''
          echo "[tmnl-pragma] PRAGMA NLP sidecar development environment."
          echo "  → Candle + ort + tokenizers build deps (no mingw contamination)"
          echo "  → cargo check -p pragma-sidecar --features inference"

          # Explicitly point to native C++ stdlib, blocking any mingw leak
          export CPLUS_INCLUDE_PATH="${pkgs.stdenv.cc.cc}/include/c++/${pkgs.stdenv.cc.cc.version}:${pkgs.stdenv.cc.cc}/include/c++/${pkgs.stdenv.cc.cc.version}/x86_64-unknown-linux-gnu''${CPLUS_INCLUDE_PATH:+:$CPLUS_INCLUDE_PATH}"
        '';
      };

      mission-control.scripts = {
        pragma-check = {
          description = "Check all PRAGMA crates compile (without inference deps).";
          category = "PRAGMA";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/packages/tmnl"
            echo "[pragma-check] cargo check -p pragma-{ipc,core,automata,sidecar}"
            cargo check -p pragma-ipc -p pragma-core -p pragma-automata -p pragma-sidecar
          '';
        };

        pragma-check-full = {
          description = "Check all PRAGMA crates with full inference stack (Candle + ort + tokenizers).";
          category = "PRAGMA";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/packages/tmnl"
            echo "[pragma-check-full] cargo check -p pragma-core --features inference -p pragma-sidecar"
            cargo check -p pragma-core --features inference -p pragma-sidecar
          '';
        };

        pragma-test = {
          description = "Run all PRAGMA tests.";
          category = "PRAGMA";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/packages/tmnl"
            echo "[pragma-test] cargo test --workspace -p pragma-{ipc,core,automata,sidecar}"
            cargo test -p pragma-ipc -p pragma-core -p pragma-automata -p pragma-sidecar
          '';
        };

        pragma-bench = {
          description = "Run PRAGMA benchmarks and check regression gate.";
          category = "PRAGMA";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/packages/tmnl"
            echo "[pragma-bench] Running criterion benchmarks..."
            cargo bench -p pragma-core --features inference
            echo "[pragma-bench] Done. Use critcmp for baseline comparison."
          '';
        };

        pragma-sidecar = {
          description = "Build and run the PRAGMA sidecar binary.";
          category = "PRAGMA";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/packages/tmnl"
            echo "[pragma-sidecar] cargo run -p pragma-sidecar"
            cargo run -p pragma-sidecar
          '';
        };

        pragma-provision = {
          description = "Download and quantize PRAGMA inference models (~200MB).";
          category = "PRAGMA";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/packages/tmnl"
            python3 src/lib/harness/pragma/scripts/provision-models.py "$@"
          '';
        };

        pragma-provision-status = {
          description = "Show PRAGMA model provisioning status.";
          category = "PRAGMA";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/packages/tmnl"
            python3 src/lib/harness/pragma/scripts/provision-models.py --status
          '';
        };
      };
    };
}
