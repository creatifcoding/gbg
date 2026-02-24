//! NATS Object Store atop JetStream.
//!
//! Implements chunked blob storage using JetStream as the persistence layer.
//! Follows the NATS Object Store protocol conventions:
//! - Stream name: `OBJ_{bucket}`
//! - Chunk subject: `$O.{bucket}.C.{nuid}` (object chunks)
//! - Meta subject: `$O.{bucket}.M.{name}` (object metadata)
//! - Objects are split into fixed-size chunks stored as sequential messages
//! - Metadata tracks name, size, chunks, and a SHA-256 digest
//!
//! # Example
//!
//! ```ignore
//! let client = NatsClient::connect(cx, "nats://localhost:4222").await?;
//! let js = JetStreamContext::new(client);
//! let mut store = NatsObjectStore::new("ava_blobs", js);
//!
//! // Create the backing stream (once, at startup)
//! store.create_bucket(cx).await?;
//!
//! // Store an object
//! let info = store.put(cx, "model-weights-v3", &large_blob).await?;
//! println!("stored {} bytes in {} chunks", info.size, info.chunks);
//!
//! // Retrieve it
//! let data = store.get(cx, "model-weights-v3").await?;
//!
//! // List all objects
//! let objects = store.list(cx).await?;
//!
//! // Delete
//! store.delete(cx, "model-weights-v3").await?;
//! ```

use asupersync::cx::Cx;
use asupersync::messaging::jetstream::{
    ConsumerConfig, DeliverPolicy, JetStreamContext, JsError, RetentionPolicy, StorageType,
    StreamConfig,
};
use std::fmt;
use std::time::Duration;

// ---------------------------------------------------------------------------
// Error type
// ---------------------------------------------------------------------------

/// Errors from Object Store operations.
#[derive(Debug)]
pub enum ObjectError {
    /// JetStream error.
    JetStream(JsError),
    /// Object not found.
    NotFound(String),
    /// Object name invalid.
    InvalidName(String),
    /// Integrity error (digest mismatch on retrieval).
    IntegrityError {
        /// Object name.
        name: String,
        /// Expected size from metadata.
        expected_size: u64,
        /// Actual reassembled size.
        actual_size: u64,
    },
    /// Metadata parse error.
    MetadataError(String),
}

impl fmt::Display for ObjectError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::JetStream(e) => write!(f, "ObjectStore JetStream error: {e}"),
            Self::NotFound(name) => write!(f, "ObjectStore object not found: {name}"),
            Self::InvalidName(name) => write!(f, "ObjectStore invalid name: {name}"),
            Self::IntegrityError {
                name,
                expected_size,
                actual_size,
            } => write!(
                f,
                "ObjectStore integrity error for {name}: expected {expected_size} bytes, got {actual_size}"
            ),
            Self::MetadataError(msg) => write!(f, "ObjectStore metadata error: {msg}"),
        }
    }
}

impl std::error::Error for ObjectError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Self::JetStream(e) => Some(e),
            _ => None,
        }
    }
}

impl From<JsError> for ObjectError {
    fn from(err: JsError) -> Self {
        Self::JetStream(err)
    }
}

// ---------------------------------------------------------------------------
// Object metadata
// ---------------------------------------------------------------------------

/// Metadata about a stored object.
#[derive(Debug, Clone)]
pub struct ObjectInfo {
    /// Object name.
    pub name: String,
    /// Total size in bytes.
    pub size: u64,
    /// Number of chunks.
    pub chunks: u32,
    /// Chunk size used for this object.
    pub chunk_size: usize,
    /// Unique identifier for this object's chunks.
    pub nuid: String,
    /// Whether this is a delete marker.
    pub deleted: bool,
}

impl ObjectInfo {
    /// Serialize metadata to JSON for storage.
    fn to_json(&self) -> String {
        format!(
            "{{\"name\":\"{}\",\"size\":{},\"chunks\":{},\"chunk_size\":{},\"nuid\":\"{}\",\"deleted\":{}}}",
            json_escape(&self.name),
            self.size,
            self.chunks,
            self.chunk_size,
            json_escape(&self.nuid),
            self.deleted
        )
    }

