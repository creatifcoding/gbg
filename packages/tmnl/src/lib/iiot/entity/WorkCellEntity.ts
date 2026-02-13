/**
 * WorkCellEntity - Effect Cluster Entity for WorkCell Lifecycle
 *
 * Manages ISA-95 compliant work cell lifecycle with state machine transitions.
 *
 * ARCHITECTURE (Machine + Entity):
 * - External API: Rpc.make() definitions
 * - Internal: Machine booted at handler init, delegates via actor.send()
 * - Graph validation: ISA-95 state transitions validated in Machine
 * - StateService: Wrapped by Machine procedures
 *
 * Entity Lifecycle:
 * - Create: Initialize work cell with entity-scoped state
 * - Get: Read current work cell state
 * - BeginSetup: idle -> setup
 * - CompleteSetup: setup -> running
 * - Stop: running -> idle
 * - MarkBlocked: running -> blocked
 * - ClearBlocked: blocked -> running
 * - MarkFaulted: running -> faulted
 * - ClearFault: faulted -> idle
 * - EnterMaintenance: idle|faulted -> maintenance
 * - CompleteMaintenance: maintenance -> idle
 * - Decommission: idle|maintenance -> decommissioned
 *
 * @module
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { WorkCell, CreateWorkCellParams } from '../schemas/assets/workcell'
import { WorkCellId } from '../schemas/identifiers'
import { WorkCellState } from '../state'
import { IIoTFeatureFlags } from '../infrastructure/feature-flags'
import {
  makeWorkCellMachine,
  InternalCreateWorkCell,
  InternalGetWorkCell,
  InternalBeginSetup,
  InternalCompleteSetup,
  InternalStopWorkCell,
  InternalMarkBlockedWorkCell,
  InternalClearBlockedWorkCell,
  InternalMarkFaulted,
  InternalClearFault,
  InternalEnterMaintenanceWorkCell,
  InternalCompleteMaintenanceWorkCell,
  InternalDecommissionWorkCell,
} from '../machines/WorkCellMachine'

// =============================================================================
// RPC Error Schemas
// =============================================================================

/** WorkCell not found error */
export class RpcWorkCellNotFoundError extends Schema.TaggedError<RpcWorkCellNotFoundError>()(
  'RpcWorkCellNotFoundError',
  {
    workCellId: WorkCellId,
  }
) {}

/** WorkCell transition error (invalid state transition) */
export class RpcWorkCellTransitionError extends Schema.TaggedError<RpcWorkCellTransitionError>()(
  'RpcWorkCellTransitionError',
  {
    workCellId: WorkCellId,
    message: Schema.String,
  }
) {}

