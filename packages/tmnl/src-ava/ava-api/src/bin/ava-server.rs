//! AVA Server Binary
//!
//! Runs REST, gRPC, and NATS servers concurrently.
//!
//! Usage:
//!   cargo run --package ava-api --bin ava-server
//!
//! Endpoints:
//!   - REST: http://localhost:3000/api/v1/views
//!   - REST Swagger UI: http://localhost:3000/swagger-ui
//!   - gRPC: http://localhost:50051 (ViewService)
//!   - NATS: nats://localhost:4222 (subscribe to tmnl.ava.request.*)
//!
//! Environment Variables:
//!   - NATS_URL: NATS server URL (default: nats://localhost:4222)
//!   - REST_PORT: REST API port (default: 3000)
//!   - GRPC_PORT: gRPC port (default: 50051)
//!   - NATS_SUBJECT_PREFIX: Subject prefix (default: tmnl.ava)

use std::net::SocketAddr;
use std::sync::Arc;
use std::env;

use tokio::sync::{mpsc, RwLock};
use tonic::transport::Server as TonicServer;
use tracing::{info, warn, Level};
use tracing_subscriber::FmtSubscriber;

use ava_api::grpc::ViewServiceImpl;
use ava_api::proto::services::v1::view_service_server::ViewServiceServer;
use ava_api::rest::create_router;
use ava_api::AvaRuntimeV2;
use ava_domain::{ViewId, ViewArtifact, ChannelBinding, ChannelRole, ChannelData};

// NATS integration (optional, but we'll include it)
use ava_adapters::nats::{
    NatsConfig,
    NatsPublisher,
    NatsRequestHandler,
    RequestHandlerConfig,
    RuntimeCommand,
};

