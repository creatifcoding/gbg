//! Reconciler - Main orchestrator for view lifecycle management
//!
//! The Reconciler maintains the mapping between desired specs (what clients request)
//! and actual fibers (what's currently running). It produces actions and events
//! to bring actual state toward desired state.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

use ava_domain::{
    ViewId, ViewProfileSpec, ViewArtifact, Lane, FiberAction,
    ReconcilerEvent, EventSequence, UnmountReason,
};

use crate::event_log::EventLog;
use crate::fiber::{ViewFiber, FiberState};
use crate::scheduler::{LaneScheduler, ScheduledWork};
use crate::differ::{Differ, DiffResult};
use crate::error::ReconcilerError;

/// The main reconciler struct
pub struct Reconciler {
    /// Event log for durability and replay
    event_log: Arc<EventLog>,

    /// Active view fibers
    active_views: RwLock<HashMap<ViewId, ViewFiber>>,

    /// Desired specs (what clients want)
    desired_specs: RwLock<HashMap<ViewId, ViewProfileSpec>>,

    /// Work scheduler
    scheduler: Arc<LaneScheduler>,

    /// Time provider (for testing)
    time_provider: Box<dyn Fn() -> f64 + Send + Sync>,
}

impl Reconciler {
    /// Creates a new reconciler with default time provider
    pub fn new() -> Self {
        Self::with_time_provider(Box::new(|| {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as f64
        }))
    }

    /// Creates a reconciler with a custom time provider (for testing)
    pub fn with_time_provider(time_provider: Box<dyn Fn() -> f64 + Send + Sync>) -> Self {
        Self {
            event_log: Arc::new(EventLog::new()),
            active_views: RwLock::new(HashMap::new()),
            desired_specs: RwLock::new(HashMap::new()),
            scheduler: Arc::new(LaneScheduler::new()),
            time_provider,
        }
    }

    /// Returns the current timestamp
    fn now(&self) -> f64 {
        (self.time_provider)()
    }

    /// Requests a view to be mounted
    ///
    /// This adds the spec to desired state and logs a ViewRequested event.
    /// The actual mounting happens during tick().
    pub async fn request(&self, spec: ViewProfileSpec, lane: Lane) -> Result<EventSequence, ReconcilerError> {
        let view_id = spec.id.clone();
        let timestamp = self.now();

        // Check if already exists
        let exists = self.active_views.read().await.contains_key(&view_id);
        if exists {
            return Err(ReconcilerError::ViewAlreadyExists { view_id });
        }

        // Add to desired specs
        self.desired_specs.write().await.insert(view_id.clone(), spec.clone());

        // Log the event
        let event = ReconcilerEvent::ViewRequested {
            view_id: view_id.clone(),
            spec: spec.clone(),
            timestamp_ms: timestamp,
        };
        let sequence = self.event_log.append(event).await;

        // Schedule compilation
        self.scheduler.enqueue(ScheduledWork {
            view_id: view_id.clone(),
            action: FiberAction::Compile { view_id, spec },
            lane,
            enqueued_at_ms: timestamp,
        }).await;

        Ok(sequence)
    }

    /// Updates a view spec
    pub async fn update(&self, spec: ViewProfileSpec) -> Result<EventSequence, ReconcilerError> {
        let view_id = spec.id.clone();
        let timestamp = self.now();

        // Check if exists
        let fiber = {
            let views = self.active_views.read().await;
            views.get(&view_id).cloned()
        };

        let fiber = fiber.ok_or_else(|| ReconcilerError::ViewNotFound {
            view_id: view_id.clone(),
        })?;

        // Update desired spec
        self.desired_specs.write().await.insert(view_id.clone(), spec.clone());

        // Compute delta - use ArtifactReplaced for spec-level updates
        let delta = ava_domain::ViewDelta::ArtifactReplaced {
            artifact: Box::new(ava_domain::ViewArtifact {
                view_id: view_id.clone(),
                asset_id: None,
                spec: spec.clone(),
                channel_bindings: vec![],
                created_at_ms: timestamp,
                logical_version: spec.version,
            }),
        };

        // Log the event
        let event = ReconcilerEvent::ViewUpdated {
            view_id: view_id.clone(),
            delta: delta.clone(),
            sequence: self.event_log.latest_sequence().await,
            timestamp_ms: timestamp,
        };
        let sequence = self.event_log.append(event).await;

        // Schedule update
        self.scheduler.enqueue(ScheduledWork {
            view_id: view_id.clone(),
            action: FiberAction::Update { view_id, delta },
            lane: fiber.lane,
            enqueued_at_ms: timestamp,
        }).await;

        Ok(sequence)
    }