/** WorkCell query error */
export class RpcWorkCellQueryError extends Schema.TaggedError<RpcWorkCellQueryError>()(
  'RpcWorkCellQueryError',
  {
    operation: Schema.String,
    message: Schema.String,
  }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

export const WorkCellEntityType = 'WorkCell' as const
export const WorkCellCreateTag = `${WorkCellEntityType}.Create` as const
export const WorkCellGetTag = `${WorkCellEntityType}.Get` as const
export const WorkCellBeginSetupTag = `${WorkCellEntityType}.BeginSetup` as const
export const WorkCellCompleteSetupTag = `${WorkCellEntityType}.CompleteSetup` as const
export const WorkCellStopTag = `${WorkCellEntityType}.Stop` as const
export const WorkCellMarkBlockedTag = `${WorkCellEntityType}.MarkBlocked` as const
export const WorkCellClearBlockedTag = `${WorkCellEntityType}.ClearBlocked` as const
export const WorkCellMarkFaultedTag = `${WorkCellEntityType}.MarkFaulted` as const
export const WorkCellClearFaultTag = `${WorkCellEntityType}.ClearFault` as const
export const WorkCellEnterMaintenanceTag = `${WorkCellEntityType}.EnterMaintenance` as const
export const WorkCellCompleteMaintenanceTag = `${WorkCellEntityType}.CompleteMaintenance` as const
export const WorkCellDecommissionTag = `${WorkCellEntityType}.Decommission` as const

// =============================================================================
// RPC Definitions
// =============================================================================

/** Create a new work cell */
export class CreateWorkCellRpc extends Rpc.make(WorkCellCreateTag, {
  payload: CreateWorkCellParams,
  primaryKey: ({ slug }) => slug,
  success: WorkCell,
  error: RpcWorkCellQueryError,
}) {}

/** Get work cell by ID */
export class GetWorkCellRpc extends Rpc.make(WorkCellGetTag, {
  payload: Schema.Struct({ workCellId: WorkCellId }),
  primaryKey: ({ workCellId }) => workCellId,
  success: WorkCell,
  error: RpcWorkCellNotFoundError,
}) {}

/** Begin setup */
export class BeginSetupRpc extends Rpc.make(WorkCellBeginSetupTag, {
  payload: Schema.Struct({ workCellId: WorkCellId }),
  primaryKey: ({ workCellId }) => workCellId,
  success: WorkCell,
  error: Schema.Union(RpcWorkCellNotFoundError, RpcWorkCellTransitionError),
}) {}

/** Complete setup */
export class CompleteSetupRpc extends Rpc.make(WorkCellCompleteSetupTag, {
  payload: Schema.Struct({ workCellId: WorkCellId }),
  primaryKey: ({ workCellId }) => workCellId,
  success: WorkCell,
  error: Schema.Union(RpcWorkCellNotFoundError, RpcWorkCellTransitionError),
}) {}

/** Stop work cell */
export class StopWorkCellRpc extends Rpc.make(WorkCellStopTag, {
  payload: Schema.Struct({ workCellId: WorkCellId }),
  primaryKey: ({ workCellId }) => workCellId,
  success: WorkCell,
  error: Schema.Union(RpcWorkCellNotFoundError, RpcWorkCellTransitionError),
}) {}

/** Mark blocked */
export class MarkBlockedWorkCellRpc extends Rpc.make(WorkCellMarkBlockedTag, {
  payload: Schema.Struct({ workCellId: WorkCellId }),
  primaryKey: ({ workCellId }) => workCellId,
  success: WorkCell,
  error: Schema.Union(RpcWorkCellNotFoundError, RpcWorkCellTransitionError),
}) {}

/** Clear blocked */
export class ClearBlockedWorkCellRpc extends Rpc.make(WorkCellClearBlockedTag, {
  payload: Schema.Struct({ workCellId: WorkCellId }),
  primaryKey: ({ workCellId }) => workCellId,
  success: WorkCell,
  error: Schema.Union(RpcWorkCellNotFoundError, RpcWorkCellTransitionError),
}) {}

/** Mark faulted */
export class MarkFaultedRpc extends Rpc.make(WorkCellMarkFaultedTag, {
  payload: Schema.Struct({ workCellId: WorkCellId }),
  primaryKey: ({ workCellId }) => workCellId,
  success: WorkCell,
  error: Schema.Union(RpcWorkCellNotFoundError, RpcWorkCellTransitionError),
}) {}

/** Clear fault */
export class ClearFaultRpc extends Rpc.make(WorkCellClearFaultTag, {
  payload: Schema.Struct({ workCellId: WorkCellId }),
  primaryKey: ({ workCellId }) => workCellId,
  success: WorkCell,
  error: Schema.Union(RpcWorkCellNotFoundError, RpcWorkCellTransitionError),
}) {}

/** Enter maintenance */
export class EnterMaintenanceWorkCellRpc extends Rpc.make(WorkCellEnterMaintenanceTag, {
  payload: Schema.Struct({ workCellId: WorkCellId }),
  primaryKey: ({ workCellId }) => workCellId,
  success: WorkCell,
  error: Schema.Union(RpcWorkCellNotFoundError, RpcWorkCellTransitionError),
}) {}

/** Complete maintenance */
export class CompleteMaintenanceWorkCellRpc extends Rpc.make(WorkCellCompleteMaintenanceTag, {
  payload: Schema.Struct({ workCellId: WorkCellId }),
  primaryKey: ({ workCellId }) => workCellId,
  success: WorkCell,
  error: Schema.Union(RpcWorkCellNotFoundError, RpcWorkCellTransitionError),
}) {}

/** Decommission work cell */
export class DecommissionWorkCellRpc extends Rpc.make(WorkCellDecommissionTag, {
  payload: Schema.Struct({ workCellId: WorkCellId }),
  primaryKey: ({ workCellId }) => workCellId,
  success: WorkCell,
  error: Schema.Union(RpcWorkCellNotFoundError, RpcWorkCellTransitionError),
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

/**
 * WorkCell Entity
 *
 * Distributed actor managing work cell lifecycle state.
 * Each work cell instance is keyed by workCellId and maintains
 * entity-scoped state via Effect.Ref.
 */
export const WorkCellEntity = Entity.make(WorkCellEntityType, [
  CreateWorkCellRpc,
  GetWorkCellRpc,
  BeginSetupRpc,
  CompleteSetupRpc,
  StopWorkCellRpc,
  MarkBlockedWorkCellRpc,
  ClearBlockedWorkCellRpc,
  MarkFaultedRpc,
  ClearFaultRpc,
  EnterMaintenanceWorkCellRpc,
  CompleteMaintenanceWorkCellRpc,
  DecommissionWorkCellRpc,
])

/** Type helper for WorkCell Entity */
export type WorkCellEntity = typeof WorkCellEntity

// =============================================================================
// Handler Implementation (delegates to Machine)
// =============================================================================

/**
 * WorkCellEntity handler layer
 *
 * ARCHITECTURE (Machine + Entity):
 * - Boots WorkCellMachine at initialization
 * - Handlers delegate to Machine via actor.send()
 * - Machine validates state transitions via ISA-95 graph
 * - StateService wrapped by Machine procedures
 */
export const WorkCellEntityHandlers = WorkCellEntity.toLayer(
  Effect.gen(function* () {
    // ─────────────────────────────────────────────────────────────────────────
    // PORT INJECTION
    // ─────────────────────────────────────────────────────────────────────────
    const state = yield* WorkCellState
    const flags = yield* IIoTFeatureFlags

    // ─────────────────────────────────────────────────────────────────────────
    // MACHINE BOOT (internal actor)
    // ─────────────────────────────────────────────────────────────────────────
    const workCellMachine = makeWorkCellMachine({ state, flags })
    const actor = yield* Machine.boot(workCellMachine)

    // ─────────────────────────────────────────────────────────────────────────
    // HANDLERS DELEGATE TO MACHINE
    // ─────────────────────────────────────────────────────────────────────────

    const handleCreate = (envelope: { payload: typeof CreateWorkCellParams.Type }) =>
      actor.send(new InternalCreateWorkCell({ params: envelope.payload })).pipe(
        Effect.catchTag('MachineWorkCellCreateError', (e) =>
          Effect.fail(new RpcWorkCellQueryError({ operation: 'create', message: e.message }))
        )
      )

    const handleGet = (envelope: { payload: { workCellId: WorkCellId } }) =>
      actor.send(new InternalGetWorkCell({ workCellId: envelope.payload.workCellId })).pipe(
        Effect.catchTag('MachineWorkCellNotFoundError', (e) =>
          Effect.fail(new RpcWorkCellNotFoundError({ workCellId: e.entityId as WorkCellId }))
        ),
        Effect.tapError((e) =>
          Effect.logWarning(`Get: ${e._tag} for workCell ${envelope.payload.workCellId}`)
        )
      )

    const handleBeginSetup = (envelope: { payload: { workCellId: WorkCellId } }) =>
      actor.send(new InternalBeginSetup({ workCellId: envelope.payload.workCellId })).pipe(
        Effect.catchTags({
          MachineWorkCellNotFoundError: (e) =>
            Effect.fail(new RpcWorkCellNotFoundError({ workCellId: e.entityId as WorkCellId })),
          MachineWorkCellInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkCellTransitionError({ workCellId: e.entityId as WorkCellId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`BeginSetup: ${e._tag} for workCell ${envelope.payload.workCellId}`)
        )
      )

    const handleCompleteSetup = (envelope: { payload: { workCellId: WorkCellId } }) =>
      actor.send(new InternalCompleteSetup({ workCellId: envelope.payload.workCellId })).pipe(
        Effect.catchTags({
          MachineWorkCellNotFoundError: (e) =>
            Effect.fail(new RpcWorkCellNotFoundError({ workCellId: e.entityId as WorkCellId })),
          MachineWorkCellInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkCellTransitionError({ workCellId: e.entityId as WorkCellId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`CompleteSetup: ${e._tag} for workCell ${envelope.payload.workCellId}`)
        )
      )

    const handleStop = (envelope: { payload: { workCellId: WorkCellId } }) =>
      actor.send(new InternalStopWorkCell({ workCellId: envelope.payload.workCellId })).pipe(
        Effect.catchTags({
          MachineWorkCellNotFoundError: (e) =>
            Effect.fail(new RpcWorkCellNotFoundError({ workCellId: e.entityId as WorkCellId })),
          MachineWorkCellInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkCellTransitionError({ workCellId: e.entityId as WorkCellId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Stop: ${e._tag} for workCell ${envelope.payload.workCellId}`)
        )
      )

    const handleMarkBlocked = (envelope: { payload: { workCellId: WorkCellId } }) =>
      actor.send(new InternalMarkBlockedWorkCell({ workCellId: envelope.payload.workCellId })).pipe(
        Effect.catchTags({
          MachineWorkCellNotFoundError: (e) =>
            Effect.fail(new RpcWorkCellNotFoundError({ workCellId: e.entityId as WorkCellId })),
          MachineWorkCellInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkCellTransitionError({ workCellId: e.entityId as WorkCellId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`MarkBlocked: ${e._tag} for workCell ${envelope.payload.workCellId}`)
        )
      )

    const handleClearBlocked = (envelope: { payload: { workCellId: WorkCellId } }) =>
      actor.send(new InternalClearBlockedWorkCell({ workCellId: envelope.payload.workCellId })).pipe(
        Effect.catchTags({
          MachineWorkCellNotFoundError: (e) =>
            Effect.fail(new RpcWorkCellNotFoundError({ workCellId: e.entityId as WorkCellId })),
          MachineWorkCellInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkCellTransitionError({ workCellId: e.entityId as WorkCellId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`ClearBlocked: ${e._tag} for workCell ${envelope.payload.workCellId}`)
        )
      )

    const handleMarkFaulted = (envelope: { payload: { workCellId: WorkCellId } }) =>
      actor.send(new InternalMarkFaulted({ workCellId: envelope.payload.workCellId })).pipe(
        Effect.catchTags({
          MachineWorkCellNotFoundError: (e) =>
            Effect.fail(new RpcWorkCellNotFoundError({ workCellId: e.entityId as WorkCellId })),
          MachineWorkCellInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkCellTransitionError({ workCellId: e.entityId as WorkCellId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`MarkFaulted: ${e._tag} for workCell ${envelope.payload.workCellId}`)
        )
      )

    const handleClearFault = (envelope: { payload: { workCellId: WorkCellId } }) =>
      actor.send(new InternalClearFault({ workCellId: envelope.payload.workCellId })).pipe(
        Effect.catchTags({
          MachineWorkCellNotFoundError: (e) =>
            Effect.fail(new RpcWorkCellNotFoundError({ workCellId: e.entityId as WorkCellId })),
          MachineWorkCellInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkCellTransitionError({ workCellId: e.entityId as WorkCellId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`ClearFault: ${e._tag} for workCell ${envelope.payload.workCellId}`)
        )
      )

    const handleEnterMaintenance = (envelope: { payload: { workCellId: WorkCellId } }) =>
      actor.send(new InternalEnterMaintenanceWorkCell({ workCellId: envelope.payload.workCellId })).pipe(
        Effect.catchTags({
          MachineWorkCellNotFoundError: (e) =>
            Effect.fail(new RpcWorkCellNotFoundError({ workCellId: e.entityId as WorkCellId })),
          MachineWorkCellInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkCellTransitionError({ workCellId: e.entityId as WorkCellId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`EnterMaintenance: ${e._tag} for workCell ${envelope.payload.workCellId}`)
        )
      )

    const handleCompleteMaintenance = (envelope: { payload: { workCellId: WorkCellId } }) =>
      actor.send(new InternalCompleteMaintenanceWorkCell({ workCellId: envelope.payload.workCellId })).pipe(
        Effect.catchTags({
          MachineWorkCellNotFoundError: (e) =>
            Effect.fail(new RpcWorkCellNotFoundError({ workCellId: e.entityId as WorkCellId })),
          MachineWorkCellInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkCellTransitionError({ workCellId: e.entityId as WorkCellId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`CompleteMaintenance: ${e._tag} for workCell ${envelope.payload.workCellId}`)
        )
      )

    const handleDecommission = (envelope: { payload: { workCellId: WorkCellId } }) =>
      actor.send(new InternalDecommissionWorkCell({ workCellId: envelope.payload.workCellId })).pipe(
        Effect.catchTags({
          MachineWorkCellNotFoundError: (e) =>
            Effect.fail(new RpcWorkCellNotFoundError({ workCellId: e.entityId as WorkCellId })),
          MachineWorkCellInvalidTransitionError: (e) =>
            Effect.fail(new RpcWorkCellTransitionError({ workCellId: e.entityId as WorkCellId, message: e.message })),
        }),
        Effect.tapError((e) =>
          Effect.logWarning(`Decommission: ${e._tag} for workCell ${envelope.payload.workCellId}`)
        )
      )

    return WorkCellEntity.of({
      [WorkCellCreateTag]: handleCreate,
      [WorkCellGetTag]: handleGet,
      [WorkCellBeginSetupTag]: handleBeginSetup,
      [WorkCellCompleteSetupTag]: handleCompleteSetup,
      [WorkCellStopTag]: handleStop,
      [WorkCellMarkBlockedTag]: handleMarkBlocked,
      [WorkCellClearBlockedTag]: handleClearBlocked,
      [WorkCellMarkFaultedTag]: handleMarkFaulted,
      [WorkCellClearFaultTag]: handleClearFault,
      [WorkCellEnterMaintenanceTag]: handleEnterMaintenance,
      [WorkCellCompleteMaintenanceTag]: handleCompleteMaintenance,
      [WorkCellDecommissionTag]: handleDecommission,
    })
  })
)
