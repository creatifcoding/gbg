---
id: S4-S5-S6
title: "Ingestion → Storage → Client — Backend Data Plane Architecture"
commitHash: "6656064"
status: draft
date: "2026-01-02"
tier: triplet-sequential
stages:
  - S4
  - S5
  - S6
---

# ADR-S4-S5-S6: Backend Data Plane Architecture

**ID**: S4-S5-S6
**Commit Hash**: 6656064
**Status**: draft
**Date**: 2026-01-02
**Tier**: triplet-sequential

## Context

### Stages Covered
- S4 (Ingestion) — Effect.Service validation, transformation, routing
- S5 (Storage) — Dual-write persistence (NATS KV + SQLite)
- S6 (Client Transport) — WebSocket/SSE browser connectivity

### Problem

The backend data plane must bridge **untrusted sensor telemetry** arriving over NATS (S3) with **reactive browser UIs** (S9) through a three-stage pipeline that guarantees:

1. **Data Integrity** — Only validated, schema-conformant readings enter the system
2. **Dual-Mode Persistence** — Instant access to latest state (hot path) + historical analysis (cold path)
3. **Real-Time Delivery** — Sub-100ms latency from sensor update to browser DOM update
4. **Resilient Connectivity** — Survive network disruptions, reconnections, and partial failures
5. **Query Flexibility** — Support both ad-hoc historical queries and continuous live subscriptions
6. **Resource Efficiency** — Handle 10k writes/sec with <500MB RAM, <10ms P95 latency

This triplet represents the **system of record boundary** — the transition from transient stream processing to durable storage to browser-accessible APIs. Failures here manifest as data loss (S4→S5), stale UIs (S5→S6), or silent corruption (lack of validation).

**Core architectural question**: How do we design a backend data plane that seamlessly integrates Effect.Stream-based ingestion, dual-write persistence, and WebSocket-based client delivery while maintaining ACID guarantees at storage boundaries and eventual consistency across the full pipeline?

### Constraints

- **Effect-TS throughout** — All services use Effect.Service, Stream, Schema for composability
- **NATS as message backbone** — JetStream for ingestion (S3→S4), KV for hot storage (S5), WebSocket for client (S6)
- **SQLite for historical data** — Embedded database, no external dependency, WAL mode for concurrency
- **WebSocket-first transport** — nats.ws for full NATS protocol, SSE fallback for degraded mode
- **Schema consistency** — Same Effect Schema models across S4/S5/S6 boundaries (no transform layers)
- **Atom-as-State doctrine** — Client-side state in effect-atom, not useState
- **No REST endpoints** — All queries over persistent WebSocket (unified transport)

### Assumptions

- Single TMNL instance (no distributed coordination required)
- Network latency: NATS <5ms, SQLite <1ms, WebSocket <50ms (local dev)
- Throughput: 10k sensor updates/sec peak, 100k/day steady-state
- Retention: 30 days historical data (SQLite), latest value only (NATS KV)
- Query patterns: 90% latest-value lookups (KV), 10% time-range queries (SQLite)
- Subscription fanout: <100 active subscriptions per client, <1000 total concurrent
- Storage growth: ~300MB for 256 sensors @ 10Hz with 30-day retention

## Decision

### Summary

Implement a **three-stage backend data plane** where:

1. **S4 (Ingestion)** validates incoming SenML from NATS JetStream against Effect Schema, transforms to internal `SensorReading` format, deduplicates via Ref-based cache, and routes to dual-write storage via Effect.Stream
2. **S5 (Storage)** performs **SQLite-first dual-write** (transactional persistence, then idempotent KV update), provides query API for historical data, and exposes NATS KV watch streams for live updates
3. **S6 (Client Transport)** establishes persistent WebSocket connections (nats.ws), implements message-based RPC for queries (request/response correlation), subscribes to NATS KV watch streams for live updates, and provides SSE fallback for read-only scenarios

The architecture uses **SQLite as source of truth for history**, **NATS KV as cache for latest state**, and **WebSocket as unified transport for queries + subscriptions**. Consistency model: **synchronous within S4-S5 boundary** (dual-write), **eventual across S5-S6 boundary** (KV watch stream propagation, ~10ms lag).

### Technologies

| Technology | Version | Purpose | Stage | File Reference |
|------------|---------|---------|-------|----------------|
| Effect.Service | 3.x | Service composition | S4/S5/S6 | TMNL standard |
| Effect.Schema | 0.75+ | Runtime validation | S4/S5/S6 | TMNL standard |
| Effect.Stream | 3.x | Stream transformation | S4/S5/S6 | TMNL standard |
| Effect.Ref | 3.x | Deduplication cache | S4 | `/src/lib/ai-core/services/SSEAdapter.ts:78` |
| NATS JetStream | 2.x | Ingestion transport | S3→S4 | `/docker/nats/nats-server.conf` |
| NATS KV | 2.x | Hot storage + watch | S5 | `/src/lib/nats/NatsKVService.ts` |
| SQLite (WAL) | 3.45+ | Historical storage | S5 | `/src/lib/durable-streams/server/persistence.ts` |
| nats.ws | 1.28+ | WebSocket client | S6 | `/src/lib/nats/NatsKVService.ts` |
| EventSource API | Native | SSE fallback | S6 | `/src/lib/ai-core/services/SSEAdapter.ts` |
| XState v5 | 5.x | Connection state machine | S6 | `/src/lib/dataplane/components/Port/port-stx.ts` |
| effect-atom | latest | Client-side state | S6 | TMNL standard |

