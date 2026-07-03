"""Offline lossy RF sketch locator pipeline.

This module is intentionally pure and boring: IQ in, sketch lanes out, then a
candidate/suggestion envelope that tells the clean Quisk/Hermes path where to
look. It is a scout, not a demodulator.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

import numpy as np
from numpy.typing import NDArray

from sdr_lab.contracts import (
    CandidateEvidence,
    FrequencyRangeHz,
    QuiskSuggestion,
    SignalCandidate,
    SignalClass,
    SignalSketchFrame,
    SketchKind,
    SketchLaneSummary,
    SuggestionAction,
    TimeRangeSeconds,
)
from sdr_lab.iq import SyntheticNeedleSpec, synthesize_noise_plus_tone
from sdr_lab.sketches import (
    OneBitWaterfallSketch,
    WaterfallSketch,
    low_res_waterfall,
    one_bit_waterfall,
)


@dataclass(frozen=True)
class SketchLocatorConfig:
    """Configuration for the first offline sketch locator slice."""

    center_frequency_hz: float = 7_100_000.0
    bins_time: int = 32
    bins_frequency: int = 64
    source_id: str = "synthetic/noise-plus-tone"


@dataclass(frozen=True)
class PeakDetection:
    """A coarse frequency-bin peak found in a waterfall-like sketch."""

    bin_index: int
    frequency_offset_hz: float
    score_db: float
    confidence: float


@dataclass(frozen=True)
class SketchLocatorArtifacts:
    """All products from one offline locator run."""

    iq: NDArray[np.complex64]
    waterfall: WaterfallSketch
    one_bit: OneBitWaterfallSketch
    frame: SignalSketchFrame
    candidate: SignalCandidate
    suggestion: QuiskSuggestion
    peak: PeakDetection


def detect_strongest_frequency_bin(
    power_db: NDArray[np.floating],
    frequency_bins_hz: NDArray[np.floating],
) -> PeakDetection:
    """Detect the strongest median-power frequency bin in a coarse sketch."""

    if power_db.ndim != 2:
        msg = "power_db must be a two-dimensional time/frequency array"
        raise ValueError(msg)
    if frequency_bins_hz.ndim != 1 or len(frequency_bins_hz) != power_db.shape[1]:
        msg = "frequency_bins_hz must match the frequency dimension of power_db"
        raise ValueError(msg)

    median_by_frequency = np.median(power_db, axis=0)
    baseline = float(np.median(median_by_frequency))
    peak_index = int(np.argmax(median_by_frequency))
    peak_level = float(median_by_frequency[peak_index])
    score_db = peak_level - baseline
    confidence = max(0.0, min(0.99, score_db / 24.0))
    return PeakDetection(
        bin_index=peak_index,
        frequency_offset_hz=float(frequency_bins_hz[peak_index]),
        score_db=score_db,
        confidence=confidence,
    )


def build_synthetic_locator_artifacts(
    *,
    spec: SyntheticNeedleSpec | None = None,
    config: SketchLocatorConfig | None = None,
    started_at_unix_ms: int | None = None,
) -> SketchLocatorArtifacts:
    """Run deterministic synthetic IQ through the first sketch locator pipeline."""

    spec = spec or SyntheticNeedleSpec()
    config = config or SketchLocatorConfig()
    started_at_unix_ms = started_at_unix_ms or int(time.time() * 1000)

    iq = synthesize_noise_plus_tone(spec)
    waterfall = low_res_waterfall(
        iq,
        sample_rate_hz=spec.sample_rate_hz,
        bins_time=config.bins_time,
        bins_frequency=config.bins_frequency,
    )
    one_bit = one_bit_waterfall(
        iq,
        sample_rate_hz=spec.sample_rate_hz,
        bins_time=config.bins_time,
        bins_frequency=config.bins_frequency,
    )

    peak = detect_strongest_frequency_bin(waterfall.power_db, waterfall.frequency_bins_hz)
    one_bit_peak = detect_strongest_frequency_bin(one_bit.power_db, one_bit.frequency_bins_hz)

    frame_id = f"frame-{uuid4()}"
    candidate_id = f"cand-{uuid4()}"
    candidate_center_hz = config.center_frequency_hz + peak.frequency_offset_hz
    bin_width_hz = spec.sample_rate_hz / config.bins_frequency
    confidence = max(peak.confidence, one_bit_peak.confidence * 0.85)

    frame = SignalSketchFrame(
        frameId=frame_id,
        sourceId=config.source_id,
        centerFrequencyHz=config.center_frequency_hz,
        sampleRateHz=spec.sample_rate_hz,
        startedAtUnixMs=started_at_unix_ms,
        durationSeconds=spec.duration_seconds,
        iqSampleCount=len(iq),
        lanes=[
            SketchLaneSummary(
                laneId="waterfall-32x64",
                kind=SketchKind.LOW_RES_WATERFALL,
                binsTime=waterfall.bins_time,
                binsFrequency=waterfall.bins_frequency,
                valueScale="db",
                artifactUri="waterfall-power-db.npy",
                stats={
                    "peakOffsetHz": peak.frequency_offset_hz,
                    "peakScoreDb": peak.score_db,
                },
            ),
            SketchLaneSummary(
                laneId="one-bit-waterfall-32x64",
                kind=SketchKind.ONE_BIT_IQ,
                binsTime=one_bit.bins_time,
                binsFrequency=one_bit.bins_frequency,
                valueScale="db",
                artifactUri="one-bit-waterfall-power-db.npy",
                stats={
                    "peakOffsetHz": one_bit_peak.frequency_offset_hz,
                    "peakScoreDb": one_bit_peak.score_db,
                },
            ),
        ],
        metadata={
            "toneOffsetHz": spec.tone_offset_hz,
            "snrDb": spec.snr_db,
            "seed": spec.seed,
        },
    )

    time_range = TimeRangeSeconds(startSeconds=0.0, endSeconds=spec.duration_seconds)
    candidate = SignalCandidate(
        candidateId=candidate_id,
        frameId=frame_id,
        sourceId=config.source_id,
        timeRange=time_range,
        frequencyRangeHz=FrequencyRangeHz(
            lowHz=candidate_center_hz - 0.5 * bin_width_hz,
            highHz=candidate_center_hz + 0.5 * bin_width_hz,
        ),
        classLabel=SignalClass.CARRIER,
        confidence=confidence,
        evidence=[
            CandidateEvidence(
                laneId="waterfall-32x64",
                kind=SketchKind.LOW_RES_WATERFALL,
                score=peak.confidence,
                note="strongest median-power bin survives coarse waterfall projection",
            ),
            CandidateEvidence(
                laneId="one-bit-waterfall-32x64",
                kind=SketchKind.ONE_BIT_IQ,
                score=one_bit_peak.confidence,
                note="tone remains visible after one-bit quadrant quantization",
            ),
        ],
        verifierStatus="unverified",
        metadata={"binWidthHz": bin_width_hz},
    )

    suggestion = QuiskSuggestion(
        suggestionId=f"sugg-{uuid4()}",
        candidateId=candidate_id,
        sourceId=config.source_id,
        action=SuggestionAction.RUN_CLEAN_VERIFIER,
        label=f"Inspect candidate near {candidate_center_hz / 1_000_000:.6f} MHz",
        rationale=(
            "Lossy sketch lanes exposed a narrowband invariant; "
            "clean Quisk/Hermes DSP must verify."
        ),
        centerFrequencyHz=candidate_center_hz,
        bandwidthHz=bin_width_hz,
        timeRange=time_range,
        confidence=confidence,
        requiresVerification=True,
    )

    return SketchLocatorArtifacts(
        iq=iq,
        waterfall=waterfall,
        one_bit=one_bit,
        frame=frame,
        candidate=candidate,
        suggestion=suggestion,
        peak=peak,
    )


def artifact_payload(artifacts: SketchLocatorArtifacts) -> dict[str, Any]:
    """Return the JSON-ready envelope for CLI/stdout consumers."""

    return {
        "frame": artifacts.frame.model_dump(by_alias=True),
        "candidate": artifacts.candidate.model_dump(by_alias=True),
        "suggestion": artifacts.suggestion.model_dump(by_alias=True),
    }


def write_locator_artifacts(output_dir: Path, artifacts: SketchLocatorArtifacts) -> dict[str, str]:
    """Write the locator demo artifacts to `output_dir`."""

    output_dir.mkdir(parents=True, exist_ok=True)
    paths = {
        "frame": output_dir / "frame.json",
        "candidate": output_dir / "candidate.json",
        "suggestion": output_dir / "suggestion.json",
        "summary": output_dir / "summary.json",
        "waterfallPowerDb": output_dir / "waterfall-power-db.npy",
        "oneBitWaterfallPowerDb": output_dir / "one-bit-waterfall-power-db.npy",
        "oneBitIq": output_dir / "one-bit-iq.c64",
    }

    paths["frame"].write_text(
        json.dumps(artifacts.frame.model_dump(by_alias=True), indent=2) + "\n",
        encoding="utf-8",
    )
    paths["candidate"].write_text(
        json.dumps(artifacts.candidate.model_dump(by_alias=True), indent=2) + "\n",
        encoding="utf-8",
    )
    paths["suggestion"].write_text(
        json.dumps(artifacts.suggestion.model_dump(by_alias=True), indent=2) + "\n",
        encoding="utf-8",
    )
    paths["summary"].write_text(
        json.dumps(artifact_payload(artifacts), indent=2) + "\n",
        encoding="utf-8",
    )
    np.save(paths["waterfallPowerDb"], artifacts.waterfall.power_db)
    np.save(paths["oneBitWaterfallPowerDb"], artifacts.one_bit.power_db)
    np.asarray(artifacts.one_bit.quantized_iq, dtype=np.dtype("<c8")).tofile(paths["oneBitIq"])

    return {key: str(path) for key, path in paths.items()}
