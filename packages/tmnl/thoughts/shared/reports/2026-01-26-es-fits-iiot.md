# Where Event Sourcing FITS in IIoT

**Generated:** 2026-01-26
**Author:** Oracle Agent (Research Synthesis)

## Executive Summary

Event sourcing is a natural fit for Industrial IoT domains where **state transitions represent business decisions** subject to regulatory audit. Alarm lifecycle management, work order approvals, and equipment state changes all exhibit the characteristics that make ES compelling: irreversible decisions by accountable humans, compliance requirements for immutable history, and operational needs for temporal replay ("what happened at T?"). The existing codebase already models alarm state transitions explicitly - ES would formalize what is already implicit.

---

## Domain Analysis

### 1. Alarm Lifecycle

#### Why ES Fits: State Transitions Are Business Decisions

Alarm management is fundamentally about **decision capture**. When an operator acknowledges an alarm, that is not merely a data update - it is an assertion: "I, a qualified human, have seen this condition and take responsibility for the response." When an alarm is cleared, that is another assertion: "The condition has resolved and I attest to this fact."

These are the exact characteristics that event sourcing was designed to preserve:

| Characteristic | Alarm Lifecycle | ES Fit |
|----------------|-----------------|--------|
| **Irreversibility** | Once acknowledged, cannot be un-acknowledged | Append-only preserves |
| **Accountability** | `acknowledgedBy` field tracks who decided | Events capture actor |
| **Temporal significance** | When acknowledged matters for SLAs | Event timestamps are first-class |
| **Causality** | Alarm triggered by sensor reading | Event chains capture causality |

#### Evidence from Codebase

The existing `AlarmService.ts` (lines 311-356) already implements state machine semantics:

```typescript
// AlarmService.ts:318-320
const alarm = yield* getAlarm(alarmId)
if (alarm.acknowledgedAt) {
  return yield* Effect.fail(new AlarmAlreadyAcknowledgedError({ alarmId }))
}
```

This guard against double-acknowledgment is exactly the kind of invariant enforcement that ES makes explicit through event validation. The current UPDATE-based approach works, but:

1. **History is lost** - Only current state survives; when was the original trigger?
2. **Replay is impossible** - Cannot answer "show me all state transitions for ALM-123"
3. **Audit is partial** - The `acknowledgedAt` timestamp exists, but what about rejected acknowledgments, failed clearances?

The `AlarmLifecycleWorkflow.ts` goes further, modeling the lifecycle as explicit workflow states:

```typescript
// AlarmLifecycleWorkflow.ts:117-122
export const AlarmLifecycleResult = Schema.Struct({
  alarm: Alarm,
  outcome: Schema.Literal('acknowledged', 'auto_cleared', 'escalated'),
  processingTimeMs: Schema.Number,
})
```

This is event sourcing vocabulary emerging organically. The `outcome` field is essentially an event type.

#### Industry Grounding: ISA-18.2 Compliance

