/**
 * Terminal WebSocket Relay Server
 *
 * Backend-agnostic WebSocket server for terminal sessions.
 * Works with any TerminalBackend (PTY, SSH) via Layer.provide.
 *
 * Usage:
 * ```typescript
 * // PTY Server
 * const PtyServerLive = TerminalServerLive.pipe(
 *   Layer.provide(TerminalSessionManagerLive),
 *   Layer.provide(PtyBackendLive)
 * )
 *
 * // SSH Server - just swap the backend Layer!
 * const SshServerLive = TerminalServerLive.pipe(
 *   Layer.provide(TerminalSessionManagerLive),
 *   Layer.provide(SshBackendLive)
 * )
 *
 * // Run
 * Effect.runPromise(Layer.launch(PtyServerLive))
 * ```
 */

import { Effect, Layer, Stream, Option, Schema } from 'effect'
import * as HttpServer from '@effect/platform/HttpServer'
import * as HttpRouter from '@effect/platform/HttpRouter'
import * as HttpServerRequest from '@effect/platform/HttpServerRequest'
import * as HttpServerResponse from '@effect/platform/HttpServerResponse'
import { BunHttpServer, BunContext } from '@effect/platform-bun'
import { TerminalSessionManager, type TerminalSessionManagerShape } from './TerminalSessionManager'
import type { TerminalConfig } from './schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Protocol Schemas (same as before, but backend-agnostic)
// ─────────────────────────────────────────────────────────────────────────────

const ClientData = Schema.TaggedStruct('ClientData', {
  data: Schema.String,
})

const ClientResize = Schema.TaggedStruct('ClientResize', {
  cols: Schema.Number.pipe(Schema.int(), Schema.positive()),
  rows: Schema.Number.pipe(Schema.int(), Schema.positive()),
})

const ClientPing = Schema.TaggedStruct('ClientPing', {
  timestamp: Schema.Number,
})

const ClientMessage = Schema.Union(ClientData, ClientResize, ClientPing)

const ServerData = Schema.TaggedStruct('ServerData', {
  data: Schema.String,
})

const ServerReady = Schema.TaggedStruct('ServerReady', {
  sessionId: Schema.String,
  backend: Schema.String,
  cols: Schema.Number,
  rows: Schema.Number,
  pid: Schema.optional(Schema.Number),  // PTY only
  host: Schema.optional(Schema.String), // SSH only
})

const ServerExit = Schema.TaggedStruct('ServerExit', {
  exitCode: Schema.Number,
  signal: Schema.optional(Schema.Union(Schema.Number, Schema.String)),
  reason: Schema.optional(Schema.String),
})

const ServerError = Schema.TaggedStruct('ServerError', {
  message: Schema.String,
  code: Schema.optional(Schema.String),
})

const ServerPong = Schema.TaggedStruct('ServerPong', {
  timestamp: Schema.Number,
  serverTime: Schema.Number,
})

const ServerMessage = Schema.Union(ServerData, ServerReady, ServerExit, ServerError, ServerPong)

// ─────────────────────────────────────────────────────────────────────────────
// Message Encoding/Decoding
// ─────────────────────────────────────────────────────────────────────────────

const encodeServerMessage = Schema.encodeSync(Schema.parseJson(ServerMessage))
const decodeClientMessage = Schema.decodeUnknown(Schema.parseJson(ClientMessage))

const sendMessage = (
  write: (chunk: Uint8Array | string) => Effect.Effect<boolean>,
  msg: typeof ServerMessage.Type
) =>
  Effect.gen(function* () {
    const json = encodeServerMessage(msg)
    yield* write(json)
  })

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Handler
// ─────────────────────────────────────────────────────────────────────────────

const handleWebSocket = (sessionId: string | null, config: TerminalConfig) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const manager = yield* TerminalSessionManager

    // Upgrade to WebSocket
    const socket = yield* request.upgrade

    // Get writer
    const write = yield* socket.writer

    // Create or get session
    const sessionInfo = sessionId
      ? yield* manager.getSession(sessionId).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new Error(`Session ${sessionId} not found`)),
              onSome: (s) =>
                Effect.succeed({
                  id: s.id,
                  backend: s.backend,
                  cols: s.handle.cols,
                  rows: s.handle.rows,
                  pid: s.handle.pid,
                  status: s.status,
                  createdAt: s.createdAt,
                }),
            })
          )
        )
      : yield* manager.createSession(config)

    const handleOpt = yield* manager.getHandle(sessionInfo.id)
    if (Option.isNone(handleOpt)) {
      yield* sendMessage(write, ServerError.make({ message: 'Session not found' }))
      return HttpServerResponse.empty()
    }
    const handle = handleOpt.value

    // Send ready message
    yield* sendMessage(
      write,
      ServerReady.make({
        sessionId: sessionInfo.id,
        backend: sessionInfo.backend,
        cols: sessionInfo.cols,
        rows: sessionInfo.rows,
        pid: sessionInfo.pid,
        host: 'host' in sessionInfo ? (sessionInfo as any).host : undefined,
      })
    )

    // Fork as daemon: Stream terminal output to WebSocket
    yield* Effect.forkDaemon(
      handle.output.pipe(
        Stream.mapEffect((data) => sendMessage(write, ServerData.make({ data }))),
        Stream.runDrain
      )
    )

    // Give daemon fiber a chance to start
    yield* Effect.sleep('10 millis')

    // Fork as daemon: Watch for terminal exit
    yield* Effect.forkDaemon(
      Effect.gen(function* () {
        const exit = yield* handle.exited
        yield* sendMessage(
          write,
          ServerExit.make({
            exitCode: exit.exitCode,
            signal: exit.signal,
            reason: exit.reason,
          })
        )
      })
    )

    // Handle incoming WebSocket messages using Effect patterns
    const messageHandler = (data: Uint8Array) =>
      decodeClientMessage(new TextDecoder().decode(data)).pipe(
        Effect.tap((msg) => Effect.log(`[Server] Received message: ${msg._tag}`)),
        Effect.flatMap((msg) => {
          switch (msg._tag) {
            case 'ClientData':
              return Effect.gen(function* () {
                yield* Effect.log(`[Server] ClientData: ${JSON.stringify(msg.data)}`)
                yield* handle.write(msg.data)
              })

            case 'ClientResize':
              return handle.resize(msg.cols, msg.rows)

            case 'ClientPing':
              return sendMessage(
                write,
                ServerPong.make({
                  timestamp: msg.timestamp,
                  serverTime: Date.now(),
                })
              )
          }
        }),
        Effect.catchAll((e) => Effect.logWarning('Failed to parse client message', e))
      )

    yield* socket.run(messageHandler)

    return HttpServerResponse.empty()
  })

