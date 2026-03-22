/**
 * AreaEntity - Effect Cluster Entity for Area Lifecycle
 *
 * Manages ISA-95 asset hierarchy area-level lifecycle with state machine transitions.
 *
 * ARCHITECTURE (Machine + Entity):
 * - External API: Rpc.make() definitions
 * - Internal: Machine booted at handler init, delegates via actor.send()
 * - Graph validation: Area state transitions validated in Machine
 * - StateService: Wrapped by Machine procedures
 *
 * Entity Lifecycle:
 * - Create: Initialize area in 'active' state
 * - Get: Read current area state
 * - Restrict: active -> restricted
 * - ClearRestriction: restricted -> active
 * - EnterMaintenance: active -> maintenance
 * - ExitMaintenance: maintenance -> active
 * - Deactivate: active -> inactive
 * - Activate: inactive -> active
 * - Decommission: inactive|maintenance -> decommissioned (terminal)
 *
 * @module
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Area, CreateAreaParams } from '../schemas/assets/area'
import { AreaId } from '../schemas/identifiers'
import { AreaState } from '../state'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
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
} from '../machines/AreaMachine'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Area not found error */
export class RpcNotFoundError extends Schema.TaggedError<RpcNotFoundError>()(
  'RpcAreaNotFoundError',
  {
    areaId: AreaId,
  }
) {}

/** Area transition error (invalid state transition) */
export class RpcTransitionError extends Schema.TaggedError<RpcTransitionError>()(
  'RpcAreaTransitionError',
  {
    areaId: AreaId,
    message: Schema.String,
  }
) {}

