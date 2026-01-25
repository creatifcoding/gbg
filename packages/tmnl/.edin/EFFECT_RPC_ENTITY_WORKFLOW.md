# Effect RPC, Entity & Workflow Patterns — Research Framework

**Research Date**: 2026-01-24
**Sources**: DeepWiki queries (Effect-TS/effect), submodule verification complete
**Status**: PRIORITY 1 COMPLETE — Core APIs verified via submodule; Priority 2-3 integration patterns pending

---

## Verification Legend

| Marker | Meaning |
|--------|---------|
| `[VERIFIED]` | Cross-referenced with submodule code/tests |
| `[DEEPWIKI]` | Sourced from DeepWiki, awaiting submodule verification |
| `[HYPOTHESIS]` | Inferred from patterns, needs primary source |
| `[TODO]` | Research not yet conducted |

---

## Table of Contents

1. [RPC Definition Patterns](#1-rpc-definition-patterns)
2. [Entity Patterns](#2-entity-patterns)
3. [Workflow Patterns](#3-workflow-patterns)
4. [Proxy Derivation](#4-proxy-derivation)
5. [Streaming & WebSocket Transport](#5-streaming--websocket-transport)
6. [Layer Composition](#6-layer-composition)
7. [Research Agenda](#7-research-agenda)

---

## 1. RPC Definition Patterns

### 1.1 Basic RPC Definition `[VERIFIED]`

**Source**: `submodules/effect/packages/rpc/src/Rpc.ts:635-684`

```typescript
import { Rpc, RpcGroup } from '@effect/rpc'
import { Schema } from 'effect'

// Define schemas for payload, success, and errors
class User extends Schema.Class<User>('User')({
  id: Schema.String,
  name: Schema.String
}) {}

class UserNotFound extends Schema.TaggedError<UserNotFound>('UserNotFound')(
  'UserNotFound',
  { id: Schema.String }
) {}

// Define RPC with typed schemas
const GetUserById = Rpc.make('GetUserById', {
  payload: { id: Schema.String },
  success: User,
  error: UserNotFound
})

// Group RPCs
const UsersRpcs = RpcGroup.make(GetUserById, /* ...more rpcs */)
```

**Verified details** (from submodule):
- [x] `Rpc.make<Tag, Payload, Success, Error, Stream>` signature confirmed
- [x] `primaryKey` creates a Schema.Class with `PrimaryKey.symbol`
- [x] `stream: true` wraps success in `RpcSchema.Stream<Success, Error>`
- [ ] Check `RpcGroup.make` composition patterns

### 1.2 Streaming RPC `[VERIFIED]`

**Source**: `submodules/effect/packages/platform-node/test/fixtures/rpc-schemas.ts:17-26`

```typescript
// Option 1: Rpc.make with stream: true
const StreamUsers = Rpc.make('StreamUsers', {
  payload: { query: Schema.String },
  success: User,
  stream: true  // ← Enables streaming response
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

**Key insight**: When `stream: true`, the success schema is wrapped internally as `RpcSchema.Stream<Success, Error>`.

**Verified details** (from submodule):
- [x] `stream: true` wraps success in `RpcSchema.Stream<Success, Error>` internally
- [x] `RpcSchema.Stream({ success, failure })` — explicit wrapper for TaggedRequest
- [x] Handler returns `Mailbox<T>` → client receives as `Stream<T>`
- [x] Backpressure via `Mailbox.make<T>(capacity)` — `0` unbounded, `N` bounded
- [x] WebSocket/TCP required — HTTP does NOT support streaming

---

## 2. Entity Patterns

### 2.1 Entity Definition `[VERIFIED]`

**Source**: `submodules/effect/packages/cluster/src/Entity.ts:390-400`

```typescript
import { Entity, Rpc } from '@effect/cluster'
import { Schema } from 'effect'

// Entity groups RPCs into a protocol
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

**Key insight**: Entities are distributed via consistent hashing. Each entity instance is keyed by `primaryKey`.

**Verified details** (from submodule):
- [x] `Entity.make<Type, Rpcs[]>(type, protocol)` signature confirmed
- [x] Internally calls `RpcGroup.make(...protocol)`
- [x] `primaryKey` is per-RPC, not per-entity
- [ ] Confirm entity lifecycle (creation, idle timeout, eviction)

### 2.2 Entity Implementation `[DEEPWIKI]`

**Source**: `packages/cluster/src/Entity.ts:239-273`

```typescript
// Implement handlers as a Layer
const CounterLive = Counter.toLayer({
  Increment: ({ payload }) =>
    Effect.gen(function* () {
      // Access entity state, external services, etc.
      return payload.amount + 1
    }),
  GetValue: () =>
    Effect.succeed(42)
})
```

**Research needed**:
- [ ] Verify `toLayer` handler signature
- [ ] Check how entity state is managed (Ref? Atom? External?)
- [ ] Confirm error handling in handlers

---

## 3. Workflow Patterns

### 3.1 Workflow Definition `[VERIFIED]`

**Source**: `submodules/effect/packages/workflow/src/Workflow.ts:263-313`

```typescript
import { Workflow, Activity } from '@effect/workflow'
import { Schema } from 'effect'

// Error schema using TaggedError pattern
class SendEmailError extends Schema.TaggedError<SendEmailError>('SendEmailError')(
  'SendEmailError',
  { message: Schema.String }
) {}

const EmailWorkflow = Workflow.make({
  name: 'EmailWorkflow',
  payload: {
    id: Schema.String,
    to: Schema.String
  },
  success: Schema.Void,              // Optional, defaults to Schema.Void
  error: SendEmailError,             // Optional, defaults to Schema.Never
  idempotencyKey: ({ id }) => id,    // REQUIRED - deduplication key
  suspendedRetrySchedule: undefined, // Optional Schedule for suspended retry
  annotations: undefined             // Optional Context<never>
})
```

**Verified details** (from submodule):
- [x] `name` — unique workflow identifier (string)
- [x] `payload` — can be `Schema.Struct.Fields` or `AnyStructSchema`
- [x] `idempotencyKey` — REQUIRED function `(payload) => string`
- [x] `success` — defaults to `Schema.Void` if not provided
- [x] `error` — defaults to `Schema.Never` if not provided
- [x] `executionId` is derived from `hash(name + idempotencyKey(payload))`
- [x] Deduplication: same `idempotencyKey` returns cached result

### 3.2 Workflow Implementation with Activities `[VERIFIED]`

**Source**: `submodules/effect/packages/cluster/test/ClusterWorkflowEngine.test.ts:287-327`

```typescript
// toLayer signature: (payload, executionId?) => Effect<Success, Error, R>
const EmailWorkflowLive = EmailWorkflow.toLayer(
  Effect.fn(function* (payload) {
    // Finalizers run even after suspension
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => console.log('cleanup'))
    )

    // Activity.make — durable checkpoint (survives restarts)
    yield* Activity.make({
      name: 'SendEmail',
      error: SendEmailError,
      success: Schema.Void,        // Optional, defaults to Schema.Void
      execute: Effect.gen(function* () {
        const attempt = yield* Activity.CurrentAttempt  // 1-indexed attempt number
        if (attempt < 5) {
          return yield* new SendEmailError({ message: `Attempt ${attempt} failed` })
        }
      })
    }).pipe(
      // Compensation runs on workflow failure (not suspension)
      EmailWorkflow.withCompensation(Effect.fnUntraced(function* () {
        console.log('Rolling back...')
      })),
      // Retry transient failures
      Activity.retry({ times: 5 })
    )

    // DurableClock.sleep — suspends workflow, resumes after duration
    yield* DurableClock.sleep({
      name: 'WaitForApproval',
      duration: '10 seconds',
      inMemoryThreshold: Duration.zero  // Force persistence (for testing)
    })

    // Can call other workflows
    yield* OtherWorkflow.execute({ id: payload.id })
  })
)
```

**Verified details** (from submodule tests):
- [x] `toLayer` signature: `(payload, executionId?) => Effect<Success, Error, R>`
- [x] `Activity.make({ name, execute, success?, error? })` — durable checkpoint
- [x] `Activity.CurrentAttempt` — 1-indexed attempt number inside activity
- [x] `Activity.retry({ times: N })` — retry activity N times on failure
- [x] `Activity.raceAll(name, [activities])` — race multiple activities
- [x] `Workflow.withCompensation(effect)` — runs on workflow FAILURE (not suspension)
- [x] `Effect.addFinalizer` — runs on suspension AND completion
- [x] `DurableClock.sleep({ name, duration })` — suspends workflow durably

### 3.3 Workflow Composition `[VERIFIED]`

**Source**: `submodules/effect/packages/cluster/test/ClusterWorkflowEngine.test.ts:461-499`

```typescript
// Parent workflow definition
const ParentWorkflow = Workflow.make({
  name: 'ParentWorkflow',
  payload: { id: Schema.String },
  idempotencyKey: ({ id }) => id
})

// Child workflow definition
const ChildWorkflow = Workflow.make({
  name: 'ChildWorkflow',
  payload: { id: Schema.String },
  idempotencyKey: ({ id }) => id
})

// Parent calls child via Workflow.execute()
const ParentWorkflowLayer = ParentWorkflow.toLayer(
  Effect.fnUntraced(function* ({ id }) {
    const instance = yield* WorkflowInstance  // Access workflow state
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        console.log('suspended?', instance.suspended)
      })
    )
    yield* ChildWorkflow.execute({ id })  // ← Nested workflow call
  })
)

// Child uses DurableDeferred for external signals
const ChildDeferred = DurableDeferred.make('ChildDeferred')
const ChildWorkflowLayer = ChildWorkflow.toLayer(
  Effect.fnUntraced(function* () {
    const token = yield* DurableDeferred.token(ChildDeferred)
    yield* DurableDeferred.await(ChildDeferred)  // Suspends until signal
  })
)

// Resume child from outside via DurableDeferred.done()
yield* DurableDeferred.done(ChildDeferred, { token, exit: Exit.succeed('done') })
```

**Verified details** (from submodule tests):
- [x] `Workflow.execute({ payload })` — call child from parent
- [x] Parent-child interruption IS linked (parent interrupt → child interrupt)
- [x] `WorkflowInstance` — access current workflow state (`.suspended`, `.cause`)
- [x] `DurableDeferred.make(name)` — create named deferred for external signals
- [x] `DurableDeferred.token(deferred)` — get token for external resume
- [x] `DurableDeferred.await(deferred)` — suspend until signal received
- [x] `DurableDeferred.done(deferred, { token, exit })` — signal from outside
- [x] `Workflow.poll(executionId)` — check workflow status without blocking
- [x] `Workflow.interrupt(executionId)` — interrupt running workflow

### 3.4 WorkflowEngine Layer Composition `[VERIFIED]`

**Source**: `submodules/effect/packages/workflow/test/WorkflowEngine.test.ts`, `submodules/effect/packages/cluster/test/ClusterWorkflowEngine.test.ts`

```typescript
import { WorkflowEngine } from '@effect/workflow'
import { ClusterWorkflowEngine, Sharding, MessageStorage } from '@effect/cluster'

// Option 1: In-memory engine (for testing)
const TestLayer = LongWorkflowLayer.pipe(
  Layer.provideMerge(WorkflowEngine.layerMemory)
)

// Option 2: Cluster engine (for production)
const ProductionLayer = Layer.mergeAll(
  EmailWorkflowLayer,
  ChildWorkflowLayer
).pipe(
  Layer.provideMerge(ClusterWorkflowEngine.layer),
  Layer.provideMerge(Sharding.layer),
  Layer.provideMerge(MessageStorage.layerMemory)  // Or SQL storage
)

// Running workflow
yield* EmailWorkflow.execute({ id: 'test-1', to: 'bob@example.com' })

// Fire-and-forget (returns executionId immediately)
const executionId = yield* EmailWorkflow.execute(
  { id: 'test-1', to: 'bob@example.com' },
  { discard: true }
)

// Check status
const status = yield* EmailWorkflow.poll(executionId)
// Returns: Workflow.Complete({ exit }) | Workflow.Suspended | Workflow.Running
```

**Verified details** (from submodule tests):
- [x] `WorkflowEngine.layerMemory` — in-memory engine for testing
- [x] `ClusterWorkflowEngine.layer` — distributed engine for production
- [x] Multiple workflow layers merged with `Layer.mergeAll()`
- [x] `{ discard: true }` option for fire-and-forget execution
- [x] `Workflow.Complete`, `Workflow.Suspended`, `Workflow.Running` — status types

---

## 4. Proxy Derivation

### 4.1 Entity → RpcGroup `[VERIFIED]`

**Source**: `submodules/effect/packages/cluster/src/EntityProxy.ts:47-76`

```typescript
import { EntityProxy } from '@effect/cluster'

// Derive RpcGroup from Entity
const CounterRpcs = EntityProxy.toRpcGroup(Counter)
// Result: RpcGroup with Counter.Increment, Counter.IncrementDiscard, etc.
```

**Key insight**: Each RPC gets an `entityId` parameter injected, plus a `*Discard` variant for fire-and-forget.

**Verified details** (from submodule):
- [x] Creates `{ entityId: string, payload: OriginalPayload }` schema
- [x] RPC tag becomes `${entity.type}.${rpc._tag}` (e.g., `Counter.Increment`)
- [x] Discard variant: `${entity.type}.${rpc._tag}Discard` with no success schema
- [x] Cluster errors added: `MailboxFull`, `AlreadyProcessingMessage`, `PersistenceError`
- [x] Annotations preserved via `.annotateContext()`

### 4.2 Entity → HttpApiGroup `[DEEPWIKI]`

**Source**: `packages/cluster/src/EntityProxy.ts:162-187`

```typescript
import { HttpApi, HttpApiGroup } from '@effect/platform'
import { EntityProxy } from '@effect/cluster'

const api = HttpApi.make('api').add(
  EntityProxy.toHttpApiGroup('counter', Counter)
    .prefix('/counter')
)
// Creates: POST /counter/increment/:entityId, etc.
```

**Research needed**:
- [ ] Verify `toHttpApiGroup` creates POST endpoints
- [ ] Check path structure (`/:entityId` suffix?)
- [ ] Confirm OpenAPI generation compatibility

### 4.3 Workflow → Proxies `[VERIFIED]`

**Source**: `submodules/effect/packages/workflow/src/WorkflowProxy.ts:45-146`

```typescript
import { WorkflowProxy, WorkflowProxyServer } from '@effect/workflow'
import { RpcServer } from '@effect/rpc'
import { HttpApi, HttpApiBuilder } from '@effect/platform'
import { Layer } from 'effect'

// Define workflows
const EmailWorkflow = Workflow.make({
  name: 'EmailWorkflow',
  payload: { id: Schema.String, to: Schema.String },
  idempotencyKey: ({ id }) => id
})

const myWorkflows = [EmailWorkflow] as const

// Option 1: toRpcGroup — creates RpcGroup from workflows
class MyRpcs extends WorkflowProxy.toRpcGroup(myWorkflows) {}
// Creates RPCs:
//   - EmailWorkflow (execute and wait)
//   - EmailWorkflowDiscard (fire-and-forget)
//   - EmailWorkflowResume (resume suspended)

const RpcApiLayer = RpcServer.layer(MyRpcs).pipe(
  Layer.provide(WorkflowProxyServer.layerRpcHandlers(myWorkflows))
)

// Option 2: toHttpApiGroup — creates HttpApiGroup with REST endpoints
class MyApi extends HttpApi.make('api')
  .add(WorkflowProxy.toHttpApiGroup('workflows', myWorkflows))
{}
// Creates endpoints:
//   - POST /email-workflow (execute)
//   - POST /email-workflow/discard (fire-and-forget)
//   - POST /email-workflow/resume (resume)

const HttpApiLayer = HttpApiBuilder.api(MyApi).pipe(
  Layer.provide(WorkflowProxyServer.layerHttpApi(MyApi, 'workflows', myWorkflows))
)
```

**Verified details** (from submodule):
- [x] `toRpcGroup(workflows, { prefix? })` — creates RpcGroup with `Name`, `NameDiscard`, `NameResume` RPCs
- [x] `toHttpApiGroup(name, workflows)` — creates HttpApiGroup with POST endpoints
- [x] Path conversion: `EmailWorkflow` → `/email-workflow` (kebab-case)
- [x] `WorkflowProxyServer.layerRpcHandlers(workflows)` — server handlers for RPC
- [x] `WorkflowProxyServer.layerHttpApi(api, group, workflows)` — server handlers for HTTP
- [x] Annotations preserved via `.annotateContext(workflow.annotations)`

---

## 5. Streaming & WebSocket Transport

### 5.1 WebSocket RPC Server `[VERIFIED]`

**Source**: `submodules/effect/packages/rpc/src/RpcServer.ts:902-911`, `submodules/effect/packages/platform-node/test/RpcServer.test.ts:47-66`

```typescript
import { RpcServer, RpcSerialization } from '@effect/rpc'
import { HttpRouter } from '@effect/platform'
import { NodeHttpServer } from '@effect/platform-node'

// WebSocket server for RPC group
const HttpWsServer = HttpRouter.Default.serve().pipe(
  Layer.provide(RpcLive),  // Your RPC handlers layer
  Layer.provideMerge(RpcServer.layerProtocolWebsocket({ path: '/rpc' }))
)

// Full production stack
const ProductionServer = HttpWsServer.pipe(
  Layer.provide([
    NodeHttpServer.layer({ port: 3000 }),
    RpcSerialization.layerMsgPack  // Or layerNdjson, layerJson
  ])
)
```

**Verified details** (from submodule):
- [x] `layerProtocolWebsocket({ path: PathInput, routerTag?: RouterTag })` signature
- [x] Alternative: `layerProtocolWebsocketRouter({ path })` uses `HttpLayerRouter`
- [x] Serialization via `RpcSerialization.layerX` — chosen by client/server agreement

**Serialization options** (verified from tests):

| Layer | Format | Use Case |
|-------|--------|----------|
| `RpcSerialization.layerNdjson` | NDJSON | Human-readable, streamable |
| `RpcSerialization.layerMsgPack` | MessagePack | Binary, efficient |
| `RpcSerialization.layerJson` | Plain JSON | Simple, no framing |
| `RpcSerialization.layerJsonRpc()` | JSON-RPC | Standard protocol |
| `RpcSerialization.layerNdJsonRpc()` | NDJSON-RPC | JSON-RPC with NDJSON framing |

### 5.2 WebSocket RPC Client `[VERIFIED]`

**Source**: `submodules/effect/packages/rpc/src/RpcClient.ts:1245-1252`, `submodules/effect/packages/platform-node/test/RpcServer.test.ts:51-60`

```typescript
import { RpcClient, RpcSerialization } from '@effect/rpc'
import { NodeSocket } from '@effect/platform-node'
import { HttpServer } from '@effect/platform'

// Client connecting to WebSocket server
const HttpWsClient = UsersClient.layer.pipe(
  Layer.provide(RpcClient.layerProtocolSocket()),  // Socket protocol
  Layer.provide(
    Effect.gen(function*() {
      const server = yield* HttpServer.HttpServer  // For dynamic port
      const address = server.address as HttpServer.TcpAddress
      return NodeSocket.layerWebSocket(`http://127.0.0.1:${address.port}/rpc`)
    }).pipe(Layer.unwrapEffect)
  )
)

// Or with static URL
const StaticClient = UsersClient.layer.pipe(
  Layer.provide(RpcClient.layerProtocolSocket({
    retryTransientErrors: true,  // Auto-retry connection errors
    retrySchedule: Schedule.exponential('100 millis')  // Custom retry schedule
  })),
  Layer.provide(NodeSocket.layerWebSocket('ws://localhost:3000/rpc'))
)
```

**Verified details** (from submodule):
- [x] `layerProtocolSocket(options?)` — WebSocket/TCP client protocol
- [x] `retryTransientErrors` — auto-reconnect on socket errors (default: false)
- [x] `retrySchedule` — custom `Schedule<any, Socket.SocketError>`
- [x] Requires `Socket.Socket` + `RpcSerialization.RpcSerialization` in context

### 5.3 Streaming RPC Definition `[VERIFIED]`

**Source**: `submodules/effect/packages/platform-node/test/fixtures/rpc-schemas.ts:17-26`

```typescript
import * as RpcSchema from '@effect/rpc/RpcSchema'
import { Rpc, RpcGroup } from '@effect/rpc'
import { Schema } from 'effect'

// Option 1: TaggedRequest with RpcSchema.Stream
class StreamUsers extends Schema.TaggedRequest<StreamUsers>()('StreamUsers', {
  success: RpcSchema.Stream({
    success: User,
    failure: Schema.Never
  }),
  failure: Schema.Never,
  payload: { id: Schema.String }
}) {}

// Register via Rpc.fromTaggedRequest
const UserRpcs = RpcGroup.make(
  Rpc.fromTaggedRequest(StreamUsers),
  // ... other RPCs
)

// Option 2: Rpc.make with stream: true
const StreamUsers2 = Rpc.make('StreamUsers', {
  payload: { id: Schema.String },
  success: User,
  stream: true  // Wraps success in RpcSchema.Stream internally
})
```

**Verified details** (from submodule):
- [x] `RpcSchema.Stream({ success, failure })` — explicit streaming wrapper
- [x] `Rpc.make(..., { stream: true })` — shorthand, auto-wraps success
- [x] Both approaches work — TaggedRequest gives more control

### 5.4 Streaming Handler Implementation `[VERIFIED]`

**Source**: `submodules/effect/packages/platform-node/test/fixtures/rpc-schemas.ts:112-131`

```typescript
import { Effect, Mailbox } from 'effect'

// Handler returns a Mailbox for streaming
const UsersLive = UserRpcs.toLayer(Effect.gen(function*() {
  let interrupts = 0
  let emits = 0

  return UserRpcs.of({
    StreamUsers: Effect.fnUntraced(function*(req, _) {
      // Create bounded mailbox for backpressure (0 = unbounded)
      const mailbox = yield* Mailbox.make<User>(0)

      // Cleanup on client disconnect
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => { interrupts++ })
      )

      // Emit items to mailbox (backpressure-aware)
      yield* mailbox.offer(new User({ id: req.id, name: 'John' })).pipe(
        Effect.tap(() => { emits++ }),
        Effect.delay(100),
        Effect.forever,
        Effect.forkScoped  // Scoped to request lifecycle
      )

      return mailbox  // Client receives as Stream
    }),
    // ...
  })
}))
```

**Verified details** (from submodule):
- [x] Streaming handlers return `Mailbox<T>` — converted to `Stream<T>` on client
- [x] `Mailbox.make<T>(capacity)` — `0` = unbounded, `N` = bounded with backpressure
- [x] `mailbox.offer(item)` — suspends when full (backpressure)
- [x] `Effect.addFinalizer` — runs when client disconnects/interrupts
- [x] `Effect.forkScoped` — ties producer fiber to request scope

### 5.5 Transport Comparison `[VERIFIED]`

**Source**: `submodules/effect/packages/platform-node/test/RpcServer.test.ts`

| Transport | Server Layer | Client Layer | Streaming | Backpressure |
|-----------|--------------|--------------|-----------|--------------|
| HTTP | `layerProtocolHttp({ path })` | `layerProtocolHttp({ url })` | ❌ | N/A |
| WebSocket | `layerProtocolWebsocket({ path })` | `layerProtocolSocket()` + `NodeSocket.layerWebSocket(url)` | ✅ | ✅ (with ack) |
| TCP | `layerProtocolSocketServer` | `layerProtocolSocket()` + `NodeSocket.layerNet({ port })` | ✅ | ✅ (with ack) |
| Worker | N/A (in-process) | `layerProtocolWorker({ size })` | ✅ | ✅ |

**Verified details** (from submodule):
- [x] HTTP does NOT support streaming — use WebSocket/TCP for `stream: true` RPCs
- [x] `supportsAck` determines backpressure — true for socket transports
- [x] Client sees `Stream.take(5)` → server gets interrupts when client stops early

---

## 6. Layer Composition

### 6.1 RPC Server Layer Composition `[VERIFIED]`

**Source**: `submodules/effect/packages/platform-node/test/fixtures/rpc-schemas.ts:147-153`

```typescript
import { RpcServer, RpcMiddleware } from '@effect/rpc'
import { Layer } from 'effect'

// Define handlers via group.toLayer()
const UsersLive = UserRpcs.toLayer(Effect.gen(function*() {
  return UserRpcs.of({
    GetUser: (req) => Effect.succeed(new User({ id: req.id, name: 'John' })),
    // ... other handlers
  })
}))

// Define middleware implementations
const AuthLive = Layer.succeed(
  AuthMiddleware,
  AuthMiddleware.of((options) =>
    Effect.succeed(new User({ id: options.headers.userid ?? '1', name: 'Fallback' }))
  )
)

// Compose server layer
const RpcLive = RpcServer.layer(UserRpcs).pipe(
  Layer.provide([
    UsersLive,     // Handler layer
    AuthLive,      // Server middleware
    TimingLive     // Wrap middleware
  ])
)
```

**Verified details** (from submodule):
- [x] `RpcServer.layer(group)` — creates server layer requiring handlers
- [x] `group.toLayer(Effect.gen(...))` — implements handlers with closure for state
- [x] `group.of({ ... })` — type-safe handler object creation
- [x] Middleware via `Layer.succeed(MiddlewareTag, MiddlewareTag.of(...))`

### 6.2 RPC Middleware Patterns `[VERIFIED]`

**Source**: `submodules/effect/packages/platform-node/test/fixtures/rpc-schemas.ts:32-99`, `submodules/effect/packages/rpc/src/RpcMiddleware.ts:233-245`

```typescript
import { RpcMiddleware } from '@effect/rpc'
import { Context, Schema } from 'effect'

// Pattern 1: Auth middleware — provides context, can fail
class CurrentUser extends Context.Tag('CurrentUser')<CurrentUser, User>() {}
class Unauthorized extends Schema.TaggedError<Unauthorized>('Unauthorized')('Unauthorized', {}) {}

class AuthMiddleware extends RpcMiddleware.Tag<AuthMiddleware>()('AuthMiddleware', {
  provides: CurrentUser,        // Provides this service to handlers
  failure: Unauthorized,        // Error type if auth fails
  requiredForClient: true       // Client MUST send credentials
}) {}

// Server-side auth implementation
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

// Client-side credential injection
const AuthClient = RpcMiddleware.layerClient(AuthMiddleware, ({ request }) =>
  Effect.succeed({
    ...request,
    headers: Headers.set(request.headers, 'name', 'Logged in user')
  })
)

// Pattern 2: Wrap middleware — intercepts next()
class TimingMiddleware extends RpcMiddleware.Tag<TimingMiddleware>()('TimingMiddleware', {
  wrap: true  // Wraps handler execution
}) {}

const TimingLive = Layer.succeed(
  TimingMiddleware,
  TimingMiddleware.of((options) =>
    options.next.pipe(  // Call wrapped handler
      Effect.tap(() => Metric.increment(rpcSuccesses)),
      Effect.tapDefect(() => Metric.increment(rpcDefects)),
      Effect.ensuring(Metric.increment(rpcCount))
    )
  )
)

// Pattern 3: Per-RPC middleware
const TimedMethod = Rpc.make('TimedMethod', {
  payload: { shouldFail: Schema.Boolean },
  success: Schema.Number
}).middleware(TimingMiddleware)  // Only this RPC uses TimingMiddleware
```

**Verified details** (from submodule):
- [x] `RpcMiddleware.Tag<Self>()(name, { provides?, failure?, requiredForClient?, wrap?, optional? })`
- [x] `provides` middleware provides a Context.Tag to downstream handlers
- [x] `wrap: true` middleware receives `options.next` to intercept handler
- [x] `requiredForClient: true` requires client-side `layerClient` implementation
- [x] `.middleware(Tag)` applies middleware to specific RPC
- [x] `.middleware(Tag)` on RpcGroup applies to all RPCs in group

### 6.3 Client Layer Composition `[VERIFIED]`

**Source**: `submodules/effect/packages/platform-node/test/fixtures/rpc-schemas.ts:155-171`

```typescript
import { RpcClient, RpcTest } from '@effect/rpc'
import { Layer, Context } from 'effect'

// Define client tag for dependency injection
class UsersClient extends Context.Tag('UsersClient')<
  UsersClient,
  RpcClient.RpcClient<RpcGroup.Rpcs<typeof UserRpcs>, RpcClientError>
>() {
  // Production client layer
  static layer = Layer.scoped(UsersClient, RpcClient.make(UserRpcs)).pipe(
    Layer.provide(AuthClient)  // Client middleware
  )

  // Test client layer (no transport, direct handlers)
  static layerTest = Layer.scoped(UsersClient, RpcTest.makeClient(UserRpcs)).pipe(
    Layer.provide([UsersLive, AuthLive, TimingLive, AuthClient])
  )
}

// Usage in app
const app = Effect.gen(function*() {
  const client = yield* UsersClient
  const user = yield* client.GetUser({ id: '1' })
}).pipe(Effect.provide(UsersClient.layer))
```

**Verified details** (from submodule):
- [x] `RpcClient.make(group)` — creates scoped client
- [x] `RpcTest.makeClient(group)` — in-memory test client (no transport)
- [x] Client middleware via `Layer.provide(RpcMiddleware.layerClient(...))`
- [x] Test layer provides handlers directly for fast unit tests

### 6.4 Full Transport Stack `[VERIFIED]`

**Source**: `submodules/effect/packages/platform-node/test/RpcServer.test.ts`

```typescript
import { HttpRouter, HttpServer } from '@effect/platform'
import { NodeHttpServer, NodeSocket } from '@effect/platform-node'
import { RpcServer, RpcClient, RpcSerialization } from '@effect/rpc'
import { Layer } from 'effect'

// === SERVER STACK ===
// 1. Handler layer (implements RPCs)
const RpcLive = RpcServer.layer(UserRpcs).pipe(
  Layer.provide([UsersLive, AuthLive])
)

// 2. Protocol layer (WebSocket at /rpc)
const HttpWsServer = HttpRouter.Default.serve().pipe(
  Layer.provide(RpcLive),
  Layer.provideMerge(RpcServer.layerProtocolWebsocket({ path: '/rpc' }))
)

// 3. Transport layer (Node HTTP server + serialization)
const ServerStack = HttpWsServer.pipe(
  Layer.provide([
    NodeHttpServer.layerTest,         // Test server (random port)
    RpcSerialization.layerMsgPack     // MessagePack serialization
  ])
)

// === CLIENT STACK ===
const ClientStack = UsersClient.layer.pipe(
  // 1. Protocol layer (socket client)
  Layer.provide(RpcClient.layerProtocolSocket()),
  // 2. Transport layer (WebSocket to server)
  Layer.provide(
    Effect.gen(function*() {
      const server = yield* HttpServer.HttpServer
      const address = server.address as HttpServer.TcpAddress
      return NodeSocket.layerWebSocket(`http://127.0.0.1:${address.port}/rpc`)
    }).pipe(Layer.unwrapEffect)
  ),
  // 3. Must match server serialization
  Layer.provide(RpcSerialization.layerMsgPack)
)

// === FULL E2E STACK ===
const E2ELayer = ClientStack.pipe(
  Layer.provideMerge(ServerStack)
)
```

**Verified details** (from submodule):
- [x] Server: `RpcServer.layer` → `layerProtocolWebsocket` → `NodeHttpServer.layer`
- [x] Client: `RpcClient.make` → `layerProtocolSocket` → `NodeSocket.layerWebSocket`
- [x] Serialization MUST match between client and server
- [x] `NodeHttpServer.layerTest` for random port in tests
- [x] `Layer.unwrapEffect` for dynamic layer construction

---

## 7. Research Agenda

### Priority 1: Core Verification ✅ COMPLETE

| Topic | Submodule Location | Status |
|-------|-------------------|--------|
| `Rpc.make` API | `effect/packages/rpc/src/Rpc.ts:635-684` | `[VERIFIED]` |
| `Entity.make` API | `effect/packages/cluster/src/Entity.ts:390-400` | `[VERIFIED]` |
| `Workflow.make` API | `effect/packages/workflow/src/Workflow.ts:263-313` | `[VERIFIED]` |
| `Activity.make` API | `effect/packages/cluster/test/ClusterWorkflowEngine.test.ts` | `[VERIFIED]` |
| `EntityProxy.toRpcGroup` | `effect/packages/cluster/src/EntityProxy.ts:47-76` | `[VERIFIED]` |
| `WorkflowProxy.toRpcGroup` | `effect/packages/workflow/src/WorkflowProxy.ts:45-71` | `[VERIFIED]` |
| `WorkflowEngine.layerMemory` | `effect/packages/workflow/test/WorkflowEngine.test.ts` | `[VERIFIED]` |
| `RpcServer.layerProtocolWebsocket` | `effect/packages/rpc/src/RpcServer.ts:902-911` | `[VERIFIED]` |
| `RpcClient.layerProtocolSocket` | `effect/packages/rpc/src/RpcClient.ts:1245-1252` | `[VERIFIED]` |
| `RpcMiddleware.Tag` | `effect/packages/rpc/src/RpcMiddleware.ts:233-245` | `[VERIFIED]` |
| Streaming handler (Mailbox) | `effect/packages/platform-node/test/fixtures/rpc-schemas.ts:112-131` | `[VERIFIED]` |
| Serialization layers | `effect/packages/platform-node/test/RpcServer.test.ts` | `[VERIFIED]` |

### Priority 2: Integration Patterns

| Topic | Research Question | Status |
|-------|------------------|--------|
| Entity + Fermion | Can we use Fermion families with Entity clients? | `[TODO]` |
| Workflow + IIoT | Can IIoT services be called from workflows? | `[TODO]` |
| RPC + OpenAPI | Does `toHttpApiGroup` generate valid OpenAPI? | `[TODO]` |
| Stream backpressure | How does mailbox-based streaming handle slow consumers? | `[VERIFIED]` — See 5.4-5.5 |
| Entity → HttpApiGroup | Does `EntityProxy.toHttpApiGroup` create REST endpoints? | `[TODO]` |

### Priority 3: TMNL Integration

| Component | Integration Point | Status |
|-----------|------------------|--------|
| `src/lib/iiot/` | Entity wrapping IIoTService | `[TODO]` |
| `src/lib/fermion/` | Fermion families for entity data | `[PARTIAL]` — sensorFermion done |
| `src/lib/holonet/` | RPC transport over NATS? | `[TODO]` |
| `src/lib/durable-streams/` | Workflow activity integration | `[TODO]` |

---

## Cross-Reference Commands

```bash
# Verify RPC patterns
grep -rn "Rpc.make" ../../submodules/effect/packages/rpc/

# Verify Entity patterns
grep -rn "Entity.make" ../../submodules/effect/packages/cluster/

# Verify Workflow patterns
cat ../../submodules/effect/packages/workflow/src/Workflow.ts | head -200

# Check test examples
find ../../submodules/effect/packages/cluster/test -name "*.test.ts" | xargs head -100

# Verify EntityProxy
cat ../../submodules/effect/packages/cluster/src/EntityProxy.ts
```

---

## Next Steps

1. **Submodule Sync**: Ensure `../../submodules/effect` is up-to-date
2. **Pattern Extraction**: Run cross-reference commands above
3. **Test Verification**: Find working test examples for each pattern
4. **TMNL Spike**: Create minimal integration spike with IIoT

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-24 | Initial research framework from DeepWiki Q&A |
| 2026-01-24 | Verified `Rpc.make`, `Entity.make`, `EntityProxy.toRpcGroup` via submodule |
| 2026-01-24 | Verified `Workflow.make`, `Activity.make`, `WorkflowEngine.layerMemory` via tests |
| 2026-01-24 | Added DurableDeferred, DurableClock, WorkflowInstance patterns |
| 2026-01-24 | Verified `WorkflowProxy.toRpcGroup`, `toHttpApiGroup` from submodule |
| 2026-01-24 | Verified Section 5 (Streaming/WebSocket): server, client, serialization, Mailbox |
| 2026-01-24 | Verified Section 6 (Layer Composition): middleware, client/server layers, full stack |
| 2026-01-24 | Updated streaming RPC patterns with TaggedRequest + RpcSchema.Stream |
| 2026-01-24 | Priority 1 Core Verification: **COMPLETE** — all items verified via submodule |
