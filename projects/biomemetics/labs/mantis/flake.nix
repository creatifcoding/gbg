{
  description = "Self-contained Mantis biomemetics lab engineering runtime";

  inputs = {
    # Released NixOS stable. Do not follow nixos-unstable or nixpkgs main.
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-26.05";
  };

  outputs =
    { self, nixpkgs }:
    let
      inherit (nixpkgs) lib;
      systems = [
        "x86_64-linux"
        "aarch64-linux"
        "aarch64-darwin"
        "x86_64-darwin"
      ];
      forEachSystem =
        f:
        lib.genAttrs systems (
          system:
          f {
            inherit self lib system;
            pkgs = import nixpkgs {
              inherit system;
              config.allowUnfree = false;
            };
          }
        );
    in
    {
      packages = forEachSystem (args: import ./nix/packages.nix args);
      devShells = forEachSystem (args: import ./nix/shells.nix args);
      checks = forEachSystem (args: import ./nix/checks.nix args);
      apps = forEachSystem (
        { system, ... }:
        rec {
          mantis = {
            type = "app";
            program = "${self.packages.${system}.mantis}/bin/mantis";
          };
          default = mantis;
        }
      );
    };
}
