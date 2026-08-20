"""Self-describing Mantis environment command surface."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys

from .doctor import EXPORT_DOMAINS, run_doctor
from .isolation import apply_env
from .verify_manifest import verify_manifest
from .verify_report import verify_report
from .workflows import collect


HELP = """mantis — self-contained lab environment command surface

  mantis doctor
  mantis check <workstream-id>
  mantis export <domain>
  mantis evidence <run>

Non-mutating. Isolated caches live under /tmp/mantis-lab/<worktree>/<run>.
The report generator is not the verifier of the manifest it reports.
"""


def lab_root_from_env() -> Path:
    raw = os.environ.get("MANTIS_LAB_ROOT")
    if not raw:
        raise SystemExit("MANTIS_LAB_ROOT is not set")
    return Path(raw).resolve()


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        prog="mantis",
        description="Mantis lab environment dispatcher",
        epilog="Workstreams: " + ", ".join(sorted(EXPORT_DOMAINS.values())),
    )
    commands = root.add_subparsers(dest="command", required=True)

    doctor = commands.add_parser("doctor", help="non-mutating environment preflight")
    doctor.add_argument("--output", type=Path, default=None)

    check = commands.add_parser("check", help="run one workstream preflight")
    check.add_argument("workstream")
    check.add_argument("--output", type=Path, default=None)

    export = commands.add_parser("export", help="deterministic export into the isolated result dir")
    export.add_argument("domain")
    export.add_argument("--output-dir", type=Path, default=None)

    evidence = commands.add_parser("evidence", help="independently verify a report or run")
    evidence.add_argument("run")

    commands.add_parser("help", help="show command surface")
    return root


def cmd_export(lab_root: Path, domain: str, output_dir: Path | None) -> int:
    if domain not in EXPORT_DOMAINS:
        print(f"unknown export domain: {domain}", file=sys.stderr)
        print("domains: " + ", ".join(sorted(EXPORT_DOMAINS)), file=sys.stderr)
        return 64
    iso = apply_env(lab_root)
    dest = output_dir or (iso / "result" / "export" / domain)
    dest.mkdir(parents=True, exist_ok=True)
    workstream = EXPORT_DOMAINS[domain]
    from .workflows import WORKSTREAM_CHECKS

    results = collect(WORKSTREAM_CHECKS[workstream], lab_root, iso)
    summary = {
        "domain": domain,
        "workstream": workstream,
        "isolationRoot": str(iso),
        "outputDir": str(dest),
        "checks": [item.as_dict() for item in results],
        "ok": all(item.status != "fail" for item in results),
    }
    (dest / "export-summary.json").write_text(
        json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(dest / "export-summary.json")
    return 0 if summary["ok"] else 1


def cmd_evidence(lab_root: Path, target: str) -> int:
    path = Path(target)
    if not path.is_absolute():
        candidate = Path(os.environ.get("MANTIS_ISOLATION_ROOT", "")) / "result" / target
        path = path if path.exists() else candidate
    if path.is_dir():
        report_path = path / "doctor-report.json"
        if not report_path.is_file():
            matches = sorted(path.glob("**/*report.json"))
            if not matches:
                print(f"no report in run directory: {path}", file=sys.stderr)
                return 66
            report_path = matches[0]
    else:
        report_path = path
    if not report_path.is_file():
        print(f"report not found: {report_path}", file=sys.stderr)
        return 66
    report = json.loads(report_path.read_text(encoding="utf-8"))
    failures = verify_report(lab_root, report)
    payload = {"ok": not failures, "report": str(report_path), "failures": failures}
    print(json.dumps(payload, indent=2, sort_keys=True))
    return 0 if not failures else 1


def main(argv: list[str] | None = None) -> int:
    if argv is None and len(sys.argv) > 1 and sys.argv[1] in {"-h", "--help", "help"}:
        print(HELP)
        return 0
    args = parser().parse_args(argv)
    lab_root = lab_root_from_env()
    apply_env(lab_root)

    if args.command == "help":
        print(HELP)
        return 0

    if args.command == "doctor":
        report, destination, code = run_doctor(lab_root, output=args.output)
        print(destination)
        print(json.dumps({"ok": report["ok"], "failed": report["failed"], "blockers": report["blockers"]}, indent=2))
        return code

    if args.command == "check":
        workstream = args.workstream
        known = set(EXPORT_DOMAINS.values()) | {"environment-core"}
        if workstream not in known:
            print(f"unknown workstream: {workstream}", file=sys.stderr)
            print("workstreams: " + ", ".join(sorted(known)), file=sys.stderr)
            return 64
        report, destination, code = run_doctor(
            lab_root,
            workstreams=(workstream,),
            output=args.output,
            command=f"mantis check {workstream}",
        )
        print(destination)
        print(json.dumps({"ok": report["ok"], "failed": report["failed"], "blockers": report["blockers"]}, indent=2))
        return code

    if args.command == "export":
        return cmd_export(lab_root, args.domain, args.output_dir)

    if args.command == "evidence":
        return cmd_evidence(lab_root, args.run)

    return 64


if __name__ == "__main__":
    raise SystemExit(main())
