# Entity System: Storage Architecture

**Spec ID:** entity-system/04-storage-architecture
**Created:** 2026-01-30
**Author:** Val (Architect Agent)
**Status:** DESIGN
**Related:**
- `thoughts/shared/research/eventlog-iiot-architecture.md`
- `thoughts/shared/research/eventlog-deepwiki-research.md`
- `thoughts/shared/alignments/2026-01-29-iiot-ams-v3-convergence.md`
- `src/lib/iiot/schemas/readings.ts`

---

## Executive Summary

This specification defines the dual-store architecture for the IIoT Entity System:

1. **EventLog (Effect @effect/experimental)** — Full Event Sourcing for domain events
2. **TimescaleDB (hypertables)** — Time-series storage for high-frequency sensor data

The **EntityId is the universal join key** connecting both stores, enabling:
- Temporal queries across domains
- Root Cause Analysis (RCA) correlation
- Audit trail compliance (ISA-18.2, FDA 21 CFR Part 11)
- OEE calculation from equipment state events

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ENTITY (MCH-001)                                      │
│                                                                                          │
│    entityId: MachineId = "MCH-001"                                                       │
│                                                                                          │
├─────────────────────────────────────┬───────────────────────────────────────────────────┤
│          EVENT STORE                │            TEMPORAL STORE                          │
│       (@effect/experimental)        │             (TimescaleDB)                          │
│                                     │                                                    │
│  ┌─────────────────────────────┐    │    ┌─────────────────────────────┐                │
│  │     SqlEventJournal         │    │    │      Hypertables            │                │
│  │  ┌───────────────────────┐  │    │    │  ┌───────────────────────┐  │                │
│  │  │ iiot_event_journal    │  │    │    │  │ iiot.sensor_readings  │  │                │
│  │  │ • sequence_num        │  │    │    │  │ • time (timestamptz)  │  │                │
│  │  │ • entity_type         │  │    │    │  │ • device_id           │  │                │
│  │  │ • primary_key (entityId)│ │    │    │  │ • value               │  │                │
│  │  │ • event_tag           │  │    │    │  │ • quality             │  │                │
│  │  │ • payload (jsonb)     │  │    │    │  └───────────────────────┘  │                │
│  │  │ • created_at          │  │    │    │                             │                │
│  │  └───────────────────────┘  │    │    │  ┌───────────────────────┐  │                │
│  │                             │    │    │  │ readings_1min (cagg)  │  │                │
│  │  ┌───────────────────────┐  │    │    │  │ • bucket              │  │                │
│  │  │ iiot_event_remotes    │  │    │    │  │ • device_id           │  │                │
│  │  │ • remote_id           │  │    │    │  │ • avg_value           │  │                │
│  │  │ • last_sync_seq       │  │    │    │  │ • min/max/stddev      │  │                │
│  │  └───────────────────────┘  │    │    │  └───────────────────────┘  │                │
│  └─────────────────────────────┘    │    │                             │                │
│                                     │    │  ┌───────────────────────┐  │                │
│  Domain Events:                     │    │  │ readings_1hour (cagg) │  │                │
│  ─────────────────                  │    │  │ • bucket              │  │                │
│  • EquipmentStateChanged            │    │  │ • device_id           │  │                │
│  • MaintenanceModeEntered           │    │  │ • avg_value           │  │                │
│  • AlarmTriggered                   │    │  │ • min/max/stddev      │  │                │
│  • WorkOrderCreated                 │    │  └───────────────────────┘  │                │
│  • TaskCompleted                    │    └─────────────────────────────┘                │
│                                     │                                                    │
│  Operational Events:                │    Time-Series Data:                               │
│  ──────────────────                 │    ─────────────────                               │
│  • AlarmAcknowledged                │    • Sensor readings (values)                      │
│  • AlarmCleared                     │    • Metrics/telemetry                             │
│  • WorkOrderApproved                │    • Command logs                                  │
│  • ApprovalGranted                  │    • High-frequency data                           │
│                                     │                                                    │
└──────────────────┬──────────────────┴───────────────────┬────────────────────────────────┘
                   │                                      │
                   └────────────┬─────────────────────────┘
                                │
                          ┌─────┴─────┐
                          │ entityId  │
                          │ (join key)│
                          └───────────┘
                                │
                    ┌───────────┴───────────┐
                    │    QUERY PATTERNS     │
                    ├───────────────────────┤
                    │ Temporal: "What was   │
                    │ the state at time T?" │
                    ├───────────────────────┤
                    │ Correlation: "Show    │
                    │ readings ±5min around │
                    │ this alarm"           │
                    ├───────────────────────┤
                    │ RCA: "What happened   │
                    │ when MCH-001 failed?" │
                    └───────────────────────┘
