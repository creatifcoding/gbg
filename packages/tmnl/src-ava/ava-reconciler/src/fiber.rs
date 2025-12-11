//! ViewFiber - Runtime state for a view instance
//!
//! A fiber tracks the lifecycle state of a view as it moves through
//! compilation, mounting, updating, and unmounting phases.

use serde::{Deserialize, Serialize};

use ava_domain::{
    ViewId, ViewProfileSpec, ViewArtifact, Lane,
};

/// State of a view fiber in the reconciler
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "state")]
pub enum FiberState {
    /// View requested, awaiting compilation
    Pending,

    /// View compiled, awaiting mount
    Compiled,

    /// View actively mounted and serving data
    Mounted,

    /// View is being updated (spec changed)
    Updating,

    /// View is suspended (temporarily paused)
    Suspended,

    /// View failed to compile
    Failed { error: String },

    /// View is being unmounted
    Unmounting,
}

impl FiberState {
    /// Returns true if the fiber is in a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(self, FiberState::Failed { .. })
    }

    /// Returns true if the fiber is active (can serve data)
    pub fn is_active(&self) -> bool {
        matches!(self, FiberState::Mounted | FiberState::Updating)
    }

    /// Returns true if the fiber can transition to the target state
    pub fn can_transition_to(&self, target: &FiberState) -> bool {
        use FiberState::*;

        match (self, target) {
            // From Pending
            (Pending, Compiled) => true,
            (Pending, Failed { .. }) => true,

            // From Compiled
            (Compiled, Mounted) => true,
            (Compiled, Failed { .. }) => true,

            // From Mounted
            (Mounted, Updating) => true,
            (Mounted, Suspended) => true,
            (Mounted, Unmounting) => true,

            // From Updating
            (Updating, Mounted) => true,
            (Updating, Failed { .. }) => true,

            // From Suspended
            (Suspended, Mounted) => true,
            (Suspended, Unmounting) => true,

            // From Failed
            (Failed { .. }, Pending) => true, // Allow retry

            // From Unmounting
            (Unmounting, _) => false, // Terminal during unmount

            _ => false,
        }
    }
}

/// A view fiber - runtime instance tracking a view's lifecycle
#[derive(Debug, Clone)]
pub struct ViewFiber {
    /// The view identifier
    pub view_id: ViewId,

    /// The desired spec (what the client requested)
    pub spec: ViewProfileSpec,

    /// Current state in the lifecycle
    pub state: FiberState,

    /// Priority lane for scheduling
    pub lane: Lane,

    /// The actual artifact (if mounted)
    pub artifact: Option<ViewArtifact>,

    /// Creation timestamp (ms since epoch)
    pub created_at_ms: f64,

    /// Last state change timestamp
    pub updated_at_ms: f64,

    /// Version counter for optimistic locking
    pub version: u32,
}

impl ViewFiber {
    /// Creates a new fiber in Pending state
    pub fn new(spec: ViewProfileSpec, lane: Lane, timestamp_ms: f64) -> Self {
        Self {
            view_id: spec.id.clone(),
            spec,
            state: FiberState::Pending,
            lane,
            artifact: None,
            created_at_ms: timestamp_ms,
            updated_at_ms: timestamp_ms,
            version: 1,
        }
    }

    /// Transitions to a new state if valid
    pub fn transition(&mut self, new_state: FiberState, timestamp_ms: f64) -> Result<(), String> {
        if !self.state.can_transition_to(&new_state) {
            return Err(format!(
                "Invalid state transition: {:?} -> {:?}",
                self.state, new_state
            ));
        }

        self.state = new_state;
        self.updated_at_ms = timestamp_ms;
        self.version += 1;
        Ok(())
    }

    /// Sets the artifact when the view is mounted
    pub fn set_artifact(&mut self, artifact: ViewArtifact) {
        self.artifact = Some(artifact);
    }

