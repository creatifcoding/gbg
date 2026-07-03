"""Low-resolution waterfall sketch lane.

This is deliberately lossy: the goal is not demodulation fidelity, but exposing
whether a narrow invariant survives brutal reduction.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class WaterfallSketch:
    power_db: np.ndarray
    sample_rate_hz: float
    frequency_bins_hz: np.ndarray

    @property
    def bins_time(self) -> int:
        return int(self.power_db.shape[0])

    @property
    def bins_frequency(self) -> int:
        return int(self.power_db.shape[1])



def low_res_waterfall(
    iq: np.ndarray,
    *,
    sample_rate_hz: float,
    bins_time: int = 32,
    bins_frequency: int = 64,
) -> WaterfallSketch:
    """Project complex IQ into a coarse time/frequency power tile."""

    if iq.ndim != 1:
        msg = "iq must be a one-dimensional complex array"
        raise ValueError(msg)
    if bins_time <= 0 or bins_frequency <= 0:
        msg = "bins_time and bins_frequency must be positive"
        raise ValueError(msg)

    usable = (len(iq) // bins_time) * bins_time
    if usable == 0:
        msg = "not enough IQ samples for requested bins_time"
        raise ValueError(msg)

    windows = iq[:usable].reshape(bins_time, usable // bins_time)
    spectrum = np.fft.fftshift(np.fft.fft(windows, n=bins_frequency, axis=1), axes=1)
    power = np.abs(spectrum) ** 2
    power_db = 10.0 * np.log10(power + 1e-12)
    frequency_bins_hz = np.fft.fftshift(np.fft.fftfreq(bins_frequency, d=1.0 / sample_rate_hz))

    return WaterfallSketch(
        power_db=power_db.astype(np.float32),
        sample_rate_hz=sample_rate_hz,
        frequency_bins_hz=frequency_bins_hz.astype(np.float32),
    )
