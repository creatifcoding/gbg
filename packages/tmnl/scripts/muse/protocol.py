#!/usr/bin/env python3
"""Classic Muse BLE packet decoding.

This module is intentionally dependency-free and allocation-light. The Muse S/Muse 2
classic protocol sends one BLE notification per sensor characteristic under the
Interaxon FE8D service. EEG packets carry a uint16 sequence followed by 12 packed
12-bit samples. IMU packets carry a uint16 sequence followed by 9 signed int16
values laid out as x1,x2,x3,y1,y2,y3,z1,z2,z3.

References captured in research/muse2-research-synthesis.md and docs.rs/muse-rs.
"""

from __future__ import annotations

from dataclasses import dataclass
from struct import unpack_from
from typing import Literal

SERVICE_UUID = "0000fe8d-0000-1000-8000-00805f9b34fb"
CONTROL_UUID = "273e0001-4c4d-454d-96be-f03bac821358"

LEFT_AUX_UUID = "273e0002-4c4d-454d-96be-f03bac821358"
TP9_UUID = "273e0003-4c4d-454d-96be-f03bac821358"
AF7_UUID = "273e0004-4c4d-454d-96be-f03bac821358"
AF8_UUID = "273e0005-4c4d-454d-96be-f03bac821358"
TP10_UUID = "273e0006-4c4d-454d-96be-f03bac821358"
RIGHT_AUX_UUID = "273e0007-4c4d-454d-96be-f03bac821358"
DRL_REF_UUID = "273e0008-4c4d-454d-96be-f03bac821358"
GYRO_UUID = "273e0009-4c4d-454d-96be-f03bac821358"
ACC_UUID = "273e000a-4c4d-454d-96be-f03bac821358"
TELEMETRY_UUID = "273e000b-4c4d-454d-96be-f03bac821358"
PPG_AMBIENT_UUID = "273e000f-4c4d-454d-96be-f03bac821358"
PPG_IR_UUID = "273e0010-4c4d-454d-96be-f03bac821358"
PPG_RED_UUID = "273e0011-4c4d-454d-96be-f03bac821358"
THERMISTOR_UUID = "273e0012-4c4d-454d-96be-f03bac821358"

SensorKind = Literal["eeg", "imu", "ppg", "telemetry", "control", "unknown"]

EEG_SCALE_UV = 0.48828125
ACC_SCALE_G = 0.0000610352
GYRO_SCALE_DPS = 0.0074768

EEG_SAMPLE_RATE_HZ = 256
IMU_SAMPLE_RATE_HZ = 52
PPG_SAMPLE_RATE_HZ = 64
TELEMETRY_SAMPLE_RATE_HZ = 1


@dataclass(frozen=True, slots=True)
class CharacteristicSpec:
    uuid: str
    sensor: SensorKind
    name: str
    unit: str
    sample_rate_hz: int


CHARACTERISTICS: dict[str, CharacteristicSpec] = {
    CONTROL_UUID: CharacteristicSpec(CONTROL_UUID, "control", "control", "json", 0),
    TP9_UUID: CharacteristicSpec(TP9_UUID, "eeg", "TP9", "uV", EEG_SAMPLE_RATE_HZ),
    AF7_UUID: CharacteristicSpec(AF7_UUID, "eeg", "AF7", "uV", EEG_SAMPLE_RATE_HZ),
    AF8_UUID: CharacteristicSpec(AF8_UUID, "eeg", "AF8", "uV", EEG_SAMPLE_RATE_HZ),
    TP10_UUID: CharacteristicSpec(TP10_UUID, "eeg", "TP10", "uV", EEG_SAMPLE_RATE_HZ),
    RIGHT_AUX_UUID: CharacteristicSpec(RIGHT_AUX_UUID, "eeg", "RIGHT_AUX", "uV", EEG_SAMPLE_RATE_HZ),
    LEFT_AUX_UUID: CharacteristicSpec(LEFT_AUX_UUID, "eeg", "LEFT_AUX", "uV", EEG_SAMPLE_RATE_HZ),
    DRL_REF_UUID: CharacteristicSpec(DRL_REF_UUID, "eeg", "DRL_REF", "uV", EEG_SAMPLE_RATE_HZ),
    GYRO_UUID: CharacteristicSpec(GYRO_UUID, "imu", "gyro", "dps", IMU_SAMPLE_RATE_HZ),
    ACC_UUID: CharacteristicSpec(ACC_UUID, "imu", "acc", "g", IMU_SAMPLE_RATE_HZ),
    TELEMETRY_UUID: CharacteristicSpec(TELEMETRY_UUID, "telemetry", "telemetry", "mixed", TELEMETRY_SAMPLE_RATE_HZ),
    PPG_AMBIENT_UUID: CharacteristicSpec(PPG_AMBIENT_UUID, "ppg", "PPG_AMBIENT", "raw24", PPG_SAMPLE_RATE_HZ),
    PPG_IR_UUID: CharacteristicSpec(PPG_IR_UUID, "ppg", "PPG_IR", "raw24", PPG_SAMPLE_RATE_HZ),
    PPG_RED_UUID: CharacteristicSpec(PPG_RED_UUID, "ppg", "PPG_RED", "raw24", PPG_SAMPLE_RATE_HZ),
    THERMISTOR_UUID: CharacteristicSpec(THERMISTOR_UUID, "unknown", "thermistor", "raw", 0),
}

