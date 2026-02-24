# asupersync Integration Patterns — Code Reference

> **Date**: 2026-02-20
>
> **Purpose**: Concrete code patterns for each gap identified in
> [asupersync-gap-analysis.md](./asupersync-gap-analysis.md).
> Each pattern shows BEFORE (current) and AFTER (target) with exact
> file locations and line numbers.
>
> **Reference**: [asupersync-api-surface.md](./asupersync-api-surface.md)

---

## Pattern 1: spawn_blocking for DataflowWorker

### Target File: `dataflow/worker.rs`

**BEFORE** (line 86-105):
```rust
pub struct DataflowWorker {
    cmd_tx: Sender<DataflowCommand>,
    result_rx: Receiver<FusionResult>,
    thread: Option<thread::JoinHandle<()>>,
}

impl DataflowWorker {
    pub fn new(join_paths: Vec<JoinPathEntryV2>) -> Self {
        let (cmd_tx, cmd_rx) = bounded::<DataflowCommand>(4096);
        let (result_tx, result_rx) = unbounded::<FusionResult>();

        let handle = thread::spawn(move || {
            run_worker(cmd_rx, result_tx, join_paths);
        });

        Self { cmd_tx, result_rx, thread: Some(handle) }
    }
}
```

**AFTER**:
```rust
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

pub struct DataflowWorker {
    cmd_tx: Sender<DataflowCommand>,
    result_rx: Receiver<FusionResult>,
    thread: Option<thread::JoinHandle<()>>,
    /// Cooperative cancellation flag — set by the actor's on_stop().
    cancel_flag: Arc<AtomicBool>,
}

impl DataflowWorker {
    pub fn new(join_paths: Vec<JoinPathEntryV2>) -> Self {
        let (cmd_tx, cmd_rx) = bounded::<DataflowCommand>(4096);
        let (result_tx, result_rx) = unbounded::<FusionResult>();
        let cancel_flag = Arc::new(AtomicBool::new(false));
        let worker_cancel = cancel_flag.clone();

        // NOTE: Using std::thread::spawn rather than spawn_blocking
        // because the timely worker runs an indefinite event loop.
        // spawn_blocking is designed for bounded blocking work; this
        // is an unbounded co-process. The cancel_flag provides the
        // cooperative shutdown that spawn_blocking would give us.
        let handle = thread::spawn(move || {
            run_worker(cmd_rx, result_tx, join_paths, worker_cancel);
        });

        Self { cmd_tx, result_rx, thread: Some(handle), cancel_flag }
    }

    /// Signal the worker thread to stop cooperatively.
    pub fn request_cancel(&self) {
        self.cancel_flag.store(true, Ordering::Release);
    }
}
```

**Why not `spawn_blocking`**: The timely dataflow worker runs an indefinite
`execute_directly` loop. `spawn_blocking` returns a Future that resolves
when the closure completes — but ours never completes until shutdown. This
would block the GenServer's `on_start` forever. The correct pattern is
`std::thread::spawn` with an explicit cancel flag. This is the same pattern
deepwiki shows for GenServer + OS thread integration.

---

## Pattern 2: Cancel-Aware Worker Loop

### Target File: `dataflow/worker.rs`

**BEFORE** (line 212-306):
```rust
fn run_worker(
    cmd_rx: Receiver<DataflowCommand>,
    result_tx: Sender<FusionResult>,
    join_paths: Vec<JoinPathEntryV2>,
) {
    // ...
    loop {
        loop {
            match cmd_rx.try_recv() {
                // ... process commands
                Ok(DataflowCommand::Shutdown) => return,
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => return,
            }
        }
        worker.step();
        std::thread::yield_now();
    }
}
```

**AFTER**:
```rust
fn run_worker(
    cmd_rx: Receiver<DataflowCommand>,
    result_tx: Sender<FusionResult>,
    join_paths: Vec<JoinPathEntryV2>,
    cancel_flag: Arc<AtomicBool>,
) {
    // ...
    loop {
        // Check cooperative cancel flag FIRST (from supervisor shutdown).
        if cancel_flag.load(Ordering::Acquire) {
            tracing::info!("Worker received cancel signal");
            return;
        }

        loop {
            match cmd_rx.try_recv() {
                // ... process commands (unchanged)
                Ok(DataflowCommand::Shutdown) => return,
                Err(TryRecvError::Empty) => break,
                Err(TryRecvError::Disconnected) => return,
            }
        }
        worker.step();
        std::thread::yield_now();
    }
}
```

