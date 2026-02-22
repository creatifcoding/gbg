# TMNL Profiling Playbook

> **Val's Field Manual** — Instrument first, optimize second.

---

## Table of Contents

1. [Quick Triage (No Code Changes)](#1-quick-triage-no-code-changes)
2. [Effect.withSpan & OpenTelemetry](#2-effectwithspan--opentelemetry)
3. [Effect Supervisor — Fiber Tracking](#3-effect-supervisor--fiber-tracking)
4. [Effect Metrics — Counters, Gauges, Histograms](#4-effect-metrics--counters-gauges-histograms)
5. [General JS Profiling](#5-general-js-profiling)
6. [Tauri-Specific Profiling](#6-tauri-specific-profiling)
7. [In-App Dev Panel Architecture](#7-in-app-dev-panel-architecture)

---

## 1. Quick Triage (No Code Changes)

Before writing a single line of instrumentation, use what the browser gives you for free.

### Chrome DevTools Performance Tab

```
1. Open DevTools (F12 / Ctrl+Shift+I)
2. Performance tab → Click Record (⏺)
3. Interact with TMNL for 10-15 seconds
4. Stop recording
5. Analyze:
   - Main thread flame chart: look for wide blocks (long tasks)
   - Frames row: look for red bars (dropped frames)
   - Summary pie chart: JS vs Rendering vs Painting vs Idle
```

**What to look for:**
- `requestAnimationFrame` callbacks taking >16ms (frame budget exceeded)
- Repeated GC events (memory pressure → leak likely)
- Long "Recalculate Style" blocks (cascading React re-renders)

### Chrome DevTools Memory Tab

```
1. Memory tab → Select "Heap snapshot"
2. Take Snapshot #1
3. Interact with TMNL for 30 seconds
4. Take Snapshot #2
5. Select Snapshot #2 → Change view to "Comparison"
6. Sort by "# Delta" descending
7. Growing object counts = potential leaks
```

**Key objects to watch:**
- `Detached HTMLDivElement` — DOM nodes retained after unmount
- `(closure)` — Event listeners or callbacks holding references
- `FiberRuntime` / `Effect` — Orphaned Effect fibers
- `Animation` / `gsap` — GSAP instances not killed

### Chrome Task Manager

```
1. Chrome Menu → More Tools → Task Manager
2. Right-click column headers → Enable "JavaScript memory"
3. Watch the "JavaScript memory" column for your tab
4. If it grows steadily: memory leak confirmed
```

### Performance Monitor (Real-Time)

```
1. DevTools → Ctrl+Shift+P → "Show Performance Monitor"
2. Watch these in real-time:
   - CPU usage %
   - JS heap size
   - DOM Nodes count
   - JS event listeners count
   - Layouts / sec
   - Style recalcs / sec
```

If DOM Nodes or JS event listeners grow without bound → leak.

---

## 2. Effect.withSpan & OpenTelemetry

Your `Effect.withSpan` calls are currently going nowhere. Let's wire them up.

### Install Dependencies

```bash
bun add @effect/opentelemetry
bun add @opentelemetry/sdk-trace-base
bun add @opentelemetry/sdk-trace-web   # Browser — NOT sdk-trace-node
bun add @opentelemetry/sdk-metrics
bun add @opentelemetry/api             # Peer dependency
```

### Browser Tracing Layer (Dev-Only)

Create `src/lib/dev/tracing.ts`:

```typescript
import { Effect, Layer } from "effect"
import { NodeSdk } from "@effect/opentelemetry"
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
  // Use BatchSpanProcessor for production, Simple for dev (immediate output)
} from "@opentelemetry/sdk-trace-base"

// --------------------------------------------------------------------------
// Dev-only: prints all spans to the browser console
// --------------------------------------------------------------------------
export const DevTracingLive = NodeSdk.layer(() => ({
  resource: { serviceName: "tmnl-dev" },
  spanProcessor: new SimpleSpanProcessor(new ConsoleSpanExporter()),
}))

// Conditional: only in development
export const TracingLive = import.meta.env.DEV
  ? DevTracingLive
  : Layer.empty
```

### Wiring into Your App Runtime

Wherever you compose your root Layer (the single `Effect.provide`):

```typescript
import { TracingLive } from "@/lib/dev/tracing"

// Add TracingLive to your composed layer
const AppLive = Layer.mergeAll(
  IdGenerator.Default,
  LayerFactory.Default,
  LayerManager.Default,
  TracingLive,  // ← Spans now flow to console
)
```

### Using Effect.withSpan

Two patterns — both canonical:

#### Pattern A: `Effect.withSpan` (pipe-based)

```typescript
const fetchData = Effect.gen(function* () {
  yield* Effect.annotateCurrentSpan({ query, limit })
  const results = yield* searchService.search(query)
  return results
}).pipe(
  Effect.withSpan("DataManager.fetchData")
)
```

#### Pattern B: `Effect.fn` (function-based, auto-span)

```typescript
// Effect.fn automatically creates a span named "DataManager.fetchData"
const fetchData = Effect.fn("DataManager.fetchData")(
  function* (query: string, limit: number) {
    yield* Effect.annotateCurrentSpan({ query, limit })
    const results = yield* searchService.search(query)
    return results
  }
)
```

### What to Instrument with Spans

| Category | Examples | Priority |
|----------|---------|:---:|
| **Service methods** | `DataManager.search`, `LayerManager.bringToFront` | 🔴 High |
| **Atom mutations** | `runtimeAtom.fn()` calls that mutate state | 🔴 High |
| **Animation sequences** | `splash.bootSequence`, `reticle.emanation` | 🟠 Medium |
| **Canvas operations** | `HoundstoothGOL.render` (per-frame is too noisy) | 🟡 Low |
| **Component mount/unmount** | Via useEffect — but prefer Supervisor instead | 🟡 Low |

### Span Annotations for Performance

```typescript
// Annotate spans with performance-relevant data
yield* Effect.annotateCurrentSpan({
  "tmnl.fiber.count": activeFiberCount,
  "tmnl.heap.used": performance.memory?.usedJSHeapSize ?? 0,
  "tmnl.frame.fps": currentFPS,
})
```

---

## 3. Effect Supervisor — Fiber Tracking

This is the **killer feature** for your fiber proliferation concern. `Supervisor.track` monitors all child fibers.

### Create a Fiber Monitoring Service

```typescript
// src/lib/dev/FiberMonitor.ts
import { Effect, Supervisor, Fiber, FiberStatus, Schedule, Metric } from "effect"

// Metric: gauge tracking active fiber count
const activeFibers = Metric.gauge("tmnl.fibers.active", {
  description: "Number of currently active Effect fibers"
})

// Metric: counter for total fibers created
const totalFibersCreated = Metric.counter("tmnl.fibers.created", {
  description: "Total number of Effect fibers created",
  incremental: true,
})

export class FiberMonitor extends Effect.Service<FiberMonitor>()("tmnl/FiberMonitor", {
  scoped: Effect.gen(function* () {
    const supervisor = yield* Supervisor.track

    const getActiveFiberCount = Effect.gen(function* () {
      const fibers = yield* supervisor.value
      return fibers.length
    })

    const getActiveFibers = Effect.gen(function* () {
      const fibers = yield* supervisor.value
      return yield* Effect.forEach(fibers, (fiber) =>
        Effect.gen(function* () {
          const status = yield* Fiber.status(fiber)
          const id = fiber.id()
          return { id, status, isDone: status === FiberStatus.done }
        })
      )
    })

    // Background monitor: logs fiber count every 5 seconds (dev only)
    if (import.meta.env.DEV) {
      yield* Effect.gen(function* () {
        const count = yield* getActiveFiberCount
        yield* activeFibers(Effect.succeed(count))
        yield* Effect.logDebug(`[FiberMonitor] Active fibers: ${count}`)
      }).pipe(
        Effect.repeat(Schedule.spaced("5 seconds")),
        Effect.supervised(supervisor),
        Effect.forkScoped,  // ← Runs in background, cleaned up with scope
      )
    }

    return {
      supervisor,
      getActiveFiberCount,
      getActiveFibers,
    } as const
  }),
}) {}
```

### Using Effect.supervised for Tracking

```typescript
// Wrap your main application effect with supervision
const mainProgram = Effect.gen(function* () {
  const monitor = yield* FiberMonitor
  // ... your app logic
}).pipe(
  Effect.supervised(monitor.supervisor)
)
```

### Detecting Orphaned Fibers

```typescript
// Periodically check for fibers that have been running too long
const detectOrphans = Effect.gen(function* () {
  const monitor = yield* FiberMonitor
  const fibers = yield* monitor.getActiveFibers

  const suspicious = fibers.filter(f => !f.isDone)
  if (suspicious.length > 50) {
    yield* Effect.logWarning(
      `[FiberMonitor] ${suspicious.length} active fibers — possible leak`
    )
  }
})
```

---

## 4. Effect Metrics — Counters, Gauges, Histograms

Effect Metrics give you first-class performance tracking without external dependencies.

### Key Metrics to Define

```typescript
// src/lib/dev/metrics.ts
import { Metric, MetricBoundaries } from "effect"

// --- Gauges (current values) ---
export const heapUsedGauge = Metric.gauge("tmnl.heap.used_bytes", {
  description: "Current JS heap usage in bytes"
})

export const fpsGauge = Metric.gauge("tmnl.fps", {
  description: "Current frames per second"
})

export const activeTimersGauge = Metric.gauge("tmnl.timers.active", {
  description: "Number of active setTimeout/setInterval handles"
})

export const domNodesGauge = Metric.gauge("tmnl.dom.nodes", {
  description: "Total DOM node count"
})

// --- Counters (cumulative) ---
export const renderCount = Metric.counter("tmnl.renders", {
  description: "Total React component renders",
  incremental: true,
})

export const atomUpdateCount = Metric.counter("tmnl.atom.updates", {
  description: "Total Atom.set operations",
  incremental: true,
})

// --- Histograms (distributions) ---
export const frameDuration = Metric.histogram(
  "tmnl.frame.duration_ms",
  MetricBoundaries.linear({ start: 0, width: 2, count: 20 }),  // 0-40ms in 2ms buckets
  "Distribution of frame render times"
)

export const effectLatency = Metric.histogram(
  "tmnl.effect.latency_ms",
  MetricBoundaries.exponential({ start: 1, factor: 2, count: 12 }),  // 1, 2, 4, 8, ..., 2048ms
  "Distribution of Effect program execution times"
)
```

### Using Metrics in Effects

```typescript
// Track an effect's duration automatically
const trackedSearch = Metric.trackDuration(
  searchEffect,
  effectLatency
)

// Manually update a gauge
const updateHeapMetric = Effect.gen(function* () {
  const mem = performance.memory
  if (mem) {
    yield* heapUsedGauge(Effect.succeed(mem.usedJSHeapSize))
  }
})

// Read metric values for display
const getMetricSnapshot = Effect.gen(function* () {
  const fps = yield* Metric.value(fpsGauge)
  const heap = yield* Metric.value(heapUsedGauge)
  const fibers = yield* Metric.value(activeFibersGauge)
  return { fps, heap, fibers }
})
```

---

## 5. General JS Profiling

For everything that ISN'T an Effect program — canvas loops, raw DOM, animation drivers.

### 5a. Performance API (Built-in, Zero Dependencies)

```typescript
// Mark + Measure for specific operations
performance.mark("houndstooth-render-start")
// ... render logic ...
performance.mark("houndstooth-render-end")
performance.measure(
  "houndstooth-render",
  "houndstooth-render-start",
  "houndstooth-render-end"
)

// PerformanceObserver for automatic collection
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 16.67) { // Exceeded frame budget
      console.warn(`[PERF] ${entry.name}: ${entry.duration.toFixed(2)}ms (over budget)`)
    }
  }
})
observer.observe({ type: "measure", buffered: true })
```

### 5b. FPS Counter (rAF-based)

```typescript
// src/lib/dev/fps-counter.ts
export function createFPSCounter() {
  let frames = 0
  let lastTime = performance.now()
  let fps = 60
  let frameTimings: number[] = []

  function tick(now: number) {
    frames++
    const elapsed = now - lastTime

    // Calculate frame duration
    frameTimings.push(elapsed)
    if (frameTimings.length > 60) frameTimings.shift()

    if (elapsed >= 1000) {
      fps = Math.round((frames * 1000) / elapsed)
      frames = 0
      lastTime = now
    }

    requestAnimationFrame(tick)
  }

  requestAnimationFrame(tick)

  return {
    get fps() { return fps },
    get avgFrameTime() {
      return frameTimings.reduce((a, b) => a + b, 0) / frameTimings.length
    },
    get minFps() {
      const maxTime = Math.max(...frameTimings)
      return maxTime > 0 ? Math.round(1000 / maxTime) : 60
    },
  }
}
```

### 5c. Memory Monitoring

```typescript
// src/lib/dev/memory-monitor.ts

interface MemorySnapshot {
  timestamp: number
  usedHeap: number
  totalHeap: number
  limit: number
  trend: "growing" | "stable" | "shrinking"
}

export function createMemoryMonitor(intervalMs = 2000) {
  const snapshots: MemorySnapshot[] = []
  let intervalId: number | null = null

  function sample(): MemorySnapshot | null {
    // performance.memory is Chrome-only (non-standard)
    const mem = (performance as any).memory
    if (!mem) return null

    const snapshot: MemorySnapshot = {
      timestamp: Date.now(),
      usedHeap: mem.usedJSHeapSize,
      totalHeap: mem.totalJSHeapSize,
      limit: mem.jsHeapSizeLimit,
      trend: "stable",
    }

    // Determine trend from last 10 samples
    if (snapshots.length >= 10) {
      const recent = snapshots.slice(-10)
      const first = recent[0].usedHeap
      const last = recent[recent.length - 1].usedHeap
      const delta = last - first
      const pctChange = delta / first

      if (pctChange > 0.05) snapshot.trend = "growing"       // >5% growth
      else if (pctChange < -0.05) snapshot.trend = "shrinking" // >5% shrink
    }

    snapshots.push(snapshot)
    if (snapshots.length > 300) snapshots.shift() // Keep last 10 minutes

    return snapshot
  }

  return {
    start() {
      intervalId = window.setInterval(sample, intervalMs)
    },
    stop() {
      if (intervalId) clearInterval(intervalId)
    },
    get latest() { return snapshots[snapshots.length - 1] ?? null },
    get history() { return [...snapshots] },
    get leakProbability() {
      if (snapshots.length < 30) return "unknown"
      const growingCount = snapshots.slice(-30)
        .filter(s => s.trend === "growing").length
      if (growingCount > 20) return "high"
      if (growingCount > 10) return "medium"
      return "low"
    },
    sample,
  }
}
```

### 5d. Timer Leak Detector (Dev-Only Monkey-Patch)

```typescript
// src/lib/dev/timer-leak-detector.ts
// ONLY activate in development — this wraps native APIs

interface TrackedTimer {
  id: number
  type: "timeout" | "interval"
  stack: string
  created: number
  delay: number
}

const activeTimers = new Map<number, TrackedTimer>()

export function installTimerLeakDetector() {
  if (!import.meta.env.DEV) return { getActive: () => [], count: 0 }

  const originalSetTimeout = window.setTimeout
  const originalClearTimeout = window.clearTimeout
  const originalSetInterval = window.setInterval
  const originalClearInterval = window.clearInterval

  // @ts-expect-error — intentional monkey-patch
  window.setTimeout = function(fn: TimerHandler, delay?: number, ...args: any[]) {
    const id = originalSetTimeout.call(window, fn, delay, ...args)
    activeTimers.set(id, {
      id,
      type: "timeout",
      stack: new Error().stack ?? "",
      created: Date.now(),
      delay: delay ?? 0,
    })
    // Auto-remove when timeout fires (wrap the callback)
    const wrapped = () => {
      activeTimers.delete(id)
      if (typeof fn === "function") fn()
    }
    originalClearTimeout.call(window, id)
    const realId = originalSetTimeout.call(window, wrapped, delay, ...args)
    activeTimers.delete(id)
    activeTimers.set(realId, {
      id: realId,
      type: "timeout",
      stack: new Error().stack ?? "",
      created: Date.now(),
      delay: delay ?? 0,
    })
    return realId
  } as typeof setTimeout

  // @ts-expect-error
  window.setInterval = function(fn: TimerHandler, delay?: number, ...args: any[]) {
    const id = originalSetInterval.call(window, fn, delay, ...args)
    activeTimers.set(id, {
      id,
      type: "interval",
      stack: new Error().stack ?? "",
      created: Date.now(),
      delay: delay ?? 0,
    })
    return id
  } as typeof setInterval

  window.clearTimeout = function(id?: number) {
    if (id !== undefined) activeTimers.delete(id)
    return originalClearTimeout.call(window, id)
  }

  window.clearInterval = function(id?: number) {
    if (id !== undefined) activeTimers.delete(id)
    return originalClearInterval.call(window, id)
  }

  return {
    getActive: () => Array.from(activeTimers.values()),
    get count() { return activeTimers.size },
    getLeakedIntervals: () =>
      Array.from(activeTimers.values())
        .filter(t => t.type === "interval" && Date.now() - t.created > 30_000),
    dump: () => {
      console.group("[TimerLeakDetector] Active timers:")
      for (const timer of activeTimers.values()) {
        const age = ((Date.now() - timer.created) / 1000).toFixed(1)
        console.log(`${timer.type} #${timer.id} (${age}s old, ${timer.delay}ms delay)`)
        console.log(timer.stack)
      }
      console.groupEnd()
    },
  }
}
```

### 5e. requestAnimationFrame Loop Monitor

```typescript
// src/lib/dev/raf-monitor.ts

interface RAFEntry {
  id: number
  stack: string
  registered: number
  cancelledAt?: number
}

const activeRAFs = new Map<number, RAFEntry>()

export function installRAFMonitor() {
  if (!import.meta.env.DEV) return { getActive: () => [], count: 0 }

  const originalRAF = window.requestAnimationFrame
  const originalCancel = window.cancelAnimationFrame

  window.requestAnimationFrame = function(callback: FrameRequestCallback) {
    const id = originalRAF.call(window, (timestamp) => {
      activeRAFs.delete(id) // Remove when callback fires
      callback(timestamp)
    })
    activeRAFs.set(id, {
      id,
      stack: new Error().stack ?? "",
      registered: Date.now(),
    })
    return id
  }

  window.cancelAnimationFrame = function(id: number) {
    const entry = activeRAFs.get(id)
    if (entry) entry.cancelledAt = Date.now()
    activeRAFs.delete(id)
    return originalCancel.call(window, id)
  }

  return {
    getActive: () => Array.from(activeRAFs.values()),
    get count() { return activeRAFs.size },
  }
}
```

### 5f. React Render Tracker (useWhyDidYouRender Pattern)

```typescript
// src/lib/dev/render-tracker.ts
import { useRef, useEffect } from "react"

/**
 * Drop into any component to log why it re-rendered.
 * Usage: useRenderTracker("ComponentName", props)
 */
export function useRenderTracker(name: string, props: Record<string, any>) {
  if (!import.meta.env.DEV) return

  const prevProps = useRef<Record<string, any>>({})
  const renderCount = useRef(0)

  renderCount.current++

  useEffect(() => {
    const changed: string[] = []
    for (const key of Object.keys(props)) {
      if (prevProps.current[key] !== props[key]) {
        changed.push(key)
      }
    }

    if (renderCount.current > 1 && changed.length > 0) {
      console.log(
        `[RenderTracker] ${name} #${renderCount.current} — changed: ${changed.join(", ")}`
      )
    }

    prevProps.current = { ...props }
  })
}
```

---

## 6. Tauri-Specific Profiling

### CrabNebula DevTools (Recommended)

The official Tauri profiling tool. Add to your Rust backend:

```toml
# src-tauri/Cargo.toml
[dependencies]
tauri-plugin-devtools = "2.0.0"
```

```rust
// src-tauri/src/main.rs
fn main() {
    #[cfg(debug_assertions)]
    let devtools = tauri_plugin_devtools::init();

    let mut builder = tauri::Builder::default();

    #[cfg(debug_assertions)]
    {
        builder = builder.plugin(devtools);
    }

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**What it gives you:**
- Command execution spans (Rust ↔ WebView IPC)
- Event tracing (Tauri events)
- Performance metrics for the Rust backend
- Log aggregation from both frontend and backend

### WebKit Inspector (Linux/WSLg)

For the WebView itself:

```bash
# Enable WebKit inspector (add to your dev script)
export WEBKIT_INSPECTOR_SERVER=127.0.0.1:9222

# Then open in a Chromium-based browser:
# chrome://inspect → Configure → Add 127.0.0.1:9222
```

### Transparent Window Performance

Your transparent frameless window adds GPU compositing overhead. Quick test:

```json
// src-tauri/tauri.conf.json — temporarily disable transparency
{
  "app": {
    "windows": [{
      "transparent": false,  // ← Try this
      "decorations": true    // ← And this
    }]
  }
}
```

If heat drops significantly, the transparency compositing is a major contributor.

---

## 7. In-App Dev Panel Architecture

The hybrid approach: lightweight in-app metrics + external deep-dive.

### Architecture

```
┌─────────────────────────────────────────────────┐
│                DevPanel (React)                  │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐         │
│  │ FPS  │ │ Heap │ │Fibers│ │Timers │         │
│  │ 60▪  │ │ 42MB │ │  12  │ │   3   │         │
│  │ ████ │ │  →   │ │  ▲   │ │   ✓   │         │
│  └──┬───┘ └──┬───┘ └──┬───┘ └──┬────┘         │
│     │        │        │        │                │
│     ▼        ▼        ▼        ▼                │
│  ┌─────────────────────────────────────────┐   │
│  │         Atom-based State Layer          │   │
│  │  fpsAtom  heapAtom  fiberAtom  timerAtom│   │
│  └────────────────────┬────────────────────┘   │
└───────────────────────┼─────────────────────────┘
                        │
           ┌────────────┼────────────┐
           ▼            ▼            ▼
    ┌────────────┐ ┌──────────┐ ┌──────────────┐
    │ FPS Counter│ │ Memory   │ │ Fiber Monitor│
    │ (rAF)      │ │ Monitor  │ │ (Supervisor) │
    │            │ │ (perf API│ │              │
    └────────────┘ └──────────┘ └──────────────┘
```

### Toggle Hotkey

```typescript
// Ctrl+Shift+P to toggle dev panel
useEffect(() => {
  if (!import.meta.env.DEV) return

  const handler = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === "P") {
      e.preventDefault()
      setShowDevPanel(prev => !prev)
    }
  }
  window.addEventListener("keydown", handler)
  return () => window.removeEventListener("keydown", handler)
}, [])
```

---

## Priority Action Items

### Do Right Now (5 minutes each)

1. **Chrome Performance Monitor** — Open it (`Ctrl+Shift+P → "Show Performance Monitor"`) and watch CPU/heap/DOM nodes while using TMNL
2. **Check HoundstoothGOL** — Is the rAF loop running when the component is off-screen? Does it have `cancelAnimationFrame` in cleanup?
3. **Take 2 heap snapshots** 30s apart — Compare for growing object counts

### Do This Week

4. Install `@effect/opentelemetry` + wire `DevTracingLive` to see your existing `withSpan` calls
5. Add `Supervisor.track` to your root Effect runtime
6. Build the FPS counter + memory monitor atoms

### Do This Sprint

7. Build the DevPanel component
8. Instrument top 10 hottest Effect services with `Effect.fn("name")`
9. Add `Metric.histogram` for frame durations
10. Install CrabNebula DevTools for Tauri IPC profiling

---

## Appendix: Common TMNL Heat Sources

| Component | Why It's Hot | Fix |
|-----------|-------------|-----|
| HoundstoothGOL | Uncapped rAF loop, 28 canvas ops/frame | Add IntersectionObserver, throttle to 30fps when idle |
| Splash CRT | 2 concurrent rAF loops (flicker + moiré) | Ensure both cancel on unmount/skip |
| GSAP + anime.js | Dual animation runtimes, 544 references | Consolidate to one driver |
| Effect.runFork | Fibers without scope cleanup | Use `Effect.forkScoped` + `Scope.addFinalizer` |
| Atom subscriptions | 1,312 atoms, potential cascade | Profile with atom subscription counter |
| Transparent window | WebKit compositing on WSLg | Test with `transparent: false` |
