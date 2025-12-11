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

    fn make_spec_v(view_id: &str, version: u32) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(view_id),
            name: format!("View {} v{}", view_id, version),
            description: Some(format!("Version {}", version)),
            assemblage_id: ava_domain::AssemblageId::new("test"),
            channels: vec![],
            tags: HashMap::new(),
            version,
        }
    }

    fn make_test_reconciler() -> Reconciler {
        let time = Arc::new(AtomicU64::new(1000));
        Reconciler::with_time_provider(Box::new(move || {
            time.fetch_add(100, Ordering::SeqCst) as f64
        }))
    }

    fn make_artifact(view_id: &str, spec: ViewProfileSpec) -> ViewArtifact {
        ViewArtifact {
            view_id: ViewId::new(view_id),
            asset_id: None,
            spec,
            channel_bindings: vec![],
            created_at_ms: 1000.0,
            logical_version: 1,
        }
    }

    // ==================== Basic Operations ====================

    #[tokio::test]
    async fn test_new_creates_empty_reconciler() {
        let reconciler = Reconciler::new();

        let ids = reconciler.active_view_ids().await;
        assert!(ids.is_empty());

        let events = reconciler.event_log().all().await;
        assert!(events.is_empty());
    }

    #[tokio::test]
    async fn test_default_creates_empty_reconciler() {
        let reconciler = Reconciler::default();

        let ids = reconciler.active_view_ids().await;
        assert!(ids.is_empty());
    }

    #[tokio::test]
    async fn test_with_time_provider_uses_custom_time() {
        let time = Arc::new(AtomicU64::new(5000));
        let time_clone = time.clone();
        let reconciler = Reconciler::with_time_provider(Box::new(move || {
            time_clone.load(Ordering::SeqCst) as f64
        }));

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();

        let events = reconciler.event_log().all().await;
        if let ReconcilerEvent::ViewRequested { timestamp_ms, .. } = &events[0].event {
            assert_eq!(*timestamp_ms, 5000.0);
        }
    }

    // ==================== Request Operations ====================

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
    async fn test_request_schedules_compile_action() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::SoftRealTime).await.unwrap();

        // Should have work scheduled
        let stats = reconciler.scheduler().queue_stats().await;
        assert_eq!(stats.total(), 1);
        assert_eq!(stats.soft_rt, 1);
    }

    #[tokio::test]
    async fn test_request_with_all_lanes() {
        let reconciler = make_test_reconciler();

        reconciler.request(make_spec("v1"), Lane::HardRealTime).await.unwrap();
        reconciler.request(make_spec("v2"), Lane::SoftRealTime).await.unwrap();
        reconciler.request(make_spec("v3"), Lane::Background).await.unwrap();

        // Process all
        reconciler.tick().await; // HRT first
        reconciler.tick().await;
        reconciler.tick().await;

        let ids = reconciler.active_view_ids().await;
        assert_eq!(ids.len(), 3);
    }

    #[tokio::test]
    async fn test_request_logs_event_with_correct_fields() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec.clone(), Lane::Background).await.unwrap();

        let events = reconciler.event_log().all().await;
        assert_eq!(events.len(), 1);

        if let ReconcilerEvent::ViewRequested { view_id, spec: logged_spec, .. } = &events[0].event {
            assert_eq!(view_id.as_str(), "view-1");
            assert_eq!(logged_spec.name, spec.name);
        } else {
            panic!("Expected ViewRequested event");
        }
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
    async fn test_request_many_views() {
        let reconciler = make_test_reconciler();

        for i in 0..50 {
            let spec = make_spec(&format!("view-{}", i));
            reconciler.request(spec, Lane::Background).await.unwrap();
        }

        // Process all
        let actions = reconciler.tick_all().await;
        assert_eq!(actions.len(), 50);

        let ids = reconciler.active_view_ids().await;
        assert_eq!(ids.len(), 50);
    }

    // ==================== Update Operations ====================

    #[tokio::test]
    async fn test_update_schedules_update_action() {
        let reconciler = make_test_reconciler();

        // Create and mount a view
        let spec = make_spec("view-1");
        reconciler.request(spec.clone(), Lane::Background).await.unwrap();
        reconciler.tick().await;

        // Update it
        let new_spec = make_spec_v("view-1", 2);
        reconciler.update(new_spec).await.unwrap();

        let action = reconciler.tick().await;
        assert!(matches!(action, Some(FiberAction::Update { .. })));
    }

    #[tokio::test]
    async fn test_update_logs_event() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        let new_spec = make_spec_v("view-1", 2);
        reconciler.update(new_spec).await.unwrap();

        let events = reconciler.event_log().all().await;
        assert_eq!(events.len(), 2);
        assert!(matches!(&events[1].event, ReconcilerEvent::ViewUpdated { .. }));
    }

    #[tokio::test]
    async fn test_update_nonexistent_view_fails() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("nonexistent");
        let result = reconciler.update(spec).await;

        assert!(matches!(result, Err(ReconcilerError::ViewNotFound { .. })));
    }

    #[tokio::test]
    async fn test_update_transitions_fiber_to_updating() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec.clone(), Lane::Background).await.unwrap();
        reconciler.tick().await;

        // Transition to mounted first
        {
            let mut views = reconciler.active_views.write().await;
            if let Some(fiber) = views.get_mut(&ViewId::new("view-1")) {
                fiber.transition(FiberState::Compiled, 2000.0).unwrap();
                fiber.transition(FiberState::Mounted, 3000.0).unwrap();
            }
        }

        let new_spec = make_spec_v("view-1", 2);
        reconciler.update(new_spec).await.unwrap();
        reconciler.tick().await;

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert_eq!(fiber.state, FiberState::Updating);
    }

    #[tokio::test]
    async fn test_update_preserves_lane() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::SoftRealTime).await.unwrap();
        reconciler.tick().await;

        let new_spec = make_spec_v("view-1", 2);
        reconciler.update(new_spec).await.unwrap();

        // Verify the scheduled work uses the fiber's original lane
        let stats = reconciler.scheduler().queue_stats().await;
        assert_eq!(stats.soft_rt, 1);
    }

    // ==================== Unmount Operations ====================

    #[tokio::test]
    async fn test_unmount_removes_fiber() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        reconciler.unmount(ViewId::new("view-1"), UnmountReason::ClientRequest).await.unwrap();
        reconciler.tick().await;

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await;
        assert!(fiber.is_none());
    }

    #[tokio::test]
    async fn test_unmount_logs_event() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        reconciler.unmount(ViewId::new("view-1"), UnmountReason::ClientRequest).await.unwrap();

        let events = reconciler.event_log().all().await;
        assert_eq!(events.len(), 2);

        if let ReconcilerEvent::ViewUnmounted { view_id, reason, .. } = &events[1].event {
            assert_eq!(view_id.as_str(), "view-1");
            assert_eq!(*reason, UnmountReason::ClientRequest);
        } else {
            panic!("Expected ViewUnmounted event");
        }
    }

    #[tokio::test]
    async fn test_unmount_nonexistent_view_fails() {
        let reconciler = make_test_reconciler();

        let result = reconciler.unmount(ViewId::new("nonexistent"), UnmountReason::ClientRequest).await;

        assert!(matches!(result, Err(ReconcilerError::ViewNotFound { .. })));
    }

    #[tokio::test]
    async fn test_unmount_with_all_reasons() {
        let reconciler = make_test_reconciler();

        let reasons = vec![
            UnmountReason::ClientRequest,
            UnmountReason::Error { message: "test error".into() },
            UnmountReason::ResourceLimit { message: "memory exceeded".into() },
            UnmountReason::AssemblageMismatch,
            UnmountReason::Shutdown,
        ];

        for (i, reason) in reasons.into_iter().enumerate() {
            let spec = make_spec(&format!("view-{}", i));
            reconciler.request(spec, Lane::Background).await.unwrap();
            reconciler.tick().await;
            reconciler.unmount(ViewId::new(&format!("view-{}", i)), reason).await.unwrap();
            reconciler.tick().await;
        }

        let ids = reconciler.active_view_ids().await;
        assert!(ids.is_empty());
    }

    #[tokio::test]
    async fn test_unmount_removes_from_desired_specs() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        // Check desired specs has it
        {
            let desired = reconciler.desired_specs.read().await;
            assert!(desired.contains_key(&ViewId::new("view-1")));
        }

        reconciler.unmount(ViewId::new("view-1"), UnmountReason::ClientRequest).await.unwrap();

        // Check desired specs no longer has it
        {
            let desired = reconciler.desired_specs.read().await;
            assert!(!desired.contains_key(&ViewId::new("view-1")));
        }
    }

    // ==================== Tick Operations ====================

    #[tokio::test]
    async fn test_tick_returns_none_when_empty() {
        let reconciler = make_test_reconciler();

        let action = reconciler.tick().await;
        assert!(action.is_none());
    }

    #[tokio::test]
    async fn test_tick_processes_compile_action() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();

        let action = reconciler.tick().await;
        assert!(matches!(action, Some(FiberAction::Compile { view_id, .. }) if view_id.as_str() == "view-1"));
    }

    #[tokio::test]
    async fn test_tick_processes_mount_action() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        // Transition fiber to compiled
        {
            let mut views = reconciler.active_views.write().await;
            if let Some(fiber) = views.get_mut(&ViewId::new("view-1")) {
                fiber.transition(FiberState::Compiled, 2000.0).unwrap();
            }
        }

        // Schedule mount
        reconciler.scheduler().enqueue(ScheduledWork {
            view_id: ViewId::new("view-1"),
            action: FiberAction::Mount { view_id: ViewId::new("view-1") },
            lane: Lane::Background,
            enqueued_at_ms: 2000.0,
        }).await;

        let action = reconciler.tick().await;
        assert!(matches!(action, Some(FiberAction::Mount { .. })));

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert_eq!(fiber.state, FiberState::Mounted);
    }

    #[tokio::test]
    async fn test_tick_processes_suspend_action() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        // Transition to mounted
        {
            let mut views = reconciler.active_views.write().await;
            if let Some(fiber) = views.get_mut(&ViewId::new("view-1")) {
                fiber.transition(FiberState::Compiled, 2000.0).unwrap();
                fiber.transition(FiberState::Mounted, 3000.0).unwrap();
            }
        }

        // Schedule suspend
        reconciler.scheduler().enqueue(ScheduledWork {
            view_id: ViewId::new("view-1"),
            action: FiberAction::Suspend { view_id: ViewId::new("view-1") },
            lane: Lane::Background,
            enqueued_at_ms: 4000.0,
        }).await;

        let action = reconciler.tick().await;
        assert!(matches!(action, Some(FiberAction::Suspend { .. })));

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert_eq!(fiber.state, FiberState::Suspended);
    }

    #[tokio::test]
    async fn test_tick_processes_resume_action() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        // Transition to suspended
        {
            let mut views = reconciler.active_views.write().await;
            if let Some(fiber) = views.get_mut(&ViewId::new("view-1")) {
                fiber.transition(FiberState::Compiled, 2000.0).unwrap();
                fiber.transition(FiberState::Mounted, 3000.0).unwrap();
                fiber.transition(FiberState::Suspended, 4000.0).unwrap();
            }
        }

        // Schedule resume
        reconciler.scheduler().enqueue(ScheduledWork {
            view_id: ViewId::new("view-1"),
            action: FiberAction::Resume { view_id: ViewId::new("view-1") },
            lane: Lane::Background,
            enqueued_at_ms: 5000.0,
        }).await;

        let action = reconciler.tick().await;
        assert!(matches!(action, Some(FiberAction::Resume { .. })));

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert_eq!(fiber.state, FiberState::Mounted);
    }

    #[tokio::test]
    async fn test_tick_processes_noop_action() {
        let reconciler = make_test_reconciler();

        reconciler.scheduler().enqueue(ScheduledWork {
            view_id: ViewId::new("any"),
            action: FiberAction::Noop,
            lane: Lane::Background,
            enqueued_at_ms: 1000.0,
        }).await;

        let action = reconciler.tick().await;
        assert!(matches!(action, Some(FiberAction::Noop)));
    }

    #[tokio::test]
    async fn test_tick_all_processes_all_work() {
        let reconciler = make_test_reconciler();

        for i in 0..10 {
            let spec = make_spec(&format!("view-{}", i));
            reconciler.request(spec, Lane::Background).await.unwrap();
        }

        let actions = reconciler.tick_all().await;

        assert_eq!(actions.len(), 10);
        assert!(actions.iter().all(|a| matches!(a, FiberAction::Compile { .. })));
    }

    #[tokio::test]
    async fn test_tick_all_returns_empty_when_no_work() {
        let reconciler = make_test_reconciler();

        let actions = reconciler.tick_all().await;

        assert!(actions.is_empty());
    }

    #[tokio::test]
    async fn test_tick_respects_lane_priority() {
        let reconciler = make_test_reconciler();

        // Request in reverse priority order
        reconciler.request(make_spec("bg"), Lane::Background).await.unwrap();
        reconciler.request(make_spec("srt"), Lane::SoftRealTime).await.unwrap();
        reconciler.request(make_spec("hrt"), Lane::HardRealTime).await.unwrap();

        // First tick should be HRT
        let action = reconciler.tick().await;
        assert!(matches!(action, Some(FiberAction::Compile { view_id, .. }) if view_id.as_str() == "hrt"));

        // Second tick should be SRT
        let action = reconciler.tick().await;
        assert!(matches!(action, Some(FiberAction::Compile { view_id, .. }) if view_id.as_str() == "srt"));

        // Third tick should be BG
        let action = reconciler.tick().await;
        assert!(matches!(action, Some(FiberAction::Compile { view_id, .. }) if view_id.as_str() == "bg"));
    }

    // ==================== Mark Operations ====================

    #[tokio::test]
    async fn test_mark_mounted_transitions_state() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec.clone(), Lane::Background).await.unwrap();
        reconciler.tick().await;

        {
            let mut views = reconciler.active_views.write().await;
            if let Some(fiber) = views.get_mut(&ViewId::new("view-1")) {
                fiber.transition(FiberState::Compiled, 2000.0).unwrap();
            }
        }

        let artifact = ViewArtifact {
            view_id: ViewId::new("view-1"),
            asset_id: None,
            spec,
            channel_bindings: vec![],
            created_at_ms: 2000.0,
            logical_version: 1,
        };
        reconciler.mark_mounted(&ViewId::new("view-1"), artifact).await.unwrap();

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert_eq!(fiber.state, FiberState::Mounted);
        assert!(fiber.artifact.is_some());
    }

    #[tokio::test]
    async fn test_mark_mounted_logs_event() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec.clone(), Lane::Background).await.unwrap();
        reconciler.tick().await;

        {
            let mut views = reconciler.active_views.write().await;
            if let Some(fiber) = views.get_mut(&ViewId::new("view-1")) {
                fiber.transition(FiberState::Compiled, 2000.0).unwrap();
            }
        }

        let artifact = make_artifact("view-1", spec);
        reconciler.mark_mounted(&ViewId::new("view-1"), artifact).await.unwrap();

        let events = reconciler.event_log().all().await;
        assert_eq!(events.len(), 2);
        assert!(matches!(&events[1].event, ReconcilerEvent::ViewMounted { .. }));
    }

    #[tokio::test]
    async fn test_mark_mounted_nonexistent_fails() {
        let reconciler = make_test_reconciler();

        let artifact = make_artifact("nonexistent", make_spec("nonexistent"));
        let result = reconciler.mark_mounted(&ViewId::new("nonexistent"), artifact).await;

        assert!(matches!(result, Err(ReconcilerError::ViewNotFound { .. })));
    }

    #[tokio::test]
    async fn test_mark_mounted_invalid_transition_fails() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec.clone(), Lane::Background).await.unwrap();
        reconciler.tick().await;

        // Fiber is in Pending state, can't go directly to Mounted
        let artifact = make_artifact("view-1", spec);
        let result = reconciler.mark_mounted(&ViewId::new("view-1"), artifact).await;

        assert!(matches!(result, Err(ReconcilerError::InvalidStateTransition { .. })));
    }

    #[tokio::test]
    async fn test_mark_failed_transitions_state() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        reconciler.mark_failed(&ViewId::new("view-1"), "Compilation failed".into()).await.unwrap();

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert!(matches!(fiber.state, FiberState::Failed { .. }));
    }

    #[tokio::test]
    async fn test_mark_failed_logs_event() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        reconciler.mark_failed(&ViewId::new("view-1"), "Error message".into()).await.unwrap();

        let events = reconciler.event_log().all().await;
        assert_eq!(events.len(), 2);

        if let ReconcilerEvent::ViewCompilationFailed { error, .. } = &events[1].event {
            assert_eq!(error, "Error message");
        } else {
            panic!("Expected ViewCompilationFailed event");
        }
    }

    #[tokio::test]
    async fn test_mark_failed_nonexistent_fails() {
        let reconciler = make_test_reconciler();

        let result = reconciler.mark_failed(&ViewId::new("nonexistent"), "error".into()).await;

        assert!(matches!(result, Err(ReconcilerError::ViewNotFound { .. })));
    }

    // ==================== Reconcile Operations ====================

    #[tokio::test]
    async fn test_reconcile_produces_actions() {
        let reconciler = make_test_reconciler();

        {
            let mut desired = reconciler.desired_specs.write().await;
            desired.insert(ViewId::new("view-1"), make_spec("view-1"));
            desired.insert(ViewId::new("view-2"), make_spec("view-2"));
        }

        let result = reconciler.reconcile().await;

        assert_eq!(result.to_compile.len(), 2);
        assert!(result.has_changes());
    }

    #[tokio::test]
    async fn test_reconcile_schedules_unmounts() {
        let reconciler = make_test_reconciler();

        // Create fibers without desired specs
        let spec = make_spec("orphan");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        // Remove from desired
        reconciler.desired_specs.write().await.remove(&ViewId::new("orphan"));

        let result = reconciler.reconcile().await;

        assert_eq!(result.to_unmount.len(), 1);
        assert!(result.has_changes());
    }

    #[tokio::test]
    async fn test_reconcile_no_changes_when_in_sync() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec.clone(), Lane::Background).await.unwrap();
        reconciler.tick().await;

        // Desired and active are in sync
        let result = reconciler.reconcile().await;

        // No new work since we just created it
        assert!(!result.has_changes() || result.to_compile.is_empty());
    }

    #[tokio::test]
    async fn test_reconcile_detects_updates() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        // Update desired spec version
        {
            let mut desired = reconciler.desired_specs.write().await;
            desired.insert(ViewId::new("view-1"), make_spec_v("view-1", 2));
        }

        let result = reconciler.reconcile().await;

        assert_eq!(result.to_update.len(), 1);
    }

    #[tokio::test]
    async fn test_reconcile_large_scale() {
        let reconciler = make_test_reconciler();

        // Add 100 desired specs
        {
            let mut desired = reconciler.desired_specs.write().await;
            for i in 0..100 {
                desired.insert(ViewId::new(&format!("view-{}", i)), make_spec(&format!("view-{}", i)));
            }
        }

        let result = reconciler.reconcile().await;

        assert_eq!(result.to_compile.len(), 100);

        // Process all scheduled work
        let actions = reconciler.tick_all().await;
        assert_eq!(actions.len(), 100);

        let ids = reconciler.active_view_ids().await;
        assert_eq!(ids.len(), 100);
    }

    // ==================== Event Log Integration ====================

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
    async fn test_event_log_tracks_full_lifecycle() {
        let reconciler = make_test_reconciler();

        // Request
        let spec = make_spec("view-1");
        reconciler.request(spec.clone(), Lane::Background).await.unwrap();
        reconciler.tick().await;

        // Mark mounted
        {
            let mut views = reconciler.active_views.write().await;
            if let Some(fiber) = views.get_mut(&ViewId::new("view-1")) {
                fiber.transition(FiberState::Compiled, 2000.0).unwrap();
            }
        }
        let artifact = make_artifact("view-1", spec);
        reconciler.mark_mounted(&ViewId::new("view-1"), artifact).await.unwrap();

        // Unmount
        reconciler.unmount(ViewId::new("view-1"), UnmountReason::ClientRequest).await.unwrap();
        reconciler.tick().await;

        let events = reconciler.event_log().all().await;
        assert_eq!(events.len(), 3);

        assert!(matches!(&events[0].event, ReconcilerEvent::ViewRequested { .. }));
        assert!(matches!(&events[1].event, ReconcilerEvent::ViewMounted { .. }));
        assert!(matches!(&events[2].event, ReconcilerEvent::ViewUnmounted { .. }));
    }

    #[tokio::test]
    async fn test_event_sequences_are_monotonic() {
        let reconciler = make_test_reconciler();

        for i in 0..10 {
            let spec = make_spec(&format!("view-{}", i));
            let seq = reconciler.request(spec, Lane::Background).await.unwrap();
            assert_eq!(seq.0, (i + 1) as u64);
        }
    }

    // ==================== Scheduler Integration ====================

    #[tokio::test]
    async fn test_scheduler_access() {
        let reconciler = make_test_reconciler();

        let scheduler = reconciler.scheduler();
        let stats = scheduler.queue_stats().await;

        assert_eq!(stats.total(), 0);
    }

    #[tokio::test]
    async fn test_scheduler_work_assignment() {
        let reconciler = make_test_reconciler();

        reconciler.request(make_spec("hrt"), Lane::HardRealTime).await.unwrap();
        reconciler.request(make_spec("srt"), Lane::SoftRealTime).await.unwrap();
        reconciler.request(make_spec("bg"), Lane::Background).await.unwrap();

        let stats = reconciler.scheduler().queue_stats().await;

        assert_eq!(stats.hard_rt, 1);
        assert_eq!(stats.soft_rt, 1);
        assert_eq!(stats.background, 1);
    }

    // ==================== Query Operations ====================

    #[tokio::test]
    async fn test_get_fiber_existing() {
        let reconciler = make_test_reconciler();

        reconciler.request(make_spec("view-1"), Lane::Background).await.unwrap();
        reconciler.tick().await;

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await;
        assert!(fiber.is_some());
    }

    #[tokio::test]
    async fn test_get_fiber_nonexistent() {
        let reconciler = make_test_reconciler();

        let fiber = reconciler.get_fiber(&ViewId::new("nonexistent")).await;
        assert!(fiber.is_none());
    }

    #[tokio::test]
    async fn test_active_view_ids_empty() {
        let reconciler = make_test_reconciler();

        let ids = reconciler.active_view_ids().await;
        assert!(ids.is_empty());
    }

    #[tokio::test]
    async fn test_active_view_ids_populated() {
        let reconciler = make_test_reconciler();

        reconciler.request(make_spec("a"), Lane::Background).await.unwrap();
        reconciler.request(make_spec("b"), Lane::Background).await.unwrap();
        reconciler.request(make_spec("c"), Lane::Background).await.unwrap();
        reconciler.tick_all().await;

        let ids = reconciler.active_view_ids().await;
        assert_eq!(ids.len(), 3);

        // Check all IDs present (order not guaranteed)
        let id_strs: Vec<_> = ids.iter().map(|id| id.as_str()).collect();
        assert!(id_strs.contains(&"a"));
        assert!(id_strs.contains(&"b"));
        assert!(id_strs.contains(&"c"));
    }

    // ==================== Replay Operations ====================

    #[tokio::test]
    async fn test_replay_returns_sequence() {
        let reconciler = make_test_reconciler();

        reconciler.request(make_spec("view-1"), Lane::Background).await.unwrap();
        reconciler.request(make_spec("view-2"), Lane::Background).await.unwrap();

        let result = reconciler.replay().await;
        assert!(result.is_ok());
    }

    // ==================== Concurrency Tests ====================

    #[tokio::test]
    async fn test_concurrent_requests() {
        let reconciler = Arc::new(make_test_reconciler());

        let handles: Vec<_> = (0..20)
            .map(|i| {
                let r = reconciler.clone();
                tokio::spawn(async move {
                    let spec = make_spec(&format!("view-{}", i));
                    r.request(spec, Lane::Background).await
                })
            })
            .collect();

        let results: Vec<_> = futures::future::join_all(handles)
            .await
            .into_iter()
            .filter_map(|r| r.ok())
            .collect();

        // All should succeed
        assert_eq!(results.iter().filter(|r| r.is_ok()).count(), 20);

        // Process all
        reconciler.tick_all().await;

        let ids = reconciler.active_view_ids().await;
        assert_eq!(ids.len(), 20);
    }

    #[tokio::test]
    async fn test_concurrent_tick_all() {
        let reconciler = Arc::new(make_test_reconciler());

        // Add many views
        for i in 0..50 {
            reconciler.request(make_spec(&format!("view-{}", i)), Lane::Background).await.unwrap();
        }

        // Concurrent tick_all calls
        let handles: Vec<_> = (0..5)
            .map(|_| {
                let r = reconciler.clone();
                tokio::spawn(async move {
                    r.tick_all().await
                })
            })
            .collect();

        let results: Vec<Vec<_>> = futures::future::join_all(handles)
            .await
            .into_iter()
            .filter_map(|r| r.ok())
            .collect();

        // Total actions should be 50 (distributed among concurrent calls)
        let total: usize = results.iter().map(|v| v.len()).sum();
        assert_eq!(total, 50);
    }

    #[tokio::test]
    async fn test_concurrent_read_write() {
        let reconciler = Arc::new(make_test_reconciler());

        // Writer
        let r1 = reconciler.clone();
        let writer = tokio::spawn(async move {
            for i in 0..30 {
                let spec = make_spec(&format!("view-{}", i));
                r1.request(spec, Lane::Background).await.ok();
                r1.tick().await;
            }
        });

        // Reader
        let r2 = reconciler.clone();
        let reader = tokio::spawn(async move {
            for _ in 0..100 {
                let _ = r2.active_view_ids().await;
                let _ = r2.get_fiber(&ViewId::new("view-0")).await;
                tokio::task::yield_now().await;
            }
        });

        let _ = tokio::join!(writer, reader);

        // Should have some views
        let ids = reconciler.active_view_ids().await;
        assert!(!ids.is_empty());
    }

    // ==================== Full Lifecycle Tests ====================

    #[tokio::test]
    async fn test_full_lifecycle_happy_path() {
        let reconciler = make_test_reconciler();

        // 1. Request
        let spec = make_spec("view-1");
        reconciler.request(spec.clone(), Lane::SoftRealTime).await.unwrap();

        // 2. Compile
        let action = reconciler.tick().await;
        assert!(matches!(action, Some(FiberAction::Compile { .. })));

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert_eq!(fiber.state, FiberState::Pending);
        assert_eq!(fiber.lane, Lane::SoftRealTime);

        // 3. Mark compiled (external would do this)
        {
            let mut views = reconciler.active_views.write().await;
            if let Some(f) = views.get_mut(&ViewId::new("view-1")) {
                f.transition(FiberState::Compiled, 2000.0).unwrap();
            }
        }

        // 4. Mark mounted
        let artifact = make_artifact("view-1", spec.clone());
        reconciler.mark_mounted(&ViewId::new("view-1"), artifact).await.unwrap();

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert_eq!(fiber.state, FiberState::Mounted);
        assert!(fiber.artifact.is_some());

        // 5. Update
        let new_spec = make_spec_v("view-1", 2);
        reconciler.update(new_spec).await.unwrap();
        reconciler.tick().await;

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert_eq!(fiber.state, FiberState::Updating);

        // 6. Mark updated (transition back to Mounted)
        {
            let mut views = reconciler.active_views.write().await;
            if let Some(f) = views.get_mut(&ViewId::new("view-1")) {
                f.transition(FiberState::Mounted, 4000.0).unwrap();
            }
        }

        // 7. Unmount
        reconciler.unmount(ViewId::new("view-1"), UnmountReason::ClientRequest).await.unwrap();
        reconciler.tick().await;

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await;
        assert!(fiber.is_none());

        // Verify event log
        let events = reconciler.event_log().all().await;
        assert_eq!(events.len(), 4); // Requested, Mounted, Updated, Unmounted
    }

    #[tokio::test]
    async fn test_full_lifecycle_with_failure() {
        let reconciler = make_test_reconciler();

        // Request
        let spec = make_spec("view-1");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        // Mark failed
        reconciler.mark_failed(&ViewId::new("view-1"), "Compilation error".into()).await.unwrap();

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert!(matches!(fiber.state, FiberState::Failed { .. }));
        assert!(!fiber.state.is_active());
        assert!(fiber.state.is_terminal());

        // Verify event log
        let events = reconciler.event_log().all().await;
        assert_eq!(events.len(), 2); // Requested, Failed
    }

    #[tokio::test]
    async fn test_full_lifecycle_with_suspend_resume() {
        let reconciler = make_test_reconciler();

        // Setup mounted view
        let spec = make_spec("view-1");
        reconciler.request(spec.clone(), Lane::Background).await.unwrap();
        reconciler.tick().await;

        {
            let mut views = reconciler.active_views.write().await;
            if let Some(f) = views.get_mut(&ViewId::new("view-1")) {
                f.transition(FiberState::Compiled, 2000.0).unwrap();
            }
        }

        let artifact = make_artifact("view-1", spec);
        reconciler.mark_mounted(&ViewId::new("view-1"), artifact).await.unwrap();

        // Suspend
        reconciler.scheduler().enqueue(ScheduledWork {
            view_id: ViewId::new("view-1"),
            action: FiberAction::Suspend { view_id: ViewId::new("view-1") },
            lane: Lane::Background,
            enqueued_at_ms: 3000.0,
        }).await;
        reconciler.tick().await;

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert_eq!(fiber.state, FiberState::Suspended);

        // Resume
        reconciler.scheduler().enqueue(ScheduledWork {
            view_id: ViewId::new("view-1"),
            action: FiberAction::Resume { view_id: ViewId::new("view-1") },
            lane: Lane::Background,
            enqueued_at_ms: 4000.0,
        }).await;
        reconciler.tick().await;

        let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
        assert_eq!(fiber.state, FiberState::Mounted);
    }

    #[tokio::test]
    async fn test_multiple_views_different_lifecycles() {
        let reconciler = make_test_reconciler();

        // Create 3 views with different fates
        for name in ["success", "failed", "suspended"] {
            reconciler.request(make_spec(name), Lane::Background).await.unwrap();
        }
        reconciler.tick_all().await;

        // Success path
        {
            let mut views = reconciler.active_views.write().await;
            if let Some(f) = views.get_mut(&ViewId::new("success")) {
                f.transition(FiberState::Compiled, 2000.0).unwrap();
            }
        }
        let artifact = make_artifact("success", make_spec("success"));
        reconciler.mark_mounted(&ViewId::new("success"), artifact).await.unwrap();

        // Failure path
        reconciler.mark_failed(&ViewId::new("failed"), "error".into()).await.unwrap();

        // Suspended path
        {
            let mut views = reconciler.active_views.write().await;
            if let Some(f) = views.get_mut(&ViewId::new("suspended")) {
                f.transition(FiberState::Compiled, 2000.0).unwrap();
                f.transition(FiberState::Mounted, 3000.0).unwrap();
                f.transition(FiberState::Suspended, 4000.0).unwrap();
            }
        }

        // Verify states
        let success = reconciler.get_fiber(&ViewId::new("success")).await.unwrap();
        let failed = reconciler.get_fiber(&ViewId::new("failed")).await.unwrap();
        let suspended = reconciler.get_fiber(&ViewId::new("suspended")).await.unwrap();

        assert_eq!(success.state, FiberState::Mounted);
        assert!(matches!(failed.state, FiberState::Failed { .. }));
        assert_eq!(suspended.state, FiberState::Suspended);

        // Verify active count
        let ids = reconciler.active_view_ids().await;
        assert_eq!(ids.len(), 3);
    }

    // ==================== Edge Cases ====================

    #[tokio::test]
    async fn test_empty_view_id() {
        let reconciler = make_test_reconciler();

        let mut spec = make_spec("");
        spec.id = ViewId::new("");

        // Should still work (empty string is valid)
        let result = reconciler.request(spec, Lane::Background).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_unicode_view_id() {
        let reconciler = make_test_reconciler();

        let spec = make_spec("视图-αβγ-🎉");
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        let fiber = reconciler.get_fiber(&ViewId::new("视图-αβγ-🎉")).await;
        assert!(fiber.is_some());
    }

    #[tokio::test]
    async fn test_very_long_view_id() {
        let reconciler = make_test_reconciler();

        let long_id = "x".repeat(10000);
        let spec = make_spec(&long_id);
        reconciler.request(spec, Lane::Background).await.unwrap();
        reconciler.tick().await;

        let fiber = reconciler.get_fiber(&ViewId::new(&long_id)).await;
        assert!(fiber.is_some());
    }

    #[tokio::test]
    async fn test_tick_on_nonexistent_view_noop() {
        let reconciler = make_test_reconciler();

        // Manually schedule work for a view that doesn't exist
        reconciler.scheduler().enqueue(ScheduledWork {
            view_id: ViewId::new("ghost"),
            action: FiberAction::Mount { view_id: ViewId::new("ghost") },
            lane: Lane::Background,
            enqueued_at_ms: 1000.0,
        }).await;

        // Should not panic
        let action = reconciler.tick().await;
        assert!(matches!(action, Some(FiberAction::Mount { .. })));

        // No fiber created (it didn't exist)
        let fiber = reconciler.get_fiber(&ViewId::new("ghost")).await;
        assert!(fiber.is_none());
    }

    #[tokio::test]
    async fn test_rapid_request_unmount_cycles() {
        let reconciler = make_test_reconciler();

        for i in 0..10 {
            let view_id = format!("view-{}", i);
            let spec = make_spec(&view_id);

            reconciler.request(spec, Lane::HardRealTime).await.unwrap();
            reconciler.tick().await;
            reconciler.unmount(ViewId::new(&view_id), UnmountReason::ClientRequest).await.unwrap();
            reconciler.tick().await;
        }

        let ids = reconciler.active_view_ids().await;
        assert!(ids.is_empty());

        let events = reconciler.event_log().all().await;
        assert_eq!(events.len(), 20); // 10 requests + 10 unmounts
    }
}