### Patterns

#### 1. Data Flow Architecture

**Three-Stage Pipeline with Dual-Write**:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            BACKEND DATA PLANE                            │
└─────────────────────────────────────────────────────────────────────────┘

 ┌──────────┐   Effect.Stream      ┌──────────┐   Dual-Write      ┌──────────┐
 │  NATS    │ ───────────────────> │   S4     │ ──────────────────>│   S5     │
 │JetStream │   SenML messages     │Ingestion │   SensorReading   │ Storage  │
 │  (S3)    │                      │          │                    │          │
 └──────────┘                      └──────────┘                    └──────────┘
      ↓                                 │                                │
  sensors.{zone}.                  Validate Schema              ┌────────┴────────┐
  {sensorId}.{measurement}         Transform to internal         │                 │
                                   Deduplicate (Ref cache)       │                 │
                                   Route via Match               ▼                 ▼
                                                           ┌──────────┐      ┌──────────┐
                                                           │ SQLite   │      │ NATS KV  │
                                                           │(History) │      │(Latest)  │
                                                           │          │      │          │
                                                           │  WAL     │      │ history=1│
                                                           │  mode    │      │ TTL=1h   │
                                                           └──────────┘      └─────┬────┘
                                                                 ▲                  │
                                                                 │                  │
                                                            Query API         Watch Stream
                                                                 │                  │
                                                                 │                  ▼
┌──────────┐   WebSocket (nats.ws)   ┌──────────┐         ┌─────┴─────┐  ┌──────────────┐
│ Browser  │ <────────────────────── │   S6     │ ◀───────│ Queries   │  │ Live Updates │
│ Client   │   JSON messages         │ Client   │         │ (RPC)     │  │ (Watch)      │
│          │                         │Transport │         └───────────┘  └──────────────┘
└──────────┘                         └──────────┘
    │                                     │
    │                                     ▼
    │                               Connection State Machine
    │                               (XState v5 + effect-atom)
    │                                     │
    └─────────────────────────────────────┴─── Reconnection, Subscription
        SSE Fallback (degraded mode)           Restore, Heartbeat
