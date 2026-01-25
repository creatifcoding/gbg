# TMNL Instrumentation Library - Architecture

> **Status**: Design Phase (EDIN Cycle)  
> **Goal**: OpenTelemetry-compliant tracing + NATS persistence + AI-friendly structured output

---

## Vision

A lightweight, pipeable instrumentation layer that integrates Effect's native tracing (`Effect.withSpan`) with OpenTelemetry standards, persists traces to NATS (KV/ObjectStore), and generates AI-queryable structured data.

**NOT** a heavy APM tool. This is developer-focused observability for Effect programs.

---

## Design Principles

1. **Pipeable** — Use `.pipe(withSpan(...))` for composability
2. **Non-invasive** — Works with existing `Effect.withSpan` usage (137 occurrences in TMNL)
3. **AI-friendly** — Structured JSON with semantic context for LLM queries
4. **NATS-backed** — Persist to KV (metadata) + ObjectStore (large payloads)
5. **Effect-native** — Built on Effect.Service, no leaky abstractions

---

## Current State Analysis

### Existing Effect.withSpan Usage

**Found: 137 occurrences across 28 files**

| Service            | Pattern                                                | Example             |
| ------------------ | ------------------------------------------------------ | ------------------- |
| DataManager        | `Effect.withSpan('DataManager.dispatch.{kernelType}')` | Traced dispatch     |
| FileAccessService  | `Effect.withSpan('FileAccessService.{operation}')`     | File I/O operations |
| Editor v3          | `Effect.withSpan('markdownOps.parse')`                 | Document parsing    |
| Slider v2          | `Effect.withSpan('slider:emanation')`                  | Animation effects   |
| DurableStreamsPort | `Effect.withSpan('DurableStreamsPort.append.http')`    | HTTP operations     |

**Naming convention**: `Service.operation` or `domain:action`

### Existing NATS Integration

**Found: 184 matches across 33 files**

| Service                    | Bucket          | Purpose               |
| -------------------------- | --------------- | --------------------- |
| DocumentRegistryService    | `documents`     | Editor metadata       |
| FileDocumentMappingService | `file-mappings` | Entity-file mapping   |
| Kori Storage               | `entity-specs`  | Entity definitions    |
| NatsKVService              | Core            | Generic KV operations |

**Transport**: WebSocket (`ws://localhost:9222`) for browser compatibility

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      React Components                            │
│                                                                   │
│  useInstrumented(effectFn)  ← React hook                        │
│  useTrace(traceId)          ← Query hook                        │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Pipeable API (Pure Functions)                  │
│                                                                   │
│  withSpan(name, attrs)     ← Wraps Effect.withSpan             │
│  tapTrace(fn)               ← Inspect spans without mutation     │
│  captureError(fn)           ← Auto-capture error spans          │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              InstrumentationService (Effect.Service)            │
│                                                                   │
│  startSpan / endSpan       ← Manual span control                │
│  captureSpan               ← Persist to internal Ref            │
│  getCapturedSpans          ← Read all captured                  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│              OpenTelemetry Bridge (@effect/opentelemetry)       │
│                                                                   │
│  NodeSdk.layer()           ← Configures OT SDK                  │
│  BatchSpanProcessor        ← Batches spans for export           │
│  OTLPTraceExporter         ← Exports to OTLP endpoint           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                 NATS Persistence Layer                           │
│                                                                   │
│  KV Bucket: tmnl-traces    ← Span metadata (searchable)        │
│  ObjectStore: tmnl-trace-data ← Large payloads (JSON blobs)    │
│  JetStream: TRACES         ← Live feed for real-time consumers  │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Design

### Pipeable Utilities (Primary API)

```typescript
import { withSpan, tapTrace, captureError } from '@/lib/instrumentation';

const processUser = (userId: string) =>
  Effect.gen(function* () {
    const user = yield* fetchUser(userId);
    const enriched = yield* enrichUserData(user);
    return enriched;
  }).pipe(
    withSpan('UserService.processUser', {
      'user.id': userId,
      'operation.type': 'fetch-and-enrich',
    }),
    tapTrace((span) =>
      Effect.log('Processing complete', { duration: span.duration })
    ),
    captureError((error, span) =>
      Effect.gen(function* () {
        yield* Effect.log('User processing failed', { error, userId });
        // Error automatically added to span
      })
    )
  );
```

### React Hooks

```typescript
import { useInstrumented, useTrace } from '@/lib/instrumentation';

function UserProfile({ userId }: { userId: string }) {
  const fetchUser = useInstrumented((id: string) => UserService.getUser(id), {
    spanName: 'UserProfile.fetchUser',
  });

  const { trace, spans } = useTrace(userId);

  useEffect(() => {
    fetchUser(userId);
  }, [userId]);

  return (
    <div>
      <UserData userId={userId} />
      {trace && <TraceTimeline spans={spans} />}
    </div>
  );
}
```

### Service Integration (Low-level)

