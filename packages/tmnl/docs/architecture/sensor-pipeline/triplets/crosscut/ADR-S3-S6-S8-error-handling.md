---
id: S3-S6-S8
title: "Transport ↔ Client ↔ State — Error Propagation & Failure Recovery"
commitHash: "6656064"
status: draft
date: "2026-01-02"
tier: triplet-crosscut
stages:
  - S3
  - S6
  - S8
---

# ADR-S3-S6-S8: Error Propagation & Failure Recovery

**ID**: S3-S6-S8
**Commit Hash**: 6656064
**Status**: draft
**Date**: 2026-01-02
**Tier**: triplet-crosscut

## Context

### Stages Covered
- S3 (Transport) — NATS JetStream broker, pub/sub, QoS, message delivery
- S6 (Client Transport) — WebSocket/SSE browser connectivity, reconnection, subscription management
- S8 (State) — effect-atom state management, Result types, reactive updates

### Problem

The sensor-to-browser data pipeline must gracefully handle failures at every layer while maintaining user experience and data integrity. When network connections drop, brokers become unavailable, or validation fails, the system needs to:

1. **Classify errors accurately** — Distinguish transient network issues from permanent schema failures
2. **Propagate errors with context** — Preserve cause chains across S3→S6→S8 boundaries
3. **Recover automatically** — Retry transient failures, reconnect dropped connections, restore subscriptions
4. **Degrade gracefully** — Show stale data with indicators rather than blank screens
5. **Signal user visibility** — Surface connection state, last-update timestamps, retry controls
6. **Prevent cascading failures** — Circuit breakers stop retry storms, dead-letter queues isolate poison pills

**Core architectural question**: How do we design an error handling system that flows structured error information from the NATS broker (S3) through WebSocket clients (S6) to reactive atoms (S8), implementing automatic recovery for transient failures while providing user-facing controls for degraded states?

### Constraints

- **Effect-TS error types** — All errors are `Effect.Effect<A, E>` with structured error schemas
- **Result pattern for atoms** — State atoms use `Result<A, E>` with Initial/Waiting/Success/Failure states
- **Circuit breaker at S6** — Prevent retry storms to S3 by tracking failure rates
- **XState for connection state** — S6 uses XState v5 for connection lifecycle (connecting/connected/reconnecting/disconnected)
- **NATS JetStream features** — Use redelivery policies, ack timeouts, dead-letter queues
- **No silent failures** — Every error propagates to user-visible state or logs
- **Preserve previous data** — Failure state retains last successful value for graceful degradation

### Assumptions

- **Network failure rate**: 5% transient failures (timeouts, temporary unavailability), <1% permanent failures
- **Recovery time**: Exponential backoff up to 30s for connection retries
- **User tolerance**: 100ms latency increase acceptable, 5s stale data acceptable with indicator
- **Circuit breaker thresholds**: Open after 5 consecutive failures, half-open after 10s
- **NATS redelivery**: 3 attempts with exponential backoff before DLQ
- **Error budget**: 99.9% success rate (1 failure per 1000 requests)

## Decision

### Summary

Implement a **three-layer error handling system** where:

1. **S3 (Transport)** classifies errors via JetStream ack/nak, routes poison pills to dead-letter queues, provides redelivery policies for transient failures
2. **S6 (Client Transport)** implements circuit breaker for S3 connections, manages reconnection state via XState machine, restores subscriptions on reconnect, propagates structured errors to S8
3. **S8 (State)** represents error states via `Result.Failure<A, E>` atoms, preserves previous successful values for graceful degradation, exposes connection state atoms for UI rendering

The architecture uses **structured error schemas** (Effect Schema) that flow through all layers, **exponential backoff** for retries, **circuit breakers** to prevent cascading failures, and **Result-based state management** to enable declarative error rendering in S9.

### Technologies

| Technology | Version | Purpose | Stage | File Reference |
|------------|---------|---------|-------|----------------|
| Effect.Effect | 3.x | Structured error handling | S3/S6/S8 | TMNL standard |
| Effect.Schema | 0.75+ | Runtime error validation | S3/S6/S8 | TMNL standard |
| Effect.Cause | 3.x | Error cause chains | S6/S8 | `/src/lib/connection-ports/hooks/useAtomStream.ts:13` |
| Result.Result | effect-atom | State error representation | S8 | `/src/lib/connection-ports/hooks/useAtomStream.ts:25` |
| XState v5 | 5.x | Connection state machine | S6 | `/src/lib/dataplane/components/Port/port-stx.ts` |
| NATS JetStream | 2.x | Message redelivery, DLQ | S3 | `/docker/nats/nats-server.conf` |
| CircuitState | Custom | Circuit breaker state | S6 | `/src/lib/streams/playground/types.ts:115` |
| Schedule | Effect.Schedule | Exponential backoff | S6 | Effect standard |
| Ref | Effect.Ref | Failure counter | S6 | Effect standard |

### Patterns

#### 1. Error Classification Schema

**Structured Error Types via Effect.Schema**:

