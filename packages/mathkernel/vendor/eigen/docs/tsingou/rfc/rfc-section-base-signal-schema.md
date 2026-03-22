# TSG.8 BaseSignal Schema

```
Section:    TSG.8
Title:      BaseSignal Schema
Status:     DRAFT
Created:    2026-02-18
Authors:    architecture-reviewer (arch-reviewer agent)
Part:       II — Architecture (Normative)
Depends:    TSG.7 (Signal Pipeline), TSG.6 (Architecture Overview)
Feeds:      TSG.9 (Source Adapters), TSG.12 (STIX Data Model), TSG.13 (STIX Codec)
```

---

## TSG.8.1 Introduction

### TSG.8.1.1 Purpose

This section specifies the BaseSignal schema — the universal data contract for all signals entering, traversing, and exiting the Tsingou pipeline. Every signal, regardless of source adapter, transport mechanism, or payload content, conforms to this schema. BaseSignal is the atomic unit of the Tsingou data model.

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC2119] and [RFC8174].

### TSG.8.1.2 Scope

This section covers:

1. **Branded identity types** — Compile-time type safety for identifiers (TSG.8.2)
2. **Version tuple** — Multi-dimensional versioning for d2ts partial ordering (TSG.8.3)
3. **Signal kind discriminator** — Schema dispatch mechanism (TSG.8.4)
4. **BaseSignal core schema** — Universal signal contract (TSG.8.5)
5. **Source-specific extensions** — 8 typed signal variants (TSG.8.6)
6. **Signal union** — Discriminated union semantics (TSG.8.7)
7. **Schema registry** — Runtime registration of dynamic signal types (TSG.8.8)
8. **Adapter operational schemas** — Health, status, error, lifecycle (TSG.8.9)
9. **Validation pipeline** — Schema enforcement at ingestion boundary (TSG.8.10)
10. **Encoding and serialization** — JSON Schema generation and codec behavior (TSG.8.11)
11. **STIX interoperability** — Mapping BaseSignal to STIX 2.1 objects (TSG.8.12)

### TSG.8.1.3 Design Philosophy

The BaseSignal schema is designed around four principles:

| Principle | Description | Enforcement |
|-----------|-------------|-------------|
| **Schema-first** | All domain types are Effect Schema, never raw TypeScript interfaces | Compiler + runtime validation |
| **Extension by composition** | Source-specific signals use `Schema.extend(BaseSignal, ...)` | Type-level guarantee |
| **Branded identifiers** | String types carry compile-time brands preventing misuse | `Schema.brand()` |
| **Open-closed** | Known kinds are compile-time literals; unknown kinds validated at runtime via registry | `Schema.Union(KnownSignalKind, Schema.String)` |

These principles ensure that every signal in the system is structurally validated at the ingestion boundary, carries type-safe identifiers that prevent cross-type confusion, and supports extensibility without schema modification.

### TSG.8.1.4 Semantic Clarification: "Signal" as Intelligence Datum

The term "signal" in `BaseSignal` refers to a **Level 3 intelligence datum** — a
structured piece of actionable information — not a Level 1 electromagnetic
waveform or a Level 2 DSP sample sequence. This distinction is established
normatively in TSG.1.2.6 (Signal Taxonomy and the SIGINT Processing Hierarchy).

A `BaseSignal` is a **polymorphic message envelope** with:

- A unique identity (`SignalId`)
- Source attribution (`SourceId`)
- Temporal ordering (`timestamp` + `SignalVersion` for d2ts partial ordering)
- Schema dispatch (`kind` discriminator)
- Typed payload (extended per source via `Schema.extend`)
- Optional metadata bag

This envelope design is intentionally agnostic to the intelligence discipline
that produced the data. An RSS threat feed entry, a STIX indicator, a NATS
sensor reading, and an SDR emitter detection event all conform to the same
schema. The `kind` discriminator and typed `payload` extension carry the
discipline-specific semantics; the envelope carries the universal pipeline
semantics (identity, ordering, routing).

**What BaseSignal is NOT:**

| Misconception | Reality |
|---------------|---------|
| An IQ sample buffer | IQ samples are Level 1 data; BaseSignal carries Level 3 detection event metadata |
| A DSP sample frame | DSP frames are Level 2 data; BaseSignal carries processed analytical products |
| A raw RF capture | Raw captures are archived in SigMF format by the collection sidecar; BaseSignal references them via `sigmfRecordingRef` |
| A waveform container | Waveform data flows through dedicated Level 1–2 pipelines (GNU Radio, Rust DSP); BaseSignal receives the output |

Implementations MUST NOT attempt to serialize raw sample data (`Float32Array`,
`Int16Array`, binary IQ captures) into the `payload` field. The d2ts
differential dataflow pipeline operates on JSON-serialized `MultiSet`
collections with version tracking — a data model designed for KB-scale
intelligence datums, not MB-scale sample buffers.

When integrating with SDR systems, the collection/processing sidecar (Level 1–2)
performs demodulation, feature extraction, and emitter characterization, then
publishes **detection events** as `BaseSignal` envelopes via NATS. See TSG.17
(GNU Radio Bridge) and TSG.1.2.6.6 (Future Level 1–2 Integration) for the
normative sidecar architecture.

### TSG.8.1.5 Effect Schema Foundation

Tsingou uses Effect Schema [EFFECT-SCHEMA] as the sole schema technology. Effect Schema provides:

- **Runtime validation** — `Schema.decodeUnknown(BaseSignal)(data)` returns `Effect<BaseSignal, ParseError>`
- **Encode/decode transformations** — `DateFromSelf`, `Uint8ArrayFromSelf` handle non-JSON-native types
- **JSON Schema generation** — `JSONSchema.make(BaseSignal)` produces compliant JSON Schema output
- **TypeScript type derivation** — `typeof BaseSignal.Type` extracts the TypeScript type
- **Composition** — `Schema.extend()`, `Schema.Union()`, `Schema.Struct()` compose algebraically

Raw TypeScript `interface` and `type` declarations MUST NOT be used for domain types that enter the signal pipeline. All such types MUST be defined as Effect Schema values.

---

## TSG.8.2 Branded Identity Types

### TSG.8.2.1 Rationale

Signal processing systems frequently pass string identifiers between functions. Without branded types, a `sourceId` can be accidentally assigned to a `signalId` parameter — the TypeScript compiler accepts both as `string`. Branded types prevent this class of error at compile time.

Tsingou defines three branded identity types using `Schema.brand()`:

### TSG.8.2.2 SignalId

```typescript
export const SignalId = Schema.String.pipe(
  Schema.brand('SignalId'),
  Schema.minLength(1),
)
export type SignalId = typeof SignalId.Type
```

**Semantics:**

| Property | Value |
|----------|-------|
| Underlying type | `string` |
| Brand | `SignalId` |
| Constraint | `minLength(1)` — empty strings are rejected |
| Uniqueness | One per ingestion event — every signal gets exactly one |
| Generation | Created by the adapter at signal construction time |
| Lifetime | Immutable once assigned — persists through pipeline, JetStream, rendering |
| Format recommendation | UUID v4 or `sig_${nanoid()}` — implementations choose |

**Usage constraints:**

- A `SignalId` MUST NOT be reused across different signals.
- A `SignalId` MUST NOT be empty.
- A `SignalId` MUST be assigned at signal construction time, before the signal enters the SignalQueue.
- Functions accepting `SignalId` parameters MUST NOT accept unbranded `string` values.

### TSG.8.2.3 SourceId

```typescript
export const SourceId = Schema.String.pipe(
  Schema.brand('SourceId'),
  Schema.minLength(1),
)
export type SourceId = typeof SourceId.Type
```

**Semantics:**

| Property | Value |
|----------|-------|
| Underlying type | `string` |
| Brand | `SourceId` |
| Constraint | `minLength(1)` |
| Stability | Stable across reconnections — identifies the *logical* source |
| Assignment | Configured per adapter at registration time |
| Examples | `"nats-threat-intel"`, `"http-rss-bbc"`, `"serial-sdr-1"` |

**Usage constraints:**

- A `SourceId` MUST identify a logical signal source, not a physical connection.
- When an adapter reconnects to the same source, it MUST use the same `SourceId`.
- Two adapters connected to different sources MUST NOT share a `SourceId`.
- `SourceId` is used as a dimension in d2ts version partial ordering (TSG.8.3).

### TSG.8.2.4 SessionId

```typescript
export const SessionId = Schema.String.pipe(
  Schema.brand('SessionId'),
  Schema.minLength(1),
)
export type SessionId = typeof SessionId.Type
```

**Semantics:**

| Property | Value |
|----------|-------|
| Underlying type | `string` |
| Brand | `SessionId` |
| Constraint | `minLength(1)` |
| Scope | Identifies an analysis workspace/session |
| Lifetime | Created when user opens a session, destroyed when session closes |
| Persistence | Stored in NATS KV bucket `tsingou-sessions` |

### TSG.8.2.5 Brand Safety Guarantees

