# Effect RPC, Entity & Workflow Patterns

> **Source**: `.edin/EFFECT_RPC_ENTITY_WORKFLOW.md`
> **Last consolidated**: 2026-02-09

## Overview

Verified research framework for Effect RPC, Entity, and Workflow patterns used in TMNL's IIoT architecture. All core APIs verified against the Effect submodule source code. Covers `@effect/rpc`, `@effect/cluster`, and `@effect/workflow`.

---

## 1. RPC Definition Patterns

### Basic RPC Definition [VERIFIED]

```typescript
import { Rpc, RpcGroup } from '@effect/rpc'
import { Schema } from 'effect'

class User extends Schema.Class<User>('User')({
  id: Schema.String,
  name: Schema.String
}) {}

class UserNotFound extends Schema.TaggedError<UserNotFound>('UserNotFound')(
  'UserNotFound',
  { id: Schema.String }
) {}

const GetUserById = Rpc.make('GetUserById', {
  payload: { id: Schema.String },
  success: User,
  error: UserNotFound
})

const UsersRpcs = RpcGroup.make(GetUserById)
```

### Streaming RPC [VERIFIED]

```typescript
// Option 1: Rpc.make with stream: true
const StreamUsers = Rpc.make('StreamUsers', {
  payload: { query: Schema.String },
  success: User,
  stream: true  // Enables streaming response via Mailbox
})

// Option 2: TaggedRequest with RpcSchema.Stream (more control)
class StreamUsers extends Schema.TaggedRequest<StreamUsers>()('StreamUsers', {
  success: RpcSchema.Stream({
    success: User,
    failure: Schema.Never
  }),
  failure: Schema.Never,
  payload: { id: Schema.String }
}) {}
```

**Key insight**: When `stream: true`, the success schema is wrapped internally as `RpcSchema.Stream<Success, Error>`. Handler returns `Mailbox<T>` which client receives as `Stream<T>`.

---

## 2. Entity Patterns

### Entity Definition [VERIFIED]

```typescript
import { Entity, Rpc } from '@effect/cluster'
import { Schema } from 'effect'

const Counter = Entity.make('Counter', [
  Rpc.make('Increment', {
    payload: { amount: Schema.Number },
    primaryKey: ({ amount }) => 'counter',  // Entity ID derivation
    success: Schema.Number
  }),
  Rpc.make('GetValue', {
    payload: Schema.Void,
    success: Schema.Number
  })
])
```

**Key insight**: Entities are distributed via consistent hashing. Each entity instance is keyed by `primaryKey`. The `primaryKey` is per-RPC, not per-entity.

### Entity Implementation [VERIFIED]

```typescript
const CounterLive = Counter.toLayer(Effect.gen(function* () {
  return Counter.of({
    Increment: ({ payload }) => Effect.succeed(payload.amount + 1),
    GetValue: () => Effect.succeed(42)
  })
}))
```

---

## 3. Workflow Patterns

### Workflow Definition [VERIFIED]

```typescript
import { Workflow, Activity } from '@effect/workflow'

class SendEmailError extends Schema.TaggedError<SendEmailError>('SendEmailError')(
  'SendEmailError',
  { message: Schema.String }
) {}

const EmailWorkflow = Workflow.make({
  name: 'EmailWorkflow',
  payload: { id: Schema.String, to: Schema.String },
  success: Schema.Void,
  error: SendEmailError,
  idempotencyKey: ({ id }) => id,  // REQUIRED
})
```

### Workflow with Activities [VERIFIED]

```typescript
const EmailWorkflowLive = EmailWorkflow.toLayer(
  Effect.fn(function* (payload) {
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => console.log('cleanup'))
    )

    yield* Activity.make({
      name: 'SendEmail',
      error: SendEmailError,
      execute: Effect.gen(function* () {
        const attempt = yield* Activity.CurrentAttempt  // 1-indexed
        if (attempt < 5) {
          return yield* new SendEmailError({ message: `Attempt ${attempt} failed` })
        }
      })
    }).pipe(
      EmailWorkflow.withCompensation(Effect.fnUntraced(function* () {
        console.log('Rolling back...')
      })),
      Activity.retry({ times: 5 })
    )

    yield* DurableClock.sleep({
      name: 'WaitForApproval',
      duration: '10 seconds',
    })
  })
)
```

