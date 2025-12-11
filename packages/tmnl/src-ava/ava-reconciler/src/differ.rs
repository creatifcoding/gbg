//! Differ - Compares desired view tree vs active fibers
//!
//! The differ produces FiberActions that bring the actual state
//! (active fibers) toward the desired state (requested specs).

use std::collections::{HashMap, HashSet};

use ava_domain::{
    ViewId, ViewProfileSpec, FiberAction, UnmountReason,
};

use crate::fiber::{ViewFiber, FiberState};

/// Result of diffing desired vs actual state
#[derive(Debug, Clone)]
pub struct DiffResult {
    /// Actions to execute to reconcile state
    pub actions: Vec<FiberAction>,

    /// Views that need to be compiled (new)
    pub to_compile: Vec<ViewId>,

    /// Views that need to be updated (spec changed)
    pub to_update: Vec<ViewId>,

    /// Views that need to be unmounted (removed from desired)
    pub to_unmount: Vec<ViewId>,

    /// Views that are unchanged
    pub unchanged: Vec<ViewId>,
}

impl DiffResult {
    pub fn empty() -> Self {
        Self {
            actions: Vec::new(),
            to_compile: Vec::new(),
            to_update: Vec::new(),
            to_unmount: Vec::new(),
            unchanged: Vec::new(),
        }
    }

    pub fn has_changes(&self) -> bool {
        !self.actions.is_empty()
    }
}

/// Differ compares desired specs vs active fibers
pub struct Differ;

impl Differ {
    /// Computes the diff between desired specs and active fibers
    ///
    /// # Arguments
    /// * `desired` - Map of view_id -> spec representing what the client wants
    /// * `active` - Map of view_id -> fiber representing current state
    ///
    /// # Returns
    /// A DiffResult containing the actions needed to reconcile state
    pub fn diff(
        desired: &HashMap<ViewId, ViewProfileSpec>,
        active: &HashMap<ViewId, ViewFiber>,
    ) -> DiffResult {
        let mut result = DiffResult::empty();

        let desired_ids: HashSet<_> = desired.keys().collect();
        let active_ids: HashSet<_> = active.keys().collect();

        // Views in desired but not in active -> need compile
        for view_id in desired_ids.difference(&active_ids) {
            let spec = desired.get(*view_id).unwrap().clone();
            result.to_compile.push((*view_id).clone());
            result.actions.push(FiberAction::Compile {
                view_id: (*view_id).clone(),
                spec,
            });
        }

        // Views in active but not in desired -> need unmount
        for view_id in active_ids.difference(&desired_ids) {
            result.to_unmount.push((*view_id).clone());
            result.actions.push(FiberAction::Unmount {
                view_id: (*view_id).clone(),
                reason: UnmountReason::ClientRequest,
            });
        }

        // Views in both -> check if spec changed
        for view_id in desired_ids.intersection(&active_ids) {
            let desired_spec = desired.get(*view_id).unwrap();
            let fiber = active.get(*view_id).unwrap();

            if Self::spec_changed(desired_spec, &fiber.spec) {
                result.to_update.push((*view_id).clone());
                let delta = Self::compute_delta(desired_spec, &fiber.spec);
                result.actions.push(FiberAction::Update {
                    view_id: (*view_id).clone(),
                    delta,
                });
            } else {
                result.unchanged.push((*view_id).clone());
            }
        }

        result
    }

    /// Checks if a spec has changed meaningfully
    fn spec_changed(desired: &ViewProfileSpec, current: &ViewProfileSpec) -> bool {
        // Version bump always indicates change
        if desired.version != current.version {
            return true;
        }

        // Check structural equality
        desired.name != current.name
            || desired.description != current.description
            || desired.assemblage_id != current.assemblage_id
            || desired.channels.len() != current.channels.len()
            || desired.channels != current.channels
    }

    /// Computes a delta between two specs
    ///
    /// Since ViewDelta represents runtime changes (channel updates, activations),
    /// we use ArtifactReplaced for spec-level updates that require recompilation.
    fn compute_delta(
        desired: &ViewProfileSpec,
        _current: &ViewProfileSpec,
    ) -> ava_domain::ViewDelta {
        use ava_domain::ViewDelta;

        // For spec changes, we replace the entire artifact
        // This triggers recompilation of the view
        ViewDelta::ArtifactReplaced {
            artifact: Box::new(ava_domain::ViewArtifact {
                view_id: desired.id.clone(),
                asset_id: None,
                spec: desired.clone(),
                channel_bindings: vec![],
                created_at_ms: 0.0, // Will be set by reconciler
                logical_version: desired.version,
            }),
        }
    }

