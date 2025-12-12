//! gRPC service implementations for AVA
//!
//! This module provides tonic-based gRPC services for view lifecycle management.
//!
//! # Services
//!
//! - `ViewService`: Subscribe, invalidate, and manage views
//!
//! # Proto Definition
//!
//! The service is defined in `proto/ava.proto` (I44)

mod view_service;

pub use view_service::*;

// Generated code will be included after proto compilation (I44)
// pub mod proto {
//     tonic::include_proto!("ava.v1");
// }
