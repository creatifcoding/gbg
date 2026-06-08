import {
  Cause,
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
  HarnessRemoteModelListPayload,
  HarnessRemoteResponse,
  HarnessRemoteSendAckPayload,
  HarnessRemoteSessionPayload,
  HarnessRemoteSnapshotPayload,
  HarnessRemoteSessionListPayload,
  HarnessRemoteSessionMetaUpdatedPayload,
  HarnessRemoteSessionDeletedPayload,
  HarnessRemoteSessionForkedPayload,
  HarnessRemotePiSessionListPayload,
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

const browserLogDebug = Effect.fn('tmnl.harness.runtime.browser.log.debug')(function* (
  message: string,
  payload?: Record<string, unknown>,
) {
  yield* Effect.logDebug(message).pipe(
    payload === undefined
      ? Effect.annotateLogs({ area: 'harness-runtime-browser' })
      : Effect.annotateLogs({ ...payload, area: 'harness-runtime-browser' }),
  )
})

const isInterruptedCause = (cause: unknown): boolean =>
  Cause.isCause(cause) && Cause.isInterruptedOnly(cause)

const browserCauseToMessage = Effect.fn('tmnl.harness.runtime.browser.cause-to-message')(function* (cause: unknown) {
  if (Cause.isCause(cause)) {
    return Cause.pretty(cause)
  }

  if (typeof cause === 'string') {
    return cause
  }

  if (cause instanceof Error) {
    return cause.message
  }

  return yield* Effect.sync(() => {
    if (cause == null) {
      return 'unknown'
    }

    try {
      return JSON.stringify(cause)
    } catch {
      return String(cause)
    }
  })
})

const browserLogWarningCause = Effect.fn('tmnl.harness.runtime.browser.log.warning-cause')(function* (
  message: string,
  cause: unknown,
  payload?: Record<string, unknown>,
) {
  if (isInterruptedCause(cause)) {
    yield* browserLogDebug(`${message}:interrupted`, payload)
    return
  }

  const causeMessage = yield* browserCauseToMessage(cause)
  yield* Effect.logWarning(message).pipe(
    payload === undefined
      ? Effect.annotateLogs({ area: 'harness-runtime-browser', cause: causeMessage })
      : Effect.annotateLogs({ ...payload, area: 'harness-runtime-browser', cause: causeMessage }),
  )
})

const requestData = <A>(
  transport: {
    readonly request: (command: unknown) => Effect.Effect<unknown, HarnessBrowserTransportError>
  },
  command: Record<string, unknown> & { _tag: string },
  dataSchema: Schema.Schema<A>,
): Effect.Effect<A, HarnessBrowserTransportError | HarnessBrowserProtocolError> =>
  Effect.gen(function* () {
    yield* browserLogDebug('request:dispatch', {
      command: command._tag,
    })

    const rawResponse = yield* transport.request(command).pipe(
      Effect.withSpan('tmnl.harness.runtime.browser.transport.request', {
        attributes: {
          command: command._tag,
        },
      }),
    )

    const response = yield* decodeOrFail(HarnessRemoteResponse, rawResponse, command._tag)

    if (!response.ok) {
      yield* browserLogDebug('request:remote-failure', {
        command: command._tag,
        message: response.message,
      })

      return yield* Effect.fail(
        new HarnessBrowserProtocolError({
          message: response.message,
          commandTag: Option.some(command._tag),
          cause: Option.fromNullable(response.cause),
        }),
      )
    }

    return yield* decodeOrFail(dataSchema, response.data, command._tag)
  }).pipe(
    Effect.withSpan('tmnl.harness.runtime.browser.request-data', {
      attributes: {
        command: command._tag,
      },
    }),
  )

const toRuntimeError =
  (code: string, message: string) =>
  (cause: HarnessBrowserTransportError | HarnessBrowserProtocolError): HarnessRuntimeError =>
    new HarnessRuntimeError({
      code,
      message,
      cause: Option.some(cause),
    })

const traceRuntimeFailure = (op: string, command: string) =>
  Effect.tapErrorCause((cause) =>
    browserLogWarningCause('runtime-op-failed', cause, {
      op,
      command,
    }),
  )

export const HarnessRuntimeBrowserLive = Layer.effect(
  HarnessRuntime,
  Effect.gen(function* () {
    const transport = yield* HarnessBrowserTransport

    const openSession: HarnessRuntimeShape['openSession'] = (nodeId, role, options) =>
      requestData(
        transport,
        {
          _tag: 'remote:chat_v2_open_session',
          nodeId,
          role,
          ...(options?.forceNew === undefined ? {} : { forceNew: options.forceNew }),
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
        traceRuntimeFailure('open-session', 'remote:chat_v2_open_session'),
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
        traceRuntimeFailure('resume-session', 'remote:chat_v2_resume_session'),
        Effect.mapError(toRuntimeError('resume-session-failed', 'Failed to resume harness browser session')),
        Effect.withSpan('tmnl.harness.runtime.browser.resume-session'),
      )

    const send: HarnessRuntimeShape['send'] = (sessionId, clientMessageId, text, thinkingLevel, modelOverride?) =>
      requestData(
        transport,
        {
          _tag: 'remote:chat_v2_send' as const,
          sessionId,
          clientMessageId,
          text,
          thinkingLevel: optionToOptionalField(thinkingLevel),
          ...(modelOverride ? { modelOverride } : {}),
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
        traceRuntimeFailure('send', 'remote:chat_v2_send'),
        Effect.mapError(toRuntimeError('send-failed', 'Failed to send harness browser prompt')),
        Effect.withSpan('tmnl.harness.runtime.browser.send'),
      )

    const getAvailableModels: HarnessRuntimeShape['getAvailableModels'] = () =>
      requestData(
        transport,
        { _tag: 'remote:get_available_models' as const },
        HarnessRemoteModelListPayload,
      ).pipe(
        Effect.map((payload) => payload.models),
        traceRuntimeFailure('get-available-models', 'remote:get_available_models'),
        Effect.mapError(toRuntimeError('models-failed', 'Failed to get available models from harness')),
        Effect.withSpan('tmnl.harness.runtime.browser.get-available-models'),
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
        traceRuntimeFailure('get-snapshot', 'remote:chat_v2_get_snapshot'),
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
        traceRuntimeFailure('abort-session', 'remote:chat_v2_abort'),
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
        traceRuntimeFailure('respond-extension-ui', 'remote:chat_v2_respond_extension_ui'),
        Effect.mapError(toRuntimeError('extension-ui-failed', 'Failed to route harness browser extension UI response')),
        Effect.withSpan('tmnl.harness.runtime.browser.respond-extension-ui'),
      )

    const listSessions: HarnessRuntimeShape['listSessions'] = () =>
      requestData(
        transport,
        { _tag: 'remote:list_sessions' as const },
        HarnessRemoteSessionListPayload,
      ).pipe(
        Effect.map((payload) => payload.sessions),
        traceRuntimeFailure('list-sessions', 'remote:list_sessions'),
        Effect.mapError(toRuntimeError('list-sessions-failed', 'Failed to list harness browser sessions')),
        Effect.withSpan('tmnl.harness.runtime.browser.list-sessions'),
      )

    const updateSessionMeta: HarnessRuntimeShape['updateSessionMeta'] = (sessionId, patch) =>
      requestData(
        transport,
        {
          _tag: 'remote:update_session_meta' as const,
          sessionId,
          patch,
        },
        HarnessRemoteSessionMetaUpdatedPayload,
      ).pipe(
        Effect.asVoid,
        traceRuntimeFailure('update-session-meta', 'remote:update_session_meta'),
        Effect.mapError(toRuntimeError('update-session-meta-failed', 'Failed to update harness browser session metadata')),
        Effect.withSpan('tmnl.harness.runtime.browser.update-session-meta'),
      )

    const deleteSession: HarnessRuntimeShape['deleteSession'] = (sessionId) =>
      requestData(
        transport,
        {
          _tag: 'remote:delete_session' as const,
          sessionId,
        },
        HarnessRemoteSessionDeletedPayload,
      ).pipe(
        Effect.asVoid,
        traceRuntimeFailure('delete-session', 'remote:delete_session'),
        Effect.mapError(toRuntimeError('delete-session-failed', 'Failed to delete harness browser session')),
        Effect.withSpan('tmnl.harness.runtime.browser.delete-session'),
      )

    const forkSession: HarnessRuntimeShape['forkSession'] = (sessionId, atSeq?) =>
      requestData(
        transport,
        {
          _tag: 'remote:fork_session' as const,
          sessionId,
          ...(atSeq != null ? { atSeq } : {}),
        },
        HarnessRemoteSessionForkedPayload,
      ).pipe(
        Effect.map((payload) => ({ sessionId: payload.sessionId })),
        traceRuntimeFailure('fork-session', 'remote:fork_session'),
        Effect.mapError(toRuntimeError('fork-session-failed', 'Failed to fork harness browser session')),
        Effect.withSpan('tmnl.harness.runtime.browser.fork-session'),
      )

    const listPiSessions: HarnessRuntimeShape['listPiSessions'] = (options) =>
      requestData(
        transport,
        {
          _tag: 'remote:list_pi_sessions' as const,
          ...(options ? { options } : {}),
        },
        HarnessRemotePiSessionListPayload,
      ).pipe(
        traceRuntimeFailure('list-pi-sessions', 'remote:list_pi_sessions'),
        Effect.mapError(toRuntimeError('list-pi-sessions-failed', 'Failed to list pi CLI sessions')),
        Effect.withSpan('tmnl.harness.runtime.browser.list-pi-sessions'),
      )

    const loadPiSessionSnapshot: HarnessRuntimeShape['loadPiSessionSnapshot'] = (args) =>
      requestData(
        transport,
        {
          _tag: 'remote:load_pi_session_snapshot' as const,
          path: args.path,
          ...(args.sessionId ? { sessionId: args.sessionId } : {}),
        },
        HarnessRemoteSnapshotPayload,
      ).pipe(
        Effect.map((snapshot) => new HarnessSnapshot(snapshot)),
        traceRuntimeFailure('load-pi-session-snapshot', 'remote:load_pi_session_snapshot'),
        Effect.mapError(toRuntimeError('load-pi-session-failed', 'Failed to load pi CLI session snapshot')),
        Effect.withSpan('tmnl.harness.runtime.browser.load-pi-session-snapshot'),
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
      Stream.tapErrorCause((cause) =>
        browserLogWarningCause('events-stream-failed', cause, {
          op: 'events',
          command: 'remote:chat_v2_event',
        }),
      ),
      Stream.mapError(toRuntimeError('events-failed', 'Harness browser event stream failed')),
      Stream.withSpan('tmnl.harness.runtime.browser.events-stream'),
    )

    return HarnessRuntime.of({
      backend: 'pi-ai',
      openSession,
      resumeSession,
      send,
      getAvailableModels,
      getSnapshot,
      abortSession,
      respondExtensionUI,
      listSessions,
      updateSessionMeta,
      deleteSession,
      forkSession,
      listPiSessions,
      loadPiSessionSnapshot,
      events,
    } satisfies HarnessRuntimeShape)
  }),
)

export const HarnessRuntimeBrowserWebSocketDefault = HarnessRuntimeBrowserLive.pipe(
  Layer.provide(HarnessBrowserTransportWebSocketDefault),
)
