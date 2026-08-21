#!/usr/bin/env python3
"""Generate the theoretical mantis-terrarium schematic set as A3 SVG sheets.

The drawings deliberately separate locked dimensions from provisional geometry.
All provisional values carry REF/TARGET/UNVERIFIED labels on-sheet.
"""

from __future__ import annotations

import html
import math
from pathlib import Path

from sync_contracts import load_contracts, sync_scad


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "schematics"
OUT.mkdir(parents=True, exist_ok=True)

W, H = 420.0, 297.0
DRAW_BOTTOM = 257.0
DATE = "2026-08-20"
REV = "B-DRAFT"

sync_scad()
CONTRACT = load_contracts()
PARAM = CONTRACT["parameters"]
BUS_CONTACTS = CONTRACT["contacts"]
FRAME_BAND = PARAM["frame_w"]
MODULE_PITCH = PARAM["pitch_mm"]
SPAN = PARAM["span_mm"]
CONTACT_PITCH = PARAM["pogo_pitch"]
RAIL_WIDTH = PARAM["rail_w"]
RAIL_HEIGHT = PARAM["rail_h"]
POGO_COMPRESSION = PARAM["pogo_compression"]
POGO_LIFT = PARAM["pogo_lift_min"]
PINCH_FORCE_MIN = PARAM["pinch_force_min"]
PINCH_FORCE_MAX = PARAM["pinch_force_max"]
BINDER_PULL_OFF = PARAM["binder_pull_off_min"]
SCREEN_APERTURE = PARAM["screen_aperture_max"]


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
            (273, y+15, "SHEET", f"{self.num+1:02d} OF 12 / S{self.num:02d}"), (337, y+15, "STATUS", "CONCEPT LOCK"), (379, y+15, "DRAWN", "MANTIS LAB"),
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
    s.text(210,210,"85 x 56 PCB",2.3,"middle")
    # keepout
    s.rect(60,78,76,116,"keepout",rx=2)
    s.text(98,132,"ANIMAL VOLUME",4,"bold","middle",color="#b52d2d")
    s.text(98,138,"NO METAL / COPPER / POGOS",2.4,"bold","middle",color="#b52d2d")
    s.note_box(260,38,145,"SYSTEM THEORY",[
        f"{MODULE_PITCH:g} mm block perimeter; {SPAN:g} mm first tower.",
        "External rail carries fused VIN + I2C + ID.",
        "Pinch lifts contacts before the carriage rolls.",
        "One latch receives camera, sensor, LED, or mist binders.",
        "Camera binder serializes CSI; GMSL2 video crosses locked pogo docks.",
        "The M1 is a compute brick, never the animal cage."])
    s.note_box(260,91,145,"LOCKED SAFETY BOUNDARY",[
        "Upper third remains free for hang-molt clearance.",
        "Ceiling and vents use <=0.8 mm non-metal screen.",
        "B20 separates the guarded rail channel from the wet volume.",
        "Door opens front/side; all gaps receive nymph check.",
        "No taxonomy inferred: no live-mantis photo supplied."],"warn")
    s.note_box(260,138,145,"DRAWING STATUS",[
        "Pitch / span / bus topology are source locks.",
        "Named vendor capabilities are checked against primary docs.",
        "Custom rail dimensions are REF/TARGET until tested.",
        "Pogo series, strip stack and latch force UNVERIFIED.",
        "Fabricate coupons before a live-animal first article."],"ref")
    s.scale_bar(268,222,100,5)
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
        "Exterior: 250 W x 250 D x 500 H.",
        "Module datum repeats at 250 mm.",
        "Nominal clear: 202 x 202 x 427 REF.",
        "Frame face dimensions REF pending first article.",
        "Interior must still satisfy >=240 mm height."],"ref")
    s.note_box(151,166,115,"PROJECTION",[
        "Third-angle arrangement shown.",
        "Front is the door/view cassette face.",
        "Top rail sits entirely outside enclosure.",
        "Hidden wet-side barrier is continuous."],"normal")
    s.note_box(284,166,115,"INTERFACE DATUMS",[
        "A: exterior block face.",
        "B: cassette seat plane.",
        "C: rail conductor centerline.",
        "D: false-bottom tray surface."],"normal")
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
        "Rail, carriage, binder and compute brick are removable externally.",
        "No service operation opens a path from rail metal into wet volume."],"normal")
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
    s.text(55,99,"CASSETTE POCKET 3.20 REF",2.5,"bold","middle")
    s.dim_h(30,80,110,90,f"{FRAME_BAND:g} REF")
    s.dim_v(40,90,20,30,f"{FRAME_BAND:g} REF")
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
    s.dim_h(88,132,195,176,"22 REF COUPLER")
    s.text(110,207,"M3 HEAT-SET + CROSS DOWEL; SHEAR CARRIED BY TONGUE",2.6,"bold","middle")
    s.balloon(205,158,"B03",132,160)
    # cassette section
    s.view_label(235,130,"Detail B - cassette seat","2:1")
    s.rect(252,147,18,58,"cut")
    s.rect(270,158,6,36,"metal")
    s.rect(276,155,11,42,"plastic")
    s.line(283,155,283,197,"hidden")
    s.dim_h(270,276,213,194,"3.20 REF")
    s.text(292,162,"3.00 PANEL",2.5,"bold")
    s.text(292,168,"0.20 TARGET CLEARANCE",2.5)
    s.text(292,176,"TPU GASKET 1.0 REF",2.5)
    s.text(292,184,"NYMPH GAP <=0.50 TARGET",2.5,"bold",color="#b52d2d")
    s.note_box(14,222,180,"MECHANICAL STATUS",[
        "Block cross-sections are REF: no commercial-frame photo supplied.",
        "Coupon the cassette pocket at 3.10 / 3.20 / 3.30 before release."],"ref")
    s.note_box(214,222,190,"LOAD PATH",[
        "Panel pressure -> gasket -> pocket wall -> perimeter block.",
        "500 span bending crosses the internal coupler, not the face cassette.",
        "V1 rail corners are electrical junctions; carriage does not roll around 90 deg.",
        "B51 positively retains each route; removal needs deliberate M3 service."],"normal")
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
    s.dim_h(30,98,104,73,f"{RAIL_WIDTH:g} REF")
    s.dim_v(40,73,20,30,f"{RAIL_HEIGHT:g} REF")
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
    s.text(250,112,"25 mm MECH DETENTS; VIDEO ONLY AT V1-V4 POINT-TO-POINT DOCKS",2.4,"bold","middle")
    # stackup detail
    s.view_label(12,126,"Detail D - strip stack-up","5:1")
    s.text(30,146,"EXPOSED ENIG LAND IN CAPTIVE EXTERNAL SLOT - NO FILM OVER CONTACT",2.05,"bold",color="#b52d2d")
    layers=[("ENIG CONTACT LAND",2,"#e6b84a"),("FLEX / SPRING COPPER",5,"#d77c3d"),("DIELECTRIC",7,"#d7e4f0"),("PETG / ASA FRAME",18,"#f4f5f6")]
    yy=151
    for name,hh,fc in layers:
        s.rect(30,yy,120,hh,"med",fill=fc)
        s.text(156,yy+hh/2+1,name,2.4,"bold")
        yy+=hh
    s.text(30,190,"ALL THICKNESSES UNVERIFIED UNTIL STRIP VENDOR SELECTED",2.5,"bold",color="#b52d2d")
    # conductor pitch detail
    s.view_label(230,126,"Detail E - contact lands","5:1")
    for i,c in enumerate(colors):
        s.rect(239+i*12,150,7,28,"med",fill=c)
        s.text(242.5+i*12,185,f"P{i+1:02d}",1.9,"bold","middle",color=c)
    for i,(lab,c) in enumerate([("G","#333"),("HSD+","#0a7891"),("HSD-","#0a7891"),("G","#333")]):
        s.rect(342+i*13,150,9,28,"med",fill=c)
        s.text(346.5+i*13,185,lab,1.8,"bold","middle",color=c)
    s.dim_h(245,263,197,178,f"{CONTACT_PITCH:g} PITCH TARGET")
    s.text(239,205,"P01-P08 CONTINUOUS; P09-P12 GUARDED GMSL2 DOCK CELL",2.4,"bold")
    s.note_box(12,218,190,"POWER / SIGNAL",[
        "VIN: 12 V nominal TARGET from separate DC/DC; fuse F1 = 2 A TARGET.",
        "P01-P08: power/control. P09-P12: 100 ohm TARGET GMSL2 cell.",
        "Video contact exists only at V1-V4; no signal is carried while rolling.",
        "B20 is the continuous wet-side barrier; contact lands stay external."],"ref")
    s.note_box(215,218,190,"FAILURE CONTROL",[
        "S1 pre-travel opens the local carriage Q1 branch before pogo lift.",
        "Bent HSD pogo -> link loss; no fallback to raw MIPI or continuous strip.",
        "Each V-dock routes point-to-point to a separate deserializer input.",
        "B52 guard/wiper shields the access slot; it is not a hermetic cover."],"warn")
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
    s.text(66,84,"CLAMP CLOSED / POGOS AT WORKING TRAVEL",2.6,"bold","middle")
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
    s.text(202,90,f"PINCH -> LIFT >={POGO_LIFT:g} TARGET -> ROLL",2.6,"bold","middle")
    # sequence
    s.view_label(270,15,"Kinematic sequence","1:1 diagram")
    states=[("1 SAFE","S1 opens; Q1 off"),("2 LIFT","12 contacts clear"),("3 ROLL","rollers carry load"),("4 LOCK","seat then train")]
    for i,(a,b) in enumerate(states):
        x=276+(i%2)*62; y=34+(i//2)*42
        s.rect(x,y,54,30,"med",rx=2,fill="#f8f9fa")
        s.text(x+27,y+10,a,3,"bold","middle")
        s.text(x+27,y+18,b,2.2,"middle")
    s.line(330,49,337,49,"motion"); s.line(365,65,365,73,"motion"); s.line(337,91,330,91,"motion")
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
    s.text(97,146,"SPRING: SELECT AFTER FORCE TEST",2.5,"bold")
    s.text(97,154,f"PINCH FORCE {PINCH_FORCE_MIN:g}-{PINCH_FORCE_MAX:g} N TARGET",2.5)
    s.text(97,162,"12-CONTACT ARRAY; HSD CELL SI UNVERIFIED",2.5,"bold",color="#b52d2d")
    s.text(97,170,"ROLLER AXLE: M3 REF",2.5)
    s.text(97,178,"DOVETAIL CLEARANCE 0.25/side TARGET",2.5)
    s.note_box(230,121,175,"MECHANISM NOTE - PINCH-LIFT / ROLL",[
        "States: locked / pinched. Housing and load move; rail is grounded.",
        "Local S1 opens Q1 and isolates signals before cam lifts contacts.",
        "Cam lift must exceed pogo overtravel before rollers translate.",
        "Bent HSD pogo: bounded training times out; local Q1 latches off.",
        "Release seats clamp and binder, then a bounded link-training window.",
        "Chosen over screws for one-hand relocation without opening cage."],"normal")
    s.note_box(230,179,175,"ACCEPTANCE TARGETS",[
        "Clamp slip: <0.5 mm under 0.5 N-m binder moment.",
        "Release cycles: 10,000 TARGET; contact resistance vendor-dependent.",
        "B51 must retain a loaded carriage under the defined handling/drop test.",
        "No conductive part may breach the wet-side barrier."],"ref")
    s.write("S05-carriage-mech.svg")


def sheet06():
    s=Sheet(6,"UNIVERSAL LATCH + BINDER", "2:1 / DETAIL 5:1")
    s.view_label(12,15,"Universal shoe - free","2:1")
    s.rect(28,38,80,50,"heavy",rx=4,fill="#f5f7f8")
    s.path("M45 42 L55 52 L82 52 L92 42","med")
    s.path("M52 78 L62 68 L75 68 L85 78","med")
    s.rect(58,57,22,7,"metal",rx=1)
    s.text(68,96,"FIXED SHOE ON CARRIAGE",2.7,"bold","middle")
    s.balloon(118,45,"B28",92,47)
    s.view_label(145,15,"Binder - mating","2:1")
    s.rect(162,31,62,65,"heavy",rx=5,fill="#eef1f4")
    s.path("M174 78 L184 68 L202 68 L212 78","heavy")
    s.path("M180 61 L190 54 L206 61","med")
    s.line(193,109,193,87,"motion")
    s.text(193,116,"BIND: DOWN 12 REF",2.7,"bold","middle")
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
    s.text(334,205,"22-PIN 0.5 mm FPC STAYS LOCAL; Rmin 10 TARGET",2.4,"bold","middle")
    s.text(334,211,"B50 C01-C12 HANDOFF; P01-P12 NAME RAIL INTERFACE ONLY",2.05,"bold","middle")
    s.balloon(387,153,"B50",357,164)
    s.note_box(12,215,190,"MECHANISM NOTE - BIND-LATCH",[
        "States: pinch-safe / free / mated. Binder moves; shoe stays on carriage.",
        "Tongue snaps behind shoulder; S2 confirms full electrical seating.",
        "Release is mechanically blocked unless carriage is PINCH-SAFE.",
        "Chosen over a screw for tool-free swap without disturbing rail position."],"normal")
    s.note_box(215,215,190,"FAILURE / CLEARANCE",[
        "Partial click: S2 stays open and local Q1 must remain off.",
        "B50 series, mate order, SI launch and hot-unplug timing are UNVERIFIED.",
        "Internal camera-to-serializer FPC never carries binder moment."],"warn")
    s.write("S06-latch-binder.svg")


def sheet07():
    s=Sheet(7,"CAMERA LOAD / SERDES BINDER", "2:1 / PCB 1:1")
    s.view_label(12,15,"Camera binder assembly","2:1")
    s.rect(28,32,126,84,"heavy",rx=6,fill="#eef1f4")
    s.rect(42,48,50,48,"med",fill="#d8e2e7")
    s.circle(67,72,13,"heavy",fill="#eef3f5")
    s.text(67,102,"B36 IMX519 MODULE",2.3,"bold","middle")
    s.text(67,107,"OUTLINE 25 x 24 REF - VERIFY SKU",2.0,"middle",color="#b52d2d")
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
    blocks=[(16,52,"IMX519\nSKU TBD"),(78,60,"MAX96717\nCSI -> GMSL2"),(148,42,"B50\nBINDER"),(200,48,"V-DOCK\nB27/B19"),(258,62,"MAX96724\n4-PORT DES"),(330,72,"TACHYON\nCSI")]
    for x,w,label in blocks:
        s.rect(x,165,w,34,"med",rx=2,fill="#f7f8f9")
        for j,ln in enumerate(label.split("\n")): s.text(x+w/2,179+j*5,ln,2.4,"bold","middle")
    for x1,x2 in [(68,78),(138,148),(190,200),(248,258),(320,330)]: s.line(x1,182,x2,182,"motion")
    s.text(195,208,"RAW MIPI STAYS INSIDE BINDER; 3/6 Gbps GMSL2 CROSSES LOCKED POGO DOCK",2.7,"bold","middle")
    s.text(195,215,"POWER + VIDEO + REVERSE CONTROL CROSS THE CARRIAGE; NOTHING TETHERS IT",2.5,"bold","middle",color="#0a7891")
    s.note_box(12,224,190,"MECHANISM NOTE - CAMERA VIDEO DOCK",[
        "States: free / S1+S2 power-mated / training / link-trained / pinch-safe.",
        "Binder moves; V-dock and deserializer are fixed to the rail/brick.",
        "S1 or S2 opening mutes link and turns local Q1 off before contact motion."],"normal")
    s.note_box(215,224,190,"FAILURE / WHY",[
        "Partial dock or bent HSD pin -> bounded training timeout; Q1 latches off.",
        "Chosen over a CSI tether so the carriage remains genuinely repositionable.",
        "Coupon and eye/BER tests must include both B27 and B50 interfaces."],"warn")
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
    s.text(50,116,"B36 IMX519",3.1,"bold","middle")
    s.text(50,123,"MODULE SKU TBD",2.2,"middle",color="#b52d2d")
    s.text(50,131,"MIPI CSI-2",2.4,"bold","middle")
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

    s.note_box(12,226,191,"MECHANISM NOTE - PROTECTED VIDEO MATE",[
        "States: absent / seated / training / trained / fault / pinch-safe / lifted.",
        "S1 or S2 opens first; local Q1 turns off and discharges before motion.",
        "Release seats B27+B50 before a bounded, current-limited training window."],"normal")
    s.note_box(214,226,191,"FAULT POLICY",[
        "Bent HSD pin or station skew -> no lock; training times out and Q1 latches off.",
        "UID identifies load, while V1-V4 deserializer port identifies position.",
        "P08 is diagnostic only. B27+B50 eye/BER, ESD and timing remain gates."],"warn")
    s.write("S08-electrical.svg")


def sheet09():
    s=Sheet(9,"SERDES / CSI / PARTICLE BRICK", "1:1 / DIAGRAM")
    s.view_label(12,15,"Tachyon + deserializer carrier","1:1")
    s.rect(22,34,85,56,"heavy",rx=2,fill="#e9eef1")
    s.text(64.5,57,"B42 TACHYON",4.5,"bold","middle")
    s.text(64.5,65,"85 x 56 x 18.5 VERIFIED",2.3,"middle")
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
    s.dim_h(236,296.5,147,138,"121 VERIFIED")
    s.dim_v(28,138,226,236,"220 VERIFIED")
    s.text(266,155,"DEPTH 69 VERIFIED",2.2,"bold","middle")
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

    s.note_box(12,231,190,"VERIFIED INTERFACES",[
        "Tachyon: dual 4-lane CSI, 22-pin 0.5 mm, up to 2.5 Gbps/lane.",
        "MAX96724: four GMSL2 inputs and CSI-2 outputs; 3/6 Gbps links."],"normal")
    s.note_box(215,231,190,"INTEGRATION GATE",[
        "Particle does not document MAX96724 support: kernel/DT work is required.",
        "No HAT/CSI pin number is inferred; use Particle and ADI reference CAD."],"warn")
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
    s.text(81,213,"FALSE BOTTOM + 20-30 TRAY",2.4,"bold","middle")
    # rail outside
    s.rect(31,27,100,4,"med",fill="#dce2e6")
    s.rect(25,25,20,8,"heavy",rx=2,fill="#fff")
    s.line(34,31,34,203,"phantom")
    s.text(24,118,"EXTERNAL RAIL",2.4,"bold",rotate=-90)
    s.dim_v(31,203,16,38,f"{SPAN:g} LOCK")
    # airflow arrows
    s.rect(44,166,5,18,"thin",fill="url(#screen)"); s.rect(113,62,5,18,"thin",fill="url(#screen)")
    s.path("M28 177 C55 177 66 165 72 151","motion"); s.path("M85 90 C100 78 110 71 132 70","motion")
    s.text(51,224,"LOW INTAKE -> HIGH EXHAUST",2.5,"bold")
    s.text(81,232,"NOMINAL CLEAR 202 W x 202 D x 427 H REF",2.3,"bold","middle")
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
    s.note_box(161,179,116,"ANIMAL CHECK",[
        "Solo animal only.",
        "No taxon inferred: no photo.",
        "Default adult envelope: 80 mm.",
        "Interior height must be >=240 mm.",
        "Ceiling must be textured screen."],"normal")
    s.note_box(289,179,116,"WET-VOLUME RULE",[
        "No metal mesh.",
        "No copper / strip / pogo.",
        "PETG or ASA wet parts.",
        "Every gland and seam checked.",
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
    s.text(75,48,f"{POGO_COMPRESSION:.2f} WORK COMPRESSION TARGET",2.15,"bold"); s.text(75,56,"OVERTRAVEL UNVERIFIED",2.3); s.text(75,64,"SELECT POGO SERIES",2.3,"bold",color="#b52d2d")
    # L
    s.rect(160,72,92,8,"metal"); s.path("M170 45 Q182 35 194 45 L194 68","med"); s.circle(194,71,3,"metal")
    s.line(194,71,224,71,"motion"); s.path("M194 68 C204 62 214 62 224 68","phantom")
    s.text(206,90,"P01-P08 WIPE 0.8 TARGET",2.4,"bold","middle"); s.text(206,98,"P09-P12 VERTICAL SEAT; NO WIPE",2.2,"bold","middle")
    # M
    s.rect(303,36,44,58,"cut"); s.path("M316 40 C304 50 328 59 316 68 C304 78 328 86 316 94","med"); s.line(340,40,340,92,"phantom")
    s.text(354,48,"POCKET +0.30",2.3,"bold"); s.text(354,56,"NO SHARP ROOT",2.3); s.text(354,64,"10k CYCLE TARGET",2.3)
    # N
    s.rect(31,149,26,44,"cut"); s.path("M57 170 C72 170 78 182 94 182","med"); s.path("M57 176 C70 176 75 188 94 188","med")
    s.rect(57,164,18,18,"plastic"); s.dim_v(170,188,105,94,"Rmin 10 TARGET")
    s.text(26,205,"CLAMP FPC INSULATION, NEVER CONDUCTORS",2.3,"bold")
    # P
    s.rect(166,148,64,48,"cut"); s.rect(184,160,28,22,"metal",rx=1); s.dim_h(184,212,207,182,"MAGNET SIZE UNVERIFIED")
    s.text(151,215,"CAPTURE LIP; MAGNET DOES NOT DEFINE NYMPH SEAL",2.2,"bold")
    # Q
    s.rect(293,150,36,44,"cut"); s.rect(346,150,36,44,"cut"); s.rect(320,159,35,26,"metal"); s.circle(326,172,3,"heavy",fill="#fff"); s.circle(349,172,3,"heavy",fill="#fff")
    s.dim_h(320,355,207,185,"22 REF")
    s.text(338,217,"SHEAR KEY + TWO M3; FACE CASSETTE NOT STRUCTURAL",2.2,"bold","middle")
    s.note_box(12,232,393,"DETAIL RELEASE RULE",[
        "Every value marked TARGET/REF/UNVERIFIED requires coupon or vendor-drawing closure before STEP release.",
        "Critical first articles: pogo bore coupon, strip wipe coupon, latch pull-off coupon, nymph-gap feeler check."],"ref")
    s.write("S11-details.svg")


def main():
    for fn in [sheet00,sheet01,sheet02,sheet03,sheet04,sheet05,sheet06,sheet07,sheet08,sheet09,sheet10,sheet11]:
        fn()


if __name__ == "__main__":
    main()
