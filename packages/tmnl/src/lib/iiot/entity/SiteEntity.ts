/**
 * SiteEntity - Effect Cluster Entity for Site Lifecycle
 *
 * Manages ISA-95 asset hierarchy site-level lifecycle with state machine transitions.
 *
 * ARCHITECTURE (Machine + Entity):
 * - External API: Rpc.make() definitions
 * - Internal: Machine booted at handler init, delegates via actor.send()
 * - Graph validation: Site state transitions validated in Machine
 * - StateService: Wrapped by Machine procedures
 *
 * Entity Lifecycle:
 * - Create: Initialize site in 'planned' state
 * - Get: Read current site state
 * - BeginConstruction: planned -> under_construction
 * - Commission: under_construction -> operational
 * - SeasonalShutdown: operational -> seasonal_shutdown
 * - Reopen: seasonal_shutdown|closed -> operational
 * - Close: operational -> closed
 * - Decommission: closed -> decommissioned (terminal)
 *
 * @module
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Site, CreateSiteParams } from '../schemas/assets/site'
import { SiteId } from '../schemas/identifiers'
import { SiteState } from '../state'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
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
} from '../machines/SiteMachine'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Site not found error */
export class RpcNotFoundError extends Schema.TaggedError<RpcNotFoundError>()(
  'RpcSiteNotFoundError',
  {
    siteId: SiteId,
  }
) {}

/** Site transition error (invalid state transition) */
export class RpcTransitionError extends Schema.TaggedError<RpcTransitionError>()(
  'RpcSiteTransitionError',
  {
    siteId: SiteId,
    message: Schema.String,
  }
) {}

