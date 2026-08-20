{
  pkgs,
  lib,
  self,
  system,
}:

let
  tools = import ./tools.nix { inherit pkgs lib; };
  stub =
    name: issue:
    pkgs.writeShellApplication {
      inherit name;
      text = ''
        echo "NOT_IMPLEMENTED: ${name} (owning issue #${issue})" >&2
        exit 78
      '';
    };
  mantis = pkgs.callPackage ./mantis-cli.nix { };
in
{
  inherit mantis;
  default = mantis;

  # Honest stubs: building them does not exercise a product workflow.
  # Running them prints NOT_IMPLEMENTED and exits 78 (EX_CONFIG).
  mantis-assistant-web = stub "mantis-assistant-web" "50";
  mantis-assistant-server = stub "mantis-assistant-server" "50";
  mantis-edge = stub "mantis-edge" "54";
}
