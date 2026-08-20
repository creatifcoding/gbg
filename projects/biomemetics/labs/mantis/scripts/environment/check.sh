#!/usr/bin/env bash
# Environment gate for a workstream id (issue #21). Domain work stays with owners.
# shellcheck shell=bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
mantis_env_init

ID="${1:?workstream-id required}"

# Map workstream -> required shell / doctor subset.
case "$ID" in
  mantis-00a-runtime | 21 | gbg#21)
    bash "$SCRIPT_DIR/doctor.sh"
    ;;
  mantis-00-workspace | 15 | gbg#15)
    echo "check: core contract + manifest verify (env only; no domain edits)"
    mantis_require_cmd python3 mantis-00a-runtime
    python3 "$MANTIS_LAB_ROOT/scripts/validate-contracts.py"
    (cd "$MANTIS_LAB_ROOT/terrarium" && sha256sum -c MANIFEST.sha256)
    echo "PASS workstream=$ID (environment gate)"
    ;;
  mantis-00b-control-plane | 22 | gbg#22)
    echo "BLOCKED: control-plane sources owned by workstream $ID / issue #22"
    echo "Environment can enter mantis-core; domain validators are out of #21 write set."
    exit 69
    ;;
  mantis-ee-* | mantis-02-ee-umbrella | 18 | gbg#18)
    mantis_require_cmd kicad-cli mantis-00a-runtime
    echo "PASS env gate for $ID — KiCad toolchain present; domain sources owned by EE workstreams"
    ;;
  mantis-cad-* | mantis-03-cad-umbrella | 19 | gbg#19)
    mantis_require_cmd openscad mantis-00a-runtime
    if ! command -v FreeCADCmd >/dev/null 2>&1 && ! command -v freecadcmd >/dev/null 2>&1; then
      mantis_fail mantis-00a-runtime "FreeCADCmd missing for CAD workstream gate"
    fi
    echo "PASS env gate for $ID — CAD toolchain present"
    ;;
  mantis-sim-* | *)
    # Unknown or future workstreams: prove doctor shell, name owner, do not invent work.
    echo "check: unknown/deferred workstream=$ID — running doctor env proof only"
    bash "$SCRIPT_DIR/doctor.sh"
    echo "NOTE: domain acceptance for $ID remains with its owning implementer"
    ;;
esac
