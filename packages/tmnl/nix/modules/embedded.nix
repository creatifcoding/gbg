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
      devShells.tmnl-embedded = pkgs.mkShell {
        name = "tmnl-embedded";

        inputsFrom = [
          config.devShells.tmnl-core
        ];

        nativeBuildInputs = with pkgs; [
          # TODO: pin and harden specific embedded toolchains
          gcc-arm-embedded
          openocd
          probe-rs
          qemu
          qemu-python-utils
          renode
        ];

        shellHook = ''
          echo "[tmnl-embedded] Embedded environment layered over tmnl-core."
        '';
      };

      mission-control.scripts = {
        fw-build = {
          description = "Build tmnl firmware (placeholder).";
          category = "Embedded";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl fw-build] TODO: implement firmware build for tmnl targets."
          '';
        };

        fw-flash = {
          description = "Flash tmnl firmware to hardware (placeholder).";
          category = "Embedded";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl fw-flash] TODO: implement flashing via probe-rs/openocd."
          '';
        };

        sim-run = {
          description = "Run tmnl embedded simulation (Renode/other, placeholder).";
          category = "Embedded";
          exec = ''
            set -euo pipefail
            cd "$FLAKE_ROOT"
            echo "[tmnl sim-run] TODO: hook Renode or other simulator."
          '';
        };
      };
    };
}
