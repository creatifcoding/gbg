#!/usr/bin/env python3
"""Generate the theoretical mantis-terrarium schematic set as A3 SVG sheets.

Issue #41 write-set lives here. Dimensions on the sheets are measured from
draft CAD/EE on other PRs, locked contracts, or primary vendor docs fetched
this run. Concept views remain NTS until released STEP drives true-scale
orthographics. Do not invent Particle camera SKUs or connector pinouts.
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

W, H = 420.0, 297.0
DRAW_BOTTOM = 257.0
DATE = "2026-08-20"
REV = "B-41"

# Base and measured-source SHAs recorded this run. CAD-02 is the PR base
# because it carries the #29 carriage/binder solids plus the inherited
# theoretical sheets. feat/mantis-biomemetics-lab moved to e4354004 after
# CAD-02 branched at 1e668327; that lab tip does not include #29 geometry.
BASE_BRANCH = "cursor/mantis-cad-02-carriage-9635"
BASE_SHA = "cdd523c55a630962c399a812c9347be6f7fb9334"
LAB_MERGE_BASE = "1e6683272e4e15d50dd90b60fd3f7c0f3dd5bbb3"
CAD01_SHA = "fe8f875a80b37a1003f05f3a0190fbe2f0417842"  # PR 34 / #28
CAD02_SHA = BASE_SHA  # PR 36 / #29
EE23_SHA = "750872f4c10317a0e9f9900501882968531d332d"  # PR 37
EE24_SHA = "2324e7e521a306e5f9605c04e08a4223b7c77212"  # PR 38
EE25_SHA = "977b272a3e32ed9e9eda7a1b44b545770352c972"  # PR 39
EE26_SHA = "a9918b32ebac41b03f0ba55fd189c73bc7df05e7"  # PR 40


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


CONTRACT = load_contracts()
PARAM = CONTRACT["parameters"]
BUS_CONTACTS = CONTRACT["contacts"]
FRAME_BAND = PARAM["frame_w"]
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

# CAD-01 (#28 / PR 34) unique-part OCCT bboxes and study-backed REF geometry.
# Status is the CAD leaf status, not a shop measurement.
CAD01 = {
    "b01": (24.0, 24.0, 24.0),
    "b02": (250.0, 24.0, 24.0),
    "b03": (22.0, 24.0, 24.0),
    "b04": (250.0, 5.2, 12.0),
    "b05": (202.0, 3.0, 427.0),
    "b07": (214.0, 8.0, 439.0),
    "b10": (250.0, 250.0, 6.0),
    "b12": (80.0, 12.0, 80.0),
    "b14": (202.0, 202.0, 3.0),
    "b18_250": (250.0, 38.0, 16.0),
    "b18_500": (500.0, 38.0, 16.0),
    "b20_bbox": (-8.0, -8.0, 0.0, 250.0, 250.0, 500.0),
    "b51": (8.0, 38.0, 17.5),
    "b52_t": 1.5,
    "assembly_bbox": (-43.0, -43.0, -8.0, 258.0, 250.0, 508.0),
    "rail_offset": 5.0,
    "guard_t": 1.5,
    "slot": 0.4,
    "land_t": 0.2,
    "dock_pad": 18.0,
    "pocket_inset": 10.0,
    "pocket_h": 10.0,
    "pocket_z": 8.0,
    "seat_clear": 0.20,
    "kerf": 0.15,
    "molt": 142.0,
    "nymph_gap": 0.50,
    "b51_bore": 3.4,
}

# CAD-02 (#29 / PR 36) unique-part AABBs and pinch/binder travels.
CAD02 = {
    "b22": (60.0, 42.0, 28.0),
    "b23_lever": (8.0, 12.0, 22.0),
    "b24": (36.0, 32.0, 6.0),
    "b25": (10.0, 10.0, 16.0),
    "b26_d": 8.0,
    "b27_span": 28.44,
    "b28": (24.0, 14.0, 10.0),
    "b29": (40.0, 36.0, 22.0),
    "b34": (16.0, 8.0, 3.0),
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
    "unmate": 2.0,
    "pogo_d": 1.0,
    "pogo_barrel": 6.0,
    "s1_env": 8.0,
    "s2_env": 8.0,
}

# Particle / ADI claims fetched 2026-08-20. No camera-module SKU or CSI pin
# table is copied onto the sheets.
VENDOR = {
    "tachyon_xyz": (85.0, 56.0, 18.5),
    "m1_xyz": (121.0, 220.0, 69.0),
    "csi_pins": 22,
    "csi_pitch": 0.5,
    "gpio68": "HIGH enables CSI on shared DSI/CSI2",
    "cameras": "Particle lists Sony IMX519 AF and Samsung S5K3P9SX; orderable module SKU UNVERIFIED",
}


def esc(s: object) -> str:
    return html.escape(str(s), quote=True)


class Sheet:
    def __init__(self, num: int, title: str, scale: str):
        self.num = num
        self.title = title
        # These authored concept views are not CAD-derived at their nominal
        # print ratios. Until released CAD drives the sheets, claiming a
        # numeric scale would invite unsafe shop measurement.
        self.scale = "NTS"
        self.e: list[str] = []
        self._defs()

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
    .hidden { stroke:#59616b; stroke-width:.28; stroke-dasharray:2 1.2; fill:none; }
    .phantom { stroke:#d65a24; stroke-width:.35; stroke-dasharray:5 1 1 1; fill:none; }
    .center { stroke:#73808d; stroke-width:.22; stroke-dasharray:4 1 1 1; fill:none; }
    .dim { stroke:#15171a; stroke-width:.25; fill:none; marker-start:url(#arr); marker-end:url(#arr); }
    .leader { stroke:#15171a; stroke-width:.3; fill:none; marker-end:url(#arr); }
    .motion { stroke:#d65a24; stroke-width:.55; fill:none; marker-end:url(#arr-orange); }
    .ref { fill:#fff6d9; stroke:#c49817; stroke-width:.25; }
    .unverified { fill:#fff0f0; stroke:#ba3d3d; stroke-width:.3; }
    .keepout { fill:#dd3c3c; fill-opacity:.08; stroke:#c63333; stroke-width:.35; stroke-dasharray:4 2; }
    .metal { fill:#e1e4e8; stroke:#15171a; stroke-width:.35; }
    .plastic { fill:#f7f8f9; stroke:#15171a; stroke-width:.35; }
    .cut { fill:url(#hatch); stroke:#15171a; stroke-width:.45; }
  </style>
</defs>""")

    def line(self, x1, y1, x2, y2, cls="thin", color=None):
        extra = f' stroke="{color}"' if color else ""
        self.e.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" class="{cls}"{extra}/>' )

    def rect(self, x, y, w, h, cls="thin", rx=0, fill=None, stroke=None):
        attrs = ""
        if fill is not None: attrs += f' fill="{fill}"'
        if stroke is not None: attrs += f' stroke="{stroke}"'
        self.e.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" class="{cls}"{attrs}/>' )

    def circle(self, x, y, r, cls="thin", fill=None):
        attrs = f' fill="{fill}"' if fill is not None else ""
        self.e.append(f'<circle cx="{x}" cy="{y}" r="{r}" class="{cls}"{attrs}/>' )

    def poly(self, pts, cls="thin", fill=None):
        attrs = f' fill="{fill}"' if fill is not None else ""
        p = " ".join(f"{x},{y}" for x, y in pts)
        self.e.append(f'<polygon points="{p}" class="{cls}"{attrs}/>' )

    def path(self, d, cls="thin", fill=None):
        attrs = f' fill="{fill}"' if fill is not None else ""
        self.e.append(f'<path d="{d}" class="{cls}"{attrs}/>' )

    def text(self, x, y, txt, size=3.0, weight="normal", anchor="start", cls="", color=None, rotate=None):
        attrs = f' class="{cls}"' if cls else ""
        if color: attrs += f' fill="{color}"'
        if rotate is not None: attrs += f' transform="rotate({rotate} {x} {y})"'
        self.e.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" text-anchor="{anchor}"{attrs}>{esc(txt)}</text>')

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
        if line: lines.append(line)
        for i, ln in enumerate(lines[:max_lines]):
            self.text(x, y + i * leading, ln, size=size, weight=weight)
        return y + min(len(lines), max_lines) * leading

    def view_label(self, x, y, name, scale=None):
        self.text(x, y, name.upper(), 3.2, "bold")
        if scale:
            self.text(x, y + 3.8, "SCALE NTS - DO NOT SCALE", 2.3)

    def dim_h(self, x1, x2, y, obj_y, label):
        self.line(x1, obj_y, x1, y, "thin")
        self.line(x2, obj_y, x2, y, "thin")
        self.line(x1, y, x2, y, "dim")
        self.text((x1+x2)/2, y-1.4, label, 2.7, anchor="middle")

    def dim_v(self, y1, y2, x, obj_x, label):
        self.line(obj_x, y1, x, y1, "thin")
        self.line(obj_x, y2, x, y2, "thin")
        self.line(x, y1, x, y2, "dim")
        self.text(x-1.7, (y1+y2)/2, label, 2.7, anchor="middle", rotate=-90)

    def balloon(self, x, y, n, tx=None, ty=None):
        self.circle(x, y, 4.0, "med", fill="#ffffff")
        self.text(x, y+1.2, n, 2.6, "bold", "middle")
        if tx is not None and ty is not None:
            self.line(x, y+4, tx, ty, "leader")

    def note_box(self, x, y, w, title, lines, kind="normal"):
        h = 7 + len(lines)*4.0
        cls = "med"
        fill = "#f7f8fa"
        if kind == "ref": fill = "#fff6d9"
        if kind == "warn": fill = "#fff0f0"
        self.rect(x, y, w, h, cls, rx=1.2, fill=fill)
        self.text(x+3, y+4.4, title, 2.8, "bold")
        for i, ln in enumerate(lines): self.text(x+3, y+9+i*4, ln, 2.45)
        return h

    def scale_bar(self, x, y, real_mm=100, denom=5):
        self.rect(x, y, 58, 8, "unverified", rx=1, fill="#fff0f0")
        self.text(x+29, y+5.2, "NTS - DO NOT SCALE", 2.3, "bold", "middle", color="#ba3d3d")

    def title_block(self):
        y = DRAW_BOTTOM
        self.line(8, y, 412, y, "heavy")
        self.rect(8, y, 404, 32, "med")
        self.line(270, y, 270, 289, "med")
        self.line(334, y, 334, 289, "med")
        self.line(376, y, 376, 289, "med")
        self.line(270, y+11, 412, y+11, "thin")
        self.line(270, y+21, 412, y+21, "thin")
        self.text(13, y+8, "PARTICLE-BASE MANTIS TERRARIUM", 5.0, "bold")
        self.text(13, y+15, self.title, 4.0, "bold")
        self.text(13, y+23, "THEORETICAL - VERIFY AGAINST STEP / FIRST ARTICLE", 3.0, "bold", color="#ba3d3d")
        self.text(13, y+28, "Units: mm | Projection: THIRD-ANGLE (ASME Y14.3)", 2.5)
        fields = [
            (273, y+4, "SCALE", self.scale), (337, y+4, "DATE", DATE), (379, y+4, "REV", REV),
            (273, y+15, "SHEET", f"{self.num+1:02d} OF 12 / S{self.num:02d}"), (337, y+15, "STATUS", "THEORETICAL"), (379, y+15, "DRAWN", "GBG#41"),
            (273, y+25, "DWG", f"MT-S{self.num:02d}"), (337, y+25, "FORMAT", "A3 SVG/PDF"), (379, y+25, "TOL", "AS NOTED")]
        for x, yy, lab, val in fields:
            self.text(x, yy, lab, 1.9, "bold")
            self.text(x, yy+4, val, 2.5)
        # Third-angle projection symbol. Numeric witness bars are forbidden
        # until views are generated at true scale from released CAD.
        self.path(f"M226 {y+19} L238 {y+16} L238 {y+27} L226 {y+24} Z", "med")
        self.circle(246, y+21.5, 6, "med")
        self.text(236, y+30, "3RD ANGLE", 1.8, "bold", anchor="middle")
        self.rect(196, y+7, 58, 7, "unverified", rx=1, fill="#fff0f0")
        self.text(225, y+11.8, "NTS - DO NOT SCALE", 2.0, "bold", "middle", color="#ba3d3d")

    def write(self, filename):
        self.title_block()
        svg = [f'<svg xmlns="http://www.w3.org/2000/svg" width="420mm" height="297mm" viewBox="0 0 420 297">',
               '<rect width="420" height="297" fill="#fcfcfb"/>'] + self.e + ['</svg>']
        (OUT / filename).write_text("\n".join(svg), encoding="utf-8")


