//! REST route implementations
//!
//! ViewService REST API providing spec management and view lifecycle operations.
//! See ADR-001-REST-FROM-GRPC.md for architectural decisions.

use std::convert::Infallible;
use std::sync::Arc;
use std::time::Duration;
use axum::{
    Router,
    routing::{get, post},
    extract::{State, Path, Json},
    http::StatusCode,
    response::sse::{Event, Sse, KeepAlive},
};
use futures::stream::{Stream, StreamExt};
use tokio::sync::RwLock;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

use ava_runtime::{
    AvaRuntimeV2, ViewProfileSpec, ViewId, AssemblageId,
    ChannelPipelineSpec, ChannelId, ChannelRole,
    SourceSpec, SourceId, SourceKind,
};
use ava_domain::MaterializationTier;
use crate::error::ApiError;
use super::dto::*;

// ============================================================================
// OpenAPI Documentation
// ============================================================================

#[derive(OpenApi)]
#[openapi(
    info(
        title = "AVA API",
        version = "1.0.0",
        description = "Asset View Agent REST API - View lifecycle management",
        license(name = "MIT"),
    ),
    paths(
        list_views,
        register_spec,
        get_spec,
        get_artifact,
        get_status,
        invalidate_view,
    ),
    components(schemas(
        ViewSummary,
        ViewSpecResponse,
        ViewArtifactResponse,
        ViewStatusResponse,
        ChannelSpecDto,
        ChannelBindingDto,
        RegisterSpecRequest,
        RegisterChannelRequest,
        RegisterSpecResponse,
        InvalidateRequest,
        InvalidateResponse,
        ErrorDto,
    )),
    tags(
        (name = "views", description = "View lifecycle management")
    )
)]
pub struct ApiDoc;

// ============================================================================
// Application State
// ============================================================================

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

// ============================================================================
// Router Configuration
// ============================================================================

/// Create the REST API router with Swagger UI
pub fn create_router(runtime: AvaRuntimeV2) -> Router {
    let state = AppState::new(runtime);

    Router::new()
        // ViewService routes
        .route("/api/v1/views", get(list_views).post(register_spec))
        .route("/api/v1/views/{id}/spec", get(get_spec))
        .route("/api/v1/views/{id}/artifact", get(get_artifact))
        .route("/api/v1/views/{id}/status", get(get_status))
        .route("/api/v1/views/{id}/invalidate", post(invalidate_view))
        // SSE streaming routes
        .route("/api/v1/views/{id}/subscribe", get(subscribe_view))
        // Swagger UI
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .with_state(state)
}

/// Create router without Swagger UI (for embedding in larger app)
pub fn create_api_router(runtime: AvaRuntimeV2) -> Router {
    let state = AppState::new(runtime);

    Router::new()
        .route("/api/v1/views", get(list_views).post(register_spec))
        .route("/api/v1/views/{id}/spec", get(get_spec))
        .route("/api/v1/views/{id}/artifact", get(get_artifact))
        .route("/api/v1/views/{id}/status", get(get_status))
        .route("/api/v1/views/{id}/invalidate", post(invalidate_view))
        .route("/api/v1/views/{id}/subscribe", get(subscribe_view))
        .with_state(state)
}

// ============================================================================
// ViewService Handlers
// ============================================================================

/// List all registered views
#[utoipa::path(
    get,
    path = "/api/v1/views",
    tag = "views",
    responses(
        (status = 200, description = "List of view summaries", body = Vec<ViewSummary>),
        (status = 500, description = "Internal server error")
    )
)]
async fn list_views(
    State(state): State<AppState>,
) -> Result<Json<Vec<ViewSummary>>, ApiError> {
    let runtime = state.runtime.read().await;
    let specs = runtime.list_specs()
        .map_err(|e| ApiError::Runtime(e))?;

    let summaries: Vec<ViewSummary> = specs.iter()
        .map(ViewSummary::from_spec)
        .collect();

    Ok(Json(summaries))
}

/// Register a new view specification
#[utoipa::path(
    post,
    path = "/api/v1/views",
    tag = "views",
    request_body = RegisterSpecRequest,
    responses(
        (status = 201, description = "View registered successfully", body = RegisterSpecResponse),
        (status = 400, description = "Invalid request"),
        (status = 409, description = "View already exists (if overwrite_existing=false)"),
        (status = 500, description = "Internal server error")
    )
)]
async fn register_spec(
    State(state): State<AppState>,
    Json(request): Json<RegisterSpecRequest>,
) -> Result<(StatusCode, Json<RegisterSpecResponse>), ApiError> {
    let runtime = state.runtime.read().await;

    // Convert request to domain spec
    let spec = request_to_spec(&request)
        .map_err(|e| ApiError::invalid_request(e))?;

    // Check if exists and handle overwrite
    let existing = runtime.get_spec(&spec.id).ok().flatten();
    if existing.is_some() && !request.overwrite_existing {
        return Err(ApiError::view_already_exists(&spec.id.0));
    }

    let was_created = existing.is_none();

    runtime.register_spec(spec.clone())
        .map_err(|e| ApiError::Runtime(e))?;

    let response = RegisterSpecResponse {
        view_id: spec.id.0.clone(),
        was_created,
        version: spec.version,
    };

    let status = if was_created { StatusCode::CREATED } else { StatusCode::OK };
    Ok((status, Json(response)))
}