The following code demonstrates the compile-time protection provided by branded types:

```typescript
const signalId: SignalId = 'sig_abc123' as SignalId
const sourceId: SourceId = 'nats-source-1' as SourceId

// ✓ Correct usage
function findSignal(id: SignalId): Effect.Effect<BaseSignal> { ... }
findSignal(signalId)   // Compiles

// ✗ Compile error — SourceId is not assignable to SignalId
findSignal(sourceId)   // Type error: SourceId not assignable

// ✗ Compile error — plain string is not assignable to SignalId
findSignal('raw-string')  // Type error: string not assignable
```

The brand is erased at runtime — the value is still a plain JavaScript string. The protection is purely compile-time. However, the `Schema.minLength(1)` constraint IS enforced at runtime during `Schema.decodeUnknown()`.

### TSG.8.2.6 Branded Type Summary

| Type | Brand | Runtime Constraint | Purpose |
|------|-------|--------------------|---------|
| `SignalId` | `'SignalId'` | `minLength(1)` | Unique signal identifier |
| `SourceId` | `'SourceId'` | `minLength(1)` | Logical source identifier |
| `SessionId` | `'SessionId'` | `minLength(1)` | Analysis workspace identifier |

---

## TSG.8.3 Version Tuple

### TSG.8.3.1 Multi-Dimensional Versioning

Tsingou uses a 2-dimensional version tuple for d2ts differential dataflow [D2TS] partial ordering:

```typescript
export const SignalVersion = Schema.Tuple(
  Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
)
export type SignalVersion = typeof SignalVersion.Type
// Type: readonly [number, number]
```

### TSG.8.3.2 Dimension Semantics

| Dimension | Index | Name | Semantics | Advancement |
|-----------|-------|------|-----------|-------------|
| 0 | `TICK_DIM` | Global tick | Monotonically increasing per TsingouFlow processing cycle | `advanceTick([t, s]) → [t+1, s]` |
| 1 | `SOURCE_DIM` | Source sequence | Per-source monotonic counter — independent per adapter | `advanceSource([t, s]) → [t, s+1]` |

### TSG.8.3.3 Partial Order

Two versions `a` and `b` are compared element-wise across both dimensions:

```
a ≤ b  iff  a[0] ≤ b[0]  AND  a[1] ≤ b[1]
a < b  iff  a ≤ b  AND  a ≠ b
```

When neither `a ≤ b` nor `b ≤ a`, the versions are **concurrent** (incomparable). This occurs when signals from different sources arrive at different ticks.

The comparison function (verified from `graph/version.ts:79-90`):

```typescript
export const compareVersions = (
  a: [number, number],
  b: [number, number],
): -1 | 0 | 1 | null => {
  const tickCmp = Math.sign(a[TICK_DIM] - b[TICK_DIM])
  const srcCmp = Math.sign(a[SOURCE_DIM] - b[SOURCE_DIM])

  if (tickCmp === 0 && srcCmp === 0) return 0    // equal
  if (tickCmp <= 0 && srcCmp <= 0) return -1      // a < b
  if (tickCmp >= 0 && srcCmp >= 0) return 1       // a > b
  return null  // concurrent / incomparable
}
```

### TSG.8.3.4 Version Lifecycle

```
Signal Created by Adapter
  │
  ├── sourceSeq = adapter's local counter (incremented per signal)
  ├── tick = 0 (placeholder — set by TsingouFlow on drain)
  │
  ▼
SignalQueue (bounded, backpressure)
  │
  ▼
TsingouFlow Processing Cycle
  │
  ├── tick = currentTick (global processing cycle number)
  ├── sourceSeq = preserved from adapter
  │
  ▼
d2ts Graph (ingest → derived)
  │
  ├── Version determines partial order for joins, windows, aggregations
  │
  ▼
OutputBridge → Atoms → Rendering
```

### TSG.8.3.5 Version Helper Functions

The `graph/version.ts` module (91 lines, verified) provides utility functions:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `makeVersion` | `(tick, sourceSeq) → [number, number]` | Construct a version tuple |
| `initialVersion` | `() → [0, 0]` | Create the zero version |
| `advanceTick` | `(v) → [v[0]+1, v[1]]` | Increment global tick |
| `advanceSource` | `(v) → [v[0], v[1]+1]` | Increment source sequence |
| `getTick` | `(v) → number` | Extract tick component |
| `getSourceSeq` | `(v) → number` | Extract source sequence |
| `compareVersions` | `(a, b) → -1 \| 0 \| 1 \| null` | Partial order comparison |

### TSG.8.3.6 Design Rationale

The two-dimensional version enables **independent source advancement** without global synchronization:

```
Source A:  [1,0]  [2,1]  [3,2]  [4,3]
Source B:  [1,0]  [1,1]  [2,2]  [3,3]  [4,4]
                   ↑
                   Concurrent: [2,1] vs [1,1]
                   Neither dominates — processed independently
```

This is critical for SIGINT analysis where sources operate at different frequencies (a 1Hz RSS poller vs a 10kHz serial sensor). Without partial ordering, the slow source would block the fast source. With it, both advance independently, and d2ts handles the join semantics when correlation is requested.

### TSG.8.3.7 Version Constraints

- Both dimensions MUST be non-negative integers.
- The tick dimension MUST be monotonically non-decreasing within a processing session.
- The source sequence MUST be monotonically increasing per source adapter.
- Version `[0, 0]` is reserved as the initial version.

---

## TSG.8.4 Signal Kind Discriminator

### TSG.8.4.1 Known Signal Kinds

The `kind` field is the primary discriminator for schema dispatch. Eight signal kinds are known at compile time:

```typescript
export const KnownSignalKind = Schema.Literal(
  'midi',
  'osc',
  'nats',
  'http',
  'serial',
  'rss',
  'websocket',
  'file-watch',
)
export type KnownSignalKind = typeof KnownSignalKind.Type
```

### TSG.8.4.2 Open-Closed Kind System

The `SignalKind` type is the union of known kinds and arbitrary strings:

```typescript
export const SignalKind = Schema.Union(KnownSignalKind, Schema.String)
export type SignalKind = typeof SignalKind.Type
```

This design follows the open-closed principle:

- **Closed for known kinds** — The 8 known kinds have compile-time typed extension schemas. Pattern matching on `signal.kind` provides exhaustive checking for these 8 cases.
- **Open for custom kinds** — Any string is accepted as a signal kind. Custom kinds are validated at runtime via the schema registry (TSG.8.8).

### TSG.8.4.3 Schema Dispatch

When a signal enters the pipeline, the `kind` field determines which schema is used for validation:

```
Signal arrives with kind = K
  │
  ├── K ∈ KnownSignalKind?
  │   ├── YES → Validate against compile-time extension schema
  │   │         (e.g., kind='midi' → MidiSignal schema)
  │   │
  │   └── NO  → K is a custom kind
  │             ├── Lookup K in SchemaRegistry (NATS KV)
  │             │   ├── FOUND → Validate payload against registered JSON Schema
  │             │   └── NOT FOUND → Reject signal with SchemaValidationError
  │             │
  │             └── (Alternatively: accept with BaseSignal validation only,
  │                  if permissive mode is configured)
  │
  ▼
Validated signal enters d2ts graph
```

### TSG.8.4.4 Kind Naming Convention

| Constraint | Rule | Example |
|------------|------|---------|
| Format | Lowercase, hyphen-separated | `file-watch`, `custom-sensor` |
| Length | 1-64 characters | Enforced by registry, not BaseSignal |
| Characters | `[a-z0-9-]` | No underscores, dots, or uppercase |
| Reserved prefix | `_` prefix reserved for internal system kinds | `_diagnostic`, `_heartbeat` |
| STIX prefix | `stix-` prefix recommended for STIX-derived kinds | `stix-indicator`, `stix-observed-data` |

### TSG.8.4.5 Kind-to-Adapter Mapping

Each known signal kind maps to exactly one source adapter type:

| Kind | Adapter | Transport | Frequency Range |
|------|---------|-----------|----------------|
| `midi` | `MidiAdapter` (stub) | Web MIDI API / node-midi | Event-driven, 0-1kHz |
| `osc` | `OscAdapter` (stub) | UDP | Event-driven, 0-10kHz |
| `nats` | `NatsSourceAdapter` | NATS JetStream | 0-100kHz+ |
| `http` | `HttpSourceAdapter` | HTTP poll / SSE / long-poll / webhook | 0.01-100Hz |
| `serial` | `SerialAdapter` | USB/UART | 9600-115200 baud |
| `rss` | `RssSourceAdapter` | HTTP GET (periodic poll) | 0.001-0.1Hz |
| `websocket` | `WebSocketSourceAdapter` | WebSocket | 0-10kHz |
| `file-watch` | `FileWatchAdapter` | Filesystem events | Event-driven |

---

## TSG.8.5 BaseSignal Core Schema

### TSG.8.5.1 Schema Definition

The BaseSignal schema is the universal contract for all signals (verified from `schemas/base-signal.ts:134-158`):