def iso_box(s: Sheet, ox, oy, w, d, h):
    dx, dy = d*0.45, -d*0.28
    front = [(ox,oy),(ox+w,oy),(ox+w,oy-h),(ox,oy-h)]
    top = [(ox,oy-h),(ox+w,oy-h),(ox+w+dx,oy-h+dy),(ox+dx,oy-h+dy)]
    side = [(ox+w,oy),(ox+w+dx,oy+dy),(ox+w+dx,oy-h+dy),(ox+w,oy-h)]
    s.poly(front,"heavy",fill="#ffffff")
    s.poly(top,"med",fill="#f2f4f5")
    s.poly(side,"med",fill="#e8ecef")
    return dx,dy


def sheet00():
    s=Sheet(0,"COVER / THEORY", "1:5")
    s.text(12,17,"READABLE THEORY OF THE MACHINE",8,"bold")
    s.text(12,24,"Exterior electrification; interior remains plastic, screened, and animal-safe.",3.6)
    dx,dy=iso_box(s,48,220,100,50,170)
    # frame and door
    for x in [48,148]: s.rect(x-3,50,6,170,"plastic",rx=1)
    s.rect(48,47,100,6,"plastic",rx=1); s.rect(48,217,100,6,"plastic",rx=1)
    s.rect(58,68,80,138,"thin",rx=1,fill="#f7fbfc")
    s.line(98,68,98,206,"thin"); s.circle(132,137,2,"med",fill="#ffffff")
    s.rect(58,49,80,12,"thin",fill="url(#screen)")
    # rail outside
    s.rect(43,43,110,5,"med",rx=1,fill="#d7dde2")
    s.rect(42,42,25,9,"heavy",rx=2,fill="#f8f8f8")
    s.text(54.5,39,"PINCH CARRIAGE",2.4,"bold","middle")
    # camera + brick
    s.rect(31,48,18,16,"med",rx=2,fill="#f1f3f5")
    s.circle(40,56,4,"heavy",fill="#dde4ea")
    s.path("M40 64 C25 100, 22 160, 188 195","phantom")
    s.rect(183,170,54,78,"heavy",rx=4,fill="#edf1f4")
    s.text(210,183,"M1 / TACHYON",3.2,"bold","middle")
    s.text(210,189,"OUTSIDE CAGE",2.6,"bold","middle")
    s.rect(195,200,30,17,"med",fill="#ffffff")
    s.text(210,210,f"{VENDOR['tachyon_xyz'][0]:g} x {VENDOR['tachyon_xyz'][1]:g} DATASHEET",2.1,"middle")
    # keepout
    s.rect(60,78,76,116,"keepout",rx=2)
    s.text(98,132,"ANIMAL VOLUME",4,"bold","middle",color="#b52d2d")
    s.text(98,138,"NO METAL / COPPER / POGOS",2.4,"bold","middle",color="#b52d2d")
    s.text(98,144,"B20 WET-SIDE BARRIER",2.3,"bold","middle",color="#b52d2d")
    s.note_box(260,18,145,"SYSTEM THEORY",[
        f"{MODULE_PITCH:g} mm block perimeter; {SPAN:g} mm first tower.",
        "P01-P08: protected continuous VIN/GND/I2C/UID/P08.",
        "P09-P12: indexed GMSL2 only while stationary.",
        "Raw MIPI stays binder-local and Tachyon-local.",
        "Pinch is break-before-move; video off while rolling.",
        "M1/Tachyon brick never enters the animal cage."])
    s.note_box(260,70,145,"LOCKED SAFETY BOUNDARY",[
        f"Upper-third molt keep-out {CAD01['molt']:g} mm CALCULATED.",
        f"Ceiling/vents: <= {SCREEN_APERTURE:g} mm non-metal LOCK.",
        "B20 is the continuous wet-side barrier (CAD-01 bbox).",
        "Door front/side; nymph-visible gap <=0.50 TARGET.",
        "No taxon inferred: no live-mantis photo supplied."],"warn")
    s.note_box(260,122,145,"MEASURED THIS RUN (DRAFT CAD/EE)",[
        f"Base {BASE_BRANCH}",
        f"{BASE_SHA[:12]}  CAD-02/#29",
        f"CAD-01/#28  {CAD01_SHA[:12]}  PR 34",
        f"EE-23..26  PRs 37-40  (read-only)",
        "No Particle camera SKU or CSI pin table drawn."],"ref")
    s.note_box(260,178,145,"DRAWING STATUS",[
        "Views are NTS until released STEP drives scale.",
        "OCCT bboxes from CAD-01 unique parts; kinematics from CAD-02.",
        "S08 follows EE-24 net-map; KiCad is circuit authority.",
        "docs/variant screenshots: none on PRs 32-40 this run."],"ref")
    s.scale_bar(12,232,100,5)
    s.write("S00-cover.svg")


def front_view(s,x,y,w,h,door=True):
    s.rect(x,y,w,h,"heavy")
    t=4
    for xx in [x,x+w-t]: s.rect(xx,y,t,h,"plastic")
    for yy in [y,y+h-t]: s.rect(x,yy,w,t,"plastic")
    s.rect(x+t+2,y+t+2,w-2*t-4,h-2*t-4,"thin",fill="#f8fbfc")
    if door:
        s.line(x+w/2,y+t+2,x+w/2,y+h-t-2,"med")
        s.circle(x+w-10,y+h/2,1.5,"med")
    s.rect(x+t+2,y+t+2,w-2*t-4,8,"thin",fill="url(#screen)")


