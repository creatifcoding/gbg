"""FRKNK SDR lab.

Python owns the RF proving ground: IQ fixtures, Hermes/openHPSDR emulation,
lossy sketch experiments, and verifier-facing candidate generation.
"""

from .contracts import QuiskSuggestion, SignalCandidate, SignalSketchFrame

__all__ = ["QuiskSuggestion", "SignalCandidate", "SignalSketchFrame"]
