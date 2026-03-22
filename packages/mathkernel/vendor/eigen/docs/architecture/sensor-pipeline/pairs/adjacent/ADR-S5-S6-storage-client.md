---
id: "S5-S6"
title: "Storage → Client Transport Integration"
commitHash: "6656064"
status: "draft"
date: "2026-01-02"
tier: "pair-adjacent"
stages: ["S5", "S6"]
---

# ADR-S5-S6: Storage → Client Transport Integration

## Context

### Stages Covered
- S5 (Storage) — NATS KV + SQLite persistence
- S6 (Client Transport) — WebSocket/SSE browser connectivity

### Problem

Browser clients require two distinct access patterns to sensor data persisted in the storage layer (S5):

1. **Query API for Historical Data** — Clients need to fetch time-range queries (last 24h, hourly aggregates, anomaly detection windows) from SQLite storage
2. **Live Update Streams** — Clients must receive real-time notifications when sensor state changes in NATS KV, without polling
3. **Initial State Hydration** — On connection, clients need current snapshot before subscribing to deltas
4. **Request/Response Correlation** — Async queries over WebSocket require correlation IDs to match responses with requests
5. **Subscription Lifecycle Management** — Clients must subscribe/unsubscribe to specific sensors, zones, or patterns dynamically
6. **Connection Resilience** — Query state and subscriptions must survive reconnection (no state loss on network blip)

The S5-S6 boundary is the **interface between server-side state and browser-side reactivity** — failures here manifest as stale UIs, duplicate subscriptions, and data inconsistency.

### Constraints

- **WebSocket-first, SSE fallback** — Primary transport is nats.ws WebSocket (port 9222), SSE for degraded mode
- **NATS KV watch already available** — NatsKVService.watch() provides Stream<KvWatchEvent> (see `/src/lib/nats/NatsKVService.ts:169`)
- **SQLite query layer exists** — Model.makeRepository provides Effect-based SQL queries (see `/src/lib/editor/v3/persistence/repositories.ts`)
- **Effect.Stream integration** — Client-side streams must integrate with effect-atom for reactive state
- **No REST endpoints** — All communication over persistent WebSocket connection (no HTTP query endpoints)
- **Schema consistency required** — Server and client must use identical SensorReading schema (no transform layer)

### Assumptions

- NATS WebSocket connection is stable (reconnection handled by S6)
- Historical queries are infrequent (<10 queries/min/client) vs live updates (continuous stream)
- Query response sizes are bounded (<1000 rows, <100KB JSON)
- Subscription fanout is manageable (<100 active subscriptions/client)
- Initial snapshot size is reasonable (<500 sensors × 200 bytes = <100KB)
- Network latency is tolerable for queries (100-500ms acceptable)

## Decision

### Summary

Implement **message-based query API over WebSocket** for historical data (request/response pattern with correlation IDs) and **native NATS KV watch streams** for live updates (pub/sub pattern). Use hybrid transport strategy: nats.ws native WebSocket for full NATS protocol support, with SSE fallback that wraps KV watch events as Server-Sent Events for read-only scenarios.

### Technologies

| Technology | Version | Purpose | File Reference |
|------------|---------|---------|----------------|
| nats.ws | ^1.28.0 | Native NATS WebSocket client | `/src/lib/nats/NatsKVService.ts` |
| EventSource API | Native | SSE fallback for streams | `/src/lib/ai-core/services/SSEAdapter.ts` |
| Effect.Stream | latest | Async stream abstraction | `/src/lib/nats/NatsKVService.ts:342` |
| @effect/sql | latest | SQL query abstraction | `/src/lib/editor/v3/persistence/repositories.ts` |
| Effect Schema | latest | Message validation | `/src/lib/editor/v3/schemas/` |

### Patterns

#### 1. Query API Design — REST-like over WebSocket

**Message-Based RPC Pattern**:
```typescript
// Client → Server query request
interface ClientQuery {
  type: 'query'
  id: string               // Correlation ID (UUID)
  path: string             // REST-like: '/sensors/:id/history'
  params?: {
    start?: string         // ISO timestamp
    end?: string           // ISO timestamp
    limit?: number         // Result pagination
    aggregation?: 'raw' | 'hourly' | 'daily'
  }
}

// Server → Client query response
interface ServerResponse {
  type: 'data' | 'error'
  correlationId: string    // Matches query.id
  payload: SensorReading[] | ErrorDetails
  metadata?: {
    count: number
    hasMore: boolean
    nextOffset?: number
  }
}
```

**Query Path Patterns**:
- `/sensors/:sensorId/current` — Latest reading from NATS KV
- `/sensors/:sensorId/history` — Time-range query from SQLite
- `/sensors/:sensorId/aggregates` — Hourly/daily rollups
- `/zones/:zone/sensors` — List all sensors in zone
- `/zones/:zone/temperature` — All temperature readings in zone