```

---

## Store Boundaries

### EventLog (Effect @effect/experimental)

**Purpose:** Full event sourcing for domain and operational events.

**Characteristics:**
- Immutable append-only log
- Schema-validated payloads (Effect Schema)
- Replay to rebuild aggregate state
- Reactivity for projection invalidation
- CRDT-compatible for distributed sync

**Storage Backend:** `@effect/sql/SqlEventJournal`
- PostgreSQL tables with proper indexing
- Hybrid partitioning (entity_type + time)

### TimescaleDB

**Purpose:** High-frequency time-series data storage.

**Characteristics:**
- Optimized for time-bucketed queries
- Automatic chunking by time
- Continuous aggregates for dashboard performance
- Compression for historical data
- Native hypertable operations

---

## EventLog Configuration

### SqlEventJournal Layer

```typescript
// src/lib/iiot/infrastructure/eventlog-layer.ts

import { Layer } from 'effect'
import * as SqlEventJournal from '@effect/sql/SqlEventJournal'
import * as EventLog from '@effect/experimental/EventLog'

/**
 * IIoT SQL-backed EventJournal Layer
 *
 * Creates tables:
 * - iiot_event_journal: Event entries (partitioned by entity_type)
 * - iiot_event_remotes: Remote sync tracking for CRDT
 *
 * Requires: SqlClient.SqlClient (PostgreSQL)
 */
export const IIoTSqlEventJournalLayer = SqlEventJournal.layer({
  eventLogTable: 'iiot_event_journal',
  remotesTable: 'iiot_event_remotes',
})

/**
 * Identity Layer for EventLog
 *
 * Production: Persist via KeyValueStore for stable identity
 * Testing: Random identity sufficient
 */
export const IIoTIdentityLayer = Layer.succeed(
  EventLog.Identity,
  EventLog.Identity.makeRandom()
)

/**
 * Combined IIoT EventLog Schema
 */
export const IIoTEventLogSchema = EventLog.schema(
  // Alarm domain
  AlarmEvents,
  // Work order domain
  WorkOrderLifecycleEvents,
  WorkOrderContextEvents,
  TaskInstanceEvents,
  ApprovalEvents,
  L3SyncEvents,
  WorkflowDefinitionEvents,
  // Equipment state domain
  EquipmentStateEvents,
)

/**
 * EventLog Layer with schema
 */
export const IIoTEventLogLayer = EventLog.layer(IIoTEventLogSchema)

/**
 * Full EventLog Stack
 * Requires: SqlClient.SqlClient (PostgreSQL)
 */
export const IIoTEventLogStackLayer = IIoTEventLogLayer.pipe(
  Layer.provide(IIoTSqlEventJournalLayer),
  Layer.provide(IIoTIdentityLayer)
)
```

### Event Journal DDL

```sql
-- iiot_event_journal: Main event storage (partitioned)
CREATE TABLE iiot.event_journal (
  sequence_num    BIGSERIAL,
  entity_type     VARCHAR(64) NOT NULL,  -- 'alarm', 'work_order', 'equipment'
  primary_key     VARCHAR(255) NOT NULL, -- entityId (AlarmId, MachineId, etc.)
  event_tag       VARCHAR(128) NOT NULL, -- 'AlarmTriggered', 'StateChanged'
  payload         JSONB NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  identity_id     UUID NOT NULL,         -- EventLog identity for CRDT
  
  PRIMARY KEY (entity_type, sequence_num)
) PARTITION BY LIST (entity_type);

-- Partitions by entity type for query optimization
CREATE TABLE iiot.event_journal_alarm PARTITION OF iiot.event_journal
  FOR VALUES IN ('alarm');
  
CREATE TABLE iiot.event_journal_work_order PARTITION OF iiot.event_journal
  FOR VALUES IN ('work_order');
  
CREATE TABLE iiot.event_journal_equipment PARTITION OF iiot.event_journal
  FOR VALUES IN ('equipment');

