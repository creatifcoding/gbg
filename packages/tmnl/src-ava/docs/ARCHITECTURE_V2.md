# AVA v2 Architecture: Event-Driven Reactive Streams

## Executive Summary

AVA v2 pivots from a **tick-based pull model** to an **event-driven reactive streaming architecture**. Views are no longer polled — they push artifacts to subscribers when underlying data changes.

### Why v2?

| v1 (tick-based) | v2 (event-driven) |
|-----------------|-------------------|
| Consumer calls `tick()` to process work | Internal event loop processes automatically |
| `get_artifact()` returns snapshot | `subscribe_view()` returns live stream |
| Pull-based, cooperative scheduling | Push-based, reactive propagation |
| Good for batch processing | Good for real-time dashboards |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            AvaRuntime v2                                 │
│                                                                          │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     Public API                                   │   │
│   │                                                                   │   │
│   │   subscribe_view(spec) → Receiver<ViewArtifact>                  │   │
│   │   invalidate(view_id) → ()                                        │   │
│   │   unsubscribe(view_id) → ()                                       │   │
│   │                                                                   │   │
│   └───────────────────────────┬─────────────────────────────────────┘   │
│                               │                                          │
│   ┌───────────────────────────▼─────────────────────────────────────┐   │
│   │                   ReconcilerV2                                   │   │
│   │                                                                   │   │
│   │   ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐    │   │
│   │   │  ViewFiber  │───▶│ TriggerEngine│───▶│ ViewBroadcaster │    │   │
│   │   │  (state)    │    │ (reactivity) │    │ (distribution)  │    │   │
│   │   └─────────────┘    └─────────────┘    └─────────────────┘    │   │
│   │         │                   │                    │              │   │
│   │         │                   │                    │              │   │
│   │         ▼                   ▼                    ▼              │   │
│   │   ┌─────────────────────────────────────────────────────────┐  │   │
│   │   │              Internal Event Loop (tokio::spawn)          │  │   │
│   │   │                                                           │  │   │
│   │   │   select! {                                               │  │   │
│   │   │       trigger = trigger_rx.recv() => handle_trigger(),    │  │   │
│   │   │       cmd = command_rx.recv() => handle_command(),        │  │   │
│   │   │   }                                                       │  │   │
│   │   │                                                           │  │   │
│   │   └─────────────────────────────────────────────────────────┘  │   │
│   │                                                                   │   │
│   └───────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. ViewBroadcaster

Multi-consumer artifact distribution via `tokio::sync::broadcast`.

```rust
pub struct ViewBroadcaster {
    /// Channel sender (held by runtime)
    tx: broadcast::Sender<ViewArtifact>,

    /// Configuration
    config: BroadcasterConfig,
}

pub struct BroadcasterConfig {
    /// Channel buffer size (default: 16)
    pub buffer_size: usize,

    /// Strategy when receiver lags behind
    pub lag_strategy: LagStrategy,
}

pub enum LagStrategy {
    /// Drop oldest messages (default)
    DropOldest,
    /// Error on lag (strict)
    ErrorOnLag,
}

impl ViewBroadcaster {
    /// Create a new broadcaster for a view
    pub fn new(config: BroadcasterConfig) -> Self;

    /// Subscribe to artifact updates
    pub fn subscribe(&self) -> broadcast::Receiver<ViewArtifact>;

    /// Broadcast new artifact to all subscribers
    pub fn broadcast(&self, artifact: ViewArtifact) -> Result<usize, BroadcastError>;

    /// Number of active subscribers
    pub fn subscriber_count(&self) -> usize;
}
```

**Design Rationale:**
- `broadcast` channel allows multiple consumers (dashboards, caches, loggers)
- Buffer prevents slow consumers from blocking fast producers
- `LagStrategy` handles backpressure gracefully

---

### 2. TriggerEngine

Event-driven reactivity with multiple trigger modes.

