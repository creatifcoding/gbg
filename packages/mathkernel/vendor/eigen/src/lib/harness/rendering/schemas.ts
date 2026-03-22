import { Schema } from 'effect'

import { HarnessSessionId } from '../schemas'

export const RenderLane = Schema.Literal('text', 'thinking', 'tool', 'control', 'extension', 'unknown')
export type RenderLane = typeof RenderLane.Type

export const RenderEventClass = Schema.Literal(
  'delta',
  'tool',
  'control',
  'extension',
  'error',
  'terminal',
  'unknown',
)
export type RenderEventClass = typeof RenderEventClass.Type

export const RenderBypassClass = Schema.Literal('error', 'terminal', 'extension', 'tool')
export type RenderBypassClass = typeof RenderBypassClass.Type

export const RenderMessageId = Schema.String.pipe(Schema.brand('RenderMessageId'))
export type RenderMessageId = typeof RenderMessageId.Type

export class RenderReducerInput extends Schema.Class<RenderReducerInput>('RenderReducerInput')({
  sessionId: HarnessSessionId,
  messageId: Schema.optional(RenderMessageId),
  seq: Schema.Number.pipe(Schema.nonNegative()),
  at: Schema.Number,
  lane: RenderLane,
  class: RenderEventClass,
  tag: Schema.String,
  payload: Schema.Unknown,
}) {}

export class RenderPatch extends Schema.Class<RenderPatch>('RenderPatch')({
  path: Schema.String,
  op: Schema.Literal('set', 'append', 'remove', 'replace', 'merge'),
  value: Schema.Unknown,
  lane: RenderLane,
  overlayId: Schema.String,
}) {}

export class RenderNode extends Schema.Class<RenderNode>('RenderNode')({
  id: Schema.String,
  kind: Schema.String,
  lane: RenderLane,
  props: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  children: Schema.Array(Schema.String),
}) {}

export class RenderOverlayOutput extends Schema.Class<RenderOverlayOutput>('RenderOverlayOutput')({
  overlayId: Schema.String,
  lane: RenderLane,
  patches: Schema.Array(RenderPatch),
  nodes: Schema.Array(RenderNode),
  diagnostics: Schema.Array(Schema.String),
}) {}

export class RenderReducerEmission extends Schema.Class<RenderReducerEmission>('RenderReducerEmission')({
  sessionId: HarnessSessionId,
  messageId: Schema.optional(RenderMessageId),
  bucketKey: Schema.String,
  seqHighWatermark: Schema.Number.pipe(Schema.nonNegative()),
  emittedAt: Schema.Number,
  transformMs: Schema.Number.pipe(Schema.nonNegative()),
  batchSize: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  backlogDepth: Schema.Number.pipe(Schema.int(), Schema.nonNegative()),
  overlays: Schema.Array(Schema.String),
  patches: Schema.Array(RenderPatch),
  nodes: Schema.Array(RenderNode),
}) {}

export class RenderCoalescerPolicy extends Schema.Class<RenderCoalescerPolicy>('RenderCoalescerPolicy')({
  maxBatchSize: Schema.Number.pipe(Schema.int(), Schema.positive()),
  maxWaitMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
  frameBudgetMs: Schema.Number.pipe(Schema.positive()),
  flushOnBypass: Schema.Boolean,
}) {}
