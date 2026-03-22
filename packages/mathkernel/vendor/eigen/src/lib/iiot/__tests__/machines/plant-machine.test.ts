/**
 * PlantMachine Integration Tests
 *
 * Tests the Machine + StateService + Graph validation integration.
 * Verifies ISA-95 plant lifecycle state transitions are enforced.
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { Machine } from '@effect/experimental'
import {
  makePlantMachine,
  InternalCreatePlant,
  InternalGetPlant,
  InternalCompleteCommissioning,
  InternalScheduledShutdown,
  InternalRestart,
  InternalEmergencyShutdown,
  InternalBeginEmergencyMaintenance,
  InternalMaintenanceShutdown,
  InternalCompleteMaintenanceRestart,
  InternalDecommissionPlant,
} from '../../machines/PlantMachine'
import { PlantState, PlantStateInMemory } from '../../state'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../infrastructure/feature-flags'
import type { CreatePlantParams } from '../../schemas/assets/plant'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestPlantParams = (overrides?: Partial<{
  slug: string
  name: string
  timezone: string
}>): CreatePlantParams => ({
  slug: overrides?.slug ?? 'test-plant',
  name: (overrides?.name ?? 'Test Plant') as CreatePlantParams['name'],
  timezone: overrides?.timezone ?? 'America/Chicago',
  status: Option.none(),
  siteCode: Option.none(),
  description: Option.none(),
  location: Option.none(),
  metadata: Option.none(),
})

// =============================================================================
// Tests
// =============================================================================

describe('PlantMachine', () => {
  describe('CREATE procedure', () => {
    it.effect('creates a plant and returns it in commissioning state', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const plant = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )

        expect(plant.name).toBe('Test Plant')
        expect(plant.timezone).toBe('America/Chicago')
        expect(plant.id).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GET procedure', () => {
    it.effect('retrieves a created plant', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )

        const fetched = yield* actor.send(
          new InternalGetPlant({ plantId: created.id })
        )

        expect(fetched.id).toBe(created.id)
        expect(fetched.name).toBe(created.name)
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachinePlantNotFoundError for non-existent plant', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalGetPlant({ plantId: 'PLT-non-existent' })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachinePlantNotFoundError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('COMPLETE COMMISSIONING procedure (graph-validated)', () => {
    it.effect('transitions commissioning -> operational', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )

        const commissioned = yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        )

        expect(commissioned.status).toBe('operational')
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when not in commissioning state', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )

        // First commission succeeds
        yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        )

        // Second commission fails (already operational)
        const result = yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachinePlantInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('SCHEDULED SHUTDOWN procedure (graph-validated)', () => {
    it.effect('transitions operational -> scheduled_shutdown', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )
        yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        )

        const shutdown = yield* actor.send(
          new InternalScheduledShutdown({ plantId: created.id })
        )

        expect(shutdown.status).toBe('scheduled_shutdown')
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('RESTART procedure (graph-validated)', () => {
    it.effect('transitions scheduled_shutdown -> operational', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )
        yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        )
        yield* actor.send(
          new InternalScheduledShutdown({ plantId: created.id })
        )

        const restarted = yield* actor.send(
          new InternalRestart({ plantId: created.id })
        )

        expect(restarted.status).toBe('operational')
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('EMERGENCY SHUTDOWN procedure (graph-validated)', () => {
    it.effect('transitions operational -> emergency_shutdown', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )
        yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        )

        const emergency = yield* actor.send(
          new InternalEmergencyShutdown({ plantId: created.id })
        )

        expect(emergency.status).toBe('emergency_shutdown')
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('BEGIN EMERGENCY MAINTENANCE procedure (graph-validated)', () => {
    it.effect('transitions emergency_shutdown -> maintenance_shutdown', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )
        yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        )
        yield* actor.send(
          new InternalEmergencyShutdown({ plantId: created.id })
        )

        const maintenance = yield* actor.send(
          new InternalBeginEmergencyMaintenance({ plantId: created.id })
        )

        expect(maintenance.status).toBe('maintenance_shutdown')
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('MAINTENANCE SHUTDOWN procedure (graph-validated)', () => {
    it.effect('transitions operational -> maintenance_shutdown', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )
        yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        )

        const maintenance = yield* actor.send(
          new InternalMaintenanceShutdown({ plantId: created.id })
        )

        expect(maintenance.status).toBe('maintenance_shutdown')
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('COMPLETE MAINTENANCE RESTART procedure (graph-validated)', () => {
    it.effect('transitions maintenance_shutdown -> operational', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )
        yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        )
        yield* actor.send(
          new InternalMaintenanceShutdown({ plantId: created.id })
        )

        const restarted = yield* actor.send(
          new InternalCompleteMaintenanceRestart({ plantId: created.id })
        )

        expect(restarted.status).toBe('operational')
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('DECOMMISSION procedure (graph-validated)', () => {
    it.effect('transitions scheduled_shutdown -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )
        yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        )
        yield* actor.send(
          new InternalScheduledShutdown({ plantId: created.id })
        )

        const decommissioned = yield* actor.send(
          new InternalDecommissionPlant({ plantId: created.id })
        )

        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('transitions maintenance_shutdown -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )
        yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        )
        yield* actor.send(
          new InternalMaintenanceShutdown({ plantId: created.id })
        )

        const decommissioned = yield* actor.send(
          new InternalDecommissionPlant({ plantId: created.id })
        )

        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('Invalid transitions', () => {
    it.effect('fails when decommissioned plant receives any transition', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )
        yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        )
        yield* actor.send(
          new InternalScheduledShutdown({ plantId: created.id })
        )
        yield* actor.send(
          new InternalDecommissionPlant({ plantId: created.id })
        )

        // Try to restart decommissioned plant
        const result = yield* actor.send(
          new InternalCompleteCommissioning({ plantId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachinePlantInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when commissioning plant tries to decommission directly', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )

        const result = yield* actor.send(
          new InternalDecommissionPlant({ plantId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachinePlantInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ISA-95 full lifecycle flow', () => {
    it.effect('completes full lifecycle: commissioning -> operational -> emergency -> maintenance -> operational -> scheduled -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* PlantState
        const flags = yield* IIoTFeatureFlags
        const machine = makePlantMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        // Create
        const plant = yield* actor.send(
          new InternalCreatePlant({ params: createTestPlantParams() })
        )

        // Complete commissioning
        const operational1 = yield* actor.send(
          new InternalCompleteCommissioning({ plantId: plant.id })
        )
        expect(operational1.status).toBe('operational')

        // Emergency shutdown
        const emergency = yield* actor.send(
          new InternalEmergencyShutdown({ plantId: plant.id })
        )
        expect(emergency.status).toBe('emergency_shutdown')

        // Begin emergency maintenance
        const maintenance = yield* actor.send(
          new InternalBeginEmergencyMaintenance({ plantId: plant.id })
        )
        expect(maintenance.status).toBe('maintenance_shutdown')

        // Complete maintenance restart
        const operational2 = yield* actor.send(
          new InternalCompleteMaintenanceRestart({ plantId: plant.id })
        )
        expect(operational2.status).toBe('operational')

        // Scheduled shutdown
        const scheduled = yield* actor.send(
          new InternalScheduledShutdown({ plantId: plant.id })
        )
        expect(scheduled.status).toBe('scheduled_shutdown')

        // Decommission
        const decommissioned = yield* actor.send(
          new InternalDecommissionPlant({ plantId: plant.id })
        )
        expect(decommissioned.status).toBe('decommissioned')

        // Verify final state via GET
        const final = yield* actor.send(
          new InternalGetPlant({ plantId: plant.id })
        )
        expect(final.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(PlantStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})