```typescript
// Error classification for recovery strategy
export const ErrorType = Schema.Literal('transient', 'permanent', 'degraded')
export type ErrorType = typeof ErrorType.Type

// Pipeline stage identifier
export const StageId = Schema.Literal('S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9')
export type StageId = typeof StageId.Type

// Base pipeline error with cause chain
export class PipelineError extends Schema.TaggedClass<PipelineError>()('PipelineError', {
  stage: StageId,
  type: ErrorType,
  message: Schema.String,
  context: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  timestamp: Schema.Number,
  cause: Schema.optional(Schema.Unknown), // Nested cause for chain
}) {}

// S3 transport errors
export class TransportError extends PipelineError.extend<TransportError>()('TransportError', {
  broker: Schema.String,           // 'nats://localhost:4222'
  subject: Schema.optional(Schema.String),  // 'sensors.temp.001'
  ackWait: Schema.optional(Schema.Number),  // Timeout duration
}) {}

// S6 connection errors
export class ConnectionError extends PipelineError.extend<ConnectionError>()('ConnectionError', {
  url: Schema.String,              // WebSocket URL
  protocol: Schema.Literal('websocket', 'sse'),
  retryCount: Schema.Number,
  circuitState: Schema.Literal('closed', 'open', 'half-open'),
}) {}

// S8 state errors
export class StateError extends PipelineError.extend<StateError>()('StateError', {
  atomId: Schema.String,           // Atom identifier
  operation: Schema.String,        // 'subscribe', 'update', 'derive'
  previousValue: Schema.optional(Schema.Unknown), // Last known good value
}) {}
```

**Error Type Semantics**:
- `transient`: Network timeout, temporary unavailability, rate limit → **retry with backoff**
- `permanent`: Schema validation failure, auth error, malformed data → **fail fast, no retry**
- `degraded`: Partial availability, stale cache hit, missing optional data → **proceed with warning**

#### 2. Error Propagation Chain

**S3 → S6 → S8 Flow**:

```
┌──────────────────────────────────────────────────────────────────────┐
│                     ERROR PROPAGATION CHAIN                          │
└──────────────────────────────────────────────────────────────────────┘

┌─────────┐  JetStream   ┌─────────┐  WebSocket   ┌─────────┐
│   S3    │  nak/timeout │   S6    │  Error event │   S8    │
│ Broker  │─────────────▶│ Client  │─────────────▶│  Atoms  │
│         │              │         │              │         │
└─────────┘              └─────────┘              └─────────┘
     │                        │                        │
     │ 1. Classify error      │ 2. Circuit breaker     │ 3. Result.Failure
     │    TransportError      │    decision            │    with cause chain
     │                        │                        │
     │ 2. Redelivery?         │ 3. Reconnect?          │ 4. Preserve previous
     │    - Yes: retry 3x     │    - Yes: backoff      │    Success for UI
     │    - No: DLQ           │    - No: open circuit  │
     │                        │                        │
     ▼                        ▼                        ▼
   Poison pill            Connection state       User sees stale
   to DLQ                 atom update             data indicator
```

**Context Preservation**:
```typescript
// Error cause chain example
const s3Error = new TransportError({
  stage: 'S3',
  type: 'transient',
  message: 'NATS JetStream timeout',
  broker: 'nats://localhost:4222',
  subject: 'sensors.temp.001',
  ackWait: 30000,
  timestamp: Date.now(),
  context: { deliveryAttempt: 2, streamSeq: 12345 },
})

const s6Error = new ConnectionError({
  stage: 'S6',
  type: 'transient',
  message: 'WebSocket connection lost',
  url: 'ws://localhost:9222',
  protocol: 'websocket',
  retryCount: 1,
  circuitState: 'closed',
  timestamp: Date.now(),
  context: { subscriptionCount: 5 },
  cause: s3Error, // Preserve S3 error as cause
})

const s8Error = new StateError({
  stage: 'S8',
  type: 'degraded',
  message: 'Stream atom failed, showing stale data',
  atomId: 'sensorReadings',
  operation: 'subscribe',
  timestamp: Date.now(),
  context: { lastUpdate: Date.now() - 5000 },
  cause: s6Error, // Full cause chain
  previousValue: { temp: 23.5, humidity: 45 }, // Last known good
})
```

#### 3. Recovery Strategies

**S3: JetStream Redelivery & Dead-Letter Queue**:

```typescript
// NATS JetStream stream configuration
const streamConfig = {
  name: 'SENSORS',
  subjects: ['sensors.>'],
  max_age: 24 * 60 * 60 * 1000000000, // 24 hours (nanoseconds)
  retention: 'limits',

  // Redelivery policy
  max_deliver: 3,              // Try 3 times
  ack_wait: 30_000_000_000,    // 30 second timeout (nanoseconds)

  // Exponential backoff: 1s, 2s, 4s
  backoff: [
    1_000_000_000,   // 1 second
    2_000_000_000,   // 2 seconds
    4_000_000_000,   // 4 seconds
  ],

  // Dead-letter queue for poison pills
  discard: 'old',
  duplicate_window: 120_000_000_000, // 2 minutes
}

// Consumer with retry logic
const consumerConfig = {
  durable_name: 'ingestion-service',
  ack_policy: 'explicit',
  max_ack_pending: 100,

  // Send to DLQ after max_deliver attempts
  max_deliver: 3,
  deliver_policy: 'all',

  // Backoff schedule
  backoff: streamConfig.backoff,
}

// Service implementation
export class NATSIngestionService extends Effect.Service<NATSIngestionService>()('NATSIngestionService', {
  effect: Effect.gen(function* () {
    const nc = yield* NATSConnection
    const js = nc.jetstream()

    const processMessage = (msg: JsMsg) =>
      Effect.gen(function* () {
        // Parse SenML
        const parsed = yield* Effect.tryPromise({
          try: () => Schema.decode(SenMLReading)(JSON.parse(msg.data.toString())),
          catch: (e) => new TransportError({
            stage: 'S3',
            type: 'permanent', // Schema validation = permanent
            message: 'SenML decode failed',
            broker: nc.getServer(),
            subject: msg.subject,
            timestamp: Date.now(),
            context: { raw: msg.data.toString() },
            cause: e,
          }),
        })

        // Store in S5 (dual-write)
        yield* StorageService.pipe(Effect.flatMap(s => s.store(parsed)))

        // Ack success
        yield* Effect.sync(() => msg.ack())
      }).pipe(
        Effect.catchTag('TransportError', (e) =>
          e.type === 'permanent'
            ? Effect.gen(function* () {
                // Permanent error → nak with term (send to DLQ)
                yield* Effect.sync(() => msg.term())
                yield* Effect.logError(`Poison pill sent to DLQ: ${e.message}`)
              })
            : Effect.gen(function* () {
                // Transient error → nak for redelivery
                yield* Effect.sync(() => msg.nak())
                yield* Effect.logWarning(`Redelivery scheduled: ${e.message}`)
              })
        )
      )

    return { processMessage }
  }),
  dependencies: [NATSConnection.Default, StorageService.Default],
}) {}
```

**S6: Circuit Breaker with Exponential Backoff**:

```typescript
// Circuit breaker state atom
export const circuitStateAtom = Atom.make<CircuitState>('closed')
export const failureCountAtom = Atom.make(0)
export const lastFailureAtom = Atom.make<number | null>(null)

// Circuit breaker thresholds
const FAILURE_THRESHOLD = 5       // Open after 5 failures
const TIMEOUT_MS = 10_000         // Half-open after 10s
const SUCCESS_THRESHOLD = 2       // Close after 2 successes in half-open

// Connection retry with circuit breaker
export const connectionOps = {
  connect: runtimeAtom.fn<{ url: string }>()(({ url }, ctx) =>
    Effect.gen(function* () {
      const state = ctx.get(circuitStateAtom)

      // Check circuit state
      if (state === 'open') {
        const lastFailure = ctx.get(lastFailureAtom)
        const elapsed = Date.now() - (lastFailure ?? 0)

        if (elapsed < TIMEOUT_MS) {
          // Circuit still open
          return yield* Effect.fail(new ConnectionError({
            stage: 'S6',
            type: 'degraded',
            message: 'Circuit breaker open, retry in progress',
            url,
            protocol: 'websocket',
            retryCount: ctx.get(failureCountAtom),
            circuitState: 'open',
            timestamp: Date.now(),
            context: { timeUntilRetry: TIMEOUT_MS - elapsed },
          }))
        } else {
          // Transition to half-open
          ctx.set(circuitStateAtom, 'half-open')
        }
      }

      // Attempt connection with timeout
      const ws = yield* Effect.tryPromise({
        try: () => new Promise<WebSocket>((resolve, reject) => {
          const socket = new WebSocket(url)
          const timeout = setTimeout(() => reject(new Error('Timeout')), 5000)
          socket.onopen = () => {
            clearTimeout(timeout)
            resolve(socket)
          }
          socket.onerror = (e) => {
            clearTimeout(timeout)
            reject(e)
          }
        }),
        catch: (e) => new ConnectionError({
          stage: 'S6',
          type: 'transient',
          message: 'WebSocket connection failed',
          url,
          protocol: 'websocket',
          retryCount: ctx.get(failureCountAtom),
          circuitState: state,
          timestamp: Date.now(),
          context: {},
          cause: e,
        }),
      }).pipe(
        Effect.tap(() => {
          // Success: reset failure count or close circuit
          const currentState = ctx.get(circuitStateAtom)
          if (currentState === 'half-open') {
            ctx.set(failureCountAtom, 0)
            ctx.set(circuitStateAtom, 'closed')
          } else {
            ctx.set(failureCountAtom, 0)
          }
        }),
        Effect.catchAll((error) =>
          Effect.gen(function* () {
            // Failure: increment count, potentially open circuit
            const count = ctx.get(failureCountAtom) + 1
            ctx.set(failureCountAtom, count)
            ctx.set(lastFailureAtom, Date.now())

            if (count >= FAILURE_THRESHOLD) {
              ctx.set(circuitStateAtom, 'open')
            }

            return yield* Effect.fail(error)
          })
        )
      )

      return ws
    })
  ),

  // Reconnect with exponential backoff
  reconnect: runtimeAtom.fn<{ url: string }>()(({ url }, ctx) =>
    Effect.gen(function* () {
      const schedule = Schedule.exponential('1 second', 2.0).pipe(
        Schedule.intersect(Schedule.recurs(5)), // Max 5 retries
        Schedule.jittered
      )

      const ws = yield* connectionOps.connect({ url }).pipe(
        Effect.retry(schedule)
      )

      return ws
    })
  ),
}

// XState machine for connection lifecycle
export const connectionMachine = setup({
  types: {
    context: {} as {
      url: string
      ws: WebSocket | null
      error: ConnectionError | null
      retryCount: number
    },
    events: {} as
      | { type: 'CONNECT'; url: string }
      | { type: 'CONNECTED'; ws: WebSocket }
      | { type: 'DISCONNECT' }
      | { type: 'ERROR'; error: ConnectionError }
      | { type: 'RETRY' },
  },
  actions: {
    setWebSocket: assign({
      ws: ({ event }) => (event.type === 'CONNECTED' ? event.ws : null),
    }),
    setError: assign({
      error: ({ event }) => (event.type === 'ERROR' ? event.error : null),
    }),
    incrementRetry: assign({
      retryCount: ({ context }) => context.retryCount + 1,
    }),
    resetRetry: assign({ retryCount: 0 }),
  },
}).createMachine({
  id: 'connection',
  initial: 'disconnected',
  context: {
    url: '',
    ws: null,
    error: null,
    retryCount: 0,
  },
  states: {
    disconnected: {
      on: {
        CONNECT: { target: 'connecting', actions: ['resetRetry'] },
      },
    },
    connecting: {
      invoke: {
        src: 'connectToWebSocket',
        onDone: { target: 'connected', actions: ['setWebSocket'] },
        onError: { target: 'reconnecting', actions: ['setError', 'incrementRetry'] },
      },
    },
    connected: {
      on: {
        DISCONNECT: 'disconnected',
        ERROR: { target: 'reconnecting', actions: ['setError'] },
      },
    },
    reconnecting: {
      after: {
        // Exponential backoff: 1s, 2s, 4s, 8s, 16s
        delayDuration: { target: 'connecting' },
      },
      on: {
        DISCONNECT: 'disconnected',
      },
    },
  },
})
```

