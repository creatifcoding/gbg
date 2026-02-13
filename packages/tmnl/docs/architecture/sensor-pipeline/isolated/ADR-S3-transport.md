---
id: "S3"
title: "Transport Layer — NATS JetStream Broker"
commitHash: "6656064"
status: "draft"
date: "2026-01-02"
tier: "isolated"
stages: ["S3"]
---

# ADR-S3: Transport Layer

## Context

### Stages Covered
- S3 (Transport)

### Problem

Sensor data flows from edge devices (S2) to the cloud ingestion layer (S4) require a reliable, scalable message broker that:

1. **Decouples producers from consumers** — Edge devices shouldn't block on slow backend processing
2. **Provides persistence** — Messages must survive broker restarts and network disruptions
3. **Supports wildcard routing** — Enable server-side filtering (S7) by topic patterns (e.g., `sensors.zone1.>`)
4. **Enables at-least-once delivery** — Critical telemetry cannot be silently dropped
5. **Handles browser clients** — TMNL's React frontend must subscribe to live sensor streams
6. **Scales horizontally** — Support multiple zones, thousands of sensors, high-frequency data

The transport layer is the **critical path** for all sensor data — failures here cascade to the entire pipeline.

### Constraints

- **WebSocket support required** — Browser clients (nats.ws) cannot use TCP NATS protocol
- **JetStream persistence required** — Sensor data must survive broker restarts
- **Subject hierarchy must scale** — Support zone-based routing, sensor-type filtering, measurement granularity
- **Existing infrastructure** — TMNL already runs NATS at `ws://localhost:9222` (see `/docker/nats/nats-server.conf`)
- **Effect-TS integration** — Must integrate with NatsKVService and connection-ports system
- **No authentication in dev** — Production auth is out of scope for S1-S7 MVP

### Assumptions

- NATS server is always available (orchestrated via Docker Compose)
- Network latency between S2→S3 is <50ms (local or co-located deployment)
- Single NATS server is sufficient (clustering deferred to production)
- Consumer groups handle load balancing (no manual sharding required)
- Dead letter queue is handled by JetStream discard policies (no custom DLQ service)

## Decision

### Summary

Use **NATS JetStream** as the transport layer with a hierarchical subject design (`sensors.{zone}.{sensorId}.{measurement}`), at-least-once QoS, and WebSocket support for browser clients. Leverage existing NatsKVService for key-value operations and introduce a new NatsStreamService for publish/subscribe patterns.

### Technologies

| Technology | Version | Purpose | File Reference |
|------------|---------|---------|----------------|
| NATS Server | 2.x | Core message broker | `/docker/nats/nats-server.conf` |
| NATS JetStream | 2.x | Message persistence & replay | `/docker/nats/nats-server.conf:8-10` |
| nats.ws | latest | Browser WebSocket client | `/src/lib/nats/NatsKVService.ts:14-21` |
| NATS WebSocket | — | Browser transport | `/docker/nats/nats-server.conf:18-31` (port 9222) |
| Effect Schema | latest | Message validation | `/src/lib/connection-ports/schemas/artifacts.ts` |

### Patterns

- **Hierarchical Subjects**: `sensors.{zone}.{sensorId}.{measurement}` enables wildcard subscriptions at any granularity
  - Zone-level: `sensors.zone1.>`
  - Sensor-level: `sensors.zone1.temp-sensor-42.>`
  - Measurement-level: `sensors.zone1.*.temperature`

- **JetStream Streams**: One stream per zone (`SENSOR_ZONE_{zone}`) with:
  - **Retention**: 7 days or 10GB per stream (whichever hits first)
  - **Replicas**: 1 (single-node dev), 3 (production)
  - **Max age**: 7 days
  - **Discard policy**: Old messages (FIFO)
  - **Storage**: File-based persistence in `/data`

