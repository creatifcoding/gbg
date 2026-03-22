---
id: S4-S5
title: "Ingestion → Storage Integration — Schema-to-Model & Persistence Patterns"
commitHash: "6656064"
status: draft
date: "2026-01-02"
tier: pair-adjacent
stages:
  - S4
  - S5
---

# ADR-S4-S5: Ingestion → Storage Integration

**ID**: S4-S5
**Commit Hash**: 6656064
**Status**: draft
**Date**: 2026-01-02
**Tier**: pair-adjacent

## Context

### Stages Covered
- S4 (Ingestion) — Effect.Service validation/transformation layer
- S5 (Storage) — Dual-write persistence (NATS KV + SQLite)

### Problem

The ingestion service (S4) validates and normalizes sensor readings from NATS JetStream. These validated readings must be persisted reliably with the following requirements:

1. **Hot data access** — Latest sensor values accessible via low-latency KV lookup (NATS KV)
2. **Historical queries** — Time-series analysis requires efficient range queries (SQLite)
3. **Schema-to-model transformation** — SenML input schema → normalized SensorReading model
4. **Transaction semantics** — Dual-write to KV + SQLite must handle partial failures gracefully
5. **Retention management** — Automatic pruning of old data without manual intervention
6. **Idempotent writes** — Duplicate sensor readings (retries, replays) must not corrupt storage state

**Core question**: How do validated sensor readings transition from transient Effect.Stream processing to durable storage with minimal latency, guaranteed persistence, and efficient queryability?

### Constraints

- **NATS KV already configured** — WebSocket transport on port 9222 (see `docker/nats/nats-server.conf`)
- **SQLite preferred for time-series** — Embedded database, no external dependency, column-oriented via JSON1 extension
- **Effect Schema mandatory** — All persistence models must use Effect Schema for validation
- **Dual-write required** — Both KV (hot) and SQLite (cold) must receive every reading
- **Effect.Stream integration** — Storage operations must integrate cleanly with Stream.tap patterns
- **Repository pattern preferred** — Encapsulate SQL operations behind Effect.Service interface

### Assumptions

- Single TMNL instance (no distributed coordination required)
- SQLite file on local disk (low-latency writes, ~1ms)
- NATS KV operations over WebSocket (~2-5ms latency)
- Write throughput: 10k readings/sec peak (100k readings/day steady-state)
- Retention policy: 30 days historical data (SQLite), latest value only (KV)
- Query patterns: 90% latest-value lookups (KV), 10% time-range queries (SQLite)
- Storage growth: ~10MB/day for 256 sensors @ 10Hz with 30-day retention = 300MB total

## Decision

### Summary

Implement **dual-write persistence with transaction boundaries** where each validated `SensorReading` from S4 (Ingestion) writes to **SQLite first** (for durability), then **NATS KV second** (for low-latency access). Use **Effect Schema transforms** to map SenML input → normalized model with metadata enrichment (ingest timestamp, source tracking). Encapsulate storage operations behind a **repository interface** (`SensorStorageService`) using Effect's native async primitives. Apply **automatic retention policies** via SQLite triggers and NATS KV history limits.

### Technologies

| Technology | Version | Purpose | File Reference |
|------------|---------|---------|----------------|
| SQLite | 3.45+ | Time-series persistence, range queries | TBD: `/src/lib/sensor-storage/repositories/` |
| NATS KV | 2.x | Latest-value cache, hot data | `/src/lib/nats/NatsKVService.ts` (reuse) |
| Effect Schema | latest | Model validation, transforms | TMNL standard |
| Effect.Service | latest | Repository abstraction | TMNL standard |

### Patterns

#### 1. Schema-to-Model Transformation

**SenML Input → SensorReading Model** (with metadata enrichment):

