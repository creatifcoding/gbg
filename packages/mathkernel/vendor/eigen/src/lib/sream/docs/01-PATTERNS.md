# SREAM Patterns — Extracted from IIoT Module

This document catalogs the canonical patterns from `src/lib/iiot/` that SREAM must follow. Every pattern includes the IIoT source location and the SREAM adaptation.

## Pattern 1: Three-Category Event Taxonomy

**Source:** `src/lib/iiot/schemas/events/base.ts`

IIoT defines three event base classes with different storage semantics:

| Category       | Storage      | Query Pattern             | Retention   | SREAM Usage |
|----------------|-------------|---------------------------|-------------|-------------|
| **Structural** | EventLog    | Replay from origin        | Indefinite  | Requirement lifecycle (Created, Updated, Deleted) |
| **Operational**| EventLog    | Replay + time-travel      | Indefinite  | Runtime events (validation, inference, fuzzing runs) |
| **Temporal**   | TimescaleDB | Time-bucketed aggregation | Tiered      | **Not applicable** — SREAM has no high-frequency measurements |

### IIoT Implementation

```typescript
// Three SEPARATE base classes — no common root
export class BaseStructuralEvent extends Schema.TaggedClass<BaseStructuralEvent>()(
  'BaseStructuralEvent', { ... }
) {}

export class BaseOperationalEvent extends Schema.TaggedClass<BaseOperationalEvent>()(
  'BaseOperationalEvent', { ... }
) {}

export class BaseTemporalEvent extends Schema.TaggedClass<BaseTemporalEvent>()(
  'BaseTemporalEvent', { ... }
) {}
```

### SREAM Adaptation

SREAM needs only Structural and Operational:
- **Structural:** `RequirementCreated`, `RequirementUpdated`, `RequirementDeleted`, `VerificationLinked`, `TraceLinked`
- **Operational:** `ValidationRunStarted`, `ValidationRunCompleted`, `InferenceRunCompleted`, `ConflictDetected`, `RequirementFuzzed`

---

## Pattern 2: Event Envelope via Spread Fields

**Source:** `src/lib/iiot/schemas/events/groups.ts` (lines 33-68)

IIoT defines common fields as plain objects, then spreads them into every concrete event payload:

```typescript
const StructuralEventFields = {
  eventId: EventId,
  occurredAt: Schema.DateTimeUtc,
  causedBy: Schema.String,
  entityId: AssetId,
  entityType: EquipmentLevel,
  hierarchyPath: Schema.Array(AssetId),
  correlationId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  schemaVersion: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { default: () => 1 }
  ),
}

// Each concrete event spreads and extends:
const EnterpriseCreatedPayload = Schema.Struct({
  ...StructuralEventFields,
  enterpriseId: EnterpriseId,
  name: Schema.NonEmptyString,
})
```

### SREAM Adaptation

```typescript
const SreamStructuralEventFields = {
  eventId: SreamEventId,
  occurredAt: Schema.DateTimeUtc,
  causedBy: Schema.String,                    // actor: user, system, CI
  requirementId: RequirementId,               // replaces entityId
  correlationId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  schemaVersion: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { default: () => 1 }
  ),
}

// No hierarchyPath — requirements don't have spatial hierarchy
// No entityType — requirement type is encoded in RequirementSpec._tag
```

---

## Pattern 3: Branded Identifiers

**Source:** `src/lib/iiot/schemas/identifiers.ts`

Every domain identifier is a branded string:

```typescript
export const WorkOrderId = Schema.String.pipe(Schema.brand('WorkOrderId'))
export type WorkOrderId = Schema.Schema.Type<typeof WorkOrderId>
```

### SREAM Adaptation

```typescript
export const RequirementId = Schema.String.pipe(Schema.brand('RequirementId'))
export const TeamId = Schema.String.pipe(Schema.brand('TeamId'))
export const CategoryId = Schema.String.pipe(Schema.brand('CategoryId'))
export const SreamEventId = Schema.String.pipe(Schema.brand('SreamEventId'))
export const ValidationRunId = Schema.String.pipe(Schema.brand('ValidationRunId'))
export const InferenceRunId = Schema.String.pipe(Schema.brand('InferenceRunId'))
export const FuzzRunId = Schema.String.pipe(Schema.brand('FuzzRunId'))
export const ClauseKey = Schema.String.pipe(Schema.brand('ClauseKey'))
```

---

## Pattern 4: EventGroup Registration

**Source:** `src/lib/iiot/schemas/events/groups.ts` (lines ~1550+)

