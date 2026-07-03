from sdr_lab.openhpsdr import (
    ENDPOINT_TX_CONTROL,
    FRAME_BYTES,
    HermesEmulatorConfig,
    build_start_stop,
)
from sdr_lab.openhpsdr.emulator import HermesEmulator


def _tx_control_packet(
    *,
    sequence: int = 1,
    block0: tuple[int, int] = (0, 0),
    block1: tuple[int, int] = (0, 0),
) -> bytes:
    packet = bytearray(FRAME_BYTES)
    packet[0:2] = b"\xef\xfe"
    packet[2] = 0x01
    packet[3] = ENDPOINT_TX_CONTROL
    packet[4:8] = sequence.to_bytes(4, "big")
    for offset, (address, value) in ((8, block0), (520, block1)):
        packet[offset : offset + 3] = b"\x7f\x7f\x7f"
        packet[offset + 3] = address << 1
        packet[offset + 4] = (value >> 24) & 0xFF
        packet[offset + 5] = (value >> 16) & 0xFF
        packet[offset + 6] = (value >> 8) & 0xFF
        packet[offset + 7] = value & 0xFF
    return bytes(packet)


def test_emulator_discovery_and_start_stop_state() -> None:
    emulator = HermesEmulator(HermesEmulatorConfig())
    addr = ("127.0.0.1", 55_000)

    responses = emulator.handle_packet(b"\xef\xfe\x02" + bytes(60), addr)
    assert len(responses) == 1
    assert responses[0][0:3] == b"\xef\xfe\x02"
    assert responses[0][10] == 0x06
    assert emulator.client_addr == addr

    emulator.handle_packet(build_start_stop(True), addr)
    assert emulator.running is True
    assert emulator.stats.start_requests == 1

    emulator.handle_packet(build_start_stop(False), addr)
    assert emulator.running is False
    assert emulator.sequence == 0
    assert emulator.stats.stop_requests == 1


def test_emulator_parses_core_pc_to_hermes_control_words() -> None:
    emulator = HermesEmulator(HermesEmulatorConfig())
    addr = ("127.0.0.1", 55_000)
    # address 0: C1 low bits choose sample rate, C4 bits 5:3 encode receiver count minus 1.
    rate_and_receivers = 0x0100000C  # 96 ksps, receiver_count=((0x0c>>3)&7)+1 = 2
    rx_frequency = 7_101_234

    packet = _tx_control_packet(
        sequence=9,
        block0=(0x00, rate_and_receivers),
        block1=(0x02, rx_frequency),
    )
    emulator.handle_packet(packet, addr)

    assert emulator.stats.control_packets == 1
    assert emulator.control.last_sequence_from_pc == 9
    assert emulator.control.sample_rate_hz == 96_000
    assert emulator.control.receiver_count == 2
    assert emulator.control.rx_frequency_hz == rx_frequency


def test_emulator_generates_endpoint_6_frames() -> None:
    emulator = HermesEmulator(HermesEmulatorConfig(sample_rate_hz=48_000, tone_offset_hz=1_200))

    first = emulator.next_rx_frame()
    second = emulator.next_rx_frame()

    assert len(first) == FRAME_BYTES
    assert first[0:4] == b"\xef\xfe\x01\x06"
    assert int.from_bytes(first[4:8], "big") == 0
    assert int.from_bytes(second[4:8], "big") == 1
    assert emulator.stats.frames_sent == 2
