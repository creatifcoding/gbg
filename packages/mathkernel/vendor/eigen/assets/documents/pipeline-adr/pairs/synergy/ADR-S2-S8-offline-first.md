---
id: S2-S8
title: "Edge ↔ State Synergy — Offline-First & Optimistic Updates"
commitHash: "6656064"
status: draft
date: 2026-01-02
tier: pair-synergy
relates:
  - ADR-S2-edge-buffer
  - ADR-S8-client-state
dependencies:
  upstream: [S2]
  downstream: [S8]
crossCutting:
  - Offline resilience
  - State consistency
  - User experience continuity
---

# ADR-S2-S8: Edge ↔ State Synergy — Offline-First & Optimistic Updates

## Status
**Draft** — Architectural pattern for maintaining system coherence during connectivity loss

## Context

### The Offline Problem
In a distributed streaming pipeline, network partitions are inevitable. When connectivity breaks between edge (S2) and cloud, or between client (S8) and backend, the system must degrade gracefully rather than fail catastrophically.

**Critical scenarios:**
1. ESP32 edge device loses WiFi connectivity
2. Client browser loses WebSocket connection to backend
3. Backend NATS connection drops temporarily
4. Extended offline periods (minutes to hours)

### User Experience Requirements
Users expect the system to:
- Continue displaying last-known data during outages
- Clearly indicate staleness/offline state
- Recover automatically on reconnection
- Avoid data loss or surprising state changes

### System Boundaries
- **Edge (S2)**: ESP32 devices streaming sensor data via NATS
- **Client (S8)**: React application consuming streams via SSE
- **Intermediate layers**: NATS message bus, stream services

---

## Decision

### 1. Offline Detection

#### Edge Layer (S2)
**NATS Connection Health Monitoring**
```rust
// ESP32 NATS client maintains connection state
pub struct ConnectionHealth {
    last_ack: SystemTime,
    heartbeat_interval: Duration, // 5 seconds
    timeout_threshold: Duration,  // 15 seconds
    state: ConnectionState,
}

pub enum ConnectionState {
    Online,
    Degraded,      // ACKs delayed but within threshold
    Offline,       // No ACK beyond threshold
    Reconnecting,  // Active retry in progress
}
```

**Detection logic:**
- Send heartbeat PING every 5 seconds
- Expect PONG within 15 seconds
- Transition to `Offline` after 3 consecutive failures
- Enter `Reconnecting` with exponential backoff (1s, 2s, 4s, 8s, max 30s)

#### Client Layer (S8)
**WebSocket/SSE Connection State**
```typescript
// Connection health atom
export const connectionStateAtom = Atom.make<ConnectionState>({
  status: 'online',
  lastSeen: Date.now(),
  missedHeartbeats: 0,
})

export const ConnectionState = Schema.Struct({
  status: Schema.Literal('online', 'offline', 'reconnecting'),
  lastSeen: Schema.Number, // timestamp
  missedHeartbeats: Schema.Number,
})
```

**Detection logic:**
- SSE server sends heartbeat every 10 seconds
- Client expects heartbeat within 30 seconds
- After 2 missed heartbeats (60s), transition to `offline`
- `EventSource` reconnection handled automatically by browser

#### Unified Health Atom
```typescript
// Aggregates edge + client connection state
export const systemHealthAtom = Atom.make<SystemHealth>({
  edge: 'unknown',
  client: 'online',
  overall: 'degraded',
})

export const deriveOverallHealth = (
  edge: ConnectionState,
  client: ConnectionState
): 'online' | 'degraded' | 'offline' => {
  if (edge === 'offline' || client === 'offline') return 'offline'
  if (edge === 'degraded' || client === 'degraded') return 'degraded'
  return 'online'
}
```

---

### 2. Local-First State

#### Edge Buffer (S2)
**SQLite Persistence During Offline**
```rust
// Edge maintains rolling buffer of last 10,000 readings
pub struct EdgeBuffer {
    db: SqliteConnection,
    max_entries: usize,
    retention_policy: RetentionPolicy,
}

impl EdgeBuffer {
    pub async fn append(&mut self, reading: SensorReading) -> Result<(), BufferError> {
        // Write to SQLite
        sqlx::query!(
            "INSERT INTO sensor_buffer (timestamp, value, sequence) VALUES (?, ?, ?)",
            reading.timestamp,
            reading.value,
            reading.sequence
        )
        .execute(&mut self.db)
        .await?;

        // Enforce retention
        self.prune_old_entries().await?;
        Ok(())
    }

    pub async fn get_unsynced(&self) -> Result<Vec<SensorReading>, BufferError> {
        sqlx::query_as!(
            SensorReading,
            "SELECT * FROM sensor_buffer WHERE synced = FALSE ORDER BY sequence ASC"
        )
        .fetch_all(&mut self.db)
        .await
    }
}
```

