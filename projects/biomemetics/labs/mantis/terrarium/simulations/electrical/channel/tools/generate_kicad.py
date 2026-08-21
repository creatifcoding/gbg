#!/usr/bin/env python3
"""Emit issue-25 camera-tx, carriage, and rail-rx KiCad projects.

Reads terrarium/ee/kicad/libs (does not rewrite it). Consumes #24 net names.
Does not invent MPNs. MIPI stays local. GMSL only on B50 C09-C12 / B27 P09-P12.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from kicad_emit import (  # noqa: E402
    B27_PADS,
    B50_PADS,
    FPC22_PADS,
    LIB,
    Q1_PADS,
    S1_PADS,
    courtyard_only,
    extract_symbol,
    footprint,
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

TERR = Path(__file__).resolve().parents[4]
KICAD = TERR / "ee" / "kicad"
CAM = KICAD / "camera-tx"
CAR = KICAD / "carriage"
RX = KICAD / "rail-rx"

COMMENT = (
    "P08 diagnostic only. MIPI local. GMSL on C09-C12/P09-P12 only. "
    "#23 envelopes, no invented MPN."
)

B27_NETS = {
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
B50_NETS = {f"C{i:02d}": net for i, net in enumerate(B27_NETS.values(), 1)}
B50_CAM = dict(B50_NETS)
B50_CAM["C01"] = "V_BRANCH"
B50_CAM["C02"] = "V_BRANCH"

CSI_MAP = {
    "2": "CSI_D0_N",
    "3": "CSI_D0_P",
    "5": "CSI_D1_N",
    "6": "CSI_D1_P",
    "8": "CSI_CLK_N",
    "9": "CSI_CLK_P",
    "11": "CSI_D2_N",
    "12": "CSI_D2_P",
    "14": "CSI_D3_N",
    "15": "CSI_D3_P",
}
GND_22 = ["1", "4", "7", "10", "13", "16", "19"]
SER_CSI = {
    "A1": "CSI_D0_P",
    "A2": "CSI_D0_N",
    "A3": "CSI_D1_P",
    "A4": "CSI_D1_N",
    "A5": "CSI_D2_P",
    "A6": "CSI_D2_N",
    "A7": "CSI_D3_P",
    "A8": "CSI_D3_N",
    "A9": "CSI_CLK_P",
    "A10": "CSI_CLK_N",
}

WRAPPER = '''#!/usr/bin/env python3
from pathlib import Path
import runpy
runpy.run_path(
    str(
        Path(__file__).resolve().parents[4]
        / "simulations"
        / "electrical"
        / "channel"
        / "tools"
        / "generate_kicad.py"
    ),
    run_name="__main__",
)
'''


def load_lib() -> str:
    if not LIB.is_file():
        raise SystemExit(f"EE-01 library missing (read-only dependency): {LIB}")
    return LIB.read_text()


def write_board(root: Path, stem: str, sch_root: str, sheets: dict[str, str], pcb: str, netmap: dict) -> None:
    (root / "sheets").mkdir(parents=True, exist_ok=True)
    (root / "tools").mkdir(parents=True, exist_ok=True)
    (root / f"{stem}.kicad_sch").write_text(sch_root)
    for name, body in sheets.items():
        (root / "sheets" / f"{name}.kicad_sch").write_text(body)
    (root / f"{stem}.kicad_pcb").write_text(pcb)
    sheet_list = [(f"{stem}.kicad_sch", uid("root:" + stem))]
    for name in sheets:
        sheet_list.append((f"sheets/{name}.kicad_sch", uid("sheet:" + name)))
    (root / f"{stem}.kicad_pro").write_text(project_file(f"{stem}.kicad_pro", sheet_list))
    sym, fp = lib_tables()
    (root / "sym-lib-table").write_text(sym)
    (root / "fp-lib-table").write_text(fp)
    (root / "net-map.json").write_text(json.dumps(netmap, indent=2) + "\n")
    (root / "tools" / "generate_project.py").write_text(WRAPPER)


def emit_camera(lib: str) -> None:
    wanted = [
        "IMX519_AF_MODULE_UNVERIFIED",
        "MAX96717_GMSL2_SER_UNVERIFIED",
        "B50_BINDER_12NET",
    ]
    extracted = {n: extract_symbol(lib, n) for n in wanted}
    pins = {n: pin_coords(extracted[n]) for n in wanted}
    libs = "\n".join(extracted.values())

    imx_nets = {**CSI_MAP, **{p: "GND" for p in GND_22}, "22": "CAM_3V3"}
    csi_body = "\n".join(
        [
            instance(
                "mantis-ee:IMX519_AF_MODULE_UNVERIFIED",
                "U_CAM",
                "IMX519_AF_MODULE_UNVERIFIED",
                70.0,
                70.0,
                "UCAM",
                pins["IMX519_AF_MODULE_UNVERIFIED"],
                imx_nets,
                noconnects=["17", "18", "20", "21"],
            ),
            text(
                "Local MIPI CSI-2 only. Does not appear on B50/B27/pogos.\\n"
                "CAM_SDA/CAM_SCL/RESET/PWR_EN: serializer control pad map UNVERIFIED; no invented pins.\\n"
                "CAM_3V3 is not V_BRANCH. Local rail tree MPN UNVERIFIED.",
                25.4,
                140.0,
                "cam-csi-note",
            ),
        ]
    )
    ser_nets = {**SER_CSI, "B1": "GMSL_P", "B2": "GMSL_N", "P1": "VDD_SER", "P2": "GND"}
    ser_body = "\n".join(
        [
            instance(
                "mantis-ee:MAX96717_GMSL2_SER_UNVERIFIED",
                "U_SER",
                "MAX96717_GMSL2_SER_UNVERIFIED",
                70.0,
                70.0,
                "USER",
                pins["MAX96717_GMSL2_SER_UNVERIFIED"],
                ser_nets,
            ),
            instance(
                "mantis-ee:B50_BINDER_12NET",
                "J50",
                "B50_BINDER_12NET",
                180.0,
                70.0,
                "J50C",
                pins["B50_BINDER_12NET"],
                B50_CAM,
            ),
            text(
                "GMSL+ / GMSL- only on C10/C11. HSGND on C09/C12. C01/C02 are V_BRANCH after Q1 (#24).\\n"
                "VDD_SER is not 12 V V_BRANCH. Suffix/package/pad map UNVERIFIED. analog.com PDF timed out.\\n"
                "Untethered load: this board has no cable off B50.",
                25.4,
                145.0,
                "cam-ser-note",
            ),
        ]
    )
    sheets = {
        "01-local-csi": sheet_file(
            "Camera local CSI (MIPI stays here)",
            "2",
            libs,
            csi_body,
            "sheet:01-local-csi",
            COMMENT,
        ),
        "02-ser-b50": sheet_file(
            "Serializer launch and B50 C09-C12",
            "3",
            libs,
            ser_body,
            "sheet:02-ser-b50",
            COMMENT,
        ),
    }
    boxes = [
        ("01-local-csi", "local CSI / IMX519", uid("sheet:01-local-csi"), 25.4, 25.4),
        ("02-ser-b50", "MAX96717 / B50 launch", uid("sheet:02-ser-b50"), 130.0, 25.4),
    ]
    note = (
        "camera-tx (issue 25). Untethered. Raw MIPI is local to IMX519 and MAX96717.\\n"
        "Serialized GMSL only on B50 C09-C12. Video-while-rolling is out of v1.\\n"
        "#23 library unadmitted. No invented MPN. Theoretical class. Not a shop release."
    )
    sch = root_sheet(
        "Mantis EE-03 camera-tx",
        boxes,
        note,
        [(uid("sheet:01-local-csi"), "2"), (uid("sheet:02-ser-b50"), "3")],
    )
    nets = sorted(set(B50_CAM.values()) | set(CSI_MAP.values()) | {"CAM_3V3", "VDD_SER", "GND"})
    net_ids = {n: i + 1 for i, n in enumerate(nets)}
    fpc_pad_nets = {**CSI_MAP, **{p: "GND" for p in GND_22}, "22": "CAM_3V3"}
    fps = "\n".join(
        [
            footprint(
                "mantis-ee:FPC-22_0.5mm_UNVERIFIED-MPN",
                "U_CAM",
                25.0,
                20.0,
                "pcam",
                FPC22_PADS,
                fpc_pad_nets,
                net_ids,
                size=(0.3, 1.2),
            ),
            courtyard_only("mantis-ee:MAX96717_PACKAGE_UNVERIFIED", "U_SER", 45.0, 20.0, "pser"),
            footprint(
                "mantis-ee:B50_BINDER_12NET_UNVERIFIED-series",
                "J50",
                70.0,
                20.0,
                "pj50c",
                B50_PADS,
                B50_CAM,
                net_ids,
            ),
        ]
    )
    pcb = pcb_file(
        "camera-tx",
        nets,
        fps,
        "",
        "Serializer has no pad map. Do not invent launch geometry. MIPI on FPC-22 only.",
        95.0,
        40.0,
    )
    netmap = {
        "schema": "mantis.ee.camera-tx.net-map.v1",
        "issue": 25,
        "status": "UNVERIFIED",
        "rawMipiOnPogos": False,
        "untethered": True,
        "videoWhileRolling": False,
        "nodes": {
            "CSI_*": "local MIPI between IMX519 and MAX96717; not on B50",
            "GMSL_P": "B50 C10",
            "GMSL_N": "B50 C11",
            "HSGND": "B50 C09 and C12",
            "V_BRANCH": "B50 C01/C02 after Q1; not serializer VDD",
            "VDD_SER": "UNVERIFIED local rail; pad map missing",
            "CAM_3V3": "UNVERIFIED local rail; SKU missing",
        },
        "b50": B50_CAM,
    }
    write_board(CAM, "camera-tx", sch, sheets, pcb, netmap)
    (CAM / "README.md").write_text(
        """# Mantis EE-03 camera-tx (issue 25)

