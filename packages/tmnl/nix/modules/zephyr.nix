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
      devShells.tmnl-zephyr = pkgs.mkShell {
        name = "tmnl-zephyr";

        inputsFrom = [
          config.devShells.tmnl-core
          config.devShells.tmnl-python
        ];

        nativeBuildInputs =
          with pkgs;
          [
            zephyr-sdk
            cmake
            ninja
            gperf
            dtc
          ]
          ++ lib.optionals isDarwin [ iconv ];

        ZEPHYR_TOOLCHAIN_VARIANT = "zephyr";
        ZEPHYR_SDK_INSTALL_DIR = "${pkgs.zephyr-sdk}";

        shellHook = ''
          echo "[tmnl-zephyr] Zephyr SDK ready: $ZEPHYR_SDK_INSTALL_DIR"
        '';
      };
    };
}
