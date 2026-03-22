/**
 * TOC Send Probe 4: Test harnessOps.send via direct fn-atom invocation.
 * Simulates what happens when the browser calls doSend().
 * 
 * Chain: connect fn-atom → send fn-atom → verify atoms change
 */
import { Effect, ManagedRuntime, Stream, Fiber, Option } from 'effect'
import {
  HarnessRuntime,
  HarnessRuntimeBrowserWebSocketDefault,
} from '../src/lib/harness'

// We can't easily use fn-atoms outside React, so let's replicate what they do:
// 1. connect: yield* HarnessRuntime → openSession → fork event stream
// 2. send: yield* HarnessRuntime → ctx(sessionId$) → runtime.send(...)

async function test() {
  const mr = ManagedRuntime.make(HarnessRuntimeBrowserWebSocketDefault)

  let sessionId: string | null = null
  const messages: any[] = []

  // Step 1: connect (replicate fn-atom logic)
  console.log('[1] connect...')
  
  // Start event stream as daemon
  const eventFiber = await mr.runFork(Effect.gen(function* () {
    const runtime = yield* HarnessRuntime
    yield* Stream.runForEach(runtime.events, (event) =>
      Effect.sync(() => {
        console.log(`[event] ${event._tag}`)
        // Replicate processEvent for key events
        switch (event._tag) {
          case 'chat:v2/session_opened':
            console.log(`  → session opened: ${event.sessionId}`)
            break
          case 'chat:v2/send_accepted':
            console.log(`  → send accepted`)
            // Mark pending → sent
            for (const m of messages) {
              if (m.status === 'pending') m.status = 'sent'
            }
            break
          case 'chat:v2/assistant_start':
            console.log(`  → assistant start: ${event.messageId}`)
            messages.push({ id: event.messageId, role: 'agent', content: '', status: 'streaming' })
            break
          case 'chat:v2/assistant_delta':
            for (const m of messages) {
              if (m.id === event.messageId) m.content += event.delta
            }
            break
          case 'chat:v2/assistant_final':
            console.log(`  → assistant final: "${event.text?.slice(0, 60)}"`)
            for (const m of messages) {
              if (m.id === event.messageId) { m.content = event.text; m.status = 'complete' }
            }
            break
        }
      }),
    )
  }))

  await new Promise(r => setTimeout(r, 200))

  sessionId = await mr.runPromise(Effect.gen(function* () {
    const runtime = yield* HarnessRuntime
    const session = yield* runtime.openSession('send-probe4', 'general')
    return session.sessionId as string
  }))
  console.log('[1] ✓ sessionId:', sessionId)
  await new Promise(r => setTimeout(r, 500))

  // Step 2: send (replicate fn-atom logic)
  console.log('\n[2] send...')
  
  // Optimistic insert
  const cmid = `cmid-${Date.now()}`
  messages.push({ id: cmid, role: 'operator', content: 'What is 2+2?', status: 'pending' })

  await mr.runPromise(Effect.gen(function* () {
    const runtime = yield* HarnessRuntime
    yield* runtime.send(
      sessionId! as any,
      cmid as any,
      'What is 2+2?',
      Option.none(),
    )
  }).pipe(Effect.timeout('30 seconds')))
  console.log('[2] ✓ send completed')

  // Wait for streaming
  await new Promise(r => setTimeout(r, 8000))

  console.log(`\n[3] messages: ${messages.length}`)
  for (const m of messages) {
    console.log(`  [${m.role}] ${m.status}: "${m.content?.slice(0, 80)}"`)
  }

  await Fiber.interrupt(eventFiber)
  await mr.dispose()
}

test().then(
  () => { console.log('\nPASS'); process.exit(0) },
  (err) => { console.error('\nFAIL:', err); process.exit(1) },
)
