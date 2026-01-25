{
  lib,
  stdenv,
  bun,
  cacert,
  makeBinaryWrapper,
}:

# spikectl Package - Two-derivation FOD pattern for Bun
#
# NOTE: This package depends on @gbg/ctl via workspace:*
# For standalone builds, build from monorepo root or use pre-compiled binary.
#
# Installation:
#   nix build                       # Builds standalone binary
#   nix profile install .           # Installs to ~/.nix-profile/bin/spikectl
#
# To update node_modules hash after dependency changes:
#   nix build 2>&1 | grep "got:" | awk '{print $2}'

let
  # Use parent directory as source to include both packages
  src = ../../..;
  version = "0.1.0";

  # Fixed-Output Derivation for node_modules (gets network access)
  node_modules = stdenv.mkDerivation {
    pname = "spikectl-node_modules";
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

      # Install from monorepo root to resolve workspace deps
      # Note: --ignore-scripts avoids native dep build failures in sandbox
      bun install --no-progress --ignore-scripts

      # Build @gbg/ctl (workspace dep for spikectl)
      cd packages/ctl
      bun run build
      cd ../..

      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall

      mkdir -p $out

      # Copy node_modules from root (preserving structure)
      cp -r node_modules $out/

      # Copy packages directory structure
      mkdir -p $out/packages
      cp -r packages/spikectl $out/packages/
      cp -r packages/ctl $out/packages/

      # Workspace packages are symlinks - resolve them to actual dirs
      # spikectl has @gbg/ctl as workspace dep
      if [ -L "$out/packages/spikectl/node_modules/@gbg/ctl" ]; then
        rm -f $out/packages/spikectl/node_modules/@gbg/ctl
        cp -r packages/ctl $out/packages/spikectl/node_modules/@gbg/ctl
      fi

      runHook postInstall
    '';

    # Fixed-output derivation settings
    # NOTE: Update this hash after dependency changes using:
    #   nix build 2>&1 | grep "got:" | awk '{print $2}'
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
  };

in
stdenv.mkDerivation {
  pname = "spikectl";
  inherit version;

  # Use FOD as source (has node_modules + packages with resolved workspace deps)
  src = node_modules;

  nativeBuildInputs = [
    bun
    makeBinaryWrapper
  ];

  dontConfigure = true;
  dontUnpack = true;
  dontFixup = true;

  buildPhase = ''
    runHook preBuild

    export HOME=$(mktemp -d)

    # Build from FOD's spikectl package
    cd $src/packages/spikectl

    # Compile standalone binary
    bun build --compile --minify src/index.ts --outfile $TMPDIR/spikectl

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/bin
    cp $TMPDIR/spikectl $out/bin/spikectl
    chmod +x $out/bin/spikectl

    runHook postInstall
  '';

  meta = with lib; {
    description = "Hypothesis-driven debugging CLI with autopoietic learning";
    homepage = "https://github.com/gbg/gbg/tree/main/packages/spikectl";
    license = licenses.mit;
    mainProgram = "spikectl";
    platforms = platforms.all;
  };
}
