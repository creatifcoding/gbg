/**
 * Property-Based Machine Tests: Enterprise, Site, Area
 *
 * Tests machine procedure consistency using Effect Machine + InMemory state.
 * Verifies that graph-validated transitions produce correct state,
 * that invalid transitions yield MachineInvalidTransitionError,
 * and that GET is idempotent after transitions.
 *
 * @module
 */

import { describe, expect } from 'vitest'
import { it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import { Machine } from '@effect/experimental'

// =============================================================================
// Enterprise Imports
// =============================================================================
import {
  makeEnterpriseMachine,
  InternalCreateEnterprise,
  InternalGetEnterprise,
  InternalRestructure,
  InternalCompleteRestructuring,
  InternalMerge,
  InternalDissolve,
} from '../../../machines/EnterpriseMachine'
import { EnterpriseStateInMemory, EnterpriseState } from '../../../state'
import type { CreateEnterpriseParams } from '../../../schemas/assets/enterprise'
import {
  ALL_STATES as ENTERPRISE_ALL_STATES,
  getValidNextStates as enterpriseNextStates,
  type EnterpriseStateNode,
} from '../../../machines/graphs/enterprise-graph'

// =============================================================================
// Site Imports
// =============================================================================
import {
  makeSiteMachine,
  InternalCreateSite,
  InternalGetSite,
  InternalBeginConstruction,
  InternalCommission,
  InternalSeasonalShutdown,
  InternalReopen,
  InternalClose,
  InternalDecommission as InternalSiteDecommission,
} from '../../../machines/SiteMachine'
import { SiteStateInMemory, SiteState } from '../../../state'
import type { CreateSiteParams } from '../../../schemas/assets/site'
import type { EnterpriseId, SiteId } from '../../../schemas/identifiers'
import {
  ALL_STATES as SITE_ALL_STATES,
  getValidNextStates as siteNextStates,
  type SiteStateNode,
} from '../../../machines/graphs/site-graph'

// =============================================================================
// Area Imports
// =============================================================================
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
  InternalDecommission as InternalAreaDecommission,
} from '../../../machines/AreaMachine'
import { AreaStateInMemory, AreaState } from '../../../state'
import type { CreateAreaParams } from '../../../schemas/assets/area'
import {
  ALL_STATES as AREA_ALL_STATES,
  getValidNextStates as areaNextStates,
  type AreaStateNode,
} from '../../../machines/graphs/area-graph'

// =============================================================================
// Feature Flags
// =============================================================================
import {
  IIoTFeatureFlagsDisabledLayer,
  IIoTFeatureFlags,
} from '../../../infrastructure/feature-flags'

// =============================================================================
// Test Helpers
// =============================================================================

const createTestEnterpriseParams = (slug?: string): CreateEnterpriseParams =>
  ({
    slug: slug ?? 'prop-test-enterprise',
    name: 'Property Test Enterprise' as CreateEnterpriseParams['name'],
    status: Option.none(),
    industry: Option.none(),
    legalName: Option.none(),
    taxId: Option.none(),
    headquarters: Option.none(),
    description: Option.none(),
    metadata: Option.none(),
  }) as CreateEnterpriseParams

const createTestSiteParams = (slug?: string): CreateSiteParams =>
  ({
    slug: slug ?? 'prop-test-site',
    name: 'Property Test Site' as CreateSiteParams['name'],
    enterpriseId: 'ENT-test' as EnterpriseId,
    timezone: 'America/Chicago',
    status: Option.some('planned' as const),
    location: Option.none(),
    metadata: Option.none(),
  }) as CreateSiteParams

const createTestAreaParams = (slug?: string): CreateAreaParams =>
  ({
    slug: slug ?? 'prop-test-area',
    name: 'Property Test Area' as CreateAreaParams['name'],
    siteId: 'SIT-test' as SiteId,
    status: Option.none(),
  }) as CreateAreaParams

// =============================================================================
// Enterprise transition command map
// =============================================================================

type EnterpriseTransitionMap = Record<
  string,
  (id: string) => Effect.Effect<unknown, unknown, never>
>

function makeEnterpriseTransitionSender(
  actor: Awaited<ReturnType<typeof Machine.boot<ReturnType<typeof makeEnterpriseMachine>>>>
): EnterpriseTransitionMap {
  return {
    'active->restructuring': (id) =>
      actor.send(new InternalRestructure({ enterpriseId: id })),
    'active->merged': (id) =>
      actor.send(new InternalMerge({ enterpriseId: id })),
    'active->dissolved': (id) =>
      actor.send(new InternalDissolve({ enterpriseId: id })),
    'restructuring->active': (id) =>
      actor.send(new InternalCompleteRestructuring({ enterpriseId: id })),
    'restructuring->dissolved': (id) =>
      actor.send(new InternalDissolve({ enterpriseId: id })),
  }
}

