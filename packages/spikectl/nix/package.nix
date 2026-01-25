{
  lib,
  stdenv,
  makeWrapper,
}:

# spikectl Package - Wraps pre-compiled Bun binary
#
# The binary is compiled via `bun build --compile` which bundles all dependencies.
# This Nix package just wraps that binary for distribution.
#
# To rebuild the binary:
#   cd packages/spikectl && bun run compile
#
# Installation:
#   nix profile install .

stdenv.mkDerivation {
  pname = "spikectl";
  version = "0.1.0";

  # Use the pre-compiled binary from the bin directory
  src = ../bin;

  nativeBuildInputs = [ makeWrapper ];

  dontBuild = true;
  dontConfigure = true;
  dontFixup = true;

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    cp spikectl $out/bin/spikectl
    chmod +x $out/bin/spikectl

    runHook postInstall
  '';

  meta = with lib; {
    description = "Hypothesis-driven debugging CLI with autopoietic learning";
    homepage = "https://github.com/gbg/gbg/tree/main/packages/spikectl";
    license = licenses.mit;
    mainProgram = "spikectl";
    platforms = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
  };
}
