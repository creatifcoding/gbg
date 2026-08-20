"""Command-line entry point for deterministic workspace operations."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .artifacts import build_manifest, verify_manifest, write_manifest
from .terrarium import validate_draft_b
from .workspace import discover_workspace, load_workspace


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="mantis-lab")
    root.add_argument("--workspace", type=Path, default=None)
    commands = root.add_subparsers(dest="command", required=True)

    commands.add_parser("check-workspace")
    commands.add_parser("check-terrarium")

    generate = commands.add_parser("manifest")
    generate.add_argument("--output", type=Path, required=True)
    generate.add_argument("paths", nargs="+")

    verify = commands.add_parser("verify-manifest")
    verify.add_argument("manifest", type=Path)
    return root


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    workspace = args.workspace.resolve() if args.workspace else discover_workspace()

    if args.command == "check-workspace":
        value = load_workspace(workspace)
        print(
            json.dumps(
                {"ok": True, "workspace": value["workspaceId"]}, sort_keys=True
            )
        )
        return 0

    if args.command == "check-terrarium":
        failures = validate_draft_b(workspace)
        print(json.dumps({"ok": not failures, "failures": failures}, sort_keys=True))
        return 0 if not failures else 1

    if args.command == "manifest":
        manifest = build_manifest(workspace, args.paths)
        output = args.output if args.output.is_absolute() else workspace / args.output
        write_manifest(output, manifest)
        print(output)
        return 0

    if args.command == "verify-manifest":
        manifest_path = args.manifest if args.manifest.is_absolute() else workspace / args.manifest
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        failures = verify_manifest(workspace, manifest)
        print(json.dumps({"ok": not failures, "failures": failures}, sort_keys=True))
        return 0 if not failures else 1

    return 2


if __name__ == "__main__":
    sys.exit(main())
