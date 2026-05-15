# @tmnl/msh

NATS Effect services for TMNL — Effect v4.

## What

MSH provides typed, observable NATS services with Schema-validated messages, automatic tracing, and invariant-backed authentication.

## Services

| Service | What |
|---|---|
| `NatsConnectionService` | Scoped connection lifecycle with acquireRelease |
| `NatsInnerService` | Low-level NATS ops (pub/sub, KV, streams, consumers, object store) |
| `NatsCodecService` | Stream-native encode/decode with Schema transforms |
| `NatsHubService` | Connection sharing via local PubSub fan-out |
| `NatsPubSubService` | High-level typed pub/sub with Schema codecs |
| `NatsKVService` | KV with Schema codecs, watch, list, history |
| `NatsStreamService` | JetStream publish/subscribe with typed messages |
| `NatsMicroService` | NATS microservices (add, stop, client) |
| `NatsServiceDiscoveryService` | Service discovery (ping, info, stats) |
| `SubjectRegistry` | Runtime subject registration + catalog introspection |
| `MshStreamProcessor` | Durable streaming with consumer-based offset tracking |
| `MshAuthService` | NKey/JWT/Creds/Token auth with token rotation |

## Usage

```typescript
import { Msh } from '@tmnl/msh';
import * as Effect from 'effect-v4/Effect';
import * as Schema from 'effect-v4/Schema';

const MyEvent = Schema.Struct({ id: Schema.String, value: Schema.Number });

const program = Effect.gen(function*() {
  const pubsub = yield* Msh.PubSub;
  yield* pubsub.publish('events.test', MyEvent, { id: '1', value: 42 });
});

Effect.runPromise(program.pipe(Effect.provide(Msh.PubSubLive)));
```

## Auth

```typescript
import { MshConfigCustom, NKeyAuth } from '@tmnl/msh';
import * as Redacted from 'effect-v4/Redacted';

const config = MshConfigCustom({
  servers: 'wss://nats.example.com',
  auth: new NKeyAuth({
    seed: Redacted.make(process.env.NATS_NKEY_SEED!),
    publicKey: 'UABC...',
  }),
});
```

## Tracing

All service methods are traced via `Effect.fn` / `Effect.withSpan` with structured span names:

```
msh.connection.connect
msh.pubsub.publish
msh.kv.get
msh.stream.subscribe
msh.auth.authenticate
```

Import `MshSpan` for type-checked span name constants.

## Auth Invariants

| ID | Invariant |
|---|---|
| I1 | Secret Confinement — `Schema.Redacted` on all seeds/tokens |
| I2 | Trust Chain Monotonicity — authority attenuates only |
| I3 | Temporal Validity — rotation before expiry |
| I4 | Challenge Freshness — unique per connection |
| I5 | State Completeness — 8-state FSM, no implicit transitions |
| I6 | Failure Isolation — per-connection/account |
| I7 | Credential Provenance — `CredsFile`/`CredsEnv`/`CredsInline` |
| I8 | Graceful Degradation — fail closed, structured errors |
| I9 | Observability Without Leakage — spans redact secrets |

## Effect v4

Uses `effect-v4` npm alias (`npm:effect@4.0.0-beta.59`). Import from `effect-v4/Effect`, `effect-v4/Schema`, etc.
