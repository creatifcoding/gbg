# Muse Controlled Session Manifest Schema

Canonical TS schema: `src/lib/muse/schemas.ts` → `MuseSessionManifest`  
Schema version: `muse-session-manifest/v1`

## Purpose

The session manifest prevents controlled Muse captures from degenerating into unlabeled signal soup. It records who/what/when/how, the protocol block structure, clock assumptions, artifacts, environment notes, and explicit interpretation limits.

A manifest is required before making any physiological or ML claim from a Muse capture.

## Interpretation boundary

Every manifest includes `interpretationBoundary`, a required free-text statement that says what the session can and cannot support. Example:

```text
This session supports transport and signal-quality characterization plus labeled artifact/task contrasts. It does not support clinical, diagnostic, attention, meditation, or cognitive-state claims.
```

Prime, yes, this is bureaucratic. It is also how we keep ourselves out of pseudoscience jail.

## Top-level shape

```ts
MuseSessionManifest = {
  schemaVersion: 'muse-session-manifest/v1'
  sessionId: string
  createdAt: string
  taskName: string
  purpose: string
  interpretationBoundary: string
  participant: MuseSessionParticipant
  device: MuseSessionDevice
  capture: MuseSessionCaptureConfig
  protocol: MuseSessionProtocol
  sync: MuseSessionSyncPlan
  environment: MuseSessionEnvironment
  software: MuseSessionSoftware
  artifacts: MuseSessionArtifact[]
  labelsPath?: string
  limitations: string[]
  metadata?: Record<string, unknown>
}
```

## Required sections

### `participant`

Pseudonymous participant/session identity. Avoid raw personal data.

```ts
{
  participantId: string
  anonymized: boolean
  notes?: string
}
```

### `device`

Muse hardware and protocol metadata.

```ts
{
  deviceId: string
  model: 'Muse 2' | 'Muse S' | 'Muse S Athena' | 'unknown'
  name: string
  address: string
  serviceUuid: string
  protocol: 'classic-fe8d' | 'athena-universal' | 'lsl' | 'unknown'
  firmware?: string
  channels: string[]
}
```

Current observed device:

```json
{
  "deviceId": "00:55:DA:BB:8C:66",
  "model": "Muse S",
  "name": "MuseS-8C66",
  "address": "00:55:DA:BB:8C:66",
  "serviceUuid": "0000fe8d-0000-1000-8000-00805f9b34fb",
  "protocol": "classic-fe8d",
  "channels": ["TP9", "AF7", "AF8", "TP10", "acc", "gyro", "telemetry"]
}
```

### `capture`

The exact capture process invocation and fanout paths.

```ts
{
  command: string
  outputPath: string
  csvOutputPath?: string
  wsUrl?: string
  oscTarget?: string
  cadences: MuseCadence[]
  preset?: string
  includePpg: boolean
  includeAux: boolean
  eegOnly: boolean
  keepaliveIntervalSec: number
}
```

### `protocol`

Ordered task blocks and cues. Blocks carry expected signal class so later analysis can separate artifact calibration from candidate brain-wave contrasts.

Block kinds:

- `fit_check`
- `rest`
- `eyes_open`
- `eyes_closed`
- `blink`
- `jaw_clench`
- `head_motion`
- `motion_rest`
- `cognitive_task`
- `calibration`
- `pause`
- `custom`

Expected signal classes:

- `transport_only`
- `artifact`
- `resting_state`
- `alpha_contrast_candidate`
- `motion_contamination`
- `unknown`

### `sync`

Clock strategy for aligning Muse, markers, video, pose, and future LSL/XDF streams.

```ts
{
  primaryClock: 'host_time_ns' | 'host_monotonic_ns' | 'wall_clock_iso' | 'lsl_time' | 'media_frame_time' | 'unknown'
  timestampHostNsMeaning: string
  mappings: MuseClockMapping[]
  droppedFramePolicy?: string
  limitations: string[]
}
```

The first TMNL-native version should use `host_time_ns` as primary while `capture.py` uses Python `time.time_ns()` and explicitly state that tight multimodal claims require measured camera/pose latency or LSL/XDF synchronization.

### `environment`

Required context for interpreting consumer EEG quality:

- power-line frequency when known,
- posture,
- fit notes,
- contact notes,
- location/lighting,
- operator notes.

### `artifacts`

Each output artifact is declared with role, path, media type, clock domain, optional SHA-256, and notes.

Artifact roles include:

- `muse_jsonl`
- `muse_samples_csv`
- `markers_jsonl`
- `events_tsv`
- `session_manifest`
- `camera_video`
- `camera_frame_ledger`
- `pose_jsonl`
- `sync_map`
- `first_order_report`
- `feature_table`
- `model_artifact`
- `other`

