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
      devShells.tmnl-grpc = pkgs.mkShell {
        name = "tmnl-grpc";

        inputsFrom = [
          config.devShells.tmnl-core
        ];

        nativeBuildInputs = with pkgs; [
          # Buf - modern protobuf toolchain
          buf

          # Protocol Buffers compiler
          protobuf

          # gRPC tools
          grpcurl
          grpcui

          # For protobuf-src compilation (if needed)
          cmake
          pkg-config
        ];

        # Ensure protoc is findable
        PROTOC = "${pkgs.protobuf}/bin/protoc";

        shellHook = ''
          echo "[tmnl-grpc] gRPC/Protobuf development environment"
          echo "  buf version: $(buf --version 2>/dev/null || echo 'checking...')"
          echo "  protoc: $PROTOC"
        '';
      };

      mission-control.scripts = {
        buf-lint = {
          description = "Lint proto files with buf";
          category = "gRPC";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/packages/tmnl/src-ava/proto"
            echo "[buf-lint] Linting proto files..."
            buf lint
          '';
        };

        buf-generate = {
          description = "Generate code from proto files with buf";
          category = "gRPC";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/packages/tmnl/src-ava/proto"
            echo "[buf-generate] Generating code..."
            buf generate
          '';
        };

        buf-breaking = {
          description = "Check for breaking changes in proto files";
          category = "gRPC";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT/packages/tmnl/src-ava/proto"
            echo "[buf-breaking] Checking for breaking changes..."
            buf breaking --against '.git#branch=main'
          '';
        };

        grpc-ui = {
          description = "Launch gRPC UI for service exploration";
          category = "gRPC";
          exec = ''
            set -euo pipefail
            echo "[grpc-ui] Launching gRPC UI..."
            echo "Usage: grpcui -plaintext localhost:50051"
            grpcui "$@"
          '';
        };
      };
    };
}
