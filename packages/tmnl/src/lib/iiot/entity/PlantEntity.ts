/**
 * PlantEntity - Effect Cluster Entity for Plant Lifecycle
 *
 * Manages ISA-95 compliant plant lifecycle with state machine transitions.
 *
 * ARCHITECTURE (Machine + Entity):
 * - External API: Rpc.make() definitions (PRESERVED)
 * - Internal: Machine booted at handler init, delegates via actor.send()
 * - Graph validation: ISA-95 state transitions validated in Machine
 * - StateService: Wrapped by Machine procedures
 *
 * Entity Lifecycle:
 * - Create: Initialize plant with entity-scoped state
 * - Get: Read current plant state
 * - CompleteCommissioning: commissioning -> operational
 * - ScheduledShutdown: operational -> scheduled_shutdown
 * - Restart: scheduled_shutdown -> operational
 * - EmergencyShutdown: operational -> emergency_shutdown
 * - BeginEmergencyMaintenance: emergency_shutdown -> maintenance_shutdown
 * - MaintenanceShutdown: operational -> maintenance_shutdown
 * - CompleteMaintenanceRestart: maintenance_shutdown -> operational
 * - Decommission: scheduled_shutdown|maintenance_shutdown -> decommissioned
 *
 * @module
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Plant, CreatePlantParams } from '../schemas/assets/plant'
import { PlantId } from '../schemas/identifiers'
import { PlantState } from '../state'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
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
} from '../machines/PlantMachine'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Plant not found error */
export class RpcPlantNotFoundError extends Schema.TaggedError<RpcPlantNotFoundError>()(
  'RpcPlantNotFoundError',
  {
    plantId: PlantId,
  }
) {}

/** Plant transition error (invalid state transition) */
export class RpcPlantTransitionError extends Schema.TaggedError<RpcPlantTransitionError>()(
  'RpcPlantTransitionError',
  {
    plantId: PlantId,
    message: Schema.String,
  }
) {}

