/** @deprecated Use `@/lib/transfer/v2/traits` — these v1 traits render null. */
import { Schema } from 'effect'
import { createTrait } from '@/lib/traits'
import {
  TransferInsertModeSchema,
  TransferReferenceKindSchema,
  type TransferDropDecision,
  type TransferDropIntent,
  type TransferReferenceToken,
} from './types'

export const TransferSourceCapabilitySchema = Schema.Struct({
  sourceId: Schema.String,
  sourceLabel: Schema.String,
  supportedKinds: Schema.Array(TransferReferenceKindSchema),
})
export type TransferSourceCapability = typeof TransferSourceCapabilitySchema.Type

export const TransferTargetCapabilitySchema = Schema.Struct({
  targetId: Schema.String,
  targetLabel: Schema.String,
  acceptedKinds: Schema.Array(TransferReferenceKindSchema),
  insertMode: TransferInsertModeSchema,
})
export type TransferTargetCapability = typeof TransferTargetCapabilitySchema.Type

export const TransferFeedbackSlotSchema = Schema.Struct({
  targetId: Schema.String,
  state: Schema.Literal('idle', 'accept', 'reject'),
  reason: Schema.UndefinedOr(Schema.String),
})
export type TransferFeedbackSlot = typeof TransferFeedbackSlotSchema.Type

export const TransferSourceTrait = createTrait<TransferSourceCapability>({
  id: 'transfer/source',
  render: () => null,
})

export const TransferTargetTrait = createTrait<TransferTargetCapability>({
  id: 'transfer/target',
  render: () => null,
})

export const TransferFeedbackTrait = createTrait<TransferFeedbackSlot>({
  id: 'transfer/feedback',
  render: () => null,
  className: (slot) => `transfer-feedback transfer-feedback--${slot.state}`,
})

export interface TransferDropHandler {
  intent: TransferDropIntent
  guard?: (token: TransferReferenceToken, intent: TransferDropIntent) => TransferDropDecision
  onDropToken: (token: TransferReferenceToken, decision: TransferDropDecision) => void
}
