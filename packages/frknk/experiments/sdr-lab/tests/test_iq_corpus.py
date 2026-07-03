from pathlib import Path

from sdr_lab.contracts import FrequencyRangeHz, SignalClass, TimeRangeSeconds
from sdr_lab.iq import (
    IQCaptureLabel,
    IQCaptureMetadata,
    IQGeneratorMetadata,
    LabelSource,
    SyntheticNeedleSpec,
    read_iq_capture,
    synthesize_noise_plus_tone,
    write_iq_capture,
)


def test_iq_capture_round_trip(tmp_path: Path) -> None:
    spec = SyntheticNeedleSpec(sample_rate_hz=48_000.0, duration_seconds=0.1)
    iq = synthesize_noise_plus_tone(spec)
    metadata = IQCaptureMetadata(
        captureId="synthetic-cw-0001",
        sourceId="synthetic/noise-plus-tone",
        sampleRateHz=spec.sample_rate_hz,
        centerFrequencyHz=7_100_000.0,
        sampleCount=len(iq),
        durationSeconds=spec.duration_seconds,
        iqPath="synthetic-cw-0001.c64",
        generator=IQGeneratorMetadata(
            kind="synthetic.noise_plus_tone",
            seed=spec.seed,
            parameters={"toneOffsetHz": spec.tone_offset_hz, "snrDb": spec.snr_db},
        ),
        labels=[
            IQCaptureLabel(
                labelId="label-cw-0001",
                classLabel=SignalClass.CARRIER,
                timeRange=TimeRangeSeconds(startSeconds=0.0, endSeconds=spec.duration_seconds),
                frequencyRangeHz=FrequencyRangeHz(lowHz=7_100_825.0, highHz=7_101_575.0),
                confidence=1.0,
                source=LabelSource.SYNTHETIC,
            )
        ],
    )

    iq_path, sidecar_path = write_iq_capture(tmp_path, metadata=metadata, iq=iq)
    loaded_metadata, loaded_iq = read_iq_capture(sidecar_path)

    assert iq_path.name == "synthetic-cw-0001.c64"
    assert sidecar_path.name == "synthetic-cw-0001.c64.json"
    assert loaded_metadata.capture_id == metadata.capture_id
    assert loaded_metadata.labels[0].class_label == SignalClass.CARRIER
    assert loaded_iq.dtype == iq.dtype
    assert loaded_iq.shape == iq.shape
