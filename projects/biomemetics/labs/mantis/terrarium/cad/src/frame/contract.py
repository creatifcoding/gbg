from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

from frame.csg import Dim


SRC_ROOT = Path(__file__).resolve().parents[1]
CAD_ROOT = SRC_ROOT.parent
TERRARIUM_ROOT = CAD_ROOT.parent
LAB_ROOT = TERRARIUM_ROOT.parent
PARAMS_PATH = TERRARIUM_ROOT / "params.json"
BUS_PATH = TERRARIUM_ROOT / "bus.json"
STUDY_SCAD = CAD_ROOT / "mantis_terrarium.scad"
MATURITY = "DRAFT"
AUTHORITY = "freecad-part-occt"
WORLD_FRAME = "frame.world"
AXES = {"x": "right", "y": "back", "z": "up"}


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
        raise ValueError("OCCT generation requires matching B-draft contracts")
    records = params_doc.get("parameters")
    if not isinstance(records, dict):
        raise ValueError("params.json requires a parameters object")

    def dim(name: str) -> Dim:
        value, status, unit = _parameter(records, name)
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"{name} must be numeric")
        mapped: dict[str, str] = {
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
    if pitch.value != 250 or span.value != 500:
        raise ValueError("250/500 grid lock violated")
    if width.value != 250 or depth.value != 250 or height.value != 500:
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

    study_dims = {
        "rail.offset_from_frame": Dim(
            "rail.offset_from_frame",
            5.0,
            "mm",
            "ref",
            f"{STUDY_SCAD}:rail_offset",
        ),
        "rail.guard_lip_thickness": Dim(
            "rail.guard_lip_thickness",
            1.5,
            "mm",
            "ref",
            f"{STUDY_SCAD}:guard_t",
        ),
        "carriage.envelope.width": Dim(
            "carriage.envelope.width",
            60.0,
            "mm",
            "ref",
            "terrarium/PARAMS.md",
        ),
        "carriage.envelope.depth": Dim(
            "carriage.envelope.depth",
            42.0,
            "mm",
            "ref",
            "terrarium/PARAMS.md",
        ),
        "carriage.envelope.height": Dim(
            "carriage.envelope.height",
            28.0,
            "mm",
            "ref",
            "terrarium/PARAMS.md",
        ),
        "cassette.pocket_inset": Dim(
            "cassette.pocket_inset",
            10.0,
            "mm",
            "ref",
            f"{STUDY_SCAD}:cassette pocket translate y=10",
        ),
        "cassette.pocket_height": Dim(
            "cassette.pocket_height",
            10.0,
            "mm",
            "ref",
            f"{STUDY_SCAD}:cassette pocket cube z=10",
        ),
        "cassette.pocket_z": Dim(
            "cassette.pocket_z",
            8.0,
            "mm",
            "ref",
            f"{STUDY_SCAD}:cassette pocket translate z=8",
        ),
        "edge.inner_shell_inset": Dim(
            "edge.inner_shell_inset",
            4.0,
            "mm",
            "ref",
            f"{STUDY_SCAD}:edge_block inner cut 4 mm",
        ),
        "corner.inner_shell_inset": Dim(
            "corner.inner_shell_inset",
            8.0,
            "mm",
            "ref",
            f"{STUDY_SCAD}:corner_post inner cut 8 mm",
        ),
        "b03.coupler_length": Dim(
            "b03.coupler_length",
            22.0,
            "mm",
            "ref",
            "terrarium/schematics/S03-blocks.svg annotation 22 REF COUPLER",
        ),
        "b51.end_stop_length": Dim(
            "b51.end_stop_length",
            8.0,
            "mm",
            "ref",
            f"{STUDY_SCAD}:rail_end_stop cube x=8",
        ),
        "b51.service_bore_diameter": Dim(
            "b51.service_bore_diameter",
            3.4,
            "mm",
            "unverified",
            f"{STUDY_SCAD}:M3 clearance 3.4; fastener PN absent",
        ),
        "b19.land_thickness": Dim(
            "b19.land_thickness",
            0.2,
            "mm",
            "ref",
            f"{STUDY_SCAD}:strip cube z=0.2",
        ),
        "b19.dock_pad_length": Dim(
            "b19.dock_pad_length",
            18.0,
            "mm",
            "ref",
            f"{STUDY_SCAD}:dock pad length 18",
        ),
        "b52.slot_clearance": Dim(
            "b52.slot_clearance",
            0.4,
            "mm",
            "ref",
            f"{STUDY_SCAD}:rail_access_guard 0.4",
        ),
        "cut.kerf": Dim(
            "cut.kerf",
            0.15,
            "mm",
            "ref",
            "terrarium/docs/metaprompts/mantis-terrarium-metaprompt.md kerf default",
        ),
        "husbandry.upper_third_clear": Dim(
            "husbandry.upper_third_clear",
            142.0,
            "mm",
            "calculated",
            "terrarium/PARAMS.md",
        ),
        "door.nymph_visible_gap_max": Dim(
            "door.nymph_visible_gap_max",
            0.5,
            "mm",
            "target",
            "terrarium/PARAMS.md",
        ),
        "false_bottom.tray_depth": dim("false_bottom.tray_depth")
        if "false_bottom.tray_depth" in records
        else Dim(
            "false_bottom.tray_depth",
            25.0,
            "mm",
            "ref",
            "terrarium/PARAMS.md",
        ),
    }

    dims = {
        "frame.exterior.width": width,
        "frame.exterior.depth": depth,
        "frame.exterior.height": height,
        "frame.module_pitch": pitch,
        "frame.first_span": span,
        "frame.band": dim("frame.band"),
        "panel.stock_thickness": dim("panel.stock_thickness"),
        "animal.clear.width": dim("animal.clear.width"),
        "animal.clear.depth": dim("animal.clear.depth"),
        "animal.clear.height": dim("animal.clear.height"),
        "husbandry.screen.aperture_max": dim("husbandry.screen.aperture_max"),
        "rail.envelope.width": dim("rail.envelope.width"),
        "rail.envelope.height": dim("rail.envelope.height"),
        "rail.side_wall": dim("rail.side_wall"),
        "rail.contact_count": dim("rail.contact_count"),
        "rail.contact_pitch": dim("rail.contact_pitch"),
        "rail.contact_land_width": dim("rail.contact_land_width"),
        "rail.video_dock_count_per_span": dim("rail.video_dock_count_per_span"),
        "pogo.working_compression": dim("pogo.working_compression"),
        "pogo.released_contact_lift_min": dim("pogo.released_contact_lift_min"),
        "cassette.seat_clearance": Dim(
            "cassette.seat_clearance",
            0.20,
            "mm",
            "target",
            "terrarium/PARAMS.md cassette seat stock + 0.20",
        ),
        **study_dims,
    }

    contact_field = (
        (dims["rail.contact_count"].value - 1) * dims["rail.contact_pitch"].value
        + dims["rail.contact_land_width"].value
    )
    cavity = dims["rail.envelope.width"].value - 2 * dims["rail.side_wall"].value
    if contact_field > cavity:
        raise ValueError(
            f"contact field {contact_field:.3f} mm exceeds rail cavity {cavity:.3f} mm"
        )
    dock_count = dims["rail.video_dock_count_per_span"].value
    if dock_count <= 0:
        raise ValueError("video dock count must be positive")
    video_dock_pitch = span.value / dock_count

    return {
        "maturity": MATURITY,
        "authority": AUTHORITY,
        "worldFrame": WORLD_FRAME,
        "axes": AXES,
        "dims": dims,
        "architecture": architecture,
        "contacts": bus_doc.get("contacts"),
        "paramsSha256": hashlib.sha256(PARAMS_PATH.read_bytes()).hexdigest(),
        "busSha256": hashlib.sha256(BUS_PATH.read_bytes()).hexdigest(),
        "studySha256": hashlib.sha256(STUDY_SCAD.read_bytes()).hexdigest()
        if STUDY_SCAD.is_file()
        else None,
        "contactFieldWidth": contact_field,
        "videoDockPitch": video_dock_pitch,
        "labRoot": LAB_ROOT,
        "terrariumRoot": TERRARIUM_ROOT,
        "srcRoot": SRC_ROOT,
    }


def d(contract: dict[str, Any], name: str) -> Dim:
    dims = contract["dims"]
    dim = dims[name]
    if not isinstance(dim, Dim):
        raise TypeError(name)
    return dim
