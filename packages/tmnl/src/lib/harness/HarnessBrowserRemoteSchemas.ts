import { Schema } from 'effect'

import {
  HarnessClientMessageId,
  HarnessEvent,
  HarnessExtensionUIResponse,
  HarnessRole,
  HarnessSessionId,
  HarnessThinkingLevel,
} from './schemas'

import {
  ShellInputCommand,
  ShellResizeCommand,
  ShellKillCommand,
  ShellTakeControlCommand,
  ShellYieldControlCommand,
  ShellSwitchModeCommand,
  ShellEvent,
} from './interactive-shell/schemas'
import { PanelEvent } from '@/lib/genifer/harness/panel-events'

// ── Model catalog schema ────────────────────────────────────────────────────
export const HarnessModelInfo = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  provider: Schema.String,
  reasoning: Schema.Boolean,
  contextWindow: Schema.Number,
  maxTokens: Schema.Number,
})
export type HarnessModelInfo = typeof HarnessModelInfo.Type

export const HarnessModelOverride = Schema.Struct({
  provider: Schema.String,
  modelId: Schema.String,
})
export type HarnessModelOverride = typeof HarnessModelOverride.Type

export const HarnessRemoteModelListPayload = Schema.Struct({
  models: Schema.Array(HarnessModelInfo),
})

export const HarnessRemoteSessionStatus = Schema.Literal('active', 'archived', 'starred')

export const HarnessRemoteSessionListItem = Schema.Struct({
  sessionId: Schema.String,
  name: Schema.String,
  autoTitle: Schema.String,
  tags: Schema.Array(Schema.String),
  status: Schema.String,
  starred: Schema.Boolean,
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
  messageCount: Schema.Number,
  modelId: Schema.String,
  provider: Schema.String,
  previewSnippet: Schema.String,
  nodeId: Schema.String,
  role: Schema.String,
})
export type HarnessRemoteSessionListItem = typeof HarnessRemoteSessionListItem.Type

export const HarnessRemoteSessionListPayload = Schema.Struct({
  sessions: Schema.Array(HarnessRemoteSessionListItem),
})

export const HarnessRemoteSessionMetaPatch = Schema.Struct({
  name: Schema.optional(Schema.String),
  tags: Schema.optional(Schema.Array(Schema.String)),
  status: Schema.optional(HarnessRemoteSessionStatus),
  starred: Schema.optional(Schema.Boolean),
})
export type HarnessRemoteSessionMetaPatch = typeof HarnessRemoteSessionMetaPatch.Type

export const HarnessRemoteSessionMetaUpdatedPayload = Schema.Struct({
  ok: Schema.Boolean,
})

export const HarnessRemoteSessionDeletedPayload = Schema.Struct({
  ok: Schema.Boolean,
})

export const HarnessRemoteSessionForkedPayload = Schema.Struct({
  sessionId: Schema.String,
})

// ── Commands sent over WS to remote control plane ──────────────────────────
export const HarnessRemoteOpenSessionCommand = Schema.TaggedStruct('remote:chat_v2_open_session', {
  nodeId: Schema.String,
  role: HarnessRole,
})

export const HarnessRemoteResumeSessionCommand = Schema.TaggedStruct('remote:chat_v2_resume_session', {
  sessionId: HarnessSessionId,
  fromSeq: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
})

export const HarnessRemoteSendCommand = Schema.TaggedStruct('remote:chat_v2_send', {
  sessionId: HarnessSessionId,
  clientMessageId: HarnessClientMessageId,
  text: Schema.String,
  thinkingLevel: Schema.optional(HarnessThinkingLevel),
  modelOverride: Schema.optional(HarnessModelOverride),
})

export const HarnessRemoteGetSnapshotCommand = Schema.TaggedStruct('remote:chat_v2_get_snapshot', {
  sessionId: HarnessSessionId,
  fromSeq: Schema.optional(Schema.Number.pipe(Schema.nonNegative())),
})

export const HarnessRemoteAbortCommand = Schema.TaggedStruct('remote:chat_v2_abort', {
  sessionId: HarnessSessionId,
})

export const HarnessRemoteRespondExtensionUiCommand = Schema.TaggedStruct('remote:chat_v2_respond_extension_ui', {
  sessionId: HarnessSessionId,
  response: HarnessExtensionUIResponse,
})

export const HarnessRemoteGetModelsCommand = Schema.TaggedStruct('remote:get_available_models', {})

export const HarnessRemoteListSessionsCommand = Schema.TaggedStruct('remote:list_sessions', {})

