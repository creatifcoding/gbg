# Epic 7: Event Sourcing Infrastructure (Expanded)

**Goal**: Establish IIoT-specific EventLog infrastructure with SqlEventJournal, identity persistence, and AMS v2-aligned patterns. Provides the foundation for all ES domains (Alarm, Work Order, Equipment State).

**Story Points**: 29 SP (expanded from 8 SP + 13 SP EL-1 + 8 SP Fact System)
**Sprint**: 3 (Phase 2: Event Sourcing Boundaries)
**Dependencies**: Epic 3 (DDL Infrastructure)

---

## Section 7.0: Pre-Mortem Mitigations

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 7.0.1 | Pin `@effect/experimental` version for API stability | `package.json` | S | - |
| 7.0.2 | Create `IIoTEventLogFacade` service interface (abstracts API changes) | `services/l1/IIoTEventLog.ts` | M | 7.0.1 |

**Rationale**: EventLog lives in `@effect/experimental`. Pinning version and creating a facade protects domain code from upstream API changes.

---

## Section 7.1: EventJournal DDL

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 7.1.1 | Create `iiot_event_journal` table DDL | `models/events/EventJournalModel.ddl.ts` | S | Epic 3, 7.0.2 |
| 7.1.2 | Create `iiot_event_remotes` table DDL (cluster sync) | `models/events/EventJournalModel.ddl.ts` | S | 7.1.1 |
| 7.1.3 | Create `iiot_event_identity` table DDL (identity KVS) | `models/events/EventJournalModel.ddl.ts` | S | 7.1.1 |
| 7.1.4 | Add migration `0014_iiot_event_journal` | `models/_migrations.ts` | S | 7.1.1-7.1.3 |
| 7.1.5 | Test migration idempotency | `__tests__/models.integration.test.ts` | S | 7.1.4 |

---

## Section 7.2: EventLog Service Layer

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 7.2.1 | Create `IIoTEventLogConfig` context tag | `services/l1/IIoTEventLog.ts` | S | 7.1 |
| 7.2.2 | Create `IIoTSqlEventJournalLayer` (PostgreSQL-backed) | `services/l1/IIoTEventLog.ts` | M | 7.2.1 |
| 7.2.3 | Create `IIoTEventLogTest` (in-memory for tests) | `services/l1/IIoTEventLog.ts` | M | 7.2.1 |
| 7.2.4 | Create `IIoTIdentityLayer` (KVS-backed identity persistence) | `services/l1/IIoTEventLog.ts` | M | 7.2.1 |
| 7.2.5 | Create `IIoTEventLogStackLayer` (combined layer composition) | `services/l1/IIoTEventLog.ts` | S | 7.2.2-7.2.4 |
| 7.2.6 | Export from `services/l1/index.ts` | `services/l1/index.ts` | S | 7.2.5 |
| 7.2.7 | Integration test: write/read events roundtrip | `__tests__/integration/iiot-event-journal.test.ts` | M | 7.2.5 |

---

## Section 7.3: Event Base Schemas

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 7.3.1 | Create `EventMetadata` schema (correlationId, causationId, userId) | `schemas/events/base.ts` | S | Epic 1 |
| 7.3.2 | Create `IIoTEventEntry` schema (timestamp, sequence, metadata) | `schemas/events/base.ts` | M | 7.3.1 |
| 7.3.3 | Create `Event.make` wrapper helper with IIoT metadata defaults | `schemas/events/base.ts` | M | 7.3.2 |
| 7.3.4 | Export from `schemas/index.ts` | `schemas/index.ts` | S | 7.3.3 |

---

## Section 7.4: Canonical API Patterns

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 7.4.1 | Create `EventGroup.empty` builder pattern example | `events/_patterns.ts` | S | 7.3.3 |
| 7.4.2 | Create `EventLog.schema` composition example | `events/_patterns.ts` | S | 7.4.1 |
| 7.4.3 | Create `EventLog.group` handler pattern example | `events/_patterns.ts` | M | 7.4.2 |
| 7.4.4 | Create `EventLog.groupReactivity` pattern example | `events/_patterns.ts` | S | 7.4.3 |
| 7.4.5 | Document patterns in JSDoc + README | `events/README.md` | M | 7.4.1-7.4.4 |

