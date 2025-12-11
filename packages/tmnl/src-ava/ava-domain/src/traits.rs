//! Core AVA Traits
//!
//! These traits define the extensibility points of the AVA runtime.
//! Implementors can provide custom data sources, compilers, reconcilers, and journals.
//!
//! # Design Principles
//!
//! - All traits use `async_trait` for async method support
//! - Dynamic dispatch via `Arc<dyn Trait>` for runtime extensibility
//! - Associated types for compile-time type safety where possible
//! - Error types are domain-specific for rich error handling

use std::sync::Arc;
use async_trait::async_trait;

use crate::ids::{SourceId, ViewId, ChannelId, EventSequence};
use crate::channels::{SourceKind, ChannelPipelineSpec};
use crate::views::{ViewProfileSpec, ViewArtifact, ViewDelta};
use crate::events::{ReconcilerEvent, FiberAction, Lane, EventLogEntry};
use crate::errors::{SourceError, ChannelError, ViewError, ReconcilerError};

// ============================================================================
// T1: SourceAdapter - Data source abstraction
// ============================================================================

/// Adapter trait for heterogeneous data sources.
///
/// Implementations provide connectivity to different data backends:
/// SQL databases, streaming sources, REST APIs, graph databases, etc.
///
/// # Example
///
/// ```ignore
/// #[derive(SourceAdapter)]
/// #[source_adapter(kind = "sql")]
/// struct PostgresSource {
///     id: SourceId,
///     pool: PgPool,
/// }
///
/// #[async_trait]
/// impl SourceAdapter for PostgresSource {
///     async fn query(&self, query: &str) -> Result<RecordBatch, SourceError> {
///         // Execute query against pool
///     }
/// }
/// ```
#[async_trait]
pub trait SourceAdapter: Send + Sync {
    /// Returns the source kind (sql, stream, api, etc.)
    fn kind(&self) -> SourceKind;

    /// Returns the unique source identifier
    fn id(&self) -> &SourceId;

    /// Establishes connection to the data source
    async fn connect(&mut self) -> Result<(), SourceError>;

    /// Closes connection to the data source
    async fn disconnect(&mut self) -> Result<(), SourceError>;

    /// Executes a query and returns results as Arrow RecordBatch
    async fn query(&self, query: &str) -> Result<arrow::array::RecordBatch, SourceError>;

    /// Returns the schema of the data source
    async fn schema(&self) -> Result<arrow::datatypes::SchemaRef, SourceError>;

    /// Subscribes to changes from the data source (for streaming sources)
    /// Default implementation returns unsupported error
    async fn subscribe(
        &self,
        _callback: Box<dyn Fn(arrow::array::RecordBatch) + Send + Sync>,
    ) -> Result<SubscriptionHandle, SourceError> {
        Err(SourceError::UnsupportedOperation {
            source_id: self.id().clone(),
            operation: "subscribe".into(),
        })
    }
}

/// Handle for managing active subscriptions
pub struct SubscriptionHandle {
    /// Unique subscription ID
    pub id: String,
    /// Cancellation token
    cancel: Option<Box<dyn FnOnce() + Send>>,
}

impl SubscriptionHandle {
    /// Creates a new subscription handle
    pub fn new(id: impl Into<String>, cancel: impl FnOnce() + Send + 'static) -> Self {
        Self {
            id: id.into(),
            cancel: Some(Box::new(cancel)),
        }
    }

    /// Cancels the subscription
    pub fn cancel(mut self) {
        if let Some(cancel) = self.cancel.take() {
            cancel();
        }
    }
}

/// Type alias for boxed source adapters
pub type DynSourceAdapter = Arc<dyn SourceAdapter>;

// ============================================================================
// T2: ChannelCompiler - Pipeline compilation
// ============================================================================

/// Compiler trait for channel pipeline specifications.
///
/// Transforms `ChannelPipelineSpec` into executable plans using DataFusion.
///
/// # Compilation Phases
///
/// 1. **Validation** - Check spec validity (sources exist, operators valid)
/// 2. **Logical Planning** - Build logical query plan
/// 3. **Optimization** - Apply query optimizations
/// 4. **Physical Planning** - Generate executable plan
#[async_trait]
pub trait ChannelCompiler: Send + Sync {
    /// Validates a channel pipeline specification
    async fn validate(&self, spec: &ChannelPipelineSpec) -> Result<(), ChannelError>;

    /// Compiles a channel spec into a logical plan
    async fn compile_logical(
        &self,
        spec: &ChannelPipelineSpec,
    ) -> Result<LogicalPlan, ChannelError>;

    /// Optimizes a logical plan
    async fn optimize(&self, plan: LogicalPlan) -> Result<LogicalPlan, ChannelError>;

    /// Compiles a logical plan into a physical plan
    async fn compile_physical(
        &self,
        plan: LogicalPlan,
    ) -> Result<PhysicalPlan, ChannelError>;

    /// Full compilation pipeline: validate → logical → optimize → physical
    async fn compile(&self, spec: &ChannelPipelineSpec) -> Result<PhysicalPlan, ChannelError> {
        self.validate(spec).await?;
        let logical = self.compile_logical(spec).await?;
        let optimized = self.optimize(logical).await?;
        self.compile_physical(optimized).await
    }
}

/// Logical query plan (DataFusion LogicalPlan wrapper)
#[derive(Debug, Clone)]
pub struct LogicalPlan {
    /// The underlying DataFusion logical plan (opaque for now)
    pub inner: String, // TODO: Replace with datafusion::logical_expr::LogicalPlan
}

