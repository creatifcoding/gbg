# Muse panel suite contracts

Date: 2026-06-07
Status: design slice for Tasker #4557

## Intent

The Muse UI belongs in TMNL's floating panel workspace, not the `/testbed` registry. The first production surface is a raw/log capture panel that subscribes to the local Muse capture WebSocket and renders the event stream without owning BLE directly.

```text
Muse headset
  → scripts/muse/capture.py --ws-port 8765 --cadence raw,sample,frame,summary
  → WebSocket NDJSON events
  → Muse ingest adapter
  → stx-backed rolling panel state
  → floating panel visitor `muse:log`
```

## Existing panel integration point

- `src/lib/floating/overlay/PanelWorkspace.tsx` calls `registerAllVisitors()` at module load.
- Visitor registration uses `panelRegistry.register(visitorId, entry)` from `src/lib/floating/panel-registry.ts`.
- MorphChat registers via `src/lib/floating/visitors/morphchat-visitor.tsx`.
- New panels should follow that visitor pattern, then spawn with `spawnPanel('muse:log', { mode: 'floating' })`.

## Visitor IDs

| Visitor ID | Purpose | State tier | First task |
| --- | --- | --- | --- |
| `muse:log` | Raw/log capture panel for NDJSON events | `full` | #4558 |
| `muse:channels` | Channel monitor for EEG/ACC/GYRO/telemetry frames | `full` | later |
| `muse:health` | Throughput, drops, decode errors, keepalive status | `full` | later |

`stateTier: 'full'` is required because WebSocket/live stream panels must not be virtualized away during layout operations.

## Event contract

Canonical TypeScript schema lives in `src/lib/muse/schemas.ts`. It mirrors the Python capture events and is the only shape the panel should accept.

Cadences:

- `raw` → `muse.packet`: BLE UUID, sensor/channel name, byte length, payload hex.
- `sample` → `muse.samples`: decoded chunks for EEG, accelerometer, gyroscope, PPG, telemetry.
- `frame` → `muse.frame`: low-rate UI snapshot keyed by `sensor:channel`.
- `summary` → lifecycle, scan, connection, keepalive, throughput, decode errors.

Key lifecycle events:

- `muse.ws_listening`
- `muse.capture_start`
- `muse.scan_start`
- `muse.scan_hit`
- `muse.scan_miss`
- `muse.connected`
- `muse.keepalive`
- `muse.summary`
- `muse.decode_error`
- `muse.capture_stop`

## State shape

The ingest adapter should be panel-scoped and stx-backed. No React `useState` soup for the stream buffer.

Suggested data shape:

```ts
type MusePanelData = {
  url: string
  status: 'idle' | 'connecting' | 'connected' | 'closed' | 'error'
  events: MuseEvent[]              // bounded rolling buffer
  lastSummary: MuseSummaryEvent | null
  lastFrame: MuseFrameEvent | null
  countsByType: Record<string, number>
  countsByChannel: Record<string, number>
  error: string | null
}
```

Retention defaults:

- raw/log event buffer: 1,000 lines
- frame retention: latest only
- summary retention: latest only plus counters
- dropped UI events should be counted locally if the browser buffer is saturated

## Panel behavior

Initial `muse:log` panel should provide:

1. Connection controls: URL input, connect/disconnect, status pill.
2. Event filters: `raw`, `sample`, `frame`, `summary`, errors-only toggle.
3. Streaming log viewport: newest at bottom, monospace, minimum text size `12px`.
4. Health strip: packets/sec, decoded, dropped, errors, queue size, last keepalive time.
5. Copy/export selected visible lines.

Do not render waveform charts in the first pass. Prime asked for “print the shit to a panel”; honor the requirement before chasing oscilloscope glamour.

## Boundaries

- Python owns BLE, keepalive, decoding, optional capture artifact.
- TMNL owns validation, state, display, and future commands to launch/stop local capture.
- LSL/OSC are fanout tasks after the direct WebSocket stream is stable.
- No firmware, reset, or undocumented control commands in panel code.

## Next implementation tasks

1. #4559 — build local ingest adapter over WebSocket NDJSON with `MuseEvent` validation.
2. #4558 — register `muse:log` visitor and render the first raw/log panel.
3. Add a spawn affordance in the panel palette/sidebar once the visitor exists.