    /// Updates the spec (triggers Updating state)
    pub fn update_spec(&mut self, new_spec: ViewProfileSpec, timestamp_ms: f64) -> Result<(), String> {
        if !matches!(self.state, FiberState::Mounted) {
            return Err("Can only update spec when mounted".into());
        }

        self.spec = new_spec;
        self.state = FiberState::Updating;
        self.updated_at_ms = timestamp_ms;
        self.version += 1;
        Ok(())
    }

    /// Changes the priority lane
    pub fn set_lane(&mut self, lane: Lane) {
        self.lane = lane;
    }

    /// Returns the age of this fiber in milliseconds
    pub fn age_ms(&self, current_time_ms: f64) -> f64 {
        current_time_ms - self.created_at_ms
    }

    /// Returns time since last update in milliseconds
    pub fn staleness_ms(&self, current_time_ms: f64) -> f64 {
        current_time_ms - self.updated_at_ms
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ava_domain::AssemblageId;
    use std::collections::HashMap;

    fn make_test_spec(view_id: &str) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(view_id),
            name: "Test View".into(),
            description: None,
            assemblage_id: AssemblageId::new("test"),
            channels: vec![],
            tags: HashMap::new(),
            version: 1,
        }
    }

    #[test]
    fn test_fiber_creation() {
        let spec = make_test_spec("view-1");
        let fiber = ViewFiber::new(spec, Lane::SoftRealTime, 1000.0);

        assert_eq!(fiber.view_id.as_str(), "view-1");
        assert_eq!(fiber.state, FiberState::Pending);
        assert_eq!(fiber.lane, Lane::SoftRealTime);
        assert!(fiber.artifact.is_none());
        assert_eq!(fiber.version, 1);
    }

    #[test]
    fn test_valid_state_transitions() {
        let spec = make_test_spec("view-1");
        let mut fiber = ViewFiber::new(spec, Lane::Background, 1000.0);

        // Pending -> Compiled
        assert!(fiber.transition(FiberState::Compiled, 1100.0).is_ok());
        assert_eq!(fiber.state, FiberState::Compiled);
        assert_eq!(fiber.version, 2);

        // Compiled -> Mounted
        assert!(fiber.transition(FiberState::Mounted, 1200.0).is_ok());
        assert_eq!(fiber.state, FiberState::Mounted);

        // Mounted -> Updating
        assert!(fiber.transition(FiberState::Updating, 1300.0).is_ok());
        assert_eq!(fiber.state, FiberState::Updating);

        // Updating -> Mounted
        assert!(fiber.transition(FiberState::Mounted, 1400.0).is_ok());
        assert_eq!(fiber.state, FiberState::Mounted);
    }

    #[test]
    fn test_invalid_state_transitions() {
        let spec = make_test_spec("view-1");
        let mut fiber = ViewFiber::new(spec, Lane::Background, 1000.0);

        // Pending -> Mounted (should skip Compiled)
        assert!(fiber.transition(FiberState::Mounted, 1100.0).is_err());

        // Pending -> Suspended (invalid)
        assert!(fiber.transition(FiberState::Suspended, 1100.0).is_err());
    }

    #[test]
    fn test_fiber_state_properties() {
        assert!(!FiberState::Pending.is_terminal());
        assert!(!FiberState::Pending.is_active());
        assert!(FiberState::Mounted.is_active());
        assert!(FiberState::Updating.is_active());
        assert!(FiberState::Failed { error: "test".into() }.is_terminal());
    }

    #[test]
    fn test_lane_change() {
        let spec = make_test_spec("view-1");
        let mut fiber = ViewFiber::new(spec, Lane::Background, 1000.0);

        fiber.set_lane(Lane::HardRealTime);
        assert_eq!(fiber.lane, Lane::HardRealTime);
    }

    #[test]
    fn test_staleness_calculation() {
        let spec = make_test_spec("view-1");
        let fiber = ViewFiber::new(spec, Lane::Background, 1000.0);

        assert_eq!(fiber.age_ms(2000.0), 1000.0);
        assert_eq!(fiber.staleness_ms(2000.0), 1000.0);
    }
}
