/**
 * WorkPackageEntity — Effect Cluster Entity for WorkPackage Lifecycle
 *
 * .toLayer() handler boots the WorkPackageMachine and delegates all RPCs
 * to actor.send(). Machine validates graph transitions, mutates state,
 * emits events.
 *
 * @module sios/entity/WorkPackageEntity
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import {
  WorkPackage,
  CreateWorkPackageParams,
  WorkPackageStatus,
  Discipline,
  ProgressUnit,
  EquipmentFamily,
} from '../schemas/work-package'
import { WorkPackageId, ZoneId, ProjectId, CrewId } from '../schemas/identifiers'
import { EVMSnapshot } from '../schemas/value-objects'
import { WorkPackageState } from '../state'
import { SiosFeatureFlags } from '../infrastructure'
import {
  makeWorkPackageMachine,
  InternalCreateWP,
  InternalGetWP,
  InternalActivateWP,
  InternalSuspendWP,
  InternalResumeWP,
  InternalCompleteWP,
  InternalCloseWP,
  InternalAssignCrew,
  InternalRecordProgress,
} from '../machines/WorkPackageMachine'

// =============================================================================
// RPC Errors (external — what consumers see)
// =============================================================================

export class RpcWPNotFoundError extends Schema.TaggedError<RpcWPNotFoundError>()(
  'RpcWPNotFoundError',
  { workPackageId: WorkPackageId }
) {}

export class RpcWPTransitionError extends Schema.TaggedError<RpcWPTransitionError>()(
  'RpcWPTransitionError',
  { workPackageId: WorkPackageId, message: Schema.String }
) {}

export class RpcWPCreateError extends Schema.TaggedError<RpcWPCreateError>()(
  'RpcWPCreateError',
  { message: Schema.String }
) {}

// =============================================================================
// RPC Tags
// =============================================================================

const E = 'WorkPackage' as const

// =============================================================================
// RPCs — referencing actual schema types
// =============================================================================

export class CreateWPRpc extends Rpc.make(`${E}.Create`, {
  payload: CreateWorkPackageParams,
  primaryKey: ({ zoneId }) => zoneId,
  success: WorkPackage,
  error: RpcWPCreateError,
}) {}

export class GetWPRpc extends Rpc.make(`${E}.Get`, {
  payload: Schema.Struct({ id: WorkPackageId }),
  primaryKey: ({ id }) => id,
  success: WorkPackage,
  error: RpcWPNotFoundError,
}) {}

export class ActivateWPRpc extends Rpc.make(`${E}.Activate`, {
  payload: Schema.Struct({ id: WorkPackageId }),
  primaryKey: ({ id }) => id,
  success: WorkPackage,
  error: Schema.Union(RpcWPNotFoundError, RpcWPTransitionError),
}) {}

export class SuspendWPRpc extends Rpc.make(`${E}.Suspend`, {
  payload: Schema.Struct({ id: WorkPackageId }),
  primaryKey: ({ id }) => id,
  success: WorkPackage,
  error: Schema.Union(RpcWPNotFoundError, RpcWPTransitionError),
}) {}

export class ResumeWPRpc extends Rpc.make(`${E}.Resume`, {
  payload: Schema.Struct({ id: WorkPackageId }),
  primaryKey: ({ id }) => id,
  success: WorkPackage,
  error: Schema.Union(RpcWPNotFoundError, RpcWPTransitionError),
}) {}

export class CompleteWPRpc extends Rpc.make(`${E}.Complete`, {
  payload: Schema.Struct({ id: WorkPackageId }),
  primaryKey: ({ id }) => id,
  success: WorkPackage,
  error: Schema.Union(RpcWPNotFoundError, RpcWPTransitionError),
}) {}

export class CloseWPRpc extends Rpc.make(`${E}.Close`, {
  payload: Schema.Struct({ id: WorkPackageId }),
  primaryKey: ({ id }) => id,
  success: WorkPackage,
  error: Schema.Union(RpcWPNotFoundError, RpcWPTransitionError),
}) {}

export class AssignCrewRpc extends Rpc.make(`${E}.AssignCrew`, {
  payload: Schema.Struct({ id: WorkPackageId, crewId: CrewId }),
  primaryKey: ({ id }) => id,
  success: WorkPackage,
  error: RpcWPNotFoundError,
}) {}

export class RecordProgressRpc extends Rpc.make(`${E}.RecordProgress`, {
  payload: Schema.Struct({
    id: WorkPackageId,
    qtyCompleted: Schema.Number.pipe(Schema.greaterThan(0)),
    hoursExpended: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
    costExpended: Schema.Number.pipe(Schema.greaterThanOrEqualTo(0)),
  }),
  primaryKey: ({ id }) => id,
  success: WorkPackage,
  error: RpcWPNotFoundError,
}) {}

// =============================================================================
// Entity
// =============================================================================

export const WorkPackageEntity = Entity.make(E, [
  CreateWPRpc,
  GetWPRpc,
  ActivateWPRpc,
  SuspendWPRpc,
  ResumeWPRpc,
  CompleteWPRpc,
  CloseWPRpc,
  AssignCrewRpc,
  RecordProgressRpc,
])

export type WorkPackageEntityType = typeof WorkPackageEntity

// =============================================================================
// Handler — boots machine, delegates to actor.send()
// =============================================================================

export const WorkPackageEntityHandlers = WorkPackageEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* WorkPackageState
    const flags = yield* SiosFeatureFlags

    const machine = makeWorkPackageMachine({ state, flags })
    const actor = yield* Machine.boot(machine)

    const handleCreate = (envelope: { payload: CreateWorkPackageParams }) =>
      actor.send(new InternalCreateWP({ params: envelope.payload })).pipe(
        Effect.catchTag('MachineWPCreateError', (e) =>
          Effect.fail(new RpcWPCreateError({ message: e.message }))
        )
      )

    const handleGet = (envelope: { payload: { id: WorkPackageId } }) =>
      actor.send(new InternalGetWP({ workPackageId: envelope.payload.id })).pipe(
        Effect.catchTag('MachineWPNotFoundError', (e) =>
          Effect.fail(new RpcWPNotFoundError({ workPackageId: e.workPackageId as WorkPackageId }))
        )
      )

    const transitionHandler = (
      InternalClass: typeof InternalActivateWP | typeof InternalSuspendWP | typeof InternalResumeWP | typeof InternalCompleteWP | typeof InternalCloseWP,
    ) => (envelope: { payload: { id: WorkPackageId } }) =>
      actor.send(new InternalClass({ workPackageId: envelope.payload.id })).pipe(
        Effect.catchTags({
          MachineWPNotFoundError: (e) =>
            Effect.fail(new RpcWPNotFoundError({ workPackageId: e.workPackageId as WorkPackageId })),
          MachineWPTransitionError: (e) =>
            Effect.fail(new RpcWPTransitionError({ workPackageId: e.workPackageId as WorkPackageId, message: e.message })),
        })
      )

    return WorkPackageEntity.of({
      [`${E}.Create`]: handleCreate,
      [`${E}.Get`]: handleGet,
      [`${E}.Activate`]: transitionHandler(InternalActivateWP),
      [`${E}.Suspend`]: transitionHandler(InternalSuspendWP),
      [`${E}.Resume`]: transitionHandler(InternalResumeWP),
      [`${E}.Complete`]: transitionHandler(InternalCompleteWP),
      [`${E}.Close`]: transitionHandler(InternalCloseWP),
      [`${E}.AssignCrew`]: (envelope: { payload: { id: WorkPackageId; crewId: CrewId } }) =>
        actor.send(new InternalAssignCrew({
          workPackageId: envelope.payload.id,
          crewId: envelope.payload.crewId,
        })).pipe(
          Effect.catchTag('MachineWPNotFoundError', (e) =>
            Effect.fail(new RpcWPNotFoundError({ workPackageId: e.workPackageId as WorkPackageId }))
          )
        ),
      [`${E}.RecordProgress`]: (envelope: { payload: { id: WorkPackageId; qtyCompleted: number; hoursExpended: number; costExpended: number } }) =>
        actor.send(new InternalRecordProgress({
          workPackageId: envelope.payload.id,
          qtyCompleted: envelope.payload.qtyCompleted,
          hoursExpended: envelope.payload.hoursExpended,
          costExpended: envelope.payload.costExpended,
        })).pipe(
          Effect.catchTag('MachineWPNotFoundError', (e) =>
            Effect.fail(new RpcWPNotFoundError({ workPackageId: e.workPackageId as WorkPackageId }))
          )
        ),
    })
  })
)
