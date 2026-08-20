#!/usr/bin/env python3
"""Raster S00–S11 SVG sheets to HITL PNGs.

HITL Look is visual aesthetic only. The PNGs exist so a human can judge
shop-drawing appearance (same balloons and scale as the SVG). A PNG does
not prove geometry or safety.
"""

from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from build_pdf import source_sheets


SCHEMATICS = Path(__file__).resolve().parent
HITL = SCHEMATICS / "hitl"
# ~150 dpi on A3 (420 mm x 297 mm) is readable on a laptop without claiming scale.
EXPORT_DPI = "150"


def export() -> list[Path]:
    inkscape = shutil.which("inkscape")
    if inkscape is None:
        raise RuntimeError("Inkscape is required to raster HITL sheets from SVG")

    HITL.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    with tempfile.TemporaryDirectory(prefix="mantis-hitl-") as temp_name:
        temp_dir = Path(temp_name)
        environment = os.environ.copy()
        environment.update(
            {
                "XDG_CACHE_HOME": str(temp_dir / "cache"),
                "XDG_CONFIG_HOME": str(temp_dir / "config"),
                "XDG_DATA_HOME": str(temp_dir / "data"),
            }
        )
        for svg in source_sheets():
            png = HITL / f"{svg.stem}.png"
            conversion = subprocess.run(
                [
                    inkscape,
                    "--export-area-page",
                    "--export-type=png",
                    f"--export-dpi={EXPORT_DPI}",
                    f"--export-filename={png}",
                    str(svg),
                ],
                env=environment,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            if conversion.returncode != 0:
                detail = conversion.stderr.strip() or conversion.stdout.strip()
                raise RuntimeError(f"Inkscape failed for {svg.name}: {detail}")
            if not png.is_file() or png.stat().st_size == 0:
                raise RuntimeError(f"Inkscape wrote no PNG for {svg.name}")
            written.append(png)
    return written


if __name__ == "__main__":
    for path in export():
        print(path)
