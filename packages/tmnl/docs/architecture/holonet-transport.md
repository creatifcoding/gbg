---
title: "Holonet Transport Architecture"
date: 2026-02-09
status: Active
source: >
  src/lib/holonet/ARCHITECTURE.md, src/lib/holonet/ANALYSIS.md,
  src/lib/holonet/REFACTORING_PLAN.md, src/lib/holonet/docs/HOLONET_AUDIT_OVERVIEW.md,
  src/lib/holonet/docs/HOLONET_DUPLEX_SPEC.md, src/lib/holonet/docs/HOLONET_EDGE_CASES.md,
  src/lib/holonet/docs/HOLONET_RESEARCH_ROUNDS.md, src/lib/holonet/docs/HOLONET_TESTING.md,
  src/lib/holonet/docs/GLOSSARY.md, src/lib/holonet/durable-streams/README.md
---

# Holonet Transport Architecture

> Consolidated transport-layer reference for TMNL's NATS-backed distributed infrastructure. Covers service inventory, duplex protocol design, edge-case analysis, durable-streams bridge, and refactoring roadmap.

---

## Overview

Holonet is a NATS/JetStream enhancement layer providing distributed event sourcing, reactive state synchronization, and persistent streaming over Effect-TS services. It serves as the transport backbone for IIoT data distribution, sensor pipeline ingestion, and real-time WebSocket subscriptions.

**Key Principle**: Holonet is an _enhancement_ not a replacement. Feature flags enable gradual adoption, and existing Effect APIs remain unchanged.

---

## Architecture Layers

```
+-------------------------------------------------------------------+
|                      Application Layer                              |
|  (IIoT entities, overlays, geoint, kori, dataplane)                |
+-----------------------------+-------------------------------------+
                              |
+-----------------------------+-------------------------------------+
|                   Integration Layer                                  |
|                              |                                       |
|  +----------------+  +------+--------+  +---------------------+    |
|  | HolonetEvent   |  | HolonetStream |  | HolonetAtomBackend  |    |
|  |     Log        |  |   Processor   |  |                     |    |
|  +-------+--------+  +------+--------+  +----------+----------+    |
|          |                  |                       |                |
+----------+------------------+-----------------------+----------------+
           |                  |                       |
+----------+------------------+-----------------------+----------------+
|          |      Service Layer (Base NATS Primitives)                 |
|          |                  |                       |                |
|  +-------v--------+  +-----v------+  +-------------v------+        |
|  |NatsPubSub      |  |NatsStream  |  |NatsKV (existing)   |        |
|  |  Service       |  |  Service   |  |                    |        |
|  +----------------+  +-----+------+  +--------------------+        |
|                             |                                        |
|                      +------v------+                                 |
|                      |NatsConsumer |                                 |
|                      |  Service    |                                 |
|                      +-------------+                                 |
+-----------------------------+----------------------------------------+
                              | nats.ws (WebSocket)
                              v
                      +---------------+
                      |  NATS Server  |
                      |  + JetStream  |
                      +---------------+
```

---

## Service Inventory

### Base Services

| Service | Lines | Primary Function | Status |
|---------|-------|------------------|--------|
| **NatsConnectionService** | ~98 | Shared connection lifecycle | Implemented |
| **NatsPubSubService** | ~277 | Core pub/sub + request-reply | Implemented |
| **NatsStreamService** | ~200 | JetStream streams (durable storage) | Implemented |
| **NatsConsumerService** | ~425 | JetStream consumers (fetch/consume) | Implemented |
| **NatsObjectService** | ~287 | Object store operations | Implemented |
| **NatsRpcService** | ~150 | Request-reply RPC | Implemented |
| **NatsMonitoringService** | ~100 | System advisory monitoring | Implemented |

### Integration Services

| Service | Purpose | Backed By |
|---------|---------|-----------|
| **HolonetEventLog** | Drop-in EventLog replacement | NatsStreamService + NatsConsumerService |
| **HolonetStreamProcessor** | DurableStreams replacement | NatsConsumerService |
| **HolonetAtomBackend** | Distributed atom sync | NatsKVService |
| **HolonetRpcServer** | Effect.Cluster replacement | NatsRpcService |

