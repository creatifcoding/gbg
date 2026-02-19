import { Context, Effect, Option, Schema, Stream } from 'effect'

import {
  type HarnessClientMessageId,
  type HarnessEvent,
  type HarnessExtensionUIResponse,
  type HarnessRole,
  HarnessSendAck,
  HarnessSessionView,
  HarnessSnapshot,
  type HarnessThinkingLevel,
  type HarnessSessionId,
} from './schemas'

// Re-export these types so consumers that only need the shape
// don't have to import PiAiHarnessEngine (server-only).
export interface AvailableModelInfo {
  readonly id: string
  readonly name: string
  readonly provider: string
  readonly reasoning: boolean
  readonly contextWindow: number
  readonly maxTokens: number
}

export interface ModelOverride {
  readonly provider: string
  readonly modelId: string
}

export class HarnessRuntimeError extends Schema.TaggedError<HarnessRuntimeError>()(
  'HarnessRuntimeError',
  {
    code: Schema.String,
    message: Schema.String,
    cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  },
) {}

export interface HarnessRuntimeShape {
  readonly backend: 'pi-ai'
  readonly openSession: (
    nodeId: string,
    role: HarnessRole,
  ) => Effect.Effect<HarnessSessionView, HarnessRuntimeError>
  readonly resumeSession: (
    sessionId: HarnessSessionId,
    fromSeq: Option.Option<number>,
  ) => Effect.Effect<HarnessSnapshot, HarnessRuntimeError>
  readonly send: (
    sessionId: HarnessSessionId,
    clientMessageId: HarnessClientMessageId,
    text: string,
    thinkingLevel: Option.Option<HarnessThinkingLevel>,
    modelOverride?: ModelOverride,
  ) => Effect.Effect<HarnessSendAck, HarnessRuntimeError>
  readonly getAvailableModels: () => Effect.Effect<ReadonlyArray<AvailableModelInfo>, HarnessRuntimeError>
  readonly getSnapshot: (
    sessionId: HarnessSessionId,
    fromSeq: Option.Option<number>,
  ) => Effect.Effect<HarnessSnapshot, HarnessRuntimeError>
  readonly abortSession: (sessionId: HarnessSessionId) => Effect.Effect<void, HarnessRuntimeError>
  readonly respondExtensionUI: (
    sessionId: HarnessSessionId,
    response: HarnessExtensionUIResponse,
  ) => Effect.Effect<void, HarnessRuntimeError>
  readonly events: Stream.Stream<HarnessEvent, HarnessRuntimeError>
}

export const HarnessRuntime = Context.GenericTag<HarnessRuntimeShape>('tmnl/harness/HarnessRuntime')
