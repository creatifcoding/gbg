/**
 * IssueEntity — Machine-backed entity for Issue lifecycle
 * @module sios/entity/IssueEntity
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Issue, CreateIssueParams } from '../schemas/issue'
import { IssueId, WorkerId } from '../schemas/identifiers'
import { IssueState } from '../state'
import { SiosFeatureFlags } from '../infrastructure'
import {
  makeIssueMachine,
  InternalCreateIssue, InternalGetIssue,
  InternalAssignIssue, InternalStartIssueWork, InternalResolveIssue,
  InternalVerifyIssue, InternalCloseIssue, InternalCloseInvalidIssue,
  InternalMarkWontFix, InternalReopenIssue,
} from '../machines/IssueMachine'

export class RpcIssueNotFoundError extends Schema.TaggedError<RpcIssueNotFoundError>()('RpcIssueNotFoundError', { issueId: IssueId }) {}
export class RpcIssueTransitionError extends Schema.TaggedError<RpcIssueTransitionError>()('RpcIssueTransitionError', { issueId: IssueId, message: Schema.String }) {}
export class RpcIssueCreateError extends Schema.TaggedError<RpcIssueCreateError>()('RpcIssueCreateError', { message: Schema.String }) {}

const E = 'Issue' as const

export class CreateIssueRpc extends Rpc.make(`${E}.Create`, { payload: CreateIssueParams, primaryKey: ({ projectId }) => projectId, success: Issue, error: RpcIssueCreateError }) {}
export class GetIssueRpc extends Rpc.make(`${E}.Get`, { payload: Schema.Struct({ id: IssueId }), primaryKey: ({ id }) => id, success: Issue, error: RpcIssueNotFoundError }) {}
export class AssignIssueRpc extends Rpc.make(`${E}.Assign`, { payload: Schema.Struct({ id: IssueId, assignedTo: WorkerId }), primaryKey: ({ id }) => id, success: Issue, error: Schema.Union(RpcIssueNotFoundError, RpcIssueTransitionError) }) {}
export class StartIssueWorkRpc extends Rpc.make(`${E}.StartWork`, { payload: Schema.Struct({ id: IssueId }), primaryKey: ({ id }) => id, success: Issue, error: Schema.Union(RpcIssueNotFoundError, RpcIssueTransitionError) }) {}
export class ResolveIssueRpc extends Rpc.make(`${E}.Resolve`, { payload: Schema.Struct({ id: IssueId, resolution: Schema.NonEmptyString }), primaryKey: ({ id }) => id, success: Issue, error: Schema.Union(RpcIssueNotFoundError, RpcIssueTransitionError) }) {}
export class VerifyIssueRpc extends Rpc.make(`${E}.Verify`, { payload: Schema.Struct({ id: IssueId }), primaryKey: ({ id }) => id, success: Issue, error: Schema.Union(RpcIssueNotFoundError, RpcIssueTransitionError) }) {}
export class CloseIssueRpc extends Rpc.make(`${E}.Close`, { payload: Schema.Struct({ id: IssueId }), primaryKey: ({ id }) => id, success: Issue, error: Schema.Union(RpcIssueNotFoundError, RpcIssueTransitionError) }) {}
export class CloseInvalidIssueRpc extends Rpc.make(`${E}.CloseInvalid`, { payload: Schema.Struct({ id: IssueId, reason: Schema.NonEmptyString }), primaryKey: ({ id }) => id, success: Issue, error: Schema.Union(RpcIssueNotFoundError, RpcIssueTransitionError) }) {}
export class MarkWontFixRpc extends Rpc.make(`${E}.MarkWontFix`, { payload: Schema.Struct({ id: IssueId, reason: Schema.NonEmptyString }), primaryKey: ({ id }) => id, success: Issue, error: Schema.Union(RpcIssueNotFoundError, RpcIssueTransitionError) }) {}
export class ReopenIssueRpc extends Rpc.make(`${E}.Reopen`, { payload: Schema.Struct({ id: IssueId }), primaryKey: ({ id }) => id, success: Issue, error: Schema.Union(RpcIssueNotFoundError, RpcIssueTransitionError) }) {}

export const IssueEntity = Entity.make(E, [
  CreateIssueRpc, GetIssueRpc, AssignIssueRpc, StartIssueWorkRpc,
  ResolveIssueRpc, VerifyIssueRpc, CloseIssueRpc,
  CloseInvalidIssueRpc, MarkWontFixRpc, ReopenIssueRpc,
])

const mapErrors = Effect.catchTags({
  MachineIssueNotFoundError: (e: { issueId: string }) => Effect.fail(new RpcIssueNotFoundError({ issueId: e.issueId as IssueId })),
  MachineIssueTransitionError: (e: { issueId: string; message: string }) => Effect.fail(new RpcIssueTransitionError({ issueId: e.issueId as IssueId, message: e.message })),
})

export const IssueEntityHandlers = IssueEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* IssueState
    const flags = yield* SiosFeatureFlags
    const actor = yield* Machine.boot(makeIssueMachine({ state, flags }))
    return IssueEntity.of({
      [`${E}.Create`]: (env: { payload: typeof CreateIssueParams.Type }) =>
        actor.send(new InternalCreateIssue({ params: env.payload })).pipe(
          Effect.catchTag('MachineIssueCreateError', (e) => Effect.fail(new RpcIssueCreateError({ message: e.message })))
        ),
      [`${E}.Get`]: (env: { payload: { id: IssueId } }) =>
        actor.send(new InternalGetIssue({ issueId: env.payload.id })).pipe(mapErrors),
      [`${E}.Assign`]: (env: { payload: { id: IssueId; assignedTo: WorkerId } }) =>
        actor.send(new InternalAssignIssue({ issueId: env.payload.id, assignedTo: env.payload.assignedTo })).pipe(mapErrors),
      [`${E}.StartWork`]: (env: { payload: { id: IssueId } }) =>
        actor.send(new InternalStartIssueWork({ issueId: env.payload.id })).pipe(mapErrors),
      [`${E}.Resolve`]: (env: { payload: { id: IssueId; resolution: string } }) =>
        actor.send(new InternalResolveIssue({ issueId: env.payload.id, resolution: env.payload.resolution })).pipe(mapErrors),
      [`${E}.Verify`]: (env: { payload: { id: IssueId } }) =>
        actor.send(new InternalVerifyIssue({ issueId: env.payload.id })).pipe(mapErrors),
      [`${E}.Close`]: (env: { payload: { id: IssueId } }) =>
        actor.send(new InternalCloseIssue({ issueId: env.payload.id })).pipe(mapErrors),
      [`${E}.CloseInvalid`]: (env: { payload: { id: IssueId; reason: string } }) =>
        actor.send(new InternalCloseInvalidIssue({ issueId: env.payload.id, reason: env.payload.reason })).pipe(mapErrors),
      [`${E}.MarkWontFix`]: (env: { payload: { id: IssueId; reason: string } }) =>
        actor.send(new InternalMarkWontFix({ issueId: env.payload.id, reason: env.payload.reason })).pipe(mapErrors),
      [`${E}.Reopen`]: (env: { payload: { id: IssueId } }) =>
        actor.send(new InternalReopenIssue({ issueId: env.payload.id })).pipe(mapErrors),
    })
  })
)
