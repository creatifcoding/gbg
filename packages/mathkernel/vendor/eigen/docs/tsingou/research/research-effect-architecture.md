# Research: Effect-TS Implementation Architecture

```
Document:    research-effect-architecture.md
Purpose:     Research base for RFC section TSG.32
Author:      Val (dsp-specialist)
Created:     2026-02-18
Target RFC:  TMNL-RFC-002 Section TSG.32
```

---

## 1. Effect Algebra Foundations

### 1.1 The Effect Type

The fundamental abstraction in Effect-TS is `Effect<A, E, R>`, a lazy, composable description of a computation that:

- **Succeeds** with a value of type `A` (the success channel)
- **Fails** with an error of type `E` (the error channel)
- **Requires** an environment of type `R` (the requirements channel)

This three-channel type is the foundation of all Tsingou services. Unlike raw `Promise<T>`, Effect tracks errors and dependencies at the type level, making failure modes visible and dependency graphs explicit.

Key properties:
- **Referentially transparent**: Effect values are descriptions, not executions. Same input produces same output.
- **Composable**: `Effect.gen`, `Effect.flatMap`, `Effect.map`, `pipe()` compose effects algebraically.
- **Lazy**: Nothing executes until explicitly run via `Effect.runPromise`, `Effect.runSync`, or a runtime.

### 1.2 Effect.gen — Generator-Based Composition

The primary composition mechanism uses generator functions:

```typescript
const program = Effect.gen(function* () {
  const service = yield* MyService
  const result = yield* service.doWork(input)
  yield* Effect.log(`Result: ${result}`)
  return result
})
```

`yield*` is the monadic bind — it suspends the generator, awaits the effect, and resumes with the success value. If any yielded effect fails, the generator short-circuits with that error.

### 1.3 pipe() — Point-Free Composition

For transformation chains without intermediate bindings:

```typescript
const program = Effect.succeed(42).pipe(
  Effect.map((n) => n * 2),
  Effect.flatMap((n) => validatePositive(n)),
  Effect.tap((n) => Effect.log(`Validated: ${n}`)),
)
```

### 1.4 Exit and Cause

Every effect execution terminates with an `Exit<A, E>`:
- `Exit.Success<A>` — computation succeeded
- `Exit.Failure<E>` — computation failed with `Cause<E>`

`Cause<E>` is a tree structure capturing:
- `Cause.fail(e)` — expected failure
- `Cause.die(defect)` — unexpected defect
- `Cause.interrupt(fiberId)` — fiber interruption
- `Cause.parallel(left, right)` — concurrent failures
- `Cause.sequential(first, second)` — chained failures

---

## 2. Service and Layer Architecture

### 2.1 Service Definition Pattern

Services in Effect are defined as `Context.Tag` values with a service interface:

```typescript
// Modern pattern (Effect 3.x)
export class MyService extends Context.Tag('MyService')<
  MyService,
  { readonly doWork: (input: string) => Effect.Effect<Result, ServiceError> }
>() {}
```

Or using the newer `Effect.Service` pattern:

```typescript
export class AlarmService extends Effect.Service<AlarmService>()('iiot/AlarmService', {
  dependencies: [TimeSeriesClient.Default, IIoTPgClientLive],
  effect: Effect.gen(function* () {
    const tsClient = yield* TimeSeriesClient
    const sql = yield* PgClient.PgClient
    // ... construct service implementation
    return { create, getById, acknowledge, clear }
  }),
}) {}
```

### 2.2 Layer Composition

Layers are constructors for services. A `Layer<Out, Error, In>` describes how to build `Out` services, potentially failing with `Error`, requiring `In` services.

Composition operators:
- `Layer.provide(dependency)` — wire a dependency into a layer
- `Layer.merge(a, b)` — combine two independent layers
- `Layer.mergeAll(a, b, c, ...)` — combine multiple independent layers
- `Layer.provideMerge(a, b)` — provide `a` to `b` and merge outputs
- `pipe(layer, Layer.provide(dep))` — pipeline syntax

