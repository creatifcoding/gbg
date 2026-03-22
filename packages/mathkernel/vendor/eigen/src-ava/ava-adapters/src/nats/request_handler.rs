//! NATS Request Handler
//!
//! Subscribes to AVA request topics and processes client commands.
//!
//! # Request Subjects
//!
//! - `{prefix}.request.subscribe.{view_id}` - Subscribe to a view
//! - `{prefix}.request.invalidate.{view_id}` - Invalidate a view
//! - `{prefix}.request.unsubscribe.{view_id}` - Unsubscribe from a view
//!
//! # Response Subjects
//!
//! - `{prefix}.artifacts.{view_id}` - View artifact published
//! - `{prefix}.deltas.{view_id}` - View delta published
//! - `{prefix}.events.{event_type}` - Reconciler events
//!
//! # Architecture
//!
//! ```text
//! TypeScript Client                    Rust Server
//! ┌──────────────┐                   ┌──────────────────────────────┐
//! │  AvaClientV2 │                   │       NatsRequestHandler     │
//! │              │                   │                              │
//! │  publish ───►│ request.subscribe │◄── subscribe ─────────────── │
//! │              │ request.invalidate│                              │
//! │              │ request.unsubscribe                              │
//! │              │                   │        ┌─────────────────┐   │
//! │              │                   │        │  ReconcilerV2   │   │
//! │              │                   │        │                 │   │
//! │  ◄─ subscribe│ artifacts.{id}   │──publish ◄── process ────│   │
//! │              │ deltas.{id}      │        │                 │   │
//! │              │ events.*         │        └─────────────────┘   │
//! └──────────────┘                   └──────────────────────────────┘
//! ```

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use async_nats::jetstream::consumer::pull::Stream as ConsumerStream;
use async_nats::jetstream::{self, Context as JetStreamContext};
use futures::StreamExt;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tracing::{debug, error, info, instrument, warn};

use ava_domain::ViewId;

use super::config::NatsConfig;
use super::error::NatsError;

// ============================================================================
// Request Types
// ============================================================================

/// Request from TypeScript client
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct SubscribeRequest {
    pub view_id: String,
    #[serde(default)]
    pub spec: Option<serde_json::Value>,
}

/// Invalidation request
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct InvalidateRequest {
    pub view_id: String,
    #[serde(default)]
    pub reason: Option<String>,
    #[serde(default)]
    pub force: bool,
}

/// Unsubscribe request
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub struct UnsubscribeRequest {
    pub view_id: String,
}

/// Commands from request handler to runtime
#[derive(Debug)]
pub enum RuntimeCommand {
    Subscribe { view_id: ViewId },
    Invalidate { view_id: ViewId, reason: String },
    Unsubscribe { view_id: ViewId },
}

// ============================================================================
// Request Handler Configuration
// ============================================================================

/// Configuration for the request handler
#[derive(Debug, Clone)]
pub struct RequestHandlerConfig {
    /// NATS configuration
    pub nats: NatsConfig,

    /// Maximum concurrent request processing
    pub max_concurrent: usize,

    /// Request timeout in milliseconds
    pub request_timeout_ms: u64,

    /// Enable JetStream durable consumers (for request-reply)
    pub use_jetstream: bool,
}

impl Default for RequestHandlerConfig {
    fn default() -> Self {
        Self {
            nats: NatsConfig::default(),
            max_concurrent: 32,
            request_timeout_ms: 30_000,
            use_jetstream: false, // Use core NATS for simple pub/sub
        }
    }
}

impl RequestHandlerConfig {
    /// Create with NATS config
    pub fn with_nats(mut self, nats: NatsConfig) -> Self {
        self.nats = nats;
        self
    }
}

// ============================================================================
// Request Handler
// ============================================================================

/// Handles incoming NATS requests and dispatches to reconciler
pub struct NatsRequestHandler {
    /// NATS client (core, not JetStream)
    client: async_nats::Client,

    /// Configuration
    config: RequestHandlerConfig,

    /// Command sender (to runtime/reconciler)
    command_tx: mpsc::Sender<RuntimeCommand>,

    /// Subscription handles
    handles: Vec<JoinHandle<()>>,

    /// Shutdown flag
    shutdown: Arc<AtomicBool>,
}

impl NatsRequestHandler {
    /// Create a new request handler and connect to NATS
    #[instrument(skip_all, fields(server = %config.nats.server_url))]
    pub async fn new(
        config: RequestHandlerConfig,
        command_tx: mpsc::Sender<RuntimeCommand>,
    ) -> Result<Self, NatsError> {
        info!("Connecting NATS request handler");

        let client = async_nats::connect(&config.nats.server_url).await?;

        info!("NATS request handler connected");

        Ok(Self {
            client,
            config,
            command_tx,
            handles: Vec::new(),
            shutdown: Arc::new(AtomicBool::new(false)),
        })
    }

