"""OpenHPSDR/Hermes emulator seam."""

from .emulator import (
    HermesControlState,
    HermesEmulator,
    HermesEmulatorConfig,
    HermesEmulatorStats,
    ToneIqSource,
    make_emulator,
)
from .protocol import (
    ENDPOINT_RX_IQ,
    ENDPOINT_TX_CONTROL,
    FRAME_BYTES,
    HERMES_LITE_BOARD_ID,
    SAMPLES_PER_FRAME_SINGLE_RX,
    DiscoveryIdentity,
    build_discovery_response,
    build_rx_iq_frame,
    build_start_stop,
    is_start_packet,
    is_stop_packet,
)

__all__ = [
    "ENDPOINT_RX_IQ",
    "HermesControlState",
    "HermesEmulator",
    "HermesEmulatorConfig",
    "HermesEmulatorStats",
    "ENDPOINT_TX_CONTROL",
    "FRAME_BYTES",
    "HERMES_LITE_BOARD_ID",
    "SAMPLES_PER_FRAME_SINGLE_RX",
    "DiscoveryIdentity",
    "ToneIqSource",
    "build_discovery_response",
    "build_rx_iq_frame",
    "build_start_stop",
    "is_start_packet",
    "is_stop_packet",
    "make_emulator",
]
