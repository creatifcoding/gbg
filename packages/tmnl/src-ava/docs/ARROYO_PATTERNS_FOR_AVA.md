# Arroyo Patterns for AVA

**Purpose**: Design reference for adapting Arroyo's streaming SQL architecture to AVA's Asset View Agent runtime.

**Source**: [ArroyoSystems/arroyo](https://github.com/ArroyoSystems/arroyo) — Real-time streaming SQL engine built on DataFusion.

---

## Table of Contents

1. [Extension Trait Pattern](#1-extension-trait-pattern)
2. [Plan Rewriter Pipeline](#2-plan-rewriter-pipeline)
3. [Watermark Propagation](#3-watermark-propagation)
4. [Window Operator Architecture](#4-window-operator-architecture)
5. [Graph-Based Execution](#5-graph-based-execution)
6. [Schema Provider Pattern](#6-schema-provider-pattern)
7. [Incremental Aggregation](#7-incremental-aggregation)

---

## 1. Extension Trait Pattern

### Pattern Overview

Arroyo extends DataFusion's `LogicalPlan` with custom streaming operators via an `ArroyoExtension` trait. This allows injecting streaming semantics (watermarks, windows, state) into the standard query planning pipeline.

### Enabling Technologies

| Crate | Purpose |
|-------|---------|
| `datafusion` | Base query engine with `UserDefinedLogicalNode` |
| `async-trait` | Async method support in traits |
| `arrow` | Data representation via `RecordBatch` |

### Notional Code

```rust
use async_trait::async_trait;
use datafusion::logical_expr::UserDefinedLogicalNode;
use std::sync::Arc;

/// AVA Extension trait - streaming operator abstraction
#[async_trait]
pub trait AvaExtension: UserDefinedLogicalNode + Send + Sync {
    /// Unique name for memoization during planning
    fn node_name(&self) -> Option<String> {
        None
    }

    /// Convert this extension into an executable graph node
    fn plan_node(
        &self,
        inputs: Vec<Arc<dyn AvaExtension>>,
    ) -> Result<NodeWithEdges, PlanError>;

    /// Output schema after this operator executes
    fn output_schema(&self) -> SchemaRef;

    /// Whether this node is transparent (pass-through for compatibility)
    fn transparent(&self) -> bool {
        false
    }

    /// Watermark behavior: does this node generate or propagate watermarks?
    fn watermark_behavior(&self) -> WatermarkBehavior {
        WatermarkBehavior::Propagate
    }
}

/// Watermark handling modes
pub enum WatermarkBehavior {
    /// Operator generates watermarks (sources)
    Generate,
    /// Operator propagates watermarks unchanged
    Propagate,
    /// Operator holds watermarks until window closes
    Hold,
}

/// Graph node with incoming edges
pub struct NodeWithEdges {
    pub node: LogicalNode,
    pub edges: Vec<LogicalEdge>,
}
```

### AVA Adaptation

For AVA, the `AvaExtension` trait maps to **Channel operators**:

```rust
/// Channel-specific extension for AVA views
pub trait ChannelExtension: AvaExtension {
    /// Channel role this operator belongs to
    fn channel_role(&self) -> ChannelRole;

    /// Materialization tier for this channel
    fn materialization(&self) -> MaterializationTier;

    /// Refresh interval (for cached/continuous tiers)
    fn refresh_ms(&self) -> Option<u64>;
}
```

---

## 2. Plan Rewriter Pipeline

### Pattern Overview

Arroyo transforms DataFusion `LogicalPlan` into streaming operators via a chain of `TreeNodeRewriter` implementations. Each rewriter handles a specific concern (sources, aggregates, joins).

### Enabling Technologies

| Crate | Purpose |
|-------|---------|
| `datafusion` | `TreeNodeRewriter` trait for plan transformation |
| `datafusion-expr` | `LogicalPlan` variants to match against |

### Notional Code

```rust
use datafusion::common::tree_node::{TreeNode, TreeNodeRewriter, Transformed};
use datafusion::logical_expr::LogicalPlan;

/// Rewriter that converts TableScan → StreamingSource
pub struct SourceRewriter {
    pub schema_provider: Arc<dyn SchemaProvider>,
}

impl TreeNodeRewriter for SourceRewriter {
    type Node = LogicalPlan;

    fn f_up(&mut self, node: LogicalPlan) -> Result<Transformed<LogicalPlan>> {
        match &node {
            LogicalPlan::TableScan(scan) => {
                // Look up table metadata
                let table = self.schema_provider.get_table(&scan.table_name)?;

                // Convert to streaming source with watermark
                let streaming_source = StreamingSourceNode {
                    table_name: scan.table_name.clone(),
                    schema: scan.projected_schema.clone(),
                    watermark_column: table.watermark_column(),
                    watermark_delay: table.watermark_delay(),
                };

                Ok(Transformed::yes(LogicalPlan::Extension(
                    Extension { node: Arc::new(streaming_source) }
                )))
            }
            _ => Ok(Transformed::no(node)),
        }
    }
}

/// Rewriter that converts Aggregate → WindowedAggregate or UpdatingAggregate
pub struct AggregateRewriter;

impl TreeNodeRewriter for AggregateRewriter {
    type Node = LogicalPlan;

    fn f_up(&mut self, node: LogicalPlan) -> Result<Transformed<LogicalPlan>> {
        match &node {
            LogicalPlan::Aggregate(agg) => {
                // Detect windowing functions (tumble, hop, session)
                if let Some(window) = detect_window(&agg.group_expr) {
                    // Windowed aggregate with triggers
                    let windowed = WindowedAggregateNode {
                        window_type: window,
                        group_by: agg.group_expr.clone(),
                        aggregates: agg.aggr_expr.clone(),
                        input_schema: agg.input.schema().clone(),
                    };
                    Ok(Transformed::yes(LogicalPlan::Extension(
                        Extension { node: Arc::new(windowed) }
                    )))
                } else {
                    // Non-windowed: updating aggregate with retraction
                    let updating = UpdatingAggregateNode {
                        group_by: agg.group_expr.clone(),
                        aggregates: agg.aggr_expr.clone(),
                        ttl: Duration::from_secs(3600), // 1 hour default
                    };
                    Ok(Transformed::yes(LogicalPlan::Extension(
                        Extension { node: Arc::new(updating) }
                    )))
                }
            }
            _ => Ok(Transformed::no(node)),
        }
    }
}

/// Apply rewriters in sequence
pub fn rewrite_plan(plan: LogicalPlan, ctx: &PlanContext) -> Result<LogicalPlan> {
    let plan = plan.rewrite(&mut SourceRewriter {
        schema_provider: ctx.schema_provider.clone()
    })?.data;

    let plan = plan.rewrite(&mut AggregateRewriter)?.data;
    let plan = plan.rewrite(&mut JoinRewriter)?.data;
    let plan = plan.rewrite(&mut AsyncUdfRewriter)?.data;

    Ok(plan)
}
```

### AVA Adaptation

For AVA, rewriters map **ChannelPipelineSpec operators** to DataFusion plans:

```rust
/// Rewriter for AVA pipeline operators
pub struct PipelineOperatorRewriter {
    pub operators: Vec<PipelineOperator>,
}

impl TreeNodeRewriter for PipelineOperatorRewriter {
    type Node = LogicalPlan;

    fn f_up(&mut self, node: LogicalPlan) -> Result<Transformed<LogicalPlan>> {
        // Apply AVA pipeline operators: Filter, Project, Aggregate, Join, etc.
        for op in &self.operators {
            match op {
                PipelineOperator::Filter { predicate } => {
                    // Wrap in Filter node
                }
                PipelineOperator::Aggregate { group_by, aggregates } => {
                    // Convert to windowed/updating aggregate
                }
                // ... other operators
            }
        }
        Ok(Transformed::no(node))
    }
}
```

---

## 3. Watermark Propagation

### Pattern Overview

Watermarks track event-time progress through the streaming pipeline. Sources generate watermarks; operators propagate or hold them based on semantics.

### Enabling Technologies

| Crate | Purpose |
|-------|---------|
| `tokio` | Async runtime for timer-based watermarks |
| `chrono` | Timestamp handling |

### Notional Code

```rust
use std::time::Duration;

/// Watermark represents the event-time progress guarantee
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct Watermark {
    /// Timestamp in milliseconds since epoch
    pub timestamp_ms: i64,
    /// Whether this is a final (closing) watermark
    pub is_final: bool,
}

impl Watermark {
    pub fn new(timestamp_ms: i64) -> Self {
        Self { timestamp_ms, is_final: false }
    }

    pub fn final_watermark() -> Self {
        Self { timestamp_ms: i64::MAX, is_final: true }
    }
}

/// Watermark generator at source operators
pub struct WatermarkGenerator {
    /// Column index containing event timestamps
    timestamp_column: usize,
    /// Maximum out-of-orderness allowed
    max_delay: Duration,
    /// Current watermark
    current: Watermark,
}

impl WatermarkGenerator {
    pub fn new(timestamp_column: usize, max_delay: Duration) -> Self {
        Self {
            timestamp_column,
            max_delay,
            current: Watermark::new(0),
        }
    }

    /// Update watermark based on observed timestamps in batch
    pub fn observe_batch(&mut self, batch: &RecordBatch) -> Option<Watermark> {
        let timestamps = batch
            .column(self.timestamp_column)
            .as_any()
            .downcast_ref::<TimestampMillisecondArray>()?;

        let max_ts = timestamps.iter().filter_map(|t| t).max()?;
        let watermark_ts = max_ts - self.max_delay.as_millis() as i64;

        if watermark_ts > self.current.timestamp_ms {
            self.current = Watermark::new(watermark_ts);
            Some(self.current)
        } else {
            None
        }
    }
}

/// Trait for operators that handle watermarks
pub trait WatermarkHandler {
    /// Process incoming watermark, return output watermark (if any)
    fn handle_watermark(&mut self, watermark: Watermark) -> Option<Watermark>;

    /// Get buffered data that can be emitted based on watermark
    fn emit_on_watermark(&mut self, watermark: Watermark) -> Vec<RecordBatch>;
}
```

### AVA Adaptation

For AVA, watermarks enable **continuous materialization** of channels:

```rust
/// AVA channel with watermark tracking
pub struct MaterializedChannel {
    pub channel_id: ChannelId,
    pub role: ChannelRole,
    pub materialization: MaterializationTier,

    /// Current watermark for this channel
    pub watermark: Watermark,

    /// Pending batches waiting for watermark advancement
    pending: Vec<PendingBatch>,
}

impl MaterializedChannel {
    /// Process new data and advance watermark
    pub fn ingest(&mut self, batch: RecordBatch, timestamp_ms: i64) {
        self.pending.push(PendingBatch { batch, timestamp_ms });
    }

    /// Emit data up to watermark
    pub fn emit_to_watermark(&mut self, watermark: Watermark) -> Vec<RecordBatch> {
        let (ready, pending): (Vec<_>, Vec<_>) = self.pending
            .drain(..)
            .partition(|b| b.timestamp_ms <= watermark.timestamp_ms);

        self.pending = pending;
        self.watermark = watermark;

        ready.into_iter().map(|b| b.batch).collect()
    }
}
```

---

## 4. Window Operator Architecture

### Pattern Overview

Arroyo supports three window types: Tumbling, Sliding (Hopping), and Session. Each has distinct triggering and state management semantics.

### Enabling Technologies

| Crate | Purpose |
|-------|---------|
| `datafusion` | Window function execution |
| `hashbrown` | Efficient hash maps for window state |

### Notional Code

```rust
use std::collections::HashMap;
use std::time::Duration;

/// Window type enumeration
#[derive(Debug, Clone)]
pub enum WindowType {
    /// Fixed-size, non-overlapping windows
    Tumbling { size: Duration },

    /// Fixed-size, overlapping windows
    Sliding { size: Duration, slide: Duration },

    /// Dynamic windows based on activity gaps
    Session { gap: Duration },
}

/// Window behavior classification
#[derive(Debug, Clone, Copy)]
pub enum WindowBehavior {
    /// Operator generates window boundaries
    FromOperator,
    /// Windows are encoded in input data
    InData,
}

/// Generic window state manager
pub struct WindowStateManager<K, V> {
    /// Window type configuration
    window_type: WindowType,

    /// State per window key
    windows: HashMap<WindowKey<K>, WindowState<V>>,

    /// Current watermark
    watermark: Watermark,
}

#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct WindowKey<K> {
    pub key: K,
    pub window_start: i64,
    pub window_end: i64,
}

pub struct WindowState<V> {
    pub accumulator: V,
    pub row_count: usize,
    pub last_update: i64,
}

impl<K: Hash + Eq + Clone, V: Default> WindowStateManager<K, V> {
    /// Assign a record to window(s) based on timestamp
    pub fn assign_windows(&self, key: K, timestamp_ms: i64) -> Vec<WindowKey<K>> {
        match &self.window_type {
            WindowType::Tumbling { size } => {
                let size_ms = size.as_millis() as i64;
                let window_start = (timestamp_ms / size_ms) * size_ms;
                vec![WindowKey {
                    key,
                    window_start,
                    window_end: window_start + size_ms,
                }]
            }
            WindowType::Sliding { size, slide } => {
                let size_ms = size.as_millis() as i64;
                let slide_ms = slide.as_millis() as i64;

                // Record belongs to multiple overlapping windows
                let mut windows = Vec::new();
                let earliest_start = timestamp_ms - size_ms + slide_ms;
                let aligned_start = (earliest_start / slide_ms) * slide_ms;

                let mut start = aligned_start;
                while start <= timestamp_ms {
                    if start + size_ms > timestamp_ms {
                        windows.push(WindowKey {
                            key: key.clone(),
                            window_start: start,
                            window_end: start + size_ms,
                        });
                    }
                    start += slide_ms;
                }
                windows
            }
            WindowType::Session { gap } => {
                // Session windows require different state management
                // Handled by SessionWindowOperator
                vec![]
            }
        }
    }

    /// Trigger windows that have closed based on watermark
    pub fn trigger_closed_windows(&mut self, watermark: Watermark) -> Vec<(WindowKey<K>, V)> {
        let closed: Vec<_> = self.windows
            .keys()
            .filter(|k| k.window_end <= watermark.timestamp_ms)
            .cloned()
            .collect();

        closed.into_iter()
            .filter_map(|key| {
                self.windows.remove(&key).map(|state| (key, state.accumulator))
            })
            .collect()
    }
}
```

### AVA Adaptation

For AVA, windows enable **time-based channel views**:

```rust
/// AVA windowed channel specification
pub struct WindowedChannelSpec {
    pub channel_id: ChannelId,
    pub window_type: WindowType,
    pub aggregations: Vec<AggregateExpr>,
    pub trigger: WindowTrigger,
}

/// When to emit window results
pub enum WindowTrigger {
    /// Emit when watermark passes window end
    OnWatermark,
    /// Emit periodically within window
    Processing { interval: Duration },
    /// Emit on every update (for continuous views)
    OnUpdate,
}

impl WindowedChannelSpec {
    /// Create tumbling window channel (e.g., hourly metrics)
    pub fn tumbling(channel_id: ChannelId, size: Duration) -> Self {
        Self {
            channel_id,
            window_type: WindowType::Tumbling { size },
            aggregations: vec![],
            trigger: WindowTrigger::OnWatermark,
        }
    }

    /// Create sliding window channel (e.g., 5-min moving average)
    pub fn sliding(channel_id: ChannelId, size: Duration, slide: Duration) -> Self {
        Self {
            channel_id,
            window_type: WindowType::Sliding { size, slide },
            aggregations: vec![],
            trigger: WindowTrigger::OnWatermark,
        }
    }
}
```

---

## 5. Graph-Based Execution

### Pattern Overview

Arroyo converts the rewritten `LogicalPlan` into a `LogicalGraph` of nodes and edges, enabling distributed execution and checkpointing.

### Enabling Technologies

| Crate | Purpose |
|-------|---------|
| `petgraph` | Graph data structures |
| `tokio` | Async execution runtime |

### Notional Code

```rust
use petgraph::graph::{DiGraph, NodeIndex};
use std::collections::HashMap;

/// Logical execution graph
pub struct LogicalGraph {
    graph: DiGraph<LogicalNode, LogicalEdge>,
    node_indices: HashMap<String, NodeIndex>,
}

/// Node in the execution graph
pub struct LogicalNode {
    pub id: String,
    pub operator: Box<dyn Operator>,
    pub parallelism: usize,
}

/// Edge connecting nodes
pub struct LogicalEdge {
    pub edge_type: EdgeType,
    pub schema: SchemaRef,
}

pub enum EdgeType {
    /// Data flows forward
    Forward,
    /// Data is shuffled by key
    Shuffle { key_indices: Vec<usize> },
    /// Data is broadcast to all downstream tasks
    Broadcast,
}

/// Visitor pattern for converting LogicalPlan → LogicalGraph
pub struct PlanToGraphVisitor {
    graph: LogicalGraph,
    current_inputs: Vec<NodeIndex>,
}

impl PlanToGraphVisitor {
    pub fn visit(&mut self, plan: &LogicalPlan) -> Result<NodeIndex> {
        match plan {
            LogicalPlan::Extension(ext) => {
                // Get AvaExtension from the extension node
                let ava_ext = ext.node
                    .as_any()
                    .downcast_ref::<dyn AvaExtension>()
                    .ok_or(PlanError::NotAvaExtension)?;

                // Convert to graph node
                let NodeWithEdges { node, edges } = ava_ext.plan_node(
                    self.current_inputs.clone()
                )?;

                // Add node to graph
                let idx = self.graph.add_node(node);

                // Add edges from inputs
                for (input_idx, edge) in self.current_inputs.iter().zip(edges) {
                    self.graph.add_edge(*input_idx, idx, edge);
                }

                Ok(idx)
            }
            // Handle other plan types...
            _ => Err(PlanError::UnsupportedPlan),
        }
    }
}
```

### AVA Adaptation

For AVA, the graph represents **View composition**:

```rust
/// AVA View execution graph
pub struct ViewGraph {
    pub view_id: ViewId,
    pub channels: HashMap<ChannelId, ChannelNode>,
    pub edges: Vec<ChannelEdge>,
}

pub struct ChannelNode {
    pub channel_id: ChannelId,
    pub role: ChannelRole,
    pub operator: Box<dyn ChannelOperator>,
}

pub struct ChannelEdge {
    pub from: ChannelId,
    pub to: ChannelId,
    pub join_key: Option<Vec<String>>,
}

impl ViewGraph {
    /// Build graph from ViewProfileSpec
    pub fn from_spec(spec: &ViewProfileSpec) -> Result<Self, CompilationError> {
        let mut graph = Self {
            view_id: spec.id.clone(),
            channels: HashMap::new(),
            edges: Vec::new(),
        };

        for channel_spec in &spec.channels {
            let operator = compile_channel_pipeline(channel_spec)?;
            graph.channels.insert(channel_spec.id.clone(), ChannelNode {
                channel_id: channel_spec.id.clone(),
                role: channel_spec.role,
                operator,
            });

            // Add edges for joins
            if let Some(additional_sources) = &channel_spec.additional_sources {
                for source in additional_sources {
                    graph.edges.push(ChannelEdge {
                        from: ChannelId::new(source.id.as_str()),
                        to: channel_spec.id.clone(),
                        join_key: None, // Determined from pipeline operators
                    });
                }
            }
        }

        Ok(graph)
    }
}
```

---

## 6. Schema Provider Pattern

### Pattern Overview

Arroyo uses `ArroyoSchemaProvider` to implement DataFusion's `ContextProvider`, managing table metadata, functions, and connections.

### Enabling Technologies

| Crate | Purpose |
|-------|---------|
| `datafusion` | `SchemaProvider`, `TableProvider` traits |
| `dashmap` | Concurrent hash map for registry |

### Notional Code

```rust
use datafusion::catalog::SchemaProvider;
use datafusion::datasource::TableProvider;
use dashmap::DashMap;
use std::sync::Arc;

/// AVA Schema Provider - manages view and channel metadata
pub struct AvaSchemaProvider {
    /// Registered tables (sources)
    tables: DashMap<String, Arc<dyn TableProvider>>,

    /// Registered views
    views: DashMap<ViewId, ViewProfileSpec>,

    /// Registered assemblages
    assemblages: DashMap<AssemblageId, AssemblageSpec>,

    /// Custom functions
    functions: DashMap<String, Arc<dyn ScalarUDF>>,
}

impl AvaSchemaProvider {
    pub fn new() -> Self {
        Self {
            tables: DashMap::new(),
            views: DashMap::new(),
            assemblages: DashMap::new(),
            functions: DashMap::new(),
        }
    }

    /// Register a source table
    pub fn register_table(&self, name: &str, table: Arc<dyn TableProvider>) {
        self.tables.insert(name.to_string(), table);
    }

    /// Register a view spec
    pub fn register_view(&self, spec: ViewProfileSpec) {
        self.views.insert(spec.id.clone(), spec);
    }

    /// Get table by name
    pub fn get_table(&self, name: &str) -> Option<Arc<dyn TableProvider>> {
        self.tables.get(name).map(|t| t.clone())
    }
}

impl SchemaProvider for AvaSchemaProvider {
    fn table_names(&self) -> Vec<String> {
        self.tables.iter().map(|e| e.key().clone()).collect()
    }

    fn table(&self, name: &str) -> Option<Arc<dyn TableProvider>> {
        self.get_table(name)
    }
}
```

### AVA Adaptation

For AVA, the schema provider manages **Assemblage-scoped sources**:

```rust
/// Assemblage-aware schema provider
pub struct AssemblageScopedProvider {
    /// Current assemblage context
    assemblage_id: AssemblageId,

    /// Global provider
    global: Arc<AvaSchemaProvider>,

    /// Assemblage-specific overrides
    overrides: DashMap<String, Arc<dyn TableProvider>>,
}

impl AssemblageScopedProvider {
    /// Get table, checking assemblage constraints
    pub fn get_table(&self, name: &str) -> Result<Arc<dyn TableProvider>, AssemblageError> {
        // Check if table is allowed in this assemblage
        let assemblage = self.global.assemblages
            .get(&self.assemblage_id)
            .ok_or(AssemblageError::NotFound {
                assemblage_id: self.assemblage_id.clone()
            })?;

        // Check source constraints
        if let Some(constraint) = assemblage.constraints.iter()
            .find(|c| matches!(c, AssemblageConstraint::AllowedSources { .. }))
        {
            // Validate source is allowed
        }

        // Return table
        self.overrides.get(name)
            .map(|t| t.clone())
            .or_else(|| self.global.get_table(name))
            .ok_or(AssemblageError::NotFound {
                assemblage_id: self.assemblage_id.clone()
            })
    }
}
```

---

## 7. Incremental Aggregation

### Pattern Overview

Arroyo supports incremental (updating) aggregation for non-windowed queries using retraction-based updates and TTL-based state cleanup.

### Enabling Technologies

| Crate | Purpose |
|-------|---------|
| `datafusion` | Aggregate function execution |
| `arrow` | Columnar data representation |

### Notional Code

```rust
use std::time::{Duration, Instant};

/// Updating aggregate state with retraction support
pub struct UpdatingAggregateState<K, A> {
    /// Current aggregate values per key
    state: HashMap<K, AggregateValue<A>>,

    /// TTL for state cleanup
    ttl: Duration,
}

pub struct AggregateValue<A> {
    pub value: A,
    pub last_update: Instant,
    pub version: u64,
}

/// Update types for incremental aggregation
pub enum AggregateUpdate<K, V> {
    /// New or updated value
    Upsert { key: K, value: V, version: u64 },

    /// Retraction (negative update)
    Retract { key: K, previous_value: V, version: u64 },
}

impl<K: Hash + Eq + Clone, A: Clone + Default> UpdatingAggregateState<K, A> {
    /// Process incoming batch and emit updates
    pub fn process_batch<F>(
        &mut self,
        batch: &RecordBatch,
        key_extractor: F,
        aggregator: &dyn Aggregator<A>,
    ) -> Vec<AggregateUpdate<K, A>>
    where
        F: Fn(&RecordBatch, usize) -> K,
    {
        let mut updates = Vec::new();

        for row_idx in 0..batch.num_rows() {
            let key = key_extractor(batch, row_idx);

            // Get or create state
            let entry = self.state.entry(key.clone())
                .or_insert_with(|| AggregateValue {
                    value: A::default(),
                    last_update: Instant::now(),
                    version: 0,
                });

            // Emit retraction for previous value
            if entry.version > 0 {
                updates.push(AggregateUpdate::Retract {
                    key: key.clone(),
                    previous_value: entry.value.clone(),
                    version: entry.version,
                });
            }

            // Update aggregate
            aggregator.accumulate(&mut entry.value, batch, row_idx);
            entry.last_update = Instant::now();
            entry.version += 1;

            // Emit new value
            updates.push(AggregateUpdate::Upsert {
                key,
                value: entry.value.clone(),
                version: entry.version,
            });
        }

        updates
    }

    /// Cleanup expired state based on TTL
    pub fn cleanup_expired(&mut self) -> Vec<AggregateUpdate<K, A>> {
        let now = Instant::now();
        let expired: Vec<_> = self.state.iter()
            .filter(|(_, v)| now.duration_since(v.last_update) > self.ttl)
            .map(|(k, _)| k.clone())
            .collect();

        expired.into_iter()
            .filter_map(|key| {
                self.state.remove(&key).map(|v| AggregateUpdate::Retract {
                    key,
                    previous_value: v.value,
                    version: v.version,
                })
            })
            .collect()
    }
}
```

### AVA Adaptation

For AVA, incremental aggregation enables **live dashboard channels**:

```rust
/// Live metrics channel with incremental updates
pub struct LiveMetricsChannel {
    pub channel_id: ChannelId,
    pub aggregates: Vec<AggregateExpr>,
    pub state: UpdatingAggregateState<String, MetricValue>,
    pub subscribers: Vec<Subscriber>,
}

impl LiveMetricsChannel {
    /// Process new data and push updates to subscribers
    pub async fn ingest(&mut self, batch: RecordBatch) -> Result<(), ChannelError> {
        let updates = self.state.process_batch(
            &batch,
            |b, i| extract_asset_id(b, i),
            &self.aggregates,
        );

        // Push updates to subscribers
        for subscriber in &self.subscribers {
            subscriber.send_updates(&updates).await?;
        }

        Ok(())
    }
}
```

---

## Summary: AVA Design Implications

| Arroyo Pattern | AVA Adaptation | Key Benefit |
|----------------|----------------|-------------|
| Extension Trait | `ChannelExtension` | Custom streaming operators per channel |
| Plan Rewriter | `PipelineOperatorRewriter` | Transform channel specs to DataFusion plans |
| Watermarks | `MaterializedChannel` | Event-time progress for continuous views |
| Window Operators | `WindowedChannelSpec` | Time-based aggregation for metrics |
| Graph Execution | `ViewGraph` | Multi-channel view composition |
| Schema Provider | `AssemblageScopedProvider` | Assemblage-constrained source access |
| Incremental Agg | `LiveMetricsChannel` | Real-time dashboard updates |

---

## Next Steps for AVA

1. **Implement `AvaExtension` trait** in `ava-domain/traits.rs`
2. **Create rewriter pipeline** in `ava-compiler`
3. **Add watermark support** to `MaterializationTier::Continuous`
4. **Implement window operators** for metric channels
5. **Build `ViewGraph`** execution model in `ava-reconciler`

---

*Document generated for AVA design reference. Based on Arroyo v0.x architecture.*
