//! Discovery Types
//!
//! Types for discovering and describing data sources, schemas, and capabilities.
//! These types enable the UI to:
//! - Enumerate available data sources
//! - Introspect source schemas (tables, columns, types)
//! - Understand what operations each source supports
//!
//! # Design
//!
//! All types are serializable for wire transport (JSON/Protobuf).
//! `#[typeshare]` annotations generate TypeScript types.

use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use crate::ids::SourceId;
use crate::channels::SourceKind;

// ============================================================================
// SourceDescriptor - Complete description of a data source
// ============================================================================

/// Complete description of a data source for UI discovery.
///
/// This is the primary type returned by the discovery service. It contains
/// everything the UI needs to know about a source: identity, schema,
/// capabilities, and metadata.
///
/// # Example JSON
///
/// ```json
/// {
///   "id": "assets-db",
///   "name": "Asset Database",
///   "description": "Primary asset tracking database",
///   "kind": "sql",
///   "connected": true,
///   "schema": {
///     "tables": [{ "name": "assets", "columns": [...] }],
///     "defaultTable": "assets"
///   },
///   "capabilities": {
///     "sqlQuery": true,
///     "filtering": true,
///     "aggregation": true,
///     ...
///   },
///   "tags": { "env": "production", "team": "data" }
/// }
/// ```
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceDescriptor {
    /// Unique source identifier
    pub id: SourceId,

    /// Human-readable name
    pub name: String,

    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    /// Source type (Sql, Stream, Api, etc.)
    pub kind: SourceKind,

    /// Connection status
    pub connected: bool,

    /// Schema information (tables and columns)
    pub schema: SourceSchema,

    /// What operations this source supports
    pub capabilities: SourceCapabilities,

    /// Metadata tags for filtering/categorization
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub tags: HashMap<String, String>,
}

impl SourceDescriptor {
    /// Creates a new source descriptor with minimal required fields.
    pub fn new(
        id: impl Into<SourceId>,
        name: impl Into<String>,
        kind: SourceKind,
        schema: SourceSchema,
        capabilities: SourceCapabilities,
    ) -> Self {
        Self {
            id: id.into(),
            name: name.into(),
            description: None,
            kind,
            connected: false,
            schema,
            capabilities,
            tags: HashMap::new(),
        }
    }

    /// Builder: set description
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    /// Builder: mark as connected
    pub fn connected(mut self) -> Self {
        self.connected = true;
        self
    }

    /// Builder: add a tag
    pub fn with_tag(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.tags.insert(key.into(), value.into());
        self
    }
}

// ============================================================================
// SourceSchema - Schema information for a source
// ============================================================================

/// Schema information for a data source.
///
/// Sources can have multiple tables/collections. For single-table sources
/// (e.g., a Kafka topic), use `default_table` to indicate the primary table.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSchema {
    /// Available tables/collections
    pub tables: Vec<TableSchema>,

    /// Default table for single-table sources
    #[serde(skip_serializing_if = "Option::is_none")]
    pub default_table: Option<String>,
}

impl SourceSchema {
    /// Creates an empty schema
    pub fn empty() -> Self {
        Self {
            tables: Vec::new(),
            default_table: None,
        }
    }

    /// Creates a schema with a single table (common case)
    pub fn single_table(table: TableSchema) -> Self {
        let default = table.name.clone();
        Self {
            tables: vec![table],
            default_table: Some(default),
        }
    }

    /// Creates a schema with multiple tables
    pub fn with_tables(tables: impl IntoIterator<Item = TableSchema>) -> Self {
        Self {
            tables: tables.into_iter().collect(),
            default_table: None,
        }
    }

    /// Returns the default table, or the first table if no default
    pub fn primary_table(&self) -> Option<&TableSchema> {
        if let Some(ref name) = self.default_table {
            self.tables.iter().find(|t| &t.name == name)
        } else {
            self.tables.first()
        }
    }

    /// Finds a table by name
    pub fn table(&self, name: &str) -> Option<&TableSchema> {
        self.tables.iter().find(|t| t.name == name)
    }
}