```

**Write Path (S4→S5)**:
1. S4 receives NATS message from JetStream consumer
2. Validates SenML against Effect Schema
3. Transforms to `SensorReading` (enriches metadata)
4. Checks deduplication cache (Ref<HashMap<MessageId, Timestamp>>)
5. Routes via Effect.Match: Valid → S5 write, Invalid → DLQ, Duplicate → drop
6. S5 **dual-write**: SQLite first (transactional), then NATS KV (idempotent)
7. SQLite write triggers retention cleanup (DELETE old rows)
8. KV write supersedes previous value (history=1)

**Read Path — Latest Value (S6→S5→Browser)**:
1. Browser sends WebSocket query: `/sensors/:id/current`
2. S6 forwards to S5.getCurrentState()
3. S5 reads from NATS KV (hash lookup, <2ms)
4. S6 returns JSON response with correlationId
5. Browser atom updates via useAtomValue()

**Read Path — Historical (S6→S5→Browser)**:
1. Browser sends WebSocket query: `/sensors/:id/history?start=X&end=Y`
2. S6 forwards to S5.getHistory()
3. S5 executes SQLite query with indexed WHERE clause
4. Pagination: `LIMIT 100 OFFSET N`, returns hasMore flag
5. S6 streams JSON response chunks
6. Browser atom updates progressively

**Watch Path — Live Updates (S5→S6→Browser)**:
1. Browser sends SubscribeRequest: `{ pattern: 'zone1.*.temperature' }`
2. S6 calls NatsKVService.watch() with pattern
3. S5 NATS KV watch stream emits KvWatchEvent on changes
4. S6 pipes watch events to WebSocket (UpdateEvent messages)
5. Browser atom updates on each event (reactive render)
6. Unsubscribe: Client sends UnsubscribeRequest, S6 cancels stream

#### 2. Read/Write Consistency Model

**Write Consistency (S4→S5)**:
- **Strong consistency within S5**: Dual-write to SQLite + KV is synchronous (Effect.all)
- **Transactional boundary**: SQLite write in transaction, KV write idempotent
- **Failure modes**:
  - SQLite fails → entire write fails, NATS nak (retry upstream)
  - KV fails → log error, retry (idempotent), SQLite already committed
  - Both succeed → reading available immediately

**Read Consistency (S5→S6)**:
- **Latest value queries**: Read from NATS KV, eventual consistency (KV write lag ~5-10ms)
- **Historical queries**: Read from SQLite, strong consistency (transactional snapshots)
- **Watch streams**: Eventual consistency, KV watch event lag ~10-50ms
- **Reconciliation**: Background job compares KV latest vs SQLite latest, alerts on >1% drift

**Cross-Boundary Consistency**:
- **S4→S5**: Synchronous (Effect.all), no lag
- **S5→S6**: Eventual (watch streams), ~10-50ms lag
- **S6→Browser**: Eventual (WebSocket propagation), <100ms end-to-end

**Consistency Guarantees**:
- **Single sensor writes**: Linearizable (SQLite ACID + KV idempotency)
- **Multi-sensor reads**: Eventually consistent (NATS KV lag)
- **Historical queries**: Snapshot isolation (SQLite transaction level)

#### 3. Transaction Semantics

**Dual-Write Transaction Flow**:

```typescript
// S5: SensorStorageService.write()
const writeSensorReading = (reading: SensorReading) =>
  Effect.gen(function* () {
    // Step 1: SQLite write (ACID boundary)
    // Transaction: BEGIN → INSERT → COMMIT
    // Trigger: Auto-delete rows older than 30 days
    yield* Effect.tryPromise({
      try: () => db.run(
        `INSERT INTO sensor_readings
         (sensor_id, zone, measurement, value, unit, timestamp, ingest_ts, source, seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (source, seq) DO NOTHING`, // Idempotency
        [
          reading.sensorId,
          reading.zone,
          reading.measurement,
          reading.value,
          reading.unit,
          reading.timestamp.getTime(),
          reading.ingestTimestamp.getTime(),
          reading.source,
          reading.sequenceNumber,
        ]
      ),
      catch: (e) => new SQLiteWriteError(`SQLite write failed: ${e}`)
    });

    // Step 2: NATS KV write (idempotent cache update)
    // Latest value supersedes previous (history=1)
    const kvKey = `sensor.${reading.zone}.${reading.sensorId}`;
    const kvValue = JSON.stringify({
      value: reading.value,
      unit: reading.unit,
      timestamp: reading.timestamp.toISOString(),
      source: reading.source,
    });

    yield* NatsKVService.put(kvKey, kvValue).pipe(
      Effect.retry({
        schedule: Schedule.exponential('100 millis').pipe(
          Schedule.compose(Schedule.recurs(3))
        ),
        while: isTransientError, // Retry network/timeout, not validation
      }),
      Effect.catchAll((error) =>
        // KV failure is not fatal (SQLite is source of truth)
        Effect.logWarning(`KV write failed: ${error}`).pipe(
          Effect.as(undefined) // Continue despite KV failure
        )
      )
    );

    return reading;
  });
