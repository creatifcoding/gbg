---
id: "S3-S4"
title: "Transport → Ingestion Integration"
commitHash: "6656064"
status: "draft"
date: "2026-01-02"
tier: "pair-adjacent"
stages: ["S3", "S4"]
---

# ADR-S3-S4: Transport → Ingestion Integration

## Context

### Stages Covered
- S3 (Transport) — NATS JetStream broker
- S4 (Ingestion) — Effect.Service validation/transformation layer

### Problem

The ingestion service (S4) must consume sensor data from the NATS JetStream broker (S3) with the following requirements:

1. **Dynamic subscription patterns** — Subscribe to all sensors (`sensors.>`), specific zones (`sensors.zone1.*`), or individual sensors
2. **Horizontal scaling** — Multiple ingestion workers must share load via consumer groups
3. **Replay capability** — Recover from failures by replaying messages from a known offset (durable consumers)
4. **Backpressure handling** — Prevent memory exhaustion when ingestion processing slower than publish rate
5. **Error isolation** — Schema validation failures must not crash the entire ingestion pipeline
6. **Message acknowledgment** — Reliably ack successful processing, nack transient failures, route poison pills to DLQ

The transport-to-ingestion boundary is **the first validation checkpoint** — invalid SenML from S2 (Edge) must be caught here before corrupting downstream storage (S5).

### Constraints

- **NATS JetStream already configured** — WebSocket transport on port 9222 (see `docker/nats/nats-server.conf`)
- **nats.ws client library** — Browser-compatible WebSocket NATS (already used in NatsKVService)
- **Effect.Stream patterns mandatory** — Use `Stream.async` for callback-based NATS subscriptions (see `/src/lib/nats/NatsKVService.ts:343`)
- **Effect Schema validation** — All sensor payloads must validate against `SenMLPack` schema before processing
- **Consumer durability required** — Ingestion must survive restarts without message loss
- **Manual acknowledgment required** — Auto-ack disabled; explicit ack/nak after processing

### Assumptions

- NATS server runs co-located with TMNL (localhost, low latency)
- Single NATS cluster (no multi-datacenter federation in MVP)
- Message ordering within a single sensor stream is important (partition key: sensor ID)
- Max message rate: 10k msgs/sec aggregate (hundreds of sensors × 1-10 Hz each)
- Consumer ack timeout: 30 seconds (processing SLA)
- Dead Letter Queue (DLQ) capacity: 1000 messages (investigation buffer)

## Decision

### Summary

