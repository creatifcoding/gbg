{ inputs, ... }:

{
  imports = [
    ./devshell.nix
    ./packages.nix
    ./treefmt.nix
  ];
}
