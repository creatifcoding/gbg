from __future__ import annotations

import hashlib
from pathlib import Path

from frame.contract import d


def _svg(width: float, height: float, name: str, status: str) -> str:
    return "\n".join(
        [
            '<?xml version="1.0" encoding="UTF-8"?>',
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}mm" height="{height}mm" viewBox="0 0 {width} {height}">',
            f'  <title>{name} {status}</title>',
            f'  <rect x="0" y="0" width="{width}" height="{height}" fill="none" stroke="#000" stroke-width="0.1"/>',
            "</svg>",
            "",
        ]
    )


def _dxf(width: float, height: float) -> str:
    pts = [(0, 0), (width, 0), (width, height), (0, height), (0, 0)]
    lines = ["0", "SECTION", "2", "ENTITIES"]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        lines.extend(
            [
                "0",
                "LINE",
                "8",
                "cut",
                "10",
                f"{x0:.4f}",
                "20",
                f"{y0:.4f}",
                "30",
                "0.0",
                "11",
                f"{x1:.4f}",
                "21",
                f"{y1:.4f}",
                "31",
                "0.0",
            ]
        )
    lines.extend(["0", "ENDSEC", "0", "EOF", ""])
    return "\n".join(lines)


def write_cut_profiles(contract: dict, out_dir: Path) -> list[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    clear_w = d(contract, "animal.clear.width").value
    clear_h = d(contract, "animal.clear.height").value
    kerf = d(contract, "cut.kerf").value
    digest = contract["paramsSha256"][:12]
    written: list[Path] = []
    specs = (
        ("B05-view-cassette-nominal", clear_w, clear_h, "REF"),
        ("B06-front-door-nominal", clear_w, clear_h, "REF"),
        (
            f"B05-view-cassette-kerf-{kerf:.2f}-src-{digest}",
            clear_w + kerf,
            clear_h + kerf,
            "REF-kerf-compensated",
        ),
        (
            f"B06-front-door-kerf-{kerf:.2f}-src-{digest}",
            clear_w + kerf,
            clear_h + kerf,
            "REF-kerf-compensated",
        ),
    )
    for name, width, height, status in specs:
        svg_path = out_dir / f"{name}.svg"
        dxf_path = out_dir / f"{name}.dxf"
        svg_path.write_text(_svg(width, height, name, status), encoding="utf-8")
        dxf_path.write_text(_dxf(width, height), encoding="utf-8")
        written.extend([svg_path, dxf_path])
    manifest = out_dir / "cut-profiles.sha256"
    lines = []
    for path in written:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        lines.append(f"{digest}  {path.name}")
    manifest.write_text("\n".join(lines) + "\n", encoding="utf-8")
    written.append(manifest)
    return written