CREATE TABLE iiot.event_journal_task PARTITION OF iiot.event_journal
  FOR VALUES IN ('task');
  
CREATE TABLE iiot.event_journal_approval PARTITION OF iiot.event_journal
  FOR VALUES IN ('approval');

-- Indexes for temporal queries
CREATE INDEX idx_event_journal_temporal
  ON iiot.event_journal (primary_key, created_at DESC);

CREATE INDEX idx_event_journal_tag
  ON iiot.event_journal (event_tag, created_at DESC);

CREATE INDEX idx_event_journal_payload_gin
  ON iiot.event_journal USING GIN (payload jsonb_path_ops);

-- iiot_event_remotes: Remote sync tracking
CREATE TABLE iiot.event_remotes (
  remote_id       UUID PRIMARY KEY,
  last_sync_seq   BIGINT NOT NULL DEFAULT 0,
  entity_type     VARCHAR(64) NOT NULL,
  synced_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_event_remotes_type
  ON iiot.event_remotes (entity_type, synced_at DESC);
```

---

## TimescaleDB Schema

### Hypertable Configuration

```sql
-- Extension setup
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Main sensor readings hypertable
CREATE TABLE iiot.sensor_readings (
  time            TIMESTAMPTZ NOT NULL,
  device_id       VARCHAR(128) NOT NULL,  -- DeviceId (branded)
  asset_id        VARCHAR(128),            -- AssetId for correlation
  value           DOUBLE PRECISION NOT NULL,
  quality         SMALLINT NOT NULL DEFAULT 100,
  opc_ua_quality  VARCHAR(64),             -- OPC-UA quality code
  
  PRIMARY KEY (device_id, time)
);

-- Convert to hypertable (7-day chunks)
SELECT create_hypertable(
  'iiot.sensor_readings',
  by_range('time', INTERVAL '7 days')
);

-- Compression policy (compress after 30 days)
ALTER TABLE iiot.sensor_readings SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'device_id',
  timescaledb.compress_orderby = 'time DESC'
);

SELECT add_compression_policy('iiot.sensor_readings', INTERVAL '30 days');

-- Equipment metrics hypertable
CREATE TABLE iiot.equipment_metrics (
  time            TIMESTAMPTZ NOT NULL,
  equipment_id    VARCHAR(128) NOT NULL,   -- MachineId
  metric_name     VARCHAR(64) NOT NULL,    -- 'cycle_time', 'throughput', 'oee'
  value           DOUBLE PRECISION NOT NULL,
  unit            VARCHAR(32),
  
  PRIMARY KEY (equipment_id, metric_name, time)
);

SELECT create_hypertable(
  'iiot.equipment_metrics',
  by_range('time', INTERVAL '7 days')
);

-- Command log hypertable (for Device entities)
CREATE TABLE iiot.command_log (
  time            TIMESTAMPTZ NOT NULL,
  device_id       VARCHAR(128) NOT NULL,
  command         VARCHAR(128) NOT NULL,
  parameters      JSONB,
  status          VARCHAR(32) NOT NULL,    -- 'sent', 'acked', 'completed', 'failed'
  response        JSONB,
  
  PRIMARY KEY (device_id, time)
);

SELECT create_hypertable(
  'iiot.command_log',
  by_range('time', INTERVAL '7 days')
);
```

### Continuous Aggregates

```sql
-- 1-minute aggregates (Warm tier)
CREATE MATERIALIZED VIEW iiot.readings_1min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 minute', time) AS bucket,
  device_id,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  STDDEV(value) AS stddev_value,
  COUNT(*) AS sample_count
FROM iiot.sensor_readings
GROUP BY bucket, device_id
WITH NO DATA;

-- Refresh policy: Update every minute
SELECT add_continuous_aggregate_policy('iiot.readings_1min',
  start_offset => INTERVAL '10 minutes',
  end_offset => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute'
);

-- 1-hour aggregates (Cold tier)
CREATE MATERIALIZED VIEW iiot.readings_1hour
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS bucket,
  device_id,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  STDDEV(value) AS stddev_value,
  COUNT(*) AS sample_count
FROM iiot.sensor_readings
GROUP BY bucket, device_id
WITH NO DATA;

