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
      # Development shell
      devshells.default = {
        name = "spikectl";

        packages = with pkgs; [
          # JavaScript/TypeScript runtime
          bun
          nodejs_22

          # SQLite (for pattern store)
          sqlite

          # Development tools
          jq

          # Git
          git
        ];

        env = [
          {
            name = "SPIKECTL_DEV";
            value = "1";
          }
        ];

        commands = [
          {
            name = "spikectl";
            command = "bun run src/index.ts $@";
            help = "Run spikectl in development mode";
            category = "spikectl";
          }
          {
            name = "spikectl:compile";
            command = "bun run compile";
            help = "Compile standalone binary";
            category = "spikectl";
          }
          {
            name = "spikectl:typecheck";
            command = "bun run typecheck";
            help = "Type check the codebase";
            category = "spikectl";
          }
          {
            name = "spikectl:test";
            command = "bun run test:run";
            help = "Run tests";
            category = "spikectl";
          }
        ];

        devshell.startup.deps = {
          text = ''
            echo ""
            echo "╔══════════════════════════════════════════════════════════════╗"
            echo "║  spikectl - Hypothesis-driven debugging                      ║"
            echo "║  Autopoietic learning • H1-H4 isolation • SQLite pattern DB  ║"
            echo "╚══════════════════════════════════════════════════════════════╝"
            echo ""
            echo "Quick commands:"
            echo "  spikectl           - Run CLI in dev mode"
            echo "  spikectl:compile   - Build standalone binary"
            echo "  spikectl:test      - Run tests"
            echo ""
            echo "Workflow:"
            echo "  spikectl suggest \"<error>\"  - Get hypothesis templates"
            echo "  spikectl init <name>         - Create spike config"
            echo "  spikectl new <name>          - Generate spike file"
            echo "  spikectl run <file>          - Execute spike"
            echo "  spikectl learn <file> --fix  - Record learning"
            echo "  spikectl stats               - View pattern statistics"
            echo ""

            # Install deps if node_modules missing
            if [ ! -d "node_modules" ]; then
              echo "[spikectl] Installing dependencies..."
              bun install
            fi
          '';
        };
      };

      # Expose the package
      packages.spikectl = config.packages.default;
    };
}
