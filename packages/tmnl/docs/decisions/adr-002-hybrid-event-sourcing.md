# ADR-002: Hybrid Event Sourcing Strategy

> **Status:** Accepted | **Date:** 2026-01-26 | **Revised:** 2026-02-09
> **Deciders:** Prime, Val (Architecture Council)
> **Sources:** `ADR-0012`, `es-fits-iiot.md`, `es-doesnt-fit-iiot.md`

## Context

The v3 architecture manages ~136 RPCs across 13 entity types. Initial council recommendation was "dual-write with SQL as truth, events for audit." This binary framing obscured a nuanced reality: **some IIoT sub-domains are natural fits for ES, while others are actively harmed by it.**

## Decision

**Adopt a hybrid persistence strategy with explicit ES boundaries.**

### The Litmus Test

> **"Would replaying the events teach us something about business decisions?"**
>
> - **YES** -- Event source it
> - **NO** -- CRUD it (or use purpose-built storage)

### ISA-95 Activity Model Alignment

```
Definition -> Capability -> Schedule -> Request -> Response -> Performance
|_________________________________|    |________________________________|
       REFERENCE DATA (CRUD)                 DECISIONS (Event Sourced)
```

- **Definitions & Capabilities**: What CAN happen (static, CRUD)
- **Requests & Responses**: What DID happen (decisions, ES)

---

## Domain Boundary Map

```
+-------------------------------------------------------------------+
|                    IIoT PERSISTENCE BOUNDARIES                     |
+-------------------------------------------------------------------+
|                                                                    |
|  +---------------------------+  +--------------------------------+ |
|  |     EVENT SOURCED (ES)    |  |       NOT EVENT SOURCED        | |
|  |   "Decisions & Audit"     |  |     "Data & Reference"         | |
|  +---------------------------+  +--------------------------------+ |
|  |                           |  |                                | |
|  | - Alarm Lifecycle         |  | - Sensor Telemetry             | |
|  |   ISA-18.2 mandated       |  |   -> TimescaleDB hypertables   | |
|  |                           |  |                                | |
|  | - Work Orders             |  | - Equipment Hierarchy          | |
|  |   FDA 21 CFR Part 11      |  |   -> Apache AGE graph + CRUD   | |
|  |                           |  |                                | |
|  | - Equipment State Changes |  | - Device Configuration         | |
|  |   OEE diagnostics         |  |   -> CRUD + audit log table    | |
|  |                           |  |                                | |
|  | - Batch Records           |  | - Real-time Dashboard State    | |
|  | - Quality Events          |  |   -> Materialized views        | |
|  | - Operator Actions        |  |                                | |
|  |                           |  | - Continuous Aggregates        | |
|  +---------------------------+  |   -> TimescaleDB rollups       | |
|                                 |                                | |
|                                 | - Master Data (Sites, Plants)  | |
|                                 |   -> CRUD tables               | |
|                                 |                                | |
|                                 | - Alarm Thresholds             | |
|                                 |   -> Config tables             | |
|                                 +--------------------------------+ |
+-------------------------------------------------------------------+
```

---

## Domains FOR Event Sourcing

### Characteristics That Indicate ES Fit

- Irreversible decisions by accountable humans
- Regulatory requirements for immutable history
- Need for temporal queries ("state at time T?")
- Causality chains matter ("what caused this?")

### 1. Alarm Lifecycle (ISA-18.2)

Alarm management is fundamentally about **decision capture**. When an operator acknowledges an alarm, that is not merely a data update -- it is an assertion of responsibility. ISA-18.2 explicitly requires monitoring, assessment, and auditing.

| Characteristic | Alarm Lifecycle | ES Fit |
|----------------|----------------|--------|
| Irreversibility | Once acknowledged, cannot be un-acknowledged | Append-only preserves |
| Accountability | `acknowledgedBy` tracks who decided | Events capture actor |
| Temporal significance | When acknowledged matters for SLAs | Event timestamps are first-class |
| Causality | Alarm triggered by sensor reading | Event chains capture causality |

**ISA-18.2 requirements mapped to ES:**

| ISA-18.2 Requirement | ES Implementation |
|-----------------------|-------------------|
| Alarm rates over time | Aggregate projection counting events |
| Response time analysis | Time delta between trigger and acknowledge events |
| Nuisance alarm identification | Pattern detection over event history |
| Operator action audit | Complete event trail per alarm |

The existing codebase already implements state machine semantics with guards against double-acknowledgment (`AlarmAlreadyAcknowledgedError`). ES formalizes what is already implicit.

### 2. Work Orders (FDA 21 CFR Part 11)

Work order lifecycle transitions are business decisions with accountability:

```
DRAFT -> SUBMITTED -> APPROVED -> IN_PROGRESS -> COMPLETED -> CLOSED
                   \-> REJECTED
```

