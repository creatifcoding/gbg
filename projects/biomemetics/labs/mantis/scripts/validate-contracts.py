#!/usr/bin/env python3
"""Validate checked-in workspace contracts with Draft 2020-12 semantics."""

from __future__ import annotations

import json
from pathlib import Path
import sys

try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError:
    print(
        "BLOCKED: jsonschema is absent; run inside `nix develop` or install "
        "mantis-lab[contracts]",
        file=sys.stderr,
    )
    raise SystemExit(69)


ROOT = Path(__file__).resolve().parents[1]
CASES = (
    (ROOT / "workspace.json", ROOT / "contracts" / "lab.schema.json"),
    (ROOT / "terrarium" / "params.json", ROOT / "contracts" / "params.schema.json"),
    (
        ROOT / "terrarium" / "bus.json",
        ROOT / "terrarium" / "contracts" / "bus.schema.json",
    ),
)


def load(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    failures: list[str] = []
    for instance_path, schema_path in CASES:
        instance = load(instance_path)
        schema = load(schema_path)
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        for error in sorted(validator.iter_errors(instance), key=lambda item: list(item.path)):
            logical = "/".join(str(part) for part in error.absolute_path) or "<root>"
            failures.append(f"{instance_path.relative_to(ROOT)}:{logical}: {error.message}")

    if failures:
        print("\n".join(failures), file=sys.stderr)
        return 1
    print(f"validated {len(CASES)} contract instances")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
