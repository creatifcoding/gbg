from __future__ import annotations

from .registry import load_source_registry


def main() -> None:
    registry = load_source_registry()
    classes = sorted({entry["sourceClass"] for entry in registry})
    if len(registry) < 5:
        raise SystemExit(f"expected at least 5 sources, got {len(registry)}")
    print({"ok": True, "sources": len(registry), "classes": classes})


if __name__ == "__main__":
    main()
