//! AVA API - gRPC and REST endpoints for view lifecycle management
//!
//! This crate provides both gRPC and REST interfaces for managing AVA views.
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────────────────────────┐
//! │                       Clients                                │
//! │  ┌─────────────────┐              ┌─────────────────────┐   │
//! │  │  gRPC Clients   │              │   REST Clients      │   │
//! │  │  (Native apps)  │              │   (Web, scripts)    │   │
//! │  └────────┬────────┘              └──────────┬──────────┘   │
//! └───────────┼───────────────────────────────────┼─────────────┘
//!             │                                   │
//!             ▼                                   ▼
//! ┌───────────────────────┐       ┌───────────────────────────┐
//! │      gRPC Service     │       │      REST Router          │
//! │  ┌─────────────────┐  │       │  ┌─────────────────────┐  │
//! │  │ ViewService     │  │       │  │ /api/v1/views/*     │  │
//! │  └─────────────────┘  │       │  └─────────────────────┘  │
//! └───────────┬───────────┘       └─────────────┬─────────────┘
//!             │                                 │
//!             └─────────────┬───────────────────┘
//!                           ▼
//!             ┌─────────────────────────┐
//!             │      AvaRuntimeV2       │
//!             │  ┌───────────────────┐  │
//!             │  │ HydrationService  │  │
//!             │  │ ReconcilerV2      │  │
//!             │  │ SpecRegistry      │  │
//!             │  └───────────────────┘  │
//!             └─────────────────────────┘
//! ```
//!
//! # Usage
//!
//! ## gRPC Server
//!
//! ```ignore
//! use ava_api::grpc::ViewServiceServer;
//! use ava_runtime::AvaRuntimeV2;
//!
//! let runtime = AvaRuntimeV2::default();
//! let server = ViewServiceServer::new(runtime);
//! // Serve with tonic
//! ```
//!
//! ## REST Server
//!
//! ```ignore
//! use ava_api::rest::create_router;
//! use ava_runtime::AvaRuntimeV2;
//!
//! let runtime = AvaRuntimeV2::default();
//! let router = create_router(runtime);
//! // Serve with axum
//! ```

mod error;

pub mod grpc;
pub mod rest;

/// Generated protobuf types and services
pub mod proto {
    /// Discovery service - source introspection
    pub mod discovery {
        pub mod v1 {
            tonic::include_proto!("ava.discovery.v1");
        }
    }

    /// Execution service - view execution and streaming
    pub mod execution {
        pub mod v1 {
            tonic::include_proto!("ava.execution.v1");
        }
    }

    /// Registry service - templates and assemblages
    pub mod registry {
        pub mod v1 {
            tonic::include_proto!("ava.registry.v1");
        }
    }
}

pub use error::ApiError;

// Re-export commonly used types
pub use ava_runtime::{
    AvaRuntimeV2, RuntimeConfigV2,
    ViewProfileSpec, ViewId, ViewArtifact,
    HydrationService, HydrationConfig, HydrationStrategy,
};
