#!/usr/bin/env python3
"""KiCad sexpr helpers for issue 26 fixture. Pattern follows EE-02/EE-03 emitters.

Lives in the #26 write set. Reads the #23 library; does not rewrite it.
"""

from __future__ import annotations

import re
import uuid
from pathlib import Path

NS = uuid.UUID("26ee0000-0000-4000-8000-000000000026")
LIB = (
    Path(__file__).resolve().parents[2]
    / "libs"
    / "symbols"
    / "mantis-ee.kicad_sym"
)

MARKING = "LAB COUPON — CONCEPT VALIDATION — NOT FOR ANIMAL USE"
SILK_CLASS = "PROTO-FAB DRAFT — UNQUALIFIED — NOT A SHOP RELEASE"


def uid(name: str) -> str:
    return str(uuid.uuid5(NS, name))


def extract_symbol(lib: str, name: str) -> str:
    key = f'(symbol "{name}"'
    start = lib.find(key)
    if start < 0:
        raise SystemExit(f"missing library symbol {name}")
    depth = 0
    for i, ch in enumerate(lib[start:], start):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                body = lib[start : i + 1]
                return body.replace(f'(symbol "{name}"', f'(symbol "mantis-ee:{name}"', 1)
    raise SystemExit(f"unbalanced symbol {name}")


def pin_coords(symbol_body: str) -> dict[str, tuple[float, float]]:
    out: dict[str, tuple[float, float]] = {}
    for m in re.finditer(
        r'\(pin \S+ line \(at ([-\d.]+) ([-\d.]+) \d+\).*?\(number "([^"]+)"',
        symbol_body,
        re.S,
    ):
        out[m.group(3)] = (float(m.group(1)), float(m.group(2)))
    return out


def glabel(net: str, x: float, y: float, rot: int, shape: str, tag: str) -> str:
    return f'''  (global_label "{net}"
    (shape {shape})
    (at {x:.3f} {y:.3f} {rot})
    (fields_autoplaced)
    (effects (font (size 1.27 1.27)) (justify left))
    (uuid "{uid("g:"+tag)}")
  )'''


def noconnect(x: float, y: float, tag: str) -> str:
    return f'  (no_connect (at {x:.3f} {y:.3f}) (uuid "{uid("nc:"+tag)}"))'


def text(body: str, x: float, y: float, tag: str) -> str:
    escaped = body.replace("\\", "\\\\").replace('"', '\\"')
    return f'''  (text "{escaped}"
    (at {x:.3f} {y:.3f} 0)
    (effects (font (size 1.27 1.27)) (justify left top))
    (uuid "{uid("t:"+tag)}")
  )'''


def instance(
    lib_id: str,
    ref: str,
    value: str,
    x: float,
    y: float,
    tag: str,
    pins: dict[str, tuple[float, float]],
    nets: dict[str, str],
    noconnects: list[str] | None = None,
) -> str:
    pin_uuids = "\n".join(
        f'    (pin "{n}" (uuid "{uid("p:"+tag+":"+n)}"))' for n in pins
    )
    blocks = [
        f'''  (symbol (lib_id "{lib_id}") (at {x:.3f} {y:.3f} 0) (unit 1)
    (in_bom no) (on_board yes)
    (uuid "{uid("s:"+tag)}")
    (property "Reference" "{ref}" (at {x:.3f} {y + 12.7:.3f} 0)
      (effects (font (size 1.27 1.27))))
    (property "Value" "{value}" (at {x:.3f} {y - 12.7:.3f} 0)
      (effects (font (size 1.27 1.27))))
    (property "Footprint" "" (at {x:.3f} {y:.3f} 0)
      (effects (font (size 1.27 1.27)) hide))
    (property "Datasheet" "" (at {x:.3f} {y:.3f} 0)
      (effects (font (size 1.27 1.27)) hide))
    (property "MPN" "UNVERIFIED" (at {x:.3f} {y:.3f} 0)
      (effects (font (size 1.27 1.27)) hide))
    (property "Status" "UNVERIFIED" (at {x:.3f} {y:.3f} 0)
      (effects (font (size 1.27 1.27)) hide))
    (property "Variant" "PROTO-FAB" (at {x:.3f} {y:.3f} 0)
      (effects (font (size 1.27 1.27)) hide))
    (property "DNP" "yes" (at {x:.3f} {y:.3f} 0)
      (effects (font (size 1.27 1.27)) hide))
{pin_uuids}
  )'''
    ]
    for number, net in nets.items():
        px, py = pins[number]
        wx, wy = x + px, y + py
        rot = 0 if px < 0 else 180
        shape = "input" if px < 0 else "output"
        if py < -0.1:
            rot, shape = 90, "passive"
        blocks.append(glabel(net, wx, wy, rot, shape, f"{tag}:{number}:{net}"))
    for number in noconnects or []:
        px, py = pins[number]
        blocks.append(noconnect(x + px, y + py, f"{tag}:nc:{number}"))
    return "\n".join(blocks)


