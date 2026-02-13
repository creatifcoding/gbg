# Where Event Sourcing DOESN'T Fit in IIoT

**Generated:** 2026-01-26  
**Author:** Oracle Agent  
**Domain:** Industrial IoT Persistence Patterns

---

## Executive Summary

Event sourcing is a powerful pattern for domains where business decisions and their history matter, but it is actively counterproductive for four major IIoT sub-domains: **sensor telemetry**, **equipment hierarchies**, **device configuration**, and **real-time dashboards**. These domains share characteristics that make CRUD or purpose-built storage (TimescaleDB, graph databases) dramatically superior: high-volume raw data without semantic meaning, reference data that rarely changes, simple key-value settings, and latency-critical state queries. Applying event sourcing here would be architectural malpractice.

---

## Domain Analysis

### 1. Sensor Telemetry / Time-Series Data

**Why ES doesn't fit:**

Sensor readings are **raw observations**, not business decisions. A temperature sensor reporting `23.5°C` at timestamp `T` is not an "event" in the event-sourcing sense—it carries no intent, no decision, no state transition. It is simply data.

| ES Assumption | Telemetry Reality |
|---------------|-------------------|
| Events represent business decisions | Readings are observations, not decisions |
| Events are replayed to derive state | "Current state" = latest reading (trivial) |
| Event history has semantic meaning | Reading history is just data points |
| Write-once, append-only | Massive write volume (millions/day) |

The core anti-pattern here is **property sourcing**—treating every data change as an event. As documented by event sourcing practitioners: "Publishing events like `LastNameChanged` is called Property Sourcing. This is an anti-pattern. The events themselves tell us nothing about the operation that performed them. They have no business value."

