#!/usr/bin/env bash
set -euo pipefail

workspace_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$workspace_dir"

required=(openscad FreeCADCmd kicad-cli blender inkscape ngspice gmsh ccx)
missing=()
for tool in "${required[@]}"; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    missing+=("$tool")
  fi
done

if ((${#missing[@]})); then
  printf 'BLOCKED: fabrication toolchain missing:' >&2
  printf ' %s' "${missing[@]}" >&2
  printf '\nEnter: nix develop .#fabrication\n' >&2
  exit 69
fi

mkdir -p evidence/generated/fabrication-smoke
openscad --hardwarnings \
  -o evidence/generated/fabrication-smoke/mantis-terrarium.stl \
  terrarium/cad/mantis_terrarium.scad
FreeCADCmd --version
kicad-cli --version
blender --background --version
inkscape --version
ngspice --version
gmsh --version
ccx -v