-- Refresh policy: Update every 10 minutes
SELECT add_continuous_aggregate_policy('iiot.readings_1hour',
  start_offset => INTERVAL '3 hours',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '10 minutes'
);

-- 1-day aggregates (Historical tier)
CREATE MATERIALIZED VIEW iiot.readings_1day
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS bucket,
  device_id,
  AVG(value) AS avg_value,
  MIN(value) AS min_value,
  MAX(value) AS max_value,
  STDDEV(value) AS stddev_value,
  COUNT(*) AS sample_count
FROM iiot.sensor_readings
GROUP BY bucket, device_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('iiot.readings_1day',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 day',
  schedule_interval => INTERVAL '1 hour'
);
```

---

## Entity-to-Store Mapping

| Entity Type | Event Store (EventLog) | Temporal Store (TimescaleDB) | Join Key |
|-------------|------------------------|------------------------------|----------|
| **Enterprise** | Structural events (Created, Updated, Archived) | N/A | EnterpriseId |
| **Site** | Structural events | N/A | SiteId |
| **Area** | Structural events | N/A | AreaId |
| **Plant** | Structural + Operational events | N/A | PlantId |
| **Line (Work Center)** | Operational events (StateChanged, ProductionBatchStarted) | Optional line metrics | LineId |
| **Machine (Work Unit)** | Operational events (StateChanged, MaintenanceEntered) | Equipment metrics hypertable | MachineId |
| **Sensor** | Config events (ConfigChanged, CalibrationCompleted) | **sensor_readings** hypertable (primary) | DeviceId |
| **Device** | Config events + Command events | command_log hypertable | DeviceId |
| **Alarm** | Full lifecycle (Triggered → Acknowledged → Cleared) | N/A | AlarmId |
| **WorkOrder** | Full lifecycle (Created → ... → Closed) | N/A | WorkOrderId |
| **TaskInstance** | Lifecycle (Ready → Started → Completed) | N/A | TaskInstanceId |
| **ApprovalRequest** | Lifecycle (Requested → Granted/Rejected) | N/A | ApprovalId |

### Decision Matrix

| Data Characteristic | Store | Rationale |
|---------------------|-------|-----------|
| Low frequency, auditable | EventLog | Full replay, compliance |
| High frequency, numeric | TimescaleDB | Aggregation efficiency |
| Needs temporal query | Both (join) | Cross-correlation |
| Compliance-critical | EventLog | Immutable audit trail |
| Dashboard aggregation | TimescaleDB | Continuous aggregates |
| Business event | EventLog | Schema validation, replay |
| Telemetry/metrics | TimescaleDB | Time-bucket optimization |

---

## Cross-Store Query Patterns

### Pattern 1: Entity History (EventLog Only)

**Question:** "What happened to MCH-001?"

```typescript
// src/lib/iiot/queries/entity-history.ts

export const getEntityHistory = (entityId: MachineId) =>
  Effect.gen(function* () {
    const eventLog = yield* IIoTEventLog
    
    // Fetch all events for this entity
    const events = yield* eventLog.read({
      primaryKey: entityId,
      limit: 100,
    })
    
    return events
  })
```

```sql
-- Direct SQL (for debugging/admin)
SELECT event_tag, payload, created_at
FROM iiot.event_journal
WHERE primary_key = 'MCH-001'
ORDER BY created_at DESC
LIMIT 100;
```

### Pattern 2: Time-Series Aggregation (TimescaleDB Only)

**Question:** "Temperature last 24 hours for TEMP-001?"

```typescript
// src/lib/iiot/queries/time-series.ts

export const getReadingsLast24h = (deviceId: DeviceId) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient
    
    // Query appropriate tier based on freshness
    const readings = yield* sql`
      SELECT bucket, avg_value, min_value, max_value, sample_count
      FROM iiot.readings_1hour
      WHERE device_id = ${deviceId}
        AND bucket >= NOW() - INTERVAL '24 hours'
      ORDER BY bucket DESC
    `
    
    return readings
  })
```

### Pattern 3: Cross-Store Correlation (Join Pattern)

**Question:** "Show temperature readings ±5 minutes around alarm ALM-123"

```typescript
// src/lib/iiot/queries/correlation.ts

