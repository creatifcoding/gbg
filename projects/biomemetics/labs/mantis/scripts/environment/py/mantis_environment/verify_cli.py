"""CLI entry for the independent report verifier."""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys

from .verify_report import verify_report


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    if not args:
        print("usage: python -m mantis_environment.verify_cli REPORT.json", file=sys.stderr)
        return 64
    report_path = Path(args[0])
    lab_root = Path(os.environ.get("MANTIS_LAB_ROOT") or Path.cwd())
    report = json.loads(report_path.read_text(encoding="utf-8"))
    failures = verify_report(lab_root, report)
    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    print(json.dumps({"ok": True, "report": str(report_path)}, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