Events are registered with `@effect/experimental/EventGroup`:

```typescript
export const StructuralEvents = EventGroup.empty
  .add({
    tag: 'EnterpriseCreated',
    primaryKey: (payload) => payload.enterpriseId,
    payload: EnterpriseCreatedPayload,
  })
  .add({
    tag: 'EnterpriseUpdated',
    primaryKey: (payload) => payload.enterpriseId,
    payload: EnterpriseUpdatedPayload,
  })
```

### Key Properties
- `tag`: Discriminator string (matches `_tag`)
- `primaryKey`: Extractor function — returns the entity ID for journal partitioning
- `payload`: Schema.Struct with `...EventFields` spread + domain-specific fields

---

## Pattern 5: EventLog Layer Composition

**Source:** `src/lib/iiot/infrastructure/eventlog-layer.ts`

Three-step composition:

```typescript
// 1. Schema = EventLog.schema(Group1, Group2, ...)
export const IIoTEventLogSchema = EventLog.schema(
  StructuralEvents,
  OperationalEvents,
  AlarmEvents
)

// 2. Layer = EventLog.layer(schema)
export const IIoTEventLogLayer = EventLog.layer(IIoTEventLogSchema)

// 3. Stack = Layer + Journal + Identity
export const IIoTEventLogStackLayer = IIoTEventLogLayer.pipe(
  Layer.provide(EventJournal.layerMemory),  // Memory for dev/test
  Layer.provide(IIoTIdentityLayer),          // Random CRDT identity
)
```

### Identity
- `EventLog.Identity.makeRandom()` for dev/test
- Persistent identity for production (via `EventLog.layerIdentityKvs`)

### Journal Backends
- `EventJournal.layerMemory` — in-memory (testing)
- Custom SQL journal — `IIoTSqlEventJournalLayer` for PostgreSQL

---

## Pattern 6: Domain Entity as Schema.TaggedClass

**Source:** `src/lib/iiot/schemas/work-orders.ts`

Domain entities use `Schema.TaggedClass` with methods:

```typescript
export class WorkOrder extends Schema.TaggedClass<WorkOrder>()('WorkOrder', {
  id: WorkOrderId,
  status: WorkOrderStatus,
  title: Schema.NonEmptyString,
  // ... fields
}) {
  isActive(): boolean { ... }
  canTransitionTo(newStatus: WorkOrderStatus): boolean { ... }
  getValidNextStates(): readonly WorkOrderStatus[] { ... }
}
```

### Key Properties
- Domain logic lives ON the entity (methods, computed properties)
- Validation transitions defined separately in Graph module
- `Schema.optionalWith(T, { as: 'Option' })` for nullable fields
- `Schema.optionalWith(T, { default: () => value })` for defaults

---

## Pattern 7: State Service (Hexagonal Port)

**Source:** `src/lib/iiot/state/StateShape.ts`, `src/lib/iiot/state/WorkOrderState.ts`

State services are hexagonal ports with swappable implementations:

```typescript
// 1. Shape interface (contract)
export interface WorkOrderStateShape {
  readonly create: (input: CreateWorkOrderInput) => Effect.Effect<WorkOrder>
  readonly get: (id: WorkOrderId) => Effect.Effect<WorkOrder, NotFoundError>
  readonly set: (workOrder: WorkOrder) => Effect.Effect<void>
  readonly list: (filter: WorkOrderFilter) => Effect.Effect<readonly WorkOrder[]>
  readonly delete: (id: WorkOrderId) => Effect.Effect<boolean>
  readonly exists: (id: WorkOrderId) => Effect.Effect<boolean>
  readonly count: (filter: WorkOrderFilter) => Effect.Effect<number>
}

// 2. Service Tag
export class WorkOrderState extends Context.Tag('iiot/WorkOrderState')<
  WorkOrderState, WorkOrderStateShape
>() {}

// 3. In-Memory implementation (testing)
export const WorkOrderStateInMemory: Layer.Layer<WorkOrderState> = Layer.effect(
  WorkOrderState,
  Ref.make(new Map<WorkOrderId, WorkOrder>()).pipe(
    Effect.map((store) => ({ ... }))
  )
)

// 4. SQL factory (production)
export const makeWorkOrderStateSql = (repo: { ... }): WorkOrderStateShape => ({ ... })
```

---

## Pattern 8: Machine (Actor-Style State Machine)

**Source:** `src/lib/iiot/machines/WorkOrderMachine.ts`