**Retention policy:**
- Keep last 10,000 readings (≈17 hours at 1 reading/6s)
- FIFO eviction when buffer full
- Mark entries as `synced` after successful NATS publish
- Prune synced entries older than 1 hour

#### Client State (S8)
**Last-Known-Good in Atoms**
```typescript
// Client maintains historical window
export const sensorDataAtom = Atom.make<SensorData[]>([])
export const lastKnownGoodAtom = Atom.make<LastKnownGood>({
  timestamp: Date.now(),
  value: null,
  staleness: 'fresh',
})

export const Staleness = Schema.Literal('fresh', 'stale', 'offline')

// Staleness classification
const classifyStaleness = (lastSeen: number): Staleness => {
  const age = Date.now() - lastSeen
  if (age < 60_000) return 'fresh'   // < 1 minute
  if (age < 300_000) return 'stale'  // < 5 minutes
  return 'offline'                   // >= 5 minutes
}
```

**Independent functionality:**
- Client can render charts/tables from buffered data
- All UI controls remain functional
- Historical data browsable
- Computation/aggregation operates on stale data

---

### 3. Optimistic Updates

#### Stale Data Indicators
```typescript
// Visual indicators for staleness
export const OfflineIndicator = Schema.Struct({
  lastSeen: Schema.Number,
  staleness: Staleness,
  estimatedValue: Schema.optional(Schema.Number), // extrapolated
})

// UI rendering
const SensorValue: React.FC<{ value: number, offline: OfflineIndicator }> = ({ value, offline }) => {
  return (
    <div className={cn('sensor-value', offline.staleness)}>
      <span className="value">{value.toFixed(2)}</span>
      {offline.staleness !== 'fresh' && (
        <Badge variant="warning">
          {offline.staleness === 'stale' ? 'Stale' : 'Offline'}
          <span className="age">{formatAge(offline.lastSeen)}</span>
        </Badge>
      )}
    </div>
  )
}
```

#### Trend-Based Extrapolation
```typescript
// Predict next value based on recent trend
export const extrapolateValue = (
  history: SensorReading[],
  targetTime: number
): number | null => {
  if (history.length < 3) return null

  // Linear regression on last 10 points
  const recent = history.slice(-10)
  const slope = calculateSlope(recent)
  const lastValue = recent[recent.length - 1].value
  const timeDelta = targetTime - recent[recent.length - 1].timestamp

  return lastValue + (slope * timeDelta)
}
```

**Extrapolation policy:**
- Only extrapolate if trend is stable (R² > 0.8)
- Show predicted value with dashed line on charts
- Label clearly as "Estimated (offline)"
- Stop extrapolating after 5 minutes offline

#### Conflict Resolution
**Last-Write-Wins on Reconnect**
```typescript
// On reconnect, server stream replaces client predictions
export const handleReconnect = runtimeAtom.fn()((_, ctx) =>
  Effect.gen(function* () {
    // Clear predictions
    ctx.set(lastKnownGoodAtom, (prev) => ({
      ...prev,
      estimatedValue: undefined,
    }))

    // Server stream will overwrite atoms
    yield* resumeStream()

    // Mark as online
    ctx.set(connectionStateAtom, {
      status: 'online',
      lastSeen: Date.now(),
      missedHeartbeats: 0,
    })
  })
)
```

**No complex CRDT needed:**
- Sensor data is append-only (no user edits)
- Edge device is source of truth
- Client always defers to server on reconnect

---

### 4. Sync Protocol

#### Edge Replay on Reconnect
```rust
// Replay buffered data when NATS reconnects
impl EdgeDevice {
    pub async fn on_reconnect(&mut self) -> Result<(), SyncError> {
        log::info!("NATS reconnected, replaying buffer");

        let unsynced = self.buffer.get_unsynced().await?;
        log::info!("Replaying {} buffered readings", unsynced.len());

        for reading in unsynced {
            // Publish with original sequence number
            self.nats_client
                .publish(
                    &format!("sensor.{}", self.device_id),
                    serde_json::to_vec(&reading)?
                )
                .await?;

            // Mark as synced
            self.buffer.mark_synced(reading.sequence).await?;
        }

        Ok(())
    }
}
```

