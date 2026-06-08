# Muse BLE Capture Tools

Streaming-first capture tools for Muse 2 / Muse S classic BLE devices.

The current hardware session found:

```text
Name:    MuseS-8C66
Address: 00:55:DA:BB:8C:66
Service: 0000fe8d-0000-1000-8000-00805f9b34fb
Mode:    classic Muse GATT characteristics, not Athena universal char
```

## Why this exists

`muselsl` can stream the device with the `bleak` backend, but its debug output is noisy and its scanner/gatt paths can be brittle against newer BlueZ/Python stacks. These scripts give TMNL a controlled, streaming-first ingest boundary:

- `protocol.py` — fast dependency-free decoders for classic Muse packets
- `capture.py` — BLE capture CLI emitting NDJSON cadences to stdout, optional JSONL/CSV files, optional WebSocket, and optional OSC fanout
- `bench_protocol.py` — decoder throughput benchmark
- `analyze_capture.py` — streaming JSONL artifact loader and first-order summarizer

## Cadences

Consumers should subscribe to streams, not tail capture files. Files are artifacts only.

| Cadence | Event type | Purpose |
| --- | --- | --- |
| `raw` | `muse.packet` | BLE packet provenance + hex payload |
| `sample` | `muse.samples` | Decoded EEG/ACC/GYRO/PPG/telemetry chunks |
| `frame` | `muse.frame` | Low-rate UI snapshot for panels |
| `summary` | `muse.summary` | 1 Hz health/throughput/drop stats |

## Setup

Use an isolated project-local venv:

```bash
uv venv .venv-muse --python 3.12
source .venv-muse/bin/activate
uv pip install bleak python-osc muselsl
```

`muselsl` is optional for these scripts, but useful for LSL comparisons.

## Scan

The headset must be powered on, nearby, and not connected to a phone app. If the scan misses, power-cycle/tap the headset.

```bash
bluetoothctl scan transport le
bluetoothctl --timeout 12 scan on
bluetoothctl devices | rg -i 'muse|00:55:DA'
```

## Benchmark

```bash
source .venv-muse/bin/activate
python scripts/muse/bench_protocol.py --count 200000
```

Observed on the Zenbook: EEG scaled decoding ~1.1M packets/sec and IMU decoding ~3–4.6M packets/sec, thousands of times above device line rate.

## Capture

```bash
source .venv-muse/bin/activate
python scripts/muse/capture.py \
  --address 00:55:DA:BB:8C:66 \
  --duration 10 \
  --cadence sample,frame,summary \
  --frame-hz 20 \
  --output /tmp/muse-capture.jsonl \
  --csv-output /tmp/muse-samples.csv
```

`--csv-output` is a reproducibility side effect for decoded sample events. It writes one scalar per row:
`timestampHostNs, uuid, sensor, channel, sequence, unit, sampleRate, sampleIndex, axis, value`.
EEG/PPG samples use an empty `axis`; ACC/GYRO vectors expand to `x`, `y`, and `z`; telemetry values use the telemetry key as `axis`.

Browser/TMNL WebSocket fanout:

```bash
python scripts/muse/capture.py \
  --address 00:55:DA:BB:8C:66 \
  --duration 0 \
  --cadence sample,frame,summary \
  --frame-hz 20 \
  --ws-port 8765
```

Then connect to `ws://127.0.0.1:8765`. Every message is one JSON event with the same shape as stdout/file NDJSON.

OSC fanout for Max/MSP, SuperCollider, TouchDesigner, etc.:

```bash
python scripts/muse/capture.py \
  --address 00:55:DA:BB:8C:66 \
  --duration 0 \
  --cadence sample,summary \
  --osc-host 127.0.0.1 \
  --osc-port 4545
```