export const correlateAlarmWithReadings = (alarmId: AlarmId, windowMinutes = 5) =>
  Effect.gen(function* () {
    const eventLog = yield* IIoTEventLog
    const sql = yield* SqlClient.SqlClient
    
    // Step 1: Get alarm event from EventLog
    const alarmEvents = yield* eventLog.read({
      primaryKey: alarmId,
      tags: ['AlarmTriggered'],
      limit: 1,
    })
    
    if (alarmEvents.length === 0) {
      return yield* Effect.fail(new AlarmNotFoundError({ alarmId }))
    }
    
    const alarm = alarmEvents[0].payload
    const alarmTime = alarm.triggeredAt
    const deviceId = alarm.deviceId
    
    // Step 2: Query TimescaleDB for readings in time window
    const readings = yield* sql`
      SELECT time, value, quality
      FROM iiot.sensor_readings
      WHERE device_id = ${deviceId}
        AND time BETWEEN 
          ${alarmTime}::timestamptz - INTERVAL '${windowMinutes} minutes'
          AND ${alarmTime}::timestamptz + INTERVAL '${windowMinutes} minutes'
      ORDER BY time ASC
    `
    
    return {
      alarm,
      readings,
      window: { before: windowMinutes, after: windowMinutes },
    }
  })
```

### Pattern 4: RCA Snapshot (Multi-Domain Temporal)

**Question:** "What was the system state when MCH-001 failed?"

```typescript
// src/lib/iiot/queries/rca-snapshot.ts

export interface RCASnapshot {
  asOf: Date
  triggeredBy: { type: 'alarm' | 'equipment_state'; id: string }
  alarms: Array<{ alarmId: AlarmId; state: AlarmState; severity: AlarmSeverity }>
  equipment: Array<{ equipmentId: MachineId; state: OperationalState }>
  workOrders: Array<{ workOrderId: WorkOrderId; status: WorkOrderStatus }>
  recentReadings: Array<{ deviceId: DeviceId; value: number; time: Date }>
}

export const getRCASnapshot = (
  assetId: AssetId,
  asOf: Date,
  readingsWindow: Duration = Duration.minutes(5)
) =>
  Effect.gen(function* () {
    const eventLog = yield* IIoTEventLog
    const sql = yield* SqlClient.SqlClient
    
    // Parallel queries for efficiency
    const [alarmEvents, equipmentEvents, workOrderEvents, readings] = yield* Effect.all([
      // Alarm state at time T
      eventLog.read({
        filter: { assetId },
        before: asOf,
      }).pipe(Effect.map(events => reconstructAlarmsAtTime(events, asOf))),
      
      // Equipment state at time T
      eventLog.read({
        filter: { assetId },
        entityType: 'equipment',
        before: asOf,
      }).pipe(Effect.map(events => reconstructEquipmentAtTime(events, asOf))),
      
      // Active work orders at time T
      eventLog.read({
        filter: { assetId },
        entityType: 'work_order',
        before: asOf,
      }).pipe(Effect.map(events => reconstructWorkOrdersAtTime(events, asOf))),
      
      // Recent readings from TimescaleDB
      sql`
        SELECT time, device_id, value, quality
        FROM iiot.sensor_readings
        WHERE device_id IN (
          SELECT device_id FROM iiot.asset_devices WHERE asset_id = ${assetId}
        )
        AND time BETWEEN 
          ${asOf}::timestamptz - ${Duration.toMillis(readingsWindow)}::interval
          AND ${asOf}::timestamptz
        ORDER BY time DESC
        LIMIT 100
      `,
    ], { concurrency: 'unbounded' })
    
    return {
      asOf,
      triggeredBy: { type: 'manual', id: 'rca-query' },
      alarms: alarmEvents,
      equipment: equipmentEvents,
      workOrders: workOrderEvents,
      recentReadings: readings,
    } satisfies RCASnapshot
  })
```

### Pattern 5: OEE Calculation (Hybrid)

**Question:** "Calculate OEE for MCH-001 last shift"

```typescript
// src/lib/iiot/queries/oee.ts

export interface OEEMetrics {
  equipmentId: MachineId
  from: Date
  to: Date
  availability: number  // 0-1
  performance: number   // 0-1
  quality: number       // 0-1
  oee: number           // 0-1 (product of above)
  downtime: {
    total: Duration
    breakdown: Array<{ reason: string; duration: Duration }>
  }
}

