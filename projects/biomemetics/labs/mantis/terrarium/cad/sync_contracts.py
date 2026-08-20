#!/usr/bin/env python3
"""Validate terrarium contract locks and emit deterministic OpenSCAD constants."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
PARAMS_PATH = ROOT / "params.json"
BUS_PATH = ROOT / "bus.json"
OUTPUT = Path(__file__).resolve().parent / "generated" / "contracts.scad"

EXPECTED_CONTACTS = [
    ("P01", "VIN-A", "continuous", "power"),
    ("P02", "VIN-B", "continuous", "power"),
    ("P03", "GND-A", "continuous", "return"),
    ("P04", "GND-B", "continuous", "return"),
    ("P05", "SDA", "continuous", "control"),
    ("P06", "SCL", "continuous", "control"),
    ("P07", "UID", "continuous", "identity"),
    ("P08", "FAULT_N/IRQ", "continuous", "diagnostic"),
    ("P09", "HSGND", "discrete-dock", "high-speed-ground"),
    ("P10", "GMSL+", "discrete-dock", "high-speed-positive"),
    ("P11", "GMSL-", "discrete-dock", "high-speed-negative"),
    ("P12", "HSGND", "discrete-dock", "high-speed-ground"),
]


def _load(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain an object")
    return value


def load_contracts() -> dict[str, Any]:
    params_doc = _load(PARAMS_PATH)
    bus_doc = _load(BUS_PATH)
    if params_doc.get("revision") != "B-draft" or bus_doc.get("release") != "B-draft":
        raise ValueError("CAD generation requires matching B-draft contracts")

    records = params_doc.get("parameters")
    if not isinstance(records, dict):
        raise ValueError("params.json requires a parameters object")

    def parameter(name: str) -> Any:
        record = records.get(name)
        if not isinstance(record, dict) or "value" not in record:
            raise ValueError(f"missing valued parameter {name}")
        return record["value"]

    def parameter_range(name: str) -> tuple[Any, Any]:
        record = records.get(name)
        bounds = record.get("range") if isinstance(record, dict) else None
        if not isinstance(bounds, dict) or "minimum" not in bounds or "maximum" not in bounds:
            raise ValueError(f"missing range for parameter {name}")
        return bounds["minimum"], bounds["maximum"]

    contacts = bus_doc.get("contacts")
    actual_contacts = []
    if isinstance(contacts, list):
        actual_contacts = [
            (item.get("pin"), item.get("net"), item.get("geometry"), item.get("role"))
            for item in contacts
            if isinstance(item, dict)
        ]
    if actual_contacts != EXPECTED_CONTACTS:
        raise ValueError("bus contact order no longer matches the drawing/CAD lock")

    values = {
        "pitch_mm": parameter("frame.module_pitch"),
        "span_mm": parameter("frame.first_span"),
        "frame_w": parameter("frame.band"),
        "panel_t": parameter("panel.stock_thickness"),
        "rail_w": parameter("rail.envelope.width"),
        "rail_h": parameter("rail.envelope.height"),
        "rail_wall": parameter("rail.side_wall"),
        "strip_count": parameter("rail.contact_count"),
        "pogo_pitch": parameter("rail.contact_pitch"),
        "contact_land_w": parameter("rail.contact_land_width"),
        "video_dock_count": parameter("rail.video_dock_count_per_span"),
        "pogo_compression": parameter("pogo.working_compression"),
        "pogo_lift_min": parameter("pogo.released_contact_lift_min"),
        "pinch_force": parameter("carriage.pinch_force"),
        "binder_pull_off_min": parameter("binder.pull_off_min"),
        "screen_aperture_max": parameter("husbandry.screen.aperture_max"),
    }
    pinch_min, pinch_max = parameter_range("carriage.pinch_force")
    values["pinch_force_min"] = pinch_min
    values["pinch_force_max"] = pinch_max
    for name, value in values.items():
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            raise ValueError(f"{name} must be numeric")

    contact_field = (values["strip_count"] - 1) * values["pogo_pitch"] + values["contact_land_w"]
    cavity_width = values["rail_w"] - 2 * values["rail_wall"]
    if contact_field > cavity_width:
        raise ValueError(
            f"contact field {contact_field:.3f} mm exceeds rail cavity {cavity_width:.3f} mm"
        )
    if values["video_dock_count"] <= 0:
        raise ValueError("video dock count must be positive")
    values["video_dock_pitch"] = values["span_mm"] / values["video_dock_count"]

    return {
        "parameters": values,
        "contacts": contacts,
        "paramsSha256": hashlib.sha256(PARAMS_PATH.read_bytes()).hexdigest(),
        "busSha256": hashlib.sha256(BUS_PATH.read_bytes()).hexdigest(),
    }


def render_scad(contract: dict[str, Any]) -> str:
    values = contract["parameters"]
    names = [
        "pitch_mm",
        "span_mm",
        "frame_w",
        "panel_t",
        "rail_w",
        "rail_h",
        "rail_wall",
        "strip_count",
        "pogo_pitch",
        "contact_land_w",
        "video_dock_count",
        "video_dock_pitch",
    ]
    lines = [
        "// GENERATED by cad/sync_contracts.py; do not hand-edit.",
        f"// params.json sha256: {contract['paramsSha256']}",
        f"// bus.json sha256: {contract['busSha256']}",
    ]
    for name in names:
        lines.append(f"{name} = {json.dumps(values[name])};")
    lines.append("")
    return "\n".join(lines)


def sync_scad() -> Path:
    contract = load_contracts()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(render_scad(contract), encoding="utf-8")
    return OUTPUT


def main() -> None:
    print(sync_scad())


if __name__ == "__main__":
    main()
