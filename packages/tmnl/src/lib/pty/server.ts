/**
 * PTY WebSocket Relay Server
 *
 * Effect Platform-native WebSocket server for PTY sessions.
 * Uses BunHttpServer with request.upgrade for WebSocket handling.
 *
 * Protocol:
 * - Connect to /ws/:sessionId to attach to existing session
 * - Connect to /ws with config in query params to create new session
 * - Messages are JSON-encoded ClientMessage/ServerMessage schemas
 */

import { Effect, Layer, Stream, Option, Schedule, Schema } from 'effect'
import * as HttpServer from '@effect/platform/HttpServer'
import * as HttpRouter from '@effect/platform/HttpRouter'
import * as HttpServerRequest from '@effect/platform/HttpServerRequest'
import * as HttpServerResponse from '@effect/platform/HttpServerResponse'
import * as Socket from '@effect/platform/Socket'
import { BunHttpServer, BunContext } from '@effect/platform-bun'
import { PtySessionManager, PtySessionManagerLive } from './services/PtySessionManager'
import { PtyBackend, BunPtyBackendLive } from './services/PtyBackend'
import {
  ClientMessage,
  ServerMessage,
  ServerData,
  ServerReady,
  ServerExit,
  ServerError,
  ServerPong,
  type PtyConfig,
} from './schemas'

// ─────────────────────────────────────────────────────────────────────────────
// Message Encoding/Decoding
// ─────────────────────────────────────────────────────────────────────────────

const encodeServerMessage = Schema.encodeSync(Schema.parseJson(ServerMessage))
const decodeClientMessage = Schema.decodeUnknown(Schema.parseJson(ClientMessage))

const sendMessage = (
  write: (chunk: Uint8Array | string | Socket.CloseEvent) => Effect.Effect<boolean>,
  msg: typeof ServerMessage.Type
) =>
  Effect.gen(function* () {
    const json = encodeServerMessage(msg)
    yield* write(json)
  })

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket Handler
// ─────────────────────────────────────────────────────────────────────────────

const handleWebSocket = (sessionId: string | null, config: PtyConfig) =>
  Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest
    const manager = yield* PtySessionManager

    // Upgrade to WebSocket
    const socket = yield* request.upgrade

    // Get writer
    const write = yield* socket.writer

    // Create or get session
    const sessionInfo = sessionId
      ? yield* manager.getSession(sessionId).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () =>
                Effect.fail(
                  new Error(`Session ${sessionId} not found`)
                ),
              onSome: (s) =>
                Effect.succeed({
                  id: s.id,
                  pid: s.handle.pid,
                  cols: s.handle.cols,
                  rows: s.handle.rows,
                  shell: s.config.shell ?? 'bash',
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
        pid: sessionInfo.pid,
        cols: sessionInfo.cols,
        rows: sessionInfo.rows,
      })
    )

    // Fork as daemon: Stream PTY output to WebSocket (runs independently of parent scope)
    yield* Effect.forkDaemon(
      handle.output.pipe(
        Stream.mapEffect((data) => sendMessage(write, ServerData.make({ data }))),
        Stream.runDrain
      )
    )

    // Give daemon fiber a chance to start
    yield* Effect.sleep('10 millis')

    // Fork as daemon: Watch for PTY exit
    yield* Effect.forkDaemon(
      Effect.gen(function* () {
        const exit = yield* handle.exited
        yield* sendMessage(
          write,
          ServerExit.make({ exitCode: exit.exitCode, signal: exit.signal })
        )
      })
    )

    // Handle incoming WebSocket messages using Effect patterns (no try/catch)
    const messageHandler = (data: Uint8Array) =>
      decodeClientMessage(new TextDecoder().decode(data)).pipe(
        Effect.flatMap((msg) => {
          switch (msg._tag) {
            case 'ClientData':
              return handle.write(msg.data)

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
        Effect.catchAll((e) =>
          Effect.logWarning('Failed to parse client message', e)
        )
      )

    yield* socket.run(messageHandler)

    return HttpServerResponse.empty()
  })

// ─────────────────────────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────────────────────────

const router = HttpRouter.empty.pipe(
  // Health check
  HttpRouter.get('/health', HttpServerResponse.json({ status: 'ok' })),

  // List sessions
  HttpRouter.get(
    '/sessions',
    Effect.gen(function* () {
      const manager = yield* PtySessionManager
      const sessions = yield* manager.listSessions()
      return HttpServerResponse.json(sessions)
    })
  ),

  // Create new session via WebSocket
  HttpRouter.get(
    '/ws',
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest
      const url = new URL(request.url, 'http://localhost')

      const config: PtyConfig = {
        shell: url.searchParams.get('shell') ?? undefined,
        cols: url.searchParams.has('cols')
          ? parseInt(url.searchParams.get('cols')!, 10)
          : undefined,
        rows: url.searchParams.has('rows')
          ? parseInt(url.searchParams.get('rows')!, 10)
          : undefined,
        cwd: url.searchParams.get('cwd') ?? undefined,
      }

      return yield* handleWebSocket(null, config)
    })
  ),

  // Attach to existing session
  HttpRouter.get(
    '/ws/:sessionId',
    Effect.gen(function* () {
      const params = yield* HttpRouter.params
      const sessionId = params.sessionId

      return yield* handleWebSocket(sessionId, {})
    })
  ),

  // Delete session
  HttpRouter.del(
    '/sessions/:sessionId',
    Effect.gen(function* () {
      const params = yield* HttpRouter.params
      const manager = yield* PtySessionManager
      const deleted = yield* manager.destroySession(params.sessionId)

      return deleted
        ? HttpServerResponse.json({ deleted: true })
        : HttpServerResponse.json({ error: 'Session not found' }, { status: 404 })
    })
  )
)

// ─────────────────────────────────────────────────────────────────────────────
// Server Layer
// ─────────────────────────────────────────────────────────────────────────────

const ServerLive = router.pipe(
  HttpServer.serve(),
  HttpServer.withLogAddress,
  Layer.provide(BunHttpServer.layer({ port: 7681 })),
  Layer.provide(BunContext.layer)
)

// Full stack with PTY services
export const PtyServerLive = ServerLive.pipe(
  Layer.provide(PtySessionManagerLive),
  Layer.provide(BunPtyBackendLive)
)

// ─────────────────────────────────────────────────────────────────────────────
// Runnable Entry Point
// ─────────────────────────────────────────────────────────────────────────────

export const runPtyServer = Effect.gen(function* () {
  yield* Effect.log('PTY WebSocket Relay starting on ws://localhost:7681')
  yield* Effect.log('Endpoints:')
  yield* Effect.log('  GET  /health         - Health check')
  yield* Effect.log('  GET  /sessions       - List active sessions')
  yield* Effect.log('  GET  /ws             - Create new session (WebSocket)')
  yield* Effect.log('  GET  /ws/:sessionId  - Attach to session (WebSocket)')
  yield* Effect.log('  DELETE /sessions/:id - Destroy session')
  yield* Layer.launch(PtyServerLive)
})
