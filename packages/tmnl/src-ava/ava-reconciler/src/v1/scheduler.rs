//! Lane Scheduler - Priority-based work scheduling
//!
//! Views are scheduled based on their lane priority:
//! - HardRealTime (priority 3): Critical views, processed first
//! - SoftRealTime (priority 2): Interactive views
//! - Background (priority 1): Batch/analytics views
//!
//! Within a lane, FIFO ordering is maintained.

use std::collections::VecDeque;
use tokio::sync::RwLock;

use ava_domain::{ViewId, FiberAction, Lane};

/// Entry in the scheduler queue
#[derive(Debug, Clone)]
pub struct ScheduledWork {
    pub view_id: ViewId,
    pub action: FiberAction,
    pub lane: Lane,
    pub enqueued_at_ms: f64,
}

/// Lane-based priority scheduler
pub struct LaneScheduler {
    /// Hard real-time queue (highest priority)
    hard_rt: RwLock<VecDeque<ScheduledWork>>,

    /// Soft real-time queue (medium priority)
    soft_rt: RwLock<VecDeque<ScheduledWork>>,

    /// Background queue (lowest priority)
    background: RwLock<VecDeque<ScheduledWork>>,
}

impl LaneScheduler {
    /// Creates a new empty scheduler
    pub fn new() -> Self {
        Self {
            hard_rt: RwLock::new(VecDeque::new()),
            soft_rt: RwLock::new(VecDeque::new()),
            background: RwLock::new(VecDeque::new()),
        }
    }

    /// Enqueues work into the appropriate lane
    pub async fn enqueue(&self, work: ScheduledWork) {
        match work.lane {
            Lane::HardRealTime => {
                self.hard_rt.write().await.push_back(work);
            }
            Lane::SoftRealTime => {
                self.soft_rt.write().await.push_back(work);
            }
            Lane::Background => {
                self.background.write().await.push_back(work);
            }
        }
    }

    /// Dequeues the next highest-priority work item
    /// Returns None if all queues are empty
    pub async fn dequeue(&self) -> Option<ScheduledWork> {
        // Try hard real-time first
        if let Some(work) = self.hard_rt.write().await.pop_front() {
            return Some(work);
        }

        // Then soft real-time
        if let Some(work) = self.soft_rt.write().await.pop_front() {
            return Some(work);
        }

        // Finally background
        self.background.write().await.pop_front()
    }

    /// Peeks at the next work item without removing it
    pub async fn peek(&self) -> Option<ScheduledWork> {
        // Try hard real-time first
        if let Some(work) = self.hard_rt.read().await.front() {
            return Some(work.clone());
        }

        // Then soft real-time
        if let Some(work) = self.soft_rt.read().await.front() {
            return Some(work.clone());
        }

        // Finally background
        self.background.read().await.front().cloned()
    }

    /// Returns the total number of queued items
    pub async fn len(&self) -> usize {
        self.hard_rt.read().await.len()
            + self.soft_rt.read().await.len()
            + self.background.read().await.len()
    }

    /// Returns true if all queues are empty
    pub async fn is_empty(&self) -> bool {
        self.hard_rt.read().await.is_empty()
            && self.soft_rt.read().await.is_empty()
            && self.background.read().await.is_empty()
    }

    /// Returns queue lengths by lane
    pub async fn queue_stats(&self) -> QueueStats {
        QueueStats {
            hard_rt: self.hard_rt.read().await.len(),
            soft_rt: self.soft_rt.read().await.len(),
            background: self.background.read().await.len(),
        }
    }

    /// Removes all work for a specific view from all queues
    /// Returns the number of items removed
    pub async fn remove_view(&self, view_id: &ViewId) -> usize {
        let mut removed = 0;

        {
            let mut queue = self.hard_rt.write().await;
            let before = queue.len();
            queue.retain(|w| &w.view_id != view_id);
            removed += before - queue.len();
        }

        {
            let mut queue = self.soft_rt.write().await;
            let before = queue.len();
            queue.retain(|w| &w.view_id != view_id);
            removed += before - queue.len();
        }

        {
            let mut queue = self.background.write().await;
            let before = queue.len();
            queue.retain(|w| &w.view_id != view_id);
            removed += before - queue.len();
        }

        removed
    }

