# asupersync Gap Analysis — ava-fusion-runtime

> **Date**: 2026-02-20
>
> **Scope**: Audit of asupersync feature utilization in `ava-fusion-runtime`.
> Maps every asupersync feature to its current usage status and identifies
> concrete integration points for underutilized capabilities.
>
> **Reference**: [asupersync-api-surface.md](./asupersync-api-surface.md)

---

## Executive Summary

We use **~35%** of asupersync's API surface. The library is a full async
runtime (tokio-replacement), but we treat it as "just an actor framework."

| Category | Available | Used | Gap |
|----------|-----------|------|-----|
| GenServer trait methods | 8 | 7 | `cast_overflow_policy` only on 1/6 actors |
| Cx methods | 8 | 1 | Only `trace()` — 7 methods unused |
| Supervision features | 8 | 6 | Missing: monitoring, nested supervisors |
| Runtime features | 6 | 0 | spawn_blocking, channels, sync prims unused |
| Testing features | 4 | 0 | LabRuntime completely unused |

---

## Currently Using ✅

| Feature | Location | Notes |
|---------|----------|-------|
| `GenServer` trait | All 6 actors | Full trait impl with Call/Cast/Info |
| `Cx::trace()` | All actors | Structured telemetry events |
| `Cx::checkpoint()` | FusionEngine, AbsenceDetector | Progress recording + cancel check |
| `Cx::masked()` | FusionEngine (handle_info + handle_cast) | Cancel mask for entity_tracks consistency |
| `Cx::is_cancel_requested()` | DataflowWorker (via `Arc<AtomicBool>`) | Cooperative cancel propagation to worker thread |
| `Budget::INFINITE` | FusionEngine `on_start_budget` | Allows unbounded startup |
| `Budget::MINIMAL` | All actors `on_stop_budget` + ChildSpec | Tight cleanup |
| `CastOverflowPolicy::DropOldest` | SensorIngestor | Load shedding under backpressure |
| `AppSpec` | pipeline.rs | Top-level supervision tree |
| `ChildSpec` + factories | pipeline.rs | 11 child actors wired |
| `depends_on` | pipeline.rs | Tier3→Tier1+2, AlarmEval→all tiers, TrackMgr→Tier1, AbsDet→sensors |
| `SupervisionStrategy::Restart` | pipeline.rs | All children |
| `BackoffStrategy::Exponential` | pipeline.rs:150,166 | Standard + singleton configs |
| `RestartPolicy::OneForOne` | pipeline.rs:204 | Top-level |
| `NameRegistry` | pipeline.rs:199 | EntityResolver singleton |
| `NameRegistrationPolicy::Register` | pipeline.rs:252 | Collision: Fail |
| `named_gen_server_start` | pipeline.rs:243 | EntityResolver |
| NATS JetStream | nats_kv.rs, nats_object.rs | KV + Object store |

---

## NOT Using — HIGH PRIORITY ❌

### GAP-1: `std::thread::spawn` instead of `spawn_blocking`

**Location**: `dataflow/worker.rs:96`

```rust
// CURRENT — raw OS thread, no runtime integration
let handle = thread::spawn(move || {
    run_worker(cmd_rx, result_tx, join_paths);
});

// SHOULD BE — asupersync blocking pool integration
let handle = spawn_blocking(move || {
    run_worker(cmd_rx, result_tx, join_paths);
}).await;
```

**Impact**: The DataflowWorker thread:
- Has no cancel propagation from the supervisor
- Is not managed by the runtime's blocking thread pool
- Has no budget enforcement
- Won't participate in graceful shutdown protocol

**Fix complexity**: LOW — Replace `thread::spawn` with `spawn_blocking`
in `DataflowWorker::new()`. Requires restructuring to call from async
context (GenServer `on_start()` is already async).

**Complication**: `spawn_blocking` returns a Future that resolves when
the closure returns. Since the worker runs indefinitely, this Future
never resolves until shutdown. We need to store the JoinHandle properly
and coordinate with on_stop. The current pattern (store JoinHandle, join
in on_stop) maps directly to spawn_blocking's model.

---

### GAP-2: No `Cx::checkpoint()` in batch processing

**Location**: All actors' `handle_info` / `handle_cast` — none call
`checkpoint()`.

**Worst case**: `fusion_engine.rs` `handle_info(WindowFlush)`:
```rust
// CURRENT — processes all results without yielding
let results = worker.drain_results();
self.process_results(&results);  // Could be 1000+ results

// SHOULD — checkpoint between items
for result in &results {
    cx.checkpoint()?;  // Yield to scheduler, check cancel
    self.process_single_result(result);
}
```

**Impact**:
- Long result batches block the actor's scheduler slot
- No cancel check during processing — actor can't be stopped mid-batch
- Budget enforcement bypassed

**Fix complexity**: LOW — Add `cx.checkpoint()` calls in processing loops.
Requires changing return type to handle `Error::cancelled`.

---

### GAP-3: No `Cx::is_cancel_requested()` propagation to worker thread

**Location**: `dataflow/worker.rs` main loop (line 212)

