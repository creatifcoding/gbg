# SREAM Domain Schemas

All domain types defined as Effect Schemas. No raw TypeScript interfaces.

## Identifier Types (Branded)

Following `src/lib/iiot/schemas/identifiers.ts`:

```typescript
// Core entity IDs
export const RequirementId = Schema.String.pipe(Schema.brand('RequirementId'))
export const TeamId = Schema.String.pipe(Schema.brand('TeamId'))
export const CategoryId = Schema.String.pipe(Schema.brand('CategoryId'))

// Event sourcing IDs
export const SreamEventId = Schema.String.pipe(Schema.brand('SreamEventId'))
export const ValidationRunId = Schema.String.pipe(Schema.brand('ValidationRunId'))
export const InferenceRunId = Schema.String.pipe(Schema.brand('InferenceRunId'))
export const FuzzRunId = Schema.String.pipe(Schema.brand('FuzzRunId'))

// Deontic inference IDs (Pillar B)
export const ClauseKey = Schema.String.pipe(Schema.brand('ClauseKey'))
// ClauseKey = `${subjectName}::${verb}::${object}` — normalized predicate signature
```

### RequirementId Format

For TMNL dogfooding: `team:category:ordinal:order`

```
layers:functional:001:1      → Layer System, functional req #1, first order
animation:performance:003:2  → Animation, performance req #3, second order
slider:interface:002:1       → Slider System, interface req #2, first order
```

Generation rule: `RequirementIdService` manages ordinal allocation per team+category.

---

## Modality (Deontic Operators)

```typescript
export const Modality = Schema.Literal('must', 'shall', 'may', 'must_not')
export type Modality = typeof Modality.Type
```

### Deontic Semantics

| Modality   | Operator   | Lattice  | Description |
|-----------|-----------|----------|-------------|
| `must`    | O φ       | required | Obligation — system MUST do this |
| `shall`   | O φ       | required | Obligation — synonym for must |
| `may`     | P φ       | optional | Permission — system MAY do this |
| `must_not`| O ¬φ      | forbidden| Prohibition — system MUST NOT do this |

### Effective Modality Lattice

```typescript
export const EffectiveModalityLevel = Schema.Literal('forbidden', 'optional', 'required', 'inconsistent')
```

Ordering: `forbidden < optional < required`. `inconsistent` signals a conflict.

---

## Subject

```typescript
export class PhraseSubject extends Schema.TaggedClass<PhraseSubject>()('PhraseSubject', {
  /** The subsystem or component being constrained */
  name: Schema.NonEmptyString,
  
  /** Normalized name for comparison (lowercase, trimmed, no articles) */
  normalizedName: Schema.String,
  
  /** Optional qualifier ("terminal display" vs "display") */
  qualifier: Schema.optionalWith(Schema.String, { as: 'Option' }),
}) {
  /** Generate normalized form from name */
  static normalize(name: string): string {
    return name.toLowerCase().trim()
      .replace(/^(the|a|an)\s+/i, '')
      .replace(/\s+/g, '_')
  }
}
```

---

## Predicate

```typescript
export class Predicate extends Schema.TaggedClass<Predicate>()('Predicate', {
  /** The action verb (e.g., "support", "render", "transmit") */
  verb: Schema.NonEmptyString,
  
  /** The object of the action (e.g., "4K screen resolutions") */
  object: Schema.NonEmptyString,
  
  /** Normalized signature for comparison: "verb::object" */
  signature: Schema.String,
}) {
  /** Generate signature from verb+object */
  static makeSignature(verb: string, object: string): string {
    return `${verb.toLowerCase().trim()}::${object.toLowerCase().trim()}`
  }
}
```

---

## Constraint Hierarchy

```typescript
// Base constraint with discriminator
export const NumericConstraint = Schema.TaggedStruct('NumericConstraint', {
  field: Schema.String,
  operator: Schema.Literal('eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between'),
  value: Schema.Number,
  upperBound: Schema.optionalWith(Schema.Number, { as: 'Option' }),  // for 'between'
  unit: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

export const EnumConstraint = Schema.TaggedStruct('EnumConstraint', {
  field: Schema.String,
  allowedValues: Schema.Array(Schema.String),
  exclusive: Schema.optionalWith(Schema.Boolean, { default: () => false }),
})

export const BooleanConstraint = Schema.TaggedStruct('BooleanConstraint', {
  field: Schema.String,
  value: Schema.Boolean,
})

export const ExpressionConstraint = Schema.TaggedStruct('ExpressionConstraint', {
  field: Schema.String,
  expression: Schema.String,  // Free-form expression for complex constraints
  description: Schema.optionalWith(Schema.String, { as: 'Option' }),
})

// Union of all constraint types
export const Constraint = Schema.Union(
  NumericConstraint,
  EnumConstraint,
  BooleanConstraint,
  ExpressionConstraint,
)
export type Constraint = typeof Constraint.Type
```