```typescript
import { InstrumentationService } from '@/lib/instrumentation';

class MyService extends Effect.Service<MyService>()('MyService', {
  effect: Effect.gen(function* () {
    const instrumentation = yield* InstrumentationService;

    const doWork = (input: string) =>
      Effect.gen(function* () {
        const spanId = yield* instrumentation.startSpan(
          'MyService.doWork',
          'internal',
          { input }
        );

        try {
          const result = yield* performWork(input);
          yield* instrumentation.endSpan(spanId, 'ok');
          return result;
        } catch (error) {
          yield* instrumentation.endSpan(spanId, 'error');
          yield* Effect.fail(error);
        }
      });

    return { doWork } as const;
  }),
  dependencies: [InstrumentationService.Default],
}) {}
```

---

## NATS Storage Strategy

### Bucket Organization

```
KV Bucket: tmnl-traces
├── trace:{traceId}              → TraceMetadata (small JSON)
├── span:{spanId}                → CapturedSpan (searchable)
└── service:{serviceName}:index  → List of trace IDs

ObjectStore: tmnl-trace-data
├── trace-{traceId}.json         → Full trace (all spans + context)
└── span-{spanId}.json           → Large span payloads

JetStream: TRACES
├── span.created                 → Real-time span events
├── span.completed               → Real-time completion events
└── trace.finished               → Trace finalization events
```

### Query Patterns

```typescript
// Get trace by ID
const trace = yield * natsKv.get(bucket, `trace:${traceId}`, TraceMetadata);

// Get all spans for a service
const serviceKey = `service:${serviceName}:index`;
const traceIds =
  yield * natsKv.get(bucket, serviceKey, Schema.Array(Schema.String));

// Get full trace from ObjectStore
const fullTrace = yield * natsObjectStore.get(`trace-${traceId}.json`);
```

---

## Integration Points

### With Existing Effect.withSpan

**No breaking changes** — existing code continues to work:

```typescript
// Before (existing code)
Effect.withSpan('DataManager.dispatch.search', () => kernel.search(query));

// After (enhanced with persistence) — same API, adds persistence
Effect.withSpan('DataManager.dispatch.search', () => kernel.search(query)).pipe(
  Effect.provide(InstrumentationService.Default)
);
```

### With effect-atom

```typescript
import { Atom } from '@effect-atom/atom';
import { InstrumentationService } from '@/lib/instrumentation';

const runtimeAtom = Atom.runtime(
  Layer.mergeAll(SearchKernel.Default, InstrumentationService.Default)
);

const searchOp = runtimeAtom.fn<string>()((query, ctx) =>
  Effect.gen(function* () {
    const kernel = yield* SearchKernel;
    return yield* kernel.search(query);
  }).pipe(withSpan('searchOps.query', { query }))
);
```

### With OpenTelemetry (Production)

```typescript
import { NodeSdk } from '@effect/opentelemetry';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

const telemetryLayer = NodeSdk.layer(() => ({
  resource: {
    serviceName: 'tmnl',
    serviceVersion: '2.0.0',
    'deployment.environment': process.env.NODE_ENV,
  },
  spanProcessor: new BatchSpanProcessor(
    new OTLPTraceExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
        'http://localhost:4318/v1/traces',
    })
  ),
  sampler: new TraceIdRatioBasedSampler(0.1), // 10% sampling
}));

const AppLayer = Layer.mergeAll(InstrumentationService.Default, telemetryLayer);
```

---

## AI-Friendly Output Format

### Span JSON Structure

```json
{
  "spanId": "550e8400-e29b-41d4-a716-446655440000",
  "traceId": "7a2f8c3d-1b9e-4f6a-8d5c-3e4f7g8h9i0j",
  "name": "DataManager.dispatch.search",
  "kind": "internal",
  "startTime": "2025-01-28T02:30:00.000Z",
  "endTime": "2025-01-28T02:30:00.123Z",
  "status": "ok",
  "attributes": {
    "service.name": "tmnl-data-manager",
    "service.version": "2.0.0",
    "operation.type": "search",
    "search.query": "matrix",
    "search.limit": 100,
    "kernel.type": "flex"
  },
  "events": [
    {
      "name": "kernel.initialized",
      "timestamp": "2025-01-28T02:30:00.010Z",
      "attributes": { "driver": "flexsearch" }
    },
    {
      "name": "search.completed",
      "timestamp": "2025-01-28T02:30:00.120Z",
      "attributes": { "resultCount": 42 }
    }
  ]
}
```

### LLM Query Examples

```
"Find all spans where search.query contains 'matrix' and resultCount > 10"
"Show me all failed operations in DataManager service from the last hour"
"What's the average duration of FileAccessService.readFile operations?"
"Trace the execution path for traceId 7a2f8c3d..."
```

---

## Development Roadmap

### Phase 1: Core Service (✅ In Progress)

