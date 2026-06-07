#!/usr/bin/env python3
"""Streaming-first Muse BLE capture.

This CLI connects to a classic Muse-family headset over BLE, subscribes to sensor
notifications, decodes packets off the BLE callback path, and emits NDJSON events
at selectable cadences:

- raw: BLE packet provenance + hex payload
- sample: decoded EEG/IMU/PPG/telemetry chunks
- frame: low-rate UI snapshot for panels
- summary: 1 Hz health/throughput/drop statistics

The consumer contract is stdout/WebSocket-friendly NDJSON. File capture is only a
side effect for reproducibility.
"""

from __future__ import annotations

import argparse
import asyncio
import contextlib
import json
import signal
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from time import monotonic, time_ns
from typing import Iterable

from bleak import BleakClient, BleakScanner

try:
    from .protocol import (
        ACC_UUID,
        CHARACTERISTICS,
        CONTROL_UUID,
        DEFAULT_NOTIFY_UUIDS,
        GYRO_UUID,
        PPG_NOTIFY_UUIDS,
        control_command,
        decode_packet,
        normalize_uuid,
    )
except ImportError:  # Allow `python scripts/muse/capture.py ...`
    from protocol import (  # type: ignore
        ACC_UUID,
        CHARACTERISTICS,
        CONTROL_UUID,
        DEFAULT_NOTIFY_UUIDS,
        GYRO_UUID,
        PPG_NOTIFY_UUIDS,
        control_command,
        decode_packet,
        normalize_uuid,
    )

RawItem = tuple[int, str, bytes]
Cadence = str


@dataclass(slots=True)
class CaptureStats:
    started_monotonic: float = field(default_factory=monotonic)
    packets_seen: int = 0
    packets_dropped: int = 0
    packets_decoded: int = 0
    decode_errors: int = 0
    events_emitted: int = 0
    by_sensor: Counter[str] = field(default_factory=Counter)
    by_channel: Counter[str] = field(default_factory=Counter)
    last_sequence: dict[str, int] = field(default_factory=dict)
    sequence_gaps: Counter[str] = field(default_factory=Counter)

    def elapsed_s(self) -> float:
        return max(monotonic() - self.started_monotonic, 1e-9)

    def snapshot(self, *, queue_size: int, queue_max: int) -> dict[str, object]:
        elapsed = self.elapsed_s()
        return {
            "type": "muse.summary",
            "cadence": "summary",
            "timestampHostNs": time_ns(),
            "elapsedSec": elapsed,
            "packetsSeen": self.packets_seen,
            "packetsDropped": self.packets_dropped,
            "packetsDecoded": self.packets_decoded,
            "decodeErrors": self.decode_errors,
            "eventsEmitted": self.events_emitted,
            "packetsPerSec": self.packets_seen / elapsed,
            "eventsPerSec": self.events_emitted / elapsed,
            "queueSize": queue_size,
            "queueMax": queue_max,
            "bySensor": dict(self.by_sensor),
            "byChannel": dict(self.by_channel),
            "sequenceGaps": dict(self.sequence_gaps),
        }


class WebSocketBroadcaster:
    """Optional fanout transport for browser/TMNL consumers."""

    def __init__(self, host: str, port: int) -> None:
        self.host = host
        self.port = port
        self._server = None
        self._broadcast = None

    async def start(self) -> None:
        try:
            from websockets.asyncio.server import broadcast, serve
        except ImportError as exc:
            raise RuntimeError("--ws-port requires the 'websockets' package in .venv-muse") from exc

        async def handler(websocket):
            await websocket.wait_closed()

        self._broadcast = broadcast
        self._server = await serve(handler, self.host, self.port)

    def publish(self, line: str) -> None:
        if self._server is None or self._broadcast is None:
            return
        self._broadcast(self._server.connections, line)

    def client_count(self) -> int:
        if self._server is None:
            return 0
        return len(self._server.connections)

    async def stop(self) -> None:
        if self._server is None:
            return
        self._server.close()
        await self._server.wait_closed()
        self._server = None
        self._broadcast = None


class NdjsonSink:
    """Buffered NDJSON sink for stdout, optional file, and optional WebSocket."""

    def __init__(self, path: Path | None, *, batch_size: int = 128, broadcaster: WebSocketBroadcaster | None = None) -> None:
        self.path = path
        self.batch_size = batch_size
        self.broadcaster = broadcaster
        self._file = None
        self._buffer: list[str] = []

    def open(self) -> None:
        if self.path is not None:
            self.path.parent.mkdir(parents=True, exist_ok=True)
            self._file = self.path.open("a", encoding="utf-8", buffering=1024 * 1024)

    def write(self, event: dict[str, object]) -> None:
        line = json.dumps(event, separators=(",", ":"), ensure_ascii=False)
        print(line, flush=False)
        if self.broadcaster is not None:
            self.broadcaster.publish(line)
        if self._file is not None:
            self._buffer.append(line)
            if len(self._buffer) >= self.batch_size:
                self.flush()

    def flush(self) -> None:
        if self._file is not None and self._buffer:
            self._file.write("\n".join(self._buffer))
            self._file.write("\n")
            self._buffer.clear()
            self._file.flush()
        sys.stdout.flush()

    def close(self) -> None:
        self.flush()
        if self._file is not None:
            self._file.close()
            self._file = None


