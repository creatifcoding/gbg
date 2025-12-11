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
    use ava_domain::ViewProfileSpec;
    use std::collections::HashMap;

    fn make_work(view_id: &str, lane: Lane) -> ScheduledWork {
        ScheduledWork {
            view_id: ViewId::new(view_id),
            action: FiberAction::Compile {
                view_id: ViewId::new(view_id),
                spec: ViewProfileSpec {
                    id: ViewId::new(view_id),
                    name: "Test".into(),
                    description: None,
                    assemblage_id: ava_domain::AssemblageId::new("test"),
                    channels: vec![],
                    tags: HashMap::new(),
                    version: 1,
                },
            },
            lane,
            enqueued_at_ms: 1000.0,
        }
    }

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
    async fn test_drain() {
        let scheduler = LaneScheduler::new();

        for i in 1..=10 {
            scheduler.enqueue(make_work(&format!("view-{}", i), Lane::Background)).await;
        }

        let batch = scheduler.drain(5).await;
        assert_eq!(batch.len(), 5);
        assert_eq!(scheduler.len().await, 5);
    }
}
