{ inputs, lib, ... }:

{
  imports = [
    inputs.mission-control.flakeModule
    inputs.flake-root.flakeModule
  ];

  perSystem =
    {
      config,
      pkgs,
      system,
      ...
    }:
    {
      mission-control = {
        wrapperName = "tmnl";

        scripts = {
          info = {
            description = "Display tmnl core environment and flake root.";
            category = "Core";
            exec = ''
              echo "[tmnl] Core environment"
              echo "  System: ${system}"
              echo "  FLAKE_ROOT: $FLAKE_ROOT"
            '';
          };
        };
      };

      devShells.tmnl-core = pkgs.mkShell {
        name = "tmnl-core";

        # Fix for binary packages requiring libstdc++.so.6 (JAX, pandas, etc.)
        # See: https://discourse.nixos.org/t/how-to-solve-libstdc-not-found-in-shell-nix/25458
        LD_LIBRARY_PATH = lib.makeLibraryPath [
          pkgs.stdenv.cc.cc
          pkgs.zlib
        ];

        nativeBuildInputs = with pkgs; [
          git
          gnupg
          ripgrep
          fd
          jq
          curl
          wget

          natscli
          nats-top
          nats-server
        ];

        inputsFrom = [
          config.mission-control.devShell
          config.flake-root.devShell
        ];

        shellHook = ''
          echo "[tmnl-core] base environment on ${system}"
          tmnl info || true
        '';
      };
    };
}