---

## Context

```typescript
export class RequirementContext extends Schema.TaggedClass<RequirementContext>()('RequirementContext', {
  /** Operational mode this requirement applies in */
  mode: Schema.optionalWith(
    Schema.Literal('operational', 'maintenance', 'startup', 'shutdown', 'degraded', 'emergency'),
    { as: 'Option' }
  ),
  
  /** Environmental assumptions that must hold */
  assumptions: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  
  /** Guard conditions that must be true */
  guards: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
}) {}
```

---

## Verification

```typescript
export const VerificationMethod = Schema.Literal(
  'test', 'inspection', 'demonstration', 'analysis', 'simulation', 'review'
)

export class VerificationPlan extends Schema.TaggedClass<VerificationPlan>()('VerificationPlan', {
  method: VerificationMethod,
  description: Schema.String,
  criteria: Schema.optionalWith(Schema.String, { as: 'Option' }),
  evidence: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
}) {}
```

---

## Trace

```typescript
export class TraceInfo extends Schema.TaggedClass<TraceInfo>()('TraceInfo', {
  /** Links to design artifacts */
  designRefs: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  
  /** Links to implementation artifacts (code, PRs) */
  implRefs: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  
  /** Links to test evidence */
  testRefs: Schema.optionalWith(Schema.Array(Schema.String), { default: () => [] }),
  
  /** Links to parent/derived requirements */
  derivedFrom: Schema.optionalWith(Schema.Array(RequirementId), { default: () => [] }),
  derivesTo: Schema.optionalWith(Schema.Array(RequirementId), { default: () => [] }),
}) {}
```

---

## Requirement Status (Lifecycle)

```typescript
export const RequirementStatus = Schema.Literal('draft', 'active', 'deprecated', 'archived')
export type RequirementStatus = typeof RequirementStatus.Type
```

---

## Effectiveness Category

```typescript
export const EffectivenessCategory = Schema.Literal(
  'functional',    // what the system does
  'performance',   // how well it does it
  'interface',     // how it connects
  'security',      // how it's protected
  'reliability',   // how often it fails
  'maintainability', // how easy to fix
  'portability',   // how easy to move
  'usability',     // how easy to use
)
```

---

## Criticality

```typescript
export const Criticality = Schema.Literal('mission_critical', 'essential', 'desirable', 'optional')
```

---

## Order Hierarchy

```typescript
export const RequirementOrder = Schema.Literal('first', 'second', 'third', 'nth')
// first = direct, second = derived from first, etc.
```

---

## RequirementAtomic (Core Entity)

Following `src/lib/iiot/schemas/work-orders.ts` WorkOrder pattern:

```typescript
export class RequirementAtomic extends Schema.TaggedClass<RequirementAtomic>()('RequirementAtomic', {
  /** Unique requirement ID (team:category:ordinal:order) */
  id: RequirementId,
  
  /** Team/subsystem this belongs to */
  team: TeamId,
  
  /** Category (functional, performance, interface, etc.) */
  category: CategoryId,
  
  /** Ordinal within team+category */
  ordinal: Schema.Number.pipe(Schema.int(), Schema.positive()),
  
  /** Order (first, second, nth) */
  order: RequirementOrder,
  
  /** Lifecycle status */
  status: RequirementStatus,

  /** The system/subsystem being constrained */
  subject: PhraseSubject,
  
  /** Deontic modality */
  modality: Modality,
  
  /** What the system must/shall/may do */
  predicate: Predicate,
  
  /** Measurable bounds */
  constraints: Schema.optionalWith(Schema.Array(Constraint), { default: () => [] }),
  
  /** Operational context */
  context: Schema.optionalWith(RequirementContext, { as: 'Option' }),
  
  /** How to verify compliance */
  verification: Schema.optionalWith(VerificationPlan, { as: 'Option' }),
  
  /** Traceability links */
  trace: Schema.optionalWith(TraceInfo, { as: 'Option' }),
  
  /** Effectiveness category */
  effectiveness: Schema.optionalWith(EffectivenessCategory, { as: 'Option' }),
  
  /** Criticality level */
  criticality: Schema.optionalWith(Criticality, { as: 'Option' }),
  
  /** Who created this */
  createdBy: Schema.String,
  
  /** When created */
  createdAt: Schema.DateTimeUtc,
  
  /** Extensible metadata */
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { default: () => ({}) }
  ),
}) {
  /** Check if requirement is in an active (non-terminal) state */
  isActive(): boolean {
    return this.status === 'draft' || this.status === 'active'
  }
  
  /** Get the normalized clause key for deontic inference */
  getClauseKey(): string {
    return `${this.subject.normalizedName}::${this.predicate.signature}` as string
  }
  
  /** Check if this requirement can transition to a new status */
  canTransitionTo(newStatus: typeof RequirementStatus.Type): boolean {
    return isValidRequirementTransition(this.status, newStatus)
  }
}
```

