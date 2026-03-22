//! EventLog - Append-only log of ReconcilerEvents
//!
//! The event log is the source of truth for the reconciler.
//! It enables replay, debugging, and audit trails.

use std::sync::atomic::{AtomicU64, Ordering};
use tokio::sync::RwLock;

use ava_domain::{
    ReconcilerEvent, EventLogEntry, EventSequence, ViewId,
};

use super::error::ReconcilerError;

/// Append-only event log for reconciler events
pub struct EventLog {
    /// Events stored in sequence order
    events: RwLock<Vec<EventLogEntry>>,

    /// Next sequence number (atomic for lock-free increment)
    next_sequence: AtomicU64,
}

impl EventLog {
    /// Creates a new empty event log
    pub fn new() -> Self {
        Self {
            events: RwLock::new(Vec::new()),
            next_sequence: AtomicU64::new(1),
        }
    }

    /// Appends an event to the log, returning its sequence number
    pub async fn append(&self, event: ReconcilerEvent) -> EventSequence {
        let sequence = EventSequence::new(
            self.next_sequence.fetch_add(1, Ordering::SeqCst)
        );

        let entry = EventLogEntry {
            sequence: sequence.clone(),
            event,
        };

        let mut events = self.events.write().await;
        events.push(entry);

        sequence
    }

    /// Returns all events in the log
    pub async fn all(&self) -> Vec<EventLogEntry> {
        self.events.read().await.clone()
    }

    /// Returns events starting from a sequence number
    pub async fn from_sequence(&self, from: EventSequence) -> Vec<EventLogEntry> {
        let events = self.events.read().await;
        events
            .iter()
            .filter(|e| e.sequence.0 >= from.0)
            .cloned()
            .collect()
    }

    /// Returns events for a specific view
    pub async fn for_view(&self, view_id: &ViewId) -> Vec<EventLogEntry> {
        let events = self.events.read().await;
        events
            .iter()
            .filter(|e| e.event.view_id() == view_id)
            .cloned()
            .collect()
    }

    /// Returns the latest sequence number (0 if empty)
    pub async fn latest_sequence(&self) -> EventSequence {
        EventSequence::new(self.next_sequence.load(Ordering::SeqCst).saturating_sub(1))
    }

    /// Returns the number of events in the log
    pub async fn len(&self) -> usize {
        self.events.read().await.len()
    }

    /// Returns true if the log is empty
    pub async fn is_empty(&self) -> bool {
        self.events.read().await.is_empty()
    }

    /// Compacts the log by removing events up to (and including) the given sequence
    /// Returns the number of events removed
    pub async fn compact(&self, up_to: EventSequence) -> usize {
        let mut events = self.events.write().await;
        let original_len = events.len();
        events.retain(|e| e.sequence.0 > up_to.0);
        original_len - events.len()
    }

    /// Replays events through a handler function
    /// Returns the final sequence processed
    pub async fn replay<F>(&self, mut handler: F) -> Result<EventSequence, ReconcilerError>
    where
        F: FnMut(&EventLogEntry) -> Result<(), ReconcilerError>,
    {
        let events = self.events.read().await;
        let mut last_sequence = EventSequence::new(0);

        for entry in events.iter() {
            handler(entry)?;
            last_sequence = entry.sequence.clone();
        }

        Ok(last_sequence)
    }
}

impl Default for EventLog {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ava_domain::{ViewProfileSpec, AssemblageId, ViewArtifact, UnmountReason, ViewDelta};
    use std::collections::HashMap;
    use tokio::task::JoinSet;

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

    // ========== Basic Operations ==========

    #[tokio::test]
    async fn test_append_and_retrieve() {
        let log = EventLog::new();

        let event = ReconcilerEvent::ViewRequested {
            view_id: ViewId::new("view-1"),
            spec: make_test_spec("view-1"),
            timestamp_ms: 1000.0,
        };

        let seq = log.append(event).await;
        assert_eq!(seq.0, 1);

        let events = log.all().await;
        assert_eq!(events.len(), 1);
        assert_eq!(events[0].sequence.0, 1);
    }

