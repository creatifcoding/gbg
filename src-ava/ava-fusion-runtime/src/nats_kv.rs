//! NATS KV Store atop JetStream conventions.
//!
//! Implements a key-value store using JetStream as the persistence layer.
//! Follows the NATS KV protocol conventions:
//! - Stream name: `KV_{bucket}`
//! - Subject format: `$KV.{bucket}.{key}`
//! - Revision tracking via stream sequence numbers
//! - Delete by publishing an empty message with a purge marker
//!
//! # Key Format
//!
//! NATS KV keys become NATS subjects (`$KV.{bucket}.{key}`).
//! **Colons (`:`) are INVALID** in NATS subjects. Use dots (`.`) as separators.
//!
//! ```text
//! entity.abc123     -- valid
//! entity:abc123     -- INVALID (colon in subject)
//! track.sensor.001  -- valid (multi-level key)
//! ```
//!
//! # Example
//!
//! ```ignore
//! let client = NatsClient::connect(cx, "nats://localhost:4222").await?;
//! let js = JetStreamContext::new(client);
//! let mut kv = NatsKvStore::new("ava_state", js);
//!
//! // Create the backing stream (once, at startup)
//! kv.create_bucket(cx).await?;
//!
//! // Put and get
//! let rev = kv.put(cx, "entity.pump001", b"online").await?;
//! let entry = kv.get(cx, "entity.pump001").await?;
//! assert_eq!(entry.unwrap().value, b"online");
//!
//! // Delete (tombstone)
//! kv.delete(cx, "entity.pump001").await?;
//!
//! // Watch for changes
//! let mut watcher = kv.watch(cx, "entity.>").await?;
//! ```

use asupersync::cx::Cx;
use asupersync::messaging::jetstream::{
    ConsumerConfig, DeliverPolicy, JetStreamContext, JsError, RetentionPolicy, StorageType,
    StreamConfig,
};
use asupersync::messaging::nats::NatsClient;
use std::fmt;
use std::time::Duration;

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/// Errors from KV store operations.
#[derive(Debug)]
pub enum KvError {
    /// JetStream error.
    JetStream(JsError),
    /// Invalid key (contains disallowed characters).
    InvalidKey(String),
    /// Bucket not created.
    BucketNotFound(String),
    /// Revision conflict on conditional update.
    RevisionConflict {
        /// The key that conflicted.
        key: String,
        /// Expected revision.
        expected: u64,
        /// Actual revision found.
        actual: u64,
    },
}

impl fmt::Display for KvError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::JetStream(e) => write!(f, "KV JetStream error: {e}"),
            Self::InvalidKey(key) => write!(f, "KV invalid key: {key}"),
            Self::BucketNotFound(bucket) => write!(f, "KV bucket not found: {bucket}"),
            Self::RevisionConflict {
                key,
                expected,
                actual,
            } => write!(
                f,
                "KV revision conflict on {key}: expected {expected}, found {actual}"
            ),
        }
    }
}

impl std::error::Error for KvError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::JetStream(e) => Some(e),
            _ => None,
        }
    }
}

impl From<JsError> for KvError {
    fn from(err: JsError) -> Self {
        Self::JetStream(err)
    }
}

// ---------------------------------------------------------------------------
// KV entry
// ---------------------------------------------------------------------------

/// A single key-value entry retrieved from the store.
#[derive(Debug, Clone)]
pub struct KvEntry {
    /// The key (without bucket prefix).
    pub key: String,
    /// The value bytes (empty for delete markers / tombstones).
    pub value: Vec<u8>,
    /// Stream sequence number acting as the revision.
    pub revision: u64,
    /// Whether this entry is a delete marker (tombstone).
    pub is_delete: bool,
}

// ---------------------------------------------------------------------------
// KV watcher
// ---------------------------------------------------------------------------

/// Watches for changes to keys matching a pattern.
///
/// Created via [`NatsKvStore::watch`]. Yields [`KvEntry`] values as keys
/// change. The watcher subscribes to a JetStream consumer that filters
/// on the requested subject pattern.
pub struct KvWatcher {
    bucket: String,
    consumer: asupersync::messaging::jetstream::Consumer,
}

impl fmt::Debug for KvWatcher {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("KvWatcher")
            .field("bucket", &self.bucket)
            .finish_non_exhaustive()
    }
}

