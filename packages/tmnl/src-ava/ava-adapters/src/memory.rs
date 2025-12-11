//! In-Memory Source Adapter
//!
//! Stores Arrow RecordBatches in memory and provides SQL query capability
//! via DataFusion's SessionContext.

use std::sync::Arc;
use async_trait::async_trait;
use arrow::array::RecordBatch;
use arrow::datatypes::SchemaRef;
use datafusion::prelude::*;
use datafusion::datasource::MemTable;
use tokio::sync::RwLock;

use ava_domain::{
    SourceAdapter, SubscriptionHandle,
    SourceId, SourceKind, SourceError,
};

/// In-memory source adapter backed by Arrow RecordBatches.
///
/// Uses DataFusion's `MemTable` and `SessionContext` for SQL query execution.
///
/// # Features
///
/// - Zero-copy storage of Arrow RecordBatches
/// - SQL query support via DataFusion
/// - Thread-safe read/write access
/// - Batch append for streaming ingest
///
/// # Example
///
/// ```ignore
/// use arrow::array::{Int32Array, StringArray};
/// use arrow::datatypes::{Schema, Field, DataType};
/// use arrow::record_batch::RecordBatch;
///
/// let schema = Arc::new(Schema::new(vec![
///     Field::new("id", DataType::Int32, false),
///     Field::new("name", DataType::Utf8, true),
/// ]));
///
/// let batch = RecordBatch::try_new(
///     schema.clone(),
///     vec![
///         Arc::new(Int32Array::from(vec![1, 2, 3])),
///         Arc::new(StringArray::from(vec!["a", "b", "c"])),
///     ],
/// ).unwrap();
///
/// let adapter = MemoryAdapter::new(
///     SourceId::new("test"),
///     vec![batch],
/// );
/// ```
pub struct MemoryAdapter {
    /// Unique source identifier
    id: SourceId,

    /// Table name for SQL queries (defaults to "data")
    table_name: String,

    /// Schema of the stored data
    schema: SchemaRef,

    /// Stored batches (behind RwLock for concurrent access)
    batches: RwLock<Vec<RecordBatch>>,

    /// DataFusion session context (lazy-initialized on connect)
    ctx: RwLock<Option<SessionContext>>,

    /// Connection state
    connected: RwLock<bool>,
}

impl MemoryAdapter {
    /// Creates a new MemoryAdapter with the given batches.
    ///
    /// # Panics
    ///
    /// Panics if `batches` is empty (schema cannot be inferred).
    pub fn new(id: SourceId, batches: Vec<RecordBatch>) -> Self {
        assert!(!batches.is_empty(), "MemoryAdapter requires at least one batch");

        let schema = batches[0].schema();

        Self {
            id,
            table_name: "data".to_string(),
            schema,
            batches: RwLock::new(batches),
            ctx: RwLock::new(None),
            connected: RwLock::new(false),
        }
    }

    /// Creates an empty MemoryAdapter with the given schema.
    pub fn empty(id: SourceId, schema: SchemaRef) -> Self {
        Self {
            id,
            table_name: "data".to_string(),
            schema,
            batches: RwLock::new(vec![]),
            ctx: RwLock::new(None),
            connected: RwLock::new(false),
        }
    }

    /// Sets the table name used in SQL queries.
    ///
    /// Default is "data".
    pub fn with_table_name(mut self, name: impl Into<String>) -> Self {
        self.table_name = name.into();
        self
    }

    /// Appends a batch to the in-memory store.
    ///
    /// Note: The DataFusion context needs to be refreshed after append
    /// to pick up the new data. Call `reconnect()` after bulk appends.
    pub async fn append(&self, batch: RecordBatch) -> Result<(), SourceError> {
        // Validate schema compatibility
        if batch.schema() != self.schema {
            return Err(SourceError::QueryFailed {
                source_id: self.id.clone(),
                message: format!(
                    "Schema mismatch: expected {:?}, got {:?}",
                    self.schema, batch.schema()
                ),
            });
        }

        let mut batches = self.batches.write().await;
        batches.push(batch);

        Ok(())
    }