const DEFAULT_REST_PORT: u16 = 3000;
const DEFAULT_GRPC_PORT: u16 = 50051;
const DEFAULT_NATS_URL: &str = "nats://localhost:4222";
const DEFAULT_SUBJECT_PREFIX: &str = "tmnl.ava";

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .with_target(false)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    info!("Starting AVA Server...\n");

    // Parse environment
    let rest_port: u16 = env::var("REST_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(DEFAULT_REST_PORT);

    let grpc_port: u16 = env::var("GRPC_PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(DEFAULT_GRPC_PORT);

    let nats_url = env::var("NATS_URL").unwrap_or_else(|_| DEFAULT_NATS_URL.to_string());
    let subject_prefix = env::var("NATS_SUBJECT_PREFIX")
        .unwrap_or_else(|_| DEFAULT_SUBJECT_PREFIX.to_string());

    // Create shared runtime (single instance for all transports)
    let runtime = Arc::new(RwLock::new(AvaRuntimeV2::default()));

    // Clone for each transport
    let rest_runtime = AvaRuntimeV2::default();
    let grpc_runtime = AvaRuntimeV2::default();

    // =========================================================================
    // REST Server
    // =========================================================================
    let rest_addr: SocketAddr = format!("0.0.0.0:{}", rest_port).parse()?;
    let rest_router = create_router(rest_runtime);

    info!("REST API listening on http://localhost:{}", rest_port);
    info!("  - List views:    GET  http://localhost:{}/api/v1/views", rest_port);
    info!("  - Register view: POST http://localhost:{}/api/v1/views", rest_port);
    info!("  - Get spec:      GET  http://localhost:{}/api/v1/views/{{id}}/spec", rest_port);
    info!("  - Get artifact:  GET  http://localhost:{}/api/v1/views/{{id}}/artifact", rest_port);
    info!("  - Get status:    GET  http://localhost:{}/api/v1/views/{{id}}/status", rest_port);
    info!("  - Invalidate:    POST http://localhost:{}/api/v1/views/{{id}}/invalidate", rest_port);
    info!("  - SSE subscribe: GET  http://localhost:{}/api/v1/views/{{id}}/subscribe", rest_port);
    info!("  - WebSocket:     WS   ws://localhost:{}/api/v1/session", rest_port);
    info!("  - Swagger UI:    http://localhost:{}/swagger-ui", rest_port);
    info!("");

    let rest_handle = tokio::spawn(async move {
        let listener = tokio::net::TcpListener::bind(rest_addr).await.unwrap();
        axum::serve(listener, rest_router).await.unwrap();
    });

    // =========================================================================
    // gRPC Server
    // =========================================================================
    let grpc_addr: SocketAddr = format!("0.0.0.0:{}", grpc_port).parse()?;
    let grpc_impl = ViewServiceImpl::new(grpc_runtime);
    let grpc_service = ViewServiceServer::new(grpc_impl);

    info!("gRPC ViewService listening on http://localhost:{}", grpc_port);
    info!("");

    let grpc_handle = tokio::spawn(async move {
        TonicServer::builder()
            .add_service(grpc_service)
            .serve(grpc_addr)
            .await
            .unwrap();
    });

    // =========================================================================
    // NATS Bridge
    // =========================================================================
    let nats_url_clone = nats_url.clone();
    let subject_prefix_clone = subject_prefix.clone();
    let nats_handle = tokio::spawn(async move {
        if let Err(e) = run_nats_bridge(&nats_url_clone, &subject_prefix_clone, runtime).await {
            warn!("NATS bridge error: {}", e);
        }
    });

    info!("NATS Bridge connecting to {}", nats_url);
    info!("  - Subscribe requests: {}.request.subscribe.*", subject_prefix);
    info!("  - Invalidate requests: {}.request.invalidate.*", subject_prefix);
    info!("  - Unsubscribe requests: {}.request.unsubscribe.*", subject_prefix);
    info!("  - Artifacts published: {}.artifacts.*", subject_prefix);
    info!("  - Deltas published: {}.deltas.*", subject_prefix);
    info!("");

    info!("Press Ctrl+C to stop the server.\n");

    // Wait for any to finish (or Ctrl+C)
    tokio::select! {
        _ = rest_handle => info!("REST server stopped"),
        _ = grpc_handle => info!("gRPC server stopped"),
        _ = nats_handle => info!("NATS bridge stopped"),
        _ = tokio::signal::ctrl_c() => {
            info!("\nShutting down...");
        }
    }

    Ok(())
}

/// Run the NATS bridge that handles client requests
async fn run_nats_bridge(
    nats_url: &str,
    subject_prefix: &str,
    runtime: Arc<RwLock<AvaRuntimeV2>>,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    // Create command channel
    let (command_tx, mut command_rx) = mpsc::channel::<RuntimeCommand>(256);

    // Configure NATS
    let nats_config = NatsConfig {
        server_url: nats_url.to_string(),
        stream_name: "TMNL_AVA".to_string(),
        subject_prefix: subject_prefix.to_string(),
        max_messages: 100_000,
        max_reconnect_attempts: 0,
        reconnect_delay_ms: 1000,
    };

    let handler_config = RequestHandlerConfig::default()
        .with_nats(nats_config.clone());

    // Create request handler
    let mut request_handler = NatsRequestHandler::new(handler_config, command_tx).await?;
    request_handler.start().await?;

    info!("NATS request handler started");

    // Create publisher for responses
    let publisher = NatsPublisher::new(nats_config.clone()).await?;

    info!("NATS publisher ready");

    // Process commands from request handler
    while let Some(cmd) = command_rx.recv().await {
        match cmd {
            RuntimeCommand::Subscribe { view_id } => {
                info!(view_id = %view_id.as_str(), "Processing subscribe request");

                // Create a mock artifact for now (in production, this would come from reconciler)
                let artifact = create_mock_artifact(&view_id);

                // Publish artifact
                if let Err(e) = publisher.publish_artifact(&artifact).await {
                    warn!(error = %e, "Failed to publish artifact");
                } else {
                    info!(view_id = %view_id.as_str(), "Published artifact");
                }
            }
            RuntimeCommand::Invalidate { view_id, reason } => {
                info!(view_id = %view_id.as_str(), reason = %reason, "Processing invalidate request");

                // Create fresh artifact
                let artifact = create_mock_artifact(&view_id);

                // Publish
                if let Err(e) = publisher.publish_artifact(&artifact).await {
                    warn!(error = %e, "Failed to publish artifact");
                } else {
                    info!(view_id = %view_id.as_str(), "Published invalidated artifact");
                }
            }
            RuntimeCommand::Unsubscribe { view_id } => {
                info!(view_id = %view_id.as_str(), "Processing unsubscribe request");
                // In production, would cleanup fiber tracking here
            }
        }
    }

    Ok(())
}

/// Create a mock artifact for testing
/// In production, this would come from the ReconcilerV2
fn create_mock_artifact(view_id: &ViewId) -> ViewArtifact {
    use ava_domain::views::ViewProfileSpec;
    use ava_domain::channels::{ChannelPipelineSpec, SourceSpec, SourceKind, MaterializationTier};
    use ava_domain::ids::{AssetId, AssemblageId, ChannelId, SourceId};
    use std::collections::HashMap;

    let spec = ViewProfileSpec {
        id: view_id.clone(),
        name: format!("View {}", view_id.as_str()),
        description: Some("Mock view for testing".into()),
        assemblage_id: AssemblageId::new("test-assemblage"),
        channels: vec![
            ChannelPipelineSpec {
                id: ChannelId::new("state"),
                role: ChannelRole::State,
                source: SourceSpec {
                    id: SourceId::new("mock-db"),
                    kind: SourceKind::Sql,
                    connection: "sqlite::memory:".into(),
                    schema: None,
                },
                additional_sources: vec![],
                pipeline: vec![],
                materialization: MaterializationTier::Cached,
                refresh_ms: None,
            },
        ],
        tags: HashMap::new(),
        version: 1,
    };

    ViewArtifact {
        view_id: view_id.clone(),
        asset_id: Some(AssetId::new(&format!("asset-{}", view_id.as_str()))),
        spec,
        channel_bindings: vec![
            ChannelBinding {
                channel_id: ChannelId::new("state"),
                role: ChannelRole::State,
                active: true,
                row_count: Some(10),
                last_updated_ms: Some(chrono::Utc::now().timestamp_millis() as f64),
                data: Some(ChannelData::Rows(vec![
                    serde_json::json!({"id": 1, "name": "Item A", "value": 42.0}),
                    serde_json::json!({"id": 2, "name": "Item B", "value": 73.5}),
                    serde_json::json!({"id": 3, "name": "Item C", "value": 99.9}),
                ])),
            },
        ],
        created_at_ms: chrono::Utc::now().timestamp_millis() as f64,
        logical_version: 1,
    }
}