### Dependency Chain

```
HolonetConfigTag
       |
NatsConnectionService (provides: nc, js, jsm, config)
       |
+------+------+---------------+---------------+
|             |               |               |
PubSub    Consumer      ObjectStore    Monitoring
(PRIMARY) (SECONDARY)   (SECONDARY)    (SPECIALIZED)
```

---

## Durable-Streams Bridge

Durable-streams provides an HTTP protocol for persistent, ordered message streams, bridging NATS JetStream to edge clients.

### Services

| Service | Interface | Purpose |
|---------|-----------|---------|
| **StreamBridgeService** | `create`, `append`, `read`, `metadata`, `delete` | Core CRUD |
| **LiveStreamService** | `longPoll`, `sse`, `subscribe` | Real-time streaming |
| **ConsumerStateService** | `getOrCreateConsumer`, `getOffset`, `commitOffset` | Offset tracking |
| **StreamCodecService** | encode/decode with schema headers | Schema-aware codec |
| **HolonetAuthService** | JWT validation, permissions | Auth layer |
| **DsMetricsService** | Prometheus/JSON export | Observability |

### Performance Benchmarks (local NATS)

| Metric | Value |
|--------|-------|
| Publish throughput | ~2,400 msg/sec |
| Consume throughput | ~16,600 msg/sec |
| E2E latency (p95) | <2ms |
| Concurrent consumers | 10+ stable |

### Error Types

```
DurableStreamError
  AuthError           (401/403 -- JWT invalid or insufficient permissions)
    InvalidTokenError
    ForbiddenError
  ProtocolError       (400/404/409 -- Invalid request or conflict)
    InvalidOffsetError
    StreamNotFoundError
    StreamExistsError
    SchemaNotFoundError
  LiveModeError       (204/500 -- Streaming issues)
    LongPollTimeoutError
    SSEConnectionError
  InternalError       (500/503 -- NATS or internal failures)
    NatsConnectionError
    CodecError
```

---

## Duplex Protocol Design (Draft v0.1)

The duplex protocol adds true bidirectional data-plane interaction over WebSocket or SSE+uplink.

### Transport Options

| Transport | Direction | Use Case |
|-----------|-----------|----------|
| **WS Duplex** (Primary) | Bidirectional | Full control + data on single connection |
| **SSE + HTTP Uplink** | Down: SSE, Up: HTTP/WS | Browser compatibility fallback |
| **NATS WS Direct** | Bidirectional | High-capability clients only |

### Frame Envelope

```typescript
FrameEnvelope = {
  id: string,           // Frame identifier
  streamId: string,     // Target stream
  consumerId?: string,  // Consumer binding
  subject?: string,     // NATS subject
  timestamp: number,    // Epoch ms
  payload: unknown      // Application data
}
```

### Control Plane Messages (Upstream)

| Message | Purpose |
|---------|---------|
| `ControlAck` | Acknowledge receipt up to a sequence |
| `ControlNack` | Request redelivery (optional delay) |
| `ControlCredit` | Grant N in-flight message credits |
| `ControlCursor` | Set replay position (fromSeq) |
| `ControlSubscribe` | Create consumer binding |
| `ControlUnsubscribe` | Remove consumer binding |
| `ControlHeartbeat` | Liveness signal |
| `ControlError` | Error notification |

### Data Plane Messages (Downstream)

| Message | Purpose |
|---------|---------|
| `DataMessage` | Single data frame (seq, subject, data) |
| `DataHeartbeat` | Server liveness signal |
| `DataMessageBatch` | Gap-fill batch (fromSeq to toSeq) |

### Protocol Negotiation

```
Client: HandshakeHello { clientId, protocol, capabilities, resumeFromSeq? }
Server: HandshakeWelcome { protocol, negotiated, heartbeatMs, ackPolicy }
  -or-  HandshakeReject { reason, supported }
```

**Capabilities**: `duplex.ws`, `sse.downlink`, `ws.uplink`, `nats.direct`, `ack.explicit`, `ack.all`, `flow.credit`, `flow.window`, `batch.data`

