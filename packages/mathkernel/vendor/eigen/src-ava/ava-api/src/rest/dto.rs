//! REST Data Transfer Objects
//!
//! These types provide the REST API schema, converting from domain types.
//! Domain types are from ava-domain via ava-runtime re-exports.
//!
//! Why separate DTOs?
//! - utoipa::ToSchema derives for OpenAPI generation
//! - Explicit control over REST API shape and serialization
//! - Clean separation between internal domain and external API

use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ============================================================================
// ViewService DTOs
// ============================================================================

/// View specification summary (list response)
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ViewSummary {
    /// Unique view identifier
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Spec version number
    pub version: u32,
}

/// Full view specification (response)
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ViewSpecResponse {
    /// Unique view identifier
    pub id: String,
    /// Human-readable name
    pub name: String,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Assemblage this view belongs to
    pub assemblage_id: String,
    /// Channel specifications
    pub channels: Vec<ChannelSpecDto>,
    /// Spec version number
    pub version: u32,
    /// Tags/metadata
    #[serde(default, skip_serializing_if = "std::collections::HashMap::is_empty")]
    pub tags: std::collections::HashMap<String, String>,
}

/// Channel specification within a view
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ChannelSpecDto {
    /// Channel identifier
    pub id: String,
    /// Channel role (State, Event, Metric, Command, Log)
    pub role: String,
    /// Source connection string
    pub source_connection: String,
    /// Materialization tier (OnDemand, Cached, Continuous)
    pub materialization: String,
    /// Refresh interval in milliseconds (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refresh_ms: Option<u64>,
}

/// View artifact (runtime state)
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ViewArtifactResponse {
    /// View identifier
    pub view_id: String,
    /// Asset identifier (if bound to specific asset)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub asset_id: Option<String>,
    /// Current spec
    pub spec: ViewSpecResponse,
    /// Channel bindings with data
    pub channel_bindings: Vec<ChannelBindingDto>,
    /// Creation timestamp (milliseconds since epoch)
    pub created_at_ms: f64,
    /// Logical version (increments on update)
    pub version: u32,
}

/// Channel binding (runtime channel state)
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ChannelBindingDto {
    /// Channel identifier
    pub channel_id: String,
    /// Channel role
    pub role: String,
    /// Whether channel is active
    pub active: bool,
    /// Row count (if applicable)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub row_count: Option<u32>,
    /// Last update timestamp (milliseconds since epoch)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_updated_ms: Option<f64>,
}

/// View status
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ViewStatusResponse {
    /// View identifier
    pub view_id: String,
    /// Whether the view is subscribed/active
    pub is_subscribed: bool,
    /// Current version (from spec)
    pub version: u32,
    /// Number of active subscribers (system-wide)
    pub total_subscriptions: usize,
}

/// Error details
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ErrorDto {
    /// Error code
    pub code: String,
    /// Human-readable message
    pub message: String,
    /// Additional details
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
}

// ============================================================================
// Request DTOs
// ============================================================================

/// Register a new view spec
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RegisterSpecRequest {
    /// View identifier (optional, generated if not provided)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    /// Human-readable name
    pub name: String,
    /// Optional description
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Assemblage this view belongs to
    pub assemblage_id: String,
    /// Channel specifications
    pub channels: Vec<RegisterChannelRequest>,
    /// Whether to overwrite existing spec
    #[serde(default)]
    pub overwrite_existing: bool,
}

/// Channel specification for registration
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RegisterChannelRequest {
    /// Channel identifier
    pub id: String,
    /// Channel role (state, event, metric, command, log)
    pub role: String,
    /// Source connection string
    pub source_connection: String,
    /// Materialization tier (optional, defaults to cached)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub materialization: Option<String>,
}

/// Response after registering a spec
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct RegisterSpecResponse {
    /// Created view identifier
    pub view_id: String,
    /// Whether a new spec was created (vs updated)
    pub was_created: bool,
    /// New version number
    pub version: u32,
}

