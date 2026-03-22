---
id: "S4"
title: "Ingestion Layer — Effect.Service Validation"
commitHash: "6656064"
status: "draft"
date: "2026-01-02"
tier: "isolated"
stages: ["S4"]
---

# ADR-S4: Ingestion Layer

## Context

### Stages Covered
- S4 (Ingestion)

### Problem

Raw sensor telemetry arriving from the transport layer (S3) requires validation, transformation, and routing before it can be stored or processed. The ingestion layer must:

1. **Validate message schemas** — Reject malformed SenML payloads, invalid timestamps, out-of-range values
2. **Transform to internal format** — Convert SenML (standardized sensor format) to domain-specific schemas optimized for TMNL
3. **Deduplicate messages** — Handle at-least-once delivery from NATS (duplicate detection via message ID + timestamp)
4. **Enrich metadata** — Add ingestion timestamp, zone metadata, sensor type classification
5. **Route by rules** — Direct high-priority alerts to real-time stream, batch data to storage, anomalies to dead letter queue
6. **Handle errors gracefully** — Quarantine invalid messages without crashing the pipeline, emit metrics for monitoring

The ingestion layer is the **gatekeeper** — it ensures only clean, validated data enters downstream systems (S5 storage, S6 processing). Failures here corrupt the entire pipeline.

### Constraints

- **Effect Schema validation required** — All incoming messages must validate against Effect Schema (runtime type safety)
- **Stream-based architecture** — Must process NATS streams (Effect.Stream) without blocking or memory leaks
- **Idempotent operations** — Duplicate messages (from NATS retry) must not cause duplicate storage/processing
- **No data loss** — Invalid messages go to dead letter queue, not /dev/null
- **Integration with S3** — Must consume from NATS JetStream consumer groups (see ADR-S3)
- **Integration with S5** — Must emit validated streams to storage layer (DuckDB/ClickHouse)
- **Minimal latency** — P95 latency <50ms from NATS receive to validated output
- **Observable** — Emit metrics (validation failures, throughput, latency) for monitoring

### Assumptions

