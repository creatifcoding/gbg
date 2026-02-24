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
