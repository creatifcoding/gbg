---
id: S3-S7
title: "Transport ↔ Filtering Synergy — Server-Side vs Client-Side Filter Placement"
commitHash: "6656064"
status: draft
date: 2026-01-02
tier: pair-synergy
participants:
  - S3 (Transport)
  - S7 (Filtering)
decisionMakers:
  - Val (Architecture)
  - Prime (System Design)
---

# ADR S3-S7: Transport ↔ Filtering Synergy — Server-Side vs Client-Side Filter Placement

## Context

The Streams Playground pipeline architecture faces a fundamental cross-cutting concern: **where should data filtering occur?** This decision spans two architectural stages:

- **S3 (Transport)**: Server-side SSE transmission with potential pre-filtering
- **S7 (Filtering)**: Client-side post-reception filtering and dead-band suppression

The placement decision has cascading implications for:
- Network bandwidth utilization
- Server CPU load
- Client CPU load
- User configurability and flexibility
- System responsiveness under varying load conditions

### Problem Statement

High-frequency sensor streams (e.g., 100 Hz position updates) generate significant data volume. A naive approach transmits all updates, consuming bandwidth and client resources. The question becomes: **should we filter at the source (S3), at the destination (S7), or employ a hybrid strategy?**

### Key Constraints

1. **Bandwidth**: Limited especially in mobile/embedded scenarios
2. **Latency**: Users expect real-time feedback (<100ms)
3. **Flexibility**: Users want dynamic threshold adjustment without server restart
4. **Load Management**: Server must handle 100+ concurrent streams
5. **Coherence**: Client and server filters must not conflict or double-suppress

---

## Decision

We adopt a **Hybrid Filter Placement Strategy** with coordinated server-side and client-side filtering, each optimized for different concerns.

### Filter Placement Analysis

| Location | Pros | Cons | Optimal Use Case |
|----------|------|------|------------------|
| **S3 (Server)** | • Reduces bandwidth (90-95%)<br>• Lowers client CPU load<br>• Centralizes policy | • Less flexible<br>• Requires server redeploy for threshold changes<br>• Server CPU cost | Coarse filtering with conservative thresholds |
| **S7 (Client)** | • Fully dynamic, user-configurable<br>• No server changes needed<br>• Can filter on client-specific criteria | • Full bandwidth consumption<br>• Client CPU overhead<br>• Redundant across clients | Fine-grained, user-specific filtering |
| **Both (Hybrid)** | • Bandwidth reduction + flexibility<br>• Defense in depth<br>• Load-adaptive | • Coordination complexity<br>• Two filter implementations | High-frequency streams with variable user needs |

### Recommended Strategy: Staged Hybrid Filtering

#### Stage 1: Server Coarse Filter (S3)
**Purpose**: Eliminate obvious noise before transmission

```typescript
interface ServerFilterConfig {
  strategy: 'deadband' | 'rate-limit' | 'none'
  threshold: number  // e.g., 0.05 = 5% change required
  maxRate?: number   // fallback rate limit (events/sec)
}

// Default configuration
const DEFAULT_SERVER_FILTER: ServerFilterConfig = {
  strategy: 'deadband',
  threshold: 0.05,  // Conservative: only suppress <5% changes
  maxRate: 50       // Safety: cap at 50 Hz even if noisy
}
```

**Impact**: Reduces transmission by ~90-95% for typical sensor drift (±2-3% noise).

#### Stage 2: Client Fine Filter (S7)
**Purpose**: User-specific precision control

```typescript
interface ClientFilterConfig {
  strategy: 'deadband' | 'hysteresis' | 'none'
  threshold: number  // e.g., 0.005 = 0.5% change required
  hysteresis?: number  // For deadband with hysteresis
}

// User-configurable via UI
const userFilterAtom = Atom.make<ClientFilterConfig>({
  strategy: 'deadband',
  threshold: 0.005,  // Aggressive: suppress <0.5% changes
})
```

**Impact**: Further reduces rendering updates by ~50% of server-passed events, for a **net 97.5% reduction** from source.

---

## Architecture

### Filter Coordination Protocol

To avoid conflicts (e.g., server threshold tighter than client), we establish a coordination contract:

1. **Client Requests Filter Capabilities**
   ```typescript
   // On connection, client queries server config
   const serverConfig = yield* Transport.getFilterConfig()
   ```

2. **Server Applies Coarse Filter**
   ```typescript
   // S3 applies deadband before SSE transmission
   const filtered = stream.pipe(
     Stream.filterMap((event) =>
       deadbandFilter(event, config.threshold)
         ? Option.some(event)
         : Option.none()
     )
   )
   ```

3. **Client Applies Fine Filter**
   ```typescript
   // S7 applies tighter deadband on received stream
   const clientFiltered = serverStream.pipe(
     Stream.filterMap((event) =>
       deadbandFilter(event, userConfig.threshold)
         ? Option.some(event)
         : Option.none()
     )
   )
   ```

