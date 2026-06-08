#!/usr/bin/env python3
"""Validate a Muse session directory for protocol compliance.

This validator is the admission gate before downstream metric packs. It checks
manifest structure, artifact presence, Muse capture sanity, marker integrity,
block coverage, events.tsv readiness, and claim-boundary caveats. It emits a
canonical ``MuseMetricPackResult`` JSON with ``packId=protocol-compliance``.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

try:
    from .metric_pack_report import render_markdown
except ImportError:  # Allow `python scripts/muse/validate_protocol.py ...`
    from metric_pack_report import render_markdown  # type: ignore

NANOSECONDS_PER_SECOND = 1_000_000_000
KNOWN_CLOCK_DOMAINS = {
    "host_time_ns",
    "host_monotonic_ns",
    "wall_clock_iso",
    "lsl_time",
    "media_frame_time",
    "unknown",
}
KNOWN_ARTIFACT_ROLES = {
    "muse_jsonl",
    "muse_samples_csv",
    "markers_jsonl",
    "events_tsv",
    "session_manifest",
    "camera_video",
    "camera_frame_ledger",
    "pose_jsonl",
    "sync_map",
    "first_order_report",
    "feature_table",
    "model_artifact",
    "other",
}
KNOWN_CADENCES = {"raw", "sample", "frame", "summary", "marker"}
KNOWN_MARKER_KINDS = {
    "session_start",
    "session_end",
    "block_start",
    "block_end",
    "cue_onset",
    "cue_offset",
    "annotation",
    "pause",
    "resume",
    "abort",
}
KNOWN_MARKER_SOURCES = {"tmnl-conductor", "manual", "external", "unknown"}
KNOWN_EXPECTED_SIGNAL_CLASSES = {
    "transport_only",
    "artifact",
    "resting_state",
    "alpha_contrast_candidate",
    "motion_contamination",
    "unknown",
}
KNOWN_PROTOCOL_BLOCK_KINDS = {
    "fit_check",
    "rest",
    "eyes_open",
    "eyes_closed",
    "blink",
    "jaw_clench",
    "head_motion",
    "motion_rest",
    "cognitive_task",
    "calibration",
    "pause",
    "custom",
}
KNOWN_DEVICE_MODELS = {"Muse 2", "Muse S", "Muse S Athena", "unknown"}
KNOWN_DEVICE_PROTOCOLS = {"classic-fe8d", "athena-universal", "lsl", "unknown"}
KNOWN_CLOCK_MAPPING_METHODS = {
    "same_clock",
    "offset_sample",
    "linear_fit",
    "lsl_clock_offset",
    "manual",
    "unknown",
}
REQUIRED_TOP_LEVEL = (
    "schemaVersion",
    "sessionId",
    "createdAt",
    "taskName",
    "purpose",
    "interpretationBoundary",
    "participant",
    "device",
    "capture",
    "protocol",
    "sync",
    "environment",
    "software",
    "artifacts",
    "limitations",
)
REQUIRED_EVENTS_COLUMNS = ("onset", "duration", "trial_type", "value")
RECOMMENDED_EVENTS_COLUMNS = ("block_id", "cue_id", "repetition_index", "expected_action", "expected_signal_class")
REQUIRED_SAMPLE_CSV_COLUMNS = (
    "timestampHostNs",
    "uuid",
    "sensor",
    "channel",
    "sequence",
    "unit",
    "sampleRate",
    "sampleIndex",
    "axis",
    "value",
)


class ProtocolValidationFatal(ValueError):
    """Fatal load/parse error before a result can be emitted."""


@dataclass(slots=True)
class CaptureStats:
    lines: int = 0
    malformed_lines: int = 0
    sample_events: int = 0
    sample_timestamps: int = 0
    capture_start_present: bool = False
    capture_stop_present: bool = False
    first_timestamp_ns: int | None = None
    last_timestamp_ns: int | None = None
    sample_timestamps_ns: list[int] = field(default_factory=list)
    observed_channels: set[str] = field(default_factory=set)
    observed_streams: set[str] = field(default_factory=set)


@dataclass(slots=True)
class MarkerStats:
    lines: int = 0
    malformed_lines: int = 0
    markers: list[dict[str, Any]] = field(default_factory=list)
    session_start_count: int = 0
    terminal_count: int = 0
    block_start_count: int = 0
    block_end_count: int = 0
    unmatched_blocks: int = 0
    unknown_block_ids: int = 0
    timestamp_monotonic: bool = True
    cue_total: int = 0
    cue_complete: int = 0
    posthoc_count: int = 0
    session_mismatch_count: int = 0
    protocol_mismatch_count: int = 0
    schema_issue_count: int = 0
    unknown_block_id_values: set[str] = field(default_factory=set)
    block_intervals: dict[str, tuple[int, int]] = field(default_factory=dict)


@dataclass(slots=True)
class EventsTsvStats:
    present: bool = False
    rows: int = 0
    required_columns_present: bool = False
    invalid_rows: int = 0
    unknown_block_ids: int = 0
    marker_consistency_fraction: float | None = None
    recommended_columns_present: bool = False


@dataclass(slots=True)
class ValidationContext:
    manifest_path: Path
    manifest: dict[str, Any]
    session_dir: Path
    metrics: list[dict[str, Any]] = field(default_factory=list)
    evaluations: list[dict[str, Any]] = field(default_factory=list)
    evidence: list[dict[str, Any]] = field(default_factory=list)
    caveats: list[dict[str, Any]] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)
    status_floor: str = "pass"

    @property
    def session_id(self) -> str:
        value = self.manifest.get("sessionId")
        return value if isinstance(value, str) else ""

    @property
    def protocol_id(self) -> str:
        protocol = self.manifest.get("protocol")
        if isinstance(protocol, dict) and isinstance(protocol.get("protocolId"), str):
            return protocol["protocolId"]
        return ""

    @property
    def interpretation_boundary(self) -> str:
        value = self.manifest.get("interpretationBoundary")
        return value if isinstance(value, str) and value else "Protocol compliance validation; claim boundary missing."

    def add_metric(
        self,
        key: str,
        value: Any,
        *,
        scope: str = "session",
        unit: str | None = None,
        label: str | None = None,
        notes: str | None = None,
    ) -> None:
        metric: dict[str, Any] = {"key": key, "value": value, "scope": scope}
        if unit is not None:
            metric["unit"] = unit
        if label is not None:
            metric["label"] = label
        if notes is not None:
            metric["notes"] = notes
        self.metrics.append(metric)

    def evaluate(
        self,
        *,
        metric_key: str,
        status: str,
        severity: str,
        comparator: str,
        description: str,
        threshold: Any | None = None,
        observed: Any | None = None,
        policy_id: str | None = None,
    ) -> None:
        evaluation: dict[str, Any] = {
            "metricKey": metric_key,
            "comparator": comparator,
            "status": status,
            "severity": severity,
            "description": description,
        }
        if threshold is not None:
            evaluation["threshold"] = threshold
        if observed is not None:
            evaluation["observed"] = observed
        if policy_id is not None:
            evaluation["policyId"] = policy_id
        self.evaluations.append(evaluation)
        self.status_floor = combine_status(self.status_floor, status)

    def add_caveat(self, *, severity: str, message: str, blocks_claim: bool, source: str | None = None) -> None:
        caveat: dict[str, Any] = {
            "severity": severity,
            "message": message,
            "blocksClaim": blocks_claim,
        }
        if source is not None:
            caveat["source"] = source
        self.caveats.append(caveat)
        if severity in {"fail", "critical"} and not blocks_claim:
            self.status_floor = combine_status(self.status_floor, "warn")
        elif blocks_claim:
            self.status_floor = combine_status(self.status_floor, "warn")

    def add_evidence(self, role: str, path: Path, *, media_type: str | None = None, notes: str | None = None) -> None:
        item: dict[str, Any] = {"role": role, "path": str(path)}
        if media_type is not None:
            item["mediaType"] = media_type
        if notes is not None:
            item["notes"] = notes
        self.evidence.append(item)

    def result(self) -> dict[str, Any]:
        result = {
            "type": "muse.metric_pack_result",
            "schemaVersion": "muse-metric-pack-result/v1",
            "packId": "protocol-compliance",
            "status": self.status_floor,
            "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "manifestPath": str(self.manifest_path),
            "interpretationBoundary": self.interpretation_boundary,
            "upstreamDependencies": [],
            "metrics": self.metrics,
            "thresholdEvaluations": self.evaluations,
            "evidence": self.evidence,
            "caveats": self.caveats,
            "recommendations": self.recommendations,
            "metadata": {
                "validator": "scripts/muse/validate_protocol.py",
                "validatorVersion": "v1",
            },
        }
        if self.session_id:
            result["sessionId"] = self.session_id
        return result


def combine_status(current: str, candidate: str) -> str:
    rank = {"pass": 0, "not_applicable": 0, "warn": 1, "fail": 2}
    return candidate if rank.get(candidate, 0) > rank.get(current, 0) else current


def load_manifest(path: Path) -> dict[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except json.JSONDecodeError as exc:
        raise ProtocolValidationFatal(f"{path}:{exc.lineno}: malformed JSON: {exc.msg} at column {exc.colno}") from exc
    except OSError as exc:
        raise ProtocolValidationFatal(f"{path}: {exc}") from exc
    if not isinstance(data, dict):
        raise ProtocolValidationFatal(f"{path}: expected JSON object, got {type(data).__name__}")
    return data


def resolve_manifest_path(args: argparse.Namespace) -> Path:
    if args.manifest is not None:
        return args.manifest
    if args.session_dir is not None:
        return args.session_dir / "manifest.json"
    raise ProtocolValidationFatal("provide --manifest or --session-dir")


def resolve_artifact_path(raw_path: str, *, manifest_path: Path) -> Path:
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return (manifest_path.parent / path).resolve()


def artifacts_by_role(manifest: Mapping[str, Any]) -> dict[str, list[Mapping[str, Any]]]:
    out: dict[str, list[Mapping[str, Any]]] = defaultdict(list)
    artifacts = manifest.get("artifacts")
    if not isinstance(artifacts, list):
        return out
    for artifact in artifacts:
        if isinstance(artifact, dict):
            role = str(artifact.get("role", ""))
            out[role].append(artifact)
    return out


def first_artifact_path(manifest: Mapping[str, Any], role: str, *, manifest_path: Path) -> Path | None:
    by_role = artifacts_by_role(manifest)
    artifacts = by_role.get(role) or []
    for artifact in artifacts:
        path = artifact.get("path")
        if isinstance(path, str) and path:
            return resolve_artifact_path(path, manifest_path=manifest_path)
    return None


def manifest_contract_issues(manifest: Mapping[str, Any]) -> list[str]:
    issues: list[str] = []

    def require_object(path: str, value: Any) -> Mapping[str, Any] | None:
        if not isinstance(value, dict):
            issues.append(f"{path}: expected object")
            return None
        return value

    def require_array(path: str, value: Any) -> list[Any] | None:
        if not isinstance(value, list):
            issues.append(f"{path}: expected array")
            return None
        return value

    def require_string(path: str, value: Any) -> None:
        if not isinstance(value, str) or not value.strip():
            issues.append(f"{path}: expected non-empty string")

    def require_optional_string(path: str, value: Any) -> None:
        if value is not None and not isinstance(value, str):
            issues.append(f"{path}: expected string when present")

    def require_boolean(path: str, value: Any) -> None:
        if not isinstance(value, bool):
            issues.append(f"{path}: expected boolean")

    def require_number(path: str, value: Any) -> None:
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            issues.append(f"{path}: expected number")

    def require_literal(path: str, value: Any, allowed: set[str]) -> None:
        if value not in allowed:
            issues.append(f"{path}: expected one of {sorted(allowed)}, got {value!r}")

    for key in ("schemaVersion", "sessionId", "createdAt", "taskName", "purpose", "interpretationBoundary"):
        require_string(key, manifest.get(key))

    participant = require_object("participant", manifest.get("participant"))
    if participant is not None:
        require_string("participant.participantId", participant.get("participantId"))
        require_boolean("participant.anonymized", participant.get("anonymized"))
        require_optional_string("participant.notes", participant.get("notes"))

    device = require_object("device", manifest.get("device"))
    if device is not None:
        for key in ("deviceId", "name", "address", "serviceUuid"):
            require_string(f"device.{key}", device.get(key))
        require_literal("device.model", device.get("model"), KNOWN_DEVICE_MODELS)
        require_literal("device.protocol", device.get("protocol"), KNOWN_DEVICE_PROTOCOLS)
        channels = require_array("device.channels", device.get("channels"))
        if channels is not None:
            for index, channel in enumerate(channels):
                require_string(f"device.channels[{index}]", channel)

    capture = require_object("capture", manifest.get("capture"))
    if capture is not None:
        for key in ("command", "outputPath"):
            require_string(f"capture.{key}", capture.get(key))
        for key in ("csvOutputPath", "wsUrl", "oscTarget", "preset"):
            require_optional_string(f"capture.{key}", capture.get(key))
        cadences = require_array("capture.cadences", capture.get("cadences"))
        if cadences is not None:
            for index, cadence in enumerate(cadences):
                require_literal(f"capture.cadences[{index}]", cadence, KNOWN_CADENCES)
        for key in ("includePpg", "includeAux", "eegOnly"):
            require_boolean(f"capture.{key}", capture.get(key))
        require_number("capture.keepaliveIntervalSec", capture.get("keepaliveIntervalSec"))

    protocol = require_object("protocol", manifest.get("protocol"))
    if protocol is not None:
        for key in ("protocolId", "title", "version"):
            require_string(f"protocol.{key}", protocol.get(key))
        require_optional_string("protocol.source", protocol.get("source"))
        blocks = require_array("protocol.blocks", protocol.get("blocks"))
        if blocks is not None:
            for index, block_value in enumerate(blocks):
                block = require_object(f"protocol.blocks[{index}]", block_value)
                if block is None:
                    continue
                for key in ("blockId", "label", "instructions"):
                    require_string(f"protocol.blocks[{index}].{key}", block.get(key))
                require_literal(f"protocol.blocks[{index}].kind", block.get("kind"), KNOWN_PROTOCOL_BLOCK_KINDS)
                require_number(f"protocol.blocks[{index}].durationSec", block.get("durationSec"))
                require_literal(
                    f"protocol.blocks[{index}].expectedSignalClass",
                    block.get("expectedSignalClass"),
                    KNOWN_EXPECTED_SIGNAL_CLASSES,
                )
                for key in ("preRestSec", "postRestSec", "cueIntervalSec", "repetitions"):
                    if block.get(key) is not None:
                        require_number(f"protocol.blocks[{index}].{key}", block.get(key))
                require_optional_string(f"protocol.blocks[{index}].safetyNotes", block.get("safetyNotes"))
                cues = block.get("cues")
                if cues is not None:
                    cue_array = require_array(f"protocol.blocks[{index}].cues", cues)
                    if cue_array is not None:
                        for cue_index, cue_value in enumerate(cue_array):
                            cue = require_object(f"protocol.blocks[{index}].cues[{cue_index}]", cue_value)
                            if cue is None:
                                continue
                            for key in ("cueId", "label", "eventCode"):
                                require_string(f"protocol.blocks[{index}].cues[{cue_index}].{key}", cue.get(key))
                            require_number(f"protocol.blocks[{index}].cues[{cue_index}].onsetSec", cue.get("onsetSec"))
                            for key in ("durationSec", "repetitionIndex"):
                                if cue.get(key) is not None:
                                    require_number(f"protocol.blocks[{index}].cues[{cue_index}].{key}", cue.get(key))
                            require_optional_string(f"protocol.blocks[{index}].cues[{cue_index}].expectedAction", cue.get("expectedAction"))

    sync = require_object("sync", manifest.get("sync"))
    if sync is not None:
        require_literal("sync.primaryClock", sync.get("primaryClock"), KNOWN_CLOCK_DOMAINS)
        require_string("sync.timestampHostNsMeaning", sync.get("timestampHostNsMeaning"))
        mappings = require_array("sync.mappings", sync.get("mappings"))
        if mappings is not None:
            for index, mapping_value in enumerate(mappings):
                mapping = require_object(f"sync.mappings[{index}]", mapping_value)
                if mapping is None:
                    continue
                require_literal(f"sync.mappings[{index}].sourceClock", mapping.get("sourceClock"), KNOWN_CLOCK_DOMAINS)
                require_literal(f"sync.mappings[{index}].targetClock", mapping.get("targetClock"), KNOWN_CLOCK_DOMAINS)
                require_literal(f"sync.mappings[{index}].method", mapping.get("method"), KNOWN_CLOCK_MAPPING_METHODS)
                for key in ("offsetNs", "slope", "uncertaintyNs"):
                    if mapping.get(key) is not None:
                        require_number(f"sync.mappings[{index}].{key}", mapping.get(key))
                require_optional_string(f"sync.mappings[{index}].notes", mapping.get("notes"))
        sync_limitations = require_array("sync.limitations", sync.get("limitations"))
        if sync_limitations is not None:
            for index, limitation in enumerate(sync_limitations):
                require_string(f"sync.limitations[{index}]", limitation)

    environment = require_object("environment", manifest.get("environment"))
    if environment is not None:
        if environment.get("powerLineFrequencyHz") is not None:
            require_number("environment.powerLineFrequencyHz", environment.get("powerLineFrequencyHz"))
        for key in ("locationDescription", "lightingDescription", "posture", "fitNotes", "contactNotes", "operatorNotes"):
            require_optional_string(f"environment.{key}", environment.get(key))

    software = require_object("software", manifest.get("software"))
    if software is not None:
        for key in ("tmnlVersion", "captureScriptVersion", "analyzerScriptVersion"):
            require_optional_string(f"software.{key}", software.get(key))
        dependencies = require_object("software.dependencies", software.get("dependencies"))
        if dependencies is not None:
            for key, value in dependencies.items():
                if not isinstance(key, str) or not isinstance(value, str):
                    issues.append("software.dependencies: expected string-to-string record")
                    break

    artifacts = require_array("artifacts", manifest.get("artifacts"))
    if artifacts is not None:
        for index, artifact_value in enumerate(artifacts):
            artifact = require_object(f"artifacts[{index}]", artifact_value)
            if artifact is None:
                continue
            require_literal(f"artifacts[{index}].role", artifact.get("role"), KNOWN_ARTIFACT_ROLES)
            require_string(f"artifacts[{index}].path", artifact.get("path"))
            require_string(f"artifacts[{index}].mediaType", artifact.get("mediaType"))
            require_literal(f"artifacts[{index}].clockDomain", artifact.get("clockDomain"), KNOWN_CLOCK_DOMAINS)
            require_optional_string(f"artifacts[{index}].sha256", artifact.get("sha256"))
            require_optional_string(f"artifacts[{index}].notes", artifact.get("notes"))

    require_optional_string("labelsPath", manifest.get("labelsPath"))
    limitations = require_array("limitations", manifest.get("limitations"))
    if limitations is not None:
        for index, limitation in enumerate(limitations):
            require_string(f"limitations[{index}]", limitation)
    metadata = manifest.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        issues.append("metadata: expected object when present")

    return issues


def validate_manifest_structure(ctx: ValidationContext) -> None:
    manifest = ctx.manifest
    ctx.add_evidence("manifest", ctx.manifest_path, media_type="application/json")
    ctx.add_metric("manifest.present", True)
    ctx.evaluate(
        metric_key="manifest.present",
        comparator="present",
        status="pass",
        severity="info",
        description="Manifest JSON parsed successfully.",
        policy_id="protocol.manifest.present.v1",
    )

    schema_valid = manifest.get("schemaVersion") == "muse-session-manifest/v1"
    ctx.add_metric("manifest.schemaVersion.valid", schema_valid)
    ctx.evaluate(
        metric_key="manifest.schemaVersion.valid",
        comparator="eq",
        threshold=True,
        observed=schema_valid,
        status="pass" if schema_valid else "fail",
        severity="critical" if not schema_valid else "info",
        description="Manifest schemaVersion must be muse-session-manifest/v1.",
        policy_id="protocol.manifest.schema_version.v1",
    )

    missing = [key for key in REQUIRED_TOP_LEVEL if key not in manifest]
    ctx.add_metric("manifest.requiredFields.missingCount", len(missing), unit="count")
    ctx.evaluate(
        metric_key="manifest.requiredFields.missingCount",
        comparator="eq",
        threshold=0,
        observed=len(missing),
        status="pass" if not missing else "fail",
        severity="critical" if missing else "info",
        description=f"Required manifest fields missing: {', '.join(missing) if missing else 'none'}.",
        policy_id="protocol.manifest.required_fields.v1",
    )

    contract_issues = manifest_contract_issues(manifest)
    ctx.add_metric("manifest.schemaContract.issueCount", len(contract_issues), unit="count")
    ctx.add_metric("manifest.schemaContract.valid", len(contract_issues) == 0)
    ctx.evaluate(
        metric_key="manifest.schemaContract.issueCount",
        comparator="eq",
        threshold=0,
        observed=len(contract_issues),
        status="pass" if not contract_issues else "fail",
        severity="critical" if contract_issues else "info",
        description="Manifest must satisfy the nested MuseSessionManifest contract."
        + (f" Issues: {'; '.join(contract_issues[:8])}" if contract_issues else ""),
        policy_id="protocol.manifest.schema_contract.v1",
    )

    for key in ("sessionId", "taskName", "purpose", "interpretationBoundary"):
        present = isinstance(manifest.get(key), str) and bool(str(manifest.get(key)).strip())
        ctx.add_metric(f"manifest.{key}.present", present)
        ctx.evaluate(
            metric_key=f"manifest.{key}.present",
            comparator="present",
            status="pass" if present else "fail",
            severity="critical" if not present else "info",
            description=f"Manifest {key} must be a non-empty string.",
        )

    sync = manifest.get("sync") if isinstance(manifest.get("sync"), dict) else {}
    primary_clock = sync.get("primaryClock") if isinstance(sync, dict) else None
    clock_valid = primary_clock in KNOWN_CLOCK_DOMAINS
    ctx.add_metric("manifest.sync.primaryClock.valid", clock_valid)
    ctx.evaluate(
        metric_key="manifest.sync.primaryClock.valid",
        comparator="eq",
        threshold=True,
        observed=clock_valid,
        status="pass" if clock_valid else "fail",
        severity="fail" if not clock_valid else "info",
        description="sync.primaryClock must be a recognized clock domain.",
    )

    timestamp_meaning = sync.get("timestampHostNsMeaning") if isinstance(sync, dict) else None
    timestamp_meaning_present = isinstance(timestamp_meaning, str) and bool(timestamp_meaning.strip())
    ctx.add_metric("manifest.sync.timestampHostNsMeaning.present", timestamp_meaning_present)
    ctx.evaluate(
        metric_key="manifest.sync.timestampHostNsMeaning.present",
        comparator="present",
        status="pass" if timestamp_meaning_present else "fail",
        severity="fail" if not timestamp_meaning_present else "info",
        description="sync.timestampHostNsMeaning must describe the timestamp source.",
    )

    limitations = manifest.get("limitations")
    limitation_count = len(limitations) if isinstance(limitations, list) else 0
    ctx.add_metric("manifest.limitations.count", limitation_count, unit="count")
    ctx.evaluate(
        metric_key="manifest.limitations.count",
        comparator="gt",
        threshold=0,
        observed=limitation_count,
        status="pass" if limitation_count > 0 else "warn",
        severity="warn" if limitation_count == 0 else "info",
        description="Manifest should include explicit limitations.",
    )

    if detects_no_contact(manifest):
        ctx.add_metric("claimBoundary.noContact.detected", True)
        ctx.evaluate(
            metric_key="claimBoundary.noContact.detected",
            comparator="eq",
            threshold=False,
            observed=True,
            status="warn",
            severity="critical",
            description="Manifest indicates no brain/scalp contact; physiology claims are barred.",
            policy_id="protocol.no_contact.blocks_physiology.v1",
        )
        ctx.add_caveat(
            severity="critical",
            message="Manifest indicates no brain/scalp contact; EEG, artifact, alpha, physiology, cognitive, clinical, and ML claims are barred.",
            blocks_claim=True,
            source="manifest.interpretationBoundary/environment.contactNotes",
        )
        ctx.recommendations.append("Use this session only as a no-contact transport/control baseline.")


def detects_no_contact(manifest: Mapping[str, Any]) -> bool:
    haystack: list[str] = []
    for key in ("taskName", "purpose", "interpretationBoundary"):
        value = manifest.get(key)
        if isinstance(value, str):
            haystack.append(value)
    participant = manifest.get("participant")
    if isinstance(participant, dict):
        for key in ("participantId", "notes"):
            value = participant.get(key)
            if isinstance(value, str):
                haystack.append(value)
    environment = manifest.get("environment")
    if isinstance(environment, dict):
        for key in ("fitNotes", "contactNotes", "operatorNotes", "posture"):
            value = environment.get(key)
            if isinstance(value, str):
                haystack.append(value)
    text = " ".join(haystack).lower()
    phrases = (
        "no brain",
        "no brain/scalp",
        "not connected to a brain",
        "not connected to brain",
        "not worn",
        "no-contact",
        "no contact",
        "no human subject",
        "device-only",
        "device only",
    )
    return any(phrase in text for phrase in phrases)


def validate_artifact_inventory(ctx: ValidationContext) -> None:
    artifacts = ctx.manifest.get("artifacts")
    if not isinstance(artifacts, list):
        ctx.add_metric("artifacts.count", 0, unit="count")
        ctx.evaluate(
            metric_key="artifacts.count",
            comparator="gt",
            threshold=0,
            observed=0,
            status="fail",
            severity="critical",
            description="manifest.artifacts must be a non-empty array.",
            policy_id="protocol.artifacts.required_present.v1",
        )
        return

    ctx.add_metric("artifacts.count", len(artifacts), unit="count")
    missing_paths = 0
    unknown_roles = 0
    missing_media = 0
    invalid_clock = 0
    roles_present: Counter[str] = Counter()

    for artifact in artifacts:
        if not isinstance(artifact, dict):
            missing_paths += 1
            continue
        role = str(artifact.get("role", ""))
        roles_present[role] += 1
        if role not in KNOWN_ARTIFACT_ROLES:
            unknown_roles += 1
        if not artifact.get("mediaType"):
            missing_media += 1
        if artifact.get("clockDomain") not in KNOWN_CLOCK_DOMAINS:
            invalid_clock += 1
        path_value = artifact.get("path")
        if not isinstance(path_value, str) or not path_value:
            missing_paths += 1
            continue
        path = resolve_artifact_path(path_value, manifest_path=ctx.manifest_path)
        if not path.exists():
            missing_paths += 1
        else:
            evidence_role = artifact_role_to_evidence_role(role)
            ctx.add_evidence(evidence_role, path, media_type=str(artifact.get("mediaType") or ""), notes=str(artifact.get("notes") or ""))

    for role, count in sorted(roles_present.items()):
        ctx.add_metric(f"artifacts.role.{role or 'missing'}.present", count > 0)

    ctx.add_metric("artifacts.missing.count", missing_paths, unit="count")
    ctx.add_metric("artifacts.unknownRole.count", unknown_roles, unit="count")
    ctx.add_metric("artifacts.missingMediaType.count", missing_media, unit="count")
    ctx.add_metric("artifacts.invalidClockDomain.count", invalid_clock, unit="count")

    for metric_key, observed, description in (
        ("artifacts.missing.count", missing_paths, "All declared artifact paths should exist."),
        ("artifacts.unknownRole.count", unknown_roles, "All artifact roles should be recognized."),
        ("artifacts.invalidClockDomain.count", invalid_clock, "All artifact clock domains should be recognized."),
    ):
        ctx.evaluate(
            metric_key=metric_key,
            comparator="eq",
            threshold=0,
            observed=observed,
            status="pass" if observed == 0 else "fail",
            severity="critical" if observed else "info",
            description=description,
            policy_id="protocol.artifacts.required_present.v1" if metric_key == "artifacts.missing.count" else None,
        )

    if missing_media:
        ctx.evaluate(
            metric_key="artifacts.missingMediaType.count",
            comparator="eq",
            threshold=0,
            observed=missing_media,
            status="warn",
            severity="warn",
            description="Declared artifacts should include mediaType for downstream tooling.",
        )

    required_roles = ("session_manifest", "muse_jsonl")
    for role in required_roles:
        present = roles_present[role] > 0
        ctx.add_metric(f"artifacts.required.{role}.present", present)
        ctx.evaluate(
            metric_key=f"artifacts.required.{role}.present",
            comparator="eq",
            threshold=True,
            observed=present,
            status="pass" if present else "fail",
            severity="critical" if not present else "info",
            description=f"Required artifact role {role} must be present.",
            policy_id="protocol.artifacts.required_present.v1",
        )

    if should_require_markers(ctx.manifest):
        for role in ("markers_jsonl",):
            present = roles_present[role] > 0
            ctx.add_metric(f"artifacts.required.{role}.present", present)
            ctx.evaluate(
                metric_key=f"artifacts.required.{role}.present",
                comparator="eq",
                threshold=True,
                observed=present,
                status="pass" if present else "fail",
                severity="critical" if not present else "info",
                description=f"Controlled/labeled sessions require {role}.",
                policy_id="protocol.markers.required_present.v1",
            )
        events_present = roles_present["events_tsv"] > 0
        ctx.add_metric("artifacts.required.events_tsv.present", events_present)
        ctx.evaluate(
            metric_key="artifacts.required.events_tsv.present",
            comparator="eq",
            threshold=True,
            observed=events_present,
            status="pass" if events_present else "fail",
            severity="critical" if not events_present else "info",
            description="events.tsv is required for controlled/labeled protocol compliance.",
            policy_id="protocol.events_tsv.valid.v1",
        )


def artifact_role_to_evidence_role(role: str) -> str:
    return {
        "session_manifest": "manifest",
        "muse_jsonl": "raw_input",
        "markers_jsonl": "markers",
        "events_tsv": "other",
        "first_order_report": "summary_json",
        "feature_table": "feature_table",
        "model_artifact": "model_artifact",
    }.get(role, "other")


def should_require_markers(manifest: Mapping[str, Any]) -> bool:
    protocol = manifest.get("protocol")
    blocks = protocol.get("blocks") if isinstance(protocol, dict) else None
    if isinstance(blocks, list):
        if len(blocks) > 1:
            return True
        for block in blocks:
            if isinstance(block, dict) and block.get("expectedSignalClass") not in (None, "transport_only", "unknown"):
                return True
    artifact_roles = set(artifacts_by_role(manifest).keys())
    return "markers_jsonl" in artifact_roles or "events_tsv" in artifact_roles


def validate_capture(ctx: ValidationContext) -> CaptureStats:
    capture_path = first_artifact_path(ctx.manifest, "muse_jsonl", manifest_path=ctx.manifest_path)
    stats = CaptureStats()
    if capture_path is None:
        ctx.add_metric("capture.present", False)
        ctx.evaluate(
            metric_key="capture.present",
            comparator="present",
            status="fail",
            severity="critical",
            description="No muse_jsonl artifact declared.",
            policy_id="protocol.capture.present.v1",
        )
        return stats
    if not capture_path.exists():
        ctx.add_metric("capture.present", False)
        ctx.evaluate(
            metric_key="capture.present",
            comparator="present",
            status="fail",
            severity="critical",
            description=f"Muse capture artifact does not exist: {capture_path}",
            policy_id="protocol.capture.present.v1",
        )
        return stats

    ctx.add_metric("capture.present", True)
    try:
        with capture_path.open("r", encoding="utf-8") as file:
            for line_number, raw_line in enumerate(file, start=1):
                stats.lines += 1
                line = raw_line.strip()
                if not line:
                    continue
                try:
                    event = json.loads(line)
                except json.JSONDecodeError:
                    stats.malformed_lines += 1
                    continue
                if not isinstance(event, dict):
                    stats.malformed_lines += 1
                    continue
                event_type = event.get("type")
                ts = event.get("timestampHostNs")
                if isinstance(ts, int):
                    stats.first_timestamp_ns = ts if stats.first_timestamp_ns is None else min(stats.first_timestamp_ns, ts)
                    stats.last_timestamp_ns = ts if stats.last_timestamp_ns is None else max(stats.last_timestamp_ns, ts)
                if event_type == "muse.capture_start":
                    stats.capture_start_present = True
                elif event_type == "muse.capture_stop":
                    stats.capture_stop_present = True
                elif event_type == "muse.samples":
                    stats.sample_events += 1
                    sensor = str(event.get("sensor", "unknown"))
                    channel = str(event.get("channel", sensor))
                    stats.observed_channels.add(channel)
                    stats.observed_streams.add(f"{sensor}:{channel}")
                    if isinstance(ts, int):
                        stats.sample_timestamps += 1
                        stats.sample_timestamps_ns.append(ts)
    except OSError as exc:
        ctx.add_caveat(severity="critical", message=f"Could not read capture artifact: {exc}", blocks_claim=True, source=str(capture_path))
        ctx.status_floor = "fail"

    timestamp_fraction = stats.sample_timestamps / stats.sample_events if stats.sample_events else 0.0
    ctx.add_metric("capture.lines.count", stats.lines, unit="count")
    ctx.add_metric("capture.malformedLines.count", stats.malformed_lines, unit="count")
    ctx.add_metric("capture.sampleEvents.count", stats.sample_events, unit="count")
    ctx.add_metric("capture.start.present", stats.capture_start_present)
    ctx.add_metric("capture.stop.present", stats.capture_stop_present)
    ctx.add_metric("capture.timestampHostNs.presentFraction", timestamp_fraction)
    ctx.add_metric("capture.observedChannels.count", len(stats.observed_channels), unit="count")
    ctx.add_metric("capture.observedStreams.count", len(stats.observed_streams), unit="count")
    if stats.observed_channels:
        ctx.add_metric("capture.observedChannels", sorted(stats.observed_channels), unit="labels")
    if stats.observed_streams:
        ctx.add_metric("capture.observedStreams", sorted(stats.observed_streams), unit="labels")

    for key, observed, threshold, status, severity, description, policy in (
        ("capture.malformedLines.count", stats.malformed_lines, 0, "fail", "critical", "Capture JSONL should parse without malformed lines.", "protocol.capture.jsonl_valid.v1"),
        ("capture.sampleEvents.count", stats.sample_events, 0, "fail", "critical", "Captured sessions should include at least one muse.samples event.", "protocol.capture.samples_present.v1"),
    ):
        passed = observed > threshold if key == "capture.sampleEvents.count" else observed == threshold
        ctx.evaluate(
            metric_key=key,
            comparator="gt" if key == "capture.sampleEvents.count" else "eq",
            threshold=threshold,
            observed=observed,
            status="pass" if passed else status,
            severity=severity if not passed else "info",
            description=description,
            policy_id=policy,
        )

    for key, observed, description in (
        ("capture.start.present", stats.capture_start_present, "Capture artifact should include muse.capture_start."),
        ("capture.stop.present", stats.capture_stop_present, "Capture artifact should include muse.capture_stop."),
    ):
        ctx.evaluate(
            metric_key=key,
            comparator="eq",
            threshold=True,
            observed=observed,
            status="pass" if observed else "fail",
            severity="critical" if not observed else "info",
            description=description,
        )

    ctx.evaluate(
        metric_key="capture.timestampHostNs.presentFraction",
        comparator="eq",
        threshold=1,
        observed=round(timestamp_fraction, 6),
        status="pass" if timestamp_fraction == 1.0 else "fail",
        severity="critical" if timestamp_fraction != 1.0 else "info",
        description="All sample events should carry timestampHostNs.",
    )
    return stats


def validate_channel_metadata_export(ctx: ValidationContext, capture: CaptureStats) -> None:
    device = ctx.manifest.get("device") if isinstance(ctx.manifest.get("device"), dict) else {}
    manifest_channels_raw = device.get("channels") if isinstance(device, dict) else []
    manifest_channels = [str(channel) for channel in manifest_channels_raw] if isinstance(manifest_channels_raw, list) else []
    manifest_lookup = {channel.lower(): channel for channel in manifest_channels}
    observed_lookup = {channel.lower(): channel for channel in capture.observed_channels}
    missing_from_manifest = sorted(observed_lookup[key] for key in observed_lookup.keys() - manifest_lookup.keys())
    declared_not_observed = sorted(manifest_lookup[key] for key in manifest_lookup.keys() - observed_lookup.keys())

    ctx.add_metric("channels.manifest.count", len(manifest_channels), unit="count")
    ctx.add_metric("channels.observed.count", len(capture.observed_channels), unit="count")
    ctx.add_metric("channels.missingFromManifest.count", len(missing_from_manifest), unit="count")
    ctx.add_metric("channels.declaredNotObserved.count", len(declared_not_observed), unit="count")
    if manifest_channels:
        ctx.add_metric("channels.manifest.labels", manifest_channels, unit="labels")
    if missing_from_manifest:
        ctx.add_metric("channels.missingFromManifest.labels", missing_from_manifest, unit="labels")
    if declared_not_observed:
        ctx.add_metric("channels.declaredNotObserved.labels", declared_not_observed, unit="labels")

    ctx.evaluate(
        metric_key="channels.manifest.count",
        comparator="gt",
        threshold=0,
        observed=len(manifest_channels),
        status="pass" if manifest_channels else "fail",
        severity="critical" if not manifest_channels else "info",
        description="Manifest device.channels must declare channel metadata for export.",
        policy_id="protocol.channels.manifest_present.v1",
    )
    ctx.evaluate(
        metric_key="channels.missingFromManifest.count",
        comparator="eq",
        threshold=0,
        observed=len(missing_from_manifest),
        status="pass" if not missing_from_manifest else "fail",
        severity="critical" if missing_from_manifest else "info",
        description="Every observed Muse sample channel should be declared in manifest device.channels.",
        policy_id="protocol.channels.observed_declared.v1",
    )
    if declared_not_observed:
        ctx.evaluate(
            metric_key="channels.declaredNotObserved.count",
            comparator="eq",
            threshold=0,
            observed=len(declared_not_observed),
            status="warn",
            severity="warn",
            description="Some manifest-declared channels were not observed in this capture; confirm capture preset and hardware mode.",
            policy_id="protocol.channels.declared_observed.v1",
        )

    csv_path = first_artifact_path(ctx.manifest, "muse_samples_csv", manifest_path=ctx.manifest_path)
    if csv_path is None:
        ctx.add_metric("sampleCsv.present", False)
        ctx.evaluate(
            metric_key="sampleCsv.present",
            comparator="present",
            status="warn",
            severity="warn",
            description="Decoded sample CSV is absent; NDJSON remains canonical but tabular channel export is incomplete.",
            policy_id="protocol.channels.sample_csv_export.v1",
        )
        return
    if not csv_path.exists():
        ctx.add_metric("sampleCsv.present", False)
        ctx.evaluate(
            metric_key="sampleCsv.present",
            comparator="present",
            status="warn",
            severity="warn",
            description=f"Decoded sample CSV artifact is declared but missing: {csv_path}",
            policy_id="protocol.channels.sample_csv_export.v1",
        )
        return

    row_count = 0
    header_present = False
    invalid_channel_rows = 0
    try:
        with csv_path.open("r", encoding="utf-8", newline="") as file:
            reader = csv.DictReader(file)
            fieldnames = reader.fieldnames or []
            header_present = all(column in fieldnames for column in REQUIRED_SAMPLE_CSV_COLUMNS)
            for row in reader:
                row_count += 1
                channel = str(row.get("channel", ""))
                if channel and channel.lower() not in manifest_lookup:
                    invalid_channel_rows += 1
    except OSError as exc:
        ctx.add_caveat(severity="warn", message=f"Could not read decoded sample CSV: {exc}", blocks_claim=False, source=str(csv_path))

    ctx.add_metric("sampleCsv.present", True)
    ctx.add_metric("sampleCsv.rows.count", row_count, unit="count")
    ctx.add_metric("sampleCsv.requiredColumns.present", header_present)
    ctx.add_metric("sampleCsv.channelRowsUndeclared.count", invalid_channel_rows, unit="count")
    ctx.evaluate(
        metric_key="sampleCsv.requiredColumns.present",
        comparator="eq",
        threshold=True,
        observed=header_present,
        status="pass" if header_present else "warn",
        severity="warn" if not header_present else "info",
        description="Decoded sample CSV should include the canonical sample export columns.",
        policy_id="protocol.channels.sample_csv_export.v1",
    )
    ctx.evaluate(
        metric_key="sampleCsv.channelRowsUndeclared.count",
        comparator="eq",
        threshold=0,
        observed=invalid_channel_rows,
        status="pass" if invalid_channel_rows == 0 else "fail",
        severity="critical" if invalid_channel_rows else "info",
        description="CSV sample rows should not contain channels absent from manifest device.channels.",
        policy_id="protocol.channels.sample_csv_export.v1",
    )


def marker_event_contract_issues(event: Mapping[str, Any], *, source: str) -> list[str]:
    issues: list[str] = []

    def require_string(path: str, value: Any) -> None:
        if not isinstance(value, str) or not value.strip():
            issues.append(f"{source}.{path}: expected non-empty string")

    def require_optional_string(path: str, value: Any) -> None:
        if value is not None and not isinstance(value, str):
            issues.append(f"{source}.{path}: expected string when present")

    def require_number(path: str, value: Any) -> None:
        if not isinstance(value, (int, float)) or isinstance(value, bool):
            issues.append(f"{source}.{path}: expected number")

    def require_literal(path: str, value: Any, allowed: set[str]) -> None:
        if value not in allowed:
            issues.append(f"{source}.{path}: expected one of {sorted(allowed)}, got {value!r}")

    require_literal("type", event.get("type"), {"muse.marker"})
    require_literal("cadence", event.get("cadence"), {"marker"})
    require_number("timestampHostNs", event.get("timestampHostNs"))
    require_optional_string("timestampWallIso", event.get("timestampWallIso"))
    require_string("sessionId", event.get("sessionId"))
    require_string("protocolId", event.get("protocolId"))
    require_literal("markerKind", event.get("markerKind"), KNOWN_MARKER_KINDS)
    require_string("eventCode", event.get("eventCode"))
    require_string("label", event.get("label"))
    require_literal("clockDomain", event.get("clockDomain"), KNOWN_CLOCK_DOMAINS)
    require_literal("source", event.get("source"), KNOWN_MARKER_SOURCES)
    require_optional_string("blockId", event.get("blockId"))
    require_optional_string("cueId", event.get("cueId"))
    if event.get("repetitionIndex") is not None:
        require_number("repetitionIndex", event.get("repetitionIndex"))
    require_optional_string("expectedAction", event.get("expectedAction"))
    if event.get("expectedSignalClass") is not None:
        require_literal("expectedSignalClass", event.get("expectedSignalClass"), KNOWN_EXPECTED_SIGNAL_CLASSES)
    metadata = event.get("metadata")
    if metadata is not None and not isinstance(metadata, dict):
        issues.append(f"{source}.metadata: expected object when present")
    return issues


def validate_markers(ctx: ValidationContext, capture: CaptureStats) -> MarkerStats:
    marker_path = first_artifact_path(ctx.manifest, "markers_jsonl", manifest_path=ctx.manifest_path)
    stats = MarkerStats()
    if marker_path is None:
        required = should_require_markers(ctx.manifest)
        ctx.add_metric("markers.present", False)
        ctx.evaluate(
            metric_key="markers.present",
            comparator="present",
            status="fail" if required else "warn",
            severity="critical" if required else "warn",
            description="markers_jsonl artifact is required for labeled/controlled protocol compliance." if required else "No marker stream present; only unlabeled transport checks are possible.",
            policy_id="protocol.markers.required_present.v1",
        )
        return stats
    if not marker_path.exists():
        ctx.add_metric("markers.present", False)
        ctx.evaluate(
            metric_key="markers.present",
            comparator="present",
            status="fail",
            severity="critical",
            description=f"Marker artifact does not exist: {marker_path}",
            policy_id="protocol.markers.required_present.v1",
        )
        return stats

    ctx.add_metric("markers.present", True)
    known_block_ids = protocol_block_ids(ctx.manifest)
    previous_ts: int | None = None
    block_starts: dict[str, list[dict[str, Any]]] = defaultdict(list)
    block_ends: dict[str, list[dict[str, Any]]] = defaultdict(list)
    cue_indexes: dict[str, list[int]] = defaultdict(list)

    with marker_path.open("r", encoding="utf-8") as file:
        for line_number, raw_line in enumerate(file, start=1):
            stats.lines += 1
            line = raw_line.strip()
            if not line:
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                stats.malformed_lines += 1
                continue
            if not isinstance(event, dict) or event.get("type") != "muse.marker":
                stats.malformed_lines += 1
                continue
            contract_issues = marker_event_contract_issues(event, source=f"{marker_path}:{line_number}")
            stats.schema_issue_count += len(contract_issues)
            stats.markers.append(event)
            if event.get("sessionId") != ctx.session_id:
                stats.session_mismatch_count += 1
            if event.get("protocolId") != ctx.protocol_id:
                stats.protocol_mismatch_count += 1
            ts = event.get("timestampHostNs")
            if isinstance(ts, int):
                if previous_ts is not None and ts < previous_ts:
                    stats.timestamp_monotonic = False
                previous_ts = ts
            else:
                stats.timestamp_monotonic = False
            kind = event.get("markerKind")
            if kind == "session_start":
                stats.session_start_count += 1
            elif kind in ("session_end", "abort"):
                stats.terminal_count += 1
            elif kind == "block_start":
                stats.block_start_count += 1
                block_id = str(event.get("blockId", ""))
                block_starts[block_id].append(event)
            elif kind == "block_end":
                stats.block_end_count += 1
                block_id = str(event.get("blockId", ""))
                block_ends[block_id].append(event)
            elif kind in ("cue_onset", "cue_offset"):
                if kind == "cue_onset":
                    stats.cue_total += 1
                    if event.get("blockId") and event.get("cueId") and isinstance(event.get("repetitionIndex"), int):
                        stats.cue_complete += 1
                        cue_indexes[str(event.get("blockId"))].append(int(event["repetitionIndex"]))
            metadata = event.get("metadata")
            if isinstance(metadata, dict) and metadata.get("postHoc") is True:
                stats.posthoc_count += 1
            block_id = event.get("blockId")
            if isinstance(block_id, str) and block_id and block_id not in known_block_ids:
                stats.unknown_block_ids += 1
                stats.unknown_block_id_values.add(block_id)

    for block_id, starts in block_starts.items():
        ends = block_ends.get(block_id, [])
        if len(starts) != len(ends):
            stats.unmatched_blocks += abs(len(starts) - len(ends))
        for start, end in zip(starts, ends):
            start_ts = start.get("timestampHostNs")
            end_ts = end.get("timestampHostNs")
            if isinstance(start_ts, int) and isinstance(end_ts, int) and end_ts >= start_ts:
                stats.block_intervals[block_id] = (start_ts, end_ts)

    cue_complete_fraction = stats.cue_complete / stats.cue_total if stats.cue_total else 1.0
    ctx.add_metric("markers.count", len(stats.markers), unit="count")
    ctx.add_metric("markers.malformedLines.count", stats.malformed_lines, unit="count")
    ctx.add_metric("markers.sessionStart.count", stats.session_start_count, unit="count")
    ctx.add_metric("markers.terminal.count", stats.terminal_count, unit="count")
    ctx.add_metric("markers.blockStarts.count", stats.block_start_count, unit="count")
    ctx.add_metric("markers.blockEnds.count", stats.block_end_count, unit="count")
    ctx.add_metric("markers.unmatchedBlocks.count", stats.unmatched_blocks, unit="count")
    ctx.add_metric("markers.unknownBlockIds.count", stats.unknown_block_ids, unit="count")
    ctx.add_metric("markers.timestampMonotonic", stats.timestamp_monotonic)
    ctx.add_metric("markers.cueCompleteness.fraction", cue_complete_fraction)
    ctx.add_metric("markers.postHoc.count", stats.posthoc_count, unit="count")
    ctx.add_metric("markers.sessionMismatch.count", stats.session_mismatch_count, unit="count")
    ctx.add_metric("markers.protocolMismatch.count", stats.protocol_mismatch_count, unit="count")
    ctx.add_metric("markers.schemaContract.issueCount", stats.schema_issue_count, unit="count")

    marker_evaluations = (
        ("markers.schemaContract.issueCount", stats.schema_issue_count, 0, "eq", "Marker events should satisfy the MuseMarkerEvent contract."),
        ("markers.malformedLines.count", stats.malformed_lines, 0, "eq", "Marker JSONL should contain only valid muse.marker objects."),
        ("markers.sessionStart.count", stats.session_start_count, 1, "eq", "Marker stream should contain exactly one session_start."),
        ("markers.terminal.count", stats.terminal_count, 1, "eq", "Marker stream should contain exactly one terminal session_end or abort."),
        ("markers.unmatchedBlocks.count", stats.unmatched_blocks, 0, "eq", "Every block_start should have a matching block_end."),
        ("markers.unknownBlockIds.count", stats.unknown_block_ids, 0, "eq", "All marker block IDs should exist in the manifest protocol."),
        ("markers.sessionMismatch.count", stats.session_mismatch_count, 0, "eq", "All markers should match manifest sessionId."),
        ("markers.protocolMismatch.count", stats.protocol_mismatch_count, 0, "eq", "All markers should match manifest protocolId."),
    )
    for key, observed, threshold, comparator, description in marker_evaluations:
        passed = observed == threshold
        ctx.evaluate(
            metric_key=key,
            comparator=comparator,
            threshold=threshold,
            observed=observed,
            status="pass" if passed else "fail",
            severity="critical" if not passed else "info",
            description=description,
            policy_id="protocol.markers.schema_contract.v1" if key == "markers.schemaContract.issueCount" else "protocol.markers.match_manifest.v1" if "Mismatch" in key else "protocol.blocks.paired.v1" if "Blocks" in key else None,
        )

    ctx.evaluate(
        metric_key="markers.timestampMonotonic",
        comparator="eq",
        threshold=True,
        observed=stats.timestamp_monotonic,
        status="pass" if stats.timestamp_monotonic else "fail",
        severity="critical" if not stats.timestamp_monotonic else "info",
        description="Marker timestamps should be monotonic.",
    )
    ctx.evaluate(
        metric_key="markers.cueCompleteness.fraction",
        comparator="eq",
        threshold=1,
        observed=round(cue_complete_fraction, 6),
        status="pass" if cue_complete_fraction == 1.0 else "fail",
        severity="fail" if cue_complete_fraction != 1.0 else "info",
        description="Cue onset markers should include blockId, cueId, and repetitionIndex.",
    )
    if stats.posthoc_count:
        ctx.evaluate(
            metric_key="markers.postHoc.count",
            comparator="eq",
            threshold=0,
            observed=stats.posthoc_count,
            status="warn",
            severity="warn",
            description="Post-hoc markers are disclosed; live-conductor timing claims are barred.",
            policy_id="protocol.posthoc_markers.disclose.v1",
        )
        ctx.add_caveat(
            severity="warn",
            message="Marker stream includes post-hoc markers; use for audit/segmentation only, not live cue timing claims.",
            blocks_claim=True,
            source=str(marker_path),
        )
    validate_block_coverage(ctx, stats, capture)
    validate_cue_monotonicity(ctx, cue_indexes)
    return stats


def protocol_block_ids(manifest: Mapping[str, Any]) -> set[str]:
    protocol = manifest.get("protocol")
    blocks = protocol.get("blocks") if isinstance(protocol, dict) else None
    if not isinstance(blocks, list):
        return set()
    return {str(block.get("blockId")) for block in blocks if isinstance(block, dict) and block.get("blockId")}


def protocol_blocks(manifest: Mapping[str, Any]) -> list[Mapping[str, Any]]:
    protocol = manifest.get("protocol")
    blocks = protocol.get("blocks") if isinstance(protocol, dict) else None
    return [block for block in blocks if isinstance(block, dict)] if isinstance(blocks, list) else []


def validate_block_coverage(ctx: ValidationContext, markers: MarkerStats, capture: CaptureStats) -> None:
    expected_blocks = protocol_blocks(ctx.manifest)
    expected_block_ids = {str(block.get("blockId")) for block in expected_blocks if block.get("blockId")}
    covered = set(markers.block_intervals.keys()) & expected_block_ids
    sample_covered = 0
    duration_mismatches = 0
    tolerance_sec = 2.0

    for block in expected_blocks:
        block_id = str(block.get("blockId"))
        interval = markers.block_intervals.get(block_id)
        if interval is None:
            continue
        start_ns, end_ns = interval
        has_samples = any(start_ns <= ts < end_ns for ts in capture.sample_timestamps_ns)
        if has_samples:
            sample_covered += 1
        expected_duration = block.get("durationSec")
        if isinstance(expected_duration, (int, float)):
            observed_duration = (end_ns - start_ns) / NANOSECONDS_PER_SECOND
            if abs(observed_duration - float(expected_duration)) > tolerance_sec:
                duration_mismatches += 1

    ctx.add_metric("blocks.expected.count", len(expected_block_ids), unit="count")
    ctx.add_metric("blocks.covered.count", len(covered), unit="count")
    ctx.add_metric("blocks.sampleCoverage.count", sample_covered, unit="count")
    ctx.add_metric("blocks.durationMismatch.count", duration_mismatches, unit="count")

    ctx.evaluate(
        metric_key="blocks.covered.count",
        comparator="eq",
        threshold=len(expected_block_ids),
        observed=len(covered),
        status="pass" if len(covered) == len(expected_block_ids) else "fail",
        severity="critical" if len(covered) != len(expected_block_ids) else "info",
        description="Every manifest protocol block should have marker coverage.",
        policy_id="protocol.blocks.covered.v1",
    )
    ctx.evaluate(
        metric_key="blocks.sampleCoverage.count",
        comparator="eq",
        threshold=len(covered),
        observed=sample_covered,
        status="pass" if sample_covered == len(covered) else "fail",
        severity="critical" if sample_covered != len(covered) else "info",
        description="Every covered block should contain at least one sample timestamp.",
    )
    if duration_mismatches:
        ctx.evaluate(
            metric_key="blocks.durationMismatch.count",
            comparator="eq",
            threshold=0,
            observed=duration_mismatches,
            status="warn",
            severity="warn",
            description="Some block intervals differ from manifest duration by more than tolerance.",
        )


def validate_cue_monotonicity(ctx: ValidationContext, cue_indexes: Mapping[str, Sequence[int]]) -> None:
    bad_blocks = 0
    for indexes in cue_indexes.values():
        if list(indexes) != sorted(indexes):
            bad_blocks += 1
    ctx.add_metric("markers.cueRepetitionNonMonotonicBlocks.count", bad_blocks, unit="count")
    ctx.evaluate(
        metric_key="markers.cueRepetitionNonMonotonicBlocks.count",
        comparator="eq",
        threshold=0,
        observed=bad_blocks,
        status="pass" if bad_blocks == 0 else "fail",
        severity="fail" if bad_blocks else "info",
        description="Cue repetition indexes should be monotonic within each block.",
    )


def validate_events_tsv(ctx: ValidationContext, markers: MarkerStats) -> EventsTsvStats:
    path = first_artifact_path(ctx.manifest, "events_tsv", manifest_path=ctx.manifest_path)
    stats = EventsTsvStats(present=path is not None and path.exists() if path is not None else False)
    if path is None:
        ctx.add_metric("eventsTsv.present", False)
        if should_require_markers(ctx.manifest):
            ctx.evaluate(
                metric_key="eventsTsv.present",
                comparator="present",
                status="fail",
                severity="critical",
                description="events.tsv is absent; controlled/labeled protocol compliance requires a BIDS-style event export.",
                policy_id="protocol.events_tsv.valid.v1",
            )
        return stats
    if not path.exists():
        ctx.add_metric("eventsTsv.present", False)
        ctx.evaluate(
            metric_key="eventsTsv.present",
            comparator="present",
            status="fail",
            severity="critical",
            description=f"events.tsv artifact is declared but missing: {path}",
            policy_id="protocol.events_tsv.valid.v1",
        )
        return stats

    known_blocks = protocol_block_ids(ctx.manifest)
    marker_codes = {str(marker.get("eventCode")) for marker in markers.markers if marker.get("eventCode")}
    consistent_rows = 0
    with path.open("r", encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file, delimiter="\t")
        fieldnames = reader.fieldnames or []
        stats.required_columns_present = all(column in fieldnames for column in REQUIRED_EVENTS_COLUMNS)
        stats.recommended_columns_present = all(column in fieldnames for column in RECOMMENDED_EVENTS_COLUMNS)
        for row in reader:
            stats.rows += 1
            try:
                onset = float(row.get("onset", ""))
                duration = float(row.get("duration", ""))
            except ValueError:
                stats.invalid_rows += 1
                continue
            if onset < 0 or duration < 0:
                stats.invalid_rows += 1
            block_id = row.get("block_id") or ""
            if block_id and block_id not in known_blocks:
                stats.unknown_block_ids += 1
            value = row.get("value") or ""
            if not value or value in marker_codes:
                consistent_rows += 1
    stats.marker_consistency_fraction = consistent_rows / stats.rows if stats.rows else 1.0

    ctx.add_metric("eventsTsv.present", True)
    ctx.add_metric("eventsTsv.rows.count", stats.rows, unit="count")
    ctx.add_metric("eventsTsv.requiredColumns.present", stats.required_columns_present)
    ctx.add_metric("eventsTsv.recommendedColumns.present", stats.recommended_columns_present)
    ctx.add_metric("eventsTsv.invalidRows.count", stats.invalid_rows, unit="count")
    ctx.add_metric("eventsTsv.unknownBlockIds.count", stats.unknown_block_ids, unit="count")
    ctx.add_metric("eventsTsv.markerConsistency.fraction", stats.marker_consistency_fraction)

    for key, observed, threshold, status, description in (
        ("eventsTsv.requiredColumns.present", stats.required_columns_present, True, "fail", "events.tsv must contain required BIDS-style columns."),
        ("eventsTsv.recommendedColumns.present", stats.recommended_columns_present, True, "warn", "events.tsv should include TMNL marker export columns: block_id, cue_id, repetition_index, expected_action, expected_signal_class."),
        ("eventsTsv.invalidRows.count", stats.invalid_rows, 0, "fail", "events.tsv onset/duration rows should be numeric and non-negative."),
        ("eventsTsv.unknownBlockIds.count", stats.unknown_block_ids, 0, "fail", "events.tsv block IDs should exist in manifest protocol."),
    ):
        passed = observed == threshold
        ctx.evaluate(
            metric_key=key,
            comparator="eq",
            threshold=threshold,
            observed=observed,
            status="pass" if passed else status,
            severity="critical" if (not passed and status == "fail") else "warn" if not passed else "info",
            description=description,
            policy_id="protocol.events_tsv.valid.v1",
        )
    return stats


def validate_protocol(manifest_path: Path) -> dict[str, Any]:
    manifest = load_manifest(manifest_path)
    ctx = ValidationContext(
        manifest_path=manifest_path.resolve(),
        manifest=manifest,
        session_dir=manifest_path.resolve().parent,
    )
    validate_manifest_structure(ctx)
    validate_artifact_inventory(ctx)
    capture = validate_capture(ctx)
    validate_channel_metadata_export(ctx, capture)
    markers = validate_markers(ctx, capture)
    validate_events_tsv(ctx, markers)
    if not ctx.recommendations:
        ctx.recommendations.append("Proceed only to downstream packs admitted by this protocol compliance status and caveats.")
    return ctx.result()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Validate a Muse session for protocol compliance and emit a metric-pack result.")
    parser.add_argument("--session-dir", type=Path, default=None, help="Session directory containing manifest.json.")
    parser.add_argument("--manifest", type=Path, default=None, help="Explicit manifest JSON path.")
    parser.add_argument("--output", type=Path, default=None, help="Output MuseMetricPackResult JSON path. Defaults to stdout.")
    parser.add_argument("--report", type=Path, default=None, help="Optional Markdown report path rendered from the result.")
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        manifest_path = resolve_manifest_path(args)
        result = validate_protocol(manifest_path)
        if args.output is None:
            print(json.dumps(result, indent=2, sort_keys=True))
        else:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        if args.report is not None:
            args.report.parent.mkdir(parents=True, exist_ok=True)
            args.report.write_text(render_markdown(result), encoding="utf-8")
        return 1 if result.get("status") == "fail" else 0
    except (ProtocolValidationFatal, OSError) as exc:
        print(f"muse protocol validation error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
