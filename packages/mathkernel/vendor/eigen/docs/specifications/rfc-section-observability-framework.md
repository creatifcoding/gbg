# RFC-001 Section: Observability Framework

```
Section:       Observability Framework
Parent RFC:    RFC-001 (Entity Lifecycle Event Distribution)
Part:          V -- Operations
Status:        DRAFT
Author:        Val (temporal-analyst)
Created:       2026-02-09
Bibliography:  docs/specifications/bibliography.md
Codebase Root: packages/tmnl/src/
```

> This section specifies the observability framework for a metropolitan-scale IIoT
> platform serving 200K+ organizations. Observability enables **understanding** of
> system behavior through distributed traces, structured metrics, and correlated
> logs. Observability is distinct from monitoring (Section: Monitoring Infrastructure),
> which concerns **detection** of problems through health checks, SLO enforcement,
> and alerting.

---

## OBS.1 Scope

This section defines the NORMATIVE requirements for observing the entity lifecycle
event distribution infrastructure specified in RFC-001. The observability framework
provides three signal types:

1. **Traces** -- Distributed traces that follow an event from edge device ingestion
   through entity processing, state machine transitions, event distribution, and
   WebSocket delivery to subscribers.
2. **Metrics** -- Time-series data capturing throughput, latency, error rates, and
   capacity utilization with dimensional labels for drill-down.
3. **Logs** -- Structured, correlated log records that attach to trace context for
   post-hoc investigation.

The observability framework operates across three sovereignty domains:

- **Sovereign observability** (per-organization) -- An organization's traces and
  metrics for their own entities. MUST be observable on the local edge device even
  during cloud partition.
- **Platform observability** (aggregated) -- Anonymized metrics across all
  organizations for capacity planning and SLA verification.
- **Infrastructure observability** (internal) -- NATS cluster, @effect/cluster
  runner, and database telemetry. Not exposed to tenant organizations.

### OBS.1.1 Relationship to Other Sections

| Section | Relationship |
|---------|-------------|
| Monitoring Infrastructure | Complementary -- monitoring detects, observability explains |
| Consistency Guarantees | Observability verifies G-1 through G-8 compliance |
| Effect-TS Implementation Architecture | Effect.withSpan, Metric.*, Tracer.* form the native substrate |
| Security, Trust & Tenant Isolation | Trace context MUST NOT leak across org boundaries |
| Edge-First Architecture | Edge devices run local OTLP collectors |

---

## OBS.2 Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD",
"SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be
interpreted as described in [RFC2119] and [RFC8174].

### OBS.2.1 Terminology

| Term | Definition |
|------|-----------|
| **Span** | A unit of work within a distributed trace, with start time, end time, status, and attributes |
| **Trace** | A directed acyclic graph of spans representing a complete operation across services |
| **Trace context** | The W3C Trace Context headers (traceparent, tracestate) propagated across process boundaries |
| **OTLP** | OpenTelemetry Protocol -- the wire format for exporting traces, metrics, and logs |
| **Collector** | An OpenTelemetry Collector instance that receives, processes, and exports telemetry |
| **Sampling** | The decision to record or drop a trace, made at the head (creation) or tail (completion) |
| **Exemplar** | A trace ID attached to a metric data point, linking metrics to traces |
| **Cardinality** | The number of unique label combinations for a metric; high cardinality degrades storage and query performance |

---

## OBS.3 OpenTelemetry Integration Architecture

### OBS.3.1 Signal Pipeline

The platform MUST use OpenTelemetry [OTEL] as the observability wire format.
Effect-TS provides native integration via `@effect/opentelemetry` [EFFECT-TS].

```
Edge Device                    Cloud Cluster                  Backends
+-----------------+           +-------------------+           +------------------+
| Effect Runtime  |           | Effect Runtime    |           | Trace Storage    |
| + @effect/otel  |           | + @effect/otel    |           | (Jaeger/Tempo)   |
|                 |           |                   |           |                  |
| Effect.withSpan |    OTLP   | Effect.withSpan   |    OTLP   | Metric Storage   |
| Metric.*        |---------->| Metric.*          |---------->| (Prometheus/     |
| Tracer.*        |  (gRPC/   | Tracer.*          |  (gRPC)   |  Mimir/VictoriaM)|
|                 |   HTTP)   |                   |           |                  |
| Local Collector |           | Central Collector |           | Log Storage      |
| (mini-OTLP)    |           | (full OTLP)       |           | (Loki/ClickHouse)|
+-----------------+           +-------------------+           +------------------+
       |                              |
       | Buffered during              | Real-time export
       | partition (local disk)       |
```

### OBS.3.2 Effect-TS Native Integration

The codebase already uses `Effect.withSpan` extensively (137 occurrences across
28 files per `lib/instrumentation/ARCHITECTURE.md` audit). The observability
framework extends this existing pattern rather than replacing it.

**Existing patterns (VERIFIED in codebase)**:

| Pattern | File | Description |
|---------|------|-------------|
| `Effect.withSpan` | 137 occurrences in 28 files | Native span creation in Effect runtime |
| `Metric.histogram` | `lib/geoint/api/tracing.ts:63-66` | Exponential histogram with boundaries |
| `Metric.counter` | `lib/geoint/api/tracing.ts:71,76` | Request and error counters |
| `Metric.gauge` | `lib/holonet/durable-streams/metrics/tracing.ts:106-111` | Active connection gauges |
| `Metric.tagged` | `lib/geoint/api/tracing.ts:84-89` | Dimensional labeling |
| `withApiTracing` HOF | `lib/geoint/api/tracing.ts:152-181` | Higher-order tracing wrapper |
| `withDsTracing` HOF | `lib/holonet/durable-streams/metrics/tracing.ts:277-299` | Stream operation tracing |
| `ApiMetricsService` | `lib/geoint/api/metrics-export.ts:145-148` | Periodic snapshot collection |
| `snapshotToPrometheus` | `lib/geoint/api/metrics-export.ts:328-359` | Prometheus exposition format |
| `InstrumentationService` | `lib/instrumentation/v1/services/InstrumentationService.ts` | Span capture with NATS persistence |

**Extension for IIoT**: The `withApiTracing` pattern at `lib/geoint/api/tracing.ts`
MUST be extended to create `withEntityTracing` and `withPipelineTracing`
higher-order functions for IIoT entity and pipeline operations.

### OBS.3.3 @effect/opentelemetry Layer Composition

Implementations MUST provide an OpenTelemetry layer that bridges Effect's native
tracing to OTLP export:

```typescript
// Normative: OpenTelemetry bridge layer
import { NodeSdk } from '@effect/opentelemetry'

const OTelLayer = NodeSdk.layer(() => ({
  resource: {
    serviceName: 'tmnl-iiot',
    serviceVersion: version,
    'deployment.environment': environment,
    'tmnl.node.role': nodeRole,         // 'edge' | 'hub' | 'runner'
    'tmnl.org.id': orgId,              // Organization context
  },
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({ url: otlpEndpoint })
  ),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: otlpEndpoint }),
    exportIntervalMillis: 15000,        // 15s for production
  }),
}))
```

**Codebase reference**: The instrumentation architecture at
`lib/instrumentation/ARCHITECTURE.md:268-289` defines the production OTel layer
pattern with `NodeSdk.layer`, `BatchSpanProcessor`, and `OTLPTraceExporter`.

---

## OBS.4 Distributed Tracing

### OBS.4.1 Trace Scopes

Implementations MUST create traces for the following operation categories. Each
trace captures a complete unit of work from initiation to terminal state.

#### OBS.4.1.1 Entity State Transition Trace

Captures a single entity state transition from event receipt to state machine
completion and downstream propagation.

| Attribute | Type | Description |
|-----------|------|-------------|
| `tmnl.trace.type` | string | `entity.state_transition` |
| `tmnl.org.id` | string | Organization identifier |
| `tmnl.entity.type` | string | ISA-95 entity type (Site, Plant, Area, ...) |
| `tmnl.entity.id` | string | Entity identifier |
| `tmnl.state.from` | string | Previous state |
| `tmnl.state.to` | string | New state |
| `tmnl.isa95.level` | number | ISA-95 hierarchy level (0-4) |

**Span tree**:

```
entity.state_transition (root span)
+-- entity.event_received            // Event enters entity handler
|   +-- entity.schema_validation     // Schema.decodeUnknown
+-- entity.state_machine             // XState/Effect Machine transition
|   +-- entity.guard_evaluation      // State machine guard check
|   +-- entity.effect_execution      // Side effect of transition
+-- entity.event_persistence         // EventLog write (JetStream)
+-- entity.propagation               // ISA-95 hierarchy propagation
|   +-- entity.parent_notification   // Upward: child -> parent
|   +-- entity.child_notification    // Downward: parent -> children
+-- entity.event_distribution        // ChannelService + HolonetBridge
    +-- channel.local_publish        // PubSub.publish to local outlet
    +-- holonet.nats_publish         // NATS publish via HolonetBridge
```

**Codebase reference**: Entity handlers at `lib/iiot/entity/EntityStack.ts:54-67`
define the 12 entity handler layers where tracing middleware MUST be injected.
State machines at `lib/iiot/machines/` (SiteMachine.ts, PlantMachine.ts, etc.)
govern transitions. EventDistribution at
`lib/iiot/realtime/event-distribution.ts:280-326` handles dual-publish.

#### OBS.4.1.2 Ingestion Pipeline Trace

Captures the full path from Sparkplug-B message receipt to entity handler dispatch.

| Attribute | Type | Description |
|-----------|------|-------------|
| `tmnl.trace.type` | string | `pipeline.ingestion` |
| `tmnl.sparkplug.topic` | string | Full MQTT topic |
| `tmnl.sparkplug.message_type` | string | BIRTH, DATA, DEATH, STATE |
| `tmnl.sparkplug.group_id` | string | Sparkplug group identifier |
| `tmnl.sparkplug.node_id` | string | Sparkplug node identifier |

**Span tree**:

```
pipeline.ingestion (root span)
+-- sparkplug.message_received       // MQTT message arrives
+-- sparkplug.topic_parse            // TopicRouter extracts metadata
+-- sparkplug.payload_decode         // Protobuf decode
+-- reading_processor.process        // ReadingProcessor transforms
|   +-- reading_processor.validate   // Schema validation
|   +-- reading_processor.enrich     // Add entity context
+-- alarm_detector.evaluate          // AlarmDetector threshold check
|   +-- alarm_detector.trigger       // If threshold exceeded
+-- entity.dispatch                  // Route to entity handler
```

**Codebase reference**: `SparkplugPipelineLayer` at
`lib/iiot/adapters/ingestion-service.ts:297-322` composes
SparkplugAdapterLive + TopicRouter + ReadingProcessor + AlarmDetector.

#### OBS.4.1.3 WebSocket Subscription Trace

Captures a subscriber session from connection through event delivery.

| Attribute | Type | Description |
|-----------|------|-------------|
| `tmnl.trace.type` | string | `subscription.websocket` |
| `tmnl.session.id` | string | WebSocket session identifier |
| `tmnl.subscription.channel` | string | readings, alarms, equipment, invalidations |
| `tmnl.subscription.filter` | string | Entity filter expression |

**Span tree**:

```
subscription.websocket (root span, long-lived)
+-- ws.connection_established        // WebSocket upgrade
+-- ws.authentication                // JWT/NATS credential validation
+-- rpc.subscribe_request            // RPC request decoded
+-- channel.outlet_attached          // ChannelService outlet subscription
+-- event.delivery[0..N]             // Individual event deliveries
    +-- event.serialize              // Schema.encode to JSON
    +-- event.transport              // WebSocket frame send
```

**Codebase reference**: WebSocket server at `lib/iiot/realtime/websocket-server.ts`.
Streaming RPCs at `lib/iiot/rpc/RealtimeRpcs.ts` define the 4 subscription
endpoints: `Realtime.SubscribeReadings`, `Realtime.SubscribeAlarms`,
`Realtime.SubscribeEquipmentState`, `Realtime.SubscribeInvalidations`.

#### OBS.4.1.4 Cross-Organization Saga Trace

Captures a marketplace work order saga across organizational boundaries.

| Attribute | Type | Description |
|-----------|------|-------------|
| `tmnl.trace.type` | string | `saga.work_order` |
| `tmnl.saga.id` | string | Saga correlation identifier |
| `tmnl.saga.requesting_org` | string | Organization that posted the work order |
| `tmnl.saga.executing_org` | string | Organization executing the job |
| `tmnl.saga.status` | string | Current saga step |

**CRITICAL**: Cross-org traces MUST be **privacy-preserving**. The requesting
organization MUST NOT see the executing organization's internal entity traces,
and vice versa. The saga trace captures only the cross-boundary events:

```
saga.work_order (root span)
+-- saga.work_order_posted           // Requesting org posts WO
+-- saga.capability_match            // Network matches capabilities
+-- saga.bid_submitted               // Executing org submits bid
+-- saga.work_order_accepted         // Requesting org accepts bid
+-- saga.job_started                 // Executing org starts work
+-- saga.job_completed               // Executing org completes work
+-- saga.quality_verified            // Requesting org verifies quality
```

Each span in the saga trace records only the **network-level event**, not the
internal entity state transitions within either organization.

#### OBS.4.1.5 Reconciliation Trace

Captures the partition recovery and event reconciliation process when an edge
device reconnects after being offline.

| Attribute | Type | Description |
|-----------|------|-------------|
| `tmnl.trace.type` | string | `reconciliation` |
| `tmnl.org.id` | string | Organization identifier |
| `tmnl.partition.duration_s` | number | Seconds device was offline |
| `tmnl.partition.buffered_events` | number | Events buffered during partition |

**Span tree**:

```
reconciliation (root span)
+-- partition.detected               // Heartbeat timeout exceeded
+-- partition.edge_buffer_replay     // Edge replays buffered events
|   +-- replay.batch[0..N]          // Batched replay (1000 events/batch)
+-- partition.sequence_audit         // Verify no sequence gaps
+-- partition.state_convergence      // Confirm entity states match
+-- partition.advisory_cleared       // OrgStale advisory removed
```

### OBS.4.2 Trace Context Propagation

#### OBS.4.2.1 Intra-Organization Propagation

Within a single organization, trace context MUST be propagated using W3C Trace
Context headers [W3C-TRACE-CONTEXT]:

| Boundary | Propagation Method |
|----------|-------------------|
| Effect fiber to fiber | Automatic via Effect runtime (parent-child spans) |
| NATS publish/subscribe | `traceparent` header in NATS message headers |
| JetStream producer/consumer | `traceparent` header in JetStream message metadata |
| WebSocket frames | `traceparent` field in JSON payload envelope |
| HTTP requests | `traceparent` and `tracestate` HTTP headers |

**Codebase reference**: NATS connection at `lib/holonet/nats/hub.ts`. Message
headers MUST include trace context for all IIoT subject publications defined at
`lib/iiot/realtime/iiot-subjects.ts`.

#### OBS.4.2.2 Cross-Organization Propagation

Trace context MUST NOT propagate across organization boundaries without explicit
consent. When an event crosses an org boundary (via the anti-corruption layer):

