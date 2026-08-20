"""Draft 2020-12 corpus runner shared by acceptance tests."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

try:
    from jsonschema import Draft202012Validator, FormatChecker
except ImportError:  # pragma: no cover - environment gate
    Draft202012Validator = None  # type: ignore[misc, assignment]
    FormatChecker = None  # type: ignore[misc, assignment]


class CorpusError(RuntimeError):
    """Raised when the corpus cannot run or disagrees with expectations."""


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def run_corpus(workspace: Path) -> list[dict[str, Any]]:
    if Draft202012Validator is None or FormatChecker is None:
        raise CorpusError(
            "jsonschema is absent; install mantis-lab[contracts] or enter nix develop"
        )

    catalog_path = workspace / "evidence/fixtures/corpus/catalog.json"
    catalog = load_json(catalog_path)
    cases = catalog.get("cases")
    if not isinstance(cases, list):
        raise CorpusError("corpus catalog requires cases[]")

    results: list[dict[str, Any]] = []
    failures: list[str] = []
    for case in cases:
        if not isinstance(case, dict):
            failures.append("corpus case must be an object")
            continue
        case_id = str(case.get("id"))
        instance_rel = str(case.get("instance"))
        schema_rel = str(case.get("schema"))
        expect = case.get("expect")
        instance = load_json(workspace / instance_rel)
        schema = load_json(workspace / schema_rel)
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema, format_checker=FormatChecker())
        errors = sorted(validator.iter_errors(instance), key=lambda item: list(item.path))
        ok = len(errors) == 0
        expected_ok = expect == "pass"
        matched = ok == expected_ok
        entry = {
            "id": case_id,
            "expect": expect,
            "ok": ok,
            "matched": matched,
            "errorCount": len(errors),
        }
        results.append(entry)
        if not matched:
            detail = "; ".join(error.message for error in errors[:3]) or "unexpected pass"
            failures.append(f"{case_id}: expected {expect}, got ok={ok} ({detail})")

    if failures:
        raise CorpusError("\n".join(failures))
    return results
