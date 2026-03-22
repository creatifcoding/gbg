---
id: S6-S7
title: "Client Transport → Filtering Integration — Where to Filter (Server vs Client)"
commitHash: "6656064"
status: draft
date: "2026-01-02"
tier: pair-adjacent
stages:
  - S6
  - S7
---

# ADR-S6-S7: Client Transport → Filtering Integration

**ID**: S6-S7
**Commit Hash**: 6656064
**Status**: draft
**Date**: 2026-01-02
**Tier**: pair-adjacent

## Context

### Stages Covered
- S6 (Client Transport) — WebSocket/SSE connection to NATS JetStream
- S7 (Filtering) — Dead-band compression & backpressure management

### Problem

High-frequency sensor data flows from NATS JetStream (S5) through the client transport layer (S6) to the filtering stage (S7). A critical architectural question emerges at this boundary: **Where should filtering occur — server-side (before transport) or client-side (after receipt)?**

The placement of filtering logic fundamentally impacts:

1. **Bandwidth Efficiency** — Server-side filtering reduces data transmitted over WAN links (cellular/satellite)
2. **Latency** — Client-side filtering adds processing delay (10-50ms per batch)
3. **Flexibility** — Client-side filtering allows dynamic threshold tuning without server redeployment
4. **CPU Distribution** — Server-side filtering concentrates load; client-side distributes it
5. **Debug Visibility** — Server-side filtering obscures raw data; client-side preserves it for inspection

The naive approaches fail:
- **Server-only filtering** — Inflexible, requires redeployment for threshold changes, obscures debugging
- **Client-only filtering** — Wastes bandwidth on unfiltered streams, overloads cellular links
- **No coordination** — Duplicate filtering logic, inconsistent behavior, wasted CPU

**Core question**: How do client and server coordinate filtering responsibilities to maximize bandwidth efficiency, preserve debug visibility, and maintain deployment flexibility?

### Constraints

- **NATS JetStream at S5** — Server-side filtering would occur at ingestion (S4) or storage query (S5)
- **WebSocket/SSE transport** — Client receives stream via S6, cannot alter server filtering retroactively
- **Per-sensor configurability** — 256 sensors × 4 fields = 1024 independent filter configurations
- **Runtime threshold tuning** — Operators adjust thresholds via UI without code deployment
- **Debug mode requirement** — Engineers must access raw (unfiltered) data for troubleshooting
- **Bandwidth constraints** — Edge devices on cellular links (10-100 Kbps typical)
- **Latency budget** — <100ms P95 end-to-end (sensor→UI)

### Assumptions

- Edge gateways (S2) already implement coarse dead-band filtering (see ADR-S2)
- NATS JetStream streams persist raw (unfiltered) sensor data for replay
- Client CPU is available (modern browsers, not resource-constrained)
- Network latency NATS→Client is variable (10ms LAN, 500ms cellular)
- Filter thresholds vary by deployment (factory vs field)
- Most deployments tolerate 10-100x data reduction without signal loss

## Decision

### Summary

Implement a **hybrid filtering strategy** with coordinated server/client responsibilities:

1. **Server-side (S4/S5)**: Coarse dead-band filtering with conservative thresholds (reduce bandwidth 5-10x)
2. **Client-side (S7)**: Fine-grained adaptive filtering with UI-configurable thresholds (reduce render load 10-100x)
3. **Filter negotiation protocol**: Client sends filter preferences on subscribe; server applies and acknowledges
4. **Passthrough mode**: Debug flag disables server-side filtering, preserving raw data for inspection

This approach optimizes bandwidth (server filtering), preserves flexibility (client filtering), and maintains visibility (passthrough mode).

### Technologies

