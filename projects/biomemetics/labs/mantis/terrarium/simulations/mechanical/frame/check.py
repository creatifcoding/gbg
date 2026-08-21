#!/usr/bin/env python3
"""Dimensional and keep-out checks for the DRAFT OCCT frame/rail/B20 model.

This script is calculated geometry against locked contracts. It is not a
measurement and it is not a FreeCADCmd STEP round-trip. STEP export is a
separate FreeCADCmd run of cad/src/frame/export_freecad.py.
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

from boundary.profiles import write_cut_profiles  # noqa: E402
from frame.assembly import load_model  # noqa: E402
from frame.contract import d  # noqa: E402
from frame.csg import aabb_overlap, conductor_animal_overlap, union_aabb  # noqa: E402


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


def _failures(model: dict) -> list[str]:
    contract = model["contract"]
    world = model["world"]
    unique = model["unique"]
    failures: list[str] = []
    pitch = d(contract, "frame.module_pitch").value
    span = d(contract, "frame.first_span").value
    width = d(contract, "frame.exterior.width").value
    depth = d(contract, "frame.exterior.depth").value
    height = d(contract, "frame.exterior.height").value
    if (width, depth, height) != (250.0, 250.0, 500.0):
        failures.append("exterior bbox lock is not 250/250/500")
    if pitch != 250.0 or span != 500.0:
        failures.append("250/500 grid lock failed")
    if d(contract, "husbandry.screen.aperture_max").value > 0.8:
        failures.append("screen aperture exceeds 0.8 mm")
    if contract["architecture"].get("cameraTethered") is not False:
        failures.append("carriage must remain untethered")

    ids = {solid.solid_id for solid in world}
    required = {
        "B20-animal-wet-barrier",
        "KO-animal-volume",
        "KO-wet-volume",
        "KO-hang-molt-ceiling",
        "KO-ceiling-screen",
        "KO-nymph-door-gap",
        "KO-carriage-untethered-top",
        "KO-carriage-untethered-vertical",
        "B18-top-front-250",
        "B18-front-left-vertical-500",
        "B51-top-front-start",
        "B51-top-front-end",
        "B51-vertical-start",
        "B51-vertical-end",
        "B21-routes-separate",
        "B19-conductor-proxy",
        "B02-midspan-front-left",
    }
    missing = sorted(required - ids)
    if missing:
        failures.append("missing solids: " + ", ".join(missing))

    b20 = next(solid for solid in world if solid.solid_id == "B20-animal-wet-barrier")
    b20_aabb = union_aabb(box.aabb() for box in b20.adds)
    if b20_aabb is None or b20_aabb[5] - b20_aabb[2] < span - 1e-6:
        failures.append("B20 does not span the 500 mm height")
    if b20.metal:
        failures.append("B20 must not be metal")

    animal = [solid for solid in world if solid.volume_class in {"animal", "wet"}]
    conductors = [solid for solid in world if solid.metal or solid.kind == "conductor-proxy"]
    expand = d(contract, "cassette.seat_clearance").value
    intrusion = conductor_animal_overlap(conductors, animal, expand=expand)
    if intrusion > 0:
        failures.append(f"conductor/animal-wet overlap volume {intrusion:.3f} mm^3")

    for solid in world:
        if solid.volume_class in {"animal", "wet", "molt", "screen"} and solid.metal:
            failures.append(f"{solid.solid_id} introduces metal into {solid.volume_class}")

    animal_box = next(solid for solid in world if solid.solid_id == "KO-animal-volume")
    for rail_id in ("B18-top-front-250", "B18-front-left-vertical-500"):
        rail = next(solid for solid in world if solid.solid_id == rail_id)
        if aabb_overlap(rail.aabb(), animal_box.aabb()):
            failures.append(f"{rail_id} intersects the animal keep-out")
        if rail.aabb()[1] >= 0 and rail.aabb()[0] >= 0:
            failures.append(f"{rail_id} is not outside the perimeter")

    corner = next((solid for solid in world if solid.solid_id == "B21-corner-transition"), None)
    if corner is not None:
        failures.append("B21 corner transition solid is forbidden; routes stay separate")

    unique_ids = {part.solid_id for part in unique}
    for needed in (
        "B01-corner-block",
        "B02-edge-250",
        "B03-splice-250-500",
        "B18-rail-channel-250",
        "B18-rail-channel-500",
        "B51-end-stop",
        "B52-access-guard-250",
        "B05-view-cassette",
        "B07-door-labyrinth",
    ):
        if needed not in unique_ids:
            failures.append(f"unique part missing: {needed}")

    wall = d(contract, "rail.side_wall").value
    if wall < 3.0 - 1e-9:
        failures.append("rail minimum wall is below the 3 mm REF")
    return failures


def _interface_manifest(model: dict) -> dict:
    contract = model["contract"]
    return {
        "maturity": "DRAFT",
        "status": "UNVERIFIED",
        "coordinateFrame": "frame.world",
        "axes": contract["axes"],
        "note": "KiCad board envelopes wait on sourced B27/B50 parts from #23. This proxy is the rail envelope only.",
        "boards": [
            {
                "id": "B27-rail-dock-proxy",
                "status": "unverified",
                "matingPlane": "rail.top_front z=span",
                "envelopeMm": [
                    d(contract, "frame.module_pitch").value,
                    d(contract, "rail.envelope.width").value,
                    d(contract, "rail.envelope.height").value,
                ],
                "holes": [],
                "heightZones": ["UNVERIFIED"],
            },
            {
                "id": "B50-binder-proxy",
                "status": "unverified",
                "matingPlane": "carriage binder face, owned by #29",
                "envelopeMm": [
                    d(contract, "carriage.envelope.width").value,
                    d(contract, "carriage.envelope.depth").value,
                    d(contract, "carriage.envelope.height").value,
                ],
                "holes": [],
                "heightZones": ["UNVERIFIED"],
            },
        ],
    }


def main() -> int:
    reports = SIM_DIR / "reports"
    reports.mkdir(parents=True, exist_ok=True)
    model = load_model()
    contract = model["contract"]
    failures = _failures(model)
    profiles = write_cut_profiles(
        contract, SRC_ROOT / "boundary" / "exports" / "profiles"
    )
    freecad = _freecad_bin()
    export_report = None
    if freecad:
        exporter = SRC_ROOT / "frame" / "export_freecad.py"
        proc = _run_freecad(freecad, exporter)
        export_report = {
            "returncode": proc.returncode,
            "stdoutTail": proc.stdout.strip().splitlines()[-1] if proc.stdout.strip() else "",
        }
        if proc.returncode != 0:
            failures.append("FreeCADCmd STEP export failed")
        else:
            roundtrip = SIM_DIR / "roundtrip_step.py"
            rt = _run_freecad(freecad, roundtrip)
            export_report["roundtripReturncode"] = rt.returncode
            export_report["roundtripStdout"] = rt.stdout.strip().splitlines()[-1] if rt.stdout.strip() else ""
            if rt.returncode != 0:
                failures.append("FreeCADCmd STEP re-import failed")
    else:
        export_report = {
            "blocked": True,
            "reason": "FreeCADCmd not on PATH in this environment",
        }

    world = model["world"]
    bbox = union_aabb(solid.aabb() for solid in world if solid.adds)
    report = {
        "maturity": "DRAFT",
        "authority": "freecad-part-occt",
        "openscadIsStudyOnly": True,
        "openscadIsReleasedStep": False,
        "epistemic": "theoretical/UNVERIFIED",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "paramsSha256": contract["paramsSha256"],
        "busSha256": contract["busSha256"],
        "studySha256": contract["studySha256"],
        "solidCount": len(world),
        "uniquePartCount": len(model["unique"]),
        "bboxMm": list(bbox) if bbox else None,
        "minimumWallMm": {
            "railSideWall": d(contract, "rail.side_wall").value,
            "status": d(contract, "rail.side_wall").status,
        },
        "b20ContinuousHeightMm": d(contract, "frame.first_span").value,
        "conductorAnimalOverlapMm3": conductor_animal_overlap(
            [solid for solid in world if solid.metal or solid.kind == "conductor-proxy"],
            [solid for solid in world if solid.volume_class in {"animal", "wet"}],
            expand=d(contract, "cassette.seat_clearance").value,
        ),
        "b21": "routes-separate",
        "cutProfiles": [path.name for path in profiles],
        "freecadExport": export_report,
        "failures": failures,
        "ok": not failures,
    }
    (reports / "geometry-report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    (reports / "interface-manifest.json").write_text(
        json.dumps(_interface_manifest(model), indent=2) + "\n", encoding="utf-8"
    )
    solids_dump = [
        {
            "solidId": solid.solid_id,
            "bomId": solid.bom_id,
            "kind": solid.kind,
            "volumeClass": solid.volume_class,
            "status": solid.status.upper() if solid.status != "calculated" else "CALCULATED",
            "metal": solid.metal,
            "frame": solid.frame,
            "aabbMm": list(solid.aabb()),
            "volumeMm3": solid.nominal_volume(),
            "notes": solid.notes,
        }
        for solid in world
    ]
    payload = json.dumps(solids_dump, indent=2) + "\n"
    (reports / "named-solids.json").write_text(payload, encoding="utf-8")
    digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
    (reports / "named-solids.sha256").write_text(digest + "\n", encoding="utf-8")
    if failures:
        print("FAIL")
        for item in failures:
            print(item)
        return 1
    print("PASS")
    print(f"solids={len(world)} unique={len(model['unique'])} overlap=0")
    if export_report.get("blocked"):
        print("STEP export BLOCKED: FreeCADCmd missing; parametric FreeCAD Part source is the OCCT authority")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
