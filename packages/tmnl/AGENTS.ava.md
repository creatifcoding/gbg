# AVA (Asset View Agent) System Documentation

> **Comprehensive guide for agents working on the AVA reconciler runtime.**

---

## Overview

AVA (Asset View Agent) is a **reconciler-based data view runtime** that compiles declarative view specifications into executable DataFusion queries. It follows the "React for data" model — you declare what you want, AVA figures out how to build it.

### Core Philosophy

**Reconciler Model**: AVA maintains **desired state** (ViewProfileSpec) and **actual state** (ViewArtifact), producing actions (FiberActions) to bring actual state toward desired.

**Channel-Based Views**: Views are composed of **channels** (STATE, EVENT, METRIC, COMMAND, LOG), each with its own data pipeline.

**Assemblages as Constraints**: **Assemblages** are view filter predicates that define which views apply to which assets — the "rails" for valid configurations.

**DataFusion Compilation**: Pipeline specs compile to SQL/LogicalPlan via DataFusion, enabling federated queries across heterogeneous sources.

---

## Crate Structure

```
src-ava/
├── ava-domain/          # Pure data structures + traits (types, errors, discovery)
├── ava-compiler/        # ViewCompiler (ChannelPipelineSpec → SQL/LogicalPlan)
├── ava-adapters/        # SourceAdapter implementations (Memory, SQLite, Registry)
├── ava-wasm/            # WebAssembly bindings for TypeScript
└── proto/               # Protobuf definitions for gRPC/Cosmo Connect
    ├── ava/discovery/v1/
    ├── ava/execution/v1/
    └── ava/registry/v1/
```

### Dependency Graph

```
ava-domain (types + traits)
    │
    ├──► ava-compiler (validation + compilation)
    │         │
    │         └──► ava-runtime (services) [planned]
    │                   │
    │                   └──► ava-api (gRPC services) [planned]
    │
    └──► ava-adapters (data sources)
              │
              └──► ava-runtime (discovery queries adapters)
```

---

## Core Concepts

### ViewProfileSpec

The "blueprint" for a view — declarative specification of data flow.

**Structure**:
- `id: ViewId` — Unique view identifier
- `name: String` — Human-readable name
- `assemblage_id: AssemblageId` — Which assemblage this view belongs to
- `channels: Vec<ChannelPipelineSpec>` — Data pipelines for each channel
- `version: u32` — Spec schema version

**Location**: `ava-domain/src/views.rs`

### ChannelPipelineSpec

Specification for a single data channel within a view.

**Structure**:
- `id: ChannelId` — Channel identifier
- `role: ChannelRole` — STATE | EVENT | METRIC | COMMAND | LOG
- `source: SourceSpec` — Primary data source
- `additional_sources: Vec<SourceSpec>` — For joins
- `pipeline: Vec<PipelineOperator>` — Transformations (filter, project, aggregate, join, sort, limit, window)
- `materialization: MaterializationTier` — OnDemand | Cached | Continuous
- `refresh_ms: Option<u32>` — Refresh interval for cached/continuous

**Location**: `ava-domain/src/channels.rs`

### Assemblages

View filter predicates that gate which views apply to which assets.

**Structure**:
- `id: AssemblageId`
- `name: String`
- `domain: String`
- `predicate: AssemblagePredicate` — Matching logic (AssetType, HasTrait, InSite, PropertyEquals, And, Or, Not)
- `constraints: Vec<AssemblageConstraint>` — RequiredChannels, MaxConcurrentViews, AllowedSources
- `admissible_views: Vec<ViewId>` — Whitelist of allowed views (empty = all)

**Location**: `ava-domain/src/assemblages.rs`

### Reconciliation Lanes

Priority-based scheduling for view reconciliation:

| Lane | Priority | Use Case |
|------|----------|----------|
| **HardRealTime** | 3 | Critical views (alarms, safety) |
| **SoftRealTime** | 2 | Interactive views (user dashboards) |
| **Background** | 1 | Batch views (reports, analytics) |

**Location**: `ava-domain/src/events.rs` (enum `Lane`)

---

## Type System

### Branded IDs

