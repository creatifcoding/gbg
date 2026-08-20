"""Working-draft-B terrarium architectural lock checks."""

from __future__ import annotations

import json
from pathlib import Path
from pathlib import PurePosixPath
from typing import Any


class TerrariumLockError(ValueError):
    """Raised when a safety or interface lock is violated."""


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise TerrariumLockError(f"{path} must contain a JSON object")
    return value


def validate_draft_b(root: Path) -> list[str]:
    """Check only source locks; TARGET and UNVERIFIED values remain non-facts."""

    params = load_json(root / "terrarium" / "params.json")
    bus = load_json(root / "terrarium" / "bus.json")
    failures: list[str] = []

    parameter_records = params.get("parameters")
    if not isinstance(parameter_records, dict):
        return ["terrarium params must contain a parameters object map"]

    def value(name: str) -> Any:
        record = parameter_records.get(name)
        return record.get("value") if isinstance(record, dict) else None

    def record(name: str) -> dict[str, Any]:
        candidate = parameter_records.get(name)
        return candidate if isinstance(candidate, dict) else {}

    def require_parameter_semantics(
        names: list[str], *, status: str, unit: str | None
    ) -> None:
        for name in names:
            candidate = record(name)
            if candidate.get("status") != status:
                failures.append(f"{name} status must remain {status!r}")
            if unit is not None and candidate.get("unit") != unit:
                failures.append(f"{name} unit must remain {unit!r}")

    expected_dimensions = {
        "frame.exterior.width": 250,
        "frame.exterior.depth": 250,
        "frame.exterior.height": 500,
    }
    if any(value(name) != expected for name, expected in expected_dimensions.items()):
        failures.append("exterior dimensions must remain 250 x 250 x 500 mm")
    if value("frame.module_pitch") != 250 or value("frame.first_span") != 500:
        failures.append("250/500 frame grid lock violated")
    if params.get("revision") != "B-draft" or bus.get("release") != "B-draft":
        failures.append("editable terrarium contracts must identify working draft B")
    if value("panel.stock_thickness") != 3:
        failures.append("panel stock thickness must remain 3 mm")
    aperture = value("husbandry.screen.aperture_max")
    if not isinstance(aperture, (int, float)) or aperture > 0.8:
        failures.append("screen aperture exceeds 0.8 mm")
    if value("animal_volume.metal_allowed") is not False:
        failures.append("metalAllowedInAnimalVolume must be false")
    if value("rail.contact_count") != 12:
        failures.append("rail.contact_count must remain 12")
    if value("rail.video_dock_count_per_span") != 4:
        failures.append("500 mm rail span must model four indexed video docks")
    if value("pogo.working_compression") != 0.6:
        failures.append("pogo working compression target must remain 0.60 mm")
    if value("pogo.released_contact_lift_min") != 1.2:
        failures.append("released contact lift target must remain at least 1.20 mm")
    if value("binder.pull_off_min") != 40:
        failures.append("binder pull-off target must remain at least 40 N")

    require_parameter_semantics(
        [
            "frame.exterior.width",
            "frame.exterior.depth",
            "frame.exterior.height",
            "frame.module_pitch",
            "frame.first_span",
            "panel.stock_thickness",
            "husbandry.screen.aperture_max",
        ],
        status="locked",
        unit="mm",
    )
    require_parameter_semantics(
        ["rail.contact_count"], status="locked", unit="count"
    )
    require_parameter_semantics(
        [
            "rail.contact_pitch",
            "rail.contact_land_width",
            "pogo.working_compression",
            "pogo.released_contact_lift_min",
            "carriage.pinch_input_travel",
        ],
        status="target",
        unit="mm",
    )
    require_parameter_semantics(
        ["carriage.pinch_force", "binder.pull_off_min"],
        status="target",
        unit="N",
    )
    if record("animal_volume.metal_allowed").get("status") != "locked":
        failures.append("animal_volume.metal_allowed status must remain 'locked'")

    architecture = bus.get("architecture", {})
    if architecture.get("cameraTethered") is not False:
        failures.append("camera carriage must remain untethered")
    if architecture.get("rawMipiOnRail") is not False:
        failures.append("raw MIPI must not be placed on the rail")
    if architecture.get("videoWhileMoving") is not False:
        failures.append("working draft B must not admit video while moving")
    if architecture.get("contactSequence") != "break-before-move":
        failures.append("contact sequence must be break-before-move")
    if architecture.get("videoTransport") != "GMSL2":
        failures.append("working draft B video transport must remain GMSL2")
    expected_architecture = {
        "powerSwitchScope": "per-carriage-load-branch",
        "safetyInterlock": "local-mechanical-normally-open",
        "p08SafetyCritical": False,
        "trainingWindow": "bounded-timeout-then-latch-off",
        "binderElectricalInterface": "separate-keyed-12-net-unverified",
        "binderRemoval": "mechanically-blocked-unless-pinch-safe",
        "binderMateInterlock": "local-mechanical-S2",
    }
    for field, expected in expected_architecture.items():
        if architecture.get(field) != expected:
            failures.append(f"architecture.{field} must remain {expected!r}")

    expected_camera_path = [
        "Sony-IMX519-autofocus-module-TBD",
        "local-MIPI-CSI-2",
        "MAX96717",
        "B50-keyed-binder-interface",
        "GMSL2-dock",
        "MAX96724",
        "short-22-position-0.5-mm-CSI-2",
        "Particle-Tachyon",
    ]
    if bus.get("cameraPath") != expected_camera_path:
        failures.append("camera path must include the B50 handoff and keep raw MIPI local")

    contacts = bus.get("contacts")
    expected_contacts = [
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
    actual_contacts = []
    if isinstance(contacts, list):
        actual_contacts = [
            (item.get("pin"), item.get("net"), item.get("geometry"), item.get("role"))
            for item in contacts
            if isinstance(item, dict)
        ]
    if actual_contacts != expected_contacts:
        failures.append("working draft B contact map must exactly match P01-P12")

    expected_states = [
        "absent",
        "mechanically-seated",
        "power-mated",
        "training-window",
        "link-trained",
        "fault-latched",
        "pinch-safe",
        "lifted",
    ]
    if bus.get("states") != expected_states:
        failures.append("working draft B state order is inconsistent")

    expected_transition_ids = [
        "t01-seat",
        "t02-mate",
        "t03-train",
        "t04-admit",
        "t05-training-fault",
        "t06-active-fault",
        "t07-pinch-safe",
        "t08-lift",
        "t09-indexed-release",
        "t10-interrupted-pinch",
        "t11-fault-detach",
    ]
    transitions = bus.get("transitions")
    transition_ids = (
        [item.get("id") for item in transitions if isinstance(item, dict)]
        if isinstance(transitions, list)
        else []
    )
    if transition_ids != expected_transition_ids:
        failures.append("working draft B transition set or order is inconsistent")
    if isinstance(transitions, list):
        transitions_by_id = {
            item.get("id"): item for item in transitions if isinstance(item, dict)
        }
        expected_edges = {
            "t01-seat": ("absent", "mechanically-seated"),
            "t02-mate": ("mechanically-seated", "power-mated"),
            "t03-train": ("power-mated", "training-window"),
            "t04-admit": ("training-window", "link-trained"),
            "t05-training-fault": ("training-window", "fault-latched"),
            "t06-active-fault": ("link-trained", "fault-latched"),
            "t07-pinch-safe": ("link-trained", "pinch-safe"),
            "t08-lift": ("pinch-safe", "lifted"),
            "t09-indexed-release": ("lifted", "mechanically-seated"),
            "t10-interrupted-pinch": ("pinch-safe", "mechanically-seated"),
            "t11-fault-detach": ("fault-latched", "absent"),
        }
        required_tokens = {
            "t01-seat": {
                "guards": {"S1-open", "S2-open"},
                "actions": {"keep-Q1-off", "isolate-low-speed"},
            },
            "t02-mate": {
                "guards": {
                    "B27-fully-seated",
                    "B50-fully-seated",
                    "S1-closed",
                    "S2-closed",
                    "ground-first-mate-order-confirmed",
                    "low-speed-backfeed-blocked",
                },
                "actions": {"keep-video-muted"},
            },
            "t03-train": {
                "guards": {"UID-valid", "no-overcurrent", "mate-state-stable"},
                "actions": {"enable-current-limited-Q1", "start-bounded-timeout"},
            },
            "t04-admit": {
                "guards": {"GMSL-lock", "UID-stable", "no-fault"},
                "actions": {"admit-video"},
            },
            "t05-training-fault": {
                "actions": {
                    "mute-video",
                    "turn-Q1-off",
                    "discharge-load",
                    "isolate-low-speed",
                }
            },
            "t06-active-fault": {
                "actions": {
                    "mute-video",
                    "turn-Q1-off",
                    "discharge-load",
                    "isolate-low-speed",
                }
            },
            "t07-pinch-safe": {
                "guards": {"S1-opens-on-first-pinch-travel"},
                "actions": {
                    "mute-video",
                    "turn-Q1-off",
                    "discharge-load",
                    "isolate-low-speed",
                },
            },
            "t08-lift": {
                "guards": {
                    "branch-voltage-below-selected-threshold",
                    "all-signals-isolated",
                    "released-contact-lift-achieved",
                },
                "actions": {"permit-roller-translation"},
            },
            "t09-indexed-release": {
                "guards": {"translation-stopped", "indexed-dock-aligned"},
                "actions": {"keep-Q1-off", "settle-contacts-before-remate"},
            },
            "t10-interrupted-pinch": {
                "guards": {"pinch-released-before-lift"},
                "actions": {"keep-Q1-off", "require-clean-full-remate"},
            },
            "t11-fault-detach": {
                "guards": {"clean-detach"},
                "actions": {"clear-latch-only-after-branch-safe"},
            },
        }
        for transition_id, edge in expected_edges.items():
            transition = transitions_by_id.get(transition_id)
            if not isinstance(transition, dict):
                continue
            if (transition.get("from"), transition.get("to")) != edge:
                failures.append(f"{transition_id} state edge is inconsistent")
            for field, expected in required_tokens.get(transition_id, {}).items():
                actual = transition.get(field)
                actual_tokens = set(actual) if isinstance(actual, list) else set()
                missing = expected - actual_tokens
                if missing:
                    failures.append(
                        f"{transition_id} {field} missing: {', '.join(sorted(missing))}"
                    )

    expected_requirements = {
        "sr-power-sequence": "terrarium/ee/protocols/power-sequence.md",
        "sr-single-fault": "terrarium/ee/protocols/single-fault.md",
        "sr-mate-order-backfeed": "terrarium/ee/protocols/power-sequence.md",
        "sr-interrupted-pinch": "terrarium/ee/protocols/power-sequence.md",
        "sr-complete-channel": "terrarium/ee/protocols/high-speed-channel.md",
        "sr-route-retention": "terrarium/ee/protocols/route-retention.md",
    }
    requirements = bus.get("safetyRequirements")
    requirement_ids = (
        [item.get("id") for item in requirements if isinstance(item, dict)]
        if isinstance(requirements, list)
        else []
    )
    if requirement_ids != list(expected_requirements):
        failures.append("working draft B safety requirement set or order is inconsistent")
    if isinstance(requirements, list):
        for item in requirements:
            if not isinstance(item, dict):
                failures.append("every safety requirement must be an object")
                continue
            requirement_id = item.get("id")
            if item.get("status") != "unverified":
                failures.append(f"{requirement_id} must remain unverified")
            if item.get("evidenceRefs") != []:
                failures.append(f"{requirement_id} cannot claim evidence before review")
            protocol_ref = item.get("protocolRef")
            if protocol_ref != expected_requirements.get(requirement_id):
                failures.append(f"{requirement_id} protocol reference is inconsistent")
                continue
            logical = PurePosixPath(protocol_ref)
            if logical.is_absolute() or ".." in logical.parts:
                failures.append(f"{requirement_id} protocol reference escapes the workspace")
                continue
            protocol_path = (root / Path(*logical.parts)).resolve()
            try:
                protocol_path.relative_to(root.resolve())
            except ValueError:
                failures.append(f"{requirement_id} protocol reference escapes the workspace")
                continue
            if not protocol_path.is_file():
                failures.append(f"{requirement_id} protocol file does not exist")
    return failures
