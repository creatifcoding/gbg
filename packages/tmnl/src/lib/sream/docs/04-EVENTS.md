# SREAM Event Hierarchy

Event definitions following `src/lib/iiot/schemas/events/` patterns.

## Event Categories

| Category       | Storage   | Events |
|---------------|-----------|--------|
| **Structural** | EventLog  | RequirementCreated, RequirementUpdated, RequirementDeleted, RequirementStatusChanged |
| **Operational**| EventLog  | ValidationRunCompleted, InferenceRunCompleted, ConflictDetected, VerificationLinked, TraceLinked |
| **Fuzz** (A)   | EventLog  | FuzzRunStarted, RequirementFuzzed, FuzzRunCompleted |

No Temporal events — SREAM has no high-frequency measurements.

## Common Event Fields

Following `src/lib/iiot/schemas/events/groups.ts`:

```typescript
const SreamStructuralEventFields = {
  eventId: SreamEventId,
  occurredAt: Schema.DateTimeUtc,
  causedBy: Schema.String,
  requirementId: RequirementId,
  correlationId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  schemaVersion: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { default: () => 1 }
  ),
}

const SreamOperationalEventFields = {
  eventId: SreamEventId,
  occurredAt: Schema.DateTimeUtc,
  causedBy: Schema.String,
  correlationId: Schema.optionalWith(Schema.String, { as: 'Option' }),
  schemaVersion: Schema.optionalWith(
    Schema.Number.pipe(Schema.int(), Schema.positive()),
    { default: () => 1 }
  ),
}
```

Note: Operational events don't always have a `requirementId` — inference and validation runs affect multiple requirements.

## Structural Event Payloads

### RequirementCreated

```typescript
const RequirementCreatedPayload = Schema.Struct({
  ...SreamStructuralEventFields,
  spec: RequirementAtomic,           // full canonical requirement
  team: TeamId,
  category: CategoryId,
})
```

### RequirementUpdated

```typescript
const RequirementUpdatedPayload = Schema.Struct({
  ...SreamStructuralEventFields,
  previousSpec: RequirementAtomic,    // snapshot before update
  updatedSpec: RequirementAtomic,     // snapshot after update
  changedFields: Schema.Array(Schema.String),  // which fields changed
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
```

### RequirementDeleted

```typescript
const RequirementDeletedPayload = Schema.Struct({
  ...SreamStructuralEventFields,
  deletedSpec: RequirementAtomic,     // snapshot at deletion
  reason: Schema.NonEmptyString,
})
```

### RequirementStatusChanged

```typescript
const RequirementStatusChangedPayload = Schema.Struct({
  ...SreamStructuralEventFields,
  fromStatus: RequirementStatus,
  toStatus: RequirementStatus,
  transitionAction: Schema.String,
  reason: Schema.optionalWith(Schema.String, { as: 'Option' }),
})
```

## Operational Event Payloads

### ValidationRunCompleted

```typescript
const ValidationRunCompletedPayload = Schema.Struct({
  ...SreamOperationalEventFields,
  runId: ValidationRunId,
  requirementIds: Schema.Array(RequirementId),  // requirements validated
  totalChecked: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  passed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  failed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  warnings: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  errors: Schema.Array(Schema.Struct({
    requirementId: RequirementId,
    field: Schema.String,
    message: Schema.String,
    severity: Schema.Literal('error', 'warning'),
  })),
  durationMs: Schema.Number.pipe(Schema.nonNegative()),
})
```

### InferenceRunCompleted

```typescript
const InferenceRunCompletedPayload = Schema.Struct({
  ...SreamOperationalEventFields,
  runId: InferenceRunId,
  factsProcessed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  conflictsDetected: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  clausesAnalyzed: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  durationMs: Schema.Number.pipe(Schema.nonNegative()),
})
```

### ConflictDetected

```typescript
const ConflictDetectedPayload = Schema.Struct({
  ...SreamOperationalEventFields,
  inferenceRunId: InferenceRunId,
  clauseKey: ClauseKey,
  conflictKind: Schema.Literal('direct', 'indirect', 'redundant'),
  involvedRequirements: Schema.Array(RequirementId),
  explanation: Schema.optionalWith(Schema.String, { as: 'Option' }),
  effectiveModality: EffectiveModalityLevel,
})
```

### VerificationLinked

```typescript
const VerificationLinkedPayload = Schema.Struct({
  ...SreamStructuralEventFields,
  plan: VerificationPlan,
})
```