| Technology | Purpose | Reference |
|------------|---------|-----------|
| **NATS Metadata Headers** | Filter config in subscribe request | nats.ws `headers` option |
| **Effect.Stream.filter** | Client-side dead-band application | Effect Stream operators |
| **effect-atom Registry** | Per-sensor threshold atoms | `/src/lib/filtering/atoms/thresholds.ts` (to create) |
| **LocalStorage** | Persist client filter preferences | Browser API |
| **XState v5 (stx)** | Filter state machine (enabled/passthrough/adaptive) | `/src/lib/dataplane/components/Port/port-stx.ts` pattern |

### Patterns

#### 1. Filter Placement Decision Matrix

| Factor | Server-Side Filtering | Client-Side Filtering | Hybrid (Recommended) |
|--------|----------------------|----------------------|----------------------|
| **Bandwidth Usage** | Best (90% reduction) | Worst (100% transmitted) | Good (95% reduction) |
| **Latency Impact** | +0ms (pre-transmission) | +10-50ms (decode + filter) | +5-20ms (light client filter) |
| **Threshold Flexibility** | Poor (requires redeploy) | Excellent (UI tunable) | Excellent (client override) |
| **CPU Load** | Server bears 100% | Client bears 100% | Distributed (80% server, 20% client) |
| **Debug Visibility** | Obscured (raw data lost) | Full (raw data available) | Full (passthrough mode) |
| **Configuration Complexity** | Low (single server config) | Medium (per-client prefs) | High (coordination protocol) |
| **Offline Resilience** | N/A (server required) | Good (local thresholds) | Good (fallback to client-only) |

**Decision**: Hybrid approach balances all factors. Server provides bandwidth optimization; client provides flexibility and visibility.

#### 2. Hybrid Strategy Architecture

**Server-Side Filtering (S4 Ingestion Layer)**:
- **Threshold**: Conservative (e.g., 2x expected noise floor)
- **Purpose**: Reduce bandwidth on WAN links (edge→cloud)
- **Algorithm**: OPC UA dead-band (absolute threshold)
- **Configurability**: Static per deployment (ansible/terraform variable)
- **Bypass**: Client can request `filterMode: 'none'` for raw data

**Client-Side Filtering (S7 Filtering Layer)**:
- **Threshold**: Aggressive (e.g., 0.5x noise floor for UI)
- **Purpose**: Reduce React render overhead, smooth animations
- **Algorithm**: Adaptive dead-band + temporal decimation (see ADR-S7)
- **Configurability**: Dynamic via UI, persisted in localStorage
- **Modes**:
  - `'auto'` — Adaptive threshold based on signal variance
  - `'manual'` — User-specified threshold per sensor
  - `'passthrough'` — No client filtering (render raw server data)

**Data Flow**:
```
Sensor (100Hz raw)
  ↓
S2 Edge (dead-band: 1.0 threshold) → 10Hz
  ↓
S3 Transport (MQTT→NATS bridge)
  ↓
S4 Ingestion (server filter: 0.5 threshold) → 5Hz
  ↓
S5 Storage (JetStream persistence)
  ↓
S6 Client Transport (WebSocket)
  ↓
S7 Client Filter (adaptive: 0.2 threshold) → 1Hz
  ↓
S8 State (atoms)
  ↓
S9 Presentation (React render)
```

**Effective Reduction**: 100Hz → 1Hz = 100x compression with 3-tier filtering.

#### 3. Filter Configuration Protocol

**Client Subscribe with Filter Preferences**:

```typescript
// S6 (Client Transport) — Subscribe with filter metadata
class SubscribeRequest extends Schema.Class<SubscribeRequest>('SubscribeRequest')({
  sensorId: Schema.String,
  fields: Schema.Array(Schema.String), // ['temperature', 'humidity']
  filterConfig: Schema.optional(FilterConfig),
  mode: Schema.Literal('filtered', 'raw'), // 'raw' = passthrough
}) {}

class FilterConfig extends Schema.Class<FilterConfig>('FilterConfig')({
  strategy: Schema.Literal('none', 'deadband', 'adaptive'),
  threshold: Schema.optional(Schema.Number), // Absolute value (e.g., 0.5°C)
  maxRateHz: Schema.optional(Schema.Number), // Temporal decimation (e.g., 10Hz max)
  fields: Schema.optional(Schema.Record({
    key: Schema.String,
    value: Schema.Number
  })), // Per-field thresholds: { temperature: 0.5, humidity: 1.0 }
}) {}
```

