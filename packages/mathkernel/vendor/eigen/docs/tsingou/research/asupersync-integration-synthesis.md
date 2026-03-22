# asupersync Integration Synthesis — Tsingou Platform

```
Document:   TSGC-RES-001 — asupersync Runtime Integration Analysis
Status:     COMPLETE
Created:    2026-02-20
Agents:     7 research agents (3 scouts + 4 team specialists)
Source:     https://github.com/Dicklesworthstone/asupersync (v0.2.5)
```

---

## Executive Summary

asupersync is a **spec-first, cancel-correct, capability-secure async runtime** for Rust that replaces tokio and provides vastly more structural guarantees. After deep analysis by 7 parallel research agents across the full source (~1,126 files), this document synthesizes findings into an actionable integration plan for Tsingou.

**Verdict: Adopt asupersync as runtime foundation.** The three-crate split (ADR-AVA-FUSION-001, Option C) preserves WASM compatibility while unlocking asupersync's structured concurrency, obligation tracking, and deterministic testing for the fusion pipeline.

### Key Numbers

| Metric | Value |
|--------|-------|
| asupersync modules analyzed | 40+ public modules |
| Domain types to implement | ~104 (ava-fusion) |
| Ecosystem gaps identified | 5 critical, 3 moderate |
| ADR options evaluated | 5 (A-E), Option C selected |
| Oracles for testing | 17 (6 non-negotiable invariants) |
| IIoT actors mapped | 6 SPORK GenServer actors |

---

## 1. asupersync Core Architecture

### 1.1 What It Replaces

| Current (tokio stack) | asupersync replacement | Structural improvement |
|----------------------|----------------------|----------------------|
| `tokio::spawn` | `Cx::spawn` (region-owned) | No orphan tasks — region close waits for all children |
| `tokio::select!` | `race` / `select` | Losers cancelled AND drained (no silent drops) |
| `tokio::join!` | `join` / `join_all` | No task abandoned |
| `Result<T,E>` | `Outcome<T,E>` | Four values: Ok/Err/Cancelled/Panicked with severity lattice |
| `Drop` (implicit) | Obligations (linear tokens) | Must commit or abort — panic on drop |
| Global runtime | `Cx` capability context | All effects through explicit capabilities; no ambient authority |
| `#[tokio::test]` | `LabRuntime` | Virtual time, deterministic scheduling, 17 oracles, DPOR |
| Tower middleware | Tower adapter + native | Interop boundary preserved |
| `async-nats` | `messaging::nats` | Pure Rust, cancel-correct at every I/O boundary |

### 1.2 Core Primitives

#### Cx (Capability Context)
- Carries: region ownership, budget, cancellation, IO/timer/entropy/remote/registry handles
- **CapSet** — ZST compile-time capability narrowing (SPAWN, TIME, RANDOM, IO, REMOTE)
- **SubsetOf** — sealed trait prevents capability widening at compile time
- **Macaroon tokens** — HMAC-SHA256 capability attenuation (scope, time, rate)

#### Outcome<T,E> — Severity Lattice
```
Ok(0) < Err(1) < Cancelled(2) < Panicked(3)
outcome_a.join(outcome_b) → worst wins
```

#### Obligations — Linear Resource Tokens
```
Reserved → Committed (effect took place)
    └──→ Aborted   (clean cancel)
    └──→ Leaked    (BUG: panic in lab, log+recover in prod)
```
`GradedObligation` is a drop-bomb: dropping without resolve/abort causes panic.

#### Budget — Sufficient Conditions
```rust
Budget { deadline: Time, poll_quota: u64, cost_quota: u64, priority: u8 }
```
Child budget ≤ parent budget (monotonically decreasing).

### 1.3 Concurrency Combinators

