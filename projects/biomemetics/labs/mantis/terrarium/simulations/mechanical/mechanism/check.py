"""Dimensional and kinematic checks for the DRAFT carriage/binder model.

Calculated geometry against locked contracts. Not a measurement.
PR 34 frame/rail/B20 STEP is draft-only and is not an input.
#24 S1/S2/Q1 electrical is unmet: interlock interfaces stay UNVERIFIED.
"""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SIM_DIR = Path(__file__).resolve().parent
LAB_ROOT = SIM_DIR.parents[3]
SRC_ROOT = LAB_ROOT / "terrarium" / "cad" / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from carriage.assembly import load_model, posed_solids  # noqa: E402
from carriage.contract import d  # noqa: E402
from carriage.csg import overlap_volume  # noqa: E402
from carriage.kinematics import (  # noqa: E402
    binder_path_invariants,
    interval_stack,
    path_invariants,
    sample_binder,
    sample_path,
    sample_pinch,
    stack_invariants,
)


def _freecad_bin() -> str | None:
    env = os.environ.get("FREECADCMD")
    if env:
        return env
    for name in ("FreeCADCmd", "freecadcmd"):
        found = shutil.which(name)
        if found:
            return found
    return None


def _run_freecad(bin_path: str, script: Path) -> subprocess.CompletedProcess[str]:
    snippet = f"import runpy; runpy.run_path(r'{script}', run_name='__main__')"
    return subprocess.run(
        [bin_path, "-c", snippet],
        check=False,
        capture_output=True,
        text=True,
    )


def _by_id(solids) -> dict:
    return {solid.solid_id: solid for solid in solids}


def _pogo_land_overlap(world) -> float:
    ids = _by_id(world)
    pogos = ids.get("B27-array-posed")
    lands = ids.get("KO-land-plane-study")
    if pogos is None or lands is None:
        return 0.0
    volume = 0.0
    for pogo in pogos.adds:
        for land in lands.adds:
            volume += overlap_volume(pogo.aabb(), land.aabb())
    return volume


def _b50_overlap(world) -> float:
    ids = _by_id(world)
    a = ids.get("B50-carriage-posed")
    b = ids.get("B50-binder-posed")
    if a is None or b is None:
        return 0.0
    volume = 0.0
    for left in a.adds:
        for right in b.adds:
            volume += overlap_volume(left.aabb(), right.aabb())
    return volume


