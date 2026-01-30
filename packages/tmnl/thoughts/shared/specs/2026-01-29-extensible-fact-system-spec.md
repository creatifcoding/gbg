# Extensible Fact System Specification

**Status:** APPROVED (Conceptual Alignment Round 2.1)
**Date:** 2026-01-29
**Scope:** Alarm, Equipment, and similar L2 entity hierarchy

---

## Overview

This spec defines an **extensible Fact system** that attaches arbitrary metadata to domain events. It augments (not replaces) existing typed events like `AlarmTriggered`, `EquipmentStateChanged`, etc.

**Key Principle:** Events stay typed. Facts are the extension point.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DOMAIN EVENTS (Typed, existing)                                        │
│  ├── AlarmTriggered, AlarmAcknowledged, AlarmCleared, ...               │
│  ├── EquipmentStateChanged, FaultDetected, MaintenanceEntered, ...      │
│  └── WorkOrderCreated, WorkOrderApproved, ...                           │
│                                                                          │
│  FACTS (Extensible, new)                                                │
│  ├── Minimal envelope: { factId, parentEventId, factType, payload }     │
│  ├── Payload: JSONB (producer-defined, runtime-validated)               │
│  └── Graph: Facts can reference other Facts (DAG)                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Fact Schema

```typescript
// Minimal envelope - producer defines payload shape
export class Fact extends Schema.Class<Fact>('Fact')({
  factId: FactId,                    // UUID
  parentEventId: EventId,            // Links to domain event
  parentFactId: Schema.optional(FactId), // Graph edge (nullable)
  factType: Schema.String,           // Runtime-registered type
  payload: Schema.Record({           // JSONB - arbitrary
    key: Schema.String,
    value: Schema.Unknown,
  }),
  producerId: Schema.String,         // Who/what created this
  producedAt: Schema.DateTimeUtc,
}) {}
```

---

## SQL Schema

```sql
CREATE TABLE iiot_facts (
  fact_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_event_id UUID NOT NULL,        -- FK to event journal
  parent_fact_id  UUID REFERENCES iiot_facts(fact_id), -- Graph edge
  fact_type       TEXT NOT NULL,
  payload         JSONB NOT NULL,
  producer_id     TEXT NOT NULL,
  produced_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  CONSTRAINT fk_parent_event FOREIGN KEY (parent_event_id)
    REFERENCES iiot_state_events(event_id)
);

CREATE INDEX idx_facts_parent_event ON iiot_facts(parent_event_id);
CREATE INDEX idx_facts_parent_fact ON iiot_facts(parent_fact_id);
CREATE INDEX idx_facts_type ON iiot_facts(fact_type);
CREATE INDEX idx_facts_payload ON iiot_facts USING GIN (payload);
```

---

## Runtime Registry

```typescript
// FactTypeRegistry - validates factTypes at write time
export class FactTypeRegistry extends Effect.Service<FactTypeRegistry>()(
  'iiot/FactTypeRegistry',
  {
    effect: Effect.sync(() => ({
      registered: new Map<string, Schema.Schema.Any>(),

      register: (factType: string, schema: Schema.Schema.Any) =>
        Effect.sync(() => { /* add to map */ }),

      validate: (factType: string, payload: unknown) =>
        Effect.gen(function* () {
          const schema = registered.get(factType)
          if (!schema) return yield* Effect.succeed(true) // Open by default
          return yield* Schema.decodeUnknown(schema)(payload)
        }),
    })),
  }
) {}
```

---

## FactStore Service

```typescript
export class FactStore extends Effect.Service<FactStore>()(
  'iiot/FactStore',
  {
    effect: Effect.gen(function* () {
      const sql = yield* SqlClient
      const registry = yield* FactTypeRegistry

      return {
        // Attach fact to event
        attach: (eventId: EventId, factType: string, payload: unknown) =>
          Effect.gen(function* () {
            yield* registry.validate(factType, payload)
            return yield* sql`INSERT INTO iiot_facts ...`
          }),

        // Attach fact to fact (graph edge)
        extend: (factId: FactId, factType: string, payload: unknown) =>
          Effect.gen(function* () { /* ... */ }),

        // Query facts for event
        forEvent: (eventId: EventId) =>
          sql`SELECT * FROM iiot_facts WHERE parent_event_id = ${eventId}`,

        // Traverse fact graph
        traverse: (factId: FactId, depth?: number) =>
          sql`WITH RECURSIVE ... FROM iiot_facts ...`,
      }
    }),
  }
) {}
```

---

## Integration with Domain Events

Events gain an optional `facts` attachment point:

```typescript
// AlarmService augmented
const triggerAlarm = (params: TriggerAlarmParams) =>
  Effect.gen(function* () {
    // 1. Emit typed event (existing)
    const event = yield* eventLog.write('AlarmTriggered', params)

    // 2. Attach facts (new - optional)
    if (params.facts) {
      for (const fact of params.facts) {
        yield* factStore.attach(event.eventId, fact.type, fact.payload)
      }
    }

    return event
  })
```

---

## Use Cases

| Domain | Fact Type | Payload Example |
|--------|-----------|-----------------|
| **Alarm** | `sensor_reading` | `{ value: 35.2, unit: "celsius" }` |
| **Alarm** | `operator_note` | `{ note: "Checked valve manually" }` |
| **Equipment** | `maintenance_record` | `{ techId: "T-123", parts: [...] }` |
| **Equipment** | `oee_snapshot` | `{ availability: 0.95, performance: 0.88 }` |
| **WorkOrder** | `approval_context` | `{ budget: 5000, justification: "..." }` |

---

## WBS Impact

| Epic | Change |
|------|--------|
| **Epic 7 (ES Infrastructure)** | Add FactStore service, iiot_facts DDL |
| **Epic 8 (Alarm)** | Integrate FactStore with AlarmService |
| **Epic 10 (Equipment)** | Integrate FactStore with EquipmentStateService |
| **NEW: Fact Registry** | Runtime factType registration system |

**Estimated Addition:** +8-12 SP across affected epics

---

## Key Decisions

1. **Events stay typed** — AlarmTriggered, etc. unchanged
2. **Facts are extensible** — JSONB payload, producer-defined
3. **Graph structure** — Facts can reference other Facts
4. **Runtime registry** — factTypes validated at write time
5. **Custom FactStore** — Not using EventLog for Facts
6. **Cluster entities** — @effect/cluster for entity lifecycle

---

**Reference for WBS Update Agents**
