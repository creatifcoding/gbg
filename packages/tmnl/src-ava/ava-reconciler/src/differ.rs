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

    fn make_fiber(spec: ViewProfileSpec) -> ViewFiber {
        ViewFiber::new(spec, Lane::Background, 1000.0)
    }

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
    }

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
}
