#!/usr/bin/env python3
"""Compose A3 S00–S11 from OCCT hidden-line projections plus review diagrams.

Physical views are HLR polylines of STEP solids (PR 34 SHA fe8f875a… and
CAD-02 OCCT exports from this run). S08 remains an electrical diagram. S09
uses Particle datasheet envelopes, not a sourced brick STEP. This set is
DRAFT CAD, not shop-release (#31), not first-article.
"""

from __future__ import annotations

import hashlib
import html
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent
OUT.mkdir(parents=True, exist_ok=True)
PARAMS_PATH = ROOT / "params.json"
BUS_PATH = ROOT / "bus.json"
PROJ_PATH = OUT / "projections" / "manifest.json"

W, H = 420.0, 297.0
DRAW_BOTTOM = 257.0
DATE = "2026-08-20"
REV = "B-41P"

BASE_BRANCH = "cursor/mantis-cad-02-carriage-9635"
BASE_SHA = "cdd523c55a630962c399a812c9347be6f7fb9334"
LAB_MERGE_BASE = "1e6683272e4e15d50dd90b60fd3f7c0f3dd5bbb3"
CAD01_SHA = "fe8f875a80b37a1003f05f3a0190fbe2f0417842"
CAD02_SHA = BASE_SHA
EE23_SHA = "750872f4c10317a0e9f9900501882968531d332d"
EE24_SHA = "2324e7e521a306e5f9605c04e08a4223b7c77212"
EE25_SHA = "977b272a3e32ed9e9eda7a1b44b545770352c972"
EE26_SHA = "a9918b32ebac41b03f0ba55fd189c73bc7df05e7"


def _load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain an object")
    return value


def load_contracts() -> dict[str, Any]:
    params_doc = _load(PARAMS_PATH)
    bus_doc = _load(BUS_PATH)
    if params_doc.get("revision") != "B-draft" or bus_doc.get("release") != "B-draft":
        raise ValueError("schematic generation requires matching B-draft contracts")
    records = params_doc.get("parameters")
    if not isinstance(records, dict):
        raise ValueError("params.json requires a parameters object")

    def parameter(name: str) -> Any:
        record = records.get(name)
        if not isinstance(record, dict) or "value" not in record:
            raise ValueError(f"missing valued parameter {name}")
        return record["value"]

    def parameter_range(name: str) -> tuple[Any, Any]:
        record = records.get(name)
        bounds = record.get("range") if isinstance(record, dict) else None
        if not isinstance(bounds, dict) or "minimum" not in bounds or "maximum" not in bounds:
            raise ValueError(f"missing range for parameter {name}")
        return bounds["minimum"], bounds["maximum"]

    contacts = bus_doc.get("contacts")
    expected = [
        ("P01", "VIN-A", "continuous", "power"),
        ("P02", "VIN-B", "continuous", "power"),
        ("P03", "GND-A", "continuous", "return"),
        ("P04", "GND-B", "continuous", "return"),
        ("P05", "SDA", "continuous", "control"),
        ("P06", "SCL", "continuous", "control"),
        ("P07", "UID", "continuous", "identity"),
        ("P08", "FAULT_N/IRQ", "continuous", "diagnostic"),
        ("P09", "HSGND", "discrete-dock", "high-speed-ground"),
        ("P10", "GMSL+", "discrete-dock", "high-speed-positive"),
        ("P11", "GMSL-", "discrete-dock", "high-speed-negative"),
        ("P12", "HSGND", "discrete-dock", "high-speed-ground"),
    ]
    actual = []
    if isinstance(contacts, list):
        actual = [
            (item.get("pin"), item.get("net"), item.get("geometry"), item.get("role"))
            for item in contacts
            if isinstance(item, dict)
        ]
    if actual != expected:
        raise ValueError("bus contact order no longer matches the drawing lock")

    values = {
        "pitch_mm": parameter("frame.module_pitch"),
        "span_mm": parameter("frame.first_span"),
        "frame_w": parameter("frame.band"),
        "panel_t": parameter("panel.stock_thickness"),
        "rail_w": parameter("rail.envelope.width"),
        "rail_h": parameter("rail.envelope.height"),
        "rail_wall": parameter("rail.side_wall"),
        "strip_count": parameter("rail.contact_count"),
        "pogo_pitch": parameter("rail.contact_pitch"),
        "contact_land_w": parameter("rail.contact_land_width"),
        "video_dock_count": parameter("rail.video_dock_count_per_span"),
        "pogo_compression": parameter("pogo.working_compression"),
        "pogo_lift_min": parameter("pogo.released_contact_lift_min"),
        "pinch_force": parameter("carriage.pinch_force"),
        "binder_pull_off_min": parameter("binder.pull_off_min"),
        "screen_aperture_max": parameter("husbandry.screen.aperture_max"),
        "clear_w": parameter("animal.clear.width"),
        "clear_d": parameter("animal.clear.depth"),
        "clear_h": parameter("animal.clear.height"),
        "tray": parameter("false_bottom.tray_depth"),
    }
    pinch_min, pinch_max = parameter_range("carriage.pinch_force")
    values["pinch_force_min"] = pinch_min
    values["pinch_force_max"] = pinch_max
    contact_field = (values["strip_count"] - 1) * values["pogo_pitch"] + values["contact_land_w"]
    cavity_width = values["rail_w"] - 2 * values["rail_wall"]
    if contact_field > cavity_width:
        raise ValueError(
            f"contact field {contact_field:.3f} mm exceeds rail cavity {cavity_width:.3f} mm"
        )
    values["contact_field"] = contact_field
    values["video_dock_pitch"] = values["span_mm"] / values["video_dock_count"]
    return {
        "parameters": values,
        "contacts": contacts,
        "architecture": bus_doc.get("architecture", {}),
        "paramsSha256": hashlib.sha256(PARAMS_PATH.read_bytes()).hexdigest(),
        "busSha256": hashlib.sha256(BUS_PATH.read_bytes()).hexdigest(),
    }


def load_projections() -> dict[str, Any]:
    if not PROJ_PATH.is_file():
        return {"views": {}, "failed": [{"name": "*", "error": "projections/manifest.json missing"}]}
    return _load(PROJ_PATH)


CONTRACT = load_contracts()
PARAM = CONTRACT["parameters"]
BUS_CONTACTS = CONTRACT["contacts"]
MODULE_PITCH = PARAM["pitch_mm"]
SPAN = PARAM["span_mm"]
CONTACT_PITCH = PARAM["pogo_pitch"]
LAND_W = PARAM["contact_land_w"]
CONTACT_FIELD = PARAM["contact_field"]
RAIL_WIDTH = PARAM["rail_w"]
RAIL_HEIGHT = PARAM["rail_h"]
RAIL_WALL = PARAM["rail_wall"]
POGO_COMPRESSION = PARAM["pogo_compression"]
POGO_LIFT = PARAM["pogo_lift_min"]
PINCH_FORCE_MIN = PARAM["pinch_force_min"]
PINCH_FORCE_MAX = PARAM["pinch_force_max"]
BINDER_PULL_OFF = PARAM["binder_pull_off_min"]
SCREEN_APERTURE = PARAM["screen_aperture_max"]
CLEAR_W = PARAM["clear_w"]
CLEAR_D = PARAM["clear_d"]
CLEAR_H = PARAM["clear_h"]
TRAY = PARAM["tray"]
DOCK_PITCH = PARAM["video_dock_pitch"]
CLEARANCE_LIFT = round(POGO_COMPRESSION + POGO_LIFT, 6)

CAD01 = {
    "b01": (24.0, 24.0, 24.0),
    "b02": (250.0, 24.0, 24.0),
    "b03": (22.0, 24.0, 24.0),
    "b04": (250.0, 5.2, 12.0),
    "b18_250": (250.0, 38.0, 16.0),
    "b18_500": (500.0, 38.0, 16.0),
    "b20_bbox": (-8.0, -8.0, 0.0, 250.0, 250.0, 500.0),
    "b51": (8.0, 38.0, 17.5),
    "assembly_bbox": (-43.0, -43.0, -8.0, 258.0, 250.0, 508.0),
    "rail_offset": 5.0,
    "b52_t": 1.5,
    "slot": 0.4,
    "land_t": 0.2,
    "dock_pad": 18.0,
    "pocket_inset": 10.0,
    "pocket_z": 8.0,
    "seat_clear": 0.20,
    "kerf": 0.15,
    "molt": 142.0,
    "nymph_gap": 0.50,
    "b51_bore": 3.4,
}
CAD02 = {
    "b22": (60.0, 42.0, 28.0),
    "b24": (36.0, 32.0, 6.0),
    "b28": (24.0, 14.0, 10.0),
    "b29": (40.0, 36.0, 22.0),
    "b50": (18.0, 28.0, 4.0),
    "b50_key": 4.0,
    "cam_keepout": 32.0,
    "csi_keepout": 12.0,
    "q_s1": 1.0,
    "q_safe": 2.2,
    "q_clear": 4.0,
    "q_roll": 5.0,
    "throw": 2.2,
    "r_s2": 1.0,
    "r_safe": 2.0,
    "r_free": 3.5,
    "pogo_d": 1.0,
    "pogo_barrel": 6.0,
    "b26_d": 8.0,
}
VENDOR = {
    "tachyon_xyz": (85.0, 56.0, 18.5),
    "m1_xyz": (121.0, 220.0, 69.0),
}

