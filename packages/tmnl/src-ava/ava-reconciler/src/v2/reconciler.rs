//! ReconcilerV2 - Event-driven view lifecycle management
//!
//! The main orchestrator that replaces tick-based processing with
//! an internal event loop using tokio::broadcast for artifact streaming.

use std::collections::HashMap;
use std::sync::Arc;

use ava_domain::{ViewId, ViewProfileSpec, ViewArtifact, ChannelBinding, ReconcilerEvent, EventLogEntry};
use tokio::sync::{broadcast, mpsc, oneshot, RwLock, Mutex};
use tokio::task::JoinHandle;

use super::broadcaster::{ViewBroadcaster, BroadcasterConfig};
use super::trigger::{TriggerEngine, Trigger};
use super::config::ReconcilerConfigV2;
use super::error::ReconcilerErrorV2;
use crate::v1::EventLog;

/// Simplified fiber for v2 (no state machine needed)
#[derive(Debug, Clone)]
pub struct ViewFiberV2 {
    /// View identifier
    pub view_id: ViewId,

    /// Current spec
    pub spec: ViewProfileSpec,

    /// Last computed artifact (cache)
    pub last_artifact: Option<ViewArtifact>,

    /// Computation stats
    pub stats: FiberStats,
}

/// Statistics for a fiber
#[derive(Debug, Clone, Default)]
pub struct FiberStats {
    /// Number of recomputations
    pub recompute_count: u64,

    /// Last recompute timestamp (ms)
    pub last_recompute_ms: f64,

    /// Total recompute time (ms)
    pub total_recompute_time_ms: f64,
}

impl FiberStats {
    /// Average recompute duration
    pub fn avg_recompute_duration_ms(&self) -> f64 {
        if self.recompute_count == 0 {
            0.0
        } else {
            self.total_recompute_time_ms / self.recompute_count as f64
        }
    }
}

/// Commands for the internal event loop
enum Command {
    Subscribe {
        spec: ViewProfileSpec,
        response: oneshot::Sender<broadcast::Receiver<ViewArtifact>>,
    },
    Invalidate {
        view_id: ViewId,
    },
    Unsubscribe {
        view_id: ViewId,
    },
    Shutdown,
}

/// Event-driven reconciler with internal event loop
pub struct ReconcilerV2 {
    /// Configuration
    config: ReconcilerConfigV2,

    /// Command sender for external control
    command_tx: mpsc::Sender<Command>,

    /// Event loop handle
    loop_handle: Option<JoinHandle<()>>,

    /// Shared state for external queries
    fibers: Arc<RwLock<HashMap<ViewId, ViewFiberV2>>>,

    /// Shared broadcasters for external queries
    broadcasters: Arc<RwLock<HashMap<ViewId, ViewBroadcaster>>>,

    /// Event log (optional, for debugging)
    event_log: Option<Arc<EventLog>>,

    /// Time provider
    time_provider: fn() -> f64,
}

impl ReconcilerV2 {
    /// Create and start a new reconciler
    pub fn new(config: ReconcilerConfigV2) -> Self {
        let (command_tx, command_rx) = mpsc::channel(256);

        let fibers = Arc::new(RwLock::new(HashMap::new()));
        let broadcasters = Arc::new(RwLock::new(HashMap::new()));

        let event_log = if config.enable_event_log {
            Some(Arc::new(EventLog::new()))
        } else {
            None
        };

        let time_provider = config.time_provider.unwrap_or(default_time_provider);

        // Clone for the event loop
        let loop_fibers = fibers.clone();
        let loop_broadcasters = broadcasters.clone();
        let loop_config = config.clone();
        let loop_event_log = event_log.clone();

        // Start internal event loop
        let loop_handle = tokio::spawn(async move {
            event_loop(
                command_rx,
                loop_fibers,
                loop_broadcasters,
                loop_config,
                loop_event_log,
            ).await;
        });

        Self {
            config,
            command_tx,
            loop_handle: Some(loop_handle),
            fibers,
            broadcasters,
            event_log,
            time_provider,
        }
    }