DEFAULT_NOTIFY_UUIDS = (
    TP9_UUID,
    AF7_UUID,
    AF8_UUID,
    TP10_UUID,
    RIGHT_AUX_UUID,
    GYRO_UUID,
    ACC_UUID,
    TELEMETRY_UUID,
)

PPG_NOTIFY_UUIDS = (PPG_AMBIENT_UUID, PPG_IR_UUID, PPG_RED_UUID)


def normalize_uuid(value: object) -> str:
    """Return a lower-case UUID string from a Bleak sender/UUID-ish object."""
    uuid = getattr(value, "uuid", value)
    return str(uuid).lower()


def control_command(command: str) -> bytes:
    """Encode a Muse control command for the classic control characteristic."""
    raw = command.encode("ascii")
    return bytes((len(raw) + 1, *raw, 0x0A))


def sequence(packet: bytes | bytearray | memoryview) -> int:
    if len(packet) < 2:
        raise ValueError(f"packet too short for sequence: {len(packet)} bytes")
    return (packet[0] << 8) | packet[1]


def decode_eeg(packet: bytes | bytearray | memoryview) -> tuple[int, tuple[float, ...]]:
    """Decode a classic Muse EEG packet into sequence + 12 microvolt samples."""
    if len(packet) < 20:
        raise ValueError(f"EEG packet too short: {len(packet)} bytes")
    seq = sequence(packet)
    out: list[float] = []
    append = out.append
    for offset in range(2, 20, 3):
        b0 = packet[offset]
        b1 = packet[offset + 1]
        b2 = packet[offset + 2]
        sample_a = (b0 << 4) | (b1 >> 4)
        sample_b = ((b1 & 0x0F) << 8) | b2
        append((sample_a - 2048) * EEG_SCALE_UV)
        append((sample_b - 2048) * EEG_SCALE_UV)
    return seq, tuple(out)


def decode_eeg_raw12(packet: bytes | bytearray | memoryview) -> tuple[int, tuple[int, ...]]:
    """Decode EEG to raw 12-bit ADC units; useful for benchmarks and lossless logs."""
    if len(packet) < 20:
        raise ValueError(f"EEG packet too short: {len(packet)} bytes")
    seq = sequence(packet)
    out: list[int] = []
    append = out.append
    for offset in range(2, 20, 3):
        b0 = packet[offset]
        b1 = packet[offset + 1]
        b2 = packet[offset + 2]
        append((b0 << 4) | (b1 >> 4))
        append(((b1 & 0x0F) << 8) | b2)
    return seq, tuple(out)


