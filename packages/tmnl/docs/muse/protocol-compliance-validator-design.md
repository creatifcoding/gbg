# Muse Protocol Compliance Validator Design

Tasker: `#4671`  
Feature: `#F1290 Realize Protocol Compliance Pack`  
Depends on: `MuseSessionManifest`, `MuseMarkerEvent`, `MuseMetricPackResult`

## Purpose

The protocol compliance validator decides whether a session directory is admissible for downstream metric packs. It does **not** score EEG quality. It verifies that the session has the right paperwork, artifacts, labels, and claim boundaries.

If protocol compliance fails, downstream labeled analysis is barred. Stylish plots can wait outside.

## Inputs

Required:

- `manifest.json`
- Muse capture artifact listed by manifest, usually `muse.jsonl`
- marker artifact listed by manifest, usually `markers.jsonl`, for controlled/labeled sessions

Optional:

- `events.tsv`
- `muse_samples.csv`
- `first_order_summary.json`
- visual/report artifacts

## Output

The validator emits a `MuseMetricPackResult`:

```json
{
  "type": "muse.metric_pack_result",
  "schemaVersion": "muse-metric-pack-result/v1",
  "packId": "protocol-compliance",
  "status": "pass | warn | fail | not_applicable",
  "metrics": [],
  "thresholdEvaluations": [],
  "evidence": [],
  "caveats": [],
  "recommendations": []
}
```

It also renders Markdown via:

```bash
python scripts/muse/metric_pack_report.py protocol-compliance.result.json \
  --output protocol-compliance.report.md
```

## Validator checks

### 1. Manifest structure

- JSON parses with line diagnostics.
- `schemaVersion === muse-session-manifest/v1`.
- Required top-level fields exist.
- `sessionId`, `taskName`, `purpose`, and `interpretationBoundary` are non-empty.
- `sync.primaryClock` is recognized.
- `sync.timestampHostNsMeaning` is non-empty.
- `limitations[]` is non-empty.

Metric keys:

- `manifest.present`
- `manifest.schemaVersion.valid`
- `manifest.requiredFields.complete`
- `manifest.interpretationBoundary.present`
- `manifest.limitations.count`

### 2. Artifact inventory

For each `manifest.artifacts[]`:

- path exists unless role is explicitly future/external,
- role is recognized,
- media type is present,
- artifact clock domain matches known domains,
- required artifacts exist for claimed session type.

Required roles for any captured session:

- `session_manifest`
- `muse_jsonl`

Required roles for labeled/controlled session:

- `markers_jsonl`
- `events_tsv` or a documented reason it is absent

Metric keys:

- `artifacts.count`
- `artifacts.missing.count`
- `artifacts.required.present`
- `artifacts.role.<role>.present`

### 3. Muse capture artifact sanity

For `muse.jsonl`:

- JSONL parses line-by-line.
- Contains `muse.capture_start` and `muse.capture_stop`.
- Contains at least one `muse.samples` event for transport-bearing captures.
- `timestampHostNs` values exist for sample events.
- If `first_order_summary.json` exists, its `sessionId`/manifest association is checked when present.

Metric keys:

- `capture.lines.count`
- `capture.sampleEvents.count`
- `capture.start.present`
- `capture.stop.present`
- `capture.timestampHostNs.presentFraction`

### 4. Marker stream integrity

For `markers.jsonl` when present:

- JSONL parses line-by-line.
- Every event has `type === muse.marker`.
- `sessionId` matches manifest.
- `protocolId` matches manifest protocol.
- timestamps are monotonic.
- exactly one `session_start` exists.
- exactly one terminal marker exists: `session_end` or `abort`.
- every `block_start` has a matching `block_end` unless terminal abort occurs.
- block IDs exist in `manifest.protocol.blocks[]`.
- every cue has `blockId`, `cueId`, `repetitionIndex`.
- cue repetition indexes are monotonic within block.

Metric keys:

- `markers.count`
- `markers.sessionStart.count`
- `markers.terminal.count`
- `markers.blockStarts.count`
- `markers.blockEnds.count`
- `markers.unmatchedBlocks.count`
- `markers.unknownBlockIds.count`
- `markers.timestampMonotonic`
- `markers.cueCompleteness.fraction`

### 5. Block coverage

Given markers + capture timestamps:

- block intervals overlap capture interval,
- every required protocol block has marker coverage, unless explicitly not run,
- samples exist within each captured block,
- block durations are within tolerance of manifest duration for live conductor sessions,
- post-hoc markers are allowed but downgrade status to `warn` for controlled physiology claims.

Metric keys:

- `blocks.expected.count`
- `blocks.covered.count`
- `blocks.sampleCoverage.count`
- `blocks.durationMismatch.count`
- `markers.postHoc.count`

### 6. Events TSV readiness

For `events.tsv`:

