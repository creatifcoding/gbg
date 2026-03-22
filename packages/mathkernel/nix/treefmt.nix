{ inputs, ... }:

{
  imports = [ inputs.treefmt-nix.flakeModule ];

  perSystem =
    { pkgs, ... }:
    {
      treefmt.config = {
        projectRootFile = "flake.nix";

        programs = {
          # C++ formatting
          clang-format = {
            enable = true;
            # Uses .clang-format in project root
          };

          # Nix formatting
          nixfmt = {
            enable = true;
            package = pkgs.nixfmt-rfc-style;
          };

          # TypeScript/JSON formatting (for tests + config)
          prettier = {
            enable = true;
          };
        };
      };
    };
}
