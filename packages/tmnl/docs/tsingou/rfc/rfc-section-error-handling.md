# RFC Section TSG.35: Error Handling & Tagged Errors

```
Section:       TSG.35 — Error Handling & Tagged Errors
Parent RFC:    Tsingou System RFC
Status:        DRAFT
Author:        Val (data-fusion-mathematician)
Created:       2026-02-18
Research Base: research-error-handling.md (500 lines, 10 sections)
```

> This section specifies the error handling architecture for the Tsingou platform.
> It defines the error taxonomy, tagged error patterns, recovery strategies, retry
> policies, failure isolation boundaries, and error propagation semantics through the
> d2ts differential dataflow pipeline. Tsingou adopts Effect-TS as its error model
> substrate, replacing traditional try/catch with typed, composable error channels
> that the compiler tracks at every composition boundary. The key words "MUST",
> "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" are to be interpreted as described
> in [RFC2119] and [RFC8174].

---

## Table of Contents

1. [Foundational Error Model](#1-foundational-error-model)
   1.1 [The Effect Type and Error Channels](#11-the-effect-type-and-error-channels)
   1.2 [Expected Errors vs Defects vs Interruptions](#12-expected-errors-vs-defects-vs-interruptions)
   1.3 [The Cause Hierarchy](#13-the-cause-hierarchy)
   1.4 [Error Channel Algebra](#14-error-channel-algebra)
   1.5 [Rejection of try/catch](#15-rejection-of-trycatch)
2. [Tagged Error Architecture](#2-tagged-error-architecture)
   2.1 [Data.TaggedError — Internal Service Errors](#21-datataggederror--internal-service-errors)
   2.2 [Schema.TaggedError — Serializable RPC Errors](#22-schemataggederror--serializable-rpc-errors)
   2.3 [Tag Naming Conventions](#23-tag-naming-conventions)
   2.4 [Error Class Structure Requirements](#24-error-class-structure-requirements)
   2.5 [Union Types and Discriminated Error Channels](#25-union-types-and-discriminated-error-channels)
   2.6 [Namespace-Scoped Error Hierarchies](#26-namespace-scoped-error-hierarchies)
3. [Error Taxonomy](#3-error-taxonomy)
   3.1 [Taxonomy Overview](#31-taxonomy-overview)
   3.2 [Layer 1: Adapter Errors (Source Boundary)](#32-layer-1-adapter-errors-source-boundary)
   3.3 [Layer 2: Transport Errors (NATS Fabric)](#33-layer-2-transport-errors-nats-fabric)
   3.4 [Layer 3: Pipeline Errors (d2ts Graph)](#34-layer-3-pipeline-errors-d2ts-graph)
   3.5 [Layer 4: Codec Errors (Schema Boundary)](#35-layer-4-codec-errors-schema-boundary)
   3.6 [Layer 5: Domain Errors (Business Logic)](#36-layer-5-domain-errors-business-logic)
   3.7 [Layer 6: RPC Errors (Wire Protocol)](#37-layer-6-rpc-errors-wire-protocol)
   3.8 [Layer 7: Rendering Errors (UI Boundary)](#38-layer-7-rendering-errors-ui-boundary)
   3.9 [Cross-Layer Error Catalog](#39-cross-layer-error-catalog)
4. [Error Recovery Strategies](#4-error-recovery-strategies)
   4.1 [Tag-Based Recovery (catchTag)](#41-tag-based-recovery-catchtag)
   4.2 [Multi-Tag Recovery (catchTags)](#42-multi-tag-recovery-catchtags)
   4.3 [Exhaustive Error Handling](#43-exhaustive-error-handling)
   4.4 [Fallback Chains (orElse)](#44-fallback-chains-orelse)
   4.5 [Error Absorption (orDie)](#45-error-absorption-ordie)
   4.6 [Sandbox and Cause Inspection](#46-sandbox-and-cause-inspection)
   4.7 [Recovery Strategy Decision Matrix](#47-recovery-strategy-decision-matrix)
5. [Retry Policies and Schedule Composition](#5-retry-policies-and-schedule-composition)
   5.1 [Schedule Primitives](#51-schedule-primitives)
   5.2 [Schedule Combinators](#52-schedule-combinators)
   5.3 [Conditional Retry by Error Tag](#53-conditional-retry-by-error-tag)
   5.4 [Adapter Reconnection Schedules](#54-adapter-reconnection-schedules)
   5.5 [Transport Retry Schedules](#55-transport-retry-schedules)
   5.6 [Rate-Limited Retry](#56-rate-limited-retry)
   5.7 [Schedule Selection Criteria](#57-schedule-selection-criteria)
6. [Error Propagation Through d2ts Operators](#6-error-propagation-through-d2ts-operators)
   6.1 [Stream Error Channel Semantics](#61-stream-error-channel-semantics)
   6.2 [Map Operator Error Propagation](#62-map-operator-error-propagation)
   6.3 [Filter Operator Error Behavior](#63-filter-operator-error-behavior)
   6.4 [Join Operator Partial Failure](#64-join-operator-partial-failure)
   6.5 [Window Operator Error Handling](#65-window-operator-error-handling)
   6.6 [Aggregate Operator Error Handling](#66-aggregate-operator-error-handling)
   6.7 [Iterate Operator Error Convergence](#67-iterate-operator-error-convergence)
   6.8 [Sink Error Handling](#68-sink-error-handling)
   6.9 [Error Propagation Algebra](#69-error-propagation-algebra)
7. [Failure Isolation and Containment](#7-failure-isolation-and-containment)
   7.1 [Containment Hierarchy](#71-containment-hierarchy)
   7.2 [Adapter-Scoped Isolation (Effect.Scope)](#72-adapter-scoped-isolation-effectscope)
   7.3 [Blast Radius Control](#73-blast-radius-control)
   7.4 [Circuit Breaker Pattern](#74-circuit-breaker-pattern)
   7.5 [Bulkhead Pattern](#75-bulkhead-pattern)
   7.6 [Graceful Degradation](#76-graceful-degradation)
   7.7 [Quorum Policies](#77-quorum-policies)
8. [Error-to-Domain Mapping](#8-error-to-domain-mapping)
   8.1 [Internal-to-RPC Error Translation](#81-internal-to-rpc-error-translation)
   8.2 [Error-to-HTTP Status Mapping](#82-error-to-http-status-mapping)
   8.3 [Error-to-STIX Confidence Impact](#83-error-to-stix-confidence-impact)
   8.4 [Error-to-Alarm Escalation](#84-error-to-alarm-escalation)
9. [Error Observability and Telemetry](#9-error-observability-and-telemetry)
   9.1 [Structured Error Logging](#91-structured-error-logging)
   9.2 [Health Atoms (Reactive Error State)](#92-health-atoms-reactive-error-state)
   9.3 [Error Telemetry Subjects](#93-error-telemetry-subjects)
   9.4 [Error Rate Metrics](#94-error-rate-metrics)
   9.5 [Error Correlation and Tracing](#95-error-correlation-and-tracing)
10. [User-Facing Error Rendering](#10-user-facing-error-rendering)
    10.1 [Error State Schema](#101-error-state-schema)
    10.2 [Error Category Classification](#102-error-category-classification)
    10.3 [User Message Generation](#103-user-message-generation)
    10.4 [Retry UI State Machine](#104-retry-ui-state-machine)
    10.5 [Error Rendering in 4-Layer Surface](#105-error-rendering-in-4-layer-surface)
11. [Testing Error Paths](#11-testing-error-paths)
    11.1 [Error Injection Patterns](#111-error-injection-patterns)
    11.2 [Tagged Error Assertion Patterns](#112-tagged-error-assertion-patterns)
    11.3 [Cause Inspection in Tests](#113-cause-inspection-in-tests)
    11.4 [Schedule Testing](#114-schedule-testing)
    11.5 [Circuit Breaker Testing](#115-circuit-breaker-testing)
12. [Normative Summary](#12-normative-summary)
13. [Open Questions](#13-open-questions)
14. [References](#14-references)

---

## 1. Foundational Error Model

### 1.1 The Effect Type and Error Channels

Every computation in Tsingou is expressed as `Effect<A, E, R>` where:

```
A — Success type: the value produced on success
E — Error type: the typed error channel (expected failures)
R — Requirements: the service dependencies needed to run
```

The TypeScript compiler tracks the `E` parameter across every composition boundary.
When two effects are sequentially composed via `pipe`, `flatMap`, or `Effect.gen`,
their error types form a union:

```
Given:
  effectA: Effect<A1, E1, R1>
  effectB: Effect<A2, E2, R2>

Sequential composition (flatMap, gen):
  result: Effect<A2, E1 | E2, R1 | R2>
```

This union accumulation is the foundation of type-safe error handling. The compiler
MUST know every possible failure mode of a composed program at compile time.

**TSG.35-N1**: All Tsingou service methods MUST declare their complete error channel
in the return type. The error type MUST NOT include `unknown`, `Error`, or `never`
(unless the method is guaranteed infallible).

### 1.2 Expected Errors vs Defects vs Interruptions

Effect-TS distinguishes three fundamentally different failure categories. Conflating
them is the primary source of error handling bugs in conventional TypeScript.

#### Expected Errors (Fail<E>)

Expected errors represent domain-level failure conditions that the program is designed
to handle. They are:

- **Typed**: Modeled explicitly in the E parameter of `Effect<A, E, R>`
- **Recoverable**: Handled via `catchTag`, `catchTags`, `catchAll`, `orElse`
- **Domain-relevant**: Represent business logic failures (not found, unauthorized,
  invalid input, timeout, connection refused)
- **Composable**: Accumulate through composition as unions
- **Declared**: Part of the service contract

Examples in Tsingou:
```
AdapterConnectError     — source cannot be reached
HttpAuthError           — API credentials rejected
SignalValidationError   — incoming signal fails Schema decode
AlarmNotFoundError      — referenced alarm does not exist
ConflictError           — optimistic locking version mismatch
```

#### Defects (Die)

Defects represent unexpected programming errors that indicate bugs, not domain
conditions. They are:

- **Untyped**: NOT modeled in the E parameter
- **Unexpected**: Null dereference, array index out of bounds, assertion failure
- **Unrecoverable** (by default): `catchAll` does NOT catch defects
- **Inspectable**: Only via `Effect.sandbox` or `Effect.catchAllDefect`

**TSG.35-N2**: Tsingou services MUST NOT use `Effect.die()` or `Effect.dieMessage()`
for domain-level failures. Domain failures MUST be modeled as expected errors in the
E channel. `Effect.die()` is reserved exclusively for invariant violations that
indicate programming bugs.

#### Interruptions (Interrupt)

Interruptions represent cooperative fiber cancellation:

- **Not errors**: Part of the structured concurrency lifecycle
- **Finalizable**: Scope finalizers run on interruption
- **Propagated**: From parent to child fibers
- **Uninterruptible regions**: Protected via `Effect.uninterruptibleMask`

Tsingou adapters use `Effect.uninterruptibleMask` for critical sections:
```
Effect.uninterruptibleMask((restore) =>
  Effect.gen(function* () {
    // Signal emission is uninterruptible — prevents partial writes
    yield* emitSignals(data, meta)
    // But nested waits can be restored to interruptible
    yield* restore(waitForAck)
  })
)
```

**TSG.35-N3**: Signal emission operations within adapters MUST be wrapped in
`Effect.uninterruptibleMask` to prevent partial signal delivery during fiber
interruption.

### 1.3 The Cause Hierarchy

The `Cause<E>` data type captures the complete history of a failure without
information loss. Unlike traditional exception handling where only the most recent
error is available, Cause preserves the full causal chain.

```
Cause<E>
  │
  ├── Empty              — no failure (success case)
  │
  ├── Fail<E>            — expected error with value of type E
  │     └── error: E     — the error payload
  │
  ├── Die                — unexpected defect
  │     └── defect: unknown  — the thrown value
  │
  ├── Interrupt          — fiber interruption
  │     └── fiberId: FiberId  — the interrupted fiber
  │
  ├── Sequential<E>      — error A, then finalizer error B
  │     ├── left: Cause<E>
  │     └── right: Cause<E>
  │
  └── Parallel<E>        — concurrent errors from parallel fibers
        ├── left: Cause<E>
        └── right: Cause<E>
```

**Sequential Cause** arises when an effect fails with error A, and during cleanup
the finalizer also fails with error B. Traditional try/catch would lose error A;
Cause preserves both.

**Parallel Cause** arises when concurrent fibers (e.g., in `Effect.all` with
`concurrency: "unbounded"`) fail simultaneously. All errors are preserved.

**TSG.35-N4**: Error handling logic that inspects `Cause` MUST handle all variants
(Empty, Fail, Die, Interrupt, Sequential, Parallel). Partial pattern matching on
Cause MUST NOT be used.

### 1.4 Error Channel Algebra

Error channels obey an algebraic structure under Effect composition:

**Sequential composition (>>=, flatMap, gen):**
```
E(a >>= b) = E(a) | E(b)
```

**Parallel composition (Effect.all):**
```
E(all(a, b)) = E(a) | E(b)
```

**Error recovery (catchTag):**
```
E(catchTag('Tag', handler)(effect)) = Exclude<E(effect), {_tag: 'Tag'}> | E(handler)
```

Recovery narrows the error type — the caught tag is removed from E, and any new
errors introduced by the handler are added.

**Error absorption (orDie):**
```
E(orDie(effect)) = never
```

The expected error is converted to a defect. E becomes `never` (infallible).

This algebra enables the compiler to track the exact set of possible failures through
arbitrarily complex compositions. The programmer can verify at the type level that
all error paths are handled.

### 1.5 Rejection of try/catch

Traditional JavaScript error handling via try/catch is structurally incompatible with
Tsingou's requirements:

| Property | try/catch | Effect Error Channel |
|----------|-----------|---------------------|
| Type safety | `unknown` catch parameter | Typed E parameter |
| Composition | Not composable | Union accumulation |
| Completeness | No exhaustiveness check | Compiler-enforced |
| Concurrency | Loses parallel errors | Parallel Cause |
| Finalization | Loses prior error | Sequential Cause |
| Recovery | All-or-nothing | Per-tag granularity |
| Retry | Manual loops | Schedule composition |

**TSG.35-N5**: Tsingou code MUST NOT use try/catch blocks for error handling except
at FFI boundaries where external JavaScript libraries throw exceptions. At such
boundaries, exceptions MUST be immediately converted to tagged errors via
`Effect.try()` or `Effect.tryPromise()`.

---

## 2. Tagged Error Architecture

### 2.1 Data.TaggedError — Internal Service Errors

`Data.TaggedError` creates lightweight error classes with a `_tag` discriminant field
and structural equality semantics from the `Data` module.

**Structure:**
```typescript
import { Data } from 'effect'

export class AdapterConnectError extends Data.TaggedError('AdapterConnectError')<{
  readonly adapterId: string
  readonly kind: string
  readonly message: string
  readonly cause?: unknown
}> {}
```

**Properties conferred:**
- `_tag: 'AdapterConnectError'` — discriminant for pattern matching
- Extends `YieldableError` — can be used in `Effect.gen` via `yield*`
- Structural equality — two errors with same fields are `Equal.equals`
- Immutable — all fields are `readonly`
- No runtime validation — fields are TypeScript-only

**Usage in Effect.gen:**
```typescript
const connect = Effect.gen(function* () {
  const result = yield* attemptConnection(config)
  if (!result.ok) {
    return yield* new AdapterConnectError({
      adapterId: config.adapterId,
      kind: config.kind,
      message: result.reason,
    })
  }
  return result.connection
})
// Type: Effect<Connection, AdapterConnectError, never>
```

The `yield*` on a TaggedError automatically fails the effect with that error.
No explicit `Effect.fail()` wrapper is needed.

**TSG.35-N6**: Internal service errors (not crossing RPC boundaries) MUST use
`Data.TaggedError`. The `cause` field SHOULD be included when wrapping external
exceptions to preserve the original error chain.

### 2.2 Schema.TaggedError — Serializable RPC Errors

`Schema.TaggedError` integrates with Effect Schema for serialization, validation,
and JSON Schema generation. Required when errors must cross process boundaries.

**Structure:**
```typescript
import { Schema } from 'effect'

export class RpcQueryError extends Schema.TaggedError<RpcQueryError>()(
  'RpcQueryError',
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}
```

**Properties conferred (in addition to Data.TaggedError properties):**
- Full `Schema.encode` / `Schema.decode` support
- JSON Schema generation via `JSONSchema.make(RpcQueryError)`
- Runtime validation of error payloads during decode
- Supports Schema transformations and filters
- Wire-safe: can traverse WebSocket, NATS, HTTP boundaries

**When Schema.TaggedError is required:**
```
RPC error channel     — errors sent to remote clients via RPC
HTTP response body    — errors serialized as JSON in HTTP responses
NATS error subjects   — errors published to NATS error topics
Event log errors      — errors persisted in EventLog/JetStream
```

**TSG.35-N7**: Errors that cross process boundaries (RPC, HTTP, NATS publish, event
log persistence) MUST use `Schema.TaggedError`. The Schema fields MUST use Effect
Schema types (not raw TypeScript types) for runtime decode safety.

### 2.3 Tag Naming Conventions

Error tags follow a hierarchical naming convention that encodes the error's origin
and domain.

**Pattern 1: Flat naming (adapter/domain errors)**
```
{Domain}{Operation}Error
```
Examples:
```
AdapterConnectError
HttpTimeoutError
AlarmNotFoundError
SignalValidationError
WorkOrderApprovalRequiredError
```

**Pattern 2: Namespace-scoped (transport errors)**
```
{Service}/{Operation}
```
Examples:
```
Connection/Connect
Inner/Core/Publish
Inner/KV/Get
Codec/Encode
Hub/Capacity
Micro/AddService
```

**TSG.35-N8**: Error tag names MUST be unique within their union scope. Flat-named
tags MUST use PascalCase with an `Error` suffix. Namespace-scoped tags MUST use
`/`-delimited path segments with PascalCase components.

### 2.4 Error Class Structure Requirements

Every tagged error class MUST include sufficient context for diagnosis and recovery.

**Required fields:**

| Field | Required When | Purpose |
|-------|--------------|---------|
| `message` | Always | Human-readable description |
| `_tag` | Auto-generated | Discriminant (never set manually) |

**Recommended fields:**

| Field | Recommended When | Purpose |
|-------|-----------------|---------|
| `adapterId` | Adapter errors | Source identification |
| `cause` | Wrapping external errors | Error chain preservation |
| `url` | HTTP/WebSocket errors | Request context |
| `subject` | NATS errors | Subject identification |
| `entityId` | Domain errors | Entity identification |
| `operation` | Any operation error | Failed operation name |
| `statusCode` | HTTP errors | HTTP status code |
| `timeoutMs` | Timeout errors | Configured timeout value |

**TSG.35-N9**: Every tagged error class MUST include a `message` field of type
`string` (for Data.TaggedError) or `Schema.String` (for Schema.TaggedError). Error
classes wrapping external exceptions SHOULD include a `cause` field of type `unknown`.

### 2.5 Union Types and Discriminated Error Channels

Error classes are composed into discriminated unions that represent the complete
error surface of a service method or module.

**Module-level union:**
```typescript
export type AdapterError =
  | AdapterConnectError
  | AdapterDisconnectError
  | HttpRequestError
  | HttpParseError
  | HttpAuthError
  | HttpTimeoutError
  | SseConnectionError
  | WsConnectError
  | WsMessageError
  | NatsSubscribeError
  | FileWatchError
  | FileParseError
  | RssFetchError
  | RssParseError
  | SerialConnectError
  | SignalValidationError
  | SignalQueueFullError
```

**Method-level union:**
```typescript
export type AlarmCommandError =
  | AlarmNotFoundError
  | InvalidAlarmTransitionError
  | AlarmAlreadyAcknowledgedError
```

**Composite union (combining inner + codec):**
```typescript
export type PublishError = Inner.Core.PublishError | Codec.EncodeError
export type SubscribeError = Inner.Core.SubscribeError | Codec.DecodeError
```

The discriminated union enables exhaustive handling via `Effect.catchTags`:
```typescript
pipe(
  acknowledgeAlarm(command),
  Effect.catchTags({
    AlarmNotFoundError: (e) => Effect.fail(new HttpNotFound(e.alarmId)),
    InvalidAlarmTransitionError: (e) => Effect.fail(new HttpConflict(e.reason)),
    AlarmAlreadyAcknowledgedError: (e) => Effect.succeed({ status: 'already_acknowledged' }),
  })
)
```

**TSG.35-N10**: Every error module MUST export a union type combining all error
classes defined in that module. The union type name MUST follow the pattern
`{Module}Error` (e.g., `AdapterError`, `NatsError`, `AlarmCommandError`).

### 2.6 Namespace-Scoped Error Hierarchies

For complex subsystems with many error types, namespace scoping provides hierarchical
organization without flat-name collisions.

**Pattern (from Holonet NATS errors):**
```typescript
export namespace Connection {
  export class ConnectError extends Data.TaggedError('Connection/Connect')<{
    readonly message: string
    readonly servers: string | readonly string[]
    readonly cause?: unknown
  }> {}

  export class DisconnectError extends Data.TaggedError('Connection/Disconnect')<{
    readonly message: string
    readonly wasClean: boolean
    readonly cause?: unknown
  }> {}

  export type Error = ConnectError | DisconnectError
}

export namespace Inner {
  export namespace Core {
    export class PublishError extends Data.TaggedError('Inner/Core/Publish')<{...}> {}
    export class SubscribeError extends Data.TaggedError('Inner/Core/Subscribe')<{...}> {}
    export type Error = PublishError | SubscribeError
  }
  export namespace KV {
    export class BucketError extends Data.TaggedError('Inner/KV/Bucket')<{...}> {}
    export class GetError extends Data.TaggedError('Inner/KV/Get')<{...}> {}
    export type Error = BucketError | GetError
  }
  export type Error = Core.Error | KV.Error
}
```

This pattern enables:
- Namespace-qualified tag names (`Inner/Core/Publish`) avoid collisions
- Hierarchical union types aggregate across namespace levels
- Method-level error types compose from namespace unions
- `catchTag('Inner/Core/Publish', ...)` targets specific errors precisely

**TSG.35-N11**: Subsystems with more than 10 error types SHOULD use namespace-scoped
error hierarchies. Namespace tags MUST use `/`-delimited paths matching the namespace
nesting structure.

---

## 3. Error Taxonomy

### 3.1 Taxonomy Overview

Tsingou's error taxonomy follows the platform's layered architecture. Each layer
defines its own error types, and errors are translated when crossing layer boundaries.

```
Layer 7: Rendering Errors    ─── UI components, chart adapters
Layer 6: RPC Errors          ─── Wire protocol, Schema.TaggedError
Layer 5: Domain Errors       ─── Business logic, entity state machines
Layer 4: Codec Errors        ─── Schema encode/decode boundaries
Layer 3: Pipeline Errors     ─── d2ts graph operators
Layer 2: Transport Errors    ─── NATS fabric, Holonet
Layer 1: Adapter Errors      ─── Source boundary, external systems
```

Errors flow upward through the layers. Each layer boundary is a translation point
where internal errors are mapped to the error vocabulary of the next layer.

### 3.2 Layer 1: Adapter Errors (Source Boundary)

Adapter errors arise at the boundary between Tsingou and external signal sources.
They represent failures in the I/O operations that ingest signals.

**Complete adapter error catalog:**

| Error Tag | Category | Fields | Retryable |
|-----------|----------|--------|-----------|
| `AdapterConnectError` | Connection | adapterId, kind, message, cause | Yes |
| `AdapterDisconnectError` | Connection | adapterId, message, cause | Yes |
| `HttpRequestError` | HTTP | adapterId, url, method, statusCode, message, cause | Conditional |
| `HttpParseError` | HTTP | adapterId, url, message, rawBody, cause | No |
| `HttpAuthError` | HTTP | adapterId, url, statusCode, message | No |
| `HttpTimeoutError` | HTTP | adapterId, url, timeoutMs | Yes |
| `SseConnectionError` | SSE | adapterId, url, message, cause | Yes |
| `WsConnectError` | WebSocket | adapterId, url, message, cause | Yes |
| `WsMessageError` | WebSocket | adapterId, message, cause | No |
| `NatsSubscribeError` | NATS | adapterId, subject, message, cause | Yes |
| `FileWatchError` | File | adapterId, path, message, cause | No |
| `FileParseError` | File | adapterId, path, format, message, cause | No |
| `RssFetchError` | RSS | adapterId, feedUrl, message, cause | Yes |
| `RssParseError` | RSS | adapterId, feedUrl, message, cause | No |
| `SerialConnectError` | Serial | adapterId, port, baudRate, message, cause | Yes |
| `SignalValidationError` | Validation | adapterId, kind, message, rawPayload | No |
| `SignalQueueFullError` | Backpressure | adapterId, queueCapacity | Yes (backoff) |

**Retryability rules:**
- Connection errors: Always retryable (with exponential backoff)
- Parse/validation errors: Never retryable (data is malformed)
- Auth errors: Not retryable (credentials must change)
- Timeout errors: Retryable (transient condition)
- Queue full: Retryable with backpressure (slow down ingestion)

**Conditional retryability:**
- `HttpRequestError` with `statusCode` in [500, 502, 503, 504]: Retryable
- `HttpRequestError` with `statusCode` in [400, 401, 403, 404, 422]: Not retryable

### 3.3 Layer 2: Transport Errors (NATS Fabric)

Transport errors arise within the Holonet NATS messaging fabric. They are organized
by service namespace.

**Connection namespace (3 errors):**

| Error Tag | Fields | Recovery |
|-----------|--------|----------|
| `Connection/Connect` | message, servers, cause | Retry with backoff |
| `Connection/Disconnect` | message, wasClean, cause | Reconnect |
| `Connection/JetStreamManager` | message, cause | Fatal — abort |

**Core namespace (5 errors):**

| Error Tag | Fields | Recovery |
|-----------|--------|----------|
| `Inner/Core/Publish` | message, subject, cause | Retry |
| `Inner/Core/Subscribe` | message, subject, cause | Resubscribe |
| `Inner/Core/Request` | message, subject, cause | Retry |
| `Inner/Core/Timeout` | subject, timeoutMs | Retry with longer timeout |
| `Inner/Core/Flush` | message, cause | Retry |

**KV namespace (5 errors):**

| Error Tag | Fields | Recovery |
|-----------|--------|----------|
| `Inner/KV/Bucket` | message, bucketName, cause | Fatal |
| `Inner/KV/Get` | message, bucketName, key, cause | Retry |
| `Inner/KV/Put` | message, bucketName, key, cause | Retry |
| `Inner/KV/Delete` | message, bucketName, key, cause | Retry |
| `Inner/KV/Watch` | message, bucketName, key, cause | Rewatch |

**Stream namespace (4 errors):**

| Error Tag | Fields | Recovery |
|-----------|--------|----------|
| `Inner/Streams/Info` | message, streamName, cause | Retry |
| `Inner/Streams/Add` | message, streamName, cause | Idempotent retry |
| `Inner/Streams/Update` | message, streamName, cause | Retry |
| `Inner/Streams/Delete` | message, streamName, cause | Retry |

**Publish namespace (2 errors):**

| Error Tag | Fields | Recovery |
|-----------|--------|----------|
| `Inner/Publish/Publish` | message, subject, cause | Retry |
| `Inner/Publish/Duplicate` | subject, msgId, seq | Ignore (idempotent) |

**Consumer namespace (4 errors):**

| Error Tag | Fields | Recovery |
|-----------|--------|----------|
| `Inner/Consumers/Get` | message, streamName, consumerName, cause | Retry |
| `Inner/Consumers/Add` | message, streamName, cause | Idempotent retry |
| `Inner/Consumers/Delete` | message, streamName, consumerName, cause | Retry |
| `Inner/Consumers/Consume` | message, streamName, cause | Resubscribe |

**Codec namespace (2 errors):**

| Error Tag | Fields | Recovery |
|-----------|--------|----------|
| `Codec/Encode` | message, schemaId, cause | Not retryable (schema mismatch) |
| `Codec/Decode` | message, subject, schemaId, cause | Not retryable (data corruption) |

**Hub namespace (4 errors):**

| Error Tag | Fields | Recovery |
|-----------|--------|----------|
| `Hub/Creation` | message, subject, cause | Retry |
| `Hub/Publish` | message, subject, cause | Retry |
| `Hub/Capacity` | message, subject | Backpressure |
| `Hub/NoMatch` | message, subject, availablePatterns | Configuration error |

**Micro namespace (4 errors):**

| Error Tag | Fields | Recovery |
|-----------|--------|----------|
| `Micro/AddService` | message, serviceName, cause | Retry |
| `Micro/ClientCreation` | message, cause | Retry |
| `Micro/DiscoveryQuery` | message, operation, serviceName, serviceId, cause | Retry |
| `Micro/StopService` | message, serviceName, serviceId, cause | Log and continue |

**High-level composite types:**

The NATS error module composes inner errors into service-level unions:
```
PubSub.PublishError   = Inner.Core.PublishError | Codec.EncodeError
PubSub.SubscribeError = Inner.Core.SubscribeError | Codec.DecodeError
KV.GetError           = Inner.KV.BucketError | Inner.KV.GetError | KV.NotFoundError | Codec.DecodeError
Stream.PublishError   = Inner.Publish.Error | Codec.EncodeError
```

### 3.4 Layer 3: Pipeline Errors (d2ts Graph)

Pipeline errors arise during d2ts graph execution. These errors propagate through
the Stream error channel.

| Error Tag | Operator | Fields | Recovery |
|-----------|----------|--------|----------|
| `MapTransformError` | map | operatorId, message, rawInput | Skip element |
| `FilterPredicateError` | filter | operatorId, message | Skip element |
| `JoinKeyError` | join | operatorId, side, message | Skip pair |
| `JoinStateError` | join | operatorId, message, cause | Retry join |
| `WindowClockError` | window | operatorId, expectedMs, actualMs | Use monotonic |
| `WindowOverflowError` | window | operatorId, capacity, received | Drop oldest |
| `AggregateError` | aggregate | operatorId, message | Skip window |
| `IterateConvergenceError` | iterate | operatorId, maxIterations | Emit partial |
| `SinkWriteError` | sink | operatorId, destination, cause | Retry |

**TSG.35-N12**: d2ts operators MUST handle element-level errors without terminating
the stream. A malformed element MUST be dropped with a diagnostic emission, not
propagated to terminate the entire pipeline.

### 3.5 Layer 4: Codec Errors (Schema Boundary)

Codec errors arise when data crosses a Schema validation boundary — encoding
domain objects for wire transport or decoding incoming payloads.

| Error Tag | Direction | Fields | Recovery |
|-----------|-----------|--------|----------|
| `Codec/Encode` | Outbound | message, schemaId, cause | Not retryable |
| `Codec/Decode` | Inbound | message, subject, schemaId, cause | Not retryable |
| `SignalValidationError` | Inbound | adapterId, kind, message, rawPayload | Not retryable |
| `XmlParseError` | Inbound | source, message, cause | Not retryable |
| `XmlValidationError` | Inbound | source, element, message | Not retryable |

Codec errors are fundamentally different from transient errors — they indicate a
structural mismatch between the sender's schema and the receiver's schema. Retrying
will not resolve the issue.

**TSG.35-N13**: Codec errors (encode/decode failures) MUST NOT be retried.
Implementations MUST log the full error context including schemaId and raw payload
(truncated to 1024 bytes for large payloads) for debugging.

### 3.6 Layer 5: Domain Errors (Business Logic)

Domain errors represent business rule violations within Tsingou's intelligence
analysis domain.

**Common domain errors (reusable across entities):**

| Error Tag | Fields | Domain |
|-----------|--------|--------|
| `ValidationError` | field, message, value | Any entity |
| `NotFoundError` | entityType, entityId | Any entity |
| `ConflictError` | entityType, entityId, expectedVersion, actualVersion | Versioned entities |
| `UnauthorizedError` | operation, reason | Access control |

**Alarm domain errors:**

| Error Tag | Fields | State Machine Rule |
|-----------|--------|-------------------|
| `AlarmNotFoundError` | alarmId | Entity does not exist |
| `InvalidAlarmTransitionError` | alarmId, currentState, attemptedState, reason | FSM transition violation |
| `AlarmAlreadyAcknowledgedError` | alarmId, acknowledgedAt, acknowledgedBy | Idempotency check |

**Work order domain errors:**

| Error Tag | Fields | State Machine Rule |
|-----------|--------|-------------------|
| `WorkOrderNotFoundError` | workOrderId | Entity does not exist |
| `InvalidWorkOrderStateError` | workOrderId, currentState, attemptedAction | FSM transition violation |
| `WorkOrderApprovalRequiredError` | workOrderId, requiredApprovalType | Authorization gate |

**Equipment state domain errors:**

| Error Tag | Fields | State Machine Rule |
|-----------|--------|-------------------|
| `EquipmentNotFoundError` | equipmentId | Entity does not exist |
| `InvalidEquipmentTransitionError` | equipmentId, currentState, attemptedState | FSM transition violation |

### 3.7 Layer 6: RPC Errors (Wire Protocol)

RPC errors use `Schema.TaggedError` for serialization across the WebSocket RPC
boundary. Each RPC error mirrors an internal domain error but uses Schema types
for wire safety.

**Internal-to-RPC error mapping:**

| Internal Error | RPC Error | Additional Schema Fields |
|---------------|-----------|--------------------------|
| `IIoTQueryError` | `RpcQueryError` | operation: Schema.String |
| `GraphQueryError` | `RpcGraphError` | message: Schema.String |
| `DeviceNotFoundError` | `RpcDeviceNotFoundError` | deviceId: DeviceId |
| `InvalidReadingError` | `RpcInvalidReadingError` | deviceId, message |
| `MachineNotFoundError` | `RpcMachineNotFoundError` | machineId: MachineId |
| `PlantNotFoundError` | `RpcPlantNotFoundError` | plantId: PlantId |
| `AlarmNotFoundError` | `RpcAlarmNotFoundError` | alarmId: AlarmId |
| `AlarmAlreadyAcknowledgedError` | `RpcAlarmAlreadyAcknowledgedError` | alarmId |

**Translation pattern:**
```typescript
const handleRpc = pipe(
  internalService.findAlarm(alarmId),
  Effect.catchTag('AlarmNotFoundError', (e) =>
    Effect.fail(new RpcAlarmNotFoundError({ alarmId: e.alarmId }))
  ),
  Effect.catchTag('IIoTQueryError', (e) =>
    Effect.fail(new RpcQueryError({ operation: e.operation, message: e.message }))
  ),
)
```

**TSG.35-N14**: Every internal domain error that can surface through an RPC endpoint
MUST have a corresponding `Schema.TaggedError` RPC error type. The RPC handler MUST
translate internal errors to RPC errors before returning. Internal error details
(stack traces, SQL queries, raw payloads) MUST NOT leak through RPC boundaries.

### 3.8 Layer 7: Rendering Errors (UI Boundary)

Rendering errors arise in the 4-layer visualization surface when components fail
to mount, update, or resolve their rendering targets.

| Error Tag | Layer | Fields | Recovery |
|-----------|-------|--------|----------|
| `ChartAdapterUnavailable` | visx | renderer, message | Fallback renderer |
| `ChartMountError` | visx | renderer, message | Show error placeholder |
| `ChartUpdateError` | visx | renderer, message | Keep stale view |
| `ChartInstanceNotFound` | visx | id | Remove from layout |

**Rendering error properties (enriched pattern):**

The geospatial search module demonstrates an enriched error pattern where each error
class carries computed properties for UI consumption:

```typescript
export class SearchNetworkError extends Data.TaggedError('SearchNetworkError')<{
  readonly message: string
  readonly url?: string
  readonly cause?: unknown
}> {
  readonly category = 'network' as const
  readonly recoverable = true
  readonly userMessage = 'Unable to connect to search server.'
  readonly retryDelayMs = 2000
}
```

**TSG.35-N15**: Rendering error classes SHOULD include `category`, `recoverable`,
`userMessage`, and `retryDelayMs` properties to enable the UI layer to render
appropriate error states and retry controls without parsing error internals.

### 3.9 Cross-Layer Error Catalog

**Total error count by layer (existing codebase):**

| Layer | Module | Error Types | Pattern |
|-------|--------|-------------|---------|
| 1. Adapter | tsingou-flow/adapters | 17 | Data.TaggedError |
| 2. Transport | holonet/nats | 33 | Data.TaggedError (namespaced) |
| 3. Pipeline | d2ts operators | 9 (specified) | Data.TaggedError |
| 4. Codec | holonet/nats, adapters | 4 | Data.TaggedError |
| 5. Domain | iiot/errors, geoint | 22+ | Data.TaggedError |
| 6. RPC | iiot/rpc | 12 | Schema.TaggedError |
| 7. Rendering | charting/v2 | 4 | Schema.TaggedError |
| **Total** | | **101+** | |

---

## 4. Error Recovery Strategies

### 4.1 Tag-Based Recovery (catchTag)

`Effect.catchTag` recovers from a single error type identified by its `_tag` field.
It narrows the error channel by removing the caught type.

**Type signature:**
```
catchTag: <K extends E['_tag']>(
  tag: K,
  handler: (error: Extract<E, {_tag: K}>) => Effect<A2, E2, R2>
) => Effect<A | A2, Exclude<E, {_tag: K}> | E2, R | R2>
```

**Tsingou usage — WebSocket adapter message errors:**
```typescript
Stream.catchTag('WsMessageError', (err) =>
  Stream.fromEffect(
    Effect.log(`[WsAdapter:${config.adapterId}] ${err.message}`)
  ).pipe(Stream.drain)
)
```

This catches `WsMessageError` in the stream, logs it, and continues processing.
The stream does not terminate on individual message errors.

### 4.2 Multi-Tag Recovery (catchTags)

`Effect.catchTags` handles multiple error types in a single block. Each tag maps
to an independent handler.

**Tsingou usage — WebSocket reconnection:**
```typescript
Effect.catchTags({
  SocketGenericError: (err) =>
    Effect.sync(() =>
      internals.updateHealth({
        status: 'degraded',
        errorCount: Atom.unsafeGet(internals.healthAtom).errorCount + 1,
      })
    ),
  SocketCloseError: (err) =>
    Effect.sync(() =>
      internals.updateHealth({ status: 'disconnected' })
    ),
})
```

Generic socket errors degrade the adapter; close events mark it disconnected.
The outer retry schedule then triggers reconnection.

**Tsingou usage — Alarm command handling:**
```typescript
Effect.catchTags({
  AlarmNotFoundError: (e) => Effect.fail(new HttpNotFound(e.alarmId)),
  InvalidAlarmTransitionError: (e) => Effect.fail(new HttpConflict(e.reason)),
  AlarmAlreadyAcknowledgedError: (e) => Effect.succeed({ status: 'already_acknowledged' }),
})
```

### 4.3 Exhaustive Error Handling

When the error channel is a discriminated union, `catchTags` can handle every variant
exhaustively. The compiler verifies that all tags are covered.

```typescript
pipe(
  processSignal(signal),
  Effect.catchTags({
    SignalValidationError: (e) => Effect.log(`Validation: ${e.message}`),
    SignalQueueFullError: (e) => Effect.log(`Queue full: ${e.queueCapacity}`),
  })
)
// Result type: Effect<void, never, R>
// Error channel is now `never` — all errors handled
```

**TSG.35-N16**: At RPC and HTTP boundaries, error handling MUST be exhaustive —
every possible error tag in the service method's error channel MUST be explicitly
handled or translated. The resulting error channel at the boundary MUST be the
RPC error union, not the internal error union.

### 4.4 Fallback Chains (orElse)

`Effect.orElse` provides an alternative effect when the primary fails:

```typescript
const fetchSignal = pipe(
  fetchFromPrimary(id),
  Effect.orElse(() => fetchFromCache(id)),
  Effect.orElse(() => fetchFromFallback(id)),
)
```

Each fallback attempt replaces the previous error. The final error (if all fail)
is from the last fallback in the chain.

### 4.5 Error Absorption (orDie)

`Effect.orDie` converts expected errors to defects, removing them from the E channel.
Use sparingly — only when the error truly represents an impossible condition.

```typescript
const config = yield* loadConfig.pipe(
  Effect.orDie  // If config loading fails, it's a defect — system cannot start
)
```

**TSG.35-N17**: `Effect.orDie` MUST only be used when the error condition represents
a violation of a system invariant (e.g., missing configuration at startup, corrupted
internal state). It MUST NOT be used to silence domain errors or to simplify error
handling.

### 4.6 Sandbox and Cause Inspection

`Effect.sandbox` promotes the full `Cause<E>` into the error channel, enabling
inspection of defects and interruptions:

```typescript
pipe(
  riskyOperation,
  Effect.sandbox,
  Effect.catchAll((cause) => {
    if (Cause.isDie(cause)) {
      // Log defect for debugging
      return Effect.logError(`Defect: ${Cause.pretty(cause)}`)
    }
    if (Cause.isInterrupt(cause)) {
      // Clean shutdown
      return Effect.logInfo('Operation interrupted')
    }
    // Re-fail with original error
    return Effect.failCause(cause)
  }),
  Effect.unsandbox,
)
```

### 4.7 Recovery Strategy Decision Matrix

| Error Category | Strategy | Schedule | Example |
|---------------|----------|----------|---------|
| Transient connection | Retry with backoff | `Schedule.exponential(1s)` | WsConnectError |
| Transient timeout | Retry with jitter | `Schedule.exponential(500ms).pipe(Schedule.jittered)` | HttpTimeoutError |
| Authentication | Fail fast | None | HttpAuthError |
| Validation/parse | Drop element, log | None | SignalValidationError |
| Rate limit | Retry after delay | `Schedule.fixed(retryAfterMs)` | SearchRateLimitError |
| Not found | Fail with domain error | None | AlarmNotFoundError |
| State conflict | Retry with read-modify-write | `Schedule.recurs(3)` | ConflictError |
| Queue full | Backpressure/backoff | `Schedule.exponential(100ms)` | SignalQueueFullError |
| Codec error | Fail, log payload | None | Codec/Decode |
| Duplicate message | Ignore (idempotent) | None | Inner/Publish/Duplicate |
| System defect | Die, log cause | None | Assertion violation |

---

## 5. Retry Policies and Schedule Composition

### 5.1 Schedule Primitives

Effect's `Schedule` module provides composable retry/repeat policies. Each primitive
defines a single behavior dimension.

| Primitive | Behavior | Example |
|-----------|----------|---------|
| `Schedule.once` | Retry exactly once | Simple error recovery |
| `Schedule.recurs(n)` | Retry up to n times | Bounded retry |
| `Schedule.forever` | Retry indefinitely | Long-running reconnection |
| `Schedule.fixed(d)` | Fixed delay between retries | Polling |
| `Schedule.exponential(base)` | Doubling delay from base | Backoff |
| `Schedule.fibonacci(one)` | Fibonacci-sequence delay | Gradual backoff |
| `Schedule.spaced(d)` | Fixed spacing from completion | Rate limiting |
| `Schedule.jittered` | Add +-20% random jitter | Thundering herd prevention |

### 5.2 Schedule Combinators

Combinators compose primitives into complex policies:

**Intersection (both must continue):**
```typescript
Schedule.exponential(Duration.millis(500)).pipe(
  Schedule.intersect(Schedule.recurs(5))
)
// Exponential backoff, but stop after 5 attempts
```

**Union (either continues):**
```typescript
Schedule.exponential(Duration.millis(100)).pipe(
  Schedule.union(Schedule.fixed(Duration.seconds(30)))
)
// Start with exponential, switch to fixed 30s when exponential exceeds it
```

**Either (stop at first completion):**
```typescript
Schedule.exponential(Duration.millis(1000)).pipe(
  Schedule.either(Schedule.recurs(10))
)
// Exponential backoff, maximum 10 attempts
```

**Sequential (b after a exhausts):**
```typescript
Schedule.recurs(3).pipe(
  Schedule.andThen(Schedule.spaced(Duration.minutes(1)))
)
// 3 immediate retries, then switch to 1/minute polling
```

**Tap (side effects on each retry):**
```typescript
Schedule.tapOutput(() =>
  Effect.log('Reconnecting...')
)
// Log on each retry attempt
```

### 5.3 Conditional Retry by Error Tag

Not all errors should be retried. `Schedule.recurWhile` filters retry conditions:

```typescript
Schedule.recurWhile<HttpRequestError | HttpParseError | HttpTimeoutError>(
  (err) => err._tag === 'HttpTimeoutError'
)
// Only retry timeouts — stop immediately on parse or request errors
```

For stream-level retry:
```typescript
Stream.retry(
  Schedule.recurWhile<AdapterError>(
    (err) => err._tag !== 'HttpAuthError' && err._tag !== 'HttpParseError'
  )
)
// Retry all adapter errors EXCEPT auth and parse errors
```

### 5.4 Adapter Reconnection Schedules

Each adapter type has a tailored reconnection schedule.

**WebSocket adapter:**
```typescript
const reconnectSchedule = Schedule.exponential(Duration.millis(1000)).pipe(
  Schedule.either(Schedule.recurs(reconnectConfig.maxAttempts ?? 10)),
  Schedule.tapOutput(() =>
    Effect.log(`[WsAdapter:${config.adapterId}] Reconnecting...`)
  ),
)
// 1s, 2s, 4s, 8s, 16s... up to 10 attempts
```

**HTTP adapter (transient retry):**
```typescript
HttpClient.retryTransient({
  schedule: Schedule.exponential(Duration.millis(500)).pipe(
    Schedule.intersect(Schedule.recurs(5)),
  ),
})
// 500ms, 1s, 2s, 4s, 8s — 5 attempts for 5xx errors
```

**RSS adapter:**
```typescript
Schedule.exponential(Duration.millis(1000)).pipe(
  Schedule.intersect(Schedule.recurs(3)),
)
// 1s, 2s, 4s — 3 attempts for feed fetch failures
```

**NATS adapter:**
```typescript
Schedule.exponential(Duration.millis(500)).pipe(
  Schedule.intersect(Schedule.recurs(10)),
  Schedule.jittered,
)
// 500ms-1s (jittered), doubling, up to 10 attempts
```

### 5.5 Transport Retry Schedules

NATS transport operations use distinct retry profiles.

| Operation | Schedule | Rationale |
|-----------|----------|-----------|
| Publish | `exponential(100ms) & recurs(5)` | Fast retry for publish |
| Subscribe | `exponential(500ms) & recurs(10)` | More patient for subscriptions |
| KV Get | `exponential(200ms) & recurs(3)` | Quick reads |
| KV Put | `exponential(500ms) & recurs(5)` | Important writes |
| Stream Ensure | `exponential(1s) & recurs(3)` | Infrastructure setup |
| Connection | `exponential(1s) & recurs(30) + jitter` | Long reconnection |

### 5.6 Rate-Limited Retry

When external APIs return rate limit information, the retry schedule MUST respect
the `Retry-After` header or equivalent.

```typescript
const rateLimitSchedule = (retryAfterMs: number) =>
  Schedule.fixed(Duration.millis(retryAfterMs)).pipe(
    Schedule.intersect(Schedule.recurs(1)),
  )
// Wait exactly the requested duration, then retry once
```

**TSG.35-N18**: When a source API returns a rate limit response (HTTP 429 with
`Retry-After` header, or equivalent), the adapter MUST respect the requested delay.
The retry schedule MUST NOT use a shorter delay than the API-specified `Retry-After`
value.

### 5.7 Schedule Selection Criteria

**Decision tree for selecting retry schedules:**

```
Is the error transient?
│
├── NO → Do not retry. Fail immediately.
│
├── YES → Is there a server-specified retry delay?
│   │
│   ├── YES → Use Schedule.fixed(retryAfter)
│   │
│   └── NO → Is the operation idempotent?
│       │
│       ├── YES → Is the system under load?
│       │   │
│       │   ├── YES → exponential + jitter
│       │   │
│       │   └── NO → exponential (no jitter)
│       │
│       └── NO → Is the operation critical?
│           │
│           ├── YES → recurs(1) with immediate retry
│           │
│           └── NO → Do not retry. Fail.
```

---

## 6. Error Propagation Through d2ts Operators

### 6.1 Stream Error Channel Semantics

The d2ts pipeline processes signals as Effect Streams. Each stream carries an error
channel `E` that accumulates errors from the operators it passes through.

```
Source<Signal, AdapterError>
  → map(transform):   Stream<Enriched, AdapterError | MapTransformError>
  → filter(pred):     Stream<Filtered, AdapterError | MapTransformError | FilterPredicateError>
  → join(other):      Stream<Joined, ... | JoinKeyError | JoinStateError>
  → window(5min):     Stream<Windowed, ... | WindowClockError | WindowOverflowError>
  → aggregate(stats): Stream<Stats, ... | AggregateError>
  → sink(output):     Stream<void, ... | SinkWriteError>
```

The error channel grows wider at each stage. Intermediate error handling via
`Stream.catchTag` narrows it back.

### 6.2 Map Operator Error Propagation

The `map` operator transforms each element. If the transform function can fail:

```typescript
const enriched = signals.pipe(
  Stream.mapEffect((signal) =>
    Effect.gen(function* () {
      const enrichment = yield* lookupMetadata(signal.sourceId)
      return { ...signal, metadata: enrichment }
    })
  ),
  Stream.catchTag('MetadataLookupError', (e) =>
    Stream.fromEffect(
      Effect.log(`Skipping metadata for ${e.sourceId}: ${e.message}`)
    ).pipe(Stream.drain)
  ),
)
```

On error, the element is dropped and the stream continues. The `catchTag` removes
`MetadataLookupError` from the error channel.

### 6.3 Filter Operator Error Behavior

Filters that throw are converted to defects. Filter predicates MUST be pure and
total — they MUST NOT throw.

```typescript
// CORRECT — pure predicate
Stream.filter((signal) => signal.confidence > 0.5)

// INCORRECT — impure predicate that can throw
Stream.filter((signal) => JSON.parse(signal.payload).valid)
```

**TSG.35-N19**: d2ts filter predicates MUST be pure, total functions that always
return a boolean. Filter predicates MUST NOT throw exceptions, perform I/O, or
access mutable state.

### 6.4 Join Operator Partial Failure

When a `join(left, right)` operation has asymmetric failure — one side fails while
the other continues:

**Scenario 1: Left source fails temporarily**
```
Time 0-10: Both sides producing → Join emits matched pairs
Time 10-15: Left fails → Join buffers right, emits nothing
Time 15+:   Left recovers → Join catches up, emits delayed pairs
```

**Scenario 2: Left source fails permanently**
```
Time 0-10: Both sides producing → Join emits matched pairs
Time 10+:  Left fails → After timeout, join degrades to right-only mode
           → Emits right elements with null left enrichment
           → Health atom reflects degraded join state
```

**TSG.35-N20**: d2ts join operators MUST support graceful degradation when one input
stream fails. The join MUST continue emitting elements from the healthy stream with
appropriate null/default values for the failed side. The join MUST emit a health
status change event when degradation begins and when it recovers.

### 6.5 Window Operator Error Handling

The `window(duration)` operator groups elements into time-based windows. Error
conditions include:

**Clock skew:**
```
Expected window: [T, T+5min]
Actual signal timestamp: T-2min (arrived late / clock skewed)
```
Resolution: Assign to nearest valid window. Log clock skew metric.

**Buffer overflow:**
```
Window buffer capacity: 10,000 elements
Received in window: 15,000 elements
```
Resolution: Drop oldest elements. Emit `WindowOverflowError` metric. The window
MUST still emit an aggregation (partial) at window close.

**Empty window:**
```
No elements received during [T, T+5min]
```
Resolution: NOT an error. Emit empty aggregation with zero counts.

### 6.6 Aggregate Operator Error Handling

Aggregate operators compute statistics over windows. Errors arise from:

- **Division by zero**: Empty window with mean/variance computation
- **Numeric overflow**: Accumulator exceeds safe integer range
- **NaN propagation**: One bad value poisons the entire aggregate

Resolution: Use Welford's online algorithm (numerically stable, handles n=0).
See [TSG.27, Section 1.1] for algorithm specification.

### 6.7 Iterate Operator Error Convergence

The `iterate` operator performs recursive refinement until a convergence criterion
is met. Error condition: Non-convergence after maximum iterations.

```
iterate(initial, refine, converged?, maxIter=100)
```

If `maxIter` is reached without convergence:
- Emit the best result so far (partial convergence)
- Emit `IterateConvergenceError` as a diagnostic
- Do NOT terminate the stream

### 6.8 Sink Error Handling

Sinks write processed signals to output destinations (NATS subjects, KV stores,
rendering atoms). Sink errors:

- **NATS publish failure**: Retry with transport schedule (Section 5.5)
- **KV write failure**: Retry, then degrade to in-memory only
- **Atom update failure**: Should not happen (synchronous) — defect if it does
- **Rendering error**: Emit error state to UI health atom

### 6.9 Error Propagation Algebra

Formal rules for error propagation through d2ts operator chains:

```
E(map(f, stream))       = E(stream) | E(f)
E(filter(p, stream))    = E(stream)           // predicates must be pure
E(join(left, right))    = E(left) | E(right) | JoinError
E(window(d, stream))    = E(stream) | WindowError
E(aggregate(fn, stream))= E(stream) | AggregateError
E(iterate(f, stream))   = E(stream) | IterateError
E(catchTag(tag, h, s))  = Exclude<E(s), {_tag: tag}> | E(h)
```

These rules enable compile-time verification that all error paths are handled
before the pipeline reaches a sink.

---

## 7. Failure Isolation and Containment

### 7.1 Containment Hierarchy

Tsingou's failure containment follows a strict hierarchy. Failures at lower levels
MUST NOT cascade to higher levels without explicit escalation.

```
Level 0: Signal (element)
  │ Failure: Drop malformed signal, emit diagnostic
  │ Blast radius: Single element
  │
Level 1: Adapter (source)
  │ Failure: Adapter enters degraded/disconnected state
  │ Blast radius: Single source — other adapters unaffected
  │
Level 2: Pipeline (d2ts subgraph)
  │ Failure: Subgraph enters error state
  │ Blast radius: One analysis path — parallel paths unaffected
  │
Level 3: Platform (entire system)
  │ Failure: Should never happen — defense in depth
  │ Blast radius: Total (requires restart)
```

**TSG.35-N21**: Failures MUST be contained at the lowest possible level. A signal
validation error (Level 0) MUST NOT degrade an adapter (Level 1). An adapter
failure (Level 1) MUST NOT terminate a pipeline (Level 2). Platform-level failures
(Level 3) MUST only occur due to unrecoverable defects.

### 7.2 Adapter-Scoped Isolation (Effect.Scope)

Each adapter runs within its own `Effect.Scope`, providing resource isolation:

```typescript
export class HttpSourceAdapter extends Effect.Service<HttpSourceAdapter>()(
  'tsingou/adapter/Http',
  {
    scoped: Effect.gen(function* () {
      // All resources acquired here are scoped to THIS adapter
      const client = yield* HttpClient.HttpClient
      // ...

      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          // Cleanup runs when THIS adapter's scope closes
          // Other adapters are unaffected
          yield* Effect.log(`[HttpAdapter:${config.adapterId}] Finalized`)
        })
      )
    })
  }
)
```

**Scope isolation guarantees:**
- Resource finalization is adapter-scoped
- Fiber interruption propagates only within the adapter's scope
- Error propagation stops at the adapter boundary
- Memory allocated by the adapter is released when its scope closes

### 7.3 Blast Radius Control

Each adapter reports its health via an effect-atom. The platform monitors all
adapter health atoms to assess system-wide health.

```typescript
type AdapterHealth = {
  status: 'connected' | 'degraded' | 'disconnected'
  errorCount: number
  lastError?: string
  lastErrorAt?: Date
}

// Per-adapter health atom
const healthAtom = Atom.make<AdapterHealth>({
  status: 'disconnected',
  errorCount: 0,
})
```

Health state transitions:
```
connected ─── (error) ──→ degraded
degraded  ─── (more errors) ──→ disconnected
degraded  ─── (success) ──→ connected
disconnected ─── (reconnect success) ──→ connected
```

### 7.4 Circuit Breaker Pattern

Per-adapter circuit breakers prevent cascading failures when external sources
are unavailable.

**State machine:**
```
┌────────┐   threshold     ┌────────┐   timeout     ┌───────────┐
│ CLOSED │───failures──────▶│  OPEN  │──────────────▶│ HALF-OPEN │
│        │◀──success───────│        │               │           │
└────────┘                 └────────┘               └─────┬─────┘
                                ▲                         │
                                │     probe failure       │
                                └─────────────────────────┘
                                      probe success
                                ┌─────────────────────────┘
                                ▼
                           ┌────────┐
                           │ CLOSED │
                           └────────┘
```

**Parameters:**

| Parameter | Default | Range | Description |
|-----------|---------|-------|-------------|
| `failureThreshold` | 5 | [2, 20] | Consecutive failures to open |
| `resetTimeout` | 30s | [5s, 5min] | Duration in OPEN before probing |
| `halfOpenMax` | 1 | [1, 3] | Concurrent probes in HALF-OPEN |
| `successThreshold` | 2 | [1, 5] | Consecutive successes to close |

**Behavior by state:**

| State | Request Handling | Side Effect |
|-------|-----------------|-------------|
| CLOSED | Pass through to adapter | Count consecutive failures |
| OPEN | Fast-fail immediately | Emit `AdapterCircuitOpenEvent` |
| HALF-OPEN | Allow `halfOpenMax` probes | Emit `AdapterProbeEvent` |

**TSG.35-N22**: Each source adapter MUST implement a circuit breaker. The circuit
breaker MUST emit events on state transitions (closed→open, open→half-open,
half-open→closed) for observability. The circuit breaker MUST NOT prevent the
platform from attempting reconnection — it only prevents request amplification
during outages.

### 7.5 Bulkhead Pattern

Bulkheads limit the concurrent resource consumption of each adapter to prevent
one misbehaving source from starving others.

**Per-adapter resource limits:**

| Resource | Limit | Enforcement |
|----------|-------|-------------|
| Concurrent HTTP requests | 10 | `Effect.Semaphore` |
| WebSocket message buffer | 1000 | Bounded `Queue` |
| NATS subscription buffer | 5000 | JetStream `max_pending` |
| Signal processing queue | 10000 | `PubSub.bounded(10000)` |

**TSG.35-N23**: Each adapter MUST enforce bounded resource consumption. Unbounded
queues, unbounded concurrency, and unbounded buffers are prohibited. When a bound
is reached, the adapter MUST apply backpressure (slow down ingestion) rather than
dropping signals silently.

### 7.6 Graceful Degradation

When an adapter enters degraded or disconnected state, the platform continues
operating with reduced capability.

**Degradation levels:**

| Level | Trigger | System Behavior |
|-------|---------|----------------|
| L0: Full | All adapters connected | Normal operation |
| L1: Degraded | 1+ adapters degraded | Alert, continue with available |
| L2: Partial | 1+ adapters disconnected | Warning, single-source mode |
| L3: Minimal | All adapters disconnected | Show cached data, retry all |

**Degradation does NOT mean:**
- Stopping analysis on available sources
- Clearing cached/buffered data
- Terminating user sessions
- Showing error screens without data

### 7.7 Quorum Policies

For multi-source fusion operations (TSG.4), quorum policies define the minimum
number of contributing sources required for valid output.

```typescript
type QuorumPolicy = {
  readonly minSources: number        // Minimum contributing sources
  readonly criticalSources: string[] // Sources that MUST contribute
  readonly degradedBehavior: 'continue' | 'warn' | 'halt'
}
```

When quorum is not met:
- `continue`: Emit results with degraded confidence (see TSG.4, Section 9)
- `warn`: Emit results with warning annotation
- `halt`: Stop emitting until quorum is restored

---

## 8. Error-to-Domain Mapping

### 8.1 Internal-to-RPC Error Translation

Internal `Data.TaggedError` types MUST be translated to `Schema.TaggedError` types
at the RPC boundary. This translation serves three purposes:

1. **Serialization**: Schema errors can be encoded for wire transport
2. **Information hiding**: Internal details (SQL queries, stack traces) are stripped
3. **Contract stability**: RPC error types are part of the public API contract

**Translation rules:**

| Internal Error Property | RPC Error Property | Mapping |
|------------------------|-------------------|---------|
| `message` (internal detail) | `message` (user-safe) | Sanitize |
| `cause` (stack trace) | (omitted) | Strip |
| `entityId` | Same | Pass through |
| `rawPayload` | (omitted) | Strip |
| `statusCode` | Same | Pass through |

### 8.2 Error-to-HTTP Status Mapping

When errors surface through the HTTP API (TSG.34), they map to HTTP status codes:

| Error Category | HTTP Status | Response Body |
|---------------|-------------|---------------|
| ValidationError | 400 Bad Request | `{ error: tag, message, field }` |
| UnauthorizedError | 401 Unauthorized | `{ error: tag, message }` |
| NotFoundError | 404 Not Found | `{ error: tag, entityType, entityId }` |
| ConflictError | 409 Conflict | `{ error: tag, expectedVersion, actualVersion }` |
| SignalQueueFullError | 429 Too Many Requests | `{ error: tag, retryAfter }` |
| IIoTQueryError | 500 Internal Server Error | `{ error: tag, operation }` |
| GraphQueryError | 500 Internal Server Error | `{ error: tag }` |

**TSG.35-N24**: HTTP error responses MUST include the error `_tag` in the response
body for client-side programmatic handling. HTTP error responses MUST NOT include
stack traces, SQL queries, or other internal implementation details.

### 8.3 Error-to-STIX Confidence Impact

Source adapter errors affect the confidence level of fused intelligence products
(see TSG.4, Section 9 — Source Reliability Assessment).

| Error Pattern | Confidence Impact | Admiralty Code Effect |
|--------------|-------------------|---------------------|
| Intermittent timeouts | Slight degradation (0.9x) | Reliability unchanged |
| Repeated auth failures | Major degradation (0.5x) | Source reliability → F (cannot judge) |
| Codec/parse errors | Data quality concern (0.7x) | Information reliability down 1 grade |
| Connection loss | Source unavailable (0.0x) | Source reliability → F until recovered |

### 8.4 Error-to-Alarm Escalation

Persistent adapter errors can trigger IIoT alarm generation:

| Condition | Alarm Priority | Delay |
|-----------|---------------|-------|
| Adapter disconnected > 5 minutes | LOW | After 5 min |
| Adapter disconnected > 30 minutes | MEDIUM | After 30 min |
| Multiple adapters disconnected | HIGH | Immediate |
| All adapters disconnected | CRITICAL | Immediate |
| Circuit breaker opened | LOW | Immediate |
| Error rate > 50% over 5 minutes | MEDIUM | After 5 min |

---

## 9. Error Observability and Telemetry

### 9.1 Structured Error Logging

All error logging MUST use Effect's structured logging with annotations:

```typescript
Effect.logWarning('Adapter degraded').pipe(
  Effect.annotateLogs('adapterId', config.adapterId),
  Effect.annotateLogs('errorTag', err._tag),
  Effect.annotateLogs('errorCount', String(errorCount)),
  Effect.annotateLogs('circuitState', circuitBreaker.state),
)
```

**Required annotations for error logs:**

| Annotation | Required When | Example |
|------------|--------------|---------|
| `adapterId` | Adapter errors | `http-shodan-api` |
| `errorTag` | All errors | `HttpTimeoutError` |
| `errorCount` | Repeated errors | `7` |
| `operation` | Operation errors | `fetchSignals` |
| `subject` | NATS errors | `tsingou.signals.raw` |
| `circuitState` | Circuit breaker events | `open` |
| `traceId` | Distributed traces | `abc-123-def` |

**TSG.35-N25**: Error log entries MUST include the `errorTag` annotation with the
error's `_tag` value. Error log entries for adapter errors MUST include the
`adapterId` annotation.

### 9.2 Health Atoms (Reactive Error State)

Each adapter exposes a health atom that the UI subscribes to reactively:

```typescript
// Health atom definition
export const healthAtom = Atom.make<AdapterHealth>({
  status: 'disconnected',
  errorCount: 0,
})

// Health atom update on error
internals.updateHealth({
  status: 'degraded',
  errorCount: prevCount + 1,
  lastError: err._tag,
  lastErrorAt: new Date(),
})

// UI subscription (React)
const health = useAtomValue(adapter.healthAtom)
```

The health atom provides:
- **Instantaneous state**: Current adapter status
- **Error trending**: Error count for rate computation
- **Last error context**: Most recent error tag and timestamp
- **Reactive updates**: UI re-renders on state change

### 9.3 Error Telemetry Subjects

Error events are published to NATS subjects for centralized monitoring:

| Subject Pattern | Payload | Publisher |
|----------------|---------|-----------|
| `tsingou.adapter.{id}.error` | `{ tag, message, timestamp }` | Adapter |
| `tsingou.adapter.{id}.health` | `AdapterHealth` | Adapter |
| `tsingou.adapter.{id}.circuit` | `{ state, timestamp }` | Circuit breaker |
| `tsingou.pipeline.error` | `{ operatorId, tag, message }` | d2ts operator |
| `tsingou.platform.health` | `{ adapters: Record<id, health> }` | Platform monitor |

### 9.4 Error Rate Metrics

Error rates are computed using sliding windows (see TSG.27, Section 3 — EWMA):

```
Error rate = EWMA(errors_per_minute, lambda=0.1)
```

**Thresholds:**

| Metric | Warning | Critical |
|--------|---------|----------|
| Adapter error rate | > 10/min | > 50/min |
| Pipeline error rate | > 5/min | > 20/min |
| Codec error rate | > 1/min | > 5/min |
| Overall error rate | > 20/min | > 100/min |

### 9.5 Error Correlation and Tracing

Errors are correlated across layers using trace IDs propagated through the d2ts
pipeline:

```
Signal ingestion (adapter)
  → traceId: t-001
    → transform (pipeline)
      → traceId: t-001
        → join (pipeline)
          → traceId: t-001
            → sink (NATS publish)
              → traceId: t-001
```

If any stage fails, the trace ID links the error back to the original signal
and the adapter that produced it.

---

## 10. User-Facing Error Rendering

### 10.1 Error State Schema

The UI error state schema provides all information needed for rendering:

```typescript
export class SearchErrorData extends Schema.Class<SearchErrorData>('SearchErrorData')({
  category: SearchErrorCategory,     // network, timeout, rate_limit, server, validation, auth
  message: Schema.String,            // Internal error message
  userMessage: Schema.String,        // Human-readable message for display
  recoverable: Schema.Boolean,       // Whether retry is possible
  retryDelayMs: Schema.optionalWith(Schema.Number, { default: () => 0 }),
  details: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { default: () => ({}) }
  ),
  timestamp: Schema.DateTimeUtcFromSelf,
})
```

### 10.2 Error Category Classification

Errors are classified into user-facing categories:

| Category | User Interpretation | Icon | Color |
|----------|--------------------|----- |-------|
| `network` | Connection issue | WiFi-off | Orange |
| `timeout` | Slow response | Clock | Yellow |
| `rate_limit` | Too many requests | Gauge | Orange |
| `server` | Server problem | Server | Red |
| `validation` | Invalid input | Warning | Yellow |
| `not_found` | Missing resource | Search | Gray |
| `auth` | Access denied | Lock | Red |
| `unknown` | Unexpected issue | Alert | Red |

**Recoverability by category:**

| Category | Recoverable | Auto-Retry |
|----------|-------------|------------|
| `network` | Yes | Yes (exponential backoff) |
| `timeout` | Yes | Yes (with longer timeout) |
| `rate_limit` | Yes | Yes (after delay) |
| `server` | Yes | Yes (exponential backoff) |
| `validation` | No | No |
| `not_found` | No | No |
| `auth` | No | No (requires re-authentication) |
| `unknown` | No | No |

### 10.3 User Message Generation

Error classes generate user-facing messages from their error context:

```typescript
// Static message
readonly userMessage = 'Unable to connect to search server.'

// Dynamic message from context
get userMessage() {
  return `${this.source} API rate limit reached. ${
    this.retryAfterMs
      ? `Retry in ${Math.ceil(this.retryAfterMs / 1000)}s.`
      : 'Please wait before retrying.'
  }`
}

// Field-specific message
get userMessage() {
  return this.field ? `Invalid ${this.field}: ${this.message}` : this.message
}
```

**TSG.35-N26**: User-facing error messages MUST NOT expose internal implementation
details (file paths, SQL queries, stack traces, API keys, server hostnames).
Messages MUST provide actionable guidance when possible (e.g., "Retry in 5s"
rather than "Error 429").

### 10.4 Retry UI State Machine

The retry state machine tracks user-visible retry attempts:

```typescript
export interface SearchErrorState {
  readonly error: SearchError
  readonly timestamp: Date
  readonly retryCount: number
  readonly maxRetries: number
  readonly canRetry: boolean
}
```

State transitions:
```
Initial Error
  → { retryCount: 0, canRetry: error.recoverable }
    → Retry Attempt
      → { retryCount: 1, canRetry: 1 < maxRetries }
        → Retry Attempt
          → { retryCount: 2, canRetry: 2 < maxRetries }
            → Max Retries Reached
              → { retryCount: 3, canRetry: false }
```

### 10.5 Error Rendering in 4-Layer Surface

Each of Tsingou's 4 rendering layers handles errors differently:

| Layer | Error Rendering | Recovery UI |
|-------|----------------|-------------|
| R3F (3D) | Render error mesh (red wireframe) | Click to retry |
| visx (SVG) | Show "No data" placeholder with icon | Retry button |
| p5 (Canvas) | Stop animation, show static noise | Auto-retry |
| DOM (React) | Toast notification + inline message | Retry + dismiss |

---

## 11. Testing Error Paths

### 11.1 Error Injection Patterns

Test error paths by constructing tagged errors directly:

```typescript
import { it } from '@effect/vitest'

it.effect('handles adapter timeout', () =>
  Effect.gen(function* () {
    const result = yield* pipe(
      processSignal(testSignal),
      Effect.provideService(HttpClient, failingClient(
        new HttpTimeoutError({
          adapterId: 'test',
          url: 'https://example.com/api',
          timeoutMs: 5000,
        })
      )),
    )
    expect(result.status).toBe('degraded')
  })
)
```

### 11.2 Tagged Error Assertion Patterns

Verify that effects fail with specific tagged errors:

```typescript
it.effect('rejects invalid alarm transition', () =>
  pipe(
    acknowledgeAlarm({ alarmId: 'ALM-001' }),
    Effect.flip, // Convert E to A for assertion
    Effect.map((error) => {
      expect(error._tag).toBe('InvalidAlarmTransitionError')
      expect(error.currentState).toBe('cleared')
      expect(error.attemptedState).toBe('acknowledged')
    }),
    Effect.provide(TestLayer),
  )
)
```

Alternative using `Effect.exit`:
```typescript
it.effect('fails with NotFoundError', () =>
  Effect.gen(function* () {
    const exit = yield* Effect.exit(findAlarm('nonexistent'))
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) {
      const cause = exit.cause
      expect(Cause.failureOption(cause)).toEqual(
        Option.some(new AlarmNotFoundError({ alarmId: 'nonexistent' }))
      )
    }
  }).pipe(Effect.provide(TestLayer))
)
```

### 11.3 Cause Inspection in Tests

Test that Cause preserves error chains:

```typescript
it.effect('preserves sequential cause in finalizer failure', () =>
  Effect.gen(function* () {
    const exit = yield* Effect.exit(
      Effect.acquireRelease(
        Effect.fail(new AdapterConnectError({...})),
        () => Effect.fail(new AdapterDisconnectError({...})),
      )
    )
    if (Exit.isFailure(exit)) {
      const causes = Cause.sequential(exit.cause)
      expect(causes.length).toBe(2)
    }
  })
)
```

### 11.4 Schedule Testing

Test retry schedules with `TestClock`:

```typescript
it.effect('retries with exponential backoff', () =>
  Effect.gen(function* () {
    const clock = yield* TestClock
    let attempts = 0

    const result = yield* pipe(
      Effect.sync(() => { attempts++ }),
      Effect.flatMap(() =>
        attempts < 3
          ? Effect.fail(new HttpTimeoutError({...}))
          : Effect.succeed('ok')
      ),
      Effect.retry(Schedule.exponential(Duration.millis(100))),
    )

    expect(attempts).toBe(3)
    expect(result).toBe('ok')
  })
)
```

### 11.5 Circuit Breaker Testing

Test circuit breaker state transitions:

```typescript
it.effect('opens circuit after threshold failures', () =>
  Effect.gen(function* () {
    const cb = yield* CircuitBreaker.make({ failureThreshold: 3 })

    // 3 failures should open the circuit
    for (let i = 0; i < 3; i++) {
      yield* cb.execute(Effect.fail(new AdapterConnectError({...})))
        .pipe(Effect.ignore)
    }

    expect(yield* cb.state).toBe('open')

    // Next call should fast-fail
    const exit = yield* Effect.exit(
      cb.execute(Effect.succeed('should not reach'))
    )
    expect(Exit.isFailure(exit)).toBe(true)
  })
)
```

---

## 12. Normative Summary

| ID | Requirement | Section |
|----|-------------|---------|
| TSG.35-N1 | Service methods MUST declare complete error channels; MUST NOT use `unknown` or `Error` | 1.1 |
| TSG.35-N2 | MUST NOT use `Effect.die()` for domain failures; reserved for invariant violations | 1.2 |
| TSG.35-N3 | Signal emission MUST use `Effect.uninterruptibleMask` | 1.2 |
| TSG.35-N4 | Cause handling MUST cover all variants (Empty, Fail, Die, Interrupt, Sequential, Parallel) | 1.3 |
| TSG.35-N5 | MUST NOT use try/catch except at FFI boundaries; convert via `Effect.try()` | 1.5 |
| TSG.35-N6 | Internal service errors MUST use `Data.TaggedError`; SHOULD include `cause` field | 2.1 |
| TSG.35-N7 | Cross-boundary errors MUST use `Schema.TaggedError` with Schema types | 2.2 |
| TSG.35-N8 | Tags MUST be unique within union scope; flat tags PascalCase+Error; namespaced use `/` | 2.3 |
| TSG.35-N9 | Every error MUST include `message` field; wrapping errors SHOULD include `cause` | 2.4 |
| TSG.35-N10 | Every error module MUST export a union type following `{Module}Error` pattern | 2.5 |
| TSG.35-N11 | Subsystems with >10 error types SHOULD use namespace-scoped hierarchies | 2.6 |
| TSG.35-N12 | d2ts operators MUST drop malformed elements, not terminate the stream | 3.4 |
| TSG.35-N13 | Codec errors MUST NOT be retried; MUST log full context (truncated to 1024 bytes) | 3.5 |
| TSG.35-N14 | RPC handlers MUST translate internal errors to Schema.TaggedError; MUST NOT leak internals | 3.7 |
| TSG.35-N15 | Rendering errors SHOULD include category, recoverable, userMessage, retryDelayMs | 3.8 |
| TSG.35-N16 | Error handling at RPC/HTTP boundaries MUST be exhaustive | 4.3 |
| TSG.35-N17 | `Effect.orDie` MUST only be used for invariant violations, not to simplify error handling | 4.5 |
| TSG.35-N18 | Adapters MUST respect API-specified `Retry-After` delays | 5.6 |
| TSG.35-N19 | d2ts filter predicates MUST be pure, total functions | 6.3 |
| TSG.35-N20 | Join operators MUST support graceful degradation on single-side failure | 6.4 |
| TSG.35-N21 | Failures MUST be contained at lowest possible level; signal errors MUST NOT cascade | 7.1 |
| TSG.35-N22 | Each adapter MUST implement a circuit breaker with event emission | 7.4 |
| TSG.35-N23 | Adapters MUST enforce bounded resource consumption; unbounded queues prohibited | 7.5 |
| TSG.35-N24 | HTTP error responses MUST include `_tag`; MUST NOT include stack traces | 8.2 |
| TSG.35-N25 | Error logs MUST include `errorTag` annotation; adapter errors MUST include `adapterId` | 9.1 |
| TSG.35-N26 | User messages MUST NOT expose internals; MUST provide actionable guidance | 10.3 |

---

## 13. Open Questions

1. **Error persistence**: Should error events be persisted to JetStream for
   post-mortem analysis, or is ephemeral NATS pub/sub sufficient for error telemetry?

2. **Cross-adapter error correlation**: When multiple adapters fail simultaneously,
   should the platform attempt to identify common root causes (e.g., network
   partition affecting all HTTP adapters)?

3. **Error budget**: Should Tsingou implement SRE-style error budgets per adapter,
   where exceeding the budget triggers automatic disabling of the adapter until
   manual review?

4. **Schema evolution errors**: How should codec errors be handled when a source
   adapter publishes signals using a newer schema version that the pipeline does
   not yet support? Forward-compatible decode or strict rejection?

5. **Error aggregation for fusion**: When Dempster-Shafer fusion (TSG.4) receives
   error-flagged inputs from degraded adapters, should the fusion operator weight
   those inputs differently, or should they be excluded entirely from the fusion?

---

## 14. References

- [RFC2119] S. Bradner. "Key words for use in RFCs to Indicate Requirement Levels."
  RFC 2119, BCP 14, March 1997.
- [RFC8174] B. Leiba. "Ambiguity of Uppercase vs Lowercase in RFC 2119 Key Words."
  RFC 8174, BCP 14, May 2017.
- [EFFECT-TS-ERRORS] Effect Documentation. "Expected Errors."
  https://effect.website/docs/error-management/expected-errors/
- [EFFECT-TS-YIELDABLE] Effect Documentation. "Yieldable Errors."
  https://effect.website/docs/error-management/yieldable-errors/
- [EFFECT-TS-SCHEDULE] Effect Documentation. "Schedule Examples."
  https://effect.website/docs/scheduling/examples/
- [EFFECT-TS-CAUSE] Effect Documentation. "Error Management — Cause."
  https://effect.website/docs/error-management/
- [EFFECT-TS-SANDBOX] Effect Documentation. "Sandboxing."
  https://effect.website/docs/error-management/expected-errors/#sandbox
- [DATA-TAGGED-ERROR] Effect Documentation. "Data.TaggedError."
  https://effect.website/docs/data-types/data/#taggederror
- [SCHEMA-TAGGED-ERROR] Effect Documentation. "Schema.TaggedError."
  https://effect.website/docs/error-management/yieldable-errors/#extracting-the-error-type
- [FOWLER-CB] M. Fowler. "CircuitBreaker." martinfowler.com, 2014.
  https://martinfowler.com/bliki/CircuitBreaker.html
- [NYGARD-2007] M. T. Nygard. "Release It! Design and Deploy Production-Ready
  Software." Pragmatic Bookshelf, 2007. (Stability patterns: circuit breaker,
  bulkhead, timeout, steady state)
- [NYGARD-2018] M. T. Nygard. "Release It! Second Edition." Pragmatic Bookshelf,
  2018. (Updated patterns for cloud-native systems)
- [OTEL-SPANS] OpenTelemetry. "Traces — Concepts."
  https://opentelemetry.io/docs/concepts/signals/traces/
- [OTEL-STATUS] OpenTelemetry. "Span Status."
  https://opentelemetry.io/docs/specs/otel/trace/api/#set-status
- [JSONRPC-ERRORS] JSON-RPC Working Group. "JSON-RPC 2.0 Specification — Error Object."
  https://www.jsonrpc.org/specification
- [WELFORD-1962] B. P. Welford. "Note on a Method for Calculating Corrected Sums
  of Squares and Products." Technometrics, 4(3):419-420, 1962.
  (Referenced via TSG.27 for numeric stability in aggregate operators)
- [SRE-BOOK] B. Beyer, C. Jones, J. Petoff, N. R. Murphy. "Site Reliability
  Engineering." O'Reilly Media, 2016. (Error budgets, SLO/SLI framework)
- [BULKHEAD-PATTERN] Microsoft Azure Architecture Center. "Bulkhead Pattern."
  https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead
- [TSG.4] Tsingou RFC Section 4. "Data Fusion Mathematics." (Source reliability,
  Dempster-Shafer confidence degradation under error conditions)
- [TSG.9] Tsingou RFC Section 9. "Source Adapter Contract." (Adapter lifecycle,
  health reporting, signal emission contract)
- [TSG.27] Tsingou RFC Section 27. "Statistical Analysis & Anomaly Detection."
  (EWMA for error rate computation, Welford for aggregate operators)
- [TSG.32] Tsingou RFC Section 32. "Effect-TS Implementation Architecture."
  (Service composition, Layer structure, scoped resources)
- [TSG.34] Tsingou RFC Section 34. "Deployment Topology." (HTTP API, RPC endpoints,
  error response format)
