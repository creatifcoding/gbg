"""Independent artifact-manifest verifier.

This module never generates or repairs a manifest. A digest mismatch is a
failure, not a rewrite.
"""

from __future__ import annotations

from pathlib import Path, PurePosixPath
from typing import Any

from .digest import sha256_file


class ManifestError(ValueError):
    pass


def safe_path(root: Path, relative: str) -> Path:
    logical = PurePosixPath(relative)
    if logical.is_absolute() or ".." in logical.parts:
        raise ManifestError(f"path escapes root: {relative}")
    target = (root / Path(*logical.parts)).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError as exc:
        raise ManifestError(f"path escapes root: {relative}") from exc
    return target


def verify_manifest(root: Path, manifest: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    if manifest.get("algorithm") != "sha256":
        failures.append("manifest algorithm must be sha256")
    records = manifest.get("artifacts")
    if not isinstance(records, list):
        return failures + ["manifest artifacts must be an array"]
    for index, record in enumerate(records):
        if not isinstance(record, dict):
            failures.append(f"artifact[{index}] must be an object")
            continue
        relative = record.get("path")
        expected = record.get("sha256")
        if not isinstance(relative, str) or not isinstance(expected, str):
            failures.append(f"artifact[{index}] needs string path and sha256")
            continue
        try:
            target = safe_path(root, relative)
        except ManifestError as exc:
            failures.append(str(exc))
            continue
        if not target.is_file():
            failures.append(f"missing artifact: {relative}")
            continue
        observed = sha256_file(target)
        if observed != expected:
            failures.append(
                f"sha256 mismatch: {relative}: expected {expected}, observed {observed}"
            )
        size = record.get("bytes")
        if isinstance(size, int) and target.stat().st_size != size:
            failures.append(
                f"size mismatch: {relative}: expected {size}, observed {target.stat().st_size}"
            )
    return failures