    /// Clears all stored batches.
    pub async fn clear(&self) {
        let mut batches = self.batches.write().await;
        batches.clear();
    }

    /// Returns the number of stored batches.
    pub async fn batch_count(&self) -> usize {
        self.batches.read().await.len()
    }

    /// Returns the total row count across all batches.
    pub async fn row_count(&self) -> usize {
        self.batches.read().await.iter().map(|b| b.num_rows()).sum()
    }

    /// Refreshes the DataFusion context with current batches.
    ///
    /// Call this after bulk appends to make new data queryable.
    pub async fn refresh_context(&self) -> Result<(), SourceError> {
        if !*self.connected.read().await {
            return Ok(()); // Not connected, nothing to refresh
        }

        // Rebuild context with current batches
        let batches = self.batches.read().await.clone();
        let ctx = self.build_context(batches).await?;

        let mut ctx_guard = self.ctx.write().await;
        *ctx_guard = Some(ctx);

        Ok(())
    }

    /// Builds a new DataFusion SessionContext with the given batches.
    async fn build_context(&self, batches: Vec<RecordBatch>) -> Result<SessionContext, SourceError> {
        let ctx = SessionContext::new();

        if !batches.is_empty() {
            let mem_table = MemTable::try_new(self.schema.clone(), vec![batches])
                .map_err(|e| SourceError::ConnectionFailed {
                    source_id: self.id.clone(),
                    message: format!("Failed to create MemTable: {}", e),
                })?;

            ctx.register_table(&self.table_name, Arc::new(mem_table))
                .map_err(|e| SourceError::ConnectionFailed {
                    source_id: self.id.clone(),
                    message: format!("Failed to register table: {}", e),
                })?;
        }

        Ok(ctx)
    }
}

#[async_trait]
impl SourceAdapter for MemoryAdapter {
    fn kind(&self) -> SourceKind {
        SourceKind::Cache
    }

    fn id(&self) -> &SourceId {
        &self.id
    }

    async fn connect(&mut self) -> Result<(), SourceError> {
        let batches = self.batches.read().await.clone();
        let ctx = self.build_context(batches).await?;

        let mut ctx_guard = self.ctx.write().await;
        *ctx_guard = Some(ctx);

        let mut connected = self.connected.write().await;
        *connected = true;

        Ok(())
    }

    async fn disconnect(&mut self) -> Result<(), SourceError> {
        let mut ctx_guard = self.ctx.write().await;
        *ctx_guard = None;

        let mut connected = self.connected.write().await;
        *connected = false;

        Ok(())
    }

    async fn query(&self, query: &str) -> Result<RecordBatch, SourceError> {
        let ctx_guard = self.ctx.read().await;
        let ctx = ctx_guard.as_ref().ok_or_else(|| SourceError::QueryFailed {
            source_id: self.id.clone(),
            message: "Not connected".to_string(),
        })?;

        // Execute SQL
        let df = ctx.sql(query).await.map_err(|e| SourceError::QueryFailed {
            source_id: self.id.clone(),
            message: format!("SQL error: {}", e),
        })?;

        // Get schema before collecting (collect consumes df)
        let result_schema = df.schema().inner().clone();

        // Collect results
        let batches = df.collect().await.map_err(|e| SourceError::QueryFailed {
            source_id: self.id.clone(),
            message: format!("Execution error: {}", e),
        })?;

        // Merge into single batch
        if batches.is_empty() {
            // Return empty batch with correct schema
            return Ok(RecordBatch::new_empty(result_schema));
        }

        // Concatenate all batches
        let schema = batches[0].schema();
        arrow::compute::concat_batches(&schema, &batches)
            .map_err(|e| SourceError::QueryFailed {
                source_id: self.id.clone(),
                message: format!("Failed to concat batches: {}", e),
            })
    }

