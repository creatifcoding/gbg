//! Domain Error Types
//!
//! All error types for the AVA domain.
//! Uses thiserror for ergonomic error handling.

use serde::{Deserialize, Serialize};
use thiserror::Error;
use typeshare::typeshare;

use crate::ids::{ViewId, ChannelId, AssemblageId, SourceId};

/// View-related errors
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Error)]
#[serde(rename_all = "camelCase", tag = "error", content = "content")]
pub enum ViewError {
    #[error("View not found: {view_id:?}")]
    NotFound { view_id: ViewId },
    #[error("View already exists: {view_id:?}")]
    AlreadyExists { view_id: ViewId },
    #[error("View compilation failed: {message}")]
    CompilationFailed { view_id: ViewId, message: String },
    #[error("View is not mounted: {view_id:?}")]
    NotMounted { view_id: ViewId },
    #[error("View is suspended: {view_id:?}")]
    Suspended { view_id: ViewId },
    #[error("Invalid view spec: {message}")]
    InvalidSpec { message: String },
}

/// Channel-related errors
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Error)]
#[serde(rename_all = "camelCase", tag = "error", content = "content")]
pub enum ChannelError {
    #[error("Channel not found: {channel_id:?}")]
    NotFound { channel_id: ChannelId },
    #[error("Channel pipeline invalid: {message}")]
    InvalidPipeline { channel_id: ChannelId, message: String },
    #[error("Channel source unavailable: {source_id:?}")]
    SourceUnavailable { channel_id: ChannelId, source_id: SourceId },
    #[error("Channel execution failed: {message}")]
    ExecutionFailed { channel_id: ChannelId, message: String },
}

/// Assemblage-related errors
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Error)]
#[serde(rename_all = "camelCase", tag = "error", content = "content")]
pub enum AssemblageError {
    #[error("Assemblage not found: {assemblage_id:?}")]
    NotFound { assemblage_id: AssemblageId },
    #[error("View not admissible in assemblage")]
    ViewNotAdmissible { view_id: ViewId, assemblage_id: AssemblageId },
    #[error("Constraint violated: {message}")]
    ConstraintViolated { assemblage_id: AssemblageId, message: String },
    #[error("Predicate evaluation failed: {message}")]
    PredicateFailed { assemblage_id: AssemblageId, message: String },
}

/// Source adapter errors
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Error)]
#[serde(rename_all = "camelCase", tag = "error", content = "content")]
pub enum SourceError {
    #[error("Source not found: {source_id:?}")]
    NotFound { source_id: SourceId },
    #[error("Connection failed: {message}")]
    ConnectionFailed { source_id: SourceId, message: String },
    #[error("Query failed: {message}")]
    QueryFailed { source_id: SourceId, message: String },
    #[error("Subscription failed: {message}")]
    SubscriptionFailed { source_id: SourceId, message: String },
    #[error("Unsupported operation: {operation}")]
    UnsupportedOperation { source_id: SourceId, operation: String },
}

/// Reconciler errors
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Error)]
#[serde(rename_all = "camelCase", tag = "error", content = "content")]
pub enum ReconcilerError {
    #[error("Event log corrupted: {message}")]
    EventLogCorrupted { message: String },
    #[error("Replay failed at sequence {sequence}: {message}")]
    ReplayFailed { sequence: u32, message: String },
    #[error("Fiber panic: {message}")]
    FiberPanic { view_id: ViewId, message: String },
    #[error("Resource exhausted: {resource}")]
    ResourceExhausted { resource: String },
}

/// Top-level AVA error that encompasses all domain errors
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, Error)]
#[serde(rename_all = "camelCase", tag = "domain", content = "content")]
pub enum AvaError {
    #[error("View error: {0}")]
    View(ViewError),
    #[error("Channel error: {0}")]
    Channel(ChannelError),
    #[error("Assemblage error: {0}")]
    Assemblage(AssemblageError),
    #[error("Source error: {0}")]
    Source(SourceError),
    #[error("Reconciler error: {0}")]
    Reconciler(ReconcilerError),
    #[error("Internal error: {message}")]
    Internal { message: String },
}

impl From<ViewError> for AvaError {
    fn from(e: ViewError) -> Self { AvaError::View(e) }
}

impl From<ChannelError> for AvaError {
    fn from(e: ChannelError) -> Self { AvaError::Channel(e) }
}

impl From<AssemblageError> for AvaError {
    fn from(e: AssemblageError) -> Self { AvaError::Assemblage(e) }
}

impl From<SourceError> for AvaError {
    fn from(e: SourceError) -> Self { AvaError::Source(e) }
}

impl From<ReconcilerError> for AvaError {
    fn from(e: ReconcilerError) -> Self { AvaError::Reconciler(e) }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = ViewError::NotFound { view_id: ViewId::new("missing-view") };
        assert!(err.to_string().contains("View not found"));
    }

    #[test]
    fn test_error_serialization() {
        let err = AvaError::View(ViewError::CompilationFailed {
            view_id: ViewId::new("view-1"),
            message: "SQL syntax error".into(),
        });

        let json = serde_json::to_string(&err).unwrap();
        assert!(json.contains("compilationFailed"));
        assert!(json.contains("SQL syntax error"));
    }

    #[test]
    fn test_error_conversion() {
        let view_err = ViewError::NotFound { view_id: ViewId::new("v1") };
        let ava_err: AvaError = view_err.into();

        match ava_err {
            AvaError::View(_) => {}
            _ => panic!("Expected View variant"),
        }
    }
}
