# Epic 8: Alarm Domain Event Sourcing (Expanded)

**Generated:** 2026-01-29
**Author:** Kraken Agent (TDD Implementation)
**Source Documents:**
- `2026-01-26-v3-service-architecture-wbs.md` (Epic 8 baseline)
- `2026-01-29-eventlog-integration-wbs-final.md` (Epic EL-2)
- `eventlog-iiot-architecture.md` (Event schemas + ISA-18.2 requirements)

---

## Overview

**Goal:** ISA-18.2 compliant alarm lifecycle with full audit trail via EventLog
**Story Points:** 25 SP (expanded from 13 SP, +4 SP for Fact integration)
**Sprints:** 2-3

### Key Deliverables

1. **10 Alarm Event Schemas** - Full ISA-18.2 lifecycle coverage
2. **Event Handlers** - Projection updates on event writes
3. **Reactivity Bindings** - Atom invalidation for real-time UI
4. **Temporal Queries** - Point-in-time state reconstruction
5. **Feature Flag** - `ES_ALARM_ENABLED` for safe rollback

---

## Event Catalog

| Event | Payload Fields | Purpose | ISA-18.2 Requirement |
|-------|---------------|---------|----------------------|
| `AlarmTriggered` | alarmId, deviceId, assetId, alarmType, severity, message, triggerValue, thresholdValue, triggeredAt, qualityCode, metadata | Initial alarm activation | Alarm point activation |
| `AlarmAcknowledged` | alarmId, acknowledgedBy, acknowledgedAt, comments | Operator acknowledgment | Acknowledgment recording |
| `AlarmCleared` | alarmId, clearedAt, clearValue, autoClear | Condition resolved | Return to normal |
| `AlarmEscalated` | alarmId, escalatedAt, escalationLevel, escalatedTo, elapsedSeconds, reason | No response escalation | Escalation tracking |
| `AlarmShelved` | alarmId, shelvedBy, shelvedAt, shelvedUntil, reason | Temporary suppression | Shelving with time limit |
| `AlarmUnshelved` | alarmId, unshelvedAt, autoUnshelve, unshelvedBy | Shelve period ended | Shelve expiration |
| `AlarmSuppressed` | alarmId, suppressedBy, suppressedAt, reason, workOrderId | Design-level suppression | Suppression audit |
| `AlarmOutOfService` | alarmId, disabledBy, disabledAt, reason, workOrderId, expectedReturnAt | Maintenance mode | Out-of-service tracking |
| `AlarmReturnedToService` | alarmId, enabledBy, enabledAt, outOfServiceDuration | Back online | Return to service |
| `AlarmConfigChanged` | alarmId, changedBy, changedAt, previousSeverity, newSeverity, previousThreshold, newThreshold, reason | Setpoint/config updates | Configuration audit |

---

## Section 8.0: Pre-Mortem Mitigations

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 8.0.1 | Create `ES_ALARM_ENABLED` feature flag in IIoTConfig | `config/IIoTConfig.ts` | S | - |
| 8.0.2 | Add flag check to AlarmService for rollback capability | `services/l2/AlarmService.ts` | M | 8.0.1 |
| 8.0.3 | Document rollback procedure in AGENTS.md | `AGENTS.ALARM_ES.md` | S | 8.0.2 |

### Acceptance Criteria (Section 8.0)
- [ ] Feature flag defaults to `false` in production
- [ ] AlarmService methods check flag: `ES_ALARM_ENABLED ? emitEvent() : directCRUD()`
- [ ] Rollback procedure documented and tested

---