    async fn schema(&self) -> Result<SchemaRef, SourceError> {
        Ok(self.schema.clone())
    }

    async fn subscribe(
        &self,
        _callback: Box<dyn Fn(RecordBatch) + Send + Sync>,
    ) -> Result<SubscriptionHandle, SourceError> {
        // MemoryAdapter doesn't support streaming subscriptions
        Err(SourceError::UnsupportedOperation {
            source_id: self.id.clone(),
            operation: "subscribe".to_string(),
        })
    }
}

// Implement Send + Sync for the adapter (required by trait bounds)
unsafe impl Send for MemoryAdapter {}
unsafe impl Sync for MemoryAdapter {}

#[cfg(test)]
mod tests {
    use super::*;
    use arrow::array::{Int32Array, StringArray};
    use arrow::datatypes::{DataType, Field, Schema};

    fn make_test_batch() -> RecordBatch {
        let schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Int32, false),
            Field::new("name", DataType::Utf8, true),
        ]));

        RecordBatch::try_new(
            schema,
            vec![
                Arc::new(Int32Array::from(vec![1, 2, 3])),
                Arc::new(StringArray::from(vec![Some("alice"), Some("bob"), None])),
            ],
        ).unwrap()
    }

    #[tokio::test]
    async fn test_memory_adapter_creation() {
        let batch = make_test_batch();
        let adapter = MemoryAdapter::new(SourceId::new("test"), vec![batch]);

        assert_eq!(adapter.id().as_str(), "test");
        assert_eq!(adapter.kind(), SourceKind::Cache);
        assert_eq!(adapter.batch_count().await, 1);
        assert_eq!(adapter.row_count().await, 3);
    }

    #[tokio::test]
    async fn test_memory_adapter_connect_query() {
        let batch = make_test_batch();
        let mut adapter = MemoryAdapter::new(SourceId::new("test"), vec![batch]);

        // Connect
        adapter.connect().await.unwrap();

        // Query all data
        let result = adapter.query("SELECT * FROM data").await.unwrap();
        assert_eq!(result.num_rows(), 3);
        assert_eq!(result.num_columns(), 2);

        // Query with filter
        let result = adapter.query("SELECT id FROM data WHERE id > 1").await.unwrap();
        assert_eq!(result.num_rows(), 2);

        // Query with aggregation
        let result = adapter.query("SELECT COUNT(*) as cnt FROM data").await.unwrap();
        assert_eq!(result.num_rows(), 1);
    }

    #[tokio::test]
    async fn test_memory_adapter_append() {
        let batch1 = make_test_batch();
        let batch2 = make_test_batch();

        let adapter = MemoryAdapter::new(SourceId::new("test"), vec![batch1]);
        assert_eq!(adapter.row_count().await, 3);

        adapter.append(batch2).await.unwrap();
        assert_eq!(adapter.row_count().await, 6);
        assert_eq!(adapter.batch_count().await, 2);
    }

    #[tokio::test]
    async fn test_memory_adapter_schema() {
        let batch = make_test_batch();
        let adapter = MemoryAdapter::new(SourceId::new("test"), vec![batch]);

        let schema = adapter.schema().await.unwrap();
        assert_eq!(schema.fields().len(), 2);
        assert_eq!(schema.field(0).name(), "id");
        assert_eq!(schema.field(1).name(), "name");
    }

    #[tokio::test]
    async fn test_memory_adapter_disconnect() {
        let batch = make_test_batch();
        let mut adapter = MemoryAdapter::new(SourceId::new("test"), vec![batch]);

        adapter.connect().await.unwrap();
        adapter.disconnect().await.unwrap();

        // Query should fail after disconnect
        let result = adapter.query("SELECT * FROM data").await;
        assert!(result.is_err());
    }
}
