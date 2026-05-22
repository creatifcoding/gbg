# MshBridgeWire / NatsBridgeWire Port Contract

Status: concrete MSH-backed bridge available. `MshBridgeWire` is the public name for the production bridge backed by `@tmnl/msh`; `NatsBridgeWire` remains the compatibility name on the existing `nats-bridge` subpath. `NatsBridgeWire.layer(...)` intentionally stays guarded with explicit 501 failures, while `MshBridgeWire.layer(...)` composes the live MSH connection, KV, JetStream, CAS metadata store, batch publisher, shard guard, and Wire adapter.

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

## Port and CAS shape

The compatibility port seam is `src/services/wire/nats-bridge/Port.ts`; public aliases live in `MshBridgePort.ts`:

- `MshBridgePort.create`
- `MshBridgePort.append`
- `MshBridgePort.read`
- `MshBridgePort.metadata`
- `MshBridgePort.delete`

The CAS foundation is split into small LNK-owned modules:

- `kernel.ts` — schema-backed metadata, MSH offset codec, DurableBatch envelope, create/append planners.
- `CasMetadataStore.ts` — abstract revisioned metadata store; concrete MSH adapter should use typed `NatsKVService.getEntry/create/updateIfRevision/deleteIfRevision`.
- `BatchPublisher.ts` — abstract JetStream publisher using `msgID` + `expectedLastSubjectSequence`.
- `ShardGuard.ts` — local same-shard serialization for CAS attempts.
- `CasAppend.ts` — bounded CAS append loop: load metadata → plan → publish envelope → update metadata by revision → retry conflicts.

The public `NatsBridgeWire.layer(...)` still provides explicit `FetchError(status: 501)` failures. `NatsBridgeWire.layerFromPort(...)` / `MshBridgeWire.layerFromPort(...)` map real Wire operations through the provided port. `MshBridgeWire.layerFromMshServices(...)` is available when the host already provides `NatsKVService` and `NatsStreamService`; `MshBridgeWire.layer(...)` is the fully composed live layer.

## C-lite intent cleanup

Bridge optionality is centralized at the Wire/Port boundary instead of being scattered through append hot paths:

- `intents.ts` defines schema-backed append intents: `AppendMessages`, `AppendAndClose`, and `CloseStream`.
- `makeAppendIntent(...)` classifies command intent once, including optional producer and stream sequence metadata.
- `toDurableAppendInput(...)` converts `OptionFromOptionalKey` fields to exact durable append inputs without leaking `undefined` keys.
- `toDurableCreateInput(...)` performs the same exact-optional normalization for create metadata.
- `MshBridgePortLive.read` models live waiting as tagged state data (`Readable` / `Waiting`) and separates LNK live wait duration from the NATS pull fetch expiration floor.

This keeps the CAS kernel focused on Durable Streams rules and keeps MSH as substrate plumbing only.

## Default namespace proposal

- JetStream subjects: `_tmnl.lnk.stream.<stream-id>`
- Stream names: `TMNL_LNK_<safe-stream-id>` or grouped by prefix
- Metadata bucket: `TMNL_LNK_META`
- Consumer prefix: `tmnl-lnk`

## PCT configuration and migration

`@tmnl/pct` now treats `msh-bridge` as the canonical configured backend for LNK routes:

```json
{
  "lnk": {
    "backend": "msh-bridge",
    "msh": {
      "servers": "ws://localhost:9222",
      "subjectRoot": "_tmnl.lnk.stream",
      "metadataBucket": "TMNL_LNK_META",
      "streamNamePrefix": "TMNL_LNK",
      "consumerNamePrefix": "tmnl-lnk",
      "shardCount": 32
    }
  }
}
```

Environment equivalents use `PCT_LNK_MSH_*`, for example:

```bash
PCT_LNK_BACKEND=msh-bridge
PCT_LNK_MSH_SERVERS=ws://localhost:9222
PCT_LNK_MSH_SUBJECT_ROOT=_tmnl.lnk.stream
PCT_LNK_MSH_METADATA_BUCKET=TMNL_LNK_META
PCT_LNK_MSH_SHARD_COUNT=32
```

Migration notes:

1. Prefer `lnk.backend = "msh-bridge"` for new deployments.
2. `lnk.backend = "nats-bridge"` remains accepted as a legacy alias in PCT and maps to the concrete `MshBridgeWire.layer(...)`.
3. Existing `lnk.nats.{subjectRoot,streamNamePrefix,metadataBucket,consumerNamePrefix}` keys remain a legacy alias. New config should use `lnk.msh.*`; when both are present, `lnk.msh.*` wins.
4. `NatsBridgeWire.layer(...)` itself is still guarded. Host applications that want the real bridge should select `MshBridgeWire.layer(...)` (or PCT `msh-bridge`).
5. Live reads use LNK timeout semantics independently from the NATS pull `expires` guardrail; do not lower NATS fetch expiry below the substrate floor.
