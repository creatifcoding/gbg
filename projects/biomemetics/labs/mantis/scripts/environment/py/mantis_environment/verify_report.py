"""Independent doctor-report verifier.

Does not generate reports, does not run tool workflows, and does not repair
digests. It re-reads declared files and compares them to the report.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

from .digest import sha256_file
from .verify_manifest import ManifestError, safe_path


SCHEMA_RELATIVE = "scripts/environment/schema/doctor-report.v1.json"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def verify_report(lab_root: Path, report: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    schema_path = lab_root / SCHEMA_RELATIVE
    if not schema_path.is_file():
        return [f"missing report schema: {SCHEMA_RELATIVE}"]

    schema = load_json(schema_path)
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    for error in sorted(validator.iter_errors(report), key=lambda item: list(item.path)):
        logical = "/".join(str(part) for part in error.absolute_path) or "<root>"
        failures.append(f"schema: {logical}: {error.message}")

    lock_path = lab_root / "flake.lock"
    recorded_lock = (
        report.get("lab", {}).get("flakeLock") if isinstance(report.get("lab"), dict) else None
    )
    if isinstance(recorded_lock, dict) and lock_path.is_file():
        observed = sha256_file(lock_path)
        expected = recorded_lock.get("sha256")
        if expected != observed:
            failures.append(
                f"flake.lock sha256 mismatch: expected {expected}, observed {observed}"
            )
    elif not lock_path.is_file():
        failures.append("flake.lock is missing; the nested lock must be committed")

    fixtures = report.get("fixtures")
    if isinstance(fixtures, list):
        for index, fixture in enumerate(fixtures):
            if not isinstance(fixture, dict):
                failures.append(f"fixtures[{index}] must be an object")
                continue
            relative = fixture.get("path")
            expected = fixture.get("sha256")
            if not isinstance(relative, str) or not isinstance(expected, str):
                continue
            try:
                target = safe_path(lab_root, relative)
            except ManifestError as exc:
                failures.append(str(exc))
                continue
            if not target.is_file():
                failures.append(f"missing fixture: {relative}")
                continue
            observed = sha256_file(target)
            if observed != expected:
                failures.append(
                    f"fixture sha256 mismatch: {relative}: expected {expected}, observed {observed}"
                )

    return failures
