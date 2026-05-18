/**
 * EquipmentStateMachine Integration Tests
 *
 * Tests the Machine + StateService + Graph validation integration.
 * Verifies ISA-95/OEE state transitions are enforced.
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Layer, Option, DateTime } from 'effect'
import { Machine } from '@effect/experimental'
import * as EventLog from '@effect/experimental/EventLog'
import * as EventJournal from '@effect/experimental/EventJournal'
import {
  makeEquipmentStateMachine,
  InternalGetCurrent,
  InternalGetHistory,
  InternalTransition,
  InternalUpdateReason,
  InternalGetOee,
  InternalGetDurations,
} from '../../machines/EquipmentStateMachine'
import { EquipmentState, makeEquipmentStateId, type StateType, type StateReason } from '../../schemas/equipment-state/schema'
import type { MachineId } from '../../schemas/identifiers'
import type { EquipmentStateShapeInterface, CreateEquipmentStateInput, EquipmentStateFilter } from '../../state/StateShape'
import type { FeatureFlagsShape } from '../../infrastructure/feature-flags'
import {
  IIoTDomainEventHandlersLayer,
  IIoTEventLogLayer,
} from '../../infrastructure/eventlog-layer'
import { DomainEventEmitter, DomainEventEmitterLive, type DomainEventEmitterShape } from '../../services/events'

// =============================================================================
// Test Stubs
// =============================================================================

/**
 * Create an in-memory stub for EquipmentStateShapeInterface
 */
const createStubEquipmentStateService = (): EquipmentStateShapeInterface => {
  const store = new Map<string, EquipmentState>()
  let idCounter = 0

  return {
    create: (input: CreateEquipmentStateInput) =>
      Effect.gen(function* () {
        const now = yield* DateTime.now
        const id = makeEquipmentStateId(`test-${++idCounter}`)
        const state = new EquipmentState({
          id,
          machineId: input.machineId,
          state: input.state,
          reason: input.reason,
          operatorId: input.operatorId,
          notes: input.notes,
          startedAt: now,
          endedAt: Option.none(),
          metadata: {},
        })
        store.set(id, state)
        return state
      }),

    get: (id) =>
      Effect.gen(function* () {
        const state = store.get(id)
        if (!state) {
          return yield* Effect.fail({ _tag: 'EquipmentStateNotFoundError' as const, stateId: id })
        }
        return state
      }),

    getCurrent: (machineId) =>
      Effect.sync(() => {
        const states = Array.from(store.values())
          .filter((s) => s.machineId === machineId && Option.isNone(s.endedAt))
          .sort((a, b) => Number(b.startedAt.epochMillis) - Number(a.startedAt.epochMillis))
        return states.length > 0 ? Option.some(states[0]) : Option.none()
      }),

    set: (state) =>
      Effect.sync(() => {
        store.set(state.id, state)
      }),

    list: (filter: EquipmentStateFilter) =>
      Effect.sync(() => {
        let states = Array.from(store.values())
        if (filter.machineId) {
          states = states.filter((s) => s.machineId === filter.machineId)
        }
        if (filter.state) {
          states = states.filter((s) => s.state === filter.state)
        }
        if (filter.since) {
          states = states.filter((s) => Number(s.startedAt.epochMillis) >= filter.since!.getTime())
        }
        if (filter.until) {
          states = states.filter((s) => Number(s.startedAt.epochMillis) <= filter.until!.getTime())
        }
        if (filter.onlyActive) {
          states = states.filter((s) => Option.isNone(s.endedAt))
        }
        // Sort by startedAt ascending
        states.sort((a, b) => Number(a.startedAt.epochMillis) - Number(b.startedAt.epochMillis))
        const limit = filter.limit ?? 100
        const offset = filter.offset ?? 0
        return states.slice(offset, offset + limit)
      }),

    endCurrent: (machineId, endedAt) =>
      Effect.gen(function* () {
        const current = yield* Effect.sync(() => {
          const states = Array.from(store.values())
            .filter((s) => s.machineId === machineId && Option.isNone(s.endedAt))
          return states.length > 0 ? states[0] : null
        })

        if (current) {
          const ended = new EquipmentState({
            ...current,
            endedAt: Option.some(DateTime.unsafeFromDate(endedAt)),
          })
          store.set(current.id, ended)
          return true
        }
        return false
      }),

    delete: (id) =>
      Effect.sync(() => {
        if (store.has(id)) {
          store.delete(id)
          return true
        }
        return false
      }),

    count: (filter) =>
      Effect.gen(function* () {
        const states = yield* Effect.sync(() => Array.from(store.values()))
        let filtered = states
        if (filter.machineId) {
          filtered = filtered.filter((s) => s.machineId === filter.machineId)
        }
        return filtered.length
      }),
  }
}

