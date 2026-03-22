//! Channel Types
//!
//! Channels are data pathways within a View. Each channel has a role
//! (STATE, EVENT, METRIC, COMMAND, LOG) and a pipeline specification.

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use crate::ids::{ChannelId, SourceId};

/// The role/purpose of a channel within a view
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ChannelRole {
    State,
    Event,
    Metric,
    Command,
    Log,
}

impl ChannelRole {
    pub fn is_read_only(&self) -> bool {
        matches!(self, ChannelRole::State | ChannelRole::Event | ChannelRole::Metric | ChannelRole::Log)
    }

    pub fn supports_streaming(&self) -> bool {
        matches!(self, ChannelRole::Event | ChannelRole::Metric | ChannelRole::Log)
    }
}

/// Materialization tier determines how the channel data is computed/stored
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MaterializationTier {
    OnDemand,
    Cached,
    Continuous,
}

/// Kind of data source backing a channel
#[typeshare]
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind", content = "content")]
pub enum SourceKind {
    Sql,
    Stream,
    Api,
    Graph,
    Lake,
    Cache,
    Custom(String),
}

/// Specification for a data source
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SourceSpec {
    pub id: SourceId,
    pub kind: SourceKind,
    pub connection: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub schema: Option<String>,
}

/// Pipeline operator applied to channel data
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "op", content = "content")]
pub enum PipelineOperator {
    Filter { predicate: String },
    Project { columns: Vec<String> },
    Aggregate { group_by: Vec<String>, aggregates: Vec<AggregateExpr> },
    Join { source: SourceId, left_key: String, right_key: String, join_type: JoinType },
    Sort { columns: Vec<SortColumn> },
    Limit { count: u32, offset: Option<u32> },
    Window { partition_by: Vec<String>, order_by: Vec<SortColumn>, function: String },
}

/// Aggregate expression
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AggregateExpr {
    pub function: String,
    pub column: String,
    pub alias: String,
}

/// Join type
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JoinType {
    Inner,
    Left,
    Right,
    Full,
    Cross,
}

/// Sort column specification
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SortColumn {
    pub column: String,
    pub descending: bool,
    pub nulls_first: bool,
}

/// Complete specification for a channel's data pipeline
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelPipelineSpec {
    pub id: ChannelId,
    pub role: ChannelRole,
    pub source: SourceSpec,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub additional_sources: Vec<SourceSpec>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub pipeline: Vec<PipelineOperator>,
    pub materialization: MaterializationTier,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_ms: Option<u32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_channel_role_properties() {
        assert!(ChannelRole::State.is_read_only());
        assert!(!ChannelRole::Command.is_read_only());
        assert!(ChannelRole::Event.supports_streaming());
        assert!(!ChannelRole::State.supports_streaming());
    }

    #[test]
    fn test_pipeline_spec_serialization() {
        let spec = ChannelPipelineSpec {
            id: ChannelId::new("state-channel"),
            role: ChannelRole::State,
            source: SourceSpec {
                id: SourceId::new("main-db"),
                kind: SourceKind::Sql,
                connection: "sqlite::memory:".into(),
                schema: None,
            },
            additional_sources: vec![],
            pipeline: vec![
                PipelineOperator::Filter { predicate: "status = 'active'".into() },
                PipelineOperator::Project { columns: vec!["id".into(), "name".into()] },
            ],
            materialization: MaterializationTier::Cached,
            refresh_ms: Some(5000),
        };

        let json = serde_json::to_string_pretty(&spec).unwrap();
        let parsed: ChannelPipelineSpec = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.id, spec.id);
        assert_eq!(parsed.pipeline.len(), 2);
    }
}
