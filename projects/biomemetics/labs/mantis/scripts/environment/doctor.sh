#!/usr/bin/env bash
# mantis doctor — non-mutating workflow preflight (issue #21 / mantis-00a-runtime).
# Proves workflows with fixtures; does not repair manifests or invent domain sources.
# shellcheck shell=bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
source "$SCRIPT_DIR/lib.sh"
mantis_env_init

DOCTOR_VERSION="mantis.doctor.v1"
REPORT_TS="$(date -u +%Y%m%dT%H%M%SZ)"
REPORT_JSON="$MANTIS_DOCTOR_DIR/doctor-${REPORT_TS}.json"
REPORT_TXT="$MANTIS_DOCTOR_DIR/doctor-${REPORT_TS}.txt"
RUN_DIR="$MANTIS_DOCTOR_DIR/run-${REPORT_TS}"
mkdir -p "$RUN_DIR"

declare -a CHECK_IDS=()
declare -a CHECK_STATUS=()
declare -a CHECK_DETAIL=()
declare -a CHECK_WORKSTREAM=()

record() {
  local id="$1" status="$2" workstream="$3" detail="$4"
  CHECK_IDS+=("$id")
  CHECK_STATUS+=("$status")
  CHECK_WORKSTREAM+=("$workstream")
  CHECK_DETAIL+=("$detail")
  printf '[%s] %s (%s): %s\n' "$status" "$id" "$workstream" "$detail" | tee -a "$REPORT_TXT"
}

run_capture() {
  local out="$1"
  shift
  if "$@" >"$out" 2>"$out.err"; then
    return 0
  fi
  return 1
}

# --- core: schemas + positive/negative fixtures (Python gate; Rust/TS tooling owned elsewhere) ---
check_schemas() {
  local ws="mantis-00a-runtime"
  local out="$RUN_DIR/schemas"
  mkdir -p "$out"
  if ! command -v python3 >/dev/null 2>&1; then
    record "schemas.jsonschema" "FAIL" "$ws" "python3 missing"
    return
  fi
  if ! python3 -c 'import jsonschema' 2>/dev/null; then
    record "schemas.jsonschema" "FAIL" "$ws" "jsonschema missing — enter nix develop .#mantis-core"
    return
  fi

  if ! python3 "$MANTIS_ENV_SCRIPTS/validate-schema-fixtures.py" \
    --lab-root "$MANTIS_LAB_ROOT" \
    --fixtures "$MANTIS_ENV_FIXTURES/schemas" \
    --out "$out/result.json"; then
    record "schemas.fixtures" "FAIL" "$ws" "schema fixture validation failed (see $out)"
    return
  fi
  record "schemas.fixtures" "PASS" "$ws" "positive/negative Draft 2020-12 fixtures ok"

  # Existing workspace contracts (read-only consume).
  if python3 "$MANTIS_LAB_ROOT/scripts/validate-contracts.py" >"$out/contracts.txt" 2>&1; then
    record "schemas.workspace-contracts" "PASS" "$ws" "workspace contracts validate"
  else
    record "schemas.workspace-contracts" "FAIL" "mantis-00b-control-plane" \
      "contract validation failed without repair; see $out/contracts.txt"
  fi
}

# --- EE: native KiCad parse / ERC / DRC / exports on environment fixtures ---
check_kicad() {
  local ws="mantis-00a-runtime"
  if ! command -v kicad-cli >/dev/null 2>&1; then
    record "kicad.cli" "FAIL" "$ws" "kicad-cli missing — enter nix develop .#mantis-ee (or mantis-all)"
    return
  fi
  local out="$RUN_DIR/kicad"
  mkdir -p "$out"
  local sch="$MANTIS_ENV_FIXTURES/kicad/ref-coupon.kicad_sch"
  local pcb="$MANTIS_ENV_FIXTURES/kicad/ref-coupon.kicad_pcb"
  if ! kicad-cli sch export pdf --output "$out/sch.pdf" "$sch" >"$out/sch-export.log" 2>&1; then
    record "kicad.sch-export" "FAIL" "$ws" "schematic export failed (fixture parse/export)"
    return
  fi
  if ! kicad-cli sch erc --format json --output "$out/erc.json" "$sch" >"$out/erc.log" 2>&1; then
    # ERC may return non-zero on violations; require the report file to exist.
    if [ ! -f "$out/erc.json" ]; then
      record "kicad.erc" "FAIL" "$ws" "ERC did not emit report"
      return
    fi
  fi
  if ! kicad-cli pcb export gerbers --output "$out/gerbers" "$pcb" >"$out/gerber.log" 2>&1; then
    record "kicad.pcb-export" "FAIL" "$ws" "PCB gerber export failed"
    return
  fi
  if ! kicad-cli pcb drc --format json --output "$out/drc.json" "$pcb" >"$out/drc.log" 2>&1; then
    if [ ! -f "$out/drc.json" ]; then
      record "kicad.drc" "FAIL" "$ws" "DRC did not emit report"
      return
    fi
  fi
  record "kicad.workflows" "PASS" "$ws" "parse/ERC/DRC/exports on environment fixtures"
  # Domain sources remain other workstreams — report readiness only.
  if [ ! -d "$MANTIS_LAB_ROOT/terrarium/ee/kicad" ] && [ ! -d "$MANTIS_LAB_ROOT/terrarium/ee/system" ]; then
    record "kicad.domain-sources" "SKIP" "mantis-ee-01" \
      "no terrarium KiCad system sources yet; toolchain proven via fixtures only"
  fi
}

