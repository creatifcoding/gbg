import {
  Context,
  Effect,
  Either,
  Layer,
  Option,
  Queue,
  Schema,
  Scope,
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
  InteractiveShellServiceLive,
  type ShellSessionId,
  type ShellEvent,
} from '../interactive-shell'

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

const handleRemoteWs = Effect.gen(function* () {
  const runtime = yield* HarnessRuntime
  const request = yield* HttpServerRequest.HttpServerRequest
  const wsId = makeWsId()

  const socket = yield* request.upgrade
  yield* Effect.logInfo(`[harness-ws:${wsId}] connected`)

  const outbound = yield* Queue.unbounded<string>()

  const send = Effect.fn('harness.ws.send')(function* (payload: unknown) {
    const json = yield* encodeJson(payload)
    yield* Queue.offer(outbound, json)
  })

  yield* Effect.forkScoped(
    Effect.gen(function* () {
      const write = yield* socket.writer
      yield* Stream.runForEach(Stream.fromQueue(outbound), (json) => write(json).pipe(Effect.asVoid))
    }).pipe(
      Effect.withSpan('harness.ws.outbound-writer-loop'),
      Effect.catchAll((cause) =>
        Effect.logWarning(`[harness-ws:${wsId}] outbound writer loop stopped: ${String(cause)}`),
      ),
    ),
  )

  yield* Effect.forkScoped(
    Stream.runForEach(runtime.events, (event) => send(makeEventEnvelope(event))).pipe(
      Effect.withSpan('harness.ws.runtime-events-loop'),
      Effect.catchAll((cause) =>
        Effect.logWarning(`[harness-ws:${wsId}] runtime event stream stopped: ${String(cause)}`),
      ),
    ),
  )

  // ── Interactive shell service + event relay ──────────────────────────
  // Build the Layer within this WS connection's scope via Layer.buildWithScope.
  // Worker pool + PTY sessions are torn down when the connection scope closes.
  const parentScope = yield* Effect.scope
  const shellServiceResult = yield* Layer.buildWithScope(InteractiveShellServiceLive, parentScope).pipe(
    Effect.map((ctx) => Context.get(ctx, InteractiveShellService)),
    Effect.catchAll((e) => {
      console.warn(`[harness-ws:${wsId}] shell service unavailable:`, e)
      return Effect.succeed(null as typeof InteractiveShellService.Service | null)
    }),
  )

  const makeShellEventEnvelope = (event: ShellEvent) => ({
    _tag: 'remote:ws_event' as const,
    event: {
      _tag: 'remote:shell_event' as const,
      event,
    },
  })

  // Relay shell events to WS client
  if (shellServiceResult) {
    yield* Effect.forkScoped(
      Stream.runForEach(shellServiceResult.events, (event) =>
        send(makeShellEventEnvelope(event)),
      ).pipe(
        Effect.withSpan('harness.ws.shell-events-loop'),
        Effect.catchAll((cause) =>
          Effect.logWarning(`[harness-ws:${wsId}] shell event stream stopped: ${String(cause)}`),
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

  const handleIncomingChunk = Effect.fn('harness.ws.handle-incoming-chunk')(function* (chunk: string | Uint8Array) {
    const raw = typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)
    const decoded = yield* decodeWsRequest(raw).pipe(Effect.either)

    if (decoded._tag === 'Left') {
      yield* send(makeFailureResponse('invalid-request', 'Malformed harness websocket envelope'))
      return
    }

    const envelope = decoded.right

    const result = yield* Effect.gen(function* () {
      const command = envelope.command

      switch (command._tag) {
        case 'remote:chat_v2_open_session':
          return yield* runtime.openSession(command.nodeId, command.role)
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

        // ── Interactive shell commands ──────────────────────────────────
        case 'remote:shell_input': {
          yield* shellWrite(command.sessionId as ShellSessionId, command.data)
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
      }
    }).pipe(Effect.either)

    if (result._tag === 'Left') {
      const message = typeof (result.left as { message?: unknown }).message === 'string'
        ? (result.left as { message: string }).message
        : String(result.left)
      yield* send(makeFailureResponse(envelope.requestId, message))
      return
    }

    yield* send(makeSuccessResponse(envelope.requestId, result.right))
  })

  yield* socket.runRaw(handleIncomingChunk).pipe(
    Effect.withSpan('harness.ws.socket-run-loop'),
    Effect.catchAll((cause) =>
      Effect.logWarning(`[harness-ws:${wsId}] socket loop terminated: ${String(cause)}`),
    ),
  )

  yield* Effect.logInfo(`[harness-ws:${wsId}] disconnected`)
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