    /// Computes actions for suspended fibers that should be resumed
    pub fn compute_resume_actions(
        active: &HashMap<ViewId, ViewFiber>,
        view_ids: &[ViewId],
    ) -> Vec<FiberAction> {
        view_ids
            .iter()
            .filter_map(|id| {
                active.get(id).and_then(|fiber| {
                    if matches!(fiber.state, FiberState::Suspended) {
                        Some(FiberAction::Resume {
                            view_id: id.clone(),
                        })
                    } else {
                        None
                    }
                })
            })
            .collect()
    }

    /// Computes actions for active fibers that should be suspended
    pub fn compute_suspend_actions(
        active: &HashMap<ViewId, ViewFiber>,
        view_ids: &[ViewId],
    ) -> Vec<FiberAction> {
        view_ids
            .iter()
            .filter_map(|id| {
                active.get(id).and_then(|fiber| {
                    if fiber.state.is_active() {
                        Some(FiberAction::Suspend {
                            view_id: id.clone(),
                        })
                    } else {
                        None
                    }
                })
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ava_domain::{AssemblageId, ChannelPipelineSpec, ChannelId, ChannelRole, SourceSpec, SourceKind, SourceId, MaterializationTier, Lane};

    fn make_spec(view_id: &str, version: u32) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(view_id),
            name: format!("View {}", view_id),
            description: None,
            assemblage_id: AssemblageId::new("test"),
            channels: vec![],
            tags: HashMap::new(),
            version,
        }
    }

    fn make_spec_with_name(view_id: &str, version: u32, name: &str) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(view_id),
            name: name.to_string(),
            description: None,
            assemblage_id: AssemblageId::new("test"),
            channels: vec![],
            tags: HashMap::new(),
            version,
        }
    }

    fn make_spec_with_description(view_id: &str, version: u32, desc: Option<String>) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(view_id),
            name: format!("View {}", view_id),
            description: desc,
            assemblage_id: AssemblageId::new("test"),
            channels: vec![],
            tags: HashMap::new(),
            version,
        }
    }

    fn make_spec_with_assemblage(view_id: &str, version: u32, assemblage: &str) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(view_id),
            name: format!("View {}", view_id),
            description: None,
            assemblage_id: AssemblageId::new(assemblage),
            channels: vec![],
            tags: HashMap::new(),
            version,
        }
    }

    fn make_spec_with_channels(view_id: &str, version: u32, channel_count: usize) -> ViewProfileSpec {
        let channels: Vec<ChannelPipelineSpec> = (0..channel_count)
            .map(|i| ChannelPipelineSpec {
                id: ChannelId::new(&format!("channel-{}", i)),
                role: ChannelRole::State,
                source: SourceSpec {
                    id: SourceId::new(&format!("source-{}", i)),
                    kind: SourceKind::Stream,
                    connection: format!("connection-{}", i),
                    schema: None,
                },
                additional_sources: vec![],
                pipeline: vec![],
                materialization: MaterializationTier::Cached,
                refresh_ms: Some(1000),
            })
            .collect();

        ViewProfileSpec {
            id: ViewId::new(view_id),
            name: format!("View {}", view_id),
            description: None,
            assemblage_id: AssemblageId::new("test"),
            channels,
            tags: HashMap::new(),
            version,
        }
    }

    fn make_fiber(spec: ViewProfileSpec) -> ViewFiber {
        ViewFiber::new(spec, Lane::Background, 1000.0)
    }

    fn make_fiber_with_lane(spec: ViewProfileSpec, lane: Lane) -> ViewFiber {
        ViewFiber::new(spec, lane, 1000.0)
    }

    // ========== Basic Operations ==========

    #[test]
    fn test_diff_result_empty() {
        let result = DiffResult::empty();
        assert!(result.actions.is_empty());
        assert!(result.to_compile.is_empty());
        assert!(result.to_update.is_empty());
        assert!(result.to_unmount.is_empty());
        assert!(result.unchanged.is_empty());
        assert!(!result.has_changes());
    }

    #[test]
    fn test_diff_empty_desired_and_active() {
        let desired: HashMap<ViewId, ViewProfileSpec> = HashMap::new();
        let active: HashMap<ViewId, ViewFiber> = HashMap::new();

        let result = Differ::diff(&desired, &active);

        assert!(!result.has_changes());
        assert!(result.to_compile.is_empty());
        assert!(result.to_update.is_empty());
        assert!(result.to_unmount.is_empty());
        assert!(result.unchanged.is_empty());
    }

    // ========== Compile Tests ==========

    #[test]
    fn test_new_views_produce_compile_actions() {
        let mut desired = HashMap::new();
        desired.insert(ViewId::new("view-1"), make_spec("view-1", 1));
        desired.insert(ViewId::new("view-2"), make_spec("view-2", 1));

        let active = HashMap::new();

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.to_compile.len(), 2);
        assert_eq!(result.to_unmount.len(), 0);
        assert_eq!(result.unchanged.len(), 0);
        assert_eq!(result.actions.len(), 2);
        assert!(result.has_changes());
    }

    #[test]
    fn test_compile_action_contains_spec() {
        let mut desired = HashMap::new();
        let spec = make_spec("view-1", 42);
        desired.insert(ViewId::new("view-1"), spec.clone());

        let active = HashMap::new();

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.actions.len(), 1);
        match &result.actions[0] {
            FiberAction::Compile { view_id, spec: action_spec } => {
                assert_eq!(view_id.as_str(), "view-1");
                assert_eq!(action_spec.version, 42);
            }
            _ => panic!("Expected Compile action"),
        }
    }

    #[test]
    fn test_compile_many_views() {
        let mut desired = HashMap::new();
        for i in 0..100 {
            desired.insert(ViewId::new(&format!("view-{}", i)), make_spec(&format!("view-{}", i), 1));
        }

        let active = HashMap::new();

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.to_compile.len(), 100);
        assert_eq!(result.actions.len(), 100);
    }

    // ========== Unmount Tests ==========

    #[test]
    fn test_removed_views_produce_unmount_actions() {
        let desired = HashMap::new();

        let mut active = HashMap::new();
        active.insert(ViewId::new("view-1"), make_fiber(make_spec("view-1", 1)));
        active.insert(ViewId::new("view-2"), make_fiber(make_spec("view-2", 1)));

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.to_unmount.len(), 2);
        assert_eq!(result.to_compile.len(), 0);
        assert!(result.actions.iter().all(|a| matches!(a, FiberAction::Unmount { .. })));
    }

    #[test]
    fn test_unmount_action_has_client_request_reason() {
        let desired = HashMap::new();

        let mut active = HashMap::new();
        active.insert(ViewId::new("view-1"), make_fiber(make_spec("view-1", 1)));

        let result = Differ::diff(&desired, &active);

        match &result.actions[0] {
            FiberAction::Unmount { view_id, reason } => {
                assert_eq!(view_id.as_str(), "view-1");
                assert_eq!(*reason, UnmountReason::ClientRequest);
            }
            _ => panic!("Expected Unmount action"),
        }
    }

    #[test]
    fn test_unmount_many_views() {
        let desired = HashMap::new();

        let mut active = HashMap::new();
        for i in 0..100 {
            active.insert(
                ViewId::new(&format!("view-{}", i)),
                make_fiber(make_spec(&format!("view-{}", i), 1))
            );
        }

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.to_unmount.len(), 100);
        assert_eq!(result.actions.len(), 100);
    }

    // ========== Update Tests ==========

    #[test]
    fn test_unchanged_views_produce_no_actions() {
        let spec = make_spec("view-1", 1);

        let mut desired = HashMap::new();
        desired.insert(ViewId::new("view-1"), spec.clone());

        let mut active = HashMap::new();
        active.insert(ViewId::new("view-1"), make_fiber(spec));

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.unchanged.len(), 1);
        assert_eq!(result.to_compile.len(), 0);
        assert_eq!(result.to_unmount.len(), 0);
        assert_eq!(result.to_update.len(), 0);
        assert!(!result.has_changes());
    }

    #[test]
    fn test_version_change_produces_update_action() {
        let mut desired = HashMap::new();
        desired.insert(ViewId::new("view-1"), make_spec("view-1", 2));

        let mut active = HashMap::new();
        active.insert(ViewId::new("view-1"), make_fiber(make_spec("view-1", 1)));

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.to_update.len(), 1);
        assert!(result.has_changes());
        assert!(matches!(&result.actions[0], FiberAction::Update { .. }));
    }

    #[test]
    fn test_name_change_produces_update_action() {
        let mut desired = HashMap::new();
        desired.insert(ViewId::new("view-1"), make_spec_with_name("view-1", 1, "New Name"));

        let mut active = HashMap::new();
        active.insert(ViewId::new("view-1"), make_fiber(make_spec_with_name("view-1", 1, "Old Name")));

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.to_update.len(), 1);
        assert!(result.has_changes());
    }

    #[test]
    fn test_description_change_produces_update_action() {
        let mut desired = HashMap::new();
        desired.insert(ViewId::new("view-1"), make_spec_with_description("view-1", 1, Some("New desc".into())));

        let mut active = HashMap::new();
        active.insert(ViewId::new("view-1"), make_fiber(make_spec_with_description("view-1", 1, None)));

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.to_update.len(), 1);
    }

    #[test]
    fn test_assemblage_change_produces_update_action() {
        let mut desired = HashMap::new();
        desired.insert(ViewId::new("view-1"), make_spec_with_assemblage("view-1", 1, "new-assemblage"));

        let mut active = HashMap::new();
        active.insert(ViewId::new("view-1"), make_fiber(make_spec_with_assemblage("view-1", 1, "old-assemblage")));

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.to_update.len(), 1);
    }

    #[test]
    fn test_channels_count_change_produces_update_action() {
        let mut desired = HashMap::new();
        desired.insert(ViewId::new("view-1"), make_spec_with_channels("view-1", 1, 3));

        let mut active = HashMap::new();
        active.insert(ViewId::new("view-1"), make_fiber(make_spec_with_channels("view-1", 1, 2)));

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.to_update.len(), 1);
    }

    #[test]
    fn test_update_action_contains_artifact_replaced_delta() {
        let mut desired = HashMap::new();
        desired.insert(ViewId::new("view-1"), make_spec("view-1", 2));

        let mut active = HashMap::new();
        active.insert(ViewId::new("view-1"), make_fiber(make_spec("view-1", 1)));

        let result = Differ::diff(&desired, &active);

        match &result.actions[0] {
            FiberAction::Update { view_id, delta } => {
                assert_eq!(view_id.as_str(), "view-1");
                match delta {
                    ava_domain::ViewDelta::ArtifactReplaced { artifact } => {
                        assert_eq!(artifact.view_id.as_str(), "view-1");
                        assert_eq!(artifact.logical_version, 2);
                    }
                    _ => panic!("Expected ArtifactReplaced delta"),
                }
            }
            _ => panic!("Expected Update action"),
        }
    }

    // ========== Mixed Tests ==========

    #[test]
    fn test_mixed_diff() {
        // Desired: view-1 (updated), view-3 (new)
        let mut desired = HashMap::new();
        desired.insert(ViewId::new("view-1"), make_spec("view-1", 2));
        desired.insert(ViewId::new("view-3"), make_spec("view-3", 1));

        // Active: view-1 (old version), view-2 (to be removed)
        let mut active = HashMap::new();
        active.insert(ViewId::new("view-1"), make_fiber(make_spec("view-1", 1)));
        active.insert(ViewId::new("view-2"), make_fiber(make_spec("view-2", 1)));

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.to_compile.len(), 1); // view-3
        assert_eq!(result.to_update.len(), 1);  // view-1
        assert_eq!(result.to_unmount.len(), 1); // view-2
        assert_eq!(result.actions.len(), 3);
    }

    #[test]
    fn test_complex_mixed_scenario() {
        // Desired: view-1 (unchanged), view-2 (updated), view-4 (new), view-5 (new)
        let mut desired = HashMap::new();
        desired.insert(ViewId::new("view-1"), make_spec("view-1", 1));
        desired.insert(ViewId::new("view-2"), make_spec("view-2", 2));
        desired.insert(ViewId::new("view-4"), make_spec("view-4", 1));
        desired.insert(ViewId::new("view-5"), make_spec("view-5", 1));

        // Active: view-1 (same), view-2 (old), view-3 (to remove)
        let mut active = HashMap::new();
        active.insert(ViewId::new("view-1"), make_fiber(make_spec("view-1", 1)));
        active.insert(ViewId::new("view-2"), make_fiber(make_spec("view-2", 1)));
        active.insert(ViewId::new("view-3"), make_fiber(make_spec("view-3", 1)));

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.unchanged.len(), 1);    // view-1
        assert_eq!(result.to_update.len(), 1);    // view-2
        assert_eq!(result.to_compile.len(), 2);   // view-4, view-5
        assert_eq!(result.to_unmount.len(), 1);   // view-3
        assert_eq!(result.actions.len(), 4);      // update + 2 compile + unmount
    }

    // ========== Resume/Suspend Action Tests ==========

    #[test]
    fn test_compute_resume_actions_for_suspended_fibers() {
        let mut active = HashMap::new();

        // Suspended fiber
        let mut suspended_fiber = make_fiber(make_spec("view-1", 1));
        suspended_fiber.state = FiberState::Suspended;
        active.insert(ViewId::new("view-1"), suspended_fiber);

        // Mounted fiber
        let mut mounted_fiber = make_fiber(make_spec("view-2", 1));
        mounted_fiber.state = FiberState::Mounted;
        active.insert(ViewId::new("view-2"), mounted_fiber);

        let view_ids = vec![ViewId::new("view-1"), ViewId::new("view-2")];
        let actions = Differ::compute_resume_actions(&active, &view_ids);

        // Only suspended fiber should have resume action
        assert_eq!(actions.len(), 1);
        match &actions[0] {
            FiberAction::Resume { view_id } => {
                assert_eq!(view_id.as_str(), "view-1");
            }
            _ => panic!("Expected Resume action"),
        }
    }

    #[test]
    fn test_compute_resume_actions_empty_when_no_suspended() {
        let mut active = HashMap::new();

        let mut mounted_fiber = make_fiber(make_spec("view-1", 1));
        mounted_fiber.state = FiberState::Mounted;
        active.insert(ViewId::new("view-1"), mounted_fiber);

        let view_ids = vec![ViewId::new("view-1")];
        let actions = Differ::compute_resume_actions(&active, &view_ids);

        assert!(actions.is_empty());
    }

    #[test]
    fn test_compute_resume_actions_ignores_nonexistent_views() {
        let active: HashMap<ViewId, ViewFiber> = HashMap::new();

        let view_ids = vec![ViewId::new("nonexistent")];
        let actions = Differ::compute_resume_actions(&active, &view_ids);

        assert!(actions.is_empty());
    }

    #[test]
    fn test_compute_suspend_actions_for_active_fibers() {
        let mut active = HashMap::new();

        // Mounted fiber (active)
        let mut mounted_fiber = make_fiber(make_spec("view-1", 1));
        mounted_fiber.state = FiberState::Mounted;
        active.insert(ViewId::new("view-1"), mounted_fiber);

        // Updating fiber (also active)
        let mut updating_fiber = make_fiber(make_spec("view-2", 1));
        updating_fiber.state = FiberState::Updating;
        active.insert(ViewId::new("view-2"), updating_fiber);

        // Suspended fiber (not active)
        let mut suspended_fiber = make_fiber(make_spec("view-3", 1));
        suspended_fiber.state = FiberState::Suspended;
        active.insert(ViewId::new("view-3"), suspended_fiber);

        let view_ids = vec![ViewId::new("view-1"), ViewId::new("view-2"), ViewId::new("view-3")];
        let actions = Differ::compute_suspend_actions(&active, &view_ids);

        // Only active fibers should have suspend action
        assert_eq!(actions.len(), 2);
        assert!(actions.iter().all(|a| matches!(a, FiberAction::Suspend { .. })));
    }

    #[test]
    fn test_compute_suspend_actions_empty_when_no_active() {
        let mut active = HashMap::new();

        let mut pending_fiber = make_fiber(make_spec("view-1", 1));
        pending_fiber.state = FiberState::Pending;
        active.insert(ViewId::new("view-1"), pending_fiber);

        let view_ids = vec![ViewId::new("view-1")];
        let actions = Differ::compute_suspend_actions(&active, &view_ids);

        assert!(actions.is_empty());
    }

    #[test]
    fn test_compute_suspend_actions_ignores_nonexistent_views() {
        let active: HashMap<ViewId, ViewFiber> = HashMap::new();

        let view_ids = vec![ViewId::new("nonexistent")];
        let actions = Differ::compute_suspend_actions(&active, &view_ids);

        assert!(actions.is_empty());
    }

    // ========== Edge Cases ==========

    #[test]
    fn test_diff_with_same_view_id_different_content() {
        // Same ID but completely different spec
        let mut desired = HashMap::new();
        let desired_spec = ViewProfileSpec {
            id: ViewId::new("view-1"),
            name: "Brand New Name".into(),
            description: Some("New description".into()),
            assemblage_id: AssemblageId::new("new-assemblage"),
            channels: vec![],
            tags: HashMap::new(),
            version: 5,
        };
        desired.insert(ViewId::new("view-1"), desired_spec);

        let mut active = HashMap::new();
        active.insert(ViewId::new("view-1"), make_fiber(make_spec("view-1", 1)));

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.to_update.len(), 1);
        assert!(result.to_compile.is_empty());
        assert!(result.to_unmount.is_empty());
    }

    #[test]
    fn test_diff_large_scale() {
        let mut desired = HashMap::new();
        let mut active = HashMap::new();

        // 100 unchanged
        for i in 0..100 {
            let spec = make_spec(&format!("unchanged-{}", i), 1);
            desired.insert(ViewId::new(&format!("unchanged-{}", i)), spec.clone());
            active.insert(ViewId::new(&format!("unchanged-{}", i)), make_fiber(spec));
        }

        // 50 to update
        for i in 0..50 {
            desired.insert(ViewId::new(&format!("update-{}", i)), make_spec(&format!("update-{}", i), 2));
            active.insert(ViewId::new(&format!("update-{}", i)), make_fiber(make_spec(&format!("update-{}", i), 1)));
        }

        // 30 to compile
        for i in 0..30 {
            desired.insert(ViewId::new(&format!("new-{}", i)), make_spec(&format!("new-{}", i), 1));
        }

        // 20 to unmount
        for i in 0..20 {
            active.insert(ViewId::new(&format!("remove-{}", i)), make_fiber(make_spec(&format!("remove-{}", i), 1)));
        }

        let result = Differ::diff(&desired, &active);

        assert_eq!(result.unchanged.len(), 100);
        assert_eq!(result.to_update.len(), 50);
        assert_eq!(result.to_compile.len(), 30);
        assert_eq!(result.to_unmount.len(), 20);
        assert_eq!(result.actions.len(), 100); // 50 + 30 + 20
    }

    #[test]
    fn test_spec_changed_checks_all_fields() {
        let base = make_spec("view-1", 1);

        // Same spec should not be changed
        assert!(!Differ::spec_changed(&base, &base));

        // Version change
        let version_changed = make_spec("view-1", 2);
        assert!(Differ::spec_changed(&version_changed, &base));

        // Name change
        let name_changed = make_spec_with_name("view-1", 1, "Different");
        assert!(Differ::spec_changed(&name_changed, &base));

        // Description change
        let desc_changed = make_spec_with_description("view-1", 1, Some("desc".into()));
        assert!(Differ::spec_changed(&desc_changed, &base));

        // Assemblage change
        let assemblage_changed = make_spec_with_assemblage("view-1", 1, "different");
        assert!(Differ::spec_changed(&assemblage_changed, &base));

        // Channels count change
        let channels_changed = make_spec_with_channels("view-1", 1, 1);
        assert!(Differ::spec_changed(&channels_changed, &base));
    }

    #[test]
    fn test_diff_result_clone() {
        let mut desired = HashMap::new();
        desired.insert(ViewId::new("view-1"), make_spec("view-1", 1));

        let active = HashMap::new();

        let result = Differ::diff(&desired, &active);
        let cloned = result.clone();

        assert_eq!(result.to_compile.len(), cloned.to_compile.len());
        assert_eq!(result.actions.len(), cloned.actions.len());
    }

    #[test]
    fn test_diff_idempotent() {
        let mut desired = HashMap::new();
        desired.insert(ViewId::new("view-1"), make_spec("view-1", 1));

        let mut active = HashMap::new();
        active.insert(ViewId::new("view-2"), make_fiber(make_spec("view-2", 1)));

        let result1 = Differ::diff(&desired, &active);
        let result2 = Differ::diff(&desired, &active);

        assert_eq!(result1.to_compile.len(), result2.to_compile.len());
        assert_eq!(result1.to_unmount.len(), result2.to_unmount.len());
        assert_eq!(result1.actions.len(), result2.actions.len());
    }
}