All identifiers are newtype wrappers around `String` for type safety:

| Type | Purpose | Example |
|------|---------|---------|
| `AssetId` | External asset identifier | `"asset-123"` |
| `ViewId` | View instance identifier | `"view-fleet-dashboard"` |
| `ChannelId` | Channel within a view | `"state"`, `"events"` |
| `AssemblageId` | Assemblage identifier | `"wms-trucks"` |
| `SourceId` | Data source identifier | `"assets-db"` |
| `EventSequence` | Event log sequence number (u64) | Monotonically increasing |

**Location**: `ava-domain/src/ids.rs`

**Serialization**: All IDs use `#[serde(transparent)]` for clean JSON (`"asset-123"` not `{"0":"asset-123"}`).

### Enums

#### SourceKind

```rust
pub enum SourceKind {
    Sql,         // SQLite, Postgres, MySQL
    Stream,      // Kafka, WebSocket
    Api,         // REST, GraphQL
    Graph,       // Neo4j, TigerGraph
    Lake,        // Data lake (Parquet, Iceberg)
    Cache,       // In-memory MemoryAdapter
    Custom(String),
}
```

**Location**: `ava-domain/src/channels.rs`

#### ChannelRole

```rust
pub enum ChannelRole {
    State,    // Current state snapshot
    Event,    // Event log (append-only)
    Metric,   // Time-series metrics
    Command,  // Command queue (write)
    Log,      // System logs
}
```

**Properties**:
- `is_read_only()` — Returns `false` only for `Command`
- `supports_streaming()` — Returns `true` for `Event`, `Metric`, `Log`

**Location**: `ava-domain/src/channels.rs`

#### MaterializationTier

```rust
pub enum MaterializationTier {
    OnDemand,      // Query on request (no caching)
    Cached,        // Cache results, refresh on interval
    Continuous,    // Continuous query (streaming)
}
```

**Location**: `ava-domain/src/channels.rs`

#### JoinType

```rust
pub enum JoinType {
    Inner,
    Left,
    Right,
    Full,
    Cross,
}
```

**Location**: `ava-domain/src/channels.rs`

### Key Structs

#### PipelineOperator (Tagged Union)

```rust
pub enum PipelineOperator {
    Filter { predicate: String },
    Project { columns: Vec<String> },
    Aggregate { group_by: Vec<String>, aggregates: Vec<AggregateExpr> },
    Join { source: SourceId, left_key: String, right_key: String, join_type: JoinType },
    Sort { columns: Vec<SortColumn> },
    Limit { count: u32, offset: Option<u32> },
    Window { partition_by: Vec<String>, order_by: Vec<SortColumn>, function: String },
}
```

**Location**: `ava-domain/src/channels.rs`

#### ViewArtifact

Runtime instance of a mounted view:

```rust
pub struct ViewArtifact {
    pub view_id: ViewId,
    pub asset_id: Option<AssetId>,
    pub spec: ViewProfileSpec,
    pub channel_bindings: Vec<ChannelBinding>,
    pub created_at_ms: f64,
    pub logical_version: u32,
}
```

**Location**: `ava-domain/src/views.rs`

#### ChannelBinding

Binding of a channel to its compiled state:

```rust
pub struct ChannelBinding {
    pub channel_id: ChannelId,
    pub role: ChannelRole,
    pub active: bool,
    pub row_count: Option<u32>,
    pub last_updated_ms: Option<f64>,
}
```

**Location**: `ava-domain/src/views.rs`

---

## Traits

All traits use `async_trait` for async method support and `Arc<dyn Trait>` for runtime extensibility.

### T1: SourceAdapter

**Purpose**: Data source abstraction for heterogeneous backends.

**Location**: `ava-domain/src/traits.rs`

**Key Methods**:
```rust
#[async_trait]
pub trait SourceAdapter: Send + Sync {
    fn kind(&self) -> SourceKind;
    fn id(&self) -> &SourceId;

    async fn connect(&mut self) -> Result<(), SourceError>;
    async fn disconnect(&mut self) -> Result<(), SourceError>;
    async fn query(&self, query: &str) -> Result<RecordBatch, SourceError>;
    async fn schema(&self) -> Result<SchemaRef, SourceError>;

    // Optional: streaming sources
    async fn subscribe(
        &self,
        callback: Box<dyn Fn(RecordBatch) + Send + Sync>,
    ) -> Result<SubscriptionHandle, SourceError>;
}
```