def sheet01():
    s=Sheet(1,"ORTHOGRAPHIC ASSEMBLY", "1:5")
    s.view_label(17,16,"Front elevation","1:5")
    front_view(s,35,30,50,100)
    s.rect(31,25,58,3,"med",fill="#dce1e5")
    s.rect(29,24,14,6,"heavy",rx=1.5,fill="#ffffff")
    s.dim_h(35,85,140,130,f"{MODULE_PITCH:g} LOCK")
    s.dim_v(30,130,24,35,f"{SPAN:g} LOCK")
    s.line(35,80,85,80,"center")
    s.text(88,82,f"{MODULE_PITCH:g} GRID",2.5,"bold")
    s.view_label(118,16,"Right elevation","1:5")
    front_view(s,132,30,50,100,False)
    s.rect(128,25,58,3,"med",fill="#dce1e5")
    s.dim_h(132,182,140,130,f"{MODULE_PITCH:g} LOCK")
    s.view_label(215,16,"Top plan","1:5")
    s.rect(230,43,50,50,"heavy")
    s.rect(234,47,42,42,"thin",fill="url(#screen)")
    s.rect(226,38,58,3,"med",fill="#dce1e5")
    s.rect(224,37,14,6,"heavy",rx=1.5,fill="#ffffff")
    s.dim_h(230,280,103,93,f"{MODULE_PITCH:g} LOCK")
    s.dim_v(43,93,219,230,f"{MODULE_PITCH:g} LOCK")
    s.view_label(311,16,"Datum / keep-out","1:5")
    front_view(s,326,30,50,100)
    s.rect(332,66,38,50,"keepout")
    s.text(351,89,"UPPER 1/3",2.4,"bold","middle",color="#b52d2d")
    s.text(351,94,"CLEAR",2.4,"bold","middle",color="#b52d2d")
    s.line(326,63,376,63,"phantom")
    s.text(380,65,"MOLT DATUM",2.3,"bold")
    s.note_box(18,166,115,"LOCKED ENVELOPE",[
        "Exterior: 250 W x 250 D x 500 H LOCK.",
        "Module datum repeats at 250 mm.",
        f"Nominal clear: {CLEAR_W:g} x {CLEAR_D:g} x {CLEAR_H:g} CALCULATED.",
        f"CAD-01 assembly bbox: {CAD01['assembly_bbox'][0]:g}..{CAD01['assembly_bbox'][3]:g} X,",
        f"{CAD01['assembly_bbox'][1]:g}..{CAD01['assembly_bbox'][4]:g} Y, {CAD01['assembly_bbox'][2]:g}..{CAD01['assembly_bbox'][5]:g} Z REF."],"ref")
    s.note_box(151,166,115,"PROJECTION",[
        "Third-angle arrangement shown.",
        "Front is the door/view cassette face.",
        f"Rail offset {CAD01['rail_offset']:g} mm REF outside frame.",
        "B20 starts at Y/X = -8 REF (offset+wall)."],"normal")
    s.note_box(284,166,115,"INTERFACE DATUMS",[
        "A: exterior block face (frame.world origin).",
        "B: cassette seat plane.",
        "C: rail conductor centerline (external).",
        f"D: false-bottom tray {TRAY:g} mm REF.",
        f"Molt datum: {CAD01['molt']:g} mm CALCULATED."],"normal")
    s.scale_bar(18,232,100,5)
    s.write("S01-ortho.svg")


def sheet02():
    s=Sheet(2,"EXPLODED ASSEMBLY", "1:5")
    s.view_label(13,15,"Functional-axis explosion","1:5")
    cx=126
    # vertical explosion pieces
    parts=[
        (22,100,14,"B10/B11","MESH CEILING CASSETTE"),
        (48,112,9,"B01/B02","TOP PERIMETER / CORNERS"),
        (72,90,42,"B05","VIEW / DOOR CASSETTES"),
        (124,112,9,"B03","MID-SPAN JOINT"),
        (146,90,35,"B14/B15","FALSE BOTTOM + TRAY"),
        (190,112,9,"B01/B02","BOTTOM PERIMETER"),]
    for y,w,h,bid,label in parts:
        s.rect(cx-w/2,y,w,h,"med",rx=1,fill="#f6f7f8")
        s.line(cx,y+h,cx,y+18,"center")
        s.balloon(47,y+h/2,bid,cx-w/2,y+h/2)
        s.text(175,y+h/2+1,label,2.7,"bold")
    # side exploded rail/binder/brick
    s.rect(282,47,82,5,"med",rx=1,fill="#dce2e6")
    s.balloon(378,49,"B18",364,49)
    s.rect(298,65,24,15,"heavy",rx=2,fill="#ffffff")
    s.balloon(378,72,"B22",322,72)
    s.rect(302,95,16,13,"med",rx=1,fill="#edf1f4")
    s.circle(310,101.5,4,"heavy",fill="#dfe5e9")
    s.balloon(378,101,"B36",318,101)
    s.path("M310 108 C315 125, 350 135, 344 157","phantom")
    s.rect(315,157,58,72,"heavy",rx=4,fill="#edf1f4")
    s.rect(326,180,34,20,"med",fill="#fff")
    s.text(344,191,"TACHYON",3,"bold","middle")
    s.balloon(390,175,"B42",373,175)
    # trail lines
    for y in [52,80,108,157]: s.line(310,y+3,310,y+11,"center")
    s.note_box(13,215,187,"EXPLOSION RULE",[
        "Subassemblies remain grouped; trail lines follow service axes.",
        "CAD-01 unique parts: B01-B04, B10, B18/B51/B52, B05-B07, B12-B14, B20.",
        "CAD-02 grouped: B22-B27 pinch, B28/B29/B50 binder. No animal-side metal."],"normal")
    s.note_box(215,215,190,"INSTALL ORDER",[
        "1 perimeter -> 2 faces -> 3 ceiling -> 4 false bottom.",
        "5 animal-isolated rail -> 6 carriage -> 7 SerDes binder -> 8 brick hub.",
        "First article requires leak, pinch, pull-off and nymph-gap checks."],"ref")
    s.write("S02-exploded.svg")


def sheet03():
    s=Sheet(3,"PERIMETER BLOCKS", "1:2 / DETAILS 2:1")
    s.view_label(14,15,"Corner block","1:2")
    s.path("M30 40 L80 40 L80 90 L68 90 L68 53 L30 53 Z","heavy",fill="#f5f7f8")
    s.path("M43 53 L43 76 L68 76","hidden")
    s.text(55,99,f"CASSETTE POCKET {3.00+CAD01['seat_clear']:.2f} TARGET (3.00 LOCK + 0.20)",2.2,"bold","middle")
    s.dim_h(30,80,110,90,f"{CAD01['b01'][0]:g} CAD-01 BBOX")
    s.dim_v(40,90,20,30,f"{CAD01['b01'][2]:g} CUBE REF")
    s.balloon(92,52,"B01",80,52)
    s.view_label(118,15,"Edge block","1:2")
    s.rect(130,40,80,25,"heavy",rx=1,fill="#f6f7f8")
    s.rect(136,47,68,8,"thin",fill="#ffffff")
    s.dim_h(130,210,76,65,f"{MODULE_PITCH:g} LOCK")
    s.balloon(220,50,"B02",210,50)
    s.view_label(248,15,"Mid-span block","1:2")
    s.rect(263,40,80,25,"heavy",rx=1,fill="#f6f7f8")
    s.line(303,40,303,65,"med")
    s.circle(288,52.5,3,"med"); s.circle(318,52.5,3,"med")
    s.dim_h(263,343,76,65,f"{MODULE_PITCH:g} + {MODULE_PITCH:g} DATUM")
    s.balloon(355,50,"B03",343,50)
    # Captive end stop for each independent carriage route.
    s.view_label(248,88,"Route end stop / service removal","NTS")
    s.rect(265,105,78,7,"med",fill="#dce2e6")
    s.rect(337,96,13,25,"heavy",rx=1,fill="#f5f7f8")
    s.circle(343.5,108.5,2.2,"heavy",fill="#ffffff")
    s.text(302,119,"CANNOT PASS IN NORMAL USE",2.1,"bold","middle")
    s.balloon(362,98,"B51",349,101)
    # joint blowup
    s.view_label(14,130,"Detail A - 250 -> 500 span joint","2:1")
    s.rect(30,150,70,32,"cut")
    s.rect(120,150,70,32,"cut")
    s.rect(88,156,44,20,"metal")
    s.line(110,143,110,190,"center")
    s.circle(96,166,2.6,"heavy",fill="#fff"); s.circle(124,166,2.6,"heavy",fill="#fff")
    s.dim_h(88,132,195,176,f"{CAD01['b03'][0]:g} CAD-01 BBOX")
    s.text(110,207,"SHEAR BY TONGUE; B21 IS NOT A CORNER ROLL SOLID",2.5,"bold","middle")
    s.balloon(205,158,"B03",132,160)
    # cassette section
    s.view_label(235,130,"Detail B - cassette seat","2:1")
    s.rect(252,147,18,58,"cut")
    s.rect(270,158,6,36,"metal")
    s.rect(276,155,11,42,"plastic")
    s.line(283,155,283,197,"hidden")
    s.dim_h(270,276,213,194,f"{3.00+CAD01['seat_clear']:.2f} TARGET")
    s.text(292,162,"3.00 PANEL LOCK",2.5,"bold")
    s.text(292,168,f"{CAD01['seat_clear']:.2f} TARGET CLEARANCE",2.5)
    s.text(292,176,f"POCKET INSET {CAD01['pocket_inset']:g} / Z {CAD01['pocket_z']:g} REF",2.5)
    s.text(292,184,f"NYMPH GAP <={CAD01['nymph_gap']:.2f} TARGET",2.5,"bold",color="#b52d2d")
    s.text(292,192,f"B04 RETAINER {CAD01['b04'][0]:g} x {CAD01['b04'][1]:g} x {CAD01['b04'][2]:g} CAD-01",2.2)
    s.note_box(14,222,180,"CAD-01 MEASURED UNIQUE PARTS",[
        f"B01 24 cube; B02 250 x 24 x 24; B03 22 x 24 x 24; B10 250 x 250 x 6.",
        f"Kerf {CAD01['kerf']:g} REF on B05/B06 cut profiles. Coupon 3.10/3.20/3.30."],"ref")
    s.note_box(214,222,190,"LOAD PATH / ROUTES",[
        "Panel -> gasket -> pocket wall -> perimeter block.",
        "500 span bending crosses B03 coupler, not the face cassette.",
        "B21: top-front and vertical routes are independent; no corner roll.",
        f"B51 {CAD01['b51'][0]:g} x {CAD01['b51'][1]:g} x {CAD01['b51'][2]:g}; bore {CAD01['b51_bore']:g} UNVERIFIED PN."],"normal")
    s.write("S03-blocks.svg")


