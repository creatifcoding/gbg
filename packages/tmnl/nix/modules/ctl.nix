{ inputs, lib, ... }:

{
  perSystem =
    {
      config,
      pkgs,
      system,
      ...
    }:
    {
      # Re-export packages from sibling flakes
      packages = {
        ctl = inputs.ctl.packages.${system}.default;
        # DEPRECATED: spikectl removed from active configuration
        # spikectl = inputs.spikectl.packages.${system}.default;
      };

      # Add CLI tools to devshell
      devShells.tmnl-ctl = pkgs.mkShell {
        name = "tmnl-ctl";

        packages = [
          inputs.ctl.packages.${system}.default
          # DEPRECATED: spikectl removed
          # inputs.spikectl.packages.${system}.default
        ];

        shellHook = ''
          echo "[tmnl-ctl] CLI tools available:"
          echo "  ctl      - Effect CLI framework"
        '';
      };
    };
}
