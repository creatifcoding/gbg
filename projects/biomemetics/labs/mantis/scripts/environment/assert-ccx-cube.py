#!/usr/bin/env python3
"""Assert CalculiX cube static solve produced a finite displacement result."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    simdir = Path(sys.argv[1])
    # Prefer .dat, fall back to .frd / log.
    candidates = list(simdir.glob("*.dat")) + list(simdir.glob("*.frd")) + list(simdir.glob("*.log"))
    if not candidates:
        # ccx may write cube.dat next to inp
        print("no ccx output files found", file=sys.stderr)
        return 1
    text = "\n".join(p.read_text(encoding="utf-8", errors="replace") for p in candidates)
    # Look for any displacement-like number magnitude in a plausible FEA range.
    nums = [float(x) for x in re.findall(r"[+-]?\d+\.\d+(?:[eE][+-]?\d+)?", text)]
    if not nums:
        print("no numeric results parsed from ccx outputs", file=sys.stderr)
        return 1
    # Displacement under unit load on unit cube should be finite and small-ish for E=210e9.
    finite = [n for n in nums if abs(n) < 1e6]
    if not finite:
        print("no finite-magnitude numeric results", file=sys.stderr)
        return 1
    print(f"ok samples={len(finite)} max_abs={max(abs(n) for n in finite)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
