/**
 * SignalEntity — Effect Cluster Entity for Signal
 *
 * Evidence of opportunity. Linked to Company, optionally to DecisionMaker.
 * RPCs: Create, Get, Expire, AttachToDM.
 *
 * @module prospects/entity/SignalEntity
 */

import { Schema } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { SignalType } from '../schemas/domain'

// =============================================================================
// Response Schemas
// =============================================================================

export const SignalView = Schema.Struct({
  id: Schema.String,
  companyId: Schema.String,
  decisionMakerId: Schema.NullishOr(Schema.String),
  signalType: SignalType,
  title: Schema.String,
  description: Schema.NullishOr(Schema.String),
  sourceUrl: Schema.NullishOr(Schema.String),
  weight: Schema.Number,
  detectedAt: Schema.String,
})

// =============================================================================
// RPC Error Schemas
// =============================================================================

export class SignalNotFoundError extends Schema.TaggedError<SignalNotFoundError>()(
  'SignalNotFoundError',
  { signalId: Schema.String }
) {}

// =============================================================================
// RPC Definitions
// =============================================================================

const EntityType = 'Signal' as const

export class CreateSignalRpc extends Rpc.make(`${EntityType}.Create`, {
  payload: Schema.Struct({
    id: Schema.String,
    companyId: Schema.String,
    signalType: SignalType,
    title: Schema.NonEmptyString,
    description: Schema.optional(Schema.String),
    sourceUrl: Schema.optional(Schema.String),
    weight: Schema.optional(Schema.Number),
    raw: Schema.optional(Schema.String),
  }),
  primaryKey: ({ id }) => id,
  success: SignalView,
}) {}

export class GetSignalRpc extends Rpc.make(`${EntityType}.Get`, {
  payload: Schema.Struct({ id: Schema.String }),
  primaryKey: ({ id }) => id,
  success: SignalView,
  error: SignalNotFoundError,
}) {}

export class AttachToDMRpc extends Rpc.make(`${EntityType}.AttachToDM`, {
  payload: Schema.Struct({
    id: Schema.String,
    decisionMakerId: Schema.String,
  }),
  primaryKey: ({ id }) => id,
  success: SignalView,
  error: SignalNotFoundError,
}) {}

export class ExpireSignalRpc extends Rpc.make(`${EntityType}.Expire`, {
  payload: Schema.Struct({ id: Schema.String }),
  primaryKey: ({ id }) => id,
  success: SignalView,
  error: SignalNotFoundError,
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

export const SignalEntity = Entity.make(EntityType, [
  CreateSignalRpc,
  GetSignalRpc,
  AttachToDMRpc,
  ExpireSignalRpc,
])
