# Holonet Architecture

> NATS-backed distributed event-sourced ECS for TMNL

## Overview

Holonet enhances TMNL's existing Effect-based patterns with NATS JetStream as the underlying infrastructure. It provides distributed event sourcing, reactive state synchronization, and ECS persistence while preserving Effect-TS APIs and patterns.

**Key Principle**: Holonet is an _enhancement_ not a replacement. Feature flags enable gradual adoption, and existing APIs remain unchanged.

## Architecture Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Application Layer                              │
│  (overlays, geoint, kori, dataplane)                                │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────────┐
│                   Integration Layer                                  │
│                             │                                        │
│  ┌──────────────┐  ┌───────┴────────┐  ┌─────────────────────┐    │
│  │ HolonetEvent │  │ HolonetStream  │  │ HolonetAtomBackend  │    │
│  │     Log      │  │   Processor    │  │                     │    │
│  └──────┬───────┘  └───────┬────────┘  └──────────┬──────────┘    │
│         │                  │                       │                │
└─────────┼──────────────────┼───────────────────────┼────────────────┘
          │                  │                       │
┌─────────┼──────────────────┼───────────────────────┼────────────────┐
│         │      Service Layer (Base NATS Primitives)                 │
│         │                  │                       │                │
│  ┌──────▼────────┐  ┌──────▼─────┐  ┌─────────────▼──────┐        │
│  │NatsPubSub     │  │NatsStream  │  │NatsKV (existing)   │        │
│  │  Service      │  │  Service   │  │                    │        │
│  └───────────────┘  └──────┬─────┘  └────────────────────┘        │
│                            │                                        │
│                     ┌──────▼──────┐                                 │
│                     │NatsConsumer │                                 │
│                     │  Service    │                                 │
│                     └─────────────┘                                 │
└─────────────────────────────┬──────────────────────────────────────┘
                              │ nats.ws (WebSocket)
                              ▼
                      ┌───────────────┐
                      │  NATS Server  │
                      │  + JetStream  │
                      └───────────────┘
```

## Design Principles

### 1. Effect-First

All services are `Effect.Service<T>()` with:

- **Schema-based validation** (`Effect.Schema` for all params/returns)
- **Scoped resource management** (`Effect.acquireRelease`)
- **Proper error handling** (`Effect.catchAllCause`)
- **Stream integration** (`Effect.Stream` for subscriptions)

### 2. Atom-as-State

Following TMNL's canonical pattern:

- `Atom.make()` for all state (NOT `Effect.Ref`)
- Service methods update atoms via `Atom.set()` or `ctx.set()`
- React components subscribe with `useAtomValue()`
- Shared registries: `geointRegistry`, `dataplaneRegistry`

### 3. Backward Compatible

Existing APIs preserved:

- `EventLog.group()` signature unchanged
- `EventLog.groupReactivity()` works identically
- DurableStreams consumers migrate transparently
- Feature flags enable gradual rollout

### 4. Browser-First

Use `nats.ws` package (not `nats`):

- WebSocket transport (not TCP)
- Browser-compatible (no Node.js APIs)
- Connection to `ws://localhost:9222` (see `docker/nats/nats-server.conf`)

## Services

### Base Services (Phase 1)

#### NatsPubSubService

**Status**: 🔨 In Progress  
**Purpose**: Core NATS pub/sub primitives

**Operations**:

- `publish(subject, data, schema)` - Publish with Schema encode
- `subscribe(subject, schema)` - Returns Effect.Stream of decoded messages
- `request(subject, data, replySchema, timeout)` - Request/reply pattern
- `queueSubscribe(subject, queue, schema)` - Load balancing via queue groups

**Use Cases**:

- Command/query bus
- Event broadcasting
- Service discovery
- Health checks

#### NatsStreamService

**Status**: ⏳ Planned  
**Purpose**: JetStream Streams for durable event storage

**Operations**:

- `createStream(config)` - Create/update stream
- `publish(stream, subject, data, schema)` - Publish with ack
- `getStreamInfo(stream)` - Metadata and statistics
- `deleteStream(stream)` - Cleanup

