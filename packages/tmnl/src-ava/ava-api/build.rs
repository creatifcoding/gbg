//! Build script for AVA API proto compilation
//!
//! Compiles all AVA proto files using tonic-build for gRPC services.
//! Requires protoc from nix shell (tmnl-grpc module sets PROTOC env var).
//!
//! Proto structure:
//! - common/v1:     Foundation types (identifiers, errors, timestamps)
//! - discovery/v1:  Data source discovery (legacy + enhanced in services)
//! - execution/v1:  Spec execution + hydration model
//! - registry/v1:   Templates + assemblages
//! - artifacts/v1:  Runtime view instances + deltas
//! - events/v1:     Reconciler event log + fiber actions
//! - services/v1:   Unified gRPC services with full streaming

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Proto root directory
    let proto_root = "../proto";

    // All proto files to compile (order matters for dependencies)
    let protos = [
        // Foundation (no dependencies)
        "../proto/ava/common/v1/identifiers.proto",
        "../proto/ava/common/v1/timestamps.proto",
        "../proto/ava/common/v1/errors.proto",
        // Discovery (depends on common)
        "../proto/ava/discovery/v1/discovery.proto",
        // Execution (depends on common, discovery)
        "../proto/ava/execution/v1/execution.proto",
        "../proto/ava/execution/v1/hydration.proto",
        // Registry (depends on common, execution)
        "../proto/ava/registry/v1/registry.proto",
        "../proto/ava/registry/v1/assemblages.proto",
        // Artifacts (depends on common, execution)
        "../proto/ava/artifacts/v1/artifacts.proto",
        // Events (depends on common, artifacts)
        "../proto/ava/events/v1/events.proto",
        // Services (depends on all above)
        "../proto/ava/services/v1/services.proto",
    ];

    // Include paths for proto resolution
    let includes = [proto_root];

    // Configure tonic-build
    // Use prost-wkt-types for google.protobuf well-known types (provides serde support)
    // This maps google.protobuf types to prost_wkt_types instead of prost_types
    tonic_build::configure()
        // Generate server traits
        .build_server(true)
        // Generate client stubs
        .build_client(true)
        // Map google.protobuf well-known types to prost-wkt-types (serde-enabled)
        // Note: Empty is automatically mapped by tonic-build, don't override
        .extern_path(".google.protobuf.Timestamp", "::prost_wkt_types::Timestamp")
        .extern_path(".google.protobuf.Duration", "::prost_wkt_types::Duration")
        .extern_path(".google.protobuf.Any", "::prost_wkt_types::Any")
        .extern_path(".google.protobuf.Value", "::prost_wkt_types::Value")
        .extern_path(".google.protobuf.Struct", "::prost_wkt_types::Struct")
        .extern_path(".google.protobuf.ListValue", "::prost_wkt_types::ListValue")
        // Add serde derives to all AVA types for JSON REST API support
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        // Compile all protos
        .compile_protos(&protos, &includes)?;

    // Re-run if any proto file changes
    for proto in &protos {
        println!("cargo::rerun-if-changed={}", proto);
    }

    // Re-run if new protos are added
    println!("cargo::rerun-if-changed=../proto/ava/common/v1/");
    println!("cargo::rerun-if-changed=../proto/ava/discovery/v1/");
    println!("cargo::rerun-if-changed=../proto/ava/execution/v1/");
    println!("cargo::rerun-if-changed=../proto/ava/registry/v1/");
    println!("cargo::rerun-if-changed=../proto/ava/artifacts/v1/");
    println!("cargo::rerun-if-changed=../proto/ava/events/v1/");
    println!("cargo::rerun-if-changed=../proto/ava/services/v1/");

    Ok(())
}
