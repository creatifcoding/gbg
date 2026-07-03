/**
 * ZoneEntity — Machine-backed entity for Zone lifecycle
 * @module sios/entity/ZoneEntity
 */

import { Schema, Effect } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { Machine } from '@effect/experimental'
import { Zone, CreateZoneParams } from '../schemas/zone'
import { ZoneId, ProjectId } from '../schemas/identifiers'
import { ZoneState } from '../state'
import { SiosFeatureFlags } from '../infrastructure'
import {
  makeZoneMachine,
  InternalCreateZone, InternalGetZone,
  InternalActivateZone, InternalCommissionZone, InternalHandoverZone,
  InternalHoldZone, InternalResumeZone,
} from '../machines/ZoneMachine'

export class RpcZoneNotFoundError extends Schema.TaggedError<RpcZoneNotFoundError>()('RpcZoneNotFoundError', { zoneId: ZoneId }) {}
export class RpcZoneTransitionError extends Schema.TaggedError<RpcZoneTransitionError>()('RpcZoneTransitionError', { zoneId: ZoneId, message: Schema.String }) {}
export class RpcZoneCreateError extends Schema.TaggedError<RpcZoneCreateError>()('RpcZoneCreateError', { message: Schema.String }) {}

const E = 'Zone' as const

export class CreateZoneRpc extends Rpc.make(`${E}.Create`, { payload: CreateZoneParams, primaryKey: ({ projectId }) => projectId, success: Zone, error: RpcZoneCreateError }) {}
export class GetZoneRpc extends Rpc.make(`${E}.Get`, { payload: Schema.Struct({ id: ZoneId }), primaryKey: ({ id }) => id, success: Zone, error: RpcZoneNotFoundError }) {}
export class ActivateZoneRpc extends Rpc.make(`${E}.Activate`, { payload: Schema.Struct({ id: ZoneId }), primaryKey: ({ id }) => id, success: Zone, error: Schema.Union(RpcZoneNotFoundError, RpcZoneTransitionError) }) {}
export class CommissionZoneRpc extends Rpc.make(`${E}.Commission`, { payload: Schema.Struct({ id: ZoneId }), primaryKey: ({ id }) => id, success: Zone, error: Schema.Union(RpcZoneNotFoundError, RpcZoneTransitionError) }) {}
export class HandoverZoneRpc extends Rpc.make(`${E}.Handover`, { payload: Schema.Struct({ id: ZoneId }), primaryKey: ({ id }) => id, success: Zone, error: Schema.Union(RpcZoneNotFoundError, RpcZoneTransitionError) }) {}
export class HoldZoneRpc extends Rpc.make(`${E}.Hold`, { payload: Schema.Struct({ id: ZoneId, reason: Schema.NonEmptyString }), primaryKey: ({ id }) => id, success: Zone, error: Schema.Union(RpcZoneNotFoundError, RpcZoneTransitionError) }) {}
export class ResumeZoneRpc extends Rpc.make(`${E}.Resume`, { payload: Schema.Struct({ id: ZoneId, targetState: Schema.String }), primaryKey: ({ id }) => id, success: Zone, error: Schema.Union(RpcZoneNotFoundError, RpcZoneTransitionError) }) {}

export const ZoneEntity = Entity.make(E, [
  CreateZoneRpc, GetZoneRpc, ActivateZoneRpc, CommissionZoneRpc,
  HandoverZoneRpc, HoldZoneRpc, ResumeZoneRpc,
])

const mapErrors = Effect.catchTags({
  MachineZoneNotFoundError: (e: { zoneId: string }) => Effect.fail(new RpcZoneNotFoundError({ zoneId: e.zoneId as ZoneId })),
  MachineZoneTransitionError: (e: { zoneId: string; message: string }) => Effect.fail(new RpcZoneTransitionError({ zoneId: e.zoneId as ZoneId, message: e.message })),
})

export const ZoneEntityHandlers = ZoneEntity.toLayer(
  Effect.gen(function* () {
    const state = yield* ZoneState
    const flags = yield* SiosFeatureFlags
    const actor = yield* Machine.boot(makeZoneMachine({ state, flags }))
    return ZoneEntity.of({
      [`${E}.Create`]: (env: { payload: typeof CreateZoneParams.Type }) =>
        actor.send(new InternalCreateZone({ params: env.payload })).pipe(
          Effect.catchTag('MachineZoneCreateError', (e) => Effect.fail(new RpcZoneCreateError({ message: e.message })))
        ),
      [`${E}.Get`]: (env: { payload: { id: ZoneId } }) =>
        actor.send(new InternalGetZone({ zoneId: env.payload.id })).pipe(mapErrors),
      [`${E}.Activate`]: (env: { payload: { id: ZoneId } }) =>
        actor.send(new InternalActivateZone({ zoneId: env.payload.id })).pipe(mapErrors),
      [`${E}.Commission`]: (env: { payload: { id: ZoneId } }) =>
        actor.send(new InternalCommissionZone({ zoneId: env.payload.id })).pipe(mapErrors),
      [`${E}.Handover`]: (env: { payload: { id: ZoneId } }) =>
        actor.send(new InternalHandoverZone({ zoneId: env.payload.id })).pipe(mapErrors),
      [`${E}.Hold`]: (env: { payload: { id: ZoneId; reason: string } }) =>
        actor.send(new InternalHoldZone({ zoneId: env.payload.id, reason: env.payload.reason })).pipe(mapErrors),
      [`${E}.Resume`]: (env: { payload: { id: ZoneId; targetState: string } }) =>
        actor.send(new InternalResumeZone({ zoneId: env.payload.id, targetState: env.payload.targetState })).pipe(mapErrors),
    })
  })
)
