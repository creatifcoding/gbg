"""Deterministic artifact manifests with separated generate/review/verify roles."""

from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from hashlib import sha256
import json
from pathlib import Path, PurePosixPath
from typing import Iterable, Sequence


class ArtifactError(ValueError):
    """Raised for unsafe paths, missing files, or digest mismatches."""


BASELINE_NAMES = frozenset({"MANIFEST.sha256", "manifest.sha256"})


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
    """Generate a digest manifest. Always lifecycle=generated; never a baseline."""

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
        "schemaVersion": "1.0.0",
        "kind": "ArtifactDigestManifest",
        "lifecycle": "generated",
        "algorithm": "sha256",
        "artifacts": [asdict(artifact) for artifact in artifacts],
    }


def review_manifest(
    manifest: dict[str, object],
    *,
    reviewer: str,
    notes: str,
    reviewed_at: str | None = None,
) -> dict[str, object]:
    """Promote a generated manifest to reviewed. Does not recompute digests."""

    if manifest.get("lifecycle") not in {None, "generated"}:
        raise ArtifactError("only generated manifests can be reviewed")
    reviewed = dict(manifest)
    reviewed["schemaVersion"] = reviewed.get("schemaVersion", "1.0.0")
    reviewed["kind"] = "ArtifactDigestManifest"
    reviewed["lifecycle"] = "reviewed"
    reviewed["review"] = {
        "reviewer": reviewer,
        "reviewedAt": reviewed_at
        or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace(
            "+00:00", "Z"
        ),
        "notes": notes,
    }
    return reviewed


def verify_manifest(root: Path, manifest: dict[str, object]) -> Sequence[str]:
    """Check declared digests against the tree. Does not mint or rewrite manifests."""

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


def verify_certifiable_manifest(
    root: Path, manifest: dict[str, object]
) -> Sequence[str]:
    """Integrity gate: only reviewed or immutable-baseline manifests may certify."""

    failures = list(verify_manifest(root, manifest))
    lifecycle = manifest.get("lifecycle")
    if lifecycle == "generated" or lifecycle is None:
        failures.append(
            "lifecycle generated cannot certify a baseline; review first (ADR-003)"
        )
    if lifecycle in {"reviewed", "immutable-baseline"} and not isinstance(
        manifest.get("review"), dict
    ):
        failures.append("reviewed/immutable-baseline manifests require review metadata")
    return failures


def write_manifest(path: Path, manifest: dict[str, object]) -> None:
    if path.name in BASELINE_NAMES:
        raise ArtifactError(
            f"refusing to mint baseline filename {path.name}; verifier/generator separation"
        )
    if path.suffix == ".sha256" and "MANIFEST" in path.name.upper():
        raise ArtifactError(
            f"refusing to mint baseline path {path}; generate and certify stay separate"
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