**Implementations**:
- `MemoryAdapter` — In-memory Arrow RecordBatch storage (`ava-adapters/src/memory.rs`)
- `SqliteAdapter` — SQLite database adapter (`ava-adapters/src/sqlite.rs`)

**Usage Pattern**:
```rust
let mut adapter = MemoryAdapter::new(SourceId::new("cache"), vec![batch]);
adapter.connect().await?;
let result = adapter.query("SELECT * FROM data WHERE id > 10").await?;
```

### T2: ChannelCompiler

**Purpose**: Compiles `ChannelPipelineSpec` into executable DataFusion plans.

**Location**: `ava-domain/src/traits.rs`

**Key Methods**:
```rust
#[async_trait]
pub trait ChannelCompiler: Send + Sync {
    async fn validate(&self, spec: &ChannelPipelineSpec) -> Result<(), ChannelError>;
    async fn compile_logical(&self, spec: &ChannelPipelineSpec) -> Result<LogicalPlan, ChannelError>;
    async fn optimize(&self, plan: LogicalPlan) -> Result<LogicalPlan, ChannelError>;
    async fn compile_physical(&self, plan: LogicalPlan) -> Result<PhysicalPlan, ChannelError>;

    // Full compilation pipeline
    async fn compile(&self, spec: &ChannelPipelineSpec) -> Result<PhysicalPlan, ChannelError>;
}
```

**Implementation**: `ViewCompiler` in `ava-compiler/src/compiler.rs`

**Usage Pattern**:
```rust
let compiler = ViewCompiler::new("assets");
let compiled = compiler.compile(&spec)?; // Returns CompiledView with SQL + schema
```

### T3: ViewReconciler

**Purpose**: State reconciliation loop (desired → actual state).

**Location**: `ava-domain/src/traits.rs`

**Key Methods**:
```rust
#[async_trait]
pub trait ViewReconciler: Send + Sync {
    async fn diff(
        &self,
        desired: &ViewProfileSpec,
        actual: Option<&ViewArtifact>,
    ) -> Result<ViewDelta, ViewError>;

    async fn tick(&self, view_id: &ViewId, lane: Lane) -> Result<FiberAction, ReconcilerError>;
    async fn apply(&self, action: FiberAction) -> Result<Option<ReconcilerEvent>, ReconcilerError>;

    fn lane(&self, view_id: &ViewId) -> Lane;
    fn set_lane(&mut self, view_id: &ViewId, lane: Lane);
}
```

**Reconciliation Model**:
```
Desired State (ViewProfileSpec)
       ▼
   diff() → ViewDelta
       ▼
   tick() → FiberAction (Compile, Mount, Update, Unmount)
       ▼
   apply() → ReconcilerEvent (logged to journal)
       ▼
Actual State (ViewArtifact)
```

### T4: EventJournal

**Purpose**: Durable event persistence for audit, replay, recovery.

**Location**: `ava-domain/src/traits.rs`

**Key Methods**:
```rust
#[async_trait]
pub trait EventJournal: Send + Sync {
    async fn append(&self, event: ReconcilerEvent) -> Result<EventSequence, ReconcilerError>;
    async fn read_from(&self, from: EventSequence, limit: usize) -> Result<Vec<EventLogEntry>, ReconcilerError>;
    async fn read_by_view(&self, view_id: &ViewId, limit: usize) -> Result<Vec<EventLogEntry>, ReconcilerError>;
    async fn latest_sequence(&self) -> Result<EventSequence, ReconcilerError>;
    async fn compact(&self, up_to: EventSequence) -> Result<u64, ReconcilerError>;
}
```

**Consistency Model**: Events durably persisted before acknowledgment. Sequence numbers are monotonically increasing.

### T5: ViewRuntime

**Purpose**: Composite runtime coordinating sources, compilation, reconciliation, journaling.