Layer memoization: By default, layers are memoized within a scope. A service constructed once is shared across all consumers in the same scope.

### 2.3 Layered Service Tiers

Tsingou uses a tiered service model:

| Tier | Purpose | Examples |
|------|---------|---------|
| L1 — Infrastructure | Database clients, message brokers | PgClient, NatsClient, TimeSeriesClient |
| L2 — Domain Services | Business logic, entity management | AlarmService, SensorService, AssetService |
| L3 — Orchestration | Cross-domain coordination | IIoTService (facade over L2 services) |

Each tier has an index barrel:
- `services/l1/index.ts` — infrastructure exports
- `services/l2/index.ts` — domain exports
- `services/l3/index.ts` — orchestration exports

### 2.4 Dependency Graph Properties

Layer composition produces a DAG (directed acyclic graph) of dependencies:

```
IIoTService (L3)
  ├── AlarmService (L2)
  │   ├── TimeSeriesClient (L1)
  │   ├── PgClient (L1)
  │   └── IIoTFeatureFlags (Config)
  ├── SensorService (L2)
  │   └── PgClient (L1)
  └── AssetService (L2)
      └── PgClient (L1)
```

Properties:
- **Type-safe**: Missing dependencies cause compile-time errors (R channel not satisfied)
- **Memoized**: PgClient constructed once, shared across AlarmService, SensorService, AssetService
- **Testable**: Replace any layer with a test double (e.g., in-memory PgClient)

---

## 3. Schema System

### 3.1 Schema<A, I, R>

The Effect Schema type describes a bidirectional transformation:
- `A` — the type (what your code works with)
- `I` — the encoded form (what crosses system boundaries: JSON, database rows, wire format)
- `R` — requirements (services needed for transformation)

### 3.2 Branded Types

Branded types prevent accidental mixing of structurally identical values:

```typescript
const AlarmId = Schema.String.pipe(Schema.brand('AlarmId'))
const DeviceId = Schema.String.pipe(Schema.brand('DeviceId'))
// AlarmId and DeviceId are both strings at runtime,
// but TypeScript prevents passing one where the other is expected
```

### 3.3 Tagged Structs and Classes

For domain entities:

```typescript
// TaggedStruct — pure data, no methods
const AlarmEvent = Schema.TaggedStruct('AlarmEvent', {
  type: Schema.Literal('AlarmTriggered', 'AlarmAcknowledged', 'AlarmCleared'),
  alarmId: AlarmId,
  timestamp: Schema.DateTimeUtc,
})

// TaggedClass — data with prototype methods
class Alarm extends Schema.TaggedClass<Alarm>()('Alarm', {
  id: AlarmId,
  deviceId: DeviceId,
  severity: AlarmSeverity,
  state: AlarmState,
  triggeredAt: Schema.DateTimeUtc,
}) {
  get isActive() { return this.state !== 'cleared' }
}
```

### 3.4 Schema Transformations

For database row → domain entity conversion:

```typescript
const AlarmFromRow = Schema.transformOrFail(
  AlarmRowSchema,        // Encoded form (DB row)
  Schema.typeSchema(Alarm), // Type form (domain)
  {
    decode: (row, _, ast) =>
      ParseResult.try({
        try: () => new Alarm({ ... }),
        catch: (e) => new ParseResult.Type(ast, row, String(e)),
      }),
    encode: (alarm, _, ast) =>
      ParseResult.try({
        try: () => ({ ... }),
        catch: (e) => new ParseResult.Type(ast, alarm, String(e)),
      }),
  }
)
```

### 3.5 JSON Schema Generation

For API documentation and AI tool integration:

```typescript
import { JSONSchema } from 'effect'
const jsonSchema = JSONSchema.make(Alarm)
// Produces JSON Schema object directly from Effect Schema
```

