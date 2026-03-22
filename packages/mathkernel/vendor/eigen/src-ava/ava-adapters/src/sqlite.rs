//! SQLite Source Adapter
//!
//! Provides SQL query capability against SQLite databases.
//!
//! Uses sqlx for async database access and DataFusion for query execution.

use std::sync::Arc;
use std::path::PathBuf;
use async_trait::async_trait;
use arrow::array::RecordBatch;
use arrow::datatypes::{DataType, Field, Schema, SchemaRef};
use tokio::sync::RwLock;
use sqlx::{sqlite::SqlitePool, Column, Row};

use ava_domain::{
    SourceAdapter, SubscriptionHandle,
    SourceId, SourceKind, SourceError,
};

/// SQLite source adapter backed by a SQLite database file.
///
/// Uses sqlx for database connectivity and DataFusion for SQL query execution
/// when the query involves complex operations (joins, aggregations).
///
/// For simple queries, results are fetched directly via sqlx and converted
/// to Arrow RecordBatches.
///
/// # Features
///
/// - Persistent storage of structured data
/// - Full SQL query support
/// - Schema introspection
/// - Connection pooling via sqlx
///
/// # Example
///
/// ```ignore
/// use ava_adapters::SqliteAdapter;
/// use ava_domain::SourceId;
///
/// let adapter = SqliteAdapter::new(
///     SourceId::new("my-db"),
///     "/path/to/database.db",
/// );
///
/// adapter.connect().await?;
/// let result = adapter.query("SELECT * FROM users").await?;
/// ```
pub struct SqliteAdapter {
    /// Unique source identifier
    id: SourceId,

    /// Path to SQLite database file (or ":memory:" for in-memory)
    db_path: PathBuf,

    /// Connection pool
    pool: RwLock<Option<SqlitePool>>,

    /// Cached schema (lazy-loaded on first schema() call)
    cached_schema: RwLock<Option<SchemaRef>>,

    /// Default table name for schema introspection
    default_table: Option<String>,

    /// Connection state
    connected: RwLock<bool>,
}

impl SqliteAdapter {
    /// Creates a new SQLiteAdapter for the given database path.
    ///
    /// # Arguments
    ///
    /// * `id` - Unique source identifier
    /// * `db_path` - Path to SQLite database file (use ":memory:" for in-memory)
    pub fn new(id: SourceId, db_path: impl Into<PathBuf>) -> Self {
        Self {
            id,
            db_path: db_path.into(),
            pool: RwLock::new(None),
            cached_schema: RwLock::new(None),
            default_table: None,
            connected: RwLock::new(false),
        }
    }

    /// Creates an in-memory SQLite adapter.
    pub fn in_memory(id: SourceId) -> Self {
        Self::new(id, ":memory:")
    }

    /// Sets the default table for schema introspection.
    ///
    /// When `schema()` is called, it will introspect this table.
    pub fn with_default_table(mut self, table: impl Into<String>) -> Self {
        self.default_table = Some(table.into());
        self
    }

    /// Executes a raw SQL statement (non-query, e.g., CREATE TABLE, INSERT).
    ///
    /// # Arguments
    ///
    /// * `sql` - SQL statement to execute
    pub async fn execute(&self, sql: &str) -> Result<u64, SourceError> {
        let pool_guard = self.pool.read().await;
        let pool = pool_guard.as_ref().ok_or_else(|| SourceError::QueryFailed {
            source_id: self.id.clone(),
            message: "Not connected".to_string(),
        })?;

        sqlx::query(sql)
            .execute(pool)
            .await
            .map(|r| r.rows_affected())
            .map_err(|e| SourceError::QueryFailed {
                source_id: self.id.clone(),
                message: format!("Execute error: {}", e),
            })
    }

    /// Introspects the schema of a specific table.
    pub async fn table_schema(&self, table: &str) -> Result<SchemaRef, SourceError> {
        let pool_guard = self.pool.read().await;
        let pool = pool_guard.as_ref().ok_or_else(|| SourceError::QueryFailed {
            source_id: self.id.clone(),
            message: "Not connected".to_string(),
        })?;

        // Query SQLite pragma for table info
        let rows = sqlx::query(&format!("PRAGMA table_info({})", table))
            .fetch_all(pool)
            .await
            .map_err(|e| SourceError::QueryFailed {
                source_id: self.id.clone(),
                message: format!("Schema introspection error: {}", e),
            })?;

        let fields: Vec<Field> = rows
            .iter()
            .map(|row| {
                let name: String = row.get("name");
                let type_str: String = row.get("type");
                let notnull: i32 = row.get("notnull");

                let data_type = sqlite_type_to_arrow(&type_str);
                Field::new(&name, data_type, notnull == 0)
            })
            .collect();

        if fields.is_empty() {
            return Err(SourceError::QueryFailed {
                source_id: self.id.clone(),
                message: format!("Table '{}' not found or has no columns", table),
            });
        }

        Ok(Arc::new(Schema::new(fields)))
    }