```typescript
export const BaseSignal = Schema.Struct({
  /** Unique signal identifier (generated at ingestion) */
  id: SignalId,

  /** Logical source identifier (stable across reconnections) */
  sourceId: SourceId,

  /** When the signal was produced (source-side timestamp) */
  timestamp: Schema.DateFromSelf,

  /** d2ts multi-dimensional version [tick, source_seq] */
  version: SignalVersion,

  /** Discriminator for schema dispatch and registry lookup */
  kind: SignalKind,

  /** Signal payload — typed by source-specific extensions */
  payload: Schema.Unknown,

  /** Optional metadata bag for adapter-specific context */
  metadata: Schema.optional(SignalMetadata),
})

export type BaseSignal = typeof BaseSignal.Type
export type BaseSignalEncoded = typeof BaseSignal.Encoded
```

### TSG.8.5.2 Field Specification

| Field | Schema Type | Required | Description |
|-------|-------------|----------|-------------|
| `id` | `SignalId` (branded string) | REQUIRED | Unique identifier, one per signal, immutable after creation |
| `sourceId` | `SourceId` (branded string) | REQUIRED | Logical source — stable across reconnections |
| `timestamp` | `Schema.DateFromSelf` | REQUIRED | Source-side production timestamp. Uses `DateFromSelf` for in-memory `Date` objects; serialized as ISO 8601 string |
| `version` | `SignalVersion` (tuple `[number, number]`) | REQUIRED | d2ts multi-dimensional version `[tick, source_seq]` |
| `kind` | `SignalKind` (union of known literals + string) | REQUIRED | Discriminator for schema dispatch |
| `payload` | `Schema.Unknown` | REQUIRED | Signal data — typed by extension schemas for known kinds, validated by registry for custom kinds |
| `metadata` | `SignalMetadata` (Record<string, unknown>) | OPTIONAL | Adapter-specific key-value context bag |

### TSG.8.5.3 Field Semantics: Detailed

#### `id` (SignalId)

The signal identifier is the primary key for the signal across the entire system. It is used:

- As the key in `activeSignalsAtom` for O(1) lookups
- As the selection key in `selectedSignalIdsAtom` for cross-layer coordination
- As the deduplication key in JetStream replay (TSG.8.3.4)
- As the correlation key for d2ts join operators

Implementations MUST generate the `id` at signal construction time within the adapter. The `id` MUST NOT be generated lazily or assigned after the signal enters the queue.

#### `sourceId` (SourceId)

The source identifier enables:

- Per-source filtering in the rendering layers
- Per-source sequence numbering in the version tuple
- Adapter health correlation (which source produced which errors)
- Source-specific schema dispatch in the registry

#### `timestamp` (DateFromSelf)

The timestamp represents when the signal was **produced** at the source, not when it was **ingested** by Tsingou. For sources that provide timestamps (NATS server timestamps, RSS pubDate, HTTP Date headers), the adapter SHOULD use the source-provided timestamp. For sources without timestamps (serial, MIDI), the adapter MUST use the local system time at reception.

`Schema.DateFromSelf` is used because signals are constructed in-memory as JavaScript `Date` objects. When serialized to JSON (e.g., for NATS JetStream), the `Date` is encoded as an ISO 8601 string. When decoded, the ISO 8601 string is parsed back to a `Date` object.

#### `payload` (Unknown)

The payload is `Schema.Unknown` in the BaseSignal definition. This is intentional: the BaseSignal does not constrain payload structure. Extension schemas (TSG.8.6) narrow the payload type for each known kind. Custom kinds validate payloads through the schema registry (TSG.8.8).

This design enables:

- BaseSignal validation without knowing the payload schema
- Extension schemas that refine the payload type at compile time
- Runtime-registered custom kinds that validate payloads dynamically

#### `metadata` (optional)

The metadata bag is a `Record<string, unknown>` for adapter-specific context that does not belong in the payload. Examples:

| Key | Value | Source |
|-----|-------|--------|
| `nats.stream` | `"signals"` | NATS adapter — JetStream stream name |
| `http.etag` | `"abc123"` | HTTP adapter — response ETag for caching |
| `serial.baud` | `115200` | Serial adapter — connection baud rate |
| `rss.feedTitle` | `"BBC News"` | RSS adapter — feed-level metadata |
| `stix.type` | `"indicator"` | STIX codec — original STIX object type |

Metadata MUST NOT contain large binary data. Metadata keys SHOULD use dot-namespaced prefixes to avoid collisions.

### TSG.8.5.4 SignalMetadata Schema

```typescript
export const SignalMetadata = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
})
export type SignalMetadata = typeof SignalMetadata.Type
```

The metadata bag uses `Schema.Unknown` values rather than `Schema.String` to allow structured metadata (numbers, booleans, nested objects) without stringification. However, all metadata values MUST be JSON-serializable — `Date` objects, functions, and circular references are prohibited.

---

## TSG.8.6 Source-Specific Extension Schemas

### TSG.8.6.1 Extension Mechanism

Each known signal kind defines an extension schema using `Schema.extend(BaseSignal, ...)`:

```typescript
// Pattern used by all 8 extension schemas
export const XxxSignal = Schema.extend(
  BaseSignal,
  Schema.Struct({
    kind: Schema.Literal('xxx'),     // Narrows kind to literal
    payload: XxxPayload,             // Narrows payload to typed struct
  }),
)
```

The `Schema.extend()` call:

1. Inherits all BaseSignal fields (id, sourceId, timestamp, version, kind, payload, metadata)
2. Narrows `kind` from `SignalKind` (string union) to the specific literal (e.g., `'midi'`)
3. Narrows `payload` from `Schema.Unknown` to the typed payload struct (e.g., `MidiPayload`)

This means an `MidiSignal` IS a `BaseSignal` — it satisfies all BaseSignal constraints plus the additional MIDI-specific constraints.

### TSG.8.6.2 MIDI Signal Extension

**Source**: Web MIDI API (browser) or node-midi (Node.js sidecar)
**File**: `schemas/midi-signal.ts` (89 lines, verified)

#### MIDI Payload Schema

```typescript
export const MidiPayload = Schema.Struct({
  channel: MidiChannel,         // 0-15
  type: MidiMessageType,        // note-on | note-off | cc | ...
  note: Schema.optional(Midi7Bit),        // 0-127
  velocity: Schema.optional(Midi7Bit),    // 0-127
  cc: Schema.optional(Midi7Bit),          // CC number 0-127
  value: Schema.optional(Midi7Bit),       // CC value 0-127
  program: Schema.optional(Midi7Bit),     // Program number
  pitchBend: Schema.optional(Midi14Bit),  // -8192 to 8191
  pressure: Schema.optional(Midi7Bit),    // Aftertouch pressure
  raw: Schema.optional(Schema.Array(Schema.Number)),  // Raw bytes
  deviceName: Schema.optional(Schema.String),
  deviceId: Schema.optional(Schema.String),
})
```

#### MIDI Message Types

```typescript
export const MidiMessageType = Schema.Literal(
  'note-on', 'note-off', 'cc', 'program-change',
  'pitch-bend', 'aftertouch', 'channel-pressure', 'sysex',
)
```

#### MIDI Value Constraints

| Type | Schema | Range | MIDI Spec |
|------|--------|-------|-----------|
| `Midi7Bit` | `Schema.Number.pipe(int(), between(0, 127))` | 0-127 | Standard 7-bit MIDI value |
| `MidiChannel` | `Schema.Number.pipe(int(), between(0, 15))` | 0-15 | MIDI channel (16 channels) |
| `Midi14Bit` | `Schema.Number.pipe(int(), between(-8192, 8191))` | -8192 to 8191 | 14-bit pitch bend |

#### MIDI Field Presence by Message Type

| Message Type | `note` | `velocity` | `cc` | `value` | `program` | `pitchBend` | `pressure` | `raw` |
|-------------|--------|-----------|------|---------|-----------|------------|-----------|------|
| `note-on` | REQUIRED | REQUIRED | - | - | - | - | - | - |
| `note-off` | REQUIRED | REQUIRED | - | - | - | - | - | - |
| `cc` | - | - | REQUIRED | REQUIRED | - | - | - | - |
| `program-change` | - | - | - | - | REQUIRED | - | - | - |
| `pitch-bend` | - | - | - | - | - | REQUIRED | - | - |
| `aftertouch` | REQUIRED | - | - | - | - | - | REQUIRED | - |
| `channel-pressure` | - | - | - | - | - | - | REQUIRED | - |
| `sysex` | - | - | - | - | - | - | - | REQUIRED |

#### MIDI SIGINT Use Cases

- **Control surface mapping** — Map MIDI CC knobs to d2ts graph parameters (window size, threshold)
- **Operator interaction logging** — Record analyst interactions for workflow replay
- **Hardware sensor bridge** — Arduino/ESP32 → MIDI → Tsingou via serial-to-MIDI bridge

### TSG.8.6.3 OSC Signal Extension

**Source**: UDP listener for Open Sound Control messages
**File**: `schemas/osc-signal.ts` (65 lines, verified)

