//! REST API routes for AVA
//!
//! This module provides axum-based REST endpoints for view management.
//!
//! # Architecture
//!
//! ```text
//! Domain Types (ava-domain)  →  REST DTOs (utoipa)  →  JSON Response
//! ```
//!
//! REST DTOs in `dto.rs` provide OpenAPI schema via utoipa, converting
//! from domain types (ViewProfileSpec, etc.) re-exported from ava-runtime.
//!
//! # Routes
//!
//! ## ViewService
//! - `GET  /api/v1/views` - List all registered view specs
//! - `POST /api/v1/views` - Register a new view spec
//! - `GET  /api/v1/views/{id}/spec` - Get view specification
//! - `GET  /api/v1/views/{id}/status` - Get view subscription status
//! - `POST /api/v1/views/{id}/invalidate` - Invalidate view (trigger recomputation)
//!
//! Note: Artifact streaming uses gRPC/WebSocket, not REST.

pub mod dto;
mod routes;

pub use routes::*;
