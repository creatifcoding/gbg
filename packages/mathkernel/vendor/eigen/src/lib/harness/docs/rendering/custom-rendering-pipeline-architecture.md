# Custom Rendering Pipeline Architecture

## Goal

Transform `chat:v2/provider_marker` and related chat-v2 events into custom UI state without violating frame-time budgets.

This architecture assumes exhaustive marker coverage and supports graceful behavior under both normal and burst stream rates.

---

## 1) Event surfaces you should consume

Primary low-level feed:

- `chat:v2/provider_marker`
  - `provider:marker/start`
  - `provider:marker/text_start|text_delta|text_end`
  - `provider:marker/thinking_start|thinking_delta|thinking_end`
  - `provider:marker/toolcall_start|toolcall_delta|toolcall_end`
  - `provider:marker/done`
  - `provider:marker/error`
  - `provider:marker/unknown`

Higher-level feed (still useful):

- `chat:v2/assistant_delta`
- `chat:v2/assistant_thinking_delta`
- `chat:v2/assistant_final`
- `chat:v2/tool_event`

Use low-level markers for custom animation/partitioning; use high-level events for compatibility and fallback rendering.

---

## 2) Two-stage architecture (recommended)

## Stage A: Hot ingest (per event)

Characteristics:
- runs once per incoming event
- must stay O(1)
- no expensive parse/format work

Responsibilities:
- classify marker/tag
- append chunk to active segment buffer
- update minimal counters/timestamps
- enqueue a frame flush if not already scheduled

### Hot ingest pseudo-flow

```ts
onProviderMarker(marker) {
  // O(1) classify
  const bucket = segmentByTag(marker._tag)

  // O(1) append or tiny patch
  appendToBuffer(bucket, marker)

  // schedule one flush/frame
  if (!flushScheduled) scheduleRafFlush()
}
```

---

## Stage B: Frame flush (coalesced)

Characteristics:
- runs at most once/frame
- consumes all buffered deltas
- emits one bounded state commit

Responsibilities:
- compact buffered chunks
- apply batched view-model updates
- produce one state write (or bounded number)
- maintain stable references where possible

### Flush pseudo-flow

```ts
flushFrame() {
  const batch = takePendingBuffers()
  const patches = buildPatches(batch) // bounded work
  commitPatches(patches)              // single commit preferred
}
```

---

## 3) Deferred stage (terminal or idle)

Heavy operations should not run in Stage A:

- markdown parsing
- syntax highlighting
- semantic sectioning
- diffing against large prior snapshots

Run these when one of the following is true:

- marker is `provider:marker/text_end`
- marker is `provider:marker/done`
- idle window is available (`requestIdleCallback` or delayed task)

This makes the stream feel live while preserving rich output quality once content stabilizes.

---

## 4) Backpressure policy

When backlog depth grows (e.g., > 2 frame windows):

1. disable expensive decorators
2. skip non-essential transitions/animations
3. switch to plain text mode until backlog recovers
4. re-enable enhancements after hysteresis threshold

Backpressure mode should be explicit and observable (emit a metric/event).

---

## 5) Data structure guidance

Prefer:
- append-only arrays for chunk buffers
- map by messageId + segmentKey for active streams
- immutable commits only at flush boundary

Avoid:
- deep cloning whole transcript each event
- rebuilding final text every token
- nested object spread on every delta

---

## 6) Unknown marker handling

Never drop unknown markers silently.

For `provider:marker/unknown`:

- persist raw payload in debug lane
- count metric (`unknownMarkerCount`)
- preserve stream continuity

Unknown markers are an evolution signal; they should fail observably, not catastrophically.

---

## 7) Suggested rendering partitions

Partition by marker tag into independent lanes:

- **text lane**: `text_*`
- **thinking lane**: `thinking_*`
- **tool lane**: `toolcall_*`
- **control lane**: `start`, `done`, `error`, `unknown`

This enables selective rendering (e.g., hide/show thinking lane) without affecting text lane latency.

---

## 8) Reliability checklist

Before rollout:

- [ ] no more than one flush scheduled per frame
- [ ] all hot-path transforms measured (`p50/p95/p99`)
- [ ] unknown markers preserved and counted
- [ ] backpressure mode tested under synthetic bursts
- [ ] terminal pass correctness verified against full transcript text
