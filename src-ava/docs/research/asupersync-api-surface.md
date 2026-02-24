# asupersync API Surface Reference

> **Source**: [Dicklesworthstone/asupersync](https://github.com/Dicklesworthstone/asupersync) v0.2.5
>
> **Purpose**: Complete inventory of asupersync's public API surface for the
> Tsingou fusion pipeline (`ava-fusion-runtime`). Used as the ground-truth
> reference for gap analysis and maximization audits.
>
> **Updated**: 2026-02-20

---

## 1. Runtime & Executor

asupersync provides a **full tokio-replacement async runtime** — not just an
actor system. It has its own executor, I/O reactor, scheduler, and
concurrency primitives.

### RuntimeBuilder

```rust
use asupersync::runtime::RuntimeBuilder;

// Multi-threaded (default — work-stealing scheduler)
let rt = RuntimeBuilder::new()
    .worker_threads(4)
    .blocking_threads(1, 8)  // min, max blocking pool threads
    .build()?;

// Single-threaded (for deterministic testing)
let rt = RuntimeBuilder::current_thread().build()?;

// Run to completion
rt.block_on(async { /* ... */ });
```

### Task Spawning

```rust
// Async task on the executor
let join: JoinHandle<u32> = handle.spawn(async { compute().await });

// Blocking task on dedicated pool thread
let result = spawn_blocking(move || {
    heavy_computation()  // runs off-executor
}).await;
```

### Three-Lane Priority Scheduler

| Lane | Priority | Selection | Use Case |
|------|----------|-----------|----------|
| **Cancel** | Highest | FIFO | Cancellation propagation |
| **Timed** | Medium | EDF (Earliest Deadline First) | Timers, sleeps, deadlines |
| **Ready** | Lowest | Work-stealing | Normal computation |

- **Bounded fairness**: Continuously-enabled tasks selected within bounded dispatches
- **Cooperative preemption**: Tasks yield at checkpoints
- **Poll budget**: Configurable per-task computational quota

### I/O Reactor

- **epoll** (Linux default)
- **io_uring** (Linux, behind `io-uring` feature flag)
- **kqueue** (macOS/BSD)
- Connections registered with oneshot waker semantics
- **VirtualTcp** for deterministic in-memory testing

---

## 2. SPORK Actor System

### GenServer Trait

```rust
trait GenServer: Send + 'static {
    type Call: Send + 'static;   // Synchronous request-response
    type Reply: Send + 'static;  // Reply to Call
    type Cast: Send + 'static;   // Fire-and-forget
    type Info: Send + 'static;   // System + out-of-band

    fn handle_call(&mut self, cx: &Cx, request: Self::Call, reply: Reply<Self::Reply>)
        -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;

    fn handle_cast(&mut self, cx: &Cx, msg: Self::Cast)
        -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;

    fn handle_info(&mut self, cx: &Cx, msg: Self::Info)
        -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;

    fn on_start(&mut self, cx: &Cx)
        -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;

    fn on_stop(&mut self, cx: &Cx)
        -> Pin<Box<dyn Future<Output = ()> + Send + '_>>;

    fn on_start_budget(&self) -> Budget { Budget::INFINITE }
    fn on_stop_budget(&self) -> Budget { Budget::MINIMAL }

    fn cast_overflow_policy(&self) -> CastOverflowPolicy {
        CastOverflowPolicy::Reject  // default
    }
}
```

### Mailbox

- **Bounded MPSC**: Default capacity 64 messages
- **Two-phase send**: `reserve()` slot → `send()` message (cancel-safe)
- **CastOverflowPolicy**: `Reject` (default) | `DropOldest`

### Reply Obligation

`Reply<T>` is a linear token — must be consumed via `reply.send(value)`.
Dropping without sending is a detectable obligation leak in lab mode.

---

## 3. Supervision

### Strategies

| Strategy | Behavior |
|----------|----------|
| `SupervisionStrategy::Stop` | Terminate child permanently |
| `SupervisionStrategy::Restart(config)` | Restart with rate limiting |
| `SupervisionStrategy::Escalate` | Propagate to parent supervisor |

### Restart Policies

| Policy | Effect |
|--------|--------|
| `RestartPolicy::OneForOne` | Only failed child restarts |
| `RestartPolicy::OneForAll` | All children restart |
| `RestartPolicy::RestForOne` | Failed + all children started after it restart |

### RestartConfig

```rust
RestartConfig {
    max_restarts: 3,              // Max restarts in window
    window: Duration::from_secs(60),
    backoff: BackoffStrategy::Exponential {
        initial: Duration::from_millis(100),
        max: Duration::from_secs(10),
        multiplier: 2.0,
    },
    restart_cost: 0,
    min_remaining_for_restart: None,
    min_polls_for_restart: 0,
}
```

### ChildSpec

```rust
ChildSpec::new("child-name", start_factory)
    .with_restart(SupervisionStrategy::Restart(config))
    .with_shutdown_budget(Budget::MINIMAL)
    .depends_on("other-child")  // startup ordering
    .with_registration(NameRegistrationPolicy::Register {
        name: "service-name".into(),
        collision: NameCollisionPolicy::Fail,
    })
```

**`depends_on`**: Topological sort at `compile()` time ensures dependency
ordering. Child B won't start until Child A is ready.

---

## 4. Cx — Capability Token

All effects flow through `Cx`. No ambient authority — everything is explicit.

| Method | Purpose |
|--------|---------|
| `cx.trace(event)` | Structured telemetry/tracing |
| `cx.is_cancel_requested()` | Check if cancellation pending |
| `cx.checkpoint()` | Check cancel + record progress (synchronous) |
| `cx.checkpoint_with(msg)` | checkpoint() with observability message |
| `cx.masked(\|\| { ... })` | Synchronous cancel mask (defers cancellation) |
| `cx.timer_driver()` | Access `TimerDriverHandle` for current time |
| `cx.budget()` | Current budget remaining |
| `cx.yield_now()` | Yield to scheduler without cancel check |
| `cx.spawn(...)` | Spawn tasks in current region |

**Time access**: `cx.timer_driver().map(|d| d.now())` returns `Option<Time>`.
There is NO `cx.now()` method. Time comes from the timer driver.

**Sleep**: `asupersync::time::sleep_until(deadline: Time) -> Sleep` is a **free
function**, not a Cx method. Similarly `asupersync::time::sleep(now, duration)`.

### checkpoint() Contract

```rust
// Synchronous — does NOT yield to scheduler (not async).
// Returns Err(Cancelled) if cancel requested AND not masked.
cx.checkpoint()?;

// With observability message (for stuck-task detection).
cx.checkpoint_with("processing batch item 42")?;
```

Call in processing loops or between logical units of work. Allows:
1. Cancel propagation (actor can be stopped mid-batch)
2. Progress recording (observability, stuck-task detection, work-stealing hints)

**IMPORTANT**: `checkpoint()` is synchronous. It does NOT yield to the scheduler.
It checks the cancel flag and records a progress event. Use in GenServer handlers
that process BEFORE `Box::pin(async {})`.

### masked() Contract

```rust
// Synchronous cancel mask — closure runs to completion even if
// cancellation is requested. Cancellation is deferred, not lost.
cx.masked(|| {
    // Critical section: entity_tracks stays consistent
    self.process_results(&results);
});
// Cancellation fires after the mask drops.
```

`pub fn masked<F, R>(&self, f: F) -> R where F: FnOnce() -> R`

Increments `mask_depth` on entry, decrements on exit via Drop guard.
Inside a mask, `checkpoint()` returns `Ok(())` even if cancel is requested.

**NOTE**: There is NO `cx.with_cancel_mask()` async variant. The cancel mask
is synchronous only. This works well with the synchronous-before-async
GenServer handler pattern.

---

## 5. NameRegistry

Capability-scoped service discovery with deterministic collision handling.

```rust
// Registration (via ChildSpec)
.with_registration(NameRegistrationPolicy::Register {
    name: "entity-resolver".into(),
    collision: NameCollisionPolicy::Fail,  // or Replace, Wait
})

// Lookup
let handle: Option<ActorRef> = registry_handle.whereis("entity-resolver");
```

**NameLease**: Two-phase commit — `reserve("name")` → `commit()`. Must be
explicitly released. Collision policies: `Fail`, `Replace`, `Wait`.

---

## 6. Process Monitoring

Erlang-style unidirectional lifecycle observation.

```rust
// Monitor another actor
let monitor_ref: MonitorRef = cx.monitor(target_actor_ref);

// Receive notification in handle_info when target crashes
fn handle_info(&mut self, cx: &Cx, msg: Self::Info) {
    match msg {
        MyInfo::System(SystemMsg::Down(DownNotification { ref_, reason })) => {
            // monitored actor terminated with `reason`
        }
        // ...
    }
}
```

**DownNotification**: Deterministic delivery — guaranteed to arrive.
Contains `MonitorRef` and termination reason.

---

## 7. Channels

Cancel-safe, two-phase send. All require `&Cx`.

| Type | Create | Send | Receive |
|------|--------|------|---------|
| **mpsc** | `mpsc::channel(capacity)` | `tx.send(&cx, val).await` | `rx.recv(&cx).await` |
| **oneshot** | `oneshot::channel()` | `tx.send(&cx, val).await` | `rx.await` |
| **broadcast** | `broadcast::channel(capacity)` | `tx.send(&cx, val).await` | `rx.recv(&cx).await` |

Two-phase send: `reserve()` → `send()`. The reservation holds a slot even
if the sender is cancelled between reserve and send.

---

## 8. Synchronization Primitives

| Primitive | Description |
|-----------|-------------|
| **Mutex** | Fair, cancel-safe, contention tracking |
| **RwLock** | Writer preference, reader batching |
| **Semaphore** | Counting, permit-as-obligation model |
| **Barrier** | N-way synchronization point |
| **Notify** | One-time or multi-waiter notification |
| **OnceLock** | Async one-time initialization |
| **ContendedMutex** | Mutex with contention metrics |
| **Pool** | Object pool with per-thread caches |

All are deterministic under LabRuntime.

---

## 9. Timer / Time

### Time Type

```rust
use asupersync::types::Time;

// Time is nanoseconds internally: pub struct Time(u64)
let t = Time::from_millis(60_000);  // 60 seconds
let t = Time::from_secs(60);        // 60 seconds
let ms = t.as_millis();             // -> u64
let ns = t.as_nanos();              // -> u64
```

### Getting Current Time

```rust
// Via Cx — requires timer driver to be configured
if let Some(driver) = cx.timer_driver() {
    let now: Time = driver.now();
}

// NOTE: There is NO cx.now() method. Time comes from the timer driver.
```

### Sleep Functions (FREE FUNCTIONS, not Cx methods)

```rust
use asupersync::time::{sleep, sleep_until};

// Absolute deadline sleep
let deadline = Time::from_secs(60);
sleep_until(deadline).await;

// Relative duration sleep
let now = cx.timer_driver().unwrap().now();
sleep(now, Duration::from_secs(60)).await;
```

### Timeout

```rust
asupersync::time::timeout(Duration::from_secs(5), async {
    long_operation().await
}).await?;  // Err(TimeoutError) if deadline exceeded
```

### Interval

```rust
use asupersync::time::interval;

let now = cx.timer_driver().unwrap().now();
let mut ticker = interval(now, Duration::from_secs(1));
ticker.tick().await;  // Fires every 1s
```

### Self-Scheduling in GenServer

**CAUTION**: `sleep_until()` inside a GenServer handler BLOCKS that handler.
The handler's returned future won't complete until the sleep resolves. This
means the actor can't process other messages during the sleep.

For periodic timers, the recommended pattern is:
1. External tick source (e.g., another actor or spawned task)
2. Or: spawn a background task in `on_start` that sends periodic messages
   to the actor's own `GenServerHandle`

Self-scheduling via `sleep_until` in `handle_info` is only appropriate if
the actor has no other work to do between ticks.

---

## 10. Budget System

Budgets enforce bounded execution for cleanup and computation.

```rust
Budget {
    deadline: Deadline,    // Wall-clock or virtual deadline
    pollQuota: u32,        // Max polls before forced yield
    costQuota: u64,        // Application-defined cost metric
}

Budget::INFINITE  // No limits (for on_start)
Budget::MINIMAL   // Tight limits (for on_stop/cleanup)
```

Budgets compose as a semiring — nested scopes inherit parent constraints.

---

## 11. Structured Concurrency

### Regions & Scopes

```rust
// Tasks are owned by regions
// Regions guarantee: no orphan tasks, quiescence on close
scope.spawn_gen_server(state, cx, server, mailbox_capacity)?;
```

**Region close protocol**: Wait for all children → drain mailboxes → finalize.
Guarantees quiescence — no zombie tasks.

### Combinators

```rust
join!(future_a, future_b)           // Both complete
race!(future_a, future_b)           // First to complete wins
timeout!(duration, future)          // Deadline
select!(branch_a, branch_b, ...)    // First ready branch
```

---

## 12. Cancellation Protocol

Multi-phase, bounded cleanup:

```
Request → Drain → Finalize → Complete
```

1. **Request**: `cx.is_cancel_requested()` returns true
2. **Drain**: Actor processes remaining buffered messages
3. **Finalize**: `on_stop()` runs (under cancel mask)
4. **Complete**: Region reports child quiesced

Cancellation is NEVER silent data loss. The drain phase ensures in-flight
work completes or is explicitly shed.

---

## 13. Obligation Tracking

Linear tokens that MUST be resolved — prevents resource leaks.

| Token | Purpose |
|-------|---------|
| `SendPermit` | Reserved mailbox slot — must send or release |
| `Reply<T>` | Call reply handle — must send response |
| `NameLease` | Registry reservation — must commit or release |
| `Ack` | Acknowledgment — must be delivered |

Lab mode detects obligation leaks at shutdown.

---

## 14. LabRuntime (Deterministic Testing)

```rust
use asupersync::lab::LabRuntime;

let lab = LabRuntime::new(seed);  // Deterministic from seed

lab.run(async {
    // Virtual time — sleeps complete instantly
    // Deterministic scheduling — same seed = same ordering
    // Trace capture — every event recorded for replay
});
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Virtual time** | All sleeps resolve instantly; time controlled by lab |
| **Deterministic RNG** | Seeded `DetEntropy` replaces OS RNG |
| **Virtual I/O** | `LabReactor` + `VirtualTcp` for in-memory networking |
| **Schedule exploration** | `ScheduleExplorer`, `DporExplorer` vary interleavings |
| **Trace replay** | Captured traces can be replayed exactly |
| **TLA+ export** | Export traces as TLA+ behaviors for model checking |

### DPOR Schedule Exploration

Uses Mazurkiewicz traces and Foata fingerprints to systematically explore
task interleavings. Turns concurrency bugs into reproducible test failures.

---

## 15. Networking Stack

Full cancel-safe stack from raw sockets to application protocols:

| Layer | Implementation |
|-------|----------------|
| TCP | `TcpStream`, `TcpListener` |
| UDP | `UdpSocket` |
| TLS | Built-in TLS support |
| DNS | Built-in resolver |
| HTTP/1.1 | Cancel-safe request/response |
| HTTP/2 | Multiplexed streams |
| WebSocket | Full protocol support |
| NATS | `NatsClient`, JetStream integration |

---

## 16. Database Clients

| Database | Module |
|----------|--------|
| SQLite | Built-in client |
| PostgreSQL | Built-in client |
| MySQL | Built-in client |

---

## 17. Formal Verification Hooks

| Feature | Description |
|---------|-------------|
| **Lean mechanization scaffold** | Formal semantics for runtime correctness |
| **TLA+ export** | Traces → TLA+ behaviors for model checking |
| **Anytime-valid monitoring** | e-processes for invariant checking |
| **Conformal calibration** | Distribution-free robust alerting |
| **Evidence ledgers** | Bayes factor structured debugging |