```typescript
// Input: SenMLRecord from S4 (Ingestion)
class SenMLRecord extends Schema.Class<SenMLRecord>('SenMLRecord')({
  bn: Schema.optional(Schema.String),  // base name (e.g., "sensors.zone1.")
  n: Schema.optional(Schema.String),   // name (e.g., "temp-42")
  v: Schema.optional(Schema.Number),   // value
  u: Schema.optional(Schema.String),   // unit (e.g., "Cel")
  t: Schema.optional(Schema.Number),   // time offset from bt
  bt: Schema.optional(Schema.Number),  // base time (Unix epoch)
}) {}

// Output: Normalized SensorReading model (S5 storage entity)
class SensorReading extends Schema.TaggedClass<SensorReading>()(
  'SensorReading',
  {
    // Primary identifiers (from SenML bn+n)
    sensorId: Schema.String.pipe(Schema.brand('SensorId')),
    zone: Schema.String,                    // Extracted from subject hierarchy
    measurement: Schema.String,             // e.g., "temperature", "humidity"

    // Data payload
    value: Schema.Number,
    unit: Schema.optional(Schema.String),   // e.g., "Cel", "%"

    // Temporal data
    timestamp: Schema.DateFromSelf,         // Sensor reading time (bt+t)
    ingestTimestamp: Schema.DateFromSelf,   // When ingestion received it

    // Metadata (enrichment)
    source: Schema.String,                  // NATS subject (e.g., "sensors.zone1.temp-42")
    sequenceNumber: Schema.Number,          // NATS message sequence (idempotency)
  }
) {}
```

**Transformation Logic** (Effect Schema transforms):

```typescript
// SenML base expansion + metadata enrichment
const transformSenMLToReading = (
  record: SenMLRecord,
  source: string,      // NATS subject
  seqNum: number       // NATS sequence
): Effect.Effect<SensorReading, TransformError> =>
  Effect.gen(function* () {
    // Extract zone from subject (e.g., "sensors.zone1.temp-42" → "zone1")
    const zone = extractZoneFromSubject(source);

    // Combine base name + name for full sensor ID
    const sensorId = (record.bn ?? '') + (record.n ?? '');
    if (!sensorId) {
      yield* Effect.fail(new TransformError('Missing sensor ID'));
    }

    // Combine base time + time offset
    const timestamp = new Date((record.bt ?? 0) + (record.t ?? 0));

    // Extract measurement type from sensor ID
    const measurement = extractMeasurement(sensorId); // "temp-42" → "temperature"

    return {
      _tag: 'SensorReading' as const,
      sensorId: sensorId as Schema.brand<'SensorId'>,
      zone,
      measurement,
      value: record.v ?? 0,
      unit: record.u,
      timestamp,
      ingestTimestamp: new Date(),
      source,
      sequenceNumber: seqNum,
    };
  });
```

#### 2. Dual-Write Strategy

**Transaction Semantics** (SQLite → NATS KV order):

```typescript
export const writeSensorReading = (reading: SensorReading) =>
  Effect.gen(function* () {
    // Step 1: Write to SQLite (durable storage, transaction boundary)
    // If this fails, entire operation fails (no KV write)
    yield* Effect.tryPromise({
      try: () => db.run(
        `INSERT INTO sensor_readings
         (sensor_id, zone, measurement, value, unit, timestamp, ingest_ts, source, seq)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          reading.sensorId,
          reading.zone,
          reading.measurement,
          reading.value,
          reading.unit,
          reading.timestamp.getTime(),
          reading.ingestTimestamp.getTime(),
          reading.source,
          reading.sequenceNumber,
        ]
      ),
      catch: (e) => new SQLiteWriteError(`Failed to write to SQLite: ${e}`)
    });

    // Step 2: Write to NATS KV (hot cache, idempotent)
    // KV writes are idempotent (latest value wins), safe to retry
    const kvKey = `sensor.${reading.zone}.${reading.sensorId}`;
    const kvValue = JSON.stringify({
      value: reading.value,
      unit: reading.unit,
      timestamp: reading.timestamp.toISOString(),
      source: reading.source,
    });

    yield* NatsKVService.put(kvKey, kvValue);

    return reading;
  });
```

**Rationale for SQLite-first**:
- SQLite writes are transactional (ACID guarantees)
- NATS KV writes are idempotent (latest value supersedes)
- If SQLite succeeds but KV fails, retry is safe (idempotent)
- If SQLite fails, KV is never written (no orphaned hot data)

**Failure Recovery**:
```typescript
const writeSensorReadingWithRetry = (reading: SensorReading) =>
  writeSensorReading(reading).pipe(
    Effect.retry({
      schedule: Schedule.exponential('100 millis').pipe(
        Schedule.compose(Schedule.recurs(3)) // Max 3 retries
      ),
      while: isTransientError, // Retry only on network/timeout errors
    }),
    Effect.catchAll((error) =>
      Effect.gen(function* () {
        // Permanent failure → log + propagate (will trigger NATS nak/DLQ)
        yield* Effect.logError(`Storage write failed permanently: ${error}`);
        yield* Effect.fail(error);
      })
    )
  );