def rail_section(s,x,y,scale=1):
    # 68w x 38h diagram: continuous low-speed strip plus docked HSD cell.
    s.path(f"M{x} {y+32} L{x+7} {y+5} L{x+61} {y+5} L{x+68} {y+32} L{x+59} {y+38} L{x+9} {y+38} Z","cut")
    s.rect(x+10,y+18,48,9,"plastic",rx=1)
    s.rect(x+12,y+20,44,1.6,"metal")
    cols=["#d9822b","#d9822b","#333333","#333333","#2c9c69","#307ac7","#7a55a3","#d34887","#333333","#0a7891","#0a7891","#333333"]
    for i,c in enumerate(cols): s.rect(x+13+i*3.55,y+20.1,2.0,1.4,"thin",fill=c)
    # B52 guard lips shield the external access slot; no film overlays contacts.
    s.rect(x+11,y+17,8,1.2,"plastic")
    s.rect(x+49,y+17,8,1.2,"plastic")


def sheet04():
    s=Sheet(4,"RAIL + STRIP", "2:1 / DETAIL 5:1")
    s.view_label(12,15,"Rail channel section C-C","2:1")
    rail_section(s,30,35)
    s.balloon(109,46,"B18",98,48)
    s.balloon(109,67,"B19",87,59)
    s.balloon(109,88,"B20",82,72)
    s.balloon(18,47,"B52",42,52)
    s.text(29,84,"WET-SIDE BARRIER",2.5,"bold",color="#b52d2d")
    s.line(28,80,100,80,"phantom")
    s.dim_h(30,98,104,73,f"{RAIL_WIDTH:g} CAD-01 BBOX")
    s.dim_v(40,73,20,30,f"{RAIL_HEIGHT:g} CAD-01 BBOX")
    # longitudinal rail
    s.view_label(125,15,"Longitudinal conductor run","1:2")
    s.rect(135,38,230,66,"med",rx=2,fill="#f3f5f6")
    colors=["#d9822b","#d9822b","#333333","#333333","#2c9c69","#307ac7","#7a55a3","#d34887"]
    labels=[contact["net"] for contact in BUS_CONTACTS[:8]]
    for i,(c,l) in enumerate(zip(colors,labels)):
        yy=43+i*4.4
        s.line(145,yy,355,yy,"med",color=c)
        s.text(139,yy+1,l,2.3,"bold","end",color=c)
    # Four point-to-point high-speed docks; mechanical detents remain 25 mm.
    for i,xx in enumerate([162,218,282,338],start=1):
        s.rect(xx-12,82,24,13,"med",rx=1,fill="#e7f5f6")
        s.text(xx,88,f"V{i}  G + - G",2.0,"bold","middle",color="#0a7891")
        s.text(xx,92,"100 ohm TARGET",1.8,"middle")
    for xx in range(150,356,25): s.line(xx,36,xx,106,"center")
    s.text(250,112,f"V-DOCK PITCH {DOCK_PITCH:g} CALCULATED (500/4); VIDEO ONLY AT INDEXED DOCKS",2.3,"bold","middle")
    # stackup detail
    s.view_label(12,126,"Detail D - strip stack-up","5:1")
    s.text(30,146,"EXPOSED ENIG LAND IN CAPTIVE EXTERNAL SLOT - NO FILM OVER CONTACT",2.05,"bold",color="#b52d2d")
    layers=[("ENIG CONTACT LAND",2,"#e6b84a"),("FLEX / SPRING COPPER",5,"#d77c3d"),("DIELECTRIC",7,"#d7e4f0"),("PETG / ASA FRAME",18,"#f4f5f6")]
    yy=151
    for name,hh,fc in layers:
        s.rect(30,yy,120,hh,"med",fill=fc)
        s.text(156,yy+hh/2+1,name,2.4,"bold")
        yy+=hh
    s.text(30,190,f"LAND t={CAD01['land_t']:g} REF (study); OTHER STACK LAYERS UNVERIFIED",2.3,"bold",color="#b52d2d")
    # conductor pitch detail
    s.view_label(230,126,"Detail E - contact lands","5:1")
    for i,c in enumerate(colors):
        s.rect(239+i*12,150,7,28,"med",fill=c)
        s.text(242.5+i*12,185,f"P{i+1:02d}",1.9,"bold","middle",color=c)
    for i,(lab,c) in enumerate([("G","#333"),("HSD+","#0a7891"),("HSD-","#0a7891"),("G","#333")]):
        s.rect(342+i*13,150,9,28,"med",fill=c)
        s.text(346.5+i*13,185,lab,1.8,"bold","middle",color=c)
    s.dim_h(245,263,197,178,f"{CONTACT_PITCH:g} PITCH TARGET")
    s.text(239,205,f"FIELD {CONTACT_FIELD:g} IN CAVITY {RAIL_WIDTH-2*RAIL_WALL:g}; P09-P12 GMSL2 CELL",2.2,"bold")
    s.note_box(12,218,190,"CAD-01 RAIL MEASURE",[
        f"B18 250: {CAD01['b18_250'][0]:g} x {CAD01['b18_250'][1]:g} x {CAD01['b18_250'][2]:g}; 500 span sibling.",
        f"Offset {CAD01['rail_offset']:g} REF; B52 lip {CAD01['b52_t']:g}; slot {CAD01['slot']:g} REF.",
        f"Dock pad {CAD01['dock_pad']:g} REF; V-pitch {DOCK_PITCH:g} CALCULATED.",
        "B20 is the wet-side barrier; it is not a film over contacts."],"ref")
    s.note_box(215,218,190,"FAILURE CONTROL",[
        "S1 first travel opens Q1 before B27 lift (CAD-02 q=1.0 TARGET).",
        "Bent HSD pogo -> link loss; no fallback to raw MIPI on the strip.",
        "Each V-dock is point-to-point to one MAX96724 input.",
        f"B52 is a labyrinth wiper, not a hermetic cover. EE-23 series UNVERIFIED."],"warn")
    s.write("S04-rail-strip.svg")