/** Area query error */
export class RpcQueryError extends Schema.TaggedError<RpcQueryError>()(
  'RpcAreaQueryError',
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

export const AreaEntityType = 'Area' as const
export const AreaCreateTag = `${AreaEntityType}.Create` as const
export const AreaGetTag = `${AreaEntityType}.Get` as const
export const AreaRestrictTag = `${AreaEntityType}.Restrict` as const
export const AreaClearRestrictionTag = `${AreaEntityType}.ClearRestriction` as const
export const AreaEnterMaintenanceTag = `${AreaEntityType}.EnterMaintenance` as const
export const AreaExitMaintenanceTag = `${AreaEntityType}.ExitMaintenance` as const
export const AreaDeactivateTag = `${AreaEntityType}.Deactivate` as const
export const AreaActivateTag = `${AreaEntityType}.Activate` as const
export const AreaDecommissionTag = `${AreaEntityType}.Decommission` as const

// =============================================================================
// RPC Definitions
// =============================================================================

export class CreateAreaRpc extends Rpc.make(AreaCreateTag, {
  payload: CreateAreaParams,
  primaryKey: ({ slug }) => slug,
  success: Area,
  error: RpcQueryError,
}) {}

export class GetAreaRpc extends Rpc.make(AreaGetTag, {
  payload: Schema.Struct({
    areaId: AreaId,
  }),
  primaryKey: ({ areaId }) => areaId,
  success: Area,
  error: RpcNotFoundError,
}) {}

export class RestrictRpc extends Rpc.make(AreaRestrictTag, {
  payload: Schema.Struct({
    areaId: AreaId,
  }),
  primaryKey: ({ areaId }) => areaId,
  success: Area,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

export class ClearRestrictionRpc extends Rpc.make(AreaClearRestrictionTag, {
  payload: Schema.Struct({
    areaId: AreaId,
  }),
  primaryKey: ({ areaId }) => areaId,
  success: Area,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

export class EnterMaintenanceRpc extends Rpc.make(AreaEnterMaintenanceTag, {
  payload: Schema.Struct({
    areaId: AreaId,
  }),
  primaryKey: ({ areaId }) => areaId,
  success: Area,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

export class ExitMaintenanceRpc extends Rpc.make(AreaExitMaintenanceTag, {
  payload: Schema.Struct({
    areaId: AreaId,
  }),
  primaryKey: ({ areaId }) => areaId,
  success: Area,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

export class DeactivateRpc extends Rpc.make(AreaDeactivateTag, {
  payload: Schema.Struct({
    areaId: AreaId,
  }),
  primaryKey: ({ areaId }) => areaId,
  success: Area,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

export class ActivateRpc extends Rpc.make(AreaActivateTag, {
  payload: Schema.Struct({
    areaId: AreaId,
  }),
  primaryKey: ({ areaId }) => areaId,
  success: Area,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

export class DecommissionRpc extends Rpc.make(AreaDecommissionTag, {
  payload: Schema.Struct({
    areaId: AreaId,
  }),
  primaryKey: ({ areaId }) => areaId,
  success: Area,
  error: Schema.Union(RpcNotFoundError, RpcTransitionError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * Area Entity
 *
 * Distributed actor managing area lifecycle state.
 * Each area instance is keyed by areaId and maintains
 * entity-scoped state via Effect.Ref.
 */
export const AreaEntity = Entity.make(AreaEntityType, [
  CreateAreaRpc,
  GetAreaRpc,
  RestrictRpc,
  ClearRestrictionRpc,
  EnterMaintenanceRpc,
  ExitMaintenanceRpc,
  DeactivateRpc,
  ActivateRpc,
  DecommissionRpc,
])

/**
 * Type helper for Area Entity
 */
export type AreaEntity = typeof AreaEntity

// =============================================================================
// Handler Implementation (delegates to Machine)
// =============================================================================

/**
 * AreaEntity handler layer
 *
 * ARCHITECTURE (Machine + Entity):
 * - Boots AreaMachine at initialization
 * - Handlers delegate to Machine via actor.send()
 * - Machine validates state transitions via area graph
 * - StateService wrapped by Machine procedures
 */
export const AreaEntityHandlers = AreaEntity.toLayer(
  Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // PORT INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    const state = yield* AreaState              // Port: state persistence
    const flags = yield* IIoTFeatureFlags       // Port: feature flags

    // ─────────────────────────────────────────────────────────────────────────
    // MACHINE BOOT (internal actor)
    // ─────────────────────────────────────────────────────────────────────────
    const areaMachine = makeAreaMachine({ state, flags })
    const actor = yield* Machine.boot(areaMachine)

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS DELEGATE TO MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    const handleCreate = (envelope: {
      payload: typeof CreateAreaParams.Type
    }) =>
      actor.send(new InternalCreateArea({ params: envelope.payload })).pipe(
        Effect.catchTag('MachineCreateError', (e) =>
          Effect.fail(new RpcQueryError({ operation: 'create', message: e.message }))
        )
      )

    const handleGet = (envelope: { payload: { areaId: AreaId } }) =>
      actor.send(new InternalGetArea({ areaId: envelope.payload.areaId })).pipe(
        Effect.catchTag('MachineEntityNotFoundError', (e) =>
          Effect.fail(new RpcNotFoundError({ areaId: e.entityId as AreaId }))
        ),
        Effect.tapError((e) =>
          Effect.logWarning(`Get: ${e._tag} for area ${envelope.payload.areaId}`)
        )
      )

    const handleRestrict = (envelope: { payload: { areaId: AreaId } }) =>
      actor.send(new InternalRestrict({ areaId: envelope.payload.areaId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ areaId: e.entityId as AreaId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ areaId: e.entityId as AreaId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Restrict: ${e._tag} for area ${envelope.payload.areaId}`)
        )
      )

    const handleClearRestriction = (envelope: { payload: { areaId: AreaId } }) =>
      actor.send(new InternalClearRestriction({ areaId: envelope.payload.areaId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ areaId: e.entityId as AreaId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ areaId: e.entityId as AreaId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`ClearRestriction: ${e._tag} for area ${envelope.payload.areaId}`)
        )
      )

    const handleEnterMaintenance = (envelope: { payload: { areaId: AreaId } }) =>
      actor.send(new InternalEnterMaintenance({ areaId: envelope.payload.areaId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ areaId: e.entityId as AreaId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ areaId: e.entityId as AreaId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`EnterMaintenance: ${e._tag} for area ${envelope.payload.areaId}`)
        )
      )

    const handleExitMaintenance = (envelope: { payload: { areaId: AreaId } }) =>
      actor.send(new InternalExitMaintenance({ areaId: envelope.payload.areaId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ areaId: e.entityId as AreaId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ areaId: e.entityId as AreaId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`ExitMaintenance: ${e._tag} for area ${envelope.payload.areaId}`)
        )
      )

    const handleDeactivate = (envelope: { payload: { areaId: AreaId } }) =>
      actor.send(new InternalDeactivate({ areaId: envelope.payload.areaId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ areaId: e.entityId as AreaId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ areaId: e.entityId as AreaId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Deactivate: ${e._tag} for area ${envelope.payload.areaId}`)
        )
      )

    const handleActivate = (envelope: { payload: { areaId: AreaId } }) =>
      actor.send(new InternalActivate({ areaId: envelope.payload.areaId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ areaId: e.entityId as AreaId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ areaId: e.entityId as AreaId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Activate: ${e._tag} for area ${envelope.payload.areaId}`)
        )
      )

    const handleDecommission = (envelope: { payload: { areaId: AreaId } }) =>
      actor.send(new InternalDecommission({ areaId: envelope.payload.areaId })).pipe(
        Effect.catchTags({
          MachineEntityNotFoundError: (e) =>
            Effect.fail(new RpcNotFoundError({ areaId: e.entityId as AreaId })),
          MachineInvalidTransitionError: (e) =>
            Effect.fail(new RpcTransitionError({ areaId: e.entityId as AreaId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Decommission: ${e._tag} for area ${envelope.payload.areaId}`)
        )
      )

    return AreaEntity.of({
      [AreaCreateTag]: handleCreate,
      [AreaGetTag]: handleGet,
      [AreaRestrictTag]: handleRestrict,
      [AreaClearRestrictionTag]: handleClearRestriction,
      [AreaEnterMaintenanceTag]: handleEnterMaintenance,
      [AreaExitMaintenanceTag]: handleExitMaintenance,
      [AreaDeactivateTag]: handleDeactivate,
      [AreaActivateTag]: handleActivate,
      [AreaDecommissionTag]: handleDecommission,
    })
  })
)
