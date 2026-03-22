/**
 * AreaMachine Integration Tests
 *
 * Tests the Machine + StateService + Graph validation integration.
 * Verifies ISA-95 area state transitions are enforced.
 *
 * States: active, restricted, maintenance, inactive, decommissioned (terminal)
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { Machine } from '@effect/experimental'
import {
  makeAreaMachine,
  InternalCreateArea,
  InternalGetArea,
  InternalRestrict,
  InternalClearRestriction,
  InternalEnterMaintenance,
  InternalExitMaintenance,
  InternalDeactivate,
  InternalActivate,
  InternalDecommission,
} from '../../machines/AreaMachine'
import { AreaStateInMemory, AreaState } from '../../state'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../infrastructure/feature-flags'
import type { CreateAreaParams } from '../../schemas/assets/area'
import type { SiteId } from '../../schemas/identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestAreaParams = (overrides?: Partial<{
  slug: string
  name: string
  siteId: string
}>): CreateAreaParams => ({
  slug: overrides?.slug ?? 'test-area',
  name: (overrides?.name ?? 'Test Area') as CreateAreaParams['name'],
  siteId: (overrides?.siteId ?? 'SIT-test-site') as SiteId,
  status: Option.none(),
}) as CreateAreaParams

// =============================================================================
// Tests
// =============================================================================

describe('AreaMachine', () => {
  describe('CREATE procedure', () => {
    it.effect('creates an area with initial state active', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const area = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        expect(area.name).toBe('Test Area')
        expect(area.status).toBe('active')
        expect(area.id).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GET procedure', () => {
    it.effect('retrieves a created area', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        const fetched = yield* actor.send(
          new InternalGetArea({ areaId: created.id })
        )

        expect(fetched.id).toBe(created.id)
        expect(fetched.name).toBe(created.name)
        expect(fetched.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineEntityNotFoundError for non-existent area', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalGetArea({ areaId: 'ARA-does-not-exist' })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineEntityNotFoundError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('RESTRICT transition (active -> restricted)', () => {
    it.effect('restricts an active area', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        const restricted = yield* actor.send(
          new InternalRestrict({ areaId: created.id })
        )

        expect(restricted.status).toBe('restricted')
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when restricting from maintenance state', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        yield* actor.send(new InternalEnterMaintenance({ areaId: created.id }))

        const result = yield* actor.send(
          new InternalRestrict({ areaId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('CLEAR RESTRICTION transition (restricted -> active)', () => {
    it.effect('clears restriction and returns to active', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        yield* actor.send(new InternalRestrict({ areaId: created.id }))

        const cleared = yield* actor.send(
          new InternalClearRestriction({ areaId: created.id })
        )

        expect(cleared.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when clearing restriction from active state', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        // Attempt to clear restriction when already active
        const result = yield* actor.send(
          new InternalClearRestriction({ areaId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ENTER MAINTENANCE transition (active -> maintenance)', () => {
    it.effect('enters maintenance from active', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        const maintenance = yield* actor.send(
          new InternalEnterMaintenance({ areaId: created.id })
        )

        expect(maintenance.status).toBe('maintenance')
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when entering maintenance from restricted state (not direct)', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        yield* actor.send(new InternalRestrict({ areaId: created.id }))

        // Attempt maintenance from restricted
        const result = yield* actor.send(
          new InternalEnterMaintenance({ areaId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('EXIT MAINTENANCE transition (maintenance -> active)', () => {
    it.effect('exits maintenance back to active', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        yield* actor.send(new InternalEnterMaintenance({ areaId: created.id }))

        const exited = yield* actor.send(
          new InternalExitMaintenance({ areaId: created.id })
        )

        expect(exited.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('DEACTIVATE transition (active -> inactive)', () => {
    it.effect('deactivates an active area', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        const inactive = yield* actor.send(
          new InternalDeactivate({ areaId: created.id })
        )

        expect(inactive.status).toBe('inactive')
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ACTIVATE transition (inactive -> active)', () => {
    it.effect('activates an inactive area', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        yield* actor.send(new InternalDeactivate({ areaId: created.id }))

        const activated = yield* actor.send(
          new InternalActivate({ areaId: created.id })
        )

        expect(activated.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when activating from active state (already active)', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        // Attempt to activate already active area
        const result = yield* actor.send(
          new InternalActivate({ areaId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('DECOMMISSION transition (inactive|maintenance -> decommissioned, terminal)', () => {
    it.effect('decommissions an inactive area', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        yield* actor.send(new InternalDeactivate({ areaId: created.id }))

        const decommissioned = yield* actor.send(
          new InternalDecommission({ areaId: created.id })
        )

        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('decommissions an area in maintenance', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        yield* actor.send(new InternalEnterMaintenance({ areaId: created.id }))

        const decommissioned = yield* actor.send(
          new InternalDecommission({ areaId: created.id })
        )

        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when decommissioning from active state', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        // Attempt decommission directly from active
        const result = yield* actor.send(
          new InternalDecommission({ areaId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when transitioning from decommissioned (terminal)', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )

        yield* actor.send(new InternalDeactivate({ areaId: created.id }))
        yield* actor.send(new InternalDecommission({ areaId: created.id }))

        // Attempt activate from decommissioned (terminal)
        const result = yield* actor.send(
          new InternalActivate({ areaId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ISA-95 area lifecycle flow', () => {
    it.effect('completes full lifecycle: active -> restricted -> active -> inactive -> active -> maintenance -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* AreaState
        const flags = yield* IIoTFeatureFlags
        const machine = makeAreaMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        // Create
        const area = yield* actor.send(
          new InternalCreateArea({ params: createTestAreaParams() })
        )
        expect(area.status).toBe('active')

        // Restrict
        const restricted = yield* actor.send(
          new InternalRestrict({ areaId: area.id })
        )
        expect(restricted.status).toBe('restricted')

        // Clear restriction
        const cleared = yield* actor.send(
          new InternalClearRestriction({ areaId: area.id })
        )
        expect(cleared.status).toBe('active')

        // Deactivate
        const inactive = yield* actor.send(
          new InternalDeactivate({ areaId: area.id })
        )
        expect(inactive.status).toBe('inactive')

        // Activate
        const activated = yield* actor.send(
          new InternalActivate({ areaId: area.id })
        )
        expect(activated.status).toBe('active')

        // Enter maintenance
        const maintenance = yield* actor.send(
          new InternalEnterMaintenance({ areaId: area.id })
        )
        expect(maintenance.status).toBe('maintenance')

        // Decommission (terminal)
        const decommissioned = yield* actor.send(
          new InternalDecommission({ areaId: area.id })
        )
        expect(decommissioned.status).toBe('decommissioned')

        // Verify final state via GET
        const final = yield* actor.send(
          new InternalGetArea({ areaId: area.id })
        )
        expect(final.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(AreaStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})
