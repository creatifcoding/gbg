# TSG.32: Effect-TS Implementation Architecture

```
Section:       TSG.32 — Effect-TS Implementation Architecture
Parent RFC:    TMNL-RFC-002 (Tsingou Signal Intelligence Visualization Platform)
Status:        DRAFT
Author:        Val (dsp-specialist)
Created:       2026-02-18
Research Base: research-effect-architecture.md (15 sections, 480+ lines)
```

> This section specifies the Effect-TS implementation architecture that underpins the
> Tsingou platform. It establishes the service composition model, schema discipline,
> error handling strategy, concurrency model, resource management, stream processing
> pipeline, RPC system, reactive state bridge, configuration management, runtime
> integration, testing patterns, observability, cluster model, and NATS messaging
> fabric. All code within the Tsingou core packages MUST use Effect-TS primitives
> as defined herein. The key words "MUST", "MUST NOT", "SHOULD", "SHOULD NOT",
> and "MAY" are to be interpreted as described in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [TSG.32.1 Effect Algebra Foundations](#tsg321-effect-algebra-foundations)
2. [TSG.32.2 Service Architecture](#tsg322-service-architecture)
3. [TSG.32.3 Layer Composition Model](#tsg323-layer-composition-model)
4. [TSG.32.4 Schema Discipline](#tsg324-schema-discipline)
5. [TSG.32.5 Error Handling Architecture](#tsg325-error-handling-architecture)
6. [TSG.32.6 Structured Concurrency](#tsg326-structured-concurrency)
7. [TSG.32.7 Resource Management](#tsg327-resource-management)
8. [TSG.32.8 Stream Processing Pipeline](#tsg328-stream-processing-pipeline)
9. [TSG.32.9 RPC and Entity System](#tsg329-rpc-and-entity-system)
10. [TSG.32.10 Atom-as-State Reactive Bridge](#tsg3210-atom-as-state-reactive-bridge)
11. [TSG.32.11 Configuration Management](#tsg3211-configuration-management)
12. [TSG.32.12 Runtime and React Integration](#tsg3212-runtime-and-react-integration)
13. [TSG.32.13 Testing Architecture](#tsg3213-testing-architecture)
14. [TSG.32.14 Observability and Instrumentation](#tsg3214-observability-and-instrumentation)
15. [TSG.32.15 Cluster and Distributed Entity Model](#tsg3215-cluster-and-distributed-entity-model)
16. [TSG.32.16 NATS Messaging Fabric Integration](#tsg3216-nats-messaging-fabric-integration)
17. [TSG.32.17 Normative Requirements Summary](#tsg3217-normative-requirements-summary)
18. [TSG.32.18 Tsingou Integration Mapping](#tsg3218-tsingou-integration-mapping)
19. [TSG.32.19 References](#tsg3219-references)

---

## TSG.32.1 Effect Algebra Foundations

### TSG.32.1.1 The Effect<A, E, R> Type

The fundamental computation type in Tsingou is `Effect<A, E, R>` [EFFECT], a lazy, referentially transparent description of a computation that:

- **Succeeds** with a value of type `A` (the success channel)
- **Fails** with an error of type `E` (the error channel)
- **Requires** an environment of type `R` (the requirements channel)

This three-channel type is the atomic unit of all Tsingou services. Unlike JavaScript's `Promise<T>`, which collapses error types to `unknown` and has no concept of requirements, the Effect type preserves full type information across all three channels throughout composition.

| Channel | Type Parameter | Purpose | Compile-Time Guarantee |
|---------|---------------|---------|----------------------|
| Success | `A` | Computation result | Return type safety |
| Error | `E` | Expected failure modes | Exhaustive error handling |
| Requirements | `R` | Service dependencies | Dependency injection completeness |

**Requirement EFF-1**: All asynchronous computations within Tsingou core packages MUST be expressed as `Effect<A, E, R>` values. Raw `Promise<T>`, `async/await`, `try/catch`, and `EventEmitter` patterns are prohibited within core packages [EFFECT].

**Requirement EFF-2**: The error channel `E` MUST enumerate all expected failure modes. Implementations MUST NOT use `Effect.die()` for recoverable errors; `die` is reserved for defects (programming errors, invariant violations) [EFFECT-ERRORS].

**Requirement EFF-3**: The requirements channel `R` MUST declare all service dependencies. Implementations MUST NOT access services via global singletons, module-level mutable state, or ambient imports that bypass the dependency graph.

### TSG.32.1.2 Referential Transparency

Effect values are descriptions, not executions. Creating an `Effect<A, E, R>` value does not perform any side effects. Execution occurs only when an Effect is explicitly run through a Runtime.

This property has architectural consequences:

1. **Composability**: Effects compose without ordering concerns. Two effects can be combined before either executes.
2. **Testability**: Effects can be inspected, transformed, and intercepted without side effects.
3. **Memoization safety**: Layer construction is memoized because the same description produces the same result.
4. **Retry safety**: Failed effects can be retried because retry creates a fresh execution.

**Requirement EFF-4**: Effect values MUST be treated as descriptions. Implementations MUST NOT rely on effect construction order producing side effects. Side effects MUST occur only through Effect primitives (`Effect.sync`, `Effect.promise`, `Effect.async`) that explicitly declare effectful behavior.

### TSG.32.1.3 Generator-Based Composition

The primary composition mechanism is `Effect.gen` with generator functions [EFFECT]:

```typescript
const program = Effect.gen(function* () {
  const service = yield* MyService         // Dependency resolution
  const result = yield* service.doWork()   // Effectful operation
  yield* Effect.log(`Done: ${result}`)     // Logging
  return result                            // Success value
})
```

The `yield*` operator performs monadic bind: it suspends the generator, evaluates the yielded effect, and resumes with the success value. If any yielded effect fails, the generator short-circuits with that error, propagating it to the error channel.

**Requirement EFF-5**: Generator-based composition via `Effect.gen` SHOULD be the primary composition pattern for sequential operations. Pipeline composition via `pipe()` SHOULD be used for transformation chains without intermediate bindings.

### TSG.32.1.4 Pipeline Composition

For point-free transformation chains:

```typescript
const process = (signal: BaseSignal) =>
  validateSignal(signal).pipe(
    Effect.flatMap(enrichSignal),
    Effect.flatMap(routeSignal),
    Effect.tap(logProcessed),
    Effect.withSpan('signal.process'),
  )
```

### TSG.32.1.5 Exit and Cause

Every Effect execution terminates with `Exit<A, E>` [EFFECT]:

| Exit Variant | Meaning | Contains |
|-------------|---------|----------|
| `Exit.Success<A>` | Computation succeeded | Success value `A` |
| `Exit.Failure<E>` | Computation failed | `Cause<E>` tree |

The `Cause<E>` type captures the full failure tree:

| Cause Variant | Semantics | When Used |
|--------------|-----------|-----------|
| `Cause.fail(e: E)` | Expected error | Domain errors, validation failures |
| `Cause.die(defect: unknown)` | Unexpected defect | Programming errors, invariant violations |
| `Cause.interrupt(fiberId)` | Fiber interruption | Cancellation, timeout, scope closure |
| `Cause.parallel(left, right)` | Concurrent failures | Multiple fibers failed simultaneously |
| `Cause.sequential(first, second)` | Chained failures | Error during error handling |

**Requirement EFF-6**: Implementations MUST distinguish between expected errors (`Effect.fail`) and defects (`Effect.die`). Expected errors represent domain failure modes that callers can handle. Defects represent violations of preconditions or invariants that indicate programming errors.

---

## TSG.32.2 Service Architecture

### TSG.32.2.1 Service Definition

A service in Effect-TS is a typed interface identified by a `Context.Tag`. The tag serves as both a type-level identifier and a runtime key for dependency injection [EFFECT-SERVICES].

Two patterns are used in Tsingou:

**Pattern A — Context.Tag (infrastructure services)**:

```typescript
export class IIoTFeatureFlags extends Context.Tag('IIoTFeatureFlags')<
  IIoTFeatureFlags,
  FeatureFlagsShape
>() {}
```

**Pattern B — Effect.Service (domain services)**:

```typescript
export class AlarmService extends Effect.Service<AlarmService>()(
  'iiot/AlarmService',
  {
    dependencies: [TimeSeriesClient.Default, IIoTPgClientLive],
    effect: Effect.gen(function* () {
      const tsClient = yield* TimeSeriesClient
      const sql = yield* PgClient.PgClient
      return { create, getById, acknowledge, clear }
    }),
  }
) {}
```

The `Effect.Service` pattern bundles the tag, implementation, and dependencies into a single class declaration. The `dependencies` field produces a `Default` static layer that auto-resolves the dependency chain.

**Requirement SVC-1**: All services in Tsingou MUST be defined as `Context.Tag` or `Effect.Service` classes. Global singletons, ambient module-level state, and untyped dependency injection containers are prohibited.

**Requirement SVC-2**: Service identifiers MUST follow the convention `{module}/{ServiceName}`. Examples: `iiot/AlarmService`, `holonet/NatsClient`, `tsingou/SignalPipeline`.

### TSG.32.2.2 Service Interface Design

Service interfaces define the contract between providers and consumers:

```typescript
interface AlarmServiceShape {
  readonly create: (params: CreateAlarmParams) => Effect<Alarm, IIoTQueryError>
  readonly getById: (id: AlarmId) => Effect<Alarm, AlarmNotFoundError | IIoTQueryError>
  readonly acknowledge: (id: AlarmId, by: string) => Effect<Alarm, AlarmNotFoundError | AlarmAlreadyAcknowledgedError>
  readonly clear: (id: AlarmId) => Effect<Alarm, AlarmNotFoundError | AlarmAlreadyClearedError>
}
```

**Requirement SVC-3**: Service methods MUST return `Effect<A, E, R>` values. Service methods MUST NOT return raw `Promise`, throw exceptions, or perform synchronous I/O.

**Requirement SVC-4**: Service method error types MUST enumerate all expected failure modes in the `E` type parameter. Generic error types such as `Error`, `unknown`, or `never` (for methods that can fail) are prohibited.

### TSG.32.2.3 Tiered Service Model

Tsingou organizes services into three tiers:

| Tier | Directory | Purpose | Dependencies | Examples |
|------|-----------|---------|-------------|----------|
| **L1 — Infrastructure** | `services/l1/` | Database, messaging, external I/O | None (leaf services) | PgClient, TimeSeriesClient, GraphClient, NatsClient |
| **L2 — Domain** | `services/l2/` | Business logic, entity lifecycle | L1 services | AlarmService, SensorService, AssetService |
| **L3 — Orchestration** | `services/l3/` | Cross-domain coordination, facades | L2 services | IIoTService |

**Requirement SVC-5**: Services MUST observe the tier dependency rule: L3 services MAY depend on L2 and L1 services. L2 services MAY depend on L1 services. L1 services MUST NOT depend on L2 or L3 services. Circular dependencies between tiers are prohibited.

**Requirement SVC-6**: Each service tier MUST export a barrel `index.ts` that serves as the public API for that tier. Internal implementation details MUST NOT be imported across tier boundaries except through the barrel export.

### TSG.32.2.4 Service Lifecycle

Services are constructed lazily when first required. Construction order is determined by the dependency graph. Services constructed within the same Scope share resources through Layer memoization.

Service lifecycle phases:

| Phase | Mechanism | When |
|-------|-----------|------|
| **Definition** | `Context.Tag`, `Effect.Service` | Module load time |
| **Construction** | `Layer.effect(Tag, constructionEffect)` | First dependency resolution |
| **Memoization** | Layer memoization within Scope | Subsequent resolutions in same scope |
| **Disposal** | `Effect.addFinalizer`, Scope closure | Scope close, application shutdown |

**Requirement SVC-7**: Services that acquire resources (connections, file handles, subscriptions) MUST register cleanup via `Effect.addFinalizer` during construction. Resource leaks are treated as defects.

---

## TSG.32.3 Layer Composition Model

### TSG.32.3.1 Layer<Out, Error, In>

A Layer describes how to construct a set of services (`Out`) from a set of dependencies (`In`), potentially failing with `Error` [EFFECT-LAYERS].

Layers are the dependency injection mechanism. They replace constructor injection, factory patterns, and IoC containers with a type-safe, composable abstraction.

### TSG.32.3.2 Layer Construction

| Constructor | Use Case | Example |
|------------|----------|---------|
| `Layer.succeed(Tag, value)` | Static value, no construction logic | Feature flags (test mode) |
| `Layer.effect(Tag, constructionEffect)` | Effectful construction | Database connection |
| `Layer.scoped(Tag, scopedEffect)` | Construction with resource lifecycle | Connection pool |
| `Layer.function(Tag, fn)` | Pure function mapping | Config transformation |
| `Service.Default` | Auto-wired from `Effect.Service` class | Service with declared dependencies |

### TSG.32.3.3 Layer Composition Operators

| Operator | Signature | Semantics |
|----------|-----------|-----------|
| `Layer.provide(dependency)` | `Layer<A, E, R> -> Layer<A, E, R2>` | Satisfy `R` with `dependency` |
| `Layer.merge(a, b)` | `Layer<A \| B, E, R1 \| R2>` | Combine independent layers |
| `Layer.mergeAll(a, b, c, ...)` | Variadic merge | Combine multiple layers |
| `pipe(a, Layer.provide(b))` | Pipeline syntax | Same as `Layer.provide` |
| `Layer.provideMerge(a, b)` | Provide and merge outputs | Both `a` and `b` outputs available |

**Requirement LAY-1**: Layer composition MUST produce an acyclic dependency graph. The Effect type system enforces this at compile time; implementations MUST NOT circumvent this with `any` casts or type assertions.

**Requirement LAY-2**: Shared infrastructure services (database connections, message broker connections) MUST be constructed in a single Layer and shared via Layer memoization. Implementations MUST NOT construct multiple instances of the same infrastructure service within a single application scope.

### TSG.32.3.4 Layer Memoization

By default, Layers are memoized within a Scope. Given a dependency graph:

```
IIoTService
  ├── AlarmService
  │   ├── PgClient ────┐
  │   └── FeatureFlags │ (memoized: single PgClient instance)
  ├── SensorService    │
  │   └── PgClient ────┘
  └── AssetService
      └── PgClient ────┘
```

`PgClient` is constructed once and shared across all three L2 services. This is a critical performance property: database connection pools, NATS connections, and other expensive resources are constructed exactly once.

**Requirement LAY-3**: Implementations MUST NOT use `Layer.fresh` to bypass memoization for infrastructure services. `Layer.fresh` is reserved for cases where independent instances are architecturally required (e.g., separate test contexts).

### TSG.32.3.5 Deployment Layer Stacks

Tsingou pre-composes Layer stacks for deployment scenarios:

```typescript
// Full distributed deployment with NATS
export const IIoTRealtimeDistributed = pipe(
  IIoTRealtimeWsServer,
  Layer.provide(EventDistributionLive),
  Layer.provide(HolonetBridgeLayer),
  Layer.provide(NatsPubSubService.Default),
)

// Sparkplug adapter with KV-backed state
export const IIoTAdapterDistributed = (config: SparkplugAdapterConfig) =>
  pipe(
    SparkplugAdapterKVLive(config),
    Layer.provide(NatsKVService.Default),
  )
```

**Requirement LAY-4**: Each deployment topology MUST be expressed as a single pre-composed Layer stack. Application entry points MUST NOT perform ad-hoc Layer composition. All composition MUST be declared in deployment layer modules.

---

## TSG.32.4 Schema Discipline

### TSG.32.4.1 Schema<A, I, R>

The Effect Schema type [EFFECT-SCHEMA] describes a bidirectional transformation between:

- `A` — the domain type (what application code works with)
- `I` — the encoded type (what crosses system boundaries: JSON, wire format, database rows)
- `R` — requirements (services needed for transformation, typically `never`)

This bidirectional property enables a single Schema declaration to serve as:
1. Runtime validator (decode external data)
2. Serializer (encode for transmission)
3. Type definition (TypeScript type extraction)
4. JSON Schema generator (API documentation)

### TSG.32.4.2 Primitive Schema Patterns

| Pattern | Use Case | Example |
|---------|----------|---------|
| `Schema.String` | String values | Names, identifiers |
| `Schema.Number` | Numeric values | Measurements, counts |
| `Schema.Boolean` | Boolean flags | Feature toggles |
| `Schema.Literal('a', 'b', 'c')` | Enum/union values | Status, severity |
| `Schema.DateTimeUtc` | UTC timestamps | Event timestamps |
| `Schema.DateFromSelf` | JS Date objects | Database row dates |
| `Schema.NonEmptyString` | Non-empty strings | Required names |
| `Schema.NullOr(S)` | Nullable values | Optional database columns |

### TSG.32.4.3 Branded Types

Branded types prevent accidental mixing of structurally identical values [EFFECT-SCHEMA]:

```typescript
const AlarmId = Schema.String.pipe(Schema.brand('AlarmId'))
const DeviceId = Schema.String.pipe(Schema.brand('DeviceId'))
const SensorId = Schema.String.pipe(Schema.brand('SensorId'))
const SignalId = Schema.String.pipe(Schema.brand('SignalId'))
```

At runtime, branded types are plain strings. At compile time, TypeScript prevents passing an `AlarmId` where a `DeviceId` is expected.

**Requirement SCH-1**: All entity identifiers MUST be defined as branded Schema types. Raw `string` identifiers are prohibited for domain entities. The brand name MUST match the entity type name followed by "Id" (e.g., `AlarmId`, `DeviceId`, `SignalId`).

### TSG.32.4.4 Structured Domain Types

**TaggedStruct — Pure Data**:

```typescript
const AlarmEvent = Schema.TaggedStruct('AlarmEvent', {
  type: Schema.Literal('AlarmTriggered', 'AlarmAcknowledged', 'AlarmCleared'),
  alarmId: AlarmId,
  timestamp: Schema.DateTimeUtc,
  metadata: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
})
```

**TaggedClass — Data with Methods**:

```typescript
class Alarm extends Schema.TaggedClass<Alarm>()('Alarm', {
  id: AlarmId,
  deviceId: DeviceId,
  severity: AlarmSeverity,
  state: AlarmState,
  triggeredAt: Schema.DateTimeUtc,
  message: Schema.optional(Schema.String),
  acknowledgedAt: Schema.optional(Schema.DateTimeUtc),
  clearedAt: Schema.optional(Schema.DateTimeUtc),
}) {
  get isActive(): boolean {
    return this.state !== 'cleared'
  }
}
```

**Requirement SCH-2**: All domain entities MUST be defined as `Schema.TaggedStruct` or `Schema.TaggedClass`. Raw TypeScript `interface` or `type` definitions for domain models are prohibited within core packages.

**Requirement SCH-3**: Domain types that require prototype methods MUST use `Schema.TaggedClass`. Domain types that are pure data records SHOULD use `Schema.TaggedStruct`.

### TSG.32.4.5 Schema Transformations

For converting between encoded forms (database rows, wire format) and domain types:

```typescript
const AlarmFromRow = Schema.transformOrFail(
  AlarmRowSchema,              // Encoded: DB row shape
  Schema.typeSchema(Alarm),    // Type: Domain entity
  {
    strict: true,
    decode: (row, _, ast) =>
      ParseResult.try({
        try: () => new Alarm({
          id: row.id as AlarmId,
          deviceId: row.deviceId as DeviceId,
          severity: row.severity as AlarmSeverity,
          state: deriveAlarmState(row),
          triggeredAt: DateTime.unsafeFromDate(row.triggeredAt),
          message: row.message ?? undefined,
          acknowledgedAt: row.acknowledgedAt
            ? DateTime.unsafeFromDate(row.acknowledgedAt)
            : undefined,
          clearedAt: row.clearedAt
            ? DateTime.unsafeFromDate(row.clearedAt)
            : undefined,
        }),
        catch: (e) =>
          new ParseResult.Type(ast, row, `Decode failed: ${String(e)}`),
      }),
    encode: (alarm, _, ast) =>
      ParseResult.try({
        try: () => ({
          id: alarm.id,
          deviceId: alarm.deviceId,
          severity: alarm.severity,
          triggeredAt: DateTime.toDate(alarm.triggeredAt),
          acknowledgedAt: alarm.acknowledgedAt
            ? DateTime.toDate(alarm.acknowledgedAt) : null,
          clearedAt: alarm.clearedAt
            ? DateTime.toDate(alarm.clearedAt) : null,
          message: alarm.message ?? null,
        }),
        catch: (e) =>
          new ParseResult.Type(ast, alarm, `Encode failed: ${String(e)}`),
      }),
  }
)
```

**Requirement SCH-4**: All data crossing system boundaries (database, wire, external API) MUST pass through a Schema decode/encode transformation. Direct casting or manual parsing is prohibited.

**Requirement SCH-5**: Schema transformations between database rows and domain types MUST handle null-to-undefined conversion explicitly. Database nullability semantics (SQL NULL) MUST be mapped to TypeScript optionality (`T | undefined`) in the domain model.

### TSG.32.4.6 JSON Schema Generation

For API documentation and AI tool integration:

```typescript
import { JSONSchema } from 'effect'
import { jsonSchema } from 'ai'

const InputSchema = Schema.Struct({ name: Schema.String, severity: AlarmSeverity })
type Input = Schema.Schema.Type<typeof InputSchema>

const tool = tool({
  inputSchema: jsonSchema<Input>(
    JSONSchema.make(InputSchema) as Parameters<typeof jsonSchema>[0]
  ),
  execute: async (input: Input) => { /* ... */ }
})
```

**Requirement SCH-6**: AI SDK tool input schemas MUST be generated from Effect Schema via `JSONSchema.make()`. Manual JSON Schema construction and Zod schemas are prohibited for tools backed by Effect services.

### TSG.32.4.7 Literal and Union Schemas

Enumerated values use Schema.Literal for runtime validation:

```typescript
const AlarmSeverity = Schema.Literal('low', 'medium', 'high', 'critical')
type AlarmSeverity = Schema.Schema.Type<typeof AlarmSeverity>

const AlarmState = Schema.Literal('unacknowledged', 'acknowledged', 'cleared')
type AlarmState = Schema.Schema.Type<typeof AlarmState>
```

**Requirement SCH-7**: All enumerated domain values MUST be defined as `Schema.Literal`. Raw TypeScript union types (e.g., `type Status = 'a' | 'b'`) without Schema backing are prohibited for domain models.

---

## TSG.32.5 Error Handling Architecture

### TSG.32.5.1 Tagged Error Pattern

All domain errors in Tsingou extend `Data.TaggedError` for internal use or `Schema.TaggedError` for serialization across RPC boundaries [EFFECT-ERRORS]:

**Internal errors (service-local)**:

```typescript
class AlarmNotFoundError extends Data.TaggedError('AlarmNotFoundError')<{
  readonly alarmId: string
}> {}

class AlarmAlreadyAcknowledgedError extends Data.TaggedError(
  'AlarmAlreadyAcknowledgedError'
)<{
  readonly alarmId: string
}> {}
```

**RPC errors (cross-boundary)**:

```typescript
class RpcAlarmNotFoundError extends Schema.TaggedError<RpcAlarmNotFoundError>()(
  'RpcAlarmNotFoundError',
  { alarmId: AlarmId }
) {}
```

The `Schema.TaggedError` variant adds Schema-based serialization, enabling errors to cross RPC boundaries with type safety.

**Requirement ERR-1**: All expected domain errors MUST extend `Data.TaggedError` or `Schema.TaggedError`. Raw `Error`, `throw`, and `try/catch` are prohibited for domain error handling in core packages.

**Requirement ERR-2**: Errors that cross RPC boundaries MUST use `Schema.TaggedError` with Schema-backed fields. Internal errors that remain within a service boundary MAY use `Data.TaggedError`.

### TSG.32.5.2 Error Channel Composition

The error channel composes through union types. Each operation that can fail adds its error type to the union:

```typescript
// Single operation: Effect<Alarm, AlarmNotFoundError>
const getAlarm = alarmService.getById(id)

// Composed: Effect<Result, AlarmNotFoundError | SensorNotFoundError>
const combined = Effect.gen(function* () {
  const alarm = yield* alarmService.getById(alarmId)
  const sensor = yield* sensorService.getById(alarm.deviceId)
  return { alarm, sensor }
})
```

### TSG.32.5.3 Discriminated Recovery

The `_tag` field on tagged errors enables precise, compile-time-verified error recovery:

```typescript
const recovered = risky.pipe(
  // Handle specific error — removes it from error union
  Effect.catchTag('AlarmNotFoundError', (e) =>
    Effect.succeed(defaultAlarm(e.alarmId))
  ),
  // Handle multiple errors — removes all from error union
  Effect.catchTags({
    AlarmAlreadyAcknowledgedError: (e) =>
      Effect.logWarning(`Already acked: ${e.alarmId}`).pipe(
        Effect.zipRight(Effect.succeed(currentState))
      ),
    AlarmAlreadyClearedError: (e) =>
      Effect.logWarning(`Already cleared: ${e.alarmId}`).pipe(
        Effect.zipRight(Effect.succeed(currentState))
      ),
  }),
)
```

Each `catchTag` call narrows the error channel at the type level. After handling all error variants, the error channel reduces to `never`, proving exhaustive handling.

**Requirement ERR-3**: Error recovery MUST use `Effect.catchTag` or `Effect.catchTags` for discriminated handling. Generic `Effect.catchAll` SHOULD be used only at system boundaries where all errors are logged and converted to HTTP status codes or user-facing messages.

**Requirement ERR-4**: The error tag string MUST match the class name exactly. Implementations MUST NOT use abbreviated, aliased, or numeric error tags.

### TSG.32.5.4 Error Mapping at Boundaries

Services map internal errors to boundary-appropriate errors when crossing architectural boundaries:

```typescript
// Machine error → RPC error mapping at entity boundary
actor.send(new InternalAcknowledgeAlarm({ ... })).pipe(
  Effect.catchTags({
    MachineAlarmNotFoundError: (e) =>
      Effect.fail(new RpcAlarmNotFoundError({ alarmId: e.alarmId as AlarmId })),
    MachineInvalidTransitionError: (e) =>
      Effect.fail(new RpcAlarmAlreadyAcknowledgedError({ alarmId: e.alarmId as AlarmId })),
  }),
)
```

**Requirement ERR-5**: Error mapping MUST occur at service tier boundaries. L2 internal errors MUST be mapped to RPC-appropriate errors before crossing entity boundaries. Internal implementation error types MUST NOT leak through public service interfaces.

### TSG.32.5.5 Error Logging at Boundaries

```typescript
Effect.tapError((e) =>
  Effect.logWarning(`Acknowledge: ${e._tag} for alarm ${envelope.payload.alarmId}`)
)
```

**Requirement ERR-6**: All error recovery and mapping SHOULD include structured logging via `Effect.tapError` or `Effect.annotateLogs`. Error logs MUST include the error tag, relevant entity identifiers, and the operation context.

### TSG.32.5.6 Defects vs. Expected Errors

| Category | Mechanism | Examples | Recovery |
|----------|-----------|----------|----------|
| **Expected error** | `Effect.fail(taggedError)` | Entity not found, invalid transition, parse failure | `catchTag`, `catchTags` |
| **Defect** | `Effect.die(error)` | Null pointer, invariant violation, unhandled promise rejection | `Effect.catchAllDefect` (top-level only) |
| **Interruption** | `Fiber.interrupt`, scope closure | Timeout, cancellation, shutdown | `Effect.onInterrupt` |

**Requirement ERR-7**: Implementations MUST classify all failure modes into expected errors or defects. Recoverable conditions MUST use `Effect.fail`. Programming errors and invariant violations MUST use `Effect.die`. Ambiguous classification defaults to expected error.

---

## TSG.32.6 Structured Concurrency

### TSG.32.6.1 Fiber Model

Effect implements structured concurrency through fibers — lightweight virtual threads managed by the Effect runtime [EFFECT-FIBERS]. Fibers are cheaper than OS threads and cheaper than JavaScript microtasks.

Properties:
- **Cooperative scheduling**: Fibers yield at effect boundaries, not at arbitrary points.
- **Parent-child hierarchy**: Forked fibers form a tree with well-defined supervision.
- **Interruption safety**: Interruption propagates through the fiber tree.
- **Resource safety**: Fiber cleanup is guaranteed through finalizers.

### TSG.32.6.2 Fork Variants

| Fork Variant | Lifetime | Supervision | Use Case |
|-------------|----------|-------------|----------|
| `Effect.fork` | Parent scope | Auto-interrupted on parent exit | Short-lived concurrent work |
| `Effect.forkScoped` | Explicit Scope | Interrupted on scope close | Service-scoped background workers |
| `Effect.forkDaemon` | Global | Outlives parent | Application-level background processes |
| `Effect.forkIn(scope)` | Explicit parameter | Interrupted on specified scope close | Manual lifetime control |

**Requirement CON-1**: Background processing fibers MUST use `Effect.forkScoped` tied to the service's construction scope. `Effect.forkDaemon` MUST be used only for fibers that must survive service restarts (e.g., health check monitors).

**Requirement CON-2**: All forked fibers MUST be supervised. Unsupervised fibers (created by directly interacting with the runtime without Effect's fork primitives) are prohibited.

### TSG.32.6.3 Supervision Guarantees

Structured concurrency in Effect provides four invariants:

1. **No orphaned fibers**: Every fiber has a parent in the supervision tree. When the root fiber exits, all descendant fibers are interrupted.
2. **Parent awaits children**: A parent fiber using `Effect.fork` (not daemon) cannot complete until all child fibers complete.
3. **Interruption propagation**: Interrupting a parent interrupts all children. Children can catch interruption via `Effect.onInterrupt`.
4. **Error propagation**: Child fiber failure propagates to parent unless explicitly caught. The parent's error channel accumulates child errors.

**Requirement CON-3**: Implementations MUST NOT catch and suppress fiber interruption within service code. Interruption indicates that the computation is no longer needed and resources should be released.

### TSG.32.6.4 Concurrent Data Structures

**Queue** — Point-to-point work distribution [EFFECT-QUEUE]:

```typescript
const queue = yield* Queue.bounded<SensorReading>(1024) // Power-of-2 for RingBuffer

// Producer
yield* Queue.offer(queue, reading) // Suspends when full (backpressure)

// Consumer
const reading = yield* Queue.take(queue) // Suspends when empty
```

**PubSub** — Broadcast messaging [EFFECT-PUBSUB]:

```typescript
const pubsub = yield* PubSub.bounded<AlarmEvent>(256)

// Publisher
yield* PubSub.publish(pubsub, event) // All subscribers receive

// Subscriber (returns a Dequeue)
const sub = yield* PubSub.subscribe(pubsub)
const event = yield* Queue.take(sub)
```

| Structure | Delivery | Backpressure | Use Case |
|-----------|----------|-------------|----------|
| `Queue.bounded(n)` | Single consumer | Suspends on full | Work distribution, pipeline stages |
| `Queue.unbounded` | Single consumer | None | Low-volume, latency-sensitive |
| `Queue.dropping(n)` | Single consumer | Drops oldest | Telemetry sampling |
| `Queue.sliding(n)` | Single consumer | Drops newest | UI update throttling |
| `PubSub.bounded(n)` | All subscribers | Suspends on full | Event broadcasting |
| `PubSub.unbounded` | All subscribers | None | Low-volume events |

**Requirement CON-4**: Bounded queues SHOULD use power-of-2 capacities for RingBuffer optimization. The capacity MUST be documented with rationale (e.g., "1024: expected burst size times 2x headroom").

**Requirement CON-5**: PubSub MUST be used for event distribution where multiple consumers need the same data. Queue MUST be used for work distribution where each item should be processed by exactly one consumer.

### TSG.32.6.5 Concurrency Combinators

```typescript
// Parallel execution — all must succeed
const [users, alarms, sensors] = yield* Effect.all(
  [fetchUsers, fetchAlarms, fetchSensors],
  { concurrency: 'unbounded' }
)

// Parallel with bounded concurrency
yield* Effect.forEach(
  entityIds,
  (id) => processEntity(id),
  { concurrency: 10 }
)

// Race — first to succeed wins
const result = yield* Effect.race(primaryPath, fallbackPath)

// Timeout
const result = yield* longOperation.pipe(
  Effect.timeout(Duration.seconds(30))
)
```

**Requirement CON-6**: Concurrent operations over collections MUST specify explicit concurrency bounds via `{ concurrency: N }`. Unbounded concurrency (`'unbounded'`) MUST be justified with documentation explaining why the workload is bounded externally.

---

## TSG.32.7 Resource Management

### TSG.32.7.1 Scope

The `Scope` type represents the lifetime of one or more resources [EFFECT-SCOPE]. When a scope closes, all registered finalizers execute in LIFO (last-in, first-out) order, ensuring resources are released in reverse acquisition order.

### TSG.32.7.2 acquireRelease Pattern

```typescript
const dbConnection = Effect.acquireRelease(
  PgClient.connect(config),                     // Acquire
  (conn) => conn.close().pipe(Effect.orDie)      // Release (always runs)
)
```

The release function receives the acquired resource and MUST return `Effect<void>`. It executes regardless of whether the using effect succeeds, fails, or is interrupted.

### TSG.32.7.3 addFinalizer in Service Construction

```typescript
const service = Effect.gen(function* () {
  const conn = yield* PgClient.connect(config)
  yield* Effect.addFinalizer((exit) =>
    Effect.gen(function* () {
      yield* Effect.log(`Service shutting down: ${exit._tag}`)
      yield* conn.close()
    })
  )
  return { query: (sql: string) => conn.query(sql) }
})
```

**Requirement RES-1**: Every resource acquisition (connections, file handles, subscriptions, timers) MUST have a corresponding release registered via `Effect.acquireRelease` or `Effect.addFinalizer`. Missing finalizers are treated as defects.

**Requirement RES-2**: Finalizers MUST be idempotent. Calling a finalizer multiple times MUST produce the same result as calling it once. This ensures safety during error recovery and retry scenarios.

**Requirement RES-3**: Finalizers MUST NOT throw exceptions. If a finalizer can fail, it MUST use `Effect.orDie` or `Effect.ignore` to ensure the finalizer chain continues regardless of individual failures.

### TSG.32.7.4 Layer Resource Lifecycle

Layers constructed via `Layer.scoped` or `Layer.effect` (with `Effect.addFinalizer`) participate in the scope's resource lifecycle:

```
Application Scope Created
  ├── L1: PgClient acquired (connection pool opened)
  ├── L1: NatsClient acquired (connection established)
  ├── L2: AlarmService constructed (uses PgClient)
  ├── L2: SensorService constructed (uses PgClient)
  └── L3: IIoTService constructed (uses L2 services)

Application Scope Closed
  ├── L3: IIoTService finalizer runs
  ├── L2: SensorService finalizer runs
  ├── L2: AlarmService finalizer runs
  ├── L1: NatsClient finalizer runs (connection closed)
  └── L1: PgClient finalizer runs (pool drained and closed)
```

Teardown order is guaranteed: LIFO reverse of construction order.

---

## TSG.32.8 Stream Processing Pipeline

### TSG.32.8.1 Stream<A, E, R>

`Stream<A, E, R>` represents a lazy, potentially infinite sequence of values [EFFECT-STREAM]. Streams are the primary abstraction for signal processing in Tsingou.

Properties:

| Property | Description | Consequence |
|----------|-------------|-------------|
| **Pull-based** | Consumer drives emission | Natural backpressure without explicit signals |
| **Chunked** | Values batched in `Chunk<A>` | Amortized allocation cost, vectorizable |
| **Composable** | Same algebra as Effect | Service dependencies flow through stream operators |
| **Resource-safe** | Integrates with Scope | Cleanup guaranteed on completion, failure, or interruption |
| **Lazy** | No work until consumed | Safe to compose pipelines before execution |

### TSG.32.8.2 Stream Creation Patterns

**From Effect (single value)**:

```typescript
const latest = Stream.fromEffect(fetchLatestReading(sensorId))
```

**From iterable**:

```typescript
const historical = Stream.fromIterable(cachedReadings)
```

**From callback bridge (external push sources)**:

```typescript
const sdrStream = Stream.async<IQSample, SDRError>((emit) => {
  const handler = (sample: IQSample) =>
    emit(Effect.succeed(Chunk.of(sample)))
  sdrDevice.on('data', handler)
  // Return cleanup effect
  return Effect.sync(() => sdrDevice.off('data', handler))
})
```

**From PubSub**:

```typescript
const alarmStream = Stream.fromPubSub(alarmPubSub)
```

**Async with scoped resources**:

```typescript
const fileStream = Stream.asyncScoped<Line, IOError>((emit) =>
  Effect.gen(function* () {
    const file = yield* openFile(path)
    yield* Effect.addFinalizer(() => file.close())
    const reader = file.lines()
    reader.on('line', (line) => emit(Effect.succeed(Chunk.of(line))))
    reader.on('end', () => emit(Effect.fail(Option.none())))
  })
)
```

**Requirement STR-1**: External data sources (SDR hardware, network feeds, NATS subscriptions) MUST be integrated via `Stream.async` or `Stream.asyncScoped`. Direct callback registration without Stream wrapping is prohibited for data sources that produce sequences of values.

### TSG.32.8.3 Stream Transformation Operators

| Category | Operators | Purpose |
|----------|-----------|---------|
| **Mapping** | `map`, `mapEffect`, `mapChunks` | Transform values |
| **Filtering** | `filter`, `filterEffect` | Remove values |
| **Flattening** | `flatMap`, `flatten` | Nested stream composition |
| **Aggregation** | `scan`, `aggregate`, `fold` | Accumulate state |
| **Windowing** | `groupedWithin`, `debounce`, `throttle` | Time/count-based batching |
| **Error** | `catchAll`, `retry`, `orElse` | Error recovery |
| **Resource** | `scoped`, `acquireRelease` | Resource lifecycle |
| **Context** | `provideLayer`, `provideService` | Dependency injection |
| **Utility** | `tap`, `tapEffect`, `take`, `drop` | Side effects, limiting |

### TSG.32.8.4 Signal Processing Pipeline Pattern

The canonical Tsingou signal processing pipeline:

```typescript
const signalPipeline = (config: PipelineConfig) =>
  sourceStream(config.source).pipe(           // 1. Ingest
    Stream.map(validateSignal),                // 2. Validate
    Stream.filter(matchesFilter(config.filter)), // 3. Filter
    Stream.mapEffect(enrichSignal),            // 4. Enrich
    Stream.groupedWithin(100, Duration.millis(50)), // 5. Batch
    Stream.mapChunks(deduplicateChunk),        // 6. Deduplicate
    Stream.mapEffect((chunk) =>
      Effect.forEach(chunk, routeSignal, { concurrency: 4 })
    ),                                         // 7. Route
    Stream.tap(emitTelemetry),                 // 8. Observe
    Stream.provideLayer(PipelineServicesLive), // 9. Wire dependencies
  )
```

**Requirement STR-2**: Signal processing pipelines MUST be composed as Stream transformation chains. Each pipeline stage MUST be a pure function or Effect-returning function. Mutable pipeline state is prohibited.

**Requirement STR-3**: `Stream.provideLayer` MUST be called BEFORE `Stream.toAsyncIterable` or any other stream termination operation that removes the `R` type parameter. The async iterable interface cannot carry requirement types.

### TSG.32.8.5 Backpressure Model

Streams are pull-based: the consumer's `take` rate governs the producer's `emit` rate. When a consumer is slow:

1. Downstream `take` suspends until consumer is ready
2. Upstream `emit` suspends because downstream buffer is full
3. Producer naturally throttles without explicit backpressure signals

For cases where backpressure propagation is undesirable (e.g., real-time telemetry where old data is less valuable than new data):

```typescript
// Drop old values when buffer is full
const sliding = stream.pipe(Stream.buffer({ capacity: 256, strategy: 'sliding' }))

// Drop new values when buffer is full
const dropping = stream.pipe(Stream.buffer({ capacity: 256, strategy: 'dropping' }))
```

**Requirement STR-4**: Streams consuming unbounded external sources (SDR, network feeds) MUST specify a buffering strategy. Unbuffered consumption of high-throughput sources risks memory exhaustion.

### TSG.32.8.6 Stream-to-AsyncIterable Bridge

For integration with non-Effect consumers (React components, AI SDK tools):

```typescript
async function* streamSignals(config: StreamConfig) {
  const stream = createSignalStream(config).pipe(
    Stream.map(processSignal),
    Stream.filter(isRelevant),
    Stream.provideLayer(SignalServiceLive),  // R = never
  )
  const iter = Stream.toAsyncIterable(stream)
  for await (const signal of iter) {
    yield signal
  }
}
```

**Requirement STR-5**: Implementations bridging to async iterables MUST ensure `R = never` before calling `Stream.toAsyncIterable`. This is verified at compile time; type assertions to bypass this check are prohibited.

---

## TSG.32.9 RPC and Entity System

### TSG.32.9.1 RPC Definition

RPCs in Effect are defined with Schema types for payload, success, and error [EFFECT-RPC]:

```typescript
class CreateAlarmRpc extends Rpc.make('Alarm.Create', {
  payload: CreateAlarmParams,
  primaryKey: ({ deviceId }) => deviceId,
  success: Alarm,
  error: RpcQueryError,
}) {}
```

| Field | Type | Purpose |
|-------|------|---------|
| `tag` | `string` | Unique RPC identifier, dot-namespaced |
| `payload` | `Schema` | Request schema (validates incoming data) |
| `primaryKey` | `(payload) => string` | Entity routing key for cluster sharding |
| `success` | `Schema` | Response schema (validates outgoing data) |
| `error` | `Schema` | Error schema (serializable error types) |

**Requirement RPC-1**: All RPC definitions MUST use `Rpc.make` with Schema-typed payload, success, and error fields. Manual protocol implementations without Schema validation are prohibited.

**Requirement RPC-2**: RPC tags MUST follow the convention `{EntityType}.{Operation}`. Examples: `Alarm.Create`, `Sensor.GetReadings`, `WorkOrder.Assign`.

### TSG.32.9.2 RPC Groups

Related RPCs compose into groups for bulk registration:

```typescript
export const AlarmRpcs = RpcGroup.make(
  CreateAlarmRpc,
  GetAlarmRpc,
  AcknowledgeAlarmRpc,
  ClearAlarmRpc,
)
```

### TSG.32.9.3 Entity Definition

Entities combine RPC definitions with cluster-distributed actor semantics [EFFECT-CLUSTER]:

```typescript
export const AlarmEntity = Entity.make('Alarm', [
  CreateAlarmRpc,
  GetAlarmRpc,
  AcknowledgeAlarmRpc,
  ClearAlarmRpc,
])
```

An entity is a distributed actor:
- **Keyed**: Each instance identified by a primary key (e.g., `alarmId`)
- **Serial**: Messages delivered one at a time via mailbox
- **Sharded**: Distributed across cluster nodes by consistent hashing
- **Lifecycle-managed**: Created on first message, passivated on idle

### TSG.32.9.4 Entity Handler Implementation

```typescript
export const AlarmEntityHandlers = AlarmEntity.toLayer(
  Effect.gen(function* () {
    // Port injection — services required by handler
    const state = yield* AlarmState
    const flags = yield* IIoTFeatureFlags

    // Machine boot — internal state machine
    const alarmMachine = makeAlarmMachine({ state, flags })
    const actor = yield* Machine.boot(alarmMachine)

    // Handler delegation — each RPC delegates to machine
    return AlarmEntity.of({
      'Alarm.Create': (envelope) =>
        actor.send(new InternalCreateAlarm({ params: envelope.payload })).pipe(
          Effect.catchTag('MachineCreateError', mapToRpcError)
        ),
      'Alarm.Get': (envelope) =>
        actor.send(new InternalGetAlarm({ alarmId: envelope.payload.alarmId })).pipe(
          Effect.catchTag('MachineAlarmNotFoundError', mapToRpcNotFound)
        ),
      'Alarm.Acknowledge': (envelope) =>
        actor.send(new InternalAcknowledgeAlarm({ ... })).pipe(
          Effect.catchTags({
            MachineAlarmNotFoundError: mapToRpcNotFound,
            MachineInvalidTransitionError: mapToRpcAlreadyAcked,
          })
        ),
      'Alarm.Clear': (envelope) =>
        actor.send(new InternalClearAlarm({ ... })).pipe(
          Effect.catchTags({
            MachineAlarmNotFoundError: mapToRpcNotFound,
            MachineInvalidTransitionError: mapToRpcAlreadyCleared,
          })
        ),
    })
  })
)
```

**Requirement RPC-3**: Entity handlers MUST delegate to Machine actors for state management. Direct state manipulation in handlers is prohibited.

**Requirement RPC-4**: Entity handlers MUST map internal machine errors to RPC-appropriate errors. Internal error types MUST NOT appear in the RPC error channel.

### TSG.32.9.5 RPC Server Layer Composition

The RPC server is composed from three layers: handler implementation, protocol transport, and serialization format:

```typescript
// 1. Core: Combine all entity RPCs with their handlers
const RpcServerCore = RpcServer.layer(IIoTRpcs).pipe(
  Layer.provide(EntityRpcHandlers),
)

// 2. Protocol + Serialization
export const IIoTRpcNdjson = Layer.mergeAll(
  RpcServerCore,
  RpcServer.layerProtocolHttpRouter({ path: '/rpc' }),
  RpcSerialization.layerNdjson,
)

export const IIoTRpcMsgPack = Layer.mergeAll(
  RpcServerCore,
  RpcServer.layerProtocolHttpRouter({ path: '/rpc' }),
  RpcSerialization.layerMsgPack,
)
```

**Requirement RPC-5**: RPC server deployment MUST compose protocol and serialization as separate layers. Hardcoded serialization formats within handler implementations are prohibited.

### TSG.32.9.6 Serialization Formats

| Format | Layer | Wire Format | Use Case |
|--------|-------|-------------|----------|
| NDJSON | `RpcSerialization.layerNdjson` | Newline-delimited JSON | Development, debugging |
| MsgPack | `RpcSerialization.layerMsgPack` | Binary MessagePack | Production throughput |
| JSON | `RpcSerialization.layerJson` | Standard JSON | Browser WebSocket clients |

**Requirement RPC-6**: Production deployments SHOULD use MsgPack serialization for throughput-critical paths. Development deployments SHOULD use NDJSON for human-readable debugging. Browser-facing WebSocket endpoints MUST use JSON serialization.

### TSG.32.9.7 WebSocket RPC Protocol

For real-time streaming RPCs:

```typescript
export const IIoTRealtimeWsServer = Layer.mergeAll(
  RpcServerCore,
  RpcServer.layerProtocolWebsocketRouter({ path: '/ws/iiot' }),
  RpcSerialization.layerJson,
)
```

WebSocket RPCs support:
- Bidirectional streaming (server push + client requests)
- Automatic reconnection at the transport layer
- Schema-validated messages in both directions

**Requirement RPC-7**: Real-time data subscriptions MUST use WebSocket protocol. HTTP polling for real-time data is prohibited.

### TSG.32.9.8 RPC Client Generation

RPC clients are automatically generated from RPC group definitions:

```typescript
const client = yield* RpcClient.make(IIoTRpcs)
const alarm = yield* client.Alarm.Create({ deviceId, severity, message })
const retrieved = yield* client.Alarm.Get({ alarmId: alarm.id })
```

Dotted RPC tags create nested client objects: `Alarm.Create` becomes `client.Alarm.Create()`.

**Requirement RPC-8**: Client-side RPC invocation MUST use generated clients from `RpcClient.make`. Manual HTTP request construction for RPC endpoints is prohibited.

---

## TSG.32.10 Atom-as-State Reactive Bridge

### TSG.32.10.1 Motivation

The Atom-as-State pattern bridges Effect services and React components through reactive state containers [EFFECT-ATOM]. This eliminates:

- `useState` + `useEffect` synchronization bugs
- Stale closure references in callbacks
- Prop drilling through component hierarchies
- Manual subscription management

### TSG.32.10.2 Atom.make()

Atoms are reactive state containers:

```typescript
export const alarmCountAtom = Atom.make(0)
export const activeAlarmsAtom = Atom.make<Alarm[]>([])
export const statusAtom = Atom.make<'idle' | 'loading' | 'error'>('idle')
```

**Requirement ATM-1**: Atoms MUST be defined at module level. Creating atoms inside React component bodies is prohibited — component re-renders recreate the atom, breaking identity and subscription tracking.

**Requirement ATM-2**: Atoms that cross component boundaries MUST replace `useState`. Component-local `useState` is permitted only for ephemeral UI state (hover, focus, toggle) that has no external consumers.

### TSG.32.10.3 Service Mutation via ctx.set()

Services mutate atoms through the context parameter, not through React setters:

```typescript
export const ops = {
  search: runtimeAtom.fn<Query>()((query, ctx) =>
    Effect.gen(function* () {
      ctx.set(statusAtom, 'loading')
      const service = yield* SearchService
      const results = yield* service.search(query)
      ctx.set(resultsAtom, results)
      ctx.set(statusAtom, 'idle')
      return results
    }).pipe(
      Effect.catchAll((e) => {
        ctx.set(statusAtom, 'error')
        ctx.set(errorAtom, e)
        return Effect.fail(e)
      })
    )
  ),
}
```

**Requirement ATM-3**: Service operations that update UI state MUST use `ctx.set()` on module-level atoms. Returning state values for `setState` callbacks is prohibited.

### TSG.32.10.4 React Subscription

```typescript
function AlarmDashboard() {
  const count = useAtomValue(alarmCountAtom)       // Re-renders on change
  const alarms = useAtomValue(activeAlarmsAtom)    // Re-renders on change
  const status = useAtomValue(statusAtom)           // Re-renders on change

  return (
    <div>
      <Badge>{count}</Badge>
      {status === 'loading' && <Spinner />}
      <AlarmList alarms={alarms} />
    </div>
  )
}
```

**Requirement ATM-4**: React components MUST subscribe to atoms via `useAtomValue` (read-only) or `useAtom` (read-write). Direct Effect execution in React event handlers SHOULD be avoided in favor of operation atoms.

### TSG.32.10.5 Derived Atoms

Derived atoms compute values from other atoms:

```typescript
const criticalAlarmCount = Atom.family(
  activeAlarmsAtom,
  (alarms) => alarms.filter((a) => a.severity === 'critical').length
)

const hasActiveAlarms = Atom.family(
  activeAlarmsAtom,
  (alarms) => alarms.length > 0
)
```

**Requirement ATM-5**: Derived values MUST use `Atom.family` or derived atom patterns. Computing derived values via `useMemo` that depends on atom values is prohibited — it couples derivation to React's render cycle rather than the atom's update cycle.

### TSG.32.10.6 Atom.runtime()

Service-scoped atoms with runtime lifecycle:

```typescript
const runtimeAtom = Atom.runtime().pipe(
  Atom.provide(AlarmServiceLive),
  Atom.provide(NatsClientLive),
)
```

This creates a runtime that:
1. Constructs required services on first use
2. Shares services across all operations within the runtime
3. Disposes services when the runtime is disposed (component unmount or scope close)

**Requirement ATM-6**: Service-backed operations MUST use `Atom.runtime()` with explicit Layer provision. Operations MUST NOT access services through ambient imports or global singletons.

### TSG.32.10.7 Registry Pattern

```typescript
// Module-level registry
export const myRegistry = Registry.make()

// Sync mutations in React callbacks
registry.set(atom, value)      // Synchronous, no Effect required
const val = registry.get(atom) // Synchronous read

// In Effect context
yield* Atom.set(atom, value)   // Effect context handles AtomRegistry
```

**Requirement ATM-7**: `Atom.set()` (Effect) and `registry.set()` (synchronous) MUST NOT be confused. `Atom.set()` returns an `Effect` and MUST be used in `Effect.gen` contexts. `registry.set()` is synchronous and MUST be used in React callbacks.

---

## TSG.32.11 Configuration Management

### TSG.32.11.1 Config Module

Effect's `Config` module provides typed, validated configuration [EFFECT]:

```typescript
const dbConfig = Effect.all({
  host: Config.string('DB_HOST'),
  port: Config.integer('DB_PORT').pipe(Config.withDefault(5432)),
  database: Config.string('DB_NAME'),
  ssl: Config.boolean('DB_SSL').pipe(Config.withDefault(false)),
})
```

### TSG.32.11.2 Config-Backed Layers

Feature flags combine `Config` with `Layer`:

```typescript
const featureFlagsConfig = Effect.all({
  alarmEventSourcingEnabled: Config.boolean('ES_ALARM_ENABLED').pipe(
    Config.withDefault(false)
  ),
  equipmentStateEventSourcingEnabled: Config.boolean('ES_EQUIPMENT_STATE_ENABLED').pipe(
    Config.withDefault(false)
  ),
  workOrderEventSourcingEnabled: Config.boolean('ES_WORK_ORDER_ENABLED').pipe(
    Config.withDefault(false)
  ),
})

export const IIoTFeatureFlagsEnvLayer: Layer.Layer<IIoTFeatureFlags> =
  Layer.effect(
    IIoTFeatureFlags,
    featureFlagsConfig.pipe(
      Effect.orElseSucceed(() => IIoTFeatureFlagsDefault)
    )
  )
```

### TSG.32.11.3 Configuration Layer Variants

| Variant | Use Case | Example |
|---------|----------|---------|
| `Layer.succeed(Tag, value)` | Static config (tests) | Feature flags all disabled |
| `Layer.effect(Tag, configEffect)` | Environment-derived | Read from env vars |
| `Config.withDefault(value)` | Fallback for missing | Default port, default mode |
| `makeConfigLayer(overrides)` | Partial override | Test-specific flag overrides |

**Requirement CFG-1**: All runtime configuration MUST flow through `Config` and `Layer`. Environment variable access via `process.env` is prohibited within core packages. All configuration MUST have typed defaults.

**Requirement CFG-2**: Configuration layers MUST provide graceful fallback via `Effect.orElseSucceed` or `Config.withDefault`. Missing configuration MUST NOT crash the application at startup.

**Requirement CFG-3**: Test configurations MUST use `Layer.succeed(Tag, testValue)` for deterministic, reproducible test behavior. Tests MUST NOT depend on environment variables.

### TSG.32.11.4 Feature Flag Architecture

Feature flags enable gradual migration from legacy CRUD to event sourcing:

```typescript
export class IIoTFeatureFlags extends Context.Tag('IIoTFeatureFlags')<
  IIoTFeatureFlags,
  FeatureFlagsShape
>() {}

// Runtime check in service code
const program = Effect.gen(function* () {
  const flags = yield* IIoTFeatureFlags
  if (flags.alarmEventSourcingEnabled) {
    yield* eventLog.write('AlarmTriggered', payload)
  } else {
    yield* alarmRepo.insert(alarm) // Legacy CRUD
  }
})
```

**Requirement CFG-4**: Feature flags MUST be typed service dependencies, not global booleans. Feature flag access MUST go through `yield* IIoTFeatureFlags` within Effect.gen.

---

## TSG.32.12 Runtime and React Integration

### TSG.32.12.1 ManagedRuntime

For React applications where Effect is not the entry point, `ManagedRuntime` provides the bridge [EFFECT-RUNTIME]:

```typescript
const runtime = ManagedRuntime.make(
  Layer.mergeAll(
    AlarmServiceLive,
    SensorServiceLive,
    NatsClientLive,
    EventDistributionLive,
  )
)
```

`ManagedRuntime`:
- Lazily constructs all services from the provided Layer
- Memoizes services within the runtime's scope
- Provides `runtime.runPromise`, `runtime.runSync` for effect execution
- Provides `runtime.dispose()` for cleanup

### TSG.32.12.2 React Provider Pattern

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

**Requirement RUN-1**: React applications MUST use `ManagedRuntime` for Effect service integration. Direct `Effect.runPromise` calls without a runtime context are prohibited for operations requiring service dependencies.

**Requirement RUN-2**: `ManagedRuntime.dispose()` MUST be called on application unmount. The dispose call MUST be registered in the React component's cleanup effect (`useEffect` return).

### TSG.32.12.3 RegistryProvider

The `RegistryProvider` component bridges Effect's AtomRegistry with React's component tree:

```typescript
<RegistryProvider runtime={runtime}>
  {/* All children can use useAtomValue, useAtom */}
  <AlarmDashboard />
  <SensorPanel />
</RegistryProvider>
```

**Requirement RUN-3**: The `RegistryProvider` MUST wrap all components that use atom hooks (`useAtomValue`, `useAtom`). Using atom hooks outside a `RegistryProvider` produces undefined behavior.

### TSG.32.12.4 Runtime Execution Patterns

```typescript
// In React event handler — fire-and-forget
const handleClick = useCallback(() => {
  runtime.runPromise(
    AlarmService.pipe(
      Effect.flatMap((svc) => svc.acknowledge(alarmId))
    )
  )
}, [runtime, alarmId])

// In React event handler — with result
const handleSearch = useCallback(async () => {
  const results = await runtime.runPromise(
    SearchService.pipe(
      Effect.flatMap((svc) => svc.search(query))
    )
  )
  // results available here
}, [runtime, query])
```

**Requirement RUN-4**: Effect execution in React event handlers SHOULD use operation atoms (`runtimeAtom.fn`) rather than direct `runtime.runPromise`. Direct execution is permitted for one-off operations that do not update reactive state.

---

## TSG.32.13 Testing Architecture

### TSG.32.13.1 @effect/vitest Integration

Effect services are tested using `@effect/vitest` [EFFECT]:

```typescript
import { it } from '@effect/vitest'

it.effect('should create alarm with correct state', () =>
  Effect.gen(function* () {
    const svc = yield* AlarmService
    const alarm = yield* svc.create({
      deviceId: 'device-001' as DeviceId,
      alarmType: 'temperature_high' as AlarmType,
      severity: 'high' as AlarmSeverity,
    })
    expect(alarm.state).toBe('unacknowledged')
    expect(alarm.severity).toBe('high')
  }).pipe(Effect.provide(AlarmService.Default))
)
```

### TSG.32.13.2 Test Layer Substitution

Production layers are replaced with test doubles:

```typescript
const InMemoryStateServices = Layer.mergeAll(
  AlarmState.InMemory,
  SensorState.InMemory,
  EquipmentState.InMemory,
)

const TestStack = AlarmEntityHandlers.pipe(
  Layer.provide(InMemoryStateServices),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
)
```

**Requirement TST-1**: Test suites MUST use Layer substitution for dependency isolation. Mocking via jest.mock, vi.mock, or monkey-patching is prohibited for Effect service dependencies.

**Requirement TST-2**: All service layers MUST provide an in-memory test variant (e.g., `AlarmState.InMemory`). If an in-memory variant is infeasible, a documented justification MUST be provided.

### TSG.32.13.3 PubSub Testing Caveat

`it.effect()` and `it.scoped()` timeout when used with `PubSub + Stream.fromPubSub + Effect.fork` combinations. This is a known interaction between `@effect/vitest`'s scope management and PubSub's subscription lifecycle.

**Workaround**:

```typescript
// DOES NOT WORK with it.effect():
it.effect('pubsub roundtrip', () =>
  Effect.gen(function* () {
    const pubsub = yield* PubSub.bounded<string>(16)
    const fiber = yield* Stream.fromPubSub(pubsub).pipe(
      Stream.take(1),
      Stream.runCollect,
      Effect.fork
    )
    yield* PubSub.publish(pubsub, 'hello')
    const result = yield* Fiber.join(fiber) // HANGS
  })
)

// WORKS with plain it() + runPromise:
it('pubsub roundtrip', async () => {
  await Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const pubsub = yield* PubSub.bounded<string>(16)
        const fiber = yield* Stream.fromPubSub(pubsub).pipe(
          Stream.take(1),
          Stream.runCollect,
          Effect.fork
        )
        yield* PubSub.publish(pubsub, 'hello')
        const result = yield* Fiber.join(fiber)
        expect(Chunk.toReadonlyArray(result)).toEqual(['hello'])
      })
    )
  )
})
```

**Requirement TST-3**: PubSub roundtrip tests MUST use plain vitest `it()` with `Effect.runPromise(Effect.scoped(...))`. `it.effect()` and `it.scoped()` MUST NOT be used for tests involving PubSub + Stream.fromPubSub + Effect.fork.

### TSG.32.13.4 Test Categories

| Category | Pattern | Layer Stack | Purpose |
|----------|---------|-------------|---------|
| **Unit** | `it.effect()` + Layer substitution | In-memory services | Service logic isolation |
| **Integration** | `it.effect()` + real DB layers | TestContainers or dev DB | Cross-service behavior |
| **Contract** | Snapshot tests on RPC schemas | None (schema introspection) | API surface stability |
| **Property** | Schema roundtrip tests | None (schema encode/decode) | Data integrity |

**Requirement TST-4**: Contract tests MUST validate RPC schema surfaces via snapshot testing. Schema changes that break snapshots MUST be reviewed for backward compatibility before acceptance.

**Requirement TST-5**: Property tests MUST validate Schema encode/decode roundtrip: `decode(encode(value)) === value` for all domain schemas.

---

## TSG.32.14 Observability and Instrumentation

### TSG.32.14.1 Structured Tracing

Every pipeline stage is traceable via `Effect.withSpan` [EFFECT]:

```typescript
const processSignal = (signal: BaseSignal) =>
  validateSignal(signal).pipe(
    Effect.flatMap(enrichSignal),
    Effect.flatMap(routeSignal),
    Effect.withSpan('signal.process', {
      attributes: {
        'signal.kind': signal.kind,
        'signal.source': signal.sourceId,
      },
    }),
  )
```

Spans form a tree mirroring the Effect composition tree. Parent spans automatically propagate through `Effect.gen` and `pipe`.

**Requirement OBS-1**: All top-level service operations MUST include an `Effect.withSpan` annotation. Span names MUST follow the convention `{domain}.{operation}` (e.g., `alarm.create`, `signal.process`, `sensor.ingest`).

**Requirement OBS-2**: Span attributes MUST include entity identifiers and operation-specific metadata. Sensitive data (credentials, PII) MUST NOT appear in span attributes.

### TSG.32.14.2 Structured Logging

```typescript
Effect.logInfo('Alarm created').pipe(
  Effect.annotateLogs({
    alarmId: alarm.id,
    severity: alarm.severity,
    module: 'AlarmService',
    operation: 'create',
  })
)
```

**Requirement OBS-3**: Logging MUST use `Effect.logInfo`, `Effect.logWarning`, `Effect.logError`, and `Effect.logDebug`. Raw `console.log` is prohibited within core packages.

**Requirement OBS-4**: Log entries MUST include structured annotations via `Effect.annotateLogs`. Free-text log messages without structured context are insufficient for production diagnostics.

### TSG.32.14.3 Metrics

```typescript
const alarmCounter = Metric.counter('alarm.created', {
  description: 'Number of alarms created',
})

const processLatency = Metric.histogram('signal.process.duration', {
  description: 'Signal processing latency in milliseconds',
  boundaries: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
})

// Usage
const program = processSignal(signal).pipe(
  Metric.trackDuration(processLatency),
  Effect.tap(() => Metric.increment(alarmCounter)),
)
```

**Requirement OBS-5**: Signal processing pipelines MUST track processing latency via `Metric.histogram`. Entity creation operations SHOULD track counts via `Metric.counter`.

### TSG.32.14.4 Health Checks

Service health is exposed through Effect's diagnostic facilities:

```typescript
const healthCheck = Effect.gen(function* () {
  const db = yield* PgClient.PgClient
  const nats = yield* NatsClient
  return {
    database: yield* db.query('SELECT 1').pipe(Effect.as('ok'), Effect.orElse(() => Effect.succeed('down'))),
    nats: yield* nats.status().pipe(Effect.as('ok'), Effect.orElse(() => Effect.succeed('down'))),
  }
})
```

**Requirement OBS-6**: Each L1 infrastructure service MUST expose a health check effect. The health check MUST return within 5 seconds or be considered "down".

---

## TSG.32.15 Cluster and Distributed Entity Model

### TSG.32.15.1 @effect/cluster Architecture

Effect Cluster provides distributed entity management [EFFECT-CLUSTER]:

| Component | Purpose | Tsingou Usage |
|-----------|---------|--------------|
| **Entity** | Distributed stateful actor with typed RPC interface | Alarm, WorkOrder, Equipment entities |
| **Sharding** | Consistent hashing for entity-to-node assignment | Entity distribution across cluster nodes |
| **EntityManager** | Lifecycle management (create, passivate, rehydrate) | Entity idle timeout, memory management |
| **Mailbox** | Serial message delivery per entity instance | Ordered command processing |
| **EntityProxyServer** | RPC proxy for cluster-routed requests | Route client RPCs to correct entity node |

### TSG.32.15.2 Entity Lifecycle

```
Client Request
  → EntityProxyServer (identifies target node via consistent hash)
    → EntityManager (on target node)
      → Entity Instance (creates if not exists, or rehydrates)
        → Mailbox (serial message delivery)
          → Handler (processes request, returns response)
```

| Phase | Trigger | Action |
|-------|---------|--------|
| **Creation** | First message to entity ID | Manager creates instance, boots Machine |
| **Active** | Ongoing messages | Handler processes requests serially |
| **Passivation** | Idle timeout | Manager serializes state, releases memory |
| **Rehydration** | New message after passivation | Manager restores state, resumes processing |
| **Eviction** | Memory pressure | Manager passivates least-recently-used entities |

**Requirement CLU-1**: Entity handlers MUST be idempotent with respect to state transitions. Redelivered messages (after network partition recovery) MUST produce the same state as the original delivery.

**Requirement CLU-2**: Entity state MUST be serializable for passivation. Entity handlers MUST NOT hold references to non-serializable resources (file handles, socket connections).

### TSG.32.15.3 Machine Integration

Entity handlers delegate to `@effect/experimental` Machine for state machine logic:

```typescript
const alarmMachine = makeAlarmMachine({ state, flags })
const actor = yield* Machine.boot(alarmMachine)

// Machine validates state transitions
// Machine procedures are internal RPCs
// Entity handlers map Machine errors to RPC errors
```

The Machine provides:
- State transition validation (ISA-18.2 compliant for alarms)
- Internal procedure definitions (typed internal RPCs)
- State persistence delegation to StateService ports

**Requirement CLU-3**: Stateful entities MUST use Machine for state transition management. Direct state mutation without Machine validation is prohibited.

### TSG.32.15.4 Entity RPC Handler Composition

All entity handlers compose into a single layer for the RPC server:

```typescript
const EntityRpcHandlers = Layer.mergeAll(
  EntityProxyServer.layerRpcHandlers(AlarmEntity),
  EntityProxyServer.layerRpcHandlers(EnterpriseEntity),
  EntityProxyServer.layerRpcHandlers(SiteEntity),
  EntityProxyServer.layerRpcHandlers(AreaEntity),
  EntityProxyServer.layerRpcHandlers(PlantEntity),
  EntityProxyServer.layerRpcHandlers(LineEntity),
  EntityProxyServer.layerRpcHandlers(WorkCellEntity),
  EntityProxyServer.layerRpcHandlers(MachineAssetEntity),
  EntityProxyServer.layerRpcHandlers(DeviceAssetEntity),
  EntityProxyServer.layerRpcHandlers(SensorAssetEntity),
  EntityProxyServer.layerRpcHandlers(WorkOrderEntity),
  EntityProxyServer.layerRpcHandlers(EquipmentStateEntity),
  EntityProxyServer.layerRpcHandlers(AssetEntity),
)
```

**Requirement CLU-4**: All entity types that participate in the cluster MUST be registered via `EntityProxyServer.layerRpcHandlers` in the EntityRpcHandlers composition layer. Unregistered entities will fail silently when clients attempt to invoke their RPCs.

---

## TSG.32.16 NATS Messaging Fabric Integration

### TSG.32.16.1 Holonet Architecture

Tsingou's NATS integration layer is called "Holonet". It provides three service abstractions over NATS:

| Service | NATS Feature | Purpose |
|---------|-------------|---------|
| `NatsClient` | Core NATS connection | Connection management, auto-reconnect |
| `NatsPubSubService` | NATS Pub/Sub | Signal broadcasting, event distribution |
| `NatsKVService` | JetStream KV | State persistence, device registry |

### TSG.32.16.2 Subject Hierarchy

NATS subjects follow a hierarchical naming convention:

```
tsingou.signals.{kind}              — Signal data streams
tsingou.events.{entityType}         — Entity lifecycle events
tsingou.alarms.{severity}           — Alarm broadcasts
tsingou.telemetry.{sourceId}        — Raw telemetry
tsingou.state.{entityType}.{id}     — Entity state changes
```

**Requirement NAT-1**: NATS subject names MUST follow the convention `tsingou.{category}.{discriminator}`. Subject names MUST use dots (`.`) as separators. Colons (`:`) are invalid in NATS subjects and MUST NOT be used.

### TSG.32.16.3 KV Key Format

NATS KV keys become NATS subjects internally (`$KV.bucket.key`):

```typescript
// CORRECT: Dots as separators
const key = `host.${hostId}`

// INCORRECT: Colons are invalid
const key = `host:${hostId}`  // Will fail
```

**Requirement NAT-2**: NATS KV keys MUST use dots (`.`) as separators. Colons (`:`) and other characters that are invalid in NATS subjects MUST NOT be used in KV keys.

### TSG.32.16.4 Event Distribution

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

| Channel | maxLag | Purpose |
|---------|--------|---------|
| `readings` | 10,000 | Sensor telemetry (high volume, tolerates lag) |
| `alarms` | 1,000 | Alarm lifecycle events (low latency required) |
| `equipment` | 1,000 | Equipment state transitions |
| `invalidations` | 1,000 | Cache invalidation signals |

**Requirement NAT-3**: Event distribution MUST route through ChannelService with broadcast outlets. Direct PubSub usage for event distribution is prohibited; ChannelService provides maxLag configuration and backpressure management.

### TSG.32.16.5 Deployment Layer Stack

```typescript
// Full distributed deployment
export const IIoTRealtimeDistributed = pipe(
  IIoTRealtimeWsServer,
  Layer.provide(EventDistributionLive),
  Layer.provide(HolonetBridgeLayer),
  Layer.provide(NatsPubSubService.Default),
)

// Adapter deployment
export const IIoTAdapterDistributed = (config: SparkplugAdapterConfig) =>
  pipe(
    SparkplugAdapterKVLive(config),
    Layer.provide(NatsKVService.Default),
  )
```

**Requirement NAT-4**: All NATS-dependent deployments MUST compose through pre-defined deployment layer stacks. Ad-hoc NATS connection management in application code is prohibited.

---

## TSG.32.17 Normative Requirements Summary

### MUST Requirements

| ID | Section | Requirement |
|----|---------|-------------|
| EFF-1 | 32.1.1 | All async computations MUST use Effect<A, E, R> |
| EFF-2 | 32.1.1 | Error channel MUST enumerate all expected failures |
| EFF-3 | 32.1.1 | Requirements channel MUST declare all dependencies |
| EFF-4 | 32.1.2 | Effect values MUST be treated as descriptions |
| EFF-6 | 32.1.5 | MUST distinguish expected errors from defects |
| SVC-1 | 32.2.1 | All services MUST be Context.Tag or Effect.Service |
| SVC-2 | 32.2.1 | Service IDs MUST follow {module}/{ServiceName} |
| SVC-3 | 32.2.2 | Service methods MUST return Effect values |
| SVC-4 | 32.2.2 | Error types MUST enumerate failure modes |
| SVC-5 | 32.2.3 | Services MUST observe tier dependency rules |
| SVC-6 | 32.2.3 | Each tier MUST have barrel index.ts |
| SVC-7 | 32.2.4 | Resource-acquiring services MUST register finalizers |
| LAY-1 | 32.3.3 | Layer composition MUST produce acyclic graph |
| LAY-2 | 32.3.3 | Shared infra services MUST be single-instance via memoization |
| LAY-4 | 32.3.5 | Deployment topologies MUST be pre-composed Layer stacks |
| SCH-1 | 32.4.3 | Entity identifiers MUST be branded Schema types |
| SCH-2 | 32.4.4 | Domain entities MUST be TaggedStruct or TaggedClass |
| SCH-4 | 32.4.5 | Boundary-crossing data MUST pass through Schema decode/encode |
| SCH-5 | 32.4.5 | Schema transforms MUST handle null-to-undefined conversion |
| SCH-6 | 32.4.6 | AI SDK tools MUST use JSONSchema.make() from Effect Schema |
| SCH-7 | 32.4.7 | Enumerated values MUST use Schema.Literal |
| ERR-1 | 32.5.1 | Domain errors MUST extend Data.TaggedError or Schema.TaggedError |
| ERR-2 | 32.5.1 | RPC boundary errors MUST use Schema.TaggedError |
| ERR-3 | 32.5.3 | Error recovery MUST use catchTag/catchTags |
| ERR-4 | 32.5.3 | Error tag MUST match class name |
| ERR-5 | 32.5.4 | Error mapping MUST occur at tier boundaries |
| CON-1 | 32.6.2 | Background fibers MUST use forkScoped |
| CON-2 | 32.6.2 | All fibers MUST be supervised |
| RES-1 | 32.7.3 | Every acquisition MUST have corresponding release |
| RES-2 | 32.7.3 | Finalizers MUST be idempotent |
| RES-3 | 32.7.3 | Finalizers MUST NOT throw exceptions |
| STR-1 | 32.8.2 | External data sources MUST use Stream.async/asyncScoped |
| STR-2 | 32.8.4 | Pipelines MUST be Stream transformation chains |
| STR-3 | 32.8.4 | provideLayer MUST precede toAsyncIterable |
| STR-5 | 32.8.6 | R MUST be never before toAsyncIterable |
| RPC-1 | 32.9.1 | RPCs MUST use Rpc.make with Schema types |
| RPC-2 | 32.9.1 | RPC tags MUST follow {EntityType}.{Operation} |
| RPC-3 | 32.9.4 | Entity handlers MUST delegate to Machine |
| RPC-4 | 32.9.4 | Handlers MUST map internal to RPC errors |
| RPC-7 | 32.9.7 | Real-time subscriptions MUST use WebSocket |
| RPC-8 | 32.9.8 | Clients MUST use generated RPC clients |
| ATM-1 | 32.10.2 | Atoms MUST be module-level |
| ATM-2 | 32.10.2 | Cross-component state MUST use atoms over useState |
| ATM-3 | 32.10.3 | Service state updates MUST use ctx.set() |
| CFG-1 | 32.11.3 | Configuration MUST flow through Config + Layer |
| CFG-4 | 32.11.4 | Feature flags MUST be typed service dependencies |
| RUN-1 | 32.12.1 | React apps MUST use ManagedRuntime |
| RUN-2 | 32.12.2 | ManagedRuntime.dispose() MUST be called on unmount |
| RUN-3 | 32.12.3 | RegistryProvider MUST wrap atom-using components |
| TST-1 | 32.13.2 | Tests MUST use Layer substitution |
| TST-3 | 32.13.3 | PubSub tests MUST use plain it() + runPromise |
| OBS-1 | 32.14.1 | Top-level operations MUST include withSpan |
| OBS-3 | 32.14.2 | Logging MUST use Effect.log* |
| NAT-1 | 32.16.2 | NATS subjects MUST use dots as separators |
| NAT-2 | 32.16.3 | NATS KV keys MUST NOT use colons |
| NAT-3 | 32.16.4 | Event distribution MUST use ChannelService |
| CLU-1 | 32.15.2 | Entity handlers MUST be idempotent |
| CLU-2 | 32.15.2 | Entity state MUST be serializable |
| CLU-3 | 32.15.3 | Stateful entities MUST use Machine |
| CLU-4 | 32.15.4 | Cluster entities MUST be registered in EntityRpcHandlers |

### SHOULD Requirements

| ID | Section | Requirement |
|----|---------|-------------|
| EFF-S1 | 32.1.3 | Effect.gen SHOULD be primary for sequential composition |
| ERR-S1 | 32.5.5 | Error recovery SHOULD include structured logging |
| STR-S1 | 32.8.5 | Bounded queues SHOULD use power-of-2 capacities |
| RPC-S1 | 32.9.6 | Production SHOULD use MsgPack; dev SHOULD use NDJSON |
| ATM-S1 | 32.10.4 | React components SHOULD subscribe via useAtomValue |
| CFG-S1 | 32.11.3 | Configuration SHOULD provide graceful fallback |
| OBS-S1 | 32.14.1 | Span attributes SHOULD include entity identifiers |
| OBS-S2 | 32.14.2 | Logs SHOULD include structured annotations |
| OBS-S3 | 32.14.3 | Pipelines SHOULD track processing latency |
| OBS-S4 | 32.14.4 | L1 services SHOULD expose health checks |
| TST-S1 | 32.13.2 | All service layers SHOULD provide in-memory test variant |
| TST-S2 | 32.13.4 | RPC schemas SHOULD have contract snapshot tests |
| TST-S3 | 32.13.4 | Domain schemas SHOULD have roundtrip property tests |

### MAY Requirements

| ID | Section | Requirement |
|----|---------|-------------|
| EFF-M1 | 32.1.3 | Pipeline composition via pipe() MAY be used for transformation chains |
| SCH-M1 | 32.4.4 | Pure data records MAY use TaggedStruct over TaggedClass |
| ERR-M1 | 32.5.1 | Internal errors MAY use Data.TaggedError |
| CON-M1 | 32.6.2 | forkDaemon MAY be used for health monitors |
| CON-M2 | 32.6.5 | Unbounded concurrency MAY be used with documented justification |
| ATM-M1 | 32.10.2 | Component-local useState MAY be used for ephemeral UI state |
| RUN-M1 | 32.12.4 | Direct runtime.runPromise MAY be used for one-off operations |
| LAY-M1 | 32.3.4 | Layer.fresh MAY be used for independent test contexts |

---

## TSG.32.18 Tsingou Integration Mapping

### TSG.32.18.1 Module-to-Section Cross-References

| Tsingou Module | Effect Pattern | RFC Section |
|---------------|----------------|-------------|
| Signal Pipeline | Stream<A, E, R> | TSG.32.8 |
| BaseSignal Schema | Schema.TaggedStruct | TSG.32.4 (also TSG.8) |
| Source Adapters | Service + Layer | TSG.32.2, TSG.32.3 (also TSG.9) |
| Entity Handlers | Entity.make + Machine | TSG.32.9, TSG.32.15 |
| Alarm Lifecycle | TaggedError + catchTags | TSG.32.5 |
| Event Distribution | ChannelService + PubSub | TSG.32.6.4, TSG.32.16.4 |
| Realtime Subscriptions | WebSocket RPC + Stream | TSG.32.9.7, TSG.32.8 |
| Atom-as-State | Atom.make + useAtomValue | TSG.32.10 |
| Feature Flags | Context.Tag + Config | TSG.32.11.4 |
| Deployment Stacks | Layer.mergeAll + pipe | TSG.32.3.5, TSG.32.16.5 |
| NATS Integration | NatsClient + PubSub + KV | TSG.32.16 |
| Observability | withSpan + Metric | TSG.32.14 |

### TSG.32.18.2 Prohibited Patterns

The following patterns are architecturally prohibited in Tsingou core packages:

| Prohibited Pattern | Effect Alternative | Rationale |
|-------------------|-------------------|-----------|
| `Promise<T>` | `Effect<A, E, R>` | Loses error types and dependency tracking |
| `try/catch` | `Effect.catchTag` | Untyped error handling |
| `throw new Error()` | `Effect.fail(taggedError)` | Untyped, unrecoverable |
| `interface Foo { ... }` (domain) | `Schema.TaggedStruct` | No runtime validation |
| `type Status = 'a' \| 'b'` (domain) | `Schema.Literal` | No runtime validation |
| `process.env.X` | `Config.string('X')` | Untyped, no fallback |
| `useState` (cross-component) | `Atom.make` | Stale closures, prop drilling |
| `EventEmitter` | `PubSub` + `Queue` | Untyped, no backpressure |
| `console.log` | `Effect.logInfo` | Unstructured, no context |
| `new Promise((resolve, reject) => ...)` | `Effect.async` | No interruption, no scope |
| `setInterval` / `setTimeout` | `Schedule` + `Effect.repeat` | No cleanup guarantee |
| Global singletons | `Context.Tag` + `Layer` | Untestable, hidden dependencies |
| `jest.mock` / `vi.mock` (services) | Layer substitution | Monkey-patching breaks type safety |

### TSG.32.18.3 Codebase Reference Files

| Pattern | Canonical Reference Path |
|---------|------------------------|
| Service definition (Effect.Service) | `src/lib/iiot/services/l2/AlarmService.ts` |
| Schema transformation | `src/lib/iiot/services/l2/AlarmService.ts:100-149` |
| Entity definition | `src/lib/iiot/entity/AlarmEntity.ts` |
| Entity handler + Machine | `src/lib/iiot/entity/AlarmEntity.ts:197-293` |
| RPC server composition | `src/lib/iiot/http/rpc-server.ts` |
| Feature flags (Context.Tag) | `src/lib/iiot/infrastructure/feature-flags.ts` |
| Deployment layer stacks | `src/lib/iiot/realtime/layers.ts` |
| AI SDK + Effect Schema | `src/lib/charts/discriminator/ai-tool.ts:42-44` |
| Streaming tool | `src/lib/charts/styler/ai-tool.ts:250-277` |
| Stream.provideLayer before bridge | `src/lib/charts/styler/ai-tool.ts:301-308` |

---

## TSG.32.19 References

[EFFECT] Effect-TS. "Effect: Build production-ready applications in TypeScript." GitHub. https://github.com/Effect-TS/effect

[EFFECT-SCHEMA] Effect. "Introduction to Effect Schema." Effect Documentation. https://effect.website/docs/schema/introduction/

[EFFECT-SERVICES] Effect. "Managing Services." Effect Documentation. https://effect.website/docs/requirements-management/services/

[EFFECT-LAYERS] Effect. "Managing Layers." Effect Documentation. https://effect.website/docs/requirements-management/layers/

[EFFECT-FIBERS] Effect. "Fibers." Effect Documentation. https://effect.website/docs/concurrency/fibers/

[EFFECT-STREAM] Effect. "Creating Streams." Effect Documentation. https://effect.website/docs/stream/creating/

[EFFECT-SCOPE] Effect. "Scope." Effect Documentation. https://effect.website/docs/resource-management/scope/

[EFFECT-ERRORS] Effect. "Expected Errors." Effect Documentation. https://effect.website/docs/error-management/expected-errors/

[EFFECT-RUNTIME] Effect. "Introduction to Runtime." Effect Documentation. https://effect.website/docs/runtime/

[EFFECT-QUEUE] Effect. "Queue." Effect Documentation. https://effect.website/docs/concurrency/queue/

[EFFECT-PUBSUB] Effect. "PubSub." Effect Documentation. https://effect.website/docs/concurrency/pubsub/

[EFFECT-RPC] Effect-TS. "@effect/rpc README." GitHub. https://github.com/Effect-TS/effect/blob/main/packages/rpc/README.md

[EFFECT-CLUSTER] Effect-TS. "@effect/cluster." GitHub. https://github.com/Effect-TS/effect/tree/main/packages/cluster

[EFFECT-ATOM] Tim Smart. "effect-atom — Reactive state management for Effect." GitHub. https://github.com/tim-smart/effect-atom

[RFC2119] Bradner, S. "Key words for use in RFCs to Indicate Requirement Levels." BCP 14, RFC 2119, DOI 10.17487/RFC2119, March 1997. https://www.rfc-editor.org/info/rfc2119

[RFC8174] Leiba, B. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words." BCP 14, RFC 8174, DOI 10.17487/RFC8174, May 2017. https://www.rfc-editor.org/info/rfc8174

[ADR-005] Tsingou Project. "ADR-005: Atom-as-State Reactive Bridge." Internal.

[ADR-006] Tsingou Project. "ADR-006: Tagged Error Architecture." Internal.

[ADR-008] Tsingou Project. "ADR-008: Tsingou Identity and nw_wrld Divergence." Internal.

[ADR-009] Tsingou Project. "ADR-009: STIX 2.1 Interoperability." Internal.

[ADR-012] Tsingou Project. "ADR-012: Event Sourcing Boundaries." Internal.