**S8: Result.Failure with Previous Value Preservation**:

```typescript
// Sensor reading atom with Result state
export const sensorReadingsAtom = Atom.make(
  (get) => get.stream(natsSubscription).pipe(
    Stream.mapEffect((msg) =>
      Schema.decode(SensorReading)(JSON.parse(msg.data.toString()))
    )
  )
)
// Type: Atom<Result<SensorReading[], DecodeError>>

// Connection state derived from circuit breaker
export const connectionStateAtom = Atom.make(
  (get) => {
    const circuit = get(circuitStateAtom)
    const failureCount = get(failureCountAtom)
    const lastFailure = get(lastFailureAtom)

    return {
      state: circuit,
      failureCount,
      lastFailure,
      isHealthy: circuit === 'closed' && failureCount === 0,
      canRetry: circuit === 'open' && (Date.now() - (lastFailure ?? 0)) >= TIMEOUT_MS,
    }
  }
)

// React component using Result pattern
function SensorDashboard() {
  const { result, isSuccess, isFailure, value, previousValue, builder } = useAtomStream(sensorReadingsAtom)
  const connectionState = useAtomValue(connectionStateAtom)

  // Declarative error rendering
  return (
    <div>
      {/* Connection status banner */}
      {!connectionState.isHealthy && (
        <Alert variant={connectionState.state === 'open' ? 'error' : 'warning'}>
          {connectionState.state === 'open'
            ? 'Connection lost. Retrying...'
            : `${connectionState.failureCount} connection issues detected`}
          {connectionState.canRetry && <Button onClick={handleRetry}>Retry Now</Button>}
        </Alert>
      )}

      {/* Data view with Result.builder */}
      {builder()
        .onInitial(() => <Loading />)
        .onWaiting(() => <Spinner overlay />)
        .onSuccess((readings) => (
          <SensorGrid readings={readings} />
        ))
        .onFailure((cause, result) => {
          // Graceful degradation: show stale data with indicator
          const stale = result.previousSuccess?.value
          return stale ? (
            <div>
              <StaleDataBanner lastUpdate={result.previousSuccess.timestamp} />
              <SensorGrid readings={stale} dimmed />
              <ErrorDetails cause={cause} />
            </div>
          ) : (
            <ErrorView cause={cause} />
          )
        })
        .render()}
    </div>
  )
}

// Stale data indicator component
function StaleDataBanner({ lastUpdate }: { lastUpdate: number }) {
  const elapsed = Date.now() - lastUpdate
  const seconds = Math.floor(elapsed / 1000)

  return (
    <Alert variant="warning">
      ⚠️ Showing cached data from {seconds}s ago. Live updates paused.
    </Alert>
  )
}
```

