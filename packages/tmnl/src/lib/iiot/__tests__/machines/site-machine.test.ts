/**
 * SiteMachine Integration Tests
 *
 * Tests the Machine + StateService + Graph validation integration.
 * Verifies ISA-95 site state transitions are enforced.
 *
 * States: planned, under_construction, operational, seasonal_shutdown, closed, decommissioned (terminal)
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { Machine } from '@effect/experimental'
import {
  makeSiteMachine,
  InternalCreateSite,
  InternalGetSite,
  InternalBeginConstruction,
  InternalCommission,
  InternalSeasonalShutdown,
  InternalReopen,
  InternalClose,
  InternalDecommission,
} from '../../machines/SiteMachine'
import { SiteStateInMemory, SiteState } from '../../state'
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../infrastructure/feature-flags'
import type { CreateSiteParams } from '../../schemas/assets/site'
import type { EnterpriseId } from '../../schemas/identifiers'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestSiteParams = (overrides?: Partial<{
  slug: string
  name: string
  enterpriseId: string
  timezone: string
  status: 'planned' | 'under_construction' | 'operational' | 'seasonal_shutdown' | 'closed' | 'decommissioned'
}>): CreateSiteParams => ({
  slug: overrides?.slug ?? 'test-site',
  name: (overrides?.name ?? 'Test Site') as CreateSiteParams['name'],
  enterpriseId: (overrides?.enterpriseId ?? 'ENT-test-enterprise') as EnterpriseId,
  timezone: overrides?.timezone ?? 'America/Chicago',
  status: overrides?.status ? Option.some(overrides.status) : Option.none(),
  location: Option.none(),
  metadata: Option.none(),
}) as CreateSiteParams

// =============================================================================
// Tests
// =============================================================================

describe('SiteMachine', () => {
  describe('CREATE procedure', () => {
    it.effect('creates a site with explicit planned status', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const site = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'planned' }) })
        )

        expect(site.name).toBe('Test Site')
        expect(site.status).toBe('planned')
        expect(site.id).toBeDefined()
        expect(site.enterpriseId).toBe('ENT-test-enterprise')
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('GET procedure', () => {
    it.effect('retrieves a created site', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'planned' }) })
        )

        const fetched = yield* actor.send(
          new InternalGetSite({ siteId: created.id })
        )

        expect(fetched.id).toBe(created.id)
        expect(fetched.name).toBe(created.name)
        expect(fetched.status).toBe('planned')
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails with MachineEntityNotFoundError for non-existent site', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const result = yield* actor.send(
          new InternalGetSite({ siteId: 'SIT-does-not-exist' })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineEntityNotFoundError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('BEGIN CONSTRUCTION transition (planned -> under_construction)', () => {
    it.effect('begins construction on a planned site', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'planned' }) })
        )

        const underConstruction = yield* actor.send(
          new InternalBeginConstruction({ siteId: created.id })
        )

        expect(underConstruction.status).toBe('under_construction')
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when beginning construction from operational state', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'operational' }) })
        )

        // Attempt begin construction from operational
        const result = yield* actor.send(
          new InternalBeginConstruction({ siteId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('COMMISSION transition (under_construction -> operational)', () => {
    it.effect('commissions a site under construction', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'planned' }) })
        )

        yield* actor.send(new InternalBeginConstruction({ siteId: created.id }))

        const commissioned = yield* actor.send(
          new InternalCommission({ siteId: created.id })
        )

        expect(commissioned.status).toBe('operational')
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when commissioning from planned state (skip not allowed)', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'planned' }) })
        )

        // Attempt to commission directly from planned (skip under_construction)
        const result = yield* actor.send(
          new InternalCommission({ siteId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('SEASONAL SHUTDOWN transition (operational -> seasonal_shutdown)', () => {
    it.effect('puts operational site into seasonal shutdown', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'operational' }) })
        )

        const shutdown = yield* actor.send(
          new InternalSeasonalShutdown({ siteId: created.id })
        )

        expect(shutdown.status).toBe('seasonal_shutdown')
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('REOPEN transition (seasonal_shutdown|closed -> operational)', () => {
    it.effect('reopens a site from seasonal shutdown', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'operational' }) })
        )

        yield* actor.send(new InternalSeasonalShutdown({ siteId: created.id }))

        const reopened = yield* actor.send(
          new InternalReopen({ siteId: created.id })
        )

        expect(reopened.status).toBe('operational')
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('reopens a site from closed state', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'operational' }) })
        )

        yield* actor.send(new InternalClose({ siteId: created.id }))

        const reopened = yield* actor.send(
          new InternalReopen({ siteId: created.id })
        )

        expect(reopened.status).toBe('operational')
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('CLOSE transition (operational -> closed)', () => {
    it.effect('closes an operational site', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'operational' }) })
        )

        const closed = yield* actor.send(
          new InternalClose({ siteId: created.id })
        )

        expect(closed.status).toBe('closed')
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('DECOMMISSION transition (closed -> decommissioned, terminal)', () => {
    it.effect('decommissions a closed site', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'operational' }) })
        )

        yield* actor.send(new InternalClose({ siteId: created.id }))

        const decommissioned = yield* actor.send(
          new InternalDecommission({ siteId: created.id })
        )

        expect(decommissioned.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when decommissioning from operational state (must close first)', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'operational' }) })
        )

        // Attempt decommission directly from operational
        const result = yield* actor.send(
          new InternalDecommission({ siteId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )

    it.effect('fails when transitioning from decommissioned (terminal)', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'operational' }) })
        )

        yield* actor.send(new InternalClose({ siteId: created.id }))
        yield* actor.send(new InternalDecommission({ siteId: created.id }))

        // Attempt reopen from decommissioned (terminal)
        const result = yield* actor.send(
          new InternalReopen({ siteId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('Invalid transitions', () => {
    it.effect('fails when closing from planned state (invalid)', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        const created = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'planned' }) })
        )

        // Try to close from planned (invalid)
        const result = yield* actor.send(
          new InternalClose({ siteId: created.id })
        ).pipe(Effect.either)

        expect(result._tag).toBe('Left')
        if (result._tag === 'Left') {
          expect(result.left._tag).toBe('MachineInvalidTransitionError')
        }
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })

  describe('ISA-95 site lifecycle flow', () => {
    it.effect('completes full lifecycle: planned -> under_construction -> operational -> closed -> decommissioned', () =>
      Effect.gen(function* () {
        const state = yield* SiteState
        const flags = yield* IIoTFeatureFlags
        const machine = makeSiteMachine({ state, flags })
        const actor = yield* Machine.boot(machine)

        // Create with planned status
        const site = yield* actor.send(
          new InternalCreateSite({ params: createTestSiteParams({ status: 'planned' }) })
        )
        expect(site.status).toBe('planned')

        // Begin construction
        const underConstruction = yield* actor.send(
          new InternalBeginConstruction({ siteId: site.id })
        )
        expect(underConstruction.status).toBe('under_construction')

        // Commission
        const operational = yield* actor.send(
          new InternalCommission({ siteId: site.id })
        )
        expect(operational.status).toBe('operational')

        // Close
        const closed = yield* actor.send(
          new InternalClose({ siteId: site.id })
        )
        expect(closed.status).toBe('closed')

        // Decommission (terminal)
        const decommissioned = yield* actor.send(
          new InternalDecommission({ siteId: site.id })
        )
        expect(decommissioned.status).toBe('decommissioned')

        // Verify final state via GET
        const final = yield* actor.send(
          new InternalGetSite({ siteId: site.id })
        )
        expect(final.status).toBe('decommissioned')
      }).pipe(
        Effect.scoped,
        Effect.provide(SiteStateInMemory),
        Effect.provide(IIoTFeatureFlagsDisabledLayer)
      )
    )
  })
})
