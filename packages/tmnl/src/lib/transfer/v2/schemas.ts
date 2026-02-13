/**
 * Transfer v2 Schema Surface
 *
 * Redesigned from v1's 15 types → 8 types.
 * See: src/lib/transfer/docs/redesign/02-transfer-schema-redesign.md
 *
 * Key changes:
 * - TransferOrigin flattened into TransferToken (no nesting)
 * - TransferDropIntent killed (absorbed into target config)
 * - TransferPointer killed (inlined as struct field)
 * - TransferRuntimeState killed (replaced by scope-local atoms)
 * - Version bumped to '2'
 * - Naming shortened: TaskRef not TransferTaskReferenceSchema
 *
 * @since v2
 */
import { Schema } from 'effect'

// ── Discriminants ────────────────────────────────────────────

export const TransferKind = Schema.Literal('task', 'task-cluster')
export type TransferKind = typeof TransferKind.Type

export const TransferInsertMode = Schema.Literal('inline-chip', 'structured-block')
export type TransferInsertMode = typeof TransferInsertMode.Type

// ── References ───────────────────────────────────────────────

export const TaskRef = Schema.TaggedStruct('TaskRef', {
  kind: Schema.Literal('task'),
  id: Schema.String,
  taskId: Schema.String,
  label: Schema.String,
  status: Schema.optional(Schema.String),
})
export type TaskRef = typeof TaskRef.Type

export const ClusterRef = Schema.TaggedStruct('ClusterRef', {
  kind: Schema.Literal('task-cluster'),
  id: Schema.String,
  clusterId: Schema.String,
  label: Schema.String,
  taskIds: Schema.Array(Schema.String),
})
export type ClusterRef = typeof ClusterRef.Type

export const TransferRef = Schema.Union(TaskRef, ClusterRef)
export type TransferRef = typeof TransferRef.Type

// ── Token (flattened origin) ─────────────────────────────────

export const TransferToken = Schema.Struct({
  tokenId: Schema.String,
  version: Schema.Literal('2'),

  // Origin fields (flattened — was TransferOriginSchema in v1)
  surfaceId: Schema.String,
  sourceId: Schema.String,
  sourceLabel: Schema.String,
  threadId: Schema.optional(Schema.String),
  agentId: Schema.optional(Schema.String),

  // Reference payload
  ref: TransferRef,

  createdAt: Schema.Number,
})
export type TransferToken = typeof TransferToken.Type

// ── Transfer Result ──────────────────────────────────────────

export const TransferAccept = Schema.TaggedStruct('TransferAccept', {
  targetId: Schema.String,
  insertMode: TransferInsertMode,
})
export type TransferAccept = typeof TransferAccept.Type

export const TransferReject = Schema.TaggedStruct('TransferReject', {
  targetId: Schema.String,
  reason: Schema.String,
})
export type TransferReject = typeof TransferReject.Type

export const TransferResult = Schema.Union(TransferAccept, TransferReject)
export type TransferResult = typeof TransferResult.Type

// ── Session (scope-local) ────────────────────────────────────

export const TransferSession = Schema.Struct({
  id: Schema.String,
  tokens: Schema.Array(TransferToken),
  pointer: Schema.Struct({ x: Schema.Number, y: Schema.Number }),
  hoverTargetId: Schema.optional(Schema.String),
  result: Schema.optional(TransferResult),
  startedAt: Schema.Number,
})
export type TransferSession = typeof TransferSession.Type

// ── Clipboard Entry ──────────────────────────────────────────

export const TransferClipboardEntry = Schema.Struct({
  tokens: Schema.Array(TransferToken),
  copiedAt: Schema.Number,
})
export type TransferClipboardEntry = typeof TransferClipboardEntry.Type

// ── Feedback Events ──────────────────────────────────────────

export const FeedbackAccepted = Schema.TaggedStruct('Accepted', {
  tokenCount: Schema.Number,
  targetId: Schema.String,
})
export type FeedbackAccepted = typeof FeedbackAccepted.Type

export const FeedbackRejected = Schema.TaggedStruct('Rejected', {
  reason: Schema.String,
  targetId: Schema.String,
})
export type FeedbackRejected = typeof FeedbackRejected.Type

export const FeedbackCopied = Schema.TaggedStruct('Copied', {
  tokenCount: Schema.Number,
})
export type FeedbackCopied = typeof FeedbackCopied.Type

export const TransferFeedbackEvent = Schema.Union(
  FeedbackAccepted,
  FeedbackRejected,
  FeedbackCopied,
)
export type TransferFeedbackEvent = typeof TransferFeedbackEvent.Type
