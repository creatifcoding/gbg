"""FreeCAD Part/OCCT exporter for the DRAFT frame/rail/B20 authority.

Run:
  freecadcmd -c "import runpy; runpy.run_path('terrarium/cad/src/frame/export_freecad.py', run_name='__main__')"
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SRC_ROOT = Path(__file__).resolve().parents[1]
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from boundary.profiles import write_cut_profiles  # noqa: E402
from frame.assembly import load_model  # noqa: E402
from frame.csg import Box, CylinderZ, SolidSpec  # noqa: E402


def _freecad():
    try:
        import FreeCAD  # type: ignore
        import Mesh  # type: ignore
        import Part  # type: ignore
    except ImportError as exc:
        raise SystemExit(
            "BLOCKED: FreeCAD Part/OCCT is not importable. "
            "Enter the fabrication shell and rerun FreeCADCmd on this file."
        ) from exc
    return FreeCAD, Part, Mesh


def _write_binary_stl(body, path: Path) -> None:
    _, _, Mesh = _freecad()
    mesh = Mesh.Mesh(body.tessellate(0.1))
    mesh.write(str(path), "BSTL")


def _body(Part, Vector, spec: SolidSpec):
    solids = []
    for box in spec.adds:
        if box.dx <= 0 or box.dy <= 0 or box.dz <= 0:
            continue
        solids.append(Part.makeBox(box.dx, box.dy, box.dz, Vector(box.xmin, box.ymin, box.zmin)))
    if not solids:
        return None
    body = solids[0]
    for extra in solids[1:]:
        body = body.fuse(extra)
    for cut in spec.cuts:
        if isinstance(cut, Box):
            if cut.dx <= 0 or cut.dy <= 0 or cut.dz <= 0:
                continue
            body = body.cut(
                Part.makeBox(cut.dx, cut.dy, cut.dz, Vector(cut.xmin, cut.ymin, cut.zmin))
            )
        elif isinstance(cut, CylinderZ):
            body = body.cut(
                Part.makeCylinder(
                    cut.diameter / 2.0,
                    cut.height,
                    Vector(cut.x, cut.y, cut.zmin),
                    Vector(0, 0, 1),
                )
            )
    return body


def export_parts(out_dir: Path, specs: list[SolidSpec]) -> list[dict]:
    FreeCAD, Part, _Mesh = _freecad()
    Vector = FreeCAD.Vector
    out_dir.mkdir(parents=True, exist_ok=True)
    records = []
    for spec in specs:
        if not spec.unique_part:
            continue
        body = _body(Part, Vector, spec)
        if body is None:
            continue
        step_path = out_dir / f"{spec.solid_id}.step"
        stl_path = out_dir / f"{spec.solid_id}.stl"
        body.exportStep(str(step_path))
        _write_binary_stl(body, stl_path)
        bbox = body.BoundBox
        records.append(
            {
                "solidId": spec.solid_id,
                "bomId": spec.bom_id,
                "status": spec.status,
                "isClosed": bool(body.isClosed()),
                "isValid": bool(body.isValid()),
                "volumeMm3": float(body.Volume),
                "solidCount": len(body.Solids),
                "bboxMm": [bbox.XMin, bbox.YMin, bbox.ZMin, bbox.XMax, bbox.YMax, bbox.ZMax],
                "step": step_path.name,
                "stl": stl_path.name,
            }
        )
    return records


def export_assembly(out_dir: Path, world: list[SolidSpec]) -> dict:
    FreeCAD, Part, _Mesh = _freecad()
    Vector = FreeCAD.Vector
    shapes = []
    for spec in world:
        if spec.kind in {"keep-out", "declaration", "conductor-proxy"}:
            continue
        body = _body(Part, Vector, spec)
        if body is None:
            continue
        shapes.append(body)
    if not shapes:
        raise SystemExit("no assembly solids")
    compound = shapes[0]
    for extra in shapes[1:]:
        compound = compound.fuse(extra)
    step_path = out_dir / "MANTIS-TERRARIUM-FRAME-RAIL-B20-DRAFT.step"
    compound.exportStep(str(step_path))
    bbox = compound.BoundBox
    return {
        "step": step_path.name,
        "isValid": bool(compound.isValid()) if hasattr(compound, "isValid") else None,
        "volumeMm3": float(compound.Volume),
        "solidCount": len(compound.Solids),
        "bboxMm": [bbox.XMin, bbox.YMin, bbox.ZMin, bbox.XMax, bbox.YMax, bbox.ZMax],
        "coordinateFrame": "frame.world",
        "axes": {"x": "right", "y": "back", "z": "up"},
        "maturity": "DRAFT",
    }


def main() -> None:
    model = load_model()
    contract = model["contract"]
    src = Path(__file__).resolve().parents[1]
    frame_out = src / "frame" / "exports"
    rail_out = src / "rail" / "exports"
    boundary_out = src / "boundary" / "exports"
    unique = model["unique"] + model["b20"]
    frame_ids = {"B01", "B02", "B03", "B04", "B10"}
    rail_ids = {"B18", "B51", "B52"}
    records = []
    records.extend(export_parts(frame_out, [spec for spec in unique if spec.bom_id in frame_ids]))
    records.extend(export_parts(rail_out, [spec for spec in unique if spec.bom_id in rail_ids]))
    records.extend(
        export_parts(boundary_out, [spec for spec in unique if spec.bom_id not in frame_ids | rail_ids])
    )
    assembly = export_assembly(frame_out, model["world"])
    profiles = write_cut_profiles(contract, boundary_out / "profiles")
    report = {
        "maturity": "DRAFT",
        "authority": "freecad-part-occt",
        "openscadAuthority": False,
        "parts": records,
        "assembly": assembly,
        "cutProfiles": [path.name for path in profiles],
        "paramsSha256": contract["paramsSha256"],
        "busSha256": contract["busSha256"],
    }
    (frame_out / "occt-export-report.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"ok": True, "parts": len(records), "assembly": assembly["step"]}))


if __name__ == "__main__":
    main()
