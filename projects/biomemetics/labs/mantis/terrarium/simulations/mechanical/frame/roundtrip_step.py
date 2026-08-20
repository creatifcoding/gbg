"""Independent FreeCADCmd STEP re-import. Not a physical measurement."""

from __future__ import annotations

import json
import sys
from pathlib import Path

SRC_ROOT = Path(__file__).resolve().parents[4] / "terrarium" / "cad" / "src"
REPORTS = Path(__file__).resolve().parent / "reports"
ASSEMBLY = SRC_ROOT / "frame" / "exports" / "MANTIS-TERRARIUM-FRAME-RAIL-B20-DRAFT.step"


def main() -> None:
    try:
        import Part  # type: ignore
    except ImportError as exc:
        raise SystemExit("BLOCKED: FreeCAD Part is not importable") from exc
    if not ASSEMBLY.is_file():
        raise SystemExit(f"missing assembly STEP: {ASSEMBLY}")
    shape = Part.Shape()
    shape.read(str(ASSEMBLY))
    bbox = shape.BoundBox
    report = {
        "maturity": "DRAFT",
        "sourceClass": "calculated",
        "epistemic": "UNVERIFIED",
        "step": "terrarium/cad/src/frame/exports/MANTIS-TERRARIUM-FRAME-RAIL-B20-DRAFT.step",
        "isValid": bool(shape.isValid()) if hasattr(shape, "isValid") else None,
        "solidCount": len(shape.Solids),
        "volumeMm3": float(shape.Volume),
        "bboxMm": [bbox.XMin, bbox.YMin, bbox.ZMin, bbox.XMax, bbox.YMax, bbox.ZMax],
        "note": "Re-import agrees with OCCT write only if isValid is true. This is not a coupon measurement.",
    }
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / "step-roundtrip.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({"ok": report["isValid"], "solids": report["solidCount"]}))
    if report["isValid"] is False:
        sys.exit(1)


if __name__ == "__main__":
    main()
