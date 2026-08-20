#!/usr/bin/env python3
"""Build the combined A3 schematic PDF from the canonical SVG sheets.

The build is deliberately vector-only: Inkscape converts each SVG to a
single-page PDF while retaining text, then pypdf combines those pages without
rendering them.  There is no bitmap fallback because a rasterized drawing is
not an acceptable shop artifact.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter


SCHEMATICS = Path(__file__).resolve().parent
OUTPUT = SCHEMATICS / "schematics.pdf"
SHEET_NAME = re.compile(r"^S(?P<number>\d{2})-[a-z0-9-]+\.svg$")
EXPECTED_SHEETS = tuple(range(12))


def source_sheets() -> list[Path]:
    """Return S00 through S11, rejecting missing or duplicate sheet numbers."""

    by_number: dict[int, Path] = {}
    for path in SCHEMATICS.glob("S??-*.svg"):
        match = SHEET_NAME.fullmatch(path.name)
        if match is None:
            continue
        number = int(match.group("number"))
        if number in by_number:
            raise RuntimeError(
                f"duplicate sheet S{number:02d}: {by_number[number].name}, {path.name}"
            )
        by_number[number] = path

    actual = tuple(sorted(by_number))
    if actual != EXPECTED_SHEETS:
        expected = ", ".join(f"S{number:02d}" for number in EXPECTED_SHEETS)
        found = ", ".join(f"S{number:02d}" for number in actual) or "none"
        raise RuntimeError(f"expected {expected}; found {found}")
    return [by_number[number] for number in EXPECTED_SHEETS]


def build() -> Path:
    """Convert the canonical SVG sheets and atomically replace the combined PDF."""

    inkscape = shutil.which("inkscape")
    if inkscape is None:
        raise RuntimeError("Inkscape is required; no raster fallback is permitted")

    writer = PdfWriter()
    with tempfile.TemporaryDirectory(prefix="mantis-schematics-") as temp_name:
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
            page_pdf = temp_dir / f"{svg.stem}.pdf"
            conversion = subprocess.run(
                [
                    inkscape,
                    "--export-area-page",
                    "--export-type=pdf",
                    f"--export-filename={page_pdf}",
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
            reader = PdfReader(page_pdf)
            if len(reader.pages) != 1:
                raise RuntimeError(f"{svg.name} produced {len(reader.pages)} PDF pages")
            writer.add_page(reader.pages[0])

    writer.add_metadata(
        {
            "/Title": "Particle-base mantis terrarium — draft CAD schematics",
            "/Author": "Mantis Lab",
            "/Subject": "Working draft B projected CAD; not shop-release; verify against first article",
            "/Creator": "terrarium/schematics/build_pdf.py (Inkscape + pypdf)",
            "/Keywords": "gbg#41 draft-cad S00-S11 HLR B-41P",
        }
    )
    temporary_output = OUTPUT.with_suffix(".pdf.tmp")
    with temporary_output.open("wb") as stream:
        writer.write(stream)
    temporary_output.replace(OUTPUT)
    return OUTPUT


if __name__ == "__main__":
    print(build())