- NATS connection is healthy (handled by S3 NatsStreamService)
- SenML is the standard sensor format (JSON or CBOR encoding)
- Message IDs are globally unique (edge devices use UUID v7 or ULID)
- Sensor metadata is available from a registry (zone mappings, sensor types, units)
- Dead letter queue consumers exist (manual review, alerting)
- Schema evolution is handled externally (schema registry in S6, not S4's concern)

## Decision

### Summary

Implement ingestion as an **Effect.Service** that consumes NATS streams, validates against SenML schemas, transforms to internal `SensorReading` format, deduplicates via Ref-based cache, and routes to downstream streams (storage, real-time, DLQ) using Effect.Match pattern matching.

### Technologies

| Technology | Version | Purpose | File Reference |
|------------|---------|---------|----------------|
| Effect.Service | 3.x | Service composition | `/src/lib/nats/NatsKVService.ts` |
| Effect.Schema | 0.75+ | Runtime validation | `/src/lib/connection-ports/schemas/artifacts.ts` |
| Effect.Stream | 3.x | Stream transformation | `/src/lib/ai-core/services/SSEAdapter.ts` |
| Effect.Ref | 3.x | Deduplication cache | `/src/lib/ai-core/services/SSEAdapter.ts:78` |
| Effect.Match | 3.x | Routing logic | Throughout codebase |
| SenML | RFC 8428 | Sensor format | External standard |
| NATS JetStream | 2.x | Transport input | `/docker/nats/nats-server.conf` |

### Patterns

- **Effect.Service for pipeline stage**: Encapsulates ingestion logic as a composable service with Layer dependencies (NatsStreamService, SensorRegistryService)

- **Stream.mapEffect for validation**: Transform incoming NATS messages via Schema validation:
  ```typescript
  Stream.mapEffect((msg) =>
    Effect.gen(function* () {
      const decoded = yield* Schema.decodeUnknown(SenMLMessage)(msg.payload)
      return yield* transformToSensorReading(decoded)
    })
  )
  ```

- **Ref-based deduplication**: Use Effect.Ref + HashMap for LRU cache of message IDs (last 10k messages, 5-minute TTL):
  ```typescript
  const seenIds = yield* Ref.make(HashMap.empty<MessageId, Timestamp>())
  const isDuplicate = (id: MessageId) =>
    Ref.get(seenIds).pipe(Effect.map(HashMap.has(id)))
  ```

- **Effect.Match for routing**: Pattern match on validation result to route messages:
  ```typescript
  Effect.Match.value(result).pipe(
    Match.tag('Valid', (r) => Stream.fromEffect(storageStream.emit(r.reading))),
    Match.tag('InvalidSchema', (e) => Stream.fromEffect(dlqStream.emit(e))),
    Match.tag('Duplicate', () => Stream.empty),
    Match.exhaustive
  )
  ```

- **TaggedClass for domain types**: Internal sensor reading representation:
  ```typescript
  class SensorReading extends Schema.TaggedClass<SensorReading>()('SensorReading', {
    id: Schema.UUID,
    sensorId: Schema.String,
    zone: Schema.String,
    measurementType: Schema.Literal('temperature', 'humidity', 'pressure', ...),
    value: Schema.Number,
    unit: Schema.String,
    timestamp: Schema.DateFromSelf,
    ingestedAt: Schema.DateFromSelf,
    metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
  }) {}
  ```

- **Error handling with discriminated unions**: Validation results as tagged unions:
  ```typescript
  type ValidationResult =
    | { _tag: 'Valid'; reading: SensorReading }
    | { _tag: 'InvalidSchema'; error: ParseResult.ParseError; raw: unknown }
    | { _tag: 'Duplicate'; messageId: string }
    | { _tag: 'OutOfRange'; field: string; value: number }
  ```

### Interfaces

| Interface | Protocol | Schema |
|-----------|----------|--------|
| S3→S4 | NATS subscription | `sensors.{zone}.{sensorId}.{measurement}` (SenML payload) |
| S4→S5 | Effect.Stream | `Stream<SensorReading, IngestionError>` |
| S4→DLQ | Effect.Stream | `Stream<InvalidMessage, never>` |
| S4→Metrics | Effect.Effect | `Effect<void, never>` (fire-and-forget metrics emission) |

**Input Schema** (SenML - Sensor Measurement Lists, RFC 8428):
```typescript
// SenML Record
class SenMLRecord extends Schema.TaggedClass<SenMLRecord>()('SenMLRecord', {
  bn: Schema.optional(Schema.String), // Base name
  bt: Schema.optional(Schema.Number), // Base time
  bu: Schema.optional(Schema.String), // Base unit
  n: Schema.optional(Schema.String),  // Name
  u: Schema.optional(Schema.String),  // Unit
  v: Schema.optional(Schema.Number),  // Value (numeric)
  vs: Schema.optional(Schema.String), // Value (string)
  vb: Schema.optional(Schema.Boolean), // Value (boolean)
  vd: Schema.optional(Schema.String), // Value (data - base64)
  t: Schema.optional(Schema.Number),  // Time offset
  ut: Schema.optional(Schema.Number), // Update time
}) {}

// SenML Message (array of records)
const SenMLMessage = Schema.Array(SenMLRecord)
```

**Output Schema** (Internal - optimized for TMNL):
```typescript
class SensorReading extends Schema.TaggedClass<SensorReading>()('SensorReading', {
  id: Schema.UUID,                    // Message ID (deduplication)
  sensorId: Schema.String,            // Sensor identifier
  zone: Schema.String,                // Zone (from routing or metadata)
  measurementType: MeasurementType,   // temperature | humidity | pressure | ...
  value: Schema.Number,               // Normalized value
  unit: Schema.String,                // Unit (SI preferred)
  timestamp: Schema.DateFromSelf,     // Sensor timestamp
  ingestedAt: Schema.DateFromSelf,    // Ingestion timestamp
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown))
}) {}

const MeasurementType = Schema.Literal(
  'temperature', 'humidity', 'pressure', 'co2', 'light',
  'motion', 'voltage', 'current', 'power', 'unknown'
)
```

## Rationale

### Alternatives Considered

1. **Validation at edge (S2)**
   - **Pros**: Reduces load on ingestion, fails fast at source
   - **Cons**: Edge devices are untrusted, schema evolution requires edge firmware updates, no central enforcement
   - **Rejected**: Defense-in-depth requires validation at ingestion boundary

2. **Lenient validation (log-and-continue)**
   - **Pros**: High availability, no dropped messages
   - **Cons**: Garbage-in-garbage-out, corrupts downstream analytics, hard to debug bad data
   - **Rejected**: Clean data is non-negotiable; DLQ provides observability without corruption

3. **Stateless service (no deduplication)**
   - **Pros**: Simpler architecture, no memory overhead
   - **Cons**: NATS at-least-once delivery causes duplicate storage/processing, wasted resources
   - **Rejected**: Deduplication is essential for correctness; LRU cache is lightweight

4. **Microservices (separate validation, transform, routing services)**
   - **Pros**: Independent scaling, clear separation of concerns
   - **Cons**: Network hops add latency, more operational overhead, overkill for MVP
   - **Rejected**: Single service is sufficient; internal Effect.Match provides modularity

5. **Transform to SenML (keep external format internally)**
   - **Pros**: Standard compliance, no format conversion
   - **Cons**: SenML is verbose (base names), not optimized for queries, harder to work with
   - **Rejected**: Internal format is optimized for TMNL's query/storage needs

### Tradeoffs

| Gain | Cost |
|------|------|
| **Type safety** — Effect Schema catches runtime errors before storage | Schema definition overhead — must maintain SenML + internal schemas |
| **Idempotency** — Deduplication prevents duplicate processing | Memory overhead — Ref cache holds 10k message IDs (~1MB RAM) |
| **Clean data** — Invalid messages quarantined via DLQ | Throughput cap — Validation adds ~5-10ms latency per message |
| **Observable errors** — DLQ enables debugging without data loss | Operational burden — DLQ consumers must be monitored/alerted |
| **Routing flexibility** — Effect.Match enables complex routing logic | Cognitive load — Routing rules must be understood/documented |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Schema validation overhead** — Slows ingestion to <1000 msg/sec | Medium | Medium | Benchmark validation performance; optimize with Schema.memoize; parallelize via Stream.mapEffectPar |
| **Deduplication cache overflow** — LRU evicts before NATS retry window | Low | Medium | Size cache for max expected retry delay (default: 10k IDs ≈ 5min @ 33 msg/sec) |
| **DLQ accumulation** — Invalid messages pile up, no one notices | Medium | High | Alert on DLQ depth >100; auto-escalate to oncall after 1 hour |
| **Schema drift** — Edge devices send new fields, validation rejects | Medium | High | Use lenient schema (Schema.optional for unknown fields); version schemas in registry (S6) |
| **Memory leak** — Ref cache grows unbounded if cleanup fails | Low | Critical | Add TTL-based cleanup (Effect.Schedule); monitor heap usage; test with sustained load |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `/src/lib/sensor-pipeline/schemas/senml.ts` | create | SenML schema definitions (RFC 8428 compliance) |
| `/src/lib/sensor-pipeline/schemas/sensor-reading.ts` | create | Internal SensorReading schema + MeasurementType enum |
| `/src/lib/sensor-pipeline/schemas/validation.ts` | create | ValidationResult discriminated union, error types |
| `/src/lib/sensor-pipeline/services/IngestionService.ts` | create | Main ingestion service (Effect.Service) |
| `/src/lib/sensor-pipeline/services/SensorRegistryService.ts` | create | Sensor metadata lookup (zone, type, unit mappings) |
| `/src/lib/sensor-pipeline/services/DeduplicationService.ts` | create | Message ID cache + isDuplicate check |
| `/src/lib/sensor-pipeline/services/RoutingService.ts` | create | Effect.Match-based routing to storage/DLQ/metrics |
| `/src/lib/sensor-pipeline/transformers/senml-to-reading.ts` | create | SenML → SensorReading transformation logic |
| `/src/lib/sensor-pipeline/index.ts` | create | Barrel exports for pipeline services |
| `/src/lib/nats/NatsStreamService.ts` | create | Complement to NatsKVService for pub/sub (see ADR-S3) |

### Dependencies

```json
{
  "@effect/schema": "^0.75.0",  // Already installed
  "effect": "^3.0.0",           // Already installed
  "nats.ws": "^1.28.0"          // Already installed (see NatsKVService)
}
```

**No new dependencies required** — leverage existing Effect + NATS stack.

### Test Strategy

**Unit Tests** (`@effect/vitest`):

1. **Schema Validation**:
   - Valid SenML → decodes successfully
   - Invalid SenML (missing required fields) → ParseError
   - SenML with unknown fields → ignored (lenient schema)
   - Out-of-range values → ValidationResult.OutOfRange

2. **Transformation**:
   - SenML with base name (`bn`) → correctly merged into readings
   - SenML with base time (`bt`) → correctly added to offsets
   - Multiple SenML records → flattened into separate SensorReadings
   - Unit conversion → SI units normalized (e.g., F→C, psi→Pa)

3. **Deduplication**:
   - First message → not duplicate
   - Repeated message ID → duplicate detected
   - LRU eviction → old IDs removed, new IDs tracked
   - TTL expiry → IDs cleaned up after 5 minutes

4. **Routing**:
   - Valid reading → routed to storage stream
   - Invalid schema → routed to DLQ stream
   - Duplicate → dropped (not routed anywhere)
   - Out-of-range → routed to DLQ with metadata

**Integration Tests** (with NATS via Docker Compose):

1. **End-to-End Flow**:
   - Publish SenML to NATS subject `sensors.zone1.temp-42.temperature`
   - Subscribe to ingestion service output stream
   - Assert: SensorReading emitted with correct fields
   - Assert: Message stored in S5 (storage mock)

2. **Error Handling**:
   - Publish invalid SenML (malformed JSON)
   - Assert: Message routed to DLQ
   - Assert: DLQ message includes raw payload + error details

3. **Deduplication**:
   - Publish same message twice (duplicate NATS delivery)
   - Assert: Only one SensorReading emitted
   - Assert: Second message logged as duplicate

4. **Throughput**:
   - Publish 1000 messages in 1 second
   - Assert: All valid messages processed
   - Assert: P95 latency <50ms (ingest timestamp - sensor timestamp)

**Load Tests** (optional, deferred to production):
- Sustained 10,000 msg/sec for 10 minutes
- Measure: Throughput, latency distribution, memory growth, error rate
- Target: 0% message loss, <100ms P99 latency, <500MB heap

## Metadata

### Related ADRs
- **ADR-S3** (Transport Layer) — Defines NATS subject hierarchy, JetStream consumer groups
- **ADR-S3-S4** (Transport-Ingestion integration) — Consumer group setup, ACK semantics
- **ADR-S4-S5** (Ingestion-Storage integration) — Stream handoff to DuckDB/ClickHouse
- **ADR-S6** (Schema Management) — Schema registry, versioning, evolution policies
- **ADR-S4-S6** (Schema contract synergy) — How S4 validates against S6 schemas

### Open Questions

1. **Unit conversion** — Should S4 normalize to SI units, or preserve original units + metadata?
   - **Recommendation**: Normalize to SI (reduces downstream complexity), store original in metadata

2. **Schema versioning** — How to handle SenML v1 vs v2 messages in same stream?
   - **Recommendation**: Use `_version` field in SenML; route by version to different handlers

3. **Backpressure** — What if storage (S5) is slower than ingestion?
   - **Recommendation**: Effect.Stream buffers (bounded queue); emit metrics on buffer depth; alert on >80% full

4. **Multi-tenancy** — Should ingestion be zone-aware (separate services per zone)?
   - **Recommendation**: Single service with zone routing; scale horizontally if needed

5. **Enrichment** — Should S4 look up sensor metadata (type, location) or assume it's in message?
   - **Recommendation**: Metadata in message (edge responsibility); S4 validates presence, doesn't enrich

### References

- **SenML RFC 8428**: https://datatracker.ietf.org/doc/html/rfc8428
- **Effect Schema docs**: `/home/getbygenius/getbyzenbook/projects/gbg/assets/code/repos/gbg/packages/tmnl/submodules/website/content/docs/schema/`
- **NatsKVService implementation**: `/src/lib/nats/NatsKVService.ts`
- **SSEAdapter stream patterns**: `/src/lib/ai-core/services/SSEAdapter.ts`
- **ViewArtifact schema patterns**: `/src/lib/connection-ports/schemas/artifacts.ts`
- **ADR-S3 Transport Layer**: `/assets/documents/pipeline-adr/isolated/ADR-S3-transport.md`

### Design Principles

1. **Defense in depth** — Validate at ingestion even if edge claims to validate
2. **Fail explicitly** — Invalid messages go to DLQ, not silent discard
3. **Idempotent by default** — Deduplication handles at-least-once delivery
4. **Stream-native** — Effect.Stream throughout, no imperative loops or mutable state
5. **Observable failures** — Every error emits metric + DLQ entry for debugging
6. **Type-safe transformations** — Effect Schema enforces contracts at runtime
