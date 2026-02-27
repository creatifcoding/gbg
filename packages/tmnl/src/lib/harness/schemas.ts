import { Schema } from 'effect'

// Local harness domain model (standalone rewrite lane)

export const HarnessRole = Schema.Literal(
  'scada-analyst',
  'code-assistant',
  'navigator',
  'inspector',
  'general',
)
export type HarnessRole = typeof HarnessRole.Type

export const HarnessThinkingLevel = Schema.Literal('off', 'minimal', 'low', 'medium', 'high')
export type HarnessThinkingLevel = typeof HarnessThinkingLevel.Type

export const HarnessSessionId = Schema.String.pipe(Schema.brand('ChatSessionId'))
export type HarnessSessionId = typeof HarnessSessionId.Type

export const HarnessMessageId = Schema.String.pipe(Schema.brand('ChatMessageId'))
export type HarnessMessageId = typeof HarnessMessageId.Type

export const HarnessClientMessageId = Schema.String.pipe(Schema.brand('ChatClientMessageId'))
export type HarnessClientMessageId = typeof HarnessClientMessageId.Type

export const HarnessSeq = Schema.Number.pipe(Schema.nonNegative())
export type HarnessSeq = typeof HarnessSeq.Type

export const HarnessProviderMarkerStart = Schema.TaggedStruct('provider:marker/start', {
  type: Schema.Literal('start'),
  partial: Schema.optional(Schema.Unknown),
})

export const HarnessProviderMarkerTextStart = Schema.TaggedStruct('provider:marker/text_start', {
  type: Schema.Literal('text_start'),
  contentIndex: Schema.Number,
  partial: Schema.optional(Schema.Unknown),
})

export const HarnessProviderMarkerTextDelta = Schema.TaggedStruct('provider:marker/text_delta', {
  type: Schema.Literal('text_delta'),
  contentIndex: Schema.Number,
  delta: Schema.String,
  partial: Schema.optional(Schema.Unknown),
})

export const HarnessProviderMarkerTextEnd = Schema.TaggedStruct('provider:marker/text_end', {
  type: Schema.Literal('text_end'),
  contentIndex: Schema.Number,
  content: Schema.String,
  partial: Schema.optional(Schema.Unknown),
})

export const HarnessProviderMarkerThinkingStart = Schema.TaggedStruct('provider:marker/thinking_start', {
  type: Schema.Literal('thinking_start'),
  contentIndex: Schema.Number,
  partial: Schema.optional(Schema.Unknown),
})

export const HarnessProviderMarkerThinkingDelta = Schema.TaggedStruct('provider:marker/thinking_delta', {
  type: Schema.Literal('thinking_delta'),
  contentIndex: Schema.Number,
  delta: Schema.String,
  partial: Schema.optional(Schema.Unknown),
})

export const HarnessProviderMarkerThinkingEnd = Schema.TaggedStruct('provider:marker/thinking_end', {
  type: Schema.Literal('thinking_end'),
  contentIndex: Schema.Number,
  content: Schema.String,
  partial: Schema.optional(Schema.Unknown),
})

export const HarnessProviderMarkerToolCallStart = Schema.TaggedStruct('provider:marker/toolcall_start', {
  type: Schema.Literal('toolcall_start'),
  contentIndex: Schema.Number,
  partial: Schema.optional(Schema.Unknown),
})

export const HarnessProviderMarkerToolCallDelta = Schema.TaggedStruct('provider:marker/toolcall_delta', {
  type: Schema.Literal('toolcall_delta'),
  contentIndex: Schema.Number,
  delta: Schema.String,
  partial: Schema.optional(Schema.Unknown),
})

export const HarnessProviderMarkerToolCallEnd = Schema.TaggedStruct('provider:marker/toolcall_end', {
  type: Schema.Literal('toolcall_end'),
  contentIndex: Schema.Number,
  toolCall: Schema.Unknown,
  partial: Schema.optional(Schema.Unknown),
})

export const HarnessProviderMarkerDone = Schema.TaggedStruct('provider:marker/done', {
  type: Schema.Literal('done'),
  reason: Schema.Literal('stop', 'length', 'toolUse'),
  message: Schema.optional(Schema.Unknown),
})