---

## Section 7.5: Fact System Infrastructure

| Task ID | Description | Files | Size | Depends On |
|---------|-------------|-------|------|------------|
| 7.5.1 | Create `iiot_facts` table DDL | `models/events/FactModel.ddl.ts` | S | 7.1.1 |
| 7.5.2 | Add migration `0015_iiot_facts` | `models/_migrations.ts` | S | 7.5.1, 7.1.4 |
| 7.5.3 | Create `FactId` branded identifier | `schemas/identifiers.ts` | S | Epic 1 |
| 7.5.4 | Create `Fact` schema (minimal envelope) | `schemas/facts/Fact.ts` | M | 7.5.3 |
| 7.5.5 | Create `FactTypeRegistry` service | `services/l1/FactTypeRegistry.ts` | M | 7.5.4 |
| 7.5.6 | Create `FactStore` service | `services/l1/FactStore.ts` | L | 7.5.4, 7.5.5, 7.2.5 |
| 7.5.7 | Add graph traversal query (recursive CTE) | `services/l1/FactStore.ts` | M | 7.5.6 |
| 7.5.8 | Integration test: attach/query facts | `__tests__/integration/iiot-facts.test.ts` | M | 7.5.6, 7.5.7 |

**Reference**: `thoughts/shared/specs/2026-01-29-extensible-fact-system-spec.md`

---

## Task Summary

| Section | Tasks | Story Points |
|---------|-------|--------------|
| 7.0: Pre-Mortem Mitigations | 2 | 3 SP |
| 7.1: EventJournal DDL | 5 | 4 SP |
| 7.2: EventLog Service Layer | 7 | 8 SP |
| 7.3: Event Base Schemas | 4 | 3 SP |
| 7.4: Canonical API Patterns | 5 | 3 SP |
| 7.5: Fact System Infrastructure | 8 | 8 SP |
| **TOTAL** | **31** | **29 SP** |

---

## Acceptance Criteria

- [ ] `@effect/experimental` version pinned in `package.json`
- [ ] `IIoTEventLogFacade` abstracts EventLog API for domain isolation
- [ ] `iiot_event_journal` and `iiot_event_remotes` tables created via idempotent migration
- [ ] `IIoTSqlEventJournalLayer` writes to PostgreSQL
- [ ] `IIoTEventLogTest` provides in-memory layer for unit tests
- [ ] `IIoTIdentityLayer` persists identity via KeyValueStore
- [ ] `IIoTEventLogStackLayer` composes all layers for production use
- [ ] `EventMetadata` schema captures correlationId, causationId, userId
- [ ] `Event.make` wrapper injects IIoT-specific metadata
- [ ] Integration test: write event, read event, verify payload
- [ ] `iiot_facts` table created via idempotent migration (0015)
- [ ] `FactId` branded identifier exported from `schemas/identifiers.ts`
- [ ] `Fact` schema provides minimal envelope with JSONB payload
- [ ] `FactTypeRegistry` validates factTypes at write time (open by default)
- [ ] `FactStore` provides `attach`, `extend`, `forEvent`, `traverse` operations
- [ ] Graph traversal query (recursive CTE) supports depth-limited fact DAG
- [ ] Integration test: attach fact to event, query facts, traverse graph

---

## Layer Composition Pattern

```typescript
// 7.2.5: IIoTEventLogStackLayer composition
export const IIoTEventLogStackLayer = Layer.mergeAll(
  EventLog.layer(IIoTEventLogSchema),
  SqlEventJournal.layer({
    eventLogTable: 'iiot_event_journal',
    remotesTable: 'iiot_event_remotes',
  }),
  EventLog.layerIdentityKvs({ key: 'iiot-eventlog-identity' }),
)
```

---

## EventGroup Pattern (7.4.1-7.4.2)