# --- CAD: FreeCADCmd/OCCT STEP dimensional agree + OpenSCAD hardwarnings ---
check_cad() {
  local ws="mantis-00a-runtime"
  local out="$RUN_DIR/cad"
  mkdir -p "$out"

  if ! command -v FreeCADCmd >/dev/null 2>&1 && ! command -v freecadcmd >/dev/null 2>&1; then
    record "cad.freecad" "FAIL" "$ws" "FreeCADCmd missing — enter nix develop .#mantis-cad"
  else
    local fcc="FreeCADCmd"
    command -v FreeCADCmd >/dev/null 2>&1 || fcc="freecadcmd"
    if "$fcc" -c "import FreeCAD,Part; print('ok')" >"$out/freecad-import.log" 2>&1; then
      if "$fcc" "$MANTIS_ENV_FIXTURES/cad/step_roundtrip.py" "$out" >"$out/step-roundtrip.log" 2>&1; then
        record "cad.step-roundtrip" "PASS" "$ws" "FreeCADCmd/OCCT STEP export/reimport dimensional agree"
      else
        record "cad.step-roundtrip" "FAIL" "$ws" "STEP roundtrip assertion failed (see $out/step-roundtrip.log)"
      fi
    else
      record "cad.freecad" "FAIL" "$ws" "FreeCAD Python import failed"
    fi
  fi

  if ! command -v openscad >/dev/null 2>&1; then
    record "cad.openscad" "FAIL" "$ws" "openscad missing — enter nix develop .#mantis-cad"
  else
    if openscad --hardwarnings -o "$out/ref-cube.stl" \
      "$MANTIS_ENV_FIXTURES/cad/ref-cube.scad" >"$out/openscad.log" 2>&1; then
      record "cad.openscad-hardwarnings" "PASS" "$ws" "OpenSCAD hardwarnings export ok"
    else
      record "cad.openscad-hardwarnings" "FAIL" "$ws" "OpenSCAD hardwarnings build failed"
    fi
  fi
}

