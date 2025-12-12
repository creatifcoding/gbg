//! HydrationService - Populates ChannelBinding.data based on source type
//!
//! Implements a hybrid hydration model:
//! - **Server-hydrated**: Streams, batches, inline JSON (Rows, Inline, StreamHandle)
//! - **Client-fetched**: Static assets like 3D models (AssetRef)
//!
//! # Architecture
//!
//! ```text
//! ChannelPipelineSpec
//!         │
//!         ▼
//!   ┌─────────────────┐
//!   │ HydrationService │
//!   └────────┬────────┘
//!            │
//!   ┌────────┴────────┐
//!   │   Determine     │
//!   │   Strategy      │
//!   └────────┬────────┘
//!            │
//!    ┌───────┼───────┐
//!    ▼       ▼       ▼
//!  Sql    Stream   Asset
//!    │       │       │
//!    ▼       ▼       ▼
//!  Rows  StreamH  AssetRef
//! ```
//!
//! # Usage
//!
//! ```ignore
//! use ava_runtime::v2::HydrationService;
//!
//! let service = HydrationService::new(HydrationConfig::default(), adapters.clone());
//!
//! // Hydrate a single channel
//! let data = service.hydrate_channel(&channel_spec).await?;
//!
//! // Hydrate all channels in an artifact
//! let hydrated_artifact = service.hydrate_artifact(artifact).await?;
//! ```

use std::sync::Arc;

use arrow::array::RecordBatch;
use datafusion::prelude::*;
use serde_json::Value as JsonValue;
use tokio::sync::RwLock;

use ava_adapters::AdapterRegistry;
use ava_domain::{
    ChannelPipelineSpec, ChannelData,
    SourceKind, ViewArtifact, ChannelId,
};

use crate::RuntimeError;

// ============================================================================
// Configuration
// ============================================================================

/// Configuration for the HydrationService
#[derive(Debug, Clone)]
pub struct HydrationConfig {
    /// Maximum number of rows before switching to streaming handle
    pub max_inline_rows: usize,

    /// Maximum JSON payload size (bytes) before using AssetRef
    pub max_inline_bytes: usize,

    /// File extensions that should be fetched client-side
    pub asset_extensions: Vec<String>,

    /// MIME types that should be fetched client-side
    pub asset_mime_types: Vec<String>,

    /// Enable parallel hydration of channels
    pub parallel_hydration: bool,
}

impl Default for HydrationConfig {
    fn default() -> Self {
        Self {
            max_inline_rows: 10_000,
            max_inline_bytes: 1_024 * 1_024, // 1MB
            asset_extensions: vec![
                "glb".into(), "gltf".into(),  // 3D models
                "fbx".into(), "obj".into(),
                "png".into(), "jpg".into(), "jpeg".into(), "webp".into(),  // Images
                "mp4".into(), "webm".into(),  // Video
                "mp3".into(), "wav".into(), "ogg".into(),  // Audio
            ],
            asset_mime_types: vec![
                "model/gltf-binary".into(),
                "model/gltf+json".into(),
                "image/png".into(),
                "image/jpeg".into(),
                "video/mp4".into(),
                "audio/mpeg".into(),
            ],
            parallel_hydration: true,
        }
    }
}

// ============================================================================
// Hydration Strategy
// ============================================================================

/// Strategy for hydrating a channel based on its characteristics
#[derive(Debug, Clone, PartialEq)]
pub enum HydrationStrategy {
    /// Query SQL source, return as Rows
    QueryRows,

    /// Query and return as single Inline value (aggregates, scalars)
    QueryInline,

    /// Bind to streaming topic, return StreamHandle
    BindStream,

    /// Return AssetRef for client-side fetching
    AssetReference { uri: String, mime_type: Option<String> },

    /// Skip hydration (leave as Pending)
    Skip,
}

