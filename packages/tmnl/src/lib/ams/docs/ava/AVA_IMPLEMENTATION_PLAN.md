# AVA Implementation Plan

**EPOCH**: 2025-12-11
**Mode**: EDIN (Experiment → Design → Implement → Negotiate)
**Focus**: Rust library implementing AVA modality runtime

---

## Executive Summary

AVA (Asset View Agent) is a **design modality** where the central abstraction is an intelligent agent that continuously designs, compiles, and governs real-time views over assets. This plan outlines the implementation of the **AVA Rust runtime** — the machinery that enables this modality.

### Core Insight

> You design view agents, not pages or services.

For each domain slice (WMS, TMS, AMS), you define AVA variants (`TruckAVA`, `RackAVA`, `SiteAVA`) with:
- Known assemblages (view filter predicates)
- Known view families (admissible view configurations)
- Known beads (reusable micro-patterns)

---

## 1. AVA Modality Primitives

| Primitive | Definition | Rust Representation |
|-----------|------------|---------------------|
| **Asset** | The thing in the world (truck, pallet, machine) | External — lives in AMS (TypeScript) |
| **Assemblage** | View filter predicate — gates which views apply | `AssemblageSpec` struct with predicates |
| **View** | Composable data lens over multiple sources | `ViewProfileSpec` + `ChannelPipelineSpec` |
| **Artifact** | Concrete view instance at logical version | `ViewArtifact` with channels + metadata |
| **Channel** | Data pathway: STATE, EVENT, METRIC, COMMAND, LOG | `ChannelRole` enum + `ChannelSpec` |
| **Agent (AVA)** | Entity that designs, compiles, governs views | `AvaAgent` orchestrator |
| **Bead** | Reusable micro-pattern (data + code + doc) | `BeadSpec` — design-time artifact |

---

## 2. The AVA Design Loop

The runtime must support this continuous loop:

```
┌─────────────────────────────────────────────────────────────────┐
│                     AVA DESIGN LOOP                              │
│                                                                  │
│   1. SENSE                                                       │
│      │ What assets exist? In which assemblages?                  │
│      │ For which operators/workflows/UIs?                        │
│      ▼                                                           │
│   2. PROPOSE                                                     │
│      │ Define ViewFamilies per assemblage + context              │
│      │ e.g., "wms:truck", "tms:truck", "infra:rack"              │
│      ▼                                                           │
│   3. SPECIFY                                                     │
│      │ Define view SPACE (constraints), not fixed views          │
│      │ Legal sources, channels, operators, cost envelope         │
│      ▼                                                           │
│   4. EXPLORE                                                     │
│      │ AVA chooses configuration within space                    │
│      │ Based on intent: "more latency-sensitive telemetry"       │
│      ▼                                                           │
│   5. COMPILE                                                     │
│      │ ViewCompiler + SourceAdapters → execution plan            │
│      │ DataFusion LogicalPlan → PhysicalPlan                     │
│      ▼                                                           │
│   6. OBSERVE                                                     │
│      │ Feedback, telemetry, correctness issues                   │
│      │ Adjust specs, assemblage predicates, channels             │
│      └──────────────────► (back to SENSE)                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Crate Architecture

### Dependency Graph

```
ava-api ──┬── ava-runtime ──┬── ava-reconciler ── ava-compiler
          │                 │
          │                 └── ava-adapters
          │                          │
          └─────────────────────────┴── ava-domain
```

### Crate Responsibilities

#### `ava-domain` (Pure Types)
- All core types with `#[typeshare]` annotations
- Serde serialization for WASM/gRPC interop
- No async, no IO — pure data structures

