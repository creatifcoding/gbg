# @tmnl/msh Agent Notes

MSH is the transport/auth infrastructure package for TMNL. It is intentionally boring in the best possible way: typed NATS services, Effect v4 Layers, Schema-backed errors, and no domain policy.

## Package Boundary

**Owns:**
- NATS connection lifecycle
- NATS auth primitives: NKey, JWT, creds, token
- NATS JWT construction wrappers around `@nats-io/jwt`
- NATS pub/sub, request/reply, KV, JetStream, micro, discovery
- Subject registry mechanics
- Stream processor infrastructure
- Structured tracing names (`MshSpan`)

**Does not own:**
- Domain subject conventions (`@tmnl/dmn` future home)
- Protocol compatibility and schema evolution rules (`@tmnl/pct` future/home)
- Link topology, routing policy, circuit breakers (`@tmnl/lnk` future/home)
- Application HTTP auth, Phoenix channels, durable-streams API clients

Prime, let's not turn the transport package into a cathedral of domain opinions. MSH moves bytes with contracts; higher layers decide what the bytes mean.

## Effect v4 Discipline

Use the project alias imports:

```ts
import * as Effect from 'effect-v4/Effect';
import * as Schema from 'effect-v4/Schema';
import * as Layer from 'effect-v4/Layer';
```

Patterns currently used:

- Services: `Context.Service<>()(...){ static readonly layer = ... }`
- Errors: `Schema.TaggedErrorClass`
- Data: `Schema.TaggedClass` / `Schema.Struct` / `Schema.Literals`
- Secrets: `Schema.Redacted(...)` + `effect-v4/Redacted`
- Method tracing: `Effect.fn(MshSpan.X.y)(function*(...) { ... })`
- Hot codec paths: `Effect.fnUntraced(...)`
- Fallback/error capture: `Effect.result` returns `{ _tag: 'Failure', failure }`, not an Exit cause

## Service Graph

Approximate dependency flow:

```text
MshConfigTag
  ├─ MshAuthService ──► nats.ws Authenticator
  └─ NatsConnectionService ──► nc/js/jsm
       └─ NatsInnerService
            ├─ NatsHubService
            │    └─ NatsPubSubService
            ├─ NatsKVService
            ├─ NatsStreamService
            ├─ NatsMicroService
            └─ NatsServiceDiscoveryService

MshJwtService is independent. It produces JWTs, .creds bytes, and auth modes.
SubjectRegistry is independent. It catalogs subject specs.
```

## Auth Invariants

These are acceptance criteria, not decorative Latin:

| ID | Invariant | Implementation hook |
|---|---|---|
| I1 | Secret Confinement | Seeds/tokens are Redacted |
| I2 | Trust Chain Monotonicity | Operator → Account → User only attenuates authority |
| I3 | Temporal Validity | JWT expiry + rotation helpers |
| I4 | Challenge Freshness | nats.ws NKey/JWT authenticators sign server nonce |
| I5 | State Completeness | 8-state auth FSM in `auth/service.ts` |
| I6 | Failure Isolation | Structured errors, per-service failure boundaries |
| I7 | Credential Provenance | `CredsFile`, `CredsEnv`, `CredsInline` |
| I8 | Graceful Degradation | Fail closed with typed errors |
| I9 | Observability Without Leakage | Span metadata must never include secrets |

## JWT Construction

`src/auth/jwt.ts` wraps `@nats-io/jwt`.

Important source-grounded note: the upstream JS package states it builds NATS JWTs but does not exhaustively validate server acceptance. Final validation belongs to `nats-server`, `nsc`, or the Go JWT library.

Core service methods:

- `createOperatorKeyPair`
- `createAccountKeyPair`
- `createUserKeyPair`
- `createServerKeyPair`
- `keyPairFromSeed`
- `encodeOperator`
- `encodeAccount`
- `encodeUser`
- `encodeActivation`
- `decode`
- `formatCreds`
- `parseCreds`
- `issueJwtAuth`
- `issueCredsAuth`

Do not log seeds. Do not stringify Redacted values for debugging. No, not even “temporarily.” That is how secrets become archaeology.

## Testing

Run from `packages/msh`:

```bash
bunx tsc --noEmit
bunx vitest run
bunx tsc
```

Current test suites:

- `test/errors.test.ts`
- `test/codec.test.ts`
- `test/subject-registry.test.ts`
- `test/auth.test.ts`
- `test/jwt.test.ts`

No live NATS server is required for current tests. Service-level live/mocked NATS tests are tracked separately in the task plan.

## Git / Package Manager Discipline

- Use `bun`, `bun run`, `bunx` only.
- Do not use `npm`, `npx`, `yarn`, or `pnpm`.
- Do not use `git add -A` or `git add .`.
- Stage explicit paths only.

## Public Imports

Package subpaths are exported:

```ts
import { MshJwtService } from '@tmnl/msh/auth';
import { NatsPubSubService } from '@tmnl/msh/nats';
import { SubjectRegistry } from '@tmnl/msh/subject';
import { MshSpan } from '@tmnl/msh/tracing';
```

Root import remains supported:

```ts
import { Msh, MshJwtService } from '@tmnl/msh';
```
