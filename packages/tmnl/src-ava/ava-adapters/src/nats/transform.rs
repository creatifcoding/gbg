//! Transform Pipeline for Message Processing
//!
//! Provides composable transform chains for message processing:
//! - Compression (zstd, lz4)
//! - Encryption (future)
//! - Schema evolution
//! - Filtering and enrichment
//!
//! # Example
//!
//! ```ignore
//! let pipeline = TransformPipeline::new()
//!     .add(FilterTransform::new(|a| a.channel_bindings.len() > 0))
//!     .add(EnrichTransform::new(|a| add_metadata(a)))
//!     .add(CompressTransform::zstd(3))
//!     .add(ChunkTransform::new(64 * 1024)); // 64KB chunks
//!
//! let output = pipeline.transform(artifact).await?;
//! ```

use std::sync::Arc;
use std::collections::HashMap;
use async_trait::async_trait;
use bytes::Bytes;
use tracing::{debug, instrument};

use ava_domain::views::{ViewArtifact, ViewDelta};

use super::error::NatsError;

/// Result of a transform operation.
#[derive(Debug, Clone)]
pub enum TransformOutput {
    /// Single output message
    Single(Bytes),
    /// Multiple output messages (chunking, fanout)
    Multiple(Vec<Bytes>),
    /// Drop the message
    Drop,
}

/// A transform in the pipeline.
#[async_trait]
pub trait Transform: Send + Sync {
    /// The name of this transform (for debugging/metrics).
    fn name(&self) -> &str;

    /// Transforms artifact payload.
    async fn transform_artifact(
        &self,
        artifact: &ViewArtifact,
        payload: Bytes,
    ) -> Result<TransformOutput, NatsError>;

    /// Transforms delta payload.
    async fn transform_delta(
        &self,
        delta: &ViewDelta,
        payload: Bytes,
    ) -> Result<TransformOutput, NatsError>;
}

/// Identity transform (no-op).
pub struct IdentityTransform;

#[async_trait]
impl Transform for IdentityTransform {
    fn name(&self) -> &str {
        "identity"
    }

    async fn transform_artifact(
        &self,
        _artifact: &ViewArtifact,
        payload: Bytes,
    ) -> Result<TransformOutput, NatsError> {
        Ok(TransformOutput::Single(payload))
    }

    async fn transform_delta(
        &self,
        _delta: &ViewDelta,
        payload: Bytes,
    ) -> Result<TransformOutput, NatsError> {
        Ok(TransformOutput::Single(payload))
    }
}

/// Filter transform based on predicate.
pub struct FilterTransform<F> {
    predicate: F,
}

impl<F> FilterTransform<F>
where
    F: Fn(&ViewArtifact) -> bool + Send + Sync,
{
    pub fn new(predicate: F) -> Self {
        Self { predicate }
    }
}

#[async_trait]
impl<F> Transform for FilterTransform<F>
where
    F: Fn(&ViewArtifact) -> bool + Send + Sync,
{
    fn name(&self) -> &str {
        "filter"
    }

    async fn transform_artifact(
        &self,
        artifact: &ViewArtifact,
        payload: Bytes,
    ) -> Result<TransformOutput, NatsError> {
        if (self.predicate)(artifact) {
            Ok(TransformOutput::Single(payload))
        } else {
            Ok(TransformOutput::Drop)
        }
    }

    async fn transform_delta(
        &self,
        _delta: &ViewDelta,
        payload: Bytes,
    ) -> Result<TransformOutput, NatsError> {
        // Deltas pass through (filter only applies to artifacts)
        Ok(TransformOutput::Single(payload))
    }
}

/// Enrichment transform that adds metadata.
pub struct EnrichTransform<F> {
    enricher: F,
}

impl<F> EnrichTransform<F>
where
    F: Fn(&ViewArtifact) -> HashMap<String, String> + Send + Sync,
{
    pub fn new(enricher: F) -> Self {
        Self { enricher }
    }
}