## Section 8.1: Event Schemas

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 8.1.1 | Define `AlarmTriggeredPayload` schema | `schemas/events/alarm-events.ts` | M | Epic 7, 8.0.2 |
| 8.1.2 | Define `AlarmAcknowledgedPayload` schema | `schemas/events/alarm-events.ts` | S | 8.1.1 |
| 8.1.3 | Define `AlarmClearedPayload` schema | `schemas/events/alarm-events.ts` | S | 8.1.1 |
| 8.1.4 | Define `AlarmEscalatedPayload` schema | `schemas/events/alarm-events.ts` | S | 8.1.1 |
| 8.1.5 | Define `AlarmShelvedPayload` schema | `schemas/events/alarm-events.ts` | S | 8.1.1 |
| 8.1.6 | Define `AlarmUnshelvedPayload` schema | `schemas/events/alarm-events.ts` | S | 8.1.1 |
| 8.1.7 | Define `AlarmSuppressedPayload` schema | `schemas/events/alarm-events.ts` | S | 8.1.1 |
| 8.1.8 | Define `AlarmOutOfServicePayload` schema | `schemas/events/alarm-events.ts` | S | 8.1.1 |
| 8.1.9 | Define `AlarmReturnedToServicePayload` schema | `schemas/events/alarm-events.ts` | S | 8.1.1 |
| 8.1.10 | Define `AlarmConfigChangedPayload` schema | `schemas/events/alarm-events.ts` | S | 8.1.1 |
| 8.1.11 | Create `AlarmEvents` EventGroup with primaryKey | `schemas/events/alarm-events.ts` | M | 8.1.1-10 |
| 8.1.12 | Export `AlarmEvent` type union | `schemas/events/alarm-events.ts` | S | 8.1.11 |
| 8.1.13 | Unit test: schema encode/decode roundtrip | `__tests__/schemas/alarm-events.test.ts` | M | 8.1.11 |

### Acceptance Criteria (Section 8.1)
- [ ] All 10 event payloads use `Schema.Class` pattern
- [ ] Each event has `primaryKey: (p) => p.alarmId` for routing
- [ ] ISA-18.2 required fields present (reason on shelve/suppress, timestamps)
- [ ] Schema roundtrip tests pass for all events

---

## Section 8.2: State Aggregation

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 8.2.1 | Define `AlarmAggregate` interface | `schemas/events/alarm-aggregate.ts` | M | 8.1.11 |
| 8.2.2 | Define `initialAlarmAggregate()` factory | `schemas/events/alarm-aggregate.ts` | S | 8.2.1 |
| 8.2.3 | Implement `foldAlarmEvents` reducer | `schemas/events/alarm-aggregate.ts` | L | 8.2.1 |
| 8.2.4 | Handle AlarmTriggered -> set initial state | `schemas/events/alarm-aggregate.ts` | S | 8.2.3 |
| 8.2.5 | Handle AlarmAcknowledged -> state='acknowledged' | `schemas/events/alarm-aggregate.ts` | S | 8.2.3 |
| 8.2.6 | Handle AlarmCleared -> state='cleared' | `schemas/events/alarm-aggregate.ts` | S | 8.2.3 |
| 8.2.7 | Handle AlarmEscalated -> increment level | `schemas/events/alarm-aggregate.ts` | S | 8.2.3 |
| 8.2.8 | Handle AlarmShelved -> state='shelved' | `schemas/events/alarm-aggregate.ts` | S | 8.2.3 |
| 8.2.9 | Handle AlarmUnshelved -> restore previous state | `schemas/events/alarm-aggregate.ts` | M | 8.2.3 |
| 8.2.10 | Handle AlarmSuppressed -> state='suppressed' | `schemas/events/alarm-aggregate.ts` | S | 8.2.3 |
| 8.2.11 | Handle AlarmOutOfService -> state='out_of_service' | `schemas/events/alarm-aggregate.ts` | S | 8.2.3 |
| 8.2.12 | Handle AlarmReturnedToService -> restore state | `schemas/events/alarm-aggregate.ts` | M | 8.2.3 |
| 8.2.13 | Handle AlarmConfigChanged -> update severity/threshold | `schemas/events/alarm-aggregate.ts` | S | 8.2.3 |
| 8.2.14 | Unit test: fold multiple events -> correct state | `__tests__/schemas/alarm-aggregate.test.ts` | L | 8.2.3 |
| 8.2.15 | Unit test: ISA-18.2 state machine transitions | `__tests__/schemas/alarm-aggregate.test.ts` | M | 8.2.14 |

### Acceptance Criteria (Section 8.2)
- [ ] `foldAlarmEvents` uses `Match.exhaustive` for type safety
- [ ] Version increments on each event
- [ ] State transitions follow ISA-18.2 state machine
- [ ] Tests cover all 10 event types

---

