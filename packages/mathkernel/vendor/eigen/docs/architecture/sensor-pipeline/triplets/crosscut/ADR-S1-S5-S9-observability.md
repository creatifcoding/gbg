---
id: S1-S5-S9
title: "Physical ↔ Storage ↔ React — End-to-End Observability & Tracing"
commitHash: "6656064"
status: draft
date: 2026-01-02
tier: triplet-crosscut
stages:
  - S1-physical-ingestion
  - S5-storage-persistence
  - S9-react-presentation
concerns:
  - observability
  - distributed-tracing
  - performance-monitoring
  - debugging
authors:
  - Val
reviewers: []
---

# ADR S1-S5-S9: Physical ↔ Storage ↔ React — End-to-End Observability & Tracing

## Context

The TMNL pipeline transforms physical sensor readings into rendered React components across nine distinct stages. A single data point traverses:

1. **S1 (Physical Ingestion)**: Hardware sensor samples analog signal
2. **S2-S4 (Transformation)**: Normalization, validation, enrichment
3. **S5 (Storage Persistence)**: Write to DuckDB/SQLite
4. **S6-S8 (Distribution)**: NATS streaming, network transport
5. **S9 (React Presentation)**: Browser render, component mount

### The Observability Problem

**How do we trace a sensor reading from hardware capture to DOM render?**

Without instrumentation, debugging becomes impossible:

- **Latency mystery**: "Why does the temperature gauge lag 3 seconds?"
  - Is S1 sampling slow? S5 disk I/O? S9 React rendering?
  - Without per-stage timestamps, we're guessing.

- **Data loss investigation**: "Why did we miss 50 samples?"
  - Did S1 never capture them? S5 reject them? S9 never subscribe?
  - Without correlation IDs, we can't track individual samples.

- **Performance regression**: "Dashboard feels sluggish after last deploy"
  - Which stage regressed? S3 validation? S6 NATS publish? S8 WebSocket?
  - Without historical metrics, we can't compare baselines.

### Cross-Cutting Requirements

1. **End-to-end tracing**: Follow a single sensor reading through all 9 stages
2. **Latency attribution**: Measure time spent in each stage
3. **Distributed context**: Trace across process boundaries (Tauri → Server → Browser)
4. **Debug UI**: Visual waterfall showing trace timeline
5. **Production viability**: Low overhead, sampling strategies, opt-in verbosity

### Architectural Constraints

- **Heterogeneous runtime**: Rust (S1), TypeScript (S2-S9), Browser (S9)
- **Async boundaries**: Effect streams, NATS messages, WebSocket frames
- **Multi-tenant**: Multiple sensors, multiple clients, concurrent traces
- **Minimal overhead**: Cannot slow S1 (real-time constraint) or S9 (60fps rendering)

---

## Decision

We adopt a **correlation ID + timestamp chain + OpenTelemetry spans** strategy that flows trace context through all 9 stages.

### 1. Correlation ID Strategy

#### ID Generation at S1

Every sensor sample receives a unique trace identifier at the **moment of capture**:

```rust
// S1: Rust sensor capture
use uuid::Uuid;

struct SensorSample {
    trace_id: String,        // UUID v7 (time-ordered)
    sensor_id: String,       // e.g. "temp-sensor-01"
    timestamp_ns: i64,       // TAI64N timestamp
    value: f64,
}

fn capture_sample(sensor: &Sensor) -> SensorSample {
    SensorSample {
        trace_id: Uuid::now_v7().to_string(),
        sensor_id: sensor.id.clone(),
        timestamp_ns: precise_time_ns(),
        value: sensor.read(),
    }
}
```

**Why UUID v7?**
- Time-ordered (sortable by creation time)
- Globally unique (no coordination needed)
- Fits in DuckDB string columns

#### ID Propagation Through Pipeline

Each stage **preserves** the `trace_id` field:

