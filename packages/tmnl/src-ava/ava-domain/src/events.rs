//! Reconciler Event Types
//!
//! Events are the source of truth for the AVA reconciler.
//! The event log enables replay, debugging, and audit trails.

use serde::{Deserialize, Serialize};
use typeshare::typeshare;

use crate::ids::{ViewId, EventSequence};
use crate::views::{ViewProfileSpec, ViewArtifact, ViewDelta};

/// Reconciler event - the source of truth for view lifecycle
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "content")]
pub enum ReconcilerEvent {
    ViewRequested { view_id: ViewId, spec: ViewProfileSpec, timestamp_ms: f64 },
    ViewMounted { view_id: ViewId, artifact: ViewArtifact, timestamp_ms: f64 },
    ViewUpdated { view_id: ViewId, delta: ViewDelta, sequence: EventSequence, timestamp_ms: f64 },
    ViewUnmounted { view_id: ViewId, reason: UnmountReason, timestamp_ms: f64 },
    ViewCompilationFailed { view_id: ViewId, error: String, timestamp_ms: f64 },
    ViewSuspended { view_id: ViewId, reason: String, timestamp_ms: f64 },
    ViewResumed { view_id: ViewId, timestamp_ms: f64 },
}

impl ReconcilerEvent {
    pub fn view_id(&self) -> &ViewId {
        match self {
            ReconcilerEvent::ViewRequested { view_id, .. } => view_id,
            ReconcilerEvent::ViewMounted { view_id, .. } => view_id,
            ReconcilerEvent::ViewUpdated { view_id, .. } => view_id,
            ReconcilerEvent::ViewUnmounted { view_id, .. } => view_id,
            ReconcilerEvent::ViewCompilationFailed { view_id, .. } => view_id,
            ReconcilerEvent::ViewSuspended { view_id, .. } => view_id,
            ReconcilerEvent::ViewResumed { view_id, .. } => view_id,
        }
    }

    pub fn timestamp_ms(&self) -> f64 {
        match self {
            ReconcilerEvent::ViewRequested { timestamp_ms, .. } => *timestamp_ms,
            ReconcilerEvent::ViewMounted { timestamp_ms, .. } => *timestamp_ms,
            ReconcilerEvent::ViewUpdated { timestamp_ms, .. } => *timestamp_ms,
            ReconcilerEvent::ViewUnmounted { timestamp_ms, .. } => *timestamp_ms,
            ReconcilerEvent::ViewCompilationFailed { timestamp_ms, .. } => *timestamp_ms,
            ReconcilerEvent::ViewSuspended { timestamp_ms, .. } => *timestamp_ms,
            ReconcilerEvent::ViewResumed { timestamp_ms, .. } => *timestamp_ms,
        }
    }
}

/// Reason for unmounting a view
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "reason", content = "content")]
pub enum UnmountReason {
    ClientRequest,
    Replaced { new_view_id: ViewId },
    Error { message: String },
    ResourceLimit { message: String },
    AssemblageMismatch,
    Shutdown,
}

/// Priority lane for reconciler scheduling
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum Lane {
    HardRealTime,
    SoftRealTime,
    Background,
}

impl Lane {
    pub fn priority(&self) -> u8 {
        match self {
            Lane::HardRealTime => 3,
            Lane::SoftRealTime => 2,
            Lane::Background => 1,
        }
    }
}

/// Action produced by the reconciler's tick
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "action", content = "content")]
pub enum FiberAction {
    Compile { view_id: ViewId, spec: ViewProfileSpec },
    Mount { view_id: ViewId },
    Update { view_id: ViewId, delta: ViewDelta },
    Unmount { view_id: ViewId, reason: UnmountReason },
    Suspend { view_id: ViewId },
    Resume { view_id: ViewId },
    Noop,
}

/// Event log entry with sequence number
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventLogEntry {
    pub sequence: EventSequence,
    pub event: ReconcilerEvent,
}

// ============================================================================
// NATS Transport Events
// ============================================================================

/// NATS envelope for view artifacts
///
/// Published to subject: `tmnl.ava.artifacts.{view_id}`
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewArtifactEvent {
    /// View identifier
    pub view_id: ViewId,
    /// The artifact payload
    pub artifact: ViewArtifact,
    /// Event timestamp (epoch ms)
    pub timestamp_ms: f64,
    /// Logical sequence for ordering
    pub sequence: u64,
    /// Optional correlation ID for request tracing
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
}

impl ViewArtifactEvent {
    pub fn new(artifact: ViewArtifact, sequence: u64) -> Self {
        Self {
            view_id: artifact.view_id.clone(),
            timestamp_ms: Self::now_ms(),
            artifact,
            sequence,
            correlation_id: None,
        }
    }

    pub fn with_correlation_id(mut self, id: impl Into<String>) -> Self {
        self.correlation_id = Some(id.into());
        self
    }

    fn now_ms() -> f64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs_f64() * 1000.0)
            .unwrap_or(0.0)
    }
}

