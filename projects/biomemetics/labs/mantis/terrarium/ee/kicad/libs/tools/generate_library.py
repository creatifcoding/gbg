#!/usr/bin/env python3
"""Emit the Mantis EE-01 native KiCad library from sourced pin tables.

Does not invent MPNs. Unselected suffixes stay UNVERIFIED.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SYMBOLS = ROOT / "symbols"
FOOTPRINTS = ROOT / "footprints" / "mantis-ee.pretty"
MODELS = ROOT / "models"
SOURCES = ROOT / "sources"
SMOKE = ROOT / "smoke"
RETRIEVED = "2026-08-20"

TCA9548A_PW = [
    ("A0", "1", "input"),
    ("A1", "2", "input"),
    ("RESET", "3", "input"),
    ("SD0", "4", "bidirectional"),
    ("SC0", "5", "bidirectional"),
    ("SD1", "6", "bidirectional"),
    ("SC1", "7", "bidirectional"),
    ("SD2", "8", "bidirectional"),
    ("SC2", "9", "bidirectional"),
    ("SD3", "10", "bidirectional"),
    ("SC3", "11", "bidirectional"),
    ("GND", "12", "power_in"),
    ("SD4", "13", "bidirectional"),
    ("SC4", "14", "bidirectional"),
    ("SD5", "15", "bidirectional"),
    ("SC5", "16", "bidirectional"),
    ("SD6", "17", "bidirectional"),
    ("SC6", "18", "bidirectional"),
    ("SD7", "19", "bidirectional"),
    ("SC7", "20", "bidirectional"),
    ("A2", "21", "input"),
    ("SCL", "22", "bidirectional"),
    ("SDA", "23", "bidirectional"),
    ("VCC", "24", "power_in"),
]

TCA9548A_RGE = [
    ("SD0", "1", "bidirectional"),
    ("SC0", "2", "bidirectional"),
    ("SD1", "3", "bidirectional"),
    ("SC1", "4", "bidirectional"),
    ("SD2", "5", "bidirectional"),
    ("SC2", "6", "bidirectional"),
    ("SD3", "7", "bidirectional"),
    ("SC3", "8", "bidirectional"),
    ("GND", "9", "power_in"),
    ("SD4", "10", "bidirectional"),
    ("SC4", "11", "bidirectional"),
    ("SD5", "12", "bidirectional"),
    ("SC5", "13", "bidirectional"),
    ("SD6", "14", "bidirectional"),
    ("SC6", "15", "bidirectional"),
    ("SD7", "16", "bidirectional"),
    ("SC7", "17", "bidirectional"),
    ("A2", "18", "input"),
    ("SCL", "19", "bidirectional"),
    ("SDA", "20", "bidirectional"),
    ("VCC", "21", "power_in"),
    ("A0", "22", "input"),
    ("A1", "23", "input"),
    ("RESET", "24", "input"),
    ("EP", "25", "passive"),
]

B27 = [
    ("P01", "VIN-A", "power", "continuous"),
    ("P02", "VIN-B", "power", "continuous"),
    ("P03", "GND-A", "return", "continuous"),
    ("P04", "GND-B", "return", "continuous"),
    ("P05", "SDA", "control", "continuous"),
    ("P06", "SCL", "control", "continuous"),
    ("P07", "UID", "identity", "continuous"),
    ("P08", "FAULT_N/IRQ", "diagnostic", "continuous"),
    ("P09", "HSGND", "high-speed-ground", "discrete-dock"),
    ("P10", "GMSL+", "high-speed-positive", "discrete-dock"),
    ("P11", "GMSL-", "high-speed-negative", "discrete-dock"),
    ("P12", "HSGND", "high-speed-ground", "discrete-dock"),
]

CSI1 = [
    ("1", "GND", "passive"),
    ("2", "CSI_D0_N", "bidirectional"),
    ("3", "CSI_D0_P", "bidirectional"),
    ("4", "GND", "passive"),
    ("5", "CSI_D1_N", "bidirectional"),
    ("6", "CSI_D1_P", "bidirectional"),
    ("7", "GND", "passive"),
    ("8", "CSI_CLK_N", "bidirectional"),
    ("9", "CSI_CLK_P", "bidirectional"),
    ("10", "GND", "passive"),
    ("11", "CSI_D2_N", "bidirectional"),
    ("12", "CSI_D2_P", "bidirectional"),
    ("13", "GND", "passive"),
    ("14", "CSI_D3_N", "bidirectional"),
    ("15", "CSI_D3_P", "bidirectional"),
    ("16", "GND", "passive"),
    ("17", "CSI_PWR_EN", "output"),
    ("18", "CSI_RESET", "output"),
    ("19", "GND", "passive"),
    ("20", "CAM2_SCL", "bidirectional"),
    ("21", "CAM2_SDA", "bidirectional"),
    ("22", "3V3", "power_out"),
]

DSI_CSI2 = [
    ("1", "GND", "passive"),
    ("2", "DSI_CSI_D0_N", "bidirectional"),
    ("3", "DSI_CSI_D0_P", "bidirectional"),
    ("4", "GND", "passive"),
    ("5", "DSI_CSI_D1_N", "bidirectional"),
    ("6", "DSI_CSI_D1_P", "bidirectional"),
    ("7", "GND", "passive"),
    ("8", "DSI_CSI_CLK_N", "bidirectional"),
    ("9", "DSI_CSI_CLK_P", "bidirectional"),
    ("10", "GND", "passive"),
    ("11", "DSI_CSI_D2_N", "bidirectional"),
    ("12", "DSI_CSI_D2_P", "bidirectional"),
    ("13", "GND", "passive"),
    ("14", "DSI_CSI_D3_N", "bidirectional"),
    ("15", "DSI_CSI_D3_P", "bidirectional"),
    ("16", "GND", "passive"),
    ("17", "DSI_CSI_PWR_EN", "output"),
    ("18", "DSI_CSI_RESET", "output"),
    ("19", "GND", "passive"),
    ("20", "TP_CAM1_SCL", "bidirectional"),
    ("21", "TP_CAM1_SDA", "bidirectional"),
    ("22", "3V3", "power_out"),
]

QWIIC = [
    ("1", "GND", "passive"),
    ("2", "3V3", "power_out"),
    ("3", "SDA", "bidirectional"),
    ("4", "SCL", "bidirectional"),
]


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def prop(name: str, value: str, x: float, y: float, hide: bool = False) -> str:
    hidden = " hide" if hide else ""
    return (
        f'    (property "{name}" "{value}"\n'
        f"      (at {x} {y} 0)\n"
        f"      (effects (font (size 1.27 1.27)){hidden})\n"
        f"    )"
    )


def pin_block(name: str, number: str, etype: str, x: float, y: float, rot: int) -> str:
    return (
        f"      (pin {etype} line (at {x:.3f} {y:.3f} {rot}) (length 2.54)\n"
        f'        (name "{name}" (effects (font (size 1.27 1.27))))\n'
        f'        (number "{number}" (effects (font (size 1.27 1.27))))\n'
        f"      )"
    )


def two_column_pins(pins: list[tuple[str, str, str]], height: float) -> tuple[str, float, float]:
    n = len(pins)
    left_n = (n + 1) // 2
    pitch = 2.54
    y0 = (left_n - 1) * pitch / 2
    width = 22.86
    body_h = max(height, left_n * pitch + 2.54)
    chunks = []
    for i, (name, number, etype) in enumerate(pins):
        if i < left_n:
            x, y, rot = -width / 2 - 2.54, y0 - i * pitch, 0
        else:
            x, y, rot = width / 2 + 2.54, y0 - (i - left_n) * pitch, 180
        chunks.append(pin_block(name, number, etype, x, y, rot))
    return "\n".join(chunks), width, body_h


def symbol(
    name: str,
    ref: str,
    pins: list[tuple[str, str, str]],
    properties: dict[str, str],
    in_bom: str = "yes",
) -> str:
    pin_txt, width, height = two_column_pins(pins, 15.24)
    hw, hh = width / 2, height / 2
    props = [
        prop("Reference", ref, 0, hh + 2.54),
        prop("Value", name, 0, -hh - 2.54),
        prop("Footprint", properties.get("Footprint", ""), 0, -hh - 5.08, True),
        prop("Datasheet", properties.get("Datasheet", ""), 0, -hh - 7.62, True),
        prop("Description", properties.get("Description", ""), 0, -hh - 10.16, True),
        prop("ki_keywords", properties.get("ki_keywords", ""), 0, -hh - 12.7, True),
    ]
    for extra in (
        "MPN",
        "Manufacturer",
        "Revision",
        "License",
        "Status",
        "SourceDigest",
        "MatingDirection",
    ):
        if extra in properties:
            props.append(prop(extra, properties[extra], 0, 0, True))
    return f"""  (symbol "{name}"
    (pin_names (offset 1.016))
    (in_bom {in_bom})
    (on_board yes)
{chr(10).join(props)}
    (symbol "{name}_0_1"
      (rectangle (start {-hw:.3f} {hh:.3f}) (end {hw:.3f} {-hh:.3f})
        (stroke (width 0.254) (type default)) (fill (type background))
      )
{pin_txt}
    )
  )"""


def fp_header(name: str, descr: str, tags: str, attr: str) -> str:
    return f"""(footprint "{name}"
  (version 20221018)
  (generator "mantis-ee-23")
  (layer "F.Cu")
  (descr "{descr}")
  (tags "{tags}")
  (attr {attr})
  (fp_text reference "REF**" (at 0 -4) (layer "F.SilkS")
    (effects (font (size 1 1)))
  )
  (fp_text value "{name}" (at 0 4) (layer "F.Fab")
    (effects (font (size 1 1)))
  )
"""


def courtyard(x1: float, y1: float, x2: float, y2: float) -> str:
    return f"""  (fp_rect (start {x1:.3f} {y1:.3f}) (end {x2:.3f} {y2:.3f})
    (stroke (width 0.05) (type default)) (fill (type none)) (layer "F.CrtYd")
  )
"""


def tssop24_pw() -> str:
    pitch, pad_w, pad_h, row = 0.65, 0.45, 1.50, 5.80
    xs = [-(11 * pitch) / 2 + i * pitch for i in range(12)]
    pads = []
    for i, x in enumerate(xs):
        n = str(i + 1)
        pads.append(
            f'  (pad "{n}" smd roundrect (at {x:.3f} {-row/2:.3f}) (size {pad_w} {pad_h}) '
            f'(layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25))'
        )
    for i, x in enumerate(reversed(xs)):
        n = str(i + 13)
        pads.append(
            f'  (pad "{n}" smd roundrect (at {x:.3f} {row/2:.3f}) (size {pad_w} {pad_h}) '
            f'(layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25))'
        )
    body_l, body_w = 7.80, 4.40
    silk = f"""  (fp_rect (start {-body_l/2:.3f} {-body_w/2:.3f}) (end {body_l/2:.3f} {body_w/2:.3f})
    (stroke (width 0.12) (type default)) (fill (type none)) (layer "F.SilkS")
  )
  (fp_circle (center {-body_l/2 - 0.6:.3f} {-row/2:.3f}) (end {-body_l/2 - 0.35:.3f} {-row/2:.3f})
    (stroke (width 0.12) (type default)) (fill (type none)) (layer "F.SilkS")
  )
"""
    return (
        fp_header(
            "TSSOP-24_PW_TI",
            "TI PW0024A land pattern from TCA9548A Rev. H. Pad 0.45x1.5 mm, pitch 0.65 mm, row 5.8 mm. Height 1.2 mm max. Paste 1:1, mask 1:1 NSMD preferred. Mating: top-side SMT, pin 1 index top-left in this library (pad 1).",
            "TSSOP-24 PW TCA9548A sourced",
            "smd",
        )
        + silk
        + courtyard(-4.6, -4.0, 4.6, 4.0)
        + "\n".join(pads)
        + "\n)\n"
    )


def vqfn24_rge() -> str:
    pitch = 0.50
    pad_w, pad_l = 0.24, 0.60
    span = 2.50
    body = 4.00
    thermal = 2.10
    pad_c = 2.00
    coords: list[tuple[str, float, float, float, float]] = []
    ys = [span / 2 - i * pitch for i in range(6)]
    for i, y in enumerate(ys):
        coords.append((str(i + 1), -pad_c, y, pad_l, pad_w))
    xs = [-span / 2 + i * pitch for i in range(6)]
    for i, x in enumerate(xs):
        coords.append((str(i + 7), x, -pad_c, pad_w, pad_l))
    for i, y in enumerate(reversed(ys)):
        coords.append((str(i + 13), pad_c, y, pad_l, pad_w))
    for i, x in enumerate(reversed(xs)):
        coords.append((str(i + 19), x, pad_c, pad_w, pad_l))
    pads = [
        f'  (pad "{n}" smd roundrect (at {x:.3f} {y:.3f}) (size {w:.3f} {h:.3f}) '
        f'(layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25))'
        for n, x, y, w, h in coords
    ]
    pads.append(
        f'  (pad "25" smd rect (at 0 0) (size {thermal:.3f} {thermal:.3f}) '
        f'(layers "F.Cu" "F.Paste" "F.Mask"))'
    )
    silk = f"""  (fp_rect (start {-body/2:.3f} {-body/2:.3f}) (end {body/2:.3f} {body/2:.3f})
    (stroke (width 0.12) (type default)) (fill (type none)) (layer "F.SilkS")
  )
  (fp_circle (center {-body/2 - 0.45:.3f} {span/2:.3f}) (end {-body/2 - 0.25:.3f} {span/2:.3f})
    (stroke (width 0.12) (type default)) (fill (type none)) (layer "F.SilkS")
  )
"""
    return (
        fp_header(
            "VQFN-24_RGE_TI",
            "TI RGE0024C land pattern from TCA9548A Rev. H. Pads 0.24x0.60 mm, pitch 0.50 mm, EP 2.1 mm. Height 1.0 mm max. Paste: signal 1:1; EP 80 percent area per TI stencil note. Mating: top-side SMT. EP pad 25 electrical net UNVERIFIED (thermal pad, not in Table 4-1).",
            "VQFN-24 RGE TCA9548A sourced",
            "smd",
        )
        + silk
        + courtyard(-3.0, -3.0, 3.0, 3.0)
        + "\n".join(pads)
        + "\n)\n"
    )


def fpc22() -> str:
    pitch, pad_w, pad_h = 0.50, 0.30, 1.20
    xs = [-(21 * pitch) / 2 + i * pitch for i in range(22)]
    pads = [
        f'  (pad "{i+1}" smd rect (at {x:.3f} 0) (size {pad_w} {pad_h}) '
        f'(layers "F.Cu" "F.Paste" "F.Mask"))'
        for i, x in enumerate(xs)
    ]
    return (
        fp_header(
            "FPC-22_0.5mm_UNVERIFIED-MPN",
            "22-position 0.5 mm pitch FPC pad row. Pitch and position count sourced from Particle Tachyon camera docs. Connector MPN, pad length, mask/paste, height, and latch geometry UNVERIFIED. Mating: FPC, contacts facing away from retention tab per Particle hardware setup. Datum: pad 1.",
            "FPC 22 0.5mm CSI UNVERIFIED-MPN",
            "smd",
        )
        + courtyard(-6.2, -1.6, 6.2, 1.6)
        + "\n".join(pads)
        + "\n)\n"
    )


def qwiic() -> str:
    pitch, pad_w, pad_h = 1.00, 0.60, 1.35
    xs = [-(3 * pitch) / 2 + i * pitch for i in range(4)]
    pads = [
        f'  (pad "{i+1}" smd roundrect (at {x:.3f} 0) (size {pad_w} {pad_h}) '
        f'(layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.2))'
        for i, x in enumerate(xs)
    ]
    return (
        fp_header(
            "JST-SH-4_1mm_UNVERIFIED-header-MPN",
            "4-position 1.00 mm keyed I2C header family. Pitch and 4-pin count sourced from Particle Tachyon Qwiic note. SparkFun cable housing MPN SHR-04V-S sourced. Board-header MPN UNVERIFIED. Pin order GND/3V3/SDA/SCL per SparkFun Qwiic rule. Height/courtyard/paste beyond 1 mm pitch UNVERIFIED pending JST drawing. Mating: keyed JST SH, top-side SMT.",
            "Qwiic JST SH 1mm UNVERIFIED-header",
            "smd",
        )
        + courtyard(-2.6, -1.6, 2.6, 1.6)
        + "\n".join(pads)
        + "\n)\n"
    )


def rail12(name: str, prefix: str, descr: str) -> str:
    pitch, land_w, land_h = 2.54, 1.50, 3.00
    xs = [-(11 * pitch) / 2 + i * pitch for i in range(12)]
    pads = [
        f'  (pad "{prefix}{i+1:02d}" smd rect (at {x:.3f} 0) (size {land_w} {land_h}) '
        f'(layers "F.Cu" "F.Mask") (solder_paste_margin_ratio -1))'
        for i, x in enumerate(xs)
    ]
    return (
        fp_header(
            name,
            descr,
            "12-net TARGET 2.54mm UNVERIFIED-series",
            "smd",
        )
        + courtyard(-16.0, -2.5, 16.0, 2.5)
        + "\n".join(pads)
        + "\n)\n"
    )


def switch_fp(name: str) -> str:
    pads = [
        '  (pad "1" smd rect (at -1.27 0) (size 1.2 1.6) (layers "F.Cu" "F.Paste" "F.Mask"))',
        '  (pad "2" smd rect (at 1.27 0) (size 1.2 1.6) (layers "F.Cu" "F.Paste" "F.Mask"))',
    ]
    return (
        fp_header(
            name,
            "UNVERIFIED two-pad mechanical-switch placeholder. No MPN selected. Do not fabricate from this footprint. Datum pad 1. Mating direction UNVERIFIED.",
            "switch UNVERIFIED",
            "smd",
        )
        + courtyard(-2.4, -1.5, 2.4, 1.5)
        + "\n".join(pads)
        + "\n)\n"
    )


def loadswitch_fp() -> str:
    pads = []
    for i, x in enumerate((-2.54, -0.85, 0.85, 2.54)):
        pads.append(
            f'  (pad "{i+1}" smd rect (at {x:.2f} 0) (size 0.8 1.4) (layers "F.Cu" "F.Paste" "F.Mask"))'
        )
    return (
        fp_header(
            "Q1_LOADSWITCH_UNVERIFIED",
            "UNVERIFIED current-limited load-switch / eFuse placeholder. No MPN or package selected. Do not fabricate from this footprint.",
            "Q1 UNVERIFIED",
            "smd",
        )
        + courtyard(-3.6, -1.5, 3.6, 1.5)
        + "\n".join(pads)
        + "\n)\n"
    )


def serdes_fp(name: str) -> str:
    return (
        fp_header(
            name,
            "UNVERIFIED package. Analog Devices datasheet PDF was not retrieved this run (analog.com timeout). No pad map. Do not fabricate.",
            "GMSL UNVERIFIED",
            "smd",
        )
        + courtyard(-3, -3, 3, 3)
        + '  (fp_text user "NO-PAD-MAP" (at 0 0) (layer "F.Fab") (effects (font (size 0.8 0.8))))\n'
        + ")\n"
    )


def write_symbols() -> list[dict]:
    records = []
    chunks = [
        '(kicad_symbol_lib (version 20211014) (generator "mantis-ee-23")',
        symbol(
            "B27_RAIL_12NET",
            "J",
            [(p[1], p[0], "passive") for p in B27],
            {
                "Footprint": "mantis-ee:B27_RAIL_12NET_TARGET-2.54mm_UNVERIFIED-series",
                "Datasheet": "projects/biomemetics/labs/mantis/terrarium/bus.json",
                "Description": "B27 rail-to-carriage 12-net interface. Nets from bus.json. Contact series UNVERIFIED. P08 is diagnostic only.",
                "ki_keywords": "B27 pogo rail UNVERIFIED",
                "MPN": "UNVERIFIED",
                "Manufacturer": "UNVERIFIED",
                "Revision": "B-draft",
                "License": "project contract",
                "Status": "UNVERIFIED-series",
                "MatingDirection": "carriage spring contacts onto external rail lands; animal-side metal forbidden",
            },
        ),
        symbol(
            "B50_BINDER_12NET",
            "J",
            [(p[1], f"C{i+1:02d}", "passive") for i, p in enumerate(B27)],
            {
                "Footprint": "mantis-ee:B50_BINDER_12NET_UNVERIFIED-series",
                "Datasheet": "projects/biomemetics/labs/mantis/terrarium/BUS.md",
                "Description": "B50 keyed binder 12-net. C01-C12 mirror P01-P12 nets. Connector series UNVERIFIED.",
                "ki_keywords": "B50 binder UNVERIFIED",
                "MPN": "UNVERIFIED",
                "Manufacturer": "UNVERIFIED",
                "Revision": "B-draft",
                "License": "project contract",
                "Status": "UNVERIFIED-series",
                "MatingDirection": "binder-to-carriage, keyed, UNVERIFIED geometry",
            },
        ),
        symbol(
            "TACHYON_CSI1_22P",
            "J",
            [(n, p, t) for p, n, t in CSI1],
            {
                "Footprint": "mantis-ee:FPC-22_0.5mm_UNVERIFIED-MPN",
                "Datasheet": "https://developer.particle.io/tachyon/device-details/cameras",
                "Description": "Particle Tachyon CSI1 22-pos 0.5 mm pinout transcribed from tachyon-csi-pinout.jpg labeled TACHYON V1.2. Connector MPN UNVERIFIED. Raspberry Pi camera modules are not assumed supported.",
                "ki_keywords": "Tachyon CSI1 MIPI",
                "MPN": "UNVERIFIED",
                "Manufacturer": "Particle",
                "Revision": "Tachyon V1.2 pinout image",
                "License": "Particle documentation; pin facts only",
                "Status": "pinout-sourced-connector-MPN-UNVERIFIED",
                "SourceDigest": "be924e2f3b6e8ff1bbbb90602caceb4dd9833f965491659bcbd6de0a14a24c53",
                "MatingDirection": "FPC into CSI1; metal contacts away from retention tab",
            },
        ),
        symbol(
            "TACHYON_DSI_CSI2_22P",
            "J",
            [(n, p, t) for p, n, t in DSI_CSI2],
            {
                "Footprint": "mantis-ee:FPC-22_0.5mm_UNVERIFIED-MPN",
                "Datasheet": "https://developer.particle.io/tachyon/device-details/cameras",
                "Description": "Particle Tachyon DSI/CSI2 22-pos 0.5 mm pinout from tachyon-csi-dsi-pinout.jpg TACHYON V1.2. GPIO 68 selects CSI vs DSI. Connector MPN UNVERIFIED.",
                "ki_keywords": "Tachyon DSI CSI2 MIPI",
                "MPN": "UNVERIFIED",
                "Manufacturer": "Particle",
                "Revision": "Tachyon V1.2 pinout image",
                "License": "Particle documentation; pin facts only",
                "Status": "pinout-sourced-connector-MPN-UNVERIFIED",
                "SourceDigest": "8507704ff50143872a38ade3fe746176410e3ddefa4cf0f568d8dd48d7c3b8a0",
                "MatingDirection": "FPC into DSI/CSI2; metal contacts away from retention tab",
            },
        ),
        symbol(
            "QWIIC_4P_3V3",
            "J",
            [(n, p, t) for p, n, t in QWIIC],
            {
                "Footprint": "mantis-ee:JST-SH-4_1mm_UNVERIFIED-header-MPN",
                "Datasheet": "https://www.sparkfun.com/qwiic",
                "Description": "SparkFun Qwiic 4-pin 3.3 V I2C. Pin order GND/3V3/SDA/SCL. Cable housing SHR-04V-S sourced. Board-header MPN UNVERIFIED. Particle Tachyon Qwiic is this standard.",
                "ki_keywords": "Qwiic STEMMA JST",
                "MPN": "SHR-04V-S cable housing; header MPN UNVERIFIED",
                "Manufacturer": "JST / SparkFun ecosystem",
                "Revision": "SparkFun Qwiic pinout rule",
                "License": "SparkFun published Qwiic rules",
                "Status": "nets-sourced-header-MPN-UNVERIFIED",
                "MatingDirection": "keyed JST SH 1 mm",
            },
        ),
        symbol(
            "TCA9548A_PW",
            "U",
            [(n, p, t) for n, p, t in TCA9548A_PW],
            {
                "Footprint": "mantis-ee:TSSOP-24_PW_TI",
                "Datasheet": "https://www.ti.com/lit/ds/symlink/tca9548a.pdf",
                "Description": "TI TCA9548A TSSOP PW pin map Table 4-1 Rev. H. Orderable example TCA9548APWR is Active. Selected orderable for Mantis carrier UNVERIFIED. Optional B49.",
                "ki_keywords": "TCA9548A I2C switch",
                "MPN": "TCA9548APWR",
                "Manufacturer": "Texas Instruments",
                "Revision": "SCPS207H September 2024",
                "License": "TI datasheet; pin/package facts; PDF not redistributed",
                "Status": "device-sourced-carrier-UNVERIFIED",
                "SourceDigest": "2137822fd7128945ea44e83f4e100a932b30964d763715eeffe217ee6080a2dc",
                "MatingDirection": "top-side SMT",
            },
        ),
        symbol(
            "TCA9548A_RGE",
            "U",
            [(n, p, t) for n, p, t in TCA9548A_RGE],
            {
                "Footprint": "mantis-ee:VQFN-24_RGE_TI",
                "Datasheet": "https://www.ti.com/lit/ds/symlink/tca9548a.pdf",
                "Description": "TI TCA9548A VQFN RGE pin map Table 4-1 Rev. H. Orderable example TCA9548ARGER is Active. EP pad 25 not in Table 4-1. Selected orderable UNVERIFIED.",
                "ki_keywords": "TCA9548A I2C switch VQFN",
                "MPN": "TCA9548ARGER",
                "Manufacturer": "Texas Instruments",
                "Revision": "SCPS207H September 2024",
                "License": "TI datasheet; pin/package facts; PDF not redistributed",
                "Status": "device-sourced-EP-net-UNVERIFIED-carrier-UNVERIFIED",
                "SourceDigest": "2137822fd7128945ea44e83f4e100a932b30964d763715eeffe217ee6080a2dc",
                "MatingDirection": "top-side SMT",
            },
        ),
        symbol(
            "MAX96717_GMSL2_SER_UNVERIFIED",
            "U",
            [
                ("CSI_D0_P", "A1", "input"),
                ("CSI_D0_N", "A2", "input"),
                ("CSI_D1_P", "A3", "input"),
                ("CSI_D1_N", "A4", "input"),
                ("CSI_D2_P", "A5", "input"),
                ("CSI_D2_N", "A6", "input"),
                ("CSI_D3_P", "A7", "input"),
                ("CSI_D3_N", "A8", "input"),
                ("CSI_CLK_P", "A9", "input"),
                ("CSI_CLK_N", "A10", "input"),
                ("GMSL+", "B1", "output"),
                ("GMSL-", "B2", "output"),
                ("VDD", "P1", "power_in"),
                ("GND", "P2", "power_in"),
            ],
            {
                "Footprint": "mantis-ee:MAX96717_PACKAGE_UNVERIFIED",
                "Datasheet": "https://www.analog.com/en/products/max96717.html",
                "Description": "Functional GMSL2 serializer block. Family sourced from lab SOURCES.md (MAX96717, 4-lane CSI-2, 3/6 Gbps). Suffix, package, and pad map UNVERIFIED. analog.com PDF timed out this run. bus.json still names MAX96717; do not silently pick.",
                "ki_keywords": "MAX96717 GMSL2 serializer UNVERIFIED",
                "MPN": "UNVERIFIED",
                "Manufacturer": "Analog Devices",
                "Revision": "UNVERIFIED",
                "License": "product-page capability only; no pad map",
                "Status": "UNVERIFIED-suffix-no-pad-map",
                "MatingDirection": "n/a until package selected",
            },
            in_bom="no",
        ),
        symbol(
            "MAX96724_GMSL2_DES_UNVERIFIED",
            "U",
            [
                ("GMSL+", "B1", "input"),
                ("GMSL-", "B2", "input"),
                ("CSI_D0_P", "A1", "output"),
                ("CSI_D0_N", "A2", "output"),
                ("CSI_D1_P", "A3", "output"),
                ("CSI_D1_N", "A4", "output"),
                ("CSI_D2_P", "A5", "output"),
                ("CSI_D2_N", "A6", "output"),
                ("CSI_D3_P", "A7", "output"),
                ("CSI_D3_N", "A8", "output"),
                ("CSI_CLK_P", "A9", "output"),
                ("CSI_CLK_N", "A10", "output"),
                ("VDD", "P1", "power_in"),
                ("GND", "P2", "power_in"),
            ],
            {
                "Footprint": "mantis-ee:MAX96724_PACKAGE_UNVERIFIED",
                "Datasheet": "https://www.analog.com/en/products/max96724.html",
                "Description": "Functional GMSL2 deserializer block. Family sourced from lab SOURCES.md (MAX96724). Suffix, package, pad map, and Tachyon driver support UNVERIFIED. analog.com PDF timed out. bus.json still names MAX96724.",
                "ki_keywords": "MAX96724 GMSL2 deserializer UNVERIFIED",
                "MPN": "UNVERIFIED",
                "Manufacturer": "Analog Devices",
                "Revision": "UNVERIFIED",
                "License": "product-page capability only; no pad map",
                "Status": "UNVERIFIED-suffix-no-pad-map",
                "MatingDirection": "n/a until package selected",
            },
            in_bom="no",
        ),
        symbol(
            "IMX519_AF_MODULE_UNVERIFIED",
            "U",
            [(n, p, t) for p, n, t in CSI1],
            {
                "Footprint": "mantis-ee:FPC-22_0.5mm_UNVERIFIED-MPN",
                "Datasheet": "https://developer.particle.io/tachyon/device-details/cameras",
                "Description": "Sony IMX519 autofocus module is Particle-supported. Orderable SKU, revision, outline, connector orientation, and STEP UNVERIFIED. Legacy B0371 is not a release selection. Pin numbers follow Tachyon CSI1 only as the local CSI mechanical interface; module-side mapping UNVERIFIED until SKU.",
                "ki_keywords": "IMX519 camera UNVERIFIED",
                "MPN": "UNVERIFIED",
                "Manufacturer": "UNVERIFIED",
                "Revision": "UNVERIFIED",
                "License": "Particle camera support list only",
                "Status": "UNVERIFIED-SKU",
                "MatingDirection": "UNVERIFIED",
            },
            in_bom="no",
        ),
        symbol(
            "S1_NO_CARRIAGE_MATE_UNVERIFIED",
            "S",
            [("COM", "1", "passive"), ("NO", "2", "passive")],
            {
                "Footprint": "mantis-ee:S1_NO_SWITCH_UNVERIFIED",
                "Datasheet": "",
                "Description": "Normally-open carriage-mate switch S1. Closes only when fully seated. Not P08. MPN UNVERIFIED.",
                "ki_keywords": "S1 interlock UNVERIFIED",
                "MPN": "UNVERIFIED",
                "Manufacturer": "UNVERIFIED",
                "Revision": "UNVERIFIED",
                "License": "project lock",
                "Status": "UNVERIFIED",
                "MatingDirection": "UNVERIFIED",
            },
            in_bom="no",
        ),
        symbol(
            "S2_NO_BINDER_MATE_UNVERIFIED",
            "S",
            [("COM", "1", "passive"), ("NO", "2", "passive")],
            {
                "Footprint": "mantis-ee:S2_NO_SWITCH_UNVERIFIED",
                "Datasheet": "",
                "Description": "Normally-open binder-mate switch S2. MPN UNVERIFIED.",
                "ki_keywords": "S2 interlock UNVERIFIED",
                "MPN": "UNVERIFIED",
                "Manufacturer": "UNVERIFIED",
                "Revision": "UNVERIFIED",
                "License": "project lock",
                "Status": "UNVERIFIED",
                "MatingDirection": "UNVERIFIED",
            },
            in_bom="no",
        ),
        symbol(
            "Q1_LOADSWITCH_UNVERIFIED",
            "Q",
            [
                ("VIN", "1", "passive"),
                ("VOUT", "2", "passive"),
                ("EN", "3", "input"),
                ("GND", "4", "power_in"),
            ],
            {
                "Footprint": "mantis-ee:Q1_LOADSWITCH_UNVERIFIED",
                "Datasheet": "",
                "Description": "Per-carriage current-limited load switch Q1. Exact eFuse/load-switch MPN UNVERIFIED.",
                "ki_keywords": "Q1 eFuse UNVERIFIED",
                "MPN": "UNVERIFIED",
                "Manufacturer": "UNVERIFIED",
                "Revision": "UNVERIFIED",
                "License": "project lock",
                "Status": "UNVERIFIED",
                "MatingDirection": "n/a",
            },
            in_bom="no",
        ),
        symbol(
            "TACHYON_SBC_UNVERIFIED",
            "A",
            [
                ("CSI1", "1", "unspecified"),
                ("DSI_CSI2", "2", "unspecified"),
                ("QWIIC", "3", "unspecified"),
                ("USB1_PD", "4", "power_in"),
                ("HAT_5V", "5", "power_in"),
                ("VBAT", "6", "power_in"),
            ],
            {
                "Footprint": "",
                "Datasheet": "https://docs.particle.io/reference/datasheets/tachyon/tachyon-datasheet/",
                "Description": "Particle Tachyon board-level black box. Documented SKUs TACH4NA/TACH8NA/TACH8ROW; selected SKU UNVERIFIED. Envelope 85 x 56 x 18.5 mm. No board footprint in this library.",
                "ki_keywords": "Tachyon SBC UNVERIFIED",
                "MPN": "UNVERIFIED among TACH4NA TACH8NA TACH8ROW",
                "Manufacturer": "Particle",
                "Revision": "datasheet 2026-08-20 retrieval; pinout images V1.2",
                "License": "Particle documentation",
                "Status": "SKU-UNVERIFIED",
                "MatingDirection": "n/a",
            },
            in_bom="no",
        ),
    ]
    (SYMBOLS / "mantis-ee.kicad_sym").write_text("\n".join(chunks) + "\n)\n")
    return records


def write_footprints() -> None:
    files = {
        "TSSOP-24_PW_TI.kicad_mod": tssop24_pw(),
        "VQFN-24_RGE_TI.kicad_mod": vqfn24_rge(),
        "FPC-22_0.5mm_UNVERIFIED-MPN.kicad_mod": fpc22(),
        "JST-SH-4_1mm_UNVERIFIED-header-MPN.kicad_mod": qwiic(),
        "B27_RAIL_12NET_TARGET-2.54mm_UNVERIFIED-series.kicad_mod": rail12(
            "B27_RAIL_12NET_TARGET-2.54mm_UNVERIFIED-series",
            "P",
            "B27 12 lands. Pitch 2.54 mm TARGET and land 1.5 mm TARGET from params.json, not a released transmission line. Contact series UNVERIFIED. Paste none (exposed ENIG lands). Mask open. Height UNVERIFIED. Mating: carriage springs onto external rail; B20 keeps metal out of animal volume. Datum P01.",
        ),
        "B50_BINDER_12NET_UNVERIFIED-series.kicad_mod": rail12(
            "B50_BINDER_12NET_UNVERIFIED-series",
            "C",
            "B50 12 lands mirroring P01-P12. Series, impedance launch, mate order UNVERIFIED. Pitch copies B27 TARGET 2.54 mm as a drawing convenience only. Datum C01.",
        ),
        "S1_NO_SWITCH_UNVERIFIED.kicad_mod": switch_fp("S1_NO_SWITCH_UNVERIFIED"),
        "S2_NO_SWITCH_UNVERIFIED.kicad_mod": switch_fp("S2_NO_SWITCH_UNVERIFIED"),
        "Q1_LOADSWITCH_UNVERIFIED.kicad_mod": loadswitch_fp(),
        "MAX96717_PACKAGE_UNVERIFIED.kicad_mod": serdes_fp("MAX96717_PACKAGE_UNVERIFIED"),
        "MAX96724_PACKAGE_UNVERIFIED.kicad_mod": serdes_fp("MAX96724_PACKAGE_UNVERIFIED"),
    }
    for name, body in files.items():
        (FOOTPRINTS / name).write_text(body)


def pin_pad_rows() -> list[dict]:
    rows = []
    for name, num, _t in TCA9548A_PW:
        rows.append(
            {
                "symbol": "TCA9548A_PW",
                "pinName": name,
                "pinNumber": num,
                "footprint": "TSSOP-24_PW_TI",
                "pad": num,
                "status": "sourced",
                "source": "TI SCPS207H Table 4-1 TSSOP PW",
            }
        )
    for name, num, _t in TCA9548A_RGE:
        rows.append(
            {
                "symbol": "TCA9548A_RGE",
                "pinName": name,
                "pinNumber": num,
                "footprint": "VQFN-24_RGE_TI",
                "pad": num,
                "status": "sourced" if num != "25" else "UNVERIFIED",
                "source": "TI SCPS207H Table 4-1 VQFN RGE"
                if num != "25"
                else "EP not in Table 4-1; thermal pad only",
            }
        )
    for pin, net, _role, _geom in B27:
        rows.append(
            {
                "symbol": "B27_RAIL_12NET",
                "pinName": net,
                "pinNumber": pin,
                "net": net,
                "footprint": "B27_RAIL_12NET_TARGET-2.54mm_UNVERIFIED-series",
                "pad": pin,
                "status": "contract-sourced-series-UNVERIFIED",
                "source": "terrarium/bus.json contacts",
            }
        )
        cpin = "C" + pin[1:]
        rows.append(
            {
                "symbol": "B50_BINDER_12NET",
                "pinName": net,
                "pinNumber": cpin,
                "net": net,
                "footprint": "B50_BINDER_12NET_UNVERIFIED-series",
                "pad": cpin,
                "status": "mirror-of-B27-series-UNVERIFIED",
                "source": "BUS.md C01-C12 mirror P01-P12",
            }
        )
    for num, name, _t in CSI1:
        rows.append(
            {
                "symbol": "TACHYON_CSI1_22P",
                "pinName": name,
                "pinNumber": num,
                "footprint": "FPC-22_0.5mm_UNVERIFIED-MPN",
                "pad": num,
                "status": "pinout-sourced-MPN-UNVERIFIED",
                "source": "Particle tachyon-csi-pinout.jpg TACHYON V1.2",
            }
        )
    for num, name, _t in DSI_CSI2:
        rows.append(
            {
                "symbol": "TACHYON_DSI_CSI2_22P",
                "pinName": name,
                "pinNumber": num,
                "footprint": "FPC-22_0.5mm_UNVERIFIED-MPN",
                "pad": num,
                "status": "pinout-sourced-MPN-UNVERIFIED",
                "source": "Particle tachyon-csi-dsi-pinout.jpg TACHYON V1.2",
            }
        )
    for num, name, _t in QWIIC:
        rows.append(
            {
                "symbol": "QWIIC_4P_3V3",
                "pinName": name,
                "pinNumber": num,
                "footprint": "JST-SH-4_1mm_UNVERIFIED-header-MPN",
                "pad": num,
                "status": "nets-sourced-header-MPN-UNVERIFIED",
                "source": "SparkFun Qwiic pinout GND/3.3V/SDA/SCL; Particle 4-pin JST 1 mm",
            }
        )
    return rows


def write_lock() -> dict:
    artifacts = []
    for p in sorted(SOURCES.glob("*")):
        if p.is_file():
            artifacts.append(
                {
                    "path": str(p.relative_to(ROOT)),
                    "sha256": sha256(p),
                    "bytes": p.stat().st_size,
                }
            )
    lock = {
        "schema": "mantis.ee.kicad.sources.lock.v1",
        "retrievedAt": f"{RETRIEVED}T00:00:00Z",
        "issue": 23,
        "baseSha": "1e6683272e4e15d50dd90b60fd3f7c0f3dd5bbb3",
        "modelAttestation": {
            "requested": "Grok 4.5 non-fast",
            "thisRun": "cursor-grok-4.6-high",
            "fast": False,
            "operatorWaiver": True,
        },
        "sources": [
            {
                "id": "particle-tachyon-datasheet",
                "url": "https://docs.particle.io/reference/datasheets/tachyon/tachyon-datasheet/",
                "retrievedAt": RETRIEVED,
                "sha256": "906d8700b3928eb8204a4a8ad16c63abd1b7c7bcf802923b95f9aceadc5435d9",
                "license": "Particle documentation",
                "boundedUse": "85x56x18.5 mm; CSI 4-lane; Qwiic 3.3 V I2C; SKUs TACH4NA/TACH8NA/TACH8ROW; no rail power budget",
            },
            {
                "id": "particle-cameras",
                "url": "https://developer.particle.io/tachyon/device-details/cameras",
                "retrievedAt": RETRIEVED,
                "sha256": "e32bea3ade6442d24e1d5e865befe81208d2bbd495a1167762a7a276179eb96e",
                "license": "Particle documentation",
                "boundedUse": "IMX519 AF and S5K3P9SX supported; 22-pin 0.5 mm; RPi camera modules not assumed; GPIO 68",
            },
            {
                "id": "particle-csi1-pinout-image",
                "url": "https://developer.particle.io/img/tachyon-csi-pinout.jpg",
                "retrievedAt": RETRIEVED,
                "sha256": "be924e2f3b6e8ff1bbbb90602caceb4dd9833f965491659bcbd6de0a14a24c53",
                "license": "Particle documentation image",
                "boundedUse": "CSI1 22-pin names on TACHYON V1.2 photograph",
            },
            {
                "id": "particle-dsi-csi2-pinout-image",
                "url": "https://developer.particle.io/img/tachyon-csi-dsi-pinout.jpg",
                "retrievedAt": RETRIEVED,
                "sha256": "8507704ff50143872a38ade3fe746176410e3ddefa4cf0f568d8dd48d7c3b8a0",
                "license": "Particle documentation image",
                "boundedUse": "DSI/CSI2 22-pin names on TACHYON V1.2 photograph",
            },
            {
                "id": "ti-tca9548a-revH",
                "url": "https://www.ti.com/lit/ds/symlink/tca9548a.pdf",
                "retrievedAt": RETRIEVED,
                "sha256": "2137822fd7128945ea44e83f4e100a932b30964d763715eeffe217ee6080a2dc",
                "license": "Texas Instruments datasheet; facts used, PDF not redistributed",
                "boundedUse": "Pin Table 4-1; PW/RGE land patterns; Active orderables including TCA9548APWR and TCA9548ARGER",
            },
            {
                "id": "sparkfun-qwiic",
                "url": "https://www.sparkfun.com/qwiic",
                "retrievedAt": RETRIEVED,
                "license": "SparkFun published Qwiic rules",
                "boundedUse": "Pinout GND/3.3V/SDA/SCL; cable housing SHR-04V-S",
            },
            {
                "id": "particle-qwiic",
                "url": "https://docs.particle.io/hardware/expansion/qwiic/",
                "retrievedAt": RETRIEVED,
                "sha256": "508c8d77c6d24a91565a4f8cccb7d23f74d94ef4bb4f1017ce5472850bcbef39",
                "license": "Particle documentation",
                "boundedUse": "Qwiic is 3.3 V I2C over 4-pin JST 1 mm keyed",
            },
            {
                "id": "adi-max96717",
                "url": "https://www.analog.com/en/products/max96717.html",
                "retrievedAt": RETRIEVED,
                "status": "UNVERIFIED",
                "note": "HTTP timeout this run. Capability claims remain those already bounded in terrarium/SOURCES.md. No pad map.",
            },
            {
                "id": "adi-max96724",
                "url": "https://www.analog.com/en/products/max96724.html",
                "retrievedAt": RETRIEVED,
                "status": "UNVERIFIED",
                "note": "HTTP timeout this run. No pad map.",
            },
        ],
        "artifacts": artifacts,
        "threeDModels": {
            "status": "UNVERIFIED",
            "note": "No vendor STEP/WRL retrieved. Footprints omit model paths rather than inventing geometry.",
        },
    }
    (ROOT / "sources.lock.json").write_text(json.dumps(lock, indent=2) + "\n")
    return lock


def write_smoke() -> None:
    sch = """(kicad_sch (version 20230121) (generator mantis-ee-23)
  (uuid 23ee0000-0000-4000-8000-000000000001)
  (paper "A3")
  (title_block
    (title "Mantis EE-01 library smoke")
    (date "2026-08-20")
    (rev "B-draft")
    (comment 1 "Issue 23. Theoretical. Not for fabrication.")
    (comment 2 "ERC of unconnected pins is expected until kicad-cli is in the runtime.")
  )
)
"""
    pro = """{
  "board": { "design_settings": {} },
  "meta": { "filename": "mantis-ee-lib-smoke.kicad_pro", "version": 1 },
  "sheets": [ ["mantis-ee-lib-smoke.kicad_sch", "23ee0000-0000-4000-8000-000000000001"] ],
  "text_variables": {},
  "libraries": {
    "pinned_symbol_libs": ["mantis-ee"],
    "pinned_fp_libs": ["mantis-ee"]
  }
}
"""
    (SMOKE / "mantis-ee-lib-smoke.kicad_sch").write_text(sch)
    (SMOKE / "mantis-ee-lib-smoke.kicad_pro").write_text(pro)
    (SMOKE / "fp-lib-table").write_text(
        '(fp_lib_table\n  (lib (name "mantis-ee")(type "KiCad")(uri "${KIPRJMOD}/../footprints/mantis-ee.pretty")(options "")(descr "Mantis EE-01"))\n)\n'
    )
    (SMOKE / "sym-lib-table").write_text(
        '(sym_lib_table\n  (lib (name "mantis-ee")(type "KiCad")(uri "${KIPRJMOD}/../symbols/mantis-ee.kicad_sym")(options "")(descr "Mantis EE-01"))\n)\n'
    )


def main() -> None:
    SYMBOLS.mkdir(parents=True, exist_ok=True)
    FOOTPRINTS.mkdir(parents=True, exist_ok=True)
    MODELS.mkdir(parents=True, exist_ok=True)
    SMOKE.mkdir(parents=True, exist_ok=True)
    write_symbols()
    write_footprints()
    rows = pin_pad_rows()
    audit = {
        "schema": "mantis.ee.kicad.pin-pad-audit.v1",
        "issue": 23,
        "retrievedAt": RETRIEVED,
        "reviewer": "UNVERIFIED-second-reviewer",
        "rows": rows,
    }
    (ROOT / "pin-pad-audit.json").write_text(json.dumps(audit, indent=2) + "\n")
    write_lock()
    write_smoke()
    (MODELS / "README.md").write_text(
        "# 3D models\n\nStatus: `UNVERIFIED`.\n\n"
        "No vendor STEP or WRL was retrieved for Tachyon, TCA9548A, Qwiic, "
        "B27/B50, or SerDes packages. Footprints therefore omit model paths. "
        "Do not treat an empty models directory as a released CAD envelope.\n"
    )
    print(f"wrote {len(rows)} pin-pad rows")


if __name__ == "__main__":
    main()