```typescript
// S2: Normalization preserves trace_id
const normalize = (raw: S1.SensorSample): S2.NormalizedSample => ({
  trace_id: raw.trace_id,  // PRESERVED
  sensor_id: raw.sensor_id,
  timestamp_ns: raw.timestamp_ns,
  value: raw.value * calibration_factor,
  unit: 'celsius',
})

// S5: Storage writes trace_id to DuckDB
CREATE TABLE sensor_samples (
  trace_id VARCHAR PRIMARY KEY,
  sensor_id VARCHAR NOT NULL,
  timestamp_ns BIGINT NOT NULL,
  value DOUBLE NOT NULL,
  -- ... additional columns
  INDEX idx_trace_id (trace_id)
)

// S9: React can query by trace_id
const traceSample = (traceId: string) =>
  Effect.gen(function* () {
    const db = yield* DuckDBService
    return yield* db.query(
      `SELECT * FROM sensor_samples WHERE trace_id = ?`,
      [traceId]
    )
  })
```

#### Span Hierarchy

Each stage creates a child span:

```
Trace: 01936a2f-8b4e-7890-abcd-ef1234567890
├─ S1:capture [0ms → 5ms]
├─ S2:normalize [5ms → 8ms]
├─ S3:validate [8ms → 12ms]
├─ S4:enrich [12ms → 18ms]
├─ S5:persist [18ms → 45ms]  ← Disk I/O spike
├─ S6:publish [45ms → 48ms]
├─ S7:transport [48ms → 155ms]  ← Network latency
├─ S8:deserialize [155ms → 158ms]
└─ S9:render [158ms → 172ms]

Total latency: 172ms (SLA: <200ms)
Bottleneck: S7 (107ms network)
```

---

### 2. Timestamp Chain

We collect **four critical timestamps** at each stage:

```typescript
interface StageTimestamps {
  stage_id: StageId           // 'S1' | 'S2' | ... | 'S9'
  entry_ns: bigint            // Nanoseconds since epoch (entry)
  exit_ns: bigint             // Nanoseconds since epoch (exit)
  clock_source: ClockSource   // 'tai64n' | 'system' | 'performance.now'
}

type ClockSource =
  | 'tai64n'           // S1: Rust precise hardware clock
  | 'system'           // S2-S8: Node.js process.hrtime.bigint()
  | 'performance.now'  // S9: Browser performance.now()
```

#### Cross-Clock Correlation

Different stages use different clocks:

| Stage | Clock | Precision | Synchronization |
|-------|-------|-----------|-----------------|
| S1 | TAI64N | Nanosecond | NTP-synced system clock |
| S2-S8 | `process.hrtime.bigint()` | Nanosecond | Monotonic (no drift) |
| S9 | `performance.now()` | Microsecond | Browser monotonic |

**Challenge**: Comparing timestamps across clock domains.

**Solution**: Calculate **relative latencies** within each domain, then sum:

```typescript
interface LatencyBreakdown {
  s1_capture_us: number        // S1 internal (TAI64N)
  s2_to_s5_us: number          // Server-side (hrtime)
  s5_persist_us: number        // Disk I/O (hrtime)
  s6_to_s8_us: number          // Network (hrtime → perf.now)
  s9_render_us: number         // Browser (perf.now)
  total_us: number             // Sum of above
}

const calculateLatency = (timestamps: StageTimestamps[]): LatencyBreakdown => {
  const byStage = Object.fromEntries(
    timestamps.map(t => [t.stage_id, t])
  )

  return {
    s1_capture_us: Number(byStage.S1.exit_ns - byStage.S1.entry_ns) / 1000,
    s2_to_s5_us: Number(byStage.S5.entry_ns - byStage.S2.entry_ns) / 1000,
    s5_persist_us: Number(byStage.S5.exit_ns - byStage.S5.entry_ns) / 1000,
    s6_to_s8_us: Number(byStage.S8.exit_ns - byStage.S6.entry_ns) / 1000,
    s9_render_us: Number(byStage.S9.exit_ns - byStage.S9.entry_ns) / 1000,
    total_us: /* sum of above */
  }
}
```

#### Timestamp Storage Schema

S5 persists timestamps for historical analysis:

```sql
CREATE TABLE trace_timestamps (
  trace_id VARCHAR REFERENCES sensor_samples(trace_id),
  stage_id VARCHAR NOT NULL,
  entry_ns BIGINT NOT NULL,
  exit_ns BIGINT NOT NULL,
  clock_source VARCHAR NOT NULL,
  metadata JSON,  -- Stage-specific context
  PRIMARY KEY (trace_id, stage_id)
)

-- Query: Find slowest S5 persists in last hour
SELECT trace_id, (exit_ns - entry_ns) / 1000 AS persist_us
FROM trace_timestamps
WHERE stage_id = 'S5'
  AND entry_ns > (extract(epoch from now()) * 1e9) - 3600e9
ORDER BY persist_us DESC
LIMIT 10
```

---

### 3. Distributed Tracing with OpenTelemetry

We use **OpenTelemetry** for industry-standard tracing:

#### Span Context Propagation

```typescript
import { trace, context, propagation } from '@opentelemetry/api'
import { W3CTraceContextPropagator } from '@opentelemetry/core'

// S1: Rust creates root span, injects into headers
// (via opentelemetry-rust crate)
let tracer = global::tracer("sensor-capture");
let mut span = tracer.start("S1:capture");
span.set_attribute("sensor.id", sensor_id);

let mut headers = HashMap::new();
propagation::inject_context(&span.context(), &mut headers);
// headers now contains: traceparent: 00-{trace_id}-{span_id}-01

// S2: TypeScript extracts context, creates child span
const parentContext = propagation.extract(context.active(), headers)
const s2Span = trace.getTracer('normalization')
  .startSpan('S2:normalize', { parent: parentContext })

s2Span.setAttribute('value.raw', raw.value)
s2Span.setAttribute('value.normalized', normalized.value)
s2Span.end()

// S5: Storage span with database attributes
const s5Span = trace.getTracer('persistence')
  .startSpan('S5:persist', { parent: s2Span.context() })

s5Span.setAttribute('db.system', 'duckdb')
s5Span.setAttribute('db.statement', 'INSERT INTO sensor_samples ...')
s5Span.end()

// S6: NATS span propagates via message headers
const s6Span = trace.getTracer('messaging')
  .startSpan('S6:publish', { parent: s5Span.context() })

const natsHeaders = nats.headers()
propagation.inject(context.active(), natsHeaders)
await nc.publish('sensors.readings', payload, { headers: natsHeaders })
s6Span.end()

// S9: Browser span for React render
const s9Span = trace.getTracer('presentation')
  .startSpan('S9:render', { parent: extractedContext })

s9Span.setAttribute('component.type', 'SensorGauge')
s9Span.setAttribute('render.duration_ms', renderTime)
s9Span.end()
```

#### Exporter Configuration

```typescript
// Server-side: Export to Jaeger/Tempo
import { JaegerExporter } from '@opentelemetry/exporter-jaeger'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'

const exporter = new JaegerExporter({
  endpoint: 'http://localhost:14268/api/traces',
})

tracerProvider.addSpanProcessor(
  new BatchSpanProcessor(exporter, {
    maxQueueSize: 2048,
    maxExportBatchSize: 512,
    scheduledDelayMillis: 5000,  // Batch every 5s
  })
)

// Browser: Export to collector via HTTP
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const browserExporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces',
})
```

#### Sampling Strategy

To minimize overhead, we use **adaptive sampling**:

```typescript
import { TraceIdRatioBasedSampler, ParentBasedSampler } from '@opentelemetry/sdk-trace-base'

const sampler = new ParentBasedSampler({
  root: new TraceIdRatioBasedSampler(0.1),  // Sample 10% of root spans
})

// Always sample if parent was sampled (maintains full traces)
// In production: 10% of sensor readings traced end-to-end
// In dev: 100% sampling via environment variable
const samplingRate = process.env.OTEL_SAMPLING_RATE || '0.1'
```

---

### 4. Debug UI Integration

S9 provides a **TraceWaterfall** component for visual debugging:

#### Component API

```typescript
import { TraceWaterfall } from '@/lib/observability/components/TraceWaterfall'

// Usage in sensor dashboard
<SensorGauge
  value={reading.value}
  traceId={reading.trace_id}  // Attach trace ID to reading
/>

// Click gauge → open trace waterfall
const [selectedTrace, setSelectedTrace] = useState<string | null>(null)

<Dialog open={!!selectedTrace}>
  <TraceWaterfall traceId={selectedTrace!} />
</Dialog>
```

#### Waterfall Visualization