# --- SIM: ngspice + Gmsh/CalculiX numeric assertions ---
check_sim() {
  local ws="mantis-00a-runtime"
  local out="$RUN_DIR/sim"
  mkdir -p "$out" "$MANTIS_SOLVER_TEMP/sim"

  if ! command -v ngspice >/dev/null 2>&1; then
    record "sim.ngspice" "FAIL" "$ws" "ngspice missing — enter nix develop .#mantis-ee or mantis-sim"
  else
    if ngspice -b -o "$out/rc.out" "$MANTIS_ENV_FIXTURES/sim/rc.cir" >"$out/ngspice.log" 2>&1; then
      if python3 "$MANTIS_ENV_SCRIPTS/assert-ngspice-rc.py" "$out/rc.out" >"$out/ngspice-assert.txt" 2>&1; then
        record "sim.ngspice" "PASS" "$ws" "RC transient numeric assertion ok"
      else
        record "sim.ngspice" "FAIL" "$ws" "ngspice numeric assertion failed"
      fi
    else
      record "sim.ngspice" "FAIL" "$ws" "ngspice batch failed"
    fi
  fi

  if ! command -v gmsh >/dev/null 2>&1 || ! command -v ccx >/dev/null 2>&1; then
    record "sim.gmsh-ccx" "FAIL" "$ws" "gmsh/ccx missing — enter nix develop .#mantis-sim"
  else
    local simtmp="$MANTIS_SOLVER_TEMP/sim"
    cp "$MANTIS_ENV_FIXTURES/sim/cube.geo" "$simtmp/"
    cp "$MANTIS_ENV_FIXTURES/sim/cube.inp" "$simtmp/"
    if (cd "$simtmp" && gmsh -3 -o cube.msh cube.geo >"$out/gmsh.log" 2>&1); then
      if (cd "$simtmp" && ccx cube >"$out/ccx.log" 2>&1); then
        if python3 "$MANTIS_ENV_SCRIPTS/assert-ccx-cube.py" "$simtmp" >"$out/ccx-assert.txt" 2>&1; then
          record "sim.gmsh-ccx" "PASS" "$ws" "Gmsh mesh + CalculiX numeric assertion ok"
        else
          record "sim.gmsh-ccx" "FAIL" "$ws" "CalculiX assertion failed"
        fi
      else
        record "sim.gmsh-ccx" "FAIL" "$ws" "ccx solve failed"
      fi
    else
      record "sim.gmsh-ccx" "FAIL" "$ws" "gmsh mesh failed"
    fi
  fi

  if command -v openEMS >/dev/null 2>&1; then
    record "sim.openems" "SKIP" "$ws" "openEMS present but not yet qualified by headless smoke"
  else
    record "sim.openems" "SKIP" "$ws" "openEMS omitted until headless smoke qualifies it"
  fi
}

# --- manifests verify without regenerating/repairing ---
check_manifests() {
  local ws="mantis-00a-runtime"
  local out="$RUN_DIR/manifests"
  mkdir -p "$out"
  local mf="$MANTIS_ENV_FIXTURES/manifests/ref-artifacts.sha256"
  if (cd "$MANTIS_ENV_FIXTURES/manifests" && sha256sum -c ref-artifacts.sha256 >"$out/verify.txt" 2>&1); then
    record "manifests.verify" "PASS" "$ws" "fixture manifest verified without self-repair"
  else
    record "manifests.verify" "FAIL" "$ws" "fixture manifest verify failed (non-mutating)"
  fi

  # Checked-in terrarium baseline: verify only, never regenerate.
  if [ -f "$MANTIS_LAB_ROOT/terrarium/MANIFEST.sha256" ]; then
    if (cd "$MANTIS_LAB_ROOT/terrarium" && sha256sum -c MANIFEST.sha256 >"$out/terrarium-manifest.txt" 2>&1); then
      record "manifests.terrarium" "PASS" "$ws" "terrarium MANIFEST.sha256 verified (read-only)"
    else
      record "manifests.terrarium" "FAIL" "mantis-00-workspace" \
        "terrarium manifest mismatch; doctor did not repair"
    fi
  fi
}

# --- headless tool identity ---
check_headless_identity() {
  local ws="mantis-00a-runtime"
  local out="$RUN_DIR/versions"
  mkdir -p "$out"
  {
    echo "git_sha=$(mantis_git_sha)"
    echo "shell=${MANTIS_SHELL:-unset}"
    echo "system=$(uname -s)-$(uname -m)"
    command -v python3 >/dev/null && python3 --version
    command -v rustc >/dev/null && rustc --version
    command -v cargo >/dev/null && cargo --version
    command -v bun >/dev/null && bun --version
    command -v node >/dev/null && node --version
    command -v jq >/dev/null && jq --version
    command -v kicad-cli >/dev/null && kicad-cli --version
    command -v FreeCADCmd >/dev/null && FreeCADCmd --version || true
    command -v openscad >/dev/null && openscad --version
    command -v blender >/dev/null && blender --background --version | head -n 1
    command -v ngspice >/dev/null && ngspice --version | head -n 1
    command -v gmsh >/dev/null && gmsh --version
    command -v ccx >/dev/null && ccx -v
    command -v inkscape >/dev/null && inkscape --version | head -n 1
  } >"$out/tool-versions.txt" 2>&1 || true
  record "identity.versions" "PASS" "$ws" "tool versions captured"
}