PROJ = load_projections()
VIEWS: dict[str, Any] = PROJ.get("views", {}) if isinstance(PROJ.get("views"), dict) else {}


def esc(s: object) -> str:
    return html.escape(str(s), quote=True)


def has_view(*names: str) -> bool:
    return all(name in VIEWS for name in names)


def view_wh(name: str, scale_num: float, scale_denom: float) -> tuple[float, float]:
    box = VIEWS[name]["bbox2d"]
    factor = scale_num / scale_denom
    return (box[2] - box[0]) * factor, (box[3] - box[1]) * factor


class Sheet:
    def __init__(self, num: int, title: str, scale: str, *, nts: bool = False, status: str = "DRAFT CAD"):
        self.num = num
        self.title = title
        self.nts = nts
        self.scale = "NTS" if nts else scale
        self.status = status
        self.e: list[str] = []
        self._defs()
        self.rect(8, 8, 404, DRAW_BOTTOM - 8, "heavy")

    def _defs(self):
        self.e.append("""<defs>
  <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6,3 L0,6 z" fill="#15171a"/></marker>
  <marker id="arr-orange" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L6,3 L0,6 z" fill="#d65a24"/></marker>
  <pattern id="hatch" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="3" stroke="#7b7e83" stroke-width="0.25"/></pattern>
  <pattern id="screen" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0,0 L3,3 M3,0 L0,3" stroke="#88909a" stroke-width="0.18"/></pattern>
  <style>
    text { font-family: Arial, Helvetica, sans-serif; fill:#15171a; }
    .thin { stroke:#15171a; stroke-width:.28; fill:none; }
    .med { stroke:#15171a; stroke-width:.55; fill:none; }
    .heavy { stroke:#15171a; stroke-width:1.05; fill:none; }
    .hidden { stroke:#59616b; stroke-width:.22; stroke-dasharray:1.6 1.1; fill:none; }
    .phantom { stroke:#d65a24; stroke-width:.35; stroke-dasharray:5 1 1 1; fill:none; }
    .center { stroke:#73808d; stroke-width:.22; stroke-dasharray:4 1 1 1; fill:none; }
    .dim { stroke:#15171a; stroke-width:.25; fill:none; marker-start:url(#arr); marker-end:url(#arr); }
    .leader { stroke:#15171a; stroke-width:.3; fill:none; marker-end:url(#arr); }
    .motion { stroke:#d65a24; stroke-width:.55; fill:none; marker-end:url(#arr-orange); }
    .ref { fill:#ffffff; stroke:#15171a; stroke-width:.45; }
    .unverified { fill:#ffffff; stroke:#ba3d3d; stroke-width:.45; }
    .keepout { fill:#dd3c3c; fill-opacity:.08; stroke:#c63333; stroke-width:.35; stroke-dasharray:4 2; }
    .hlr { stroke:#15171a; stroke-width:.45; fill:none; stroke-linecap:round; stroke-linejoin:round; }
    .hlr-keep { stroke:#c63333; stroke-width:.4; fill:none; stroke-dasharray:3.5 2; }
    .metal { fill:#f3f3f3; stroke:#15171a; stroke-width:.35; }
    .plastic { fill:#ffffff; stroke:#15171a; stroke-width:.35; }
    .cut { fill:url(#hatch); stroke:#15171a; stroke-width:.45; }
  </style>
</defs>""")

    def line(self, x1, y1, x2, y2, cls="thin", color=None):
        extra = f' stroke="{color}"' if color else ""
        self.e.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" class="{cls}"{extra}/>')

    def rect(self, x, y, w, h, cls="thin", rx=0, fill=None, stroke=None):
        attrs = ""
        if fill is not None:
            attrs += f' fill="{fill}"'
        if stroke is not None:
            attrs += f' stroke="{stroke}"'
        self.e.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" class="{cls}"{attrs}/>')

    def circle(self, x, y, r, cls="thin", fill=None):
        attrs = f' fill="{fill}"' if fill is not None else ""
        self.e.append(f'<circle cx="{x}" cy="{y}" r="{r}" class="{cls}"{attrs}/>')

    def poly(self, pts, cls="thin", fill=None):
        attrs = f' fill="{fill}"' if fill is not None else ""
        p = " ".join(f"{x},{y}" for x, y in pts)
        self.e.append(f'<polygon points="{p}" class="{cls}"{attrs}/>')

    def path(self, d, cls="thin", fill=None):
        attrs = f' fill="{fill}"' if fill is not None else ""
        self.e.append(f'<path d="{d}" class="{cls}"{attrs}/>')

    def text(self, x, y, txt, size=3.0, weight="normal", anchor="start", cls="", color=None, rotate=None):
        attrs = f' class="{cls}"' if cls else ""
        if color:
            attrs += f' fill="{color}"'
        if rotate is not None:
            attrs += f' transform="rotate({rotate} {x} {y})"'
        self.e.append(
            f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}"{attrs}>{esc(txt)}</text>'
        )

    def paragraph(self, x, y, w, txt, size=2.8, leading=3.7, max_lines=12, weight="normal"):
        words = txt.split()
        max_chars = max(12, int(w / (size * 0.52)))
        lines, line = [], ""
        for word in words:
            if len(line) + len(word) + 1 <= max_chars:
                line = f"{line} {word}".strip()
            else:
                lines.append(line)
                line = word
        if line:
            lines.append(line)
        for i, ln in enumerate(lines[:max_lines]):
            self.text(x, y + i * leading, ln, size=size, weight=weight)
        return y + min(len(lines), max_lines) * leading

    def view_label(self, x, y, name, scale=None, *, projected=False, extra=""):
        self.text(x, y, name.upper(), 3.2, "bold")
        if scale:
            if projected:
                self.text(x, y + 3.8, f"SCALE {scale}  |  OCCT HLR", 2.2)
            elif scale.upper() == "NTS" or scale.upper().startswith("DIAGRAM"):
                self.text(x, y + 3.8, "SCALE NTS - DO NOT SCALE", 2.2)
            else:
                self.text(x, y + 3.8, f"SCALE {scale}", 2.2)
        if extra:
            self.text(x, y + 7.4, extra, 2.0)

    def dim_h(self, x1, x2, y, obj_y, label):
        self.line(x1, obj_y, x1, y, "thin")
        self.line(x2, obj_y, x2, y, "thin")
        self.line(x1, y, x2, y, "dim")
        self.text((x1 + x2) / 2, y - 1.4, label, 2.7, anchor="middle")

    def dim_v(self, y1, y2, x, obj_x, label):
        self.line(obj_x, y1, x, y1, "thin")
        self.line(obj_x, y2, x, y2, "thin")
        self.line(x, y1, x, y2, "dim")
        self.text(x - 1.7, (y1 + y2) / 2, label, 2.7, anchor="middle", rotate=-90)

    def balloon(self, x, y, n, tx=None, ty=None):
        self.circle(x, y, 4.0, "med", fill="#ffffff")
        self.text(x, y + 1.2, n, 2.6, "bold", "middle")
        if tx is not None and ty is not None:
            self.line(x, y + 4, tx, ty, "leader")

    def note_box(self, x, y, w, title, lines, kind="normal"):
        h = 7 + len(lines) * 4.0
        cls = "med" if kind != "warn" else "unverified"
        self.rect(x, y, w, h, cls, rx=0, fill="#ffffff")
        self.text(x + 3, y + 4.4, title, 2.8, "bold")
        for i, ln in enumerate(lines):
            self.text(x + 3, y + 9 + i * 4, ln, 2.45)
        return h

    def scale_bar(self, x, y, *, model_mm=50, scale_num=1, scale_denom=5):
        paper = model_mm * scale_num / scale_denom
        self.line(x, y + 5, x + paper, y + 5, "heavy")
        ticks = 5
        for i in range(ticks + 1):
            tx = x + paper * i / ticks
            self.line(tx, y + 3.2, tx, y + 6.8, "med")
            self.text(tx, y + 2.4, f"{model_mm * i / ticks:g}", 1.8, anchor="middle")
        self.text(x + paper + 3, y + 5.6, f"mm  @ {scale_num:g}:{scale_denom:g}", 2.1)

    def scale_bar_nts(self, x, y):
        self.rect(x, y, 58, 8, "unverified", rx=0, fill="#ffffff")
        self.text(x + 29, y + 5.2, "NTS - DO NOT SCALE", 2.3, "bold", "middle", color="#ba3d3d")

    def color_legend(self, x, y):
        self.text(x, y, "COLOR KEY (SHOP LINE ART)", 2.2, "bold")
        self.line(x, y + 4, x + 10, y + 4, "heavy")
        self.text(x + 12, y + 5.2, "geometry", 2.1)
        self.line(x + 42, y + 4, x + 52, y + 4, "motion")
        self.text(x + 54, y + 5.2, "motion", 2.1)
        self.rect(x + 82, y + 1.2, 10, 5, "keepout")
        self.text(x + 94, y + 5.2, "keep-out", 2.1)
        self.line(x + 128, y + 4, x + 138, y + 4, "med", color="#0a7891")
        self.text(x + 140, y + 5.2, "electrical net", 2.1)

    def unprojected_box(self, x, y, w, h, name):
        self.rect(x, y, w, h, "unverified", fill="#ffffff")
        self.text(x + w / 2, y + h / 2 - 2, "UNPROJECTED", 3.0, "bold", "middle", color="#ba3d3d")
        self.text(x + w / 2, y + h / 2 + 3, name, 2.2, "middle")

    def place_hlr(self, name, ox, oy, scale_num, scale_denom, *, cls="hlr", hidden=True):
        view = VIEWS.get(name)
        if view is None:
            self.unprojected_box(ox, oy, 48, 28, name)
            return None
        factor = scale_num / scale_denom
        xmin, ymin, xmax, ymax = view["bbox2d"]

        def paper(pt):
            return ox + (pt[0] - xmin) * factor, oy + (ymax - pt[1]) * factor

        def emit(strokes, stroke_cls):
            for poly in strokes:
                if len(poly) < 2:
                    continue
                mapped = [paper(pt) for pt in poly]
                d = f"M{mapped[0][0]:.3f} {mapped[0][1]:.3f}" + "".join(
                    f" L{px:.3f} {py:.3f}" for px, py in mapped[1:]
                )
                self.path(d, stroke_cls)

        if hidden:
            emit(view.get("hidden") or [], "hidden")
        emit(view.get("visible") or [], cls)
        return (xmax - xmin) * factor, (ymax - ymin) * factor

    def title_block(self):
        y = DRAW_BOTTOM
        self.line(8, y, 412, y, "heavy")
        self.rect(8, y, 404, 32, "med")
        self.line(270, y, 270, 289, "med")
        self.line(334, y, 334, 289, "med")
        self.line(376, y, 376, 289, "med")
        self.line(270, y + 11, 412, y + 11, "thin")
        self.line(270, y + 21, 412, y + 21, "thin")
        self.text(13, y + 8, "PARTICLE-BASE MANTIS TERRARIUM", 5.0, "bold")
        self.text(13, y + 15, self.title, 4.0, "bold")
        if self.nts:
            banner = "THEORETICAL - VERIFY AGAINST STEP / FIRST ARTICLE"
        else:
            banner = "DRAFT CAD - NOT SHOP-RELEASE (#31) / NOT FIRST ARTICLE"
        self.text(13, y + 23, banner, 2.8, "bold", color="#ba3d3d")
        self.text(
            13,
            y + 28,
            "Units: mm | Projection: THIRD-ANGLE (ASME Y14.3) | Color: nets / motion / keep-out only",
            2.2,
        )
        fields = [
            (273, y + 4, "SCALE", self.scale),
            (337, y + 4, "DATE", DATE),
            (379, y + 4, "REV", REV),
            (273, y + 15, "SHEET", f"{self.num + 1:02d} OF 12 / S{self.num:02d}"),
            (337, y + 15, "STATUS", self.status),
            (379, y + 15, "DRAWN", "GBG#41"),
            (273, y + 25, "DWG", f"MT-S{self.num:02d}"),
            (337, y + 25, "FORMAT", "A3 SVG/PDF"),
            (379, y + 25, "TOL", "AS NOTED"),
        ]
        for x, yy, lab, val in fields:
            self.text(x, yy, lab, 1.9, "bold")
            self.text(x, yy + 4, val, 2.5)
        self.path(f"M226 {y + 19} L238 {y + 16} L238 {y + 27} L226 {y + 24} Z", "med")
        self.circle(246, y + 21.5, 6, "med")
        self.text(236, y + 30, "3RD ANGLE", 1.8, "bold", anchor="middle")
        if self.nts:
            self.rect(196, y + 7, 58, 7, "unverified")
            self.text(225, y + 11.8, "NTS - DO NOT SCALE", 2.0, "bold", "middle", color="#ba3d3d")
        else:
            self.rect(196, y + 7, 58, 7, "ref")
            self.text(225, y + 11.8, "TRUE-SCALE HLR", 2.0, "bold", "middle")
        self.line(198, y + 17, 206, y + 17, "heavy")
        self.text(208, y + 18.2, "geom", 1.7)
        self.line(198, y + 21.5, 206, y + 21.5, "motion")
        self.text(208, y + 22.7, "motion", 1.7)
        self.rect(198, y + 24.2, 8, 3.2, "keepout")
        self.text(208, y + 26.8, "keep-out", 1.7)
        self.line(198, y + 30.2, 206, y + 30.2, "med", color="#0a7891")
        self.text(208, y + 31.4, "net", 1.7)

    def write(self, filename):
        self.title_block()
        svg = (
            ['<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 420 297">',
             '<rect width="420" height="297" fill="#ffffff"/>']
            + self.e
            + ["</svg>"]
        )
        (OUT / filename).write_text("\n".join(svg), encoding="utf-8")