Theoretical / `UNVERIFIED`. Not a shop release.

Tracks #25 only. Does not implement #18. Does not touch PR 12. Does not rewrite
the #23 library or #24 power-control.

## Locks

- Untethered. No trailing cable.
- Raw MIPI is local to IMX519 and MAX96717.
- Serialized GMSL only on B50 C09–C12 (HSGND, GMSL+, GMSL-, HSGND).
- Video-while-rolling is out of v1.
- IMX519 SKU, MAX96717 suffix/pad map, and B50 series remain UNVERIFIED.

Regenerate:

```text
python3 ../../../simulations/electrical/channel/tools/generate_kicad.py
```
"""
    )
    (CAM / "erc-waivers.md").write_text(
        """# ERC waivers (issue 25 camera-tx)

Status: `UNVERIFIED`. `kicad-cli` is not in this runtime.

| Item | Disposition |
| --- | --- |
| kicad-cli ERC not run | Waiver: tool absent. |
| MAX96717 footprint has no pads | Expected. analog.com PDF timed out. Do not invent a pad map. |
| CAM_3V3 / VDD_SER not tied to V_BRANCH | Intentional. 12 V branch is not a CSI/SerDes core rail. Local MPN UNVERIFIED. |
| IMX519 pins 17/18/20/21 no-connect | Serializer control pins absent from #23 envelope. |
| UNVERIFIED footprints | #23 envelopes; do not fabricate. |
"""
    )


def emit_carriage(lib: str) -> None:
    wanted = [
        "B27_RAIL_12NET",
        "B50_BINDER_12NET",
        "S1_NO_CARRIAGE_MATE_UNVERIFIED",
        "S2_NO_BINDER_MATE_UNVERIFIED",
        "Q1_LOADSWITCH_UNVERIFIED",
    ]
    extracted = {n: extract_symbol(lib, n) for n in wanted}
    pins = {n: pin_coords(extracted[n]) for n in wanted}
    iface_libs = "\n".join(extracted[n] for n in ["B27_RAIL_12NET", "B50_BINDER_12NET"])
    act_libs = "\n".join(extracted.values())

    gmsl_body = "\n".join(
        [
            instance(
                "mantis-ee:B50_BINDER_12NET",
                "J50",
                "B50_BINDER_12NET",
                70.0,
                70.0,
                "J50R",
                pins["B50_BINDER_12NET"],
                B50_CAM,
            ),
            instance(
                "mantis-ee:B27_RAIL_12NET",
                "J27",
                "B27_RAIL_12NET",
                180.0,
                70.0,
                "J27C",
                pins["B27_RAIL_12NET"],
                B27_NETS,
            ),
            text(
                "Complete 12-net stitch. High-speed cell is C09-C12 / P09-P12 only.\\n"
                "Serialized video only. Raw camera bus is not on this board.\\n"
                "Untethered: no cable connector other than B27 and B50.",
                25.4,
                145.0,
                "car-gmsl-note",
            ),
        ]
    )
    act_body = "\n".join(
        [
            instance(
                "mantis-ee:S1_NO_CARRIAGE_MATE_UNVERIFIED",
                "S1",
                "S1_NO_CARRIAGE_MATE_UNVERIFIED",
                50.0,
                50.0,
                "S1C",
                pins["S1_NO_CARRIAGE_MATE_UNVERIFIED"],
                {"1": "VREF", "2": "INTERLOCK_MID"},
            ),
            instance(
                "mantis-ee:S2_NO_BINDER_MATE_UNVERIFIED",
                "S2",
                "S2_NO_BINDER_MATE_UNVERIFIED",
                110.0,
                50.0,
                "S2C",
                pins["S2_NO_BINDER_MATE_UNVERIFIED"],
                {"1": "INTERLOCK_MID", "2": "INTERLOCK_OK"},
            ),
            instance(
                "mantis-ee:Q1_LOADSWITCH_UNVERIFIED",
                "Q1",
                "Q1_LOADSWITCH_UNVERIFIED",
                80.0,
                110.0,
                "Q1C",
                pins["Q1_LOADSWITCH_UNVERIFIED"],
                {"1": "VIN_SHARED", "2": "V_BRANCH", "3": "Q1_EN", "4": "GND"},
            ),
            text(
                "Placement/stitch only. Dual-channel Q1, discharge, ISO, remate, OC, UVLO live in #24.\\n"
                "Q1_EN is consumed from #24. Do not treat this sheet as the authorization truth table.\\n"
                "P08 cannot force Q1 on. VIN_SHARED is P01||P02; V_BRANCH feeds B50 C01/C02.",
                25.4,
                155.0,
                "car-act-note",
            ),
        ]
    )
    sheets = {
        "01-b50-b27-gmsl": sheet_file(
            "B50 to B27 complete 12-net including GMSL cell",
            "2",
            iface_libs,
            gmsl_body,
            "sheet:01-b50-b27-gmsl",
            COMMENT,
        ),
        "02-s1-s2-q1-consume": sheet_file(
            "S1/S2/Q1 placement consuming #24 nets",
            "3",
            act_libs,
            act_body,
            "sheet:02-s1-s2-q1-consume",
            COMMENT,
        ),
    }
    boxes = [
        ("01-b50-b27-gmsl", "B50 / B27 / GMSL cell", uid("sheet:01-b50-b27-gmsl"), 25.4, 25.4),
        ("02-s1-s2-q1-consume", "S1 S2 Q1 consume #24", uid("sheet:02-s1-s2-q1-consume"), 130.0, 25.4),
    ]
    note = (
        "carriage (issue 25). Untethered. Complete B50+B27 channel, not a decorative subset.\\n"
        "MIPI is not on this board. Video-while-rolling is out of v1. #24 owns the truth table.\\n"
        "#23 library unadmitted. No invented MPN. Theoretical class. Not a shop release."
    )
    sch = root_sheet(
        "Mantis EE-03 carriage",
        boxes,
        note,
        [(uid("sheet:01-b50-b27-gmsl"), "2"), (uid("sheet:02-s1-s2-q1-consume"), "3")],
    )
    nets = sorted(
        set(B27_NETS.values())
        | {"VIN_SHARED", "V_BRANCH", "Q1_EN", "INTERLOCK_MID", "INTERLOCK_OK", "VREF", "GND"}
    )
    net_ids = {n: i + 1 for i, n in enumerate(nets)}
    b50_pcb = dict(B50_NETS)
    b50_pcb["C01"] = "V_BRANCH"
    b50_pcb["C02"] = "V_BRANCH"
    fps = "\n".join(
        [
            footprint(
                "mantis-ee:B50_BINDER_12NET_UNVERIFIED-series",
                "J50",
                40.0,
                18.0,
                "pj50car",
                B50_PADS,
                b50_pcb,
                net_ids,
            ),
            footprint(
                "mantis-ee:B27_RAIL_12NET_TARGET-2.54mm_UNVERIFIED-series",
                "J27",
                40.0,
                38.0,
                "pj27car",
                B27_PADS,
                B27_NETS,
                net_ids,
            ),
            footprint(
                "mantis-ee:S1_NO_SWITCH_UNVERIFIED",
                "S1",
                75.0,
                18.0,
                "ps1",
                S1_PADS,
                {"1": "VREF", "2": "INTERLOCK_MID"},
                net_ids,
                size=(1.2, 1.6),
            ),
            footprint(
                "mantis-ee:S2_NO_SWITCH_UNVERIFIED",
                "S2",
                75.0,
                28.0,
                "ps2",
                S1_PADS,
                {"1": "INTERLOCK_MID", "2": "INTERLOCK_OK"},
                net_ids,
                size=(1.2, 1.6),
            ),
            footprint(
                "mantis-ee:Q1_LOADSWITCH_UNVERIFIED",
                "Q1",
                75.0,
                38.0,
                "pq1",
                Q1_PADS,
                {"1": "VIN_SHARED", "2": "V_BRANCH", "3": "Q1_EN", "4": "GND"},
                net_ids,
                size=(0.8, 1.4),
            ),
        ]
    )
    jx, y50, y27 = 40.0, 18.0, 38.0
    qx, qy = 75.0, 38.0
    passthru = [
        ("C03", "P03", "GND_A"),
        ("C04", "P04", "GND_B"),
        ("C05", "P05", "SDA"),
        ("C06", "P06", "SCL"),
        ("C07", "P07", "UID"),
        ("C08", "P08", "FAULT_N"),
        ("C09", "P09", "HSGND"),
        ("C10", "P10", "GMSL_P"),
        ("C11", "P11", "GMSL_N"),
        ("C12", "P12", "HSGND"),
    ]
    tracks = "\n".join(
        [
            track(
                jx + B50_PADS[c][0],
                y50,
                jx + B27_PADS[p][0],
                y27,
                net_ids[net],
                f"pt-{c}-{p}",
            )
            for c, p, net in passthru
        ]
        + [
            track(
                qx + Q1_PADS["2"][0],
                qy,
                jx + B50_PADS["C01"][0],
                y50,
                net_ids["V_BRANCH"],
                "vbr-c01",
            ),
            track(
                qx + Q1_PADS["2"][0],
                qy,
                jx + B50_PADS["C02"][0],
                y50,
                net_ids["V_BRANCH"],
                "vbr-c02",
            ),
            track(
                75.0 + S1_PADS["2"][0],
                18.0,
                75.0 + S1_PADS["1"][0],
                28.0,
                net_ids["INTERLOCK_MID"],
                "int-mid",
            ),
        ]
    )
    pcb = pcb_file(
        "carriage",
        nets,
        fps,
        tracks,
        "GMSL tracks are TARGET 100 ohm placeholders. Width/gap UNVERIFIED. No CSI copper.",
        95.0,
        50.0,
    )
    netmap = {
        "schema": "mantis.ee.carriage.net-map.v1",
        "issue": 25,
        "status": "UNVERIFIED",
        "rawMipiOnPogos": False,
        "untethered": True,
        "consumes": "terrarium/ee/kicad/power-control/net-map.json",
        "nodes": {
            "GMSL_P": "B50 C10 / B27 P10",
            "GMSL_N": "B50 C11 / B27 P11",
            "HSGND": "B50 C09/C12 / B27 P09/P12",
            "V_BRANCH": "Q1 output to B50 C01/C02; enable is #24 Q1_EN",
            "INTERLOCK_OK": "S1 series S2; authorization remainder is #24",
        },
        "b27": B27_NETS,
        "b50": b50_pcb,
    }
    write_board(CAR, "carriage", sch, sheets, pcb, netmap)
    (CAR / "README.md").write_text(
        """# Mantis EE-03 carriage (issue 25)

