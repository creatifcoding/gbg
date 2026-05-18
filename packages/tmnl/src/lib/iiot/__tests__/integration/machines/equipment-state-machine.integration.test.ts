/**
 * EquipmentStateMachine Integration Tests
 *
 * Tests the full Machine + SQL-backed EquipmentStateService + Graph validation.
 * Verifies ISA-95/OEE state transitions, OEE calculations with real DB durations,
 * event lifecycle tracking, and multi-machine independence.
 *
 * Prerequisites:
 *   docker compose -f docker/docker-compose.iiot.yml up -d
 *
 * Run:
 *   RUN_INTEGRATION_TESTS=1 bun test src/lib/iiot/__tests__/integration/machines/equipment-state-machine.integration.test.ts
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option, DateTime } from 'effect'
import { Machine } from '@effect/experimental'
import { PgClient } from '@effect/sql-pg'
import { SqlClient } from '@effect/sql'
import {
  makeEquipmentStateMachine,
  InternalGetCurrent,
  InternalGetHistory,
  InternalTransition,
  InternalUpdateReason,
  InternalGetOee,
  InternalGetDurations,
} from '../../../machines/EquipmentStateMachine'
import { EquipmentStateService } from '../../../state/EquipmentStateService'
import type { DomainEventEmitterShape, EquipmentStateChangedEmission, WorkOrderLifecycleEmission } from '../../../services/events'
import { IIoTFeatureFlags } from '../../../infrastructure/feature-flags'
import type { StateType, StateReason } from '../../../schemas/equipment-state/schema'
import { makeEquipmentStateId } from '../../../schemas/equipment-state/schema'
import { makeMachineId } from '../../../schemas/assets/machine/schema'
import {
  EquipmentStateMachineIntegrationLayer,
  withCleanMachineDatabase,
  setupTestMachine,
} from './layer'

// =============================================================================
// Environment Gate
// =============================================================================

const RUN = process.env['RUN_INTEGRATION_TESTS'] === '1'

// =============================================================================
// Test Helpers
// =============================================================================

let testCounter = 0
const nextSlug = (prefix: string) => `${prefix}-${Date.now()}-${++testCounter}`

/**
 * Boot an EquipmentStateMachine backed by the real SQL EquipmentStateService.
 * Dependencies resolved from the integration layer.
 */
const bootMachine = (eventEmitter?: DomainEventEmitterShape) =>
  Effect.gen(function* () {
    const state = yield* EquipmentStateService
    const flags = yield* IIoTFeatureFlags
    const sql = yield* SqlClient.SqlClient
    const machine = makeEquipmentStateMachine({ state, flags, eventEmitter, sql })
    const actor = yield* Machine.boot(machine)
    return actor
  })

const failEquipmentEmitter: DomainEventEmitterShape = {
  emitWorkOrderLifecycle: (event: WorkOrderLifecycleEmission) =>
    failEquipmentEmitter.emitWorkOrderLifecycleStrict(event).pipe(Effect.ignore),
  emitEquipmentStateChanged: (event: EquipmentStateChangedEmission) =>
    failEquipmentEmitter.emitEquipmentStateChangedStrict(event).pipe(Effect.ignore),
  emitWorkOrderLifecycleStrict: () => Effect.void,
  emitEquipmentStateChangedStrict: () => Effect.fail(new Error('intentional equipment event failure')),
}

/**
 * Insert a backdated equipment state directly via SQL for duration testing.
 * This allows us to control exact timestamps for OEE calculations.
 */
const insertBackdatedState = (params: {
  machineId: string
  state: string
  reason: string | null
  operatorId: string | null
  startedAt: Date
  endedAt: Date | null
}) =>
  Effect.gen(function* () {
    const sql = yield* PgClient.PgClient
    const id = makeEquipmentStateId(nextSlug('test'))

    yield* sql.unsafe(`
      INSERT INTO iiot.equipment_states (id, machine_id, state, reason, operator_id, started_at, ended_at)
      VALUES ('${id}', '${params.machineId}', '${params.state}',
        ${params.reason ? `'${params.reason}'` : 'NULL'},
        ${params.operatorId ? `'${params.operatorId}'` : 'NULL'},
        '${params.startedAt.toISOString()}',
        ${params.endedAt ? `'${params.endedAt.toISOString()}'` : 'NULL'})
    `)

    return id
  })