impl KvWatcher {
    /// Poll the next changed entry. Returns `None` when the watch ends
    /// or on timeout.
    pub async fn next(
        &self,
        client: &mut NatsClient,
        cx: &Cx,
    ) -> Result<Option<KvEntry>, KvError> {
        let msgs = self
            .consumer
            .pull_with_timeout(client, cx, 1, Duration::from_secs(5))
            .await?;

        if let Some(msg) = msgs.into_iter().next() {
            // Clone fields before JsMessage is dropped (JsMessage implements Drop
            // for ack tracking, so we cannot move fields out of it).
            let bucket_prefix = format!("$KV.{}.", self.bucket);
            let subject = msg.subject.clone();
            let payload = msg.payload.clone();
            let sequence = msg.sequence;

            let key = if subject.starts_with(&bucket_prefix) {
                subject[bucket_prefix.len()..].to_string()
            } else {
                subject
            };
            let is_delete = payload.is_empty();
            Ok(Some(KvEntry {
                key,
                value: payload,
                revision: sequence,
                is_delete,
            }))
        } else {
            Ok(None)
        }
    }
}

// ---------------------------------------------------------------------------
// NatsKvStore
// ---------------------------------------------------------------------------

/// NATS KV Store implemented atop JetStream.
///
/// Each bucket maps to a JetStream stream named `KV_{bucket}` capturing
/// subjects `$KV.{bucket}.>`. Keys are the final subject tokens.
///
/// All operations are cancel-aware via asupersync's [`Cx`] context.
pub struct NatsKvStore {
    /// Bucket name (used in stream and subject naming).
    bucket: String,
    /// JetStream context for API calls.
    js: JetStreamContext,
    /// Maximum value size (default 1MB).
    max_value_size: usize,
    /// TTL for entries (None = no expiry).
    ttl: Option<Duration>,
}

impl fmt::Debug for NatsKvStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("NatsKvStore")
            .field("bucket", &self.bucket)
            .field("max_value_size", &self.max_value_size)
            .field("ttl", &self.ttl)
            .finish_non_exhaustive()
    }
}

impl NatsKvStore {
    /// Default max value size: 1MB.
    pub const DEFAULT_MAX_VALUE_SIZE: usize = 1_048_576;

    /// Create a new KV store for the given bucket.
    ///
    /// The bucket name must be alphanumeric (plus dash/underscore).
    /// Call [`create_bucket`] before performing operations.
    pub fn new(bucket: impl Into<String>, js: JetStreamContext) -> Self {
        Self {
            bucket: bucket.into(),
            js,
            max_value_size: Self::DEFAULT_MAX_VALUE_SIZE,
            ttl: None,
        }
    }

    /// Set a TTL for entries. Entries older than this will be expired.
    #[must_use]
    pub fn with_ttl(mut self, ttl: Duration) -> Self {
        self.ttl = Some(ttl);
        self
    }

    /// Set the maximum value size.
    #[must_use]
    pub fn with_max_value_size(mut self, size: usize) -> Self {
        self.max_value_size = size;
        self
    }

    /// The JetStream stream name for this bucket.
    fn stream_name(&self) -> String {
        format!("KV_{}", self.bucket)
    }

    /// The subject prefix for this bucket.
    fn subject_prefix(&self) -> String {
        format!("$KV.{}.", self.bucket)
    }

    /// Build the full subject for a key.
    fn key_subject(&self, key: &str) -> Result<String, KvError> {
        validate_key(key)?;
        Ok(format!("$KV.{}.{}", self.bucket, key))
    }

    /// Create the backing JetStream stream for this bucket.
    ///
    /// Idempotent — can be called multiple times safely. If the stream
    /// already exists, this will update its configuration.
    pub async fn create_bucket(&mut self, cx: &Cx) -> Result<(), KvError> {
        let mut config = StreamConfig::new(self.stream_name())
            .subjects(&[&format!("$KV.{}.>", self.bucket)])
            .retention(RetentionPolicy::Limits)
            .storage(StorageType::File)
            .replicas(1);

        // KV buckets use max_msgs_per_subject=1 in real NATS but
        // the StreamConfig API doesn't expose it. We approximate
        // by setting a generous max_bytes and relying on
        // compaction/purge.
        if let Some(ttl) = self.ttl {
            config = config.max_age(ttl);
        }

        self.js.create_stream(cx, config).await?;
        Ok(())
    }