impl HydrationStrategy {
    /// Determine strategy based on channel spec
    pub fn from_spec(spec: &ChannelPipelineSpec, config: &HydrationConfig) -> Self {
        // Check if connection looks like an asset URI
        if Self::is_asset_uri(&spec.source.connection, config) {
            let mime_type = Self::guess_mime_type(&spec.source.connection);
            return HydrationStrategy::AssetReference {
                uri: spec.source.connection.clone(),
                mime_type,
            };
        }

        match &spec.source.kind {
            SourceKind::Sql => {
                // Single-row results (aggregates) -> Inline, multi-row -> Rows
                if Self::is_scalar_query(spec) {
                    HydrationStrategy::QueryInline
                } else {
                    HydrationStrategy::QueryRows
                }
            }

            SourceKind::Stream => HydrationStrategy::BindStream,

            SourceKind::Api => {
                // APIs typically return JSON, treat as inline unless too large
                HydrationStrategy::QueryInline
            }

            SourceKind::Graph | SourceKind::Lake => {
                // Graph and Lake queries return rows
                HydrationStrategy::QueryRows
            }

            SourceKind::Cache => {
                // Cache is typically small, inline
                HydrationStrategy::QueryInline
            }

            SourceKind::Custom(_) => {
                // Default to rows for custom sources
                HydrationStrategy::QueryRows
            }
        }
    }

    /// Check if URI points to an asset file
    fn is_asset_uri(uri: &str, config: &HydrationConfig) -> bool {
        // Check common asset URI schemes
        if uri.starts_with("s3://")
            || uri.starts_with("gs://")
            || uri.starts_with("https://")
            || uri.starts_with("file://")
        {
            // Check extension
            if let Some(ext) = uri.split('.').last() {
                let ext_lower = ext.to_lowercase();
                if config.asset_extensions.iter().any(|e| e == &ext_lower) {
                    return true;
                }
            }
        }
        false
    }

    /// Guess MIME type from URI extension
    fn guess_mime_type(uri: &str) -> Option<String> {
        let ext = uri.split('.').last()?.to_lowercase();
        match ext.as_str() {
            "glb" => Some("model/gltf-binary".into()),
            "gltf" => Some("model/gltf+json".into()),
            "png" => Some("image/png".into()),
            "jpg" | "jpeg" => Some("image/jpeg".into()),
            "webp" => Some("image/webp".into()),
            "mp4" => Some("video/mp4".into()),
            "webm" => Some("video/webm".into()),
            "mp3" => Some("audio/mpeg".into()),
            "wav" => Some("audio/wav".into()),
            "ogg" => Some("audio/ogg".into()),
            _ => None,
        }
    }

    /// Check if query is a scalar (single value) query
    fn is_scalar_query(spec: &ChannelPipelineSpec) -> bool {
        // Look for aggregate operators with no GROUP BY (returns single row)
        for op in &spec.pipeline {
            if let ava_domain::PipelineOperator::Aggregate { group_by, .. } = op {
                if group_by.is_empty() {
                    return true;
                }
            }
        }
        false
    }
}

// ============================================================================
// HydrationService
// ============================================================================

/// Service that populates ChannelBinding.data based on source type
#[derive(Clone)]
pub struct HydrationService {
    /// Configuration
    config: HydrationConfig,

    /// Adapter registry for source access
    adapters: Arc<RwLock<AdapterRegistry>>,

    /// DataFusion session for query execution
    session: Arc<RwLock<SessionContext>>,
}

impl HydrationService {
    /// Create a new HydrationService
    pub fn new(
        config: HydrationConfig,
        adapters: Arc<RwLock<AdapterRegistry>>,
        session: Arc<RwLock<SessionContext>>,
    ) -> Self {
        Self { config, adapters, session }
    }

    /// Create with default config
    pub fn with_defaults(
        adapters: Arc<RwLock<AdapterRegistry>>,
        session: Arc<RwLock<SessionContext>>,
    ) -> Self {
        Self::new(HydrationConfig::default(), adapters, session)
    }

    /// Get the configuration
    pub fn config(&self) -> &HydrationConfig {
        &self.config
    }

    // ========================================================================
    // Main Hydration API
    // ========================================================================

