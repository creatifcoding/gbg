# Holonet Research Rounds

## Agent Frontmatter

- **Audience**: Agents + maintainers
- **Reading Order**: Round 1 → Round 3 → Mapping
- **High‑Signal**: Durability + Flow control
- **Related**: `docs/HOLONET_DUPLEX_SPEC.md`, `docs/HOLONET_EDGE_CASES.md`

## Pass 5 — Research Rounds (Theory → Stack) [IDX:holonet.research]

### Round 1 — Durability & Ordering

- JetStream consumer semantics + ack policies: https://docs.nats.io/nats-concepts/jetstream/consumers
- Consumer configuration details: https://docs.nats.io/using-nats/developer/develop_jetstream/consumers

### Round 2 — Flow Control / Backpressure

- `max_ack_pending`, `ack_wait`, pull vs push (NATS docs)
- Use pull consumer to model **credit windows**; push for latency when safe

### Round 3 — Resume / Recovery

- SSE `Last-Event-ID` resume semantics: https://html.spec.whatwg.org/dev/server-sent-events.html
- Error handling + reconnect strategy: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#error_handling

## Mapping to Holonet

- **Durable‑Streams SSE**: add `Last-Event-ID` support and cursor resume to `LiveStreamService` semantics.
- **Duplex WS**: control plane handles ack/nack + flow control; data plane via JetStream consumer.
- **NATS WS direct**: reserved for high‑capability clients; Durable‑Streams remains compatibility.

## Research Outcomes (v1)

- SSE is **one‑way**, so duplex requires a second channel.
- JetStream provides durability + replay + flow control, but must be surfaced explicitly in API.
- Pull consumers align with credit-based flow control for robust duplex.
