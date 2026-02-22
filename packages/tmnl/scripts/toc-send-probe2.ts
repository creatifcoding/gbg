/**
 * TOC Send Probe 2: HarnessRuntime-level — open + send + inspect decoded events.
 * Tests: runtime.send + runtime.events delivers typed HarnessEvent objects.
 */
import { Effect, ManagedRuntime, Stream, Fiber, Option } from 'effect'
import { HarnessRuntime, HarnessRuntimeBrowserWebSocketDefault } from '../src/lib/harness'
import type { HarnessEvent } from '../src/lib/harness/schemas'

async function test() {
  const mr = ManagedRuntime.make(HarnessRuntimeBrowserWebSocketDefault)

  const events: HarnessEvent[] = []

  // Subscribe events FIRST
  const eventFiber = await mr.runFork(Effect.gen(function* () {
    const runtime = yield* HarnessRuntime
    yield* Stream.runForEach(runtime.events, (event) =>
      Effect.sync(() => {
        events.push(event)
        console.log(`[event] ${event._tag} ${(event as any).messageId ?? (event as any).sessionId ?? ''}`)
      }),
    )
  }))

  await new Promise(r => setTimeout(r, 200))

  // Open session
  console.log('[1] openSession...')
  const session = await mr.runPromise(Effect.gen(function* () {
    const runtime = yield* HarnessRuntime
    return yield* runtime.openSession('send-probe2', 'general')
  }))
  console.log('[1] ✓', session.sessionId)

  await new Promise(r => setTimeout(r, 500))

  // Send message
  console.log('\n[2] send...')
  const ack = await mr.runPromise(Effect.gen(function* () {
    const runtime = yield* HarnessRuntime
    return yield* runtime.send(
      session.sessionId,
      'cmid-probe2-001' as any,
      'What is 2+2?',
      Option.none(),
    )
  }).pipe(Effect.timeout('30 seconds')))
  console.log('[2] ✓ ack:', JSON.stringify(ack))

  // Wait for response
  console.log('\n[3] waiting 10s for streaming events...')
  await new Promise(r => setTimeout(r, 10000))
  
  console.log(`\n[4] total events: ${events.length}`)
  for (const e of events) {
    const tag = e._tag
    const preview = tag === 'chat:v2/assistant_delta' 
      ? `delta="${(e as any).delta?.slice(0, 40)}"` 
      : tag === 'chat:v2/assistant_final'
      ? `text="${(e as any).text?.slice(0, 80)}"`
      : ''
    console.log(`  - ${tag} ${preview}`)
  }

  await Fiber.interrupt(eventFiber)
  await mr.dispose()
}

test().then(
  () => { console.log('\nPASS'); process.exit(0) },
  (err) => { console.error('\nFAIL:', err); process.exit(1) },
)