    /// Hydrate a single channel, returning the appropriate ChannelData
    pub async fn hydrate_channel(
        &self,
        spec: &ChannelPipelineSpec,
    ) -> Result<ChannelData, RuntimeError> {
        let strategy = HydrationStrategy::from_spec(spec, &self.config);

        match strategy {
            HydrationStrategy::QueryRows => self.hydrate_rows(spec).await,
            HydrationStrategy::QueryInline => self.hydrate_inline(spec).await,
            HydrationStrategy::BindStream => self.hydrate_stream(spec).await,
            HydrationStrategy::AssetReference { uri, mime_type } => {
                Ok(ChannelData::AssetRef {
                    uri,
                    mime_type,
                    etag: None,
                    content_hash: None,
                })
            }
            HydrationStrategy::Skip => Ok(ChannelData::Pending),
        }
    }

    /// Hydrate all channels in an artifact
    pub async fn hydrate_artifact(
        &self,
        mut artifact: ViewArtifact,
    ) -> Result<ViewArtifact, RuntimeError> {
        if self.config.parallel_hydration && artifact.spec.channels.len() > 1 {
            self.hydrate_artifact_parallel(&mut artifact).await?;
        } else {
            self.hydrate_artifact_sequential(&mut artifact).await?;
        }

        Ok(artifact)
    }

    /// Hydrate channels sequentially
    async fn hydrate_artifact_sequential(
        &self,
        artifact: &mut ViewArtifact,
    ) -> Result<(), RuntimeError> {
        for channel_spec in &artifact.spec.channels {
            let data = self.hydrate_channel(channel_spec).await;

            // Find the corresponding binding and update it
            if let Some(binding) = artifact
                .channel_bindings
                .iter_mut()
                .find(|b| b.channel_id == channel_spec.id)
            {
                match data {
                    Ok(d) => {
                        binding.data = Some(d);
                        binding.active = true;
                        binding.last_updated_ms = Some(Self::now_ms());
                    }
                    Err(e) => {
                        binding.data = Some(ChannelData::Error {
                            code: "HYDRATION_FAILED".into(),
                            message: e.to_string(),
                            retryable: true,
                        });
                    }
                }
            }
        }

        Ok(())
    }

    /// Hydrate channels in parallel using tokio::join_all
    async fn hydrate_artifact_parallel(
        &self,
        artifact: &mut ViewArtifact,
    ) -> Result<(), RuntimeError> {
        use futures::future::join_all;

        let futures: Vec<_> = artifact
            .spec
            .channels
            .iter()
            .map(|spec| async move {
                let channel_id = spec.id.clone();
                let result = self.hydrate_channel(spec).await;
                (channel_id, result)
            })
            .collect();

        let results = join_all(futures).await;

        for (channel_id, data) in results {
            if let Some(binding) = artifact
                .channel_bindings
                .iter_mut()
                .find(|b| b.channel_id == channel_id)
            {
                match data {
                    Ok(d) => {
                        binding.data = Some(d);
                        binding.active = true;
                        binding.last_updated_ms = Some(Self::now_ms());
                    }
                    Err(e) => {
                        binding.data = Some(ChannelData::Error {
                            code: "HYDRATION_FAILED".into(),
                            message: e.to_string(),
                            retryable: true,
                        });
                    }
                }
            }
        }

        Ok(())
    }

    // ========================================================================
    // Strategy-Specific Hydration
    // ========================================================================

    /// Hydrate as Rows (tabular data)
    async fn hydrate_rows(
        &self,
        spec: &ChannelPipelineSpec,
    ) -> Result<ChannelData, RuntimeError> {
        let batches = self.execute_query(spec).await?;

        // Convert RecordBatches to JSON rows
        let rows = Self::batches_to_json(&batches)?;

        // Check if result is too large
        if rows.len() > self.config.max_inline_rows {
            // For now, truncate with a warning in the data
            // In production, this might switch to a StreamHandle or cursor
            let truncated: Vec<JsonValue> = rows
                .into_iter()
                .take(self.config.max_inline_rows)
                .collect();
            return Ok(ChannelData::Rows(truncated));
        }

        Ok(ChannelData::Rows(rows))
    }

