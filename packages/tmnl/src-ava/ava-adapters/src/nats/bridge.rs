//! NATS Bridge - ReconcilerV2 Integration
//!
//! Bridges ReconcilerV2's ViewBroadcasters to NATS JetStream with:
//! - Automatic subscription to all view artifacts
//! - Configurable routing per view/assemblage
//! - Transform pipeline support
//! - Graceful lifecycle management
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────────────┐
//! │                         ReconcilerV2                                 │
//! │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
//! │  │ViewBroadcaster│  │ViewBroadcaster│  │ViewBroadcaster│              │
//! │  │   (view-1)   │  │   (view-2)   │  │   (view-3)   │              │
//! │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
//! └─────────┼──────────────────┼──────────────────┼─────────────────────┘
//!           │                  │                  │
//!           └──────────────────┼──────────────────┘
//!                              ▼
//! ┌─────────────────────────────────────────────────────────────────────┐
//! │                        NatsBridge                                    │
//! │  ┌───────────────────────────────────────────────────────────────┐  │
//! │  │                    SubscriptionManager                         │  │
//! │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │  │
//! │  │  │  ViewSub   │  │  ViewSub   │  │  ViewSub   │              │  │
//! │  │  │  Fiber     │  │  Fiber     │  │  Fiber     │              │  │
//! │  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘              │  │
//! │  │        │                │                │                    │  │
//! │  │        └────────────────┼────────────────┘                    │  │
//! │  └─────────────────────────┼─────────────────────────────────────┘  │
//! │                            ▼                                         │
//! │  ┌───────────────────────────────────────────────────────────────┐  │
//! │  │                      RoutingEngine                             │  │
//! │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │  │
//! │  │  │ArtifactRtr │  │ DeltaRtr   │  │  StatusRtr │              │  │
//! │  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘              │  │
//! │  └────────┼───────────────┼───────────────┼──────────────────────┘  │
//! │           │               │               │                          │
//! │           ▼               ▼               ▼                          │
//! │  ┌───────────────────────────────────────────────────────────────┐  │
//! │  │                    TransformEngine                             │  │
//! │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐              │  │
//! │  │  │  Pipeline  │  │  Pipeline  │  │  Pipeline  │              │  │
//! │  │  │ (compress) │  │ (chunk)    │  │ (enrich)   │              │  │
//! │  │  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘              │  │
//! │  └────────┼───────────────┼───────────────┼──────────────────────┘  │
//! │           │               │               │                          │
//! │           └───────────────┼───────────────┘                          │
//! │                           ▼                                          │
//! │  ┌───────────────────────────────────────────────────────────────┐  │
//! │  │                     BatchPublisher                             │  │
//! │  │  ┌─────────────────────────────────────────────────────────┐  │  │
//! │  │  │  Worker Pool (N concurrent, semaphore-controlled)       │  │  │
//! │  │  └─────────────────────────────────────────────────────────┘  │  │
//! │  └───────────────────────────────────────────────────────────────┘  │
//! └─────────────────────────────────────────────────────────────────────┘
//!                                     │
//!                                     ▼
//!                           ┌──────────────────┐
//!                           │  NATS JetStream  │
//!                           └──────────────────┘
//! ```

use std::collections::HashMap;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Duration;

use async_nats::jetstream::Context as JetStreamContext;
use tokio::sync::{mpsc, broadcast, RwLock};
use tokio::task::JoinHandle;
use tracing::{debug, info, warn, instrument};
use bytes::Bytes;

use ava_domain::views::{ViewArtifact, ViewDelta};
use ava_domain::ids::ViewId;

use super::config::NatsConfig;
use super::error::NatsError;
use super::batch::{BatchPublisher, BatchConfig, PublishMessage};
use super::router::{ArtifactRouter, DeltaRouter, RoutingDecision, Route};
use super::transform::{TransformPipeline, TransformOutput, TransformRegistry};

// ============================================================================
// Bridge Configuration
// ============================================================================