    /// Start listening for requests
    #[instrument(skip(self))]
    pub async fn start(&mut self) -> Result<(), NatsError> {
        let prefix = &self.config.nats.subject_prefix;

        // Subscribe to request topics
        let subscribe_subject = format!("{}.request.subscribe.*", prefix);
        let invalidate_subject = format!("{}.request.invalidate.*", prefix);
        let unsubscribe_subject = format!("{}.request.unsubscribe.*", prefix);

        info!(subscribe = %subscribe_subject, "Starting request subscriptions");

        // Subscribe handler
        let sub = self.client.subscribe(subscribe_subject.clone()).await?;
        self.handles.push(self.spawn_handler(
            sub,
            RequestKind::Subscribe,
        ));

        // Invalidate handler
        let sub = self.client.subscribe(invalidate_subject.clone()).await?;
        self.handles.push(self.spawn_handler(
            sub,
            RequestKind::Invalidate,
        ));

        // Unsubscribe handler
        let sub = self.client.subscribe(unsubscribe_subject.clone()).await?;
        self.handles.push(self.spawn_handler(
            sub,
            RequestKind::Unsubscribe,
        ));

        info!("Request handler started - listening on:");
        info!("  - {}", subscribe_subject);
        info!("  - {}", invalidate_subject);
        info!("  - {}", unsubscribe_subject);

        Ok(())
    }

    /// Spawn a handler for a specific request kind
    fn spawn_handler(
        &self,
        mut subscription: async_nats::Subscriber,
        kind: RequestKind,
    ) -> JoinHandle<()> {
        let command_tx = self.command_tx.clone();
        let shutdown = self.shutdown.clone();

        tokio::spawn(async move {
            while !shutdown.load(Ordering::Relaxed) {
                tokio::select! {
                    Some(msg) = subscription.next() => {
                        if let Err(e) = Self::handle_message(msg, kind, &command_tx).await {
                            warn!(error = %e, kind = ?kind, "Failed to handle request");
                        }
                    }
                    else => break,
                }
            }
            debug!(kind = ?kind, "Request handler stopped");
        })
    }

    /// Handle a single message
    async fn handle_message(
        msg: async_nats::Message,
        kind: RequestKind,
        command_tx: &mpsc::Sender<RuntimeCommand>,
    ) -> Result<(), NatsError> {
        // Extract view_id from subject (last segment)
        let view_id_str = msg.subject
            .split('.')
            .last()
            .ok_or_else(|| NatsError::InvalidSubject("Missing view_id in subject".into()))?;

        debug!(
            subject = %msg.subject,
            view_id = %view_id_str,
            kind = ?kind,
            "Received request"
        );

        let command = match kind {
            RequestKind::Subscribe => {
                // Parse optional body for spec
                let _body: Option<SubscribeRequest> = if !msg.payload.is_empty() {
                    serde_json::from_slice(&msg.payload).ok()
                } else {
                    None
                };

                RuntimeCommand::Subscribe {
                    view_id: ViewId::new(view_id_str),
                }
            }
            RequestKind::Invalidate => {
                let body: Option<InvalidateRequest> = if !msg.payload.is_empty() {
                    serde_json::from_slice(&msg.payload).ok()
                } else {
                    None
                };

                let reason = body
                    .and_then(|b| b.reason)
                    .unwrap_or_else(|| "manual".to_string());

                RuntimeCommand::Invalidate {
                    view_id: ViewId::new(view_id_str),
                    reason,
                }
            }
            RequestKind::Unsubscribe => {
                RuntimeCommand::Unsubscribe {
                    view_id: ViewId::new(view_id_str),
                }
            }
        };

        command_tx.send(command).await
            .map_err(|_| NatsError::BroadcastClosed)?;

        Ok(())
    }

    /// Shutdown the handler
    pub async fn shutdown(&mut self) {
        info!("Shutting down request handler");
        self.shutdown.store(true, Ordering::SeqCst);

        for handle in self.handles.drain(..) {
            handle.abort();
        }
    }
}

/// Request kind for routing
#[derive(Debug, Clone, Copy)]
enum RequestKind {
    Subscribe,
    Invalidate,
    Unsubscribe,
}

impl Drop for NatsRequestHandler {
    fn drop(&mut self) {
        self.shutdown.store(true, Ordering::SeqCst);
        for handle in &self.handles {
            handle.abort();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subscribe_request_deserialize() {
        let json = r#"{"view_id": "test-view"}"#;
        let req: SubscribeRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.view_id, "test-view");
        assert!(req.spec.is_none());
    }

    #[test]
    fn test_invalidate_request_deserialize() {
        let json = r#"{"view_id": "test-view", "reason": "cache bust", "force": true}"#;
        let req: InvalidateRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.view_id, "test-view");
        assert_eq!(req.reason, Some("cache bust".to_string()));
        assert!(req.force);
    }

    #[test]
    fn test_config_defaults() {
        let config = RequestHandlerConfig::default();
        assert_eq!(config.max_concurrent, 32);
        assert!(!config.use_jetstream);
    }
}