#### OSC Payload Schema

```typescript
export const OscPayload = Schema.Struct({
  address: Schema.String.pipe(Schema.startsWith('/')),
  args: Schema.Array(OscArgument),
  timetag: Schema.optional(Schema.Number),
  isBundle: Schema.optional(Schema.Boolean),
  remoteAddress: Schema.optional(Schema.String),
})
```

#### OSC Argument Types

```typescript
export const OscArgument = Schema.Union(
  Schema.Number,               // i (int32) or f (float32)
  Schema.String,               // s (string)
  Schema.Boolean,              // T (true) or F (false)
  Schema.Uint8ArrayFromSelf,   // b (blob)
  Schema.Null,                 // N (nil)
)
```

#### OSC Field Specification

| Field | Schema | Description |
|-------|--------|-------------|
| `address` | `String.pipe(startsWith('/'))` | OSC address pattern (e.g., `/synth/filter/cutoff`) |
| `args` | `Array(OscArgument)` | Typed argument list — matches OSC type tags |
| `timetag` | `optional(Number)` | NTP timestamp from OSC bundle (64-bit, seconds since 1900) |
| `isBundle` | `optional(Boolean)` | Whether this message was extracted from an OSC bundle |
| `remoteAddress` | `optional(String)` | Source host:port (e.g., `192.168.1.50:9000`) |

#### OSC SIGINT Use Cases

- **IoT sensor networks** — OSC is widely used in sensor installations for real-time telemetry
- **Distributed monitoring** — Multiple OSC sources aggregate environmental readings
- **SDR integration** — GNU Radio can emit demodulated data via OSC

### TSG.8.6.4 NATS Signal Extension

**Source**: NATS JetStream consumer
**File**: `schemas/nats-signal.ts` (60 lines, verified)

#### NATS Payload Schema

```typescript
export const NatsPayload = Schema.Struct({
  subject: Schema.String,
  data: Schema.Unknown,
  headers: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),
  sequence: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  ),
  stream: Schema.optional(Schema.String),
  consumer: Schema.optional(Schema.String),
  replyTo: Schema.optional(Schema.String),
  serverTimestamp: Schema.optional(Schema.DateFromSelf),
})
```

#### NATS Field Specification

| Field | Schema | Description |
|-------|--------|-------------|
| `subject` | `String` | NATS subject the message was published to (e.g., `tsingou.signals.http`) |
| `data` | `Unknown` | Decoded message data — schema determined by subject pattern via registry |
| `headers` | `optional(Record)` | NATS message headers (key-value string pairs) |
| `sequence` | `optional(int ≥ 0)` | JetStream sequence number — enables replay from specific point |
| `stream` | `optional(String)` | JetStream stream name (e.g., `TSINGOU_SIGNALS`) |
| `consumer` | `optional(String)` | JetStream consumer name |
| `replyTo` | `optional(String)` | NATS reply subject for request-reply patterns |
| `serverTimestamp` | `optional(DateFromSelf)` | Timestamp from NATS server (more accurate than client time) |

#### NATS as Primary Transport

NATS signals are special: NATS is both a signal source AND the universal messaging fabric (TSG.8.3). A NatsSignal represents a message received from an external NATS subject — distinguishing external NATS messages from internal Holonet traffic.

### TSG.8.6.5 HTTP Signal Extension

**Source**: HTTP poll (REST API), SSE streams, long-poll, or webhook receiver
**File**: `schemas/http-signal.ts` (66 lines, verified)

#### HTTP Payload Schema

```typescript
export const HttpPayload = Schema.Struct({
  url: Schema.String,
  method: HttpMethod,
  statusCode: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.between(100, 599)),
  ),
  body: Schema.Unknown,
  headers: Schema.optional(
    Schema.Record({ key: Schema.String, value: Schema.String }),
  ),
  sseEventType: Schema.optional(Schema.String),
  sseEventId: Schema.optional(Schema.String),
  contentType: Schema.optional(Schema.String),
  responseTimeMs: Schema.optional(Schema.Number),
})
```

#### HTTP Method Values

```typescript
export const HttpMethod = Schema.Literal(
  'GET', 'POST', 'PUT', 'DELETE', 'PATCH',
)
```

#### HTTP Adapter Modes

The HTTP adapter operates in four modes, each producing HttpSignal with different field patterns:

| Mode | `statusCode` | `sseEventType` | `sseEventId` | `responseTimeMs` | Frequency |
|------|-------------|---------------|-------------|-----------------|-----------|
| **Poll** | Present | Absent | Absent | Present | Fixed interval (configurable) |
| **SSE** | Absent (streaming) | Present | Present | Absent | Event-driven |
| **Long-poll** | Present | Absent | Absent | Present | Response-driven |
| **Webhook** | Absent (receiver) | Absent | Absent | Absent | Push-driven |

#### HTTP SIGINT Use Cases

- **Threat intel API polling** — AlienVault OTX, VirusTotal, Shodan APIs
- **Social media monitoring** — Twitter/X streaming API via SSE
- **News feed augmentation** — REST APIs for news services beyond RSS
- **STIX/TAXII ingestion** — TAXII 2.1 endpoints provide STIX bundles via HTTP GET

### TSG.8.6.6 Serial Signal Extension

**Source**: USB/UART serial port (serialport lib, WebSerial API, or Tauri sidecar)
**File**: `schemas/serial-signal.ts` (64 lines, verified)

#### Serial Payload Schema

```typescript
export const SerialPayload = Schema.Struct({
  port: Schema.String,
  baudRate: Schema.Number.pipe(Schema.int(), Schema.positive()),
  raw: Schema.Uint8ArrayFromSelf,
  parsed: Schema.optional(Schema.Unknown),
  parserType: Schema.optional(SerialParserType),
  delimiter: Schema.optional(Schema.String),
  vendorId: Schema.optional(Schema.String),
  productId: Schema.optional(Schema.String),
  manufacturer: Schema.optional(Schema.String),
})
```

#### Serial Parser Types

```typescript
export const SerialParserType = Schema.Literal(
  'line',        // Newline-delimited (most common)
  'delimiter',   // Custom delimiter byte/string
  'byte-length', // Fixed byte count per frame
  'ready',       // Ready pattern match (e.g., "> " prompt)
  'raw',         // No parsing — raw byte chunks
)
```

#### Serial SIGINT Use Cases

- **SDR output ingestion** — RTL-SDR → serial → Tsingou for RF spectrum analysis
- **Hardware sensor telemetry** — Arduino/ESP32 sensor boards streaming readings
- **Embedded device monitoring** — UART debug output from embedded systems
- **GPS receiver** — NMEA sentences via serial for geolocation enrichment

### TSG.8.6.7 RSS Signal Extension

**Source**: RSS/Atom feed poller with configurable interval
**File**: `schemas/rss-signal.ts` (67 lines, verified)

#### RSS Payload Schema

```typescript
export const RssPayload = Schema.Struct({
  feedUrl: Schema.String,
  feedTitle: Schema.optional(Schema.String),
  itemGuid: Schema.String,
  title: Schema.String,
  link: Schema.optional(Schema.String),
  pubDate: Schema.optional(Schema.DateFromSelf),
  content: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  author: Schema.optional(Schema.String),
  categories: Schema.optional(Schema.Array(Schema.String)),
  enclosureUrl: Schema.optional(Schema.String),
  enclosureType: Schema.optional(Schema.String),
  enclosureLength: Schema.optional(Schema.Number),
})
```

#### RSS Deduplication

The `itemGuid` field serves as the deduplication key. When the RSS adapter polls a feed, it MUST track seen GUIDs to avoid re-emitting previously processed items. The adapter SHOULD store the last-seen GUID set in NATS KV for persistence across restarts.

#### RSS SIGINT Use Cases

- **OSINT monitoring** — Track news feeds, government bulletins, threat advisories
- **Blog surveillance** — Monitor known actor blogs for new publications
- **Vulnerability feeds** — NVD, CERT/CC advisories as RSS
- **Podcast intelligence** — Enclosure URLs for audio analysis pipelines

### TSG.8.6.8 WebSocket Signal Extension

**Source**: WebSocket client connecting to arbitrary servers
**File**: `schemas/websocket-signal.ts` (55 lines, verified)

#### WebSocket Payload Schema

```typescript
export const WebSocketPayload = Schema.Struct({
  url: Schema.String,
  data: Schema.Unknown,
  type: WebSocketMessageType,
  protocol: Schema.optional(Schema.String),
  byteLength: Schema.optional(Schema.Number),
  connectionSeq: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  ),
})
```

#### WebSocket Message Types

```typescript
export const WebSocketMessageType = Schema.Literal('text', 'binary')
```

#### WebSocket SIGINT Use Cases

- **Real-time market feeds** — Cryptocurrency exchanges, stock tickers
- **Chat monitoring** — IRC-over-WebSocket, Matrix, Discord streams
- **IoT device streams** — MQTT-over-WebSocket from sensor networks
- **Collaborative platform feeds** — Real-time document changes, collaboration events

