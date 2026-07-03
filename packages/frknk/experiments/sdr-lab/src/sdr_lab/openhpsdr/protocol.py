"""Small Hermes/OpenHPSDR packet helpers for the FRKNK fake radio.

This is not yet the emulator loop. It is the byte grammar we need before the
network server starts pretending to be hardware.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Final

import numpy as np
from numpy.typing import NDArray

METIS_MAGIC: Final[bytes] = b"\xef\xfe"
DISCOVERY_REQUEST: Final[int] = 0x02
SET_IP_COMMAND: Final[int] = 0x03
START_STOP_COMMAND: Final[int] = 0x04
DATA_PACKET: Final[int] = 0x01
ENDPOINT_TX_CONTROL: Final[int] = 0x02
ENDPOINT_RX_IQ: Final[int] = 0x06
HERMES_LITE_BOARD_ID: Final[int] = 0x06
FRAME_BYTES: Final[int] = 1032
PAYLOAD_BLOCK_BYTES: Final[int] = 512
SAMPLES_PER_BLOCK_SINGLE_RX: Final[int] = 63
SAMPLES_PER_FRAME_SINGLE_RX: Final[int] = SAMPLES_PER_BLOCK_SINGLE_RX * 2
SYNC_BYTES: Final[bytes] = b"\x7f\x7f\x7f"


@dataclass(frozen=True)
class DiscoveryIdentity:
    mac: bytes = b"\x02\x00\x00\x46\x52\x4b"
    code_version: int = 1
    board_id: int = HERMES_LITE_BOARD_ID

    def __post_init__(self) -> None:
        if len(self.mac) != 6:
            msg = "Hermes discovery MAC must be exactly 6 bytes"
            raise ValueError(msg)
        if not 0 <= self.code_version <= 0xFF:
            msg = "code_version must fit in one byte"
            raise ValueError(msg)
        if not 0 <= self.board_id <= 0xFF:
            msg = "board_id must fit in one byte"
            raise ValueError(msg)


def build_discovery_response(identity: DiscoveryIdentity | None = None) -> bytes:
    """Build a discovery response sufficient for Quisk's Hermes hardware code."""

    identity = identity or DiscoveryIdentity()
    packet = bytearray(64)
    packet[0:2] = METIS_MAGIC
    packet[2] = DISCOVERY_REQUEST
    packet[3:9] = identity.mac
    packet[9] = identity.code_version
    packet[10] = identity.board_id
    return bytes(packet)


def build_start_stop(start: bool) -> bytes:
    """Build the 64-byte Metis start/stop command shape Quisk sends."""

    packet = bytearray(64)
    packet[0:2] = METIS_MAGIC
    packet[2] = START_STOP_COMMAND
    packet[3] = 0x01 if start else 0x00
    return bytes(packet)


def is_start_packet(packet: bytes) -> bool:
    return (
        len(packet) >= 4
        and packet[0:2] == METIS_MAGIC
        and packet[2] == START_STOP_COMMAND
        and (packet[3] & 0x01) == 0x01
    )


def is_stop_packet(packet: bytes) -> bool:
    return (
        len(packet) >= 4
        and packet[0:2] == METIS_MAGIC
        and packet[2] == START_STOP_COMMAND
        and (packet[3] & 0x01) == 0x00
    )


def _int24be(value: float) -> bytes:
    scaled = int(max(-1.0, min(1.0, value)) * 0x7FFFFF)
    return int(scaled & 0xFFFFFF).to_bytes(3, byteorder="big", signed=False)


def _write_payload_block(
    frame: bytearray,
    *,
    start: int,
    samples: NDArray[np.complex64],
    control_index: int,
    key_down: bool,
) -> None:
    frame[start : start + 3] = SYNC_BYTES
    frame[start + 3] = (control_index << 3) | (0x01 if key_down else 0x00)
    # C1..C4 remain zero for cycle 1.
    index = start + 8
    for sample in samples:
        # Quisk parses first 24-bit value as imaginary, second as real.
        frame[index : index + 3] = _int24be(float(np.imag(sample)))
        frame[index + 3 : index + 6] = _int24be(float(np.real(sample)))
        frame[index + 6 : index + 8] = b"\x00\x00"
        index += 8


def build_rx_iq_frame(
    sequence: int,
    samples: NDArray[np.complex64],
    *,
    first_control_index: int = 0,
    key_down: bool = False,
) -> bytes:
    """Build one endpoint-6 RX IQ frame for a single receiver.

    The input must contain exactly 126 complex64 samples: 63 for each 512-byte
    payload block. Cycle-1 emulator code can chunk arbitrary IQ streams into this
    size before calling this helper.
    """

    if len(samples) != SAMPLES_PER_FRAME_SINGLE_RX:
        msg = f"RX frame requires {SAMPLES_PER_FRAME_SINGLE_RX} samples"
        raise ValueError(msg)
    if not 0 <= first_control_index <= 4:
        msg = "first_control_index must be in the hardware-return range 0..4"
        raise ValueError(msg)

    frame = bytearray(FRAME_BYTES)
    frame[0:2] = METIS_MAGIC
    frame[2] = DATA_PACKET
    frame[3] = ENDPOINT_RX_IQ
    frame[4:8] = int(sequence & 0xFFFFFFFF).to_bytes(4, byteorder="big", signed=False)

    iq = np.asarray(samples, dtype=np.complex64)
    _write_payload_block(
        frame,
        start=8,
        samples=iq[:SAMPLES_PER_BLOCK_SINGLE_RX],
        control_index=first_control_index,
        key_down=key_down,
    )
    _write_payload_block(
        frame,
        start=520,
        samples=iq[SAMPLES_PER_BLOCK_SINGLE_RX:],
        control_index=(first_control_index + 1) % 5,
        key_down=key_down,
    )
    return bytes(frame)
