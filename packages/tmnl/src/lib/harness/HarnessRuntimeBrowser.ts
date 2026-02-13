import {
  Context,
  Effect,
  Either,
  Layer,
  Option,
  Schema,
  Stream,
} from 'effect'

import {
  HarnessBrowserTransport,
  HarnessBrowserTransportError,
  HarnessBrowserTransportWebSocketDefault,
} from './HarnessBrowserTransport'
import {
  HarnessRemoteEventEnvelope,
  HarnessRemoteResponse,
  HarnessRemoteSendAckPayload,
  HarnessRemoteSessionPayload,
  HarnessRemoteSnapshotPayload,
} from './HarnessBrowserRemoteSchemas'
import {
  HarnessRuntime,
  HarnessRuntimeError,
  type HarnessRuntimeShape,
} from './HarnessRuntime'
import {
  HarnessEvent,
  type HarnessClientMessageId,
  type HarnessExtensionUIResponse,
  type HarnessRole,
  HarnessSendAck,
  HarnessSessionView,
  HarnessSnapshot,
  type HarnessThinkingLevel,
  type HarnessSessionId,
} from './schemas'

export class HarnessBrowserProtocolError extends Schema.TaggedError<HarnessBrowserProtocolError>()(
  'HarnessBrowserProtocolError',
  {
    message: Schema.String,
    commandTag: Schema.optionalWith(Schema.String, { as: 'Option' }),
    cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  },
) {}

const decodeOrFail = <A>(
  schema: Schema.Schema<A>,
  input: unknown,
  commandTag?: string,
): Effect.Effect<A, HarnessBrowserProtocolError> =>
  Either.match(Schema.decodeUnknownEither(schema)(input), {
    onLeft: (cause) =>
      Effect.fail(
        new HarnessBrowserProtocolError({
          message: 'Failed to decode harness browser payload',
          commandTag: commandTag === undefined ? Option.none() : Option.some(commandTag),
          cause: Option.some(cause),
        }),
      ),
    onRight: Effect.succeed,
  })

const optionToOptionalField = <A>(value: Option.Option<A>): A | undefined =>
  Option.match(value, {
    onNone: () => undefined,
    onSome: (next) => next,
  })

const requestData = <A>(
  transport: {
    readonly request: (command: unknown) => Effect.Effect<unknown, HarnessBrowserTransportError>
  },
  command: Record<string, unknown> & { _tag: string },
  dataSchema: Schema.Schema<A>,
): Effect.Effect<A, HarnessBrowserTransportError | HarnessBrowserProtocolError> =>
  Effect.gen(function* () {
    const rawResponse = yield* transport.request(command)
    const response = yield* decodeOrFail(HarnessRemoteResponse, rawResponse, command._tag)

    if (!response.ok) {
      return yield* Effect.fail(
        new HarnessBrowserProtocolError({
          message: response.message,
          commandTag: Option.some(command._tag),
          cause: Option.fromNullable(response.cause),
        }),
      )
    }

    return yield* decodeOrFail(dataSchema, response.data, command._tag)
  })

const toRuntimeError =
  (code: string, message: string) =>
  (cause: HarnessBrowserTransportError | HarnessBrowserProtocolError): HarnessRuntimeError =>
    new HarnessRuntimeError({
      code,
      message,
      cause: Option.some(cause),
    })

