/**
 * EquipmentStateService - State Service for Equipment State & OEE
 *
 * Effect.Service for equipment state management with swappable implementations.
 * Provides in-memory (testing) and SQL (production) layers.
 *
 * @module
 */

import { Effect, Context, Layer, Option, Ref, DateTime } from 'effect'
import type { MachineId } from '../schemas/identifiers'
import {
  EquipmentState,
  EquipmentStateId,
  makeEquipmentStateId,
} from '../schemas/equipment-state/schema'
import {
  EquipmentStateShapeInterface,
  EquipmentStateFilter,
  EquipmentStateNotFoundError,
  CreateEquipmentStateInput,
} from './StateShape'

// =============================================================================
// ID Generation
// =============================================================================

let equipmentStateCounter = 0

/** Generate a unique equipment state ID for in-memory testing */
const generateEquipmentStateId = (): EquipmentStateId =>
  makeEquipmentStateId(`${Date.now()}-${++equipmentStateCounter}`)

// =============================================================================
// Service Definition
// =============================================================================

/**
 * EquipmentStateService Tag
 *
 * Usage:
 * ```ts
 * const program = Effect.gen(function* () {
 *   const state = yield* EquipmentStateService
 *   const current = yield* state.getCurrent(machineId)
 * })
 * ```
 */
export class EquipmentStateService extends Context.Tag('iiot/EquipmentStateService')<
  EquipmentStateService,
  EquipmentStateShapeInterface
>() {}

// =============================================================================
// In-Memory State Container
// =============================================================================

interface InMemoryStore {
  states: Map<EquipmentStateId, EquipmentState>
  currentStates: Map<MachineId, EquipmentStateId>
}

const makeInMemoryStore = (): InMemoryStore => ({
  states: new Map(),
  currentStates: new Map(),
})

// =============================================================================
// In-Memory Implementation
// =============================================================================

/**
 * In-memory equipment state implementation for testing.
 */
export const EquipmentStateInMemory: Layer.Layer<EquipmentStateService> = Layer.effect(
  EquipmentStateService,
  Ref.make(makeInMemoryStore()).pipe(
    Effect.map((storeRef) => {
      const matchesFilter = (state: EquipmentState, filter: EquipmentStateFilter): boolean => {
        if (filter.machineId && state.machineId !== filter.machineId) return false
        if (filter.state && state.state !== filter.state) return false
        if (filter.reason) {
          const stateReason = Option.getOrNull(state.reason)
          if (stateReason !== filter.reason) return false
        }
        if (filter.onlyActive && !state.isActive()) return false
        if (filter.since) {
          const sinceMs = filter.since.getTime()
          const stateMs = Number(state.startedAt.epochMillis)
          if (stateMs < sinceMs) return false
        }
        if (filter.until) {
          const untilMs = filter.until.getTime()
          const stateMs = Number(state.startedAt.epochMillis)
          if (stateMs > untilMs) return false
        }
        return true
      }

      return {
        create: (input: CreateEquipmentStateInput) =>
          Effect.gen(function* () {
            const id = generateEquipmentStateId()
            const now = yield* DateTime.now
            const equipmentState = new EquipmentState({
              id,
              machineId: input.machineId,
              state: input.state,
              reason: input.reason,
              startedAt: now,
              endedAt: Option.none(),
              operatorId: input.operatorId,
              notes: input.notes,
              metadata: {},
            })
            yield* Ref.update(storeRef, (store) => {
              const newStates = new Map(store.states)
              newStates.set(id, equipmentState)
              const newCurrentStates = new Map(store.currentStates)
              // Set this as the current state for the machine
              newCurrentStates.set(input.machineId, id)
              return { states: newStates, currentStates: newCurrentStates }
            })
            return equipmentState
          }),

        get: (id: EquipmentStateId) =>
          Ref.get(storeRef).pipe(
            Effect.flatMap((store) => {
              const state = store.states.get(id)
              if (!state) {
                return Effect.fail(new EquipmentStateNotFoundError(id))
              }
              return Effect.succeed(state)
            })
          ),

        getCurrent: (machineId: MachineId) =>
          Ref.get(storeRef).pipe(
            Effect.map((store) => {
              const currentId = store.currentStates.get(machineId)
              if (!currentId) return Option.none<EquipmentState>()
              const state = store.states.get(currentId)
              return state ? Option.some(state) : Option.none<EquipmentState>()
            })
          ),

        set: (state: EquipmentState) =>
          Ref.update(storeRef, (store) => {
            const newStates = new Map(store.states)
            newStates.set(state.id, state)
            const newCurrentStates = new Map(store.currentStates)
            if (state.isActive()) {
              newCurrentStates.set(state.machineId, state.id)
            }
            return { states: newStates, currentStates: newCurrentStates }
          }),

        list: (filter: EquipmentStateFilter) =>
          Ref.get(storeRef).pipe(
            Effect.map((store) => {
              let states = Array.from(store.states.values()).filter((s) =>
                matchesFilter(s, filter)
              )

              // Sort by startedAt descending
              states.sort((a, b) =>
                Number(b.startedAt.epochMillis) - Number(a.startedAt.epochMillis)
              )

              // Apply pagination
              if (filter.offset) {
                states = states.slice(filter.offset)
              }
              if (filter.limit) {
                states = states.slice(0, filter.limit)
              }

              return states
            })
          ),

        endCurrent: (machineId: MachineId, endedAt: Date) =>
          Ref.modify(storeRef, (store) => {
            const currentId = store.currentStates.get(machineId)
            if (!currentId) return [false, store] as const

            const currentState = store.states.get(currentId)
            if (!currentState) return [false, store] as const

            // Update the state with endedAt
            const updatedState = new EquipmentState({
              ...currentState,
              endedAt: Option.some(DateTime.unsafeFromDate(endedAt)),
            })

            const newStates = new Map(store.states)
            newStates.set(currentId, updatedState)
            const newCurrentStates = new Map(store.currentStates)
            newCurrentStates.delete(machineId)

            return [true, { states: newStates, currentStates: newCurrentStates }] as const
          }),

        delete: (id: EquipmentStateId) =>
          Ref.modify(storeRef, (store) => {
            const existed = store.states.has(id)
            if (!existed) return [false, store] as const

            const newStates = new Map(store.states)
            newStates.delete(id)

            // Also clean up currentStates if this was a current state
            const newCurrentStates = new Map(store.currentStates)
            Array.from(newCurrentStates.entries()).forEach(([machineId, stateId]) => {
              if (stateId === id) {
                newCurrentStates.delete(machineId)
              }
            })

            return [true, { states: newStates, currentStates: newCurrentStates }] as const
          }),

        count: (filter: EquipmentStateFilter) =>
          Ref.get(storeRef).pipe(
            Effect.map((store) =>
              Array.from(store.states.values()).filter((s) => matchesFilter(s, filter)).length
            )
          ),
      }
    })
  )
)

