//! ViewCompiler - Translates ChannelPipelineSpec into executable DataFusion plans
//!
//! The compiler takes a declarative pipeline specification and produces
//! either SQL strings (for debugging/inspection) or DataFusion LogicalPlans.

use std::sync::Arc;
use arrow::datatypes::SchemaRef;
use datafusion::prelude::*;
use datafusion::logical_expr::LogicalPlan;

use ava_domain::{
    ChannelPipelineSpec, PipelineOperator, JoinType as AvaJoinType,
    AggregateExpr, SortColumn, SourceId,
};

use crate::error::CompilerError;

/// Compiled view ready for execution
#[derive(Debug, Clone)]
pub struct CompiledView {
    /// The generated SQL query
    pub sql: String,

    /// Source table name (main source)
    pub main_table: String,

    /// Additional tables referenced (for joins)
    pub referenced_tables: Vec<String>,

    /// Output schema (if available after planning)
    pub output_schema: Option<SchemaRef>,
}

/// Compiles ChannelPipelineSpec into executable form
pub struct ViewCompiler {
    /// Table name to use for the main source
    main_table_name: String,
}

impl ViewCompiler {
    /// Creates a new compiler with the given main table name
    pub fn new(main_table_name: impl Into<String>) -> Self {
        Self {
            main_table_name: main_table_name.into(),
        }
    }

    /// Compiles a ChannelPipelineSpec into a CompiledView
    pub fn compile(&self, spec: &ChannelPipelineSpec) -> Result<CompiledView, CompilerError> {
        let mut sql_parts = SqlBuilder::new(&self.main_table_name);
        let mut referenced_tables = Vec::new();

        // Process pipeline operators in order
        for op in &spec.pipeline {
            match op {
                PipelineOperator::Filter { predicate } => {
                    sql_parts.add_where(predicate);
                }

                PipelineOperator::Project { columns } => {
                    sql_parts.set_select(columns.clone());
                }

                PipelineOperator::Aggregate { group_by, aggregates } => {
                    sql_parts.set_group_by(group_by.clone());
                    sql_parts.add_aggregates(aggregates);
                }

                PipelineOperator::Join { source, left_key, right_key, join_type } => {
                    let table_name = source_id_to_table_name(source);
                    referenced_tables.push(table_name.clone());
                    sql_parts.add_join(&table_name, left_key, right_key, *join_type);
                }

                PipelineOperator::Sort { columns } => {
                    sql_parts.set_order_by(columns);
                }

                PipelineOperator::Limit { count, offset } => {
                    sql_parts.set_limit(*count, *offset);
                }

                PipelineOperator::Window { partition_by, order_by, function } => {
                    sql_parts.add_window(partition_by, order_by, function);
                }
            }
        }

        let sql = sql_parts.build();

        Ok(CompiledView {
            sql,
            main_table: self.main_table_name.clone(),
            referenced_tables,
            output_schema: None,
        })
    }

    /// Compiles and creates a DataFrame from a SessionContext
    pub async fn compile_to_dataframe(
        &self,
        ctx: &SessionContext,
        spec: &ChannelPipelineSpec,
    ) -> Result<DataFrame, CompilerError> {
        let compiled = self.compile(spec)?;

        ctx.sql(&compiled.sql)
            .await
            .map_err(|e| CompilerError::DataFusionError {
                message: format!("Failed to create DataFrame: {}", e),
            })
    }

    /// Compiles to a DataFusion LogicalPlan
    pub async fn compile_to_plan(
        &self,
        ctx: &SessionContext,
        spec: &ChannelPipelineSpec,
    ) -> Result<LogicalPlan, CompilerError> {
        let df = self.compile_to_dataframe(ctx, spec).await?;
        Ok(df.logical_plan().clone())
    }
}

/// Converts a SourceId to a valid SQL table name
fn source_id_to_table_name(source_id: &SourceId) -> String {
    source_id.as_str().replace('-', "_")
}

/// Converts AVA JoinType to SQL JOIN keyword
fn join_type_to_sql(join_type: AvaJoinType) -> &'static str {
    match join_type {
        AvaJoinType::Inner => "INNER JOIN",
        AvaJoinType::Left => "LEFT JOIN",
        AvaJoinType::Right => "RIGHT JOIN",
        AvaJoinType::Full => "FULL OUTER JOIN",
        AvaJoinType::Cross => "CROSS JOIN",
    }
}

/// SQL query builder for pipeline compilation
struct SqlBuilder {
    table: String,
    select: Vec<String>,
    joins: Vec<String>,
    where_clauses: Vec<String>,
    group_by: Vec<String>,
    having: Vec<String>,
    order_by: Vec<String>,
    limit: Option<u32>,
    offset: Option<u32>,
    window_exprs: Vec<String>,
}

