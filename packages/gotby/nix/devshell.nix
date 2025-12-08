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
          {
            name = "LD_LIBRARY_PATH";
            value = "${pkgs.stdenv.cc.cc.lib}/lib";
          }
        ];
        packages =
          with pkgs;
          lib.mkMerge [
            [
              uv
              ruff
              mypy
              jupyter
            ]
            (lib.mkIf isDarwin [ iconv ])
          ];

        # commands = [ ];
      };
    };
}
