//! NATS → Durable Streams Bridge
//!
//! Subscribes to NATS JetStream subjects and forwards messages to Durable Streams
//! for persistent, offset-based replay.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;

use super::client::{DurableStreamsClient, ContentType};
use super::error::DurableStreamsError;

/// Maps a NATS subject pattern to a Durable Streams path
#[derive(Debug, Clone)]
pub struct SubjectMapping {
    /// NATS subject pattern (e.g., "tmnl.ava.artifacts.*")
    pub nats_subject: String,
    /// Durable Streams path (e.g., "tmnl/artifacts")
    pub stream_path: String,
    /// Content type for the stream
    pub content_type: ContentType,
}

impl SubjectMapping {
    /// Create a new mapping
    pub fn new(
        nats_subject: impl Into<String>,
        stream_path: impl Into<String>,
    ) -> Self {
        Self {
            nats_subject: nats_subject.into(),
            stream_path: stream_path.into(),
            content_type: ContentType::Json,
        }
    }

    /// Set content type
    pub fn content_type(mut self, content_type: ContentType) -> Self {
        self.content_type = content_type;
        self
    }
}

/// Bridge metrics
#[derive(Debug, Clone, Default)]
pub struct BridgeMetrics {
    /// Total messages forwarded
    pub messages_forwarded: u64,
    /// Total bytes forwarded
    pub bytes_forwarded: u64,
    /// Failed forwards
    pub forward_errors: u64,
    /// Active subscriptions
    pub active_subscriptions: usize,
}

/// State for a single subscription
struct SubscriptionState {
    mapping: SubjectMapping,
    handle: Option<JoinHandle<()>>,
    messages_forwarded: u64,
    bytes_forwarded: u64,
    errors: u64,
}

/// NATS → Durable Streams Bridge
///
/// Subscribes to NATS JetStream subjects and forwards messages to Durable Streams.
pub struct DurableStreamsBridge {
    /// Durable Streams client
    client: Arc<DurableStreamsClient>,

    /// Subject mappings
    mappings: Vec<SubjectMapping>,

    /// Active subscriptions
    subscriptions: Arc<RwLock<HashMap<String, SubscriptionState>>>,

    /// Whether bridge is running
    running: Arc<RwLock<bool>>,
}

impl DurableStreamsBridge {
    /// Create a new bridge
    pub fn new(client: Arc<DurableStreamsClient>) -> Self {
        Self {
            client,
            mappings: Vec::new(),
            subscriptions: Arc::new(RwLock::new(HashMap::new())),
            running: Arc::new(RwLock::new(false)),
        }
    }

    /// Add a subject mapping
    pub fn map_subject(mut self, mapping: SubjectMapping) -> Self {
        self.mappings.push(mapping);
        self
    }

    /// Add a simple mapping (JSON content type)
    pub fn map(
        mut self,
        nats_subject: impl Into<String>,
        stream_path: impl Into<String>,
    ) -> Self {
        self.mappings.push(SubjectMapping::new(nats_subject, stream_path));
        self
    }

    /// Ensure all mapped streams exist
    pub async fn ensure_streams(&self) -> Result<(), DurableStreamsError> {
        for mapping in &self.mappings {
            self.client
                .create_stream(&mapping.stream_path, mapping.content_type)
                .await?;
        }
        Ok(())
    }

    /// Forward a single message to the appropriate stream
    ///
    /// Used when integrating with existing NATS subscription logic.
    pub async fn forward_message(
        &self,
        nats_subject: &str,
        data: &[u8],
    ) -> Result<String, DurableStreamsError> {
        // Find matching mapping
        let mapping = self
            .mappings
            .iter()
            .find(|m| subject_matches(&m.nats_subject, nats_subject))
            .ok_or_else(|| {
                DurableStreamsError::Bridge(format!(
                    "No mapping found for subject: {}",
                    nats_subject
                ))
            })?;

        // Forward to durable streams
        let offset = self.client.append(&mapping.stream_path, data).await?;

        // Update metrics
        {
            let mut subs = self.subscriptions.write().await;
            if let Some(state) = subs.get_mut(&mapping.nats_subject) {
                state.messages_forwarded += 1;
                state.bytes_forwarded += data.len() as u64;
            }
        }

        Ok(offset)
    }

    /// Get current metrics
    pub async fn metrics(&self) -> BridgeMetrics {
        let subs = self.subscriptions.read().await;
        let mut metrics = BridgeMetrics {
            active_subscriptions: subs.len(),
            ..Default::default()
        };

        for state in subs.values() {
            metrics.messages_forwarded += state.messages_forwarded;
            metrics.bytes_forwarded += state.bytes_forwarded;
            metrics.forward_errors += state.errors;
        }

        metrics
    }

    /// Check if bridge is running
    pub async fn is_running(&self) -> bool {
        *self.running.read().await
    }

    /// Stop the bridge
    pub async fn stop(&self) {
        *self.running.write().await = false;

        let mut subs = self.subscriptions.write().await;
        for (_, state) in subs.iter_mut() {
            if let Some(handle) = state.handle.take() {
                handle.abort();
            }
        }
        subs.clear();
    }

    /// Get the Durable Streams client
    pub fn client(&self) -> &Arc<DurableStreamsClient> {
        &self.client
    }
}

/// Check if a NATS subject matches a pattern
///
/// Supports:
/// - `*` matches a single token
/// - `>` matches one or more tokens (at end only)
fn subject_matches(pattern: &str, subject: &str) -> bool {
    let pattern_parts: Vec<&str> = pattern.split('.').collect();
    let subject_parts: Vec<&str> = subject.split('.').collect();

    let mut pi = 0;
    let mut si = 0;

    while pi < pattern_parts.len() && si < subject_parts.len() {
        match pattern_parts[pi] {
            ">" => return true, // Matches rest
            "*" => {
                pi += 1;
                si += 1;
            }
            p if p == subject_parts[si] => {
                pi += 1;
                si += 1;
            }
            _ => return false,
        }
    }

    pi == pattern_parts.len() && si == subject_parts.len()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subject_matches_exact() {
        assert!(subject_matches("tmnl.ava.artifacts", "tmnl.ava.artifacts"));
        assert!(!subject_matches("tmnl.ava.artifacts", "tmnl.ava.deltas"));
    }

    #[test]
    fn test_subject_matches_wildcard() {
        assert!(subject_matches("tmnl.ava.*", "tmnl.ava.artifacts"));
        assert!(subject_matches("tmnl.ava.*", "tmnl.ava.deltas"));
        assert!(!subject_matches("tmnl.ava.*", "tmnl.ava.foo.bar"));
    }

    #[test]
    fn test_subject_matches_multi_wildcard() {
        assert!(subject_matches("tmnl.ava.>", "tmnl.ava.artifacts"));
        assert!(subject_matches("tmnl.ava.>", "tmnl.ava.foo.bar.baz"));
        assert!(!subject_matches("tmnl.ava.>", "tmnl.other"));
    }

    #[test]
    fn test_subject_mapping() {
        let mapping = SubjectMapping::new("tmnl.ava.artifacts.*", "tmnl/artifacts")
            .content_type(ContentType::Json);

        assert_eq!(mapping.nats_subject, "tmnl.ava.artifacts.*");
        assert_eq!(mapping.stream_path, "tmnl/artifacts");
        assert_eq!(mapping.content_type, ContentType::Json);
    }
}