def sheet05():
    s=Sheet(5,"CARRIAGE MECHANISM", "2:1 / DETAIL 5:1")
    s.view_label(12,15,"Locked state","2:1")
    # locked cross section
    s.path("M25 45 L38 28 L95 28 L108 45 L102 75 L31 75 Z","heavy",fill="#f6f7f8")
    s.circle(42,57,6,"metal"); s.circle(91,57,6,"metal")
    s.rect(48,52,37,7,"plastic",rx=1)
    for i in range(12):
        x=49.5+i*3.0
        s.line(x,59,x,69,"med")
        s.circle(x,70,1.4,"metal")
    s.rect(46,72,42,4,"metal")
    s.path("M38 35 Q31 48 37 60","med")
    s.path("M95 35 Q102 48 96 60","med")
    s.text(66,84,f"LOCKED q=0  B22 {CAD02['b22'][0]:g}x{CAD02['b22'][1]:g}x{CAD02['b22'][2]:g}  LIFT PAWL IN",2.3,"bold","middle")
    s.balloon(116,34,"B22",101,42); s.balloon(116,58,"B27",86,63); s.balloon(116,78,"B19",88,74)
    s.view_label(145,15,"Pinched / travel state","2:1")
    s.path("M160 45 L177 33 L226 33 L243 45 L237 75 L166 75 Z","heavy",fill="#f6f7f8")
    s.circle(177,57,6,"metal"); s.circle(226,57,6,"metal")
    s.rect(182,47,39,7,"plastic",rx=1)
    for i in range(12):
        x=183.5+i*3.0
        s.line(x,54,x,64,"med")
        s.circle(x,65,1.4,"metal")
    s.rect(181,72,42,4,"metal")
    s.path("M175 33 Q164 48 174 60","phantom")
    s.path("M228 33 Q239 48 229 60","phantom")
    s.line(170,42,180,51,"motion"); s.line(233,42,223,51,"motion")
    s.line(203,66,203,55,"motion")
    s.line(175,83,230,83,"motion")
    s.text(202,90,f"q={CAD02['q_roll']:g} ROLLING; LIFT {CAD02['throw']:g} THROW / {CLEARANCE_LIFT:g} CLEAR",2.35,"bold","middle")
    # sequence — CAD-02 ADR-002 two-stage pawl, not a timed cam
    s.view_label(270,15,"CAD-02 pinch q (mm)","diagram")
    states=[
        (f"q=0 LOCKED","S1 closed; pawl in"),
        (f"q={CAD02['q_s1']:g} S1_OPEN","Q1 off; contacts seated"),
        (f"q={CAD02['q_safe']:g} PINCH_SAFE","lift pawl retracts"),
        (f"q={CAD02['q_clear']:g} CLEAR","lift={CAD02['throw']:g}; still locked"),
        (f"q={CAD02['q_roll']:g} ROLLING","translation pawl out"),
    ]
    for i,(a,b) in enumerate(states):
        x=272; y=28+i*17
        s.rect(x,y,128,15,"med",rx=1.5,fill="#f8f9fa")
        s.text(x+4,y+6,a,2.15,"bold")
        s.text(x+4,y+12,b,1.95)
    # detail spring/pogo
    s.view_label(12,120,"Detail F - pinch / spring / pogo array","5:1")
    s.path("M32 142 Q46 127 60 142 L60 205 L32 205 Z","cut")
    s.path("M42 145 C33 155 53 162 42 173 C33 184 53 191 42 201","med")
    s.line(67,145,67,191,"med")
    s.rect(63,151,8,22,"metal")
    s.circle(67,178,4,"metal")
    s.line(67,182,67,194,"med")
    s.circle(67,197,2.5,"metal")
    s.rect(58,203,18,4,"metal")
    s.dim_v(173,197,84,71,f"{POGO_COMPRESSION:.2f} WORK COMPRESSION TARGET")
    s.text(97,146,"B25 SPRING PN UNVERIFIED (POCKET ONLY)",2.3,"bold")
    s.text(97,154,f"PINCH FORCE {PINCH_FORCE_MIN:g}-{PINCH_FORCE_MAX:g} N TARGET",2.5)
    s.text(97,162,f"B27 PROXY d={CAD02['pogo_d']:g} / BARREL {CAD02['pogo_barrel']:g} UNVERIFIED",2.3,"bold",color="#b52d2d")
    s.text(97,170,f"B24 CARRIER {CAD02['b24'][0]:g}x{CAD02['b24'][1]:g}x{CAD02['b24'][2]:g}; B26 d={CAD02['b26_d']:g} UNVER",2.25)
    s.text(97,178,"MIPI IS NOT ON THESE CONTACTS",2.5,"bold",color="#b52d2d")
    s.text(97,186,"ADR-002: HARDWARE PAWLS, NOT A TIMED DELAY",2.2)
    s.note_box(230,121,175,"MECHANISM NOTE - PINCH-LIFT / ROLL",[
        "States: LOCKED / S1_OPEN / PINCH_SAFE / CONTACTS_CLEAR / ROLLING.",
        "What moves: B24/B27 lift then rollers; rail/B19 stays grounded.",
        f"q={CAD02['q_s1']:g} opens S1 envelope; contacts stay seated until q={CAD02['q_safe']:g}.",
        f"Lift pawl blocks Z until PINCH_SAFE. Throw {CAD02['throw']:g} covers {CLEARANCE_LIFT:g} clearance.",
        "Translation pawl blocks roll until lift >= clearance. Speed cannot skip a pawl.",
        "EE-24 S1/S2/Q1 parts UNVERIFIED; electrical dwell is a later independent gate.",
        "Chosen over screws for one-hand relocate without opening the cage."],"normal")
    s.note_box(230,191,175,"FAILURE / ACCEPTANCE",[
        "Interrupted pinch: keep Q1 off; require a clean full remate.",
        "Bent HSD: training timeout; Q1 latches off. No MIPI fallback.",
        "B51 retains loaded carriage (EE-26 route-retention UNVERIFIED).",
        "No conductor may breach B20."],"warn")
    s.write("S05-carriage-mech.svg")


def sheet06():
    s=Sheet(6,"UNIVERSAL LATCH + BINDER", "2:1 / DETAIL 5:1")
    s.view_label(12,15,"Universal shoe - free","2:1")
    s.rect(28,38,80,50,"heavy",rx=4,fill="#f5f7f8")
    s.path("M45 42 L55 52 L82 52 L92 42","med")
    s.path("M52 78 L62 68 L75 68 L85 78","med")
    s.rect(58,57,22,7,"metal",rx=1)
    s.text(68,96,f"B28 SHOE {CAD02['b28'][0]:g}x{CAD02['b28'][1]:g}x{CAD02['b28'][2]:g} CAD-02",2.3,"bold","middle")
    s.balloon(118,45,"B28",92,47)
    s.view_label(145,15,"Binder - mating","2:1")
    s.rect(162,31,62,65,"heavy",rx=5,fill="#eef1f4")
    s.path("M174 78 L184 68 L202 68 L212 78","heavy")
    s.path("M180 61 L190 54 L206 61","med")
    s.line(193,109,193,87,"motion")
    s.text(193,116,f"B29 HOUSING {CAD02['b29'][0]:g}x{CAD02['b29'][1]:g}x{CAD02['b29'][2]:g}",2.3,"bold","middle")
    s.balloon(234,42,"B29",224,45)
    s.view_label(260,15,"Mated / load path","2:1")
    s.rect(280,38,80,50,"heavy",rx=4,fill="#f5f7f8")
    s.rect(289,25,62,55,"heavy",rx=5,fill="#eef1f4")
    s.path("M297 72 L307 62 L331 62 L341 72","heavy")
    s.line(320,30,320,78,"motion")
    s.path("M320 30 C350 42 352 75 338 87","phantom")
    s.text(322,101,"MOMENT -> HOOK SHOULDERS -> SHOE -> RAIL",2.4,"bold","middle")
    # latch section
    s.view_label(12,126,"Detail G - click latch section","5:1")
    s.rect(30,145,85,46,"cut")
    s.path("M49 145 L60 155 L88 155 L99 145","heavy")
    s.path("M57 155 L57 176 Q70 190 83 176 L83 155","med")
    s.path("M63 168 L70 177 L77 168","heavy")
    s.line(70,197,70,180,"motion")
    s.text(124,151,"SPRING TONGUE DEFLECTION 1.2 TARGET",2.5,"bold")
    s.text(124,159,f"PULL-OFF >={BINDER_PULL_OFF:g} N TARGET",2.5)
    s.text(124,167,"SIDE PLAY <=0.20 TARGET",2.5)
    s.text(124,175,"MATERIAL: PETG/ASA BODY + POM WEAR KEY REF",2.5)
    s.text(124,183,"FAILURE: CRACK / PARTIAL ENGAGEMENT -> RETENTION WITNESS MARK",2.5,"bold",color="#b52d2d")
    # Binder-local CSI clearance and separate B50 face.
    s.view_label(260,126,"Detail H - binder-local FPC + B50 face","2:1")
    s.rect(280,143,88,52,"heavy",rx=4,fill="#eef1f4")
    s.circle(305,165,12,"heavy",fill="#dfe5e9")
    s.rect(325,153,12,30,"thin",fill="#d3a74b")
    s.path("M317 166 C321 153 326 156 331 168","phantom")
    s.rect(354,155,6,20,"metal")
    s.line(360,165,366,165,"thin")
    s.text(350,183,"S2 PLUNGER TARGET",1.8,"bold","middle",color="#b52d2d")
    s.text(334,205,f"LOCAL CSI KEEPOUT {CAD02['csi_keepout']:g} UNVERIFIED; MIPI STAYS IN BINDER",2.15,"bold","middle")
    s.text(334,211,f"B50 {CAD02['b50'][0]:g}x{CAD02['b50'][1]:g}x{CAD02['b50'][2]:g} KEY OFFSET {CAD02['b50_key']:g} TARGET",2.15,"bold","middle")
    s.balloon(387,153,"B50",357,164)
    s.note_box(12,215,190,"MECHANISM NOTE - BIND-LATCH",[
        f"States: BLOCKED until pinch q>={CAD02['q_safe']:g}; then r={CAD02['r_s2']:g}/{CAD02['r_safe']:g}/{CAD02['r_free']:g} TARGET.",
        "Binder housing moves; B28 shoe stays on carriage. Load path bypasses B50.",
        "First r opens S2 envelope while B50 stays keyed/seated (BRANCH_SAFE dwell).",
        "Release pin retracts only at PINCH_SAFE. Firmware cannot move that pin."],"normal")
    s.note_box(215,215,190,"FAILURE / CLEARANCE",[
        "Partial click: S2 stays open; Q1 remains off. Key blocks 180 reverse mate.",
        "B50 series/pinout/SI launch UNVERIFIED (#23). Do not invent a connector.",
        f"Camera keep-out {CAD02['cam_keepout']:g} is not a sourced module outline."],"warn")
    s.write("S06-latch-binder.svg")