**Server Acknowledgment**:

```typescript
class FilterAck extends Schema.Class<FilterAck>('FilterAck')({
  sensorId: Schema.String,
  appliedFilter: FilterConfig,
  serverCapabilities: Schema.Struct({
    supportsAdaptive: Schema.Boolean,
    maxRateHz: Schema.Number, // Server's max rate limit
    minThreshold: Schema.Number, // Server's min threshold (noise floor)
  }),
}) {}
```

**NATS Message Flow**:

```typescript
// Client publishes subscribe request to control channel
await nats.publish('control.subscribe', {
  sensorId: 'th-001',
  mode: 'filtered',
  filterConfig: {
    strategy: 'deadband',
    threshold: 0.5,
    maxRateHz: 10
  }
})

// Server responds with acknowledgment
const ack = await nats.request('control.subscribe', ..., { timeout: 5000 })
// ack.data: { appliedFilter: { threshold: 0.5 }, serverCapabilities: { ... } }

// Server adjusts stream filtering based on client preference
// JetStream consumer delivers filtered messages
```

**Fallback Behavior**:
- If server doesn't support filter negotiation → client receives unfiltered stream, applies local filtering
- If client specifies invalid threshold (below server min) → server clamps to valid range, notifies via `appliedFilter`

#### 4. Passthrough Mode (Debug/Raw Data)

**Trigger**: Client sets `mode: 'raw'` in subscribe request OR presses "Raw Data" button in UI.

**Server Behavior**:
- Disables all server-side filtering for this subscription
- Delivers raw sensor data at full rate (e.g., 100Hz)
- Adds header: `X-Filter-Mode: raw`

**Client Behavior** (S7 Filtering):
- Detects `X-Filter-Mode: raw` header
- Disables client-side dead-band filtering
- Optionally applies temporal decimation (to prevent render overload)
- UI shows "RAW DATA MODE" banner (yellow warning)

**Use Cases**:
- **Debugging sensor drift**: Compare raw vs filtered to verify threshold accuracy
- **Algorithm tuning**: Observe signal characteristics to set optimal thresholds
- **Incident investigation**: Replay raw data from JetStream to analyze anomalies

**Performance Impact**:
- Network bandwidth: 10-100x increase (acceptable for short debug sessions)
- Client CPU: +20-50ms per batch (Effect.Stream decode overhead)
- UI render: Throttled via temporal decimation (max 10Hz to prevent jank)

**Safety Mechanisms**:
- Auto-disable after 5 minutes (prevent accidental sustained raw mode)
- Rate limit: Max 10 simultaneous raw subscriptions per client
- UI confirmation dialog: "Raw mode will increase bandwidth 100x. Continue?"

#### 5. Adaptive Client Filtering (S7 Enhancement)

**Problem**: Static thresholds fail for variable-rate signals (e.g., accelerometer during motion vs rest).

**Solution**: Track exponential moving variance, adjust threshold dynamically.

**Algorithm** (from ADR-S7 and SENSOR_DELTA_COMPRESSION_STRATEGIES.md):

```typescript
// Per-sensor adaptive state
let ema = 0         // Exponential moving average
let emVar = 0       // Exponential moving variance
const alpha = 0.1   // Smoothing factor

function updateVariance(value: number): number {
  const delta = value - ema
  ema += alpha * delta
  emVar = (1 - alpha) * (emVar + alpha * delta * delta)
  return Math.sqrt(emVar)
}

function getAdaptiveThreshold(baseThreshold: number, currentValue: number): number {
  const variance = updateVariance(currentValue)
  return baseThreshold * Math.max(1.0, variance / baseThreshold)
}

// Usage in S7 filter
const threshold = filterMode === 'adaptive'
  ? getAdaptiveThreshold(baseThreshold, reading.value)
  : baseThreshold

if (Math.abs(reading.value - lastTransmitted) > threshold) {
  emit(reading)
  lastTransmitted = reading.value
}
```

