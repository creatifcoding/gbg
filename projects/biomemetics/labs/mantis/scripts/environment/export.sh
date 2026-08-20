#!/usr/bin/env bash
# Export preflight by domain (issue #21). Does not invent domain artifacts.
# shellcheck shell=bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
mantis_env_init

DOMAIN="${1:?domain required}"
OUT="$MANTIS_RESULT_DIR/export-$DOMAIN"
mkdir -p "$OUT"

case "$DOMAIN" in
  core)
    mantis_require_cmd python3 mantis-00a-runtime
    mantis_require_cmd jq mantis-00a-runtime
    python3 "$MANTIS_LAB_ROOT/scripts/validate-contracts.py" | tee "$OUT/contracts.txt"
    echo "export-preflight domain=core out=$OUT"
    ;;
  ee)
    mantis_require_cmd kicad-cli mantis-00a-runtime
    mantis_require_cmd ngspice mantis-00a-runtime
    kicad-cli --version | tee "$OUT/kicad-version.txt"
    # Fixture export only — terrarium KiCad sources are other workstreams.
    kicad-cli sch export pdf \
      --output "$OUT/ref-coupon.pdf" \
      "$MANTIS_ENV_FIXTURES/kicad/ref-coupon.kicad_sch"
    echo "export-preflight domain=ee out=$OUT (fixtures; domain boards owned by mantis-ee-*)"
    ;;
  cad)
    mantis_require_cmd openscad mantis-00a-runtime
    openscad --hardwarnings -o "$OUT/ref-cube.stl" "$MANTIS_ENV_FIXTURES/cad/ref-cube.scad"
    if command -v FreeCADCmd >/dev/null 2>&1; then
      FreeCADCmd "$MANTIS_ENV_FIXTURES/cad/step_roundtrip.py" "$OUT"
    elif command -v freecadcmd >/dev/null 2>&1; then
      freecadcmd "$MANTIS_ENV_FIXTURES/cad/step_roundtrip.py" "$OUT"
    else
      mantis_fail mantis-00a-runtime "FreeCADCmd missing"
    fi
    echo "export-preflight domain=cad out=$OUT"
    ;;
  sim)
    mantis_require_cmd ngspice mantis-00a-runtime
    mantis_require_cmd gmsh mantis-00a-runtime
    mantis_require_cmd ccx mantis-00a-runtime
    ngspice -b -o "$OUT/rc.out" "$MANTIS_ENV_FIXTURES/sim/rc.cir"
    echo "export-preflight domain=sim out=$OUT"
    ;;
  review)
    mantis_require_cmd jq mantis-00a-runtime
    if command -v pdftotext >/dev/null 2>&1; then
      pdftotext -v 2>"$OUT/poppler.version" || true
    fi
    echo "export-preflight domain=review out=$OUT"
    ;;
  *)
    echo "unknown domain: $DOMAIN (expected core|ee|cad|sim|review)" >&2
    exit 2
    ;;
esac