Theoretical / `UNVERIFIED`. Not a shop release.

Complete B50+B27 12-net channel. Untethered. No CSI on pogos.

S1/S2/Q1 are placed and stitched. Dual-channel Q1, discharge, and isolation
remain #24. This board does not rewrite that truth table.

Regenerate with `python3 ../../../simulations/electrical/channel/tools/generate_kicad.py`.
"""
    )
    (CAR / "erc-waivers.md").write_text(
        """# ERC waivers (issue 25 carriage)

| Item | Disposition |
| --- | --- |
| kicad-cli ERC not run | Waiver: tool absent. |
| Q1 is a single envelope | Dual-channel assembly is #24. Do not treat one symbol as the safety model. |
| No CSI nets | Intentional. Serialized video only. |
| UNVERIFIED B27/B50 series | #23 envelopes; do not fabricate. |
"""
    )


def emit_rail_rx(lib: str) -> None:
    wanted = [
        "B27_RAIL_12NET",
        "MAX96724_GMSL2_DES_UNVERIFIED",
        "TACHYON_CSI1_22P",
    ]
    extracted = {n: extract_symbol(lib, n) for n in wanted}
    pins = {n: pin_coords(extracted[n]) for n in wanted}
    libs = "\n".join(extracted.values())
    gmsl_body = "\n".join(
        [
            instance(
                "mantis-ee:B27_RAIL_12NET",
                "J27",
                "B27_RAIL_12NET",
                70.0,
                70.0,
                "J27R",
                pins["B27_RAIL_12NET"],
                B27_NETS,
            ),
            instance(
                "mantis-ee:MAX96724_GMSL2_DES_UNVERIFIED",
                "U_DES",
                "MAX96724_GMSL2_DES_UNVERIFIED",
                180.0,
                70.0,
                "UDES",
                pins["MAX96724_GMSL2_DES_UNVERIFIED"],
                {"B1": "GMSL_P", "B2": "GMSL_N", "P1": "VDD_DES", "P2": "GND", **SER_CSI},
            ),
            text(
                "Indexed B27 dock. Family is quad; envelope exposes one GMSL input. Do not invent three more.\\n"
                "B19 dock mechanics are #28/#29 draft/read-only. Electrical interface is B27.\\n"
                "P09-P12 high-speed cell only. P01-P08 power/control from the rail.",
                25.4,
                145.0,
                "rx-gmsl-note",
            ),
        ]
    )
    tach_nets = {**CSI_MAP, **{p: "GND" for p in GND_22}, "22": "CAM_3V3"}
    csi_body = "\n".join(
        [
            instance(
                "mantis-ee:TACHYON_CSI1_22P",
                "J_CSI",
                "TACHYON_CSI1_22P",
                90.0,
                70.0,
                "JCSI",
                pins["TACHYON_CSI1_22P"],
                tach_nets,
                noconnects=["17", "18", "20", "21"],
            ),
            text(
                "Short local CSI to Tachyon CSI1. Connector MPN UNVERIFIED. Pinout from TACHYON V1.2 image.\\n"
                "Raw MIPI does not go back onto B27. Raspberry Pi camera modules are not assumed.\\n"
                "Tachyon SKU among TACH4NA/TACH8NA/TACH8ROW is UNVERIFIED. No SBC footprint in #23.",
                25.4,
                145.0,
                "rx-csi-note",
            ),
        ]
    )
    sheets = {
        "01-b27-des": sheet_file(
            "Indexed B27 dock and MAX96724 GMSL input",
            "2",
            libs,
            gmsl_body,
            "sheet:01-b27-des",
            COMMENT,
        ),
        "02-local-csi-tachyon": sheet_file(
            "Deserializer local CSI to Tachyon CSI1",
            "3",
            libs,
            csi_body,
            "sheet:02-local-csi-tachyon",
            COMMENT,
        ),
    }
    boxes = [
        ("01-b27-des", "B27 dock / MAX96724", uid("sheet:01-b27-des"), 25.4, 25.4),
        ("02-local-csi-tachyon", "local CSI / Tachyon CSI1", uid("sheet:02-local-csi-tachyon"), 130.0, 25.4),
    ]
    note = (
        "rail-rx (issue 25). Indexed dock. MIPI is local to MAX96724 and Tachyon CSI1.\\n"
        "Serialized GMSL only on B27 P09-P12. Video-while-rolling is out of v1.\\n"
        "#23 library unadmitted. No invented MPN. Theoretical class. Not a shop release."
    )
    sch = root_sheet(
        "Mantis EE-03 rail-rx",
        boxes,
        note,
        [(uid("sheet:01-b27-des"), "2"), (uid("sheet:02-local-csi-tachyon"), "3")],
    )
    nets = sorted(set(B27_NETS.values()) | set(CSI_MAP.values()) | {"CAM_3V3", "VDD_DES", "GND"})
    net_ids = {n: i + 1 for i, n in enumerate(nets)}
    fpc_pad_nets = {**CSI_MAP, **{p: "GND" for p in GND_22}, "22": "CAM_3V3"}
    fps = "\n".join(
        [
            footprint(
                "mantis-ee:B27_RAIL_12NET_TARGET-2.54mm_UNVERIFIED-series",
                "J27",
                25.0,
                20.0,
                "pj27rx",
                B27_PADS,
                B27_NETS,
                net_ids,
            ),
            courtyard_only("mantis-ee:MAX96724_PACKAGE_UNVERIFIED", "U_DES", 55.0, 20.0, "pdes"),
            footprint(
                "mantis-ee:FPC-22_0.5mm_UNVERIFIED-MPN",
                "J_CSI",
                80.0,
                20.0,
                "pcsi",
                FPC22_PADS,
                fpc_pad_nets,
                net_ids,
                size=(0.3, 1.2),
            ),
        ]
    )
    pcb = pcb_file(
        "rail-rx",
        nets,
        fps,
        "",
        "Deserializer has no pad map. Local CSI on FPC-22 only. Do not invent launch geometry.",
        100.0,
        40.0,
    )
    netmap = {
        "schema": "mantis.ee.rail-rx.net-map.v1",
        "issue": 25,
        "status": "UNVERIFIED",
        "rawMipiOnPogos": False,
        "nodes": {
            "GMSL_P": "B27 P10 into MAX96724 envelope B1",
            "GMSL_N": "B27 P11 into MAX96724 envelope B2",
            "CSI_*": "local MIPI to Tachyon CSI1; not on B27",
            "VDD_DES": "UNVERIFIED local rail; pad map missing",
        },
        "b27": B27_NETS,
        "tachyonCsi1": "TACHYON_CSI1_22P; connector MPN UNVERIFIED",
    }
    write_board(RX, "rail-rx", sch, sheets, pcb, netmap)
    (RX / "README.md").write_text(
        """# Mantis EE-03 rail-rx (issue 25)

Theoretical / `UNVERIFIED`. Not a shop release.

Indexed B27 dock, MAX96724 envelope, short local CSI to Tachyon CSI1.
MIPI does not ride B27. MAX96724 suffix/pad map UNVERIFIED.

Regenerate with `python3 ../../../simulations/electrical/channel/tools/generate_kicad.py`.
"""
    )
    (RX / "erc-waivers.md").write_text(
        """# ERC waivers (issue 25 rail-rx)

| Item | Disposition |
| --- | --- |
| kicad-cli ERC not run | Waiver: tool absent. |
| MAX96724 footprint has no pads | Expected. analog.com PDF timed out. |
| One GMSL input only | Envelope from #23. Do not invent the other three family ports. |
| UNVERIFIED B27 series | #23 envelopes; do not fabricate. |
"""
    )


def main() -> None:
    lib = load_lib()
    emit_camera(lib)
    emit_carriage(lib)
    emit_rail_rx(lib)
    print("wrote camera-tx, carriage, rail-rx KiCad projects")


if __name__ == "__main__":
    main()