/**
 * Stub feature flags with events disabled
 */
const stubFeatureFlags: FeatureFlagsShape = {
  alarmEventSourcingEnabled: false,
  workOrderEventSourcingEnabled: false,
  equipmentStateEventSourcingEnabled: false,
  batchRecordEventSourcingEnabled: false,
  pgLakeEnabled: false,
}

const equipmentEventSourcingFlags: FeatureFlagsShape = {
  ...stubFeatureFlags,
  equipmentStateEventSourcingEnabled: true,
}

const makeDomainEventEmitterLayer = (journal: EventJournal.EventJournal.Service) => {
  const baseLayer = Layer.mergeAll(
    Layer.succeed(EventJournal.EventJournal, journal),
    Layer.succeed(EventLog.Identity, EventLog.Identity.makeRandom()),
    IIoTDomainEventHandlersLayer,
  )

  return DomainEventEmitterLive.pipe(
    Layer.provide(IIoTEventLogLayer.pipe(Layer.provide(baseLayer))),
  )
}

// =============================================================================
// Test Helpers
// =============================================================================

const TEST_MACHINE_ID = 'MCH-test-001' as MachineId

const createBootedMachine = (options?: {
  readonly flags?: FeatureFlagsShape
  readonly eventEmitter?: DomainEventEmitterShape
}) =>
  Effect.gen(function* () {
    const state = createStubEquipmentStateService()
    const machine = makeEquipmentStateMachine({
      state,
      flags: options?.flags ?? stubFeatureFlags,
      eventEmitter: options?.eventEmitter,
    })
    const actor = yield* Machine.boot(machine)
    return { actor, state }
  })

// =============================================================================
// Tests
// =============================================================================