/// Get view specification
#[utoipa::path(
    get,
    path = "/api/v1/views/{id}/spec",
    tag = "views",
    params(
        ("id" = String, Path, description = "View identifier")
    ),
    responses(
        (status = 200, description = "View specification", body = ViewSpecResponse),
        (status = 404, description = "View not found"),
        (status = 500, description = "Internal server error")
    )
)]
async fn get_spec(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ViewSpecResponse>, ApiError> {
    let runtime = state.runtime.read().await;
    let view_id = ViewId::new(&id);

    let spec = runtime.get_spec(&view_id)
        .map_err(|e| ApiError::Runtime(e))?
        .ok_or_else(|| ApiError::view_not_found(&id))?;

    Ok(Json(ViewSpecResponse::from_spec(&spec)))
}

/// Get view artifact (runtime state with channel bindings)
#[utoipa::path(
    get,
    path = "/api/v1/views/{id}/artifact",
    tag = "views",
    params(
        ("id" = String, Path, description = "View identifier")
    ),
    responses(
        (status = 200, description = "View artifact with channel bindings", body = ViewArtifactResponse),
        (status = 404, description = "View not found or not subscribed"),
        (status = 500, description = "Internal server error")
    )
)]
async fn get_artifact(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ViewArtifactResponse>, ApiError> {
    let runtime = state.runtime.read().await;
    let view_id = ViewId::new(&id);

    // Get the spec first
    let spec = runtime.get_spec(&view_id)
        .map_err(|e| ApiError::Runtime(e))?
        .ok_or_else(|| ApiError::view_not_found(&id))?;

    // Check if view is subscribed (has an active artifact)
    let is_subscribed = runtime.is_subscribed(&view_id).await;
    if !is_subscribed {
        return Err(ApiError::view_not_found(format!("{} (not subscribed)", id)));
    }

    // Create artifact from spec
    let artifact = AvaRuntimeV2::create_artifact(&spec);

    Ok(Json(ViewArtifactResponse::from_artifact(&artifact)))
}

/// Get view status
#[utoipa::path(
    get,
    path = "/api/v1/views/{id}/status",
    tag = "views",
    params(
        ("id" = String, Path, description = "View identifier")
    ),
    responses(
        (status = 200, description = "View status", body = ViewStatusResponse),
        (status = 404, description = "View not found"),
        (status = 500, description = "Internal server error")
    )
)]
async fn get_status(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<ViewStatusResponse>, ApiError> {
    let runtime = state.runtime.read().await;
    let view_id = ViewId::new(&id);

    // Check if view exists
    let spec = runtime.get_spec(&view_id)
        .map_err(|e| ApiError::Runtime(e))?
        .ok_or_else(|| ApiError::view_not_found(&id))?;

    // Get subscription status from runtime
    let is_subscribed = runtime.is_subscribed(&view_id).await;
    let total_subscriptions = runtime.subscription_count().await;

    let response = ViewStatusResponse {
        view_id: id,
        is_subscribed,
        version: spec.version,
        total_subscriptions,
    };

    Ok(Json(response))
}

/// Invalidate a view (trigger recompilation)
#[utoipa::path(
    post,
    path = "/api/v1/views/{id}/invalidate",
    tag = "views",
    params(
        ("id" = String, Path, description = "View identifier")
    ),
    request_body = InvalidateRequest,
    responses(
        (status = 200, description = "View invalidated", body = InvalidateResponse),
        (status = 404, description = "View not found"),
        (status = 500, description = "Internal server error")
    )
)]
async fn invalidate_view(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(request): Json<InvalidateRequest>,
) -> Result<Json<InvalidateResponse>, ApiError> {
    let runtime = state.runtime.read().await;
    let view_id = ViewId::new(&id);

    // Verify view exists
    let _ = runtime.get_spec(&view_id)
        .map_err(|e| ApiError::Runtime(e))?
        .ok_or_else(|| ApiError::view_not_found(&id))?;

    runtime.invalidate(&view_id).await
        .map_err(|e| ApiError::Runtime(e))?;

    let message = match request.reason {
        Some(reason) => format!("View invalidated: {}", reason),
        None => "View invalidated".to_string(),
    };

    Ok(Json(InvalidateResponse {
        view_id: id,
        message,
    }))
}

// ============================================================================
// SSE Streaming Handlers
// ============================================================================

