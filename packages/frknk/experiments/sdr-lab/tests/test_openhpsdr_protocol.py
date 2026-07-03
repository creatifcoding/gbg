import numpy as np

from sdr_lab.openhpsdr import (
    ENDPOINT_RX_IQ,
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


def test_discovery_response_matches_quisk_indices() -> None:
    response = build_discovery_response(DiscoveryIdentity())

    assert len(response) == 64
    assert response[0:2] == b"\xef\xfe"
    assert response[3:9] == b"\x02\x00\x00FRK"
    assert response[9] == 1
    assert response[10] == HERMES_LITE_BOARD_ID


def test_start_stop_packets() -> None:
    assert is_start_packet(build_start_stop(True))
    assert is_start_packet(b"\xef\xfe\x04\x03" + bytes(60))
    assert is_start_packet(b"\xef\xfe\x04\x81" + bytes(60))
    assert not is_stop_packet(build_start_stop(True))
    assert is_stop_packet(build_start_stop(False))


def test_rx_iq_frame_matches_quisk_endpoint_and_offsets() -> None:
    samples = np.zeros(SAMPLES_PER_FRAME_SINGLE_RX, dtype=np.complex64)
    samples[0] = 0.5 + 0.25j
    frame = build_rx_iq_frame(42, samples)

    assert len(frame) == FRAME_BYTES
    assert frame[0:2] == b"\xef\xfe"
    assert frame[2] == 0x01
    assert frame[3] == ENDPOINT_RX_IQ
    assert int.from_bytes(frame[4:8], "big") == 42
    assert frame[8:11] == b"\x7f\x7f\x7f"
    assert frame[520:523] == b"\x7f\x7f\x7f"
    assert frame[11] >> 3 == 0
    assert frame[523] >> 3 == 1
    # Quisk reads imaginary first, real second.
    assert frame[16:19] != b"\x00\x00\x00"
    assert frame[19:22] != b"\x00\x00\x00"
