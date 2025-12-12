//! AvaRuntimeV2 - Event-driven reactive streaming orchestrator
//!
//! The v2 runtime coordinates:
//! - SpecRegistry: ViewProfileSpec storage
//! - ReconcilerV2: Event-driven view lifecycle with broadcast channels
//! - ViewCompiler: Spec → DataFusion plan compilation
//! - AdapterRegistry: Source adapter management
//! - SessionContext: DataFusion execution

use std::sync::Arc;
use std::collections::HashMap;

use arrow::array::RecordBatch;
use datafusion::prelude::*;
use tokio::sync::{RwLock, broadcast};

use ava_domain::{
    ViewProfileSpec, ViewId, ViewArtifact, ChannelBinding,
};
use ava_reconciler::v2::{ReconcilerV2, ReconcilerConfigV2, LagStrategy};
use ava_compiler::ViewCompiler;
use ava_adapters::AdapterRegistry;

use crate::error::RuntimeError;
use crate::spec_registry::SpecRegistry;
use super::hydration::{HydrationService, HydrationConfig};

/// V2 Runtime configuration
#[derive(Debug, Clone)]
pub struct RuntimeConfigV2 {
    /// Maximum concurrent compilations
    pub max_concurrent_compiles: usize,

    /// Enable event log for debugging
    pub enable_event_log: bool,

    /// Broadcast buffer size per view
    pub broadcast_buffer_size: usize,
}

impl Default for RuntimeConfigV2 {
    fn default() -> Self {
        Self {
            max_concurrent_compiles: 4,
            enable_event_log: true,
            broadcast_buffer_size: 64,
        }
    }
}

/// Central orchestrator for AVA view lifecycle (v2 event-driven)
pub struct AvaRuntimeV2 {
    /// Configuration
    config: RuntimeConfigV2,

    /// Spec registry for ViewProfileSpec storage
    spec_registry: SpecRegistry,

    /// V2 Reconciler with event-driven streaming
    reconciler: ReconcilerV2,

    /// Compiler for translating specs to DataFusion plans
    compiler: ViewCompiler,

    /// Adapter registry for source management
    adapters: Arc<RwLock<AdapterRegistry>>,

    /// DataFusion session context for execution
    session: Arc<RwLock<SessionContext>>,

    /// Compiled SQL cache (view_id -> compiled SQL)
    compiled_cache: Arc<RwLock<HashMap<ViewId, String>>>,

    /// Hydration service for populating ChannelData
    hydration_service: HydrationService,
}

