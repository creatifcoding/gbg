# Holonet Duplex Spec Draft

## Agent Frontmatter

- **Audience**: Agents + maintainers
- **Reading Order**: Pass 4 → Appendix → Sequence Diagrams → Edge‑case links
- **High‑Signal**: I.6–I.8, I.5 implementation notes
- **Related**: `docs/HOLONET_EDGE_CASES.md`, `docs/HOLONET_RESEARCH_ROUNDS.md`, `docs/GLOSSARY.md`

## Pass 4 — Duplex Gaps + Protocol Proposals [IDX:holonet.duplex]

**Intent**: Convert audit to actionable protocol directions for **true duplex**.

**Evidence (Internal)**

- Poll-derived live streams via `Stream.unfoldChunkEffect`. `src/lib/holonet/durable-streams/services/LiveStreamService.ts`
- NATS stream tests validate **msgId dedupe** and **duplicateWindow** semantics. `src/lib/holonet/nats/__tests__/stream.test.ts`
- NATS pubsub tests validate request/reply and typed streams. `src/lib/holonet/nats/__tests__/pubsub.test.ts`
- Integration stream bridge tests cover schema headers + decode failures. `src/lib/holonet/integration/spike/__tests__/nats-stream-bridge.test.ts`

**Grounding (External)**

- JetStream consumers: https://docs.nats.io/nats-concepts/jetstream/consumers
- Consumer details: https://docs.nats.io/using-nats/developer/develop_jetstream/consumers
- JetStream model deep dive: https://docs.nats.io/using-nats/developer/develop_jetstream/model_deep_dive
- SSE spec: https://html.spec.whatwg.org/dev/server-sent-events.html
- SSE error handling: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#error_handling
- SSE one‑way limitation: https://web.dev/articles/eventsource-basics

**Observed Gaps**

- Live streaming is **poll-derived**, not push/duplex.
- Control-plane ops (create/alter/ack/nack/flow-control) are not exposed as duplex messages.
- Durable-streams lacks **resume tokens** / `Last-Event-ID`‑style replay hints.

**Protocol Proposals (Directional)**

1. **Duplex WS Data Plane (Primary)**
2. **SSE Downlink + WS/HTTP Uplink (Compatibility)**
3. **NATS WS Client Direct (High‑capability)**

---

## Duplex Protocol Appendix (Spec Draft v0.1) [IDX:holonet.duplex.spec]

### A. Frame Envelope (Multiplexed)

```ts
import { Schema } from 'effect';

const FrameId = Schema.String;
const StreamId = Schema.String;
const ConsumerId = Schema.String;
const Subject = Schema.String;
const TimestampMs = Schema.Number;

const FrameEnvelope = Schema.Struct({
  id: FrameId,
  streamId: StreamId,
  consumerId: Schema.optional(ConsumerId),
  subject: Schema.optional(Subject),
  timestamp: TimestampMs,
  payload: Schema.Unknown,
});
```

### B. Control Plane Messages (Upstream)

```ts
const ControlAck = Schema.TaggedStruct('ControlAck', {
  streamId: StreamId,
  consumerId: ConsumerId,
  seq: Schema.Number,
  ackAllUpTo: Schema.optional(Schema.Number),
});

const ControlNack = Schema.TaggedStruct('ControlNack', {
  streamId: StreamId,
  consumerId: ConsumerId,
  seq: Schema.Number,
  delayMs: Schema.optional(Schema.Number),
  reason: Schema.optional(Schema.String),
});

const ControlCredit = Schema.TaggedStruct('ControlCredit', {
  streamId: StreamId,
  consumerId: ConsumerId,
  credits: Schema.Number,
});

const ControlCursor = Schema.TaggedStruct('ControlCursor', {
  streamId: StreamId,
  consumerId: ConsumerId,
  fromSeq: Schema.Number,
});

const ControlSubscribe = Schema.TaggedStruct('ControlSubscribe', {
  streamId: StreamId,
  consumerId: Schema.optional(ConsumerId),
  deliverPolicy: Schema.optional(Schema.String),
  ackPolicy: Schema.optional(Schema.String),
  maxAckPending: Schema.optional(Schema.Number),
});

const ControlUnsubscribe = Schema.TaggedStruct('ControlUnsubscribe', {
  streamId: StreamId,
  consumerId: ConsumerId,
});

const ControlHeartbeat = Schema.TaggedStruct('ControlHeartbeat', {
  streamId: StreamId,
  consumerId: ConsumerId,
});

const ControlError = Schema.TaggedStruct('ControlError', {
  streamId: StreamId,
  consumerId: Schema.optional(ConsumerId),
  code: Schema.String,
  message: Schema.String,
});

const ControlMessage = Schema.Union(
  ControlAck,
  ControlNack,
  ControlCredit,
  ControlCursor,
  ControlSubscribe,
  ControlUnsubscribe,
  ControlHeartbeat,
  ControlError
);
```

### C. Data Plane Messages (Downstream)

