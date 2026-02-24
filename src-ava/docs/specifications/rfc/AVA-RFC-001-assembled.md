# AVA-RFC-001: Ava Fusion Pipeline — Sensor Fusion Runtime

```
Document:      AVA-RFC-001
Title:         Ava Fusion Pipeline — Sensor Fusion Runtime
Status:        DRAFT
Authors:       Val (Vigilant Architecture Layer)
Created:       2026-02-20
Revision:      0.1.0

Crates:        ava-fusion (types), ava-fusion-runtime (actors + dataflow)
Runtime:       asupersync v0.2.5
Transport:     NATS JetStream
Compute:       differential-dataflow v0.18 + timely v0.25
```

> This RFC specifies the architecture, algorithms, data model, and deployment
> topology for the ava-fusion sensor fusion pipeline. The pipeline ingests
> signals from 20 sensor categories, correlates observations across 3 fusion
> tiers using differential-dataflow's incremental computation model, and
> produces entity tracks, alarm notifications, and fusion results. The runtime
> uses asupersync's GenServer actor model with structured supervision, cancel
> propagation, and budget enforcement.

---

## Metrics Summary

| Metric | Count |
|--------|-------|
| Total sections | 15 |
| Total appendices | 4 |
| Total parts | 5 |
| Total section lines | 8,354 |
| SignalKind variants | 20 |
| EntityClass variants | 10 |
| Fusion tiers | 3 |

---

## Table of Contents


**PART I: DATA INGEST (Normative)**

- **AVA.1**: Pipeline Architecture
- **AVA.2**: Signal Schema
- **AVA.3**: NATS Subject Taxonomy
- **AVA.4**: Source Adapters
- **AVA.5**: JetStream Persistence

**PART II: PROCESSING (Normative)**

- **AVA.6**: Actor Model (asupersync)
- **AVA.7**: Supervision Tree
- **AVA.8**: Differential Dataflow Engine
- **AVA.9**: Fusion Tiers & Join Paths

**PART III: ALGORITHMS (Normative)**

- **AVA.10**: Evidence Theory (DS/PCR5)
- **AVA.11**: Tracking & State Estimation
- **AVA.12**: Complex Event Processing

**PART IV: OUTPUT (Normative)**

- **AVA.13**: Output & Alarm Pipeline
- **AVA.14**: Deployment Topology

**PART V: VALIDATION (Informative)**

- **AVA.15**: E2E Testing Strategy
- **Appendix A**: SignalKind Catalog
- **Appendix B**: EntityClass Catalog
- **Appendix C**: Data Source Catalog
- **Appendix D**: Bibliography

---


---

# PART I: DATA INGEST (Normative)

---

# AVA.1 Pipeline Architecture

```
Section:       AVA.1 — Pipeline Architecture
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Ingest (Normative)
Prerequisites: None
Feeds:         AVA.2 (Signal Schema), AVA.3 (NATS Subject Taxonomy)
```