```

**Failure Recovery Strategies**:

| Failure Scenario | S4 Action | S5 Action | Result |
|-----------------|----------|-----------|--------|
| SQLite write fails (disk full) | NATS nak (retry) | Log error, propagate | Write rejected, upstream retries |
| KV write fails (network) | Continue (not fatal) | Retry 3x, then log warning | SQLite committed, KV stale (reconciled later) |
| Both fail | NATS nak | Propagate error | Full rollback, upstream retry |
| Duplicate write (same seq) | Drop (dedup cache) | SQLite: CONFLICT DO NOTHING, KV: supersede | Idempotent, no corruption |
| Partial KV failure (timeout) | Retry | Retry with backoff | Eventually consistent (KV catches up) |

**Idempotency Guarantees**:
- **SQLite**: `UNIQUE(source, seq)` constraint prevents duplicate inserts
- **NATS KV**: Latest value supersedes (history=1), writes are idempotent
- **S4 deduplication**: Ref cache tracks last 10k message IDs, 5-minute TTL

#### 4. Scaling Strategy

**S4 (Ingestion) Scaling**:
- **Horizontal**: NATS consumer groups (multiple S4 instances, round-robin delivery)
- **Vertical**: Stream.mapEffectPar(n) for parallel validation (n = CPU cores)
- **Bottleneck**: Schema validation (~0.2ms/msg) → optimize with Schema.memoize
- **Limit**: ~10k msgs/sec per instance (validation + dedup + routing)

**S5 (Storage) Scaling**:
- **SQLite scaling**:
  - WAL mode: Multiple concurrent readers, single writer
  - Read replicas: rsync SQLite file to read-only instances (stale-read acceptable)
  - Sharding: Separate databases per zone (zone1.db, zone2.db)
- **NATS KV scaling**:
  - Bucket sharding: Per-zone buckets (SENSOR_STATE_ZONE1, SENSOR_STATE_ZONE2)
  - JetStream clustering: 3-node cluster for high availability (production)
- **Bottleneck**: SQLite write throughput (~1k writes/sec per database)
- **Limit**: 10k writes/sec total (10 zone-sharded databases)

**S6 (Client Transport) Scaling**:
- **Connection pooling**: Shared WebSocket for multiple React components (single NATS connection)
- **Subscription deduplication**: Merge overlapping patterns (zone1.*, zone1.temp-42 → zone1.*)
- **Load balancing**: Multiple S6 instances behind NATS load balancer (production)
- **Bottleneck**: WebSocket message fanout (1000 subscriptions × 10 updates/sec = 10k msgs/sec)
- **Limit**: ~1000 concurrent subscriptions per client (browser memory)

**Cross-Stage Scaling Interactions**:
- **S4→S5**: Backpressure via Effect.Stream buffer (bounded queue, 1000 items)
- **S5→S6**: No backpressure (watch streams are fire-and-forget, clients drop if overwhelmed)
- **Client-side backpressure**: S7 dead-band filter reduces update frequency to S8/S9

#### 5. Interfaces Across All Three Stages

**S3→S4 (NATS JetStream → Ingestion)**:
- Protocol: NATS subscription to `sensors.{zone}.{sensorId}.{measurement}`
- Format: SenML (JSON or CBOR)
- Delivery: At-least-once (S4 deduplicates via seq number)
- Acknowledgment: NATS ack after successful S5 write

**S4→S5 (Ingestion → Storage)**:
- Protocol: Effect.Stream<SensorReading, IngestionError>
- Format: Internal `SensorReading` Schema (Effect.TaggedClass)
- Delivery: Stream.tap pattern (side effect on each reading)
- Error handling: Failed writes propagate to S4 for NATS nak

**S5→S6 (Storage → Client Transport)**:

*Query Interface*:
- Protocol: WebSocket JSON-RPC (request/response)
- Messages:
  - Request: `{ type: 'query', id: string, path: string, params?: {...} }`
  - Response: `{ type: 'data', correlationId: string, payload: SensorReading[] }`
- Latency: SQLite queries ~10-50ms, KV queries ~2-5ms

*Watch Interface*:
- Protocol: NATS KV watch → WebSocket push
- Messages:
  - Subscribe: `{ type: 'subscribe', id: string, pattern: string }`
  - Update: `{ type: 'update', subscriptionId: string, event: KvWatchEvent }`
- Latency: ~10-50ms from KV update to browser receive

**S6→S9 (Client Transport → React)**:
- Protocol: effect-atom (Atom.make<SensorReading>)
- Integration: `useAtomValue(sensorAtom)` triggers React render on change
- Subscription lifecycle: useEffect for subscribe/unsubscribe

**Schema Consistency Across Boundaries**:

```typescript
// Shared SensorReading schema (S4/S5/S6)
class SensorReading extends Schema.TaggedClass<SensorReading>()(
  'SensorReading',
  {
    sensorId: Schema.String.pipe(Schema.brand('SensorId')),
    zone: Schema.String,
    measurement: Schema.String,
    value: Schema.Number,
    unit: Schema.optional(Schema.String),
    timestamp: Schema.DateFromSelf,        // ISO string over wire
    ingestTimestamp: Schema.DateFromSelf,
    source: Schema.String,                 // NATS subject
    sequenceNumber: Schema.Number,         // Idempotency key
  }
) {}