/** Plant query error */
export class RpcPlantQueryError extends Schema.TaggedError<RpcPlantQueryError>()(
  'RpcPlantQueryError',
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

export const PlantEntityType = 'Plant' as const
export const PlantCreateTag = `${PlantEntityType}.Create` as const
export const PlantGetTag = `${PlantEntityType}.Get` as const
export const PlantCompleteCommissioningTag = `${PlantEntityType}.CompleteCommissioning` as const
export const PlantScheduledShutdownTag = `${PlantEntityType}.ScheduledShutdown` as const
export const PlantRestartTag = `${PlantEntityType}.Restart` as const
export const PlantEmergencyShutdownTag = `${PlantEntityType}.EmergencyShutdown` as const
export const PlantBeginEmergencyMaintenanceTag = `${PlantEntityType}.BeginEmergencyMaintenance` as const
export const PlantMaintenanceShutdownTag = `${PlantEntityType}.MaintenanceShutdown` as const
export const PlantCompleteMaintenanceRestartTag = `${PlantEntityType}.CompleteMaintenanceRestart` as const
export const PlantDecommissionTag = `${PlantEntityType}.Decommission` as const

// =============================================================================
// RPC Definitions
// =============================================================================

/** Create a new plant */
export class CreatePlantRpc extends Rpc.make(PlantCreateTag, {
  payload: CreatePlantParams,
  primaryKey: ({ slug }) => slug,
  success: Plant,
  error: RpcPlantQueryError,
}) {}

/** Get plant by ID */
export class GetPlantRpc extends Rpc.make(PlantGetTag, {
  payload: Schema.Struct({
    plantId: PlantId,
  }),
  primaryKey: ({ plantId }) => plantId,
  success: Plant,
  error: RpcPlantNotFoundError,
}) {}

/** Complete commissioning */
export class CompleteCommissioningRpc extends Rpc.make(PlantCompleteCommissioningTag, {
  payload: Schema.Struct({
    plantId: PlantId,
  }),
  primaryKey: ({ plantId }) => plantId,
  success: Plant,
  error: Schema.Union(RpcPlantNotFoundError, RpcPlantTransitionError),
}) {}

/** Scheduled shutdown */
export class ScheduledShutdownRpc extends Rpc.make(PlantScheduledShutdownTag, {
  payload: Schema.Struct({
    plantId: PlantId,
  }),
  primaryKey: ({ plantId }) => plantId,
  success: Plant,
  error: Schema.Union(RpcPlantNotFoundError, RpcPlantTransitionError),
}) {}

/** Restart plant */
export class RestartRpc extends Rpc.make(PlantRestartTag, {
  payload: Schema.Struct({
    plantId: PlantId,
  }),
  primaryKey: ({ plantId }) => plantId,
  success: Plant,
  error: Schema.Union(RpcPlantNotFoundError, RpcPlantTransitionError),
}) {}

/** Emergency shutdown */
export class EmergencyShutdownRpc extends Rpc.make(PlantEmergencyShutdownTag, {
  payload: Schema.Struct({
    plantId: PlantId,
  }),
  primaryKey: ({ plantId }) => plantId,
  success: Plant,
  error: Schema.Union(RpcPlantNotFoundError, RpcPlantTransitionError),
}) {}

/** Begin emergency maintenance */
export class BeginEmergencyMaintenanceRpc extends Rpc.make(PlantBeginEmergencyMaintenanceTag, {
  payload: Schema.Struct({
    plantId: PlantId,
  }),
  primaryKey: ({ plantId }) => plantId,
  success: Plant,
  error: Schema.Union(RpcPlantNotFoundError, RpcPlantTransitionError),
}) {}

/** Maintenance shutdown */
export class MaintenanceShutdownRpc extends Rpc.make(PlantMaintenanceShutdownTag, {
  payload: Schema.Struct({
    plantId: PlantId,
  }),
  primaryKey: ({ plantId }) => plantId,
  success: Plant,
  error: Schema.Union(RpcPlantNotFoundError, RpcPlantTransitionError),
}) {}

/** Complete maintenance restart */
export class CompleteMaintenanceRestartRpc extends Rpc.make(PlantCompleteMaintenanceRestartTag, {
  payload: Schema.Struct({
    plantId: PlantId,
  }),
  primaryKey: ({ plantId }) => plantId,
  success: Plant,
  error: Schema.Union(RpcPlantNotFoundError, RpcPlantTransitionError),
}) {}

/** Decommission plant */
export class DecommissionPlantRpc extends Rpc.make(PlantDecommissionTag, {
  payload: Schema.Struct({
    plantId: PlantId,
  }),
  primaryKey: ({ plantId }) => plantId,
  success: Plant,
  error: Schema.Union(RpcPlantNotFoundError, RpcPlantTransitionError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * Plant Entity
 *
 * Distributed actor managing plant lifecycle state.
 * Each plant instance is keyed by plantId and maintains
 * entity-scoped state via Effect.Ref.
 */
export const PlantEntity = Entity.make(PlantEntityType, [
  CreatePlantRpc,
  GetPlantRpc,
  CompleteCommissioningRpc,
  ScheduledShutdownRpc,
  RestartRpc,
  EmergencyShutdownRpc,
  BeginEmergencyMaintenanceRpc,
  MaintenanceShutdownRpc,
  CompleteMaintenanceRestartRpc,
  DecommissionPlantRpc,
])

/** Type helper for Plant Entity */
export type PlantEntity = typeof PlantEntity

// =============================================================================
// Handler Implementation (delegates to Machine)
// =============================================================================

/**
 * PlantEntity handler layer
 *
 * ARCHITECTURE (Machine + Entity):
 * - Boots PlantMachine at initialization
 * - Handlers delegate to Machine via actor.send()
 * - Machine validates state transitions via ISA-95 graph
 * - StateService wrapped by Machine procedures
 */
export const PlantEntityHandlers = PlantEntity.toLayer(
  Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // PORT INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    const state = yield* PlantState
    const flags = yield* IIoTFeatureFlags

    // ─────────────────────────────────────────────────────────────────────────
    // MACHINE BOOT (internal actor)
    // ─────────────────────────────────────────────────────────────────────────
    const plantMachine = makePlantMachine({ state, flags })
    const actor = yield* Machine.boot(plantMachine)

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS DELEGATE TO MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    const handleCreate = (envelope: { payload: typeof CreatePlantParams.Type }) =>
      actor.send(new InternalCreatePlant({ params: envelope.payload })).pipe(
        Effect.catchTag('MachinePlantCreateError', (e) =>
          Effect.fail(new RpcPlantQueryError({ operation: 'create', message: e.message }))
        )
      )

    const handleGet = (envelope: { payload: { plantId: PlantId } }) =>
      actor.send(new InternalGetPlant({ plantId: envelope.payload.plantId })).pipe(
        Effect.catchTag('MachinePlantNotFoundError', (e) =>
          Effect.fail(new RpcPlantNotFoundError({ plantId: e.entityId as PlantId }))
        ),
        Effect.tapError((e) =>
          Effect.logWarning(`Get: ${e._tag} for plant ${envelope.payload.plantId}`)
        )
      )

    const handleCompleteCommissioning = (envelope: { payload: { plantId: PlantId } }) =>
      actor.send(new InternalCompleteCommissioning({ plantId: envelope.payload.plantId })).pipe(
        Effect.catchTags({
          MachinePlantNotFoundError: (e) =>
            Effect.fail(new RpcPlantNotFoundError({ plantId: e.entityId as PlantId })),
          MachinePlantInvalidTransitionError: (e) =>
            Effect.fail(new RpcPlantTransitionError({ plantId: e.entityId as PlantId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`CompleteCommissioning: ${e._tag} for plant ${envelope.payload.plantId}`)
        )
      )

    const handleScheduledShutdown = (envelope: { payload: { plantId: PlantId } }) =>
      actor.send(new InternalScheduledShutdown({ plantId: envelope.payload.plantId })).pipe(
        Effect.catchTags({
          MachinePlantNotFoundError: (e) =>
            Effect.fail(new RpcPlantNotFoundError({ plantId: e.entityId as PlantId })),
          MachinePlantInvalidTransitionError: (e) =>
            Effect.fail(new RpcPlantTransitionError({ plantId: e.entityId as PlantId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`ScheduledShutdown: ${e._tag} for plant ${envelope.payload.plantId}`)
        )
      )

    const handleRestart = (envelope: { payload: { plantId: PlantId } }) =>
      actor.send(new InternalRestart({ plantId: envelope.payload.plantId })).pipe(
        Effect.catchTags({
          MachinePlantNotFoundError: (e) =>
            Effect.fail(new RpcPlantNotFoundError({ plantId: e.entityId as PlantId })),
          MachinePlantInvalidTransitionError: (e) =>
            Effect.fail(new RpcPlantTransitionError({ plantId: e.entityId as PlantId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Restart: ${e._tag} for plant ${envelope.payload.plantId}`)
        )
      )

    const handleEmergencyShutdown = (envelope: { payload: { plantId: PlantId } }) =>
      actor.send(new InternalEmergencyShutdown({ plantId: envelope.payload.plantId })).pipe(
        Effect.catchTags({
          MachinePlantNotFoundError: (e) =>
            Effect.fail(new RpcPlantNotFoundError({ plantId: e.entityId as PlantId })),
          MachinePlantInvalidTransitionError: (e) =>
            Effect.fail(new RpcPlantTransitionError({ plantId: e.entityId as PlantId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`EmergencyShutdown: ${e._tag} for plant ${envelope.payload.plantId}`)
        )
      )

    const handleBeginEmergencyMaintenance = (envelope: { payload: { plantId: PlantId } }) =>
      actor.send(new InternalBeginEmergencyMaintenance({ plantId: envelope.payload.plantId })).pipe(
        Effect.catchTags({
          MachinePlantNotFoundError: (e) =>
            Effect.fail(new RpcPlantNotFoundError({ plantId: e.entityId as PlantId })),
          MachinePlantInvalidTransitionError: (e) =>
            Effect.fail(new RpcPlantTransitionError({ plantId: e.entityId as PlantId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`BeginEmergencyMaintenance: ${e._tag} for plant ${envelope.payload.plantId}`)
        )
      )

    const handleMaintenanceShutdown = (envelope: { payload: { plantId: PlantId } }) =>
      actor.send(new InternalMaintenanceShutdown({ plantId: envelope.payload.plantId })).pipe(
        Effect.catchTags({
          MachinePlantNotFoundError: (e) =>
            Effect.fail(new RpcPlantNotFoundError({ plantId: e.entityId as PlantId })),
          MachinePlantInvalidTransitionError: (e) =>
            Effect.fail(new RpcPlantTransitionError({ plantId: e.entityId as PlantId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`MaintenanceShutdown: ${e._tag} for plant ${envelope.payload.plantId}`)
        )
      )

    const handleCompleteMaintenanceRestart = (envelope: { payload: { plantId: PlantId } }) =>
      actor.send(new InternalCompleteMaintenanceRestart({ plantId: envelope.payload.plantId })).pipe(
        Effect.catchTags({
          MachinePlantNotFoundError: (e) =>
            Effect.fail(new RpcPlantNotFoundError({ plantId: e.entityId as PlantId })),
          MachinePlantInvalidTransitionError: (e) =>
            Effect.fail(new RpcPlantTransitionError({ plantId: e.entityId as PlantId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`CompleteMaintenanceRestart: ${e._tag} for plant ${envelope.payload.plantId}`)
        )
      )

    const handleDecommission = (envelope: { payload: { plantId: PlantId } }) =>
      actor.send(new InternalDecommissionPlant({ plantId: envelope.payload.plantId })).pipe(
        Effect.catchTags({
          MachinePlantNotFoundError: (e) =>
            Effect.fail(new RpcPlantNotFoundError({ plantId: e.entityId as PlantId })),
          MachinePlantInvalidTransitionError: (e) =>
            Effect.fail(new RpcPlantTransitionError({ plantId: e.entityId as PlantId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Decommission: ${e._tag} for plant ${envelope.payload.plantId}`)
        )
      )

    return PlantEntity.of({
      [PlantCreateTag]: handleCreate,
      [PlantGetTag]: handleGet,
      [PlantCompleteCommissioningTag]: handleCompleteCommissioning,
      [PlantScheduledShutdownTag]: handleScheduledShutdown,
      [PlantRestartTag]: handleRestart,
      [PlantEmergencyShutdownTag]: handleEmergencyShutdown,
      [PlantBeginEmergencyMaintenanceTag]: handleBeginEmergencyMaintenance,
      [PlantMaintenanceShutdownTag]: handleMaintenanceShutdown,
      [PlantCompleteMaintenanceRestartTag]: handleCompleteMaintenanceRestart,
      [PlantDecommissionTag]: handleDecommission,
    })
  })
)
