{
  nixpkgs,
  inputs,
  lib,
  pkgs,
  ...
}:

{
  imports = [ inputs.devshell.flakeModule ];
  config.perSystem =
    { pkgs, lib, ... }:
    let
      inherit (pkgs.stdenv) isLinux isDarwin;
    in
    {
      config.devshells.default = {

        env = [
        ];
        packages =
          with pkgs;
          lib.mkMerge [
            [

              bazel_7
              bazelisk
              nodejs_24
              yarn
              bun
              pnpm
              typescript
              nodePackages.node2nix
              direnv
              runme
            ]
            (lib.mkIf isDarwin [ iconv ])
          ];

        # commands = [ ];
      };
    };
}
