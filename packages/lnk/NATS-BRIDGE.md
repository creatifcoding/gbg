# NatsBridgeWire Port Contract

Status: foundation skeleton. The exported package surface exists; the live MSH-backed implementation is intentionally guarded until the JetStream/KV translation is complete.

## Legacy inventory

Legacy Holonet durable-streams v1 provided three relevant surfaces:

- `StreamBridgeService`: create, append, read, metadata, delete.
- `ConsumerStateService`: durable consumer naming, creation, and offset state.
- `LiveStreamService`: long-poll/SSE behavior above bridge reads.
- `integration/spike/nats-stream-bridge.ts`: JsMsg → Effect.Stream decoding with schema-aware ack/nak behavior.

## Boundary rule

`@tmnl/lnk` owns Durable Streams semantics:

- opaque lexicographic offsets;
- content-type framing;
- producer idempotency and fencing;
- stream closed/config mismatch behavior;
- live/catch-up read semantics.

`@tmnl/msh` remains substrate-only:

- NATS connection/auth;
- JetStream publish/fetch/admin;
- KV metadata storage;
- subject validation/composition;
- infrastructure tracing.

No MSH code should learn LNK domain concepts such as `Stream-Next-Offset`, producer epochs, JSON stream framing, or close semantics.

## Port shape

The canonical type-level seam is `src/services/wire/nats-bridge/Port.ts`:

- `NatsBridgePort.create`
- `NatsBridgePort.append`
- `NatsBridgePort.read`
- `NatsBridgePort.metadata`
- `NatsBridgePort.delete`

The public `NatsBridgeWire.layer(...)` currently provides `Wire` with explicit `FetchError(status: 501)` failures. Future implementation should replace the guarded methods with calls through `NatsBridgePort`, then provide a concrete MSH-backed port layer.

## Default namespace proposal

- JetStream subjects: `_tmnl.lnk.stream.<stream-id>`
- Stream names: `TMNL_LNK_<safe-stream-id>` or grouped by prefix
- Metadata bucket: `TMNL_LNK_META`
- Consumer prefix: `tmnl-lnk`

## Implementation notes for the next phase

1. Metadata in KV: content-type, schema-id, closed flag, tail offset/sequence, producer fencing state.
2. Messages in JetStream: one subject namespace per configured root.
3. Offset translation stays in LNK. JetStream sequence numbers are an implementation detail.
4. Producer dedupe may use JetStream `msgID`; producer fencing still needs KV state.
5. Live read should be implemented above the same `Wire.get` semantics, not as a separate app-facing protocol.