def sheet00():
    s = Sheet(0, "COVER / THEORY", "1:8")
    s.text(12, 17, "READABLE THEORY OF THE MACHINE", 8, "bold")
    s.text(12, 24, "HLR of PR 34 assembly STEP. Interior remains plastic, screened, animal-safe.", 3.2)
    s.view_label(12, 32, "Isometric assembly", "1:8", projected=True, extra=f"DRAFT-MEASURED  {CAD01_SHA[:12]}  PR 34")
    placed = s.place_hlr("assembly-iso", 18, 42, 1, 8)
    if placed:
        s.dim_h(18, 18 + placed[0], 42 + placed[1] + 8, 42 + placed[1], "ISO BBOX 1:8")
    s.note_box(255, 16, 148, "SYSTEM THEORY", [
        f"{MODULE_PITCH:g} mm block perimeter; {SPAN:g} mm first tower.",
        "P01-P08: protected continuous VIN/GND/I2C/UID/P08.",
        "P09-P12: indexed GMSL2 only while stationary.",
        "Raw MIPI stays binder-local and Tachyon-local.",
        "Pinch is break-before-move; video off while rolling.",
        "M1/Tachyon brick never enters the animal cage.",
    ])
    s.note_box(255, 68, 148, "LOCKED SAFETY BOUNDARY", [
        f"Upper-third molt keep-out {CAD01['molt']:g} mm CALCULATED.",
        f"Ceiling/vents: <= {SCREEN_APERTURE:g} mm non-metal LOCK.",
        "B20 is the continuous wet-side barrier (PR 34 STEP).",
        "Door front/side; nymph-visible gap <=0.50 TARGET.",
        "No taxon inferred: no live-mantis photo supplied.",
    ], "warn")
    s.note_box(255, 120, 148, "MEASURED THIS RUN (DRAFT CAD/EE)", [
        f"CAD-01/#28  {CAD01_SHA[:12]}  PR 34 STEP (read-only)",
        f"CAD-02/#29  {CAD02_SHA[:12]}  OCCT carriage STEP",
        "CAD-02 does not admit PR 34 as released parent.",
        "EE-23..26  PRs 37-40  (read-only)",
        "No Particle camera SKU or CSI pin table drawn.",
    ], "ref")
    s.note_box(255, 176, 148, "DRAWING STATUS", [
        "Projected views: OCCT HLRBRep of STEP solids.",
        "S08 is a review diagram; KiCad is circuit authority.",
        "S09 uses datasheet envelopes, not a brick STEP.",
        "Not #31 shop-release. Not first-article.",
    ], "ref")
    s.scale_bar(12, 232, model_mm=80, scale_num=1, scale_denom=8)
    s.color_legend(78, 232)
    s.write("S00-cover.svg")


