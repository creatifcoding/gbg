"""IQ corpus file protocol.

A capture is a metadata JSON sidecar plus a little-endian complex64 payload:

    <capture-id>.c64.json
    <capture-id>.c64

The format is intentionally boring. Boring formats survive contact with tools.
"""

from __future__ import annotations

import json
import time
from enum import StrEnum
from pathlib import Path
from typing import Any, Literal

import numpy as np
from numpy.typing import NDArray
from pydantic import BaseModel, Field, model_validator

from sdr_lab.contracts import FrequencyRangeHz, SignalClass, TimeRangeSeconds

IQ_DTYPE = np.dtype("<c8")


class SampleFormat(StrEnum):
    COMPLEX64_LE = "complex64-le"


class LabelSource(StrEnum):
    SYNTHETIC = "synthetic"
    MANUAL = "manual"
    IMPORTED = "imported"
    VERIFIER = "verifier"


class IQGeneratorMetadata(BaseModel):
    kind: str
    seed: int | None = None
    parameters: dict[str, Any] = Field(default_factory=dict)


class IQCaptureLabel(BaseModel):
    label_id: str = Field(alias="labelId")
    class_label: SignalClass = Field(alias="classLabel")
    time_range: TimeRangeSeconds = Field(alias="timeRange")
    frequency_range_hz: FrequencyRangeHz = Field(alias="frequencyRangeHz")
    confidence: float
    source: LabelSource
    notes: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True, "use_enum_values": True}


class IQCaptureMetadata(BaseModel):
    tag: Literal["IQCaptureMetadata"] = Field(default="IQCaptureMetadata", alias="_tag")
    capture_id: str = Field(alias="captureId")
    source_id: str = Field(alias="sourceId")
    sample_format: SampleFormat = Field(default=SampleFormat.COMPLEX64_LE, alias="sampleFormat")
    sample_rate_hz: float = Field(alias="sampleRateHz")
    center_frequency_hz: float = Field(alias="centerFrequencyHz")
    sample_count: int = Field(alias="sampleCount")
    duration_seconds: float = Field(alias="durationSeconds")
    created_at_unix_ms: int = Field(
        default_factory=lambda: int(time.time() * 1000),
        alias="createdAtUnixMs",
    )
    iq_path: str = Field(alias="iqPath")
    generator: IQGeneratorMetadata | None = None
    labels: list[IQCaptureLabel] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True, "use_enum_values": True}

    @model_validator(mode="after")
    def validate_duration(self) -> IQCaptureMetadata:
        expected = self.sample_count / self.sample_rate_hz
        if abs(expected - self.duration_seconds) > max(1e-6, expected * 1e-6):
            msg = "durationSeconds must match sampleCount / sampleRateHz"
            raise ValueError(msg)
        return self


def metadata_path_for_iq(iq_path: Path) -> Path:
    """Return the sidecar path for a `.c64` payload path."""

    return iq_path.with_suffix(iq_path.suffix + ".json")


def write_iq_capture(
    directory: Path,
    *,
    metadata: IQCaptureMetadata,
    iq: NDArray[np.complex64],
) -> tuple[Path, Path]:
    """Write an IQ payload and sidecar metadata into `directory`."""

    directory.mkdir(parents=True, exist_ok=True)
    iq_path = directory / metadata.iq_path
    sidecar_path = metadata_path_for_iq(iq_path)

    if len(iq) != metadata.sample_count:
        msg = "metadata.sampleCount does not match IQ sample length"
        raise ValueError(msg)
    if metadata.sample_format != SampleFormat.COMPLEX64_LE:
        msg = f"unsupported sample format: {metadata.sample_format}"
        raise ValueError(msg)

    np.asarray(iq, dtype=IQ_DTYPE).tofile(iq_path)
    sidecar_path.write_text(
        json.dumps(metadata.model_dump(by_alias=True), indent=2) + "\n",
        encoding="utf-8",
    )
    return iq_path, sidecar_path


def read_iq_capture(sidecar_path: Path) -> tuple[IQCaptureMetadata, NDArray[np.complex64]]:
    """Read a sidecar and its IQ payload."""

    metadata = IQCaptureMetadata.model_validate_json(sidecar_path.read_text(encoding="utf-8"))
    iq_path = sidecar_path.parent / metadata.iq_path
    iq = np.fromfile(iq_path, dtype=IQ_DTYPE)
    if len(iq) != metadata.sample_count:
        msg = "IQ payload sample count does not match sidecar metadata"
        raise ValueError(msg)
    return metadata, iq.astype(np.complex64, copy=False)
