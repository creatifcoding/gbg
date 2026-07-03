/**
 * IssueMachine — Effect Machine for Issue lifecycle
 * @module sios/machines/IssueMachine
 */

import { Schema, Effect, pipe, Option, DateTime } from 'effect'
import { Machine } from '@effect/experimental'
import type { IssueStateShape } from '../state/IssueState'
import type { SiosFeatureFlagsShape } from '../infrastructure/feature-flags'
import { Issue, CreateIssueParams } from '../schemas/issue'
import type { IssueId, WorkerId } from '../schemas/identifiers'
import { canAssign, canStartWork, canResolve, canVerify, canClose, canCloseInvalid, canMarkWontFix, canReopen, type IssueStateNode } from './graphs/issue-graph'

export class MachineIssueNotFoundError extends Schema.TaggedError<MachineIssueNotFoundError>()('MachineIssueNotFoundError', { issueId: Schema.String }) {}
export class MachineIssueTransitionError extends Schema.TaggedError<MachineIssueTransitionError>()('MachineIssueTransitionError', { issueId: Schema.String, fromState: Schema.String, toState: Schema.String, message: Schema.String }) {}
export class MachineIssueCreateError extends Schema.TaggedError<MachineIssueCreateError>()('MachineIssueCreateError', { message: Schema.String }) {}

export class InternalCreateIssue extends Schema.TaggedRequest<InternalCreateIssue>()('InternalCreateIssue', { failure: MachineIssueCreateError, success: Issue, payload: { params: CreateIssueParams } }) {}
export class InternalGetIssue extends Schema.TaggedRequest<InternalGetIssue>()('InternalGetIssue', { failure: MachineIssueNotFoundError, success: Issue, payload: { issueId: Schema.String } }) {}
export class InternalAssignIssue extends Schema.TaggedRequest<InternalAssignIssue>()('InternalAssignIssue', { failure: Schema.Union(MachineIssueNotFoundError, MachineIssueTransitionError), success: Issue, payload: { issueId: Schema.String, assignedTo: Schema.String } }) {}
export class InternalStartIssueWork extends Schema.TaggedRequest<InternalStartIssueWork>()('InternalStartIssueWork', { failure: Schema.Union(MachineIssueNotFoundError, MachineIssueTransitionError), success: Issue, payload: { issueId: Schema.String } }) {}
export class InternalResolveIssue extends Schema.TaggedRequest<InternalResolveIssue>()('InternalResolveIssue', { failure: Schema.Union(MachineIssueNotFoundError, MachineIssueTransitionError), success: Issue, payload: { issueId: Schema.String, resolution: Schema.NonEmptyString } }) {}
export class InternalVerifyIssue extends Schema.TaggedRequest<InternalVerifyIssue>()('InternalVerifyIssue', { failure: Schema.Union(MachineIssueNotFoundError, MachineIssueTransitionError), success: Issue, payload: { issueId: Schema.String } }) {}
export class InternalCloseIssue extends Schema.TaggedRequest<InternalCloseIssue>()('InternalCloseIssue', { failure: Schema.Union(MachineIssueNotFoundError, MachineIssueTransitionError), success: Issue, payload: { issueId: Schema.String } }) {}
export class InternalCloseInvalidIssue extends Schema.TaggedRequest<InternalCloseInvalidIssue>()('InternalCloseInvalidIssue', { failure: Schema.Union(MachineIssueNotFoundError, MachineIssueTransitionError), success: Issue, payload: { issueId: Schema.String, reason: Schema.NonEmptyString } }) {}
export class InternalMarkWontFix extends Schema.TaggedRequest<InternalMarkWontFix>()('InternalMarkWontFix', { failure: Schema.Union(MachineIssueNotFoundError, MachineIssueTransitionError), success: Issue, payload: { issueId: Schema.String, reason: Schema.NonEmptyString } }) {}
export class InternalReopenIssue extends Schema.TaggedRequest<InternalReopenIssue>()('InternalReopenIssue', { failure: Schema.Union(MachineIssueNotFoundError, MachineIssueTransitionError), success: Issue, payload: { issueId: Schema.String } }) {}

export interface IssueMachineState { readonly mode: IssueStateNode }
export interface IssueMachineDeps { readonly state: IssueStateShape; readonly flags: SiosFeatureFlagsShape }

const getIssue = (state: IssueStateShape, id: string) =>
  state.get(id as IssueId).pipe(Effect.catchAll(() => Effect.fail(new MachineIssueNotFoundError({ issueId: id }))))

const transitionIssue = (state: IssueStateShape, id: string, target: IssueStateNode, can: (s: IssueStateNode) => boolean, label: string) =>
  Effect.gen(function* () {
    const i = yield* getIssue(state, id)
    if (!can(i.status as IssueStateNode)) return yield* Effect.fail(new MachineIssueTransitionError({ issueId: id, fromState: i.status, toState: target, message: `Cannot ${label} issue in state '${i.status}'.` }))
    const now = yield* DateTime.now
    const updated = new Issue({ ...i, status: target, updatedAt: Option.some(now) })
    yield* state.set(updated)
    return updated
  })

