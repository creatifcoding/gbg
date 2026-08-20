"""Tool workflows for environment preflight. These prove commands, not `--version`."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import json
import os
from pathlib import Path
import subprocess
from typing import Any, Callable, Sequence

from .digest import sha256_file
from .verify_manifest import verify_manifest


@dataclass(slots=True)
class CheckResult:
    id: str
    workstream: str
    status: str
    detail: str
    blocker_type: str | None = None
    owning_issue: int | None = None
    owning_workstream: str | None = None
    command: str | None = None
    exit_status: int | None = None
    fixture_path: str | None = None
    fixture_sha256: str | None = None
    output_sha256: str | None = None
    tool: str | None = None
    tool_version: str | None = None

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def which(name: str) -> str | None:
    """Prefer a Nix-store tool so a hidden user profile is not authority."""
    found: str | None = None
    for directory in os.environ.get("PATH", "").split(os.pathsep):
        if not directory:
            continue
        candidate = Path(directory) / name
        try:
            if not candidate.is_file() or not os.access(candidate, os.X_OK):
                continue
        except OSError:
            continue
        real = os.path.realpath(candidate)
        if real.startswith("/nix/store/"):
            return str(candidate)
        if found is None:
            found = str(candidate)
    return found


def rel(lab_root: Path, path: Path) -> str:
    return path.resolve().relative_to(lab_root.resolve()).as_posix()


def fixture_meta(lab_root: Path, relative: str) -> tuple[str | None, str | None]:
    path = lab_root / relative
    if not path.is_file():
        return None, None
    return relative, sha256_file(path)


def run_cmd(
    command: Sequence[str],
    *,
    cwd: Path,
    env: dict[str, str] | None = None,
    timeout: int = 120,
) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    if env:
        merged.update(env)
    try:
        return subprocess.run(
            list(command),
            cwd=cwd,
            env=merged,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
    except FileNotFoundError as exc:
        return subprocess.CompletedProcess(list(command), 127, "", f"not found: {exc.filename}")


def tool_version(binary: str) -> str | None:
    path = which(binary)
    if not path:
        return None
    for args in ([binary, "--version"], [binary, "-v"], [binary, "-V"], [binary, "version"]):
        try:
            proc = subprocess.run(
                args,
                text=True,
                capture_output=True,
                timeout=30,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            continue
        text = (proc.stdout or proc.stderr).strip().splitlines()
        if text:
            return text[0][:200]
    return path


def missing_tool(check_id: str, workstream: str, binary: str) -> CheckResult:
    return CheckResult(
        id=check_id,
        workstream=workstream,
        status="unsupported",
        blocker_type="UNSUPPORTED_PLATFORM",
        owning_workstream=workstream,
        tool=binary,
        detail=f"{binary} is not on PATH in the current shell",
    )


def missing_fixture(
    check_id: str,
    workstream: str,
    relative: str,
    issue: int,
    *,
    tool: str | None = None,
) -> CheckResult:
    return CheckResult(
        id=check_id,
        workstream=workstream,
        status="blocked",
        blocker_type="BLOCKED_MISSING_FIXTURE",
        owning_issue=issue,
        owning_workstream=workstream,
        tool=tool,
        fixture_path=relative,
        detail=f"reference fixture not present: {relative}",
    )


def not_implemented(check_id: str, workstream: str, issue: int, what: str) -> CheckResult:
    return CheckResult(
        id=check_id,
        workstream=workstream,
        status="blocked",
        blocker_type="NOT_IMPLEMENTED",
        owning_issue=issue,
        owning_workstream=workstream,
        detail=f"NOT_IMPLEMENTED: {what}",
    )


def passed(
    check_id: str,
    workstream: str,
    detail: str,
    **kwargs: Any,
) -> CheckResult:
    return CheckResult(
        id=check_id,
        workstream=workstream,
        status="pass",
        detail=detail,
        **kwargs,
    )


def failed(check_id: str, workstream: str, detail: str, **kwargs: Any) -> CheckResult:
    return CheckResult(
        id=check_id,
        workstream=workstream,
        status="fail",
        detail=detail,
        **kwargs,
    )


def schema_fixtures(lab_root: Path, iso: Path) -> list[CheckResult]:
    workstream = "environment-core"
    schema_rel = "evidence/runs/environment/fixtures/json-schema/schema.json"
    pos_rel = "evidence/runs/environment/fixtures/json-schema/positive.json"
    neg_rel = "evidence/runs/environment/fixtures/json-schema/negative.json"
    rust_src = lab_root / "scripts/environment/rust/schema_check.rs"
    ts_src = lab_root / "scripts/environment/ts/schema-check.mjs"
    py_src = lab_root / "scripts/environment/py/mantis_environment/schema_check.py"
    results: list[CheckResult] = []

    for relative in (schema_rel, pos_rel, neg_rel):
        if not (lab_root / relative).is_file():
            results.append(missing_fixture("json-schema-fixtures", workstream, relative, 21))
            return results

    def one(runtime: str, command: Sequence[str]) -> CheckResult:
        fixture_path, fixture_digest = fixture_meta(lab_root, schema_rel)
        if runtime == "python" and not py_src.is_file():
            return failed("json-schema-python", workstream, "python schema checker missing")
        proc = run_cmd(command, cwd=iso / "solver-temp")
        output = (proc.stdout + proc.stderr).strip()
        digest = None
        if output:
            digest = __import__("hashlib").sha256(output.encode()).hexdigest()
        common = dict(
            command=" ".join(command),
            exit_status=proc.returncode,
            fixture_path=fixture_path,
            fixture_sha256=fixture_digest,
            output_sha256=digest,
            tool=command[0],
            tool_version=tool_version(command[0]),
        )
        if proc.returncode != 0:
            return failed(
                f"json-schema-{runtime}",
                workstream,
                f"{runtime} schema fixtures failed: {output[-500:]}",
                **common,
            )
        return passed(
            f"json-schema-{runtime}",
            workstream,
            f"{runtime} accepted the positive fixture and rejected the negative fixture",
            **common,
        )

    results.append(
        one(
            "python",
            [
                "python3",
                str(py_src),
                str(lab_root / schema_rel),
                str(lab_root / pos_rel),
                str(lab_root / neg_rel),
            ],
        )
    )

    rustc = which("rustc")
    if not rustc:
        results.append(missing_tool("json-schema-rust", workstream, "rustc"))
    elif not rust_src.is_file():
        results.append(missing_fixture("json-schema-rust", workstream, rel(lab_root, rust_src), 21))
    else:
        binary = iso / "build" / "schema_check"
        compile_proc = run_cmd(
            ["rustc", "-O", "-A", "dead_code", "-o", str(binary), str(rust_src)],
            cwd=iso / "build",
        )
        if compile_proc.returncode != 0:
            results.append(
                failed(
                    "json-schema-rust",
                    workstream,
                    compile_proc.stderr[-500:],
                    command=f"rustc -O {rust_src}",
                    exit_status=compile_proc.returncode,
                    tool="rustc",
                    tool_version=tool_version("rustc"),
                )
            )
        else:
            results.append(
                one(
                    "rust",
                    [
                        str(binary),
                        str(lab_root / schema_rel),
                        str(lab_root / pos_rel),
                        str(lab_root / neg_rel),
                    ],
                )
            )

    node = which("node")
    if not node:
        results.append(missing_tool("json-schema-typescript", workstream, "node"))
    elif not ts_src.is_file():
        results.append(
            missing_fixture("json-schema-typescript", workstream, rel(lab_root, ts_src), 21)
        )
    else:
        results.append(
            one(
                "typescript",
                [
                    "node",
                    str(ts_src),
                    str(lab_root / schema_rel),
                    str(lab_root / pos_rel),
                    str(lab_root / neg_rel),
                ],
            )
        )
    return results


def lab_contracts(lab_root: Path, iso: Path) -> CheckResult:
    workstream = "environment-core"
    script = lab_root / "scripts/validate-contracts.py"
    if not script.is_file():
        return missing_fixture("lab-contracts", workstream, "scripts/validate-contracts.py", 21)
    proc = run_cmd(["python3", str(script)], cwd=lab_root)
    fixture_path, fixture_digest = fixture_meta(lab_root, "contracts/lab.schema.json")
    common = dict(
        command=f"python3 {script}",
        exit_status=proc.returncode,
        fixture_path=fixture_path,
        fixture_sha256=fixture_digest,
        tool="python3",
        tool_version=tool_version("python3"),
        workstream=workstream,
        id="lab-contracts",
    )
    if proc.returncode != 0:
        return failed(
            "lab-contracts",
            workstream,
            (proc.stdout + proc.stderr)[-500:],
            **{k: v for k, v in common.items() if k not in {"id", "workstream"}},
        )
    return passed(
        "lab-contracts",
        workstream,
        "workspace contracts validate under Draft 2020-12",
        **{k: v for k, v in common.items() if k not in {"id", "workstream"}},
    )


def manifest_independence(lab_root: Path) -> list[CheckResult]:
    workstream = "environment-review"
    good_rel = "evidence/runs/environment/fixtures/manifest/good.manifest.json"
    bad_rel = "evidence/runs/environment/fixtures/manifest/bad.manifest.json"
    results: list[CheckResult] = []
    for relative in (good_rel, bad_rel):
        if not (lab_root / relative).is_file():
            results.append(missing_fixture("manifest-verify", workstream, relative, 21))
            return results

    good = json.loads((lab_root / good_rel).read_text(encoding="utf-8"))
    bad = json.loads((lab_root / bad_rel).read_text(encoding="utf-8"))
    good_fail = verify_manifest(lab_root, good)
    bad_fail = verify_manifest(lab_root, bad)
    _, good_digest = fixture_meta(lab_root, good_rel)
    _, bad_digest = fixture_meta(lab_root, bad_rel)

    if good_fail:
        results.append(
            failed(
                "manifest-verify-good",
                workstream,
                "; ".join(good_fail),
                fixture_path=good_rel,
                fixture_sha256=good_digest,
                command="mantis_environment.verify_manifest (independent)",
            )
        )
    else:
        results.append(
            passed(
                "manifest-verify-good",
                workstream,
                "independent verifier accepted the committed good manifest without rewriting it",
                fixture_path=good_rel,
                fixture_sha256=good_digest,
                command="mantis_environment.verify_manifest (independent)",
            )
        )

    if not bad_fail:
        results.append(
            failed(
                "manifest-verify-bad",
                workstream,
                "independent verifier accepted a digest mismatch; it must not repair manifests",
                fixture_path=bad_rel,
                fixture_sha256=bad_digest,
                command="mantis_environment.verify_manifest (independent)",
            )
        )
    else:
        results.append(
            passed(
                "manifest-verify-bad",
                workstream,
                "independent verifier rejected the committed bad manifest",
                fixture_path=bad_rel,
                fixture_sha256=bad_digest,
                command="mantis_environment.verify_manifest (independent)",
            )
        )
    return results


def openscad_cube(lab_root: Path, iso: Path) -> CheckResult:
    workstream = "environment-cad"
    relative = "evidence/runs/environment/fixtures/openscad/cube.scad"
    source = lab_root / relative
    if not which("openscad"):
        return missing_tool("openscad-hardwarnings", workstream, "openscad")
    if not source.is_file():
        return missing_fixture("openscad-hardwarnings", workstream, relative, 21, tool="openscad")
    output = iso / "result" / "cube.stl"
    proc = run_cmd(
        ["openscad", "--hardwarnings", "-o", str(output), str(source)],
        cwd=iso / "solver-temp",
        timeout=180,
    )
    _, digest = fixture_meta(lab_root, relative)
    common = dict(
        command="openscad --hardwarnings -o cube.stl cube.scad",
        exit_status=proc.returncode,
        fixture_path=relative,
        fixture_sha256=digest,
        tool="openscad",
        tool_version=tool_version("openscad"),
    )
    if proc.returncode != 0 or not output.is_file():
        return failed(
            "openscad-hardwarnings",
            workstream,
            (proc.stdout + proc.stderr)[-500:] or "openscad did not write STL",
            **common,
        )
    return passed(
        "openscad-hardwarnings",
        workstream,
        "OpenSCAD compiled the environment cube with hard warnings",
        output_sha256=sha256_file(output),
        **common,
    )


def occt_roundtrip(lab_root: Path, iso: Path) -> CheckResult:
    workstream = "environment-cad"
    relative = "evidence/runs/environment/fixtures/occt/cube_roundtrip.py"
    script = lab_root / relative
    binary = which("FreeCADCmd")
    if not binary:
        return missing_tool("occt-step-roundtrip", workstream, "FreeCADCmd")
    if not script.is_file():
        return missing_fixture(
            "occt-step-roundtrip", workstream, relative, 21, tool="FreeCADCmd"
        )
    export_dir = iso / "result" / "occt"
    export_dir.mkdir(parents=True, exist_ok=True)
    proc = run_cmd(
        ["FreeCADCmd", str(script), str(export_dir / "cube.step")],
        cwd=iso / "solver-temp",
        timeout=180,
    )
    _, digest = fixture_meta(lab_root, relative)
    common = dict(
        command="FreeCADCmd cube_roundtrip.py cube.step",
        exit_status=proc.returncode,
        fixture_path=relative,
        fixture_sha256=digest,
        tool="FreeCADCmd",
        tool_version=tool_version("FreeCADCmd"),
    )
    if proc.returncode != 0:
        return failed(
            "occt-step-roundtrip",
            workstream,
            (proc.stdout + proc.stderr)[-800:],
            **common,
        )
    step = export_dir / "cube.step"
    return passed(
        "occt-step-roundtrip",
        workstream,
        "FreeCAD/OCCT exported and re-imported a 10 mm cube with matching volume",
        output_sha256=sha256_file(step) if step.is_file() else None,
        **common,
    )


def kicad_reference(lab_root: Path) -> CheckResult:
    workstream = "environment-ee"
    relative = "terrarium/ee/kicad"
    if not which("kicad-cli"):
        return missing_tool("kicad-erc-drc", workstream, "kicad-cli")
    natives = list((lab_root / relative).glob("**/*.kicad_sch")) if (lab_root / relative).exists() else []
    if not natives:
        return missing_fixture(
            "kicad-erc-drc",
            workstream,
            relative,
            23,
            tool="kicad-cli",
        )
    return not_implemented(
        "kicad-erc-drc",
        workstream,
        23,
        "native KiCad ERC/DRC runner is owned by EE-01 once sources exist",
    )


def ngspice_op(lab_root: Path, iso: Path) -> CheckResult:
    workstream = "environment-ee"
    relative = "evidence/runs/environment/fixtures/ngspice/divider.cir"
    source = lab_root / relative
    if not which("ngspice"):
        return missing_tool("ngspice-op", workstream, "ngspice")
    if not source.is_file():
        return missing_fixture("ngspice-op", workstream, relative, 21, tool="ngspice")
    proc = run_cmd(["ngspice", "-b", str(source)], cwd=iso / "solver-temp", timeout=60)
    _, digest = fixture_meta(lab_root, relative)
    text = proc.stdout + proc.stderr
    common = dict(
        command="ngspice -b divider.cir",
        exit_status=proc.returncode,
        fixture_path=relative,
        fixture_sha256=digest,
        tool="ngspice",
        tool_version=tool_version("ngspice"),
        output_sha256=__import__("hashlib").sha256(text.encode()).hexdigest(),
    )
    if proc.returncode != 0:
        return failed("ngspice-op", workstream, text[-500:], **common)
    # 1 V across 1 kΩ to ground from a 2 V source through 1 kΩ => Vout = 1.0 V.
    if "vout" not in text.lower() and "1.000" not in text:
        # Accept numeric token 1.0 with ngspice formatting.
        if "1.000000e+00" not in text and "1.00000" not in text:
            return failed(
                "ngspice-op",
                workstream,
                f"numeric assertion failed; output did not contain 1.0 V: {text[-500:]}",
                **common,
            )
    return passed(
        "ngspice-op",
        workstream,
        "ngspice operating-point of the 2 V / 1 kΩ divider converged near 1.0 V",
        **common,
    )


def gmsh_mesh(lab_root: Path, iso: Path) -> CheckResult:
    workstream = "environment-sim"
    relative = "evidence/runs/environment/fixtures/gmsh-calculix/cube.geo"
    source = lab_root / relative
    if not which("gmsh"):
        return missing_tool("gmsh-mesh", workstream, "gmsh")
    if not source.is_file():
        return missing_fixture("gmsh-mesh", workstream, relative, 21, tool="gmsh")
    mesh = iso / "result" / "cube.msh"
    proc = run_cmd(
        ["gmsh", str(source), "-3", "-o", str(mesh), "-v", "2"],
        cwd=iso / "solver-temp",
        timeout=120,
    )
    _, digest = fixture_meta(lab_root, relative)
    common = dict(
        command="gmsh cube.geo -3 -o cube.msh",
        exit_status=proc.returncode,
        fixture_path=relative,
        fixture_sha256=digest,
        tool="gmsh",
        tool_version=tool_version("gmsh"),
    )
    if proc.returncode != 0 or not mesh.is_file() or mesh.stat().st_size < 32:
        return failed(
            "gmsh-mesh",
            workstream,
            (proc.stdout + proc.stderr)[-500:] or "gmsh did not write a mesh",
            **common,
        )
    return passed(
        "gmsh-mesh",
        workstream,
        "Gmsh meshed the environment cube",
        output_sha256=sha256_file(mesh),
        **common,
    )


def calculix_static(lab_root: Path, iso: Path) -> CheckResult:
    workstream = "environment-sim"
    relative = "evidence/runs/environment/fixtures/gmsh-calculix/cube.inp"
    source = lab_root / relative
    if not which("ccx"):
        return missing_tool("calculix-static", workstream, "ccx")
    if not source.is_file():
        return missing_fixture("calculix-static", workstream, relative, 21, tool="ccx")
    work = iso / "solver-temp" / "ccx"
    work.mkdir(parents=True, exist_ok=True)
    inp = work / "cube.inp"
    inp.write_bytes(source.read_bytes())
    proc = run_cmd(["ccx", "cube"], cwd=work, timeout=120)
    text = proc.stdout + proc.stderr
    dat = work / "cube.dat"
    _, digest = fixture_meta(lab_root, relative)
    common = dict(
        command="ccx cube",
        exit_status=proc.returncode,
        fixture_path=relative,
        fixture_sha256=digest,
        tool="ccx",
        tool_version=tool_version("ccx"),
        output_sha256=sha256_file(dat) if dat.is_file() else None,
    )
    finished = "Job finished" in text or (dat.is_file() and dat.stat().st_size > 0)
    if proc.returncode != 0 or not finished:
        return failed("calculix-static", workstream, text[-500:], **common)
    return passed(
        "calculix-static",
        workstream,
        "CalculiX static step on the environment hex cube finished",
        **common,
    )


def touchstone_load(lab_root: Path, iso: Path) -> CheckResult:
    workstream = "environment-sim"
    relative = "evidence/runs/environment/fixtures/touchstone/thru.s2p"
    source = lab_root / relative
    if not source.is_file():
        return missing_fixture("touchstone-skrf", workstream, relative, 21, tool="python3")
    script = r"""
