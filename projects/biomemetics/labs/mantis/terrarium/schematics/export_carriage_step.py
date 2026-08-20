#!/usr/bin/env python3
"""Emit carriage/binder DRAFT STEP from CAD-02 CSG using OCCT (OCP).

CAD-02 ships Python + export_freecad.py and may have no STEP in-tree. This
script is the OCCT path when FreeCADCmd is absent. It does not admit PR 34
frame STEP as a parent.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCHEMATICS = Path(__file__).resolve().parent
SRC_ROOT = Path(__file__).resolve().parents[1] / "cad" / "src"
sys.path.insert(0, str(SCHEMATICS))
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from carriage.assembly import load_model  # noqa: E402
from carriage.csg import Box, CylinderZ, SolidSpec  # noqa: E402
from occt_hlr import bbox3d, compound_all, cut_shape, fuse_all, make_box, make_cyl_z, write_step  # noqa: E402


def _body(spec: SolidSpec):
    solids = []
    for prim in spec.adds:
        if isinstance(prim, Box):
            body = make_box(prim.xmin, prim.ymin, prim.zmin, prim.dx, prim.dy, prim.dz)
            if body is not None:
                solids.append(body)
        elif isinstance(prim, CylinderZ):
            solids.append(make_cyl_z(prim.x, prim.y, prim.zmin, prim.height, prim.diameter))
    if not solids:
        return None
    body = fuse_all(solids)
    for cut in spec.cuts:
        cutter = None
        if isinstance(cut, Box):
            cutter = make_box(cut.xmin, cut.ymin, cut.zmin, cut.dx, cut.dy, cut.dz)
        elif isinstance(cut, CylinderZ):
            cutter = make_cyl_z(cut.x, cut.y, cut.zmin, cut.height, cut.diameter)
        if cutter is not None:
            body = cut_shape(body, cutter)
    return body


def export_parts(out_dir: Path, specs: list[SolidSpec]) -> list[dict]:
    out_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for spec in specs:
        if not spec.unique_part:
            continue
        body = _body(spec)
        if body is None:
            continue
        step_path = out_dir / f"{spec.solid_id}.step"
        write_step(body, step_path)
        box = bbox3d(body)
        records.append(
            {
                "solidId": spec.solid_id,
                "bomId": spec.bom_id,
                "status": spec.status,
                "bboxMm": list(box),
                "step": step_path.name,
            }
        )
    return records


def export_world(out_dir: Path, world: list[SolidSpec], filename: str) -> dict:
    shapes = []
    for spec in world:
        if spec.kind in {"keep-out", "declaration", "interlock-interface"}:
            continue
        body = _body(spec)
        if body is None:
            continue
        shapes.append(body)
    compound = compound_all(shapes)
    step_path = out_dir / filename
    write_step(compound, step_path)
    box = bbox3d(compound)
    return {
        "step": filename,
        "bboxMm": list(box),
        "solidCount": len(shapes),
        "coordinateFrame": "carriage.local",
        "maturity": "DRAFT",
        "parentFrameAdmitted": False,
        "authority": "occt-ocp-hlr",
    }


def main() -> int:
    src = SRC_ROOT
    carriage_out = src / "carriage" / "exports"
    binder_out = src / "binder" / "exports"
    locked = load_model(q=0.0, r=0.0)
    rolling = load_model(q=5.0, r=0.0)
    unique = locked["unique"]
    carriage_ids = {"B22", "B23", "B24", "B25", "B26", "B27"}
    records = []
    records.extend(export_parts(carriage_out, [spec for spec in unique if spec.bom_id in carriage_ids]))
    records.extend(export_parts(binder_out, [spec for spec in unique if spec.bom_id not in carriage_ids]))
    assembly_locked = export_world(carriage_out, locked["world"], "MANTIS-TERRARIUM-CARRIAGE-BINDER-DRAFT.step")
    assembly_roll = export_world(carriage_out, rolling["world"], "MANTIS-TERRARIUM-CARRIAGE-BINDER-Q5-DRAFT.step")
    report = {
        "maturity": "DRAFT",
        "authority": "occt-ocp",
        "freecadcmd": False,
        "openscadAuthority": False,
        "evidenceClass": "theoretical/UNVERIFIED",
        "parentFrameAdmitted": False,
        "parts": records,
        "assemblyLocked": assembly_locked,
        "assemblyRolling": assembly_roll,
        "paramsSha256": locked["contract"]["paramsSha256"],
        "busSha256": locked["contract"]["busSha256"],
        "electrical": locked["contract"]["electrical"],
    }
    (carriage_out / "occt-export-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"ok": True, "parts": len(records), "locked": assembly_locked["step"], "rolling": assembly_roll["step"]}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