**Benefits**:
- Tight filtering during stable periods (low variance)
- Looser filtering during transients (high variance)
- Preserves critical events (spikes, alarms) without manual tuning

**Tradeoffs**:
- +5ms CPU per batch (variance calculation)
- Requires warm-up period (~100 samples for stable variance)
- May oscillate if signal has bimodal variance (mitigate with hysteresis)

### Interfaces

#### SubscribeWithFilter (S6→Server Control Channel)

**Schema**:
```typescript
class SubscribeWithFilter extends Schema.Class<SubscribeWithFilter>('SubscribeWithFilter')({
  type: Schema.Literal('subscribe'),
  sensorId: Schema.String,
  fields: Schema.Array(Schema.String),
  filter: Schema.optional(FilterConfig),
  mode: Schema.Literal('filtered', 'raw'),
  clientId: Schema.String, // For server-side subscription tracking
}) {}
```

**Wire Format** (NATS message):
```json
{
  "type": "subscribe",
  "sensorId": "th-001",
  "fields": ["temperature", "humidity"],
  "filter": {
    "strategy": "deadband",
    "threshold": 0.5,
    "maxRateHz": 10
  },
  "mode": "filtered",
  "clientId": "browser-session-abc123"
}
```

**NATS Subject**: `control.subscribe.{sensorId}`

#### FilterConfig (Client→Server Preference)

**Schema**:
```typescript
class FilterConfig extends Schema.Class<FilterConfig>('FilterConfig')({
  strategy: Schema.Literal('none', 'deadband', 'adaptive'),
  threshold: Schema.optional(Schema.Number),       // Absolute threshold (e.g., 0.5°C)
  thresholdPercent: Schema.optional(Schema.Number), // Percentage threshold (e.g., 5% of range)
  maxRateHz: Schema.optional(Schema.Number),       // Temporal decimation limit
  fields: Schema.optional(Schema.Record({          // Per-field overrides
    key: Schema.String,
    value: Schema.Number
  })),
}) {}
```

**Validation Rules** (server-side):
- `threshold >= 0` (negative thresholds rejected)
- `maxRateHz >= 0.1 && maxRateHz <= 1000` (sanity bounds)
- `strategy === 'none'` → ignore threshold/maxRateHz
- `fields` must reference valid sensor fields (checked against schema)

#### FilteredStream (S6→S7 Internal Interface)

**Schema** (Effect Stream element):
```typescript
class FilteredReading extends Schema.Class<FilteredReading>('FilteredReading')({
  sensorId: Schema.String,
  field: Schema.String,
  value: Schema.Number,
  timestamp: Schema.DateFromSelf,
  metadata: Schema.Struct({
    serverFiltered: Schema.Boolean,      // Was server filter applied?
    clientFiltered: Schema.Boolean,      // Was client filter applied?
    filterMode: Schema.Literal('raw', 'deadband', 'adaptive'),
    thresholdUsed: Schema.optional(Schema.Number),
  }),
}) {}
```

**Effect.Stream Type**:
```typescript
type FilteredStream = Stream.Stream<FilteredReading, TransportError, ClientTransportService>
```

#### BackpressureSignal (S8→S7 Feedback Loop)

