"""Doctor report generator.

Verification of the written report is a separate module and process. This
file must not import verify_report for a self-pass.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
import os
from pathlib import Path
import platform
import subprocess
import sys

from .digest import sha256_file
from .isolation import apply_env
from .workflows import WORKSTREAM_CHECKS, CheckResult, collect, tool_version, which


SHELL_MATRIX = (
    "mantis-core",
    "mantis-ee",
    "mantis-cad",
    "mantis-sim",
    "mantis-review",
    "mantis-assistant",
    "mantis-assistant-eval",
    "mantis-edge",
    "mantis-analysis",
    "mantis-fabrication",
    "mantis-all",
)

CHECK_WORKSTREAMS = tuple(WORKSTREAM_CHECKS)

EXPORT_DOMAINS = {
    "ee": "environment-ee",
    "cad": "environment-cad",
    "sim": "environment-sim",
    "review": "environment-review",
    "assistant": "environment-assistant",
    "assistant-eval": "environment-assistant-eval",
    "edge": "environment-edge",
    "analysis": "environment-analysis",
    "fabrication": "environment-fabrication",
    "environment": "environment-core",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def runner_class() -> str:
    if os.environ.get("GITHUB_ACTIONS") == "true":
        return "github-actions"
    if os.environ.get("CURSOR_AGENT") or Path("/tmp/cursor").exists():
        return "cursor-cloud"
    return "local"


def git_state(lab_root: Path) -> dict[str, object]:
    def git(*args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["git", *args],
            cwd=lab_root,
            text=True,
            capture_output=True,
            check=False,
        )

    sha_proc = git("rev-parse", "HEAD")
    dirty_proc = git("status", "--porcelain")
    return {
        "sha": sha_proc.stdout.strip() if sha_proc.returncode == 0 else None,
        "dirty": bool(dirty_proc.stdout.strip()) if dirty_proc.returncode == 0 else True,
        "available": sha_proc.returncode == 0,
    }


def flake_lock_record(lab_root: Path) -> dict[str, object]:
    lock_path = lab_root / "flake.lock"
    if not lock_path.is_file():
        return {"path": "flake.lock", "present": False}
    payload = json.loads(lock_path.read_text(encoding="utf-8"))
    nodes = payload.get("nodes", {})
    root = nodes.get("root", {})
    inputs = root.get("inputs", {})
    resolved: dict[str, object] = {}
    if isinstance(inputs, dict):
        for name, target in inputs.items():
            node_name = target if isinstance(target, str) else None
            node = nodes.get(node_name or "", {})
            locked = node.get("locked", {}) if isinstance(node, dict) else {}
            if isinstance(locked, dict):
                resolved[name] = {
                    "type": locked.get("type"),
                    "owner": locked.get("owner"),
                    "repo": locked.get("repo"),
                    "ref": locked.get("ref"),
                    "rev": locked.get("rev"),
                    "narHash": locked.get("narHash"),
                    "lastModified": locked.get("lastModified"),
                }
    return {
        "path": "flake.lock",
        "present": True,
        "sha256": sha256_file(lock_path),
        "resolvedInputs": resolved,
    }


def nix_record() -> dict[str, object]:
    system = os.environ.get("NIX_CURRENT_SYSTEM") or platform.machine()
    current = None
    proc = subprocess.run(
        ["nix", "--version"],
        text=True,
        capture_output=True,
        check=False,
    )
    version = proc.stdout.strip().splitlines()[0] if proc.returncode == 0 and proc.stdout else None
    eval_proc = subprocess.run(
        ["nix", "eval", "--raw", "--impure", "--expr", "builtins.currentSystem"],
        text=True,
        capture_output=True,
        check=False,
    )
    if eval_proc.returncode == 0:
        current = eval_proc.stdout.strip()
    return {
        "nixVersion": version,
        "currentSystem": current,
        "uname": f"{platform.system()}-{platform.machine()}",
        "platformHint": system,
    }


def tool_inventory() -> dict[str, str | None]:
    names = (
        "python3",
        "node",
        "bun",
        "tsc",
        "rustc",
        "cargo",
        "jq",
        "rg",
        "kicad-cli",
        "ngspice",
        "openscad",
        "FreeCADCmd",
        "inkscape",
        "gmsh",
        "ccx",
        "chromium",
    )
    return {name: tool_version(name) if which(name) else None for name in names}


def shell_matrix() -> list[dict[str, object]]:
    current = os.environ.get("MANTIS_SHELL", "unknown")
    unsupported = [
        item
        for item in os.environ.get("MANTIS_UNSUPPORTED_TOOLS", "").split(",")
        if item
    ]
    linux = platform.system() == "Linux"
    rows = []
    for name in SHELL_MATRIX:
        default = name == "mantis-core"
        local_only = name == "mantis-all"
        rows.append(
            {
                "name": name,
                "current": name == current,
                "defaultCloudWorker": default,
                "localIntegrationOnly": local_only,
                "unsupportedToolsOnThisEval": unsupported if name != "mantis-core" else [],
                "platform": "linux" if linux else platform.system().lower(),
            }
        )
    return rows


def fixture_records(lab_root: Path, checks: list[CheckResult]) -> list[dict[str, object]]:
    seen: dict[str, dict[str, object]] = {}
    for check in checks:
        if check.fixture_path and check.fixture_sha256:
            seen[check.fixture_path] = {
                "path": check.fixture_path,
                "sha256": check.fixture_sha256,
            }
    extra = [
        "evidence/runs/environment/fixtures/json-schema/schema.json",
        "evidence/runs/environment/fixtures/json-schema/positive.json",
        "evidence/runs/environment/fixtures/json-schema/negative.json",
        "evidence/runs/environment/fixtures/manifest/payload.txt",
        "evidence/runs/environment/fixtures/manifest/good.manifest.json",
        "evidence/runs/environment/fixtures/manifest/bad.manifest.json",
    ]
    for relative in extra:
        path = lab_root / relative
        if path.is_file() and relative not in seen:
            seen[relative] = {"path": relative, "sha256": sha256_file(path)}
    return list(seen.values())


def blockers(checks: list[CheckResult]) -> list[dict[str, object]]:
    rows = []
    for check in checks:
        if check.status in {"blocked", "unsupported"} or check.blocker_type:
            rows.append(
                {
                    "checkId": check.id,
                    "workstream": check.workstream,
                    "status": check.status,
                    "type": check.blocker_type,
                    "owningIssue": check.owning_issue,
                    "owningWorkstream": check.owning_workstream or check.workstream,
                    "detail": check.detail,
                }
            )
    return rows


def build_report(
    *,
    lab_root: Path,
    iso: Path,
    workstreams: tuple[str, ...],
    command: str,
) -> dict[str, object]:
    started = utc_now()
    names: list[str] = []
    for stream in workstreams:
        names.extend(WORKSTREAM_CHECKS[stream])
    # Preserve order, drop duplicates.
    ordered = list(dict.fromkeys(names))
    checks = collect(ordered, lab_root, iso)
    report = {
        "schemaVersion": "1.0.0",
        "kind": "MantisEnvironmentDoctorReport",
        "command": command,
        "startedAt": started,
        "completedAt": utc_now(),
        "runner": {
            "identityClass": runner_class(),
            "shell": os.environ.get("MANTIS_SHELL"),
            "isolationRoot": str(iso),
        },
        "lab": {
            "repositoryPath": "projects/biomemetics/labs/mantis",
            "flakeLock": flake_lock_record(lab_root),
            "git": git_state(lab_root),
            "nix": nix_record(),
        },
        "tools": tool_inventory(),
        "shells": shell_matrix(),
        "checks": [check.as_dict() for check in checks],
        "fixtures": fixture_records(lab_root, checks),
        "blockers": blockers(checks),
        "ok": all(check.status != "fail" for check in checks),
        "failed": [check.id for check in checks if check.status == "fail"],
    }
    return report


def write_report(path: Path, report: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def verify_with_independent_process(lab_root: Path, report_path: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(lab_root / "scripts/environment/py") + (
        f":{env['PYTHONPATH']}" if env.get("PYTHONPATH") else ""
    )
    return subprocess.run(
        [sys.executable, "-m", "mantis_environment.verify_cli", str(report_path)],
        cwd=lab_root,
        env=env,
        text=True,
        capture_output=True,
        check=False,
    )


def run_doctor(
    lab_root: Path,
    *,
    workstreams: tuple[str, ...] | None = None,
    output: Path | None = None,
    command: str = "mantis doctor",
) -> tuple[dict[str, object], Path, int]:
    iso = apply_env(lab_root)
    streams = workstreams or CHECK_WORKSTREAMS
    report = build_report(
        lab_root=lab_root,
        iso=iso,
        workstreams=streams,
        command=command,
    )
    destination = output or (iso / "result" / "doctor-report.json")
    write_report(destination, report)
    independent = verify_with_independent_process(lab_root, destination)
    report["independentVerification"] = {
        "command": f"{sys.executable} -m mantis_environment.verify_cli {destination}",
        "exitStatus": independent.returncode,
        "ok": independent.returncode == 0,
        "detail": (independent.stdout + independent.stderr).strip()[-1000:],
    }
    report["completedAt"] = utc_now()
    if independent.returncode != 0:
        report["ok"] = False
        report["failed"] = list(report.get("failed") or []) + ["independent-report-verification"]
    write_report(destination, report)
    # Re-verify after embedding the independent result so the on-disk document
    # still matches its schema; the verifier does not require independentVerification.
    second = verify_with_independent_process(lab_root, destination)
    if second.returncode != 0:
        report["ok"] = False
        report["independentVerification"]["secondPassExitStatus"] = second.returncode
        report["independentVerification"]["secondPassDetail"] = (
            second.stdout + second.stderr
        ).strip()[-500:]
        write_report(destination, report)
    exit_code = 0 if report["ok"] else 1
    return report, destination, exit_code
