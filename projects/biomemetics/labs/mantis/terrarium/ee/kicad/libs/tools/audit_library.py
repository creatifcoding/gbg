#!/usr/bin/env python3
"""Pin-to-pad audit for the Mantis EE-01 KiCad library.

KiCad is not in this runtime. This checker is the local lever: every
non-placeholder pin number must exist as a footprint pad.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SYM = ROOT / "symbols" / "mantis-ee.kicad_sym"
PRETTY = ROOT / "footprints" / "mantis-ee.pretty"
AUDIT = ROOT / "pin-pad-audit.json"


def pads_in(mod: Path) -> set[str]:
    return set(re.findall(r'\(pad "([^"]+)"', mod.read_text()))


def pin_numbers(sym_text: str, name: str) -> set[str]:
    block = re.search(
        rf'\(symbol "{re.escape(name)}"(.*?)(?=\n  \(symbol "|\n\)\s*\Z)',
        sym_text,
        re.S,
    )
    if not block:
        return set()
    return set(re.findall(r'\(number "([^"]+)"', block.group(1)))


def main() -> int:
    audit = json.loads(AUDIT.read_text())
    sym = SYM.read_text()
    fp_pads = {p.stem: pads_in(p) for p in PRETTY.glob("*.kicad_mod")}
    failures: list[str] = []
    sourced = 0
    unverified = 0
    for row in audit["rows"]:
        fp = row["footprint"]
        pad = str(row["pad"])
        pin = str(row["pinNumber"])
        st = row["status"]
        if "UNVERIFIED" in st:
            unverified += 1
        else:
            sourced += 1
        if fp not in fp_pads:
            failures.append(f"missing footprint {fp} for {row['symbol']}")
            continue
        if pad not in fp_pads[fp]:
            failures.append(f"{row['symbol']} pin {pin} pad {pad} not in {fp}")
        if pin != pad:
            failures.append(f"{row['symbol']} pinNumber {pin} != pad {pad}")
        pins = pin_numbers(sym, row["symbol"])
        if pins and pin not in pins:
            failures.append(f"{row['symbol']} pin {pin} missing from symbol")
    report = {
        "rows": len(audit["rows"]),
        "sourcedOrContract": sourced,
        "unverified": unverified,
        "footprints": sorted(fp_pads),
        "failures": failures,
        "kicadCli": "absent",
        "erc": "not-run",
    }
    print(json.dumps(report, indent=2))
    (ROOT / "audit-report.json").write_text(json.dumps(report, indent=2) + "\n")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