| Combinator | Semantics | Losers |
|-----------|-----------|--------|
| `join` / `join_all` | All complete | N/A |
| `race` / `race_all` | First wins | Cancelled AND drained |
| `quorum(M, N)` | M-of-N succeed | Drained |
| `hedge(primary, backup, delay)` | Latency hedging | Loser drained |
| `timeout(deadline)` | Deadline race | Absorbs: `timeout(d1,timeout(d2,f)) ≃ timeout(min,f)` |
| `retry(policy, f)` | Exponential backoff | Cancel-aware, budget-bounded |
| `circuit_breaker` | Closed/Open/HalfOpen | |
| `bulkhead` | Concurrency limit | |
| `rate_limit` | Token bucket | |
| `bracket` | Acquire/use/release | Release always runs |

**Critical invariant**: Losers in race/quorum/hedge are NEVER abandoned. Always cancelled then awaited.

---

## 2. SPORK Actor System → IIoT Actor Architecture

### 2.1 SPORK Primitives

**GenServer** — OTP-style actor with typed mailbox:
- `handle_call` — synchronous request/reply (obligation-tracked via `Reply<R>`)
- `handle_cast` — fire-and-forget
- `handle_info` — system messages (Down, Exit, Timeout)
- `on_start` / `on_stop` — lifecycle hooks with budgets

**Supervision** — OneForOne / OneForAll / RestForOne:
- RestartConfig: 3 restarts / 1 min window / exponential backoff (100ms → 10s)
- ChildSpec: dependency ordering, registration policy, required flag
- AppSpec: top-level application lifecycle (start/stop/join)

**Registry** — Name leases with obligation enforcement:
```
reserve_name() → NamePermit (reserved, not visible)
commit_permit() → NameLease (visible to whereis)
release() or abort() → obligation resolved
drop → PANIC
```

### 2.2 IIoT Actor Mapping

| IIoT Component | SPORK Actor | Supervision | Key Pattern |
|---------------|-------------|-------------|-------------|
| **SensorIngestor** | GenServer (per-source) | OneForOne (restart on NATS disconnect) | `handle_info` → NATS Subscription messages; `cast` → backpressure signal |
| **FusionEngine** | Supervised actor tree | OneForAll (correlated fusion must restart together) | Region-scoped: all join operators in one region; cancel propagates to all |
| **AlarmEvaluator** | GenServer + obligation | OneForOne | `Reply<AlarmAck>` = obligation token; alarm lifecycle = obligation lifecycle |
| **TrackManager** | Stateful GenServer | OneForOne (state persisted via JetStream) | Track lifecycle states (Tentative→Confirmed→Lost→Dropped) as actor state machine |
| **AbsenceDetector** | Timer-driven GenServer | OneForOne | `Budget` enforces detection deadline; `handle_info(Timeout)` triggers absence evaluation |
| **EntityResolver** | Service GenServer (singleton) | Restart(max 5) | `handle_call` for identity resolution; Cx.registry for named lookup |

### 2.3 Supervision Tree

```
AppSpec("tsingou-fusion")
├── ChildSpec("sensor-supervisor")     [OneForOne]
│   ├── SensorIngestor("adsb-feed")    [GenServer, restart on error]
│   ├── SensorIngestor("ais-feed")     [GenServer, restart on error]
│   ├── SensorIngestor("sdr-iq-feed")  [GenServer, restart on error]
│   └── SensorIngestor("osint-feed")   [GenServer, restart on error]
│
├── ChildSpec("fusion-supervisor")     [OneForAll]
│   ├── FusionEngine("tier1-hard-key") [region: hard-key joins]
│   ├── FusionEngine("tier2-soft-key") [region: probabilistic correlation]
│   └── FusionEngine("tier3-derived")  [region: statistical/behavioral, depends_on tier1+tier2]
│
├── ChildSpec("evaluation-supervisor") [OneForOne]
│   ├── AlarmEvaluator("isg-alarms")   [obligation-tracked ack/nack]
│   ├── TrackManager("all-tracks")     [stateful, JetStream-backed]
│   └── AbsenceDetector("esr-monitor") [timer-driven, budget-bounded]
│
└── ChildSpec("entity-resolver")       [Restart(max 5), singleton via registry]
```

