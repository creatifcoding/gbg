/**
 * TOC Probe 3: Test at transport level directly.
 * Bypass HarnessRuntime, call transport.request() twice.
 */
import { Effect, Layer, ManagedRuntime } from 'effect'
import {
  HarnessBrowserTransport,
  HarnessBrowserTransportWebSocketDefault,
} from '../src/lib/harness/HarnessBrowserTransport'

async function test() {
  const mr = ManagedRuntime.make(HarnessBrowserTransportWebSocketDefault)

  console.log('[1] transport.request(open_session)...')
  const r1 = await mr.runPromise(
    Effect.gen(function* () {
      const transport = yield* HarnessBrowserTransport
      return yield* transport.request({
        _tag: 'remote:chat_v2_open_session',
        nodeId: 'transport-probe-a',
        role: 'general',
      } as any)
    }),
  )
  console.log('[1] ✓ response:', JSON.stringify(r1))

  console.log('[2] transport.request(open_session) — second call...')
  const r2 = await mr.runPromise(
    Effect.gen(function* () {
      const transport = yield* HarnessBrowserTransport
      return yield* transport.request({
        _tag: 'remote:chat_v2_open_session',
        nodeId: 'transport-probe-b',
        role: 'general',
      } as any)
    }).pipe(Effect.timeout('5 seconds')),
  )
  console.log('[2]', r2 ? `✓ ${JSON.stringify(r2)}` : '✗ TIMEOUT')

  await mr.dispose()
}

test().then(
  () => { console.log('PASS'); process.exit(0) },
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
