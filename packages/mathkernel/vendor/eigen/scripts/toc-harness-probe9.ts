/**
 * TOC Probe 9: Pure JS WebSocket + Effect Deferreds.
 * No @effect/platform Socket at all. Just raw browser API.
 */
import { Effect, Deferred, Option, ManagedRuntime, Layer } from 'effect'
import { HarnessRuntime } from '../src/lib/harness/HarnessRuntime'
import { HarnessRuntimeBrowserLive } from '../src/lib/harness/HarnessRuntimeBrowser'
import {
  HarnessBrowserTransport,
  HarnessBrowserTransportError,
  type HarnessBrowserTransportShape,
} from '../src/lib/harness/HarnessBrowserTransport'
import { Stream, PubSub } from 'effect'

const WS_URL = 'ws://127.0.0.1:8787/api/harness/ws'

const RawTransport = Layer.scoped(
  HarnessBrowserTransport,
  Effect.gen(function* () {
    const eventsPubSub = yield* PubSub.unbounded<unknown>()
    
    // Plain JS state — no Effect Refs in the sync callback
    const pending = new Map<string, Deferred.Deferred<unknown, HarnessBrowserTransportError>>()

    const ws = yield* Effect.acquireRelease(
      Effect.async<WebSocket, HarnessBrowserTransportError>((resume) => {
        const s = new WebSocket(WS_URL)
        s.onopen = () => { console.log('[raw] ws open'); resume(Effect.succeed(s)) }
        s.onerror = () => resume(Effect.fail(new HarnessBrowserTransportError({ message: 'connect failed', cause: Option.none() })))
      }),
      (ws) => Effect.sync(() => { try { ws.close() } catch {} }),
    )

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string)
        console.log('[raw:msg]', data._tag, data.requestId ?? '')
        if (data._tag === 'remote:ws_response' && pending.has(data.requestId)) {
          const d = pending.get(data.requestId)!
          pending.delete(data.requestId)
          Effect.runFork(Deferred.succeed(d, data.response))
        } else if (data._tag === 'remote:ws_event') {
          Effect.runFork(PubSub.publish(eventsPubSub, data.event))
        }
      } catch (e) { console.error('[raw:msg] parse error:', e) }
    }

    const request: HarnessBrowserTransportShape['request'] = (command) =>
      Effect.gen(function* () {
        const requestId = `r-${Date.now()}-${Math.random().toString(36).slice(2,6)}`
        const d = yield* Deferred.make<unknown, HarnessBrowserTransportError>()
        pending.set(requestId, d)
        ws.send(JSON.stringify({ _tag: 'remote:ws_request', requestId, command }))
        console.log('[raw] sent', requestId)
        return yield* Deferred.await(d).pipe(
          Effect.timeoutFail({ duration: '10 seconds', onTimeout: () => new HarnessBrowserTransportError({ message: 'timeout', cause: Option.none() }) }),
        )
      })

    return { request, events: Stream.fromPubSub(eventsPubSub) } satisfies HarnessBrowserTransportShape
  }),
)

const TestLayer = HarnessRuntimeBrowserLive.pipe(Layer.provide(RawTransport))

async function test() {
  const mr = ManagedRuntime.make(TestLayer)

  console.log('[1] open session A...')
  const s1 = await mr.runPromise(Effect.gen(function* () {
    const rt = yield* HarnessRuntime
    return yield* rt.openSession('raw-a', 'general')
  }))
  console.log('[1] ✓', s1.sessionId)

  console.log('[2] open session B...')
  const s2 = await mr.runPromise(Effect.gen(function* () {
    const rt = yield* HarnessRuntime
    return yield* rt.openSession('raw-b', 'general')
  }).pipe(Effect.timeout('5 seconds')))
  console.log('[2]', s2 ? `✓ ${(s2 as any).sessionId}` : '✗ TIMEOUT')

  console.log('[3] send...')
  const ack = await mr.runPromise(Effect.gen(function* () {
    const rt = yield* HarnessRuntime
    return yield* rt.send(s1.sessionId, `cmid-${Date.now()}` as any, 'Hello', Option.none())
  }).pipe(Effect.timeout('5 seconds')))
  console.log('[3]', ack ? '✓' : '✗ TIMEOUT')

  await mr.dispose()
}

test().then(
  () => { console.log('ALL PASSED'); process.exit(0) },
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