def sheet01():
    s = Sheet(1, "ORTHOGRAPHIC ASSEMBLY", "1:5")
    n, d = 1, 5
    gap = 8
    ox, oy = 18, 14
    th = view_wh("assembly-top", n, d)[1] if has_view("assembly-top") else 59
    fw, fh = view_wh("assembly-front", n, d) if has_view("assembly-front") else (60, 103)
    rw = view_wh("assembly-right", n, d)[0] if has_view("assembly-right") else 59
    s.view_label(ox, oy, "Top plan", "1:5", projected=True, extra="DRAFT-MEASURED PR 34")
    s.place_hlr("assembly-top", ox, oy + 10, n, d)
    s.view_label(ox, oy + 12 + th, "Front elevation", "1:5", projected=True)
    s.place_hlr("assembly-front", ox, oy + 22 + th, n, d)
    s.view_label(ox + fw + gap, oy + 12 + th, "Right elevation", "1:5", projected=True)
    s.place_hlr("assembly-right", ox + fw + gap, oy + 22 + th, n, d)
    s.view_label(ox + fw + gap + rw + gap, oy + 12 + th, "B20 barrier", "1:5", projected=True, extra="KEEP-OUT")
    s.place_hlr("b20-front", ox + fw + gap + rw + gap, oy + 22 + th, n, d, cls="hlr-keep")
    fy = oy + 22 + th
    s.dim_h(ox, ox + fw, fy + fh + 6, fy + fh, f"{CAD01['assembly_bbox'][3]-CAD01['assembly_bbox'][0]:g} CAD-01 BBOX")
    s.dim_v(fy, fy + fh, ox - 6, ox, f"{CAD01['assembly_bbox'][5]-CAD01['assembly_bbox'][2]:g} CAD-01 BBOX")
    nx = 250
    s.note_box(nx, 16, 152, "LOCKED ENVELOPE", [
        "Exterior: 250 W x 250 D x 500 H LOCK.",
        "Module datum repeats at 250 mm.",
        f"Nominal clear: {CLEAR_W:g} x {CLEAR_D:g} x {CLEAR_H:g} CALCULATED.",
        f"HLR bbox X {CAD01['assembly_bbox'][0]:g}..{CAD01['assembly_bbox'][3]:g},",
        f"Y {CAD01['assembly_bbox'][1]:g}..{CAD01['assembly_bbox'][4]:g}, Z {CAD01['assembly_bbox'][2]:g}..{CAD01['assembly_bbox'][5]:g}.",
    ], "ref")
    s.note_box(nx, 64, 152, "PROJECTION", [
        "Third-angle from PR 34 assembly STEP.",
        "Front is the door/view cassette face (Y=0).",
        f"Rail offset {CAD01['rail_offset']:g} mm REF outside frame.",
        "Hidden lines: OCCT HLRBRep. CAD-02 not parent.",
    ])
    s.note_box(nx, 108, 152, "INTERFACE DATUMS", [
        "A: exterior block face (frame.world origin).",
        "B: cassette seat plane.",
        "C: rail conductor centerline (external).",
        f"D: false-bottom tray {TRAY:g} mm REF.",
        f"Molt datum: {CAD01['molt']:g} mm CALCULATED.",
    ])
    s.scale_bar(18, 236, model_mm=50, scale_num=1, scale_denom=5)
    s.write("S01-ortho.svg")


def sheet02():
    s = Sheet(2, "EXPLODED ASSEMBLY", "AS NOTED")
    s.view_label(13, 15, "Unique-part HLR along service axis", "AS NOTED", projected=True,
                 extra="CAD-01 unique STEP + CAD-02 unique STEP. Not a fused explode of one assembly.")
    stack = [
        ("b10-top", "B10", "CEILING FRAME", 1, 10),
        ("b02-front", "B02", "EDGE 250", 1, 5),
        ("b05-front", "B05", "VIEW CASSETTE", 1, 12),
        ("b03-front", "B03", "SPLICE", 1, 1),
        ("b14-top", "B14", "FALSE BOTTOM", 1, 10),
        ("b01-front", "B01", "CORNER", 1, 1),
    ]
    y = 32
    for name, bid, label, num, den in stack:
        placed = s.place_hlr(name, 70, y, num, den)
        h = placed[1] if placed else 16
        s.balloon(32, y + h / 2, bid, 68, y + h / 2)
        s.text(12, y + 4, f"{num}:{den}", 2.0)
        s.text(200, y + h / 2, label, 2.5, "bold")
        y += h + 6
    s.view_label(250, 15, "Rail / carriage / binder group", "AS NOTED", projected=True)
    s.place_hlr("b18-250-top", 260, 32, 1, 5)
    s.balloon(390, 38, "B18", 370, 38)
    s.place_hlr("b22-front", 278, 58, 1, 2)
    s.balloon(390, 68, "B22", 338, 68)
    s.place_hlr("b29-front", 278, 88, 1, 2)
    s.balloon(390, 100, "B29", 338, 100)
    s.place_hlr("b50-front", 278, 128, 2, 1)
    s.balloon(390, 134, "B50", 350, 134)
    s.rect(268, 150, 85, 18.5, "med", fill="#ffffff")
    s.text(310, 161, "B42 TACHYON DATASHEET 85 x 56", 2.1, "bold", "middle")
    s.balloon(390, 160, "B42", 353, 160)
    s.text(310, 176, "BRICK IS NOT A STEP THIS RUN", 2.0, "bold", "middle", color="#ba3d3d")
    s.note_box(13, 215, 190, "EXPLOSION RULE", [
        "Each balloon is an HLR of that unique-part STEP, not a generate.py box.",
        "CAD-01 unique: B01-B04, B10, B18/B51/B52, B05-B07, B12-B14, B20.",
        "CAD-02 unique: B22-B27 pinch, B28/B29/B50 binder. No animal-side metal.",
    ])
    s.note_box(215, 215, 190, "INSTALL ORDER", [
        "1 perimeter -> 2 faces -> 3 ceiling -> 4 false bottom.",
        "5 animal-isolated rail -> 6 carriage -> 7 SerDes binder -> 8 brick hub.",
        "First article requires leak, pinch, pull-off and nymph-gap checks.",
    ], "ref")
    s.write("S02-exploded.svg")


def sheet03():
    s = Sheet(3, "PERIMETER BLOCKS", "2:1 / 1:2")
    s.view_label(14, 15, "Corner block B01", "2:1", projected=True, extra="DRAFT-MEASURED PR 34")
    placed = s.place_hlr("b01-front", 28, 28, 2, 1)
    if placed:
        s.dim_h(28, 28 + placed[0], 28 + placed[1] + 8, 28 + placed[1], f"{CAD01['b01'][0]:g} CAD-01")
        s.dim_v(28, 28 + placed[1], 20, 28, f"{CAD01['b01'][2]:g} CUBE")
    s.balloon(90, 40, "B01", 76, 40)
    s.place_hlr("b01-right", 100, 28, 2, 1)
    s.view_label(160, 15, "Edge block B02", "1:2", projected=True)
    s.place_hlr("b02-front", 168, 36, 1, 2)
    s.balloon(310, 42, "B02", 293, 42)
    s.dim_h(168, 168 + 125, 58, 48, f"{MODULE_PITCH:g} LOCK")
    s.view_label(14, 92, "Mid-span splice B03", "2:1", projected=True)
    s.place_hlr("b03-front", 28, 104, 2, 1)
    s.place_hlr("b03-top", 90, 104, 2, 1)
    s.balloon(150, 112, "B03", 134, 112)
    s.view_label(175, 92, "Route end stop B51", "2:1", projected=True)
    s.place_hlr("b51-front", 185, 108, 2, 1)
    s.place_hlr("b51-right", 220, 108, 2, 1)
    s.balloon(310, 116, "B51", 296, 116)
    s.view_label(14, 160, "Detail A - B03 splice HLR", "2:1", projected=True)
    s.place_hlr("b03-front", 28, 174, 2, 1)
    s.text(28, 230, "SHEAR BY TONGUE; B21 IS NOT A CORNER ROLL SOLID", 2.3, "bold")
    s.view_label(175, 160, "Detail B - B04 retainer (right)", "5:1", projected=True)
    s.place_hlr("b04-right", 190, 174, 5, 1)
    s.text(230, 174, f"3.00 PANEL LOCK + {CAD01['seat_clear']:.2f} TARGET CLEAR", 2.2, "bold")
    s.text(230, 182, f"POCKET INSET {CAD01['pocket_inset']:g} / Z {CAD01['pocket_z']:g} REF", 2.2)
    s.text(230, 190, f"NYMPH GAP <={CAD01['nymph_gap']:.2f} TARGET", 2.2, "bold", color="#b52d2d")
    s.balloon(255, 210, "B04", 220, 200)
    s.note_box(14, 236, 190, "CAD-01 MEASURED UNIQUE PARTS", [
        f"B01 24 cube; B02 250 x 24 x 24; B03 22 x 24 x 24. Kerf {CAD01['kerf']:g} REF.",
        "Views are HLR of PR 34 unique-part STEP. Not shop-release.",
    ], "ref")
    s.note_box(214, 236, 190, "LOAD PATH / ROUTES", [
        "Panel -> gasket -> pocket wall -> perimeter block.",
        "B21: top-front and vertical routes are independent; no corner roll.",
        f"B51 {CAD01['b51'][0]:g} x {CAD01['b51'][1]:g} x {CAD01['b51'][2]:g}; bore {CAD01['b51_bore']:g} UNVERIFIED PN.",
    ])
    s.write("S03-blocks.svg")


