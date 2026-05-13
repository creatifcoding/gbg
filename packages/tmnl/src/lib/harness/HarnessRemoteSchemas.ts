import { Schema } from 'effect'

import {
  HarnessClientMessageId,
  HarnessEvent,
  HarnessExtensionUIResponse,
  HarnessRole,
  HarnessSessionId,
  HarnessThinkingLevel,
} from './schemas'

export const HarnessRemoteOpenSessionCommand = Schema.TaggedStruct('harness:open_session', {
  nodeId: Schema.String,
  role: HarnessRole,
})

export const HarnessRemoteResumeSessionCommand = Schema.TaggedStruct('harness:resume_session', {
  sessionId: HarnessSessionId,
  fromSeq: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
})

export const HarnessRemoteSendCommand = Schema.TaggedStruct('harness:send', {
  sessionId: HarnessSessionId,
  clientMessageId: HarnessClientMessageId,
  text: Schema.String,
  thinkingLevel: Schema.optionalWith(HarnessThinkingLevel, { as: 'Option' }),
})

export const HarnessRemoteGetSnapshotCommand = Schema.TaggedStruct('harness:get_snapshot', {
  sessionId: HarnessSessionId,
  fromSeq: Schema.optionalWith(Schema.Number.pipe(Schema.nonNegative()), { as: 'Option' }),
})

export const HarnessRemoteAbortCommand = Schema.TaggedStruct('harness:abort', {
  sessionId: HarnessSessionId,
})

export const HarnessRemoteRespondExtensionUiCommand = Schema.TaggedStruct('harness:respond_extension_ui', {
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

export const HarnessRemoteResponseSuccess = Schema.Struct({
  ok: Schema.Literal(true),
  data: Schema.Unknown,
})

export const HarnessRemoteResponseFailure = Schema.Struct({
  ok: Schema.Literal(false),
  message: Schema.String,
  cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
})

export const HarnessRemoteResponse = Schema.Union(HarnessRemoteResponseSuccess, HarnessRemoteResponseFailure)
export type HarnessRemoteResponse = typeof HarnessRemoteResponse.Type

export const HarnessRemoteEventEnvelope = Schema.TaggedStruct('harness:event', {
  event: HarnessEvent,
})

export const HarnessWsRequestEnvelope = Schema.TaggedStruct('harness:ws_request', {
  requestId: Schema.String,
  command: HarnessRemoteCommand,
})

export const HarnessWsResponseEnvelope = Schema.TaggedStruct('harness:ws_response', {
  requestId: Schema.String,
  response: HarnessRemoteResponse,
})

export const HarnessWsEventEnvelope = Schema.TaggedStruct('harness:ws_event', {
  event: HarnessRemoteEventEnvelope,
})

export const HarnessWsIncomingEnvelope = Schema.Union(HarnessWsResponseEnvelope, HarnessWsEventEnvelope)
export const HarnessWsOutgoingEnvelope = Schema.Union(HarnessWsRequestEnvelope)
