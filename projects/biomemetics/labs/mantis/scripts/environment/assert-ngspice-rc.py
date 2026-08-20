#!/usr/bin/env python3
"""Assert ngspice RC transient reached near DC at end of run."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    path = Path(sys.argv[1])
    text = path.read_text(encoding="utf-8", errors="replace")
    # Look for final v(out) near 1.0 V (tau=1ms, t=5ms => ~99.3%).
    values: list[float] = []
    for line in text.splitlines():
        # ngspice print formats vary; accept "v(out) = 9.9e-01" style or columns.
        m = re.search(r"v\(out\)\s*=\s*([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)", line)
        if m:
            values.append(float(m.group(1)))
            continue
        parts = line.split()
        if len(parts) >= 2 and re.fullmatch(r"[+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?", parts[-1]):
            # skip headers
            if parts[0].lower() in {"index", "time", "#"}:
                continue
            try:
                values.append(float(parts[-1]))
            except ValueError:
                pass
    if not values:
        print("no v(out) samples parsed", file=sys.stderr)
        return 1
    final = values[-1]
    if final < 0.95:
        print(f"final v(out)={final} below 0.95", file=sys.stderr)
        return 1
    print(f"ok final_v_out={final}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