def sheet04():
    s = Sheet(4, "RAIL + STRIP", "2:1 / 1:2")
    s.view_label(12, 15, "Rail channel section C-C", "2:1", projected=True,
                 extra="B18-rail-channel-250.step cut at X=125, HLR along +X")
    placed = s.place_hlr("b18-250-section", 28, 32, 2, 1)
    if placed:
        s.dim_h(28, 28 + placed[0], 32 + placed[1] + 7, 32 + placed[1], f"{RAIL_WIDTH:g} CAD-01 BBOX")
        s.dim_v(32, 32 + placed[1], 18, 28, f"{RAIL_HEIGHT:g} CAD-01 BBOX")
    s.balloon(120, 40, "B18", 104, 44)
    s.place_hlr("b52-250-front", 28, 80, 1, 5, cls="hlr")
    s.balloon(18, 82, "B52", 40, 82)
    s.place_hlr("b20-right", 140, 32, 1, 10, cls="hlr-keep")
    s.text(140, 90, "B20 1:10 KEEP-OUT (NOT A FILM OVER CONTACTS)", 2.1, "bold", color="#b52d2d")
    s.view_label(210, 15, "Longitudinal B18 250 top", "1:2", projected=True)
    s.place_hlr("b18-250-top", 218, 32, 1, 2)
    colors = ["#d9822b", "#d9822b", "#333333", "#333333", "#2c9c69", "#307ac7", "#7a55a3", "#d34887"]
    labels = [contact["net"] for contact in BUS_CONTACTS[:8]]
    for i, (c, lab) in enumerate(zip(colors, labels)):
        yy = 56 + i * 3.6
        s.line(218, yy, 343, yy, "med", color=c)
        s.text(346, yy + 1, lab, 1.9, "bold", color=c)
    s.text(280, 90, "P01-P08 OVERLAY IS A DIAGRAM ON THE HLR LAND PLANE — NOT STEP", 2.0, "bold", "middle", color="#ba3d3d")
    for i, xx in enumerate([235, 268, 301, 334], start=1):
        s.rect(xx - 8, 94, 16, 10, "med", rx=1, fill="#ffffff")
        s.text(xx, 100, f"V{i}", 2.0, "bold", "middle", color="#0a7891")
    s.text(280, 112, f"V-DOCK PITCH {DOCK_PITCH:g} CALCULATED (500/4); VIDEO ONLY AT INDEXED DOCKS", 2.1, "bold", "middle")
    s.view_label(12, 124, "Detail D - strip stack-up", "DIAGRAM", projected=False)
    s.text(16, 140, "NO B19 STEP THIS RUN — STACK REMAINS A DIAGRAM", 2.1, "bold", color="#ba3d3d")
    layers = [("ENIG CONTACT LAND", 2, "metal"), ("FLEX / SPRING COPPER", 5, "metal"), ("DIELECTRIC", 7, "plastic"), ("PETG / ASA FRAME", 18, "plastic")]
    yy = 146
    for name, hh, cls in layers:
        s.rect(16, yy, 110, hh, cls)
        s.text(132, yy + hh / 2 + 1, name, 2.3, "bold")
        yy += hh
    s.text(16, 186, f"LAND t={CAD01['land_t']:g} REF (study); OTHER STACK LAYERS UNVERIFIED", 2.2, "bold", color="#ba3d3d")
    s.view_label(230, 124, "Detail E - contact lands", "DIAGRAM")
    for i, c in enumerate(colors):
        s.rect(239 + i * 12, 142, 7, 24, "med", fill=c)
        s.text(242.5 + i * 12, 174, f"P{i+1:02d}", 1.8, "bold", "middle", color=c)
    s.dim_h(245, 263, 186, 166, f"{CONTACT_PITCH:g} PITCH TARGET")
    s.text(239, 196, f"FIELD {CONTACT_FIELD:g} IN CAVITY {RAIL_WIDTH-2*RAIL_WALL:g}; P09-P12 GMSL2 CELL", 2.1, "bold")
    s.color_legend(12, 204)
    s.note_box(12, 214, 190, "CAD-01 RAIL MEASURE", [
        f"B18 250: {CAD01['b18_250'][0]:g} x {CAD01['b18_250'][1]:g} x {CAD01['b18_250'][2]:g}; 500 span sibling.",
        f"Offset {CAD01['rail_offset']:g} REF; B52 lip {CAD01['b52_t']:g}; slot {CAD01['slot']:g} REF.",
        "Section is a true half-space cut of the B18 STEP, then HLR.",
        "B20 is the wet-side barrier; it is not a film over contacts.",
    ], "ref")
    s.note_box(215, 214, 190, "FAILURE CONTROL", [
        "S1 first travel opens Q1 before B27 lift (CAD-02 q=1.0 TARGET).",
        "Bent HSD pogo -> link loss; no fallback to raw MIPI on the strip.",
        "Each V-dock is point-to-point to one MAX96724 input.",
        "B52 is a labyrinth wiper, not a hermetic cover. EE-23 series UNVERIFIED.",
    ], "warn")
    s.write("S04-rail-strip.svg")


def sheet05():
    projected = has_view("carriage-q0-side", "carriage-q5-side")
    s = Sheet(5, "CARRIAGE MECHANISM", "2:1" if projected else "NTS",
              nts=not projected, status="DRAFT CAD" if projected else "UNPROJECTED")
    s.view_label(12, 15, "Locked state q=0", "2:1", projected=projected,
                 extra="CAD-02 OCCT posed assembly. PR 34 not admitted as parent.")
    s.place_hlr("carriage-q0-side", 20, 28, 2, 1)
    s.balloon(120, 36, "B22", 104, 40)
    s.balloon(120, 58, "B27", 90, 58)
    s.text(62, 100, f"LOCKED q=0  B22 {CAD02['b22'][0]:g}x{CAD02['b22'][1]:g}x{CAD02['b22'][2]:g}  LIFT PAWL IN", 2.2, "bold", "middle")
    s.view_label(145, 15, "Pinched / travel q=5", "2:1", projected=projected)
    s.place_hlr("carriage-q5-side", 150, 28, 2, 1)
    s.line(160, 26, 170, 36, "motion")
    s.line(228, 26, 218, 36, "motion")
    s.text(192, 100, f"q={CAD02['q_roll']:g} ROLLING; LIFT {CAD02['throw']:g} THROW / {CLEARANCE_LIFT:g} CLEAR", 2.15, "bold", "middle")
    s.view_label(270, 15, "CAD-02 pinch q (mm)", "diagram")
    states = [
        ("q=0 LOCKED", "S1 closed; pawl in"),
        (f"q={CAD02['q_s1']:g} S1_OPEN", "Q1 off; contacts seated"),
        (f"q={CAD02['q_safe']:g} PINCH_SAFE", "lift pawl retracts"),
        (f"q={CAD02['q_clear']:g} CLEAR", f"lift={CAD02['throw']:g}; still locked"),
        (f"q={CAD02['q_roll']:g} ROLLING", "translation pawl out"),
    ]
    for i, (a, b) in enumerate(states):
        x, y = 272, 28 + i * 17
        s.rect(x, y, 128, 15, "med", fill="#ffffff")
        s.text(x + 4, y + 6, a, 2.15, "bold")
        s.text(x + 4, y + 12, b, 1.95)
    s.view_label(12, 112, "Detail F - B27 array + B25 pocket", "5:1", projected=projected)
    s.place_hlr("b27-front", 16, 126, 5, 1)
    s.place_hlr("b25-front", 170, 126, 5, 1)
    s.dim_v(126, 126 + 30, 160, 155, f"{POGO_COMPRESSION:.2f} WORK COMPRESSION TARGET")
    s.text(16, 168, "B25 SPRING PN UNVERIFIED (POCKET ONLY)", 2.2, "bold")
    s.text(16, 176, f"PINCH FORCE {PINCH_FORCE_MIN:g}-{PINCH_FORCE_MAX:g} N TARGET", 2.3)
    s.text(16, 184, f"B27 PROXY d={CAD02['pogo_d']:g} / BARREL {CAD02['pogo_barrel']:g} UNVERIFIED", 2.2, "bold", color="#ba3d3d")
    s.text(16, 192, "MIPI IS NOT ON THESE CONTACTS", 2.4, "bold", color="#ba3d3d")
    s.text(16, 200, "ADR-002: HARDWARE PAWLS, NOT A TIMED DELAY", 2.1)
    s.note_box(230, 118, 175, "MECHANISM NOTE - PINCH-LIFT / ROLL", [
        "States: LOCKED / S1_OPEN / PINCH_SAFE / CONTACTS_CLEAR / ROLLING.",
        "What moves: B24/B27 lift then rollers; rail/B19 stays grounded.",
        f"q={CAD02['q_s1']:g} opens S1 envelope; contacts stay seated until q={CAD02['q_safe']:g}.",
        f"Lift pawl blocks Z until PINCH_SAFE. Throw {CAD02['throw']:g} covers {CLEARANCE_LIFT:g} clearance.",
        "Translation pawl blocks roll until lift >= clearance. Speed cannot skip a pawl.",
        "EE-24 S1/S2/Q1 parts UNVERIFIED; electrical dwell is a later independent gate.",
        "Chosen over screws for one-hand relocate without opening the cage.",
    ])
    s.note_box(230, 186, 175, "FAILURE / ACCEPTANCE", [
        "Interrupted pinch: keep Q1 off; require a clean full remate.",
        "Bent HSD: training timeout; Q1 latches off. No MIPI fallback.",
        "B51 retains loaded carriage (EE-26 route-retention UNVERIFIED).",
        "No conductor may breach B20.",
    ], "warn")
    if projected:
        s.scale_bar(12, 236, model_mm=20, scale_num=2, scale_denom=1)
    else:
        s.scale_bar_nts(12, 236)
    s.write("S05-carriage-mech.svg")


