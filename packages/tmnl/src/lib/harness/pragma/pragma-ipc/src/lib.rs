//! # pragma-ipc
//!
//! JSON-RPC 2.0 protocol layer for PRAGMA sidecar communication.
//!
//! Two error tiers:
//! - **Protocol errors**: JSON-RPC error codes (parse, method not found, transport)
//! - **Domain results**: Result envelope with ok/degraded/error for partial success
//!
//! The sidecar is advisory — callers must handle all failure modes gracefully.

pub mod protocol;
pub mod errors;
pub mod types;

pub use protocol::*;
pub use errors::*;
pub use types::*;
