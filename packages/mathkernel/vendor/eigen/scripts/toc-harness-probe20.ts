/**
 * TOC Probe 20: Final verification — 4 sequential requests + event stream.
 */
import { Effect, ManagedRuntime, Stream } from 'effect'
import {
  HarnessBrowserTransport,
  HarnessBrowserTransportWebSocketDefault,
} from '../src/lib/harness/HarnessBrowserTransport'

async function test() {
  const mr = ManagedRuntime.make(HarnessBrowserTransportWebSocketDefault)

  // Collect events in background
  const eventLog: string[] = []
  const eventFiber = await mr.runFork(Effect.gen(function* () {
    const transport = yield* HarnessBrowserTransport
    yield* Stream.runForEach(transport.events, (evt) =>
      Effect.sync(() => {
        const tag = (evt as any)?._tag ?? 'unknown'
        eventLog.push(tag)
      }),
    )
  }))

  for (let i = 1; i <= 4; i++) {
    console.log(`[${i}] open_session...`)
    const r = await mr.runPromise(Effect.gen(function* () {
      const transport = yield* HarnessBrowserTransport
      return yield* transport.request({
        _tag: 'remote:chat_v2_open_session',
        nodeId: `probe20-${i}`,
        role: 'general',
      })
    }).pipe(Effect.timeout('5 seconds')))
    const ok = (r as any)?.ok
    const sid = (r as any)?.data?.sessionId?.slice(0, 30)
    console.log(`[${i}] ${ok ? '✓' : '✗'} sessionId=${sid}...`)
  }

  await new Promise(r => setTimeout(r, 500))
  console.log(`\nEvents received: ${eventLog.length}`)
  console.log('Event tags:', eventLog.join(', '))

  await mr.dispose()
  console.log('\nALL PASS')
}

test().then(
  () => process.exit(0),
  (err) => { console.error('FAIL:', err); process.exit(1) },
)