// Wire format transforms (automatic via Effect Schema)
const wireTransform = Schema.transform(
  SensorReading,
  Schema.Struct({
    timestamp: Schema.String, // ISO 8601
    ingestTimestamp: Schema.String,
    // ... other fields as-is
  }),
  {
    decode: (wire) => ({
      ...wire,
      timestamp: new Date(wire.timestamp),
      ingestTimestamp: new Date(wire.ingestTimestamp),
    }),
    encode: (reading) => ({
      ...reading,
      timestamp: reading.timestamp.toISOString(),
      ingestTimestamp: reading.ingestTimestamp.toISOString(),
    }),
  }
);
```

## Rationale

### Alternatives Considered

#### 1. Single Storage Backend (SQLite Only)

**Pros**:
- Simplest architecture, single source of truth
- No dual-write complexity, no consistency reconciliation
- Powerful SQL queries (aggregates, joins, window functions)

**Cons**:
- Slow latest-value queries (requires `ORDER BY timestamp DESC LIMIT 1` per sensor)
- No reactive updates (polling required, 1s delay minimum)
- Dashboard widgets suffer (<5ms latency required, SQLite ~20-50ms)

**Rejected**: Real-time UI updates are core requirement; KV watch streams enable reactive programming model

#### 2. Single Storage Backend (NATS KV Only)

**Pros**:
- Fast latest-value access (<2ms hash lookup)
- Native watch streams for reactive updates
- Distributed-ready (JetStream clustering)

**Cons**:
- No time-range queries (KV not designed for time-series)
- Limited history (bounded by JetStream memory limits)
- Expensive range scans (must scan all keys, no indexing)

**Rejected**: Historical analysis is core requirement; SQL indexing essential for time-range queries

#### 3. KV-First Dual-Write (NATS KV → SQLite)

**Pros**:
- Optimizes hot path (KV write faster than SQLite, ~2ms vs ~5ms)
- Lower latency for real-time updates

**Cons**:
- SQLite failure leaves orphaned KV data (inconsistency)
- Harder to reconcile (SQLite is not idempotent like KV)
- KV is not transactional (can't roll back on SQLite failure)

**Rejected**: SQLite durability is critical; KV is expendable cache (can rebuild from SQLite)

#### 4. Eventual Consistency (Async KV Sync)

**Pros**:
- Decouples SQLite + KV writes (faster ingestion throughput)
- S4 only waits for SQLite (KV sync happens in background)
- Better resource utilization (batch KV writes)

**Cons**:
- KV lag during high load (stale reads on dashboard)
- Complex reconciliation (background job must track sync offset)
- Observability burden (monitoring lag metrics)

**Rejected**: MVP prefers simple consistency model; async sync deferred to optimization phase

#### 5. Message Queue Between S4-S5 (Redis Streams, Kafka)

**Pros**:
- Decouples ingestion from storage (backpressure buffering)
- Horizontal scaling of storage layer (multiple consumers)
- Replay capability (reprocess historical data)

**Cons**:
- Additional infrastructure dependency (Redis/Kafka)
- Operational overhead (cluster management)
- Latency increase (extra hop: S4 → Queue → S5)

**Rejected**: NATS JetStream already provides durable queueing (S3→S4); direct Effect.Stream sufficient for S4→S5

#### 6. WebSocket Per Sensor (Dedicated Connections)

**Pros**:
- Simpler subscription model (one WebSocket = one sensor)
- Easier to implement (no multiplexing logic)

**Cons**:
- Browser connection limits (6 per domain in HTTP/1.1)
- Server resource waste (1000 sensors = 1000 WebSockets)
- Reconnection storm (all sockets reconnect on network blip)

**Rejected**: Multiplexed WebSocket with subscription patterns (NATS wildcards) is more efficient

### Tradeoffs

| Gain | Cost |
|------|------|
| **Hot/cold separation** — KV for latest (<2ms), SQLite for history (<50ms) | Dual-write complexity — Must handle partial failures, reconciliation |
| **Real-time updates** — NATS KV watch streams push changes to browser | Memory overhead — KV bucket holds ~1000 keys × 200 bytes = 200KB RAM |
| **Schema validation** — Effect Schema catches runtime errors before storage | Validation overhead — Adds ~0.2ms per message in S4 |
| **Idempotent writes** — Duplicate messages (NATS retry) handled safely | Storage overhead — Sequence numbers in SQLite (~8 bytes/row) |
| **Automatic retention** — SQLite trigger deletes old data | CPU overhead — Trigger runs on every insert (~0.1ms penalty) |
| **Embedded storage** — SQLite requires no external service | Single-node limit — No horizontal scaling (acceptable for MVP) |
| **Unified transport** — Single WebSocket handles queries + subscriptions | State management complexity — Server tracks active subscriptions per client |
| **Connection resilience** — Auto-reconnect with subscription restore | Reconnection storms — Backoff jitter mitigates but doesn't eliminate |
| **Compression** — gzip reduces bandwidth 70% for large payloads | CPU overhead — 5-10ms encode/decode per message |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Dual-write divergence** — KV and SQLite out of sync | Low | Medium | SQLite-first order ensures KV can be rebuilt; periodic reconciliation job compares counts; alert on >1% drift |
| **SQLite write contention** — High concurrency blocks reads | Medium | Medium | WAL mode allows concurrent readers; batch writes (1000 rows/txn); consider read replica if P95 >50ms |
| **KV WebSocket instability** — Reconnection drops writes | Low | Low | Effect retry logic with exponential backoff; KV idempotency makes retries safe |
| **Disk space exhaustion** — 30-day retention grows unbounded | Low | High | Monitor disk usage; alert at 80% full; retention job runs daily; VACUUM weekly to reclaim space |
| **Deduplication cache overflow** — LRU evicts before NATS retry window | Low | Medium | Size cache for max retry delay (10k IDs ≈ 5min @ 33 msg/sec); tune based on observed retry patterns |
| **Schema validation overhead** — Slows ingestion to <1000 msg/sec | Medium | Medium | Benchmark validation performance; optimize with Schema.memoize; parallelize via Stream.mapEffectPar |
| **Query response too large** — 10k row result crashes browser | Medium | High | Enforce `limit: 1000` max; paginate large results; warn in docs; client-side virtual scrolling |
| **Subscription explosion** — Client subscribes to 1000+ sensors | Low | High | Limit subscriptions/client (100 max); server-side rate limiting; client-side pattern merging |
| **Reconnect storm** — 1000 clients reconnect simultaneously after NATS restart | Medium | High | Jittered backoff (±20%); staggered retry windows per user cohort; connection throttling |
| **Clock skew** — Client/server timestamps diverge, query ranges broken | Low | Medium | Use server timestamps for queries; client timestamps only for display; NTP sync monitoring |
| **NATS KV watch lag** — High-frequency sensors overwhelm watch stream | Medium | Medium | Client-side backpressure (drop frames if render <60fps); S7 dead-band filtering reduces update rate |

## Implementation

### File Organization

**S4 (Ingestion Layer)**:
```
/src/lib/sensor-pipeline/
├── schemas/
│   ├── senml.ts                 # SenML schema (RFC 8428)
│   ├── sensor-reading.ts        # Internal SensorReading model
│   └── validation.ts            # ValidationResult discriminated union
├── services/
│   ├── IngestionService.ts      # Main Effect.Service facade
│   ├── SensorRegistryService.ts # Sensor metadata lookup
│   ├── DeduplicationService.ts  # Message ID cache
│   └── RoutingService.ts        # Effect.Match routing logic
├── transformers/
│   └── senml-to-reading.ts      # SenML → SensorReading transform
└── index.ts                     # Barrel exports
```

**S5 (Storage Layer)**:
```
/src/lib/sensor-storage/
├── SensorStorageService.ts      # Effect.Service repository facade
├── schemas.ts                   # SensorReading model, SQLite transforms
├── repositories/
│   ├── SQLiteRepository.ts      # SQLite operations (insert, query, vacuum)
│   └── KVRepository.ts          # NATS KV wrapper (put, get, keys)
├── transforms.ts                # SenMLRecord → SensorReading logic
├── compaction.ts                # Retention policy enforcement
├── layer.ts                     # Layer composition
└── index.ts                     # Barrel exports