**Location**: `ava-domain/src/traits.rs`

**Key Methods**:
```rust
#[async_trait]
pub trait ViewRuntime: Send + Sync {
    async fn register_source(&self, source: DynSourceAdapter) -> Result<(), SourceError>;
    async fn mount(&self, spec: ViewProfileSpec) -> Result<ViewArtifact, ViewError>;
    async fn update(&self, view_id: &ViewId, delta: ViewDelta) -> Result<(), ViewError>;
    async fn suspend(&self, view_id: &ViewId) -> Result<(), ViewError>;
    async fn resume(&self, view_id: &ViewId) -> Result<(), ViewError>;
    async fn unmount(&self, view_id: &ViewId) -> Result<(), ViewError>;
    async fn artifact(&self, view_id: &ViewId) -> Result<Option<ViewArtifact>, ViewError>;
    async fn tick(&self) -> Result<Vec<FiberAction>, ReconcilerError>;
}
```

---

## Transport Layer

### Protobuf/gRPC via Cosmo Connect

**Primary Transport**: Cosmo Connect bridges GraphQL Federation with gRPC services.

**Structure**:
```
TypeScript Client (Effect-TS)
         ▼
   @connectrpc/connect-web
         ▼
   Cosmo Router (Federation)
         ▼
   gRPC Services (Rust + tonic)
         ▼
   AVA Runtime (ava-domain + ava-compiler + ava-adapters)
```

**Proto Definitions**:
- `proto/ava/discovery/v1/discovery.proto` — Source discovery, schema introspection
- `proto/ava/execution/v1/execution.proto` — Spec execution, validation errors
- `proto/ava/registry/v1/registry.proto` — Template/assemblage storage

**Services**:
1. **DiscoveryService** — Enumerates sources, introspects schemas, reports capabilities
2. **ExecutionService** — Validates + executes specs atomically, returns results or errors
3. **RegistryService** — Manages saved templates and assemblages

**Arrow IPC**: Bulk data transfer uses Arrow IPC format for efficiency (RecordBatch serialization).

**REST Fallback**: gRPC-Gateway auto-generates REST endpoints from proto annotations.

### Atomic Validate-and-Execute

**Critical Design Decision**: No separate `/validate` endpoint. Validation happens internally during execution.

**Rationale**:
- Eliminates round-trip overhead
- Prevents "validated but stale" problem (schema changed between validate and execute)
- Simpler client logic: send spec, get results OR errors

**Implementation**:
```protobuf
message ExecuteSpecResponse {
  oneof result {
    ExecutionSuccess success = 1;  // Data if valid
    ExecutionFailure failure = 2;  // ValidationError[] if invalid
  }
}
```

---

## Discovery/Validation Architecture

### Problem Statement

The UI needs to discover:
1. What data sources exist
2. What schemas they have (tables, columns, types)
3. What operations they support (filtering, aggregation, joins, etc.)
4. Whether a spec is valid before execution

### SourceDescriptor

Complete description of a data source for UI discovery.

**Structure**:
```rust
pub struct SourceDescriptor {
    pub id: SourceId,
    pub name: String,
    pub description: Option<String>,
    pub kind: SourceKind,
    pub connected: bool,
    pub schema: SourceSchema,
    pub capabilities: SourceCapabilities,
    pub tags: HashMap<String, String>,
}
```

**Location**: `ava-domain/src/discovery.rs`

**Example JSON**:
```json
{
  "id": "assets-db",
  "name": "Assets Database",
  "kind": "sql",
  "connected": true,
  "schema": {
    "tables": [
      {
        "name": "assets",
        "columns": [
          { "name": "id", "dataType": "Utf8", "nullable": false },
          { "name": "value", "dataType": "Float64", "nullable": true }
        ]
      }
    ],
    "defaultTable": "assets"
  },
  "capabilities": {
    "sqlQuery": true,
    "filtering": true,
    "aggregation": true,
    "joins": true,
    "streaming": false
  }
}
```

### SourceCapabilities

Flags indicating what operations a source supports.