1. The originating org's trace is **terminated** at the anti-corruption layer.
2. A **new trace** is created on the receiving side with a `tmnl.saga.id`
   correlation attribute linking it to the originating event.
3. The originating org's internal span IDs, trace IDs, and entity identifiers
   MUST NOT appear in the receiving org's trace.

This ensures that tracing does not become a vector for cross-tenant information
leakage [NATS-ACCOUNTS].

### OBS.4.3 Sampling Strategy

At 200K organizations producing millions of events per second, full trace
capture is economically infeasible. Implementations MUST implement a tiered
sampling strategy:

| Tier | Scope | Sample Rate | Rationale |
|------|-------|-------------|-----------|
| **Always** | G-1 through G-7 violations | 100% | Every consistency violation is traced |
| **Always** | Cross-org saga events | 100% | Economic transactions require full audit trail |
| **Always** | Reconciliation events | 100% | Partition recovery must be fully observable |
| **Always** | Error/failure spans | 100% | All errors are captured regardless of head sampling |
| **High** | Alarm events (ISA-18.2) | 50% | Regulatory traceability requires high coverage |
| **Medium** | Entity state transitions | 10% | Sufficient for latency profiling |
| **Low** | Sensor readings (telemetry) | 1% | High volume; statistical sampling suffices |
| **Tail** | Long-latency operations | 100% of P99+ | Tail-based sampling captures outliers |

**Implementation**: Head-based sampling decisions MUST be made at the trace root
(ingestion point). Tail-based sampling SHOULD be implemented at the collector
level, where the complete trace can be evaluated before export.

**Edge device consideration**: Edge devices with constrained resources (Tier 1:
1-10 machines) MAY reduce sampling rates by 50% during high-load periods. The
sampling decision MUST be recorded as a span attribute so that metric aggregations
can compensate for under-sampling.

---

## OBS.5 Consistency Guarantee Verification

The observability framework MUST provide continuous verification of the eight
formal consistency guarantees defined in the Two-Domain Consistency Model section.

### OBS.5.1 G-1: Per-Entity Sequential Ordering

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g1.violations` (Counter) |
| **Detection** | Sequence number gap detection: if `seq(N+1) - seq(N) != 1`, increment counter |
| **Trace annotation** | Every violation creates a `guarantee.g1.violation` span with the entity ID, expected sequence, and actual sequence |
| **Alert threshold** | > 0 violations per 5-minute window (any violation is critical) |
| **Verification query** | `SELECT COUNT(*) FROM spans WHERE name = 'guarantee.g1.violation' AND time > now() - 5m` |
| **Codebase ref** | Entity handlers in `lib/iiot/entity/EntityStack.ts:54-67` -- each handler layer MUST inject sequence validation middleware |

### OBS.5.2 G-2: Per-Entity Causal Ordering

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g2.violations` (Counter) |
| **Detection** | For events with `causedBy` metadata: verify that the referenced event has already been processed |
| **Trace annotation** | `guarantee.g2.violation` span with causal chain details |
| **Alert threshold** | > 0 violations per 5-minute window |
| **Note** | Causal ordering is subsumed by G-1 for single-entity events. Cross-entity causal validation requires checking the `causedBy` chain across entity handlers |

### OBS.5.3 G-3: Cross-Entity Causal Ordering (Same Org)

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g3.delay_ms` (Histogram, labels: `parent_type`, `child_type`) |
| **Detection** | Compare timestamps of causally-linked events across entities (e.g., Machine FAULT -> Line DEGRADE) |
| **Trace annotation** | `entity.propagation` span duration captures G-3 delay |
| **Alert threshold** | Delay exceeding ISA-95 level staleness budget |
| **Note** | G-3 is SHOULD, not MUST -- violations are advisory, not critical |

### OBS.5.4 G-4: Session Consistency

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g4.violations` (Counter, labels: `session_id`) |
| **Detection** | Client sends write command, then read -- if read returns stale state, increment counter |
| **Trace annotation** | `guarantee.g4.violation` span linking the write span to the stale read span |
| **Alert threshold** | > 0 per session |
| **Codebase ref** | WebSocket server (`lib/iiot/realtime/websocket-server.ts`) tracks per-session last-written sequence. Streaming RPCs (`lib/iiot/rpc/RealtimeRpcs.ts`) deliver events in sequence order. |

