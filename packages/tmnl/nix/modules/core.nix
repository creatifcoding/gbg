{ inputs, lib, ... }:

{
  imports = [
    inputs.mission-control.flakeModule
    inputs.flake-root.flakeModule
  ];

  perSystem = { config, pkgs, system, ... }: {
    mission-control = {
      wrapperName = "tmnl";

      scripts = {
        info = {
          description = "Display tmnl core environment and flake root.";
          category    = "Core";
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

      nativeBuildInputs = with pkgs; [
        git
        gnupg
        ripgrep
        fd
        jq
        curl
        wget
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
