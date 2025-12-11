//! Reconciler error types

use thiserror::Error;
use ava_domain::ViewId;

/// Reconciler-specific errors
#[derive(Debug, Clone, Error)]
pub enum ReconcilerError {
    #[error("View not found: {view_id:?}")]
    ViewNotFound { view_id: ViewId },

    #[error("View already exists: {view_id:?}")]
    ViewAlreadyExists { view_id: ViewId },

    #[error("Invalid state transition: {from} -> {to} for view {view_id:?}")]
    InvalidStateTransition {
        view_id: ViewId,
        from: String,
        to: String,
    },

    #[error("Event replay failed: {message}")]
    ReplayFailed { message: String },

    #[error("Scheduler error: {message}")]
    SchedulerError { message: String },
}
