# Research: Error Handling & Tagged Errors

```
Topic:          Error Handling & Tagged Errors
Platform:       Tsingou (SIGINT/OSINT analysis)
Author:         Val (data-fusion-mathematician)
Date:           2026-02-18
Status:         COMPLETE
Lines:          ~500
Sections:       10
Frameworks:     Effect-TS Cause, Data.TaggedError, Schema.TaggedError, Schedule, Circuit Breaker
Purpose:        Raw research feeding RFC section TSG.35
```

---

## 1. Effect-TS Error Model Foundations

### 1.1 The Effect<A, E, R> Type

Every Effect computation carries three type parameters:
- A: Success value
- E: Expected error channel (typed, recoverable)
- R: Requirements (dependency context)

The compiler tracks E across all compositions — `pipe`, `flatMap`, `gen` — accumulating
error types as a union. If Effect A produces E1 and Effect B produces E2, their sequential
composition yields E = E1 | E2.

### 1.2 Expected Errors vs Defects

Effect-TS makes a fundamental distinction:

**Expected errors (Fail<E>):**
- Modeled in the E parameter
- Recoverable via catchTag/catchAll
- Part of the domain contract
- Must be declared in type signatures

**Defects (Die):**
- Not in the E parameter
- Arise from throw, null dereference, assertion failures
- Represent programming errors
- Recoverable only via sandbox/catchAllDefect

**Interruptions (Interrupt):**
- Fiber cancellation
- Not errors per se — cooperative shutdown
- Finalized but not recovered

### 1.3 Cause Hierarchy

The `Cause<E>` data type captures the complete failure history:

```
Cause<E>
  ├── Fail<E>       — expected recoverable error
  ├── Die            — unexpected defect (programming error)
  ├── Interrupt      — fiber was cancelled
  ├── Sequential     — error A followed by finalizer error B
  └── Parallel       — concurrent errors from parallel fibers
```

Cause is lossless — no error information is ever discarded. Sequential and Parallel
causes arise from finalizer failures and concurrent operations respectively.

---

## 2. Tagged Error Pattern

### 2.1 Data.TaggedError

Creates simple error classes with a `_tag` discriminant:

```typescript
class HttpTimeoutError extends Data.TaggedError('HttpTimeoutError')<{
  readonly url: string
  readonly timeoutMs: number
}> {}
```

Properties:
- Extends YieldableError (works in Effect.gen)
- Structural equality via Data module
- `_tag` property for pattern matching
- Lightweight — no schema validation

### 2.2 Schema.TaggedError

Adds Schema integration for serialization:

```typescript
class RpcQueryError extends Schema.TaggedError<RpcQueryError>()('RpcQueryError', {
  operation: Schema.String,
  message: Schema.String,
}) {}
```

Properties:
- Full encode/decode support
- RPC transport serialization
- JSON Schema generation
- Runtime validation of error payloads

### 2.3 When to Use Which

| Criterion | Data.TaggedError | Schema.TaggedError |
|-----------|------------------|--------------------|
| Internal service errors | Preferred | Overkill |
| RPC error channel | No | Required |
| Serialization needed | No | Yes |
| Runtime validation | No | Yes |
| Performance | Fastest | Slight overhead |

---

## 3. Error Recovery Combinators

### 3.1 Tag-Based Recovery

```typescript
Effect.catchTag('HttpTimeoutError', (e) =>
  Effect.retry(effect, Schedule.exponential('500 millis'))
)
```

Narrows E by removing the caught tag. Type-safe exhaustive handling.

### 3.2 Multi-Tag Recovery

```typescript
Effect.catchTags({
  HttpTimeoutError: (e) => Effect.succeed(fallback),
  HttpAuthError: (e) => Effect.fail(new AuthRequired()),
  HttpParseError: (e) => Effect.logWarning(`Parse: ${e.message}`),
})
```

Each tag handler independently narrows the error channel.

### 3.3 catchAll / catchAllCause

- `catchAll`: Catches all Fail<E>, not defects
- `catchAllCause`: Catches everything including Die and Interrupt
- `sandbox`: Promotes Cause<E> into the error channel for inspection

