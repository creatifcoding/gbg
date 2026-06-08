# Muse Event Marker Strategy

Tasker: `#4600`  
Canonical event schema: `src/lib/muse/schemas.ts` → `MuseMarkerEvent`  
Related protocol: `docs/muse/basic-artifact-alpha-protocol-v1.md`

## Purpose

Markers are the segmentation spine for controlled Muse experiments. Every later operation — first-order segment reports, artifact heuristics, FFT windows, pose alignment, BIDS `events.tsv`, and ML labels — depends on marker integrity.

If an analysis window cannot be traced to marker events, it is exploratory only.

## Canonical marker event

Marker events are normal TMNL/Muse JSON events with `type: "muse.marker"` and `cadence: "marker"`.

```ts
MuseMarkerEvent = {
  type: 'muse.marker'
  cadence: 'marker'
  timestampHostNs: number
  timestampWallIso?: string
  sessionId: string
  protocolId: string
  markerKind:
    | 'session_start'
    | 'session_end'
    | 'block_start'
    | 'block_end'
    | 'cue_onset'
    | 'cue_offset'
    | 'annotation'
    | 'pause'
    | 'resume'
    | 'abort'
  eventCode: string
  label: string
  blockId?: string
  cueId?: string
  repetitionIndex?: number
  expectedAction?: string
  expectedSignalClass?: MuseExpectedSignalClass
  clockDomain: MuseExperimentClockDomain
  source: 'tmnl-conductor' | 'manual' | 'external' | 'unknown'
  metadata?: Record<string, unknown>
}
```

## Clock rule

For v1, marker `timestampHostNs` must use the same host timestamp domain as Muse capture events whenever marker emission is local to TMNL/Python. `capture.py` currently uses Python `time.time_ns()`, i.e. nanoseconds since the Unix epoch, so the manifest should use `host_time_ns` unless a future conductor explicitly switches both capture and markers to `time.monotonic_ns()`. The manifest `sync.timestampHostNsMeaning` must state the exact clock source.

Initial rule:

```text
Use host_time_ns for Muse samples and TMNL marker emission because capture.py uses Python time.time_ns(). If camera/pose streams are added, record their frame timestamps and latency limitations explicitly until LSL/XDF or measured clock mapping exists.
```

## Required marker lifecycle

Every controlled session emits:

1. `session_start`
2. `block_start` for each protocol block
3. `cue_onset` / `cue_offset` for cued repetitions
4. `block_end` for each protocol block
5. `session_end`

Abort/pause/resume must also be explicit markers, not comments in a notebook.

## Event code naming

Use uppercase, stable, analysis-friendly codes:

| Marker | Pattern | Example |
| --- | --- | --- |
| Session start | `SESSION_START` | `SESSION_START` |
| Session end | `SESSION_END` | `SESSION_END` |
| Block start | `BLOCK_<BLOCK_ID>_START` | `BLOCK_BLINK_TASK_20X_START` |
| Block end | `BLOCK_<BLOCK_ID>_END` | `BLOCK_BLINK_TASK_20X_END` |
| Cue onset | `CUE_<ACTION>_<NNN>_ONSET` | `CUE_BLINK_001_ONSET` |
| Cue offset | `CUE_<ACTION>_<NNN>_OFFSET` | `CUE_BLINK_001_OFFSET` |
| Manual note | `ANNOTATION_<SHORT_LABEL>` | `ANNOTATION_FIT_ADJUSTED` |
| Abort | `SESSION_ABORT` or `BLOCK_<BLOCK_ID>_ABORT` | `BLOCK_HEAD_OPEN_TASK_20X_ABORT` |

Normalize block IDs for codes by uppercasing and replacing non-alphanumeric runs with `_`.

## Segmentation semantics

### Block intervals

A block interval is:

```text
[block_start.timestampHostNs, block_end.timestampHostNs)
```

The end is exclusive. If `block_end` is missing, the block is incomplete and must be flagged.

### Cue intervals

A cue interval is:

```text
[cue_onset.timestampHostNs, cue_offset.timestampHostNs)
```

