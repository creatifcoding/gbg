/**
 * OutreachEntity — Effect Cluster Entity for Outreach
 *
 * Contact attempts. Linked to DecisionMaker and Company.
 * RPCs: Create, Get, MarkSent, MarkReplied, MarkBounced.
 *
 * @module prospects/entity/OutreachEntity
 */

import { Schema } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { OutreachChannel, OutreachStatus } from '../schemas/domain'

// =============================================================================
// Response Schemas
// =============================================================================

export const OutreachView = Schema.Struct({
  id: Schema.String,
  decisionMakerId: Schema.String,
  companyId: Schema.String,
  channel: OutreachChannel,
  status: OutreachStatus,
  subject: Schema.NullishOr(Schema.String),
  sentAt: Schema.NullishOr(Schema.String),
  respondedAt: Schema.NullishOr(Schema.String),
})

// =============================================================================
// RPC Error Schemas
// =============================================================================

export class OutreachNotFoundError extends Schema.TaggedError<OutreachNotFoundError>()(
  'OutreachNotFoundError',
  { outreachId: Schema.String }
) {}

// =============================================================================
// RPC Definitions
// =============================================================================

const EntityType = 'Outreach' as const

export class CreateOutreachRpc extends Rpc.make(`${EntityType}.Create`, {
  payload: Schema.Struct({
    id: Schema.String,
    decisionMakerId: Schema.String,
    companyId: Schema.String,
    channel: OutreachChannel,
    subject: Schema.optional(Schema.String),
    body: Schema.optional(Schema.String),
  }),
  primaryKey: ({ id }) => id,
  success: OutreachView,
}) {}

export class GetOutreachRpc extends Rpc.make(`${EntityType}.Get`, {
  payload: Schema.Struct({ id: Schema.String }),
  primaryKey: ({ id }) => id,
  success: OutreachView,
  error: OutreachNotFoundError,
}) {}

export class MarkSentRpc extends Rpc.make(`${EntityType}.MarkSent`, {
  payload: Schema.Struct({ id: Schema.String }),
  primaryKey: ({ id }) => id,
  success: OutreachView,
  error: OutreachNotFoundError,
}) {}

export class MarkRepliedRpc extends Rpc.make(`${EntityType}.MarkReplied`, {
  payload: Schema.Struct({
    id: Schema.String,
    notes: Schema.optional(Schema.String),
  }),
  primaryKey: ({ id }) => id,
  success: OutreachView,
  error: OutreachNotFoundError,
}) {}

export class MarkBouncedRpc extends Rpc.make(`${EntityType}.MarkBounced`, {
  payload: Schema.Struct({ id: Schema.String }),
  primaryKey: ({ id }) => id,
  success: OutreachView,
  error: OutreachNotFoundError,
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

export const OutreachEntity = Entity.make(EntityType, [
  CreateOutreachRpc,
  GetOutreachRpc,
  MarkSentRpc,
  MarkRepliedRpc,
  MarkBouncedRpc,
])