def sheet_file(
    title: str,
    page: str,
    lib_symbols: str,
    body: str,
    uuid_name: str,
    comment2: str,
) -> str:
    return f'''(kicad_sch (version 20230121) (generator mantis-ee-26)
  (uuid "{uid(uuid_name)}")
  (paper "A3")
  (title_block
    (title "{title}")
    (date "2026-08-20")
    (rev "B-draft")
    (comment 1 "Issue 26. PROTO-FAB DRAFT / UNQUALIFIED. {MARKING}")
    (comment 2 "{comment2}")
  )
  (lib_symbols
{lib_symbols}
  )
{body}
  (sheet_instances
    (path "/" (page "{page}"))
  )
)
'''


def root_sheet(
    title: str,
    boxes: list[tuple[str, str, str, float, float]],
    note: str,
    child_pages: list[tuple[str, str]],
) -> str:
    parts = []
    for file, name, cuuid, x, y in boxes:
        parts.append(
            f'''  (sheet
    (at {x} {y})
    (size 88.9 38.1)
    (stroke (width 0.1524) (type solid))
    (fill (color 0 0 0 0.0))
    (uuid "{cuuid}")
    (property "Sheetname" "{name}" (at {x} {y - 1.27} 0)
      (effects (font (size 1.27 1.27)) (justify left bottom)))
    (property "Sheetfile" "sheets/{file}.kicad_sch" (at {x} {y + 39.37} 0)
      (effects (font (size 1.27 1.27)) (justify left top)))
  )'''
        )
    inst = ['    (path "/" (page "1"))']
    for cuuid, page in child_pages:
        inst.append(f'    (path "/{cuuid}" (page "{page}"))')
    return f'''(kicad_sch (version 20230121) (generator mantis-ee-26)
  (uuid "{uid("root:"+title)}")
  (paper "A3")
  (title_block
    (title "{title}")
    (date "2026-08-20")
    (rev "B-draft")
    (comment 1 "Issue 26. PROTO-FAB DRAFT / UNQUALIFIED. {MARKING}")
    (comment 2 "Tracks #26 only. Does not implement #18. Does not touch PR 12. Does not rewrite #23/#24/#25.")
  )
{chr(10).join(parts)}
{text(note, 25.4, 175.0, "root-note:"+title)}
  (sheet_instances
{chr(10).join(inst)}
  )
)
'''


def project_file(filename: str, sheets: list[tuple[str, str]]) -> str:
    sheet_lines = ",\n    ".join(f'["{path}", "{u}"]' for path, u in sheets)
    return f'''{{
  "board": {{ "design_settings": {{}} }},
  "meta": {{ "filename": "{filename}", "version": 1 }},
  "sheets": [
    {sheet_lines}
  ],
  "text_variables": {{}},
  "libraries": {{
    "pinned_symbol_libs": ["mantis-ee"],
    "pinned_fp_libs": ["mantis-ee"]
  }}
}}
'''