// ─────────────────────────────────────────────────────────────────────────────
// Router Factory (captures TerminalSessionManager from context)
// ─────────────────────────────────────────────────────────────────────────────

const makeRouter = (manager: TerminalSessionManagerShape) =>
  HttpRouter.empty.pipe(
    // Health check
    HttpRouter.get('/health', HttpServerResponse.json({ status: 'ok' })),

    // List sessions
    HttpRouter.get(
      '/sessions',
      manager.listSessions().pipe(
        Effect.map((sessions) =>
          sessions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() }))
        ),
        Effect.flatMap((sessions) =>
          HttpServerResponse.json({ backend: manager.backendType, sessions })
        )
      )
    ),

    // Create new session via WebSocket (PTY mode - shell params)
    HttpRouter.get(
      '/ws',
      Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest
        const url = new URL(request.url, 'http://localhost')

        // PTY config from query params
        const config: TerminalConfig = {
          shell: url.searchParams.get('shell') ?? undefined,
          cols: url.searchParams.has('cols')
            ? parseInt(url.searchParams.get('cols')!, 10)
            : undefined,
          rows: url.searchParams.has('rows')
            ? parseInt(url.searchParams.get('rows')!, 10)
            : undefined,
          cwd: url.searchParams.get('cwd') ?? undefined,
        }

        return yield* handleWebSocket(null, config).pipe(
          Effect.provideService(TerminalSessionManager, manager)
        )
      })
    ),

    // Attach to existing session
    HttpRouter.get(
      '/ws/:sessionId',
      Effect.gen(function* () {
        const params = yield* HttpRouter.params
        const sessionId = params.sessionId

        return yield* handleWebSocket(sessionId, {}).pipe(
          Effect.provideService(TerminalSessionManager, manager)
        )
      })
    ),

    // Delete session
    HttpRouter.del(
      '/sessions/:sessionId',
      HttpRouter.params.pipe(
        Effect.flatMap(({ sessionId }) => manager.destroySession(sessionId)),
        Effect.flatMap((deleted) =>
          deleted
            ? HttpServerResponse.json({ deleted: true })
            : HttpServerResponse.json({ error: 'Session not found' }, { status: 404 })
        )
      )
    )
  )

// ─────────────────────────────────────────────────────────────────────────────
// Server Layer (requires TerminalSessionManager)
// ─────────────────────────────────────────────────────────────────────────────

const makeServer = Effect.gen(function* () {
  // Capture manager from Layer context at construction time
  const manager = yield* TerminalSessionManager
  yield* Effect.log(`[Server] Manager captured: backend=${manager.backendType}`)
  const router = makeRouter(manager)

  return router
})

export const TerminalServerLive = Layer.unwrapEffect(
  makeServer.pipe(
    Effect.map((router) =>
      router.pipe(
        HttpServer.serve(),
        HttpServer.withLogAddress,
        Layer.provide(BunHttpServer.layer({ port: 7681 })),
        Layer.provide(BunContext.layer)
      )
    )
  )
)

// ─────────────────────────────────────────────────────────────────────────────
// Runnable Entry Point
// ─────────────────────────────────────────────────────────────────────────────

export const runTerminalServer = Effect.gen(function* () {
  const manager = yield* TerminalSessionManager
  yield* Effect.log(`Terminal WebSocket Relay starting on ws://localhost:7681`)
  yield* Effect.log(`Backend: ${manager.backendType}`)
  yield* Effect.log('Endpoints:')
  yield* Effect.log('  GET  /health         - Health check')
  yield* Effect.log('  GET  /sessions       - List active sessions')
  yield* Effect.log('  GET  /ws             - Create new session (WebSocket)')
  yield* Effect.log('  GET  /ws/:sessionId  - Attach to session (WebSocket)')
  yield* Effect.log('  DELETE /sessions/:id - Destroy session')
})