export const calculateOEE = (equipmentId: MachineId, from: Date, to: Date) =>
  Effect.gen(function* () {
    const eventLog = yield* IIoTEventLog
    const sql = yield* SqlClient.SqlClient
    
    // Step 1: Get state events from EventLog
    const stateEvents = yield* eventLog.read({
      primaryKey: equipmentId,
      entityType: 'equipment',
      after: from,
      before: to,
    })
    
    // Step 2: Calculate availability from state durations
    const availability = calculateAvailabilityFromEvents(stateEvents, from, to)
    
    // Step 3: Get production metrics from TimescaleDB
    const metrics = yield* sql`
      SELECT 
        SUM(value) FILTER (WHERE metric_name = 'actual_count') as actual_count,
        SUM(value) FILTER (WHERE metric_name = 'ideal_count') as ideal_count,
        SUM(value) FILTER (WHERE metric_name = 'good_count') as good_count
      FROM iiot.equipment_metrics
      WHERE equipment_id = ${equipmentId}
        AND time BETWEEN ${from} AND ${to}
    `
    
    // Step 4: Calculate OEE components
    const performance = metrics.actual_count / metrics.ideal_count
    const quality = metrics.good_count / metrics.actual_count
    const oee = availability.availability * performance * quality
    
    return {
      equipmentId,
      from,
      to,
      availability: availability.availability,
      performance,
      quality,
      oee,
      downtime: availability.downtime,
    } satisfies OEEMetrics
  })
```

---

## Retention Policies

### EventLog Retention

| Domain | Hot Retention | Compaction Trigger | Cold Archive |
|--------|---------------|-------------------|--------------|
| **Alarms** | 90 days | > 1000 events/entity OR status=cleared + 7 days | 7 years (ISA-18.2) |
| **Work Orders** | 180 days | status=closed + 30 days | 10 years (FDA 21 CFR Part 11) |
| **Equipment State** | 30 days | > 500 events/entity | 2 years |
| **Tasks** | 90 days | parent WO closed + 30 days | 5 years |
| **Approvals** | 180 days | status=completed + 30 days | 10 years (FDA) |

### TimescaleDB Retention

| Table | Chunk Interval | Compression After | Drop After |
|-------|----------------|-------------------|------------|
| **sensor_readings** | 7 days | 30 days | 2 years |
| **readings_1min** | 7 days | 90 days | 1 year |
| **readings_1hour** | 30 days | N/A (already aggregated) | 5 years |
| **readings_1day** | 90 days | N/A | Forever |
| **equipment_metrics** | 7 days | 30 days | 2 years |
| **command_log** | 7 days | 30 days | 1 year |

### Retention Policy Implementation

```sql
-- TimescaleDB retention policies
SELECT add_retention_policy('iiot.sensor_readings', INTERVAL '2 years');
SELECT add_retention_policy('iiot.readings_1min', INTERVAL '1 year');
SELECT add_retention_policy('iiot.readings_1hour', INTERVAL '5 years');
SELECT add_retention_policy('iiot.equipment_metrics', INTERVAL '2 years');
SELECT add_retention_policy('iiot.command_log', INTERVAL '1 year');
```

```typescript
// EventLog compaction scheduler
// src/lib/iiot/infrastructure/compaction-scheduler.ts