### 2.4 Obligation Mapping — Alarm Lifecycle

The alarm lifecycle is a **natural fit** for obligation tokens:

```
Alarm detected → GradedObligation::reserve(Ack)    [alarm enters system]
                         │
    Operator acknowledges → obligation.resolve(Commit)  [ack recorded]
    Operator shelves      → obligation.resolve(Abort)   [shelved, audit trail]
    Timeout expires       → panic in lab / escalate in prod
                           (obligation dropped = unacknowledged alarm = BUG)
```

This turns "forgotten alarm acknowledgments" from a runtime bug into a compile-time-adjacent guarantee. The Lab runtime's `ObligationLeakOracle` catches any test scenario where an alarm obligation leaks.

---

## 3. Domain Type Mapping — Fusion Ontology → asupersync

### 3.1 Pure Data Types (stay in `ava-fusion`, no runtime dep)

These are structural types with serde serialization. They model **what things are**, not **what things do**.

| Category | Types | Count | Notes |
|----------|-------|-------|-------|
| **IDs** | EntityId, TrackId, SensorId, FusionPathId, AlarmId, ObservationId | 6 | Branded newtypes, `#[serde(transparent)]` |
| **Geo** | GeoPoint | 1 | `{ lat: f64, lon: f64 }` |
| **Signal** | SignalKind (20 variants), DataType, UpdateRate, ReferenceSource | 4 | Simple enums |
| **Entity** | EntityClass (10 variants), IdentifierNamespace, EntityClassDef, IdentityResolver types | 8 | ADT enums |
| **Confidence** | ConfidenceModel, PredicateWeights, CorrelationMatrix, DempsterShafer | 6 | Math config — pure data |
| **Calibration** | CalibrationPhase, CalibrationBin, CalibrationSnapshot | 5 | Config + state snapshots |
| **Temporal** | TemporalJoinMode, LateArrivalPolicy, WatermarkConfig, AllowedLateness | 9 | Stream processing config |
| **Blocking** | SpatialBlockConfig, TemporalBlockConfig, SpectralBlockConfig | 7 | Scalable join config |
| **Join Path** | JoinType, FusionTier, JoinPathEntry, JoinPathEntryV2 | 9 | Registry config |
| **Track** | TrackLifecycleState, LifecycleTransition, TrackLifecycleConfig | 5 | State machine config |
| **Absence** | AbsenceEvent, ExpectedSignalEntry, ESR types, DeadReckoning | 15 | Detection config |
| **Risk** | RiskCategory, RiskIndicator, EntityRiskProfile | 8 | Assessment config |
| **Tier3** | Tier3Method, Tier3Config, Periodicity/CoOccurrence/Community configs | 9 | Statistical method config |
| **Sequence** | SequencePattern, SequenceStep, CrossStepPredicate, Contiguity | 8 | Behavioral patterns |
| **Output** | FusedDatum, CorrelatedPair | 2 | Results |
| **Ontology** | FusionOntology (v1), FusionOntologyV2 | 2 | Root aggregators |
| **TOTAL** | | **~104** | All serde + typeshare, WASM-safe |

### 3.2 Behavioral Types (live in `ava-fusion-runtime`, require asupersync)

These model **what things do** and map to asupersync runtime primitives:

| Fusion Concept | asupersync Primitive | Behavioral Semantics |
|---------------|---------------------|---------------------|
| Fusion pipeline stage | **Region** (Cx scope) | Bounded lifetime; cancel propagates to all join operators within |
| Sensor connection | **GenServer** mailbox | NATS subscription → handle_info; backpressure via cast overflow policy |
| Alarm acknowledgment | **GradedObligation** (Ack kind) | Must commit (ack) or abort (shelve); leak = unhandled alarm |
| Track lifecycle | **GenServer state machine** | Tentative→Confirmed→Lost→Dropped as actor state transitions |
| Absence detection deadline | **Budget** (deadline + cost_quota) | Finite budget enforces "must detect within N ms" |
| Fusion confidence threshold | **Outcome<FusedDatum, FusionError>** | Four-valued: Ok(fused)/Err(below threshold)/Cancelled(timeout)/Panicked |
| Join operator | **race/join/quorum combinator** | Tier1 = join (all sources), Tier2 = quorum(M,N) (probabilistic) |
| Sensor failover | **Supervision (OneForOne)** | Auto-restart on NATS disconnect; exponential backoff |
| Correlated fusion restart | **Supervision (OneForAll)** | If one tier fails, restart all tiers (correlated state) |
| Entity name lookup | **NameRegistry** | Named lease for singleton entity resolver service |
| Data freshness guarantee | **Cx.checkpoint()** | Cancel-correct at every I/O boundary; stale data = cancel |
| Capability restriction | **Cx.restrict\<Caps\>()** | Sensor actors get IO+TIME; fusion engine gets SPAWN+TIME (no IO) |

### 3.3 FrankenSuite Types (vendor into `ava-fusion`)

From asupersync's WASM-safe sub-crates:

| Sub-crate | Types | Purpose in Fusion |
|-----------|-------|-------------------|
| `franken-kernel` | `TraceId`, `DecisionId`, `PolicyId` | Audit trail for fusion decisions |
| `franken-evidence` | `EvidenceEntry`, `EvidenceLedger` | Evidence chain for confidence justification |
| `franken-decision` | `DecisionContract`, `Verdict` | Operator override decisions with audit |

---

## 4. Ecosystem Gap Analysis

### 4.1 What asupersync Provides

| Capability | Status | API Maturity | Notes |
|-----------|--------|-------------|-------|
| **Async runtime** | Full | Production-ready | Three-lane scheduler (Cancel→Timed EDF→Ready) |
| **Structured concurrency** | Full | Production-ready | Regions, scopes, quiescence |
| **Cancel-correctness** | Full | Production-ready | Two-phase effects, obligation tokens |
| **Capability security** | Full | Production-ready | Cx + CapSet + SubsetOf + Macaroons |
| **OTP-style actors** | Full | Production-ready | GenServer, supervision, registry |
| **NATS client** | Substantial | JetStream support | Pub/sub, request/reply, queue groups |
| **JetStream** | Substantial | Streams + consumers | Create/publish/consume/ack, pull+push modes |
| **PostgreSQL client** | Present | Wire protocol | Native async, Cx-integrated |
| **SQLite** | Present | Blocking pool | Via rusqlite, async wrapper |
| **HTTP/1.1 server** | Present | Basic | Request routing, static files |
| **HTTP/2** | Present | For gRPC | Frame-level implementation |
| **WebSocket** | Present | RFC 6455 | Upgrade from HTTP, Cx-integrated |
| **gRPC** | Present | Unary + streaming | Protobuf codec, service traits |
| **TLS** | Present | rustls-based | Certificate pinning, SPKI extraction |
| **Redis client** | Present | RESP protocol | Basic commands |
| **Kafka producer** | Present | rdkafka wrapper | Feature-gated |
| **RaptorQ fountain coding** | Full | Unique to asupersync | Erasure coding for snapshot distribution |
| **Deterministic testing** | Full | Production-ready | Lab runtime, 17 oracles, DPOR, Foata |
| **E-graph plan optimization** | Full | Unique to asupersync | Combinator DAG rewriting |
| **Distributed primitives** | Present | Sagas, remote spawn | Consistent hashing, lease management |
| **Stream combinators** | Full | Rich API | map/filter/buffer/merge/zip/chunks + StreamExt |
| **Serialization** | Full | Multi-format | MessagePack, bincode, JSON |

### 4.2 Critical Gaps