/** Site query error */
export class RpcQueryError extends Schema.TaggedError<RpcQueryError>()(
  'RpcSiteQueryError',
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

export const SiteEntityType = 'Site' as const
export const SiteCreateTag = `${SiteEntityType}.Create` as const
export const SiteGetTag = `${SiteEntityType}.Get` as const
export const SiteBeginConstructionTag = `${SiteEntityType}.BeginConstruction` as const
export const SiteCommissionTag = `${SiteEntityType}.Commission` as const
export const SiteSeasonalShutdownTag = `${SiteEntityType}.SeasonalShutdown` as const
export const SiteReopenTag = `${SiteEntityType}.Reopen` as const
export const SiteCloseTag = `${SiteEntityType}.Close` as const
export const SiteDecommissionTag = `${SiteEntityType}.Decommission` as const

// =============================================================================
// RPC Definitions
// =============================================================================

/** Create a new site in 'planned' state. Keyed by slug for entity routing. */
export class CreateSiteRpc extends Rpc.make(SiteCreateTag, {
  payload: CreateSiteParams,
  primaryKey: ({ slug }) => slug,
  success: Site,
  error: RpcQueryError,
}) {}

/** Get current site state by ID. */
export class GetSiteRpc extends Rpc.make(SiteGetTag, {
  payload: Schema.Struct({
    siteId: SiteId,
  }),
  primaryKey: ({ siteId }) => siteId,
  success: Site,
  error: RpcNotFoundError,
}) {}

/** Transition: planned -> under_construction. */
export class BeginConstructionRpc extends Rpc.make(SiteBeginConstructionTag, {
  payload: Schema.Struct({
    siteId: SiteId,
  }),
  primaryKey: ({ siteId }) => siteId,
  success: Site,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

/** Transition: under_construction -> operational. */
export class CommissionRpc extends Rpc.make(SiteCommissionTag, {
  payload: Schema.Struct({
    siteId: SiteId,
  }),
  primaryKey: ({ siteId }) => siteId,
  success: Site,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

/** Transition: operational -> seasonal_shutdown. */
export class SeasonalShutdownRpc extends Rpc.make(SiteSeasonalShutdownTag, {
  payload: Schema.Struct({
    siteId: SiteId,
  }),
  primaryKey: ({ siteId }) => siteId,
  success: Site,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

/** Transition: seasonal_shutdown|closed -> operational. */
export class ReopenRpc extends Rpc.make(SiteReopenTag, {
  payload: Schema.Struct({
    siteId: SiteId,
  }),
  primaryKey: ({ siteId }) => siteId,
  success: Site,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

/** Transition: operational -> closed. */
export class CloseRpc extends Rpc.make(SiteCloseTag, {
  payload: Schema.Struct({
    siteId: SiteId,
  }),
  primaryKey: ({ siteId }) => siteId,
  success: Site,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

/** Transition: closed -> decommissioned (terminal state). */
export class DecommissionRpc extends Rpc.make(SiteDecommissionTag, {
  payload: Schema.Struct({
    siteId: SiteId,
  }),
  primaryKey: ({ siteId }) => siteId,
  success: Site,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * Site Entity
 *
 * Distributed actor managing site lifecycle state.
 * Each site instance is keyed by siteId and maintains
 * entity-scoped state via Effect.Ref.
 */
export const SiteEntity = Entity.make(SiteEntityType, [
  CreateSiteRpc,
  GetSiteRpc,
  BeginConstructionRpc,
  CommissionRpc,
  SeasonalShutdownRpc,
  ReopenRpc,
  CloseRpc,
  DecommissionRpc,
])

/**
 * Type helper for Site Entity
 */
export type SiteEntity = typeof SiteEntity

// =============================================================================
// Handler Implementation (delegates to Machine)
// =============================================================================

/**
 * SiteEntity handler layer
 *
 * ARCHITECTURE (Machine + Entity):
 * - Boots SiteMachine at initialization
 * - Handlers delegate to Machine via actor.send()
 * - Machine validates state transitions via site graph
 * - StateService wrapped by Machine procedures
 */
export const SiteEntityHandlers = SiteEntity.toLayer(
  Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // PORT INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    const state = yield* SiteState              // Port: state persistence
    const flags = yield* IIoTFeatureFlags       // Port: feature flags

    // ─────────────────────────────────────────────────────────────────────────
    // MACHINE BOOT (internal actor)
    // ─────────────────────────────────────────────────────────────────────────
    const siteMachine = makeSiteMachine({ state, flags })
    const actor = yield* Machine.boot(siteMachine)

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS DELEGATE TO MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    const handleCreate = (envelope: {
      payload: typeof CreateSiteParams.Type
    }) =>
      actor.send(new InternalCreateSite({ params: envelope.payload })).pipe(
        Effect.catchTag('MachineCreateError', (e) =>
          Effect.fail(new RpcQueryError({ operation: 'create', message: e.message }))
        )
      )

    const handleGet = (envelope: { payload: { siteId: SiteId } }) =>
      actor.send(new InternalGetSite({ siteId: envelope.payload.siteId })).pipe(
        Effect.catchTag('MachineEntityNotFoundError', (e) =>
          Effect.fail(new RpcNotFoundError({ siteId: e.entityId as SiteId }))
        ),
        Effect.tapError((e) =>
          Effect.logWarning(`Get: ${e._tag} for site ${envelope.payload.siteId}`)
        )
      )

    const handleBeginConstruction = (envelope: { payload: { siteId: SiteId } }) =>
      actor.send(new InternalBeginConstruction({ siteId: envelope.payload.siteId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ siteId: e.entityId as SiteId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ siteId: e.entityId as SiteId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`BeginConstruction: ${e._tag} for site ${envelope.payload.siteId}`)
        )
      )

    const handleCommission = (envelope: { payload: { siteId: SiteId } }) =>
      actor.send(new InternalCommission({ siteId: envelope.payload.siteId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ siteId: e.entityId as SiteId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ siteId: e.entityId as SiteId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Commission: ${e._tag} for site ${envelope.payload.siteId}`)
        )
      )

    const handleSeasonalShutdown = (envelope: { payload: { siteId: SiteId } }) =>
      actor.send(new InternalSeasonalShutdown({ siteId: envelope.payload.siteId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ siteId: e.entityId as SiteId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ siteId: e.entityId as SiteId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`SeasonalShutdown: ${e._tag} for site ${envelope.payload.siteId}`)
        )
      )

    const handleReopen = (envelope: { payload: { siteId: SiteId } }) =>
      actor.send(new InternalReopen({ siteId: envelope.payload.siteId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ siteId: e.entityId as SiteId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ siteId: e.entityId as SiteId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Reopen: ${e._tag} for site ${envelope.payload.siteId}`)
        )
      )

    const handleClose = (envelope: { payload: { siteId: SiteId } }) =>
      actor.send(new InternalClose({ siteId: envelope.payload.siteId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ siteId: e.entityId as SiteId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ siteId: e.entityId as SiteId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Close: ${e._tag} for site ${envelope.payload.siteId}`)
        )
      )

    const handleDecommission = (envelope: { payload: { siteId: SiteId } }) =>
      actor.send(new InternalDecommission({ siteId: envelope.payload.siteId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ siteId: e.entityId as SiteId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ siteId: e.entityId as SiteId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Decommission: ${e._tag} for site ${envelope.payload.siteId}`)
        )
      )

    return SiteEntity.of({
      [SiteCreateTag]: handleCreate,
      [SiteGetTag]: handleGet,
      [SiteBeginConstructionTag]: handleBeginConstruction,
      [SiteCommissionTag]: handleCommission,
      [SiteSeasonalShutdownTag]: handleSeasonalShutdown,
      [SiteReopenTag]: handleReopen,
      [SiteCloseTag]: handleClose,
      [SiteDecommissionTag]: handleDecommission,
    })
  })
)