    #[tokio::test]
    async fn test_sequence_increments() {
        let log = EventLog::new();

        for i in 1..=5 {
            let event = ReconcilerEvent::ViewRequested {
                view_id: ViewId::new(&format!("view-{}", i)),
                spec: make_test_spec(&format!("view-{}", i)),
                timestamp_ms: (i * 1000) as f64,
            };
            let seq = log.append(event).await;
            assert_eq!(seq.0, i as u64);
        }

        assert_eq!(log.len().await, 5);
    }

    #[tokio::test]
    async fn test_new_log_is_empty() {
        let log = EventLog::new();
        assert!(log.is_empty().await);
        assert_eq!(log.len().await, 0);
        assert_eq!(log.latest_sequence().await.0, 0);
    }

    #[tokio::test]
    async fn test_latest_sequence_after_appends() {
        let log = EventLog::new();

        // Initially 0
        assert_eq!(log.latest_sequence().await.0, 0);

        log.append(ReconcilerEvent::ViewRequested {
            view_id: ViewId::new("view-1"),
            spec: make_test_spec("view-1"),
            timestamp_ms: 1000.0,
        }).await;

        assert_eq!(log.latest_sequence().await.0, 1);

        log.append(ReconcilerEvent::ViewResumed {
            view_id: ViewId::new("view-1"),
            timestamp_ms: 2000.0,
        }).await;

        assert_eq!(log.latest_sequence().await.0, 2);
    }

    // ========== Filter Operations ==========

    #[tokio::test]
    async fn test_filter_by_view() {
        let log = EventLog::new();

        // Add events for two different views
        log.append(ReconcilerEvent::ViewRequested {
            view_id: ViewId::new("view-1"),
            spec: make_test_spec("view-1"),
            timestamp_ms: 1000.0,
        }).await;

        log.append(ReconcilerEvent::ViewRequested {
            view_id: ViewId::new("view-2"),
            spec: make_test_spec("view-2"),
            timestamp_ms: 2000.0,
        }).await;

        log.append(ReconcilerEvent::ViewResumed {
            view_id: ViewId::new("view-1"),
            timestamp_ms: 3000.0,
        }).await;

        let view1_events = log.for_view(&ViewId::new("view-1")).await;
        assert_eq!(view1_events.len(), 2);

        let view2_events = log.for_view(&ViewId::new("view-2")).await;
        assert_eq!(view2_events.len(), 1);
    }

    #[tokio::test]
    async fn test_filter_by_view_nonexistent() {
        let log = EventLog::new();

        log.append(ReconcilerEvent::ViewRequested {
            view_id: ViewId::new("view-1"),
            spec: make_test_spec("view-1"),
            timestamp_ms: 1000.0,
        }).await;

        let events = log.for_view(&ViewId::new("nonexistent")).await;
        assert!(events.is_empty());
    }

    #[tokio::test]
    async fn test_from_sequence_pagination() {
        let log = EventLog::new();

        for i in 1..=10 {
            log.append(ReconcilerEvent::ViewRequested {
                view_id: ViewId::new(&format!("view-{}", i)),
                spec: make_test_spec(&format!("view-{}", i)),
                timestamp_ms: (i * 1000) as f64,
            }).await;
        }

        // Get events from sequence 5 onwards
        let events = log.from_sequence(EventSequence::new(5)).await;
        assert_eq!(events.len(), 6); // 5, 6, 7, 8, 9, 10
        assert_eq!(events[0].sequence.0, 5);
        assert_eq!(events[5].sequence.0, 10);
    }

    #[tokio::test]
    async fn test_from_sequence_beyond_latest() {
        let log = EventLog::new();

        log.append(ReconcilerEvent::ViewRequested {
            view_id: ViewId::new("view-1"),
            spec: make_test_spec("view-1"),
            timestamp_ms: 1000.0,
        }).await;

        let events = log.from_sequence(EventSequence::new(100)).await;
        assert!(events.is_empty());
    }

