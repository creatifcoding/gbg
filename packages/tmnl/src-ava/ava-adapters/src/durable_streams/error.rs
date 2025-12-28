//! Durable Streams Error Types

use thiserror::Error;

/// Errors from the Durable Streams client
#[derive(Error, Debug)]
pub enum DurableStreamsError {
    /// HTTP request failed
    #[error("HTTP request failed: {0}")]
    Http(#[from] reqwest::Error),

    /// Stream creation failed
    #[error("Failed to create stream '{path}': {status} - {message}")]
    CreateFailed {
        path: String,
        status: u16,
        message: String,
    },

    /// Append failed
    #[error("Failed to append to stream '{path}': {status} - {message}")]
    AppendFailed {
        path: String,
        status: u16,
        message: String,
    },

    /// Read failed
    #[error("Failed to read stream '{path}': {status} - {message}")]
    ReadFailed {
        path: String,
        status: u16,
        message: String,
    },

    /// Stream not found
    #[error("Stream not found: {0}")]
    NotFound(String),

    /// Offset is before earliest retained position
    #[error("Offset gone (before retention): {0}")]
    OffsetGone(String),

    /// Content type mismatch
    #[error("Content type conflict: expected {expected}, got {actual}")]
    ContentTypeMismatch { expected: String, actual: String },

    /// Invalid offset format
    #[error("Invalid offset: {0}")]
    InvalidOffset(String),

    /// Serialization error
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    /// Missing header in response
    #[error("Missing required header: {0}")]
    MissingHeader(String),

    /// Bridge error
    #[error("Bridge error: {0}")]
    Bridge(String),
}

impl DurableStreamsError {
    /// Check if this is a retryable error
    pub fn is_retryable(&self) -> bool {
        match self {
            Self::Http(e) => e.is_timeout() || e.is_connect(),
            Self::CreateFailed { status, .. }
            | Self::AppendFailed { status, .. }
            | Self::ReadFailed { status, .. } => {
                // 5xx errors are retryable, 429 is retryable
                *status >= 500 || *status == 429
            }
            _ => false,
        }
    }
}