def _failures(contract: dict) -> list[str]:
    failures: list[str] = []
    if (d(contract, "frame.module_pitch").value, d(contract, "frame.first_span").value) != (
        250.0,
        500.0,
    ):
        failures.append("250/500 grid lock failed")
    if contract["architecture"].get("cameraTethered") is not False:
        failures.append("carriage must remain untethered")
    if contract["architecture"].get("videoWhileMoving") is not False:
        failures.append("video while rolling is out of v1")
    if contract["architecture"].get("rawMipiOnRail") is not False:
        failures.append("MIPI must not ride the rail or pogos")
    if contract["electrical"]["issue24"] != "unmet":
        failures.append("do not pretend #24 has landed")

    failures.extend(path_invariants(contract))
    failures.extend(binder_path_invariants(contract))
    failures.extend(stack_invariants(contract))

    locked = load_model(q=0.0, r=0.0)
    for solid in locked["world"]:
        if solid.volume_class in {"animal", "wet"}:
            failures.append(f"{solid.solid_id} enters animal/wet volume")
        if solid.metal and solid.volume_class in {"animal", "wet"}:
            failures.append(f"{solid.solid_id} places metal on the animal side")

    required_unique = {
        "B22-carriage-outer-shell",
        "B23-pinch-lever",
        "B24-contact-carrier",
        "B27-contact-array-proxy",
        "B28-universal-latch-shoe",
        "B29-camera-binder-housing",
        "B50-carriage-half-proxy",
        "B50-binder-half-proxy",
        "B23-lift-pawl",
        "B23-translation-pawl",
    }
    unique_ids = {part.solid_id for part in locked["unique"]}
    missing = sorted(required_unique - unique_ids)
    if missing:
        failures.append("unique part missing: " + ", ".join(missing))

    if locked["pinch"].state != "LOCKED":
        failures.append("q=0 is not LOCKED")
    if _pogo_land_overlap(locked["world"]) <= 0:
        failures.append("LOCKED must keep B27 on the land plane")
    if locked["binder"].state != "BINDER_BLOCKED":
        failures.append("binder must be blocked at LOCKED")

    blocked = sample_binder(3.5, locked["pinch"].state, contract)
    if blocked.b50_separation_mm > 0 or blocked.state != "BINDER_BLOCKED":
        failures.append("binder released without PINCH_SAFE")

    s1 = sample_pinch(d(contract, "carriage.s1_open_travel").value, contract)
    if s1.state != "S1_OPEN" or s1.carrier_lift_mm > 1e-9:
        failures.append("S1_OPEN must leave contacts stationary")

    safe_q = d(contract, "carriage.pinch_safe_travel").value
    safe = load_model(q=safe_q, r=0.0)
    if safe["pinch"].state != "PINCH_SAFE":
        failures.append("pinch-safe travel is not PINCH_SAFE")
    if safe["pinch"].carrier_lift_mm > 1e-9:
        failures.append("PINCH_SAFE must still hold the lift pawl")
    if _pogo_land_overlap(safe["world"]) <= 0:
        failures.append("PINCH_SAFE still requires land contact (break-before-lift)")

    mid_lift = (
        d(contract, "carriage.pinch_safe_travel").value
        + d(contract, "carriage.contacts_clear_travel").value
    ) / 2.0
    lifting = load_model(q=mid_lift, r=0.0)
    if lifting["pinch"].translation_unlocked:
        failures.append("translation unlocked during lift")

    clear = load_model(q=d(contract, "carriage.contacts_clear_travel").value, r=0.0)
    if clear["pinch"].state != "CONTACTS_CLEAR":
        failures.append("contacts-clear travel is not CONTACTS_CLEAR")
    if clear["pinch"].carrier_lift_mm + 1e-12 < contract["clearanceLiftMm"]:
        failures.append("CONTACTS_CLEAR does not meet lift target")
    if _pogo_land_overlap(clear["world"]) > 0:
        failures.append("CONTACTS_CLEAR still intersects lands")
    if clear["pinch"].translation_unlocked:
        failures.append("CONTACTS_CLEAR must not yet roll")

    rolling = load_model(
        q=d(contract, "carriage.pinch_input_travel").value, r=0.0, x_roll=12.0
    )
    if rolling["pinch"].state != "ROLLING":
        failures.append("full pinch is not ROLLING")
    if not rolling["pinch"].translation_unlocked:
        failures.append("ROLLING must unlock translation")
    if _pogo_land_overlap(rolling["world"]) > 0:
        failures.append("ROLLING wipe: B27 still on lands at x_roll=12")

    pinch_safe = safe["pinch"].state
    s2 = sample_binder(d(contract, "binder.s2_open_travel").value, pinch_safe, contract)
    if s2.state != "S2_OPEN" or s2.b50_separation_mm > 1e-9:
        failures.append("S2_OPEN must keep B50 seated")
    free = load_model(q=safe_q, r=d(contract, "binder.free_travel").value)
    if free["binder"].state != "BINDER_FREE":
        failures.append("binder free travel is not BINDER_FREE")
    if free["binder"].b50_seated:
        failures.append("BINDER_FREE still seated")
    if _b50_overlap(free["world"]) > 1e-6:
        failures.append("BINDER_FREE B50 halves still occupy the same volume")

    partial = sample_binder(
        d(contract, "binder.s2_open_travel").value * 0.5, pinch_safe, contract
    )
    if not partial.b50_seated:
        failures.append("partial binder click unmated B50")

    for q in (0.0, safe_q, d(contract, "carriage.pinch_input_travel").value):
        world = posed_solids(contract, q=q)
        if not any(solid.solid_id == "IF-S1-actuator" for solid in world):
            failures.append("S1 actuator envelope missing")
        if not any(solid.solid_id == "IF-S2-actuator" for solid in world):
            failures.append("S2 actuator envelope missing")
        if not any(solid.solid_id == "KO-no-mipi-on-pogo" for solid in world):
            failures.append("MIPI-not-on-pogo declaration missing")
        if not any(solid.solid_id == "KO-local-csi-bend" for solid in world):
            failures.append("local CSI keep-out missing")
    return failures


def _kinematic_report(contract: dict) -> dict:
    samples = sample_path(contract)
    keys = {
        0.0,
        d(contract, "carriage.s1_open_travel").value,
        d(contract, "carriage.pinch_safe_travel").value,
        d(contract, "carriage.contacts_clear_travel").value,
        d(contract, "carriage.pinch_input_travel").value,
    }
    return {
        "maturity": "DRAFT",
        "evidenceClass": "theoretical/UNVERIFIED",
        "coordinate": "q pinch input travel mm",
        "samples": [
            {
                "q": sample.q,
                "state": sample.state,
                "s1Open": sample.s1_open,
                "carrierLiftMm": sample.carrier_lift_mm,
                "liftPawlEngaged": sample.lift_pawl_engaged,
                "translationUnlocked": sample.translation_unlocked,
                "contactsOnLand": sample.contacts_on_land,
            }
            for sample in samples
            if any(abs(sample.q - key) < 1e-9 for key in keys)
        ],
        "fullSampleCount": len(samples),
        "electrical": contract["electrical"],
        "parentFrame": contract["parentFrame"],
    }