**Structure**:
```rust
pub struct SourceCapabilities {
    pub sql_query: bool,
    pub filtering: bool,
    pub projection: bool,
    pub aggregation: bool,
    pub joins: bool,
    pub window_functions: bool,
    pub streaming: bool,
    pub writable: bool,
    pub max_rows: Option<u64>,
}
```

**Presets**:
- `SourceCapabilities::full_sql()` — All SQL features (MemoryAdapter, SqliteAdapter)
- `SourceCapabilities::streaming()` — Filter/project, no aggregation, supports subscriptions
- `SourceCapabilities::api()` — Filter/project, max_rows = 1000

**Location**: `ava-domain/src/discovery.rs`

### ValidationError Variants

Rich validation errors with precise location information for UI feedback.

**Variants**:

| Variant | Context | Example |
|---------|---------|---------|
| `SourceNotFound` | source_id, location | `Source 'unknown-db' not found` |
| `ColumnNotFound` | column, source_id, available_columns, location | `Column 'statuz' not found (did you mean 'status'?)` |
| `TypeMismatch` | expected, actual, context, location | `Join key type mismatch: Int64 vs Utf8` |
| `InvalidAggregation` | function, reason, location | `AVG requires numeric column, got Utf8` |
| `UnsupportedOperation` | operation, source_id, required_capability, location | `Aggregation not supported (source lacks 'aggregation' capability)` |
| `CircularDependency` | cycle | `Circular dependency: A → B → C → A` |
| `InvalidPredicate` | predicate, reason, location | `Syntax error in WHERE clause` |

**Location**: `ava-compiler/src/validation.rs`

### ErrorLocation

Precise error positioning within a ViewProfileSpec.

**Structure**:
```rust
pub struct ErrorLocation {
    pub channel_id: Option<String>,
    pub pipeline_index: Option<usize>,
    pub field: Option<String>,
}
```

**Path Formatting**:
```rust
ErrorLocation::field("state", 0, "predicate").path()
// → "channel[state].pipeline[0].predicate"
```

**UI Integration**: Enable inline errors at exact spec location.

---

## Implementation Patterns

### async_trait Usage

All trait methods are `async` via `#[async_trait]` macro.

**Pattern**:
```rust
use async_trait::async_trait;

#[async_trait]
pub trait SourceAdapter: Send + Sync {
    async fn query(&self, query: &str) -> Result<RecordBatch, SourceError>;
}

#[async_trait]
impl SourceAdapter for MemoryAdapter {
    async fn query(&self, query: &str) -> Result<RecordBatch, SourceError> {
        // Implementation uses .await
        let ctx = self.ctx.read().await;
        ctx.as_ref().ok_or(...)?
            .sql(query).await
            .map_err(...)?
            .collect().await
    }
}
```

### DataFusion Integration

**SessionContext**: Core DataFusion query engine.

**MemTable**: In-memory table from Arrow RecordBatch.

**Pattern**:
```rust
use datafusion::prelude::*;
use datafusion::datasource::MemTable;

let ctx = SessionContext::new();
let mem_table = MemTable::try_new(schema, vec![batches])?;
ctx.register_table("assets", Arc::new(mem_table))?;

let df = ctx.sql("SELECT * FROM assets WHERE value > 100").await?;
let results: Vec<RecordBatch> = df.collect().await?;
```

**SourceTableProvider**: Wraps `SourceAdapter` as `TableProvider` for federated queries.

**Pattern**:
```rust
use ava_adapters::{SourceTableProvider, register_adapters};

let provider = SourceTableProvider::new(adapter);
provider.ensure_schema().await?; // Pre-populate schema cache

ctx.register_table("my_table", Arc::new(provider))?;
```

### typeshare Annotations

All types exported to TypeScript use `#[typeshare]`.

**Pattern**:
```rust
use typeshare::typeshare;

#[typeshare]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewProfileSpec {
    pub id: ViewId,
    pub name: String,
    pub version: u32,
}
```

**TypeScript Output** (auto-generated):
```typescript
export interface ViewProfileSpec {
  id: ViewId;
  name: string;
  version: number;
}
```

### Error Handling with thiserror

Domain errors use `thiserror` for ergonomic error messages.

