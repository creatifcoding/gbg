---
id: "S1-S9"
title: "Physical ↔ React Synergy — End-to-End Latency Budget"
commitHash: "6656064"
status: "draft"
date: "2026-01-02"
tier: "pair-synergy"
author: "Val"
tags: ["latency", "performance", "e2e", "synergy", "cross-cutting"]
---

# ADR S1-S9: Physical ↔ React Synergy — End-to-End Latency Budget

## Context

In a sensor-to-UI pipeline spanning nine distinct stages (S1 Physical through S9 React), end-to-end latency becomes a critical system property that transcends individual stage optimizations. Each stage introduces its own delay characteristics—from ADC sampling periods to network round-trips to browser render frames—and these accumulate into the total observable latency experienced by users interacting with real-time data.

### The Latency Problem Space

**Key Questions:**
1. What is acceptable end-to-end latency for different use cases (control systems vs dashboards vs analytics)?
2. How do we allocate latency budget across 9 heterogeneous stages?
3. Where are the optimization levers with highest ROI?
4. How do we measure and monitor cross-stage latency in production?

### Cross-Stage Dependencies

The pipeline exhibits several latency-coupling patterns:

**Serial Accumulation**: Total latency is the sum of all stage latencies in the critical path. A slow S3 Transport directly impacts S9 React responsiveness.

**Batch-Latency Tradeoffs**: Batching improves throughput but increases latency (S2 Edge aggregation buffers, S7 Filtering coalescing).

**Bypass Opportunities**: Not all data flows require all stages. Real-time control paths might skip S5 Storage entirely.

**Feedback Loops**: S9 React rendering performance can create backpressure that affects S6 Client subscription strategies.

### Use Case Latency Requirements

| Use Case | Target Latency | Example |
|----------|----------------|---------|
| **Real-time Control** | <200ms | Motor position feedback, PID loops |
| **Interactive Dashboards** | <500ms | Live sensor graphs, status indicators |
| **Batch Analytics** | <5s | Historical trend analysis, reporting |

The system must support all three tiers simultaneously, routing data through appropriate optimization paths.

---

## Decision

### 1. Latency Budget Allocation

We establish a **186ms maximum budget** for the real-time critical path, with typical performance targeting **102ms P50 latency**.

| Stage | Budget | Typical | Notes |
|-------|--------|---------|-------|
| **S1 Physical** | 10ms | 5ms | ADC sampling (100-200 Hz) + encoding overhead |
| **S2 Edge** | 20ms | 10ms | Aggregation buffer (10ms window) + compression |
| **S3 Transport** | 50ms | 30ms | Network RTT + MQTT/NATS broker processing |
| **S4 Ingestion** | 10ms | 5ms | Schema validation + routing decisions |
| **S5 Storage** | 20ms | 10ms | Dual-write (Postgres + DuckDB) with async commit |
| **S6 Client** | 50ms | 30ms | WebSocket RTT + client-side decompression |
| **S7 Filtering** | 5ms | 2ms | Dead-band check + downsampling logic |
| **S8 State** | 5ms | 2ms | Atom update + derived state propagation |
| **S9 React** | 16ms | 8ms | Component render + DOM commit (60fps budget) |
| **Total** | **186ms** | **102ms** | End-to-end sensor-to-pixel latency |

**Budget Philosophy:**
- **Network-heavy stages** (S3, S6) get the largest allocations due to physical constraints
- **Pure computation stages** (S7, S8) get tightest budgets—these are fully under our control
- **S9 React** gets exactly one 60fps frame (16.67ms) to maintain visual smoothness
- **Typical performance** assumes 55% utilization of budget, leaving headroom for P95/P99 spikes

### 2. Latency Measurement Strategy

#### Distributed Tracing Architecture

Every sensor sample gets a **correlation ID** at S1 Physical that flows through all stages:

```typescript
interface TraceContext {
  traceId: string                    // UUID generated at S1
  sourceDeviceId: string              // Physical sensor identifier
  sampleTimestamp: number             // High-precision epoch ms
  timestamps: Map<StageId, number>    // Stage entry timestamps
  metadata: {
    priority: 'realtime' | 'interactive' | 'batch'
    bypassStorage?: boolean           // True for real-time path
  }
}

type StageId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9'
```

#### Timestamp Collection Points

Each stage records entry timestamp in `TraceContext.timestamps`:

- **S1 Physical**: ADC sample timestamp (hardware clock)
- **S2 Edge**: Buffer dequeue timestamp
- **S3 Transport**: Broker publish acknowledgment
- **S4 Ingestion**: Validation start timestamp
- **S5 Storage**: Write transaction begin
- **S6 Client**: WebSocket message receive
- **S7 Filtering**: Filter function entry
- **S8 State**: `ctx.set()` invocation timestamp
- **S9 React**: `useAtomValue()` subscription callback entry

**Final latency calculation** occurs in S9:
```typescript
const e2eLatency = timestamps.get('S9')! - sampleTimestamp
const stageLatencies = Array.from(timestamps.entries())
  .sort(([a], [b]) => a.localeCompare(b))
  .reduce((acc, [stage, ts], i, arr) => {
    if (i === 0) return acc
    const prevTs = arr[i - 1][1]
    acc[stage] = ts - prevTs
    return acc
  }, {} as Record<StageId, number>)
```

#### Metrics Collection

**Time-series metrics** (exported to Prometheus/Grafana):
- `pipeline_e2e_latency_ms{priority, percentile}` — P50/P95/P99 end-to-end
- `pipeline_stage_latency_ms{stage, priority, percentile}` — Per-stage breakdown
- `pipeline_budget_utilization{stage}` — Actual/Budget ratio

**Trace sampling** (1% of traces to Jaeger/Tempo):
- Full span tree for outlier latencies (>P95)
- Budget violation traces (any stage exceeding allocation)

### 3. Optimization Levers

#### Lever 1: Storage Bypass for Real-Time Path

High-priority real-time data skips S5 Storage entirely:

```typescript
// S4 Ingestion routing decision
if (traceCtx.metadata.priority === 'realtime') {
  // Direct publish to S6 Client channel
  yield* publishToClientChannel(sample)
  // Async fire-and-forget to storage (optional audit trail)
  Effect.forkDaemon(writeToStorage(sample))
} else {
  // Normal path: S5 → S6
  yield* writeToStorage(sample)
  yield* publishToClientChannel(sample)
}
```

**Savings**: 20ms removed from critical path (S5 budget eliminated)
**New total**: 166ms maximum, 92ms typical

#### Lever 2: Server-Side Filtering Reduces S6 Load

Instead of broadcasting all samples to all clients and filtering in S7, apply coarse filtering in S4 Ingestion:

```typescript
// S4 subscription metadata
interface ClientSubscription {
  clientId: string
  sensorFilters: SensorId[]           // Only these sensors
  samplingRate: number                // Downsample to this Hz
  deadBand?: number                   // Minimum change threshold
}

// S4 routing with pre-filtering
const relevantClients = subscriptions.filter(sub =>
  sub.sensorFilters.includes(sample.sensorId) &&
  meetsDeadBand(sample, sub.deadBand)
)
```

**Savings**: Reduces S6 network payload by 70-90% for typical dashboards
**Side effect**: S7 Filtering becomes nearly free (<1ms typical)

#### Lever 3: Batch Coalescing in S8 Reduces S9 Renders

S8 State can batch rapid atom updates to prevent excessive S9 React renders:

```typescript
// S8 batching strategy
const updateBatcher = Effect.gen(function* () {
  const queue = yield* Queue.unbounded<AtomUpdate>()
  const ctx = yield* Atom.AtomContext

  // Drain queue every 16ms (one frame)
  yield* Stream.fromSchedule(Schedule.spaced('16 millis'))
    .pipe(
      Stream.tap(() => Effect.gen(function* () {
        const updates = yield* Queue.takeAll(queue)
        // Apply all updates in single transaction
        ctx.batch(() => {
          updates.forEach(({ atom, value }) => ctx.set(atom, value))
        })
      }))
    )
    .pipe(Stream.runDrain)
    .pipe(Effect.forkScoped)

  return (update: AtomUpdate) => Queue.offer(queue, update)
})
```

**Savings**: Reduces S9 React renders by 80% under high-frequency sensor data
**Trade-off**: Adds up to 16ms latency (acceptable for interactive tier, not real-time)

### 4. SLA Tiers and Routing Strategy

#### Tier Definitions

**Real-Time Tier** (`priority: 'realtime'`):
- **Target**: <200ms P95 end-to-end
- **Optimizations**: Storage bypass, no batching, dedicated WebSocket channel
- **Use cases**: Control loops, safety-critical feedback
- **Cost**: Highest resource consumption per sample

**Interactive Tier** (`priority: 'interactive'`):
- **Target**: <500ms P95 end-to-end
- **Optimizations**: Server-side filtering, S8 batching (16ms window)
- **Use cases**: Live dashboards, operator monitoring
- **Cost**: Balanced throughput/latency

