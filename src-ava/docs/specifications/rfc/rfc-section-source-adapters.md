# AVA.4 Source Adapters

```
Section:       AVA.4 — Source Adapters
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Ingest (Normative)
Prerequisites: AVA.2 (Signal Schema), AVA.3 (NATS Subject Taxonomy)
Feeds:         AVA.5 (JetStream Persistence), AVA.6 (Actor Model)
```

> This section specifies the source adapter contract, the type conversion
> bridge between ava-fusion pure types and asupersync runtime types, the
> reference data registration mechanism, and the error handling patterns for
> data ingestion. Source adapters connect external data sources to the NATS
> subject namespace, transforming raw feeds into normalized signals that the
> SensorIngestor actors consume. The key words "MUST", "MUST NOT", "REQUIRED",
> "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT
> RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted
> as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava41-conventions-and-terminology)
2.  [Source Adapter Contract](#ava42-source-adapter-contract)
3.  [Type Conversion Bridge](#ava43-type-conversion-bridge)
4.  [Severity Conversion](#ava44-severity-conversion)
5.  [CancelKind Conversion](#ava45-cancelkind-conversion)
6.  [Outcome Conversion](#ava46-outcome-conversion)
7.  [Budget Conversion](#ava47-budget-conversion)
8.  [ObligationState and ObligationId Conversion](#ava48-obligationstate-and-obligationid-conversion)
9.  [Reference Source Adapter Pattern](#ava49-reference-source-adapter-pattern)
10. [Normative Requirements Summary](#ava410-normative-requirements-summary)
11. [References](#ava411-references)

---

## AVA.4.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.4.1.1 Terminology

| Term | Definition |
|------|-----------|
| **Source Adapter** | A component that connects to an external data source (API, feed, file), transforms raw data into ava-fusion types, and publishes to NATS subjects. |
| **Type Bridge** | The `convert.rs` module that provides bidirectional `From` implementations between ava-fusion mirror types and asupersync runtime types. |
| **Mirror Type** | An ava-fusion type that mirrors an asupersync type in a serde-friendly, WASM-safe form. |
| **Lossy Conversion** | A type conversion that intentionally drops information (e.g., attribution chains, arena indices). |
| **Lossless Conversion** | A type conversion that preserves all information exactly. |

---

## AVA.4.2 Source Adapter Contract

### AVA.4.2.1 Responsibilities

A source adapter MUST fulfill the following responsibilities:

1. **Connect** to an external data source (REST API, WebSocket, file, etc.)
2. **Transform** raw data into ava-fusion signal types
3. **Publish** normalized signals to the correct NATS subject
   (`sensor.{kind}.{source}.{format}` per [AVA.3](rfc-section-nats-subject-taxonomy.md))
4. **Handle** connection failures with retry and backoff
5. **Respect** rate limits imposed by external sources
6. **Report** metrics to the `ava-metrics` KV bucket

### AVA.4.2.2 NATS Subject Contract

Source adapters MUST publish to subjects following the four-token pattern:

```
sensor.{kind}.{source}.{format}
```

Where:
- `{kind}` is the lowercase SignalKind variant name (e.g., `adsb`, `ais`, `cyber`)
- `{source}` identifies the data source (e.g., `opensky`, `noaa`, `abusech`)
- `{format}` indicates payload encoding (e.g., `json`, `csv`, `raw`, `stix`)

**Normative**: Adapters MUST NOT publish to subjects outside the `sensor.`
namespace. Control messages and status updates use `ctl.adapter.*` subjects.

### AVA.4.2.3 Payload Envelope

Each published message SHOULD include metadata in NATS headers:

| Header | Content | Required |
|--------|---------|----------|
| `Ava-Signal-Kind` | camelCase SignalKind (e.g., `"adsB"`) | SHOULD |
| `Ava-Source-Id` | SignalSourceId string | SHOULD |
| `Ava-Timestamp-Ms` | Epoch milliseconds of the observation | SHOULD |
| `Ava-Data-Type` | `"event"` or `"reference"` | SHOULD |

The message payload MUST contain the signal data in the format indicated by
the subject's `{format}` token.

### AVA.4.2.4 Registration

New source adapters register via the `ctl.adapter.register` subject. The
registration message SHOULD include:

```json
{
  "sourceId": "opensky-live",
  "signalKind": "adsB",
  "dataType": "event",
  "natsSubject": "sensor.adsb.opensky.json",
  "capabilities": ["SPAWN", "IO"]
}
```

Deregistration uses `ctl.adapter.deregister` with the `sourceId`.

---

## AVA.4.3 Type Conversion Bridge

### AVA.4.3.1 Design Rationale

The `convert.rs` module (`ava-fusion-runtime/src/convert.rs`) bridges the
WASM-safe ava-fusion domain types to the asupersync runtime primitives used
by the actor pipeline. This bridge exists because:

1. **ava-fusion** types are `#![forbid(unsafe_code)]`, serde-friendly, and
   WASM-safe — no runtime, no async.
2. **asupersync** types carry arena indices, virtual time stamps, and cancel
   attribution chains that are meaningful only inside a running scheduler.

The module provides lossless `From` conversions where possible and documented
lossy conversions where the domains diverge.

### AVA.4.3.2 Conversion Summary

| ava-fusion Type | asupersync Type | Direction | Lossless? |
|----------------|-----------------|-----------|-----------|
| `FusionSeverity` | `Severity` | Bidirectional | Yes |
| `FusionCancelKind` | `CancelKind` | Bidirectional | Yes |
| `FusionOutcome<T,E>` | `Outcome<T,E>` | Bidirectional | No — see §AVA.4.6 |
| `FusionBudget` | `Budget` | Bidirectional | No — see §AVA.4.7 |
| `FusionObligationState` | `ObligationState` | Bidirectional | Yes |
| `FusionObligationId` | `ObligationId` | Bidirectional | No — see §AVA.4.8 |

---

## AVA.4.4 Severity Conversion

### AVA.4.4.1 Implementation

`FusionSeverity` (`convert.rs:34-41`) maps 1:1 to `asupersync::Severity`
(`convert.rs:101-121`):

| FusionSeverity | Severity | Discriminant |
|----------------|----------|-------------|
| `Ok` | `Ok` | 0 |
| `Err` | `Err` | 1 |
| `Cancelled` | `Cancelled` | 2 |
| `Panicked` | `Panicked` | 3 |

The ordering is preserved: `Ok < Err < Cancelled < Panicked`. This is a
lossless, bidirectional conversion verified by `severity_roundtrip_all_variants()`
(`convert.rs:341-354`).

---

## AVA.4.5 CancelKind Conversion

### AVA.4.5.1 Implementation

`FusionCancelKind` (`convert.rs:44-58`) provides an 11-variant enum matching
all cancellation reasons in asupersync. The conversion is lossless and
bidirectional (`convert.rs:127-161`):

| FusionCancelKind | asupersync::CancelKind |
|------------------|----------------------|
| `User` | `User` |
| `Timeout` | `Timeout` |
| `Deadline` | `Deadline` |
| `PollQuota` | `PollQuota` |
| `CostBudget` | `CostBudget` |
| `FailFast` | `FailFast` |
| `RaceLost` | `RaceLost` |
| `ParentCancelled` | `ParentCancelled` |
| `ResourceUnavailable` | `ResourceUnavailable` |
| `Shutdown` | `Shutdown` |
| `LinkedExit` | `LinkedExit` |

**Normative**: If asupersync adds new `CancelKind` variants, a corresponding
`FusionCancelKind` variant MUST be added and the conversion MUST remain
exhaustive.

---

## AVA.4.6 Outcome Conversion

### AVA.4.6.1 Fusion-to-Runtime (Lossless Direction)

Converting `FusionOutcome<T,E>` to `asupersync::Outcome<T,E>`
(`convert.rs:167-187`):

- `Ok(v)` -> `Ok(v)` — lossless
- `Err(e)` -> `Err(e)` — lossless
- `Cancelled(kind)` -> `Cancelled(CancelReason::new(kind.into()))` — creates
  minimal attribution (testing defaults). The full attribution chain is only
  available inside the runtime scheduler.
- `Panicked(msg)` -> `Panicked(PanicPayload::new(msg))` — wraps message in
  `PanicPayload`.

### AVA.4.6.2 Runtime-to-Fusion (Lossy Direction)

Converting `asupersync::Outcome<T,E>` to `FusionOutcome<T,E>`
(`convert.rs:189-225`):

**Lossy conversions:**
- `Cancelled(reason)` -> `Cancelled(reason.kind.into())` — **only the
  `CancelKind` is preserved**. The full `CancelReason` attribution chain
  (origin region, timestamp, cause chain) is dropped.
- `Panicked(payload)` -> `Panicked(payload.message().to_owned())` — **only
  the message string is preserved**. The `PanicPayload` struct wrapper is
  dropped.

Both owned and borrowed conversions are provided (`convert.rs:189-225`).

### AVA.4.6.3 Severity Method

`FusionOutcome` provides a `severity()` method (`convert.rs:76-85`) returning
the `FusionSeverity` corresponding to the variant:

```rust
impl<T, E> FusionOutcome<T, E> {
    pub fn severity(&self) -> FusionSeverity {
        match self {
            Self::Ok(_) => FusionSeverity::Ok,
            Self::Err(_) => FusionSeverity::Err,
            Self::Cancelled(_) => FusionSeverity::Cancelled,
            Self::Panicked(_) => FusionSeverity::Panicked,
        }
    }
}
```

---

## AVA.4.7 Budget Conversion

### AVA.4.7.1 FusionBudget Definition

`FusionBudget` (`ava-fusion/src/temporal.rs:173-180`) is the serde-friendly
mirror of asupersync's `Budget`:

```rust
pub struct FusionBudget {
    pub deadline_ms: Option<f64>,  // epoch-millisecond deadline (f64 for TS)
    pub poll_quota: u32,           // max poll operations
    pub cost_quota: Option<u64>,   // optional cost limit
    pub priority: u8,              // 0-255, higher = more important
}
```

### AVA.4.7.2 Conversion Functions

Because both `FusionBudget` (ava-fusion) and `Budget` (asupersync) are foreign
types, the orphan rule forbids `From` impls. Free functions are used instead
(`convert.rs:238-265`):

**`fusion_budget_to_runtime(fb: FusionBudget) -> Budget`**:
- `deadline_ms` (f64) is converted to `Time` (u64 nanoseconds) via
  `(ms * 1_000_000.0) as u64` truncation.
- `poll_quota`, `cost_quota`, `priority` map directly.

**`runtime_budget_to_fusion(b: &Budget) -> FusionBudget`**:
- `Time` (u64 nanoseconds) is converted to `f64` milliseconds via
  `t.as_millis() as f64`.
- This is lossless for deadlines below ~285 years from epoch.

### AVA.4.7.3 Precision Loss

Sub-millisecond precision is lost in the roundtrip:
- `1234.567 ms` -> `1_234_567_000 nanos` -> `1234 millis` -> `1234.0 ms`

This is documented and tested in `budget_deadline_precision()`
(`convert.rs:503-518`).

---

## AVA.4.8 ObligationState and ObligationId Conversion

### AVA.4.8.1 ObligationState (Lossless)

`FusionObligationState` (`convert.rs:88-95`) maps 1:1 to
`asupersync::record::ObligationState` (`convert.rs:308-328`):

| FusionObligationState | ObligationState | Lifecycle |
|----------------------|-----------------|-----------|
| `Reserved` | `Reserved` | Initial state |
| `Committed` | `Committed` | Successful resolution (terminal) |
| `Aborted` | `Aborted` | Clean cancellation (terminal) |
| `Leaked` | `Leaked` | ERROR — holder completed without resolving (terminal) |

### AVA.4.8.2 ObligationId (Lossy)

`FusionObligationId` is a branded string. `asupersync::ObligationId` is an
opaque arena index (`{ index: u32, generation: u32 }`). The conversion uses
serde serialization as the bridge (`convert.rs:286-302`):

**`obligation_id_to_fusion(id: &ObligationId) -> FusionObligationId`**:
Serializes the `ObligationId` to JSON (e.g., `{"index":42,"generation":1}`)
and stores the entire JSON string as the `FusionObligationId` value.

**`fusion_to_obligation_id(fid: &FusionObligationId) -> Option<ObligationId>`**:
Attempts to deserialize the string back. Returns `None` if the format does
not match (graceful degradation for hand-crafted IDs).

**Normative**: Implementations MUST NOT rely on the internal format of
`FusionObligationId` strings. The string is opaque and MAY change if
asupersync's `ObligationId` serialization changes.

---

## AVA.4.9 Reference Source Adapter Pattern

### AVA.4.9.1 Reference vs Event Adapters

Source adapters for reference data follow a different pattern than event
stream adapters:

| Aspect | Event Adapter | Reference Adapter |
|--------|---------------|-------------------|
| Publish rate | Continuous | Periodic (per `UpdateRate`) |
| Subject pattern | `sensor.{kind}.{source}.json` | `tsingou.ref.{source}.*` |
| d2ts strategy | Differential stream | Materialised arrangement |
| Staleness | Watermark-governed | TTL-governed (`ttl_seconds`) |
| Registration | Implicit (publish starts) | Explicit via `ReferenceSource` in ontology |

### AVA.4.9.2 ReferenceSource Lifecycle

1. **Declaration**: The reference source is declared in
   `FusionOntologyV2.reference_sources` (`ontology.rs:143-144`).

2. **Startup**: At pipeline start, the adapter connects to the data source,
   fetches the initial dataset, and publishes to its declared NATS subject.

3. **Refresh**: The adapter periodically refreshes according to its
   `UpdateRate`. Updated records are published as new messages; the d2ts
   arrangement replaces stale entries via the key field.

4. **Expiry**: Entries older than `ttl_seconds` are considered stale and
   are evicted from the arrangement.

### AVA.4.9.3 Example: FAA Aircraft Registry

```json
{
  "id": "faa-registry",
  "signalKind": "faa-db",
  "entityClass": "Aircraft",
  "keyField": "icao_hex",
  "updateRate": "daily",
  "natsSubject": "tsingou.ref.faa.*",
  "ttlSeconds": 86400.0
}
```

The adapter:
1. Downloads the FAA MASTER file daily
2. Parses to JSON records
3. Publishes each record to `tsingou.ref.faa.{icao_hex}`
4. The d2ts arrangement materialises the latest record per ICAO hex
5. Event-stream joins probe the arrangement by `icao_hex` for O(1) enrichment

---

## AVA.4.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.4-R1 | Source adapters MUST publish to `sensor.{kind}.{source}.{format}` subjects only | MUST |
| AVA.4-R2 | All type conversions MUST be documented as lossless or lossy with specific details | MUST |
| AVA.4-R3 | Lossy runtime-to-fusion Outcome conversion MUST preserve at minimum the CancelKind | MUST |
| AVA.4-R4 | Budget deadline precision loss (sub-millisecond) MUST be documented | MUST |
| AVA.4-R5 | FusionObligationId string format MUST be treated as opaque by consumers | MUST |
| AVA.4-R6 | Reference source adapters MUST declare their registration in FusionOntologyV2 | MUST |
| AVA.4-R7 | Reference source TTL MUST be governed by `ttl_seconds`, not `UpdateRate` alone | MUST |
| AVA.4-R8 | New CancelKind variants in asupersync MUST be reflected in FusionCancelKind | MUST |
| AVA.4-R9 | Source adapters SHOULD include signal metadata in NATS headers | SHOULD |
| AVA.4-R10 | Source adapters MUST NOT publish to subjects outside the `sensor.` namespace | MUST |

---

## AVA.4.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [ava-fusion signal.rs] `ava-fusion/src/signal.rs` — DataType, ReferenceSource, UpdateRate
- [ava-fusion temporal.rs] `ava-fusion/src/temporal.rs` — FusionBudget
- [ava-fusion output.rs] `ava-fusion/src/output.rs` — FusionOutcome, FusionSeverity
- [ava-fusion-runtime convert.rs] `ava-fusion-runtime/src/convert.rs` — Type bridge (633 lines)
- [ava-fusion ontology.rs] `ava-fusion/src/ontology.rs` — FusionOntologyV2.reference_sources
- [AVA.1] [Pipeline Architecture](rfc-section-pipeline-architecture.md) — Crate boundary
- [AVA.2] [Signal Schema](rfc-section-signal-schema.md) — SignalKind, DataType, ReferenceSource
- [AVA.3] [NATS Subject Taxonomy](rfc-section-nats-subject-taxonomy.md) — Subject patterns

---

*End of section AVA.4*