---

## 4. Error Handling Architecture

### 4.1 Tagged Errors

All domain errors extend `Data.TaggedError`:

```typescript
class AlarmNotFoundError extends Data.TaggedError('AlarmNotFoundError')<{
  readonly alarmId: string
}> {}

class AlarmAlreadyAcknowledgedError extends Data.TaggedError('AlarmAlreadyAcknowledgedError')<{
  readonly alarmId: string
}> {}
```

For RPC boundaries, use `Schema.TaggedError` for serialization:

```typescript
class RpcAlarmNotFoundError extends Schema.TaggedError<RpcAlarmNotFoundError>()(
  'RpcAlarmNotFoundError',
  { alarmId: AlarmId }
) {}
```

### 4.2 Discriminated Error Recovery

```typescript
const program = risky.pipe(
  Effect.catchTag('AlarmNotFoundError', (e) =>
    Effect.succeed(defaultAlarm(e.alarmId))
  ),
  Effect.catchTags({
    AlarmAlreadyAcknowledgedError: (e) =>
      Effect.logWarning(`Already acked: ${e.alarmId}`),
    AlarmAlreadyClearedError: (e) =>
      Effect.logWarning(`Already cleared: ${e.alarmId}`),
  }),
)
```

### 4.3 Error Channel Narrowing

Each `catchTag` call narrows the error union at the type level:

```typescript
// Before: Effect<Alarm, AlarmNotFoundError | AlarmExpiredError, R>
const recovered = program.pipe(
  Effect.catchTag('AlarmNotFoundError', fallback)
)
// After: Effect<Alarm, AlarmExpiredError, R>
// AlarmNotFoundError is removed from the error channel
```

### 4.4 Error Mapping at Boundaries

Services map internal errors to RPC-safe errors at entity boundaries:

```typescript
actor.send(new InternalAcknowledgeAlarm({ ... })).pipe(
  Effect.catchTags({
    MachineAlarmNotFoundError: (e) =>
      Effect.fail(new RpcAlarmNotFoundError({ alarmId: e.alarmId })),
    MachineInvalidTransitionError: (e) =>
      Effect.fail(new RpcAlarmAlreadyAcknowledgedError({ alarmId: e.alarmId })),
  }),
)
```

---

## 5. Structured Concurrency

### 5.1 Fiber Model

Effect's concurrency is based on fibers — lightweight virtual threads:

- **Effect.fork**: Creates a child fiber attached to the parent. Auto-interrupted when parent exits.
- **Effect.forkScoped**: Fiber lifetime tied to a Scope. Interrupted when scope closes.
- **Effect.forkDaemon**: Global fiber. Outlives parent. Use for background workers.
- **Effect.forkIn**: Explicit scope parameter for manual lifetime control.

### 5.2 Supervision Guarantees

Structured concurrency ensures:
1. No orphaned fibers — all fibers are supervised
2. Parent awaits children — parent cannot exit before children complete (fork, not forkDaemon)
3. Interruption propagates — interrupting a parent interrupts all children
4. Error propagation — child failure propagates to parent (unless explicitly caught)

### 5.3 Concurrent Data Structures

- **Queue**: Bounded, backpressure-aware. `offer` suspends when full, `take` suspends when empty.
  - Power-of-2 capacities recommended for RingBuffer optimization.
  - Used for: work distribution, pipeline stages, buffered channels.

- **PubSub**: Broadcast messaging. All subscribers receive every message.
  - Supports: bounded, unbounded, dropping, sliding strategies.
  - Used for: event distribution, signal broadcasting.

### 5.4 Concurrency Combinators

```typescript
// Run effects in parallel, collect all results
Effect.all([fetchA, fetchB, fetchC], { concurrency: 'unbounded' })

// Race — first to succeed wins
Effect.race(primary, fallback)

// Fork-join pattern
const fiber = yield* Effect.fork(backgroundWork)
const result = yield* Fiber.join(fiber)
```

