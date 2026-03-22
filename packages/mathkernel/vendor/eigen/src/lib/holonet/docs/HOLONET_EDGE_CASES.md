# Holonet Edge Cases & Gaps

## Agent Frontmatter

- **Audience**: Agents + maintainers
- **Reading Order**: Edge‑Case Expectations → Gap Matrix → Solution Sets
- **High‑Signal**: I.6–I.8
- **Related**: `docs/HOLONET_DUPLEX_SPEC.md`, `docs/HOLONET_RESEARCH_ROUNDS.md`, `docs/GLOSSARY.md`

## I.6 Edge‑Case Expectations (Spec‑Level)

**Intent**: define correctness targets for unwritten duplex code, with evidence + gap hypotheses.

1. **Duplicate Publish (Dedup Window)**

   - **Expectation**: duplicate publish with same `msgId` yields `duplicate=true`, no new seq.
   - **Evidence (internal)**: `msgId` + `duplicateWindow`. `src/lib/holonet/nats/__tests__/stream.test.ts`
   - **Evidence (external)**: https://docs.nats.io/nats-concepts/jetstream/consumers
   - **Gap hypothesis**: duplex control plane lacks **idempotency contract** for duplicate acks/republishes.

2. **Ack Wait Timeout**

   - **Expectation**: if client fails to `ControlAck` before `ack_wait`, message re-delivers.
   - **Evidence (internal)**: `ackWait`, `maxDeliver`. `src/lib/holonet/nats/stream.ts`
   - **Evidence (external)**: https://docs.nats.io/using-nats/developer/develop_jetstream/consumers
   - **Gap hypothesis**: no explicit **redelivery signaling** in duplex frames.

3. **Replay Gap / Cursor Skip**

   - **Expectation**: reconnect with cursor; server sends `DataMessageBatch` to fill gap.
   - **Evidence (internal)**: pull consumer `fetch`/`next`. `src/lib/holonet/nats/stream.ts`
   - **Evidence (external)**: https://docs.nats.io/nats-concepts/jetstream/consumers
   - **Gap hypothesis**: no **cursor negotiation** / **gap‑fill handshake**.

4. **Out‑of‑Order Delivery (Multi‑Subject Streams)**

   - **Expectation**: order guaranteed per consumer, not per subject; rely on `seq`.
   - **Evidence (internal)**: `TypedJsMessage.seq`. `src/lib/holonet/nats/stream.ts`
   - **Evidence (external)**: https://docs.nats.io/nats-concepts/jetstream/consumers
   - **Gap hypothesis**: clients may assume subject ordering.

5. **Backpressure Overflow**

   - **Expectation**: if `max_ack_pending` exceeded, server throttles/blocks.
   - **Evidence (internal)**: `maxAckPending` config. `src/lib/holonet/nats/stream.ts`
   - **Evidence (external)**: https://docs.nats.io/using-nats/developer/develop_jetstream/consumers
   - **Gap hypothesis**: no **credit window** mechanism in duplex.

6. **Heartbeat Loss (SSE/WS)**

   - **Expectation**: missing heartbeat triggers recovery.
   - **Evidence (internal)**: SSE heartbeat merge. `src/lib/holonet/durable-streams/services/LiveStreamService.ts`
   - **Evidence (external)**: https://html.spec.whatwg.org/dev/server-sent-events.html
   - **Gap hypothesis**: no recovery state machine in durable-streams.

7. **Schema Drift**
   - **Expectation**: decode errors isolated; stream continues with `ControlError`.
   - **Evidence (internal)**: codec decode errors. `src/lib/holonet/nats/__tests__/pubsub.test.ts`
   - **Evidence (external)**: https://web.dev/articles/eventsource-basics
   - **Gap hypothesis**: no structured error channel in SSE/subscribe.

---

## I.7 Gap → Edge‑Case Matrix (Draft)

| Gap                       | Edge Case(s)          | Risk   | Observable Symptom                                 |
| ------------------------- | --------------------- | ------ | -------------------------------------------------- |
| No idempotency contract   | Duplicate Publish     | High   | Duplicate acks or double‑applied side effects      |
| No redelivery signaling   | Ack Wait Timeout      | High   | Silent repeats indistinguishable from new data     |
| No cursor handshake       | Replay Gap            | High   | Missing or duplicated segments after reconnect     |
| No seq‑first ordering doc | Out‑of‑Order Delivery | Medium | UI/order logic incorrect for multi‑subject streams |
| No credit‑based control   | Backpressure Overflow | High   | Consumer stalls, pending acks saturate             |
| No recovery state machine | Heartbeat Loss        | Medium | SSE/WS disconnects without resync                  |
| No error channel          | Schema Drift          | Medium | Stream aborts or client misinterprets failure      |

---

## I.8 Solution Sets (Options per Gap)

1. **Idempotency Contract**

   - A: standardize `msgId` + `duplicate` result in control‑plane ACKs
   - B: include `dedupeWindowMs` in handshake so client can coalesce

2. **Redelivery Signaling**

   - A: add `redelivered: boolean` on `DataMessage`
   - B: add `ControlRedeliveryNotice` for replay bursts

3. **Cursor Handshake**

   - A: mandatory `ControlCursor` on reconnect
   - B: server sends `CursorOffered`, client accepts with `ControlCursor`

4. **Seq‑first Ordering**

   - A: spec declares `seq` authoritative; subject informational
   - B: per‑subject seq hints (advanced)

5. **Credit‑based Flow Control**

   - A: `ControlCredit` windows on pull consumer
   - B: auto‑credit based on buffer + ack latency

6. **Recovery State Machine**

   - A: client‑side timeouts trigger recovery handshake
   - B: server‑side heartbeat loss triggers replay start

7. **Structured Error Channel**
   - A: emit `ControlError` with `seq` and reason
   - B: encode error items as `DataMessage` with `_tag: 'Error'`