```

#### 3. Repository Pattern

**SensorStorageService** (Effect.Service facade):

```typescript
export class SensorStorageService extends Effect.Service<SensorStorageService>()(
  'SensorStorageService',
  {
    effect: Effect.gen(function* () {
      const natsKV = yield* NatsKVService;

      // SQLite connection (via Effect-native async wrapper)
      const db = yield* Effect.tryPromise({
        try: () => openDatabase('./data/sensors.db'),
        catch: (e) => new DatabaseOpenError(`Failed to open SQLite: ${e}`)
      });

      return {
        // Write single reading (dual-write)
        write: (reading: SensorReading) =>
          writeSensorReadingWithRetry(reading),

        // Get latest value from KV (hot path)
        getLatest: (sensorId: string) =>
          Effect.gen(function* () {
            const kvKey = `sensor.*.${sensorId}`; // Zone wildcard
            const value = yield* natsKV.get(kvKey);
            return value ? JSON.parse(value) : null;
          }),

        // Get time-range history from SQLite (cold path)
        getHistory: (sensorId: string, startTime: Date, endTime: Date) =>
          Effect.gen(function* () {
            const rows = yield* Effect.tryPromise({
              try: () => db.all(
                `SELECT * FROM sensor_readings
                 WHERE sensor_id = ?
                   AND timestamp >= ?
                   AND timestamp <= ?
                 ORDER BY timestamp ASC`,
                [sensorId, startTime.getTime(), endTime.getTime()]
              ),
              catch: (e) => new SQLiteQueryError(`Query failed: ${e}`)
            });

            return rows.map(rowToSensorReading);
          }),

        // Get all latest values for a zone (KV scan)
        getZoneLatest: (zone: string) =>
          Effect.gen(function* () {
            const kvPrefix = `sensor.${zone}.`;
            const entries = yield* natsKV.keys(kvPrefix);

            return yield* Effect.forEach(entries, (key) =>
              natsKV.get(key).pipe(
                Effect.map((value) => ({ key, value: JSON.parse(value!) }))
              )
            );
          }),
      };
    }),
  }
) {}
```

**Repository Interface Summary**:

| Method | Data Source | Latency | Use Case |
|--------|-------------|---------|----------|
| `write(reading)` | SQLite + KV | ~3-5ms | Ingestion pipeline |
| `getLatest(sensorId)` | NATS KV | ~2ms | Dashboard widgets, current state |
| `getHistory(sensorId, range)` | SQLite | ~10-50ms | Time-series charts, analysis |
| `getZoneLatest(zone)` | NATS KV | ~5-20ms | Zone overview, heatmaps |

#### 4. Retention & Compaction

**SQLite Retention** (30-day rolling window):

```sql
-- Auto-delete trigger (runs after each insert)
CREATE TRIGGER IF NOT EXISTS cleanup_old_readings
AFTER INSERT ON sensor_readings
BEGIN
  DELETE FROM sensor_readings
  WHERE timestamp < (strftime('%s', 'now') - 2592000) * 1000; -- 30 days in ms
END;

