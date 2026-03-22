//! NATS Error Types

use thiserror::Error;

/// Errors that can occur during NATS operations.
#[derive(Debug, Error)]
pub enum NatsError {
    /// Failed to connect to NATS server.
    #[error("NATS connection failed: {0}")]
    Connection(#[from] async_nats::ConnectError),

    /// JetStream operation failed.
    #[error("JetStream error: {0}")]
    JetStream(String),

    /// Failed to create or access stream.
    #[error("Stream error: {0}")]
    Stream(String),

    /// Failed to create consumer.
    #[error("Consumer error: {0}")]
    Consumer(String),

    /// Failed to publish message.
    #[error("Publish error: {0}")]
    Publish(String),

    /// Failed to serialize/deserialize message.
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Broadcast channel closed.
    #[error("Broadcast channel closed")]
    BroadcastClosed,

    /// Subscriber lagged and missed messages.
    #[error("Subscriber lagged {0} messages")]
    Lagged(u64),

    /// Invalid subject format.
    #[error("Invalid subject: {0}")]
    InvalidSubject(String),

    /// Subscription error.
    #[error("Subscription error: {0}")]
    Subscription(#[from] async_nats::SubscribeError),
}

// Manual From implementations for async_nats errors that don't implement std::error::Error cleanly
impl From<async_nats::jetstream::stream::DirectGetError> for NatsError {
    fn from(e: async_nats::jetstream::stream::DirectGetError) -> Self {
        NatsError::Stream(e.to_string())
    }
}

impl From<async_nats::jetstream::context::CreateStreamError> for NatsError {
    fn from(e: async_nats::jetstream::context::CreateStreamError) -> Self {
        NatsError::Stream(e.to_string())
    }
}

impl From<async_nats::jetstream::context::PublishError> for NatsError {
    fn from(e: async_nats::jetstream::context::PublishError) -> Self {
        NatsError::Publish(e.to_string())
    }
}