@dataclass(slots=True)
class LatestFrame:
    values: dict[str, object] = field(default_factory=dict)

    def update(self, sample_event: dict[str, object]) -> None:
        sensor = str(sample_event.get("sensor", "unknown"))
        channel = str(sample_event.get("channel", sensor))
        key = f"{sensor}:{channel}"
        self.values[key] = {
            "sensor": sensor,
            "channel": channel,
            "unit": sample_event.get("unit"),
            "sampleRate": sample_event.get("sampleRate"),
            "sequence": sample_event.get("sequence"),
            "samples": sample_event.get("samples"),
            "values": sample_event.get("values"),
            "timestampHostNs": sample_event.get("timestampHostNs"),
        }

    def event(self, *, frame_hz: float) -> dict[str, object]:
        return {
            "type": "muse.frame",
            "cadence": "frame",
            "timestampHostNs": time_ns(),
            "frameHz": frame_hz,
            "streams": self.values,
        }


def parse_cadences(raw: str) -> set[Cadence]:
    cadences = {part.strip().lower() for part in raw.split(",") if part.strip()}
    allowed = {"raw", "sample", "frame", "summary"}
    invalid = cadences - allowed
    if invalid:
        raise argparse.ArgumentTypeError(f"invalid cadence(s): {', '.join(sorted(invalid))}")
    return cadences


def notify_uuids(*, include_ppg: bool, include_aux: bool, eeg_only: bool) -> tuple[str, ...]:
    if eeg_only:
        base = [uuid for uuid in DEFAULT_NOTIFY_UUIDS if CHARACTERISTICS[uuid].sensor == "eeg"]
    else:
        base = list(DEFAULT_NOTIFY_UUIDS)
    if not include_aux:
        base = [uuid for uuid in base if CHARACTERISTICS[uuid].name not in {"LEFT_AUX", "RIGHT_AUX", "DRL_REF"}]
    if include_ppg:
        base.extend(PPG_NOTIFY_UUIDS)
    return tuple(dict.fromkeys(base))


async def write_control(client: BleakClient, command: str) -> None:
    await client.write_gatt_char(CONTROL_UUID, control_command(command), response=False)


async def decoder_loop(
    queue: asyncio.Queue[RawItem],
    sink: NdjsonSink,
    stats: CaptureStats,
    latest: LatestFrame,
    cadences: set[Cadence],
    stop_event: asyncio.Event,
) -> None:
    while not stop_event.is_set() or not queue.empty():
        try:
            timestamp_ns, uuid, payload = await asyncio.wait_for(queue.get(), timeout=0.25)
        except TimeoutError:
            continue

        spec = CHARACTERISTICS.get(uuid)
        sensor_name = spec.name if spec else uuid

        if "raw" in cadences:
            sink.write({
                "type": "muse.packet",
                "cadence": "raw",
                "timestampHostNs": timestamp_ns,
                "uuid": uuid,
                "sensor": spec.sensor if spec else "unknown",
                "channel": sensor_name,
                "byteLength": len(payload),
                "payloadHex": payload.hex(),
            })
            stats.events_emitted += 1

        try:
            decoded = decode_packet(uuid, payload)
        except Exception as exc:  # noqa: BLE capture must survive bad packets.
            stats.decode_errors += 1
            sink.write({
                "type": "muse.decode_error",
                "cadence": "summary",
                "timestampHostNs": timestamp_ns,
                "uuid": uuid,
                "channel": sensor_name,
                "error": repr(exc),
                "payloadHex": payload.hex(),
            })
            stats.events_emitted += 1
            queue.task_done()
            continue

        stats.packets_decoded += 1
        sensor = str(decoded.get("sensor", "unknown"))
        channel = str(decoded.get("channel", sensor_name))
        stats.by_sensor[sensor] += 1
        stats.by_channel[channel] += 1

        seq = decoded.get("sequence")
        if isinstance(seq, int):
            prev = stats.last_sequence.get(channel)
            if prev is not None:
                delta = (seq - prev) & 0xFFFF
                if delta not in (0, 1):
                    stats.sequence_gaps[channel] += 1
            stats.last_sequence[channel] = seq

        event: dict[str, object] = {
            "type": "muse.samples",
            "cadence": "sample",
            "timestampHostNs": timestamp_ns,
            "uuid": uuid,
            **decoded,
        }
        latest.update(event)

        if "sample" in cadences:
            sink.write(event)
            stats.events_emitted += 1

        queue.task_done()