### TSG.8.6.9 File Watch Signal Extension

**Source**: Filesystem watcher (JSON/CSV tail, directory monitoring)
**File**: `schemas/file-watch-signal.ts` (59 lines, verified)

#### File Watch Payload Schema

```typescript
export const FileWatchPayload = Schema.Struct({
  path: Schema.String,
  event: FileWatchEventType,
  content: Schema.optional(Schema.Unknown),
  size: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  mimeType: Schema.optional(Schema.String),
  lineRange: Schema.optional(Schema.Struct({
    start: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
    end: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  })),
  hash: Schema.optional(Schema.String),
})
```

#### File Watch Event Types

```typescript
export const FileWatchEventType = Schema.Literal('create', 'modify', 'delete')
```

#### File Watch SIGINT Use Cases

- **Log ingestion** — Tail log files for security event monitoring
- **PCAP analysis** — Watch directory for new packet capture files
- **Data drops** — Monitor directory for intelligence data drops (CSV, JSON)
- **Configuration monitoring** — Detect changes to system configuration files

### TSG.8.6.10 Extension Schema Summary

| Kind | Payload Fields | Required Fields | Optional Fields | File Size |
|------|---------------|-----------------|-----------------|-----------|
| `midi` | 12 | 2 (`channel`, `type`) | 10 | 89 lines |
| `osc` | 5 | 2 (`address`, `args`) | 3 | 65 lines |
| `nats` | 8 | 2 (`subject`, `data`) | 6 | 60 lines |
| `http` | 9 | 2 (`url`, `method`) | 7 | 66 lines |
| `serial` | 9 | 3 (`port`, `baudRate`, `raw`) | 6 | 64 lines |
| `rss` | 12 | 3 (`feedUrl`, `itemGuid`, `title`) | 9 | 67 lines |
| `websocket` | 6 | 3 (`url`, `data`, `type`) | 3 | 55 lines |
| `file-watch` | 7 | 2 (`path`, `event`) | 5 | 59 lines |
| `sdr` | 11 | 4 (`centerFreqHz`, `sampleRate`, `format`, `samples`) | 7 | (planned) |
| **Total** | **79** | **23** | **56** | **525+ lines** |

### TSG.8.6.11 SDR Signal Extension (Planned)

**Source**: RTL-SDR dongle → GNU Radio → serial/NATS bridge → Tsingou
**File**: `schemas/sdr-signal.ts` (planned — not yet implemented)
**Status**: Design phase — ADR-011 specifies the integration architecture

#### SDR Payload Schema (Planned)

```typescript
// PLANNED — not yet in codebase
export const SdrPayload = Schema.Struct({
  /** Center frequency in Hz */
  centerFreqHz: Schema.Number.pipe(Schema.positive()),

  /** Sample rate in samples per second */
  sampleRate: Schema.Number.pipe(Schema.positive()),

  /** IQ sample format */
  format: Schema.Literal('cu8', 'cs8', 'cf32', 'cs16'),

  /** IQ sample data (interleaved I/Q values) */
  samples: Schema.Uint8ArrayFromSelf,

  /** Number of IQ sample pairs in this chunk */
  sampleCount: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
  ),

  /** SDR hardware identifier */
  deviceId: Schema.optional(Schema.String),

  /** SDR gain setting in dB */
  gainDb: Schema.optional(Schema.Number),

  /** Bandwidth in Hz */
  bandwidthHz: Schema.optional(Schema.Number.pipe(Schema.positive())),

  /** SigMF metadata reference (if available) */
  sigmfAnnotation: Schema.optional(Schema.Unknown),

  /** GNU Radio flowgraph identifier */
  flowgraphId: Schema.optional(Schema.String),

  /** Whether automatic gain control is enabled */
  agcEnabled: Schema.optional(Schema.Boolean),
})
```

#### SDR Sample Formats

| Format | Description | Bytes/Sample | Dynamic Range |
|--------|-------------|-------------|---------------|
| `cu8` | Complex unsigned 8-bit | 2 | 48 dB |
| `cs8` | Complex signed 8-bit | 2 | 48 dB |
| `cs16` | Complex signed 16-bit | 4 | 96 dB |
| `cf32` | Complex float 32-bit | 8 | ~150 dB |

RTL-SDR natively outputs `cu8`. GNU Radio typically processes in `cf32`. The adapter MUST specify the format so downstream DSP operators can correctly interpret the sample buffer.

#### SDR Integration Path

```
RTL-SDR Dongle (USB)
  │
  ▼
GNU Radio Flowgraph (sidecar process)
  │
  ├── Demodulation, filtering, decimation
  ├── SigMF metadata annotation
  │
  ▼
Serial/NATS Bridge
  │
  ├── Chunked IQ samples + SigMF metadata
  │
  ▼
Tsingou SdrAdapter (kind='sdr')
  │
  ├── Validate against SdrPayload schema
  ├── Assign SignalId, version
  │
  ▼
d2ts Graph → FFT operators → Spectrum atoms → p5 waterfall rendering
```

#### SDR SIGINT Use Cases

- **RF spectrum monitoring** — Visualize electromagnetic spectrum occupancy
- **Signal detection** — Identify unknown transmitters in a frequency band
- **Direction finding** — Multi-SDR correlation for transmitter geolocation
- **Protocol analysis** — Demodulate and decode digital protocols (ADS-B, AIS, ACARS)
- **Spectrum recording** — SigMF-annotated IQ captures for retrospective analysis

---

## TSG.8.7 Signal Union

### TSG.8.7.1 Discriminated Union Definition

The Signal type is a discriminated union of all 8 known signal types (verified from `schemas/signal-union.ts:44-55`):

```typescript
export const Signal = Schema.Union(
  MidiSignal,
  OscSignal,
  NatsSignal,
  HttpSignal,
  SerialSignal,
  RssSignal,
  WebSocketSignal,
  FileWatchSignal,
)
export type Signal = typeof Signal.Type
export type SignalEncoded = typeof Signal.Encoded
```

### TSG.8.7.2 Pattern Matching

The `kind` field serves as the discriminant for pattern matching:

```typescript
const handle = (signal: Signal) => {
  switch (signal.kind) {
    case 'midi':      return processMidi(signal)      // signal: MidiSignal
    case 'osc':       return processOsc(signal)       // signal: OscSignal
    case 'nats':      return processNats(signal)      // signal: NatsSignal
    case 'http':      return processHttp(signal)      // signal: HttpSignal
    case 'serial':    return processSerial(signal)    // signal: SerialSignal
    case 'rss':       return processRss(signal)       // signal: RssSignal
    case 'websocket': return processWebSocket(signal) // signal: WebSocketSignal
    case 'file-watch': return processFileWatch(signal) // signal: FileWatchSignal
  }
}
```

TypeScript narrows the `signal` type within each `case` branch, providing type-safe access to the kind-specific payload.

### TSG.8.7.3 Union vs BaseSignal

The system uses two levels of signal typing:

| Type | When Used | Payload Access |
|------|-----------|----------------|
| `BaseSignal` | Pipeline infrastructure (queue, bridge, d2ts operators) | `signal.payload` is `unknown` — cast or validate |
| `Signal` | Kind-specific processing, rendering, analysis | `signal.payload` is typed (e.g., `MidiPayload`) |

Most pipeline code operates on `BaseSignal` because it does not need payload access. Kind-specific logic (rendering layers, analysis techniques) uses `Signal` or a specific extension type.

### TSG.8.7.4 Custom Signals Outside the Union

Signals with custom kinds (registered via SchemaRegistry) are NOT part of the compile-time `Signal` union. They are typed as `BaseSignal` with `payload: unknown`. The schema registry provides runtime validation, but compile-time narrowing is not available for dynamic kinds.

If a custom kind becomes stable enough to warrant compile-time typing, it SHOULD be added to `KnownSignalKind` and a new extension schema file created.

---

## TSG.8.8 Schema Registry

### TSG.8.8.1 Purpose

The schema registry enables runtime registration of custom signal kinds without recompiling the system. It is backed by a NATS KV bucket (`tsingou-schemas`) for persistence and distribution.

### TSG.8.8.2 Registry Entry Schema

```typescript
export const SchemaRegistryEntry = Schema.Struct({
  kind: Schema.String.pipe(Schema.minLength(1)),
  version: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  jsonSchema: Schema.Unknown,
  description: Schema.optional(Schema.String),
  createdAt: Schema.DateFromSelf,
  createdBy: Schema.String,
  deprecated: Schema.optional(Schema.Boolean),
  previousVersion: Schema.optional(
    Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  ),
})
```

