#!/usr/bin/env python3
"""FreeCADCmd STEP export/reimport dimensional agreement fixture."""

from __future__ import annotations

import sys
from pathlib import Path

import FreeCAD as App
import Part


def main() -> int:
    out = Path(sys.argv[1] if len(sys.argv) > 1 else ".")
    out.mkdir(parents=True, exist_ok=True)
    step_path = out / "ref-box.step"

    doc = App.newDocument("mantis_doctor_box")
    box = doc.addObject("Part::Box", "Box")
    box.Length = 10.0
    box.Width = 20.0
    box.Height = 30.0
    doc.recompute()
    Part.export([box], str(step_path))

    shape = Part.Shape()
    shape.read(str(step_path))
    bb = shape.BoundBox
    tol = 1e-3
    checks = [
        ("X", bb.XLength, 10.0),
        ("Y", bb.YLength, 20.0),
        ("Z", bb.ZLength, 30.0),
    ]
    for name, got, want in checks:
        if abs(got - want) > tol:
            print(f"FAIL {name}: got={got} want={want}", file=sys.stderr)
            return 1
    print(f"ok step={step_path} dims=10x20x30")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