/// Configuration for the NATS bridge.
#[derive(Debug, Clone)]
pub struct BridgeConfig {
    /// NATS connection configuration
    pub nats: NatsConfig,

    /// Batch publisher configuration
    pub batch: BatchConfig,

    /// Maximum concurrent subscription fibers
    pub max_subscription_fibers: usize,

    /// Subscription buffer size (per-view broadcast receiver)
    pub subscription_buffer_size: usize,

    /// Whether to publish deltas (if available)
    pub publish_deltas: bool,

    /// Whether to publish status events
    pub publish_status: bool,

    /// Backpressure threshold (pending messages before slowing down)
    pub backpressure_threshold: u64,

    /// Graceful shutdown timeout
    pub shutdown_timeout: Duration,

    /// Enable metrics collection
    pub enable_metrics: bool,
}

impl Default for BridgeConfig {
    fn default() -> Self {
        Self {
            nats: NatsConfig::default(),
            batch: BatchConfig::default(),
            max_subscription_fibers: 64,
            subscription_buffer_size: 16,
            publish_deltas: true,
            publish_status: true,
            backpressure_threshold: 10_000,
            shutdown_timeout: Duration::from_secs(5),
            enable_metrics: true,
        }
    }
}

impl BridgeConfig {
    /// Create with custom NATS config
    pub fn with_nats(mut self, nats: NatsConfig) -> Self {
        self.nats = nats;
        self
    }

    /// Create with custom batch config
    pub fn with_batch(mut self, batch: BatchConfig) -> Self {
        self.batch = batch;
        self
    }

    /// Set max subscription fibers
    pub fn max_fibers(mut self, count: usize) -> Self {
        self.max_subscription_fibers = count;
        self
    }

    /// Disable delta publishing
    pub fn without_deltas(mut self) -> Self {
        self.publish_deltas = false;
        self
    }

    /// Disable status publishing
    pub fn without_status(mut self) -> Self {
        self.publish_status = false;
        self
    }
}

// ============================================================================
// Bridge Metrics
// ============================================================================

/// Metrics for the NATS bridge.
#[derive(Debug, Default)]
pub struct BridgeMetrics {
    /// Total artifacts received from broadcasters
    pub artifacts_received: AtomicU64,

    /// Total artifacts published to NATS
    pub artifacts_published: AtomicU64,

    /// Total deltas published
    pub deltas_published: AtomicU64,

    /// Total status events published
    pub status_published: AtomicU64,

    /// Total routing decisions processed
    pub routing_decisions: AtomicU64,

    /// Total transforms applied
    pub transforms_applied: AtomicU64,

    /// Messages dropped due to backpressure
    pub backpressure_drops: AtomicU64,

    /// Active subscription fibers
    pub active_fibers: AtomicU64,

    /// Total errors encountered
    pub errors: AtomicU64,

    /// Lag events (subscriber behind)
    pub lag_events: AtomicU64,
}

