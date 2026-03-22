# Holonet Audit — Pass Ledger (Agent-Readable)

## Agent Frontmatter

- **Audience**: Agents + maintainers
- **Reading Order**: Meta → Clarifications → Passes → Appendix → Open Questions
- **High‑Signal Sections**: Pass 4 (Duplex), Appendix (Spec Draft), I.6–I.8 (Edge cases + gaps)
- **Index Anchors**: `IDX:holonet.arch`, `IDX:holonet.durable`, `IDX:holonet.nats`, `IDX:holonet.duplex`, `IDX:holonet.duplex.spec`, `IDX:holonet.research`
- **Related Docs**: `src/lib/holonet/docs/INDEX.md`, `src/lib/holonet/docs/GLOSSARY.md`

## Meta

- **Date**: 2026-01-13
- **Scope**: `src/lib/holonet`
- **Mode**: Audit + Protocol Proposals (no code changes)
- **Objective**: Enumerate current system, surface gaps, propose duplex protocol directions
- **Owner**: Val (audit), Prime (decisions)
- **Status**: Active

## Clarifications (Ground Truth)

- Duplex target: **true data-plane bidirectionality**.
- Durable-Streams is **long-term API**, not “edge” by constraint.
- “Robust” = durable, likely multi-transport; research will extend beyond existing code.
- Output must include **audit + protocol proposals**.

---

## ToC

