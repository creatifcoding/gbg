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
      inherit (pkgs.stdenv) isDarwin;
    in
    {
      devShells.effect-sui-sui = pkgs.mkShell {
        name = "effect-sui-sui";

        inputsFrom = [
          config.devShells.effect-sui-core
        ];

        RUST_SRC_PATH = "${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}";
        PKG_CONFIG_PATH = "${pkgs.openssl.dev}/lib/pkgconfig:${pkgs.libpq.dev}/lib/pkgconfig";
        PROTOC = "${pkgs.protobuf}/bin/protoc";

        nativeBuildInputs =
          with pkgs;
          [
            # JS / TypeScript package development
            bun
            nodejs_24

            # Rust / Move / optional Sui source builds
            rustup
            rustc
            cargo
            pkg-config
            openssl
            cmake

            # Sui GraphQL/indexer prerequisites
            postgresql_16
            libpq

            # gRPC / protobuf inspection
            protobuf
            buf
            grpcurl
            grpcui

            # Docker-backed localnet and testcontainers
            docker
            docker-compose
          ]
          ++ lib.optionals isDarwin [ iconv ];

        shellHook = ''
          export PROTOC="${pkgs.protobuf}/bin/protoc"
          export RUST_SRC_PATH="${pkgs.rust.packages.stable.rustPlatform.rustLibSrc}"
          export PKG_CONFIG_PATH="${pkgs.openssl.dev}/lib/pkgconfig:${pkgs.libpq.dev}/lib/pkgconfig:''${PKG_CONFIG_PATH:-}"
          echo "[effect-sui-sui] Sui SDK / Move / localnet tool shell"
          echo "  bun: $(bun --version 2>/dev/null || echo missing)"
          echo "  node: $(node --version 2>/dev/null || echo missing)"
          echo "  docker: $(docker --version 2>/dev/null || echo missing)"
          echo "  protoc: $PROTOC"
          if command -v sui >/dev/null 2>&1; then
            echo "  sui: $(sui --version 2>/dev/null || command -v sui)"
          else
            echo "  sui: not on host PATH; use effect-sui sui-localnet-up-docker or build from ../../submodules/sui"
          fi
        '';
      };
    };
}