    /// Unmounts a view
    pub async fn unmount(&self, view_id: ViewId, reason: UnmountReason) -> Result<EventSequence, ReconcilerError> {
        let timestamp = self.now();

        // Check if exists
        let fiber = {
            let views = self.active_views.read().await;
            views.get(&view_id).cloned()
        };

        let fiber = fiber.ok_or_else(|| ReconcilerError::ViewNotFound {
            view_id: view_id.clone(),
        })?;

        // Remove from desired specs
        self.desired_specs.write().await.remove(&view_id);

        // Log the event
        let event = ReconcilerEvent::ViewUnmounted {
            view_id: view_id.clone(),
            reason: reason.clone(),
            timestamp_ms: timestamp,
        };
        let sequence = self.event_log.append(event).await;

        // Schedule unmount
        self.scheduler.enqueue(ScheduledWork {
            view_id: view_id.clone(),
            action: FiberAction::Unmount { view_id, reason },
            lane: fiber.lane,
            enqueued_at_ms: timestamp,
        }).await;

        Ok(sequence)
    }

    /// Processes the next scheduled action
    ///
    /// Returns the action that was processed, or None if queue is empty.
    pub async fn tick(&self) -> Option<FiberAction> {
        let work = self.scheduler.dequeue().await?;
        let timestamp = self.now();

        match &work.action {
            FiberAction::Compile { view_id, spec } => {
                // Create fiber in Pending state
                let fiber = ViewFiber::new(spec.clone(), work.lane, timestamp);
                self.active_views.write().await.insert(view_id.clone(), fiber);
            }

            FiberAction::Mount { view_id } => {
                if let Some(fiber) = self.active_views.write().await.get_mut(view_id) {
                    let _ = fiber.transition(FiberState::Mounted, timestamp);
                }
            }

            FiberAction::Update { view_id, .. } => {
                if let Some(fiber) = self.active_views.write().await.get_mut(view_id) {
                    let _ = fiber.transition(FiberState::Updating, timestamp);
                }
            }

            FiberAction::Unmount { view_id, .. } => {
                // Remove the fiber
                self.active_views.write().await.remove(view_id);
            }

            FiberAction::Suspend { view_id } => {
                if let Some(fiber) = self.active_views.write().await.get_mut(view_id) {
                    let _ = fiber.transition(FiberState::Suspended, timestamp);
                }
            }

            FiberAction::Resume { view_id } => {
                if let Some(fiber) = self.active_views.write().await.get_mut(view_id) {
                    let _ = fiber.transition(FiberState::Mounted, timestamp);
                }
            }

            FiberAction::Noop => {}
        }

        Some(work.action)
    }

    /// Processes all scheduled actions
    ///
    /// Returns the list of actions processed.
    pub async fn tick_all(&self) -> Vec<FiberAction> {
        let mut actions = Vec::new();
        while let Some(action) = self.tick().await {
            actions.push(action);
        }
        actions
    }

    /// Marks a view as successfully mounted with its artifact
    pub async fn mark_mounted(
        &self,
        view_id: &ViewId,
        artifact: ViewArtifact,
    ) -> Result<EventSequence, ReconcilerError> {
        let timestamp = self.now();

        let mut views = self.active_views.write().await;
        let fiber = views.get_mut(view_id).ok_or_else(|| {
            ReconcilerError::ViewNotFound {
                view_id: view_id.clone(),
            }
        })?;

        fiber.transition(FiberState::Mounted, timestamp).map_err(|msg| {
            ReconcilerError::InvalidStateTransition {
                view_id: view_id.clone(),
                from: format!("{:?}", fiber.state),
                to: "Mounted".into(),
            }
        })?;
        fiber.set_artifact(artifact.clone());

        let event = ReconcilerEvent::ViewMounted {
            view_id: view_id.clone(),
            artifact,
            timestamp_ms: timestamp,
        };
        Ok(self.event_log.append(event).await)
    }

    /// Marks a view compilation as failed
    pub async fn mark_failed(
        &self,
        view_id: &ViewId,
        error: String,
    ) -> Result<EventSequence, ReconcilerError> {
        let timestamp = self.now();

        let mut views = self.active_views.write().await;
        let fiber = views.get_mut(view_id).ok_or_else(|| {
            ReconcilerError::ViewNotFound {
                view_id: view_id.clone(),
            }
        })?;

        fiber.transition(FiberState::Failed { error: error.clone() }, timestamp).map_err(|msg| {
            ReconcilerError::InvalidStateTransition {
                view_id: view_id.clone(),
                from: format!("{:?}", fiber.state),
                to: "Failed".into(),
            }
        })?;

        let event = ReconcilerEvent::ViewCompilationFailed {
            view_id: view_id.clone(),
            error,
            timestamp_ms: timestamp,
        };
        Ok(self.event_log.append(event).await)
    }

    /// Reconciles desired vs active state
    ///
    /// This performs a full diff and schedules all necessary actions.
    pub async fn reconcile(&self) -> DiffResult {
        let desired = self.desired_specs.read().await.clone();
        let active = self.active_views.read().await.clone();

        let result = Differ::diff(&desired, &active);
        let timestamp = self.now();

        // Schedule all actions
        for action in &result.actions {
            let view_id = match action {
                FiberAction::Compile { view_id, .. } => view_id,
                FiberAction::Mount { view_id } => view_id,
                FiberAction::Update { view_id, .. } => view_id,
                FiberAction::Unmount { view_id, .. } => view_id,
                FiberAction::Suspend { view_id } => view_id,
                FiberAction::Resume { view_id } => view_id,
                FiberAction::Noop => continue,
            };

            let lane = active
                .get(view_id)
                .map(|f| f.lane)
                .unwrap_or(Lane::Background);

            self.scheduler.enqueue(ScheduledWork {
                view_id: view_id.clone(),
                action: action.clone(),
                lane,
                enqueued_at_ms: timestamp,
            }).await;
        }

        result
    }

