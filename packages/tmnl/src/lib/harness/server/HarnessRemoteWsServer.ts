import {
  Cause,
  Effect,
  Either,
  Layer,
  Option,
  Queue,
  Schema,
  Stream,
} from 'effect'
import * as HttpRouter from '@effect/platform/HttpRouter'
import * as HttpServer from '@effect/platform/HttpServer'
import * as HttpServerRequest from '@effect/platform/HttpServerRequest'
import * as HttpServerResponse from '@effect/platform/HttpServerResponse'
import * as HttpMiddleware from '@effect/platform/HttpMiddleware'
import { BunContext, BunHttpServer } from '@effect/platform-bun'

import { HarnessRuntime } from '../HarnessRuntime'
import { HarnessRuntimeLive } from '../HarnessRuntimeLive'
import {
  HarnessWsRequestEnvelope,
  type HarnessWsResponseEnvelope,
  type HarnessWsEventEnvelope,
} from '../HarnessBrowserRemoteSchemas'
import {
  InteractiveShellService,
  translateInput,
  type ShellSessionId,
  type ShellEvent,
} from '../interactive-shell'
import { PanelEventBus } from '../panel-events/PanelEventBus'
import type { PanelEvent } from '@/lib/genifer/harness/panel-events'

const WS_PORT = 8787
const WS_PATH = '/api/harness/ws'

const decodeWsRequest = (raw: string) =>
  Effect.try({
    try: () => JSON.parse(raw),
    catch: (cause) => ({
      _tag: 'invalid-json' as const,
      cause,
    }),
  }).pipe(
    Effect.flatMap((parsed) =>
      Either.match(Schema.decodeUnknownEither(HarnessWsRequestEnvelope)(parsed), {
        onLeft: (cause) =>
          Effect.fail({
            _tag: 'invalid-envelope' as const,
            cause,
          }),
        onRight: Effect.succeed,
      }),
    ),
  )

const encodeJson = (value: unknown) =>
  Effect.try({
    try: () => JSON.stringify(value),
    catch: () =>
      JSON.stringify({
        _tag: 'remote:ws_response',
        requestId: 'encode-failure',
        response: { ok: false, message: 'Encoding failure', cause: null },
      }),
  })

const makeFailureResponse = (requestId: string, message: string): HarnessWsResponseEnvelope => ({
  _tag: 'remote:ws_response',
  requestId,
  response: {
    ok: false,
    message,
    cause: undefined,
  },
})

const makeSuccessResponse = (requestId: string, data: unknown): HarnessWsResponseEnvelope => ({
  _tag: 'remote:ws_response',
  requestId,
  response: {
    ok: true,
    data,
  },
})

const makeEventEnvelope = (event: Parameters<typeof makeSuccessResponse>[1]): HarnessWsEventEnvelope => ({
  _tag: 'remote:ws_event',
  event: {
    _tag: 'remote:chat_v2_event',
    event: event as any,
  },
})