## Section 8.3: Event Handlers (Projections)

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 8.3.1 | Create `AlarmEventHandlers` using `EventLog.group` | `handlers/alarm-handlers.ts` | M | 8.1.11, Epic 7 |
| 8.3.2 | Handle AlarmTriggered -> AlarmRepo.insert | `handlers/alarm-handlers.ts` | M | 8.3.1, Epic 4 |
| 8.3.3 | Handle AlarmAcknowledged -> AlarmRepo.updateState | `handlers/alarm-handlers.ts` | M | 8.3.1 |
| 8.3.4 | Handle AlarmCleared -> AlarmRepo.updateState | `handlers/alarm-handlers.ts` | M | 8.3.1 |
| 8.3.5 | Handle AlarmEscalated -> AlarmRepo.update + notify | `handlers/alarm-handlers.ts` | M | 8.3.1 |
| 8.3.6 | Handle AlarmShelved -> AlarmRepo.updateState | `handlers/alarm-handlers.ts` | S | 8.3.1 |
| 8.3.7 | Handle AlarmUnshelved -> AlarmRepo.updateState | `handlers/alarm-handlers.ts` | S | 8.3.1 |
| 8.3.8 | Handle AlarmSuppressed -> AlarmRepo.updateState | `handlers/alarm-handlers.ts` | S | 8.3.1 |
| 8.3.9 | Handle AlarmOutOfService -> AlarmRepo.updateState | `handlers/alarm-handlers.ts` | S | 8.3.1 |
| 8.3.10 | Handle AlarmReturnedToService -> AlarmRepo.updateState | `handlers/alarm-handlers.ts` | S | 8.3.1 |
| 8.3.11 | Handle AlarmConfigChanged -> AlarmRepo.updateConfig | `handlers/alarm-handlers.ts` | M | 8.3.1 |
| 8.3.12 | Integration test: event -> handler -> projection | `__tests__/integration/alarm-events.test.ts` | L | 8.3.2-11 |
| 8.3.13 | Integration test: same-transaction consistency | `__tests__/integration/alarm-events.test.ts` | M | 8.3.12 |

### Acceptance Criteria (Section 8.3)
- [ ] All handlers update projection in same transaction as event write
- [ ] Handlers emit Effect.log for observability
- [ ] AlarmEscalated triggers notification side-effect
- [ ] Integration tests verify projection matches aggregate state

---

## Section 8.4: AlarmService Refactoring

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 8.4.1 | Refactor `createAlarm` -> emit AlarmTriggered | `services/l2/AlarmService.ts` | M | 8.3, 8.0.2 |
| 8.4.2 | Refactor `acknowledgeAlarm` -> emit AlarmAcknowledged | `services/l2/AlarmService.ts` | M | 8.4.1 |
| 8.4.3 | Refactor `clearAlarm` -> emit AlarmCleared | `services/l2/AlarmService.ts` | M | 8.4.1 |
| 8.4.4 | Refactor `escalateAlarm` -> emit AlarmEscalated | `services/l2/AlarmService.ts` | M | 8.4.1 |
| 8.4.5 | Add `shelveAlarm` -> emit AlarmShelved | `services/l2/AlarmService.ts` | M | 8.4.1 |
| 8.4.6 | Add `unshelveAlarm` -> emit AlarmUnshelved | `services/l2/AlarmService.ts` | M | 8.4.1 |
| 8.4.7 | Add `suppressAlarm` -> emit AlarmSuppressed | `services/l2/AlarmService.ts` | M | 8.4.1 |
| 8.4.8 | Add `takeOutOfService` -> emit AlarmOutOfService | `services/l2/AlarmService.ts` | M | 8.4.1 |
| 8.4.9 | Add `returnToService` -> emit AlarmReturnedToService | `services/l2/AlarmService.ts` | M | 8.4.1 |
| 8.4.10 | Add `updateAlarmConfig` -> emit AlarmConfigChanged | `services/l2/AlarmService.ts` | M | 8.4.1 |
| 8.4.11 | Keep read operations unchanged (query projection) | - | - | - |
| 8.4.12 | Update service dependencies to include IIoTEventLog | `services/l2/AlarmService.ts` | S | 8.4.1-10 |
| 8.4.13 | Add dual-mode support (ES vs CRUD via flag) | `services/l2/AlarmService.ts` | M | 8.4.12, 8.0.1 |
| 8.4.14 | Update existing service tests | `__tests__/services/AlarmService.test.ts` | L | 8.4.13 |

