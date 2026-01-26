# ADR-0012: Event Sourcing Boundaries in IIoT Domain

**Status:** Accepted
**Date:** 2026-01-26
**Deciders:** Prime, Val (Architecture Council)
**Context:** v3 Service Architecture

---

## Context

The v3 architecture council debated whether to adopt event sourcing (ES) for the IIoT domain. Initial recommendation was "dual-write with SQL as truth, events for audit." However, this binary framing obscured a more nuanced reality: **some IIoT sub-domains are natural fits for ES, while others are actively harmed by it.**

This ADR establishes clear boundaries based on:
- Research into ISA-95, ISA-18.2, FDA 21 CFR Part 11 standards
- Analysis of existing codebase patterns
- Industry best practices for IIoT data management

---

## Decision

**Adopt a hybrid persistence strategy with explicit ES boundaries.**

### The Litmus Test

> **"Would replaying the events teach us something about business decisions?"**

- **YES** → Event source it
- **NO** → CRUD it (or use purpose-built storage)

### Event Sourcing Boundary Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        IIoT PERSISTENCE BOUNDARIES                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐    ┌─────────────────────────────────────┐│
│  │     EVENT SOURCED (ES)      │    │         NOT EVENT SOURCED           ││
│  │   "Decisions & Audit"       │    │       "Data & Reference"            ││
│  ├─────────────────────────────┤    ├─────────────────────────────────────┤│
│  │                             │    │                                     ││
│  │  • Alarm Lifecycle          │    │  • Sensor Telemetry                 ││
│  │    - Triggered              │    │    → TimescaleDB hypertables        ││
│  │    - Acknowledged           │    │                                     ││
│  │    - Cleared                │    │  • Equipment Hierarchy              ││
│  │    - Escalated              │    │    → Apache AGE graph + CRUD        ││
│  │                             │    │                                     ││
│  │  • Work Orders              │    │  • Device Configuration             ││
│  │    - Created                │    │    → CRUD + audit log table         ││
│  │    - Submitted              │    │                                     ││
│  │    - Approved/Rejected      │    │  • Real-time Dashboard State        ││
│  │    - Started                │    │    → Materialized views             ││
│  │    - Completed              │    │                                     ││
│  │    - Closed                 │    │  • Continuous Aggregates            ││
│  │                             │    │    → TimescaleDB rollups            ││
│  │  • Equipment State Changes  │    │                                     ││
│  │    - Operational→Degraded   │    │  • Master Data (Sites, Plants)      ││
│  │    - Degraded→Faulted       │    │    → CRUD tables                    ││
│  │    - Maintenance Mode       │    │                                     ││
│  │                             │    │                                     ││
│  │  • Batch Records            │    │                                     ││
│  │  • Quality Events           │    │                                     ││
│  │  • Operator Actions         │    │                                     ││
│  │                             │    │                                     ││
│  └─────────────────────────────┘    └─────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### ISA-95 Activity Model Alignment

The ISA-95 standard's activity model naturally expresses this boundary:

```
Definition → Capability → Schedule → Request → Response → Performance
└──────────────────────────────────┘ └────────────────────────────────┘
        REFERENCE DATA (CRUD)              DECISIONS (Event Sourced)
```

- **Definitions & Capabilities**: What CAN happen (static, CRUD)
- **Requests & Responses**: What DID happen (decisions, ES)

---

## Domain Analysis

### Domains FOR Event Sourcing

| Domain | Rationale | Regulatory Grounding |
|--------|-----------|---------------------|
| **Alarm Lifecycle** | State transitions are operator decisions with accountability | ISA-18.2 mandates audit trail |
| **Work Orders** | Approval workflows require full decision chain | CMMS best practices |
| **Equipment State** | Temporal queries for RCA ("what led to failure?") | OEE calculations |
| **Batch Records** | Immutable production history | FDA 21 CFR Part 11 |
| **Quality Events** | Non-conformance investigation | ISO 9001 requirements |
| **Operator Actions** | Who did what when | General compliance |

**Characteristics that indicate ES fit:**
- Irreversible decisions by accountable humans
- Regulatory requirements for immutable history
- Need for temporal queries ("state at time T?")
- Causality chains matter ("what caused this?")

### Domains AGAINST Event Sourcing

| Domain | Rationale | Better Pattern |
|--------|-----------|----------------|
| **Sensor Telemetry** | Raw observations, not decisions; massive volume | TimescaleDB hypertables |
| **Equipment Hierarchy** | Reference data; graph traversal, not temporal | Apache AGE + CRUD |
| **Device Configuration** | Simple key-value settings | CRUD + audit log |
| **Dashboard State** | Need current state fast; latency-critical | Materialized views |
| **Master Data** | Rarely changes; current state matters | Normalized tables |

**Characteristics that indicate ES is wrong:**
- High-volume raw data without semantic meaning
- No business decision attached to each write
- "Current state" query is trivial (latest value)
- Replay would be meaningless or computationally absurd

---

## Implementation

### Effect EventLog for ES Domains