---

## RequirementLogical (Propositional Combinators)

```typescript
export const LogicalOperator = Schema.Literal('allOf', 'anyOf', 'oneOf', 'implies', 'iff')

export class RequirementLogical extends Schema.TaggedClass<RequirementLogical>()('RequirementLogical', {
  id: RequirementId,
  operator: LogicalOperator,
  operands: Schema.Array(RequirementId),  // references to other requirements
  status: RequirementStatus,
  createdBy: Schema.String,
  createdAt: Schema.DateTimeUtc,
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { default: () => ({}) }
  ),
}) {}
```

---

## RequirementSpec (Union)

```typescript
export const RequirementSpec = Schema.Union(RequirementAtomic, RequirementLogical)
export type RequirementSpec = typeof RequirementSpec.Type
```

Pattern-match on `_tag`:
- `'RequirementAtomic'` → has subject, modality, predicate, constraints
- `'RequirementLogical'` → has operator, operands

---

## RequirementDraft (Construction Input)

```typescript
export const RequirementDraft = Schema.Struct({
  team: TeamId,
  category: CategoryId,
  order: Schema.optionalWith(RequirementOrder, { default: () => 'first' as const }),
  subject: Schema.Struct({
    name: Schema.NonEmptyString,
    qualifier: Schema.optionalWith(Schema.String, { as: 'Option' }),
  }),
  modality: Modality,
  predicate: Schema.Struct({
    verb: Schema.NonEmptyString,
    object: Schema.NonEmptyString,
  }),
  constraints: Schema.optionalWith(Schema.Array(Constraint), { default: () => [] }),
  context: Schema.optionalWith(RequirementContext, { as: 'Option' }),
  effectiveness: Schema.optionalWith(EffectivenessCategory, { as: 'Option' }),
  criticality: Schema.optionalWith(Criticality, { as: 'Option' }),
  metadata: Schema.optionalWith(
    Schema.Record({ key: Schema.String, value: Schema.Unknown }),
    { default: () => ({}) }
  ),
})
export type RequirementDraft = typeof RequirementDraft.Type
```

The `RequirementService` transforms drafts into canonical `RequirementAtomic` by:
1. Normalizing subject name
2. Computing predicate signature
3. Allocating ordinal via `RequirementIdService`
4. Generating `RequirementId`
5. Setting initial status to `'draft'`
6. Emitting `RequirementCreated` event

---

## State Transition Graph

Following `src/lib/iiot/machines/graphs/work-order-graph.ts`:

```
draft → active → deprecated → archived
  ↓                              ↑
  └──────────────────────────────┘
  (can archive directly from draft)
```

```typescript
import { Graph } from 'effect'

export const requirementStateGraph = Graph.directed<RequirementStateNode, RequirementTransitionAction>(
  (mutable) => {
    const nodes = {
      draft: Graph.addNode(mutable, 'draft'),
      active: Graph.addNode(mutable, 'active'),
      deprecated: Graph.addNode(mutable, 'deprecated'),
      archived: Graph.addNode(mutable, 'archived'),
    }
    Graph.addEdge(mutable, nodes.draft, nodes.active, 'Activate')
    Graph.addEdge(mutable, nodes.draft, nodes.archived, 'Archive')
    Graph.addEdge(mutable, nodes.active, nodes.deprecated, 'Deprecate')
    Graph.addEdge(mutable, nodes.deprecated, nodes.archived, 'Archive')
  }
)
```

---

## Related

- [01-PATTERNS.md](./01-PATTERNS.md) — Pattern 6 (TaggedClass), Pattern 8 (Graph validation)
- [02-PERSISTENCE.md](./02-PERSISTENCE.md) — Model.Class mapping from these Schemas
- [04-EVENTS.md](./04-EVENTS.md) — Event payloads derived from these types