### TSG.8.8.3 Registry Entry Field Specification

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kind` | `String (minLength 1)` | REQUIRED | Signal kind string this schema validates |
| `version` | `int ≥ 1` | REQUIRED | Schema version — monotonically increasing |
| `jsonSchema` | `Unknown` | REQUIRED | JSON Schema output from `JSONSchema.make()` |
| `description` | `String` | OPTIONAL | Human-readable description |
| `createdAt` | `DateFromSelf` | REQUIRED | When this version was registered |
| `createdBy` | `String` | REQUIRED | Who registered it (adapter ID, user, system) |
| `deprecated` | `Boolean` | OPTIONAL | Whether this version is deprecated |
| `previousVersion` | `int ≥ 1` | OPTIONAL | Previous version for migration reference |

### TSG.8.8.4 Schema Compatibility

```typescript
export const SchemaCompatibility = Schema.Literal(
  'backward',   // New schema can read old data
  'forward',    // Old schema can read new data
  'full',       // Both directions
  'none',       // No compatibility check
)
```

Implementations SHOULD enforce at least `backward` compatibility when updating a schema version. This means a new schema version MUST be able to validate data produced under the previous version.

### TSG.8.8.5 NATS KV Storage

Registry entries are stored in NATS KV bucket `tsingou-schemas`:

| Property | Value |
|----------|-------|
| Bucket name | `tsingou-schemas` |
| Key format | `{kind}` (e.g., `custom-sensor-xyz`) |
| Value format | JSON-encoded `SchemaRegistryEntry` |
| History | KV maintains version history (configurable depth) |
| Replication | Follows NATS cluster replication settings |

### TSG.8.8.6 Registry Operations

| Operation | Method | Description |
|-----------|--------|-------------|
| Register | `kv.put(kind, entry)` | Store a new or updated schema entry |
| Lookup | `kv.get(kind)` | Retrieve schema for a given kind |
| List | `kv.keys()` | List all registered kinds |
| Watch | `kv.watch({ key: '>' })` | Subscribe to registry changes in real-time |
| Delete | `kv.delete(kind)` | Remove a schema entry |
| History | `kv.history(kind)` | Retrieve version history for a kind |

---

## TSG.8.9 Adapter Operational Schemas

### TSG.8.9.1 Adapter Status

The adapter status represents the connection lifecycle state (verified from `schemas/adapter.ts:17-25`):

```typescript
export const AdapterStatus = Schema.Literal(
  'disconnected',  // Not connected, not attempting
  'connecting',    // Connection in progress
  'connected',     // Active and receiving signals
  'degraded',      // Connected but experiencing errors
  'reconnecting',  // Lost connection, attempting recovery
  'error',         // Fatal error, needs manual intervention
)
```

#### Adapter Status State Machine

```
                    ┌───────────────┐
                    │  disconnected │
                    └───────┬───────┘
                            │ register()
                            ▼
                    ┌───────────────┐
              ┌────►│  connecting   │◄────┐
              │     └───────┬───────┘     │
              │             │ connected   │ retry
              │             ▼             │
              │     ┌───────────────┐     │
              │     │   connected   │─────┤
              │     └───────┬───────┘     │
              │             │ error       │
              │             ▼             │
              │     ┌───────────────┐     │
              │     │   degraded    │─────┘
              │     └───────┬───────┘
              │             │ connection lost
              │             ▼
              │     ┌───────────────┐
              │     │ reconnecting  │──── max retries exceeded
              │     └───────┬───────┘                │
              │             │ connected               ▼
              │             │                 ┌───────────────┐
              └─────────────┘                 │     error     │
                                              └───────────────┘
                                                      │
                                                      │ unregister()
                                                      ▼
                                              ┌───────────────┐
                                              │  disconnected │
                                              └───────────────┘
```

### TSG.8.9.2 Adapter Health

The health snapshot represents the operational metrics for a running adapter (verified from `schemas/adapter.ts:35-57`):

```typescript
export const AdapterHealth = Schema.Struct({
  status: AdapterStatus,
  lastSignalAt: Schema.optional(Schema.DateFromSelf),
  signalCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  errorCount: Schema.Number.pipe(Schema.int(), Schema.greaterThanOrEqualTo(0)),
  latencyMs: Schema.optional(Schema.Number.pipe(Schema.greaterThanOrEqualTo(0))),
  details: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Unknown,
  })),
})
```

#### Health Field Specification

| Field | Type | Description |
|-------|------|-------------|
| `status` | `AdapterStatus` | Current connection state |
| `lastSignalAt` | `optional(DateFromSelf)` | When the last signal was successfully produced |
| `signalCount` | `int ≥ 0` | Total signals produced since last connect |
| `errorCount` | `int ≥ 0` | Total errors since last connect |
| `latencyMs` | `optional(Number ≥ 0)` | Average processing latency in milliseconds |
| `details` | `optional(Record)` | Source-specific health details |

### TSG.8.9.3 Adapter Error Schema

```typescript
export const AdapterError = Schema.TaggedStruct('AdapterError', {
  adapterId: Schema.String,
  sourceId: SourceId,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
  retryable: Schema.Boolean,
  timestamp: Schema.DateFromSelf,
})
```

Note: `AdapterError` uses `Schema.TaggedStruct` with the tag `'AdapterError'`. This adds a `_tag: 'AdapterError'` discriminator field, enabling `Effect.catchTag('AdapterError', ...)` recovery.

### TSG.8.9.4 Adapter Lifecycle Events

The lifecycle event union represents the 5 lifecycle transitions (verified from `schemas/adapter.ts:88-119`):

```typescript
export const AdapterLifecycleEvent = Schema.Union(
  Schema.TaggedStruct('AdapterRegistered', { ... }),
  Schema.TaggedStruct('AdapterConnected', { ... }),
  Schema.TaggedStruct('AdapterDisconnected', { ... }),
  Schema.TaggedStruct('AdapterError', { ... }),
  Schema.TaggedStruct('AdapterUnregistered', { ... }),
)
```

#### Lifecycle Event Types

| Event | Tag | Trigger | Fields |
|-------|-----|---------|--------|
| Registration | `AdapterRegistered` | `AdapterManager.register()` | adapterId, sourceId, kind, timestamp |
| Connection | `AdapterConnected` | Adapter successfully connects to source | adapterId, sourceId, timestamp |
| Disconnection | `AdapterDisconnected` | Connection lost or intentional disconnect | adapterId, sourceId, reason?, timestamp |
| Error | `AdapterError` | Adapter encounters an error | adapterId, sourceId, message, retryable, timestamp |
| Unregistration | `AdapterUnregistered` | `AdapterManager.unregister()` | adapterId, sourceId, timestamp |

---

## TSG.8.10 Validation Pipeline

### TSG.8.10.1 Validation Boundary

Signal validation occurs at the ingestion boundary — the point where raw data from an external source is transformed into a typed `BaseSignal`. This is the system boundary where untrusted input meets the typed pipeline.

```
External Source (untrusted)
  │
  ├── Raw data (JSON, bytes, XML, RSS XML, MIDI bytes)
  │
  ▼
Source Adapter
  │
  ├── Parse raw data into candidate signal object
  ├── Assign SignalId, SourceId, timestamp, version
  ├── Set kind field
  │
  ▼
Schema Validation (schemaValidate operator)
  │
  ├── Validate against BaseSignal schema
  ├── If known kind: validate against extension schema
  ├── If custom kind: validate against registry entry
  │
  ├── PASS → Signal enters d2ts graph
  └── FAIL → Signal routed to dead-letter queue
              Error logged with ParseError details
```

### TSG.8.10.2 Validation Stages

| Stage | Schema | Validates | Error on Failure |
|-------|--------|-----------|-----------------|
| 1. Structure | `BaseSignal` | All 7 fields present and typed correctly | `SchemaValidationError` |
| 2. Identity | `SignalId`, `SourceId` | Non-empty branded strings | `SchemaValidationError` |
| 3. Version | `SignalVersion` | Tuple of two non-negative integers | `SchemaValidationError` |
| 4. Kind | `SignalKind` | Valid string (any non-empty string passes) | `SchemaValidationError` |
| 5. Payload | Extension schema or registry | Kind-specific payload structure | `SchemaValidationError` |
| 6. Metadata | `SignalMetadata` | JSON-serializable key-value pairs | `SchemaValidationError` |

### TSG.8.10.3 Validation in Effect

```typescript
// Validating a BaseSignal from unknown input
const validateBaseSignal = (input: unknown) =>
  Schema.decodeUnknown(BaseSignal)(input).pipe(
    Effect.mapError((error) =>
      new SchemaValidationError({
        message: `BaseSignal validation failed`,
        cause: error,
        retryable: false,
      })
    ),
  )

// Validating a specific signal type
const validateMidiSignal = (input: unknown) =>
  Schema.decodeUnknown(MidiSignal)(input).pipe(
    Effect.mapError((error) =>
      new SchemaValidationError({
        message: `MidiSignal validation failed`,
        cause: error,
        retryable: false,
      })
    ),
  )
```

### TSG.8.10.4 Dead-Letter Queue

Signals that fail validation MUST NOT propagate into the d2ts graph. Instead, they SHOULD be routed to a dead-letter queue for diagnostic inspection:

```
Dead Letter Queue (NATS subject: tsingou.internal.dead-letter)
  │
  ├── Original signal data (pre-validation)
  ├── Validation error details (ParseError tree)
  ├── Adapter source information
  ├── Timestamp of rejection
  │
  └── Retained for configurable duration (default: 24 hours)