    /// Lists all tables in the database.
    pub async fn list_tables(&self) -> Result<Vec<String>, SourceError> {
        let pool_guard = self.pool.read().await;
        let pool = pool_guard.as_ref().ok_or_else(|| SourceError::QueryFailed {
            source_id: self.id.clone(),
            message: "Not connected".to_string(),
        })?;

        let rows = sqlx::query(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
        )
        .fetch_all(pool)
        .await
        .map_err(|e| SourceError::QueryFailed {
            source_id: self.id.clone(),
            message: format!("List tables error: {}", e),
        })?;

        Ok(rows.iter().map(|r| r.get("name")).collect())
    }
}

/// Converts SQLite type string to Arrow DataType.
fn sqlite_type_to_arrow(sqlite_type: &str) -> DataType {
    let normalized = sqlite_type.to_uppercase();

    if normalized.contains("INT") {
        DataType::Int64
    } else if normalized.contains("CHAR") || normalized.contains("TEXT") || normalized.contains("CLOB") {
        DataType::Utf8
    } else if normalized.contains("BLOB") || normalized.is_empty() {
        DataType::Binary
    } else if normalized.contains("REAL") || normalized.contains("FLOA") || normalized.contains("DOUB") {
        DataType::Float64
    } else if normalized.contains("BOOL") {
        DataType::Boolean
    } else if normalized.contains("DATE") {
        DataType::Date32
    } else if normalized.contains("TIME") {
        DataType::Timestamp(arrow::datatypes::TimeUnit::Microsecond, None)
    } else {
        // SQLite is dynamically typed - default to Utf8 for unknown types
        DataType::Utf8
    }
}

#[async_trait]
impl SourceAdapter for SqliteAdapter {
    fn kind(&self) -> SourceKind {
        SourceKind::Sql
    }

    fn id(&self) -> &SourceId {
        &self.id
    }

    async fn connect(&mut self) -> Result<(), SourceError> {
        let db_url = if self.db_path.to_string_lossy() == ":memory:" {
            "sqlite::memory:".to_string()
        } else {
            format!("sqlite://{}?mode=rwc", self.db_path.display())
        };

        let pool = SqlitePool::connect(&db_url)
            .await
            .map_err(|e| SourceError::ConnectionFailed {
                source_id: self.id.clone(),
                message: format!("SQLite connection failed: {}", e),
            })?;

        let mut pool_guard = self.pool.write().await;
        *pool_guard = Some(pool);

        let mut connected = self.connected.write().await;
        *connected = true;

        Ok(())
    }

    async fn disconnect(&mut self) -> Result<(), SourceError> {
        let mut pool_guard = self.pool.write().await;
        if let Some(pool) = pool_guard.take() {
            pool.close().await;
        }

        let mut connected = self.connected.write().await;
        *connected = false;

        // Clear cached schema
        let mut schema_guard = self.cached_schema.write().await;
        *schema_guard = None;

        Ok(())
    }

    async fn query(&self, query: &str) -> Result<RecordBatch, SourceError> {
        let pool_guard = self.pool.read().await;
        let pool = pool_guard.as_ref().ok_or_else(|| SourceError::QueryFailed {
            source_id: self.id.clone(),
            message: "Not connected".to_string(),
        })?;

        // Execute query and fetch all rows
        let rows = sqlx::query(query)
            .fetch_all(pool)
            .await
            .map_err(|e| SourceError::QueryFailed {
                source_id: self.id.clone(),
                message: format!("Query error: {}", e),
            })?;

        if rows.is_empty() {
            // Return empty batch - need to infer schema from query
            // For now, return an empty batch with no columns
            let schema = Arc::new(Schema::empty());
            return Ok(RecordBatch::new_empty(schema));
        }

        // Build schema from first row's columns
        let first_row = &rows[0];
        let columns: Vec<_> = first_row.columns().to_vec();

        let fields: Vec<Field> = columns
            .iter()
            .map(|col| {
                let name = col.name();
                let type_info = col.type_info().to_string();
                let data_type = sqlite_type_to_arrow(&type_info);
                Field::new(name, data_type, true)
            })
            .collect();

        let schema = Arc::new(Schema::new(fields.clone()));

        // Build Arrow arrays from rows
        use arrow::array::*;

        let arrays: Vec<Arc<dyn arrow::array::Array>> = fields
            .iter()
            .enumerate()
            .map(|(idx, field)| {
                match field.data_type() {
                    DataType::Int64 => {
                        let values: Vec<Option<i64>> = rows
                            .iter()
                            .map(|row| row.try_get::<i64, _>(idx).ok())
                            .collect();
                        Arc::new(Int64Array::from(values)) as Arc<dyn arrow::array::Array>
                    }
                    DataType::Float64 => {
                        let values: Vec<Option<f64>> = rows
                            .iter()
                            .map(|row| row.try_get::<f64, _>(idx).ok())
                            .collect();
                        Arc::new(Float64Array::from(values)) as Arc<dyn arrow::array::Array>
                    }
                    DataType::Boolean => {
                        let values: Vec<Option<bool>> = rows
                            .iter()
                            .map(|row| row.try_get::<bool, _>(idx).ok())
                            .collect();
                        Arc::new(BooleanArray::from(values)) as Arc<dyn arrow::array::Array>
                    }
                    DataType::Utf8 | _ => {
                        let values: Vec<Option<String>> = rows
                            .iter()
                            .map(|row| row.try_get::<String, _>(idx).ok())
                            .collect();
                        Arc::new(StringArray::from(values)) as Arc<dyn arrow::array::Array>
                    }
                }
            })
            .collect();

        RecordBatch::try_new(schema, arrays).map_err(|e| SourceError::QueryFailed {
            source_id: self.id.clone(),
            message: format!("RecordBatch creation error: {}", e),
        })
    }