/scripts/
├── init-sensor-db.ts            # SQLite schema initialization
└── compaction-daemon.ts         # Background compaction job
```

**S6 (Client Transport Layer)**:
```
/src/lib/sensor-client/
├── QueryService.ts              # WebSocket query API (RPC)
├── SubscriptionManager.ts       # Subscription lifecycle
├── schemas.ts                   # ClientQuery, ServerResponse, SubscribeRequest
├── atoms/
│   ├── queries.ts               # Active queries, pending responses
│   └── subscriptions.ts         # Active subscriptions, live updates
├── hooks/
│   ├── useQuerySensor.ts        # React hook for ad-hoc queries
│   └── useSubscribeSensor.ts    # React hook for live subscriptions
└── index.ts                     # Barrel exports

/src/lib/sensor-storage/          # Server-side (S6 backend)
├── QueryRouter.ts               # WebSocket query handler (path → SQL)
├── WatchBroadcaster.ts          # NATS KV watch → WebSocket fan-out
└── index.ts

/src/lib/nats/
├── NatsClientTransport.ts       # WebSocket transport (S6 client)
├── SSETransport.ts              # SSE fallback
├── ConnectionStateMachine.ts    # XState v5 connection lifecycle
└── SSEWatchAdapter.ts           # SSE wrapper for KV watch
```

### Dependencies

```json
{
  "dependencies": {
    "@effect/schema": "^0.75.0",
    "@effect/sql": "latest",
    "@effect/sql-sqlite-bun": "latest",
    "effect": "^3.0.0",
    "effect-atom": "latest",
    "nats.ws": "^1.28.0",
    "better-sqlite3": "^11.0.0",
    "xstate": "^5.0.0"
  }
}
```

**No new dependencies required** — All technologies already in TMNL stack.

### Database Schema

**SQLite (Historical Storage)**:
```sql
-- Sensor readings table (time-series data)
CREATE TABLE IF NOT EXISTS sensor_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sensor_id TEXT NOT NULL,
  zone TEXT NOT NULL,
  measurement TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  timestamp INTEGER NOT NULL,      -- Unix epoch ms (sensor time)
  ingest_ts INTEGER NOT NULL,      -- Unix epoch ms (ingestion time)
  source TEXT NOT NULL,            -- NATS subject (e.g., sensors.zone1.temp-42)
  seq INTEGER NOT NULL,            -- NATS sequence (idempotency)

  -- Idempotency constraint
  UNIQUE(source, seq),

  -- Query indexes
  INDEX idx_sensor_time ON sensor_readings(sensor_id, timestamp DESC),
  INDEX idx_zone_time ON sensor_readings(zone, timestamp DESC),
  INDEX idx_measurement_time ON sensor_readings(measurement, timestamp DESC)
);

-- Auto-delete trigger (30-day retention)
CREATE TRIGGER IF NOT EXISTS cleanup_old_readings
AFTER INSERT ON sensor_readings
BEGIN
  DELETE FROM sensor_readings
  WHERE timestamp < (strftime('%s', 'now') - 2592000) * 1000;
END;