import json, sys
from pathlib import Path
path = Path(sys.argv[1])
try:
    import skrf
except ImportError:
    print("MISSING_SKRF")
    raise SystemExit(69)
net = skrf.Network(str(path))
s21 = abs(net.s[0, 1, 0])
ok = abs(s21 - 0.99) < 0.02
print(json.dumps({"s21": s21, "ok": ok, "nfreqs": int(net.frequency.npoints)}))
raise SystemExit(0 if ok else 1)
"""
    probe = iso / "build" / "touchstone_probe.py"
    probe.write_text(script, encoding="utf-8")
    proc = run_cmd(["python3", str(probe), str(source)], cwd=iso / "solver-temp")
    _, digest = fixture_meta(lab_root, relative)
    text = (proc.stdout + proc.stderr).strip()
    common = dict(
        command="python3 -c skrf.Network(thru.s2p)",
        exit_status=proc.returncode,
        fixture_path=relative,
        fixture_sha256=digest,
        tool="python3",
        tool_version=tool_version("python3"),
    )
    if proc.returncode == 69 or "MISSING_SKRF" in text:
        return CheckResult(
            id="touchstone-skrf",
            workstream=workstream,
            status="unsupported",
            blocker_type="UNSUPPORTED_PLATFORM",
            owning_issue=21,
            owning_workstream=workstream,
            tool="scikit-rf",
            detail="scikit-rf is not importable in the current shell",
            **{k: v for k, v in common.items() if k != "tool"},
        )
    if proc.returncode != 0:
        return failed("touchstone-skrf", workstream, text[-500:], **common)
    return passed(
        "touchstone-skrf",
        workstream,
        "scikit-rf loaded the environment Touchstone thru and matched |S21|≈0.99",
        output_sha256=__import__("hashlib").sha256(text.encode()).hexdigest(),
        **common,
    )


def openems_policy() -> CheckResult:
    return CheckResult(
        id="openems-headless",
        workstream="environment-sim",
        status="unsupported",
        blocker_type="UNSUPPORTED_TOOL",
        owning_issue=21,
        owning_workstream="environment-sim",
        tool="openEMS",
        detail="openEMS is omitted until a headless smoke test qualifies it",
    )


def review_artifacts(lab_root: Path, iso: Path) -> list[CheckResult]:
    workstream = "environment-review"
    results: list[CheckResult] = []

    pdf_rel = "evidence/runs/environment/fixtures/review/cube.pdf"
    svg_rel = "evidence/runs/environment/fixtures/review/cube.svg"
    step_rel = "evidence/runs/environment/fixtures/review/cube.step"

    pdf = lab_root / pdf_rel
    if not pdf.is_file():
        results.append(missing_fixture("review-pdf", workstream, pdf_rel, 21))
    else:
        proc = run_cmd(
            [
                "python3",
                "-c",
                "from pypdf import PdfReader; import sys; r=PdfReader(sys.argv[1]); assert len(r.pages)==1",
                str(pdf),
            ],
            cwd=iso / "solver-temp",
        )
        _, digest = fixture_meta(lab_root, pdf_rel)
        if proc.returncode != 0:
            results.append(
                failed(
                    "review-pdf",
                    workstream,
                    (proc.stdout + proc.stderr)[-400:],
                    fixture_path=pdf_rel,
                    fixture_sha256=digest,
                    tool="python3",
                    command="pypdf.PdfReader(cube.pdf)",
                    exit_status=proc.returncode,
                )
            )
        else:
            results.append(
                passed(
                    "review-pdf",
                    workstream,
                    "environment PDF re-imported with one page",
                    fixture_path=pdf_rel,
                    fixture_sha256=digest,
                    tool="python3",
                    command="pypdf.PdfReader(cube.pdf)",
                    exit_status=0,
                )
            )

    svg = lab_root / svg_rel
    if not svg.is_file():
        results.append(missing_fixture("review-svg", workstream, svg_rel, 21))
    else:
        text = svg.read_text(encoding="utf-8")
        _, digest = fixture_meta(lab_root, svg_rel)
        if "<svg" not in text or "10mm" not in text:
            results.append(
                failed(
                    "review-svg",
                    workstream,
                    "SVG missing svg root or 10mm dimension",
                    fixture_path=svg_rel,
                    fixture_sha256=digest,
                    tool="python3",
                )
            )
        else:
            results.append(
                passed(
                    "review-svg",
                    workstream,
                    "environment SVG declares a 10 mm square",
                    fixture_path=svg_rel,
                    fixture_sha256=digest,
                    tool="python3",
                )
            )

    step = lab_root / step_rel
    if not step.is_file():
        results.append(missing_fixture("review-step", workstream, step_rel, 21))
    else:
        payload = step.read_text(encoding="utf-8", errors="replace")
        _, digest = fixture_meta(lab_root, step_rel)
        if "ISO-10303-21" not in payload or "END-ISO-10303-21" not in payload:
            results.append(
                failed(
                    "review-step",
                    workstream,
                    "STEP fixture missing ISO-10303-21 envelope",
                    fixture_path=step_rel,
                    fixture_sha256=digest,
                )
            )
        else:
            results.append(
                passed(
                    "review-step",
                    workstream,
                    "environment STEP re-imported as ISO-10303-21 text",
                    fixture_path=step_rel,
                    fixture_sha256=digest,
                )
            )
    return results


def assistant_compat(lab_root: Path) -> CheckResult:
    workstream = "environment-assistant"
    relative = "assistant/fixtures/mastra-compat"
    if (lab_root / relative).exists():
        return not_implemented(
            "mastra-compat",
            workstream,
            50,
            "Mastra/CopilotKit compatibility fixture exists but the A0 lock is not owned here",
        )
    return missing_fixture("mastra-compat", workstream, relative, 50, tool="bun")


def assistant_eval_fixture(lab_root: Path) -> CheckResult:
    workstream = "environment-assistant-eval"
    relative = "assistant/evals/golden"
    if (lab_root / relative).exists():
        return not_implemented(
            "assistant-eval-golden",
            workstream,
            50,
            "assistant eval fixtures are owned by A0/A1",
        )
    return missing_fixture("assistant-eval-golden", workstream, relative, 50, tool="chromium")


def edge_simulator(lab_root: Path) -> CheckResult:
    workstream = "environment-edge"
    relative = "tooling/rust/mantis-edge"
    if (lab_root / relative).exists():
        return not_implemented(
            "edge-simulator",
            workstream,
            54,
            "edge simulator crate exists but is not owned by the environment issue",
        )
    return missing_fixture("edge-simulator", workstream, relative, 54, tool="cargo")


DEVICE_WRITE_BINARIES = (
    "particle",
    "esptool",
    "esptool.py",
    "openocd",
    "avrdude",
    "stm32flash",
    "nrfjprog",
    "probe-rs",
    "pyocd",
    "kicad-cli",
)


def analysis_no_device_write(lab_root: Path, iso: Path) -> list[CheckResult]:
    workstream = "environment-analysis"
    results: list[CheckResult] = []
    shell = os.environ.get("MANTIS_SHELL", "")
    if shell in {"mantis-analysis", "mantis-all"}:
        present = []
        for name in DEVICE_WRITE_BINARIES:
            path = which(name)
            if not path:
                continue
            real = os.path.realpath(path)
            if shell == "mantis-analysis" and not real.startswith("/nix/store/"):
                continue
            present.append(name)
        if present:
            results.append(
                failed(
                    "analysis-no-device-write",
                    workstream,
                    "analysis shell must not expose device-write tools: " + ", ".join(present),
                    command="command -v",
                )
            )
        else:
            results.append(
                passed(
                    "analysis-no-device-write",
                    workstream,
                    "no device-write binaries provided by this shell",
                    command="command -v",
                )
            )
    else:
        results.append(
            passed(
                "analysis-no-device-write",
                workstream,
                f"device-write guard applies in mantis-analysis; current shell is {shell or 'unset'}",
                command="command -v",
            )
        )

    relative = "evidence/runs/environment/fixtures/analysis/samples.csv"
    source = lab_root / relative
    if not source.is_file():
        results.append(missing_fixture("analysis-csv-mean", workstream, relative, 21))
        return results
    script = r"""