**Schema** (atom notification):
```typescript
class QueueUtilization extends Schema.Class<QueueUtilization>('QueueUtilization')({
  queueSize: Schema.Number,      // Current queue depth
  capacity: Schema.Number,       // Max queue capacity
  utilizationPercent: Schema.Number, // queueSize / capacity * 100
  overflowCount: Schema.Number,  // Messages dropped since last reset
  recommendation: Schema.Literal('normal', 'increase-threshold', 'enable-decimation', 'alert'),
}) {}

// Atom in S8 (State layer)
export const queueUtilizationAtom = Atom.make<QueueUtilization>({
  queueSize: 0,
  capacity: 1000,
  utilizationPercent: 0,
  overflowCount: 0,
  recommendation: 'normal',
})

// S7 subscribes via ctx.get() and adjusts threshold
const utilization = ctx.get(queueUtilizationAtom)
if (utilization.recommendation === 'increase-threshold') {
  currentThreshold *= 2 // Adaptive backpressure response
}
```

## Rationale

### Alternatives Considered

1. **Server-Only Filtering**
   - **Pros**: Minimal bandwidth usage, centralized configuration, lower client CPU
   - **Cons**: Inflexible (requires redeploy for threshold changes), obscures raw data for debugging, single point of tuning failure
   - **Rejected**: Insufficient flexibility for dynamic operational environments (factory floor vs field deployment)

2. **Client-Only Filtering**
   - **Pros**: Maximum flexibility, full debug visibility, no server coordination complexity
   - **Cons**: Wastes bandwidth (transmits unfiltered 100Hz streams over cellular), overloads client decode/filter CPU
   - **Rejected**: Unacceptable bandwidth waste on WAN links (cellular/satellite)

3. **Server Filter with Client Override Flag**
   - **Pros**: Simpler than hybrid (no negotiation protocol), preserves debug mode
   - **Cons**: All-or-nothing (raw vs filtered), no per-sensor threshold tuning, bandwidth waste in debug mode
   - **Rejected**: Insufficient granularity (cannot tune per-sensor thresholds dynamically)

4. **EdgeDB Materialized Views for Filtering**
   - **Pros**: SQL-based filtering logic (declarative), leverages DB query planner
   - **Cons**: Requires EdgeDB at S5 (not JetStream), adds query latency (+50-200ms), complex schema migration
   - **Rejected**: Architectural mismatch (NATS JetStream is transport, not relational DB)

5. **WASM Filter Modules (Server-Side)**
   - **Pros**: High-performance server filtering, sandboxed extensibility
   - **Cons**: Deployment complexity (WASM build toolchain), limited NATS integration, debugging nightmares
   - **Rejected**: Over-engineered for threshold-based filtering (dead-band is O(1) primitive)

### Tradeoffs