def lib_tables() -> tuple[str, str]:
    sym = (
        "(sym_lib_table\n"
        '  (lib (name "mantis-ee")(type "KiCad")'
        '(uri "${KIPRJMOD}/../libs/symbols/mantis-ee.kicad_sym")(options "")'
        '(descr "Mantis EE-01 UNVERIFIED envelopes (read-only consume)"))\n)\n'
    )
    fp = (
        "(fp_lib_table\n"
        '  (lib (name "mantis-ee")(type "KiCad")'
        '(uri "${KIPRJMOD}/../libs/footprints/mantis-ee.pretty")(options "")'
        '(descr "Mantis EE-01 UNVERIFIED envelopes (read-only consume)"))\n)\n'
    )
    return sym, fp


B50_PADS = {f"C{i:02d}": (-13.97 + (i - 1) * 2.54, 0.0) for i in range(1, 13)}
B27_PADS = {f"P{i:02d}": (-13.97 + (i - 1) * 2.54, 0.0) for i in range(1, 13)}
B19_PADS = {f"P{i:02d}": (-13.97 + (i - 1) * 2.54, 0.0) for i in range(1, 13)}
S1_PADS = {"1": (-1.27, 0.0), "2": (1.27, 0.0)}
Q1_PADS = {"1": (-2.54, 0.0), "2": (-0.85, 0.0), "3": (0.85, 0.0), "4": (2.54, 0.0)}
TP_PADS = {"1": (0.0, 0.0)}
R2_PADS = {"1": (-1.27, 0.0), "2": (1.27, 0.0)}
JMP_PADS = {"1": (-1.27, 0.0), "2": (1.27, 0.0)}


def _pad(num: str, x: float, y: float, w: float, h: float, net_id: int, net: str) -> str:
    return (
        f'    (pad "{num}" smd rect (at {x:.3f} {y:.3f}) (size {w} {h}) '
        f'(layers "F.Cu" "F.Mask") (net {net_id} "{net}"))'
    )


def footprint(
    lib_fp: str,
    ref: str,
    x: float,
    y: float,
    tag: str,
    pads: dict[str, tuple[float, float]],
    pad_nets: dict[str, str],
    net_ids: dict[str, int],
    size: tuple[float, float] = (1.5, 3.0),
    note: str = "",
) -> str:
    pad_s = "\n".join(
        _pad(n, px, py, size[0], size[1], net_ids[pad_nets[n]], pad_nets[n])
        for n, (px, py) in pads.items()
        if n in pad_nets
    )
    extra = ""
    if note:
        extra = (
            f'    (fp_text user "{note}" (at 0 6) (layer "F.Fab")'
            f" (effects (font (size 0.8 0.8))))\n"
        )
    return f'''  (footprint "{lib_fp}"
    (layer "F.Cu")
    (tstamp {uid("fp:"+tag)})
    (at {x:.3f} {y:.3f})
    (fp_text reference "{ref}" (at 0 -5) (layer "F.SilkS")
      (effects (font (size 1 1))))
    (fp_text value "{lib_fp.split(":")[-1]}" (at 0 5) (layer "F.Fab")
      (effects (font (size 1 1))))
{extra}{pad_s}
  )'''


def courtyard_only(lib_fp: str, ref: str, x: float, y: float, tag: str) -> str:
    return f'''  (footprint "{lib_fp}"
    (layer "F.Cu")
    (tstamp {uid("fp:"+tag)})
    (at {x:.3f} {y:.3f})
    (fp_text reference "{ref}" (at 0 -5) (layer "F.SilkS")
      (effects (font (size 1 1))))
    (fp_text value "{lib_fp.split(":")[-1]}" (at 0 5) (layer "F.Fab")
      (effects (font (size 1 1))))
    (fp_text user "NO-PAD-MAP UNVERIFIED REFPLANE" (at 0 0) (layer "F.Fab")
      (effects (font (size 0.7 0.7))))
    (fp_rect (start -3 -3) (end 3 3)
      (stroke (width 0.05) (type default)) (fill (type none)) (layer "F.CrtYd"))
  )'''


def track(x1: float, y1: float, x2: float, y2: float, net_id: int, tag: str, width: float = 0.2) -> str:
    return (
        f'  (segment (start {x1:.3f} {y1:.3f}) (end {x2:.3f} {y2:.3f}) '
        f'(width {width}) (layer "F.Cu") (net {net_id}) (tstamp {uid("tr:"+tag)}))'
    )