-- Performance settings
PRAGMA journal_mode = WAL;        -- Write-ahead logging (concurrent reads)
PRAGMA synchronous = NORMAL;      -- Balance safety vs performance
PRAGMA cache_size = -64000;       -- 64MB cache
```

**NATS KV Bucket (Latest State)**:
```bash
# Create KV bucket for hot cache
nats kv add SENSOR_STATE \
  --history 1 \              # Only latest revision
  --ttl 3600 \               # 1 hour TTL (auto-cleanup stale sensors)
  --replicas 1 \             # Single replica (dev), 3 in production
  --storage file \           # File-backed (persistent across restarts)
  --description "Latest sensor values (hot cache)"

# Key pattern: sensor.{zone}.{sensorId}
# Example: sensor.zone1.temp-42
# Value: JSON { value: 23.5, unit: "Cel", timestamp: "2026-01-02T15:30:00Z", source: "sensors.zone1.temp-42" }
```

### Test Strategy

**Unit Tests** (`@effect/vitest`):

*S4 (Ingestion)*:
1. Schema Validation:
   - Valid SenML → decodes successfully
   - Invalid SenML (missing fields) → ParseError
   - Out-of-range values → ValidationResult.OutOfRange

2. Transformation:
   - SenML base name expansion (`bn` + `n` = sensorId)
   - Timestamp calculation (`bt` + `t`)
   - Metadata enrichment (ingestTimestamp, source, seq)

3. Deduplication:
   - First message → not duplicate
   - Repeated message ID → duplicate detected
   - LRU eviction → old IDs removed

4. Routing:
   - Valid reading → routed to storage stream
   - Invalid schema → routed to DLQ
   - Duplicate → dropped

*S5 (Storage)*:
1. Dual-Write Success:
   - Mock SQLite + KV → assert both called
   - Verify transaction order (SQLite first)

2. Dual-Write Partial Failure:
   - SQLite succeeds, KV fails → retry KV, eventually succeeds
   - SQLite fails → entire write rejected

3. Idempotency:
   - Write same reading twice → second write CONFLICT DO NOTHING
   - KV accepts duplicate (supersede)

4. Retention:
   - Insert 31-day-old reading → trigger deletes immediately
   - VACUUM reclaims disk space

*S6 (Client Transport)*:
1. Query Correlation:
   - Send query with `id: 'abc123'`
   - Assert response has `correlationId: 'abc123'`

2. Subscription Lifecycle:
   - Subscribe to pattern → assert SubscribeAck
   - Publish to KV → assert UpdateEvent received
   - Unsubscribe → assert no more events

3. Reconnection:
   - Simulate disconnect → reconnect
   - Assert subscriptions restored from localStorage

4. SSE Fallback:
   - Block WebSocket → assert fallback to SSE
   - Verify read-only updates still work

**Integration Tests** (Docker Compose + NATS + SQLite):

1. End-to-End Persistence (S3→S4→S5):
   - Publish SenML to NATS JetStream
   - Assert: Reading in SQLite, latest value in KV
   - Verify: Dual-write consistency

2. Live Update Flow (S5→S6→Browser):
   - Client subscribes to `zone1.*.temperature`
   - Publish to KV `zone1.temp-42.temperature`
   - Assert: UpdateEvent received within 100ms

3. Query API (S6→S5):
   - Insert 100 readings in SQLite
   - WebSocket query `/sensors/temp-42/history?start=now-1h`
   - Assert: 100 rows returned, paginated correctly

4. Reconnection Recovery (S6):
   - Establish connection, subscribe to 5 sensors
   - Kill WebSocket → reconnect
   - Assert: All 5 subscriptions restored
   - Verify: No duplicate events

5. Concurrent Writes (S4→S5):
   - Write 1000 readings in parallel
   - Assert: All in SQLite, no duplicates (UNIQUE constraint)
   - Assert: All KV entries present

**Load Tests** (optional, deferred):
- Sustained 10k writes/sec for 10 minutes
- Measure: SQLite P95 latency, KV write latency, watch stream lag
- Target: P95 <10ms SQLite, <5ms KV, <50ms end-to-end

## Metadata

### Related ADRs

**Isolated Stage ADRs**:
- **ADR-S4** (Ingestion Layer) — SensorReading schema, validation, routing
- **ADR-S5** (Storage Layer) — Dual-write architecture, retention policies
- **ADR-S6** (Client Transport) — WebSocket lifecycle, reconnection, SSE fallback

**Adjacent Pair ADRs**:
- **ADR-S3-S4** (Transport-Ingestion) — NATS consumer groups, ACK semantics
- **ADR-S4-S5** (Ingestion-Storage) — Schema-to-model transformation, dual-write transaction
- **ADR-S5-S6** (Storage-Client) — Query API, watch streams, subscription lifecycle

**Synergy Pair ADRs**:
- **ADR-S3-S7** (Filter Placement) — Where dead-band filtering occurs (S4 vs S7)
- **ADR-S2-S8** (Offline-First) — Client-side caching for disconnected operation

**Future Triplets**:
- **ADR-S6-S7-S8** (Client-side data plane) — Transport → Filtering → State atoms
- **ADR-S1-S4-S9** (End-to-end latency) — Physical sensor → browser DOM latency budget

### Open Questions

1. **Schema evolution strategy** — How to handle SensorReading schema changes without breaking existing SQLite data?
   - Option A: SQLite migrations (ALTER TABLE)
   - Option B: Schema versioning (sensor_readings_v1, sensor_readings_v2)
   - Option C: JSON column for flexible schema (trade performance for flexibility)

2. **Read scaling threshold** — At what query P95 latency do we migrate from SQLite to TimescaleDB?
   - Current: SQLite acceptable for P95 <50ms
   - Trigger: If P95 >100ms sustained for 1 week, evaluate migration

3. **Multi-zone isolation** — Should each zone have a separate SQLite database?
   - Pros: Isolation, smaller files, easier sharding
   - Cons: Cross-zone queries require JOIN, operational overhead

4. **KV bucket granularity** — Single bucket vs per-zone buckets?
   - Single: Simpler, harder to apply per-zone policies
   - Per-zone: Better isolation, more configuration overhead

5. **Compaction frequency** — Weekly VACUUM sufficient, or dynamic based on disk usage?
   - Weekly: Predictable, simpler
   - Dynamic: More efficient, requires monitoring + orchestration

6. **Subscription deduplication** — If client subscribes to overlapping patterns (`zone1.*`, `zone1.temp-42`), how to merge?
   - Server-side: Merge patterns before creating watch streams
   - Client-side: Accept duplicate events, deduplicate by revision number

7. **Query caching** — Should repeated queries (same params) return cached results? TTL?
   - Server-side: Cache in memory with 30s TTL
   - Client-side: Cache in IndexedDB with 5min TTL
   - Decision: Client-side caching deferred to S8 (State Layer)

8. **Backpressure signaling** — Should server pause KV watch if client can't keep up?
   - WebSocket buffer depth monitoring → send backpressure signal
   - Client applies dead-band filter (S7) to reduce update rate
   - Server does not pause (watch streams are fire-and-forget)

9. **Metrics exposure** — Should server expose active subscription count, query rate via special query path?
   - `/metrics` query path returns JSON stats
   - Prometheus endpoint for production monitoring

10. **Multi-tab coordination** — Should tabs share subscriptions via BroadcastChannel?
    - Leader election: One tab owns WebSocket, broadcasts to others
    - Simpler: Each tab maintains own WebSocket (acceptable for MVP)

### References

**Codebase**:
- NATS KV Service: `/src/lib/nats/NatsKVService.ts`
- SSEAdapter pattern: `/src/lib/ai-core/services/SSEAdapter.ts`
- SQL repositories: `/src/lib/editor/v3/persistence/repositories.ts`
- SQLite persistence: `/src/lib/durable-streams/server/persistence.ts`
- Connection atoms: `/src/lib/dataplane/atoms/index.ts`
- XState stx pattern: `/src/lib/dataplane/components/Port/port-stx.ts`
- Schema helpers: `/src/lib/editor/v3/persistence/sqlite-helpers.ts`

**Documentation**:
- Effect Schema: `../../submodules/website/content/docs/schema/`
- Effect.Stream: `../../submodules/website/content/docs/guides/streaming/`
- NATS server config: `/docker/nats/nats-server.conf`

**External**:
- SenML RFC 8428: https://datatracker.ietf.org/doc/html/rfc8428
- NATS KV: https://docs.nats.io/nats-concepts/jetstream/key-value-store
- NATS wildcards: https://docs.nats.io/nats-concepts/subjects#wildcards
- SQLite WAL: https://sqlite.org/wal.html
- SQLite JSON1: https://sqlite.org/json1.html
- nats.ws library: https://github.com/nats-io/nats.ws
- EventSource API: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- WebSocket compression: https://tools.ietf.org/html/rfc7692

### Design Principles

1. **Defense in depth** — Validate at ingestion (S4) even if edge claims to validate
2. **Fail explicitly** — Invalid messages go to DLQ, not silent discard
3. **Idempotent by default** — Deduplication + UNIQUE constraints handle retries
4. **Stream-native** — Effect.Stream throughout, no imperative loops or mutable state
5. **Observable failures** — Every error emits metric + DLQ entry for debugging
6. **Type-safe transformations** — Effect Schema enforces contracts at runtime
7. **SQLite as source of truth** — KV is expendable cache, rebuild from SQLite if diverged
8. **Eventual consistency acceptable** — S5→S6 lag <50ms is imperceptible to users
9. **Unified transport** — Single WebSocket reduces connection overhead, simplifies client
10. **Progressive enhancement** — WebSocket primary, SSE fallback for restrictive networks
