//! Integration tests for ava-reconciler
//!
//! These tests verify the interaction between multiple modules using only
//! the public API:
//! - Reconciler request/update/unmount flow
//! - EventLog event recording and querying
//! - Scheduler priority and ordering
//! - Differ state comparison
//! - End-to-end view lifecycle scenarios (up to compilation point)

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use ava_domain::{
    AssemblageId, ChannelId, ChannelPipelineSpec, ChannelRole, FiberAction, Lane,
    MaterializationTier, ReconcilerEvent, SourceId, SourceKind, SourceSpec,
    UnmountReason, ViewId, ViewProfileSpec,
};
use ava_reconciler::{Differ, EventLog, FiberState, LaneScheduler, Reconciler, ViewFiber};

// ==================== Helpers ====================

fn make_spec(view_id: &str, version: u32) -> ViewProfileSpec {
    ViewProfileSpec {
        id: ViewId::new(view_id),
        name: format!("View {}", view_id),
        description: None,
        assemblage_id: AssemblageId::new("test-assemblage"),
        channels: vec![],
        tags: HashMap::new(),
        version,
    }
}

fn make_spec_with_channels(view_id: &str, version: u32, channel_count: usize) -> ViewProfileSpec {
    let channels: Vec<ChannelPipelineSpec> = (0..channel_count)
        .map(|i| ChannelPipelineSpec {
            id: ChannelId::new(&format!("{}-channel-{}", view_id, i)),
            role: ChannelRole::State,
            source: SourceSpec {
                id: SourceId::new(&format!("{}-source-{}", view_id, i)),
                kind: SourceKind::Stream,
                connection: format!("stream://{}/{}", view_id, i),
                schema: Some("{}".into()),
            },
            additional_sources: vec![],
            pipeline: vec![],
            materialization: MaterializationTier::Cached,
            refresh_ms: Some(1000),
        })
        .collect();

    ViewProfileSpec {
        id: ViewId::new(view_id),
        name: format!("View {} with {} channels", view_id, channel_count),
        description: Some(format!("Test view with {} channels", channel_count)),
        assemblage_id: AssemblageId::new("test-assemblage"),
        channels,
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

// ==================== Request/Update/Unmount Flow ====================

#[tokio::test]
async fn test_request_creates_pending_fiber() {
    let reconciler = make_test_reconciler();

    let spec = make_spec("view-1", 1);
    let seq = reconciler.request(spec, Lane::SoftRealTime).await.unwrap();

    assert_eq!(seq.0, 1);

    // Process compile action
    let action = reconciler.tick().await;
    assert!(matches!(action, Some(FiberAction::Compile { view_id, .. }) if view_id.as_str() == "view-1"));

    // Verify fiber exists in Pending state
    let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
    assert_eq!(fiber.state, FiberState::Pending);
    assert_eq!(fiber.lane, Lane::SoftRealTime);
}

#[tokio::test]
async fn test_update_schedules_update_action() {
    let reconciler = make_test_reconciler();

    // Create view
    reconciler.request(make_spec("view-1", 1), Lane::Background).await.unwrap();
    reconciler.tick().await;

    // Update it
    reconciler.update(make_spec("view-1", 2)).await.unwrap();

    // Process update
    let action = reconciler.tick().await;
    assert!(matches!(action, Some(FiberAction::Update { view_id, .. }) if view_id.as_str() == "view-1"));
}

#[tokio::test]
async fn test_unmount_removes_fiber() {
    let reconciler = make_test_reconciler();

    // Create view
    reconciler.request(make_spec("view-1", 1), Lane::Background).await.unwrap();
    reconciler.tick().await;

    // Verify exists
    assert!(reconciler.get_fiber(&ViewId::new("view-1")).await.is_some());

    // Unmount
    reconciler.unmount(ViewId::new("view-1"), UnmountReason::ClientRequest).await.unwrap();
    reconciler.tick().await;

    // Verify removed
    assert!(reconciler.get_fiber(&ViewId::new("view-1")).await.is_none());
}

// ==================== EventLog Integration ====================

#[tokio::test]
async fn test_event_log_records_request() {
    let reconciler = make_test_reconciler();

    reconciler.request(make_spec("view-1", 1), Lane::Background).await.unwrap();

    let events = reconciler.event_log().all().await;
    assert_eq!(events.len(), 1);
    assert!(matches!(&events[0].event, ReconcilerEvent::ViewRequested { view_id, .. } if view_id.as_str() == "view-1"));
}

#[tokio::test]
async fn test_event_log_records_update() {
    let reconciler = make_test_reconciler();

    reconciler.request(make_spec("view-1", 1), Lane::Background).await.unwrap();
    reconciler.tick().await;
    reconciler.update(make_spec("view-1", 2)).await.unwrap();

    let events = reconciler.event_log().all().await;
    assert_eq!(events.len(), 2);
    assert!(matches!(&events[1].event, ReconcilerEvent::ViewUpdated { .. }));
}

#[tokio::test]
async fn test_event_log_records_unmount() {
    let reconciler = make_test_reconciler();

    reconciler.request(make_spec("view-1", 1), Lane::Background).await.unwrap();
    reconciler.tick().await;
    reconciler.unmount(ViewId::new("view-1"), UnmountReason::ClientRequest).await.unwrap();

    let events = reconciler.event_log().all().await;
    assert_eq!(events.len(), 2);
    assert!(matches!(&events[1].event, ReconcilerEvent::ViewUnmounted { .. }));
}

#[tokio::test]
async fn test_event_log_sequences_are_monotonic() {
    let reconciler = make_test_reconciler();

    for i in 0..10 {
        let seq = reconciler.request(make_spec(&format!("view-{}", i), 1), Lane::Background).await.unwrap();
        assert_eq!(seq.0, (i + 1) as u64);
    }

    let events = reconciler.event_log().all().await;
    let sequences: Vec<u64> = events.iter().map(|e| e.sequence.0).collect();

    for window in sequences.windows(2) {
        assert!(window[1] > window[0], "Sequences should be strictly increasing");
    }
}

#[tokio::test]
async fn test_event_log_for_view_filter() {
    let reconciler = make_test_reconciler();

    // Create multiple views
    for i in 0..5 {
        reconciler.request(make_spec(&format!("view-{}", i), 1), Lane::Background).await.unwrap();
    }

    // Query for specific view
    let view_2_events = reconciler.event_log().for_view(&ViewId::new("view-2")).await;
    assert_eq!(view_2_events.len(), 1);

    if let ReconcilerEvent::ViewRequested { view_id, .. } = &view_2_events[0].event {
        assert_eq!(view_id.as_str(), "view-2");
    }
}

#[tokio::test]
async fn test_event_log_from_sequence() {
    let reconciler = make_test_reconciler();

    for i in 0..10 {
        reconciler.request(make_spec(&format!("view-{}", i), 1), Lane::Background).await.unwrap();
    }

    // Get events from sequence 5
    let events = reconciler.event_log().from_sequence(ava_domain::EventSequence(5)).await;

    assert_eq!(events.len(), 6); // Sequences 5, 6, 7, 8, 9, 10
    assert!(events.iter().all(|e| e.sequence.0 >= 5));
}

#[tokio::test]
async fn test_event_log_compaction() {
    let reconciler = make_test_reconciler();

    for i in 0..10 {
        reconciler.request(make_spec(&format!("view-{}", i), 1), Lane::Background).await.unwrap();
    }

    // Compact up to sequence 5
    let compacted_count = reconciler.event_log().compact(ava_domain::EventSequence(5)).await;
    assert!(compacted_count > 0);

    // Remaining events should have sequence > 5
    let remaining = reconciler.event_log().all().await;
    for event in &remaining {
        assert!(event.sequence.0 > 5);
    }
}

// ==================== Scheduler Integration ====================

#[tokio::test]
async fn test_scheduler_priority_ordering() {
    let reconciler = make_test_reconciler();

    // Request in reverse priority order
    reconciler.request(make_spec("bg", 1), Lane::Background).await.unwrap();
    reconciler.request(make_spec("srt", 1), Lane::SoftRealTime).await.unwrap();
    reconciler.request(make_spec("hrt", 1), Lane::HardRealTime).await.unwrap();

    // Verify scheduler stats
    let stats = reconciler.scheduler().queue_stats().await;
    assert_eq!(stats.hard_rt, 1);
    assert_eq!(stats.soft_rt, 1);
    assert_eq!(stats.background, 1);

    // Process in priority order
    let action1 = reconciler.tick().await.unwrap();
    assert!(matches!(action1, FiberAction::Compile { view_id, .. } if view_id.as_str() == "hrt"));

    let action2 = reconciler.tick().await.unwrap();
    assert!(matches!(action2, FiberAction::Compile { view_id, .. } if view_id.as_str() == "srt"));

    let action3 = reconciler.tick().await.unwrap();
    assert!(matches!(action3, FiberAction::Compile { view_id, .. } if view_id.as_str() == "bg"));

    // Scheduler empty
    assert_eq!(reconciler.scheduler().queue_stats().await.total(), 0);
}

#[tokio::test]
async fn test_scheduler_fifo_within_lane() {
    let reconciler = make_test_reconciler();

    // Request multiple at same priority
    for i in 0..5 {
        reconciler.request(make_spec(&format!("view-{}", i), 1), Lane::Background).await.unwrap();
    }

    // Collect processing order
    let mut order = Vec::new();
    while let Some(action) = reconciler.tick().await {
        if let FiberAction::Compile { view_id, .. } = action {
            order.push(view_id.as_str().to_string());
        }
    }

    assert_eq!(order, vec!["view-0", "view-1", "view-2", "view-3", "view-4"]);
}

#[tokio::test]
async fn test_scheduler_drain() {
    let reconciler = make_test_reconciler();

    for i in 0..10 {
        reconciler.request(make_spec(&format!("view-{}", i), 1), Lane::Background).await.unwrap();
    }

    let drained = reconciler.scheduler().drain(5).await;
    assert_eq!(drained.len(), 5);

    let remaining = reconciler.scheduler().queue_stats().await;
    assert_eq!(remaining.total(), 5);
}

// ==================== Mark Failed Path ====================

#[tokio::test]
async fn test_mark_failed_transitions_to_failed() {
    let reconciler = make_test_reconciler();

    reconciler.request(make_spec("view-1", 1), Lane::Background).await.unwrap();
    reconciler.tick().await;

    reconciler.mark_failed(&ViewId::new("view-1"), "Compilation error".into()).await.unwrap();

    let fiber = reconciler.get_fiber(&ViewId::new("view-1")).await.unwrap();
    assert!(matches!(fiber.state, FiberState::Failed { .. }));
    assert!(fiber.state.is_terminal());
}

#[tokio::test]
async fn test_mark_failed_logs_event() {
    let reconciler = make_test_reconciler();

    reconciler.request(make_spec("view-1", 1), Lane::Background).await.unwrap();
    reconciler.tick().await;
    reconciler.mark_failed(&ViewId::new("view-1"), "Error message".into()).await.unwrap();

    let events = reconciler.event_log().all().await;
    let failure_events: Vec<_> = events.iter()
        .filter(|e| matches!(&e.event, ReconcilerEvent::ViewCompilationFailed { .. }))
        .collect();

    assert_eq!(failure_events.len(), 1);

    if let ReconcilerEvent::ViewCompilationFailed { error, .. } = &failure_events[0].event {
        assert_eq!(error, "Error message");
    }
}

#[tokio::test]
async fn test_mark_failed_nonexistent_view() {
    let reconciler = make_test_reconciler();

    let result = reconciler.mark_failed(&ViewId::new("nonexistent"), "error".into()).await;
    assert!(result.is_err());
}

// ==================== Multi-View Scenarios ====================

#[tokio::test]
async fn test_many_views_creation() {
    let reconciler = make_test_reconciler();

    for i in 0..50 {
        reconciler.request(make_spec(&format!("view-{}", i), 1), Lane::Background).await.unwrap();
    }

    let actions = reconciler.tick_all().await;
    assert_eq!(actions.len(), 50);

    let ids = reconciler.active_view_ids().await;
    assert_eq!(ids.len(), 50);
}

#[tokio::test]
async fn test_mixed_priorities() {
    let reconciler = make_test_reconciler();

    // Create views at different priorities
    for i in 0..30 {
        let lane = match i % 3 {
            0 => Lane::HardRealTime,
            1 => Lane::SoftRealTime,
            _ => Lane::Background,
        };
        reconciler.request(make_spec(&format!("view-{}", i), 1), lane).await.unwrap();
    }

    // Verify distribution
    let stats = reconciler.scheduler().queue_stats().await;
    assert_eq!(stats.hard_rt, 10);
    assert_eq!(stats.soft_rt, 10);
    assert_eq!(stats.background, 10);

    // Process all
    reconciler.tick_all().await;
    assert_eq!(reconciler.active_view_ids().await.len(), 30);
}

#[tokio::test]
async fn test_rapid_create_unmount() {
    let reconciler = make_test_reconciler();

    for i in 0..20 {
        let view_id = format!("view-{}", i);

        reconciler.request(make_spec(&view_id, 1), Lane::Background).await.unwrap();
        reconciler.tick().await;
        reconciler.unmount(ViewId::new(&view_id), UnmountReason::ClientRequest).await.unwrap();
        reconciler.tick().await;
    }

    assert!(reconciler.active_view_ids().await.is_empty());

    // Should have 40 events (20 requests + 20 unmounts)
    let events = reconciler.event_log().all().await;
    assert_eq!(events.len(), 40);
}

// ==================== Views With Channels ====================

#[tokio::test]
async fn test_views_with_channels() {
    let reconciler = make_test_reconciler();

    for i in 0..5 {
        let spec = make_spec_with_channels(&format!("view-{}", i), 1, (i + 1) * 2);
        reconciler.request(spec, Lane::Background).await.unwrap();
    }

    reconciler.tick_all().await;
    assert_eq!(reconciler.active_view_ids().await.len(), 5);
}

// ==================== Concurrent Operations ====================

#[tokio::test]
async fn test_concurrent_requests() {
    let reconciler = Arc::new(make_test_reconciler());

    let handles: Vec<_> = (0..30)
        .map(|i| {
            let r = reconciler.clone();
            tokio::spawn(async move {
                r.request(make_spec(&format!("view-{}", i), 1), Lane::Background).await
            })
        })
        .collect();

    let results: Vec<_> = futures::future::join_all(handles)
        .await
        .into_iter()
        .filter_map(|r| r.ok())
        .filter_map(|r| r.ok())
        .collect();

    assert_eq!(results.len(), 30);

    reconciler.tick_all().await;
    assert_eq!(reconciler.active_view_ids().await.len(), 30);
}

#[tokio::test]
async fn test_concurrent_tick_all() {
    let reconciler = Arc::new(make_test_reconciler());

    for i in 0..50 {
        reconciler.request(make_spec(&format!("view-{}", i), 1), Lane::Background).await.unwrap();
    }

    let handles: Vec<_> = (0..5)
        .map(|_| {
            let r = reconciler.clone();
            tokio::spawn(async move { r.tick_all().await })
        })
        .collect();

    let results: Vec<Vec<_>> = futures::future::join_all(handles)
        .await
        .into_iter()
        .filter_map(|r| r.ok())
        .collect();

    let total: usize = results.iter().map(|v| v.len()).sum();
    assert_eq!(total, 50);
}

#[tokio::test]
async fn test_concurrent_read_write() {
    let reconciler = Arc::new(make_test_reconciler());

    let r1 = reconciler.clone();
    let writer = tokio::spawn(async move {
        for i in 0..50 {
            r1.request(make_spec(&format!("view-{}", i), 1), Lane::Background).await.ok();
            r1.tick().await;
        }
    });

    let r2 = reconciler.clone();
    let reader = tokio::spawn(async move {
        for _ in 0..100 {
            let _ = r2.active_view_ids().await;
            let _ = r2.get_fiber(&ViewId::new("view-0")).await;
            tokio::task::yield_now().await;
        }
    });

    let _ = tokio::join!(writer, reader);

    assert!(!reconciler.active_view_ids().await.is_empty());
}

// ==================== Error Handling ====================

#[tokio::test]
async fn test_duplicate_request_fails() {
    let reconciler = make_test_reconciler();

    reconciler.request(make_spec("view-1", 1), Lane::Background).await.unwrap();
    reconciler.tick().await;

    let result = reconciler.request(make_spec("view-1", 1), Lane::Background).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_update_nonexistent_fails() {
    let reconciler = make_test_reconciler();

    let result = reconciler.update(make_spec("nonexistent", 1)).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_unmount_nonexistent_fails() {
    let reconciler = make_test_reconciler();

    let result = reconciler.unmount(ViewId::new("nonexistent"), UnmountReason::ClientRequest).await;
    assert!(result.is_err());
}

// ==================== Differ Module ====================

#[test]
fn test_differ_detects_new_views() {
    let mut desired = HashMap::new();
    desired.insert(ViewId::new("new-view"), make_spec("new-view", 1));

    let active = HashMap::new();

    let result = Differ::diff(&desired, &active);

    assert_eq!(result.to_compile.len(), 1);
    assert!(result.to_compile.contains(&ViewId::new("new-view")));
    assert!(result.has_changes());
}

#[test]
fn test_differ_detects_removed_views() {
    let desired = HashMap::new();

    let mut active = HashMap::new();
    let fiber = ViewFiber::new(make_spec("old-view", 1), Lane::Background, 1000.0);
    active.insert(ViewId::new("old-view"), fiber);

    let result = Differ::diff(&desired, &active);

    assert_eq!(result.to_unmount.len(), 1);
    assert!(result.to_unmount.contains(&ViewId::new("old-view")));
}

#[test]
fn test_differ_detects_version_changes() {
    let mut desired = HashMap::new();
    desired.insert(ViewId::new("view-1"), make_spec("view-1", 2));

    let mut active = HashMap::new();
    let fiber = ViewFiber::new(make_spec("view-1", 1), Lane::Background, 1000.0);
    active.insert(ViewId::new("view-1"), fiber);

    let result = Differ::diff(&desired, &active);

    assert_eq!(result.to_update.len(), 1);
    assert!(result.to_update.contains(&ViewId::new("view-1")));
}

#[test]
fn test_differ_unchanged_views() {
    let spec = make_spec("view-1", 1);

    let mut desired = HashMap::new();
    desired.insert(ViewId::new("view-1"), spec.clone());

    let mut active = HashMap::new();
    let fiber = ViewFiber::new(spec, Lane::Background, 1000.0);
    active.insert(ViewId::new("view-1"), fiber);

    let result = Differ::diff(&desired, &active);

    assert!(!result.has_changes() || (result.to_compile.is_empty() && result.to_update.is_empty() && result.to_unmount.is_empty()));
}

// ==================== EventLog Standalone ====================

#[tokio::test]
async fn test_event_log_standalone() {
    let log = EventLog::new();

    // Append events
    for i in 0..5 {
        let event = ReconcilerEvent::ViewRequested {
            view_id: ViewId::new(&format!("view-{}", i)),
            spec: make_spec(&format!("view-{}", i), 1),
            timestamp_ms: (i * 100) as f64,
        };
        log.append(event).await;
    }

    // Query all
    let all = log.all().await;
    assert_eq!(all.len(), 5);

    // Query by view
    let filtered = log.for_view(&ViewId::new("view-2")).await;
    assert_eq!(filtered.len(), 1);

    // Query from sequence
    let from_seq = log.from_sequence(ava_domain::EventSequence(3)).await;
    assert_eq!(from_seq.len(), 3);
}

// ==================== Scheduler Standalone ====================

#[tokio::test]
async fn test_scheduler_standalone() {
    let scheduler = LaneScheduler::new();

    // Enqueue work at different lanes
    for i in 0..9 {
        let lane = match i % 3 {
            0 => Lane::HardRealTime,
            1 => Lane::SoftRealTime,
            _ => Lane::Background,
        };

        scheduler.enqueue(ava_reconciler::scheduler::ScheduledWork {
            view_id: ViewId::new(&format!("view-{}", i)),
            action: FiberAction::Noop,
            lane,
            enqueued_at_ms: (i * 100) as f64,
        }).await;
    }

    // Verify stats
    let stats = scheduler.queue_stats().await;
    assert_eq!(stats.hard_rt, 3);
    assert_eq!(stats.soft_rt, 3);
    assert_eq!(stats.background, 3);

    // Dequeue respects priority
    let first = scheduler.dequeue().await.unwrap();
    assert_eq!(first.lane, Lane::HardRealTime);
}

// ==================== ViewFiber Standalone ====================

#[test]
fn test_fiber_standalone() {
    let spec = make_spec("fiber-test", 1);
    let mut fiber = ViewFiber::new(spec, Lane::SoftRealTime, 1000.0);

    assert_eq!(fiber.state, FiberState::Pending);
    assert_eq!(fiber.lane, Lane::SoftRealTime);

    // Transition
    fiber.transition(FiberState::Compiled, 2000.0).unwrap();
    assert_eq!(fiber.state, FiberState::Compiled);

    fiber.transition(FiberState::Mounted, 3000.0).unwrap();
    assert_eq!(fiber.state, FiberState::Mounted);

    assert!(fiber.state.is_active());
    assert!(!fiber.state.is_terminal());
}

#[test]
fn test_fiber_failure_path() {
    let spec = make_spec("fiber-fail", 1);
    let mut fiber = ViewFiber::new(spec, Lane::Background, 1000.0);

    fiber.transition(FiberState::Failed { error: "compile error".into() }, 2000.0).unwrap();

    assert!(matches!(fiber.state, FiberState::Failed { .. }));
    assert!(fiber.state.is_terminal());
    assert!(!fiber.state.is_active());
}

// ==================== Edge Cases ====================

#[tokio::test]
async fn test_empty_view_id() {
    let reconciler = make_test_reconciler();

    let mut spec = make_spec("", 1);
    spec.id = ViewId::new("");

    let result = reconciler.request(spec, Lane::Background).await;
    assert!(result.is_ok());
}

#[tokio::test]
async fn test_unicode_view_id() {
    let reconciler = make_test_reconciler();

    let spec = make_spec("视图-αβγ-🎉", 1);
    reconciler.request(spec, Lane::Background).await.unwrap();
    reconciler.tick().await;

    let fiber = reconciler.get_fiber(&ViewId::new("视图-αβγ-🎉")).await;
    assert!(fiber.is_some());
}

#[tokio::test]
async fn test_long_view_id() {
    let reconciler = make_test_reconciler();

    let long_id = "x".repeat(10000);
    let spec = make_spec(&long_id, 1);
    reconciler.request(spec, Lane::Background).await.unwrap();
    reconciler.tick().await;

    let fiber = reconciler.get_fiber(&ViewId::new(&long_id)).await;
    assert!(fiber.is_some());
}

// ==================== Replay ====================

#[tokio::test]
async fn test_replay_success() {
    let reconciler = make_test_reconciler();

    for i in 0..5 {
        reconciler.request(make_spec(&format!("view-{}", i), 1), Lane::Background).await.unwrap();
    }

    let result = reconciler.replay().await;
    assert!(result.is_ok());
}