### Acceptance Criteria (Section 8.4)
- [ ] All write methods emit events instead of direct CRUD
- [ ] Read methods unchanged (query projection table)
- [ ] Feature flag allows runtime toggle between ES and CRUD
- [ ] Existing tests pass with both flag values

---

## Section 8.5: Reactivity Bindings

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 8.5.1 | Define `ALARM_CACHE_KEYS` constants | `handlers/alarm-reactivity.ts` | S | - |
| 8.5.2 | Create `AlarmReactivity` using `EventLog.groupReactivity` | `handlers/alarm-reactivity.ts` | M | 8.1.11 |
| 8.5.3 | Map AlarmTriggered -> active alarms, counts, by-severity | `handlers/alarm-reactivity.ts` | S | 8.5.2 |
| 8.5.4 | Map AlarmAcknowledged -> active alarms, counts | `handlers/alarm-reactivity.ts` | S | 8.5.2 |
| 8.5.5 | Map AlarmCleared -> active alarms, counts, history | `handlers/alarm-reactivity.ts` | S | 8.5.2 |
| 8.5.6 | Map AlarmEscalated -> active alarms | `handlers/alarm-reactivity.ts` | S | 8.5.2 |
| 8.5.7 | Map shelve/unshelve/suppress/OOS -> active alarms | `handlers/alarm-reactivity.ts` | S | 8.5.2 |
| 8.5.8 | Create `connectAlarmReactivityToAtoms` bridge | `handlers/alarm-reactivity.ts` | M | 8.5.2 |
| 8.5.9 | Wire `activeAlarmsAtom` refresh on invalidation | `handlers/alarm-reactivity.ts` | S | 8.5.8 |
| 8.5.10 | Wire `alarmCountsAtom` refresh on invalidation | `handlers/alarm-reactivity.ts` | S | 8.5.8 |
| 8.5.11 | Integration test: event -> reactivity -> atom refresh | `__tests__/integration/alarm-reactivity.test.ts` | M | 8.5.8 |

### Acceptance Criteria (Section 8.5)
- [ ] All 10 events map to appropriate cache keys
- [ ] Atom.registry.refresh() called on invalidation
- [ ] UI components see updates within 100ms of event write
- [ ] No stale data in dashboards after state changes

---

## Section 8.6: Temporal Queries

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 8.6.1 | Implement `getAlarmAtTime(alarmId, timestamp)` | `services/l2/AlarmService.ts` | M | 8.2, 8.4 |
| 8.6.2 | Implement `getAlarmHistory(alarmId, since?, until?)` | `services/l2/AlarmService.ts` | M | 8.6.1 |
| 8.6.3 | Implement `getAlarmsAtTime(assetId, timestamp)` | `services/l2/AlarmService.ts` | M | 8.6.1 |
| 8.6.4 | Add B-tree index for temporal queries | `models/events/AlarmEvents.ddl.ts` | S | Epic 7 |
| 8.6.5 | Unit test: reconstruct state at past timestamp | `__tests__/services/alarm-temporal.test.ts` | M | 8.6.1 |
| 8.6.6 | Unit test: state changes visible at correct times | `__tests__/services/alarm-temporal.test.ts` | M | 8.6.5 |
| 8.6.7 | Unit test: history returns ordered events | `__tests__/services/alarm-temporal.test.ts` | S | 8.6.2 |
| 8.6.8 | Performance benchmark: 10K events temporal query | `__tests__/perf/alarm-temporal.bench.ts` | M | 8.6.1 |

### Acceptance Criteria (Section 8.6)
- [ ] `getAlarmAtTime` returns correct state for any past timestamp
- [ ] `getAlarmHistory` returns all events in chronological order
- [ ] Temporal query performance <100ms for typical alarm history
- [ ] Index supports efficient range scans

---