/// Subscribe to view updates via Server-Sent Events
///
/// Streams ViewArtifact updates as SSE events. Each event contains
/// a JSON-serialized ViewArtifactResponse in the data field.
///
/// Event format:
/// ```text
/// event: artifact
/// data: {"view_id": "...", "spec": {...}, "channel_bindings": [...], ...}
/// ```
async fn subscribe_view(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, ApiError> {
    let runtime = state.runtime.read().await;
    let view_id = ViewId::new(&id);

    // Get the spec
    let spec = runtime.get_spec(&view_id)
        .map_err(|e| ApiError::Runtime(e))?
        .ok_or_else(|| ApiError::view_not_found(&id))?;

    // Subscribe to the view - this returns a broadcast receiver
    let rx = runtime.subscribe_view_hydrated(spec).await
        .map_err(|e| ApiError::Runtime(e))?;

    // Convert broadcast receiver to SSE event stream
    let stream = tokio_stream::wrappers::BroadcastStream::new(rx)
        .filter_map(|result| async move {
            match result {
                Ok(artifact) => {
                    let response = ViewArtifactResponse::from_artifact(&artifact);
                    match serde_json::to_string(&response) {
                        Ok(json) => Some(
                            Event::default()
                                .event("artifact")
                                .data(json)
                        ),
                        Err(_) => None,
                    }
                }
                Err(_) => None, // Skip lagged or closed errors
            }
        })
        .map(Ok);

    Ok(Sse::new(stream).keep_alive(
        KeepAlive::new()
            .interval(Duration::from_secs(15))
            .text("keep-alive")
    ))
}

// ============================================================================
// Helpers
// ============================================================================

fn request_to_spec(request: &RegisterSpecRequest) -> Result<ViewProfileSpec, String> {
    let view_id = request.id.clone()
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let channels: Result<Vec<ChannelPipelineSpec>, String> = request.channels.iter().map(|c| {
        let role = match c.role.to_uppercase().as_str() {
            "STATE" => ChannelRole::State,
            "EVENT" => ChannelRole::Event,
            "METRIC" => ChannelRole::Metric,
            "COMMAND" => ChannelRole::Command,
            "LOG" => ChannelRole::Log,
            _ => return Err(format!("Invalid channel role: {}", c.role)),
        };

        let materialization = c.materialization.as_ref()
            .map(|m| match m.to_uppercase().as_str() {
                "ONDEMAND" | "ON_DEMAND" => MaterializationTier::OnDemand,
                "CACHED" => MaterializationTier::Cached,
                "CONTINUOUS" => MaterializationTier::Continuous,
                _ => MaterializationTier::Cached,
            })
            .unwrap_or(MaterializationTier::Cached);

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
            materialization,
            refresh_ms: None,
        })
    }).collect();

    Ok(ViewProfileSpec {
        id: ViewId::new(&view_id),
        name: request.name.clone(),
        description: request.description.clone(),
        assemblage_id: AssemblageId::new(&request.assemblage_id),
        channels: channels?,
        tags: std::collections::HashMap::new(),
        version: 1,
    })
}

// ============================================================================
// Tests
// ============================================================================

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

    #[tokio::test]
    async fn test_api_router_creation() {
        let runtime = AvaRuntimeV2::default();
        let _router = create_api_router(runtime);
    }

    #[test]
    fn test_openapi_spec_generation() {
        let spec = ApiDoc::openapi();
        assert_eq!(spec.info.title, "AVA API");
        assert!(!spec.paths.paths.is_empty());
    }

    #[test]
    fn test_request_to_spec() {
        let request = RegisterSpecRequest {
            id: Some("test-view".to_string()),
            name: "Test View".to_string(),
            description: Some("A test view".to_string()),
            assemblage_id: "test-assemblage".to_string(),
            channels: vec![
                RegisterChannelRequest {
                    id: "state".to_string(),
                    role: "STATE".to_string(),
                    source_connection: "memory://test".to_string(),
                    materialization: Some("CACHED".to_string()),
                }
            ],
            overwrite_existing: false,
        };

        let spec = request_to_spec(&request).unwrap();
        assert_eq!(spec.id.0, "test-view");
        assert_eq!(spec.name, "Test View");
        assert_eq!(spec.channels.len(), 1);
        assert_eq!(spec.channels[0].role, ChannelRole::State);
    }

    #[test]
    fn test_request_to_spec_invalid_role() {
        let request = RegisterSpecRequest {
            id: None,
            name: "Test".to_string(),
            description: None,
            assemblage_id: "test".to_string(),
            channels: vec![
                RegisterChannelRequest {
                    id: "ch1".to_string(),
                    role: "INVALID".to_string(),
                    source_connection: "memory://test".to_string(),
                    materialization: None,
                }
            ],
            overwrite_existing: false,
        };

        let result = request_to_spec(&request);
        assert!(result.is_err());
    }
}