```rust
// CURRENT — worker only stops on Shutdown command or channel disconnect
loop {
    match cmd_rx.try_recv() { ... }
    worker.step();
    std::thread::yield_now();
}

// SHOULD — check shared cancel flag
let cancel = Arc::new(AtomicBool::new(false));
loop {
    if cancel.load(Ordering::Acquire) { return; }
    match cmd_rx.try_recv() { ... }
    worker.step();
    std::thread::yield_now();
}
```

**Impact**: If the FusionEngine actor is cancelled by its supervisor, the
DataflowWorker thread keeps running until `on_stop` sends Shutdown. But
if `on_stop` fails or the channel is broken, the thread becomes orphaned.

**Fix complexity**: LOW — Add `Arc<AtomicBool>` shared between
FusionEngine and DataflowWorker. Set in `on_stop`, check in worker loop.

---

### GAP-4: No `cx.masked()` for critical sections — ✅ RESOLVED

**Location**: `fusion_engine.rs` `handle_info(WindowFlush)`

```rust
// BEFORE — drain + process can be interrupted by cancellation
let results = worker.drain_results();
self.process_results(&results);

// AFTER — cx.masked() wraps the critical section (synchronous)
cx.masked(|| {
    self.process_results(&results);
});
// Even if cancel is requested, entity_tracks stays consistent
```

**API Note**: The cancel mask is `cx.masked(|| { ... })` — a synchronous
closure, NOT an async `cx.with_cancel_mask()` (which does not exist).
This works perfectly with the synchronous-before-async GenServer handler
pattern where all processing happens before `Box::pin(async {})`.

**Status**: Implemented in both FusionEngine (handle_info + handle_cast)
and verified with 321 tests passing.

---

### GAP-5: Self-scheduled timer ticks — ✅ RESOLVED

**Location**: AbsenceDetector (periodic detection) via `pipeline.rs`

**Solution**: `GenServerRef::try_info()` from the ChildSpec factory closure.

The key insight: `GenServerHandle::server_ref()` returns a `Clone`-able
`GenServerRef<S>` after `spawn_gen_server`. `GenServerRef::try_info()` is
non-async and doesn't require `&Cx` — perfect for a background OS thread.

**Pattern** (in `absence_detector_child()`):
```rust
let (handle, stored) = scope.spawn_gen_server(state, cx, server, cap)?;
let server_ref = handle.server_ref();  // Cloneable, cheap

std::thread::Builder::new()
    .name("absence-ticker".into())
    .spawn(move || {
        loop {
            std::thread::sleep(interval);
            if !server_ref.is_alive() { break; }
            if server_ref.try_info(EvaluationTick { ... }).is_err() { break; }
        }
    });
```

**Lifecycle correctness**: On supervisor restart, the old GenServer stops →
`is_alive()` returns false or `try_info()` returns `Err(ServerStopped)` →
old ticker exits. The factory runs again → new server + new ticker.

**Configuration**: `PipelineConfig::eval_interval_secs` (default 5s).
Set to 0 to disable (external ticks only, for deterministic testing).

**Status**: Implemented for AbsenceDetector. FusionEngine's WindowFlush
can follow the same pattern when needed.

---

## NOT Using — MEDIUM PRIORITY ⚠️

### GAP-6: No process monitoring (MonitorRef / DownNotification)

**Impact**: FusionEngine doesn't know if its DataflowWorker thread
panics until it tries to send a command and gets a channel error. With
monitoring, it would receive an immediate DownNotification.

**Fix complexity**: MEDIUM — Requires the worker to be a monitorable
entity. If using `spawn_blocking` (GAP-1), the JoinHandle becomes
awaitable and failure is detectable.

---

### GAP-7: Missing evaluation actor dependencies

**Location**: pipeline.rs — AlarmEvaluator, TrackManager, AbsenceDetector
start independently.

```rust
// SHOULD — evaluation actors depend on fusion tiers
ChildSpec::new("alarm-evaluator", ...)
    .depends_on("fusion-tier1-hard-key")
    .depends_on("fusion-tier2-soft-key")
    .depends_on("fusion-tier3-derived")
```

**Impact**: Evaluation actors currently start before fusion engines may
be ready. While they handle empty state gracefully, proper dependency
ordering is architecturally correct.

**Fix complexity**: LOW — Add `depends_on` calls in pipeline.rs.

---

### GAP-8: `parking_lot::Mutex` instead of asupersync Mutex

**Location**: pipeline.rs:193

```rust
// CURRENT
registry: Arc<parking_lot::Mutex<asupersync::cx::NameRegistry>>

// asupersync provides its own cancel-safe Mutex
```

**Impact**: Low (startup code only). But breaks the principle of using
asupersync primitives throughout.

**Fix complexity**: LOW — depends on whether NameRegistry's Mutex
requirement is parking_lot-specific or generic.

---

### GAP-9: No LabRuntime for deterministic testing

**Impact**: HUGE missed value. Our tests use `#[test]` with raw thread
spawning. LabRuntime would provide:
- Deterministic schedule exploration (find concurrency bugs)
- Virtual time (tests run instantly, no `thread::sleep`)
- Trace replay (reproduce any failure exactly)
- TLA+ export for model checking