> This section specifies the crate boundary, actor topology, data flow,
> and identity model for the ava-fusion sensor fusion pipeline. The system
> is split into two Rust crates: a WASM-safe pure-types crate (`ava-fusion`)
> and a nightly runtime crate (`ava-fusion-runtime`) that bridges those types
> to the asupersync actor scheduler. The key words "MUST", "MUST NOT",
> "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED",
> "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
> interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava11-conventions-and-terminology)
2.  [Crate Boundary](#ava12-crate-boundary)
3.  [Identity Model](#ava13-identity-model)
4.  [Actor Topology](#ava14-actor-topology)
5.  [Data Flow](#ava15-data-flow)
6.  [FusionOntologyV2 Root Configuration](#ava16-fusionontologyv2-root-configuration)
7.  [Supervision Tree](#ava17-supervision-tree)
8.  [Pipeline Configuration](#ava18-pipeline-configuration)
9.  [Runtime Capabilities](#ava19-runtime-capabilities)
10. [Normative Requirements Summary](#ava110-normative-requirements-summary)
11. [References](#ava111-references)

---

## AVA.1.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.1.1.1 Terminology

| Term | Definition |
|------|-----------|
| **ava-fusion** | Pure-types crate (`ava-fusion/src/lib.rs`). WASM-safe: serde + typeshare + thiserror only. No async, no runtime. |
| **ava-fusion-runtime** | Runtime crate (`ava-fusion-runtime/src/lib.rs`). Depends on asupersync, tokio, NATS. Nightly Rust required. |
| **asupersync** | The structured concurrency runtime providing Cx, Scope, GenServer, Budget, Outcome, and supervision primitives. |
| **Actor** | A GenServer instance managed by the supervision tree. Receives typed messages via a bounded mailbox. |
| **FusionOntologyV2** | The root configuration struct governing entity classes, join paths, thresholds, and all R1-R9 extensions (`ava-fusion/src/ontology.rs`). |
| **Branded ID** | A transparent `String` newtype created via the `branded_id!` macro (`ava-fusion/src/ids.rs`). |
| **Cx** | The asupersync cancel-aware context. All async operations accept a `&Cx` for cooperative cancellation. |

---

## AVA.1.2 Crate Boundary

### AVA.1.2.1 Design Rationale

The pipeline is split across two crates to enforce a hard compile-time boundary
between portable domain types and platform-specific runtime code.

```
┌─────────────────────────────────────────────────────────┐
│  ava-fusion (pure types)                                │
│  #![forbid(unsafe_code)]                                │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │ ids.rs   │ │signal.rs │ │entity.rs │ │temporal.rs│  │
│  │ 7 IDs    │ │20 Signals│ │10 Classes│ │JoinMode   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │output.rs │ │ontology  │ │track.rs  │ │+ 8 more   │  │
│  │FusedDatum│ │V1/V2 root│ │TrackState│ │modules    │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │ depends on (types only)
┌────────────────────────▼────────────────────────────────┐
│  ava-fusion-runtime                                     │
│  Requires: asupersync, tokio, nats                      │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │convert.rs│ │pipeline  │ │nats_kv.rs│ │nats_object│  │
│  │From impls│ │AppSpec   │ │KV store  │ │Blob store │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐  │
│  │actors/   │ │dataflow/ │ │cep/      │ │+ 4 more   │  │
│  │GenServer │ │d2ts graph│ │CEP rules │ │modules    │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────┘  │
└─────────────────────────────────────────────────────────┘
```

### AVA.1.2.2 ava-fusion Crate

The pure-types crate (`ava-fusion/src/lib.rs`) is annotated with
`#![forbid(unsafe_code)]` and depends exclusively on `serde`, `typeshare`,
and `thiserror`. It defines 15 public modules re-exported at the crate root:

| Module | Key Types | Source |
|--------|-----------|--------|
| `ids` | `EntityId`, `TrackId`, `JoinPathId`, `SignalSourceId`, `SequencePatternId`, `RiskProfileId`, `FusionObligationId` | `ava-fusion/src/ids.rs` |
| `signal` | `SignalKind` (20), `DataType`, `UpdateRate`, `ReferenceSource` | `ava-fusion/src/signal.rs` |
| `entity` | `EntityClass` (10), `IdentifierNamespace` (10), `EntityClassDef` | `ava-fusion/src/entity.rs` |
| `temporal` | `TemporalJoinMode`, `LateArrivalPolicy`, `WatermarkConfig`, `FusionBudget` | `ava-fusion/src/temporal.rs` |
| `output` | `FusedDatum`, `CorrelatedPair`, `FusionOutcome<T,E>`, `FusionSeverity` | `ava-fusion/src/output.rs` |
| `ontology` | `FusionOntology`, `FusionOntologyV2`, `FusionThresholds` | `ava-fusion/src/ontology.rs` |
| `track` | `TrackState`, `TrackLifecycle` | `ava-fusion/src/track.rs` |
| `confidence` | `ConfidenceModel`, `CorrelationMatrix`, `SpoofingDiscount` | `ava-fusion/src/confidence.rs` |
| `calibration` | `CalibrationConfig` | `ava-fusion/src/calibration.rs` |
| `blocking` | `BlockingDefaults` | `ava-fusion/src/blocking.rs` |
| `tier3` | Tier 3 method types | `ava-fusion/src/tier3.rs` |
| `join_path` | `JoinPathEntry`, `JoinPathEntryV2`, `JoinPathSide` | `ava-fusion/src/join_path.rs` |
| `absence` | `AbsenceThresholds`, `ESRConfig`, `DeadReckoningConfig` | `ava-fusion/src/absence.rs` |
| `risk` | `RiskThreshold`, `RiskDecay`, `RiskAccumulationMethod` | `ava-fusion/src/risk.rs` |
| `sequence` | `SequencePattern`, `CanonicalSequence` | `ava-fusion/src/sequence.rs` |

**Normative**: All domain types used in serialization boundaries (NATS messages,
KV entries, WebSocket payloads) MUST originate from the `ava-fusion` crate.

### AVA.1.2.3 ava-fusion-runtime Crate

The runtime crate (`ava-fusion-runtime/src/lib.rs`) depends on `ava-fusion`
(types only) and `asupersync` (runtime). It provides 9 modules:

| Module | Responsibility | Source |
|--------|---------------|--------|
| `convert` | Bidirectional `From` impls between ava-fusion mirror types and asupersync runtime types | `ava-fusion-runtime/src/convert.rs` |
| `actors` | 6 GenServer actor implementations | `ava-fusion-runtime/src/actors/` |
| `pipeline` | Supervision tree `AppSpec` builder | `ava-fusion-runtime/src/pipeline.rs` |
| `nats_kv` | NATS KV store atop JetStream | `ava-fusion-runtime/src/nats_kv.rs` |
| `nats_object` | NATS Object Store (chunked blob storage) | `ava-fusion-runtime/src/nats_object.rs` |
| `dataflow` | d2ts differential dataflow graph | `ava-fusion-runtime/src/dataflow/` |
| `cep` | Complex event processing rules | `ava-fusion-runtime/src/cep/` |
| `graph` | Graph computation | `ava-fusion-runtime/src/graph/` |
| `signal` | Runtime signal processing | `ava-fusion-runtime/src/signal/` |

**Normative**: The runtime crate MUST NOT re-export asupersync types through
its public API. Consumers outside the pipeline MUST interact via ava-fusion
types and the conversion functions in `convert.rs`.

---

## AVA.1.3 Identity Model

### AVA.1.3.1 Branded ID Types

All identifiers are branded newtypes generated by the `branded_id!` macro
(`ava-fusion/src/ids.rs:19-54`). Each type is a transparent `String` wrapper
with `new()`, `as_str()`, `Display`, `FromStr`, `Serialize`, and `Deserialize`
implementations.

| Type | Purpose | Example Value |
|------|---------|---------------|
| `EntityId` | Globally unique tracked entity | `"aircraft-A380F2"` |
| `TrackId` | Fused track aggregating observations | `"track-001"` |
| `JoinPathId` | Declared join path in ontology | `"adsb-x-ais-spatial"` |
| `SignalSourceId` | Signal source (adapter, sensor, feed) | `"adsb-feed"` |
| `SequencePatternId` | Sequence pattern definition (R9) | `"go-dark-pattern"` |
| `RiskProfileId` | Risk profile attached to entity (R3) | `"risk-aircraft-A380F2"` |
| `FusionObligationId` | Asupersync obligation mirror | `"42.1"` (index.generation) |

**Normative**: All branded IDs MUST serialize as plain JSON strings via
`#[serde(transparent)]`. Implementations MUST NOT embed structured data
in the ID string.

### AVA.1.3.2 FusionCapability Enum

The `FusionCapability` enum (`ava-fusion/src/ids.rs:105-130`) mirrors
asupersync's `CapSet<SPAWN, TIME, RANDOM, IO, REMOTE>` const-generic booleans
as a serde-friendly enum for TypeScript/WASM consumers:

```rust
pub enum FusionCapability {
    Spawn,   // Permission to spawn tasks and regions
    Time,    // Permission to use timers and timeouts
    Random,  // Permission to access entropy
    Io,      // Permission for async I/O
    Remote,  // Permission for remote task spawning
}
```

Capabilities serialize as `SCREAMING_SNAKE_CASE` (e.g., `"SPAWN"`, `"IO"`).

### AVA.1.3.3 CorrelationId

A `CorrelationId` is derived at runtime by the fusion engine to link
observations across signal sources to a single fused track. Correlation IDs
are ephemeral — they exist only within a processing window and are NOT
persisted in KV state.

---

## AVA.1.4 Actor Topology

### AVA.1.4.1 The Six Actors

The pipeline consists of 6 actor types, each implemented as an asupersync
GenServer (`ava-fusion-runtime/src/actors/`):

```
┌─────────────────────────────────────────────────────────────────┐
│                     tsingou-fusion AppSpec                      │
│                                                                 │
│  INGEST LAYER                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ SensorIngestor   │  │ SensorIngestor   │  │SensorIngestor │  │
│  │ (adsb-feed)      │  │ (ais-feed)       │  │(sdr-iq-feed)  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬────────┘  │
│           │                     │                    │           │
│           └──────────┬──────────┴────────────────────┘           │
│                      ▼                                           │
│  FUSION LAYER                                                    │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ FusionEngine     │  │ FusionEngine     │  │ FusionEngine  │  │
│  │ (tier1-hard-key) │  │ (tier2-soft-key) │  │ (tier3-derived│  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬────────┘  │
│           │                     │                    │           │
│           └──────────┬──────────┴────────────────────┘           │
│                      ▼                                           │
│  EVALUATION LAYER                                                │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ AlarmEvaluator   │  │ TrackManager     │  │AbsenceDetector│  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
│                                                                 │
│  SINGLETON                                                       │
│  ┌──────────────────┐                                           │
│  │ EntityResolver   │  (NameRegistry singleton)                 │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

| Actor | Instances | Restart | Role |
|-------|-----------|---------|------|
| `SensorIngestor` | 1 per source (default 4) | OneForOne, 3/60s | Buffers raw signals from NATS subscriptions |
| `FusionEngine` | 1 per tier (default 3) | OneForAll, 3/60s | Executes join paths via d2ts dataflow graph |
| `AlarmEvaluator` | 1 | OneForOne, 3/60s | Evaluates alarm rules against fusion output |
| `TrackManager` | 1 | OneForOne, 3/60s | Manages track lifecycle (create/update/merge/drop) |
| `AbsenceDetector` | 1 | OneForOne, 3/60s | Monitors expected signal registry for absence |
| `EntityResolver` | 1 (singleton) | Restart(max 5), 5/120s | Identity resolution across namespaces |

### AVA.1.4.2 Actor Layering

Actors are organized into four layers with strict dependency ordering
enforced by the supervision tree's `depends_on` mechanism
(`ava-fusion-runtime/src/pipeline.rs:237-256`):

1. **Ingest Layer**: `SensorIngestor` actors start first, independently.
2. **Fusion Layer**: `FusionEngine` actors start after ingest. Tier 3 waits
   for Tier 1 and Tier 2 (`pipeline.rs:334-338`).
3. **Evaluation Layer**: `AlarmEvaluator` depends on all three fusion tiers.
   `TrackManager` depends on Tier 1. `AbsenceDetector` depends on sensor feeds.
4. **Singleton Layer**: `EntityResolver` registered via `NameRegistry`.

---

## AVA.1.5 Data Flow

### AVA.1.5.1 End-to-End Flow

```
External Sources (OpenSky, AIS, SDR, ...)
        │
        ▼  NATS publish: sensor.{kind}.{source}.{format}
┌───────────────┐
│SensorIngestor │ ── validates, buffers, normalizes
└───────┬───────┘
        │  Internal message passing (GenServer mailbox)
        ▼
┌───────────────┐
│ FusionEngine  │ ── joins via d2ts dataflow operators
│ (Tier 1/2/3)  │ ── emits FusedDatum / CorrelatedPair
└───────┬───────┘
        │  NATS publish: fusion.{tier}.{entity_class}.results
        ▼
┌───────────────┐  ┌───────────────┐  ┌──────────────┐
│AlarmEvaluator │  │ TrackManager  │  │AbsenceDetect │
│alarm.{sev}.*  │  │fusion.tracks.*│  │ESR monitoring│
└───────────────┘  └───────────────┘  └──────────────┘
        │                  │
        ▼                  ▼
    NATS KV            NATS KV
   (ava-state)        (ava-state)
```

### AVA.1.5.2 Output Types

The fusion engine produces two output types (`ava-fusion/src/output.rs`):

1. **`FusedDatum`**: A fused track observation aggregated from multiple signal
   sources with a combined confidence score (0.01-0.99), an optional position,
   and a list of contributing source IDs.

2. **`CorrelatedPair`**: Two entities that are related but NOT the same
   (TSGC-001 §5.1). Rendered as edges in the visualization layer.

### AVA.1.5.3 Outcome Semantics

All actor operations return `FusionOutcome<T, E>` — a four-valued severity
lattice (`ava-fusion/src/output.rs:95-110`):

| Variant | Severity | Meaning |
|---------|----------|---------|
| `Ok(T)` | 0 | Successful completion |
| `Err(E)` | 1 | Application-level error |
| `Cancelled { reason }` | 2 | External cancellation (timeout, fail-fast) |
| `Panicked { message }` | 3 | Unrecoverable panic |

The worst outcome takes precedence in monotone aggregation:
`Ok < Err < Cancelled < Panicked`.

---

## AVA.1.6 FusionOntologyV2 Root Configuration

### AVA.1.6.1 Schema Overview

`FusionOntologyV2` (`ava-fusion/src/ontology.rs:108-174`) is the root
configuration struct that drives the entire pipeline. It extends the v1
`FusionOntology` with R1-R9 amendment fields:

| Field Group | Fields | Amendment |
|-------------|--------|-----------|
| Core | `version`, `scenario`, `entity_classes`, `join_paths`, `resolvers`, `thresholds` | v1 baseline |
| Confidence (R4) | `confidence_model`, `correlation_matrix`, `correlation_discount_factor`, `spoofing_discount`, `calibration` | R4 |
| Reference (R5) | `reference_sources` | R5 |
| Blocking (R6) | `blocking_defaults` | R6 |
| Absence (R2) | `expected_signals`, `absence_thresholds`, `dead_reckoning` | R2 |
| Risk (R3) | `risk_thresholds`, `risk_decay`, `risk_method` | R3 |
| Sequence (R9) | `sequence_patterns`, `canonical_sequences` | R9 |

### AVA.1.6.2 Configuration Loading

The ontology SHOULD be loaded from NATS KV bucket `ava-config` at pipeline
startup, key `pipeline.{scenario}`. Implementations MAY also accept a local
JSON/TOML file for development.

**Normative**: Ontology changes at runtime MUST trigger a controlled pipeline
restart. Hot-swapping of join paths or entity class definitions is NOT supported.

---

## AVA.1.7 Supervision Tree

### AVA.1.7.1 AppSpec Structure

The supervision tree is built by `build_pipeline()` in
`ava-fusion-runtime/src/pipeline.rs:195-283`:

```
AppSpec("tsingou-fusion") [OneForOne]
├── sensor-adsb-feed       [Restart 3/60s, OneForOne]
├── sensor-ais-feed        [Restart 3/60s, OneForOne]
├── sensor-sdr-iq-feed     [Restart 3/60s, OneForOne]
├── sensor-osint-feed      [Restart 3/60s, OneForOne]
├── fusion-tier1-hard-key  [Restart 3/60s, OneForAll*]
├── fusion-tier2-soft-key  [Restart 3/60s, OneForAll*]
├── fusion-tier3-derived   [Restart 3/60s, depends_on tier1+tier2]
├── alarm-evaluator        [Restart 3/60s, depends_on all fusion]
├── track-manager          [Restart 3/60s, depends_on tier1]
├── absence-detector       [Restart 3/60s, depends_on sensors]
└── entity-resolver        [Restart 5/120s, NameRegistry singleton]
```

*OneForAll semantics documented but require nested SupervisorBuilder in
production (`pipeline.rs:220-226`).

### AVA.1.7.2 Restart Strategies

Two restart configurations are defined (`pipeline.rs:150-179`):

| Config | Max Restarts | Window | Backoff | Use |
|--------|-------------|--------|---------|-----|
| `standard_restart()` | 3 | 60s | Exponential 100ms-10s, 2x | All actors except EntityResolver |
| `singleton_restart()` | 5 | 120s | Exponential 200ms-30s, 2x | EntityResolver (critical singleton) |

---

## AVA.1.8 Pipeline Configuration

### AVA.1.8.1 PipelineConfig

The `PipelineConfig` struct (`pipeline.rs:67-85`) parameterizes the supervision
tree:

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `sensors` | `Vec<SensorConfig>` | 4 defaults | Sensor ingestor children |
| `fusion_tiers` | `Vec<FusionTierConfig>` | 3 tiers | Fusion engine children |
| `mailbox_capacity` | `usize` | 256 | GenServer mailbox bound |
| `eval_interval_secs` | `u64` | 5 | AbsenceDetector tick interval |

### AVA.1.8.2 Default Sensor Sources

The default configuration (`pipeline.rs:88-142`) provisions four sensor feeds:

| Source ID | SignalKind | Buffer Size |
|-----------|-----------|-------------|
| `adsb-feed` | `AdsB` | 4096 |
| `ais-feed` | `Ais` | 4096 |
| `sdr-iq-feed` | `Sdr` | 2048 |
| `osint-feed` | `Osint` | 1024 |

---

## AVA.1.9 Runtime Capabilities

### AVA.1.9.1 Type Bridge

The `convert.rs` module (`ava-fusion-runtime/src/convert.rs`) provides
bidirectional conversions between ava-fusion mirror types and asupersync
runtime types:

| ava-fusion Type | asupersync Type | Direction | Notes |
|----------------|-----------------|-----------|-------|
| `FusionSeverity` | `Severity` | Lossless | 4-variant enum map |
| `FusionCancelKind` | `CancelKind` | Lossless | 11-variant enum map |
| `FusionOutcome<T,E>` | `Outcome<T,E>` | Lossy (to fusion) | Drops attribution chain |
| `FusionBudget` | `Budget` | Lossy | Sub-ms precision lost (`convert.rs:503-518`) |
| `FusionObligationState` | `ObligationState` | Lossless | 4-variant enum map |
| `FusionObligationId` | `ObligationId` | Lossy | String <-> arena index via serde |

**Normative**: Conversions that are lossy MUST be documented with the
specific information that is dropped. The `From` direction (fusion -> runtime)
MUST NOT silently discard data that affects correctness.

---

## AVA.1.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.1-R1 | All serializable domain types MUST originate from the `ava-fusion` crate | MUST |
| AVA.1-R2 | The `ava-fusion` crate MUST NOT depend on any async runtime or platform-specific crate | MUST |
| AVA.1-R3 | The `ava-fusion` crate MUST maintain `#![forbid(unsafe_code)]` | MUST |
| AVA.1-R4 | All branded ID types MUST serialize as transparent JSON strings | MUST |
| AVA.1-R5 | The runtime crate MUST NOT re-export asupersync types in its public API | MUST |
| AVA.1-R6 | Lossy type conversions MUST document what information is dropped | MUST |
| AVA.1-R7 | Tier 3 fusion actors MUST NOT start before Tier 1 and Tier 2 are ready | MUST |
| AVA.1-R8 | The EntityResolver MUST be registered as a NameRegistry singleton | MUST |
| AVA.1-R9 | Ontology changes at runtime MUST trigger a controlled pipeline restart | MUST |
| AVA.1-R10 | FusionCapability variants MUST serialize as SCREAMING_SNAKE_CASE | MUST |

---

## AVA.1.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [TSGC-001] Tsingou Sensor Graph Conventions, version 1.0.
- [TSGC-001-v2] Tsingou Sensor Graph Conventions, version 2.0 (R1-R9 amendments).
- [ava-fusion lib.rs] `ava-fusion/src/lib.rs` — 15 modules, `#![forbid(unsafe_code)]`
- [ava-fusion ids.rs] `ava-fusion/src/ids.rs` — 7 branded ID types + FusionCapability
- [ava-fusion ontology.rs] `ava-fusion/src/ontology.rs` — FusionOntology + FusionOntologyV2
- [ava-fusion output.rs] `ava-fusion/src/output.rs` — FusedDatum, CorrelatedPair, FusionOutcome
- [ava-fusion-runtime lib.rs] `ava-fusion-runtime/src/lib.rs` — 9 modules
- [ava-fusion-runtime convert.rs] `ava-fusion-runtime/src/convert.rs` — Type bridge
- [ava-fusion-runtime pipeline.rs] `ava-fusion-runtime/src/pipeline.rs` — Supervision tree

---

*End of section AVA.1*


---

# AVA.2 Signal Schema

```
Section:       AVA.2 — Signal Schema
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Ingest (Normative)
Prerequisites: AVA.1 (Pipeline Architecture)
Feeds:         AVA.3 (NATS Subject Taxonomy), AVA.4 (Source Adapters)
```

> This section specifies the signal classification schema for the ava-fusion
> pipeline. It defines the 20 `SignalKind` variants, 10 `EntityClass` variants,
> the `DataType` event/reference duality, `ReferenceSource` registration, and
> the `EntityClassDef` mapping that connects entity classes to their observable
> signal kinds. These types form the semantic foundation for NATS subject
> routing, join path validation, and source adapter contracts. The key words
> "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT",
> "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are
> to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava21-conventions-and-terminology)
2.  [SignalKind Enumeration](#ava22-signalkind-enumeration)
3.  [EntityClass Enumeration](#ava23-entityclass-enumeration)
4.  [IdentifierNamespace Enumeration](#ava24-identifiernamespace-enumeration)
5.  [DataType Duality](#ava25-datatype-duality)
6.  [UpdateRate Cadence](#ava26-updaterate-cadence)
7.  [ReferenceSource Registration](#ava27-referencesource-registration)
8.  [EntityClassDef Mapping](#ava28-entityclassdef-mapping)
9.  [Signal-Entity Observable Matrix](#ava29-signal-entity-observable-matrix)
10. [Normative Requirements Summary](#ava210-normative-requirements-summary)
11. [References](#ava211-references)

---

## AVA.2.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.2.1.1 Terminology

| Term | Definition |
|------|-----------|
| **SignalKind** | One of 20 sensor type discriminators. Determines NATS subject routing and valid join paths. Source: `ava-fusion/src/signal.rs`. |
| **EntityClass** | One of 10 entity types tracked by the fusion system. Source: `ava-fusion/src/entity.rs`. |
| **DataType** | Binary classification of a signal source as `Event` (volatile stream) or `Reference` (stable lookup). |
| **Observable By** | The set of SignalKinds that can produce observations for a given EntityClass (TSGC-001 §2). |
| **d2ts** | Differential dataflow join strategy: event streams join with event streams, or events probe reference arrangements. |

---

## AVA.2.2 SignalKind Enumeration

### AVA.2.2.1 Definition

`SignalKind` (`ava-fusion/src/signal.rs:20-61`) is a 20-variant enum
classifying signal sources by collection method. Each variant corresponds to a
distinct data collection modality. Signal kinds determine valid join paths in
the fusion ontology.

```rust
#[serde(rename_all = "camelCase")]
pub enum SignalKind {
    AdsB,       // Automatic Dependent Surveillance – Broadcast
    Ais,        // Automatic Identification System
    Radar,      // Primary/secondary radar returns
    RfBearing,  // RF direction-finding bearing measurement
    Sdr,        // Software-defined radio raw signal capture
    Http,       // HTTP/HTTPS request/response metadata
    Dns,        // DNS query/response records
    Satellite,  // Satellite imagery or overhead sensor data
    Geoint,     // Geospatial intelligence (imagery analysis)
    Humint,     // Human intelligence reports
    Sigint,     // Signals intelligence (general)
    Elint,      // Electronic intelligence (radar/nav characterization)
    Comint,     // Communications intelligence (intercepted comms)
    Osint,      // Open-source intelligence (RSS, news, social)
    Masint,     // Measurement and signature intelligence
    Cyber,      // Cyber threat indicators (STIX, IOCs)
    Social,     // Social media signals (handles, posts, graphs)
    Financial,  // Financial transaction and sanctions data
    Travel,     // Travel records (manifests, border crossings)
    Custom,     // Operator-defined custom signal kind
}
```

### AVA.2.2.2 Serialization

SignalKind MUST serialize as `camelCase` JSON strings
(`signal.rs:19`):

| Variant | JSON Serialization | Display String |
|---------|--------------------|----------------|
| `AdsB` | `"adsB"` | `"ADS-B"` |
| `Ais` | `"ais"` | `"AIS"` |
| `Radar` | `"radar"` | `"Radar"` |
| `RfBearing` | `"rfBearing"` | `"RF Bearing"` |
| `Sdr` | `"sdr"` | `"SDR"` |
| `Http` | `"http"` | `"HTTP"` |
| `Dns` | `"dns"` | `"DNS"` |
| `Satellite` | `"satellite"` | `"Satellite"` |
| `Geoint` | `"geoint"` | `"GEOINT"` |
| `Humint` | `"humint"` | `"HUMINT"` |
| `Sigint` | `"sigint"` | `"SIGINT"` |
| `Elint` | `"elint"` | `"ELINT"` |
| `Comint` | `"comint"` | `"COMINT"` |
| `Osint` | `"osint"` | `"OSINT"` |
| `Masint` | `"masint"` | `"MASINT"` |
| `Cyber` | `"cyber"` | `"Cyber"` |
| `Social` | `"social"` | `"Social"` |
| `Financial` | `"financial"` | `"Financial"` |
| `Travel` | `"travel"` | `"Travel"` |
| `Custom` | `"custom"` | `"Custom"` |

**Normative**: Producers MUST use the camelCase serialization for all
JSON-encoded payloads. NATS subject tokens MUST use the lowercase form
(see [AVA.3](rfc-section-nats-subject-taxonomy.md)).

### AVA.2.2.3 Domain Groupings

The 20 signal kinds partition into 5 operational domains:

| Domain | Signal Kinds | Count |
|--------|-------------|-------|
| **Kinetic** | AdsB, Ais, Radar, Satellite | 4 |
| **RF/Signals** | RfBearing, Sdr, Sigint, Elint, Comint | 5 |
| **Cyber/Network** | Http, Dns, Cyber | 3 |
| **OSINT/Social/Financial** | Osint, Social, Financial, Travel | 4 |
| **GEOINT/HUMINT/MASINT** | Geoint, Humint, Masint | 3 |
| **Custom** | Custom | 1 |

### AVA.2.2.4 Completeness Invariant

The `SignalKind::ALL` constant (`signal.rs:65-87`) MUST contain exactly 20
variants in declaration order. This invariant is enforced by the test
`signal_kind_count()` (`signal.rs:230`).

---

## AVA.2.3 EntityClass Enumeration

### AVA.2.3.1 Definition

`EntityClass` (`ava-fusion/src/entity.rs:23-44`) is a 10-variant enum
defining the kinds of entities tracked by the fusion system. Each class has
a primary identifier namespace and a set of signal kinds that can observe it.

```rust
#[serde(rename_all = "camelCase")]
pub enum EntityClass {
    Aircraft,       // Primary ID: ICAO hex
    Vessel,         // Primary ID: MMSI
    GroundVehicle,  // Primary ID: license plate
    RfEmitter,      // Freq + location characterization
    NetworkHost,    // Primary ID: IP address
    Domain,         // Primary ID: FQDN
    Person,         // Primary ID: name or social handle
    Organization,   // Primary ID: name or LEI
    Campaign,       // Primary ID: STIX ID (adversary campaign)
    Facility,       // Primary ID: geo + name
}
```

### AVA.2.3.2 Serialization

EntityClass MUST serialize as `camelCase` JSON strings:

| Variant | JSON | Display |
|---------|------|---------|
| `Aircraft` | `"aircraft"` | `"Aircraft"` |
| `Vessel` | `"vessel"` | `"Vessel"` |
| `GroundVehicle` | `"groundVehicle"` | `"Ground Vehicle"` |
| `RfEmitter` | `"rfEmitter"` | `"RF Emitter"` |
| `NetworkHost` | `"networkHost"` | `"Network Host"` |
| `Domain` | `"domain"` | `"Domain"` |
| `Person` | `"person"` | `"Person"` |
| `Organization` | `"organization"` | `"Organization"` |
| `Campaign` | `"campaign"` | `"Campaign"` |
| `Facility` | `"facility"` | `"Facility"` |

### AVA.2.3.3 Completeness Invariant

`EntityClass::ALL` (`entity.rs:48-60`) MUST contain exactly 10 variants.
Enforced by the test `entity_class_count()` (`entity.rs:195`).

---

## AVA.2.4 IdentifierNamespace Enumeration

### AVA.2.4.1 Definition

`IdentifierNamespace` (`ava-fusion/src/entity.rs:88-112`) defines the
primary identifier systems used to key entities within a class. Tier 1
(hard key) joins operate within a single namespace; cross-namespace joins
require Tier 2 (soft key) or identity resolution.

| Variant | JSON | Use Case |
|---------|------|----------|
| `IcaoHex` | `"icaoHex"` | Aircraft — 24-bit hex address |
| `Mmsi` | `"mmsi"` | Vessel — Maritime Mobile Service Identity |
| `LicensePlate` | `"licensePlate"` | Ground Vehicle registration |
| `MacAddress` | `"macAddress"` | Network Host / RF Emitter |
| `IpAddress` | `"ipAddress"` | Network Host IPv4/IPv6 |
| `DomainName` | `"domainName"` | FQDN |
| `Imsi` | `"imsi"` | Person / Device — Mobile subscriber |
| `Imei` | `"imei"` | Device — Mobile equipment |
| `SocialHandle` | `"socialHandle"` | Person — Social media username |
| `Custom` | `"custom"` | Operator-defined namespace |

### AVA.2.4.2 Completeness Invariant

`IdentifierNamespace::ALL` MUST contain exactly 10 variants
(`entity.rs:116-128`). Enforced by `identifier_namespace_count()`
(`entity.rs:230`).

---

## AVA.2.5 DataType Duality

### AVA.2.5.1 Definition

`DataType` (`ava-fusion/src/signal.rs:126-133`) classifies signal sources
as event-stream or reference-table data (R5). This distinction determines
the d2ts join strategy:

| Variant | JSON | Semantics |
|---------|------|-----------|
| `Event` | `"event"` | Volatile, append-only, timestamped. Joins via differential stream windowing. |
| `Reference` | `"reference"` | Stable, slowly-changing, lookup-keyed. Materialised as d2ts arrangement for O(1) probes. |

### AVA.2.5.2 Examples

| Data Source | DataType | Rationale |
|-------------|----------|-----------|
| ADS-B state vectors | Event | Continuous stream, 1-2Hz per aircraft |
| AIS position reports | Event | Continuous stream, variable rate |
| FAA aircraft registry | Reference | Updated daily, lookup by ICAO hex |
| ITU frequency allocations | Reference | Updated infrequently, lookup by freq band |
| STIX CTI feeds | Reference | Updated hourly, lookup by indicator |
| HTTP request logs | Event | Continuous stream, high volume |

**Normative**: Each `JoinPathSide` (`ava-fusion/src/join_path.rs`) MUST
declare its `DataType`. The d2ts join compiler MUST use this to select
the appropriate operator (windowed join for Event×Event, probe join for
Event×Reference).

---

## AVA.2.6 UpdateRate Cadence

### AVA.2.6.1 Definition

`UpdateRate` (`ava-fusion/src/signal.rs:150-163`) specifies the refresh
cadence for reference data sources:

| Variant | JSON | Typical Sources |
|---------|------|----------------|
| `Static` | `"static"` | One-time load (ISO country codes, static maps) |
| `Daily` | `"daily"` | FAA registry, OFAC SDN list |
| `Hourly` | `"hourly"` | CISA KEV catalog, threat feeds |
| `Minutes` | `"minutes"` | AlienVault OTX pulses, social feeds |
| `Seconds` | `"seconds"` | High-rate reference streams (rare) |

### AVA.2.6.2 TTL Derivation

Reference data sources carry a `ttl_seconds` field in their
`ReferenceSource` registration. The `UpdateRate` provides a semantic
hint; the actual expiry is governed by `ttl_seconds`.

---

## AVA.2.7 ReferenceSource Registration

### AVA.2.7.1 Definition

`ReferenceSource` (`ava-fusion/src/signal.rs:190-205`) is the registration
record for a reference data source in the fusion ontology:

```rust
#[serde(rename_all = "camelCase")]
pub struct ReferenceSource {
    pub id: String,            // e.g. "faa-registry"
    pub signal_kind: String,   // e.g. "faa-db"
    pub entity_class: String,  // e.g. "Aircraft"
    pub key_field: String,     // e.g. "icao_hex"
    pub update_rate: UpdateRate,
    pub nats_subject: String,  // e.g. "tsingou.ref.faa.*"
    pub ttl_seconds: f64,
}
```

### AVA.2.7.2 Serialization

All fields serialize as `camelCase` (`signalKind`, `entityClass`, `keyField`,
`updateRate`, `natsSubject`, `ttlSeconds`). Verified by tests in
`signal.rs:320-336`.

### AVA.2.7.3 Ontology Registration

Reference sources are declared in `FusionOntologyV2.reference_sources`
(`ontology.rs:143-144`). The vector is `skip_serializing_if = "Vec::is_empty"`,
so ontologies with no reference data sources omit the field entirely.

**Normative**: Each `ReferenceSource.nats_subject` MUST follow the NATS
subject pattern conventions defined in [AVA.3](rfc-section-nats-subject-taxonomy.md).
The `key_field` MUST identify a JSON path in the payload that serves as
the lookup key for d2ts arrangement materialisation.

---

## AVA.2.8 EntityClassDef Mapping

### AVA.2.8.1 Definition

`EntityClassDef` (`ava-fusion/src/entity.rs:158-170`) maps an entity class
to its primary identifier namespace, primary signal kind, and the full set
of signal kinds that can observe it:

```rust
#[serde(rename_all = "camelCase")]
pub struct EntityClassDef {
    #[serde(rename = "class")]
    pub entity_class: EntityClass,
    pub primary_namespace: IdentifierNamespace,
    pub primary_signal: SignalKind,
    pub supported_signals: Vec<SignalKind>,
}
```

### AVA.2.8.2 Field Semantics

| Field | Purpose | Example (Aircraft) |
|-------|---------|-------------------|
| `entity_class` | The class being declared | `Aircraft` |
| `primary_namespace` | ID system for Tier 1 hard-key joins | `IcaoHex` |
| `primary_signal` | Canonical/primary signal source | `AdsB` |
| `supported_signals` | All signal kinds that can observe this class | `[AdsB, RfBearing, Radar, Osint]` |

**Normative**: The `entity_class` field MUST serialize as `"class"` (not
`"entityClass"`) per the `#[serde(rename = "class")]` annotation
(`entity.rs:163`). This rename is verified by the test
`entity_class_def_serde_roundtrip()` (`entity.rs:262`).

### AVA.2.8.3 Join Path Validation

The join-path compiler uses `EntityClassDef.supported_signals` to validate
which signal pairs are structurally valid for fusion. A join path
`(SignalKind::A, SignalKind::B)` is valid for `EntityClass::X` if and only
if both A and B appear in the `supported_signals` vector for X.

---

## AVA.2.9 Signal-Entity Observable Matrix

### AVA.2.9.1 Canonical Mappings

The following matrix shows which signal kinds can observe which entity
classes. These mappings are declared via `EntityClassDef` entries in the
`FusionOntologyV2.entity_classes` vector.

| EntityClass | Primary Signal | Primary Namespace | Supported Signals |
|-------------|---------------|-------------------|-------------------|
| Aircraft | AdsB | IcaoHex | AdsB, Radar, RfBearing, Satellite, Osint |
| Vessel | Ais | Mmsi | Ais, Radar, RfBearing, Satellite, Osint |
| GroundVehicle | Radar | LicensePlate | Radar, Satellite, Geoint, Osint |
| RfEmitter | RfBearing | MacAddress | RfBearing, Sdr, Sigint, Elint |
| NetworkHost | Http | IpAddress | Http, Dns, Cyber |
| Domain | Dns | DomainName | Dns, Http, Cyber, Osint |
| Person | Osint | SocialHandle | Osint, Social, Financial, Travel, Humint |
| Organization | Financial | Custom | Financial, Osint, Cyber, Social |
| Campaign | Cyber | Custom | Cyber, Osint, Social, Http, Dns |
| Facility | Geoint | Custom | Geoint, Satellite, Masint, Osint, Humint |

### AVA.2.9.2 Cross-Domain Fusion Paths

The observable matrix enables cross-domain fusion. For example:

- **Aircraft + RF**: AdsB × RfBearing enables geolocation fusion with
  direction-finding bearings.
- **Vessel + Satellite**: Ais × Satellite enables dark-vessel detection
  (AIS gap correlated with satellite imagery).
- **NetworkHost + Cyber**: Http × Cyber enables IOC correlation with
  observed network behavior.
- **Person + Financial**: Social × Financial enables sanctions screening
  against social media presence.

---

## AVA.2.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.2-R1 | SignalKind MUST contain exactly 20 variants | MUST |
| AVA.2-R2 | EntityClass MUST contain exactly 10 variants | MUST |
| AVA.2-R3 | SignalKind MUST serialize as camelCase JSON strings | MUST |
| AVA.2-R4 | EntityClass MUST serialize as camelCase JSON strings | MUST |
| AVA.2-R5 | EntityClassDef.entity_class MUST serialize as `"class"` (not `"entityClass"`) | MUST |
| AVA.2-R6 | Each JoinPathSide MUST declare its DataType (Event or Reference) | MUST |
| AVA.2-R7 | ReferenceSource.nats_subject MUST follow AVA.3 subject pattern conventions | MUST |
| AVA.2-R8 | The d2ts join compiler MUST use DataType to select the join operator | MUST |
| AVA.2-R9 | IdentifierNamespace MUST contain exactly 10 variants | MUST |
| AVA.2-R10 | Custom signal kinds MUST be routed through the `Custom` variant, not added as new enum variants | SHOULD |

---

## AVA.2.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [TSGC-001] Tsingou Sensor Graph Conventions, version 1.0, Section 2.
- [TSGC-001-v2] Tsingou Sensor Graph Conventions, version 2.0, Section 5.4 (ReferenceSource).
- [ava-fusion signal.rs] `ava-fusion/src/signal.rs` — SignalKind (20), DataType, UpdateRate, ReferenceSource
- [ava-fusion entity.rs] `ava-fusion/src/entity.rs` — EntityClass (10), IdentifierNamespace (10), EntityClassDef
- [ava-fusion ontology.rs] `ava-fusion/src/ontology.rs` — FusionOntologyV2.reference_sources
- [AVA.1] [Pipeline Architecture](rfc-section-pipeline-architecture.md) — Crate boundary and ID model
- [AVA.3] [NATS Subject Taxonomy](rfc-section-nats-subject-taxonomy.md) — Subject routing for signal kinds

---

*End of section AVA.2*


---

# AVA.3 NATS Subject Taxonomy

```
Section:       AVA.3 — NATS Subject Taxonomy
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          I — Data Ingest (Normative)
Prerequisites: AVA.1 (Pipeline Architecture), AVA.2 (Signal Schema)
Feeds:         AVA.4 (Source Adapters), AVA.5 (JetStream Persistence)
```

> This section specifies the NATS subject namespace for the ava-fusion pipeline.
> Every sensor reading, fusion result, alarm notification, and control message
> flows through a hierarchical subject tree. The taxonomy maps 1:1 to the 20
> `SignalKind` variants defined in `ava-fusion/src/signal.rs` and supports
> wildcard subscriptions for multi-source ingest. The key words "MUST", "MUST
> NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED",
> "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted
> as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava31-conventions-and-terminology)
2.  [Subject Hierarchy Design](#ava32-subject-hierarchy-design)
3.  [Sensor Ingest Subjects](#ava33-sensor-ingest-subjects)
4.  [Fusion Output Subjects](#ava34-fusion-output-subjects)
5.  [Control Plane Subjects](#ava35-control-plane-subjects)
6.  [KV Bucket Naming](#ava36-kv-bucket-naming)
7.  [JetStream Stream Mapping](#ava37-jetstream-stream-mapping)
8.  [Wildcard Subscription Patterns](#ava38-wildcard-subscription-patterns)
9.  [Per-Domain Subject Catalogs](#ava39-per-domain-subject-catalogs)
10. [Normative Requirements Summary](#ava310-normative-requirements-summary)
11. [References](#ava311-references)

---

## AVA.3.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.3.1.1 Terminology

| Term | Definition |
|------|-----------|
| **Subject** | A NATS subject string using dot-delimited hierarchy (e.g., `sensor.adsb.raw`) |
| **SignalKind** | One of 20 sensor type discriminators from `ava-fusion/src/signal.rs` |
| **EntityClass** | One of 10 entity types from `ava-fusion/src/entity.rs` |
| **Source Adapter** | A component that connects to an external data source and publishes to NATS |
| **JetStream Stream** | A persistent, replayable NATS message stream |
| **KV Bucket** | A NATS JetStream key-value store |
| **Consumer** | A JetStream subscription with delivery guarantees |

### AVA.3.1.2 Subject Syntax

All subjects MUST conform to NATS subject syntax:
- Dot-delimited tokens: `level1.level2.level3`
- Tokens MUST match `[a-zA-Z0-9_-]+` (no spaces, no colons)
- Wildcards: `*` matches one token, `>` matches one or more tokens
- Maximum depth: 16 tokens (NATS server default)

---

## AVA.3.2 Subject Hierarchy Design

### AVA.3.2.1 Root Namespace

All ava-fusion subjects live under four root namespaces:

```
sensor.{kind}.{source}.{format}    # Inbound sensor data
fusion.{tier}.{entity_class}       # Fusion pipeline output
alarm.{severity}.{entity_class}    # Alarm notifications
ctl.{component}.{command}          # Control plane
```

### AVA.3.2.2 Design Principles

1. **SignalKind-first routing**: The second token after `sensor.` MUST be the
   lowercase SignalKind variant name. This enables `sensor.adsb.>` to capture
   all ADS-B data regardless of source or format.

2. **Source provenance**: The third token identifies the data source (e.g.,
   `opensky`, `noaa`, `abusech`). This enables per-source filtering.

3. **Format suffix**: The fourth token indicates payload encoding (e.g., `raw`,
   `json`, `csv`, `sigmf`, `stix`). This enables format-specific parsers.

4. **Entity-routed output**: Fusion results are routed by tier and entity class,
   enabling consumers to subscribe to specific tiers or entity types.

---

## AVA.3.3 Sensor Ingest Subjects

### AVA.3.3.1 Kinetic Domain

| SignalKind | Subject Pattern | Example | Format |
|------------|----------------|---------|--------|
| `AdsB` | `sensor.adsb.{source}.{fmt}` | `sensor.adsb.opensky.json` | OpenSky JSON state vector |
| | | `sensor.adsb.dump1090.raw` | SBS-1 BaseStation format |
| | | `sensor.adsb.adsbx.json` | ADSBexchange API format |
| `Ais` | `sensor.ais.{source}.{fmt}` | `sensor.ais.noaa.csv` | NOAA Marine Cadastre CSV |
| | | `sensor.ais.aishub.nmea` | Raw NMEA sentences |
| | | `sensor.ais.gfw.json` | Global Fishing Watch API |
| `Radar` | `sensor.radar.{source}.{fmt}` | `sensor.radar.swim.json` | FAA SWIM track data |
| | | `sensor.radar.nexrad.raw` | NOAA NEXRAD Level II |
| | | `sensor.radar.synthetic.json` | Generated test data |
| `Satellite` | `sensor.satellite.{source}.{fmt}` | `sensor.satellite.sentinel.geotiff` | Sentinel-2 imagery |
| | | `sensor.satellite.firms.json` | NASA FIRMS hotspots |
| | | `sensor.satellite.landsat.json` | USGS Landsat metadata |

**Normative**: All SensorIngestor actors MUST subscribe to `sensor.{kind}.>` for
their assigned SignalKind. The wildcard captures all sources and formats.

### AVA.3.3.2 RF/Signals Domain

| SignalKind | Subject Pattern | Example | Format |
|------------|----------------|---------|--------|
| `RfBearing` | `sensor.rfbearing.{source}.{fmt}` | `sensor.rfbearing.kiwisdr.json` | Bearing measurement |
| | | `sensor.rfbearing.synthetic.json` | Generated DF data |
| `Sdr` | `sensor.sdr.{source}.{fmt}` | `sensor.sdr.gnuradio.sigmf` | SigMF metadata + IQ ref |
| | | `sensor.sdr.rtlsdr.iq` | Raw IQ samples |
| | | `sensor.sdr.websdr.json` | WebSDR spectrum data |
| `Sigint` | `sensor.sigint.{source}.{fmt}` | `sensor.sigint.fcc.json` | FCC license DB records |
| | | `sensor.sigint.itu.json` | ITU frequency allocations |
| | | `sensor.sigint.synthetic.json` | Generated intercept reports |
| `Elint` | `sensor.elint.{source}.{fmt}` | `sensor.elint.ewdb.json` | EW parameter database |
| | | `sensor.elint.synthetic.json` | Generated emitter data |
| `Comint` | `sensor.comint.{source}.{fmt}` | `sensor.comint.synthetic.json` | Generated COMINT reports |

**Normative**: RF signal subjects carrying IQ sample references SHOULD use the
NATS Object Store for the actual sample data, with the subject message containing
only metadata and an object store reference key.

### AVA.3.3.3 Cyber/Network Domain

| SignalKind | Subject Pattern | Example | Format |
|------------|----------------|---------|--------|
| `Http` | `sensor.http.{source}.{fmt}` | `sensor.http.zeek.json` | Zeek http.log JSON |
| | | `sensor.http.pcap.json` | Parsed PCAP metadata |
| | | `sensor.http.cicids.csv` | CICIDS2017 dataset |
| `Dns` | `sensor.dns.{source}.{fmt}` | `sensor.dns.passive.json` | Passive DNS records |
| | | `sensor.dns.zeek.json` | Zeek dns.log JSON |
| | | `sensor.dns.tranco.csv` | Tranco top-1M list |
| `Cyber` | `sensor.cyber.{source}.{fmt}` | `sensor.cyber.mitre.stix` | MITRE ATT&CK STIX 2.1 |
| | | `sensor.cyber.otx.json` | AlienVault OTX pulses |
| | | `sensor.cyber.abusech.json` | abuse.ch IOCs |
| | | `sensor.cyber.cisa.json` | CISA KEV catalog |
| | | `sensor.cyber.misp.stix` | MISP feed STIX bundles |

**Normative**: STIX 2.1 bundles MUST be published with format token `stix`.
Non-STIX threat feeds MUST use `json`. This enables format-specific
deserialization at the subscriber bridge.

### AVA.3.3.4 OSINT/Social/Financial Domain

| SignalKind | Subject Pattern | Example | Format |
|------------|----------------|---------|--------|
| `Osint` | `sensor.osint.{source}.{fmt}` | `sensor.osint.gdelt.json` | GDELT events |
| | | `sensor.osint.gdelt.gkg` | GDELT Global Knowledge Graph |
| | | `sensor.osint.news.rss` | RSS feed items |
| | | `sensor.osint.wayback.json` | Wayback Machine CDX |
| `Social` | `sensor.social.{source}.{fmt}` | `sensor.social.mastodon.json` | Mastodon public timeline |
| | | `sensor.social.bluesky.json` | AT Protocol firehose |
| | | `sensor.social.reddit.json` | Reddit API/Pushshift |
| | | `sensor.social.github.json` | GitHub Events API |
| `Financial` | `sensor.financial.{source}.{fmt}` | `sensor.financial.ofac.json` | OFAC SDN list |
| | | `sensor.financial.opensanctions.json` | OpenSanctions entities |
| | | `sensor.financial.gleif.json` | LEI database records |
| | | `sensor.financial.edgar.json` | SEC EDGAR filings |
| `Travel` | `sensor.travel.{source}.{fmt}` | `sensor.travel.synthetic.json` | Generated PNR records |
| | | `sensor.travel.openflights.csv` | OpenFlights routes |

### AVA.3.3.5 GEOINT/HUMINT/MASINT Domain

| SignalKind | Subject Pattern | Example | Format |
|------------|----------------|---------|--------|
| `Geoint` | `sensor.geoint.{source}.{fmt}` | `sensor.geoint.osm.geojson` | OpenStreetMap features |
| | | `sensor.geoint.firms.json` | NASA FIRMS hotspots |
| | | `sensor.geoint.sentinel.json` | Sentinel analysis products |
| | | `sensor.geoint.ghsl.geotiff` | Global Human Settlement |
| `Humint` | `sensor.humint.{source}.{fmt}` | `sensor.humint.acled.json` | ACLED conflict events |
| | | `sensor.humint.reliefweb.json` | UN OCHA reports |
| | | `sensor.humint.synthetic.salute` | SALUTE format reports |
| `Masint` | `sensor.masint.{source}.{fmt}` | `sensor.masint.usgs.json` | USGS earthquake data |
| | | `sensor.masint.noaa.json` | NOAA buoy measurements |
| | | `sensor.masint.epa.json` | EPA AirNow readings |
| | | `sensor.masint.ctbto.json` | Seismic monitoring data |

### AVA.3.3.6 Custom Signal Kind

| SignalKind | Subject Pattern | Example | Format |
|------------|----------------|---------|--------|
| `Custom` | `sensor.custom.{source}.{fmt}` | `sensor.custom.operator.json` | Operator-defined |

**Normative**: Custom signal subjects MUST follow the same 4-token pattern.
The `source` token SHOULD identify the operator or system that produces the data.

---

## AVA.3.4 Fusion Output Subjects

### AVA.3.4.1 Fusion Results

```
fusion.{tier}.{entity_class}.results
```

| Tier | Subject | Description |
|------|---------|-------------|
| Tier 1 | `fusion.tier1.aircraft.results` | Hard-key identity matches (ICAO hex) |
| Tier 1 | `fusion.tier1.vessel.results` | Hard-key identity matches (MMSI) |
| Tier 1 | `fusion.tier1.networkhost.results` | Hard-key identity matches (IP) |
| Tier 2 | `fusion.tier2.aircraft.results` | Soft-key probabilistic correlations |
| Tier 2 | `fusion.tier2.vessel.results` | Soft-key spatial/temporal matches |
| Tier 3 | `fusion.tier3.rfemitter.results` | Derived statistical patterns |
| Tier 3 | `fusion.tier3.campaign.results` | Derived behavioral patterns |

**Normative**: Wildcard `fusion.tier1.>` MUST capture all Tier 1 results.
Wildcard `fusion.>.aircraft.>` MUST capture all aircraft results across tiers.

### AVA.3.4.2 Track Updates

```
fusion.tracks.{entity_class}.{event}
```

| Subject | Description |
|---------|-------------|
| `fusion.tracks.aircraft.created` | New track initiated |
| `fusion.tracks.aircraft.updated` | Track state updated |
| `fusion.tracks.aircraft.merged` | Tracks merged (identity resolution) |
| `fusion.tracks.aircraft.dropped` | Track dropped (coasting expired) |
| `fusion.tracks.vessel.created` | Maritime track initiated |

### AVA.3.4.3 Alarm Notifications

```
alarm.{severity}.{entity_class}
```

| Subject | Description |
|---------|-------------|
| `alarm.critical.aircraft` | Critical aircraft alarm (e.g., ADS-B spoofing) |
| `alarm.warning.vessel` | Warning vessel alarm (e.g., AIS gap > threshold) |
| `alarm.info.networkhost` | Informational network alarm |
| `alarm.absence.aircraft` | Absence detection alarm |

---

## AVA.3.5 Control Plane Subjects

```
ctl.{component}.{command}
```

| Subject | Description | Direction |
|---------|-------------|-----------|
| `ctl.pipeline.start` | Start the supervision tree | External → Pipeline |
| `ctl.pipeline.stop` | Graceful shutdown | External → Pipeline |
| `ctl.pipeline.status` | Request pipeline status | Request/Reply |
| `ctl.feeder.start` | Start data feeder | External → Feeder |
| `ctl.feeder.stop` | Stop data feeder | External → Feeder |
| `ctl.feeder.rate` | Set feeder publish rate | External → Feeder |
| `ctl.adapter.register` | Register new source adapter | External → Pipeline |
| `ctl.adapter.deregister` | Remove source adapter | External → Pipeline |

---

## AVA.3.6 KV Bucket Naming

| Bucket | Key Pattern | Value | Purpose |
|--------|------------|-------|---------|
| `ava-config` | `pipeline.{name}` | JSON PipelineConfig | Runtime configuration |
| `ava-config` | `joinpath.{id}` | JSON JoinPathEntryV2 | Join path definitions |
| `ava-state` | `entity.{entity_id}` | JSON EntityState | Latest entity state |
| `ava-state` | `track.{track_id}` | JSON TrackState | Latest track state |
| `ava-metrics` | `actor.{name}.stats` | JSON ActorMetrics | Actor performance counters |
| `ava-schemas` | `signal.{kind}` | JSON Schema | Signal payload schemas |

**Normative**: KV bucket keys MUST use dots (`.`) as separators.
Colons (`:`) are INVALID in NATS KV keys (they become NATS subjects internally).

---

## AVA.3.7 JetStream Stream Mapping

| Stream Name | Subjects | Retention | Max Age | Purpose |
|-------------|----------|-----------|---------|---------|
| `SENSOR_KINETIC` | `sensor.adsb.>`, `sensor.ais.>`, `sensor.radar.>`, `sensor.satellite.>` | Limits | 24h | Kinetic sensor replay |
| `SENSOR_RF` | `sensor.rfbearing.>`, `sensor.sdr.>`, `sensor.sigint.>`, `sensor.elint.>`, `sensor.comint.>` | Limits | 24h | RF signal replay |
| `SENSOR_CYBER` | `sensor.http.>`, `sensor.dns.>`, `sensor.cyber.>` | Limits | 72h | Cyber data replay |
| `SENSOR_OSINT` | `sensor.osint.>`, `sensor.social.>`, `sensor.financial.>`, `sensor.travel.>` | Limits | 72h | OSINT replay |
| `SENSOR_GEO` | `sensor.geoint.>`, `sensor.humint.>`, `sensor.masint.>` | Limits | 168h | Geo/human replay |
| `FUSION_RESULTS` | `fusion.>` | Limits | 168h | All fusion output |
| `ALARMS` | `alarm.>` | Interest | 720h | Alarm archive |

**Normative**: Each stream MUST capture exactly the subjects listed. Streams
MUST NOT overlap (a subject MUST belong to exactly one stream).

---

## AVA.3.8 Wildcard Subscription Patterns

### AVA.3.8.1 Ingest Wildcards (SensorIngestor actors)

| Actor | Subscription | Captures |
|-------|-------------|----------|
| SensorIngestor (ADS-B) | `sensor.adsb.>` | All ADS-B sources and formats |
| SensorIngestor (AIS) | `sensor.ais.>` | All AIS sources and formats |
| SensorIngestor (Cyber) | `sensor.cyber.>` | All cyber threat feeds |
| SensorIngestor (All) | `sensor.>` | Every sensor message (monitoring) |

### AVA.3.8.2 Output Wildcards (consumers)

| Use Case | Subscription | Captures |
|----------|-------------|----------|
| All Tier 1 results | `fusion.tier1.>` | All hard-key matches |
| All aircraft | `fusion.*.aircraft.>` | Aircraft across all tiers |
| All alarms | `alarm.>` | Every alarm notification |
| Critical alarms only | `alarm.critical.>` | Critical severity only |

---

## AVA.3.9 Per-Domain Subject Catalogs

Detailed data source specifications, including API endpoints, authentication,
data formats, rate limits, and cross-correlation opportunities, are documented
in the research data source catalogs:

| Domain | Catalog | SignalKinds |
|--------|---------|-------------|
| Kinetic | [kinetic-domain.md](../../research/data-sources/kinetic-domain.md) | AdsB, Ais, Radar, Satellite |
| RF/Signals | [rf-signals-domain.md](../../research/data-sources/rf-signals-domain.md) | RfBearing, Sdr, Sigint, Elint, Comint |
| Cyber/Network | [cyber-network-domain.md](../../research/data-sources/cyber-network-domain.md) | Http, Dns, Cyber |
| OSINT/Social/Financial | [osint-social-financial-domain.md](../../research/data-sources/osint-social-financial-domain.md) | Osint, Social, Financial, Travel |
| GEOINT/HUMINT/MASINT | [geoint-humint-masint-domain.md](../../research/data-sources/geoint-humint-masint-domain.md) | Geoint, Humint, Masint |

---

## AVA.3.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.3-R1 | All sensor subjects MUST follow `sensor.{kind}.{source}.{format}` pattern | MUST |
| AVA.3-R2 | The `{kind}` token MUST be the lowercase SignalKind variant name | MUST |
| AVA.3-R3 | Fusion output subjects MUST follow `fusion.{tier}.{entity_class}.results` | MUST |
| AVA.3-R4 | KV bucket keys MUST use dots as separators, MUST NOT use colons | MUST |
| AVA.3-R5 | JetStream streams MUST NOT have overlapping subject filters | MUST |
| AVA.3-R6 | STIX 2.1 bundles MUST use format token `stix` | MUST |
| AVA.3-R7 | IQ sample data SHOULD use Object Store with metadata-only subject messages | SHOULD |
| AVA.3-R8 | Custom signals MUST follow the 4-token sensor subject pattern | MUST |
| AVA.3-R9 | All subjects MUST conform to NATS subject syntax (`[a-zA-Z0-9_-]+` tokens) | MUST |
| AVA.3-R10 | SensorIngestor actors MUST subscribe to `sensor.{kind}.>` wildcards | MUST |

---

## AVA.3.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [NATS Subjects] https://docs.nats.io/nats-concepts/subjects
- [NATS JetStream] https://docs.nats.io/nats-concepts/jetstream
- [NATS KV] https://docs.nats.io/nats-concepts/jetstream/key-value-store
- [ava-fusion SignalKind] `ava-fusion/src/signal.rs` — 20 variants
- [ava-fusion EntityClass] `ava-fusion/src/entity.rs` — 10 variants

---

*End of section AVA.3*


---

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


---

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


---


---

# PART II: PROCESSING (Normative)

---

# AVA.6 Actor Model

```
Section:       AVA.6 — Actor Model (asupersync)
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          II — Processing (Normative)
Prerequisites: AVA.1 (Pipeline Architecture), AVA.5 (JetStream Persistence)
Feeds:         AVA.7 (Supervision Tree), AVA.8 (Differential Dataflow Engine)
```

> This section specifies the GenServer actor model used by the ava-fusion pipeline.
> Six actors implement the processing stages, each with typed mailboxes, budget-bounded
> execution, cancel-masked mutations, and structured observability via the `asupersync`
> runtime. The actor model draws from Erlang/OTP GenServer semantics adapted for Rust's
> ownership system. The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
> "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in
> this document are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava61-conventions-and-terminology)
2.  [GenServer Trait Contract](#ava62-genserver-trait-contract)
3.  [Actor Catalog](#ava63-actor-catalog)
4.  [SensorIngestor](#ava64-sensoringestor)
5.  [EntityResolver](#ava65-entityresolver)
6.  [FusionEngine](#ava66-fusionengine)
7.  [TrackManager](#ava67-trackmanager)
8.  [AbsenceDetector](#ava68-absencedetector)
9.  [AlarmEvaluator](#ava69-alarmevaluator)
10. [Inter-Actor Message Flow](#ava610-inter-actor-message-flow)
11. [Normative Requirements Summary](#ava611-normative-requirements-summary)
12. [References](#ava612-references)

---

## AVA.6.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.6.1.1 Terminology

| Term | Definition |
|------|-----------|
| **GenServer** | The `asupersync::gen_server::GenServer` trait — typed mailbox protocol with `handle_call`, `handle_cast`, `handle_info`, `on_start`, `on_stop` |
| **Call** | Synchronous request with a `Reply<T>` obligation token; caller blocks until reply |
| **Cast** | Asynchronous fire-and-forget message; no reply expected |
| **Info** | External signal (NATS message, timer tick, system event) delivered to the actor |
| **Cx** | The `asupersync::cx::Cx` execution context providing `trace()`, `checkpoint()`, `masked()`, `budget()`, `timer_driver()` |
| **Budget** | `asupersync::types::Budget` — poll/cost quota that bounds computation per handler invocation |
| **Obligation** | A `Reply<T>` token that MUST be resolved (sent) before the actor stops; leaked obligations trigger `ObligationLeakOracle` failures in lab mode |
| **Cancel Mask** | `cx.masked(|| { ... })` — defers supervisor-initiated cancellation until the closure returns, ensuring atomic state mutations |
| **Checkpoint** | `cx.checkpoint_with(msg)` — records progress for stuck-task detection and work-stealing scheduler hints |
| **CastOverflowPolicy** | Mailbox overflow strategy: `DropOldest` sheds stale messages under backpressure |

---

## AVA.6.2 GenServer Trait Contract

All six pipeline actors implement the `GenServer` trait defined in
`asupersync::gen_server`. The trait requires four associated types and five
handler methods (`ava-fusion-runtime/src/actors/mod.rs`):

```rust
pub trait GenServer {
    type Call;                // Synchronous request type
    type Reply;               // Synchronous reply type
    type Cast;                // Async fire-and-forget type
    type Info;                // External signal type

    fn handle_call(&mut self, cx: &Cx, request: Self::Call, reply: Reply<Self::Reply>)
        -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
    fn handle_cast(&mut self, cx: &Cx, msg: Self::Cast)
        -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
    fn handle_info(&mut self, cx: &Cx, msg: Self::Info)
        -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
    fn on_start(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
    fn on_stop(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;
}
```

### AVA.6.2.1 Budget and Obligation Model

Every handler invocation runs within a `Budget`. Actors MUST check `cx.budget()`
before expensive computation and yield when exhausted. The budget model enforces
cooperative scheduling across the actor pool:

- **`Budget::MINIMAL`** — used for `on_stop_budget()` across all actors; shutdown
  handlers run with minimal allocation to ensure rapid teardown.
- **`Budget::INFINITE`** — used for `on_start_budget()` where initialization
  (e.g., DataflowWorker creation) may be unbounded.

The obligation model applies specifically to `Reply<T>` tokens in `handle_call`:
- A `Reply<T>` token MUST be resolved via `reply.send(value)`.
- Dropping a `Reply<T>` without sending constitutes an **obligation leak**.
- In lab mode, the `ObligationLeakOracle` detects leaked obligations as test failures.

### AVA.6.2.2 Cancel-Masked Mutations

When a handler mutates shared state structures (e.g., `entity_tracks` in
FusionEngine), the mutation MUST be wrapped in `cx.masked(|| { ... })` to
prevent partial updates during supervisor-initiated cancellation
(`ava-fusion-runtime/src/actors/fusion_engine.rs:315-334`):

```rust
cx.masked(|| {
    match event {
        TrackEventKind::Dropped => {
            for tracks in self.entity_tracks.values_mut() {
                tracks.retain(|t| *t != track_id);
            }
        }
        // ...
    }
});
```

### AVA.6.2.3 Checkpoint Observability

Actors SHOULD call `cx.checkpoint_with(msg)` after processing batches to provide
structured diagnostics. The checkpoint message enables:
- Stuck-task detection by the supervisor
- Work-stealing scheduler hints for load balancing
- Audit trails for post-incident analysis

---

## AVA.6.3 Actor Catalog

The six actors are defined in `ava-fusion-runtime/src/actors/mod.rs`:

| Actor | Module | Pattern | Key Trait |
|-------|--------|---------|-----------|
| **SensorIngestor** | `sensor_ingestor.rs` | `handle_info` for NATS messages | `CastOverflowPolicy::DropOldest` backpressure |
| **EntityResolver** | `entity_resolver.rs` | Singleton via `NameRegistry` | `NameLease` obligation for registry entry |
| **FusionEngine** | `fusion_engine.rs` | Supervised tree + DataflowWorker | Region-scoped cancel propagation |
| **TrackManager** | `track_manager.rs` | Stateful GenServer | FSM: Tentative->Confirmed->Coasting->Dropped->Merged |
| **AbsenceDetector** | `absence_detector.rs` | Timer-driven `handle_info(Timeout)` | Budget-bounded detection deadline |
| **AlarmEvaluator** | `alarm_evaluator.rs` | `handle_call` with `Reply<AlarmAck>` | Obligation-tracked alarm lifecycle |

---

## AVA.6.4 SensorIngestor

**Source**: `ava-fusion-runtime/src/actors/sensor_ingestor.rs` (242 lines)

The SensorIngestor is the pipeline's entry point. Each instance handles a single
signal source (one per NATS subject/feed type). Under load, stale readings are
shed rather than buffered indefinitely.

### AVA.6.4.1 Message Types

| Channel | Type | Variants |
|---------|------|----------|
| Call | `IngestorCall` | `GetStats`, `GetSourceId` |
| Reply | `IngestorReply` | `Stats { buffered, total_ingested, total_dropped }`, `SourceId(SignalSourceId)` |
| Cast | `IngestorCast` | `BackpressureOn`, `BackpressureOff` |
| Info | `IngestorInfo` | `NatsMessage { subject, payload, timestamp_ms }`, `System(SystemMsg)` |

### AVA.6.4.2 Backpressure Strategy

The ingestor uses `CastOverflowPolicy::DropOldest` (line 240). When the
internal buffer reaches `max_buffer_size`, the oldest reading is evicted before
the new one is pushed (lines 187-200). This implements a **latest-value-wins**
semantic appropriate for sensor telemetry where recency dominates.

### AVA.6.4.3 State

```rust
pub struct SensorIngestor {
    source_id: SignalSourceId,
    signal_kind: SignalKind,
    buffer: Vec<BufferedReading>,
    max_buffer_size: usize,
    backpressure_active: bool,
    total_ingested: u64,
    total_dropped: u64,
}
```

Downstream consumers call `drain_buffer()` to atomically take all buffered
readings via `std::mem::take`.

---

## AVA.6.5 EntityResolver

**Source**: `ava-fusion-runtime/src/actors/entity_resolver.rs` (391 lines)

The EntityResolver is a **singleton** registered via `NameRegistry` under the
key `"entity-resolver"`. Other actors discover it via `Cx::whereis()`. The
`NameLease` obligation guarantees the registry entry is cleaned up on shutdown.

### AVA.6.5.1 Message Types

| Channel | Type | Key Variants |
|---------|------|-------------|
| Call | `ResolverCall` | `Resolve { source_id, identifier, entity_class }`, `Bind`, `Unbind`, `GetIdentifiers`, `ListEntities` |
| Reply | `ResolverReply` | `Resolved { entity_id, confidence }`, `Unresolved { suggested_entity_id }`, `Bound`, `Unbound`, `NotFound` |
| Cast | `ResolverCast` | `MergeHint { entity_a, entity_b, confidence }`, `InvalidateCache` |

### AVA.6.5.2 Resolution Algorithm

Resolution uses a dual-index structure:
- **Forward index**: `HashMap<EntityId, EntityRecord>` — entity to bindings
- **Reverse index**: `HashMap<(SignalSourceId, String), EntityId>` — fast lookup

A `Resolve` call checks the reverse index first. Direct matches return
confidence `1.0`. When no match exists, a new `EntityId` is generated via a
monotonic sequence counter with format `"{EntityClass}-{seq:06}"` (line 177-183).

### AVA.6.5.3 Singleton Guarantee

The EntityResolver MUST be started via `named_gen_server_start()` in `pipeline.rs`
(line 266). The `NameRegistrationPolicy::Register` with `NameCollisionPolicy::Fail`
ensures exactly one instance runs at any time. Supervised under
`Restart(max 5)` — after 5 crashes in 120s, it stops permanently to prevent
infinite restart loops from poisoning the registry.

---

## AVA.6.6 FusionEngine

**Source**: `ava-fusion-runtime/src/actors/fusion_engine.rs` (473 lines)

The FusionEngine is the computational core. Each instance handles one fusion tier
and delegates computation to a `DataflowWorker` on a dedicated OS thread.

### AVA.6.6.1 Fusion Tiers

| Tier | Name | Join Strategy |
|------|------|--------------|
| Tier 1 | `tier1-hard-key` | Deterministic identity joins (ICAO hex, MMSI, IP) |
| Tier 2 | `tier2-soft-key` | Probabilistic correlation (spatial, temporal, spectral) |
| Tier 3 | `tier3-derived` | Statistical/behavioral pattern detection |

### AVA.6.6.2 Message Types

| Channel | Type | Key Variants |
|---------|------|-------------|
| Call | `FusionCall` | `Correlate { source_a, source_b, ... }`, `GetEntityFusionState`, `ListActiveJoinPaths` |
| Reply | `FusionReply` | `CorrelationResult { confidence, track_id, join_path_id }`, `EntityState`, `ActiveJoinPaths` |
| Cast | `FusionCast` | `IngestReading { source_id, payload, timestamp_ms }`, `TrackEvent { track_id, event }` |
| Info | `FusionInfo` | `WindowFlush { window_id }`, `System(SystemMsg)` |

### AVA.6.6.3 DataflowWorker Integration

Communication with the DataflowWorker uses crossbeam channels:
- `handle_cast(IngestReading)` sends `DataflowCommand::Insert` via `cmd_tx` (line 295)
- `handle_info(WindowFlush)` sends `DataflowCommand::AdvanceTime` and drains results (lines 357-359)
- `on_start()` creates the worker from `join_path_configs` (line 420)
- `on_stop()` requests cooperative cancel then shuts down and joins the thread (lines 444-453)

### AVA.6.6.4 Cancel-Masked State Updates

The `process_results()` method and `TrackEvent` mutations are wrapped in
`cx.masked()` to guarantee `entity_tracks` consistency during supervisor
shutdown (lines 315-334, 381-383). The entity_tracks HashMap maintains
positive diffs (new matches) and removes tracks for negative diffs (retracted matches).

### AVA.6.6.5 Budget-Aware Window Processing

Before processing window results, the engine checks `cx.budget().is_exhausted()`
(line 366). If the budget is exhausted, processing is deferred to avoid starving
other actors in the cooperative scheduler:

```rust
let budget = cx.budget();
if budget.is_exhausted() {
    tracing::warn!("Window flush: budget exhausted, deferring processing");
    return Box::pin(async {});
}
```

---

## AVA.6.7 TrackManager

**Source**: `ava-fusion-runtime/src/actors/track_manager.rs` (399 lines)

The TrackManager maintains the lifecycle state machine for all fused tracks.

### AVA.6.7.1 Track Lifecycle FSM

```text
Tentative --> Confirmed --> Coasting --> Dropped
                 ^             |
                 +-------------+ (recovery)
         any non-terminal --> Merged
```

Transitions are validated via `ava_fusion::is_valid_transition(from, to)` (line 226).
Invalid transitions are rejected with diagnostic information including the current
state and requested state.

### AVA.6.7.2 Message Types

| Channel | Type | Key Variants |
|---------|------|-------------|
| Call | `TrackCall` | `CreateTrack`, `Transition { to_state, reason }`, `GetTrackState`, `ListEntityTracks`, `ActiveTrackCount` |
| Reply | `TrackReply` | `Created`, `Transitioned { transition }`, `TransitionRejected { current, requested }`, `NotFound` |
| Cast | `TrackCast` | `ObservationReceived { track_id, timestamp_ms }`, `PurgeTerminal { older_than_ms }` |
| Info | `TrackInfo` | `CoastCheck { tick_id }`, `System(SystemMsg)` |

### AVA.6.7.3 State Structure

The TrackManager maintains dual indexes:
- **Forward**: `HashMap<TrackId, TrackRecord>` — track state, entity binding, observation count
- **Reverse**: `HashMap<EntityId, Vec<TrackId>>` — entity to tracks

New tracks always start in `Tentative` state (line 203). The `PurgeTerminal` cast
removes all terminal tracks (Dropped/Merged) and cleans up the entity index (lines 319-336).

---

## AVA.6.8 AbsenceDetector

**Source**: `ava-fusion-runtime/src/actors/absence_detector.rs` (402 lines)

Timer-driven actor that monitors expected signal sources and raises absence events
when signals are not received within configured deadlines.

### AVA.6.8.1 Message Types

| Channel | Type | Key Variants |
|---------|------|-------------|
| Call | `AbsenceCall` | `RegisterExpected { source_id, deadline_ms }`, `Unregister`, `GetStatus`, `ListExpectations` |
| Reply | `AbsenceReply` | `Registered`, `Unregistered`, `Status { absent_sources }`, `Expectations` |
| Cast | `AbsenceCast` | `SignalReceived { source_id, timestamp_ms }`, `BulkSignalReceived { signals }` |
| Info | `AbsenceInfo` | `EvaluationTick { tick_id, current_time_ms }`, `System(SystemMsg)` |

### AVA.6.8.2 Evaluation Algorithm

On each `EvaluationTick`, all registered expectations are checked (lines 165-194):
1. Compute silence duration: `current_time_ms - last_seen_ms` (or `current_time_ms` if never seen)
2. If `silence > deadline_ms` and not already absent: transition to absent, emit `AbsentSource`
3. If `silence <= deadline_ms` and currently absent: transition to recovered, increment recovery counter

The evaluation uses virtual time from `cx.timer_driver()` when available (line 344),
falling back to the message's wall-clock timestamp. Virtual time enables
deterministic testing under the `LabRuntime`.

### AVA.6.8.3 Budget-Bounded Detection

Before each evaluation, the detector calls `cx.checkpoint_with()` (lines 330-339).
If the checkpoint fails (supervisor cancelled), the evaluation is aborted:

```rust
if cx.checkpoint_with(format!(
    "tick {} evaluating {} expectations",
    self.total_ticks, self.expectations.len()
)).is_err() {
    return Box::pin(async {});
}
```

---

## AVA.6.9 AlarmEvaluator

**Source**: `ava-fusion-runtime/src/actors/alarm_evaluator.rs` (385 lines)

The AlarmEvaluator manages alarm lifecycle with **obligation-tracked acknowledgments**.
This is the strongest application of asupersync's obligation model in the pipeline.

### AVA.6.9.1 Obligation Protocol

```text
Alarm detected --> Reply<AlarmAck> issued (obligation reserved)
    |
    +-- Operator acknowledges --> reply.send(Ack)      (obligation committed)
    +-- Operator shelves      --> reply.send(Shelved)   (obligation committed)
    +-- Timeout/drop          --> PANIC (obligation leaked = unhandled alarm)
```

This turns "forgotten alarm acknowledgments" from a runtime bug into a structural
guarantee. The `Reply<AlarmAck>` token MUST be resolved; dropping it triggers
`ObligationLeakOracle` in lab mode.

### AVA.6.9.2 Alarm Severity (ISA/IEC 62682)

| Level | Enum | Meaning |
|-------|------|---------|
| Low | `AlarmSeverity::Low` | Informational — no operator action required |
| Medium | `AlarmSeverity::Medium` | Warning — operator should investigate |
| High | `AlarmSeverity::High` | Critical — immediate operator action required |
| Critical | `AlarmSeverity::Critical` | Emergency — safety-critical, auto-escalation |

### AVA.6.9.3 Alarm Conditions

Four condition types trigger evaluation (`ava-fusion-runtime/src/actors/alarm_evaluator.rs:112-121`):

| Condition | Fields | Source |
|-----------|--------|--------|
| `ThresholdExceeded` | `metric`, `value`, `limit` | Sensor readings |
| `RateOfChange` | `metric`, `rate`, `limit` | Computed derivatives |
| `SignalAbsent` | `expected_source` | AbsenceDetector |
| `AnomalyDetected` | `model`, `score` | Statistical models |

### AVA.6.9.4 Shutdown Obligation Audit

On stop, the evaluator audits for unresolved obligations (lines 364-369):

```rust
if !self.active_alarms.is_empty() {
    tracing::error!(
        leaked_count = self.active_alarms.len(),
        "AlarmEvaluator stopped with unresolved alarm obligations!"
    );
}
```

---

## AVA.6.10 Inter-Actor Message Flow

```text
NATS Subscription
    |
    v
SensorIngestor  --[drain_buffer]--> FusionEngine  --[TrackEvent]--> FusionEngine
    |                                    |                              |
    |                                    v                              |
    |                              EntityResolver                       |
    |                              (Resolve/Bind)                       |
    |                                    |                              v
    |                                    v                         TrackManager
    |                              FusionResult                   (CreateTrack,
    |                             (entity_tracks)                  Transition)
    |                                    |                              |
    v                                    v                              v
AbsenceDetector  --[SignalAbsent]--> AlarmEvaluator <--[CoastCheck]-- TrackManager
(EvaluationTick)                    (Evaluate/Ack)
```

### AVA.6.10.1 Data Path

1. **Ingest**: NATS messages arrive as `IngestorInfo::NatsMessage` on SensorIngestor
2. **Buffer**: Readings are buffered; downstream calls `drain_buffer()` to consume
3. **Fusion**: FusionEngine receives readings via `FusionCast::IngestReading`, forwards to DataflowWorker
4. **Resolution**: FusionEngine queries EntityResolver via `ResolverCall::Resolve` for identity binding
5. **Tracking**: Fusion results create/update tracks via `TrackCall::CreateTrack` and `TrackCall::Transition`
6. **Absence**: AbsenceDetector receives `SignalReceived` casts and evaluates deadlines on tick
7. **Alarm**: AlarmEvaluator receives conditions from AbsenceDetector and FusionEngine

### AVA.6.10.2 Control Path

- **BackpressureOn/Off**: Downstream signals SensorIngestor to shed or resume (cast)
- **CoastCheck**: Periodic tick evaluates track coasting timeouts in TrackManager
- **TimeoutCheck**: Periodic tick evaluates alarm timeouts in AlarmEvaluator
- **EvaluationTick**: Periodic tick triggers absence evaluation in AbsenceDetector

---

## AVA.6.11 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.6-R1 | All pipeline actors MUST implement the `GenServer` trait with typed `Call`, `Reply`, `Cast`, `Info` associated types | MUST |
| AVA.6-R2 | `handle_call` handlers MUST resolve the `Reply<T>` obligation token before returning; dropping it constitutes an obligation leak | MUST |
| AVA.6-R3 | Actors MUST use `cx.masked(|| { ... })` for state mutations that span multiple data structure updates to prevent partial state on cancellation | MUST |
| AVA.6-R4 | Actors SHOULD call `cx.checkpoint_with(msg)` after processing batches for stuck-task detection | SHOULD |
| AVA.6-R5 | SensorIngestor MUST use `CastOverflowPolicy::DropOldest` for latest-value-wins backpressure | MUST |
| AVA.6-R6 | EntityResolver MUST be registered as a singleton via `NameRegistry` with `NameCollisionPolicy::Fail` | MUST |
| AVA.6-R7 | FusionEngine MUST check `cx.budget().is_exhausted()` before processing window results and defer if exhausted | MUST |
| AVA.6-R8 | TrackManager MUST validate state transitions via `is_valid_transition(from, to)` and reject invalid transitions | MUST |
| AVA.6-R9 | AbsenceDetector SHOULD use virtual time from `cx.timer_driver()` for deterministic evaluation under LabRuntime | SHOULD |
| AVA.6-R10 | AlarmEvaluator MUST audit for unresolved alarm obligations on shutdown and log leaked obligations at ERROR level | MUST |

---

## AVA.6.12 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [ISA/IEC 62682] "Management of Alarm Systems for the Process Industries", ISA, 2014.
- [AVA.1] [Pipeline Architecture](rfc-section-pipeline-architecture.md)
- [AVA.5] [JetStream Persistence](rfc-section-jetstream-persistence.md)
- [AVA.7] [Supervision Tree](rfc-section-supervision-tree.md)
- [AVA.8] [Differential Dataflow Engine](rfc-section-differential-dataflow.md)
- [asupersync GenServer] `asupersync::gen_server` — typed mailbox protocol
- [ava-fusion-runtime actors] `ava-fusion-runtime/src/actors/mod.rs` — 6 actor modules
- [ava-fusion-runtime pipeline] `ava-fusion-runtime/src/pipeline.rs` — supervision tree wiring

---

*End of section AVA.6*


---

# AVA.7 Supervision Tree

```
Section:       AVA.7 — Supervision Tree
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          II — Processing (Normative)
Prerequisites: AVA.6 (Actor Model)
Feeds:         AVA.8 (Differential Dataflow Engine), AVA.14 (Deployment Topology)
```

> This section specifies the supervision tree that wires the six GenServer actors
> into a fault-tolerant pipeline. The tree defines child specifications, restart
> strategies, dependency ordering, and lifecycle management. The supervision model
> follows Erlang/OTP conventions adapted for Rust via the `asupersync` runtime's
> `AppSpec`, `ChildSpec`, and `SupervisionStrategy` primitives. The key words "MUST",
> "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED",
> "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as
> described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava71-conventions-and-terminology)
2.  [Tree Topology](#ava72-tree-topology)
3.  [PipelineConfig](#ava73-pipelineconfig)
4.  [FusionTierConfig](#ava74-fusiontierconfig)
5.  [ChildSpec Factories](#ava75-childspec-factories)
6.  [Restart Strategies](#ava76-restart-strategies)
7.  [Dependency Ordering](#ava77-dependency-ordering)
8.  [Actor Lifecycle](#ava78-actor-lifecycle)
9.  [Pipeline Startup Sequence](#ava79-pipeline-startup-sequence)
10. [Pipeline Shutdown Sequence](#ava710-pipeline-shutdown-sequence)
11. [Normative Requirements Summary](#ava711-normative-requirements-summary)
12. [References](#ava712-references)

---

## AVA.7.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.7.1.1 Terminology

| Term | Definition |
|------|-----------|
| **AppSpec** | `asupersync::app::AppSpec` — top-level application specification containing child actors and restart policy |
| **ChildSpec** | `asupersync::supervision::ChildSpec` — specification for a single supervised child: name, factory, restart config, budget, dependencies |
| **SupervisionStrategy** | Restart behavior: `Restart(RestartConfig)` for automatic restart, `Temporary` for no restart |
| **RestartPolicy** | Top-level policy: `OneForOne` (restart only the failed child) or `OneForAll` (restart all children on any failure) |
| **RestartConfig** | `max_restarts`, `window`, `backoff`, `restart_cost` — bounds on restart frequency |
| **BackoffStrategy** | `Exponential { initial, max, multiplier }` — delay between restart attempts |
| **NameRegistry** | `asupersync::cx::NameRegistry` — global name -> actor mapping for singleton discovery |
| **NameLease** | An obligation token binding a name to an actor; released on actor stop |
| **depends_on** | Startup dependency: a child waits for its dependency to reach `running` before starting |
| **RegistryHandle** | `asupersync::cx::RegistryHandle` — thread-safe wrapper around `NameRegistry` for cross-actor lookups |

---

## AVA.7.2 Tree Topology

The complete supervision tree is defined in `ava-fusion-runtime/src/pipeline.rs`
(451 lines). The top-level `AppSpec` uses `OneForOne` restart policy:

```text
AppSpec("tsingou-fusion") [OneForOne]
│
├── Tier 0: Sensor Children [OneForOne, independent restart]
│   ├── sensor-adsb-feed       [Restart(3/60s)]
│   ├── sensor-ais-feed        [Restart(3/60s)]
│   ├── sensor-sdr-iq-feed     [Restart(3/60s)]
│   └── sensor-osint-feed      [Restart(3/60s)]
│
├── Tier 1: Fusion Children [OneForAll semantics, correlated restart]
│   ├── fusion-tier1-hard-key  [Restart(3/60s)]
│   ├── fusion-tier2-soft-key  [Restart(3/60s)]
│   └── fusion-tier3-derived   [Restart(3/60s), depends_on tier1+tier2]
│
├── Tier 2: Evaluation Children [OneForOne, depends_on fusion tiers]
│   ├── alarm-evaluator        [Restart(3/60s), depends_on all fusion tiers]
│   ├── track-manager          [Restart(3/60s), depends_on tier1]
│   └── absence-detector       [Restart(3/60s), depends_on adsb+ais sensors]
│
└── Tier 3: Singleton Services [Restart(5/120s)]
    └── entity-resolver        [Restart(5/120s), singleton via NameRegistry]
```

The tree is organized into four tiers reflecting the data flow direction from
ingest to evaluation to resolution.

---

## AVA.7.3 PipelineConfig

The top-level configuration struct drives the entire tree construction
(`ava-fusion-runtime/src/pipeline.rs:67-85`):

```rust
pub struct PipelineConfig {
    pub sensors: Vec<SensorConfig>,
    pub fusion_tiers: Vec<FusionTierConfig>,
    pub alarm_evaluator_name: String,
    pub track_manager_name: String,
    pub absence_detector_name: String,
    pub entity_resolver_name: String,
    pub mailbox_capacity: usize,
    pub eval_interval_secs: u64,
}
```

### AVA.7.3.1 Default Configuration

The default configuration (lines 87-143) provides a production-ready baseline:

| Parameter | Default | Rationale |
|-----------|---------|-----------|
| Sensors | 4 sources: ADS-B (4096), AIS (4096), SDR (2048), OSINT (1024) | Buffer sizes reflect expected data rates |
| Fusion Tiers | 3 tiers: hard-key, soft-key, derived | Full multi-tier fusion pipeline |
| Mailbox Capacity | 256 | Balances memory pressure vs. message throughput |
| Eval Interval | 5 seconds | Absence detection granularity |

### AVA.7.3.2 SensorConfig

Each sensor child is defined by (`ava-fusion-runtime/src/pipeline.rs:47-53`):

```rust
pub struct SensorConfig {
    pub source_id: SignalSourceId,
    pub signal_kind: SignalKind,
    pub max_buffer_size: usize,
}
```

The `source_id` determines the child name via `format!("sensor-{}", source_id)`.

---

## AVA.7.4 FusionTierConfig

Fusion tier children are configured via (`ava-fusion-runtime/src/pipeline.rs:56-63`):

```rust
pub struct FusionTierConfig {
    pub name: String,
    pub tier: FusionTier,
    pub join_paths: Vec<JoinPathId>,
    pub join_path_configs: Vec<JoinPathEntryV2>,
}
```

The `join_path_configs` vector drives DataflowWorker construction in the
FusionEngine's `on_start()` handler. An empty vector means no dataflow worker
is created — configs are populated at runtime via KV bucket `ava-config` (see
[AVA.3](rfc-section-nats-subject-taxonomy.md) section 3.6).

### AVA.7.4.1 Tier Definitions

| Tier | Name | FusionTier Enum | Join Paths |
|------|------|----------------|------------|
| 1 | `tier1-hard-key` | `Tier1Kinematic` | `identity-join` |
| 2 | `tier2-soft-key` | `Tier2Attribute` | `spatial-join`, `temporal-join` |
| 3 | `tier3-derived` | `Tier3Behavioral` | `statistical-join` |

---

## AVA.7.5 ChildSpec Factories

Five factory functions in `pipeline.rs` construct typed `ChildSpec` instances.
Each factory captures configuration via closures and uses
`scope.spawn_gen_server()` to materialize the actor within the supervision scope.

### AVA.7.5.1 sensor_child (lines 290-309)

```rust
fn sensor_child(sensor: &SensorConfig, mailbox_cap: usize) -> ChildSpec {
    ChildSpec::new(
        format!("sensor-{}", source_id),
        move |scope, state, cx| {
            let server = SensorIngestor::new(source_id, signal_kind, max_buf);
            let (handle, stored) = scope.spawn_gen_server(state, cx, server, mailbox_cap)?;
            state.store_spawned_task(handle.task_id(), stored);
            Ok(handle.task_id())
        },
    )
    .with_restart(SupervisionStrategy::Restart(standard_restart()))
    .with_shutdown_budget(Budget::MINIMAL)
}
```

### AVA.7.5.2 fusion_child (lines 312-341)

The fusion child factory adds a conditional dependency for Tier 3:

```rust
if tier == FusionTier::Tier3Behavioral {
    child = child
        .depends_on("fusion-tier1-hard-key")
        .depends_on("fusion-tier2-soft-key");
}
```

This ensures Tier 3 only starts after Tier 1 and Tier 2 are running, since
behavioral patterns require lower-tier results as input.

### AVA.7.5.3 alarm_evaluator_child (lines 344-360)

Depends on all three fusion tiers for alarm condition evaluation.

### AVA.7.5.4 track_manager_child (lines 363-379)

Depends on Tier 1 (`fusion-tier1-hard-key`) since tracks are primarily
created from hard-key identity matches.

### AVA.7.5.5 absence_detector_child (lines 390-451)

The most complex factory. When `eval_interval_secs > 0`, it spawns a dedicated
**ticker thread** that sends periodic `EvaluationTick` messages via
`GenServerRef::try_info()` (lines 413-443):

```rust
std::thread::Builder::new()
    .name(ticker_name)
    .spawn(move || {
        let mut tick_id = 0u64;
        loop {
            std::thread::sleep(interval);
            if !server_ref.is_alive() { break; }
            tick_id += 1;
            if server_ref.try_info(AbsenceInfo::EvaluationTick {
                tick_id, current_time_ms: now_ms,
            }).is_err() { break; }
        }
    })
```

The ticker thread exits naturally when:
- `server_ref.is_alive()` returns `false` (actor stopped)
- `server_ref.try_info()` returns `Err` (mailbox full or actor stopped)

When `eval_interval_secs == 0`, no ticker is spawned — the actor relies on
external `EvaluationTick` messages. This is essential for deterministic testing.

### AVA.7.5.6 entity_resolver_child (lines 264-280)

Uses `named_gen_server_start()` to register the actor as a singleton:

```rust
let entity_resolver_child = ChildSpec::new(
    "entity-resolver",
    named_gen_server_start(
        registry,
        resolver_name.clone(),
        mailbox_cap,
        move || EntityResolver::new(resolver_name_for_factory.clone()),
    ),
)
.with_restart(SupervisionStrategy::Restart(singleton_restart()))
.with_registration(NameRegistrationPolicy::Register {
    name: resolver_name,
    collision: NameCollisionPolicy::Fail,
});
```

---

## AVA.7.6 Restart Strategies

Two restart configurations are defined in `pipeline.rs`:

### AVA.7.6.1 Standard Restart (lines 150-163)

Used by all actors except the EntityResolver:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `max_restarts` | 3 | Tolerate transient failures |
| `window` | 60 seconds | Sliding window for restart counting |
| `backoff.initial` | 100ms | Fast first retry |
| `backoff.max` | 10 seconds | Cap exponential growth |
| `backoff.multiplier` | 2.0 | Standard doubling |

### AVA.7.6.2 Singleton Restart (lines 166-179)

Used exclusively by the EntityResolver:

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `max_restarts` | 5 | Higher tolerance for singleton (no redundancy) |
| `window` | 120 seconds | Wider window to accommodate registry re-registration |
| `backoff.initial` | 200ms | Slightly slower to avoid registry contention |
| `backoff.max` | 30 seconds | Longer cap for persistent failures |
| `backoff.multiplier` | 2.0 | Standard doubling |

### AVA.7.6.3 Restart Exhaustion

When `max_restarts` is exceeded within the `window`, the actor is stopped
permanently. For the EntityResolver, this means after 5 crashes in 120 seconds,
the pipeline operates without identity resolution — a degraded but non-fatal mode.
Sensor ingest and fusion continue; only new entity bindings are affected.

---

## AVA.7.7 Dependency Ordering

The `depends_on` mechanism enforces topological startup ordering. A child MUST
NOT start until all its dependencies have reached `running` state.

### AVA.7.7.1 Dependency Graph

```text
sensor-adsb-feed  ──────────────────────────────> absence-detector
sensor-ais-feed   ──────────────────────────────/

fusion-tier1-hard-key ──> fusion-tier3-derived
fusion-tier2-soft-key ──/        |
                                 v
fusion-tier1-hard-key ──> alarm-evaluator
fusion-tier2-soft-key ──/
fusion-tier3-derived ──/

fusion-tier1-hard-key ──> track-manager
```

### AVA.7.7.2 Startup Order

Given the dependency graph, the effective startup order is:

1. **Phase 1** (no dependencies): All sensor children start in parallel
2. **Phase 2** (depends on sensors ready): Fusion Tier 1 and Tier 2 start in parallel
3. **Phase 3** (depends on Tier 1 + Tier 2): Fusion Tier 3, track-manager
4. **Phase 4** (depends on all fusion tiers): alarm-evaluator, absence-detector
5. **Phase 5** (no dependency, but last in child list): entity-resolver

### AVA.7.7.3 OneForAll Semantics for Fusion Tiers

The three fusion tiers share correlated state (entity_tracks, join paths). True
`OneForAll` semantics — where any tier failure restarts all three — require a
nested supervisor. The current flat `AppSpec` documents this intent but enforces
it via dependency ordering: Tier 3 depends on Tier 1 and Tier 2, so if Tier 1
restarts, Tier 3 re-evaluates its startup condition.

**Normative**: A production deployment SHOULD use a nested `SupervisorBuilder`
with `RestartPolicy::OneForAll` for the three fusion tier children to achieve
true correlated restart semantics.

---

## AVA.7.8 Actor Lifecycle

Each actor follows a four-state lifecycle managed by the supervision tree:

```text
init --> running --> stopping --> stopped
```

### AVA.7.8.1 init Phase

The `ChildSpec` factory closure executes:
1. Actor struct construction (e.g., `SensorIngestor::new(...)`)
2. `scope.spawn_gen_server(state, cx, server, mailbox_cap)` materializes the actor
3. `state.store_spawned_task(task_id, stored)` registers with the runtime
4. Returns `Ok(task_id)` to the supervisor

### AVA.7.8.2 running Phase

The `on_start(&mut self, cx: &Cx)` callback fires:
- SensorIngestor logs source_id, signal_kind, max_buffer
- FusionEngine creates the DataflowWorker from join_path_configs
- EntityResolver logs "started (singleton via NameRegistry)"
- AbsenceDetector logs registered expectation count
- AlarmEvaluator logs timeout configuration

After `on_start`, the actor processes messages via `handle_call`, `handle_cast`,
`handle_info` in a cooperative loop bounded by `Budget`.

### AVA.7.8.3 stopping Phase

Triggered by supervisor shutdown or restart decision. The `on_stop(&mut self, cx: &Cx)`
callback fires:
- FusionEngine: requests cooperative cancel on DataflowWorker, sends Shutdown command,
  joins the worker thread (lines 444-453)
- AlarmEvaluator: audits for unresolved alarm obligations, logs at ERROR if any leaked
- All actors: log final statistics (ingested/dropped/transitions/etc.)

All actors use `Budget::MINIMAL` for `on_stop_budget()`, ensuring rapid teardown.

### AVA.7.8.4 stopped Phase

The actor is fully deallocated. If the supervision strategy permits restart,
the factory closure re-executes from the `init` phase. For the EntityResolver,
the `NameLease` obligation is released by the `named_gen_server_start` helper,
freeing the registry name for re-registration.

---

## AVA.7.9 Pipeline Startup Sequence

The `build_pipeline()` function (lines 195-283) constructs the `AppSpec`:

1. Create `AppSpec::new("tsingou-fusion")` with `OneForOne` policy and registry handle
2. Add sensor children via `sensor_child()` for each `SensorConfig`
3. Add fusion children via `fusion_child()` for each `FusionTierConfig`
4. Add evaluation children with `depends_on` constraints
5. Add entity-resolver with `named_gen_server_start` and `NameRegistrationPolicy`

The caller then starts the pipeline:

```rust
let config = PipelineConfig::default();
let app = build_pipeline(config, registry);
app.start(&mut state, &cx, root_region)?;
```

The `AppSpec` resolves the dependency graph and starts children in topological
order, respecting the phases defined in [AVA.7.7.2](#ava772-startup-order).

---

## AVA.7.10 Pipeline Shutdown Sequence

Shutdown proceeds in reverse topological order:

1. **Phase 1**: entity-resolver stops (NameLease released)
2. **Phase 2**: absence-detector, alarm-evaluator, track-manager stop
3. **Phase 3**: fusion-tier3-derived stops
4. **Phase 4**: fusion-tier2-soft-key, fusion-tier1-hard-key stop
5. **Phase 5**: All sensor children stop

Each child's `on_stop` runs within `Budget::MINIMAL`. The FusionEngine's
DataflowWorker thread is joined during shutdown to prevent resource leaks.

**Normative**: Shutdown MUST complete all `on_stop` callbacks before the
runtime exits. The `ObligationLeakOracle` runs after shutdown to detect any
leaked `Reply<T>` tokens or `NameLease` obligations.

---

## AVA.7.11 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.7-R1 | The top-level `AppSpec` MUST use `RestartPolicy::OneForOne` | MUST |
| AVA.7-R2 | Each sensor child MUST be independently restartable (one feed failure MUST NOT affect others) | MUST |
| AVA.7-R3 | Fusion Tier 3 MUST depend_on Tier 1 and Tier 2 (behavioral patterns require lower-tier results) | MUST |
| AVA.7-R4 | The alarm-evaluator MUST depend_on all three fusion tiers | MUST |
| AVA.7-R5 | The EntityResolver MUST use `named_gen_server_start` with `NameCollisionPolicy::Fail` for singleton guarantee | MUST |
| AVA.7-R6 | Standard restart config MUST allow at most 3 restarts in a 60-second window with exponential backoff | MUST |
| AVA.7-R7 | Singleton restart config MUST allow at most 5 restarts in a 120-second window | MUST |
| AVA.7-R8 | All actors MUST use `Budget::MINIMAL` for `on_stop_budget()` to ensure rapid teardown | MUST |
| AVA.7-R9 | The absence-detector ticker thread SHOULD exit when `server_ref.is_alive()` returns false or `try_info()` returns Err | SHOULD |
| AVA.7-R10 | Production deployments SHOULD use a nested supervisor with `OneForAll` for the three fusion tier children | SHOULD |

---

## AVA.7.12 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [AVA.1] [Pipeline Architecture](rfc-section-pipeline-architecture.md)
- [AVA.6] [Actor Model](rfc-section-actor-model.md)
- [AVA.8] [Differential Dataflow Engine](rfc-section-differential-dataflow.md)
- [AVA.14] [Deployment Topology](rfc-section-deployment-topology.md)
- [ava-fusion-runtime pipeline] `ava-fusion-runtime/src/pipeline.rs` — supervision tree wiring (451 lines)
- [ava-fusion-runtime actors] `ava-fusion-runtime/src/actors/mod.rs` — actor re-exports
- [asupersync AppSpec] `asupersync::app::AppSpec` — application specification
- [asupersync ChildSpec] `asupersync::supervision::ChildSpec` — child specification with dependencies
- [asupersync NameRegistry] `asupersync::cx::NameRegistry` — singleton actor registry

---

*End of section AVA.7*


---

# AVA.8 Differential Dataflow Engine

```
Section:       AVA.8 — Differential Dataflow Engine
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          II — Processing (Normative)
Prerequisites: AVA.6 (Actor Model), AVA.7 (Supervision Tree)
Feeds:         AVA.9 (Fusion Tiers & Join Paths), AVA.13 (Output Pipeline)
```

> This section specifies the differential-dataflow integration that provides
> incremental fusion computation. The engine bridges the async actor world
> (GenServer / asupersync) to a synchronous dataflow worker running on a
> dedicated OS thread. The graph is constructed once from `JoinPathEntryV2`
> configurations and receives data dynamically via crossbeam channels. The
> key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
> "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in
> this document are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava81-conventions-and-terminology)
2.  [Architecture Overview](#ava82-architecture-overview)
3.  [Collection Abstraction](#ava83-collection-abstraction)
4.  [Observation Type](#ava84-observation-type)
5.  [Command and Result Protocol](#ava85-command-and-result-protocol)
6.  [Worker Lifecycle](#ava86-worker-lifecycle)
7.  [Worker Step Loop](#ava87-worker-step-loop)
8.  [Channel Bridge Design](#ava88-channel-bridge-design)
9.  [Time Model and Progress Tracking](#ava89-time-model-and-progress-tracking)
10. [Graph Construction](#ava810-graph-construction)
11. [Trace Sharing via Arrangement](#ava811-trace-sharing-via-arrangement)
12. [Late Arrival Policy](#ava812-late-arrival-policy)
13. [Cooperative Cancellation](#ava813-cooperative-cancellation)
14. [Normative Requirements Summary](#ava814-normative-requirements-summary)
15. [References](#ava815-references)

---

## AVA.8.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.8.1.1 Terminology

| Term | Definition |
|------|-----------|
| **Collection** | `Collection<S, D, R>` — the fundamental differential-dataflow abstraction holding `(data, time, diff)` triples |
| **InputSession** | A handle for feeding data into a Collection; NOT Send — must live on the worker thread |
| **Observation** | A keyed, deduplicated record inside the dataflow graph (`ava-fusion-runtime/src/dataflow/mod.rs:79`) |
| **FusionResult** | A delta output from the dataflow graph: `diff = +1` for new match, `diff = -1` for retraction (`mod.rs:101`) |
| **DataflowCommand** | An enum sent from the GenServer to the worker thread (`mod.rs:43`) |
| **ProbeHandle** | A timely dataflow progress tracker that reports when computation for a given time is complete |
| **DataflowWorker** | The lifecycle handle owning command sender, result receiver, and thread join handle (`worker.rs:82`) |
| **Arrangement** | An indexed trace structure produced by `arrange_by_key()`, shareable between multiple join operators |

---

## AVA.8.2 Architecture Overview

The differential dataflow engine bridges two execution domains via crossbeam
channels. The async GenServer world runs on the tokio/asupersync runtime; the
synchronous dataflow worker runs on a dedicated OS thread.

```
GenServer (async)              DataflowWorker (sync OS thread)
  cmd_tx ───────────────────►  cmd_rx → InputSession::insert/remove
  result_rx ◄─────────────── result_tx ← inspect() callback
```

Source: `ava-fusion-runtime/src/dataflow/mod.rs:8-14`

The GenServer sends `DataflowCommand` messages via a bounded crossbeam channel.
The worker thread processes commands, drives computation via `worker.step()`,
and emits `FusionResult` deltas via an unbounded result channel. The dataflow
graph is constructed ONCE from `Vec<JoinPathEntryV2>` at worker startup and
MUST NOT be modified after construction.

---

## AVA.8.3 Collection Abstraction

The differential-dataflow `Collection<S, D, R>` is parameterized by:

- `S: Scope` — the timely dataflow scope (timestamp type `u64`)
- `D: Ord + Clone + 'static` — the data type (MUST implement total ordering)
- `R: Semigroup` — the diff type (`isize` for insert/remove tracking)

Every record is represented as a `(data, time, diff)` triple where `diff = +1`
denotes insertion and `diff = -1` denotes retraction. The `consolidate()`
operator merges identical `(data, time)` pairs by summing their diffs,
eliminating no-ops where an insertion and retraction cancel.

Source: [McSherry 2013], verified via `docs/research/differential-dataflow-fusion-integration.md:14-18`

All operators — `join`, `reduce`, `map`, `flat_map`, `filter`, `iterate`,
`threshold` — are automatically incremental. When a single record changes,
only affected join matches, reduce groups, and downstream operators are
recomputed.

---

## AVA.8.4 Observation Type

The `Observation` struct is the element type (`D`) for all Collections inside
the dataflow graph.

```rust
// ava-fusion-runtime/src/dataflow/mod.rs:79-91
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Hash,
         serde::Serialize, serde::Deserialize)]
pub struct Observation {
    pub key: String,
    pub source_id: String,
    pub payload_hash: u64,
    pub lat_microdeg: Option<i64>,
    pub lon_microdeg: Option<i64>,
}
```

**Design decisions**:

1. `Ord` is REQUIRED by `Collection<S, D, R>` where `D: Ord`. Coordinates
   are stored as micro-degrees (`i64`, precision ~0.11 m) instead of `f64`
   because `f64` does not implement `Ord` (`mod.rs:76-78`).

2. Full payloads are too large for Collection storage. The `payload_hash`
   field (computed via `DefaultHasher`) provides deduplication and serves
   as a proxy for derived computations (temporal bucketing, anomaly
   statistics) (`mod.rs:74-75`).

3. The `source_id` field tracks provenance — which signal source produced
   this observation. Multiple sources of the same `SignalKind` share one
   InputSession; `source_id` distinguishes them within the Collection.

---

## AVA.8.5 Command and Result Protocol

### AVA.8.5.1 DataflowCommand (GenServer → Worker)

```rust
// ava-fusion-runtime/src/dataflow/mod.rs:43-65
pub enum DataflowCommand {
    Insert {
        source_id: String,
        key: String,
        value: Vec<u8>,
        timestamp_ms: f64,
        lat_deg: Option<f64>,
        lon_deg: Option<f64>,
    },
    Remove { source_id: String, key: String, value: Vec<u8> },
    AdvanceTime(u64),
    Shutdown,
}
```

- **Insert**: Creates an `Observation` (hashing `value`, converting
  `lat_deg`/`lon_deg` to micro-degrees) and inserts into the appropriate
  InputSession. The `source_id` is resolved to a `SignalKind` key via the
  routing table (`worker.rs:35-52`).

- **Remove**: Retracts a previously inserted observation. The same
  `Observation` struct MUST be reconstructed from the same inputs to ensure
  the diff cancellation works correctly.

- **AdvanceTime(n)**: Advances all InputSessions to epoch `n`, flushes
  buffers, and steps the worker until the probe confirms all computation
  for times `< n` is complete (`worker.rs:296-307`).

- **Shutdown**: Terminates the worker loop and exits the timely closure.

### AVA.8.5.2 FusionResult (Worker → GenServer)

```rust
// ava-fusion-runtime/src/dataflow/mod.rs:101-117
pub struct FusionResult {
    pub join_path_id: String,
    pub left_key: String,
    pub right_key: String,
    pub confidence: f64,
    pub output_type: OutputType,
    pub time: u64,
    pub diff: i64,  // +1 = new match, -1 = retracted match
}
```

Results are emitted by `inspect()` callbacks attached to each join path's
terminal operator. Each result is a delta: `diff = +1` for a new match,
`diff = -1` for a retracted match. Downstream consumers MUST handle
retractions to maintain accurate state.

---

## AVA.8.6 Worker Lifecycle

The `DataflowWorker` struct manages the lifecycle of the OS thread:

```rust
// ava-fusion-runtime/src/dataflow/worker.rs:82-88
pub struct DataflowWorker {
    cmd_tx: Sender<DataflowCommand>,
    result_rx: Receiver<FusionResult>,
    thread: Option<thread::JoinHandle<()>>,
    cancel_flag: Arc<AtomicBool>,
}
```

**Construction** (`DataflowWorker::new`, `worker.rs:96-117`):

1. Creates a bounded command channel (capacity 4096).
2. Creates an unbounded result channel.
3. Initializes a shared `AtomicBool` cancel flag.
4. Spawns a dedicated OS thread via `std::thread::spawn`.

The worker uses `std::thread::spawn` rather than `spawn_blocking` because
the timely worker runs an indefinite event loop. `spawn_blocking` is
designed for bounded blocking work; its Future would never resolve until
shutdown (`worker.rs:102-106`).

**Shutdown** (`worker.rs:183-191`):

1. Sends `DataflowCommand::Shutdown` via the command channel.
2. Calls `handle.join()` to wait for the thread to exit.
3. The `Drop` implementation calls `shutdown()` as a safety net.

---

## AVA.8.7 Worker Step Loop

The core worker function `run_worker` (`worker.rs:211-331`) executes inside
`timely::execute_directly`, which runs a single-worker dataflow on the
current thread.

```
loop {
    1. Check cancel_flag (cooperative shutdown)
    2. try_recv() all pending commands
       - Insert → resolve_source() → input.insert((key, obs))
       - Remove → resolve_source() → input.remove((key, obs))
       - AdvanceTime → advance all inputs, flush, step until probe catches up
       - Shutdown → return
    3. worker.step() — drive any pending computation
    4. thread::yield_now() — avoid busy spinning
}
```

Source: `worker.rs:230-331`

**Source routing** (`worker.rs:35-71`): A `HashMap<String, String>` maps
source ID strings to their `SignalKind` graph key. Built at startup from
the join path configurations. Supports exact match, case-insensitive match,
and partial substring match for flexibility.

**Command processing** is non-blocking (`try_recv`). All pending commands
are drained in a tight inner loop before stepping the worker. This batches
multiple insertions before a single `step()`, improving throughput.

---

## AVA.8.8 Channel Bridge Design

### AVA.8.8.1 Command Channel

**Type**: `crossbeam_channel::bounded::<DataflowCommand>(4096)`

Bounded to prevent unbounded memory growth from fast producers. If the buffer
is full, `send()` blocks the GenServer's handler, providing natural
backpressure. The capacity of 4096 accommodates approximately one window's
worth of sensor readings (`worker.rs:97`).

### AVA.8.8.2 Result Channel

**Type**: `crossbeam_channel::unbounded::<FusionResult>()`

Unbounded because results MUST NOT be lost. The GenServer drains results
on each window flush cycle. The `drain_results()` method is non-blocking;
`drain_results_timeout()` spins with short sleeps until results arrive or
a timeout expires, then collects stragglers during a 50 ms settling period
(`worker.rs:132-177`).

---

## AVA.8.9 Time Model and Progress Tracking

The dataflow uses **monotonic epoch windows** — NOT wall-clock time:

```
Window 0: observations with timestamp_ms in [0, 60000)
Window 1: observations with timestamp_ms in [60000, 120000)
...
```

The window index for an observation is computed as:
`obs_window = (timestamp_ms as u64) / 60000` (`worker.rs:250`)

**AdvanceTime(n)** tells the dataflow that no more data will arrive for
windows `< n`. The worker advances all InputSessions to `n`, flushes their
buffers, then steps until `probe.less_than(&current_time)` returns `false`
— confirming all computation for times `< n` is complete (`worker.rs:296-307`).

**ProbeHandle** (`graph.rs:60`): Attached to the terminal operator of each
join path via `.probe_with(&mut probe)`. The single shared probe tracks
progress across all join paths simultaneously.

---

## AVA.8.10 Graph Construction

The `build_dataflow_graph` function (`graph.rs:147-793`) constructs the
entire dataflow graph in two phases:

**Phase 1 — InputSession creation** (`graph.rs:166-182`):

1. Collect all unique `SignalKind` values from enabled join paths.
2. For each kind, create one `InputSession` and convert it to a `Collection`.
3. Multiple join paths reading from the same signal kind SHARE the same
   InputSession. InputSessions are keyed by `SignalKind`, not by source ID.

**Phase 2 — Join path wiring** (`graph.rs:212-790`):

For each enabled `JoinPathEntryV2`, the graph wires the appropriate pipeline
based on `join_type` and `tier`:

| JoinType | Pipeline | Source |
|----------|----------|--------|
| Identity | `left.join(&right)` → `inspect` | `graph.rs:235-279` |
| Spatial/Temporal/Spectral | `flat_map` (blocking) → `join` → `consolidate` → `inspect` | `graph.rs:293-343` |
| Semantic/Behavioral/Statistical | Per-method pipeline (see [AVA.9]) | `graph.rs:351-788` |

The graph is constructed ONCE and MUST NOT be modified after startup. Data
flows dynamically through `InputSession::insert/remove`.

**DataflowHandles** returned to the worker loop:

```rust
// ava-fusion-runtime/src/dataflow/graph.rs:56-61
pub struct DataflowHandles {
    pub inputs: HashMap<String, InputSession<u64, (String, Observation), isize>>,
    pub probe: ProbeHandle<u64>,
}
```

---

## AVA.8.11 Trace Sharing via Arrangement

When a `Collection` is referenced by two or more join paths, it is
pre-arranged via `arrange_by_key()` during Phase 1.5 of graph construction
(`graph.rs:184-209`).

**Algorithm**:

1. Count references per `SignalKind` across all enabled join paths.
2. Collections with `ref_count >= 2` are arranged once.
3. Join paths use `join_core()` on the shared `Arranged` traces instead of
   `join()` which would independently re-arrange the data.

```rust
// graph.rs:240-258 — Tier 1 Identity with shared arrangement
left_arr.join_core(right_arr, |key, left_obs, right_obs| {
    Some((key.clone(), (left_obs.clone(), right_obs.clone())))
})
```

The `TraceAgent` internal reference counting ensures the indexing cost is
paid once. For a signal kind referenced by N join paths, this saves N-1
redundant arrangement operations.

Collections referenced by only one join path fall back to regular `.join()`
which arranges internally (`graph.rs:260-278`).

---

## AVA.8.12 Late Arrival Policy

Observations whose computed window index falls behind the current time
frontier are considered late arrivals.

**Detection** (`worker.rs:249-260`):

```rust
let obs_window = (timestamp_ms as u64) / 60000;
if current_time > 0 && obs_window < current_time {
    late_arrivals_dropped += 1;
    continue;
}
```

Late arrivals are dropped and counted. The counter is logged at shutdown
for operational visibility. The `late_arrival_policy` field on
`JoinPathEntryV2` (`join_path.rs:235`) supports future policy variants
(reprocess, side-channel) but the current implementation enforces drop-only.

---

## AVA.8.13 Cooperative Cancellation

The worker thread supports cooperative cancellation via an `AtomicBool` flag
shared between the `DataflowWorker` handle and the worker thread.

**Mechanism** (`worker.rs:87,99-100,120-122`):

1. `DataflowWorker::request_cancel()` sets the flag via `Ordering::Release`.
2. The worker loop checks the flag at the top of each iteration via
   `Ordering::Acquire` (`worker.rs:232-235`).
3. On detection, the worker logs and returns immediately.

This provides a belt-and-suspenders approach alongside the `Shutdown` command:
the cancel flag works even if the command channel is full or disconnected.

---

## AVA.8.14 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.8-R1 | The dataflow graph MUST be constructed once from `Vec<JoinPathEntryV2>` and MUST NOT be modified after startup | MUST |
| AVA.8-R2 | InputSessions MUST be keyed by `SignalKind`, not by source ID; multiple sources of the same kind MUST share one InputSession | MUST |
| AVA.8-R3 | All types used as `D` in `Collection<S, D, R>` MUST implement `Ord + Clone + 'static` | MUST |
| AVA.8-R4 | The worker MUST run on a dedicated OS thread via `std::thread::spawn`, NOT via `spawn_blocking` | MUST |
| AVA.8-R5 | The command channel MUST be bounded; the result channel SHOULD be unbounded | MUST/SHOULD |
| AVA.8-R6 | `AdvanceTime(n)` MUST advance all InputSessions, flush, and step until the probe confirms completion for times `< n` | MUST |
| AVA.8-R7 | FusionResult consumers MUST handle retraction deltas (`diff = -1`) to maintain accurate state | MUST |
| AVA.8-R8 | Collections referenced by 2+ join paths SHOULD be pre-arranged via `arrange_by_key()` for trace sharing | SHOULD |
| AVA.8-R9 | Late arrivals (observations with window index below the current time frontier) MUST be dropped and counted | MUST |
| AVA.8-R10 | The worker MUST support cooperative cancellation via `AtomicBool` in addition to the `Shutdown` command | MUST |

---

## AVA.8.15 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [McSherry 2013] McSherry, F., "Differential Dataflow", CIDR 2013.
- [Ngo et al. 2014] Ngo, H.Q., Porat, E., Re, C., & Rudra, A., "Worst-Case Optimal Join Algorithms", PODS 2014.
- [differential-dataflow] `TimelyDataflow/differential-dataflow` v0.18.0 — `Collection<S,D,R>`, `InputSession`, `arrange_by_key`, `join_core`
- [timely] `TimelyDataflow/timely-dataflow` v0.25 — `execute_directly`, `ProbeHandle`, `worker.step()`
- [crossbeam-channel] `crossbeam-rs/crossbeam` — bounded/unbounded MPMC channels
- [ava-fusion-runtime dataflow module] `ava-fusion-runtime/src/dataflow/` — `mod.rs`, `worker.rs`, `graph.rs`, `blocking.rs`, `scoring.rs`
- [ava-fusion JoinPathEntryV2] `ava-fusion/src/join_path.rs` — Join path ontology types
- [Research Compendium] `docs/research/differential-dataflow-fusion-integration.md` — Theoretical grounding and operator mapping

---

*End of section AVA.8*


---

# AVA.9 Fusion Tiers & Join Paths

```
Section:       AVA.9 — Fusion Tiers & Join Paths
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          II — Processing (Normative)
Prerequisites: AVA.2 (Signal Schema), AVA.8 (Differential Dataflow Engine)
Feeds:         AVA.10 (Evidence Theory), AVA.13 (Output Pipeline)
```

> This section specifies the three fusion tiers, seven join types, the
> `JoinPathEntryV2` ontology, blocking strategies, confidence scoring
> models, Tier 3 statistical methods, graph analytics, and CEP sequence
> patterns. Every join path is a declarative configuration entry that
> compiles to a differential-dataflow operator pipeline as specified in
> [AVA.8](rfc-section-dd-engine.md). The key words "MUST", "MUST NOT",
> "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED",
> "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
> interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava91-conventions-and-terminology)
2.  [Fusion Tier Classification](#ava92-fusion-tier-classification)
3.  [JoinPathEntryV2 Ontology](#ava93-joinpathentryv2-ontology)
4.  [Seven Join Types](#ava94-seven-join-types)
5.  [Tier 1: Hard-Key Identity Joins](#ava95-tier-1-hard-key-identity-joins)
6.  [Tier 2: Soft-Key Blocking & Correlation](#ava96-tier-2-soft-key-blocking--correlation)
7.  [Tier 3: Derived-Key Statistical Methods](#ava97-tier-3-derived-key-statistical-methods)
8.  [Confidence Scoring Models](#ava98-confidence-scoring-models)
9.  [Graph Analytics](#ava99-graph-analytics)
10. [CEP Sequence Patterns](#ava910-cep-sequence-patterns)
11. [Normative Requirements Summary](#ava911-normative-requirements-summary)
12. [References](#ava912-references)

---

## AVA.9.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.9.1.1 Terminology

| Term | Definition |
|------|-----------|
| **FusionTier** | One of three confidence classifications: Tier 1 (hard key), Tier 2 (soft key), Tier 3 (derived key) (`join_path.rs:53-60`) |
| **JoinType** | One of seven predicate dimensions: Identity, Spatial, Temporal, Spectral, Semantic, Behavioral, Statistical (`join_path.rs:24-39`) |
| **JoinPathEntryV2** | A declarative join path configuration with R1-R8 extension fields (`join_path.rs:209-245`) |
| **Blocking** | Candidate space partitioning that reduces Event x Event cartesian products by 1000-7000x (`blocking.rs:1-8`) |
| **Tier3Method** | One of four statistical correlation methods: Periodicity, CoOccurrence, Community, AnomalyCoincidence (`tier3.rs:25-30`) |
| **OutputType** | Fusion result classification: FusedTrack, CorrelatedPair, AbsenceEvent, SequenceMatch, Enrichment, Flag (`join_path.rs:73-86`) |
| **SequencePattern** | A temporal CEP pattern definition with ordered steps, contiguity rules, and cross-step predicates (`sequence.rs:130-146`) |

---

## AVA.9.2 Fusion Tier Classification

Three tiers classify fusion correlations by confidence semantics and
computational cost:

```rust
// ava-fusion/src/join_path.rs:53-60
pub enum FusionTier {
    Tier1Kinematic,   // Hard keys — shared identifier, C ~ 0.99
    Tier2Attribute,   // Soft keys — proximity predicates, C < 0.99
    Tier3Behavioral,  // Derived keys — statistical patterns, C = variable
}
```

| Tier | Key Type | Confidence | Computational Model | dd Pipeline |
|------|----------|------------|---------------------|-------------|
| **Tier 1** | Deterministic identity (ICAO, MMSI, IP) | ~0.99 fixed | Equijoin on extracted identifier | `join` or `join_core` |
| **Tier 2** | Probabilistic proximity (spatial, temporal, spectral) | 0.0 – 0.99 | Blocking → join → scoring | `flat_map` → `join` → `consolidate` → `inspect` |
| **Tier 3** | Emergent statistical pattern | Variable | Per-method: reduce, iterate, filter | Method-specific (see [AVA.9.7](#ava97-tier-3-derived-key-statistical-methods)) |

Source: `join_path.rs:45-60`

---

## AVA.9.3 JoinPathEntryV2 Ontology

Each join path is a declarative entry telling the dataflow engine which
Collection pair to join, what predicates to evaluate, and how to score
the result.

```rust
// ava-fusion/src/join_path.rs:209-245
pub struct JoinPathEntryV2 {
    pub id: String,
    pub left: JoinPathSide,
    pub right: JoinPathSide,
    pub join_type: JoinType,
    pub tier: FusionTier,
    pub output: OutputType,
    pub enabled: EnabledState,
    pub resolver: Option<String>,
    pub blocking: Option<PairBlocking>,
    pub temporal_window_ms: Option<u64>,
    pub late_arrival_policy: Option<String>,
    pub confidence_model: Option<String>,
    pub tier3_method: Option<String>,
    pub join_mode: Option<JoinMode>,
}
```

### AVA.9.3.1 JoinPathSide

Each side of a join path specifies its signal kind, key extraction path,
and data type:

```rust
// join_path.rs:156-164
pub struct JoinPathSide {
    pub signal_kind: SignalKind,
    pub key_path: String,
    pub data_type: DataType,
}
```

The `data_type` distinguishes event streams (`DataType::Event`) from
reference tables (`DataType::Reference`), enabling `JoinMode::EventTable`
for enrichment lookups (`join_path.rs:112-117`).

### AVA.9.3.2 PairBlocking

Per-dimension blocking flags control which axes are used for candidate
partitioning:

```rust
// join_path.rs:143-147
pub struct PairBlocking {
    pub spatial: bool,
    pub temporal: bool,
    pub spectral: bool,
}
```

### AVA.9.3.3 OutputType

Six output classifications determine how downstream consumers render
and route fusion results:

| Variant | Meaning | Typical Tier |
|---------|---------|--------------|
| `FusedTrack` | Two signals describe the same entity (identity merge) | Tier 1 |
| `CorrelatedPair` | Two signals are related but describe distinct entities | Tier 2, 3 |
| `AbsenceEvent` | Expected signal missing — negative-space detection | Tier 2 |
| `SequenceMatch` | Ordered temporal pattern matched | Tier 3 |
| `Enrichment` | One signal enriches another with context | Tier 1 |
| `Flag` | Identifier discrepancy flagged | Tier 1 |

Source: `join_path.rs:73-86`

---

## AVA.9.4 Seven Join Types

```rust
// ava-fusion/src/join_path.rs:24-39
pub enum JoinType {
    Identity,     // Shared identifier (ICAO hex, MMSI, IP, domain, STIX ID)
    Spatial,      // Geographic proximity (haversine distance)
    Temporal,     // Temporal proximity (time window overlap)
    Spectral,     // RF spectral proximity (frequency band matching)
    Semantic,     // Named entity / IOC overlap (Jaccard coefficient)
    Behavioral,   // Velocity/maneuver pattern similarity (DTW, cosine)
    Statistical,  // Tier 3 statistical correlation
}
```

Each join type maps to a specific differential-dataflow pipeline pattern
as specified in [AVA.8](rfc-section-dd-engine.md) and detailed in the
tier-specific sections below.

---

## AVA.9.5 Tier 1: Hard-Key Identity Joins

### AVA.9.5.1 Algorithm

Direct equijoin on extracted identifier key. Confidence is fixed at 0.99
(identity match). The join key IS the identity — no blocking required.

### AVA.9.5.2 dd Pipeline

```rust
// ava-fusion-runtime/src/dataflow/graph.rs:235-279
// With shared arrangement (ref_count >= 2):
left_arr.join_core(right_arr, |key, left_obs, right_obs| {
    Some((key.clone(), (left_obs.clone(), right_obs.clone())))
})
.inspect(move |&(_, time, diff)| {
    let result = FusionResult {
        confidence: 0.99,
        diff: diff as i64,
        // ...
    };
    let _ = tx.send(result);
})
.probe_with(&mut probe);

// Without shared arrangement (ref_count == 1):
left_collection.join(&right_collection)
    .inspect(/* same pattern */)
    .probe_with(&mut probe);
```

### AVA.9.5.3 Incrementality

O(1) per new observation matching an existing key. Only new matches
involving the delta record are produced.

---

## AVA.9.6 Tier 2: Soft-Key Blocking & Correlation

### AVA.9.6.1 Three-Dimensional Blocking

Blocking partitions the candidate space before evaluating predicates,
reducing Event x Event cartesian products by 1000-7000x in typical
deployments (`ava-fusion/src/blocking.rs:1-8`).

| Dimension | Config Type | Key Generation | dd Operator |
|-----------|------------|----------------|-------------|
| **Spatial** | `SpatialBlockConfig { h3_resolution, k_ring }` | H3 cell index + k-ring neighbors | `flat_map` (1:N) |
| **Temporal** | `TemporalBlockConfig { window_seconds }` | `timestamp / (window_seconds * 1000)` | `map` (1:1) |
| **Spectral** | `SpectralBlockConfig { band_width_mhz }` | `floor(freq_mhz / band_width_mhz)` | `map` (1:1) |
| **Composite** | Cross-product of active dimensions | `"h3_key:t_key:f_key"` | `flat_map` (N from spatial) |

Source: `ava-fusion-runtime/src/dataflow/blocking.rs:196-233`

### AVA.9.6.2 H3 Spatial Blocking

The spatial blocking function uses the `h3o` crate for real geospatial
indexing when WGS84 coordinates are present on the Observation. Falls back
to deterministic hash-based bucketing for observations without spatial
metadata (`blocking.rs:116-144`).

```rust
// blocking.rs:51-65 — H3 cell + k-ring expansion
pub fn spatial_keys_from_coords(
    lat_deg: f64, lon_deg: f64,
    resolution: u8, k_ring: u32,
) -> Vec<String> {
    let cell = lat_lon_to_cell(lat_deg, lon_deg, resolution)?;
    h3_grid_disk(cell, k_ring)
        .into_iter()
        .map(|c| c.to_string())
        .collect()
}
```

Resolution 8 produces cells of approximately 4.6 km edge length.
`k_ring = 1` expands to the base cell plus 6 immediate neighbors (7 cells
total), ensuring boundary-crossing entities land in overlapping blocks
(`blocking.rs:47-48`).

### AVA.9.6.3 Composite Key Cross-Product

When multiple blocking dimensions are enabled on a join path, the
`extract_composite_key` function produces the cross-product of all
dimension keys:

```rust
// blocking.rs:212-233
pub fn extract_composite_key(obs: &Observation, config: &CompositeKeyConfig)
    -> Vec<String>
{
    // spatial_keys: N, temporal_key: 1, spectral_key: 1
    // cross-product: "h3_cell:t_bucket:f_band"
    spatial_keys.into_iter()
        .map(|sk| format!("{}:{}:{}", sk, temporal_key, spectral_key))
        .collect()
}
```

### AVA.9.6.4 Tier 2 dd Pipeline

```rust
// graph.rs:293-343
// Step 1: flat_map each collection to (block_key, Observation)
let left_blocked = left_collection.flat_map(move |(_key, obs)| {
    extract_composite_key(&obs, &config)
        .into_iter()
        .map(move |bk| (bk, obs.clone()))
        .collect::<Vec<_>>()
});

// Step 2: Join on block keys
// Step 3: Consolidate (merge cancelling diffs from flat_map expansion)
let joined = left_blocked.join(&right_blocked).consolidate();

// Step 4: Score and emit
joined.inspect(move |&((_, (ref l, ref r)), time, diff)| {
    let base = tier2_base_score(l, r);
    let confidence = compute_confidence(&model, &[(base, 1.0)]);
    // ... emit FusionResult
});
```

The `consolidate()` after `join` is REQUIRED to merge cancelling diffs
produced by the k-ring expansion — when observations are retracted, the
N block keys each produce a -1 diff that must be consolidated.

### AVA.9.6.5 Confidence Scoring

Tier 2 confidence is computed by a pluggable scoring model selected via
the `confidence_model` field on `JoinPathEntryV2`:

```rust
// graph.rs:72-78
fn compute_confidence(model: &Option<String>, pairs: &[(f64, f64)]) -> f64 {
    match model.as_deref() {
        Some("logOdds") => score_log_odds(pairs),
        Some("dempsterShafer") => score_dempster_shafer(pairs, "standard"),
        _ => score_weighted_average(pairs),
    }
}
```

See [AVA.9.8](#ava98-confidence-scoring-models) for details on each model.

---

## AVA.9.7 Tier 3: Derived-Key Statistical Methods

Four specific methods replace the original TSGC-001 wildcard placeholder.
Each is independently toggleable via the `tier3_method` field on
`JoinPathEntryV2` (`tier3.rs:1-7`).

```rust
// ava-fusion/src/tier3.rs:25-30
pub enum Tier3Method {
    Periodicity,         // 3A: Matching periodic cadence (C2 beaconing)
    CoOccurrence,        // 3B: Entities appearing together across sources
    Community,           // 3C: Graph community detection
    AnomalyCoincidence,  // 3D: Independent anomalies in overlapping windows
}
```

### AVA.9.7.1 Tier 3A: Periodicity Detection

**Config**: `PeriodicityConfig { min_period_ms, max_period_ms, significance_threshold }` (`tier3.rs:43-57`)

**dd Pipeline** (`graph.rs:361-453`):

1. **reduce** per entity: Compute payload_hash variance as a proxy for
   inter-arrival regularity. Low variance implies high periodicity.
2. **Map** to periodicity bucket: `period_score = 1.0 / (1.0 + sqrt(variance / 1e12))`,
   discretized to `bucket = (period_score * 10.0) as u32`.
3. **Re-key** reduce output from `(entity, (bucket, key))` to `(bucket, (entity, key))`.
4. **Join** left and right on periodicity bucket.
5. **Inspect**: Emit `FusionResult` with confidence 0.55 (periodicity match).

**Production path**: The `ava-fusion-runtime/src/signal/periodicity.rs` module
provides FFT-based (`realfft`) and Lomb-Scargle periodogram computation with
prominence-based peak detection (`find_peaks`) for real signal data
(`periodicity.rs:91-156`, `periodicity.rs:171-268`). Cross-spectral similarity
uses cosine similarity of power spectra (`periodicity.rs:342-363`).

### AVA.9.7.2 Tier 3B: Co-Occurrence Mining

**Config**: `CoOccurrenceConfig { window_ms, min_support, min_confidence }` (`tier3.rs:70-84`)

**dd Pipeline** (`graph.rs:462-523`):

1. **Map** each collection to temporal buckets: `bucket = payload_hash / (300 * 1000)` (5-minute windows).
2. **Join** on temporal bucket to find co-occurring pairs.
3. **Re-key** by entity pair: `format!("{}|{}", left_key, right_key)` with canonical ordering.
4. **Reduce** to count co-occurrences per entity pair.
5. **Inspect**: Confidence from count: `C = min(1 - 1/(1 + count * 0.1), 0.95)`.

### AVA.9.7.3 Tier 3C: Community Detection

**Config**: `CommunityConfig { algorithm, resolution, min_community_size }` (`tier3.rs:121-135`)

**Algorithms**: Louvain (default), LabelPropagation, Infomap (`tier3.rs:98-108`)

**dd Pipeline** (`graph.rs:531-617`):

1. **Build edge collection** from equijoin (uses `join_core` with shared arrangements when available).
2. **Initialize labels**: Each node labeled with itself via `flat_map`.
3. **Iterate** (label propagation):
   a. Propagate labels along edges via `join`.
   b. Combine with existing labels via `concat`.
   c. **Reduce**: Pick minimum label per node (input sorted by String ord).
   d. **Consolidate** inside the iterate loop — REQUIRED to prevent infinite
      diff circulation and ensure convergence (`graph.rs:567-577`).
4. **Re-key** by label, reduce to collect community members.
5. **Emit pairs**: For nodes `i < j` within the same community, emit
   `FusionResult` with confidence 0.6.

**Standalone Louvain** (`ava-fusion-runtime/src/graph/louvain.rs:43-174`):

Single-level Louvain community detection via greedy modularity optimization.
Each node starts as its own community; for each node, evaluate modularity
gain from moving to each neighbor's community using the canonical formula:

```
DeltaQ = k_{i,in}/m - Sigma_tot * k_i / (2m^2)
```

Source: Blondel et al. (2008). Achieves 85-92% of full multi-level quality
(`louvain.rs:7-8`). Converges within a configurable maximum number of passes
(`louvain.rs:48`).

### AVA.9.7.4 Tier 3D: Anomaly Coincidence

**Config**: `AnomalyCoincidenceConfig { baseline_window_ms, sigma_threshold }` (`tier3.rs:148-160`)

**dd Pipeline** (`graph.rs:626-731`):

1. **Re-key** by entity key for per-entity reduction.
2. **Reduce**: Compute running statistics (mean, variance, std_dev) from
   payload_hash values. Flag observations with z-score >= 3.0 as anomalies.
3. **Re-key** anomalies by time bucket: `bucket = payload_hash / 60000`.
4. **Join** left and right anomalies on time bucket for coincidence detection.
5. **Inspect**: Emit `FusionResult` with confidence 0.45 (anomaly coincidence base).

### AVA.9.7.5 Tier 3 Fallback

Unrecognized `tier3_method` values and `JoinType::Semantic` fall through to
a simple scored join using the same pipeline as Tier 1 but with confidence
computed via the pluggable scoring model rather than fixed at 0.99
(`graph.rs:739-786`).

### AVA.9.7.6 Tier 3 Promotion

Tier 3 findings MAY be promoted to a higher tier via `Tier3Promotion`:

```rust
// tier3.rs:188-194
pub struct Tier3Promotion {
    pub source_tier: u8,    // Always 3
    pub target_tier: u8,    // Usually 2
    pub confidence_boost: f64,
}
```

---

## AVA.9.8 Confidence Scoring Models

Three combination strategies are implemented in
`ava-fusion-runtime/src/dataflow/scoring.rs`:

### AVA.9.8.1 Weighted Average (Default)

```
C = sum(w_i * s_i) / sum(w_i)
```

Returns 0.0 if weights sum to zero. Clamped to [0.0, 1.0].
Source: `scoring.rs:16-28`

### AVA.9.8.2 Log-Odds

```
C = 1 / (1 + exp(-sum(log(p/(1-p)) * w_i)))
```

Scores clamped to [0.01, 0.99] to avoid infinite log-odds. Better
mathematical properties for extreme values than weighted average.
Source: `scoring.rs:35-47`

### AVA.9.8.3 Dempster-Shafer Evidence Theory

Simplified two-hypothesis model: H (target) and not-H. Three combination
rule variants:

| Rule | Conflict Handling | Source |
|------|-------------------|--------|
| **Standard (Dempster)** | Normalize: `m_12(A) = agree(A) / (1 - K)` | `scoring.rs:86-93` |
| **Yager** | Transfer conflict to ignorance: `m(Theta) += K` | `scoring.rs:95-98` |
| **TBM (Smets)** | Allow empty-set mass (unnormalized) | `scoring.rs:99-104` |

Where `K = sum(m1(B) * m2(C))` for `B intersection C = empty set`.

**Entropy-weighted variant** (Khan & Anwar, Sensors 2019): Sources with high
uncertainty get lower weight via `w = 1 / (1 + H(m))` where `H` is binary
entropy. Returns `(combined_belief, conflict_measure)` and signals NaN when
conflict exceeds a configurable threshold (`scoring.rs:138-240`).

### AVA.9.8.4 Correlation Discount

The `apply_correlation_discount` function prevents double-counting correlated
predicates using a 5x5 correlation matrix (spatial, temporal, spectral,
behavioral, semantic):

```rust
// scoring.rs:256-289
effective_weight[i] *= 1.0 - (correlation[i][j] * weight_j / total_weight)
```

### AVA.9.8.5 Advanced Evidence Functions

| Function | Purpose | Source |
|----------|---------|--------|
| `pcr5_combine` | PCR5 proportional conflict redistribution (NOT associative for n>2) | `scoring.rs:331-375` |
| `murphy_average_bpa` | Average n BPAs for PCR5 n>2 combination | `scoring.rs:388-409` |
| `jousselme_distance` | True metric distance between BPAs (triangle inequality) | `scoring.rs:423-472` |
| `epsilon_prune_bpa` | Remove focal elements below threshold, redistribute mass | `scoring.rs:480-492` |
| `kahan_sum` | Compensated summation for O(1) rounding error in reduce closures | `scoring.rs:302-312` |

---

## AVA.9.9 Graph Analytics

The `ava-fusion-runtime/src/graph/` module provides three graph analytics
algorithms operating on the `UndirectedGraph` representation:

### AVA.9.9.1 Triangle Counting

Triangles indicate strong mutual association — three entities that are all
pairwise correlated form a clique (`triangle.rs:1-8`).

- **Algorithm**: Edge-iterator with set intersection. O(|E|^{3/2}).
- **`count_triangles`**: Total triangle count (`triangle.rs:108-154`).
- **`triangles_per_node`**: Per-node triangle count (`triangle.rs:159-198`).
- **`clustering_coefficient`**: `CC(v) = 2T(v) / (deg(v) * (deg(v) - 1))` (`triangle.rs:204-228`).
- **`average_clustering_coefficient`**: Graph-wide average CC (`triangle.rs:231-238`).

### AVA.9.9.2 PageRank & Personalized PageRank

Computes importance scores via power iteration with damping factor alpha
(`pagerank.rs:1-10`).

```
rank[v] = (1-alpha)/N + alpha * sum_{u->v} rank[u] / outdeg(u)
```

- **`pagerank`**: Uniform teleportation, default alpha=0.85, epsilon=1e-6 (`pagerank.rs:63-128`).
- **`personalized_pagerank`**: Teleport only to seed nodes (`pagerank.rs:137-210`).
- Dangling node handling: distribute rank to all nodes (uniform) or to seeds (personalized).
- Convergence: L1 norm of rank difference < epsilon.

### AVA.9.9.3 Louvain Community Detection

Single-level modularity optimization via greedy local moves (`louvain.rs:43-174`).

```
Q = (1/2m) * sum_ij [A_ij - k_i*k_j/(2m)] * delta(c_i, c_j)
```

- Each node starts as its own community.
- For each node, evaluate modularity gain from moving to each neighbor's community.
- Move to maximum-gain community if gain is positive.
- Repeat until convergence or max passes reached.
- Returns `LouvainResult { communities, modularity, passes, community_count }`.

---

## AVA.9.10 CEP Sequence Patterns

Complex Event Processing patterns detect ordered temporal sequences of
signals across entity lifecycles (R9, `sequence.rs:1-7`).

### AVA.9.10.1 SequencePattern

```rust
// ava-fusion/src/sequence.rs:130-146
pub struct SequencePattern {
    pub id: String,
    pub name: String,
    pub steps: Vec<SequenceStep>,
    pub contiguity: Contiguity,
    pub cross_predicates: Vec<CrossStepPredicate>,
    pub timeout_ms: u64,
    pub enabled: bool,
}
```

### AVA.9.10.2 SequenceStep

Each step matches a signal kind with optional filter predicates and
duration constraints:

```rust
// sequence.rs:66-81
pub struct SequenceStep {
    pub signal_kind: String,
    pub predicate: Option<String>,
    pub min_duration_ms: Option<u64>,
    pub max_duration_ms: Option<u64>,
    pub contiguity: Contiguity,
}
```

### AVA.9.10.3 Contiguity Modes

| Mode | Behavior | Source |
|------|----------|--------|
| `Strict` | No unmatched events between steps; resets on non-match | `sequence.rs:25` |
| `Relaxed` (default) | Unrelated events between steps are ignored | `sequence.rs:27` |
| `NonDeterministic` | Any event order accepted; branching exploration | `sequence.rs:29` |

### AVA.9.10.4 Cross-Step Predicates

Predicates spanning two steps enforce constraints like entity continuity
or spatial proximity across non-adjacent steps:

```rust
// sequence.rs:94-101
pub struct CrossStepPredicate {
    pub from_step: u32,
    pub to_step: u32,
    pub predicate: String,  // e.g., "haversine(step_0.geo, step_2.geo) < 50000"
}
```

### AVA.9.10.5 SequenceMatch Output

```rust
// sequence.rs:159-172
pub struct SequenceMatch {
    pub pattern_id: String,
    pub entity_id: String,
    pub matched_steps: Vec<u32>,
    pub start_ms: u64,
    pub end_ms: u64,
    pub confidence: f64,  // completeness * timeliness * specificity
}
```

### AVA.9.10.6 Canonical Sequences

Pre-built patterns shipped with the system include AIS dark period detection,
C2 beacon chain detection, and maritime transshipment patterns
(`sequence.rs:183-194`).

---

## AVA.9.11 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.9-R1 | Each join path MUST be represented as a `JoinPathEntryV2` with all required fields populated | MUST |
| AVA.9-R2 | Tier 1 joins MUST use equijoin on the extracted identifier key and MUST produce confidence ~0.99 | MUST |
| AVA.9-R3 | Tier 2 joins MUST apply blocking before the equijoin to reduce candidate pairs | MUST |
| AVA.9-R4 | Spatial blocking MUST use H3 cell indexing with configurable resolution and k-ring expansion when WGS84 coordinates are available | MUST |
| AVA.9-R5 | The `consolidate()` operator MUST be applied after Tier 2 blocking joins to merge cancelling diffs from k-ring expansion | MUST |
| AVA.9-R6 | Tier 3 community detection via `iterate` MUST include `consolidate()` inside the loop to ensure convergence | MUST |
| AVA.9-R7 | Each `Tier3Method` MUST map to a distinct differential-dataflow pipeline pattern as specified in AVA.9.7 | MUST |
| AVA.9-R8 | Confidence scoring MUST support at minimum WeightedAverage, LogOdds, and DempsterShafer combination models | MUST |
| AVA.9-R9 | Sequence patterns MUST support Strict, Relaxed, and NonDeterministic contiguity modes and cross-step predicates | MUST |
| AVA.9-R10 | Disabled join paths (`EnabledState::Disabled`) MUST be excluded from the dataflow graph at construction time | MUST |

---

## AVA.9.12 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [McSherry 2013] McSherry, F., "Differential Dataflow", CIDR 2013.
- [Blondel et al. 2008] Blondel, V.D., Guillaume, J.-L., Lambiotte, R., & Lefebvre, E., "Fast unfolding of communities in large networks", J. Stat. Mech., 2008.
- [Khan & Anwar 2019] Khan, N., & Anwar, S., "Modified Dempster-Shafer with entropy-based paradox elimination", Sensors, 2019.
- [Ngo et al. 2014] Ngo, H.Q., Porat, E., Re, C., & Rudra, A., "Worst-Case Optimal Join Algorithms", PODS 2014.
- [h3o] Uber H3 hierarchical geospatial indexing — Rust crate `h3o`
- [realfft] Real-valued FFT via Hermitian symmetry — Rust crate `realfft`
- [find_peaks] Prominence-based peak detection — Rust crate `find_peaks`
- [ava-fusion join_path] `ava-fusion/src/join_path.rs` — JoinType, FusionTier, JoinPathEntryV2
- [ava-fusion tier3] `ava-fusion/src/tier3.rs` — Tier3Method, configs, promotion
- [ava-fusion sequence] `ava-fusion/src/sequence.rs` — SequencePattern, SequenceStep, Contiguity
- [ava-fusion blocking] `ava-fusion/src/blocking.rs` — SpatialBlockConfig, TemporalBlockConfig, SpectralBlockConfig
- [ava-fusion-runtime dataflow] `ava-fusion-runtime/src/dataflow/` — graph.rs, blocking.rs, scoring.rs
- [ava-fusion-runtime graph] `ava-fusion-runtime/src/graph/` — louvain.rs, pagerank.rs, triangle.rs
- [ava-fusion-runtime periodicity] `ava-fusion-runtime/src/signal/periodicity.rs` — FFT, Lomb-Scargle, cross-spectral
- [Research Compendium] `docs/research/differential-dataflow-fusion-integration.md`

---

*End of section AVA.9*


---


---

# PART III: ALGORITHMS (Normative)

---

# AVA.10 Evidence Theory (DS/PCR5)

```
Section:       AVA.10 — Evidence Theory (DS/PCR5)
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          III — Algorithms (Normative)
Prerequisites: AVA.9 (Fusion Tiers)
Feeds:         AVA.11 (Tracking & State Estimation), AVA.13 (Output Pipeline)
```

> This section specifies the evidence-theoretic foundations underpinning
> multi-source data fusion in the ava-fusion pipeline. It defines the
> confidence model selection strategy, Basic Probability Assignment (BPA)
> representation, four Dempster-Shafer combination rules, the calibration
> lifecycle, and three risk accumulation models for weak-signal compounding.
> The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
> "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
> "OPTIONAL" in this document are to be interpreted as described in
> [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava101-conventions-and-terminology)
2.  [Confidence Model Selection](#ava102-confidence-model-selection)
3.  [Predicate Weights & Correlation Discount](#ava103-predicate-weights--correlation-discount)
4.  [Basic Probability Assignment](#ava104-basic-probability-assignment)
5.  [Combination Rules](#ava105-combination-rules)
6.  [Spoofing-Aware Degradation](#ava106-spoofing-aware-degradation)
7.  [Calibration Lifecycle](#ava107-calibration-lifecycle)
8.  [Risk Accumulation Models](#ava108-risk-accumulation-models)
9.  [Temporal Decay Models](#ava109-temporal-decay-models)
10. [Normative Requirements Summary](#ava1010-normative-requirements-summary)
11. [References](#ava1011-references)

---

## AVA.10.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.10.1.1 Terminology

| Term | Definition |
|------|-----------|
| **BPA** | Basic Probability Assignment — a mass function over a frame of discernment |
| **Frame of discernment** | The set of mutually exclusive hypotheses theta |
| **Focal element** | A subset of theta with non-zero mass |
| **Belief** | Lower bound on probability: `Bel(A) = sum m(B) for B subset A` |
| **Plausibility** | Upper bound on probability: `Pl(A) = sum m(B) for B intersect A != empty` |
| **Pignistic probability** | Decision-theoretic transform from BPA to point probabilities (Smets 1990) |
| **Conflict mass** | The mass assigned to the empty set during combination |
| **ECE** | Expected Calibration Error — mean absolute gap between predicted and observed accuracy |
| **NoisyOr** | Probabilistic OR gate: `P = 1 - prod(1 - s_i)` |

---

## AVA.10.2 Confidence Model Selection

The pipeline provides three confidence combination strategies, selectable
per entity class via `ConfidenceModel` (`ava-fusion/src/confidence.rs:24-28`):

```rust
pub enum ConfidenceModel {
    WeightedAverage,   // Default: simple, interpretable, calibratable
    LogOdds,           // Better mathematical properties for extreme values
    DempsterShafer,    // Expert mode with explicit ignorance representation
}
```

**AVA.10-R1**: Implementations MUST default to `WeightedAverage` when no model
is explicitly configured (`confidence.rs:30-34`).

**AVA.10-R2**: When `DempsterShafer` is selected, the implementation MUST
consult `DempsterShaferConfig` for the combination rule and conflict threshold
(`confidence.rs:178-190`).

### AVA.10.2.1 Selection Guidance

| Model | Use When | Trade-off |
|-------|----------|-----------|
| WeightedAverage | Standard multi-source fusion, operator-tunable | No ignorance representation |
| LogOdds | Extreme confidence values, sensor reliability scoring | Unbounded intermediate values |
| DempsterShafer | Conflicting evidence, explicit "don't know" required | O(F^2) per combination for PCR5 |

---

## AVA.10.3 Predicate Weights & Correlation Discount

### AVA.10.3.1 Five-Dimensional Predicate Weights

Tier 2 soft-key fusion operates over five predicate dimensions
(`confidence.rs:40-65`):

| Dimension | Default Weight | Purpose |
|-----------|---------------|---------|
| Spatial | 0.35 | Geographic proximity |
| Temporal | 0.25 | Time-of-arrival correlation |
| Spectral | 0.20 | RF signature matching |
| Behavioral | 0.15 | Movement pattern correlation |
| Semantic | 0.05 | Named-entity and metadata overlap |

**AVA.10-R3**: Predicate weights MUST sum to 1.0 within epsilon (1e-10).
The default weights are validated by test `predicate_weights_default_sums_to_one`
(`confidence.rs:392-396`).

### AVA.10.3.2 Correlation Matrix

A 5x5 symmetric matrix discounts double-counted evidence between correlated
dimensions (`confidence.rs:79-96`):

```
         spa   tmp   spc   beh   sem
spa    [ 1.0   0.6   0.1   0.4   0.05 ]
tmp    [ 0.6   1.0   0.1   0.3   0.1  ]
spc    [ 0.1   0.1   1.0   0.05  0.0  ]
beh    [ 0.4   0.3   0.05  1.0   0.1  ]
sem    [ 0.05  0.1   0.0   0.1   1.0  ]
```

**AVA.10-R4**: The correlation matrix MUST be symmetric. Diagonal entries
MUST be 1.0. Validated by tests `correlation_matrix_default_is_symmetric`
and `correlation_matrix_diagonal_is_one` (`confidence.rs:423-441`).

---

## AVA.10.4 Basic Probability Assignment

### AVA.10.4.1 Representation

BPAs use a bitset encoding where each bit position corresponds to a hypothesis
in the frame of discernment theta (`confidence.rs:196-235`):

```rust
pub struct FocalElement {
    pub hypothesis_set: u64,  // Bitset: bit i = hypothesis H_i
    pub mass: f64,            // Mass assigned (0.0-1.0)
}

pub struct BasicProbabilityAssignment {
    pub frame_size: u8,                    // |theta| <= 64
    pub focal_elements: Vec<FocalElement>, // Ordered by hypothesis_set
}
```

**Bitset examples** (`confidence.rs:202-206`):
- `0b001` = {H0} (singleton)
- `0b011` = {H0, H1} (disjunction)
- `0b111` = {H0, H1, H2} = theta (full ignorance)
- `0b000` = empty set (only in TBM)

**AVA.10-R5**: BPAs MUST maintain the invariant that all masses sum to 1.0
within epsilon. The `total_mass()` method validates this (`confidence.rs:251-253`).

### AVA.10.4.2 Vacuous BPA

A vacuous BPA assigns all mass to theta, representing complete ignorance
(`confidence.rs:239-248`):

```rust
pub fn vacuous(frame_size: u8) -> Self {
    let theta = (1u64 << frame_size) - 1;
    Self {
        frame_size,
        focal_elements: vec![FocalElement {
            hypothesis_set: theta,
            mass: 1.0,
        }],
    }
}
```

### AVA.10.4.3 Belief and Plausibility

Two dual measures bracket the true probability (`confidence.rs:277-292`):

- **Belief**: `Bel(A) = sum m(B) for all B subset A`
- **Plausibility**: `Pl(A) = sum m(B) for all B where B intersect A != empty`

For any hypothesis A: `Bel(A) <= P(A) <= Pl(A)`.

### AVA.10.4.4 Pignistic Transform

The pignistic probability (Smets 1990) converts a BPA to point probabilities
for decision-making (`confidence.rs:294-328`):

```
BetP(H_i) = sum_{A: H_i in A} m(A)/|A| * 1/(1 - m(empty))
```

### AVA.10.4.5 Pruning and k-Additivity

Focal elements with mass below epsilon are pruned to bound computation.
Pruned mass is redistributed proportionally (`confidence.rs:257-274`).

**AVA.10-R6**: BPA pruning MUST redistribute mass to preserve the sum-to-one
invariant. Default epsilon is 1e-3 (`confidence.rs:337`).

The `max_additivity` parameter restricts focal elements to sets of size <= k,
providing O(n^2) instead of O(2^n) complexity. Default k=2 retains pairwise
hypotheses (`confidence.rs:339-342`).

---

## AVA.10.5 Combination Rules

Four combination rules are supported (`confidence.rs:152-169`):

```rust
pub enum DsCombinationRule {
    Standard,  // Dempster's original rule (normalised)
    Yager,     // Transfers conflict mass to theta (unknown)
    Tbm,       // Transferable Belief Model (un-normalised)
    Pcr5,      // Proportional Conflict Redistribution #5
}
```

### AVA.10.5.1 Standard Dempster's Rule

For two BPAs m1, m2:

```
m12(A) = [ sum_{B intersect C = A} m1(B)*m2(C) ] / (1 - K)
K = sum_{B intersect C = empty} m1(B)*m2(C)
```

Normalisation by `(1 - K)` redistributes conflict mass proportionally. Fails
when K approaches 1.0 (Zadeh's paradox).

### AVA.10.5.2 Yager's Rule

Transfers all conflict mass to theta instead of normalising:

```
m12(A) = sum_{B intersect C = A} m1(B)*m2(C)    for A != theta
m12(theta) += K
```

More conservative than Dempster: high conflict produces high ignorance rather
than distorted certainty.

### AVA.10.5.3 Transferable Belief Model (TBM)

Un-normalised combination that allows mass on the empty set:

```
m12(A) = sum_{B intersect C = A} m1(B)*m2(C)    for all A including empty
```

Empty set mass represents the degree of internal conflict. Used with the
pignistic transform for final decisions.

### AVA.10.5.4 PCR5 (Smarandache & Dezert 2006)

Proportional Conflict Redistribution #5: redistributes conflict mass
proportionally to each source's commitment to involved hypotheses
(`confidence.rs:166-168`):

```
Complexity: O(F^2) per pair where F = number of focal elements
```

**AVA.10-R7**: PCR5 is NOT associative for n>2 sources. Implementations
MUST use Murphy's average BPA first when combining more than two sources
(`confidence.rs:158`).

### AVA.10.5.5 Conflict Threshold

The `conflict_threshold` parameter controls operator alerting
(`confidence.rs:173-174`):

- At 0.7 (default): warn the operator of high conflict
- At 0.9: the system MUST refuse combination (Zadeh's paradox avoidance)

**AVA.10-R8**: When conflict mass K exceeds `conflict_threshold`, the
implementation MUST NOT proceed with combination under Standard Dempster's
rule. It SHOULD fall back to Yager or PCR5.

---

## AVA.10.6 Spoofing-Aware Degradation

Hard-key (Tier 1) confidence degrades when RI-7 spoofing heuristics flag
an identifier (`confidence.rs:102-120`):

```rust
pub struct SpoofingDiscount {
    pub enabled: bool,       // Default: true
    pub max_discount: f64,   // Default: 0.49
}
```

When enabled, a Tier 1 confidence of 0.99 degrades by up to `max_discount`,
yielding a minimum of 0.50 (forcing the entity into Tier 2 soft-key evaluation).

**AVA.10-R9**: Spoofing discount MUST be enabled by default. The maximum
discount MUST NOT exceed 0.49, preserving a floor above 0.50.

### AVA.10.6.1 Confidence Clamping

All computed confidence scores are clamped to `[min, max]`
(`confidence.rs:133-145`):

- Default min: 0.01 (prevents division by zero in log-odds conversion)
- Default max: 0.99 (prevents false certainty)

---

## AVA.10.7 Calibration Lifecycle

### AVA.10.7.1 Four-Phase Model

The calibration system follows a four-phase lifecycle per signal pair
(`calibration.rs:17-30`):

```
Warmup --> Active --> Degraded --> Failed
  |                     |
  |   (ECE recovers)    |
  +<--------------------+
```

| Phase | Condition | Behavior |
|-------|-----------|----------|
| **Warmup** | < warmup_samples verdicts | Collecting data; no calibration applied |
| **Active** | Sufficient data, ECE below drift_threshold | Calibration curve actively applied |
| **Degraded** | ECE exceeds drift_threshold (0.1) | Warn operator; recalibration recommended |
| **Failed** | ECE exceeds fail_threshold (0.25) | Scores unreliable; operator intervention required |

### AVA.10.7.2 Calibration Configuration

(`calibration.rs:98-116`):

```rust
pub struct CalibrationConfig {
    pub bin_count: u32,          // Default: 10 (deciles)
    pub warmup_samples: u64,     // Default: 500
    pub drift_threshold: f64,    // Default: 0.1
    pub fail_threshold: f64,     // Default: 0.25
}
```

### AVA.10.7.3 Operator Verdicts

Three verdict levels classify operator assessment (`calibration.rs:37-48`):

| Verdict | Meaning |
|---------|---------|
| `Calibrated` | Predicted confidence aligns with observed accuracy |
| `Drifting` | Moderate divergence detected |
| `Uncalibrated` | Large divergence; recalibration required |

### AVA.10.7.4 Calibration Histogram

Each bin in the calibration curve tracks (`calibration.rs:55-66`):

- `predicted`: Mean confidence for fusions in this bin
- `observed`: Fraction of correct fusions in this bin
- `count`: Number of verdicts

The Expected Calibration Error (ECE) is the weighted average of
`|predicted - observed|` across all bins.

**AVA.10-R10**: Calibration snapshots MUST be published to
`tsingou.meta.calibration.{pair}.{timestamp}` with the full histogram,
ECE, phase, and timestamp (`calibration.rs:73-85`).

---

## AVA.10.8 Risk Accumulation Models

### AVA.10.8.1 Risk Categories

Six categories classify risk indicators (`risk.rs:27-42`):

| Category | Code | Weight | Default TTL |
|----------|------|--------|-------------|
| Identity | ID | 0.20 | 24h |
| Kinematic | KIN | 0.20 | 2h |
| Behavioral | BEH | 0.20 | 8h |
| Association | ASSOC | 0.15 | 4h |
| Signal | SIG | 0.15 | 12h |
| Intelligence | INTEL | 0.10 | 72h |

**AVA.10-R11**: Category weights MUST sum to 1.0. Validated by test
`risk_category_default_weights_sum` (`risk.rs:417-419`).

### AVA.10.8.2 Risk Indicators

Each indicator carries (`risk.rs:88-104`):

- `category`: RiskCategory discriminant
- `name`: Human-readable label (e.g., "AIS position drift")
- `score`: Current score in [0.0, 1.0] after temporal decay
- `confidence`: Confidence in the assessment [0.0, 1.0]
- `source`: Producing subsystem (e.g., "absence-detector")
- `timestamp_ms`: Last update epoch

### AVA.10.8.3 Accumulation Methods

Three aggregation strategies are available (`risk.rs:141-161`):

| Method | Formula | Properties |
|--------|---------|------------|
| **NoisyOr** (default) | `1 - prod(1 - s_i)` | Bounded [0,1], commutative, diminishing returns |
| **WeightedSum** | `sum(w_i * s_i)`, clamped | Simple additive, may exceed 1.0 |
| **Max** | `max(s_i)` | Worst-case dominates |

### AVA.10.8.4 Leaky NoisyOr

The Leaky NoisyOr model adds a background leak probability for unmodeled
causes (`risk.rs:308-335`):

```
Standard: P = 1 - prod(1 - s_i)
Leaky:    P = 1 - q0 * prod(1 - s_i)
where q0 = 1 - p_leak
```

Default leak = 0.05 (5% background risk probability). This ensures the
composite risk never drops to exactly zero even with no active indicators.

### AVA.10.8.5 Risk Thresholds

Five classification boundaries for the composite score
(`risk.rs:113-134`):

| Level | Threshold |
|-------|-----------|
| Low | 0.2 |
| Elevated | 0.4 |
| High | 0.6 |
| Severe | 0.8 |
| Critical | 0.9 |

### AVA.10.8.6 Entity Risk Profile

The aggregated profile per entity (`risk.rs:358-373`):

```rust
pub struct EntityRiskProfile {
    pub entity_id: String,
    pub indicators: Vec<RiskIndicator>,
    pub aggregate_score: f64,
    pub last_updated_ms: u64,
    pub trend: RiskTrend,  // Rising | Stable | Falling
}
```

---

## AVA.10.9 Temporal Decay Models

Four decay models govern how indicator scores diminish over time
(`risk.rs:210-302`):

### AVA.10.9.1 Weibull Decay

```
s(t) = s0 * exp(-(t/lambda)^k)
```

- k < 1: Fast initial decay, long tail
- k = 1: Standard exponential
- k > 1: Slow start, abrupt cutoff

Recommended for Identity (k=1.0, lambda=30min), Kinematic (k=0.7, lambda=5min),
Behavioral (k=0.8, lambda=15min), Signal (k=1.5, lambda=10min).

### AVA.10.9.2 Power-Law Decay

```
s(t) = s0 * (1 + t/tau)^(-alpha)
```

Fat-tailed: at t = 10*tau, retains ~9% (for alpha=1). Suitable for
Association (tau=1hr, alpha=0.8) and Intelligence (tau=24hr, alpha=0.5).

Validated by test `decay_model_power_law_fat_tail` (`risk.rs:607-614`).

### AVA.10.9.3 Exponential Decay (Legacy)

```
s(t) = s0 * exp(-ln(2) * t / half_life)
```

Legacy backward-compatible model. At t = half_life, factor = 0.5 exactly.
Validated by test `decay_model_exponential_half_life` (`risk.rs:617-625`).

### AVA.10.9.4 Step-with-Grace Decay

```
s(t) = s0                                         for t <= grace_ms
s(t) = s0 * exp(-ln(2) * (t - grace_ms) / half_life)  for t > grace_ms
```

No decay during the grace period; exponential decay after. Useful for
indicators that should remain at full strength for a minimum observation
window. Validated by test `decay_model_step_with_grace` (`risk.rs:628-638`).

**AVA.10-R12**: Decay models MUST be serialised with an internally-tagged
`"type"` discriminator in camelCase (`risk.rs:226`). Validated by test
`decay_model_tagged_json` (`risk.rs:668-676`).

---

## AVA.10.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.10-R1 | Default confidence model MUST be WeightedAverage | MUST |
| AVA.10-R2 | DempsterShafer model MUST consult DempsterShaferConfig | MUST |
| AVA.10-R3 | Predicate weights MUST sum to 1.0 within epsilon | MUST |
| AVA.10-R4 | Correlation matrix MUST be symmetric with diagonal 1.0 | MUST |
| AVA.10-R5 | BPA masses MUST sum to 1.0 within epsilon | MUST |
| AVA.10-R6 | BPA pruning MUST redistribute mass to preserve invariant | MUST |
| AVA.10-R7 | PCR5 with n>2 sources MUST use Murphy's average BPA first | MUST |
| AVA.10-R8 | Combination MUST NOT proceed when conflict exceeds threshold (Standard rule) | MUST NOT |
| AVA.10-R9 | Spoofing discount MUST be enabled by default, max 0.49 | MUST |
| AVA.10-R10 | Calibration snapshots MUST be published to NATS subject | MUST |
| AVA.10-R11 | Risk category weights MUST sum to 1.0 | MUST |
| AVA.10-R12 | Decay models MUST use internally-tagged JSON serialisation | MUST |

---

## AVA.10.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [Dempster 1967] Dempster, A.P., "Upper and lower probabilities induced by a multivalued mapping", Ann. Math. Statist. 38(2), 1967.
- [Shafer 1976] Shafer, G., "A Mathematical Theory of Evidence", Princeton University Press, 1976.
- [Yager 1987] Yager, R.R., "On the Dempster-Shafer framework and new combination rules", Inf. Sci. 41(2), 1987.
- [Smets 1990] Smets, P., "The combination of evidence in the transferable belief model", IEEE PAMI, 1990.
- [Smarandache & Dezert 2006] Smarandache, F., Dezert, J., "Proportional conflict redistribution rules for information fusion", Proc. Fusion 2006.
- [Murphy 2000] Murphy, C.K., "Combining belief functions when evidence conflicts", Decision Support Systems 29, 2000.
- [ava-fusion confidence.rs] `ava-fusion/src/confidence.rs` — ConfidenceModel, BPA, DS combination rules
- [ava-fusion calibration.rs] `ava-fusion/src/calibration.rs` — Calibration lifecycle
- [ava-fusion risk.rs] `ava-fusion/src/risk.rs` — Risk accumulation, decay models

---

*End of section AVA.10*


---

# AVA.11 Tracking & State Estimation

```
Section:       AVA.11 — Tracking & State Estimation
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          III — Algorithms (Normative)
Prerequisites: AVA.10 (Evidence Theory)
Feeds:         AVA.12 (Complex Event Processing), AVA.13 (Output Pipeline)
```

> This section specifies the tracking and state estimation subsystem of the
> ava-fusion pipeline. It covers the 5-state track lifecycle finite state
> machine, the Extended Kalman Filter with three motion models, the
> Interacting Multiple Model filter, Covariance Intersection for
> track-to-track fusion, and the Sequential Probability Ratio Test for
> statistically rigorous track confirmation. The key words "MUST", "MUST
> NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT",
> "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this document
> are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava111-conventions-and-terminology)
2.  [Track Lifecycle State Machine](#ava112-track-lifecycle-state-machine)
3.  [Extended Kalman Filter](#ava113-extended-kalman-filter)
4.  [Interacting Multiple Model Filter](#ava114-interacting-multiple-model-filter)
5.  [Covariance Intersection](#ava115-covariance-intersection)
6.  [Sequential Probability Ratio Test](#ava116-sequential-probability-ratio-test)
7.  [Coasting and Dead Reckoning](#ava117-coasting-and-dead-reckoning)
8.  [Lifecycle Configuration](#ava118-lifecycle-configuration)
9.  [Normative Requirements Summary](#ava119-normative-requirements-summary)
10. [References](#ava1110-references)

---

## AVA.11.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.11.1.1 Terminology

| Term | Definition |
|------|-----------|
| **Track** | A fused state estimate representing one real-world entity |
| **EKF** | Extended Kalman Filter — linearised Bayesian state estimator |
| **IMM** | Interacting Multiple Model — bank of EKFs with model switching |
| **CI** | Covariance Intersection — conservative track-to-track fusion |
| **SPRT** | Sequential Probability Ratio Test (Wald 1947) |
| **NIS** | Normalised Innovation Squared — chi-squared gating statistic |
| **Coast** | Prediction-only operation when no measurement is available |
| **M-of-N** | Confirmation by observing M detections in N consecutive scans |

---

## AVA.11.2 Track Lifecycle State Machine

### AVA.11.2.1 Five States

The track lifecycle is governed by a 5-state FSM
(`ava-fusion/src/track.rs:20-57`):

```
             +----------+
 signal ---> | TENTATIVE|
             +----+-----+
                  | confirmation (M-of-N / SPRT / score)
             +----v-----+         +---------+
             | CONFIRMED+-------->+ COASTING|
             +----+-----+ missed  +----+----+
                  |              recovery |
             +----v-----+         +----v----+
             | CONFIRMED+<--------+ COASTING|
             +----+-----+         +----+----+
                  |                    |
             +----v-----+         +----v----+
             |  MERGED  |         | DROPPED |
             +----------+         +---------+
```

| State | Join Participation | Confidence Multiplier | Terminal |
|-------|-------------------|----------------------|----------|
| **Tentative** | Yes (reduced x0.5) | 0.5 | No |
| **Confirmed** | Yes (full) | 1.0 | No |
| **Coasting** | Yes (decaying) | 1.0 (decays externally per scan) | No |
| **Dropped** | No | 0.0 | Yes |
| **Merged** | No | 1.0 (inherited from survivor) | Yes |

Source: `TrackLifecycleState::confidence_multiplier()` (`track.rs:88-96`),
`allows_joins()` (`track.rs:70-77`), `is_terminal()` (`track.rs:80-85`).

### AVA.11.2.2 Valid Transitions

**AVA.11-R1**: Implementations MUST enforce the following transition table.
All other transitions are INVALID (`track.rs:340-358`):

| From | To | Trigger |
|------|----|---------|
| Tentative | Confirmed | M-of-N, score threshold, or SPRT confirmed |
| Tentative | Dropped | False alarm rejection |
| Tentative | Merged | Hard/soft key match |
| Confirmed | Coasting | Consecutive detection misses |
| Confirmed | Merged | Hard/soft key match or operator action |
| Coasting | Confirmed | Measurement re-acquired |
| Coasting | Dropped | Max coast exceeded or score below threshold |
| Coasting | Merged | Hard/soft key match |

### AVA.11.2.3 Transition Reasons

Ten discriminated reasons are published with each transition event
(`track.rs:122-143`):

```rust
pub enum TransitionReason {
    Initiated,          // First observation
    MOfNConfirmed,      // M-of-N criteria met
    ScoreConfirmed,     // Score threshold exceeded
    SprtConfirmed,      // SPRT log-likelihood ratio exceeded A
    DetectionMissed,    // Consecutive misses
    DetectionRecovered, // Re-acquired during coast
    MaxCoastExceeded,   // Coast timeout
    ScoreBelowThreshold,// Score dropped below delete threshold
    MergedInto,         // Identity resolution merge
    OperatorAction,     // Manual override
}
```

**AVA.11-R2**: Lifecycle transitions MUST be published to NATS subject
`tsingou.track.lifecycle.<entity_class>.<track_id>` as `LifecycleTransition`
events (`track.rs:167-185`).

---

## AVA.11.3 Extended Kalman Filter

### AVA.11.3.1 Three Motion Models

The EKF supports three motion models, all using nalgebra compile-time
5-dimensional state vectors (`ava-fusion-runtime/src/tracking/ekf.rs:11-44`):

| Model | State Vector | Active Dims | Use Case |
|-------|-------------|-------------|----------|
| **CV** (Constant Velocity) | `[x, y, vx, vy, 0]` | 4 | Straight-line motion |
| **CT** (Coordinated Turn) | `[x, y, vx, vy, omega]` | 5 | Turning with velocity components |
| **CTRV** (Constant Turn Rate & Velocity) | `[x, y, v, theta, omega]` | 5 | Turning with scalar speed + heading |

**AVA.11-R3**: All models MUST share a common 5-dimensional state vector
(MAX_DIM=5) to enable IMM mixing without dimension conversion (`ekf.rs:14`).

### AVA.11.3.2 CV Prediction

Linear state transition (`ekf.rs:190-220`):

```
F = | 1  0  dt  0  0 |    Q = sigma_a^2 * | dt^4/4   0       dt^3/2  0       0 |
    | 0  1  0   dt 0 |                     | 0        dt^4/4  0       dt^3/2  0 |
    | 0  0  1   0  0 |                     | dt^3/2   0       dt^2    0       0 |
    | 0  0  0   1  0 |                     | 0        dt^3/2  0       dt^2    0 |
    | 0  0  0   0  0 |                     | 0        0       0       0       0 |

x_pred = F * x
P_pred = F * P * F^T + Q
```

Piecewise white noise acceleration model with `sigma_a` (m/s^2).

### AVA.11.3.3 CT Prediction (Nonlinear)

Coordinated turn with singularity guard for omega near zero
(`ekf.rs:226-261`):

```
When |omega| >= 1e-6:
  x' = x + (vx*sin(w*dt) - vy*(1-cos(w*dt))) / w
  y' = y + (vx*(1-cos(w*dt)) + vy*sin(w*dt)) / w
  vx' = vx*cos(w*dt) - vy*sin(w*dt)
  vy' = vx*sin(w*dt) + vy*cos(w*dt)

When |omega| < 1e-6 (straight-line fallback):
  x' = x + vx*dt
  y' = y + vy*dt
```

The Jacobian is computed analytically (`ekf.rs:263-286`).

### AVA.11.3.4 CTRV Prediction (Nonlinear)

Constant turn rate and velocity with heading-based state
(`ekf.rs:292-325`):

```
When |omega| >= 1e-6:
  x' = x + (v/w) * (sin(theta+w*dt) - sin(theta))
  y' = y + (v/w) * (cos(theta) - cos(theta+w*dt))
  theta' = theta + w*dt

When |omega| < 1e-6 (straight-line fallback):
  x' = x + v*cos(theta)*dt
  y' = y + v*sin(theta)*dt
```

**AVA.11-R4**: Both CT and CTRV models MUST implement a singularity guard
for `|omega| < 1e-6`, falling back to linear prediction (`ekf.rs:230,296`).

### AVA.11.3.5 Joseph-Form Covariance Update

The measurement update uses the Joseph form for numerical stability
(`ekf.rs:112-146`):

```
K = P * H^T * S^(-1)                    // Kalman gain
P_updated = (I - K*H) * P * (I - K*H)^T + K * R * K^T   // Joseph form
```

**AVA.11-R5**: Implementations MUST use the Joseph-form covariance update
(not the simplified `P = (I-KH)*P`). This guarantees positive semi-definiteness
even under finite-precision arithmetic. Validated by test
`joseph_form_covariance_stays_positive` (`ekf.rs:545-561`).

### AVA.11.3.6 Innovation and Gating

The Normalised Innovation Squared (NIS) serves as a gating statistic
(`ekf.rs:170-179`):

```
NIS = y^T * S^(-1) * y
```

Under H0 (correct association), NIS follows Chi-squared(2) for 2D position
measurements. A gate threshold of 9.21 (99% Chi-squared with 2 DOF) is
typical.

---

## AVA.11.4 Interacting Multiple Model Filter

### AVA.11.4.1 Architecture

The IMM wraps three EKF instances (CV, CT, CTRV) and combines their
estimates using model-probability mixing
(`ava-fusion-runtime/src/tracking/imm.rs:1-11`):

```
Memory: ~93 f64 values per track (744 bytes) for 3 models padded to dim 5
```

### AVA.11.4.2 Four-Step Cycle

Each IMM cycle follows four steps (`imm.rs:73-88`):

**Step 1 — Mixing Probabilities** (`imm.rs:138-164`):

```
c_j = sum_i pi[i][j] * mu[i]
mu_{i|j} = pi[i][j] * mu[i] / c_j
```

Where `pi` is the Markov transition matrix and `mu` are model probabilities.

**Step 2 — Mixed Initial Conditions** (`imm.rs:170-192`):

```
x0_j = sum_i mu_{i|j} * x_i
P0_j = sum_i mu_{i|j} * [P_i + (x_i - x0_j)(x_i - x0_j)^T]
```

**Step 3 — Model-Conditioned Filtering**:

Each EKF runs predict + update independently with its own motion model.

**Step 4 — Model Probability Update** (`imm.rs:198-235`):

```
L_j = N(y_j; 0, S_j)              // Gaussian innovation likelihood
mu_j(k) = L_j * c_j / sum(L_i * c_i)
```

**AVA.11-R6**: Model probabilities MUST sum to 1.0 after each step.
Validated by test `imm_model_probabilities_sum_to_one` (`imm.rs:255-270`).

### AVA.11.4.3 Default Transition Matrix

High self-transition probability with equal switching (`imm.rs:49-54`):

```
pi = | 0.950  0.025  0.025 |
     | 0.025  0.950  0.025 |
     | 0.025  0.025  0.950 |
```

**AVA.11-R7**: Transition matrix rows MUST sum to 1.0. Validated by test
`imm_transition_matrix_rows_sum_to_one` (`imm.rs:331-339`).

### AVA.11.4.4 Combined State Estimate

The combined state is a probability-weighted mixture (`imm.rs:100-106`):

```
x_combined = sum_j mu_j * x_j
```

Combined covariance includes the cross-term (`imm.rs:109-117`):

```
P_combined = sum_j mu_j * [P_j + (x_j - x_combined)(x_j - x_combined)^T]
```

### AVA.11.4.5 Coast Mode

When no measurement is available, `predict()` runs Steps 1-2-3 without
the update or probability re-estimation (`imm.rs:91-97`). Model
probabilities are frozen during coast.

---

## AVA.11.5 Covariance Intersection

### AVA.11.5.1 Track-to-Track Fusion

CI fuses state estimates from different trackers when cross-correlations
are unknown (`ava-fusion-runtime/src/tracking/fusion.rs:1-12`):

```
P_CI^(-1) = omega * P_A^(-1) + (1-omega) * P_B^(-1)
x_CI = P_CI * (omega * P_A^(-1) * x_A + (1-omega) * P_B^(-1) * x_B)
```

**AVA.11-R8**: CI MUST guarantee consistency — the fused covariance is
never smaller than the true (unknown) covariance. Validated by test
`ci_covariance_stays_positive_definite` (`fusion.rs:239-253`).

### AVA.11.5.2 Fast Omega via Trace Minimisation

Omega is computed without an optimisation loop (`fusion.rs:37-48`):

```
omega = tr(P_B) / (tr(P_A) + tr(P_B))
```

This minimises the trace of the fused covariance. The result is clamped
to [0.01, 0.99] to avoid singularity (`fusion.rs:60`).

### AVA.11.5.3 Sequential N-Track Fusion

Multiple tracks are fused pairwise in sequence (`fusion.rs:83-108`):

```
(A, B) -> AB, (AB, C) -> ABC, ...
```

Order-dependent but consistent. Returns `None` for empty inputs and
identity for single-track inputs.

**AVA.11-R9**: CI fusion MUST return `None` if either input covariance
is singular (not invertible) (`fusion.rs:62-63`).

---

## AVA.11.6 Sequential Probability Ratio Test

### AVA.11.6.1 SPRT for Track Confirmation

SPRT replaces M-of-N heuristics with a statistically rigorous method
(Wald 1947) (`ava-fusion-runtime/src/tracking/sprt.rs:1-12`):

```
LLR accumulates evidence: positive for detections, negative for misses
```

Three decisions (`sprt.rs:20-28`):

| Decision | Condition |
|----------|-----------|
| **Continue** | `B < LLR < A` |
| **Confirm** | `LLR >= A = ln((1-beta)/alpha)` |
| **Reject** | `LLR <= B = ln(beta/(1-alpha))` |

### AVA.11.6.2 Likelihood Updates

**Associated measurement** (`sprt.rs:80-91`):

```
LLR += ln(P_D * L(z) / clutter_density)
```

Where `L(z)` is the Gaussian measurement likelihood and `clutter_density`
is the expected false alarm density.

**Missed detection** (`sprt.rs:94-103`):

```
LLR += ln(1 - P_D)
```

Always negative — pushes toward rejection.

### AVA.11.6.3 Domain-Specific Parameters

(`ava-fusion/src/track.rs:267-271`):

| Domain | alpha | beta | A (confirm) | B (reject) |
|--------|-------|------|-------------|------------|
| Maritime | 0.01 | 0.05 | ~4.55 | ~-2.99 |
| Aviation | 0.05 | 0.10 | ~2.89 | ~-2.25 |
| Cyber | 0.10 | 0.10 | ~2.20 | ~-2.20 |

**AVA.11-R10**: The `SprtConfig` MUST derive confirmation/rejection thresholds
from `alpha` and `beta` via `confirm_threshold()` and `reject_threshold()`
(`track.rs:283-291`).

---

## AVA.11.7 Coasting and Dead Reckoning

### AVA.11.7.1 Coast Configuration

Coasting is governed by per-entity-class parameters (`track.rs:226-251`):

```rust
pub struct CoastConfig {
    pub max_duration_s: f64,               // Drop when exceeded
    pub prediction_model: String,          // "kalman" or "linear"
    pub max_position_uncertainty_m: Option<f64>, // Drop when exceeded
}
```

Domain-specific limits (`track.rs:233-237`):

| Domain | max_duration_s | max_position_uncertainty_m |
|--------|---------------|---------------------------|
| Maritime | 1800 | 5000 |
| Aviation | 300 | 2000 |
| Ground | 600 | 1000 |

**AVA.11-R11**: A coasting track MUST be dropped when EITHER `max_duration_s`
OR `max_position_uncertainty_m` is exceeded. Uncertainty grows as
`sigma^2_x(T) ~ sigma^2_a * T^3/3` from process noise integration.

### AVA.11.7.2 Confidence Decay During Coast

Confidence decays by `coast_confidence_decay_per_scan` per missed scan
(`track.rs:331`). This is an external linear decay applied on top of
the Kalman-predicted covariance growth.

---

## AVA.11.8 Lifecycle Configuration

Per-entity-class lifecycle parameters are specified in
`TrackLifecycleConfig` (`track.rs:312-332`):

```rust
pub struct TrackLifecycleConfig {
    pub entity_class: String,
    pub confirmation_method: ConfirmationMethod,
    pub min_observations: Option<u32>,       // M in M-of-N
    pub min_confidence: Option<f64>,         // Score threshold
    pub coast: CoastConfig,
    pub coast_confidence_decay_per_scan: f64,
}
```

Four confirmation methods (`track.rs:193-209`):

| Method | Mechanism |
|--------|-----------|
| **ObservationCount** | M-of-N sliding window |
| **ConfidenceThreshold** | Score exceeds min_confidence |
| **Combined** | Both M-of-N AND score must be satisfied |
| **Sprt** | Wald's SPRT (consults SprtConfig) |

---

## AVA.11.9 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.11-R1 | Implementations MUST enforce the valid transition table | MUST |
| AVA.11-R2 | Lifecycle transitions MUST be published to NATS | MUST |
| AVA.11-R3 | All EKF models MUST share MAX_DIM=5 state vector | MUST |
| AVA.11-R4 | CT/CTRV MUST implement singularity guard for omega near zero | MUST |
| AVA.11-R5 | Joseph-form covariance update MUST be used (not simplified) | MUST |
| AVA.11-R6 | IMM model probabilities MUST sum to 1.0 after each step | MUST |
| AVA.11-R7 | Transition matrix rows MUST sum to 1.0 | MUST |
| AVA.11-R8 | CI MUST guarantee consistency (never overconfident) | MUST |
| AVA.11-R9 | CI MUST return None for singular covariance input | MUST |
| AVA.11-R10 | SPRT thresholds MUST be derived from alpha/beta parameters | MUST |
| AVA.11-R11 | Coasting track MUST be dropped when duration OR uncertainty exceeds limits | MUST |

---

## AVA.11.10 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [Wald 1947] Wald, A., "Sequential Analysis", John Wiley & Sons, 1947.
- [Bar-Shalom 2001] Bar-Shalom, Y., Li, X.R., Kirubarajan, T., "Estimation with Applications to Tracking and Navigation", Wiley, 2001.
- [Julier & Uhlmann 1997] Julier, S.J., Uhlmann, J.K., "A Non-divergent Estimation Algorithm in the Presence of Unknown Correlations", Proc. ACC, 1997.
- [Blom & Bar-Shalom 1988] Blom, H.A., Bar-Shalom, Y., "The Interacting Multiple Model Algorithm for Systems with Markovian Switching Coefficients", IEEE TAC, 1988.
- [ava-fusion track.rs] `ava-fusion/src/track.rs` — 5-state FSM, lifecycle types
- [ava-fusion-runtime ekf.rs] `ava-fusion-runtime/src/tracking/ekf.rs` — EKF with 3 motion models
- [ava-fusion-runtime imm.rs] `ava-fusion-runtime/src/tracking/imm.rs` — IMM 4-step cycle
- [ava-fusion-runtime fusion.rs] `ava-fusion-runtime/src/tracking/fusion.rs` — Covariance Intersection
- [ava-fusion-runtime sprt.rs] `ava-fusion-runtime/src/tracking/sprt.rs` — SPRT track confirmation

---

*End of section AVA.11*


---

# AVA.12 Complex Event Processing

```
Section:       AVA.12 — Complex Event Processing
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          III — Algorithms (Normative)
Prerequisites: AVA.11 (Tracking & State Estimation)
Feeds:         AVA.13 (Output Pipeline)
```

> This section specifies the Complex Event Processing (CEP) subsystem
> of the ava-fusion pipeline. It defines the NFA-SASE engine for temporal
> sequence pattern detection, the SharedBuffer arena for memory-efficient
> event storage, the predicate expression compiler with haversine distance
> support, three contiguity modes, and budget-based blowup defenses. The
> key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
> "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL"
> in this document are to be interpreted as described in [RFC2119] and
> [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava121-conventions-and-terminology)
2.  [Architecture Overview](#ava122-architecture-overview)
3.  [SharedBuffer Arena](#ava123-sharedbuffer-arena)
4.  [Predicate Expression Compiler](#ava124-predicate-expression-compiler)
5.  [NFA-SASE Engine](#ava125-nfa-sase-engine)
6.  [Contiguity Modes](#ava126-contiguity-modes)
7.  [Blowup Defenses](#ava127-blowup-defenses)
8.  [Multi-Pattern Coordinator](#ava128-multi-pattern-coordinator)
9.  [Pattern Matching Lifecycle](#ava129-pattern-matching-lifecycle)
10. [Normative Requirements Summary](#ava1210-normative-requirements-summary)
11. [References](#ava1211-references)

---

## AVA.12.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.12.1.1 Terminology

| Term | Definition |
|------|-----------|
| **NFA** | Nondeterministic Finite Automaton — state machine with multiple active states |
| **SASE** | Stream-based And Shared Execution — NFA variant for complex event processing |
| **SharedBuffer** | Arena-backed event storage where events are stored once and referenced by pointer |
| **EventRef** | 16-byte lightweight reference into the SharedBuffer (index + generation + timestamp) |
| **Partial match** | A `ComputationState` progressing through the NFA |
| **Contiguity** | Rule governing what happens when a non-matching event arrives |
| **Budget cap** | Maximum partial match count per NFA to bound memory |
| **Cross-step predicate** | A predicate referencing fields from multiple matched events |
| **Predicate pushdown** | Evaluating cross-step predicates as early as possible |

---

## AVA.12.2 Architecture Overview

The CEP subsystem comprises four layers
(`ava-fusion-runtime/src/cep/mod.rs:1-11`):

```
CepEngine (multi-pattern coordinator)
    |
    +-- NfaEngine (per-pattern NFA)
    |       |
    |       +-- SharedBuffer (arena event storage)
    |       +-- Compiled step predicates (Expr AST)
    |       +-- Compiled cross-step predicates (Expr + pushdown state)
    |
    +-- NfaEngine (per-pattern NFA)
            ...
```

- **SharedBuffer**: Events stored once; partial matches hold 16-byte refs
- **evaluator**: Predicate expression compiler (AST + recursive descent parser)
- **NfaEngine**: Per-pattern NFA with Strict/Relaxed/NonDeterministic contiguity
- **CepEngine**: Multi-pattern coordinator dispatching events to all active NFAs

---

## AVA.12.3 SharedBuffer Arena

### AVA.12.3.1 Design

Events are stored once in a contiguous arena. Partial NFA matches hold
lightweight `EventRef` copies instead of cloning full event data
(`ava-fusion-runtime/src/cep/shared_buffer.rs:1-12`):

```
Memory = N events * sizeof(EventData)
       + M partial matches * ~16 bytes (EventRef only)
```

This is Apache Flink's SharedBuffer insight adapted for in-process use.

### AVA.12.3.2 EventData

The canonical event record (`shared_buffer.rs:17-28`):

```rust
pub struct EventData {
    pub signal_kind: String,     // Source signal (e.g., "ais", "absence")
    pub entity_id: String,       // Entity this event belongs to
    pub timestamp: u64,          // Epoch milliseconds
    pub fields: Vec<(String, f64)>,  // Key-value payload
}
```

Field lookup by name returns `Option<f64>` (`shared_buffer.rs:32-34`).

### AVA.12.3.3 EventRef

16-byte lightweight reference with generation-based stale detection
(`shared_buffer.rs:42-53`):

```rust
pub struct EventRef {
    pub(crate) index: u32,       // Slot index (4 bytes)
    pub(crate) generation: u32,  // Stale detection (4 bytes)
    pub timestamp: u64,          // Cached for fast window checks (8 bytes)
}
```

**AVA.12-R1**: `EventRef` MUST be exactly 16 bytes, Copy, and trivially
cloneable. Validated by test `event_ref_is_copy_and_small`
(`shared_buffer.rs:282-291`).

### AVA.12.3.4 Arena Operations

| Operation | Complexity | Description |
|-----------|-----------|-------------|
| `insert(data)` | O(1) amortised | Returns EventRef; reuses free slots |
| `get(ref)` | O(1) | Returns `None` if generation mismatch (stale) |
| `evict_before(cutoff)` | O(N) | Removes events with `timestamp < cutoff` |
| `remove(ref)` | O(1) | Removes specific event by reference |

Slot reuse after eviction bumps the generation counter, invalidating all
outstanding `EventRef`s to that slot (`shared_buffer.rs:110-137`).

**AVA.12-R2**: After eviction, the `get()` method MUST return `None` for
any `EventRef` whose generation does not match the slot's current generation
(`shared_buffer.rs:140-147`).

---

## AVA.12.4 Predicate Expression Compiler

### AVA.12.4.1 Five AST Variants

The predicate compiler produces a typed AST with five node kinds
(`ava-fusion-runtime/src/cep/evaluator.rs:8-13`):

| Variant | Syntax Example | Description |
|---------|---------------|-------------|
| **Field** | `step_0.speed` | References a matched event's field |
| **Literal** | `1.0`, `-5.0` | Numeric constant |
| **BinOp** | `a < b`, `a + b` | Arithmetic or comparison |
| **FuncCall** | `haversine(...)`, `abs(x)` | Built-in function call |
| **Not** | `!(speed > 10)` | Logical negation |

```rust
pub enum Expr {
    Field(u32, String),         // (step_index, field_name)
    Literal(f64),
    BinOp(Box<Expr>, Op, Box<Expr>),
    FuncCall(String, Vec<Expr>),
    Not(Box<Expr>),
}
```

### AVA.12.4.2 Operator Precedence

The recursive descent parser (`evaluator.rs:349-498`) implements standard
precedence levels:

| Level | Operators | Associativity |
|-------|-----------|---------------|
| 1 (lowest) | `\|\|` | Left |
| 2 | `&&` | Left |
| 3 | `<`, `<=`, `>`, `>=`, `==`, `!=` | None |
| 4 | `+`, `-` | Left |
| 5 | `*`, `/` | Left |
| 6 (highest) | `!`, parentheses, atoms | Right (unary) |

### AVA.12.4.3 Built-in Functions

Five built-in functions are available (`evaluator.rs:162-174`):

| Function | Arity | Description |
|----------|-------|-------------|
| `abs(x)` | 1 | Absolute value |
| `min(a, b)` | 2 | Minimum of two values |
| `max(a, b)` | 2 | Maximum of two values |
| `sqrt(x)` | 1 | Square root |
| `haversine(lat1, lon1, lat2, lon2)` | 4 | Great-circle distance in meters |

### AVA.12.4.4 Haversine Distance

The haversine function computes great-circle distance using Earth
radius R = 6,371,000 m (`evaluator.rs:177-186`):

```rust
fn haversine_m(lat1: f64, lon1: f64, lat2: f64, lon2: f64) -> f64 {
    const R: f64 = 6_371_000.0;
    let d_lat = (lat2 - lat1).to_radians();
    let d_lon = (lon2 - lon1).to_radians();
    let a = (d_lat/2).sin()^2 + lat1_r.cos() * lat2_r.cos() * (d_lon/2).sin()^2;
    let c = 2.0 * a.sqrt().atan2((1.0 - a).sqrt());
    R * c
}
```

Validated by test `func_call_haversine`: London to Paris yields ~343 km
(`evaluator.rs:597-614`).

**AVA.12-R3**: The haversine function MUST accept arguments in decimal
degrees and return distance in meters.

### AVA.12.4.5 Cross-Step Field Access

Predicates can reference fields from different matched steps using
`step_N.field_name` syntax:

```
step_0.speed > step_2.speed
haversine(step_0.lat, step_0.lon, step_2.lat, step_2.lon) < 50000
```

### AVA.12.4.6 Predicate Pushdown

The `max_step_ref()` method computes the highest step index referenced
by an expression (`evaluator.rs:132-143`). Cross-step predicates are
evaluated as soon as their highest-referenced step is matched, pruning
infeasible partial matches early (`nfa.rs:102-112`).

**AVA.12-R4**: Implementations MUST evaluate cross-step predicates at the
earliest possible state (pushdown optimisation).

### AVA.12.4.7 Missing Fields and NaN Semantics

Missing fields return `f64::NAN` (`evaluator.rs:84`). NaN is falsy in
boolean context (`evaluator.rs:154-156`). Division by near-zero returns
NaN (`evaluator.rs:96-100`).

---

## AVA.12.5 NFA-SASE Engine

### AVA.12.5.1 Per-Pattern NFA

Each `SequencePattern` compiles to an `NfaEngine` where each step is an
NFA state (`ava-fusion-runtime/src/cep/nfa.rs:57-79`):

```rust
pub struct NfaEngine {
    pattern: SequencePattern,
    step_predicates: Vec<Option<Expr>>,       // Compiled per-step predicates
    cross_predicates: Vec<CompiledCrossPredicate>,
    active_states: Vec<ComputationState>,     // Active partial matches
    budget: usize,                            // Max partial matches
    buffer: SharedBuffer,                     // Per-engine event store
    completed: Vec<SequenceMatch>,
    events_processed: u64,
}
```

### AVA.12.5.2 ComputationState

A partial match in progress (`nfa.rs:31-38`):

```rust
struct ComputationState {
    current_state: usize,           // Next step to match
    matched_events: Vec<EventRef>,  // One EventRef per completed step
    start_time: u64,                // For window eviction
}
```

### AVA.12.5.3 Event Processing

`process_event()` (`nfa.rs:130-163`) executes the following per event:

1. Store event in SharedBuffer
2. Window eviction — drop partial matches older than `pattern.timeout_ms`
3. Try starting a new partial match at state 0
4. Advance all existing partial matches
5. Budget cap — oldest-first eviction if count exceeds limit
6. Return number of newly completed matches

**AVA.12-R5**: Implementations MUST process events in timestamp order
within a single NFA engine. Out-of-order events may produce incorrect
matches.

### AVA.12.5.4 Match Emission

When a partial match reaches the final state and passes all cross-step
predicates, a `SequenceMatch` is emitted (`nfa.rs:388-421`):

```rust
SequenceMatch {
    pattern_id: String,      // Source pattern ID
    entity_id: String,       // From first matched event
    matched_steps: Vec<u32>, // Step indices (0..N)
    start_ms: u64,           // First event timestamp
    end_ms: u64,             // Last event timestamp
    confidence: f64,         // 1.0 for complete matches
}
```

---

## AVA.12.6 Contiguity Modes

Three contiguity modes govern how non-matching events are handled
(`nfa.rs:339-348`):

### AVA.12.6.1 Strict Contiguity

If the next event does not match the expected step, the partial match
is **dropped** immediately (`nfa.rs:323-324`).

```
Pattern: AIS -> Absence
Events:  AIS, Radar, Absence
Result:  NO MATCH (Radar breaks strict contiguity)
```

Validated by test `strict_drops_on_non_match` (`nfa.rs:542-554`).

### AVA.12.6.2 Relaxed Contiguity

Non-matching events are **ignored**; the partial match continues waiting
(`nfa.rs:326-327`).

```
Pattern: AIS -> Absence
Events:  AIS, Radar, ADS-B, Absence
Result:  MATCH (unrelated events skipped)
```

This is the default contiguity mode. Validated by test
`relaxed_ignores_unrelated_events` (`nfa.rs:529-539`).

### AVA.12.6.3 Non-Deterministic Contiguity

On a matching event, the engine **forks**: one branch takes the match
(TAKE transition) and one branch keeps waiting (IGNORE fork)
(`nfa.rs:317-319`).

```
Pattern: AIS -> AIS (NonDeterministic)
Events:  AIS_1, AIS_2, AIS_3
Result:  Matches (AIS_1,AIS_2), (AIS_1,AIS_3), (AIS_2,AIS_3)
```

Validated by test `nondet_forks_on_match` (`nfa.rs:557-574`).

### AVA.12.6.4 Contiguity Resolution

Step-level contiguity overrides the pattern default. The effective
contiguity for step `i` is determined by step `i-1`'s contiguity field
(the transition INTO the current step) (`nfa.rs:339-348`).

**AVA.12-R6**: Implementations MUST support all three contiguity modes.
Step-level overrides MUST take precedence over the pattern-level default.

---

## AVA.12.7 Blowup Defenses

Three defenses prevent exponential blowup of partial matches
(`nfa.rs:7-11`):

### AVA.12.7.1 Window Eviction

Partial matches older than `pattern.timeout_ms` are evicted before
processing each event (`nfa.rs:138-140`):

```rust
self.active_states.retain(|s| {
    now.saturating_sub(s.start_time) <= self.pattern.timeout_ms
});
```

Validated by test `window_eviction_drops_old_matches` (`nfa.rs:655-668`).

### AVA.12.7.2 Budget Cap

When the partial match count exceeds `budget`, oldest-first eviction
is applied (`nfa.rs:157-160`):

```rust
if self.active_states.len() > self.budget {
    self.active_states.sort_by_key(|s| s.start_time);
    self.active_states.truncate(self.budget);
}
```

Default budget: 10,000 partial matches per NFA (`nfa.rs:22`).

**AVA.12-R7**: Implementations MUST enforce a budget cap on active partial
matches. The default MUST be 10,000.

Validated by test `budget_cap_evicts_oldest` (`nfa.rs:673-684`).

### AVA.12.7.3 SharedBuffer Event Storage

Events are stored once in the SharedBuffer. Partial matches hold only
16-byte `EventRef` values. This reduces memory from:

```
Without SharedBuffer: M partial matches * K events * sizeof(EventData)
With SharedBuffer:    N events * sizeof(EventData) + M * K * 16 bytes
```

**AVA.12-R8**: The SharedBuffer MUST support time-based eviction via
`evict_before(cutoff)`, returning the count of evicted events
(`shared_buffer.rs:152-166`).

---

## AVA.12.8 Multi-Pattern Coordinator

### AVA.12.8.1 CepEngine

The `CepEngine` manages a registry of compiled NFA engines
(`cep/mod.rs:30-107`):

```rust
pub struct CepEngine {
    engines: Vec<NfaEngine>,
}
```

### AVA.12.8.2 Pattern Registration

`register()` compiles a `SequencePattern` into an NFA. Only enabled
patterns are registered (`mod.rs:47-54`):

```rust
pub fn register(&mut self, pattern: SequencePattern) -> Result<(), String> {
    if !pattern.enabled { return Ok(()); }
    let engine = NfaEngine::new(pattern)?;
    self.engines.push(engine);
    Ok(())
}
```

**AVA.12-R9**: Disabled patterns (`.enabled = false`) MUST be silently
skipped during registration.

### AVA.12.8.3 Event Dispatch

`process_event()` clones the event to each registered NFA engine and
collects all completed matches (`mod.rs:73-84`):

```rust
pub fn process_event(&mut self, event: EventData) -> Vec<SequenceMatch> {
    let mut all_matches = Vec::new();
    for engine in &mut self.engines {
        let n = engine.process_event(event.clone());
        if n > 0 {
            all_matches.extend(engine.drain_completed());
        }
    }
    all_matches
}
```

### AVA.12.8.4 Global Eviction

`evict_all_before(cutoff)` propagates to all SharedBuffers
(`mod.rs:101-106`). SHOULD be called periodically to bound memory.

---

## AVA.12.9 Pattern Matching Lifecycle

### AVA.12.9.1 End-to-End Flow

```
1. Operator defines SequencePattern (steps, predicates, timeout)
2. CepEngine.register() compiles pattern -> NfaEngine
3. Events arrive via process_event()
4. NfaEngine:
   a. Window eviction on stale partial matches
   b. Try new match at state 0 (signal kind + step predicate)
   c. Advance existing partial matches (TAKE/IGNORE per contiguity)
   d. Pushdown cross-step predicate evaluation
   e. Budget cap enforcement
5. Complete matches -> SequenceMatch emitted
6. drain_completed() returns matches to consumer
```

### AVA.12.9.2 Example: AIS Dark Period Detection

```rust
SequencePattern {
    id: "ais-dark",
    steps: [
        SequenceStep { signal_kind: "ais", contiguity: Relaxed, .. },
        SequenceStep { signal_kind: "absence", contiguity: Relaxed, .. },
        SequenceStep { signal_kind: "ais", contiguity: Relaxed, .. },
    ],
    timeout_ms: 60_000,
    ..
}
```

Validated by test `three_step_ais_dark_period` (`nfa.rs:688-708`):

```
Events: AIS(t=1000) -> Absence(t=5000) -> AIS(t=10000)
Match:  pattern_id="ais-dark", start_ms=1000, end_ms=10000
```

### AVA.12.9.3 Example: Speed Anomaly with Cross-Step Predicate

```
steps: [AIS, Absence, AIS]
cross_predicate: "step_0.speed > step_2.speed"
```

Accepts when the vessel was faster before the gap than after. Validated
by tests `cross_step_predicate_acceptance` and
`cross_step_predicate_rejection` (`nfa.rs:603-651`).

**AVA.12-R10**: Cross-step predicates MUST be evaluated on complete matches
before emission. Partial match pushdown evaluation is an optimisation
that MUST NOT change the semantic result.

---

## AVA.12.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.12-R1 | EventRef MUST be exactly 16 bytes and Copy | MUST |
| AVA.12-R2 | SharedBuffer get() MUST return None for stale references | MUST |
| AVA.12-R3 | haversine() MUST accept degrees, return meters | MUST |
| AVA.12-R4 | Cross-step predicates MUST use pushdown evaluation | MUST |
| AVA.12-R5 | Events MUST be processed in timestamp order within an NFA | MUST |
| AVA.12-R6 | All three contiguity modes MUST be supported; step overrides pattern | MUST |
| AVA.12-R7 | Budget cap MUST be enforced; default 10,000 per NFA | MUST |
| AVA.12-R8 | SharedBuffer MUST support time-based eviction | MUST |
| AVA.12-R9 | Disabled patterns MUST be silently skipped | MUST |
| AVA.12-R10 | Cross-step predicates MUST be evaluated before match emission | MUST |

---

## AVA.12.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [SASE 2006] Wu, E., Diao, Y., Rizvi, S., "High-performance complex event processing over streams", Proc. SIGMOD, 2006.
- [Flink CEP] Apache Flink, "FlinkCEP - Complex event processing for Flink", https://nightlies.apache.org/flink/flink-docs-stable/docs/libs/cep/
- [ava-fusion-runtime nfa.rs] `ava-fusion-runtime/src/cep/nfa.rs` — NFA-SASE engine (777 lines)
- [ava-fusion-runtime shared_buffer.rs] `ava-fusion-runtime/src/cep/shared_buffer.rs` — SharedBuffer arena (328 lines)
- [ava-fusion-runtime evaluator.rs] `ava-fusion-runtime/src/cep/evaluator.rs` — Predicate AST + parser (753 lines)
- [ava-fusion-runtime mod.rs] `ava-fusion-runtime/src/cep/mod.rs` — CepEngine coordinator (219 lines)

---

*End of section AVA.12*


---


---

# PART IV: OUTPUT (Normative)

---

# AVA.13 Output & Alarm Pipeline

```
Section:       AVA.13 — Output & Alarm Pipeline
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          IV — Output (Normative)
Prerequisites: AVA.9 (Fusion Tiers), AVA.10 (Evidence Theory), AVA.11 (Tracking)
Feeds:         AVA.14 (Deployment Topology)
```

> This section specifies the output data types, severity lattice, risk
> accumulation pipeline, change-point detection, and alarm lifecycle for the
> ava-fusion pipeline. Every fused observation, correlated pair, and alarm
> notification produced by the pipeline flows through the structures defined
> here. The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT",
> "SHOULD", "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and
> "OPTIONAL" in this document are to be interpreted as described in [RFC2119]
> and [RFC8174].

---

## Table of Contents

1.  [Conventions and Terminology](#ava131-conventions-and-terminology)
2.  [Fusion Output Types](#ava132-fusion-output-types)
3.  [Severity Lattice](#ava133-severity-lattice)
4.  [Risk Accumulation](#ava134-risk-accumulation)
5.  [Temporal Decay Models](#ava135-temporal-decay-models)
6.  [CUSUM Change-Point Detection](#ava136-cusum-change-point-detection)
7.  [Alert Suppression](#ava137-alert-suppression)
8.  [Alarm Lifecycle](#ava138-alarm-lifecycle)
9.  [Absence Detection](#ava139-absence-detection)
10. [Normative Requirements Summary](#ava1310-normative-requirements-summary)
11. [References](#ava1311-references)

---

## AVA.13.1 Conventions and Terminology

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", "MAY", and "OPTIONAL" in this
section are to be interpreted as described in [RFC2119].

### AVA.13.1.1 Terminology

| Term | Definition |
|------|-----------|
| **FusedDatum** | A fused track output aggregating observations from multiple sources (`ava-fusion/src/output.rs:34`) |
| **CorrelatedPair** | Two related but distinct entities rendered as graph edges (`ava-fusion/src/output.rs:61`) |
| **FusionOutcome** | Four-valued severity lattice: Ok < Err < Cancelled < Panicked (`ava-fusion/src/output.rs:95`) |
| **NoisyOr** | Probabilistic risk accumulation: `P = 1 - PRODUCT(1 - s_i)` (`ava-fusion-runtime/src/risk/accumulation.rs:36`) |
| **CUSUM** | Cumulative Sum change-point detection (Page 1954) (`ava-fusion-runtime/src/risk/cusum.rs:41`) |
| **AlertSuppressor** | 4-layer filter preventing operator alert fatigue (`ava-fusion-runtime/src/risk/alert_suppression.rs:122`) |
| **AlarmEvaluator** | GenServer actor with obligation-tracked alarm lifecycle (`ava-fusion-runtime/src/actors/alarm_evaluator.rs:173`) |

---

## AVA.13.2 Fusion Output Types

### AVA.13.2.1 FusedDatum

The primary output of Tier 1 and Tier 2 fusion. Each `FusedDatum` represents
a single entity observation aggregated from multiple signal sources.

Source: `ava-fusion/src/output.rs:34-47`

```rust
pub struct FusedDatum {
    pub track_id: String,
    pub position: Option<GeoPoint>,
    pub timestamp_ms: u64,
    pub confidence: f64,              // 0.01-0.99
    pub contributing_sources: Vec<String>,
}
```

All fields MUST serialize to camelCase JSON. The `position` field MUST be
omitted from serialization when `None`. The `contributing_sources` field MUST
be omitted when empty (`ava-fusion/src/output.rs:45-46`).

**AVA.13-R1**: Every FusedDatum MUST include a `confidence` score in the range
[0.01, 0.99], computed from the contributing sources' individual confidence
values as specified in [AVA.10](rfc-section-evidence-theory.md).

### AVA.13.2.2 CorrelatedPair

Correlations between entities that are related but NOT the same. These
are rendered as edges in the visualization layer, distinct from merged
entities which share a single node.

Source: `ava-fusion/src/output.rs:61-70`

```rust
pub struct CorrelatedPair {
    pub left_source: String,
    pub right_source: String,
    pub correlation_score: f64,       // 0.0-1.0
    pub join_type: JoinType,
}
```

**AVA.13-R2**: CorrelatedPair MUST include the `JoinType` that produced the
correlation (Spatial, Temporal, Identity, or Behavioral), enabling downstream
consumers to filter by correlation mechanism.

---

## AVA.13.3 Severity Lattice

### AVA.13.3.1 FusionOutcome<T, E>

A serde-friendly mirror of `asupersync::Outcome<T, E>` providing a four-valued
severity lattice for all pipeline operations.

Source: `ava-fusion/src/output.rs:95-110`

```rust
pub enum FusionOutcome<T, E> {
    Ok(T),
    Err(E),
    Cancelled { reason: String },
    Panicked { message: String },
}
```

The ordering is monotone: `Ok(0) < Err(1) < Cancelled(2) < Panicked(3)`.
The worst outcome takes precedence in monotone aggregation
(`ava-fusion/src/output.rs:138-145`).

**AVA.13-R3**: FusionOutcome MUST serialize as internally tagged JSON using
`"status"` as the tag field and `"content"` as the content field. Example:
`{ "status": "cancelled", "content": { "reason": "timeout" } }`.

### AVA.13.3.2 FusionSeverity

Explicit severity ordering with derived `PartialOrd` and `Ord` implementations.

Source: `ava-fusion/src/output.rs:140-145`

```rust
pub enum FusionSeverity {
    Ok = 0,
    Err = 1,
    Cancelled = 2,
    Panicked = 3,
}
```

### AVA.13.3.3 Obligation Model

Resource obligations track lifecycle guarantees for pipeline operations.

Source: `ava-fusion/src/output.rs:158-201`

| Kind | Description |
|------|-----------|
| `SendPermit` | Channel send permit |
| `Ack` | Received message acknowledgment |
| `Lease` | Remote resource lease |
| `IoOp` | Pending I/O operation |

Lifecycle: `Reserved -> Committed | Aborted | Leaked`. The `Leaked` state
indicates an error where the obligation holder completed without resolution.

**AVA.13-R4**: All FusionObligationKind values MUST serialize in
`SCREAMING_SNAKE_CASE` (e.g., `"SEND_PERMIT"`, `"IO_OP"`).

---

## AVA.13.4 Risk Accumulation

### AVA.13.4.1 Risk Categories

Six risk categories with operator-tunable weights.

Source: `ava-fusion/src/risk.rs:29-78`

| Category | Code | Default Weight | Default TTL |
|----------|------|----------------|-------------|
| Identity | ID | 0.20 | 24h |
| Kinematic | KIN | 0.20 | 2h |
| Behavioral | BEH | 0.20 | 8h |
| Association | ASSOC | 0.15 | 4h |
| Signal | SIG | 0.15 | 12h |
| Intelligence | INTEL | 0.10 | 72h |

**AVA.13-R5**: Default category weights MUST sum to 1.0. This invariant is
verified by `risk_category_default_weights_sum` at `ava-fusion/src/risk.rs:417-419`.

### AVA.13.4.2 Leaky NoisyOr Accumulation

Risk indicators accumulate per-category using the Leaky NoisyOr model:

```
P(risk) = 1 - q0 * PRODUCT(1 - s_i)
```

Where `q0 = 1 - p_leak` is the background "no-cause" probability (default 0.95,
representing 5% background risk).

Source: `ava-fusion-runtime/src/risk/accumulation.rs:21-31`

```rust
pub fn leaky_noisy_or(scores: &[f64], q0: f64) -> f64 {
    if scores.is_empty() {
        return 1.0 - q0;
    }
    let product: f64 = scores.iter()
        .map(|&s| 1.0 - s.clamp(0.0, 1.0))
        .product();
    (1.0 - q0 * product).clamp(0.0, 1.0)
}
```

Properties: bounded [0, 1], commutative, diminishing returns.

### AVA.13.4.3 NoisyMAX Ordinal Classification

Applies Leaky NoisyOr independently at each severity threshold to classify
risk into ordinal levels: Low, Elevated, High, Severe, Critical.

Source: `ava-fusion-runtime/src/risk/accumulation.rs:74-94`

The classifier scans severity levels from highest to lowest. At each level,
only indicators whose severity floor is at or above the current level
contribute. The first level where `P(risk >= level) > decision_threshold`
is returned.

### AVA.13.4.4 Convergence Bonus

Multi-category corroboration is rewarded via a convergence bonus:

```
bonus = beta * (K/N)^gamma * (0.5 + 0.5 * H/H_max)
```

Where K = active categories, N = total categories (6), H = Shannon entropy
of normalized category scores, H_max = ln(K).

Source: `ava-fusion-runtime/src/risk/accumulation.rs:113-154`

Defaults: `beta = 0.3`, `gamma = 1.5`. A balanced 6-category alert yields
a full 0.3 bonus; a single category yields approximately 0.01.

### AVA.13.4.5 Composite Risk Score

The final composite risk combines weighted Leaky NoisyOr with convergence bonus:

Source: `ava-fusion-runtime/src/risk/accumulation.rs:169-191`

```rust
pub fn composite_risk(
    category_scores: &[(f64, f64)],  // (score, weight) per category
    q0: f64,
    beta: f64,
    gamma: f64,
) -> f64 {
    let weighted: Vec<f64> = category_scores.iter()
        .map(|&(score, weight)| (score * weight).clamp(0.0, 1.0))
        .collect();
    let base_risk = leaky_noisy_or(&weighted, q0);
    let bonus = convergence_bonus(&scores_only, 6, beta, gamma);
    (base_risk + bonus).clamp(0.0, 1.0)
}
```

**AVA.13-R6**: Composite risk MUST be clamped to [0.0, 1.0] after adding
the convergence bonus.

---

## AVA.13.5 Temporal Decay Models

### AVA.13.5.1 Decay Model Taxonomy

Four decay models are available, each suited to different indicator categories.

Source: `ava-fusion/src/risk.rs:227-302`

| Model | Formula | Use Case |
|-------|---------|----------|
| Weibull | `s(t) = s0 * exp(-(t/lambda)^k)` | Identity (k=1.0), Kinematic (k=0.7), Signal (k=1.5) |
| PowerLaw | `s(t) = s0 * (1 + t/tau)^(-alpha)` | Association, Intelligence (fat-tailed) |
| Exponential | `s(t) = s0 * exp(-ln(2) * t / half_life)` | Legacy backward-compatible |
| StepWithGrace | `s(t) = s0` for `t <= grace`, then exponential | Grace period before decay |

Recommended per-category models (`ava-fusion/src/risk.rs:217-223`):

| Category | Model | Parameters |
|----------|-------|-----------|
| Identity | Weibull | k=1.0, lambda=30 min |
| Kinematic | Weibull | k=0.7, lambda=5 min |
| Behavioral | Weibull | k=0.8, lambda=15 min |
| Signal | Weibull | k=1.5, lambda=10 min |
| Association | PowerLaw | tau=1 hr, alpha=0.8 |
| Intelligence | PowerLaw | tau=24 hr, alpha=0.5 |

### AVA.13.5.2 Decay and Eviction

Indicators below a minimum threshold are evicted after decay application.

Source: `ava-fusion-runtime/src/risk/decay.rs:45-64`

```rust
pub fn decay_and_evict(
    indicators: &[TimedScore],
    now_ms: f64,
    model: &DecayModel,
    min_score: f64,
) -> Vec<(usize, f64)>
```

**AVA.13-R7**: Indicators MUST be evicted when their decayed score falls below
`min_score` (default 0.01). Category-specific decay models MUST be applied
independently per category via `apply_category_decay`
(`ava-fusion-runtime/src/risk/decay.rs:76-98`).

---

## AVA.13.6 CUSUM Change-Point Detection

### AVA.13.6.1 Tabular CUSUM

Detects upward and downward shifts in risk score time series using
Page's (1954) tabular CUSUM algorithm.

Source: `ava-fusion-runtime/src/risk/cusum.rs:41-135`

```rust
pub struct CusumState {
    pub s_plus: f64,     // Upward cumulative sum
    pub s_minus: f64,    // Downward cumulative sum
    pub mu_0: f64,       // Baseline mean
    pub sigma: f64,      // Baseline std deviation
    pub k_factor: f64,   // Allowance factor (default 0.5)
    pub h_factor: f64,   // Decision threshold factor (default 5.0)
    pub count: u64,
}
```

Default ARL performance (k=0.5*sigma, h=5*sigma):
- ARL0 (false alarm interval): ~465 samples
- ARL1 (detect 1-sigma shift): ~13 samples

**AVA.13-R8**: CusumState MUST reset its cumulative sum to zero after each
detection event. Zero-sigma baselines MUST NOT trigger alarms.

### AVA.13.6.2 Welford Online Statistics

Baseline parameters for CUSUM are established via Welford's (1962) online
algorithm for numerically stable running mean and variance.

Source: `ava-fusion-runtime/src/risk/cusum.rs:146-197`

The `WelfordState::to_cusum()` bridge creates a CUSUM state initialized from
accumulated baseline statistics (`ava-fusion-runtime/src/risk/cusum.rs:188-191`).

---

## AVA.13.7 Alert Suppression

### AVA.13.7.1 Four-Layer Filter

Prevents operator alert fatigue via four sequential layers.

Source: `ava-fusion-runtime/src/risk/alert_suppression.rs:1-13`

| Layer | Mechanism | Default Config |
|-------|-----------|---------------|
| 1. Hysteresis | Deadband: enter at `score > threshold`, exit at `score < threshold - delta` | threshold=0.6, delta=0.09 |
| 2. Score-delta | Suppress unless `|score - last_alerted| > delta` | delta=0.15 |
| 3. Rate limiting | Token bucket: max N alerts per entity per window | capacity=3, window=1h |
| 4. Cooldown | Minimum interval between consecutive alerts | 30s |

### AVA.13.7.2 Suppression Verdicts

Source: `ava-fusion-runtime/src/risk/alert_suppression.rs:93-111`

```rust
pub enum SuppressionVerdict {
    Emit,
    SuppressedHysteresis,
    SuppressedScoreDelta,
    SuppressedRateLimit,
    SuppressedCooldown,
}
```

**AVA.13-R9**: The alert suppression filter MUST evaluate all four layers in
order. A verdict of `Emit` MUST consume one rate-limit token and update the
last-alert timestamp. Suppressed verdicts MUST NOT consume tokens. Each entity
MUST maintain independent suppression state.

### AVA.13.7.3 Configuration

Source: `ava-fusion-runtime/src/risk/alert_suppression.rs:23-54`

```rust
pub struct AlertSuppressionConfig {
    pub threshold: f64,         // 0.6
    pub hysteresis_delta: f64,  // 0.09
    pub score_delta: f64,       // 0.15
    pub bucket_capacity: u32,   // 3
    pub bucket_window_ms: u64,  // 3_600_000 (1h)
    pub cooldown_ms: u64,       // 30_000 (30s)
}
```

---

## AVA.13.8 Alarm Lifecycle

### AVA.13.8.1 AlarmEvaluator GenServer

The alarm lifecycle is modeled as an asupersync GenServer with
obligation-tracked acknowledgments.

Source: `ava-fusion-runtime/src/actors/alarm_evaluator.rs:173-385`

```
Alarm detected -> Reply<AlarmAck> issued (obligation reserved)
    |
    +-- Operator acknowledges -> reply.send(Ack)     (committed)
    +-- Operator shelves      -> reply.send(Shelved)  (committed)
    +-- Timeout/drop          -> PANIC (obligation leaked)
```

This maps alarm acknowledgments to asupersync's obligation model: dropping
a `Reply<AlarmAck>` token without sending constitutes an obligation leak,
caught by the Lab runtime's `ObligationLeakOracle`.

### AVA.13.8.2 Alarm Severity Levels (ISA/IEC 62682)

Source: `ava-fusion-runtime/src/actors/alarm_evaluator.rs:124-134`

| Level | Action Required |
|-------|----------------|
| Low | Informational, no operator action |
| Medium | Operator should investigate |
| High | Immediate operator action required |
| Critical | Safety-critical, auto-escalation |

### AVA.13.8.3 Alarm Conditions

Source: `ava-fusion-runtime/src/actors/alarm_evaluator.rs:112-121`

| Condition | Trigger |
|-----------|---------|
| ThresholdExceeded | `value > limit` |
| RateOfChange | Rate exceeds limit |
| SignalAbsent | Expected signal missing |
| AnomalyDetected | Statistical model detects anomaly |

**AVA.13-R10**: Every raised alarm MUST receive either an Acknowledge or
Shelve response. Alarms unresolved at actor shutdown MUST be logged as
obligation leaks with severity ERROR.

---

## AVA.13.9 Absence Detection

### AVA.13.9.1 AbsenceDetector GenServer

Timer-driven evaluation of expected signals. On each `EvaluationTick`, all
registered expectations are checked against their deadlines.

Source: `ava-fusion-runtime/src/actors/absence_detector.rs:138-402`

The detector maintains per-source state tracking:
- Source ID, signal kind, optional entity ID
- Deadline in milliseconds
- Last-seen timestamp
- Current absence state (boolean latch)

The `evaluate()` method (`absence_detector.rs:165-194`) transitions sources
to absent when `silence_duration > deadline`. Recovery is detected on the
subsequent tick when a fresh signal arrives.

**Virtual Time**: The detector uses `cx.timer_driver()` when available for
deterministic testing under LabRuntime, falling back to the message's
wall-clock timestamp (`absence_detector.rs:344-346`).

---

## AVA.13.10 Normative Requirements Summary

| ID | Requirement | Level |
|----|-------------|-------|
| AVA.13-R1 | FusedDatum MUST include confidence in [0.01, 0.99] | MUST |
| AVA.13-R2 | CorrelatedPair MUST include the producing JoinType | MUST |
| AVA.13-R3 | FusionOutcome MUST serialize as internally tagged JSON | MUST |
| AVA.13-R4 | FusionObligationKind MUST serialize in SCREAMING_SNAKE_CASE | MUST |
| AVA.13-R5 | Risk category default weights MUST sum to 1.0 | MUST |
| AVA.13-R6 | Composite risk score MUST be clamped to [0.0, 1.0] | MUST |
| AVA.13-R7 | Indicators MUST be evicted below min_score after decay | MUST |
| AVA.13-R8 | CUSUM MUST reset after detection; zero-sigma MUST NOT alarm | MUST |
| AVA.13-R9 | Alert suppression MUST evaluate 4 layers in order with independent per-entity state | MUST |
| AVA.13-R10 | Every raised alarm MUST be acknowledged or shelved; leaks MUST log ERROR | MUST |

---

## AVA.13.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [Page1954] Page, E.S., "Continuous Inspection Schemes", Biometrika, 41(1-2), 1954.
- [Welford1962] Welford, B.P., "Note on a method for calculating corrected sums of squares and products", Technometrics, 4(3), 1962.
- [ISA-18.2] ISA-18.2, "Management of Alarm Systems for the Process Industries", 2016.
- [IEC-62682] IEC 62682, "Management of alarm systems for the process industries", 2014.
- [TSGC-001] TSGC-001, "Fusion Ontology Types for Multi-Source Data Fusion", internal specification.
- [ava-fusion output.rs] `ava-fusion/src/output.rs` — FusedDatum, CorrelatedPair, FusionOutcome, severity lattice (422 lines, 16 tests)
- [ava-fusion risk.rs] `ava-fusion/src/risk.rs` — RiskCategory, DecayModel, EntityRiskProfile (703 lines, 25 tests)
- [ava-fusion-runtime accumulation.rs] `ava-fusion-runtime/src/risk/accumulation.rs` — Leaky NoisyOr, convergence bonus (375 lines, 19 tests)
- [ava-fusion-runtime cusum.rs] `ava-fusion-runtime/src/risk/cusum.rs` — CUSUM + Welford (382 lines, 14 tests)
- [ava-fusion-runtime decay.rs] `ava-fusion-runtime/src/risk/decay.rs` — Temporal decay application (289 lines, 11 tests)
- [ava-fusion-runtime alert_suppression.rs] `ava-fusion-runtime/src/risk/alert_suppression.rs` — 4-layer filter (506 lines, 17 tests)
- [ava-fusion-runtime alarm_evaluator.rs] `ava-fusion-runtime/src/actors/alarm_evaluator.rs` — GenServer alarm lifecycle (385 lines)
- [ava-fusion-runtime absence_detector.rs] `ava-fusion-runtime/src/actors/absence_detector.rs` — Timer-driven absence detection (402 lines)

---

*End of section AVA.13*


---

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


---


---

# PART V: VALIDATION (Informative)

---

# AVA.15 E2E Testing Strategy

```
Section:       AVA.15 — E2E Testing Strategy
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          V — Validation (Informative)
Prerequisites: AVA.1 through AVA.14
Feeds:         None (terminal section)
```

> This section describes the end-to-end testing strategy for the ava-fusion
> pipeline. As an **Informative** section (Part V — Validation), it documents
> testing patterns, coverage goals, and verification approaches without
> imposing normative requirements. Implementations SHOULD follow these
> guidelines to ensure system correctness. The key words "SHOULD",
> "SHOULD NOT", "RECOMMENDED", "NOT RECOMMENDED", and "MAY" in this document
> are to be interpreted as described in [RFC2119] and [RFC8174]. Normative
> "MUST" requirements are not used in this section.

---

## Table of Contents

1.  [Conventions and Terminology](#ava151-conventions-and-terminology)
2.  [Test Inventory](#ava152-test-inventory)
3.  [Unit Test Patterns](#ava153-unit-test-patterns)
4.  [Integration Test Patterns](#ava154-integration-test-patterns)
5.  [Property-Based Testing](#ava155-property-based-testing)
6.  [Deterministic Replay via Virtual Time](#ava156-deterministic-replay-via-virtual-time)
7.  [Test Fixtures and Data Generation](#ava157-test-fixtures-and-data-generation)
8.  [Coverage Strategy](#ava158-coverage-strategy)
9.  [Regression Testing](#ava159-regression-testing)
10. [Normative Requirements Summary](#ava1510-normative-requirements-summary)
11. [References](#ava1511-references)

---

## AVA.15.1 Conventions and Terminology

As an Informative section, this document uses SHOULD and RECOMMENDED rather
than MUST and REQUIRED. Implementations that deviate from these guidelines
SHOULD document the rationale for deviation.

### AVA.15.1.1 Terminology

| Term | Definition |
|------|-----------|
| **Unit Test** | Tests a single function or type in isolation, no I/O |
| **Integration Test** | Tests actor interaction or dataflow pipeline with mock infrastructure |
| **Property Test** | Randomized testing verifying algebraic invariants |
| **Virtual Time** | Deterministic time source from asupersync's LabRuntime |
| **Serde Roundtrip** | Serialize then deserialize, asserting equality |
| **ARL** | Average Run Length — number of samples between CUSUM alarms |
| **LabRuntime** | asupersync's deterministic testing runtime |
| **ObligationLeakOracle** | LabRuntime component that detects unresolved obligations |

---

## AVA.15.2 Test Inventory

### AVA.15.2.1 Test Counts by Module

The pipeline currently contains **550 unit tests** across two crates.

**ava-fusion** (types crate):

| Module | Tests | Description |
|--------|-------|-------------|
| `risk.rs` | 25 | Risk categories, decay models, entity risk profiles |
| `confidence.rs` | 25 | Confidence scoring and Bayesian fusion |
| `track.rs` | 22 | Track state, coasting, merge operations |
| `temporal.rs` | 19 | Temporal alignment and windowing |
| `tier3.rs` | 18 | Tier 3 analytical constructs |
| `output.rs` | 16 | FusedDatum, CorrelatedPair, FusionOutcome, severity |
| `absence.rs` | 15 | Absence schema types |
| `blocking.rs` | 15 | Blocking/deny-list schemas |
| `join_path.rs` | 13 | Join path definitions and versioning |
| `sequence.rs` | 12 | Sequence number handling |
| `calibration.rs` | 10 | Sensor calibration parameters |
| `entity.rs` | 10 | EntityClass variants and serde |
| `signal.rs` | 9 | SignalKind (20 variants) serde |
| `ids.rs` | 8 | Branded identifier types |
| `geo.rs` | 6 | GeoPoint and spatial primitives |
| `ontology.rs` | 6 | Ontology root types |
| **Subtotal** | **229** | |

**ava-fusion-runtime** (runtime crate):

| Module | Tests | Description |
|--------|-------|-------------|
| `dataflow/scoring.rs` | 31 | Differential dataflow scoring |
| `dataflow/blocking.rs` | 27 | Blocking/filtering in dataflow |
| `risk/accumulation.rs` | 19 | Leaky NoisyOr, convergence bonus |
| `cep/evaluator.rs` | 19 | Complex event processing evaluator |
| `signal/periodicity.rs` | 18 | FFT-based periodicity detection |
| `graph/triangle.rs` | 17 | Triangle counting in entity graphs |
| `risk/alert_suppression.rs` | 17 | 4-layer alert fatigue filter |
| `cep/nfa.rs` | 16 | NFA pattern matching |
| `tracking/ekf.rs` | 15 | Extended Kalman Filter |
| `dataflow/mod.rs` | 14 | Dataflow orchestration |
| `risk/cusum.rs` | 14 | CUSUM change-point detection |
| `nats_object.rs` | 13 | NATS Object Store |
| `risk/decay.rs` | 11 | Temporal decay application |
| `nats_kv.rs` | 11 | NATS KV Store |
| `tracking/sprt.rs` | 11 | Sequential Probability Ratio Test |
| `cep/shared_buffer.rs` | 9 | CEP shared buffer |
| `graph/louvain.rs` | 9 | Louvain community detection |
| `graph/pagerank.rs` | 9 | PageRank computation |
| `tracking/imm.rs` | 8 | Interacting Multiple Model filter |
| `tracking/fusion.rs` | 8 | Track fusion and merge |
| `convert.rs` | 20 | Type conversion mappings |
| `cep/mod.rs` | 5 | CEP module integration |
| **Subtotal** | **321** | |

### AVA.15.2.2 Test Distribution

```
Types crate (ava-fusion):      229 tests  (41.6%)
Runtime crate (ava-fusion-runtime): 321 tests  (58.4%)
─────────────────────────────────────────────────
Total:                          550 tests  (100%)
```

**AVA.15-R1**: Each module SHOULD maintain a minimum of 5 unit tests. Modules
with 0 tests (actor implementations, mod.rs re-exports) SHOULD be covered
by integration tests at the actor level.

---

## AVA.15.3 Unit Test Patterns

### AVA.15.3.1 Serde Roundtrip Tests

The most common pattern across both crates. Every type that crosses a
serialization boundary SHOULD have a roundtrip test.

Pattern:

```rust
#[test]
fn type_serde_roundtrip() {
    let value = MyType { /* ... */ };
    let json = serde_json::to_string(&value).unwrap();
    let parsed: MyType = serde_json::from_str(&json).unwrap();
    assert_eq!(parsed, value);
}
```

Example: `ava-fusion/src/output.rs:216-229` (FusedDatum roundtrip)

These tests verify:
- JSON field naming conventions (camelCase via `serde(rename_all)`)
- Optional field omission (`skip_serializing_if = "Option::is_none"`)
- Empty collection omission (`skip_serializing_if = "Vec::is_empty"`)
- Tagged enum serialization (internally tagged via `serde(tag, content)`)

### AVA.15.3.2 JSON Shape Tests

Verify specific JSON output format for TypeScript consumers.

```rust
#[test]
fn fusion_severity_json_shape() {
    let json = serde_json::to_string(&FusionSeverity::Panicked).unwrap();
    assert_eq!(json, "\"panicked\"");
}
```

Source: `ava-fusion/src/output.rs:370-373`

**AVA.15-R2**: All enum types consumed by TypeScript SHOULD have JSON shape
tests asserting the exact string representation.

### AVA.15.3.3 Invariant Tests

Verify algebraic properties that the domain model guarantees.

```rust
#[test]
fn risk_category_default_weights_sum() {
    let sum: f64 = RiskCategory::ALL.iter().map(|c| c.default_weight()).sum();
    assert!((sum - 1.0).abs() < 1e-10);
}
```

Source: `ava-fusion/src/risk.rs:417-419`

```rust
#[test]
fn fusion_severity_ordering() {
    assert!(FusionSeverity::Ok < FusionSeverity::Err);
    assert!(FusionSeverity::Err < FusionSeverity::Cancelled);
    assert!(FusionSeverity::Cancelled < FusionSeverity::Panicked);
}
```

Source: `ava-fusion/src/output.rs:348-352`

### AVA.15.3.4 Mathematical Correctness Tests

Numerical algorithms are verified against known analytical results.

```rust
#[test]
fn decay_model_exponential_half_life() {
    let model = DecayModel::Exponential { half_life_ms: 60_000.0 };
    let factor = model.factor(60_000.0);
    assert!((factor - 0.5).abs() < 1e-10);
}
```

Source: `ava-fusion/src/risk.rs:618-625`

```rust
#[test]
fn leaky_noisy_or_two_indicators() {
    // P = 1 - 0.95 * (1-0.5) * (1-0.3) = 0.6675
    let result = leaky_noisy_or(&[0.5, 0.3], 0.95);
    assert!((result - 0.6675).abs() < 1e-10);
}
```

Source: `ava-fusion-runtime/src/risk/accumulation.rs:218-222`

**AVA.15-R3**: Every mathematical function SHOULD have at least one test
with a hand-computed expected value, verified to at least 10 significant
digits (`1e-10` tolerance).

---

## AVA.15.4 Integration Test Patterns

### AVA.15.4.1 Alert Suppression Lifecycle

The `full_lifecycle` test verifies the complete 4-layer suppression pipeline
across multiple evaluation cycles.

Source: `ava-fusion-runtime/src/risk/alert_suppression.rs:411-463`

This test exercises:
1. First alert passing all layers (Emit)
2. Small score change suppressed by score-delta
3. Significant rise emitting second alert
4. Cooldown suppressing rapid follow-up
5. Post-cooldown emission
6. Token exhaustion triggering rate-limit suppression
7. Score drop below hysteresis exit threshold
8. Re-entry after token refill window

**AVA.15-R4**: Each multi-layer system SHOULD have at least one lifecycle
test that exercises every suppression verdict in a single test case.

### AVA.15.4.2 CUSUM Shift Detection

Tests verify that CUSUM detects shifts within expected sample bounds.

Source: `ava-fusion-runtime/src/risk/cusum.rs:272-289`

```rust
#[test]
fn cusum_detects_upward_shift() {
    let mut c = CusumState::new(0.5, 0.1);  // mu_0=0.5, sigma=0.1
    let mut detected = false;
    for i in 0..50 {
        if let Some(dir) = c.update(0.7) {   // 2-sigma shift
            assert_eq!(dir, TrendDirection::Rising);
            assert!(i < 10, "Should detect quickly");
            detected = true;
            break;
        }
    }
    assert!(detected);
}
```

### AVA.15.4.3 Category Decay Cross-Model Comparison

Verifies that different decay models produce the expected relative ordering.

Source: `ava-fusion-runtime/src/risk/decay.rs:252-275`

```rust
#[test]
fn category_decay_different_models() {
    let models = vec![
        weibull(30_000.0, 1.0),      // Identity
        weibull(5_000.0, 0.7),       // Kinematic (fast initial decay)
        power_law(3_600_000.0, 0.8), // Association (fat tail)
    ];
    // At t=30s: kinematic < identity < association
    assert!(kinematic_score < identity_score);
    assert!(association_score > identity_score);
}
```

---

## AVA.15.5 Property-Based Testing

### AVA.15.5.1 NoisyOr Properties

The NoisyOr accumulation has algebraic properties that are verifiable
via property-based tests:

| Property | Assertion |
|----------|-----------|
| Bounded | `0.0 <= noisy_or(scores) <= 1.0` for any scores in [0,1] |
| Monotone | Adding an indicator never decreases the result |
| Commutative | Order of indicators does not affect the result |
| Diminishing returns | Marginal increase decreases with additional indicators |
| Identity | `noisy_or([]) == 0.0` (standard) or `1 - q0` (leaky) |

Source: `ava-fusion-runtime/src/risk/accumulation.rs:240-249` (diminishing
returns test)

**AVA.15-R5**: Implementations SHOULD add property-based tests (e.g.,
`proptest` or `quickcheck`) for accumulation functions, verifying boundedness,
monotonicity, and commutativity across random inputs.

### AVA.15.5.2 DecayModel Properties

| Property | Assertion |
|----------|-----------|
| Identity at t=0 | `model.factor(0.0) == 1.0` for all models |
| Monotone decreasing | `factor(t1) >= factor(t2)` when `t1 < t2` |
| Bounded | `0.0 <= factor(t) <= 1.0` for all `t >= 0` |
| Exponential at k=1 | `Weibull(lambda, k=1) == Exponential(lambda)` |

Source: `ava-fusion-runtime/src/risk/decay.rs:129-141` (identity at t=0 for
all 4 models)

### AVA.15.5.3 FusionSeverity Properties

| Property | Assertion |
|----------|-----------|
| Total order | Transitivity: `Ok < Err < Cancelled < Panicked` |
| Exhaustive | 4 variants cover all possible outcomes |
| Deterministic | `outcome.severity()` is pure (no side effects) |

---

## AVA.15.6 Deterministic Replay via Virtual Time

### AVA.15.6.1 asupersync LabRuntime

The asupersync runtime provides a LabRuntime mode for deterministic testing:

- **Virtual time**: `cx.timer_driver()` returns a controllable time source
- **Deterministic randomness**: `cx.random_u64()` is seeded for reproducibility
- **Budget-bounded computation**: `Budget::MINIMAL` / `Budget::INFINITE`
- **ObligationLeakOracle**: Detects unresolved Reply tokens at shutdown

Source: `ava-fusion-runtime/src/actors/absence_detector.rs:344-346`

```rust
let eval_time_ms = cx.timer_driver()
    .map(|d| d.now().as_millis() as f64)
    .unwrap_or(current_time_ms);
```

**AVA.15-R6**: Actor tests SHOULD use LabRuntime with virtual time for
deterministic behavior. Tests SHOULD NOT depend on wall-clock timing.

### AVA.15.6.2 Obligation Leak Detection

The AlarmEvaluator's obligation model ensures that every raised alarm
receives a response. Under LabRuntime, the ObligationLeakOracle detects
any test scenario where an alarm obligation leaks.

Source: `ava-fusion-runtime/src/actors/alarm_evaluator.rs:362-370`

```rust
fn on_stop(&mut self, cx: &Cx) -> ... {
    if !self.active_alarms.is_empty() {
        tracing::error!(
            leaked_count = self.active_alarms.len(),
            "AlarmEvaluator stopped with unresolved alarm obligations!"
        );
    }
}
```

### AVA.15.6.3 Budget-Bounded Evaluation

The AbsenceDetector uses `cx.checkpoint_with()` to allow the supervisor
to cancel evaluation between ticks.

Source: `ava-fusion-runtime/src/actors/absence_detector.rs:330-339`

```rust
if cx.checkpoint_with(format!(
    "tick {} evaluating {} expectations",
    self.total_ticks, self.expectations.len()
)).is_err() {
    return Box::pin(async {});  // Cancelled by supervisor
}
```

**AVA.15-R7**: Actor evaluation loops SHOULD include checkpoint calls to
support budget-bounded cancellation. Tests SHOULD verify that cancellation
produces clean state (no partial updates).

---

## AVA.15.7 Test Fixtures and Data Generation

### AVA.15.7.1 Standard Test Values

Tests use consistent reference values for reproducibility:

| Value | Constant | Usage |
|-------|----------|-------|
| Timestamp | `1_700_000_000_000` (epoch ms) | All temporal tests |
| Position | `GeoPoint::new(33.748, -84.388)` | Atlanta, GA |
| Confidence | `0.85` | High-confidence reference |
| Baseline mu_0 | `0.5` | CUSUM baseline mean |
| Baseline sigma | `0.1` | CUSUM baseline std dev |
| Background leak | `0.05` (q0=0.95) | NoisyOr background risk |

### AVA.15.7.2 Helper Functions

Test modules define reusable helpers for constructing decay models:

Source: `ava-fusion-runtime/src/risk/decay.rs:108-125`

```rust
fn weibull(lambda_ms: f64, k: f64) -> DecayModel { ... }
fn power_law(tau_ms: f64, alpha: f64) -> DecayModel { ... }
fn exponential(half_life_ms: f64) -> DecayModel { ... }
fn step_with_grace(grace_ms: f64, half_life_ms: f64) -> DecayModel { ... }
```

**AVA.15-R8**: Test helper functions SHOULD be defined in `#[cfg(test)] mod tests`
blocks, not in production code. Helpers SHOULD have descriptive names matching
the domain vocabulary.

---

## AVA.15.8 Coverage Strategy

### AVA.15.8.1 Coverage by Module Category

| Category | Target | Current Approach |
|----------|--------|-----------------|
| Domain types (ava-fusion) | >90% line coverage | Serde roundtrip + JSON shape + invariant tests |
| Mathematical functions | 100% branch coverage | Analytical verification + boundary conditions |
| Risk pipeline | >85% line coverage | Lifecycle tests + edge cases |
| Actor GenServer handlers | >70% line coverage | LabRuntime integration tests |
| NATS infrastructure | >60% line coverage | Key validation + naming convention tests |
| Dataflow operators | >80% line coverage | Differential dataflow scoring + blocking tests |

### AVA.15.8.2 Boundary Conditions

Every numerical function SHOULD be tested at these boundaries:

| Boundary | Example |
|----------|---------|
| Empty input | `noisy_or(&[])`, `decay_and_evict(&[], ...)` |
| Single element | `noisy_or(&[0.5])`, `convergence_bonus(&[0.5], ...)` |
| Maximum | All categories active, all scores at 1.0 |
| Minimum | All scores at 0.0 or below eviction threshold |
| Zero parameters | `CusumState::new(0.5, 0.0)` (zero sigma) |
| Negative elapsed time | `model.factor(-100.0)` returns 1.0 |

Source: `ava-fusion-runtime/src/risk/cusum.rs:339-344` (zero sigma guard)

### AVA.15.8.3 Error Path Coverage

| Error Type | Test Pattern |
|-----------|-------------|
| `KvError::InvalidKey` | `validate_key("entity:pump001")` — colon rejected |
| `KvError::RevisionConflict` | Display formatting verification |
| `ObjectError::InvalidName` | Whitespace and wildcard rejection |
| `ObjectError::IntegrityError` | Size mismatch detection |

Source: `ava-fusion-runtime/src/nats_kv.rs:494-498` (colon rejection test)

**AVA.15-R9**: Every error variant SHOULD have at least one test that
triggers it, verifying both the error type and its `Display` output.

---

## AVA.15.9 Regression Testing

### AVA.15.9.1 Known Regression Guards

| Regression | Guard Test | Source |
|-----------|-----------|--------|
| NoisyOr diminishing returns violated | `noisy_or_diminishing_returns` | `accumulation.rs:240-249` |
| CUSUM false alarm on zero sigma | `cusum_zero_sigma_no_panic` | `cusum.rs:339-344` |
| Hysteresis deadband bypass | `hysteresis_stays_alarmed_in_deadband` | `alert_suppression.rs:287-298` |
| KV key with colons accepted | `validate_key_rejects_colons` | `nats_kv.rs:494-498` |
| Obligation state leaked silently | `on_stop` error log | `alarm_evaluator.rs:362-370` |
| Weibull k=1 diverges from exponential | `decay_model_weibull_k1_is_exponential` | `risk.rs:596-604` |

### AVA.15.9.2 Test Execution

All tests are runnable via standard Cargo:

```bash
# Run all workspace tests
cargo test --workspace

# Run tests for a specific crate
cargo test -p ava-fusion
cargo test -p ava-fusion-runtime

# Run tests for a specific module
cargo test -p ava-fusion-runtime risk::accumulation

# Run with output for debugging
cargo test -p ava-fusion-runtime -- --nocapture
```

**AVA.15-R10**: The complete test suite SHOULD execute in under 30 seconds
on a development workstation. Tests that require external services (NATS
server) SHOULD be gated behind a feature flag or `#[ignore]` attribute.

---

## AVA.15.10 Normative Requirements Summary

As an Informative section, these are RECOMMENDED practices, not mandatory
requirements.

| ID | Recommendation | Level |
|----|---------------|-------|
| AVA.15-R1 | Each module SHOULD maintain minimum 5 unit tests | SHOULD |
| AVA.15-R2 | Enum types consumed by TypeScript SHOULD have JSON shape tests | SHOULD |
| AVA.15-R3 | Mathematical functions SHOULD have hand-computed expected values | SHOULD |
| AVA.15-R4 | Multi-layer systems SHOULD have lifecycle tests covering all paths | SHOULD |
| AVA.15-R5 | Accumulation functions SHOULD have property-based tests | SHOULD |
| AVA.15-R6 | Actor tests SHOULD use LabRuntime with virtual time | SHOULD |
| AVA.15-R7 | Actor loops SHOULD include checkpoint calls for cancellation | SHOULD |
| AVA.15-R8 | Test helpers SHOULD be in `#[cfg(test)]` blocks only | SHOULD |
| AVA.15-R9 | Every error variant SHOULD have a triggering test | SHOULD |
| AVA.15-R10 | Full test suite SHOULD execute in under 30 seconds | SHOULD |

---

## AVA.15.11 References

- [RFC2119] Bradner, S., "Key words for use in RFCs to Indicate Requirement Levels", BCP 14, RFC 2119, March 1997.
- [RFC8174] Leiba, B., "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words", BCP 14, RFC 8174, May 2017.
- [proptest] https://github.com/proptest-rs/proptest — Property-based testing for Rust
- [quickcheck] https://github.com/BurntSushi/quickcheck — QuickCheck for Rust
- [cargo-tarpaulin] https://github.com/xd009642/tarpaulin — Code coverage for Cargo
- [asupersync LabRuntime] https://github.com/Dicklesworthstone/asupersync — Deterministic testing runtime
- [ava-fusion tests] `ava-fusion/src/` — 229 unit tests across 16 modules
- [ava-fusion-runtime tests] `ava-fusion-runtime/src/` — 321 unit tests across 22 modules

---

*End of section AVA.15*


---

# Appendix A — SignalKind Catalog

```
Section:       Appendix A — SignalKind Catalog
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          Appendices (Informative)
Prerequisites: AVA.2 (Signal Schema), AVA.3 (NATS Subject Taxonomy)
```

> This appendix provides the complete catalog of all 20 `SignalKind` variants
> defined in `ava-fusion/src/signal.rs`. Each variant represents a distinct data
> collection modality in the fusion ontology. Signal kinds determine valid join
> paths, NATS subject routing, and JetStream stream membership.

---

## Table of Contents

1. [Overview](#a1-overview)
2. [Kinetic Domain](#a2-kinetic-domain)
3. [RF/Signals Domain](#a3-rfsignals-domain)
4. [Cyber/Network Domain](#a4-cybernetwork-domain)
5. [OSINT/Social/Financial Domain](#a5-osintsocialfinancial-domain)
6. [GEOINT/HUMINT/MASINT Domain](#a6-geointhumintmasint-domain)
7. [Custom Domain](#a7-custom-domain)
8. [Data Type Classification](#a8-data-type-classification)

---

## A.1 Overview

The `SignalKind` enum (`ava-fusion/src/signal.rs:20-61`) defines 20 signal
source categories. Each variant is serialized as camelCase via
`#[serde(rename_all = "camelCase")]` and participates in the NATS subject
hierarchy as `sensor.{kind_lowercase}.{source}.{format}`
(see [AVA.3](rfc-section-nats-subject-taxonomy.md)).

All 20 variants are enumerated in `SignalKind::ALL`
(`ava-fusion/src/signal.rs:65-86`).

---

## A.2 Kinetic Domain

| # | Kind | Display Name | Serde Key | Description | Typical Update Rate | NATS Subject Prefix |
|---|------|-------------|-----------|-------------|--------------------|--------------------|
| 1 | `AdsB` | ADS-B | `adsB` | Automatic Dependent Surveillance -- Broadcast; aircraft transponder positions | Seconds (1-2s) | `sensor.adsb.>` |
| 2 | `Ais` | AIS | `ais` | Automatic Identification System; maritime vessel transponder | Seconds (2-30s) | `sensor.ais.>` |
| 3 | `Radar` | Radar | `radar` | Primary/secondary radar returns | Seconds (4-12s rotation) | `sensor.radar.>` |
| 4 | `Satellite` | Satellite | `satellite` | Satellite imagery or overhead sensor data | Minutes to Hours | `sensor.satellite.>` |

**JetStream Stream**: `SENSOR_KINETIC` (retention: Limits, max age: 24h).
See [AVA.3.7](rfc-section-nats-subject-taxonomy.md#ava37-jetstream-stream-mapping).

---

## A.3 RF/Signals Domain

| # | Kind | Display Name | Serde Key | Description | Typical Update Rate | NATS Subject Prefix |
|---|------|-------------|-----------|-------------|--------------------|--------------------|
| 5 | `RfBearing` | RF Bearing | `rfBearing` | RF direction-finding bearing measurement | Seconds | `sensor.rfbearing.>` |
| 6 | `Sdr` | SDR | `sdr` | Software-defined radio raw signal capture (IQ samples) | Seconds (continuous) | `sensor.sdr.>` |
| 7 | `Sigint` | SIGINT | `sigint` | Signals intelligence (general) | Minutes to Hours | `sensor.sigint.>` |
| 8 | `Elint` | ELINT | `elint` | Electronic intelligence; radar/nav signal characterization | Minutes | `sensor.elint.>` |
| 9 | `Comint` | COMINT | `comint` | Communications intelligence; intercepted comms metadata | Minutes | `sensor.comint.>` |

**JetStream Stream**: `SENSOR_RF` (retention: Limits, max age: 24h).
RF signal subjects carrying IQ sample references use the NATS Object Store
for actual sample data, with subject messages containing only metadata and
an object store reference key.

---

## A.4 Cyber/Network Domain

| # | Kind | Display Name | Serde Key | Description | Typical Update Rate | NATS Subject Prefix |
|---|------|-------------|-----------|-------------|--------------------|--------------------|
| 10 | `Http` | HTTP | `http` | HTTP/HTTPS request/response metadata and payloads | Seconds (continuous) | `sensor.http.>` |
| 11 | `Dns` | DNS | `dns` | DNS query/response records | Seconds (continuous) | `sensor.dns.>` |
| 12 | `Cyber` | Cyber | `cyber` | Cyber threat indicators (STIX CTI, IOCs, malware analysis) | Minutes to Daily | `sensor.cyber.>` |

**JetStream Stream**: `SENSOR_CYBER` (retention: Limits, max age: 72h).
STIX 2.1 bundles use format token `stix`; non-STIX threat feeds use `json`.

---

## A.5 OSINT/Social/Financial Domain

| # | Kind | Display Name | Serde Key | Description | Typical Update Rate | NATS Subject Prefix |
|---|------|-------------|-----------|-------------|--------------------|--------------------|
| 13 | `Osint` | OSINT | `osint` | Open-source intelligence (RSS, news, public records) | Minutes to Hourly | `sensor.osint.>` |
| 14 | `Social` | Social | `social` | Social media-derived signals (handles, posts, network graphs) | Seconds to Minutes | `sensor.social.>` |
| 15 | `Financial` | Financial | `financial` | Financial transaction and sanctions data | Daily to Hourly | `sensor.financial.>` |
| 16 | `Travel` | Travel | `travel` | Travel records (passenger manifests, border crossings) | Daily | `sensor.travel.>` |

**JetStream Stream**: `SENSOR_OSINT` (retention: Limits, max age: 72h).

---

## A.6 GEOINT/HUMINT/MASINT Domain

| # | Kind | Display Name | Serde Key | Description | Typical Update Rate | NATS Subject Prefix |
|---|------|-------------|-----------|-------------|--------------------|--------------------|
| 17 | `Geoint` | GEOINT | `geoint` | Geospatial intelligence (imagery analysis products) | Hourly to Daily | `sensor.geoint.>` |
| 18 | `Humint` | HUMINT | `humint` | Human intelligence reports | Daily (aperiodic) | `sensor.humint.>` |
| 19 | `Masint` | MASINT | `masint` | Measurement and signature intelligence | Minutes to Hourly | `sensor.masint.>` |

**JetStream Stream**: `SENSOR_GEO` (retention: Limits, max age: 168h).

---

## A.7 Custom Domain

| # | Kind | Display Name | Serde Key | Description | Typical Update Rate | NATS Subject Prefix |
|---|------|-------------|-----------|-------------|--------------------|--------------------|
| 20 | `Custom` | Custom | `custom` | Operator-defined custom signal kind | Varies | `sensor.custom.>` |

Custom signals follow the same 4-token `sensor.{kind}.{source}.{format}` pattern.
The `source` token identifies the operator or system that produces the data.

---

## A.8 Data Type Classification

Each signal source is classified as either `Event` (volatile, append-only,
timestamped) or `Reference` (stable, slowly-changing, lookup-keyed) per the
`DataType` enum (`ava-fusion/src/signal.rs:128-133`). This distinction
determines the differential-dataflow join strategy: event sources produce
differential streams while reference sources are materialized as arrangements
providing O(1) lookups per incoming event.

| DataType | Serde Key | Behavior | Example Kinds |
|----------|-----------|----------|---------------|
| `Event` | `event` | Volatile event stream (differential stream) | AdsB, Ais, Http, Dns, Social |
| `Reference` | `reference` | Stable reference/registry data (materialized arrangement) | Cyber (STIX feeds), Financial (OFAC), Geoint (static layers) |

The `UpdateRate` enum (`ava-fusion/src/signal.rs:152-163`) specifies reference
data refresh cadence:

| UpdateRate | Serde Key | Description |
|-----------|-----------|-------------|
| `Static` | `static` | Never changes after initial load |
| `Daily` | `daily` | Refreshed approximately once per day |
| `Hourly` | `hourly` | Refreshed approximately once per hour |
| `Minutes` | `minutes` | Refreshed every few minutes |
| `Seconds` | `seconds` | Refreshed every few seconds (high-rate reference stream) |

---

*Source: `ava-fusion/src/signal.rs` (337 lines). All variant names, serde keys,
and display strings extracted from source code.*

*End of Appendix A*


---

# Appendix B — EntityClass Catalog

```
Section:       Appendix B — EntityClass Catalog
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          Appendices (Informative)
Prerequisites: AVA.2 (Signal Schema), AVA.3 (NATS Subject Taxonomy)
```

> This appendix provides the complete catalog of all 10 `EntityClass` variants
> defined in `ava-fusion/src/entity.rs`. Each variant represents a distinct
> category of real-world object tracked by the fusion pipeline. Entity classes
> determine identifier namespaces, observable signal kinds, fusion output
> routing, and track lifecycle configuration.

---

## Table of Contents

1. [Overview](#b1-overview)
2. [Entity Class Table](#b2-entity-class-table)
3. [Identifier Namespaces](#b3-identifier-namespaces)
4. [Entity-Signal Observable Matrix](#b4-entity-signal-observable-matrix)
5. [EntityClassDef Registration Record](#b5-entityclassdef-registration-record)
6. [Fusion Output Routing](#b6-fusion-output-routing)

---

## B.1 Overview

The `EntityClass` enum (`ava-fusion/src/entity.rs:23-44`) defines 10 entity
categories. Each variant is serialized as camelCase via
`#[serde(rename_all = "camelCase")]`. All 10 variants are enumerated in
`EntityClass::ALL` (`ava-fusion/src/entity.rs:48-59`).

Each entity class maps to:
- A **primary identifier namespace** for Tier 1 hard-key fusion
- A **primary signal kind** (canonical observation source)
- A set of **supported signal kinds** (all sources that can observe the entity)

These mappings are declared via the `EntityClassDef` struct
(`ava-fusion/src/entity.rs:160-170`).

---

## B.2 Entity Class Table

| # | Class | Display Name | Serde Key | Primary ID | Description |
|---|-------|-------------|-----------|-----------|-------------|
| 1 | `Aircraft` | Aircraft | `aircraft` | ICAO 24-bit hex | Fixed-wing or rotary-wing aircraft |
| 2 | `Vessel` | Vessel | `vessel` | MMSI | Maritime vessel |
| 3 | `GroundVehicle` | Ground Vehicle | `groundVehicle` | License plate | Land-based vehicle |
| 4 | `RfEmitter` | RF Emitter | `rfEmitter` | Freq + location | Radio-frequency emitter characterized by frequency and location |
| 5 | `NetworkHost` | Network Host | `networkHost` | IP address | Network-connected host |
| 6 | `Domain` | Domain | `domain` | FQDN | DNS domain / fully-qualified domain name |
| 7 | `Person` | Person | `person` | Name / social handle | Human individual |
| 8 | `Organization` | Organization | `organization` | Name / LEI | Corporate or institutional entity |
| 9 | `Campaign` | Campaign | `campaign` | STIX ID | Adversary campaign (STIX 2.1) |
| 10 | `Facility` | Facility | `facility` | Geo + name | Physical installation |

Source: `ava-fusion/src/entity.rs:23-44` (enum definition),
`ava-fusion/src/entity.rs:62-77` (Display impl).

---

## B.3 Identifier Namespaces

The `IdentifierNamespace` enum (`ava-fusion/src/entity.rs:91-112`) defines
primary key systems for entity identification. Tier 1 (hard-key) joins operate
within a single namespace; cross-namespace joins require Tier 2 (soft-key) or
identity resolution.

| # | Namespace | Display Name | Serde Key | Primary For |
|---|-----------|-------------|-----------|-------------|
| 1 | `IcaoHex` | ICAO Hex | `icaoHex` | Aircraft |
| 2 | `Mmsi` | MMSI | `mmsi` | Vessel |
| 3 | `LicensePlate` | License Plate | `licensePlate` | GroundVehicle |
| 4 | `MacAddress` | MAC Address | `macAddress` | RfEmitter, NetworkHost |
| 5 | `IpAddress` | IP Address | `ipAddress` | NetworkHost |
| 6 | `DomainName` | Domain Name | `domainName` | Domain |
| 7 | `Imsi` | IMSI | `imsi` | Person, Device |
| 8 | `Imei` | IMEI | `imei` | Device |
| 9 | `SocialHandle` | Social Handle | `socialHandle` | Person |
| 10 | `Custom` | Custom | `custom` | Operator-defined |

Source: `ava-fusion/src/entity.rs:91-112`, `ava-fusion/src/entity.rs:130-143`.

---

## B.4 Entity-Signal Observable Matrix

This matrix maps each entity class to the signal kinds that can observe it.
The **primary signal** (bold) is the canonical observation source. Other
entries are supported signals that contribute to multi-source fusion.

| EntityClass | Primary Signal | Observable By |
|-------------|---------------|---------------|
| `Aircraft` | **AdsB** | AdsB, Radar, RfBearing, Satellite, Osint |
| `Vessel` | **Ais** | Ais, Radar, RfBearing, Satellite, Osint |
| `GroundVehicle` | **Radar** | Radar, Satellite, Geoint, Osint |
| `RfEmitter` | **RfBearing** | RfBearing, Sdr, Sigint, Elint |
| `NetworkHost` | **Http** | Http, Dns, Cyber |
| `Domain` | **Dns** | Dns, Http, Cyber, Osint |
| `Person` | **Osint** | Osint, Social, Financial, Travel, Humint |
| `Organization` | **Financial** | Financial, Osint, Cyber, Social |
| `Campaign` | **Cyber** | Cyber, Osint, Social, Sigint |
| `Facility` | **Geoint** | Geoint, Satellite, Masint, Osint, Humint |

The observable-by relationships define which `JoinPathEntryV2` combinations
are structurally valid. The join-path compiler validates that both left and
right signal kinds appear in the target entity class's supported signals list.

Source: Entity-signal relationships derived from `EntityClassDef` test
instances at `ava-fusion/src/entity.rs:249-271` (Aircraft),
`ava-fusion/src/entity.rs:276-291` (Vessel),
`ava-fusion/src/entity.rs:294-309` (NetworkHost).

---

## B.5 EntityClassDef Registration Record

The `EntityClassDef` struct (`ava-fusion/src/entity.rs:160-170`) is the
ontology registration record for each entity class. It binds the entity class
to its identifier namespace and signal capabilities.

```
EntityClassDef {
    entity_class:      EntityClass,           // serialized as "class"
    primary_namespace: IdentifierNamespace,   // serialized as "primaryNamespace"
    primary_signal:    SignalKind,            // serialized as "primarySignal"
    supported_signals: Vec<SignalKind>,       // serialized as "supportedSignals"
}
```

Notable serde behavior: the `entity_class` field is renamed to `"class"` via
`#[serde(rename = "class")]` (`ava-fusion/src/entity.rs:163`).

---

## B.6 Fusion Output Routing

Fusion results are routed by entity class on NATS subjects following the
pattern `fusion.{tier}.{entity_class}.results`
(see [AVA.3.4](rfc-section-nats-subject-taxonomy.md#ava34-fusion-output-subjects)).

| EntityClass | Tier 1 Subject | Tier 2 Subject | Tier 3 Subject |
|-------------|---------------|---------------|---------------|
| `Aircraft` | `fusion.tier1.aircraft.results` | `fusion.tier2.aircraft.results` | `fusion.tier3.aircraft.results` |
| `Vessel` | `fusion.tier1.vessel.results` | `fusion.tier2.vessel.results` | `fusion.tier3.vessel.results` |
| `GroundVehicle` | -- | `fusion.tier2.groundvehicle.results` | `fusion.tier3.groundvehicle.results` |
| `RfEmitter` | -- | `fusion.tier2.rfemitter.results` | `fusion.tier3.rfemitter.results` |
| `NetworkHost` | `fusion.tier1.networkhost.results` | `fusion.tier2.networkhost.results` | -- |
| `Domain` | `fusion.tier1.domain.results` | `fusion.tier2.domain.results` | -- |
| `Person` | -- | `fusion.tier2.person.results` | `fusion.tier3.person.results` |
| `Organization` | -- | `fusion.tier2.organization.results` | `fusion.tier3.organization.results` |
| `Campaign` | -- | -- | `fusion.tier3.campaign.results` |
| `Facility` | -- | `fusion.tier2.facility.results` | -- |

Track lifecycle events follow: `fusion.tracks.{entity_class}.{event}` where
`{event}` is one of `created`, `updated`, `merged`, `dropped`.

Alarm notifications follow: `alarm.{severity}.{entity_class}` where
`{severity}` is `critical`, `warning`, `info`, or `absence`.

---

*Source: `ava-fusion/src/entity.rs` (310 lines). All variant names, serde keys,
display strings, and structural relationships extracted from source code.*

*End of Appendix B*


---

# Appendix C — Data Source Catalog

```
Section:       Appendix C — Data Source Catalog
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          Appendices (Informative)
Prerequisites: AVA.3 (NATS Subject Taxonomy), AVA.4 (Source Adapters)
```

> This appendix catalogs the concrete data sources referenced in the ava-fusion
> codebase and NATS subject taxonomy. Sources are organized by SignalKind domain.
> Each entry includes the source name, type (API, file, stream), data format,
> update frequency, and the NATS subject it maps to. Reference data sources
> are registered via the `ReferenceSource` struct (`ava-fusion/src/signal.rs:190-205`).

---

## Table of Contents

1. [Overview](#c1-overview)
2. [Kinetic Domain Sources](#c2-kinetic-domain-sources)
3. [RF/Signals Domain Sources](#c3-rfsignals-domain-sources)
4. [Cyber/Network Domain Sources](#c4-cybernetwork-domain-sources)
5. [OSINT/Social/Financial Domain Sources](#c5-osintsocialfinancial-domain-sources)
6. [GEOINT/HUMINT/MASINT Domain Sources](#c6-geointhumintmasint-domain-sources)
7. [Reference Source Registration](#c7-reference-source-registration)
8. [Domain Research Catalogs](#c8-domain-research-catalogs)

---

## C.1 Overview

Data sources fall into two categories per the `DataType` enum
(`ava-fusion/src/signal.rs:128-133`):

- **Event sources**: Volatile, append-only, timestamped streams. Ingested as
  differential-dataflow collections.
- **Reference sources**: Stable, slowly-changing lookup data. Materialized as
  differential-dataflow arrangements for O(1) joins.

All source examples below are extracted from the NATS subject taxonomy
([AVA.3](rfc-section-nats-subject-taxonomy.md)) and the `ReferenceSource`
struct definition.

---

## C.2 Kinetic Domain Sources

### ADS-B (`sensor.adsb.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| OpenSky Network | API | JSON state vector | `sensor.adsb.opensky.json` | ~5s | Public ADS-B aggregator; REST + WebSocket |
| dump1090 | Stream | SBS-1 BaseStation | `sensor.adsb.dump1090.raw` | ~1s | Local RTL-SDR receiver; TCP port 30003 |
| ADSBexchange | API | JSON | `sensor.adsb.adsbx.json` | ~2s | Community-run ADS-B exchange |

### AIS (`sensor.ais.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| NOAA Marine Cadastre | File | CSV | `sensor.ais.noaa.csv` | Daily | Historical AIS bulk data |
| AISHub | Stream | NMEA | `sensor.ais.aishub.nmea` | ~2-30s | Real-time AIS sharing network |
| Global Fishing Watch | API | JSON | `sensor.ais.gfw.json` | Hourly | Fishing vessel tracking |

### Radar (`sensor.radar.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| FAA SWIM | API | JSON track data | `sensor.radar.swim.json` | ~4-12s | System Wide Information Management |
| NOAA NEXRAD | File | Level II binary | `sensor.radar.nexrad.raw` | ~5min | Weather radar (dual-use) |
| Synthetic | Generator | JSON | `sensor.radar.synthetic.json` | Configurable | Test data generator |

### Satellite (`sensor.satellite.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| Copernicus Sentinel-2 | File | GeoTIFF | `sensor.satellite.sentinel.geotiff` | ~5 days | ESA multispectral imagery |
| NASA FIRMS | API | JSON hotspots | `sensor.satellite.firms.json` | ~3h | Fire Information for Resource Management |
| USGS Landsat | API | JSON metadata | `sensor.satellite.landsat.json` | ~16 days | USGS Earth observation |

---

## C.3 RF/Signals Domain Sources

### RF Bearing (`sensor.rfbearing.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| KiwiSDR | API | JSON bearing | `sensor.rfbearing.kiwisdr.json` | Seconds | Web-based SDR with DF capability |
| Synthetic DF | Generator | JSON | `sensor.rfbearing.synthetic.json` | Configurable | Test direction-finding data |

### SDR (`sensor.sdr.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| GNU Radio | Stream | SigMF | `sensor.sdr.gnuradio.sigmf` | Continuous | SigMF metadata + IQ reference |
| RTL-SDR | Stream | IQ samples | `sensor.sdr.rtlsdr.iq` | Continuous | Raw IQ via Object Store |
| WebSDR | API | JSON spectrum | `sensor.sdr.websdr.json` | Seconds | Web-accessible SDR spectrum |

### SIGINT (`sensor.sigint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| FCC License DB | File/API | JSON | `sensor.sigint.fcc.json` | Daily (ref) | FCC ULS license database |
| ITU Frequency Allocations | File | JSON | `sensor.sigint.itu.json` | Static (ref) | ITU Radio Regulations |
| Synthetic | Generator | JSON | `sensor.sigint.synthetic.json` | Configurable | Generated intercept reports |

### ELINT (`sensor.elint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| EW Parameter DB | File | JSON | `sensor.elint.ewdb.json` | Static (ref) | Electronic warfare parameter database |
| Synthetic | Generator | JSON | `sensor.elint.synthetic.json` | Configurable | Generated emitter data |

### COMINT (`sensor.comint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| Synthetic | Generator | JSON | `sensor.comint.synthetic.json` | Configurable | Generated COMINT reports |

---

## C.4 Cyber/Network Domain Sources

### HTTP (`sensor.http.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| Zeek http.log | Stream | JSON | `sensor.http.zeek.json` | Continuous | Network security monitor |
| PCAP metadata | File | JSON | `sensor.http.pcap.json` | Batch | Parsed packet capture |
| CICIDS2017 | File | CSV | `sensor.http.cicids.csv` | Static (ref) | Intrusion detection dataset |

### DNS (`sensor.dns.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| Passive DNS | Stream | JSON | `sensor.dns.passive.json` | Continuous | Passive DNS collection |
| Zeek dns.log | Stream | JSON | `sensor.dns.zeek.json` | Continuous | DNS event logging |
| Tranco Top-1M | File | CSV | `sensor.dns.tranco.csv` | Daily (ref) | Domain popularity ranking |

### Cyber (`sensor.cyber.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| MITRE ATT&CK | API | STIX 2.1 | `sensor.cyber.mitre.stix` | Daily (ref) | Adversary TTPs |
| AlienVault OTX | API | JSON pulses | `sensor.cyber.otx.json` | Hourly | Open Threat Exchange |
| abuse.ch | API | JSON IOCs | `sensor.cyber.abusech.json` | Hourly | Malware/botnet trackers |
| CISA KEV | API | JSON | `sensor.cyber.cisa.json` | Daily (ref) | Known Exploited Vulnerabilities |
| MISP feeds | Stream | STIX 2.1 | `sensor.cyber.misp.stix` | Hourly | MISP community feeds |

---

## C.5 OSINT/Social/Financial Domain Sources

### OSINT (`sensor.osint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| GDELT Events | API | JSON | `sensor.osint.gdelt.json` | 15min | Global event monitoring |
| GDELT GKG | API | GKG format | `sensor.osint.gdelt.gkg` | 15min | Global Knowledge Graph |
| News RSS | Stream | RSS/XML | `sensor.osint.news.rss` | Minutes | RSS feed aggregation |
| Wayback Machine | API | JSON CDX | `sensor.osint.wayback.json` | On-demand | Internet Archive CDX API |

### Social (`sensor.social.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| Mastodon | API | JSON | `sensor.social.mastodon.json` | Continuous | Public timeline streaming |
| Bluesky (AT Protocol) | Stream | JSON | `sensor.social.bluesky.json` | Continuous | Firehose subscription |
| Reddit | API | JSON | `sensor.social.reddit.json` | Minutes | Subreddit monitoring |
| GitHub Events | API | JSON | `sensor.social.github.json` | Seconds | GitHub Events API |

### Financial (`sensor.financial.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| OFAC SDN | File | JSON | `sensor.financial.ofac.json` | Daily (ref) | Specially Designated Nationals |
| OpenSanctions | API | JSON | `sensor.financial.opensanctions.json` | Daily (ref) | Sanctions aggregator |
| GLEIF LEI | API | JSON | `sensor.financial.gleif.json` | Daily (ref) | Legal Entity Identifiers |
| SEC EDGAR | API | JSON | `sensor.financial.edgar.json` | Daily | SEC filings |

### Travel (`sensor.travel.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| Synthetic PNR | Generator | JSON | `sensor.travel.synthetic.json` | Configurable | Generated PNR records |
| OpenFlights | File | CSV | `sensor.travel.openflights.csv` | Static (ref) | Flight routes database |

---

## C.6 GEOINT/HUMINT/MASINT Domain Sources

### GEOINT (`sensor.geoint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| OpenStreetMap | File/API | GeoJSON | `sensor.geoint.osm.geojson` | Daily (ref) | Volunteered geographic data |
| NASA FIRMS | API | JSON | `sensor.geoint.firms.json` | ~3h | Fire hotspot detection |
| Sentinel Analysis | API | JSON | `sensor.geoint.sentinel.json` | ~5 days | Derived imagery products |
| GHSL | File | GeoTIFF | `sensor.geoint.ghsl.geotiff` | Static (ref) | Global Human Settlement Layer |

### HUMINT (`sensor.humint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| ACLED | API | JSON | `sensor.humint.acled.json` | Daily | Armed Conflict Location & Event Data |
| ReliefWeb | API | JSON | `sensor.humint.reliefweb.json` | Daily | UN OCHA humanitarian reports |
| Synthetic SALUTE | Generator | SALUTE format | `sensor.humint.synthetic.salute` | Configurable | SALUTE-formatted reports |

### MASINT (`sensor.masint.{source}.{fmt}`)

| Source Name | Type | Format | NATS Subject | Update Freq | Notes |
|-------------|------|--------|-------------|-------------|-------|
| USGS Earthquakes | API | JSON | `sensor.masint.usgs.json` | Minutes | USGS earthquake monitoring |
| NOAA Buoys | API | JSON | `sensor.masint.noaa.json` | Minutes | NOAA buoy measurements |
| EPA AirNow | API | JSON | `sensor.masint.epa.json` | Hourly | Air quality monitoring |
| CTBTO | Stream | JSON | `sensor.masint.ctbto.json` | Continuous | Seismic/radionuclide monitoring |

---

## C.7 Reference Source Registration

Reference data sources are registered in the fusion ontology via the
`ReferenceSource` struct (`ava-fusion/src/signal.rs:190-205`):

```
ReferenceSource {
    id:            String,        // Unique source identifier (e.g. "faa-registry")
    signal_kind:   String,        // Signal kind produced (e.g. "faa-db")
    entity_class:  String,        // Entity class described (e.g. "Aircraft")
    key_field:     String,        // Primary key for lookups (e.g. "icao_hex")
    update_rate:   UpdateRate,    // Refresh cadence
    nats_subject:  String,        // NATS subject pattern
    ttl_seconds:   f64,           // Time-to-live before staleness
}
```

Example registration from test (`ava-fusion/src/signal.rs:297-305`):

| Field | Value |
|-------|-------|
| `id` | `"faa-registry"` |
| `signal_kind` | `"faa-db"` |
| `entity_class` | `"Aircraft"` |
| `key_field` | `"icao_hex"` |
| `update_rate` | `Daily` |
| `nats_subject` | `"tsingou.ref.faa.*"` |
| `ttl_seconds` | `86400.0` (24h) |

---

## C.8 Domain Research Catalogs

Detailed per-domain data source specifications (API endpoints, authentication,
rate limits, data formats, and cross-correlation opportunities) are documented
in the research catalogs referenced from
[AVA.3.9](rfc-section-nats-subject-taxonomy.md#ava39-per-domain-subject-catalogs):

| Domain | Catalog Path | SignalKinds Covered |
|--------|-------------|---------------------|
| Kinetic | `docs/research/data-sources/kinetic-domain.md` | AdsB, Ais, Radar, Satellite |
| RF/Signals | `docs/research/data-sources/rf-signals-domain.md` | RfBearing, Sdr, Sigint, Elint, Comint |
| Cyber/Network | `docs/research/data-sources/cyber-network-domain.md` | Http, Dns, Cyber |
| OSINT/Social/Financial | `docs/research/data-sources/osint-social-financial-domain.md` | Osint, Social, Financial, Travel |
| GEOINT/HUMINT/MASINT | `docs/research/data-sources/geoint-humint-masint-domain.md` | Geoint, Humint, Masint |

---

*Source: `ava-fusion/src/signal.rs` (337 lines) for ReferenceSource and
DataType definitions; `rfc-section-nats-subject-taxonomy.md` for NATS subject
examples; domain research catalogs for extended source details.*

*End of Appendix C*


---

# Appendix D — Bibliography

```
Section:       Appendix D — Bibliography
Parent RFC:    AVA-RFC-001 (Ava Fusion Pipeline — Sensor Fusion Runtime)
Status:        DRAFT
Author:        Val (Vigilant Architecture Layer)
Created:       2026-02-20
Part:          Appendices (Informative)
```

> This appendix consolidates all academic references, standards, and technical
> specifications cited across the AVA-RFC-001 sections. Entries are grouped by
> category and numbered for cross-reference.

---

## Table of Contents

1. [Standards and RFCs](#d1-standards-and-rfcs)
2. [Academic Papers — Data Fusion & Differential Dataflow](#d2-academic-papers--data-fusion--differential-dataflow)
3. [Academic Papers — Evidence Theory & Confidence](#d3-academic-papers--evidence-theory--confidence)
4. [Academic Papers — Track Management & Detection](#d4-academic-papers--track-management--detection)
5. [Academic Papers — Multi-Level Fusion](#d5-academic-papers--multi-level-fusion)
6. [Software Libraries & Repositories](#d6-software-libraries--repositories)
7. [Data Standards & Specifications](#d7-data-standards--specifications)
8. [NATS Documentation](#d8-nats-documentation)

---

## D.1 Standards and RFCs

| # | Citation | Reference |
|---|----------|-----------|
| [1] | Bradner, S. (1997). "Key words for use in RFCs to Indicate Requirement Levels." BCP 14, RFC 2119, March 1997. | Normative language specification used throughout AVA-RFC-001. |
| [2] | Leiba, B. (2017). "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words." BCP 14, RFC 8174, May 2017. | Clarification of RFC 2119 key word interpretation. |
| [3] | ISA/IEC 62682. "Management of Alarm Systems for the Process Industries." | Referenced in alarm management architecture ([AVA.12](rfc-section-alarm-management.md)). |

Source: Referenced in [AVA.3.11](rfc-section-nats-subject-taxonomy.md#ava311-references).

---

## D.2 Academic Papers — Data Fusion & Differential Dataflow

| # | Citation | Relevance |
|---|----------|-----------|
| [4] | McSherry, F. (2013). "Differential Dataflow." *CIDR*. | Foundational paper for the `(data, time, diff)` tuple representation and incremental computation model. The ava-fusion dataflow engine is built on this model. All relational operators (join, reduce, iterate) are automatically incremental via differentiation/integration. Source: `docs/research/differential-dataflow-fusion-integration.md` Section 2.1. |
| [5] | Ngo, H.Q., Porat, E., Re, C., & Rudra, A. (2014). "Worst-Case Optimal Join Algorithms." *Proceedings of the 33rd ACM SIGMOD-SIGACT-SIGART Symposium on Principles of Database Systems (PODS)*. | Proved that traditional binary joins are suboptimal for cyclic queries. The LeapFrog TrieJoin achieves O~(\|D\| + \|Q(D)\|) complexity. Applied in Tier 2/3 multi-source fusion via `Plan::multiway_join` with delta queries per relation. Source: `docs/research/differential-dataflow-fusion-integration.md` Section 2.2. |
| [6] | Ngo, H.Q. (2018). "Worst-Case Optimal Join Algorithms: Techniques, Results, and Open Problems." *SIGMOD Record* 47(3). | Survey of WCOJ landscape post-2014. Confirms leapfrog trie join as the practical champion. Covers extensions to inequality joins. Source: `docs/research/differential-dataflow-fusion-integration.md` Section 2.2. |

---

## D.3 Academic Papers — Evidence Theory & Confidence

| # | Citation | Relevance |
|---|----------|-----------|
| [7] | Khan, N. & Anwar, S. (2019). "Modified Dempster-Shafer with entropy-based paradox elimination." *Sensors*. | Addresses Zadeh's paradox in standard Dempster-Shafer combination. Proposes entropy-based weighting: `w_i = 1 / (1 + H(m_i))` to discount conflicting evidence. Maps to a `map` operator before the `reduce` in the dataflow graph. Referenced in confidence scoring for the `DempsterShafer` model variant (`ava-fusion/src/confidence.rs`). Source: `docs/research/differential-dataflow-fusion-integration.md` Section 2.3. |
| [8] | Xiao, F. & Qin, Z. (2018). "Weighted Dempster-Shafer combination using cosine similarity of BPAs." *Sensors*. | Uses cosine similarity between Basic Probability Assignments (BPAs) to assign source weights. Sources with BPAs similar to the majority receive higher weights. Enables incremental re-weighting when source credibility changes. Source: `docs/research/differential-dataflow-fusion-integration.md` Section 2.3. |
| [9] | Smets, P. (1990). "The Transferable Belief Model." *Artificial Intelligence* 66(2), 191-234. | Introduced the un-normalized Dempster-Shafer variant (TBM) and the pignistic probability transform `BetP`. The `BasicProbabilityAssignment::pignistic_transform()` implementation (`ava-fusion/src/confidence.rs:299-328`) follows Smets' formulation: `BetP(H_i) = SUM_{A: H_i in A} m(A)/|A| * 1/(1-m(empty))`. |
| [10] | Smarandache, F. & Dezert, J. (2006). "Proportional Conflict Redistribution Rules (PCR)." *Advances and Applications of DSmT for Information Fusion*, Vol. 2. | Introduced PCR5: redistributes conflict mass proportionally to each source's commitment. Implemented as `DsCombinationRule::Pcr5` (`ava-fusion/src/confidence.rs:166-168`). Not associative for n>2 sources; requires Murphy's average BPA first. O(F^2) per pair where F = number of focal elements. |

---

## D.4 Academic Papers — Track Management & Detection

| # | Citation | Relevance |
|---|----------|-----------|
| [11] | Wald, A. (1947). *Sequential Analysis*. John Wiley & Sons, New York. | Foundation for the Sequential Probability Ratio Test (SPRT) used in track confirmation. The `SprtConfig` (`ava-fusion/src/track.rs:257-281`) implements Wald's thresholds: `A = ln((1-beta)/alpha)` (confirm), `B = ln(beta/(1-alpha))` (reject). Domain-specific alpha/beta values per entity class. |

---

## D.5 Academic Papers — Multi-Level Fusion

| # | Citation | Relevance |
|---|----------|-----------|
| [12] | Jiang, B., et al. (2009). "A Multi-Level Fusion Approach for Remote Sensing." *Sensors*. | Three fusion levels: pixel-level, feature-level, decision-level. The ava-fusion architecture operates at decision-level fusion: each sensor produces semantic outputs (entity identifiers, tracks, states), and the fusion engine correlates these decisions. Validates the tiered approach: Tier 1 (identity decisions), Tier 2 (correlation decisions), Tier 3 (pattern decisions). Source: `docs/research/differential-dataflow-fusion-integration.md` Section 2.4. |

---

## D.6 Software Libraries & Repositories

| # | Citation | Version | Relevance |
|---|----------|---------|-----------|
| [13] | `TimelyDataflow/differential-dataflow` | v0.18.0 | Rust library implementing differential dataflow. Core computational engine for the ava-fusion pipeline. Provides `Collection`, `InputSession`, `join`, `reduce`, `iterate`, `arrange_by_key`, `consolidate`, and `ProbeHandle`. Source: `docs/research/differential-dataflow-fusion-integration.md` Section 1.1. |
| [14] | `TimelyDataflow/timely-dataflow` | v0.25 | Underlying dataflow execution framework. Provides `Worker`, `Scope`, progress tracking, and the `step()`/`step_or_park()` execution model. |
| [15] | `Dicklesworthstone/asupersync` | v0.2.5 | Async supervision framework providing GenServer lifecycle, `spawn_blocking`, and `RuntimeBuilder`. Bridge between async GenServer and synchronous dataflow worker thread. Source: `docs/research/differential-dataflow-fusion-integration.md` Section 1.3. |

---

## D.7 Data Standards & Specifications

| # | Citation | Relevance |
|---|----------|-----------|
| [16] | OASIS. "STIX 2.1 — Structured Threat Information eXpression." | Standard for cyber threat intelligence exchange. Used for `Cyber` SignalKind data format (format token `stix`). Campaign entities use STIX IDs as primary identifiers. |
| [17] | IEEE/SigMF. "Signal Metadata Format (SigMF)." | Metadata standard for RF signal recordings. Used for `Sdr` SignalKind format (`sensor.sdr.{source}.sigmf`). |
| [18] | NMEA. "NMEA 0183 Standard for Interfacing Marine Electronic Devices." | Serial protocol for AIS data. Used for raw AIS ingestion (`sensor.ais.{source}.nmea`). |
| [19] | Uber H3. "H3: A Hexagonal Hierarchical Geospatial Indexing System." | Hierarchical hexagonal spatial index. Used for Tier 2 spatial blocking (`SpatialBlockConfig`) to reduce candidate join pairs. Resolution 8 cells (~4.6 km^2) provide ~1000-7000x reduction factor. |
| [20] | TSGC-001 / TSGC-001-v2. "Tsingou Fusion Ontology Specification." | Internal specification document. Defines SignalKind (Section 2), EntityClass (Section 2), JoinPath (Section 6), ReferenceSource (Section 5.4), Risk (Section 10), Track Lifecycle (Section 8), and R1-R9 requirements. |

---

## D.8 NATS Documentation

| # | Citation | Relevance |
|---|----------|-----------|
| [21] | NATS. "Subjects." https://docs.nats.io/nats-concepts/subjects | Subject syntax, wildcards (`*`, `>`), and dot-delimited hierarchy. All ava-fusion subjects conform to this specification. |
| [22] | NATS. "JetStream." https://docs.nats.io/nats-concepts/jetstream | Persistent message streaming. Seven JetStream streams capture all ava-fusion subjects with non-overlapping filters. |
| [23] | NATS. "Key-Value Store." https://docs.nats.io/nats-concepts/jetstream/key-value-store | KV buckets (`ava-config`, `ava-state`, `ava-metrics`, `ava-schemas`) store runtime configuration and entity state. Keys use dots as separators (colons are invalid in NATS KV). |

---

*Sources: `ava-fusion/src/confidence.rs` (652 lines), `ava-fusion/src/track.rs`
(683 lines), `ava-fusion/src/signal.rs` (337 lines),
`docs/research/differential-dataflow-fusion-integration.md` (457 lines).
All citations extracted from source code comments and research documents.*

*End of Appendix D*


---

