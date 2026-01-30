{
  lib,
  stdenv,
  bun,
  nodejs,
  python3,
  pkg-config,
  makeBinaryWrapper,
}:

# spikectl Package - Two-derivation FOD pattern for Bun
#
# Builds spikectl from source using the same pattern as @gbg/ctl.
# Handles workspace dependencies by building from monorepo context.
#
# Installation:
#   nix build                       # Builds standalone binary
#   nix profile install .           # Installs to ~/.nix-profile/bin/spikectl
#
# To update node_modules hash after dependency changes:
#   nix build 2>&1 | grep "got:" | awk '{print $2}'

let
  version = "0.1.0";

  # Monorepo root for workspace dependency resolution
  # Path from packages/spikectl/nix/ → monorepo root (3 levels up)
  monorepoRoot = ./../../..;

  # Fixed-Output Derivation for node_modules (gets network access)
  node_modules = stdenv.mkDerivation {
    pname = "spikectl-node_modules";
    inherit version;

    # Use monorepo root to resolve workspace:* dependencies
    src = monorepoRoot;

    nativeBuildInputs = [
      bun
      nodejs
      python3
      pkg-config
    ];

    dontConfigure = true;
    dontFixup = true;

    impureEnvVars = lib.fetchers.proxyImpureEnvVars ++ [
      "GIT_PROXY_COMMAND"
      "SOCKS_SERVER"
    ];

    buildPhase = ''
      runHook preBuild

      export HOME=$(mktemp -d)

      # Install from monorepo root (resolves workspace:* deps)
      # Use --ignore-scripts to skip native compilation (node-pty etc)
      # since bun compile bundles everything and doesn't need native addons
      bun install --no-progress --frozen-lockfile --ignore-scripts

      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall

      mkdir -p $out

      # Use root node_modules which has everything resolved
      cp -r node_modules $out/

      # Also preserve workspace package node_modules (bun doesn't hoist everything)
      mkdir -p $out/packages/ctl
      if [ -d packages/ctl/node_modules ]; then
        cp -r packages/ctl/node_modules $out/packages/ctl/
      fi

      runHook postInstall
    '';

    # Fixed-output derivation settings
    # Run `nix build 2>&1 | grep "got:"` to get updated hash
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    outputHash = "sha256-na679ImaN5HsBu2wXencLyxkvGScYIxp0iSSif1M/ac=";
  };

in
stdenv.mkDerivation {
  pname = "spikectl";
  inherit version;

  # Use MONOREPO as source so workspace deps resolve correctly
  src = monorepoRoot;

  nativeBuildInputs = [
    bun
    nodejs  # For tsc
    makeBinaryWrapper
  ];

  dontConfigure = true;
  dontFixup = true;

  buildPhase = ''
    runHook preBuild

    export HOME=$(mktemp -d)

    # Copy node_modules with write permissions (FOD output is read-only)
    cp -r --no-preserve=mode ${node_modules}/node_modules ./node_modules
    chmod -R u+w node_modules
    # Restore execute permissions on binaries
    chmod +x node_modules/.bin/* 2>/dev/null || true

    # Recreate workspace symlink for @gbg/ctl at ROOT level
    mkdir -p node_modules/@gbg
    rm -rf node_modules/@gbg/ctl
    ln -s ../../packages/ctl node_modules/@gbg/ctl

    # ALSO create symlink in spikectl's local node_modules
    # Bun looks here first when running from package directory
    mkdir -p packages/spikectl/node_modules/@gbg
    ln -s ../../../ctl packages/spikectl/node_modules/@gbg/ctl

    # Restore ctl's local node_modules (bun doesn't hoist @opentui)
    if [ -d ${node_modules}/packages/ctl/node_modules ]; then
      cp -r --no-preserve=mode ${node_modules}/packages/ctl/node_modules packages/ctl/
      chmod -R u+w packages/ctl/node_modules
    fi

    # Build ctl first (produces dist/ that package.json exports reference)
    echo "Building @gbg/ctl..."
    cd packages/ctl
    # Call tsc through node (shebang uses /usr/bin/env which doesn't exist in Nix)
    ${nodejs}/bin/node ../../node_modules/typescript/bin/tsc
    cd ../..

    # Debug: verify ctl dist exists
    echo "ctl dist contents:"
    ls -la packages/ctl/dist/ | head -5

    # Compile spikectl from the packages directory
    cd packages/spikectl
    bun build --compile --minify src/index.ts --outfile spikectl

    runHook postBuild
  '';

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
    platforms = platforms.all;
  };
}
