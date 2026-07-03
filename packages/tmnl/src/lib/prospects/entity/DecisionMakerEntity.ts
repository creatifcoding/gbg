/**
 * DecisionMakerEntity — Effect Cluster Entity for Decision Maker
 *
 * A peer in the prospect graph. CIP-scored. Linked to Company via companyId.
 * RPCs: CRUD, CIP recalculation, contact management, tenure updates.
 *
 * @module prospects/entity/DecisionMakerEntity
 */

import { Schema } from 'effect'
import { Entity } from '@effect/cluster'
import { Rpc } from '@effect/rpc'
import { TitleLevel, PipelineStage } from '../schemas/domain'
import { ContactInfo, RoleTenure, ContractEstimate } from '../schemas/value-objects'

// =============================================================================
// Response Schemas
// =============================================================================

export const DecisionMakerView = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  title: Schema.NullishOr(Schema.String),
  titleLevel: TitleLevel,
  companyId: Schema.String,
  cipCapital: Schema.Number,
  cipInterest: Schema.Number,
  cipPower: Schema.Number,
  cipComposite: Schema.Number,
  pipelineStage: PipelineStage,
})

// =============================================================================
// RPC Error Schemas
// =============================================================================

export class DMNotFoundError extends Schema.TaggedError<DMNotFoundError>()(
  'DMNotFoundError',
  { decisionMakerId: Schema.String }
) {}

// =============================================================================
// RPC Definitions
// =============================================================================

const EntityType = 'DecisionMaker' as const

export class CreateDMRpc extends Rpc.make(`${EntityType}.Create`, {
  payload: Schema.Struct({
    id: Schema.String,
    name: Schema.NonEmptyString,
    title: Schema.optional(Schema.String),
    titleLevel: Schema.optional(TitleLevel),
    companyId: Schema.String,
    contacts: Schema.optional(ContactInfo),
    tenure: Schema.optional(RoleTenure),
  }),
  primaryKey: ({ id }) => id,
  success: DecisionMakerView,
}) {}

export class GetDMRpc extends Rpc.make(`${EntityType}.Get`, {
  payload: Schema.Struct({ id: Schema.String }),
  primaryKey: ({ id }) => id,
  success: DecisionMakerView,
  error: DMNotFoundError,
}) {}

export class RecalculateCIPRpc extends Rpc.make(`${EntityType}.RecalculateCIP`, {
  payload: Schema.Struct({ id: Schema.String }),
  primaryKey: ({ id }) => id,
  success: Schema.Struct({
    capital: Schema.Number,
    interest: Schema.Number,
    power: Schema.Number,
    composite: Schema.Number,
  }),
  error: DMNotFoundError,
}) {}

export class UpdateContactsRpc extends Rpc.make(`${EntityType}.UpdateContacts`, {
  payload: Schema.Struct({
    id: Schema.String,
    contacts: ContactInfo,
  }),
  primaryKey: ({ id }) => id,
  success: DecisionMakerView,
  error: DMNotFoundError,
}) {}

export class SetContractEstimateRpc extends Rpc.make(`${EntityType}.SetContractEstimate`, {
  payload: Schema.Struct({
    id: Schema.String,
    estimate: ContractEstimate,
  }),
  primaryKey: ({ id }) => id,
  success: DecisionMakerView,
  error: DMNotFoundError,
}) {}

export class UpdateStageRpc extends Rpc.make(`${EntityType}.UpdateStage`, {
  payload: Schema.Struct({
    id: Schema.String,
    stage: PipelineStage,
  }),
  primaryKey: ({ id }) => id,
  success: DecisionMakerView,
  error: DMNotFoundError,
}) {}

// =============================================================================
// Entity Definition
// =============================================================================

export const DecisionMakerEntity = Entity.make(EntityType, [
  CreateDMRpc,
  GetDMRpc,
  RecalculateCIPRpc,
  UpdateContactsRpc,
  SetContractEstimateRpc,
  UpdateStageRpc,
])