---

## 6. Resource Management

### 6.1 Scope and Finalizers

The `Scope` type represents the lifetime of a resource. When closed, all registered finalizers execute in LIFO order.

```typescript
const resource = Effect.acquireRelease(
  connect(),           // Acquire
  (conn) => conn.close() // Release (always runs)
)

// Use with scoped:
const program = Effect.scoped(
  Effect.gen(function* () {
    const conn = yield* resource
    return yield* conn.query('SELECT 1')
  })
)
```

### 6.2 addFinalizer

For registering cleanup in service construction:

```typescript
const service = Effect.gen(function* () {
  const conn = yield* connect()
  yield* Effect.addFinalizer((exit) =>
    exit._tag === 'Success'
      ? Effect.log('Clean shutdown')
      : Effect.logError(`Shutdown with error: ${exit}`)
  )
  return { query: conn.query.bind(conn) }
})
```

### 6.3 Layer Resource Lifecycle

Layers automatically manage resource lifecycles:
- Layer construction = resource acquisition
- Layer scope closure = resource release
- Memoization ensures single construction per scope

---

## 7. Stream Processing

### 7.1 Stream<A, E, R>

Streams are lazy, pull-based sequences of values. Key properties:

- **Pull-based**: Consumer drives emission rate. Natural backpressure.
- **Chunked**: Values emitted in `Chunk<A>` batches for efficiency.
- **Composable**: Same pipe/flatMap/map algebra as Effect.
- **Resource-safe**: Integrates with Scope for cleanup.

### 7.2 Stream Creation

```typescript
// From iterable
Stream.fromIterable([1, 2, 3])

// From Effect (single value)
Stream.fromEffect(fetchLatest())

// Async with callback bridge
Stream.async<SensorReading, SensorError>((emit) => {
  const handler = (reading: SensorReading) =>
    emit(Effect.succeed(Chunk.of(reading)))
  sensorApi.on('data', handler)
  return Effect.sync(() => sensorApi.off('data', handler))
})

// With resource lifecycle
Stream.acquireRelease(openFile(path), (f) => f.close()).pipe(
  Stream.flatMap((file) => file.readLines())
)
```

### 7.3 Stream Operators

Transformation: `Stream.map`, `Stream.filter`, `Stream.flatMap`
Aggregation: `Stream.scan`, `Stream.aggregate`, `Stream.groupBy`
Windowing: `Stream.groupedWithin`, `Stream.debounce`, `Stream.throttle`
Error handling: `Stream.catchAll`, `Stream.retry`, `Stream.orElse`
Resource: `Stream.scoped`, `Stream.acquireRelease`

### 7.4 Stream.toAsyncIterable

Bridge from Effect streams to JavaScript async iteration:

```typescript
const stream = createSignalStream(config).pipe(
  Stream.map(processSignal),
  Stream.filter(isRelevant),
  Stream.provideLayer(SignalServiceLive), // R = never BEFORE bridge
)
const iter = Stream.toAsyncIterable(stream)
for await (const signal of iter) {
  renderSignal(signal)
}
```

Critical: `Stream.provideLayer` MUST be called BEFORE `Stream.toAsyncIterable`. The async iterable interface cannot carry R requirements.

---

## 8. RPC System

### 8.1 RPC Definition

RPCs are defined with Schema types for request, success, and error:

```typescript
class CreateAlarmRpc extends Rpc.make('Alarm.Create', {
  payload: CreateAlarmParams,
  primaryKey: ({ deviceId }) => deviceId,
  success: Alarm,
  error: RpcQueryError,
}) {}
```

### 8.2 RPC Groups

Multiple RPCs compose into groups:

```typescript
export const AlarmRpcs = RpcGroup.make(
  CreateAlarmRpc,
  GetAlarmRpc,
  AcknowledgeAlarmRpc,
  ClearAlarmRpc,
)
```

