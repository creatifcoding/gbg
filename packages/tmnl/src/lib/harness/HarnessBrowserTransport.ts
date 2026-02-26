import { nanoid } from 'nanoid'
import * as Socket from '@effect/platform/Socket'
import {
  Context,
  Deferred,
  Effect,
  Either,
  HashMap,
  Layer,
  Match,
  Option,
  PubSub,
  Ref,
  Schema,
  Stream,
} from 'effect'

import {
  HarnessWsIncomingEnvelope,
  HarnessWsOutgoingEnvelope,
  type HarnessRemoteCommand,
} from './HarnessBrowserRemoteSchemas'

export class HarnessBrowserTransportError extends Schema.TaggedError<HarnessBrowserTransportError>()(
  'HarnessBrowserTransportError',
  {
    message: Schema.String,
    cause: Schema.optionalWith(Schema.Unknown, { as: 'Option' }),
  },
) {}

export interface HarnessBrowserTransportShape {
  readonly request: (command: HarnessRemoteCommand) => Effect.Effect<unknown, HarnessBrowserTransportError>
  readonly events: Stream.Stream<unknown, HarnessBrowserTransportError>
}

export const HarnessBrowserTransport = Context.GenericTag<HarnessBrowserTransportShape>(
  'tmnl/harness/HarnessBrowserTransport',
)

export interface HarnessBrowserTransportConfigShape {
  readonly url: string
  readonly openTimeout: string | number
  readonly requestTimeout: string | number
}

export const HarnessBrowserTransportConfig = Context.GenericTag<HarnessBrowserTransportConfigShape>(
  'tmnl/harness/HarnessBrowserTransportConfig',
)

const readExplicitHarnessWsUrl = (): string | null => {
  const globalOverride = (globalThis as { __TMNL_HARNESS_WS_URL?: string }).__TMNL_HARNESS_WS_URL
  if (typeof globalOverride === 'string' && globalOverride.length > 0) {
    return globalOverride
  }

  const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env
  const viteOverride = viteEnv?.VITE_HARNESS_WS_URL
  if (typeof viteOverride === 'string' && viteOverride.length > 0) {
    return viteOverride
  }

  const processOverride = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.HARNESS_WS_URL
  if (typeof processOverride === 'string' && processOverride.length > 0) {
    return processOverride
  }

  return null
}

const defaultBrowserWebSocketUrl = (): string => {
  const explicit = readExplicitHarnessWsUrl()
  if (explicit) return explicit

  // Browser/dev: prefer same-origin websocket URL so Vite proxy can forward
  // /api/harness/ws -> localhost:8787 even when accessing from another device.
  if (typeof window !== 'undefined' && window.location) {
    const protocol = window.location.protocol
    if (protocol === 'http:' || protocol === 'https:') {
      const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:'
      return `${wsProtocol}//${window.location.host}/api/harness/ws`
    }
  }

  // Non-browser fallback (tests/SSR/CLI)
  return 'ws://127.0.0.1:8787/api/harness/ws'
}

export const HarnessBrowserTransportConfigDefault = Layer.succeed(HarnessBrowserTransportConfig, {
  url: defaultBrowserWebSocketUrl(),
  openTimeout: '10 seconds',
  requestTimeout: '2 minutes',
} satisfies HarnessBrowserTransportConfigShape)

const encodeEnvelope = (
  envelope: typeof HarnessWsOutgoingEnvelope.Type,
): Effect.Effect<string, HarnessBrowserTransportError> =>
  Effect.try({
    try: () => JSON.stringify(envelope),
    catch: (cause) =>
      new HarnessBrowserTransportError({
        message: 'Failed to encode harness websocket envelope',
        cause: Option.some(cause),
      }),
  })

const decodeEnvelope = (
  raw: string,
): Effect.Effect<typeof HarnessWsIncomingEnvelope.Type, HarnessBrowserTransportError> =>
  Effect.try({
    try: () => JSON.parse(raw),
    catch: (cause) =>
      new HarnessBrowserTransportError({
        message: 'Failed to parse websocket message as JSON',
        cause: Option.some(cause),
      }),
  }).pipe(
    Effect.flatMap((parsed) =>
      Either.match(Schema.decodeUnknownEither(HarnessWsIncomingEnvelope)(parsed), {
        onLeft: (cause) =>
          Effect.fail(
            new HarnessBrowserTransportError({
              message: 'Failed to decode harness websocket envelope',
              cause: Option.some(cause),
            }),
          ),
        onRight: Effect.succeed,
      }),
    ),
  )

const decodeChunk = (
  chunk: string | Uint8Array,
): Effect.Effect<typeof HarnessWsIncomingEnvelope.Type, HarnessBrowserTransportError> =>
  Effect.try({
    try: () => (typeof chunk === 'string' ? chunk : new TextDecoder().decode(chunk)),
    catch: (cause) =>
      new HarnessBrowserTransportError({
        message: 'Failed to decode websocket chunk',
        cause: Option.some(cause),
      }),
  }).pipe(Effect.flatMap(decodeEnvelope))

const failPendingRequests = (
  pendingRef: Ref.Ref<HashMap.HashMap<string, Deferred.Deferred<unknown, HarnessBrowserTransportError>>>,
  error: HarnessBrowserTransportError,
): Effect.Effect<void> =>
  Effect.gen(function* () {
    const pending = yield* Ref.getAndSet(pendingRef, HashMap.empty())

    yield* Effect.forEach(HashMap.values(pending), (deferred) => Deferred.fail(deferred, error), {
      discard: true,
    })
  }).pipe(Effect.asVoid)