```typescript
interface TraceSpan {
  stage_id: StageId
  start_ms: number      // Relative to trace start
  duration_ms: number
  attributes: Record<string, unknown>
  events: TraceEvent[]
}

const TraceWaterfall: React.FC<{ traceId: string }> = ({ traceId }) => {
  const spans = useAtomValue(traceSpansAtom(traceId))
  const maxDuration = Math.max(...spans.map(s => s.start_ms + s.duration_ms))

  return (
    <div className="trace-waterfall">
      <Timeline maxMs={maxDuration} />
      {spans.map(span => (
        <SpanBar
          key={span.stage_id}
          span={span}
          maxMs={maxDuration}
          onClick={() => setSelectedSpan(span)}
        />
      ))}
      {selectedSpan && <SpanDetails span={selectedSpan} />}
    </div>
  )
}

// SpanBar: Horizontal bar showing duration
const SpanBar: React.FC<{ span: TraceSpan, maxMs: number }> = ({ span, maxMs }) => {
  const leftPct = (span.start_ms / maxMs) * 100
  const widthPct = (span.duration_ms / maxMs) * 100

  return (
    <div className="span-row">
      <div className="span-label">{span.stage_id}</div>
      <div className="span-timeline">
        <div
          className="span-bar"
          style={{
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            backgroundColor: getStageColor(span.stage_id),
          }}
        >
          {span.duration_ms.toFixed(2)}ms
        </div>
      </div>
    </div>
  )
}
```

#### Latency Highlighting

Automatically highlight bottlenecks:

```typescript
const getStageColor = (span: TraceSpan): string => {
  const { duration_ms } = span

  // Color by latency budget
  if (duration_ms > 100) return 'var(--tmnl-status-error)'      // Red
  if (duration_ms > 50) return 'var(--tmnl-status-warning)'     // Yellow
  if (duration_ms > 20) return 'var(--tmnl-status-info)'        // Blue
  return 'var(--tmnl-status-success)'                            // Green
}

// Show latency budget exceeded badge
{span.duration_ms > latencyBudgets[span.stage_id] && (
  <Badge variant="error">
    Over budget by {(span.duration_ms - latencyBudgets[span.stage_id]).toFixed(1)}ms
  </Badge>
)}
```

#### Drill-Down Details

Click a span to see full context:

```typescript
const SpanDetails: React.FC<{ span: TraceSpan }> = ({ span }) => (
  <Card>
    <CardHeader>
      <CardTitle>{span.stage_id} Details</CardTitle>
    </CardHeader>
    <CardContent>
      <dl>
        <dt>Duration</dt>
        <dd>{span.duration_ms.toFixed(3)}ms</dd>

        <dt>Attributes</dt>
        <dd><pre>{JSON.stringify(span.attributes, null, 2)}</pre></dd>

        <dt>Events</dt>
        <dd>
          {span.events.map(evt => (
            <div key={evt.timestamp}>
              <strong>{evt.name}</strong> at {evt.timestamp}ms
              <pre>{JSON.stringify(evt.attributes, null, 2)}</pre>
            </div>
          ))}
        </dd>
      </dl>
    </CardContent>
  </Card>
)
```

---

### 5. Metrics & Alerting

#### Per-Stage Latency Percentiles

```typescript
// Metrics collection via OpenTelemetry Metrics API
import { metrics } from '@opentelemetry/api'

const meter = metrics.getMeter('tmnl-pipeline')

const stageLatencyHistogram = meter.createHistogram('stage.latency', {
  description: 'Latency distribution per pipeline stage',
  unit: 'ms',
})

// Record latency after each stage
stageLatencyHistogram.record(duration_ms, {
  'stage.id': 'S5',
  'sensor.id': sensorId,
})

// Prometheus query for P95 latency
histogram_quantile(0.95,
  sum(rate(stage_latency_bucket[5m])) by (stage_id, le)
)
```

#### Latency Budget Monitoring