| Gap | Severity | Tsingou Need | Mitigation |
|-----|----------|-------------|-----------|
| **Arrow / DataFusion** | CRITICAL | Columnar sensor data, SQL-over-streams | **Keep DataFusion as tokio sidecar** — bridge via channels at process boundary. asupersync cannot replace this (DataFusion is deeply coupled to tokio). |
| **NATS KV Store** | CRITICAL | UNS state (host metadata, config, entity state) | **Implement atop JetStream** — KV is JetStream + conventions (subject naming, watch semantics). ~500 lines of code. |
| **NATS Object Store** | HIGH | Blob storage (config snapshots, model weights) | **Implement atop JetStream** — chunked message storage pattern. ~300 lines. |
| **TimescaleDB extensions** | HIGH | Hypertable creation, continuous aggregates, time_bucket | **Use raw SQL via PostgreSQL client** — TimescaleDB is standard PostgreSQL wire protocol; just needs SQL extension commands. |
| **Protobuf codegen** | MODERATE | gRPC service definitions from .proto files | **Use prost + tonic-build** at build time; runtime uses asupersync's gRPC layer. |

### 4.3 Moderate Gaps

| Gap | Severity | Mitigation |
|-----|----------|-----------|
| **Time-windowed aggregation** | MODERATE | Build atop Stream combinators + Budget deadlines. `chunks(n)` + timer-driven flush. |
| **Watermark propagation** | MODERATE | Implement as GenServer actor that tracks per-source watermarks; emit via handle_info(Timeout). |
| **Connection pooling** | LOW | PostgreSQL client has basic pool; may need enhancement for high-throughput. |

### 4.4 The DataFusion Problem

This is the elephant in the room. DataFusion (v44) is:
- 300+ crate dependency tree
- Deeply coupled to tokio (`tokio::spawn`, `tokio::task::JoinHandle` throughout)
- Arrow's `RecordBatch` is the lingua franca for columnar data

**asupersync explicitly bans tokio from its core** ("Do not introduce another executor/runtime").

**Resolution: Process-boundary bridge.**

```
┌────────────────────────┐     ┌────────────────────────┐
│  asupersync process    │     │  tokio sidecar process  │
│                        │     │                         │
│  SensorIngestor ─────────────► DataFusion SQL engine   │
│  (NATS → readings)     │ IPC │  (Arrow RecordBatch)    │
│                        │     │                         │
│  FusionEngine ◄──────────────── Query results           │
│  (join + correlate)    │     │                         │
└────────────────────────┘     └────────────────────────┘

IPC options:
1. Unix domain socket (shared memory + zero-copy with Arrow IPC)
2. NATS (already in both processes)
3. gRPC (both have implementations)
```

This is NOT a compromise — it's the correct architecture. DataFusion is a query engine, not a runtime primitive. It belongs behind a service boundary.

---

## 5. Crate Architecture (ADR Summary)

**Decision: Option C — Three-Crate Split** (with Option E tactical add-on)

```
src-ava/
  ava-fusion/              ← NEW: Pure types (edition 2021, stable, WASM-safe)
    Cargo.toml               deps: serde, serde_json, typeshare, thiserror, franken-kernel
    src/
      lib.rs                 16 modules, glob re-exports
      ids.rs                 6 branded newtypes
      geo.rs                 GeoPoint
      signal.rs              SignalKind (20 variants), DataType, UpdateRate
      entity.rs              EntityClass (10), IdentifierNamespace, EntityClassDef
      confidence.rs          ConfidenceModel, PredicateWeights, CorrelationMatrix
      calibration.rs         CalibrationPhase, CalibrationBin, CalibrationSnapshot
      temporal.rs            TemporalJoinMode, LateArrivalPolicy, WatermarkConfig
      blocking.rs            SpatialBlockConfig, TemporalBlockConfig, SpectralBlockConfig
      join_path.rs           JoinType, FusionTier, JoinPathEntry, JoinPathEntryV2
      track.rs               TrackLifecycleState, LifecycleTransition
      absence.rs             AbsenceEvent, ExpectedSignalEntry, ESR, DeadReckoning
      risk.rs                RiskCategory, RiskIndicator, EntityRiskProfile
      tier3.rs               Tier3Method, configs (periodicity, co-occurrence, community)
      sequence.rs            SequencePattern, SequenceStep, CrossStepPredicate
      output.rs              FusedDatum, CorrelatedPair
      ontology.rs            FusionOntology, FusionOntologyV2

  ava-fusion-runtime/      ← NEW: Runtime integration (edition 2024, nightly)
    Cargo.toml               deps: ava-fusion, asupersync
    src/
      lib.rs
      convert.rs             From<FusionOutcome> for Outcome, Budget adapters
      actors/
        sensor_ingestor.rs   GenServer impl for NATS sensor ingestion
        fusion_engine.rs     Supervised actor tree for multi-tier fusion
        alarm_evaluator.rs   Obligation-tracked alarm lifecycle
        track_manager.rs     Stateful track lifecycle actor
        absence_detector.rs  Timer-driven absence detection
        entity_resolver.rs   Singleton identity resolution service
      pipeline.rs            Supervision tree setup (AppSpec)
      nats_kv.rs             KV store impl atop JetStream
      nats_object.rs         Object store impl atop JetStream

  ava-domain/              ← EXISTING: Unchanged
  ava-runtime/             ← EXISTING: Migrates to asupersync (future phase)
```