- artifact is required for controlled/labeled sessions,
- parses as TSV,
- contains required columns:
  - `onset`
  - `duration`
  - `trial_type`
  - `value`
- should include TMNL marker export columns:
  - `block_id`
  - `cue_id`
  - `repetition_index`
  - `expected_action`
  - `expected_signal_class`
- onsets are numeric and non-negative,
- durations are numeric and non-negative,
- block IDs, when present, are known,
- event rows are consistent with marker stream within tolerance.

Metric keys:

- `eventsTsv.present`
- `eventsTsv.rows.count`
- `eventsTsv.requiredColumns.present`
- `eventsTsv.recommendedColumns.present`
- `eventsTsv.markerConsistency.fraction`

### 7. Channel metadata export readiness

- `manifest.device.channels` must be non-empty.
- Every observed Muse sample channel must be declared in `manifest.device.channels`.
- Declared-but-unobserved channels produce warnings for preset/mode review.
- If `muse_samples_csv` is declared, the CSV must include the canonical sample export columns:
  - `timestampHostNs`
  - `uuid`
  - `sensor`
  - `channel`
  - `sequence`
  - `unit`
  - `sampleRate`
  - `sampleIndex`
  - `axis`
  - `value`
- CSV channel rows must not contain channels absent from `manifest.device.channels`.

Metric keys:

- `channels.manifest.count`
- `channels.observed.count`
- `channels.missingFromManifest.count`
- `channels.declaredNotObserved.count`
- `sampleCsv.present`
- `sampleCsv.requiredColumns.present`
- `sampleCsv.channelRowsUndeclared.count`

### 8. Claim-boundary enforcement

The validator must detect and propagate claim barriers.

Hard barriers:

- no-contact baseline / no brain contact,
- missing markers for labeled analysis,
- manifest interpretation boundary forbids physiology,
- protocol IDs mismatch,
- unknown/invalid block IDs,
- session abort before required blocks.

Metric/caveat examples:

```json
{
  "severity": "critical",
  "message": "Manifest states no brain/scalp contact; physiology claims are barred.",
  "blocksClaim": true,
  "source": "manifest.interpretationBoundary"
}
```

## Threshold policies

Initial policy set:

| Policy | Kind | Status on fail | Blocks claim |
| --- | --- | --- | --- |
| `protocol.manifest.present.v1` | hard_gate | fail | yes |
| `protocol.artifacts.required_present.v1` | hard_gate | fail | yes |
| `protocol.capture.samples_present.v1` | hard_gate | fail | yes for captured sessions |
| `protocol.markers.match_manifest.v1` | hard_gate | fail | yes |
| `protocol.blocks.paired.v1` | hard_gate | fail | yes |
| `protocol.events_tsv.valid.v1` | hard_gate | fail | yes for controlled/labeled sessions |
| `protocol.channels.observed_declared.v1` | hard_gate | fail | yes |
| `protocol.channels.sample_csv_export.v1` | soft_warning / hard row check | warn/fail | yes when CSV has undeclared channels |
| `protocol.posthoc_markers.disclose.v1` | soft_warning | warn | yes for live-conductor claims |
| `protocol.no_contact.blocks_physiology.v1` | claim_boundary | fail/warn depending pack | yes |

## Status aggregation

- `fail`: manifest missing/invalid, required artifacts missing, marker/manifest mismatch, unpaired blocks, invalid protocol IDs, or hard claim barrier for attempted physiology/ML analysis.
- `warn`: post-hoc markers, missing optional sample CSV, incomplete environment notes, non-critical artifact missing.
- `pass`: required manifest/artifacts/markers/events are present and internally consistent.
- `not_applicable`: no labeled analysis attempted and validator is run only as a no-contact transport audit; must still emit claim-boundary caveats.

## CLI shape for implementation

Planned command:

```bash
python scripts/muse/validate_protocol.py \
  --session-dir /tmp/muse-session \
  --output /tmp/muse-session/metric-packs/protocol-compliance.result.json \
  --report /tmp/muse-session/metric-packs/protocol-compliance.report.md
```

Alternative:

```bash
python scripts/muse/validate_protocol.py \
  --manifest /tmp/muse-session/manifest.json
```

The implementation should infer sibling artifacts from manifest paths.

## Non-goals for v1

- Rich timeline editing.
- HED authoring.
- Full BIDS validator integration.
- Camera/pose latency validation.
- Physiological quality judgment.

Those belong to later pack analyzers or `#4644` marker timeline sophistication.

## Done criteria for implementation

`#4672` should be considered done only when:

- valid no-contact baseline emits `warn` or `not_applicable` with physiology claim blocked,
- malformed manifest fails with location diagnostics,
- missing artifact fails,
- marker session/protocol mismatch fails,
- unknown block ID fails,
- valid simple controlled marker stream passes,
- Markdown report renders via `metric_pack_report.py`.
