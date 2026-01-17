{
  lib,
  stdenv,
  bun,
  cacert,
  makeBinaryWrapper,
}:

# CTL Package - Two-derivation FOD pattern for Bun
#
# Installation:
#   nix build                       # Builds standalone binary
#   nix profile install .           # Installs to ~/.nix-profile/bin/ctl
#
# To update node_modules hash after dependency changes:
#   nix build 2>&1 | grep "got:" | awk '{print $2}'

let
  src = ./..;
  version = "0.1.0";

  # Fixed-Output Derivation for node_modules (gets network access)
  node_modules = stdenv.mkDerivation {
    pname = "ctl-node_modules";
    inherit version src;

    nativeBuildInputs = [ bun ];

    dontConfigure = true;
    dontFixup = true;

    impureEnvVars = lib.fetchers.proxyImpureEnvVars ++ [
      "GIT_PROXY_COMMAND"
      "SOCKS_SERVER"
    ];

    buildPhase = ''
      runHook preBuild

      export HOME=$(mktemp -d)
      bun install --no-progress --frozen-lockfile

      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall

      mkdir -p $out
      cp -r node_modules $out/

      runHook postInstall
    '';

    # Fixed-output derivation settings
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-wfDxLXpblh90xu8B2YGwbxC/an5Eo85ooGjn1aBxSMU=";
  };

in
stdenv.mkDerivation {
  pname = "ctl";
  inherit version src;

  nativeBuildInputs = [
    bun
    makeBinaryWrapper
  ];

  dontConfigure = true;
  dontFixup = true;

  buildPhase = ''
    runHook preBuild

    export HOME=$(mktemp -d)

    # Link pre-fetched node_modules
    ln -s ${node_modules}/node_modules ./node_modules

    # Compile standalone binary
    bun build --compile --minify src/cli/index.ts --outfile ctl

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    cp ctl $out/bin/ctl
    chmod +x $out/bin/ctl

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