**Pagination Strategy**:
- `limit`: Max rows per response (default: 100, max: 1000)
- `offset`: Row offset for cursor pagination
- `hasMore`: Boolean indicating additional pages
- `nextOffset`: Server-provided continuation token

#### 2. Watch/Subscribe Pattern — NATS KV Native Streams

**Subscription Message Protocol**:
```typescript
// Client → Server subscription
interface SubscribeRequest {
  type: 'subscribe'
  id: string                   // Subscription ID (client-generated)
  pattern: string              // NATS KV pattern: 'zone1.*.temperature'
  options?: {
    includeHistory?: boolean   // Replay last N events
    historyDepth?: number      // Default: 1 (latest only)
  }
}

// Server → Client subscription confirmation
interface SubscribeAck {
  type: 'subscribed'
  subscriptionId: string
  pattern: string
  initialState?: SensorReading[]  // Snapshot if includeHistory=true
}

// Server → Client live updates (continuous)
interface UpdateEvent {
  type: 'update'
  subscriptionId: string
  event: KvWatchEvent<SensorReading>  // { key, value, revision, operation }
}

// Client → Server unsubscribe
interface UnsubscribeRequest {
  type: 'unsubscribe'
  subscriptionId: string
}
```

**NATS KV Watch Integration**:
```typescript
// Server-side: NATS KV watch → WebSocket broadcast
const handleSubscribe = (req: SubscribeRequest, ws: WebSocket) =>
  Effect.gen(function* () {
    const kvBucket = yield* NatsKVService.getOrCreateBucket('SENSOR_STATE');

    // Start KV watch stream
    const watchStream = NatsKVService.watch(
      kvBucket,
      req.pattern,  // e.g., 'zone1.*.temperature'
      SensorReading,
      { includeHistory: req.options?.includeHistory }
    );

    // Pipe watch events to WebSocket
    yield* Stream.runForEach(watchStream, (event) =>
      Effect.sync(() => {
        ws.send(JSON.stringify({
          type: 'update',
          subscriptionId: req.id,
          event: {
            key: event.key,
            value: event.value,
            revision: event.revision,
            operation: event.operation
          }
        }));
      })
    );
  });
```

**Filter Operators** (client-side, applied to subscription):
- Wildcard: `zone1.*.temperature` — All temperature sensors in zone1
- Multi-level: `zone1.>` — All sensors in zone1 (any measurement)
- Exact: `zone1.temp-42.temperature` — Single sensor

#### 3. Data Format — Schema Consistency

**SensorReading Schema** (shared server/client):
```typescript
class SensorReading extends Schema.TaggedClass<SensorReading>()(
  'SensorReading',
  {
    sensorId: Schema.String,
    zone: Schema.String,
    measurement: Schema.String,
    value: Schema.Number,
    unit: Schema.optional(Schema.String),
    timestamp: Schema.DateFromSelf,  // ISO string over wire → Date in memory
  }
) {}
```

**Wire Format**:
- Encoding: JSON (UTF-8)
- Timestamps: ISO 8601 strings (`2026-01-02T15:30:00.000Z`)
- Numbers: IEEE 754 doubles (no Infinity/NaN)
- Compression: gzip for responses >1KB (transparent via WebSocket compression extension)

**Initial Snapshot + Delta Updates**:
1. **Subscribe with history**: Client receives snapshot array in `SubscribeAck.initialState`
2. **Delta updates**: Subsequent `UpdateEvent` messages contain single readings
3. **Client-side merge**: Use revision numbers to detect out-of-order delivery

#### 4. Connection Lifecycle — Reconnection & State Recovery

**Connection Sequence**:
```
1. Client → Server: WebSocket handshake (nats.ws)
2. Server → Client: Connection established
3. Client → Server: Subscribe requests (restore previous subscriptions)
4. Server → Client: SubscribeAck + initial snapshots
5. Server → Client: UpdateEvent stream (continuous)
```

**Reconnection Protocol**:
```typescript
// Client-side: Persist active subscriptions in localStorage
const activeSubscriptions = Atom.make<Map<string, SubscribeRequest>>(new Map());

// On reconnect
const restoreSubscriptions = Effect.gen(function* () {
  const subs = yield* Atom.get(activeSubscriptions);

  yield* Effect.forEach(Array.from(subs.values()), (req) =>
    sendWebSocketMessage({ ...req, type: 'subscribe' })
  );
});
```

**State Reconciliation**:
- Client stores last-seen revision per sensor in IndexedDB
- On reconnect, request `includeHistory: true` to catch up
- Server sends delta (new revisions) since last-seen
- Client deduplicates by revision number

