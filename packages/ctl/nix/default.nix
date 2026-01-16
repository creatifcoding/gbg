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
        name = "ctl";

        packages = with pkgs; [
          # JavaScript/TypeScript runtime
          bun
          nodejs_22

          # SQLite (for persistence module)
          sqlite

          # Development tools
          just
          jq

          # Git
          git
        ];

        env = [
          {
            name = "CTL_DEV";
            value = "1";
          }
        ];

        commands = [
          {
            name = "ctl";
            command = "bun run src/cli/index.ts $@";
            help = "Run the CTL CLI in development mode";
            category = "ctl";
          }
          {
            name = "ctl:build";
            command = "bun run build";
            help = "Build the CTL package";
            category = "ctl";
          }
          {
            name = "ctl:test";
            command = "bun run test:all";
            help = "Run all tests (vitest + bun)";
            category = "ctl";
          }
          {
            name = "ctl:test:vitest";
            command = "bun run test:run";
            help = "Run vitest tests";
            category = "ctl";
          }
          {
            name = "ctl:test:bun";
            command = "bun run test:bun";
            help = "Run bun tests (persistence)";
            category = "ctl";
          }
          {
            name = "ctl:typecheck";
            command = "bun run typecheck";
            help = "Type check the codebase";
            category = "ctl";
          }
        ];

        devshell.startup.deps = {
          text = ''
            echo ""
            echo "╔══════════════════════════════════════════════════════════════╗"
            echo "║  @gbg/ctl - Effect CLI Framework                             ║"
            echo "║  Skill-driven development • Agent-guiding errors • SQLite    ║"
            echo "╚══════════════════════════════════════════════════════════════╝"
            echo ""
            echo "Quick commands:"
            echo "  ctl           - Run CLI in dev mode"
            echo "  ctl:build     - Build package"
            echo "  ctl:test      - Run all tests"
            echo ""

            # Install deps if node_modules missing
            if [ ! -d "node_modules" ]; then
              echo "[ctl] Installing dependencies..."
              bun install
            fi
          '';
        };
      };

      # Expose the package
      packages.ctl = config.packages.default;
    };
}
