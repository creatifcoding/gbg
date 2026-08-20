# Mantis lab engineering runtime (issue #21 / mantis-00a-runtime).
# Shells and apps live on the gbg root flake; nested lab flake is a thin re-export.
{ inputs, ... }:

{
  perSystem =
    {
      pkgs,
      lib,
      system,
      self',
      ...
    }:
    let
      inherit (pkgs.stdenv) isLinux;

      mantisLabRel = "projects/biomemetics/labs/mantis";

      pythonCore = pkgs.python3.withPackages (
        ps: with ps; [
          jsonschema
          numpy
          pyyaml
          pypdf
          pytest
          scipy
        ]
      );

      pythonCad = pkgs.python3.withPackages (
        ps: with ps; [
          jsonschema
          numpy
          pyyaml
          pypdf
          pytest
          scipy
          pythonocc-core
        ]
      );

      pythonSim = pkgs.python3.withPackages (
        ps: with ps; [
          jsonschema
          numpy
          pyyaml
          pypdf
          pytest
          scipy
          scikit-rf
          meshio
          gmsh
        ]
      );

      pythonAll = pkgs.python3.withPackages (
        ps: with ps; [
          jsonschema
          numpy
          pyyaml
          pypdf
          pytest
          scipy
          pythonocc-core
          scikit-rf
          meshio
          gmsh
        ]
      );

      baseTools = with pkgs; [
        nodejs_24
        bun
        typescript
        cargo
        rustc
        rustfmt
        clippy
        jq
        git
        ripgrep
        coreutils
        findutils
        gnused
        gawk
        bashInteractive
      ];

      eeLinux = lib.optionals isLinux (
        with pkgs;
        [
          kicad
          ngspice
          poppler_utils
        ]
      );

      cadLinux = lib.optionals isLinux (
        with pkgs;
        [
          freecad
          openscad
          inkscape
          blender
          opencascade-occt
        ]
      );

      simLinux = lib.optionals isLinux (
        with pkgs;
        [
          gmsh
          calculix
          # openEMS intentionally omitted until a headless smoke test qualifies it.
        ]
      );

      reviewLinux = lib.optionals isLinux (
        with pkgs;
        [
          poppler_utils
          freecad
          openscad
          inkscape
        ]
      );

      # Worktree-local mutable paths — never share cargo/solver/result dirs across checkouts.
      worktreeShellHook = ''
        _mantis_git_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
        export MANTIS_GBG_ROOT="$_mantis_git_root"
        export MANTIS_LAB_ROOT="$_mantis_git_root/${mantisLabRel}"
        _wt_key="$(printf '%s' "$_mantis_git_root" | ${pkgs.coreutils}/bin/sha256sum | ${pkgs.coreutils}/bin/cut -c1-16)"
        export MANTIS_WORKTREE_ID="$_wt_key"
        export MANTIS_STATE_DIR="$_mantis_git_root/.worktree-state/mantis-$_wt_key"
        export MANTIS_BUILD_DIR="$MANTIS_STATE_DIR/build"
        export CARGO_TARGET_DIR="$MANTIS_STATE_DIR/cargo-target"
        export MANTIS_SOLVER_TEMP="$MANTIS_STATE_DIR/solver-temp"
        export MANTIS_RESULT_DIR="$MANTIS_STATE_DIR/results"
        mkdir -p "$MANTIS_BUILD_DIR" "$CARGO_TARGET_DIR" "$MANTIS_SOLVER_TEMP" "$MANTIS_RESULT_DIR"
        export PYTHONPATH="$MANTIS_LAB_ROOT/tooling/python/mantis-lab/src''${PYTHONPATH:+:$PYTHONPATH}"
        export PATH="$MANTIS_LAB_ROOT/scripts/environment:$PATH"
        if [ -x "$_mantis_git_root/node_modules/.bin/nx" ]; then
          export PATH="$_mantis_git_root/node_modules/.bin:$PATH"
        fi
        unset _mantis_git_root _wt_key
      '';

      mkMantisShell =
        {
          name,
          packages,
          extraHook ? "",
        }:
        pkgs.mkShell {
          inherit name packages;
          shellHook = ''
            ${worktreeShellHook}
            export MANTIS_SHELL="${name}"
            ${extraHook}
            echo "[${name}] MANTIS_LAB_ROOT=$MANTIS_LAB_ROOT"
            echo "[${name}] state=$MANTIS_STATE_DIR"
            echo "[${name}] run: mantis doctor | mantis check <id> | mantis export <domain> | mantis evidence <run>"
          '';
        };

      mantis = pkgs.writeShellApplication {
        name = "mantis";
        runtimeInputs = with pkgs; [
          bashInteractive
          coreutils
          findutils
          git
          jq
          pythonCore
        ];
        text = ''
          set -euo pipefail
          root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
          lab="$root/${mantisLabRel}"
          cli="$lab/scripts/environment/mantis"
          if [ ! -x "$cli" ]; then
            echo "BLOCKED: missing $cli (workstream mantis-00a-runtime / issue #21)" >&2
            exit 69
          fi
          export MANTIS_GBG_ROOT="$root"
          export MANTIS_LAB_ROOT="$lab"
          exec "$cli" "$@"
        '';
      };
    in
    {
      packages.mantis = mantis;

      apps.mantis = {
        type = "app";
        program = "${self'.packages.mantis}/bin/mantis";
        meta.description = "Mantis lab command surface (doctor / check / export / evidence)";
      };

      devShells.mantis-core = mkMantisShell {
        name = "mantis-core";
        packages = baseTools ++ [ pythonCore ];
      };

      devShells.mantis-ee = mkMantisShell {
        name = "mantis-ee";
        packages = baseTools ++ [ pythonCore ] ++ eeLinux;
      };

      devShells.mantis-cad = mkMantisShell {
        name = "mantis-cad";
        packages = baseTools ++ [ pythonCad ] ++ cadLinux;
      };

      devShells.mantis-sim = mkMantisShell {
        name = "mantis-sim";
        packages = baseTools ++ [ pythonSim ] ++ simLinux ++ eeLinux;
      };

      devShells.mantis-review = mkMantisShell {
        name = "mantis-review";
        packages = baseTools ++ [ pythonCore ] ++ reviewLinux;
      };

      # Local integration only — not the default cloud-worker shell.
      devShells.mantis-all = mkMantisShell {
        name = "mantis-all";
        packages = baseTools ++ [ pythonAll ] ++ eeLinux ++ cadLinux ++ simLinux ++ reviewLinux;
        extraHook = ''
          echo "[mantis-all] local integration shell — prefer scoped shells for cloud workers"
        '';
      };

      checks.mantis-shells-evaluate = pkgs.runCommand "mantis-shells-evaluate" { } ''
        echo "mantis-core=${self'.devShells.mantis-core}" > $out
        echo "mantis-ee=${self'.devShells.mantis-ee}" >> $out
        echo "mantis-cad=${self'.devShells.mantis-cad}" >> $out
        echo "mantis-sim=${self'.devShells.mantis-sim}" >> $out
        echo "mantis-review=${self'.devShells.mantis-review}" >> $out
        echo "mantis-all=${self'.devShells.mantis-all}" >> $out
        echo "mantis=${self'.packages.mantis}" >> $out
      '';
    };
}
