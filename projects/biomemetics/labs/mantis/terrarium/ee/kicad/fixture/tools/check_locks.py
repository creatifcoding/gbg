#!/usr/bin/env python3
"""Lock and package checks for issue 26. Does not claim measured SI/PI."""

from __future__ import annotations

import hashlib
import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parents[1]
KICAD = HERE.parent
EE = KICAD.parent
TERR = EE.parent
WRITE_ROOTS = [
    TERR / "ee" / "kicad" / "fixture",
    TERR / "ee" / "coupons",
    TERR / "ee" / "fab" / "prototype",
]
FORBIDDEN_TOUCH = [
    TERR / "BOM.md",
    TERR / "params.json",
    TERR / "bus.json",
    TERR.parent / ".agents" / "control" / "workstreams.json",
    EE / "kicad" / "system",
    TERR / "cad" / "assembly",
    EE / "kicad" / "camera-tx",
    EE / "kicad" / "carriage",
    EE / "kicad" / "rail-rx",
    EE / "kicad" / "libs",
    EE / "kicad" / "power-control",
    EE / "kicad" / "contracts",
]
MARKING = "LAB COUPON — CONCEPT VALIDATION — NOT FOR ANIMAL USE"
CLASS = "PROTO-FAB DRAFT — UNQUALIFIED — NOT A SHOP RELEASE"
REQUIRED_SHEETS = [
    "01-cal-2xthru-osl",
    "02-ser-launch-refplane",
    "03-b50-only",
    "04-carriage-route",
    "05-b27-b19",
    "06-rx-launch-refplane",
    "07-full-channel",
    "08-power-s1s2q1-fault",
]
REQUIRED_STRUCTURES = [
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
]


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    raise SystemExit(1)


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def main() -> None:
    pcb = (HERE / "fixture.kicad_pcb").read_text()
    sch = (HERE / "fixture.kicad_sch").read_text()
    netmap = json.loads((HERE / "net-map.json").read_text())
    maturity = json.loads((TERR / "ee" / "fab" / "prototype" / "maturity.json").read_text())
    coupons = json.loads((TERR / "ee" / "coupons" / "coupon-map.json").read_text())

    if MARKING not in pcb or MARKING not in sch:
        fail("visible coupon marking missing")
    if CLASS not in pcb:
        fail("PROTO-FAB UNQUALIFIED silk missing")
    if "NOT FOR ANIMAL USE" not in pcb:
        fail("animal-use prohibition missing")

    for name in REQUIRED_SHEETS:
        path = HERE / "sheets" / f"{name}.kicad_sch"
        if not path.is_file():
            fail(f"missing sheet {name}")
        body = path.read_text()
        if MARKING not in body:
            fail(f"sheet {name} missing coupon marking")

    if netmap.get("qualified") is not False:
        fail("net-map must set qualified=false")
    if netmap.get("measuredSiPi") is not False:
        fail("must not claim measured SI/PI")
    if netmap.get("rawMipiOnPogos") is not False:
        fail("MIPI must not ride pogos")
    if netmap.get("videoWhileRolling") is not False:
        fail("video-while-rolling must stay out of v1")
    if netmap.get("p08SafetyAuthority") is not False:
        fail("P08 must not be safety authority")
    if netmap.get("maturity") != "PROTO-FAB":
        fail("maturity must be PROTO-FAB")
    if netmap.get("shopRelease") is not False:
        fail("must not be a shop release")

    missing = [s for s in REQUIRED_STRUCTURES if s not in netmap.get("structures", [])]
    if missing:
        fail(f"incomplete coupon structures: {missing}")
    missing_c = [s for s in REQUIRED_STRUCTURES if s not in coupons.get("structures", {})]
    if missing_c:
        fail(f"coupon-map missing structures: {missing_c}")

    for token in ("CSI_D0", "CSI_CLK", "CAM_3V3"):
        if token in pcb:
            fail(f"raw MIPI token {token} appeared on the fixture PCB")

    invented = []
    for path in HERE.rglob("*"):
        if path.suffix not in {".kicad_sch", ".kicad_pcb", ".json", ".md"}:
            continue
        text = path.read_text(errors="ignore")
        for line in text.splitlines():
            if '"MPN"' in line or "MPN:" in line:
                if "UNVERIFIED" not in line and "unverified" not in line.lower():
                    invented.append(f"{path}:{line.strip()}")
    if invented:
        fail(f"invented or filled MPN: {invented[:8]}")

    for rel in (
        "power-control/net-map.json",
        "camera-tx/net-map.json",
        "carriage/net-map.json",
        "rail-rx/net-map.json",
        "libs/symbols/mantis-ee.kicad_sym",
    ):
        if not (EE / "kicad" / rel).is_file():
            fail(f"parent consume missing: {rel}")

    if shutil.which("kicad-cli"):
        print("note: kicad-cli present; ERC/Gerber still not claimed executed this check")
    else:
        print("kicad-cli absent: ERC/DRC/Gerber remain listed waivers")

    if maturity.get("maturity") != "PROTO-FAB":
        fail("package maturity must be PROTO-FAB")
    if maturity.get("qualified") is not False:
        fail("package must remain unqualified")
    if maturity.get("humanApprovalRequired") is not True:
        fail("human approval flag missing")

    fab_out = TERR / "ee" / "fab" / "prototype" / "outputs" / "planning"
    fab_out.mkdir(parents=True, exist_ok=True)
    export_status = {
        "schema": "mantis.ee.proto-fab.export-status.v1",
        "issue": 26,
        "maturity": "PROTO-FAB",
        "qualified": False,
        "kicadCli": shutil.which("kicad-cli") is not None,
        "executed": {
            "gerberX2": False,
            "excellon": False,
            "position": False,
            "assemblyPdf": False,
            "fabricationPdf": False,
            "netlist": False,
            "step": False,
            "erc": False,
            "drc": False,
            "ipcD356": False,
            "ipc2581": False,
            "odbpp": False,
            "camReimport": False,
        },
        "reason": "kicad-cli absent and fabricator/stackup UNVERIFIED. Do not invent export artifacts.",
        "ipc2581": "not claimed; pinned tool/fabricator path unverified",
        "odbpp": "not claimed; pinned tool/fabricator path unverified",
        "manifest": "outputs/planning/manifest.sha256",
    }
    (fab_out / "export-status.json").write_text(json.dumps(export_status, indent=2) + "\n")

    files = []
    for root in WRITE_ROOTS:
        for path in sorted(root.rglob("*")):
            if path.is_file() and path.name != "manifest.sha256":
                files.append(path)
    lines = []
    for path in files:
        rel = path.relative_to(TERR)
        lines.append(f"{sha256(path)}  {rel.as_posix()}")
    manifest = fab_out / "manifest.sha256"
    manifest.write_text("\n".join(lines) + "\n")

    print("issue 26 lock check passed")
    print(f"hashed {len(files)} write-set files -> {manifest}")


if __name__ == "__main__":
    main()