Entities delegate to Effect Machines for lifecycle management:

```
Entity.toLayer()
  └─▶ Machine.boot(machine)           // Boot actor (scope-aware)
        └─▶ actor.send(InternalReq)   // Delegate operations
              └─▶ Machine.procedures   // Validate transitions via Graph
                    └─▶ state.get/set  // Mutate state
                    └─▶ maybeEmit()    // Feature-flagged event emission
```

### Internal Requests

```typescript
export class InternalCreateWorkOrder extends Schema.TaggedRequest<InternalCreateWorkOrder>()(
  'InternalCreateWorkOrder', {
    failure: MachineWorkOrderCreateError,
    success: WorkOrder,
    payload: { input: Schema.Unknown },
  }
) {}
```

### Graph Validation

```typescript
// src/lib/iiot/machines/graphs/work-order-graph.ts
export const workOrderStateGraph = Graph.directed<WorkOrderStateNode, WorkOrderTransitionAction>(
  (mutable) => {
    // Add nodes for each state
    nodeIndices.created = Graph.addNode(mutable, 'created')
    // Add edges for valid transitions
    Graph.addEdge(mutable, nodeIndices.created, nodeIndices.submitted, 'Submit')
  }
)
```

---

## Pattern 9: Entity Stack (Layer Composition)

**Source:** `src/lib/iiot/entity/EntityStack.ts`, `src/lib/iiot/layers/index.ts`

Pre-composed stacks for different deployment targets:

```typescript
// Testing: all in-memory
export const EntityTestingStack = EntityHandlersLayer.pipe(
  Layer.provide(AllStateServicesInMemory),
  Layer.provide(IIoTFeatureFlagsDisabledLayer),
)

// Production: SQL-backed
export const IIoTClusterLayer = pipe(
  EntityProductionHandlersWithEvents,
  Layer.provide(AllStateServicesSql),
  Layer.provide(IIoTRepositoriesLive),
)

// Config-driven (reads deployment mode)
export const IIoTRuntimeLayer = Layer.unwrapEffect(
  Effect.gen(function* () {
    const { mode } = yield* DeploymentModeConfig
    switch (mode) {
      case 'test': return IIoTTestLayer
      case 'cluster': return IIoTClusterLayer
    }
  })
)
```

---

## Pattern 10: Feature-Flagged Event Emission

**Source:** `src/lib/iiot/entity/_helpers.ts`

Event emission is controlled by feature flags and NEVER blocks the parent operation:

```typescript
export const maybeEmitWorkOrder = (
  flags: FeatureFlagsShape,
  eventType: string,
  payload: unknown
): Effect.Effect<void> => {
  if (!flags.workOrderEventSourcingEnabled) {
    return Effect.void
  }
  return Effect.logInfo(`[ES:WorkOrder] ${eventType}`, { payload }).pipe(
    Effect.catchAll((err) =>
      Effect.logWarning(`Event emission failed (non-blocking): ${String(err)}`)
    )
  )
}
```

### SREAM Adaptation
SREAM should have its own feature flag (`sreamEventSourcingEnabled`) to control event emission during development.

---

## Pattern 11: Testing with Fresh Memory Journals

**Source:** `src/lib/iiot/__tests__/integration/work-order-es.test.ts`

Each test gets an isolated journal:

```typescript
const makeTestEventJournalLayer = () => Layer.fresh(EventJournal.layerMemory)

it('should write lifecycle events', async () => {
  const program = Effect.gen(function* () {
    yield* writeEventToJournal('WorkOrderCreated', payload, workOrderId)
    const journal = yield* EventJournal.EventJournal
    const entries = yield* journal.entries
    expect(entries.filter(e => e.primaryKey === workOrderId)).toHaveLength(1)
  }).pipe(Effect.provide(makeTestEventJournalLayer()))

  await Effect.runPromise(program)
})
```

---

## Pattern 12: Entity Contract

**Source:** `src/lib/iiot/schemas/entity-contract.ts`

All entities implement a contract providing:
- Schema introspection (Schema, Model, DDL)
- Operational queries (isOperational, getAutomationLevel)
- Hierarchy navigation (materializePath)
- Lifecycle hooks (onCreate, onUpdate, validate)

### SREAM Adaptation
Requirements don't map to ISA-95 equipment hierarchy, but the contract pattern applies:
- `isValid()` instead of `isOperational()`
- `getEffectiveModality()` instead of `getAutomationLevel()`
- `materializeId()` instead of `materializePath()`
- `validate()` remains the same
