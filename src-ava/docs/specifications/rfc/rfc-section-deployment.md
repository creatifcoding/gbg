# AVA.14 Deployment Topology

```
Section:       AVA.14 — Deployment Topology
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          IV — Output (Normative)
Prerequisites: AVA.5 (JetStream Persistence), AVA.7 (Supervision Tree)
Feeds:         AVA.15 (E2E Testing Strategy)
```

> This section specifies the deployment topology for the ava-fusion pipeline,
> including workspace crate architecture, dependency stratification, NATS
> KV/Object Store configuration, and operational deployment modes. The key
> words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
> "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in
> this document are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava141-conventions-and-terminology)
2.  [Workspace Architecture](#ava142-workspace-architecture)
3.  [Dependency Graph](#ava143-dependency-graph)
4.  [WASM-Safe Types Crate](#ava144-wasm-safe-types-crate)
5.  [Runtime Crate](#ava145-runtime-crate)
6.  [NATS KV Store in Production](#ava146-nats-kv-store-in-production)
7.  [NATS Object Store in Production](#ava147-nats-object-store-in-production)
8.  [Deployment Modes](#ava148-deployment-modes)
9.  [NATS Cluster Topology](#ava149-nats-cluster-topology)
10. [Normative Requirements Summary](#ava1410-normative-requirements-summary)
11. [References](#ava1411-references)

---

## AVA.14.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.14.1.1 Terminology

| Term | Definition |
|------|-----------|
| **Types Crate** | `ava-fusion` — the domain ontology crate with no async/runtime dependencies |
| **Runtime Crate** | `ava-fusion-runtime` — async actors, dataflow, and NATS integration |
| **Vendor Crate** | A workspace crate under `vendor/` providing algorithmic foundations |
| **KV Bucket** | A NATS JetStream key-value store (`$KV.{bucket}.{key}`) |
| **Object Store** | A NATS JetStream chunked blob store (`$O.{bucket}.{C|M}.{id}`) |
| **asupersync** | The structured concurrency runtime providing GenServer, Cx, and Budget |

---

## AVA.14.2 Workspace Architecture

### AVA.14.2.1 Workspace Members

Source: `Cargo.toml:1-8`

```toml
[workspace]
members = [
    "ava-fusion",
    "ava-fusion-runtime",
    "vendor/franken-kernel",
    "vendor/franken-evidence",
    "vendor/franken-decision",
]
resolver = "2"
```

The workspace contains five crates organized into three tiers:

| Tier | Crate | Role | Edition |
|------|-------|------|---------|
| Types | `ava-fusion` | Domain ontology, WASM-safe | 2021 |
| Runtime | `ava-fusion-runtime` | Actors, dataflow, NATS | 2024 |
| Vendor | `franken-kernel` | Core math/algebra | 2021 |
| Vendor | `franken-evidence` | Evidence theory algorithms | 2021 |
| Vendor | `franken-decision` | Decision-theoretic models | 2021 |

**AVA.14-R1**: The workspace MUST use Cargo resolver version 2 to ensure
proper feature unification across workspace members.

### AVA.14.2.2 Shared Dependencies

Source: `Cargo.toml:16-26`

```toml
[workspace.dependencies]
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "2.0"
tracing = "0.1"
parking_lot = "0.12"
pretty_assertions = "1.4"
typeshare = "1.0"
franken-kernel = { path = "vendor/franken-kernel" }
franken-evidence = { path = "vendor/franken-evidence" }
franken-decision = { path = "vendor/franken-decision" }
```

**AVA.14-R2**: All crates MUST reference shared dependencies via
`workspace = true` declarations to ensure version consistency.

---

## AVA.14.3 Dependency Graph

### AVA.14.3.1 Crate Dependency Hierarchy

```
franken-kernel (no deps)
    |
    +-- franken-evidence (franken-kernel)
    |
    +-- franken-decision (franken-kernel)
    |
    +-- ava-fusion (serde, serde_json, typeshare, thiserror, franken-kernel)
            |
            +-- ava-fusion-runtime (ava-fusion, asupersync, differential-dataflow,
                                    timely, nalgebra, h3o, rustfft, realfft, ...)
```

### AVA.14.3.2 ava-fusion Dependencies

Source: `ava-fusion/Cargo.toml:9-14`

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `serde` | 1.0 + derive | Serialization for all domain types |
| `serde_json` | 1.0 | JSON encoding for TypeScript/WASM consumers |
| `typeshare` | 1.0 | TypeScript type generation via `#[typeshare]` |
| `thiserror` | 2.0 | Error type derivation |
| `franken-kernel` | workspace | Core mathematical primitives |

### AVA.14.3.3 ava-fusion-runtime Dependencies

Source: `ava-fusion-runtime/Cargo.toml:9-23`

| Dependency | Version | Purpose |
|-----------|---------|---------|
| `ava-fusion` | path | Domain ontology types |
| `asupersync` | v0.2.5 (git) | Structured concurrency: GenServer, Cx, Budget |
| `differential-dataflow` | 0.18.0 | Incremental dataflow computation |
| `timely` | 0.25 | Timely Dataflow runtime |
| `nalgebra` | 0.33 | Linear algebra (Kalman filters, EKF) |
| `h3o` | 0.6 | H3 hexagonal spatial indexing |
| `rustfft` / `realfft` | 6.2 / 3 | FFT for periodicity detection |
| `find_peaks` | 0.1 | Spectral peak detection |
| `crossbeam-channel` | 0.5 | Lock-free MPMC channels |
| `parking_lot` | 0.12 | Fast synchronization primitives |
| `tracing` | 0.1 | Structured logging |

**AVA.14-R3**: The `asupersync` dependency MUST be pinned to a specific git
tag (currently `v0.2.5`) to ensure reproducible builds and prevent supply
chain drift.

---

## AVA.14.4 WASM-Safe Types Crate

### AVA.14.4.1 Design Constraints

The `ava-fusion` crate is designed for dual-target compilation:
- **Native**: Used by `ava-fusion-runtime` actors and dataflow
- **WASM**: Used by TypeScript/browser consumers via `typeshare`

**AVA.14-R4**: The `ava-fusion` crate MUST NOT depend on async runtimes,
operating system APIs, or network libraries. All types MUST derive `Serialize`
and `Deserialize` for cross-boundary compatibility.

### AVA.14.4.2 typeshare Annotations

Every public type in `ava-fusion` carries the `#[typeshare]` attribute,
enabling automatic TypeScript type generation. Examples:

Source: `ava-fusion/src/output.rs:31`, `ava-fusion/src/risk.rs:26`

```rust
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FusedDatum { ... }
```

The `serde(rename_all = "camelCase")` convention ensures JSON field names
match TypeScript naming conventions without manual mapping.

### AVA.14.4.3 Edition Strategy

`ava-fusion` uses Rust edition 2021 for maximum compatibility with WASM
toolchains. `ava-fusion-runtime` uses edition 2024 to leverage the latest
async ergonomics (async closures, `gen` blocks when stabilized).

**AVA.14-R5**: The types crate MUST remain on a stable Rust edition
compatible with `wasm32-unknown-unknown` targets. The runtime crate MAY
use nightly-gated features via edition 2024.

---

## AVA.14.5 Runtime Crate

### AVA.14.5.1 Module Organization

Source: `ava-fusion-runtime/src/`

| Module | Contents | Key Types |
|--------|----------|-----------|
| `actors/` | GenServer actors | AlarmEvaluator, AbsenceDetector, SensorIngestor, FusionEngine, TrackManager, EntityResolver |
| `risk/` | Risk pipeline | accumulation, cusum, decay, alert_suppression |
| `dataflow/` | Differential dataflow | blocking, scoring, graph, worker |
| `tracking/` | Target tracking | EKF, IMM, SPRT, fusion |
| `signal/` | Signal processing | periodicity detection |
| `graph/` | Graph analytics | Louvain, PageRank, triangle counting |
| `cep/` | Complex event processing | NFA evaluator, shared buffer |
| `nats_kv.rs` | NATS KV store | NatsKvStore, KvEntry, KvWatcher |
| `nats_object.rs` | NATS Object Store | NatsObjectStore, ObjectInfo |
| `convert.rs` | Type conversions | Signal/entity mappings |

### AVA.14.5.2 asupersync Integration

All actors implement the `GenServer` trait from asupersync v0.2.5:

```rust
impl GenServer for AlarmEvaluator {
    type Call = AlarmCall;
    type Reply = AlarmAck;
    type Cast = AlarmCast;
    type Info = AlarmInfo;
    // ...
}
```

Source: `ava-fusion-runtime/src/actors/alarm_evaluator.rs:216-221`

The structured concurrency model provides:
- **Cx** context for cancellation propagation and tracing
- **Budget** for computation time bounds
- **Reply<T>** obligations for guaranteed response delivery

---

## AVA.14.6 NATS KV Store in Production

### AVA.14.6.1 Bucket Configuration

Source: `ava-fusion-runtime/src/nats_kv.rs:197-286`

Each KV bucket maps to a JetStream stream named `KV_{bucket}` capturing
subjects `$KV.{bucket}.>`.

| Bucket | Keys | Value | Purpose |
|--------|------|-------|---------|
| `ava_config` | `pipeline.{name}` | JSON PipelineConfig | Runtime configuration |
| `ava_config` | `joinpath.{id}` | JSON JoinPathEntryV2 | Join path definitions |
| `ava_state` | `entity.{id}` | JSON EntityState | Latest entity state |
| `ava_state` | `track.{id}` | JSON TrackState | Latest track state |
| `ava_metrics` | `actor.{name}.stats` | JSON ActorMetrics | Performance counters |

**AVA.14-R6**: KV bucket keys MUST use dots (`.`) as separators. Colons
(`:`) are INVALID because NATS KV keys become NATS subjects internally
(`$KV.{bucket}.{key}`). This is enforced by `validate_key` at
`ava-fusion-runtime/src/nats_kv.rs:462-484`.

### AVA.14.6.2 Key Validation

Source: `ava-fusion-runtime/src/nats_kv.rs:462-484`

```rust
fn validate_key(key: &str) -> Result<(), KvError> {
    if key.is_empty() { return Err(KvError::InvalidKey(...)); }
    for ch in key.chars() {
        match ch {
            ':' => return Err(KvError::InvalidKey(...)),
            ' ' | '\t' | '\n' | '\r' | '\0' => return Err(KvError::InvalidKey(...)),
            _ => {}
        }
    }
    Ok(())
}
```

### AVA.14.6.3 Revision Tracking

Source: `ava-fusion-runtime/src/nats_kv.rs:66-73`

Optimistic concurrency via JetStream sequence numbers. `RevisionConflict`
is returned when a conditional update finds an unexpected revision.

### AVA.14.6.4 Watch Mechanism

Source: `ava-fusion-runtime/src/nats_kv.rs:370-391`

KV watches use ephemeral JetStream consumers with `DeliverPolicy::New` to
receive change notifications. The watcher filters by subject pattern,
enabling subscriptions like `entity.>` for all entity state changes.

---

## AVA.14.7 NATS Object Store in Production

### AVA.14.7.1 Chunked Blob Storage

Source: `ava-fusion-runtime/src/nats_object.rs:163-473`

Large objects (IQ samples, model weights, snapshot archives) are stored using
the NATS Object Store protocol:

| Subject Pattern | Purpose |
|----------------|---------|
| `$O.{bucket}.C.{nuid}` | Object data chunks |
| `$O.{bucket}.M.{name}` | Object metadata |

The backing JetStream stream is named `OBJ_{bucket}` and captures both
chunk and meta subject namespaces.

### AVA.14.7.2 Chunking Strategy

Default chunk size: 128KB (`NatsObjectStore::DEFAULT_CHUNK_SIZE`).

Source: `ava-fusion-runtime/src/nats_object.rs:192`

```rust
pub const DEFAULT_CHUNK_SIZE: usize = 128 * 1024;
```

Objects are split into chunks, published sequentially, followed by a
metadata message containing name, size, chunk count, and a unique NUID.

**AVA.14-R7**: Object Store chunk size SHOULD be 128KB for general workloads.
Operators MAY configure smaller chunks for high-latency links or larger
chunks for bulk data ingestion.

### AVA.14.7.3 Integrity Verification

Source: `ava-fusion-runtime/src/nats_object.rs:354-359`

On retrieval, the reassembled object size MUST match the metadata-declared
size. Size mismatches produce `ObjectError::IntegrityError`.

### AVA.14.7.4 Delete Semantics

Deletion publishes a metadata tombstone (`deleted: true`) rather than
purging chunks. Chunks remain until stream TTL or explicit purge.

---

## AVA.14.8 Deployment Modes

### AVA.14.8.1 Single-Node Development

```
+----------------------------------+
|  Host Machine                     |
|  +------------------------------+|
|  | NATS Server (embedded)        ||
|  | JetStream (file storage)      ||
|  +------------------------------+|
|  | ava-fusion-runtime            ||
|  |  +- SensorIngestor(s)        ||
|  |  +- FusionEngine             ||
|  |  +- TrackManager             ||
|  |  +- AlarmEvaluator           ||
|  |  +- AbsenceDetector          ||
|  |  +- EntityResolver           ||
|  +------------------------------+|
+----------------------------------+
```

All actors run in a single process under the asupersync supervision tree.
NATS runs embedded or as a local sidecar. JetStream uses file-backed storage.

**AVA.14-R8**: Single-node deployments MUST support the complete actor
ensemble with a single NATS server. JetStream MUST use file storage for
durability across restarts.

### AVA.14.8.2 Distributed Production

```
+------------------+    +------------------+    +------------------+
| Ingest Node 1    |    | Ingest Node 2    |    | Ingest Node 3    |
| SensorIngestor   |    | SensorIngestor   |    | SensorIngestor   |
| (AdsB, Ais)      |    | (Cyber, Dns)     |    | (Osint, Social)  |
+--------+---------+    +--------+---------+    +--------+---------+
         |                       |                       |
    +----+---+---+---+---+---+---+---+---+---+---+---+---+
    |                    NATS Cluster                      |
    |  N1 (leader)    N2 (follower)    N3 (follower)      |
    +----+---+---+---+---+---+---+---+---+---+---+---+---+
         |                       |                       |
+--------+---------+    +--------+---------+    +--------+---------+
| Fusion Node 1    |    | Fusion Node 2    |    | Output Node      |
| FusionEngine     |    | TrackManager     |    | AlarmEvaluator   |
| EntityResolver   |    | AbsenceDetector  |    | AlertSuppressor  |
| Dataflow Workers |    | Graph Analytics  |    | Dashboard API    |
+------------------+    +------------------+    +------------------+
```

**AVA.14-R9**: Distributed deployments MUST use a NATS cluster with at
least 3 nodes for JetStream replication. Stream replicas MUST be set to
match the cluster size for fault tolerance.

### AVA.14.8.3 Data Flow in Distributed Mode

1. **Ingest Nodes** subscribe to `sensor.{kind}.>` and publish parsed data
2. **NATS JetStream** persists all sensor data in domain-specific streams
3. **Fusion Nodes** consume from JetStream with pull-based delivery
4. **Output Nodes** subscribe to `fusion.>` and `alarm.>` subjects
5. **Dashboard API** queries KV stores for latest entity/track state

---

## AVA.14.9 NATS Cluster Topology

### AVA.14.9.1 JetStream Streams (Production)

| Stream | Subjects | Retention | Max Age | Replicas |
|--------|----------|-----------|---------|----------|
| `SENSOR_KINETIC` | `sensor.adsb.>`, `sensor.ais.>`, `sensor.radar.>`, `sensor.satellite.>` | Limits | 24h | 3 |
| `SENSOR_RF` | `sensor.rfbearing.>`, `sensor.sdr.>`, `sensor.sigint.>`, `sensor.elint.>`, `sensor.comint.>` | Limits | 24h | 3 |
| `SENSOR_CYBER` | `sensor.http.>`, `sensor.dns.>`, `sensor.cyber.>` | Limits | 72h | 3 |
| `SENSOR_OSINT` | `sensor.osint.>`, `sensor.social.>`, `sensor.financial.>`, `sensor.travel.>` | Limits | 72h | 3 |
| `SENSOR_GEO` | `sensor.geoint.>`, `sensor.humint.>`, `sensor.masint.>` | Limits | 168h | 3 |
| `FUSION_RESULTS` | `fusion.>` | Limits | 168h | 3 |
| `ALARMS` | `alarm.>` | Interest | 720h | 3 |

See [AVA.3](rfc-section-nats-subject-taxonomy.md) for complete subject taxonomy.

### AVA.14.9.2 KV Buckets (Production)

| Bucket | Storage | Replicas | TTL | Max Value |
|--------|---------|----------|-----|-----------|
| `ava_config` | File | 3 | None | 1MB |
| `ava_state` | File | 3 | 24h | 1MB |
| `ava_metrics` | Memory | 1 | 1h | 64KB |

### AVA.14.9.3 Object Stores (Production)

| Bucket | Chunk Size | Storage | Max Object |
|--------|-----------|---------|------------|
| `ava_blobs` | 128KB | File | 256MB |
| `ava_snapshots` | 128KB | File | 1GB |

**AVA.14-R10**: Production NATS clusters MUST configure JetStream with
file-backed storage. KV buckets containing operational state (`ava_state`)
MUST have TTL configured to prevent unbounded growth. Metrics buckets
MAY use memory storage for lower latency.

---

## AVA.14.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.14-R1 | Workspace MUST use Cargo resolver version 2 | MUST |
| AVA.14-R2 | All crates MUST use workspace dependencies for version consistency | MUST |
| AVA.14-R3 | asupersync MUST be pinned to a specific git tag | MUST |
| AVA.14-R4 | ava-fusion MUST NOT depend on async runtimes or OS APIs | MUST |
| AVA.14-R5 | Types crate MUST remain compatible with wasm32-unknown-unknown | MUST |
| AVA.14-R6 | KV bucket keys MUST use dots, MUST NOT use colons | MUST |
| AVA.14-R7 | Object Store chunk size SHOULD be 128KB | SHOULD |
| AVA.14-R8 | Single-node deployments MUST support the complete actor ensemble | MUST |
| AVA.14-R9 | Distributed deployments MUST use 3+ node NATS cluster | MUST |
| AVA.14-R10 | Production JetStream MUST use file-backed storage with TTL | MUST |

---

## AVA.14.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [NATS JetStream] https://docs.nats.io/nats-concepts/jetstream
- [NATS KV] https://docs.nats.io/nats-concepts/jetstream/key-value-store
- [NATS Object Store] https://docs.nats.io/nats-concepts/jetstream/obj_store
- [NATS Clustering] https://docs.nats.io/running-a-nats-service/configuration/clustering
- [Cargo Workspaces] https://doc.rust-lang.org/cargo/reference/workspaces.html
- [typeshare] https://github.com/1Password/typeshare
- [asupersync] https://github.com/Dicklesworthstone/asupersync
- [differential-dataflow] https://github.com/TimelyDataflow/differential-dataflow
- [Cargo.toml] `Cargo.toml` — workspace root configuration (27 lines)
- [ava-fusion/Cargo.toml] `ava-fusion/Cargo.toml` — types crate dependencies (17 lines)
- [ava-fusion-runtime/Cargo.toml] `ava-fusion-runtime/Cargo.toml` — runtime crate dependencies (26 lines)
- [ava-fusion-runtime nats_kv.rs] `ava-fusion-runtime/src/nats_kv.rs` — NATS KV implementation (601 lines, 11 tests)
- [ava-fusion-runtime nats_object.rs] `ava-fusion-runtime/src/nats_object.rs` — NATS Object Store (736 lines, 13 tests)

---

*End of section AVA.14*