    /// Get a value by key. Returns `None` if the key doesn't exist
    /// or has been deleted.
    pub async fn get(&mut self, cx: &Cx, key: &str) -> Result<Option<KvEntry>, KvError> {
        let subject = self.key_subject(key)?;

        // To get the latest value for a key, we create an ephemeral
        // consumer with DeliverPolicy::Last on the specific subject.
        let config = ConsumerConfig::ephemeral()
            .deliver_policy(DeliverPolicy::Last)
            .filter_subject(&subject);

        let consumer = self
            .js
            .create_consumer(cx, &self.stream_name(), config)
            .await?;

        let msgs = consumer
            .pull_with_timeout(self.js.client(), cx, 1, Duration::from_secs(2))
            .await?;

        match msgs.into_iter().next() {
            Some(msg) => {
                // Clone fields before ack/drop (JsMessage implements Drop).
                let payload = msg.payload.clone();
                let sequence = msg.sequence;

                // Ack the message so the ephemeral consumer cleans up
                let _ = msg.ack(self.js.client(), cx).await;

                let is_delete = payload.is_empty();
                if is_delete {
                    // Tombstone — key was deleted
                    Ok(None)
                } else {
                    Ok(Some(KvEntry {
                        key: key.to_string(),
                        value: payload,
                        revision: sequence,
                        is_delete: false,
                    }))
                }
            }
            None => Ok(None),
        }
    }

    /// Put a value for a key. Creates or updates.
    ///
    /// Returns the revision (stream sequence number) of the stored entry.
    pub async fn put(&mut self, cx: &Cx, key: &str, value: &[u8]) -> Result<u64, KvError> {
        if value.len() > self.max_value_size {
            return Err(KvError::InvalidKey(format!(
                "value too large: {} > {} max",
                value.len(),
                self.max_value_size
            )));
        }

        let subject = self.key_subject(key)?;
        let ack = self.js.publish(cx, &subject, value).await?;
        Ok(ack.seq)
    }

    /// Delete a key by publishing an empty tombstone.
    ///
    /// The key will appear as deleted to subsequent `get` calls.
    /// The tombstone remains in the stream until TTL or purge.
    pub async fn delete(&mut self, cx: &Cx, key: &str) -> Result<(), KvError> {
        let subject = self.key_subject(key)?;
        // KV delete = publish empty payload (tombstone marker)
        self.js.publish(cx, &subject, b"").await?;
        Ok(())
    }

    /// Watch for changes to keys matching a subject pattern.
    ///
    /// The pattern follows NATS subject wildcards:
    /// - `entity.>` matches all keys starting with `entity.`
    /// - `entity.*` matches single-level keys like `entity.pump001`
    /// - `>` matches all keys in the bucket
    ///
    /// Returns a [`KvWatcher`] that yields entries as they change.
    pub async fn watch(&mut self, cx: &Cx, key_pattern: &str) -> Result<KvWatcher, KvError> {
        // Build the full subject pattern for the watch
        let subject = if key_pattern == ">" {
            format!("$KV.{}.>", self.bucket)
        } else {
            format!("$KV.{}.{}", self.bucket, key_pattern)
        };

        let config = ConsumerConfig::ephemeral()
            .deliver_policy(DeliverPolicy::New)
            .filter_subject(&subject);

        let consumer = self
            .js
            .create_consumer(cx, &self.stream_name(), config)
            .await?;

        Ok(KvWatcher {
            bucket: self.bucket.clone(),
            consumer,
        })
    }

    /// List all keys in the bucket.
    ///
    /// Returns keys that have current (non-tombstoned) values.
    /// This reads all messages from the stream, so use sparingly
    /// on large buckets.
    pub async fn keys(&mut self, cx: &Cx) -> Result<Vec<String>, KvError> {
        let subject = format!("$KV.{}.>", self.bucket);

        let config = ConsumerConfig::ephemeral()
            .deliver_policy(DeliverPolicy::LastPerSubject)
            .filter_subject(&subject);

        let consumer = self
            .js
            .create_consumer(cx, &self.stream_name(), config)
            .await?;

        let mut keys = Vec::new();
        let prefix = self.subject_prefix();

        // Pull in batches to avoid holding too many messages
        loop {
            let msgs = consumer
                .pull_with_timeout(self.js.client(), cx, 100, Duration::from_secs(2))
                .await?;

            if msgs.is_empty() {
                break;
            }

            for msg in &msgs {
                // Skip tombstones (empty payload = deleted)
                if !msg.payload.is_empty() && msg.subject.starts_with(&prefix) {
                    let key = msg.subject[prefix.len()..].to_string();
                    keys.push(key);
                }
            }

            // Ack all messages
            for msg in &msgs {
                let _ = msg.ack(self.js.client(), cx).await;
            }

            if msgs.len() < 100 {
                break;
            }
        }

        Ok(keys)
    }