// =============================================================================
// Site transition command map
// =============================================================================

function makeSiteTransitionSender(
  actor: Awaited<ReturnType<typeof Machine.boot<ReturnType<typeof makeSiteMachine>>>>
) {
  return {
    'planned->under_construction': (id: string) =>
      actor.send(new InternalBeginConstruction({ siteId: id })),
    'under_construction->operational': (id: string) =>
      actor.send(new InternalCommission({ siteId: id })),
    'operational->seasonal_shutdown': (id: string) =>
      actor.send(new InternalSeasonalShutdown({ siteId: id })),
    'operational->closed': (id: string) =>
      actor.send(new InternalClose({ siteId: id })),
    'seasonal_shutdown->operational': (id: string) =>
      actor.send(new InternalReopen({ siteId: id })),
    'closed->operational': (id: string) =>
      actor.send(new InternalReopen({ siteId: id })),
    'closed->decommissioned': (id: string) =>
      actor.send(new InternalSiteDecommission({ siteId: id })),
  } as Record<string, (id: string) => Effect.Effect<unknown, unknown, never>>
}

// =============================================================================
// Area transition command map
// =============================================================================

function makeAreaTransitionSender(
  actor: Awaited<ReturnType<typeof Machine.boot<ReturnType<typeof makeAreaMachine>>>>
) {
  return {
    'active->restricted': (id: string) =>
      actor.send(new InternalRestrict({ areaId: id })),
    'active->maintenance': (id: string) =>
      actor.send(new InternalEnterMaintenance({ areaId: id })),
    'active->inactive': (id: string) =>
      actor.send(new InternalDeactivate({ areaId: id })),
    'restricted->active': (id: string) =>
      actor.send(new InternalClearRestriction({ areaId: id })),
    'maintenance->active': (id: string) =>
      actor.send(new InternalExitMaintenance({ areaId: id })),
    'maintenance->decommissioned': (id: string) =>
      actor.send(new InternalAreaDecommission({ areaId: id })),
    'inactive->active': (id: string) =>
      actor.send(new InternalActivate({ areaId: id })),
    'inactive->decommissioned': (id: string) =>
      actor.send(new InternalAreaDecommission({ areaId: id })),
  } as Record<string, (id: string) => Effect.Effect<unknown, unknown, never>>
}

// =============================================================================
// Enterprise Machine Property Tests
// =============================================================================

