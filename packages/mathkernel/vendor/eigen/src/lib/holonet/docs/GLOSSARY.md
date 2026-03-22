# Holonet Glossary

**Purpose**: Canonical definitions for Holonet protocol terms.  
**Index Tags**: `holonet` `glossary` `duplex` `control-plane` `data-plane`

## Core Terms

### Control Cursor

**Definition**: A control-plane message carrying the client’s authoritative replay position (`fromSeq`). It is used to request a deterministic resumption point after disconnection or to reconcile a drift between client and server cursor.

**Context**:

- Sent during recovery to force replay starting sequence.
- Distinct from `Last-Event-ID` (SSE), but semantically similar.

**Related**:

- `ControlCursor` (protocol draft)
- `Last-Event-ID` (SSE)
- `DataMessageBatch`

---

### Ack Policy

**Definition**: JetStream consumer acknowledgement behavior. Typically `explicit` (per-message) or `all` (ack latest implies prior). Used to control durability and redelivery.

**Related**:

- `ack_wait`, `max_ack_pending`
- `ControlAck`, `ControlNack`

---

### Ack Wait

**Definition**: Timeout window after which unacknowledged messages are eligible for redelivery.

**Related**:

- `ControlAck`
- `Redelivery`

---

### Backpressure Window

**Definition**: A credit-based limit on in-flight messages. The client issues `ControlCredit` to allow N messages; server honors this cap.

**Related**:

- `ControlCredit`
- `max_ack_pending`

---

### Data Plane

**Definition**: Message flow delivering application data (`DataMessage`), typically downlink.

**Related**:

- `DataMessage`, `DataMessageBatch`
- `subject.<streamId>.data`

---

### Control Plane

**Definition**: Message flow for coordination (ack, cursor, heartbeat, subscription, flow control).

**Related**:

- `Control*` messages
- `subject.<streamId>.control`

---

### Duplex

**Definition**: Bidirectional data-plane interaction. Data flows downstream; control/feedback flows upstream, enabling durable replay and flow control.

---

### Heartbeat

**Definition**: Periodic signal indicating liveness. SSE uses comment frames; WS uses ping/pong; control plane may use `ControlHeartbeat`.

---

### Replay Gap

**Definition**: Missing segment of sequence numbers after disconnect/resume. Must be filled by `DataMessageBatch` or explicit replay fetch.

---

### Redelivery

**Definition**: Message re-sent by server after ack timeout or failure. Client must treat duplicates idempotently.

---

### Schema Drift

**Definition**: When stream payloads no longer validate against the schema expected by the consumer.

---

## Transport Terms

### SSE (Server-Sent Events)

**Definition**: One-way server→client event stream over HTTP; uses `Last-Event-ID` for resume.

---

### WS (WebSocket)

**Definition**: Bidirectional socket over HTTP upgrade; used for multiplexed duplex control/data.

---

### NATS WS Direct

**Definition**: Client connects directly to NATS server via WebSocket, using JetStream consumers for data and request/reply for control.

---

## Protocol Artifacts (Draft)

### DataMessage

**Definition**: Envelope for data-plane message (`seq`, `subject`, `schemaId`, `data`).

---

### DataMessageBatch

**Definition**: Batch of `DataMessage` used for gap-fill or bulk replay.

---

### ControlAck

**Definition**: Control-plane message acknowledging receipt up to a specific sequence.

---

### ControlNack

**Definition**: Control-plane message requesting redelivery (optionally delayed).

---

### ControlCredit

**Definition**: Control-plane credit grant allowing N messages in-flight.

---

### HandshakeHello

**Definition**: Client-to-server negotiation message advertising capabilities and resume cursor.

---

### HandshakeWelcome

**Definition**: Server-to-client negotiation response containing negotiated capabilities.

---

### HandshakeReject

**Definition**: Server-to-client negotiation rejection with supported protocol versions.