**Use Cases**:

- Event sourcing (EventLog backend)
- Audit logs
- Time-series data

#### NatsConsumerService

**Status**: ⏳ Planned  
**Purpose**: JetStream Consumers for event replay

**Operations**:

- `createConsumer(stream, config)` - Durable consumer
- `fetch(consumer, batch)` - Pull messages with backpressure
- `consume(consumer, schema)` - Returns Effect.Stream
- `ack(msg)` - Acknowledge processing

**Use Cases**:

- Event replay (EventLog.group() handlers)
- Progressive loading (DurableStreams replacement)
- Work queues

#### NatsObjectService

**Status**: ⏳ Planned  
**Purpose**: Object Store for large binary data

**Operations**:

- `createBucket(name, options)` - Create object bucket
- `put(bucket, name, stream)` - Store large object
- `get(bucket, name)` - Retrieve object as stream
- `delete(bucket, name)` - Remove object

**Use Cases**:

- KORI trait data (meshes, textures)
- Document storage
- Media files

#### NatsRpcService

**Status**: ⏳ Planned  
**Purpose**: Services/microservices pattern

**Operations**:

- `addService(name, handler)` - Register service
- `call(service, operation, data, schema)` - RPC call with load balancing
- `discover(name)` - Service discovery
- `stats(service)` - Service statistics

**Use Cases**:

- Effect.Cluster replacement
- Distributed RPC
- Load balancing

#### NatsMonitoringService

**Status**: ⏳ Planned  
**Purpose**: Observability and metrics

**Operations**:

- `streamStats(stream)` - Returns Effect.Stream of metrics
- `consumerStats(consumer)` - Consumer metrics stream
- `advisories()` - System advisories stream
- `withSpan(operation)` - Effect.withSpan integration

**Use Cases**:

- Real-time dashboards
- Alerting
- Performance monitoring

### Integration Services (Phase 2)

#### HolonetEventLog

**Status**: ⏳ Planned  
**Purpose**: Drop-in replacement for Effect.EventLog

**Backed By**: NatsStreamService + NatsConsumerService

**API Compatibility**:

```typescript
// Existing overlay events code remains unchanged
export const OverlayEventLogSchema = EventLog.schema(
  ContainerEvents,
  OverlayEvents,
  PortEvents,
)

// Handlers work identically
EventLog.group(schema, (event) => /* ... */)

// Reactivity preserved
EventLog.groupReactivity(schema, (event) => /* invalidate cache */)
```

**Implementation**:

- Events published to JetStream Stream
- Each handler gets durable Consumer
- Consumer offset tracks replay position
- `groupReactivity` triggers on new events

#### HolonetStreamProcessor

**Status**: ⏳ Planned  
**Purpose**: Replace DurableStreams pattern

**Backed By**: NatsConsumerService

**Migration**:

```typescript
// Before: DurableStreams with manual offset tracking
const searchOps = {
  search: runtimeAtom.fn<Query>()((query, ctx) =>
    Effect.gen(function* () {
      const offset = ctx.get(streamOffsetAtom);
      const stream = yield* DurableStreamClient.subscribe(query, offset);
      // Progressive updates via ctx.set(resultsAtom, ...)
    })
  ),
};

// After: HolonetStreamProcessor with automatic offset
const searchOps = {
  search: runtimeAtom.fn<Query>()((query, ctx) =>
    Effect.gen(function* () {
      const processor = yield* HolonetStreamProcessor;
      yield* processor.consume(query, (results) =>
        Effect.sync(() => ctx.set(resultsAtom, results))
      );
    })
  ),
};
```

#### HolonetAtomBackend

**Status**: ⏳ Planned  
**Purpose**: Optional distributed atom synchronization

**Backed By**: NatsKVService (existing)

**Feature Flag**: `atomBackend: 'memory' | 'holonet-kv'`

**Pattern**:

```typescript
// Opt-in per-atom
const distributedAtom = Atom.make(initialValue, {
  backend: 'holonet-kv',
  bucket: 'app-state',
  key: 'my-atom',
});

// KV watch → atom updates
// Multiple clients stay in sync
```

