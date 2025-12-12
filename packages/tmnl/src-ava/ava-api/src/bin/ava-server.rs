//! AVA Server Binary
//!
//! Runs both REST (axum) and gRPC (tonic) servers concurrently.
//!
//! Usage:
//!   cargo run --package ava-api --bin ava-server
//!
//! Endpoints:
//!   - REST: http://localhost:3000/api/v1/views
//!   - REST Swagger UI: http://localhost:3000/swagger-ui
//!   - gRPC: http://localhost:50051 (ViewService)

use std::net::SocketAddr;
use tonic::transport::Server as TonicServer;

use ava_api::grpc::ViewServiceImpl;
use ava_api::proto::services::v1::view_service_server::ViewServiceServer;
use ava_api::rest::create_router;
use ava_api::AvaRuntimeV2;

const REST_PORT: u16 = 3000;
const GRPC_PORT: u16 = 50051;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    println!("Starting AVA Server...\n");

    // Create shared runtime
    let runtime = AvaRuntimeV2::default();

    // For gRPC, we need to share the runtime differently
    // Clone the runtime for REST (it will be wrapped in Arc<RwLock<>>)
    let rest_runtime = AvaRuntimeV2::default();
    let grpc_runtime = runtime;

    // REST server
    let rest_addr: SocketAddr = format!("0.0.0.0:{}", REST_PORT).parse()?;
    let rest_router = create_router(rest_runtime);

    println!("REST API listening on http://localhost:{}", REST_PORT);
    println!("  - List views:    GET  http://localhost:{}/api/v1/views", REST_PORT);
    println!("  - Register view: POST http://localhost:{}/api/v1/views", REST_PORT);
    println!("  - Get spec:      GET  http://localhost:{}/api/v1/views/{{id}}/spec", REST_PORT);
    println!("  - Get status:    GET  http://localhost:{}/api/v1/views/{{id}}/status", REST_PORT);
    println!("  - Invalidate:    POST http://localhost:{}/api/v1/views/{{id}}/invalidate", REST_PORT);
    println!("  - Swagger UI:    http://localhost:{}/swagger-ui", REST_PORT);
    println!();

    // gRPC server - wrap impl in generated tonic wrapper
    let grpc_addr: SocketAddr = format!("0.0.0.0:{}", GRPC_PORT).parse()?;
    let grpc_impl = ViewServiceImpl::new(grpc_runtime);
    let grpc_service = ViewServiceServer::new(grpc_impl);

    println!("gRPC ViewService listening on http://localhost:{}", GRPC_PORT);
    println!();

    // Run both servers concurrently
    let rest_handle = tokio::spawn(async move {
        let listener = tokio::net::TcpListener::bind(rest_addr).await.unwrap();
        axum::serve(listener, rest_router).await.unwrap();
    });

    let grpc_handle = tokio::spawn(async move {
        TonicServer::builder()
            .add_service(grpc_service)
            .serve(grpc_addr)
            .await
            .unwrap();
    });

    println!("Press Ctrl+C to stop the server.\n");

    // Wait for either to finish (or Ctrl+C)
    tokio::select! {
        _ = rest_handle => println!("REST server stopped"),
        _ = grpc_handle => println!("gRPC server stopped"),
        _ = tokio::signal::ctrl_c() => {
            println!("\nShutting down...");
        }
    }

    Ok(())
}
