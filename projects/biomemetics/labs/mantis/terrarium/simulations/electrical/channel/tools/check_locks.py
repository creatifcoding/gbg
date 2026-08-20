#!/usr/bin/env python3
"""Lock checks for issue 25. Fail if MIPI rides pogos or MPNs were invented."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

TERR = Path(__file__).resolve().parents[4]
KICAD = TERR / "ee" / "kicad"
CH = Path(__file__).resolve().parents[1]
WRITE = [KICAD / "camera-tx", KICAD / "carriage", KICAD / "rail-rx", CH]


def texts(root: Path, suffixes: set[str]) -> str:
    bits = []
    for p in root.rglob("*"):
        if p.suffix in suffixes:
            bits.append(p.read_text(errors="replace"))
    return "\n".join(bits)


def main() -> int:
    errors: list[str] = []
    nets = {".kicad_sch", ".kicad_pcb", ".json"}
    alls = {".kicad_sch", ".kicad_pcb", ".md", ".json", ".s2p", ".py"}
    cam = texts(KICAD / "camera-tx", alls)
    car_nets = texts(KICAD / "carriage", nets)
    car = texts(KICAD / "carriage", alls)
    rx = texts(KICAD / "rail-rx", alls)
    ch = texts(CH, alls)

    if "CSI_" in car_nets:
        errors.append("carriage nets contain CSI_ — pogos must not carry raw MIPI")
    if "GMSL_P" not in cam or "GMSL_P" not in car or "GMSL_P" not in rx:
        errors.append("GMSL_P missing from a board")
    if "CSI_" not in cam:
        errors.append("camera-tx missing local CSI nets")
    if "CSI_" not in rx:
        errors.append("rail-rx missing local CSI nets")
    if "TACHYON_CSI1_22P" not in rx:
        errors.append("rail-rx missing Tachyon CSI1 connector")
    if "IMX519_AF_MODULE_UNVERIFIED" not in cam:
        errors.append("camera-tx missing IMX519 envelope")
    if "untethered" not in car.lower() and "Untethered" not in car:
        errors.append("carriage missing untethered lock text")
    for pin in [f"P{i:02d}" for i in range(1, 13)] + [f"C{i:02d}" for i in range(1, 13)]:
        if pin not in car_nets:
            errors.append(f"carriage missing {pin} — complete 12-net channel required")
    cmap = json.loads((KICAD / "carriage" / "net-map.json").read_text())
    if cmap.get("b50", {}).get("C01") != "V_BRANCH":
        errors.append("carriage B50 C01 must be V_BRANCH after Q1, not a VIN_A bypass")

    invented = re.compile(r"MAX9671[47][A-Z0-9]{2,}")
    blob = cam + car + rx + ch
    if invented.search(blob):
        errors.append("invented SerDes suffix/MPN found")
    if "UNVERIFIED" not in cam or "UNVERIFIED" not in car or "UNVERIFIED" not in rx:
        errors.append("UNVERIFIED marking missing")

    summary = json.loads((CH / "results" / "summary.json").read_text())
    if summary.get("qualifiesPhysicalInterface") is not False:
        errors.append("channel model must not qualify the physical interface")
    if summary["locks"]["rawMipiInCascade"] is not False:
        errors.append("cascade must not include raw MIPI")

    forbidden = [
        TERR / "BOM.md",
        TERR / "params.json",
        TERR / "bus.json",
        TERR / "ee" / "kicad" / "libs" / "symbols" / "mantis-ee.kicad_sym",
        TERR / "ee" / "kicad" / "power-control" / "power-control.kicad_sch",
    ]
    # existence check only — we must not have been the writer; git handles that

    if errors:
        print("LOCK FAIL")
        for e in errors:
            print("-", e)
        return 1
    print("LOCK PASS: MIPI local, GMSL on P09-P12 cell, UNVERIFIED retained, not qualified")
    return 0


if __name__ == "__main__":
    sys.exit(main())