## Section 8.7: Entity & Workflow Integration

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 8.7.1 | Update AlarmEntity handlers -> use EventLog | `entity/AlarmEntity.ts` | L | 8.4 |
| 8.7.2 | Update AlarmLifecycleWorkflow -> use EventLog | `workflow/AlarmLifecycleWorkflow.ts` | M | 8.7.1 |
| 8.7.3 | Add maybeEmit pattern for event emission | `entity/AlarmEntity.ts` | M | 8.7.1 |
| 8.7.4 | Integration test: entity -> event -> projection | `__tests__/entity/alarm-entity.test.ts` | L | 8.7.2 |
| 8.7.5 | Integration test: workflow end-to-end | `__tests__/entity/alarm-entity.test.ts` | L | 8.7.4 |

### Acceptance Criteria (Section 8.7)
- [ ] Entity handlers emit events via EventLog
- [ ] Workflow uses service methods (not direct repo access)
- [ ] End-to-end test covers full alarm lifecycle

---

## Section 8.8: Documentation & Compliance

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 8.8.1 | Document AlarmRepo as projection-only | `repos/AlarmRepo.ts` | S | 8.4 |
| 8.8.2 | Add `@readonly` JSDoc markers to AlarmRepo | `repos/AlarmRepo.ts` | S | 8.8.1 |
| 8.8.3 | Create ISA-18.2 compliance checklist | `docs/compliance/isa-18-2.md` | M | 8.4 |
| 8.8.4 | Add compliance test suite | `__tests__/compliance/isa-18-2.test.ts` | L | 8.8.3 |
| 8.8.5 | Document temporal query patterns | `docs/patterns/temporal-queries.md` | M | 8.6 |

### Acceptance Criteria (Section 8.8)
- [ ] AlarmRepo clearly marked as read-only projection
- [ ] ISA-18.2 requirements mapped to implementation
- [ ] Compliance tests verify audit trail completeness

---

## Section 8.9: Alarm Fact Integration

**Reference:** `2026-01-29-extensible-fact-system-spec.md`

Integrates the extensible Fact system with AlarmService, enabling arbitrary metadata attachment to alarm events.

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 8.9.1 | Add `facts` parameter to `TriggerAlarmParams` | `services/l2/AlarmService.ts`, `schemas/events/alarm-events.ts` | S | 8.4.1, Epic 7 (FactStore) |
| 8.9.2 | Integrate `FactStore.attach` in `AlarmService.triggerAlarm` | `services/l2/AlarmService.ts` | M | 8.9.1 |
| 8.9.3 | Register `sensor_reading` factType in FactTypeRegistry | `config/fact-types.ts` | S | Epic 7 (FactTypeRegistry) |
| 8.9.4 | Register `operator_note` factType in FactTypeRegistry | `config/fact-types.ts` | S | 8.9.3 |
| 8.9.5 | Add `getAlarmFacts(alarmId)` query method to AlarmService | `services/l2/AlarmService.ts` | M | 8.9.2 |
| 8.9.6 | Integration test: alarm with attached facts | `__tests__/integration/alarm-facts.test.ts` | M | 8.9.5 |

### Acceptance Criteria (Section 8.9)
- [ ] `TriggerAlarmParams.facts` accepts array of `{ type: string, payload: unknown }`
- [ ] `FactStore.attach()` called for each fact after event write
- [ ] `sensor_reading` factType validates `{ value: number, unit: string }` payload
- [ ] `operator_note` factType validates `{ note: string }` payload
- [ ] `getAlarmFacts(alarmId)` returns all facts attached to alarm's events
- [ ] Integration test verifies fact attachment and retrieval roundtrip

---

## Dependency Graph

```
8.0.1 (Feature Flag) ─────────────────────────────────┐
       │                                               │
       v                                               │
8.0.2 (Flag Check in Service) ─────────────────────────┼───┐
       │                                               │   │
       │  ┌─────────────────────────────────────────┘   │
       │  │                                             │
       v  v                                             │
8.1.1-12 (Event Schemas) ──────────────────────────────┼───┤
       │                                               │   │
       ├─────────────────────────────┐                 │   │
       │                             │                 │   │
       v                             v                 │   │
8.2.1-15 (Aggregation)        8.3.1-13 (Handlers)     │   │
       │                             │                 │   │
       └──────────┬──────────────────┘                 │   │
                  │                                    │   │
                  v                                    v   v
          8.4.1-14 (Service Refactoring) <─────────────────┘
                  │
       ┌──────────┼──────────┐
       │          │          │
       v          v          v
8.5.1-11    8.6.1-8    8.7.1-5
(Reactivity) (Temporal) (Entity)
       │          │          │
       └──────────┼──────────┘
                  │
                  v
          8.8.1-5 (Documentation)
                  │
                  v
          8.9.1-6 (Fact Integration) <─── Epic 7 (FactStore, FactTypeRegistry)
```

