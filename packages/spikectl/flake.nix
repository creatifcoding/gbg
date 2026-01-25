{
  description = "spikectl - Hypothesis-driven debugging CLI with autopoietic learning";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        spikectl = pkgs.callPackage ./nix/package.nix { };
      in
      {
        packages = {
          default = spikectl;
          spikectl = spikectl;
        };

        apps.default = {
          type = "app";
          program = "${spikectl}/bin/spikectl";
        };

        devShells.default = pkgs.mkShell {
          name = "spikectl-dev";

          packages = with pkgs; [
            bun
            nodejs_22
            sqlite
            git
            jq
          ];

          shellHook = ''
            echo ""
            echo "╔══════════════════════════════════════════════════════════════╗"
            echo "║  spikectl - Hypothesis-driven debugging                      ║"
            echo "║  Built on @gbg/ctl • SQLite pattern store • H1-H4 isolation  ║"
            echo "╚══════════════════════════════════════════════════════════════╝"
            echo ""
            echo "Commands:"
            echo "  bun run dev              - Run spikectl in dev mode"
            echo "  bun run compile          - Compile standalone binary"
            echo ""
            echo "Workflow:"
            echo "  spikectl suggest \"<error>\"  - Get hypothesis templates"
            echo "  spikectl init <name>         - Create spike config"
            echo "  spikectl new <name>          - Generate spike file"
            echo "  spikectl run <file>          - Execute spike"
            echo "  spikectl learn --fix <file>  - Record learning"
            echo "  spikectl stats               - View pattern statistics"
            echo ""

            if [ ! -d "node_modules" ]; then
              echo "[spikectl] Installing dependencies..."
              bun install
            fi
          '';
        };
      }
    );
}