def decode_imu(
    packet: bytes | bytearray | memoryview,
    *,
    scale: float,
) -> tuple[int, tuple[tuple[float, float, float], ...]]:
    """Decode accelerometer or gyroscope packet.

    Muse IMU values are 9 signed int16 values after the sequence. Muselsl's
    reference implementation reshapes them as order='F', yielding three XYZ
    samples: (x1,y1,z1), (x2,y2,z2), (x3,y3,z3).
    """
    if len(packet) < 20:
        raise ValueError(f"IMU packet too short: {len(packet)} bytes")
    seq, v0, v1, v2, v3, v4, v5, v6, v7, v8 = unpack_from(">Hhhhhhhhhh", packet, 0)
    return seq, (
        (v0 * scale, v3 * scale, v6 * scale),
        (v1 * scale, v4 * scale, v7 * scale),
        (v2 * scale, v5 * scale, v8 * scale),
    )


def decode_ppg(packet: bytes | bytearray | memoryview) -> tuple[int, tuple[int, ...]]:
    """Decode PPG packet into sequence + six unsigned 24-bit samples."""
    if len(packet) < 20:
        raise ValueError(f"PPG packet too short: {len(packet)} bytes")
    seq = sequence(packet)
    out: list[int] = []
    append = out.append
    for offset in range(2, 20, 3):
        append((packet[offset] << 16) | (packet[offset + 1] << 8) | packet[offset + 2])
    return seq, tuple(out)


def decode_telemetry(packet: bytes | bytearray | memoryview) -> tuple[int, dict[str, float | int]]:
    """Decode classic telemetry packet.

    muselsl interprets the five uint16 fields as packet, battery, fuel gauge,
    ADC voltage, and temperature, with battery scaled by /512 and fuel by *2.2.
    """
    if len(packet) < 10:
        raise ValueError(f"telemetry packet too short: {len(packet)} bytes")
    seq, battery_raw, fuel_raw, adc_volt, temperature = unpack_from(">HHHHH", packet, 0)
    return seq, {
        "battery": battery_raw / 512,
        "batteryRaw": battery_raw,
        "fuelGauge": fuel_raw * 2.2,
        "fuelRaw": fuel_raw,
        "adcVolt": adc_volt,
        "temperature": temperature,
    }


def decode_packet(
    uuid: str,
    packet: bytes | bytearray | memoryview,
) -> dict[str, object]:
    """Decode a packet into a transport-neutral event payload."""
    normalized = uuid.lower()
    spec = CHARACTERISTICS.get(normalized)
    if spec is None:
        return {
            "sensor": "unknown",
            "channel": normalized,
            "sequence": sequence(packet) if len(packet) >= 2 else None,
            "samples": [],
        }

    if spec.sensor == "eeg":
        seq, samples = decode_eeg(packet)
        return {
            "sensor": "eeg",
            "channel": spec.name,
            "unit": spec.unit,
            "sampleRate": spec.sample_rate_hz,
            "sequence": seq,
            "samples": samples,
        }
    if normalized == ACC_UUID:
        seq, samples = decode_imu(packet, scale=ACC_SCALE_G)
        return {
            "sensor": "acc",
            "channel": spec.name,
            "unit": spec.unit,
            "sampleRate": spec.sample_rate_hz,
            "sequence": seq,
            "samples": samples,
        }
    if normalized == GYRO_UUID:
        seq, samples = decode_imu(packet, scale=GYRO_SCALE_DPS)
        return {
            "sensor": "gyro",
            "channel": spec.name,
            "unit": spec.unit,
            "sampleRate": spec.sample_rate_hz,
            "sequence": seq,
            "samples": samples,
        }
    if spec.sensor == "ppg":
        seq, samples = decode_ppg(packet)
        return {
            "sensor": "ppg",
            "channel": spec.name,
            "unit": spec.unit,
            "sampleRate": spec.sample_rate_hz,
            "sequence": seq,
            "samples": samples,
        }
    if spec.sensor == "telemetry":
        seq, values = decode_telemetry(packet)
        return {
            "sensor": "telemetry",
            "channel": spec.name,
            "unit": spec.unit,
            "sampleRate": spec.sample_rate_hz,
            "sequence": seq,
            "values": values,
        }
    return {
        "sensor": spec.sensor,
        "channel": spec.name,
        "unit": spec.unit,
        "sampleRate": spec.sample_rate_hz,
        "sequence": sequence(packet) if len(packet) >= 2 else None,
        "samples": [],
    }
