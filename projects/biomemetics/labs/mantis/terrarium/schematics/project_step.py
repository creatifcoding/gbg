#!/usr/bin/env python3
"""Project CAD-01 / CAD-02 STEP solids to hidden-line polylines.

Writes schematics/projections/manifest.json for generate.py. Frame/rail/B20
STEP is copied read-only from PR 34 SHA fe8f875a80b37a1003f05f3a0190fbe2f0417842
and labeled DRAFT-MEASURED. CAD-02 still does not admit that STEP as parent.
"""

from __future__ import annotations

import json
import traceback
from pathlib import Path

from occt_hlr import CAD01_SHA, hlr_polylines, keep_halfspace, load_step

SCHEMATICS = Path(__file__).resolve().parent
TERRARIUM = SCHEMATICS.parent
CAD_SRC = TERRARIUM / "cad" / "src"
OUT = SCHEMATICS / "projections"

FRONT = ((0.0, -1.0, 0.0), (1.0, 0.0, 0.0))
RIGHT = ((1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
LEFT = ((-1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
TOP = ((0.0, 0.0, 1.0), (1.0, 0.0, 0.0))
BOTTOM = ((0.0, 0.0, -1.0), (1.0, 0.0, 0.0))
ISO = ((1.0, -1.0, 1.0), (1.0, 1.0, 0.0))
# Carriage local: X along rail, Y toward animal, Z lift. Side view looks along -X.
CARRIAGE_SIDE = ((-1.0, 0.0, 0.0), (0.0, 1.0, 0.0))
CARRIAGE_FRONT = ((0.0, -1.0, 0.0), (1.0, 0.0, 0.0))
CARRIAGE_TOP = ((0.0, 0.0, 1.0), (1.0, 0.0, 0.0))


def _job(name, rel, view, source, *, section=None, label=""):
    direction, x_hint = view
    return {
        "name": name,
        "rel": rel,
        "direction": direction,
        "xHint": x_hint,
        "source": source,
        "section": section,
        "label": label,
    }


JOBS = [
    _job("assembly-front", "frame/exports/MANTIS-TERRARIUM-FRAME-RAIL-B20-DRAFT.step", FRONT, "cad01-pr34", label="DRAFT-MEASURED assembly front"),
    _job("assembly-right", "frame/exports/MANTIS-TERRARIUM-FRAME-RAIL-B20-DRAFT.step", RIGHT, "cad01-pr34", label="DRAFT-MEASURED assembly right"),
    _job("assembly-top", "frame/exports/MANTIS-TERRARIUM-FRAME-RAIL-B20-DRAFT.step", TOP, "cad01-pr34", label="DRAFT-MEASURED assembly top"),
    _job("assembly-iso", "frame/exports/MANTIS-TERRARIUM-FRAME-RAIL-B20-DRAFT.step", ISO, "cad01-pr34", label="DRAFT-MEASURED assembly isometric"),
    _job("b20-front", "boundary/exports/B20-animal-wet-barrier.step", FRONT, "cad01-pr34", label="B20 wet-side barrier front"),
    _job("b20-right", "boundary/exports/B20-animal-wet-barrier.step", RIGHT, "cad01-pr34", label="B20 wet-side barrier right"),
    _job("b20-top", "boundary/exports/B20-animal-wet-barrier.step", TOP, "cad01-pr34", label="B20 wet-side barrier top"),
    _job("b01-front", "frame/exports/B01-corner-block.step", FRONT, "cad01-pr34", label="B01 corner"),
    _job("b01-right", "frame/exports/B01-corner-block.step", RIGHT, "cad01-pr34", label="B01 corner right"),
    _job("b01-iso", "frame/exports/B01-corner-block.step", ISO, "cad01-pr34", label="B01 isometric"),
    _job("b02-front", "frame/exports/B02-edge-250.step", FRONT, "cad01-pr34", label="B02 edge 250"),
    _job("b02-top", "frame/exports/B02-edge-250.step", TOP, "cad01-pr34", label="B02 edge top"),
    _job("b03-front", "frame/exports/B03-splice-250-500.step", FRONT, "cad01-pr34", label="B03 splice"),
    _job("b03-top", "frame/exports/B03-splice-250-500.step", TOP, "cad01-pr34", label="B03 splice top"),
    _job("b04-front", "frame/exports/B04-cassette-retainer.step", FRONT, "cad01-pr34", label="B04 retainer"),
    _job("b04-right", "frame/exports/B04-cassette-retainer.step", RIGHT, "cad01-pr34", label="B04 retainer section-ish"),
    _job("b10-top", "frame/exports/B10-ceiling-mesh-frame.step", TOP, "cad01-pr34", label="B10 ceiling frame"),
    _job("b18-250-front", "rail/exports/B18-rail-channel-250.step", FRONT, "cad01-pr34", label="B18 250 front (XZ)"),
    _job("b18-250-top", "rail/exports/B18-rail-channel-250.step", TOP, "cad01-pr34", label="B18 250 top"),
    _job("b18-250-section", "rail/exports/B18-rail-channel-250.step", RIGHT, "cad01-pr34", section={"axis": "x", "at": 125.0}, label="B18 section C-C at X=125"),
    _job("b18-500-front", "rail/exports/B18-rail-channel-500.step", FRONT, "cad01-pr34", label="B18 500 front"),
    _job("b51-front", "rail/exports/B51-end-stop.step", FRONT, "cad01-pr34", label="B51 end stop"),
    _job("b51-right", "rail/exports/B51-end-stop.step", RIGHT, "cad01-pr34", label="B51 end stop right"),
    _job("b52-250-front", "rail/exports/B52-access-guard-250.step", FRONT, "cad01-pr34", label="B52 access guard"),
    _job("b05-front", "boundary/exports/B05-view-cassette.step", FRONT, "cad01-pr34", label="B05 view cassette"),
    _job("b06-front", "boundary/exports/B06-front-door.step", FRONT, "cad01-pr34", label="B06 front door"),
    _job("b07-front", "boundary/exports/B07-door-labyrinth.step", FRONT, "cad01-pr34", label="B07 door labyrinth"),
    _job("b12-front", "boundary/exports/B12-low-intake-vent.step", FRONT, "cad01-pr34", label="B12 low intake"),
    _job("b14-top", "boundary/exports/B14-false-bottom.step", TOP, "cad01-pr34", label="B14 false bottom"),
    # CAD-02 carriage / binder (emitted this run, or missing)
    _job("b22-side", "carriage/exports/B22-carriage-outer-shell.step", CARRIAGE_SIDE, "cad02-occt", label="B22 shell"),
    _job("b22-front", "carriage/exports/B22-carriage-outer-shell.step", CARRIAGE_FRONT, "cad02-occt", label="B22 shell front"),
    _job("b23-front", "carriage/exports/B23-pinch-lever.step", CARRIAGE_FRONT, "cad02-occt", label="B23 pinch lever"),
    _job("b24-front", "carriage/exports/B24-contact-carrier.step", CARRIAGE_FRONT, "cad02-occt", label="B24 carrier"),
    _job("b25-front", "carriage/exports/B25-spring-pocket.step", CARRIAGE_FRONT, "cad02-occt", label="B25 spring pocket"),
    _job("b26-front", "carriage/exports/B26-roller.step", CARRIAGE_FRONT, "cad02-occt", label="B26 roller"),
    _job("b27-front", "carriage/exports/B27-contact-array-proxy.step", CARRIAGE_FRONT, "cad02-occt", label="B27 pogo proxy"),
    _job("b27-side", "carriage/exports/B27-contact-array-proxy.step", CARRIAGE_SIDE, "cad02-occt", label="B27 pogo proxy side"),
    _job("b28-front", "binder/exports/B28-universal-latch-shoe.step", CARRIAGE_FRONT, "cad02-occt", label="B28 shoe"),
    _job("b28-side", "binder/exports/B28-universal-latch-shoe.step", CARRIAGE_SIDE, "cad02-occt", label="B28 shoe side"),
    _job("b29-front", "binder/exports/B29-camera-binder-housing.step", CARRIAGE_FRONT, "cad02-occt", label="B29 binder housing"),
    _job("b29-side", "binder/exports/B29-camera-binder-housing.step", CARRIAGE_SIDE, "cad02-occt", label="B29 binder side"),
    _job("b50-front", "binder/exports/B50-carriage-half-proxy.step", CARRIAGE_FRONT, "cad02-occt", label="B50 carriage half proxy"),
    _job("b34-front", "binder/exports/B34-fpc-clamp.step", CARRIAGE_FRONT, "cad02-occt", label="B34 FPC clamp"),
    _job("carriage-q0-side", "carriage/exports/MANTIS-TERRARIUM-CARRIAGE-BINDER-DRAFT.step", CARRIAGE_SIDE, "cad02-occt", label="carriage/binder q=0 side"),
    _job("carriage-q0-front", "carriage/exports/MANTIS-TERRARIUM-CARRIAGE-BINDER-DRAFT.step", CARRIAGE_FRONT, "cad02-occt", label="carriage/binder q=0 front"),
    _job("carriage-q0-top", "carriage/exports/MANTIS-TERRARIUM-CARRIAGE-BINDER-DRAFT.step", CARRIAGE_TOP, "cad02-occt", label="carriage/binder q=0 top"),
    _job("carriage-q5-side", "carriage/exports/MANTIS-TERRARIUM-CARRIAGE-BINDER-Q5-DRAFT.step", CARRIAGE_SIDE, "cad02-occt", label="carriage/binder q=5 side"),
]


def project_job(job: dict) -> dict:
    path = CAD_SRC / job["rel"]
    if not path.is_file():
        raise FileNotFoundError(str(path))
    shape = load_step(path)
    section = job.get("section")
    if section:
        shape = keep_halfspace(shape, section["axis"], float(section["at"]), keep_negative=True)
    result = hlr_polylines(shape, job["direction"], job["xHint"])
    result.update(
        {
            "name": job["name"],
            "step": job["rel"],
            "source": job["source"],
            "label": job["label"],
            "section": section,
            "cad01Sha": CAD01_SHA if job["source"] == "cad01-pr34" else None,
        }
    )
    return result


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    views = {}
    failed = []
    for job in JOBS:
        try:
            views[job["name"]] = project_job(job)
        except Exception as exc:
            failed.append(
                {
                    "name": job["name"],
                    "step": job["rel"],
                    "error": f"{type(exc).__name__}: {exc}",
                    "source": job["source"],
                }
            )
            traceback.print_exc()
    manifest = {
        "authority": "occt-hlrbrep",
        "tool": "cadquery-ocp HLRBRep (FreeCADCmd not on PATH)",
        "cad01Sha": CAD01_SHA,
        "cad01Note": "PR 34 STEP copied read-only. CAD-02 does not admit it as released parent. Frame views are DRAFT-MEASURED.",
        "viewCount": len(views),
        "failedCount": len(failed),
        "failed": failed,
        "views": views,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": not any(item["source"] == "cad01-pr34" for item in failed),
                "views": len(views),
                "failed": [item["name"] for item in failed],
            }
        )
    )
    return 0 if not any(item["source"] == "cad01-pr34" for item in failed) else 1


if __name__ == "__main__":
    raise SystemExit(main())
