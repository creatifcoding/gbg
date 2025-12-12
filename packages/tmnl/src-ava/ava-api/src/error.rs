//! API Error types

use thiserror::Error;
use ava_runtime::RuntimeError;

/// API-level errors
#[derive(Debug, Error)]
pub enum ApiError {
    /// View not found
    #[error("View not found: {view_id}")]
    ViewNotFound { view_id: String },

    /// Invalid request
    #[error("Invalid request: {message}")]
    InvalidRequest { message: String },

    /// Runtime error
    #[error("Runtime error: {0}")]
    Runtime(#[from] RuntimeError),

    /// Serialization error
    #[error("Serialization error: {0}")]
    Serialization(String),

    /// Internal error
    #[error("Internal error: {message}")]
    Internal { message: String },
}

impl ApiError {
    pub fn view_not_found(view_id: impl Into<String>) -> Self {
        Self::ViewNotFound { view_id: view_id.into() }
    }

    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::InvalidRequest { message: message.into() }
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::Internal { message: message.into() }
    }

    pub fn serialization(message: impl Into<String>) -> Self {
        Self::Serialization(message.into())
    }
}

// Convert to tonic::Status for gRPC
impl From<ApiError> for tonic::Status {
    fn from(err: ApiError) -> Self {
        match err {
            ApiError::ViewNotFound { view_id } => {
                tonic::Status::not_found(format!("View not found: {}", view_id))
            }
            ApiError::InvalidRequest { message } => {
                tonic::Status::invalid_argument(message)
            }
            ApiError::Runtime(_) => {
                tonic::Status::internal(err.to_string())
            }
            ApiError::Serialization(msg) => {
                tonic::Status::internal(format!("Serialization error: {}", msg))
            }
            ApiError::Internal { message } => {
                tonic::Status::internal(message)
            }
        }
    }
}

// Convert to axum response for REST
impl axum::response::IntoResponse for ApiError {
    fn into_response(self) -> axum::response::Response {
        use axum::http::StatusCode;
        use axum::Json;
        use serde_json::json;

        let (status, message) = match &self {
            ApiError::ViewNotFound { view_id } => {
                (StatusCode::NOT_FOUND, format!("View not found: {}", view_id))
            }
            ApiError::InvalidRequest { message } => {
                (StatusCode::BAD_REQUEST, message.clone())
            }
            ApiError::Runtime(e) => {
                (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
            }
            ApiError::Serialization(msg) => {
                (StatusCode::INTERNAL_SERVER_ERROR, format!("Serialization error: {}", msg))
            }
            ApiError::Internal { message } => {
                (StatusCode::INTERNAL_SERVER_ERROR, message.clone())
            }
        };

        let body = json!({
            "error": {
                "code": status.as_u16(),
                "message": message,
            }
        });

        (status, Json(body)).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = ApiError::view_not_found("view-1");
        assert!(err.to_string().contains("view-1"));
    }

    #[test]
    fn test_error_to_tonic_status() {
        let err = ApiError::view_not_found("view-1");
        let status: tonic::Status = err.into();
        assert_eq!(status.code(), tonic::Code::NotFound);
    }

    #[test]
    fn test_invalid_request() {
        let err = ApiError::invalid_request("bad field");
        let status: tonic::Status = err.into();
        assert_eq!(status.code(), tonic::Code::InvalidArgument);
    }
}