### Dependency Graph

```
ava-wasm ─────────► ava-fusion (pure)           ← WASM-safe boundary
ava-adapters ─────► ava-fusion (pure)
ava-api ──────────► ava-fusion-runtime ──► ava-fusion + asupersync
ava-runtime ──────► ava-fusion-runtime ──► ava-fusion + asupersync
                                    └──► DataFusion (tokio sidecar, separate process)
```

### Edition & Toolchain

| Crate | Edition | Toolchain | WASM |
|-------|---------|-----------|------|
| ava-fusion | 2021 | Stable | YES |
| ava-fusion-runtime | 2024 | Nightly | NO |
| ava-domain | 2021 | Stable | YES (except arrow) |
| asupersync | 2024 | Nightly | NO |

---

## 6. Deterministic Testing Strategy

### 6.1 Lab Runtime for Fusion Testing

asupersync's Lab runtime is a game-changer for testing sensor fusion:

```rust
// Test: sensor dropout during active fusion
let mut lab = LabRuntime::new(
    LabConfig::new(42)
        .with_light_chaos()      // 1% cancel, 5% delay
        .with_auto_advance()     // instant timeouts
);

// Spawn fusion pipeline
let app = AppSpec::new("fusion-test")
    .child(sensor_ingestor_spec("mock-adsb"))
    .child(sensor_ingestor_spec("mock-ais"))
    .child(fusion_engine_spec("tier2"))
    .child(absence_detector_spec())
    .start(&mut lab.state, &cx, root_region)?;

// Simulate sensor dropout
lab.advance_time(Duration::from_secs(30));
lab.inject_cancel(adsb_task_id);  // kill ADS-B feed

// Run to quiescence — absence detector should fire
lab.run_until_quiescent();

// Verify via oracles
let report = OracleSuite::new().report(lab.now());
assert!(report.all_passed());        // no leaked tasks/obligations
assert!(lab.evidence_sink.has_entry("absence_detected")); // absence was caught
```

### 6.2 Oracle Coverage for Fusion Invariants

| Oracle | Fusion Invariant It Verifies |
|--------|------------------------------|
| `TaskLeakOracle` | Every fusion sub-pipeline cleaned up on shutdown |
| `QuiescenceOracle` | Region close = all join operators finished |
| `CancellationProtocolOracle` | Sensor dropout → proper drain of in-flight fusions |
| `LoserDrainOracle` | race/quorum losers in tiered fusion properly cleaned |
| `ObligationLeakOracle` | **Every alarm ack/nack obligation resolved** |
| `AmbientAuthorityOracle` | No sensor actor accesses IO without Cx capability |
| `SupervisionOracle` | Restart policies enforced under chaos injection |
| `MailboxOracle` | GenServer mailboxes drained before actor stop |
| `RegistryLeaseOracle` | Entity resolver name lease properly released |
| `ReplyLinearityOracle` | Every GenServer call gets exactly one reply |