    /// Returns a view's current fiber
    pub async fn get_fiber(&self, view_id: &ViewId) -> Option<ViewFiber> {
        self.active_views.read().await.get(view_id).cloned()
    }

    /// Returns all active view IDs
    pub async fn active_view_ids(&self) -> Vec<ViewId> {
        self.active_views.read().await.keys().cloned().collect()
    }

    /// Returns the event log
    pub fn event_log(&self) -> &Arc<EventLog> {
        &self.event_log
    }

    /// Returns the scheduler
    pub fn scheduler(&self) -> &Arc<LaneScheduler> {
        &self.scheduler
    }

    /// Replays events to rebuild state
    pub async fn replay(&self) -> Result<EventSequence, ReconcilerError> {
        self.event_log.replay(|entry| {
            // For replay, we reconstruct state from events
            // This is a simplified version - full implementation would
            // rebuild fibers from the event stream
            Ok(())
        }).await
    }
}

impl Default for Reconciler {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};

    fn make_spec(view_id: &str) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(view_id),
            name: format!("View {}", view_id),
            description: None,
            assemblage_id: ava_domain::AssemblageId::new("test"),
            channels: vec![],
            tags: HashMap::new(),
            version: 1,
        }
    }

    fn make_test_reconciler() -> Reconciler {
        let time = Arc::new(AtomicU64::new(1000));
        Reconciler::with_time_provider(Box::new(move || {
            time.fetch_add(100, Ordering::SeqCst) as f64
        }))
    }

    #[tokio::test]
    async fn test_request_creates_fiber() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        let seq = reconciler.request(spec, Lane::SoftRealTime).await.unwrap();

        assert_eq!(seq.0, 1);

        // Process the compile action
        let action = reconciler.tick().await;
        assert!(matches!(action, Some(FiberAction::Compile { .. })));

        // Fiber should exist
        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await;
        assert!(fiber.is_some());
        assert_eq!(fiber.unwrap().state, FiberState::Pending);
    }

    #[tokio::test]
    async fn test_duplicate_request_fails() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec.clone(), Lane::Background).await.unwrap();
        reconciler.tick().await; // Process compile

        // Second request should fail
        let result = reconciler.request(spec, Lane::Background).await;
        assert!(matches!(result, Err(ReconcilerError::ViewAlreadyExists { .. })));
    }

    #[tokio::test]
    async fn test_unmount_removes_fiber() {
        let reconciler = make_test_reconciler();

        // Request and mount
        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await; // Compile

        // Unmount
        reconciler.unmount(ViewId::new("view-1"), UnmountReason::ClientRequest).await.unwrap();
        reconciler.tick().await; // Process unmount

        // Fiber should be gone
        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await;
        assert!(fiber.is_none());
    }

    #[tokio::test]
    async fn test_event_log_records_events() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();

        let events = reconciler.event_log().all().await;
        assert_eq!(events.len(), 1);
        assert!(matches!(
            &events[0].event,
            ReconcilerEvent::ViewRequested { view_id, .. } if view_id.as_str() == "view-1"
        ));
    }

    #[tokio::test]
    async fn test_reconcile_produces_actions() {
        let reconciler = make_test_reconciler();

        // Manually add to desired specs
        {
            let mut desired = reconciler.desired_specs.write().await;
            desired.insert(ViewId::new("view-1"), make_spec("view-1"));
            desired.insert(ViewId::new("view-2"), make_spec("view-2"));
        }

        // Reconcile should produce compile actions
        let result = reconciler.reconcile().await;

        assert_eq!(result.to_compile.len(), 2);
        assert!(result.has_changes());
    }

    #[tokio::test]
    async fn test_mark_mounted_transitions_state() {
        let reconciler = make_test_reconciler();

        // Request a view
        let spec = make_spec("view-1");
        reconciler.request(spec.clone(), Lane::Background).await.unwrap();
        reconciler.tick().await; // Compile -> Pending

        // Transition to Compiled
        {
            let mut views = reconciler.active_views.write().await;
            if let Some(fiber) = views.get_mut(&ViewId::new("view-1")) {
                fiber.transition(FiberState::Compiled, 2000.0).unwrap();
            }
        }

        // Mark as mounted
        let artifact = ViewArtifact {
            view_id: ViewId::new("view-1"),
            asset_id: None,
            spec,
            channel_bindings: vec![],
            created_at_ms: 2000.0,
            logical_version: 1,
        };
        reconciler.mark_mounted(&ViewId::new("view-1"), artifact).await.unwrap();

        // Should be mounted now
        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert_eq!(fiber.state, FiberState::Mounted);
        assert!(fiber.artifact.is_some());
    }
}
