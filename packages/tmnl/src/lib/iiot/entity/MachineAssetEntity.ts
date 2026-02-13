/**
 * MachineAssetEntity - Effect Cluster Entity for Machine Asset Lifecycle
 *
 * Manages ISA-95 compliant machine asset lifecycle with state machine transitions.
 *
 * ARCHITECTURE (Machine + Entity):
 * - External API: Rpc.make() definitions (PRESERVED)
 * - Internal: Machine booted at handler init, delegates via actor.send()
 * - Graph validation: ISA-95 state transitions validated in Machine
 * - StateService: Wrapped by Machine procedures
 *
 * Entity Lifecycle:
 * - Create: Initialize machine with entity-scoped state
 * - Get: Read current machine state
 * - Activate: Commission -> Operational (graph-validated)
 * - GoIdle: Operational -> Idle (graph-validated)
 * - Resume: Idle -> Operational (graph-validated)
 * - MarkFaulted: Operational|Idle -> Faulted (graph-validated)
 * - ScheduleRepair: Faulted -> Scheduled Maintenance (graph-validated)
 * - EmergencyRepair: Faulted -> Unscheduled Maintenance (graph-validated)
 * - ScheduleMaintenance: Operational|Idle -> Scheduled Maintenance (graph-validated)
 * - CompleteMaintenance: Maintenance -> Operational (graph-validated)
 * - Retire: Operational|Idle -> Retired (graph-validated)
 * - Decommission: Retired|Scheduled Maintenance -> Decommissioned (graph-validated)
 *
 * @module
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Machine as MachineAsset, CreateMachineParams } from '../schemas/assets/machine'
import { MachineId } from '../schemas/identifiers'
import { MachineState } from '../state'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
import {
  makeMachineAssetMachine,
  InternalCreateMachine,
  InternalGetMachine,
  InternalActivate,
  InternalGoIdle,
  InternalResume,
  InternalMarkFaulted,
  InternalScheduleRepair,
  InternalEmergencyRepair,
  InternalScheduleMaintenance,
  InternalCompleteMaintenance,
  InternalRetire,
  InternalDecommission,
} from '../machines/MachineAssetMachine'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** Machine asset not found error */
export class RpcMachineAssetNotFoundError extends Schema.TaggedError<RpcMachineAssetNotFoundError>()(
  'RpcMachineAssetNotFoundError',
  {
    machineId: MachineId,
  }
) {}

/** Machine asset transition error (invalid state transition) */
export class RpcMachineAssetTransitionError extends Schema.TaggedError<RpcMachineAssetTransitionError>()(
  'RpcMachineAssetTransitionError',
  {
    machineId: MachineId,
    message: Schema.String,
  }
) {}