impl SqlBuilder {
    fn new(table: &str) -> Self {
        Self {
            table: table.to_string(),
            select: vec!["*".to_string()],
            joins: Vec::new(),
            where_clauses: Vec::new(),
            group_by: Vec::new(),
            having: Vec::new(),
            order_by: Vec::new(),
            limit: None,
            offset: None,
            window_exprs: Vec::new(),
        }
    }

    fn set_select(&mut self, columns: Vec<String>) {
        if !columns.is_empty() {
            self.select = columns;
        }
    }

    fn add_where(&mut self, predicate: &str) {
        self.where_clauses.push(predicate.to_string());
    }

    fn set_group_by(&mut self, columns: Vec<String>) {
        self.group_by = columns;
    }

    fn add_aggregates(&mut self, aggregates: &[AggregateExpr]) {
        // Replace select with group by columns + aggregates
        let mut new_select: Vec<String> = self.group_by.clone();

        for agg in aggregates {
            let expr = format!("{}({}) AS {}", agg.function.to_uppercase(), agg.column, agg.alias);
            new_select.push(expr);
        }

        if !new_select.is_empty() {
            self.select = new_select;
        }
    }

    fn add_join(&mut self, table: &str, left_key: &str, right_key: &str, join_type: AvaJoinType) {
        let join_sql = format!(
            "{} {} ON {}.{} = {}.{}",
            join_type_to_sql(join_type),
            table,
            self.table,
            left_key,
            table,
            right_key
        );
        self.joins.push(join_sql);
    }

    fn set_order_by(&mut self, columns: &[SortColumn]) {
        self.order_by = columns
            .iter()
            .map(|c| {
                let dir = if c.descending { "DESC" } else { "ASC" };
                let nulls = if c.nulls_first { "NULLS FIRST" } else { "NULLS LAST" };
                format!("{} {} {}", c.column, dir, nulls)
            })
            .collect();
    }

    fn set_limit(&mut self, count: u32, offset: Option<u32>) {
        self.limit = Some(count);
        self.offset = offset;
    }

    fn add_window(&mut self, partition_by: &[String], order_by: &[SortColumn], function: &str) {
        let partition = if partition_by.is_empty() {
            String::new()
        } else {
            format!("PARTITION BY {}", partition_by.join(", "))
        };

        let order = if order_by.is_empty() {
            String::new()
        } else {
            let cols: Vec<String> = order_by
                .iter()
                .map(|c| {
                    let dir = if c.descending { "DESC" } else { "ASC" };
                    format!("{} {}", c.column, dir)
                })
                .collect();
            format!("ORDER BY {}", cols.join(", "))
        };

        let window_clause = format!("{} OVER ({} {})", function, partition, order).trim().to_string();
        self.window_exprs.push(window_clause);
    }