### OBS.5.5 G-5: Bounded Staleness (Intra-Org)

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g5.latency_ms` (Histogram, labels: `isa95_level`, `channel`) |
| **Detection** | End-to-end: `deliveryTimestamp - originTimestamp` for each event. Bucket by ISA-95 level. |
| **Trace annotation** | Every event delivery span includes `tmnl.delivery.latency_ms` attribute |
| **Exemplars** | Histogram data points MUST include exemplars linking to the trace of the slowest delivery in each bucket |

**Alert thresholds per ISA-95 level**:

| ISA-95 Level | Max Staleness | Alert if P99 exceeds |
|--------------|---------------|---------------------|
| L0 (Physical Process) | 100ms | 150ms |
| L1 (Basic Control) | 250ms | 400ms |
| L2 (Supervisory Control) | 1 second | 2 seconds |
| L3 (Manufacturing Operations) | 5 seconds | 10 seconds |
| L4 (Business Planning) | 30 seconds | 60 seconds |

**Codebase reference**: Channel definitions at
`lib/iiot/realtime/event-distribution.ts:136-157` -- `iiot:readings` (maxLag
10,000), `iiot:alarms` (maxLag 1,000), `iiot:equipment` (maxLag 1,000),
`iiot:invalidations` (maxLag 1,000). Each channel's maxLag provides the
backpressure boundary; the G-5 histogram provides the staleness boundary.

### OBS.5.6 G-6: Partition Tolerance

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g6.partition_duration_s` (Histogram) |
| **Metric** | `tmnl.guarantee.g6.replay_gap_count` (Counter) |
| **Detection** | Edge device reports `partitioned: true` in heartbeat. Duration measured from first `partitioned: true` to first `partitioned: false`. Replay gaps detected by sequence continuity audit. |
| **Trace annotation** | `reconciliation` trace (see OBS.4.1.5) captures the full partition recovery |
| **Alert thresholds** | Partition > 5 min: Warning. Partition > 24 hours: Critical. Replay gap > 0: Critical (data loss). |
| **Codebase ref** | HolonetBridge (`lib/iiot/realtime/holonet-bridge.ts`) manages the NATS connection. Partition detection triggers dual-publish fallback. |

