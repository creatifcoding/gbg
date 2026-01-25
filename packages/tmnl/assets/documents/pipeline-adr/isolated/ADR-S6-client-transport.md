---
id: "S6"
title: "Client Transport Layer — WebSocket/SSE"
commitHash: "6656064"
status: "draft"
date: "2026-01-02"
tier: "isolated"
stages: ["S6"]
---

# ADR-S6: Client Transport Layer

## Context

### Stages Covered
- S6 (Client Transport)

### Problem

Browser-based TMNL clients require real-time sensor data streaming from NATS JetStream (S5) to React components (S9). The client transport layer must:

1. **Establish persistent connections** — Survive network disruptions, browser sleep, and service restarts
2. **Handle reconnection gracefully** — Exponential backoff, catch-up from last offset, no data loss
3. **Support WebSocket and SSE** — Hybrid approach (WebSocket primary, SSE fallback)
4. **Manage connection lifecycle** — Connect, heartbeat, reconnect, graceful shutdown
5. **Provide backpressure signals** — Prevent buffer overflow when React rendering lags behind data rate
6. **Expose connection state** — Observable atoms for UI feedback (connecting/connected/error)

The client transport layer is the **boundary between the network and application state** — failures here manifest as stale data, frozen UIs, and silent data loss.

### Constraints

- **WebSocket NATS at port 9222** — TMNL infrastructure runs `ws://localhost:9222` (see `/docker/nats/nats-server.conf`)
- **Browser limitations** — No TCP sockets, limited connection pooling, subject to CORS/CSP policies
- **Effect-TS integration** — Must integrate with Effect.Stream, Atom.runtime, and service layers
- **Atom-as-State doctrine** — Connection state stored in module-level atoms, not useState
- **No authentication in dev** — Production auth (JWT/mTLS) deferred to production
- **Testability** — Must support mock transports for unit tests (no live WebSocket)

### Assumptions

- NATS server is accessible from browser (same-origin or CORS-enabled)
- Network latency browser↔NATS is <100ms (local dev or CDN edge)
- Browser EventSource API available (SSE fallback)
- WebSocket connections are cheaper than HTTP long-polling (no fallback to polling)
- Connection churn is acceptable (<10s reconnect delay)
- Heartbeat overhead is negligible (<1KB/30s)

## Decision

### Summary

Use **nats.ws** for WebSocket-based NATS client with a hybrid fallback to **SSE** for read-only streams. Implement exponential backoff reconnection (100ms → 30s), heartbeat keepalive (30s interval), and catch-up via JetStream consumer offsets. Expose connection state via effect-atom for reactive UI feedback.

### Technologies

| Technology | Version | Purpose | File Reference |
|------------|---------|---------|----------------|
| nats.ws | 1.x | WebSocket NATS client | `/src/lib/nats/NatsKVService.ts` (existing) |
| EventSource API | Native | SSE fallback for streams | `/src/lib/ai-core/services/SSEAdapter.ts` (pattern reference) |
| Effect.Stream | latest | Async stream abstraction | Effect runtime integration |
| effect-atom | latest | Connection state atoms | `/src/lib/dataplane/atoms/index.ts` (pattern) |
| XState v5 | 5.x | Connection state machine | `/src/lib/dataplane/components/Port/port-stx.ts` (stx pattern) |

### Patterns

- **Hybrid Transport**: WebSocket primary, SSE fallback
  - WebSocket: Bidirectional, low-latency, supports NATS request-reply
  - SSE: Unidirectional, HTTP-based, simpler retry semantics
  - Decision: Try WebSocket → fallback to SSE on protocol error (not network error)

- **Exponential Backoff Reconnection**:
  ```typescript
  const reconnectDelays = [100, 200, 500, 1000, 2000, 5000, 10000, 30000] // ms
  const maxReconnectAttempts = 8 // Then circuit-open state
  ```
  - Jitter: ±20% random variance to prevent thundering herd
  - Circuit breaker: After 8 failed attempts, wait 5 minutes before retry
  - Reset: Successful connection resets backoff to 100ms

- **Heartbeat Keepalive**:
  - Interval: 30s (configurable via atom)
  - Payload: NATS PING/PONG (1 byte overhead)
  - Timeout: 10s (if no PONG, assume dead → reconnect)
  - Purpose: Detect half-open TCP connections (mobile networks, NAT timeouts)

- **Catch-Up Mechanism**:
  - **JetStream consumer offset**: Client stores last ACK'd sequence number in `localStorage`
  - **Replay on reconnect**: Subscribe with `startSequence: lastOffset + 1`
  - **Gap detection**: If server reports missing messages (offset jump), emit warning
  - **Full sync fallback**: If gap >1000 messages, fetch snapshot from S5 (Storage)

