//! AVA Channel Pipeline Compiler
//!
//! Compiles ChannelPipelineSpec into executable DataFusion plans.
//!
//! # Architecture
//!
//! ```text
//! ChannelPipelineSpec
//!         │
//!         ▼
//!    ViewCompiler
//!         │
//!    ┌────┴────┐
//!    │         │
//!    ▼         ▼
//! LogicalPlan  SQL String
//!    │
//!    ▼
//! DataFrame
//!    │
//!    ▼
//! RecordBatch (results)
//! ```
//!
//! # Usage
//!
//! ```ignore
//! use ava_compiler::{ViewCompiler, CompiledView};
//! use ava_domain::{ChannelPipelineSpec, PipelineOperator};
//!
//! let compiler = ViewCompiler::new("assets");
//! let compiled = compiler.compile(&spec)?;
//!
//! // Get generated SQL
//! println!("SQL: {}", compiled.sql);
//!
//! // Or execute directly against a SessionContext
//! let df = compiler.compile_to_dataframe(&ctx, &spec).await?;
//! ```

pub mod compiler;
pub mod error;

// Re-exports
pub use compiler::{ViewCompiler, CompiledView};
pub use error::CompilerError;

use std::sync::Arc;
use arrow::array::{StringArray, Float64Array, RecordBatch};
use arrow::datatypes::{DataType, Field, Schema};
use datafusion::prelude::*;
use datafusion::datasource::MemTable;

/// Creates a DataFusion SessionContext with default configuration
pub fn create_session() -> SessionContext {
    SessionContext::new()
}

/// Creates an in-memory table from Arrow arrays
pub fn create_mem_table(
    schema: Arc<Schema>,
    batches: Vec<RecordBatch>,
) -> Result<Arc<MemTable>, datafusion::error::DataFusionError> {
    MemTable::try_new(schema, vec![batches]).map(Arc::new)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// E4: DataFusion in-memory query spike
    /// Proves: SessionContext + MemTable + SQL query → RecordBatch
    #[tokio::test]
    async fn test_datafusion_in_memory_query() {
        // 1. Create schema for "assets" table
        let schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("name", DataType::Utf8, false),
            Field::new("site_id", DataType::Utf8, true),
            Field::new("value", DataType::Float64, true),
        ]));

        // 2. Create test data
        let batch = RecordBatch::try_new(
            schema.clone(),
            vec![
                Arc::new(StringArray::from(vec!["asset-1", "asset-2", "asset-3"])),
                Arc::new(StringArray::from(vec!["Truck A", "Truck B", "Forklift"])),
                Arc::new(StringArray::from(vec![Some("site-1"), Some("site-1"), Some("site-2")])),
                Arc::new(Float64Array::from(vec![100.0, 150.0, 75.0])),
            ],
        ).unwrap();

        // 3. Create SessionContext and register table
        let ctx = create_session();
        let table = create_mem_table(schema, vec![batch]).unwrap();
        ctx.register_table("assets", table).unwrap();

        // 4. Execute SQL query
        let df = ctx.sql("SELECT id, name, value FROM assets WHERE site_id = 'site-1' ORDER BY value DESC").await.unwrap();
        let results: Vec<RecordBatch> = df.collect().await.unwrap();

        // 5. Assert results
        assert_eq!(results.len(), 1);
        let result = &results[0];
        assert_eq!(result.num_rows(), 2); // asset-1 and asset-2

        // Check values
        let ids = result.column(0).as_any().downcast_ref::<StringArray>().unwrap();
        let values = result.column(2).as_any().downcast_ref::<Float64Array>().unwrap();

        // Ordered by value DESC: asset-2 (150.0), asset-1 (100.0)
        assert_eq!(ids.value(0), "asset-2");
        assert_eq!(ids.value(1), "asset-1");
        assert_eq!(values.value(0), 150.0);
        assert_eq!(values.value(1), 100.0);
    }

    /// Test aggregation query
    #[tokio::test]
    async fn test_datafusion_aggregation() {
        let schema = Arc::new(Schema::new(vec![
            Field::new("site_id", DataType::Utf8, false),
            Field::new("value", DataType::Float64, false),
        ]));

        let batch = RecordBatch::try_new(
            schema.clone(),
            vec![
                Arc::new(StringArray::from(vec!["site-1", "site-1", "site-2", "site-2", "site-2"])),
                Arc::new(Float64Array::from(vec![10.0, 20.0, 30.0, 40.0, 50.0])),
            ],
        ).unwrap();

        let ctx = create_session();
        let table = create_mem_table(schema, vec![batch]).unwrap();
        ctx.register_table("metrics", table).unwrap();

        // Aggregate: SUM, AVG, COUNT per site
        let df = ctx.sql("
            SELECT site_id, SUM(value) as total, AVG(value) as avg, COUNT(*) as count
            FROM metrics
            GROUP BY site_id
            ORDER BY site_id
        ").await.unwrap();

        let results: Vec<RecordBatch> = df.collect().await.unwrap();
        assert_eq!(results.len(), 1);
        let result = &results[0];
        assert_eq!(result.num_rows(), 2); // site-1 and site-2

        let sites = result.column(0).as_any().downcast_ref::<StringArray>().unwrap();
        let totals = result.column(1).as_any().downcast_ref::<Float64Array>().unwrap();

        assert_eq!(sites.value(0), "site-1");
        assert_eq!(totals.value(0), 30.0); // 10 + 20
        assert_eq!(sites.value(1), "site-2");
        assert_eq!(totals.value(1), 120.0); // 30 + 40 + 50
    }

    /// Test JOIN query
    #[tokio::test]
    async fn test_datafusion_join() {
        // Assets table
        let assets_schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("name", DataType::Utf8, false),
            Field::new("site_id", DataType::Utf8, false),
        ]));

        let assets_batch = RecordBatch::try_new(
            assets_schema.clone(),
            vec![
                Arc::new(StringArray::from(vec!["a1", "a2"])),
                Arc::new(StringArray::from(vec!["Asset One", "Asset Two"])),
                Arc::new(StringArray::from(vec!["s1", "s2"])),
            ],
        ).unwrap();

        // Sites table
        let sites_schema = Arc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("location", DataType::Utf8, false),
        ]));

        let sites_batch = RecordBatch::try_new(
            sites_schema.clone(),
            vec![
                Arc::new(StringArray::from(vec!["s1", "s2"])),
                Arc::new(StringArray::from(vec!["New York", "Los Angeles"])),
            ],
        ).unwrap();

        let ctx = create_session();
        ctx.register_table("assets", create_mem_table(assets_schema, vec![assets_batch]).unwrap()).unwrap();
        ctx.register_table("sites", create_mem_table(sites_schema, vec![sites_batch]).unwrap()).unwrap();

        // JOIN query
        let df = ctx.sql("
            SELECT a.name, s.location
            FROM assets a
            JOIN sites s ON a.site_id = s.id
            ORDER BY a.name
        ").await.unwrap();

        let results: Vec<RecordBatch> = df.collect().await.unwrap();
        assert_eq!(results.len(), 1);
        let result = &results[0];
        assert_eq!(result.num_rows(), 2);

        let names = result.column(0).as_any().downcast_ref::<StringArray>().unwrap();
        let locations = result.column(1).as_any().downcast_ref::<StringArray>().unwrap();

        assert_eq!(names.value(0), "Asset One");
        assert_eq!(locations.value(0), "New York");
        assert_eq!(names.value(1), "Asset Two");
        assert_eq!(locations.value(1), "Los Angeles");
    }
}