/// Invalidate a view
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct InvalidateRequest {
    /// Reason for invalidation
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

/// Response after invalidation
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct InvalidateResponse {
    /// View that was invalidated
    pub view_id: String,
    /// Confirmation message
    pub message: String,
}

// ============================================================================
// Conversions from Domain Types
// ============================================================================

use ava_runtime::{
    ViewProfileSpec, ViewArtifact, ChannelPipelineSpec, ChannelBinding,
};

impl ViewSummary {
    pub fn from_spec(spec: &ViewProfileSpec) -> Self {
        Self {
            id: spec.id.0.clone(),
            name: spec.name.clone(),
            version: spec.version,
        }
    }
}

impl ViewSpecResponse {
    pub fn from_spec(spec: &ViewProfileSpec) -> Self {
        Self {
            id: spec.id.0.clone(),
            name: spec.name.clone(),
            description: spec.description.clone(),
            assemblage_id: spec.assemblage_id.0.clone(),
            channels: spec.channels.iter().map(ChannelSpecDto::from_channel).collect(),
            version: spec.version,
            tags: spec.tags.clone(),
        }
    }
}

impl ChannelSpecDto {
    pub fn from_channel(channel: &ChannelPipelineSpec) -> Self {
        Self {
            id: channel.id.0.clone(),
            role: format!("{:?}", channel.role),
            source_connection: channel.source.connection.clone(),
            materialization: format!("{:?}", channel.materialization),
            refresh_ms: channel.refresh_ms.map(|v| v as u64),
        }
    }
}

impl ViewArtifactResponse {
    pub fn from_artifact(artifact: &ViewArtifact) -> Self {
        Self {
            view_id: artifact.view_id.0.clone(),
            asset_id: artifact.asset_id.as_ref().map(|a| a.0.clone()),
            spec: ViewSpecResponse::from_spec(&artifact.spec),
            channel_bindings: artifact.channel_bindings.iter().map(ChannelBindingDto::from_binding).collect(),
            created_at_ms: artifact.created_at_ms,
            version: artifact.logical_version,
        }
    }
}

impl ChannelBindingDto {
    pub fn from_binding(binding: &ChannelBinding) -> Self {
        Self {
            channel_id: binding.channel_id.0.clone(),
            role: format!("{:?}", binding.role),
            active: binding.active,
            row_count: binding.row_count,
            last_updated_ms: binding.last_updated_ms,
        }
    }
}

// ============================================================================
// WebSocket Session DTOs (Bidirectional Streaming)
// ============================================================================

/// Commands sent from client to server over WebSocket
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SessionCommand {
    /// Subscribe to a view's artifact updates
    Subscribe {
        /// View identifier to subscribe to
        view_id: String,
    },
    /// Unsubscribe from a view
    Unsubscribe {
        /// View identifier to unsubscribe from
        view_id: String,
    },
    /// Invalidate a view (trigger recompilation)
    Invalidate {
        /// View identifier to invalidate
        view_id: String,
        /// Optional reason for invalidation
        #[serde(skip_serializing_if = "Option::is_none")]
        reason: Option<String>,
    },
    /// Ping to check connection liveness
    Ping {
        /// Optional payload to echo back
        #[serde(skip_serializing_if = "Option::is_none")]
        payload: Option<String>,
    },
}

/// Events sent from server to client over WebSocket
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum SessionEvent {
    /// View artifact update
    Artifact {
        /// The updated artifact
        artifact: ViewArtifactResponse,
    },
    /// View delta (channel update only)
    Delta {
        /// View identifier
        view_id: String,
        /// Channel that was updated
        channel_id: String,
        /// New row count
        row_count: Option<u32>,
        /// Update timestamp
        timestamp_ms: f64,
    },
    /// Status update for a subscription
    Status {
        /// View identifier
        view_id: String,
        /// Whether subscription is active
        subscribed: bool,
        /// Human-readable message
        message: String,
    },
    /// Error occurred
    Error {
        /// Associated view (if applicable)
        #[serde(skip_serializing_if = "Option::is_none")]
        view_id: Option<String>,
        /// Error code
        code: String,
        /// Error message
        message: String,
    },
    /// Pong response to ping
    Pong {
        /// Echoed payload
        #[serde(skip_serializing_if = "Option::is_none")]
        payload: Option<String>,
    },
}