impl AvaRuntimeV2 {
    /// Create a new v2 runtime with the given configuration
    pub fn new(config: RuntimeConfigV2) -> Self {
        let reconciler_config = ReconcilerConfigV2 {
            default_buffer_size: config.broadcast_buffer_size,
            default_lag_strategy: LagStrategy::DropOldest,
            enable_event_log: config.enable_event_log,
            ..Default::default()
        };

        let adapters = Arc::new(RwLock::new(AdapterRegistry::new()));
        let session = Arc::new(RwLock::new(SessionContext::new()));

        // Initialize hydration service with shared adapters and session
        let hydration_service = HydrationService::new(
            HydrationConfig::default(),
            adapters.clone(),
            session.clone(),
        );

        Self {
            config,
            spec_registry: SpecRegistry::new(),
            reconciler: ReconcilerV2::new(reconciler_config),
            compiler: ViewCompiler::new("source"),
            adapters,
            session,
            compiled_cache: Arc::new(RwLock::new(HashMap::new())),
            hydration_service,
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
    // View Subscription Operations (v2 API)
    // ========================================================================

    /// Subscribe to a view and receive raw artifacts via broadcast channel
    ///
    /// This returns unhydrated artifacts (ChannelData is None).
    /// For hydrated artifacts with data, use `subscribe_view_hydrated()`.
    ///
    /// The initial artifact is computed and broadcast immediately upon subscription.
    /// Subsequent updates arrive when:
    /// - Source data changes (if watcher configured)
    /// - `invalidate()` is called
    /// - Timer fires (if `refresh_ms` configured)
    pub async fn subscribe_view(
        &self,
        spec: ViewProfileSpec,
    ) -> Result<broadcast::Receiver<ViewArtifact>, RuntimeError> {
        let view_id = spec.id.clone();

        // Register spec if not already registered
        if !self.spec_registry.contains(&view_id)? {
            self.spec_registry.register(spec.clone())?;
        }

        // Compile channels before subscribing
        self.compile_spec(&spec).await?;

        // Subscribe via reconciler - this starts the internal event loop
        let rx = self.reconciler.subscribe(spec).await
            .map_err(|e| RuntimeError::reconciler_error(e))?;

        Ok(rx)
    }

    /// Subscribe to a view and receive hydrated artifacts via broadcast channel
    ///
    /// This is the primary v2 API for most consumers. Each artifact's
    /// ChannelBindings will have populated ChannelData based on the
    /// HydrationStrategy for each channel.
    ///
    /// The hydration process:
    /// - QueryRows: Executes SQL and returns RecordBatch rows
    /// - QueryInline: Executes SQL and inlines JSON if under size threshold
    /// - BindStream: Returns stream handle for progressive consumption
    /// - AssetReference: Returns URI reference for static assets
    /// - Skip: Leaves ChannelData as None (for computed channels)
    ///
    /// For raw artifacts without hydration, use `subscribe_view()`.
    pub async fn subscribe_view_hydrated(
        &self,
        spec: ViewProfileSpec,
    ) -> Result<broadcast::Receiver<ViewArtifact>, RuntimeError> {
        let view_id = spec.id.clone();

        // Get raw subscription
        let mut raw_rx = self.subscribe_view(spec).await?;

        // Create a new channel for hydrated artifacts
        let (hydrated_tx, hydrated_rx) = broadcast::channel(self.config.broadcast_buffer_size);

        // Clone hydration service for the spawned task
        let hydration_service = self.hydration_service.clone();

        // Spawn hydration task that transforms raw -> hydrated
        tokio::spawn(async move {
            loop {
                match raw_rx.recv().await {
                    Ok(raw_artifact) => {
                        // Hydrate the artifact
                        match hydration_service.hydrate_artifact(raw_artifact).await {
                            Ok(hydrated) => {
                                // Broadcast hydrated artifact (ignore send errors if no receivers)
                                let _ = hydrated_tx.send(hydrated);
                            }
                            Err(e) => {
                                // Log error but continue processing
                                eprintln!("Hydration error for view {:?}: {:?}", view_id, e);
                            }
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        // Consumer fell behind, log and continue
                        eprintln!("Hydration consumer lagged by {} messages", n);
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        // Channel closed, exit
                        break;
                    }
                }
            }
        });

        Ok(hydrated_rx)
    }

    /// Explicitly invalidate a view to trigger recomputation
    ///
    /// This causes the reconciler to recompute the view and broadcast
    /// a new artifact to all subscribers.
    pub async fn invalidate(&self, view_id: &ViewId) -> Result<(), RuntimeError> {
        self.reconciler.invalidate(view_id).await
            .map_err(|e| RuntimeError::reconciler_error(e))?;

        Ok(())
    }

    /// Unsubscribe from a view
    ///
    /// This removes the view from the reconciler. Existing receivers will
    /// stop receiving updates (channel closed).
    pub async fn unsubscribe(&self, view_id: &ViewId) -> Result<(), RuntimeError> {
        self.reconciler.unsubscribe(view_id).await
            .map_err(|e| RuntimeError::reconciler_error(e))?;

        // Remove from compiled cache
        let mut cache = self.compiled_cache.write().await;
        cache.remove(view_id);

        Ok(())
    }

    /// Get the number of active subscriptions
    pub async fn subscription_count(&self) -> usize {
        self.reconciler.active_view_ids().await.len()
    }

    /// Check if a view is subscribed
    pub async fn is_subscribed(&self, view_id: &ViewId) -> bool {
        self.reconciler.get_fiber(view_id).await.is_some()
    }

    // ========================================================================
    // Compilation Operations
    // ========================================================================

    /// Compile a spec's channels and cache the SQL
    async fn compile_spec(&self, spec: &ViewProfileSpec) -> Result<(), RuntimeError> {
        for channel in &spec.channels {
            let compiled = self.compiler.compile(channel)
                .map_err(|e| RuntimeError::compilation_failed(&spec.id, e.to_string()))?;

            let mut cache = self.compiled_cache.write().await;
            cache.insert(spec.id.clone(), compiled.sql);
        }

        Ok(())
    }

    /// Get compiled SQL for a view (if cached)
    pub async fn get_compiled_sql(&self, view_id: &ViewId) -> Option<String> {
        let cache = self.compiled_cache.read().await;
        cache.get(view_id).cloned()
    }

    // ========================================================================
    // Execution Operations
    // ========================================================================

    /// Execute a view's compiled SQL and return results
    ///
    /// Note: In v2, you typically don't need this - artifacts are streamed
    /// via subscription. Use this for on-demand queries outside the
    /// subscription model.
    pub async fn execute_sql(&self, view_id: &ViewId) -> Result<Vec<RecordBatch>, RuntimeError> {
        let sql = self.get_compiled_sql(view_id).await
            .ok_or_else(|| RuntimeError::view_not_found(view_id))?;

        let session = self.session.read().await;
        let df = session.sql(&sql).await?;
        let batches = df.collect().await?;

        Ok(batches)
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

    /// Get the hydration service
    pub fn hydration_service(&self) -> &HydrationService {
        &self.hydration_service
    }

    // ========================================================================
    // Lifecycle Management
    // ========================================================================

    /// Shutdown the runtime gracefully
    ///
    /// This stops the reconciler's internal event loop and cleans up resources.
    pub async fn shutdown(&mut self) {
        self.reconciler.shutdown().await;
    }

    // ========================================================================
    // Statistics
    // ========================================================================

    /// Get list of active view IDs
    pub async fn active_view_ids(&self) -> Vec<ViewId> {
        self.reconciler.active_view_ids().await
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
                data: None, // Will be populated by HydrationService (I47)
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

impl Default for AvaRuntimeV2 {
    fn default() -> Self {
        Self::new(RuntimeConfigV2::default())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::time::Duration;
    use ava_domain::{
        AssemblageId, ChannelPipelineSpec, ChannelId, ChannelRole,
        SourceSpec, SourceId, SourceKind, MaterializationTier,
    };

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
            refresh_ms: None,
        }
    }

    #[tokio::test]
    async fn test_new_runtime() {
        let runtime = AvaRuntimeV2::new(RuntimeConfigV2::default());
        assert!(runtime.spec_registry.is_empty().unwrap());
    }

    #[tokio::test]
    async fn test_default_runtime() {
        let runtime = AvaRuntimeV2::default();
        assert!(runtime.spec_registry.is_empty().unwrap());
    }

    #[tokio::test]
    async fn test_register_spec() {
        let runtime = AvaRuntimeV2::default();
        let spec = make_spec("view-1", 1);

        runtime.register_spec(spec).unwrap();

        assert_eq!(runtime.spec_registry.len().unwrap(), 1);
    }

    #[tokio::test]
    async fn test_subscribe_view() {
        let runtime = AvaRuntimeV2::default();
        let spec = make_spec("view-1", 1);

        let mut rx = runtime.subscribe_view(spec).await.unwrap();

        // Spec should be registered
        assert!(runtime.spec_registry.contains(&ViewId::new("view-1")).unwrap());

        // Should receive initial artifact
        let artifact = tokio::time::timeout(Duration::from_secs(1), rx.recv())
            .await.unwrap().unwrap();

        assert_eq!(artifact.view_id, ViewId::new("view-1"));
    }

    #[tokio::test]
    async fn test_subscribe_registers_spec() {
        let runtime = AvaRuntimeV2::default();
        let spec = make_spec("view-1", 1);

        // Not registered yet
        assert!(!runtime.spec_registry.contains(&ViewId::new("view-1")).unwrap());

        runtime.subscribe_view(spec).await.unwrap();

        // Now registered
        assert!(runtime.spec_registry.contains(&ViewId::new("view-1")).unwrap());
    }

    #[tokio::test]
    async fn test_invalidate() {
        let runtime = AvaRuntimeV2::default();
        let spec = make_spec("view-1", 1);
        let view_id = ViewId::new("view-1");

        let mut rx = runtime.subscribe_view(spec).await.unwrap();

        // Receive initial artifact
        let _ = tokio::time::timeout(Duration::from_secs(1), rx.recv())
            .await.unwrap().unwrap();

        // Invalidate
        runtime.invalidate(&view_id).await.unwrap();

        // Should receive another artifact
        let artifact = tokio::time::timeout(Duration::from_secs(1), rx.recv())
            .await.unwrap().unwrap();

        assert_eq!(artifact.view_id, view_id);
    }

    #[tokio::test]
    async fn test_unsubscribe() {
        let runtime = AvaRuntimeV2::default();
        let spec = make_spec("view-1", 1);
        let view_id = ViewId::new("view-1");

        let _ = runtime.subscribe_view(spec).await.unwrap();

        assert!(runtime.is_subscribed(&view_id).await);

        runtime.unsubscribe(&view_id).await.unwrap();

        // Give time for async unsubscribe to process
        tokio::time::sleep(Duration::from_millis(50)).await;

        assert!(!runtime.is_subscribed(&view_id).await);
    }

    #[tokio::test]
    async fn test_subscription_count() {
        let runtime = AvaRuntimeV2::default();

        for i in 0..3 {
            let spec = make_spec(&format!("view-{}", i), 1);
            runtime.subscribe_view(spec).await.unwrap();
        }

        assert_eq!(runtime.subscription_count().await, 3);
    }

    #[tokio::test]
    async fn test_compiled_sql_cached() {
        let runtime = AvaRuntimeV2::default();
        let spec = make_spec("view-1", 1);
        let view_id = ViewId::new("view-1");

        runtime.subscribe_view(spec).await.unwrap();

        // SQL should be cached after subscription
        let sql = runtime.get_compiled_sql(&view_id).await;
        assert!(sql.is_some());
    }

    #[tokio::test]
    async fn test_create_artifact() {
        let spec = make_spec("view-1", 1);
        let artifact = AvaRuntimeV2::create_artifact(&spec);

        assert_eq!(artifact.view_id, spec.id);
        assert_eq!(artifact.logical_version, spec.version);
        assert_eq!(artifact.channel_bindings.len(), 1);
    }

    #[tokio::test]
    async fn test_multiple_subscribers_same_view() {
        let runtime = AvaRuntimeV2::default();
        let spec = make_spec("view-1", 1);

        // First subscriber
        let mut rx1 = runtime.subscribe_view(spec.clone()).await.unwrap();
        let _ = tokio::time::timeout(Duration::from_secs(1), rx1.recv())
            .await.unwrap().unwrap();

        // Second subscriber to same view
        let mut rx2 = runtime.subscribe_view(spec).await.unwrap();

        // Invalidate - both should receive
        runtime.invalidate(&ViewId::new("view-1")).await.unwrap();

        let a1 = tokio::time::timeout(Duration::from_secs(1), rx1.recv())
            .await.unwrap().unwrap();
        let a2 = tokio::time::timeout(Duration::from_secs(1), rx2.recv())
            .await.unwrap().unwrap();

        assert_eq!(a1.view_id, a2.view_id);
    }

    #[tokio::test]
    async fn test_shutdown() {
        let mut runtime = AvaRuntimeV2::default();
        let spec = make_spec("view-1", 1);

        runtime.subscribe_view(spec).await.unwrap();

        runtime.shutdown().await;

        // After shutdown, should still work (new reconciler created)
        // This tests graceful cleanup
    }

    #[tokio::test]
    async fn test_subscribe_view_hydrated() {
        let runtime = AvaRuntimeV2::default();
        let spec = make_spec("view-1", 1);

        // Subscribe with hydration
        let mut rx = runtime.subscribe_view_hydrated(spec).await.unwrap();

        // Should receive hydrated artifact
        let artifact = tokio::time::timeout(Duration::from_secs(1), rx.recv())
            .await.unwrap().unwrap();

        assert_eq!(artifact.view_id, ViewId::new("view-1"));
        // Channel bindings should exist (hydration attempted, even if no data)
        assert_eq!(artifact.channel_bindings.len(), 1);
    }

    #[tokio::test]
    async fn test_subscribe_view_hydrated_invalidate() {
        let runtime = AvaRuntimeV2::default();
        let spec = make_spec("view-1", 1);
        let view_id = ViewId::new("view-1");

        let mut rx = runtime.subscribe_view_hydrated(spec).await.unwrap();

        // Receive initial hydrated artifact
        let _ = tokio::time::timeout(Duration::from_secs(1), rx.recv())
            .await.unwrap().unwrap();

        // Invalidate
        runtime.invalidate(&view_id).await.unwrap();

        // Should receive another hydrated artifact
        let artifact = tokio::time::timeout(Duration::from_secs(1), rx.recv())
            .await.unwrap().unwrap();

        assert_eq!(artifact.view_id, view_id);
    }

    #[tokio::test]
    async fn test_hydration_service_accessor() {
        let runtime = AvaRuntimeV2::default();

        // Should be able to access hydration service
        let _service = runtime.hydration_service();

        // Verify it's properly initialized (config has default values)
        // This test ensures the accessor works
    }
}