**Pattern**:
```rust
use thiserror::Error;

#[derive(Debug, Clone, Error)]
pub enum SourceError {
    #[error("Source not found: {source_id:?}")]
    NotFound { source_id: SourceId },

    #[error("Connection failed: {message}")]
    ConnectionFailed { source_id: SourceId, message: String },
}
```

---

## Testing Strategy

### Unit Tests (Domain Types)

**Location**: `ava-domain/src/*.rs` (inline `#[cfg(test)]` modules)

**Pattern**:
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_channel_role_properties() {
        assert!(ChannelRole::State.is_read_only());
        assert!(!ChannelRole::Command.is_read_only());
    }
}
```

### Integration Tests (Compiler)

**Location**: `ava-compiler/src/lib.rs` (DataFusion spikes)

**Pattern** (async tests with tokio):
```rust
#[tokio::test]
async fn test_datafusion_aggregation() {
    let ctx = create_session();
    // ... register table
    let df = ctx.sql("SELECT site_id, SUM(value) FROM metrics GROUP BY site_id").await.unwrap();
    let results = df.collect().await.unwrap();
    assert_eq!(results[0].num_rows(), 2);
}
```

### Adapter Tests

**Location**: `ava-adapters/src/*.rs`

**Pattern**:
```rust
#[tokio::test]
async fn test_memory_adapter_connect_query() {
    let mut adapter = MemoryAdapter::new(SourceId::new("test"), vec![batch]);
    adapter.connect().await.unwrap();

    let result = adapter.query("SELECT * FROM data").await.unwrap();
    assert_eq!(result.num_rows(), 3);
}
```

### WASM Tests

**Location**: `ava-wasm/src/lib.rs`

**Run with**: `wasm-pack test --node`

**Pattern**:
```rust
#[test]
fn test_parse_view_spec() {
    let json = r#"{"id":"v1","name":"Test","assemblageId":"a1","version":1}"#;
    let spec: ViewProfileSpec = serde_json::from_str(json).unwrap();
    assert_eq!(spec.id, "v1");
}
```

---

## File Index

### ava-domain

| File | Contents |
|------|----------|
| `src/lib.rs` | Crate root, re-exports all modules |
| `src/ids.rs` | Branded identifier types (AssetId, ViewId, ChannelId, SourceId, AssemblageId, EventSequence) |
| `src/channels.rs` | ChannelRole, MaterializationTier, SourceKind, PipelineOperator, ChannelPipelineSpec |
| `src/views.rs` | ViewProfileSpec, ViewArtifact, ChannelBinding, ViewDelta, ViewFamily |
| `src/assemblages.rs` | AssemblageSpec, AssemblagePredicate, AssemblageConstraint, AssemblageMembership |
| `src/events.rs` | ReconcilerEvent, UnmountReason, Lane, FiberAction, EventLogEntry |
| `src/errors.rs` | ViewError, ChannelError, AssemblageError, SourceError, ReconcilerError, AvaError |
| `src/traits.rs` | SourceAdapter, ChannelCompiler, ViewReconciler, EventJournal, ViewRuntime traits |
| `src/discovery.rs` | SourceDescriptor, SourceSchema, TableSchema, ColumnDescriptor, SourceCapabilities |

### ava-compiler

| File | Contents |
|------|----------|
| `src/lib.rs` | Crate root, re-exports, DataFusion test spikes |
| `src/compiler.rs` | ViewCompiler, CompiledView, SqlBuilder (ChannelPipelineSpec → SQL) |
| `src/validation.rs` | ValidationResult, ValidationError variants, ErrorLocation |
| `src/error.rs` | CompilerError enum |

### ava-adapters

| File | Contents |
|------|----------|
| `src/lib.rs` | Crate root, re-exports |
| `src/memory.rs` | MemoryAdapter (in-memory Arrow RecordBatch storage + DataFusion) |
| `src/sqlite.rs` | SqliteAdapter (SQLite database via sqlx) |
| `src/registry.rs` | AdapterRegistry (thread-safe registry via DashMap) |
| `src/table_provider.rs` | SourceTableProvider (wraps SourceAdapter as DataFusion TableProvider) |

### ava-wasm

| File | Contents |
|------|----------|
| `src/lib.rs` | WASM bindings, AvaClient, parse/validate functions, async operations |

### proto

| File | Contents |
|------|----------|
| `ava/discovery/v1/discovery.proto` | DiscoveryService, SourceDescriptor, SourceCapabilities |
| `ava/execution/v1/execution.proto` | ExecutionService, ViewProfileSpec, ValidationError variants |
| `ava/registry/v1/registry.proto` | RegistryService, TemplateMetadata, Assemblage |

### docs

| File | Contents |
|------|----------|
| `docs/DISCOVERY_AND_VALIDATION_ARCHITECTURE.md` | Comprehensive discovery/validation design |
| `docs/ARCHITECTURE_JOURNAL.md` | Architectural decisions log (ADRs), open concerns (OACs) |
| `docs/REST_API_DESIGN.md` | REST/gRPC-Gateway endpoint specifications |

---

## Open Architectural Concerns

### OAC-001: Schema Caching Strategy

**Status**: Open

**Question**: How often should source schemas be refreshed?

**Options**:
1. On-demand — Fetch on every `ListSources()` call
2. Periodic — Background refresh every N seconds
3. Event-driven — Invalidate on adapter reconnect/schema change
4. Hybrid — Cache with TTL (30s) + event-driven invalidation

**Leaning**: Hybrid

---

### OAC-002: Spec Versioning and Migration

**Status**: Open

**Question**: How do we handle `ViewProfileSpec` schema evolution?

**Scenarios**:
- New pipeline operator added → old specs still valid
- Operator field renamed → old specs invalid
- Source schema changes → saved specs reference stale columns

**Options**:
1. Version field + migration functions
2. Immutable snapshots (old specs reference frozen schema versions)
3. Best-effort compatibility (validate on load, mark incompatible)

**Leaning**: Version field + migration functions

---

### OAC-003: Permission-Filtered Discovery

**Status**: Open

**Question**: Should `ListSources()` be filtered by user permissions?

**Options**:
1. Unfiltered — All sources visible, permissions enforced at execution
2. Pre-filtered — Discovery only returns permitted sources
3. Capability-based — Sources visible, schema details hidden without permission

**Leaning**: Pre-filtered discovery, execution-time permission check as fallback

---

### OAC-004: Streaming Source Discovery

**Status**: Open

**Question**: How do we discover schemas for streaming sources (Kafka, WebSocket)?

**Problem**: Streaming sources often don't have fixed schemas. Data is semi-structured (JSON, Avro, Protobuf).

**Options**:
1. Schema registry integration (Confluent, etc.)
2. Sample-based inference (peek at N messages, infer schema)
3. User-declared schemas (require schema declaration at registration)
4. Dynamic columns (return `columns: []`, let UI handle free-form data)

**Leaning**: Tiered approach — use schema registry if available, fall back to user-declared, mark truly dynamic sources as `schemaless: true`

---

### OAC-005: Cross-Source Join Validation

**Status**: Open

**Question**: How do we validate joins between different source types?

**Example**: `assets (SQLite) JOIN metrics (Kafka stream) ON assets.id = metrics.asset_id`

**Challenges**:
- Type compatibility: `Utf8` vs `String` vs `bytes`
- Cardinality differences (batch vs stream)
- Execution semantics differ

**Options**:
1. Strict type matching — Reject unless types identical
2. Coercion rules — Define implicit casts (Int32 → Int64)
3. Source-type restrictions — Only allow joins within same source type
4. Trust DataFusion — Use DataFusion's type coercion

**Leaning**: Initially restrict to same-source-type joins; add cross-source with explicit cast operators later

---

### OAC-006: Arrow IPC vs JSON Response Format

**Status**: Open

**Question**: When should we return Arrow IPC vs JSON?

**Trade-offs**:

| Format | Size | Parse Speed | Browser Support | Human Readable |
|--------|------|-------------|-----------------|----------------|
| JSON | Large | Slow | Native | Yes |
| Arrow IPC | Small | Fast | Via apache-arrow-js | No |

**Options**:
1. Client choice — `OutputFormat` enum in request
2. Size threshold — JSON for < 1000 rows, Arrow for larger
3. Capability detection — Check if client supports Arrow
4. Always Arrow — Mandate Arrow, provide JS library

**Leaning**: Client choice via `OutputFormat` enum, default to JSON for compatibility

---

### OAC-007: Cosmo Connect Authentication Flow

**Status**: Open

**Question**: How does authentication flow through the federation layer?

**Current Understanding**:
- Cosmo Router handles incoming requests
- Router can extract JWT/API key from headers
- How to propagate identity to backend gRPC services?

**Options**:
1. Header propagation — Router forwards `Authorization` header to subgraphs
2. Token exchange — Router validates, issues internal service token
3. mTLS — Service-to-service auth via certificates
4. Sidecar proxy — Istio/Envoy handles auth

**Leaning**: Header propagation + middleware in each service that extracts user context

---

## Quick Reference

### Common Commands

```bash
# Test all crates
cargo test --workspace

# Test specific crate
cargo test -p ava-domain
cargo test -p ava-compiler
cargo test -p ava-adapters

# Build WASM
cd ava-wasm
wasm-pack build --target web

# Test WASM
wasm-pack test --node

# Generate TypeScript types
typeshare . --lang typescript --output-file ./generated.ts

# Run DataFusion spike tests
cargo test --package ava-compiler test_datafusion
```

### Key Dependencies

| Crate | Purpose |
|-------|---------|
| `arrow` | RecordBatch, Schema, Array types |
| `datafusion` | SQL query engine, LogicalPlan, SessionContext |
| `sqlx` | Async SQL database access (SQLite) |
| `async-trait` | Async methods in traits |
| `serde` | Serialization/deserialization |
| `typeshare` | Rust → TypeScript type generation |
| `thiserror` | Error type derivation |
| `dashmap` | Concurrent HashMap (AdapterRegistry) |
| `wasm-bindgen` | WASM bindings for JavaScript |
| `tonic` | gRPC server/client (planned) |
| `prost` | Protobuf serialization (planned) |

### Type Conventions

- **IDs**: Branded newtypes (`ViewId`, `SourceId`, etc.)
- **Enums**: `SCREAMING_SNAKE_CASE` for serialization (ChannelRole, SourceKind)
- **Structs**: `camelCase` for JSON serialization (`#[serde(rename_all = "camelCase")]`)
- **Errors**: `thiserror` with Display messages
- **Async**: All I/O methods use `async_trait`

---

## Glossary

| Term | Definition |
|------|------------|
| **AVA** | Asset View Agent — reconciler-based data view runtime |
| **ViewProfileSpec** | Declarative blueprint for a view |
| **ViewArtifact** | Runtime instance of a mounted view |
| **ChannelPipelineSpec** | Data pipeline for a single channel (STATE, EVENT, etc.) |
| **Assemblage** | View filter predicate that gates which views apply to which assets |
| **Reconciler** | System that brings actual state toward desired state via actions |
| **Lane** | Priority tier for view reconciliation (HardRealTime, SoftRealTime, Background) |
| **SourceAdapter** | Trait for heterogeneous data sources (SQL, Stream, API, etc.) |
| **MemoryAdapter** | In-memory Arrow RecordBatch storage with DataFusion SQL |
| **SqliteAdapter** | SQLite database adapter with sqlx |
| **ViewCompiler** | Compiles ChannelPipelineSpec to SQL/LogicalPlan |
| **DataFusion** | Apache Arrow query engine (Rust) |
| **Arrow IPC** | Inter-Process Communication format for Arrow RecordBatches |
| **Cosmo Connect** | GraphQL Federation → gRPC bridge |
| **ValidationError** | Rich error type with precise location info for UI feedback |
| **SourceDescriptor** | Complete description of a data source (schema, capabilities, tags) |
| **SourceCapabilities** | Flags indicating what operations a source supports |

---

**Last Updated**: 2025-12-11
**Maintained By**: Val (AG-Grid Integration Architect)
**For Questions**: Reference this document + consult the architecture journal (`docs/ARCHITECTURE_JOURNAL.md`)