### Workflow Composition [VERIFIED]

```typescript
// Parent calls child via Workflow.execute()
const ParentWorkflowLayer = ParentWorkflow.toLayer(
  Effect.fnUntraced(function* ({ id }) {
    yield* ChildWorkflow.execute({ id })  // Nested workflow call
  })
)

// External signals via DurableDeferred
const ChildDeferred = DurableDeferred.make('ChildDeferred')
const ChildWorkflowLayer = ChildWorkflow.toLayer(
  Effect.fnUntraced(function* () {
    const token = yield* DurableDeferred.token(ChildDeferred)
    yield* DurableDeferred.await(ChildDeferred)  // Suspends until signal
  })
)

// Resume from outside
yield* DurableDeferred.done(ChildDeferred, { token, exit: Exit.succeed('done') })
```

---

## 4. Proxy Derivation

| Source | Proxy | Result |
|--------|-------|--------|
| Entity | `EntityProxy.toRpcGroup(Counter)` | RPC group with entityId injection + Discard variants |
| Entity | `EntityProxy.toHttpApiGroup('counter', Counter)` | REST endpoints: POST /counter/increment/:entityId |
| Workflow | `WorkflowProxy.toRpcGroup(workflows)` | Execute, Discard, Resume RPCs |
| Workflow | `WorkflowProxy.toHttpApiGroup('workflows', workflows)` | REST endpoints in kebab-case |

### Entity to RpcGroup [VERIFIED]

```typescript
import { EntityProxy } from '@effect/cluster'

const CounterRpcs = EntityProxy.toRpcGroup(Counter)
// Creates: Counter.Increment, Counter.IncrementDiscard, etc.
// Each RPC gets { entityId: string, payload: OriginalPayload }
```

### Workflow to RpcGroup [VERIFIED]

```typescript
class MyRpcs extends WorkflowProxy.toRpcGroup(myWorkflows) {}
// Creates: EmailWorkflow (execute), EmailWorkflowDiscard, EmailWorkflowResume

const RpcApiLayer = RpcServer.layer(MyRpcs).pipe(
  Layer.provide(WorkflowProxyServer.layerRpcHandlers(myWorkflows))
)
```

---

## 5. Streaming & WebSocket Transport

### Transport Comparison [VERIFIED]

| Transport | Streaming | Backpressure |
|-----------|-----------|--------------|
| HTTP | No | N/A |
| WebSocket | Yes | Yes (with ack) |
| TCP | Yes | Yes (with ack) |
| Worker | Yes | Yes |

### WebSocket Server [VERIFIED]

```typescript
import { RpcServer, RpcSerialization } from '@effect/rpc'
import { HttpRouter } from '@effect/platform'

const HttpWsServer = HttpRouter.Default.serve().pipe(
  Layer.provide(RpcLive),
  Layer.provideMerge(RpcServer.layerProtocolWebsocket({ path: '/rpc' }))
)
```

### Serialization Options [VERIFIED]

| Layer | Format | Use Case |
|-------|--------|----------|
| `RpcSerialization.layerJson` | Plain JSON | Browser compat |
| `RpcSerialization.layerMsgPack` | MessagePack | Binary, efficient |
| `RpcSerialization.layerNdjson` | NDJSON | Streamable, human-readable |

### Streaming Handler [VERIFIED]

```typescript
// Handler returns Mailbox for streaming
StreamUsers: Effect.fnUntraced(function*(req, _) {
  const mailbox = yield* Mailbox.make<User>(0)  // 0 = unbounded

  yield* Effect.addFinalizer(() =>
    Effect.sync(() => { /* cleanup on disconnect */ })
  )

  yield* mailbox.offer(new User({ id: req.id, name: 'John' })).pipe(
    Effect.delay(100),
    Effect.forever,
    Effect.forkScoped
  )

  return mailbox  // Client receives as Stream
})
```

---

## 6. Middleware Patterns [VERIFIED]

### Auth Middleware (provides context)