/// NATS envelope for view deltas
///
/// Published to subject: `tmnl.ava.deltas.{view_id}`
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewDeltaEvent {
    /// View identifier
    pub view_id: ViewId,
    /// The delta payload
    pub delta: ViewDelta,
    /// Event timestamp (epoch ms)
    pub timestamp_ms: f64,
    /// Logical sequence for ordering
    pub sequence: u64,
    /// Artifact version this delta applies to
    pub artifact_version: u32,
    /// Optional correlation ID for request tracing
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
}

impl ViewDeltaEvent {
    pub fn new(view_id: ViewId, delta: ViewDelta, sequence: u64, artifact_version: u32) -> Self {
        Self {
            view_id,
            delta,
            timestamp_ms: Self::now_ms(),
            sequence,
            artifact_version,
            correlation_id: None,
        }
    }

    pub fn with_correlation_id(mut self, id: impl Into<String>) -> Self {
        self.correlation_id = Some(id.into());
        self
    }

    fn now_ms() -> f64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs_f64() * 1000.0)
            .unwrap_or(0.0)
    }
}

/// NATS invalidation request from clients
///
/// Published to subject: `tmnl.ava.invalidate.{view_id}`
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvalidationEvent {
    /// View to invalidate
    pub view_id: ViewId,
    /// Reason for invalidation
    pub reason: InvalidationReason,
    /// Event timestamp (epoch ms)
    pub timestamp_ms: f64,
    /// Optional correlation ID for request tracing
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
    /// Client identifier (for auditing)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_id: Option<String>,
}

/// Reason for view invalidation
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "type", content = "content")]
pub enum InvalidationReason {
    /// Source data changed
    SourceUpdate { source_id: String },
    /// Client explicitly requested refresh
    ClientRequest,
    /// Configuration change requires recompilation
    ConfigChange,
    /// Stale data detected (max age exceeded)
    StaleData { age_ms: f64, max_age_ms: f64 },
    /// Dependency invalidated (cascading)
    DependencyInvalidated { dependency_view_id: ViewId },
    /// Manual/administrative invalidation
    Manual { reason: String },
}

impl InvalidationEvent {
    pub fn client_request(view_id: ViewId) -> Self {
        Self {
            view_id,
            reason: InvalidationReason::ClientRequest,
            timestamp_ms: Self::now_ms(),
            correlation_id: None,
            client_id: None,
        }
    }

    pub fn source_update(view_id: ViewId, source_id: impl Into<String>) -> Self {
        Self {
            view_id,
            reason: InvalidationReason::SourceUpdate { source_id: source_id.into() },
            timestamp_ms: Self::now_ms(),
            correlation_id: None,
            client_id: None,
        }
    }

    pub fn with_correlation_id(mut self, id: impl Into<String>) -> Self {
        self.correlation_id = Some(id.into());
        self
    }

    pub fn with_client_id(mut self, id: impl Into<String>) -> Self {
        self.client_id = Some(id.into());
        self
    }

    fn now_ms() -> f64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs_f64() * 1000.0)
            .unwrap_or(0.0)
    }
}