**Benefit**: Worker exits promptly on supervisor-initiated cancellation,
even if the Shutdown command hasn't been sent yet. Belt + suspenders.

---

## Pattern 3: checkpoint() in Batch Processing — ✅ IMPLEMENTED

### Target File: `actors/fusion_engine.rs`, `actors/absence_detector.rs`

**CRITICAL LIFETIME CONSTRAINT**: GenServer trait's `Pin<Box<dyn Future + '_>>`
binds `'_` to `&mut self`, NOT `&Cx`. Capturing both `self` AND `cx` in the
async block triggers a lifetime mismatch. Solution: all synchronous processing
(including `cx.checkpoint()`) happens BEFORE `Box::pin(async {})`.

**BEFORE** (handle_info WindowFlush):
```rust
fn handle_info(&mut self, cx: &Cx, msg: Self::Info)
    -> Pin<Box<dyn Future<Output = ()> + Send + '_>>
{
    cx.trace("fusion_engine::handle_info");
    Box::pin(async move {
        // ❌ CANNOT use cx here — lifetime conflict
        // cx.checkpoint() would fail to compile
    })
}
```

**AFTER** — Synchronous-before-async pattern:
```rust
fn handle_info(&mut self, cx: &Cx, msg: Self::Info)
    -> Pin<Box<dyn Future<Output = ()> + Send + '_>>
{
    cx.trace("fusion_engine::handle_info");

    // ✅ All processing synchronous — cx and self both available
    match msg {
        FusionInfo::WindowFlush { window_id: _ } => {
            self.current_window += 1;
            let results = self.worker.as_ref().map(|worker| {
                let _ = worker.send(DataflowCommand::AdvanceTime(self.current_window));
                worker.drain_results()
            });
            if let Some(results) = results {
                let count = results.len();
                cx.masked(|| {
                    self.process_results(&results);
                });
                if count > 0 {
                    let _ = cx.checkpoint();  // Records progress, checks cancel
                }
            }
        }
        FusionInfo::System(_) => {}
    }

    Box::pin(async {})  // Empty future — all work done synchronously
}
```

**AbsenceDetector** — Same pattern with early return on cancel:
```rust
fn handle_info(&mut self, cx: &Cx, msg: Self::Info)
    -> Pin<Box<dyn Future<Output = ()> + Send + '_>>
{
    cx.trace("absence_detector::handle_info");

    match msg {
        AbsenceInfo::EvaluationTick { tick_id: _, current_time_ms } => {
            self.total_ticks += 1;
            if cx.checkpoint().is_err() {
                return Box::pin(async {});  // Cancelled by supervisor
            }
            let newly_absent = self.evaluate(current_time_ms);
            // ... process absences ...
        }
        AbsenceInfo::System(_) => {}
    }

    Box::pin(async {})
}
```

**Key insight**: `cx.checkpoint()` is **synchronous** — it checks the cancel
flag and records a progress event. It does NOT yield to the scheduler.
This means it works perfectly in the synchronous portion of the handler.

---

## Pattern 4: Cancel Mask for Critical Sections — ✅ IMPLEMENTED

### Target File: `actors/fusion_engine.rs`

**API**: `cx.masked(|| { ... })` — Synchronous cancel mask.
`pub fn masked<F, R>(&self, f: F) -> R where F: FnOnce() -> R`

There is NO `cx.with_cancel_mask()` async variant. The cancel mask is
synchronous-only, which aligns perfectly with the synchronous-before-async
handler pattern.

**AFTER** (handle_info WindowFlush — combined with checkpoint):
```rust
// Cancel-mask the entity_tracks update.
// Even if cancel is requested, the closure runs to completion.
cx.masked(|| {
    self.process_results(&results);
});
// Cancellation fires AFTER the mask drops.

// Record progress (outside mask — can detect cancel).
if count > 0 {
    let _ = cx.checkpoint();
}
```

**AFTER** (handle_cast TrackEvent — cancel-masked mutations):
```rust
FusionCast::TrackEvent { track_id, event } => {
    cx.masked(|| {
        match event {
            TrackEventKind::Dropped => {
                for tracks in self.entity_tracks.values_mut() {
                    tracks.retain(|t| *t != track_id);
                }
            }
            TrackEventKind::Merged { surviving_track } => {
                // ... merge logic ...
            }
            TrackEventKind::Confirmed => {}
        }
    });
}
```

**Interaction with checkpoint()**: Inside a cancel mask, `checkpoint()`
returns `Ok(())` even if cancel was requested — the mask defers cancellation.
Checkpoint still records progress for observability.