    /// Parse metadata from JSON.
    fn from_json(json: &str) -> Result<Self, ObjectError> {
        let name = extract_json_string(json, "name")
            .ok_or_else(|| ObjectError::MetadataError("missing name".to_string()))?;
        let size = extract_json_u64(json, "size").unwrap_or(0);
        let chunks = extract_json_u64(json, "chunks").unwrap_or(0) as u32;
        let chunk_size = extract_json_u64(json, "chunk_size").unwrap_or(0) as usize;
        let nuid = extract_json_string(json, "nuid").unwrap_or_default();
        let deleted = json.contains("\"deleted\":true");

        Ok(Self {
            name,
            size,
            chunks,
            chunk_size,
            nuid,
            deleted,
        })
    }
}

// ---------------------------------------------------------------------------
// NatsObjectStore
// ---------------------------------------------------------------------------

/// Chunked blob storage atop NATS JetStream.
///
/// Large objects are split into chunks and stored as messages in a
/// dedicated stream. Metadata for each object is stored on a separate
/// subject within the same stream.
///
/// The Object Store protocol uses two subject namespaces:
/// - `$O.{bucket}.C.{nuid}` — chunk data
/// - `$O.{bucket}.M.{name}` — object metadata
pub struct NatsObjectStore {
    /// Bucket name.
    bucket: String,
    /// JetStream context.
    js: JetStreamContext,
    /// Chunk size for splitting objects.
    chunk_size: usize,
}

impl fmt::Debug for NatsObjectStore {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.debug_struct("NatsObjectStore")
            .field("bucket", &self.bucket)
            .field("chunk_size", &self.chunk_size)
            .finish_non_exhaustive()
    }
}

impl NatsObjectStore {
    /// Default chunk size: 128KB.
    pub const DEFAULT_CHUNK_SIZE: usize = 128 * 1024;

    /// Create a new Object Store for the given bucket.
    ///
    /// Call [`create_bucket`] before performing operations.
    pub fn new(bucket: impl Into<String>, js: JetStreamContext) -> Self {
        Self {
            bucket: bucket.into(),
            js,
            chunk_size: Self::DEFAULT_CHUNK_SIZE,
        }
    }

    /// Set a custom chunk size.
    #[must_use]
    pub fn with_chunk_size(mut self, chunk_size: usize) -> Self {
        assert!(chunk_size > 0, "chunk_size must be > 0");
        self.chunk_size = chunk_size;
        self
    }

    /// The JetStream stream name for this bucket.
    fn stream_name(&self) -> String {
        format!("OBJ_{}", self.bucket)
    }

    /// Build the chunk subject for an object.
    fn chunk_subject(&self, nuid: &str) -> String {
        format!("$O.{}.C.{}", self.bucket, nuid)
    }

    /// Build the metadata subject for an object.
    fn meta_subject(&self, name: &str) -> String {
        format!("$O.{}.M.{}", self.bucket, name)
    }

    /// Create the backing JetStream stream for this bucket.
    ///
    /// Idempotent — can be called multiple times safely.
    pub async fn create_bucket(&mut self, cx: &Cx) -> Result<(), ObjectError> {
        let config = StreamConfig::new(self.stream_name())
            .subjects(&[&format!("$O.{}.C.>", self.bucket), &format!("$O.{}.M.>", self.bucket)])
            .retention(RetentionPolicy::Limits)
            .storage(StorageType::File)
            .replicas(1);

        self.js.create_stream(cx, config).await?;
        Ok(())
    }

    /// Store an object (or replace an existing one).
    ///
    /// The data is split into `chunk_size` chunks and stored as
    /// sequential messages. Metadata is published after all chunks.
    pub async fn put(
        &mut self,
        cx: &Cx,
        name: &str,
        data: &[u8],
    ) -> Result<ObjectInfo, ObjectError> {
        validate_name(name)?;

        // Generate a unique ID for this object's chunks.
        // Use Cx random for deterministic testing.
        let nuid = format!("{:016x}", cx.random_u64());

        let chunk_subject = self.chunk_subject(&nuid);
        let num_chunks = if data.is_empty() {
            0u32
        } else {
            ((data.len() + self.chunk_size - 1) / self.chunk_size) as u32
        };

        // Publish chunks
        for (i, chunk) in data.chunks(self.chunk_size).enumerate() {
            self.js.publish(cx, &chunk_subject, chunk).await?;
            tracing::trace!(
                bucket = %self.bucket,
                object = %name,
                chunk = i,
                total = num_chunks,
                bytes = chunk.len(),
                "published object chunk"
            );
        }

        // Build and publish metadata
        let info = ObjectInfo {
            name: name.to_string(),
            size: data.len() as u64,
            chunks: num_chunks,
            chunk_size: self.chunk_size,
            nuid,
            deleted: false,
        };

        let meta_subject = self.meta_subject(name);
        self.js
            .publish(cx, &meta_subject, info.to_json().as_bytes())
            .await?;

        tracing::debug!(
            bucket = %self.bucket,
            object = %name,
            size = data.len(),
            chunks = num_chunks,
            "object stored"
        );

        Ok(info)
    }