### 3.4 orElse / orElseSucceed / orDie

- `orElse`: Alternative effect on any failure
- `orElseSucceed`: Replace failure with success value
- `orDie`: Convert expected error to defect (removes from E)

---

## 4. Retry and Schedule

### 4.1 Schedule Primitives

```
Schedule.once                    — retry once
Schedule.recurs(n)               — retry n times
Schedule.fixed(duration)         — fixed interval
Schedule.exponential(base)       — exponential backoff
Schedule.fibonacci(one)          — fibonacci backoff
Schedule.jittered                — add random jitter
```

### 4.2 Schedule Combinators

```
Schedule.intersect(a, b)   — both must continue
Schedule.union(a, b)       — either continues
Schedule.either(a, b)      — stop at first completion
Schedule.andThen(a, b)     — b after a exhausts
```

### 4.3 Conditional Retry

```typescript
Schedule.recurWhile<E>((err) => err._tag === 'HttpTimeoutError')
```

Retry only specific error types. Stop on non-retryable errors.

### 4.4 Tsingou Application: Adapter Reconnection

WebSocket adapter uses exponential backoff with cap:
```
Schedule.exponential(1000ms)
  .pipe(Schedule.either(Schedule.recurs(10)))
  .pipe(Schedule.tapOutput(() => Effect.log('reconnecting...')))
```

HTTP adapter uses transient-only retry:
```
HttpClient.retryTransient({
  schedule: Schedule.exponential(500ms)
    .pipe(Schedule.intersect(Schedule.recurs(5)))
})
```

---

## 5. Error Taxonomy for Tsingou

### 5.1 Layer 1: Adapter Errors (source boundary)

17 error types in `tsingou-flow/adapters/errors.ts`:
- Connection: AdapterConnectError, AdapterDisconnectError
- HTTP: HttpRequestError, HttpParseError, HttpAuthError, HttpTimeoutError
- SSE: SseConnectionError
- WebSocket: WsConnectError, WsMessageError
- NATS: NatsSubscribeError
- File: FileWatchError, FileParseError
- RSS: RssFetchError, RssParseError
- Serial: SerialConnectError
- Signal: SignalValidationError, SignalQueueFullError

### 5.2 Layer 2: Transport Errors (NATS fabric)

Namespace-scoped in `holonet/nats/errors.ts`:
- Connection: ConnectError, DisconnectError, JetStreamManagerError
- Core: PublishError, SubscribeError, RequestError, TimeoutError, FlushError
- KV: BucketError, GetError, PutError, DeleteError, WatchError
- Streams: InfoError, AddError, UpdateError, DeleteError
- Publish: PublishError, DuplicateError
- Consumers: GetError, AddError, DeleteError, ConsumeError
- Codec: EncodeError, DecodeError
- Hub: HubCreationError, HubPublishError, HubCapacityError, NoMatchingHubError
- Micro: AddServiceError, ClientCreationError, DiscoveryQueryError, StopServiceError

### 5.3 Layer 3: Domain Errors (business logic)

- IIoT common: ValidationError, NotFoundError, ConflictError, UnauthorizedError
- Alarm: AlarmNotFoundError, InvalidAlarmTransitionError, AlarmAlreadyAcknowledgedError
- Work order: WorkOrderNotFoundError, InvalidWorkOrderStateError, WorkOrderApprovalRequiredError
- Equipment: similar pattern per entity
- Geospatial: SearchNetworkError, SearchTimeoutError, SearchRateLimitError, etc.

### 5.4 Layer 4: RPC Errors (serialization boundary)

Schema.TaggedError variants for wire transport:
- RpcQueryError, RpcGraphError
- RpcDeviceNotFoundError, RpcInvalidReadingError
- RpcAlarmNotFoundError, RpcAlarmAlreadyAcknowledgedError
- RpcWorkflowError, RpcAlarmWorkflowError

### 5.5 Layer 5: Rendering Errors (UI boundary)

- ChartAdapterUnavailable, ChartMountError, ChartUpdateError
- ChartInstanceNotFound

---

## 6. Error Propagation Through d2ts Pipeline

