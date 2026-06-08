#!/usr/bin/env python3
"""Streaming Muse capture artifact loader and first-order summarizer.

This script reads capture JSONL artifacts emitted by ``capture.py`` without loading
whole files into memory. It is deliberately downstream of BLE capture: malformed
artifacts are rejected with line numbers, non-sample events are counted and ignored
for sample statistics, and future manifests / labels can be attached as small
sidecar metadata.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable, Iterator, Mapping

AXES = ("x", "y", "z")


class JsonlLoadError(ValueError):
    """Raised when a JSONL artifact cannot be parsed as a stream."""

    def __init__(self, path: Path, line_number: int, message: str) -> None:
        self.path = path
        self.line_number = line_number
        super().__init__(f"{path}:{line_number}: {message}")


@dataclass(slots=True)
class OnlineStats:
    """Numerically stable streaming scalar stats."""

    count: int = 0
    mean: float = 0.0
    m2: float = 0.0
    minimum: float | None = None
    maximum: float | None = None
    non_finite: int = 0

    def push(self, value: Any) -> None:
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            self.non_finite += 1
            return
        if not math.isfinite(numeric):
            self.non_finite += 1
            return

        self.count += 1
        self.minimum = numeric if self.minimum is None else min(self.minimum, numeric)
        self.maximum = numeric if self.maximum is None else max(self.maximum, numeric)
        delta = numeric - self.mean
        self.mean += delta / self.count
        self.m2 += delta * (numeric - self.mean)

    def to_json(self, *, duration_sec: float | None = None) -> dict[str, Any]:
        variance = self.m2 / (self.count - 1) if self.count > 1 else None
        observed_hz = self.count / duration_sec if duration_sec and duration_sec > 0 else None
        return {
            "count": self.count,
            "observedHz": observed_hz,
            "min": self.minimum,
            "max": self.maximum,
            "mean": self.mean if self.count else None,
            "stddev": math.sqrt(variance) if variance is not None else None,
            "nonFinite": self.non_finite,
        }


@dataclass(slots=True)
class DeltaStats:
    """Exact timestamp-delta distribution for transport cadence diagnostics."""

    count: int = 0
    total_ns: int = 0
    minimum_ns: int | None = None
    maximum_ns: int | None = None
    deltas_ns: list[int] = field(default_factory=list)

    def push_ns(self, delta_ns: int) -> None:
        if delta_ns < 0:
            return
        self.count += 1
        self.total_ns += delta_ns
        self.minimum_ns = delta_ns if self.minimum_ns is None else min(self.minimum_ns, delta_ns)
        self.maximum_ns = delta_ns if self.maximum_ns is None else max(self.maximum_ns, delta_ns)
        self.deltas_ns.append(delta_ns)

    def percentile_ns(self, percentile: float) -> int | None:
        if not self.deltas_ns:
            return None
        ordered = sorted(self.deltas_ns)
        if len(ordered) == 1:
            return ordered[0]
        position = (len(ordered) - 1) * percentile
        lower = math.floor(position)
        upper = math.ceil(position)
        if lower == upper:
            return ordered[int(position)]
        weight = position - lower
        return round(ordered[lower] * (1.0 - weight) + ordered[upper] * weight)

    def to_json(self) -> dict[str, Any]:
        mean_ns = self.total_ns / self.count if self.count else None
        return {
            "count": self.count,
            "minSec": ns_to_sec(self.minimum_ns),
            "maxSec": ns_to_sec(self.maximum_ns),
            "meanSec": ns_to_sec(mean_ns),
            "p50Sec": ns_to_sec(self.percentile_ns(0.50)),
            "p95Sec": ns_to_sec(self.percentile_ns(0.95)),
            "p99Sec": ns_to_sec(self.percentile_ns(0.99)),
        }


@dataclass(slots=True)
class StreamStats:
    """Per sensor/channel streaming stats."""

    sensor: str
    channel: str
    event_count: int = 0
    sample_count: int = 0
    first_timestamp_ns: int | None = None
    last_timestamp_ns: int | None = None
    previous_timestamp_ns: int | None = None
    timestamp_regressions: int = 0
    inter_event_delta: DeltaStats = field(default_factory=DeltaStats)
    sample_rate_hz: float | None = None
    unit: str | None = None
    uuid: str | None = None
    first_sequence: int | None = None
    last_sequence: int | None = None
    duplicate_sequences: int = 0
    sequence_gaps: int = 0
    missing_packets_estimate: int = 0
    out_of_order_sequences: int = 0
    file_boundary_resets: int = 0
    axes: dict[str, OnlineStats] = field(default_factory=lambda: defaultdict(OnlineStats))

    def push_event(self, event: Mapping[str, Any]) -> None:
        self.event_count += 1
        self.uuid = str(event.get("uuid", self.uuid or "")) or self.uuid
        self.unit = str(event.get("unit", self.unit or "")) or self.unit
        self.sample_rate_hz = _optional_float(event.get("sampleRate"), self.sample_rate_hz)
        self._push_timestamp(event.get("timestampHostNs"))
        self._push_sequence(event.get("sequence"))
        self._push_samples(event)

    def _push_timestamp(self, value: Any) -> None:
        if not isinstance(value, int):
            return
        if self.previous_timestamp_ns is not None:
            delta_ns = value - self.previous_timestamp_ns
            if delta_ns < 0:
                self.timestamp_regressions += 1
            else:
                self.inter_event_delta.push_ns(delta_ns)
        self.previous_timestamp_ns = value
        self.first_timestamp_ns = value if self.first_timestamp_ns is None else min(self.first_timestamp_ns, value)
        self.last_timestamp_ns = value if self.last_timestamp_ns is None else max(self.last_timestamp_ns, value)

    def _push_sequence(self, value: Any) -> None:
        if not isinstance(value, int):
            return
        if self.first_sequence is None:
            self.first_sequence = value
        if self.last_sequence is not None:
            delta = (value - self.last_sequence) & 0xFFFF
            if delta == 0:
                self.duplicate_sequences += 1
            elif delta > 32768:
                self.out_of_order_sequences += 1
            elif delta != 1:
                self.sequence_gaps += 1
                self.missing_packets_estimate += max(delta - 1, 0)
        self.last_sequence = value

    def reset_sequence_boundary(self) -> None:
        if self.last_sequence is not None:
            self.file_boundary_resets += 1
        self.last_sequence = None

    def _push_samples(self, event: Mapping[str, Any]) -> None:
        samples = event.get("samples")
        if isinstance(samples, list):
            for sample in samples:
                if isinstance(sample, list):
                    for axis, value in zip(AXES, sample):
                        self.axes[axis].push(value)
                        self.sample_count += 1
                else:
                    self.axes[""].push(sample)
                    self.sample_count += 1

        values = event.get("values")
        if isinstance(values, dict):
            for key, value in values.items():
                self.axes[str(key)].push(value)
                self.sample_count += 1

    def to_json(self) -> dict[str, Any]:
        duration_sec = None
        event_rate_hz = None
        scalar_rate_hz = None
        if self.first_timestamp_ns is not None and self.last_timestamp_ns is not None:
            duration_sec = max((self.last_timestamp_ns - self.first_timestamp_ns) / 1_000_000_000, 0.0)
            if duration_sec > 0:
                event_rate_hz = self.event_count / duration_sec
                scalar_rate_hz = self.sample_count / duration_sec

        axes = {axis or "value": stats.to_json(duration_sec=duration_sec) for axis, stats in sorted(self.axes.items())}
        quality_flags = self._quality_flags(duration_sec=duration_sec, axes=axes)

        return {
            "sensor": self.sensor,
            "channel": self.channel,
            "uuid": self.uuid,
            "unit": self.unit,
            "sampleRateHzDeclared": self.sample_rate_hz,
            "events": self.event_count,
            "scalars": self.sample_count,
            "firstTimestampHostNs": self.first_timestamp_ns,
            "lastTimestampHostNs": self.last_timestamp_ns,
            "durationSec": duration_sec,
            "eventRateHzObserved": event_rate_hz,
            "scalarRateHzObserved": scalar_rate_hz,
            "interEventDeltaSec": self.inter_event_delta.to_json(),
            "timestampRegressions": self.timestamp_regressions,
            "firstSequence": self.first_sequence,
            "lastSequence": self.last_sequence,
            "duplicateSequences": self.duplicate_sequences,
            "sequenceGaps": self.sequence_gaps,
            "missingPacketsEstimate": self.missing_packets_estimate,
            "outOfOrderSequences": self.out_of_order_sequences,
            "fileBoundaryResets": self.file_boundary_resets,
            "qualityFlags": quality_flags,
            "axes": axes,
        }

    def _quality_flags(self, *, duration_sec: float | None, axes: Mapping[str, Mapping[str, Any]]) -> list[str]:
        flags: list[str] = []
        if self.first_timestamp_ns is None or self.last_timestamp_ns is None:
            flags.append("missing_timestamp_host_ns")
        elif duration_sec == 0 and self.event_count > 1:
            flags.append("zero_duration_multiple_events")
        if self.sample_count == 0:
            flags.append("no_decoded_scalars")
        if self.timestamp_regressions:
            flags.append("timestamp_regressions_detected")
        if self.sequence_gaps:
            flags.append("sequence_gaps_detected")
        if self.missing_packets_estimate:
            flags.append("missing_packets_estimated")
        if self.duplicate_sequences:
            flags.append("duplicate_sequences_detected")
        if self.out_of_order_sequences:
            flags.append("out_of_order_sequences_detected")

        for axis, stats in axes.items():
            non_finite = stats.get("nonFinite")
            if isinstance(non_finite, int) and non_finite > 0:
                flags.append(f"non_finite_values:{axis}")

            observed_hz = stats.get("observedHz")
            if self.sample_rate_hz and isinstance(observed_hz, (float, int)):
                ratio = observed_hz / self.sample_rate_hz
                if ratio < 0.8:
                    flags.append(f"observed_rate_below_declared:{axis}")
                elif ratio > 1.2:
                    flags.append(f"observed_rate_above_declared:{axis}")

            if self.sensor == "eeg":
                minimum = stats.get("min")
                maximum = stats.get("max")
                if isinstance(minimum, (float, int)) and isinstance(maximum, (float, int)) and minimum <= -999 and maximum >= 999:
                    flags.append(f"eeg_full_scale_values_present:{axis}")
        return flags


@dataclass(slots=True)
class CaptureSummary:
    """Streaming aggregate over one or more capture artifacts."""

    files: list[str] = field(default_factory=list)
    manifest_path: str | None = None
    labels_path: str | None = None
    manifest: dict[str, Any] | None = None
    labels: dict[str, Any] | list[Any] | None = None
    total_lines: int = 0
    blank_lines: int = 0
    events: int = 0
    sample_events: int = 0
    non_sample_events: int = 0
    malformed_events: int = 0
    first_event_timestamp_ns: int | None = None
    last_event_timestamp_ns: int | None = None
    previous_event_timestamp_ns: int | None = None
    event_timestamp_regressions: int = 0
    inter_event_delta: DeltaStats = field(default_factory=DeltaStats)
    first_sample_timestamp_ns: int | None = None
    last_sample_timestamp_ns: int | None = None
    previous_sample_timestamp_ns: int | None = None
    sample_timestamp_regressions: int = 0
    inter_sample_event_delta: DeltaStats = field(default_factory=DeltaStats)
    capture_start_events: int = 0
    capture_stop_events: int = 0
    capture_start_timestamp_ns: int | None = None
    capture_stop_timestamp_ns: int | None = None
    summary_events: int = 0
    previous_summary_timestamp_ns: int | None = None
    summary_timestamp_regressions: int = 0
    inter_summary_delta: DeltaStats = field(default_factory=DeltaStats)
    last_summary: dict[str, Any] | None = None
    max_queue_size_observed: int | None = None
    queue_max_declared: int | None = None
    max_decode_errors: int | None = None
    max_packets_dropped: int | None = None
    last_packets_seen: int | None = None
    last_packets_decoded: int | None = None
    last_decode_errors: int | None = None
    last_packets_dropped: int | None = None
    last_packets_per_sec: float | None = None
    last_events_per_sec: float | None = None
    by_type: Counter[str] = field(default_factory=Counter)
    by_cadence: Counter[str] = field(default_factory=Counter)
    by_sensor: Counter[str] = field(default_factory=Counter)
    by_channel: Counter[str] = field(default_factory=Counter)
    streams: dict[str, StreamStats] = field(default_factory=dict)

    def push_event(self, event: Mapping[str, Any]) -> None:
        self.events += 1
        event_type = str(event.get("type", "<missing>"))
        cadence = str(event.get("cadence", "<missing>"))
        timestamp_ns = event.get("timestampHostNs")
        self._push_event_timestamp(timestamp_ns)
        self.by_type[event_type] += 1
        self.by_cadence[cadence] += 1

        if event_type == "muse.capture_start":
            self.capture_start_events += 1
            if isinstance(timestamp_ns, int):
                self.capture_start_timestamp_ns = timestamp_ns if self.capture_start_timestamp_ns is None else min(self.capture_start_timestamp_ns, timestamp_ns)
        elif event_type == "muse.capture_stop":
            self.capture_stop_events += 1
            if isinstance(timestamp_ns, int):
                self.capture_stop_timestamp_ns = timestamp_ns if self.capture_stop_timestamp_ns is None else max(self.capture_stop_timestamp_ns, timestamp_ns)
        elif event_type == "muse.summary":
            self._push_summary_event(event, timestamp_ns)

        if event_type != "muse.samples":
            self.non_sample_events += 1
            return

        self.sample_events += 1
        self._push_sample_timestamp(timestamp_ns)
        sensor = str(event.get("sensor", "unknown"))
        channel = str(event.get("channel", sensor))
        self.by_sensor[sensor] += 1
        self.by_channel[channel] += 1
        key = f"{sensor}:{channel}"
        stream = self.streams.get(key)
        if stream is None:
            stream = StreamStats(sensor=sensor, channel=channel)
            self.streams[key] = stream
        stream.push_event(event)

    def _push_event_timestamp(self, value: Any) -> None:
        if not isinstance(value, int):
            return
        if self.previous_event_timestamp_ns is not None:
            delta_ns = value - self.previous_event_timestamp_ns
            if delta_ns < 0:
                self.event_timestamp_regressions += 1
            else:
                self.inter_event_delta.push_ns(delta_ns)
        self.previous_event_timestamp_ns = value
        self.first_event_timestamp_ns = value if self.first_event_timestamp_ns is None else min(self.first_event_timestamp_ns, value)
        self.last_event_timestamp_ns = value if self.last_event_timestamp_ns is None else max(self.last_event_timestamp_ns, value)

    def _push_sample_timestamp(self, value: Any) -> None:
        if not isinstance(value, int):
            return
        if self.previous_sample_timestamp_ns is not None:
            delta_ns = value - self.previous_sample_timestamp_ns
            if delta_ns < 0:
                self.sample_timestamp_regressions += 1
            else:
                self.inter_sample_event_delta.push_ns(delta_ns)
        self.previous_sample_timestamp_ns = value
        self.first_sample_timestamp_ns = value if self.first_sample_timestamp_ns is None else min(self.first_sample_timestamp_ns, value)
        self.last_sample_timestamp_ns = value if self.last_sample_timestamp_ns is None else max(self.last_sample_timestamp_ns, value)

    def _push_summary_event(self, event: Mapping[str, Any], timestamp_ns: Any) -> None:
        self.summary_events += 1
        if isinstance(timestamp_ns, int):
            if self.previous_summary_timestamp_ns is not None:
                delta_ns = timestamp_ns - self.previous_summary_timestamp_ns
                if delta_ns < 0:
                    self.summary_timestamp_regressions += 1
                else:
                    self.inter_summary_delta.push_ns(delta_ns)
            self.previous_summary_timestamp_ns = timestamp_ns

        self.last_summary = dict(event)
        self.max_queue_size_observed = max_optional_int(self.max_queue_size_observed, event.get("queueSize"))
        self.queue_max_declared = max_optional_int(self.queue_max_declared, event.get("queueMax"))
        self.max_decode_errors = max_optional_int(self.max_decode_errors, event.get("decodeErrors"))
        self.max_packets_dropped = max_optional_int(self.max_packets_dropped, event.get("packetsDropped"))
        self.last_packets_seen = optional_int(event.get("packetsSeen"), self.last_packets_seen)
        self.last_packets_decoded = optional_int(event.get("packetsDecoded"), self.last_packets_decoded)
        self.last_decode_errors = optional_int(event.get("decodeErrors"), self.last_decode_errors)
        self.last_packets_dropped = optional_int(event.get("packetsDropped"), self.last_packets_dropped)
        self.last_packets_per_sec = _optional_float(event.get("packetsPerSec"), self.last_packets_per_sec)
        self.last_events_per_sec = _optional_float(event.get("eventsPerSec"), self.last_events_per_sec)

    def reset_sequence_boundaries(self) -> None:
        for stream in self.streams.values():
            stream.reset_sequence_boundary()

    def to_json(self) -> dict[str, Any]:
        streams = {key: stream.to_json() for key, stream in sorted(self.streams.items())}
        flag_counts = Counter(
            flag
            for stream in streams.values()
            for flag in stream.get("qualityFlags", [])
        )
        return {
            "type": "muse.analysis.first_order_summary",
            "files": self.files,
            "manifestPath": self.manifest_path,
            "labelsPath": self.labels_path,
            "manifest": self.manifest,
            "labels": self.labels,
            "totals": {
                "lines": self.total_lines,
                "blankLines": self.blank_lines,
                "events": self.events,
                "sampleEvents": self.sample_events,
                "nonSampleEvents": self.non_sample_events,
                "malformedEvents": self.malformed_events,
            },
            "byType": dict(self.by_type),
            "byCadence": dict(self.by_cadence),
            "bySensor": dict(self.by_sensor),
            "byChannel": dict(self.by_channel),
            "qualityFlagCounts": dict(flag_counts),
            "transport": self.transport_json(),
            "streams": streams,
        }

    def transport_json(self) -> dict[str, Any]:
        event_duration_sec = duration_between(self.first_event_timestamp_ns, self.last_event_timestamp_ns)
        capture_event_duration_sec = duration_between(self.capture_start_timestamp_ns, self.capture_stop_timestamp_ns)
        sample_coverage_sec = duration_between(self.first_sample_timestamp_ns, self.last_sample_timestamp_ns)
        sample_coverage_ratio = (
            sample_coverage_sec / capture_event_duration_sec
            if sample_coverage_sec is not None and capture_event_duration_sec and capture_event_duration_sec > 0
            else None
        )
        sample_event_rate_hz = (
            self.sample_events / sample_coverage_sec
            if sample_coverage_sec and sample_coverage_sec > 0
            else None
        )
        summary_cadence_present = self.summary_events > 0
        queue_fill_fraction_max = (
            self.max_queue_size_observed / self.queue_max_declared
            if self.max_queue_size_observed is not None and self.queue_max_declared and self.queue_max_declared > 0
            else None
        )
        return {
            "firstEventTimestampHostNs": self.first_event_timestamp_ns,
            "lastEventTimestampHostNs": self.last_event_timestamp_ns,
            "eventDurationSec": event_duration_sec,
            "captureStartEvents": self.capture_start_events,
            "captureStopEvents": self.capture_stop_events,
            "captureStartTimestampHostNs": self.capture_start_timestamp_ns,
            "captureStopTimestampHostNs": self.capture_stop_timestamp_ns,
            "captureEventDurationSec": capture_event_duration_sec,
            "firstSampleTimestampHostNs": self.first_sample_timestamp_ns,
            "lastSampleTimestampHostNs": self.last_sample_timestamp_ns,
            "sampleCoverageSec": sample_coverage_sec,
            "sampleCoverageRatio": sample_coverage_ratio,
            "sampleEventRateHzObserved": sample_event_rate_hz,
            "summaryCadencePresent": summary_cadence_present,
            "summaryEvents": self.summary_events,
            "packetsSeenLast": self.last_packets_seen,
            "packetsDecodedLast": self.last_packets_decoded,
            "decodeErrorsLast": self.last_decode_errors,
            "decodeErrorsMax": self.max_decode_errors,
            "packetsDroppedLast": self.last_packets_dropped,
            "packetsDroppedMax": self.max_packets_dropped,
            "packetsPerSecLast": self.last_packets_per_sec,
            "eventsPerSecLast": self.last_events_per_sec,
            "queueSizeMaxObserved": self.max_queue_size_observed,
            "queueMaxDeclared": self.queue_max_declared,
            "queueFillFractionMax": queue_fill_fraction_max,
            "eventTimestampRegressions": self.event_timestamp_regressions,
            "sampleTimestampRegressions": self.sample_timestamp_regressions,
            "summaryTimestampRegressions": self.summary_timestamp_regressions,
            "interEventDeltaSec": self.inter_event_delta.to_json(),
            "interSampleEventDeltaSec": self.inter_sample_event_delta.to_json(),
            "interSummaryDeltaSec": self.inter_summary_delta.to_json(),
        }


def ns_to_sec(value: float | int | None) -> float | None:
    return value / 1_000_000_000 if value is not None else None


def duration_between(start_ns: int | None, end_ns: int | None) -> float | None:
    if start_ns is None or end_ns is None:
        return None
    return max((end_ns - start_ns) / 1_000_000_000, 0.0)


def optional_int(value: Any, fallback: int | None = None) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else fallback


def max_optional_int(current: int | None, value: Any) -> int | None:
    parsed = optional_int(value)
    if parsed is None:
        return current
    return parsed if current is None else max(current, parsed)


def _optional_float(value: Any, fallback: float | None) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return fallback


def iter_jsonl(path: Path, summary: CaptureSummary) -> Iterator[Mapping[str, Any]]:
    """Yield dict events from a JSONL file, rejecting malformed lines with location."""
    with path.open("r", encoding="utf-8") as file:
        for line_number, raw_line in enumerate(file, start=1):
            summary.total_lines += 1
            line = raw_line.strip()
            if not line:
                summary.blank_lines += 1
                continue
            try:
                event = json.loads(line)
            except json.JSONDecodeError as exc:
                summary.malformed_events += 1
                raise JsonlLoadError(path, line_number, f"malformed JSON: {exc.msg} at column {exc.colno}") from exc
            if not isinstance(event, dict):
                summary.malformed_events += 1
                raise JsonlLoadError(path, line_number, f"expected JSON object, got {type(event).__name__}")
            yield event


def load_sidecar(path: Path | None, *, label: str) -> dict[str, Any] | list[Any] | None:
    if path is None:
        return None
    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except json.JSONDecodeError as exc:
        raise JsonlLoadError(path, exc.lineno, f"malformed {label} JSON: {exc.msg} at column {exc.colno}") from exc
    if not isinstance(data, (dict, list)):
        raise ValueError(f"{path}: expected {label} JSON object or array, got {type(data).__name__}")
    return data


def analyze(paths: Iterable[Path], *, manifest_path: Path | None = None, labels_path: Path | None = None) -> CaptureSummary:
    summary = CaptureSummary(
        manifest_path=str(manifest_path) if manifest_path is not None else None,
        labels_path=str(labels_path) if labels_path is not None else None,
        manifest=load_sidecar(manifest_path, label="manifest"),
        labels=load_sidecar(labels_path, label="labels"),
    )
    for path in paths:
        if summary.files:
            summary.reset_sequence_boundaries()
        summary.files.append(str(path))
        for event in iter_jsonl(path, summary):
            summary.push_event(event)
    return summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Stream-load Muse capture JSONL artifacts and emit first-order summary JSON.")
    parser.add_argument("captures", nargs="+", type=Path, help="Capture JSONL artifact(s) from scripts/muse/capture.py")
    parser.add_argument("--manifest", type=Path, default=None, help="Optional future session manifest JSON sidecar.")
    parser.add_argument("--labels", type=Path, default=None, help="Optional future labels/events JSON sidecar.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON report.")
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        summary = analyze(args.captures, manifest_path=args.manifest, labels_path=args.labels)
    except (JsonlLoadError, OSError, ValueError) as exc:
        print(f"muse analysis load error: {exc}", file=sys.stderr)
        return 2

    if args.pretty:
        print(json.dumps(summary.to_json(), indent=2, sort_keys=True))
    else:
        print(json.dumps(summary.to_json(), separators=(",", ":"), sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