The ISA-18.2 standard for alarm management explicitly requires monitoring, assessment, and auditing capabilities. According to [ISA-TR18.2.5-2012](https://www.isa.org/standards-and-publications/isa-standards/find-isa-standards-by-topic):

> "Monitoring, assessment, and audit are essential to achieving and maintaining the performance objectives of the alarm system."

Event sourcing provides these capabilities inherently:

| ISA-18.2 Requirement | ES Implementation |
|---------------------|-------------------|
| Alarm rates over time | Aggregate projection counting events |
| Response time analysis | Time delta between trigger and acknowledge events |
| Nuisance alarm identification | Pattern detection over event history |
| Operator action audit | Complete event trail per alarm |

Modern SCADA platforms like [PcVue](https://www.pcvue.com/resource/pcvue-scada-compliance-with-isa-18-2-alarm-management-standard-2/) embed ISA-18.2 principles directly. ES is the architectural pattern that makes this possible.

---

### 2. Work Orders / Maintenance Management

#### Why ES Fits: Approval Workflows Require Audit Trails

A work order in a CMMS (Computerized Maintenance Management System) undergoes a defined lifecycle:

```
DRAFT → SUBMITTED → APPROVED → IN_PROGRESS → COMPLETED → CLOSED
                  ↘ REJECTED
```

Each transition is a business decision with accountability:

| Transition | Actor | Audit Requirement |
|------------|-------|-------------------|
| Submit | Requester | Who requested, when, why |
| Approve/Reject | Supervisor | Who approved, authorization level |
| Start | Technician | Who took ownership |
| Complete | Technician | What was done, parts used |
| Close | Manager | Final sign-off |

According to [BuildOps CMMS Workflow](https://buildops.com/resources/cmms-workflow/):

> "Following the review, a work order is created. This document contains critical information such as the problem description, the resources needed, and the assigned maintenance personnel."

And from [eMaint](https://www.emaint.com/what-is-a-cmms/work-order-software/):

> "eMaint's audit trail tracks approvals and user changes and stores electronic signatures so that your information is ready when you need it."

**This IS event sourcing** - they just don't call it that. The audit trail IS the event log. Making it explicit via ES provides:

1. **Complete reconstruction** - Regenerate work order state at any point in time
2. **Compliance readiness** - Auditors can see the full decision chain
3. **Dispute resolution** - "Who approved this unauthorized maintenance?"

#### Pattern: Command -> Event -> State Change

```typescript
// Conceptual work order events
type WorkOrderEvent =
  | { type: 'WorkOrderCreated'; payload: CreateWorkOrderPayload; actor: UserId; timestamp: DateTime }
  | { type: 'WorkOrderSubmitted'; workOrderId: WorkOrderId; actor: UserId; timestamp: DateTime }
  | { type: 'WorkOrderApproved'; workOrderId: WorkOrderId; actor: UserId; approvalLevel: number; timestamp: DateTime }
  | { type: 'WorkOrderRejected'; workOrderId: WorkOrderId; actor: UserId; reason: string; timestamp: DateTime }
  | { type: 'WorkOrderStarted'; workOrderId: WorkOrderId; technician: UserId; timestamp: DateTime }
  | { type: 'WorkOrderCompleted'; workOrderId: WorkOrderId; technician: UserId; notes: string; partsUsed: Part[]; timestamp: DateTime }
  | { type: 'WorkOrderClosed'; workOrderId: WorkOrderId; manager: UserId; timestamp: DateTime }
```

The current codebase has schemas for assets (`assets.ts`) but not yet work orders. When work orders are added, ES should be the default pattern.

---

### 3. Equipment State Changes

#### Why ES Fits: Diagnostic Replay and Root Cause Analysis

Equipment in IIoT systems transitions through operational states:

```
OPERATIONAL → DEGRADED → FAULTED → STOPPED
            ↘ MAINTENANCE_MODE
```

According to [MachineMetrics](https://www.machinemetrics.com/blog/machine-timeline):

> "Timeline helps identify specific causes of problems and patterns in performance by providing a detailed overview of machine operations, including running and idle times, production output, downtime categorization, and alarms."

And from [AWS IoT SiteWise](https://aws.amazon.com/blogs/iot/create-insights-by-contextualizing-industrial-equipment-data-using-aws-iot-sitewise-part-1/):

> "The dashboard uses timeline widgets to visualize current and previous state transitions."

The existing `AlarmService.ts` already provides root cause context (lines 414-443):

```typescript
// AlarmService.ts:414-418
const getAlarmContext = (
  alarmId: AlarmId,
  windowMs: number = 5 * 60 * 1000 // 5 minutes
): Effect.Effect<AlarmContext[], AlarmNotFoundError | IIoTQueryError> =>
```

This `getAlarmContext` function answers "what sensor readings surrounded this alarm?" - a temporal query. But it works backwards from the alarm. With ES, you can also work forwards:

> "Show me all alarms that occurred within 5 minutes of equipment entering DEGRADED state"

#### Pattern: Temporal Queries

Event sourcing enables temporal queries that CRUD cannot:

| Query | CRUD Approach | ES Approach |
|-------|---------------|-------------|
| "State at time T?" | No direct support | Replay events to T |
| "What changed between T1 and T2?" | Diff snapshots (if saved) | Filter events in range |
| "How long in each state?" | Calculate from transitions (lossy) | Aggregate over events |
| "What led to this failure?" | Hope you logged it | Event chain is the log |

---

### 4. Compliance & Audit

#### FDA 21 CFR Part 11 Requirements

[FDA 21 CFR Part 11](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11) governs electronic records in FDA-regulated industries. According to [SimplerQMS](https://simplerqms.com/21-cfr-part-11-audit-trail/):

> "The regulation requires the use of secure, computer-generated, time-stamped audit trails to independently record the date and time of operator entries and actions that create, modify, or delete electronic records. **Record changes shall not obscure previously recorded information.**"

This is the defining characteristic of event sourcing: **append-only, immutable history**. CRUD systems must bolt on audit logs; ES systems ARE audit logs.

Key requirements from [IntuitionLabs](https://intuitionlabs.ai/articles/audit-trails-21-cfr-part-11-annex-11-compliance):

| Requirement | ES Implementation |
|-------------|-------------------|
| Time-stamped entries | Every event has a timestamp |
| Operator identification | Every event has an actor field |
| Immutability | Append-only event store |
| Prior value preservation | Events contain deltas, not overwrites |
| Retention | Event store naturally retains history |

#### Consequences of Non-Compliance

From [MasterControl](https://www.mastercontrol.com/resource-center/documents/21-cfr-part-11-compliance-requirements/):

> "Non-compliance can lead to FDA Form 483 observations, Warning Letters, product approval delays or holds, import alerts, and even consent decrees or civil penalties."

Event sourcing is not just a nice-to-have - it is regulatory risk mitigation.

#### ISA-95 and Manufacturing Operations

[ISA-95](https://www.isa.org/standards-and-publications/isa-standards/isa-95-standard) defines manufacturing operations management across production, maintenance, quality, and inventory. According to the [ISA-95 OPC Foundation reference](https://reference.opcfoundation.org/ISA-95/v100/docs/4.2):

> "An operations event producer (publisher) does not have to know about the subscribing operations event consumers (receivers)... Real-time messages interoperate across existing heterogeneous messaging and system implementations."

This event-driven architecture is complementary to event sourcing. The events published to subscribers can simultaneously be persisted to an event store, creating a unified model for real-time operations AND historical audit.

---

## Recommended ES Boundaries

| Domain | ES? | Rationale |
|--------|-----|-----------|
| **Alarms** | YES | State transitions are decisions; ISA-18.2 mandates audit; existing code already models as state machine |
| **Work Orders** | YES | Approval workflows need accountability; CMMS systems already implement audit trails |
| **Equipment Status** | YES | Temporal queries for diagnostics; OEE calculations need state duration |
| **Maintenance Schedules** | YES | Who approved? Who modified? Compliance requirement |
| **User Actions** | YES | Operator decisions are the essence of ES |
| **Batch Records** | YES | FDA 21 CFR Part 11 explicitly requires immutable audit |
| **Quality Events** | YES | Non-conformance investigation requires full history |

---

## Implementation Sketch: EventLog.group for Alarms

Using Effect's `EventLog` pattern, alarm event sourcing would look like:

```typescript
import { EventLog, Schema } from 'effect'

// Event definitions
const AlarmTriggered = Schema.TaggedClass<AlarmTriggered>()('AlarmTriggered', {
  alarmId: AlarmId,
  deviceId: DeviceId,
  alarmType: AlarmType,
  severity: AlarmSeverity,
  triggeredAt: Schema.DateTimeUtc,
  sensorReading: Schema.optional(Schema.Number),
})

const AlarmAcknowledged = Schema.TaggedClass<AlarmAcknowledged>()('AlarmAcknowledged', {
  alarmId: AlarmId,
  acknowledgedBy: Schema.String,
  acknowledgedAt: Schema.DateTimeUtc,
  notes: Schema.optional(Schema.String),
})

const AlarmCleared = Schema.TaggedClass<AlarmCleared>()('AlarmCleared', {
  alarmId: AlarmId,
  clearedAt: Schema.DateTimeUtc,
  resolution: Schema.optional(Schema.String),
})

const AlarmEscalated = Schema.TaggedClass<AlarmEscalated>()('AlarmEscalated', {
  alarmId: AlarmId,
  escalatedTo: Schema.String,
  escalatedAt: Schema.DateTimeUtc,
  reason: Schema.String,
})

// Event union
const AlarmEvent = Schema.Union(
  AlarmTriggered,
  AlarmAcknowledged,
  AlarmCleared,
  AlarmEscalated
)

// Event log group
const AlarmEventLog = EventLog.group(AlarmEvent, {
  // Aggregate: fold events into current alarm state
  aggregate: (events) => events.reduce(
    (alarm, event) => {
      switch (event._tag) {
        case 'AlarmTriggered':
          return { ...event, status: 'active' as const }
        case 'AlarmAcknowledged':
          return { ...alarm, acknowledgedAt: event.acknowledgedAt, acknowledgedBy: event.acknowledgedBy, status: 'acknowledged' as const }
        case 'AlarmCleared':
          return { ...alarm, clearedAt: event.clearedAt, status: 'cleared' as const }
        case 'AlarmEscalated':
          return { ...alarm, escalatedTo: event.escalatedTo, status: 'escalated' as const }
      }
    },
    null as Alarm | null
  ),
  
  // Invariants: business rules that prevent invalid transitions
  invariants: {
    cannotAcknowledgeCleared: (alarm, event) =>
      event._tag === 'AlarmAcknowledged' && alarm?.status === 'cleared'
        ? Effect.fail(new AlarmAlreadyClearedError({ alarmId: event.alarmId }))
        : Effect.void,
    cannotDoubleAcknowledge: (alarm, event) =>
      event._tag === 'AlarmAcknowledged' && alarm?.acknowledgedAt !== undefined
        ? Effect.fail(new AlarmAlreadyAcknowledgedError({ alarmId: event.alarmId }))
        : Effect.void,
  }
})
```

### Queries Enabled by ES

```typescript
// Temporal query: alarm state at specific time
const alarmAtTime = (alarmId: AlarmId, asOf: DateTime) =>
  AlarmEventLog.replayTo(alarmId, asOf)

// Analytics: mean time to acknowledge
const mtaByPriority = 
  AlarmEventLog.query(
    Stream.filter(e => e._tag === 'AlarmAcknowledged'),
    // ... aggregate by priority, calculate average
  )

// Compliance: all operator actions in time range
const operatorAudit = (userId: string, since: DateTime, until: DateTime) =>
  AlarmEventLog.query(
    Stream.filter(e => 
      'acknowledgedBy' in e && e.acknowledgedBy === userId &&
      DateTime.greaterThanOrEqualTo(e.acknowledgedAt, since) &&
      DateTime.lessThanOrEqualTo(e.acknowledgedAt, until)
    )
  )
```

---

## Sources

1. [ISA-18.2 Alarm Management Standard](https://www.isa.org/intech-home/2016/may-june/departments/isa18-alarm-management-standard-updated) - Standard foundation for alarm lifecycle
2. [FDA 21 CFR Part 11](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-A/part-11) - Electronic records regulation
3. [21 CFR Part 11 Audit Trail Requirements](https://simplerqms.com/21-cfr-part-11-audit-trail/) - Audit trail interpretation
4. [ISA-95 Standard](https://www.isa.org/standards-and-publications/isa-standards/isa-95-standard) - Enterprise-control integration
5. [Event Sourcing Pattern - Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing) - Pattern definition
6. [Event Sourcing - Martin Fowler](https://martinfowler.com/eaaDev/EventSourcing.html) - Original pattern description
7. [CMMS Workflow - BuildOps](https://buildops.com/resources/cmms-workflow/) - Work order lifecycle
8. [eMaint Work Order Software](https://www.emaint.com/what-is-a-cmms/work-order-software/) - CMMS audit capabilities
9. [MachineMetrics Timeline](https://www.machinemetrics.com/blog/machine-timeline) - Equipment state visualization
10. [AWS IoT SiteWise](https://aws.amazon.com/blogs/iot/create-insights-by-contextualizing-industrial-equipment-data-using-aws-iot-sitewise-part-1/) - Industrial IoT contextualization
11. [PcVue ISA-18.2 Compliance](https://www.pcvue.com/resource/pcvue-scada-compliance-with-isa-18-2-alarm-management-standard-2/) - SCADA alarm management
12. [Automating Audit Trail Compliance](https://intuitionlabs.ai/articles/audit-trails-21-cfr-part-11-annex-11-compliance) - Compliance automation

---

## Codebase References

| File | Relevance |
|------|-----------|
| `src/lib/iiot/services/l2/AlarmService.ts` | Current alarm CRUD - shows state transitions |
| `src/lib/iiot/schemas/alarms.ts` | Alarm schema with state fields |
| `src/lib/iiot/workflow/AlarmLifecycleWorkflow.ts` | Durable workflow modeling alarm states |
| `src/lib/iiot/entity/AlarmEntity.ts` | Entity with state machine guards |
| `src/lib/iiot/schemas/errors.ts` | Business rule violations as typed errors |
| `src/lib/iiot/schemas/assets.ts` | Asset hierarchy (equipment state domain) |

---

## Summary

Event sourcing is not merely compatible with IIoT domains - it is **the natural architecture** for systems where:

1. **Decisions matter more than data** - Operator acknowledgments, approvals, state transitions
2. **Regulations demand audit** - FDA, ISA, ISO compliance requirements
3. **Time is a first-class dimension** - Temporal queries, root cause analysis, SLA measurement
4. **History cannot be rewritten** - Immutable audit trails, dispute resolution

The existing codebase already exhibits event sourcing patterns implicitly (`AlarmAlreadyAcknowledgedError`, outcome literals, durable workflows). Making ES explicit via `EventLog.group` would formalize these patterns, unlock temporal queries, and provide compliance-ready audit trails out of the box.
