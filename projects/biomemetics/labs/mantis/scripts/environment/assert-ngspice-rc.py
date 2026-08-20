#!/usr/bin/env python3
"""Assert ngspice RC transient charged toward DC by end of run."""

from __future__ import annotations

import re
import sys
from pathlib import Path


def main() -> int:
    path = Path(sys.argv[1])
    text = path.read_text(encoding="utf-8", errors="replace")

    rows: list[tuple[float, float]] = []
    in_table = False
    for line in text.splitlines():
        if re.search(r"Total analysis time", line, re.I):
            break
        if re.search(r"Index\s+time\s+v\(out\)", line, re.I):
            in_table = True
            continue
        if not in_table:
            continue
        if re.match(r"^-{5,}", line) or not line.strip():
            continue
        parts = line.split()
        if len(parts) >= 3:
            try:
                rows.append((float(parts[1]), float(parts[2])))
            except ValueError:
                continue

    if len(rows) < 2:
        print("no transient table rows parsed", file=sys.stderr)
        return 1

    t0, v0 = rows[0]
    t1, v1 = rows[-1]
    if v0 > 0.2:
        print(f"initial v(out)={v0} at t={t0} expected near 0", file=sys.stderr)
        return 1
    if v1 < 0.95:
        print(f"final v(out)={v1} at t={t1} below 0.95", file=sys.stderr)
        return 1
    print(f"ok v0={v0} v1={v1} samples={len(rows)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