impl Default for SourceSchema {
    fn default() -> Self {
        Self::empty()
    }
}

// ============================================================================
// TableSchema - Schema for a single table
// ============================================================================

/// Schema for a single table/collection within a source.
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableSchema {
    /// Table name
    pub name: String,

    /// Column definitions
    pub columns: Vec<ColumnDescriptor>,
}

impl TableSchema {
    /// Creates a new table schema
    pub fn new(name: impl Into<String>, columns: impl IntoIterator<Item = ColumnDescriptor>) -> Self {
        Self {
            name: name.into(),
            columns: columns.into_iter().collect(),
        }
    }

    /// Finds a column by name
    pub fn column(&self, name: &str) -> Option<&ColumnDescriptor> {
        self.columns.iter().find(|c| c.name == name)
    }

    /// Returns all column names
    pub fn column_names(&self) -> Vec<&str> {
        self.columns.iter().map(|c| c.name.as_str()).collect()
    }

    /// Returns true if the table has a column with the given name
    pub fn has_column(&self, name: &str) -> bool {
        self.columns.iter().any(|c| c.name == name)
    }
}

// ============================================================================
// ColumnDescriptor - Describes a single column
// ============================================================================

/// Describes a single column in a table.
///
/// The `data_type` field uses Arrow type names for consistency with
/// the query engine (DataFusion).
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ColumnDescriptor {
    /// Column name
    pub name: String,

    /// Arrow data type as string (e.g., "Utf8", "Int64", "Float64", "Timestamp")
    pub data_type: String,

    /// Whether the column can contain null values
    pub nullable: bool,

    /// Optional description/documentation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
}

impl ColumnDescriptor {
    /// Creates a new column descriptor
    pub fn new(name: impl Into<String>, data_type: impl Into<String>, nullable: bool) -> Self {
        Self {
            name: name.into(),
            data_type: data_type.into(),
            nullable,
            description: None,
        }
    }

    /// Creates a non-nullable column
    pub fn required(name: impl Into<String>, data_type: impl Into<String>) -> Self {
        Self::new(name, data_type, false)
    }

    /// Creates a nullable column
    pub fn optional(name: impl Into<String>, data_type: impl Into<String>) -> Self {
        Self::new(name, data_type, true)
    }

    /// Builder: add description
    pub fn with_description(mut self, description: impl Into<String>) -> Self {
        self.description = Some(description.into());
        self
    }

    // Common type constructors

    /// Creates a UTF-8 string column
    pub fn string(name: impl Into<String>, nullable: bool) -> Self {
        Self::new(name, "Utf8", nullable)
    }

    /// Creates an Int64 column
    pub fn int64(name: impl Into<String>, nullable: bool) -> Self {
        Self::new(name, "Int64", nullable)
    }

    /// Creates a Float64 column
    pub fn float64(name: impl Into<String>, nullable: bool) -> Self {
        Self::new(name, "Float64", nullable)
    }

    /// Creates a Boolean column
    pub fn boolean(name: impl Into<String>, nullable: bool) -> Self {
        Self::new(name, "Boolean", nullable)
    }

    /// Creates a Timestamp column (microseconds, UTC)
    pub fn timestamp(name: impl Into<String>, nullable: bool) -> Self {
        Self::new(name, "Timestamp(Microsecond, Some(\"UTC\"))", nullable)
    }
}

// ============================================================================
// SourceCapabilities - What operations a source supports
// ============================================================================