OSC output is derived from decoded `muse.samples` events. Paths follow common Muse/Mind-Monitor conventions where possible:
`/muse/eeg/tp9`, `/muse/eeg/af7`, `/muse/eeg/af8`, `/muse/eeg/tp10`, `/muse/acc`, `/muse/gyro`, `/muse/ppg/<channel>`, and `/muse/telemetry/<field>`.

Include PPG:

```bash
python scripts/muse/capture.py \
  --address 00:55:DA:BB:8C:66 \
  --duration 10 \
  --ppg \
  --cadence sample,summary
```

Raw packet provenance:

```bash
python scripts/muse/capture.py \
  --address 00:55:DA:BB:8C:66 \
  --duration 5 \
  --cadence raw,sample,summary
```

## Analyze artifacts

Analyze one or more capture artifacts without loading them fully into memory:

```bash
python scripts/muse/analyze_capture.py \
  /tmp/muse-capture.jsonl \
  --pretty > /tmp/muse-first-order-summary.json
```

The analyzer rejects malformed JSON with `path:line` diagnostics, counts non-sample events separately, and summarizes `muse.samples` by sensor/channel with sequence gaps, observed rates, inter-event delta p50/p95/p99, timestamp regressions, online scalar statistics, and conservative first-order quality flags. It also emits a top-level `transport` section with capture/sample coverage, summary cadence presence, queue/drop/decode counters, and aggregate inter-sample timing. Future session manifests and labels can be attached with `--manifest` and `--labels`.

## Validate protocol compliance

Run the protocol-compliance gate before downstream metric packs:

```bash
python scripts/muse/validate_protocol.py \
  --session-dir /tmp/muse-session \
  --output /tmp/muse-session/metric-packs/protocol-compliance.result.json \
  --report /tmp/muse-session/metric-packs/protocol-compliance.report.md
```

The validator emits a canonical `muse.metric_pack_result` with `packId: protocol-compliance`. It verifies manifest structure, artifact paths, capture sanity, marker/session/protocol alignment, block coverage, `events.tsv` readiness, manifest/observed channel metadata, decoded sample CSV export columns, and claim boundaries. A no-contact session may be transport-compliant but still returns warnings that bar EEG/physiology/alpha/ML claims. Prime, bureaucracy is only ugly when it lies.

## Stream commands

`capture.py` sends standard classic Muse control commands used by existing open-source clients:

- `h` — halt any current stream
- `p50` — preset for EEG + PPG on classic devices by default
- `d` — resume/start streaming
- `k` — keepalive every 5s by default while streaming; protocol notes warn the headset may stop streaming without a keepalive within ~10s
- final `h` on shutdown

Use `--preset ''` to skip preset write, `--no-halt` to avoid the initial halt, or `--keepalive-interval 0` to disable keepalive.

## Output examples

Sample event:

```json
{"type":"muse.samples","cadence":"sample","sensor":"eeg","channel":"TP9","unit":"uV","sampleRate":256,"sequence":392,"samples":[...],"timestampHostNs":1780844000000000000}
```

Frame event:

```json
{"type":"muse.frame","cadence":"frame","frameHz":20,"streams":{"eeg:TP9":{...},"acc:acc":{...}}}
```

Summary event:

```json
{"type":"muse.summary","cadence":"summary","packetsSeen":512,"packetsDropped":0,"packetsDecoded":512,"packetsPerSec":102.4,"queueSize":0}
```

## Troubleshooting

- `muse.scan_miss`: headset is not advertising, asleep, too far away, or connected elsewhere.
- `BleakDeviceNotFoundError`: use the latest script; it resolves via scan before connecting.
- Empty frame spam: fixed; frame/summary tasks now start only after connect.
- WebSocket smoke: verified a client receives live JSON events during scan/capture.
- Keepalive: `k` (`02 6b 0a`) is accepted by the headset and should be sent during long-lived streaming sessions, not as a one-off lifecycle crutch.
- No packets after connect: try power-cycle, verify no phone app has grabbed it, and use `bluetoothctl info <address>` to confirm `Connected: no` before capture.