```rust
pub struct TriggerEngine {
    /// Pending triggers to process
    trigger_tx: mpsc::Sender<Trigger>,
    trigger_rx: mpsc::Receiver<Trigger>,

    /// Active timers for refresh_ms
    timers: HashMap<ViewId, JoinHandle<()>>,

    /// Source change watchers
    watchers: HashMap<SourceId, SourceWatcher>,
}

pub enum Trigger {
    /// Source data changed (detected by watcher)
    SourceChanged {
        source_id: SourceId,
        affected_views: Vec<ViewId>,
    },

    /// Explicit invalidation request
    Invalidate {
        view_id: ViewId,
    },

    /// Timer fired (refresh_ms elapsed)
    TimerFired {
        view_id: ViewId,
    },
}

impl TriggerEngine {
    /// Register a view for trigger monitoring
    pub fn register(&mut self, view_id: ViewId, spec: &ViewProfileSpec);

    /// Unregister a view
    pub fn unregister(&mut self, view_id: &ViewId);

    /// Manually trigger invalidation
    pub fn invalidate(&self, view_id: ViewId);

    /// Receive next trigger (async)
    pub async fn next_trigger(&mut self) -> Option<Trigger>;
}
```

**Trigger Modes:**

| Mode | Source | Use Case |
|------|--------|----------|
| Source Change | `SourceWatcher` detects mutations | Real-time data feeds |
| Invalidate | `invalidate()` API call | Manual refresh, cache bust |
| Timer | `tokio::time::interval` | Polling-based sources |

**Source Change Detection:**

```rust
pub trait SourceWatcher: Send + Sync {
    /// Watch a source for changes
    fn watch(&self, source: &SourceSpec) -> WatchHandle;

    /// Check if source has changed since last query
    fn has_changed(&self, source: &SourceSpec) -> bool;
}

// Implementations per source kind
pub struct MemorySourceWatcher;   // Version counter
pub struct SqliteSourceWatcher;  // Last modified timestamp
pub struct StreamSourceWatcher;  // Message sequence number
```

---

### 3. ReconcilerV2

Replaces tick-based reconciler with event-driven core.

```rust
pub struct ReconcilerV2 {
    /// Active view fibers
    fibers: Arc<RwLock<HashMap<ViewId, ViewFiberV2>>>,

    /// Per-view broadcasters
    broadcasters: Arc<RwLock<HashMap<ViewId, ViewBroadcaster>>>,

    /// Trigger engine
    triggers: Arc<Mutex<TriggerEngine>>,

    /// Event log (unchanged from v1)
    event_log: Arc<EventLog>,

    /// Internal loop handle
    loop_handle: Option<JoinHandle<()>>,

    /// Command channel for external control
    command_tx: mpsc::Sender<Command>,
}

pub enum Command {
    Subscribe { spec: ViewProfileSpec, response: oneshot::Sender<Receiver<ViewArtifact>> },
    Invalidate { view_id: ViewId },
    Unsubscribe { view_id: ViewId },
    Shutdown,
}

impl ReconcilerV2 {
    /// Create and start the reconciler
    pub fn new() -> Self;

    /// Subscribe to a view (creates if not exists)
    pub async fn subscribe(&self, spec: ViewProfileSpec) -> Receiver<ViewArtifact>;

    /// Invalidate a view (triggers recomputation)
    pub async fn invalidate(&self, view_id: &ViewId);

    /// Unsubscribe from a view (cleanup if no subscribers)
    pub async fn unsubscribe(&self, view_id: &ViewId);

    /// Graceful shutdown
    pub async fn shutdown(&self);
}
```

**Internal Event Loop:**

