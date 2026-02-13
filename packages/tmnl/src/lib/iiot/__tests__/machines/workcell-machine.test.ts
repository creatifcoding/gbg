/**
 * WorkCellMachine Integration Tests
 *
 * Tests the Machine + StateService + Graph validation integration.
 * Verifies ISA-95 workcell lifecycle state transitions are enforced.
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { Machine } from '@effect/experimental'
import {
  makeWorkCellMachine,
  InternalCreateWorkCell,
  InternalGetWorkCell,
  InternalBeginSetup,
  InternalCompleteSetup,
  InternalStopWorkCell,
  InternalMarkBlockedWorkCell,
  InternalClearBlockedWorkCell,
  InternalMarkFaulted,
  InternalClearFault,
  InternalEnterMaintenanceWorkCell,
  InternalCompleteMaintenanceWorkCell,
  InternalDecommissionWorkCell,
} from '../../machines/WorkCellMachine'
import { WorkCellState, WorkCellStateInMemory } from '../../state'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../infrastructure/feature-flags'
import type { CreateWorkCellParams } from '../../schemas/assets/workcell'
import type { LineId } from '../../schemas/identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestWorkCellParams = (overrides?: Partial<{
  slug: string
  name: string
  lineId: string
}>): CreateWorkCellParams => ({
  slug: (overrides?.slug ?? 'test-workcell') as CreateWorkCellParams['slug'],
  name: (overrides?.name ?? 'Test WorkCell') as CreateWorkCellParams['name'],
  lineId: (overrides?.lineId ?? 'LIN-test-line') as LineId,
  status: 'idle',
})

// =============================================================================
// Tests
// =============================================================================

describe('WorkCellMachine', () => {
  describe('CREATE procedure', () => {
    it.effect('creates a work cell and returns it in idle state', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const workCell = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )

        expect(workCell.name).toBe('Test WorkCell')
        expect(workCell.id).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GET procedure', () => {
    it.effect('retrieves a created work cell', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )

        const fetched = yield* actor.send(
          new InternalGetWorkCell({ workCellId: created.id })
        )

        expect(fetched.id).toBe(created.id)
        expect(fetched.name).toBe(created.name)
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineWorkCellNotFoundError for non-existent work cell', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalGetWorkCell({ workCellId: 'WCL-non-existent' })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineWorkCellNotFoundError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('BEGIN SETUP procedure (graph-validated)', () => {
    it.effect('transitions idle -> setup', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )

        const setup = yield* actor.send(
          new InternalBeginSetup({ workCellId: created.id })
        )

        expect(setup.status).toBe('setup')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('COMPLETE SETUP procedure (graph-validated)', () => {
    it.effect('transitions setup -> running', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )
        yield* actor.send(
          new InternalBeginSetup({ workCellId: created.id })
        )

        const running = yield* actor.send(
          new InternalCompleteSetup({ workCellId: created.id })
        )

        expect(running.status).toBe('running')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('STOP procedure (graph-validated)', () => {
    it.effect('transitions running -> idle', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )
        yield* actor.send(
          new InternalBeginSetup({ workCellId: created.id })
        )
        yield* actor.send(
          new InternalCompleteSetup({ workCellId: created.id })
        )

        const stopped = yield* actor.send(
          new InternalStopWorkCell({ workCellId: created.id })
        )

        expect(stopped.status).toBe('idle')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('BLOCKED procedures (graph-validated)', () => {
    it.effect('transitions running -> blocked -> running', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )
        yield* actor.send(
          new InternalBeginSetup({ workCellId: created.id })
        )
        yield* actor.send(
          new InternalCompleteSetup({ workCellId: created.id })
        )

        const blocked = yield* actor.send(
          new InternalMarkBlockedWorkCell({ workCellId: created.id })
        )
        expect(blocked.status).toBe('blocked')

        const cleared = yield* actor.send(
          new InternalClearBlockedWorkCell({ workCellId: created.id })
        )
        expect(cleared.status).toBe('running')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('FAULTED procedures (graph-validated)', () => {
    it.effect('transitions running -> faulted -> idle (via ClearFault)', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )
        yield* actor.send(
          new InternalBeginSetup({ workCellId: created.id })
        )
        yield* actor.send(
          new InternalCompleteSetup({ workCellId: created.id })
        )

        const faulted = yield* actor.send(
          new InternalMarkFaulted({ workCellId: created.id })
        )
        expect(faulted.status).toBe('faulted')

        const cleared = yield* actor.send(
          new InternalClearFault({ workCellId: created.id })
        )
        expect(cleared.status).toBe('idle')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('transitions faulted -> maintenance (via EnterMaintenance)', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )
        yield* actor.send(
          new InternalBeginSetup({ workCellId: created.id })
        )
        yield* actor.send(
          new InternalCompleteSetup({ workCellId: created.id })
        )
        yield* actor.send(
          new InternalMarkFaulted({ workCellId: created.id })
        )

        const maintenance = yield* actor.send(
          new InternalEnterMaintenanceWorkCell({ workCellId: created.id })
        )
        expect(maintenance.status).toBe('maintenance')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('MAINTENANCE procedures (graph-validated)', () => {
    it.effect('transitions idle -> maintenance -> idle', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )

        const maintenance = yield* actor.send(
          new InternalEnterMaintenanceWorkCell({ workCellId: created.id })
        )
        expect(maintenance.status).toBe('maintenance')

        const completed = yield* actor.send(
          new InternalCompleteMaintenanceWorkCell({ workCellId: created.id })
        )
        expect(completed.status).toBe('idle')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('DECOMMISSION procedure (graph-validated)', () => {
    it.effect('transitions idle -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )

        const decommissioned = yield* actor.send(
          new InternalDecommissionWorkCell({ workCellId: created.id })
        )

        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('transitions maintenance -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )
        yield* actor.send(
          new InternalEnterMaintenanceWorkCell({ workCellId: created.id })
        )

        const decommissioned = yield* actor.send(
          new InternalDecommissionWorkCell({ workCellId: created.id })
        )

        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('Invalid transitions', () => {
    it.effect('fails when decommissioned work cell receives any transition', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )
        yield* actor.send(
          new InternalDecommissionWorkCell({ workCellId: created.id })
        )

        const result = yield* actor.send(
          new InternalBeginSetup({ workCellId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineWorkCellInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when running work cell tries to decommission directly', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )
        yield* actor.send(
          new InternalBeginSetup({ workCellId: created.id })
        )
        yield* actor.send(
          new InternalCompleteSetup({ workCellId: created.id })
        )

        const result = yield* actor.send(
          new InternalDecommissionWorkCell({ workCellId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineWorkCellInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ISA-95 full lifecycle flow', () => {
    it.effect('completes full lifecycle: idle -> setup -> running -> faulted -> maintenance -> idle -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* WorkCellState
        const flags = yield* IIoTFeatureFlags
        const machine = makeWorkCellMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        // Create (starts idle)
        const workCell = yield* actor.send(
          new InternalCreateWorkCell({ params: createTestWorkCellParams() })
        )

        // Begin setup: idle -> setup
        const setup = yield* actor.send(
          new InternalBeginSetup({ workCellId: workCell.id })
        )
        expect(setup.status).toBe('setup')

        // Complete setup: setup -> running
        const running = yield* actor.send(
          new InternalCompleteSetup({ workCellId: workCell.id })
        )
        expect(running.status).toBe('running')

        // Mark faulted: running -> faulted
        const faulted = yield* actor.send(
          new InternalMarkFaulted({ workCellId: workCell.id })
        )
        expect(faulted.status).toBe('faulted')

        // Enter maintenance: faulted -> maintenance
        const maintenance = yield* actor.send(
          new InternalEnterMaintenanceWorkCell({ workCellId: workCell.id })
        )
        expect(maintenance.status).toBe('maintenance')

        // Complete maintenance: maintenance -> idle
        const idle = yield* actor.send(
          new InternalCompleteMaintenanceWorkCell({ workCellId: workCell.id })
        )
        expect(idle.status).toBe('idle')

        // Decommission: idle -> decommissioned
        const decommissioned = yield* actor.send(
          new InternalDecommissionWorkCell({ workCellId: workCell.id })
        )
        expect(decommissioned.status).toBe('decommissioned')

        // Verify final state via GET
        const final = yield* actor.send(
          new InternalGetWorkCell({ workCellId: workCell.id })
        )
        expect(final.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(WorkCellStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})