    /// Subscribe to a view (creates if not exists)
    ///
    /// Returns a receiver that will receive artifact updates.
    pub async fn subscribe(&self, spec: ViewProfileSpec) -> Result<broadcast::Receiver<ViewArtifact>, ReconcilerErrorV2> {
        let (response_tx, response_rx) = oneshot::channel();

        self.command_tx.send(Command::Subscribe { spec, response: response_tx })
            .await
            .map_err(|_| ReconcilerErrorV2::ChannelClosed)?;

        response_rx.await
            .map_err(|_| ReconcilerErrorV2::ChannelClosed)
    }

    /// Invalidate a view (triggers recomputation)
    pub async fn invalidate(&self, view_id: &ViewId) -> Result<(), ReconcilerErrorV2> {
        self.command_tx.send(Command::Invalidate { view_id: view_id.clone() })
            .await
            .map_err(|_| ReconcilerErrorV2::ChannelClosed)
    }

    /// Unsubscribe from a view
    ///
    /// If no other subscribers remain, the view will be cleaned up.
    pub async fn unsubscribe(&self, view_id: &ViewId) -> Result<(), ReconcilerErrorV2> {
        self.command_tx.send(Command::Unsubscribe { view_id: view_id.clone() })
            .await
            .map_err(|_| ReconcilerErrorV2::ChannelClosed)
    }

    /// Graceful shutdown
    pub async fn shutdown(&mut self) {
        let _ = self.command_tx.send(Command::Shutdown).await;
        if let Some(handle) = self.loop_handle.take() {
            let _ = handle.await;
        }
    }

    /// Get a fiber by view ID (for queries)
    pub async fn get_fiber(&self, view_id: &ViewId) -> Option<ViewFiberV2> {
        self.fibers.read().await.get(view_id).cloned()
    }

    /// Get all active view IDs
    pub async fn active_view_ids(&self) -> Vec<ViewId> {
        self.fibers.read().await.keys().cloned().collect()
    }

    /// Get the event log (if enabled)
    pub fn event_log(&self) -> Option<&Arc<EventLog>> {
        self.event_log.as_ref()
    }

    /// Get current time using the configured provider
    pub fn now(&self) -> f64 {
        (self.time_provider)()
    }
}

impl Default for ReconcilerV2 {
    fn default() -> Self {
        Self::new(ReconcilerConfigV2::default())
    }
}

impl Drop for ReconcilerV2 {
    fn drop(&mut self) {
        if let Some(handle) = self.loop_handle.take() {
            handle.abort();
        }
    }
}

/// Default time provider using std::time
fn default_time_provider() -> f64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs_f64() * 1000.0
}

/// Internal event loop
async fn event_loop(
    mut commands: mpsc::Receiver<Command>,
    fibers: Arc<RwLock<HashMap<ViewId, ViewFiberV2>>>,
    broadcasters: Arc<RwLock<HashMap<ViewId, ViewBroadcaster>>>,
    config: ReconcilerConfigV2,
    event_log: Option<Arc<EventLog>>,
) {
    let triggers = Arc::new(Mutex::new(TriggerEngine::new()));

    loop {
        let mut trigger_engine = triggers.lock().await;

        tokio::select! {
            // Handle commands
            Some(cmd) = commands.recv() => {
                drop(trigger_engine); // Release lock before processing
                match cmd {
                    Command::Subscribe { spec, response } => {
                        let rx = handle_subscribe(
                            spec,
                            &fibers,
                            &broadcasters,
                            &triggers,
                            &config,
                            &event_log,
                        ).await;
                        let _ = response.send(rx);
                    }
                    Command::Invalidate { view_id } => {
                        let trigger_engine = triggers.lock().await;
                        trigger_engine.invalidate(view_id);
                    }
                    Command::Unsubscribe { view_id } => {
                        handle_unsubscribe(
                            &view_id,
                            &fibers,
                            &broadcasters,
                            &triggers,
                        ).await;
                    }
                    Command::Shutdown => break,
                }
            }

            // Handle triggers
            Some(trigger) = trigger_engine.next_trigger() => {
                drop(trigger_engine); // Release lock before processing
                handle_trigger(
                    trigger,
                    &fibers,
                    &broadcasters,
                    &event_log,
                ).await;
            }
        }
    }
}