- **Connection State Machine (stx pattern)**:
  ```typescript
  type ConnectionState =
    | 'idle'           // Not connected, no attempt
    | 'connecting'     // WebSocket opening
    | 'connected'      // Healthy, receiving data
    | 'reconnecting'   // Backoff delay active
    | 'degraded'       // SSE fallback mode
    | 'circuit-open'   // Max retries exceeded, manual intervention required
    | 'error'          // Permanent failure (auth, protocol mismatch)
  ```

- **Atom-as-State for Connection Lifecycle**:
  ```typescript
  export const connectionStatusAtom = Atom.make<ConnectionState>('idle')
  export const reconnectAttemptsAtom = Atom.make<number>(0)
  export const lastMessageTimestampAtom = Atom.make<number>(0)
  export const heartbeatLatencyAtom = Atom.make<number>(0) // ms
  ```

### Interfaces

| Interface | Protocol | Schema |
|-----------|----------|--------|
| S5→S6 | WebSocket (NATS) | `nats.ws` messages (binary/JSON) |
| S6→S7 | Effect.Stream | `Stream<SensorTelemetry, TransportError>` |
| S6→S8 | Atom updates | Connection state atoms (reactive) |
| S6 (SSE fallback) | Server-Sent Events | `text/event-stream` with JSON payloads |

**Connection Schema** (Effect Schema):
```typescript
class ConnectionConfig extends Schema.Class<ConnectionConfig>('ConnectionConfig')({
  url: Schema.String, // ws://localhost:9222 or SSE endpoint
  protocol: Schema.Literal('websocket', 'sse'),
  reconnectDelays: Schema.Array(Schema.Number), // [100, 200, 500, ...]
  maxReconnectAttempts: Schema.Number,
  heartbeatIntervalMs: Schema.Number,
  heartbeatTimeoutMs: Schema.Number,
  enableCompression: Schema.Boolean, // gzip for large payloads
}) {}

class TransportError extends Schema.TaggedError<TransportError>()(
  'TransportError',
  {
    phase: Schema.Literal('connect', 'heartbeat', 'receive', 'decode'),
    message: Schema.String,
    code: Schema.optional(Schema.String), // WebSocket close code
    recoverable: Schema.Boolean,
  }
) {}
```

## Rationale

### Alternatives Considered

1. **WebSocket-only (no SSE fallback)**
   - **Pros**: Simpler architecture, bidirectional, lower latency
   - **Cons**: Fails hard on WebSocket-blocking proxies (corporate firewalls)
   - **Rejected**: SSE provides graceful degradation for read-heavy use cases

2. **SSE-only (no WebSocket)**
   - **Pros**: HTTP-based (firewall-friendly), auto-reconnect built-in
   - **Cons**: Unidirectional (no NATS request-reply), HTTP overhead, no binary support
   - **Rejected**: NATS requires bidirectional for ACKs and KV operations

3. **HTTP long-polling**
   - **Pros**: Maximum compatibility (works everywhere)
   - **Cons**: High latency (round-trip per message), server resource waste (holding connections)
   - **Rejected**: Unacceptable for real-time telemetry (>100ms latency)

4. **WebTransport (QUIC)**
   - **Pros**: Low latency, multiplexed streams, built-in retry
   - **Cons**: Browser support limited (Chrome-only as of 2025), not supported by NATS
   - **Rejected**: Too bleeding-edge, no NATS integration

5. **Shared WebWorker for connection pooling**
   - **Pros**: Single WebSocket shared across tabs (efficient)
   - **Cons**: Complex lifecycle management, debugging nightmares, SharedArrayBuffer restrictions
   - **Rejected**: Premature optimization, adds complexity

### Tradeoffs

| Gain | Cost |
|------|------|
| **Reconnection resilience** — Auto-recover from network blips | Reconnect storms — Backoff jitter mitigates but doesn't eliminate |
| **Heartbeat keepalive** — Detect dead connections quickly | Bandwidth overhead — 1KB/30s per connection (~2.5MB/day/user) |
| **Catch-up from offset** — No data loss on reconnect | Storage dependency — Requires localStorage or IndexedDB |
| **SSE fallback** — Works through restrictive proxies | Degraded UX — Read-only mode, higher latency |
| **Compression (gzip)** — 70% bandwidth reduction on JSON payloads | CPU overhead — 5-10ms encode/decode per message (negligible) |
| **Connection state atoms** — Reactive UI feedback | State synchronization complexity — Must handle race conditions |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Reconnect storm** — 1000 clients reconnect simultaneously after NATS restart | Medium | High | Jittered backoff (±20%), staggered retry windows per user cohort |
| **localStorage quota exhausted** — Offset persistence fails | Low | Medium | Fallback to in-memory offset (lost on tab close), alert user |
| **WebSocket blocked by firewall** — Corporate proxies drop WS handshake | Medium | Medium | Auto-fallback to SSE (degraded mode), show warning banner |
| **Heartbeat timeout false positive** — Slow network triggers reconnect | Low | Low | Increase timeout to 15s (vs 10s), log latency metrics |
| **Message reordering on reconnect** — Gap-fill breaks ordering guarantees | Low | High | JetStream sequence numbers enforce ordering, detect gaps client-side |
| **Memory leak on long-lived connections** — WebSocket event listeners not GC'd | Medium | Medium | Explicit cleanup in connection state machine exit handlers |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `/src/lib/nats/NatsClientTransport.ts` | create | WebSocket transport with reconnection logic |
| `/src/lib/nats/SSETransport.ts` | create | SSE fallback transport (read-only) |
| `/src/lib/nats/ConnectionStateMachine.ts` | create | XState v5 state machine for connection lifecycle (stx pattern) |
| `/src/lib/nats/atoms/connection.ts` | create | Connection state atoms (status, latency, attempts) |
| `/src/lib/nats/schemas/transport.ts` | create | ConnectionConfig, TransportError schemas |
| `/src/lib/dataplane/atoms/index.ts` | modify | Reference pattern for atom organization |
| `/src/lib/dataplane/components/Port/port-stx.ts` | reference | XState integration pattern |
| `/src/lib/nats/__tests__/reconnection.test.ts` | create | Unit tests for backoff, heartbeat, catch-up |