| Transition | Actor | Audit Requirement |
|------------|-------|-------------------|
| Submit | Requester | Who requested, when, why |
| Approve/Reject | Supervisor | Authorization level |
| Start | Technician | Ownership transfer |
| Complete | Technician | What was done, parts used |
| Close | Manager | Final sign-off |

FDA 21 CFR Part 11 requires: "secure, computer-generated, time-stamped audit trails to independently record the date and time of operator entries and actions that create, modify, or delete electronic records. **Record changes shall not obscure previously recorded information.**" This IS event sourcing.

### 3. Equipment State Changes (OEE)

Equipment transitions through operational states. ES enables temporal queries that CRUD cannot:

| Query | CRUD Approach | ES Approach |
|-------|---------------|-------------|
| "State at time T?" | No direct support | Replay events to T |
| "What changed between T1 and T2?" | Diff snapshots (if saved) | Filter events in range |
| "How long in each state?" | Calculate from transitions (lossy) | Aggregate over events |
| "What led to this failure?" | Hope you logged it | Event chain IS the log |

### 4. Batch Records, Quality Events, Operator Actions

These domains share the same ES-appropriate characteristics: irreversible decisions, regulatory audit requirements, and temporal significance. Batch records in particular are governed by FDA 21 CFR Part 11 immutability requirements.

---

## Domains AGAINST Event Sourcing

### Characteristics That Indicate ES Is Wrong

- High-volume raw data without semantic meaning
- No business decision attached to each write
- "Current state" query is trivial (latest value)
- Replay would be meaningless or computationally absurd

### 1. Sensor Telemetry

Sensor readings are **raw observations**, not business decisions. A temperature reading of 23.5C is not an "event" in the ES sense -- it carries no intent, no decision, no state transition. Publishing `SensorReadingRecorded` for every reading is the **property sourcing anti-pattern**.

**Volume:** Industrial environments generate 100K+ readings/second. TimescaleDB handles this with bulk inserts and columnar compression. An event store would choke.

**Better pattern:** TimescaleDB hypertables with continuous aggregates, automatic data retention, and native compression.

### 2. Equipment Hierarchy

Equipment hierarchies (Enterprise -> Site -> Area -> Line -> Machine -> Sensor) are **reference data** describing factory floor topology. They change rarely, and "current topology" is all that matters.

**Better pattern:** Apache AGE graph database with Cypher queries for traversal. Simple audit log table for change tracking.

### 3. Device Configuration

Sampling rates, calibration offsets, alarm thresholds -- simple key-value settings with no replay value.

**Better pattern:** CRUD tables with optional audit logging. Exception: if configuration *changes* require approval workflows (regulated environments), event-source the *workflow*, not the configuration itself.

### 4. Real-Time Dashboards

Dashboards need **current state, fast**. ES adds projection latency at exactly the wrong place -- between sensor reading and operator response.

**Better pattern:** Direct SQL queries + materialized views. Sub-millisecond vs 10-100ms+ with ES projection.

### 5. Historical Analytics, Alarm Thresholds, Device Registry

Already aggregated (continuous aggregates), simple config, or master data. CRUD with optional audit.

---

## Implementation

### Feature Flag Control

Per-domain feature flags control event emission:

```typescript
// src/lib/iiot/infrastructure/feature-flags.ts
export class IIoTFeatureFlags extends Context.Tag('iiot/FeatureFlags')<
  IIoTFeatureFlags,
  {
    readonly alarmEventSourcing: boolean      // true = full ES
    readonly workOrderEventSourcing: boolean  // true = full ES
    readonly equipmentEventSourcing: boolean  // true = full ES
    readonly batchRecordEventSourcing: boolean // true = full ES
  }
>() {}
```

### Effect EventLog for ES Domains

```typescript
// Alarm event union
const AlarmEvent = Schema.Union(
  AlarmTriggered,
  AlarmAcknowledged,
  AlarmCleared,
  AlarmEscalated
)

// Event log group with aggregate projection
const AlarmEventLog = EventLog.group(AlarmEvent, {
  aggregate: (events) => events.reduce((alarm, event) => {
    switch (event._tag) {
      case 'AlarmTriggered':
        return { ...event, status: 'active' as const }
      case 'AlarmAcknowledged':
        return { ...alarm, ...event, status: 'acknowledged' as const }
      case 'AlarmCleared':
        return { ...alarm, ...event, status: 'cleared' as const }
      case 'AlarmEscalated':
        return { ...alarm, ...event, status: 'escalated' as const }
    }
  }, null as Alarm | null)
})
```

### Non-Blocking Event Emission for Non-ES Domains