def sheet07():
    s=Sheet(7,"CAMERA LOAD / SERDES BINDER", "2:1 / PCB 1:1")
    s.view_label(12,15,"Camera binder assembly","2:1")
    s.rect(28,32,126,84,"heavy",rx=6,fill="#eef1f4")
    s.rect(42,48,50,48,"med",fill="#d8e2e7")
    s.circle(67,72,13,"heavy",fill="#eef3f5")
    s.text(67,102,"B36 CAMERA MODULE",2.3,"bold","middle")
    s.text(67,107,"SKU / OUTLINE UNVERIFIED - NOT A SOURCED STEP",2.0,"middle",color="#b52d2d")
    s.rect(103,46,36,52,"med",rx=2,fill="#f8f3df")
    s.text(121,61,"B45",2.5,"bold","middle")
    s.text(121,68,"MAX96717",2.6,"bold","middle")
    s.text(121,75,"SERIALIZER",2.2,"middle")
    s.text(121,84,"LOCAL DC/DC",2.0,"middle")
    s.line(92,72,103,72,"motion")
    s.text(97.5,68,"MIPI",1.8,"bold","middle")
    # Separate carriage-to-binder handoff; exact connector geometry is not released.
    for i in range(12): s.circle(45+i*8,111,2.1,"metal")
    s.text(91,122,"B50 KEYED 12-NET BINDER INTERFACE - GEOMETRY UNVERIFIED",2.3,"bold","middle")
    s.balloon(166,48,"B29",154,52); s.balloon(166,77,"B36",92,70); s.balloon(166,102,"B45",139,90); s.balloon(166,116,"B50",139,111)

    s.view_label(205,15,"Rail Pxx / binder Cxx mirrored nets","2:1")
    maps=[("P01","VIN-A","#d9822b"),("P02","VIN-B","#d9822b"),("P03","GND-A","#333"),("P04","GND-B","#333"),
          ("P05","SDA","#2c9c69"),("P06","SCL","#307ac7"),("P07","UID","#7a55a3"),("P08","FAULT_N","#d34887"),
          ("P09","HSGND","#333"),("P10","GMSL+","#0a7891"),("P11","GMSL-","#0a7891"),("P12","HSGND","#333")]
    for i,(p,n,c) in enumerate(maps):
        col=i%4; row=i//4; x=218+col*46; y=36+row*28
        s.rect(x,y,40,21,"med",rx=1,fill="#fff")
        s.text(x+4,y+7,f"{p}/C{i+1:02d}",1.8,"bold",color=c)
        s.text(x+20,y+15,n,2.2,"bold","middle",color=c)
    s.text(295,126,"B27 + B50 FULL CHANNEL: 100 ohm TARGET / TO BE CHARACTERIZED",2.25,"bold","middle")

    s.view_label(12,145,"Video path - no tether to moving carriage","DIAGRAM")
    blocks=[(16,52,"CAMERA\nSKU UNVER"),(78,60,"MAX96717\nCSI -> GMSL2"),(148,42,"B50\nBINDER"),(200,48,"V-DOCK\nB27/B19"),(258,62,"MAX96724\n4-PORT DES"),(330,72,"TACHYON\nCSI1")]
    for x,w,label in blocks:
        s.rect(x,165,w,34,"med",rx=2,fill="#f7f8f9")
        for j,ln in enumerate(label.split("\n")): s.text(x+w/2,179+j*5,ln,2.4,"bold","middle")
    for x1,x2 in [(68,78),(138,148),(190,200),(248,258),(320,330)]: s.line(x1,182,x2,182,"motion")
    s.text(195,208,"RAW MIPI STAYS INSIDE BINDER; 3/6 Gbps GMSL2 CROSSES LOCKED POGO DOCK",2.7,"bold","middle")
    s.text(195,215,"POWER + VIDEO + REVERSE CONTROL CROSS THE CARRIAGE; NOTHING TETHERS IT",2.5,"bold","middle",color="#0a7891")
    s.note_box(12,224,190,"MECHANISM NOTE - CAMERA VIDEO DOCK",[
        "States: free / S1+S2 power-mated / training / link-trained / pinch-safe.",
        "What moves: binder. V-dock and MAX96724 stay on rail/brick. No tether.",
        "Raw MIPI never rides B50, B27, or the continuous strip (EE-23/25 lock)."],"normal")
    s.note_box(215,224,190,"FAILURE / WHY / EE-25",[
        "Partial dock or bent HSD: training timeout; Q1 latches off.",
        "Particle lists IMX519 AF and S5K3P9SX sensors; no orderable SKU drawn.",
        "EE-26 coupons: 2x-thru, B27-only, B50-only, full channel. Not animal-use."],"warn")
    s.write("S07-camera-load.svg")


