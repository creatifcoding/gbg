//! Build script for AVA API proto compilation
//!
//! Compiles the proto files using tonic-build for gRPC services.
//! Requires protoc from nix shell (tmnl-grpc module sets PROTOC env var).

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Proto root directory
    let proto_root = "../proto";

    // Proto files to compile
    let protos = [
        "../proto/ava/discovery/v1/discovery.proto",
        "../proto/ava/execution/v1/execution.proto",
        "../proto/ava/registry/v1/registry.proto",
    ];

    // Include paths for proto resolution
    let includes = [proto_root];

    // Configure tonic-build
    tonic_build::configure()
        // Generate server traits
        .build_server(true)
        // Generate client stubs
        .build_client(true)
        // Enable serde derives for JSON serialization
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        // Compile all protos
        .compile_protos(&protos, &includes)?;

    // Re-run if proto files change
    for proto in &protos {
        println!("cargo::rerun-if-changed={}", proto);
    }

    Ok(())
}
