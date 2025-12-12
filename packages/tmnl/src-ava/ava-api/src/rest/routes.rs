//! REST route implementations
//!
//! Full implementation in I46 (ava-api REST routes).

use std::sync::Arc;
use axum::{
    Router,
    routing::{get, post, delete},
    extract::{State, Path, Json},
};
use tokio::sync::RwLock;
use serde::{Deserialize, Serialize};

use ava_runtime::{AvaRuntimeV2, ViewProfileSpec, ViewId};
use crate::error::ApiError;

/// Application state shared across routes
#[derive(Clone)]
pub struct AppState {
    pub runtime: Arc<RwLock<AvaRuntimeV2>>,
}

impl AppState {
    pub fn new(runtime: AvaRuntimeV2) -> Self {
        Self {
            runtime: Arc::new(RwLock::new(runtime)),
        }
    }
}

/// Create the REST API router
pub fn create_router(runtime: AvaRuntimeV2) -> Router {
    let state = AppState::new(runtime);

    Router::new()
        .route("/api/v1/views", get(list_views))
        .route("/api/v1/views", post(register_view))
        .route("/api/v1/views/{id}", get(get_view))
        .route("/api/v1/views/{id}/invalidate", post(invalidate_view))
        .route("/api/v1/views/{id}", delete(unsubscribe_view))
        .with_state(state)
}

// ============================================================================
// Route Handlers (stubs for I46)
// ============================================================================

/// List all registered views
async fn list_views(
    State(state): State<AppState>,
) -> Result<Json<Vec<ViewSummary>>, ApiError> {
    let runtime = state.runtime.read().await;
    let specs = runtime.list_specs()
        .map_err(|e| ApiError::Runtime(e))?;

    let summaries: Vec<ViewSummary> = specs.iter().map(|s| ViewSummary {
        id: s.id.0.clone(),
        name: s.name.clone(),
        version: s.version,
    }).collect();

    Ok(Json(summaries))
}

/// Register a new view
async fn register_view(
    State(state): State<AppState>,
    Json(request): Json<RegisterViewRequest>,
) -> Result<Json<RegisterViewResponse>, ApiError> {
    let runtime = state.runtime.read().await;

    // Convert request to ViewProfileSpec
    let spec = request.to_spec()
        .map_err(|e| ApiError::invalid_request(e))?;

    runtime.register_spec(spec.clone())
        .map_err(|e| ApiError::Runtime(e))?;

    Ok(Json(RegisterViewResponse {
        id: spec.id.0.clone(),
        message: "View registered successfully".to_string(),
    }))
}

/// Get view details
async fn get_view(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ViewDetails>, ApiError> {
    let runtime = state.runtime.read().await;
    let view_id = ViewId::new(&id);

    let spec = runtime.get_spec(&view_id)
        .map_err(|e| ApiError::Runtime(e))?
        .ok_or_else(|| ApiError::view_not_found(&id))?;

    Ok(Json(ViewDetails {
        id: spec.id.0.clone(),
        name: spec.name.clone(),
        description: spec.description.clone(),
        version: spec.version,
        channel_count: spec.channels.len(),
    }))
}

/// Invalidate a view to trigger recomputation
async fn invalidate_view(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<InvalidateResponse>, ApiError> {
    let runtime = state.runtime.read().await;
    let view_id = ViewId::new(&id);

    runtime.invalidate(&view_id).await
        .map_err(|e| ApiError::Runtime(e))?;

    Ok(Json(InvalidateResponse {
        id,
        message: "View invalidated successfully".to_string(),
    }))
}

/// Unsubscribe from a view
async fn unsubscribe_view(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<UnsubscribeResponse>, ApiError> {
    let runtime = state.runtime.read().await;
    let view_id = ViewId::new(&id);

    runtime.unsubscribe(&view_id).await
        .map_err(|e| ApiError::Runtime(e))?;

    Ok(Json(UnsubscribeResponse {
        id,
        message: "View unsubscribed successfully".to_string(),
    }))
}

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct ViewSummary {
    pub id: String,
    pub name: String,
    pub version: u32,
}

#[derive(Debug, Deserialize)]
pub struct RegisterViewRequest {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub assemblage_id: String,
    #[serde(default)]
    pub channels: Vec<ChannelRequest>,
}

#[derive(Debug, Deserialize)]
pub struct ChannelRequest {
    pub id: String,
    pub role: String,
    pub source_connection: String,
}

impl RegisterViewRequest {
    fn to_spec(&self) -> Result<ViewProfileSpec, String> {
        use ava_runtime::{AssemblageId, ChannelPipelineSpec, ChannelId, ChannelRole};
        use ava_runtime::{SourceSpec, SourceId, SourceKind};
        use ava_domain::MaterializationTier;

        let channels: Result<Vec<ChannelPipelineSpec>, String> = self.channels.iter().map(|c| {
            let role = match c.role.to_uppercase().as_str() {
                "STATE" => ChannelRole::State,
                "EVENT" => ChannelRole::Event,
                "METRIC" => ChannelRole::Metric,
                "COMMAND" => ChannelRole::Command,
                "LOG" => ChannelRole::Log,
                _ => return Err(format!("Invalid channel role: {}", c.role)),
            };

            Ok(ChannelPipelineSpec {
                id: ChannelId::new(&c.id),
                role,
                source: SourceSpec {
                    id: SourceId::new("main"),
                    kind: SourceKind::Stream,
                    connection: c.source_connection.clone(),
                    schema: None,
                },
                additional_sources: vec![],
                pipeline: vec![],
                materialization: MaterializationTier::Cached,
                refresh_ms: None,
            })
        }).collect();

        Ok(ViewProfileSpec {
            id: ViewId::new(&self.id),
            name: self.name.clone(),
            description: self.description.clone(),
            assemblage_id: AssemblageId::new(&self.assemblage_id),
            channels: channels?,
            tags: std::collections::HashMap::new(),
            version: 1,
        })
    }
}

#[derive(Debug, Serialize)]
pub struct RegisterViewResponse {
    pub id: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct ViewDetails {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: u32,
    pub channel_count: usize,
}

#[derive(Debug, Serialize)]
pub struct InvalidateResponse {
    pub id: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct UnsubscribeResponse {
    pub id: String,
    pub message: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_app_state_creation() {
        let runtime = AvaRuntimeV2::default();
        let _state = AppState::new(runtime);
    }

    #[tokio::test]
    async fn test_router_creation() {
        let runtime = AvaRuntimeV2::default();
        let _router = create_router(runtime);
    }
}