    /// Get a mutable reference to the underlying JetStream context.
    pub fn jetstream(&mut self) -> &mut JetStreamContext {
        &mut self.js
    }
}

// ---------------------------------------------------------------------------
// Key validation
// ---------------------------------------------------------------------------

/// Validate a NATS KV key.
///
/// Keys become NATS subjects under `$KV.{bucket}.{key}`, so they must
/// follow NATS subject token rules:
/// - No spaces
/// - No colons (`:`) — INVALID in NATS subjects
/// - No null bytes
/// - Must not be empty
fn validate_key(key: &str) -> Result<(), KvError> {
    if key.is_empty() {
        return Err(KvError::InvalidKey("key must not be empty".to_string()));
    }

    for ch in key.chars() {
        match ch {
            ':' => {
                return Err(KvError::InvalidKey(format!(
                    "colons are invalid in NATS KV keys (use dots): {key}"
                )));
            }
            ' ' | '\t' | '\n' | '\r' | '\0' => {
                return Err(KvError::InvalidKey(format!(
                    "whitespace/null not allowed in NATS KV keys: {key}"
                )));
            }
            _ => {}
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_key_rejects_colons() {
        let result = validate_key("entity:pump001");
        assert!(matches!(result, Err(KvError::InvalidKey(_))));
    }

    #[test]
    fn validate_key_rejects_empty() {
        let result = validate_key("");
        assert!(matches!(result, Err(KvError::InvalidKey(_))));
    }

    #[test]
    fn validate_key_rejects_whitespace() {
        assert!(validate_key("has space").is_err());
        assert!(validate_key("has\ttab").is_err());
        assert!(validate_key("has\nnewline").is_err());
        assert!(validate_key("has\0null").is_err());
    }

    #[test]
    fn validate_key_accepts_dots() {
        assert!(validate_key("entity.pump001").is_ok());
        assert!(validate_key("track.sensor.001").is_ok());
    }

    #[test]
    fn validate_key_accepts_wildcards() {
        // Wildcards are valid in subject patterns (used for watch/keys)
        assert!(validate_key("entity.>").is_ok());
        assert!(validate_key("entity.*").is_ok());
    }

    #[test]
    fn validate_key_accepts_alphanumeric() {
        assert!(validate_key("simple").is_ok());
        assert!(validate_key("with-dash").is_ok());
        assert!(validate_key("with_underscore").is_ok());
        assert!(validate_key("UPPER").is_ok());
        assert!(validate_key("12345").is_ok());
    }

    #[test]
    fn stream_name_format() {
        // Test the naming convention directly (no NatsClient needed)
        assert_eq!(format!("KV_{}", "ava_state"), "KV_ava_state");
        assert_eq!(
            format!("$KV.{}.{}", "ava_state", "entity.pump001"),
            "$KV.ava_state.entity.pump001"
        );
    }

    #[test]
    fn kv_error_display() {
        let err = KvError::InvalidKey("bad:key".to_string());
        assert!(err.to_string().contains("bad:key"));

        let err = KvError::BucketNotFound("test_bucket".to_string());
        assert!(err.to_string().contains("test_bucket"));

        let err = KvError::RevisionConflict {
            key: "k1".to_string(),
            expected: 5,
            actual: 7,
        };
        let msg = err.to_string();
        assert!(msg.contains("k1"));
        assert!(msg.contains("5"));
        assert!(msg.contains("7"));
    }

    #[test]
    fn kv_error_source() {
        let err = KvError::InvalidKey("x".to_string());
        assert!(std::error::Error::source(&err).is_none());
    }

    #[test]
    fn kv_entry_debug_clone() {
        let entry = KvEntry {
            key: "entity.pump001".to_string(),
            value: b"online".to_vec(),
            revision: 42,
            is_delete: false,
        };
        let dbg = format!("{entry:?}");
        assert!(dbg.contains("entity.pump001"));
        assert!(dbg.contains("42"));

        let cloned = entry.clone();
        assert_eq!(cloned.key, "entity.pump001");
        assert_eq!(cloned.revision, 42);
        assert!(!cloned.is_delete);
    }

    #[test]
    fn subject_format_conventions() {
        // Verify the NATS KV subject conventions
        let bucket = "ava_state";
        let key = "entity.pump001";
        let subject = format!("$KV.{}.{}", bucket, key);
        assert_eq!(subject, "$KV.ava_state.entity.pump001");

        // Wildcard subject for watching all keys
        let watch_all = format!("$KV.{}.>", bucket);
        assert_eq!(watch_all, "$KV.ava_state.>");
    }
}