#### 4. Dead-Letter Queue Pattern

**S3: Poison Pill Isolation**:

```typescript
// Dead-letter stream configuration
const dlqStreamConfig = {
  name: 'SENSORS_DLQ',
  subjects: ['sensors.dlq.>'],
  max_age: 7 * 24 * 60 * 60 * 1000000000, // 7 days
  retention: 'limits',
  max_msgs: 10_000,
  storage: 'file',
}

// Service for DLQ inspection
export class DLQService extends Effect.Service<DLQService>()('DLQService', {
  effect: Effect.gen(function* () {
    const nc = yield* NATSConnection
    const js = nc.jetstream()

    // Publish poison pill to DLQ
    const toDLQ = (msg: JsMsg, error: TransportError) =>
      Effect.gen(function* () {
        const dlqSubject = `sensors.dlq.${msg.subject.replace(/\./g, '_')}`

        const payload = {
          originalSubject: msg.subject,
          data: msg.data.toString(),
          error: Schema.encode(TransportError)(error),
          timestamp: Date.now(),
          deliveryAttempts: msg.info.redeliveryCount,
        }

        yield* Effect.tryPromise({
          try: () => js.publish(dlqSubject, JSON.stringify(payload)),
          catch: (e) => new TransportError({
            stage: 'S3',
            type: 'permanent',
            message: 'DLQ publish failed',
            broker: nc.getServer(),
            subject: dlqSubject,
            timestamp: Date.now(),
            context: { originalError: error },
            cause: e,
          }),
        })

        yield* Effect.logWarning(`Poison pill sent to DLQ: ${msg.subject}`)
      })

    // Retrieve DLQ messages for inspection
    const list = Effect.gen(function* () {
      const consumer = yield* Effect.tryPromise({
        try: () => js.consumers.get('SENSORS_DLQ', 'dlq-viewer'),
        catch: (e) => new TransportError({
          stage: 'S3',
          type: 'transient',
          message: 'DLQ consumer creation failed',
          broker: nc.getServer(),
          timestamp: Date.now(),
          context: {},
          cause: e,
        }),
      })

      const messages: JsMsg[] = []
      const iter = await consumer.consume({ max_messages: 100 })

      for await (const msg of iter) {
        messages.push(msg)
        msg.ack()
      }

      return messages
    })

    // Replay message from DLQ (after fix)
    const replay = (dlqMsg: JsMsg) =>
      Effect.gen(function* () {
        const payload = JSON.parse(dlqMsg.data.toString())
        const originalSubject = payload.originalSubject

        // Re-publish to original subject
        yield* Effect.tryPromise({
          try: () => js.publish(originalSubject, payload.data),
          catch: (e) => new TransportError({
            stage: 'S3',
            type: 'permanent',
            message: 'DLQ replay failed',
            broker: nc.getServer(),
            subject: originalSubject,
            timestamp: Date.now(),
            context: { dlqMessage: payload },
            cause: e,
          }),
        })

        // Ack DLQ message
        yield* Effect.sync(() => dlqMsg.ack())
        yield* Effect.logInfo(`Replayed message from DLQ: ${originalSubject}`)
      })

    return { toDLQ, list, replay }
  }),
  dependencies: [NATSConnection.Default],
}) {}
```

#### 5. User-Facing Error Controls

**S9: Error UI Components**:

```typescript
// Error boundary with retry controls
function DataStreamBoundary({ children }: { children: React.ReactNode }) {
  const connectionState = useAtomValue(connectionStateAtom)
  const { isFailure, cause, previousValue, builder } = useAtomStream(sensorReadingsAtom)

  const handleRetry = () => {
    // Reset circuit breaker and retry
    const ctx = runtimeAtom.getContext()
    ctx.set(circuitStateAtom, 'closed')
    ctx.set(failureCountAtom, 0)
    connectionOps.reconnect({ url: 'ws://localhost:9222' }).pipe(
      Effect.runFork
    )
  }

  const handleDismiss = () => {
    // Acknowledge error, continue with stale data
    // (circuit remains open, but no retry UI)
  }

  return (
    <div>
      {/* Connection health indicator */}
      <ConnectionStatus state={connectionState} />

      {/* Error alert with retry */}
      {isFailure && (
        <Alert
          variant={previousValue ? 'warning' : 'error'}
          action={
            connectionState.canRetry ? (
              <Button onClick={handleRetry}>Retry Connection</Button>
            ) : (
              <Button onClick={handleDismiss}>Dismiss</Button>
            )
          }
        >
          {previousValue
            ? 'Live updates paused. Showing cached data.'
            : 'Unable to load data. Please check your connection.'}
          <details>
            <summary>Error Details</summary>
            <pre>{Cause.pretty(cause)}</pre>
          </details>
        </Alert>
      )}

      {/* Children with degraded indicator */}
      <div style={{ opacity: isFailure && previousValue ? 0.7 : 1 }}>
        {children}
      </div>
    </div>
  )
}

// Connection status indicator
function ConnectionStatus({ state }: { state: typeof connectionStateAtom.Type }) {
  return (
    <div className="connection-status">
      <StatusDot
        color={
          state.state === 'closed' && state.isHealthy
            ? 'green'
            : state.state === 'open'
            ? 'red'
            : 'yellow'
        }
      />
      <span>
        {state.state === 'closed' && state.isHealthy
          ? 'Connected'
          : state.state === 'open'
          ? 'Disconnected'
          : 'Reconnecting...'}
      </span>
      {state.lastFailure && (
        <Timestamp>
          Last error: {new Date(state.lastFailure).toLocaleTimeString()}
        </Timestamp>
      )}
    </div>
  )
}

// Stale data timestamp
function StaleDataIndicator({ lastUpdate }: { lastUpdate: number }) {
  const [elapsed, setElapsed] = React.useState(0)

  React.useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - lastUpdate)
    }, 1000)
    return () => clearInterval(interval)
  }, [lastUpdate])

  const seconds = Math.floor(elapsed / 1000)
  const color = seconds < 5 ? 'green' : seconds < 30 ? 'yellow' : 'red'

  return (
    <Tooltip content={`Last updated: ${new Date(lastUpdate).toLocaleString()}`}>
      <Badge color={color}>
        {seconds < 60
          ? `${seconds}s ago`
          : `${Math.floor(seconds / 60)}m ago`}
      </Badge>
    </Tooltip>
  )
}
```

### Interfaces

**S3 → S6 Error Interface**:
```typescript
interface S3_S6_ErrorInterface {
  // NATS JetStream message with ack/nak
  from: 'S3'
  to: 'S6'
  protocol: 'nats-websocket'

  // Message flow
  message: {
    subject: string          // 'sensors.temp.001'
    data: Uint8Array         // SenML payload
    headers?: Record<string, string>
    info: {
      stream: string         // 'SENSORS'
      consumer: string       // 'websocket-relay'
      redeliveryCount: number
      timestampNanos: number
    }
  }

  // Error signaling
  ack: () => Promise<void>   // Success
  nak: () => Promise<void>   // Retry
  term: () => Promise<void>  // Send to DLQ

  // Error schema
  error?: TransportError
}
```

**S6 → S8 Error Interface**:
```typescript
interface S6_S8_ErrorInterface {
  // WebSocket to Atom
  from: 'S6'
  to: 'S8'
  protocol: 'websocket-to-result'

  // Stream emission
  stream: Stream.Stream<SensorReading, ConnectionError>

  // Error propagation
  onError: (error: ConnectionError) => Effect.Effect<void>

  // State update
  updateAtom: (
    atom: Atom.Atom<Result<A, E>>,
    result: Result.Result<A, E>
  ) => void

  // Error schema
  error?: ConnectionError
}
```

**Circuit Breaker State Interface**:
```typescript
interface CircuitBreakerInterface {
  // State atoms
  stateAtom: Atom.Atom<CircuitState>
  failureCountAtom: Atom.Atom<number>
  lastFailureAtom: Atom.Atom<number | null>

  // State machine
  machine: typeof connectionMachine

  // Operations
  ops: {
    connect: runtimeAtom.Function<
      { url: string },
      WebSocket,
      ConnectionError
    >
    reconnect: runtimeAtom.Function<
      { url: string },
      WebSocket,
      ConnectionError
    >
  }

  // Thresholds
  config: {
    failureThreshold: number   // 5 failures → open
    timeout: number            // 10s before half-open
    successThreshold: number   // 2 successes → close
  }
}
```

## Rationale

### Alternatives Considered

1. **Global error boundary at S9 only**
   - **Rejected**: Loses error context from S3/S6, cannot distinguish transient vs permanent, no automatic retry
   - Simpler implementation but worse UX

2. **HTTP polling instead of WebSocket with circuit breaker**
   - **Rejected**: Higher latency, no push updates, wastes bandwidth on error states
   - Easier to implement but defeats real-time pipeline purpose

3. **Automatic infinite retry without circuit breaker**
   - **Rejected**: Retry storms overload S3 broker, cascading failures, poor user experience
   - Seems resilient but creates worse problems

4. **Result.Failure without previousValue preservation**
   - **Rejected**: Blank screen on transient errors, jarring UX, loses graceful degradation
   - Simpler Result type but unacceptable UX

5. **Custom error types instead of Effect.Schema**
   - **Rejected**: No runtime validation, manual serialization, error-prone, incompatible with EventLog
   - Less boilerplate but loses Effect-TS benefits

### Tradeoffs