    /// Clears all queues
    pub async fn clear(&self) {
        self.hard_rt.write().await.clear();
        self.soft_rt.write().await.clear();
        self.background.write().await.clear();
    }

    /// Drains up to `limit` items from the scheduler
    pub async fn drain(&self, limit: usize) -> Vec<ScheduledWork> {
        let mut result = Vec::with_capacity(limit);

        while result.len() < limit {
            if let Some(work) = self.dequeue().await {
                result.push(work);
            } else {
                break;
            }
        }

        result
    }
}

impl Default for LaneScheduler {
    fn default() -> Self {
        Self::new()
    }
}

/// Queue statistics by lane
#[derive(Debug, Clone, Default)]
pub struct QueueStats {
    pub hard_rt: usize,
    pub soft_rt: usize,
    pub background: usize,
}

impl QueueStats {
    pub fn total(&self) -> usize {
        self.hard_rt + self.soft_rt + self.background
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ava_domain::{ViewProfileSpec, UnmountReason, ViewDelta, ViewArtifact};
    use std::collections::HashMap;
    use tokio::task::JoinSet;

    fn make_spec(view_id: &str) -> ViewProfileSpec {
        ViewProfileSpec {
            id: ViewId::new(view_id),
            name: "Test".into(),
            description: None,
            assemblage_id: ava_domain::AssemblageId::new("test"),
            channels: vec![],
            tags: HashMap::new(),
            version: 1,
        }
    }

    fn make_work(view_id: &str, lane: Lane) -> ScheduledWork {
        ScheduledWork {
            view_id: ViewId::new(view_id),
            action: FiberAction::Compile {
                view_id: ViewId::new(view_id),
                spec: make_spec(view_id),
            },
            lane,
            enqueued_at_ms: 1000.0,
        }
    }

    fn make_work_with_action(view_id: &str, lane: Lane, action: FiberAction) -> ScheduledWork {
        ScheduledWork {
            view_id: ViewId::new(view_id),
            action,
            lane,
            enqueued_at_ms: 1000.0,
        }
    }

    fn make_work_with_time(view_id: &str, lane: Lane, timestamp: f64) -> ScheduledWork {
        ScheduledWork {
            view_id: ViewId::new(view_id),
            action: FiberAction::Compile {
                view_id: ViewId::new(view_id),
                spec: make_spec(view_id),
            },
            lane,
            enqueued_at_ms: timestamp,
        }
    }

    // ========== Basic Operations ==========

    #[tokio::test]
    async fn test_new_scheduler_is_empty() {
        let scheduler = LaneScheduler::new();
        assert!(scheduler.is_empty().await);
        assert_eq!(scheduler.len().await, 0);
    }

    #[tokio::test]
    async fn test_enqueue_single_item() {
        let scheduler = LaneScheduler::new();
        scheduler.enqueue(make_work("view-1", Lane::Background)).await;

        assert!(!scheduler.is_empty().await);
        assert_eq!(scheduler.len().await, 1);
    }

    #[tokio::test]
    async fn test_dequeue_empty_returns_none() {
        let scheduler = LaneScheduler::new();
        assert!(scheduler.dequeue().await.is_none());
    }

    #[tokio::test]
    async fn test_peek_empty_returns_none() {
        let scheduler = LaneScheduler::new();
        assert!(scheduler.peek().await.is_none());
    }

    #[tokio::test]
    async fn test_peek_doesnt_remove() {
        let scheduler = LaneScheduler::new();
        scheduler.enqueue(make_work("view-1", Lane::Background)).await;

        let peeked = scheduler.peek().await;
        assert!(peeked.is_some());
        assert_eq!(scheduler.len().await, 1); // Still there

        let peeked2 = scheduler.peek().await;
        assert!(peeked2.is_some());
        assert_eq!(scheduler.len().await, 1); // Still there
    }

    // ========== Priority Ordering Tests ==========

    #[tokio::test]
    async fn test_priority_ordering() {
        let scheduler = LaneScheduler::new();

        // Enqueue in reverse priority order
        scheduler.enqueue(make_work("bg-1", Lane::Background)).await;
        scheduler.enqueue(make_work("soft-1", Lane::SoftRealTime)).await;
        scheduler.enqueue(make_work("hard-1", Lane::HardRealTime)).await;

        // Should dequeue in priority order
        let first = scheduler.dequeue().await.unwrap();
        assert_eq!(first.view_id.as_str(), "hard-1");

        let second = scheduler.dequeue().await.unwrap();
        assert_eq!(second.view_id.as_str(), "soft-1");

        let third = scheduler.dequeue().await.unwrap();
        assert_eq!(third.view_id.as_str(), "bg-1");

        assert!(scheduler.is_empty().await);
    }

    #[tokio::test]
    async fn test_priority_ordering_interleaved() {
        let scheduler = LaneScheduler::new();

        // Interleaved enqueue
        scheduler.enqueue(make_work("soft-1", Lane::SoftRealTime)).await;
        scheduler.enqueue(make_work("bg-1", Lane::Background)).await;
        scheduler.enqueue(make_work("hard-1", Lane::HardRealTime)).await;
        scheduler.enqueue(make_work("soft-2", Lane::SoftRealTime)).await;
        scheduler.enqueue(make_work("hard-2", Lane::HardRealTime)).await;
        scheduler.enqueue(make_work("bg-2", Lane::Background)).await;

        // Dequeue order: hard-1, hard-2, soft-1, soft-2, bg-1, bg-2
        assert_eq!(scheduler.dequeue().await.unwrap().view_id.as_str(), "hard-1");
        assert_eq!(scheduler.dequeue().await.unwrap().view_id.as_str(), "hard-2");
        assert_eq!(scheduler.dequeue().await.unwrap().view_id.as_str(), "soft-1");
        assert_eq!(scheduler.dequeue().await.unwrap().view_id.as_str(), "soft-2");
        assert_eq!(scheduler.dequeue().await.unwrap().view_id.as_str(), "bg-1");
        assert_eq!(scheduler.dequeue().await.unwrap().view_id.as_str(), "bg-2");
    }

    #[tokio::test]
    async fn test_peek_returns_highest_priority() {
        let scheduler = LaneScheduler::new();

        scheduler.enqueue(make_work("bg-1", Lane::Background)).await;
        assert_eq!(scheduler.peek().await.unwrap().view_id.as_str(), "bg-1");

        scheduler.enqueue(make_work("soft-1", Lane::SoftRealTime)).await;
        assert_eq!(scheduler.peek().await.unwrap().view_id.as_str(), "soft-1");

        scheduler.enqueue(make_work("hard-1", Lane::HardRealTime)).await;
        assert_eq!(scheduler.peek().await.unwrap().view_id.as_str(), "hard-1");
    }

    // ========== FIFO Within Lane Tests ==========

    #[tokio::test]
    async fn test_fifo_within_lane() {
        let scheduler = LaneScheduler::new();

        scheduler.enqueue(make_work("soft-1", Lane::SoftRealTime)).await;
        scheduler.enqueue(make_work("soft-2", Lane::SoftRealTime)).await;
        scheduler.enqueue(make_work("soft-3", Lane::SoftRealTime)).await;

        let first = scheduler.dequeue().await.unwrap();
        assert_eq!(first.view_id.as_str(), "soft-1");

        let second = scheduler.dequeue().await.unwrap();
        assert_eq!(second.view_id.as_str(), "soft-2");

        let third = scheduler.dequeue().await.unwrap();
        assert_eq!(third.view_id.as_str(), "soft-3");
    }

    #[tokio::test]
    async fn test_fifo_all_lanes() {
        for lane in [Lane::HardRealTime, Lane::SoftRealTime, Lane::Background] {
            let scheduler = LaneScheduler::new();

            for i in 1..=5 {
                scheduler.enqueue(make_work(&format!("view-{}", i), lane.clone())).await;
            }

            for i in 1..=5 {
                let work = scheduler.dequeue().await.unwrap();
                assert_eq!(work.view_id.as_str(), &format!("view-{}", i));
            }
        }
    }

    // ========== Remove View Tests ==========

    #[tokio::test]
    async fn test_remove_view() {
        let scheduler = LaneScheduler::new();

        scheduler.enqueue(make_work("view-1", Lane::HardRealTime)).await;
        scheduler.enqueue(make_work("view-2", Lane::SoftRealTime)).await;
        scheduler.enqueue(make_work("view-1", Lane::Background)).await;

        let removed = scheduler.remove_view(&ViewId::new("view-1")).await;
        assert_eq!(removed, 2);
        assert_eq!(scheduler.len().await, 1);
    }

    #[tokio::test]
    async fn test_remove_nonexistent_view() {
        let scheduler = LaneScheduler::new();

        scheduler.enqueue(make_work("view-1", Lane::Background)).await;

        let removed = scheduler.remove_view(&ViewId::new("nonexistent")).await;
        assert_eq!(removed, 0);
        assert_eq!(scheduler.len().await, 1);
    }

    #[tokio::test]
    async fn test_remove_from_all_lanes() {
        let scheduler = LaneScheduler::new();

        // Add same view to all lanes
        scheduler.enqueue(make_work("target", Lane::HardRealTime)).await;
        scheduler.enqueue(make_work("target", Lane::SoftRealTime)).await;
        scheduler.enqueue(make_work("target", Lane::Background)).await;
        scheduler.enqueue(make_work("other", Lane::Background)).await;

        let removed = scheduler.remove_view(&ViewId::new("target")).await;
        assert_eq!(removed, 3);
        assert_eq!(scheduler.len().await, 1);

        // The remaining item should be "other"
        let work = scheduler.dequeue().await.unwrap();
        assert_eq!(work.view_id.as_str(), "other");
    }

    #[tokio::test]
    async fn test_remove_preserves_fifo_order() {
        let scheduler = LaneScheduler::new();

        scheduler.enqueue(make_work("a", Lane::Background)).await;
        scheduler.enqueue(make_work("remove-me", Lane::Background)).await;
        scheduler.enqueue(make_work("b", Lane::Background)).await;
        scheduler.enqueue(make_work("remove-me", Lane::Background)).await;
        scheduler.enqueue(make_work("c", Lane::Background)).await;

        scheduler.remove_view(&ViewId::new("remove-me")).await;

        assert_eq!(scheduler.dequeue().await.unwrap().view_id.as_str(), "a");
        assert_eq!(scheduler.dequeue().await.unwrap().view_id.as_str(), "b");
        assert_eq!(scheduler.dequeue().await.unwrap().view_id.as_str(), "c");
    }

    // ========== Queue Stats Tests ==========

    #[tokio::test]
    async fn test_queue_stats() {
        let scheduler = LaneScheduler::new();

        scheduler.enqueue(make_work("hard-1", Lane::HardRealTime)).await;
        scheduler.enqueue(make_work("hard-2", Lane::HardRealTime)).await;
        scheduler.enqueue(make_work("soft-1", Lane::SoftRealTime)).await;
        scheduler.enqueue(make_work("bg-1", Lane::Background)).await;
        scheduler.enqueue(make_work("bg-2", Lane::Background)).await;
        scheduler.enqueue(make_work("bg-3", Lane::Background)).await;

        let stats = scheduler.queue_stats().await;
        assert_eq!(stats.hard_rt, 2);
        assert_eq!(stats.soft_rt, 1);
        assert_eq!(stats.background, 3);
        assert_eq!(stats.total(), 6);
    }

    #[tokio::test]
    async fn test_queue_stats_empty() {
        let scheduler = LaneScheduler::new();
        let stats = scheduler.queue_stats().await;

        assert_eq!(stats.hard_rt, 0);
        assert_eq!(stats.soft_rt, 0);
        assert_eq!(stats.background, 0);
        assert_eq!(stats.total(), 0);
    }

    #[tokio::test]
    async fn test_queue_stats_after_dequeue() {
        let scheduler = LaneScheduler::new();

        scheduler.enqueue(make_work("hard-1", Lane::HardRealTime)).await;
        scheduler.enqueue(make_work("soft-1", Lane::SoftRealTime)).await;
        scheduler.enqueue(make_work("bg-1", Lane::Background)).await;

        scheduler.dequeue().await; // Removes hard-1

        let stats = scheduler.queue_stats().await;
        assert_eq!(stats.hard_rt, 0);
        assert_eq!(stats.soft_rt, 1);
        assert_eq!(stats.background, 1);
    }

    // ========== Drain Tests ==========

    #[tokio::test]
    async fn test_drain() {
        let scheduler = LaneScheduler::new();

        for i in 1..=10 {
            scheduler.enqueue(make_work(&format!("view-{}", i), Lane::Background)).await;
        }

        let batch = scheduler.drain(5).await;
        assert_eq!(batch.len(), 5);
        assert_eq!(scheduler.len().await, 5);
    }

    #[tokio::test]
    async fn test_drain_more_than_available() {
        let scheduler = LaneScheduler::new();

        scheduler.enqueue(make_work("view-1", Lane::Background)).await;
        scheduler.enqueue(make_work("view-2", Lane::Background)).await;

        let batch = scheduler.drain(10).await;
        assert_eq!(batch.len(), 2);
        assert!(scheduler.is_empty().await);
    }

    #[tokio::test]
    async fn test_drain_zero() {
        let scheduler = LaneScheduler::new();

        scheduler.enqueue(make_work("view-1", Lane::Background)).await;

        let batch = scheduler.drain(0).await;
        assert!(batch.is_empty());
        assert_eq!(scheduler.len().await, 1);
    }

    #[tokio::test]
    async fn test_drain_empty_scheduler() {
        let scheduler = LaneScheduler::new();
        let batch = scheduler.drain(5).await;
        assert!(batch.is_empty());
    }

    #[tokio::test]
    async fn test_drain_respects_priority() {
        let scheduler = LaneScheduler::new();

        scheduler.enqueue(make_work("bg-1", Lane::Background)).await;
        scheduler.enqueue(make_work("hard-1", Lane::HardRealTime)).await;
        scheduler.enqueue(make_work("soft-1", Lane::SoftRealTime)).await;
        scheduler.enqueue(make_work("hard-2", Lane::HardRealTime)).await;
        scheduler.enqueue(make_work("bg-2", Lane::Background)).await;

        let batch = scheduler.drain(3).await;
        assert_eq!(batch.len(), 3);
        assert_eq!(batch[0].view_id.as_str(), "hard-1");
        assert_eq!(batch[1].view_id.as_str(), "hard-2");
        assert_eq!(batch[2].view_id.as_str(), "soft-1");
    }

    // ========== Clear Tests ==========

    #[tokio::test]
    async fn test_clear() {
        let scheduler = LaneScheduler::new();

        scheduler.enqueue(make_work("hard-1", Lane::HardRealTime)).await;
        scheduler.enqueue(make_work("soft-1", Lane::SoftRealTime)).await;
        scheduler.enqueue(make_work("bg-1", Lane::Background)).await;

        scheduler.clear().await;

        assert!(scheduler.is_empty().await);
        assert_eq!(scheduler.len().await, 0);

        let stats = scheduler.queue_stats().await;
        assert_eq!(stats.total(), 0);
    }

    #[tokio::test]
    async fn test_clear_empty_scheduler() {
        let scheduler = LaneScheduler::new();
        scheduler.clear().await;
        assert!(scheduler.is_empty().await);
    }

    // ========== All Action Types Tests ==========

    #[tokio::test]
    async fn test_all_fiber_action_types() {
        let scheduler = LaneScheduler::new();

        // Compile
        scheduler.enqueue(make_work_with_action(
            "v1",
            Lane::Background,
            FiberAction::Compile { view_id: ViewId::new("v1"), spec: make_spec("v1") }
        )).await;

        // Mount
        scheduler.enqueue(make_work_with_action(
            "v2",
            Lane::Background,
            FiberAction::Mount { view_id: ViewId::new("v2") }
        )).await;

        // Update
        scheduler.enqueue(make_work_with_action(
            "v3",
            Lane::Background,
            FiberAction::Update {
                view_id: ViewId::new("v3"),
                delta: ViewDelta::ArtifactReplaced {
                    artifact: Box::new(ViewArtifact {
                        view_id: ViewId::new("v3"),
                        asset_id: None,
                        spec: make_spec("v3"),
                        channel_bindings: vec![],
                        created_at_ms: 0.0,
                        logical_version: 1,
                    }),
                },
            }
        )).await;

        // Unmount
        scheduler.enqueue(make_work_with_action(
            "v4",
            Lane::Background,
            FiberAction::Unmount { view_id: ViewId::new("v4"), reason: UnmountReason::ClientRequest }
        )).await;

        // Suspend
        scheduler.enqueue(make_work_with_action(
            "v5",
            Lane::Background,
            FiberAction::Suspend { view_id: ViewId::new("v5") }
        )).await;

        // Resume
        scheduler.enqueue(make_work_with_action(
            "v6",
            Lane::Background,
            FiberAction::Resume { view_id: ViewId::new("v6") }
        )).await;

        // Noop
        scheduler.enqueue(make_work_with_action(
            "v7",
            Lane::Background,
            FiberAction::Noop
        )).await;

        assert_eq!(scheduler.len().await, 7);

        // Verify each action type
        assert!(matches!(scheduler.dequeue().await.unwrap().action, FiberAction::Compile { .. }));
        assert!(matches!(scheduler.dequeue().await.unwrap().action, FiberAction::Mount { .. }));
        assert!(matches!(scheduler.dequeue().await.unwrap().action, FiberAction::Update { .. }));
        assert!(matches!(scheduler.dequeue().await.unwrap().action, FiberAction::Unmount { .. }));
        assert!(matches!(scheduler.dequeue().await.unwrap().action, FiberAction::Suspend { .. }));
        assert!(matches!(scheduler.dequeue().await.unwrap().action, FiberAction::Resume { .. }));
        assert!(matches!(scheduler.dequeue().await.unwrap().action, FiberAction::Noop));
    }

    // ========== Timestamp Tests ==========

    #[tokio::test]
    async fn test_timestamps_preserved() {
        let scheduler = LaneScheduler::new();

        scheduler.enqueue(make_work_with_time("v1", Lane::Background, 1000.0)).await;
        scheduler.enqueue(make_work_with_time("v2", Lane::Background, 2000.0)).await;
        scheduler.enqueue(make_work_with_time("v3", Lane::Background, 3000.0)).await;

        let work1 = scheduler.dequeue().await.unwrap();
        assert_eq!(work1.enqueued_at_ms, 1000.0);

        let work2 = scheduler.dequeue().await.unwrap();
        assert_eq!(work2.enqueued_at_ms, 2000.0);

        let work3 = scheduler.dequeue().await.unwrap();
        assert_eq!(work3.enqueued_at_ms, 3000.0);
    }

    // ========== Concurrency Tests ==========

    #[tokio::test]
    async fn test_concurrent_enqueue() {
        let scheduler = std::sync::Arc::new(LaneScheduler::new());
        let mut join_set = JoinSet::new();

        // Spawn 10 concurrent enqueue tasks
        for i in 0..10 {
            let scheduler = scheduler.clone();
            join_set.spawn(async move {
                scheduler.enqueue(make_work(&format!("view-{}", i), Lane::Background)).await;
            });
        }

        while let Some(result) = join_set.join_next().await {
            result.unwrap();
        }

        assert_eq!(scheduler.len().await, 10);
    }

    #[tokio::test]
    async fn test_concurrent_enqueue_dequeue() {
        let scheduler = std::sync::Arc::new(LaneScheduler::new());
        let mut join_set = JoinSet::new();

        // Pre-populate
        for i in 0..50 {
            scheduler.enqueue(make_work(&format!("view-{}", i), Lane::Background)).await;
        }

        // Concurrent enqueue
        for i in 50..100 {
            let scheduler = scheduler.clone();
            join_set.spawn(async move {
                scheduler.enqueue(make_work(&format!("view-{}", i), Lane::Background)).await;
            });
        }

        // Concurrent dequeue
        let dequeue_count = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        for _ in 0..30 {
            let scheduler = scheduler.clone();
            let count = dequeue_count.clone();
            join_set.spawn(async move {
                if scheduler.dequeue().await.is_some() {
                    count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                }
            });
        }

        while let Some(result) = join_set.join_next().await {
            result.unwrap();
        }

        // Should have 100 - dequeued items remaining
        let remaining = scheduler.len().await;
        let dequeued = dequeue_count.load(std::sync::atomic::Ordering::SeqCst);
        assert_eq!(remaining + dequeued, 100);
    }

    #[tokio::test]
    async fn test_concurrent_stats() {
        let scheduler = std::sync::Arc::new(LaneScheduler::new());
        let mut join_set = JoinSet::new();

        // Concurrent operations
        for i in 0..20 {
            let scheduler = scheduler.clone();
            let lane = match i % 3 {
                0 => Lane::HardRealTime,
                1 => Lane::SoftRealTime,
                _ => Lane::Background,
            };
            join_set.spawn(async move {
                scheduler.enqueue(make_work(&format!("view-{}", i), lane)).await;
                let _ = scheduler.queue_stats().await;
            });
        }

        while let Some(result) = join_set.join_next().await {
            result.unwrap();
        }

        let stats = scheduler.queue_stats().await;
        assert_eq!(stats.total(), 20);
    }

    // ========== Edge Cases ==========

    #[tokio::test]
    async fn test_same_view_multiple_actions() {
        let scheduler = LaneScheduler::new();

        // Same view with different actions
        scheduler.enqueue(make_work_with_action(
            "view-1",
            Lane::Background,
            FiberAction::Compile { view_id: ViewId::new("view-1"), spec: make_spec("view-1") }
        )).await;

        scheduler.enqueue(make_work_with_action(
            "view-1",
            Lane::Background,
            FiberAction::Mount { view_id: ViewId::new("view-1") }
        )).await;

        scheduler.enqueue(make_work_with_action(
            "view-1",
            Lane::Background,
            FiberAction::Suspend { view_id: ViewId::new("view-1") }
        )).await;

        assert_eq!(scheduler.len().await, 3);

        // Remove should remove all
        let removed = scheduler.remove_view(&ViewId::new("view-1")).await;
        assert_eq!(removed, 3);
        assert!(scheduler.is_empty().await);
    }

    #[tokio::test]
    async fn test_large_batch() {
        let scheduler = LaneScheduler::new();

        // Add 1000 items
        for i in 0..1000 {
            let lane = match i % 3 {
                0 => Lane::HardRealTime,
                1 => Lane::SoftRealTime,
                _ => Lane::Background,
            };
            scheduler.enqueue(make_work(&format!("view-{}", i), lane)).await;
        }

        assert_eq!(scheduler.len().await, 1000);

        // Drain all with priority ordering
        let batch = scheduler.drain(1000).await;
        assert_eq!(batch.len(), 1000);

        // First 334 should be HardRealTime (indices 0, 3, 6, ...)
        for i in 0..334 {
            assert_eq!(batch[i].lane, Lane::HardRealTime);
        }
    }

    #[tokio::test]
    async fn test_queue_stats_default() {
        let stats = QueueStats::default();
        assert_eq!(stats.hard_rt, 0);
        assert_eq!(stats.soft_rt, 0);
        assert_eq!(stats.background, 0);
        assert_eq!(stats.total(), 0);
    }
}
