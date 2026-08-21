"""Deterministic task-packet generation from the workstream graph."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class TaskPacketError(ValueError):
    """Raised for unsafe paths or incomplete workstream entries."""


DEFAULT_STOP = [
    "second identical deterministic failure",
    "write-set growth exceeds 15%",
    "missing sourced pinout/model/limit",
    "new cross-domain decision required",
]

DEFAULT_READ = [
    "projects/biomemetics/labs/mantis/workspace.json",
    "projects/biomemetics/labs/mantis/GOAL.md",
    "projects/biomemetics/labs/mantis/docs/ARCHITECTURE.md",
    "projects/biomemetics/labs/mantis/contracts/",
    "projects/biomemetics/labs/mantis/.agents/control/workstreams.json",
]


def _confined(path: str) -> str:
    if path.startswith("/") or ".." in path.split("/"):
        raise TaskPacketError(f"path escapes workspace: {path}")
    return path


def packet_from_workstream(
    workstream: dict[str, Any],
    *,
    base_sha: str,
    model_policy: dict[str, Any],
) -> dict[str, Any] | None:
    issue = workstream.get("issue")
    if not isinstance(issue, int):
        return None

    role = workstream.get("role", "implementer")
    if role == "planner":
        model = "grok-4.6"
        mode = {"fast": False, "readOnly": False, "effort": "xhigh"}
    elif role == "reviewer":
        model = "grok-4.5"
        mode = {"fast": False, "readOnly": True}
    else:
        model = "grok-4.5"
        mode = {"fast": False, "readOnly": False}

    planner = model_policy.get("planner", {})
    implementer = model_policy.get("implementer", {})
    if role == "planner" and planner.get("model") == "grok-4.6":
        model = "grok-4.6"
    if role != "planner" and implementer.get("model") == "grok-4.5":
        model = "grok-4.5"

    write_set = [_confined(item) for item in workstream.get("writeSet", [])]
    acceptance = workstream.get("acceptance") or [
        "python3 -m mantis_lab.cli --workspace projects/biomemetics/labs/mantis run-corpus"
    ]
    locked = [
        "workspace.not-a-specimen",
        "terrarium.raw-mipi-local",
        "terrarium.break-before-move",
        "ADR-003",
        "ADR-004",
    ]
    return {
        "schemaVersion": "1.0.0",
        "kind": "TaskPacket",
        "issueId": issue,
        "workstreamId": workstream["id"],
        "baseSHA": base_sha,
        "model": model,
        "mode": mode,
        "writeSet": write_set,
        "readSet": list(DEFAULT_READ),
        "dependencies": list(workstream.get("dependencies", [])),
        "lockedDecisions": locked,
        "claimParameterRefs": [
            "contracts/interfaces.json",
            "terrarium/params.json",
        ],
        "sources": [
            "contracts/interfaces.json",
            "docs/ARCHITECTURE.md",
            "docs/EXECUTION.md",
        ],
        "acceptanceCommands": list(acceptance),
        "outputPaths": [
            f"projects/biomemetics/labs/mantis/.agents/control/packets/{issue}.json"
        ],
        "evidenceClass": "theoretical",
        "stopConditions": list(DEFAULT_STOP),
        "notes": workstream.get("note") or workstream.get("title") or "",
    }


def generate_task_packets(workspace: Path, *, base_sha: str) -> list[Path]:
    control = workspace / ".agents/control/workstreams.json"
    graph = json.loads(control.read_text(encoding="utf-8"))
    model_policy = graph.get("modelPolicy", {})
    github = graph.get("github", {})
    sha = base_sha or github.get("baseSha")
    if not isinstance(sha, str) or len(sha) != 40:
        raise TaskPacketError("baseSHA must be a 40-character git sha")

    out_dir = workspace / ".agents/control/packets"
    out_dir.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for workstream in graph.get("workstreams", []):
        if not isinstance(workstream, dict):
            continue
        packet = packet_from_workstream(
            workstream, base_sha=sha, model_policy=model_policy
        )
        if packet is None:
            continue
        path = out_dir / f"{packet['issueId']}.json"
        path.write_text(
            json.dumps(packet, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        written.append(path)
    return sorted(written)