    /// Hydrate as Inline (scalar or small JSON)
    async fn hydrate_inline(
        &self,
        spec: &ChannelPipelineSpec,
    ) -> Result<ChannelData, RuntimeError> {
        let batches = self.execute_query(spec).await?;

        // For inline, we expect a single value or small object
        let rows = Self::batches_to_json(&batches)?;

        if rows.len() == 1 {
            // Single row - might be an aggregate result
            let row = rows.into_iter().next().unwrap();

            // If it's an object with a single field, unwrap it
            if let JsonValue::Object(map) = &row {
                if map.len() == 1 {
                    let value = map.values().next().unwrap().clone();
                    return Ok(ChannelData::Inline(value));
                }
            }

            return Ok(ChannelData::Inline(row));
        }

        // Multiple rows - wrap in array
        Ok(ChannelData::Inline(JsonValue::Array(rows)))
    }

    /// Hydrate as StreamHandle
    async fn hydrate_stream(
        &self,
        spec: &ChannelPipelineSpec,
    ) -> Result<ChannelData, RuntimeError> {
        // For streams, we create a handle that the client can subscribe to
        // The topic is derived from the source connection
        let topic = Self::derive_topic(&spec.source.connection, &spec.id);

        Ok(ChannelData::StreamHandle {
            topic,
            cursor: None, // Will be set on first message
            schema_uri: spec.source.schema.clone(),
        })
    }

    // ========================================================================
    // Query Execution
    // ========================================================================

    /// Execute a channel's query via DataFusion
    async fn execute_query(
        &self,
        spec: &ChannelPipelineSpec,
    ) -> Result<Vec<RecordBatch>, RuntimeError> {
        let adapters = self.adapters.read().await;

        // Get the adapter for this source
        let adapter = adapters
            .get(&spec.source.id)
            .ok_or_else(|| RuntimeError::AdapterError(format!(
                "Source adapter not found: {}",
                spec.source.id.as_str()
            )))?;

        // Build SQL from pipeline operators
        let sql = Self::build_sql(spec)?;

        // Execute query
        let batch = adapter
            .query(&sql)
            .await
            .map_err(|e| RuntimeError::AdapterError(e.to_string()))?;

        Ok(vec![batch])
    }

    /// Build SQL from pipeline spec
    fn build_sql(spec: &ChannelPipelineSpec) -> Result<String, RuntimeError> {
        let table = spec.source.id.as_str();
        let mut sql = format!("SELECT * FROM {}", table);

        for op in &spec.pipeline {
            match op {
                ava_domain::PipelineOperator::Filter { predicate } => {
                    sql = format!("SELECT * FROM ({}) WHERE {}", sql, predicate);
                }
                ava_domain::PipelineOperator::Project { columns } => {
                    let cols = columns.join(", ");
                    sql = format!("SELECT {} FROM ({})", cols, sql);
                }
                ava_domain::PipelineOperator::Limit { count, offset } => {
                    sql = format!("{} LIMIT {}", sql, count);
                    if let Some(off) = offset {
                        sql = format!("{} OFFSET {}", sql, off);
                    }
                }
                ava_domain::PipelineOperator::Sort { columns } => {
                    let order: Vec<String> = columns
                        .iter()
                        .map(|c| {
                            let dir = if c.descending { "DESC" } else { "ASC" };
                            let nulls = if c.nulls_first { "NULLS FIRST" } else { "NULLS LAST" };
                            format!("{} {} {}", c.column, dir, nulls)
                        })
                        .collect();
                    sql = format!("{} ORDER BY {}", sql, order.join(", "));
                }
                ava_domain::PipelineOperator::Aggregate { group_by, aggregates } => {
                    let agg_cols: Vec<String> = aggregates
                        .iter()
                        .map(|a| format!("{}({}) AS {}", a.function, a.column, a.alias))
                        .collect();
                    let select = agg_cols.join(", ");

                    if group_by.is_empty() {
                        sql = format!("SELECT {} FROM ({})", select, sql);
                    } else {
                        let groups = group_by.join(", ");
                        sql = format!(
                            "SELECT {}, {} FROM ({}) GROUP BY {}",
                            groups, select, sql, groups
                        );
                    }
                }
                ava_domain::PipelineOperator::Join { source, left_key, right_key, join_type } => {
                    let join_keyword = match join_type {
                        ava_domain::JoinType::Inner => "INNER JOIN",
                        ava_domain::JoinType::Left => "LEFT JOIN",
                        ava_domain::JoinType::Right => "RIGHT JOIN",
                        ava_domain::JoinType::Full => "FULL OUTER JOIN",
                        ava_domain::JoinType::Cross => "CROSS JOIN",
                    };
                    sql = format!(
                        "SELECT * FROM ({}) {} {} ON {} = {}",
                        sql, join_keyword, source.as_str(), left_key, right_key
                    );
                }
                ava_domain::PipelineOperator::Window { .. } => {
                    // Window functions are complex - skip for now
                    // TODO: Implement window function SQL generation
                }
            }
        }

        Ok(sql)
    }

