{ inputs, lib, ... }:

{
  perSystem =
    {
      config,
      pkgs,
      system,
      ...
    }:
    {
      devShells = {
        tmnl = pkgs.mkShell {
          name = "tmnl";

          inputsFrom = [
            config.devShells.tmnl-core
            config.devShells.tmnl-rust
            config.devShells.tmnl-elixir
            config.devShells.tmnl-python
            config.devShells.tmnl-embedded
            config.devShells.tmnl-zephyr
            config.devShells.tmnl-ui
            config.devShells.tmnl-fonts
            config.devShells.tmnl-tauri
            config.devShells.tmnl-k8s
            config.devShells.tmnl-grpc
          ];

          shellHook = ''
            echo "[tmnl] Full-stack development environment"
            echo "  → Rust + Elixir + Python + Embedded + UI + Fonts + Tauri + K8s + gRPC + Core tooling"
            echo ""
            tmnl info || true
          '';
        };

        # Make tmnl the default shell
        default = config.devShells.tmnl;
      };
    };
}
