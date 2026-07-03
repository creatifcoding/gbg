from pathlib import Path

import numpy as np

from sdr_lab.iq import SyntheticNeedleSpec
from sdr_lab.locator import (
    SketchLocatorConfig,
    build_synthetic_locator_artifacts,
    write_locator_artifacts,
)
from sdr_lab.sketches import one_bit_iq, one_bit_waterfall


def test_one_bit_iq_discards_amplitude_but_keeps_quadrants() -> None:
    iq = np.asarray([0.1 + 2j, -4 + 0.5j, -0.1 - 8j, 3 - 0.2j], dtype=np.complex64)

    quantized = one_bit_iq(iq)

    assert quantized.dtype == np.complex64
    assert set(np.round(np.abs(quantized), 6)) == {1.0}
    assert np.sign(np.real(quantized)).tolist() == [1.0, -1.0, -1.0, 1.0]
    assert np.sign(np.imag(quantized)).tolist() == [1.0, 1.0, -1.0, -1.0]


def test_one_bit_waterfall_has_expected_shape() -> None:
    spec = SyntheticNeedleSpec(sample_rate_hz=48_000.0, duration_seconds=0.25)
    t = np.arange(int(spec.sample_rate_hz * spec.duration_seconds)) / spec.sample_rate_hz
    iq = np.exp(2j * np.pi * spec.tone_offset_hz * t).astype(np.complex64)

    sketch = one_bit_waterfall(
        iq,
        sample_rate_hz=spec.sample_rate_hz,
        bins_time=16,
        bins_frequency=32,
    )

    assert sketch.quantized_iq.shape == iq.shape
    assert sketch.power_db.shape == (16, 32)
    assert sketch.frequency_bins_hz.shape == (32,)


def test_synthetic_locator_emits_candidate_near_tone() -> None:
    spec = SyntheticNeedleSpec(
        sample_rate_hz=48_000.0,
        duration_seconds=1.0,
        tone_offset_hz=1_200.0,
    )
    config = SketchLocatorConfig(center_frequency_hz=7_100_000.0, bins_time=32, bins_frequency=128)

    artifacts = build_synthetic_locator_artifacts(
        spec=spec,
        config=config,
        started_at_unix_ms=1_764_000_000_000,
    )

    center = (
        artifacts.candidate.frequency_range_hz.low_hz
        + artifacts.candidate.frequency_range_hz.high_hz
    ) / 2.0
    expected = config.center_frequency_hz + spec.tone_offset_hz
    assert abs(center - expected) <= spec.sample_rate_hz / config.bins_frequency
    assert artifacts.frame.lanes[0].kind == "low_res_waterfall"
    assert artifacts.frame.lanes[1].kind == "one_bit_iq"
    assert artifacts.candidate.verifier_status == "unverified"
    assert artifacts.suggestion.requires_verification is True


def test_locator_artifact_writer(tmp_path: Path) -> None:
    artifacts = build_synthetic_locator_artifacts(started_at_unix_ms=1_764_000_000_000)

    paths = write_locator_artifacts(tmp_path, artifacts)

    expected_names = {
        "frame.json",
        "candidate.json",
        "suggestion.json",
        "summary.json",
        "waterfall-power-db.npy",
        "one-bit-waterfall-power-db.npy",
        "one-bit-iq.c64",
    }
    assert {Path(path).name for path in paths.values()} == expected_names
    for path in paths.values():
        assert Path(path).exists()