/// Physical execution plan (DataFusion ExecutionPlan wrapper)
#[derive(Debug, Clone)]
pub struct PhysicalPlan {
    /// The underlying DataFusion physical plan (opaque for now)
    pub inner: String, // TODO: Replace with Arc<dyn datafusion::physical_plan::ExecutionPlan>
}

/// Type alias for boxed channel compilers
pub type DynChannelCompiler = Arc<dyn ChannelCompiler>;

// ============================================================================
// T3: ViewReconciler - State reconciliation
// ============================================================================

/// Reconciler trait for view state management.
///
/// Implements the core reconciliation loop that brings actual state
/// toward desired state by producing `FiberAction`s.
///
/// # Reconciliation Model
///
/// ```text
/// Desired State (ViewProfileSpec)
///         │
///         ▼
///    ┌─────────┐
///    │  diff() │──── Computes delta between desired and actual
///    └────┬────┘
///         │
///         ▼
///    ┌─────────┐
///    │ tick()  │──── Produces FiberActions from delta
///    └────┬────┘
///         │
///         ▼
///    ┌─────────┐
///    │ apply() │──── Executes actions against actual state
///    └────┬────┘
///         │
///         ▼
/// Actual State (ViewArtifact)
/// ```
#[async_trait]
pub trait ViewReconciler: Send + Sync {
    /// Computes the difference between desired and actual state
    async fn diff(
        &self,
        desired: &ViewProfileSpec,
        actual: Option<&ViewArtifact>,
    ) -> Result<ViewDelta, ViewError>;

    /// Produces the next action based on current state and pending work
    async fn tick(
        &self,
        view_id: &ViewId,
        lane: Lane,
    ) -> Result<FiberAction, ReconcilerError>;

    /// Applies a fiber action to update actual state
    async fn apply(
        &self,
        action: FiberAction,
    ) -> Result<Option<ReconcilerEvent>, ReconcilerError>;

    /// Returns the current reconciliation lane for a view
    fn lane(&self, view_id: &ViewId) -> Lane;

    /// Sets the reconciliation lane for a view
    fn set_lane(&mut self, view_id: &ViewId, lane: Lane);
}

/// Type alias for boxed view reconcilers
pub type DynViewReconciler = Arc<dyn ViewReconciler>;

// ============================================================================
// T4: EventJournal - Event persistence
// ============================================================================

/// Journal trait for event persistence and replay.
///
/// Provides durable storage for reconciler events, enabling:
/// - State recovery after restarts
/// - Audit trails
/// - Event replay for debugging
/// - Compaction for space efficiency
///
/// # Consistency Model
///
/// Events are durably persisted before acknowledgment.
/// Sequence numbers are monotonically increasing and unique.
#[async_trait]
pub trait EventJournal: Send + Sync {
    /// Appends an event to the journal, returns assigned sequence number
    async fn append(&self, event: ReconcilerEvent) -> Result<EventSequence, ReconcilerError>;

    /// Reads events starting from a sequence number
    async fn read_from(
        &self,
        from: EventSequence,
        limit: usize,
    ) -> Result<Vec<EventLogEntry>, ReconcilerError>;

    /// Reads events for a specific view
    async fn read_by_view(
        &self,
        view_id: &ViewId,
        limit: usize,
    ) -> Result<Vec<EventLogEntry>, ReconcilerError>;

    /// Returns the latest sequence number in the journal
    async fn latest_sequence(&self) -> Result<EventSequence, ReconcilerError>;

    /// Compacts the journal, removing old events up to sequence
    async fn compact(&self, up_to: EventSequence) -> Result<u64, ReconcilerError>;

    /// Truncates all events (dangerous - for testing only)
    async fn truncate(&self) -> Result<(), ReconcilerError>;
}

/// Type alias for boxed event journals
pub type DynEventJournal = Arc<dyn EventJournal>;

// ============================================================================
// Composite: ViewRuntime (combines all traits)
// ============================================================================

/// Composite runtime that coordinates sources, compilation, reconciliation, and journaling.
///
/// This is the main entry point for the AVA runtime.
#[async_trait]
pub trait ViewRuntime: Send + Sync {
    /// Registers a source adapter
    async fn register_source(&self, source: DynSourceAdapter) -> Result<(), SourceError>;

    /// Mounts a view from a profile spec
    async fn mount(&self, spec: ViewProfileSpec) -> Result<ViewArtifact, ViewError>;

    /// Updates a mounted view
    async fn update(&self, view_id: &ViewId, delta: ViewDelta) -> Result<(), ViewError>;

    /// Suspends a view (pauses reconciliation)
    async fn suspend(&self, view_id: &ViewId) -> Result<(), ViewError>;

    /// Resumes a suspended view
    async fn resume(&self, view_id: &ViewId) -> Result<(), ViewError>;

    /// Unmounts a view
    async fn unmount(&self, view_id: &ViewId) -> Result<(), ViewError>;

    /// Gets the current artifact for a view
    async fn artifact(&self, view_id: &ViewId) -> Result<Option<ViewArtifact>, ViewError>;

    /// Runs one reconciliation tick for all active views
    async fn tick(&self) -> Result<Vec<FiberAction>, ReconcilerError>;
}

/// Type alias for boxed view runtimes
pub type DynViewRuntime = Arc<dyn ViewRuntime>;

#[cfg(test)]
mod tests {
    use super::*;

    // Compile-time test that traits are object-safe
    fn _assert_object_safety() {
        fn _source(_: &dyn SourceAdapter) {}
        fn _compiler(_: &dyn ChannelCompiler) {}
        fn _reconciler(_: &dyn ViewReconciler) {}
        fn _journal(_: &dyn EventJournal) {}
        fn _runtime(_: &dyn ViewRuntime) {}
    }
}
