/**
 * SiteMachine - Effect Machine for Site Lifecycle
 *
 * Internal actor-style state machine that wraps SiteState service.
 * Used by SiteEntity.toLayer() handlers to delegate operations.
 *
 * Features:
 * - Graph-validated state transitions (ISA-95 asset hierarchy)
 * - Non-blocking event emission via maybeEmitAsset
 * - Machine procedures for CRUD + domain commands
 *
 * Architecture:
 * ```
 * SiteEntity.toLayer()
 *   |-> Machine.boot(SiteMachine)
 *         |-> actor.send(InternalCreateSite)
 *               |-> Machine.procedures.add() handler
 *                     |-> state.create/get/set (StateService)
 *                     |-> maybeEmitAsset() (EventLog)
 * ```
 *
 * @module
 */

import { Schema, Effect, pipe } from 'effect'
import { Machine } from '@effect/experimental'
import type { SiteStateShape } from '../state/SiteState'
import type { FeatureFlagsShape } from '../infrastructure/feature-flags'
import { Site, CreateSiteParams } from '../schemas/assets/site'
import type { SiteId } from '../schemas/identifiers'
import { maybeEmitAsset } from '../entity/_helpers'
import {
  canBeginConstruction,
  canCommission,
  canSeasonalShutdown,
  canReopen,
  canClose,
  canDecommission,
  type SiteStateNode,
} from './graphs/site-graph'

// =============================================================================
// Internal Error Types (for Machine procedures)
// =============================================================================

/** Site not found in state service */
export class MachineEntityNotFoundError extends Schema.TaggedError<MachineEntityNotFoundError>()(
  'MachineEntityNotFoundError',
  {
    entityId: Schema.String,
  }
) {}

/** Invalid state transition per site graph */
export class MachineInvalidTransitionError extends Schema.TaggedError<MachineInvalidTransitionError>()(
  'MachineInvalidTransitionError',
  {
    entityId: Schema.String,
    fromState: Schema.String,
    toState: Schema.String,
    message: Schema.String,
  }
) {}

/** General create error */
export class MachineCreateError extends Schema.TaggedError<MachineCreateError>()(
  'MachineCreateError',
  {
    message: Schema.String,
  }
) {}

// =============================================================================
// Internal Request Types (for Machine procedures)
// =============================================================================

export class InternalCreateSite extends Schema.TaggedRequest<InternalCreateSite>()(
  'InternalCreateSite',
  {
    failure: MachineCreateError,
    success: Site,
    payload: {
      params: CreateSiteParams,
    },
  }
) {}

export class InternalGetSite extends Schema.TaggedRequest<InternalGetSite>()(
  'InternalGetSite',
  {
    failure: MachineEntityNotFoundError,
    success: Site,
    payload: {
      siteId: Schema.String,
    },
  }
) {}

export class InternalBeginConstruction extends Schema.TaggedRequest<InternalBeginConstruction>()(
  'InternalBeginConstruction',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Site,
    payload: {
      siteId: Schema.String,
    },
  }
) {}

export class InternalCommission extends Schema.TaggedRequest<InternalCommission>()(
  'InternalCommission',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Site,
    payload: {
      siteId: Schema.String,
    },
  }
) {}

export class InternalSeasonalShutdown extends Schema.TaggedRequest<InternalSeasonalShutdown>()(
  'InternalSeasonalShutdown',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Site,
    payload: {
      siteId: Schema.String,
    },
  }
) {}

export class InternalReopen extends Schema.TaggedRequest<InternalReopen>()(
  'InternalReopen',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Site,
    payload: {
      siteId: Schema.String,
    },
  }
) {}

export class InternalClose extends Schema.TaggedRequest<InternalClose>()(
  'InternalClose',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Site,
    payload: {
      siteId: Schema.String,
    },
  }
) {}

export class InternalDecommission extends Schema.TaggedRequest<InternalDecommission>()(
  'InternalDecommission',
  {
    failure: Schema.Union(MachineEntityNotFoundError, MachineInvalidTransitionError),
    success: Site,
    payload: {
      siteId: Schema.String,
    },
  }
) {}

// =============================================================================
// Machine State Type
// =============================================================================

export interface SiteMachineState {
  readonly mode: SiteStateNode
}

// =============================================================================
// Dependencies Interface
// =============================================================================

export interface SiteMachineDeps {
  readonly state: SiteStateShape
  readonly flags: FeatureFlagsShape
}

// =============================================================================
// Machine Factory
// =============================================================================

/**
 * Create a SiteMachine with injected dependencies.
 *
 * The machine wraps the SiteState service and validates
 * all state transitions via the site state graph.
 *
 * @param deps - Injected dependencies (state service + feature flags)
 * @returns Effect Machine that can be booted
 */