| Gain | Cost |
|------|------|
| **Bandwidth optimization** (server filter: 90% reduction) | Protocol complexity — Filter negotiation adds 100ms connection setup latency |
| **Threshold flexibility** (client override, UI tunable) | State synchronization — Client and server filters must stay aligned |
| **Debug visibility** (passthrough mode for raw data) | Safety risk — Sustained raw mode can exhaust bandwidth quota |
| **Adaptive filtering** (variance-based threshold tuning) | CPU overhead — +5ms per batch for variance calculation |
| **Backpressure propagation** (S8→S7 queue feedback) | Increased complexity — Atom subscriptions, state machine transitions |
| **Per-sensor configurability** (1024 independent filters) | Configuration sprawl — LocalStorage bloat, UI complexity |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Filter config divergence** — Server applies different threshold than client expects | Medium | Medium | Server echoes `appliedFilter` in FilterAck; client validates and alerts on mismatch |
| **Passthrough mode forgotten** — Engineer enables raw mode, forgets to disable, exhausts bandwidth | High | Medium | Auto-disable after 5 minutes; UI shows persistent warning banner; log audit trail |
| **Adaptive filter oscillation** — Variance calculation causes threshold to fluctuate wildly | Low | Low | Add hysteresis (threshold change requires 10% delta); limit variance update rate (max 1Hz) |
| **Server filter bypass attack** — Malicious client requests `mode: 'raw'` to DoS server bandwidth | Low | High | Rate limit raw mode requests (max 10 concurrent per IP); require authentication in production |
| **LocalStorage quota exhausted** — Per-sensor filter configs exceed 5MB browser limit | Low | Low | Compress configs (JSON.stringify → gzip); fallback to default thresholds on quota error |
| **Client-side filter performance** — 1000 sensors × 10Hz = 10K filter ops/sec overwhelms browser | Medium | Medium | Offload to Web Worker; batch filter operations (amortize Map lookups) |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `/src/lib/nats/schemas/filter-config.ts` | create | FilterConfig, SubscribeWithFilter, FilterAck schemas |
| `/src/lib/nats/NatsClientTransport.ts` | modify | Add filter negotiation to subscribe flow |
| `/src/lib/filtering/DeadbandFilter.ts` | create | Client-side dead-band filter (from ADR-S7) |
| `/src/lib/filtering/AdaptiveFilter.ts` | create | Variance-based adaptive threshold logic |
| `/src/lib/filtering/atoms/thresholds.ts` | create | Per-sensor threshold atoms (localStorage-backed) |
| `/src/lib/filtering/BackpressureManager.ts` | create | S8→S7 queue utilization feedback loop |
| `/src/lib/filtering/__tests__/hybrid-filtering.test.ts` | create | Integration tests for server/client coordination |
| `/src/components/ui/RawDataModeBanner.tsx` | create | Warning banner for passthrough mode |
| `/docker/nats/streams/SENSOR_ZONE_*.json` | modify | Add filter metadata to JetStream stream config |

### Dependencies

**No new dependencies required** — leverage existing stack:
- `nats.ws` (already installed for S6)
- `@effect/schema` (FilterConfig validation)
- `effect-atom` (threshold atoms)
- `xstate` v5 (filter state machine)

### Migrations

**LocalStorage Schema** (`tmnl.filter-thresholds.v1`):
```json
{
  "version": 1,
  "thresholds": {
    "th-001:temperature": 0.5,
    "th-001:humidity": 1.0,
    "pr-042:pressure": 0.1
  },
  "mode": "adaptive",
  "passthroughSensors": [] // Sensors in raw mode
}
```

**NATS Stream Metadata** (JetStream consumer config):
```json
{
  "stream_name": "SENSOR_ZONE_plant-a",
  "consumer_config": {
    "filter_subject": "sensors.plant-a.>",
    "metadata": {
      "filter_strategy": "deadband",
      "default_threshold": 0.5,
      "supports_negotiation": true
    }
  }
}
```

### Test Strategy

**Unit Tests** (`@effect/vitest`):

1. **Filter Negotiation**:
   - Client sends SubscribeWithFilter → Server responds with FilterAck
   - Assert: `appliedFilter.threshold === requested.threshold`
   - Test: Server clamps invalid threshold → client receives adjusted value

2. **Hybrid Filtering Pipeline**:
   - Generate 1000 samples (100Hz, noise ±0.1)
   - Server filter (threshold: 1.0) → expect ~100 samples
   - Client filter (threshold: 0.5) → expect ~50 samples
   - Assert: Final output has 2% of original samples

3. **Passthrough Mode**:
   - Subscribe with `mode: 'raw'`
   - Assert: Server disables filtering, client receives all samples
   - Assert: UI banner visible

4. **Adaptive Threshold**:
   - Feed stable signal (σ=0.1) → expect tight threshold (~0.1)
   - Feed volatile signal (σ=2.0) → expect loose threshold (~2.0)
   - Assert: Threshold adjusts within 100 samples

5. **Backpressure Propagation**:
   - Fill S8 queue to 90% capacity
   - Assert: S7 receives `increase-threshold` recommendation
   - Assert: Client threshold doubles

**Integration Tests** (Docker Compose + NATS):

