{
  lib,
  bun,
  writeShellApplication,
  stdenv,
}:

# CTL Package
#
# Installation methods:
#   1. nix profile install .#default  - Installs wrapper (requires CTL source)
#   2. nix develop -c bun run compile - Builds standalone binary to bin/ctl
#   3. ./setup.sh                     - Auto-detects best method
#
# For standalone binary distribution:
#   nix develop -c bash -c 'bun install && bun run compile'
#   # Then distribute bin/ctl

writeShellApplication {
  name = "ctl";

  runtimeInputs = [ bun ];

  text = ''
    # CTL wrapper script
    # Prefers compiled binary, falls back to source execution

    # Check for CTL_DIR or detect from script location / cwd
    if [ -n "''${CTL_DIR:-}" ]; then
      CTL_ROOT="$CTL_DIR"
    elif [ -f "$(dirname "$0")/../share/ctl/bin/ctl" ]; then
      # Installed via nix with binary
      exec "$(dirname "$0")/../share/ctl/bin/ctl" "$@"
    elif [ -f "./bin/ctl" ]; then
      # In source directory with compiled binary
      exec ./bin/ctl "$@"
    elif [ -f "./package.json" ] && grep -q '"@gbg/ctl"' ./package.json 2>/dev/null; then
      CTL_ROOT="$(pwd)"
    else
      echo "Error: Cannot find CTL installation." >&2
      echo "Set CTL_DIR or run from packages/ctl directory." >&2
      exit 1
    fi

    cd "$CTL_ROOT"

    # Prefer compiled binary
    if [ -x "./bin/ctl" ]; then
      exec ./bin/ctl "$@"
    fi

    # Fall back to source execution
    if [ ! -d "node_modules" ]; then
      echo "[ctl] Installing dependencies..." >&2
      bun install --frozen-lockfile
    fi

    if [ ! -d "dist" ]; then
      echo "[ctl] Building..." >&2
      bun run build
    fi

    exec bun run dist/cli/index.js "$@"
  '';

  meta = with lib; {
    description = "Effect CLI framework with skill-driven development, agent-guiding errors, and SQLite persistence";
    homepage = "https://github.com/gbg/gbg/tree/main/packages/ctl";
    license = licenses.mit;
    mainProgram = "ctl";
  };
}
