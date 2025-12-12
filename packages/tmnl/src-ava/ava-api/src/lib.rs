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
    /// Common types - identifiers, errors, timestamps
    pub mod common {
        pub mod v1 {
            tonic::include_proto!("ava.common.v1");
        }
    }

    /// Discovery service - source introspection
    pub mod discovery {
        pub mod v1 {
            tonic::include_proto!("ava.discovery.v1");
        }
    }

    /// Execution service - view execution and hydration
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

    /// Artifacts - runtime view instances and deltas
    pub mod artifacts {
        pub mod v1 {
            tonic::include_proto!("ava.artifacts.v1");
        }
    }

    /// Events - reconciler event log and fiber actions
    pub mod events {
        pub mod v1 {
            tonic::include_proto!("ava.events.v1");
        }
    }

    /// Services - unified gRPC services with streaming
    pub mod services {
        pub mod v1 {
            tonic::include_proto!("ava.services.v1");
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