    // ========== Compact Operations ==========

    #[tokio::test]
    async fn test_compact() {
        let log = EventLog::new();

        for i in 1..=10 {
            log.append(ReconcilerEvent::ViewRequested {
                view_id: ViewId::new(&format!("view-{}", i)),
                spec: make_test_spec(&format!("view-{}", i)),
                timestamp_ms: (i * 1000) as f64,
            }).await;
        }

        assert_eq!(log.len().await, 10);

        // Compact up to sequence 5
        let removed = log.compact(EventSequence::new(5)).await;
        assert_eq!(removed, 5);
        assert_eq!(log.len().await, 5);

        // Remaining events should be 6-10
        let events = log.all().await;
        assert_eq!(events[0].sequence.0, 6);
    }

    #[tokio::test]
    async fn test_compact_all() {
        let log = EventLog::new();

        for i in 1..=5 {
            log.append(ReconcilerEvent::ViewRequested {
                view_id: ViewId::new(&format!("view-{}", i)),
                spec: make_test_spec(&format!("view-{}", i)),
                timestamp_ms: (i * 1000) as f64,
            }).await;
        }

        let removed = log.compact(EventSequence::new(100)).await;
        assert_eq!(removed, 5);
        assert!(log.is_empty().await);
    }

    #[tokio::test]
    async fn test_compact_none() {
        let log = EventLog::new();

        for i in 1..=5 {
            log.append(ReconcilerEvent::ViewRequested {
                view_id: ViewId::new(&format!("view-{}", i)),
                spec: make_test_spec(&format!("view-{}", i)),
                timestamp_ms: (i * 1000) as f64,
            }).await;
        }

        let removed = log.compact(EventSequence::new(0)).await;
        assert_eq!(removed, 0);
        assert_eq!(log.len().await, 5);
    }

    #[tokio::test]
    async fn test_compact_empty_log() {
        let log = EventLog::new();
        let removed = log.compact(EventSequence::new(10)).await;
        assert_eq!(removed, 0);
    }

    // ========== Replay Operations ==========

    #[tokio::test]
    async fn test_replay() {
        let log = EventLog::new();

        for i in 1..=3 {
            log.append(ReconcilerEvent::ViewRequested {
                view_id: ViewId::new(&format!("view-{}", i)),
                spec: make_test_spec(&format!("view-{}", i)),
                timestamp_ms: (i * 1000) as f64,
            }).await;
        }

        let mut count = 0;
        let last_seq = log.replay(|_entry| {
            count += 1;
            Ok(())
        }).await.unwrap();

        assert_eq!(count, 3);
        assert_eq!(last_seq.0, 3);
    }

    #[tokio::test]
    async fn test_replay_empty_log() {
        let log = EventLog::new();

        let mut count = 0;
        let last_seq = log.replay(|_| {
            count += 1;
            Ok(())
        }).await.unwrap();

        assert_eq!(count, 0);
        assert_eq!(last_seq.0, 0);
    }

    #[tokio::test]
    async fn test_replay_early_failure() {
        let log = EventLog::new();

        for i in 1..=5 {
            log.append(ReconcilerEvent::ViewRequested {
                view_id: ViewId::new(&format!("view-{}", i)),
                spec: make_test_spec(&format!("view-{}", i)),
                timestamp_ms: (i * 1000) as f64,
            }).await;
        }

        let mut count = 0;
        let result = log.replay(|entry| {
            count += 1;
            if entry.sequence.0 == 3 {
                Err(ReconcilerError::ReplayFailed { message: "test error".into() })
            } else {
                Ok(())
            }
        }).await;

        assert!(result.is_err());
        assert_eq!(count, 3); // Stopped at 3rd event
    }

