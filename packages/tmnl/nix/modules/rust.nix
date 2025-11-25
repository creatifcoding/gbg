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
      devShells.tmnl-rust = pkgs.mkShell {
        name = "tmnl-rust";

        inputsFrom = [
          config.devShells.tmnl-core
        ];

        RUST_SRC_PATH = "${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}";
        PKG_CONFIG_PATH = "${pkgs.openssl.dev}/lib/pkgconfig";

        nativeBuildInputs =
          with pkgs;
          [
            rustup
            rustc
            cargo
            lldb_18
            natscli
            nats-top
            nats-server
            pkg-config
            openssl
          ]
          ++ lib.optionals isDarwin [ iconv ];

        shellHook = ''
          echo "[tmnl-rust] Rust systems environment layered over tmnl-core."
        '';
      };

      mission-control.scripts = {
        rust-build = {
          description = "Build tmnl Rust workspace.";
          category = "Rust";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl rust-build] cargo build --workspace"
            cargo build --workspace
          '';
        };

        rust-test = {
          description = "Test tmnl Rust workspace.";
          category = "Rust";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl rust-test] cargo test --workspace"
            cargo test --workspace
          '';
        };
      };
    };
}