export const HarnessProviderMarkerError = Schema.TaggedStruct('provider:marker/error', {
  type: Schema.Literal('error'),
  reason: Schema.Literal('error', 'aborted'),
  error: Schema.optional(Schema.Unknown),
})

export const HarnessProviderMarkerUnknown = Schema.TaggedStruct('provider:marker/unknown', {
  type: Schema.Literal('unknown'),
  providerType: Schema.String,
  raw: Schema.Unknown,
})

export const HarnessProviderMarkerKnown = Schema.Union(
  HarnessProviderMarkerStart,
  HarnessProviderMarkerTextStart,
  HarnessProviderMarkerTextDelta,
  HarnessProviderMarkerTextEnd,
  HarnessProviderMarkerThinkingStart,
  HarnessProviderMarkerThinkingDelta,
  HarnessProviderMarkerThinkingEnd,
  HarnessProviderMarkerToolCallStart,
  HarnessProviderMarkerToolCallDelta,
  HarnessProviderMarkerToolCallEnd,
  HarnessProviderMarkerDone,
  HarnessProviderMarkerError,
)
export type HarnessProviderMarkerKnown = typeof HarnessProviderMarkerKnown.Type

export const HarnessProviderMarker = Schema.Union(HarnessProviderMarkerKnown, HarnessProviderMarkerUnknown)
export type HarnessProviderMarker = typeof HarnessProviderMarker.Type

const HarnessEventBase = {
  sessionId: HarnessSessionId,
  seq: HarnessSeq,
  at: Schema.Number,
}

export const HarnessSessionOpenedEvent = Schema.TaggedStruct('chat:v2/session_opened', {
  ...HarnessEventBase,
  nodeId: Schema.String,
  role: HarnessRole,
  agentId: Schema.String,
})

export const HarnessSendAcceptedEvent = Schema.TaggedStruct('chat:v2/send_accepted', {
  ...HarnessEventBase,
  clientMessageId: HarnessClientMessageId,
  userMessageId: HarnessMessageId,
})

export const HarnessAssistantStartEvent = Schema.TaggedStruct('chat:v2/assistant_start', {
  ...HarnessEventBase,
  messageId: HarnessMessageId,
})

export const HarnessAssistantDeltaEvent = Schema.TaggedStruct('chat:v2/assistant_delta', {
  ...HarnessEventBase,
  messageId: HarnessMessageId,
  delta: Schema.String,
})

export const HarnessAssistantThinkingDeltaEvent = Schema.TaggedStruct('chat:v2/assistant_thinking_delta', {
  ...HarnessEventBase,
  messageId: HarnessMessageId,
  delta: Schema.String,
})

export const HarnessAssistantFinalEvent = Schema.TaggedStruct('chat:v2/assistant_final', {
  ...HarnessEventBase,
  messageId: HarnessMessageId,
  text: Schema.String,
})

export const HarnessUsageEvent = Schema.TaggedStruct('chat:v2/usage', {
  ...HarnessEventBase,
  messageId: HarnessMessageId,
  provider: Schema.String,
  model: Schema.String,
  api: Schema.String,
  stopReason: Schema.Literal('stop', 'length', 'toolUse', 'error', 'aborted'),
  usage: Schema.Struct({
    input: Schema.Number,
    output: Schema.Number,
    cacheRead: Schema.Number,
    cacheWrite: Schema.Number,
    totalTokens: Schema.Number,
  }),
  cost: Schema.Struct({
    input: Schema.Number,
    output: Schema.Number,
    cacheRead: Schema.Number,
    cacheWrite: Schema.Number,
    total: Schema.Number,
  }),
})

export const HarnessContextEvent = Schema.TaggedStruct('chat:v2/context', {
  ...HarnessEventBase,
  contextTokens: Schema.Number,
  contextWindow: Schema.Number,
  contextPercent: Schema.Number,
  totalInput: Schema.Number,
  totalOutput: Schema.Number,
  totalCacheRead: Schema.Number,
  totalCacheWrite: Schema.Number,
  totalCost: Schema.Number,
  compactionMode: Schema.Literal('auto', 'manual', 'disabled'),
  compactionStatus: Schema.Literal('idle', 'compacting', 'completed'),
  compactionCount: Schema.Number,
})