export const makeIssueMachine = (deps: IssueMachineDeps) =>
  Machine.make((_input: void, previous?: IssueMachineState) =>
    Effect.gen(function* () {
      const { state } = deps
      return pipe(
        Machine.procedures.make(previous ?? { mode: 'open' as IssueStateNode }),
        Machine.procedures.add<InternalCreateIssue>()('InternalCreateIssue', ({ request }) =>
          state.create(request.params).pipe(
            Effect.catchAll((e) => Effect.fail(new MachineIssueCreateError({ message: String(e) }))),
            Effect.map((i) => [i, { mode: 'open' as IssueStateNode }] as const)
          )
        ),
        Machine.procedures.add<InternalGetIssue>()('InternalGetIssue', ({ request }) =>
          getIssue(state, request.issueId).pipe(Effect.map((i) => [i, { mode: i.status as IssueStateNode }] as const))
        ),
        Machine.procedures.add<InternalAssignIssue>()('InternalAssignIssue', ({ request }) =>
          Effect.gen(function* () {
            const i = yield* getIssue(state, request.issueId)
            if (!canAssign(i.status as IssueStateNode)) return yield* Effect.fail(new MachineIssueTransitionError({ issueId: request.issueId, fromState: i.status, toState: 'assigned', message: 'Issue must be open to assign.' }))
            const now = yield* DateTime.now
            const updated = new Issue({ ...i, status: 'assigned', assignedTo: Option.some(request.assignedTo as WorkerId), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'assigned' as IssueStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalStartIssueWork>()('InternalStartIssueWork', ({ request }) =>
          transitionIssue(state, request.issueId, 'in_progress', canStartWork, 'start work').pipe(
            Effect.map((i) => [i, { mode: 'in_progress' as IssueStateNode }] as const))
        ),
        Machine.procedures.add<InternalResolveIssue>()('InternalResolveIssue', ({ request }) =>
          Effect.gen(function* () {
            const i = yield* getIssue(state, request.issueId)
            if (!canResolve(i.status as IssueStateNode)) return yield* Effect.fail(new MachineIssueTransitionError({ issueId: request.issueId, fromState: i.status, toState: 'resolved', message: 'Issue must be in_progress to resolve.' }))
            const now = yield* DateTime.now
            const updated = new Issue({ ...i, status: 'resolved', resolution: Option.some(request.resolution), resolvedAt: Option.some(now), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'resolved' as IssueStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalVerifyIssue>()('InternalVerifyIssue', ({ request }) =>
          Effect.gen(function* () {
            const i = yield* getIssue(state, request.issueId)
            if (!canVerify(i.status as IssueStateNode)) return yield* Effect.fail(new MachineIssueTransitionError({ issueId: request.issueId, fromState: i.status, toState: 'verified', message: 'Issue must be resolved to verify.' }))
            const now = yield* DateTime.now
            const updated = new Issue({ ...i, status: 'verified', verifiedAt: Option.some(now), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'verified' as IssueStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalCloseIssue>()('InternalCloseIssue', ({ request }) =>
          transitionIssue(state, request.issueId, 'closed', canClose, 'close').pipe(
            Effect.map((i) => [i, { mode: 'closed' as IssueStateNode }] as const))
        ),
        Machine.procedures.add<InternalCloseInvalidIssue>()('InternalCloseInvalidIssue', ({ request }) =>
          Effect.gen(function* () {
            const i = yield* getIssue(state, request.issueId)
            if (!canCloseInvalid(i.status as IssueStateNode)) return yield* Effect.fail(new MachineIssueTransitionError({ issueId: request.issueId, fromState: i.status, toState: 'closed', message: 'Only open issues can be closed as invalid.' }))
            const now = yield* DateTime.now
            const updated = new Issue({ ...i, status: 'closed', resolution: Option.some(`Invalid/duplicate: ${request.reason}`), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'closed' as IssueStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalMarkWontFix>()('InternalMarkWontFix', ({ request }) =>
          Effect.gen(function* () {
            const i = yield* getIssue(state, request.issueId)
            if (!canMarkWontFix(i.status as IssueStateNode)) return yield* Effect.fail(new MachineIssueTransitionError({ issueId: request.issueId, fromState: i.status, toState: 'wont_fix', message: 'Only in_progress issues can be marked wont_fix.' }))
            const now = yield* DateTime.now
            const updated = new Issue({ ...i, status: 'wont_fix', resolution: Option.some(`Won't fix: ${request.reason}`), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'wont_fix' as IssueStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalReopenIssue>()('InternalReopenIssue', ({ request }) =>
          transitionIssue(state, request.issueId, 'in_progress', canReopen, 'reopen').pipe(
            Effect.map((i) => [i, { mode: 'in_progress' as IssueStateNode }] as const))
        ),
      )
    })
  )

export type IssueMachine = ReturnType<typeof makeIssueMachine>