**Graceful Degradation on Partial Failures**:
- **Query timeout**: Return error after 5s, client retries with backoff
- **Subscription lost**: Server sends `{ type: 'unsubscribed', reason: 'connection-lost' }`, client resubscribes
- **SSE fallback**: If WebSocket fails, downgrade to SSE (read-only, no queries)

### Interfaces

| Interface | From | To | Protocol | Schema |
|-----------|------|-----|----------|--------|
| Query Request | S6 | S5 | WebSocket JSON | `ClientQuery` |
| Query Response | S5 | S6 | WebSocket JSON | `ServerResponse` |
| Subscribe | S6 | S5 | WebSocket JSON | `SubscribeRequest` |
| Live Updates | S5 | S6 | NATS KV watch → WebSocket | `UpdateEvent` |
| SSE Stream (fallback) | S5 | S6 | Server-Sent Events | `text/event-stream` with JSON payloads |

**Message Type Discriminator**:
```typescript
type ClientMessage =
  | ClientQuery
  | SubscribeRequest
  | UnsubscribeRequest;

type ServerMessage =
  | ServerResponse
  | SubscribeAck
  | UpdateEvent
  | ErrorMessage;
```

## Rationale

### Alternatives Considered

1. **REST API for Queries (HTTP + WebSocket for streams)**
   - **Pros**: Simpler mental model, standard HTTP caching, RESTful design
   - **Cons**: Dual protocol complexity, connection overhead (HTTP handshake per query), no correlation with live streams
   - **Rejected**: WebSocket RPC unifies transport, reduces latency (no handshake), enables stateful subscriptions

2. **GraphQL Subscriptions**
   - **Pros**: Unified query + subscription API, schema introspection, resolver composition
   - **Cons**: Heavy client-side bundle (graphql-ws), overkill for simple sensor data, no native NATS integration
   - **Rejected**: Complexity not justified for narrow use case (sensor telemetry)

3. **gRPC-Web**
   - **Pros**: Strongly-typed protocol, bidirectional streaming, HTTP/2 multiplexing
   - **Cons**: Requires HTTP/2 proxy, limited browser support, no NATS integration, protobuf compilation overhead
   - **Rejected**: Effect Schema provides similar type safety without protobuf, nats.ws simpler

4. **Polling (HTTP GET every 1s)**
   - **Pros**: Simplest implementation, works everywhere
   - **Cons**: High latency (1s delay), server resource waste (holding connections), no push updates
   - **Rejected**: Unacceptable for real-time telemetry UX

5. **Server-Sent Events Only (no WebSocket)**
   - **Pros**: HTTP-based (firewall-friendly), auto-reconnect built-in
   - **Cons**: No bidirectional queries, no subscription management, HTTP overhead per connection
   - **Rejected**: Query API requires request/response, SSE is read-only

### Tradeoffs

| Gain | Cost |
|------|------|
| **Unified transport** — Single WebSocket handles queries + streams | State management complexity — Server tracks active subscriptions per client |
| **Low latency queries** — No HTTP handshake (reuse WebSocket) | No HTTP caching — Must implement custom query cache |
| **Native NATS integration** — Direct KV watch streams | Vendor lock-in — Tight coupling to NATS (hard to swap broker) |
| **Schema validation** — Effect Schema on both sides ensures consistency | Double validation overhead — Validate on server (S5) and client (S6) |
| **Compression** — gzip reduces bandwidth 70% | CPU overhead — 5-10ms encode/decode per large response |
| **Subscription patterns** — Flexible NATS wildcards (`zone1.*.temperature`) | Client-side filtering — Clients receive more data than needed for complex filters |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Query response too large** — 10k row result crashes browser | Medium | High | Enforce `limit: 1000` max, paginate large results, warn in docs |
| **Subscription explosion** — Client subscribes to 1000+ sensors, memory exhaustion | Low | High | Limit subscriptions/client (100 max), server-side rate limiting |
| **Correlation ID collision** — UUID clash causes response mismatch | Very Low | Critical | Use crypto.randomUUID() (guaranteed unique per session) |
| **Clock skew** — Client/server timestamps diverge, query ranges broken | Low | Medium | Use server timestamps for queries, client timestamps only for display |
| **Stale subscription state** — Reconnect doesn't restore all subscriptions | Medium | Medium | Persist subscriptions in localStorage, reconcile on reconnect |
| **NATS KV watch lag** — High-frequency sensors overwhelm watch stream | Medium | Medium | Client-side backpressure (drop frames if render <60fps), S7 dead-band filtering |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `/src/lib/sensor-client/QueryService.ts` | create | WebSocket query API (request/response correlation) |
| `/src/lib/sensor-client/SubscriptionManager.ts` | create | Subscription lifecycle (subscribe/unsubscribe/reconcile) |
| `/src/lib/sensor-client/schemas.ts` | create | ClientQuery, ServerResponse, SubscribeRequest message schemas |
| `/src/lib/sensor-client/atoms/queries.ts` | create | Atoms for active queries, pending responses |
| `/src/lib/sensor-client/atoms/subscriptions.ts` | create | Atoms for active subscriptions, live updates |
| `/src/lib/sensor-client/hooks/useQuerySensor.ts` | create | React hook for ad-hoc queries |
| `/src/lib/sensor-client/hooks/useSubscribeSensor.ts` | create | React hook for live subscriptions |
| `/src/lib/sensor-storage/QueryRouter.ts` | modify | Add WebSocket query handler (path → SQL mapping) |
| `/src/lib/sensor-storage/WatchBroadcaster.ts` | create | NATS KV watch → WebSocket fan-out |
| `/src/lib/nats/SSEWatchAdapter.ts` | create | SSE fallback for KV watch streams |