---

## Pattern 5: Self-Scheduled Timer — ✅ IMPLEMENTED

### Target File: `pipeline.rs` (ChildSpec factory, not the actor itself)

**Key discovery**: The ChildSpec factory closure has access to `GenServerHandle`
after `spawn_gen_server()`. `GenServerHandle::server_ref()` returns a `Clone`-able
`GenServerRef<S>` with `try_info()` — non-async, no `&Cx` required.

This sidesteps all the `sleep_until` / `on_start` / self-handle problems:

```rust
fn absence_detector_child(name: &str, cap: usize, interval_secs: u64) -> ChildSpec {
    ChildSpec::new("absence-detector", move |scope, state, cx| {
        let server = AbsenceDetector::new(name.clone());
        let (handle, stored) = scope.spawn_gen_server(state, cx, server, cap)?;
        let task_id = handle.task_id();
        let server_ref = handle.server_ref();  // Clone-able ref
        state.store_spawned_task(task_id, stored);

        if interval_secs > 0 {
            let interval = Duration::from_secs(interval_secs);
            std::thread::Builder::new()
                .name("absence-ticker".into())
                .spawn(move || {
                    let mut tick_id = 0u64;
                    loop {
                        std::thread::sleep(interval);
                        if !server_ref.is_alive() { break; }
                        tick_id += 1;
                        let now_ms = /* wall-clock ms */;
                        if server_ref.try_info(AbsenceInfo::EvaluationTick {
                            tick_id, current_time_ms: now_ms,
                        }).is_err() { break; }
                    }
                });
        }
        Ok(task_id)
    })
}
```

**Lifecycle**: On supervisor restart, old server stops → `is_alive()` returns
false → old ticker exits. Factory re-runs → new server + new ticker.

**Configuration**: `PipelineConfig::eval_interval_secs` (default 5s, 0 = disable).

**Virtual time note**: The ticker uses wall-clock `std::thread::sleep()`.
Under LabRuntime, tests send `EvaluationTick` manually (set interval to 0).
The handler's `cx.timer_driver().map(|d| d.now())` fallback ensures virtual
time is used for deadline comparison when available.

---

## Pattern 6: Evaluation Actor Dependencies

### Target File: `pipeline.rs`

**BEFORE** (lines 230-233):
```rust
app = app
    .child(alarm_evaluator_child(&config.alarm_evaluator_name, mailbox_cap))
    .child(track_manager_child(&config.track_manager_name, mailbox_cap))
    .child(absence_detector_child(&config.absence_detector_name, mailbox_cap));
```

**AFTER**:
```rust
// Evaluation actors depend on all fusion tiers being ready.
app = app
    .child(
        alarm_evaluator_child(&config.alarm_evaluator_name, mailbox_cap)
            .depends_on("fusion-tier1-hard-key")
            .depends_on("fusion-tier2-soft-key")
            .depends_on("fusion-tier3-derived")
    )
    .child(
        track_manager_child(&config.track_manager_name, mailbox_cap)
            .depends_on("fusion-tier1-hard-key")
    )
    .child(
        absence_detector_child(&config.absence_detector_name, mailbox_cap)
            // AbsenceDetector monitors sensor sources, not fusion output.
            // Depends on sensors being started.
            .depends_on("sensor-adsb-feed")
            .depends_on("sensor-ais-feed")
    );
```

**Note**: `depends_on` requires that the child spec functions return
`ChildSpec` (not `app = app.child(...)`) so we can chain. The current
helper functions already return `ChildSpec`.

---

## Pattern 7: on_stop with Cancel Flag

### Target File: `actors/fusion_engine.rs`

**BEFORE** (lines 392-413):
```rust
fn on_stop(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
    cx.trace("fusion_engine::stopped");
    Box::pin(async move {
        if let Some(mut worker) = self.worker.take() {
            worker.shutdown();
            tracing::info!(name = %self.name, "DataflowWorker thread joined");
        }
        // ...
    })
}
```

**AFTER**:
```rust
fn on_stop(&mut self, cx: &Cx) -> Pin<Box<dyn Future<Output = ()> + Send + '_>> {
    cx.trace("fusion_engine::stopped");
    Box::pin(async move {
        if let Some(mut worker) = self.worker.take() {
            // 1. Signal cooperative cancel (belt).
            worker.request_cancel();
            // 2. Send Shutdown command (suspenders).
            worker.shutdown();
            tracing::info!(name = %self.name, "DataflowWorker thread joined");
        }
        // ...
    })
}
```