### 8.3 Entity-Derived RPCs

In the cluster architecture, entities define their RPCs inline:

```typescript
export const AlarmEntity = Entity.make('Alarm', [
  CreateAlarmRpc,
  GetAlarmRpc,
  AcknowledgeAlarmRpc,
  ClearAlarmRpc,
])
```

The entity exposes:
- `AlarmEntity.toLayer(handlers)` — create handler layer
- `EntityProxyServer.layerRpcHandlers(AlarmEntity)` — proxy handlers for cluster routing

### 8.4 RPC Server Layer Composition

```typescript
// Core: Combine all entity RPCs
const RpcServerCore = RpcServer.layer(IIoTRpcs).pipe(
  Layer.provide(EntityRpcHandlers),
)

// Protocol: Add transport + serialization
export const IIoTRpcNdjson = Layer.mergeAll(
  RpcServerCore,
  RpcServer.layerProtocolHttpRouter({ path: '/rpc' }),
  RpcSerialization.layerNdjson,
)
```

### 8.5 Serialization Formats

| Format | Wire | Use Case |
|--------|------|----------|
| ndjson | Newline-delimited JSON | Development, debugging |
| msgpack | Binary MessagePack | Production throughput |
| JSON | Standard JSON | Browser WebSocket clients |

### 8.6 WebSocket Protocol

For real-time streaming RPCs:

```typescript
export const IIoTRealtimeWsServer = Layer.mergeAll(
  RpcServerCore,
  RpcServer.layerProtocolWebsocketRouter({ path: '/ws/iiot' }),
  RpcSerialization.layerJson,
)
```

---

## 9. Atom-as-State Pattern

### 9.1 Atom.make()

Atoms are reactive state containers that bridge Effect services and React components:

```typescript
export const alarmCountAtom = Atom.make(0)
export const activeAlarmsAtom = Atom.make<Alarm[]>([])
```

### 9.2 Module-Level Definition

Atoms MUST be defined at module level, not inside components:

```typescript
// CORRECT: Module-level
export const statusAtom = Atom.make<'idle' | 'loading' | 'error'>('idle')

// INCORRECT: Inside component (recreates on every render)
function Component() {
  const statusAtom = Atom.make('idle') // ❌ Never do this
}
```

### 9.3 Service Mutation via ctx.set()

Services mutate atoms through the context:

```typescript
export const ops = {
  search: runtimeAtom.fn<Query>()((query, ctx) =>
    Effect.gen(function* () {
      ctx.set(statusAtom, 'loading')
      const results = yield* searchService.search(query)
      ctx.set(resultsAtom, results)
      ctx.set(statusAtom, 'idle')
      return results
    })
  ),
}
```

### 9.4 React Subscription

```typescript
function AlarmCounter() {
  const count = useAtomValue(alarmCountAtom)
  return <Badge>{count}</Badge>
}
```

### 9.5 Derived Atoms

```typescript
const criticalAlarmCountAtom = Atom.family(
  activeAlarmsAtom,
  (alarms) => alarms.filter((a) => a.severity === 'critical').length
)
```

### 9.6 Atom.runtime()

Service-scoped atoms with automatic lifecycle:

```typescript
const runtimeAtom = Atom.runtime()
  .pipe(
    Atom.provide(AlarmServiceLive),
    Atom.provide(NatsClientLive),
  )
```

---

## 10. Configuration Management

### 10.1 Config Module

Effect provides typed configuration:

```typescript
const dbConfig = Effect.all({
  host: Config.string('DB_HOST'),
  port: Config.integer('DB_PORT').pipe(Config.withDefault(5432)),
  database: Config.string('DB_NAME'),
  ssl: Config.boolean('DB_SSL').pipe(Config.withDefault(false)),
})
```

### 10.2 Config-Backed Layers

