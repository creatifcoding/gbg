---
id: "S5"
title: "Storage Layer — Dual-Write (NATS KV + SQLite)"
commitHash: "6656064"
status: "draft"
date: "2026-01-02"
tier: "isolated"
stages: ["S5"]
---

# ADR-S5: Storage Layer

## Context

### Stages Covered
- S5 (Storage)

### Problem

Validated sensor data from the ingestion layer (S4) requires dual-mode persistence that:

1. **Provides instant access to latest state** — Clients need current sensor readings without querying historical data
2. **Enables historical queries** — Analytics require time-series queries (last 24h, avg per hour, anomaly detection)
3. **Supports high write throughput** — Thousands of sensors × 1Hz update rate = 1000+ writes/sec sustained
4. **Survives process restarts** — Both current state and history must persist across TMNL app crashes
5. **Enables reactive UIs** — Browser clients must receive live updates when sensors change (no polling)
6. **Scales with data growth** — Historical data grows unbounded; retention policies must prevent disk exhaustion

The storage layer is the **system of record** for sensor telemetry — data loss here cannot be recovered.

### Constraints

- **NATS KV already available** — TMNL's NatsKVService provides Schema-validated key-value storage with watch streams
- **SQLite already embedded** — `@effect/sql-sqlite-bun` used in editor persistence (`/src/lib/editor/v3/persistence/`)
- **XDG compliance required** — Database files must respect `~/.local/share/tmnl/` convention
- **Effect-TS patterns mandatory** — Model.makeRepository, Schema transforms, Layer composition
- **WAL mode required** — SQLite journal mode must support concurrent reads (UI queries) during writes (ingestion)
- **No external databases in MVP** — PostgreSQL/ClickHouse deferred to production scaling

### Assumptions

- Single TMNL instance (no distributed writes to SQLite)
- Sensor update frequency ≤10Hz (higher rates require downsampling in S4)
- Retention policy of 30 days is sufficient for MVP analytics
- KV bucket size <1GB (NATS JetStream memory limits)
- Query patterns are known: recent history (last 24h), aggregates (hourly/daily), anomaly detection

## Decision

### Summary

Use **NATS KV for latest sensor state** (fast reads, reactive watch streams) and **SQLite with WAL mode for historical time-series data** (efficient range queries, bounded retention). Dual-write pattern ensures eventual consistency; SQLite is source of truth for history, KV is source of truth for current state.

### Technologies

| Technology | Version | Purpose | File Reference |
|------------|---------|---------|----------------|
| NATS KV | 2.x | Latest state (hot path) | `/src/lib/nats/NatsKVService.ts` |
| SQLite (WAL) | 3.x | Historical data (cold path) | `/src/lib/durable-streams/server/persistence.ts` |
| @effect/sql | latest | SQL client abstraction | `/src/lib/editor/v3/persistence/repositories.ts` |
| @effect/sql-sqlite-bun | latest | Bun SQLite driver | `/src/lib/editor/v3/persistence/layer.ts` |
| Effect Schema | latest | Type-safe transforms | `/src/lib/editor/v3/persistence/sqlite-helpers.ts` |

### Patterns

- **Dual-Write Architecture**:
  - **NATS KV** (`SENSOR_STATE` bucket):
    - Key: `{zone}.{sensorId}.{measurement}` (e.g., `zone1.temp-42.temperature`)
    - Value: Latest `SensorReading` (timestamp, value, unit)
    - TTL: 1 hour (auto-cleanup for stale sensors)
    - History: 1 entry (no versioning needed for latest state)
  - **SQLite** (`sensor_readings` table):
    - Columns: `zone`, `sensor_id`, `measurement`, `value`, `unit`, `timestamp`, `created_at`
    - Index: `(zone, sensor_id, measurement, timestamp DESC)` for range queries
    - Retention: DELETE rows older than 30 days (daily background job)

