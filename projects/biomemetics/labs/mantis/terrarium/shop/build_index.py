#!/usr/bin/env python3
"""Build a DRAFT shop index from files that already exist.

Hashes STEP/SVG/PNG/PDF (and notes STL/DXF). Does not export STEP, does not
invoke FreeCADCmd, and does not rewrite terrarium/MANIFEST.sha256.
Maturity stays DRAFT. This is not SHOP-RELEASE and not QUALIFIED.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path
from typing import Any


WORKSPACE = Path(__file__).resolve().parents[2]
TERRARIUM = WORKSPACE / "terrarium"
SHOP = Path(__file__).resolve().parent
BASELINE = TERRARIUM / "MANIFEST.sha256"

ALLOWED_CLASSES = frozenset({"draft-measured", "theoretical", "diagram"})
CAD01_STEP_SHA = "fe8f875a80b37a1003f05f3a0190fbe2f0417842"
CAD01_MERGE = "995cd704fb8de69c5741dd63936e9559494a3bdc"
CAD02_MERGE = "c5ad7648cb160a4391238ccd57983970d6132225"
LAB_SHA = "e3ef24199ae1593becc6d2de2c1208cfda125eda"
PR45_HEAD = "ce04b6a12e4dad78595c21c6c0ce9e4b9b1b3e1f"
PR58_HEAD = "b64d101e805e7f3ab760d15ad38d13d359c7dce1"

SHEETS: dict[str, dict[str, str]] = {
    "S00-cover": {
        "honestyClass": "draft-measured",
        "kind": "projected",
        "note": "PR 34 assembly isometric HLR. Title block remains DRAFT CAD.",
    },
    "S01-ortho": {
        "honestyClass": "draft-measured",
        "kind": "projected",
        "note": "Third-angle HLR of PR 34 assembly STEP + B20 keep-out.",
    },
    "S02-exploded": {
        "honestyClass": "draft-measured",
        "kind": "projected",
        "note": "Unique-part HLR from CAD-01 STEP, not a fused explode.",
    },
    "S03-blocks": {
        "honestyClass": "draft-measured",
        "kind": "projected",
        "note": "B01/B02/B03/B51/B04 unique-part HLR.",
    },
    "S04-rail-strip": {
        "honestyClass": "draft-measured",
        "kind": "projected",
        "note": "B18 section HLR is draft-measured. P01–P12 overlay is a diagram (no B19 STEP).",
    },
    "S05-carriage-mech": {
        "honestyClass": "theoretical",
        "kind": "projected",
        "note": "CAD-02 OCCT posed q=0 / q=5. B27 is a proxy. Unverified.",
    },
    "S06-latch-binder": {
        "honestyClass": "theoretical",
        "kind": "projected",
        "note": "B28/B29/B50/B34 unique-part HLR. B50 is a proxy.",
    },
    "S07-camera-load": {
        "honestyClass": "theoretical",
        "kind": "mixed",
        "note": "B29/B50 HLR plus UNVERIFIED camera-module diagram. No SKU invented.",
    },
    "S08-electrical": {
        "honestyClass": "diagram",
        "kind": "diagram",
        "note": "EE review diagram. KiCad remains circuit authority. No pinout invented.",
    },
    "S09-particle-brick": {
        "honestyClass": "diagram",
        "kind": "diagram",
        "note": "Tachyon/M1 datasheet envelopes. No brick STEP. No Particle SKU invented.",
    },
    "S10-husbandry": {
        "honestyClass": "draft-measured",
        "kind": "projected",
        "note": "B20 keep-out HLR, assembly, door, vents.",
    },
    "S11-details": {
        "honestyClass": "theoretical",
        "kind": "mixed",
        "note": "B27/B25/B34/B03 projected; wipe + magnet remain diagrams.",
    },
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def rel(path: Path) -> str:
    return path.relative_to(WORKSPACE).as_posix()


def load_baseline() -> dict[str, str]:
    mapping: dict[str, str] = {}
    if not BASELINE.is_file():
        return mapping
    for line in BASELINE.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        digest, name = line.split(None, 1)
        mapping[name.strip()] = digest
    return mapping


def baseline_fields(workspace_rel: str, baseline: dict[str, str]) -> dict[str, Any]:
    terrarium_rel = workspace_rel.removeprefix("terrarium/")
    if terrarium_rel in baseline:
        return {
            "immutableBaselineListed": True,
            "immutableBaselineSha256": baseline[terrarium_rel],
        }
    return {"immutableBaselineListed": False}


def artifact(
    path: Path,
    *,
    honesty_class: str,
    role: str,
    source: str,
    note: str,
    baseline: dict[str, str],
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    if honesty_class not in ALLOWED_CLASSES:
        raise ValueError(f"honesty class {honesty_class!r} is not allowed")
    if not path.is_file():
        raise FileNotFoundError(path)
    workspace_rel = rel(path)
    record: dict[str, Any] = {
        "path": workspace_rel,
        "sha256": sha256_file(path),
        "bytes": path.stat().st_size,
        "honestyClass": honesty_class,
        "role": role,
        "source": source,
        "note": note,
    }
    record.update(baseline_fields(workspace_rel, baseline))
    if extra:
        record.update(extra)
    return record


def collect_glob(directory: Path, pattern: str) -> list[Path]:
    return sorted(path for path in directory.glob(pattern) if path.is_file())


def collect_artifacts(baseline: dict[str, str]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    primary: list[dict[str, Any]] = []
    also: list[dict[str, Any]] = []

    cad01_note = (
        f"CAD-01 / PR 34 STEP lineage {CAD01_STEP_SHA[:12]}. "
        "Draft-measured. CAD-02 does not admit this as a released parent."
    )
    cad02_note = (
        "CAD-02 / PR 36 Python + PR 58 OCCT STEP. Theoretical/UNVERIFIED. "
        "B27 and B50 are proxies. FreeCADCmd was not used."
    )

    for directory, honesty, source, note in (
        (TERRARIUM / "cad" / "src" / "frame" / "exports", "draft-measured", "pr-34", cad01_note),
        (TERRARIUM / "cad" / "src" / "rail" / "exports", "draft-measured", "pr-34", cad01_note),
        (TERRARIUM / "cad" / "src" / "boundary" / "exports", "draft-measured", "pr-34", cad01_note),
        (TERRARIUM / "cad" / "src" / "carriage" / "exports", "theoretical", "pr-58-occt", cad02_note),
        (TERRARIUM / "cad" / "src" / "binder" / "exports", "theoretical", "pr-58-occt", cad02_note),
    ):
        for path in collect_glob(directory, "*.step"):
            primary.append(
                artifact(
                    path,
                    honesty_class=honesty,
                    role="geometry",
                    source=source,
                    note=note,
                    baseline=baseline,
                )
            )
        for path in collect_glob(directory, "*.stl"):
            also.append(
                artifact(
                    path,
                    honesty_class=honesty,
                    role="geometry",
                    source=source,
                    note=note + " Binary STL present; still DRAFT.",
                    baseline=baseline,
                )
            )

    profiles = TERRARIUM / "cad" / "src" / "boundary" / "exports" / "profiles"
    for path in collect_glob(profiles, "*"):
        if path.suffix.lower() not in {".svg", ".dxf"}:
            continue
        also.append(
            artifact(
                path,
                honesty_class="draft-measured",
                role="cut-profile",
                source="pr-34",
                note="CAD-01 nominal/kerf profiles for B05/B06 only. Not a complete cut set.",
                baseline=baseline,
            )
        )

    for stem, meta in SHEETS.items():
        svg = TERRARIUM / "schematics" / f"{stem}.svg"
        primary.append(
            artifact(
                svg,
                honesty_class=meta["honestyClass"],
                role="sheet",
                source="pr-45/pr-58",
                note=meta["note"],
                baseline=baseline,
                extra={"sheetKind": meta["kind"]},
            )
        )
        png = TERRARIUM / "schematics" / "hitl" / f"{stem}.png"
        primary.append(
            artifact(
                png,
                honesty_class="diagram",
                role="look",
                source="pr-45/pr-58",
                note=(
                    "HITL Look only. Same balloons as the SVG for appearance review. "
                    "A PNG is not geometry and does not prove scale, fit, or safety."
                ),
                baseline=baseline,
                extra={"sheetKind": "look", "notGeometry": True},
            )
        )

    primary.append(
        artifact(
            TERRARIUM / "schematics" / "schematics.pdf",
            honesty_class="theoretical",
            role="sheet-set",
            source="pr-58",
            note=(
                "Combined A3 vector PDF of S00–S11. Contains draft-measured projections "
                "and diagrams. Not a SHOP-RELEASE drawing set."
            ),
            baseline=baseline,
        )
    )
    return primary, also


def missing_and_blockers() -> tuple[list[dict[str, str]], list[dict[str, str]]]:
    freecad = shutil.which("FreeCADCmd")
    blockers = [
        {
            "id": "freecadcmd-absent",
            "status": "blocker" if freecad is None else "present",
            "tool": "FreeCADCmd",
            "onPath": bool(freecad),
            "action": (
                "Do not silently fake solids. Reuse existing STEP. "
                "Carriage/binder STL were not emitted."
                if freecad is None
                else "FreeCADCmd is on PATH; this index still did not re-export STEP."
            ),
        }
    ]
    missing = [
        {
            "id": "carriage-binder-stl",
            "status": "absent",
            "note": "CAD-02 STEP exists from OCCT; binary-mm STL was not written (FreeCADCmd absent).",
        },
        {
            "id": "complete-dxf-kerf-set",
            "status": "absent",
            "note": "Only B05/B06 CAD-01 cut profiles exist. No complete kerf package.",
        },
        {
            "id": "native-kicad-boards",
            "status": "absent",
            "note": "S08 is a diagram. EE-24/25/26 remain unmerged child PRs. Circuit authority is not this pack.",
        },
        {
            "id": "camera-sku",
            "status": "UNVERIFIED",
            "note": "No camera module SKU selected. None invented.",
        },
        {
            "id": "connector-pinout",
            "status": "UNVERIFIED",
            "note": "No B27/B50 series or pinout selected. None invented.",
        },
        {
            "id": "s1-s2-q1-mpn",
            "status": "UNVERIFIED",
            "note": "Issue #24 unmet. Electrical parts not selected.",
        },
        {
            "id": "first-article-measurement",
            "status": "absent",
            "note": "No fabricated article, no redlines, no independent release review.",
        },
        {
            "id": "immutable-release-archive",
            "status": "absent",
            "note": "Release A ZIP is historical capture, not this pack, and not SHOP-RELEASE.",
        },
    ]
    return missing, blockers


def claims() -> dict[str, Any]:
    return {
        "maturity": "draft",
        "SHOP-RELEASE": False,
        "QUALIFIED": False,
        "PROTO-FAB": False,
        "firstArticle": False,
        "order": False,
        "energize": False,
        "animalUse": False,
        "cad02AdmitsPr34AsReleasedParent": False,
    }


def build() -> dict[str, Any]:
    baseline = load_baseline()
    artifacts, also_present = collect_artifacts(baseline)
    missing, blockers = missing_and_blockers()
    mismatched_baseline = [
        item["path"]
        for item in artifacts
        if item.get("immutableBaselineListed")
        and item.get("immutableBaselineSha256") != item["sha256"]
    ]
    return {
        "schemaVersion": "1.0.0",
        "kind": "DraftShopIndex",
        "lifecycle": "generated",
        "notABaseline": True,
        "packageClass": "DRAFT",
        "issue": 31,
        "title": "DRAFT shop pack — CAD index only",
        "claims": claims(),
        "honestyClassesAllowed": sorted(ALLOWED_CLASSES),
        "sources": {
            "lab": {
                "branch": "feat/mantis-biomemetics-lab",
                "sha": LAB_SHA,
                "pr": 20,
            },
            "cad01": {
                "pr": 34,
                "issue": 28,
                "stepSha": CAD01_STEP_SHA,
                "mergedIntoLab": CAD01_MERGE,
                "honestyClass": "draft-measured",
                "admittedAsReleasedParent": False,
            },
            "cad02": {
                "pr": 36,
                "issue": 29,
                "mergedIntoLab": CAD02_MERGE,
                "honestyClass": "theoretical",
                "proxies": ["B27", "B50"],
                "unverified": True,
            },
            "theoreticalSheets": {
                "pr": 45,
                "state": "closed-then-stacked",
                "head": PR45_HEAD,
            },
            "projectedSheets": {
                "pr": 58,
                "mergedInto": 45,
                "head": PR58_HEAD,
            },
        },
        "immutableBaseline": {
            "path": "terrarium/MANIFEST.sha256",
            "policy": "ADR-003: verifiers never regenerate this baseline. This index does not rewrite it.",
            "stackedSheetMismatchCount": len(mismatched_baseline),
            "stackedSheetMismatches": mismatched_baseline,
        },
        "didNot": [
            "regenerate STEP",
            "invoke FreeCADCmd",
            "rewrite terrarium/MANIFEST.sha256",
            "claim SHOP-RELEASE or QUALIFIED",
            "order or energize",
            "invent pinout, SKU, or GPS",
            "merge PR 57 (CI red)",
            "restyle specimendb",
        ],
        "artifacts": artifacts,
        "alsoPresent": also_present,
        "missing": missing,
        "blockers": blockers,
    }


def verify(document: dict[str, Any]) -> list[str]:
    failures: list[str] = []
    if document.get("packageClass") != "DRAFT":
        failures.append("packageClass must remain DRAFT")
    claims_doc = document.get("claims")
    if not isinstance(claims_doc, dict) or claims_doc.get("SHOP-RELEASE") or claims_doc.get("QUALIFIED"):
        failures.append("SHOP-RELEASE/QUALIFIED must not be claimed")
    for index, record in enumerate(document.get("artifacts") or []):
        if not isinstance(record, dict):
            failures.append(f"artifact[{index}] must be an object")
            continue
        honesty = record.get("honestyClass")
        if honesty not in ALLOWED_CLASSES:
            failures.append(f"{record.get('path')}: honesty class {honesty!r} not allowed")
        relative = record.get("path")
        expected = record.get("sha256")
        if not isinstance(relative, str) or not isinstance(expected, str):
            failures.append(f"artifact[{index}] needs path and sha256")
            continue
        path = WORKSPACE / relative
        if not path.is_file():
            failures.append(f"missing {relative}")
            continue
        observed = sha256_file(path)
        if observed != expected:
            failures.append(f"sha256 mismatch: {relative}")
        if record.get("role") == "look" and (
            record.get("honestyClass") != "diagram" or not record.get("notGeometry")
        ):
            failures.append(f"{relative}: HITL Look must be diagram/notGeometry")
        if relative.endswith(".step") and relative.startswith("terrarium/cad/"):
            # Indexer must catalog existing solids, not newly invented ones.
            continue
    if document.get("lifecycle") != "generated":
        failures.append("draft shop index lifecycle must stay generated (not a certified baseline)")
    return failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="verify committed manifest only")
    args = parser.parse_args(argv)
    out = SHOP / "manifest.json"
    if args.check:
        document = json.loads(out.read_text(encoding="utf-8"))
    else:
        document = build()
        out.write_text(json.dumps(document, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    failures = verify(document)
    if failures:
        print(json.dumps({"ok": False, "failures": failures}, indent=2), file=sys.stderr)
        return 1
    print(json.dumps({"ok": True, "path": rel(out), "count": len(document["artifacts"])}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
