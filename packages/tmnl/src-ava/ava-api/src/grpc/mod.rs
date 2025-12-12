//! gRPC service implementations for AVA
//!
//! This module provides tonic-based gRPC services for view lifecycle management.
//!
//! # Services
//!
//! - `ViewService`: Subscribe, invalidate, and manage views
//!
//! # Usage
//!
//! ```ignore
//! use ava_api::grpc::ViewServiceImpl;
//! use ava_api::proto::services::v1::view_service_server::ViewServiceServer;
//!
//! let impl_ = ViewServiceImpl::new(runtime);
//! let service = ViewServiceServer::new(impl_);  // Generated wrapper
//! Server::builder().add_service(service).serve(addr).await?;
//! ```
//!
//! # Proto Definition
//!
//! The service is defined in `proto/ava/services/v1/services.proto`

mod view_service;

pub use view_service::ViewServiceImpl;
