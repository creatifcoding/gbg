# SREAM File Structure

Complete module layout following IIoT conventions.

```
src/lib/sream/
├── index.ts                              # Public barrel exports
├── tags.ts                               # Service Tags (if needed)
│
├── docs/                                 # Architecture documentation
│   ├── 00-OVERVIEW.md                    # What SREAM is, four pillars, state model
│   ├── 01-PATTERNS.md                    # Canonical patterns from IIoT
│   ├── 02-PERSISTENCE.md                 # Model → DDL → Repo → State → Layer
│   ├── 03-DOMAIN-SCHEMAS.md              # All Schema types
│   ├── 04-EVENTS.md                      # Event hierarchy and EventGroups
│   └── 05-FILE-STRUCTURE.md              # This file
│
├── schemas/                              # Domain types (Schema-first)
│   ├── index.ts                          # Barrel re-exports
│   ├── identifiers.ts                    # Branded IDs: RequirementId, TeamId, etc.
│   ├── modality.ts                       # Schema.Literal("must","shall","may","must_not")
│   ├── subject.ts                        # PhraseSubject TaggedClass
│   ├── predicate.ts                      # Predicate TaggedClass (verb + object + signature)
│   ├── constraint.ts                     # Constraint union (Numeric, Enum, Boolean, Expression)
│   ├── context.ts                        # RequirementContext TaggedClass
│   ├── verification.ts                   # VerificationPlan TaggedClass
│   ├── trace.ts                          # TraceInfo TaggedClass
│   ├── requirement-atomic.ts             # RequirementAtomic TaggedClass (core entity)
│   ├── requirement-logical.ts            # RequirementLogical TaggedClass (allOf, anyOf, etc.)
│   ├── requirement-spec.ts              # RequirementSpec = Union(Atomic, Logical)
│   ├── requirement-draft.ts             # Draft input object (construction input)
│   └── requirement-status.ts            # RequirementStatus, transitions, graph
│
├── schemas/events/                       # Event definitions
│   ├── index.ts                          # Barrel re-exports
│   ├── base.ts                           # BaseSreamStructuralEvent, BaseSreamOperationalEvent
│   ├── structural/
│   │   └── index.ts                      # Created, Updated, Deleted, StatusChanged, VerificationLinked, TraceLinked
│   ├── operational/
│   │   ├── validation-events.ts          # ValidationRunCompleted
│   │   └── inference-events.ts           # InferenceRunCompleted, ConflictDetected
│   └── groups.ts                         # EventGroup definitions + combined schema
│
├── models/                               # Persistence schemas (Model.Class)
│   ├── _common.ts                        # Shared transforms (or import from iiot)
│   ├── _migrations.ts                    # Migrator.fromRecord aggregation
│   ├── index.ts                          # Barrel re-exports
│   ├── RequirementModel.ts              # Model.Class for sream.requirements
│   ├── RequirementModel.ddl.ts          # CREATE TABLE, indexes, CHECK constraints
│   ├── RequirementTransitionModel.ts    # Model.Class for sream.requirement_transitions
│   └── RequirementTransitionModel.ddl.ts # Append-only audit table + immutability trigger
│
├── repos/                                # Repository layer
│   ├── index.ts                          # Barrel + SreamRepositoriesLive composed layer
│   ├── _decode.ts                        # Import/adapt from iiot or standalone
│   ├── RequirementRepo.ts              # CRUD + query + column mapping
│   └── RequirementTransitionRepo.ts    # Append-only audit queries
│
├── state/                                # Hexagonal state ports
│   ├── index.ts                          # AllSreamStateServicesInMemory
│   ├── StateShape.ts                     # RequirementStateShape interface + errors
│   └── RequirementState.ts             # Context.Tag + InMemory + makeSql factory
│
├── machines/                             # State machine + graph validation
│   ├── RequirementMachine.ts            # Effect Machine for lifecycle transitions
│   └── graphs/
│       └── requirement-graph.ts         # Graph.directed for status transitions
│
├── services/                             # Effect Services (Pillar D)
│   ├── index.ts                          # Barrel re-exports
│   ├── RequirementService.ts            # Core: draft → canonical → event emit
│   ├── RequirementIdService.ts          # ID generation (team:category:ordinal:order)
│   ├── ConstraintService.ts             # Constraint validation + normalization
│   ├── ContextService.ts                # Context normalization + cross-check
│   ├── ValidationService.ts             # Structural + semantic validation
│   └── SerializationService.ts          # Canonical JSON output
│
├── entity/                               # Entity definitions (if using @effect/cluster)
│   ├── RequirementEntity.ts             # Entity.make() + Rpc definitions + handlers
│   └── EntityStack.ts                    # Composed handler layers
│
├── infrastructure/                       # Infrastructure wiring
│   ├── eventlog-layer.ts                # SreamEventLogSchema, Stack layers (memory + SQL)
│   ├── feature-flags.ts                 # sreamEventSourcingEnabled
│   └── deployment-mode.ts               # Config-driven layer selection
│
├── layers/                               # Pre-composed layer stacks
│   └── index.ts                          # SreamTestLayer, SreamClusterLayer, SreamRuntimeLayer
│
├── atoms/                                # Reactive state for React
│   └── index.ts                          # Runtime atom + projected state atoms
│
├── __tests__/                            # Test suite
│   ├── schemas.test.ts                   # Schema encode/decode roundtrip
│   ├── schemas/
│   │   └── property-based.test.ts        # Property-based testing (fast-check)
│   ├── services/
│   │   ├── RequirementService.test.ts
│   │   ├── ValidationService.test.ts
│   │   └── RequirementIdService.test.ts
│   ├── machines/
│   │   ├── requirement-machine.test.ts
│   │   └── graphs/
│   │       └── requirement-graph.test.ts
│   ├── integration/
│   │   ├── layer.ts                      # Test PgClient + migration + cleanup
│   │   ├── requirement-es.test.ts        # Event sourcing (memory journal)
│   │   └── repos/
│   │       └── RequirementRepo.test.ts   # SQL CRUD integration tests
│   └── __fixtures__/
│       └── fixtures.ts                   # Test data factories
│
└── testbed/
    └── SreamTestbed.tsx                  # /testbed/sream route (UI surface)
```

