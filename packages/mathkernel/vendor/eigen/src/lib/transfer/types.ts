import { Schema } from 'effect'

export const TransferReferenceKindSchema = Schema.Literal('task', 'task-cluster')
export type TransferReferenceKind = typeof TransferReferenceKindSchema.Type

export const TransferInsertModeSchema = Schema.Literal('inline-chip', 'structured-block')
export type TransferInsertMode = typeof TransferInsertModeSchema.Type

export const TransferOriginSchema = Schema.Struct({
  surfaceId: Schema.String,
  sourceId: Schema.String,
  sourceLabel: Schema.String,
  threadId: Schema.optional(Schema.String),
  messageAnchorId: Schema.optional(Schema.String),
  agentId: Schema.optional(Schema.String),
})
export type TransferOrigin = typeof TransferOriginSchema.Type

export const TransferTaskReferenceSchema = Schema.TaggedStruct('TransferTaskReference', {
  kind: Schema.Literal('task'),
  referenceId: Schema.String,
  taskId: Schema.String,
  label: Schema.String,
  status: Schema.optional(Schema.String),
})
export type TransferTaskReference = typeof TransferTaskReferenceSchema.Type

export const TransferTaskClusterReferenceSchema = Schema.TaggedStruct('TransferTaskClusterReference', {
  kind: Schema.Literal('task-cluster'),
  referenceId: Schema.String,
  clusterId: Schema.String,
  label: Schema.String,
  taskIds: Schema.Array(Schema.String),
})
export type TransferTaskClusterReference = typeof TransferTaskClusterReferenceSchema.Type

export const TransferReferenceSchema = Schema.Union(
  TransferTaskReferenceSchema,
  TransferTaskClusterReferenceSchema,
)
export type TransferReference = typeof TransferReferenceSchema.Type

export const TransferReferenceTokenSchema = Schema.Struct({
  tokenId: Schema.String,
  version: Schema.Literal('1'),
  createdAt: Schema.Number,
  origin: TransferOriginSchema,
  reference: TransferReferenceSchema,
})
export type TransferReferenceToken = typeof TransferReferenceTokenSchema.Type

export const TransferDropIntentSchema = Schema.Struct({
  targetId: Schema.String,
  acceptedKinds: Schema.Array(TransferReferenceKindSchema),
  insertMode: TransferInsertModeSchema,
})
export type TransferDropIntent = typeof TransferDropIntentSchema.Type

export const TransferDropAcceptSchema = Schema.TaggedStruct('TransferDropAccept', {
  targetId: Schema.String,
  insertMode: TransferInsertModeSchema,
})
export type TransferDropAccept = typeof TransferDropAcceptSchema.Type

export const TransferDropRejectSchema = Schema.TaggedStruct('TransferDropReject', {
  targetId: Schema.String,
  reason: Schema.String,
})
export type TransferDropReject = typeof TransferDropRejectSchema.Type

export const TransferDropDecisionSchema = Schema.Union(TransferDropAcceptSchema, TransferDropRejectSchema)
export type TransferDropDecision = typeof TransferDropDecisionSchema.Type

export const TransferPointerSchema = Schema.Struct({
  x: Schema.Number,
  y: Schema.Number,
})
export type TransferPointer = typeof TransferPointerSchema.Type

export const TransferDragSessionSchema = Schema.Struct({
  sessionId: Schema.String,
  token: TransferReferenceTokenSchema,
  tokens: Schema.optional(Schema.Array(TransferReferenceTokenSchema)),
  pointer: TransferPointerSchema,
  hoverTargetId: Schema.optional(Schema.String),
  startedAt: Schema.Number,
})
export type TransferDragSession = typeof TransferDragSessionSchema.Type

export const TransferClipboardEntrySchema = Schema.Struct({
  token: TransferReferenceTokenSchema,
  tokens: Schema.optional(Schema.Array(TransferReferenceTokenSchema)),
  copiedAt: Schema.Number,
  sourceSelectionIds: Schema.Array(Schema.String),
})
export type TransferClipboardEntry = typeof TransferClipboardEntrySchema.Type

export const TransferRuntimeStateSchema = Schema.Struct({
  activeSession: Schema.NullOr(TransferDragSessionSchema),
  hoverDecision: Schema.NullOr(TransferDropDecisionSchema),
  clipboard: Schema.NullOr(TransferClipboardEntrySchema),
})
export type TransferRuntimeState = typeof TransferRuntimeStateSchema.Type

export type TransferGuard = (
  token: TransferReferenceToken,
  intent: TransferDropIntent,
) => TransferDropDecision