export const scheduleCompaction = Effect.gen(function* () {
  const scheduler = yield* Scheduler
  const eventLog = yield* IIoTEventLog
  
  // Run compaction daily at 02:00 UTC
  yield* scheduler.schedule(
    Cron.parse('0 2 * * *'),
    Effect.gen(function* () {
      // Alarm compaction
      yield* eventLog.compact(AlarmEvents, {
        olderThan: Duration.days(90),
        minEvents: 1000,
        filter: (events) => {
          const last = events[events.length - 1]
          return last.payload.state === 'cleared'
        },
      })
      
      // Equipment state compaction
      yield* eventLog.compact(EquipmentStateEvents, {
        olderThan: Duration.days(30),
        minEvents: 500,
      })
      
      // Work order compaction (respecting FDA retention)
      yield* eventLog.compact(WorkOrderLifecycleEvents, {
        olderThan: Duration.days(180),
        filter: (events) => {
          const last = events[events.length - 1]
          return last.payload.status === 'closed'
        },
        archiveTo: 'iiot.event_journal_archive', // Cold storage
      })
    })
  )
})
```

---

## Compliance Considerations

### ISA-18.2 (Alarm Management)

| Requirement | Implementation |
|-------------|----------------|
| Full audit trail | EventLog: All alarm state transitions as immutable events |
| Shelve time limits | `shelvedUntil` field with max 24hr policy enforced in domain |
| Suppression reason | Required `reason` field on AlarmSuppressed event |
| Out-of-service tracking | AlarmOutOfService/ReturnedToService events |
| Acknowledgment recording | `acknowledgedBy`, `acknowledgedAt` in event payload |

### FDA 21 CFR Part 11

| Requirement | Implementation |
|-------------|----------------|
| Electronic signatures | `approvedBy` with identity service validation |
| Audit trail | EventLog immutability + sequence numbers |
| Access control | Service-level authorization before event emit |
| Data integrity | EventLog hash chains, no deletion |
| Record retention | 10-year cold archive for work orders |

### OEE Calculation (ISO 22400)

| Metric | Data Source | Calculation |
|--------|-------------|-------------|
| Availability | EventLog: Equipment state events | Operating Time / Planned Production Time |
| Performance | TimescaleDB: equipment_metrics | (Ideal Cycle Time × Actual Count) / Operating Time |
| Quality | TimescaleDB: equipment_metrics | Good Count / Total Count |
| OEE | Hybrid | Availability × Performance × Quality |

---

## Implementation Phases

### Phase 1: Foundation (3 days)

**Deliverables:**
- `IIoTSqlEventJournalLayer` configuration
- DDL for `iiot_event_journal` table (partitioned)
- DDL for TimescaleDB hypertables
- Basic schema integration

**Acceptance:**
- [ ] EventJournal tables created successfully
- [ ] Hypertables created with compression policies
- [ ] Layer composition compiles

### Phase 2: Event Groups (5 days)

**Deliverables:**
- AlarmEvents group with all 10 events
- EquipmentStateEvents group with 5 events
- Combined IIoTEventLogSchema

**Acceptance:**
- [ ] All event schemas validate
- [ ] Events emit to journal correctly
- [ ] Replay produces correct aggregate state

### Phase 3: Temporal Queries (4 days)

**Deliverables:**
- `getEntityAtTime()` primitive
- `reconstructAlarmsAtTime()` function
- `reconstructEquipmentAtTime()` function
- Index optimization for temporal queries

**Acceptance:**
- [ ] Temporal queries < 100ms for single entity
- [ ] Aggregate reconstruction matches event fold

### Phase 4: Cross-Store Correlation (3 days)

**Deliverables:**
- `correlateAlarmWithReadings()` query
- `getRCASnapshot()` multi-domain query
- `calculateOEE()` hybrid query

**Acceptance:**
- [ ] RCA snapshot < 1s for single asset
- [ ] OEE calculation matches manual calculation

### Phase 5: Retention & Compaction (2 days)

**Deliverables:**
- TimescaleDB retention policies
- EventLog compaction strategies
- Archive table DDL

**Acceptance:**
- [ ] Compaction reduces event count without data loss
- [ ] Retention policies active
- [ ] Archive table receives compacted events

---

## Success Criteria

1. **Schema Consistency:** All domain types as Effect Schema with branded identifiers
2. **Dual Store:** EventLog for domain events, TimescaleDB for time-series
3. **Join Key:** EntityId connects both stores for correlation
4. **Temporal Queries:** `getXAtTime()` primitives for all event-sourced domains
5. **RCA Support:** Cross-domain state reconstruction < 1s
6. **Compliance:** ISA-18.2 alarm audit trail, FDA 21 CFR Part 11 signatures
7. **OEE:** Hybrid calculation from EventLog + TimescaleDB
8. **Retention:** Tiered retention policies per domain/compliance requirements

---

## References

- `@effect/experimental/EventLog` — Core event sourcing API
- `@effect/sql/SqlEventJournal` — SQL persistence backend
- `src/lib/iiot/schemas/readings.ts` — Tiered latency model
- `src/lib/ams/v2/base/handlers/sql-event-journal.ts` — Reference implementation
- ISA-18.2 — Management of Alarm Systems for Process Industries
- FDA 21 CFR Part 11 — Electronic Records; Electronic Signatures
- ISO 22400 — Key Performance Indicators for Manufacturing Operations