### Recovery State Machine

```
DISCONNECTED --> CONNECTING --> NEGOTIATING --> STREAMING --> STALLED --> RECOVERING --> STREAMING
```

1. Client reconnects with `HandshakeHello(resumeFromSeq)`
2. Server responds `HandshakeWelcome` with negotiated capabilities
3. Client emits `ControlCursor` if needed to force replay offset
4. Server sends `DataMessageBatch` to fill gap, then switches to streaming

### Subject Conventions

```
holonet.stream.<streamId>.data
holonet.stream.<streamId>.control
holonet.stream.<streamId>.admin
```

---

## Edge Cases & Gaps

### Gap Matrix

| Gap | Edge Case | Risk | Observable Symptom |
|-----|-----------|------|--------------------|
| No idempotency contract | Duplicate Publish | High | Duplicate acks or double-applied side effects |
| No redelivery signaling | Ack Wait Timeout | High | Silent repeats indistinguishable from new data |
| No cursor handshake | Replay Gap | High | Missing or duplicated segments after reconnect |
| No seq-first ordering doc | Out-of-Order Delivery | Medium | UI/order logic incorrect for multi-subject streams |
| No credit-based control | Backpressure Overflow | High | Consumer stalls, pending acks saturate |
| No recovery state machine | Heartbeat Loss | Medium | SSE/WS disconnects without resync |
| No error channel | Schema Drift | Medium | Stream aborts or client misinterprets failure |

### Solution Options (per gap)

1. **Idempotency**: Standardize `msgId` + `duplicate` result in control-plane ACKs; include `dedupeWindowMs` in handshake
2. **Redelivery signaling**: Add `redelivered: boolean` on `DataMessage` or `ControlRedeliveryNotice` for replay bursts
3. **Cursor handshake**: Mandatory `ControlCursor` on reconnect or server-offered `CursorOffered`
4. **Ordering**: Spec declares `seq` authoritative; subject informational
5. **Flow control**: `ControlCredit` windows on pull consumer or auto-credit based on buffer + ack latency
6. **Recovery**: Client-side timeouts trigger recovery handshake
7. **Error channel**: Emit `ControlError` with `seq` and reason

---

## Architecture Analysis (Audit Findings)

### Code Duplication (~70%)

| Pattern | Occurrences | Impact |
|---------|-------------|--------|
| JSON encode/decode | 8+ (decode), 14+ (encode) | ~20 lines/service |
| `Stream.async` boilerplate | 5 identical | ~40 lines each |
| `Effect.tryPromise` wrapper | 27 instances | ~5 lines each |
| Typed message construction | 3 services | ~10 lines each |

### Anti-Patterns

1. **`Effect.runPromiseExit` inside `Stream.async`** -- Breaks Effect fiber model. Located in `NatsConsumerService.consume()`. Must migrate to `Stream.asyncEffect` or `Stream.unwrap`.
2. **Utility getters on service interfaces** -- `getConnection()`, `getJetStream()`, `getJetStreamManager()` are implementation leakage, not contracts.
3. **17 error types without discrimination** -- Most are string wrappers. Need recovery-strategy encoding (retryable vs terminal) and composition.

### What Effect Already Provides

| Pattern | Effect Module | Current (Reimplemented) |
|---------|---------------|------------------------|
| Typed pub/sub | `PubSub<A>` | `NatsPubSubService` |
| Callback-to-stream | `Stream.asyncEffect` | Manual `Stream.async` + `Effect.runPromiseExit` |
| Schema codec pipeline | `Schema.transform` | Manual TextEncoder + JSON.parse + Schema.decode |
| Request/reply RPC | `@effect/rpc` | `NatsRpcService` |

### Refactoring Targets

1. **Codec layer** (`utils/codec.ts`) -- Shared `NatsCodec.encodeJson` / `decodeJson`
2. **Base service class** (`BaseNatsService`) -- Common connection getters, codec, validation
3. **Callback-based streams** for PubSub + Monitoring (NATS supports callbacks)
4. **AsyncIterable preservation** for Consumer + ObjectStore (need iteration control)

---