### OBS.5.7 G-7: Idempotent Processing

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g7.dedup_count` (Counter) |
| **Metric** | `tmnl.guarantee.g7.dedup_cache_hit_rate` (Gauge) |
| **Detection** | Track content-addressed message IDs (`hash(orgId, entityType, entityId, sequenceNumber)`). Count how often a previously-seen ID is re-delivered. |
| **Trace annotation** | Deduplicated events create a `guarantee.g7.dedup` span with the original delivery trace ID |
| **Alert threshold** | Dedup rate > 1% of total volume (indicates replay storm or misconfiguration) |
| **Note** | Some dedup is expected during partition healing (G-6 reconnection). Dedup rate SHOULD normalize within 60s. |

### OBS.5.8 G-8: Cross-Organization Bounded Staleness

| Aspect | Specification |
|--------|--------------|
| **Metric** | `tmnl.guarantee.g8.staleness_ms` (Histogram, labels: `signal_type`) |
| **Detection** | For events crossing org boundaries: `now() - networkTimestamp` at the receiving subscriber. Sample 1% of cross-org events. |
| **Trace annotation** | Cross-org saga spans include `tmnl.network.staleness_ms` attribute |
| **Alert thresholds** | P99 > 60 seconds: Warning. P99 > 120 seconds: Critical. |
| **CRDT convergence** | `tmnl.guarantee.g8.crdt_convergence_ms` (Histogram) -- time from org KV update to aggregate recalculation. Target: < 30s (P50). |

### OBS.5.9 Guarantee Dashboard

Implementations MUST provide a real-time dashboard displaying all eight
guarantees with the following visualization:

```
+---------------------------------------------------------------+
|  Consistency Guarantee Health                                   |
+---------------------------------------------------------------+
|                                                                 |
|  G-1  Per-Entity Sequential    [===GREEN===]  0 violations     |
|  G-2  Per-Entity Causal        [===GREEN===]  0 violations     |
|  G-3  Cross-Entity Causal      [==YELLOW===]  P99: 450ms       |
|  G-4  Session Consistency      [===GREEN===]  0 violations     |
|  G-5  Bounded Staleness        [===GREEN===]  P99: 32ms (L1)   |
|  G-6  Partition Tolerance       [===GREEN===]  0 active parts  |
|  G-7  Idempotent Processing    [===GREEN===]  0.02% dedup      |
|  G-8  Cross-Org Staleness      [===GREEN===]  P99: 8.2s        |
|                                                                 |
|  Time range: [Last 5m] [Last 1h] [Last 24h] [Custom]          |
+---------------------------------------------------------------+
```

---

## OBS.6 Metric Architecture

### OBS.6.1 Metric Naming Convention

The codebase establishes a `domain.subsystem.metric_name` convention. Existing
examples (VERIFIED):

```
geoint.api.latency_ms              -- lib/geoint/api/tracing.ts:64
geoint.api.requests                -- lib/geoint/api/tracing.ts:71
geoint.api.errors                  -- lib/geoint/api/tracing.ts:76
durable_streams.operation.latency_ms  -- lib/holonet/durable-streams/metrics/tracing.ts:69
durable_streams.operations         -- lib/holonet/durable-streams/metrics/tracing.ts:76
durable_streams.messages.published -- lib/holonet/durable-streams/metrics/tracing.ts:86
durable_streams.sse.active_connections -- lib/holonet/durable-streams/metrics/tracing.ts:106
```

IIoT metrics MUST follow this convention:

| Metric Name | Type | Labels | Description |
|-------------|------|--------|-------------|
| `iiot.entity.event_delivery_latency_ms` | Histogram | `orgId`, `entityType`, `isa95Level` | End-to-end entity event delivery latency |
| `iiot.entity.events_delivered` | Counter | `orgId`, `entityType`, `channel` | Total entity events delivered |
| `iiot.entity.active_count` | Gauge | `shardGroup`, `shardId` | Active entities per shard |
| `iiot.entity.state_transitions` | Counter | `entityType`, `fromState`, `toState` | State machine transition count |
| `iiot.pipeline.readings_per_second` | Gauge | `orgId`, `deviceId` | Ingestion throughput |
| `iiot.pipeline.dead_letter_depth` | Gauge | `channel` | DLQ depth per channel |
| `iiot.pipeline.decode_errors` | Counter | `orgId`, `errorType` | Schema decode failures |
| `iiot.alarm.unacknowledged_count` | Gauge | `orgId`, `priority` | Unacked alarms per org per priority |
| `iiot.alarm.time_to_ack_ms` | Histogram | `orgId`, `priority` | Time from alarm trigger to acknowledgment |
| `iiot.edge.connected_devices` | Gauge | `hubId` | Connected device count per hub |
| `iiot.edge.last_seen_age_seconds` | Histogram | `orgId` | Device freshness distribution |
| `iiot.cluster.shard_entity_count` | Gauge | `shardGroup`, `shardId`, `runnerId` | Entities per shard |
| `iiot.cluster.shard_throughput` | Gauge | `shardGroup`, `shardId` | Messages per second per shard |
| `iiot.nats.subject_throughput` | Counter | `subject_pattern` | Per-subject message rate |
| `iiot.nats.jetstream_storage_pct` | Gauge | `cluster` | JetStream storage utilization |
| `iiot.guarantee.violations` | Counter | `guarantee` (G-1..G-8) | Guarantee violation count |
| `iiot.ws.active_connections` | Gauge | `hubId` | WebSocket subscriber count |
| `iiot.ws.delivery_latency_ms` | Histogram | `channel` | WebSocket frame delivery latency |
| `iiot.holonet.publish_latency_ms` | Histogram | `channel` | NATS publish latency |
| `iiot.holonet.publish_errors` | Counter | `channel`, `errorType` | NATS publish failures |
| `iiot.reconciliation.duration_ms` | Histogram | `orgId` | Partition recovery duration |
| `iiot.reconciliation.events_replayed` | Counter | `orgId` | Events replayed during recovery |

### OBS.6.2 Cardinality Management

At 200K organizations, naive use of `orgId` as a metric label creates 200K
time series per metric. Implementations MUST manage cardinality:

| Strategy | Application |
|----------|-------------|
| **Sovereign metrics** | Per-org metrics (`orgId` label) are stored on the org's own edge device. Cloud aggregation uses **pre-aggregated** rollups, not raw org-level series. |
| **Exemplar-based drill-down** | Instead of per-org latency histograms in the cloud, use a single histogram with exemplars linking to traces from specific orgs. |
| **Topk aggregation** | Cloud dashboards show "top 10 slowest orgs" rather than all 200K. |
| **Label allowlists** | `orgId` label is permitted ONLY on sovereign metrics (stored on edge). Platform metrics use `shard_group`, `hub_id`, and `channel` labels. |

### OBS.6.3 Metric Export Formats

Implementations MUST support two export formats:

1. **OTLP** (primary) -- Native OpenTelemetry metric export to backends
   (Prometheus, Mimir, VictoriaMetrics).
2. **Prometheus exposition** (compatibility) -- HTTP `/metrics` endpoint for
   scraping. Extends the existing `snapshotToPrometheus` pattern at
   `lib/geoint/api/metrics-export.ts:328-359`.

### OBS.6.4 Higher-Order Tracing Extension

Extending the `withApiTracing` pattern at `lib/geoint/api/tracing.ts:152-181`,
implementations MUST provide:

```typescript
// Normative: IIoT entity handler tracing (extends existing HOF pattern)
export const withEntityTracing = (
  entityType: string,
  operation: string
) => <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  Effect.gen(function* () {
    const startTime = Date.now()
    yield* Metric.increment(
      Metric.tagged(entityEventCounter, 'entity_type', entityType)
    )
    const result = yield* effect.pipe(
      Effect.withSpan(`iiot.${entityType}.${operation}`, {
        attributes: {
          'tmnl.entity.type': entityType,
          'tmnl.operation': operation,
        },
      }),
      Effect.tapBoth({
        onSuccess: () =>
          Metric.update(
            Metric.tagged(entityLatencyHistogram, 'entity_type', entityType),
            Date.now() - startTime
          ),
        onFailure: () =>
          Metric.increment(
            Metric.tagged(entityErrorCounter, 'entity_type', entityType)
          ),
      })
    )
    return result
  })
```

Similarly, `withPipelineTracing` wraps ingestion pipeline stages:

```typescript
export const withPipelineTracing = (
  stage: string
) => <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
  effect.pipe(
    Effect.withSpan(`iiot.pipeline.${stage}`, {
      attributes: { 'tmnl.pipeline.stage': stage },
    }),
    Effect.tap(() =>
      Metric.increment(Metric.tagged(pipelineStageCounter, 'stage', stage))
    )
  )
