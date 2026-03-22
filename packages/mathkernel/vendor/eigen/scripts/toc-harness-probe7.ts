/**
 * TOC Probe 7: Use the REAL HarnessBrowserTransport, but instrument the
 * message loop by wrapping the transport layer.
 */
import { Effect, Layer, ManagedRuntime, HashMap, Ref, Option, Deferred } from 'effect'
import {
  HarnessBrowserTransport,
  HarnessBrowserTransportLive,
  HarnessBrowserTransportConfig,
  HarnessBrowserTransportConfigDefault,
} from '../src/lib/harness/HarnessBrowserTransport'
import * as Socket from '@effect/platform/Socket'

// Wrap the transport to log every request/response
const InstrumentedTransport = Layer.effect(
  HarnessBrowserTransport,
  Effect.gen(function* () {
    const inner = yield* HarnessBrowserTransport
    return {
      request: (command: any) => {
        console.log('[instrument] request:', command._tag)
        return inner.request(command).pipe(
          Effect.tap((resp) => Effect.sync(() => console.log('[instrument] response for:', command._tag, '→', (resp as any)?.ok ?? 'raw'))),
          Effect.tapError((err) => Effect.sync(() => console.error('[instrument] error for:', command._tag, err))),
        )
      },
      events: inner.events,
    } as any
  }),
)

const TestLayer = InstrumentedTransport.pipe(
  Layer.provide(HarnessBrowserTransportLive),
  Layer.provide(Socket.layerWebSocketConstructorGlobal),
  Layer.provide(HarnessBrowserTransportConfigDefault),
)

async function test() {
  const mr = ManagedRuntime.make(TestLayer)

  console.log('[1] request...')
  const r1 = await mr.runPromise(
    Effect.gen(function* () {
      const t = yield* HarnessBrowserTransport
      return yield* t.request({ _tag: 'remote:chat_v2_open_session', nodeId: 'probe7-a', role: 'general' } as any)
    }),
  )
  console.log('[1] ✓')

  console.log('[2] request...')
  const r2 = await mr.runPromise(
    Effect.gen(function* () {
      const t = yield* HarnessBrowserTransport
      return yield* t.request({ _tag: 'remote:chat_v2_open_session', nodeId: 'probe7-b', role: 'general' } as any)
    }).pipe(Effect.timeout('5 seconds')),
  )
  console.log('[2]', r2 ? '✓' : '✗ TIMEOUT')

  await mr.dispose()
}

test().then(
  () => { console.log('PASS'); process.exit(0) },
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