export const HarnessMetricName = Schema.Literal(
  'ackLatencyMs',
  'firstDeltaLagMs',
  'toolRoundTripMs',
  'abortToStopMs',
  'retryCount',
  'renderTransformBatchMs',
  'renderBacklogDepth',
  'compactionTokensSaved',
)
export type HarnessMetricName = typeof HarnessMetricName.Type

export const HarnessMetricEvent = Schema.TaggedStruct('chat:v2/metric', {
  ...HarnessEventBase,
  metric: HarnessMetricName,
  value: Schema.Number,
  messageId: Schema.optional(HarnessMessageId),
  toolCallId: Schema.optional(Schema.String),
  details: Schema.optional(Schema.Unknown),
})

// ---------------------------------------------------------------------------
// Tool Stream Chunk — payload for phase:'stream' tool events
// ---------------------------------------------------------------------------

export const ToolStreamChunkPayload = Schema.Struct({
  /** Monotonic sequence number per tool call (server-assigned) */
  seq: Schema.Number,
  /** Raw text chunk from stdout/stderr (may contain ANSI) */
  chunk: Schema.String,
  /** Stream kind */
  kind: Schema.Literal('stdout', 'stderr'),
})
export type ToolStreamChunkPayload = typeof ToolStreamChunkPayload.Type

// ── Tool event payload schemas (typed per phase) ──

/** phase:'start' — first event has diagnostics, second has arguments */
export const ToolStartPayload = Schema.Struct({
  arguments: Schema.optional(Schema.Record({ key: Schema.String, value: Schema.Unknown })),
  diagnostics: Schema.optional(Schema.Struct({
    toolNameResolved: Schema.optional(Schema.Boolean),
    adapter: Schema.optional(Schema.Array(Schema.Unknown)),
  })),
})
export type ToolStartPayload = typeof ToolStartPayload.Type

/** phase:'end' — tool result with content array */
export const ToolEndPayload = Schema.Struct({
  result: Schema.optional(Schema.Array(Schema.Struct({
    type: Schema.String,
    text: Schema.optional(Schema.String),
  }))),
  isError: Schema.optional(Schema.Boolean),
  executionMs: Schema.optional(Schema.Number),
})
export type ToolEndPayload = typeof ToolEndPayload.Type

/** phase:'update' — execution metrics (skipped by event processor) */
export const ToolUpdatePayload = Schema.Struct({
  executionMs: Schema.optional(Schema.Number),
  isError: Schema.optional(Schema.Boolean),
})
export type ToolUpdatePayload = typeof ToolUpdatePayload.Type

// ── Tool Manifest (emitted after session_opened) ────────────────────────────

export const ToolManifestEntry = Schema.Struct({
  name: Schema.String,
  description: Schema.optional(Schema.String),
  /** JSON Schema object describing tool parameters (from TypeBox / pi-ai Tool.parameters) */
  parameters: Schema.optional(Schema.Unknown),
})
export type ToolManifestEntry = typeof ToolManifestEntry.Type

export const HarnessToolManifestEvent = Schema.TaggedStruct('chat:v2/tool_manifest', {
  ...HarnessEventBase,
  tools: Schema.Array(ToolManifestEntry),
})
export type HarnessToolManifestEvent = typeof HarnessToolManifestEvent.Type

export const HarnessToolEvent = Schema.TaggedStruct('chat:v2/tool_event', {
  ...HarnessEventBase,
  toolCallId: Schema.String,
  toolName: Schema.String,
  phase: Schema.Literal('start', 'update', 'end', 'stream'),
  payload: Schema.Unknown,
})

export const HarnessProviderMarkerEvent = Schema.TaggedStruct('chat:v2/provider_marker', {
  ...HarnessEventBase,
  marker: HarnessProviderMarker,
})

export const HarnessErrorEvent = Schema.TaggedStruct('chat:v2/error', {
  ...HarnessEventBase,
  code: Schema.String,
  message: Schema.String,
})

export const HarnessHeartbeatEvent = Schema.TaggedStruct('chat:v2/heartbeat', {
  ...HarnessEventBase,
})

