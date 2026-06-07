#!/usr/bin/env python3
"""Benchmark Muse packet decoders.

Target line rate is tiny (<~200 BLE notifications/sec for classic EEG+IMU+PPG).
This benchmark gives us a concrete safety margin before wiring UI panels.
"""

from __future__ import annotations

import argparse
from time import perf_counter

try:
    from .protocol import ACC_SCALE_G, GYRO_SCALE_DPS, decode_eeg, decode_eeg_raw12, decode_imu, decode_ppg
except ImportError:
    from protocol import ACC_SCALE_G, GYRO_SCALE_DPS, decode_eeg, decode_eeg_raw12, decode_imu, decode_ppg  # type: ignore

EEG_PACKET = bytes.fromhex("01280005e9fff9c400063ffffc8d09f000c7aaa9")
GYRO_PACKET = bytes.fromhex("0128fff300bd004efff800b90053fffc00a90058")
ACC_PACKET = bytes.fromhex("01284015fce1f46b4060fd0ef4d14002fc9af4c3")
PPG_PACKET = bytes.fromhex("01280000aa0000bb0000cc0000dd0000ee0000ff")


def bench(name: str, count: int, fn) -> tuple[str, float, float]:
    start = perf_counter()
    for _ in range(count):
        fn()
    elapsed = perf_counter() - start
    return name, elapsed, count / elapsed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=500_000)
    parser.add_argument("--target-line-rate", type=float, default=200.0, help="Approx observed Muse notification line rate to compare against.")
    args = parser.parse_args()

    cases = [
        bench("eeg_scaled", args.count, lambda: decode_eeg(EEG_PACKET)),
        bench("eeg_raw12", args.count, lambda: decode_eeg_raw12(EEG_PACKET)),
        bench("gyro", args.count, lambda: decode_imu(GYRO_PACKET, scale=GYRO_SCALE_DPS)),
        bench("acc", args.count, lambda: decode_imu(ACC_PACKET, scale=ACC_SCALE_G)),
        bench("ppg", args.count, lambda: decode_ppg(PPG_PACKET)),
    ]

    print("decoder,iterations,elapsed_sec,packets_per_sec,line_rate_multiple")
    ok = True
    for name, elapsed, pps in cases:
        multiple = pps / args.target_line_rate
        print(f"{name},{args.count},{elapsed:.6f},{pps:.2f},{multiple:.1f}")
        ok = ok and multiple >= 100
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