/// Handle a subscribe command
async fn handle_subscribe(
    spec: ViewProfileSpec,
    fibers: &Arc<RwLock<HashMap<ViewId, ViewFiberV2>>>,
    broadcasters: &Arc<RwLock<HashMap<ViewId, ViewBroadcaster>>>,
    triggers: &Arc<Mutex<TriggerEngine>>,
    config: &ReconcilerConfigV2,
    event_log: &Option<Arc<EventLog>>,
) -> broadcast::Receiver<ViewArtifact> {
    let view_id = spec.id.clone();

    // Check if already exists
    {
        let bcast = broadcasters.read().await;
        if let Some(broadcaster) = bcast.get(&view_id) {
            return broadcaster.subscribe();
        }
    }

    // Create fiber
    let fiber = ViewFiberV2 {
        view_id: view_id.clone(),
        spec: spec.clone(),
        last_artifact: None,
        stats: FiberStats::default(),
    };

    // Create broadcaster
    let broadcaster_config = BroadcasterConfig {
        buffer_size: config.default_buffer_size,
        lag_strategy: config.default_lag_strategy,
    };
    let broadcaster = ViewBroadcaster::new(broadcaster_config);
    let rx = broadcaster.subscribe();

    // Store
    {
        let mut f = fibers.write().await;
        f.insert(view_id.clone(), fiber);
    }
    {
        let mut b = broadcasters.write().await;
        b.insert(view_id.clone(), broadcaster);
    }

    // Register with trigger engine
    {
        let mut te = triggers.lock().await;
        te.register(view_id.clone(), &spec);
        te.trigger_initial(view_id.clone());
    }

    // Log event
    if let Some(log) = event_log {
        let _ = log.append(ReconcilerEvent::ViewRequested {
            view_id,
            spec,
            timestamp_ms: default_time_provider(),
        }).await;
    }

    rx
}

/// Handle an unsubscribe command
async fn handle_unsubscribe(
    view_id: &ViewId,
    fibers: &Arc<RwLock<HashMap<ViewId, ViewFiberV2>>>,
    broadcasters: &Arc<RwLock<HashMap<ViewId, ViewBroadcaster>>>,
    triggers: &Arc<Mutex<TriggerEngine>>,
) {
    // Check subscriber count
    let should_cleanup = {
        let bcast = broadcasters.read().await;
        bcast.get(view_id)
            .map(|b| b.subscriber_count() <= 1) // Will be 0 after this unsubscribe
            .unwrap_or(true)
    };

    if should_cleanup {
        // Remove fiber
        {
            let mut f = fibers.write().await;
            f.remove(view_id);
        }
        // Remove broadcaster
        {
            let mut b = broadcasters.write().await;
            b.remove(view_id);
        }
        // Unregister from triggers
        {
            let mut te = triggers.lock().await;
            te.unregister(view_id);
        }
    }
}

/// Handle a trigger event
async fn handle_trigger(
    trigger: Trigger,
    fibers: &Arc<RwLock<HashMap<ViewId, ViewFiberV2>>>,
    broadcasters: &Arc<RwLock<HashMap<ViewId, ViewBroadcaster>>>,
    event_log: &Option<Arc<EventLog>>,
) {
    let view_ids: Vec<ViewId> = match trigger {
        Trigger::SourceChanged { affected_views, .. } => affected_views,
        Trigger::Invalidate { view_id } => vec![view_id],
        Trigger::TimerFired { view_id } => vec![view_id],
        Trigger::Initial { view_id } => vec![view_id],
    };

    for view_id in view_ids {
        recompute_and_broadcast(&view_id, fibers, broadcasters, event_log).await;
    }
}