```typescript
class AuthMiddleware extends RpcMiddleware.Tag<AuthMiddleware>()('AuthMiddleware', {
  provides: CurrentUser,
  failure: Unauthorized,
  requiredForClient: true
}) {}

// Server
const AuthLive = Layer.succeed(
  AuthMiddleware,
  AuthMiddleware.of((options) =>
    Effect.gen(function*() {
      const userId = options.headers.userid
      if (!userId) return yield* new Unauthorized({})
      return new User({ id: userId, name: 'Authenticated' })
    })
  )
)

// Client
const AuthClient = RpcMiddleware.layerClient(AuthMiddleware, ({ request }) =>
  Effect.succeed({
    ...request,
    headers: Headers.set(request.headers, 'name', 'Logged in user')
  })
)
```

### Wrap Middleware (intercepts handler)

```typescript
class TimingMiddleware extends RpcMiddleware.Tag<TimingMiddleware>()('TimingMiddleware', {
  wrap: true
}) {}

const TimingLive = Layer.succeed(
  TimingMiddleware,
  TimingMiddleware.of((options) =>
    options.next.pipe(
      Effect.tap(() => Metric.increment(rpcSuccesses)),
      Effect.ensuring(Metric.increment(rpcCount))
    )
  )
)
```

### Per-RPC Middleware

```typescript
const TimedMethod = Rpc.make('TimedMethod', {
  payload: { shouldFail: Schema.Boolean },
  success: Schema.Number
}).middleware(TimingMiddleware)  // Only this RPC
```

---

## 7. Full Transport Stack [VERIFIED]

```typescript
// === SERVER ===
const RpcLive = RpcServer.layer(UserRpcs).pipe(
  Layer.provide([UsersLive, AuthLive])
)

const HttpWsServer = HttpRouter.Default.serve().pipe(
  Layer.provide(RpcLive),
  Layer.provideMerge(RpcServer.layerProtocolWebsocket({ path: '/rpc' }))
)

const ServerStack = HttpWsServer.pipe(
  Layer.provide([
    NodeHttpServer.layerTest,
    RpcSerialization.layerMsgPack
  ])
)

// === CLIENT ===
const ClientStack = UsersClient.layer.pipe(
  Layer.provide(RpcClient.layerProtocolSocket()),
  Layer.provide(
    Effect.gen(function*() {
      const server = yield* HttpServer.HttpServer
      const address = server.address as HttpServer.TcpAddress
      return NodeSocket.layerWebSocket(`http://127.0.0.1:${address.port}/rpc`)
    }).pipe(Layer.unwrapEffect)
  ),
  Layer.provide(RpcSerialization.layerMsgPack)
)

// === E2E ===
const E2ELayer = ClientStack.pipe(Layer.provideMerge(ServerStack))
```

---

## Agent Quick Reference

### Key Imports

```typescript
import { Rpc, RpcGroup, RpcServer, RpcClient, RpcSerialization, RpcMiddleware } from '@effect/rpc'
import { Entity, EntityProxy } from '@effect/cluster'
import { Workflow, Activity, WorkflowProxy } from '@effect/workflow'
import { Schema } from 'effect'
```

### Minimal Example

```typescript
// Define RPC
const GetUser = Rpc.make('GetUser', {
  payload: { id: Schema.String },
  success: User,
  error: UserNotFound
})

const UserRpcs = RpcGroup.make(GetUser)

// Implement handler
const UserRpcsLive = UserRpcs.toLayer(Effect.gen(function*() {
  return UserRpcs.of({
    GetUser: (req) => Effect.succeed(new User({ id: req.id, name: 'John' }))
  })
}))
```

### Common Pitfalls

- HTTP transport does NOT support `stream: true` RPCs -- use WebSocket or TCP
- `primaryKey` on Entity RPCs is per-RPC, not per-entity
- Serialization MUST match between client and server
- `RpcTest.makeClient(RpcGroup)` creates nested objects for dotted RPC tags -- use `client.Realtime.SubscribeReadings()` not `client['Realtime.SubscribeReadings']()`
- `Stream.unwrap()` needed to bridge `Effect<Stream<A>>` to `Stream<A>` for RpcGroup.toLayer
- `Effect.scoped` must precede `Effect.provide` when using `RpcTest.makeClient`

### Cross-References

- [entities.md](./entities.md) -- TMNL entity architecture with Machine actors
- [effect-services.md](./effect-services.md) -- Layer construction patterns
- [effect-testing.md](./effect-testing.md) -- testing RPC handlers
- [effect-errors.md](./effect-errors.md) -- error handling in handlers
