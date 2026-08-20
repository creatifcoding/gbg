#!/usr/bin/env python3
"""Validate positive/negative JSON Schema fixtures for mantis doctor."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator, FormatChecker


def load(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--lab-root", type=Path, required=True)
    parser.add_argument("--fixtures", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()

    schema = load(args.lab_root / "contracts" / "params.schema.json")
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())

    positive = args.fixtures / "params.positive.json"
    negative = args.fixtures / "params.negative.json"
    results: dict[str, object] = {"positive": None, "negative": None}

    pos_errors = sorted(validator.iter_errors(load(positive)), key=lambda e: list(e.path))
    if pos_errors:
        results["positive"] = [e.message for e in pos_errors]
        args.out.write_text(json.dumps(results, indent=2), encoding="utf-8")
        print("positive fixture unexpectedly failed", file=sys.stderr)
        return 1
    results["positive"] = "ok"

    neg_errors = list(validator.iter_errors(load(negative)))
    if not neg_errors:
        results["negative"] = "expected failure, got success"
        args.out.write_text(json.dumps(results, indent=2), encoding="utf-8")
        print("negative fixture unexpectedly passed", file=sys.stderr)
        return 1
    results["negative"] = "rejected-as-expected"

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(results, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
