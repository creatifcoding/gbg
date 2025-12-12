//! AvaRuntime - Central orchestrator for view lifecycle management
//!
//! The runtime coordinates:
//! - SpecRegistry: ViewProfileSpec storage
//! - Reconciler: View lifecycle state machines
//! - ViewCompiler: Spec → DataFusion plan compilation
//! - AdapterRegistry: Source adapter management
//! - SessionContext: DataFusion execution

use std::sync::Arc;
use std::collections::HashMap;

use arrow::array::RecordBatch;
use datafusion::prelude::*;
use tokio::sync::RwLock;

use ava_domain::{
    ViewProfileSpec, ViewId, ViewArtifact, Lane, ChannelBinding,
    FiberAction, UnmountReason, ChannelRole,
};
use ava_reconciler::v1::{Reconciler, FiberState, DiffResult, EventLog, QueueStats};
use ava_compiler::ViewCompiler;
use ava_adapters::AdapterRegistry;

use crate::error::RuntimeError;
use crate::spec_registry::SpecRegistry;

/// Runtime configuration
#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    /// Maximum concurrent compilations
    pub max_concurrent_compiles: usize,

    /// Default lane for new requests
    pub default_lane: Lane,

    /// Enable event log compaction
    pub enable_compaction: bool,

    /// Compaction threshold (number of events)
    pub compaction_threshold: usize,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            max_concurrent_compiles: 4,
            default_lane: Lane::Background,
            enable_compaction: true,
            compaction_threshold: 1000,
        }
    }
}

/// Central orchestrator for AVA view lifecycle
pub struct AvaRuntime {
    /// Configuration
    config: RuntimeConfig,

    /// Spec registry for ViewProfileSpec storage
    spec_registry: SpecRegistry,

    /// Reconciler for view lifecycle management
    reconciler: Reconciler,

    /// Compiler for translating specs to DataFusion plans
    compiler: ViewCompiler,

    /// Adapter registry for source management
    adapters: Arc<RwLock<AdapterRegistry>>,

    /// DataFusion session context for execution
    session: Arc<RwLock<SessionContext>>,

    /// Compiled SQL cache (view_id -> compiled SQL)
    compiled_cache: Arc<RwLock<HashMap<ViewId, String>>>,
}

