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
