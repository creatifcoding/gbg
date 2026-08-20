# Thin wrapper only — dependency universe is the gbg root flake.lock.
# Prefer from repo root:
#   nix develop .#mantis-core
#   nix run .#mantis -- doctor
#
# This nested flake re-exports mantis-* outputs via a path input to the root
# so `direnv use flake` inside the lab directory does not pin a second nixpkgs.
{
  description = "Mantis lab thin wrapper (root flake-parts owns shells/apps)";

  inputs.gbg.url = "path:../../../..";

  outputs =
    { gbg, ... }:
    {
      inherit (gbg)
        packages
        apps
        checks
        formatter
        ;
      # Re-export mantis shells; default -> mantis-core (not mantis-all).
      devShells = builtins.mapAttrs (
        _system: shells:
        {
          default = shells.mantis-core or shells.default;
          mantis-core = shells.mantis-core;
          mantis-ee = shells.mantis-ee;
          mantis-cad = shells.mantis-cad;
          mantis-sim = shells.mantis-sim;
          mantis-review = shells.mantis-review;
          mantis-all = shells.mantis-all;
          # Back-compat alias for older docs that mentioned .#fabrication.
          fabrication = shells.mantis-all;
        }
        // shells
      ) gbg.devShells;
    };
}