    // ========================================================================
    // Utilities
    // ========================================================================

    /// Convert Arrow RecordBatches to JSON rows
    fn batches_to_json(batches: &[RecordBatch]) -> Result<Vec<JsonValue>, RuntimeError> {
        use serde_json::Map;

        let mut all_rows = Vec::new();

        for batch in batches {
            // Use arrow_json::ArrayWriter to convert to JSON
            let buf = Vec::new();
            let mut writer = arrow_json::ArrayWriter::new(buf);

            writer.write(batch)
                .map_err(|e| RuntimeError::Internal(format!("JSON write failed: {}", e)))?;

            writer.finish()
                .map_err(|e| RuntimeError::Internal(format!("JSON finish failed: {}", e)))?;

            let json_data = writer.into_inner();

            // Parse the JSON array back into serde_json::Value objects
            let rows: Vec<Map<String, JsonValue>> = serde_json::from_slice(&json_data)
                .map_err(|e| RuntimeError::Internal(format!("JSON parse failed: {}", e)))?;

            for row in rows {
                all_rows.push(JsonValue::Object(row));
            }
        }

        Ok(all_rows)
    }

    /// Derive a topic name from connection string and channel ID
    fn derive_topic(connection: &str, channel_id: &ChannelId) -> String {
        // Extract meaningful parts from connection
        let clean_conn = connection
            .replace("://", ".")
            .replace('/', ".")
            .replace(':', ".");

        format!("{}.{}", clean_conn, channel_id.as_str())
    }

    /// Get current timestamp in milliseconds
    fn now_ms() -> f64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as f64
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use ava_domain::{
        SourceSpec, SourceId, MaterializationTier, ChannelRole,
    };

    fn make_sql_channel(id: &str) -> ChannelPipelineSpec {
        ChannelPipelineSpec {
            id: ChannelId::new(id),
            role: ChannelRole::State,
            source: SourceSpec {
                id: SourceId::new("db"),
                kind: SourceKind::Sql,
                connection: "sqlite::memory:".into(),
                schema: None,
            },
            additional_sources: vec![],
            pipeline: vec![],
            materialization: MaterializationTier::OnDemand,
            refresh_ms: None,
        }
    }

    fn make_stream_channel(id: &str) -> ChannelPipelineSpec {
        ChannelPipelineSpec {
            id: ChannelId::new(id),
            role: ChannelRole::Event,
            source: SourceSpec {
                id: SourceId::new("kafka"),
                kind: SourceKind::Stream,
                connection: "kafka://localhost:9092/vehicle.position".into(),
                schema: Some("schema://vehicle/position/v1".into()),
            },
            additional_sources: vec![],
            pipeline: vec![],
            materialization: MaterializationTier::Continuous,
            refresh_ms: None,
        }
    }

    fn make_asset_channel(id: &str, uri: &str) -> ChannelPipelineSpec {
        ChannelPipelineSpec {
            id: ChannelId::new(id),
            role: ChannelRole::State,
            source: SourceSpec {
                id: SourceId::new("assets"),
                kind: SourceKind::Custom("asset".into()),
                connection: uri.into(),
                schema: None,
            },
            additional_sources: vec![],
            pipeline: vec![],
            materialization: MaterializationTier::Cached,
            refresh_ms: None,
        }
    }

    // ========================================================================
    // Strategy Tests
    // ========================================================================