// --- Genifer Harness Events (inline alongside existing) ---
import {
  GeniferGenerateStartEvent,
  GeniferStreamDeltaEvent,
  GeniferGenerateCompleteEvent,
  GeniferRefineStartEvent,
  GeniferRefineCompleteEvent,
  GeniferQualityEvent,
} from '@/lib/genifer/harness/schemas'

export const HarnessEvent = Schema.Union(
  // Existing harness events
  HarnessSessionOpenedEvent,
  HarnessToolManifestEvent,
  HarnessSendAcceptedEvent,
  HarnessAssistantStartEvent,
  HarnessAssistantDeltaEvent,
  HarnessAssistantThinkingDeltaEvent,
  HarnessAssistantFinalEvent,
  HarnessUsageEvent,
  HarnessContextEvent,
  HarnessMetricEvent,
  HarnessToolEvent,
  HarnessProviderMarkerEvent,
  HarnessErrorEvent,
  HarnessHeartbeatEvent,
  // Genifer surface events
  GeniferGenerateStartEvent,
  GeniferStreamDeltaEvent,
  GeniferGenerateCompleteEvent,
  GeniferRefineStartEvent,
  GeniferRefineCompleteEvent,
  GeniferQualityEvent,
)
export type HarnessEvent = typeof HarnessEvent.Type

export class HarnessSnapshot extends Schema.Class<HarnessSnapshot>('HarnessSnapshot')({
  sessionId: HarnessSessionId,
  headSeq: HarnessSeq,
  events: Schema.Array(HarnessEvent),
}) {}

export const HarnessBackend = Schema.Literal('pi-ai')
export type HarnessBackend = typeof HarnessBackend.Type

export class HarnessSessionView extends Schema.Class<HarnessSessionView>('HarnessSessionView')({
  sessionId: HarnessSessionId,
  nodeId: Schema.String,
  role: HarnessRole,
  agentId: Schema.String,
  headSeq: HarnessSeq,
  backend: HarnessBackend,
}) {}

export class HarnessSendAck extends Schema.Class<HarnessSendAck>('HarnessSendAck')({
  accepted: Schema.Literal(true),
  sessionId: HarnessSessionId,
  backend: HarnessBackend,
}) {}

export const HarnessSessionStatus = Schema.Literal('active', 'closed', 'failed')
export type HarnessSessionStatus = typeof HarnessSessionStatus.Type

export class HarnessSessionEnvelope extends Schema.Class<HarnessSessionEnvelope>('HarnessSessionEnvelope')({
  sessionId: HarnessSessionId,
  nodeId: Schema.String,
  role: HarnessRole,
  agentId: Schema.String,
  backend: HarnessBackend,
  headSeq: HarnessSeq,
  status: HarnessSessionStatus,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
}) {}

export class HarnessEventEnvelope extends Schema.Class<HarnessEventEnvelope>('HarnessEventEnvelope')({
  sessionId: HarnessSessionId,
  seq: HarnessSeq,
  event: HarnessEvent,
  persistedAt: Schema.Number,
}) {}

export class HarnessReplayCursor extends Schema.Class<HarnessReplayCursor>('HarnessReplayCursor')({
  sessionId: HarnessSessionId,
  lastAppliedSeq: HarnessSeq,
  updatedAt: Schema.Number,
}) {}

export const HarnessExtensionUIResponseValue = Schema.TaggedStruct('pi:extension_ui_response:value', {
  requestId: Schema.String,
  value: Schema.String,
})

export const HarnessExtensionUIResponseConfirm = Schema.TaggedStruct('pi:extension_ui_response:confirm', {
  requestId: Schema.String,
  confirmed: Schema.Boolean,
})

export const HarnessExtensionUIResponseCancel = Schema.TaggedStruct('pi:extension_ui_response:cancel', {
  requestId: Schema.String,
  cancelled: Schema.Literal(true),
})

export const HarnessExtensionUIResponse = Schema.Union(
  HarnessExtensionUIResponseValue,
  HarnessExtensionUIResponseConfirm,
  HarnessExtensionUIResponseCancel,
)
export type HarnessExtensionUIResponse = typeof HarnessExtensionUIResponse.Type