/// Recompute a view and broadcast the result
async fn recompute_and_broadcast(
    view_id: &ViewId,
    fibers: &Arc<RwLock<HashMap<ViewId, ViewFiberV2>>>,
    broadcasters: &Arc<RwLock<HashMap<ViewId, ViewBroadcaster>>>,
    event_log: &Option<Arc<EventLog>>,
) {
    let start_time = default_time_provider();

    // Get spec
    let spec = {
        let f = fibers.read().await;
        match f.get(view_id) {
            Some(fiber) => fiber.spec.clone(),
            None => return,
        }
    };

    // Create artifact (placeholder - actual compilation would happen here)
    let artifact = create_artifact(&spec, start_time);

    // Update fiber stats
    {
        let mut f = fibers.write().await;
        if let Some(fiber) = f.get_mut(view_id) {
            let duration = default_time_provider() - start_time;
            fiber.stats.recompute_count += 1;
            fiber.stats.last_recompute_ms = start_time;
            fiber.stats.total_recompute_time_ms += duration;
            fiber.last_artifact = Some(artifact.clone());
        }
    }

    // Broadcast
    {
        let bcast = broadcasters.read().await;
        if let Some(broadcaster) = bcast.get(view_id) {
            let _ = broadcaster.broadcast(artifact.clone());
        }
    }

    // Log event
    if let Some(log) = event_log {
        let _ = log.append(ReconcilerEvent::ViewMounted {
            view_id: view_id.clone(),
            artifact,
            timestamp_ms: default_time_provider(),
        }).await;
    }
}