const makeWsId = (): string => `hws-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const logDebug = Effect.fn('harness.ws.log.debug')(function* (
  wsId: string,
  message: string,
  payload?: Record<string, unknown>,
) {
  const annotations = payload === undefined ? { wsId } : { wsId, ...payload }
  yield* Effect.logDebug(message).pipe(Effect.annotateLogs(annotations))
})

const causeToMessage = Effect.fn('harness.ws.cause-to-message')(function* (cause: unknown) {
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
    if (cause === undefined || cause === null) {
      return 'unknown'
    }

    try {
      return JSON.stringify(cause)
    } catch {
      if (typeof cause === 'object' && 'toString' in cause) {
        return String(cause.toString())
      }
      return String(cause)
    }
  })
})

const logWarningCause = Effect.fn('harness.ws.log.warning-cause')(function* (
  wsId: string,
  message: string,
  cause: unknown,
  payload?: Record<string, unknown>,
) {
  const causeMessage = yield* causeToMessage(cause)
  const annotations = payload === undefined
    ? { wsId, cause: causeMessage }
    : { wsId, cause: causeMessage, ...payload }
  yield* Effect.logWarning(message).pipe(Effect.annotateLogs(annotations))
})

const normalizeCommandTag = (value: unknown) => (typeof value === 'string' ? value : 'unknown')

const decodeChunkPayload = Effect.fn('harness.ws.decode-inbound')(function* (raw: string) {
  return yield* decodeWsRequest(raw).pipe(
    Effect.withSpan('harness.ws.decode-inbound', {
      attributes: {
        direction: 'inbound',
      },
    }),
  )
})

const handleRemoteWs = Effect.gen(function* () {
  const runtime = yield* HarnessRuntime
  const request = yield* HttpServerRequest.HttpServerRequest
  const wsId = makeWsId()

  const socket = yield* request.upgrade
  yield* logDebug(wsId, 'connected')

  const outbound = yield* Queue.unbounded<string>()

  const send = Effect.fn('harness.ws.send')(function* (payload: unknown) {
    yield* logDebug(wsId, 'queue-push', {
      kind: 'outbound',
      tag: (payload as { _tag?: unknown })._tag ?? 'payload',
    })
    const json = yield* encodeJson(payload)
    yield* Queue.offer(outbound, json)
  })

  const safeSend = (payload: unknown, tag: string) =>
    send(payload).pipe(
      Effect.catchAllCause((cause) =>
        logWarningCause(
          wsId,
          'send-effect-failed',
          cause,
          {
            kind: 'outbound-send',
            tag,
          },
        ).pipe(Effect.asVoid),
      ),
    )

  yield* Effect.forkScoped(
    Effect.gen(function* () {
      const write = yield* socket.writer
      yield* Stream.runForEach(
        Stream.fromQueue(outbound),
        (json) => write(json).pipe(Effect.asVoid),
      )
    }).pipe(
      Effect.withSpan('harness.ws.outbound-writer-loop'),
      Effect.catchAllCause((cause) =>
        logWarningCause(
          wsId,
          'outbound-writer-loop-stopped',
          cause,
        ),
      ),
    ),
  )

  const emitRuntimeEvent = (event: unknown) => {
    // Latency probe: embed ws_send timestamp in event for cross-process reconstruction
    ;(event as any)._wsSendAt = Date.now()

    return safeSend(makeEventEnvelope(event), 'runtime:event').pipe(
      Effect.catchAllCause((cause) =>
        logWarningCause(
          wsId,
          'runtime-event-relay-failed',
          cause,
        ).pipe(Effect.asVoid),
      ),
    )
  }

  yield* Effect.forkScoped(
    Stream.runForEach(runtime.events, emitRuntimeEvent).pipe(
      Effect.withSpan('harness.ws.runtime-events-loop'),
      Effect.catchAllCause((cause) =>
        logWarningCause(
          wsId,
          'runtime-events-stream-stopped',
          cause,
        ),
      ),
    ),
  )

  // ── Interactive shell service + event relay ──────────────────────────
  // Shared singleton from HarnessRuntimeLive Layer graph — same instance
  // that the tool executor uses. Events emitted by tool-triggered spawns
  // are relayed to the WS client via this same service's event stream.
  const shellServiceResult = yield* InteractiveShellService.pipe(
    Effect.option,
    Effect.catchAll(() => Effect.succeed(Option.none())),
    Effect.map(Option.getOrNull),
  )

  const makeShellEventEnvelope = (event: ShellEvent) => ({
    _tag: 'remote:ws_event' as const,
    event: {
      _tag: 'remote:shell_event' as const,
      event,
    },
  })

  const makePanelEventEnvelope = (event: PanelEvent) => ({
    _tag: 'remote:ws_event' as const,
    event: {
      _tag: 'remote:panel_event' as const,
      event,
    },
  })

  // Relay shell events to WS client
  const emitShellEvent = (event: unknown) =>
    safeSend(makeShellEventEnvelope(event), 'shell:event').pipe(
      Effect.withSpan('harness.ws.shell-events-send'),
      Effect.catchAllCause((cause) =>
        logWarningCause(
          wsId,
          'shell-event-relay-failed',
          cause,
        ).pipe(Effect.asVoid),
      ),
    )

  if (shellServiceResult) {
    yield* Effect.forkScoped(
      Stream.runForEach(shellServiceResult.events, emitShellEvent).pipe(
        Effect.withSpan('harness.ws.shell-events-loop'),
        Effect.catchAllCause((cause) =>
          logWarningCause(
            wsId,
            'shell-events-stream-stopped',
            cause,
          ),
        ),
      ),
    )
  }

  // Panel event bus + relay (spawn_panel tool emits here)
  const panelEventBus = yield* PanelEventBus.pipe(
    Effect.option,
    Effect.catchAll(() => Effect.succeed(Option.none())),
    Effect.map(Option.getOrNull),
  )

  const emitPanelEvent = (event: unknown) =>
    safeSend(makePanelEventEnvelope(event), 'panel:event').pipe(
      Effect.withSpan('harness.ws.panel-events-send'),
      Effect.catchAllCause((cause) =>
        logWarningCause(
          wsId,
          'panel-event-relay-failed',
          cause,
        ).pipe(Effect.asVoid),
      ),
    )

  if (panelEventBus) {
    yield* Effect.forkScoped(
      Stream.runForEach(panelEventBus.events, emitPanelEvent).pipe(
        Effect.withSpan('harness.ws.panel-events-loop'),
        Effect.catchAllCause((cause) =>
          logWarningCause(
            wsId,
            'panel-events-stream-stopped',
            cause,
          ),
        ),
      ),
    )
  }

  // Shell service helper functions (no-op if service unavailable)
  const shellWrite = (sessionId: ShellSessionId, data: string) =>
    shellServiceResult
      ? shellServiceResult.write(sessionId, data)
      : Effect.fail({ _tag: 'SessionNotFoundError' as const, sessionId: sessionId as string, message: 'Shell service unavailable' })

  const shellResize = (sessionId: ShellSessionId, cols: number, rows: number) =>
    shellServiceResult
      ? shellServiceResult.resize(sessionId, cols, rows)
      : Effect.fail({ _tag: 'SessionNotFoundError' as const, sessionId: sessionId as string, message: 'Shell service unavailable' })

  const shellKill = (sessionId: ShellSessionId, signal?: number) =>
    shellServiceResult
      ? shellServiceResult.kill(sessionId, signal)
      : Effect.fail({ _tag: 'SessionNotFoundError' as const, sessionId: sessionId as string, message: 'Shell service unavailable' })

  const shellTakeControl = (sessionId: ShellSessionId) =>
    shellServiceResult
      ? shellServiceResult.takeControl(sessionId)
      : Effect.fail({ _tag: 'SessionNotFoundError' as const, sessionId: sessionId as string, message: 'Shell service unavailable' })

  const shellYieldControl = (sessionId: ShellSessionId) =>
    shellServiceResult
      ? shellServiceResult.yieldControl(sessionId)
      : Effect.fail({ _tag: 'SessionNotFoundError' as const, sessionId: sessionId as string, message: 'Shell service unavailable' })

  const shellSwitchMode = (sessionId: ShellSessionId, mode: string) =>
    shellServiceResult
      ? shellServiceResult.switchMode(sessionId, mode as any)
      : Effect.fail({ _tag: 'SessionNotFoundError' as const, sessionId: sessionId as string, message: 'Shell service unavailable' })

  const handleIncomingChunk = Effect.fn('harness.ws.handle-incoming-chunk')(function* (chunk: string | Uint8Array) {
    const raw = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
    yield* logDebug(
      wsId,
      'inbound-chunk-received',
      {
        rawBytes: raw.length,
      },
    )

    const decoded = yield* decodeChunkPayload(raw).pipe(Effect.either)

    if (decoded._tag === 'Left') {
      yield* logWarningCause(
        wsId,
        'inbound-chunk-decode-failed',
        decoded.left,
      )
      yield* safeSend(makeFailureResponse('invalid-request', 'Malformed harness websocket envelope'), 'response:invalid-envelope')
      return
    }

    const envelope = decoded.right
    const commandTag = normalizeCommandTag((envelope as { command?: unknown }).command?._tag)

    yield* logDebug(wsId, 'inbound-command', {
      requestId: envelope.requestId,
      command: commandTag,
    })

    const result = yield* Effect.gen(function* () {
      const command = envelope.command

      switch (command._tag) {
        case 'remote:chat_v2_open_session':
          return yield* runtime.openSession(command.nodeId, command.role, {
            forceNew: command.forceNew,
          })
        case 'remote:chat_v2_resume_session':
          return yield* runtime.resumeSession(command.sessionId, Option.fromNullable(command.fromSeq))
        case 'remote:chat_v2_send':
          return yield* runtime.send(
            command.sessionId,
            command.clientMessageId,
            command.text,
            Option.fromNullable(command.thinkingLevel),
            command.modelOverride,
          )
        case 'remote:chat_v2_get_snapshot':
          return yield* runtime.getSnapshot(command.sessionId, Option.fromNullable(command.fromSeq))
        case 'remote:chat_v2_abort': {
          yield* runtime.abortSession(command.sessionId)
          return {}
        }
        case 'remote:chat_v2_respond_extension_ui': {
          yield* runtime.respondExtensionUI(command.sessionId, command.response)
          return {}
        }
        case 'remote:get_available_models':
          return yield* runtime.getAvailableModels().pipe(
            Effect.map((models) => ({ models })),
          )
        case 'remote:list_sessions': {
          const sessions = yield* runtime.listSessions()
          return { sessions }
        }
        case 'remote:update_session_meta': {
          yield* runtime.updateSessionMeta(command.sessionId, command.patch)
          return { ok: true }
        }
        case 'remote:delete_session': {
          yield* runtime.deleteSession(command.sessionId)
          return { ok: true }
        }
        case 'remote:fork_session': {
          const result = yield* runtime.forkSession(command.sessionId, command.atSeq)
          return result
        }

        // ── Interactive shell commands ──────────────────────────────────
        case 'remote:shell_input': {
          // Translate structured input (inputKeys, inputHex, inputPaste) server-side
          const hasStructuredInput =
            command.inputKeys?.length || command.inputHex?.length || command.inputPaste
          const data = hasStructuredInput
            ? translateInput({
                text: command.data,
                keys: command.inputKeys,
                hex: command.inputHex,
                paste: command.inputPaste,
              })
            : (command.data ?? '')
          yield* shellWrite(command.sessionId as ShellSessionId, data)
          return {}
        }
        case 'remote:shell_resize': {
          yield* shellResize(command.sessionId as ShellSessionId, command.cols, command.rows)
          return {}
        }
        case 'remote:shell_kill': {
          yield* shellKill(command.sessionId as ShellSessionId, command.signal)
          return {}
        }
        case 'remote:shell_take_control': {
          yield* shellTakeControl(command.sessionId as ShellSessionId)
          return {}
        }
        case 'remote:shell_yield_control': {
          yield* shellYieldControl(command.sessionId as ShellSessionId)
          return {}
        }
        case 'remote:shell_switch_mode': {
          yield* shellSwitchMode(command.sessionId as ShellSessionId, command.mode)
          return {}
        }
      }
    }).pipe(
      Effect.withSpan('harness.ws.command-handler', {
        attributes: {
          command: commandTag,
          requestId: envelope.requestId,
        },
      }),
      Effect.either,
    )

    if (result._tag === 'Left') {
      const message = yield* causeToMessage(result.left)
      yield* logWarningCause(
        wsId,
        'command-failed',
        result.left,
        {
          requestId: envelope.requestId,
          command: commandTag,
          message,
        },
      )
      yield* safeSend(makeFailureResponse(envelope.requestId, message), `response:${commandTag}:failure`)
      return
    }

    yield* logDebug(
      wsId,
      'command-succeeded',
      {
        requestId: envelope.requestId,
        command: commandTag,
      },
    )
    yield* safeSend(makeSuccessResponse(envelope.requestId, result.right), `response:${commandTag}:ok`)
  })

  yield* socket.runRaw(
    (chunk) =>
      handleIncomingChunk(chunk).pipe(
        Effect.withSpan('harness.ws.socket.inbound-chunk', { attributes: { connection: wsId } }),
        Effect.catchAllCause((cause) =>
          logWarningCause(
            wsId,
            'socket-run-loop-frame-error',
            cause,
            {
              requestSize: (typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)).length,
            },
          ).pipe(Effect.asVoid),
        ),
      ),
  ).pipe(
    Effect.withSpan('harness.ws.socket-run-loop'),
    Effect.catchAllCause((cause) =>
      logWarningCause(
        wsId,
        'socket-loop-terminated',
        cause,
      ),
    ),
  )

  yield* logDebug(wsId, 'disconnected')
  return HttpServerResponse.empty()
}).pipe(
  Effect.withSpan('harness.ws.connection'),
)

const healthResponse = HttpServerResponse.json({ status: 'ok', service: 'harness-remote-ws' })

const makeAppRouter =
  HttpRouter.empty.pipe(
    HttpRouter.get('/health', healthResponse),
    HttpRouter.get('/api/harness/health', healthResponse),
    HttpRouter.get(WS_PATH, handleRemoteWs),
    HttpMiddleware.cors(),
  )

const makeRemoteWsServerLayer = makeAppRouter.pipe(
  HttpServer.serve(),
  HttpServer.withLogAddress,
  Layer.provide(BunHttpServer.layer({ port: WS_PORT })),
  Layer.provide(BunContext.layer),
)

export const HarnessRemoteWsServerLive = Layer.scopedDiscard(
  Layer.launch(makeRemoteWsServerLayer),
).pipe(
  Layer.provide(HarnessRuntimeLive),
)

export const runHarnessRemoteWsServer = Effect.fn('harness.server.run')(function* () {
  yield* Effect.logInfo('Harness remote WS server starting')
  yield* Effect.logInfo(`  [network] HTTP GET /health`)
  yield* Effect.logInfo(`  [network] HTTP GET /api/harness/health`)
  yield* Effect.logInfo(`  [network] WS upgrade GET ${WS_PATH}`)
  yield* Effect.logInfo(`  [network] bind 0.0.0.0:${WS_PORT}`)

  yield* Layer.launch(HarnessRemoteWsServerLive)
})
