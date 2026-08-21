{
  pkgs,
  lib,
  self,
  system,
}:

let
  tools = import ./tools.nix { inherit pkgs lib; };
  mantis = self.packages.${system}.mantis;

  mkMantisShell =
    {
      name,
      extraPackages,
      description,
    }:
    pkgs.mkShell {
      inherit name;
      packages = extraPackages ++ [ mantis ];
      MANTIS_SHELL = name;
      MANTIS_SHELL_DESCRIPTION = description;
      MANTIS_UNSUPPORTED_TOOLS = tools.unsupportedCsv;
      MANTIS_OPENEMS_QUALIFIED = "0";
      PYTHONNOUSERSITE = "1";
      PIP_NO_INDEX = "1";
      shellHook = ''
        is_mantis_lab_root() {
          [[ -f "$1/workspace.json" && -f "$1/flake.nix" ]]
        }
        find_mantis_lab_root() {
          local dir
          dir="$(pwd)"
          while true; do
            if is_mantis_lab_root "$dir"; then
              printf '%s\n' "$dir"
              return 0
            fi
            if is_mantis_lab_root "$dir/projects/biomemetics/labs/mantis"; then
              printf '%s\n' "$dir/projects/biomemetics/labs/mantis"
              return 0
            fi
            if [[ "$dir" == "/" ]]; then
              return 1
            fi
            dir="$(dirname "$dir")"
          done
        }
        if [[ -z "''${MANTIS_LAB_ROOT:-}" ]] || ! is_mantis_lab_root "$MANTIS_LAB_ROOT"; then
          if found="$(find_mantis_lab_root)"; then
            export MANTIS_LAB_ROOT="$found"
          else
            export MANTIS_LAB_ROOT="''${MANTIS_LAB_ROOT:-$PWD}"
          fi
        fi
        if [[ -f "$MANTIS_LAB_ROOT/scripts/environment/isolation.sh" ]]; then
          # shellcheck source=/dev/null
          source "$MANTIS_LAB_ROOT/scripts/environment/isolation.sh"
        fi
      '';
    };

  shells = {
    mantis-core = mkMantisShell {
    name = "mantis-core";
    extraPackages = tools.corePackages;
    description = "Python/JSON Schema, Bun/Node/TypeScript, Rust, jq, rg";
  };

  mantis-ee = mkMantisShell {
    name = "mantis-ee";
    extraPackages = tools.corePackages ++ tools.eeExtra;
    description = "KiCad CLI, ngspice, fabrication/export inspection";
  };

  mantis-cad = mkMantisShell {
    name = "mantis-cad";
    extraPackages = tools.coreCli ++ tools.rustTools ++ tools.cadExtra ++ [ tools.pythonCad ];
    description = "FreeCADCmd/OCCT, OpenSCAD, Python BRep, Inkscape";
  };

  mantis-sim = mkMantisShell {
    name = "mantis-sim";
    extraPackages = tools.coreCli ++ tools.simExtra;
    description = "scikit-rf/Touchstone, Gmsh, CalculiX; openEMS omitted until qualified";
  };

  mantis-review = mkMantisShell {
    name = "mantis-review";
    extraPackages = tools.coreCli ++ tools.reviewExtra;
    description = "Neutral re-import and PDF/SVG/STEP/manifest inspection";
  };

  mantis-assistant = mkMantisShell {
    name = "mantis-assistant";
    extraPackages = tools.coreCli ++ tools.assistantExtra ++ tools.rustTools;
    description = "TypeScript runtime for Mastra/CopilotKit/Effect work; no live credentials";
  };

  mantis-assistant-eval = mkMantisShell {
    name = "mantis-assistant-eval";
    extraPackages = tools.coreCli ++ tools.assistantEvalExtra ++ [ tools.pythonCore ];
    description = "Assistant compatibility/eval/browser fixtures without live device credentials";
  };

  mantis-edge = mkMantisShell {
    name = "mantis-edge";
    extraPackages = tools.coreCli ++ tools.edgeExtra ++ [ tools.pythonCore ];
    description = "Rust edge/simulator and protocol tooling; no live-hardware default";
  };

  mantis-analysis = mkMantisShell {
    name = "mantis-analysis";
    extraPackages = tools.analysisExtra ++ [ mantis ];
    description = "Python media/data analysis with no device-write capability";
  };

  mantis-fabrication = mkMantisShell {
    name = "mantis-fabrication";
    extraPackages = tools.coreCli ++ tools.fabricationExtra;
    description = "Deterministic export/render checks";
  };

  # Local integration only. Never the default cloud-worker shell.
  mantis-all = mkMantisShell {
    name = "mantis-all";
    extraPackages = lib.unique (
      tools.corePackages
      ++ tools.eeExtra
      ++ tools.cadExtra
      ++ tools.simExtra
      ++ tools.reviewExtra
      ++ tools.assistantExtra
      ++ tools.assistantEvalExtra
      ++ tools.edgeExtra
      ++ tools.analysisExtra
      ++ tools.fabricationExtra
    );
    description = "Union of narrow shells; local integration only";
  };
  };
in
shells
// {
  default = shells.mantis-core;
}