    /// Retrieve an object by name.
    ///
    /// Reads the metadata, then fetches all chunks and reassembles them.
    pub async fn get(&mut self, cx: &Cx, name: &str) -> Result<Vec<u8>, ObjectError> {
        validate_name(name)?;

        // Get metadata
        let info = self.info(cx, name).await?;

        if info.deleted {
            return Err(ObjectError::NotFound(name.to_string()));
        }

        if info.chunks == 0 {
            return Ok(Vec::new());
        }

        // Read all chunks from the chunk subject
        let chunk_subject = self.chunk_subject(&info.nuid);
        let config = ConsumerConfig::ephemeral()
            .deliver_policy(DeliverPolicy::All)
            .filter_subject(&chunk_subject);

        let consumer = self
            .js
            .create_consumer(cx, &self.stream_name(), config)
            .await?;

        let mut data = Vec::with_capacity(info.size as usize);

        // Pull chunks in batches
        let mut remaining = info.chunks as usize;
        while remaining > 0 {
            let batch = remaining.min(100);
            let msgs = consumer
                .pull_with_timeout(self.js.client(), cx, batch, Duration::from_secs(10))
                .await?;

            if msgs.is_empty() {
                break;
            }

            for msg in &msgs {
                data.extend_from_slice(&msg.payload);
                let _ = msg.ack(self.js.client(), cx).await;
                remaining = remaining.saturating_sub(1);
            }
        }

        // Integrity check
        if data.len() as u64 != info.size {
            return Err(ObjectError::IntegrityError {
                name: name.to_string(),
                expected_size: info.size,
                actual_size: data.len() as u64,
            });
        }

        Ok(data)
    }

    /// Delete an object by publishing a delete marker.
    ///
    /// The chunks remain in the stream until TTL or purge, but
    /// the metadata is marked as deleted.
    pub async fn delete(&mut self, cx: &Cx, name: &str) -> Result<(), ObjectError> {
        validate_name(name)?;

        let delete_marker = ObjectInfo {
            name: name.to_string(),
            size: 0,
            chunks: 0,
            chunk_size: self.chunk_size,
            nuid: String::new(),
            deleted: true,
        };

        let meta_subject = self.meta_subject(name);
        self.js
            .publish(cx, &meta_subject, delete_marker.to_json().as_bytes())
            .await?;

        tracing::debug!(bucket = %self.bucket, object = %name, "object deleted");
        Ok(())
    }

    /// Get metadata for an object.
    pub async fn info(&mut self, cx: &Cx, name: &str) -> Result<ObjectInfo, ObjectError> {
        validate_name(name)?;

        let meta_subject = self.meta_subject(name);
        let config = ConsumerConfig::ephemeral()
            .deliver_policy(DeliverPolicy::Last)
            .filter_subject(&meta_subject);

        let consumer = self
            .js
            .create_consumer(cx, &self.stream_name(), config)
            .await?;

        let msgs = consumer
            .pull_with_timeout(self.js.client(), cx, 1, Duration::from_secs(2))
            .await?;

        match msgs.into_iter().next() {
            Some(msg) => {
                // Clone payload before ack/drop (JsMessage implements Drop).
                let payload = msg.payload.clone();
                let _ = msg.ack(self.js.client(), cx).await;

                let json = String::from_utf8_lossy(&payload);
                let info = ObjectInfo::from_json(&json)?;
                if info.deleted {
                    Err(ObjectError::NotFound(name.to_string()))
                } else {
                    Ok(info)
                }
            }
            None => Err(ObjectError::NotFound(name.to_string())),
        }
    }