def sheet08():
    s=Sheet(8,"ELECTRICAL + VIDEO FUNCTIONAL DIAGRAM", "1:1 SYMBOL GRID")
    s.text(12,15,"RAIL POWER / CONTROL / GMSL2 - FUNCTIONAL DIAGRAM, NOT RELEASE SCHEMATIC",4.0,"bold")
    # Power source and protected external rail supply.
    s.rect(15,30,50,24,"med",rx=2,fill="#f5f7f8"); s.text(40,41,"UPSTREAM DC/PD",2.8,"bold","middle"); s.text(40,48,"SOURCE",2.2,"middle")
    s.line(65,42,82,42,"med",color="#d9822b")
    s.rect(82,34,26,16,"med",fill="#fff6d9"); s.text(95,41,"F1",2.8,"bold","middle"); s.text(95,46,"2 A TARGET",1.9,"middle")
    s.line(108,42,126,42,"med",color="#d9822b")
    s.rect(126,30,54,24,"med",fill="#fff"); s.text(153,40,"B44 RAIL EFUSE",2.6,"bold","middle"); s.text(153,47,"LIMIT / FAULT",2.0,"middle")
    s.line(180,42,405,42,"med",color="#d9822b"); s.text(292,38,"P01/P02 GUARDED EXT. 12 V TARGET; MAY REMAIN ENERGIZED",2.15,"bold","middle",color="#d9822b")
    s.line(15,61,405,61,"med",color="#333"); s.text(292,58,"P03/P04 GND",2.3,"bold","middle")
    # Distinct mechanical mate switches; neither is a data/net substitute.
    s.line(153,54,153,72,"thin"); s.circle(153,78,3,"med",fill="#fff")
    s.line(153,78,166,70,"med"); s.circle(171,78,3,"med",fill="#fff")
    s.text(162,66,"S1 / B27",1.8,"bold","middle")
    s.line(190,54,190,72,"thin"); s.circle(190,78,3,"med",fill="#fff")
    s.line(190,78,203,70,"med"); s.circle(208,78,3,"med",fill="#fff")
    s.text(199,66,"S2 / B50",1.8,"bold","middle")
    s.text(190,87,"S1 CARRIAGE + S2 BINDER: BOTH CLOSED TO ENABLE LOCAL Q1",2.05,"bold","middle",color="#b52d2d")

    # Camera binder chain.
    s.rect(18,104,64,60,"heavy",rx=2,fill="#eef1f4")
    s.text(50,116,"B36 CAMERA",3.1,"bold","middle")
    s.text(50,123,"SKU UNVERIFIED",2.2,"middle",color="#b52d2d")
    s.text(50,131,"LOCAL MIPI CSI-2",2.4,"bold","middle")
    s.rect(96,104,67,60,"heavy",rx=2,fill="#fff8e3")
    s.text(129.5,116,"B45 MAX96717",3.0,"bold","middle")
    s.text(129.5,124,"3/6 Gbps GMSL2",2.3,"middle")
    s.text(129.5,132,"187.5 Mbps REV",2.1,"middle")
    s.text(129.5,141,"LOCAL DC/DC",2.2,"bold","middle")
    s.rect(117,56,24,10,"med",fill="#e7f5f6"); s.text(129,62,"B27 RAIL",1.9,"bold","middle")
    s.rect(112,70,34,16,"med",fill="#fff6d9"); s.text(129,77,"B48 Q1",2.2,"bold","middle"); s.text(129,82,"LOCAL BRANCH",1.7,"middle")
    s.rect(117,90,24,10,"med",fill="#fff0f0"); s.text(129,96,"B50 BINDER",1.75,"bold","middle")
    s.line(82,132,96,132,"motion")
    s.line(129,104,129,100,"thin",color="#d9822b"); s.line(129,90,129,86,"thin",color="#d9822b"); s.line(129,70,129,66,"thin",color="#d9822b"); s.line(129,56,129,42,"thin",color="#d9822b"); s.line(138,104,138,61,"thin",color="#333")
    s.text(250,92,"POWER: RAIL Pxx -> B27 -> B48/Q1 -> B50 Cxx -> BINDER; S1/S2 GATE Q1",1.9,"bold","middle")

    # Four point-to-point video docks into quad deserializer.
    for i,y in enumerate([103,119,135,151],start=1):
        s.rect(183,y-5,36,10,"med",rx=1,fill="#e7f5f6")
        s.text(201,y+1,f"V{i} G + - G",1.9,"bold","middle",color="#0a7891")
        s.line(181,132,183,y,"thin",color="#0a7891") if i==1 else None
        s.line(219,y,252,y,"med",color="#0a7891")
    s.rect(166,126,15,12,"med",rx=1,fill="#fff0f0")
    s.text(173.5,131,"B50",1.9,"bold","middle")
    s.text(173.5,136,"UNVER",1.5,"middle",color="#b52d2d")
    s.line(163,132,166,132,"thin",color="#0a7891")
    s.text(201,169,"ONLY ONE DOCK POPULATED BY THIS CARRIAGE",2.0,"bold","middle")
    s.rect(252,96,72,76,"heavy",rx=2,fill="#e9eef1")
    s.text(288,109,"B46 MAX96724",3.1,"bold","middle")
    s.text(288,117,"QUAD GMSL2 DES",2.4,"middle")
    for i,y in enumerate([127,137,147,157],start=1): s.text(261,y,f"IN{i}",2.0,"bold")
    s.text(288,166,"CSI-2 OUT",2.3,"bold","middle")
    s.line(324,134,342,134,"motion")
    s.rect(342,104,62,60,"heavy",rx=2,fill="#e9eef1")
    s.text(373,119,"B42 TACHYON",3.2,"bold","middle")
    s.text(373,128,"DEDICATED CSI",2.2,"middle")
    s.text(373,137,"22p / 0.5 mm",2.2,"middle")
    s.text(373,147,"QWIIC MASTER",2.2,"middle")

    # Low-speed rail control below video path.
    s.rect(52,177,58,39,"med",rx=1,fill="#f7f8f9")
    s.text(81,187,"B49 TCA9548A",2.3,"bold","middle")
    s.text(81,194,"OPTIONAL I2C",2.0,"middle")
    s.text(81,201,"SEGMENT MUX",2.0,"middle")
    s.text(81,208,"0x70 REF",1.9,"middle")
    s.text(18,181,"B42 QWIIC",2.0,"bold")
    s.line(38,184,52,184,"thin",color="#2c9c69"); s.line(38,193,52,193,"thin",color="#307ac7")
    nets=[("P05 SDA","#2c9c69",184),("P06 SCL","#307ac7",193),("P07 UID","#7a55a3",202),("P08 FAULT_N/IRQ","#d34887",211)]
    for lab,c,y in nets:
        s.text(112,y+1,lab,2.2,"bold",color=c); s.line(145,y,404,y,"med",color=c)
    s.line(110,184,145,184,"thin",color="#2c9c69"); s.line(110,193,145,193,"thin",color="#307ac7")
    s.line(38,202,145,202,"thin",color="#7a55a3"); s.line(38,211,145,211,"thin",color="#d34887")
    s.line(165,176,165,216,"center"); s.text(165,174,"B27 / S1",1.8,"bold","middle")
    s.line(220,176,220,216,"center"); s.text(220,174,"B50 / S2",1.8,"bold","middle")
    s.text(211,219,"3.3 V LOGIC / 100 kHz TARGET / EXTERNAL PULL-UPS DNP-TUNE",2.2,"bold","middle")

    s.note_box(12,226,191,"MECHANISM NOTE - EE-24 INTERLOCK",[
        "EE-24 nodes: VIN_RAIL -> F1 -> VIN_FUSED -> P01||P02 VIN_SHARED.",
        "INTERLOCK_OK = S1 NO series S2 NO. Q1_EN never driven by P08.",
        "S1 open: Q1 off, discharge, ISO_EN off, then B27 may lift."],"normal")
    s.note_box(214,226,191,"FAULT POLICY / NOT A RELEASE SCHEMATIC",[
        "KiCad on #24/#25 is circuit authority; this SVG is a review diagram.",
        "S1/S2/Q1/B27/B50 series UNVERIFIED (#23). No MPNs invented.",
        "P08 diagnostic only. GMSL P10/P11 are not MIPI. EE-26: not animal-use."],"warn")
    s.write("S08-electrical.svg")


def sheet09():
    s=Sheet(9,"SERDES / CSI / PARTICLE BRICK", "1:1 / DIAGRAM")
    s.view_label(12,15,"Tachyon + deserializer carrier","1:1")
    s.rect(22,34,85,56,"heavy",rx=2,fill="#e9eef1")
    s.text(64.5,57,"B42 TACHYON",4.5,"bold","middle")
    s.text(64.5,65,f"{VENDOR['tachyon_xyz'][0]:g} x {VENDOR['tachyon_xyz'][1]:g} x {VENDOR['tachyon_xyz'][2]:g} DATASHEET",2.2,"middle")
    s.rect(31,78,22,5,"med",fill="#d3a74b"); s.rect(75,78,22,5,"med",fill="#d3a74b")
    s.text(42,88,"DEDICATED CSI",2.0,"bold","middle"); s.text(86,88,"SHARED DSI/CSI",2.0,"bold","middle")
    s.rect(124,34,66,56,"heavy",rx=2,fill="#fff8e3")
    s.text(157,54,"B46 MAX96724",3.5,"bold","middle")
    s.text(157,62,"4 x GMSL2 IN",2.3,"middle")
    s.text(157,70,"MIPI CSI-2 OUT",2.3,"middle")
    s.line(124,80,107,80,"motion")
    s.text(115,76,"22p 0.5",1.8,"bold","middle")
    s.text(106,105,"DESERIALIZER CARRIER DIMS / TACHYON DRIVER SUPPORT UNVERIFIED",2.2,"bold","middle",color="#b52d2d")

    s.view_label(215,15,"Optional M1 external brick","1:2")
    s.rect(236,28,60.5,110,"heavy",rx=7,fill="#edf1f4")
    s.rect(246,48,40,68,"med",rx=2,fill="#ffffff")
    s.text(266,76,"TACHYON",3.4,"bold","middle")
    s.text(266,84,"+ DES",2.6,"middle")
    s.circle(250,129,6,"med",fill="#fff"); s.circle(282,129,6,"med",fill="#fff")
    s.dim_h(236,296.5,147,138,f"{VENDOR['m1_xyz'][0]:g} DATASHEET")
    s.dim_v(28,138,226,236,f"{VENDOR['m1_xyz'][1]:g} DATASHEET")
    s.text(266,155,f"DEPTH {VENDOR['m1_xyz'][2]:g} DATASHEET",2.2,"bold","middle")
    s.text(266,161,"M20 NOT USED FOR MOVING CSI: NO CAMERA TETHER",2.1,"bold","middle",color="#0a7891")

    s.view_label(320,15,"External mount boundary","1:5")
    front_view(s,334,36,50,100)
    s.rect(389,72,22,60,"heavy",rx=4,fill="#edf1f4")
    s.line(384,87,389,87,"med"); s.line(384,118,389,118,"med")
    s.text(400,95,"M1",3.5,"bold","middle")
    s.text(400,103,"OUTSIDE",2.1,"bold","middle")
    s.text(368,148,"BRICK + SERDES HUB NEVER ENTER WET VOLUME",2.2,"bold","middle",color="#b52d2d")

    s.view_label(12,174,"Four video docks / two Tachyon CSI options","DIAGRAM")
    for i,x in enumerate([18,68,118,168],start=1):
        s.rect(x,191,38,25,"med",rx=2,fill="#e7f5f6"); s.text(x+19,203,f"V{i} GMSL2",2.2,"bold","middle")
    for x in [56,106,156,206]: s.line(x,203,230,203,"thin",color="#0a7891")
    s.rect(230,184,68,40,"heavy",rx=2,fill="#fff8e3"); s.text(264,202,"MAX96724",3,"bold","middle"); s.text(264,210,"AGGREGATE / ROUTE",2.1,"middle")
    s.line(298,196,320,196,"motion"); s.line(298,213,320,213,"motion")
    s.rect(320,181,82,47,"heavy",rx=2,fill="#e9eef1"); s.text(361,195,"DEDICATED CSI",2.5,"bold","middle"); s.text(361,207,"SHARED DSI/CSI",2.5,"bold","middle"); s.text(361,219,"GPIO 68 HIGH",2.2,"bold","middle")

    s.note_box(12,231,190,"VERIFIED THIS RUN (PARTICLE / ADI PAGES)",[
        f"Tachyon {VENDOR['tachyon_xyz'][0]:g}x{VENDOR['tachyon_xyz'][1]:g}x{VENDOR['tachyon_xyz'][2]:g}; CSI 22p / 0.5 mm; 2.5 Gbps/lane.",
        "GPIO 68 HIGH selects CSI on shared DSI/CSI2. No CSI pin table reprinted."],"normal")
    s.note_box(215,231,190,"NOT DRAWN / UNVERIFIED",[
        "No HAT pin numbers. EE-23 transcribed CSI photos stay in the library.",
        "IMX519/S5K3P9SX are listed sensors; orderable module SKU is not selected."],"warn")
    s.write("S09-particle-brick.svg")