impl BridgeMetrics {
    pub fn record_artifact_received(&self) {
        self.artifacts_received.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_artifact_published(&self) {
        self.artifacts_published.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_delta_published(&self) {
        self.deltas_published.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_status_published(&self) {
        self.status_published.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_routing_decision(&self) {
        self.routing_decisions.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_transform(&self) {
        self.transforms_applied.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_backpressure_drop(&self) {
        self.backpressure_drops.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_error(&self) {
        self.errors.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_lag(&self) {
        self.lag_events.fetch_add(1, Ordering::Relaxed);
    }

    pub fn fiber_started(&self) {
        self.active_fibers.fetch_add(1, Ordering::Relaxed);
    }

    pub fn fiber_stopped(&self) {
        self.active_fibers.fetch_sub(1, Ordering::Relaxed);
    }

    /// Snapshot current metrics
    pub fn snapshot(&self) -> MetricsSnapshot {
        MetricsSnapshot {
            artifacts_received: self.artifacts_received.load(Ordering::Relaxed),
            artifacts_published: self.artifacts_published.load(Ordering::Relaxed),
            deltas_published: self.deltas_published.load(Ordering::Relaxed),
            status_published: self.status_published.load(Ordering::Relaxed),
            routing_decisions: self.routing_decisions.load(Ordering::Relaxed),
            transforms_applied: self.transforms_applied.load(Ordering::Relaxed),
            backpressure_drops: self.backpressure_drops.load(Ordering::Relaxed),
            active_fibers: self.active_fibers.load(Ordering::Relaxed),
            errors: self.errors.load(Ordering::Relaxed),
            lag_events: self.lag_events.load(Ordering::Relaxed),
        }
    }
}

/// Snapshot of metrics at a point in time
#[derive(Debug, Clone)]
pub struct MetricsSnapshot {
    pub artifacts_received: u64,
    pub artifacts_published: u64,
    pub deltas_published: u64,
    pub status_published: u64,
    pub routing_decisions: u64,
    pub transforms_applied: u64,
    pub backpressure_drops: u64,
    pub active_fibers: u64,
    pub errors: u64,
    pub lag_events: u64,
}

// ============================================================================
// View Subscription Fiber
// ============================================================================

/// A fiber that handles a single view subscription
struct ViewSubscriptionFiber {
    view_id: ViewId,
    handle: JoinHandle<()>,
    cancel: Arc<AtomicBool>,
}

impl ViewSubscriptionFiber {
    /// Cancel and await the fiber
    async fn cancel(self) {
        self.cancel.store(true, Ordering::SeqCst);
        let _ = self.handle.await;
    }
}

// ============================================================================
// Internal Messages
// ============================================================================

/// Messages for the bridge's internal event loop
enum BridgeCommand {
    /// Add a new view subscription
    Subscribe {
        view_id: ViewId,
        receiver: broadcast::Receiver<ViewArtifact>,
    },

    /// Remove a view subscription
    Unsubscribe {
        view_id: ViewId,
    },

    /// Publish an artifact (from a subscription fiber)
    PublishArtifact(ViewArtifact),

    /// Publish a delta
    PublishDelta {
        view_id: ViewId,
        delta: ViewDelta,
    },

    /// Publish a status event
    PublishStatus {
        view_id: ViewId,
        status: ViewStatus,
    },

    /// Shutdown the bridge
    Shutdown,
}

/// View status for status events
#[derive(Debug, Clone, serde::Serialize)]
pub struct ViewStatus {
    pub state: ViewState,
    pub timestamp_ms: f64,
    pub message: Option<String>,
}

/// View state enum
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ViewState {
    Initializing,
    Ready,
    Recomputing,
    Stale,
    Error,
    Disposed,
}

// ============================================================================
// NATS Bridge
// ============================================================================

/// The main NATS bridge that connects ReconcilerV2 to NATS JetStream.
///
/// # Example
///
/// ```ignore
/// use ava_adapters::nats::{NatsBridge, BridgeConfig};
///
/// // Create bridge
/// let config = BridgeConfig::default();
/// let bridge = NatsBridge::new(config).await?;
///
/// // Subscribe to a view's broadcaster
/// let rx = reconciler.subscribe(spec).await?;
/// bridge.subscribe(view_id, rx).await?;
///
/// // The bridge will automatically:
/// // 1. Receive artifacts from the broadcaster
/// // 2. Route them through the routing engine
/// // 3. Apply transforms
/// // 4. Batch publish to NATS JetStream
///
/// // Graceful shutdown
/// bridge.shutdown().await;
/// ```
pub struct NatsBridge {
    /// Configuration
    config: BridgeConfig,

    /// JetStream context
    jetstream: JetStreamContext,

    /// Command sender
    command_tx: mpsc::Sender<BridgeCommand>,

    /// Main loop handle
    loop_handle: Option<JoinHandle<()>>,

    /// Active subscription fibers
    fibers: Arc<RwLock<HashMap<ViewId, ViewSubscriptionFiber>>>,

    /// Metrics
    metrics: Arc<BridgeMetrics>,

    /// Artifact router
    artifact_router: Arc<RwLock<ArtifactRouter>>,

    /// Delta router
    delta_router: Arc<RwLock<DeltaRouter>>,

    /// Transform registry
    transforms: Arc<RwLock<TransformRegistry>>,

    /// Shutdown flag
    shutdown: Arc<AtomicBool>,
}

impl NatsBridge {
    /// Create a new NATS bridge with the given configuration.
    ///
    /// Connects to NATS, ensures the stream exists, and starts the internal event loop.
    #[instrument(skip(config), fields(server = %config.nats.server_url))]
    pub async fn new(config: BridgeConfig) -> Result<Self, NatsError> {
        info!("Initializing NATS bridge");

        // Connect to NATS
        let client = async_nats::ConnectOptions::new()
            .event_callback(|event| async move {
                debug!("NATS event: {:?}", event);
            })
            .connect(&config.nats.server_url)
            .await?;

        let jetstream = async_nats::jetstream::new(client);

        // Ensure stream exists
        jetstream
            .get_or_create_stream(async_nats::jetstream::stream::Config {
                name: config.nats.stream_name.clone(),
                subjects: vec![config.nats.all_subjects_pattern()],
                retention: async_nats::jetstream::stream::RetentionPolicy::WorkQueue,
                max_messages: config.nats.max_messages,
                ..Default::default()
            })
            .await?;

        info!(stream = %config.nats.stream_name, "NATS stream ready");

        // Create channels and state
        let (command_tx, command_rx) = mpsc::channel(256);
        let fibers = Arc::new(RwLock::new(HashMap::new()));
        let metrics = Arc::new(BridgeMetrics::default());
        let artifact_router = Arc::new(RwLock::new(ArtifactRouter::new()));
        let delta_router = Arc::new(RwLock::new(DeltaRouter::new()));
        let transforms = Arc::new(RwLock::new(TransformRegistry::new()));
        let shutdown = Arc::new(AtomicBool::new(false));

        // Create batch publisher
        let batch_publisher = BatchPublisher::new(jetstream.clone(), config.batch.clone());

        // Start main event loop
        let loop_handle = tokio::spawn(Self::event_loop(
            command_rx,
            batch_publisher,
            config.clone(),
            metrics.clone(),
            artifact_router.clone(),
            delta_router.clone(),
            transforms.clone(),
            shutdown.clone(),
        ));

        Ok(Self {
            config,
            jetstream,
            command_tx,
            loop_handle: Some(loop_handle),
            fibers,
            metrics,
            artifact_router,
            delta_router,
            transforms,
            shutdown,
        })
    }

    /// Subscribe to a view's artifact stream.
    ///
    /// Creates a fiber that receives artifacts from the broadcaster
    /// and forwards them to the bridge's event loop for publishing.
    #[instrument(skip(self, receiver), fields(view_id = %view_id.as_str()))]
    pub async fn subscribe(
        &self,
        view_id: ViewId,
        receiver: broadcast::Receiver<ViewArtifact>,
    ) -> Result<(), NatsError> {
        // Check fiber limit
        {
            let fibers = self.fibers.read().await;
            if fibers.len() >= self.config.max_subscription_fibers {
                warn!(
                    max = self.config.max_subscription_fibers,
                    "Max subscription fibers reached"
                );
                return Err(NatsError::Stream("Max subscription fibers reached".into()));
            }

            // Check if already subscribed
            if fibers.contains_key(&view_id) {
                debug!("Already subscribed to view");
                return Ok(());
            }
        }

        // Send subscribe command
        self.command_tx
            .send(BridgeCommand::Subscribe {
                view_id: view_id.clone(),
                receiver,
            })
            .await
            .map_err(|_| NatsError::BroadcastClosed)?;

        info!("View subscription added");
        Ok(())
    }

    /// Unsubscribe from a view.
    #[instrument(skip(self), fields(view_id = %view_id.as_str()))]
    pub async fn unsubscribe(&self, view_id: &ViewId) -> Result<(), NatsError> {
        self.command_tx
            .send(BridgeCommand::Unsubscribe {
                view_id: view_id.clone(),
            })
            .await
            .map_err(|_| NatsError::BroadcastClosed)?;

        info!("View subscription removed");
        Ok(())
    }

    /// Add a route to the artifact router.
    pub async fn add_artifact_route(&self, route: Route<ViewArtifact>) {
        let mut router = self.artifact_router.write().await;
        router.add_route(route);
    }

    /// Add a route to the delta router.
    pub async fn add_delta_route(&self, route: Route<ViewDelta>) {
        let mut router = self.delta_router.write().await;
        router.add_route(route);
    }

    /// Register a transform pipeline.
    ///
    /// Note: The pipeline name is extracted from the pipeline itself via `pipeline.name()`.
    pub async fn register_transform(&self, pipeline: TransformPipeline) {
        let mut transforms = self.transforms.write().await;
        transforms.register(pipeline);
    }

    /// Get current metrics.
    pub fn metrics(&self) -> &Arc<BridgeMetrics> {
        &self.metrics
    }

    /// Get a snapshot of current metrics.
    pub fn metrics_snapshot(&self) -> MetricsSnapshot {
        self.metrics.snapshot()
    }

    /// Graceful shutdown.
    #[instrument(skip(self))]
    pub async fn shutdown(&mut self) {
        info!("Initiating bridge shutdown");

        self.shutdown.store(true, Ordering::SeqCst);

        // Signal shutdown
        let _ = self.command_tx.send(BridgeCommand::Shutdown).await;

        // Wait for main loop
        if let Some(handle) = self.loop_handle.take() {
            let _ = tokio::time::timeout(self.config.shutdown_timeout, handle).await;
        }

        // Cancel all fibers
        let fibers: Vec<_> = {
            let mut f = self.fibers.write().await;
            f.drain().map(|(_, fiber)| fiber).collect()
        };

        for fiber in fibers {
            fiber.cancel().await;
        }

        info!("Bridge shutdown complete");
    }

    /// The main event loop.
    async fn event_loop(
        mut commands: mpsc::Receiver<BridgeCommand>,
        batch_publisher: BatchPublisher,
        config: BridgeConfig,
        metrics: Arc<BridgeMetrics>,
        artifact_router: Arc<RwLock<ArtifactRouter>>,
        delta_router: Arc<RwLock<DeltaRouter>>,
        transforms: Arc<RwLock<TransformRegistry>>,
        shutdown: Arc<AtomicBool>,
    ) {
        let mut fibers: HashMap<ViewId, ViewSubscriptionFiber> = HashMap::new();

        // Channel for artifacts from subscription fibers
        let (artifact_tx, mut artifact_rx) = mpsc::channel::<ViewArtifact>(1024);

        loop {
            if shutdown.load(Ordering::Relaxed) {
                break;
            }

            tokio::select! {
                biased;

                // Handle commands
                Some(cmd) = commands.recv() => {
                    match cmd {
                        BridgeCommand::Subscribe { view_id, receiver } => {
                            let fiber = Self::spawn_subscription_fiber(
                                view_id.clone(),
                                receiver,
                                artifact_tx.clone(),
                                metrics.clone(),
                                shutdown.clone(),
                            );
                            fibers.insert(view_id, fiber);
                        }

                        BridgeCommand::Unsubscribe { view_id } => {
                            if let Some(fiber) = fibers.remove(&view_id) {
                                fiber.cancel().await;
                            }
                        }

                        BridgeCommand::PublishArtifact(artifact) => {
                            Self::process_artifact(
                                &artifact,
                                &batch_publisher,
                                &config,
                                &metrics,
                                &artifact_router,
                                &transforms,
                            ).await;
                        }

                        BridgeCommand::PublishDelta { view_id, delta } => {
                            if config.publish_deltas {
                                Self::process_delta(
                                    &view_id,
                                    &delta,
                                    &batch_publisher,
                                    &config,
                                    &metrics,
                                    &delta_router,
                                    &transforms,
                                ).await;
                            }
                        }

                        BridgeCommand::PublishStatus { view_id, status } => {
                            if config.publish_status {
                                Self::publish_status(
                                    &view_id,
                                    &status,
                                    &batch_publisher,
                                    &config,
                                    &metrics,
                                ).await;
                            }
                        }

                        BridgeCommand::Shutdown => {
                            break;
                        }
                    }
                }

                // Handle artifacts from subscription fibers
                Some(artifact) = artifact_rx.recv() => {
                    Self::process_artifact(
                        &artifact,
                        &batch_publisher,
                        &config,
                        &metrics,
                        &artifact_router,
                        &transforms,
                    ).await;
                }

                else => break,
            }
        }

        // Shutdown batch publisher
        batch_publisher.shutdown().await;

        info!("Bridge event loop terminated");
    }

    /// Spawn a subscription fiber for a view.
    fn spawn_subscription_fiber(
        view_id: ViewId,
        mut receiver: broadcast::Receiver<ViewArtifact>,
        artifact_tx: mpsc::Sender<ViewArtifact>,
        metrics: Arc<BridgeMetrics>,
        shutdown: Arc<AtomicBool>,
    ) -> ViewSubscriptionFiber {
        let cancel = Arc::new(AtomicBool::new(false));
        let cancel_clone = cancel.clone();
        let view_id_clone = view_id.clone();

        metrics.fiber_started();

        let handle = tokio::spawn(async move {
            let _guard = scopeguard::guard((), |_| {
                metrics.fiber_stopped();
            });

            loop {
                if cancel_clone.load(Ordering::Relaxed) || shutdown.load(Ordering::Relaxed) {
                    break;
                }

                match receiver.recv().await {
                    Ok(artifact) => {
                        metrics.record_artifact_received();

                        // Check backpressure
                        if artifact_tx.capacity() == 0 {
                            metrics.record_backpressure_drop();
                            warn!(view_id = %view_id_clone.as_str(), "Backpressure drop");
                            continue;
                        }

                        if artifact_tx.send(artifact).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        metrics.record_lag();
                        warn!(
                            view_id = %view_id_clone.as_str(),
                            lagged = n,
                            "Subscription fiber lagged"
                        );
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        info!(view_id = %view_id_clone.as_str(), "Broadcaster closed");
                        break;
                    }
                }
            }
        });

        ViewSubscriptionFiber {
            view_id,
            handle,
            cancel,
        }
    }

    /// Process an artifact through routing and transforms, then publish.
    #[instrument(skip_all, fields(view_id = %artifact.view_id.as_str()))]
    async fn process_artifact(
        artifact: &ViewArtifact,
        batch_publisher: &BatchPublisher,
        config: &BridgeConfig,
        metrics: &BridgeMetrics,
        artifact_router: &Arc<RwLock<ArtifactRouter>>,
        transforms: &Arc<RwLock<TransformRegistry>>,
    ) {
        let router = artifact_router.read().await;
        let transform_registry = transforms.read().await;

        // Get routing decisions
        let decisions = router.route(artifact);

        for decision in decisions {
            metrics.record_routing_decision();

            match decision {
                RoutingDecision::Single(subject) => {
                    Self::publish_artifact_to_subject(
                        artifact,
                        &subject,
                        batch_publisher,
                        config,
                        metrics,
                    ).await;
                }

                RoutingDecision::Fanout(subjects) => {
                    for subject in subjects {
                        Self::publish_artifact_to_subject(
                            artifact,
                            &subject,
                            batch_publisher,
                            config,
                            metrics,
                        ).await;
                    }
                }

                RoutingDecision::Transform { subject, transformer } => {
                    if let Some(pipeline) = transform_registry.get(&transformer) {
                        metrics.record_transform();
                        match pipeline.transform_artifact(artifact).await {
                            Ok(TransformOutput::Single(bytes)) => {
                                Self::publish_bytes(&subject, bytes, batch_publisher, metrics).await;
                            }
                            Ok(TransformOutput::Multiple(chunks)) => {
                                for (i, chunk) in chunks.into_iter().enumerate() {
                                    let chunk_subject = format!("{}.chunk.{}", subject, i);
                                    Self::publish_bytes(&chunk_subject, chunk, batch_publisher, metrics).await;
                                }
                            }
                            Ok(TransformOutput::Drop) => {
                                debug!(subject = %subject, "Transform dropped artifact");
                            }
                            Err(e) => {
                                metrics.record_error();
                                warn!(error = %e, "Transform failed");
                            }
                        }
                    } else {
                        // No transform found, publish as-is
                        Self::publish_artifact_to_subject(
                            artifact,
                            &subject,
                            batch_publisher,
                            config,
                            metrics,
                        ).await;
                    }
                }

                RoutingDecision::Drop => {
                    debug!("Routing decision: drop");
                }
            }
        }
    }

    /// Publish an artifact to a specific subject.
    async fn publish_artifact_to_subject(
        artifact: &ViewArtifact,
        subject: &str,
        batch_publisher: &BatchPublisher,
        _config: &BridgeConfig,
        metrics: &BridgeMetrics,
    ) {
        match serde_json::to_vec(artifact) {
            Ok(payload) => {
                batch_publisher.publish(PublishMessage::new(subject, payload));
                metrics.record_artifact_published();
            }
            Err(e) => {
                metrics.record_error();
                warn!(error = %e, "Failed to serialize artifact");
            }
        }
    }

    /// Publish raw bytes to a subject.
    async fn publish_bytes(
        subject: &str,
        bytes: Bytes,
        batch_publisher: &BatchPublisher,
        metrics: &BridgeMetrics,
    ) {
        batch_publisher.publish(PublishMessage::new(subject, bytes));
        metrics.record_artifact_published();
    }

    /// Process a delta through routing and publish.
    #[instrument(skip_all, fields(view_id = %view_id.as_str()))]
    async fn process_delta(
        view_id: &ViewId,
        delta: &ViewDelta,
        batch_publisher: &BatchPublisher,
        config: &BridgeConfig,
        metrics: &BridgeMetrics,
        delta_router: &Arc<RwLock<DeltaRouter>>,
        _transforms: &Arc<RwLock<TransformRegistry>>,
    ) {
        let router = delta_router.read().await;
        let decisions = router.route_delta(delta, view_id);

        if decisions.is_empty() {
            // Default subject
            let subject = config.nats.deltas_subject(view_id.as_str());
            match serde_json::to_vec(delta) {
                Ok(payload) => {
                    batch_publisher.publish(PublishMessage::new(subject, payload));
                    metrics.record_delta_published();
                }
                Err(e) => {
                    metrics.record_error();
                    warn!(error = %e, "Failed to serialize delta");
                }
            }
        } else {
            for decision in decisions {
                metrics.record_routing_decision();

                match decision {
                    RoutingDecision::Single(subject) => {
                        match serde_json::to_vec(delta) {
                            Ok(payload) => {
                                batch_publisher.publish(PublishMessage::new(subject, payload));
                                metrics.record_delta_published();
                            }
                            Err(e) => {
                                metrics.record_error();
                                warn!(error = %e, "Failed to serialize delta");
                            }
                        }
                    }
                    RoutingDecision::Fanout(subjects) => {
                        for subject in subjects {
                            match serde_json::to_vec(delta) {
                                Ok(payload) => {
                                    batch_publisher.publish(PublishMessage::new(subject, payload));
                                    metrics.record_delta_published();
                                }
                                Err(e) => {
                                    metrics.record_error();
                                    warn!(error = %e, "Failed to serialize delta");
                                }
                            }
                        }
                    }
                    RoutingDecision::Transform { .. } | RoutingDecision::Drop => {}
                }
            }
        }
    }

    /// Publish a status event.
    async fn publish_status(
        view_id: &ViewId,
        status: &ViewStatus,
        batch_publisher: &BatchPublisher,
        config: &BridgeConfig,
        metrics: &BridgeMetrics,
    ) {
        let subject = config.nats.status_subject(view_id.as_str());

        match serde_json::to_vec(status) {
            Ok(payload) => {
                batch_publisher.publish(PublishMessage::new(subject, payload));
                metrics.record_status_published();
            }
            Err(e) => {
                metrics.record_error();
                warn!(error = %e, "Failed to serialize status");
            }
        }
    }
}

impl Drop for NatsBridge {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::SeqCst);
        if let Some(handle) = self.loop_handle.take() {
            handle.abort();
        }
    }
}

// ============================================================================
// Bridge Builder
// ============================================================================

/// Fluent builder for NatsBridge.
pub struct NatsBridgeBuilder {
    config: BridgeConfig,
    artifact_routes: Vec<Route<ViewArtifact>>,
    delta_routes: Vec<Route<ViewDelta>>,
    transforms: Vec<TransformPipeline>,
}

impl NatsBridgeBuilder {
    pub fn new() -> Self {
        Self {
            config: BridgeConfig::default(),
            artifact_routes: Vec::new(),
            delta_routes: Vec::new(),
            transforms: Vec::new(),
        }
    }

    /// Set NATS configuration
    pub fn nats(mut self, config: NatsConfig) -> Self {
        self.config.nats = config;
        self
    }

    /// Set batch configuration
    pub fn batch(mut self, config: BatchConfig) -> Self {
        self.config.batch = config;
        self
    }

    /// Set max subscription fibers
    pub fn max_fibers(mut self, count: usize) -> Self {
        self.config.max_subscription_fibers = count;
        self
    }

    /// Disable delta publishing
    pub fn without_deltas(mut self) -> Self {
        self.config.publish_deltas = false;
        self
    }

    /// Disable status publishing
    pub fn without_status(mut self) -> Self {
        self.config.publish_status = false;
        self
    }

    /// Add an artifact route
    pub fn artifact_route(mut self, route: Route<ViewArtifact>) -> Self {
        self.artifact_routes.push(route);
        self
    }

    /// Add a delta route
    pub fn delta_route(mut self, route: Route<ViewDelta>) -> Self {
        self.delta_routes.push(route);
        self
    }

    /// Register a transform pipeline
    pub fn transform(mut self, pipeline: TransformPipeline) -> Self {
        self.transforms.push(pipeline);
        self
    }

    /// Build the bridge
    pub async fn build(self) -> Result<NatsBridge, NatsError> {
        let mut bridge = NatsBridge::new(self.config).await?;

        // Add routes
        for route in self.artifact_routes {
            bridge.add_artifact_route(route).await;
        }
        for route in self.delta_routes {
            bridge.add_delta_route(route).await;
        }

        // Register transforms
        for pipeline in self.transforms {
            bridge.register_transform(pipeline).await;
        }

        Ok(bridge)
    }
}

impl Default for NatsBridgeBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bridge_config_defaults() {
        let config = BridgeConfig::default();
        assert_eq!(config.max_subscription_fibers, 64);
        assert_eq!(config.subscription_buffer_size, 16);
        assert!(config.publish_deltas);
        assert!(config.publish_status);
    }

    #[test]
    fn test_metrics_snapshot() {
        let metrics = BridgeMetrics::default();
        metrics.record_artifact_received();
        metrics.record_artifact_received();
        metrics.record_artifact_published();
        metrics.record_error();

        let snapshot = metrics.snapshot();
        assert_eq!(snapshot.artifacts_received, 2);
        assert_eq!(snapshot.artifacts_published, 1);
        assert_eq!(snapshot.errors, 1);
    }

    #[test]
    fn test_builder_fluent_api() {
        let _builder = NatsBridgeBuilder::new()
            .max_fibers(32)
            .without_deltas()
            .without_status();
    }
}