export const makeSiteMachine = (deps: SiteMachineDeps) =>
  Machine.make(
    (_input: void, previous?: SiteMachineState) =>
      Effect.gen(function* () {
        const { state, flags } = deps

        const initialState: SiteMachineState = previous ?? { mode: 'planned' }

        return pipe(
          Machine.procedures.make(initialState),

          // ─────────────────────────────────────────────────────────────────────
          // CREATE
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCreateSite>()(
            'InternalCreateSite',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const site = yield* state.create(request.params).pipe(
                  Effect.catchAll((e) =>
                    Effect.fail(new MachineCreateError({ message: `Create site failed: ${String(e)}` }))
                  )
                )

                yield* Effect.logInfo(`[SiteMachine] Created site ${site.id}`)
                yield* maybeEmitAsset(flags, 'Site', 'SiteCreated', { site })

                return [site, { mode: 'planned' as SiteStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // GET
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalGetSite>()(
            'InternalGetSite',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const site = yield* state.get(request.siteId as SiteId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.siteId }))
                  )
                )

                return [site, { mode: site.status as SiteStateNode }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // BEGIN CONSTRUCTION (planned -> under_construction)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalBeginConstruction>()(
            'InternalBeginConstruction',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const site = yield* state.get(request.siteId as SiteId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.siteId }))
                  )
                )

                const currentState = site.status as SiteStateNode
                const targetState: SiteStateNode = 'under_construction'

                if (!canBeginConstruction(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.siteId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot begin construction in state '${currentState}'. Site must be in 'planned' state.`,
                    })
                  )
                }

                const updated = new Site({
                  ...site,
                  status: 'under_construction',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[SiteMachine] Site ${request.siteId} construction begun`)
                yield* maybeEmitAsset(flags, 'Site', 'SiteConstructionBegun', { site: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // COMMISSION (under_construction -> operational)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalCommission>()(
            'InternalCommission',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const site = yield* state.get(request.siteId as SiteId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.siteId }))
                  )
                )

                const currentState = site.status as SiteStateNode
                const targetState: SiteStateNode = 'operational'

                if (!canCommission(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.siteId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot commission site in state '${currentState}'. Site must be in 'under_construction' state.`,
                    })
                  )
                }

                const updated = new Site({
                  ...site,
                  status: 'operational',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[SiteMachine] Site ${request.siteId} commissioned`)
                yield* maybeEmitAsset(flags, 'Site', 'SiteCommissioned', { site: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // SEASONAL SHUTDOWN (operational -> seasonal_shutdown)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalSeasonalShutdown>()(
            'InternalSeasonalShutdown',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const site = yield* state.get(request.siteId as SiteId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.siteId }))
                  )
                )

                const currentState = site.status as SiteStateNode
                const targetState: SiteStateNode = 'seasonal_shutdown'

                if (!canSeasonalShutdown(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.siteId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot seasonal shutdown in state '${currentState}'. Site must be in 'operational' state.`,
                    })
                  )
                }

                const updated = new Site({
                  ...site,
                  status: 'seasonal_shutdown',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[SiteMachine] Site ${request.siteId} seasonal shutdown`)
                yield* maybeEmitAsset(flags, 'Site', 'SiteSeasonalShutdown', { site: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // REOPEN (seasonal_shutdown|closed -> operational)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalReopen>()(
            'InternalReopen',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const site = yield* state.get(request.siteId as SiteId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.siteId }))
                  )
                )

                const currentState = site.status as SiteStateNode
                const targetState: SiteStateNode = 'operational'

                if (!canReopen(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.siteId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot reopen site in state '${currentState}'. Site must be in 'seasonal_shutdown' or 'closed' state.`,
                    })
                  )
                }

                const updated = new Site({
                  ...site,
                  status: 'operational',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[SiteMachine] Site ${request.siteId} reopened`)
                yield* maybeEmitAsset(flags, 'Site', 'SiteReopened', { site: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // CLOSE (operational -> closed)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalClose>()(
            'InternalClose',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const site = yield* state.get(request.siteId as SiteId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.siteId }))
                  )
                )

                const currentState = site.status as SiteStateNode
                const targetState: SiteStateNode = 'closed'

                if (!canClose(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.siteId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot close site in state '${currentState}'. Site must be in 'operational' state.`,
                    })
                  )
                }

                const updated = new Site({
                  ...site,
                  status: 'closed',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[SiteMachine] Site ${request.siteId} closed`)
                yield* maybeEmitAsset(flags, 'Site', 'SiteClosed', { site: updated })

                return [updated, { mode: targetState }] as const
              })
          ),

          // ─────────────────────────────────────────────────────────────────────
          // DECOMMISSION (closed -> decommissioned, terminal)
          // ─────────────────────────────────────────────────────────────────────
          Machine.procedures.add<InternalDecommission>()(
            'InternalDecommission',
            ({ state: _machineState, request }) =>
              Effect.gen(function* () {
                const site = yield* state.get(request.siteId as SiteId).pipe(
                  Effect.catchAll(() =>
                    Effect.fail(new MachineEntityNotFoundError({ entityId: request.siteId }))
                  )
                )

                const currentState = site.status as SiteStateNode
                const targetState: SiteStateNode = 'decommissioned'

                if (!canDecommission(currentState)) {
                  return yield* Effect.fail(
                    new MachineInvalidTransitionError({
                      entityId: request.siteId,
                      fromState: currentState,
                      toState: targetState,
                      message: `Cannot decommission site in state '${currentState}'. Site must be in 'closed' state.`,
                    })
                  )
                }

                const updated = new Site({
                  ...site,
                  status: 'decommissioned',
                })

                yield* state.set(updated)
                yield* Effect.logInfo(`[SiteMachine] Site ${request.siteId} decommissioned`)
                yield* maybeEmitAsset(flags, 'Site', 'SiteDecommissioned', { site: updated })

                return [updated, { mode: targetState }] as const
              })
          )
        )
      })
  )

// =============================================================================
// Type Helpers
// =============================================================================

/** Type of the SiteMachine */
export type SiteMachine = ReturnType<typeof makeSiteMachine>

/** Type of the booted SiteMachine actor */
export type SiteMachineActor = Awaited<ReturnType<typeof Machine.boot<SiteMachine>>>