A `SensorReadingRecorded` event for every reading would generate billions of meaningless "events" that:
- Bloat the event store
- Provide zero replay value (you'd never replay sensor history to derive current state)
- Add latency to a write-critical path

**Better pattern: TimescaleDB hypertables with continuous aggregates**

Our codebase already demonstrates this correctly:

```typescript
// src/lib/iiot/services/l1/TimeSeriesClient.ts:249-281
const queryReadings = (params: {
  deviceId: DeviceId
  since?: Date
  until?: Date
  limit?: number
}): Stream.Stream<SensorReading, IIoTQueryError> =>
  Stream.fromEffect(
    Effect.gen(function* () {
      const rows = yield* sql<SensorReadingRow>`
        SELECT time, device_id, value, quality
        FROM iiot.sensor_readings
        WHERE device_id = ${params.deviceId}
          AND time >= ${since}
          AND time <= ${until}
        ORDER BY time DESC
        LIMIT ${limit}
      `
      return rows.map(mapRowToSensorReading)
    })
  )
```

This approach provides:
- **Hypertable partitioning**: Automatic time-based chunking for efficient range queries
- **Continuous aggregates**: Pre-computed rollups (`readings_1min`, `readings_1hour`) that refresh in the background
- **Compression**: Native columnar compression for historical data
- **Data retention**: Automatic deletion of raw data while preserving aggregates

**Volume concerns:**

Industrial environments generate 100,000+ readings per second. TimescaleDB handles this with COPY bulk inserts and aggressive compression. An event store would choke—"Processing a long chain of events, especially during system startup or when recalculating materialized views, can be resource-intensive."

**Source confidence:** HIGH — validated by TimescaleDB documentation, Cloudflare case studies, and multiple time-series database comparisons.

---

### 2. Equipment Hierarchy / Reference Data

**Why ES doesn't fit:**

Equipment hierarchies (Plant → Line → Machine → Sensor) are **reference data**. They describe the topology of the factory floor, not a sequence of business decisions.

| Characteristic | Reference Data Reality |
|----------------|------------------------|
| Change frequency | Rare (machines don't move daily) |
| History importance | Minimal (current topology matters) |
| Query pattern | Traversal, not temporal |
| Relationship complexity | Graph-like, not event-linear |

From the research: "Financial transactions use events while user preference settings use traditional tables. Data that changes infrequently and where history doesn't matter—country codes, currency lists, static lookup tables—fits CRUD naturally."

**Better pattern: Graph database (Apache AGE) with simple CRUD**

Our codebase demonstrates this correctly:

```typescript
// src/lib/iiot/services/l1/GraphClient.ts:192-212
const getPlants = (): Stream.Stream<Plant, GraphQueryError> =>
  Stream.fromEffect(
    executeCypher(
      `MATCH (p:plant) RETURN p.id AS id, p.name AS name, p.location AS location`,
      '(id agtype, name agtype, location agtype)'
    )
  ).pipe(
    Stream.flatMap((result) =>
      Stream.fromIterable(
        result.rows.map((row) => ({
          _tag: 'Plant',
          id: String(row['id']) as PlantId,
          name: String(row['name']),
          location: row['location'] ? String(row['location']) : undefined,
        }) as Plant)
      )
    )
  )
```

Graph databases excel at:
- **Hierarchical traversal**: `MATCH (p:plant)-[:contains]->(l:line)-[:contains]->(m:machine)`
- **Relationship queries**: "Which sensors monitor machines on Line A?"
- **Topology queries**: "What's the full path from sensor to plant?"

Audit trails for equipment changes (when a machine is moved) can be handled with simple audit logging—not full event sourcing.

**Why not ES for hierarchy changes?**

1. **Replay is pointless**: You'd never replay "MachineMovedToLine" events to derive current topology. Just query the graph.
2. **Complexity cost**: ES requires event handlers, projections, snapshots. A graph query is one Cypher statement.
3. **No temporal queries needed**: "Where was this machine in 2023?" is rarely asked. If needed, add an audit log table.

**Source confidence:** HIGH — validated by Neo4j MDM documentation, Rhize manufacturing data hub patterns, and graph database best practices.

---

### 3. Device Configuration

**Why ES doesn't fit:**

Device configuration is **key-value settings**. Sampling rate, calibration offsets, alarm thresholds—these are simple properties, not business events.

| ES Assumption | Configuration Reality |
|---------------|----------------------|
| Events capture intent | Settings have no "intent" beyond "set value to X" |
| State reconstruction needed | Current config is all that matters |
| Complex business logic | Simple CRUD operations |

From research: "For simple CRUD applications like a basic blog, a personal to-do list, or a simple content management system (CMS), the overhead of implementing Event Sourcing is not justified."

Device configuration fits this pattern. A sensor's `samplingRateHz: 10` setting doesn't benefit from event sourcing.

**Better pattern: Simple key-value tables with optional audit logging**

```sql
-- Configuration table (CRUD)
CREATE TABLE iiot.device_config (
  device_id TEXT PRIMARY KEY,
  sampling_rate_hz INTEGER DEFAULT 10,
  calibration_offset FLOAT DEFAULT 0,
  alarm_threshold FLOAT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Optional: audit table for compliance
CREATE TABLE iiot.device_config_audit (
  id SERIAL PRIMARY KEY,
  device_id TEXT,
  changed_by TEXT,
  old_value JSONB,
  new_value JSONB,
  changed_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Exception: Configuration CHANGES as business events**

There's one case where ES might apply: when configuration changes themselves are business-critical decisions requiring approval workflows, rollback capabilities, and compliance tracking. For example:
- "Operator raised alarm threshold from 80°C to 95°C" — this is a decision with consequences
- Such changes could be modeled as `ConfigurationChangeRequested`, `ConfigurationChangeApproved`

But this is event sourcing for **the approval workflow**, not the configuration itself. The configuration table remains CRUD; the workflow around changes could be event-sourced.

**Source confidence:** MEDIUM — extrapolated from general ES guidance. No IIoT-specific research on configuration management found.

---

### 4. Real-Time Dashboards

**Why ES doesn't fit:**

Dashboards need **current state, fast**. They display "Temperature: 23.5°C" and "Vibration: 2.1 mm/s" for the operator to act on. The history of how we got there is irrelevant at query time.

| ES Assumption | Dashboard Reality |
|---------------|-------------------|
| Derive state from events | Just show latest value |
| Eventually consistent | Need sub-second updates |
| Complex projections | Simple "get latest" query |

From research: "It's relatively expensive to read and replay events, so applications typically implement materialized views or read-only projections... Processing a long chain of events can be resource-intensive, negatively impacting application performance."

ES adds latency at exactly the wrong place—between the sensor reading and the operator seeing it.

**Better pattern: Direct queries + materialized views**

Our codebase demonstrates efficient dashboard queries:

```typescript
// src/lib/iiot/services/l1/TimeSeriesClient.ts:340-369
const getLatestReading = (
  deviceId: DeviceId
): Effect.Effect<SensorReading | null, IIoTQueryError> =>
  Effect.gen(function* () {
    const rows = yield* sql<SensorReadingRow>`
      SELECT time, device_id, value, quality
      FROM iiot.sensor_readings
      WHERE device_id = ${deviceId}
      ORDER BY time DESC
      LIMIT 1
    `
    if (rows.length === 0) return null
    return mapRowToSensorReading(rows[0])
  })
```

For multi-device dashboard views:

```typescript
// src/lib/iiot/services/l1/TimeSeriesClient.ts:431-461
const getLatestReadingsForDevices = (
  deviceIds: ReadonlyArray<DeviceId>
): Effect.Effect<ReadonlyArray<SensorReading>, IIoTQueryError> =>
  Effect.gen(function* () {
    // Use DISTINCT ON for efficient "latest per device" query
    const rows = yield* sql<SensorReadingRow>`
      SELECT DISTINCT ON (device_id)
        time, device_id, value, quality
      FROM iiot.sensor_readings
      WHERE device_id = ANY(${[...deviceIds]})
      ORDER BY device_id, time DESC
    `
    return rows.map(mapRowToSensorReading)
  })
```

This is:
- **O(1) in event count**: Query time doesn't grow with historical data
- **Sub-millisecond**: Direct index scan
- **Consistent**: No eventual consistency lag

**If you event-sourced dashboards:**
1. Write `SensorReadingRecorded` event
2. Event handler updates projection
3. Dashboard queries projection
4. Latency: 10-100ms+ per reading

**With direct queries:**
1. Write to hypertable
2. Dashboard queries hypertable
3. Latency: <1ms

**Source confidence:** HIGH — validated by ES documentation (Azure, AWS), real-time data architecture patterns.

---

## Recommended NON-ES Boundaries

| Domain | Use ES? | Rationale | Better Pattern |
|--------|---------|-----------|----------------|
| **Sensor readings** | NO | Raw data, not decisions; massive volume | TimescaleDB hypertables |
| **Equipment hierarchy** | NO | Reference data; rarely changes; graph relationships | Apache AGE graph queries |
| **Device registry** | NO | Master data; CRUD operations | Normalized tables + audit log |
| **Device configuration** | NO | Simple key-value; no replay value | Key-value table + optional audit |
| **Real-time dashboards** | NO | Need current state fast; no projection overhead | Direct queries + materialized views |
| **Historical analytics** | NO | Already aggregated; no events to derive | Continuous aggregates, pg_mooncake |
| **Alarm thresholds** | NO | Configuration data; simple CRUD | Config tables |

---

## The Line Between ES and Non-ES

### Event Sourcing IS appropriate when:

1. **Business decisions matter**: "Customer placed order", "Operator acknowledged alarm", "Shift supervisor approved override"
2. **Audit trail is non-negotiable**: Financial, safety-critical, regulatory domains
3. **Temporal queries are common**: "What was the state at 2pm yesterday?"
4. **Complex state transitions**: Workflows with multiple steps and rollback requirements
5. **Multiple consumers need different views**: CQRS with multiple read models

### Event Sourcing IS NOT appropriate when:

1. **Data has no semantic meaning**: Sensor readings are observations, not decisions
2. **Current state is all that matters**: Dashboard queries, configuration lookups
3. **Volume overwhelms event stores**: Millions of readings per day
4. **Simple CRUD suffices**: Reference data, master data
5. **Latency is critical**: Real-time displays, control loops
6. **History is just data, not decisions**: Time-series analysis doesn't need event replay

### Decision Heuristic

Ask: **"Would replaying the events teach us something about business decisions?"**

- `OrderPlaced → OrderShipped → OrderDelivered` — YES, the order lifecycle is meaningful
- `SensorReadingRecorded(23.5°C)` — NO, it's just a data point

If the answer is NO, don't use event sourcing.

---

## Codebase Validation

The existing IIoT implementation correctly avoids event sourcing where inappropriate:

| Component | Pattern Used | ES Would Add | Verdict |
|-----------|--------------|--------------|---------|
| `TimeSeriesClient.ts` | Direct SQL to hypertable | Pointless event layer | CORRECT |
| `GraphClient.ts` | Cypher queries to AGE | Replay complexity for static data | CORRECT |
| `AssetService.ts` | Graph traversal | Event handlers for hierarchy | CORRECT |
| `SensorReadingModel.ts` | Simple Model.Class | Event projection overhead | CORRECT |

The architecture already makes the right call. This report validates that decision.

---

## Sources

### Time-Series Database Patterns
- [Choosing the Best Time-Series Database for IoT Needs](https://spyro-soft.com/blog/industry-4-0/choosing-the-best-time-series-database-for-your-iot-needs-a-comparison)
- [TimescaleDB: Making Postgres Faster in 2024](https://dev.to/timescale/timescaledb-in-2024-making-postgres-faster-32f7)
- [How TimescaleDB Helped Cloudflare Scale Analytics](https://blog.cloudflare.com/timescaledb-art/)
- [TimescaleDB Continuous Aggregates Documentation](https://www.tigerdata.com/docs/use-timescale/latest/continuous-aggregates/about-continuous-aggregates)
- [Long-Term IIoT Data Retention with Time Series Databases](https://www.iiot-world.com/predictive-analytics/predictive-maintenance/long-term-iiot-data-retention-with-time-series-databases/)
- [Apache IoTDB: Time Series Database for Large Scale IoT](https://dl.acm.org/doi/10.1145/3726523)

### Event Sourcing Anti-Patterns
- [Event Sourcing vs CRUD - RisingStack](https://blog.risingstack.com/event-sourcing-vs-crud/)
- [Property Sourcing Anti-Pattern - Event-Driven.io](https://event-driven.io/en/property-sourcing/)
- [Event Sourcing Pattern - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing)
- [Event Sourcing Pattern - AWS Prescriptive Guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/event-sourcing.html)
- [Event Sourcing vs CRUD - Alexander Williamson](https://alexw.co.uk/blog-posts/event-sourcing/crud/databases/cqrs/domain-driven-design/2024/04/30/1718-event-sourcing/)
- [Event Sourcing Explained - BayTech Consulting](https://www.baytechconsulting.com/blog/event-sourcing-explained-2025)

### Master Data Management & Graph Databases
- [Graph Database for Master Data Management - Neo4j](https://neo4j.com/use-cases/master-data-management/)
- [Knowledge Graph and Master Data Management - Apptad](https://apptad.com/blogs/knowledge-graph-and-master-data-management-transforming-enterprise-data-architecture/)
- [Manufacturing Master Data Management - Verdantis](https://www.verdantis.com/manufacturing-master-data/)
- [The Data That Goes Into a Manufacturing Data Hub - Rhize](https://rhize.com/blog/the-data-that-goes-into-a-manufacturing-data-hub/)

### Real-Time Dashboard Patterns
- [Materialized View Pattern - Azure Architecture Center](https://learn.microsoft.com/en-us/azure/architecture/patterns/materialized-view)
- [Live Projections for Read Models - Kurrent.io](https://www.kurrent.io/blog/live-projections-for-read-models-with-event-sourcing-and-cqrs)
- [Event Sourcing Database Architecture - RedPanda](https://www.redpanda.com/guides/event-stream-processing-event-sourcing-database)

---

## Open Questions

1. **Alarm state machine lifecycle**: Is alarm acknowledgment/escalation a candidate for ES? (Likely YES — see counterpart report)
2. **Configuration approval workflows**: Would regulated environments require ES for config changes?
3. **Data lineage tracking**: Should data provenance from sensor to analytics use ES?

---

*Report generated by Oracle Agent for architectural decision support.*