```

---

## TSG.8.11 Encoding and Serialization

### TSG.8.11.1 JSON Encoding

BaseSignal is encoded to JSON for NATS JetStream persistence, WebSocket transport, and diagnostic output. The encoding handles non-JSON-native types:

| Field | In-Memory Type | JSON Encoded Type | Codec |
|-------|---------------|-------------------|-------|
| `id` | `string & Brand<'SignalId'>` | `string` | Brand erased (identity) |
| `sourceId` | `string & Brand<'SourceId'>` | `string` | Brand erased (identity) |
| `timestamp` | `Date` | `string` (ISO 8601) | `DateFromSelf` |
| `version` | `readonly [number, number]` | `[number, number]` | Identity |
| `kind` | `string` | `string` | Identity |
| `payload` | `unknown` | varies | Identity (already JSON-compatible) |
| `metadata` | `Record<string, unknown> \| undefined` | `object \| undefined` | Identity |

### TSG.8.11.2 JSON Schema Generation

Effect Schema generates JSON Schema for external tool interoperability:

```typescript
import { JSONSchema } from 'effect'

const baseSignalJsonSchema = JSONSchema.make(BaseSignal)
// Output: JSON Schema Draft 2020-12 compatible object
```

This JSON Schema can be used for:

- External validation tools (ajv, JSON Schema validators)
- API documentation (OpenAPI/Swagger integration)
- NATS Schema Registry storage (TSG.8.8)
- Code generation for non-TypeScript consumers

### TSG.8.11.3 Binary Encoding Considerations

For high-throughput scenarios (serial adapter, NATS core at 100kHz+), JSON encoding may become a bottleneck. The schema design supports future binary encoding:

| Encoding | When | Format | Compatibility |
|----------|------|--------|--------------|
| JSON (default) | All normal operations | `JSON.stringify` + Effect codec | Universal |
| MessagePack | High-throughput internal channels | `@msgpack/msgpack` | Subset of JSON types |
| Protocol Buffers | Cross-language interop (future) | `.proto` generated from JSON Schema | Requires schema compilation |

Binary encoding is not currently implemented. When implemented, it MUST preserve schema validation semantics — the decoded value MUST pass `Schema.decodeUnknown(BaseSignal)`.

---

## TSG.8.12 STIX Interoperability Mapping

### TSG.8.12.1 BaseSignal to STIX 2.1

Tsingou uses BaseSignal internally and provides a bidirectional codec to STIX 2.1 format [ADR-009]. The mapping is not 1:1 — BaseSignal is a more general concept than any single STIX object type.

### TSG.8.12.2 Field Mapping

| BaseSignal Field | STIX 2.1 Common Property | Notes |
|-----------------|------------------------|-------|
| `id` | `id` | BaseSignal uses free-form string; STIX uses `{type}--{uuid}` format |
| `sourceId` | `created_by_ref` | Maps to STIX Identity object reference |
| `timestamp` | `created` / `modified` | BaseSignal has single timestamp; STIX has two |
| `version` | (no equivalent) | d2ts versioning is Tsingou-specific |
| `kind` | `type` | BaseSignal kind maps to STIX type with `stix-` prefix convention |
| `payload` | (object body) | Extension payload maps to STIX object-specific properties |
| `metadata` | `extensions` / `custom_properties` | Adapter metadata maps to STIX extension namespace |

### TSG.8.12.3 Signal Kind to STIX Object Type

| BaseSignal Kind | STIX Object Type | Category |
|----------------|-----------------|----------|
| `stix-indicator` | `indicator` | SDO |
| `stix-observed-data` | `observed-data` | SDO |
| `stix-malware` | `malware` | SDO |
| `stix-threat-actor` | `threat-actor` | SDO |
| `stix-attack-pattern` | `attack-pattern` | SDO |
| `stix-relationship` | `relationship` | SRO |
| `stix-sighting` | `sighting` | SRO |
| `stix-artifact` | `artifact` | SCO |
| Custom kinds | `x-tsingou-{kind}` | Custom Object |

### TSG.8.12.4 Codec Direction

```
Inbound (TAXII → Tsingou):
  STIX Bundle → decode → Array<BaseSignal> (kind='stix-{type}')

Outbound (Tsingou → TAXII):
  Array<BaseSignal> → encode → STIX Bundle
```

The full STIX codec specification is in TSG.13 (BaseSignal ↔ STIX Codec).

---

## TSG.8.13 Schema Export Structure

### TSG.8.13.1 Barrel Export

The schema module exports all types through a barrel file (verified from `schemas/index.ts`, 55 lines):

```
schemas/index.ts
  ├── Base signal + branded IDs (8 exports + 7 type exports)
  ├── Source-specific signals (8 files × ~3 exports each)
  ├── Signal union (1 export + 2 type exports)
  ├── Schema registry (2 exports)
  └── Adapter operational types (4 exports)
```

### TSG.8.13.2 Module Dependency Graph

```
base-signal.ts ◄── midi-signal.ts
               ◄── osc-signal.ts
               ◄── nats-signal.ts
               ◄── http-signal.ts
               ◄── serial-signal.ts
               ◄── rss-signal.ts
               ◄── websocket-signal.ts
               ◄── file-watch-signal.ts
               ◄── adapter.ts (imports SourceId)

signal-union.ts ◄── all 8 extension signals

registry.ts ◄── (independent — no signal imports)

index.ts ◄── all of the above
```

No circular dependencies exist. `base-signal.ts` is the root of the schema dependency graph.

### TSG.8.13.3 File Inventory

| File | Lines | Exports | Purpose |
|------|-------|---------|---------|
| `base-signal.ts` | 159 | 9 values, 2 types | Core schema + branded IDs + version + kind |
| `midi-signal.ts` | 89 | 3 values, 1 type | MIDI extension |
| `osc-signal.ts` | 65 | 3 values, 1 type | OSC extension |
| `nats-signal.ts` | 60 | 2 values, 1 type | NATS extension |
| `http-signal.ts` | 66 | 3 values, 1 type | HTTP extension |
| `serial-signal.ts` | 64 | 3 values, 1 type | Serial extension |
| `rss-signal.ts` | 67 | 2 values, 1 type | RSS extension |
| `websocket-signal.ts` | 55 | 3 values, 1 type | WebSocket extension |
| `file-watch-signal.ts` | 59 | 3 values, 1 type | File watch extension |
| `signal-union.ts` | 56 | 1 value, 2 types | Discriminated union |
| `registry.ts` | 68 | 2 values, 2 types | Schema registry entry |
| `adapter.ts` | 120 | 4 values, 4 types | Adapter operational types |
| `index.ts` | 55 | Barrel re-exports | Module entry point |
| **Total** | **983** | **38 values, 18 types** | |

---

## TSG.8.14 Signal Lifecycle

### TSG.8.14.1 Lifecycle Overview

A signal passes through 7 phases from creation to archival:

```
Phase 1: CREATION
  │  Adapter receives raw data from external source
  │  Adapter constructs BaseSignal (assigns id, sourceId, kind, timestamp)
  │  Source-specific payload is populated
  │
  ▼
Phase 2: INGESTION
  │  Signal is offered to SignalQueue (Queue.bounded(1024))
  │  Backpressure applied if queue is full — adapter fiber blocks
  │
  ▼
Phase 3: NORMALIZATION
  │  TsingouFlow drain loop takes all signals from queue
  │  Global tick assigned to version[0]
  │  Schema validation via schemaValidate operator
  │  Invalid signals rejected to dead-letter queue
  │
  ▼
Phase 4: PROCESSING
  │  Valid signals enter d2ts ingest graph
  │  Operators apply: window, throttle, join, aggregate
  │  Derived signals produced by derived graph
  │
  ▼
Phase 5: ROUTING
  │  OutputBridge receives processed signals
  │  Batched writes to atoms (batch size = 8)
  │  Atoms updated: activeSignalsAtom, derivedSignalCountAtom
  │
  ▼
Phase 6: RENDERING
  │  React layers subscribe via useAtomValue()
  │  Each layer renders independently (R3F, visx, p5, DOM)
  │  Cross-layer coordination via selectedSignalIdsAtom
  │
  ▼
Phase 7: ARCHIVAL
  │  Signals published to NATS JetStream (tsingou.signals.{kind})
  │  Retained per JetStream retention policy
  │  Available for replay via DeliverByStartSequence
