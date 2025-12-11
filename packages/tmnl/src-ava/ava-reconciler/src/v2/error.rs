//! Error types for ReconcilerV2

use ava_domain::ViewId;
use thiserror::Error;
use tokio::sync::broadcast::error::SendError;

/// Errors that can occur in ReconcilerV2 operations
#[derive(Debug, Error)]
pub enum ReconcilerErrorV2 {
    /// View not found
    #[error("View not found: {0}")]
    ViewNotFound(String),

    /// Broadcast send failed
    #[error("Broadcast failed: {0}")]
    BroadcastFailed(String),

    /// Channel closed
    #[error("Channel closed")]
    ChannelClosed,

    /// Compilation failed
    #[error("Compilation failed for view {view_id}: {message}")]
    CompilationFailed {
        view_id: String,
        message: String,
    },

    /// Execution failed
    #[error("Execution failed for view {view_id}: {message}")]
    ExecutionFailed {
        view_id: String,
        message: String,
    },

    /// Internal error
    #[error("Internal error: {0}")]
    Internal(String),
}

impl ReconcilerErrorV2 {
    /// Create a view not found error
    pub fn view_not_found(view_id: &ViewId) -> Self {
        Self::ViewNotFound(view_id.as_str().to_string())
    }

    /// Create a compilation failed error
    pub fn compilation_failed(view_id: &ViewId, msg: impl Into<String>) -> Self {
        Self::CompilationFailed {
            view_id: view_id.as_str().to_string(),
            message: msg.into(),
        }
    }

    /// Create an execution failed error
    pub fn execution_failed(view_id: &ViewId, msg: impl Into<String>) -> Self {
        Self::ExecutionFailed {
            view_id: view_id.as_str().to_string(),
            message: msg.into(),
        }
    }

    /// Create an internal error
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }
}

impl<T> From<SendError<T>> for ReconcilerErrorV2 {
    fn from(err: SendError<T>) -> Self {
        Self::BroadcastFailed(err.to_string())
    }
}