// =============================================================================
// Tests
// =============================================================================

describe.skipIf(!RUN)('EquipmentStateMachine Integration', () => {
  describe('transaction-fused event emission', () => {
    it.effect('rolls back equipment state create when durable event emission fails', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const machineId = makeMachineId(nextSlug('test'))
          yield* setupTestMachine(machineId)
          const state = yield* EquipmentStateService
          const actor = yield* bootMachine(failEquipmentEmitter)

          const result = yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'running' as StateType,
              reason: Option.some('production' as StateReason),
              operatorId: Option.some('OP-001'),
              notes: Option.none(),
            })
          ).pipe(Effect.either)

          expect(result._tag).toBe('Left')
          const current = yield* state.getCurrent(machineId)
          expect(Option.isNone(current)).toBe(true)
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(EquipmentStateMachineIntegrationLayer)
      )
    )
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 1. OEE with real DB durations
  // ─────────────────────────────────────────────────────────────────────────

  describe('OEE with real DB durations', () => {
    // Uses it.live instead of it.effect — the DB's DEFAULT now() for started_at
    // uses real wall clock, so the application clock must also be real (not TestClock
    // which starts at epoch 0). This is correct for integration tests against real DBs.
    it.live('calculates durations from SQL-persisted state records', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const machineId = makeMachineId(nextSlug('test'))
          yield* setupTestMachine(machineId)

          const actor = yield* bootMachine()

          // Create state transitions through the machine
          yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'running' as StateType,
              reason: Option.some('production' as StateReason),
              operatorId: Option.some('OP-001'),
              notes: Option.none(),
            })
          )

          // Transition to idle
          yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'idle' as StateType,
              reason: Option.some('no_order' as StateReason),
              operatorId: Option.none(),
              notes: Option.none(),
            })
          )

          // Transition to setup
          yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'setup' as StateType,
              reason: Option.some('changeover' as StateReason),
              operatorId: Option.some('OP-002'),
              notes: Option.some('Changing to Product B'),
            })
          )

          // Complete setup back to running
          yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'running' as StateType,
              reason: Option.some('production' as StateReason),
              operatorId: Option.none(),
              notes: Option.none(),
            })
          )

          // Get durations
          const now = yield* DateTime.now
          const twoDaysAgo = DateTime.subtract(now, { days: 2 })

          const durations = yield* actor.send(
            new InternalGetDurations({
              machineId,
              since: twoDaysAgo,
              until: now,
            })
          )

          expect(durations.machineId).toBe(machineId)
          // We have running, idle, setup, running states
          // At least running and some other durations should be tracked
          expect(durations.transitionCount).toBeGreaterThanOrEqual(3)
          // Total tracked time should be positive
          expect(durations.getTotalMs()).toBeGreaterThan(0)
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(EquipmentStateMachineIntegrationLayer)
      )
    )

    it.effect('calculates OEE with backdated SQL state records', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const machineId = makeMachineId(nextSlug('test'))
          yield* setupTestMachine(machineId)

          // Insert backdated states with known durations directly via SQL
          const periodStart = new Date('2026-01-15T06:00:00Z')
          const periodEnd = new Date('2026-01-15T14:00:00Z')

          // 4 hours running (6:00 - 10:00)
          yield* insertBackdatedState({
            machineId,
            state: 'running',
            reason: 'production',
            operatorId: 'OP-001',
            startedAt: new Date('2026-01-15T06:00:00Z'),
            endedAt: new Date('2026-01-15T10:00:00Z'),
          })

          // 1 hour planned downtime (10:00 - 11:00)
          yield* insertBackdatedState({
            machineId,
            state: 'planned_downtime',
            reason: 'scheduled_maintenance',
            operatorId: null,
            startedAt: new Date('2026-01-15T10:00:00Z'),
            endedAt: new Date('2026-01-15T11:00:00Z'),
          })

          // 1 hour unplanned downtime (11:00 - 12:00)
          yield* insertBackdatedState({
            machineId,
            state: 'unplanned_downtime',
            reason: 'breakdown',
            operatorId: null,
            startedAt: new Date('2026-01-15T11:00:00Z'),
            endedAt: new Date('2026-01-15T12:00:00Z'),
          })

          // 2 hours running (12:00 - 14:00)
          yield* insertBackdatedState({
            machineId,
            state: 'running',
            reason: 'production',
            operatorId: 'OP-001',
            startedAt: new Date('2026-01-15T12:00:00Z'),
            endedAt: new Date('2026-01-15T14:00:00Z'),
          })

          // Boot machine and request OEE
          const actor = yield* bootMachine()

          const oee = yield* actor.send(
            new InternalGetOee({
              machineId,
              since: DateTime.unsafeFromDate(periodStart),
              until: DateTime.unsafeFromDate(periodEnd),
              theoreticalOutputPerHour: Option.none(),
              goodPartsProduced: Option.none(),
              totalPartsProduced: Option.none(),
            })
          )

          expect(oee.machineId).toBe(machineId)
          // 6h running + 1h planned_downtime + 1h unplanned_downtime = 8h total
          // Scheduled = 8h - 1h planned = 7h
          // Availability = (running + idle + setup + blocked) / scheduled = 6h / 7h ~= 0.857
          expect(oee.availability).toBeGreaterThan(0.8)
          expect(oee.availability).toBeLessThanOrEqual(1)
          // Without production data, performance and quality default to 1
          expect(oee.performance).toBe(1)
          expect(oee.quality).toBe(1)
          // OEE = availability * 1 * 1
          expect(oee.oee).toBeGreaterThan(0.8)
          expect(oee.oee).toBeLessThanOrEqual(1)
          // Breakdown should be a proper StateDurationAggregate
          expect(oee.breakdown.runningMs).toBeGreaterThan(0)
          expect(oee.breakdown.plannedDowntimeMs).toBeGreaterThan(0)
          expect(oee.breakdown.unplannedDowntimeMs).toBeGreaterThan(0)
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(EquipmentStateMachineIntegrationLayer)
      )
    )

    it.effect('calculates OEE with production data parameters', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const machineId = makeMachineId(nextSlug('test'))
          yield* setupTestMachine(machineId)

          // Insert 1 hour of running time
          const periodStart = new Date('2026-01-15T08:00:00Z')
          const periodEnd = new Date('2026-01-15T09:00:00Z')

          yield* insertBackdatedState({
            machineId,
            state: 'running',
            reason: 'production',
            operatorId: 'OP-001',
            startedAt: periodStart,
            endedAt: periodEnd,
          })

          const actor = yield* bootMachine()

          const oee = yield* actor.send(
            new InternalGetOee({
              machineId,
              since: DateTime.unsafeFromDate(periodStart),
              until: DateTime.unsafeFromDate(periodEnd),
              theoreticalOutputPerHour: Option.some(100),
              goodPartsProduced: Option.some(80),
              totalPartsProduced: Option.some(100),
            })
          )

          // Quality = 80/100 = 0.8
          expect(oee.quality).toBeCloseTo(0.8, 2)
          // All running, no downtime so availability = 1
          expect(oee.availability).toBe(1)
          // OEE bounded 0-1
          expect(oee.oee).toBeGreaterThanOrEqual(0)
          expect(oee.oee).toBeLessThanOrEqual(1)
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(EquipmentStateMachineIntegrationLayer)
      )
    )
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 2. ISA-95 lifecycle events
  // ─────────────────────────────────────────────────────────────────────────

  describe('ISA-95 lifecycle events', () => {
    it.effect('persists state transitions via Machine procedures to SQL', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const machineId = makeMachineId(nextSlug('test'))
          yield* setupTestMachine(machineId)
          const actor = yield* bootMachine()

          // Lifecycle: idle -> running -> blocked -> running -> idle
          const idle1 = yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'idle' as StateType,
              reason: Option.some('no_order' as StateReason),
              operatorId: Option.some('OP-001'),
              notes: Option.none(),
            })
          )
          expect(idle1.state).toBe('idle')
          expect(idle1.machineId).toBe(machineId)

          const running1 = yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'running' as StateType,
              reason: Option.some('production' as StateReason),
              operatorId: Option.some('OP-001'),
              notes: Option.none(),
            })
          )
          expect(running1.state).toBe('running')

          const blocked = yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'blocked' as StateType,
              reason: Option.some('starved' as StateReason),
              operatorId: Option.none(),
              notes: Option.some('Waiting for material delivery'),
            })
          )
          expect(blocked.state).toBe('blocked')

          const running2 = yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'running' as StateType,
              reason: Option.some('production' as StateReason),
              operatorId: Option.none(),
              notes: Option.none(),
            })
          )
          expect(running2.state).toBe('running')

          const idle2 = yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'idle' as StateType,
              reason: Option.some('no_order' as StateReason),
              operatorId: Option.some('OP-001'),
              notes: Option.some('End of shift'),
            })
          )
          expect(idle2.state).toBe('idle')

          // Verify full history persisted in DB
          const history = yield* actor.send(
            new InternalGetHistory({
              machineId,
              since: Option.none(),
              until: Option.none(),
              limit: 100,
            })
          )

          expect(history.length).toBe(5)
          const stateSequence = history.map((h) => h.state)
          expect(stateSequence).toContain('idle')
          expect(stateSequence).toContain('running')
          expect(stateSequence).toContain('blocked')
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(EquipmentStateMachineIntegrationLayer)
      )
    )

    it.effect('rejects invalid transitions via graph validation with SQL persistence', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const machineId = makeMachineId(nextSlug('test'))
          yield* setupTestMachine(machineId)
          const actor = yield* bootMachine()

          // Enter planned_downtime
          yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'planned_downtime' as StateType,
              reason: Option.some('scheduled_maintenance' as StateReason),
              operatorId: Option.none(),
              notes: Option.none(),
            })
          )

          // planned_downtime -> blocked is NOT a valid transition
          const result = yield* actor.send(
            new InternalTransition({
              machineId,
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

          // Current state should still be planned_downtime
          const current = yield* actor.send(
            new InternalGetCurrent({ machineId })
          )
          expect(current.state).toBe('planned_downtime')
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(EquipmentStateMachineIntegrationLayer)
      )
    )

    it.effect('handles breakdown scenario with SQL persistence', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const machineId = makeMachineId(nextSlug('test'))
          yield* setupTestMachine(machineId)
          const actor = yield* bootMachine()

          // running -> unplanned_downtime (breakdown) -> running (recovery)
          yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'running' as StateType,
              reason: Option.some('production' as StateReason),
              operatorId: Option.none(),
              notes: Option.none(),
            })
          )

          const breakdown = yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'unplanned_downtime' as StateType,
              reason: Option.some('breakdown' as StateReason),
              operatorId: Option.none(),
              notes: Option.some('Motor failure'),
            })
          )
          expect(breakdown.state).toBe('unplanned_downtime')
          expect(Option.getOrNull(breakdown.reason)).toBe('breakdown')
          expect(Option.getOrNull(breakdown.notes)).toBe('Motor failure')

          const recovered = yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'running' as StateType,
              reason: Option.some('production' as StateReason),
              operatorId: Option.none(),
              notes: Option.some('Motor replaced'),
            })
          )
          expect(recovered.state).toBe('running')

          // Verify all states are in the DB
          const history = yield* actor.send(
            new InternalGetHistory({
              machineId,
              since: Option.none(),
              until: Option.none(),
              limit: 100,
            })
          )
          expect(history.length).toBe(3)
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(EquipmentStateMachineIntegrationLayer)
      )
    )

    it.effect('updates reason for an existing state via SQL', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const machineId = makeMachineId(nextSlug('test'))
          yield* setupTestMachine(machineId)
          const actor = yield* bootMachine()

          // Create state with unknown reason
          const created = yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'unplanned_downtime' as StateType,
              reason: Option.some('unknown' as StateReason),
              operatorId: Option.none(),
              notes: Option.none(),
            })
          )

          // Update reason after root cause analysis
          const updated = yield* actor.send(
            new InternalUpdateReason({
              stateId: created.id,
              reason: 'breakdown' as StateReason,
              notes: Option.some('Root cause: motor bearing failure'),
            })
          )

          expect(Option.getOrNull(updated.reason)).toBe('breakdown')
          expect(Option.getOrNull(updated.notes)).toBe('Root cause: motor bearing failure')
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(EquipmentStateMachineIntegrationLayer)
      )
    )

    it.effect('verifies ended state records in DB after transitions', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const machineId = makeMachineId(nextSlug('test'))
          yield* setupTestMachine(machineId)
          const actor = yield* bootMachine()

          // Two transitions: first state should be ended
          yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'idle' as StateType,
              reason: Option.none(),
              operatorId: Option.none(),
              notes: Option.none(),
            })
          )
          yield* actor.send(
            new InternalTransition({
              machineId,
              newState: 'running' as StateType,
              reason: Option.some('production' as StateReason),
              operatorId: Option.none(),
              notes: Option.none(),
            })
          )

          // Query history
          const history = yield* actor.send(
            new InternalGetHistory({
              machineId,
              since: Option.none(),
              until: Option.none(),
              limit: 100,
            })
          )

          expect(history.length).toBe(2)

          // The most recently-ended states should have endedAt set
          // (depends on sort order from SQL; at minimum the first should be ended)
          const endedStates = history.filter((s) => Option.isSome(s.endedAt))
          expect(endedStates.length).toBeGreaterThanOrEqual(1)

          // Current state should still be active
          const current = yield* actor.send(
            new InternalGetCurrent({ machineId })
          )
          expect(current.isActive()).toBe(true)
          expect(current.state).toBe('running')
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(EquipmentStateMachineIntegrationLayer)
      )
    )
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 3. Multi-machine scenario
  // ─────────────────────────────────────────────────────────────────────────

  describe('Multi-machine independent state histories', () => {
    it.effect('tracks independent state histories for different machines', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const machineA = makeMachineId(nextSlug('test'))
          const machineB = makeMachineId(nextSlug('test'))
          yield* setupTestMachine(machineA)
          yield* setupTestMachine(machineB)

          const actor = yield* bootMachine()

          // Machine A: idle -> running
          yield* actor.send(
            new InternalTransition({
              machineId: machineA,
              newState: 'idle' as StateType,
              reason: Option.some('no_order' as StateReason),
              operatorId: Option.some('OP-001'),
              notes: Option.none(),
            })
          )
          yield* actor.send(
            new InternalTransition({
              machineId: machineA,
              newState: 'running' as StateType,
              reason: Option.some('production' as StateReason),
              operatorId: Option.some('OP-001'),
              notes: Option.none(),
            })
          )

          // Machine B: running -> unplanned_downtime -> running
          yield* actor.send(
            new InternalTransition({
              machineId: machineB,
              newState: 'running' as StateType,
              reason: Option.some('production' as StateReason),
              operatorId: Option.some('OP-002'),
              notes: Option.none(),
            })
          )
          yield* actor.send(
            new InternalTransition({
              machineId: machineB,
              newState: 'unplanned_downtime' as StateType,
              reason: Option.some('breakdown' as StateReason),
              operatorId: Option.none(),
              notes: Option.some('Hydraulic leak'),
            })
          )
          yield* actor.send(
            new InternalTransition({
              machineId: machineB,
              newState: 'running' as StateType,
              reason: Option.some('production' as StateReason),
              operatorId: Option.none(),
              notes: Option.some('Leak fixed'),
            })
          )

          // Verify Machine A history
          const historyA = yield* actor.send(
            new InternalGetHistory({
              machineId: machineA,
              since: Option.none(),
              until: Option.none(),
              limit: 100,
            })
          )
          expect(historyA.length).toBe(2)
          historyA.forEach((s) => expect(s.machineId).toBe(machineA))

          // Verify Machine B history
          const historyB = yield* actor.send(
            new InternalGetHistory({
              machineId: machineB,
              since: Option.none(),
              until: Option.none(),
              limit: 100,
            })
          )
          expect(historyB.length).toBe(3)
          historyB.forEach((s) => expect(s.machineId).toBe(machineB))

          // Verify current states are independent
          const currentA = yield* actor.send(
            new InternalGetCurrent({ machineId: machineA })
          )
          const currentB = yield* actor.send(
            new InternalGetCurrent({ machineId: machineB })
          )

          expect(currentA.state).toBe('running')
          expect(currentA.machineId).toBe(machineA)
          expect(currentB.state).toBe('running')
          expect(currentB.machineId).toBe(machineB)
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(EquipmentStateMachineIntegrationLayer)
      )
    )

    it.effect('calculates independent OEE for different machines', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const machineA = makeMachineId(nextSlug('test'))
          const machineB = makeMachineId(nextSlug('test'))
          yield* setupTestMachine(machineA)
          yield* setupTestMachine(machineB)

          const periodStart = new Date('2026-01-20T06:00:00Z')
          const periodEnd = new Date('2026-01-20T14:00:00Z')

          // Machine A: 8h running (high OEE)
          yield* insertBackdatedState({
            machineId: machineA,
            state: 'running',
            reason: 'production',
            operatorId: 'OP-001',
            startedAt: new Date('2026-01-20T06:00:00Z'),
            endedAt: new Date('2026-01-20T14:00:00Z'),
          })

          // Machine B: 4h running + 2h downtime + 2h idle (lower OEE)
          yield* insertBackdatedState({
            machineId: machineB,
            state: 'running',
            reason: 'production',
            operatorId: 'OP-002',
            startedAt: new Date('2026-01-20T06:00:00Z'),
            endedAt: new Date('2026-01-20T10:00:00Z'),
          })
          yield* insertBackdatedState({
            machineId: machineB,
            state: 'unplanned_downtime',
            reason: 'breakdown',
            operatorId: null,
            startedAt: new Date('2026-01-20T10:00:00Z'),
            endedAt: new Date('2026-01-20T12:00:00Z'),
          })
          yield* insertBackdatedState({
            machineId: machineB,
            state: 'idle',
            reason: 'no_order',
            operatorId: null,
            startedAt: new Date('2026-01-20T12:00:00Z'),
            endedAt: new Date('2026-01-20T14:00:00Z'),
          })

          const actor = yield* bootMachine()

          const oeeA = yield* actor.send(
            new InternalGetOee({
              machineId: machineA,
              since: DateTime.unsafeFromDate(periodStart),
              until: DateTime.unsafeFromDate(periodEnd),
              theoreticalOutputPerHour: Option.none(),
              goodPartsProduced: Option.none(),
              totalPartsProduced: Option.none(),
            })
          )

          const oeeB = yield* actor.send(
            new InternalGetOee({
              machineId: machineB,
              since: DateTime.unsafeFromDate(periodStart),
              until: DateTime.unsafeFromDate(periodEnd),
              theoreticalOutputPerHour: Option.none(),
              goodPartsProduced: Option.none(),
              totalPartsProduced: Option.none(),
            })
          )

          // Machine A: all running, should have higher OEE
          expect(oeeA.machineId).toBe(machineA)
          expect(oeeA.availability).toBe(1) // All running, no downtime

          // Machine B: has downtime, should have lower OEE
          expect(oeeB.machineId).toBe(machineB)
          expect(oeeB.availability).toBeLessThan(oeeA.availability)

          // Machine A OEE should be higher than Machine B
          expect(oeeA.oee).toBeGreaterThan(oeeB.oee)
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(EquipmentStateMachineIntegrationLayer)
      )
    )

    it.effect('handles transition errors independently per machine', () =>
      withCleanMachineDatabase(
        Effect.gen(function* () {
          const machineA = makeMachineId(nextSlug('test'))
          const machineB = makeMachineId(nextSlug('test'))
          yield* setupTestMachine(machineA)
          yield* setupTestMachine(machineB)

          const actor = yield* bootMachine()

          // Machine A enters planned_downtime
          yield* actor.send(
            new InternalTransition({
              machineId: machineA,
              newState: 'planned_downtime' as StateType,
              reason: Option.some('scheduled_maintenance' as StateReason),
              operatorId: Option.none(),
              notes: Option.none(),
            })
          )

          // Machine B enters running
          yield* actor.send(
            new InternalTransition({
              machineId: machineB,
              newState: 'running' as StateType,
              reason: Option.some('production' as StateReason),
              operatorId: Option.none(),
              notes: Option.none(),
            })
          )

          // Invalid transition for Machine A (planned_downtime -> blocked)
          const resultA = yield* actor.send(
            new InternalTransition({
              machineId: machineA,
              newState: 'blocked' as StateType,
              reason: Option.none(),
              operatorId: Option.none(),
              notes: Option.none(),
            })
          ).pipe(Effect.either)
          expect(resultA._tag).toBe('Left')

          // Valid transition for Machine B (running -> blocked) should still work
          const resultB = yield* actor.send(
            new InternalTransition({
              machineId: machineB,
              newState: 'blocked' as StateType,
              reason: Option.some('starved' as StateReason),
              operatorId: Option.none(),
              notes: Option.none(),
            })
          )
          expect(resultB.state).toBe('blocked')
          expect(resultB.machineId).toBe(machineB)

          // Machine A should still be in planned_downtime
          const currentA = yield* actor.send(
            new InternalGetCurrent({ machineId: machineA })
          )
          expect(currentA.state).toBe('planned_downtime')
        })
      ).pipe(
        Effect.scoped,
        Effect.provide(EquipmentStateMachineIntegrationLayer)
      )
    )
  })
})
