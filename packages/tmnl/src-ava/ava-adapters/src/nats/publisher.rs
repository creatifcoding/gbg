//! NATS JetStream Publisher
//!
//! Subscribes to ViewBroadcaster and publishes artifacts to NATS JetStream.

use std::sync::Arc;
use async_nats::jetstream::{self, Context as JetStreamContext};
use tokio::sync::broadcast;
use tracing::{debug, info, warn};

use ava_domain::views::{ViewArtifact, ViewDelta};
use ava_domain::ids::ViewId;

use super::config::NatsConfig;
use super::error::NatsError;

/// NATS JetStream publisher for AVA artifacts.
///
/// Receives artifacts from ReconcilerV2's ViewBroadcaster and publishes
/// them to NATS JetStream for frontend consumption.
pub struct NatsPublisher {
    jetstream: JetStreamContext,
    config: NatsConfig,
}

impl NatsPublisher {
    /// Creates a new NATS publisher with the given configuration.
    ///
    /// # Errors
    ///
    /// Returns error if connection fails or stream creation fails.
    pub async fn new(config: NatsConfig) -> Result<Self, NatsError> {
        info!(
            server = %config.server_url,
            stream = %config.stream_name,
            "Connecting to NATS"
        );

        let client = async_nats::ConnectOptions::new()
            .event_callback(|event| async move {
                debug!("NATS event: {:?}", event);
            })
            .connect(&config.server_url)
            .await?;

        let jetstream = async_nats::jetstream::new(client);

        // Ensure stream exists with correct configuration
        jetstream
            .get_or_create_stream(jetstream::stream::Config {
                name: config.stream_name.clone(),
                subjects: vec![config.all_subjects_pattern()],
                retention: jetstream::stream::RetentionPolicy::WorkQueue,
                max_messages: config.max_messages,
                ..Default::default()
            })
            .await?;

        info!(
            stream = %config.stream_name,
            "NATS stream ready"
        );

        Ok(Self { jetstream, config })
    }

    /// Creates a publisher from an existing JetStream context.
    ///
    /// Useful for testing or when sharing a connection.
    pub fn from_context(jetstream: JetStreamContext, config: NatsConfig) -> Self {
        Self { jetstream, config }
    }

    /// Runs the publisher loop, receiving artifacts from a broadcast channel.
    ///
    /// This method blocks until the broadcast channel is closed.
    ///
    /// # Arguments
    ///
    /// * `rx` - Receiver from ReconcilerV2's ViewBroadcaster
    ///
    /// # Errors
    ///
    /// Returns error on publish failure. Lag errors are logged but don't stop the loop.
    pub async fn run(
        &self,
        mut rx: broadcast::Receiver<ViewArtifact>,
    ) -> Result<(), NatsError> {
        info!("Starting NATS publisher loop");

        loop {
            match rx.recv().await {
                Ok(artifact) => {
                    if let Err(e) = self.publish_artifact(&artifact).await {
                        warn!(
                            view_id = %artifact.view_id.as_str(),
                            error = %e,
                            "Failed to publish artifact"
                        );
                    }
                }
                Err(broadcast::error::RecvError::Lagged(n)) => {
                    warn!(
                        lagged = n,
                        "Publisher lagged behind broadcaster"
                    );
                }
                Err(broadcast::error::RecvError::Closed) => {
                    info!("Broadcast channel closed, shutting down publisher");
                    break;
                }
            }
        }

        Ok(())
    }

    /// Publishes a single artifact to NATS JetStream.
    ///
    /// The artifact is serialized to JSON and published to the subject
    /// `{prefix}.artifacts.{view_id}`.
    pub async fn publish_artifact(&self, artifact: &ViewArtifact) -> Result<(), NatsError> {
        let subject = self.config.artifacts_subject(artifact.view_id.as_str());
        let payload = serde_json::to_vec(artifact)?;

        debug!(
            view_id = %artifact.view_id.as_str(),
            version = artifact.logical_version,
            subject = %subject,
            payload_bytes = payload.len(),
            "Publishing artifact"
        );

        let ack = self.jetstream.publish(subject, payload.into()).await?;
        ack.await.map_err(|e| NatsError::Publish(e.to_string()))?;

        debug!(
            view_id = %artifact.view_id.as_str(),
            version = artifact.logical_version,
            "Artifact published successfully"
        );

        Ok(())
    }

    /// Publishes a view delta to NATS JetStream.
    ///
    /// Deltas are published to the subject `{prefix}.deltas.{view_id}`.
    pub async fn publish_delta(
        &self,
        view_id: &ViewId,
        delta: &ViewDelta,
    ) -> Result<(), NatsError> {
        let subject = self.config.deltas_subject(view_id.as_str());
        let payload = serde_json::to_vec(delta)?;

        debug!(
            view_id = %view_id.as_str(),
            subject = %subject,
            "Publishing delta"
        );

        let ack = self.jetstream.publish(subject, payload.into()).await?;
        ack.await.map_err(|e| NatsError::Publish(e.to_string()))?;

        Ok(())
    }

    /// Publishes a status event to NATS JetStream.
    ///
    /// Status events are published to `{prefix}.status.{view_id}`.
    pub async fn publish_status<T: serde::Serialize>(
        &self,
        view_id: &ViewId,
        status: &T,
    ) -> Result<(), NatsError> {
        let subject = self.config.status_subject(view_id.as_str());
        let payload = serde_json::to_vec(status)?;

        let ack = self.jetstream.publish(subject, payload.into()).await?;
        ack.await.map_err(|e| NatsError::Publish(e.to_string()))?;

        Ok(())
    }

    /// Returns the NATS configuration.
    pub fn config(&self) -> &NatsConfig {
        &self.config
    }

    /// Returns a reference to the JetStream context.
    pub fn jetstream(&self) -> &JetStreamContext {
        &self.jetstream
    }
}

/// Wraps NatsPublisher in an Arc for shared ownership.
pub type SharedNatsPublisher = Arc<NatsPublisher>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_publisher_config() {
        let config = NatsConfig::default();
        assert_eq!(
            config.artifacts_subject("view-1"),
            "tmnl.ava.artifacts.view-1"
        );
    }
}
