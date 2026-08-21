from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from carriage.csg import Dim


SRC_ROOT = Path(__file__).resolve().parents[1]
CAD_ROOT = SRC_ROOT.parent
TERRARIUM_ROOT = CAD_ROOT.parent
LAB_ROOT = TERRARIUM_ROOT.parent
PARAMS_PATH = TERRARIUM_ROOT / "params.json"
BUS_PATH = TERRARIUM_ROOT / "bus.json"
STUDY_SCAD = CAD_ROOT / "mantis_terrarium.scad"
PARAMS_MD = TERRARIUM_ROOT / "PARAMS.md"
MATURITY = "DRAFT"
AUTHORITY = "freecad-part-occt"
LOCAL_FRAME = "carriage.local"
AXES = {"x": "along-rail", "y": "toward-animal-look", "z": "lift-from-lands"}

# Study-backed mechanism allocation. Not in params.json; proposed only.
# q is pinch input travel (mm). r is binder release travel (mm).
PROPOSED = {
    "carriage.s1_open_travel": Dim(
        "carriage.s1_open_travel",
        1.0,
        "mm",
        "target",
        "gbg#29; first pinch travel opens S1; contacts still stationary",
    ),
    "carriage.pinch_safe_travel": Dim(
        "carriage.pinch_safe_travel",
        2.2,
        "mm",
        "target",
        "gbg#29; S1 overtravel before lift pawl retracts",
    ),
    "carriage.contacts_clear_travel": Dim(
        "carriage.contacts_clear_travel",
        4.0,
        "mm",
        "target",
        "gbg#29; lift cam completes before translation unlock",
    ),
    "carriage.lift_cam_throw": Dim(
        "carriage.lift_cam_throw",
        2.2,
        "mm",
        "target",
        "gbg#29; 1.8 mm calculated clearance plus 0.4 mm print stack",
    ),
    "carriage.print_compensation": Dim(
        "carriage.print_compensation",
        0.20,
        "mm",
        "unverified",
        "same magnitude as cassette.seat 0.20 TARGET; mechanism coupon absent",
    ),
    "pogo.proxy_diameter": Dim(
        "pogo.proxy_diameter",
        1.0,
        "mm",
        "unverified",
        "packaging proxy < 2.54 mm pitch; series/PN absent (#23)",
    ),
    "pogo.barrel_length": Dim(
        "pogo.barrel_length",
        6.0,
        "mm",
        "unverified",
        "envelope only; stroke curve absent",
    ),
    "s1.actuator_envelope": Dim(
        "s1.actuator_envelope",
        8.0,
        "mm",
        "unverified",
        "B48/S1 switch PN absent (#24). Envelope is not a part selection.",
    ),
    "s2.actuator_envelope": Dim(
        "s2.actuator_envelope",
        8.0,
        "mm",
        "unverified",
        "B48/S2 switch PN absent (#24). Envelope is not a part selection.",
    ),
    "binder.s2_open_travel": Dim(
        "binder.s2_open_travel",
        1.0,
        "mm",
        "target",
        "gbg#29; first binder travel opens S2; B50 still seated",
    ),
    "binder.branch_safe_travel": Dim(
        "binder.branch_safe_travel",
        2.0,
        "mm",
        "target",
        "gbg#29; mechanical dwell after S2. Electrical discharge UNVERIFIED (#24).",
    ),
    "binder.free_travel": Dim(
        "binder.free_travel",
        3.5,
        "mm",
        "target",
        "gbg#29; B50 unmate after branch-safe dwell",
    ),
    "binder.b50_key_offset": Dim(
        "binder.b50_key_offset",
        4.0,
        "mm",
        "target",
        "gbg#29; keyed datum blocks 180° reverse mate. Series UNVERIFIED.",
    ),
    "binder.unmate_clearance": Dim(
        "binder.unmate_clearance",
        2.0,
        "mm",
        "target",
        "gbg#29; B50 proxy separation after BRANCH_SAFE",
    ),
    "b26.roller_diameter": Dim(
        "b26.roller_diameter",
        8.0,
        "mm",
        "unverified",
        "BOM B26 PN absent",
    ),
    "camera.module_keepout": Dim(
        "camera.module_keepout",
        32.0,
        "mm",
        "unverified",
        "B36 exact module/revision/STEP absent; not a sourced outline",
    ),
    "csi.local_bend_keepout": Dim(
        "csi.local_bend_keepout",
        12.0,
        "mm",
        "unverified",
        "B37 FPC length/orientation absent; MIPI stays binder-local",
    ),
}


