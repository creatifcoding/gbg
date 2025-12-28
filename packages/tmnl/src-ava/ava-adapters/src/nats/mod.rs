//! NATS JetStream Adapter
//!
//! Bridges AVA's internal artifact broadcast to NATS JetStream,
//! enabling frontend consumption via Connection Ports.
//!
//! # Architecture
//!
//! ```text
//! ReconcilerV2 → ViewBroadcaster → NatsPublisher → NATS JetStream
//!                                       │
//!                      ┌────────────────┼────────────────┐
//!                      ▼                ▼                ▼
//!               BatchPublisher    Routers/Transforms   Metrics
//!                      │                │                │
//!                      └────────────────┼────────────────┘
//!                                       ▼
//!                     Frontend ← Connection Ports ← WebSocket Bridge
//! ```
//!
//! # Features
//!
//! - **Basic Publishing**: Simple artifact/delta publishing via `NatsPublisher`
//! - **Batch Publishing**: High-throughput concurrent publishing via `BatchPublisher`
//! - **Advanced Routing**: Pattern-based routing with wildcards, fanout, and partitioning
//! - **Transform Pipelines**: Composable message transforms (filter, enrich, chunk)
//! - **Declarative Macros**: DSL for defining routes and handlers
//!
//! # Quick Start
//!
//! ```ignore
//! use ava_adapters::nats::{NatsConfig, NatsPublisher, BatchPublisher};
//! use ava_adapters::{subject, nats_config, batch_config};
//!
//! // Create config using macro
//! let config = nats_config! {
//!     server: "localhost:4222",
//!     stream: "TMNL_AVA",
//!     prefix: "tmnl.ava",
//! };
//!
//! // Basic publisher
//! let publisher = NatsPublisher::new(config.clone()).await?;
//! publisher.publish_artifact(&artifact).await?;
//!
//! // High-throughput batch publisher
//! let batch_config = batch_config! {
//!     batch_size: 100,
//!     flush_ms: 50,
//!     workers: 4,
//! };
//! let batch_pub = BatchPublisher::new(jetstream, batch_config);
//! batch_pub.publish(PublishMessage::new(
//!     subject!("tmnl.ava.artifacts", artifact.view_id.as_str()),
//!     serde_json::to_vec(&artifact)?,
//! ));
//! ```
//!
//! # Advanced Routing
//!
//! ```ignore
//! use ava_adapters::nats::router::{ArtifactRouter, Route};
//!
//! let router = ArtifactRouter::new()
//!     .route(Route::new("tmnl.ava.artifacts.{view_id}")
//!         .partition_by(|a| a.spec.assemblage_id.as_str())
//!         .filter(|a| !a.channel_bindings.is_empty()))
//!     .route(Route::new("tmnl.replica.artifacts.{view_id}")
//!         .fanout_to(["replica-1", "replica-2"]));
//!
//! for decision in router.route_artifact(&artifact) {
//!     match decision {
//!         RoutingDecision::Single(subject) => publisher.publish(subject, payload).await?,
//!         RoutingDecision::Fanout(subjects) => { /* publish to all */ },
//!         RoutingDecision::Drop => { /* skip */ },
//!         RoutingDecision::Transform { subject, transformer } => { /* apply transform */ },
//!     }
//! }
//! ```
//!
//! # Transform Pipelines
//!
//! ```ignore
//! use ava_adapters::nats::transform::{TransformPipeline, FilterTransform, ChunkTransform};
//!
//! let pipeline = TransformPipeline::named("compress-and-chunk")
//!     .add(FilterTransform::new(|a| a.channel_bindings.len() > 0))
//!     .add(ChunkTransform::new(64 * 1024));
//!
//! match pipeline.transform_artifact(&artifact).await? {
//!     TransformOutput::Single(bytes) => { /* publish single message */ },
//!     TransformOutput::Multiple(chunks) => { /* publish each chunk */ },
//!     TransformOutput::Drop => { /* skip */ },
//! }
//! ```
//!
//! # Subject Patterns
//!
//! | Subject Pattern | Description |
//! |-----------------|-------------|
//! | `tmnl.ava.artifacts.{view_id}` | Full view artifacts |
//! | `tmnl.ava.deltas.{view_id}` | Incremental updates |
//! | `tmnl.ava.status.{view_id}` | Lifecycle events |
//! | `tmnl.ava.invalidate.{view_id}` | Trigger recompute |

mod config;
mod error;
mod publisher;
mod subscriber;

// Advanced modules
mod batch;
mod bridge;
mod router;
mod transform;

// Macros (re-exported at crate root via #[macro_export])
#[macro_use]
mod macros;

// Core exports
pub use config::NatsConfig;
pub use error::NatsError;
pub use publisher::{NatsPublisher, SharedNatsPublisher};
pub use subscriber::{NatsSubscriber, InvalidationRequest};

// Batch publishing
pub use batch::{
    BatchPublisher,
    BatchPublisherBuilder,
    BatchConfig,
    BatchMetrics,
    PublishMessage,
};

// Routing
pub use router::{
    SubjectPattern,
    SubjectBuilder,
    RoutingDecision,
    Route,
    ArtifactRouter,
    DeltaRouter,
};

// Transforms
pub use transform::{
    Transform,
    TransformOutput,
    TransformPipeline,
    TransformRegistry,
    IdentityTransform,
    FilterTransform,
    EnrichTransform,
    ChunkTransform,
};

// Bridge (ReconcilerV2 integration)
pub use bridge::{
    NatsBridge,
    NatsBridgeBuilder,
    BridgeConfig,
    BridgeMetrics,
    MetricsSnapshot,
    ViewStatus,
    ViewState,
};

// Re-export macros are handled by #[macro_export] in macros.rs