impl AvaRuntime {
    /// Create a new runtime with the given configuration
    pub fn new(config: RuntimeConfig) -> Self {
        Self {
            config,
            spec_registry: SpecRegistry::new(),
            reconciler: Reconciler::new(),
            compiler: ViewCompiler::new("source"),
            adapters: Arc::new(RwLock::new(AdapterRegistry::new())),
            session: Arc::new(RwLock::new(SessionContext::new())),
            compiled_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Create a runtime with custom time provider
    pub fn with_time_provider<F>(config: RuntimeConfig, time_provider: F) -> Self
    where
        F: Fn() -> f64 + Send + Sync + 'static,
    {
        Self {
            config,
            spec_registry: SpecRegistry::new(),
            reconciler: Reconciler::with_time_provider(Box::new(time_provider)),
            compiler: ViewCompiler::new("source"),
            adapters: Arc::new(RwLock::new(AdapterRegistry::new())),
            session: Arc::new(RwLock::new(SessionContext::new())),
            compiled_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    // ========================================================================
    // Spec Registry Operations
    // ========================================================================

    /// Register a new spec in the registry
    pub fn register_spec(&self, spec: ViewProfileSpec) -> Result<(), RuntimeError> {
        self.spec_registry.register(spec)
    }

    /// Update an existing spec
    pub fn update_spec(&self, spec: ViewProfileSpec) -> Result<ViewProfileSpec, RuntimeError> {
        self.spec_registry.update(spec)
    }

    /// Get a spec by view ID
    pub fn get_spec(&self, view_id: &ViewId) -> Result<Option<ViewProfileSpec>, RuntimeError> {
        self.spec_registry.get(view_id)
    }

    /// List all registered specs
    pub fn list_specs(&self) -> Result<Vec<ViewProfileSpec>, RuntimeError> {
        self.spec_registry.list()
    }

    /// Get the spec registry reference
    pub fn spec_registry(&self) -> &SpecRegistry {
        &self.spec_registry
    }

    // ========================================================================
    // View Lifecycle Operations
    // ========================================================================

    /// Request a new view instantiation
    ///
    /// If the spec is not already registered, it will be registered first.
    /// Returns the view ID for tracking.
    pub async fn request_view(
        &self,
        spec: ViewProfileSpec,
        lane: Option<Lane>,
    ) -> Result<ViewId, RuntimeError> {
        let view_id = spec.id.clone();
        let lane = lane.unwrap_or(self.config.default_lane);

        // Register spec if not already registered
        if !self.spec_registry.contains(&view_id)? {
            self.spec_registry.register(spec.clone())?;
        }

        // Request via reconciler
        self.reconciler.request(spec, lane).await?;

        Ok(view_id)
    }

    /// Request a view by ID (must be pre-registered)
    pub async fn request_view_by_id(
        &self,
        view_id: &ViewId,
        lane: Option<Lane>,
    ) -> Result<(), RuntimeError> {
        let spec = self.spec_registry.get(view_id)?
            .ok_or_else(|| RuntimeError::SpecNotFound(view_id.as_str().to_string()))?;

        let lane = lane.unwrap_or(self.config.default_lane);

        self.reconciler.request(spec, lane).await?;

        Ok(())
    }

    /// Update an existing view with a new spec version
    pub async fn update_view(&self, spec: ViewProfileSpec) -> Result<(), RuntimeError> {
        let view_id = spec.id.clone();

        // Update in registry
        self.spec_registry.update(spec.clone())?;

        // Update via reconciler
        self.reconciler.update(spec).await?;

        // Invalidate compiled cache
        let mut cache = self.compiled_cache.write().await;
        cache.remove(&view_id);

        Ok(())
    }

    /// Unmount a view
    pub async fn unmount_view(
        &self,
        view_id: &ViewId,
        reason: UnmountReason,
    ) -> Result<(), RuntimeError> {
        self.reconciler.unmount(view_id.clone(), reason).await?;

        // Remove from compiled cache
        let mut cache = self.compiled_cache.write().await;
        cache.remove(view_id);

        Ok(())
    }

    /// Get the current artifact for a view
    ///
    /// Returns None if the view is not mounted or doesn't exist.
    pub async fn get_artifact(&self, view_id: &ViewId) -> Result<Option<ViewArtifact>, RuntimeError> {
        let fiber = match self.reconciler.get_fiber(view_id).await {
            Some(f) => f,
            None => return Ok(None),
        };

        // Only return artifact if mounted
        match &fiber.state {
            FiberState::Mounted => Ok(fiber.artifact.clone()),
            _ => Ok(None),
        }
    }

    /// Get the fiber state for a view
    pub async fn get_view_state(&self, view_id: &ViewId) -> Result<Option<FiberState>, RuntimeError> {
        Ok(self.reconciler.get_fiber(view_id).await.map(|f| f.state.clone()))
    }

    /// List all active view IDs
    pub async fn active_view_ids(&self) -> Vec<ViewId> {
        self.reconciler.active_view_ids().await
    }

    // ========================================================================
    // Tick Operations (Work Processing)
    // ========================================================================

    /// Process a single scheduled work item
    ///
    /// Returns the processed action if any work was available.
    pub async fn tick(&self) -> Result<Option<FiberAction>, RuntimeError> {
        let action = self.reconciler.tick().await;

        if let Some(ref action) = action {
            // Handle compile actions by actually compiling
            if let FiberAction::Compile { spec, .. } = action {
                self.handle_compile(spec).await?;
            }
        }

        Ok(action)
    }

    /// Process all pending work items
    ///
    /// Returns the list of processed actions.
    pub async fn tick_all(&self) -> Result<Vec<FiberAction>, RuntimeError> {
        let mut actions = Vec::new();

        loop {
            let action = self.tick().await?;
            match action {
                Some(a) => actions.push(a),
                None => break,
            }
        }

        Ok(actions)
    }

    /// Handle a compile action by actually compiling the spec
    async fn handle_compile(&self, spec: &ViewProfileSpec) -> Result<(), RuntimeError> {
        // Compile each channel in the spec
        for channel in &spec.channels {
            let compiled = self.compiler.compile(channel)
                .map_err(|e| RuntimeError::compilation_failed(&spec.id, e.to_string()))?;

            // Cache the compiled SQL
            let mut cache = self.compiled_cache.write().await;
            cache.insert(spec.id.clone(), compiled.sql);
        }

        Ok(())
    }

    // ========================================================================
    // Execution Operations
    // ========================================================================

    /// Execute a view and return the results
    ///
    /// The view must be mounted for execution to succeed.
    pub async fn execute_view(&self, view_id: &ViewId) -> Result<Vec<RecordBatch>, RuntimeError> {
        // Get the artifact
        let artifact = self.get_artifact(view_id).await?
            .ok_or_else(|| RuntimeError::view_not_found(view_id))?;

        // Get compiled SQL from cache or compile now
        let sql = {
            let cache = self.compiled_cache.read().await;
            cache.get(view_id).cloned()
        };

        let sql = match sql {
            Some(s) => s,
            None => {
                // Compile the first channel (state channel)
                let state_channel = artifact.spec.channel_by_role(ChannelRole::State)
                    .or_else(|| artifact.spec.channels.first())
                    .ok_or_else(|| RuntimeError::execution_failed(view_id, "No channels in spec"))?;

                let compiled = self.compiler.compile(state_channel)
                    .map_err(|e| RuntimeError::compilation_failed(view_id, e.to_string()))?;

                // Cache it
                let mut cache = self.compiled_cache.write().await;
                cache.insert(view_id.clone(), compiled.sql.clone());

                compiled.sql
            }
        };

        // Execute the SQL
        let session = self.session.read().await;
        let df = session.sql(&sql).await?;
        let batches = df.collect().await?;

        Ok(batches)
    }

    // ========================================================================
    // Reconciliation Operations
    // ========================================================================

    /// Run a full reconciliation cycle
    ///
    /// Compares desired specs (from registry) against active views and
    /// produces actions to sync them.
    pub async fn reconcile(&self) -> Result<DiffResult, RuntimeError> {
        let result = self.reconciler.reconcile().await;
        Ok(result)
    }

    // ========================================================================
    // Adapter Operations
    // ========================================================================

    /// Get the adapter registry
    pub fn adapters(&self) -> Arc<RwLock<AdapterRegistry>> {
        self.adapters.clone()
    }

    /// Get the DataFusion session context
    pub fn session(&self) -> Arc<RwLock<SessionContext>> {
        self.session.clone()
    }

    // ========================================================================
    // Lifecycle Management
    // ========================================================================

    /// Mark a view as successfully mounted
    pub async fn mark_mounted(
        &self,
        view_id: &ViewId,
        artifact: ViewArtifact,
    ) -> Result<(), RuntimeError> {
        self.reconciler.mark_mounted(view_id, artifact).await?;
        Ok(())
    }

    /// Mark a view as failed
    pub async fn mark_failed(&self, view_id: &ViewId, error: String) -> Result<(), RuntimeError> {
        self.reconciler.mark_failed(view_id, error).await?;

        // Remove from compiled cache
        let mut cache = self.compiled_cache.write().await;
        cache.remove(view_id);

        Ok(())
    }

    // ========================================================================
    // Event Log Operations
    // ========================================================================

    /// Get the event log reference
    pub fn event_log(&self) -> &Arc<EventLog> {
        self.reconciler.event_log()
    }

    /// Get all events from the log
    pub async fn events(&self) -> Vec<ava_domain::EventLogEntry> {
        self.reconciler.event_log().all().await
    }

    /// Compact the event log if threshold exceeded
    pub async fn maybe_compact(&self) -> Result<usize, RuntimeError> {
        if !self.config.enable_compaction {
            return Ok(0);
        }

        let event_log = self.reconciler.event_log();
        let events = event_log.all().await;

        if events.len() < self.config.compaction_threshold {
            return Ok(0);
        }

        // Compact up to the latest sequence
        let latest = event_log.latest_sequence().await;
        let compacted = event_log.compact(latest).await;

        Ok(compacted)
    }

    // ========================================================================
    // Scheduler Operations
    // ========================================================================

    /// Get scheduler statistics
    pub async fn scheduler_stats(&self) -> QueueStats {
        self.reconciler.scheduler().queue_stats().await
    }

    // ========================================================================
    // Helper Methods
    // ========================================================================

    /// Create an artifact from a spec
    pub fn create_artifact(spec: &ViewProfileSpec) -> ViewArtifact {
        let bindings: Vec<ChannelBinding> = spec.channels.iter().map(|c| {
            ChannelBinding {
                channel_id: c.id.clone(),
                role: c.role,
                active: false,
                row_count: None,
                last_updated_ms: None,
            }
        }).collect();

        ViewArtifact {
            view_id: spec.id.clone(),
            asset_id: None,
            spec: spec.clone(),
            channel_bindings: bindings,
            created_at_ms: 0.0, // Will be set by caller
            logical_version: spec.version,
        }
    }
}

impl Default for AvaRuntime {
    fn default() -> Self {
        Self::new(RuntimeConfig::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use ava_domain::{AssemblageId, ChannelPipelineSpec, ChannelId, SourceSpec, SourceId, SourceKind, MaterializationTier};

    fn make_spec(id: &str, version: u32) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(id),
            name: format!("View {}", id),
            description: Some(format!("Version {}", version)),
            assemblage_id: AssemblageId::new("test"),
            channels: vec![make_channel("state")],
            tags: HashMap::new(),
            version,
        }
    }

    fn make_channel(id: &str) -> ChannelPipelineSpec {
        ChannelPipelineSpec {
            id: ChannelId::new(id),
            role: ChannelRole::State,
            source: SourceSpec {
                id: SourceId::new("main"),
                kind: SourceKind::Stream,
                connection: "memory://test".into(),
                schema: None,
            },
            additional_sources: vec![],
            pipeline: vec![],
            materialization: MaterializationTier::Cached,
            refresh_ms: Some(1000),
        }
    }

    fn make_artifact(spec: &ViewProfileSpec) -> ViewArtifact {
        AvaRuntime::create_artifact(spec)
    }

    #[tokio::test]
    async fn test_new_runtime() {
        let runtime = AvaRuntime::new(RuntimeConfig::default());
        assert!(runtime.spec_registry.is_empty().unwrap());
    }

    #[tokio::test]
    async fn test_default_runtime() {
        let runtime = AvaRuntime::default();
        assert!(runtime.spec_registry.is_empty().unwrap());
    }

    #[tokio::test]
    async fn test_register_spec() {
        let runtime = AvaRuntime::default();
        let spec = make_spec("view-1", 1);

        runtime.register_spec(spec).unwrap();

        assert_eq!(runtime.spec_registry.len().unwrap(), 1);
    }

    #[tokio::test]
    async fn test_get_spec() {
        let runtime = AvaRuntime::default();
        let spec = make_spec("view-1", 1);

        runtime.register_spec(spec).unwrap();

        let retrieved = runtime.get_spec(&ViewId::new("view-1")).unwrap();
        assert!(retrieved.is_some());
        assert_eq!(retrieved.unwrap().name, "View view-1");
    }

    #[tokio::test]
    async fn test_request_view() {
        let runtime = AvaRuntime::default();
        let spec = make_spec("view-1", 1);

        let view_id = runtime.request_view(spec, None).await.unwrap();

        assert_eq!(view_id, ViewId::new("view-1"));

        // Spec should be registered
        assert!(runtime.spec_registry.contains(&view_id).unwrap());

        // Process the compile action to create the fiber
        runtime.tick().await.unwrap();

        // View should be pending (just compiled, not mounted yet)
        let state = runtime.get_view_state(&view_id).await.unwrap();
        assert!(matches!(state, Some(FiberState::Pending)));
    }

    #[tokio::test]
    async fn test_request_view_with_lane() {
        let runtime = AvaRuntime::default();
        let spec = make_spec("view-1", 1);

        runtime.request_view(spec, Some(Lane::HardRealTime)).await.unwrap();

        let stats = runtime.scheduler_stats().await;
        assert_eq!(stats.hard_rt, 1);
    }

    #[tokio::test]
    async fn test_request_view_by_id() {
        let runtime = AvaRuntime::default();
        let spec = make_spec("view-1", 1);

        // Register first
        runtime.register_spec(spec).unwrap();

        // Then request by ID
        runtime.request_view_by_id(&ViewId::new("view-1"), None).await.unwrap();

        // Process the compile action to create the fiber
        runtime.tick().await.unwrap();

        let state = runtime.get_view_state(&ViewId::new("view-1")).await.unwrap();
        assert!(matches!(state, Some(FiberState::Pending)));
    }

    #[tokio::test]
    async fn test_request_view_by_id_not_found() {
        let runtime = AvaRuntime::default();

        let result = runtime.request_view_by_id(&ViewId::new("nonexistent"), None).await;

        assert!(matches!(result, Err(RuntimeError::SpecNotFound(_))));
    }

    #[tokio::test]
    async fn test_tick_processes_compile() {
        let runtime = AvaRuntime::default();
        let spec = make_spec("view-1", 1);

        runtime.request_view(spec, None).await.unwrap();

        let action = runtime.tick().await.unwrap();

        assert!(matches!(action, Some(FiberAction::Compile { .. })));
    }

    #[tokio::test]
    async fn test_tick_all() {
        let runtime = AvaRuntime::default();

        for i in 0..5 {
            let spec = make_spec(&format!("view-{}", i), 1);
            runtime.request_view(spec, None).await.unwrap();
        }

        let actions = runtime.tick_all().await.unwrap();

        assert_eq!(actions.len(), 5);
    }

    #[tokio::test]
    async fn test_get_artifact_not_mounted() {
        let runtime = AvaRuntime::default();
        let spec = make_spec("view-1", 1);

        runtime.request_view(spec, None).await.unwrap();

        // Not mounted yet
        let artifact = runtime.get_artifact(&ViewId::new("view-1")).await.unwrap();
        assert!(artifact.is_none());
    }

    #[tokio::test]
    async fn test_unmount_view() {
        let runtime = AvaRuntime::default();
        let spec = make_spec("view-1", 1);
        let view_id = ViewId::new("view-1");

        runtime.request_view(spec, None).await.unwrap();

        // Process the compile action to create the fiber
        runtime.tick().await.unwrap();

        // Schedule the unmount
        runtime.unmount_view(&view_id, UnmountReason::ClientRequest).await.unwrap();

        // Process the unmount action to remove the fiber
        runtime.tick().await.unwrap();

        // View should be gone after unmount is processed
        let state = runtime.get_view_state(&view_id).await.unwrap();
        assert!(state.is_none());
    }

    #[tokio::test]
    async fn test_mark_failed() {
        let runtime = AvaRuntime::default();
        let spec = make_spec("view-1", 1);
        let view_id = ViewId::new("view-1");

        runtime.request_view(spec, None).await.unwrap();

        // Process the compile action to create the fiber
        runtime.tick().await.unwrap();

        runtime.mark_failed(&view_id, "Test error".into()).await.unwrap();

        let state = runtime.get_view_state(&view_id).await.unwrap();
        assert!(matches!(state, Some(FiberState::Failed { .. })));
    }

    #[tokio::test]
    async fn test_active_view_ids() {
        let runtime = AvaRuntime::default();

        for i in 0..3 {
            let spec = make_spec(&format!("view-{}", i), 1);
            runtime.request_view(spec, None).await.unwrap();
        }

        // Process all compile actions to create the fibers
        runtime.tick_all().await.unwrap();

        let ids = runtime.active_view_ids().await;
        assert_eq!(ids.len(), 3);
    }

    #[tokio::test]
    async fn test_event_log() {
        let runtime = AvaRuntime::default();
        let spec = make_spec("view-1", 1);

        runtime.request_view(spec, None).await.unwrap();

        let events = runtime.events().await;
        assert!(!events.is_empty());
    }

    #[tokio::test]
    async fn test_scheduler_stats() {
        let runtime = AvaRuntime::default();

        for i in 0..3 {
            let spec = make_spec(&format!("view-{}", i), 1);
            runtime.request_view(spec, Some(Lane::Background)).await.unwrap();
        }

        let stats = runtime.scheduler_stats().await;
        assert_eq!(stats.background, 3);
    }

    #[tokio::test]
    async fn test_create_artifact() {
        let spec = make_spec("view-1", 1);
        let artifact = AvaRuntime::create_artifact(&spec);

        assert_eq!(artifact.view_id, spec.id);
        assert_eq!(artifact.logical_version, spec.version);
        assert_eq!(artifact.channel_bindings.len(), 1);
    }

    #[tokio::test]
    async fn test_config_custom() {
        let config = RuntimeConfig {
            max_concurrent_compiles: 8,
            default_lane: Lane::SoftRealTime,
            enable_compaction: false,
            compaction_threshold: 500,
        };

        let runtime = AvaRuntime::new(config.clone());

        // Request with default lane should use SoftRealTime
        let spec = make_spec("view-1", 1);
        runtime.request_view(spec, None).await.unwrap();

        let stats = runtime.scheduler_stats().await;
        assert_eq!(stats.soft_rt, 1);
    }

    #[tokio::test]
    async fn test_concurrent_requests() {
        use tokio::task::JoinSet;

        let runtime = Arc::new(AvaRuntime::default());
        let mut tasks = JoinSet::new();

        for i in 0..10 {
            let rt = runtime.clone();
            tasks.spawn(async move {
                let spec = make_spec(&format!("view-{}", i), 1);
                rt.request_view(spec, None).await
            });
        }

        while let Some(result) = tasks.join_next().await {
            result.unwrap().unwrap();
        }

        assert_eq!(runtime.spec_registry.len().unwrap(), 10);
    }
}
