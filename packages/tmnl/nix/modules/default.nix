{ inputs, lib, ... }:

{
  perSystem = { config, pkgs, system, ... }: {
    devShells = {
      tmnl = pkgs.mkShell {
        name = "tmnl";

        inputsFrom = [
          config.devShells.tmnl-core
          config.devShells.tmnl-rust
          config.devShells.tmnl-python
          config.devShells.tmnl-embedded
          config.devShells.tmnl-ui
          config.devShells.tmnl-tauri
          config.devShells.tmnl-k8s
        ];

        shellHook = ''
          echo "[tmnl] Full-stack development environment"
          echo "  → Rust + Python + Embedded + UI + Tauri + K8s + Core tooling"
          echo ""
          tmnl info || true
        '';
      };

      # Make tmnl the default shell
      default = config.devShells.tmnl;
    };
  };
}