- [Index Seeds](#index-seeds)
- [Beads (Progress Tracking)](#beads-progress-tracking)
- [Pass 1 — Architecture & Module Map](#pass-1--architecture--module-map-idxholonetarch)
- [Pass 2 — Durable-Streams Surface](#pass-2--durable-streams-surface-idxholonetdurable)
- [Pass 3 — NATS + Subject + Integration Inventory](#pass-3--nats--subject--integration-inventory-idxholonetnats)
- [Pass 4 — Duplex Gaps + Protocol Proposals](#pass-4--duplex-gaps--protocol-proposals-idxholonetduplex)
- [Pass 5 — Research Rounds (Theory → Stack)](#pass-5--research-rounds-theory--stack-idxholonetresearch)
- [Open Questions](#open-questions)
- [Split Proposal](#split-proposal)

---

## Index Seeds

**Primary tags**: `holonet`, `durable-streams`, `jetstream`, `duplex`, `nats.ws`, `schema-registry`  
**Secondary tags**: `control-plane`, `data-plane`, `ack`, `nack`, `flow-control`, `replay`, `subject-registry`, `control-cursor`  
**Aliases**: `edge-api` → `durable-streams-api`, `duplex` → `bidirectional`  
**See also**: `docs/GLOSSARY.md`

---

## Beads (Progress Tracking)

| Bead    | Phase   | Goal                             | Status   |
| ------- | ------- | -------------------------------- | -------- |
| **B01** | Phase 1 | Architecture & module map        | **done** |
| **B02** | Phase 2 | Durable-Streams surface          | **done** |
| **B03** | Phase 3 | NATS + Subject + Integration     | **done** |
| **B04** | Phase 4 | Duplex gaps + protocol proposals | **done** |
| **B05** | Phase 5 | Research rounds (theory → stack) | **done** |

---

## Pass 1 — Architecture & Module Map [IDX:holonet.arch]

**Intent**: Establish macro architecture + declared design goals.  
**Scope**: `ARCHITECTURE.md`, `ANALYSIS.md`, `REFACTORING_PLAN.md`, `index.ts` barrels.

**Surface**

- Holonet is a **NATS/JetStream enhancement** to Effect patterns. `src/lib/holonet/ARCHITECTURE.md`
- Planned service stack: `NatsPubSub`, `NatsStream`, `NatsConsumer`, `NatsObject`, `NatsRpc`, `NatsMonitoring`. `src/lib/holonet/ARCHITECTURE.md`
- Integration layer planned: `HolonetEventLog`, `HolonetStreamProcessor`. `src/lib/holonet/ARCHITECTURE.md`

**Signals**

- Analysis flags **70% code duplication** + **non-Effectual stream patterns**. `src/lib/holonet/ANALYSIS.md`
- Refactoring plan describes shared utilities + base service hierarchy. `src/lib/holonet/REFACTORING_PLAN.md`

**Gaps**

- Architecture doc lists **planned services**; not all are surfaced in implementation.

**Next probes**

- Confirm which “planned” services are real vs aspirational.

---

## Pass 2 — Durable-Streams Surface [IDX:holonet.durable]

**Intent**: Enumerate durable-streams API, services, tests.  
**Scope**: `durable-streams/*` + tests.

**Surface**

- Durable-streams = **HTTP protocol → NATS JetStream bridge**. `src/lib/holonet/durable-streams/README.md`
- `StreamBridgeService`: `create`, `append`, `read`, `metadata`, `delete`. `src/lib/holonet/durable-streams/services/StreamBridgeService.ts`
- `LiveStreamService`: `longPoll`, `sse`, `subscribe`. `src/lib/holonet/durable-streams/services/LiveStreamService.ts`
- `ConsumerStateService`: offset tracking. `src/lib/holonet/durable-streams/services/__tests__/ConsumerStateService.test.ts`
- `StreamCodecService`: schema-aware encode/decode. `src/lib/holonet/durable-streams/services/__tests__/StreamCodecService.test.ts`

**Behavior**

- `LiveStreamService` uses `Stream.unfoldChunkEffect` polling (offset+limit). `src/lib/holonet/durable-streams/services/LiveStreamService.ts`
- Integration tests validate real NATS/JetStream + schema headers. `src/lib/holonet/durable-streams/__tests__/integration.test.ts`

**Gaps**

- SSE/subscribe appear **poll-derived**, not true push/duplex.

**Next probes**

- Inspect NATS primitives + integration processor for duplex hooks.

---

## Pass 3 — NATS + Subject + Integration Inventory [IDX:holonet.nats]

**Intent**: Enumerate NATS primitives, subject registry, and integration utilities.  
**Scope**: `nats/*`, `subject/*`, `integration/*`.

**NATS Primitives**

- `NatsConnectionService`: `nc`, `js`, `jsm`, `config`. `src/lib/holonet/nats/connection.ts`
- `NatsPubSubService`: `publish`, `subscribe`, `request`, `flush`. `src/lib/holonet/nats/pubsub.ts`
- `NatsStreamService`: `ensureStream`, `publish`, `subscribe`, `fetch`, `next`, `getConsumer`, `getStreamInfo`, `deleteStream`. `src/lib/holonet/nats/stream.ts`
- `NatsCodecService` + `NatsCodec` for encode/decode (batch + stream). `src/lib/holonet/nats/codec.ts`

**Subject System**

- `SubjectRegistry`: `register`, `update`, `get`, `query`, `resolveStreamName`, `specsByStream`, `catalog`. `src/lib/holonet/subject/registry.ts`
- `DomainConventionRegistry`: GEOINT/SCADA/MES/EVENTS conventions. `src/lib/holonet/subject/conventions.ts`
- `SubjectSpec`: `resolve`, `matches`, `placeholders`, `extractParams`. `src/lib/holonet/subject/schemas.ts`

**Integration Layer**

- `HolonetStreamProcessor`: `publish`, `publishBatch`, `read`, `subscribe`, `subscribeFrom`, `getInfo`, `getCurrentSequence`, `delete`. `src/lib/holonet/integration/stream-processor.ts`
- `StreamProcessorConfig`: `streamName`, `subject(s)`, `consumerName`, `retention`, `maxAge`, `maxBytes`, `maxMsgs`, `replicas`. `src/lib/holonet/integration/stream-processor.ts`

**Gaps**

- Duplex coordination (ack/nack, backpressure, control-plane mutations) isn’t exposed as a unified data-plane API.
- Subject registry supports mapping but no explicit **session binding** (client ↔ stream ↔ consumer).

**Next probes**

- Extract precise data-plane pathways from NATS stream + processor.

---

## Pass 4 — Duplex Gaps + Protocol Proposals [IDX:holonet.duplex]

**Intent**: Convert audit to actionable protocol directions for **true duplex**.  
**Scope**: durable-streams + nats + integration surface.

**Evidence (Internal)**

- Poll-derived live streams (`longPoll`, `sse`, `subscribe`) via `Stream.unfoldChunkEffect`. `src/lib/holonet/durable-streams/services/LiveStreamService.ts`
- NATS stream tests validate **msgId dedupe** and **duplicateWindow** semantics. `src/lib/holonet/nats/__tests__/stream.test.ts`
- NATS pubsub tests validate request/reply and typed streams. `src/lib/holonet/nats/__tests__/pubsub.test.ts`
- Integration stream bridge tests cover schema headers + decode failures. `src/lib/holonet/integration/spike/__tests__/nats-stream-bridge.test.ts`

**Grounding (External)**

- JetStream consumer models, ack policies, deliver policies: https://docs.nats.io/nats-concepts/jetstream/consumers
- Consumer details (durable, ack_wait, max_ack_pending, pull vs push): https://docs.nats.io/using-nats/developer/develop_jetstream/consumers
- JetStream model deep dive: https://docs.nats.io/using-nats/developer/develop_jetstream/model_deep_dive
- SSE spec (Last-Event-ID, event format): https://html.spec.whatwg.org/dev/server-sent-events.html
- SSE usage & error handling: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#error_handling
- SSE is one-way (explicit limitation): https://web.dev/articles/eventsource-basics

**Observed Gaps**

- Live streaming is **poll-derived** (offset/limit iteration), not a push/duplex channel.
- Control-plane operations (create/alter/ack/nack/flow-control) are not exposed as duplex messages.
- Durable-streams lacks **resume tokens** or **Last-Event-ID**–style replay hints.

**Protocol Proposals (Directional)**

1. **Duplex WS Data Plane (Primary candidate)**
   - Downlink: JetStream consumer push or internal fanout
   - Uplink: control messages (ack/nack, flow-control credits, cursor)
   - Model: `subject.<streamId>.data` + `subject.<streamId>.control` or multiplexed frame types
2. **SSE Downlink + WS/HTTP Uplink (Compatibility)**
   - SSE for downlink durability with `Last-Event-ID`
   - Separate control endpoint for acks and cursor advancement
3. **NATS WS Client Direct (High-capability clients)**
   - Clients connect to NATS WS; use request/reply for control, JetStream consumer for downlink
   - Durable-Streams HTTP becomes compatibility layer

**Design Axes (From NATS + SSE)**

- **Ack policy**: `AckPolicy.All` or `AckPolicy.Explicit` for durability (NATS docs)
- **Backpressure**: `max_ack_pending` + pull consumers for credit-based flow control (NATS docs)
- **Replay**: cursor-based resume using `Last-Event-ID` equivalent (SSE spec)
- **Push vs pull**: pull consumer for deterministic backpressure; push for low-latency broadcast

---

## Pass 5 — Research Rounds (Theory → Stack) [IDX:holonet.research]

**Intent**: Ground “robust duplex” in canonical protocols and map to Effect + NATS.

**Round 1 — Durability & Ordering**

- JetStream consumer semantics and ack policies: https://docs.nats.io/nats-concepts/jetstream/consumers
- Consumer configuration details: https://docs.nats.io/using-nats/developer/develop_jetstream/consumers

**Round 2 — Flow Control / Backpressure**

- `max_ack_pending`, `ack_wait`, pull vs push (NATS docs) as explicit levers
- Use pull consumer to model **credits**; push consumer for latency when safe

**Round 3 — Resume / Recovery**

- SSE `Last-Event-ID` resume semantics: https://html.spec.whatwg.org/dev/server-sent-events.html
- Error handling + reconnect strategy: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#error_handling

**Mapping to Holonet**

- **Durable-Streams SSE**: add `Last-Event-ID` support and cursor resume to `LiveStreamService` semantics.
- **Duplex WS**: model ack/nack + flow control as control-plane messages; data-plane via JetStream consumer.
- **NATS WS direct**: reserved for high-capability clients; Durable-Streams remains compatibility.

**Research Outcomes (v1)**

- SSE is inherently **one-way**, so duplex requires a second channel.
- JetStream provides **durability + replay + flow control**, but must be surfaced explicitly in the API.
- Pull consumers align with **credit-based flow control** for robust duplex data-plane design.

---

## Pass 5 — Research Rounds (Theory → Stack) [IDX:holonet.research]

**Intent**: Triangulate “robust duplex” against best practices and map to Effect + NATS stack.

**Round 1 — Protocol Durability**

- JetStream ordered consumers, ack policy, delivery semantics
- SSE durability patterns (resume tokens, event IDs)

**Round 2 — Flow Control / Backpressure**

- Credit/window delivery; NATS flow control + idle heartbeats
- Mapping to `Effect.Stream` and durable consumer options

**Round 3 — Duplex Integrity & Recovery**

- Client resync + server replay
- Idempotent publish + dedupe (`msgId`, `expectLastSequence`)

---

## Duplex Protocol Appendix (Spec Draft v0.1) [IDX:holonet.duplex.spec]

**Intent**: Provide a concrete, schema-first protocol draft for true duplex data-plane over NATS/WS/SSE.  
**Status**: Draft for discussion (no code changes).

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

- **WS Duplex (Primary)**
  - Single connection, multiplexed frames: `FrameEnvelope` + `ControlMessage` / `DataPlaneMessage`.
  - Downlink via JetStream consumer (push or pull); uplink via control messages.
- **SSE + Uplink (Compatibility)**
  - Downlink: `DataPlaneMessage` serialized, use `Last-Event-ID` for `seq` resume.
  - Uplink: HTTP/WS control endpoint for `Control*` messages.
- **NATS WS Direct (High-capability clients)**
  - Data plane uses JetStream consumer; control plane uses request/reply subjects.

### E. Subject Conventions (Draft)

- `holonet.stream.<streamId>.data` — data plane
- `holonet.stream.<streamId>.control` — control plane
- `holonet.stream.<streamId>.admin` — lifecycle operations (create/alter)

### F. Flow Control (Draft)

- **Pull consumers** model credits: `ControlCredit` = batch request.
- **Ack policy** defaults to explicit for control/data durability.
- **Heartbeat** aligns with SSE comment/WS ping.

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
**Signals**:

- `Last-Event-ID` (SSE) or `ControlCursor` (WS) carries resume cursor
- `ControlCredit` used to resume pull-based flow control
- `ControlAck` batch used to reconcile server cursor

**Recovery Steps**

1. Client reconnects and sends `HandshakeHello` with `resumeFromSeq` or last known cursor.
2. Server responds `HandshakeWelcome` with negotiated capabilities + heartbeat interval.
3. Client emits `ControlCursor` if required to force replay offset.
4. Server sends `DataMessageBatch` to fill gap, then switches to streaming.

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

- `LiveStreamService.sse`: verifies metadata, then polls `StreamBridgeService.read` in `Stream.unfoldChunkEffect`, limit=50, sleeps 100ms on empty; stops after 10 empty polls in mock mode; merges with heartbeat stream. `src/lib/holonet/durable-streams/services/LiveStreamService.ts`
- `LiveStreamService.subscribe`: same polling loop + `Stream.buffer({ capacity, strategy: 'sliding' })` for backpressure shaping. `src/lib/holonet/durable-streams/services/LiveStreamService.ts`
- `StreamBridgeService.Default`: in-memory store; `read` uses `findIndex(m.seq > offset)` and returns `nextOffset` as last seq; `metadata` exposes counts + seq bounds. `src/lib/holonet/durable-streams/services/StreamBridgeService.ts`
- `NatsStreamService.subscribe`: creates durable or ephemeral consumer with `ackPolicy` default `explicit`, `deliverPolicy` default `new`; consumes async iterator -> Effect Stream via `fromAsyncIterable`. `src/lib/holonet/nats/stream.ts`
- `TypedJsMessage` exposes `ack`, `nak`, `working`, `term` to wire control plane in duplex. `src/lib/holonet/nats/stream.ts`
- `NatsStreamService.fetch/next` provide pull-based consumption with `idle_heartbeat` and `expires` knobs. `src/lib/holonet/nats/stream.ts`

### I.6 Edge-Case Expectations (Spec-Level)

**Intent**: define correctness targets for unwritten duplex code, with evidence + gap hypotheses.

1. **Duplicate Publish (Dedup Window)**

   - **Expectation**: duplicate publish with same `msgId` yields `duplicate=true`, no new seq.
   - **Evidence (internal)**: dedupe test uses `msgId` + `duplicateWindow`. `src/lib/holonet/nats/__tests__/stream.test.ts`
   - **Evidence (external)**: JetStream consumers/streams concepts. https://docs.nats.io/nats-concepts/jetstream/consumers
   - **Gap hypothesis**: duplex control plane lacks **idempotency contract** for duplicate acks/republishes.

2. **Ack Wait Timeout**

   - **Expectation**: if client fails to `ControlAck` before `ack_wait`, message re-delivers.
   - **Evidence (internal)**: consumer config exposes `ackWait`, `maxDeliver`. `src/lib/holonet/nats/stream.ts`
   - **Evidence (external)**: consumer details (ack wait semantics). https://docs.nats.io/using-nats/developer/develop_jetstream/consumers
   - **Gap hypothesis**: no explicit **redelivery signaling** in duplex frames (needs `redelivered` flag or replay marker).

3. **Replay Gap / Cursor Skip**

   - **Expectation**: client reconnects with cursor; server sends `DataMessageBatch` filling gap.
   - **Evidence (internal)**: pull consumers (`fetch`/`next`) for replay. `src/lib/holonet/nats/stream.ts`
   - **Evidence (external)**: consumer semantics + delivery policies. https://docs.nats.io/nats-concepts/jetstream/consumers
   - **Gap hypothesis**: durable-streams lacks **cursor negotiation** and **gap-fill handshake**.

4. **Out-of-Order Delivery (Multi-Subject Streams)**

   - **Expectation**: order guaranteed per consumer, not per subject; client must rely on `seq`.
   - **Evidence (internal)**: `TypedJsMessage.seq` is exposed as authoritative. `src/lib/holonet/nats/stream.ts`
   - **Evidence (external)**: consumer ordering guarantees. https://docs.nats.io/nats-concepts/jetstream/consumers
   - **Gap hypothesis**: client UI may incorrectly assume subject-ordering without seq reconciliation.

5. **Backpressure Overflow**

   - **Expectation**: if `max_ack_pending` exceeded, server throttles delivery or blocks.
   - **Evidence (internal)**: `maxAckPending` is configurable in consumer creation. `src/lib/holonet/nats/stream.ts`
   - **Evidence (external)**: consumer config + limits. https://docs.nats.io/using-nats/developer/develop_jetstream/consumers
   - **Gap hypothesis**: duplex control plane lacks **credit windows** to prevent `max_ack_pending` saturation.

6. **Heartbeat Loss (SSE/WS)**

   - **Expectation**: missing heartbeats triggers `STALLED` → `RECOVERING` transition.
   - **Evidence (internal)**: SSE heartbeats merged into stream. `src/lib/holonet/durable-streams/services/LiveStreamService.ts`
   - **Evidence (external)**: SSE event stream format + reconnect behavior. https://html.spec.whatwg.org/dev/server-sent-events.html
   - **Gap hypothesis**: no **timeout-driven recovery state machine** in durable-streams yet.

7. **Schema Drift**
   - **Expectation**: decode errors are isolated; stream continues; client receives `ControlError`.
   - **Evidence (internal)**: codec decode errors in pubsub tests. `src/lib/holonet/nats/__tests__/pubsub.test.ts`
   - **Evidence (external)**: SSE is one‑way; errors must be app‑level. https://web.dev/articles/eventsource-basics
   - **Gap hypothesis**: no structured **error channel** in durable-streams SSE/subscribe output.

### I.7 Gap → Edge‑Case Matrix (Draft)

| Gap                       | Edge Case(s)          | Risk   | Observable Symptom                                 |
| ------------------------- | --------------------- | ------ | -------------------------------------------------- |
| No idempotency contract   | Duplicate Publish     | High   | Duplicate acks or double-applied side effects      |
| No redelivery signaling   | Ack Wait Timeout      | High   | Silent repeats indistinguishable from new data     |
| No cursor handshake       | Replay Gap            | High   | Missing or duplicated segments after reconnect     |
| No seq-first ordering doc | Out-of-Order Delivery | Medium | UI/order logic incorrect for multi-subject streams |
| No credit-based control   | Backpressure Overflow | High   | Consumer stalls, pending acks saturate             |
| No recovery state machine | Heartbeat Loss        | Medium | SSE/WS disconnects without resync                  |
| No error channel          | Schema Drift          | Medium | Stream aborts or client misinterprets failure      |

### I.8 Solution Sets (Options per Gap)

1. **Idempotency Contract**

   - Option A: standardize `msgId` + `duplicate` result in control-plane ACKs
   - Option B: include `dedupeWindowMs` in handshake so client can coalesce

2. **Redelivery Signaling**

   - Option A: add `redelivered: boolean` on `DataMessage`
   - Option B: add `ControlRedeliveryNotice` for explicit replay bursts

3. **Cursor Handshake**

   - Option A: mandatory `ControlCursor` on reconnect (server applies)
   - Option B: server sends `CursorOffered`, client accepts with `ControlCursor`

4. **Seq‑first Ordering**

   - Option A: spec declares `seq` authoritative; subjects informational
   - Option B: per‑subject seq hints (advanced, optional)

5. **Credit‑based Flow Control**

   - Option A: `ControlCredit` windows on pull consumer
   - Option B: auto‑credit based on buffer + ack latency

6. **Recovery State Machine**

   - Option A: client‑side timeouts trigger recovery handshake
   - Option B: server‑side heartbeat loss triggers replay start

7. **Structured Error Channel**
   - Option A: emit `ControlError` with `seq` and reason
   - Option B: encode error items as `DataMessage` with `_tag: 'Error'`

---

## Open Questions

---

## Split Proposal

**Goal**: split `HOLONET_AUDIT_PASSES.md` into focused, self‑contained docs.

**Proposed documents**

1. `docs/HOLONET_AUDIT_OVERVIEW.md`
   - Meta, clarifications, index seeds, beads
   - Pass 1–3 summaries (architecture, durable-streams, NATS/subject)
2. `docs/HOLONET_DUPLEX_SPEC.md`
   - Pass 4
   - Duplex Protocol Appendix (frames, control/data, transports)
   - Sequence diagrams
3. `docs/HOLONET_EDGE_CASES.md`
   - I.6 edge‑case expectations + evidence
   - I.7 gap→edge matrix
   - I.8 solution sets
4. `docs/HOLONET_RESEARCH_ROUNDS.md`
   - Pass 5 research rounds + external citations
5. `docs/HOLONET_GLOSSARY.md` (already created as `docs/GLOSSARY.md`)
   - Glossary terms + references

**Index wiring**

- `docs/INDEX.md` becomes single entry point linking all above.
- Each doc includes an `Agent Frontmatter` block with anchors and dependencies.

1. Single WS multiplex or dual-channel (SSE + WS/HTTP uplink)?
2. Cursor is authoritative client-side or server-side? How do we arbitrate conflicts?
3. Are control-plane ops (create/alter) exposed over duplex, or only admin APIs?
4. SubjectRegistry: should control/data/admin be explicit in SubjectSpec?
5. Should `DataMessageBatch` be default to reduce overhead, or optional?

---

**Next Update**: Add a protocol negotiation section (capabilities + versioning) and a recovery state machine (client reconnect + replay handshake).
