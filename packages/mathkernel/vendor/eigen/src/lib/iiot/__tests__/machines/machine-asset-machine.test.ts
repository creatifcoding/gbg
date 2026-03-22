/**
 * MachineAssetMachine Integration Tests
 *
 * Tests the Machine + StateService + Graph validation integration.
 * Verifies ISA-95 machine asset lifecycle state transitions are enforced.
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { Machine } from '@effect/experimental'
import {
  makeMachineAssetMachine,
  InternalCreateMachine,
  InternalGetMachine,
  InternalActivate,
  InternalGoIdle,
  InternalResume,
  InternalMarkFaulted,
  InternalScheduleRepair,
  InternalEmergencyRepair,
  InternalScheduleMaintenance,
  InternalCompleteMaintenance,
  InternalRetire,
  InternalDecommission,
} from '../../machines/MachineAssetMachine'
import { MachineStateInMemory, MachineState } from '../../state/MachineState'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../infrastructure/feature-flags'
import type { CreateMachineParams } from '../../schemas/assets/machine'
import type { EnterpriseId, SiteId, PlantId, LineId } from '../../schemas/identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestMachineParams = (overrides?: Partial<{
  slug: string
  name: string
  machineType: string
}>): CreateMachineParams => ({
  slug: overrides?.slug ?? 'test-machine-001',
  name: (overrides?.name ?? 'Test Machine') as CreateMachineParams['name'],
  machineType: (overrides?.machineType ?? 'CNC Lathe') as CreateMachineParams['machineType'],
  enterpriseId: 'ENT-test' as EnterpriseId,
  siteId: 'SIT-test' as SiteId,
  plantId: 'PLT-test' as PlantId,
  lineId: 'LIN-test' as LineId,
  status: 'commissioned',
  workCellId: Option.none(),
  manufacturer: Option.none(),
  modelNumber: Option.none(),
  serialNumber: Option.none(),
  installationDate: Option.none(),
  nextMaintenanceDate: Option.none(),
  description: Option.none(),
  metadata: {},
})

// =============================================================================
// Tests
// =============================================================================

describe('MachineAssetMachine', () => {
  describe('CREATE procedure', () => {
    it.effect('creates a machine and returns it with initial state', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )

        expect(result.name).toBe('Test Machine')
        expect(result.machineType).toBe('CNC Lathe')
        expect(result.id).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GET procedure', () => {
    it.effect('retrieves a created machine', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )

        const fetched = yield* actor.send(
          new InternalGetMachine({ machineId: created.id })
        )

        expect(fetched.id).toBe(created.id)
        expect(fetched.name).toBe(created.name)
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineMachineAssetNotFoundError for non-existent machine', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalGetMachine({ machineId: 'MCH-non-existent' })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineMachineAssetNotFoundError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ACTIVATE procedure (commissioned -> operational)', () => {
    it.effect('activates a commissioned machine', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )

        const activated = yield* actor.send(
          new InternalActivate({ machineId: created.id })
        )

        expect(activated.status).toBe('operational')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GO IDLE procedure (operational -> idle)', () => {
    it.effect('makes an operational machine idle', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))

        const idled = yield* actor.send(
          new InternalGoIdle({ machineId: created.id })
        )

        expect(idled.status).toBe('idle')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('RESUME procedure (idle -> operational)', () => {
    it.effect('resumes an idle machine to operational', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))
        yield* actor.send(new InternalGoIdle({ machineId: created.id }))

        const resumed = yield* actor.send(
          new InternalResume({ machineId: created.id })
        )

        expect(resumed.status).toBe('operational')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('MARK FAULTED procedure (operational|idle -> faulted)', () => {
    it.effect('marks an operational machine as faulted', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))

        const faulted = yield* actor.send(
          new InternalMarkFaulted({ machineId: created.id })
        )

        expect(faulted.status).toBe('faulted')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('SCHEDULE REPAIR procedure (faulted -> scheduled_maintenance)', () => {
    it.effect('schedules repair for a faulted machine', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))
        yield* actor.send(new InternalMarkFaulted({ machineId: created.id }))

        const repaired = yield* actor.send(
          new InternalScheduleRepair({ machineId: created.id })
        )

        expect(repaired.status).toBe('scheduled_maintenance')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('EMERGENCY REPAIR procedure (faulted -> unscheduled_maintenance)', () => {
    it.effect('starts emergency repair for a faulted machine', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))
        yield* actor.send(new InternalMarkFaulted({ machineId: created.id }))

        const emergency = yield* actor.send(
          new InternalEmergencyRepair({ machineId: created.id })
        )

        expect(emergency.status).toBe('unscheduled_maintenance')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('SCHEDULE MAINTENANCE procedure (operational|idle -> scheduled_maintenance)', () => {
    it.effect('schedules maintenance for an operational machine', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))

        const scheduled = yield* actor.send(
          new InternalScheduleMaintenance({ machineId: created.id })
        )

        expect(scheduled.status).toBe('scheduled_maintenance')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('COMPLETE MAINTENANCE procedure (maintenance -> operational)', () => {
    it.effect('completes scheduled maintenance', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))
        yield* actor.send(new InternalScheduleMaintenance({ machineId: created.id }))

        const completed = yield* actor.send(
          new InternalCompleteMaintenance({ machineId: created.id })
        )

        expect(completed.status).toBe('operational')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('RETIRE procedure (operational|idle -> retired)', () => {
    it.effect('retires an operational machine', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))

        const retired = yield* actor.send(
          new InternalRetire({ machineId: created.id })
        )

        expect(retired.status).toBe('retired')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('DECOMMISSION procedure (retired|scheduled_maintenance -> decommissioned)', () => {
    it.effect('decommissions a retired machine', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))
        yield* actor.send(new InternalRetire({ machineId: created.id }))

        const decommissioned = yield* actor.send(
          new InternalDecommission({ machineId: created.id })
        )

        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('Invalid transitions', () => {
    it.effect('fails when trying to transition from decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )
        yield* actor.send(new InternalActivate({ machineId: created.id }))
        yield* actor.send(new InternalRetire({ machineId: created.id }))
        yield* actor.send(new InternalDecommission({ machineId: created.id }))

        // Cannot activate from decommissioned
        const result = yield* actor.send(
          new InternalActivate({ machineId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineMachineAssetInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when trying to retire from commissioned (skip states)', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )

        // Cannot retire from commissioned (must go through operational first)
        const result = yield* actor.send(
          new InternalRetire({ machineId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineMachineAssetInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ISA-95 full lifecycle flow', () => {
    it.effect('completes full lifecycle: commissioned -> operational -> idle -> faulted -> scheduled_maintenance -> operational -> retired -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* MachineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeMachineAssetMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        // Create (commissioned)
        const created = yield* actor.send(
          new InternalCreateMachine({ params: createTestMachineParams() })
        )
        expect(created.status).toBe('commissioned')

        // Activate (operational)
        const activated = yield* actor.send(
          new InternalActivate({ machineId: created.id })
        )
        expect(activated.status).toBe('operational')

        // Go idle
        const idled = yield* actor.send(
          new InternalGoIdle({ machineId: created.id })
        )
        expect(idled.status).toBe('idle')

        // Mark faulted
        const faulted = yield* actor.send(
          new InternalMarkFaulted({ machineId: created.id })
        )
        expect(faulted.status).toBe('faulted')

        // Schedule repair
        const scheduled = yield* actor.send(
          new InternalScheduleRepair({ machineId: created.id })
        )
        expect(scheduled.status).toBe('scheduled_maintenance')

        // Complete maintenance
        const maintained = yield* actor.send(
          new InternalCompleteMaintenance({ machineId: created.id })
        )
        expect(maintained.status).toBe('operational')

        // Retire
        const retired = yield* actor.send(
          new InternalRetire({ machineId: created.id })
        )
        expect(retired.status).toBe('retired')

        // Decommission
        const decommissioned = yield* actor.send(
          new InternalDecommission({ machineId: created.id })
        )
        expect(decommissioned.status).toBe('decommissioned')

        // Verify final state via GET
        const final = yield* actor.send(
          new InternalGetMachine({ machineId: created.id })
        )
        expect(final.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(MachineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})
