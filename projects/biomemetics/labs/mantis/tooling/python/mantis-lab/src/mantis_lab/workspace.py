"""Workspace discovery and conservative structural validation."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


WORKSPACE_FILE = "workspace.json"
WORKSPACE_KIND = "BiomemeticsLabWorkspace"
WORKSPACE_ID = "biomemetics.mantis"


class WorkspaceError(ValueError):
    """Raised when the workspace contract is absent or structurally invalid."""


def discover_workspace(start: Path | str = ".") -> Path:
    """Walk upward until the mantis workspace manifest is found."""

    current = Path(start).resolve()
    if current.is_file():
        current = current.parent
    for candidate in (current, *current.parents):
        if (candidate / WORKSPACE_FILE).is_file():
            return candidate
    raise WorkspaceError(f"could not find {WORKSPACE_FILE} above {current}")


def load_workspace(root: Path | str) -> dict[str, Any]:
    """Load the shared JSON contract without inferring absent biological facts."""

    root_path = Path(root).resolve()
    path = root_path / WORKSPACE_FILE
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise WorkspaceError(f"missing workspace manifest: {path}") from exc
    except json.JSONDecodeError as exc:
        raise WorkspaceError(f"invalid JSON in {path}: {exc}") from exc

    if not isinstance(value, dict):
        raise WorkspaceError("workspace manifest must be a JSON object")
    if value.get("kind") != WORKSPACE_KIND:
        raise WorkspaceError(f"workspace kind must be {WORKSPACE_KIND!r}")
    if value.get("workspaceId") != WORKSPACE_ID:
        raise WorkspaceError(f"workspaceId must be {WORKSPACE_ID!r}")
    projects = value.get("projects")
    if not isinstance(projects, dict) or not projects:
        raise WorkspaceError("workspace projects must be a non-empty object map")

    repository_path = value.get("repositoryPath")
    if repository_path != "projects/biomemetics/labs/mantis":
        raise WorkspaceError("workspace repositoryPath does not match its durable boundary")

    for collection_name in ("lanes", "members", "projects"):
        collection = value.get(collection_name)
        if not isinstance(collection, dict):
            raise WorkspaceError(f"workspace {collection_name} must be an object map")
        for key, entry in collection.items():
            if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
                raise WorkspaceError(f"workspace {collection_name}.{key} needs a path")
            relative = Path(entry["path"])
            if relative.is_absolute() or ".." in relative.parts:
                raise WorkspaceError(
                    f"workspace {collection_name}.{key} path must stay inside the workspace"
                )
    return value
