//! NATS Integration for AvaRuntimeV2
//!
//! Provides bridge between the runtime's internal broadcast channels and NATS JetStream.
//!
//! # Feature Flag
//!
//! This module requires the `nats` feature:
//!
//! ```toml
//! [dependencies]
//! ava-runtime = { path = "...", features = ["nats"] }
//! ```
//!
//! # Usage
//!
//! ```ignore
//! use ava_runtime::v2::{AvaRuntimeV2, RuntimeConfigV2};
//! use ava_runtime::v2::nats::{NatsIntegration, NatsRuntimeConfig};
//!
//! // Configure NATS
//! let nats_config = NatsRuntimeConfig {
//!     server_url: "nats://localhost:4222".into(),
//!     stream_name: "TMNL_AVA".into(),
//!     subject_prefix: "tmnl.ava".into(),
//!     ..Default::default()
//! };
//!
//! // Create runtime with NATS
//! let runtime = AvaRuntimeV2::new(RuntimeConfigV2::default());
//! let nats = NatsIntegration::connect(nats_config).await?;
//!
//! // Wire views to NATS
//! nats.attach_view(&runtime, &view_id).await?;
//! ```

use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

use ava_domain::ViewId;
use ava_adapters::nats::{
    NatsBridge, NatsBridgeBuilder, BridgeConfig, NatsConfig, BatchConfig,
    ArtifactRouter, DeltaRouter, TransformRegistry, MetricsSnapshot,
};
use ava_reconciler::v2::ReconcilerV2;

use crate::error::RuntimeError;

/// NATS runtime configuration
#[derive(Debug, Clone)]
pub struct NatsRuntimeConfig {
    /// NATS server URL
    pub server_url: String,

    /// JetStream stream name
    pub stream_name: String,

    /// Subject prefix for all messages
    pub subject_prefix: String,

    /// Maximum messages to retain in stream
    pub max_messages: i64,

    /// Publish batch size
    pub batch_size: usize,

    /// Flush interval in milliseconds
    pub flush_interval_ms: u64,

    /// Number of concurrent publish workers
    pub workers: usize,

    /// Maximum subscription fibers
    pub max_subscription_fibers: usize,

    /// Enable compression for payloads
    pub enable_compression: bool,
}

impl Default for NatsRuntimeConfig {
    fn default() -> Self {
        Self {
            server_url: "nats://localhost:4222".into(),
            stream_name: "TMNL_AVA".into(),
            subject_prefix: "tmnl.ava".into(),
            max_messages: 100_000,
            batch_size: 100,
            flush_interval_ms: 50,
            workers: 4,
            max_subscription_fibers: 64,
            enable_compression: false,
        }
    }
}

impl NatsRuntimeConfig {
    /// Convert to NATS config
    pub fn to_nats_config(&self) -> NatsConfig {
        NatsConfig {
            server_url: self.server_url.clone(),
            stream_name: self.stream_name.clone(),
            subject_prefix: self.subject_prefix.clone(),
            max_messages: self.max_messages,
            max_reconnect_attempts: 0, // infinite
            reconnect_delay_ms: 1000,
        }
    }

    /// Convert to batch config
    pub fn to_batch_config(&self) -> BatchConfig {
        BatchConfig {
            max_batch_size: self.batch_size,
            flush_interval: Duration::from_millis(self.flush_interval_ms),
            publish_workers: self.workers,
            ..Default::default()
        }
    }

    /// Convert to bridge config
    pub fn to_bridge_config(&self) -> BridgeConfig {
        BridgeConfig::default()
            .with_nats(self.to_nats_config())
            .with_batch(self.to_batch_config())
            .max_fibers(self.max_subscription_fibers)
    }
}

/// NATS integration handle for AvaRuntimeV2
///
/// Manages the NatsBridge lifecycle and provides methods for:
/// - Connecting/disconnecting from NATS
/// - Attaching views to the bridge
/// - Configuring routing and transforms
/// - Monitoring metrics
pub struct NatsIntegration {
    /// The underlying NATS bridge
    bridge: Arc<RwLock<NatsBridge>>,

    /// Configuration
    config: NatsRuntimeConfig,
}

impl NatsIntegration {
    /// Connect to NATS and create the integration
    pub async fn connect(config: NatsRuntimeConfig) -> Result<Self, RuntimeError> {
        let bridge = NatsBridgeBuilder::new()
            .nats(config.to_nats_config())
            .batch(config.to_batch_config())
            .max_fibers(config.max_subscription_fibers)
            .build()
            .await
            .map_err(|e| RuntimeError::nats_error(format!("Failed to connect: {}", e)))?;

        Ok(Self {
            bridge: Arc::new(RwLock::new(bridge)),
            config,
        })
    }