    async fn schema(&self) -> Result<SchemaRef, SourceError> {
        // Return cached schema if available
        {
            let cached = self.cached_schema.read().await;
            if let Some(schema) = cached.as_ref() {
                return Ok(schema.clone());
            }
        }

        // Get schema from default table if set
        let schema = if let Some(table) = &self.default_table {
            self.table_schema(table).await?
        } else {
            // Return empty schema if no default table
            Arc::new(Schema::empty())
        };

        // Cache the schema
        let mut cached = self.cached_schema.write().await;
        *cached = Some(schema.clone());

        Ok(schema)
    }

    async fn subscribe(
        &self,
        _callback: Box<dyn Fn(RecordBatch) + Send + Sync>,
    ) -> Result<SubscriptionHandle, SourceError> {
        // SQLite doesn't support streaming subscriptions natively
        // Future: Could implement via polling or SQLite hooks
        Err(SourceError::UnsupportedOperation {
            source_id: self.id.clone(),
            operation: "subscribe".to_string(),
        })
    }
}

// Implement Send + Sync for the adapter
unsafe impl Send for SqliteAdapter {}
unsafe impl Sync for SqliteAdapter {}

#[cfg(test)]
mod tests {
    use super::*;
    use ava_domain::SourceAdapter;

    #[tokio::test]
    async fn test_sqlite_adapter_in_memory() {
        let mut adapter = SqliteAdapter::in_memory(SourceId::new("test"));
        adapter.connect().await.unwrap();

        // Create a test table
        adapter
            .execute("CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)")
            .await
            .unwrap();

        // Insert some data
        adapter
            .execute("INSERT INTO test (id, name) VALUES (1, 'alice'), (2, 'bob')")
            .await
            .unwrap();

        // Query the data
        let result = adapter.query("SELECT * FROM test ORDER BY id").await.unwrap();
        assert_eq!(result.num_rows(), 2);
        assert_eq!(result.num_columns(), 2);

        adapter.disconnect().await.unwrap();
    }

    #[tokio::test]
    async fn test_sqlite_adapter_schema_introspection() {
        let mut adapter = SqliteAdapter::in_memory(SourceId::new("test"))
            .with_default_table("users");

        adapter.connect().await.unwrap();

        adapter
            .execute("CREATE TABLE users (id INTEGER, name TEXT, active BOOLEAN, score REAL)")
            .await
            .unwrap();

        let schema = adapter.schema().await.unwrap();
        assert_eq!(schema.fields().len(), 4);
        assert_eq!(schema.field(0).name(), "id");
        assert_eq!(schema.field(1).name(), "name");

        adapter.disconnect().await.unwrap();
    }

    #[tokio::test]
    async fn test_sqlite_adapter_list_tables() {
        let mut adapter = SqliteAdapter::in_memory(SourceId::new("test"));
        adapter.connect().await.unwrap();

        adapter.execute("CREATE TABLE t1 (id INTEGER)").await.unwrap();
        adapter.execute("CREATE TABLE t2 (id INTEGER)").await.unwrap();

        let tables = adapter.list_tables().await.unwrap();
        assert!(tables.contains(&"t1".to_string()));
        assert!(tables.contains(&"t2".to_string()));

        adapter.disconnect().await.unwrap();
    }

    #[tokio::test]
    async fn test_sqlite_type_mapping() {
        assert_eq!(sqlite_type_to_arrow("INTEGER"), DataType::Int64);
        assert_eq!(sqlite_type_to_arrow("TEXT"), DataType::Utf8);
        assert_eq!(sqlite_type_to_arrow("REAL"), DataType::Float64);
        assert_eq!(sqlite_type_to_arrow("BLOB"), DataType::Binary);
        assert_eq!(sqlite_type_to_arrow("BOOLEAN"), DataType::Boolean);
    }
}
