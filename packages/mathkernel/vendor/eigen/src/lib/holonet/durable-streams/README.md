# Durable-Streams

Effect-native wrapper for the [durable-streams protocol](https://github.com/durable-streams/spec), bridging NATS JetStream to edge clients via HTTP.

## Overview

Durable-streams provides a simple HTTP protocol for persistent, ordered message streams with automatic offset tracking. This module implements:

- **StreamBridgeService** - CRUD operations (create, append, read, delete)
- **LiveStreamService** - Real-time streaming (long-poll, SSE, subscribe)
- **ConsumerStateService** - Automatic offset tracking via NATS durable consumers
- **StreamCodecService** - Schema-aware encoding/decoding with header injection
- **HolonetAuthService** - JWT-based authentication and authorization
- **DsMetricsService** - Observability with Prometheus/JSON export

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        EDGE CLIENTS                              │
│              (Browser, Electron, SCADA, MES, ERP)               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP (Durable-Streams Protocol)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HTTP API LAYER                                │
│   DurableStreamsApi (HttpApi) + Handlers (HttpApiBuilder)       │
├─────────────────────────────────────────────────────────────────┤
│                    AUTH LAYER                                    │
│   HolonetAuthService (JWT validation, permissions)              │
├─────────────────────────────────────────────────────────────────┤
│                    BRIDGE SERVICES                               │
│   StreamBridgeService │ LiveStreamService │ ConsumerStateService│
├─────────────────────────────────────────────────────────────────┤
│                    CODEC & SCHEMA                                │
│   StreamCodecService │ SchemaRegistry (X-Schema-Id headers)     │
├─────────────────────────────────────────────────────────────────┤
│                    NATS LAYER (holonet/nats/)                   │
│   NatsStreamService │ NatsPubSubService │ NatsKVService         │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NATS CLUSTER                                │
│                 (JetStream + KV + Consumers)                    │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Basic Usage

```typescript
import { Effect } from 'effect';
import {
  StreamBridgeService,
  LiveStreamService,
  DurableStreamsLive,
} from '@/lib/holonet/durable-streams';

// Create a stream
const createStream = Effect.gen(function* () {
  const bridge = yield* StreamBridgeService;
  yield* bridge.create('my-stream', {
    contentType: 'application/json',
    retention: 'limits',
    maxAge: Duration.days(7),
  });
});

// Append messages
const appendMessage = Effect.gen(function* () {
  const bridge = yield* StreamBridgeService;
  const result = yield* bridge.append('my-stream', {
    type: 'UserCreated',
    userId: 'u123',
    timestamp: Date.now(),
  });
  console.log(`Appended at offset ${result.offset}`);
});

// Read messages
const readMessages = Effect.gen(function* () {
  const bridge = yield* StreamBridgeService;
  const result = yield* bridge.read('my-stream', {
    offset: 0,
    limit: 100,
  });
  for (const msg of result.items) {
    console.log(msg.data);
  }
});

// Run with layer
Effect.runPromise(
  createStream.pipe(Effect.provide(DurableStreamsLive))
);
```

### Live Streaming (SSE)

```typescript
import { Stream } from 'effect';

const subscribeToStream = Effect.gen(function* () {
  const live = yield* LiveStreamService;

  // Get SSE stream
  const sseStream = yield* live.sse('my-stream', { fromOffset: 0 });

  // Process messages
  yield* sseStream.pipe(
    Stream.tap((event) => Effect.log(`Received: ${event.data}`)),
    Stream.runDrain
  );
});
```

### Long-Poll Mode

```typescript
const longPollLoop = Effect.gen(function* () {
  const live = yield* LiveStreamService;
  let offset = 0;

  while (true) {
    const result = yield* live.longPoll('my-stream', {
      offset,
      timeout: Duration.seconds(30),
    });

    for (const msg of result.items) {
      console.log(msg.data);
    }

    offset = result.nextOffset;

    if (result.upToDate) {
      // No new messages, poll again
      continue;
    }
  }
});
```

## Services

### StreamBridgeService

Core CRUD operations for streams.

```typescript
interface StreamBridgeService {
  create(id: string, config: StreamConfig): Effect<StreamInfo, BridgeError>;
  append(id: string, data: unknown): Effect<AppendResult, BridgeError>;
  read(id: string, opts: ReadOptions): Effect<ReadResult, BridgeError>;
  metadata(id: string): Effect<StreamMetadata, BridgeError>;
  delete(id: string): Effect<void, BridgeError>;
}
```

### LiveStreamService

Real-time streaming with multiple modes.

```typescript
interface LiveStreamService {
  // Long-poll: blocks until data or timeout
  longPoll(id: string, opts: LongPollOptions): Effect<LongPollResult, LiveError>;

  // SSE: continuous stream of events
  sse(id: string, opts: SSEOptions): Effect<Stream<SSEEvent>, LiveError>;

  // Subscribe: raw NATS consumer stream
  subscribe(id: string, opts: SubscribeOptions): Stream<Message, LiveError, Scope>;
}
```

### ConsumerStateService

Automatic offset tracking using NATS durable consumers.

```typescript
interface ConsumerStateService {
  getOrCreateConsumer(streamId: string, clientId: string): Effect<Consumer>;
  getOffset(consumer: Consumer): Effect<number>;
  commitOffset(consumer: Consumer, offset: number): Effect<void>;
}
```

## Metrics & Observability

### Built-in Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `durable_streams.operation.latency_ms` | Histogram | Operation latency by type |
| `durable_streams.operations` | Counter | Total operations by type |
| `durable_streams.errors` | Counter | Errors by operation and type |
| `durable_streams.messages.published` | Counter | Messages published |
| `durable_streams.messages.consumed` | Counter | Messages consumed |
| `durable_streams.bytes.published` | Counter | Bytes published |
| `durable_streams.bytes.consumed` | Counter | Bytes consumed |
| `durable_streams.sse.active_connections` | Gauge | Active SSE connections |
| `durable_streams.subscriptions.active` | Gauge | Active subscriptions |

### Using Metrics

```typescript
import {
  withDsTracing,
  takeMetricsSnapshot,
  snapshotToPrometheus,
  snapshotToJson,
  DsMetricsService,
  DsMetricsLive,
} from '@/lib/holonet/durable-streams/metrics';

// Wrap operations with tracing
const tracedAppend = withDsTracing('append', 'my-stream')(
  bridge.append('my-stream', data)
);

// Take snapshot
const snapshot = yield* takeMetricsSnapshot;

// Export to Prometheus format
const prometheusText = snapshotToPrometheus(snapshot);

// Export to JSON
const jsonMetrics = snapshotToJson(snapshot);

// Periodic snapshots via service
const metrics = yield* DsMetricsService;
yield* metrics.startPeriodicSnapshots; // Every 10s by default
const history = yield* metrics.getHistory;
```

### Prometheus Exposition

```
# HELP durable_streams_operation_latency_ms Operation latency in milliseconds
# TYPE durable_streams_operation_latency_ms histogram
durable_streams_operation_latency_ms_bucket{operation="append",le="1"} 0
durable_streams_operation_latency_ms_bucket{operation="append",le="2"} 5
...
durable_streams_operation_latency_ms_count{operation="append"} 42
durable_streams_operation_latency_ms_sum{operation="append"} 156.7

# HELP durable_streams_operations_total Total operations
# TYPE durable_streams_operations_total counter
durable_streams_operations_total{operation="append"} 42
durable_streams_operations_total{operation="read"} 128
```

## Error Handling

### Error Types

```typescript
type DurableStreamError =
  | AuthError           // 401/403 - JWT invalid or insufficient permissions
  | ProtocolError       // 400/404/409 - Invalid request or conflict
  | LiveModeError       // 204/500 - Streaming issues
  | InternalError;      // 500/503 - NATS or internal failures

// Specific errors
type AuthError = InvalidTokenError | ForbiddenError;
type ProtocolError =
  | InvalidOffsetError
  | StreamNotFoundError
  | StreamExistsError
  | SchemaNotFoundError;
type LiveModeError = LongPollTimeoutError | SSEConnectionError;
type InternalError = NatsConnectionError | CodecError;
```

### Error Classification for Metrics

```typescript
import { classifyError } from '@/lib/holonet/durable-streams/metrics';

// Automatically classifies errors for metrics
const errorType = classifyError(error);
// Returns: 'auth_error' | 'validation_error' | 'not_found' | 'conflict'
//        | 'timeout' | 'nats_error' | 'codec_error' | 'unknown'
```

## Testing

### Running Tests

```bash
# All durable-streams tests
bun test src/lib/holonet/durable-streams/

# Specific test suites
bun test src/lib/holonet/durable-streams/__tests__/integration.test.ts
bun test src/lib/holonet/durable-streams/__tests__/recovery.test.ts
bun test src/lib/holonet/durable-streams/__tests__/load.test.ts
bun test src/lib/holonet/durable-streams/metrics/__tests__/metrics.test.ts
```

### Test Coverage

| Suite | Tests | Coverage |
|-------|-------|----------|
| Integration | 12 | Core CRUD, live modes |
| Recovery | 11 | Reconnection, cleanup, timeouts |
| Load | 6 | Throughput, concurrency, latency |
| Metrics | 18 | Tracing, snapshots, export |
| Services | 24 | Unit tests per service |
| Schemas | 8 | Protocol validation |
| API | 10 | HTTP handlers |

### Performance Benchmarks

From load tests (local NATS):

| Metric | Value |
|--------|-------|
| Publish throughput | ~2,400 msg/sec |
| Consume throughput | ~16,600 msg/sec |
| E2E latency (p95) | <2ms |
| Concurrent consumers | 10+ stable |

## Configuration

### Layer Composition

```typescript
import { Layer } from 'effect';
import {
  StreamBridgeServiceLive,
  LiveStreamServiceLive,
  ConsumerStateServiceLive,
  StreamCodecServiceLive,
} from '@/lib/holonet/durable-streams/services';
import { HolonetAuthServiceLive } from '@/lib/holonet/core/auth';
import { NatsStreamServiceLive } from '@/lib/holonet/nats';

// Compose layers
const DurableStreamsLive = Layer.mergeAll(
  StreamBridgeServiceLive,
  LiveStreamServiceLive,
  ConsumerStateServiceLive,
  StreamCodecServiceLive,
).pipe(
  Layer.provide(HolonetAuthServiceLive),
  Layer.provide(NatsStreamServiceLive),
);
```

### Custom Configuration

```typescript
import { DsMetricsConfigured } from '@/lib/holonet/durable-streams/metrics';
import { Duration } from 'effect';

// Custom metrics interval
const CustomMetricsLayer = DsMetricsConfigured({
  snapshotInterval: Duration.seconds(30),
  maxSnapshots: 120, // 1 hour at 30s interval
});
```

## File Structure

```
src/lib/holonet/durable-streams/
├── index.ts                    # Barrel exports
├── README.md                   # This file
├── api/
│   ├── DurableStreamsApi.ts    # HttpApi schema
│   ├── handlers.ts             # HttpApiBuilder handlers
│   └── index.ts
├── events/
│   ├── handlers.ts             # Event handlers
│   ├── layer.ts                # Event layer
│   ├── schemas.ts              # Event schemas
│   └── index.ts
├── metrics/
│   ├── tracing.ts              # Base metrics, recording helpers
│   ├── snapshot.ts             # Snapshot service, export formats
│   └── index.ts
├── schemas/
│   ├── protocol.ts             # Durable-streams protocol schemas
│   ├── errors.ts               # Error type definitions
│   └── index.ts
├── services/
│   ├── StreamBridgeService.ts  # Core CRUD bridge
│   ├── LiveStreamService.ts    # Long-poll + SSE
│   ├── ConsumerStateService.ts # Offset tracking
│   ├── StreamCodecService.ts   # Encode/decode
│   └── index.ts
└── __tests__/
    ├── integration.test.ts     # End-to-end tests
    ├── recovery.test.ts        # Reconnection tests
    ├── load.test.ts            # Performance tests
    └── api.test.ts             # HTTP handler tests
```

## Related Documentation

- [Durable-Streams Protocol Spec](https://github.com/durable-streams/spec)
- [NATS JetStream](https://docs.nats.io/nats-concepts/jetstream)
- [Effect-TS Metrics](https://effect.website/docs/observability/metrics)
- [Holonet Architecture](../ARCHITECTURE.md)
