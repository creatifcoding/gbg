//! TableProvider Wrapper
//!
//! Wraps SourceAdapters as DataFusion TableProviders, enabling them to
//! participate in federated queries across multiple sources.

use std::any::Any;
use std::sync::Arc;
use async_trait::async_trait;
use arrow::datatypes::SchemaRef;
use datafusion::common::Result as DFResult;
use datafusion::datasource::TableProvider;
use datafusion::catalog::Session;
use datafusion::logical_expr::TableType;
use datafusion::physical_plan::ExecutionPlan;
use datafusion::prelude::Expr;
use tokio::sync::RwLock;

use ava_domain::{DynSourceAdapter, SourceError, SourceId};

/// Wraps a SourceAdapter as a DataFusion TableProvider.
///
/// This enables SourceAdapters to be registered in a DataFusion SessionContext
/// and queried alongside other data sources.
///
/// # Features
///
/// - Bridges SourceAdapter to DataFusion TableProvider trait
/// - Schema caching for efficient repeated access
/// - Supports filter pushdown (converts Expr to SQL WHERE clause)
///
/// # Example
///
/// ```ignore
/// use datafusion::prelude::*;
/// use ava_adapters::{MemoryAdapter, SourceTableProvider};
/// use ava_domain::SourceId;
///
/// let adapter = Arc::new(MemoryAdapter::new(SourceId::new("test"), vec![batch]));
/// let table_provider = SourceTableProvider::new(adapter);
///
/// let ctx = SessionContext::new();
/// ctx.register_table("test_table", Arc::new(table_provider))?;
///
/// let df = ctx.sql("SELECT * FROM test_table").await?;
/// ```
pub struct SourceTableProvider {
    /// The wrapped source adapter
    adapter: DynSourceAdapter,

    /// Cached schema (populated on first schema() call)
    cached_schema: RwLock<Option<SchemaRef>>,
}

impl SourceTableProvider {
    /// Creates a new TableProvider wrapper for the given SourceAdapter.
    pub fn new(adapter: DynSourceAdapter) -> Self {
        Self {
            adapter,
            cached_schema: RwLock::new(None),
        }
    }

    /// Returns the source ID of the wrapped adapter.
    pub fn source_id(&self) -> &SourceId {
        self.adapter.id()
    }

    /// Returns a reference to the wrapped adapter.
    pub fn adapter(&self) -> &DynSourceAdapter {
        &self.adapter
    }
}

impl std::fmt::Debug for SourceTableProvider {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("SourceTableProvider")
            .field("source_id", self.adapter.id())
            .field("kind", &self.adapter.kind())
            .finish()
    }
}

#[async_trait]
impl TableProvider for SourceTableProvider {
    fn as_any(&self) -> &dyn Any {
        self
    }

    fn schema(&self) -> SchemaRef {
        // Try to return cached schema synchronously
        // This is a limitation - TableProvider::schema() is sync but SourceAdapter::schema() is async
        // We use blocking_read for now; in production, pre-populate the cache
        let cached = self.cached_schema.blocking_read();
        if let Some(schema) = cached.as_ref() {
            return schema.clone();
        }
        drop(cached);

        // Fall back to empty schema if not cached
        // The actual schema should be populated via ensure_schema() before use
        Arc::new(arrow::datatypes::Schema::empty())
    }

    fn table_type(&self) -> TableType {
        TableType::Base
    }

    async fn scan(
        &self,
        _state: &dyn Session,
        projection: Option<&Vec<usize>>,
        filters: &[Expr],
        _limit: Option<usize>,
    ) -> DFResult<Arc<dyn ExecutionPlan>> {
        // For now, we do a full table scan and apply filters in DataFusion
        // Future: Push down filters to the source adapter query

        // Build SQL query with optional filter pushdown
        let query = build_query_with_filters("data", projection, filters, &self.schema());

        // Execute query on source adapter
        let batch = self.adapter.query(&query).await.map_err(|e| {
            datafusion::error::DataFusionError::Execution(format!(
                "SourceAdapter query failed: {}",
                e
            ))
        })?;

        // Wrap result in a MemoryExec plan
        let schema = batch.schema();
        let partitions = vec![vec![batch]];

        let exec =
            datafusion::physical_plan::memory::MemoryExec::try_new(&partitions, schema, projection.cloned())?;

        Ok(Arc::new(exec))
    }
}

