"""Synthetic IQ fixtures for the first FRKNK proving ground."""

from __future__ import annotations

from dataclasses import dataclass
from typing import cast

import numpy as np
from numpy.typing import NDArray


@dataclass(frozen=True)
class SyntheticNeedleSpec:
    """A narrowband signal hidden inside complex noise."""

    sample_rate_hz: float = 48_000.0
    duration_seconds: float = 1.0
    tone_offset_hz: float = 1_200.0
    snr_db: float = -6.0
    seed: int = 7



def synthesize_noise_plus_tone(spec: SyntheticNeedleSpec) -> NDArray[np.complex64]:
    """Return complex64 IQ: Gaussian noise plus a weak complex tone."""

    sample_count = int(spec.sample_rate_hz * spec.duration_seconds)
    rng = np.random.default_rng(spec.seed)

    noise = (
        rng.normal(0.0, 1.0, sample_count) + 1j * rng.normal(0.0, 1.0, sample_count)
    ) / np.sqrt(2.0)

    t = np.arange(sample_count, dtype=np.float64) / spec.sample_rate_hz
    tone = np.exp(2j * np.pi * spec.tone_offset_hz * t)
    amplitude = 10 ** (spec.snr_db / 20.0)

    return cast(NDArray[np.complex64], np.asarray(noise + amplitude * tone, dtype=np.complex64))