- [x] `types.ts` — OpenTelemetry-compliant types
- [x] `InstrumentationService.ts` — Effect.Service with span capture
- [ ] `pipeable.ts` — withSpan, tapTrace, captureError utilities
- [ ] Unit tests with @effect/vitest

### Phase 2: OpenTelemetry Bridge

- [ ] Install `@effect/opentelemetry`
- [ ] Create `NodeSdkLayer` configuration
- [ ] Wire `InstrumentationService` to OT Tracer
- [ ] Test OTLP export to Jaeger/Zipkin

### Phase 3: NATS Persistence

- [ ] Create `NatsPersistence.ts` service
- [ ] KV bucket setup (`tmnl-traces`)
- [ ] ObjectStore setup (`tmnl-trace-data`)
- [ ] JetStream configuration (`TRACES` stream)
- [ ] Query API for trace retrieval

### Phase 4: React Hooks

- [ ] `useInstrumented` — Wrap operations with tracing
- [ ] `useTrace` — Query trace by ID
- [ ] `useTraceList` — List traces for service
- [ ] DevTools panel component

### Phase 5: AI Integration

- [ ] Semantic search over spans
- [ ] LLM-friendly trace summaries
- [ ] Natural language query interface

---

## Configuration

### Environment Variables

```bash
# Service identification
TMNL_SERVICE_NAME=tmnl-data-manager
TMNL_SERVICE_VERSION=2.0.0

# Tracing
TMNL_ENABLE_TRACING=true
TMNL_SAMPLE_RATE=0.1  # 10% sampling

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
OTEL_EXPORTER_OTLP_HEADERS=x-api-key:your-key

# NATS
NATS_URL=ws://localhost:9222
NATS_KV_BUCKET=tmnl-traces
NATS_OBJECT_STORE_BUCKET=tmnl-trace-data
```

### Layer Composition

```typescript
const DevLayer = Layer.mergeAll(
  InstrumentationConfig.Custom({
    serviceName: 'tmnl-dev',
    enableTracing: true,
    sampleRate: 1.0, // 100% in dev
  }),
  InstrumentationService.Default,
  NatsKVService.Default
);

const ProdLayer = Layer.mergeAll(
  InstrumentationConfig.Custom({
    serviceName: 'tmnl-prod',
    enableTracing: true,
    sampleRate: 0.01, // 1% in prod
  }),
  InstrumentationService.Default,
  telemetryLayer, // OpenTelemetry
  NatsKVService.Default
);
```

---

## Testing Strategy

### Unit Tests

```typescript
import { describe, it, expect } from '@effect/vitest';
import { Effect, Ref } from 'effect';
import { InstrumentationService } from './InstrumentationService';

describe('InstrumentationService', () => {
  it.effect('captures span lifecycle', () =>
    Effect.gen(function* () {
      const service = yield* InstrumentationService;

      const spanId = yield* service.startSpan('test.operation', 'internal', {
        key: 'value',
      });
      yield* service.endSpan(spanId, 'ok');

      const spans = yield* service.getCapturedSpans();

      expect(spans).toHaveLength(1);
      expect(spans[0].name).toBe('test.operation');
      expect(spans[0].status).toBe('ok');
    }).pipe(Effect.provide(InstrumentationService.Default))
  );
});
```

### Integration Tests

```typescript
it.effect('persists spans to NATS KV', () =>
  Effect.gen(function* () {
    const instrumentation = yield* InstrumentationService;
    const natsKv = yield* NatsKVService;

    const spanId = yield* instrumentation.startSpan(
      'nats.test',
      'internal',
      {}
    );
    yield* instrumentation.endSpan(spanId, 'ok');

    const bucket = yield* natsKv.getOrCreateBucket('tmnl-traces');
    const stored = yield* natsKv.get(bucket, `span:${spanId}`, CapturedSpan);

    expect(stored.name).toBe('nats.test');
  }).pipe(
    Effect.provide(
      Layer.mergeAll(InstrumentationService.Default, NatsKVService.Default)
    )
  )
);
```

---

## Open Questions

1. **Sampling Strategy** — 10% default reasonable? Adaptive sampling based on span name?
2. **NATS TTL** — How long to retain traces in KV? 7 days? 30 days?
3. **ObjectStore Threshold** — What size triggers move to ObjectStore? 10KB? 100KB?
4. **React DevTools** — Standalone panel or integrate with existing DevTools?
5. **Trace Export** — Support Jaeger UI? Custom visualization?

---

## References

- **Research**: `bg_b475c47c` — Effect + OpenTelemetry patterns
- **Existing Usage**: `bg_46720d80` — TMNL Effect.withSpan audit
- **OpenTelemetry**: https://opentelemetry.io/docs/specs/otel/
- **@effect/opentelemetry**: Effect-TS official package
- **NATS**: https://docs.nats.io/
- **Effect Docs**: ../../submodules/website/

---

**Last Updated**: 2025-12-28  
**Author**: Val (TMNL Architect)  
**Status**: Design Phase — awaiting Prime approval to proceed to implementation
