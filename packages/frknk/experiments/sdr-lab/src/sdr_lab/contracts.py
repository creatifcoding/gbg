"""JSON contracts mirrored by @gbg/frknk TypeScript schemas.

These models are intentionally suggestion-shaped. The lossy sketch sidecar can
say "look here"; Quisk/Hermes-native clean DSP remains the verifier.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


class SketchKind(StrEnum):
    LOW_RES_WATERFALL = "low_res_waterfall"
    ONE_BIT_IQ = "one_bit_iq"
    QUANTIZED_IQ = "quantized_iq"
    DROPOUT_PROJECTION = "dropout_projection"
    RANDOM_PROJECTION = "random_projection"
    PATCH_SHUFFLE = "patch_shuffle"
    LEARNED_FRONTEND = "learned_frontend"


class SignalClass(StrEnum):
    UNKNOWN = "unknown"
    CARRIER = "carrier"
    CW = "cw"
    AM = "am"
    FM = "fm"
    SSB = "ssb"
    DIGITAL = "digital"
    NOISE_FLOOR_CHANGE = "noise_floor_change"


class SuggestionAction(StrEnum):
    INSPECT_WINDOW = "inspect_window"
    TUNE_CENTER = "tune_center"
    ZOOM_WATERFALL = "zoom_waterfall"
    BOOKMARK_CANDIDATE = "bookmark_candidate"
    RUN_CLEAN_VERIFIER = "run_clean_verifier"


class FrequencyRangeHz(BaseModel):
    low_hz: float = Field(alias="lowHz")
    high_hz: float = Field(alias="highHz")

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_order(self) -> FrequencyRangeHz:
        if self.high_hz < self.low_hz:
            msg = "highHz must be greater than or equal to lowHz"
            raise ValueError(msg)
        return self


class TimeRangeSeconds(BaseModel):
    start_seconds: float = Field(alias="startSeconds")
    end_seconds: float = Field(alias="endSeconds")

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def validate_order(self) -> TimeRangeSeconds:
        if self.end_seconds < self.start_seconds:
            msg = "endSeconds must be greater than or equal to startSeconds"
            raise ValueError(msg)
        return self


class SketchLaneSummary(BaseModel):
    lane_id: str = Field(alias="laneId")
    kind: SketchKind
    bins_time: int = Field(alias="binsTime")
    bins_frequency: int = Field(alias="binsFrequency")
    value_scale: Literal["linear", "log_power", "db", "binary"] = Field(alias="valueScale")
    artifact_uri: str | None = Field(default=None, alias="artifactUri")
    byte_length: int | None = Field(default=None, alias="byteLength")
    stats: dict[str, float] | None = None

    model_config = {"populate_by_name": True, "use_enum_values": True}


class SignalSketchFrame(BaseModel):
    tag: Literal["SignalSketchFrame"] = Field(default="SignalSketchFrame", alias="_tag")
    frame_id: str = Field(alias="frameId")
    source_id: str = Field(alias="sourceId")
    center_frequency_hz: float = Field(alias="centerFrequencyHz")
    sample_rate_hz: float = Field(alias="sampleRateHz")
    started_at_unix_ms: int = Field(alias="startedAtUnixMs")
    duration_seconds: float = Field(alias="durationSeconds")
    iq_sample_count: int = Field(alias="iqSampleCount")
    lanes: list[SketchLaneSummary]
    metadata: dict[str, Any] | None = None

    model_config = {"populate_by_name": True, "use_enum_values": True}


class CandidateEvidence(BaseModel):
    lane_id: str = Field(alias="laneId")
    kind: SketchKind
    score: float
    note: str | None = None

    model_config = {"populate_by_name": True, "use_enum_values": True}


class SignalCandidate(BaseModel):
    tag: Literal["SignalCandidate"] = Field(default="SignalCandidate", alias="_tag")
    candidate_id: str = Field(alias="candidateId")
    frame_id: str = Field(alias="frameId")
    source_id: str = Field(alias="sourceId")
    time_range: TimeRangeSeconds = Field(alias="timeRange")
    frequency_range_hz: FrequencyRangeHz = Field(alias="frequencyRangeHz")
    class_label: SignalClass = Field(alias="classLabel")
    confidence: float
    evidence: list[CandidateEvidence]
    verifier_status: Literal["unverified", "accepted", "rejected", "needs_more_iq"] = Field(
        alias="verifierStatus"
    )
    metadata: dict[str, Any] | None = None

    model_config = {"populate_by_name": True, "use_enum_values": True}


class QuiskSuggestion(BaseModel):
    tag: Literal["QuiskSuggestion"] = Field(default="QuiskSuggestion", alias="_tag")
    suggestion_id: str = Field(alias="suggestionId")
    candidate_id: str = Field(alias="candidateId")
    source_id: str = Field(alias="sourceId")
    action: SuggestionAction
    label: str
    rationale: str
    center_frequency_hz: float | None = Field(default=None, alias="centerFrequencyHz")
    bandwidth_hz: float | None = Field(default=None, alias="bandwidthHz")
    time_range: TimeRangeSeconds | None = Field(default=None, alias="timeRange")
    confidence: float
    requires_verification: bool = Field(alias="requiresVerification")
    metadata: dict[str, Any] | None = None

    model_config = {"populate_by_name": True, "use_enum_values": True}