- **Consumer Groups**: JetStream durable consumers for parallel processing:
  - `ingestion-workers` → S4 (Ingestion) load-balanced across replicas
  - `archive-workers` → S6 (Storage) batched writes to ClickHouse
  - `ui-watchers` → Browser clients (ephemeral, no ACK required)

- **QoS Levels**:
  - **At-least-once** (default): Sensors → Ingestion (ACK-based delivery)
  - **At-most-once** (optional): High-frequency heartbeats, UI updates (no ACK overhead)

- **Dead Letter Queue**: JetStream's built-in `max_deliver` policy (default: 3 retries) → discard to `DLQ` stream for manual review

### Interfaces

| Interface | Protocol | Schema |
|-----------|----------|--------|
| S2→S3 | NATS PubSub | `sensors.{zone}.{sensorId}.{measurement}` |
| S3→S4 | NATS Consumer | JetStream stream `SENSOR_ZONE_{zone}` |
| S3→S7 | NATS Subscription | Wildcard patterns (`sensors.zone1.>`) |
| S3→UI | WebSocket (nats.ws) | `tmnl.ava.artifacts.*`, `tmnl.ava.deltas.*` |

**Message Schema** (Effect Schema):
```typescript
// Sensor telemetry message
class SensorTelemetry extends Schema.TaggedClass<SensorTelemetry>()(
  'SensorTelemetry',
  {
    sensorId: Schema.String,
    zone: Schema.String,
    measurement: Schema.String,
    value: Schema.Number,
    timestamp: Schema.DateFromSelf,
    unit: Schema.optional(Schema.String),
    metadata: Schema.optional(Schema.Record({
      key: Schema.String,
      value: Schema.Unknown
    })),
  }
) {}
```

## Rationale

### Alternatives Considered

1. **RabbitMQ**
   - **Pros**: Mature, rich routing (topic exchanges), management UI
   - **Cons**: Heavier resource footprint, no native WebSocket (requires STOMP), slower than NATS for high-throughput
   - **Rejected**: NATS already in TMNL stack, better suited for real-time telemetry

2. **Apache Kafka**
   - **Pros**: Industry-standard for event streaming, excellent persistence, strong ordering
   - **Cons**: JVM dependency, complex setup (Zookeeper/KRaft), no WebSocket support, overkill for MVP
   - **Rejected**: Too heavy for local dev, no browser client story

3. **Redis Streams**
   - **Pros**: Lightweight, fast, consumer groups built-in
   - **Cons**: In-memory only (persistence requires RDB/AOF tuning), no wildcard routing, limited scalability
   - **Rejected**: Insufficient persistence guarantees for critical telemetry

4. **Direct HTTP/SSE**
   - **Pros**: Simplest architecture, no broker dependency
   - **Cons**: No backpressure, no persistence, manual retry logic, couples S2↔S4 tightly
   - **Rejected**: Lacks decoupling and fault tolerance

### Tradeoffs

