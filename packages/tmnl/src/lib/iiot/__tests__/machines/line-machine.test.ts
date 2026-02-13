/**
 * LineMachine Integration Tests
 *
 * Tests the Machine + StateService + Graph validation integration.
 * Verifies ISA-95 production line state transitions are enforced.
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect } from 'effect'
import { Machine } from '@effect/experimental'
import {
  makeLineMachine,
  InternalCreateLine,
  InternalGetLine,
  InternalStart,
  InternalStop,
  InternalBeginChangeover,
  InternalCompleteChangeover,
  InternalMarkStarved,
  InternalClearStarved,
  InternalMarkBlocked,
  InternalClearBlocked,
  InternalEnterMaintenance,
  InternalCompleteMaintenance,
  InternalDecommissionLine,
} from '../../machines/LineMachine'
import { LineState, LineStateInMemory } from '../../state'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../infrastructure/feature-flags'
import type { CreateLineParams } from '../../schemas/assets/line'
import type { PlantId } from '../../schemas/identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestLineParams = (overrides?: Partial<{
  slug: string
  name: string
  plantId: string
}>): CreateLineParams => ({
  slug: (overrides?.slug ?? 'test-line') as CreateLineParams['slug'],
  name: (overrides?.name ?? 'Test Line') as CreateLineParams['name'],
  plantId: (overrides?.plantId ?? 'PLT-test-plant') as PlantId,
  status: 'idle',
})

// =============================================================================
// Tests
// =============================================================================

describe('LineMachine', () => {
  describe('CREATE procedure', () => {
    it.effect('creates a line and returns it in idle state', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const line = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )

        expect(line.name).toBe('Test Line')
        expect(line.id).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GET procedure', () => {
    it.effect('retrieves a created line', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )

        const fetched = yield* actor.send(
          new InternalGetLine({ lineId: created.id })
        )

        expect(fetched.id).toBe(created.id)
        expect(fetched.name).toBe(created.name)
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineLineNotFoundError for non-existent line', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalGetLine({ lineId: 'LIN-non-existent' })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineLineNotFoundError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('START procedure (graph-validated)', () => {
    it.effect('transitions idle -> running', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )

        const started = yield* actor.send(
          new InternalStart({ lineId: created.id })
        )

        expect(started.status).toBe('running')
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('STOP procedure (graph-validated)', () => {
    it.effect('transitions running -> idle', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )
        yield* actor.send(new InternalStart({ lineId: created.id }))

        const stopped = yield* actor.send(
          new InternalStop({ lineId: created.id })
        )

        expect(stopped.status).toBe('idle')
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('CHANGEOVER procedures (graph-validated)', () => {
    it.effect('transitions running -> changeover -> running', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )
        yield* actor.send(new InternalStart({ lineId: created.id }))

        const changeover = yield* actor.send(
          new InternalBeginChangeover({ lineId: created.id })
        )
        expect(changeover.status).toBe('changeover')

        const completed = yield* actor.send(
          new InternalCompleteChangeover({ lineId: created.id })
        )
        expect(completed.status).toBe('running')
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('STARVED procedures (graph-validated)', () => {
    it.effect('transitions running -> starved -> running', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )
        yield* actor.send(new InternalStart({ lineId: created.id }))

        const starved = yield* actor.send(
          new InternalMarkStarved({ lineId: created.id })
        )
        expect(starved.status).toBe('starved')

        const cleared = yield* actor.send(
          new InternalClearStarved({ lineId: created.id })
        )
        expect(cleared.status).toBe('running')
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('BLOCKED procedures (graph-validated)', () => {
    it.effect('transitions running -> blocked -> running', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )
        yield* actor.send(new InternalStart({ lineId: created.id }))

        const blocked = yield* actor.send(
          new InternalMarkBlocked({ lineId: created.id })
        )
        expect(blocked.status).toBe('blocked')

        const cleared = yield* actor.send(
          new InternalClearBlocked({ lineId: created.id })
        )
        expect(cleared.status).toBe('running')
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('MAINTENANCE procedures (graph-validated)', () => {
    it.effect('transitions idle -> maintenance -> idle', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )

        const maintenance = yield* actor.send(
          new InternalEnterMaintenance({ lineId: created.id })
        )
        expect(maintenance.status).toBe('maintenance')

        const completed = yield* actor.send(
          new InternalCompleteMaintenance({ lineId: created.id })
        )
        expect(completed.status).toBe('idle')
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('DECOMMISSION procedure (graph-validated)', () => {
    it.effect('transitions idle -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )

        const decommissioned = yield* actor.send(
          new InternalDecommissionLine({ lineId: created.id })
        )

        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('transitions maintenance -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )
        yield* actor.send(
          new InternalEnterMaintenance({ lineId: created.id })
        )

        const decommissioned = yield* actor.send(
          new InternalDecommissionLine({ lineId: created.id })
        )

        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('Invalid transitions', () => {
    it.effect('fails when decommissioned line receives any transition', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )
        yield* actor.send(
          new InternalDecommissionLine({ lineId: created.id })
        )

        const result = yield* actor.send(
          new InternalStart({ lineId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineLineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when running line tries to decommission directly', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )
        yield* actor.send(new InternalStart({ lineId: created.id }))

        const result = yield* actor.send(
          new InternalDecommissionLine({ lineId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineLineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ISA-95 full lifecycle flow', () => {
    it.effect('completes full lifecycle: idle -> running -> changeover -> running -> starved -> running -> idle -> maintenance -> idle -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* LineState
        const flags = yield* IIoTFeatureFlags
        const machine = makeLineMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        // Create (starts idle)
        const line = yield* actor.send(
          new InternalCreateLine({ params: createTestLineParams() })
        )

        // Start: idle -> running
        const running1 = yield* actor.send(
          new InternalStart({ lineId: line.id })
        )
        expect(running1.status).toBe('running')

        // Begin changeover: running -> changeover
        const changeover = yield* actor.send(
          new InternalBeginChangeover({ lineId: line.id })
        )
        expect(changeover.status).toBe('changeover')

        // Complete changeover: changeover -> running
        const running2 = yield* actor.send(
          new InternalCompleteChangeover({ lineId: line.id })
        )
        expect(running2.status).toBe('running')

        // Mark starved: running -> starved
        const starved = yield* actor.send(
          new InternalMarkStarved({ lineId: line.id })
        )
        expect(starved.status).toBe('starved')

        // Clear starved: starved -> running
        const running3 = yield* actor.send(
          new InternalClearStarved({ lineId: line.id })
        )
        expect(running3.status).toBe('running')

        // Stop: running -> idle
        const idle = yield* actor.send(
          new InternalStop({ lineId: line.id })
        )
        expect(idle.status).toBe('idle')

        // Enter maintenance: idle -> maintenance
        const maintenance = yield* actor.send(
          new InternalEnterMaintenance({ lineId: line.id })
        )
        expect(maintenance.status).toBe('maintenance')

        // Complete maintenance: maintenance -> idle
        const idle2 = yield* actor.send(
          new InternalCompleteMaintenance({ lineId: line.id })
        )
        expect(idle2.status).toBe('idle')

        // Decommission: idle -> decommissioned
        const decommissioned = yield* actor.send(
          new InternalDecommissionLine({ lineId: line.id })
        )
        expect(decommissioned.status).toBe('decommissioned')

        // Verify final state
        const final = yield* actor.send(
          new InternalGetLine({ lineId: line.id })
        )
        expect(final.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(LineStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})
