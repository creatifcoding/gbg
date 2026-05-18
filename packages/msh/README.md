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
| `MshJwtService` | NATS JWT construction: operator/account/user JWTs, NKeys, `.creds` |

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

## JWT Construction

`MshJwtService` wraps `@nats-io/jwt` for NATS-native decentralized auth chains.
Secrets are always `Schema.Redacted` / `Redacted.Redacted` values.

```typescript
import {
  MshJwtService,
  OperatorJwtRequest,
  AccountJwtRequest,
  UserJwtRequest,
} from '@tmnl/msh';
import * as Effect from 'effect-v4/Effect';

const program = Effect.gen(function*() {
  const jwt = yield* MshJwtService;

  const operator = yield* jwt.createOperatorKeyPair;
  const account = yield* jwt.createAccountKeyPair;
  const user = yield* jwt.createUserKeyPair;

  const operatorJwt = yield* jwt.encodeOperator(new OperatorJwtRequest({
    name: 'TMNL Operator',
    operator,
  }));

  const accountJwt = yield* jwt.encodeAccount(new AccountJwtRequest({
    name: 'TMNL Account',
    account,
    signer: operator,
  }));

  const userJwt = yield* jwt.encodeUser(new UserJwtRequest({
    name: 'TMNL User',
    user,
    issuer: account,
    permissions: {
      pub: { allow: ['tmnl.>'] },
      sub: { allow: ['tmnl.>'] },
    },
  }));

  const creds = yield* jwt.formatCreds(userJwt, user);

  // Or directly issue auth modes consumable by MshAuthService:
  const jwtAuth = yield* jwt.issueJwtAuth(new UserJwtRequest({
    name: 'TMNL User',
    user,
    issuer: account,
  }));

  return { operatorJwt, accountJwt, userJwt, creds, jwtAuth };
});

Effect.runPromise(program.pipe(Effect.provide(MshJwtService.layer)));
```

Note: `@nats-io/jwt` documents that the JavaScript package builds JWTs but does
not exhaustively validate server acceptance. Final validation remains with
`nats-server`/`nsc`/the Go JWT library.

## Composition roadmap

- [`docs/pct-lnk-composition-rfc.md`](./docs/pct-lnk-composition-rfc.md) defines how `@tmnl/pct` and `@tmnl/lnk` layer over `@tmnl/msh` without leaking protocol/domain semantics into the mesh substrate.
- [`docs/consumer-migration-inventory.md`](./docs/consumer-migration-inventory.md) tracks remaining legacy Holonet consumers and the strict no-v3/v4-bridge migration guardrail.

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
