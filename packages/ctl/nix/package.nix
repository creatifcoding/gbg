{
  lib,
  stdenv,
}:

# CTL Package
#
# Prerequisites: Run `bun run compile` first to create bin/ctl
#
# Installation:
#   cd packages/ctl
#   bun install && bun run compile  # Creates bin/ctl
#   nix build                       # Creates result/bin/ctl
#   nix profile install .           # Installs to ~/.nix-profile/bin/ctl
#
# Machine-wide (requires root):
#   sudo nix profile install . --profile /nix/var/nix/profiles/default

stdenv.mkDerivation {
  pname = "ctl";
  version = "0.1.0";

  # Use the local source directory
  src = ./..;

  # No build phase - we use the pre-compiled binary
  dontBuild = true;
  dontConfigure = true;
  dontFixup = true;

  installPhase = ''
    runHook preInstall

    # Install the pre-compiled binary
    mkdir -p $out/bin
    if [ -f bin/ctl ]; then
      cp bin/ctl $out/bin/ctl
      chmod +x $out/bin/ctl
    else
      echo "ERROR: bin/ctl not found. Run 'bun run compile' first." >&2
      exit 1
    fi

    runHook postInstall
  '';

  meta = with lib; {
    description = "Effect CLI framework with skill-driven development, agent-guiding errors, and SQLite persistence";
    homepage = "https://github.com/gbg/gbg/tree/main/packages/ctl";
    license = licenses.mit;
    mainProgram = "ctl";
    platforms = platforms.all;
  };
}