**Key Types:**
```rust
// Identifiers (branded)
pub struct AssetId(String);
pub struct ViewId(String);
pub struct ChannelId(String);
pub struct AssemblageId(String);

// Enums
pub enum ChannelRole { State, Event, Metric, Command, Log }
pub enum MaterializationTier { OnDemand, Cached, Continuous }
pub enum SourceKind { Sql, Stream, Api, Graph, Lake, Cache, Custom(String) }

// Specs
pub struct AssemblageSpec { ... }
pub struct ViewProfileSpec { ... }
pub struct ChannelPipelineSpec { ... }
pub struct ViewArtifact { ... }
```

#### `ava-adapters` (Data Sources)
- `SourceAdapter` trait for heterogeneous data access
- DataFusion `TableProvider` implementations
- SQLite adapter (via sqlx)
- In-memory adapter (for testing)

**Key Trait:**
```rust
#[async_trait]
pub trait SourceAdapter: Send + Sync {
    fn id(&self) -> &str;
    fn kind(&self) -> SourceKind;
    async fn query_once(&self, plan: &QueryPlan) -> Result<RecordBatch>;
    async fn subscribe(&self, plan: &QueryPlan) -> Result<BoxStream<RecordBatch>>;
    async fn materialize(&self, plan: &QueryPlan) -> Result<MaterializationHandle>;
}
```

#### `ava-compiler` (ViewSpec → DataFusion)
- Compiles `ViewProfileSpec` → DataFusion `LogicalPlan`
- Channel pipeline → operator graph
- Optimization passes (predicate pushdown, projection pruning)

**Key Types:**
```rust
pub struct ViewCompiler { session: SessionContext }

impl ViewCompiler {
    pub fn compile(&self, spec: &ViewProfileSpec) -> Result<CompiledView>;
    pub fn explain(&self, spec: &ViewProfileSpec) -> Result<String>;
}

pub struct CompiledView {
    pub logical_plan: LogicalPlan,
    pub channel_bindings: HashMap<ChannelId, ChannelBinding>,
}
```

#### `ava-reconciler` (Event-Sourced Fiber)
- Event log as source of truth
- Fiber-like scheduler for view lifecycle
- Desired vs Active view tree diffing
- Lanes: HardRealTime, SoftRealTime, Background

**Key Types:**
```rust
pub enum ReconcilerEvent {
    ViewRequested { view_id: ViewId, spec: ViewProfileSpec },
    ViewMounted { view_id: ViewId, artifact: ViewArtifact },
    ViewUpdated { view_id: ViewId, delta: ViewDelta },
    ViewUnmounted { view_id: ViewId },
}

pub enum Lane { HardRealTime, SoftRealTime, Background }

pub struct Reconciler {
    event_log: EventLog,
    active_views: HashMap<ViewId, ViewFiber>,
}

impl Reconciler {
    pub fn request(&mut self, spec: ViewProfileSpec) -> ViewId;
    pub fn tick(&mut self) -> Vec<FiberAction>;
    pub fn replay(&mut self, from: EventSequence) -> Result<()>;
}
```

#### `ava-runtime` (Orchestration + WASM)
- Full AVA agent orchestration
- Registries for specs, adapters, views
- WASM bindings via `wasm-bindgen`
- Tokio runtime for server, `wasm-bindgen-futures` for browser

**Key Types:**
```rust
pub struct AvaRuntime {
    compiler: ViewCompiler,
    reconciler: Reconciler,
    adapters: AdapterRegistry,
    specs: SpecRegistry,
}

// WASM exports
#[wasm_bindgen]
pub struct WasmAvaRuntime { inner: AvaRuntime }

#[wasm_bindgen]
impl WasmAvaRuntime {
    pub fn request_view(&mut self, spec_json: &str) -> String;
    pub fn get_artifact(&self, view_id: &str) -> Option<String>;
    pub fn tick(&mut self) -> String; // Returns actions as JSON
}
```

#### `ava-api` (gRPC + REST)
- tonic gRPC service for server-to-server
- axum REST endpoints for browser clients
- Proto definitions for cross-language interop

