#!/usr/bin/env python3
"""Emit the issue-24 power-control KiCad project from the #23 library envelopes.

Reads terrarium/ee/kicad/libs (does not rewrite it). UNVERIFIED actuators stay
envelopes. No MPNs are invented.
"""

from __future__ import annotations

import re
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
LIB = HERE.parent / "libs" / "symbols" / "mantis-ee.kicad_sym"
SHEETS = HERE / "sheets"
NS = uuid.UUID("24ee0000-0000-4000-8000-000000000024")


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
    out = {}
    for m in re.finditer(
        r'\(pin \S+ line \(at ([-\d.]+) ([-\d.]+) \d+\).*?\(number "([^"]+)"',
        symbol_body,
        re.S,
    ):
        out[m.group(3)] = (float(m.group(1)), float(m.group(2)))
    return out


def generic_two_pin(name: str, ref: str, descr: str) -> str:
    return f'''  (symbol "pc-generic:{name}"
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


def generic_sw3(name: str, descr: str) -> str:
    return f'''  (symbol "pc-generic:{name}"
    (pin_names (offset 1.016))
    (in_bom no)
    (on_board yes)
    (property "Reference" "K" (at 0 6.35 0) (effects (font (size 1.27 1.27))))
    (property "Value" "{name}" (at 0 -6.35 0) (effects (font (size 1.27 1.27))))
    (property "Footprint" "" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "Datasheet" "" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "Description" "{descr}" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "MPN" "UNVERIFIED" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (property "Status" "UNVERIFIED" (at 0 0 0) (effects (font (size 1.27 1.27)) hide))
    (symbol "{name}_0_1"
      (rectangle (start -7.62 5.08) (end 7.62 -5.08)
        (stroke (width 0.254) (type default)) (fill (type background)))
      (pin passive line (at -10.16 2.54 0) (length 2.54)
        (name "A" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
      (pin passive line (at -10.16 -2.54 0) (length 2.54)
        (name "B" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))
      (pin input line (at 10.16 0 180) (length 2.54)
        (name "EN" (effects (font (size 1.27 1.27))))
        (number "3" (effects (font (size 1.27 1.27)))))
    )
  )'''


def generic_tp() -> str:
    return '''  (symbol "pc-generic:TP_UNVERIFIED"
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
    (symbol "TP_UNVERIFIED_0_1"
      (circle (center 0 0) (radius 0.762)
        (stroke (width 0.254) (type default)) (fill (type none)))
      (pin passive line (at 0 -2.54 90) (length 1.778)
        (name "~" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
    )
  )'''


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
    extras: str = "",
) -> str:
    pin_uuids = "\n".join(
        f'    (pin "{n}" (uuid "{uid("p:"+tag+":"+n)}"))' for n in pins
    )
    blocks = [
        f'''  (symbol (lib_id "{lib_id}") (at {x:.3f} {y:.3f} 0) (unit 1)
    (in_bom no) (on_board yes)
    (uuid "{uid("s:"+tag)}")
    (property "Reference" "{ref}" (at {x:.3f} {y+12.7:.3f} 0)
      (effects (font (size 1.27 1.27))))
    (property "Value" "{value}" (at {x:.3f} {y-12.7:.3f} 0)
      (effects (font (size 1.27 1.27))))
    (property "Footprint" "" (at {x:.3f} {y:.3f} 0)
      (effects (font (size 1.27 1.27)) hide))
    (property "Datasheet" "" (at {x:.3f} {y:.3f} 0)
      (effects (font (size 1.27 1.27)) hide))
    (property "MPN" "UNVERIFIED" (at {x:.3f} {y:.3f} 0)
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
        if number == "3" and "Q1" in ref:
            rot, shape = 180, "input"
        blocks.append(glabel(net, wx, wy, rot, shape, f"{tag}:{number}:{net}"))
    if extras:
        blocks.append(extras)
    return "\n".join(blocks)


def sheet_file(
    filename: str,
    title: str,
    page: str,
    lib_symbols: str,
    body: str,
    uuid_name: str,
) -> str:
    return f'''(kicad_sch (version 20230121) (generator mantis-ee-24)
  (uuid "{uid(uuid_name)}")
  (paper "A3")
  (title_block
    (title "{title}")
    (date "2026-08-20")
    (rev "B-draft")
    (comment 1 "Issue 24. Theoretical / UNVERIFIED. Not for fabrication.")
    (comment 2 "P08 diagnostic only. No MIPI on B27/B50. #23 envelopes, no invented MPN.")
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


def root_sheet(child_uuids: dict[str, str]) -> str:
    boxes = []
    layout = [
        ("01-source-b27-b50", "source / F1 / B27 / B50", 25.4, 25.4),
        ("02-s1-s2-q1", "S1 S2 Q1 assembly", 120.0, 25.4),
        ("03-lowspeed-iso-p08", "low-speed iso / P08 diag", 25.4, 90.0),
        ("04-esd-sense-tp", "ESD / sense / TP / faults", 120.0, 90.0),
    ]
    for file, name, x, y in layout:
        boxes.append(
            f'''  (sheet
    (at {x} {y})
    (size 76.2 50.8)
    (stroke (width 0.1524) (type solid))
    (fill (color 0 0 0 0.0))
    (uuid "{child_uuids[file]}")
    (property "Sheetname" "{name}" (at {x} {y-1.27} 0)
      (effects (font (size 1.27 1.27)) (justify left bottom)))
    (property "Sheetfile" "sheets/{file}.kicad_sch" (at {x} {y+52.07} 0)
      (effects (font (size 1.27 1.27)) (justify left top)))
  )'''
        )
    note = text(
        "Hardware authorization (native KiCad + ngspice screening):\\n"
        "  Q1 ON only if S1 closed AND S2 closed AND NOT remate_req AND NOT OC latch AND NOT UVLO.\\n"
        "  P08 / UID / I2C / firmware cannot force Q1 ON.\\n"
        "  S1 open => Q1 off, discharge, isolate before B27 lift (break-before-move).\\n"
        "  S2 open => Q1 off, discharge, isolate before B50 move (break-before-binder-release).\\n"
        "  Q1 is a two-channel UNVERIFIED safety assembly plus independent discharge.\\n"
        "  Raw MIPI does not appear on P01-P12 / C01-C12. P10/P11 are GMSL, owned by #25.\\n"
        "  #23 library is unadmitted; S1/S2/Q1/B27/B50 remain UNVERIFIED envelopes.",
        25.4,
        155.0,
        "root-note",
    )
    return f'''(kicad_sch (version 20230121) (generator mantis-ee-24)
  (uuid "{uid("root")}")
  (paper "A3")
  (title_block
    (title "Mantis EE-02 power-control")
    (date "2026-08-20")
    (rev "B-draft")
    (comment 1 "Issue 24. Theoretical / UNVERIFIED. Not for fabrication. Do not merge as shop release.")
    (comment 2 "Tracks #24 only. Does not implement #18. Does not touch PR 12.")
  )
{chr(10).join(boxes)}
{note}
  (sheet_instances
    (path "/" (page "1"))
    (path "/{child_uuids["01-source-b27-b50"]}" (page "2"))
    (path "/{child_uuids["02-s1-s2-q1"]}" (page "3"))
    (path "/{child_uuids["03-lowspeed-iso-p08"]}" (page "4"))
    (path "/{child_uuids["04-esd-sense-tp"]}" (page "5"))
  )
)
'''


def main() -> None:
    if not LIB.is_file():
        raise SystemExit(f"EE-01 library missing (read-only dependency): {LIB}")
    lib = LIB.read_text()
    wanted = [
        "B27_RAIL_12NET",
        "B50_BINDER_12NET",
        "S1_NO_CARRIAGE_MATE_UNVERIFIED",
        "S2_NO_BINDER_MATE_UNVERIFIED",
        "Q1_LOADSWITCH_UNVERIFIED",
    ]
    extracted = {name: extract_symbol(lib, name) for name in wanted}
    pins = {name: pin_coords(body) for name, body in extracted.items()}
    two_pin = {
        "1": (0.0, 3.81),
        "2": (0.0, -3.81),
    }
    sw3 = {"1": (-10.16, 2.54), "2": (-10.16, -2.54), "3": (10.16, 0.0)}
    tp_pins = {"1": (0.0, -2.54)}

    generics = "\n".join(
        [
            generic_two_pin("FUSE_UNVERIFIED", "F", "F1 envelope. 2 A TARGET from BOM B44. MPN UNVERIFIED."),
            generic_two_pin("R_UNVERIFIED", "R", "Generic resistor envelope. MPN UNVERIFIED."),
            generic_two_pin("C_UNVERIFIED", "C", "Generic capacitor envelope. MPN UNVERIFIED."),
            generic_two_pin("TVS_UNVERIFIED", "D", "Generic TVS envelope. MPN UNVERIFIED."),
            generic_sw3("ISO_UNVERIFIED", "Low-speed isolation channel. MPN UNVERIFIED."),
            generic_sw3("Q1_DISCHARGE_UNVERIFIED", "Q1-assembly discharge channel. MPN UNVERIFIED."),
            generic_tp(),
        ]
    )

    SHEETS.mkdir(parents=True, exist_ok=True)

    b27_nets = {
        "P01": "VIN_A",
        "P02": "VIN_B",
        "P03": "GND_A",
        "P04": "GND_B",
        "P05": "SDA",
        "P06": "SCL",
        "P07": "UID",
        "P08": "FAULT_N",
        "P09": "HSGND",
        "P10": "GMSL_P",
        "P11": "GMSL_N",
        "P12": "HSGND",
    }
    b50_nets = {f"C{i:02d}": net for i, net in enumerate(b27_nets.values(), 1)}

    src_body = "\n".join(
        [
            instance(
                "pc-generic:FUSE_UNVERIFIED",
                "F1",
                "2A_TARGET_UNVERIFIED",
                40.0,
                50.0,
                "F1",
                two_pin,
                {"1": "VIN_RAIL", "2": "VIN_FUSED"},
            ),
            instance(
                "mantis-ee:B27_RAIL_12NET",
                "J27",
                "B27_RAIL_12NET",
                120.0,
                70.0,
                "J27",
                pins["B27_RAIL_12NET"],
                b27_nets,
            ),
            instance(
                "mantis-ee:B50_BINDER_12NET",
                "J50",
                "B50_BINDER_12NET",
                210.0,
                70.0,
                "J50",
                pins["B50_BINDER_12NET"],
                b50_nets,
            ),
            instance(
                "pc-generic:R_UNVERIFIED",
                "R_P01",
                "R_CONTACT_SWEEP",
                70.0,
                40.0,
                "RP01",
                two_pin,
                {"1": "VIN_FUSED", "2": "VIN_SHARED"},
            ),
            instance(
                "pc-generic:R_UNVERIFIED",
                "R_P02",
                "R_CONTACT_SWEEP",
                80.0,
                40.0,
                "RP02",
                two_pin,
                {"1": "VIN_FUSED", "2": "VIN_SHARED"},
            ),
            text(
                "Ground-first/make-last is a mechanical interface requirement, not this schematic.\\n"
                "P10/P11 are GMSL. They are not MIPI. #25 owns the channel. P08 is diagnostic only.",
                25.4,
                140.0,
                "src-note",
            ),
        ]
    )
    src_libs = "\n".join(
        [extracted["B27_RAIL_12NET"], extracted["B50_BINDER_12NET"], generics]
    )
    (SHEETS / "01-source-b27-b50.kicad_sch").write_text(
        sheet_file("01", "Source, F1, B27, B50", "2", src_libs, src_body, "sheet:01")
    )

    q1_pins = pins["Q1_LOADSWITCH_UNVERIFIED"]
    interlock_body = "\n".join(
        [
            instance(
                "mantis-ee:S1_NO_CARRIAGE_MATE_UNVERIFIED",
                "S1",
                "S1_NO_CARRIAGE_MATE_UNVERIFIED",
                50.0,
                50.0,
                "S1",
                pins["S1_NO_CARRIAGE_MATE_UNVERIFIED"],
                {"1": "VREF", "2": "INTERLOCK_MID"},
            ),
            instance(
                "mantis-ee:S2_NO_BINDER_MATE_UNVERIFIED",
                "S2",
                "S2_NO_BINDER_MATE_UNVERIFIED",
                100.0,
                50.0,
                "S2",
                pins["S2_NO_BINDER_MATE_UNVERIFIED"],
                {"1": "INTERLOCK_MID", "2": "INTERLOCK_OK"},
            ),
            instance(
                "mantis-ee:Q1_LOADSWITCH_UNVERIFIED",
                "Q1A",
                "Q1_LOADSWITCH_UNVERIFIED",
                70.0,
                110.0,
                "Q1A",
                q1_pins,
                {"1": "VIN_SHARED", "2": "Q1_MID", "3": "Q1_EN", "4": "GND"},
            ),
            instance(
                "mantis-ee:Q1_LOADSWITCH_UNVERIFIED",
                "Q1B",
                "Q1_LOADSWITCH_UNVERIFIED",
                130.0,
                110.0,
                "Q1B",
                q1_pins,
                {"1": "Q1_MID", "2": "V_BRANCH", "3": "Q1_EN", "4": "GND"},
            ),
            instance(
                "pc-generic:Q1_DISCHARGE_UNVERIFIED",
                "K_DCHG",
                "Q1_DISCHARGE_UNVERIFIED",
                200.0,
                110.0,
                "KDCHG",
                sw3,
                {"1": "V_BRANCH", "2": "GND", "3": "Q1_EN_N"},
            ),
            instance(
                "pc-generic:C_UNVERIFIED",
                "C_LOAD",
                "C_LOAD_SWEEP",
                230.0,
                60.0,
                "CLOAD",
                two_pin,
                {"1": "V_BRANCH", "2": "GND"},
            ),
            instance(
                "pc-generic:TP_UNVERIFIED",
                "TP1",
                "TP_Q1_EN",
                160.0,
                40.0,
                "TP1",
                tp_pins,
                {"1": "Q1_EN"},
            ),
            instance(
                "pc-generic:TP_UNVERIFIED",
                "TP2",
                "TP_V_BRANCH",
                175.0,
                40.0,
                "TP2",
                tp_pins,
                {"1": "V_BRANCH"},
            ),
            text(
                "S1 and S2 are series-NO hardware AND. Forced-off does not pass through P08 or firmware.\\n"
                "Q1A+Q1B are two UNVERIFIED series isolation channels of the Q1 safety assembly.\\n"
                "A single welded S1 or S2 is a demonstrated hazard in ngspice; that gap stays UNVERIFIED.",
                25.4,
                160.0,
                "q1-note",
            ),
        ]
    )
    q1_libs = "\n".join(
        [
            extracted["S1_NO_CARRIAGE_MATE_UNVERIFIED"],
            extracted["S2_NO_BINDER_MATE_UNVERIFIED"],
            extracted["Q1_LOADSWITCH_UNVERIFIED"],
            generics,
        ]
    )
    (SHEETS / "02-s1-s2-q1.kicad_sch").write_text(
        sheet_file("02", "S1 S2 Q1 safety assembly", "3", q1_libs, interlock_body, "sheet:02")
    )

    iso_body = "\n".join(
        [
            instance(
                "pc-generic:ISO_UNVERIFIED",
                "K_SDA",
                "ISO_UNVERIFIED",
                50.0,
                40.0,
                "KSDA",
                sw3,
                {"1": "SDA", "2": "SDA_BR", "3": "ISO_EN"},
            ),
            instance(
                "pc-generic:ISO_UNVERIFIED",
                "K_SCL",
                "ISO_UNVERIFIED",
                50.0,
                80.0,
                "KSCL",
                sw3,
                {"1": "SCL", "2": "SCL_BR", "3": "ISO_EN"},
            ),
            instance(
                "pc-generic:ISO_UNVERIFIED",
                "K_UID",
                "ISO_UNVERIFIED",
                50.0,
                120.0,
                "KUID",
                sw3,
                {"1": "UID", "2": "UID_BR", "3": "ISO_EN"},
            ),
            instance(
                "pc-generic:ISO_UNVERIFIED",
                "K_P08",
                "ISO_UNVERIFIED",
                140.0,
                40.0,
                "KP08",
                sw3,
                {"1": "FAULT_N", "2": "P08_BR", "3": "ISO_EN"},
            ),
            text(
                "ISO_EN follows Q1_EN only. Unpowered backfeed is blocked when Q1 is off.\\n"
                "P08/FAULT_N is a diagnostic output from the hardware latch. It is not an enable input.\\n"
                "UID and I2C may inhibit training in firmware; they cannot override an open S1 or S2.",
                25.4,
                160.0,
                "iso-note",
            ),
        ]
    )
    (SHEETS / "03-lowspeed-iso-p08.kicad_sch").write_text(
        sheet_file("03", "Low-speed isolation and P08 diagnostic", "4", generics, iso_body, "sheet:03")
    )

    esd_body = "\n".join(
        [
            instance("pc-generic:TVS_UNVERIFIED", "D_VIN", "TVS_UNVERIFIED", 40.0, 40.0, "DVIN", two_pin, {"1": "VIN_SHARED", "2": "GND"}),
            instance("pc-generic:TVS_UNVERIFIED", "D_SDA", "TVS_UNVERIFIED", 60.0, 40.0, "DSDA", two_pin, {"1": "SDA", "2": "GND"}),
            instance("pc-generic:TVS_UNVERIFIED", "D_SCL", "TVS_UNVERIFIED", 80.0, 40.0, "DSCL", two_pin, {"1": "SCL", "2": "GND"}),
            instance("pc-generic:TVS_UNVERIFIED", "D_UID", "TVS_UNVERIFIED", 100.0, 40.0, "DUID", two_pin, {"1": "UID", "2": "GND"}),
            instance("pc-generic:TVS_UNVERIFIED", "D_P08", "TVS_UNVERIFIED", 120.0, 40.0, "DP08", two_pin, {"1": "FAULT_N", "2": "GND"}),
            instance("pc-generic:R_UNVERIFIED", "R_SNS", "1m_SWEEP", 160.0, 80.0, "RSNS", two_pin, {"1": "VIN_SHARED", "2": "Q1A_IN"}),
            instance("pc-generic:TP_UNVERIFIED", "TP3", "TP_I_SNS", 190.0, 80.0, "TP3", tp_pins, {"1": "Q1A_IN"}),
            instance("pc-generic:TP_UNVERIFIED", "TP4", "TP_S1_SENSE", 40.0, 110.0, "TP4", tp_pins, {"1": "INTERLOCK_MID"}),
            instance("pc-generic:TP_UNVERIFIED", "TP5", "TP_S2_SENSE", 70.0, 110.0, "TP5", tp_pins, {"1": "INTERLOCK_OK"}),
            instance("pc-generic:TP_UNVERIFIED", "TP6", "TP_P08_DIAG", 100.0, 110.0, "TP6", tp_pins, {"1": "P08_DIAG"}),
            text(
                "TVS MPNs UNVERIFIED. Fault-injection hooks are the TP nodes and spice sources of the same names.\\n"
                "ngspice screens; bench captures qualify. Unsafe-stop: kill VIN_RAIL, do not use P08 as the off path.",
                25.4,
                150.0,
                "esd-note",
            ),
        ]
    )
    (SHEETS / "04-esd-sense-tp.kicad_sch").write_text(
        sheet_file("04", "ESD, sense, test points, fault hooks", "5", generics, esd_body, "sheet:04")
    )

    child_uuids = {
        "01-source-b27-b50": uid("sheet:01"),
        "02-s1-s2-q1": uid("sheet:02"),
        "03-lowspeed-iso-p08": uid("sheet:03"),
        "04-esd-sense-tp": uid("sheet:04"),
    }
    (HERE / "power-control.kicad_sch").write_text(root_sheet(child_uuids))
    (HERE / "power-control.kicad_pro").write_text(
        """{
  "board": { "design_settings": {} },
  "meta": { "filename": "power-control.kicad_pro", "version": 1 },
  "sheets": [
    ["power-control.kicad_sch", "%s"],
    ["sheets/01-source-b27-b50.kicad_sch", "%s"],
    ["sheets/02-s1-s2-q1.kicad_sch", "%s"],
    ["sheets/03-lowspeed-iso-p08.kicad_sch", "%s"],
    ["sheets/04-esd-sense-tp.kicad_sch", "%s"]
  ],
  "text_variables": {},
  "libraries": {
    "pinned_symbol_libs": ["mantis-ee"],
    "pinned_fp_libs": ["mantis-ee"]
  }
}
"""
        % (
            uid("root"),
            child_uuids["01-source-b27-b50"],
            child_uuids["02-s1-s2-q1"],
            child_uuids["03-lowspeed-iso-p08"],
            child_uuids["04-esd-sense-tp"],
        )
    )
    (HERE / "sym-lib-table").write_text(
        '(sym_lib_table\n'
        '  (lib (name "mantis-ee")(type "KiCad")'
        '(uri "${KIPRJMOD}/../libs/symbols/mantis-ee.kicad_sym")(options "")'
        '(descr "Mantis EE-01 UNVERIFIED envelopes"))\n)\n'
    )
    (HERE / "fp-lib-table").write_text(
        '(fp_lib_table\n'
        '  (lib (name "mantis-ee")(type "KiCad")'
        '(uri "${KIPRJMOD}/../libs/footprints/mantis-ee.pretty")(options "")'
        '(descr "Mantis EE-01 UNVERIFIED envelopes"))\n)\n'
    )
    print("wrote power-control KiCad project")


if __name__ == "__main__":
    main()
