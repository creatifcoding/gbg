//! Runtime error types

use ava_domain::ViewId;
use thiserror::Error;

/// Errors that can occur during runtime operations
#[derive(Debug, Error)]
pub enum RuntimeError {
    /// View not found in registry or reconciler
    #[error("View not found: {0}")]
    ViewNotFound(String),

    /// Spec not found in registry
    #[error("Spec not found: {0}")]
    SpecNotFound(String),

    /// Spec already exists with the same ID
    #[error("Spec already exists: {0}")]
    SpecAlreadyExists(String),

    /// View is not in the correct state for the requested operation
    #[error("View {view_id} is in state {state}, expected {expected}")]
    InvalidViewState {
        view_id: String,
        state: String,
        expected: String,
    },

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

    /// Reconciler error
    #[error("Reconciler error: {0}")]
    ReconcilerError(#[from] ava_reconciler::ReconcilerError),

    /// Compiler error
    #[error("Compiler error: {0}")]
    CompilerError(#[from] ava_compiler::CompilerError),

    /// Adapter error
    #[error("Adapter error: {0}")]
    AdapterError(String),

    /// DataFusion error
    #[error("DataFusion error: {0}")]
    DataFusionError(#[from] datafusion::error::DataFusionError),

    /// Internal error
    #[error("Internal error: {0}")]
    Internal(String),
}

impl RuntimeError {
    /// Create a new internal error
    pub fn internal(msg: impl Into<String>) -> Self {
        Self::Internal(msg.into())
    }

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

    /// Create an invalid view state error
    pub fn invalid_state(view_id: &ViewId, state: impl Into<String>, expected: impl Into<String>) -> Self {
        Self::InvalidViewState {
            view_id: view_id.as_str().to_string(),
            state: state.into(),
            expected: expected.into(),
        }
    }
}