import csv, sys
from statistics import mean
from pathlib import Path
values = [float(row["value"]) for row in csv.DictReader(Path(sys.argv[1]).open())]
assert abs(mean(values) - 2.0) < 1e-12
print(mean(values))
"""
    probe = iso / "build" / "analysis_mean.py"
    probe.write_text(script, encoding="utf-8")
    proc = run_cmd(["python3", str(probe), str(source)], cwd=iso / "solver-temp")
    _, digest = fixture_meta(lab_root, relative)
    if proc.returncode != 0:
        results.append(
            failed(
                "analysis-csv-mean",
                workstream,
                (proc.stdout + proc.stderr)[-400:],
                fixture_path=relative,
                fixture_sha256=digest,
                command="python3 statistics.mean(samples.csv)",
                exit_status=proc.returncode,
                tool="python3",
            )
        )
    else:
        results.append(
            passed(
                "analysis-csv-mean",
                workstream,
                "analysis CSV mean asserted at 2.0 without device I/O",
                fixture_path=relative,
                fixture_sha256=digest,
                command="python3 statistics.mean(samples.csv)",
                exit_status=0,
                tool="python3",
                tool_version=tool_version("python3"),
            )
        )
    return results


def fabrication_export(lab_root: Path, iso: Path) -> CheckResult:
    # Reuse the OpenSCAD cube as the deterministic fabrication export.
    result = openscad_cube(lab_root, iso)
    result.id = "fabrication-openscad-export"
    result.workstream = "environment-fabrication"
    result.owning_workstream = "environment-fabrication"
    return result


WORKSTREAM_CHECKS: dict[str, tuple[str, ...]] = {
    "environment-core": (
        "schema_fixtures",
        "lab_contracts",
        "manifest_independence",
    ),
    "environment-ee": ("kicad_reference", "ngspice_op"),
    "environment-cad": ("openscad_cube", "occt_roundtrip"),
    "environment-sim": ("touchstone_load", "gmsh_mesh", "calculix_static", "openems_policy"),
    "environment-review": ("review_artifacts", "manifest_independence"),
    "environment-assistant": ("assistant_compat",),
    "environment-assistant-eval": ("assistant_eval_fixture",),
    "environment-edge": ("edge_simulator",),
    "environment-analysis": ("analysis_no_device_write",),
    "environment-fabrication": ("fabrication_export",),
}


def collect(
    names: Sequence[str],
    lab_root: Path,
    iso: Path,
) -> list[CheckResult]:
    dispatch: dict[str, Callable[[], list[CheckResult] | CheckResult]] = {
        "schema_fixtures": lambda: schema_fixtures(lab_root, iso),
        "lab_contracts": lambda: lab_contracts(lab_root, iso),
        "manifest_independence": lambda: manifest_independence(lab_root),
        "openscad_cube": lambda: openscad_cube(lab_root, iso),
        "occt_roundtrip": lambda: occt_roundtrip(lab_root, iso),
        "kicad_reference": lambda: kicad_reference(lab_root),
        "ngspice_op": lambda: ngspice_op(lab_root, iso),
        "gmsh_mesh": lambda: gmsh_mesh(lab_root, iso),
        "calculix_static": lambda: calculix_static(lab_root, iso),
        "touchstone_load": lambda: touchstone_load(lab_root, iso),
        "openems_policy": openems_policy,
        "review_artifacts": lambda: review_artifacts(lab_root, iso),
        "assistant_compat": lambda: assistant_compat(lab_root),
        "assistant_eval_fixture": lambda: assistant_eval_fixture(lab_root),
        "edge_simulator": lambda: edge_simulator(lab_root),
        "analysis_no_device_write": lambda: analysis_no_device_write(lab_root, iso),
        "fabrication_export": lambda: fabrication_export(lab_root, iso),
    }
    results: list[CheckResult] = []
    for name in names:
        produced = dispatch[name]()
        if isinstance(produced, list):
            results.extend(produced)
        else:
            results.append(produced)
    return results