1. **End-to-End Filter Coordination**:
   - Start NATS + mock edge gateway (publishes 100Hz)
   - Client subscribes with `threshold: 0.5`
   - Assert: Client receives ~5Hz (server 50Hz → client 5Hz)
   - Verify: Network bandwidth < 5KB/s (vs 50KB/s unfiltered)

2. **Filter Config Persistence**:
   - Set threshold via UI → save to localStorage
   - Reload page → reconnect to NATS
   - Assert: Same threshold applied

3. **Raw Mode Bandwidth Impact**:
   - Subscribe in filtered mode (baseline: 5KB/s)
   - Enable raw mode → measure bandwidth
   - Assert: Bandwidth increases 10-100x
   - Assert: Auto-disable after 5 minutes

**Performance Tests** (criterion.rs pattern):

- 1000 sensors × 100Hz = 100K filter ops/sec
- Measure client-side filter latency (P50, P95, P99)
- Target: <10ms P95 end-to-end (receive → filter → atom update)
- Memory: Stable over 1M samples (no leaks)

## Metadata

### Related ADRs
- **ADR-S6** (Client Transport) — WebSocket/SSE connection to NATS, reconnection logic
- **ADR-S7** (Filtering) — Dead-band algorithm, adaptive threshold, backpressure
- **ADR-S2-S3** (Edge-Transport) — Server-side filtering at edge gateway (S2)
- **ADR-S4** (Ingestion) — Server-side filtering at ingestion layer (optional)
- **ADR-S8** (State) — Queue utilization atoms for backpressure feedback

### Open Questions

1. **Filter negotiation latency** — Is 100ms connection setup overhead acceptable? Benchmark on slow 3G.
2. **Server filter caching** — Should server cache filter configs per client? (Reduces NATS message overhead)
3. **Multi-field coordination** — If temperature threshold changes, should humidity auto-adjust? (Correlated sensors)
4. **Filter versioning** — How to migrate client configs when server filter algorithm changes? (Schema evolution)
5. **Raw mode audit trail** — Should passthrough mode trigger security event logging? (Compliance requirement)
6. **Adaptive warm-up** — How many samples required for stable variance estimate? (Currently 100, benchmark empirically)

### References

1. **OPC UA Part 8** — Dead-Band Filtering Algorithm
   https://reference.opcfoundation.org/Core/Part8/v104/docs/5.6.4

2. **TMNL Dead-Band Implementation**
   `/src/components/testbed/FermionTestbed.tsx` lines 135-158

3. **SENSOR_DELTA_COMPRESSION_STRATEGIES.md**
   `/assets/documents/SENSOR_DELTA_COMPRESSION_STRATEGIES.md`

4. **Effect.Stream Filtering**
   https://effect.website/docs/stream/operations#filtering

5. **NATS Request-Reply Pattern**
   https://docs.nats.io/nats-concepts/core-nats/reqreply

6. **ADR-S7 (Filtering Stage)**
   `/assets/documents/pipeline-adr/isolated/ADR-S7-filtering.md`

7. **ADR-S6 (Client Transport)**
   `/assets/documents/pipeline-adr/isolated/ADR-S6-client-transport.md`

### Glossary

- **Hybrid Filtering**: Coordinated server-side and client-side filtering with negotiated thresholds
- **Passthrough Mode**: Debug mode that disables all filtering to expose raw sensor data
- **Filter Negotiation**: Protocol for client to request and server to acknowledge filter configuration
- **Adaptive Threshold**: Dynamic threshold adjustment based on signal variance (exponential moving variance)
- **Backpressure Propagation**: Feedback loop from S8 queue utilization to S7 filter threshold
- **Dead-Band**: OPC UA standard filtering algorithm (emit only when |current - last| > threshold)
- **Temporal Decimation**: Fixed-rate downsampling (e.g., 100Hz → 10Hz) independent of value changes

---

**Author**: Val (TMNL Architectural Conscience)
**Reviewed**: Pending
**Approved**: Pending