describe('EnterpriseMachine Property Tests', () => {
  it.effect('valid transition sequence: active -> restructuring -> active -> merged', () =>
    Effect.gen(function* () {
      const state = yield* EnterpriseState
      const flags = yield* IIoTFeatureFlags
      const machine = makeEnterpriseMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
      )
      expect(created.status).toBe('active')

      const restructured = yield* actor.send(
        new InternalRestructure({ enterpriseId: created.id })
      )
      expect(restructured.status).toBe('restructuring')

      const backToActive = yield* actor.send(
        new InternalCompleteRestructuring({ enterpriseId: created.id })
      )
      expect(backToActive.status).toBe('active')

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

  it.effect('valid transition sequence: active -> restructuring -> dissolved', () =>
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

  it.effect('GET is idempotent after transitions', () =>
    Effect.gen(function* () {
      const state = yield* EnterpriseState
      const flags = yield* IIoTFeatureFlags
      const machine = makeEnterpriseMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
      )

      yield* actor.send(new InternalRestructure({ enterpriseId: created.id }))

      // GET multiple times, always same result
      const get1 = yield* actor.send(
        new InternalGetEnterprise({ enterpriseId: created.id })
      )
      const get2 = yield* actor.send(
        new InternalGetEnterprise({ enterpriseId: created.id })
      )

      expect(get1.status).toBe('restructuring')
      expect(get2.status).toBe('restructuring')
      expect(get1.id).toBe(get2.id)
    }).pipe(
      Effect.scoped,
      Effect.provide(EnterpriseStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('invalid transition from terminal state yields MachineInvalidTransitionError', () =>
    Effect.gen(function* () {
      const state = yield* EnterpriseState
      const flags = yield* IIoTFeatureFlags
      const machine = makeEnterpriseMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
      )

      // Reach merged (terminal)
      yield* actor.send(new InternalMerge({ enterpriseId: created.id }))

      // All transitions from terminal should fail
      const restructureResult = yield* actor.send(
        new InternalRestructure({ enterpriseId: created.id })
      ).pipe(Effect.either)
      expect(restructureResult._tag).toBe('Left')
      if (restructureResult._tag === 'Left') {
        expect(restructureResult.left._tag).toBe('MachineInvalidTransitionError')
      }

      const mergeResult = yield* actor.send(
        new InternalMerge({ enterpriseId: created.id })
      ).pipe(Effect.either)
      expect(mergeResult._tag).toBe('Left')

      const dissolveResult = yield* actor.send(
        new InternalDissolve({ enterpriseId: created.id })
      ).pipe(Effect.either)
      expect(dissolveResult._tag).toBe('Left')
    }).pipe(
      Effect.scoped,
      Effect.provide(EnterpriseStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('merge only valid from active, not restructuring', () =>
    Effect.gen(function* () {
      const state = yield* EnterpriseState
      const flags = yield* IIoTFeatureFlags
      const machine = makeEnterpriseMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateEnterprise({ params: createTestEnterpriseParams() })
      )

      yield* actor.send(new InternalRestructure({ enterpriseId: created.id }))

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

// =============================================================================
// Site Machine Property Tests
// =============================================================================

describe('SiteMachine Property Tests', () => {
  it.effect('valid transition sequence: planned -> under_construction -> operational -> closed -> decommissioned', () =>
    Effect.gen(function* () {
      const state = yield* SiteState
      const flags = yield* IIoTFeatureFlags
      const machine = makeSiteMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateSite({ params: createTestSiteParams() })
      )
      expect(created.status).toBe('planned')

      const uc = yield* actor.send(
        new InternalBeginConstruction({ siteId: created.id })
      )
      expect(uc.status).toBe('under_construction')

      const op = yield* actor.send(
        new InternalCommission({ siteId: created.id })
      )
      expect(op.status).toBe('operational')

      const closed = yield* actor.send(
        new InternalClose({ siteId: created.id })
      )
      expect(closed.status).toBe('closed')

      const decom = yield* actor.send(
        new InternalSiteDecommission({ siteId: created.id })
      )
      expect(decom.status).toBe('decommissioned')
    }).pipe(
      Effect.scoped,
      Effect.provide(SiteStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('seasonal shutdown cycle: operational -> seasonal_shutdown -> operational', () =>
    Effect.gen(function* () {
      const state = yield* SiteState
      const flags = yield* IIoTFeatureFlags
      const machine = makeSiteMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateSite({ params: createTestSiteParams() })
      )

      // Navigate to operational
      yield* actor.send(new InternalBeginConstruction({ siteId: created.id }))
      yield* actor.send(new InternalCommission({ siteId: created.id }))

      // Seasonal cycle
      const shutdown = yield* actor.send(
        new InternalSeasonalShutdown({ siteId: created.id })
      )
      expect(shutdown.status).toBe('seasonal_shutdown')

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

  it.effect('reopen from closed returns to operational', () =>
    Effect.gen(function* () {
      const state = yield* SiteState
      const flags = yield* IIoTFeatureFlags
      const machine = makeSiteMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateSite({ params: createTestSiteParams() })
      )

      yield* actor.send(new InternalBeginConstruction({ siteId: created.id }))
      yield* actor.send(new InternalCommission({ siteId: created.id }))
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

  it.effect('GET is idempotent after transitions', () =>
    Effect.gen(function* () {
      const state = yield* SiteState
      const flags = yield* IIoTFeatureFlags
      const machine = makeSiteMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateSite({ params: createTestSiteParams() })
      )

      yield* actor.send(new InternalBeginConstruction({ siteId: created.id }))

      const get1 = yield* actor.send(
        new InternalGetSite({ siteId: created.id })
      )
      const get2 = yield* actor.send(
        new InternalGetSite({ siteId: created.id })
      )

      expect(get1.status).toBe('under_construction')
      expect(get2.status).toBe('under_construction')
      expect(get1.id).toBe(get2.id)
    }).pipe(
      Effect.scoped,
      Effect.provide(SiteStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('invalid transition: planned cannot commission directly', () =>
    Effect.gen(function* () {
      const state = yield* SiteState
      const flags = yield* IIoTFeatureFlags
      const machine = makeSiteMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateSite({ params: createTestSiteParams() })
      )

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

  it.effect('invalid transition from terminal state yields MachineInvalidTransitionError', () =>
    Effect.gen(function* () {
      const state = yield* SiteState
      const flags = yield* IIoTFeatureFlags
      const machine = makeSiteMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateSite({ params: createTestSiteParams() })
      )

      // Navigate to decommissioned (terminal)
      yield* actor.send(new InternalBeginConstruction({ siteId: created.id }))
      yield* actor.send(new InternalCommission({ siteId: created.id }))
      yield* actor.send(new InternalClose({ siteId: created.id }))
      yield* actor.send(new InternalSiteDecommission({ siteId: created.id }))

      // All transitions from terminal should fail
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

// =============================================================================
// Area Machine Property Tests
// =============================================================================

describe('AreaMachine Property Tests', () => {
  it.effect('valid transition sequence: active -> restricted -> active -> maintenance -> active', () =>
    Effect.gen(function* () {
      const state = yield* AreaState
      const flags = yield* IIoTFeatureFlags
      const machine = makeAreaMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateArea({ params: createTestAreaParams() })
      )
      expect(created.status).toBe('active')

      const restricted = yield* actor.send(
        new InternalRestrict({ areaId: created.id })
      )
      expect(restricted.status).toBe('restricted')

      const cleared = yield* actor.send(
        new InternalClearRestriction({ areaId: created.id })
      )
      expect(cleared.status).toBe('active')

      const maint = yield* actor.send(
        new InternalEnterMaintenance({ areaId: created.id })
      )
      expect(maint.status).toBe('maintenance')

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

  it.effect('valid transition sequence: active -> inactive -> active -> inactive -> decommissioned', () =>
    Effect.gen(function* () {
      const state = yield* AreaState
      const flags = yield* IIoTFeatureFlags
      const machine = makeAreaMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateArea({ params: createTestAreaParams() })
      )

      yield* actor.send(new InternalDeactivate({ areaId: created.id }))
      yield* actor.send(new InternalActivate({ areaId: created.id }))
      yield* actor.send(new InternalDeactivate({ areaId: created.id }))

      const decom = yield* actor.send(
        new InternalAreaDecommission({ areaId: created.id })
      )
      expect(decom.status).toBe('decommissioned')
    }).pipe(
      Effect.scoped,
      Effect.provide(AreaStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('decommission from maintenance', () =>
    Effect.gen(function* () {
      const state = yield* AreaState
      const flags = yield* IIoTFeatureFlags
      const machine = makeAreaMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateArea({ params: createTestAreaParams() })
      )

      yield* actor.send(new InternalEnterMaintenance({ areaId: created.id }))

      const decom = yield* actor.send(
        new InternalAreaDecommission({ areaId: created.id })
      )
      expect(decom.status).toBe('decommissioned')
    }).pipe(
      Effect.scoped,
      Effect.provide(AreaStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('GET is idempotent after transitions', () =>
    Effect.gen(function* () {
      const state = yield* AreaState
      const flags = yield* IIoTFeatureFlags
      const machine = makeAreaMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateArea({ params: createTestAreaParams() })
      )

      yield* actor.send(new InternalRestrict({ areaId: created.id }))

      const get1 = yield* actor.send(
        new InternalGetArea({ areaId: created.id })
      )
      const get2 = yield* actor.send(
        new InternalGetArea({ areaId: created.id })
      )

      expect(get1.status).toBe('restricted')
      expect(get2.status).toBe('restricted')
      expect(get1.id).toBe(get2.id)
    }).pipe(
      Effect.scoped,
      Effect.provide(AreaStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )

  it.effect('restricted state blocks maintenance transition (MachineInvalidTransitionError)', () =>
    Effect.gen(function* () {
      const state = yield* AreaState
      const flags = yield* IIoTFeatureFlags
      const machine = makeAreaMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateArea({ params: createTestAreaParams() })
      )

      yield* actor.send(new InternalRestrict({ areaId: created.id }))

      // From restricted, cannot enter maintenance
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

  it.effect('restricted state blocks deactivation (MachineInvalidTransitionError)', () =>
    Effect.gen(function* () {
      const state = yield* AreaState
      const flags = yield* IIoTFeatureFlags
      const machine = makeAreaMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateArea({ params: createTestAreaParams() })
      )

      yield* actor.send(new InternalRestrict({ areaId: created.id }))

      const result = yield* actor.send(
        new InternalDeactivate({ areaId: created.id })
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

  it.effect('invalid transition from terminal state yields MachineInvalidTransitionError', () =>
    Effect.gen(function* () {
      const state = yield* AreaState
      const flags = yield* IIoTFeatureFlags
      const machine = makeAreaMachine({ state, flags })
      const actor = yield* Machine.boot(machine)

      const created = yield* actor.send(
        new InternalCreateArea({ params: createTestAreaParams() })
      )

      yield* actor.send(new InternalDeactivate({ areaId: created.id }))
      yield* actor.send(new InternalAreaDecommission({ areaId: created.id }))

      // From decommissioned (terminal), all transitions should fail
      const activateResult = yield* actor.send(
        new InternalActivate({ areaId: created.id })
      ).pipe(Effect.either)

      expect(activateResult._tag).toBe('Left')
      if (activateResult._tag === 'Left') {
        expect(activateResult.left._tag).toBe('MachineInvalidTransitionError')
      }
    }).pipe(
      Effect.scoped,
      Effect.provide(AreaStateInMemory),
      Effect.provide(IIoTFeatureFlagsDisabledLayer)
    )
  )
})