```

---

## OBS.7 Structured Logging

### OBS.7.1 Log Correlation

Implementations MUST correlate log records with trace context. Every log entry
produced within an Effect span MUST include the active `traceId` and `spanId`:

```json
{
  "timestamp": "2026-02-09T14:30:00.123Z",
  "level": "INFO",
  "message": "Entity state transition completed",
  "traceId": "abc123def456",
  "spanId": "789ghi012",
  "attributes": {
    "tmnl.org.id": "org-earl",
    "tmnl.entity.type": "Machine",
    "tmnl.entity.id": "MCH-001",
    "tmnl.state.from": "IDLE",
    "tmnl.state.to": "RUNNING"
  }
}
```

Effect-TS `Effect.log` automatically captures the current span context when used
within an `Effect.withSpan` scope. This MUST be the primary logging mechanism.

### OBS.7.2 Log Severity Mapping

| Effect Log Level | OpenTelemetry Severity | Use Case |
|-----------------|----------------------|----------|
| `Effect.logTrace` | TRACE | Fiber scheduling, internal state |
| `Effect.logDebug` | DEBUG | Entity handler entry/exit, schema validation details |
| `Effect.log` (default) | INFO | State transitions, successful operations |
| `Effect.logWarning` | WARN | Degraded performance, threshold approach, retries |
| `Effect.logError` | ERROR | Processing failures, consistency violations |
| `Effect.logFatal` | FATAL | Unrecoverable errors, safety system failures |

### OBS.7.3 Sovereignty-Aware Log Routing

Logs MUST respect the same sovereignty boundaries as metrics and traces:

| Log Source | Destination | Retention |
|-----------|-------------|-----------|
| Entity event processing (per-org) | Organization's edge device log store | 90 days minimum; 7 years for regulatory [FDA-CFR11] |
| Platform operations | Central log aggregation (Loki/ClickHouse) | 1 year |
| Infrastructure | Central log aggregation | 30 days |
| Cross-org saga events | Both orgs (redacted) + platform audit log | 7 years |

---

## OBS.8 Edge Device Observability

### OBS.8.1 Resource-Constrained Collection

Edge devices (especially Tier 1: 1-10 machines on Raspberry Pi-class hardware)
have limited CPU, memory, and storage for observability data. Implementations
MUST adapt collection to available resources:

| Resource | Tier 1 (1-10 machines) | Tier 2 (11-100 machines) | Tier 3 (101+ machines) |
|----------|----------------------|------------------------|----------------------|
| OTLP export buffer | 1,000 spans | 10,000 spans | 100,000 spans |
| Metric retention | 1 hour | 4 hours | 24 hours |
| Log retention | 24 hours | 7 days | 30 days |
| Sampling rate adjustment | Reduce to 0.5% for telemetry | Standard 1% | Standard 1% |

### OBS.8.2 Offline Observability

During network partition, the edge device MUST:

1. **Continue local collection** -- All traces, metrics, and logs are captured to
   local storage (JetStream on the embedded NATS instance).
2. **Buffer for upload** -- OTLP export is buffered to local disk. Buffer size
   MUST NOT exceed 10% of available storage.
3. **Flush on reconnection** -- When connectivity is restored, buffered telemetry
   is uploaded to the central collector in chronological order.
4. **Local dashboard** -- An operator at the edge device MUST be able to view
   recent traces and metrics via a local HTTP endpoint, even without cloud
   connectivity.

### OBS.8.3 Edge-to-Cloud Telemetry Transport

| Transport | Use Case | Protocol |
|-----------|----------|----------|
| NATS message | Real-time metric samples | NATS publish to `tmnl.telemetry.{orgId}.>` |
| OTLP/gRPC | Trace and log export (primary) | gRPC to central collector |
| OTLP/HTTP | Trace and log export (fallback) | HTTP POST to central collector |
| Local file | Partition buffer | Protobuf-encoded OTLP batches on disk |

---

## OBS.9 Alerting Integration

### OBS.9.1 Metric-Based Alerts

The observability framework feeds into the alerting pipeline defined in the
Monitoring Infrastructure section. Alert rules are expressed as metric queries:

| Alert | Metric Query | Severity |
|-------|-------------|----------|
| G-1 violation | `rate(tmnl.guarantee.violations{guarantee="G-1"}[5m]) > 0` | CRITICAL |
| G-5 P99 breach (L1) | `histogram_quantile(0.99, tmnl.guarantee.g5.latency_ms{isa95_level="1"}) > 400` | HIGH |
| G-8 staleness | `histogram_quantile(0.99, tmnl.guarantee.g8.staleness_ms) > 60000` | WARNING |
| Pipeline DLQ growth | `rate(iiot.pipeline.dead_letter_depth[5m]) > 10` | HIGH |
| Entity error spike | `rate(iiot.entity.events_delivered{status="error"}[5m]) > 0.05 * rate(iiot.entity.events_delivered[5m])` | MEDIUM |

### OBS.9.2 Trace-Based Alerts

In addition to metric-based alerts, implementations SHOULD support trace-based
alerting for conditions that are difficult to express as metric queries:

| Condition | Detection | Severity |
|-----------|-----------|----------|
| Trace duration > 10x P50 | Tail-based sampling flags outlier traces | WARNING |
| Span error rate > 5% for specific entity type | Span-level error analysis | HIGH |
| Missing expected span in trace | Trace completeness check (expected span tree vs actual) | CRITICAL |
| Cross-org saga stalled > 1 hour | Saga trace timeout detection | HIGH |

---

## OBS.10 Codebase Implementation Reference

### OBS.10.1 Existing Observability Patterns

| Pattern | Location | Description |
|---------|----------|-------------|
| `Effect.withSpan` | 137 occurrences / 28 files | Native span creation |
| `Metric.histogram` | `lib/geoint/api/tracing.ts:63-66` | Exponential histogram |
| `Metric.counter` | `lib/geoint/api/tracing.ts:71,76` | Request/error counters |
| `Metric.gauge` | `lib/holonet/durable-streams/metrics/tracing.ts:106-111` | Connection gauges |
| `Metric.tagged` | `lib/geoint/api/tracing.ts:84-89` | Dimensional labeling |
| `withApiTracing` | `lib/geoint/api/tracing.ts:152-181` | HOF for API call tracing |
| `withDsTracing` | `lib/holonet/durable-streams/metrics/tracing.ts:277-299` | HOF for stream op tracing |
| `withSSETracking` | `lib/holonet/durable-streams/metrics/tracing.ts:311-318` | SSE connection lifecycle |
| `withSubscriptionTracking` | `lib/holonet/durable-streams/metrics/tracing.ts:330-337` | Subscription lifecycle |
| `ApiMetricsService` | `lib/geoint/api/metrics-export.ts:145-148` | Periodic metric snapshots |
| `snapshotToPrometheus` | `lib/geoint/api/metrics-export.ts:328-359` | Prometheus exposition |
| `InstrumentationService` | `lib/instrumentation/v1/services/InstrumentationService.ts` | Span capture + NATS persistence |
| OTel architecture | `lib/instrumentation/ARCHITECTURE.md` | @effect/opentelemetry design |

### OBS.10.2 Extension Points

| Extension | Base Pattern | New File |
|-----------|-------------|----------|
| `withEntityTracing` HOF | `withApiTracing` | `lib/iiot/observability/entity-tracing.ts` |
| `withPipelineTracing` HOF | `withDsTracing` | `lib/iiot/observability/pipeline-tracing.ts` |
| IIoT metric definitions | `lib/geoint/api/tracing.ts` | `lib/iiot/observability/metrics.ts` |
| Guarantee monitor service | `ApiMetricsService` | `lib/iiot/observability/guarantee-monitor.ts` |
| OTLP export layer | `lib/instrumentation/ARCHITECTURE.md` | `lib/iiot/observability/otel-layer.ts` |
| Edge OTLP collector | N/A (new) | `lib/iiot/observability/edge-collector.ts` |

### OBS.10.3 IIoT Observability Service

Implementations SHOULD model the IIoT observability system as an Effect service:

```typescript
// Normative: IIoTObservabilityService pattern
class IIoTObservabilityService extends Effect.Service<IIoTObservabilityService>()(
  'iiot/ObservabilityService',
  {
    effect: Effect.gen(function* () {
      const guaranteeMonitor = yield* GuaranteeMonitorService
      const metrics = yield* IIoTMetrics

      const checkGuarantees = Effect.gen(function* () {
        const [g1, g4, g5, g7, g8] = yield* Effect.all([
          guaranteeMonitor.checkG1(),
          guaranteeMonitor.checkG4(),
          guaranteeMonitor.checkG5(),
          guaranteeMonitor.checkG7(),
          guaranteeMonitor.checkG8(),
        ], { concurrency: 'unbounded' })

        return { g1, g4, g5, g7, g8 }
      })

      const getMetricsSummary = metrics.summarize()

      return { checkGuarantees, getMetricsSummary } as const
    }),
  }
) {}
```

---

## OBS.11 References

### Normative

- [RFC2119] -- Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels."
- [RFC8174] -- Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words."
- [OTEL] -- OpenTelemetry Project. "OpenTelemetry Specification." https://opentelemetry.io/docs/specs/otel/
- [W3C-TRACE-CONTEXT] -- W3C. "Trace Context." https://www.w3.org/TR/trace-context/
- [ISA-18.2] -- ANSI/ISA-18.2-2016. Management of Alarm Systems.
- [FDA-CFR11] -- U.S. FDA, 21 CFR Part 11. Electronic Records.

### NATS / JetStream

- [NATS-ACCOUNTS] -- Synadia. "NATS Account-Based Security."
- [JETSTREAM] -- Synadia. "NATS JetStream."

### Effect-TS

- [EFFECT-TS] -- Effect-TS Framework. https://effect.website
- [EFFECT-CLUSTER] -- @effect/cluster entity sharding.

### Internal

- [TMNL-MONITORING] -- Section: Monitoring Infrastructure.
- [TMNL-CONSISTENCY] -- Section: Two-Domain Consistency Model.
- [TMNL-SECURITY] -- Section: Tenant Isolation.

---

## Revision Log

| Date | Change |
|------|--------|
| 2026-02-09 | Initial draft -- 11 sections covering OTel integration, distributed tracing, consistency verification, metric architecture, structured logging, edge observability, and codebase grounding |
