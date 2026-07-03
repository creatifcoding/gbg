"""Python fake Hermes-Lite/OpenHPSDR radio for Quisk.

The emulator is intentionally conservative: receive-only, one receiver, no TX RF,
and just enough Metis/Hermes protocol to let Quisk discover, start, and receive
endpoint-6 IQ frames.
"""

from __future__ import annotations

import select
import socket
import time
from dataclasses import dataclass, field

import numpy as np
from numpy.typing import NDArray

from .protocol import (
    DATA_PACKET,
    DISCOVERY_REQUEST,
    ENDPOINT_TX_CONTROL,
    FRAME_BYTES,
    METIS_MAGIC,
    SAMPLES_PER_FRAME_SINGLE_RX,
    START_STOP_COMMAND,
    DiscoveryIdentity,
    build_discovery_response,
    build_rx_iq_frame,
    is_start_packet,
    is_stop_packet,
)


@dataclass
class HermesControlState:
    """Subset of PC→Hermes control state we care about in cycle 1."""

    sample_rate_hz: int = 48_000
    receiver_count: int = 1
    rx_frequency_hz: int = 7_100_000
    tx_frequency_hz: int = 7_100_000
    lna_gain: int | None = None
    mox: bool = False
    last_sequence_from_pc: int | None = None


@dataclass(frozen=True)
class HermesEmulatorConfig:
    host: str = "0.0.0.0"
    port: int = 1024
    sample_rate_hz: int = 48_000
    center_frequency_hz: int = 7_100_000
    tone_offset_hz: float = 1_200.0
    amplitude: float = 0.2
    noise: float = 0.0
    seed: int = 7
    verbose: bool = False
    identity: DiscoveryIdentity = field(default_factory=DiscoveryIdentity)


@dataclass
class HermesEmulatorStats:
    discovery_requests: int = 0
    start_requests: int = 0
    stop_requests: int = 0
    control_packets: int = 0
    frames_sent: int = 0
    bytes_sent: int = 0


class ToneIqSource:
    """Continuous deterministic IQ source for receive-only emulator streaming."""

    def __init__(
        self,
        *,
        sample_rate_hz: int,
        tone_offset_hz: float,
        amplitude: float,
        noise: float,
        seed: int,
    ) -> None:
        self.sample_rate_hz = sample_rate_hz
        self.tone_offset_hz = tone_offset_hz
        self.amplitude = amplitude
        self.noise = noise
        self.rng = np.random.default_rng(seed)
        self.phase = 0.0

    def next(self, count: int) -> NDArray[np.complex64]:
        step = 2.0 * np.pi * self.tone_offset_hz / self.sample_rate_hz
        phases = self.phase + step * np.arange(count, dtype=np.float64)
        self.phase = float((self.phase + step * count) % (2.0 * np.pi))
        tone = self.amplitude * np.exp(1j * phases)
        if self.noise > 0:
            noise = (
                self.rng.normal(0.0, self.noise, count)
                + 1j * self.rng.normal(0.0, self.noise, count)
            ) / np.sqrt(2.0)
            tone = tone + noise
        return np.asarray(tone, dtype=np.complex64)