/** Machine asset query error */
export class RpcMachineAssetQueryError extends Schema.TaggedError<RpcMachineAssetQueryError>()(
  'RpcMachineAssetQueryError',
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

export const MachineAssetEntityType = 'MachineAsset' as const
export const MachineAssetCreateTag = `${MachineAssetEntityType}.Create` as const
export const MachineAssetGetTag = `${MachineAssetEntityType}.Get` as const
export const MachineAssetActivateTag = `${MachineAssetEntityType}.Activate` as const
export const MachineAssetGoIdleTag = `${MachineAssetEntityType}.GoIdle` as const
export const MachineAssetResumeTag = `${MachineAssetEntityType}.Resume` as const
export const MachineAssetMarkFaultedTag = `${MachineAssetEntityType}.MarkFaulted` as const
export const MachineAssetScheduleRepairTag = `${MachineAssetEntityType}.ScheduleRepair` as const
export const MachineAssetEmergencyRepairTag = `${MachineAssetEntityType}.EmergencyRepair` as const
export const MachineAssetScheduleMaintenanceTag = `${MachineAssetEntityType}.ScheduleMaintenance` as const
export const MachineAssetCompleteMaintenanceTag = `${MachineAssetEntityType}.CompleteMaintenance` as const
export const MachineAssetRetireTag = `${MachineAssetEntityType}.Retire` as const
export const MachineAssetDecommissionTag = `${MachineAssetEntityType}.Decommission` as const

// =============================================================================
// RPC Definitions
// =============================================================================

export class CreateMachineAssetRpc extends Rpc.make(MachineAssetCreateTag, {
  payload: CreateMachineParams,
  primaryKey: ({ slug }) => slug,
  success: MachineAsset,
  error: RpcMachineAssetQueryError,
}) {}

export class GetMachineAssetRpc extends Rpc.make(MachineAssetGetTag, {
  payload: Schema.Struct({ machineId: MachineId }),
  primaryKey: ({ machineId }) => machineId,
  success: MachineAsset,
  error: RpcMachineAssetNotFoundError,
}) {}

export class ActivateMachineAssetRpc extends Rpc.make(MachineAssetActivateTag, {
  payload: Schema.Struct({ machineId: MachineId }),
  primaryKey: ({ machineId }) => machineId,
  success: MachineAsset,
  error: Schema.Union(RpcMachineAssetNotFoundError, RpcMachineAssetTransitionError),
}) {}

export class GoIdleMachineAssetRpc extends Rpc.make(MachineAssetGoIdleTag, {
  payload: Schema.Struct({ machineId: MachineId }),
  primaryKey: ({ machineId }) => machineId,
  success: MachineAsset,
  error: Schema.Union(RpcMachineAssetNotFoundError, RpcMachineAssetTransitionError),
}) {}

export class ResumeMachineAssetRpc extends Rpc.make(MachineAssetResumeTag, {
  payload: Schema.Struct({ machineId: MachineId }),
  primaryKey: ({ machineId }) => machineId,
  success: MachineAsset,
  error: Schema.Union(RpcMachineAssetNotFoundError, RpcMachineAssetTransitionError),
}) {}

export class MarkFaultedMachineAssetRpc extends Rpc.make(MachineAssetMarkFaultedTag, {
  payload: Schema.Struct({ machineId: MachineId }),
  primaryKey: ({ machineId }) => machineId,
  success: MachineAsset,
  error: Schema.Union(RpcMachineAssetNotFoundError, RpcMachineAssetTransitionError),
}) {}

export class ScheduleRepairMachineAssetRpc extends Rpc.make(MachineAssetScheduleRepairTag, {
  payload: Schema.Struct({ machineId: MachineId }),
  primaryKey: ({ machineId }) => machineId,
  success: MachineAsset,
  error: Schema.Union(RpcMachineAssetNotFoundError, RpcMachineAssetTransitionError),
}) {}

export class EmergencyRepairMachineAssetRpc extends Rpc.make(MachineAssetEmergencyRepairTag, {
  payload: Schema.Struct({ machineId: MachineId }),
  primaryKey: ({ machineId }) => machineId,
  success: MachineAsset,
  error: Schema.Union(RpcMachineAssetNotFoundError, RpcMachineAssetTransitionError),
}) {}

export class ScheduleMaintenanceMachineAssetRpc extends Rpc.make(MachineAssetScheduleMaintenanceTag, {
  payload: Schema.Struct({ machineId: MachineId }),
  primaryKey: ({ machineId }) => machineId,
  success: MachineAsset,
  error: Schema.Union(RpcMachineAssetNotFoundError, RpcMachineAssetTransitionError),
}) {}

export class CompleteMaintenanceMachineAssetRpc extends Rpc.make(MachineAssetCompleteMaintenanceTag, {
  payload: Schema.Struct({ machineId: MachineId }),
  primaryKey: ({ machineId }) => machineId,
  success: MachineAsset,
  error: Schema.Union(RpcMachineAssetNotFoundError, RpcMachineAssetTransitionError),
}) {}

export class RetireMachineAssetRpc extends Rpc.make(MachineAssetRetireTag, {
  payload: Schema.Struct({ machineId: MachineId }),
  primaryKey: ({ machineId }) => machineId,
  success: MachineAsset,
  error: Schema.Union(RpcMachineAssetNotFoundError, RpcMachineAssetTransitionError),
}) {}

export class DecommissionMachineAssetRpc extends Rpc.make(MachineAssetDecommissionTag, {
  payload: Schema.Struct({ machineId: MachineId }),
  primaryKey: ({ machineId }) => machineId,
  success: MachineAsset,
  error: Schema.Union(RpcMachineAssetNotFoundError, RpcMachineAssetTransitionError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

export const MachineAssetEntity = Entity.make(MachineAssetEntityType, [
  CreateMachineAssetRpc,
  GetMachineAssetRpc,
  ActivateMachineAssetRpc,
  GoIdleMachineAssetRpc,
  ResumeMachineAssetRpc,
  MarkFaultedMachineAssetRpc,
  ScheduleRepairMachineAssetRpc,
  EmergencyRepairMachineAssetRpc,
  ScheduleMaintenanceMachineAssetRpc,
  CompleteMaintenanceMachineAssetRpc,
  RetireMachineAssetRpc,
  DecommissionMachineAssetRpc,
])

export type MachineAssetEntity = typeof MachineAssetEntity

// =============================================================================
// Handler Implementation (delegates to Machine)
// =============================================================================

export const MachineAssetEntityHandlers = MachineAssetEntity.toLayer(
  Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // PORT INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    const state = yield* MachineState
    const flags = yield* IIoTFeatureFlags

    // ─────────────────────────────────────────────────────────────────────────
    // MACHINE BOOT (internal actor)
    // ─────────────────────────────────────────────────────────────────────────
    const machine = makeMachineAssetMachine({ state, flags })
    const actor = yield* Machine.boot(machine)

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS DELEGATE TO MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    const handleCreate = (envelope: { payload: typeof CreateMachineParams.Type }) =>
      actor.send(new InternalCreateMachine({ params: envelope.payload })).pipe(
        Effect.catchTag('MachineAssetCreateError', (e) =>
          Effect.fail(new RpcMachineAssetQueryError({ operation: 'create', message: e.message }))
        )
      )

    const handleGet = (envelope: { payload: { machineId: MachineId } }) =>
      actor.send(new InternalGetMachine({ machineId: envelope.payload.machineId })).pipe(
        Effect.catchTag('MachineMachineAssetNotFoundError', (e) =>
          Effect.fail(new RpcMachineAssetNotFoundError({ machineId: e.entityId as MachineId }))
        ),
        Effect.tapError((e) =>
          Effect.logWarning(`Get: ${e._tag} for machine ${envelope.payload.machineId}`)
        )
      )

    const makeTransitionHandler = (
      InternalRequest: new (args: { machineId: string }) => { machineId: string; readonly _tag: string },
    ) =>
      (envelope: { payload: { machineId: MachineId } }) =>
        actor.send(new (InternalRequest as any)({ machineId: envelope.payload.machineId })).pipe(
          Effect.catchTags({
            MachineMachineAssetNotFoundError: (e: { entityId: string }) =>
              Effect.fail(new RpcMachineAssetNotFoundError({ machineId: e.entityId as MachineId })),
            MachineMachineAssetInvalidTransitionError: (e: { entityId: string; message: string }) =>
              Effect.fail(new RpcMachineAssetTransitionError({ machineId: e.entityId as MachineId, message: e.message })),
          }),
          Effect.tapError((e) =>
            Effect.logWarning(`Transition: ${e._tag} for machine ${envelope.payload.machineId}`)
          )
        )

    const handleActivate = makeTransitionHandler(InternalActivate)
    const handleGoIdle = makeTransitionHandler(InternalGoIdle)
    const handleResume = makeTransitionHandler(InternalResume)
    const handleMarkFaulted = makeTransitionHandler(InternalMarkFaulted)
    const handleScheduleRepair = makeTransitionHandler(InternalScheduleRepair)
    const handleEmergencyRepair = makeTransitionHandler(InternalEmergencyRepair)
    const handleScheduleMaintenance = makeTransitionHandler(InternalScheduleMaintenance)
    const handleCompleteMaintenance = makeTransitionHandler(InternalCompleteMaintenance)
    const handleRetire = makeTransitionHandler(InternalRetire)
    const handleDecommission = makeTransitionHandler(InternalDecommission)

    return MachineAssetEntity.of({
      [MachineAssetCreateTag]: handleCreate,
      [MachineAssetGetTag]: handleGet,
      [MachineAssetActivateTag]: handleActivate,
      [MachineAssetGoIdleTag]: handleGoIdle,
      [MachineAssetResumeTag]: handleResume,
      [MachineAssetMarkFaultedTag]: handleMarkFaulted,
      [MachineAssetScheduleRepairTag]: handleScheduleRepair,
      [MachineAssetEmergencyRepairTag]: handleEmergencyRepair,
      [MachineAssetScheduleMaintenanceTag]: handleScheduleMaintenance,
      [MachineAssetCompleteMaintenanceTag]: handleCompleteMaintenance,
      [MachineAssetRetireTag]: handleRetire,
      [MachineAssetDecommissionTag]: handleDecommission,
    })
  })
)
