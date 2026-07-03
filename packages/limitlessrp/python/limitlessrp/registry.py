from __future__ import annotations

import json
from pathlib import Path
from typing import Any

_REQUIRED_FIELDS = {
    "id",
    "title",
    "publisher",
    "url",
    "sourceClass",
    "trustTier",
    "refreshCadence",
    "expectedFields",
}


def package_root() -> Path:
    return Path(__file__).resolve().parents[2]


def load_source_registry(path: str | Path | None = None) -> list[dict[str, Any]]:
    registry_path = Path(path) if path is not None else package_root() / "data" / "sources" / "iridium.sources.json"
    with registry_path.open("r", encoding="utf-8") as fh:
        data = json.load(fh)
    validate_source_registry(data)
    return data


def validate_source_registry(data: Any) -> None:
    if not isinstance(data, list):
        raise TypeError("source registry must be a list")
    for index, entry in enumerate(data):
        if not isinstance(entry, dict):
            raise TypeError(f"source entry {index} must be an object")
        missing = sorted(_REQUIRED_FIELDS.difference(entry))
        if missing:
            raise ValueError(f"source entry {index} missing fields: {', '.join(missing)}")
        if not isinstance(entry["expectedFields"], list) or not entry["expectedFields"]:
            raise ValueError(f"source entry {entry['id']} expectedFields must be a non-empty list")