| Gain | Cost |
|------|------|
| **Decoupling** — Edge devices fire-and-forget, backend scales independently | Operational overhead — NATS server must be monitored, tuned, backed up |
| **Persistence** — JetStream survives crashes, enables replay for late-joiners | Disk I/O overhead — File storage adds ~5-10ms latency vs in-memory |
| **Wildcard routing** — Server-side filtering (S7) without custom logic | Subject design complexity — Must maintain hierarchical naming conventions |
| **Browser compatibility** — WebSocket transport works in TMNL React app | Split protocol stack — WebSocket client (nats.ws) vs server (native NATS) |
| **At-least-once delivery** — Guarantees messages arrive (or alert) | Duplicate handling — Consumers must be idempotent (deduplication in S4) |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **NATS downtime** — Single point of failure | Medium | Critical | Docker health checks + auto-restart; production clustering (3-node) |
| **Subject explosion** — Poor naming → thousands of unique subjects | Low | High | Enforce subject template validation at S2 (edge); monitor via NATS metrics |
| **Message loss** — Network partition before ACK | Low | High | JetStream persistence + ACK timeout → retry at S2 |
| **Backpressure** — S4 consumers lag, disk fills up | Medium | Medium | JetStream `max_bytes` limit (10GB) + discard old; alert on lag >1000 msgs |
| **WebSocket overhead** — Browser clients add connection churn | Medium | Low | Ephemeral consumers (no durable state); limit UI subscriptions to active views |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `/src/lib/nats/NatsStreamService.ts` | create | Effect service for NATS pub/sub (complements NatsKVService) |
| `/src/lib/nats/schemas/telemetry.ts` | create | Effect schemas for sensor telemetry messages |
| `/src/lib/nats/NatsKVService.ts` | modify | Extract shared connection logic to NatsConnectionService |
| `/src/lib/connection-ports/schemas/connection.ts` | modify | Add JetStream stream config schemas |
| `/docker/nats/nats-server.conf` | modify | Add JetStream stream definitions, retention policies |
| `/docker/nats/streams/` | create | Stream definition files (JSON) for `nats stream add` CLI |

### Dependencies

```json
{
  "nats.ws": "^1.28.0",      // Already installed (see NatsKVService)
  "@effect/schema": "latest" // Already installed
}
```

**No new dependencies required** — leverage existing NATS + Effect stack.

### Test Strategy

**Unit Tests** (`@effect/vitest`):
- NatsStreamService.publish() → validates schema encoding, subject construction
- NatsStreamService.subscribe() → handles message decoding, ACK logic
- Subject hierarchy validation → rejects malformed subjects

**Integration Tests** (Docker Compose):
1. **Publish-Subscribe Flow**:
   - Start NATS container
   - Publish `SensorTelemetry` to `sensors.zone1.temp-42.temperature`
   - Subscribe with wildcard `sensors.zone1.>`
   - Assert: Message received within 100ms

2. **Persistence & Replay**:
   - Publish 100 messages
   - Stop NATS container
   - Restart NATS container
   - Replay from offset 0
   - Assert: All 100 messages re-delivered

3. **Consumer Groups**:
   - Create 2 consumers in group `ingestion-workers`
   - Publish 10 messages
   - Assert: Each consumer receives ~5 messages (load-balanced)

4. **Dead Letter Queue**:
   - Publish message
   - Consumer NACK 3 times (max_deliver=3)
   - Assert: Message appears in `DLQ` stream

**Load Tests** (optional, deferred):
- 1000 msg/sec sustained throughput
- Measure: P50/P95/P99 latency, disk usage growth
- Target: <10ms P95 end-to-end (S2→S4)

## Metadata

### Related ADRs
- **ADR-S2-S3** (Edge-Transport integration) — Defines how edge devices publish to NATS subjects
- **ADR-S3-S4** (Transport-Ingestion integration) — Defines consumer group setup, ACK semantics
- **ADR-S3-S7** (Server-side filtering synergy) — Wildcard subscriptions reduce data volume to clients
- **ADR-S5** (DataFusion Processing) — Consumes from S3 for batch aggregations (separate consumer group)

### Open Questions
1. **Subject versioning** — How to handle schema evolution? (e.g., `sensors.v2.zone1.temp-42.temperature`)
2. **Multi-tenancy** — Should zones map to NATS accounts for isolation?
3. **Retention tuning** — Is 7 days sufficient for replay? Should high-frequency sensors have shorter TTL?
4. **Monitoring** — What metrics to expose? (lag, throughput, error rate per stream)

### References
- NATS JetStream Docs: https://docs.nats.io/nats-concepts/jetstream
- NatsKVService implementation: `/src/lib/nats/NatsKVService.ts`
- TMNL artifact schemas: `/src/lib/connection-ports/schemas/artifacts.ts`
- Docker NATS config: `/docker/nats/nats-server.conf`