/// Capabilities of a data source.
///
/// These flags tell the UI what operations can be performed on the source,
/// enabling it to:
/// - Show/hide UI elements based on capabilities
/// - Validate pipelines before submission
/// - Provide meaningful error messages
///
/// # Example
///
/// A streaming source might have:
/// ```ignore
/// SourceCapabilities {
///     sql_query: false,      // Can't run arbitrary SQL
///     filtering: true,       // Can filter messages
///     projection: true,      // Can select fields
///     aggregation: false,    // No windowed aggregation (yet)
///     streaming: true,       // Supports subscriptions
///     ..
/// }
/// ```
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceCapabilities {
    /// Supports arbitrary SQL queries
    pub sql_query: bool,

    /// Supports filtering (WHERE clause)
    pub filtering: bool,

    /// Supports projection (SELECT specific columns)
    pub projection: bool,

    /// Supports aggregation (GROUP BY, SUM, AVG, etc.)
    pub aggregation: bool,

    /// Supports joins with other sources
    pub joins: bool,

    /// Supports window functions (ROW_NUMBER, LAG, etc.)
    pub window_functions: bool,

    /// Supports streaming subscriptions
    pub streaming: bool,

    /// Supports write operations (INSERT, UPDATE, DELETE)
    pub writable: bool,

    /// Maximum rows per query (if limited)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_rows: Option<u64>,
}

impl SourceCapabilities {
    /// No capabilities (useful for unknown/disconnected sources)
    pub fn none() -> Self {
        Self {
            sql_query: false,
            filtering: false,
            projection: false,
            aggregation: false,
            joins: false,
            window_functions: false,
            streaming: false,
            writable: false,
            max_rows: None,
        }
    }

    /// Full SQL capabilities (MemoryAdapter, SqliteAdapter, PostgresAdapter)
    pub fn full_sql() -> Self {
        Self {
            sql_query: true,
            filtering: true,
            projection: true,
            aggregation: true,
            joins: true,
            window_functions: true,
            streaming: false,
            writable: false,
            max_rows: None,
        }
    }

    /// Full SQL capabilities with write support
    pub fn full_sql_writable() -> Self {
        Self {
            writable: true,
            ..Self::full_sql()
        }
    }

    /// Stream source capabilities (Kafka, WebSocket, etc.)
    pub fn streaming() -> Self {
        Self {
            sql_query: false,
            filtering: true,
            projection: true,
            aggregation: false,
            joins: false,
            window_functions: false,
            streaming: true,
            writable: false,
            max_rows: None,
        }
    }

    /// API source capabilities (REST endpoints, GraphQL)
    pub fn api() -> Self {
        Self {
            sql_query: false,
            filtering: true,
            projection: true,
            aggregation: false,
            joins: false,
            window_functions: false,
            streaming: false,
            writable: false,
            max_rows: Some(1000), // Typical API pagination limit
        }
    }

    /// Builder: set max rows
    pub fn with_max_rows(mut self, max: u64) -> Self {
        self.max_rows = Some(max);
        self
    }

    /// Builder: enable streaming
    pub fn with_streaming(mut self) -> Self {
        self.streaming = true;
        self
    }

    /// Builder: enable writes
    pub fn with_writes(mut self) -> Self {
        self.writable = true;
        self
    }

    /// Checks if an operation is supported
    pub fn supports(&self, op: &str) -> bool {
        match op.to_lowercase().as_str() {
            "filter" | "where" => self.filtering,
            "project" | "select" => self.projection,
            "aggregate" | "group_by" | "sum" | "avg" | "count" => self.aggregation,
            "join" => self.joins,
            "window" | "row_number" | "lag" | "lead" => self.window_functions,
            "subscribe" | "stream" => self.streaming,
            "insert" | "update" | "delete" | "write" => self.writable,
            "sql" | "query" => self.sql_query,
            _ => false,
        }
    }
}

impl Default for SourceCapabilities {
    fn default() -> Self {
        Self::none()
    }
}

// ============================================================================
// Conversion from Arrow Schema
// ============================================================================

impl From<&arrow::datatypes::Schema> for TableSchema {
    fn from(schema: &arrow::datatypes::Schema) -> Self {
        let columns = schema
            .fields()
            .iter()
            .map(|field| ColumnDescriptor {
                name: field.name().clone(),
                data_type: format!("{:?}", field.data_type()),
                nullable: field.is_nullable(),
                description: field.metadata().get("description").cloned(),
            })
            .collect();

        TableSchema {
            name: "data".to_string(), // Default name for schema conversion
            columns,
        }
    }
}