If no explicit `cue_offset` is emitted, the conductor must synthesize one from protocol cue duration and mark it with `source: "tmnl-conductor"` plus `metadata.synthetic = true`.

### Pre/post rest intervals

Pre-rest and post-rest are explicit blocks, not metadata on a task block. This avoids implicit segmentation and makes BIDS export straightforward.

## BIDS `events.tsv` mapping

Marker events map cleanly to BIDS-style event rows:

| BIDS column | Source |
| --- | --- |
| `onset` | marker timestamp converted relative to session start |
| `duration` | block/cue interval duration |
| `trial_type` | `markerKind` or protocol block kind |
| `value` | `eventCode` |
| `sample` | optional later mapping to nearest Muse sample index |
| `block_id` | `blockId` |
| `cue_id` | `cueId` |
| `repetition_index` | `repetitionIndex` |
| `expected_action` | `expectedAction` |
| `expected_signal_class` | `expectedSignalClass` |

Do not throw marker metadata away during TSV export; preserve a richer JSONL marker stream as the canonical source.

## Example marker sequence

```jsonl
{"type":"muse.marker","cadence":"marker","timestampHostNs":1000000000,"timestampWallIso":"2026-06-08T00:00:00Z","sessionId":"muse-20260608-001","protocolId":"basic-artifact-alpha-v1","markerKind":"session_start","eventCode":"SESSION_START","label":"Session start","clockDomain":"host_time_ns","source":"tmnl-conductor"}
{"type":"muse.marker","cadence":"marker","timestampHostNs":2000000000,"sessionId":"muse-20260608-001","protocolId":"basic-artifact-alpha-v1","markerKind":"block_start","eventCode":"BLOCK_BLINK_TASK_20X_START","label":"Blink task start","blockId":"blink-task-20x","expectedSignalClass":"artifact","clockDomain":"host_time_ns","source":"tmnl-conductor"}
{"type":"muse.marker","cadence":"marker","timestampHostNs":3000000000,"sessionId":"muse-20260608-001","protocolId":"basic-artifact-alpha-v1","markerKind":"cue_onset","eventCode":"CUE_BLINK_001_ONSET","label":"Blink cue 1","blockId":"blink-task-20x","cueId":"blink-001","repetitionIndex":1,"expectedAction":"blink_once","expectedSignalClass":"artifact","clockDomain":"host_time_ns","source":"tmnl-conductor"}
{"type":"muse.marker","cadence":"marker","timestampHostNs":3250000000,"sessionId":"muse-20260608-001","protocolId":"basic-artifact-alpha-v1","markerKind":"cue_offset","eventCode":"CUE_BLINK_001_OFFSET","label":"Blink cue 1 offset","blockId":"blink-task-20x","cueId":"blink-001","repetitionIndex":1,"expectedAction":"blink_once","expectedSignalClass":"artifact","clockDomain":"host_time_ns","source":"tmnl-conductor"}
```

## Integrity checks

A marker stream is admissible only if:

- exactly one `session_start` exists,
- exactly one terminal marker exists: `session_end` or `abort`,
- every `block_start` has a matching `block_end` unless session aborts,
- every cue has `blockId`, `cueId`, and `repetitionIndex`,
- cue repetition indexes are monotonic within a block,
- marker timestamps are monotonic except explicitly documented manual/external corrections,
- all block IDs exist in the session manifest protocol,
- marker `sessionId` and `protocolId` match the manifest.

## Analysis admission rules

- First-order full-session reports may run with only Muse samples.
- Protocol-aware reports require block markers.
- Artifact calibration reports require cue markers.
- Eyes-open/closed alpha-candidate reports require block markers plus first-order quality acceptance.
- ML feature tables require marker integrity checks to pass; failed marker integrity means no supervised labels.

## Conductor implementation notes

- Emit markers before UI/audio cues when possible; record cue-render latency in metadata if known.
- Use stable block IDs from the protocol document and manifest.
- Write marker JSONL as its own artifact and optionally mirror markers onto the WebSocket stream.
- Never rely on browser animation timing alone for marker timestamps; capture the conductor-side timestamp at emission.
- Manual annotations are allowed but must be clearly marked with `source: "manual"`.