```typescript
import { EventLog, Schema } from 'effect'

// Alarm events
const AlarmTriggered = Schema.TaggedStruct('AlarmTriggered', {
  alarmId: AlarmId,
  deviceId: DeviceId,
  severity: AlarmSeverity,
  triggeredAt: Schema.DateTimeUtc,
})

const AlarmAcknowledged = Schema.TaggedStruct('AlarmAcknowledged', {
  alarmId: AlarmId,
  acknowledgedBy: Schema.String,
  acknowledgedAt: Schema.DateTimeUtc,
})

const AlarmCleared = Schema.TaggedStruct('AlarmCleared', {
  alarmId: AlarmId,
  clearedAt: Schema.DateTimeUtc,
})

const AlarmEvent = Schema.Union(AlarmTriggered, AlarmAcknowledged, AlarmCleared)

// Event log with aggregate projection
const AlarmEventLog = EventLog.group(AlarmEvent, {
  aggregate: (events) => events.reduce((alarm, event) => {
    switch (event._tag) {
      case 'AlarmTriggered':
        return { ...event, status: 'active' as const }
      case 'AlarmAcknowledged':
        return { ...alarm, ...event, status: 'acknowledged' as const }
      case 'AlarmCleared':
        return { ...alarm, ...event, status: 'cleared' as const }
    }
  }, null as Alarm | null)
})
```

### SQL + Audit Log for Non-ES Domains

```typescript
// Device configuration - CRUD with audit
const updateDeviceConfig = (deviceId: DeviceId, config: DeviceConfig) =>
  Effect.gen(function* () {
    const previous = yield* getDeviceConfig(deviceId)

    // Update current state (CRUD)
    yield* sql`
      UPDATE iiot.device_config
      SET sampling_rate = ${config.samplingRate},
          alarm_threshold = ${config.alarmThreshold},
          updated_at = NOW()
      WHERE device_id = ${deviceId}
    `

    // Audit log (NOT event sourcing - just history)
    yield* sql`
      INSERT INTO iiot.config_audit_log (device_id, field, old_value, new_value, changed_by, changed_at)
      SELECT ${deviceId}, key, old.value, new.value, ${userId}, NOW()
      FROM jsonb_each_text(${previous}::jsonb) old
      FULL OUTER JOIN jsonb_each_text(${config}::jsonb) new USING (key)
      WHERE old.value IS DISTINCT FROM new.value
    `
  })
```

### TimescaleDB for Telemetry

```typescript
// Sensor readings - hypertable with continuous aggregates
const insertReading = (reading: SensorReading) =>
  sql`
    INSERT INTO iiot.sensor_readings (time, device_id, value, quality)
    VALUES (${reading.time}, ${reading.deviceId}, ${reading.value}, ${reading.quality})
  `

// Pre-aggregated rollups (NOT events)
// CREATE MATERIALIZED VIEW readings_1min WITH (timescaledb.continuous) AS
// SELECT time_bucket('1 minute', time), device_id, AVG(value), MIN(value), MAX(value)
// FROM iiot.sensor_readings GROUP BY 1, 2
```

---

## Consequences

### Positive

1. **Right tool for each job** — ES complexity only where it pays off
2. **Regulatory compliance** — Audit trails where regulations demand
3. **Performance** — TimescaleDB for high-volume telemetry, not an event store
4. **Developer clarity** — Clear rules for "should this be evented?"
5. **Incremental adoption** — Start with alarms, expand if successful

### Negative

1. **Two persistence paradigms** — Team must understand both ES and CRUD
2. **Boundary maintenance** — Must revisit as new domains emerge
3. **Integration complexity** — ES domains and CRUD domains must interoperate

### Risks

1. **Boundary creep** — Temptation to event-source everything "just in case"
2. **Stale projections** — ES projections can lag; dashboards need fresh data
3. **EventLog is experimental** — `@effect/experimental` API may change

---

## Alternatives Considered

### 1. Full Event Sourcing Everywhere

**Rejected.** Sensor telemetry at 100K readings/second would produce billions of meaningless "events." Event stores are not time-series databases.

### 2. No Event Sourcing (Dual-Write Only)

**Rejected.** Loses the audit trail and temporal query capabilities that regulatory compliance demands for alarms and work orders.

### 3. CDC-Based Event Capture

**Partially accepted.** CDC (Change Data Capture) from PostgreSQL WAL can supplement ES domains, but should not replace explicit event modeling where business semantics matter.

---

## References

### Standards
- [ISA-95 / IEC 62264](https://www.isa.org/standards-and-publications/isa-standards/isa-95-standard) — Enterprise-control integration
- [ISA-18.2](https://www.isa.org/intech-home/2016/may-june/departments/isa18-alarm-management-standard-updated) — Alarm management
- [FDA 21 CFR Part 11](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11) — Electronic records

### Research Reports
- `thoughts/shared/reports/2026-01-26-es-fits-iiot.md` — ES-appropriate domains
- `thoughts/shared/reports/2026-01-26-es-doesnt-fit-iiot.md` — ES-inappropriate domains
- `thoughts/shared/research/2026-01-26-isa95-standards.md` — ISA-95 reference

### Codebase
- `src/lib/iiot/services/l2/AlarmService.ts` — Current alarm implementation
- `src/lib/iiot/services/l1/TimeSeriesClient.ts` — Telemetry storage
- `src/lib/iiot/services/l1/GraphClient.ts` — Equipment hierarchy

---

## Decision Record

| Date | Decision | Participants |
|------|----------|--------------|
| 2026-01-25 | Initial "no ES" recommendation | Architecture Council |
| 2026-01-26 | Revised to hybrid boundaries | Prime, Val |
| 2026-01-26 | ADR formalized | Val |

---

*"The right question is not 'should we use event sourcing?' but 'where does event sourcing pay its complexity cost?'"*