    fn build(&self) -> String {
        let mut sql = String::new();

        // SELECT clause
        let select_cols = if !self.window_exprs.is_empty() {
            let mut cols = self.select.clone();
            cols.extend(self.window_exprs.clone());
            cols.join(", ")
        } else {
            self.select.join(", ")
        };
        sql.push_str(&format!("SELECT {} FROM {}", select_cols, self.table));

        // JOIN clauses
        for join in &self.joins {
            sql.push_str(&format!(" {}", join));
        }

        // WHERE clause
        if !self.where_clauses.is_empty() {
            sql.push_str(&format!(" WHERE {}", self.where_clauses.join(" AND ")));
        }

        // GROUP BY clause
        if !self.group_by.is_empty() {
            sql.push_str(&format!(" GROUP BY {}", self.group_by.join(", ")));
        }

        // HAVING clause
        if !self.having.is_empty() {
            sql.push_str(&format!(" HAVING {}", self.having.join(" AND ")));
        }

        // ORDER BY clause
        if !self.order_by.is_empty() {
            sql.push_str(&format!(" ORDER BY {}", self.order_by.join(", ")));
        }

        // LIMIT/OFFSET clause
        if let Some(limit) = self.limit {
            sql.push_str(&format!(" LIMIT {}", limit));
            if let Some(offset) = self.offset {
                sql.push_str(&format!(" OFFSET {}", offset));
            }
        }

        sql
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ava_domain::{ChannelId, ChannelRole, SourceSpec, SourceKind, MaterializationTier};

    fn make_simple_spec(pipeline: Vec<PipelineOperator>) -> ChannelPipelineSpec {
        ChannelPipelineSpec {
            id: ChannelId::new("test-channel"),
            role: ChannelRole::State,
            source: SourceSpec {
                id: SourceId::new("main-db"),
                kind: SourceKind::Sql,
                connection: "sqlite::memory:".into(),
                schema: None,
            },
            additional_sources: vec![],
            pipeline,
            materialization: MaterializationTier::OnDemand,
            refresh_ms: None,
        }
    }

    #[test]
    fn test_compile_empty_pipeline() {
        let compiler = ViewCompiler::new("assets");
        let spec = make_simple_spec(vec![]);
        let compiled = compiler.compile(&spec).unwrap();

        assert_eq!(compiled.sql, "SELECT * FROM assets");
        assert_eq!(compiled.main_table, "assets");
        assert!(compiled.referenced_tables.is_empty());
    }

    #[test]
    fn test_compile_filter() {
        let compiler = ViewCompiler::new("assets");
        let spec = make_simple_spec(vec![
            PipelineOperator::Filter { predicate: "status = 'active'".into() },
        ]);
        let compiled = compiler.compile(&spec).unwrap();

        assert_eq!(compiled.sql, "SELECT * FROM assets WHERE status = 'active'");
    }

    #[test]
    fn test_compile_project() {
        let compiler = ViewCompiler::new("assets");
        let spec = make_simple_spec(vec![
            PipelineOperator::Project { columns: vec!["id".into(), "name".into(), "value".into()] },
        ]);
        let compiled = compiler.compile(&spec).unwrap();

        assert_eq!(compiled.sql, "SELECT id, name, value FROM assets");
    }

    #[test]
    fn test_compile_aggregate() {
        let compiler = ViewCompiler::new("metrics");
        let spec = make_simple_spec(vec![
            PipelineOperator::Aggregate {
                group_by: vec!["site_id".into()],
                aggregates: vec![
                    AggregateExpr { function: "sum".into(), column: "value".into(), alias: "total".into() },
                    AggregateExpr { function: "avg".into(), column: "value".into(), alias: "average".into() },
                ],
            },
        ]);
        let compiled = compiler.compile(&spec).unwrap();

        assert_eq!(
            compiled.sql,
            "SELECT site_id, SUM(value) AS total, AVG(value) AS average FROM metrics GROUP BY site_id"
        );
    }

    #[test]
    fn test_compile_join() {
        let compiler = ViewCompiler::new("assets");
        let spec = make_simple_spec(vec![
            PipelineOperator::Join {
                source: SourceId::new("sites"),
                left_key: "site_id".into(),
                right_key: "id".into(),
                join_type: AvaJoinType::Inner,
            },
        ]);
        let compiled = compiler.compile(&spec).unwrap();

        assert_eq!(
            compiled.sql,
            "SELECT * FROM assets INNER JOIN sites ON assets.site_id = sites.id"
        );
        assert_eq!(compiled.referenced_tables, vec!["sites"]);
    }

    #[test]
    fn test_compile_sort() {
        let compiler = ViewCompiler::new("assets");
        let spec = make_simple_spec(vec![
            PipelineOperator::Sort {
                columns: vec![
                    SortColumn { column: "value".into(), descending: true, nulls_first: false },
                    SortColumn { column: "name".into(), descending: false, nulls_first: true },
                ],
            },
        ]);
        let compiled = compiler.compile(&spec).unwrap();

        assert_eq!(
            compiled.sql,
            "SELECT * FROM assets ORDER BY value DESC NULLS LAST, name ASC NULLS FIRST"
        );
    }

    #[test]
    fn test_compile_limit() {
        let compiler = ViewCompiler::new("assets");
        let spec = make_simple_spec(vec![
            PipelineOperator::Limit { count: 10, offset: Some(20) },
        ]);
        let compiled = compiler.compile(&spec).unwrap();

        assert_eq!(compiled.sql, "SELECT * FROM assets LIMIT 10 OFFSET 20");
    }

    #[test]
    fn test_compile_complex_pipeline() {
        let compiler = ViewCompiler::new("assets");
        let spec = make_simple_spec(vec![
            PipelineOperator::Filter { predicate: "status = 'active'".into() },
            PipelineOperator::Project { columns: vec!["id".into(), "name".into(), "site_id".into()] },
            PipelineOperator::Join {
                source: SourceId::new("sites"),
                left_key: "site_id".into(),
                right_key: "id".into(),
                join_type: AvaJoinType::Left,
            },
            PipelineOperator::Sort {
                columns: vec![SortColumn { column: "name".into(), descending: false, nulls_first: false }],
            },
            PipelineOperator::Limit { count: 100, offset: None },
        ]);
        let compiled = compiler.compile(&spec).unwrap();

        assert!(compiled.sql.contains("SELECT id, name, site_id FROM assets"));
        assert!(compiled.sql.contains("LEFT JOIN sites"));
        assert!(compiled.sql.contains("WHERE status = 'active'"));
        assert!(compiled.sql.contains("ORDER BY name ASC"));
        assert!(compiled.sql.contains("LIMIT 100"));
    }
}
