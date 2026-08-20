#!/usr/bin/env python3
"""Emit the issue-26 characterization fixture KiCad project.

Reads terrarium/ee/kicad/libs (does not rewrite it). Consumes #24/#25 net names.
Does not invent MPNs. MIPI stays local to courtyard-only SerDes envelopes.
Complete coupon: ser launch, B50, carriage, B27/B19, receiver, adjacent power,
S1/S2/Q1, cal/OSL, safe fault insertion. PROTO-FAB DRAFT / UNQUALIFIED.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from kicad_emit import (  # noqa: E402
    B19_PADS,
    B27_PADS,
    B50_PADS,
    GENERIC_PINS_2,
    GENERIC_PINS_TP,
    JMP_PADS,
    LIB,
    MARKING,
    Q1_PADS,
    R2_PADS,
    S1_PADS,
    SILK_CLASS,
    TP_PADS,
    courtyard_only,
    extract_symbol,
    footprint,
    generic_tp,
    generic_two_pin,
    instance,
    lib_tables,
    pcb_file,
    pin_coords,
    project_file,
    root_sheet,
    sheet_file,
    text,
    track,
    uid,
)

HERE = Path(__file__).resolve().parents[1]
KICAD = HERE.parent
TERR = HERE.parents[2]
PC_NETMAP = KICAD / "power-control" / "net-map.json"
CAM_NETMAP = KICAD / "camera-tx" / "net-map.json"
CAR_NETMAP = KICAD / "carriage" / "net-map.json"
RX_NETMAP = KICAD / "rail-rx" / "net-map.json"

COMMENT = (
    "P08 diagnostic only. MIPI local to SerDes courtyard. GMSL on C09-C12/P09-P12 only. "
    "#23 envelopes, no invented MPN. PROTO-FAB UNQUALIFIED."
)

# Consumed #25 B27/B50 names. Coupon nets are prefixed so structures do not load each other.
B27_ROLES = {
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
B50_ROLES = {f"C{i:02d}": role for i, role in enumerate(B27_ROLES.values(), 1)}


def prefixed(prefix: str, roles: dict[str, str], vbranch_c01c02: bool = False) -> dict[str, str]:
    out = {pin: f"{prefix}_{role}" for pin, role in roles.items()}
    if vbranch_c01c02:
        out["C01"] = f"{prefix}_V_BRANCH"
        out["C02"] = f"{prefix}_V_BRANCH"
    return out


CAL50 = prefixed("CAL50", B50_ROLES)
CAL27 = prefixed("CAL27", B27_ROLES)
OSL_OPEN = prefixed("OSL_OPEN", B50_ROLES)
OSL_SHORT = prefixed("OSL_SHORT", B50_ROLES)
OSL_LOAD = prefixed("OSL_LOAD", B50_ROLES)
SER = prefixed("SER", B50_ROLES, vbranch_c01c02=True)
B50ONLY = prefixed("B50ONLY", B50_ROLES, vbranch_c01c02=True)
CAR = prefixed("CAR", B27_ROLES)
CAR_B50 = prefixed("CAR", B50_ROLES, vbranch_c01c02=True)
B19 = prefixed("B19", B27_ROLES)
RX = prefixed("RX", B27_ROLES)
FULL_B50 = prefixed("FULL", B50_ROLES, vbranch_c01c02=True)
FULL_B27 = prefixed("FULL", B27_ROLES)
# Full path: B50 C01/C02 are V_BRANCH after Q1; B27 P01/P02 remain VIN_A/VIN_B.
FULL_B50["C01"] = "FULL_V_BRANCH"
FULL_B50["C02"] = "FULL_V_BRANCH"

WANTED = [
    "MAX96717_GMSL2_SER_UNVERIFIED",
    "MAX96724_GMSL2_DES_UNVERIFIED",
    "B50_BINDER_12NET",
    "B27_RAIL_12NET",
    "S1_NO_CARRIAGE_MATE_UNVERIFIED",
    "S2_NO_BINDER_MATE_UNVERIFIED",
    "Q1_LOADSWITCH_UNVERIFIED",
]


def load_lib() -> str:
    if not LIB.is_file():
        raise SystemExit(f"EE-01 library missing (read-only dependency): {LIB}")
    return LIB.read_text()


def consume_parents() -> dict:
    missing = [p for p in (PC_NETMAP, CAM_NETMAP, CAR_NETMAP, RX_NETMAP) if not p.is_file()]
    if missing:
        raise SystemExit(f"parent net-maps missing (read-only consume): {missing}")
    return {
        "power-control": json.loads(PC_NETMAP.read_text()),
        "camera-tx": json.loads(CAM_NETMAP.read_text()),
        "carriage": json.loads(CAR_NETMAP.read_text()),
        "rail-rx": json.loads(RX_NETMAP.read_text()),
    }


def generics() -> str:
    return "\n".join(
        [
            generic_two_pin("R_UNVERIFIED", "R", "UNVERIFIED resistor envelope. No invented MPN."),
            generic_two_pin("C_UNVERIFIED", "C", "UNVERIFIED capacitor envelope. No invented MPN."),
            generic_two_pin("F1_UNVERIFIED", "F", "UNVERIFIED fuse envelope. BOM B44 TARGET 2 A."),
            generic_two_pin("DISCHARGE_UNVERIFIED", "D", "UNVERIFIED branch discharge. MPN missing."),
            generic_two_pin("ISO_UNVERIFIED", "U", "UNVERIFIED low-speed isolation. MPN missing."),
            generic_two_pin("JMP_FAULT_UNVERIFIED", "K", "Safe fault-insert jumper. Default open. Human approval required."),
            generic_two_pin("R_SRC_UNVERIFIED", "R", "Programmable source-impedance envelope. Sweep UNVERIFIED."),
            generic_two_pin("C_LOAD_UNVERIFIED", "C", "Binder/carriage load capacitance envelope. Sweep UNVERIFIED."),
            generic_tp(),
        ]
    )


def emit_cal(lib_syms: str, pins: dict) -> str:
    body = "\n".join(
        [
            instance("mantis-ee:B50_BINDER_12NET", "J50_CAL_A", "B50_BINDER_12NET", 50.0, 40.0, "j50cala", pins["B50_BINDER_12NET"], CAL50),
            instance("mantis-ee:B50_BINDER_12NET", "J50_CAL_B", "B50_BINDER_12NET", 160.0, 40.0, "j50calb", pins["B50_BINDER_12NET"], CAL50),
            instance("mantis-ee:B27_RAIL_12NET", "J27_CAL_A", "B27_RAIL_12NET", 50.0, 95.0, "j27cala", pins["B27_RAIL_12NET"], CAL27),
            instance("mantis-ee:B27_RAIL_12NET", "J27_CAL_B", "B27_RAIL_12NET", 160.0, 95.0, "j27calb", pins["B27_RAIL_12NET"], CAL27),
            instance("mantis-ee:B50_BINDER_12NET", "J50_OPEN", "B50_BINDER_12NET", 250.0, 40.0, "j50open", pins["B50_BINDER_12NET"], OSL_OPEN),
            instance("mantis-ee:B50_BINDER_12NET", "J50_SHORT", "B50_BINDER_12NET", 250.0, 95.0, "j50short", pins["B50_BINDER_12NET"], OSL_SHORT),
            instance("mantis-ee:B50_BINDER_12NET", "J50_LOAD", "B50_BINDER_12NET", 330.0, 40.0, "j50load", pins["B50_BINDER_12NET"], OSL_LOAD),
            instance("fx-generic:R_UNVERIFIED", "R_LOAD", "R_UNVERIFIED", 330.0, 95.0, "rload", GENERIC_PINS_2, {"1": "OSL_LOAD_GMSL_P", "2": "OSL_LOAD_GMSL_N"}),
            instance("fx-generic:R_UNVERIFIED", "R_SHORT", "R_UNVERIFIED", 280.0, 95.0, "rshort", GENERIC_PINS_2, {"1": "OSL_SHORT_GMSL_P", "2": "OSL_SHORT_GMSL_N"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_CAL50_P", "TP_UNVERIFIED", 50.0, 145.0, "tpcal50p", GENERIC_PINS_TP, {"1": "CAL50_GMSL_P"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_CAL50_N", "TP_UNVERIFIED", 70.0, 145.0, "tpcal50n", GENERIC_PINS_TP, {"1": "CAL50_GMSL_N"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_CAL27_P", "TP_UNVERIFIED", 90.0, 145.0, "tpcal27p", GENERIC_PINS_TP, {"1": "CAL27_GMSL_P"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_CAL27_N", "TP_UNVERIFIED", 110.0, 145.0, "tpcal27n", GENERIC_PINS_TP, {"1": "CAL27_GMSL_N"}),
            text(
                "2x-thru B50 and B27 plus SOL at the B50 plane. RF adapter MPN UNVERIFIED; SOLT blocked until selected.\\n"
                "Intervening pair is the TARGET carriage length placeholder. Do not simplify P01-P08 off the coupon.\\n"
                "R_LOAD is TARGET 100 ohm GMSL (from #25 placeholder), MPN UNVERIFIED, DNP. Short is GMSL+ to GMSL- at the plane.\\n"
                "No measured SI. No SMA/2.92 footprint invented.",
                25.4,
                165.0,
                "cal-note",
            ),
        ]
    )
    return sheet_file(
        "Cal 2x-thru and OSL",
        "2",
        lib_syms + "\n" + generics(),
        body,
        "sheet:01-cal-2xthru-osl",
        COMMENT,
    )


def emit_ser(lib_syms: str, pins: dict) -> str:
    ser_nets = {
        "B1": "SER_GMSL_P",
        "B2": "SER_GMSL_N",
        "P1": "SER_VDD",
        "P2": "SER_GND",
    }
    csi_nc = [f"A{i}" for i in range(1, 11)]
    body = "\n".join(
        [
            instance(
                "mantis-ee:MAX96717_GMSL2_SER_UNVERIFIED",
                "U_SER",
                "MAX96717_GMSL2_SER_UNVERIFIED",
                70.0,
                70.0,
                "user",
                pins["MAX96717_GMSL2_SER_UNVERIFIED"],
                ser_nets,
                noconnects=csi_nc,
            ),
            instance("mantis-ee:B50_BINDER_12NET", "J50_SER", "B50_BINDER_12NET", 180.0, 70.0, "j50ser", pins["B50_BINDER_12NET"], SER),
            text(
                "Serializer launch reference plane. MAX96717 pad map UNVERIFIED: courtyard only on PCB.\\n"
                "CSI pins no-connect on this coupon. Raw MIPI does not appear on B50. C01/C02 are V_BRANCH after Q1.\\n"
                "GMSL+ / GMSL- only on C10/C11. HSGND on C09/C12. Adjacent C01-C08 lands are present, not omitted.\\n"
                "IMX519 is not stuffed on the coupon. Camera SKU UNVERIFIED.",
                25.4,
                145.0,
                "ser-note",
            ),
        ]
    )
    return sheet_file(
        "Serializer launch reference plane and B50",
        "3",
        lib_syms,
        body,
        "sheet:02-ser-launch-refplane",
        COMMENT,
    )


def emit_b50(lib_syms: str, pins: dict) -> str:
    body = "\n".join(
        [
            instance("mantis-ee:B50_BINDER_12NET", "J50_KEY_A", "B50_BINDER_12NET", 70.0, 70.0, "j50keya", pins["B50_BINDER_12NET"], B50ONLY),
            instance("mantis-ee:B50_BINDER_12NET", "J50_KEY_B", "B50_BINDER_12NET", 180.0, 70.0, "j50keyb", pins["B50_BINDER_12NET"], B50ONLY),
            text(
                "B50-only keyed coupon. Plug and receptacle are the same UNVERIFIED series envelope (#23).\\n"
                "Complete 12-net including C01-C08 adjacent power/control and C09-C12 high-speed cell.\\n"
                "C01/C02 are V_BRANCH after Q1, not a VIN_A bypass. Series / key / impedance UNVERIFIED.",
                25.4,
                145.0,
                "b50-note",
            ),
        ]
    )
    return sheet_file(
        "B50-only keyed interface",
        "4",
        lib_syms,
        body,
        "sheet:03-b50-only",
        COMMENT,
    )


def emit_car(lib_syms: str, pins: dict) -> str:
    body = "\n".join(
        [
            instance("mantis-ee:B50_BINDER_12NET", "J50_CAR", "B50_BINDER_12NET", 70.0, 70.0, "j50car", pins["B50_BINDER_12NET"], CAR_B50),
            instance("mantis-ee:B27_RAIL_12NET", "J27_CAR", "B27_RAIL_12NET", 180.0, 70.0, "j27car", pins["B27_RAIL_12NET"], CAR),
            text(
                "Carriage route coupon. Complete 12-net stitch. High-speed cell C09-C12 / P09-P12 only.\\n"
                "Serialized video only. Raw MIPI is not on this coupon. Untethered: no extra cable connector.\\n"
                "GMSL tracks are TARGET 100 ohm placeholders. Width/gap/stackup UNVERIFIED. Not measured SI.",
                25.4,
                145.0,
                "car-note",
            ),
        ]
    )
    return sheet_file(
        "Carriage B50-to-B27 route",
        "5",
        lib_syms,
        body,
        "sheet:04-carriage-route",
        COMMENT,
    )


def emit_b19(lib_syms: str, pins: dict) -> str:
    body = "\n".join(
        [
            instance("mantis-ee:B27_RAIL_12NET", "J27_B19", "B27_RAIL_12NET", 70.0, 55.0, "j27b19", pins["B27_RAIL_12NET"], B19),
            instance("mantis-ee:B27_RAIL_12NET", "J19_LANDS", "B19_LANDS_TARGET", 180.0, 55.0, "j19lands", pins["B27_RAIL_12NET"], B19),
            instance("fx-generic:TP_UNVERIFIED", "TP_B19_COMP", "TP_UNVERIFIED", 70.0, 120.0, "tpb19c", GENERIC_PINS_TP, {"1": "B19_HSGND"}),
            text(
                "B27-only structure with B19 lands. Same TARGET 2.54 mm / 1.5 mm land as #23 (status target).\\n"
                "P01-P08 continuous electrode geometry is adjacent, not omitted. P09/P12 are RF returns (HSGND).\\n"
                "Compression / contact travel UNVERIFIED (#29 draft, read-only). Stack-up UNVERIFIED (BOM B19).\\n"
                "B19 lands are not animal-side metal. B20 remains the wet-side barrier. No conductor into wet volume.",
                25.4,
                145.0,
                "b19-note",
            ),
        ]
    )
    return sheet_file(
        "B27-only with B19 lands and adjacent P01-P08",
        "6",
        lib_syms + "\n" + generic_tp(),
        body,
        "sheet:05-b27-b19",
        COMMENT,
    )


def emit_rx(lib_syms: str, pins: dict) -> str:
    des_nets = {
        "B1": "RX_GMSL_P",
        "B2": "RX_GMSL_N",
        "P1": "RX_VDD",
        "P2": "RX_GND",
    }
    csi_nc = [f"A{i}" for i in range(1, 11)]
    body = "\n".join(
        [
            instance("mantis-ee:B27_RAIL_12NET", "J27_RX", "B27_RAIL_12NET", 70.0, 70.0, "j27rx", pins["B27_RAIL_12NET"], RX),
            instance(
                "mantis-ee:MAX96724_GMSL2_DES_UNVERIFIED",
                "U_DES",
                "MAX96724_GMSL2_DES_UNVERIFIED",
                180.0,
                70.0,
                "udes",
                pins["MAX96724_GMSL2_DES_UNVERIFIED"],
                des_nets,
                noconnects=csi_nc,
            ),
            text(
                "Receiver launch reference plane. MAX96724 pad map UNVERIFIED: courtyard only on PCB.\\n"
                "CSI pins no-connect. Local MIPI to Tachyon CSI1 is not on B27. Connector MPN UNVERIFIED.\\n"
                "Indexed dock. Family is quad; envelope exposes one GMSL input. Do not invent three more.\\n"
                "P01-P08 adjacent power/control present. Video-while-rolling is out of v1.",
                25.4,
                145.0,
                "rx-note",
            ),
        ]
    )
    return sheet_file(
        "Receiver launch reference plane and B27 dock",
        "7",
        lib_syms,
        body,
        "sheet:06-rx-launch-refplane",
        COMMENT,
    )


def emit_full(lib_syms: str, pins: dict) -> str:
    ser_nets = {"B1": "FULL_GMSL_P", "B2": "FULL_GMSL_N", "P1": "FULL_VDD_SER", "P2": "FULL_GND"}
    des_nets = {"B1": "FULL_GMSL_P", "B2": "FULL_GMSL_N", "P1": "FULL_VDD_DES", "P2": "FULL_GND"}
    csi_nc = [f"A{i}" for i in range(1, 11)]
    body = "\n".join(
        [
            instance(
                "mantis-ee:MAX96717_GMSL2_SER_UNVERIFIED",
                "U_SER_FULL",
                "MAX96717_GMSL2_SER_UNVERIFIED",
                40.0,
                55.0,
                "userf",
                pins["MAX96717_GMSL2_SER_UNVERIFIED"],
                ser_nets,
                noconnects=csi_nc,
            ),
            instance("mantis-ee:B50_BINDER_12NET", "J50_FULL", "B50_BINDER_12NET", 120.0, 55.0, "j50full", pins["B50_BINDER_12NET"], FULL_B50),
            instance("mantis-ee:B27_RAIL_12NET", "J27_FULL_CAR", "B27_RAIL_12NET", 200.0, 55.0, "j27fullcar", pins["B27_RAIL_12NET"], FULL_B27),
            instance("mantis-ee:B27_RAIL_12NET", "J27_FULL_RX", "B27_RAIL_12NET", 280.0, 55.0, "j27fullrx", pins["B27_RAIL_12NET"], FULL_B27),
            instance("mantis-ee:B27_RAIL_12NET", "J19_FULL", "B19_LANDS_TARGET", 200.0, 115.0, "j19full", pins["B27_RAIL_12NET"], FULL_B27),
            instance(
                "mantis-ee:MAX96724_GMSL2_DES_UNVERIFIED",
                "U_DES_FULL",
                "MAX96724_GMSL2_DES_UNVERIFIED",
                340.0,
                55.0,
                "udesf",
                pins["MAX96724_GMSL2_DES_UNVERIFIED"],
                des_nets,
                noconnects=csi_nc,
            ),
            text(
                "Complete path: serializer launch -> B50 -> carriage route -> B27 -> B19 lands -> receiver launch.\\n"
                "Active-device pins replaced by courtyard reference planes. Intervening 12-net geometry is not simplified.\\n"
                "MIPI stays local (no-connect on this coupon). Video-while-rolling out of v1. Untethered.\\n"
                "This cascade does not mark the physical interface qualified.",
                25.4,
                155.0,
                "full-note",
            ),
        ]
    )
    return sheet_file(
        "Full B50-carriage-B27-B19-receiver channel",
        "8",
        lib_syms,
        body,
        "sheet:07-full-channel",
        COMMENT,
    )


def emit_power(lib_syms: str, pins: dict) -> str:
    body = "\n".join(
        [
            instance("fx-generic:R_SRC_UNVERIFIED", "R_SRC", "R_SRC_UNVERIFIED", 30.0, 35.0, "rsrc", GENERIC_PINS_2, {"1": "VIN_RAIL", "2": "VIN_FUSED_PRE"}),
            instance("fx-generic:F1_UNVERIFIED", "F1", "F1_UNVERIFIED", 55.0, 35.0, "f1", GENERIC_PINS_2, {"1": "VIN_FUSED_PRE", "2": "VIN_FUSED"}),
            instance("mantis-ee:B27_RAIL_12NET", "J27_PWR", "B27_RAIL_12NET", 110.0, 40.0, "j27pwr", pins["B27_RAIL_12NET"], {
                "P01": "VIN_A", "P02": "VIN_B", "P03": "GND_A", "P04": "GND_B",
                "P05": "SDA", "P06": "SCL", "P07": "UID", "P08": "FAULT_N",
                "P09": "HSGND", "P10": "GMSL_P", "P11": "GMSL_N", "P12": "HSGND",
            }),
            instance("fx-generic:R_UNVERIFIED", "R_VIN_B", "R_UNVERIFIED", 230.0, 35.0, "rvinb", GENERIC_PINS_2, {"1": "VIN_FUSED", "2": "VIN_B"}),
            instance("fx-generic:R_UNVERIFIED", "R_SHARE_A", "R_UNVERIFIED", 250.0, 35.0, "rsha", GENERIC_PINS_2, {"1": "VIN_A", "2": "VIN_SHARED"}),
            instance("fx-generic:R_UNVERIFIED", "R_SHARE_B", "R_UNVERIFIED", 270.0, 35.0, "rshb", GENERIC_PINS_2, {"1": "VIN_B", "2": "VIN_SHARED"}),
            instance("fx-generic:R_UNVERIFIED", "R_GND_A", "R_UNVERIFIED", 290.0, 35.0, "rgnda", GENERIC_PINS_2, {"1": "GND_A", "2": "GND"}),
            instance("fx-generic:R_UNVERIFIED", "R_GND_B", "R_UNVERIFIED", 310.0, 35.0, "rgndb", GENERIC_PINS_2, {"1": "GND_B", "2": "GND"}),
            instance("mantis-ee:B50_BINDER_12NET", "J50_PWR", "B50_BINDER_12NET", 200.0, 40.0, "j50pwr", pins["B50_BINDER_12NET"], {
                "C01": "V_BRANCH", "C02": "V_BRANCH", "C03": "GND_A", "C04": "GND_B",
                "C05": "SDA", "C06": "SCL", "C07": "UID", "C08": "FAULT_N",
                "C09": "HSGND", "C10": "GMSL_P", "C11": "GMSL_N", "C12": "HSGND",
            }),
            instance("mantis-ee:S1_NO_CARRIAGE_MATE_UNVERIFIED", "S1", "S1_NO_CARRIAGE_MATE_UNVERIFIED", 40.0, 95.0, "s1", pins["S1_NO_CARRIAGE_MATE_UNVERIFIED"], {"1": "S1_COM", "2": "INTERLOCK_MID"}),
            instance("mantis-ee:S2_NO_BINDER_MATE_UNVERIFIED", "S2", "S2_NO_BINDER_MATE_UNVERIFIED", 90.0, 95.0, "s2", pins["S2_NO_BINDER_MATE_UNVERIFIED"], {"1": "S2_COM", "2": "INTERLOCK_OK"}),
            instance("mantis-ee:Q1_LOADSWITCH_UNVERIFIED", "Q1A", "Q1_LOADSWITCH_UNVERIFIED", 140.0, 95.0, "q1a", pins["Q1_LOADSWITCH_UNVERIFIED"], {"1": "Q1A_VIN", "2": "Q1_MID", "3": "Q1_EN", "4": "GND"}),
            instance("mantis-ee:Q1_LOADSWITCH_UNVERIFIED", "Q1B", "Q1_LOADSWITCH_UNVERIFIED", 190.0, 95.0, "q1b", pins["Q1_LOADSWITCH_UNVERIFIED"], {"1": "Q1_MID", "2": "V_BRANCH", "3": "Q1_EN", "4": "GND"}),
            instance("fx-generic:DISCHARGE_UNVERIFIED", "D_DIS", "DISCHARGE_UNVERIFIED", 240.0, 95.0, "ddis", GENERIC_PINS_2, {"1": "V_BRANCH", "2": "DISCH_SRC"}),
            instance("fx-generic:ISO_UNVERIFIED", "U_ISO", "ISO_UNVERIFIED", 270.0, 95.0, "uiso", GENERIC_PINS_2, {"1": "SDA", "2": "SDA_BR"}),
            instance("fx-generic:C_LOAD_UNVERIFIED", "C_LOAD", "C_LOAD_UNVERIFIED", 300.0, 95.0, "cload", GENERIC_PINS_2, {"1": "V_BRANCH", "2": "GND"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_VIN", "TP_UNVERIFIED", 30.0, 140.0, "tpvin", GENERIC_PINS_TP, {"1": "VIN_RAIL"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_VBR", "TP_UNVERIFIED", 50.0, 140.0, "tpvbr", GENERIC_PINS_TP, {"1": "V_BRANCH"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_IBR", "TP_UNVERIFIED", 70.0, 140.0, "tpibr", GENERIC_PINS_TP, {"1": "Q1_MID"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_S1", "TP_UNVERIFIED", 90.0, 140.0, "tps1", GENERIC_PINS_TP, {"1": "INTERLOCK_MID"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_S2", "TP_UNVERIFIED", 110.0, 140.0, "tps2", GENERIC_PINS_TP, {"1": "INTERLOCK_OK"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_Q1EN", "TP_UNVERIFIED", 130.0, 140.0, "tpq1en", GENERIC_PINS_TP, {"1": "Q1_EN"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_Q1OUT", "TP_UNVERIFIED", 150.0, 140.0, "tpq1out", GENERIC_PINS_TP, {"1": "V_BRANCH"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_DIS", "TP_UNVERIFIED", 170.0, 140.0, "tpdis", GENERIC_PINS_TP, {"1": "Q1_EN_N"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_FLT", "TP_UNVERIFIED", 190.0, 140.0, "tpflt", GENERIC_PINS_TP, {"1": "P08_DIAG"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_LOCK", "TP_UNVERIFIED", 210.0, 140.0, "tplock", GENERIC_PINS_TP, {"1": "LINK_LOCK_OBS"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_ISO", "TP_UNVERIFIED", 230.0, 140.0, "tpiso", GENERIC_PINS_TP, {"1": "ISO_EN"}),
            instance("fx-generic:TP_UNVERIFIED", "TP_AON", "TP_UNVERIFIED", 250.0, 140.0, "tpaon", GENERIC_PINS_TP, {"1": "VIN_AON"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_S1_OPEN", "JMP_FAULT_UNVERIFIED", 30.0, 175.0, "ks1o", GENERIC_PINS_2, {"1": "VIN_AON", "2": "S1_COM"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_S1_WELD", "JMP_FAULT_UNVERIFIED", 55.0, 175.0, "ks1w", GENERIC_PINS_2, {"1": "VIN_AON", "2": "INTERLOCK_MID"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_S2_OPEN", "JMP_FAULT_UNVERIFIED", 80.0, 175.0, "ks2o", GENERIC_PINS_2, {"1": "INTERLOCK_MID", "2": "S2_COM"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_S2_WELD", "JMP_FAULT_UNVERIFIED", 105.0, 175.0, "ks2w", GENERIC_PINS_2, {"1": "INTERLOCK_MID", "2": "INTERLOCK_OK"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_Q1_OPEN", "JMP_FAULT_UNVERIFIED", 130.0, 175.0, "kq1o", GENERIC_PINS_2, {"1": "VIN_SHARED", "2": "Q1A_VIN"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_Q1_SHORT", "JMP_FAULT_UNVERIFIED", 155.0, 175.0, "kq1s", GENERIC_PINS_2, {"1": "VIN_SHARED", "2": "V_BRANCH"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_DIS_OPEN", "JMP_FAULT_UNVERIFIED", 180.0, 175.0, "kdis", GENERIC_PINS_2, {"1": "DISCH_SRC", "2": "GND"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_VINA_OPEN", "JMP_FAULT_UNVERIFIED", 205.0, 175.0, "kvina", GENERIC_PINS_2, {"1": "VIN_FUSED", "2": "VIN_A"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_GNDA_OPEN", "JMP_FAULT_UNVERIFIED", 230.0, 175.0, "kgnda", GENERIC_PINS_2, {"1": "GND", "2": "GND_A"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_UID_INJ", "JMP_FAULT_UNVERIFIED", 255.0, 175.0, "kuid", GENERIC_PINS_2, {"1": "UID", "2": "INJ_UID"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_P08_INJ", "JMP_FAULT_UNVERIFIED", 280.0, 175.0, "kp08", GENERIC_PINS_2, {"1": "FAULT_N", "2": "INJ_P08"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_I2C_INJ", "JMP_FAULT_UNVERIFIED", 305.0, 175.0, "ki2c", GENERIC_PINS_2, {"1": "SDA", "2": "INJ_SDA"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_PARTIAL", "JMP_FAULT_UNVERIFIED", 330.0, 175.0, "kpart", GENERIC_PINS_2, {"1": "S1_PARTIAL", "2": "INTERLOCK_MID"}),
            instance("fx-generic:JMP_FAULT_UNVERIFIED", "K_BROWNOUT", "JMP_FAULT_UNVERIFIED", 355.0, 175.0, "kbo", GENERIC_PINS_2, {"1": "VIN_RAIL", "2": "VIN_BROWNOUT"}),
            text(
                "Power/motion-fault fixture. Consumes #24 nets. Dual-channel Q1A/Q1B, discharge, ISO remain #24 truth table.\\n"
                "VIN_AON is always-on supervisor (not V_BRANCH). P08/UID/I2C cannot force Q1 on. Probe TPs listed above.\\n"
                "Fault jumpers default OPEN (DNP). Series OPEN links break S1/S2/Q1/discharge; WELD/SHORT are parallel. Safe default is branch-off.\\n"
                "One fault at a time. Current-limited VIN. Human approval before energize, inject, or stuff a weld jumper.\\n"
                "LINK_LOCK_OBS is a reserved probe. SerDes lock pin map UNVERIFIED; do not invent a lock pin.\\n"
                "MIPI is not injected onto P10/P11. GMSL_P/GMSL_N belong to the channel coupons, not this power path.",
                25.4,
                205.0,
                "pwr-note",
            ),
        ]
    )
    return sheet_file(
        "Power S1/S2/Q1 AON discharge ISO probes and fault insert",
        "9",
        lib_syms + "\n" + generics(),
        body,
        "sheet:08-power-s1s2q1-fault",
        COMMENT,
    )


def stitch_12(src_pads, src_xy, dst_pads, dst_xy, pin_pairs, net_ids, tag) -> list[str]:
    x0, y0 = src_xy
    x1, y1 = dst_xy
    out = []
    for a, b, net in pin_pairs:
        out.append(
            track(
                x0 + src_pads[a][0],
                y0,
                x1 + dst_pads[b][0],
                y1,
                net_ids[net],
                f"{tag}-{a}-{b}",
            )
        )
    return out


def emit_pcb(net_ids: dict[str, int], nets: list[str]) -> str:
    fps = []
    tr = []

    def fp_b50(ref, x, y, tag, pad_nets):
        fps.append(footprint("mantis-ee:B50_BINDER_12NET_UNVERIFIED-series", ref, x, y, tag, B50_PADS, pad_nets, net_ids))

    def fp_b27(ref, x, y, tag, pad_nets, lib="mantis-ee:B27_RAIL_12NET_TARGET-2.54mm_UNVERIFIED-series"):
        fps.append(footprint(lib, ref, x, y, tag, B27_PADS if "B27" in lib or "B19" not in lib else B19_PADS, pad_nets, net_ids))

    # Row 1: cal + OSL
    fp_b50("J50_CAL_A", 30.0, 20.0, "pj50cala", CAL50)
    fp_b50("J50_CAL_B", 30.0, 38.0, "pj50calb", CAL50)
    fp_b27("J27_CAL_A", 80.0, 20.0, "pj27cala", CAL27)
    fp_b27("J27_CAL_B", 80.0, 38.0, "pj27calb", CAL27)
    fp_b50("J50_OPEN", 130.0, 20.0, "pj50open", OSL_OPEN)
    fp_b50("J50_SHORT", 130.0, 38.0, "pj50short", OSL_SHORT)
    fp_b50("J50_LOAD", 180.0, 20.0, "pj50load", OSL_LOAD)
    fps.append(footprint("fx-generic:R_UNVERIFIED", "R_LOAD", 180.0, 38.0, "prload", R2_PADS, {"1": "OSL_LOAD_GMSL_P", "2": "OSL_LOAD_GMSL_N"}, net_ids, size=(1.2, 1.6)))
    fps.append(footprint("fx-generic:R_UNVERIFIED", "R_SHORT", 155.0, 38.0, "prshort", R2_PADS, {"1": "OSL_SHORT_GMSL_P", "2": "OSL_SHORT_GMSL_N"}, net_ids, size=(1.2, 1.6)))

    cal50_pairs = [(f"C{i:02d}", f"C{i:02d}", CAL50[f"C{i:02d}"]) for i in range(1, 13)]
    cal27_pairs = [(f"P{i:02d}", f"P{i:02d}", CAL27[f"P{i:02d}"]) for i in range(1, 13)]
    tr += stitch_12(B50_PADS, (30.0, 20.0), B50_PADS, (30.0, 38.0), cal50_pairs, net_ids, "cal50")
    tr += stitch_12(B27_PADS, (80.0, 20.0), B27_PADS, (80.0, 38.0), cal27_pairs, net_ids, "cal27")

    # Row 2: ser launch, B50-only, carriage
    fps.append(courtyard_only("mantis-ee:MAX96717_PACKAGE_UNVERIFIED", "U_SER", 18.0, 62.0, "pser"))
    fp_b50("J50_SER", 45.0, 62.0, "pj50ser", SER)
    fp_b50("J50_KEY_A", 95.0, 62.0, "pj50keya", B50ONLY)
    fp_b50("J50_KEY_B", 95.0, 80.0, "pj50keyb", B50ONLY)
    fp_b50("J50_CAR", 150.0, 62.0, "pj50car", CAR_B50)
    fp_b27("J27_CAR", 150.0, 80.0, "pj27car", CAR)
    b50only_pairs = [(f"C{i:02d}", f"C{i:02d}", B50ONLY[f"C{i:02d}"]) for i in range(1, 13)]
    car_pairs = [
        ("C03", "P03", "CAR_GND_A"),
        ("C04", "P04", "CAR_GND_B"),
        ("C05", "P05", "CAR_SDA"),
        ("C06", "P06", "CAR_SCL"),
        ("C07", "P07", "CAR_UID"),
        ("C08", "P08", "CAR_FAULT_N"),
        ("C09", "P09", "CAR_HSGND"),
        ("C10", "P10", "CAR_GMSL_P"),
        ("C11", "P11", "CAR_GMSL_N"),
        ("C12", "P12", "CAR_HSGND"),
    ]
    # Carriage: C01/C02 are V_BRANCH; P01/P02 stay VIN_A/VIN_B on B27. Do not stitch C01 to P01.
    tr += stitch_12(B50_PADS, (95.0, 62.0), B50_PADS, (95.0, 80.0), b50only_pairs, net_ids, "b50only")
    tr += stitch_12(B50_PADS, (150.0, 62.0), B27_PADS, (150.0, 80.0), car_pairs, net_ids, "car")
    # V_BRANCH on C01/C02 stays on B50; not a VIN bypass onto P01/P02.

    # Row 3: B27+B19, rx, full channel
    fp_b27("J27_B19", 30.0, 104.0, "pj27b19", B19)
    fps.append(footprint("mantis-ee:B27_RAIL_12NET_TARGET-2.54mm_UNVERIFIED-series", "J19_LANDS", 30.0, 122.0, "pj19", B19_PADS, B19, net_ids, note="B19 LANDS TARGET UNVERIFIED stack-up"))
    b19_pairs = [(f"P{i:02d}", f"P{i:02d}", B19[f"P{i:02d}"]) for i in range(1, 13)]
    tr += stitch_12(B27_PADS, (30.0, 104.0), B19_PADS, (30.0, 122.0), b19_pairs, net_ids, "b19")
    fps.append(courtyard_only("mantis-ee:MAX96724_PACKAGE_UNVERIFIED", "U_DES", 80.0, 104.0, "pdes"))
    fp_b27("J27_RX", 105.0, 104.0, "pj27rx", RX)

    fps.append(courtyard_only("mantis-ee:MAX96717_PACKAGE_UNVERIFIED", "U_SER_FULL", 140.0, 104.0, "pserf"))
    fp_b50("J50_FULL", 165.0, 104.0, "pj50full", FULL_B50)
    fp_b27("J27_FULL_CAR", 165.0, 122.0, "pj27fullcar", FULL_B27)
    fps.append(footprint("mantis-ee:B27_RAIL_12NET_TARGET-2.54mm_UNVERIFIED-series", "J19_FULL", 210.0, 122.0, "pj19f", B19_PADS, FULL_B27, net_ids, note="B19 FULL TARGET"))
    fp_b27("J27_FULL_RX", 210.0, 104.0, "pj27fullrx", FULL_B27)
    fps.append(courtyard_only("mantis-ee:MAX96724_PACKAGE_UNVERIFIED", "U_DES_FULL", 235.0, 104.0, "pdesf"))
    full_pairs = [
        ("C03", "P03", "FULL_GND_A"),
        ("C04", "P04", "FULL_GND_B"),
        ("C05", "P05", "FULL_SDA"),
        ("C06", "P06", "FULL_SCL"),
        ("C07", "P07", "FULL_UID"),
        ("C08", "P08", "FULL_FAULT_N"),
        ("C09", "P09", "FULL_HSGND"),
        ("C10", "P10", "FULL_GMSL_P"),
        ("C11", "P11", "FULL_GMSL_N"),
        ("C12", "P12", "FULL_HSGND"),
    ]
    tr += stitch_12(B50_PADS, (165.0, 104.0), B27_PADS, (165.0, 122.0), full_pairs, net_ids, "full-car")
    full_b27_pairs = [(f"P{i:02d}", f"P{i:02d}", FULL_B27[f"P{i:02d}"]) for i in range(1, 13)]
    tr += stitch_12(B27_PADS, (165.0, 122.0), B19_PADS, (210.0, 122.0), full_b27_pairs, net_ids, "full-b19")
    tr += stitch_12(B19_PADS, (210.0, 122.0), B27_PADS, (210.0, 104.0), full_b27_pairs, net_ids, "full-rx")

    # Row 4: power / S1 S2 Q1 / TPs / fault jumpers
    fp_b27("J27_PWR", 30.0, 140.0, "pj27pwr", {
        "P01": "VIN_A", "P02": "VIN_B", "P03": "GND_A", "P04": "GND_B",
        "P05": "SDA", "P06": "SCL", "P07": "UID", "P08": "FAULT_N",
        "P09": "HSGND", "P10": "GMSL_P", "P11": "GMSL_N", "P12": "HSGND",
    })
    fp_b50("J50_PWR", 90.0, 140.0, "pj50pwr", {
        "C01": "V_BRANCH", "C02": "V_BRANCH", "C03": "GND_A", "C04": "GND_B",
        "C05": "SDA", "C06": "SCL", "C07": "UID", "C08": "FAULT_N",
        "C09": "HSGND", "C10": "GMSL_P", "C11": "GMSL_N", "C12": "HSGND",
    })
    fps.append(footprint("mantis-ee:S1_NO_SWITCH_UNVERIFIED", "S1", 140.0, 136.0, "ps1", S1_PADS, {"1": "S1_COM", "2": "INTERLOCK_MID"}, net_ids, size=(1.2, 1.6)))
    fps.append(footprint("mantis-ee:S2_NO_SWITCH_UNVERIFIED", "S2", 140.0, 144.0, "ps2", S1_PADS, {"1": "S2_COM", "2": "INTERLOCK_OK"}, net_ids, size=(1.2, 1.6)))
    fps.append(footprint("mantis-ee:Q1_LOADSWITCH_UNVERIFIED", "Q1A", 165.0, 136.0, "pq1a", Q1_PADS, {"1": "Q1A_VIN", "2": "Q1_MID", "3": "Q1_EN", "4": "GND"}, net_ids, size=(0.8, 1.4)))
    fps.append(footprint("mantis-ee:Q1_LOADSWITCH_UNVERIFIED", "Q1B", 165.0, 144.0, "pq1b", Q1_PADS, {"1": "Q1_MID", "2": "V_BRANCH", "3": "Q1_EN", "4": "GND"}, net_ids, size=(0.8, 1.4)))
    fps.append(footprint("fx-generic:DISCHARGE_UNVERIFIED", "D_DIS", 190.0, 136.0, "pdis", R2_PADS, {"1": "V_BRANCH", "2": "DISCH_SRC"}, net_ids, size=(1.2, 1.6)))
    fps.append(footprint("fx-generic:C_LOAD_UNVERIFIED", "C_LOAD", 190.0, 144.0, "pcload", R2_PADS, {"1": "V_BRANCH", "2": "GND"}, net_ids, size=(1.2, 1.6)))
    fps.append(footprint("fx-generic:F1_UNVERIFIED", "F1", 215.0, 136.0, "pf1", R2_PADS, {"1": "VIN_FUSED_PRE", "2": "VIN_FUSED"}, net_ids, size=(1.2, 1.6)))
    fps.append(footprint("fx-generic:R_SRC_UNVERIFIED", "R_SRC", 215.0, 144.0, "prsrc", R2_PADS, {"1": "VIN_RAIL", "2": "VIN_FUSED_PRE"}, net_ids, size=(1.2, 1.6)))
    fps.append(footprint("fx-generic:R_UNVERIFIED", "R_SHARE_A", 230.0, 136.0, "psha", R2_PADS, {"1": "VIN_A", "2": "VIN_SHARED"}, net_ids, size=(1.2, 1.6)))
    fps.append(footprint("fx-generic:R_UNVERIFIED", "R_SHARE_B", 230.0, 144.0, "pshb", R2_PADS, {"1": "VIN_B", "2": "VIN_SHARED"}, net_ids, size=(1.2, 1.6)))

    tp_map = [
        ("TP_VIN", 20.0, "VIN_RAIL"),
        ("TP_VBR", 25.0, "V_BRANCH"),
        ("TP_IBR", 30.0, "Q1_MID"),
        ("TP_S1", 35.0, "INTERLOCK_MID"),
        ("TP_S2", 40.0, "INTERLOCK_OK"),
        ("TP_Q1EN", 45.0, "Q1_EN"),
        ("TP_Q1OUT", 50.0, "V_BRANCH"),
        ("TP_DIS", 55.0, "Q1_EN_N"),
        ("TP_FLT", 60.0, "P08_DIAG"),
        ("TP_LOCK", 65.0, "LINK_LOCK_OBS"),
        ("TP_ISO", 70.0, "ISO_EN"),
        ("TP_AON", 75.0, "VIN_AON"),
    ]
    for i, (ref, x, net) in enumerate(tp_map):
        fps.append(footprint("fx-generic:TP_UNVERIFIED", ref, x, 12.0, f"ptp{i}", TP_PADS, {"1": net}, net_ids, size=(1.2, 1.2)))

    faults = [
        ("K_S1_OPEN", "VIN_AON", "S1_COM"),
        ("K_S1_WELD", "VIN_AON", "INTERLOCK_MID"),
        ("K_S2_OPEN", "INTERLOCK_MID", "S2_COM"),
        ("K_S2_WELD", "INTERLOCK_MID", "INTERLOCK_OK"),
        ("K_Q1_OPEN", "VIN_SHARED", "Q1A_VIN"),
        ("K_Q1_SHORT", "VIN_SHARED", "V_BRANCH"),
        ("K_DIS_OPEN", "DISCH_SRC", "GND"),
        ("K_VINA_OPEN", "VIN_FUSED", "VIN_A"),
        ("K_GNDA_OPEN", "GND", "GND_A"),
        ("K_UID_INJ", "UID", "INJ_UID"),
        ("K_P08_INJ", "FAULT_N", "INJ_P08"),
        ("K_I2C_INJ", "SDA", "INJ_SDA"),
        ("K_PARTIAL", "S1_PARTIAL", "INTERLOCK_MID"),
        ("K_BROWNOUT", "VIN_RAIL", "VIN_BROWNOUT"),
    ]
    for i, (ref, n1, n2) in enumerate(faults):
        fps.append(footprint("fx-generic:JMP_FAULT_UNVERIFIED", ref, 12.0 + i * 16.0, 148.0, f"pk{i}", JMP_PADS, {"1": n1, "2": n2}, net_ids, size=(1.2, 1.6)))

    extras = "\n".join(
        [
            '  (gr_text "CAL 2x-thru B50" (at 30 14 0) (layer "F.SilkS") (effects (font (size 0.9 0.9))))',
            '  (gr_text "CAL 2x-thru B27" (at 80 14 0) (layer "F.SilkS") (effects (font (size 0.9 0.9))))',
            '  (gr_text "OSL OPEN/SHORT/LOAD" (at 155 14 0) (layer "F.SilkS") (effects (font (size 0.9 0.9))))',
            '  (gr_text "SER REFPLANE + B50" (at 40 54 0) (layer "F.SilkS") (effects (font (size 0.9 0.9))))',
            '  (gr_text "B50-ONLY KEYED" (at 95 54 0) (layer "F.SilkS") (effects (font (size 0.9 0.9))))',
            '  (gr_text "CARRIAGE ROUTE" (at 150 54 0) (layer "F.SilkS") (effects (font (size 0.9 0.9))))',
            '  (gr_text "B27 + B19 LANDS" (at 30 96 0) (layer "F.SilkS") (effects (font (size 0.9 0.9))))',
            '  (gr_text "RX REFPLANE" (at 95 96 0) (layer "F.SilkS") (effects (font (size 0.9 0.9))))',
            '  (gr_text "FULL CHANNEL ser-B50-car-B27-B19-rx" (at 185 96 0) (layer "F.SilkS") (effects (font (size 0.9 0.9))))',
            '  (gr_text "POWER S1/S2/Q1 FAULT (jumpers DEFAULT OPEN)" (at 90 132 0) (layer "F.SilkS") (effects (font (size 0.9 0.9))))',
            '  (gr_text "GMSL 100 ohm TARGET. Stackup UNVERIFIED. MIPI not on B27/B50. No measured SI/PI." (at 120 128 0) (layer "F.Fab") (effects (font (size 0.8 0.8))))',
        ]
    )
    return pcb_file("mantis-ee-26-fixture-panel", nets, "\n".join(fps), "\n".join(tr), extras)


def collect_nets() -> list[str]:
    nets: set[str] = set()
    for mapping in (CAL50, CAL27, OSL_OPEN, OSL_SHORT, OSL_LOAD, SER, B50ONLY, CAR, CAR_B50, B19, RX, FULL_B50, FULL_B27):
        nets.update(mapping.values())
    nets.update(
        {
            "SER_VDD", "SER_GND", "RX_VDD", "RX_GND", "FULL_VDD_SER", "FULL_VDD_DES", "FULL_GND",
            "VIN_RAIL", "VIN_FUSED_PRE", "VIN_FUSED", "VIN_A", "VIN_B", "VIN_SHARED", "VIN_AON",
            "GND", "GND_A", "GND_B", "SDA", "SDA_BR", "SCL", "UID", "FAULT_N", "P08_DIAG",
            "HSGND", "GMSL_P", "GMSL_N", "V_BRANCH", "Q1_EN", "Q1_EN_N", "Q1_MID",
            "INTERLOCK_MID", "INTERLOCK_OK", "ISO_EN", "LINK_LOCK_OBS",
            "INJ_UID", "INJ_P08", "INJ_SDA", "S1_PARTIAL", "VIN_BROWNOUT",
            "S1_COM", "S2_COM", "Q1A_VIN", "DISCH_SRC",
        }
    )
    return sorted(nets)


def main() -> None:
    lib = load_lib()
    parents = consume_parents()
    extracted = {n: extract_symbol(lib, n) for n in WANTED}
    pins = {n: pin_coords(extracted[n]) for n in WANTED}
    iface = "\n".join(extracted[n] for n in ["B50_BINDER_12NET", "B27_RAIL_12NET"])
    serdes = "\n".join(extracted[n] for n in ["MAX96717_GMSL2_SER_UNVERIFIED", "MAX96724_GMSL2_DES_UNVERIFIED", "B50_BINDER_12NET", "B27_RAIL_12NET"])
    act = "\n".join(extracted[n] for n in ["B27_RAIL_12NET", "B50_BINDER_12NET", "S1_NO_CARRIAGE_MATE_UNVERIFIED", "S2_NO_BINDER_MATE_UNVERIFIED", "Q1_LOADSWITCH_UNVERIFIED"])

    sheets = {
        "01-cal-2xthru-osl": emit_cal(iface, pins),
        "02-ser-launch-refplane": emit_ser(extracted["MAX96717_GMSL2_SER_UNVERIFIED"] + "\n" + extracted["B50_BINDER_12NET"], pins),
        "03-b50-only": emit_b50(extracted["B50_BINDER_12NET"], pins),
        "04-carriage-route": emit_car(iface, pins),
        "05-b27-b19": emit_b19(extracted["B27_RAIL_12NET"], pins),
        "06-rx-launch-refplane": emit_rx(extracted["MAX96724_GMSL2_DES_UNVERIFIED"] + "\n" + extracted["B27_RAIL_12NET"], pins),
        "07-full-channel": emit_full(serdes, pins),
        "08-power-s1s2q1-fault": emit_power(act, pins),
    }
    boxes = [
        ("01-cal-2xthru-osl", "cal 2x-thru / OSL", uid("sheet:01-cal-2xthru-osl"), 25.4, 20.0),
        ("02-ser-launch-refplane", "ser launch / B50", uid("sheet:02-ser-launch-refplane"), 130.0, 20.0),
        ("03-b50-only", "B50 keyed only", uid("sheet:03-b50-only"), 234.6, 20.0),
        ("04-carriage-route", "carriage route", uid("sheet:04-carriage-route"), 25.4, 70.0),
        ("05-b27-b19", "B27 + B19 lands", uid("sheet:05-b27-b19"), 130.0, 70.0),
        ("06-rx-launch-refplane", "rx launch / B27", uid("sheet:06-rx-launch-refplane"), 234.6, 70.0),
        ("07-full-channel", "full channel", uid("sheet:07-full-channel"), 25.4, 120.0),
        ("08-power-s1s2q1-fault", "power / S1 S2 Q1 / fault", uid("sheet:08-power-s1s2q1-fault"), 130.0, 120.0),
    ]
    note = (
        f"fixture (issue 26). {MARKING}\\n"
        f"{SILK_CLASS}\\n"
        "Complete coupon: ser/binder launch, B50, carriage, B27/B19, receiver, adjacent power, S1/S2/Q1, cal, fault.\\n"
        "Consumes unadmitted #23/#24/#25. No invented MPN. MIPI local. Video-while-rolling out of v1. No measured SI/PI.\\n"
        "Does not implement #18. Does not touch PR 12. Does not rewrite camera-tx/carriage/rail-rx."
    )
    sch = root_sheet(
        "Mantis EE-04 characterization fixture",
        boxes,
        note,
        [
            (uid("sheet:01-cal-2xthru-osl"), "2"),
            (uid("sheet:02-ser-launch-refplane"), "3"),
            (uid("sheet:03-b50-only"), "4"),
            (uid("sheet:04-carriage-route"), "5"),
            (uid("sheet:05-b27-b19"), "6"),
            (uid("sheet:06-rx-launch-refplane"), "7"),
            (uid("sheet:07-full-channel"), "8"),
            (uid("sheet:08-power-s1s2q1-fault"), "9"),
        ],
    )
    nets = collect_nets()
    net_ids = {n: i + 1 for i, n in enumerate(nets)}
    pcb = emit_pcb(net_ids, nets)

    (HERE / "sheets").mkdir(parents=True, exist_ok=True)
    (HERE / "tools").mkdir(parents=True, exist_ok=True)
    (HERE / "fixture.kicad_sch").write_text(sch)
    for name, body in sheets.items():
        (HERE / "sheets" / f"{name}.kicad_sch").write_text(body)
    (HERE / "fixture.kicad_pcb").write_text(pcb)
    sheet_list = [("fixture.kicad_sch", uid("root:Mantis EE-04 characterization fixture"))]
    for name in sheets:
        sheet_list.append((f"sheets/{name}.kicad_sch", uid("sheet:" + name)))
    (HERE / "fixture.kicad_pro").write_text(project_file("fixture.kicad_pro", sheet_list))
    sym, fp = lib_tables()
    (HERE / "sym-lib-table").write_text(sym)
    (HERE / "fp-lib-table").write_text(fp)

    netmap = {
        "schema": "mantis.ee.fixture.net-map.v1",
        "issue": 26,
        "status": "UNVERIFIED",
        "maturity": "PROTO-FAB",
        "qualified": False,
        "shopRelease": False,
        "rawMipiOnPogos": False,
        "untethered": True,
        "videoWhileRolling": False,
        "p08SafetyAuthority": False,
        "measuredSiPi": False,
        "marking": MARKING,
        "classMarking": SILK_CLASS,
        "consumes": {
            "library": "terrarium/ee/kicad/libs (EE-01, unadmitted envelopes)",
            "powerControl": "terrarium/ee/kicad/power-control/net-map.json",
            "cameraTx": "terrarium/ee/kicad/camera-tx/net-map.json",
            "carriage": "terrarium/ee/kicad/carriage/net-map.json",
            "railRx": "terrarium/ee/kicad/rail-rx/net-map.json",
        },
        "parentStatus": {k: v.get("status") for k, v in parents.items()},
        "structures": [
            "cal-2xthru-b50",
            "cal-2xthru-b27",
            "osl-open",
            "osl-short",
            "osl-load",
            "ser-launch-refplane",
            "b50-only-keyed",
            "carriage-route",
            "b27-b19-adjacent-p01-p08",
            "rx-launch-refplane",
            "full-channel-ser-b50-car-b27-b19-rx",
            "power-s1-s2-q1-aon-discharge-iso-fault",
        ],
        "nodes": {
            "CAL50_* / CAL27_*": "2x-thru coupons; complete 12-net, not GMSL-only",
            "OSL_*": "open/short/load at B50 plane; RF adapter MPN UNVERIFIED",
            "SER_*": "serializer courtyard refplane to B50; CSI no-connect",
            "B50ONLY_*": "keyed B50 plug/receptacle 12-net",
            "CAR_*": "carriage B50 to B27; C01/C02 V_BRANCH not VIN bypass",
            "B19_*": "B27 springs to B19 lands; P01-P08 adjacent; P09/P12 HSGND",
            "RX_*": "B27 dock to deserializer courtyard; CSI no-connect",
            "FULL_*": "complete path; intervening geometry not simplified",
            "V_BRANCH": "Q1B output to B50 C01/C02; enable is #24 Q1_EN",
            "VIN_AON": "always-on supervisor; not V_BRANCH",
            "LINK_LOCK_OBS": "reserved probe; lock pin map UNVERIFIED",
            "K_*": "fault jumpers default OPEN; one-at-a-time; human approval",
        },
        "powerNetsFrom24": [
            "VIN_RAIL", "VIN_FUSED", "VIN_SHARED", "V_BRANCH", "Q1_EN", "Q1_EN_N",
            "Q1_MID", "INTERLOCK_MID", "INTERLOCK_OK", "ISO_EN", "FAULT_N", "P08_DIAG",
        ],
        "b27": B27_ROLES,
        "b50": B50_ROLES,
        "b50AfterQ1": {"C01": "V_BRANCH", "C02": "V_BRANCH"},
    }
    (HERE / "net-map.json").write_text(json.dumps(netmap, indent=2) + "\n")
    print("wrote fixture KiCad project")


if __name__ == "__main__":
    main()