**Key Endpoints:**
```
gRPC:
  rpc RequestView(ViewProfileSpec) returns (ViewId)
  rpc GetArtifact(ViewId) returns (ViewArtifact)
  rpc Subscribe(ViewId) returns (stream ViewDelta)

REST:
  POST /views       → RequestView
  GET  /views/:id   → GetArtifact
  WS   /views/:id/subscribe → Stream
```

---

## 4. TypeScript/Effect Integration

### File Structure

```
src/lib/ava/
├── index.ts                 # Public exports
├── schemas/                 # Effect Schema (mirrors ava-domain)
│   ├── ids.ts              # Branded IDs
│   ├── channels.ts         # ChannelRole, ChannelSpec
│   ├── views.ts            # ViewProfileSpec, ViewArtifact
│   ├── assemblages.ts      # AssemblageSpec
│   └── events.ts           # ReconcilerEvent
│
├── services/               # Effect.Service definitions
│   ├── AvaClient.ts        # gRPC/WASM client
│   ├── ViewRegistry.ts     # Local spec registry
│   ├── AvaAgent.ts         # High-level agent service
│   └── ReconcilerBridge.ts # Effect ↔ WASM reconciler
│
├── atoms/                  # effect-atom for React
│   ├── runtime.ts          # Atom.runtime(AvaClientLayer)
│   ├── views.ts            # View state atoms
│   └── artifacts.ts        # Artifact subscription atoms
│
└── wasm/                   # WASM bindings
    ├── bindings.ts         # Typeshare-generated types
    └── bridge.ts           # Effect wrappers
```

### Key Services

```typescript
// AvaClient — communicates with Rust runtime
export class AvaClient extends Effect.Service<AvaClient>()(
  '@gbg/tmnl/ava/AvaClient',
  {
    effect: Effect.gen(function* () {
      // Either WASM runtime or gRPC client
      const mode = yield* Effect.config(Config.string('AVA_MODE'))
      if (mode === 'wasm') {
        return yield* makeWasmClient()
      } else {
        return yield* makeGrpcClient()
      }
    })
  }
) {}

// AvaAgent — high-level orchestration
export class AvaAgent extends Effect.Service<AvaAgent>()(
  '@gbg/tmnl/ava/AvaAgent',
  {
    effect: Effect.gen(function* () {
      const client = yield* AvaClient
      const registry = yield* ViewRegistry

      return {
        // Design loop step: request a view
        requestView: (spec: ViewProfileSpec) =>
          client.requestView(spec),

        // Get artifact with Effect error handling
        getArtifact: (viewId: ViewId) =>
          client.getArtifact(viewId).pipe(
            Effect.flatMap(Option.match({
              onNone: () => Effect.fail(new ViewNotFoundError({ viewId })),
              onSome: Effect.succeed
            }))
          ),

        // Subscribe to artifact updates
        subscribe: (viewId: ViewId) =>
          client.subscribe(viewId)
      }
    })
  }
) {}
```

---

## 5. Implementation Phases

### Phase E: Experiment (Spike)

**Goal**: Validate DataFusion + WASM + Typeshare integration works.

| Task | Description | Deliverable |
|------|-------------|-------------|
| E1 | Minimal Cargo workspace with ava-domain | `Cargo.toml`, basic types |
| E2 | Typeshare → TypeScript generation | Generated `.ts` file |
| E3 | DataFusion in-memory query | Working SQL query |
| E4 | WASM compilation | `.wasm` file loads in browser |
| E5 | Round-trip: TS → WASM → TS | JSON in, JSON out |

### Phase D: Design (Architecture)

**Goal**: Solidify crate boundaries and trait designs.

| Task | Description | Deliverable |
|------|-------------|-------------|
| D1 | ava-domain complete type definitions | All structs/enums |
| D2 | SourceAdapter trait design | Trait + mock impl |
| D3 | ViewCompiler interface | Trait + stub |
| D4 | Reconciler event schema | Event types |
| D5 | WASM API surface | Exported functions |
| D6 | gRPC proto definitions | `.proto` files |
| D7 | Effect Schema parity | TS schemas match Rust |