## Minimal controlled-session example

```json
{
  "schemaVersion": "muse-session-manifest/v1",
  "sessionId": "muse-20260608-001",
  "createdAt": "2026-06-08T00:00:00Z",
  "taskName": "muse-basic-artifact-alpha-protocol",
  "purpose": "Single-subject controlled Muse characterization with artifact and eyes-open/closed blocks.",
  "interpretationBoundary": "Supports transport, signal-quality, and labeled block contrasts only. Does not support clinical, diagnostic, attention, meditation, or cognitive-state claims.",
  "participant": {
    "participantId": "pseudonymous-self-001",
    "anonymized": true
  },
  "device": {
    "deviceId": "00:55:DA:BB:8C:66",
    "model": "Muse S",
    "name": "MuseS-8C66",
    "address": "00:55:DA:BB:8C:66",
    "serviceUuid": "0000fe8d-0000-1000-8000-00805f9b34fb",
    "protocol": "classic-fe8d",
    "channels": ["TP9", "AF7", "AF8", "TP10", "acc", "gyro", "telemetry"]
  },
  "capture": {
    "command": "python scripts/muse/capture.py --address 00:55:DA:BB:8C:66 --duration 0 --cadence sample,summary --output sessions/muse-20260608-001/muse.jsonl --csv-output sessions/muse-20260608-001/muse_samples.csv",
    "outputPath": "sessions/muse-20260608-001/muse.jsonl",
    "csvOutputPath": "sessions/muse-20260608-001/muse_samples.csv",
    "cadences": ["sample", "summary"],
    "preset": "p50",
    "includePpg": false,
    "includeAux": false,
    "eegOnly": false,
    "keepaliveIntervalSec": 5
  },
  "protocol": {
    "protocolId": "basic-artifact-alpha-v1",
    "title": "Basic artifact and eyes-open/closed characterization",
    "version": "1.0.0",
    "source": "TMNL Muse research ledger; consumer EEG validation paradigms",
    "blocks": [
      {
        "blockId": "fit-check",
        "kind": "fit_check",
        "label": "Fit/contact check",
        "instructions": "Adjust headset. Sit still. Record fit/contact notes before continuing.",
        "durationSec": 30,
        "expectedSignalClass": "transport_only"
      },
      {
        "blockId": "eyes-open-rest",
        "kind": "eyes_open",
        "label": "Eyes open rest",
        "instructions": "Keep eyes open and fix gaze on the marker.",
        "durationSec": 60,
        "expectedSignalClass": "alpha_contrast_candidate"
      },
      {
        "blockId": "eyes-closed-rest",
        "kind": "eyes_closed",
        "label": "Eyes closed rest",
        "instructions": "Close eyes and remain still until the cue ends.",
        "durationSec": 60,
        "expectedSignalClass": "alpha_contrast_candidate"
      },
      {
        "blockId": "blink-20x",
        "kind": "blink",
        "label": "Blink artifact calibration",
        "instructions": "Blink once on each cue.",
        "durationSec": 60,
        "expectedSignalClass": "artifact",
        "cueIntervalSec": 3,
        "repetitions": 20
      }
    ]
  },
  "sync": {
    "primaryClock": "host_time_ns",
    "timestampHostNsMeaning": "Python time.time_ns() host epoch clock at BLE notification callback or local marker emission.",
    "mappings": [],
    "limitations": [
      "No camera/pose latency calibration in minimal protocol.",
      "Host epoch timestamping is sufficient for first-order Muse analysis but not tight multimodal claims."
    ]
  },
  "environment": {
    "powerLineFrequencyHz": 60,
    "posture": "seated upright",
    "fitNotes": "to be filled at run time",
    "contactNotes": "to be filled at run time"
  },
  "software": {
    "dependencies": {}
  },
  "artifacts": [
    {
      "role": "session_manifest",
      "path": "sessions/muse-20260608-001/manifest.json",
      "mediaType": "application/json",
      "clockDomain": "host_time_ns"
    },
    {
      "role": "muse_jsonl",
      "path": "sessions/muse-20260608-001/muse.jsonl",
      "mediaType": "application/x-ndjson",
      "clockDomain": "host_time_ns"
    }
  ],
  "limitations": [
    "Consumer EEG with dry electrodes is artifact-sensitive.",
    "Single-subject session is not a population claim.",
    "No neurophysiological interpretation without first-order quality acceptance and labeled block analysis."
  ]
}
```

## Admission rule for controlled capture

A controlled session is admissible only if:

1. Manifest exists before capture starts.
2. Capture command and artifact paths match the manifest.
3. Protocol blocks and event markers use the same block IDs.
4. Environment includes fit/contact notes.
5. Sync limitations are explicit.
6. First-order analyzer can attach the manifest with `--manifest`.