- **Consistency Model**: Eventual consistency via dual-write
  - S4 (Ingestion) writes to **both** KV and SQLite in parallel (Effect.all)
  - Failures: Log error, continue (one store failure doesn't block the other)
  - Recovery: Background reconciliation job compares KV vs SQLite latest, repairs divergence

- **Query API**:
  - **Current state**: Read from NATS KV (sub-millisecond latency)
  - **Time ranges**: Query SQLite with indexed WHERE clause (`timestamp BETWEEN ? AND ?`)
  - **Aggregates**: SQLite window functions (`AVG(value) OVER (PARTITION BY sensor_id ORDER BY timestamp)`)
  - **Live updates**: Subscribe to NATS KV watch stream (`bucket.watch('zone1.*.temperature')`)

- **Retention Policy**:
  - **SQLite**: Daily cron deletes rows older than 30 days
  - **NATS KV**: TTL=1h auto-cleanup (no manual purge needed)
  - **Configurable**: Environment variable `SENSOR_RETENTION_DAYS=30`

- **Schema Evolution**:
  - SQLite migrations via `schema_version` table (see `/src/lib/durable-streams/server/persistence.ts:59-105`)
  - NATS KV versioning via Schema transforms (backward-compatible decoding)

### Interfaces

| Interface | Protocol | Schema |
|-----------|----------|--------|
| S4→S5 | Effect.Stream | Validated `SensorReading[]` from ingestion |
| S5→S6 | KV watch | Live updates via `KvWatchEvent<SensorReading>` |
| S5→S6 | SQL query | Historical data via `SELECT * FROM sensor_readings WHERE ...` |
| S5 internal | Dual-write | Effect.all([kvWrite, sqlWrite]) with independent error handling |

**Storage Schemas** (Effect Schema):

```typescript
// Latest sensor state (NATS KV value)
class SensorReading extends Schema.TaggedClass<SensorReading>()(
  'SensorReading',
  {
    sensorId: Schema.String,
    zone: Schema.String,
    measurement: Schema.String,
    value: Schema.Number,
    unit: Schema.optional(Schema.String),
    timestamp: Schema.DateFromSelf, // ISO string in KV, Date in memory
  }
) {}

// Historical row (SQLite Model)
const SensorReadingModel = Model.Class({
  id: Model.Generated(Model.Number), // Auto-increment PK
  zone: Model.String,
  sensorId: Model.String,
  measurement: Model.String,
  value: Model.Number,
  unit: Model.NullOr(Model.String),
  timestamp: Model.DateTimeUtc, // ISO string in DB, Date in memory
  createdAt: Model.Generated(Model.DateTimeUtc), // Server insert time
})
```

## Rationale

### Alternatives Considered

1. **NATS KV Only**
   - **Pros**: Simplest architecture, single store, native watch streams
   - **Cons**: No efficient time-range queries, unbounded growth (no automatic retention), limited aggregation (client-side only)
   - **Rejected**: Historical analytics require SQL-like queries; KV is not a time-series database

2. **SQLite Only**
   - **Pros**: Single source of truth, powerful queries, proven reliability
   - **Cons**: No reactive updates (polling required), slower current-state reads (index lookup vs KV hash)
   - **Rejected**: Real-time UI updates suffer; KV watch streams are killer feature for reactive apps

3. **TimescaleDB / ClickHouse**
   - **Pros**: Purpose-built time-series DB, native compression, advanced analytics
   - **Cons**: External dependency (no embedded option), overkill for MVP, complex deployment
   - **Rejected**: Deferred to production; SQLite sufficient for 30-day retention at 1000 writes/sec

4. **Redis + PostgreSQL**
   - **Pros**: Industry-standard stack, Redis for cache, Postgres for history
   - **Cons**: Two external dependencies, higher operational overhead, no embedded option
   - **Rejected**: NATS KV replaces Redis; SQLite replaces Postgres for MVP

### Tradeoffs

| Gain | Cost |
|------|------|
| **Fast current-state reads** — KV hash lookup (<1ms) vs SQLite index seek (~5ms) | Dual-write complexity — Must maintain consistency between KV and SQLite |
| **Reactive UI updates** — NATS watch streams push changes to clients | Memory overhead — KV bucket holds ~1000 keys × 200 bytes = ~200KB RAM |
| **Efficient historical queries** — SQLite indexes enable sub-second time-range scans | Write amplification — Every reading written twice (KV + SQLite) |
| **Automatic KV cleanup** — TTL=1h purges stale sensors without code | Retention logic — SQLite requires background job to delete old rows |
| **Embedded storage** — No external DB dependencies for MVP | Scale ceiling — SQLite limited to ~10k writes/sec (needs sharding beyond MVP) |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **KV-SQLite divergence** — Dual-write failures create inconsistency | Medium | Medium | Background reconciliation job compares latest KV vs SQLite, alerts on >1% drift |
| **SQLite write contention** — Concurrent ingestion threads block on WAL lock | Low | Medium | WAL mode supports multiple readers + single writer; batch writes (1000 rows/txn) |
| **Disk exhaustion** — Retention policy fails, DB grows unbounded | Low | High | Monitoring alerts at 80% disk usage; retention job runs daily with health checks |
| **KV memory limits** — NATS JetStream hits memory cap (default 1GB) | Low | Medium | TTL=1h caps active keys; monitor bucket size; increase JetStream max_memory if needed |
| **Query performance degradation** — SQLite scans slow as data grows | Medium | Low | Composite index `(zone, sensor_id, measurement, timestamp DESC)` optimizes range queries; VACUUM monthly |

## Implementation

### Files

| Path | Action | Description |
|------|--------|-------------|
| `/src/lib/sensor-storage/SensorStorageService.ts` | create | Effect service wrapping dual-write logic (KV + SQLite) |
| `/src/lib/sensor-storage/repositories.ts` | create | Model.makeRepository for `sensor_readings` table |
| `/src/lib/sensor-storage/schemas.ts` | create | SensorReading Schema, SensorReadingModel |
| `/src/lib/sensor-storage/migrations.ts` | create | SQLite schema v1: CREATE TABLE sensor_readings |
| `/src/lib/sensor-storage/layer.ts` | create | Layer composition: SqliteFileLayer + migrations |
| `/src/lib/sensor-storage/reconciliation.ts` | create | Background job: compare KV vs SQLite, alert on drift |
| `/src/lib/sensor-storage/retention.ts` | create | Background job: DELETE old SQLite rows, VACUUM |
| `/src/lib/nats/buckets/sensor-state.ts` | create | NATS KV bucket config: TTL=1h, history=1 |
| `/scripts/sensor-retention-job.ts` | create | Bun script for daily retention cron (invoke via systemd timer) |

### Dependencies

```json
{
  "@effect/sql": "latest",            // Already installed
  "@effect/sql-sqlite-bun": "latest", // Already installed
  "nats.ws": "^1.28.0",               // Already installed
  "@effect/schema": "latest"          // Already installed
}
```

**No new dependencies required** — reuse TMNL's existing Effect SQL + NATS stack.

### Test Strategy

**Unit Tests** (`@effect/vitest`):

1. **SensorStorageService.write()**:
   - Mock KV and SQLite
   - Publish `SensorReading`
   - Assert: Both stores called with correct schema-encoded data

2. **SensorStorageService.getCurrentState()**:
   - Populate KV with test data
   - Query by `(zone, sensorId, measurement)`
   - Assert: Returns latest reading in <1ms

3. **SensorStorageService.queryHistory()**:
   - Insert 100 rows into SQLite
   - Query range `(start=now-24h, end=now)`
   - Assert: Returns rows in DESC timestamp order

4. **Schema transforms**:
   - Encode `SensorReading` to JSON (KV)
   - Encode `SensorReadingModel` to SQL row
   - Assert: DateFromSelf → ISO string, NullOr → NULL

**Integration Tests** (Docker Compose + SQLite):

1. **Dual-Write Consistency**:
   - Start NATS + TMNL
   - Write 10 readings via SensorStorageService
   - Assert: All 10 in KV bucket, all 10 in SQLite

2. **KV Watch Stream**:
   - Subscribe to `SENSOR_STATE.watch('zone1.*.temperature')`
   - Write 5 readings to `zone1.temp-42.temperature`
   - Assert: Subscriber receives 5 events in order

3. **Retention Policy**:
   - Insert readings with timestamps [now, now-29d, now-31d]
   - Run retention job
   - Assert: now-31d deleted, others retained

4. **Reconciliation**:
   - Write to KV only (simulate SQLite failure)
   - Run reconciliation job
   - Assert: Alert logged, divergence metric incremented

**Load Tests** (optional, deferred):
- Sustained 1000 writes/sec for 10 minutes
- Measure: SQLite write latency P95, KV bucket memory growth
- Target: <5ms P95 SQLite write, <500KB KV memory

## Metadata

### Related ADRs
- **ADR-S4-S5** (Ingestion-Storage integration) — S4 calls SensorStorageService.write() with validated readings
- **ADR-S5-S6** (Storage-Client integration) — S6 subscribes to KV watch stream + queries SQLite history
- **ADR-S1-S5-S9** (Observability triplet) — S9 metrics track KV-SQLite divergence, write latency, retention job health
- **ADR-S3** (Transport Layer) — NATS JetStream provides persistence before S4 ingestion (upstream durability)

### Open Questions

1. **Downsampling strategy** — Should high-frequency sensors (10Hz) be downsampled to 1Hz before storage? If so, where (S4 or S5)?
2. **Aggregation precomputation** — Should hourly/daily rollups be materialized in separate SQLite tables, or computed on-demand?
3. **Multi-sensor queries** — How to efficiently query "all temperature sensors in zone1" (100+ sensors × 30 days = 2.5M rows)?
4. **Cold storage archival** — Should data older than 30 days be exported to S3/Parquet before deletion?
5. **KV bucket sharding** — At what scale do we need separate buckets per zone (`SENSOR_STATE_ZONE1`, `SENSOR_STATE_ZONE2`)?
6. **Conflict resolution** — If KV and SQLite diverge, which is authoritative? (Current: SQLite for history, KV for latest)

### References

- NATS KV Service: `/src/lib/nats/NatsKVService.ts`
- SQLite persistence patterns: `/src/lib/durable-streams/server/persistence.ts`
- Model.makeRepository example: `/src/lib/editor/v3/persistence/repositories.ts`
- Schema helpers (NullableJsonFromString): `/src/lib/editor/v3/persistence/sqlite-helpers.ts`
- WAL mode documentation: https://sqlite.org/wal.html
- Effect SQL docs (via MCP): `effect-docs` → `@effect/sql`
