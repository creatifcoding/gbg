{ inputs, lib, ... }:

{
  imports = [
    ./modules/core.nix
    ./modules/rust.nix
    ./modules/python.nix
    ./modules/embedded.nix
    ./modules/zephyr.nix
    ./modules/ui.nix
    ./modules/tauri.nix
    ./modules/k8s.nix # Kubernetes / Pepr operator
    ./modules/grpc.nix # gRPC / Protobuf tooling (buf, protoc)
    ./modules/nats/default.nix # NATS cluster (Phase 0)
    ./modules/postgres/default.nix # PostgreSQL (Phase 0)
    ./modules/worktrunk.nix # Git worktree management for parallel AI workflows
    ./modules/ctl.nix # CLI tools (ctl + spikectl)
    ./modules/default.nix # Unified tmnl shell
    ./modules/tests.nix # Test suite
  ];
}