export const HarnessRemoteUpdateSessionMetaCommand = Schema.TaggedStruct('remote:update_session_meta', {
  sessionId: Schema.String,
  patch: HarnessRemoteSessionMetaPatch,
})

export const HarnessRemoteDeleteSessionCommand = Schema.TaggedStruct('remote:delete_session', {
  sessionId: Schema.String,
})

export const HarnessRemoteForkSessionCommand = Schema.TaggedStruct('remote:fork_session', {
  sessionId: Schema.String,
  atSeq: Schema.optional(Schema.Number),
})

export const HarnessRemoteCommand = Schema.Union(
  HarnessRemoteOpenSessionCommand,
  HarnessRemoteResumeSessionCommand,
  HarnessRemoteSendCommand,
  HarnessRemoteGetSnapshotCommand,
  HarnessRemoteAbortCommand,
  HarnessRemoteRespondExtensionUiCommand,
  HarnessRemoteGetModelsCommand,
  HarnessRemoteListSessionsCommand,
  HarnessRemoteUpdateSessionMetaCommand,
  HarnessRemoteDeleteSessionCommand,
  HarnessRemoteForkSessionCommand,
  // Interactive shell commands (client → server PTY control)
  ShellInputCommand,
  ShellResizeCommand,
  ShellKillCommand,
  ShellTakeControlCommand,
  ShellYieldControlCommand,
  ShellSwitchModeCommand,
)
export type HarnessRemoteCommand = typeof HarnessRemoteCommand.Type

// Generic response envelope from control plane.
export const HarnessRemoteResponseSuccess = Schema.Struct({
  ok: Schema.Literal(true),
  data: Schema.Unknown,
})

export const HarnessRemoteResponseFailure = Schema.Struct({
  ok: Schema.Literal(false),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
})

export const HarnessRemoteResponse = Schema.Union(HarnessRemoteResponseSuccess, HarnessRemoteResponseFailure)
export type HarnessRemoteResponse = typeof HarnessRemoteResponse.Type

// Event envelope from control plane.
export const HarnessRemoteChatV2EventEnvelope = Schema.TaggedStruct('remote:chat_v2_event', {
  event: HarnessEvent,
})

export const HarnessRemoteShellEventEnvelope = Schema.TaggedStruct('remote:shell_event', {
  event: ShellEvent,
})

const HarnessRemotePanelEventEnvelopeBase = Schema.TaggedStruct('remote:panel_event', {
  event: PanelEvent,
  // Optional compatibility mirror for payload-style listeners.
  payload: Schema.optional(PanelEvent),
})

export const HarnessRemotePanelEventEnvelope = HarnessRemotePanelEventEnvelopeBase.pipe(
  Schema.filter(
    (envelope) => envelope.payload == null || envelope.payload._tag === envelope.event._tag,
    {
      message: () => 'remote:panel_event payload._tag must match event._tag when payload is provided',
    },
  ),
)

export const HarnessRemoteEventEnvelope = Schema.Union(
  HarnessRemoteChatV2EventEnvelope,
  HarnessRemoteShellEventEnvelope,
  HarnessRemotePanelEventEnvelope,
)

export const HarnessWsRequestEnvelope = Schema.TaggedStruct('remote:ws_request', {
  requestId: Schema.String,
  command: HarnessRemoteCommand,
})

export const HarnessWsResponseEnvelope = Schema.TaggedStruct('remote:ws_response', {
  requestId: Schema.String,
  response: HarnessRemoteResponse,
})

export const HarnessWsEventEnvelope = Schema.TaggedStruct('remote:ws_event', {
  event: HarnessRemoteEventEnvelope,
})

export const HarnessWsIncomingEnvelope = Schema.Union(HarnessWsResponseEnvelope, HarnessWsEventEnvelope)
export const HarnessWsOutgoingEnvelope = Schema.Union(HarnessWsRequestEnvelope)

export const HarnessRemoteSessionPayload = Schema.Struct({
  sessionId: HarnessSessionId,
  nodeId: Schema.String,
  role: HarnessRole,
  agentId: Schema.String,
  headSeq: Schema.Number.pipe(Schema.nonNegative()),
})

export const HarnessRemoteSendAckPayload = Schema.Struct({
  accepted: Schema.Literal(true),
  sessionId: HarnessSessionId,
})

export const HarnessRemoteSnapshotPayload = Schema.Struct({
  sessionId: HarnessSessionId,
  headSeq: Schema.Number.pipe(Schema.nonNegative()),
  events: Schema.Array(HarnessEvent),
})