```typescript
// src/lib/iiot/entity/_helpers.ts
export const maybeEmitAssetEvent = (event: AssetEvent) =>
  Effect.gen(function* () {
    const flags = yield* IIoTFeatureFlags
    if (!flags.assetEventEmission) return
    yield* EventLog.append(event).pipe(Effect.ignoreLogged)
  })
```

Failures are logged but never block the primary mutation path.

### SQL + Audit Log for Non-ES Domains

```typescript
const updateDeviceConfig = (deviceId: DeviceId, config: DeviceConfig) =>
  Effect.gen(function* () {
    const previous = yield* getDeviceConfig(deviceId)
    // Update current state (CRUD)
    yield* sql`UPDATE iiot.device_config SET ... WHERE device_id = ${deviceId}`
    // Audit log (NOT event sourcing -- just history)
    yield* sql`INSERT INTO iiot.config_audit_log ...`
  })
```

### TimescaleDB for Telemetry

```sql
-- Hypertable with continuous aggregates
CREATE MATERIALIZED VIEW readings_1min WITH (timescaledb.continuous) AS
SELECT time_bucket('1 minute', time), device_id, AVG(value), MIN(value), MAX(value)
FROM iiot.sensor_readings GROUP BY 1, 2;
```

---

## Consequences

### Positive

1. **Right tool for each job** -- ES complexity only where it pays off
2. **Regulatory compliance** -- Audit trails where regulations demand (ISA-18.2, FDA 21 CFR Part 11)
3. **Performance** -- TimescaleDB for high-volume telemetry, not an event store
4. **Developer clarity** -- Clear litmus test for "should this be evented?"
5. **Incremental adoption** -- Feature flags allow per-domain ES migration without big-bang
6. **Non-blocking emission** -- Event emission failures never block mutations for non-ES domains

### Negative

1. **Two persistence paradigms** -- Team must understand both ES and CRUD
2. **Boundary maintenance** -- Must revisit as new domains emerge
3. **Integration complexity** -- ES domains and CRUD domains must interoperate

### Risks

1. **Boundary creep** -- Temptation to event-source everything "just in case"
2. **Stale projections** -- ES projections can lag; dashboards need fresh data
3. **EventLog is experimental** -- `@effect/experimental` API may change

---

## Summary Table

| Domain | ES? | Strategy | Regulatory Grounding | Storage |
|--------|-----|----------|---------------------|---------|
| **Alarms** | YES | Full ES | ISA-18.2 audit trail | EventLog |
| **Work Orders** | YES | Full ES | FDA 21 CFR Part 11 | EventLog |
| **Equipment State** | YES | Full ES | OEE calculations | EventLog |
| **Batch Records** | YES | Full ES | FDA 21 CFR Part 11 | EventLog |
| **Quality Events** | YES | Full ES | ISO 9001 | EventLog |
| **Operator Actions** | YES | Full ES | General compliance | EventLog |
| ISA-95 Assets (9 types) | NO | Direct mutation + optional events | None | State Service |
| Sensor Telemetry | NO | Time-series | None | TimescaleDB |
| Equipment Hierarchy | NO | Graph traversal | None | Apache AGE |
| Device Configuration | NO | Key-value CRUD | None | SQL tables |
| Dashboard State | NO | Materialized views | None | PostgreSQL views |
| Analytics/Aggregates | NO | Continuous aggregates | None | TimescaleDB rollups |

---

## Alternatives Considered

### 1. Full Event Sourcing Everywhere

**Rejected.** Sensor telemetry at 100K readings/second would produce billions of meaningless "events." Event stores are not time-series databases.

### 2. No Event Sourcing (Dual-Write Only)

**Rejected.** Loses audit trail and temporal query capabilities that regulatory compliance demands for alarms and work orders.

### 3. CDC-Based Event Capture

**Partially accepted.** CDC from PostgreSQL WAL can supplement ES domains but should not replace explicit event modeling where business semantics matter.

---

## References

### Regulatory Standards
- ISA-95 / IEC 62264 -- Enterprise-control integration
- ISA-18.2 -- Alarm management
- FDA 21 CFR Part 11 -- Electronic records
- ISO 9001 -- Quality management

### Source Documents
- `assets/documents/iiot/ADR-0012-event-sourcing-boundaries-iiot.md`
- `thoughts/shared/reports/2026-01-26-es-fits-iiot.md`
- `thoughts/shared/reports/2026-01-26-es-doesnt-fit-iiot.md`

### Codebase
- `src/lib/iiot/infrastructure/feature-flags.ts` -- Feature flag definitions
- `src/lib/iiot/entity/_helpers.ts` -- `maybeEmitAssetEvent` helper
- `src/lib/iiot/entity/AlarmEntity.ts` -- Alarm ES implementation
- `src/lib/iiot/entity/WorkOrderEntity.ts` -- Work order ES implementation
- `src/lib/iiot/entity/EquipmentStateEntity.ts` -- Equipment state ES implementation