### Dependencies

```json
{
  "nats.ws": "^1.28.0",          // Already installed (NatsKVService)
  "@effect/schema": "latest",     // Already installed
  "xstate": "^5.0.0",             // State machine (already in stack)
  "@xstate/react": "^4.0.0",      // React hooks (if needed)
  "effect-atom": "latest"         // Already installed
}
```

**No new dependencies required** — leverage existing stack.

### Test Strategy

**Unit Tests** (`@effect/vitest`):
1. **Reconnection Logic**:
   - Simulate WebSocket close → assert exponential backoff delays
   - Verify jitter (±20% variance on delays)
   - Test circuit breaker (8 failures → circuit-open state)

2. **Heartbeat**:
   - Mock PING/PONG exchange → assert 30s interval
   - Simulate missed PONG → assert reconnect triggered
   - Measure latency calculation accuracy

3. **Catch-Up**:
   - Mock localStorage with offset=100 → reconnect → assert `startSequence: 101`
   - Simulate gap (server offset=150, client=100) → assert warning emitted
   - Test full-sync fallback (gap >1000)

4. **SSE Fallback**:
   - Simulate WebSocket protocol error → assert fallback to SSE
   - Verify EventSource subscription, message parsing
   - Test SSE auto-reconnect behavior

**Integration Tests** (Docker Compose + Vitest):
1. **End-to-End Connection**:
   - Start NATS container
   - Connect via NatsClientTransport
   - Publish message → assert received
   - Disconnect gracefully → assert cleanup

2. **Reconnection Flow**:
   - Establish connection
   - Restart NATS container
   - Assert: Client reconnects within 5s
   - Assert: Catch-up from last offset

3. **Heartbeat Failure**:
   - Establish connection
   - Block PONG responses (network delay simulation)
   - Assert: Reconnect triggered after 10s timeout

4. **Connection State Atoms**:
   - Subscribe to `connectionStatusAtom`
   - Trigger connect → reconnect → error sequence
   - Assert: State transitions match expected flow

**Manual Tests** (Browser DevTools):
- Chrome Network tab: Throttle to "Slow 3G" → verify reconnect
- Firefox: Close WebSocket from console → verify catch-up
- Safari: Background tab → resume → verify heartbeat recovery

## Metadata

### Related ADRs
- **ADR-S5-S6** (Storage-Client integration) — JetStream consumer offsets for catch-up
- **ADR-S6-S7** (Client-Filtering integration) — Backpressure signals to S7 dead-band filter
- **ADR-S4-S6** (Schema contract synergy) — Validation of messages at transport boundary
- **ADR-S3-S6-S8** (Error handling triplet) — TransportError flows through to atom Result types

### Open Questions
1. **Compression strategy** — Should gzip be always-on or adaptive (payload size threshold)?
2. **Connection pooling** — Should multiple subscriptions share a single WebSocket?
3. **Offline mode** — Should client queue messages in IndexedDB when disconnected?
4. **Metrics collection** — What telemetry to emit? (latency, reconnects, message rate)
5. **Multi-tab coordination** — Should tabs negotiate leader election for shared connection?

### References
- NATS WebSocket docs: https://docs.nats.io/using-nats/developer/connecting/websocket
- nats.ws library: https://github.com/nats-io/nats.ws
- EventSource API: https://developer.mozilla.org/en-US/docs/Web/API/EventSource
- XState stx pattern: `/src/lib/dataplane/components/Port/port-stx.ts`
- Connection atoms pattern: `/src/lib/dataplane/atoms/index.ts`
- NATS server config: `/docker/nats/nats-server.conf`
