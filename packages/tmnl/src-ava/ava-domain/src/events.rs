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
}
