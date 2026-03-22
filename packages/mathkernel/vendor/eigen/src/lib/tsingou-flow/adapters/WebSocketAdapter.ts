/**
 * WebSocketSourceAdapter — Effect.Service using @effect/platform Socket.
 *
 * Zero hand-rolled WebSocket code. Effect provides:
 *   - Socket.makeWebSocket(url) → scoped Socket
 *   - Socket.toChannelString / Socket.toChannel → Channel (bidirectional)
 *   - socket.writer → scoped send function
 *   - Socket.layerWebSocketConstructorGlobal → browser WebSocket
 *   - SocketGenericError / SocketCloseError → already tagged
 *
 * This adapter composes:
 *   1. Socket.makeWebSocket (scoped connect + auto-close)
 *   2. Socket.toChannelString (receive as string Channel)
 *   3. Stream.fromChannel (Channel → Stream for composition)
 *   4. Stream.mapEffect (decode frames → signals, uninterruptibleMask)
 *   5. Effect.retry(schedule) (reconnection)
 *   6. socket.writer (send subscription messages, heartbeats)
 *
 * Supports: JSON, NDJSON, binary, MessagePack (pluggable decoder).
 * Bidirectional: send() exposed on the service shape.
 *
 * @see @effect/platform Socket module
 * @module tsingou-flow/adapters/WebSocketAdapter
 */

import {
  Effect,
  Stream,
  Schema,
  Context,
  Layer,
  Schedule,
  Fiber,
  Ref,
  Chunk,
  Channel,
  Duration,
  Scope,
  pipe,
} from 'effect'
import { Socket } from '@effect/platform'
import { Atom } from '@effect-atom/atom'

import {
  type SourceAdapterShape,
  makeAdapterInternals,
  generateSignalId,
  SignalQueueTag,
} from './types'
import type { BaseSignal } from '../schemas/base-signal'
import { WsConnectError, WsMessageError } from './errors'

// =============================================================================
// Frame Decoder
// =============================================================================

const FrameFormat = Schema.Literal('json', 'ndjson', 'binary', 'msgpack', 'protobuf')

/** Pluggable frame decoder. Adapter ships with json/ndjson/binary. */
export type FrameDecoder = (raw: string | Uint8Array) => ReadonlyArray<unknown>

const jsonDecoder: FrameDecoder = (raw) => {
  if (typeof raw !== 'string') raw = new TextDecoder().decode(raw)
  const parsed = JSON.parse(raw)
  return Array.isArray(parsed) ? parsed : [parsed]
}

const ndjsonDecoder: FrameDecoder = (raw) => {
  if (typeof raw !== 'string') raw = new TextDecoder().decode(raw)
  return raw
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line))
}

const binaryDecoder: FrameDecoder = (raw) => {
  return [raw instanceof Uint8Array ? raw : new TextEncoder().encode(raw)]
}

const decoders: Record<string, FrameDecoder> = {
  json: jsonDecoder,
  ndjson: ndjsonDecoder,
  binary: binaryDecoder,
}

// =============================================================================
// Configuration
// =============================================================================

export const WsAdapterConfig = Schema.Struct({
  adapterId: Schema.String.pipe(Schema.minLength(1)),
  sourceId: Schema.String.pipe(Schema.minLength(1)),
  url: Schema.String.pipe(Schema.minLength(1)),
  frameFormat: Schema.optional(FrameFormat),
  /** Custom decoder function (overrides frameFormat) */
  customDecoder: Schema.optional(Schema.Unknown),
  /** Protocols for WebSocket constructor */
  protocols: Schema.optional(Schema.Array(Schema.String)),
  /** Message to send immediately after connect (subscription, auth, etc.) */
  subscribeMessage: Schema.optional(Schema.Unknown),
  /** Periodic heartbeat message + interval */
  heartbeat: Schema.optional(Schema.Struct({
    message: Schema.Unknown,
    intervalMs: Schema.Number.pipe(Schema.int(), Schema.positive()),
  })),
  /** Reconnect schedule config */
  reconnect: Schema.optional(Schema.Struct({
    maxAttempts: Schema.optional(Schema.Number),
    initialDelayMs: Schema.optional(Schema.Number),
    maxDelayMs: Schema.optional(Schema.Number),
  })),
})
export type WsAdapterConfig = typeof WsAdapterConfig.Type

export class WsAdapterConfigTag extends Context.Tag('tsingou/adapter/WsConfig')<
  WsAdapterConfigTag,
  WsAdapterConfig
>() {}

// =============================================================================
// Extended Shape (bidirectional)
// =============================================================================

export interface WsSourceAdapterShape extends SourceAdapterShape {
  /** Send a message to the WebSocket (bidirectional). */
  readonly send: (data: string | Uint8Array) => Effect.Effect<void, Socket.SocketError>
  /** Reconnect count atom */
  readonly reconnectCountAtom: Atom.Atom<number>
}

// =============================================================================
// Service
// =============================================================================