def sheet06():
    projected = has_view("b28-front", "b29-front", "b50-front")
    s = Sheet(6, "UNIVERSAL LATCH + BINDER", "2:1 / 5:1" if projected else "NTS",
              nts=not projected, status="DRAFT CAD" if projected else "UNPROJECTED")
    s.view_label(12, 15, "Universal shoe B28", "2:1", projected=projected)
    s.place_hlr("b28-front", 24, 28, 2, 1)
    s.place_hlr("b28-side", 90, 28, 2, 1)
    s.balloon(150, 36, "B28", 134, 36)
    s.text(70, 58, f"B28 SHOE {CAD02['b28'][0]:g}x{CAD02['b28'][1]:g}x{CAD02['b28'][2]:g} CAD-02", 2.2, "bold", "middle")
    s.view_label(165, 15, "Binder housing B29", "2:1", projected=projected)
    s.place_hlr("b29-front", 170, 28, 2, 1)
    s.place_hlr("b29-side", 260, 28, 2, 1)
    s.balloon(348, 40, "B29", 332, 40)
    s.text(230, 80, f"B29 HOUSING {CAD02['b29'][0]:g}x{CAD02['b29'][1]:g}x{CAD02['b29'][2]:g}", 2.2, "bold", "middle")
    s.view_label(12, 92, "B50 keyed half proxy", "5:1", projected=projected, extra="UNVERIFIED series / pinout / SI launch")
    s.place_hlr("b50-front", 20, 108, 5, 1)
    s.balloon(150, 112, "B50", 125, 112)
    s.text(20, 140, f"B50 {CAD02['b50'][0]:g}x{CAD02['b50'][1]:g}x{CAD02['b50'][2]:g} KEY OFFSET {CAD02['b50_key']:g} TARGET", 2.2, "bold")
    s.view_label(175, 92, "B34 FPC clamp (local CSI)", "5:1", projected=projected)
    s.place_hlr("b34-front", 180, 108, 5, 1)
    s.balloon(280, 112, "B34", 260, 112)
    s.text(180, 140, f"LOCAL CSI KEEPOUT {CAD02['csi_keepout']:g} UNVERIFIED; MIPI STAYS IN BINDER", 2.1, "bold", color="#ba3d3d")
    s.note_box(12, 160, 190, "MECHANISM NOTE - BIND-LATCH", [
        f"States: BLOCKED until pinch q>={CAD02['q_safe']:g}; then r={CAD02['r_s2']:g}/{CAD02['r_safe']:g}/{CAD02['r_free']:g} TARGET.",
        "Binder housing moves; B28 shoe stays on carriage. Load path bypasses B50.",
        "First r opens S2 envelope while B50 stays keyed/seated (BRANCH_SAFE dwell).",
        "Release pin retracts only at PINCH_SAFE. Firmware cannot move that pin.",
        "Click-latch section has no sourced tongue STEP; deflection 1.2 TARGET stays a note.",
    ])
    s.note_box(215, 160, 190, "FAILURE / CLEARANCE", [
        "Partial click: S2 stays open; Q1 remains off. Key blocks 180 reverse mate.",
        "B50 series/pinout/SI launch UNVERIFIED (#23). Do not invent a connector.",
        f"Camera keep-out {CAD02['cam_keepout']:g} is not a sourced module outline.",
        f"PULL-OFF >={BINDER_PULL_OFF:g} N TARGET. Side play <=0.20 TARGET.",
    ], "warn")
    if projected:
        s.scale_bar(12, 236, model_mm=20, scale_num=2, scale_denom=1)
    else:
        s.scale_bar_nts(12, 236)
    s.write("S06-latch-binder.svg")


def sheet07():
    s = Sheet(7, "CAMERA LOAD / SERDES BINDER", "2:1 / DIAGRAM", nts=False, status="DRAFT CAD")
    s.view_label(12, 15, "B29 binder housing (no camera SKU STEP)", "2:1", projected=True)
    s.place_hlr("b29-front", 20, 28, 2, 1)
    s.place_hlr("b29-side", 115, 28, 2, 1)
    s.rect(42, 48, 36, 22, "unverified", fill="#ffffff")
    s.text(60, 58, "B36", 2.4, "bold", "middle")
    s.text(60, 64, "SKU UNVERIFIED", 1.8, "middle", color="#ba3d3d")
    s.balloon(200, 36, "B29", 187, 40)
    s.balloon(200, 58, "B36", 78, 58)
    s.view_label(215, 15, "Rail Pxx / binder Cxx mirrored nets", "DIAGRAM")
    maps = [("P01", "VIN-A", "#d9822b"), ("P02", "VIN-B", "#d9822b"), ("P03", "GND-A", "#333"), ("P04", "GND-B", "#333"),
            ("P05", "SDA", "#2c9c69"), ("P06", "SCL", "#307ac7"), ("P07", "UID", "#7a55a3"), ("P08", "FAULT_N", "#d34887"),
            ("P09", "HSGND", "#333"), ("P10", "GMSL+", "#0a7891"), ("P11", "GMSL-", "#0a7891"), ("P12", "HSGND", "#333")]
    for i, (p, n, c) in enumerate(maps):
        col = i % 4
        row = i // 4
        x = 218 + col * 46
        y = 32 + row * 24
        s.rect(x, y, 40, 20, "med", rx=1, fill="#fff")
        s.text(x + 4, y + 7, f"{p}/C{i+1:02d}", 1.8, "bold", color=c)
        s.text(x + 20, y + 14, n, 2.1, "bold", "middle", color=c)
    s.view_label(12, 118, "B50 HLR + video path diagram", "5:1 / DIAGRAM", projected=True)
    s.place_hlr("b50-front", 16, 132, 5, 1)
    s.balloon(140, 136, "B50", 120, 136)
    blocks = [(155, 48, "CAMERA\nSKU UNVER"), (212, 52, "MAX96717\nCSI->GMSL2"), (272, 40, "B50"), (318, 48, "V-DOCK"), (372, 40, "MAX96724")]
    for x, w, label in blocks:
        s.rect(x, 150, w, 28, "med", fill="#ffffff")
        for j, ln in enumerate(label.split("\n")):
            s.text(x + w / 2, 162 + j * 5, ln, 2.1, "bold", "middle")
    s.text(265, 188, "RAW MIPI STAYS INSIDE BINDER; GMSL2 CROSSES LOCKED POGO DOCK", 2.4, "bold", "middle")
    s.note_box(12, 200, 190, "MECHANISM NOTE - CAMERA VIDEO DOCK", [
        "States: free / S1+S2 power-mated / training / link-trained / pinch-safe.",
        "What moves: binder. V-dock and MAX96724 stay on rail/brick. No tether.",
        "Raw MIPI never rides B50, B27, or the continuous strip (EE-23/25 lock).",
    ])
    s.note_box(215, 200, 190, "FAILURE / WHY / EE-25", [
        "Partial dock or bent HSD: training timeout; Q1 latches off.",
        "Particle lists IMX519 AF and S5K3P9SX sensors; no orderable SKU drawn.",
        "EE-26 coupons: 2x-thru, B27-only, B50-only, full channel. Not animal-use.",
    ], "warn")
    s.write("S07-camera-load.svg")