Use **NATS JetStream pull consumers with wildcard subscriptions** (`sensors.>`) to ingest sensor streams into an **Effect.Stream processing pipeline**. Wrap NATS message callbacks in `Stream.async` (TMNL's standard pattern for external push sources), validate with Effect Schema, and route to parallel processing fibers with bounded queues for backpressure. Implement **three-tier acknowledgment strategy**: immediate ack on success, delayed nack+requeue on transient errors, DLQ publish on permanent failures.

### Technologies

| Technology | Version | Purpose | File Reference |
|------------|---------|---------|----------------|
| NATS JetStream | 2.x | Durable pub/sub broker | `docker/nats/nats-server.conf` |
| nats.ws | ^1.28.0 | WebSocket NATS client | `/src/lib/nats/NatsKVService.ts` (already installed) |
| Effect.Stream | latest | Reactive stream processing | `/src/lib/connection-ports/services/NatsPort.ts:158` |
| Effect Schema | latest | Runtime validation | `/src/lib/editor/v3/persistence/sqlite-helpers.ts` |
| Effect.Queue | latest | Bounded backpressure buffer | TMNL standard pattern |

### Patterns

#### 1. Subject Subscription Pattern

**Wildcard Subscriptions**:
- **All sensors**: `sensors.>` (catch-all)
- **Zone-specific**: `sensors.zone1.*` (all sensors in zone1)
- **Measurement-specific**: `sensors.*.temperature` (all temperature sensors)
- **Single sensor**: `sensors.zone1.temp-42` (exact match)

**Consumer Groups** (horizontal scaling):
- Consumer group name: `ingestion-workers`
- Multiple ingestion workers subscribe to same consumer
- NATS round-robins messages across workers (load distribution)
- Each message delivered to exactly one worker

**Durable Consumers** (replay capability):
- Consumer name: `ingestion-durable-v1`
- Durable flag: `true` (survives process restarts)
- Ack policy: `explicit` (manual ack required)
- Replay policy: `instant` (catch-up from last ack, then live)
- Max deliver: `3` (retry limit before DLQ)

#### 2. Effect.Stream Integration

**Stream.async for NATS Callback Bridge** (canonical TMNL pattern):

```typescript
const createSensorStream = (
  nc: NatsConnection,
  subject: string
): Stream.Stream<NatsMessage, NatsSubscriptionError> =>
  Stream.async<NatsMessage, NatsSubscriptionError>((emit) => {
    let subscription: JetStreamSubscription | null = null;

    const run = async () => {
      const js = nc.jetstream();
      const consumer = await js.consumers.get('SENSORS', 'ingestion-durable-v1');

      subscription = await consumer.consume({
        max_messages: 1000, // Fetch batch size
        expires: 30_000,    // Re-fetch if no messages after 30s
      });

      for await (const msg of subscription) {
        emit.single(msg); // Push to Effect.Stream
      }

      emit.end();
    };

    run().catch((err) => {
      emit.fail(new NatsSubscriptionError(`Subscription failed: ${err}`, err));
    });

    // Cleanup on stream interruption
    return Effect.sync(() => {
      subscription?.unsubscribe();
    });
  });
```

**Backpressure via Bounded Queue**:

```typescript
export const ingestSensorStream = (subject: string) =>
  Effect.gen(function* () {
    const natsStream = createSensorStream(nc, subject);

    // Bounded queue prevents memory exhaustion
    const queue = yield* Queue.bounded<NatsMessage>(1000);

    // Producer fiber: NATS → Queue
    yield* Stream.runIntoQueue(natsStream, queue).pipe(
      Effect.forkScoped
    );

    // Consumer fiber: Queue → Processing
    return Stream.fromQueue(queue).pipe(
      Stream.mapEffect(processMessage), // Schema validation + transform
      Stream.tap(ackMessage),            // Ack on success
      Stream.catchAll(handleError)       // Nack/DLQ on failure
    );
  });
```

#### 3. Message Processing Pipeline

**Sequential Processing Steps** (Effect.gen):

1. **Parse SenML** — Decode NATS msg.data (Uint8Array → JSON)
2. **Validate Schema** — `Schema.decodeUnknown(SenMLPack)`
3. **Transform** — SenMLPack → individual SensorReading records
4. **Route** — Write to S5 (Storage) via dual-write (KV + SQLite)

```typescript
const processMessage = (msg: NatsMessage) =>
  Effect.gen(function* () {
    // Step 1: Parse JSON
    const json = yield* Effect.try({
      try: () => JSON.parse(new TextDecoder().decode(msg.data)),
      catch: (e) => new ParseError(`Invalid JSON: ${e}`)
    });

    // Step 2: Validate Schema
    const pack = yield* Schema.decodeUnknown(SenMLPack)(json);

    // Step 3: Transform (SenML base expansion + normalize)
    const readings = yield* expandSenMLPack(pack);

    // Step 4: Route to storage (S5)
    yield* Effect.forEach(readings, (r) =>
      SensorStorageService.write(r)
    );

    return { message: msg, readings };
  });
```

**Parallel Processing with Bounded Concurrency** (avoid overwhelming S5):

```typescript
Stream.fromQueue(queue).pipe(
  Stream.mapEffect(processMessage, { concurrency: 10 }) // Max 10 parallel
)
```

#### 4. Acknowledgment Strategy

**Three-Tier Ack Policy**:

1. **Success → Ack Immediately**:
   - Message processed, validation passed, storage succeeded
   - `msg.ack()` — Remove from JetStream (no redelivery)

2. **Transient Failure → Nak + Requeue**:
   - Network timeout, storage unavailable, backpressure
   - `msg.nak(30_000)` — Requeue for retry after 30s delay
   - Max retries: 3 (configured in consumer `max_deliver`)

3. **Permanent Failure → DLQ**:
   - Schema validation failure, malformed SenML, poison pill
   - `msg.term()` — Terminate redelivery (mark as failed)
   - Publish to DLQ subject: `sensors.dlq.{originalSubject}`
   - DLQ message includes: original msg, error details, timestamp

```typescript
const handleError = (error: Error, msg: NatsMessage) =>
  Effect.gen(function* () {
    if (isTransientError(error)) {
      // Nack + requeue (network errors, timeouts)
      yield* Effect.tryPromise(() => msg.nak(30_000));
      yield* Effect.logWarning(`Transient error, requeued: ${error}`);
    } else {
      // Permanent failure → DLQ
      yield* Effect.tryPromise(() => msg.term());
      yield* publishToDLQ(msg, error);
      yield* Effect.logError(`Permanent error, sent to DLQ: ${error}`);
    }
  });

const isTransientError = (e: Error): boolean =>
  e.message.includes('timeout') ||
  e.message.includes('unavailable') ||
  e.message.includes('ECONNREFUSED');
```

### Interfaces

| Interface | From | To | Protocol | Schema |
|-----------|------|-----|----------|--------|
| NATS Message | S3 | S4 | JetStream pull | `NatsMessage { subject, data: Uint8Array, headers, ack(), nak() }` |
| SenML Payload | S3 | S4 | JSON over NATS | `SenMLPack` (Effect Schema) |
| Ingestion Output | S4 | S5 | Effect.Stream | `SensorReading { sensorId, zone, measurement, value, unit, timestamp }` |
| DLQ Message | S4 | S3 | NATS publish | `DLQEntry { originalSubject, error, payload, timestamp }` |

**Message Schemas** (Effect Schema):

```typescript
// SenML Pack (RFC 8428)
class SenMLRecord extends Schema.Class<SenMLRecord>('SenMLRecord')({
  bn: Schema.optional(Schema.String),  // base name
  n: Schema.optional(Schema.String),   // name
  v: Schema.optional(Schema.Number),   // value
  u: Schema.optional(Schema.String),   // unit
  t: Schema.optional(Schema.Number),   // time (Unix epoch)
  bt: Schema.optional(Schema.Number),  // base time
}) {}

const SenMLPack = Schema.Array(SenMLRecord);

// Ingestion Output (normalized)
class SensorReading extends Schema.TaggedClass<SensorReading>()(
  'SensorReading',
  {
    sensorId: Schema.String,
    zone: Schema.String,
    measurement: Schema.String,
    value: Schema.Number,
    unit: Schema.optional(Schema.String),
    timestamp: Schema.DateFromSelf, // Parsed from SenML t+bt
  }
) {}

// DLQ Entry (error capture)
class DLQEntry extends Schema.TaggedClass<DLQEntry>()(
  'DLQEntry',
  {
    originalSubject: Schema.String,
    payload: Schema.Uint8Array,
    error: Schema.String,
    errorStack: Schema.optional(Schema.String),
    timestamp: Schema.DateFromSelf,
    deliveryCount: Schema.Number, // NATS redelivery count
  }
) {}
```

## Rationale

### Alternatives Considered

1. **NATS Core (non-JetStream)**
   - **Pros**: Simpler, lower latency, no storage overhead
   - **Cons**: No message persistence (fire-and-forget), no replay, no consumer durability
   - **Rejected**: Ingestion failures would lose data; durability required for reliability

2. **Kafka**
   - **Pros**: Industry-standard streaming, mature ecosystem, built-in partitioning
   - **Cons**: Heavy operational overhead, external dependency, overkill for MVP
   - **Rejected**: NATS JetStream provides 80% of Kafka features with embedded deployment

3. **RabbitMQ Streams**
   - **Pros**: Mature message broker, rich routing, persistent queues
   - **Cons**: Higher latency than NATS, less native stream semantics
   - **Rejected**: NATS JetStream optimized for streaming + TMNL already uses NATS for KV

4. **Direct HTTP/SSE from S2**
   - **Pros**: Simplest architecture (no broker), fewer moving parts
   - **Cons**: No buffering (backpressure issues), no multi-consumer, no replay
   - **Rejected**: Broker decouples producers/consumers, essential for horizontal scaling

### Tradeoffs

| Gain | Cost |
|------|------|
| **Replay capability** — Durable consumers enable replaying from last ack | Storage overhead — JetStream stores messages until ack (disk space) |
| **Horizontal scaling** — Consumer groups distribute load across workers | Coordination overhead — NATS manages consumer state (CPU) |
| **Backpressure** — Bounded Queue prevents memory exhaustion | Latency penalty — Queue adds ~1-5ms delay vs direct processing |
| **Schema validation** — Catches malformed SenML before storage corruption | Processing overhead — Effect Schema adds ~0.5ms validation time |
| **Explicit ack** — Fine-grained control (ack on success, nak on failure) | Complexity — Must implement ack/nak logic vs auto-ack |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Consumer lag** — Processing slower than publish rate, messages accumulate | Medium | High | Monitor consumer lag (NATS `pending` metric); alert if >1000 messages; scale workers horizontally |
| **DLQ overflow** — Poison pills fill DLQ faster than investigation | Low | Medium | DLQ size limit (1000 msgs); oldest entries auto-purged; alert on >800 msgs |
| **Schema evolution breakage** — SenML schema change breaks validation | Medium | High | Schema versioning (`SenMLPackV1`, `SenMLPackV2`); backward-compatible decoding; subject versioning (`sensors.v1.>`) |
| **Ack timeout** — Processing exceeds 30s, NATS redelivers message | Low | Medium | Tune ack timeout based on P95 processing latency; current 30s sufficient for P99 <10s |
| **Memory exhaustion** — Bounded queue (1000 msgs) too small, drops messages | Low | High | Dynamic queue sizing based on backpressure; alert if queue >90% full; increase workers |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `/src/lib/sensor-ingestion/IngestionService.ts` | create | Effect.Service wrapping NATS → Effect.Stream → processing pipeline |
| `/src/lib/sensor-ingestion/schemas.ts` | create | SenMLPack, SenMLRecord, SensorReading, DLQEntry schemas |
| `/src/lib/sensor-ingestion/transform.ts` | create | SenML base expansion logic (bn+n, bt+t normalization) |
| `/src/lib/sensor-ingestion/ack-strategy.ts` | create | Ack/nak/DLQ routing logic with transient error detection |
| `/src/lib/sensor-ingestion/stream-factory.ts` | create | `createSensorStream()` — Stream.async wrapper for NATS |
| `/src/lib/sensor-ingestion/layer.ts` | create | Layer composition: NatsKVService + SensorStorageService deps |
| `/src/lib/nats/consumers/sensor-consumer.ts` | create | NATS consumer config (durable, ack policy, max deliver) |
| `/scripts/ingestion-worker.ts` | create | Bun script to run ingestion worker (systemd service) |

### Dependencies

```json
{
  "nats.ws": "^1.28.0",      // Already installed
  "@effect/schema": "latest", // Already installed
  "effect": "latest"          // Already installed
}
```

**No new dependencies required** — reuse TMNL's existing NATS + Effect stack.

### Migrations

**NATS Stream Configuration** (via NATS CLI or management API):

```bash
# Create SENSORS stream (if not exists)
nats stream add SENSORS \
  --subjects "sensors.>" \
  --storage file \
  --retention limits \
  --max-age 24h \
  --max-msgs 10000000 \
  --max-bytes 10GB \
  --discard old

# Create durable consumer
nats consumer add SENSORS ingestion-durable-v1 \
  --ack explicit \
  --deliver all \
  --replay instant \
  --max-deliver 3 \
  --ack-wait 30s \
  --filter-subject "sensors.>"
```

**Schema Migration**: None (new service, no existing data)

### Test Strategy

**Unit Tests** (`@effect/vitest`):

1. **SenML Parsing**:
   - Input: Valid SenMLPack JSON
   - Output: Array of SenMLRecord
   - Assert: Base name/time expansion correct

2. **Schema Validation**:
   - Input: Invalid SenML (missing required fields)
   - Output: ParseError with clear message
   - Assert: Error includes field name + validation rule

3. **Ack Strategy**:
   - Input: Transient error (timeout)
   - Output: `msg.nak()` called
   - Assert: Retry count incremented

4. **DLQ Routing**:
   - Input: Permanent error (schema validation failure)
   - Output: Message published to `sensors.dlq.zone1.temp-42`
   - Assert: DLQEntry includes original payload + error

**Integration Tests** (Docker Compose + NATS):

1. **End-to-End Ingestion**:
   - Publish SenML to `sensors.zone1.temp-42`
   - Start ingestion worker
   - Assert: SensorReading written to S5 (KV + SQLite)
   - Assert: Message acked (no redelivery)

2. **Consumer Durability**:
   - Publish 10 messages
   - Process 5, crash ingestion worker
   - Restart worker
   - Assert: Remaining 5 messages replayed from offset

3. **Backpressure**:
   - Publish 2000 messages (exceeds queue size 1000)
   - Slow down S5 processing (simulate contention)
   - Assert: Queue fills to 1000, NATS slows delivery (backpressure)

4. **DLQ Flow**:
   - Publish malformed SenML (invalid JSON)
   - Assert: Message sent to DLQ after 3 retries
   - Assert: Original message in DLQ, error details logged

**Load Tests** (optional, deferred):
- Sustained 10k msgs/sec for 10 minutes
- Measure: Consumer lag, processing latency P95, DLQ rate
- Target: Lag <1000 msgs, P95 <10ms, DLQ <0.1%

## Metadata

### Related ADRs
- **ADR-S3** (Transport Layer) — NATS JetStream broker configuration
- **ADR-S4** (Ingestion Layer) — Internal ingestion service architecture
- **ADR-S4-S5** (Ingestion-Storage integration) — Dual-write to KV + SQLite
- **ADR-S2-S3** (Edge-Transport integration) — SenML publish from Rust gateway

### Open Questions

1. **Subject naming convention** — Should zones be in subject hierarchy (`sensors.zone1.temp-42`) or in message metadata?
2. **Consumer group sizing** — How many ingestion workers needed for 10k msgs/sec? (Benchmark required)
3. **DLQ investigation workflow** — How do operators review/republish DLQ messages? (UI? CLI?)
4. **Schema evolution strategy** — When SenML schema changes, do we version subjects (`sensors.v2.>`) or use backward-compatible Schema transforms?
5. **Metrics collection** — Which NATS consumer metrics matter most? (Lag, pending, redelivery rate)
6. **Multi-tenancy** — Should different zones use separate NATS streams (`SENSORS_ZONE1`, `SENSORS_ZONE2`) for isolation?

### References

- NATS JetStream docs: https://docs.nats.io/nats-concepts/jetstream
- SenML RFC 8428: https://datatracker.ietf.org/doc/html/rfc8428
- TMNL NatsKVService: `/src/lib/nats/NatsKVService.ts`
- TMNL Stream.async patterns: `/src/lib/connection-ports/services/NatsPort.ts:158`
- Effect.Stream docs: `../../submodules/website/content/docs/guides/streaming/`
- Consumer durability: https://docs.nats.io/nats-concepts/jetstream/consumers
