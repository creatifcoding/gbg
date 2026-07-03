/**
 * ZoneMachine — Effect Machine for Zone Lifecycle
 * @module sios/machines/ZoneMachine
 */

import { Schema, Effect, pipe, Option, DateTime } from 'effect'
import { Machine } from '@effect/experimental'
import type { ZoneStateShape } from '../state/ZoneState'
import type { SiosFeatureFlagsShape } from '../infrastructure/feature-flags'
import { Zone, CreateZoneParams } from '../schemas/zone'
import type { ZoneId } from '../schemas/identifiers'
import { canActivate, canCommission, canHandover, canHold, canResume, type ZoneStateNode } from './graphs/zone-graph'

export class MachineZoneNotFoundError extends Schema.TaggedError<MachineZoneNotFoundError>()('MachineZoneNotFoundError', { zoneId: Schema.String }) {}
export class MachineZoneTransitionError extends Schema.TaggedError<MachineZoneTransitionError>()('MachineZoneTransitionError', { zoneId: Schema.String, fromState: Schema.String, toState: Schema.String, message: Schema.String }) {}
export class MachineZoneCreateError extends Schema.TaggedError<MachineZoneCreateError>()('MachineZoneCreateError', { message: Schema.String }) {}

export class InternalCreateZone extends Schema.TaggedRequest<InternalCreateZone>()('InternalCreateZone', { failure: MachineZoneCreateError, success: Zone, payload: { params: CreateZoneParams } }) {}
export class InternalGetZone extends Schema.TaggedRequest<InternalGetZone>()('InternalGetZone', { failure: MachineZoneNotFoundError, success: Zone, payload: { zoneId: Schema.String } }) {}
export class InternalActivateZone extends Schema.TaggedRequest<InternalActivateZone>()('InternalActivateZone', { failure: Schema.Union(MachineZoneNotFoundError, MachineZoneTransitionError), success: Zone, payload: { zoneId: Schema.String } }) {}
export class InternalCommissionZone extends Schema.TaggedRequest<InternalCommissionZone>()('InternalCommissionZone', { failure: Schema.Union(MachineZoneNotFoundError, MachineZoneTransitionError), success: Zone, payload: { zoneId: Schema.String } }) {}
export class InternalHandoverZone extends Schema.TaggedRequest<InternalHandoverZone>()('InternalHandoverZone', { failure: Schema.Union(MachineZoneNotFoundError, MachineZoneTransitionError), success: Zone, payload: { zoneId: Schema.String } }) {}
export class InternalHoldZone extends Schema.TaggedRequest<InternalHoldZone>()('InternalHoldZone', { failure: Schema.Union(MachineZoneNotFoundError, MachineZoneTransitionError), success: Zone, payload: { zoneId: Schema.String, reason: Schema.NonEmptyString } }) {}
export class InternalResumeZone extends Schema.TaggedRequest<InternalResumeZone>()('InternalResumeZone', { failure: Schema.Union(MachineZoneNotFoundError, MachineZoneTransitionError), success: Zone, payload: { zoneId: Schema.String, targetState: Schema.String } }) {}

export interface ZoneMachineState { readonly mode: ZoneStateNode }
export interface ZoneMachineDeps { readonly state: ZoneStateShape; readonly flags: SiosFeatureFlagsShape }

const getZone = (state: ZoneStateShape, id: string) =>
  state.get(id as ZoneId).pipe(Effect.catchAll(() => Effect.fail(new MachineZoneNotFoundError({ zoneId: id }))))

const transitionZone = (state: ZoneStateShape, id: string, target: ZoneStateNode, can: (s: ZoneStateNode) => boolean, label: string) =>
  Effect.gen(function* () {
    const z = yield* getZone(state, id)
    if (!can(z.status as ZoneStateNode)) return yield* Effect.fail(new MachineZoneTransitionError({ zoneId: id, fromState: z.status, toState: target, message: `Cannot ${label} zone in state '${z.status}'.` }))
    const now = yield* DateTime.now
    const updated = new Zone({ ...z, status: target, updatedAt: Option.some(now) })
    yield* state.set(updated)
    return updated
  })

export const makeZoneMachine = (deps: ZoneMachineDeps) =>
  Machine.make((_input: void, previous?: ZoneMachineState) =>
    Effect.gen(function* () {
      const { state } = deps
      return pipe(
        Machine.procedures.make(previous ?? { mode: 'defined' as ZoneStateNode }),
        Machine.procedures.add<InternalCreateZone>()('InternalCreateZone', ({ request }) =>
          state.create(request.params).pipe(
            Effect.catchAll((e) => Effect.fail(new MachineZoneCreateError({ message: String(e) }))),
            Effect.map((z) => [z, { mode: 'defined' as ZoneStateNode }] as const)
          )
        ),
        Machine.procedures.add<InternalGetZone>()('InternalGetZone', ({ request }) =>
          getZone(state, request.zoneId).pipe(Effect.map((z) => [z, { mode: z.status as ZoneStateNode }] as const))
        ),
        Machine.procedures.add<InternalActivateZone>()('InternalActivateZone', ({ request }) =>
          transitionZone(state, request.zoneId, 'active', canActivate, 'activate').pipe(
            Effect.map((z) => [z, { mode: 'active' as ZoneStateNode }] as const))
        ),
        Machine.procedures.add<InternalCommissionZone>()('InternalCommissionZone', ({ request }) =>
          transitionZone(state, request.zoneId, 'commissioning', canCommission, 'commission').pipe(
            Effect.map((z) => [z, { mode: 'commissioning' as ZoneStateNode }] as const))
        ),
        Machine.procedures.add<InternalHandoverZone>()('InternalHandoverZone', ({ request }) =>
          transitionZone(state, request.zoneId, 'handed_over', canHandover, 'handover').pipe(
            Effect.map((z) => [z, { mode: 'handed_over' as ZoneStateNode }] as const))
        ),
        Machine.procedures.add<InternalHoldZone>()('InternalHoldZone', ({ request }) =>
          Effect.gen(function* () {
            const z = yield* getZone(state, request.zoneId)
            if (!canHold(z.status as ZoneStateNode)) return yield* Effect.fail(new MachineZoneTransitionError({ zoneId: request.zoneId, fromState: z.status, toState: 'on_hold', message: `Cannot hold zone in state '${z.status}'.` }))
            const now = yield* DateTime.now
            const updated = new Zone({ ...z, status: 'on_hold', holdReason: Option.some(request.reason), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: 'on_hold' as ZoneStateNode }] as const
          })
        ),
        Machine.procedures.add<InternalResumeZone>()('InternalResumeZone', ({ request }) =>
          Effect.gen(function* () {
            const z = yield* getZone(state, request.zoneId)
            if (!canResume(z.status as ZoneStateNode)) return yield* Effect.fail(new MachineZoneTransitionError({ zoneId: request.zoneId, fromState: z.status, toState: request.targetState, message: `Cannot resume zone in state '${z.status}'.` }))
            const now = yield* DateTime.now
            const target = request.targetState as ZoneStateNode
            const updated = new Zone({ ...z, status: target, holdReason: Option.none(), updatedAt: Option.some(now) })
            yield* state.set(updated)
            return [updated, { mode: target }] as const
          })
        ),
      )
    })
  )

export type ZoneMachine = ReturnType<typeof makeZoneMachine>