**Fix complexity**: HIGH — Requires test harness restructuring. Best
started as a separate spike for one actor test suite.

---

### GAP-10: No asupersync channels

**Location**: `dataflow/worker.rs` uses `crossbeam-channel`

**Assessment**: **Correctly** using crossbeam for the sync↔sync bridge.
The DataflowWorker is synchronous (timely's step loop). Async channels
would add complexity for no gain on the sync end.

**Potential**: The result channel (worker→GenServer) could use
asupersync's mpsc on the receive side, but crossbeam's `try_recv()`
is simpler and works fine for the non-blocking drain pattern.

**Verdict**: ✅ **No change needed** — crossbeam is the right choice here.

---

## NOT Using — LOW PRIORITY 📋

| Feature | Impact | Notes |
|---------|--------|-------|
| `Cx::now()` for virtual time | Low | We use wall-clock timestamps from sensors |
| `Cx::yield_now()` | Low | Worker uses `std::thread::yield_now()` (correct for OS thread) |
| Obligation tracking | Low | Channel commands don't need linear tokens |
| OpenTelemetry metrics | Low | We use `tracing` crate directly |
| Combinators (join!, race!) | Low | Not needed in GenServer pattern |
| Sync primitives (Semaphore, etc.) | Low | No multi-actor coordination patterns yet |
| Networking stack | N/A | We use NATS client (asupersync-native) |
| Database clients | N/A | No direct DB access in fusion runtime |

---

## Correctly NOT Using ✅

| Feature | Reason |
|---------|--------|
| Nested supervisors | AppSpec flat model is sufficient; documented TODO |
| asupersync channels for dataflow | crossbeam is correct for sync↔sync bridge |
| Full networking stack | NATS handles all networking |
| Database clients | State persisted via NATS JetStream KV |

---

## Priority Implementation Roadmap

### Phase 1: Quick Wins (1-2 hours)

| Gap | Fix | Impact |
|-----|-----|--------|
| GAP-2 | Add `cx.checkpoint()` in FusionEngine batch processing | Cancel correctness |
| GAP-3 | Add `Arc<AtomicBool>` cancel flag to DataflowWorker | Clean shutdown |
| GAP-4 | Wrap result drain in `cx.with_cancel_mask()` | State consistency |
| GAP-7 | Add `depends_on` for evaluation actors | Startup ordering |

### Phase 2: Structural Changes (spike/deferred)

| Gap | Fix | Impact | Status |
|-----|-----|--------|--------|
| GAP-1 | Evaluate `spawn_blocking` vs `std::thread::spawn` | Runtime integration | Evaluated — std::thread::spawn is correct (indefinite worker) |
| GAP-5 | Self-scheduled timers for AbsenceDetector | Autonomy | DEFERRED — requires GenServerHandle-to-self pattern |

### Phase 3: Testing Infrastructure (spike)

| Gap | Fix | Impact |
|-----|-----|--------|
| GAP-9 | LabRuntime deterministic tests for one actor | Concurrency safety |

---

## Metrics

| Metric | Before | After Phase 1+2 | After Phase 3 |
|--------|--------|-----------------|---------------|
| Cx methods used | 1/8 | 6/8 (`trace`, `checkpoint`, `checkpoint_with`, `masked`, `budget`, `timer_driver`) | 7/8+ |
| Cancel-correct actors | 0/6 | 2/6 (FusionEngine, AbsenceDetector) | 6/6 |
| Self-scheduling actors | 0/6 | 1/6 (AbsenceDetector) | 2/6 |
| Deterministic tests | 0 | 0 | ≥1 suite |
| asupersync API coverage | ~35% | ~55% | ~70% |
| depends_on coverage | 1 relationship | 7 relationships | 7 |

### Resolved Gaps Summary

| Gap | Resolution | Files Modified |
|-----|-----------|----------------|
| GAP-2 | `cx.checkpoint_with()` in FusionEngine + AbsenceDetector | fusion_engine.rs, absence_detector.rs |
| GAP-3 | `Arc<AtomicBool>` cancel flag in DataflowWorker | worker.rs, fusion_engine.rs |
| GAP-4 | `cx.masked()` in FusionEngine handle_info + handle_cast | fusion_engine.rs |
| GAP-5 | `GenServerRef::try_info()` ticker thread in pipeline factory | pipeline.rs, mod.rs |
| GAP-7 | `depends_on` for AlarmEvaluator, TrackManager, AbsenceDetector | pipeline.rs |

### API Corrections (from source verification)

| Documented As | Actual API | Notes |
|---------------|-----------|-------|
| `cx.now()` | `cx.timer_driver().map(\|d\| d.now())` | No `now()` method on Cx |
| `cx.sleep_until(time)` | `asupersync::time::sleep_until(Time)` | Free function, not Cx method |
| `cx.with_cancel_mask(\|cx\| async {...})` | `cx.masked(\|\| { ... })` | Synchronous closure, not async |
| `SystemMsg::Timeout` from sleep | Handler future resumes | No separate Timeout message |
