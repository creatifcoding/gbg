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

    fn make_test_spec_with_version(view_id: &str, version: u32) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(view_id),
            name: format!("Test View v{}", version),
            description: Some(format!("Version {}", version)),
            assemblage_id: AssemblageId::new("test"),
            channels: vec![],
            tags: HashMap::new(),
            version,
        }
    }

    fn make_test_artifact(view_id: &str) -> ViewArtifact {
        ViewArtifact {
            view_id: ViewId::new(view_id),
            asset_id: None,
            spec: make_test_spec(view_id),
            channel_bindings: vec![],
            created_at_ms: 1000.0,
            logical_version: 1,
        }
    }

    // ========== Creation Tests ==========

    #[test]
    fn test_fiber_creation() {
        let spec = make_test_spec("view-1");
        let fiber = ViewFiber::new(spec.clone(), Lane::SoftRealTime, 1000.0);

        assert_eq!(fiber.view_id.as_str(), "view-1");
        assert_eq!(fiber.state, FiberState::Pending);
        assert_eq!(fiber.lane, Lane::SoftRealTime);
        assert!(fiber.artifact.is_none());
        assert_eq!(fiber.version, 1);
        assert_eq!(fiber.created_at_ms, 1000.0);
        assert_eq!(fiber.updated_at_ms, 1000.0);
        assert_eq!(fiber.spec.id, spec.id);
    }

    #[test]
    fn test_fiber_creation_all_lanes() {
        for lane in [Lane::HardRealTime, Lane::SoftRealTime, Lane::Background] {
            let fiber = ViewFiber::new(make_test_spec("test"), lane.clone(), 0.0);
            assert_eq!(fiber.lane, lane);
        }
    }

    // ========== State Transition Tests ==========

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
    fn test_pending_to_failed_transition() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);

        assert!(fiber.transition(FiberState::Failed { error: "compile error".into() }, 1100.0).is_ok());
        assert!(matches!(fiber.state, FiberState::Failed { .. }));
    }

    #[test]
    fn test_compiled_to_failed_transition() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Compiled, 1100.0).unwrap();

        assert!(fiber.transition(FiberState::Failed { error: "mount error".into() }, 1200.0).is_ok());
        assert!(matches!(fiber.state, FiberState::Failed { .. }));
    }

    #[test]
    fn test_mounted_to_suspended_transition() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Compiled, 1100.0).unwrap();
        fiber.transition(FiberState::Mounted, 1200.0).unwrap();

        assert!(fiber.transition(FiberState::Suspended, 1300.0).is_ok());
        assert_eq!(fiber.state, FiberState::Suspended);
    }

    #[test]
    fn test_suspended_to_mounted_resume() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Compiled, 1100.0).unwrap();
        fiber.transition(FiberState::Mounted, 1200.0).unwrap();
        fiber.transition(FiberState::Suspended, 1300.0).unwrap();

        assert!(fiber.transition(FiberState::Mounted, 1400.0).is_ok());
        assert_eq!(fiber.state, FiberState::Mounted);
    }

    #[test]
    fn test_suspended_to_unmounting_transition() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Compiled, 1100.0).unwrap();
        fiber.transition(FiberState::Mounted, 1200.0).unwrap();
        fiber.transition(FiberState::Suspended, 1300.0).unwrap();

        assert!(fiber.transition(FiberState::Unmounting, 1400.0).is_ok());
        assert_eq!(fiber.state, FiberState::Unmounting);
    }

    #[test]
    fn test_mounted_to_unmounting_transition() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Compiled, 1100.0).unwrap();
        fiber.transition(FiberState::Mounted, 1200.0).unwrap();

        assert!(fiber.transition(FiberState::Unmounting, 1300.0).is_ok());
        assert_eq!(fiber.state, FiberState::Unmounting);
    }

    #[test]
    fn test_unmounting_is_terminal() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Compiled, 1100.0).unwrap();
        fiber.transition(FiberState::Mounted, 1200.0).unwrap();
        fiber.transition(FiberState::Unmounting, 1300.0).unwrap();

        // Cannot transition out of Unmounting
        assert!(fiber.transition(FiberState::Mounted, 1400.0).is_err());
        assert!(fiber.transition(FiberState::Pending, 1400.0).is_err());
        assert!(fiber.transition(FiberState::Failed { error: "x".into() }, 1400.0).is_err());
    }

    #[test]
    fn test_failed_can_retry() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Failed { error: "initial error".into() }, 1100.0).unwrap();

        // Can retry by going back to Pending
        assert!(fiber.transition(FiberState::Pending, 1200.0).is_ok());
        assert_eq!(fiber.state, FiberState::Pending);
    }

    #[test]
    fn test_updating_to_failed_transition() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Compiled, 1100.0).unwrap();
        fiber.transition(FiberState::Mounted, 1200.0).unwrap();
        fiber.transition(FiberState::Updating, 1300.0).unwrap();

        assert!(fiber.transition(FiberState::Failed { error: "update failed".into() }, 1400.0).is_ok());
        assert!(matches!(fiber.state, FiberState::Failed { .. }));
    }

    #[test]
    fn test_transition_updates_timestamp_and_version() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        assert_eq!(fiber.version, 1);
        assert_eq!(fiber.updated_at_ms, 1000.0);

        fiber.transition(FiberState::Compiled, 2000.0).unwrap();
        assert_eq!(fiber.version, 2);
        assert_eq!(fiber.updated_at_ms, 2000.0);

        fiber.transition(FiberState::Mounted, 3000.0).unwrap();
        assert_eq!(fiber.version, 3);
        assert_eq!(fiber.updated_at_ms, 3000.0);
    }

    // ========== State Properties Tests ==========

    #[test]
    fn test_fiber_state_properties() {
        assert!(!FiberState::Pending.is_terminal());
        assert!(!FiberState::Pending.is_active());
        assert!(FiberState::Mounted.is_active());
        assert!(FiberState::Updating.is_active());
        assert!(FiberState::Failed { error: "test".into() }.is_terminal());
    }

    #[test]
    fn test_is_active_exhaustive() {
        assert!(!FiberState::Pending.is_active());
        assert!(!FiberState::Compiled.is_active());
        assert!(FiberState::Mounted.is_active());
        assert!(FiberState::Updating.is_active());
        assert!(!FiberState::Suspended.is_active());
        assert!(!FiberState::Failed { error: "x".into() }.is_active());
        assert!(!FiberState::Unmounting.is_active());
    }

    #[test]
    fn test_is_terminal_exhaustive() {
        assert!(!FiberState::Pending.is_terminal());
        assert!(!FiberState::Compiled.is_terminal());
        assert!(!FiberState::Mounted.is_terminal());
        assert!(!FiberState::Updating.is_terminal());
        assert!(!FiberState::Suspended.is_terminal());
        assert!(FiberState::Failed { error: "x".into() }.is_terminal());
        assert!(!FiberState::Unmounting.is_terminal()); // Terminal during unmount conceptually but not "failed"
    }

    #[test]
    fn test_can_transition_to_self_fails() {
        // Same-state transitions should fail
        assert!(!FiberState::Pending.can_transition_to(&FiberState::Pending));
        assert!(!FiberState::Compiled.can_transition_to(&FiberState::Compiled));
        assert!(!FiberState::Mounted.can_transition_to(&FiberState::Mounted));
    }

    // ========== Lane Tests ==========

    #[test]
    fn test_lane_change() {
        let spec = make_test_spec("view-1");
        let mut fiber = ViewFiber::new(spec, Lane::Background, 1000.0);

        fiber.set_lane(Lane::HardRealTime);
        assert_eq!(fiber.lane, Lane::HardRealTime);

        fiber.set_lane(Lane::SoftRealTime);
        assert_eq!(fiber.lane, Lane::SoftRealTime);
    }

    #[test]
    fn test_lane_change_doesnt_affect_version() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        let version_before = fiber.version;

        fiber.set_lane(Lane::HardRealTime);

        assert_eq!(fiber.version, version_before); // Lane change doesn't bump version
    }

    // ========== Artifact Tests ==========

    #[test]
    fn test_set_artifact() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        assert!(fiber.artifact.is_none());

        let artifact = make_test_artifact("view-1");
        fiber.set_artifact(artifact.clone());

        assert!(fiber.artifact.is_some());
        assert_eq!(fiber.artifact.as_ref().unwrap().view_id, artifact.view_id);
    }

    #[test]
    fn test_artifact_can_be_replaced() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);

        let artifact1 = ViewArtifact {
            view_id: ViewId::new("view-1"),
            asset_id: None,
            spec: make_test_spec("view-1"),
            channel_bindings: vec![],
            created_at_ms: 1000.0,
            logical_version: 1,
        };
        fiber.set_artifact(artifact1);

        let artifact2 = ViewArtifact {
            view_id: ViewId::new("view-1"),
            asset_id: None,
            spec: make_test_spec("view-1"),
            channel_bindings: vec![],
            created_at_ms: 2000.0,
            logical_version: 2,
        };
        fiber.set_artifact(artifact2);

        assert_eq!(fiber.artifact.as_ref().unwrap().logical_version, 2);
    }

    // ========== Update Spec Tests ==========

    #[test]
    fn test_update_spec_requires_mounted_state() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);

        // Cannot update in Pending state
        let new_spec = make_test_spec_with_version("view-1", 2);
        assert!(fiber.update_spec(new_spec.clone(), 2000.0).is_err());

        // Transition to Mounted
        fiber.transition(FiberState::Compiled, 1100.0).unwrap();
        fiber.transition(FiberState::Mounted, 1200.0).unwrap();

        // Now update should work
        assert!(fiber.update_spec(new_spec, 2000.0).is_ok());
        assert_eq!(fiber.state, FiberState::Updating);
    }

    #[test]
    fn test_update_spec_sets_updating_state() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Compiled, 1100.0).unwrap();
        fiber.transition(FiberState::Mounted, 1200.0).unwrap();

        let new_spec = make_test_spec_with_version("view-1", 2);
        fiber.update_spec(new_spec.clone(), 2000.0).unwrap();

        assert_eq!(fiber.state, FiberState::Updating);
        assert_eq!(fiber.spec.version, 2);
        assert_eq!(fiber.spec.name, "Test View v2");
    }

    #[test]
    fn test_update_spec_increments_version() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Compiled, 1100.0).unwrap();
        fiber.transition(FiberState::Mounted, 1200.0).unwrap();

        let version_before = fiber.version;
        fiber.update_spec(make_test_spec_with_version("view-1", 2), 2000.0).unwrap();

        assert_eq!(fiber.version, version_before + 1);
    }

    #[test]
    fn test_update_spec_updates_timestamp() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Compiled, 1100.0).unwrap();
        fiber.transition(FiberState::Mounted, 1200.0).unwrap();

        fiber.update_spec(make_test_spec_with_version("view-1", 2), 5000.0).unwrap();

        assert_eq!(fiber.updated_at_ms, 5000.0);
    }

    #[test]
    fn test_update_spec_fails_in_wrong_states() {
        let states_to_test = vec![
            FiberState::Pending,
            FiberState::Compiled,
            FiberState::Updating,
            FiberState::Suspended,
            FiberState::Failed { error: "x".into() },
            FiberState::Unmounting,
        ];

        for state in states_to_test {
            let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
            // Force state for testing (bypassing normal transitions)
            fiber.state = state.clone();

            let result = fiber.update_spec(make_test_spec_with_version("view-1", 2), 2000.0);
            assert!(result.is_err(), "Expected error for state {:?}", state);
        }
    }

    // ========== Time Calculation Tests ==========

    #[test]
    fn test_staleness_calculation() {
        let spec = make_test_spec("view-1");
        let fiber = ViewFiber::new(spec, Lane::Background, 1000.0);

        assert_eq!(fiber.age_ms(2000.0), 1000.0);
        assert_eq!(fiber.staleness_ms(2000.0), 1000.0);
    }

    #[test]
    fn test_age_vs_staleness_after_update() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);

        // Age increases continuously from creation
        assert_eq!(fiber.age_ms(5000.0), 4000.0);

        // Staleness is from last update
        fiber.transition(FiberState::Compiled, 3000.0).unwrap();
        assert_eq!(fiber.age_ms(5000.0), 4000.0);      // Still from creation
        assert_eq!(fiber.staleness_ms(5000.0), 2000.0); // From last update at 3000
    }

    #[test]
    fn test_staleness_zero_at_update_time() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Compiled, 2000.0).unwrap();

        assert_eq!(fiber.staleness_ms(2000.0), 0.0);
    }

    #[test]
    fn test_negative_time_handled() {
        let fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);

        // If current time is before creation (shouldn't happen but test edge case)
        assert_eq!(fiber.age_ms(500.0), -500.0);
    }

    // ========== Full Lifecycle Tests ==========

    #[test]
    fn test_full_happy_path_lifecycle() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::SoftRealTime, 1000.0);

        // Pending -> Compiled
        assert!(fiber.transition(FiberState::Compiled, 1100.0).is_ok());
        assert_eq!(fiber.version, 2);

        // Compiled -> Mounted
        assert!(fiber.transition(FiberState::Mounted, 1200.0).is_ok());
        assert_eq!(fiber.version, 3);

        // Set artifact when mounted
        fiber.set_artifact(make_test_artifact("view-1"));
        assert!(fiber.artifact.is_some());

        // Mounted -> Updating (spec change)
        fiber.update_spec(make_test_spec_with_version("view-1", 2), 1300.0).unwrap();
        assert_eq!(fiber.state, FiberState::Updating);
        assert_eq!(fiber.version, 4);

        // Updating -> Mounted (update complete)
        assert!(fiber.transition(FiberState::Mounted, 1400.0).is_ok());
        assert_eq!(fiber.version, 5);

        // Mounted -> Unmounting
        assert!(fiber.transition(FiberState::Unmounting, 1500.0).is_ok());
        assert_eq!(fiber.version, 6);
    }

    #[test]
    fn test_suspend_resume_cycle() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);
        fiber.transition(FiberState::Compiled, 1100.0).unwrap();
        fiber.transition(FiberState::Mounted, 1200.0).unwrap();

        // Multiple suspend/resume cycles
        for i in 0..3 {
            fiber.transition(FiberState::Suspended, 1300.0 + (i as f64 * 200.0)).unwrap();
            assert_eq!(fiber.state, FiberState::Suspended);

            fiber.transition(FiberState::Mounted, 1400.0 + (i as f64 * 200.0)).unwrap();
            assert_eq!(fiber.state, FiberState::Mounted);
        }
    }

    #[test]
    fn test_error_recovery_cycle() {
        let mut fiber = ViewFiber::new(make_test_spec("view-1"), Lane::Background, 1000.0);

        // First attempt fails
        fiber.transition(FiberState::Failed { error: "network error".into() }, 1100.0).unwrap();
        assert!(matches!(fiber.state, FiberState::Failed { .. }));

        // Retry
        fiber.transition(FiberState::Pending, 1200.0).unwrap();
        assert_eq!(fiber.state, FiberState::Pending);

        // Second attempt succeeds
        fiber.transition(FiberState::Compiled, 1300.0).unwrap();
        fiber.transition(FiberState::Mounted, 1400.0).unwrap();
        assert_eq!(fiber.state, FiberState::Mounted);
    }
}