### TraceLinked

```typescript
const TraceLinkedPayload = Schema.Struct({
  ...SreamStructuralEventFields,
  trace: TraceInfo,
})
```

## EventGroup Registration

Following `src/lib/iiot/schemas/events/groups.ts`:

```typescript
import * as EventGroup from '@effect/experimental/EventGroup'

export const SreamStructuralEvents = EventGroup.empty
  .add({
    tag: 'RequirementCreated',
    primaryKey: (p) => p.requirementId,
    payload: RequirementCreatedPayload,
  })
  .add({
    tag: 'RequirementUpdated',
    primaryKey: (p) => p.requirementId,
    payload: RequirementUpdatedPayload,
  })
  .add({
    tag: 'RequirementDeleted',
    primaryKey: (p) => p.requirementId,
    payload: RequirementDeletedPayload,
  })
  .add({
    tag: 'RequirementStatusChanged',
    primaryKey: (p) => p.requirementId,
    payload: RequirementStatusChangedPayload,
  })
  .add({
    tag: 'VerificationLinked',
    primaryKey: (p) => p.requirementId,
    payload: VerificationLinkedPayload,
  })
  .add({
    tag: 'TraceLinked',
    primaryKey: (p) => p.requirementId,
    payload: TraceLinkedPayload,
  })

export const SreamOperationalEvents = EventGroup.empty
  .add({
    tag: 'ValidationRunCompleted',
    primaryKey: (p) => p.runId,
    payload: ValidationRunCompletedPayload,
  })
  .add({
    tag: 'InferenceRunCompleted',
    primaryKey: (p) => p.runId,
    payload: InferenceRunCompletedPayload,
  })
  .add({
    tag: 'ConflictDetected',
    primaryKey: (p) => p.clauseKey,
    payload: ConflictDetectedPayload,
  })
```

## EventLog Schema

```typescript
import * as EventLog from '@effect/experimental/EventLog'

export const SreamEventLogSchema = EventLog.schema(
  SreamStructuralEvents,
  SreamOperationalEvents,
)

export const SreamEventLogLayer = EventLog.layer(SreamEventLogSchema)

export const SreamEventLogStackLayer = SreamEventLogLayer.pipe(
  Layer.provide(EventJournal.layerMemory),
  Layer.provide(SreamIdentityLayer),
)
```

## Event Fold (State Derivation)

Since SREAM is event-sourced, current state is derived by folding events:

```typescript
interface SreamState {
  readonly requirements: HashMap<RequirementId, RequirementAtomic>
  readonly logicals: HashMap<RequirementId, RequirementLogical>
  readonly byTeam: HashMap<TeamId, ReadonlyArray<RequirementId>>
  readonly byCategory: HashMap<CategoryId, ReadonlyArray<RequirementId>>
  readonly clauseIndex: HashMap<ClauseKey, ReadonlyArray<{
    requirementId: RequirementId
    modality: Modality
  }>>
  readonly conflicts: ReadonlyArray<ConflictDetectedPayload>
  readonly lastValidationRun: Option<ValidationRunCompletedPayload>
  readonly lastInferenceRun: Option<InferenceRunCompletedPayload>
}

const fold = (state: SreamState, event: SreamEvent): SreamState => {
  switch (event._tag) {
    case 'RequirementCreated':
      return addRequirement(state, event.spec)
    case 'RequirementUpdated':
      return updateRequirement(state, event.updatedSpec)
    case 'RequirementDeleted':
      return removeRequirement(state, event.requirementId)
    case 'RequirementStatusChanged':
      return updateStatus(state, event.requirementId, event.toStatus)
    case 'ConflictDetected':
      return addConflict(state, event)
    case 'ValidationRunCompleted':
      return { ...state, lastValidationRun: Option.some(event) }
    case 'InferenceRunCompleted':
      return { ...state, lastInferenceRun: Option.some(event) }
    // ...
  }
}
```

---

## Related

- [01-PATTERNS.md](./01-PATTERNS.md) — Pattern 2 (Spread Fields), Pattern 4 (EventGroup), Pattern 5 (EventLog Layer)
- [02-PERSISTENCE.md](./02-PERSISTENCE.md) — Event Journal DDL
- [03-DOMAIN-SCHEMAS.md](./03-DOMAIN-SCHEMAS.md) — Domain types referenced in payloads