Feature flags combine Config with Layer:

```typescript
export const IIoTFeatureFlagsEnvLayer: Layer.Layer<IIoTFeatureFlags> =
  Layer.effect(
    IIoTFeatureFlags,
    featureFlagsConfig.pipe(
      Effect.orElseSucceed(() => IIoTFeatureFlagsDefault)
    )
  )
```

### 10.3 Config Variants

| Variant | Purpose |
|---------|---------|
| `Layer.succeed(Tag, value)` | Static configuration (tests) |
| `Layer.effect(Tag, configEffect)` | Environment-derived configuration |
| `Config.withDefault(value)` | Fallback for missing config |
| `Config.map(Config.string('X'), parse)` | Transform config values |

---

## 11. ManagedRuntime and React Integration

### 11.1 ManagedRuntime

For React integration where Effect is not the entry point:

```typescript
const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    AlarmServiceLive,
    SensorServiceLive,
    NatsClientLive,
  )
)
```

### 11.2 React Provider Pattern

```typescript
function App() {
  useEffect(() => {
    return () => { runtime.dispose() }
  }, [])

  return (
    <RegistryProvider runtime={runtime}>
      <Dashboard />
    </RegistryProvider>
  )
}
```

### 11.3 Effect Execution in React

```typescript
function useAlarmAction() {
  const runtime = useRuntime()
  return useCallback(
    (alarmId: string) =>
      runtime.runPromise(
        AlarmService.pipe(
          Effect.flatMap((svc) => svc.acknowledge(alarmId))
        )
      ),
    [runtime]
  )
}
```

---

## 12. Testing Patterns

### 12.1 @effect/vitest

```typescript
import { it } from '@effect/vitest'

it.effect('should create alarm', () =>
  Effect.gen(function* () {
    const svc = yield* AlarmService
    const alarm = yield* svc.create(testAlarmParams)
    expect(alarm.state).toBe('unacknowledged')
  }).pipe(Effect.provide(AlarmService.Default))
)
```

### 12.2 Test Layers

Replace production layers with test doubles:

```typescript
const InMemoryPgClient = Layer.succeed(PgClient.PgClient, {
  query: () => Effect.succeed([]),
  // ...
})

const TestStack = AlarmEntityHandlers.pipe(
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
)
```

### 12.3 PubSub Testing Caveat

`it.effect()` and `it.scoped()` timeout with PubSub + Stream.fromPubSub + Effect.fork. Use plain vitest `it()` with `Effect.runPromise` wrapper for PubSub roundtrip tests.

---

## 13. Observability

### 13.1 withSpan

Every pipeline stage is traceable:

```typescript
const process = (signal: BaseSignal) =>
  validateSignal(signal).pipe(
    Effect.flatMap(enrichSignal),
    Effect.flatMap(routeSignal),
    Effect.withSpan('signal.process', { attributes: { kind: signal.kind } }),
  )
```

### 13.2 Structured Logging

```typescript
Effect.logInfo('Alarm created').pipe(
  Effect.annotateLogs({
    alarmId: alarm.id,
    severity: alarm.severity,
    module: 'AlarmService',
  })
)
```

### 13.3 Metric Primitives

```typescript
const alarmCounter = Metric.counter('alarm.created', {
  description: 'Number of alarms created',
})

const processLatency = Metric.histogram('signal.process.duration', {
  description: 'Signal processing latency in ms',
  boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
})
```

---

## 14. Cluster and Entity Model

### 14.1 @effect/cluster

Effect Cluster provides distributed entity management:

- **Entity**: Stateful actor with typed RPC interface
- **Sharding**: Consistent hashing distributes entities across nodes
- **Mailbox**: Serial message delivery per entity instance
- **EntityManager**: Lifecycle management (create, passivate, rehydrate)

### 14.2 Entity Definition Pattern