```rust
async fn event_loop(
    fibers: Arc<RwLock<HashMap<ViewId, ViewFiberV2>>>,
    broadcasters: Arc<RwLock<HashMap<ViewId, ViewBroadcaster>>>,
    mut triggers: TriggerEngine,
    mut commands: mpsc::Receiver<Command>,
    compiler: ViewCompiler,
) {
    loop {
        tokio::select! {
            // Handle triggers (source changes, timers, invalidations)
            Some(trigger) = triggers.next_trigger() => {
                match trigger {
                    Trigger::SourceChanged { affected_views, .. } => {
                        for view_id in affected_views {
                            recompute_and_broadcast(&view_id, &fibers, &broadcasters, &compiler).await;
                        }
                    }
                    Trigger::Invalidate { view_id } => {
                        recompute_and_broadcast(&view_id, &fibers, &broadcasters, &compiler).await;
                    }
                    Trigger::TimerFired { view_id } => {
                        recompute_and_broadcast(&view_id, &fibers, &broadcasters, &compiler).await;
                    }
                }
            }

            // Handle commands (subscribe, unsubscribe, shutdown)
            Some(cmd) = commands.recv() => {
                match cmd {
                    Command::Subscribe { spec, response } => {
                        let rx = handle_subscribe(spec, &fibers, &broadcasters, &mut triggers).await;
                        let _ = response.send(rx);
                    }
                    Command::Invalidate { view_id } => {
                        triggers.invalidate(view_id);
                    }
                    Command::Unsubscribe { view_id } => {
                        handle_unsubscribe(&view_id, &fibers, &broadcasters, &mut triggers).await;
                    }
                    Command::Shutdown => break,
                }
            }
        }
    }
}

async fn recompute_and_broadcast(
    view_id: &ViewId,
    fibers: &Arc<RwLock<HashMap<ViewId, ViewFiberV2>>>,
    broadcasters: &Arc<RwLock<HashMap<ViewId, ViewBroadcaster>>>,
    compiler: &ViewCompiler,
) {
    let fibers = fibers.read().await;
    let fiber = match fibers.get(view_id) {
        Some(f) => f,
        None => return,
    };

    // Compile and execute
    let artifact = match compile_and_execute(fiber, compiler).await {
        Ok(a) => a,
        Err(e) => {
            // Log error, maybe broadcast error artifact
            return;
        }
    };

    // Broadcast to all subscribers
    let broadcasters = broadcasters.read().await;
    if let Some(broadcaster) = broadcasters.get(view_id) {
        let _ = broadcaster.broadcast(artifact);
    }
}
```

---

### 4. ViewFiberV2

Simplified fiber for v2 (no state machine needed for basic flow).

```rust
pub struct ViewFiberV2 {
    /// View identifier
    pub view_id: ViewId,

    /// Current spec
    pub spec: ViewProfileSpec,

    /// Last computed artifact (cache)
    pub last_artifact: Option<ViewArtifact>,

    /// Computation stats
    pub stats: FiberStats,
}

pub struct FiberStats {
    /// Number of recomputations
    pub recompute_count: u64,

    /// Last recompute timestamp
    pub last_recompute_ms: f64,

    /// Average recompute duration
    pub avg_recompute_duration_ms: f64,
}
```

**Why no state machine?**

In v1, the state machine tracked: `Pending → Compiled → Mounted → Unmounting`.
In v2, views are always "live" while subscribed. The lifecycle is simpler:
- Subscribe → fiber created, initial artifact computed, streaming begins
- Trigger → recompute, broadcast
- Unsubscribe → fiber removed (if no other subscribers)

---

## API Changes

### AvaRuntime v2

```rust
impl AvaRuntimeV2 {
    // ========== NEW API ==========

    /// Subscribe to a view, returns live artifact stream
    pub async fn subscribe_view(
        &self,
        spec: ViewProfileSpec,
    ) -> broadcast::Receiver<ViewArtifact>;

    /// Manually invalidate a view (triggers recomputation)
    pub async fn invalidate(&self, view_id: &ViewId);

    /// Unsubscribe from a view
    pub async fn unsubscribe(&self, view_id: &ViewId);

    /// Graceful shutdown
    pub async fn shutdown(&self);

    // ========== REMOVED ==========
    // tick() - replaced by internal event loop
    // tick_all() - replaced by internal event loop
    // get_artifact() - replaced by subscribe_view() stream

    // ========== UNCHANGED ==========
    // register_spec(), get_spec(), list_specs()
    // event_log(), events()
    // adapters(), session()
}
```

### Consumer Usage

```rust
// v1 (DEPRECATED)
let view_id = runtime.request_view(spec, None).await?;
loop {
    runtime.tick().await?;
    if let Some(artifact) = runtime.get_artifact(&view_id).await? {
        process(artifact);
        break;
    }
}

// v2 (NEW)
let mut rx = runtime.subscribe_view(spec).await;
while let Ok(artifact) = rx.recv().await {
    process(artifact);
    // Stream continues until unsubscribe or shutdown
}
```

---

## Configuration

```rust
pub struct RuntimeConfigV2 {
    /// Default broadcaster buffer size
    pub default_buffer_size: usize,

    /// Default lag strategy
    pub default_lag_strategy: LagStrategy,

    /// Enable event log (for debugging/replay)
    pub enable_event_log: bool,

    /// Compaction threshold
    pub compaction_threshold: usize,
}

impl Default for RuntimeConfigV2 {
    fn default() -> Self {
        Self {
            default_buffer_size: 16,
            default_lag_strategy: LagStrategy::DropOldest,
            enable_event_log: true,
            compaction_threshold: 1000,
        }
    }
}
```

