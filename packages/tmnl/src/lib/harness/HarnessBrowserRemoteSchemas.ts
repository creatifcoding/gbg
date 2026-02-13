import { Schema } from 'effect'

import {
  HarnessClientMessageId,
  HarnessEvent,
  HarnessExtensionUIResponse,
  HarnessRole,
  HarnessSessionId,
  HarnessThinkingLevel,
} from './schemas'

// Commands sent over WS to remote control plane.
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

export const HarnessRemoteCommand = Schema.Union(
  HarnessRemoteOpenSessionCommand,
  HarnessRemoteResumeSessionCommand,
  HarnessRemoteSendCommand,
  HarnessRemoteGetSnapshotCommand,
  HarnessRemoteAbortCommand,
  HarnessRemoteRespondExtensionUiCommand,
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

export const HarnessRemoteEventEnvelope = Schema.Union(HarnessRemoteChatV2EventEnvelope)

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