def sheet10():
    s=Sheet(10,"HUSBANDRY INTERFERENCE", "1:5 / DETAILS 5:1")
    s.view_label(12,15,"Section through animal volume","1:5")
    s.rect(38,31,86,172,"heavy")
    s.rect(44,37,74,160,"thin",fill="#f9fbfc")
    s.rect(44,37,74,10,"thin",fill="url(#screen)")
    s.rect(44,47,74,52,"keepout")
    s.text(81,70,"MOLT KEEP-OUT",3.4,"bold","middle",color="#b52d2d")
    s.line(81,99,81,181,"thin")
    s.path("M60 130 C75 115 90 145 105 126","med")
    s.rect(47,184,68,9,"med",fill="#e6ecef")
    s.text(81,213,f"FALSE BOTTOM + {TRAY:g} TRAY REF",2.4,"bold","middle")
    # rail outside
    s.rect(31,27,100,4,"med",fill="#dce2e6")
    s.rect(25,25,20,8,"heavy",rx=2,fill="#fff")
    # B20 keep-out: continuous wet-side barrier between rail metal and animal volume
    s.rect(34,31,6,172,"keepout")
    s.text(37,118,"B20",2.6,"bold",rotate=-90,color="#b52d2d")
    s.line(34,31,34,203,"phantom")
    s.text(22,90,"EXTERNAL RAIL",2.2,"bold",rotate=-90)
    s.text(22,150,"NO METAL IN",2.2,"bold",rotate=-90,color="#b52d2d")
    s.dim_v(31,203,10,38,f"{SPAN:g} LOCK")
    # airflow arrows
    s.rect(44,166,5,18,"thin",fill="url(#screen)"); s.rect(113,62,5,18,"thin",fill="url(#screen)")
    s.path("M28 177 C55 177 66 165 72 151","motion"); s.path("M85 90 C100 78 110 71 132 70","motion")
    s.text(51,224,"LOW INTAKE -> HIGH EXHAUST",2.5,"bold")
    s.text(81,232,f"NOMINAL CLEAR {CLEAR_W:g} W x {CLEAR_D:g} D x {CLEAR_H:g} H CALCULATED",2.2,"bold","middle")
    # door swing
    s.view_label(161,15,"Door swing / service envelope","1:5")
    s.rect(180,45,50,100,"heavy")
    s.line(180,45,180,145,"heavy")
    s.path("M180 45 A100 100 0 0 1 280 145","phantom")
    s.line(180,145,276,145,"motion")
    s.text(230,155,"90 deg MIN SERVICE SWING",2.6,"bold","middle")
    s.rect(190,55,30,35,"keepout")
    s.text(205,73,"UPPER",2.3,"bold","middle",color="#b52d2d")
    s.text(205,78,"CLEAR",2.3,"bold","middle",color="#b52d2d")
    # gap detail
    s.view_label(286,15,"Detail J - nymph-proof gap","5:1")
    s.rect(310,42,28,72,"cut")
    s.rect(343,42,28,72,"cut")
    s.rect(337,48,7,60,"plastic")
    s.dim_h(338,343,125,108,"<=0.50 TARGET")
    s.text(340,137,"LABYRINTH + COMPRESSIBLE WIPER",2.5,"bold","middle")
    s.text(340,145,f"SCREEN APERTURE <={SCREEN_APERTURE:g} LOCK",2.5,"bold","middle")
    s.note_box(161,179,116,"B20 KEEP-OUT (CAD-01)",[
        f"Barrier bbox {CAD01['b20_bbox'][0]:g}..{CAD01['b20_bbox'][3]:g} X,",
        f"{CAD01['b20_bbox'][1]:g}..{CAD01['b20_bbox'][4]:g} Y, 0..500 Z REF.",
        "Fused across front+left joints/splices/door.",
        "Not a film over contacts.",
        f"Molt keep-out {CAD01['molt']:g} CALCULATED."],"warn")
    s.note_box(289,179,116,"WET-VOLUME RULE",[
        "No metal mesh / copper / pogo.",
        "PETG or ASA wet parts.",
        f"Nymph gap <={CAD01['nymph_gap']:.2f} TARGET.",
        "Solo animal. No taxon inferred.",
        "Heat-mat pass only; no mains."],"warn")
    s.write("S10-husbandry.svg")


def sheet11():
    s=Sheet(11,"DETAIL BLOW-UPS", "5:1 / 10:1")
    details=[
        (12,14,"K - POGO BORE / TRAVEL","5:1"),
        (145,14,"L - STRIP WIPE","10:1"),
        (278,14,"M - PINCH SPRING POCKET","5:1"),
        (12,125,"N - INTERNAL CSI / SERDES RELIEF","5:1"),
        (145,125,"P - MAGNET POCKET","5:1"),
        (278,125,"Q - 250/500 JOINT","5:1")]
    for x,y,name,sc in details:
        s.rect(x,y,120,98,"med",rx=1.5,fill="#ffffff")
        s.text(x+4,y+8,name,2.8,"bold")
        s.text(x+116,y+8,"NTS - DO NOT SCALE",2.1,"bold","end")
    # K
    s.rect(38,38,30,52,"cut"); s.rect(48,43,10,30,"metal"); s.circle(53,79,6,"metal"); s.line(53,85,53,95,"med")
    s.dim_h(48,58,101,90,"BORE +0.20 TARGET")
    s.text(75,48,f"{POGO_COMPRESSION:.2f} WORK / {POGO_LIFT:.2f} LIFT TARGET",2.05,"bold"); s.text(75,56,f"THROW {CAD02['throw']:g} / NEED {CLEARANCE_LIFT:g}",2.2); s.text(75,64,"POGO SERIES UNVERIFIED #23",2.2,"bold",color="#b52d2d")
    # L
    s.rect(160,72,92,8,"metal"); s.path("M170 45 Q182 35 194 45 L194 68","med"); s.circle(194,71,3,"metal")
    s.line(194,71,224,71,"motion"); s.path("M194 68 C204 62 214 62 224 68","phantom")
    s.text(206,90,"P01-P08 WIPE 0.8 TARGET",2.4,"bold","middle"); s.text(206,98,"P09-P12 VERTICAL SEAT; NO WIPE",2.2,"bold","middle")
    # M
    s.rect(303,36,44,58,"cut"); s.path("M316 40 C304 50 328 59 316 68 C304 78 328 86 316 94","med"); s.line(340,40,340,92,"phantom")
    s.text(354,48,"POCKET +0.30",2.3,"bold"); s.text(354,56,"NO SHARP ROOT",2.3); s.text(354,64,"10k CYCLE TARGET",2.3)
    # N
    s.rect(31,149,26,44,"cut"); s.path("M57 170 C72 170 78 182 94 182","med"); s.path("M57 176 C70 176 75 188 94 188","med")
    s.rect(57,164,18,18,"plastic"); s.dim_v(170,188,105,94,f"CSI KO {CAD02['csi_keepout']:g} UNVER")
    s.text(26,205,"CLAMP FPC INSULATION, NEVER CONDUCTORS",2.3,"bold")
    # P
    s.rect(166,148,64,48,"cut"); s.rect(184,160,28,22,"metal",rx=1); s.dim_h(184,212,207,182,"MAGNET SIZE UNVERIFIED")
    s.text(151,215,"CAPTURE LIP; MAGNET DOES NOT DEFINE NYMPH SEAL",2.2,"bold")
    # Q
    s.rect(293,150,36,44,"cut"); s.rect(346,150,36,44,"cut"); s.rect(320,159,35,26,"metal"); s.circle(326,172,3,"heavy",fill="#fff"); s.circle(349,172,3,"heavy",fill="#fff")
    s.dim_h(320,355,207,185,f"{CAD01['b03'][0]:g} CAD-01")
    s.text(338,217,"SHEAR KEY + TWO M3; FACE CASSETTE NOT STRUCTURAL",2.2,"bold","middle")
    s.note_box(12,232,393,"DETAIL RELEASE RULE",[
        "TARGET/REF/UNVERIFIED values need coupon or vendor drawing before STEP release. B20 keep-out on S10 is dimensional from CAD-01 bbox, not a shop measurement.",
        f"First articles: pogo bore, strip wipe, latch pull-off, nymph-gap. Base {BASE_SHA[:12]}. CAD-01 {CAD01_SHA[:12]}. EE-23..26 PRs 37-40 read-only."],"ref")
    s.write("S11-details.svg")


def main():
    for fn in [sheet00,sheet01,sheet02,sheet03,sheet04,sheet05,sheet06,sheet07,sheet08,sheet09,sheet10,sheet11]:
        fn()


if __name__ == "__main__":
    main()
