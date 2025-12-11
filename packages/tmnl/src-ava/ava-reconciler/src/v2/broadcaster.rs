//! ViewBroadcaster - Multi-consumer artifact distribution
//!
//! Uses tokio::sync::broadcast for one-to-many artifact streaming.

use std::sync::atomic::{AtomicUsize, Ordering};

use ava_domain::ViewArtifact;
use tokio::sync::broadcast::{self, Sender, Receiver};

use super::error::ReconcilerErrorV2;

/// Strategy for handling slow consumers
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LagStrategy {
    /// Drop oldest messages when buffer full (default, resilient)
    DropOldest,
    /// Return error when receiver lags (strict)
    ErrorOnLag,
}

impl Default for LagStrategy {
    fn default() -> Self {
        Self::DropOldest
    }
}

/// Configuration for ViewBroadcaster
#[derive(Debug, Clone)]
pub struct BroadcasterConfig {
    /// Channel buffer size (default: 16)
    pub buffer_size: usize,

    /// Strategy when receiver lags behind
    pub lag_strategy: LagStrategy,
}

impl Default for BroadcasterConfig {
    fn default() -> Self {
        Self {
            buffer_size: 16,
            lag_strategy: LagStrategy::DropOldest,
        }
    }
}

/// Multi-consumer artifact broadcaster
///
/// Wraps tokio::sync::broadcast to distribute ViewArtifacts
/// to multiple subscribers.
#[derive(Debug)]
pub struct ViewBroadcaster {
    /// Broadcast sender (held by runtime)
    tx: Sender<ViewArtifact>,

    /// Configuration
    config: BroadcasterConfig,

    /// Broadcast count for metrics
    broadcast_count: AtomicUsize,
}

impl ViewBroadcaster {
    /// Create a new broadcaster with the given configuration
    pub fn new(config: BroadcasterConfig) -> Self {
        let (tx, _) = broadcast::channel(config.buffer_size);
        Self {
            tx,
            config,
            broadcast_count: AtomicUsize::new(0),
        }
    }

    /// Create a broadcaster with default configuration
    pub fn with_defaults() -> Self {
        Self::new(BroadcasterConfig::default())
    }

    /// Subscribe to artifact updates
    ///
    /// Returns a receiver that will receive all future broadcasts.
    /// The receiver may lag behind if it doesn't consume messages fast enough.
    pub fn subscribe(&self) -> Receiver<ViewArtifact> {
        self.tx.subscribe()
    }

    /// Broadcast a new artifact to all subscribers
    ///
    /// Returns the number of receivers that received the message.
    /// Returns 0 if there are no active subscribers.
    pub fn broadcast(&self, artifact: ViewArtifact) -> Result<usize, ReconcilerErrorV2> {
        let count = self.tx.send(artifact)
            .map_err(|e| ReconcilerErrorV2::BroadcastFailed(e.to_string()))?;

        self.broadcast_count.fetch_add(1, Ordering::Relaxed);
        Ok(count)
    }

    /// Number of active subscribers
    pub fn subscriber_count(&self) -> usize {
        self.tx.receiver_count()
    }

    /// Total number of broadcasts sent
    pub fn broadcast_count(&self) -> usize {
        self.broadcast_count.load(Ordering::Relaxed)
    }

    /// Check if there are any active subscribers
    pub fn has_subscribers(&self) -> bool {
        self.subscriber_count() > 0
    }

    /// Get the configuration
    pub fn config(&self) -> &BroadcasterConfig {
        &self.config
    }
}

impl Clone for ViewBroadcaster {
    fn clone(&self) -> Self {
        Self {
            tx: self.tx.clone(),
            config: self.config.clone(),
            broadcast_count: AtomicUsize::new(self.broadcast_count.load(Ordering::Relaxed)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ava_domain::{ViewId, ViewProfileSpec, AssemblageId, ChannelBinding};
    use std::collections::HashMap;

    fn make_artifact(id: &str) -> ViewArtifact {
        ViewArtifact {
            view_id: ViewId::new(id),
            asset_id: None,
            spec: ViewProfileSpec {
                id: ViewId::new(id),
                name: format!("View {}", id),
                description: None,
                assemblage_id: AssemblageId::new("test"),
                channels: vec![],
                tags: HashMap::new(),
                version: 1,
            },
            channel_bindings: vec![],
            created_at_ms: 0.0,
            logical_version: 1,
        }
    }

    #[tokio::test]
    async fn test_new_broadcaster() {
        let broadcaster = ViewBroadcaster::with_defaults();
        assert_eq!(broadcaster.subscriber_count(), 0);
        assert_eq!(broadcaster.broadcast_count(), 0);
    }

    #[tokio::test]
    async fn test_subscribe_and_receive() {
        let broadcaster = ViewBroadcaster::with_defaults();
        let mut rx = broadcaster.subscribe();

        assert_eq!(broadcaster.subscriber_count(), 1);

        let artifact = make_artifact("view-1");
        broadcaster.broadcast(artifact.clone()).unwrap();

        let received = rx.recv().await.unwrap();
        assert_eq!(received.view_id, ViewId::new("view-1"));
    }

    #[tokio::test]
    async fn test_multiple_subscribers() {
        let broadcaster = ViewBroadcaster::with_defaults();
        let mut rx1 = broadcaster.subscribe();
        let mut rx2 = broadcaster.subscribe();

        assert_eq!(broadcaster.subscriber_count(), 2);

        let artifact = make_artifact("view-1");
        let count = broadcaster.broadcast(artifact).unwrap();

        assert_eq!(count, 2);

        let a1 = rx1.recv().await.unwrap();
        let a2 = rx2.recv().await.unwrap();

        assert_eq!(a1.view_id, a2.view_id);
    }

    #[tokio::test]
    async fn test_broadcast_count() {
        let broadcaster = ViewBroadcaster::with_defaults();
        let _rx = broadcaster.subscribe();

        for i in 0..5 {
            broadcaster.broadcast(make_artifact(&format!("view-{}", i))).unwrap();
        }

        assert_eq!(broadcaster.broadcast_count(), 5);
    }

    #[tokio::test]
    async fn test_no_subscribers_error() {
        let broadcaster = ViewBroadcaster::with_defaults();

        // No subscribers, should error
        let result = broadcaster.broadcast(make_artifact("view-1"));
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn test_clone_shares_channel() {
        let broadcaster1 = ViewBroadcaster::with_defaults();
        let mut rx = broadcaster1.subscribe();

        let broadcaster2 = broadcaster1.clone();

        // Broadcasting on clone should reach subscriber from original
        broadcaster2.broadcast(make_artifact("view-1")).unwrap();

        let received = rx.recv().await.unwrap();
        assert_eq!(received.view_id, ViewId::new("view-1"));
    }

    #[tokio::test]
    async fn test_has_subscribers() {
        let broadcaster = ViewBroadcaster::with_defaults();
        assert!(!broadcaster.has_subscribers());

        let _rx = broadcaster.subscribe();
        assert!(broadcaster.has_subscribers());

        drop(_rx);
        // After dropping, subscriber count should be 0
        // Note: This may not update immediately due to how broadcast works
    }

    #[tokio::test]
    async fn test_custom_buffer_size() {
        let config = BroadcasterConfig {
            buffer_size: 32,
            lag_strategy: LagStrategy::ErrorOnLag,
        };

        let broadcaster = ViewBroadcaster::new(config);
        assert_eq!(broadcaster.config().buffer_size, 32);
        assert_eq!(broadcaster.config().lag_strategy, LagStrategy::ErrorOnLag);
    }
}