```typescript
// Builder pattern for event groups
export const ExampleEvents = EventGroup.empty
  .add({
    tag: 'ExampleCreated',
    payload: ExampleCreatedPayload,
    primaryKey: (p) => p.id,
  })
  .add({
    tag: 'ExampleUpdated',
    payload: ExampleUpdatedPayload,
    primaryKey: (p) => p.id,
  })

// Schema composition
export const IIoTEventLogSchema = EventLog.schema(
  AlarmEvents,
  WorkOrderEvents,
  EquipmentStateEvents,
)
```

---

## Handler Pattern (7.4.3)

```typescript
// EventLog.group handler pattern
export const ExampleEventHandlers = EventLog.group(ExampleEvents, (handlers) =>
  handlers
    .handle('ExampleCreated', ({ payload, entry }) =>
      Effect.gen(function* () {
        yield* ExampleRepo.insert(payload)
        yield* Effect.log(`Example ${payload.id} created`)
      })
    )
    .handle('ExampleUpdated', ({ payload }) =>
      Effect.gen(function* () {
        yield* ExampleRepo.update(payload.id, payload.changes)
      })
    )
)
```

---

## Reactivity Pattern (7.4.4)

```typescript
// Cache invalidation bindings
export const ExampleReactivity = EventLog.groupReactivity(ExampleEvents, {
  ExampleCreated: ['examples:list', 'examples:dashboard'],
  ExampleUpdated: ['examples:list'],
})
```

---

## Downstream Dependencies

Completing Epic 7 unblocks:

| Epic | Description | Dependency |
|------|-------------|------------|
| Epic 8 | Alarm Domain ES Migration | Requires `IIoTEventLogStackLayer` |
| Epic 9 | Work Order Domain | Requires `IIoTEventLogStackLayer` |
| Epic 10 | Equipment State Domain | Requires `IIoTEventLogStackLayer` |
| Epic 12 | ES Integration Testing | Requires all event infrastructure |

---

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modified | Pin `@effect/experimental` version |
| `services/l1/IIoTEventLog.ts` | Created | Facade, config, layers |
| `services/l1/index.ts` | Modified | Export IIoTEventLog |
| `models/events/EventJournalModel.ddl.ts` | Created | DDL for event tables |
| `models/_migrations.ts` | Modified | Add migration 0014 |
| `schemas/events/base.ts` | Created | EventMetadata, IIoTEventEntry, Event.make |
| `schemas/index.ts` | Modified | Export event base schemas |
| `events/_patterns.ts` | Created | Canonical pattern examples |
| `events/README.md` | Created | Pattern documentation |
| `__tests__/models.integration.test.ts` | Modified | Migration idempotency test |
| `__tests__/integration/iiot-event-journal.test.ts` | Created | EventLog roundtrip test |
| `models/events/FactModel.ddl.ts` | Created | DDL for iiot_facts table |
| `schemas/facts/Fact.ts` | Created | Fact schema (minimal envelope) |
| `schemas/identifiers.ts` | Modified | Add FactId branded identifier |
| `services/l1/FactTypeRegistry.ts` | Created | Runtime factType validation |
| `services/l1/FactStore.ts` | Created | Fact attachment and traversal |
| `__tests__/integration/iiot-facts.test.ts` | Created | Fact system integration test |

---

## Risk Mitigations Incorporated

| Risk | Mitigation Task | Status |
|------|-----------------|--------|
| EventLog API instability (@effect/experimental) | 7.0.1 (pin version), 7.0.2 (facade) | Incorporated |
| Team unfamiliar with EventLog patterns | 7.4.1-7.4.5 (documented patterns) | Incorporated |
| Test layer requires PostgreSQL | 7.2.3 (in-memory layer) | Incorporated |

---

**Source Documents:**
- `2026-01-26-v3-service-architecture-wbs.md` (Epic 7, 8 SP)
- `2026-01-29-eventlog-integration-wbs-final.md` (Epic EL-1, 13 SP)
- `2026-01-29-extensible-fact-system-spec.md` (Fact System, 8 SP)

**Generated:** 2026-01-29
**Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>**