// =============================================================================
// SQL Factory
// =============================================================================

/**
 * Factory to create SQL-backed equipment state from a repository.
 */
export const makeEquipmentStateSql = (repo: {
  findById: (id: EquipmentStateId) => Effect.Effect<Option.Option<EquipmentState>, unknown>
  findByMachine: (machineId: MachineId, filter: EquipmentStateFilter) => Effect.Effect<readonly EquipmentState[], unknown>
  findActive: (machineId: MachineId) => Effect.Effect<Option.Option<EquipmentState>, unknown>
  insert: (state: EquipmentState) => Effect.Effect<EquipmentState, unknown>
  update: (state: Partial<EquipmentState> & { id: EquipmentStateId }) => Effect.Effect<EquipmentState, unknown>
  endState: (id: EquipmentStateId, endedAt: Date) => Effect.Effect<boolean, unknown>
  delete: (id: EquipmentStateId) => Effect.Effect<boolean, unknown>
  /** Insert with DB-generated ID. If not provided, falls back to insert() */
  insertWithGeneratedId?: (input: CreateEquipmentStateInput) => Effect.Effect<EquipmentState, unknown>
}): EquipmentStateShapeInterface => ({
  create: (input: CreateEquipmentStateInput) =>
    repo.insertWithGeneratedId
      ? repo.insertWithGeneratedId(input).pipe(Effect.orDie)
      : Effect.gen(function* () {
          // Fallback: generate ID client-side if repo doesn't support generated IDs
          const id = generateEquipmentStateId()
          const now = yield* DateTime.now
          const equipmentState = new EquipmentState({
            id,
            machineId: input.machineId,
            state: input.state,
            reason: input.reason,
            startedAt: now,
            endedAt: Option.none(),
            operatorId: input.operatorId,
            notes: input.notes,
            metadata: {},
          })
          return yield* repo.insert(equipmentState).pipe(Effect.orDie)
        }),

  get: (id) =>
    repo.findById(id).pipe(
      Effect.flatMap((opt) =>
        Option.isSome(opt)
          ? Effect.succeed(opt.value)
          : Effect.fail(new EquipmentStateNotFoundError(id))
      ),
      Effect.catchAll(() => Effect.fail(new EquipmentStateNotFoundError(id)))
    ),

  getCurrent: (machineId) =>
    repo.findActive(machineId).pipe(
      Effect.catchAll(() => Effect.succeed(Option.none<EquipmentState>()))
    ),

  set: (state) =>
    repo.findById(state.id).pipe(
      Effect.flatMap((existing) =>
        Option.isSome(existing)
          ? repo.update(state as Partial<EquipmentState> & { id: EquipmentStateId })
          : repo.insert(state)
      ),
      Effect.asVoid,
      Effect.catchAll(() => Effect.void)
    ),

  list: (filter) =>
    filter.machineId
      ? repo.findByMachine(filter.machineId, filter).pipe(
          Effect.catchAll(() => Effect.succeed([]))
        )
      : Effect.succeed([]), // Without machineId, return empty (use repo directly for all)

  endCurrent: (machineId, endedAt) =>
    repo.findActive(machineId).pipe(
      Effect.flatMap((opt) =>
        Option.isSome(opt)
          ? repo.endState(opt.value.id, endedAt)
          : Effect.succeed(false)
      ),
      Effect.catchAll(() => Effect.succeed(false))
    ),

  delete: (id) =>
    repo.delete(id).pipe(
      Effect.catchAll(() => Effect.succeed(false))
    ),

  count: (filter) =>
    filter.machineId
      ? repo.findByMachine(filter.machineId, { ...filter, limit: undefined, offset: undefined }).pipe(
          Effect.map((states) => states.length),
          Effect.catchAll(() => Effect.succeed(0))
        )
      : Effect.succeed(0),
})