/// Create an artifact from a spec (placeholder)
fn create_artifact(spec: &ViewProfileSpec, timestamp: f64) -> ViewArtifact {
    let bindings: Vec<ChannelBinding> = spec.channels.iter().map(|c| {
        ChannelBinding {
            channel_id: c.id.clone(),
            role: c.role,
            active: true,
            row_count: None,
            last_updated_ms: Some(timestamp),
        }
    }).collect();

    ViewArtifact {
        view_id: spec.id.clone(),
        asset_id: None,
        spec: spec.clone(),
        channel_bindings: bindings,
        created_at_ms: timestamp,
        logical_version: spec.version,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ava_domain::{
        AssemblageId, ChannelPipelineSpec, ChannelId, ChannelRole,
        SourceSpec, SourceId, SourceKind, MaterializationTier,
    };
    use std::time::Duration;

    fn make_spec(id: &str, version: u32) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(id),
            name: format!("View {}", id),
            description: Some(format!("Version {}", version)),
            assemblage_id: AssemblageId::new("test"),
            channels: vec![ChannelPipelineSpec {
                id: ChannelId::new("state"),
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
            }],
            tags: HashMap::new(),
            version,
        }
    }

    #[tokio::test]
    async fn test_new_reconciler() {
        let reconciler = ReconcilerV2::default();
        let ids = reconciler.active_view_ids().await;
        assert!(ids.is_empty());
    }

    #[tokio::test]
    async fn test_subscribe_creates_fiber() {
        let reconciler = ReconcilerV2::default();
        let spec = make_spec("view-1", 1);

        let _rx = reconciler.subscribe(spec).await.unwrap();

        // Give time for async processing
        tokio::time::sleep(Duration::from_millis(50)).await;

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await;
        assert!(fiber.is_some());
    }

    #[tokio::test]
    async fn test_subscribe_receives_initial_artifact() {
        let reconciler = ReconcilerV2::default();
        let spec = make_spec("view-1", 1);

        let mut rx = reconciler.subscribe(spec).await.unwrap();

        // Should receive initial artifact
        let artifact = tokio::time::timeout(
            Duration::from_secs(1),
            rx.recv()
        ).await.unwrap().unwrap();

        assert_eq!(artifact.view_id, ViewId::new("view-1"));
    }

    #[tokio::test]
    async fn test_invalidate_triggers_recomputation() {
        let reconciler = ReconcilerV2::default();
        let spec = make_spec("view-1", 1);
        let view_id = ViewId::new("view-1");

        let mut rx = reconciler.subscribe(spec).await.unwrap();

        // Receive initial
        let _ = rx.recv().await.unwrap();

        // Invalidate
        reconciler.invalidate(&view_id).await.unwrap();

        // Should receive new artifact
        let artifact = tokio::time::timeout(
            Duration::from_secs(1),
            rx.recv()
        ).await.unwrap().unwrap();

        assert_eq!(artifact.view_id, view_id);
    }

    #[tokio::test]
    async fn test_multiple_subscribers() {
        let reconciler = ReconcilerV2::default();
        let spec = make_spec("view-1", 1);

        // First subscriber gets initial artifact
        let mut rx1 = reconciler.subscribe(spec.clone()).await.unwrap();
        let _ = tokio::time::timeout(Duration::from_secs(1), rx1.recv()).await.unwrap().unwrap();

        // Second subscriber joins (no new initial, view already exists)
        let mut rx2 = reconciler.subscribe(spec).await.unwrap();

        // Invalidate to trigger broadcast to both
        reconciler.invalidate(&ViewId::new("view-1")).await.unwrap();

        // Both should receive the invalidation broadcast
        let a1 = tokio::time::timeout(Duration::from_secs(1), rx1.recv()).await.unwrap().unwrap();
        let a2 = tokio::time::timeout(Duration::from_secs(1), rx2.recv()).await.unwrap().unwrap();

        assert_eq!(a1.view_id, a2.view_id);
    }

    #[tokio::test]
    async fn test_unsubscribe_cleanup() {
        let reconciler = ReconcilerV2::default();
        let spec = make_spec("view-1", 1);
        let view_id = ViewId::new("view-1");

        let rx = reconciler.subscribe(spec).await.unwrap();

        // Verify fiber exists
        assert!(reconciler.get_fiber(&view_id).await.is_some());

        // Drop receiver and unsubscribe
        drop(rx);
        reconciler.unsubscribe(&view_id).await.unwrap();

        // Give time for cleanup
        tokio::time::sleep(Duration::from_millis(50)).await;

        // Fiber should be removed
        assert!(reconciler.get_fiber(&view_id).await.is_none());
    }

    #[tokio::test]
    async fn test_shutdown() {
        let mut reconciler = ReconcilerV2::default();
        let spec = make_spec("view-1", 1);

        let _rx = reconciler.subscribe(spec).await.unwrap();

        // Shutdown should complete without hanging
        tokio::time::timeout(
            Duration::from_secs(1),
            reconciler.shutdown()
        ).await.unwrap();
    }

    #[tokio::test]
    async fn test_fiber_stats() {
        let reconciler = ReconcilerV2::default();
        let spec = make_spec("view-1", 1);
        let view_id = ViewId::new("view-1");

        let mut rx = reconciler.subscribe(spec).await.unwrap();

        // Receive initial
        let _ = rx.recv().await.unwrap();

        // Invalidate a few times
        for _ in 0..3 {
            reconciler.invalidate(&view_id).await.unwrap();
            let _ = rx.recv().await.unwrap();
        }

        tokio::time::sleep(Duration::from_millis(50)).await;

        let fiber = reconciler.get_fiber(&view_id).await.unwrap();
        assert!(fiber.stats.recompute_count >= 4); // Initial + 3 invalidations
    }

    #[tokio::test]
    async fn test_event_log_enabled() {
        let config = ReconcilerConfigV2::default();
        let reconciler = ReconcilerV2::new(config);

        assert!(reconciler.event_log().is_some());
    }

    #[tokio::test]
    async fn test_event_log_disabled() {
        let config = ReconcilerConfigV2::default().without_event_log();
        let reconciler = ReconcilerV2::new(config);

        assert!(reconciler.event_log().is_none());
    }
}