async def keepalive_loop(
    client: BleakClient,
    sink: NdjsonSink,
    stats: CaptureStats,
    cadences: set[Cadence],
    interval_s: float,
    stop_event: asyncio.Event,
) -> None:
    """Send classic Muse keepalive while streaming.

    Archived Muse protocol notes and muselsl agree: during streaming, send `k`
    at least every 10 seconds or the headset may assume no recipient exists and
    cease streaming. We use a conservative 5s default.
    """
    if interval_s <= 0:
        return
    while not stop_event.is_set():
        await asyncio.sleep(interval_s)
        if stop_event.is_set():
            break
        await write_control(client, "k")
        if "summary" in cadences:
            sink.write({
                "type": "muse.keepalive",
                "cadence": "summary",
                "timestampHostNs": time_ns(),
                "command": "k",
                "payloadHex": control_command("k").hex(),
            })
            stats.events_emitted += 1


async def summary_loop(
    queue: asyncio.Queue[RawItem],
    sink: NdjsonSink,
    stats: CaptureStats,
    stop_event: asyncio.Event,
) -> None:
    while not stop_event.is_set():
        await asyncio.sleep(1.0)
        sink.write(stats.snapshot(queue_size=queue.qsize(), queue_max=queue.maxsize))
        stats.events_emitted += 1


async def frame_loop(
    sink: NdjsonSink,
    latest: LatestFrame,
    stats: CaptureStats,
    frame_hz: float,
    stop_event: asyncio.Event,
) -> None:
    interval = 1.0 / frame_hz
    while not stop_event.is_set():
        await asyncio.sleep(interval)
        sink.write(latest.event(frame_hz=frame_hz))
        stats.events_emitted += 1


async def resolve_ble_device(address: str, timeout: float):
    """Resolve a BLEDevice before connecting.

    BlueZ device cache entries can disappear after disconnects. Passing a resolved
    BLEDevice into BleakClient avoids relying on stale cache state.
    """
    return await BleakScanner.find_device_by_address(address, timeout=timeout)