export const HarnessRuntimeBrowserLive = Layer.effect(
  HarnessRuntime,
  Effect.gen(function* () {
    const transport = yield* HarnessBrowserTransport

    const openSession: HarnessRuntimeShape['openSession'] = (nodeId, role) =>
      requestData(
        transport,
        {
          _tag: 'remote:chat_v2_open_session',
          nodeId,
          role,
        },
        HarnessRemoteSessionPayload,
      ).pipe(
        Effect.map(
          (view) =>
            new HarnessSessionView({
              ...view,
              backend: 'pi-ai',
            }),
        ),
        Effect.mapError(toRuntimeError('open-session-failed', 'Failed to open harness browser session')),
        Effect.withSpan('tmnl.harness.runtime.browser.open-session'),
      )

    const resumeSession: HarnessRuntimeShape['resumeSession'] = (sessionId, fromSeq) =>
      requestData(
        transport,
        {
          _tag: 'remote:chat_v2_resume_session',
          sessionId,
          fromSeq: optionToOptionalField(fromSeq),
        },
        HarnessRemoteSnapshotPayload,
      ).pipe(
        Effect.map((snapshot) => new HarnessSnapshot(snapshot)),
        Effect.mapError(toRuntimeError('resume-session-failed', 'Failed to resume harness browser session')),
        Effect.withSpan('tmnl.harness.runtime.browser.resume-session'),
      )

    const send: HarnessRuntimeShape['send'] = (sessionId, clientMessageId, text, thinkingLevel) =>
      requestData(
        transport,
        {
          _tag: 'remote:chat_v2_send',
          sessionId,
          clientMessageId,
          text,
          thinkingLevel: optionToOptionalField(thinkingLevel),
        },
        HarnessRemoteSendAckPayload,
      ).pipe(
        Effect.map(
          (ack) =>
            new HarnessSendAck({
              accepted: ack.accepted,
              sessionId: ack.sessionId,
              backend: 'pi-ai',
            }),
        ),
        Effect.mapError(toRuntimeError('send-failed', 'Failed to send harness browser prompt')),
        Effect.withSpan('tmnl.harness.runtime.browser.send'),
      )

    const getSnapshot: HarnessRuntimeShape['getSnapshot'] = (sessionId, fromSeq) =>
      requestData(
        transport,
        {
          _tag: 'remote:chat_v2_get_snapshot',
          sessionId,
          fromSeq: optionToOptionalField(fromSeq),
        },
        HarnessRemoteSnapshotPayload,
      ).pipe(
        Effect.map((snapshot) => new HarnessSnapshot(snapshot)),
        Effect.mapError(toRuntimeError('snapshot-failed', 'Failed to get harness browser snapshot')),
        Effect.withSpan('tmnl.harness.runtime.browser.get-snapshot'),
      )

    const abortSession: HarnessRuntimeShape['abortSession'] = (sessionId) =>
      requestData(
        transport,
        {
          _tag: 'remote:chat_v2_abort',
          sessionId,
        },
        Schema.Unknown,
      ).pipe(
        Effect.asVoid,
        Effect.mapError(toRuntimeError('abort-failed', 'Failed to abort harness browser session')),
        Effect.withSpan('tmnl.harness.runtime.browser.abort-session'),
      )

    const respondExtensionUI: HarnessRuntimeShape['respondExtensionUI'] = (sessionId, response) =>
      requestData(
        transport,
        {
          _tag: 'remote:chat_v2_respond_extension_ui',
          sessionId,
          response,
        },
        Schema.Unknown,
      ).pipe(
        Effect.asVoid,
        Effect.mapError(toRuntimeError('extension-ui-failed', 'Failed to route harness browser extension UI response')),
        Effect.withSpan('tmnl.harness.runtime.browser.respond-extension-ui'),
      )

    const events = transport.events.pipe(
      Stream.flatMap((raw) =>
        Stream.fromEffect(
          decodeOrFail(HarnessRemoteEventEnvelope, raw).pipe(
            Effect.flatMap((eventEnvelope) =>
              eventEnvelope._tag === 'remote:chat_v2_event'
                ? decodeOrFail(HarnessEvent, eventEnvelope.event, 'remote:chat_v2_event').pipe(
                    Effect.map(Option.some),
                  )
                : Effect.succeed(Option.none()),
            ),
          ),
        ),
      ),
      Stream.filterMap((maybe) => maybe),
      Stream.mapError(toRuntimeError('events-failed', 'Harness browser event stream failed')),
    )

    return HarnessRuntime.of({
      backend: 'pi-ai',
      openSession,
      resumeSession,
      send,
      getSnapshot,
      abortSession,
      respondExtensionUI,
      events,
    } satisfies HarnessRuntimeShape)
  }),
)

export const HarnessRuntimeBrowserWebSocketDefault = HarnessRuntimeBrowserLive.pipe(
  Layer.provide(HarnessBrowserTransportWebSocketDefault),
)
