# AVA.5 JetStream Persistence

```
Section:       AVA.5 — JetStream Persistence
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Ingest (Normative)
Prerequisites: AVA.3 (NATS Subject Taxonomy), AVA.4 (Source Adapters)
Feeds:         AVA.6 (Actor Model), AVA.14 (Deployment Topology)
```

> This section specifies the JetStream persistence layer for the ava-fusion
> pipeline, including the NATS KV store, NATS Object Store, temporal watermark
> configuration, late arrival policies, and the FusionBudget resource
> governance model. Persistent state is managed through two JetStream-backed
> abstractions: `NatsKvStore` for key-value entity/track state and
> `NatsObjectStore` for chunked blob storage (IQ samples, model weights).
> The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
> "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
> "OPTIONAL" in this document are to be interpreted as described in [RFC2119]
> and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava51-conventions-and-terminology)
2.  [NATS KV Store](#ava52-nats-kv-store)
3.  [KV Operations](#ava53-kv-operations)
4.  [KV Watch Mechanism](#ava54-kv-watch-mechanism)
5.  [NATS Object Store](#ava55-nats-object-store)
6.  [Object Store Operations](#ava56-object-store-operations)
7.  [Watermark Configuration](#ava57-watermark-configuration)
8.  [Late Arrival Policies](#ava58-late-arrival-policies)
9.  [Temporal Join Configuration](#ava59-temporal-join-configuration)
10. [FusionBudget Resource Governance](#ava510-fusionbudget-resource-governance)
11. [Normative Requirements Summary](#ava511-normative-requirements-summary)
12. [References](#ava512-references)

---

## AVA.5.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.5.1.1 Terminology

| Term | Definition |
|------|-----------|
| **NATS KV Store** | A key-value abstraction built atop JetStream (`ava-fusion-runtime/src/nats_kv.rs`). Stream name `KV_{bucket}`, subjects `$KV.{bucket}.{key}`. |
| **NATS Object Store** | Chunked blob storage atop JetStream (`ava-fusion-runtime/src/nats_object.rs`). Stream name `OBJ_{bucket}`. |
| **Tombstone** | An empty-payload message that marks a KV key as deleted. |
| **Watermark** | A monotonically advancing timestamp that tracks progress in event-time processing. |
| **Late Arrival** | A signal whose event-time is before the current watermark. |
| **Cx** | The asupersync cancel-aware context. All persistence operations accept `&Cx`. |

---

## AVA.5.2 NATS KV Store

### AVA.5.2.1 Architecture

`NatsKvStore` (`nats_kv.rs:197-448`) implements a key-value store atop
JetStream following NATS KV protocol conventions:

```
┌──────────────────────────────────────────────────┐
│  JetStream Stream: KV_{bucket}                   │
│  Subjects: $KV.{bucket}.>                        │
│  Retention: Limits                               │
│  Storage: File                                   │
│                                                  │
│  $KV.ava_state.entity.pump001  -> "online"       │
│  $KV.ava_state.track.t-001    -> {json}          │
│  $KV.ava_config.pipeline.main -> {ontology}      │
└──────────────────────────────────────────────────┘
```

### AVA.5.2.2 Key Format

NATS KV keys become NATS subjects (`$KV.{bucket}.{key}`). The key format is
strictly validated by `validate_key()` (`nats_kv.rs:462-484`):

| Rule | Valid | Invalid | Reason |
|------|-------|---------|--------|
| Dots as separators | `entity.pump001` | `entity:pump001` | Colons invalid in NATS subjects |
| Multi-level keys | `track.sensor.001` | | Dots create subject hierarchy |
| Alphanumeric + dash/underscore | `my-key_123` | `has space` | Whitespace invalid |
| Non-empty | `a` | `""` | Empty keys rejected |
| No null bytes | `key` | `key\0` | Null bytes rejected |

**Normative**: KV keys MUST use dots (`.`) as separators, MUST NOT use
colons (`:`), and MUST NOT contain whitespace or null bytes.

### AVA.5.2.3 NatsKvStore Configuration

```rust
pub struct NatsKvStore {
    bucket: String,                      // Bucket name
    js: JetStreamContext,                // JetStream API handle
    max_value_size: usize,               // Default: 1MB (1_048_576)
    ttl: Option<Duration>,               // Entry expiry (None = forever)
}
```

Builder methods (`nats_kv.rs:237-247`):
- `with_ttl(Duration)` — set entry TTL
- `with_max_value_size(usize)` — set max value size

### AVA.5.2.4 Bucket Creation

`create_bucket()` (`nats_kv.rs:269-286`) creates or updates the backing
JetStream stream:

```rust
StreamConfig::new(format!("KV_{}", bucket))
    .subjects(&[&format!("$KV.{}.>", bucket)])
    .retention(RetentionPolicy::Limits)
    .storage(StorageType::File)
    .replicas(1)
```

If a TTL is configured, `max_age` is set on the stream. The operation is
idempotent.

### AVA.5.2.5 Bucket Catalog

| Bucket | Key Pattern | Value | Purpose |
|--------|------------|-------|---------|
| `ava-config` | `pipeline.{name}` | JSON PipelineConfig | Runtime configuration |
| `ava-config` | `joinpath.{id}` | JSON JoinPathEntryV2 | Join path definitions |
| `ava-state` | `entity.{entity_id}` | JSON EntityState | Latest entity state |
| `ava-state` | `track.{track_id}` | JSON TrackState | Latest track state |
| `ava-metrics` | `actor.{name}.stats` | JSON ActorMetrics | Performance counters |
| `ava-schemas` | `signal.{kind}` | JSON Schema | Signal payload schemas |

---

## AVA.5.3 KV Operations

### AVA.5.3.1 CRUD Operations

| Operation | Method | Behavior |
|-----------|--------|----------|
| **Put** | `put(cx, key, value) -> Result<u64, KvError>` | Publishes to `$KV.{bucket}.{key}`, returns revision (sequence number). Validates value size against `max_value_size`. |
| **Get** | `get(cx, key) -> Result<Option<KvEntry>, KvError>` | Ephemeral consumer with `DeliverPolicy::Last`. Returns `None` for missing keys or tombstones. |
| **Delete** | `delete(cx, key)` | Publishes empty payload (tombstone). Key appears deleted to subsequent gets. |
| **Keys** | `keys(cx) -> Result<Vec<String>, KvError>` | `DeliverPolicy::LastPerSubject`, pulls in batches of 100, skips tombstones. |
| **Watch** | `watch(cx, pattern) -> Result<KvWatcher, KvError>` | See §AVA.5.4. |

### AVA.5.3.2 Error Types

`KvError` (`nats_kv.rs:57-101`):

| Variant | Cause |
|---------|-------|
| `JetStream(JsError)` | Underlying JetStream operation failed |
| `InvalidKey(String)` | Key contains invalid characters or value too large |
| `BucketNotFound(String)` | Bucket stream does not exist |
| `RevisionConflict { key, expected, actual }` | Optimistic concurrency violation |

---

## AVA.5.4 KV Watch Mechanism

### AVA.5.4.1 Watch Operation

`watch(cx, key_pattern)` (`nats_kv.rs:370-391`) creates a `KvWatcher` that
subscribes to changes matching a subject pattern:

| Pattern | Matches |
|---------|---------|
| `entity.>` | All keys starting with `entity.` |
| `entity.*` | Single-level keys like `entity.pump001` |
| `>` | All keys in the bucket |

### AVA.5.4.2 KvWatcher

`KvWatcher` (`nats_kv.rs:135-185`) yields `KvEntry` values as keys change.
Each entry contains:

```rust
pub struct KvEntry {
    pub key: String,       // Without bucket prefix
    pub value: Vec<u8>,    // Empty for tombstones
    pub revision: u64,     // Stream sequence number
    pub is_delete: bool,   // True for tombstone entries
}
```

The `next()` method (`nats_kv.rs:151-185`) pulls one message with a 5-second
timeout. The bucket prefix (`$KV.{bucket}.`) is stripped from the subject
to produce the clean key.

---

## AVA.5.5 NATS Object Store

### AVA.5.5.1 Architecture

`NatsObjectStore` (`nats_object.rs:163-473`) implements chunked blob storage
atop JetStream:

```
┌──────────────────────────────────────────────────┐
│  JetStream Stream: OBJ_{bucket}                  │
│  Subjects: $O.{bucket}.C.> , $O.{bucket}.M.>    │
│  Retention: Limits                               │
│  Storage: File                                   │
│                                                  │
│  Chunks:   $O.ava_blobs.C.{nuid}                 │
│  Metadata: $O.ava_blobs.M.{name}                 │
└──────────────────────────────────────────────────┘
```

Two subject namespaces within the same stream:
- `$O.{bucket}.C.{nuid}` — chunk data (sequential messages per object)
- `$O.{bucket}.M.{name}` — object metadata (JSON)

### AVA.5.5.2 Configuration

```rust
pub struct NatsObjectStore {
    bucket: String,
    js: JetStreamContext,
    chunk_size: usize,   // Default: 128KB (128 * 1024)
}
```

Builder method: `with_chunk_size(usize)` (`nats_object.rs:207-211`).

### AVA.5.5.3 Use Cases

| Use Case | Object Name Pattern | Typical Size |
|----------|-------------------|-------------|
| IQ samples | `iq.{signal_id}.{timestamp}` | 1-100 MB |
| Model weights | `model.{name}.{version}` | 10-500 MB |
| Satellite imagery tiles | `tile.{source}.{z}.{x}.{y}` | 100 KB - 10 MB |

---

## AVA.5.6 Object Store Operations

### AVA.5.6.1 CRUD Operations

| Operation | Method | Key Behavior |
|-----------|--------|-------------|
| **Put** | `put(cx, name, data)` | Splits into chunks, publishes to `$O.{bucket}.C.{nuid}`, then metadata to `$O.{bucket}.M.{name}` |
| **Get** | `get(cx, name)` | Reads metadata, fetches chunks by NUID, reassembles, performs integrity check (`actual_size == metadata.size`) |
| **Delete** | `delete(cx, name)` | Publishes delete marker (`deleted: true`). Chunks remain until purge. |
| **List** | `list(cx)` | `DeliverPolicy::LastPerSubject` on metadata namespace, filters deleted objects |
| **Info** | `info(cx, name)` | Returns `ObjectInfo` metadata without fetching chunks |

### AVA.5.6.2 Object Metadata

`ObjectInfo` (`nats_object.rs:108-157`) tracks name, size, chunk count,
chunk size, NUID, and deleted flag. Metadata serializes as hand-built JSON
(no serde dependency for the metadata path).

### AVA.5.6.3 Validation and Errors

Object names MUST NOT be empty, MUST NOT contain whitespace/null bytes,
and MUST NOT contain wildcards (`>`, `*`) — unlike KV keys which allow
wildcards for watch patterns.

`ObjectError` variants: `JetStream`, `NotFound`, `InvalidName`,
`IntegrityError { expected_size, actual_size }`, `MetadataError`.

---

## AVA.5.7 Watermark Configuration

### AVA.5.7.1 WatermarkConfig

`WatermarkConfig` (`ava-fusion/src/temporal.rs:58-64`) controls out-of-order
tolerance:

```rust
pub struct WatermarkConfig {
    pub max_out_of_order_ms: u64,  // Maximum allowed lateness
    pub idle_timeout_ms: u64,      // Advance to processing-time after silence
}
```

Serializes as `camelCase`: `"maxOutOfOrderMs"`, `"idleTimeoutMs"`.

### AVA.5.7.2 Watermark Semantics

The watermark is a monotonically advancing timestamp:

```
watermark = max(event_time of all received signals) - max_out_of_order_ms
```

After `idle_timeout_ms` of silence from a source, the watermark advances to
processing time. This prevents a stalled source from blocking progress.

### AVA.5.7.3 Timestamp Validation

`TimestampValidation` (`temporal.rs:103-117`) defines bounds for clock skew
detection:

| Field | Default | Purpose |
|-------|---------|---------|
| `max_future_ms` | 5,000 | Max event-time ahead of processing-time |
| `max_past_ms` | 3,600,000 (1 hour) | Max age before side-channel routing |

### AVA.5.7.4 Clock Skew Policy

`ClockSkewPolicy` (`temporal.rs:130-142`) handles detected skew:

| Variant | Action |
|---------|--------|
| `Reject` | Drop the signal entirely |
| `Correct` | Clamp to processing-time + tolerance (default) |
| `Flag` | Accept as-is but flag for operator review |

---

## AVA.5.8 Late Arrival Policies

### AVA.5.8.1 LateArrivalPolicy

`LateArrivalPolicy` (`temporal.rs:42-46`) determines handling of signals
that arrive after their watermark has passed:

| Policy | Action | Use Case |
|--------|--------|----------|
| `Drop` | Discard, log, emit LateDrop event | High-volume streams where recalculation is too expensive |
| `Reprocess` | Accept update, retract and re-emit affected outputs | Correctness-critical fusion (identity resolution) |
| `SideChannel` | Route to separate stream for offline review | Forensic analysis, audit trail |

### AVA.5.8.2 Per-Source Lateness and Asymmetric Windows

`AllowedLateness` (`temporal.rs:74-76`) specifies per-source tolerance via
`duration_ms`. `JoinWindow` (`temporal.rs:87-92`) defines asymmetric temporal
search bounds with `before_ms` and `after_ms`, enabling rate-asymmetric
probes (e.g., high-rate ADS-B probing low-rate AIS with a larger `before_ms`).

---

## AVA.5.9 Temporal Join Configuration

### AVA.5.9.1 TemporalJoinMode

`TemporalJoinMode` (`temporal.rs:22-28`) selects the join strategy based
on rate ratio between the two sides:

| Mode | Rate Ratio | Strategy |
|------|-----------|----------|
| `Windowed` | < 10 | Both sides are comparable-rate streams |
| `EventTable` | >= 10 | Fast side probes slow side's latest snapshot |
| `Reference` | infinity | One side is static reference data |

### AVA.5.9.2 TemporalJoinConfig

`TemporalJoinConfig` (`temporal.rs:152-158`) combines mode, late arrival
policy, and watermark into a single per-join-path configuration:

```rust
pub struct TemporalJoinConfig {
    pub mode: TemporalJoinMode,
    pub late_arrival_policy: LateArrivalPolicy,
    pub watermark: WatermarkConfig,
}
```

### AVA.5.9.3 Join Path Integration

Each `JoinPathEntryV2` (defined in `ava-fusion/src/join_path.rs`) carries
optional temporal fields:

| Field | Type | Purpose |
|-------|------|---------|
| `temporal_window_ms` | `Option<u64>` | Symmetric window width |
| `late_arrival_policy` | `Option<String>` | Policy name |
| `join_mode` | `Option<TemporalJoinMode>` | Override auto-detection |

When `temporal_window_ms` is `Some`, the join compiler creates a windowed
operator. When `None`, the join operates in streaming mode without
temporal constraints.

---

## AVA.5.10 FusionBudget Resource Governance

### AVA.5.10.1 Definition

`FusionBudget` (`temporal.rs:173-180`) governs resource allocation per
processing operation:

```rust
pub struct FusionBudget {
    pub deadline_ms: Option<f64>,   // Epoch-ms deadline (optional)
    pub poll_quota: u32,            // Max poll operations
    pub cost_quota: Option<u64>,    // Abstract cost limit (optional)
    pub priority: u8,               // 0-255 (higher = more important)
}
```

### AVA.5.10.2 Budget Enforcement

Optional fields (`deadline_ms`, `cost_quota`) are omitted from JSON when
`None`. When the runtime converts to `asupersync::Budget`
(see [AVA.4](rfc-section-source-adapters.md) §4.7), exhaustion of any limit
produces a `Cancelled` outcome: `Deadline`, `PollQuota`, or `CostBudget`.
Higher `priority` values are scheduled first under congestion.

All pipeline actors use `Budget::MINIMAL` except `FusionEngine`, which
receives a custom budget driven by the ontology's join path complexity.

---

## AVA.5.11 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.5-R1 | KV keys MUST use dots as separators, MUST NOT use colons | MUST |
| AVA.5-R2 | KV keys MUST NOT contain whitespace or null bytes | MUST |
| AVA.5-R3 | KV bucket streams MUST be named `KV_{bucket}` | MUST |
| AVA.5-R4 | Object Store streams MUST be named `OBJ_{bucket}` | MUST |
| AVA.5-R5 | Object Store MUST perform integrity check on retrieval (size match) | MUST |
| AVA.5-R6 | Object names MUST NOT contain wildcards (`>`, `*`) | MUST |
| AVA.5-R7 | Watermark MUST advance monotonically; idle timeout MUST advance to processing-time | MUST |
| AVA.5-R8 | Late arrival policy MUST be declared per join path in the ontology | MUST |
| AVA.5-R9 | FusionBudget deadline/cost/poll exhaustion MUST produce Cancelled outcomes | MUST |
| AVA.5-R10 | All persistence operations MUST accept a `&Cx` for cooperative cancellation | MUST |

---

## AVA.5.12 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [NATS KV] https://docs.nats.io/nats-concepts/jetstream/key-value-store
- [NATS Object Store] https://docs.nats.io/nats-concepts/jetstream/obj_store
- [ava-fusion temporal.rs] `ava-fusion/src/temporal.rs` — Watermark, LateArrivalPolicy, FusionBudget
- [ava-fusion-runtime nats_kv.rs] `ava-fusion-runtime/src/nats_kv.rs` — NatsKvStore (601 lines)
- [ava-fusion-runtime nats_object.rs] `ava-fusion-runtime/src/nats_object.rs` — NatsObjectStore (736 lines)
- [AVA.3] [NATS Subject Taxonomy](rfc-section-nats-subject-taxonomy.md) — KV bucket naming, stream mapping
- [AVA.4] [Source Adapters](rfc-section-source-adapters.md) — Type bridge, budget conversion

---

*End of section AVA.5*
