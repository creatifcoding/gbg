{ inputs, lib, ... }:

{
  imports = [
    ./modules/core.nix
    ./modules/python.nix
    ./modules/sdr.nix
    ./modules/default.nix
  ];
}