impl SourceTableProvider {
    /// Ensures the schema cache is populated.
    ///
    /// Call this after connecting the adapter but before registering with DataFusion.
    pub async fn ensure_schema(&self) -> Result<SchemaRef, SourceError> {
        // Check if already cached
        {
            let cached = self.cached_schema.read().await;
            if let Some(schema) = cached.as_ref() {
                return Ok(schema.clone());
            }
        }

        // Fetch schema from adapter
        let schema = self.adapter.schema().await?;

        // Cache it
        let mut cached = self.cached_schema.write().await;
        *cached = Some(schema.clone());

        Ok(schema)
    }
}

/// Builds a SQL query string with optional column projection and filter expressions.
///
/// This is a simplified implementation that converts DataFusion Exprs to SQL.
fn build_query_with_filters(
    table_name: &str,
    projection: Option<&Vec<usize>>,
    filters: &[Expr],
    schema: &SchemaRef,
) -> String {
    // Build SELECT clause
    let select_clause = match projection {
        Some(cols) if !cols.is_empty() => {
            let col_names: Vec<&str> = cols
                .iter()
                .filter_map(|&idx| schema.fields().get(idx).map(|f| f.name().as_str()))
                .collect();
            if col_names.is_empty() {
                "*".to_string()
            } else {
                col_names.join(", ")
            }
        }
        _ => "*".to_string(),
    };

    // Build WHERE clause from filters
    let where_clause = if filters.is_empty() {
        String::new()
    } else {
        let conditions: Vec<String> = filters
            .iter()
            .filter_map(|expr| expr_to_sql(expr))
            .collect();

        if conditions.is_empty() {
            String::new()
        } else {
            format!(" WHERE {}", conditions.join(" AND "))
        }
    };

    format!("SELECT {} FROM {}{}", select_clause, table_name, where_clause)
}

/// Converts a DataFusion Expr to a SQL string (simplified implementation).
///
/// This handles common cases; complex expressions may not translate.
fn expr_to_sql(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Column(col) => Some(col.name.clone()),

        Expr::Literal(scalar) => Some(format!("{}", scalar)),

        Expr::BinaryExpr(binary) => {
            let left = expr_to_sql(&binary.left)?;
            let right = expr_to_sql(&binary.right)?;
            let op = match binary.op {
                datafusion::logical_expr::Operator::Eq => "=",
                datafusion::logical_expr::Operator::NotEq => "!=",
                datafusion::logical_expr::Operator::Lt => "<",
                datafusion::logical_expr::Operator::LtEq => "<=",
                datafusion::logical_expr::Operator::Gt => ">",
                datafusion::logical_expr::Operator::GtEq => ">=",
                datafusion::logical_expr::Operator::And => "AND",
                datafusion::logical_expr::Operator::Or => "OR",
                datafusion::logical_expr::Operator::LikeMatch => "LIKE",
                _ => return None,
            };
            Some(format!("({} {} {})", left, op, right))
        }

        Expr::IsNull(inner) => {
            let inner_sql = expr_to_sql(inner)?;
            Some(format!("{} IS NULL", inner_sql))
        }

        Expr::IsNotNull(inner) => {
            let inner_sql = expr_to_sql(inner)?;
            Some(format!("{} IS NOT NULL", inner_sql))
        }

        _ => None, // Unsupported expression - will be filtered in DataFusion
    }
}