---

## Migration Path

### Phase 1: Deprecate v1
- Move current `ava-reconciler` to `ava-reconciler::v1` module
- Keep all existing functionality intact
- Add deprecation warnings

### Phase 2: Implement v2 Core
- `ViewBroadcaster` (I42)
- `TriggerEngine` (I43)
- `ReconcilerV2` (I44)

### Phase 3: Integrate
- Update `ava-runtime` to use v2 (I45)
- Migrate tests to streaming model
- Update WASM bindings

### Phase 4: Cleanup (future)
- Remove v1 after validation period
- Optimize hot paths
- Add metrics/tracing

---

## Testing Strategy

### Unit Tests

```rust
#[tokio::test]
async fn test_subscribe_receives_initial_artifact() {
    let runtime = AvaRuntimeV2::new(RuntimeConfigV2::default());
    let spec = make_spec("view-1", 1);

    let mut rx = runtime.subscribe_view(spec).await;

    // Should receive initial artifact immediately
    let artifact = tokio::time::timeout(
        Duration::from_secs(1),
        rx.recv()
    ).await.unwrap().unwrap();

    assert_eq!(artifact.view_id, ViewId::new("view-1"));
}

#[tokio::test]
async fn test_invalidate_triggers_recomputation() {
    let runtime = AvaRuntimeV2::new(RuntimeConfigV2::default());
    let spec = make_spec("view-1", 1);
    let view_id = ViewId::new("view-1");

    let mut rx = runtime.subscribe_view(spec).await;

    // Receive initial
    let _ = rx.recv().await.unwrap();

    // Invalidate
    runtime.invalidate(&view_id).await;

    // Should receive new artifact
    let artifact = tokio::time::timeout(
        Duration::from_secs(1),
        rx.recv()
    ).await.unwrap().unwrap();

    assert_eq!(artifact.view_id, view_id);
}

#[tokio::test]
async fn test_multiple_subscribers_receive_same_artifact() {
    let runtime = AvaRuntimeV2::new(RuntimeConfigV2::default());
    let spec = make_spec("view-1", 1);

    let mut rx1 = runtime.subscribe_view(spec.clone()).await;
    let mut rx2 = runtime.subscribe_view(spec).await;

    // Invalidate to trigger broadcast
    runtime.invalidate(&ViewId::new("view-1")).await;

    let a1 = rx1.recv().await.unwrap();
    let a2 = rx2.recv().await.unwrap();

    assert_eq!(a1.view_id, a2.view_id);
}
```

### Integration Tests

```rust
#[tokio::test]
async fn test_timer_based_refresh() {
    let runtime = AvaRuntimeV2::new(RuntimeConfigV2::default());

    // Spec with 100ms refresh
    let mut spec = make_spec("view-1", 1);
    spec.channels[0].refresh_ms = Some(100);

    let mut rx = runtime.subscribe_view(spec).await;

    // Receive initial
    let _ = rx.recv().await.unwrap();

    // Wait for timer-triggered refresh
    let artifact = tokio::time::timeout(
        Duration::from_millis(200),
        rx.recv()
    ).await.unwrap().unwrap();

    assert_eq!(artifact.view_id, ViewId::new("view-1"));
}
```

---

## Open Questions

1. **Backpressure**: What happens when a consumer can't keep up? Current design drops oldest messages. Is this acceptable for all use cases?

2. **Error Propagation**: How should compilation/execution errors be communicated to subscribers? Separate error channel? Error variant in artifact?

3. **Lifecycle Events**: Should subscribers receive lifecycle events (subscribed, unsubscribed, error) in addition to artifacts?

4. **Metrics**: What metrics should be exposed? Subscriber count, broadcast rate, lag count?

---

## References

- [tokio::sync::broadcast](https://docs.rs/tokio/latest/tokio/sync/broadcast/index.html)
- [Reactive Streams Specification](https://www.reactive-streams.org/)
- [Arroyo Streaming Patterns](./ARROYO_PATTERNS_FOR_AVA.md)
