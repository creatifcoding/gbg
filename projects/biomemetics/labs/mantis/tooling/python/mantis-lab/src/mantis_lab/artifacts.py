"""Deterministic artifact manifests for generated and source files."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from hashlib import sha256
import json
from pathlib import Path, PurePosixPath
from typing import Iterable, Sequence


class ArtifactError(ValueError):
    """Raised for unsafe paths, missing files, or digest mismatches."""


@dataclass(frozen=True, slots=True)
class Artifact:
    id: str
    path: str
    sha256: str
    bytes: int
    role: str
    status: str


def sha256_file(path: Path, chunk_size: int = 1024 * 1024) -> str:
    digest = sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(chunk_size):
            digest.update(chunk)
    return digest.hexdigest()


def safe_artifact_path(root: Path, relative: str) -> Path:
    logical = PurePosixPath(relative)
    if logical.is_absolute() or ".." in logical.parts:
        raise ArtifactError(f"artifact path escapes workspace: {relative}")
    target = (root / Path(*logical.parts)).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError as exc:
        raise ArtifactError(f"artifact path escapes workspace: {relative}") from exc
    return target


def build_manifest(
    root: Path,
    paths: Iterable[str],
    *,
    role: str = "artifact",
    status: str = "unverified",
) -> dict[str, object]:
    artifacts: list[Artifact] = []
    for relative in sorted(set(paths)):
        target = safe_artifact_path(root, relative)
        if not target.is_file():
            raise ArtifactError(f"artifact does not exist: {relative}")
        artifacts.append(
            Artifact(
                id=relative.replace("/", ":"),
                path=relative,
                sha256=sha256_file(target),
                bytes=target.stat().st_size,
                role=role,
                status=status,
            )
        )
    return {
        "schemaVersion": 1,
        "algorithm": "sha256",
        "artifacts": [asdict(artifact) for artifact in artifacts],
    }


def verify_manifest(root: Path, manifest: dict[str, object]) -> Sequence[str]:
    failures: list[str] = []
    records = manifest.get("artifacts")
    if not isinstance(records, list):
        return ["manifest artifacts must be an array"]
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
            target = safe_artifact_path(root, relative)
        except ArtifactError as exc:
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
    return failures


def write_manifest(path: Path, manifest: dict[str, object]) -> None:
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