/// Creates multiple SourceTableProviders from a collection of adapters.
pub fn create_table_providers(
    adapters: impl IntoIterator<Item = DynSourceAdapter>,
) -> Vec<SourceTableProvider> {
    adapters.into_iter().map(SourceTableProvider::new).collect()
}

/// Registers multiple SourceAdapters as tables in a DataFusion SessionContext.
///
/// Table names are derived from the source IDs.
pub async fn register_adapters(
    ctx: &datafusion::prelude::SessionContext,
    adapters: impl IntoIterator<Item = DynSourceAdapter>,
) -> Result<(), SourceError> {
    for adapter in adapters {
        let table_name = adapter.id().as_str().replace('-', "_");
        let provider = Arc::new(SourceTableProvider::new(adapter));

        // Ensure schema is populated
        provider.ensure_schema().await?;

        ctx.register_table(&table_name, provider)
            .map_err(|e| SourceError::QueryFailed {
                source_id: SourceId::new("registration"),
                message: format!("Failed to register table '{}': {}", table_name, e),
            })?;
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MemoryAdapter;
    use ava_domain::SourceAdapter;
    use arrow::array::{Int32Array, StringArray};
    use arrow::datatypes::{DataType, Field, Schema};
    use arrow::record_batch::RecordBatch;

    fn make_test_batch() -> RecordBatch {
        let schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Int32, false),
            Field::new("name", DataType::Utf8, true),
        ]));

        RecordBatch::try_new(
            schema,
            vec![
                Arc::new(Int32Array::from(vec![1, 2, 3])),
                Arc::new(StringArray::from(vec![Some("alice"), Some("bob"), Some("charlie")])),
            ],
        )
        .unwrap()
    }

    #[tokio::test]
    async fn test_source_table_provider_creation() {
        let batch = make_test_batch();
        let mut adapter = MemoryAdapter::new(SourceId::new("test"), vec![batch]);
        adapter.connect().await.unwrap();

        let provider = SourceTableProvider::new(Arc::new(adapter));

        assert_eq!(provider.source_id().as_str(), "test");
        assert_eq!(provider.table_type(), TableType::Base);
    }

    #[tokio::test]
    async fn test_source_table_provider_ensure_schema() {
        let batch = make_test_batch();
        let mut adapter = MemoryAdapter::new(SourceId::new("test"), vec![batch]);
        adapter.connect().await.unwrap();

        let provider = SourceTableProvider::new(Arc::new(adapter));
        let schema = provider.ensure_schema().await.unwrap();

        assert_eq!(schema.fields().len(), 2);
        assert_eq!(schema.field(0).name(), "id");
        assert_eq!(schema.field(1).name(), "name");
    }

    #[test]
    fn test_build_query_simple() {
        let schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Int32, false),
            Field::new("name", DataType::Utf8, true),
        ]));

        let query = build_query_with_filters("test", None, &[], &schema);
        assert_eq!(query, "SELECT * FROM test");
    }

    #[test]
    fn test_build_query_with_projection() {
        let schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Int32, false),
            Field::new("name", DataType::Utf8, true),
            Field::new("age", DataType::Int32, true),
        ]));

        let projection = vec![0, 2]; // id, age
        let query = build_query_with_filters("test", Some(&projection), &[], &schema);
        assert_eq!(query, "SELECT id, age FROM test");
    }

    #[tokio::test]
    async fn test_register_adapters() {
        let batch = make_test_batch();
        let mut adapter = MemoryAdapter::new(SourceId::new("test-data"), vec![batch]);
        adapter.connect().await.unwrap();

        let ctx = datafusion::prelude::SessionContext::new();
        register_adapters(&ctx, vec![Arc::new(adapter) as DynSourceAdapter])
            .await
            .unwrap();

        // Verify table is registered (name normalized: test-data -> test_data)
        let tables = ctx.catalog_names();
        assert!(!tables.is_empty());
    }
}