### 6.3 DPOR for Concurrency Bugs

```rust
let report = ScheduleExplorer::new(ExplorerConfig::new(0, 100))
    .explore(|seed| {
        let mut lab = LabRuntime::new(LabConfig::new(seed));
        // ... set up fusion pipeline with 3 concurrent sensors
        lab.run_until_quiescent();
    });

assert!(report.violations.is_empty());
println!("Explored {} unique schedule classes", report.unique_classes);
```

---

## 7. Migration Roadmap

### Phase 0: Foundation (Current)
- [x] Clone and analyze asupersync
- [x] ADR: Crate boundaries decided (Option C)
- [x] Domain mapping complete
- [x] Gap analysis complete

### Phase 1: ava-fusion (Pure Types)
- [ ] Create `src-ava/ava-fusion/` crate scaffold
- [ ] Implement 16 modules, ~104 types
- [ ] Serde roundtrip tests per module
- [ ] Verify `cargo check -p ava-fusion` (stable toolchain)
- [ ] Verify typeshare TypeScript generation
- **No asupersync dependency. No nightly. WASM-safe.**

### Phase 2: ava-fusion-runtime (Actor Shell)
- [ ] Create `src-ava/ava-fusion-runtime/` crate scaffold
- [ ] Implement `convert.rs` (FusionOutcome ↔ Outcome bridge)
- [ ] Implement SensorIngestor GenServer (NATS → readings)
- [ ] Implement FusionEngine actor tree (tier1 hard-key joins)
- [ ] Implement AlarmEvaluator with obligation lifecycle
- [ ] Wire supervision tree (AppSpec)
- **Requires nightly toolchain for asupersync dependency.**

### Phase 3: NATS KV/Object Store
- [ ] Implement KV store atop JetStream (subject conventions)
- [ ] Implement Object Store atop JetStream (chunked blobs)
- [ ] Migrate UNS state from async-nats to asupersync NATS client
- **Critical for Tsingou UNS architecture.**

### Phase 4: DataFusion Sidecar
- [ ] Design IPC bridge (Unix socket + Arrow IPC recommended)
- [ ] Implement asupersync ↔ tokio process boundary
- [ ] Migrate SQL-over-streams queries to sidecar
- **Preserves DataFusion's tokio dependency without infecting asupersync.**

### Phase 5: Full Migration
- [ ] Migrate ava-runtime from tokio to asupersync
- [ ] Migrate HTTP layer from axum to asupersync web
- [ ] Migrate gRPC from tonic to asupersync gRPC
- [ ] Decommission tokio dependency (except DataFusion sidecar)

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| asupersync API instability (v0.2.5) | 40% | HIGH | Pin version, vendor if needed. Core types (Outcome, Cx) are marked for stabilization. |
| Nightly Rust breakage | 30% | MEDIUM | Nightly is confined to ava-fusion-runtime. CI pins toolchain date. |
| DataFusion IPC overhead | 20% | MEDIUM | Arrow IPC over Unix sockets is near zero-copy. Benchmark Phase 4 early. |
| NATS KV implementation gaps | 25% | MEDIUM | JetStream foundation is solid. KV is well-documented protocol. ~500 lines. |
| Edition 2024 interop issues | 10% | LOW | Cargo handles mixed editions. Tested in asupersync's own workspace. |

---

## 9. References

- **ADR-AVA-FUSION-001**: `docs/tsingou/adr/ADR-AVA-FUSION-CRATE-BOUNDARIES.md`
- **TSGC-001**: `docs/tsingou/concepts/fusion-ontology.md`
- **TSGC-001-v2**: `docs/tsingou/concepts/fusion-ontology-v2-amendments.md`
- **asupersync source**: `/tmp/asupersync/` (v0.2.5, cloned 2026-02-20)
- **asupersync README**: `/tmp/asupersync/README.md` (1,243 lines, ecosystem coverage map)
- **Scout reports**: `.claude/cache/agents/scout/latest-output.md`