```ts
const DataMessage = Schema.TaggedStruct('DataMessage', {
  streamId: StreamId,
  seq: Schema.Number,
  subject: Subject,
  timestamp: TimestampMs,
  schemaId: Schema.optional(Schema.String),
  data: Schema.Unknown,
});

const DataHeartbeat = Schema.TaggedStruct('DataHeartbeat', {
  streamId: StreamId,
  timestamp: TimestampMs,
});

const DataMessageBatch = Schema.TaggedStruct('DataMessageBatch', {
  streamId: StreamId,
  fromSeq: Schema.Number,
  toSeq: Schema.Number,
  items: Schema.Array(DataMessage),
});

const DataPlaneMessage = Schema.Union(
  DataMessage,
  DataHeartbeat,
  DataMessageBatch
);
```

### D. Transport Mapping (Draft)

- **WS Duplex (Primary)** — multiplex `ControlMessage` + `DataPlaneMessage`
- **SSE + Uplink** — downlink SSE + separate control endpoint
- **NATS WS Direct** — client uses JetStream consumer + request/reply for control

### E. Subject Conventions (Draft)

- `holonet.stream.<streamId>.data`
- `holonet.stream.<streamId>.control`
- `holonet.stream.<streamId>.admin`

### F. Flow Control (Draft)

- Pull consumers model credits via `ControlCredit` windows
- Ack policy defaults to explicit for durability

### G. Protocol Negotiation (Draft)

```ts
const ProtocolVersion = Schema.String;
const Capability = Schema.Literal(
  'duplex.ws',
  'sse.downlink',
  'ws.uplink',
  'nats.direct',
  'ack.explicit',
  'ack.all',
  'flow.credit',
  'flow.window',
  'batch.data'
);

const HandshakeHello = Schema.TaggedStruct('HandshakeHello', {
  clientId: Schema.String,
  protocol: ProtocolVersion,
  capabilities: Schema.Array(Capability),
  resumeFromSeq: Schema.optional(Schema.Number),
});

const HandshakeWelcome = Schema.TaggedStruct('HandshakeWelcome', {
  protocol: ProtocolVersion,
  negotiated: Schema.Array(Capability),
  heartbeatMs: Schema.Number,
  ackPolicy: Schema.String,
});

const HandshakeReject = Schema.TaggedStruct('HandshakeReject', {
  reason: Schema.String,
  supported: Schema.Array(ProtocolVersion),
});

const HandshakeMessage = Schema.Union(
  HandshakeHello,
  HandshakeWelcome,
  HandshakeReject
);
```

### H. Recovery Handshake + State Machine (Draft)

**States**: `DISCONNECTED → CONNECTING → NEGOTIATING → STREAMING → STALLED → RECOVERING → STREAMING`

**Recovery Steps**

1. Client reconnects with `HandshakeHello(resumeFromSeq)`
2. Server responds `HandshakeWelcome` with negotiated capabilities
3. Client emits `ControlCursor` if required to force replay offset
4. Server sends `DataMessageBatch` to fill gap, then switches to streaming

### I. Sequence Diagrams (Draft)

#### I.1 WS Duplex (Single Connection)

```
Client                 Holonet Gateway              JetStream
  |  WS CONNECT  ------------------------------->      |
  |  HandshakeHello -------------------------------->  |
  |                         HandshakeWelcome <---------|
  |  ControlSubscribe ------------------------------>  |
  |                         create consumer ---------->|
  |<==================== DataMessage stream ===========|
  |  ControlAck / ControlCredit -------------------->  |
  |                         ack / flow control ------>|
```

#### I.2 SSE Downlink + WS/HTTP Uplink

```
Client                 Holonet Gateway              JetStream
  |  HTTP GET /sse ------------------------------->     |
  |                         subscribe consumer -------->|
  |<==== SSE: DataMessage + id:seq =====================|
  |  HTTP/WS POST /control (ack/cursor) ----------->     |
  |                         ack / replay -------------->|
```

#### I.3 Recovery / Resume

```
Client                 Holonet Gateway              JetStream
  |  reconnect WS/SSE ------------------------------>    |
  |  HandshakeHello(resumeFromSeq) ----------------->    |
  |                         HandshakeWelcome --------->  |
  |  ControlCursor(seq) ----------------------------->   |
  |                         fetch from seq ------------->|
  |<==== DataMessageBatch (gap fill) ====================|
  |<==== DataMessage stream =============================|
```

#### I.4 NATS WS Direct (High-capability)

```
Client (NATS WS)        JetStream
  |  connect ------------------------------>
  |  create consumer (request/reply) ----->
  |<== DataMessage (consumer stream) =====
  |  ack/nack/next (request) ------------->
```

### I.5 Implementation Notes (Current Code)

- `LiveStreamService.sse`: polling read + heartbeat merge. `src/lib/holonet/durable-streams/services/LiveStreamService.ts`
- `LiveStreamService.subscribe`: polling loop + sliding buffer. `src/lib/holonet/durable-streams/services/LiveStreamService.ts`
- `StreamBridgeService.Default`: in‑memory store, `read` uses seq > offset. `src/lib/holonet/durable-streams/services/StreamBridgeService.ts`
- `NatsStreamService.subscribe`: durable/ephemeral consumer, ackPolicy default `explicit`. `src/lib/holonet/nats/stream.ts`
- `TypedJsMessage` exposes `ack/nak/working/term`. `src/lib/holonet/nats/stream.ts`
- `NatsStreamService.fetch/next`: pull‑based with `idle_heartbeat` + `expires`. `src/lib/holonet/nats/stream.ts`
