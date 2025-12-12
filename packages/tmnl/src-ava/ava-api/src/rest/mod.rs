//! REST API routes for AVA
//!
//! This module provides axum-based REST endpoints for view management.
//!
//! # Routes
//!
//! - `GET /api/v1/views` - List all views
//! - `POST /api/v1/views` - Register a new view
//! - `GET /api/v1/views/{id}` - Get view details
//! - `POST /api/v1/views/{id}/subscribe` - Subscribe to view (SSE)
//! - `POST /api/v1/views/{id}/invalidate` - Invalidate view
//! - `DELETE /api/v1/views/{id}` - Unsubscribe from view

mod routes;

pub use routes::*;
