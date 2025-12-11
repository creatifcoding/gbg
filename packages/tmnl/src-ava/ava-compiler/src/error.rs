//! Compiler errors

use thiserror::Error;

/// Errors that can occur during view compilation
#[derive(Debug, Error)]
pub enum CompilerError {
    #[error("Invalid pipeline specification: {message}")]
    InvalidSpec { message: String },

    #[error("DataFusion error: {message}")]
    DataFusionError { message: String },

    #[error("Source not found: {source_id}")]
    SourceNotFound { source_id: String },

    #[error("Schema mismatch: {message}")]
    SchemaMismatch { message: String },

    #[error("Unsupported operation: {operation}")]
    UnsupportedOperation { operation: String },
}
