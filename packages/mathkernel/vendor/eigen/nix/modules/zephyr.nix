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

      # Zephyr SDK from nix-community/zephyr-nix flake input
      zephyrPkgs = inputs.zephyr-nix.packages.${system};

      # Use the full SDK (includes all toolchains)
      # Alternative: zephyrPkgs.sdk for minimal version
      zephyrSdk = zephyrPkgs.sdkFull;
    in
    {
      devShells.tmnl-zephyr = pkgs.mkShell {
        name = "tmnl-zephyr";

        inputsFrom = [
          config.devShells.tmnl-core
          config.devShells.tmnl-python
        ];

        packages = [
          zephyrSdk
          zephyrPkgs.hosttools-nix
        ];

        nativeBuildInputs =
          with pkgs;
          [
            cmake
            ninja
            gperf
            dtc
            python3Packages.west
          ]
          ++ lib.optionals isDarwin [ iconv ];

        ZEPHYR_TOOLCHAIN_VARIANT = "zephyr";
        ZEPHYR_SDK_INSTALL_DIR = "${zephyrSdk}";

        shellHook = ''
          echo "[tmnl-zephyr] Zephyr SDK ready: $ZEPHYR_SDK_INSTALL_DIR"
          echo "  west version: $(west --version 2>/dev/null || echo 'not initialized')"
        '';
      };
    };
}