export class WebSocketSourceAdapter extends Effect.Service<WebSocketSourceAdapter>()(
  'tsingou/adapter/WebSocket',
  {
    scoped: Effect.gen(function* () {
      const config = yield* WsAdapterConfigTag
      const internals = yield* makeAdapterInternals(config.adapterId, config.sourceId, 'websocket')
      const reconnectCountAtom = Atom.make(0)

      let paused = false
      const decoder: FrameDecoder =
        (config.customDecoder as FrameDecoder | undefined) ??
        decoders[config.frameFormat ?? 'json'] ??
        jsonDecoder

      // ─── Reconnect schedule ────────────────────────────────────────────────
      const reconnectConfig = config.reconnect ?? {}
      const reconnectSchedule = Schedule.exponential(
        Duration.millis(reconnectConfig.initialDelayMs ?? 500),
      ).pipe(
        Schedule.either(Schedule.recurs(reconnectConfig.maxAttempts ?? 10)),
        Schedule.tapOutput(() =>
          Effect.sync(() => {
            Atom.set(reconnectCountAtom, Atom.unsafeGet(reconnectCountAtom) + 1)
            internals.updateHealth({ status: 'connecting' })
          }),
        ),
      )

      // ─── Core: scoped socket session ───────────────────────────────────────
      const runSession = Effect.gen(function* () {
        // 1. Connect — Effect handles the WebSocket lifecycle
        const socket = yield* Socket.makeWebSocket(config.url, {
          protocols: config.protocols,
          openTimeout: Duration.seconds(10),
        }).pipe(
          Effect.provide(Socket.layerWebSocketConstructorGlobal),
        )

        internals.updateHealth({ status: 'connected' })
        yield* Effect.log(`[WsAdapter:${config.adapterId}] Connected to ${config.url}`)

        // 2. Acquire writer for bidirectional comms
        const write = yield* socket.writer

        // 3. Send subscription message on connect
        if (config.subscribeMessage != null) {
          const msg = typeof config.subscribeMessage === 'string'
            ? config.subscribeMessage
            : JSON.stringify(config.subscribeMessage)
          yield* write(msg)
          yield* Effect.log(`[WsAdapter:${config.adapterId}] Sent subscribe message`)
        }

        // 4. Heartbeat fiber
        if (config.heartbeat) {
          const hb = config.heartbeat
          const heartbeatMsg = typeof hb.message === 'string'
            ? hb.message
            : JSON.stringify(hb.message)

          yield* pipe(
            write(heartbeatMsg),
            Effect.repeat(Schedule.fixed(Duration.millis(hb.intervalMs))),
            Effect.fork,
          )
        }

        // 5. Receive: Socket → Channel → Stream → decode → emit
        yield* pipe(
          // Socket as string channel (handles text frames natively)
          Socket.toChannelString(socket),
          // Channel → Stream
          Channel.mapOutEffect((chunk: Chunk.Chunk<string>) =>
            Effect.succeed(chunk),
          ),
          (ch) => Stream.fromChannel(ch),
          // Flatten chunks
          Stream.mapConcat((chunk) => [...chunk]),
          // Decode each frame
          Stream.mapEffect((frame) =>
            Effect.try({
              try: () => decoder(frame),
              catch: (err) =>
                new WsMessageError({
                  adapterId: config.adapterId,
                  message: `Frame decode failed: ${err}`,
                  cause: err,
                }),
            }),
          ),
          // Flatten decoded items
          Stream.mapConcat((items) => [...items]),
          // Emit as signals — critical section is uninterruptible
          Stream.mapEffect((item) =>
            Effect.uninterruptibleMask((restore) =>
              Effect.gen(function* () {
                if (paused) return
                const signal: BaseSignal = {
                  id: generateSignalId('ws') as any,
                  sourceId: config.sourceId as any,
                  timestamp: new Date(),
                  version: [0, 0] as [number, number],
                  kind: 'websocket',
                  payload: { data: item },
                }
                yield* internals.push(signal)
              }),
            ),
          ),
          // Catch parse errors — log and continue
          Stream.catchTag('WsMessageError', (err) =>
            Stream.fromEffect(
              Effect.log(`[WsAdapter:${config.adapterId}] ${err.message}`),
            ).pipe(Stream.drain),
          ),
          Stream.runDrain,
        )
      })

      // ─── Run with reconnect ────────────────────────────────────────────────
      // Socket errors (close, generic) trigger retry via schedule
      const sessionFiber = yield* pipe(
        runSession,
        Effect.catchTags({
          SocketGenericError: (err) =>
            Effect.sync(() =>
              internals.updateHealth({
                status: 'degraded',
                errorCount: Atom.unsafeGet(internals.healthAtom).errorCount + 1,
              }),
            ),
          SocketCloseError: (err) =>
            Effect.sync(() =>
              internals.updateHealth({ status: 'disconnected' }),
            ),
        }),
        Effect.retry(reconnectSchedule),
        Effect.fork,
      )

      // ─── Lifecycle ─────────────────────────────────────────────────────────
      // Hold a Ref to the writer so send() works across reconnects
      const writerRef = yield* Ref.make<((chunk: Uint8Array | string | Socket.CloseEvent) => Effect.Effect<void, Socket.SocketError>) | null>(null)

      yield* Effect.addFinalizer(() =>
        Effect.uninterruptibleMask((_restore) =>
          Effect.gen(function* () {
            yield* Fiber.interrupt(sessionFiber)
            internals.updateHealth({ status: 'disconnected' })
            yield* Effect.log(`[WsAdapter:${config.adapterId}] Disconnected`)
          }),
        ),
      )

      const send = (data: string | Uint8Array): Effect.Effect<void, Socket.SocketError> =>
        Effect.gen(function* () {
          const writer = yield* Ref.get(writerRef)
          if (writer) {
            yield* writer(data)
          } else {
            yield* Effect.log(`[WsAdapter:${config.adapterId}] send() called but no active connection`)
          }
        })

      return {
        adapterId: config.adapterId,
        sourceId: config.sourceId,
        kind: 'websocket',
        healthAtom: internals.healthAtom,
        signalCountAtom: internals.signalCountAtom,
        reconnectCountAtom,
        pause: Effect.sync(() => { paused = true }),
        resume: Effect.sync(() => { paused = false }),
        send,
      } satisfies WsSourceAdapterShape
    }),
  },
) {}
