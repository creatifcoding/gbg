# IQ Corpus Protocol

FRKNK stores IQ captures as a tiny two-file pair:

```text
<capture-id>.c64.json   # metadata, labels, provenance
<capture-id>.c64        # little-endian complex64 IQ samples
```

Why this shape:

- raw complex64 is directly usable from NumPy, GNU Radio-style tools, and simple UDP feeders;
- JSON metadata stays inspectable and mirrors the TypeScript/Pydantic contract layer;
- no HDF5/Zarr dependency in cycle 1;
- recorded IQ and synthetic fixtures share one convention.

## Directory layout

```text
experiments/sdr-lab/data/
├── generated/          # deterministic synthetic fixtures, reproducible from metadata
├── raw/                # user-provided or receiver-recorded IQ; gitignored
└── derived/            # sketch tiles, reports, candidate outputs; gitignored by default
```

Large IQ payloads are not committed. Metadata examples can be committed when useful.

## Capture metadata

The metadata sidecar is the canonical index. Field names are camelCase to match the
TypeScript contracts.

```json
{
  "_tag": "IQCaptureMetadata",
  "captureId": "synthetic-cw-0001",
  "sourceId": "synthetic/noise-plus-tone",
  "sampleFormat": "complex64-le",
  "sampleRateHz": 48000,
  "centerFrequencyHz": 7100000,
  "sampleCount": 48000,
  "durationSeconds": 1,
  "createdAtUnixMs": 1779700000000,
  "iqPath": "synthetic-cw-0001.c64",
  "generator": {
    "kind": "synthetic.noise_plus_tone",
    "seed": 7,
    "toneOffsetHz": 1200,
    "snrDb": -6
  },
  "labels": [
    {
      "labelId": "label-cw-0001",
      "classLabel": "carrier",
      "timeRange": { "startSeconds": 0, "endSeconds": 1 },
      "frequencyRangeHz": { "lowHz": 7100825, "highHz": 7101575 },
      "confidence": 1,
      "source": "synthetic"
    }
  ],
  "notes": ["Deterministic first smoke fixture."]
}
```

## Sample format

`complex64-le` means:

```text
float32 little-endian I0
float32 little-endian Q0
float32 little-endian I1
float32 little-endian Q1
...
```

In NumPy, this is `dtype='<c8'`.

## Label semantics

Labels are verifier/evaluation truth, not sketch output. A `SignalCandidate` is considered a
hit when its time/frequency region overlaps a label sufficiently under the evaluator's IoU
threshold.

Minimum label fields:

- `classLabel`: broad RF class, same enum as `SignalCandidate.classLabel`;
- `timeRange`: seconds from capture start;
- `frequencyRangeHz`: absolute RF Hz, not offset;
- `confidence`: label confidence/provenance confidence, not model confidence;
- `source`: `synthetic`, `manual`, `imported`, or `verifier`.

## First-cycle rules

1. Synthetic fixtures must be reproducible from `generator` metadata.
2. Recorded fixtures must preserve original `centerFrequencyHz`, `sampleRateHz`, and `sampleFormat`.
3. Sketch outputs reference `captureId` / `frameId`; they do not mutate corpus metadata.
4. Corpus files are append-only during evaluation runs. Regenerate into a new `captureId` if parameters change.
5. Anything under `data/raw` and `data/derived` is local/operator-owned unless explicitly promoted.