**Replay characteristics:**
- Preserves original timestamps (not replay time)
- Maintains sequence order
- Rate-limited to avoid overwhelming NATS (100 msg/sec)
- Idempotent (duplicate detection downstream)

#### Client Catch-Up Stream
```typescript
// Client receives catch-up on SSE reconnect
export const handleCatchUp = runtimeAtom.fn()((_, ctx) =>
  Effect.gen(function* () {
    const lastSeq = yield* getLastSequenceNumber()

    // Server sends catch-up since last seen sequence
    const catchUpUrl = `/api/sensor/catch-up?since=${lastSeq}`
    const stream = yield* connectSSE(catchUpUrl)

    yield* Stream.runForEach(stream, (reading) =>
      Effect.sync(() => {
        ctx.set(sensorDataAtom, (prev) => [...prev, reading])
        ctx.set(lastKnownGoodAtom, {
          timestamp: reading.timestamp,
          value: reading.value,
          staleness: 'fresh',
        })
      })
    )
  })
)
```

#### Sequence-Based Deduplication
```typescript
// Prevent duplicate processing of replayed messages
export const seenSequencesAtom = Atom.make<Set<number>>(new Set())

export const deduplicateReading = (reading: SensorReading, ctx: Atom.Ctx) => {
  const seen = ctx.get(seenSequencesAtom)

  if (seen.has(reading.sequence)) {
    // Already processed, skip
    return false
  }

  // Mark as seen
  ctx.set(seenSequencesAtom, new Set([...seen, reading.sequence]))

  // Prune old sequences (keep last 10k)
  if (seen.size > 10_000) {
    const sorted = Array.from(seen).sort((a, b) => a - b)
    const pruned = new Set(sorted.slice(-10_000))
    ctx.set(seenSequencesAtom, pruned)
  }

  return true
}
```

---

## Consequences

### Positive
1. **Graceful Degradation**: System remains functional during outages
2. **Zero Data Loss**: Edge buffers ensure all sensor readings eventually propagate
3. **User Clarity**: Offline indicators prevent confusion about stale data
4. **Automatic Recovery**: No manual intervention required on reconnection
5. **Predictable Behavior**: Last-write-wins is simple to reason about

### Negative
1. **Storage Overhead**: SQLite buffer on edge devices consumes flash
2. **Replay Latency**: Large buffers take time to sync on reconnect
3. **Stale UI**: Users see outdated data during offline periods
4. **Extrapolation Error**: Trend predictions may be wildly wrong

### Mitigations
- **Storage**: Configurable retention policy, compress old entries
- **Replay**: Chunk replay into batches, show progress indicator
- **Stale UI**: Clear visual indicators, disable actions requiring fresh data
- **Extrapolation**: Conservative thresholds, clearly labeled predictions

---

## Implementation Notes

### Phase 1: Detection (Completed)
- ✅ NATS health monitoring in ESP32
- ✅ SSE heartbeat in client
- ✅ `connectionStateAtom` with staleness logic

### Phase 2: Buffering (In Progress)
- 🚧 SQLite buffer on ESP32
- 🚧 Retention policy enforcement
- ⏳ Client historical window

### Phase 3: Sync Protocol (Planned)
- ⏳ Edge replay logic
- ⏳ Server catch-up endpoint
- ⏳ Sequence-based deduplication

### Phase 4: UX Polish (Planned)
- ⏳ Offline indicators in UI
- ⏳ Trend extrapolation (optional)
- ⏳ Reconnection progress feedback

---

## References

- ADR-S2: Edge buffer SQLite schema
- ADR-S8: Client state atom patterns
- [Offline-First Design Principles](https://offlinefirst.org/)
- [NATS JetStream: Reliable Messaging](https://docs.nats.io/nats-concepts/jetstream)
- Effect-TS Stream backpressure: `submodules/effect/packages/effect/src/Stream.ts`

---

## Revision History

| Date | Author | Changes |
|------|--------|---------|
| 2026-01-02 | Val | Initial draft |