```typescript
const LATENCY_BUDGETS: Record<StageId, number> = {
  S1: 5,      // 5ms max for sensor capture
  S2: 3,      // 3ms normalization
  S3: 5,      // 5ms validation
  S4: 10,     // 10ms enrichment
  S5: 30,     // 30ms disk write
  S6: 5,      // 5ms NATS publish
  S7: 100,    // 100ms network transport
  S8: 5,      // 5ms deserialize
  S9: 16,     // 16ms render (60fps budget)
}

// Alert if P95 exceeds budget
ALERT StageTooSlow
  IF histogram_quantile(0.95, stage_latency_bucket) > LATENCY_BUDGETS[stage_id]
  FOR 5m
  LABELS { severity="warning" }
  ANNOTATIONS {
    summary="Stage {{$labels.stage_id}} P95 latency exceeds budget",
    description="P95={{$value}}ms, budget={{LATENCY_BUDGETS[$labels.stage_id]}}ms"
  }
```

#### End-to-End SLA

```typescript
// Total trace duration (S1 entry → S9 exit)
const traceLatencyHistogram = meter.createHistogram('trace.latency.total', {
  description: 'End-to-end latency from sensor capture to browser render',
  unit: 'ms',
})

// SLA: 95% of traces complete within 200ms
ALERT EndToEndSLAViolation
  IF histogram_quantile(0.95, trace_latency_total_bucket) > 200
  FOR 10m
  LABELS { severity="page" }
  ANNOTATIONS {
    summary="End-to-end P95 latency exceeds 200ms SLA",
    description="P95={{$value}}ms (target: <200ms)"
  }
```

#### Data Loss Detection

```typescript
// Count samples at each stage
const stageThroughputCounter = meter.createCounter('stage.samples.count', {
  description: 'Number of samples processed per stage',
})

stageThroughputCounter.add(1, { 'stage.id': 'S1', 'sensor.id': sensorId })

// Alert if S9 count < S1 count (data loss)
ALERT DataLoss
  IF (
    sum(rate(stage_samples_count{stage_id="S1"}[5m]))
    - sum(rate(stage_samples_count{stage_id="S9"}[5m]))
  ) > 10
  FOR 5m
  LABELS { severity="critical" }
  ANNOTATIONS {
    summary="Pipeline losing >10 samples/sec",
    description="S1 rate={{$labels.s1_rate}}, S9 rate={{$labels.s9_rate}}"
  }
```

---

## Interfaces

### TraceContext Schema

```typescript
import { Schema } from '@effect/schema'

const ClockSource = Schema.Literal('tai64n', 'system', 'performance.now')
const StageId = Schema.Literal('S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9')

const StageTimestamp = Schema.Struct({
  stage_id: StageId,
  entry_ns: Schema.BigInt,
  exit_ns: Schema.BigInt,
  clock_source: ClockSource,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})

const TraceContext = Schema.TaggedStruct('TraceContext')({
  trace_id: Schema.String.pipe(Schema.brand('TraceId')),
  span_id: Schema.String.pipe(Schema.brand('SpanId')),
  parent_span_id: Schema.optional(Schema.String.pipe(Schema.brand('SpanId'))),
  timestamps: Schema.Array(StageTimestamp),
  attributes: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
})

type TraceContext = Schema.Schema.Type<typeof TraceContext>
```

### DebugOverlay Component

```typescript
interface TraceWaterfallProps {
  traceId: string
  onClose?: () => void
  highlightStage?: StageId
}

export const TraceWaterfall: React.FC<TraceWaterfallProps>

interface SpanBarProps {
  span: TraceSpan
  maxMs: number
  onClick?: (span: TraceSpan) => void
}

export const SpanBar: React.FC<SpanBarProps>

interface SpanDetailsProps {
  span: TraceSpan
  showAttributes?: boolean
  showEvents?: boolean
}

export const SpanDetails: React.FC<SpanDetailsProps>
```

### Service API

