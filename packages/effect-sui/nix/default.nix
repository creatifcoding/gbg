{ inputs, lib, ... }:

{
  imports = [
    ./modules/core.nix
    ./modules/sui.nix
    ./modules/localnet.nix
    ./modules/move.nix
    ./modules/default.nix
    ./modules/tests.nix
  ];
}