-- Periodic VACUUM for disk reclamation (via cron/scheduled Effect)
-- Run weekly to reclaim space from deleted rows
```

**Effect-based Compaction Job**:

```typescript
export const runCompactionJob = Effect.gen(function* () {
  const db = yield* SensorStorageService;

  // Delete old records (explicit query, backup to trigger)
  yield* Effect.tryPromise({
    try: () => db.run(
      `DELETE FROM sensor_readings
       WHERE timestamp < ?`,
      [Date.now() - 30 * 24 * 60 * 60 * 1000] // 30 days
    ),
    catch: (e) => new CompactionError(`Cleanup failed: ${e}`)
  });

  // Vacuum to reclaim disk space
  yield* Effect.tryPromise({
    try: () => db.run('VACUUM'),
    catch: (e) => new CompactionError(`Vacuum failed: ${e}`)
  });

  yield* Effect.logInfo('Compaction completed');
}).pipe(
  // Run weekly (Effect.Schedule pattern)
  Effect.repeat(Schedule.spaced('7 days')),
  Effect.forkDaemon // Background fiber
);
```

**NATS KV Retention** (latest value only, automatic):

- KV bucket config: `history: 1` (only latest revision stored)
- Automatic supersede: New writes replace old values (no manual cleanup)
- No compaction needed: KV handles storage reclamation internally

### Interfaces

| Interface | From | To | Protocol | Schema |
|-----------|------|-----|----------|--------|
| SensorReading (input) | S4 | S5 | Effect.Stream | `SensorReading` (Effect Schema) |
| SQLite Row | S5 | SQLite | SQL | `(sensor_id TEXT, zone TEXT, value REAL, timestamp INTEGER, ...)` |
| KV Entry | S5 | NATS KV | KV.put | `{ key: "sensor.zone1.temp-42", value: JSON }` |
| Latest Value (output) | S5 | Consumers | Effect | `{ value: number, unit: string, timestamp: Date }` |
| History Range (output) | S5 | Consumers | Effect | `SensorReading[]` |

**SQLite Schema**:

```sql
CREATE TABLE IF NOT EXISTS sensor_readings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sensor_id TEXT NOT NULL,
  zone TEXT NOT NULL,
  measurement TEXT NOT NULL,
  value REAL NOT NULL,
  unit TEXT,
  timestamp INTEGER NOT NULL,      -- Unix epoch ms (sensor time)
  ingest_ts INTEGER NOT NULL,      -- Unix epoch ms (ingestion time)
  source TEXT NOT NULL,            -- NATS subject
  seq INTEGER NOT NULL,            -- NATS sequence (idempotency check)

  -- Indexes for common queries
  UNIQUE(source, seq),             -- Prevent duplicate writes (idempotency)
  INDEX idx_sensor_time ON sensor_readings(sensor_id, timestamp),
  INDEX idx_zone_time ON sensor_readings(zone, timestamp)
);
```

**NATS KV Bucket Config**:

```bash
# Create KV bucket for sensor latest values
nats kv add SENSOR_LATEST \
  --history 1 \
  --ttl 0 \
  --replicas 1 \
  --storage file