def pcb_file(
    title: str,
    nets: list[str],
    footprints: str,
    tracks: str,
    extras: str,
    width_mm: float = 240.0,
    height_mm: float = 150.0,
) -> str:
    net_lines = "\n".join(f'  (net {i} "{n}")' for i, n in enumerate([""] + nets))
    return f'''(kicad_pcb (version 20221018) (generator mantis-ee-26)
  (general (thickness 1.6))
  (paper "A3")
  (title_block
    (title "{title}")
    (date "2026-08-20")
    (rev "B-draft")
    (comment 1 "Issue 26. {MARKING}")
    (comment 2 "{SILK_CLASS}. Outline TARGET. Stackup UNVERIFIED. Do not fabricate.")
  )
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
    (36 "B.SilkS" user)
    (37 "F.SilkS" user)
    (38 "B.Mask" user)
    (39 "F.Mask" user)
    (44 "Edge.Cuts" user)
    (45 "Margin" user)
    (49 "F.Fab" user)
  )
{net_lines}
  (gr_rect (start 0 0) (end {width_mm} {height_mm})
    (stroke (width 0.15) (type default)) (fill (type none)) (layer "Edge.Cuts"))
  (gr_text "{MARKING}"
    (at {width_mm / 2:.1f} 4.0 0) (layer "F.SilkS")
    (effects (font (size 1.4 1.4))))
  (gr_text "{SILK_CLASS}"
    (at {width_mm / 2:.1f} 8.0 0) (layer "F.SilkS")
    (effects (font (size 1.2 1.2))))
  (gr_text "{MARKING}"
    (at {width_mm / 2:.1f} {height_mm - 4:.1f} 0) (layer "F.SilkS")
    (effects (font (size 1.2 1.2))))
  (gr_text "{SILK_CLASS}"
    (at {width_mm / 2:.1f} {height_mm - 8:.1f} 0) (layer "B.SilkS")
    (effects (font (size 1.2 1.2))))
  (gr_text "{MARKING}"
    (at {width_mm / 2:.1f} {height_mm / 2:.1f} 0) (layer "F.Fab")
    (effects (font (size 1.6 1.6))))
{extras}
{footprints}
{tracks}
)
'''


def generic_two_pin(name: str, ref: str, descr: str) -> str:
    return f'''  (symbol "fx-generic:{name}"
    (pin_names (offset 0.254) hide)
    (pin_numbers hide)
    (in_bom no)
    (on_board yes)
    (property "Reference" "{ref}" (at 2.54 0 0) (effects (font (size 1.27 1.27))))
    (property "Value" "{name}" (at 0 -5.08 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "Datasheet" "" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "Description" "{descr}" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "MPN" "UNVERIFIED" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "Status" "UNVERIFIED" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "DNP" "yes" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (symbol "{name}_0_1"
      (rectangle (start -1.016 2.54) (end 1.016 -2.54)
        (stroke (width 0.254) (type default)) (fill (type none)))
      (pin passive line (at 0 3.81 270) (length 1.27)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin passive line (at 0 -3.81 90) (length 1.27)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))
    )
  )'''


def generic_tp() -> str:
    return '''  (symbol "fx-generic:TP_UNVERIFIED"
    (pin_names hide)
    (pin_numbers hide)
    (in_bom no)
    (on_board yes)
    (property "Reference" "TP" (at 0 3.81 0) (effects (font (size 1.27 1.27))))
    (property "Value" "TP_UNVERIFIED" (at 0 -3.81 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "Datasheet" "" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "MPN" "UNVERIFIED" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "Status" "UNVERIFIED" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "DNP" "yes" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (symbol "TP_UNVERIFIED_0_1"
      (circle (center 0 0) (radius 0.762)
        (stroke (width 0.254) (type default)) (fill (type none)))
      (pin passive line (at 0 -2.54 90) (length 1.778)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
    )
  )'''


GENERIC_PINS_2 = {"1": (0.0, 3.81), "2": (0.0, -3.81)}
GENERIC_PINS_TP = {"1": (0.0, -2.54)}