```typescript
class ObservabilityService extends Effect.Service<ObservabilityService>()('ObservabilityService', {
  effect: Effect.gen(function* () {
    const tracer = trace.getTracer('tmnl-pipeline')

    return {
      // Start a new trace at S1
      startTrace: (sensorId: string) => Effect.gen(function* () {
        const span = tracer.startSpan('S1:capture')
        span.setAttribute('sensor.id', sensorId)
        const traceId = span.spanContext().traceId
        return { traceId, span }
      }),

      // Continue trace in subsequent stage
      continueTrace: (traceId: string, stageId: StageId) => Effect.gen(function* () {
        const parentContext = /* extract from storage/headers */
        const span = tracer.startSpan(`${stageId}:process`, { parent: parentContext })
        return { span }
      }),

      // Query trace by ID
      getTrace: (traceId: string) => Effect.gen(function* () {
        const db = yield* DuckDBService
        const timestamps = yield* db.query(
          `SELECT * FROM trace_timestamps WHERE trace_id = ? ORDER BY entry_ns`,
          [traceId]
        )
        return TraceContext.make({ trace_id: traceId, timestamps })
      }),

      // Calculate latency breakdown
      analyzeLatency: (traceId: string) => Effect.gen(function* () {
        const trace = yield* this.getTrace(traceId)
        return calculateLatency(trace.timestamps)
      }),
    }
  }),
}) {}
```

---

## Consequences

### Benefits

1. **Full Visibility**
   - Trace any sensor reading from capture to render
   - Pinpoint latency bottlenecks to exact stage
   - Historical analysis of performance trends

2. **Production Debugging**
   - User reports "lag" → pull trace → see S7 network spike
   - No reproduction needed, traces are always-on (sampled)

3. **SLA Enforcement**
   - Automated alerts on latency budget violations
   - P95/P99 tracking per stage
   - Data loss detection via sample counts

4. **Developer Experience**
   - Visual waterfall in dev tools
   - Click reading → see full pipeline journey
   - Attributes/events show exactly what happened

### Costs

1. **Storage Overhead**
   - ~200 bytes per trace (9 timestamps + metadata)
   - At 10% sampling, 1000 samples/sec → 20KB/sec → 1.7GB/day
   - Retention policy needed (e.g., 30 days)

2. **Runtime Overhead**
   - Span creation: ~1-5μs per stage
   - Timestamp capture: ~100ns (negligible)
   - Batch export: ~5ms every 5 seconds (background)

3. **Complexity**
   - OpenTelemetry SDK configuration
   - Clock synchronization across domains
   - Propagation through NATS/WebSocket

### Mitigations

- **Adaptive sampling**: 10% in prod, 100% in dev
- **Async export**: Batch spans every 5s, non-blocking
- **Retention**: Auto-delete traces older than 30 days
- **Opt-in verbosity**: Span attributes disabled by default, enabled via query param

---

## Alternatives Considered

### 1. Manual Logging

**Rejected**: No correlation between stages, grep-based debugging, no waterfall view.

### 2. Custom Trace Format

**Rejected**: Reinventing OpenTelemetry, no ecosystem tooling (Jaeger/Tempo), harder to hire for.

### 3. Client-Side Only Tracing

**Rejected**: Loses S1-S8 visibility, can't diagnose backend bottlenecks.

---

## Implementation Notes

### Phase 1: Correlation IDs (Week 1)
- Add `trace_id` to S1 sensor samples
- Propagate through S2-S9
- DuckDB schema migration for `trace_timestamps` table

### Phase 2: Timestamps (Week 2)
- Instrument entry/exit points in each stage
- Store in DuckDB
- Query API for latency breakdown

### Phase 3: OpenTelemetry (Week 3)
- Install SDKs (Rust, Node, Browser)
- Configure Jaeger exporter
- Verify span hierarchy in Jaeger UI

### Phase 4: Debug UI (Week 4)
- Build `TraceWaterfall` component
- Integrate into sensor dashboard
- Add latency highlighting

### Phase 5: Metrics & Alerts (Week 5)
- Prometheus exporter
- Grafana dashboards
- Alertmanager rules

---

## References

- OpenTelemetry Specification: https://opentelemetry.io/docs/specs/otel/
- Jaeger Architecture: https://www.jaegertracing.io/docs/1.50/architecture/
- W3C Trace Context: https://www.w3.org/TR/trace-context/
- DuckDB Time-Series: https://duckdb.org/docs/sql/data_types/timestamp
- Effect Tracing: (check `../../submodules/effect` for examples)

---

## Approval

- [ ] Prime review
- [ ] Performance validation (overhead <1% P99 latency)
- [ ] Storage capacity plan (30-day retention)
- [ ] Runbook for trace debugging

---

*ADR authored by Val, TMNL's Vigilant Architecture Layer*
