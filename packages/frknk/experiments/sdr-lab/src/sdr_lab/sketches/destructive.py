"""Destructive sketch lanes for invariant exposure.

These transforms intentionally damage IQ fidelity. The point is to ask whether a
signal property still pokes through after the damage, not to demodulate from the
sketch itself.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import cast

import numpy as np
from numpy.typing import NDArray

from .waterfall import WaterfallSketch, low_res_waterfall


@dataclass(frozen=True)
class OneBitWaterfallSketch:
    """A low-resolution waterfall computed after brutal one-bit IQ quantization."""

    quantized_iq: NDArray[np.complex64]
    waterfall: WaterfallSketch

    @property
    def power_db(self) -> NDArray[np.float32]:
        return self.waterfall.power_db

    @property
    def frequency_bins_hz(self) -> NDArray[np.float32]:
        return self.waterfall.frequency_bins_hz

    @property
    def bins_time(self) -> int:
        return self.waterfall.bins_time

    @property
    def bins_frequency(self) -> int:
        return self.waterfall.bins_frequency


def one_bit_iq(iq: NDArray[np.complexfloating]) -> NDArray[np.complex64]:
    """Quantize complex IQ to quadrant-only one-bit real/imag signs.

    Zeros are mapped to +1 so the output alphabet is stable:
    `{(+/-1 +/- j) / sqrt(2)}`. This discards amplitude completely while keeping
    a coarse phase/quadrant trace.
    """

    if iq.ndim != 1:
        msg = "iq must be a one-dimensional complex array"
        raise ValueError(msg)

    real = np.where(np.real(iq) < 0.0, -1.0, 1.0)
    imag = np.where(np.imag(iq) < 0.0, -1.0, 1.0)
    quantized = (real + 1j * imag) / np.sqrt(2.0)
    return cast(NDArray[np.complex64], np.asarray(quantized, dtype=np.complex64))


def one_bit_waterfall(
    iq: NDArray[np.complexfloating],
    *,
    sample_rate_hz: float,
    bins_time: int = 32,
    bins_frequency: int = 64,
) -> OneBitWaterfallSketch:
    """Compute a coarse waterfall after one-bit IQ quantization."""

    quantized = one_bit_iq(iq)
    sketch = low_res_waterfall(
        quantized,
        sample_rate_hz=sample_rate_hz,
        bins_time=bins_time,
        bins_frequency=bins_frequency,
    )
    return OneBitWaterfallSketch(quantized_iq=quantized, waterfall=sketch)