## Dependency Graph (Internal)

```
schemas/            ← Pure types, no service deps
    ↑
schemas/events/     ← Event payloads reference schema types
    ↑
models/             ← Model.Class references schema types
    ↑
repos/              ← SQL layer references models
    ↑
state/              ← Hexagonal port references schemas + repos
    ↑
machines/           ← State machine references schemas + state
    ↑
services/           ← Business logic references all of above
    ↑
entity/             ← Entity handlers reference services + machines
    ↑
infrastructure/     ← EventLog wiring references events + entity
    ↑
layers/             ← Composed stacks reference everything
    ↑
atoms/              ← React integration references layers + services
    ↑
testbed/            ← UI component references atoms
```

## What Lives Where (Decision Guide)

| Question | Answer | Location |
|----------|--------|----------|
| "What shape is a requirement?" | Schema definition | `schemas/` |
| "What events can happen?" | Event payloads | `schemas/events/` |
| "How is it stored in Postgres?" | Model + DDL | `models/` |
| "How do I query the DB?" | SQL + decode | `repos/` |
| "How do I get/set state?" | Hexagonal port | `state/` |
| "What transitions are valid?" | Graph + Machine | `machines/` |
| "How do I create a requirement?" | Business logic | `services/` |
| "How do I wire it all together?" | Layer composition | `layers/` |
| "How does React consume it?" | Atoms | `atoms/` |
| "How do I test it?" | Vitest + @effect/vitest | `__tests__/` |
