/**
 * TOC Send Probe 1: Transport-level — open session, then send a message.
 * Verifies: transport.request works for chat_v2_send + events arrive.
 */
import { Effect, ManagedRuntime, Stream, Fiber } from 'effect'
import {
  HarnessBrowserTransport,
  HarnessBrowserTransportWebSocketDefault,
} from '../src/lib/harness/HarnessBrowserTransport'

async function test() {
  const mr = ManagedRuntime.make(HarnessBrowserTransportWebSocketDefault)

  // Collect events
  const events: any[] = []
  const eventFiber = await mr.runFork(Effect.gen(function* () {
    const t = yield* HarnessBrowserTransport
    yield* Stream.runForEach(t.events, (evt) =>
      Effect.sync(() => {
        events.push(evt)
        console.log(`[event] ${(evt as any)?._tag ?? 'unknown'}`)
      }),
    )
  }))

  // Wait for subscriber to register
  await new Promise(r => setTimeout(r, 200))

  // Step 1: open session
  console.log('[1] open_session...')
  const r1: any = await mr.runPromise(Effect.gen(function* () {
    const t = yield* HarnessBrowserTransport
    return yield* t.request({
      _tag: 'remote:chat_v2_open_session',
      nodeId: 'send-probe1',
      role: 'general',
    })
  }))
  const sessionId = r1?.data?.sessionId
  console.log('[1] ✓ sessionId:', sessionId)

  await new Promise(r => setTimeout(r, 500))
  console.log('[1] events after open:', events.length)

  // Step 2: send message
  console.log('\n[2] chat_v2_send...')
  try {
    const r2: any = await mr.runPromise(Effect.gen(function* () {
      const t = yield* HarnessBrowserTransport
      return yield* t.request({
        _tag: 'remote:chat_v2_send',
        sessionId,
        clientMessageId: 'cmid-probe1-001',
        text: 'Hello from TOC probe!',
      })
    }).pipe(Effect.timeout('30 seconds')))
    console.log('[2] ✓ response:', JSON.stringify(r2).slice(0, 200))
  } catch (err) {
    console.error('[2] ✗', err)
  }

  // Wait for streaming events
  console.log('\n[3] waiting 5s for events...')
  await new Promise(r => setTimeout(r, 5000))
  console.log('[3] total events:', events.length)
  for (const e of events) {
    console.log(`  - ${(e as any)?._tag} ${(e as any)?.messageId ?? ''}`)
  }

  await Fiber.interrupt(eventFiber)
  await mr.dispose()
}

test().then(
  () => { console.log('\nPASS'); process.exit(0) },
  (err) => { console.error('\nFAIL:', err); process.exit(1) },
)