#### HolonetRpcServer

**Status**: ⏳ Planned  
**Purpose**: Replace Effect.Cluster entities

**Backed By**: NatsRpcService

**Migration**:

```typescript
// Before: Effect.Cluster entity
const SearchEntity = Entity.make('search', {
  searchCommand: Rpc.effect(/* ... */),
  getResults: Rpc.effect(/* ... */),
});

// After: HolonetRpcServer (same API)
const SearchEntity = HolonetRpc.entity('search', {
  searchCommand: Rpc.effect(/* ... */),
  getResults: Rpc.effect(/* ... */),
});
// Backed by NATS Services with queue groups
```

## Configuration

### Feature Flags

```typescript
// src/lib/holonet/config.ts
export const HolonetConfigSchema = Schema.Struct({
  enabled: Schema.Boolean.pipe(Schema.withDefault(() => false)),

  // Event sourcing backend
  eventLogBackend: Schema.Literal('effect', 'holonet').pipe(
    Schema.withDefault(() => 'effect' as const)
  ),

  // Stream processing backend
  streamBackend: Schema.Literal('durable-streams', 'holonet-consumer').pipe(
    Schema.withDefault(() => 'durable-streams' as const)
  ),

  // Atom persistence backend
  atomBackend: Schema.Literal('memory', 'holonet-kv').pipe(
    Schema.withDefault(() => 'memory' as const)
  ),

  // RPC/clustering backend
  clusterBackend: Schema.Literal('effect-cluster', 'holonet-rpc').pipe(
    Schema.withDefault(() => 'effect-cluster' as const)
  ),
});

export class HolonetConfig extends Context.Tag('tmnl/holonet/HolonetConfig')<
  HolonetConfig,
  typeof HolonetConfigSchema.Type
>() {
  static readonly Default = Layer.succeed(this, {
    enabled: false,
    eventLogBackend: 'effect',
    streamBackend: 'durable-streams',
    atomBackend: 'memory',
    clusterBackend: 'effect-cluster',
  });

  static readonly Custom = (config: typeof HolonetConfigSchema.Type) =>
    Layer.succeed(this, config);
}
```

### NATS Connection

Reuses existing NatsConfigTag:

```typescript
import { NatsConfigTag } from '@/lib/nats';

// Default: ws://localhost:9222
const layer = Layer.mergeAll(
  NatsConfigTag.Default,
  HolonetConfig.Default
  /* ... services ... */
);

// Custom: production NATS cluster
const prodLayer = Layer.mergeAll(
  NatsConfigTag.Custom({
    servers: ['ws://nats1:9222', 'ws://nats2:9222'],
    name: 'tmnl-prod',
  }),
  HolonetConfig.Custom({ enabled: true, eventLogBackend: 'holonet' })
  /* ... services ... */
);
```

## Migration Strategy

### Week 1: Foundation

- ✅ Create directory structure
- 🔨 Implement NatsPubSubService
- ⏳ Implement NatsStreamService
- ⏳ Implement NatsConsumerService
- ⏳ Write comprehensive tests

### Week 2: EventLog Integration

- ⏳ Implement HolonetEventLog
- ⏳ Add feature flag to overlay events
- ⏳ A/B test: Effect.EventLog vs Holonet
- ⏳ Performance benchmarks
- ⏳ Production deployment guide

### Week 3: Stream Processing

- ⏳ Implement HolonetStreamProcessor
- ⏳ Migrate geoint progressive search
- ⏳ Remove DurableStreams service
- ⏳ Verify memory/performance improvements

### Week 4: Atom Sync (Optional)

- ⏳ Implement HolonetAtomBackend
- ⏳ Add per-atom backend configuration
- ⏳ Test multi-client synchronization
- ⏳ Document when to use distributed atoms

### Week 5: RPC/Clustering

- ⏳ Implement NatsRpcService
- ⏳ Implement HolonetRpcServer
- ⏳ Migrate SearchEntity to Holonet
- ⏳ Load balancing validation

## Testing Strategy

### Unit Tests

