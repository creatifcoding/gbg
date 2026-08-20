"""Python Draft 2020-12 checker for the shared environment schema fixtures."""

from __future__ import annotations

import json
from pathlib import Path
import sys

from jsonschema import Draft202012Validator, FormatChecker


def load(path: Path) -> object:
    return json.loads(path.read_text(encoding="utf-8"))


def main(argv: list[str] | None = None) -> int:
    args = argv if argv is not None else sys.argv[1:]
    if len(args) != 3:
        print("usage: schema_check.py SCHEMA POSITIVE NEGATIVE", file=sys.stderr)
        return 64
    schema_path, positive_path, negative_path = map(Path, args)
    schema = load(schema_path)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    positive_errors = list(validator.iter_errors(load(positive_path)))
    negative_errors = list(validator.iter_errors(load(negative_path)))
    if positive_errors:
        print("positive fixture must validate", file=sys.stderr)
        for error in positive_errors:
            print(error.message, file=sys.stderr)
        return 1
    if not negative_errors:
        print("negative fixture must not validate", file=sys.stderr)
        return 1
    print("python jsonschema: positive ok, negative rejected")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
