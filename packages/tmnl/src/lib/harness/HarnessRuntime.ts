import { Context, Effect, Layer, Option, Schema, Stream } from 'effect'

import { PiAiHarnessEngine, PiAiHarnessEngineLive, type AvailableModelInfo, type ModelOverride } from './PiAiHarnessEngine'
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

const toRuntimeError = (code: string, message: string) => (cause: unknown) =>
  new HarnessRuntimeError({
    code,
    message,
    cause: Option.some(cause),
  })

export const HarnessRuntimeLive = Layer.effect(
  HarnessRuntime,
  Effect.gen(function* () {
    const engine = yield* PiAiHarnessEngine

    return HarnessRuntime.of({
      backend: 'pi-ai',

      openSession: (nodeId, role) =>
        engine.openSession(nodeId, role).pipe(
          Effect.map(
            (view) =>
              new HarnessSessionView({
                ...view,
                backend: 'pi-ai',
              }),
          ),
          Effect.mapError(toRuntimeError('open-session-failed', 'Failed to open harness session')),
          Effect.withSpan('tmnl.harness.runtime.open-session'),
        ),

      resumeSession: (sessionId, fromSeq) =>
        engine.getSnapshot(sessionId, fromSeq).pipe(
          Effect.map((snapshot) => new HarnessSnapshot(snapshot)),
          Effect.mapError(toRuntimeError('resume-session-failed', 'Failed to resume harness session')),
          Effect.withSpan('tmnl.harness.runtime.resume-session'),
        ),

      send: (sessionId, clientMessageId, text, thinkingLevel, modelOverride?) =>
        engine.send(sessionId, clientMessageId, text, thinkingLevel, modelOverride).pipe(
          Effect.map(
            (ack) =>
              new HarnessSendAck({
                accepted: ack.accepted,
                sessionId: ack.sessionId,
                backend: 'pi-ai',
              }),
          ),
          Effect.mapError(toRuntimeError('send-failed', 'Failed to send harness prompt')),
          Effect.withSpan('tmnl.harness.runtime.send'),
        ),

      getSnapshot: (sessionId, fromSeq) =>
        engine.getSnapshot(sessionId, fromSeq).pipe(
          Effect.map((snapshot) => new HarnessSnapshot(snapshot)),
          Effect.mapError(toRuntimeError('snapshot-failed', 'Failed to get harness snapshot')),
          Effect.withSpan('tmnl.harness.runtime.get-snapshot'),
        ),

      abortSession: (sessionId) =>
        engine.abortSession(sessionId).pipe(
          Effect.mapError(toRuntimeError('abort-failed', 'Failed to abort harness session')),
          Effect.withSpan('tmnl.harness.runtime.abort-session'),
        ),

      respondExtensionUI: (sessionId, response) =>
        engine.respondExtensionUI(sessionId, response).pipe(
          Effect.mapError(toRuntimeError('extension-ui-failed', 'Failed to route harness extension UI response')),
          Effect.withSpan('tmnl.harness.runtime.respond-extension-ui'),
        ),

      getAvailableModels: () =>
        engine.getAvailableModels().pipe(
          Effect.mapError(toRuntimeError('models-failed', 'Failed to get available models')),
          Effect.withSpan('tmnl.harness.runtime.get-available-models'),
        ),

      events: engine.events.pipe(
        Stream.mapError(toRuntimeError('events-failed', 'Harness event stream failed')),
      ),
    })
  }),
).pipe(Layer.provide(PiAiHarnessEngineLive))