def _tolerance_report(contract: dict) -> dict:
    stacked = interval_stack(contract)
    return {
        "maturity": "DRAFT",
        "evidenceClass": "theoretical/UNVERIFIED",
        "printCompensationMm": {
            "value": d(contract, "carriage.print_compensation").value,
            "status": d(contract, "carriage.print_compensation").status,
            "note": "UNVERIFIED coupon. Same magnitude as cassette seat 0.20 TARGET.",
        },
        "intervals": {
            name: {"lo": iv.lo, "hi": iv.hi, "status": iv.status}
            for name, iv in stacked.items()
        },
        "pogoPn": "absent",
        "s1s2q1": "UNVERIFIED #24 unmet",
        "invariants": stack_invariants(contract),
    }


def main() -> int:
    reports = SIM_DIR / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    model = load_model()
    contract = model["contract"]
    failures = _failures(contract)
    named = []
    for spec in model["unique"] + model["world"]:
        named.append(
            {
                "solidId": spec.solid_id,
                "bomId": spec.bom_id,
                "kind": spec.kind,
                "volumeClass": spec.volume_class,
                "status": spec.status,
                "metal": spec.metal,
                "uniquePart": spec.unique_part,
                "frame": spec.frame,
                "aabbMm": list(spec.aabb()),
                "nominalVolumeMm3": spec.nominal_volume(),
                "notes": spec.notes,
            }
        )
    kinematic = _kinematic_report(contract)
    tolerance = _tolerance_report(contract)
    freecad = _freecad_bin()
    if freecad:
        exporter = SRC_ROOT / "carriage" / "export_freecad.py"
        proc = _run_freecad(freecad, exporter)
        export_report = {
            "returncode": proc.returncode,
            "stdout": proc.stdout[-2000:],
            "stderr": proc.stderr[-2000:],
        }
        if proc.returncode != 0:
            failures.append("FreeCADCmd export failed")
    else:
        export_report = {
            "blocked": True,
            "reason": "FreeCADCmd not on PATH. Python kinematics still authoritative for this check.",
        }

    payload = {
        "maturity": "DRAFT",
        "authority": "freecad-part-occt",
        "openscadAuthority": False,
        "evidenceClass": "theoretical/UNVERIFIED",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "paramsSha256": contract["paramsSha256"],
        "busSha256": contract["busSha256"],
        "electrical": contract["electrical"],
        "parentFrame": contract["parentFrame"],
        "clearanceLiftMm": contract["clearanceLiftMm"],
        "failures": failures,
        "ok": not failures,
        "export": export_report,
    }
    (reports / "geometry-report.json").write_text(
        json.dumps(payload, indent=2) + "\n", encoding="utf-8"
    )
    (reports / "named-solids.json").write_text(
        json.dumps(named, indent=2) + "\n", encoding="utf-8"
    )
    (reports / "named-solids.sha256").write_text(
        hashlib.sha256((reports / "named-solids.json").read_bytes()).hexdigest() + "\n",
        encoding="utf-8",
    )
    (reports / "kinematic-report.json").write_text(
        json.dumps(kinematic, indent=2) + "\n", encoding="utf-8"
    )
    (reports / "tolerance-report.json").write_text(
        json.dumps(tolerance, indent=2) + "\n", encoding="utf-8"
    )
    screening = {
        "maturity": "DRAFT",
        "solver": "Gmsh/CalculiX",
        "status": "BLOCKED",
        "reason": "Sourced or measured PETG/ASA modulus, strength, and mesh-convergence coupon are absent. Do not invent material cards.",
        "casesSpecifiedNotRun": [
            "pinch lever B23 under 15-25 N TARGET pinch",
            "B28 latch at 40 N TARGET pull-off and 0.5 N-m moment",
            "B51 route retention (interface only; #28 geometry not admitted)",
        ],
    }
    (reports / "structural-screening.json").write_text(
        json.dumps(screening, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"ok": not failures, "failures": failures, "reports": str(reports)}))
    return 0 if not failures else 1


if __name__ == "__main__":
    raise SystemExit(main())