| Gain | Cost |
|------|------|
| **Structured error types** preserve context through all layers | Schema definitions add boilerplate vs plain Error |
| **Circuit breaker** prevents retry storms and cascading failures | Complexity in connection state management (XState + atoms) |
| **Result.Failure with previousValue** enables graceful degradation | Extra memory for stale data, UI complexity for dual states |
| **NATS redelivery + DLQ** isolates poison pills, enables replay | Additional stream configuration, manual DLQ inspection |
| **Automatic reconnection** improves UX without user intervention | Exponential backoff delay can feel slow (up to 30s) |
| **Declarative error rendering** via Result.builder is composable | Learning curve for Result pattern vs imperative try/catch |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Circuit breaker false positive** (opens on transient blip) | Medium | High | Require 5 consecutive failures, not just one |
| **Stale data confusion** (user doesn't notice indicator) | High | Medium | Prominent visual indicator, opacity change, timestamp |
| **DLQ overflow** (poison pills accumulate) | Low | High | 7-day retention, alerting on >1000 messages, manual review process |
| **Result.Failure memory leak** (previousValue never GC'd) | Low | Medium | Limit previousValue to last 1 value only, not history |
| **Reconnection storm** (all clients retry simultaneously) | Medium | High | Jittered exponential backoff (Schedule.jittered) |
| **Error cause chain too deep** (stack overflow on pretty print) | Low | Low | Limit cause chain depth to 5 levels max |
| **Circuit breaker deadlock** (never transitions to half-open) | Low | High | Timeout-based transition (10s), not event-based |

## Implementation

### Files to Create/Modify

| Path | Action | Description |
|------|--------|-------------|
| `src/lib/pipeline/errors/schemas.ts` | create | PipelineError, TransportError, ConnectionError, StateError schemas |
| `src/lib/pipeline/errors/index.ts` | create | Barrel export for error types |
| `src/lib/nats/circuit-breaker.ts` | create | Circuit breaker atoms, ops, XState machine |
| `src/lib/nats/NatsKVService.ts` | modify | Add circuit breaker integration, structured errors |
| `src/lib/ai-core/services/SSEAdapter.ts` | modify | Add ConnectionError propagation, Result mapping |
| `src/lib/connection-ports/hooks/useAtomStream.ts` | modify | Add previousValue accessor (already exists) |
| `src/lib/dataplane/atoms/index.ts` | modify | Add circuitStateAtom, failureCountAtom, connectionStateAtom |
| `src/components/ui/connection-status.tsx` | create | ConnectionStatus, StaleDataIndicator components |
| `src/components/ui/error-boundary.tsx` | create | DataStreamBoundary with retry controls |
| `docker/nats/nats-server.conf` | modify | Add DLQ stream config, redelivery policies |

### Dependencies

```json
{
  "dependencies": {
    "effect": "^3.0.0",
    "@effect/schema": "^0.75.0",
    "@effect-atom/atom-react": "latest",
    "xstate": "^5.0.0",
    "nats.ws": "^1.28.0"
  }
}
```

### Migrations

No database migrations required (error handling is runtime-only).

**NATS Stream Migration**:
```bash
# Create DLQ stream (idempotent)
nats stream add SENSORS_DLQ \
  --subjects "sensors.dlq.>" \
  --retention limits \
  --max-age 7d \
  --max-msgs 10000 \
  --storage file

# Update existing SENSORS stream with DLQ config
nats stream edit SENSORS \
  --max-deliver 3 \
  --ack-wait 30s \
  --backoff "1s,2s,4s"
```

### Test Strategy

**Unit Tests** (`@effect/vitest`):
```typescript
// Error classification
it.effect('classifies permanent errors correctly', () =>
  Effect.gen(function* () {
    const error = new TransportError({
      stage: 'S3',
      type: 'permanent',
      message: 'Schema validation failed',
      broker: 'nats://localhost:4222',
      timestamp: Date.now(),
      context: {},
    })

    expect(error.type).toBe('permanent')
    expect(error.stage).toBe('S3')
  })
)

// Circuit breaker state transitions
it.effect('opens circuit after threshold failures', () =>
  Effect.gen(function* () {
    const registry = Registry.make()

    // Simulate 5 failures
    for (let i = 0; i < 5; i++) {
      yield* connectionOps.connect({ url: 'ws://bad-url' }).pipe(
        Effect.provide(registry),
        Effect.ignore
      )
    }

    expect(registry.get(circuitStateAtom)).toBe('open')
  })
)

// Result.Failure with previousValue
it.effect('preserves previous success on failure', () =>
  Effect.gen(function* () {
    const registry = Registry.make()

    const streamAtom = Atom.make(
      Stream.succeed(42).pipe(
        Stream.concat(Stream.fail(new Error('test')))
      )
    )

    const result1 = registry.get(streamAtom) // Success(42)
    yield* Effect.sleep('100 millis')
    const result2 = registry.get(streamAtom) // Failure with previousSuccess

    expect(Result.isSuccess(result1)).toBe(true)
    expect(Result.isFailure(result2)).toBe(true)
    expect(result2.previousSuccess?.value).toBe(42)
  })
)
```

**Integration Tests** (NATS + WebSocket):
```typescript
it('end-to-end error recovery flow', async () => {
  // 1. Start NATS
  const nats = await startNATSServer()

  // 2. Publish valid message
  await nats.publish('sensors.temp.001', SenMLReading({ v: 23.5 }))

  // 3. Subscribe via WebSocket
  const ws = new WebSocket('ws://localhost:9222')
  ws.send(JSON.stringify({ type: 'subscribe', subject: 'sensors.temp.001' }))

  // 4. Receive success
  const msg1 = await waitForMessage(ws)
  expect(msg1.data.v).toBe(23.5)

  // 5. Stop NATS (simulate failure)
  await nats.stop()

  // 6. Verify circuit opens
  await waitFor(() => expect(registry.get(circuitStateAtom)).toBe('open'))

  // 7. Restart NATS
  await nats.start()

  // 8. Verify automatic reconnection
  await waitFor(() => expect(registry.get(circuitStateAtom)).toBe('closed'))

  // 9. Verify subscription restored
  await nats.publish('sensors.temp.001', SenMLReading({ v: 24.0 }))
  const msg2 = await waitForMessage(ws)
  expect(msg2.data.v).toBe(24.0)
})
```

**Visual Tests** (Storybook):
```typescript
export const ConnectionStates = () => {
  const [state, setState] = useState<CircuitState>('closed')

  return (
    <>
      <ButtonGroup>
        <Button onClick={() => setState('closed')}>Healthy</Button>
        <Button onClick={() => setState('half-open')}>Reconnecting</Button>
        <Button onClick={() => setState('open')}>Disconnected</Button>
      </ButtonGroup>

      <ConnectionStatus state={{ state, failureCount: 3, lastFailure: Date.now(), isHealthy: false, canRetry: true }} />
    </>
  )
}

export const StaleDataScenarios = () => {
  const [lastUpdate, setLastUpdate] = useState(Date.now() - 5000)

  return (
    <>
      <ButtonGroup>
        <Button onClick={() => setLastUpdate(Date.now() - 3000)}>3s ago</Button>
        <Button onClick={() => setLastUpdate(Date.now() - 30000)}>30s ago</Button>
        <Button onClick={() => setLastUpdate(Date.now() - 120000)}>2m ago</Button>
      </ButtonGroup>

      <StaleDataIndicator lastUpdate={lastUpdate} />
    </>
  )
}
```

## Metadata

**Tier**: triplet-crosscut
**Reviewers**: Prime, Backend Team, UX Team
**Related ADRs**:
- ADR-S3 (NATS JetStream configuration)
- ADR-S6 (WebSocket client implementation)
- ADR-S8 (effect-atom state management)
- ADR-S4-S5-S6 (Backend data plane)
- ADR-S7-S8-S9 (Frontend flow)

**Supersedes**: None
**Superseded By**: None

---

## Appendix: Error Recovery Decision Tree

```
┌─────────────────────────────────────────────────────────────────────┐
│                      ERROR CLASSIFICATION                           │
└─────────────────────────────────────────────────────────────────────┘

Error Occurred
     │
     ├─ Network timeout, connection refused, DNS failure
     │  → Type: TRANSIENT
     │  → Action: Retry with exponential backoff (S6)
     │  → UI: Show spinner, preserve previous data
     │  → NATS: nak for redelivery (S3)
     │
     ├─ Schema validation failed, malformed JSON, type error
     │  → Type: PERMANENT
     │  → Action: Fail fast, no retry
     │  → UI: Show error details, offer manual retry
     │  → NATS: term to DLQ (S3)
     │
     ├─ Partial data received, stale cache hit, degraded mode
     │  → Type: DEGRADED
     │  → Action: Proceed with warning
     │  → UI: Show stale indicator, display partial data
     │  → NATS: ack with log warning (S3)
     │
     └─ Circuit breaker open
        → Type: TRANSIENT (suppressed)
        → Action: Wait for timeout, then half-open
        → UI: Show "Retrying in Xs" countdown
        → NATS: No action (circuit prevents retry storm)

┌─────────────────────────────────────────────────────────────────────┐
│                      RECOVERY STRATEGY                              │
└─────────────────────────────────────────────────────────────────────┘

TRANSIENT Error
     │
     ├─ Failure count < 5
     │  → Circuit: CLOSED
     │  → Action: Immediate retry with backoff (1s, 2s, 4s, 8s, 16s)
     │  → UI: Show spinner overlay, "Reconnecting..."
     │
     ├─ Failure count ≥ 5
     │  → Circuit: OPEN
     │  → Action: Stop retries, wait 10s
     │  → UI: "Connection lost. Retrying in 10s..." + manual retry button
     │
     └─ Timeout elapsed (10s)
        → Circuit: HALF-OPEN
        → Action: Single retry attempt
        → Success → Circuit: CLOSED, reset failure count
        → Failure → Circuit: OPEN, restart timeout

PERMANENT Error
     │
     └─ Send to DLQ, log error, notify user
        → UI: Error dialog with details
        → Action: Manual retry only (after fix)

DEGRADED State
     │
     └─ Continue with stale data
        → UI: Warning banner + timestamp indicator
        → Action: Background retry, update on success