    #[tokio::test]
    async fn test_replay_collects_event_data() {
        let log = EventLog::new();

        log.append(ReconcilerEvent::ViewRequested {
            view_id: ViewId::new("view-1"),
            spec: make_test_spec("view-1"),
            timestamp_ms: 1000.0,
        }).await;

        log.append(ReconcilerEvent::ViewMounted {
            view_id: ViewId::new("view-1"),
            artifact: make_test_artifact("view-1"),
            timestamp_ms: 2000.0,
        }).await;

        log.append(ReconcilerEvent::ViewSuspended {
            view_id: ViewId::new("view-1"),
            reason: "resource contention".into(),
            timestamp_ms: 3000.0,
        }).await;

        let mut view_ids = Vec::new();
        log.replay(|entry| {
            view_ids.push(entry.event.view_id().clone());
            Ok(())
        }).await.unwrap();

        assert_eq!(view_ids.len(), 3);
        assert!(view_ids.iter().all(|id| id.as_str() == "view-1"));
    }

    // ========== All Event Types ==========

    #[tokio::test]
    async fn test_all_event_types() {
        let log = EventLog::new();

        // ViewRequested
        log.append(ReconcilerEvent::ViewRequested {
            view_id: ViewId::new("view-1"),
            spec: make_test_spec("view-1"),
            timestamp_ms: 1000.0,
        }).await;

        // ViewMounted
        log.append(ReconcilerEvent::ViewMounted {
            view_id: ViewId::new("view-1"),
            artifact: make_test_artifact("view-1"),
            timestamp_ms: 2000.0,
        }).await;

        // ViewUpdated
        log.append(ReconcilerEvent::ViewUpdated {
            view_id: ViewId::new("view-1"),
            delta: ViewDelta::ArtifactReplaced {
                artifact: Box::new(make_test_artifact("view-1")),
            },
            sequence: EventSequence::new(1),
            timestamp_ms: 3000.0,
        }).await;

        // ViewSuspended
        log.append(ReconcilerEvent::ViewSuspended {
            view_id: ViewId::new("view-1"),
            reason: "resource contention".into(),
            timestamp_ms: 4000.0,
        }).await;

        // ViewResumed
        log.append(ReconcilerEvent::ViewResumed {
            view_id: ViewId::new("view-1"),
            timestamp_ms: 5000.0,
        }).await;

        // ViewCompilationFailed
        log.append(ReconcilerEvent::ViewCompilationFailed {
            view_id: ViewId::new("view-2"),
            error: "compilation error".into(),
            timestamp_ms: 6000.0,
        }).await;

        // ViewUnmounted
        log.append(ReconcilerEvent::ViewUnmounted {
            view_id: ViewId::new("view-1"),
            reason: UnmountReason::ClientRequest,
            timestamp_ms: 7000.0,
        }).await;

        assert_eq!(log.len().await, 7);

        let events = log.all().await;
        assert!(matches!(&events[0].event, ReconcilerEvent::ViewRequested { .. }));
        assert!(matches!(&events[1].event, ReconcilerEvent::ViewMounted { .. }));
        assert!(matches!(&events[2].event, ReconcilerEvent::ViewUpdated { .. }));
        assert!(matches!(&events[3].event, ReconcilerEvent::ViewSuspended { .. }));
        assert!(matches!(&events[4].event, ReconcilerEvent::ViewResumed { .. }));
        assert!(matches!(&events[5].event, ReconcilerEvent::ViewCompilationFailed { .. }));
        assert!(matches!(&events[6].event, ReconcilerEvent::ViewUnmounted { .. }));
    }

    // ========== Concurrency Tests ==========

    #[tokio::test]
    async fn test_concurrent_appends() {
        let log = std::sync::Arc::new(EventLog::new());
        let mut join_set = JoinSet::new();

        // Spawn 10 concurrent append tasks
        for i in 0..10 {
            let log = log.clone();
            join_set.spawn(async move {
                log.append(ReconcilerEvent::ViewRequested {
                    view_id: ViewId::new(&format!("view-{}", i)),
                    spec: make_test_spec(&format!("view-{}", i)),
                    timestamp_ms: (i * 1000) as f64,
                }).await
            });
        }

        // Wait for all tasks
        let mut sequences = Vec::new();
        while let Some(result) = join_set.join_next().await {
            sequences.push(result.unwrap());
        }

        // All should have unique sequences
        sequences.sort_by_key(|s| s.0);
        assert_eq!(sequences.len(), 10);

        // Verify uniqueness
        for (i, seq) in sequences.iter().enumerate() {
            assert_eq!(seq.0, (i + 1) as u64);
        }

        assert_eq!(log.len().await, 10);
    }