**Batch Tier** (`priority: 'batch'`):
- **Target**: <5s P95 end-to-end
- **Optimizations**: Heavy batching, async storage, query-time computation
- **Use cases**: Historical analysis, reporting, trend detection
- **Cost**: Lowest per-sample cost

#### Priority Assignment

Priority is set in **S1 Physical** based on sensor metadata:

```typescript
const sensorPriority: Record<SensorType, Priority> = {
  'motor-position': 'realtime',
  'temperature': 'interactive',
  'vibration': 'interactive',
  'power-consumption': 'batch',
  'diagnostics': 'batch',
}
```

Can be overridden dynamically via **S4 Ingestion** routing rules or client subscription preferences.

---

## Consequences

### Positive

**Explicit Performance Contract**: Each stage knows its latency budget and can be held accountable via metrics.

**Optimization Clarity**: Three concrete levers (bypass, server filtering, batching) provide clear ROI opportunities.

**Multi-Tier Support**: Single pipeline supports real-time control, interactive dashboards, and batch analytics without conflicting architectures.

**Observable Performance**: Distributed tracing and per-stage metrics make latency debugging straightforward.

### Negative

**Complexity Overhead**: TraceContext must flow through all 9 stages, increasing payload size and code complexity.

**Budget Enforcement Challenge**: Some stages (S3 network, S6 client RTT) are environmentally dependent—budget violations may be unavoidable.

**Priority Inversion Risk**: High-priority samples could get stuck behind low-priority batches in shared queues (requires queue prioritization).

### Risks

**Monitoring Overhead**: 1% trace sampling at 10k samples/sec = 100 traces/sec. Jaeger/Tempo infrastructure must scale accordingly.

**Clock Skew**: Distributed timestamps across S1 (ESP32), S3 (broker server), S6 (client browser) require NTP synchronization or logical clock coordination.

**Budget Inflation**: Teams may pad budgets to avoid violations, defeating the purpose. Requires periodic review and tightening.

---

## Alternatives Considered

### Alternative 1: No Explicit Budget, Best-Effort Optimization

**Rejected because**: Without budget allocation, optimization becomes ad-hoc and reactive. Budget provides proactive guardrails.

### Alternative 2: Single Global Latency Target (e.g., "sub-second")

**Rejected because**: Different use cases have vastly different latency sensitivity. A motor control loop cannot tolerate 500ms that a dashboard could accept.

### Alternative 3: Client-Side Measurement Only (S6→S9)

**Rejected because**: Misses 70%+ of latency sources (S1→S5). End-to-end visibility is critical for root cause analysis.

---

## Implementation Notes

### Phase 1: Instrumentation (Week 1-2)
- Add `TraceContext` to all stage interfaces
- Implement timestamp collection at each stage boundary
- Deploy metrics exporter (Prometheus + Grafana dashboards)

### Phase 2: Baseline Measurement (Week 3)
- Run production workload with 1% trace sampling
- Establish P50/P95/P99 baselines for each stage
- Identify budget violators

### Phase 3: Optimization (Week 4-6)
- Implement storage bypass for real-time tier
- Deploy server-side filtering in S4 Ingestion
- Add S8 batching with configurable window

### Phase 4: SLA Enforcement (Week 7+)
- Alert on budget violations exceeding 5% of samples
- Quarterly budget review and reallocation
- Continuous optimization based on production traces

---

## Related ADRs

- **S1 Physical**: Sensor sampling rates and encoding overhead contribute to S1 budget
- **S3 Transport**: Broker choice (MQTT vs NATS) directly impacts S3 latency
- **S5 Storage**: Async commit strategies affect whether storage is on critical path
- **S6 Client**: WebSocket vs SSE vs polling affects S6 RTT characteristics
- **S9 React**: Component memoization and virtualization affect S9 render budget

---

## References

- [Google SRE Book: SLIs, SLOs, and SLAs](https://sre.google/sre-book/service-level-objectives/)
- [Distributed Tracing Best Practices](https://opentelemetry.io/docs/concepts/observability-primer/)
- [React Concurrent Features and Batching](https://react.dev/reference/react/startTransition)
- [MQTT QoS and Latency Characteristics](https://www.hivemq.com/blog/mqtt-essentials-part-6-mqtt-quality-of-service-levels/)

---

**Status**: Draft — awaiting Prime review of budget allocations and optimization priorities.