---

## Risk Mitigations

| Risk | Mitigation | Task |
|------|------------|------|
| EventLog API instability | Pin `@effect/experimental`, facade abstraction | Epic 7 |
| No rollback capability | `ES_ALARM_ENABLED` feature flag | 8.0.1-2 |
| Projection inconsistency | Same-transaction writes, integration tests | 8.3.12-13 |
| Temporal query performance | B-tree index, benchmark tests | 8.6.4, 8.6.8 |
| ISA-18.2 compliance gaps | Compliance checklist and test suite | 8.8.3-4 |

---

## Complexity Estimates

| Section | Tasks | Story Points | Rationale |
|---------|-------|--------------|-----------|
| 8.0 Pre-Mortem | 3 | 2 SP | Flag infrastructure |
| 8.1 Event Schemas | 13 | 3 SP | Well-defined patterns |
| 8.2 State Aggregation | 15 | 4 SP | Complex state machine |
| 8.3 Event Handlers | 13 | 3 SP | Handler boilerplate |
| 8.4 Service Refactoring | 14 | 4 SP | Careful migration |
| 8.5 Reactivity | 11 | 2 SP | Straightforward wiring |
| 8.6 Temporal Queries | 8 | 2 SP | New capability |
| 8.7 Entity Integration | 5 | 2 SP | Update existing code |
| 8.8 Documentation | 5 | 1 SP | Compliance docs |
| 8.9 Fact Integration | 6 | 4 SP | FactStore + factType registration |
| **TOTAL** | **93 tasks** | **25 SP** | **~2-3 sprints** |

---

## Files to Create/Modify

### New Files
```
src/lib/iiot/
├── schemas/events/
│   ├── alarm-events.ts           # 10 event payloads + EventGroup
│   └── alarm-aggregate.ts        # AlarmAggregate + foldAlarmEvents
├── handlers/
│   ├── alarm-handlers.ts         # AlarmEventHandlers (projections)
│   └── alarm-reactivity.ts       # AlarmReactivity + atom bridge
├── config/
│   ├── IIoTConfig.ts             # ES_ALARM_ENABLED flag
│   └── fact-types.ts             # sensor_reading, operator_note factType schemas
└── models/events/
    └── AlarmEvents.ddl.ts        # Temporal query index

__tests__/
├── schemas/
│   ├── alarm-events.test.ts      # Schema roundtrip tests
│   └── alarm-aggregate.test.ts   # Fold/state machine tests
├── services/
│   └── alarm-temporal.test.ts    # Temporal query tests
├── integration/
│   ├── alarm-events.test.ts      # Event -> handler -> projection
│   └── alarm-reactivity.test.ts  # Event -> atom refresh
├── compliance/
│   └── isa-18-2.test.ts          # Compliance verification
├── integration/
│   └── alarm-facts.test.ts       # Alarm + Fact integration tests
└── perf/
    └── alarm-temporal.bench.ts   # Performance benchmarks

docs/
├── compliance/
│   └── isa-18-2.md               # Compliance checklist
└── patterns/
    └── temporal-queries.md       # Query pattern docs
```

### Modified Files
```
src/lib/iiot/
├── services/l2/AlarmService.ts   # Refactor to use EventLog
├── entity/AlarmEntity.ts         # Update handlers
├── workflow/AlarmLifecycleWorkflow.ts  # Update to use service
└── repos/AlarmRepo.ts            # Add @readonly markers
```

---

## Success Criteria

1. **All 10 alarm events implemented** with Schema.Class payloads
2. **Event handlers update projections** in same transaction
3. **Reactivity binds to atoms** - UI refreshes on events
4. **Temporal queries work** - reconstruct any past state
5. **Feature flag enables rollback** - can disable ES at runtime
6. **ISA-18.2 compliance verified** - full audit trail
7. **Performance acceptable** - <100ms temporal queries
8. **Fact integration complete** - sensor_reading/operator_note facts attach to alarm events

---

**Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>**
