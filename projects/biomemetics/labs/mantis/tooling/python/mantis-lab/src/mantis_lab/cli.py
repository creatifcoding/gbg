"""Command-line entry point for deterministic workspace operations."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys

from .artifacts import (
    build_manifest,
    review_manifest,
    verify_certifiable_manifest,
    verify_manifest,
    write_manifest,
)
from .corpus import CorpusError, run_corpus
from .task_packets import TaskPacketError, generate_task_packets
from .terrarium import validate_draft_b, propose_bus_camera_path_delta
from .workspace import discover_workspace, load_workspace


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(prog="mantis-lab")
    root.add_argument("--workspace", type=Path, default=None)
    commands = root.add_subparsers(dest="command", required=True)

    commands.add_parser("check-workspace")
    commands.add_parser("check-terrarium")
    commands.add_parser("run-corpus")
    commands.add_parser("propose-bus-delta")

    packets = commands.add_parser("generate-task-packets")
    packets.add_argument("--base-sha", required=True)

    generate = commands.add_parser("manifest")
    generate.add_argument("--output", type=Path, required=True)
    generate.add_argument("paths", nargs="+")

    review = commands.add_parser("review-manifest")
    review.add_argument("manifest", type=Path)
    review.add_argument("--output", type=Path, required=True)
    review.add_argument("--reviewer", required=True)
    review.add_argument("--notes", required=True)

    verify = commands.add_parser("verify-manifest")
    verify.add_argument("manifest", type=Path)
    verify.add_argument(
        "--certify",
        action="store_true",
        help="Require reviewed/immutable-baseline lifecycle (never mint).",
    )
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

    if args.command == "run-corpus":
        try:
            results = run_corpus(workspace)
        except CorpusError as exc:
            print(json.dumps({"ok": False, "error": str(exc)}, sort_keys=True))
            return 1
        print(json.dumps({"ok": True, "results": results}, sort_keys=True))
        return 0

    if args.command == "propose-bus-delta":
        delta = propose_bus_camera_path_delta(workspace)
        print(json.dumps(delta, indent=2, sort_keys=True))
        return 0

    if args.command == "generate-task-packets":
        try:
            written = generate_task_packets(workspace, base_sha=args.base_sha)
        except TaskPacketError as exc:
            print(json.dumps({"ok": False, "error": str(exc)}, sort_keys=True))
            return 1
        print(
            json.dumps(
                {"ok": True, "packets": [str(path) for path in written]},
                sort_keys=True,
            )
        )
        return 0

    if args.command == "manifest":
        manifest = build_manifest(workspace, args.paths)
        output = args.output if args.output.is_absolute() else workspace / args.output
        write_manifest(output, manifest)
        print(output)
        return 0

    if args.command == "review-manifest":
        manifest_path = (
            args.manifest if args.manifest.is_absolute() else workspace / args.manifest
        )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        reviewed = review_manifest(
            manifest, reviewer=args.reviewer, notes=args.notes
        )
        output = args.output if args.output.is_absolute() else workspace / args.output
        write_manifest(output, reviewed)
        print(output)
        return 0

    if args.command == "verify-manifest":
        manifest_path = (
            args.manifest if args.manifest.is_absolute() else workspace / args.manifest
        )
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if args.certify:
            failures = verify_certifiable_manifest(workspace, manifest)
        else:
            failures = verify_manifest(workspace, manifest)
        print(json.dumps({"ok": not failures, "failures": failures}, sort_keys=True))
        return 0 if not failures else 1

    return 2


if __name__ == "__main__":
    sys.exit(main())