async def run_capture(args: argparse.Namespace) -> int:
    cadences: set[Cadence] = args.cadence
    queue: asyncio.Queue[RawItem] = asyncio.Queue(maxsize=args.queue_size)
    stats = CaptureStats()
    latest = LatestFrame()
    stop_event = asyncio.Event()
    broadcaster = WebSocketBroadcaster(args.ws_host, args.ws_port) if args.ws_port else None
    if broadcaster is not None:
        await broadcaster.start()
    sink = NdjsonSink(args.output, batch_size=args.batch_size, broadcaster=broadcaster)
    sink.open()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        with contextlib.suppress(NotImplementedError):
            loop.add_signal_handler(sig, stop_event.set)

    def on_notify(sender: object, data: bytearray) -> None:
        uuid = normalize_uuid(sender)
        payload = bytes(data)
        stats.packets_seen += 1
        try:
            queue.put_nowait((time_ns(), uuid, payload))
        except asyncio.QueueFull:
            stats.packets_dropped += 1

    uuids = notify_uuids(include_ppg=args.ppg, include_aux=args.aux, eeg_only=args.eeg_only)

    if broadcaster is not None:
        sink.write({
            "type": "muse.ws_listening",
            "cadence": "summary",
            "timestampHostNs": time_ns(),
            "url": f"ws://{args.ws_host}:{args.ws_port}",
        })
        stats.events_emitted += 1

    sink.write({
        "type": "muse.capture_start",
        "cadence": "summary",
        "timestampHostNs": time_ns(),
        "address": args.address,
        "notifyUuids": list(uuids),
        "cadences": sorted(cadences),
        "queueSize": args.queue_size,
    })
    stats.events_emitted += 1

    decoder: asyncio.Task[None] | None = None
    summary: asyncio.Task[None] | None = None
    frame: asyncio.Task[None] | None = None
    keepalive: asyncio.Task[None] | None = None

    try:
        sink.write({
            "type": "muse.scan_start",
            "cadence": "summary",
            "timestampHostNs": time_ns(),
            "address": args.address,
            "timeoutSec": args.scan_timeout,
        })
        stats.events_emitted += 1
        device = await resolve_ble_device(args.address, args.scan_timeout)
        if device is None:
            sink.write({
                "type": "muse.scan_miss",
                "cadence": "summary",
                "timestampHostNs": time_ns(),
                "address": args.address,
                "message": "Device not advertising or already connected elsewhere.",
            })
            stats.events_emitted += 1
            return 1

        sink.write({
            "type": "muse.scan_hit",
            "cadence": "summary",
            "timestampHostNs": time_ns(),
            "address": args.address,
            "name": device.name,
        })
        stats.events_emitted += 1

        async with BleakClient(device, timeout=args.connect_timeout) as client:
            decoder = asyncio.create_task(decoder_loop(queue, sink, stats, latest, cadences, stop_event))
            summary = asyncio.create_task(summary_loop(queue, sink, stats, stop_event)) if "summary" in cadences else None
            frame = asyncio.create_task(frame_loop(sink, latest, stats, args.frame_hz, stop_event)) if "frame" in cadences else None
            if not client.is_connected:
                raise RuntimeError("BleakClient did not connect")

            sink.write({
                "type": "muse.connected",
                "cadence": "summary",
                "timestampHostNs": time_ns(),
                "address": args.address,
            })
            stats.events_emitted += 1

            # Stop any prior stream, choose preset, subscribe, then resume. These are
            # standard non-destructive Muse control commands used by open-source clients.
            if not args.no_halt:
                await write_control(client, "h")
                await asyncio.sleep(args.command_delay)
            if args.preset:
                await write_control(client, args.preset if args.preset.startswith("p") else f"p{args.preset}")
                await asyncio.sleep(args.command_delay)

            for uuid in uuids:
                await client.start_notify(uuid, on_notify)

            await write_control(client, "d")
            keepalive = asyncio.create_task(keepalive_loop(client, sink, stats, cadences, args.keepalive_interval, stop_event))
            started = monotonic()
            while not stop_event.is_set():
                if args.duration and monotonic() - started >= args.duration:
                    stop_event.set()
                    break
                await asyncio.sleep(0.05)

            with contextlib.suppress(Exception):
                await write_control(client, "h")
            for uuid in uuids:
                with contextlib.suppress(Exception):
                    await client.stop_notify(uuid)

    finally:
        stop_event.set()
        await queue.join()
        for task in (summary, frame, keepalive):
            if task is not None:
                task.cancel()
        if decoder is not None:
            decoder.cancel()
        for task in [task for task in (summary, frame, keepalive, decoder) if task is not None]:
            with contextlib.suppress(asyncio.CancelledError):
                await task
        sink.write(stats.snapshot(queue_size=queue.qsize(), queue_max=queue.maxsize))
        sink.write({
            "type": "muse.capture_stop",
            "cadence": "summary",
            "timestampHostNs": time_ns(),
            "address": args.address,
        })
        sink.close()
        if broadcaster is not None:
            await broadcaster.stop()

    return 0 if stats.decode_errors == 0 else 2


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Stream and decode classic Muse BLE notifications as NDJSON.")
    parser.add_argument("--address", required=True, help="Muse BLE MAC address, e.g. 00:55:DA:BB:8C:66")
    parser.add_argument("--duration", type=float, default=10.0, help="Capture duration in seconds. 0 means until interrupted.")
    parser.add_argument("--output", type=Path, default=None, help="Optional JSONL artifact path.")
    parser.add_argument("--cadence", type=parse_cadences, default=parse_cadences("sample,summary"), help="Comma-list: raw,sample,frame,summary")
    parser.add_argument("--frame-hz", type=float, default=20.0, help="Frame cadence when cadence includes frame.")
    parser.add_argument("--queue-size", type=int, default=8192, help="Bounded raw packet queue size.")
    parser.add_argument("--batch-size", type=int, default=128, help="File write batch size in JSONL lines.")
    parser.add_argument("--ws-host", default="127.0.0.1", help="WebSocket bind host for browser/TMNL consumers.")
    parser.add_argument("--ws-port", type=int, default=0, help="Optional WebSocket port. 0 disables WebSocket fanout.")
    parser.add_argument("--connect-timeout", type=float, default=15.0)
    parser.add_argument("--scan-timeout", type=float, default=12.0)
    parser.add_argument("--command-delay", type=float, default=0.10)
    parser.add_argument("--keepalive-interval", type=float, default=5.0, help="Seconds between classic Muse 'k' keepalive writes while streaming. <=0 disables.")
    parser.add_argument("--preset", default="p50", help="Muse preset command; p50 enables EEG+PPG on classic devices. Empty string disables preset write.")
    parser.add_argument("--ppg", action="store_true", help="Subscribe to PPG characteristics too.")
    parser.add_argument("--aux", action="store_true", help="Subscribe to AUX/DRL-style EEG characteristics too.")
    parser.add_argument("--eeg-only", action="store_true", help="Subscribe only EEG characteristics.")
    parser.add_argument("--no-halt", action="store_true", help="Do not send halt before starting stream.")
    return parser


def main(argv: Iterable[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.preset == "":
        args.preset = None
    return asyncio.run(run_capture(args))


if __name__ == "__main__":
    raise SystemExit(main())
