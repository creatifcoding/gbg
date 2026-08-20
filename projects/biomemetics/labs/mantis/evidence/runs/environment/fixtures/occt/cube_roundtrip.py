# Environment-only 10 mm cube. This is not terrarium CAD authority.
# FreeCADCmd cube_roundtrip.py /path/to/cube.step

from __future__ import annotations

import sys

import FreeCAD as App
import Part


def volume_of(shape: Part.Shape) -> float:
    return float(shape.Volume)


def main() -> int:
    output = sys.argv[-1]
    box = Part.makeBox(10.0, 10.0, 10.0)
    source_volume = volume_of(box)
    if abs(source_volume - 1000.0) > 1e-6:
        print(f"source volume {source_volume} != 1000", file=sys.stderr)
        return 1
    box.exportStep(output)
    imported = Part.Shape()
    imported.read(output)
    imported_volume = volume_of(imported)
    if abs(imported_volume - source_volume) > 1e-6:
        print(
            f"STEP re-import volume {imported_volume} != source {source_volume}",
            file=sys.stderr,
        )
        return 1
    print(f"occt-roundtrip ok volume_mm3={imported_volume}")
    return 0


if __name__ == "__main__":
    App.Console.PrintMessage("mantis environment OCCT cube roundtrip\n")
    raise SystemExit(main())