```

### TSG.8.14.2 Signal Ownership

| Phase | Owner | Mutation Allowed |
|-------|-------|-----------------|
| Creation | Adapter | Full — adapter constructs the signal |
| Ingestion | Queue | None — signal is immutable in queue |
| Normalization | TsingouFlow | Version assignment only — tick dimension set |
| Processing | d2ts graph | None — operators produce new signals, not mutate |
| Routing | OutputBridge | None — signal written to atom as-is |
| Rendering | React layer | None — read-only via useAtomValue() |
| Archival | JetStream | None — immutable once published |

Signals are **effectively immutable** after Phase 1. The only mutation is the tick assignment in Phase 3, which fills the placeholder `version[0] = 0` set by the adapter. After normalization, the signal is frozen.

### TSG.8.14.3 Signal Retention

| Storage | Retention | Purpose |
|---------|-----------|---------|
| SignalQueue | Transient — consumed on drain | Flow control buffer |
| d2ts operator state | Operator-dependent (window duration, etc.) | Incremental computation |
| OutputBridge queue | Transient — consumed by atom writer | Rendering buffer |
| Atoms | Current state only (last batch) | Live rendering |
| JetStream | Configurable (default: 24h, max 10GB) | Historical replay |

### TSG.8.14.4 Signal Garbage Collection

Signals are garbage-collected at each phase boundary:

- **Queue**: Automatically freed when drained by TsingouFlow
- **d2ts state**: Window operators evict entries older than `durationMs`
- **Atoms**: Overwritten on each batch write (previous array dereferenced)
- **JetStream**: Evicted per retention policy (time-based or size-based)

No explicit garbage collection is needed. The pipeline is designed so that signals flow through without accumulation at any point.

---

## TSG.8.15 Schema Evolution Strategy

### TSG.8.15.1 Versioning Model

The BaseSignal schema uses **structural versioning** rather than explicit version numbers. Schema changes are categorized by their impact:

| Category | Description | Compatibility | Example |
|----------|-------------|---------------|---------|
| **Additive** | New optional field added to payload | Backward compatible | Adding `sseRetry` to HttpPayload |
| **Narrowing** | Constraint tightened on existing field | Forward compatible | Changing `String` to `String.pipe(minLength(1))` |
| **Widening** | Constraint relaxed on existing field | Backward compatible | Changing `int()` to `Number` |
| **Breaking** | Required field added/removed/renamed | Incompatible | Removing `sourceId` from BaseSignal |

### TSG.8.15.2 Evolution Rules

1. **BaseSignal core fields MUST NOT change.** The 7 core fields (id, sourceId, timestamp, version, kind, payload, metadata) are frozen. Any change to these fields constitutes a new major version of the Tsingou protocol.

2. **Extension payload schemas MAY add optional fields.** This is the primary evolution mechanism. Adding `Schema.optional(...)` fields to a payload struct is always backward compatible.

3. **Extension payload schemas MUST NOT remove required fields.** Removing a required field breaks all producers that include it.

4. **New signal kinds MAY be added to KnownSignalKind.** Adding a new literal to the union is backward compatible — existing signals with other kinds are unaffected.

5. **Signal kinds MUST NOT be removed from KnownSignalKind.** Removing a kind would break any producer still emitting it.

### TSG.8.15.3 Runtime Schema Registry Evolution

For custom (registry-based) signal kinds, the schema registry provides explicit versioning:

```
Version 1: { kind: 'custom-sensor', version: 1, jsonSchema: {...} }
  │
  │ New field added
  ▼
Version 2: { kind: 'custom-sensor', version: 2, jsonSchema: {...},
             previousVersion: 1 }
```

The registry entry's `previousVersion` field enables migration tooling to understand the evolution chain. Implementations SHOULD enforce backward compatibility: the version 2 schema MUST accept data produced under version 1.

### TSG.8.15.4 Migration Strategy

When a breaking change is unavoidable (e.g., a fundamental redesign of the SDR payload structure):

1. **Introduce new kind** — Create `sdr-v2` alongside `sdr`, not replace `sdr`.
2. **Deprecate old kind** — Set `deprecated: true` in the registry entry for `sdr`.
3. **Dual-emit period** — Adapters emit both `sdr` and `sdr-v2` signals during transition.
4. **Sunset old kind** — Remove `sdr` from KnownSignalKind after all consumers migrate.

This approach ensures zero-downtime migration for running Tsingou instances.

### TSG.8.15.5 JSON Schema Compatibility Testing

Schema compatibility SHOULD be tested automatically by comparing the JSON Schema output of consecutive versions:

```typescript
// Compatibility test pattern
const v1Schema = JSONSchema.make(PayloadV1)
const v2Schema = JSONSchema.make(PayloadV2)

// Generate sample data from v1
const v1Data = Schema.decodeUnknownSync(PayloadV1)(sampleInput)

// v2 MUST accept v1 data (backward compatibility)
const result = Schema.decodeUnknown(PayloadV2)(v1Data)
expect(Effect.runSync(result)).toBeDefined()
```

---

## TSG.8.16 Normative Requirements

### MUST Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.8-R1 | All domain types entering the signal pipeline MUST be defined as Effect Schema values | TSG.8.1.5 |
| TSG.8-R2 | Raw TypeScript `interface` and `type` declarations MUST NOT be used for pipeline domain types | TSG.8.1.5 |
| TSG.8-R3 | SignalId MUST NOT be reused across different signals | TSG.8.2.2 |
| TSG.8-R4 | SignalId MUST be assigned at signal construction time, before entering the SignalQueue | TSG.8.2.2 |
| TSG.8-R5 | Functions accepting branded ID parameters MUST NOT accept unbranded string values | TSG.8.2.5 |
| TSG.8-R6 | Both version dimensions MUST be non-negative integers | TSG.8.3.7 |
| TSG.8-R7 | The tick dimension MUST be monotonically non-decreasing within a processing session | TSG.8.3.7 |
| TSG.8-R8 | The source sequence MUST be monotonically increasing per source adapter | TSG.8.3.7 |
| TSG.8-R9 | When an adapter reconnects to the same source, it MUST use the same SourceId | TSG.8.2.3 |
| TSG.8-R10 | Two adapters connected to different sources MUST NOT share a SourceId | TSG.8.2.3 |
| TSG.8-R11 | Extension schemas MUST use `Schema.extend(BaseSignal, ...)` for composition | TSG.8.6.1 |
| TSG.8-R12 | Signals failing validation MUST NOT propagate into the d2ts graph | TSG.8.10.1 |
| TSG.8-R13 | Metadata values MUST be JSON-serializable | TSG.8.5.4 |
| TSG.8-R14 | Binary encoding MUST preserve schema validation semantics | TSG.8.11.3 |

### SHOULD Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.8-S1 | Adapters SHOULD use source-provided timestamps when available | TSG.8.5.3 |
| TSG.8-S2 | Metadata keys SHOULD use dot-namespaced prefixes to avoid collisions | TSG.8.5.3 |
| TSG.8-S3 | RSS adapters SHOULD store last-seen GUID set in NATS KV for dedup persistence | TSG.8.6.7 |
| TSG.8-S4 | Schema registry updates SHOULD enforce at least backward compatibility | TSG.8.8.4 |
| TSG.8-S5 | Failed validation signals SHOULD be routed to a dead-letter queue | TSG.8.10.4 |
| TSG.8-S6 | Stable custom kinds SHOULD be promoted to KnownSignalKind with extension schemas | TSG.8.7.4 |

### MAY Requirements

| ID | Requirement | Source |
|----|------------|--------|
| TSG.8-M1 | Implementations MAY use UUID v4 or nanoid for SignalId generation | TSG.8.2.2 |
| TSG.8-M2 | Custom signal kinds MAY use the `stix-` prefix for STIX-derived types | TSG.8.4.4 |
| TSG.8-M3 | High-throughput adapters MAY use MessagePack encoding for internal channels | TSG.8.11.3 |

---

## TSG.8.17 References

| Key | Reference |
|-----|-----------|
| [RFC2119] | Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997 |
| [RFC8174] | Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017 |
| [ADR-009] | ADR-009: STIX as Bidirectional Codec. `docs/tsingou/adr/ADR-009-stix-bidirectional-codec.md` |
| [D2TS] | Electric SQL. "@electric-sql/d2ts — Differential dataflow in TypeScript." |
| [EFFECT] | Effect-TS. "Effect: A TypeScript library for building production-grade applications." |
| [EFFECT-SCHEMA] | Effect-TS. "@effect/schema — Schema validation and transformation." |
| [JSON-SCHEMA] | JSON Schema. "JSON Schema: A Media Type for Describing JSON Documents." https://json-schema.org |
| [MIDI-SPEC] | MIDI Manufacturers Association. "MIDI 1.0 Detailed Specification." |
| [OSC-SPEC] | Wright, M. and Freed, A., "Open Sound Control: A New Protocol for Communicating with Sound Synthesizers." |
| [NATS] | NATS.io. "NATS — Cloud Native Messaging System." https://nats.io |
| [STIX-2.1] | OASIS CTI TC. "STIX Version 2.1." https://docs.oasis-open.org/cti/stix/v2.1/stix-v2.1.html |
| [SIGMF] | The SigMF Specification. "Signal Metadata Format." https://sigmf.org |
| [RSS-2.0] | Winer, D., "RSS 2.0 Specification." https://www.rssboard.org/rss-specification |
| [ATOM-RFC] | Nottingham, M. and Sayre, R., "The Atom Syndication Format", RFC 4287, December 2005 |