    /// Attach a view from the reconciler to NATS
    ///
    /// This wires the view's broadcast channel to the NATS bridge,
    /// publishing all artifacts to JetStream.
    pub async fn attach_view(
        &self,
        reconciler: &ReconcilerV2,
        view_id: &ViewId,
    ) -> Result<(), RuntimeError> {
        // Get broadcaster from reconciler
        let broadcaster = reconciler
            .get_broadcaster(view_id)
            .await
            .ok_or_else(|| RuntimeError::view_not_found(view_id))?;

        // Subscribe to broadcaster to get artifact receiver
        let receiver = broadcaster.subscribe();

        // Wire receiver to bridge
        let bridge = self.bridge.read().await;
        bridge
            .subscribe(view_id.clone(), receiver)
            .await
            .map_err(|e| RuntimeError::nats_error(format!("Failed to attach view: {}", e)))?;

        Ok(())
    }

    /// Detach a view from NATS
    pub async fn detach_view(&self, view_id: &ViewId) -> Result<(), RuntimeError> {
        let bridge = self.bridge.read().await;
        bridge
            .unsubscribe(view_id)
            .await
            .map_err(|e| RuntimeError::nats_error(format!("Failed to detach view: {}", e)))?;

        Ok(())
    }

    /// Get current metrics snapshot
    pub async fn metrics(&self) -> MetricsSnapshot {
        let bridge = self.bridge.read().await;
        bridge.metrics_snapshot()
    }

    /// Configure artifact routing
    pub async fn configure_artifact_router<F>(&self, f: F) -> Result<(), RuntimeError>
    where
        F: FnOnce(&mut ArtifactRouter),
    {
        let bridge = self.bridge.read().await;
        let router_arc = bridge.artifact_router();
        let mut router = router_arc.write().await;
        f(&mut router);
        Ok(())
    }

    /// Configure delta routing
    pub async fn configure_delta_router<F>(&self, f: F) -> Result<(), RuntimeError>
    where
        F: FnOnce(&mut DeltaRouter),
    {
        let bridge = self.bridge.read().await;
        let router_arc = bridge.delta_router();
        let mut router = router_arc.write().await;
        f(&mut router);
        Ok(())
    }

    /// Configure transform pipelines
    pub async fn configure_transforms<F>(&self, f: F) -> Result<(), RuntimeError>
    where
        F: FnOnce(&mut TransformRegistry),
    {
        let bridge = self.bridge.read().await;
        let transforms_arc = bridge.transforms();
        let mut registry = transforms_arc.write().await;
        f(&mut registry);
        Ok(())
    }

    /// Shutdown the NATS integration
    pub async fn shutdown(&self) {
        let mut bridge = self.bridge.write().await;
        bridge.shutdown().await;
    }

    /// Get the configuration
    pub fn config(&self) -> &NatsRuntimeConfig {
        &self.config
    }

    /// Check if a view is attached
    pub async fn is_view_attached(&self, view_id: &ViewId) -> bool {
        let bridge = self.bridge.read().await;
        bridge.is_view_subscribed(view_id)
    }

    /// List all attached view IDs
    pub async fn attached_views(&self) -> Vec<ViewId> {
        let bridge = self.bridge.read().await;
        bridge.subscribed_views()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = NatsRuntimeConfig::default();
        assert_eq!(config.server_url, "nats://localhost:4222");
        assert_eq!(config.stream_name, "TMNL_AVA");
        assert_eq!(config.subject_prefix, "tmnl.ava");
    }

    #[test]
    fn test_config_to_nats_config() {
        let config = NatsRuntimeConfig {
            server_url: "nats://example.com:4222".into(),
            stream_name: "TEST".into(),
            subject_prefix: "test".into(),
            ..Default::default()
        };

        let nats_config: NatsConfig = config.into();
        assert_eq!(nats_config.server_url, "nats://example.com:4222");
        assert_eq!(nats_config.stream_name, "TEST");
    }

    #[test]
    fn test_config_to_bridge_config() {
        let config = NatsRuntimeConfig {
            batch_size: 50,
            workers: 8,
            ..Default::default()
        };

        let bridge_config: BridgeConfig = config.into();
        assert_eq!(bridge_config.batch_size, 50);
        assert_eq!(bridge_config.workers, 8);
    }
}