def _load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain an object")
    return value


def _parameter(records: dict[str, Any], name: str) -> tuple[Any, str, str]:
    record = records.get(name)
    if not isinstance(record, dict) or "value" not in record:
        raise ValueError(f"missing valued parameter {name}")
    unit = record.get("unit", "")
    status = record.get("status")
    if not isinstance(status, str):
        raise ValueError(f"{name} is missing status")
    return record["value"], status, unit if isinstance(unit, str) else ""


def load_contract() -> dict[str, Any]:
    params_doc = _load(PARAMS_PATH)
    bus_doc = _load(BUS_PATH)
    if params_doc.get("revision") != "B-draft" or bus_doc.get("release") != "B-draft":
        raise ValueError("carriage/binder generation requires matching B-draft contracts")
    records = params_doc.get("parameters")
    if not isinstance(records, dict):
        raise ValueError("params.json requires a parameters object")

    def dim(name: str) -> Dim:
        value, status, unit = _parameter(records, name)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"{name} must be numeric")
        mapped = {
            "locked": "locked",
            "ref": "ref",
            "target": "target",
            "calculated": "calculated",
            "unverified": "unverified",
        }
        if status not in mapped:
            raise ValueError(f"{name} has unsupported status {status!r}")
        return Dim(name, float(value), unit or "mm", mapped[status], str(PARAMS_PATH))

    pitch = dim("frame.module_pitch")
    span = dim("frame.first_span")
    width = dim("frame.exterior.width")
    depth = dim("frame.exterior.depth")
    height = dim("frame.exterior.height")
    if (pitch.value, span.value) != (250.0, 500.0):
        raise ValueError("250/500 grid lock violated")
    if (width.value, depth.value, height.value) != (250.0, 250.0, 500.0):
        raise ValueError("exterior dimensions must remain 250 x 250 x 500 mm")

    metal_record = records.get("animal_volume.metal_allowed")
    if not isinstance(metal_record, dict) or metal_record.get("value") is not False:
        raise ValueError("animal_volume.metal_allowed must remain false")

    architecture = bus_doc.get("architecture", {})
    if architecture.get("cameraTethered") is not False:
        raise ValueError("camera carriage must remain untethered")
    if architecture.get("videoWhileMoving") is not False:
        raise ValueError("video while rolling is out of v1")
    if architecture.get("rawMipiOnRail") is not False:
        raise ValueError("raw MIPI must not ride the rail")
    if architecture.get("contactSequence") != "break-before-move":
        raise ValueError("contact sequence must remain break-before-move")
    if architecture.get("binderRemoval") != "mechanically-blocked-unless-pinch-safe":
        raise ValueError("binder removal lock violated")

    contacts = bus_doc.get("contacts")
    if not isinstance(contacts, list) or len(contacts) != 12:
        raise ValueError("bus.json must list P01-P12")
    pins = [row.get("pin") for row in contacts if isinstance(row, dict)]
    if pins != [f"P{i:02d}" for i in range(1, 13)]:
        raise ValueError("do not invent or reorder P01-P12")

    envelope = {
        "carriage.envelope.width": Dim(
            "carriage.envelope.width", 60.0, "mm", "ref", str(PARAMS_MD)
        ),
        "carriage.envelope.depth": Dim(
            "carriage.envelope.depth", 42.0, "mm", "ref", str(PARAMS_MD)
        ),
        "carriage.envelope.height": Dim(
            "carriage.envelope.height", 28.0, "mm", "ref", str(PARAMS_MD)
        ),
        "b51.end_stop_length": Dim(
            "b51.end_stop_length",
            8.0,
            "mm",
            "ref",
            f"{STUDY_SCAD}:rail_end_stop cube x=8; #28 STEP not admitted",
        ),
        "b52.slot_clearance": Dim(
            "b52.slot_clearance",
            0.4,
            "mm",
            "ref",
            f"{STUDY_SCAD}:rail_access_guard 0.4; #28 STEP not admitted",
        ),
        "rail.offset_from_frame": Dim(
            "rail.offset_from_frame",
            5.0,
            "mm",
            "ref",
            f"{STUDY_SCAD}:rail_offset",
        ),
    }

    dims = {
        "frame.module_pitch": pitch,
        "frame.first_span": span,
        "frame.exterior.width": width,
        "frame.exterior.depth": depth,
        "frame.exterior.height": height,
        "rail.envelope.width": dim("rail.envelope.width"),
        "rail.envelope.height": dim("rail.envelope.height"),
        "rail.side_wall": dim("rail.side_wall"),
        "rail.contact_count": dim("rail.contact_count"),
        "rail.contact_pitch": dim("rail.contact_pitch"),
        "rail.contact_land_width": dim("rail.contact_land_width"),
        "pogo.working_compression": dim("pogo.working_compression"),
        "pogo.released_contact_lift_min": dim("pogo.released_contact_lift_min"),
        "carriage.pinch_input_travel": dim("carriage.pinch_input_travel"),
        "carriage.pinch_force": dim("carriage.pinch_force"),
        "binder.pull_off_min": dim("binder.pull_off_min"),
        **envelope,
        **PROPOSED,
    }

    q_max = dims["carriage.pinch_input_travel"].value
    if dims["carriage.contacts_clear_travel"].value >= q_max:
        raise ValueError("contacts-clear must occur before full pinch travel")
    if dims["carriage.s1_open_travel"].value >= dims["carriage.pinch_safe_travel"].value:
        raise ValueError("S1_OPEN must precede PINCH_SAFE")
    if dims["carriage.pinch_safe_travel"].value >= dims["carriage.contacts_clear_travel"].value:
        raise ValueError("PINCH_SAFE must precede CONTACTS_CLEAR")
    if dims["binder.s2_open_travel"].value >= dims["binder.branch_safe_travel"].value:
        raise ValueError("S2_OPEN must precede BRANCH_SAFE")
    if dims["binder.branch_safe_travel"].value >= dims["binder.free_travel"].value:
        raise ValueError("BRANCH_SAFE must precede BINDER_FREE")

    clearance = round(
        dims["pogo.working_compression"].value
        + dims["pogo.released_contact_lift_min"].value,
        6,
    )
    if dims["carriage.lift_cam_throw"].value + 1e-9 < clearance:
        raise ValueError("lift cam throw must cover working compression plus lift target")

    return {
        "maturity": MATURITY,
        "authority": AUTHORITY,
        "openscadAuthority": False,
        "worldFrame": LOCAL_FRAME,
        "axes": AXES,
        "dims": dims,
        "architecture": architecture,
        "contacts": contacts,
        "evidenceClass": "theoretical/UNVERIFIED",
        "parentFrame": "PR 34 frame/rail/B20 is draft-only and not admitted",
        "electrical": {
            "S1": "UNVERIFIED",
            "S2": "UNVERIFIED",
            "Q1": "UNVERIFIED",
            "issue24": "unmet",
            "note": "Mechanical envelopes only. Do not invent nets or switch/Q1 parts.",
        },
        "clearanceLiftMm": clearance,
        "paramsSha256": hashlib.sha256(PARAMS_PATH.read_bytes()).hexdigest(),
        "busSha256": hashlib.sha256(BUS_PATH.read_bytes()).hexdigest(),
        "studySha256": hashlib.sha256(STUDY_SCAD.read_bytes()).hexdigest()
        if STUDY_SCAD.is_file()
        else None,
        "labRoot": LAB_ROOT,
        "terrariumRoot": TERRARIUM_ROOT,
        "srcRoot": SRC_ROOT,
    }


def d(contract: dict[str, Any], name: str) -> Dim:
    dim = contract["dims"][name]
    if not isinstance(dim, Dim):
        raise TypeError(name)
    return dim