class HermesEmulator:
    """Stateful fake radio core plus blocking UDP server loop."""

    def __init__(self, config: HermesEmulatorConfig) -> None:
        self.config = config
        self.control = HermesControlState(
            sample_rate_hz=config.sample_rate_hz,
            rx_frequency_hz=config.center_frequency_hz,
            tx_frequency_hz=config.center_frequency_hz,
        )
        self.stats = HermesEmulatorStats()
        self.client_addr: tuple[str, int] | None = None
        self.running = False
        self.sequence = 0
        self.iq_source = ToneIqSource(
            sample_rate_hz=config.sample_rate_hz,
            tone_offset_hz=config.tone_offset_hz,
            amplitude=config.amplitude,
            noise=config.noise,
            seed=config.seed,
        )

    def handle_packet(self, packet: bytes, addr: tuple[str, int]) -> list[bytes]:
        """Handle one incoming packet and return immediate response packets."""

        if len(packet) < 3 or packet[0:2] != METIS_MAGIC:
            return []

        kind = packet[2]
        self.client_addr = addr

        if kind == DISCOVERY_REQUEST:
            self.stats.discovery_requests += 1
            self._log(f"discovery request from {addr[0]}:{addr[1]}")
            return [build_discovery_response(self.config.identity)]

        if kind == START_STOP_COMMAND:
            if is_start_packet(packet):
                self.running = True
                self.stats.start_requests += 1
                self._log(f"start stream from {addr[0]}:{addr[1]}")
            elif is_stop_packet(packet):
                self.running = False
                self.sequence = 0
                self.stats.stop_requests += 1
                self._log(f"stop stream from {addr[0]}:{addr[1]}")
            return []

        if self._is_tx_control_packet(packet):
            self.stats.control_packets += 1
            self._parse_tx_control_packet(packet)
            should_log_control = (
                self.stats.control_packets <= 10 or self.stats.control_packets % 50 == 0
            )
            if should_log_control:
                self._log(
                    "control "
                    f"seq={self.control.last_sequence_from_pc} "
                    f"rate={self.control.sample_rate_hz} "
                    f"rx={self.control.rx_frequency_hz} "
                    f"tx={self.control.tx_frequency_hz} "
                    f"receivers={self.control.receiver_count} "
                    f"mox={self.control.mox}"
                )
            return []

        return []

    def _log(self, message: str) -> None:
        if self.config.verbose:
            print(f"[frknk hermes] {message}", flush=True)

    def _is_tx_control_packet(self, packet: bytes) -> bool:
        return (
            len(packet) == FRAME_BYTES
            and packet[0:2] == METIS_MAGIC
            and packet[2] == DATA_PACKET
            and packet[3] == ENDPOINT_TX_CONTROL
        )

    def _parse_tx_control_packet(self, packet: bytes) -> None:
        self.control.last_sequence_from_pc = int.from_bytes(packet[4:8], byteorder="big")
        self._parse_control_block(packet, 8)
        self._parse_control_block(packet, 520)

    def _parse_control_block(self, packet: bytes, offset: int) -> None:
        if packet[offset : offset + 3] != b"\x7f\x7f\x7f":
            return

        c0 = packet[offset + 3]
        address = (c0 & 0x7E) >> 1
        self.control.mox = bool(c0 & 0x01)
        c1 = packet[offset + 4]
        c2 = packet[offset + 5]
        c3 = packet[offset + 6]
        c4 = packet[offset + 7]
        value = (c1 << 24) | (c2 << 16) | (c3 << 8) | c4

        if address == 0x00:
            rate_index = c1 & 0x03
            self.control.sample_rate_hz = [48_000, 96_000, 192_000, 384_000][rate_index]
            self.control.receiver_count = ((c4 >> 3) & 0x07) + 1
        elif address == 0x01:
            self.control.tx_frequency_hz = value
        elif address == 0x02:
            self.control.rx_frequency_hz = value
        elif address == 0x0A:
            self.control.lna_gain = c4 & 0x3F

    def next_rx_frame(self) -> bytes:
        samples = self.iq_source.next(SAMPLES_PER_FRAME_SINGLE_RX)
        frame = build_rx_iq_frame(self.sequence, samples)
        self.sequence = (self.sequence + 1) & 0xFFFFFFFF
        self.stats.frames_sent += 1
        self.stats.bytes_sent += len(frame)
        return frame

    def serve_forever(self) -> None:
        """Run the UDP emulator until interrupted."""

        frame_interval = SAMPLES_PER_FRAME_SINGLE_RX / float(self.config.sample_rate_hz)
        next_frame_at = time.monotonic()

        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            sock.bind((self.config.host, self.config.port))
            print(
                f"[frknk] Hermes emulator listening on {self.config.host}:{self.config.port} "
                f"as board 0x{self.config.identity.board_id:02x}"
            )

            while True:
                timeout = 0.05
                if self.running and self.client_addr is not None:
                    timeout = max(0.0, min(timeout, next_frame_at - time.monotonic()))

                readable, _, _ = select.select([sock], [], [], timeout)
                if readable:
                    packet, addr = sock.recvfrom(2048)
                    responses = self.handle_packet(packet, addr)
                    for response in responses:
                        sock.sendto(response, addr)

                client_addr = self.client_addr
                should_send = (
                    self.running
                    and client_addr is not None
                    and time.monotonic() >= next_frame_at
                )
                if should_send and client_addr is not None:
                    if self.stats.frames_sent == 0:
                        self._log(f"streaming endpoint-6 IQ to {client_addr[0]}:{client_addr[1]}")
                    frame = self.next_rx_frame()
                    sock.sendto(frame, client_addr)
                    next_frame_at += frame_interval
                    if next_frame_at < time.monotonic() - frame_interval:
                        next_frame_at = time.monotonic() + frame_interval


def make_emulator(
    *,
    host: str = "0.0.0.0",
    port: int = 1024,
    sample_rate_hz: int = 48_000,
    center_frequency_hz: int = 7_100_000,
    tone_offset_hz: float = 1_200.0,
    amplitude: float = 0.2,
    noise: float = 0.0,
    seed: int = 7,
    verbose: bool = False,
) -> HermesEmulator:
    config = HermesEmulatorConfig(
        host=host,
        port=port,
        sample_rate_hz=sample_rate_hz,
        center_frequency_hz=center_frequency_hz,
        tone_offset_hz=tone_offset_hz,
        amplitude=amplitude,
        noise=noise,
        seed=seed,
        verbose=verbose,
    )
    return HermesEmulator(config)


__all__ = [
    "HermesControlState",
    "HermesEmulator",
    "HermesEmulatorConfig",
    "HermesEmulatorStats",
    "ToneIqSource",
    "make_emulator",
]