- Each service tested independently
- Mock NATS connection for fast tests
- Schema validation tests
- Error handling tests

### Integration Tests

- Docker Compose with real NATS
- End-to-end pub/sub flows
- Stream persistence verification
- Consumer replay validation

### Performance Tests

- Throughput benchmarks
- Latency measurements
- Memory usage profiling
- Comparison with Effect.EventLog

### Migration Tests

- A/B testing with feature flags
- Backward compatibility verification
- Gradual rollout monitoring

## Existing Integrations

### KORI ECS

**Location**: `src/lib/kori/services/storage.ts`

**Current**: Already uses NatsKVService for EntitySpec storage

**Future**:

- Component changes → JetStream Streams
- Trait data → Object Store
- Entity lifecycle → Event sourcing

### Overlay Events

**Location**: `src/lib/overlays/events/`

**Current**: Uses Effect.EventLog

**Migration**: HolonetEventLog drop-in replacement

### Geoint Streaming

**Location**: `src/lib/geoint/atoms/operations.ts`

**Current**: DurableStreams with manual offset tracking

**Migration**: HolonetStreamProcessor

### Search Clustering

**Location**: `src/lib/geoint/cluster/SearchEntity.ts`

**Current**: Effect.Cluster with RPC

**Migration**: HolonetRpcServer

## Error Handling

All services follow this pattern:

```typescript
export class NatsServiceError extends Error {
  readonly _tag = 'NatsServiceError';
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'NatsServiceError';
  }
}

// In service implementation
Effect.tryPromise({
  try: async () => {
    /* NATS operation */
  },
  catch: (err) => new NatsServiceError('Operation failed', err),
}).pipe(
  Effect.catchAllCause((cause) =>
    Effect.logError('Service error', cause).pipe(
      Effect.andThen(Effect.fail(new NatsServiceError('...', cause)))
    )
  )
);
```

## Observability

### Tracing

All operations use `Effect.withSpan`:

```typescript
publish: (subject, data) =>
  Effect.gen(function* () {
    // Implementation
  }).pipe(
    Effect.withSpan('Holonet.PubSub.publish', {
      attributes: { subject },
    })
  );
```

### Metrics

NatsMonitoringService provides real-time metrics:

- Message throughput
- Consumer lag
- Stream size
- Error rates

### Logging

Structured logging via `Effect.log*`:

```typescript
yield *
  Effect.logInfo('Stream created', {
    stream: name,
    subjects: config.subjects,
  });
```

## Resources

### Documentation

- NATS Docs: https://docs.nats.io/
- nats.ws Client: https://github.com/nats-io/nats.ws
- Effect Docs: https://effect.website/docs/introduction
- KORI Docs: `src/lib/kori/KORI.md`

### Key Files

- Template: `src/lib/nats/NatsKVService.ts`
- Overlay Events: `src/lib/overlays/events/`
- DurableStreams: `src/lib/durable-streams/service.ts`
- SearchEntity: `src/lib/geoint/cluster/SearchEntity.ts`
- KORI Storage: `src/lib/kori/services/storage.ts`

### Docker Setup

- NATS Config: `docker/nats/nats-server.conf`
- WebSocket Port: 9222
- JetStream enabled by default

## Success Criteria

### Phase 1: ✅ Foundation Complete

- [x] Directory structure created
- [ ] NatsPubSubService implemented and tested
- [ ] NatsStreamService implemented and tested
- [ ] NatsConsumerService implemented and tested
- [ ] All follow NatsKVService.ts pattern

### Phase 2: ⏳ Integration Complete

- [ ] HolonetEventLog passes EventLog tests
- [ ] Overlay events work unchanged with Holonet
- [ ] Feature flags enable A/B testing
- [ ] Performance parity with Effect.EventLog

### Phase 3: ⏳ Production Ready

- [ ] HolonetStreamProcessor in production
- [ ] DurableStreams deprecated
- [ ] HolonetRpcServer in production
- [ ] Monitoring and alerting active

---

**Status**: Phase 1 In Progress  
**Next**: Implement NatsPubSubService  
**Last Updated**: 2025-01-15