def sheet08():
    s = Sheet(8, "ELECTRICAL + VIDEO FUNCTIONAL DIAGRAM", "NTS", nts=True, status="THEORETICAL")
    s.text(12, 15, "RAIL POWER / CONTROL / GMSL2 - FUNCTIONAL DIAGRAM, NOT RELEASE SCHEMATIC", 3.6, "bold")
    s.text(12, 21, "No STEP projection on this sheet. KiCad on #24/#25 is circuit authority.", 2.3, color="#ba3d3d")
    s.color_legend(12, 26)
    s.rect(15, 36, 50, 24, "med", fill="#ffffff")
    s.text(40, 47, "UPSTREAM DC/PD", 2.8, "bold", "middle")
    s.text(40, 54, "SOURCE", 2.2, "middle")
    s.line(65, 48, 82, 48, "med", color="#d9822b")
    s.rect(82, 40, 26, 16, "med", fill="#ffffff")
    s.text(95, 47, "F1", 2.8, "bold", "middle")
    s.text(95, 52, "2 A TARGET", 1.9, "middle")
    s.line(108, 48, 126, 48, "med", color="#d9822b")
    s.rect(126, 36, 54, 24, "med", fill="#fff")
    s.text(153, 46, "B44 RAIL EFUSE", 2.6, "bold", "middle")
    s.text(153, 53, "LIMIT / FAULT", 2.0, "middle")
    s.line(180, 48, 405, 48, "med", color="#d9822b")
    s.text(292, 44, "P01/P02 GUARDED EXT. 12 V TARGET; MAY REMAIN ENERGIZED", 2.1, "bold", "middle", color="#d9822b")
    s.line(15, 67, 405, 67, "med", color="#333")
    s.text(292, 64, "P03/P04 GND", 2.3, "bold", "middle")
    s.line(153, 60, 153, 78, "thin")
    s.circle(153, 84, 3, "med", fill="#fff")
    s.line(153, 84, 166, 76, "med")
    s.circle(171, 84, 3, "med", fill="#fff")
    s.text(162, 72, "S1 / B27", 1.8, "bold", "middle")
    s.line(190, 60, 190, 78, "thin")
    s.circle(190, 84, 3, "med", fill="#fff")
    s.line(190, 84, 203, 76, "med")
    s.circle(208, 84, 3, "med", fill="#fff")
    s.text(199, 72, "S2 / B50", 1.8, "bold", "middle")
    s.text(190, 93, "S1 CARRIAGE + S2 BINDER: BOTH CLOSED TO ENABLE LOCAL Q1", 2.05, "bold", "middle", color="#ba3d3d")
    s.rect(18, 108, 64, 60, "heavy", fill="#ffffff")
    s.text(50, 120, "B36 CAMERA", 3.1, "bold", "middle")
    s.text(50, 127, "SKU UNVERIFIED", 2.2, "middle", color="#ba3d3d")
    s.text(50, 135, "LOCAL MIPI CSI-2", 2.4, "bold", "middle")
    s.rect(96, 108, 67, 60, "heavy", fill="#ffffff")
    s.text(129.5, 120, "B45 MAX96717", 3.0, "bold", "middle")
    s.text(129.5, 128, "3/6 Gbps GMSL2", 2.3, "middle")
    s.text(129.5, 136, "187.5 Mbps REV", 2.1, "middle")
    s.text(129.5, 145, "LOCAL DC/DC", 2.2, "bold", "middle")
    s.rect(117, 62, 24, 10, "med", fill="#ffffff")
    s.text(129, 68, "B27 RAIL", 1.9, "bold", "middle")
    s.rect(112, 76, 34, 16, "med", fill="#ffffff")
    s.text(129, 83, "B48 Q1", 2.2, "bold", "middle")
    s.text(129, 88, "LOCAL BRANCH", 1.7, "middle")
    s.rect(117, 96, 24, 10, "med", fill="#ffffff")
    s.text(129, 102, "B50 BINDER", 1.75, "bold", "middle")
    s.line(82, 138, 96, 138, "motion")
    s.line(129, 108, 129, 106, "thin", color="#d9822b")
    s.line(129, 96, 129, 92, "thin", color="#d9822b")
    s.line(129, 76, 129, 72, "thin", color="#d9822b")
    s.line(129, 62, 129, 48, "thin", color="#d9822b")
    s.line(138, 108, 138, 67, "thin", color="#333")
    for i, y in enumerate([107, 123, 139, 155], start=1):
        s.rect(183, y - 5, 36, 10, "med", rx=1, fill="#ffffff")
        s.text(201, y + 1, f"V{i} G + - G", 1.9, "bold", "middle", color="#0a7891")
        s.line(219, y, 252, y, "med", color="#0a7891")
    s.rect(166, 130, 15, 12, "med", rx=1, fill="#ffffff")
    s.text(173.5, 135, "B50", 1.9, "bold", "middle")
    s.text(173.5, 140, "UNVER", 1.5, "middle", color="#ba3d3d")
    s.line(163, 136, 166, 136, "thin", color="#0a7891")
    s.text(201, 173, "ONLY ONE DOCK POPULATED BY THIS CARRIAGE", 2.0, "bold", "middle")
    s.rect(252, 100, 72, 76, "heavy", fill="#ffffff")
    s.text(288, 113, "B46 MAX96724", 3.1, "bold", "middle")
    s.text(288, 121, "QUAD GMSL2 DES", 2.4, "middle")
    for i, y in enumerate([131, 141, 151, 161], start=1):
        s.text(261, y, f"IN{i}", 2.0, "bold")
    s.text(288, 170, "CSI-2 OUT", 2.3, "bold", "middle")
    s.line(324, 138, 342, 138, "motion")
    s.rect(342, 108, 62, 60, "heavy", fill="#ffffff")
    s.text(373, 123, "B42 TACHYON", 3.2, "bold", "middle")
    s.text(373, 132, "DEDICATED CSI", 2.2, "middle")
    s.text(373, 141, "22p / 0.5 mm", 2.2, "middle")
    s.text(373, 151, "QWIIC MASTER", 2.2, "middle")
    s.rect(52, 181, 58, 39, "med", rx=1, fill="#ffffff")
    s.text(81, 191, "B49 TCA9548A", 2.3, "bold", "middle")
    s.text(81, 198, "OPTIONAL I2C", 2.0, "middle")
    s.text(81, 205, "SEGMENT MUX", 2.0, "middle")
    s.text(81, 212, "0x70 REF", 1.9, "middle")
    nets = [("P05 SDA", "#2c9c69", 188), ("P06 SCL", "#307ac7", 197), ("P07 UID", "#7a55a3", 206), ("P08 FAULT_N/IRQ", "#d34887", 215)]
    for lab, c, y in nets:
        s.text(112, y + 1, lab, 2.2, "bold", color=c)
        s.line(145, y, 404, y, "med", color=c)
    s.line(165, 180, 165, 220, "center")
    s.text(165, 178, "B27 / S1", 1.8, "bold", "middle")
    s.line(220, 180, 220, 220, "center")
    s.text(220, 178, "B50 / S2", 1.8, "bold", "middle")
    s.note_box(12, 226, 191, "MECHANISM NOTE - EE-24 INTERLOCK", [
        "EE-24 nodes: VIN_RAIL -> F1 -> VIN_FUSED -> P01||P02 VIN_SHARED.",
        "INTERLOCK_OK = S1 NO series S2 NO. Q1_EN never driven by P08.",
        "S1 open: Q1 off, discharge, ISO_EN off, then B27 may lift.",
    ])
    s.note_box(214, 226, 191, "FAULT POLICY / NOT A RELEASE SCHEMATIC", [
        "KiCad on #24/#25 is circuit authority; this SVG is a review diagram.",
        "S1/S2/Q1/B27/B50 series UNVERIFIED (#23). No MPNs invented.",
        "P08 diagnostic only. GMSL P10/P11 are not MIPI. EE-26: not animal-use.",
    ], "warn")
    s.write("S08-electrical.svg")


def sheet09():
    s = Sheet(9, "SERDES / CSI / PARTICLE BRICK", "1:1 / DIAGRAM", nts=True, status="THEORETICAL")
    s.view_label(12, 15, "Tachyon + deserializer carrier", "1:1 DATASHEET ENVELOPE", extra="Not a sourced STEP. Envelope from Particle datasheet this run.")
    s.rect(22, 34, 85, 56, "heavy", fill="#ffffff")
    s.text(64.5, 57, "B42 TACHYON", 4.5, "bold", "middle")
    s.text(64.5, 65, f"{VENDOR['tachyon_xyz'][0]:g} x {VENDOR['tachyon_xyz'][1]:g} x {VENDOR['tachyon_xyz'][2]:g} DATASHEET", 2.2, "middle")
    s.rect(31, 78, 22, 5, "med", fill="#ffffff")
    s.rect(75, 78, 22, 5, "med", fill="#ffffff")
    s.text(42, 88, "DEDICATED CSI", 2.0, "bold", "middle")
    s.text(86, 88, "SHARED DSI/CSI", 2.0, "bold", "middle")
    s.rect(124, 34, 66, 56, "heavy", fill="#ffffff")
    s.text(157, 54, "B46 MAX96724", 3.5, "bold", "middle")
    s.text(157, 62, "4 x GMSL2 IN", 2.3, "middle")
    s.text(157, 70, "MIPI CSI-2 OUT", 2.3, "middle")
    s.line(124, 80, 107, 80, "motion")
    s.text(106, 105, "DESERIALIZER CARRIER DIMS / TACHYON DRIVER SUPPORT UNVERIFIED", 2.2, "bold", "middle", color="#ba3d3d")
    s.view_label(215, 15, "Optional M1 external brick", "1:2 DATASHEET ENVELOPE")
    s.rect(236, 28, 60.5, 110, "heavy", rx=7, fill="#ffffff")
    s.rect(246, 48, 40, 68, "med", fill="#ffffff")
    s.text(266, 76, "TACHYON", 3.4, "bold", "middle")
    s.text(266, 84, "+ DES", 2.6, "middle")
    s.circle(250, 129, 6, "med", fill="#fff")
    s.circle(282, 129, 6, "med", fill="#fff")
    s.dim_h(236, 296.5, 147, 138, f"{VENDOR['m1_xyz'][0]:g} DATASHEET")
    s.dim_v(28, 138, 226, 236, f"{VENDOR['m1_xyz'][1]:g} DATASHEET")
    s.text(266, 155, f"DEPTH {VENDOR['m1_xyz'][2]:g} DATASHEET", 2.2, "bold", "middle")
    s.text(266, 161, "M20 NOT USED FOR MOVING CSI: NO CAMERA TETHER", 2.1, "bold", "middle", color="#0a7891")
    s.view_label(320, 15, "External mount vs PR 34 front", "1:8", projected=True)
    s.place_hlr("assembly-front", 328, 32, 1, 8)
    s.rect(378, 70, 22, 40, "heavy", fill="#ffffff")
    s.text(389, 88, "M1", 3.0, "bold", "middle")
    s.text(389, 96, "OUTSIDE", 1.9, "bold", "middle")
    s.text(368, 148, "BRICK + SERDES HUB NEVER ENTER WET VOLUME", 2.1, "bold", "middle", color="#ba3d3d")
    s.view_label(12, 174, "Four video docks / two Tachyon CSI options", "DIAGRAM")
    for i, x in enumerate([18, 68, 118, 168], start=1):
        s.rect(x, 191, 38, 25, "med", fill="#ffffff")
        s.text(x + 19, 203, f"V{i} GMSL2", 2.2, "bold", "middle")
    for x in [56, 106, 156, 206]:
        s.line(x, 203, 230, 203, "thin", color="#0a7891")
    s.rect(230, 184, 68, 40, "heavy", fill="#ffffff")
    s.text(264, 202, "MAX96724", 3, "bold", "middle")
    s.text(264, 210, "AGGREGATE / ROUTE", 2.1, "middle")
    s.line(298, 196, 320, 196, "motion")
    s.line(298, 213, 320, 213, "motion")
    s.rect(320, 181, 82, 47, "heavy", fill="#ffffff")
    s.text(361, 195, "DEDICATED CSI", 2.5, "bold", "middle")
    s.text(361, 207, "SHARED DSI/CSI", 2.5, "bold", "middle")
    s.text(361, 219, "GPIO 68 HIGH", 2.2, "bold", "middle")
    s.note_box(12, 231, 190, "VERIFIED THIS RUN (PARTICLE / ADI PAGES)", [
        f"Tachyon {VENDOR['tachyon_xyz'][0]:g}x{VENDOR['tachyon_xyz'][1]:g}x{VENDOR['tachyon_xyz'][2]:g}; CSI 22p / 0.5 mm; 2.5 Gbps/lane.",
        "GPIO 68 HIGH selects CSI on shared DSI/CSI2. No CSI pin table reprinted.",
    ])
    s.note_box(215, 231, 190, "NOT DRAWN / UNVERIFIED", [
        "No HAT pin numbers. EE-23 transcribed CSI photos stay in the library.",
        "IMX519/S5K3P9SX are listed sensors; orderable module SKU is not selected.",
    ], "warn")
    s.write("S09-particle-brick.svg")


