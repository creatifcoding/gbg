# Holonet NATS Transport Architecture

> **Status:** Active | **Last Updated:** 2026-02-09
> **Consolidated from:** 12 source files in `src/lib/holonet/`

Holonet is the NATS/JetStream transport layer for TMNL -- a distributed enhancement to Effect-TS patterns providing event sourcing, reactive state synchronization, and persistent streaming. It uses `nats.ws` (WebSocket, browser-compatible) rather than native TCP.

**Key Principle:** Holonet is an *enhancement*, not a replacement. Feature flags enable gradual adoption, and existing Effect APIs remain unchanged.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Service Stack](#service-stack)
- [Subject System](#subject-system)
- [Durable Streams](#durable-streams)
- [Duplex Protocol (Draft)](#duplex-protocol-draft)
- [Configuration](#configuration)
- [Edge Cases & Gaps](#edge-cases--gaps)
- [Audit Findings](#audit-findings)
- [Testing](#testing)
- [Migration Strategy](#migration-strategy)
- [Glossary](#glossary)
- [Source Files](#source-files)

---

## Architecture Overview

```
+---------------------------------------------------------------------+
|                      Application Layer                                |
|  (overlays, geoint, kori, dataplane, IIoT realtime)                  |
+----------------------------+----------------------------------------+
                             |
+----------------------------+----------------------------------------+
|                   Integration Layer                                   |
|                            |                                          |
|  +----------------+  +----+----------+  +----------------------+     |
|  | HolonetEvent   |  | HolonetStream |  | HolonetAtomBackend   |     |
|  |     Log        |  |   Processor   |  |                      |     |
|  +------+---------+  +------+--------+  +----------+-----------+     |
|         |                   |                      |                  |
+---------+-------------------+----------------------+-----------------+
          |                   |                      |
+---------+-------------------+----------------------+-----------------+
|         |      Service Layer (Base NATS Primitives)                   |
|         |                   |                      |                  |
|  +------v--------+  +------v-----+  +-------------v---------+       |
|  |NatsPubSub     |  |NatsStream  |  |NatsKV (existing)      |       |
|  |  Service      |  |  Service   |  |                       |       |
|  +---------------+  +------+-----+  +-----------------------+       |
|                            |                                          |
|                     +------v------+                                   |
|                     |NatsConsumer |                                   |
|                     |  Service    |                                   |
|                     +-------------+                                   |
+----------------------------+----------------------------------------+
                             | nats.ws (WebSocket)
                             v
                      +---------------+
                      |  NATS Server  |
                      |  + JetStream  |
                      +---------------+
```

### Design Principles

1. **Effect-First** -- All services are `Effect.Service<T>()` with Schema validation, scoped resource management, `Effect.catchAllCause` error handling, and `Effect.Stream` for subscriptions.

2. **Atom-as-State** -- Follows TMNL's canonical pattern: `Atom.make()` for all state, `ctx.set()` for mutations, `useAtomValue()` for React subscriptions.

3. **Backward Compatible** -- `EventLog.group()` unchanged, `EventLog.groupReactivity()` works identically, DurableStreams consumers migrate transparently, feature flags enable gradual rollout.

4. **Browser-First** -- Uses `nats.ws` (WebSocket transport), browser-compatible, no Node.js APIs. Connection to `ws://localhost:9222` (see `docker/nats/nats-server.conf`).

### Dependency Chain

```
HolonetConfigTag
       |
NatsConnectionService (provides: nc, js, jsm, config)
       |
+------+------+----------+----------+
|             |          |          |
PubSub    Consumer  ObjectStore  Monitoring
(PRIMARY) (SECONDARY)(SECONDARY) (SPECIALIZED)
```

---

## Service Stack

### Base Services (Phase 1)

#### NatsPubSubService

Core NATS pub/sub primitives. **Most commonly used service in application code.**

| Operation | Description |
|-----------|-------------|
| `publish(subject, data, schema)` | Publish with Schema encode |
| `subscribe(subject, schema)` | Returns `Effect.Stream` of decoded messages |
| `request(subject, data, replySchema, timeout)` | Request/reply pattern |
| `queueSubscribe(subject, queue, schema)` | Load balancing via queue groups |
| `flush()` | Flush pending publishes |

**Use cases:** Command/query bus, event broadcasting, service discovery, health checks.

#### NatsStreamService

JetStream Streams for durable event storage.

| Operation | Description |
|-----------|-------------|
| `ensureStream(config)` | Create or update stream |
| `publish(subject, data, schema, opts)` | Publish with ack + dedup (`msgId`) |
| `subscribe(stream, config)` | Durable/ephemeral consumer -> `Effect.Stream` |
| `fetch(consumer, batch)` | Pull messages with backpressure |
| `next(consumer)` | Single message pull |
| `getStreamInfo(stream)` | Metadata and statistics |
| `deleteStream(stream)` | Cleanup |

**Use cases:** Event sourcing (EventLog backend), audit logs, time-series data.

#### NatsConsumerService

JetStream Consumers for event replay and progressive loading.

| Operation | Description |
|-----------|-------------|
| `createConsumer(stream, config)` | Durable consumer |
| `fetch(consumer, batch)` | Pull messages with backpressure |
| `consume(consumer, schema)` | Returns `Effect.Stream` |
| `ack(msg)` | Acknowledge processing |

**Use cases:** Event replay (EventLog handlers), progressive loading (DurableStreams replacement), work queues.

#### NatsObjectService

Object Store for large binary data.

| Operation | Description |
|-----------|-------------|
| `createBucket(name, options)` | Create object bucket |
| `put(bucket, name, stream)` | Store large object |
| `get(bucket, name)` | Retrieve object as stream |
| `delete(bucket, name)` | Remove object |

**Use cases:** KORI trait data (meshes, textures), document storage, media files.

#### NatsRpcService

Services/microservices pattern for distributed RPC.

| Operation | Description |
|-----------|-------------|
| `addService(name, handler)` | Register service |
| `call(service, operation, data, schema)` | RPC call with load balancing |
| `discover(name)` | Service discovery |
| `stats(service)` | Service statistics |

#### NatsMonitoringService

Observability and metrics via system advisories.

| Operation | Description |
|-----------|-------------|
| `streamStats(stream)` | Returns `Effect.Stream` of metrics |
| `consumerStats(consumer)` | Consumer metrics stream |
| `advisories()` | System advisories stream |
| `withSpan(operation)` | `Effect.withSpan` integration |

### Integration Services (Phase 2)

#### HolonetEventLog

Drop-in replacement for `Effect.EventLog` backed by NatsStreamService + NatsConsumerService. Events published to JetStream Stream, each handler gets a durable Consumer, consumer offset tracks replay position.

```typescript
// Existing code remains unchanged
EventLog.group(schema, (event) => /* ... */)
EventLog.groupReactivity(schema, (event) => /* invalidate cache */)
```

#### HolonetStreamProcessor

Replaces DurableStreams manual offset tracking. Provides: `publish`, `publishBatch`, `read`, `subscribe`, `subscribeFrom`, `getInfo`, `getCurrentSequence`, `delete`.

Configuration via `StreamProcessorConfig`: `streamName`, `subject(s)`, `consumerName`, `retention`, `maxAge`, `maxBytes`, `maxMsgs`, `replicas`.

#### HolonetAtomBackend

Optional distributed atom synchronization backed by NatsKV. Opt-in per-atom:

```typescript
const distributedAtom = Atom.make(initialValue, {
  backend: 'holonet-kv',
  bucket: 'app-state',
  key: 'my-atom',
});
// KV watch -> atom updates, multiple clients stay in sync
```

---

## Subject System

Typed subject management with domain conventions and parameter extraction.

### SubjectRegistry

| Operation | Description |
|-----------|-------------|
| `register(spec)` | Register a subject specification |
| `update(spec)` | Update existing spec |
| `get(name)` | Get spec by name |
| `query(filter)` | Filter specs |
| `resolveStreamName(subject)` | Map subject to stream |
| `specsByStream(stream)` | All specs for a stream |
| `catalog()` | Full catalog |

### SubjectSpec

Each subject spec supports: `resolve(params)` -- generate concrete subject, `matches(subject)` -- pattern matching, `placeholders()` -- template variables, `extractParams(subject)` -- parse parameters from subject string.

### Domain Conventions

`DomainConventionRegistry` provides conventions for: GEOINT, SCADA, MES, EVENTS domains.

### Subject Conventions (Duplex Draft)

```
holonet.stream.<streamId>.data     -- data plane
holonet.stream.<streamId>.control  -- control plane
holonet.stream.<streamId>.admin    -- lifecycle operations (create/alter)
```

---

## Durable Streams

HTTP protocol -> NATS JetStream bridge for edge clients (browser, Electron, SCADA, MES, ERP).

```
+-------------------------------------------------------------+
|                        EDGE CLIENTS                          |
|         (Browser, Electron, SCADA, MES, ERP)                |
+---------------------------+---------------------------------+
                            | HTTP (Durable-Streams Protocol)
                            v
+-------------------------------------------------------------+
|                    HTTP API LAYER                             |
|   DurableStreamsApi (HttpApi) + Handlers (HttpApiBuilder)    |
+-------------------------------------------------------------+
|                    AUTH LAYER                                 |
|   HolonetAuthService (JWT validation, permissions)          |
+-------------------------------------------------------------+
|                    BRIDGE SERVICES                            |
|   StreamBridgeService | LiveStreamService | ConsumerState   |
+-------------------------------------------------------------+
|                    CODEC & SCHEMA                            |
|   StreamCodecService | SchemaRegistry (X-Schema-Id headers) |
+-------------------------------------------------------------+
|                    NATS LAYER (holonet/nats/)                |
|   NatsStreamService | NatsPubSubService | NatsKVService     |
+-------------------------------------------------------------+
```

### Services

**StreamBridgeService** -- Core CRUD: `create`, `append`, `read`, `metadata`, `delete`.

**LiveStreamService** -- Real-time streaming modes:
- `longPoll(id, opts)` -- blocks until data or timeout
- `sse(id, opts)` -- continuous SSE stream (currently poll-derived via `Stream.unfoldChunkEffect`)
- `subscribe(id, opts)` -- raw NATS consumer stream

**ConsumerStateService** -- Automatic offset tracking via NATS durable consumers.

**StreamCodecService** -- Schema-aware encoding/decoding with header injection.

**HolonetAuthService** -- JWT-based authentication and authorization.

**DsMetricsService** -- Observability with Prometheus/JSON export.

### Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `durable_streams.operation.latency_ms` | Histogram | Operation latency by type |
| `durable_streams.operations` | Counter | Total operations by type |
| `durable_streams.errors` | Counter | Errors by operation/type |
| `durable_streams.messages.published` | Counter | Messages published |
| `durable_streams.messages.consumed` | Counter | Messages consumed |
| `durable_streams.sse.active_connections` | Gauge | Active SSE connections |
| `durable_streams.subscriptions.active` | Gauge | Active subscriptions |

### Performance Benchmarks (local NATS)

| Metric | Value |
|--------|-------|
| Publish throughput | ~2,400 msg/sec |
| Consume throughput | ~16,600 msg/sec |
| E2E latency (p95) | <2ms |
| Concurrent consumers | 10+ stable |

### Error Types

```
DurableStreamError =
  | AuthError (401/403)
  | ProtocolError (400/404/409)
  | LiveModeError (204/500)
  | InternalError (500/503)
```

---

## Duplex Protocol (Draft)

> **Status:** Spec Draft v0.1 -- protocol direction, no implementation yet.

### Transport Options

1. **Duplex WS Data Plane (Primary)** -- Single WebSocket connection, multiplexed frames. Downlink via JetStream consumer push or internal fanout. Uplink via control messages (ack/nack, flow-control credits, cursor).

2. **SSE Downlink + WS/HTTP Uplink (Compatibility)** -- SSE for downlink with `Last-Event-ID` for resume. Separate control endpoint for acks and cursor advancement.

3. **NATS WS Client Direct (High-capability)** -- Clients connect directly to NATS WS; use request/reply for control, JetStream consumer for downlink. Durable-Streams HTTP becomes compatibility layer.

### Frame Envelope

```typescript
const FrameEnvelope = Schema.Struct({
  id: Schema.String,
  streamId: Schema.String,
  consumerId: Schema.optional(Schema.String),
  subject: Schema.optional(Schema.String),
  timestamp: Schema.Number,
  payload: Schema.Unknown,
})
```

### Control Plane Messages (Upstream)

8 message types forming `ControlMessage = Schema.Union(...)`:

| Message | Purpose |
|---------|---------|
| `ControlAck` | Acknowledge receipt up to sequence |
| `ControlNack` | Request redelivery (optionally delayed) |
| `ControlCredit` | Credit grant -- allow N messages in-flight |
| `ControlCursor` | Set replay position (resume cursor) |
| `ControlSubscribe` | Subscribe to stream with delivery/ack policy |
| `ControlUnsubscribe` | Unsubscribe from stream |
| `ControlHeartbeat` | Liveness signal |
| `ControlError` | Error notification with code/message |

### Data Plane Messages (Downstream)

3 message types forming `DataPlaneMessage = Schema.Union(...)`:

| Message | Purpose |
|---------|---------|
| `DataMessage` | Single message: `seq`, `subject`, `schemaId`, `data` |
| `DataHeartbeat` | Server liveness signal |
| `DataMessageBatch` | Bulk replay/gap-fill: `fromSeq` to `toSeq` |

### Protocol Negotiation

```typescript
const Capability = Schema.Literal(
  'duplex.ws', 'sse.downlink', 'ws.uplink', 'nats.direct',
  'ack.explicit', 'ack.all',
  'flow.credit', 'flow.window', 'batch.data'
)

// Client -> Server
HandshakeHello { clientId, protocol, capabilities, resumeFromSeq? }
// Server -> Client
HandshakeWelcome { protocol, negotiated, heartbeatMs, ackPolicy }
HandshakeReject { reason, supported }
```

### Recovery State Machine

```
DISCONNECTED -> CONNECTING -> NEGOTIATING -> STREAMING -> STALLED -> RECOVERING -> STREAMING
```

**Recovery steps:**
1. Client reconnects with `HandshakeHello(resumeFromSeq)` or `Last-Event-ID`
2. Server responds `HandshakeWelcome` with negotiated capabilities + heartbeat interval
3. Client emits `ControlCursor` if required to force replay offset
4. Server sends `DataMessageBatch` to fill gap, then switches to live streaming

### Sequence Diagrams

**WS Duplex (Single Connection)**

```
Client                 Holonet Gateway              JetStream
  |  WS CONNECT  ----------------------------->      |
  |  HandshakeHello ------------------------------>  |
  |                     HandshakeWelcome <-----------|
  |  ControlSubscribe ---------------------------->  |
  |                     create consumer ------------>|
  |<================ DataMessage stream =============|
  |  ControlAck / ControlCredit ------------------>  |
  |                     ack / flow control -------->|
```

**SSE Downlink + HTTP Uplink**

```
Client                 Holonet Gateway              JetStream
  |  HTTP GET /sse ----------------------------->     |
  |                     subscribe consumer ---------->|
  |<=== SSE: DataMessage + id:seq ===================|
  |  HTTP/WS POST /control (ack/cursor) --------->    |
  |                     ack / replay ---------------->|
```

**Recovery / Resume**

```
Client                 Holonet Gateway              JetStream
  |  reconnect WS/SSE --------------------------->    |
  |  HandshakeHello(resumeFromSeq) --------------->   |
  |                     HandshakeWelcome -----------> |
  |  ControlCursor(seq) -------------------------->   |
  |                     fetch from seq ------------->|
  |<=== DataMessageBatch (gap fill) =================|
  |<=== DataMessage stream ==========================|
```

### Design Axes (from NATS + SSE semantics)

| Axis | Options |
|------|---------|
| **Ack policy** | `AckPolicy.All` or `AckPolicy.Explicit` for durability |
| **Backpressure** | `max_ack_pending` + pull consumers for credit-based flow control |
| **Replay** | Cursor-based resume using `Last-Event-ID` equivalent |
| **Push vs pull** | Pull consumer for deterministic backpressure; push for low-latency broadcast |

---

## Configuration

### Feature Flags

```typescript
export const HolonetConfigSchema = Schema.Struct({
  enabled: Schema.Boolean.pipe(Schema.withDefault(() => false)),
  eventLogBackend: Schema.Literal('effect', 'holonet').pipe(
    Schema.withDefault(() => 'effect' as const)),
  streamBackend: Schema.Literal('durable-streams', 'holonet-consumer').pipe(
    Schema.withDefault(() => 'durable-streams' as const)),
  atomBackend: Schema.Literal('memory', 'holonet-kv').pipe(
    Schema.withDefault(() => 'memory' as const)),
  clusterBackend: Schema.Literal('effect-cluster', 'holonet-rpc').pipe(
    Schema.withDefault(() => 'effect-cluster' as const)),
})

export class HolonetConfig extends Context.Tag('tmnl/holonet/HolonetConfig')<
  HolonetConfig, typeof HolonetConfigSchema.Type
>() {
  static readonly Default = Layer.succeed(this, {
    enabled: false,
    eventLogBackend: 'effect',
    streamBackend: 'durable-streams',
    atomBackend: 'memory',
    clusterBackend: 'effect-cluster',
  })
}
```

### NATS Connection

Reuses existing `NatsConfigTag`. Default: `ws://localhost:9222`. Production: multi-server cluster with custom config.

---

## Edge Cases & Gaps

### Gap-to-Edge-Case Matrix

| Gap | Edge Case | Risk | Symptom |
|-----|-----------|------|---------|
| No idempotency contract | Duplicate Publish | High | Duplicate acks or double-applied side effects |
| No redelivery signaling | Ack Wait Timeout | High | Silent repeats indistinguishable from new data |
| No cursor handshake | Replay Gap | High | Missing or duplicated segments after reconnect |
| No seq-first ordering doc | Out-of-Order Delivery | Medium | UI order logic incorrect for multi-subject streams |
| No credit-based control | Backpressure Overflow | High | Consumer stalls, pending acks saturate |
| No recovery state machine | Heartbeat Loss | Medium | SSE/WS disconnects without resync |
| No error channel | Schema Drift | Medium | Stream aborts or client misinterprets failure |

### Solution Options (per gap)

1. **Idempotency** -- (A) standardize `msgId` + `duplicate` in control ACKs, (B) include `dedupeWindowMs` in handshake
2. **Redelivery** -- (A) add `redelivered: boolean` on `DataMessage`, (B) `ControlRedeliveryNotice`
3. **Cursor** -- (A) mandatory `ControlCursor` on reconnect, (B) server offers cursor, client accepts
4. **Ordering** -- (A) `seq` authoritative, subjects informational, (B) per-subject seq hints
5. **Flow control** -- (A) `ControlCredit` windows on pull consumer, (B) auto-credit from buffer + ack latency
6. **Recovery** -- (A) client-side timeouts trigger handshake, (B) server heartbeat loss triggers replay
7. **Error channel** -- (A) `ControlError` with `seq` + reason, (B) error items as `DataMessage._tag: 'Error'`

---

## Audit Findings

An architectural audit (2026-01-13) identified significant issues:

### Code Duplication (~70%)

- **JSON codec pattern** repeated 8 times across 4 services (manual `TextDecoder` + `JSON.parse` + `Schema.decode`)
- **Stream.async boilerplate** repeated 5 times (identical setup/teardown/error handling)
- **Effect.tryPromise wrapper** repeated 27 times with identical error wrapping

### Anti-Patterns

- `Effect.runPromiseExit` inside `Stream.async` callbacks (breaks fiber model, loses Effect context)
- Service layer without composition (each service reimplements rather than composing from base)
- Utility methods leaked into service interfaces (`getConnection`, `getJetStream`)
- 17 error types without behavioral discrimination (all string wrappers, no retry/terminal distinction)

### Missing Abstractions

- **No codec layer** -- should extract `NatsCodec.encodeJson` / `NatsCodec.decodeJson`
- **No base subscription abstraction** -- common stream creation pattern should be shared
- **No typed subject pattern** -- subjects should associate schema at definition time
- Effect already provides `PubSub<A>`, `Stream.asyncEffect`, `Stream.asyncPush`, `@effect/rpc` -- the Holonet services reimplemented these

### Refactoring Plan

The plan (ready for implementation) targets:
1. **Phase 1 (Foundation):** Extract `utils/codec.ts`, `utils/validation.ts`, `utils/errors.ts`
2. **Phase 2 (Hierarchy):** Create `BaseNatsService`, refactor PubSub first (most used), then remaining services
3. **Phase 3 (Streams):** Migrate to `fromCallback` for NATS core, keep `fromAsyncIterable` for JetStream
4. **Phase 4 (Anti-patterns):** Eliminate all `Effect.runPromise` usage

**Target metrics:** ~30% LOC reduction (1,700 -> ~600 lines), 5-7 error types (from 17), zero `Effect.runPromise` calls.

---

## Testing

### Prerequisites

- Docker containers: `tmnl_nats` and `tmnl_durable_streams` running
- Start: `docker compose -f docker/docker-compose.yml up -d nats durable-streams`
- Environment: `NATS_SERVERS` (defaults to `ws://localhost:9222`)

### Runtime Split

| Runtime | Use Case |
|---------|----------|
| **Node/Vitest** | HTTP API tests + standard Vitest (wide ecosystem) |
| **Bun** | `@effect/platform-bun` + `BunHttpServer.layerTest` |

Most Holonet tests are runtime-agnostic (`bunx vitest`). Bun-specific tests isolated to `*.bun.test.ts`.

### Commands

```bash
# Full Holonet suite (Vitest)
pueue add -- "bunx vitest run src/lib/holonet"

# Durable-streams API (Node)
pueue add -- "bunx vitest run src/lib/holonet/durable-streams/__tests__/api.test.ts"

# Durable-streams API (Bun runtime)
pueue add -- "bun test src/lib/holonet/durable-streams/__tests__/api.bun.test.ts"
```

### Test Coverage (Durable Streams)

| Suite | Tests | Coverage |
|-------|-------|----------|
| Integration | 12 | Core CRUD, live modes |
| Recovery | 11 | Reconnection, cleanup, timeouts |
| Load | 6 | Throughput, concurrency, latency |
| Metrics | 18 | Tracing, snapshots, export |
| Services | 24 | Unit tests per service |
| Schemas | 8 | Protocol validation |
| API | 10 | HTTP handlers |

---

## Migration Strategy

### Phase 1: Foundation

- Create directory structure
- Implement NatsPubSubService
- Implement NatsStreamService + NatsConsumerService
- Comprehensive tests

### Phase 2: EventLog Integration

- Implement HolonetEventLog (drop-in for Effect.EventLog)
- Feature flag on overlay events
- A/B test: Effect.EventLog vs Holonet
- Performance benchmarks

### Phase 3: Stream Processing

- Implement HolonetStreamProcessor
- Migrate geoint progressive search
- Remove DurableStreams service
- Verify memory/performance

### Phase 4: Atom Sync (Optional)

- HolonetAtomBackend with per-atom backend config
- Multi-client KV synchronization
- Documentation for when to use distributed atoms

### Phase 5: RPC / Clustering

- NatsRpcService + HolonetRpcServer
- Migrate SearchEntity to Holonet
- Load balancing validation

### Existing Integrations

| System | Current | Future |
|--------|---------|--------|
| **KORI ECS** (`src/lib/kori/`) | NatsKV for EntitySpec | + JetStream for component changes, Object Store for traits |
| **Overlay Events** (`src/lib/overlays/events/`) | Effect.EventLog | HolonetEventLog drop-in |
| **Geoint Streaming** (`src/lib/geoint/atoms/`) | DurableStreams + manual offset | HolonetStreamProcessor |
| **Search Clustering** (`src/lib/geoint/cluster/`) | Effect.Cluster + RPC | HolonetRpcServer |

---

## Glossary

| Term | Definition |
|------|------------|
| **Control Cursor** | Control-plane message carrying client's replay position (`fromSeq`). Used for resume after disconnect. |
| **Ack Policy** | JetStream consumer acknowledgement behavior: `explicit` (per-message) or `all` (ack latest implies prior). |
| **Ack Wait** | Timeout window after which unacknowledged messages are eligible for redelivery. |
| **Backpressure Window** | Credit-based limit on in-flight messages via `ControlCredit`. |
| **Data Plane** | Message flow delivering application data (`DataMessage`), typically downlink. |
| **Control Plane** | Message flow for coordination (ack, cursor, heartbeat, subscription, flow control). |
| **Duplex** | Bidirectional data-plane interaction: data downstream, control/feedback upstream. |
| **Heartbeat** | Periodic liveness signal (SSE comment frames, WS ping/pong, `ControlHeartbeat`). |
| **Replay Gap** | Missing sequence numbers after disconnect/resume, filled by `DataMessageBatch`. |
| **Redelivery** | Message re-sent after ack timeout. Client must treat duplicates idempotently. |
| **Schema Drift** | Stream payloads no longer validate against the consumer's expected schema. |

---

## Source Files

This document consolidates the following 12 files from `src/lib/holonet/`:

| Source File | Lines | Content |
|-------------|-------|---------|
| `ARCHITECTURE.md` | 610 | Architecture layers, service inventory, migration strategy |
| `ANALYSIS.md` | 385 | Code duplication audit, anti-patterns, missing abstractions |
| `REFACTORING_PLAN.md` | 440 | Phased refactoring plan, utilities, base service hierarchy |
| `HOLONET_AUDIT_PASSES.md` | 661 | 5-pass audit ledger, duplex protocol appendix, edge cases |
| `durable-streams/README.md` | 409 | Durable Streams API, services, metrics, performance |
| `docs/INDEX.md` | 22 | Documentation entry point and links |
| `docs/GLOSSARY.md` | 177 | Protocol term definitions |
| `docs/HOLONET_AUDIT_OVERVIEW.md` | 112 | Pass 1-3 summaries (architecture, durable-streams, NATS) |
| `docs/HOLONET_RESEARCH_ROUNDS.md` | 38 | Research rounds: durability, flow control, recovery |
| `docs/HOLONET_DUPLEX_SPEC.md` | 293 | Duplex protocol draft, frames, negotiation, sequence diagrams |
| `docs/HOLONET_EDGE_CASES.md` | 113 | Edge cases, gap matrix, solution options |
| `docs/HOLONET_TESTING.md` | 66 | Test prerequisites, runtime split, suite map |