describe('EquipmentStateMachine', () => {
  describe('TRANSITION procedure (initial)', () => {
    it.effect('creates initial state when no current state exists', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        const result = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.some('production' as StateReason),
            operatorId: Option.some('OP-001'),
            notes: Option.none(),
          })
        )

        expect(result.state).toBe('running')
        expect(result.machineId).toBe(TEST_MACHINE_ID)
        expect(Option.getOrNull(result.reason)).toBe('production')
        expect(Option.getOrNull(result.operatorId)).toBe('OP-001')
      }).pipe(Effect.scoped)
    )
  })

  describe('EVENT EMISSION', () => {
    it.effect('writes EquipmentStateChanged to the EventJournal when event sourcing is enabled', () =>
      Effect.gen(function* () {
        const journal = yield* EventJournal.makeMemory
        const emitterLayer = makeDomainEventEmitterLayer(journal)

        yield* Effect.gen(function* () {
          const eventEmitter = yield* DomainEventEmitter
          const { actor } = yield* createBootedMachine({
            flags: equipmentEventSourcingFlags,
            eventEmitter,
          })

          yield* actor.send(
            new InternalTransition({
              machineId: TEST_MACHINE_ID,
              newState: 'planned_downtime' as StateType,
              reason: Option.some('scheduled_maintenance' as StateReason),
              operatorId: Option.some('OP-001'),
              notes: Option.some('Planned maintenance window'),
            })
          )

          const entries = yield* journal.entries

          expect(entries).toHaveLength(1)
          expect(entries[0]?.event).toBe('EquipmentStateChanged')
        }).pipe(
          Effect.scoped,
          Effect.provide(emitterLayer),
        )
      })
    )
  })

  describe('GET_CURRENT procedure', () => {
    it.effect('retrieves current state after transition', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        // Create initial state
        yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.none(),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        const current = yield* actor.send(
          new InternalGetCurrent({ machineId: TEST_MACHINE_ID })
        )

        expect(current.state).toBe('running')
        expect(current.machineId).toBe(TEST_MACHINE_ID)
      }).pipe(Effect.scoped)
    )

    it.effect('fails with MachineMachineStateNotFoundError for machine with no state', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        const result = yield* actor.send(
          new InternalGetCurrent({ machineId: TEST_MACHINE_ID })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineMachineStateNotFoundError')
        }
      }).pipe(Effect.scoped)
    )
  })

  describe('TRANSITION procedure (graph-validated)', () => {
    it.effect('transitions from running to idle (valid: StopProduction)', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        // Start in running
        yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.none(),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        // Transition to idle
        const result = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'idle' as StateType,
            reason: Option.some('no_order' as StateReason),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        expect(result.state).toBe('idle')
        expect(Option.getOrNull(result.reason)).toBe('no_order')
      }).pipe(Effect.scoped)
    )

    it.effect('transitions from running to unplanned_downtime (valid: ReportBreakdown)', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.none(),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        const result = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'unplanned_downtime' as StateType,
            reason: Option.some('breakdown' as StateReason),
            operatorId: Option.none(),
            notes: Option.some('Motor failure'),
          })
        )

        expect(result.state).toBe('unplanned_downtime')
        expect(Option.getOrNull(result.reason)).toBe('breakdown')
      }).pipe(Effect.scoped)
    )

    it.effect('transitions from idle to running (valid: StartProduction)', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'idle' as StateType,
            reason: Option.none(),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        const result = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.some('production' as StateReason),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        expect(result.state).toBe('running')
      }).pipe(Effect.scoped)
    )

    it.effect('fails when transitioning to same state (no-op)', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.none(),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        const result = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.none(),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineEquipmentTransitionError')
        }
      }).pipe(Effect.scoped)
    )

    it.effect('fails on invalid transition: planned_downtime → blocked', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'planned_downtime' as StateType,
            reason: Option.none(),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        // planned_downtime → blocked is NOT a valid transition
        const result = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'blocked' as StateType,
            reason: Option.none(),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineEquipmentTransitionError')
        }
      }).pipe(Effect.scoped)
    )
  })

  describe('GET_HISTORY procedure', () => {
    it.effect('retrieves state history for a machine', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        // Create multiple state transitions
        yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'idle' as StateType,
            reason: Option.none(),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.none(),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'blocked' as StateType,
            reason: Option.some('starved' as StateReason),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        const history = yield* actor.send(
          new InternalGetHistory({
            machineId: TEST_MACHINE_ID,
            since: Option.none(),
            until: Option.none(),
            limit: 100,
          })
        )

        expect(history.length).toBe(3)
        expect(history[0].state).toBe('idle')
        expect(history[1].state).toBe('running')
        expect(history[2].state).toBe('blocked')
      }).pipe(Effect.scoped)
    )

    it.effect('fails when machine has no history', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        const result = yield* actor.send(
          new InternalGetHistory({
            machineId: TEST_MACHINE_ID,
            since: Option.none(),
            until: Option.none(),
            limit: 100,
          })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineMachineStateNotFoundError')
        }
      }).pipe(Effect.scoped)
    )
  })

  describe('UPDATE_REASON procedure', () => {
    it.effect('updates reason for existing state', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        const created = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'unplanned_downtime' as StateType,
            reason: Option.some('unknown' as StateReason),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        const updated = yield* actor.send(
          new InternalUpdateReason({
            stateId: created.id,
            reason: 'breakdown' as StateReason,
            notes: Option.some('Root cause: motor bearing failure'),
          })
        )

        expect(Option.getOrNull(updated.reason)).toBe('breakdown')
        expect(Option.getOrNull(updated.notes)).toBe('Root cause: motor bearing failure')
      }).pipe(Effect.scoped)
    )

    it.effect('fails for non-existent state', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        const result = yield* actor.send(
          new InternalUpdateReason({
            stateId: makeEquipmentStateId('non-existent'),
            reason: 'breakdown' as StateReason,
            notes: Option.none(),
          })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineEquipmentStateNotFoundError')
        }
      }).pipe(Effect.scoped)
    )
  })

  describe('GET_DURATIONS procedure', () => {
    it.effect('calculates state durations for a time period', () =>
      Effect.gen(function* () {
        const { actor, state } = yield* createBootedMachine()
        const now = yield* DateTime.now

        // Create states with known durations by manipulating the store directly
        yield* state.create({
          machineId: TEST_MACHINE_ID,
          state: 'running' as StateType,
          reason: Option.none(),
          operatorId: Option.none(),
          notes: Option.none(),
        })

        // End first state after 1 hour (simulated)
        const oneHourLater = DateTime.add(now, { hours: 1 })
        yield* state.endCurrent(TEST_MACHINE_ID, new Date(Number(oneHourLater.epochMillis)))

        // Create idle state
        yield* state.create({
          machineId: TEST_MACHINE_ID,
          state: 'idle' as StateType,
          reason: Option.none(),
          operatorId: Option.none(),
          notes: Option.none(),
        })

        const twoHoursLater = DateTime.add(now, { hours: 2 })

        const durations = yield* actor.send(
          new InternalGetDurations({
            machineId: TEST_MACHINE_ID,
            since: now,
            until: twoHoursLater,
          })
        )

        expect(durations.machineId).toBe(TEST_MACHINE_ID)
        // At least running and idle states should have some duration
        expect(durations.runningMs + durations.idleMs).toBeGreaterThan(0)
      }).pipe(Effect.scoped)
    )

    it.effect('fails when machine has no states in period', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()
        const now = yield* DateTime.now
        const later = DateTime.add(now, { hours: 1 })

        const result = yield* actor.send(
          new InternalGetDurations({
            machineId: TEST_MACHINE_ID,
            since: now,
            until: later,
          })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineMachineStateNotFoundError')
        }
      }).pipe(Effect.scoped)
    )
  })

  describe('GET_OEE procedure', () => {
    it.effect('calculates OEE metrics for a time period', () =>
      Effect.gen(function* () {
        const { actor, state } = yield* createBootedMachine()
        const now = yield* DateTime.now

        // Create running state
        yield* state.create({
          machineId: TEST_MACHINE_ID,
          state: 'running' as StateType,
          reason: Option.some('production' as StateReason),
          operatorId: Option.none(),
          notes: Option.none(),
        })

        const oneHourLater = DateTime.add(now, { hours: 1 })

        const oee = yield* actor.send(
          new InternalGetOee({
            machineId: TEST_MACHINE_ID,
            since: now,
            until: oneHourLater,
            theoreticalOutputPerHour: Option.none(),
            goodPartsProduced: Option.none(),
            totalPartsProduced: Option.none(),
          })
        )

        expect(oee.machineId).toBe(TEST_MACHINE_ID)
        // Without production data, performance and quality default to 1
        expect(oee.performance).toBe(1)
        expect(oee.quality).toBe(1)
        // OEE = availability * performance * quality
        expect(oee.oee).toBeGreaterThanOrEqual(0)
        expect(oee.oee).toBeLessThanOrEqual(1)
      }).pipe(Effect.scoped)
    )

    it.effect('calculates OEE with production data', () =>
      Effect.gen(function* () {
        const { actor, state } = yield* createBootedMachine()
        const now = yield* DateTime.now

        // Create running state (1 hour of production)
        yield* state.create({
          machineId: TEST_MACHINE_ID,
          state: 'running' as StateType,
          reason: Option.none(),
          operatorId: Option.none(),
          notes: Option.none(),
        })

        const oneHourLater = DateTime.add(now, { hours: 1 })

        const oee = yield* actor.send(
          new InternalGetOee({
            machineId: TEST_MACHINE_ID,
            since: now,
            until: oneHourLater,
            theoreticalOutputPerHour: Option.some(100), // 100 parts/hour theoretical
            goodPartsProduced: Option.some(80), // 80 good parts
            totalPartsProduced: Option.some(100), // 100 total parts (20 defects)
          })
        )

        // Quality = good/total = 80/100 = 0.8
        expect(oee.quality).toBe(0.8)
        // OEE should be bounded 0-1
        expect(oee.oee).toBeGreaterThanOrEqual(0)
        expect(oee.oee).toBeLessThanOrEqual(1)
      }).pipe(Effect.scoped)
    )

    it.effect('fails when machine has no states in period', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()
        const now = yield* DateTime.now
        const later = DateTime.add(now, { hours: 1 })

        const result = yield* actor.send(
          new InternalGetOee({
            machineId: TEST_MACHINE_ID,
            since: now,
            until: later,
            theoreticalOutputPerHour: Option.none(),
            goodPartsProduced: Option.none(),
            totalPartsProduced: Option.none(),
          })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineMachineStateNotFoundError')
        }
      }).pipe(Effect.scoped)
    )
  })

  describe('ISA-95/OEE lifecycle flow', () => {
    it.effect('completes production shift: idle → running → blocked → running → idle', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        // Start of shift: idle
        const idle1 = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'idle' as StateType,
            reason: Option.some('no_order' as StateReason),
            operatorId: Option.some('OP-001'),
            notes: Option.none(),
          })
        )
        expect(idle1.state).toBe('idle')

        // Production order arrives: start running
        const running1 = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.some('production' as StateReason),
            operatorId: Option.some('OP-001'),
            notes: Option.none(),
          })
        )
        expect(running1.state).toBe('running')

        // Material runs out: blocked (starved)
        const blocked = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'blocked' as StateType,
            reason: Option.some('starved' as StateReason),
            operatorId: Option.none(),
            notes: Option.some('Waiting for material delivery'),
          })
        )
        expect(blocked.state).toBe('blocked')

        // Material arrives: resume running
        const running2 = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.some('production' as StateReason),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )
        expect(running2.state).toBe('running')

        // End of shift: idle
        const idle2 = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'idle' as StateType,
            reason: Option.some('no_order' as StateReason),
            operatorId: Option.some('OP-001'),
            notes: Option.some('End of shift'),
          })
        )
        expect(idle2.state).toBe('idle')

        // Verify history
        const history = yield* actor.send(
          new InternalGetHistory({
            machineId: TEST_MACHINE_ID,
            since: Option.none(),
            until: Option.none(),
            limit: 100,
          })
        )
        expect(history.length).toBe(5)
        expect(history.map((h) => h.state)).toEqual([
          'idle',
          'running',
          'blocked',
          'running',
          'idle',
        ])
      }).pipe(Effect.scoped)
    )

    it.effect('handles breakdown scenario: running → unplanned_downtime → running', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        // Production running
        yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.some('production' as StateReason),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        // Breakdown occurs
        const breakdown = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'unplanned_downtime' as StateType,
            reason: Option.some('breakdown' as StateReason),
            operatorId: Option.none(),
            notes: Option.some('Motor failure'),
          })
        )
        expect(breakdown.state).toBe('unplanned_downtime')
        expect(Option.getOrNull(breakdown.reason)).toBe('breakdown')

        // Recovery - direct to running
        const recovered = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.some('production' as StateReason),
            operatorId: Option.none(),
            notes: Option.some('Motor replaced'),
          })
        )
        expect(recovered.state).toBe('running')
      }).pipe(Effect.scoped)
    )

    it.effect('handles setup/changeover: running → setup → running', () =>
      Effect.gen(function* () {
        const { actor } = yield* createBootedMachine()

        // Production running
        yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.some('production' as StateReason),
            operatorId: Option.none(),
            notes: Option.none(),
          })
        )

        // Start changeover
        const setup = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'setup' as StateType,
            reason: Option.some('changeover' as StateReason),
            operatorId: Option.some('OP-001'),
            notes: Option.some('Changing to Product B'),
          })
        )
        expect(setup.state).toBe('setup')
        expect(Option.getOrNull(setup.reason)).toBe('changeover')

        // Complete setup (setup → running via CompleteSetup)
        const completed = yield* actor.send(
          new InternalTransition({
            machineId: TEST_MACHINE_ID,
            newState: 'running' as StateType,
            reason: Option.some('production' as StateReason),
            operatorId: Option.some('OP-001'),
            notes: Option.some('Product B production started'),
          })
        )
        expect(completed.state).toBe('running')
      }).pipe(Effect.scoped)
    )
  })
})
