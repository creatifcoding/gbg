# ADR-001: REST API Generation from gRPC Proto Source of Truth

**Status:** Accepted
**Date:** 2025-12-12
**Deciders:** Prime, Val
**Tags:** ava-api, rest, grpc, openapi

## Context

AVA exposes gRPC services (ViewService, HydrationService, ReconcilerService, DiscoveryService, AssemblageService) defined in `proto/ava/services/v1/services.proto`. We need a REST API for:

1. Web clients that can't use gRPC directly
2. Simple integrations (curl, scripts, webhooks)
3. OpenAPI documentation for API consumers

The question: **How do we create REST endpoints that stay in sync with gRPC definitions?**

## Decision Drivers

- **Single source of truth**: Proto files define the API contract
- **Type safety**: REST DTOs should match gRPC message types exactly
- **OpenAPI generation**: Auto-generate spec, don't hand-maintain
- **Serde compatibility**: JSON serialization must work seamlessly
- **Minimal duplication**: Don't redefine types in REST layer

## Considered Options

### Option 1: grpc-gateway (Go ecosystem)

Add `google.api.http` annotations to protos, use `protoc-gen-grpc-gateway` to generate a reverse proxy.

```protobuf
rpc GetSpec(GetSpecRequest) returns (ViewProfileSpec) {
  option (google.api.http) = {
    get: "/api/v1/views/{view_id}/spec"
  };
}
```

**Pros:**
- Industry standard approach
- Proto is truly the single source
- OpenAPI generated from same annotations

**Cons:**
- Go-centric tooling
- Adds runtime proxy layer
- Rust ecosystem support is limited
- Additional deployment artifact

### Option 2: utoipa + Proto Types as DTOs

Use `utoipa` crate for OpenAPI generation. Proto-generated Rust types (with serde derives) serve as REST DTOs directly.

```rust
// Proto types already have serde via build.rs:
// .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")

#[utoipa::path(
    get,
    path = "/api/v1/views/{view_id}/spec",
    responses((status = 200, body = ViewProfileSpec))
)]
async fn get_spec(Path(view_id): Path<String>) -> Json<ViewProfileSpec> {
    // Use proto types directly
}
```

**Pros:**
- Native Rust, no proxy
- Proto types used directly (no duplication)
- OpenAPI 3.1 support
- Swagger UI built-in
- Compile-time validation

**Cons:**
- Manual route definitions (not generated from proto)
- Must keep routes in sync with gRPC manually
- utoipa attributes on handlers, not proto

### Option 3: Manual REST with Wrapper Types

Define separate REST DTOs, manually convert to/from proto types.

**Pros:**
- Full control over REST API shape
- Can diverge from gRPC where needed

**Cons:**
- Massive duplication
- Drift risk between REST and gRPC
- No automation

## Decision

**Option 2: utoipa + Proto Types as DTOs**

Rationale:
1. We already have serde on proto types via `prost-wkt-types` integration
2. Adding `utoipa::ToSchema` derive is trivial (one line in build.rs)
3. Rust-native, no external dependencies
4. OpenAPI spec generated at compile time
5. Swagger UI for interactive documentation

The tradeoff (manual route sync) is acceptable because:
- Route definitions are explicit and reviewable
- Type mismatches caught at compile time
- Proto changes that break REST are immediately visible

## Implementation

### 1. Build Configuration

```rust
// build.rs - Proto types get serde only
tonic_build::configure()
    .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
    // Note: utoipa::ToSchema NOT added - prost_wkt_types::Timestamp doesn't implement it
    // ...
```

### 1.1 REST DTO Layer

Since proto types can't derive `ToSchema` (due to `prost_wkt_types::Timestamp`), we define REST-specific DTOs with utoipa derives:

```rust
// rest/dto.rs
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ViewSpecResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub assemblage_id: String,
    pub channels: Vec<ChannelSpecDto>,
    pub version: u32,
}

impl From<proto::ViewProfileSpec> for ViewSpecResponse {
    fn from(spec: proto::ViewProfileSpec) -> Self {
        // Convert proto → DTO
    }
}
```

This pattern provides:
- Clean OpenAPI schemas without proto complexity
- Explicit control over REST API shape
- Compile-time type safety via `From` impls

### 2. REST Route Structure

```
/api/v1/
├── views/
│   ├── GET          → list views
│   ├── POST         → register spec
│   └── {id}/
│       ├── GET /spec      → GetSpec
│       ├── GET /artifact  → GetArtifact
│       ├── GET /status    → GetStatus
│       ├── POST /invalidate → Invalidate
│       └── GET /subscribe → Subscribe (SSE)
├── hydration/
│   └── {view_id}/{channel_id}/
│       ├── GET      → HydrateChannel
│       └── GET /info → GetChannelInfo
├── sources/
│   ├── GET          → ListSources
│   └── {id}/
│       ├── GET           → GetSource
│       ├── GET /schema   → GetSchema
│       ├── GET /capabilities → GetCapabilities
│       └── POST /test    → TestConnection
├── assemblages/
│   ├── POST         → RegisterAssemblage
│   └── {id}/
│       ├── GET      → GetAssemblage
│       └── DELETE   → DeleteAssemblage
├── events/
│   ├── GET /count   → GetEventCount
│   ├── GET /stream  → TailEventLog (SSE)
│   └── timeline/{view_id} → GetViewTimeline
└── reconciler/
    └── GET /health  → GetHealth
```

### 3. Streaming via SSE

gRPC server streaming maps to Server-Sent Events (SSE):

```rust
use axum::response::sse::{Event, Sse};
use futures::stream::Stream;

async fn subscribe(
    Path(view_id): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let stream = // ... create artifact stream
    Sse::new(stream.map(|artifact| {
        Event::default()
            .json_data(&artifact)
            .event("artifact")
    }))
}
```

### 4. OpenAPI Spec Endpoint

```rust
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

#[derive(OpenApi)]
#[openapi(
    paths(get_spec, get_artifact, register_spec, ...),
    components(schemas(ViewProfileSpec, ViewArtifact, ...))
)]
struct ApiDoc;

let app = Router::new()
    .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()));
```

## Consequences

### Positive
- Proto types flow directly to REST responses (zero conversion)
- OpenAPI spec always matches implementation
- Swagger UI provides interactive documentation
- Type errors caught at compile time

### Negative
- Route definitions are manual (not generated)
- Must remember to update REST when gRPC changes
- utoipa attributes add some boilerplate

### Mitigations
- CI check: compare REST routes against proto service methods
- Code review checklist: "Did you update REST routes?"
- Consider future codegen tool for route scaffolding

## References

- [utoipa documentation](https://docs.rs/utoipa)
- [prost-wkt-types](https://docs.rs/prost-wkt-types) - serde for proto types
- [axum SSE](https://docs.rs/axum/latest/axum/response/sse/index.html)
- [gRPC-Gateway](https://grpc-ecosystem.github.io/grpc-gateway/) (rejected option)
