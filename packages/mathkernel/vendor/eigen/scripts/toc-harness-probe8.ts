/**
 * TOC Probe 8: Bypass socket.runRaw entirely. 
 * Use raw globalThis.WebSocket + Effect.async for the message handler.
 * If this works, the constraint is definitively in @effect/platform Socket.runRaw.
 */
import { Effect, Layer, ManagedRuntime, HashMap, Ref, Option, Deferred, Fiber, PubSub, Queue, Stream } from 'effect'
import {
  HarnessBrowserTransport,
  HarnessBrowserTransportError,
  type HarnessBrowserTransportShape,
} from '../src/lib/harness/HarnessBrowserTransport'
import {
  HarnessWsIncomingEnvelope,
} from '../src/lib/harness/HarnessBrowserRemoteSchemas'
import { Schema, Either, Match } from 'effect'

const WS_URL = 'ws://127.0.0.1:8787/api/harness/ws'

/**
 * Alternative transport that uses raw WebSocket instead of @effect/platform Socket.
 */
const RawWsTransportLive = Layer.scoped(
  HarnessBrowserTransport,
  Effect.gen(function* () {
    const pendingRef = yield* Ref.make<HashMap.HashMap<string, Deferred.Deferred<unknown, HarnessBrowserTransportError>>>(HashMap.empty())
    const eventsPubSub = yield* PubSub.unbounded<unknown>()

    // Open WebSocket
    const ws = yield* Effect.acquireRelease(
      Effect.async<WebSocket, HarnessBrowserTransportError>((resume) => {
        const socket = new WebSocket(WS_URL)
        socket.onopen = () => resume(Effect.succeed(socket))
        socket.onerror = () => resume(Effect.fail(new HarnessBrowserTransportError({
          message: `Failed to connect to ${WS_URL}`,
          cause: Option.none(),
        })))
      }),
      (ws) => Effect.sync(() => { try { ws.close() } catch {} }),
    )
    console.log('[rawWs] connected')

    // Message handler — runs synchronously in the WebSocket callback
    ws.onmessage = (event) => {
      const raw = typeof event.data === 'string' ? event.data : ''
      console.log('[rawWs:onmessage] received', raw.length, 'chars')
      try {
        const parsed = JSON.parse(raw)
        if (parsed._tag === 'remote:ws_response') {
          console.log('[rawWs:onmessage] response requestId:', parsed.requestId)
          // Resolve pending deferred synchronously
          const map = Ref.unsafeGet(pendingRef) as HashMap.HashMap<string, Deferred.Deferred<unknown, HarnessBrowserTransportError>>
          const deferred = HashMap.get(map, parsed.requestId)
          if (Option.isSome(deferred)) {
            Ref.unsafeSet(pendingRef, HashMap.remove(map, parsed.requestId) as any)
            Effect.runSync(Deferred.succeed(deferred.value, parsed.response))
            console.log('[rawWs:onmessage] deferred resolved')
          } else {
            console.log('[rawWs:onmessage] no pending deferred for', parsed.requestId)
          }
        } else if (parsed._tag === 'remote:ws_event') {
          console.log('[rawWs:onmessage] event')
          Effect.runSync(PubSub.publish(eventsPubSub, parsed.event).pipe(Effect.asVoid))
        }
      } catch (err) {
        console.error('[rawWs:onmessage] error:', err)
      }
    }

    const request: HarnessBrowserTransportShape['request'] = (command) =>
      Effect.gen(function* () {
        const requestId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const deferred = yield* Deferred.make<unknown, HarnessBrowserTransportError>()
        yield* Ref.update(pendingRef, HashMap.set(requestId, deferred))

        const payload = JSON.stringify({
          _tag: 'remote:ws_request' as const,
          requestId,
          command,
        })
        console.log('[rawWs] sending', requestId)
        ws.send(payload)

        return yield* Deferred.await(deferred).pipe(
          Effect.timeoutFail({
            duration: '10 seconds',
            onTimeout: () => new HarnessBrowserTransportError({
              message: `Timeout waiting for response ${requestId}`,
              cause: Option.none(),
            }),
          }),
        )
      })

    return { request, events: Stream.fromPubSub(eventsPubSub) } satisfies HarnessBrowserTransportShape
  }),
)

// Wire it with HarnessRuntimeBrowser
import { HarnessRuntime } from '../src/lib/harness/HarnessRuntime'
import { HarnessRuntimeBrowserLive } from '../src/lib/harness/HarnessRuntimeBrowser'

const TestLayer = HarnessRuntimeBrowserLive.pipe(Layer.provide(RawWsTransportLive))

async function test() {
  const mr = ManagedRuntime.make(TestLayer)

  console.log('[1] openSession...')
  const s1 = await mr.runPromise(Effect.gen(function* () {
    const rt = yield* HarnessRuntime
    return yield* rt.openSession('rawws-a', 'general')
  }))
  console.log('[1] ✓', s1.sessionId)

  console.log('[2] openSession (different node)...')
  const s2 = await mr.runPromise(Effect.gen(function* () {
    const rt = yield* HarnessRuntime
    return yield* rt.openSession('rawws-b', 'general')
  }).pipe(Effect.timeout('5 seconds')))
  console.log('[2]', s2 ? `✓ ${(s2 as any).sessionId}` : '✗ TIMEOUT')

  console.log('[3] send message...')
  const ack = await mr.runPromise(Effect.gen(function* () {
    const rt = yield* HarnessRuntime
    return yield* rt.send(s1.sessionId, `cmid-${Date.now()}` as any, 'Hello!', Option.none())
  }).pipe(Effect.timeout('5 seconds')))
  console.log('[3]', ack ? '✓ sent' : '✗ TIMEOUT')

  await mr.dispose()
  console.log('✓ ALL PASSED')
}

test().then(
  () => process.exit(0),
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
