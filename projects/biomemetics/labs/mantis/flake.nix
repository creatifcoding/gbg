{
  description = "Mantis biomemetics lab workspace";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
        python = pkgs.python3.withPackages (ps: with ps; [
          jsonschema
          numpy
          pyyaml
          pypdf
          pytest
          scipy
        ]);
        coreTools = with pkgs; [
          python
          nodejs_24
          bun
          cargo
          rustc
          rustfmt
          clippy
          jq
          git
          ripgrep
        ];
        fabricationTools = pkgs.lib.optionals pkgs.stdenv.isLinux (with pkgs; [
          openscad
          freecad
          kicad
          blender
          inkscape
          ngspice
          gmsh
          calculix
        ]);
        shellHook = ''
          export PYTHONPATH="$PWD/tooling/python/mantis-lab/src''${PYTHONPATH:+:$PYTHONPATH}"
          export MANTIS_LAB_WORKSPACE="$PWD"
        '';
      in {
        devShells.default = pkgs.mkShell {
          packages = coreTools;
          inherit shellHook;
        };

        devShells.fabrication = pkgs.mkShell {
          packages = coreTools ++ fabricationTools;
          inherit shellHook;
        };
      });
}