4. **No Conflict Invariant**
   - Client threshold ≤ Server threshold (client is strictly tighter)
   - If user sets client threshold > server threshold, warn in UI
   - Server broadcasts its current threshold on connection

### Dynamic Threshold Adjustment

#### Client-Initiated Bypass (Raw Mode)
For debugging or high-precision scenarios:

```typescript
interface RawModeRequest {
  enabled: boolean
  duration?: number  // Auto-disable after N seconds
}

// Client sends control message
yield* Transport.setRawMode({ enabled: true, duration: 30 })
```

Server responds by temporarily disabling its filter for that client's stream.

#### Server-Initiated Throttling (Load Shedding)
Under high load (e.g., >500 concurrent streams):

```typescript
// Server dynamically increases threshold
const adaptiveThreshold = baseThreshold * (1 + loadFactor * 0.5)

// Broadcasts new config to all clients
yield* Transport.broadcastFilterUpdate({
  threshold: adaptiveThreshold,
  reason: 'high-load'
})
```

Clients adjust expectations or request rate reduction.

---

## Interfaces

### Server-Side Filter Service

```typescript
class ServerFilterService extends Effect.Service<ServerFilterService>()('ServerFilterService', {
  effect: Effect.gen(function* () {
    const configAtom = Atom.make<ServerFilterConfig>(DEFAULT_SERVER_FILTER)

    return {
      applyFilter: <A>(stream: Stream.Stream<A>, extractor: (a: A) => number) =>
        Effect.gen(function* () {
          const config = yield* configAtom

          return stream.pipe(
            config.strategy === 'deadband'
              ? deadbandTransform(extractor, config.threshold)
              : Stream.throttle({ duration: `${1000 / (config.maxRate ?? 50)}ms` })
          )
        }),

      updateConfig: (newConfig: ServerFilterConfig) =>
        configAtom.pipe(Atom.set(newConfig)),

      getConfig: () => configAtom,
    }
  }),
  dependencies: [],
}) {}
```

### Client-Side Filter Hook

```typescript
export const useClientFilter = <T>(
  stream: Stream.Stream<T>,
  extractor: (t: T) => number,
  config: ClientFilterConfig
) => {
  const filtered = useMemo(
    () =>
      stream.pipe(
        Stream.filterMap((event) => {
          const value = extractor(event)
          const shouldPass = config.strategy === 'deadband'
            ? deadbandFilter(value, config.threshold)
            : true

          return shouldPass ? Option.some(event) : Option.none()
        })
      ),
    [stream, config]
  )

  return useStream(filtered)
}
```

---

## Consequences

### Positive

1. **Bandwidth Efficiency**: 90-95% reduction at S3, 97.5% total with S7
2. **User Control**: Client can tighten/loosen filter without server changes
3. **Load Adaptability**: Server can throttle under pressure
4. **Graceful Degradation**: If S3 filter fails, S7 still protects client
5. **Debugging Path**: Raw mode allows full stream inspection when needed

### Negative

1. **Dual Implementation**: Must maintain filter logic in both Rust (server) and TypeScript (client)
2. **Coordination Overhead**: Handshake protocol adds ~1 RTT on connection
3. **Threshold Mismatch Risk**: Users could misconfigure client > server threshold
4. **Testing Complexity**: Must verify filter behavior at both layers

### Neutral

1. **Configuration Surface**: More knobs for users (power vs simplicity tradeoff)
2. **Monitoring**: Requires metrics on filter effectiveness at both layers

---

## Metrics & Validation

### Key Performance Indicators

| Metric | Target | Measurement Point |
|--------|--------|-------------------|
| Server CPU (filtering) | <5% per stream | S3 filter application |
| Bandwidth reduction | >90% | S3 output vs input |
| Client render rate | <20 Hz for stable values | S7 output |
| Filter coordination latency | <50ms | Connection handshake |
| Raw mode activation time | <100ms | Control message RTT |

### Validation Scenarios

1. **Stable Stream**: 100 Hz input with ±2% noise → expect <5 Hz output at S7
2. **Rapid Change**: Step input → expect immediate pass-through at both S3/S7
3. **Load Spike**: 1000 concurrent streams → server increases threshold, clients notified
4. **Raw Mode**: User enables debug → full stream received within 100ms

---

## Related ADRs

- **ADR-S3**: Transport Architecture (SSE implementation)
- **ADR-S7**: Client-Side Filtering (dead-band strategies)
- **ADR-P1**: End-to-End Pipeline Flow (filtering placement in context)

---

## References

- Dead-band filtering: IEC 61131-3 control systems standard
- Load-adaptive throttling: Netflix Hystrix patterns
- Effect Stream filtering: `Stream.filterMap`, `Stream.throttle`

---

**Status**: Draft
**Next Steps**:
1. Implement `ServerFilterService` in Rust backend
2. Add filter coordination handshake to SSE transport
3. Expose client filter config UI with threshold slider
4. Add Grafana dashboards for filter effectiveness metrics