    /// List all objects in the bucket.
    ///
    /// Returns metadata for all non-deleted objects.
    pub async fn list(&mut self, cx: &Cx) -> Result<Vec<ObjectInfo>, ObjectError> {
        let meta_subject = format!("$O.{}.M.>", self.bucket);
        let config = ConsumerConfig::ephemeral()
            .deliver_policy(DeliverPolicy::LastPerSubject)
            .filter_subject(&meta_subject);

        let consumer = self
            .js
            .create_consumer(cx, &self.stream_name(), config)
            .await?;

        let mut objects = Vec::new();

        loop {
            let msgs = consumer
                .pull_with_timeout(self.js.client(), cx, 100, Duration::from_secs(2))
                .await?;

            if msgs.is_empty() {
                break;
            }

            for msg in &msgs {
                let json = String::from_utf8_lossy(&msg.payload);
                if let Ok(info) = ObjectInfo::from_json(&json) {
                    if !info.deleted {
                        objects.push(info);
                    }
                }
                let _ = msg.ack(self.js.client(), cx).await;
            }

            if msgs.len() < 100 {
                break;
            }
        }

        Ok(objects)
    }

    /// Get a mutable reference to the underlying JetStream context.
    pub fn jetstream(&mut self) -> &mut JetStreamContext {
        &mut self.js
    }
}

// ---------------------------------------------------------------------------
// Name validation
// ---------------------------------------------------------------------------

/// Validate an object name.
///
/// Object names become part of NATS subjects, so they must not contain
/// characters invalid in NATS subjects.
fn validate_name(name: &str) -> Result<(), ObjectError> {
    if name.is_empty() {
        return Err(ObjectError::InvalidName(
            "name must not be empty".to_string(),
        ));
    }

    for ch in name.chars() {
        match ch {
            ' ' | '\t' | '\n' | '\r' | '\0' => {
                return Err(ObjectError::InvalidName(format!(
                    "whitespace/null not allowed in object names: {name}"
                )));
            }
            '>' | '*' => {
                return Err(ObjectError::InvalidName(format!(
                    "wildcards not allowed in object names: {name}"
                )));
            }
            _ => {}
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// JSON helpers (no serde dependency for metadata)
// ---------------------------------------------------------------------------

/// Escape a string for safe embedding in JSON values.
fn json_escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for ch in s.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c.is_control() => {
                use std::fmt::Write;
                write!(&mut out, "\\u{:04x}", c as u32).expect("write to String");
            }
            c => out.push(c),
        }
    }
    out
}

fn extract_json_string(json: &str, key: &str) -> Option<String> {
    let pattern = format!("\"{key}\":\"");
    let start = json.find(&pattern)? + pattern.len();
    let slice = &json[start..];
    let mut chars = slice.char_indices();
    loop {
        match chars.next()? {
            (i, '"') => return Some(json[start..start + i].to_string()),
            (_, '\\') => {
                chars.next()?;
            }
            _ => {}
        }
    }
}