export const HarnessBrowserTransportLive = Layer.scoped(
  HarnessBrowserTransport,
  Effect.gen(function* () {
    const config = yield* HarnessBrowserTransportConfig
    const webSocketConstructor = yield* Socket.WebSocketConstructor

    const pendingRef = yield* Ref.make<HashMap.HashMap<string, Deferred.Deferred<unknown, HarnessBrowserTransportError>>>(
      HashMap.empty(),
    )
    const eventsPubSub = yield* PubSub.unbounded<unknown>()

    // ── Eagerly open socket inside Layer.scoped body ──────────────────
    // This ensures forkScoped attaches the message loop fiber to the
    // Layer's scope (not a transient caller scope). Without this, the
    // message loop fiber gets interrupted when the first runPromise()
    // call completes, because Effect.fork creates a child scope.
    const socket = yield* Socket.fromWebSocket(Effect.sync(() => webSocketConstructor(config.url)), {
      openTimeout: config.openTimeout,
    }).pipe(
      Effect.mapError(
        (cause) =>
          new HarnessBrowserTransportError({
            message: `Failed to open harness websocket transport at ${config.url}`,
            cause: Option.some(cause),
          }),
      ),
    )

    const write = yield* socket.writer
    const connected = yield* Deferred.make<void, HarnessBrowserTransportError>()

    // ── Fork message loop into the Layer scope via forkScoped ─────────
    yield* Effect.forkScoped(
      socket.runRaw(
        (chunk) =>
          decodeChunk(chunk).pipe(
            Effect.flatMap((envelope) =>
              Match.value(envelope).pipe(
                Match.tag('remote:ws_event', (evt) => {
                  // Latency probe: stamp WS receive on browser side
                  const innerEvt = (evt.event as { event?: unknown })?.event ?? evt.event
                  const seq = (innerEvt as { seq?: number })?.seq
                  if (typeof seq === 'number') {
                    try {
                      const { streamingLatencyProbe } = require('./perf/StreamingLatencyProbe')
                      streamingLatencyProbe.stamp(seq, 'ws_recv')
                    } catch {}
                  }
                  return PubSub.publish(eventsPubSub, evt.event).pipe(Effect.asVoid)
                }),
                Match.tag('remote:ws_response', (res) =>
                  Effect.gen(function* () {
                    const pending = yield* Ref.modify(pendingRef, (map) => {
                      const deferred = HashMap.get(map, res.requestId)
                      const next = HashMap.remove(map, res.requestId)
                      return [deferred, next] as const
                    })

                    if (Option.isNone(pending)) return
                    yield* Deferred.succeed(pending.value, res.response)
                  }),
                ),
                Match.exhaustive,
              ),
            ),
            Effect.catchAll((err) =>
              Effect.logWarning(`Harness websocket decode failed: ${err.message}`),
            ),
          ),
        {
          onOpen: Deferred.succeed(connected, undefined),
        },
      ).pipe(
        Effect.catchAll((cause) =>
          failPendingRequests(
            pendingRef,
            new HarnessBrowserTransportError({
              message: 'Harness websocket closed or failed',
              cause: Option.some(cause),
            }),
          ),
        ),
        Effect.asVoid,
      ),
    )

    yield* Deferred.await(connected).pipe(
      Effect.timeoutFail({
        duration: config.openTimeout,
        onTimeout: () =>
          new HarnessBrowserTransportError({
            message: `Timed out waiting for websocket open at ${config.url}`,
            cause: Option.none(),
          }),
      }),
    )

    // ── Request implementation ────────────────────────────────────────
    const request: HarnessBrowserTransportShape['request'] = (command: HarnessRemoteCommand) =>
      Effect.gen(function* () {
        const requestId = nanoid()
        const deferred = yield* Deferred.make<unknown, HarnessBrowserTransportError>()

        yield* Ref.update(pendingRef, HashMap.set(requestId, deferred))

        const payload = yield* encodeEnvelope({
          _tag: 'remote:ws_request',
          requestId,
          command,
        })

        yield* write(payload).pipe(
          Effect.mapError(
            (cause) =>
              new HarnessBrowserTransportError({
                message: 'Failed to write harness websocket request',
                cause: Option.some(cause),
              }),
          ),
        )

        return yield* Deferred.await(deferred).pipe(
          Effect.timeoutFail({
            duration: config.requestTimeout,
            onTimeout: () =>
              new HarnessBrowserTransportError({
                message: `Timed out waiting for harness response (${command._tag})`,
                cause: Option.none(),
              }),
          }),
          Effect.ensuring(
            Ref.update(pendingRef, HashMap.remove(requestId)),
          ),
        )
      })

    // ── Finalizer ─────────────────────────────────────────────────────
    yield* Effect.addFinalizer(() =>
      failPendingRequests(
        pendingRef,
        new HarnessBrowserTransportError({
          message: 'Harness websocket transport finalized',
          cause: Option.none(),
        }),
      ),
    )

    return {
      request,
      events: Stream.fromPubSub(eventsPubSub),
    } satisfies HarnessBrowserTransportShape
  }),
)

export const HarnessBrowserTransportWebSocketDefault = HarnessBrowserTransportLive.pipe(
  Layer.provide(Socket.layerWebSocketConstructorGlobal),
  Layer.provide(HarnessBrowserTransportConfigDefault),
)

export const makeHarnessBrowserTransportLayer = (
  config: HarnessBrowserTransportConfigShape,
) =>
  HarnessBrowserTransportLive.pipe(
    Layer.provide(Socket.layerWebSocketConstructorGlobal),
    Layer.provide(Layer.succeed(HarnessBrowserTransportConfig, config)),
  )