def sheet10():
    s = Sheet(10, "HUSBANDRY INTERFERENCE", "1:5")
    s.view_label(12, 15, "B20 wet-side barrier (keep-out)", "1:5", projected=True,
                 extra=f"PR 34 B20 STEP  {CAD01_SHA[:12]}  NO METAL IN WET VOLUME")
    s.place_hlr("b20-front", 22, 28, 1, 5, cls="hlr-keep")
    s.place_hlr("assembly-front", 90, 28, 1, 5)
    s.text(22, 140, "B20 KEEP-OUT", 2.6, "bold", color="#ba3d3d")
    s.text(90, 140, "ASSEMBLY HLR", 2.6, "bold")
    s.dim_v(28, 28 + 100, 12, 22, f"{SPAN:g} LOCK / 500 B20")
    s.view_label(200, 15, "Top: B20 vs B10 frame", "1:8", projected=True)
    s.place_hlr("b20-top", 205, 28, 1, 8, cls="hlr-keep")
    s.place_hlr("b10-top", 250, 32, 1, 8)
    s.view_label(200, 78, "Door B06 / labyrinth B07", "1:8", projected=True)
    s.place_hlr("b06-front", 205, 90, 1, 8)
    s.place_hlr("b07-front", 250, 88, 1, 8)
    s.path("M205 140 A40 40 0 0 1 255 180", "phantom")
    s.line(205, 140, 255, 180, "motion")
    s.text(230, 188, "90 deg MIN SERVICE SWING (MOTION OVERLAY)", 2.1, "bold", "middle")
    s.view_label(12, 150, "Low intake B12 / false bottom B14", "1:5 / 1:8", projected=True)
    s.place_hlr("b12-front", 18, 164, 1, 5)
    s.place_hlr("b14-top", 50, 164, 1, 8)
    s.text(18, 210, f"FALSE BOTTOM + {TRAY:g} TRAY REF", 2.2, "bold")
    s.note_box(160, 196, 118, "B20 KEEP-OUT (CAD-01 STEP)", [
        f"Barrier bbox {CAD01['b20_bbox'][0]:g}..{CAD01['b20_bbox'][3]:g} X,",
        f"{CAD01['b20_bbox'][1]:g}..{CAD01['b20_bbox'][4]:g} Y, 0..500 Z.",
        "HLR of B20-animal-wet-barrier.step.",
        "Not a film over contacts.",
        f"Molt keep-out {CAD01['molt']:g} CALCULATED.",
    ], "warn")
    s.note_box(288, 196, 116, "WET-VOLUME RULE", [
        "No metal mesh / copper / pogo.",
        "PETG or ASA wet parts.",
        f"Nymph gap <={CAD01['nymph_gap']:.2f} TARGET.",
        "Solo animal. No taxon inferred.",
        "Heat-mat pass only; no mains.",
    ], "warn")
    s.scale_bar(12, 236, model_mm=50, scale_num=1, scale_denom=5)
    s.write("S10-husbandry.svg")


def sheet11():
    s = Sheet(11, "DETAIL BLOW-UPS", "5:1 / DIAGRAM")
    s.view_label(12, 14, "K - B27 pogo array proxy", "5:1", projected=True, extra="UNVERIFIED series")
    s.place_hlr("b27-front", 16, 28, 5, 1)
    s.text(16, 68, f"{POGO_COMPRESSION:.2f} WORK / {POGO_LIFT:.2f} LIFT TARGET", 2.1, "bold")
    s.text(16, 76, f"THROW {CAD02['throw']:g} / NEED {CLEARANCE_LIFT:g}", 2.1)
    s.text(16, 84, "POGO SERIES UNVERIFIED #23", 2.1, "bold", color="#ba3d3d")
    s.view_label(145, 14, "L - strip wipe", "NTS", extra="No B19 STEP — diagram only")
    s.rect(160, 72, 92, 8, "metal")
    s.path("M170 45 Q182 35 194 45 L194 68", "med")
    s.circle(194, 71, 3, "metal")
    s.line(194, 71, 224, 71, "motion")
    s.text(206, 90, "P01-P08 WIPE 0.8 TARGET", 2.3, "bold", "middle")
    s.text(206, 98, "P09-P12 VERTICAL SEAT; NO WIPE", 2.1, "bold", "middle")
    s.view_label(278, 14, "M - B25 spring pocket", "5:1", projected=True)
    s.place_hlr("b25-front", 290, 28, 5, 1)
    s.text(348, 36, "POCKET +0.30", 2.2, "bold")
    s.text(348, 44, "NO SHARP ROOT", 2.2)
    s.text(348, 52, "10k CYCLE TARGET", 2.2)
    s.view_label(12, 112, "N - B34 CSI clamp", "5:1", projected=True, extra="Camera FPC length UNVERIFIED")
    s.place_hlr("b34-front", 16, 128, 5, 1)
    s.text(16, 156, "CLAMP FPC INSULATION, NEVER CONDUCTORS", 2.2, "bold")
    s.text(16, 164, f"CSI KO {CAD02['csi_keepout']:g} UNVERIFIED", 2.2, color="#ba3d3d")
    s.view_label(145, 112, "P - magnet pocket", "NTS", extra="No magnet STEP — UNVERIFIED")
    s.rect(166, 132, 64, 40, "cut")
    s.rect(184, 142, 28, 20, "metal", rx=1)
    s.text(151, 182, "CAPTURE LIP; MAGNET DOES NOT DEFINE NYMPH SEAL", 2.0, "bold")
    s.view_label(278, 112, "Q - B03 250/500 joint", "5:1", projected=True)
    s.place_hlr("b03-front", 290, 128, 5, 1)
    s.text(290, 182, "SHEAR KEY; FACE CASSETTE NOT STRUCTURAL", 2.0, "bold")
    s.note_box(12, 198, 393, "DETAIL RELEASE RULE", [
        "Projected callouts are HLR of unique-part STEP. TARGET/REF/UNVERIFIED still need coupon or vendor drawing before #31.",
        f"B20 keep-out lives on S10. Base CAD-02 {BASE_SHA[:12]}. CAD-01 {CAD01_SHA[:12]}. EE-23..26 PRs 37-40 read-only.",
        "Wipe, magnet, and camera-module details remain diagrams: no sourced STEP this run.",
    ], "ref")
    s.scale_bar(12, 236, model_mm=10, scale_num=5, scale_denom=1)
    s.write("S11-details.svg")


def main():
    for fn in [sheet00, sheet01, sheet02, sheet03, sheet04, sheet05, sheet06, sheet07, sheet08, sheet09, sheet10, sheet11]:
        fn()


if __name__ == "__main__":
    main()
