# Muse 2 Research Synthesis — connection, OSC, ingest

Date: 2026-06-07

## Executive take

Prime, no hammer yet. The Muse 2 is already *unlocked enough* for useful work via BLE. USB is not the data path for Muse 2 streaming; the micro-USB port is primarily charging and, in Muse-family documentation/forum evidence, can act as an AUX electrode input on some models — not a host-readable EEG stream.

The safest first path is:

```text
Muse 2 headset
  → BLE acquisition on this NixOS machine
  → LSL as canonical local timing spine
  → optional OSC fanout for creative tools
  → TMNL ingest over localhost WebSocket/JSON or Node LSL bridge
```

## What we know, source-grounded

### 1. Connection is BLE/GATT, not USB data

- Official Muse docs describe app setup via Bluetooth, and the SDK page says the SDK manages Bluetooth connection and data access.
- Community protocol implementations for Muse 2 all speak BLE/GATT.
- Common GATT service: `0000fe8d-0000-1000-8000-00805f9b34fb`.
- Classic Muse 2 characteristics include control `273e0001-...`, EEG `273e0003`–`273e0006`, optional AUX `273e0007`, gyro `273e0009`, accelerometer `273e000a`, telemetry `273e000b`, and PPG `273e000f`–`273e0011`.

Sources:
- `research/muse2-protocol-and-setup.md`
- https://choosemuse.com/pages/developers
- https://github.com/eugenehp/muse-rs
- https://github.com/urish/muse-js

### 2. USB is not the practical acquisition route

- I found no vendor-supported Muse 2 USB streaming protocol.
- Mind Monitor forum evidence clarifies that the USB port can be an input for an auxiliary electrode, not a data output; charging mode turns off Bluetooth.
- A Muse extra-electrode tutorial wires pin 4 / ID as an AUX sensor input, not USB serial output.

Sources:
- https://mind-monitor.com/forums0/viewtopic.php?t=767
- https://github.com/andrewjsauer/Muse-EEG-Extra-Electrode-Tutorial

### 3. OSC has precedent; LSL should still be the spine

The strongest OSC path is two-stage:

```text
muselsl or MuseLSL2 → LSL stream → muse-osc → OSC UDP
```

Recommended commands from source docs:

```bash
# Acquisition
muselsl list
muselsl stream --address YOUR_DEVICE_ADDRESS

# OSC fanout, second terminal
python -m muse_osc --host localhost --port 4545
```

OSC paths typically follow Mind Monitor/MuseIO style:

```text
/muse/eeg                  TP9 AF7 AF8 TP10 [AUX]
/muse/eeg/tp9
/muse/eeg/af7
/muse/eeg/af8
/muse/eeg/tp10
/muse/elements/alpha_absolute
/muse/elements/beta_absolute
/muse/elements/theta_absolute
/muse/elements/delta_absolute
/muse/acc
/muse/gyro
/muse/ppg
/muse/batt
```

Sources:
- `research/muse2-osc-pipelines.md`
- https://github.com/alexandrebarachant/muse-lsl
- https://github.com/DominiqueMakowski/MuseLSL2
- https://github.com/operatorequals/muse-osc
- https://mind-monitor.com/FAQ.php#oscspec

### 4. BrainFlow is the stronger normalized API if we want serious ingest

BrainFlow supports Muse 2 as `BoardIds.MUSE_2_BOARD`, accepts `mac_address` / `serial_number`, splits streams by presets, and has signal-processing utilities. This is attractive for a Python daemon that emits normalized frames.

MVP BrainFlow shape:

```python
from brainflow.board_shim import BoardShim, BrainFlowInputParams, BoardIds

params = BrainFlowInputParams()
params.mac_address = "YOUR_DEVICE_ADDRESS"
board = BoardShim(BoardIds.MUSE_2_BOARD, params)
board.prepare_session()
board.start_stream()
data = board.get_board_data()
board.stop_stream()
board.release_session()
```

Sources:
- `research/muse2-ingest-options.md`
- https://brainflow.readthedocs.io/en/stable/SupportedBoards.html
- https://brainflow.readthedocs.io/en/stable/UserAPI.html

## Local machine readiness observed

This machine is NixOS, not WSL:

```text
Linux getbyzenbook 6.18.3 ... x86_64 GNU/Linux
WSL_DISTRO_NAME=
```

Bluetooth looks ready:

```text
bluetoothctl: present
btmgmt: present
rfkill: present
bluetooth service: active
Controller: Powered yes, Roles central/peripheral
Intel Bluetooth USB adapter visible as 8087:0037
rfkill: not blocked
```

Live hardware session completed:

```text
Device: 00:55:DA:BB:8C:66 MuseS-8C66
Service: 0000fe8d-0000-1000-8000-00805f9b34fb
Protocol: classic Muse GATT characteristics, not Athena universal 273e0013
GATT map: /tmp/muse-gatt-attrs.log
Successful decoded capture: /tmp/muse-capture-keepalive-20260607-111018.jsonl
```

The capture artifact contains 1,952 decoded sample events with zero drops and zero decode errors over a keepalive-backed run. Final packet counts were EEG 1,276, gyro 265, accelerometer 265, telemetry 146.

## Recommended immediate setup path

### Phase 0 — Hardware prep

1. Fully charge Muse 2 from AC power for ~3.5h. Do not rely on the charging light alone.
2. Close Muse/Calm/Mind Monitor apps on phones/tablets nearby. Only one app can connect at a time.
3. Power on Muse 2 and put it into connectable mode near the laptop.

### Phase 1 — Scan from Linux

```bash
bluetoothctl
power on
agent on
default-agent
scan on
# wait for Muse-* device
scan off
devices
```

If found, capture either the MAC address or device name printed inside the left earpiece.

### Phase 2 — Quick LSL acquisition

Use isolated Python via `uv`, not global package mutation:

```bash
uv venv .venv-muse --python 3.12
source .venv-muse/bin/activate
uv pip install muselsl pylsl
muselsl list
muselsl stream --address YOUR_DEVICE_ADDRESS --ppg --acc --gyro
```

Second terminal:

```bash
source .venv-muse/bin/activate
muselsl view
# or record 30s
muselsl record --duration 30
```

### Phase 3 — OSC fanout

```bash
source .venv-muse/bin/activate
uv pip install python-osc git+https://github.com/operatorequals/muse-osc.git
python -m muse_osc --host 127.0.0.1 --port 4545
```

If `muse-osc` packaging is fussy, we can clone it and run from repo; small enough to patch if needed.

### Phase 4 — Direct BLE ingest MVP

For this headset/session, direct Bleak capture is now validated and is the preferred first boundary:

```text
Muse BLE/GATT
  → scripts/muse/capture.py
  → stdout JSONL + optional JSONL artifact + optional localhost WebSocket
  → TMNL floating panel ingest adapter
```

Consumer cadences:

```text
raw      BLE notification provenance + hex payload
sample   decoded EEG/ACC/GYRO/PPG/telemetry chunks
frame    UI-ready rolling snapshot at 20–60 Hz
summary  health, throughput, queue, drop, decode-error stats at ~1 Hz
```

TMNL should consume the WebSocket/NDJSON stream first, then add LSL/OSC fanout as compatibility outputs.

Canonical frame sketch:

```ts
type MuseFrame = {
  source: {
    vendor: "Interaxon"
    model: "Muse 2"
    deviceId: string
    transport: "lsl" | "brainflow" | "osc"
  }
  stream: "eeg" | "acc" | "gyro" | "ppg" | "marker" | "battery"
  sampleRate: number
  channels: readonly { name: string; unit: string; index: number }[]
  samples: readonly (readonly number[])[]
  timestamp: { host: number; device?: number }
  sequence?: number
  droppedSamples?: number
  meta?: Record<string, unknown>
}
```

## Keepalive and session lifecycle

The real operational issue was BLE session lifecycle, not packet decoding. If BlueZ has no device object / the headset is not advertising, no GATT write is possible. Once connected, the classic keepalive command is safe and accepted:

```text
Characteristic: 273e0001-4c4d-454d-96be-f03bac821358
Command:        k
Payload hex:    02 6b 0a
Interval:       every 5s while streaming, under the archived protocol's 10s warning
Observed reply: {"rc":0
```

Independent confirmation is in `tmp/muse-keepalive-researcher.md` and source references agree across muselsl, muse-js, muse-rs, and archived Muse protocol docs.

## Remaining questions / next actions

1. Verify LSL or direct CSV export as a compatibility path.
2. Verify OSC fanout path for creative tools.
3. Design the TMNL floating panel contracts around the NDJSON/WebSocket cadence stream.
4. Implement the first panel as a raw/log capture panel in the existing floating panel system, not only `/testbed`.