### 6.1 Stream Error Channel

d2ts operators process signals as Effect Streams. Error propagation:

```
Source → map → filter → join → window → aggregate → sink
  E       E      E       E       E         E         E
```

Each operator preserves or widens the error channel. Stream.catchTag allows
per-operator error handling without terminating the stream.

### 6.2 Partial Failure in Join Operations

When a `join(left, right)` has one side fail:
- The failing side enters error state
- The healthy side continues buffering
- Join produces partial results with degraded flag
- Stream.catchTag on join errors enables fallback to single-source mode

### 6.3 Window Operator Error Handling

`window(duration)` errors:
- Clock skew: WindowClockError → use monotonic clock
- Buffer overflow: WindowOverflowError → drop oldest, emit metric
- Empty window: Not an error — emit empty aggregation

---

## 7. Circuit Breaker Pattern

### 7.1 States

```
Closed → (threshold failures) → Open
Open → (timeout) → Half-Open
Half-Open → (probe success) → Closed
Half-Open → (probe failure) → Open
```

### 7.2 Tsingou Application

Per-adapter circuit breaker prevents cascade:
- Closed: normal operation, count consecutive failures
- Open: fast-fail all requests, emit AdapterDegradedEvent
- Half-Open: allow single probe, measure latency
- Re-close on success, re-open on failure

### 7.3 Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| failureThreshold | 5 | Consecutive failures to open |
| resetTimeout | 30s | Time in open before half-open probe |
| halfOpenMax | 1 | Concurrent probes in half-open |
| successThreshold | 2 | Consecutive successes to close |

---

## 8. Failure Isolation Architecture

### 8.1 Containment Hierarchy

```
Signal (row) → Adapter (lane) → Pipeline (query) → Platform
```

Row failure: drop signal, emit diagnostic, continue lane
Lane failure: degrade adapter, continue other adapters
Query failure: only when critical quorum policy fails
Platform failure: should never happen — defense in depth

### 8.2 Blast Radius Control

Each adapter runs in its own Effect.Scope:
- Resource finalization is adapter-scoped
- Fiber interruption is adapter-scoped
- Error propagation stops at adapter boundary
- Health atoms report per-adapter status

---

## 9. Error Observability

### 9.1 Structured Logging

Effect.log with annotations:
```typescript
Effect.logWarning('Adapter degraded').pipe(
  Effect.annotateLogs('adapterId', config.adapterId),
  Effect.annotateLogs('errorTag', err._tag),
  Effect.annotateLogs('errorCount', String(errorCount)),
)
```

### 9.2 Health Atoms

Per-adapter health state exposed via effect-atom:
```typescript
type AdapterHealth = {
  status: 'connected' | 'degraded' | 'disconnected'
  errorCount: number
  lastError?: string
  lastErrorAt?: Date
}
```

### 9.3 Error Telemetry

NATS subjects for error telemetry:
- `tsingou.adapter.{id}.error` — individual adapter errors
- `tsingou.pipeline.error` — pipeline-level errors
- `tsingou.health.snapshot` — periodic health snapshots

---

## 10. Sources and Citations

- [EFFECT-TS-ERRORS] Effect Documentation. "Expected Errors." https://effect.website/docs/error-management/expected-errors/
- [EFFECT-TS-YIELDABLE] Effect Documentation. "Yieldable Errors." https://effect.website/docs/error-management/yieldable-errors/
- [EFFECT-TS-SCHEDULE] Effect Documentation. "Schedule Examples." https://effect.website/docs/scheduling/examples/
- [FOWLER-CB] M. Fowler. "Circuit Breaker." https://martinfowler.com/bliki/CircuitBreaker.html
- [NYGARD-2007] M. T. Nygard. "Release It!" Pragmatic Bookshelf, 2007. (Stability patterns: circuit breaker, bulkhead, timeout)
- [OTEL-SPANS] OpenTelemetry. "Traces Concepts." https://opentelemetry.io/docs/concepts/signals/traces/
- [JSONRPC-ERRORS] JSON-RPC Specification. "Error Object." https://www.jsonrpc.org/specification