    #[test]
    fn test_strategy_sql_to_rows() {
        let config = HydrationConfig::default();
        let spec = make_sql_channel("state");

        let strategy = HydrationStrategy::from_spec(&spec, &config);
        assert_eq!(strategy, HydrationStrategy::QueryRows);
    }

    #[test]
    fn test_strategy_stream_to_handle() {
        let config = HydrationConfig::default();
        let spec = make_stream_channel("events");

        let strategy = HydrationStrategy::from_spec(&spec, &config);
        assert_eq!(strategy, HydrationStrategy::BindStream);
    }

    #[test]
    fn test_strategy_asset_to_ref() {
        let config = HydrationConfig::default();
        let spec = make_asset_channel("model", "s3://models/truck.glb");

        let strategy = HydrationStrategy::from_spec(&spec, &config);
        assert!(matches!(strategy, HydrationStrategy::AssetReference { .. }));

        if let HydrationStrategy::AssetReference { uri, mime_type } = strategy {
            assert_eq!(uri, "s3://models/truck.glb");
            assert_eq!(mime_type, Some("model/gltf-binary".into()));
        }
    }

    #[test]
    fn test_strategy_aggregate_to_inline() {
        let config = HydrationConfig::default();
        let mut spec = make_sql_channel("total");
        spec.pipeline.push(ava_domain::PipelineOperator::Aggregate {
            group_by: vec![],
            aggregates: vec![ava_domain::AggregateExpr {
                function: "SUM".into(),
                column: "amount".into(),
                alias: "total".into(),
            }],
        });

        let strategy = HydrationStrategy::from_spec(&spec, &config);
        assert_eq!(strategy, HydrationStrategy::QueryInline);
    }

    // ========================================================================
    // URI Detection Tests
    // ========================================================================

    #[test]
    fn test_is_asset_uri_s3() {
        let config = HydrationConfig::default();
        assert!(HydrationStrategy::is_asset_uri("s3://bucket/model.glb", &config));
        assert!(HydrationStrategy::is_asset_uri("s3://bucket/image.png", &config));
        assert!(!HydrationStrategy::is_asset_uri("s3://bucket/data.csv", &config));
    }

    #[test]
    fn test_is_asset_uri_https() {
        let config = HydrationConfig::default();
        assert!(HydrationStrategy::is_asset_uri("https://cdn.example.com/model.gltf", &config));
        assert!(!HydrationStrategy::is_asset_uri("https://api.example.com/data", &config));
    }

    #[test]
    fn test_guess_mime_type() {
        assert_eq!(
            HydrationStrategy::guess_mime_type("model.glb"),
            Some("model/gltf-binary".into())
        );
        assert_eq!(
            HydrationStrategy::guess_mime_type("image.png"),
            Some("image/png".into())
        );
        assert_eq!(
            HydrationStrategy::guess_mime_type("video.mp4"),
            Some("video/mp4".into())
        );
        assert_eq!(HydrationStrategy::guess_mime_type("data.csv"), None);
    }

    // ========================================================================
    // SQL Builder Tests
    // ========================================================================

    #[test]
    fn test_build_sql_simple() {
        let spec = make_sql_channel("test");
        let sql = HydrationService::build_sql(&spec).unwrap();
        assert_eq!(sql, "SELECT * FROM db");
    }

    #[test]
    fn test_build_sql_with_filter() {
        let mut spec = make_sql_channel("test");
        spec.pipeline.push(ava_domain::PipelineOperator::Filter {
            predicate: "status = 'active'".into(),
        });

        let sql = HydrationService::build_sql(&spec).unwrap();
        assert!(sql.contains("WHERE status = 'active'"));
    }

    #[test]
    fn test_build_sql_with_project() {
        let mut spec = make_sql_channel("test");
        spec.pipeline.push(ava_domain::PipelineOperator::Project {
            columns: vec!["id".into(), "name".into()],
        });

        let sql = HydrationService::build_sql(&spec).unwrap();
        assert!(sql.contains("SELECT id, name FROM"));
    }

