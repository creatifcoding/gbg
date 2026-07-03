{ inputs, ... }:

{
  imports = [
    ./devshell.nix
    ../packages/limitlessrp/nix
  ];
}