### Phase I: Implement (Build)

**Goal**: Full vertical slice working.

| Task | Description | Deliverable |
|------|-------------|-------------|
| I1 | ava-domain implementation | Tested types |
| I2 | DataFusion memory adapter | Working adapter |
| I3 | SQLite adapter | Working adapter |
| I4 | ViewCompiler implementation | Spec → Plan |
| I5 | Reconciler event log | Append + replay |
| I6 | Reconciler Fiber scheduler | Mount/update/unmount |
| I7 | ava-runtime orchestration | Full runtime |
| I8 | WASM bindings | Browser works |
| I9 | gRPC service | Server works |
| I10 | REST endpoints | HTTP works |
| I11 | Effect AvaClient | TS client |
| I12 | effect-atom integration | React atoms |

### Phase N: Negotiate (Refine)

**Goal**: Production hardening and feedback loop.

| Task | Description | Deliverable |
|------|-------------|-------------|
| N1 | Performance benchmarks | Metrics |
| N2 | Error handling audit | Proper errors |
| N3 | Documentation | README + API docs |
| N4 | Integration tests | E2E tests |
| N5 | WMS integration spike | WMS uses AVA |

---

## 6. Dependencies

### Rust Crates

```toml
[workspace.dependencies]
# Core
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
typeshare = "1.0"
thiserror = "2.0"
anyhow = "1.0"

# Async
tokio = { version = "1", features = ["full"] }
async-trait = "0.1"
futures = "0.3"

# DataFusion
datafusion = "44"
arrow = "53"

# SQL
sqlx = { version = "0.8", features = ["runtime-tokio", "sqlite"] }

# WASM
wasm-bindgen = "0.2"
wasm-bindgen-futures = "0.4"
js-sys = "0.3"

# gRPC
tonic = "0.12"
prost = "0.13"

# REST
axum = "0.8"
tower = "0.5"
```

### TypeScript

```json
{
  "dependencies": {
    "effect": "^3.x",
    "@effect/schema": "^0.x",
    "@effect-atom/atom-react": "^0.x"
  }
}
```

---

## 7. Success Criteria

### Phase E Complete When:
- [ ] ava-domain compiles with Typeshare annotations
- [ ] TypeScript types generated and importable
- [ ] DataFusion query returns results
- [ ] WASM loads in browser console
- [ ] Round-trip JSON works

### Phase D Complete When:
- [ ] All trait definitions reviewed and approved
- [ ] Proto files compile
- [ ] Effect schemas match Rust types 1:1

### Phase I Complete When:
- [ ] `cargo test` passes all crates
- [ ] WASM artifact works in React app
- [ ] gRPC server accepts requests
- [ ] REST endpoints respond
- [ ] Effect AvaClient connects

### Phase N Complete When:
- [ ] WMS can request and display a view via AVA
- [ ] Performance acceptable (<100ms for simple views)
- [ ] Docs published

---

## 8. Open Questions

1. **Event log storage**: SQLite? Append-only file? Memory?
2. **WASM size budget**: How large is acceptable?
3. **gRPC vs REST priority**: Which first?
4. **Assemblage predicate language**: DSL? JSON? Effect Schema?
5. **View versioning**: Semver? Logical clock?

---

## References

- `AVA_MODALITY.md` — Design modality definition
- `AVA_ARCHITECTURAL_FRAMING.md` — MVC analogy
- `AVA_PATTERN_CATALOG.md` — 8 reusable patterns
- `AVA_ARTIFACTS.md` — ViewChannel/ViewArtifact structure
- `AVA_ASSEMBLAGE.md` — Assemblage constraints
- `AMS_RUST.md` — Original Rust architecture sketch

---

**Co-Authored-By: Val <val@maidens.ai>**