### Dependencies

```json
{
  "nats.ws": "^1.28.0",          // Already installed
  "@effect/sql": "latest",        // Already installed
  "@effect/schema": "latest",     // Already installed
  "effect": "latest",             // Already installed
  "effect-atom": "latest"         // Already installed
}
```

**No new dependencies required** — reuse TMNL's existing stack.

### Test Strategy

**Unit Tests** (`@effect/vitest`):

1. **Query Correlation**:
   - Send query with `id: 'abc123'`
   - Assert response has `correlationId: 'abc123'`
   - Test timeout handling (no response after 5s)

2. **Subscription Lifecycle**:
   - Subscribe to `zone1.*.temperature`
   - Publish to `zone1.temp-42.temperature`
   - Assert UpdateEvent received with correct subscriptionId
   - Unsubscribe → assert no more events

3. **Pagination**:
   - Query 2500 rows with `limit: 100`
   - Assert first response: `count: 100, hasMore: true`
   - Follow `nextOffset` → assert second page correct

4. **Schema Validation**:
   - Send invalid query (missing `id`)
   - Assert error response with validation details
   - Send valid query → assert SensorReading[] decoded correctly

**Integration Tests** (Docker Compose + Vitest):

1. **End-to-End Query**:
   - Insert 100 SensorReading rows in SQLite
   - WebSocket query `/sensors/temp-42/history?start=now-1h`
   - Assert: 100 rows returned, sorted by timestamp DESC

2. **Live Update Flow**:
   - Client subscribes to `zone1.*.temperature`
   - Server publishes to NATS KV `zone1.temp-42.temperature`
   - Assert: Client receives UpdateEvent within 100ms

3. **Reconnection Recovery**:
   - Establish connection, subscribe to 5 sensors
   - Kill WebSocket connection
   - Reconnect → assert all 5 subscriptions restored
   - Verify no duplicate events

4. **SSE Fallback**:
   - Block WebSocket connection (simulate firewall)
   - Assert: Client falls back to SSE
   - Verify: Live updates still received (read-only)

**Load Tests** (optional, deferred):
- 100 concurrent clients, 10 subscriptions each (1000 total subscriptions)
- Measure: Server memory growth, message fanout latency, dropped frames
- Target: <500MB RAM, <50ms fanout latency, <1% dropped frames

## Metadata

### Related ADRs
- **ADR-S5** (Storage Layer) — Dual-write architecture (NATS KV + SQLite)
- **ADR-S6** (Client Transport) — WebSocket connection lifecycle, reconnection
- **ADR-S6-S7** (Client-Filtering integration) — Backpressure from S7 filters to S6 subscriptions
- **ADR-S3-S6** (Transport-Client synergy) — NATS JetStream → nats.ws WebSocket pathway
- **ADR-S5-S8** (Storage-State integration) — Query results flow into atoms for React rendering

### Open Questions

1. **Query caching strategy** — Should repeated queries (same params) return cached results? TTL?
2. **Subscription deduplication** — If client subscribes to overlapping patterns (`zone1.*`, `zone1.temp-42`), how to merge?
3. **Backpressure signaling** — Should server pause KV watch if client can't keep up? How to detect?
4. **Error retry policy** — Should query failures auto-retry (transient errors) or fail immediately?
5. **Metrics exposure** — Should server expose active subscription count, query rate via special query path?
6. **Multi-tab coordination** — Should tabs share subscriptions via BroadcastChannel?

### References

- NATS KV Service: `/src/lib/nats/NatsKVService.ts`
- SSEAdapter pattern: `/src/lib/ai-core/services/SSEAdapter.ts`
- SQL repositories: `/src/lib/editor/v3/persistence/repositories.ts`
- WebSocket reconnection: `/src/lib/nats/ConnectionStateMachine.ts` (from ADR-S6)
- NATS wildcard docs: https://docs.nats.io/nats-concepts/subjects#wildcards
- Effect.Stream docs: `../../submodules/website/content/docs/guides/streaming/`