emit_report() {
  local i n fail=0
  n=${#CHECK_IDS[@]}
  for ((i = 0; i < n; i++)); do
    if [ "${CHECK_STATUS[$i]}" = "FAIL" ]; then
      fail=$((fail + 1))
    fi
  done

  python3 - "$REPORT_JSON" <<'PY'
import json, os, sys, hashlib
from pathlib import Path

report_path = Path(sys.argv[1])
ids = os.environ.get("MANTIS_CHECK_IDS", "").split("\n")
statuses = os.environ.get("MANTIS_CHECK_STATUS", "").split("\n")
workstreams = os.environ.get("MANTIS_CHECK_WS", "").split("\n")
details = os.environ.get("MANTIS_CHECK_DETAIL", "").split("\n")
# trim possible trailing empties from split
while ids and ids[-1] == "":
    ids.pop(); statuses.pop(); workstreams.pop(); details.pop()

checks = []
for i, cid in enumerate(ids):
    checks.append({
        "id": cid,
        "status": statuses[i] if i < len(statuses) else "UNKNOWN",
        "workstream": workstreams[i] if i < len(workstreams) else "",
        "detail": details[i] if i < len(details) else "",
    })

payload = {
    "schema": os.environ["DOCTOR_VERSION"],
    "timestamp": os.environ["REPORT_TS"],
    "gitSha": os.environ["GIT_SHA"],
    "worktreeId": os.environ["MANTIS_WORKTREE_ID"],
    "labRoot": os.environ["MANTIS_LAB_ROOT"],
    "stateDir": os.environ["MANTIS_STATE_DIR"],
    "shell": os.environ.get("MANTIS_SHELL", ""),
    "nixClosureHint": os.environ.get("NIX_CLOSURE_HINT", ""),
    "commands": [
        "mantis doctor",
        "mantis check <workstream-id>",
        "mantis export <domain>",
        "mantis evidence <run>",
    ],
    "outputs": {
        "reportJson": str(report_path),
        "reportTxt": os.environ["REPORT_TXT"],
        "runDir": os.environ["RUN_DIR"],
    },
    "checks": checks,
    "summary": {
        "total": len(checks),
        "pass": sum(1 for c in checks if c["status"] == "PASS"),
        "fail": sum(1 for c in checks if c["status"] == "FAIL"),
        "skip": sum(1 for c in checks if c["status"] == "SKIP"),
    },
}
text = json.dumps(payload, indent=2, sort_keys=True) + "\n"
digest = hashlib.sha256(text.encode()).hexdigest()
payload["digest"] = f"sha256:{digest}"
final = json.dumps(payload, indent=2, sort_keys=True) + "\n"
report_path.write_text(final, encoding="utf-8")
print(final)
PY

  {
    echo "=== mantis doctor $DOCTOR_VERSION ==="
    echo "git=$(mantis_git_sha)"
    echo "report=$REPORT_JSON"
    echo "failures=$fail"
    cat "$REPORT_TXT"
  } | tee "$MANTIS_DOCTOR_DIR/doctor-latest.txt"

  # Digested sidecar
  mantis_sha256_file "$REPORT_JSON" >"$REPORT_JSON.sha256"
  ln -sfn "$(basename "$REPORT_JSON")" "$MANTIS_DOCTOR_DIR/doctor-latest.json"
  return "$fail"
}

main() {
  : >"$REPORT_TXT"
  echo "mantis doctor $DOCTOR_VERSION @ $(mantis_git_sha)" | tee -a "$REPORT_TXT"
  check_headless_identity
  check_schemas
  check_kicad
  check_cad
  check_sim
  check_manifests

  export DOCTOR_VERSION REPORT_TS REPORT_TXT RUN_DIR
  export GIT_SHA
  GIT_SHA="$(mantis_git_sha)"
  export NIX_CLOSURE_HINT="shell=${MANTIS_SHELL:-unset}; worktree=${MANTIS_WORKTREE_ID}"
  # Pass check arrays via env (NUL-safe enough for our ids).
  export MANTIS_CHECK_IDS="$(printf '%s\n' "${CHECK_IDS[@]}")"
  export MANTIS_CHECK_STATUS="$(printf '%s\n' "${CHECK_STATUS[@]}")"
  export MANTIS_CHECK_WS="$(printf '%s\n' "${CHECK_WORKSTREAM[@]}")"
  export MANTIS_CHECK_DETAIL="$(printf '%s\n' "${CHECK_DETAIL[@]}")"

  local fail=0
  set +e
  emit_report
  fail=$?
  set -e
  if [ "$fail" -gt 0 ]; then
    echo "doctor FAILED ($fail checks) — non-mutating; see $REPORT_JSON" >&2
    exit 1
  fi
  echo "doctor PASSED — $REPORT_JSON"
}

main "$@"
