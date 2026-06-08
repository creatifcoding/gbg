#!/usr/bin/env python3
"""Shared Markdown report writer for Muse metric-pack results.

Analyzers emit machine-readable ``muse.metric_pack_result`` JSON. This module
renders that envelope into a concise human evidence report with the same section
order for every pack. The writer is intentionally dependency-free so each pack
analyzer can import it without pulling analysis libraries into the report path.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

STATUS_LABELS = {
    "pass": "PASS",
    "warn": "WARN",
    "fail": "FAIL",
    "not_applicable": "NOT APPLICABLE",
}

STATUS_EMOJI = {
    "pass": "✅",
    "warn": "⚠️",
    "fail": "✗",
    "not_applicable": "—",
}

REQUIRED_TOP_LEVEL = (
    "type",
    "schemaVersion",
    "packId",
    "status",
    "generatedAt",
    "interpretationBoundary",
    "upstreamDependencies",
    "metrics",
    "thresholdEvaluations",
    "evidence",
    "caveats",
    "recommendations",
)


class MetricPackReportError(ValueError):
    """Raised when a metric-pack result cannot be rendered."""


def load_result(path: Path) -> Mapping[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except json.JSONDecodeError as exc:
        raise MetricPackReportError(f"{path}:{exc.lineno}: malformed JSON: {exc.msg} at column {exc.colno}") from exc
    if not isinstance(data, dict):
        raise MetricPackReportError(f"{path}: expected JSON object, got {type(data).__name__}")
    validate_result(data, source=str(path))
    return data


def validate_result(result: Mapping[str, Any], *, source: str = "result") -> None:
    missing = [key for key in REQUIRED_TOP_LEVEL if key not in result]
    if missing:
        raise MetricPackReportError(f"{source}: missing required keys: {', '.join(missing)}")
    if result.get("type") != "muse.metric_pack_result":
        raise MetricPackReportError(f"{source}: expected type muse.metric_pack_result")
    if result.get("status") not in STATUS_LABELS:
        raise MetricPackReportError(f"{source}: unknown status {result.get('status')!r}")
    for key in ("upstreamDependencies", "metrics", "thresholdEvaluations", "evidence", "caveats", "recommendations"):
        if not isinstance(result.get(key), list):
            raise MetricPackReportError(f"{source}.{key}: expected array")


def render_markdown(result: Mapping[str, Any]) -> str:
    validate_result(result)
    status = str(result["status"])
    title = str(result["packId"]).replace("-", " ").title()
    lines: list[str] = [
        f"# Muse Metric Pack Report — {title}",
        "",
        f"**Status:** {STATUS_EMOJI[status]} {STATUS_LABELS[status]}",
        f"**Pack:** `{result['packId']}`",
        f"**Schema:** `{result['schemaVersion']}`",
        f"**Generated:** `{result['generatedAt']}`",
    ]
    if result.get("sessionId"):
        lines.append(f"**Session:** `{result['sessionId']}`")
    if result.get("manifestPath"):
        lines.append(f"**Manifest:** `{result['manifestPath']}`")
    lines.extend([
        "",
        "## Interpretation Boundary",
        "",
        str(result["interpretationBoundary"]),
        "",
    ])

    lines.extend(render_dependencies(result["upstreamDependencies"]))
    lines.extend(render_metrics(result["metrics"]))
    lines.extend(render_thresholds(result["thresholdEvaluations"]))
    lines.extend(render_evidence(result["evidence"]))
    lines.extend(render_caveats(result["caveats"]))
    lines.extend(render_recommendations(result["recommendations"]))
    return "\n".join(lines).rstrip() + "\n"


def render_dependencies(dependencies: Sequence[Any]) -> list[str]:
    lines = ["## Upstream Dependencies", ""]
    if not dependencies:
        return lines + ["No upstream pack dependencies declared.", ""]
    lines.extend(["| Pack | Required | Observed | Satisfied | Notes |", "| --- | --- | --- | --- | --- |"])
    for dep in dependencies:
        if not isinstance(dep, Mapping):
            continue
        required = ", ".join(map(str, dep.get("requiredStatus", [])))
        satisfied = "yes" if dep.get("satisfied") else "no"
        lines.append(
            f"| `{dep.get('packId', '')}` | {required} | {dep.get('observedStatus', '')} | {satisfied} | {escape_table(dep.get('notes', ''))} |"
        )
    return lines + [""]


def render_metrics(metrics: Sequence[Any]) -> list[str]:
    lines = ["## Metrics", ""]
    if not metrics:
        return lines + ["No metrics emitted.", ""]
    lines.extend(["| Key | Scope | Value | Unit | Context |", "| --- | --- | ---: | --- | --- |"])
    for metric in metrics:
        if not isinstance(metric, Mapping):
            continue
        context = compact_context(metric, ("channel", "axis", "blockId", "cueId", "windowId"))
        lines.append(
            f"| `{metric.get('key', '')}` | {metric.get('scope', '')} | {format_value(metric.get('value'))} | {metric.get('unit', '')} | {escape_table(context)} |"
        )
    return lines + [""]


def render_thresholds(evaluations: Sequence[Any]) -> list[str]:
    lines = ["## Threshold Evaluations", ""]
    if not evaluations:
        return lines + ["No thresholds evaluated.", ""]
    lines.extend(["| Status | Severity | Metric | Comparator | Threshold | Observed | Description |", "| --- | --- | --- | --- | ---: | ---: | --- |"])
    for evaluation in evaluations:
        if not isinstance(evaluation, Mapping):
            continue
        status = str(evaluation.get("status", ""))
        label = f"{STATUS_EMOJI.get(status, '')} {status}"
        lines.append(
            f"| {label} | {evaluation.get('severity', '')} | `{evaluation.get('metricKey', '')}` | {evaluation.get('comparator', '')} | {format_value(evaluation.get('threshold'))} | {format_value(evaluation.get('observed'))} | {escape_table(evaluation.get('description', ''))} |"
        )
    return lines + [""]


def render_evidence(evidence: Sequence[Any]) -> list[str]:
    lines = ["## Evidence", ""]
    if not evidence:
        return lines + ["No evidence artifacts declared.", ""]
    lines.extend(["| Role | Path | Media type | Notes |", "| --- | --- | --- | --- |"])
    for item in evidence:
        if not isinstance(item, Mapping):
            continue
        lines.append(
            f"| {item.get('role', '')} | `{item.get('path', '')}` | {item.get('mediaType', '')} | {escape_table(item.get('notes', ''))} |"
        )
    return lines + [""]


def render_caveats(caveats: Sequence[Any]) -> list[str]:
    lines = ["## Caveats", ""]
    if not caveats:
        return lines + ["No caveats declared. Suspiciously brave; review anyway.", ""]
    for caveat in caveats:
        if not isinstance(caveat, Mapping):
            continue
        blocker = "blocks claim" if caveat.get("blocksClaim") else "disclosure"
        lines.append(f"- **{caveat.get('severity', 'info')} / {blocker}:** {caveat.get('message', '')}")
    return lines + [""]


def render_recommendations(recommendations: Sequence[Any]) -> list[str]:
    lines = ["## Recommendations", ""]
    if not recommendations:
        return lines + ["No recommendations emitted.", ""]
    for recommendation in recommendations:
        lines.append(f"- {recommendation}")
    return lines + [""]


def compact_context(mapping: Mapping[str, Any], keys: Iterable[str]) -> str:
    parts = [f"{key}={mapping[key]}" for key in keys if mapping.get(key) not in (None, "")]
    return ", ".join(parts)


def format_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, float):
        return f"{value:.6g}"
    if isinstance(value, (list, tuple)):
        return "[" + ", ".join(format_value(item) for item in value) + "]"
    return str(value)


def escape_table(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Render a Muse metric-pack result JSON file as Markdown.")
    parser.add_argument("input", type=Path, help="MuseMetricPackResult JSON input.")
    parser.add_argument("--output", type=Path, default=None, help="Optional Markdown output path. Defaults to stdout.")
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        result = load_result(args.input)
        markdown = render_markdown(result)
        if args.output is None:
            print(markdown, end="")
        else:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(markdown, encoding="utf-8")
    except (MetricPackReportError, OSError) as exc:
        print(f"muse metric-pack report error: {exc}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
