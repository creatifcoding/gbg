//! Domain types for PRAGMA IPC.
//!
//! DomainResult envelope, request/response payloads.
//! Will be fully implemented in P1 tasks #3176, #3177.

use serde::{Deserialize, Serialize};

/// Three-tier domain result envelope.
///
/// - `Ok`: Full success.
/// - `Degraded`: Primary result available, but with warnings (e.g. fallback model used).
/// - `Error`: No usable result.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "_tag")]
pub enum DomainResult<T> {
    Ok { value: T },
    Degraded { value: T, warnings: Vec<String> },
    Error { code: String, detail: String },
}

/// Intent types classified by the FSM.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IntentType {
    Data,
    Form,
    Layout,
    Feedback,
    Mixed,
    Idle,
}

/// Methods available on the PRAGMA sidecar.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PragmaMethod {
    Warmup,
    Annotate,
    Score,
    Shutdown,
}
