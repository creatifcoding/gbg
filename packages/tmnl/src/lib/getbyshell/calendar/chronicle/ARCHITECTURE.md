# CHRONICLE — Architecture Specification

> *"Every day is an entity. Every entity has a lifecycle."*

Chronicle is a fullscreen holographic calendar overlay that treats **days as rich aggregate entities** — not calendar squares with dots. A Day holds notes, morph cards, tasks, knowledge links, mood/status, media attachments, and calendar events. The system uses the IIoT Alarm vertical slice as its canonical architectural pattern.

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Directory Structure](#directory-structure)
3. [Layer Map](#layer-map)
4. [Schemas](#schemas)
5. [Identifiers](#identifiers)
6. [State](#state)
7. [Machines](#machines)
8. [Graphs](#graphs)
9. [Atoms (React Bridge)](#atoms)
10. [Services](#services)
11. [Tests](#tests)
12. [IIoT → Chronicle Mapping](#iiot--chronicle-mapping)
13. [Migration Path](#migration-path)

---

## Design Philosophy

Chronicle follows the same layered architecture as the IIoT Alarm system. The core insight:

**IIoT Alarm** manages a lifecycle entity (alarm) through ISA-18.2 states with graph-validated transitions, swappable state backends (InMemory / SQL), and Effect Machine procedures.

**Chronicle Day** manages a lifecycle entity (day) through day states with graph-validated transitions, swappable state backends (InMemory / LocalStorage / future SQL), and Effect Machine procedures.

The pattern is isomorphic. What changes is the domain, not the architecture.

### Key Differences from IIoT

| Aspect | IIoT Alarm | Chronicle Day |
|--------|-----------|---------------|
| **Entity scope** | Single alarm instance | Single calendar day (keyed by `DateKey`) |
| **State machine** | ISA-18.2 alarm lifecycle | Day lifecycle: `empty → active → rich → archived` |
| **Persistence** | SQL (production) + InMemory (test) | LocalStorage/IndexedDB (v1) + SQL (future) |
| **Distribution** | Cluster (Entity + Sharding) | Local-first (no cluster needed yet) |
| **Event sourcing** | Full (per ADR-0012) | Append-only day log (future) |
| **Feature flags** | ES migration flags | Not needed v1 |
| **React bridge** | None (server-side) | effect-atom (Atom as State) |

### What We Take Directly

- `Context.Tag` + `StateShape` interface pattern
- `InMemory` implementation with `Ref<Map>` for testing
- `Machine.make()` + `Machine.procedures.add()` for lifecycle
- `Graph.directed()` for transition validation
- `Schema.TaggedClass` for entities, `Schema.TaggedError` for errors
- `Schema.TaggedRequest` for internal machine requests
- `Effect.scoped` + `Effect.provide(InMemory)` test pattern
- Branded IDs (`Schema.brand`)

### What We Adapt

- No `Entity.make()` / `Rpc.make()` / `EntityProxy.toRpcGroup()` — no cluster
- No SQL repo layer — local-first persistence
- Add `Atom.runtime()` layer for React reactivity
- Add `runtimeAtom.fn()` operations for UI-driven mutations

---

## Directory Structure

```
src/lib/getbyshell/calendar/chronicle/
├── ARCHITECTURE.md              # This file
├── index.ts                     # Barrel exports
│
├── schemas/
│   ├── identifiers.ts           # DayId, NoteId, CardId, TaskId, LinkId, etc.
│   ├── day.ts                   # Day aggregate, DaySummary, DayNote, DayCard, etc.
│   ├── commands.ts              # CreateNoteParams, CreateTaskParams, etc.
│   ├── queries.ts               # DayQueryParams, DayFilter
│   └── index.ts                 # Schema barrel
│
├── state/
│   ├── StateShape.ts            # DayStateShape interface + error types
│   ├── DayState.ts              # Context.Tag + InMemory + makeLocalStorageImpl
│   └── index.ts                 # State barrel
│
├── machines/
│   ├── DayMachine.ts            # Machine.make() + procedures (CRUD + domain ops)
│   ├── graphs/
│   │   ├── day-state-graph.ts   # Graph.directed for day lifecycle
│   │   └── index.ts
│   └── index.ts                 # Machine barrel
│
├── atoms/
│   ├── index.ts                 # Atom.runtime() + derived atoms + operations
│   └── selectors.ts             # Derived: monthDays, weekDays, dayById, etc.
│
├── services/
│   ├── ChronicleService.ts      # High-level orchestration (wraps Machine)
│   └── index.ts
│
├── hooks/
│   ├── useDay.ts                # Single day operations
│   ├── useMonth.ts              # Month navigation + day summaries
│   ├── useChronicle.ts          # Fullscreen overlay state
│   └── index.ts
│
├── types.ts                     # Re-export from schemas (EXISTING — will migrate)
│
└── __tests__/
    ├── schemas/
    │   ├── day.test.ts           # Schema decode/encode, methods, identity
    │   └── identifiers.test.ts   # Brand validation
    ├── state/
    │   └── DayState.test.ts      # InMemory CRUD, filtering, pagination
    ├── machines/
    │   ├── day-machine.test.ts   # Full lifecycle, graph-validated transitions
    │   └── graphs/
    │       └── day-state-graph.test.ts  # Transition validation, reachability
    └── atoms/
        └── chronicle-atoms.test.ts     # Atom operations, derived state
```

---

## Layer Map

Tracing a user action through the stack:

```
User clicks "Add Note" on Jan 15
  │
  ▼
useDay('2026-01-15')
  │ calls addNote operation
  ▼
chronicleRuntimeAtom.fn<AddNoteParams>()
  │ runs Effect program
  ▼
ChronicleService.addNote(dayId, params)
  │ delegates to Machine
  ▼
actor.send(new InternalAddNote({ dayId, params }))
  │ Machine procedure
  ▼
Machine.procedures.add<InternalAddNote>()
  │ validates via graph (day must be active/rich)
  │ delegates to state service
  ▼
DayState.get(dayId) → mutate → DayState.set(day)
  │ InMemory: Ref<Map<DayId, Day>>
  │ LocalStorage: JSON serialize + write
  ▼
Machine returns [updatedDay, newMachineState]
  │
  ▼
Atom updated → React re-renders
```

---

## Schemas

### Identifiers (`schemas/identifiers.ts`)

```typescript
import { Schema } from 'effect'

// Branded string IDs for type safety
export const DayId = Schema.String.pipe(Schema.brand('DayId'))
export type DayId = typeof DayId.Type
// Format: "2026-01-15" (DateKey serves as DayId)

export const NoteId = Schema.String.pipe(Schema.brand('NoteId'))
export type NoteId = typeof NoteId.Type

export const CardId = Schema.String.pipe(Schema.brand('CardId'))
export type CardId = typeof CardId.Type

export const DayTaskId = Schema.String.pipe(Schema.brand('DayTaskId'))
export type DayTaskId = typeof DayTaskId.Type

export const LinkId = Schema.String.pipe(Schema.brand('LinkId'))
export type LinkId = typeof LinkId.Type

export const AttachmentId = Schema.String.pipe(Schema.brand('AttachmentId'))
export type AttachmentId = typeof AttachmentId.Type
```

### Day Aggregate (`schemas/day.ts`)

The Day aggregate already exists in `../types.ts` as Phase 1 output. It will be **migrated** into `schemas/day.ts` with these adjustments:

1. Import identifiers from `./identifiers.ts` (branded IDs)
2. Add `DayLifecycleState` schema (for machine)
3. Ensure all sub-entities use branded IDs

```typescript
// Day lifecycle states (for machine)
export const DayLifecycleState = Schema.Literal(
  'empty',       // No content — default for any date
  'active',      // User has interacted, content being added
  'rich',        // Multiple content types present
  'archived'     // Day is in the past and locked
).pipe(
  Schema.brand('@chronicle/Day/fields/DayLifecycleState'),
  Schema.annotations({
    identifier: '@chronicle/DayLifecycleState',
    description: 'Chronicle day lifecycle state',
  })
)
export type DayLifecycleState = typeof DayLifecycleState.Type
```

### Commands (`schemas/commands.ts`)

Following the IIoT pattern of `CreateAlarmParams`, `AcknowledgeAlarmParams`:

```typescript
export const CreateNoteParams = Schema.Struct({
  dayId: DayId,
  content: Schema.NonEmptyString,
  pinned: Schema.optional(Schema.Boolean),
})

export const CreateTaskParams = Schema.Struct({
  dayId: DayId,
  title: Schema.NonEmptyString,
  priority: Schema.optional(Schema.Literal('low', 'medium', 'high', 'urgent')),
  dueTime: Schema.optional(Schema.DateTimeUtc),
})

export const CreateCardParams = Schema.Struct({
  dayId: DayId,
  title: Schema.NonEmptyString,
  content: Schema.optional(Schema.String),
})

export const AddLinkParams = Schema.Struct({
  dayId: DayId,
  targetEntity: LinkableEntity,
  targetId: Schema.String,
  relationship: LinkRelationship,
  discoverer: LinkDiscoverer,
  notes: Schema.optional(Schema.String),
})

export const SetMoodParams = Schema.Struct({
  dayId: DayId,
  sentiment: Sentiment,
  energy: EnergyLevel,
  note: Schema.optional(Schema.String),
})

export const ToggleTaskParams = Schema.Struct({
  dayId: DayId,
  taskId: DayTaskId,
})

export const ArchiveDayParams = Schema.Struct({
  dayId: DayId,
})
```

### Queries (`schemas/queries.ts`)

```typescript
export const DayQueryParams = Schema.Struct({
  from: Schema.optional(DayId),      // Start date
  to: Schema.optional(DayId),        // End date
  hasNotes: Schema.optional(Schema.Boolean),
  hasTasks: Schema.optional(Schema.Boolean),
  hasEvents: Schema.optional(Schema.Boolean),
  lifecycleState: Schema.optional(DayLifecycleState),
  limit: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.positive())),
  offset: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.nonNegative())),
})
```

---

## State

### StateShape (`state/StateShape.ts`)

Directly mirrors `iiot/state/StateShape.ts`:

```typescript
export interface DayFilter {
  readonly from?: string       // DateKey
  readonly to?: string         // DateKey
  readonly lifecycleState?: DayLifecycleState
  readonly hasContent?: boolean
  readonly limit?: number
  readonly offset?: number
}

export class DayStateNotFoundError {
  readonly _tag = 'DayStateNotFoundError'
  constructor(readonly dayId: DayId) {}
}

export interface DayStateShape {
  /** Get or initialize a day (always returns — creates empty if not found) */
  readonly getOrCreate: (dayId: DayId) => Effect.Effect<Day>

  /** Get day by ID (fails if not found) */
  readonly get: (dayId: DayId) => Effect.Effect<Day, DayStateNotFoundError>

  /** Set/update day state */
  readonly set: (day: Day) => Effect.Effect<void>

  /** List days matching filter */
  readonly list: (filter: DayFilter) => Effect.Effect<readonly Day[]>

  /** List day summaries for a month (lightweight) */
  readonly listSummaries: (year: number, month: number) => Effect.Effect<readonly DaySummary[]>

  /** Delete day by ID */
  readonly delete: (dayId: DayId) => Effect.Effect<boolean>

  /** Check if day has content */
  readonly exists: (dayId: DayId) => Effect.Effect<boolean>

  /** Count days matching filter */
  readonly count: (filter: DayFilter) => Effect.Effect<number>
}
```

### DayState Service (`state/DayState.ts`)

```typescript
export class DayState extends Context.Tag('chronicle/DayState')<
  DayState,
  DayStateShape
>() {}

// In-memory implementation (testing)
export const DayStateInMemory: Layer.Layer<DayState> = Layer.effect(
  DayState,
  Ref.make(new Map<DayId, Day>()).pipe(
    Effect.map((store) => ({
      getOrCreate: (dayId) => /* ... */,
      get: (dayId) => /* ... */,
      set: (day) => /* ... */,
      list: (filter) => /* ... */,
      listSummaries: (year, month) => /* ... */,
      delete: (dayId) => /* ... */,
      exists: (dayId) => /* ... */,
      count: (filter) => /* ... */,
    }))
  )
)

// LocalStorage implementation (v1 production)
export const DayStateLocalStorage: Layer.Layer<DayState> = /* ... */

// Future: SQL implementation
// export const makeDayStateSql = (repo: DayRepo) => /* ... */
```

---

## Machines

### Day State Graph (`machines/graphs/day-state-graph.ts`)

```typescript
import { Graph, Option } from 'effect'

export type DayStateNode = 'empty' | 'active' | 'rich' | 'archived'

export type DayTransitionAction =
  | 'Activate'       // empty → active (first content added)
  | 'Enrich'         // active → rich (multiple content types)
  | 'Simplify'       // rich → active (content removed, single type remains)
  | 'Clear'          // active → empty (all content removed)
  | 'Archive'        // active|rich → archived (day locked)
  | 'Unarchive'      // archived → active|rich (day reopened)

/**
 * Day Lifecycle State Graph
 *
 *     ┌─────────┐  Activate   ┌─────────┐
 *     │  empty  │────────────▶│ active  │
 *     └─────────┘             └────┬────┘
 *          ▲ Clear                 │ Enrich
 *          │                       ▼
 *          │                  ┌─────────┐
 *          │                  │  rich   │
 *          │                  └────┬────┘
 *          │    Simplify ──────────┘
 *          │
 *          │         Archive ──────────┐
 *          │                           ▼
 *          │                  ┌──────────┐
 *          └──────────────────│ archived │
 *               Unarchive     └──────────┘
 */
export const dayStateGraph = Graph.directed<DayStateNode, DayTransitionAction>((mutable) => {
  // nodes + edges following alarm-state-graph.ts pattern
})

// Validators
export const canActivate = (s: DayStateNode) => s === 'empty'
export const canEnrich = (s: DayStateNode) => s === 'active'
export const canSimplify = (s: DayStateNode) => s === 'rich'
export const canClear = (s: DayStateNode) => s === 'active'
export const canArchive = (s: DayStateNode) => s === 'active' || s === 'rich'
export const canUnarchive = (s: DayStateNode) => s === 'archived'
```

### DayMachine (`machines/DayMachine.ts`)

```typescript
// Internal requests (same pattern as AlarmMachine)
export class InternalGetDay extends Schema.TaggedRequest<InternalGetDay>()(/* ... */) {}
export class InternalAddNote extends Schema.TaggedRequest<InternalAddNote>()(/* ... */) {}
export class InternalAddTask extends Schema.TaggedRequest<InternalAddTask>()(/* ... */) {}
export class InternalAddCard extends Schema.TaggedRequest<InternalAddCard>()(/* ... */) {}
export class InternalToggleTask extends Schema.TaggedRequest<InternalToggleTask>()(/* ... */) {}
export class InternalSetMood extends Schema.TaggedRequest<InternalSetMood>()(/* ... */) {}
export class InternalAddLink extends Schema.TaggedRequest<InternalAddLink>()(/* ... */) {}
export class InternalArchiveDay extends Schema.TaggedRequest<InternalArchiveDay>()(/* ... */) {}

// Machine errors
export class MachineDayNotFoundError extends Schema.TaggedError<...>()(/* ... */) {}
export class MachineInvalidTransitionError extends Schema.TaggedError<...>()(/* ... */) {}
export class MachineDayArchivedError extends Schema.TaggedError<...>()(/* ... */) {}

// Dependencies
export interface DayMachineDeps {
  readonly state: DayStateShape
}

// Factory
export const makeDayMachine = (deps: DayMachineDeps) =>
  Machine.make((_input: void, previous?: DayMachineState) =>
    Effect.gen(function* () {
      const { state } = deps
      const initial: DayMachineState = previous ?? { mode: 'empty' }

      return pipe(
        Machine.procedures.make(initial),

        // GET
        Machine.procedures.add<InternalGetDay>()(/* ... */),

        // ADD NOTE (validates not archived, auto-transitions empty→active)
        Machine.procedures.add<InternalAddNote>()(/* ... */),

        // ADD TASK
        Machine.procedures.add<InternalAddTask>()(/* ... */),

        // ADD CARD
        Machine.procedures.add<InternalAddCard>()(/* ... */),

        // TOGGLE TASK
        Machine.procedures.add<InternalToggleTask>()(/* ... */),

        // SET MOOD
        Machine.procedures.add<InternalSetMood>()(/* ... */),

        // ADD LINK
        Machine.procedures.add<InternalAddLink>()(/* ... */),

        // ARCHIVE (graph-validated)
        Machine.procedures.add<InternalArchiveDay>()(/* ... */),
      )
    })
  )
```

**Key insight from IIoT**: The Machine handles **auto-transitions**. When a note is added to an `empty` day, the machine transitions it to `active`. When a second content type is added, it transitions to `rich`. This is domain logic encoded in the machine, not the UI.

---

## Atoms

### Chronicle Runtime Atom (`atoms/index.ts`)

```typescript
import { Atom } from '@effect-rx/rx-react'
import { DayState, DayStateInMemory } from '../state'
import { ChronicleService } from '../services'

// Runtime atom — provides DayState + ChronicleService
export const chronicleRuntimeAtom = Atom.runtime(
  Layer.mergeAll(
    DayStateInMemory,   // Swap for DayStateLocalStorage in production
    ChronicleService.Default,
  )
)

// ─── Derived Atoms ──────────────────────────────────────────────────

/** Current selected day */
export const selectedDayAtom = Atom.make<DayId | null>(null)

/** Current month being viewed */
export const viewingMonthAtom = Atom.make<{ year: number; month: number }>({
  year: new Date().getFullYear(),
  month: new Date().getMonth(),
})

/** Day summaries for current month (derived) */
export const monthSummariesAtom = chronicleRuntimeAtom.atom(
  Effect.gen(function* () {
    const svc = yield* ChronicleService
    const { year, month } = Atom.get(viewingMonthAtom)
    return yield* svc.getMonthSummaries(year, month)
  })
)

/** Full Day entity for selected day (derived) */
export const selectedDayEntityAtom = chronicleRuntimeAtom.atom(
  Effect.gen(function* () {
    const dayId = Atom.get(selectedDayAtom)
    if (!dayId) return null
    const svc = yield* ChronicleService
    return yield* svc.getDay(dayId)
  })
)

// ─── Mutation Operations ────────────────────────────────────────────

export const addNoteOp = chronicleRuntimeAtom.fn<CreateNoteParams>()(
  (params, ctx) => Effect.gen(function* () {
    const svc = yield* ChronicleService
    const day = yield* svc.addNote(params)
    // Atom updates automatically via runtime subscription
    return day
  })
)

export const addTaskOp = chronicleRuntimeAtom.fn<CreateTaskParams>()(/* ... */)
export const toggleTaskOp = chronicleRuntimeAtom.fn<ToggleTaskParams>()(/* ... */)
export const setMoodOp = chronicleRuntimeAtom.fn<SetMoodParams>()(/* ... */)
export const archiveDayOp = chronicleRuntimeAtom.fn<ArchiveDayParams>()(/* ... */)
```

---

## Services

### ChronicleService (`services/ChronicleService.ts`)

High-level orchestration that boots a DayMachine and delegates:

```typescript
export class ChronicleService extends Context.Tag('chronicle/ChronicleService')<
  ChronicleService,
  ChronicleServiceShape
>() {
  static Default = Layer.effect(
    ChronicleService,
    Effect.gen(function* () {
      const state = yield* DayState
      const machine = makeDayMachine({ state })
      const actor = yield* Machine.boot(machine)

      return {
        getDay: (dayId) => actor.send(new InternalGetDay({ dayId })),
        addNote: (params) => actor.send(new InternalAddNote({ params })),
        addTask: (params) => actor.send(new InternalAddTask({ params })),
        toggleTask: (params) => actor.send(new InternalToggleTask({ params })),
        setMood: (params) => actor.send(new InternalSetMood({ params })),
        addLink: (params) => actor.send(new InternalAddLink({ params })),
        archiveDay: (params) => actor.send(new InternalArchiveDay({ params })),
        getMonthSummaries: (year, month) => state.listSummaries(year, month),
      }
    })
  )
}
```

---

## Tests

### Test Strategy

Following the IIoT test patterns exactly:

| Test Layer | File | What | Pattern |
|-----------|------|------|---------|
| **Schema** | `schemas/day.test.ts` | Decode/encode roundtrip, methods (`isEmpty`, `taskCompletion`), branded IDs | `describe` + `it` (pure) |
| **Graph** | `graphs/day-state-graph.test.ts` | Transition validation, reachability, all-states coverage | `describe` + `it` (pure) |
| **State** | `state/DayState.test.ts` | CRUD operations, filtering, pagination, getOrCreate semantics | `it.effect` + `Effect.provide(DayStateInMemory)` |
| **Machine** | `machines/day-machine.test.ts` | Full lifecycle, graph-validated transitions, error cases | `it.effect` + `Effect.scoped` + `Effect.provide(DayStateInMemory)` |
| **Atoms** | `atoms/chronicle-atoms.test.ts` | Atom operations, derived state, mutation ops | Atom test pattern |

### Machine Test Pattern (from IIoT)

```typescript
describe('DayMachine', () => {
  describe('ADD NOTE procedure', () => {
    it.effect('adds note to empty day, transitions to active', () =>
      Effect.gen(function* () {
        const state = yield* DayState
        const machine = makeDayMachine({ state })
        const actor = yield* Machine.boot(machine)

        const day = yield* actor.send(
          new InternalAddNote({
            params: { dayId: '2026-01-15' as DayId, content: 'Hello world' },
          })
        )

        expect(day.notes).toHaveLength(1)
        expect(day.lifecycleState).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(DayStateInMemory)
      )
    )

    it.effect('rejects note on archived day', () =>
      Effect.gen(function* () {
        // ... archive day first, then try adding note
        const result = yield* actor.send(
          new InternalAddNote({ params: { dayId, content: 'nope' } })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineDayArchivedError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(DayStateInMemory)
      )
    )
  })

  describe('lifecycle flow', () => {
    it.effect('empty → active → rich → archived', () =>
      Effect.gen(function* () {
        // Create note → active
        // Create task → rich (two content types)
        // Archive → archived
        // Verify each transition
      }).pipe(
        Effect.scoped,
        Effect.provide(DayStateInMemory)
      )
    )
  })
})
```

---

## IIoT → Chronicle Mapping

Complete 1:1 mapping of every IIoT Alarm file to its Chronicle equivalent:

| IIoT File | Chronicle File | Status |
|-----------|---------------|--------|
| `schemas/identifiers.ts` (AlarmId) | `chronicle/schemas/identifiers.ts` (DayId, NoteId, ...) | **TODO** |
| `schemas/alarms.ts` (Alarm class) | `chronicle/schemas/day.ts` (Day class) | **MIGRATE** from `types.ts` |
| — | `chronicle/schemas/commands.ts` | **TODO** |
| — | `chronicle/schemas/queries.ts` | **TODO** |
| `state/StateShape.ts` (AlarmStateShape) | `chronicle/state/StateShape.ts` (DayStateShape) | **TODO** |
| `state/AlarmState.ts` (InMemory + SQL) | `chronicle/state/DayState.ts` (InMemory + LocalStorage) | **TODO** |
| `machines/graphs/alarm-state-graph.ts` | `chronicle/machines/graphs/day-state-graph.ts` | **TODO** |
| `machines/AlarmMachine.ts` | `chronicle/machines/DayMachine.ts` | **TODO** |
| `entity/AlarmEntity.ts` | — (no cluster, service wraps machine directly) | N/A |
| `rpc/AlarmRpcs.ts` | — (local-first, no RPC needed v1) | N/A |
| — | `chronicle/services/ChronicleService.ts` | **TODO** |
| — | `chronicle/atoms/index.ts` | **TODO** |
| — | `chronicle/hooks/useDay.ts` | **TODO** |
| `__tests__/machines/alarm-machine.test.ts` | `chronicle/__tests__/machines/day-machine.test.ts` | **TODO** |
| `__tests__/schemas/...` | `chronicle/__tests__/schemas/day.test.ts` | **TODO** |
| `infrastructure/feature-flags.ts` | — (not needed v1) | N/A |
| `tags.ts` | — (not needed, no RPC tags) | N/A |
| `repos/AlarmRepo.ts` | — (future, when SQL persistence added) | N/A |
| `models/alarms/AlarmModel.ts` | — (future, when SQL persistence added) | N/A |

---

## Migration Path

### Phase 1 — Schemas (DONE)
- [x] Day entity types in `types.ts`
- [x] Chronicle state schemas in `chronicle/types.ts`
- [x] Melanie types in `maidens/melanie/types.ts`

### Phase 2 — Spine (NEXT)
1. Create `chronicle/schemas/` directory, migrate types from `types.ts`
2. Add branded identifiers
3. Create `DayLifecycleState` schema
4. Create command/query param schemas
5. Create `state/StateShape.ts` + `state/DayState.ts` (InMemory)
6. Create `machines/graphs/day-state-graph.ts`
7. Create `machines/DayMachine.ts`
8. Create `services/ChronicleService.ts`
9. Tests for each layer

### Phase 3 — React Bridge
1. Create `atoms/index.ts` with `chronicleRuntimeAtom`
2. Create derived atoms (month summaries, selected day)
3. Create mutation operations (`addNoteOp`, `addTaskOp`, etc.)
4. Create hooks (`useDay`, `useMonth`, `useChronicle`)

### Phase 4 — Persistence
1. LocalStorage/IndexedDB implementation of `DayStateShape`
2. Swap `DayStateInMemory` → `DayStateLocalStorage` in production atom

### Phase 5 — UI
1. Fullscreen overlay with holographic entrance
2. Day detail view with content sections
3. Month grid with `DaySummary` rendering
4. Canvas integration (y-sweet + TipTap)

### Phase 6 — Intelligence
1. MELANIE integration for knowledge links
2. Auto-discovery of connections between days
3. Daily digest generation
4. Temporal pattern analysis

---

## Implementation Order (Files)

Strict dependency order — each file only imports from files above it:

```
1. chronicle/schemas/identifiers.ts     ← no deps
2. chronicle/schemas/day.ts             ← identifiers
3. chronicle/schemas/commands.ts        ← identifiers, day
4. chronicle/schemas/queries.ts         ← identifiers, day
5. chronicle/schemas/index.ts           ← barrel
6. chronicle/state/StateShape.ts        ← schemas
7. chronicle/state/DayState.ts          ← StateShape, schemas
8. chronicle/state/index.ts             ← barrel
9. chronicle/machines/graphs/day-state-graph.ts  ← schemas (DayLifecycleState)
10. chronicle/machines/DayMachine.ts    ← state, graphs, schemas
11. chronicle/machines/index.ts         ← barrel
12. chronicle/services/ChronicleService.ts ← machines, state
13. chronicle/services/index.ts         ← barrel
14. chronicle/atoms/index.ts            ← services, state, schemas
15. chronicle/atoms/selectors.ts        ← atoms
16. chronicle/hooks/useDay.ts           ← atoms
17. chronicle/hooks/useMonth.ts         ← atoms
18. chronicle/hooks/useChronicle.ts     ← atoms, types
19. chronicle/hooks/index.ts            ← barrel
20. chronicle/index.ts                  ← barrel (re-exports everything)
```

Tests mirror this order — schemas first, state second, machines third.