```

## Rationale

### Alternatives Considered

1. **Single Storage (SQLite only)**
   - **Pros**: Simpler architecture, no dual-write complexity, single source of truth
   - **Cons**: Slow latest-value queries (requires `ORDER BY timestamp DESC LIMIT 1` per sensor), no hot cache
   - **Rejected**: Dashboard widgets need <5ms latency; SQLite queries ~20-50ms for latest value

2. **Single Storage (NATS KV only)**
   - **Pros**: Fast latest-value access, simple writes, distributed-ready
   - **Cons**: No time-range queries, limited history (KV not designed for time-series), expensive range scans
   - **Rejected**: Historical analysis is core requirement; KV lacks time-series indexing

3. **KV-first Dual-Write**
   - **Pros**: Optimizes hot path (KV write faster than SQLite)
   - **Cons**: SQLite failure leaves orphaned KV data, harder to reconcile
   - **Rejected**: SQLite durability is critical; KV is expendable (can rebuild from SQLite)

4. **Eventual Consistency (async KV sync)**
   - **Pros**: Decouples SQLite + KV writes, faster ingestion throughput
   - **Cons**: KV lag during high load, complex reconciliation, stale reads
   - **Rejected**: MVP prefers simple consistency model; async sync deferred to optimization phase

5. **TimescaleDB / InfluxDB**
   - **Pros**: Purpose-built time-series databases, advanced compression, clustering
   - **Cons**: External dependency, operational overhead, overkill for 256 sensors
   - **Rejected**: SQLite + JSON1 extension handles MVP scale; defer to Phase 2 if >10k sensors

### Tradeoffs

| Gain | Cost |
|------|------|
| **Hot/cold separation** — KV for latest, SQLite for history | Dual-write complexity — Must handle partial failures |
| **Idempotent writes** — UNIQUE(source, seq) prevents duplicates | Storage overhead — Sequence numbers in every row (~8 bytes) |
| **Automatic retention** — SQLite trigger deletes old data | CPU overhead — Trigger runs on every insert (~0.1ms penalty) |
| **Embedded storage** — SQLite requires no external service | Single-node limit — No horizontal scaling (acceptable for MVP) |
| **Schema validation** — Effect Schema catches invalid data | Runtime overhead — Validation adds ~0.2ms per write |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Dual-write divergence** — KV and SQLite out of sync | Low | Medium | SQLite-first order ensures KV can be rebuilt; periodic reconciliation job compares counts |
| **SQLite lock contention** — High write concurrency blocks reads | Medium | Medium | WAL mode (write-ahead logging) allows concurrent readers; consider read replica if needed |
| **KV WebSocket instability** — Reconnection drops writes | Low | Low | Effect retry logic with exponential backoff; KV idempotency makes retries safe |
| **Disk space exhaustion** — 30-day retention grows unbounded | Low | High | Monitor disk usage; alert at 80% full; compaction job reclaims space weekly |
| **Sequence number collisions** — Duplicate seq in NATS replay | Very Low | Low | UNIQUE constraint rejects duplicates; logged as idempotency hit (expected behavior) |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `/src/lib/sensor-storage/SensorStorageService.ts` | create | Effect.Service repository facade (write, getLatest, getHistory) |
| `/src/lib/sensor-storage/schemas.ts` | create | SensorReading model, SQLite row transforms |
| `/src/lib/sensor-storage/repositories/SQLiteRepository.ts` | create | SQLite operations (insert, query, vacuum) |
| `/src/lib/sensor-storage/repositories/KVRepository.ts` | create | NATS KV operations (put, get, keys) wrapping NatsKVService |
| `/src/lib/sensor-storage/transforms.ts` | create | SenMLRecord → SensorReading transformation logic |
| `/src/lib/sensor-storage/compaction.ts` | create | Retention policy enforcement, VACUUM scheduling |
| `/src/lib/sensor-storage/layer.ts` | create | Layer composition: NatsKVService + SQLite deps |
| `/scripts/init-sensor-db.ts` | create | SQLite schema initialization script |
| `/scripts/compaction-daemon.ts` | create | Background compaction job (systemd service) |

### Dependencies

```json
{
  "better-sqlite3": "^11.0.0",  // Synchronous SQLite driver (fast, Effect-compatible)
  "@effect/schema": "latest",   // Already installed
  "effect": "latest"             // Already installed
}
```

**NATS KV**: Reuse existing `NatsKVService` (no new dependency)

### Migrations

**SQLite Schema Migration** (idempotent, runs on startup):

```typescript
// /scripts/init-sensor-db.ts
import Database from 'better-sqlite3';

export const initializeSensorDatabase = (dbPath: string) => {
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sensor_id TEXT NOT NULL,
      zone TEXT NOT NULL,
      measurement TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT,
      timestamp INTEGER NOT NULL,
      ingest_ts INTEGER NOT NULL,
      source TEXT NOT NULL,
      seq INTEGER NOT NULL,

      UNIQUE(source, seq)
    );

    CREATE INDEX IF NOT EXISTS idx_sensor_time
      ON sensor_readings(sensor_id, timestamp);

    CREATE INDEX IF NOT EXISTS idx_zone_time
      ON sensor_readings(zone, timestamp);

    CREATE TRIGGER IF NOT EXISTS cleanup_old_readings
    AFTER INSERT ON sensor_readings
    BEGIN
      DELETE FROM sensor_readings
      WHERE timestamp < (strftime('%s', 'now') - 2592000) * 1000;
    END;

    PRAGMA journal_mode = WAL;  -- Enable write-ahead logging
    PRAGMA synchronous = NORMAL; -- Balance safety vs performance
  `);

  db.close();
};
```

**NATS KV Bucket Creation** (via NATS CLI or NatsKVService wrapper):

```bash
# Run once during deployment
nats kv add SENSOR_LATEST \
  --history 1 \
  --ttl 0 \
  --replicas 1 \
  --storage file \
  --description "Latest sensor values (hot cache)"
```

### Test Strategy

**Unit Tests** (`@effect/vitest`):

1. **Schema Transformation**:
   - Input: SenMLRecord with bn="sensors.zone1.", n="temp-42", v=23.5
   - Output: SensorReading with sensorId="sensors.zone1.temp-42", zone="zone1"
   - Assert: Metadata enrichment (ingestTimestamp, source, sequenceNumber)

2. **Dual-Write Success**:
   - Mock: SQLite insert succeeds, KV put succeeds
   - Assert: Both repositories called, reading returned