    #[tokio::test]
    async fn test_concurrent_read_write() {
        let log = std::sync::Arc::new(EventLog::new());

        // Pre-populate
        for i in 1..=5 {
            log.append(ReconcilerEvent::ViewRequested {
                view_id: ViewId::new(&format!("view-{}", i)),
                spec: make_test_spec(&format!("view-{}", i)),
                timestamp_ms: (i * 1000) as f64,
            }).await;
        }

        let mut join_set = JoinSet::new();

        // Writer task
        let log_w = log.clone();
        join_set.spawn(async move {
            for i in 6..=10 {
                log_w.append(ReconcilerEvent::ViewRequested {
                    view_id: ViewId::new(&format!("view-{}", i)),
                    spec: make_test_spec(&format!("view-{}", i)),
                    timestamp_ms: (i * 1000) as f64,
                }).await;
            }
        });

        // Reader tasks
        for _ in 0..3 {
            let log_r = log.clone();
            join_set.spawn(async move {
                for _ in 0..10 {
                    let _ = log_r.all().await;
                    let _ = log_r.len().await;
                }
            });
        }

        while let Some(result) = join_set.join_next().await {
            result.unwrap();
        }

        assert_eq!(log.len().await, 10);
    }

    // ========== Edge Cases ==========

    #[tokio::test]
    async fn test_events_with_same_view_ordering() {
        let log = EventLog::new();

        // Multiple events for same view
        for i in 1..=5 {
            log.append(ReconcilerEvent::ViewRequested {
                view_id: ViewId::new("shared-view"),
                spec: make_test_spec("shared-view"),
                timestamp_ms: (i * 1000) as f64,
            }).await;
        }

        let events = log.for_view(&ViewId::new("shared-view")).await;
        assert_eq!(events.len(), 5);

        // Verify ordering is maintained
        for (i, event) in events.iter().enumerate() {
            assert_eq!(event.sequence.0, (i + 1) as u64);
        }
    }

    #[tokio::test]
    async fn test_sequence_gap_after_compact() {
        let log = EventLog::new();

        for i in 1..=10 {
            log.append(ReconcilerEvent::ViewRequested {
                view_id: ViewId::new(&format!("view-{}", i)),
                spec: make_test_spec(&format!("view-{}", i)),
                timestamp_ms: (i * 1000) as f64,
            }).await;
        }

        log.compact(EventSequence::new(5)).await;

        // Add new event - sequence should continue from 11, not 1
        let seq = log.append(ReconcilerEvent::ViewRequested {
            view_id: ViewId::new("view-11"),
            spec: make_test_spec("view-11"),
            timestamp_ms: 11000.0,
        }).await;

        assert_eq!(seq.0, 11);

        // Verify gap exists in stored events
        let events = log.all().await;
        assert_eq!(events[0].sequence.0, 6); // First remaining from original
        assert_eq!(events[events.len() - 1].sequence.0, 11); // New event
    }

    #[tokio::test]
    async fn test_clone_isolation() {
        let log = EventLog::new();

        log.append(ReconcilerEvent::ViewRequested {
            view_id: ViewId::new("view-1"),
            spec: make_test_spec("view-1"),
            timestamp_ms: 1000.0,
        }).await;

        // Get a clone of events
        let events_clone = log.all().await;

        // Add more to log
        log.append(ReconcilerEvent::ViewRequested {
            view_id: ViewId::new("view-2"),
            spec: make_test_spec("view-2"),
            timestamp_ms: 2000.0,
        }).await;

        // Clone should be unchanged
        assert_eq!(events_clone.len(), 1);
        assert_eq!(log.len().await, 2);
    }
}