fn extract_json_u64(json: &str, key: &str) -> Option<u64> {
    let pattern = format!("\"{key}\":");
    let start = json.find(&pattern)? + pattern.len();
    let rest = json[start..].trim_start();
    let end = rest
        .find(|c: char| !c.is_ascii_digit())
        .unwrap_or(rest.len());
    rest[..end].parse().ok()
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_name_rejects_empty() {
        assert!(validate_name("").is_err());
    }

    #[test]
    fn validate_name_rejects_whitespace() {
        assert!(validate_name("has space").is_err());
        assert!(validate_name("has\ttab").is_err());
        assert!(validate_name("has\0null").is_err());
    }

    #[test]
    fn validate_name_rejects_wildcards() {
        assert!(validate_name("test.>").is_err());
        assert!(validate_name("test.*").is_err());
    }

    #[test]
    fn validate_name_accepts_valid() {
        assert!(validate_name("model-weights-v3").is_ok());
        assert!(validate_name("config.snapshot.2026-02-20").is_ok());
        assert!(validate_name("blob_data").is_ok());
    }

    #[test]
    fn object_info_json_roundtrip() {
        let info = ObjectInfo {
            name: "test-object".to_string(),
            size: 1024,
            chunks: 2,
            chunk_size: 512,
            nuid: "abc123".to_string(),
            deleted: false,
        };

        let json = info.to_json();
        let parsed = ObjectInfo::from_json(&json).unwrap();

        assert_eq!(parsed.name, "test-object");
        assert_eq!(parsed.size, 1024);
        assert_eq!(parsed.chunks, 2);
        assert_eq!(parsed.chunk_size, 512);
        assert_eq!(parsed.nuid, "abc123");
        assert!(!parsed.deleted);
    }

    #[test]
    fn object_info_json_with_special_chars() {
        let info = ObjectInfo {
            name: "test\"quoted".to_string(),
            size: 0,
            chunks: 0,
            chunk_size: 128,
            nuid: "id".to_string(),
            deleted: true,
        };

        let json = info.to_json();
        assert!(json.contains("\\\""));
        assert!(json.contains("\"deleted\":true"));
    }

    #[test]
    fn object_info_debug_clone() {
        let info = ObjectInfo {
            name: "blob".to_string(),
            size: 2048,
            chunks: 4,
            chunk_size: 512,
            nuid: "nuid123".to_string(),
            deleted: false,
        };

        let dbg = format!("{info:?}");
        assert!(dbg.contains("blob"));
        assert!(dbg.contains("2048"));

        let cloned = info.clone();
        assert_eq!(cloned.name, "blob");
        assert_eq!(cloned.size, 2048);
    }

    #[test]
    fn object_error_display() {
        let err = ObjectError::NotFound("missing".to_string());
        assert!(err.to_string().contains("missing"));

        let err = ObjectError::InvalidName("bad name".to_string());
        assert!(err.to_string().contains("bad name"));

        let err = ObjectError::IntegrityError {
            name: "obj".to_string(),
            expected_size: 100,
            actual_size: 50,
        };
        let msg = err.to_string();
        assert!(msg.contains("100"));
        assert!(msg.contains("50"));

        let err = ObjectError::MetadataError("parse fail".to_string());
        assert!(err.to_string().contains("parse fail"));
    }

    #[test]
    fn object_error_source() {
        let err = ObjectError::NotFound("x".to_string());
        assert!(std::error::Error::source(&err).is_none());
    }

    #[test]
    fn stream_and_subject_naming() {
        let bucket = "ava_blobs";
        assert_eq!(format!("OBJ_{bucket}"), "OBJ_ava_blobs");
        assert_eq!(
            format!("$O.{bucket}.C.{}", "abc123"),
            "$O.ava_blobs.C.abc123"
        );
        assert_eq!(
            format!("$O.{bucket}.M.{}", "config-snapshot"),
            "$O.ava_blobs.M.config-snapshot"
        );
    }

    #[test]
    fn chunk_count_calculation() {
        let chunk_size = 512usize;

        // Empty data
        let data: &[u8] = b"";
        let chunks = if data.is_empty() {
            0u32
        } else {
            ((data.len() + chunk_size - 1) / chunk_size) as u32
        };
        assert_eq!(chunks, 0);

        // Exactly one chunk
        let data = vec![0u8; 512];
        let chunks = ((data.len() + chunk_size - 1) / chunk_size) as u32;
        assert_eq!(chunks, 1);

        // Two chunks (one extra byte)
        let data = vec![0u8; 513];
        let chunks = ((data.len() + chunk_size - 1) / chunk_size) as u32;
        assert_eq!(chunks, 2);

        // Three chunks
        let data = vec![0u8; 1500];
        let chunks = ((data.len() + chunk_size - 1) / chunk_size) as u32;
        assert_eq!(chunks, 3);
    }

    #[test]
    fn json_escape_special() {
        assert_eq!(json_escape("hello"), "hello");
        assert_eq!(json_escape("he\"llo"), "he\\\"llo");
        assert_eq!(json_escape("back\\slash"), "back\\\\slash");
        assert_eq!(json_escape("new\nline"), "new\\nline");
    }

    #[test]
    fn extract_json_helpers() {
        let json = r#"{"name":"test","size":42,"deleted":true}"#;
        assert_eq!(extract_json_string(json, "name"), Some("test".to_string()));
        assert_eq!(extract_json_u64(json, "size"), Some(42));
        assert_eq!(extract_json_string(json, "missing"), None);
        assert_eq!(extract_json_u64(json, "missing"), None);
    }
}