3. **Dual-Write Partial Failure**:
   - Mock: SQLite insert succeeds, KV put fails (network timeout)
   - Assert: Effect retries KV write, eventually succeeds

4. **Idempotency**:
   - Input: Write same reading twice (same source + seq)
   - Assert: Second write fails with UNIQUE constraint violation (SQLite)
   - Assert: KV accepts duplicate (idempotent supersede)

5. **Retention Trigger**:
   - Insert reading with timestamp 31 days old
   - Assert: Trigger deletes old reading immediately

**Integration Tests** (Docker Compose + NATS + SQLite):

1. **End-to-End Persistence**:
   - Publish SensorReading to S4 (Ingestion)
   - Assert: Reading appears in SQLite
   - Assert: Latest value in NATS KV
   - Assert: getLatest() returns correct value
   - Assert: getHistory(1 hour) includes reading

2. **Concurrent Writes**:
   - Write 1000 readings in parallel (10 concurrent fibers)
   - Assert: All 1000 rows in SQLite (no duplicates via UNIQUE constraint)
   - Assert: All KV entries present

3. **Retention Cleanup**:
   - Insert 100 readings with timestamps spanning 35 days
   - Wait for trigger execution
   - Assert: Only readings <30 days old remain
   - Run compaction job
   - Assert: Disk space reclaimed (VACUUM)

4. **Recovery from KV Failure**:
   - Stop NATS server
   - Attempt to write reading
   - Assert: SQLite write succeeds, KV write retries
   - Restart NATS server
   - Assert: KV write eventually succeeds (retry logic)

**Load Tests** (optional, deferred):
- Sustained 10k writes/sec for 10 minutes
- Measure: SQLite write latency P95, KV write latency P95, dual-write success rate
- Target: P95 <10ms, success rate >99.9%

## Metadata

### Related ADRs
- **ADR-S4** (Ingestion Layer) — SensorReading schema, validation logic
- **ADR-S3-S4** (Transport-Ingestion integration) — NATS message processing, ack semantics
- **ADR-S5** (Storage Layer) — Internal storage architecture decisions
- **ADR-S5-S6** (Storage-Query integration) — Time-series query patterns, aggregation

### Open Questions

1. **Schema evolution** — How to handle SensorReading schema changes without breaking existing SQLite data?
   - Option A: SQLite schema migrations (ALTER TABLE)
   - Option B: Schema versioning with separate tables (sensor_readings_v1, sensor_readings_v2)
   - Option C: JSON column for flexible schema (trade query performance for flexibility)

2. **Read scaling** — If SQLite read queries become bottleneck (>50ms P95), what's the migration path?
   - Option A: SQLite read replicas (rsync + read-only DBs)
   - Option B: Migrate to TimescaleDB / InfluxDB
   - Option C: Materialized views in SQLite for common aggregations

3. **Multi-zone isolation** — Should each zone have a separate SQLite database?
   - Pros: Zone isolation, smaller database files, easier sharding
   - Cons: Cross-zone queries require joining multiple DBs, complexity

4. **KV bucket granularity** — Single bucket vs per-zone buckets?
   - Single bucket: Simpler, but harder to apply per-zone retention policies
   - Per-zone buckets: Better isolation, but more configuration overhead

5. **Compaction frequency** — Weekly VACUUM sufficient, or should it be dynamic based on disk usage?
   - Weekly: Simpler, predictable
   - Dynamic: More efficient, but requires monitoring + orchestration

6. **Duplicate handling** — Should UNIQUE(source, seq) constraint silently ignore duplicates or log warnings?
   - Silently ignore: Cleaner logs
   - Log warnings: Better observability for debugging replay issues

### References

- NATS KV documentation: https://docs.nats.io/nats-concepts/jetstream/key-value-store
- SQLite Write-Ahead Logging: https://www.sqlite.org/wal.html
- SQLite JSON1 extension: https://www.sqlite.org/json1.html
- Effect Schema: `../../submodules/website/content/docs/schema/`
- TMNL NatsKVService: `/src/lib/nats/NatsKVService.ts`
- better-sqlite3 docs: https://github.com/WiseLibs/better-sqlite3
- SenML RFC 8428: https://datatracker.ietf.org/doc/html/rfc8428
