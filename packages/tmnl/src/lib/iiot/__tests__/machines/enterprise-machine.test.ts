/**
 * EnterpriseMachine Integration Tests
 *
 * Tests the Machine + StateService + Graph validation integration.
 * Verifies ISA-95 enterprise state transitions are enforced.
 *
 * States: active, restructuring, merged (terminal), dissolved (terminal)
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { Machine } from '@effect/experimental'
import {
  makeEnterpriseMachine,
  InternalCreateEnterprise,
  InternalGetEnterprise,
  InternalRestructure,
  InternalCompleteRestructuring,
  InternalMerge,
  InternalDissolve,
} from '../../machines/EnterpriseMachine'
import { EnterpriseStateInMemory, EnterpriseState } from '../../state'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../infrastructure/feature-flags'
import type { CreateEnterpriseParams } from '../../schemas/assets/enterprise'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestEnterpriseParams = (overrides?: Partial<{
  slug: string
  name: string
}>): CreateEnterpriseParams => ({
  slug: overrides?.slug ?? 'test-enterprise',
  name: (overrides?.name ?? 'Test Enterprise') as CreateEnterpriseParams['name'],
  status: Option.none(),
  industry: Option.none(),
  legalName: Option.none(),
  taxId: Option.none(),
  headquarters: Option.none(),
  description: Option.none(),
  metadata: Option.none(),
}) as CreateEnterpriseParams

// =============================================================================
// Tests
// =============================================================================

describe('EnterpriseMachine', () => {
  describe('CREATE procedure', () => {
    it.effect('creates an enterprise with initial state active', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const enterprise = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        expect(enterprise.name).toBe('Test Enterprise')
        expect(enterprise.status).toBe('active')
        expect(enterprise.id).toBeDefined()
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GET procedure', () => {
    it.effect('retrieves a created enterprise', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        const fetched = yield* actor.send(
          new InternalGetEnterprise({ enterpriseId: created.id })
        )

        expect(fetched.id).toBe(created.id)
        expect(fetched.name).toBe(created.name)
        expect(fetched.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineEntityNotFoundError for non-existent enterprise', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalGetEnterprise({ enterpriseId: 'ENT-does-not-exist' })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineEntityNotFoundError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('RESTRUCTURE transition (active -> restructuring)', () => {
    it.effect('restructures an active enterprise', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        const restructured = yield* actor.send(
          new InternalRestructure({ enterpriseId: created.id })
        )

        expect(restructured.status).toBe('restructuring')
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when restructuring from merged (terminal) state', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        // Merge the enterprise (terminal)
        yield* actor.send(new InternalMerge({ enterpriseId: created.id }))

        // Attempt to restructure from merged state
        const result = yield* actor.send(
          new InternalRestructure({ enterpriseId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('COMPLETE RESTRUCTURING transition (restructuring -> active)', () => {
    it.effect('completes restructuring and returns to active', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        yield* actor.send(new InternalRestructure({ enterpriseId: created.id }))

        const completed = yield* actor.send(
          new InternalCompleteRestructuring({ enterpriseId: created.id })
        )

        expect(completed.status).toBe('active')
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when completing restructuring from active state', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        // Attempt to complete restructuring when already active
        const result = yield* actor.send(
          new InternalCompleteRestructuring({ enterpriseId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('MERGE transition (active -> merged, terminal)', () => {
    it.effect('merges an active enterprise', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        const merged = yield* actor.send(
          new InternalMerge({ enterpriseId: created.id })
        )

        expect(merged.status).toBe('merged')
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when merging from restructuring state (not direct)', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        yield* actor.send(new InternalRestructure({ enterpriseId: created.id }))

        // Attempt merge from restructuring
        const result = yield* actor.send(
          new InternalMerge({ enterpriseId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when merging already merged enterprise (terminal)', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        yield* actor.send(new InternalMerge({ enterpriseId: created.id }))

        // Second merge attempt on terminal state
        const result = yield* actor.send(
          new InternalMerge({ enterpriseId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('DISSOLVE transition (active|restructuring -> dissolved, terminal)', () => {
    it.effect('dissolves an active enterprise', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        const dissolved = yield* actor.send(
          new InternalDissolve({ enterpriseId: created.id })
        )

        expect(dissolved.status).toBe('dissolved')
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('dissolves a restructuring enterprise', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        yield* actor.send(new InternalRestructure({ enterpriseId: created.id }))

        const dissolved = yield* actor.send(
          new InternalDissolve({ enterpriseId: created.id })
        )

        expect(dissolved.status).toBe('dissolved')
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when dissolving already dissolved enterprise (terminal)', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        yield* actor.send(new InternalDissolve({ enterpriseId: created.id }))

        const result = yield* actor.send(
          new InternalDissolve({ enterpriseId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when dissolving from merged state (terminal)', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )

        yield* actor.send(new InternalMerge({ enterpriseId: created.id }))

        const result = yield* actor.send(
          new InternalDissolve({ enterpriseId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ISA-95 enterprise lifecycle flow', () => {
    it.effect('completes full lifecycle: active -> restructuring -> active -> merged', () =>
      Effect.gen(function* () {
        const state = yield* EnterpriseState
        const flags = yield* IIoTFeatureFlags
        const machine = makeEnterpriseMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        // Create
        const enterprise = yield* actor.send(
          new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
        )
        expect(enterprise.status).toBe('active')

        // Restructure
        const restructured = yield* actor.send(
          new InternalRestructure({ enterpriseId: enterprise.id })
        )
        expect(restructured.status).toBe('restructuring')

        // Complete restructuring
        const completed = yield* actor.send(
          new InternalCompleteRestructuring({ enterpriseId: enterprise.id })
        )
        expect(completed.status).toBe('active')

        // Merge (terminal)
        const merged = yield* actor.send(
          new InternalMerge({ enterpriseId: enterprise.id })
        )
        expect(merged.status).toBe('merged')

        // Verify final state via GET
        const final = yield* actor.send(
          new InternalGetEnterprise({ enterpriseId: enterprise.id })
        )
        expect(final.status).toBe('merged')
      }).pipe(
        Effect.scoped,
        Effect.provide(EnterpriseStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})
