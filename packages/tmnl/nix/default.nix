{ inputs, lib, ... }:

{
  imports = [
    ./modules/core.nix
    ./modules/rust.nix
    ./modules/python.nix
    ./modules/embedded.nix
    ./modules/ui.nix
  ];
}