    #[test]
    fn test_build_sql_with_limit() {
        let mut spec = make_sql_channel("test");
        spec.pipeline.push(ava_domain::PipelineOperator::Limit {
            count: 10,
            offset: Some(5),
        });

        let sql = HydrationService::build_sql(&spec).unwrap();
        assert!(sql.contains("LIMIT 10"));
        assert!(sql.contains("OFFSET 5"));
    }

    #[test]
    fn test_build_sql_with_sort() {
        let mut spec = make_sql_channel("test");
        spec.pipeline.push(ava_domain::PipelineOperator::Sort {
            columns: vec![ava_domain::SortColumn {
                column: "created_at".into(),
                descending: true,
                nulls_first: false,
            }],
        });

        let sql = HydrationService::build_sql(&spec).unwrap();
        assert!(sql.contains("ORDER BY created_at DESC NULLS LAST"));
    }

    #[test]
    fn test_build_sql_with_aggregate() {
        let mut spec = make_sql_channel("test");
        spec.pipeline.push(ava_domain::PipelineOperator::Aggregate {
            group_by: vec!["category".into()],
            aggregates: vec![
                ava_domain::AggregateExpr {
                    function: "COUNT".into(),
                    column: "*".into(),
                    alias: "count".into(),
                },
                ava_domain::AggregateExpr {
                    function: "SUM".into(),
                    column: "amount".into(),
                    alias: "total".into(),
                },
            ],
        });

        let sql = HydrationService::build_sql(&spec).unwrap();
        assert!(sql.contains("COUNT(*)"));
        assert!(sql.contains("SUM(amount)"));
        assert!(sql.contains("GROUP BY category"));
    }

    // ========================================================================
    // Utility Tests
    // ========================================================================

    #[test]
    fn test_derive_topic() {
        let channel_id = ChannelId::new("position");
        let topic = HydrationService::derive_topic("kafka://localhost:9092/vehicle", &channel_id);
        assert_eq!(topic, "kafka.localhost.9092.vehicle.position");
    }

    #[test]
    fn test_now_ms_reasonable() {
        let ms = HydrationService::now_ms();
        // Should be after year 2024 (~1704067200000)
        assert!(ms > 1_700_000_000_000.0);
    }

    // ========================================================================
    // Config Tests
    // ========================================================================

    #[test]
    fn test_default_config() {
        let config = HydrationConfig::default();
        assert_eq!(config.max_inline_rows, 10_000);
        assert_eq!(config.max_inline_bytes, 1_024 * 1_024);
        assert!(config.asset_extensions.contains(&"glb".to_string()));
        assert!(config.parallel_hydration);
    }

    // ========================================================================
    // Stream Handle Tests
    // ========================================================================

    #[tokio::test]
    async fn test_hydrate_stream_creates_handle() {
        let adapters = Arc::new(RwLock::new(AdapterRegistry::new()));
        let session = Arc::new(RwLock::new(SessionContext::new()));
        let service = HydrationService::with_defaults(adapters, session);

        let spec = make_stream_channel("events");
        let data = service.hydrate_stream(&spec).await.unwrap();

        match data {
            ChannelData::StreamHandle { topic, cursor, schema_uri } => {
                assert!(topic.contains("vehicle.position"));
                assert!(topic.contains("events"));
                assert!(cursor.is_none());
                assert_eq!(schema_uri, Some("schema://vehicle/position/v1".into()));
            }
            _ => panic!("Expected StreamHandle"),
        }
    }

    // ========================================================================
    // Asset Ref Tests
    // ========================================================================

    #[tokio::test]
    async fn test_hydrate_asset_ref() {
        let adapters = Arc::new(RwLock::new(AdapterRegistry::new()));
        let session = Arc::new(RwLock::new(SessionContext::new()));
        let service = HydrationService::with_defaults(adapters, session);

        let spec = make_asset_channel("model", "s3://models/truck.glb");
        let data = service.hydrate_channel(&spec).await.unwrap();

        match data {
            ChannelData::AssetRef { uri, mime_type, etag, content_hash } => {
                assert_eq!(uri, "s3://models/truck.glb");
                assert_eq!(mime_type, Some("model/gltf-binary".into()));
                assert!(etag.is_none());
                assert!(content_hash.is_none());
            }
            _ => panic!("Expected AssetRef"),
        }
    }
}