## Testing

### Prerequisites

- Containers: `tmnl_nats` and `tmnl_durable_streams` running
- Start: `docker compose -f docker/docker-compose.yml up -d nats durable-streams`

### Runtime Split

| Runtime | Use Case | Test Pattern |
|---------|----------|--------------|
| **Vitest (Node)** | HTTP API tests, most Holonet tests | `bunx vitest run src/lib/holonet` |
| **Bun** | `@effect/platform-bun` tests | `bun test src/lib/holonet/**/*.bun.test.ts` |

### Test Suite Map

| Suite | Tests | Coverage |
|-------|-------|----------|
| Durable-Streams Integration | 12 | Core CRUD, live modes |
| Durable-Streams Recovery | 11 | Reconnection, cleanup, timeouts |
| Durable-Streams Load | 6 | Throughput, concurrency, latency |
| Durable-Streams Metrics | 18 | Tracing, snapshots, export |
| Durable-Streams Services | 24 | Unit tests per service |
| Durable-Streams Schemas | 8 | Protocol validation |
| Durable-Streams API | 10 | HTTP handlers |
| NATS Primitives | ~30 | PubSub, Stream, Consumer |
| Subject Registry | ~15 | Registration, resolution, conventions |
| Integration Spikes | ~10 | Schema headers, SSE bridging |

---

## Glossary

| Term | Definition |
|------|------------|
| **Control Cursor** | Client's authoritative replay position (`fromSeq`). Sent during recovery. |
| **Ack Policy** | JetStream consumer acknowledgement behavior. Typically `explicit` or `all`. |
| **Ack Wait** | Timeout after which unacknowledged messages are redelivered. |
| **Backpressure Window** | Credit-based limit on in-flight messages via `ControlCredit`. |
| **Data Plane** | Message flow delivering application data (`DataMessage`). |
| **Control Plane** | Coordination flow (ack, cursor, heartbeat, subscription, flow control). |
| **Duplex** | Bidirectional data-plane. Data downstream, control/feedback upstream. |
| **Replay Gap** | Missing sequence segment after disconnect. Filled by `DataMessageBatch`. |
| **Schema Drift** | Payloads no longer validating against expected consumer schema. |

---

## Related Documents

- [Holonet Architecture](../libraries/holonet.md) -- Full service architecture and migration strategy
- [NATS Infrastructure](../references/nats-infrastructure.md) -- Deployment, KV, PubSub subjects
- [NATS MQTT Bridge](../references/nats-mqtt-bridge.md) -- Feature support, topic translation
- [WebSocket Realtime](websocket-realtime.md) -- RPC streaming over WebSocket
- [Stream Processing](stream-processing.md) -- Ingestion pipeline architecture
- [ADR-001: NATS-Only Broker](../decisions/adr-001-nats-only-broker.md) -- Broker architecture decision

---

## Source Materials

| Source | Content |
|--------|---------|
| `src/lib/holonet/ARCHITECTURE.md` | 3-layer architecture, service inventory, migration strategy |
| `src/lib/holonet/ANALYSIS.md` | Code duplication inventory, anti-patterns, Effect alternatives |
| `src/lib/holonet/REFACTORING_PLAN.md` | Phased refactoring roadmap, success criteria |
| `src/lib/holonet/docs/HOLONET_AUDIT_OVERVIEW.md` | 3-pass audit (arch, durable-streams, NATS) |
| `src/lib/holonet/docs/HOLONET_DUPLEX_SPEC.md` | Duplex frame envelope, control/data messages, protocol negotiation |
| `src/lib/holonet/docs/HOLONET_EDGE_CASES.md` | 7 edge cases with gap matrix and solution sets |
| `src/lib/holonet/docs/HOLONET_RESEARCH_ROUNDS.md` | 3 research rounds (durability, flow control, recovery) |
| `src/lib/holonet/docs/HOLONET_TESTING.md` | Runtime split, test commands, suite map |
| `src/lib/holonet/docs/GLOSSARY.md` | Protocol term definitions |
| `src/lib/holonet/durable-streams/README.md` | Durable-streams services, metrics, performance benchmarks |
