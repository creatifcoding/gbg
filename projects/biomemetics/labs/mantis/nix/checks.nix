{
  pkgs,
  lib,
  self,
  system,
}:

let
  mantis = self.packages.${system}.mantis;
  tools = import ./tools.nix { inherit pkgs lib; };

  labFileset = lib.fileset.unions [
    ../scripts/environment
    ../scripts/validate-contracts.py
    ../evidence/runs/environment
    ../contracts
    ../workspace.json
    ../flake.nix
    ../flake.lock
    ../.envrc
    ../terrarium/params.json
    ../terrarium/bus.json
    ../terrarium/contracts/bus.schema.json
  ];

  labSrc = lib.fileset.toSource {
    root = ../.;
    fileset = labFileset;
  };
in
{
  mantis-command-surface = pkgs.runCommand "mantis-command-surface" {
    nativeBuildInputs = [
      mantis
      tools.pythonCore
      pkgs.nodejs_22
      pkgs.rustc
      pkgs.jq
      pkgs.git
      pkgs.coreutils
    ];
  } ''
    set -euo pipefail
    export HOME="$TMPDIR/home"
    mkdir -p "$HOME"
    cp -r ${labSrc} "$TMPDIR/lab"
    chmod -R u+w "$TMPDIR/lab"
    cd "$TMPDIR/lab"
    export MANTIS_LAB_ROOT="$PWD"
    export MANTIS_ISOLATION_ROOT="$TMPDIR/iso"
    export MANTIS_SHELL=mantis-core
    export MANTIS_RUN_ID=flake-check

    mantis --help > "$TMPDIR/help.txt"
    grep -q "mantis doctor" "$TMPDIR/help.txt"
    grep -q "mantis check" "$TMPDIR/help.txt"
    grep -q "mantis export" "$TMPDIR/help.txt"
    grep -q "mantis evidence" "$TMPDIR/help.txt"

    mantis doctor --output "$TMPDIR/iso/result/doctor-report.json"
    test -f "$TMPDIR/iso/result/doctor-report.json"
    mantis evidence "$TMPDIR/iso/result/doctor-report.json"

    mkdir -p "$out"
    cp "$TMPDIR/iso/result/doctor-report.json" "$out/doctor-report.json"
    cp "$TMPDIR/help.txt" "$out/help.txt"
  '';

  # Building a stub must not be treated as a product workflow pass.
  # The derivation succeeds because it only installs the failing entrypoint.
  mantis-assistant-web-stub-is-honest =
    pkgs.runCommand "mantis-assistant-web-stub-is-honest"
      { nativeBuildInputs = [ self.packages.${system}.mantis-assistant-web ]; }
      ''
        set +e
        mantis-assistant-web >"$TMPDIR/out" 2>"$TMPDIR/err"
        status=$?
        set -e
        test "$status" -eq 78
        grep -q NOT_IMPLEMENTED "$TMPDIR/err"
        mkdir -p "$out"
        cp "$TMPDIR/err" "$out/stderr.txt"
      '';
}
