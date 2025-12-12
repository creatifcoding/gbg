{ inputs, lib, ... }:

{
  imports = [
    ./modules/core.nix
    ./modules/rust.nix
    ./modules/python.nix
    ./modules/embedded.nix
    ./modules/ui.nix
    ./modules/tauri.nix
    ./modules/k8s.nix      # Kubernetes / Pepr operator
    ./modules/grpc.nix     # gRPC / Protobuf tooling (buf, protoc)
    ./modules/default.nix  # Unified tmnl shell
    ./modules/tests.nix    # Test suite
  ];
}