/// NATS view status event
///
/// Published to subject: `tmnl.ava.status.{view_id}`
#[typeshare]
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ViewStatusEvent {
    /// View identifier
    pub view_id: ViewId,
    /// Current status
    pub status: ViewLifecycleStatus,
    /// Event timestamp (epoch ms)
    pub timestamp_ms: f64,
    /// Optional progress percentage (0-100)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress_pct: Option<u8>,
    /// Optional status message
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// View lifecycle status for NATS status events
#[typeshare]
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ViewLifecycleStatus {
    /// View request received, compilation pending
    Pending,
    /// View is being compiled
    Compiling,
    /// Channels are being hydrated
    Hydrating,
    /// View is ready and broadcasting
    Ready,
    /// View is stale, awaiting recomputation
    Stale,
    /// View encountered an error
    Error,
    /// View is suspended (resource limits)
    Suspended,
    /// View is being unmounted
    Unmounting,
}

impl ViewStatusEvent {
    pub fn new(view_id: ViewId, status: ViewLifecycleStatus) -> Self {
        Self {
            view_id,
            status,
            timestamp_ms: Self::now_ms(),
            progress_pct: None,
            message: None,
        }
    }

    pub fn with_progress(mut self, pct: u8) -> Self {
        self.progress_pct = Some(pct.min(100));
        self
    }

    pub fn with_message(mut self, msg: impl Into<String>) -> Self {
        self.message = Some(msg.into());
        self
    }

    fn now_ms() -> f64 {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs_f64() * 1000.0)
            .unwrap_or(0.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_event_view_id_extraction() {
        let event = ReconcilerEvent::ViewRequested {
            view_id: ViewId::new("view-1"),
            spec: crate::views::ViewProfileSpec {
                id: ViewId::new("view-1"),
                name: "Test".into(),
                description: None,
                assemblage_id: crate::ids::AssemblageId::new("test"),
                channels: vec![],
                tags: std::collections::HashMap::new(),
                version: 1,
            },
            timestamp_ms: 1234567890.0,
        };

        assert_eq!(event.view_id().as_str(), "view-1");
        assert_eq!(event.timestamp_ms(), 1234567890.0);
    }

    #[test]
    fn test_lane_priority() {
        assert!(Lane::HardRealTime.priority() > Lane::SoftRealTime.priority());
        assert!(Lane::SoftRealTime.priority() > Lane::Background.priority());
    }

    #[test]
    fn test_fiber_action_serialization() {
        let action = FiberAction::Unmount {
            view_id: ViewId::new("view-1"),
            reason: UnmountReason::ClientRequest,
        };

        let json = serde_json::to_string(&action).unwrap();
        assert!(json.contains("unmount"));
        assert!(json.contains("clientRequest"));
    }

    // ========================================================================
    // NATS Event Tests
    // ========================================================================

    fn make_test_artifact() -> ViewArtifact {
        ViewArtifact {
            view_id: ViewId::new("view-1"),
            asset_id: None,
            spec: crate::views::ViewProfileSpec {
                id: ViewId::new("view-1"),
                name: "Test".into(),
                description: None,
                assemblage_id: crate::ids::AssemblageId::new("test"),
                channels: vec![],
                tags: std::collections::HashMap::new(),
                version: 1,
            },
            channel_bindings: vec![],
            created_at_ms: 1234567890.0,
            logical_version: 1,
        }
    }

    #[test]
    fn test_view_artifact_event_serialization() {
        let artifact = make_test_artifact();
        let event = ViewArtifactEvent::new(artifact, 42)
            .with_correlation_id("req-123");

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"viewId\":\"view-1\""));
        assert!(json.contains("\"sequence\":42"));
        assert!(json.contains("\"correlationId\":\"req-123\""));

        let parsed: ViewArtifactEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.view_id.as_str(), "view-1");
        assert_eq!(parsed.sequence, 42);
    }

    #[test]
    fn test_view_delta_event_serialization() {
        let delta = ViewDelta::ChannelUpdated {
            channel_id: crate::ids::ChannelId::new("state"),
            row_count: 100,
            timestamp_ms: 1234567890.0,
        };
        let event = ViewDeltaEvent::new(ViewId::new("view-1"), delta, 5, 1);

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"viewId\":\"view-1\""));
        assert!(json.contains("\"artifactVersion\":1"));
        assert!(json.contains("channelUpdated"));

        let parsed: ViewDeltaEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.sequence, 5);
    }

    #[test]
    fn test_invalidation_event_client_request() {
        let event = InvalidationEvent::client_request(ViewId::new("view-1"))
            .with_client_id("client-42")
            .with_correlation_id("req-999");

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"clientRequest\""));
        assert!(json.contains("\"clientId\":\"client-42\""));

        let parsed: InvalidationEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.reason, InvalidationReason::ClientRequest);
    }

    #[test]
    fn test_invalidation_event_source_update() {
        let event = InvalidationEvent::source_update(ViewId::new("view-1"), "db-postgres");

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"type\":\"sourceUpdate\""));
        // Nested in "content" due to tagged enum
        assert!(json.contains("db-postgres"));

        let parsed: InvalidationEvent = serde_json::from_str(&json).unwrap();
        assert!(matches!(parsed.reason, InvalidationReason::SourceUpdate { source_id } if source_id == "db-postgres"));
    }

    #[test]
    fn test_invalidation_reason_stale_data() {
        let reason = InvalidationReason::StaleData {
            age_ms: 5000.0,
            max_age_ms: 3000.0,
        };

        let json = serde_json::to_string(&reason).unwrap();
        assert!(json.contains("\"type\":\"staleData\""));
        // Nested in "content" due to tagged enum, age_ms serializes as float
        assert!(json.contains("5000"));

        let parsed: InvalidationReason = serde_json::from_str(&json).unwrap();
        assert!(matches!(parsed, InvalidationReason::StaleData { age_ms, .. } if age_ms == 5000.0));
    }

    #[test]
    fn test_view_status_event_serialization() {
        let event = ViewStatusEvent::new(ViewId::new("view-1"), ViewLifecycleStatus::Hydrating)
            .with_progress(75)
            .with_message("Loading channels...");

        let json = serde_json::to_string(&event).unwrap();
        assert!(json.contains("\"status\":\"hydrating\""));
        assert!(json.contains("\"progressPct\":75"));
        assert!(json.contains("\"message\":\"Loading channels...\""));

        let parsed: ViewStatusEvent = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed.status, ViewLifecycleStatus::Hydrating);
        assert_eq!(parsed.progress_pct, Some(75));
    }

    #[test]
    fn test_view_lifecycle_status_all_variants() {
        let statuses = [
            ViewLifecycleStatus::Pending,
            ViewLifecycleStatus::Compiling,
            ViewLifecycleStatus::Hydrating,
            ViewLifecycleStatus::Ready,
            ViewLifecycleStatus::Stale,
            ViewLifecycleStatus::Error,
            ViewLifecycleStatus::Suspended,
            ViewLifecycleStatus::Unmounting,
        ];

        for status in statuses {
            let json = serde_json::to_string(&status).unwrap();
            let parsed: ViewLifecycleStatus = serde_json::from_str(&json).unwrap();
            assert_eq!(parsed, status);
        }
    }
}
