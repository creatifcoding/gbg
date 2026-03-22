/**
 * TOC Probe 19: Test the REAL HarnessBrowserTransport after forkScoped fix.
 * Two sequential requests through ManagedRuntime.
 */
import { Effect, ManagedRuntime } from 'effect'
import {
  HarnessBrowserTransport,
  HarnessBrowserTransportWebSocketDefault,
} from '../src/lib/harness/HarnessBrowserTransport'

async function test() {
  const mr = ManagedRuntime.make(HarnessBrowserTransportWebSocketDefault)

  console.log('=== REQUEST 1: open_session ===')
  const r1 = await mr.runPromise(Effect.gen(function* () {
    const transport = yield* HarnessBrowserTransport
    return yield* transport.request({
      _tag: 'remote:chat_v2_open_session',
      nodeId: 'probe19-a',
      role: 'general',
    })
  }))
  console.log('[1] ✓', JSON.stringify(r1).slice(0, 100))

  await new Promise(r => setTimeout(r, 500))

  console.log('\n=== REQUEST 2: open_session ===')
  const r2 = await mr.runPromise(Effect.gen(function* () {
    const transport = yield* HarnessBrowserTransport
    return yield* transport.request({
      _tag: 'remote:chat_v2_open_session',
      nodeId: 'probe19-b',
      role: 'general',
    })
  }).pipe(Effect.timeout('5 seconds')))
  console.log('[2]', r2 ? '✓' : '✗ TIMEOUT', r2 ? JSON.stringify(r2).slice(0, 100) : '')

  console.log('\n=== REQUEST 3: send_message ===')
  const sessionId = (r1 as any)?.data?.sessionId ?? (r1 as any)?.sessionId
  if (sessionId) {
    const r3 = await mr.runPromise(Effect.gen(function* () {
      const transport = yield* HarnessBrowserTransport
      return yield* transport.request({
        _tag: 'remote:chat_v2_send_message',
        sessionId,
        content: 'Hello from probe 19!',
      })
    }).pipe(Effect.timeout('30 seconds')))
    console.log('[3] ✓', JSON.stringify(r3).slice(0, 200))
  } else {
    console.log('[3] SKIPPED — no sessionId from r1')
  }

  await mr.dispose()
}

test().then(
  () => { console.log('\nPASS'); process.exit(0) },
  (err) => { console.error('\nFAIL:', err); process.exit(1) },
)
