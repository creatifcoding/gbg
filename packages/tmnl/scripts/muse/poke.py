#!/usr/bin/env python3
"""Send one safe classic Muse control command.

Useful for checking whether a headset is still connectable without starting the
full capture pipeline. Commands are written to the classic control characteristic
273e0001 using muselsl-compatible framing:

    [len(command)+1] + ASCII(command) + '\n'

Examples:
    k   keep streaming / keepalive
    s   status/control JSON request
    v1  device info JSON request

This does not wake a device that isn't advertising/connectable; BLE still needs a
connection before a GATT write exists.
"""

from __future__ import annotations

import argparse
import asyncio
from time import time_ns
from typing import Iterable

from bleak import BleakClient, BleakScanner

try:
    from .protocol import CONTROL_UUID, control_command
except ImportError:
    from protocol import CONTROL_UUID, control_command  # type: ignore

SAFE_COMMANDS = {"k", "s", "v1"}


async def poke(address: str, command: str, *, scan_timeout: float, connect_timeout: float, notify: bool) -> int:
    if command not in SAFE_COMMANDS:
        raise ValueError(f"Refusing command {command!r}; safe commands are {sorted(SAFE_COMMANDS)}")

    print({
        "type": "muse.poke_scan_start",
        "timestampHostNs": time_ns(),
        "address": address,
        "command": command,
        "payloadHex": control_command(command).hex(),
    })
    device = await BleakScanner.find_device_by_address(address, timeout=scan_timeout)
    if device is None:
        print({
            "type": "muse.poke_scan_miss",
            "timestampHostNs": time_ns(),
            "address": address,
            "message": "Device not advertising/connectable; cannot perform GATT keepalive write.",
        })
        return 1

    responses: list[str] = []

    def on_control(_sender: object, data: bytearray) -> None:
        # Control notifications are framed chunks: first byte length, then ASCII.
        n = data[0] if data else 0
        chunk = bytes(data[1:n]).decode("utf-8", errors="replace")
        responses.append(chunk)
        print({
            "type": "muse.poke_control_chunk",
            "timestampHostNs": time_ns(),
            "chunk": chunk,
            "payloadHex": bytes(data).hex(),
        })

    async with BleakClient(device, timeout=connect_timeout) as client:
        if notify:
            await client.start_notify(CONTROL_UUID, on_control)
        payload = control_command(command)
        await client.write_gatt_char(CONTROL_UUID, payload, response=False)
        print({
            "type": "muse.poke_written",
            "timestampHostNs": time_ns(),
            "address": address,
            "command": command,
            "payloadHex": payload.hex(),
            "notify": notify,
        })
        if notify:
            await asyncio.sleep(1.0)
            await client.stop_notify(CONTROL_UUID)

    if responses:
        print({
            "type": "muse.poke_response",
            "timestampHostNs": time_ns(),
            "text": "".join(responses),
        })
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Send one safe Muse control-characteristic command.")
    parser.add_argument("--address", required=True)
    parser.add_argument("--command", choices=sorted(SAFE_COMMANDS), default="k")
    parser.add_argument("--scan-timeout", type=float, default=8.0)
    parser.add_argument("--connect-timeout", type=float, default=10.0)
    parser.add_argument("--notify", action="store_true", help="Subscribe to control responses around the write.")
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return asyncio.run(poke(args.address, args.command, scan_timeout=args.scan_timeout, connect_timeout=args.connect_timeout, notify=args.notify))


if __name__ == "__main__":
    raise SystemExit(main())