impl From<arrow::datatypes::SchemaRef> for TableSchema {
    fn from(schema: arrow::datatypes::SchemaRef) -> Self {
        TableSchema::from(schema.as_ref())
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_source_descriptor_builder() {
        let schema = SourceSchema::single_table(TableSchema::new(
            "assets",
            vec![
                ColumnDescriptor::string("id", false),
                ColumnDescriptor::string("name", false),
                ColumnDescriptor::float64("value", true),
            ],
        ));

        let desc = SourceDescriptor::new(
            SourceId::new("test-db"),
            "Test Database",
            SourceKind::Sql,
            schema,
            SourceCapabilities::full_sql(),
        )
        .with_description("A test database for unit tests")
        .connected()
        .with_tag("env", "test");

        assert_eq!(desc.id.as_str(), "test-db");
        assert_eq!(desc.name, "Test Database");
        assert!(desc.connected);
        assert_eq!(desc.tags.get("env"), Some(&"test".to_string()));
    }

    #[test]
    fn test_source_schema_primary_table() {
        let schema = SourceSchema::with_tables(vec![
            TableSchema::new("users", vec![ColumnDescriptor::string("id", false)]),
            TableSchema::new("orders", vec![ColumnDescriptor::string("id", false)]),
        ]);

        // No default, returns first
        assert_eq!(schema.primary_table().unwrap().name, "users");

        // With explicit default
        let schema = SourceSchema {
            default_table: Some("orders".to_string()),
            ..schema
        };
        assert_eq!(schema.primary_table().unwrap().name, "orders");
    }

    #[test]
    fn test_table_schema_column_lookup() {
        let table = TableSchema::new(
            "assets",
            vec![
                ColumnDescriptor::string("id", false),
                ColumnDescriptor::string("name", false),
                ColumnDescriptor::float64("value", true),
            ],
        );

        assert!(table.has_column("id"));
        assert!(table.has_column("value"));
        assert!(!table.has_column("nonexistent"));

        let col = table.column("value").unwrap();
        assert_eq!(col.data_type, "Float64");
        assert!(col.nullable);

        assert_eq!(table.column_names(), vec!["id", "name", "value"]);
    }

    #[test]
    fn test_capabilities_supports() {
        let sql = SourceCapabilities::full_sql();
        assert!(sql.supports("filter"));
        assert!(sql.supports("aggregate"));
        assert!(sql.supports("join"));
        assert!(!sql.supports("stream"));

        let stream = SourceCapabilities::streaming();
        assert!(stream.supports("filter"));
        assert!(stream.supports("stream"));
        assert!(!stream.supports("aggregate"));
        assert!(!stream.supports("join"));
    }

    #[test]
    fn test_source_descriptor_serialization() {
        let schema = SourceSchema::single_table(TableSchema::new(
            "assets",
            vec![
                ColumnDescriptor::string("id", false),
                ColumnDescriptor::float64("value", true),
            ],
        ));

        let desc = SourceDescriptor::new(
            SourceId::new("db"),
            "Database",
            SourceKind::Sql,
            schema,
            SourceCapabilities::full_sql(),
        )
        .connected();

        let json = serde_json::to_string_pretty(&desc).unwrap();
        assert!(json.contains("\"id\": \"db\""));
        assert!(json.contains("\"connected\": true"));
        assert!(json.contains("\"sqlQuery\": true"));

        let parsed: SourceDescriptor = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, desc.id);
        assert_eq!(parsed.capabilities.sql_query, true);
    }

    #[test]
    fn test_from_arrow_schema() {
        use arrow::datatypes::{DataType, Field, Schema};

        let arrow_schema = Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("count", DataType::Int64, true),
        ]);

        let table: TableSchema = (&arrow_schema).into();
        assert_eq!(table.columns.len(), 2);
        assert_eq!(table.column("id").unwrap().data_type, "Utf8");
        assert_eq!(table.column("count").unwrap().nullable, true);
    }
}