#[async_trait]
impl<F> Transform for EnrichTransform<F>
where
    F: Fn(&ViewArtifact) -> HashMap<String, String> + Send + Sync,
{
    fn name(&self) -> &str {
        "enrich"
    }

    async fn transform_artifact(
        &self,
        artifact: &ViewArtifact,
        payload: Bytes,
    ) -> Result<TransformOutput, NatsError> {
        let metadata = (self.enricher)(artifact);

        // Wrap payload with metadata envelope
        let envelope = EnrichedPayload {
            metadata,
            payload: payload.to_vec(),
        };

        let bytes = serde_json::to_vec(&envelope)?;
        Ok(TransformOutput::Single(bytes.into()))
    }

    async fn transform_delta(
        &self,
        _delta: &ViewDelta,
        payload: Bytes,
    ) -> Result<TransformOutput, NatsError> {
        Ok(TransformOutput::Single(payload))
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
struct EnrichedPayload {
    metadata: HashMap<String, String>,
    #[serde(with = "serde_bytes")]
    payload: Vec<u8>,
}

/// Compression transform using zstd.
#[cfg(feature = "compression")]
pub struct ZstdTransform {
    level: i32,
}

#[cfg(feature = "compression")]
impl ZstdTransform {
    pub fn new(level: i32) -> Self {
        Self { level: level.clamp(1, 22) }
    }
}

#[cfg(feature = "compression")]
#[async_trait]
impl Transform for ZstdTransform {
    fn name(&self) -> &str {
        "zstd"
    }

    async fn transform_artifact(
        &self,
        _artifact: &ViewArtifact,
        payload: Bytes,
    ) -> Result<TransformOutput, NatsError> {
        let compressed = zstd::encode_all(payload.as_ref(), self.level)
            .map_err(|e| NatsError::Serialization(serde_json::Error::custom(e.to_string())))?;
        Ok(TransformOutput::Single(compressed.into()))
    }

    async fn transform_delta(
        &self,
        _delta: &ViewDelta,
        payload: Bytes,
    ) -> Result<TransformOutput, NatsError> {
        let compressed = zstd::encode_all(payload.as_ref(), self.level)
            .map_err(|e| NatsError::Serialization(serde_json::Error::custom(e.to_string())))?;
        Ok(TransformOutput::Single(compressed.into()))
    }
}

/// Chunking transform for large payloads.
pub struct ChunkTransform {
    max_chunk_size: usize,
}

impl ChunkTransform {
    pub fn new(max_chunk_size: usize) -> Self {
        Self { max_chunk_size }
    }
}

#[async_trait]
impl Transform for ChunkTransform {
    fn name(&self) -> &str {
        "chunk"
    }

    async fn transform_artifact(
        &self,
        _artifact: &ViewArtifact,
        payload: Bytes,
    ) -> Result<TransformOutput, NatsError> {
        if payload.len() <= self.max_chunk_size {
            return Ok(TransformOutput::Single(payload));
        }

        let chunks: Vec<Bytes> = payload
            .chunks(self.max_chunk_size)
            .enumerate()
            .map(|(i, chunk)| {
                // Wrap chunk with index header
                let header = ChunkHeader {
                    index: i as u32,
                    total: (payload.len() / self.max_chunk_size + 1) as u32,
                    size: chunk.len() as u32,
                };
                let header_bytes = serde_json::to_vec(&header).unwrap();

                // Format: [header_len:4][header][chunk]
                let mut output = Vec::with_capacity(4 + header_bytes.len() + chunk.len());
                output.extend_from_slice(&(header_bytes.len() as u32).to_le_bytes());
                output.extend_from_slice(&header_bytes);
                output.extend_from_slice(chunk);
                Bytes::from(output)
            })
            .collect();

        Ok(TransformOutput::Multiple(chunks))
    }

    async fn transform_delta(
        &self,
        _delta: &ViewDelta,
        payload: Bytes,
    ) -> Result<TransformOutput, NatsError> {
        // Deltas are typically small, pass through
        Ok(TransformOutput::Single(payload))
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
struct ChunkHeader {
    index: u32,
    total: u32,
    size: u32,
}

/// Composable transform pipeline.
pub struct TransformPipeline {
    transforms: Vec<Arc<dyn Transform>>,
    name: String,
}

impl TransformPipeline {
    /// Creates a new empty pipeline.
    pub fn new() -> Self {
        Self {
            transforms: Vec::new(),
            name: "default".into(),
        }
    }

    /// Creates a named pipeline.
    pub fn named(name: impl Into<String>) -> Self {
        Self {
            transforms: Vec::new(),
            name: name.into(),
        }
    }

    /// Adds a transform to the pipeline.
    pub fn add<T: Transform + 'static>(mut self, transform: T) -> Self {
        self.transforms.push(Arc::new(transform));
        self
    }

    /// Adds a shared transform.
    pub fn add_shared(mut self, transform: Arc<dyn Transform>) -> Self {
        self.transforms.push(transform);
        self
    }

    /// Returns the pipeline name.
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Transforms an artifact through all stages.
    #[instrument(skip(self, artifact), fields(pipeline = %self.name))]
    pub async fn transform_artifact(
        &self,
        artifact: &ViewArtifact,
    ) -> Result<TransformOutput, NatsError> {
        // Start with JSON serialization
        let initial = serde_json::to_vec(artifact)?;
        let mut current = TransformOutput::Single(initial.into());

        for transform in &self.transforms {
            current = match current {
                TransformOutput::Single(payload) => {
                    transform.transform_artifact(artifact, payload).await?
                }
                TransformOutput::Multiple(payloads) => {
                    let mut results = Vec::new();
                    for payload in payloads {
                        match transform.transform_artifact(artifact, payload).await? {
                            TransformOutput::Single(p) => results.push(p),
                            TransformOutput::Multiple(ps) => results.extend(ps),
                            TransformOutput::Drop => {}
                        }
                    }
                    if results.is_empty() {
                        TransformOutput::Drop
                    } else {
                        TransformOutput::Multiple(results)
                    }
                }
                TransformOutput::Drop => return Ok(TransformOutput::Drop),
            };

            debug!(
                transform = transform.name(),
                "Applied transform"
            );
        }

        Ok(current)
    }

    /// Transforms a delta through all stages.
    pub async fn transform_delta(
        &self,
        delta: &ViewDelta,
    ) -> Result<TransformOutput, NatsError> {
        let initial = serde_json::to_vec(delta)?;
        let mut current = TransformOutput::Single(initial.into());

        for transform in &self.transforms {
            current = match current {
                TransformOutput::Single(payload) => {
                    transform.transform_delta(delta, payload).await?
                }
                TransformOutput::Multiple(payloads) => {
                    let mut results = Vec::new();
                    for payload in payloads {
                        match transform.transform_delta(delta, payload).await? {
                            TransformOutput::Single(p) => results.push(p),
                            TransformOutput::Multiple(ps) => results.extend(ps),
                            TransformOutput::Drop => {}
                        }
                    }
                    if results.is_empty() {
                        TransformOutput::Drop
                    } else {
                        TransformOutput::Multiple(results)
                    }
                }
                TransformOutput::Drop => return Ok(TransformOutput::Drop),
            };
        }

        Ok(current)
    }
}

impl Default for TransformPipeline {
    fn default() -> Self {
        Self::new()
    }
}

/// Registry of named transform pipelines.
pub struct TransformRegistry {
    pipelines: HashMap<String, Arc<TransformPipeline>>,
}

impl TransformRegistry {
    pub fn new() -> Self {
        Self {
            pipelines: HashMap::new(),
        }
    }

    /// Registers a pipeline.
    pub fn register(&mut self, pipeline: TransformPipeline) {
        let name = pipeline.name().to_string();
        self.pipelines.insert(name, Arc::new(pipeline));
    }

    /// Gets a pipeline by name.
    pub fn get(&self, name: &str) -> Option<Arc<TransformPipeline>> {
        self.pipelines.get(name).cloned()
    }

    /// Returns all pipeline names.
    pub fn names(&self) -> impl Iterator<Item = &str> {
        self.pipelines.keys().map(|s| s.as_str())
    }
}

impl Default for TransformRegistry {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ava_domain::ids::{ViewId, AssemblageId};
    use ava_domain::views::ViewProfileSpec;

    fn make_test_artifact() -> ViewArtifact {
        ViewArtifact {
            view_id: ViewId::new("test-view"),
            asset_id: None,
            spec: ViewProfileSpec {
                id: ViewId::new("test-view"),
                name: "Test".into(),
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
    async fn test_identity_transform() {
        let transform = IdentityTransform;
        let artifact = make_test_artifact();
        let payload = Bytes::from("test payload");

        let result = transform.transform_artifact(&artifact, payload.clone()).await.unwrap();
        match result {
            TransformOutput::Single(p) => assert_eq!(p, payload),
            _ => panic!("Expected single output"),
        }
    }

    #[tokio::test]
    async fn test_filter_transform() {
        let transform = FilterTransform::new(|a: &ViewArtifact| a.logical_version > 1);
        let artifact = make_test_artifact();
        let payload = Bytes::from("test");

        // Should be dropped (version is 1)
        let result = transform.transform_artifact(&artifact, payload).await.unwrap();
        assert!(matches!(result, TransformOutput::Drop));
    }

    #[tokio::test]
    async fn test_pipeline_composition() {
        let pipeline = TransformPipeline::named("test")
            .add(IdentityTransform);

        let artifact = make_test_artifact();
        let result = pipeline.transform_artifact(&artifact).await.unwrap();

        match result {
            TransformOutput::Single(p) => {
                // Should be valid JSON
                let _: ViewArtifact = serde_json::from_slice(&p).unwrap();
            }
            _ => panic!("Expected single output"),
        }
    }

    #[tokio::test]
    async fn test_chunk_transform() {
        let transform = ChunkTransform::new(10); // Very small for testing
        let artifact = make_test_artifact();
        let payload = Bytes::from("this is a longer payload that needs chunking");

        let result = transform.transform_artifact(&artifact, payload).await.unwrap();
        match result {
            TransformOutput::Multiple(chunks) => {
                assert!(chunks.len() > 1);
            }
            _ => panic!("Expected multiple chunks"),
        }
    }
}