```typescript
export const AlarmEntity = Entity.make('Alarm', [
  CreateAlarmRpc,
  GetAlarmRpc,
  AcknowledgeAlarmRpc,
  ClearAlarmRpc,
])
```

### 14.3 Entity Handler Pattern

```typescript
export const AlarmEntityHandlers = AlarmEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* AlarmState
    const flags = yield* IIoTFeatureFlags
    const actor = yield* Machine.boot(makeAlarmMachine({ state, flags }))

    return AlarmEntity.of({
      'Alarm.Create': (envelope) =>
        actor.send(new InternalCreateAlarm({ ... })).pipe(
          Effect.catchTag('MachineCreateError', ...)
        ),
      // ... other handlers
    })
  })
)
```

### 14.4 Machine Integration

Entity handlers delegate to `@effect/experimental` Machine for state machine logic:

- Machine validates state transitions
- Machine procedures are internal RPCs
- Entity handlers map Machine errors to RPC errors

---

## 15. NATS Messaging Integration

### 15.1 Holonet Layer

Tsingou's NATS integration is called Holonet:

- **NatsClient**: Connection management with auto-reconnect
- **NatsPubSubService**: Pub/Sub over NATS subjects
- **NatsKVService**: Key-value store over NATS JetStream KV

### 15.2 Subject Hierarchy

```
tsingou.signals.{kind}         — Signal data streams
tsingou.events.{entityType}    — Entity lifecycle events
tsingou.alarms.{severity}      — Alarm broadcasts
tsingou.telemetry.{source}     — Raw telemetry
```

### 15.3 Event Distribution

EventDistribution uses ChannelService with broadcast outlets:

```typescript
const EventDistributionLive = Layer.effect(
  EventDistribution,
  Effect.gen(function* () {
    const channels = yield* ChannelService
    const readings = yield* channels.make('readings', { maxLag: 10_000 })
    const alarms = yield* channels.make('alarms', { maxLag: 1_000 })
    const equipment = yield* channels.make('equipment', { maxLag: 1_000 })
    const invalidations = yield* channels.make('invalidations', { maxLag: 1_000 })
    // ...
  })
)
```

---

## Bibliography

[EFFECT] Effect-TS. "Effect: Build production-ready applications in TypeScript." https://github.com/Effect-TS/effect
[EFFECT-SCHEMA] Effect. "Introduction to Effect Schema." https://effect.website/docs/schema/introduction/
[EFFECT-SERVICES] Effect. "Managing Services." https://effect.website/docs/requirements-management/services/
[EFFECT-LAYERS] Effect. "Managing Layers." https://effect.website/docs/requirements-management/layers/
[EFFECT-FIBERS] Effect. "Fibers." https://effect.website/docs/concurrency/fibers/
[EFFECT-STREAM] Effect. "Creating Streams." https://effect.website/docs/stream/creating/
[EFFECT-SCOPE] Effect. "Scope." https://effect.website/docs/resource-management/scope/
[EFFECT-ERRORS] Effect. "Expected Errors." https://effect.website/docs/error-management/expected-errors/
[EFFECT-RUNTIME] Effect. "Introduction to Runtime." https://effect.website/docs/runtime/
[EFFECT-QUEUE] Effect. "Queue." https://effect.website/docs/concurrency/queue/
[EFFECT-PUBSUB] Effect. "PubSub." https://effect.website/docs/concurrency/pubsub/
[EFFECT-RPC] Effect-TS. "@effect/rpc." https://github.com/Effect-TS/effect/blob/main/packages/rpc/README.md
[EFFECT-CLUSTER] Effect-TS. "@effect/cluster." https://github.com/Effect-TS/effect/tree/main/packages/cluster
[EFFECT-ATOM] Tim Smart. "effect-atom." https://github.com/tim-smart/effect-atom
[RFC2119] Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels." RFC 2119, March 1997.
[RFC8174] Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words." RFC 8174, May 2017.