**Two signals, one outcome**: The cancel flag causes the worker loop to
exit on its next iteration. The Shutdown command provides a fallback via
the channel. Whichever arrives first terminates the worker.

---

## Pattern 8: LabRuntime Deterministic Test

### Target File: NEW `tests/lab_fusion_engine.rs` (or in-module)

```rust
#[cfg(test)]
mod lab_tests {
    use asupersync::lab::LabRuntime;

    #[test]
    fn fusion_engine_deterministic_schedule() {
        let lab = LabRuntime::new(42);  // Seed for reproducibility

        lab.run(async {
            // Build a minimal pipeline with one FusionEngine.
            let config = PipelineConfig {
                sensors: vec![/* one ADS-B source */],
                fusion_tiers: vec![/* one Tier1 */],
                ..Default::default()
            };

            // Start the pipeline under lab runtime.
            let registry = create_lab_registry();
            let app = build_pipeline(config, registry);
            let mut state = RuntimeState::new();
            let cx = Cx::for_request();
            app.start(&mut state, &cx, root_region)?;

            // Send a batch of readings.
            for i in 0..100 {
                sensor_ref.cast(IngestorInfo::NatsMessage {
                    subject: "adsb".into(),
                    payload: make_payload(i),
                    timestamp_ms: i as f64 * 1000.0,
                });
            }

            // Advance time (virtual — instant).
            cx.sleep_until(cx.now() + Duration::from_secs(60)).await;

            // Verify deterministic output.
            let state = fusion_ref.call(FusionCall::ListActiveJoinPaths).await;
            assert_eq!(state, expected_state);
        });
    }

    #[test]
    fn schedule_exploration_finds_no_bugs() {
        use asupersync::lab::ScheduleExplorer;

        let explorer = ScheduleExplorer::new()
            .max_schedules(1000)
            .invariant(|state| {
                // entity_tracks should never have duplicate track IDs
                for tracks in state.entity_tracks.values() {
                    let unique: HashSet<_> = tracks.iter().collect();
                    assert_eq!(unique.len(), tracks.len());
                }
            });

        explorer.run(|seed| {
            let lab = LabRuntime::new(seed);
            lab.run(async {
                // Same pipeline setup as above
                // Explorer varies scheduling order to find races
            });
        });
    }
}
```

**Value**: Turns concurrency bugs into deterministic, reproducible test
failures. The schedule explorer systematically varies task interleavings
using DPOR (Dynamic Partial Order Reduction).

---

## Implementation Order

| Phase | Patterns | Files Modified | Status |
|-------|----------|---------------|--------|
| 1a | P2 (cancel flag) + P7 (on_stop) | worker.rs, fusion_engine.rs | ✅ DONE |
| 1b | P3 (checkpoint) | fusion_engine.rs, absence_detector.rs | ✅ DONE |
| 1c | P4 (cancel mask) | fusion_engine.rs | ✅ DONE |
| 1d | P6 (depends_on) | pipeline.rs | ✅ DONE |
| 2a | P1 (spawn_blocking eval) | worker.rs | ✅ EVALUATED — std::thread correct |
| 2b | P5 (self-scheduled timer) | pipeline.rs, mod.rs | ✅ DONE — GenServerRef::try_info() ticker |
| 3 | P8 (LabRuntime tests) | new test file | PENDING — spike |

### Key Pattern Discovery: Synchronous-Before-Async GenServer Handlers

All handler logic that uses Cx methods (`checkpoint`, `masked`, `trace`) must
execute **synchronously BEFORE** `Box::pin(async {})`. The GenServer trait's
lifetime constraint `Pin<Box<dyn Future + '_>>` binds `'_` to `&mut self`,
NOT `&Cx`. Capturing both in an async block triggers a compiler error:

```
error: method was supposed to return data with lifetime `'2`
       but it is returning data with lifetime `'1`
```

This pattern was verified against asupersync's own test implementations, which
use `_cx` (unused) in async blocks. The correct approach for actors whose
handler logic is entirely synchronous:

```rust
fn handle_info(&mut self, cx: &Cx, msg: Self::Info)
    -> Pin<Box<dyn Future<Output = ()> + Send + '_>>
{
    cx.trace("my_actor::handle_info");
    // ALL synchronous processing here — cx and self both available
    cx.masked(|| { self.update_state(); });
    let _ = cx.checkpoint();
    Box::pin(async {})  // Empty future
}
```
