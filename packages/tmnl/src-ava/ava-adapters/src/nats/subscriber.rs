//! NATS JetStream Subscriber
//!
//! Subscribes to NATS JetStream for receiving invalidation requests
//! and other frontend-initiated events.

use std::pin::Pin;
use async_nats::jetstream::{self, consumer, Context as JetStreamContext};
use futures::stream::{Stream, StreamExt};
use tracing::{debug, info, warn};

use ava_domain::views::ViewArtifact;
use ava_domain::ids::ViewId;

use super::config::NatsConfig;
use super::error::NatsError;

/// Request to invalidate a view, triggering recomputation.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvalidationRequest {
    /// View to invalidate
    pub view_id: ViewId,
    /// Reason for invalidation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    /// Whether to force recomputation even if not stale
    #[serde(default)]
    pub force: bool,
}

/// NATS JetStream subscriber for receiving events.
pub struct NatsSubscriber {
    jetstream: JetStreamContext,
    config: NatsConfig,
}

impl NatsSubscriber {
    /// Creates a new subscriber with the given configuration.
    ///
    /// # Errors
    ///
    /// Returns error if connection fails.
    pub async fn new(config: NatsConfig) -> Result<Self, NatsError> {
        info!(
            server = %config.server_url,
            "Connecting subscriber to NATS"
        );

        let client = async_nats::ConnectOptions::new()
            .event_callback(|event| async move {
                debug!("NATS subscriber event: {:?}", event);
            })
            .connect(&config.server_url)
            .await?;

        let jetstream = async_nats::jetstream::new(client);

        Ok(Self { jetstream, config })
    }

    /// Creates a subscriber from an existing JetStream context.
    pub fn from_context(jetstream: JetStreamContext, config: NatsConfig) -> Self {
        Self { jetstream, config }
    }

    /// Subscribes to invalidation requests.
    ///
    /// Returns a stream of `InvalidationRequest` messages.
    /// Messages are automatically acknowledged after successful deserialization.
    pub async fn subscribe_invalidations(
        &self,
    ) -> Result<impl Stream<Item = InvalidationRequest>, NatsError> {
        let stream = self
            .jetstream
            .get_stream(&self.config.stream_name)
            .await
            .map_err(|e| NatsError::Stream(e.to_string()))?;

        let consumer = stream
            .get_or_create_consumer(
                "tmnl-invalidations",
                consumer::pull::Config {
                    durable_name: Some("tmnl-invalidations".into()),
                    filter_subject: format!("{}.invalidate.*", self.config.subject_prefix),
                    ..Default::default()
                },
            )
            .await
            .map_err(|e| NatsError::Consumer(e.to_string()))?;

        let messages = consumer
            .messages()
            .await
            .map_err(|e| NatsError::Consumer(e.to_string()))?;

        Ok(messages.filter_map(|msg| async move {
            match msg {
                Ok(m) => {
                    // Try to deserialize
                    match serde_json::from_slice::<InvalidationRequest>(&m.payload) {
                        Ok(request) => {
                            // Acknowledge successful processing
                            if let Err(e) = m.ack().await {
                                warn!(error = %e, "Failed to ack invalidation message");
                            }
                            Some(request)
                        }
                        Err(e) => {
                            warn!(
                                error = %e,
                                "Failed to deserialize invalidation request"
                            );
                            // Still ack to avoid redelivery of malformed messages
                            let _ = m.ack().await;
                            None
                        }
                    }
                }
                Err(e) => {
                    warn!(error = %e, "Error receiving invalidation message");
                    None
                }
            }
        }))
    }

    /// Subscribes to artifacts for a specific view.
    ///
    /// Useful for testing or for views that want to observe their own artifacts.
    ///
    /// # Arguments
    ///
    /// * `view_id` - The view ID to subscribe to
    /// * `deliver_policy` - Where to start reading (defaults to last)
    pub async fn subscribe_artifacts(
        &self,
        view_id: &str,
        deliver_policy: Option<consumer::DeliverPolicy>,
    ) -> Result<impl Stream<Item = ViewArtifact>, NatsError> {
        let stream = self
            .jetstream
            .get_stream(&self.config.stream_name)
            .await
            .map_err(|e| NatsError::Stream(e.to_string()))?;

        let consumer_name = format!("artifact-subscriber-{}", view_id);
        let filter_subject = self.config.artifacts_subject(view_id);

        let consumer = stream
            .get_or_create_consumer(
                &consumer_name,
                consumer::pull::Config {
                    filter_subject,
                    deliver_policy: deliver_policy.unwrap_or(consumer::DeliverPolicy::Last),
                    ..Default::default()
                },
            )
            .await
            .map_err(|e| NatsError::Consumer(e.to_string()))?;

        let messages = consumer
            .messages()
            .await
            .map_err(|e| NatsError::Consumer(e.to_string()))?;

        Ok(messages.filter_map(|msg| async move {
            match msg {
                Ok(m) => {
                    match serde_json::from_slice::<ViewArtifact>(&m.payload) {
                        Ok(artifact) => {
                            let _ = m.ack().await;
                            Some(artifact)
                        }
                        Err(e) => {
                            warn!(error = %e, "Failed to deserialize artifact");
                            let _ = m.ack().await;
                            None
                        }
                    }
                }
                Err(e) => {
                    warn!(error = %e, "Error receiving artifact message");
                    None
                }
            }
        }))
    }

    /// Subscribes to artifacts starting from a specific sequence number.
    ///
    /// This is useful for replay/catch-up scenarios.
    pub async fn subscribe_artifacts_from_sequence(
        &self,
        view_id: &str,
        start_sequence: u64,
    ) -> Result<impl Stream<Item = ViewArtifact>, NatsError> {
        self.subscribe_artifacts(
            view_id,
            Some(consumer::DeliverPolicy::ByStartSequence {
                start_sequence,
            }),
        )
        .await
    }

    /// Returns the configuration.
    pub fn config(&self) -> &NatsConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_invalidation_request_serialization() {
        let request = InvalidationRequest {
            view_id: ViewId::new("test-view"),
            reason: Some("stale data".into()),
            force: true,
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("test-view"));
        assert!(json.contains("stale data"));

        let parsed: InvalidationRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.view_id.as_str(), "test-view");
        assert!(parsed.force);
    }
}
